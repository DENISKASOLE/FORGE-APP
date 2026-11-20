// All forge-mcp tools. `supabase` is a per-request client already
// carrying the caller's own Supabase JWT as its Authorization header
// (see index.ts) - every query here runs under that caller's Row Level
// Security, so a coach only ever sees/writes their own clients, exactly
// like every other data-access path in this app (src/lib/clientData.js).
// Never the service role key.
import { z } from "npm:zod@^4.3.6";
import { hydrateProgram, currentProgramWeek, spliceWeeks, sessionsInWeeks } from "./programModel.ts";
import { buildPlanItem, buildMeal, buildPlanVersion, publishPlan, planForDate, planVersionForDate, validatePlanVersion } from "./nutritionModel.ts";
import { bestLiftsFrom, recentSessions } from "./trainingLogs.ts";
import { libraryItems, searchLibrary, resolveProgramVideos } from "./exerciseLibrary.ts";

const uuid = () => z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, "must be a client_id (uuid)");
const isoDateStr = () => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

function toolText(obj: any) {
  return { content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }] };
}

async function clientRow(supabase: any, clientId: string) {
  const { data, error } = await supabase.from("clients").select("id,name,email,phone,created_at").eq("id", clientId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No client found with id ${clientId} (or it isn't one of your clients).`);
  return data;
}
async function sectionData(supabase: any, clientId: string, section: string) {
  const { data, error } = await supabase.from("client_data").select("data").eq("client_id", clientId).eq("section", section).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.data ?? null;
}
async function writeSection(supabase: any, clientId: string, section: string, data: any) {
  const { error } = await supabase.from("client_data").upsert({ client_id: clientId, section, data }, { onConflict: "client_id,section" });
  if (error) throw new Error(error.message);
}
// The signed-in coach's user id (= trainer_data.trainer_id), checked
// against Supabase Auth with the caller's own token.
async function coachId(supabase: any, token: string): Promise<string> {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) throw new Error("Couldn't identify the signed-in coach. Reconnect the Forge connector and try again.");
  return data.user.id;
}
async function trainerSection(supabase: any, trainerId: string, section: string) {
  const { data, error } = await supabase.from("trainer_data").select("data").eq("trainer_id", trainerId).eq("section", section).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.data ?? null;
}
async function writeTrainerSection(supabase: any, trainerId: string, section: string, data: any) {
  const { error } = await supabase.from("trainer_data").upsert({ trainer_id: trainerId, section, data }, { onConflict: "trainer_id,section" });
  if (error) throw new Error(error.message);
}
// Resolve videos from the coach's library, hydrate, and build the short
// summary every program/template write returns.
async function prepareProgram(supabase: any, trainerId: string, program: any, existingId?: string) {
  const items = libraryItems(await trainerSection(supabase, trainerId, "custom_exercise_library"));
  const resolved = resolveProgramVideos(program, items);
  const hydrated = hydrateProgram(resolved.program, existingId);
  const summary: any = {
    version: hydrated.version,
    weeks: resolved.counts.weeks, workouts: resolved.counts.workouts, exercises: resolved.counts.exercises,
    unmatchedExercises: resolved.unmatchedExercises,
  };
  if (resolved.unknownLibraryIds.length) summary.unknownLibraryExerciseIds = resolved.unknownLibraryIds;
  return { hydrated, summary };
}

async function allClientsWithProfile(supabase: any) {
  const { data: clients, error } = await supabase.from("clients").select("id,name,email,created_at").order("name");
  if (error) throw new Error(error.message);
  const ids = (clients || []).map((c: any) => c.id);
  if (!ids.length) return [];
  const { data: profiles, error: perr } = await supabase.from("client_data").select("client_id,data").eq("section", "profile").in("client_id", ids);
  if (perr) throw new Error(perr.message);
  const profileByClient: Record<string, any> = {};
  (profiles || []).forEach((p: any) => { profileByClient[p.client_id] = p.data || {}; });
  return (clients || []).map((c: any) => ({ ...c, profile: profileByClient[c.id] || {} }));
}
function paymentStatus(profile: any): string {
  if (!profile?.paymentDueDate) return "not scheduled";
  if (profile.paymentPaid) return "paid";
  const due = new Date(`${profile.paymentDueDate}T00:00:00`).getTime();
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00`).getTime();
  const days = Math.round((due - today) / 86400000);
  if (days < 0) return `overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "due today";
  return `due in ${days} day${days === 1 ? "" : "s"}`;
}
function daysSince(dateISO: string | null): number | null {
  if (!dateISO) return null;
  const d = new Date(`${dateISO}T00:00:00`).getTime();
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00`).getTime();
  return Math.round((today - d) / 86400000);
}

// ---------- program write schema (mirrors forge-ai's coach_program_create output) ----------
const SetSchema = z.object({ targetReps: z.string().optional(), targetLoad: z.string().optional(), targetRpe: z.string().optional() });
const ExerciseSchema = z.object({
  name: z.string().min(1).optional().describe("Exercise name. Required unless libraryExerciseId is given. If it exactly matches (ignoring case) an exercise in the coach's Exercise Library, that exercise's video is attached automatically."),
  libraryExerciseId: z.string().min(1).optional().describe("id from search_exercises. When given, the name and video come from the library (preferred way to attach a video)."),
  videoUrl: z.string().optional().describe("Optional explicit video link. Overrides the library video. Normally leave this out."),
  loadType: z.enum(["kg", "%1RM", "RPE", "BW"]).optional(),
  tempo: z.string().optional(), rest: z.string().optional(), note: z.string().optional(),
  sets: z.array(SetSchema).min(1),
}).refine((ex) => !!(ex.name || ex.libraryExerciseId), { message: "each exercise needs a name or a libraryExerciseId" });
const BlockSchema = z.object({
  type: z.enum(["straight", "superset", "circuit"]).optional(),
  rounds: z.number().int().positive().optional(),
  exercises: z.array(ExerciseSchema).min(1),
});
const WorkoutSchema = z.object({
  name: z.string().min(1), note: z.string().optional(),
  dayOfWeek: z.number().int().min(1).max(7).optional(),
  blocks: z.array(BlockSchema).min(1),
});
const WeekSchema = z.object({
  weekNum: z.number().int().positive().optional(),
  label: z.string().optional(), focus: z.string().optional(), targetRpe: z.string().optional(),
  workouts: z.array(WorkoutSchema),
});
const ProgramSchema = z.object({
  name: z.string().min(1), goal: z.string().optional(), startDate: isoDateStr().optional(),
  weeks: z.array(WeekSchema).min(1),
});

// ---------- nutrition write schema ----------
const PlanItemSchema = z.object({
  name: z.string().min(1), qty: z.number().positive().optional(), unit: z.string().optional(),
  kcal: z.number().nonnegative(), protein: z.number().nonnegative(), carbs: z.number().nonnegative(), fat: z.number().nonnegative(),
});
const PlanMealSchema = z.object({
  key: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:MM, 24h").optional(),
  note: z.string().optional().describe("Shown to the client under the meal, e.g. eating-out guidance."),
  items: z.array(PlanItemSchema),
});
const TargetsSchema = z.object({ kcal: z.number().nonnegative(), protein: z.number().nonnegative(), carbs: z.number().nonnegative(), fat: z.number().nonnegative() }).partial();
const PlanDaySchema = z.object({
  day: z.number().int().min(1).max(7).describe("1=Mon .. 7=Sun"),
  label: z.string().optional().describe('e.g. "Training day", "Rest day", "Dinner out"'),
  targets: TargetsSchema.optional().describe("Omit to use the plan's default targets"),
  meals: z.array(PlanMealSchema).optional().describe("Omit to use the plan's default meals"),
});

export function registerAllTools(server: any, supabase: any, token = "") {
  let coachIdCache: string | null = null;
  const me = async () => (coachIdCache ||= await coachId(supabase, token));

  server.registerTool("list_clients", {
    title: "List clients",
    description: "List every client belonging to the signed-in coach: name, client type (online/in-person), and payment status.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true },
  }, async () => {
    const clients = await allClientsWithProfile(supabase);
    return toolText(clients.map((c: any) => ({
      client_id: c.id, name: c.name, email: c.email,
      client_type: c.profile.clientType || "1:1",
      payment_status: paymentStatus(c.profile),
    })));
  });

  server.registerTool("search_clients", {
    title: "Search clients",
    description: "Find a client by partial, case-insensitive name or email match.",
    inputSchema: z.object({ query: z.string().min(1) }),
    annotations: { readOnlyHint: true },
  }, async ({ query }: { query: string }) => {
    const clients = await allClientsWithProfile(supabase);
    const q = query.toLowerCase();
    const matches = clients.filter((c: any) => (c.name || "").toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q));
    return toolText(matches.map((c: any) => ({ client_id: c.id, name: c.name, email: c.email })));
  });

  server.registerTool("get_client_overview", {
    title: "Get client overview",
    description: "A snapshot of one client: latest check-in and flags, current program week, recent completed workouts, best lifts, and payment status.",
    inputSchema: z.object({ client_id: uuid() }),
    annotations: { readOnlyHint: true },
  }, async ({ client_id }: { client_id: string }) => {
    const client = await clientRow(supabase, client_id);
    const [profile, checkins, program, trainingLogs] = await Promise.all([
      sectionData(supabase, client_id, "profile"),
      sectionData(supabase, client_id, "checkins"),
      sectionData(supabase, client_id, "program"),
      sectionData(supabase, client_id, "training_logs"),
    ]);
    const submissions = checkins?.submissions || [];
    const latest = submissions[submissions.length - 1] || null;
    return toolText({
      client_id, name: client.name, email: client.email,
      payment_status: paymentStatus(profile || {}),
      client_type: profile?.clientType || "1:1",
      injuries: profile?.injuries || "",
      latest_checkin: latest ? { date: latest.date, flags: latest.flags || [], answers: latest.answers || [] } : null,
      days_since_checkin: latest ? daysSince(latest.date) : null,
      program: program ? { name: program.name, goal: program.goal, current_week: currentProgramWeek(program), total_weeks: program.weeks?.length || 0 } : null,
      recent_workouts: recentSessions(trainingLogs, 5),
      best_lifts: bestLiftsFrom(trainingLogs),
    });
  });

  server.registerTool("get_checkins", {
    title: "Get check-ins",
    description: "Full check-in submission history for one client, optionally only since a given date.",
    inputSchema: z.object({ client_id: uuid(), since: isoDateStr().optional() }),
    annotations: { readOnlyHint: true },
  }, async ({ client_id, since }: { client_id: string; since?: string }) => {
    const checkins = await sectionData(supabase, client_id, "checkins");
    let submissions = checkins?.submissions || [];
    if (since) submissions = submissions.filter((s: any) => (s.date || "") >= since);
    return toolText(submissions);
  });

  server.registerTool("who_needs_attention", {
    title: "Who needs attention",
    description: "Flags clients with no check-in in 7+ days, an overdue/due-today payment, a pain or injury flag, or no completed workout in 7+ days.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true },
  }, async () => {
    const clients = await allClientsWithProfile(supabase);
    const results: any[] = [];
    for (const c of clients) {
      const [checkins, trainingLogs] = await Promise.all([
        sectionData(supabase, c.id, "checkins"),
        sectionData(supabase, c.id, "training_logs"),
      ]);
      const submissions = checkins?.submissions || [];
      const latest = submissions[submissions.length - 1] || null;
      const reasons: string[] = [];
      const sinceCheckin = latest ? daysSince(latest.date) : null;
      if (sinceCheckin === null || sinceCheckin >= 7) reasons.push(sinceCheckin === null ? "Never checked in" : `No check-in in ${sinceCheckin} days`);
      if (latest?.flags?.length) reasons.push(`Flagged in last check-in: ${latest.flags.join(", ")}`);
      if (c.profile?.injuries) reasons.push(`Known injury/limitation: ${c.profile.injuries}`);
      const status = paymentStatus(c.profile);
      if (status.startsWith("overdue") || status === "due today") reasons.push(`Payment ${status}`);
      const recent = recentSessions(trainingLogs, 1);
      const sinceWorkout = recent[0] ? daysSince(recent[0].date) : null;
      if (sinceWorkout === null || sinceWorkout >= 7) reasons.push(sinceWorkout === null ? "No completed workouts logged" : `No workout logged in ${sinceWorkout} days`);
      if (reasons.length) results.push({ client_id: c.id, name: c.name, reasons });
    }
    return toolText(results);
  });

  server.registerTool("get_program", {
    title: "Get program",
    description: "Read a client's full current training program. Call this before save_program when editing, so nothing already in the program is lost.",
    inputSchema: z.object({ client_id: uuid() }),
    annotations: { readOnlyHint: true },
  }, async ({ client_id }: { client_id: string }) => {
    const program = await sectionData(supabase, client_id, "program");
    return toolText(program || { message: "This client has no program yet." });
  });

  server.registerTool("save_program", {
    title: "Create or replace a client's program",
    description: "Writes a complete training program for a client. This REPLACES their current program entirely and goes LIVE immediately - exactly the same as the coach clicking Save in the Program Builder. Call get_program first if you're editing an existing program rather than starting from scratch, and include every week/workout you want to keep, not just the ones you're changing. Videos: call search_exercises first and pass each exercise's libraryExerciseId; a plain name that exactly matches a library exercise also gets its video. Returns a short summary (not the program); unmatchedExercises lists names that ended up with no video - fix those by searching the library for the right name.",
    inputSchema: z.object({ client_id: uuid(), program: ProgramSchema }),
  }, async ({ client_id, program }: { client_id: string; program: any }) => {
    await clientRow(supabase, client_id);
    const { hydrated, summary } = await prepareProgram(supabase, await me(), program);
    await writeSection(supabase, client_id, "program", hydrated);
    return toolText({ saved: true, live: true, programId: hydrated.id, ...summary });
  });

  server.registerTool("save_program_weeks", {
    title: "Write some weeks of a client's program",
    description: "Writes weeks into a client's EXISTING program starting at start_week, without touching any other week. Use this instead of save_program to add or replace a block mid-program (e.g. weeks 20-28): weeks before start_week, and any after the ones you send, keep their ids, so the client's logged workout history stays linked. Weeks past the current end are appended. Same week shape and video rules as save_program (libraryExerciseId from search_exercises, or exact library names). If a week you'd replace already has logged sessions, the call is refused unless replace_logged_weeks is true. Goes LIVE immediately. Returns a short summary.",
    inputSchema: z.object({
      client_id: uuid(),
      start_week: z.number().int().min(1).describe("1-based week number where the first week you send goes"),
      weeks: z.array(WeekSchema).min(1),
      replace_logged_weeks: z.boolean().optional().describe("Allow replacing weeks the client has already logged sessions in (those sessions stop showing against the new workouts)"),
    }),
  }, async ({ client_id, start_week, weeks, replace_logged_weeks }: { client_id: string; start_week: number; weeks: any[]; replace_logged_weeks?: boolean }) => {
    await clientRow(supabase, client_id);
    const [existing, trainingLogs] = await Promise.all([
      sectionData(supabase, client_id, "program"),
      sectionData(supabase, client_id, "training_logs"),
    ]);
    if (!existing?.weeks?.length) throw new Error("This client has no program yet - use save_program to create one.");
    const replacedIds = existing.weeks.slice(start_week - 1, start_week - 1 + weeks.length).map((w: any) => w.id);
    const logged = sessionsInWeeks(trainingLogs, replacedIds);
    if (logged.length && !replace_logged_weeks) {
      const nums = [...new Set(logged.map((s: any) => s.weekNum))].sort((a: any, b: any) => a - b);
      throw new Error(`Week(s) ${nums.join(", ")} already have ${logged.length} logged session(s). Start after them, or pass replace_logged_weeks: true to replace anyway.`);
    }
    const { hydrated, summary } = await prepareProgram(supabase, await me(), { name: existing.name, weeks });
    const next = spliceWeeks(existing, hydrated.weeks, start_week);
    await writeSection(supabase, client_id, "program", next);
    return toolText({
      saved: true, live: true, programId: next.id,
      wroteWeeks: `${start_week}-${start_week + weeks.length - 1}`, totalWeeks: next.weeks.length,
      replacedWeeksWithLogs: logged.length ? [...new Set(logged.map((s: any) => s.weekNum))] : [],
      workouts: summary.workouts, exercises: summary.exercises, unmatchedExercises: summary.unmatchedExercises,
      ...(summary.unknownLibraryExerciseIds ? { unknownLibraryExerciseIds: summary.unknownLibraryExerciseIds } : {}),
    });
  });

  server.registerTool("search_exercises", {
    title: "Search the Exercise Library",
    description: "Search the coach's own Exercise Library (the exercises with demo videos). Use this before save_program / save_template to get each exercise's id, then pass it as libraryExerciseId so the video is attached. query is a case-insensitive partial match on the name (e.g. \"goblet\", \"row\"); leave it out to list the whole library.",
    inputSchema: z.object({
      query: z.string().optional().describe("Part of the exercise name, any case"),
      limit: z.number().int().min(1).max(500).optional().describe("Max results (default 50)"),
    }),
    annotations: { readOnlyHint: true },
  }, async ({ query, limit }: { query?: string; limit?: number }) => {
    const items = libraryItems(await trainerSection(supabase, await me(), "custom_exercise_library"));
    const results = searchLibrary(items, query, limit ?? 50);
    return toolText({ total_in_library: items.length, count: results.length, exercises: results });
  });

  server.registerTool("list_templates", {
    title: "List program templates",
    description: "List the coach's saved program templates (Programs > Templates in the app).",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true },
  }, async () => {
    const raw = await trainerSection(supabase, await me(), "templates");
    const list = Array.isArray(raw?.templates) ? raw.templates : [];
    return toolText(list.map((t: any) => ({ id: t.id, name: t.name, weeks: t.weeks ?? t.program?.weeks?.length ?? 0, ...(t.goal ? { goal: t.goal } : {}), ...(t.savedAt ? { savedAt: t.savedAt } : {}) })));
  });

  server.registerTool("save_template", {
    title: "Save a program template",
    description: "Saves a program as a reusable template under Programs > Templates in the app (not assigned to any client, nothing goes live). Takes the same program shape and video rules as save_program: pass libraryExerciseId from search_exercises, or exact library names. Creates a NEW template by default; pass template_id (from list_templates) to replace that template instead. Returns a short summary with unmatchedExercises (names with no video).",
    inputSchema: z.object({
      program: ProgramSchema,
      template_id: z.string().min(1).optional().describe("Replace this existing template instead of adding a new one"),
    }),
  }, async ({ program, template_id }: { program: any; template_id?: string }) => {
    const trainerId = await me();
    const raw = await trainerSection(supabase, trainerId, "templates");
    const list = Array.isArray(raw?.templates) ? raw.templates : [];
    const existing = template_id ? list.find((t: any) => t.id === template_id) : null;
    if (template_id && !existing) throw new Error(`No template with id ${template_id}. Call list_templates to see the ids.`);
    const { hydrated, summary } = await prepareProgram(supabase, trainerId, program);
    // Same entry shape as the builder's "Save as Template".
    const entry = { id: existing?.id || crypto.randomUUID(), name: hydrated.name, goal: hydrated.goal, weeks: hydrated.weeks.length, savedAt: new Date().toISOString(), program: hydrated };
    const next = existing ? list.map((t: any) => (t.id === existing.id ? entry : t)) : [entry, ...list];
    await writeTrainerSection(supabase, trainerId, "templates", { ...(raw || {}), templates: next });
    return toolText({ saved: true, templateId: entry.id, name: entry.name, replaced: !!existing, ...summary });
  });

  server.registerTool("get_nutrition_plan", {
    title: "Get nutrition plan",
    description: "Read a client's current live (published) nutrition plan and any unpublished draft. Call this before update_nutrition_plan when editing, so meals you don't mention aren't dropped.",
    inputSchema: z.object({ client_id: uuid() }),
    annotations: { readOnlyHint: true },
  }, async ({ client_id }: { client_id: string }) => {
    const raw = await sectionData(supabase, client_id, "nutrition_v2_plans");
    const plans = Array.isArray(raw) ? raw : [];
    const todayISO = new Date().toISOString().slice(0, 10);
    const live = planVersionForDate(plans, todayISO);
    const today = planForDate(plans, todayISO);
    const draft = plans.find((p: any) => p.status === "draft") || null;
    return toolText({ live, today_resolved: live?.days ? today : undefined, draft, version_count: plans.length });
  });

  server.registerTool("update_nutrition_plan", {
    title: "Create or edit a client's nutrition plan",
    description: "Writes a new nutrition plan version for a client (meals with items, each item's macros given directly - no food-library lookup needed). Defaults to a DRAFT, invisible to the client until published in the app; pass publish:true to make it live immediately. Call get_nutrition_plan first if editing, and include every meal you want kept, not just the ones changing. For a weekly rotation, pass `meals` as the default day and `days` for each weekday that differs (its own meals, targets and/or label); weekdays not listed use the default.",
    inputSchema: z.object({
      client_id: uuid(),
      meals: z.array(PlanMealSchema).min(1),
      targets: TargetsSchema.optional(),
      from: isoDateStr().optional(),
      publish: z.boolean().optional(),
      days: z.array(PlanDaySchema).optional(),
    }),
  }, async ({ client_id, meals, targets, from, publish, days }: { client_id: string; meals: any[]; targets?: any; from?: string; publish?: boolean; days?: any[] }) => {
    await clientRow(supabase, client_id);
    const raw = await sectionData(supabase, client_id, "nutrition_v2_plans");
    const plans = Array.isArray(raw) ? raw : [];
    const version = (plans.length ? Math.max(...plans.map((p: any) => p.version)) : 0) + 1;
    const build = (list: any[]) => list.map((m) => buildMeal(m.key, m.time, (m.items || []).map((it: any) => buildPlanItem(it)), m.note));
    const builtMeals = build(meals);
    const builtDays: Record<string, any> = {};
    (days || []).forEach((d: any) => {
      const entry: any = {};
      if (d.label) entry.label = d.label;
      if (d.targets && Object.keys(d.targets).length) entry.targets = d.targets;
      if (d.meals?.length) entry.meals = build(d.meals);
      if (Object.keys(entry).length) builtDays[String(d.day)] = entry;
    });
    const draft = buildPlanVersion({ version, from: from || new Date().toISOString().slice(0, 10), targets, meals: builtMeals, publish: !!publish, days: builtDays });
    const errors = validatePlanVersion(draft);
    if (errors.length) throw new Error(errors.join(" "));
    const withoutExistingDraft = plans.filter((p: any) => p.status !== "draft");
    const nextPlans = publish ? publishPlan(withoutExistingDraft, draft, new Date().toISOString()) : [...withoutExistingDraft, draft];
    await writeSection(supabase, client_id, "nutrition_v2_plans", nextPlans);
    return toolText({ saved: true, live: !!publish, plan: draft });
  });

  // Body composition scans (Nov 2026) - same `body_composition` section the
  // app's Progress > Body composition card reads. Lets the coach hand a
  // scan report to Claude and have the numbers filled in.
  server.registerTool("get_body_composition", {
    title: "Get body composition scans",
    description: "A client's body composition scans (date, body weight kg, body fat %, lean body mass kg), newest first.",
    inputSchema: z.object({ client_id: uuid() }),
    annotations: { readOnlyHint: true },
  }, async ({ client_id }: { client_id: string }) => {
    await clientRow(supabase, client_id);
    const raw = await sectionData(supabase, client_id, "body_composition");
    return toolText(raw?.scans || []);
  });

  server.registerTool("add_body_composition_scan", {
    title: "Add a body composition scan",
    description: "Saves one scan from an InBody/DEXA/bioimpedance report: date plus any of body weight (kg), body fat (%) and lean body mass (kg). If lean mass is missing but weight and body fat are given, it is worked out as weight x (1 - body fat/100). A scan on the same date replaces the earlier one. Only enter numbers printed on the report - never estimate.",
    inputSchema: z.object({
      client_id: uuid(),
      date: isoDateStr(),
      weight_kg: z.number().positive().optional(),
      body_fat_percent: z.number().min(1).max(70).optional(),
      lean_body_mass_kg: z.number().positive().optional(),
    }),
  }, async ({ client_id, date, weight_kg, body_fat_percent, lean_body_mass_kg }: { client_id: string; date: string; weight_kg?: number; body_fat_percent?: number; lean_body_mass_kg?: number }) => {
    if (weight_kg == null && body_fat_percent == null && lean_body_mass_kg == null) throw new Error("Give at least one of weight_kg, body_fat_percent, lean_body_mass_kg.");
    const client = await clientRow(supabase, client_id);
    const r1 = (n: number | undefined | null) => (n == null ? null : Math.round(n * 10) / 10);
    const lean = lean_body_mass_kg ?? (weight_kg != null && body_fat_percent != null ? weight_kg * (1 - body_fat_percent / 100) : null);
    const scan = { id: crypto.randomUUID(), date, weight: r1(weight_kg), bodyFat: r1(body_fat_percent), leanMass: r1(lean), storagePath: "", fileName: "", enteredAt: new Date().toISOString(), enteredBy: "claude" };
    const raw = await sectionData(supabase, client_id, "body_composition");
    const scans = [scan, ...((raw?.scans || []).filter((s: any) => s.date !== date))].sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
    await writeSection(supabase, client_id, "body_composition", { scans });
    return toolText({ saved: true, client: client.name, scan });
  });

  // Food log (Nov 2026) - same `nutrition_v2_logs` section the client's Fuel
  // tab reads: { "YYYY-MM-DD": [entry, ...] }. Lets the coach hand Claude a
  // food diary (PDF, photos, notes) and have every meal logged in one go.
  const MealKey = z.enum(["breakfast", "lunch", "dinner", "snack"]);
  const LogEntrySchema = z.object({
    date: isoDateStr(),
    meal: MealKey,
    name: z.string().min(1),
    qty: z.number().positive().optional(),
    unit: z.string().optional(),
    time: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM").optional(),
    kcal: z.number().min(0),
    protein: z.number().min(0),
    carbs: z.number().min(0),
    fat: z.number().min(0),
  });

  server.registerTool("get_food_log", {
    title: "Get a client's food log",
    description: "Everything a client logged in the Fuel tab between two dates (inclusive), grouped by day, with each day's calorie and macro totals.",
    inputSchema: z.object({ client_id: uuid(), from: isoDateStr(), to: isoDateStr() }),
    annotations: { readOnlyHint: true },
  }, async ({ client_id, from, to }: { client_id: string; from: string; to: string }) => {
    await clientRow(supabase, client_id);
    const logs = (await sectionData(supabase, client_id, "nutrition_v2_logs")) || {};
    const days = Object.keys(logs).filter((d) => d >= from && d <= to).sort().map((date) => {
      const entries = (logs[date] || []).map((e: any) => ({ meal: e.meal, name: e.name, qty: e.qty, unit: e.unit, time: e.time, ...(e.macros || {}), source: e.source }));
      const total = entries.reduce((t: any, e: any) => ({ kcal: t.kcal + (e.kcal || 0), protein: t.protein + (e.protein || 0), carbs: t.carbs + (e.carbs || 0), fat: t.fat + (e.fat || 0) }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
      return { date, total, entries };
    });
    return toolText(days);
  });

  server.registerTool("log_meals", {
    title: "Log meals for a client",
    description: "Adds food entries to a client's Fuel log, many days at once (e.g. from a food diary PDF). Each entry: date, meal (breakfast/lunch/dinner/snack), food name, optional qty+unit and time, and its kcal/protein/carbs/fat. Running it again with the same entries does not duplicate them. Set replace_days to true to first remove entries Claude logged earlier on those dates (the client's own entries are never removed).",
    inputSchema: z.object({
      client_id: uuid(),
      entries: z.array(LogEntrySchema).min(1).max(400),
      replace_days: z.boolean().optional(),
    }),
  }, async ({ client_id, entries, replace_days }: { client_id: string; entries: any[]; replace_days?: boolean }) => {
    const client = await clientRow(supabase, client_id);
    const logs: Record<string, any[]> = { ...((await sectionData(supabase, client_id, "nutrition_v2_logs")) || {}) };
    const r1 = (n: number) => Math.round(n * 10) / 10;
    const keyOf = (e: any) => [e.date, e.meal, String(e.name).trim().toLowerCase(), Math.round(e.macros?.kcal ?? e.kcal ?? 0)].join("|");
    const dates = [...new Set(entries.map((e) => e.date))];
    if (replace_days) dates.forEach((d) => { logs[d] = (logs[d] || []).filter((e: any) => e.enteredBy !== "claude"); });
    let added = 0, skipped = 0;
    for (const e of entries) {
      const day = logs[e.date] || [];
      const entry = {
        id: crypto.randomUUID(), date: e.date, meal: e.meal, name: e.name.trim(), foodId: null,
        qty: e.qty ?? 1, unit: e.unit || "serving",
        macros: { kcal: r1(e.kcal), protein: r1(e.protein), carbs: r1(e.carbs), fat: r1(e.fat) },
        source: "quick", time: e.time || "", planItemId: null, estimate: false, replaces: null, reason: null, photo: null, extra: true,
        enteredBy: "claude", enteredAt: new Date().toISOString(),
      };
      if (day.some((x: any) => keyOf(x) === keyOf(entry))) { skipped++; continue; }
      logs[e.date] = [...day, entry];
      added++;
    }
    await writeSection(supabase, client_id, "nutrition_v2_logs", logs);
    const totals = dates.sort().map((d) => ({ date: d, kcal: Math.round((logs[d] || []).reduce((t: number, x: any) => t + (x.macros?.kcal || 0), 0)), entries: (logs[d] || []).length }));
    return toolText({ saved: true, client: client.name, added, skipped_duplicates: skipped, days: totals });
  });

}
