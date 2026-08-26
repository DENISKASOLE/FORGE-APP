import { supabase } from "../supabaseClient.js";
import { isoDate } from "./dateUtils.js";
import { enqueueSync, flushSyncQueue } from "./cache.js";
import { normalizeSlotLabel } from "./browser.js";
import { CLIENT_COLORS } from "./constants.js";
import { BRAND } from "../theme/tokens.js";
import { normalizeNutritionState } from "./nutrition.js";

export function ageFromBirthday(birthday) {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const t1 = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((t1 - t0) / (24 * 3600 * 1000));
}
export function nextBirthdayDaysAway(birthday) {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (isNaN(b.getTime())) return null;
  const today = new Date();
  let next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) next.setFullYear(today.getFullYear() + 1);
  return Math.round((next - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / (24 * 3600 * 1000));
}
export function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.round((Date.now() - d.getTime()) / (24 * 3600 * 1000));
}
export function initials(name = "") {
  return name.split(" ").filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "??";
}
export function getClientColor(id, index = 0) {
  const raw = String(id || index);
  const seed = raw.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return CLIENT_COLORS[(seed + index) % CLIENT_COLORS.length];
}
export function normalizeGoals(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
}
export function normalizeInjuries(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
}
export function timeLabel(t) {
  return normalizeSlotLabel(t).replace(/^0/, "");
}
export function moneyAED(n) {
  return `AED ${Number(n || 0).toLocaleString()}`;
}
export function paymentStatus(client) {
  if (!client.paymentDueDate) return { label: "Not scheduled", color: BRAND.muted };
  if (client.paymentPaid) return { label: "Paid", color: BRAND.green };
  const d = daysUntil(client.paymentDueDate);
  if (d < 0) return { label: `Overdue by ${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"}`, color: BRAND.red };
  if (d <= 2) return { label: d === 0 ? "Due today" : `Due in ${d} day${d === 1 ? "" : "s"}`, color: BRAND.red };
  if (d <= 5) return { label: `Due in ${d} days`, color: BRAND.gold };
  return { label: `Due ${client.paymentDueDate}`, color: BRAND.text };
}
export function makeInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
export function emptyProfile() {
  return {
    clientType: "1:1",
    paymentDueDate: "",
    paymentPaid: false,
    goals: [],
    birthday: "",
    injuries: "",
    medicalIssues: "",
    barriers: "",
    sleep: "",
    neat: "",
    workSchedule: "",
    vegetarianStatus: "non-vegetarian",
    allergies: "",
    lactoseIntolerant: false,
    glutenIntolerant: false,
    lifeContext: "",
    proudGoal: "",
    motivationStyle: "",
    celebrationStyle: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    notes: "",
    photo: "",
    measurements: {},
  };
}
export function mapClient(row, dataRows = [], index = 0) {
  const sections = {};
  dataRows.forEach((r) => {
    if (r.client_id === row.id) sections[r.section] = r.data || {};
  });
  const profile = { ...emptyProfile(), ...(sections.profile || {}) };
  profile.goals = normalizeGoals(profile.goals?.length ? profile.goals : row.goal);
  if (!profile.injuries && row.injuries) profile.injuries = normalizeInjuries(row.injuries).join("\n");
  return {
    id: row.id,
    trainer_id: row.trainer_id,
    client_user_id: row.client_user_id || null,
    name: row.name || "Unnamed Client",
    email: row.email || "",
    phone: row.phone || "",
    age: ageFromBirthday(profile.birthday) ?? (row.age || ""),
    weight: row.weight_kg || row.weight || "",
    joinDate: row.created_at ? row.created_at.split("T")[0] : isoDate(),
    inviteCode: row.invite_code || "",
    inviteStatus: row.invite_status || "not_sent",
    goals: profile.goals,
    goal: profile.goals?.[0] || row.goal || "General Fitness",
    profile,
    color: row.color || profile.color || getClientColor(row.id, index),
    photo: profile.photo || row.photo || "",
    avatar: initials(row.name),
    packages: sections.packages || row.packages || [],
    program: sections.program || row.program || null,
    nutrition: normalizeNutritionState(sections.nutrition),
    transformPhotos: sections.transformPhotos || [],
    progress: sections.progress?.progress || row.progress || [],
    measurements: sections.progress?.measurements || row.measurements || {},
    schedule: sections.sessions?.schedule || row.schedule || [],
    legacyCheckIns: sections.sessions?.checkIns || row.checkIns || [],
    sessions: sections.sessions?.sessions || row.sessions_conducted || 0,
    workoutLogs: sections.workoutLogs || [],
    trialData: sections.trial || null,
    clientType: profile.clientType || "1:1",
    paymentDueDate: profile.paymentDueDate || "",
    paymentPaid: !!profile.paymentPaid,
    price: profile.price || "",
    checkIns: sections.checkins?.submissions || [],
    vacation: sections.vacation_mode || null,
    messages: sections.messages?.list || [],
    intake: sections.intake || null,
    trainingLogs: sections.training_logs || null,
    notes: profile.notes || row.notes || "",
  };
}
export async function upsertSection(clientId, section, data) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    enqueueSync({ type: "client_data", clientId, section, data });
    return { queued: true };
  }
  try {
    const { error } = await supabase.from("client_data").upsert(
      { client_id: clientId, section, data },
      { onConflict: "client_id,section" }
    );
    if (error) throw error;
    await flushSyncQueue();
    return { queued: false };
  } catch (error) {
    enqueueSync({ type: "client_data", clientId, section, data });
    return { queued: true, error };
  }
}
export async function upsertTrainerData(trainerId, section, data) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    enqueueSync({ type: "trainer_data", trainerId, section, data });
    return { queued: true };
  }
  try {
    const { error } = await supabase.from("trainer_data").upsert(
      { trainer_id: trainerId, section, data },
      { onConflict: "trainer_id,section" }
    );
    if (error) throw error;
    await flushSyncQueue();
    return { queued: false };
  } catch (error) {
    enqueueSync({ type: "trainer_data", trainerId, section, data });
    return { queued: true, error };
  }
}
export async function loadTrainerTemplates(trainerId) {
  if (!trainerId) return [];
  const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", trainerId).eq("section", "templates").maybeSingle();
  return data?.data?.templates || [];
}
export async function safeSelect(table, queryBuilder) {
  try {
    const res = await queryBuilder(supabase.from(table));
    return res;
  } catch (e) {
    return { data: null, error: e };
  }
}
