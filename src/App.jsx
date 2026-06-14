
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient.js";

const textareaStyle = (extra = {}) => ({
  width: "100%",
  minHeight: 90,
  background: "#111",
  border: "1px solid #333",
  borderRadius: 12,
  color: "#fff",
  padding: "12px",
  resize: "vertical",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  ...extra,
});

/*
  FORGE V4.1 - Clients Tab Fix + Coach/Client Portal
  ------------------------------------------------
  What this version includes:
  - One clean login screen: "Welcome back"
  - Seamless trainer account creation
  - Forgot password via Supabase Auth
  - Coach dashboard: each trainer sees only their own clients
  - Denis keeps existing unassigned clients if logged in with kendenisdubai@gmail.com
  - Invite-based client access: coach creates profile first, client claims it with invite code
  - Client portal: food log, workout log, progress photos, profile view
  - Program builder restored to previous week/day style, with AI builder and recap
  - Program day has small X button to delete whole day
  - Trials split into Consultation and Fitness Assessment
  - Calendar has editable visible time slots and auto-scheduled recurring clients
  - AED currency and simple number time labels
  - Dead Hang added to exercise library and progress tracking
*/
 
const BRAND = {
  bg: "#070707",
  panel: "#0f1013",
  card: "#15161b",
  card2: "#1b1d24",
  line: "#2a2d36",
  text: "#f5f5f5",
  muted: "#a1a1aa",
  dim: "#6b7280",
  gold: "#E8C547",
  red: "#FF4D4D",
  green: "#54D990",
  cyan: "#4ECDC4",
  blue: "#60A5FA",
  purple: "#A78BFA",
  orange: "#FB923C",
};
 
const GOAL_OPTIONS = [
  "Fat Loss",
  "Muscle Gain",
  "Strength",
  "Endurance",
  "Mobility",
  "General Fitness",
  "Rehab",
  "Lifestyle",
];
 
const CLIENT_COLORS = [
  "#E8C547",
  "#4ECDC4",
  "#A78BFA",
  "#6EE7B7",
  "#FB923C",
  "#60A5FA",
  "#F472B6",
  "#F97316",
  "#22D3EE",
  "#84CC16",
  "#C084FC",
];
 
const LIFT_FIELDS = [
  { key: "benchPress", label: "Bench" },
  { key: "squat", label: "Squat" },
  { key: "deadlift", label: "Deadlift" },
  { key: "ohp", label: "OHP" },
  { key: "deadHang", label: "Dead Hang" },
];
 
const EXERCISE_LIBRARY = [
  "Dead Hang",
  "Rack Pulls",
  "Barbell Deadlift",
  "Romanian Deadlift",
  "Good Morning",
  "Hip Thrust",
  "Trap Bar Deadlift",
  "Sumo Deadlift",
  "Flat Barbell Bench Press",
  "Incline DB Chest Press",
  "Dumbbell Fly",
  "Cable Crossover",
  "Push-Up",
  "Decline Bench Press",
  "Machine Chest Press",
  "Squat",
  "Front Squat",
  "Goblet Squat",
  "Leg Press",
  "Leg Extension",
  "Lying Leg Curl",
  "Lunge",
  "Bulgarian Split Squat",
  "Pull-Up",
  "Neutral Grip Lat Pulldown",
  "Seated Row",
  "Machine Rows",
  "Dumbbell Row",
  "Face Pull",
  "Chest-Supported Row",
  "T-Bar Row",
  "Overhead Press",
  "DB Shoulder Press",
  "Arnold Press",
  "Cable Lateral Raises",
  "DB Lateral Raises",
  "Shrug",
  "Bicep Curl",
  "Incline DB Curl",
  "Hammer Curl",
  "EZ Tricep Extension",
  "Tricep Pushdown",
  "Skull Crusher",
  "Dips",
  "Sled Push",
  "Farmer's Carry",
  "Battle Ropes",
  "Box Jump",
  "Burpee",
  "SkiErg",
  "Elliptical",
  "Rower",
  "Stair Climber",
  "Assault Bike",
  "Plank",
  "Side Plank",
  "Bird Dog",
  "Dead Bug",
  "Russian Twist",
  "Hanging Leg Raise",
  "Cable Wood Chop",
  "Pallof Press",
  "Cat-Cow",
  "90/90 Hip Rotation",
  "Band Pass Throughs",
  "Thoracic Rotation",
  "Stretching",
  "Reverse Lunges"
];
 
