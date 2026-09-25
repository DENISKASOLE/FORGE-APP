import { useEffect, useState } from "react";
import { NP, npCard, npInput, npButton, npLabel } from "./theme.jsx";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { loadPlanTemplates, savePlanTemplates } from "../../lib/nutritionPlan.js";
import { newPlanDoc, cloneDocWithNewIds } from "./planModel.js";
import { uid } from "../../lib/uid.js";

// Tools > Nutrition Plans (spec §5.1). Row menu keeps it to exactly what
// the spec asks for: Duplicate, Archive - no rename-in-place (opening the
// builder and editing the title inline does that, per §5.2).
export function NutritionPlansScreen({ trainerId, onBack, onOpenBuilder }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [menuFor, setMenuFor] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadPlanTemplates(trainerId).then((list) => { if (!cancelled) { setTemplates(list); setLoading(false); } });
    return () => { cancelled = true; };
  }, [trainerId]);

  async function persist(next) {
    setTemplates(next);
    await savePlanTemplates(trainerId, next);
  }
  function createNew() {
    const entry = { id: uid(), name: "New Plan", doc: newPlanDoc("New Plan"), archived: false, updatedAt: new Date().toISOString() };
    persist([entry, ...templates]);
    onOpenBuilder(entry.id);
  }
  function duplicate(t) {
    const entry = { id: uid(), name: `${t.name} (copy)`, doc: { ...cloneDocWithNewIds(t.doc), name: `${t.name} (copy)` }, archived: false, updatedAt: new Date().toISOString() };
    persist([entry, ...templates]);
    setMenuFor(null);
    showToast(`Duplicated "${t.name}".`, "success");
  }
  function toggleArchive(t) {
    persist(templates.map((x) => (x.id === t.id ? { ...x, archived: !x.archived } : x)));
    setMenuFor(null);
  }

  const visible = templates
    .filter((t) => showArchived || !t.archived)
    .filter((t) => !search.trim() || t.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  return (
    <div style={{ display: "grid", gap: 14, fontFamily: NP.font }}>
      <button onClick={onBack} style={npButton("ghost", { justifySelf: "start", padding: "8px 4px" })}>‹ BACK</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 26, letterSpacing: "0.02em", color: NP.text }}>NUTRITION PLANS</div>
          <div style={{ color: NP.muted, fontSize: 13, marginTop: 4, fontWeight: 500 }}>Templates you build once and assign to any client.</div>
        </div>
        <button onClick={createNew} style={npButton("fill")}>+ NEW TEMPLATE</button>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." style={npInput()} />
      <label style={{ display: "flex", alignItems: "center", gap: 8, color: NP.muted, fontSize: 12 }}>
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> SHOW ARCHIVED
      </label>

      {loading ? (
        <div style={npCard({ padding: 16, color: NP.muted })}>Loading…</div>
      ) : visible.length === 0 ? (
        <div style={npCard({ padding: 16, color: NP.muted })}>No plans yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {visible.map((t) => (
            <div key={t.id} style={npCard({ padding: 0, position: "relative", overflow: "visible" })}>
              <button onClick={() => onOpenBuilder(t.id)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: 16, cursor: "pointer", fontFamily: NP.font, opacity: t.archived ? 0.5 : 1 }}>
                <div style={{ color: NP.text, fontSize: 15, letterSpacing: "0.04em" }}>{t.name}{t.archived && <span style={{ color: NP.dim, fontSize: 11 }}> · ARCHIVED</span>}</div>
                <div style={{ color: NP.dim, fontSize: 11, marginTop: 6, letterSpacing: "0.08em" }}>
                  {(t.doc?.days || []).length} DAY{(t.doc?.days || []).length === 1 ? "" : "S"}{t.updatedAt ? ` · EDITED ${new Date(t.updatedAt).toLocaleDateString()}` : ""}
                </div>
              </button>
              <button onClick={() => setMenuFor(menuFor === t.id ? null : t.id)} aria-label="More" style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, background: "none", border: "none", color: NP.dim, fontSize: 18, cursor: "pointer" }}>⋯</button>
              {menuFor === t.id && (
                <div style={npCard({ position: "absolute", top: 44, right: 12, zIndex: 5, padding: 6, minWidth: 140, background: NP.panel })}>
                  <button onClick={() => duplicate(t)} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: NP.text, fontFamily: NP.font, fontSize: 12, padding: "9px 10px", cursor: "pointer" }}>DUPLICATE</button>
                  <button onClick={() => toggleArchive(t)} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: NP.text, fontFamily: NP.font, fontSize: 12, padding: "9px 10px", cursor: "pointer" }}>{t.archived ? "UNARCHIVE" : "ARCHIVE"}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
