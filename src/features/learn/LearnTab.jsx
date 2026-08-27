import { useEffect, useRef, useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { inputStyle } from "../../components/ui/Field.jsx";
import { uid } from "../../lib/uid.js";
import { isoDate } from "../../lib/dateUtils.js";
import { upsertTrainerData } from "../../lib/clientData.js";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";

async function loadArticles(trainerId) {
  if (!trainerId) return [];
  const { data } = await supabase.from("trainer_data").select("data").eq("trainer_id", trainerId).eq("section", "articles").maybeSingle();
  return data?.data?.articles || [];
}

export const DEFAULT_ARTICLES = [
  { id: "seed1", cat: "Training", title: "Progressive overload beats chasing soreness", read: "4 min", date: "Starter", body: "Soreness tells you a movement was unfamiliar, not that it was effective.\n\nThe real driver of progress is doing a little more over time: more weight, more reps, or cleaner execution. Each week, aim to beat one number from last week, even by a single rep." },
  { id: "seed2", cat: "Nutrition", title: "Protein: how much you actually need", read: "3 min", date: "Starter", body: "For most people training hard, 1.6 to 2.2g per kg of bodyweight per day covers it.\n\nSpread it across three to four meals. Whole foods first; a shake is a top-up, not a foundation." },
  { id: "seed3", cat: "Recovery", title: "Sleep is your best recovery tool", read: "3 min", date: "Starter", body: "You cannot out-train poor sleep.\n\nUnder six hours and strength, appetite, and mood all take a hit. Aim for seven to nine, keep a consistent wake time, and cut screens before bed." },
  { id: "seed4", cat: "Mindset", title: "Consistency beats intensity", read: "2 min", date: "Starter", body: "The best programme is the one you actually follow.\n\nThree solid sessions every week for a year will out-build a perfect plan you abandon in a month. Show up, log it, repeat." },
];
const ART_COVER = { Training: ["#FFA94D", "#6b3d0e"], Nutrition: ["#3DD68C", "#0f5233"], Mindset: ["#A78BFA", "#382559"], Recovery: ["#38BDF8", "#0d4463"] };
const ART_ICON = { Training: "🏋", Nutrition: "🥗", Mindset: "🧠", Recovery: "😴" };

export function CoachContentScreen({ user, onBack }) {
  const CATS = { Training: BRAND.orange, Nutrition: BRAND.green, Mindset: BRAND.purple, Recovery: BRAND.blue };
  const cats = ["Training", "Nutrition", "Mindset", "Recovery"];
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [cat, setCat] = useState("Training");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  useEffect(() => { loadArticles(user.id).then((a) => { setArticles(a); setLoading(false); }); }, [user.id]);
  async function persist(next) { setArticles(next); await upsertTrainerData(user.id, "articles", { articles: next }); }
  async function publish() {
    if (!title.trim()) return;
    setSaving(true);
    const mins = Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 200)) + " min";
    const next = editId
      ? articles.map((a) => (a.id === editId ? { ...a, title: title.trim(), cat, body, read: mins } : a))
      : [{ id: uid(), title: title.trim(), cat, body, read: mins, date: isoDate(), isNew: true }, ...articles];
    await persist(next);
    setTitle(""); setBody(""); setCat("Training"); setEditId(null); setSaving(false);
  }
  function edit(a) { setEditId(a.id); setTitle(a.title); setCat(a.cat); setBody(a.body || ""); }
  async function remove(id) { if (!await confirmDialog("Delete this article?", { danger: true, confirmLabel: "Delete" })) return; await persist(articles.filter((a) => a.id !== id)); }
  return <div style={{ display: "grid", gap: 14 }}>
    <Button variant="ghost" onClick={onBack} style={{ padding: "8px 14px", justifySelf: "start" }}>‹ Back</Button>
    <div><div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 1.5 }}>Forge Academy</div><div style={{ fontSize: 26, fontWeight: 900 }}>{editId ? "Edit article" : "Write an article"}</div></div>
    <Card style={{ display: "grid", gap: 10 }}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={inputStyle()} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{cats.map((c) => <button key={c} onClick={() => setCat(c)} style={{ fontSize: 12, fontWeight: 900, color: cat === c ? "#000" : BRAND.muted, background: cat === c ? CATS[c] : BRAND.card2, border: `1px solid ${cat === c ? CATS[c] : BRAND.line}`, borderRadius: 999, padding: "8px 12px", cursor: "pointer" }}>{c}</button>)}</div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your article. Every client sees this in their Learn tab." style={inputStyle({ minHeight: 150, resize: "vertical" })} />
      <div style={{ display: "flex", gap: 8 }}><Button onClick={publish} disabled={saving} style={{ flex: 1 }}>{saving ? "Publishing..." : editId ? "Update article" : "Publish to all clients"}</Button>{editId && <Button variant="dark" onClick={() => { setEditId(null); setTitle(""); setBody(""); }}>Cancel</Button>}</div>
    </Card>
    <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.7 }}>Published ({articles.length})</div>
    {loading && <Card><div style={{ color: BRAND.muted }}>Loading...</div></Card>}
    {!loading && articles.length === 0 && <Card><div style={{ color: BRAND.muted, fontSize: 14, fontWeight: 600 }}>No articles yet. Write your first one above.</div></Card>}
    {articles.map((a) => <Card key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <div style={{ minWidth: 0 }}><div style={{ fontWeight: 1000, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div><div style={{ color: CATS[a.cat] || BRAND.muted, fontSize: 11, fontWeight: 900, marginTop: 3 }}>{a.cat} · {a.date}</div></div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}><Button variant="dark" onClick={() => edit(a)}>Edit</Button><Button variant="red" onClick={() => remove(a.id)}>x</Button></div>
    </Card>)}
  </div>;
}