const FOOD_DB = [
  { name: "Chicken breast 100g", kcal: 165, protein: 31, carbs: 0, fats: 4, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Salmon 100g", kcal: 208, protein: 20, carbs: 0, fats: 13, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
  { name: "Egg white 1 piece", kcal: 17, protein: 4, carbs: 0, fats: 0, tags: ["vegetarian", "gluten-free", "lactose-free"] },
  { name: "Whole egg 1 piece", kcal: 72, protein: 6, carbs: 0, fats: 5, tags: ["vegetarian", "gluten-free", "lactose-free"] },
  { name: "Cooked rice 100g", kcal: 130, protein: 3, carbs: 28, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Potato 100g", kcal: 87, protein: 2, carbs: 20, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Chapati 1 medium", kcal: 180, protein: 5, carbs: 30, fats: 5, tags: ["vegetarian", "lactose-free"] },
  { name: "Oats 50g", kcal: 190, protein: 7, carbs: 32, fats: 4, tags: ["vegetarian", "vegan", "lactose-free"] },
  { name: "Banana 1 medium", kcal: 105, protein: 1, carbs: 27, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Whey protein 1 scoop", kcal: 120, protein: 24, carbs: 3, fats: 2, tags: ["vegetarian", "gluten-free"] },
  { name: "Lentils cooked 100g", kcal: 116, protein: 9, carbs: 20, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Greek yogurt 170g", kcal: 100, protein: 17, carbs: 6, fats: 0, tags: ["vegetarian", "gluten-free"] },
  { name: "Avocado 100g", kcal: 160, protein: 2, carbs: 9, fats: 15, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Broccoli 100g", kcal: 35, protein: 2, carbs: 7, fats: 0, tags: ["vegetarian", "vegan", "gluten-free", "lactose-free"] },
  { name: "Ground beef 100g", kcal: 250, protein: 26, carbs: 0, fats: 15, tags: ["non-vegetarian", "gluten-free", "lactose-free"] },
];
 
const DEFAULT_TIME_SLOTS = ["5:30", "6:00", "6:30", "7:00", "7:30", "8:00", "8:30", "9:00", "9:30", "10:00", "10:30", "11:00", "5:00", "5:30", "6:00", "6:30", "7:00", "7:30", "8:00", "8:30", "9:00", "9:30", "10:00"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DENIS_EMAIL = "kendenisdubai@gmail.com";
 
function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
 
function initials(name = "") {
  return name.split(" ").filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "??";
}
 
function getClientColor(id, index = 0) {
  const raw = String(id || index);
  const seed = raw.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return CLIENT_COLORS[(seed + index) % CLIENT_COLORS.length];
}
 
function normalizeGoals(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
}
 
function normalizeInjuries(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
}
 
function timeLabel(t) {
  return String(t || "").replace(/^0/, "");
}
 
function moneyAED(n) {
  return `AED ${Number(n || 0).toLocaleString()}`;
}
 
function makeInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
 
function makeWeek(n, days) {
  return {
    weekNum: n,
    days: days.map((d) => ({
      ...d,
      date: "",
      sessionData: (d.exercises || []).map((ex) => ({
        name: ex.name,
        sets: Array.from({ length: Number(ex.numSets || 3) }, () => ({ weight: "", reps: "", rpe: "" })),
      })),
      metrics: { maxHR: "", avgHR: "", kcal: "" },
      notes: "",
    })),
  };
}
 
function emptyProfile() {
  return {
    goals: [],
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
    notes: "",
  };
}
 
function emptyNutrition() {
  return {
    targets: { calories: "", protein: "", carbs: "", fats: "" },
    mealPlan: { Breakfast: "", Lunch: "", Dinner: "" },
    planNotes: "",
    logs: [],
  };
}
 
function mapClient(row, dataRows = [], index = 0) {
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
    age: row.age || "",
    weight: row.weight_kg || row.weight || "",
    joinDate: row.created_at ? row.created_at.split("T")[0] : new Date().toISOString().slice(0, 10),
    inviteCode: row.invite_code || "",
    inviteStatus: row.invite_status || "not_sent",
    goals: profile.goals,
    goal: profile.goals?.[0] || row.goal || "General Fitness",
    profile,
    color: row.color || getClientColor(row.id, index),
    avatar: initials(row.name),
    packages: sections.packages || row.packages || [],
    program: sections.program || row.program || null,
    nutrition: { ...emptyNutrition(), ...(sections.nutrition || {}) },
    transformPhotos: sections.transformPhotos || [],
    progress: sections.progress?.progress || row.progress || [],
    measurements: sections.progress?.measurements || row.measurements || {},
    schedule: sections.sessions?.schedule || row.schedule || [],
    checkIns: sections.sessions?.checkIns || row.checkIns || [],
    sessions: sections.sessions?.sessions || row.sessions_conducted || 0,
    workoutLogs: sections.workoutLogs || [],
    notes: profile.notes || row.notes || "",
  };
}
 
async function upsertSection(clientId, section, data) {
  const { error } = await supabase.from("client_data").upsert(
    { client_id: clientId, section, data },
    { onConflict: "client_id,section" }
  );
  if (error) throw error;
}
 
async function safeSelect(table, queryBuilder) {
  try {
    const res = await queryBuilder(supabase.from(table));
    return res;
  } catch (e) {
    return { data: null, error: e };
  }
}
 
function aiFoodSuggestions(client) {
  const profile = client.profile || emptyProfile();
  const target = client.nutrition?.targets || {};
  const vegetarian = profile.vegetarianStatus === "vegetarian" || profile.vegetarianStatus === "vegan";
  const lactose = !!profile.lactoseIntolerant;
  const gluten = !!profile.glutenIntolerant;
  const allergies = String(profile.allergies || "").toLowerCase();
 
  const foods = FOOD_DB.filter((f) => {
    if (vegetarian && !f.tags.includes("vegetarian") && !f.tags.includes("vegan")) return false;
    if (profile.vegetarianStatus === "vegan" && !f.tags.includes("vegan")) return false;
    if (lactose && !f.tags.includes("lactose-free")) return false;
    if (gluten && !f.tags.includes("gluten-free")) return false;
    if (allergies && allergies.split(/[,;]+/).some((a) => a.trim() && f.name.toLowerCase().includes(a.trim()))) return false;
    return true;
  });
 
  const highProtein = foods.filter((f) => f.protein >= 15).slice(0, 4).map((f) => f.name).join(", ");
  const carbs = foods.filter((f) => f.carbs >= 20).slice(0, 4).map((f) => f.name).join(", ");
  const calories = Number(target.calories || 0);
  const protein = Number(target.protein || 0);
  const base = [];
  if (protein) base.push(`Protein target is ${protein}g. Build each meal around: ${highProtein || "lean protein source"}.`);
  if (calories) base.push(`Calories target is ${calories}. Divide it across breakfast, lunch, and dinner so the client does not overload one meal.`);
  base.push(`Good carb options: ${carbs || "rice, potatoes, oats, fruits"}.`);
  if (profile.lactoseIntolerant) base.push("Avoid milk/yogurt/whey unless lactose-free.");
  if (profile.glutenIntolerant) base.push("Avoid chapati, bread, and pasta unless gluten-free.");
  return base.join(" ");
}
 
function aiProgression(program, client) {
  if (!program?.weekLogs?.length) return "Log at least one workout first. Then Forge can recommend progression.";
  const logs = program.weekLogs.flatMap((w) => w.days || []);
  const done = logs.filter((d) => d.date || d.sessionData?.some((e) => e.sets?.some((s) => s.weight || s.reps)));
  if (!done.length) return "No completed sessions yet. Start logging sets, reps, and RPE.";
  const last = done[done.length - 1];
  const easySets = last.sessionData?.flatMap((e) => e.sets?.map((s) => ({ ex: e.name, ...s })) || []).filter((s) => Number(s.rpe || 0) && Number(s.rpe) <= 7) || [];
  if (easySets.length >= 3) return "Last session looked controlled. Add 2.5kg on upper-body lifts or 5kg on lower-body lifts next time, while keeping form clean.";
  return "Keep the same weight next time and aim for better reps, cleaner tempo, or lower RPE before increasing load.";
}
 
function Button({ children, onClick, variant = "gold", type = "button", disabled = false, style = {} }) {
  const bg = variant === "ghost" ? "transparent" : variant === "red" ? BRAND.red : variant === "dark" ? BRAND.card2 : BRAND.gold;
  const color = variant === "ghost" ? BRAND.text : variant === "red" ? "#fff" : variant === "dark" ? BRAND.text : "#050505";
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{ background: bg, color, border: variant === "ghost" ? `1px solid ${BRAND.line}` : "none", borderRadius: 12, padding: "10px 14px", fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, ...style }}>
      {children}
    </button>
  );
}
 
function Field({ label, value, onChange, type = "text", placeholder = "", textarea = false }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 11, color: BRAND.muted, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.7 }}>{label}</div>
      {textarea ? (
        <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle({ minHeight: 85, resize: "vertical" })} />
      ) : (
        <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle()} />
      )}
    </label>
  );
}
 
function inputStyle(extra = {}) {
  return { width: "100%", boxSizing: "border-box", background: "#0b0c10", border: `1px solid ${BRAND.line}`, color: BRAND.text, borderRadius: 12, padding: "11px 12px", outline: "none", fontSize: 14, ...extra };
}
 
function Card({ children, style = {}, onClick }) {
  return <div onClick={onClick} style={{ background: `linear-gradient(180deg, ${BRAND.card}, #101116)`, border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 16, boxShadow: "0 16px 40px rgba(0,0,0,.25)", ...style }}>{children}</div>;
}
 
