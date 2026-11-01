// All forge-mcp tools. `supabase` is a per-request client already
// carrying the caller's own Supabase JWT as its Authorization header
// (see index.ts) - every query here runs under that caller's Row Level
// Security, so a coach only ever sees/writes their own clients, exactly
// like every other data-access path in this app (src/lib/clientData.js).
// Never the service role key.
import { z } from "npm:zod@^4.3.6";
import { hydrateProgram, currentProgramWeek, videoMapFromProgram, videoMapFromLibrary } from "./programModel.ts";
import { buildPlanItem, buildMeal, buildPlanVersion, publishPlan, planForDate, validatePlanVersion } from "./nutritionModel.ts";
import { bestLiftsFrom, recentSessions } from "./trainingLogs.ts";

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
  name: z.string().min(1),
  loadType: z.enum(["kg", "%1RM", "RPE", "BW"]).optional(),
  tempo: z.string().optional(), rest: z.string().optional(), note: z.string().optional(),
  videoUrl: z.string().optional().describe("Demo video link (http/https). Omit to keep the link this exercise already has in the client's program or the coach's exercise library."),
  sets: z.array(SetSchema).min(1),
});
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
  items: z.array(PlanItemSchema),
});
const TargetsSchema = z.object({ kcal: z.number().nonnegative(), protein: z.number().nonnegative(), carbs: z.number().nonnegative(), fat: z.number().nonnegative() }).partial();

export function registerAllTools(server: any, supabase: any) {
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
    description: "Writes a complete training program for a client. This REPLACES their current program entirely and goes LIVE immediately - exactly the same as the coach clicking Save in the Program Builder. Call get_program first if you're editing an existing program rather than starting from scratch, and include every week/workout you want to keep, not just the ones you're changing. Each exercise may carry a videoUrl; when it's omitted, the link is kept from the same exercise (matched by name) in the client's current program, then from the coach's custom exercise library.",
    inputSchema: z.object({ client_id: uuid(), program: ProgramSchema }),
  }, async ({ client_id, program }: { client_id: string; program: any }) => {
    await clientRow(supabase, client_id);
    // Video fallbacks: the client's current program wins over the library,
    // because it holds the links the coach set for this specific client.
    const existing = await sectionData(supabase, client_id, "program");
    const { data: lib } = await supabase.from("trainer_data").select("data").eq("section", "custom_exercise_library").limit(1).maybeSingle();
    const fallbackVideos = { ...videoMapFromLibrary(lib?.data?.items), ...videoMapFromProgram(existing) };
    const hydrated = hydrateProgram(program, undefined, fallbackVideos);
    await writeSection(supabase, client_id, "program", hydrated);
    return toolText({ saved: true, live: true, program: hydrated });
  });

  server.registerTool("get_nutrition_plan", {
    title: "Get nutrition plan",
    description: "Read a client's current live (published) nutrition plan and any unpublished draft. Call this before update_nutrition_plan when editing, so meals you don't mention aren't dropped.",
    inputSchema: z.object({ client_id: uuid() }),
    annotations: { readOnlyHint: true },
  }, async ({ client_id }: { client_id: string }) => {
    const raw = await sectionData(supabase, client_id, "nutrition_v2_plans");
    const plans = Array.isArray(raw) ? raw : [];
    const live = planForDate(plans, new Date().toISOString().slice(0, 10));
    const draft = plans.find((p: any) => p.status === "draft") || null;
    return toolText({ live, draft, version_count: plans.length });
  });

  server.registerTool("update_nutrition_plan", {
    title: "Create or edit a client's nutrition plan",
    description: "Writes a new nutrition plan version for a client (meals with items, each item's macros given directly - no food-library lookup needed). Defaults to a DRAFT, invisible to the client until published in the app; pass publish:true to make it live immediately. Call get_nutrition_plan first if editing, and include every meal you want kept, not just the ones changing.",
    inputSchema: z.object({
      client_id: uuid(),
      meals: z.array(PlanMealSchema).min(1),
      targets: TargetsSchema.optional(),
      from: isoDateStr().optional(),
      publish: z.boolean().optional(),
    }),
  }, async ({ client_id, meals, targets, from, publish }: { client_id: string; meals: any[]; targets?: any; from?: string; publish?: boolean }) => {
    await clientRow(supabase, client_id);
    const raw = await sectionData(supabase, client_id, "nutrition_v2_plans");
    const plans = Array.isArray(raw) ? raw : [];
    const version = (plans.length ? Math.max(...plans.map((p: any) => p.version)) : 0) + 1;
    const builtMeals = meals.map((m) => buildMeal(m.key, m.time, (m.items || []).map((it: any) => buildPlanItem(it))));
    const draft = buildPlanVersion({ version, from: from || new Date().toISOString().slice(0, 10), targets, meals: builtMeals, publish: !!publish });
    const errors = validatePlanVersion(draft);
    if (errors.length) throw new Error(errors.join(" "));
    const withoutExistingDraft = plans.filter((p: any) => p.status !== "draft");
    const nextPlans = publish ? publishPlan(withoutExistingDraft, draft, new Date().toISOString()) : [...withoutExistingDraft, draft];
    await writeSection(supabase, client_id, "nutrition_v2_plans", nextPlans);
    return toolText({ saved: true, live: !!publish, plan: draft });
  });
}