export function LearnTab({ client }) {
  const CATS = { Training: BRAND.orange, Nutrition: BRAND.green, Mindset: BRAND.purple, Recovery: BRAND.blue };
  const cats = ["All", "Training", "Nutrition", "Mindset", "Recovery"];
  const [articles, setArticles] = useState(null);
  const [cat, setCat] = useState("All");
  const [open, setOpen] = useState(null);
  useEffect(() => { loadArticles(client.trainer_id).then(setArticles); }, [client.trainer_id]);
  const header = <div><div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 1.5 }}>Forge Academy</div><div style={{ fontSize: 24, fontWeight: 1000 }}>Learn</div></div>;
  if (open) {
    return <div style={{ display: "grid", gap: 12 }}><Card>
      <button onClick={() => setOpen(null)} style={{ background: "transparent", border: "none", color: BRAND.gold, fontWeight: 900, fontSize: 12, cursor: "pointer", padding: 0 }}>{"< Back"}</button>
      <div style={{ color: CATS[open.cat] || BRAND.muted, fontSize: 11, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 14 }}>{open.cat} · {open.read} read</div>
      <div style={{ fontSize: 22, fontWeight: 1000, marginTop: 8, lineHeight: 1.2 }}>{open.title}</div>
      <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 800, marginTop: 6 }}>The Forge Method · {open.date}</div>
      <div style={{ color: "#d8d8d8", fontSize: 14, lineHeight: 1.65, marginTop: 16, whiteSpace: "pre-line", fontWeight: 600 }}>{open.body}</div>
    </Card></div>;
  }
  if (articles === null) return <div style={{ display: "grid", gap: 12 }}>{header}<Card><div style={{ color: BRAND.muted }}>Loading...</div></Card></div>;
  const src = articles.length ? articles : DEFAULT_ARTICLES;
  const list = cat === "All" ? src : src.filter((a) => a.cat === cat);
  return <div style={{ display: "grid", gap: 12 }}>
    {header}
    <>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>{cats.map((c) => <button key={c} onClick={() => setCat(c)} style={{ whiteSpace: "nowrap", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5, color: cat === c ? "#000" : BRAND.muted, background: cat === c ? BRAND.gold : BRAND.card2, border: `1px solid ${cat === c ? BRAND.gold : BRAND.line}`, borderRadius: 999, padding: "8px 13px", cursor: "pointer" }}>{c}</button>)}</div>
      {list.map((a) => <Card key={a.id} onClick={() => setOpen(a)} style={{ cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ color: CATS[a.cat] || BRAND.muted, fontSize: 11, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.5 }}>{a.cat}</div>{a.isNew && <span style={{ fontSize: 9, fontWeight: 1000, color: "#000", background: BRAND.gold, borderRadius: 999, padding: "3px 8px" }}>NEW</span>}</div>
        <div style={{ fontSize: 16, fontWeight: 1000, marginTop: 8, lineHeight: 1.25 }}>{a.title}</div>
        <div style={{ color: BRAND.dim, fontSize: 11, fontWeight: 800, marginTop: 8 }}>{a.read} read · {a.date}</div>
      </Card>)}
      {list.length === 0 && <Card><div style={{ color: BRAND.muted }}>Nothing in {cat} yet.</div></Card>}
    </>
  </div>;
}

export function HomeLearnStrip({ client, goTo }) {
  const [arts, setArts] = useState([]);
  const ref = useRef(null);
  useEffect(() => { loadArticles(client.trainer_id).then((a) => setArts(a || [])); }, [client.trainer_id]);
  const list = arts.length ? arts : DEFAULT_ARTICLES;
  useEffect(() => {
    if (list.length < 2) return;
    const el = ref.current; if (!el) return;
    const id = setInterval(() => { if (!el) return; if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 1) el.scrollLeft = 0; else el.scrollLeft += 1; }, 30);
    return () => clearInterval(id);
  }, [arts]);
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <div style={{ color: BRAND.gold, fontSize: 11, fontWeight: 1000, letterSpacing: 0.5, textTransform: "uppercase" }}>Learn</div>
      {goTo && <button onClick={() => goTo("learn")} style={{ background: "none", border: "none", color: BRAND.muted, fontWeight: 900, fontSize: 11, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.5 }}>See all ›</button>}
    </div>
    <div ref={ref} style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
      {list.map((a) => { const cov = ART_COVER[a.cat] || ["#333", "#111"]; return <div key={a.id} onClick={() => goTo && goTo("learn")} style={{ flex: "0 0 210px", cursor: "pointer", borderRadius: 14, overflow: "hidden", border: `1px solid ${BRAND.line}`, background: BRAND.card }}>
        <div style={{ height: 96, background: `linear-gradient(140deg, ${cov[0]}, ${cov[1]})`, display: "grid", placeItems: "center", position: "relative" }}><span style={{ fontSize: 30 }}>{ART_ICON[a.cat] || "📖"}</span><div style={{ position: "absolute", top: 8, left: 8, fontSize: 8, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0.5, color: "#000", background: "rgba(255,255,255,0.88)", borderRadius: 6, padding: "3px 7px" }}>{a.cat}</div></div>
        <div style={{ padding: 11 }}><div style={{ fontWeight: 1000, fontSize: 13, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.title}</div><div style={{ color: BRAND.dim, fontSize: 10, fontWeight: 800, marginTop: 6, textTransform: "uppercase" }}>{a.read} read</div></div>
      </div>; })}
    </div>
  </div>;
}