function LoginScreen({ onReady }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
 
  async function login() {
    setLoading(true); setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
    else onReady?.();
    setLoading(false);
  }
 
  async function createTrainer() {
    setLoading(true); setMsg("");
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, role: "coach" } } });
    if (error) setMsg(error.message);
    else {
      const user = data.user;
      if (user) await supabase.from("trainers").upsert({ id: user.id, name: name || email.split("@")[0], email, role: "Coach" });
      setMsg("Account created. Check email if confirmation is required, then log in.");
      setMode("login");
    }
    setLoading(false);
  }
 
  async function acceptInvite() {
    setLoading(true); setMsg("");
    const code = inviteCode.trim().toUpperCase();
    const { data: found, error: findErr } = await supabase.from("clients").select("*").eq("invite_code", code).maybeSingle();
    if (findErr || !found) { setMsg("Invite code not found."); setLoading(false); return; }
    const { data, error } = await supabase.auth.signUp({ email: found.email || email, password, options: { data: { name: found.name, role: "client" } } });
    if (error) { setMsg(error.message); setLoading(false); return; }
    if (data.user) {
      await supabase.from("clients").update({ client_user_id: data.user.id, invite_status: "accepted", email: found.email || email }).eq("id", found.id);
      setMsg("Client account connected. Log in with the password you created.");
      setMode("login");
    }
    setLoading(false);
  }
 
  async function forgotPassword() {
    setLoading(true); setMsg("");
    const redirectTo = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setMsg(error ? error.message : "Password reset link sent to your email.");
    setLoading(false);
  }
 
  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(circle at 20% 10%, ${BRAND.gold}22, transparent 30%), ${BRAND.bg}`, color: BRAND.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <Card style={{ width: "100%", maxWidth: 430, padding: 26 }}>
        <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: 1 }}>FORGE</div>
        <div style={{ fontSize: 25, fontWeight: 900, marginTop: 10 }}>Welcome back</div>
        <div style={{ color: BRAND.muted, marginBottom: 22 }}>Log in to continue your coaching system.</div>
        {mode !== "login" && <Field label="Name" value={name} onChange={setName} placeholder="Your name" />}
        <div style={{ height: 10 }} />
        <Field label="Email" value={email} onChange={setEmail} placeholder="you@email.com" />
        <div style={{ height: 10 }} />
        <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="Password" />
        {mode === "invite" && <><div style={{ height: 10 }} /><Field label="Invite Code" value={inviteCode} onChange={setInviteCode} placeholder="ABC123" /></>}
        {msg && <div style={{ marginTop: 12, color: msg.includes("sent") || msg.includes("created") || msg.includes("connected") ? BRAND.green : BRAND.red, fontSize: 13 }}>{msg}</div>}
        <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
          {mode === "login" && <Button disabled={loading} onClick={login}>Log in</Button>}
          {mode === "trainer" && <Button disabled={loading} onClick={createTrainer}>Create coach account</Button>}
          {mode === "invite" && <Button disabled={loading} onClick={acceptInvite}>Accept invite</Button>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          <Button variant="ghost" onClick={() => setMode("login")} style={{ flex: 1 }}>Login</Button>
          <Button variant="ghost" onClick={() => setMode("trainer")} style={{ flex: 1 }}>Create coach</Button>
          <Button variant="ghost" onClick={() => setMode("invite")} style={{ flex: 1 }}>Accept invite</Button>
        </div>
        <button onClick={forgotPassword} style={{ marginTop: 14, background: "transparent", border: "none", color: BRAND.gold, cursor: "pointer", padding: 0 }}>Forgot password?</button>
      </Card>
    </div>
  );
}
 
function AddClientModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", age: "", weight: "", profile: emptyProfile() });
  const setProfile = (k, v) => setForm((f) => ({ ...f, profile: { ...f.profile, [k]: v } }));
  const toggleGoal = (g) => setProfile("goals", form.profile.goals.includes(g) ? form.profile.goals.filter((x) => x !== g) : [...form.profile.goals, g]);
  return (
    <div style={modalBackdrop()}>
      <Card style={{ width: "100%", maxWidth: 780, maxHeight: "92vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div><div style={{ fontSize: 24, fontWeight: 900 }}>Add New Client</div><div style={{ color: BRAND.muted }}>Create the profile first. Invite the client later.</div></div>
          <Button variant="ghost" onClick={onClose}>X</Button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
          <Field label="Client name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="Age" value={form.age} onChange={(v) => setForm({ ...form, age: v })} type="number" />
          <Field label="Weight kg" value={form.weight} onChange={(v) => setForm({ ...form, weight: v })} type="number" />
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: BRAND.muted, fontWeight: 900, marginBottom: 8 }}>GOALS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{GOAL_OPTIONS.map((g) => <button key={g} onClick={() => toggleGoal(g)} style={{ border: `1px solid ${form.profile.goals.includes(g) ? BRAND.gold : BRAND.line}`, background: form.profile.goals.includes(g) ? BRAND.gold : BRAND.card2, color: form.profile.goals.includes(g) ? "#000" : BRAND.text, borderRadius: 20, padding: "7px 11px", fontWeight: 800 }}>{g}</button>)}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12, marginTop: 14 }}>
          <Field label="Injuries" value={form.profile.injuries} onChange={(v) => setProfile("injuries", v)} textarea />
          <Field label="Medical issues" value={form.profile.medicalIssues} onChange={(v) => setProfile("medicalIssues", v)} textarea />
          <Field label="Barriers" value={form.profile.barriers} onChange={(v) => setProfile("barriers", v)} textarea />
          <Field label="Sleep" value={form.profile.sleep} onChange={(v) => setProfile("sleep", v)} textarea />
          <Field label="NEAT / Daily Activity" value={form.profile.neat} onChange={(v) => setProfile("neat", v)} textarea />
          <Field label="Work Schedule" value={form.profile.workSchedule} onChange={(v) => setProfile("workSchedule", v)} textarea />
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <Button onClick={() => onCreate(form)} style={{ flex: 1 }}>Create client</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </Card>
    </div>
  );
}
 
function modalBackdrop() {
  return { position: "fixed", inset: 0, background: "rgba(0,0,0,.86)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
}
 
function CoachDashboard({ user, trainer, clients, setClients, selectClient, refresh }) {
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState("clients");
  const [query, setQuery] = useState("");
  const filtered = clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));
  const upcoming = clients.reduce((n, c) => n + (c.schedule?.length || 0), 0);
 
  async function createClient(form) {
    const color = getClientColor(uid(), clients.length);
    const invite_code = makeInviteCode();
    const payload = {
      trainer_id: user.id,
      name: form.name,
      email: form.email,
      phone: form.phone,
      age: Number(form.age || 0),
      weight_kg: Number(form.weight || 0),
      goal: form.profile.goals?.[0] || "General Fitness",
      color,
      invite_code,
      invite_status: "not_sent",
    };
    const { data, error } = await supabase.from("clients").insert(payload).select("*").single();
    if (error) { alert(error.message); return; }
    await upsertSection(data.id, "profile", form.profile);
    setShowAdd(false);
    await refresh();
  }
 
  return (
    <div style={{ minHeight: "100vh", background: BRAND.bg, color: BRAND.text }}>
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(7,7,7,.92)", backdropFilter: "blur(14px)", borderBottom: `1px solid ${BRAND.line}`, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><div style={{ fontSize: 29, fontWeight: 1000, color: BRAND.gold }}>FORGE</div><div style={{ color: BRAND.muted, fontSize: 12 }}>COACH {trainer?.name || user.email?.split("@")[0]}</div></div>
        <Button variant="ghost" onClick={() => supabase.auth.signOut()}>Logout</Button>
      </header>
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 16 }}>
          <Kpi title="Active Clients" value={clients.length} icon="👥" color={BRAND.gold} />
          <Kpi title="Scheduled" value={upcoming} icon="📅" color={BRAND.cyan} />
          <Kpi title="Trials" value="0" icon="🔥" color={BRAND.red} />
          <Kpi title="Calendar" value="Open" icon="⏱" color={BRAND.green} />
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
          {[["clients", "Clients"], ["calendar", "Calendar"], ["trials", "Trials"]].map(([k, l]) => <Button key={k} variant={tab === k ? "gold" : "dark"} onClick={() => setTab(k)}>{l}</Button>)}
        </div>
        {tab === "clients" && <>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients..." style={inputStyle()} />
            <Button onClick={() => setShowAdd(true)}>+ Add New Client</Button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
            {filtered.map((c, i) => <ClientCard key={c.id} client={c} onClick={() => selectClient(c)} index={i} />)}
          </div>
        </>}
        {tab === "calendar" && <Calendar clients={clients} refresh={refresh} user={user} />}
        {tab === "trials" && <Trials user={user} />}
      </main>
      {showAdd && <AddClientModal onClose={() => setShowAdd(false)} onCreate={createClient} />}
    </div>
  );
}
 
function Kpi({ title, value, icon, color }) {
  return <Card><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ color: BRAND.muted, fontSize: 12, fontWeight: 800 }}>{title}</div><div style={{ fontSize: 28, fontWeight: 1000, color }}>{value}</div></div><div style={{ fontSize: 28 }}>{icon}</div></div></Card>;
}
 
function ClientCard({ client, onClick }) {
  return (
    <Card style={{ cursor: "pointer", borderColor: client.color }} onClick={onClick}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ width: 54, height: 54, borderRadius: 18, display: "grid", placeItems: "center", background: client.color, color: "#000", fontWeight: 1000 }}>{client.avatar}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 1000 }}>{client.name}</div>
          <div style={{ color: client.color, fontSize: 12, fontWeight: 900 }}>{client.goals?.join(" + ") || client.goal}</div>
          <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 4 }}>{client.weight || 0}kg · {client.age || 0} yrs</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        <Mini label="Program" value={client.program ? "Ready" : "Empty"} />
        <Mini label="Invite" value={client.inviteStatus === "accepted" ? "Accepted" : "Pending"} />
      </div>
    </Card>
  );
}
 
function Mini({ label, value }) { return <div style={{ background: "#0b0c10", border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 10 }}><div style={{ color: BRAND.dim, fontSize: 10, fontWeight: 800 }}>{label}</div><div style={{ color: BRAND.text, fontWeight: 900 }}>{value}</div></div>; }
 
function ClientView({ client, updateClient, back, refresh, isCoach = true }) {
  const [tab, setTab] = useState(isCoach ? "profile" : "home");
  const tabs = isCoach ? [
    ["profile", "📋 Profile"], ["program", "💪 Program"], ["nutrition", "🥗 Nutrition"], ["progress", "📈 Progress"], ["photos", "📸 Transform"], ["schedule", "📅 Schedule"], ["invite", "🔗 Invite"]
  ] : [["home", "🏠 Home"], ["program", "💪 My Program"], ["nutrition", "🥗 Food Log"], ["workouts", "🏋️ Workout Log"], ["photos", "📸 Photos"]];
  async function delClient() {
    if (!confirm(`Delete ${client.name}? This cannot be undone.`)) return;
    await supabase.from("client_data").delete().eq("client_id", client.id);
    await supabase.from("clients").delete().eq("id", client.id);
    back(); refresh();
  }
  return (
    <div style={{ minHeight: "100vh", background: BRAND.bg, color: BRAND.text }}>
      <header style={{ borderBottom: `1px solid ${BRAND.line}`, padding: 14, display: "flex", gap: 10, alignItems: "center", position: "sticky", top: 0, background: "rgba(7,7,7,.94)", zIndex: 80 }}>
        {isCoach && <Button variant="ghost" onClick={back}>Back</Button>}
        <div style={{ width: 54, height: 54, borderRadius: 18, display: "grid", placeItems: "center", background: client.color, color: "#000", fontWeight: 1000 }}>{client.avatar}</div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 24, fontWeight: 1000 }}>{client.name}</div><div style={{ color: client.color, fontWeight: 900, fontSize: 12 }}>{client.goals?.join(" + ") || client.goal}</div></div>
        {isCoach && <Button variant="red" onClick={delClient}>Delete</Button>}
      </header>
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 16 }}>{tabs.map(([k, l]) => <Button key={k} variant={tab === k ? "gold" : "dark"} onClick={() => setTab(k)}>{l}</Button>)}</div>
        {tab === "home" && <ClientHome client={client} />}
        {tab === "profile" && <ProfileTab client={client} updateClient={updateClient} />}
        {tab === "program" && <ProgramTab client={client} updateClient={updateClient} isCoach={isCoach} />}
        {tab === "nutrition" && <NutritionTab client={client} updateClient={updateClient} isCoach={isCoach} />}
        {tab === "progress" && <ProgressTab client={client} />}
        {tab === "photos" && <TransformPhotos client={client} updateClient={updateClient} isCoach={isCoach} />}
        {tab === "schedule" && <ScheduleTab client={client} updateClient={updateClient} />}
        {tab === "invite" && <InviteTab client={client} updateClient={updateClient} />}
        {tab === "workouts" && <ClientWorkoutLog client={client} updateClient={updateClient} />}
      </main>
    </div>
  );
}
 
function ClientHome({ client }) {
  return <div style={{ display: "grid", gap: 14 }}><Card><div style={{ fontSize: 25, fontWeight: 1000 }}>Welcome back, {client.name}</div><div style={{ color: BRAND.muted }}>Your coach has prepared your profile, program, and nutrition targets here.</div></Card><Card><div style={{ fontWeight: 1000, marginBottom: 8 }}>Today</div><div style={{ color: BRAND.muted }}>Log your meals, workout, and transformation photos when needed.</div></Card></div>;
}
 
function ProfileTab({ client, updateClient }) {
  const [profile, setProfile] = useState(client.profile || emptyProfile());
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setProfile((p) => ({ ...p, [k]: v }));
  const toggleGoal = (g) => set("goals", profile.goals.includes(g) ? profile.goals.filter((x) => x !== g) : [...profile.goals, g]);
  async function save() {
    setSaving(true);
    await upsertSection(client.id, "profile", profile);
    updateClient({ ...client, profile, goals: profile.goals, goal: profile.goals?.[0] || client.goal, notes: profile.notes });
    setSaving(false);
  }
  return <Card><div style={{ fontSize: 22, fontWeight: 1000, marginBottom: 14 }}>Client Profile</div><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>{GOAL_OPTIONS.map((g) => <button key={g} onClick={() => toggleGoal(g)} style={{ border: `1px solid ${profile.goals.includes(g) ? client.color : BRAND.line}`, background: profile.goals.includes(g) ? client.color : BRAND.card2, color: profile.goals.includes(g) ? "#000" : BRAND.text, borderRadius: 20, padding: "7px 11px", fontWeight: 800 }}>{g}</button>)}</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 12 }}><Field label="Injuries" value={profile.injuries} onChange={(v) => set("injuries", v)} textarea /><Field label="Medical Issues" value={profile.medicalIssues} onChange={(v) => set("medicalIssues", v)} textarea /><Field label="Barriers" value={profile.barriers} onChange={(v) => set("barriers", v)} textarea /><Field label="Sleep" value={profile.sleep} onChange={(v) => set("sleep", v)} textarea /><Field label="NEAT / Daily Activity" value={profile.neat} onChange={(v) => set("neat", v)} textarea /><Field label="Work Schedule" value={profile.workSchedule} onChange={(v) => set("workSchedule", v)} textarea /><Field label="Vegetarian Status" value={profile.vegetarianStatus} onChange={(v) => set("vegetarianStatus", v)} /><Field label="Allergies" value={profile.allergies} onChange={(v) => set("allergies", v)} /><Field label="Notes" value={profile.notes} onChange={(v) => set("notes", v)} textarea /></div><div style={{ display: "flex", gap: 10, marginTop: 14 }}><label style={{ color: BRAND.muted }}><input type="checkbox" checked={profile.lactoseIntolerant} onChange={(e) => set("lactoseIntolerant", e.target.checked)} /> Lactose intolerant</label><label style={{ color: BRAND.muted }}><input type="checkbox" checked={profile.glutenIntolerant} onChange={(e) => set("glutenIntolerant", e.target.checked)} /> Gluten intolerant</label></div><Button disabled={saving} onClick={save} style={{ marginTop: 16 }}>{saving ? "Saving..." : "Save Profile"}</Button></Card>;
}
 
function ProgramTab({ client, updateClient, isCoach }) {
  const [builder, setBuilder] = useState(false);
  const [ai, setAi] = useState(false);
  const [program, setProgram] = useState(client.program);
  async function saveProgram(p) {
    const logs = p.weekLogs || Array.from({ length: Number(p.totalWeeks || 4) }, (_, i) => makeWeek(i + 1, p.days || []));
    const final = { ...p, weekLogs: logs };
    setProgram(final);
    await upsertSection(client.id, "program", final);
    updateClient({ ...client, program: final });
    setBuilder(false); setAi(false);
  }
  return <div style={{ display: "grid", gap: 14 }}><Card><div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}><div><div style={{ fontSize: 22, fontWeight: 1000 }}>Program</div><div style={{ color: BRAND.muted }}>{program?.name || "No program yet"}</div></div>{isCoach && <div style={{ display: "flex", gap: 8 }}><Button onClick={() => setAi(true)}>AI Build</Button><Button variant="dark" onClick={() => setBuilder(true)}>Edit Builder</Button></div>}</div>{program && <div style={{ marginTop: 12, color: BRAND.green, fontWeight: 800 }}>{aiProgression(program, client)}</div>}</Card>{program ? <SessionTracker client={client} program={program} saveProgram={saveProgram} isCoach={isCoach} /> : <Card><div style={{ color: BRAND.muted }}>No program assigned yet.</div></Card>}{builder && <ProgramBuilder client={client} program={program} onClose={() => setBuilder(false)} onSave={saveProgram} />}{ai && <AIProgramBuilder client={client} onClose={() => setAi(false)} onSave={saveProgram} />}</div>;
}
 
function ProgramBuilder({ client, program, onClose, onSave }) {
  const [name, setName] = useState(program?.name || `${client.name} Program`);
  const [weeks, setWeeks] = useState(program?.totalWeeks || 4);
  const [days, setDays] = useState(program?.days || [{ name: "Day 1 - Push", exercises: [] }, { name: "Day 2 - Pull", exercises: [] }, { name: "Day 3 - Legs", exercises: [] }]);
  const [active, setActive] = useState(0);
  const [search, setSearch] = useState("");
  const filtered = EXERCISE_LIBRARY.filter((e) => e.toLowerCase().includes(search.toLowerCase()));
  const addEx = (ex) => setDays((p) => p.map((d, i) => i === active ? { ...d, exercises: [...(d.exercises || []), { name: ex, numSets: 3, reps: "8-10", weight: "" }] } : d));
  const updateEx = (di, ei, f, v) => setDays((p) => p.map((d, i) => i === di ? { ...d, exercises: d.exercises.map((e, j) => j === ei ? { ...e, [f]: v } : e) } : d));
  const delDay = (di) => { const next = days.filter((_, i) => i !== di); setDays(next.length ? next : [{ name: "Day 1", exercises: [] }]); setActive(0); };
  return <div style={modalBackdrop()}><Card style={{ width: "100%", maxWidth: 950, maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column" }}><div style={{ display: "flex", gap: 10, marginBottom: 12 }}><input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle()} /><Button onClick={() => onSave({ name, totalWeeks: weeks, days })}>Save</Button><Button variant="ghost" onClick={onClose}>X</Button></div><div style={{ display: "flex", gap: 8, marginBottom: 10 }}>{[2, 4, 6, 8, 12].map((w) => <Button key={w} variant={weeks === w ? "gold" : "dark"} onClick={() => setWeeks(w)}>{w} weeks</Button>)}</div><div style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: 12, minHeight: 520, overflow: "hidden" }}><div style={{ overflow: "auto" }}><Button variant="dark" onClick={() => { setDays([...days, { name: `Day ${days.length + 1}`, exercises: [] }]); setActive(days.length); }} style={{ width: "100%", marginBottom: 10 }}>+ Add Day</Button>{days.map((d, i) => <div key={i} style={{ position: "relative", background: i === active ? client.color + "22" : BRAND.card2, border: `1px solid ${i === active ? client.color : BRAND.line}`, padding: 12, borderRadius: 14, marginBottom: 8, cursor: "pointer" }} onClick={() => setActive(i)}><button onClick={(e) => { e.stopPropagation(); delDay(i); }} style={{ position: "absolute", top: 5, right: 7, background: "transparent", border: "none", color: BRAND.red, cursor: "pointer", fontWeight: 1000 }}>x</button><div style={{ fontWeight: 900 }}>{d.name}</div><div style={{ color: BRAND.muted, fontSize: 12 }}>{d.exercises?.length || 0} exercises</div></div>)}<input placeholder="Search exercise..." value={search} onChange={(e) => setSearch(e.target.value)} style={inputStyle({ marginTop: 10 })} />{filtered.slice(0, 90).map((ex) => <button key={ex} onClick={() => addEx(ex)} style={{ display: "block", width: "100%", textAlign: "left", marginTop: 4, background: "transparent", border: "none", color: BRAND.text, padding: 8, cursor: "pointer" }}>+ {ex}</button>)}</div><div style={{ overflow: "auto" }}><input value={days[active]?.name || ""} onChange={(e) => setDays((p) => p.map((d, i) => i === active ? { ...d, name: e.target.value } : d))} style={inputStyle({ marginBottom: 10, fontWeight: 900 })} />{days[active]?.exercises?.map((ex, ei) => <div key={ei} style={{ display: "grid", gridTemplateColumns: "1fr 70px 90px 90px 30px", gap: 8, alignItems: "center", background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 10, marginBottom: 8 }}><div style={{ fontWeight: 900 }}>{ex.name}</div><input value={ex.numSets} onChange={(e) => updateEx(active, ei, "numSets", e.target.value)} style={inputStyle()} /><input value={ex.reps} onChange={(e) => updateEx(active, ei, "reps", e.target.value)} style={inputStyle()} /><input value={ex.weight} placeholder="kg" onChange={(e) => updateEx(active, ei, "weight", e.target.value)} style={inputStyle()} /><button onClick={() => setDays((p) => p.map((d, i) => i === active ? { ...d, exercises: d.exercises.filter((_, j) => j !== ei) } : d))} style={{ background: "transparent", border: "none", color: BRAND.red, fontWeight: 1000, cursor: "pointer" }}>x</button></div>)}</div></div></Card></div>;
}
 
function AIProgramBuilder({ client, onClose, onSave }) {
  const [days, setDays] = useState(4);
  const [weeks, setWeeks] = useState(4);
  const [extra, setExtra] = useState("");
  function build() {
    const goals = client.goals || [client.goal];
    const lowerBack = `${client.profile?.injuries || ""} ${extra}`.toLowerCase().includes("back");
    const split = days <= 3 ? ["Full Body A", "Full Body B", "Full Body C"] : ["Push", "Pull", "Legs", "Upper", "Conditioning"];
    const main = goals.includes("Strength") ? ["Squat", "Flat Barbell Bench Press", "Pull-Up", "Dead Hang", "Overhead Press"] : goals.includes("Fat Loss") ? ["Goblet Squat", "Push-Up", "Neutral Grip Lat Pulldown", "Dead Bug", "Sled Push"] : ["Leg Press", "Incline DB Chest Press", "Dumbbell Row", "DB Shoulder Press", "Dead Hang"];
    const safe = lowerBack ? main.filter((x) => !x.toLowerCase().includes("deadlift")) : main;
    const made = Array.from({ length: days }, (_, i) => ({ name: split[i] || `Day ${i + 1}`, exercises: safe.slice(0, 5).map((name) => ({ name, numSets: goals.includes("Strength") ? 4 : 3, reps: goals.includes("Strength") ? "4-6" : "8-12", weight: "" })) }));
    onSave({ name: `${client.name} AI Program`, totalWeeks: weeks, days: made });
  }
  return <div style={modalBackdrop()}><Card style={{ width: "100%", maxWidth: 520 }}><div style={{ fontSize: 24, fontWeight: 1000 }}>AI Program Builder</div><div style={{ color: BRAND.muted, marginBottom: 12 }}>Uses goals, injuries, and notes to make a safe starting plan.</div><div style={{ display: "flex", gap: 8, marginBottom: 12 }}>{[2, 3, 4, 5, 6].map((d) => <Button key={d} variant={days === d ? "gold" : "dark"} onClick={() => setDays(d)}>{d} days</Button>)}</div><div style={{ display: "flex", gap: 8, marginBottom: 12 }}>{[2, 4, 6, 8, 12].map((w) => <Button key={w} variant={weeks === w ? "gold" : "dark"} onClick={() => setWeeks(w)}>{w} weeks</Button>)}</div><Field label="Extra details" value={extra} onChange={setExtra} textarea /><div style={{ display: "flex", gap: 10, marginTop: 14 }}><Button onClick={build} style={{ flex: 1 }}>Generate</Button><Button variant="ghost" onClick={onClose}>Cancel</Button></div></Card></div>;
}
 
function SessionTracker({ client, program, saveProgram, isCoach }) {
  const logs = program.weekLogs || Array.from({ length: Number(program.totalWeeks || 4) }, (_, i) => makeWeek(i + 1, program.days || []));
  const [wk, setWk] = useState(0);
  const [dy, setDy] = useState(0);
  const [recap, setRecap] = useState("");
  const week = logs[wk];
  const day = week?.days?.[dy];
  function patch(fn) { const next = fn(logs); saveProgram({ ...program, weekLogs: next }); }
  function setSet(ei, si, f, v) { patch((ls) => ls.map((w, wi) => wi !== wk ? w : { ...w, days: w.days.map((d, di) => di !== dy ? d : { ...d, sessionData: d.sessionData.map((ex, xi) => xi !== ei ? ex : { ...ex, sets: ex.sets.map((s, j) => j !== si ? s : { ...s, [f]: v }) }) }) })); }
  function setMeta(f, v) { patch((ls) => ls.map((w, wi) => wi !== wk ? w : { ...w, days: w.days.map((d, di) => di !== dy ? d : { ...d, [f]: v }) })); }
  function generateRecap() { const lines = day.sessionData.map((ex) => `${ex.name}: ${ex.sets.map((s) => [s.weight && `${s.weight}kg`, s.reps && `${s.reps} reps`, s.rpe && `RPE ${s.rpe}`].filter(Boolean).join(" x ")).filter(Boolean).join(", ") || "not logged"}`).join("\n"); setRecap(`Last ${day.name} recap for ${client.name}:\n${lines}\nNotes: ${day.notes || "No notes yet."}\nNext focus: ${aiProgression(program, client)}`); }
  return <Card><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>{logs.map((_, i) => <Button key={i} variant={wk === i ? "gold" : "dark"} onClick={() => { setWk(i); setDy(0); }}>Week {i + 1}</Button>)}</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>{week?.days?.map((d, i) => <Button key={i} variant={dy === i ? "gold" : "dark"} onClick={() => setDy(i)}>{d.name}</Button>)}</div>{day && <><div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 }}><div><div style={{ fontSize: 20, fontWeight: 1000 }}>{day.name}</div><div style={{ color: BRAND.muted }}>Week {wk + 1}</div></div><input type="date" value={day.date || ""} onChange={(e) => setMeta("date", e.target.value)} style={inputStyle({ maxWidth: 180 })} /></div>{day.sessionData?.map((ex, ei) => <div key={ei} style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: 12, marginTop: 12 }}><div style={{ color: client.color, fontWeight: 1000, marginBottom: 8 }}>{ex.name}</div>{ex.sets.map((s, si) => <div key={si} style={{ display: "grid", gridTemplateColumns: "50px 1fr 1fr 90px", gap: 8, marginBottom: 6, alignItems: "center" }}><div style={{ color: BRAND.muted }}>S{si + 1}</div><input placeholder="kg" value={s.weight} onChange={(e) => setSet(ei, si, "weight", e.target.value)} style={inputStyle()} /><input placeholder="reps" value={s.reps} onChange={(e) => setSet(ei, si, "reps", e.target.value)} style={inputStyle()} /><input placeholder="RPE" value={s.rpe} onChange={(e) => setSet(ei, si, "rpe", e.target.value)} style={inputStyle()} /></div>)}</div>)}<Field label="Session notes" value={day.notes} onChange={(v) => setMeta("notes", v)} textarea /><div style={{ marginTop: 10 }}><Button onClick={generateRecap}>Recap this session</Button></div>{recap && <textarea value={recap} onChange={(e) => setRecap(e.target.value)} style={inputStyle({ minHeight: 150, marginTop: 10 })} />}</>}</Card>;
}
 
function normalizeNutrition(raw) {
  const base = emptyNutrition();
  const n = raw && typeof raw === "object" ? raw : {};
  return {
    ...base,
    ...n,
    targets: { ...base.targets, ...(n.targets || {}) },
    mealPlan: { ...base.mealPlan, ...(n.mealPlan || {}) },
    logs: Array.isArray(n.logs) ? n.logs : [],
  };
}
 
function NutritionTab({ client, updateClient, isCoach }) {
  const [nutrition, setNutrition] = useState(() => normalizeNutrition(client.nutrition));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [meal, setMeal] = useState("Breakfast");
  const [food, setFood] = useState(FOOD_DB[0]?.name || "");
  const [customFood, setCustomFood] = useState("");
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
 
  useEffect(() => {
    setNutrition(normalizeNutrition(client.nutrition));
  }, [client.id, client.nutrition]);
 
  const todays = (nutrition.logs || []).filter((l) => l.date === date);
  const totals = todays.reduce((a, l) => ({
    kcal: a.kcal + Number(l.kcal || 0),
    protein: a.protein + Number(l.protein || 0),
    carbs: a.carbs + Number(l.carbs || 0),
    fats: a.fats + Number(l.fats || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fats: 0 });
 
  function setTarget(k, v) {
    setNutrition((n) => ({ ...n, targets: { ...n.targets, [k]: v } }));
  }
 
  function setMealPlan(k, v) {
    setNutrition((n) => ({ ...n, mealPlan: { ...n.mealPlan, [k]: v } }));
  }
 
  async function save(nextNutrition = nutrition) {
    setSaving(true);
    setMessage("");
    try {
      const clean = normalizeNutrition(nextNutrition);
      await upsertSection(client.id, "nutrition", clean);
      setNutrition(clean);
      updateClient({ ...client, nutrition: clean });
      setMessage("Saved");
    } catch (e) {
      console.error("Nutrition save failed", e);
      alert(e.message || "Nutrition failed to save");
    }
    setSaving(false);
  }
 
  async function addFood() {
    const selected = FOOD_DB.find((f) => f.name === food);
    const base = selected || { name: customFood || "Custom food", kcal: 0, protein: 0, carbs: 0, fats: 0 };
    const q = Number(qty || 1);
    const entry = {
      id: uid(),
      date,
      meal,
      food: selected ? base.name : customFood || base.name,
      qty: q,
      kcal: Math.round(Number(base.kcal || 0) * q),
      protein: Math.round(Number(base.protein || 0) * q),
      carbs: Math.round(Number(base.carbs || 0) * q),
      fats: Math.round(Number(base.fats || 0) * q),
    };
    const next = normalizeNutrition({ ...nutrition, logs: [...(nutrition.logs || []), entry] });
    await save(next);
    setCustomFood("");
    setQty(1);
  }
 
  async function delLog(id) {
    const next = normalizeNutrition({ ...nutrition, logs: (nutrition.logs || []).filter((l) => l.id !== id) });
    await save(next);
  }
 
  const mealLogs = todays.filter((l) => l.meal === meal);
 
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 1000, color: BRAND.gold }}>Nutrition</div>
            <div style={{ color: BRAND.green, fontWeight: 800, marginTop: 5 }}>{aiFoodSuggestions(client)}</div>
          </div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle({ maxWidth: 170 })} />
        </div>
      </Card>
 
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
          <Mini label="Calories" value={`${totals.kcal}/${nutrition.targets.calories || 0}`} />
          <Mini label="Protein" value={`${totals.protein}g/${nutrition.targets.protein || 0}`} />
          <Mini label="Carbs" value={`${totals.carbs}g/${nutrition.targets.carbs || 0}`} />
          <Mini label="Fats" value={`${totals.fats}g/${nutrition.targets.fats || 0}`} />
        </div>
      </Card>
 
      {isCoach && (
        <Card>
          <div style={{ fontSize: 18, fontWeight: 1000, marginBottom: 10 }}>Coach Nutrition Targets</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
            {["calories", "protein", "carbs", "fats"].map((k) => (
              <Field key={k} label={`${k} target`} value={nutrition.targets[k] || ""} onChange={(v) => setTarget(k, v)} type="number" />
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10, marginTop: 12 }}>
            {["Breakfast", "Lunch", "Dinner"].map((m) => (
              <div key={m}>
                <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 900, marginBottom: 5 }}>{m.toUpperCase()} PLAN</div>
                <textarea value={nutrition.mealPlan[m] || ""} onChange={(e) => setMealPlan(m, e.target.value)} placeholder={`Write ${m.toLowerCase()} foods, portions, notes...`} style={textareaStyle({ minHeight: 92 })} />
              </div>
            ))}
          </div>
          <textarea value={nutrition.planNotes || ""} onChange={(e) => setNutrition((n) => ({ ...n, planNotes: e.target.value }))} placeholder="Coach notes: vegetarian/non-vegetarian, allergies, foods to avoid, meal timing..." style={textareaStyle({ minHeight: 80, marginTop: 10 })} />
          <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
            <Button onClick={() => save()} disabled={saving}>{saving ? "Saving..." : "Save Nutrition Plan"}</Button>
            {message && <span style={{ color: BRAND.green, fontWeight: 900 }}>{message}</span>}
          </div>
        </Card>
      )}
 
      <Card>
        <div style={{ fontSize: 18, fontWeight: 1000, marginBottom: 10 }}>Food Log</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, overflowX: "auto" }}>
          {["Breakfast", "Lunch", "Dinner"].map((m) => (
            <Button key={m} variant={meal === m ? "gold" : "dark"} onClick={() => setMeal(m)}>{m}</Button>
          ))}
        </div>
 
        {nutrition.mealPlan?.[meal] && (
          <div style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 12, marginBottom: 12 }}>
            <div style={{ color: BRAND.gold, fontWeight: 1000, marginBottom: 5 }}>{meal} Plan</div>
            <div style={{ color: BRAND.text, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{nutrition.mealPlan[meal]}</div>
          </div>
        )}
 
        <div style={{ display: "grid", gridTemplateColumns: "minmax(160px,2fr) minmax(120px,1.4fr) 90px 110px", gap: 8 }}>
          <select value={food} onChange={(e) => setFood(e.target.value)} style={inputStyle()}>
            {FOOD_DB.map((f) => <option key={f.name}>{f.name}</option>)}
            <option value="CUSTOM">Custom food</option>
          </select>
          <input value={customFood} onChange={(e) => setCustomFood(e.target.value)} placeholder="Custom food name" disabled={food !== "CUSTOM"} style={inputStyle({ opacity: food === "CUSTOM" ? 1 : .45 })} />
          <input type="number" step="0.5" value={qty} onChange={(e) => setQty(e.target.value)} style={inputStyle()} />
          <Button onClick={addFood}>Add</Button>
        </div>
 
        <div style={{ marginTop: 14 }}>
          {mealLogs.length === 0 && <div style={{ color: BRAND.muted, padding: "12px 0" }}>No {meal.toLowerCase()} foods logged yet.</div>}
          {mealLogs.map((l) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, borderTop: `1px solid ${BRAND.line}`, paddingTop: 10, marginTop: 10 }}>
              <div>
                <b style={{ color: BRAND.text }}>{l.food}</b>
                <div style={{ color: BRAND.muted }}>{l.qty}x · {l.kcal} kcal · P {l.protein}g · C {l.carbs}g · F {l.fats}g</div>
              </div>
              <Button variant="red" onClick={() => delLog(l.id)}>x</Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
 
function TransformPhotos({ client, updateClient }) {
  const [photos, setPhotos] = useState(client.transformPhotos || []);
  const [form, setForm] = useState({ url: "", type: "Front", weight: "", notes: "", date: new Date().toISOString().slice(0, 10) });
  async function add() { const next = [{ id: uid(), ...form }, ...photos]; setPhotos(next); await upsertSection(client.id, "transformPhotos", next); updateClient({ ...client, transformPhotos: next }); setForm({ ...form, url: "", notes: "" }); }
  async function del(id) { const next = photos.filter((p) => p.id !== id); setPhotos(next); await upsertSection(client.id, "transformPhotos", next); updateClient({ ...client, transformPhotos: next }); }
  return <Card><div style={{ fontSize: 22, fontWeight: 1000, marginBottom: 12 }}>Transform Photos</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}><Field label="Image URL" value={form.url} onChange={(v) => setForm({ ...form, url: v })} /><Field label="Type" value={form.type} onChange={(v) => setForm({ ...form, type: v })} /><Field label="Weight" value={form.weight} onChange={(v) => setForm({ ...form, weight: v })} /><Field label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} /></div><Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} textarea /><Button onClick={add} style={{ marginTop: 10 }}>Save Photo</Button><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginTop: 14 }}>{photos.map((p) => <div key={p.id} style={{ background: BRAND.card2, border: `1px solid ${BRAND.line}`, borderRadius: 16, overflow: "hidden" }}>{p.url ? <img src={p.url} alt="progress" style={{ width: "100%", height: 180, objectFit: "cover" }} /> : <div style={{ height: 180, display: "grid", placeItems: "center", color: BRAND.muted }}>No image URL</div>}<div style={{ padding: 10 }}><b>{p.type}</b><div style={{ color: BRAND.muted }}>{p.date} · {p.weight}kg</div><div style={{ color: BRAND.text }}>{p.notes}</div><Button variant="red" onClick={() => del(p.id)} style={{ marginTop: 8 }}>Delete</Button></div></div>)}</div></Card>;
}
 
function ProgressTab({ client }) {
  const latest = client.progress?.[client.progress.length - 1] || {};
  return <div style={{ display: "grid", gap: 14 }}><Card><div style={{ fontSize: 22, fontWeight: 1000 }}>Progress</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginTop: 12 }}>{LIFT_FIELDS.map((f) => <Mini key={f.key} label={f.label} value={latest[f.key] || "-"} />)}</div></Card></div>;
}
 
function ScheduleTab({ client, updateClient }) {
  const [schedule, setSchedule] = useState(client.schedule || []);
  const [form, setForm] = useState({ day: "Mon", time: "5:30" });
  async function save(next) { setSchedule(next); await upsertSection(client.id, "sessions", { ...(client.sessions || {}), schedule: next, checkIns: client.checkIns || [] }); updateClient({ ...client, schedule: next }); }
  return <Card><div style={{ fontSize: 22, fontWeight: 1000, marginBottom: 12 }}>Recurring Schedule</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}><select value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} style={inputStyle()}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select><input value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} style={inputStyle()} /><Button onClick={() => save([...schedule, form])}>Add</Button></div>{schedule.map((s, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${BRAND.line}`, marginTop: 10, paddingTop: 10 }}><b>{s.day} {timeLabel(s.time)}</b><Button variant="red" onClick={() => save(schedule.filter((_, j) => j !== i))}>x</Button></div>)}</Card>;
}
 
function InviteTab({ client, updateClient }) {
  const [code, setCode] = useState(client.inviteCode || makeInviteCode());
  async function saveInvite() { await supabase.from("clients").update({ invite_code: code, invite_status: "sent" }).eq("id", client.id); updateClient({ ...client, inviteCode: code, inviteStatus: "sent" }); }
  const link = `${window.location.origin}?invite=${code}`;
  return <Card><div style={{ fontSize: 22, fontWeight: 1000 }}>Invite Client</div><div style={{ color: BRAND.muted, marginBottom: 12 }}>Client uses this code to claim the profile you created.</div><Field label="Invite Code" value={code} onChange={(v) => setCode(v.toUpperCase())} /><Button onClick={saveInvite} style={{ marginTop: 10 }}>Save Invite</Button><div style={{ marginTop: 12, color: BRAND.green, wordBreak: "break-all" }}>{link}</div></Card>;
}
 
function ClientWorkoutLog({ client, updateClient }) {
  const [logs, setLogs] = useState(client.workoutLogs || []);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), workout: "", weights: "", cardio: "", rpe: "", notes: "" });
  async function add() { const next = [{ id: uid(), ...form }, ...logs]; setLogs(next); await upsertSection(client.id, "workoutLogs", next); updateClient({ ...client, workoutLogs: next }); setForm({ ...form, workout: "", weights: "", cardio: "", rpe: "", notes: "" }); }
  return <Card><div style={{ fontSize: 22, fontWeight: 1000 }}>Workout Log</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}><Field label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} /><Field label="Workout done" value={form.workout} onChange={(v) => setForm({ ...form, workout: v })} /><Field label="Weights / reps" value={form.weights} onChange={(v) => setForm({ ...form, weights: v })} /><Field label="Cardio" value={form.cardio} onChange={(v) => setForm({ ...form, cardio: v })} /><Field label="RPE" value={form.rpe} onChange={(v) => setForm({ ...form, rpe: v })} /></div><Field label="Notes" textarea value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} /><Button onClick={add} style={{ marginTop: 10 }}>Log Workout</Button>{logs.map((l) => <div key={l.id} style={{ borderTop: `1px solid ${BRAND.line}`, marginTop: 12, paddingTop: 12 }}><b>{l.date} - {l.workout}</b><div style={{ color: BRAND.muted }}>{l.weights} · {l.cardio} · RPE {l.rpe}</div><div>{l.notes}</div></div>)}</Card>;
}
 
function Calendar({ clients, refresh, user }) {
  const [slots, setSlots] = useState(() => JSON.parse(localStorage.getItem("forge_time_slots") || "null") || DEFAULT_TIME_SLOTS);
  const [bookings, setBookings] = useState([]);
  const [newSlot, setNewSlot] = useState("");
  useEffect(() => { load(); }, []);
  async function load() { const uid = user?.id || (await supabase.auth.getUser()).data.user?.id; const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", uid).eq("section", "calendar").maybeSingle(); setBookings(data?.data?.bookings || []); }
  async function save(next) { setBookings(next); const uid = user?.id || (await supabase.auth.getUser()).data.user?.id; await supabase.from("trainer_data").upsert({ trainer_id: uid, section: "calendar", data: { bookings: next } }, { onConflict: "trainer_id,section" }); }
  function autoBookings() { return clients.flatMap((c) => (c.schedule || []).map((s) => ({ id: `auto_${c.id}_${s.day}_${s.time}`, day: s.day, time: s.time, title: c.name, type: "Client", color: c.color, auto: true }))); }
  const all = [...autoBookings(), ...bookings];
  function removeSlot(s) { const next = slots.filter((x) => x !== s); setSlots(next); localStorage.setItem("forge_time_slots", JSON.stringify(next)); }
  function addSlot() { if (!newSlot) return; const next = [...slots, newSlot]; setSlots(next); localStorage.setItem("forge_time_slots", JSON.stringify(next)); setNewSlot(""); }
  function clickCell(day, time) { const title = prompt("Booking name"); if (!title) return; const type = prompt("Type: Client Session, Free Trial, Consultation", "Client Session") || "Client Session"; save([...bookings, { id: uid(), day, time, title, type, color: type.toLowerCase().includes("trial") ? BRAND.red : BRAND.blue }]); }
  return <Card style={{ overflowX: "auto" }}><div style={{ display: "flex", gap: 8, marginBottom: 12 }}><input value={newSlot} onChange={(e) => setNewSlot(e.target.value)} placeholder="Add time e.g. 6:30" style={inputStyle({ maxWidth: 190 })} /><Button onClick={addSlot}>Add time</Button></div><table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 6, minWidth: 760 }}><thead><tr><th></th>{DAYS.map((d) => <th key={d} style={{ color: BRAND.gold }}>{d}</th>)}</tr></thead><tbody>{slots.map((t) => <tr key={t}><td style={{ color: BRAND.muted, fontWeight: 900, minWidth: 70 }}>{timeLabel(t)} <button onClick={() => removeSlot(t)} style={{ background: "transparent", border: "none", color: BRAND.red, cursor: "pointer" }}>x</button></td>{DAYS.map((d) => { const b = all.find((x) => x.day === d && x.time === t); return <td key={d} onClick={() => !b && clickCell(d, t)} style={{ height: 48, background: b ? b.color : "#0b0c10", color: b ? "#000" : BRAND.dim, border: `1px solid ${BRAND.line}`, borderRadius: 10, padding: 8, cursor: "pointer", fontWeight: 900 }}>{b ? b.title : ""}{b && !b.auto && <button onClick={(e) => { e.stopPropagation(); save(bookings.filter((x) => x.id !== b.id)); }} style={{ float: "right", background: "transparent", border: "none", cursor: "pointer" }}>x</button>}</td>; })}</tr>)}</tbody></table></Card>;
}
 
function Trials({ user }) {
  const [trials, setTrials] = useState([]);
  const [tab, setTab] = useState("consultation");
  const [form, setForm] = useState({ name: "", phone: "", email: "", barriers: "", consultationNotes: "", assessmentDate: "", cardiovascular: "", squat: "", pushStrength: "", pullStrength: "", coreStrength: "", flexibilityFitness: "" });
  useEffect(() => { load(); }, []);
  async function load() { const uid = user?.id || (await supabase.auth.getUser()).data.user?.id; const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", uid).eq("section", "trials").maybeSingle(); setTrials(data?.data?.trials || []); }
  async function save(next) { setTrials(next); const uid = user?.id || (await supabase.auth.getUser()).data.user?.id; await supabase.from("trainer_data").upsert({ trainer_id: uid, section: "trials", data: { trials: next } }, { onConflict: "trainer_id,section" }); }
  function set(k, v) { setForm({ ...form, [k]: v }); }
  return <Card><div style={{ fontSize: 22, fontWeight: 1000 }}>Trials</div><div style={{ display: "flex", gap: 8, margin: "12px 0" }}><Button variant={tab === "consultation" ? "gold" : "dark"} onClick={() => setTab("consultation")}>Consultation</Button><Button variant={tab === "assessment" ? "gold" : "dark"} onClick={() => setTab("assessment")}>Fitness Assessment</Button></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}><Field label="Name" value={form.name} onChange={(v) => set("name", v)} /><Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} /><Field label="Email" value={form.email} onChange={(v) => set("email", v)} />{tab === "consultation" ? <><Field label="Barriers" value={form.barriers} onChange={(v) => set("barriers", v)} textarea /><Field label="Consultation Notes" value={form.consultationNotes} onChange={(v) => set("consultationNotes", v)} textarea /></> : <><Field label="Date" type="date" value={form.assessmentDate} onChange={(v) => set("assessmentDate", v)} /><Field label="Cardiovascular fitness" value={form.cardiovascular} onChange={(v) => set("cardiovascular", v)} /><Field label="Squat" value={form.squat} onChange={(v) => set("squat", v)} /><Field label="Push strength" value={form.pushStrength} onChange={(v) => set("pushStrength", v)} /><Field label="Pull strength" value={form.pullStrength} onChange={(v) => set("pullStrength", v)} /><Field label="Core strength" value={form.coreStrength} onChange={(v) => set("coreStrength", v)} /><Field label="Flexibility fitness" value={form.flexibilityFitness} onChange={(v) => set("flexibilityFitness", v)} /></>}</div><Button onClick={() => save([{ id: uid(), ...form }, ...trials])} style={{ marginTop: 12 }}>Save Trial</Button>{trials.map((t) => <div key={t.id} style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: 12, marginTop: 12 }}><b>{t.name}</b><div style={{ color: BRAND.muted }}>{t.phone} · {t.email}</div><Button variant="red" onClick={() => save(trials.filter((x) => x.id !== t.id))} style={{ marginTop: 8 }}>Delete</Button></div>)}</Card>;
}
 
export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trainer, setTrainer] = useState(null);
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [clientPortal, setClientPortal] = useState(null);
 
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (data.session) boot(data.session.user); else setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => { setSession(sess); if (sess) boot(sess.user); else { setLoading(false); setTrainer(null); setClients([]); setClientPortal(null); } });
    return () => sub.subscription.unsubscribe();
  }, []);
 
  async function boot(user) {
    setLoading(true);
    await ensureTrainer(user);
    await loadRole(user);
    setLoading(false);
  }
 
  async function ensureTrainer(user) {
    const email = user.email || "";
    const name = user.user_metadata?.name || email.split("@")[0] || "Coach";
    await supabase.from("trainers").upsert({ id: user.id, email, name, role: "Coach" });
  }
 
  async function loadRole(user) {
    const { data: clientMatch } = await supabase.from("clients").select("*").eq("client_user_id", user.id).maybeSingle();
    if (clientMatch) {
      const { data: rows } = await supabase.from("client_data").select("*").eq("client_id", clientMatch.id);
      setClientPortal(mapClient(clientMatch, rows || []));
      setSelected(null); setClients([]);
      return;
    }
    await loadCoach(user);
  }
 
  async function loadCoach(user = session?.user) {
    if (!user) return;
    const { data: trainerRow } = await supabase.from("trainers").select("*").eq("id", user.id).maybeSingle();
    setTrainer(trainerRow || { id: user.id, name: user.email?.split("@")[0], email: user.email });
 
    if ((user.email || "").toLowerCase() === DENIS_EMAIL) {
      await supabase.from("clients").update({ trainer_id: user.id }).is("trainer_id", null);
    }
 
    const { data: clientRows, error } = await supabase.from("clients").select("*").eq("trainer_id", user.id).order("created_at", { ascending: false });
    if (error) { console.error(error); setClients([]); return; }
    const ids = (clientRows || []).map((c) => c.id);
    let dataRows = [];
    if (ids.length) {
      const { data } = await supabase.from("client_data").select("*").in("client_id", ids);
      dataRows = data || [];
    }
    setClients((clientRows || []).map((r, i) => mapClient(r, dataRows, i)));
  }
 
  function updateClient(updated) {
    setClients((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    setSelected(updated);
    setClientPortal((p) => p?.id === updated.id ? updated : p);
  }
 
  if (loading) return <div style={{ minHeight: "100vh", background: BRAND.bg, color: BRAND.gold, display: "grid", placeItems: "center", fontSize: 28, fontWeight: 1000 }}>FORGE loading...</div>;
  if (!session) return <LoginScreen onReady={() => supabase.auth.getSession().then(({ data }) => data.session && boot(data.session.user))} />;
  if (clientPortal) return <ClientView client={clientPortal} updateClient={updateClient} isCoach={false} refresh={() => boot(session.user)} />;
  if (selected) return <ClientView client={selected} updateClient={updateClient} back={() => setSelected(null)} refresh={() => loadCoach(session.user)} isCoach />;
  return <CoachDashboard user={session.user} trainer={trainer} clients={clients} setClients={setClients} selectClient={setSelected} refresh={() => loadCoach(session.user)} />;
}
