import { useState } from "react";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { Mini } from "../../components/ui/Mini.jsx";
import { useIsMobile } from "../../lib/browser.js";
import { uid } from "../../lib/uid.js";
import { moneyAED, upsertSection } from "../../lib/clientData.js";

export function PackagesTab({ client, updateClient }) {
  const isMobile = useIsMobile(520);
  const [packages, setPackages] = useState(client.packages || []);
  const [form, setForm] = useState({ name: "10 Session Pack", total: 10, used: 0, price: "", paid: false });
  async function save(next) { setPackages(next); await upsertSection(client.id, "packages", next); updateClient({ ...client, packages: next }); }
  function addPackage() { const next = [{ id: uid(), ...form, total: Number(form.total || 0), used: Number(form.used || 0), price: Number(form.price || 0) }, ...packages]; save(next); setForm({ name: "10 Session Pack", total: 10, used: 0, price: "", paid: false }); }
  const totalSessions = packages.reduce((a, p) => a + Number(p.total || 0), 0);
  const usedSessions = packages.reduce((a, p) => a + Number(p.used || 0), 0);
  return <Card><div style={{ fontSize: 22, fontWeight: 1000, marginBottom: 12 }}>Packages</div><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 14 }}><Mini label="Total Sessions" value={totalSessions} /><Mini label="Used" value={usedSessions} /><Mini label="Left" value={Math.max(totalSessions - usedSessions, 0)} /></div><div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}><Field label="Package name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} /><Field label="Total sessions" type="number" value={form.total} onChange={(v) => setForm({ ...form, total: v })} /><Field label="Used sessions" type="number" value={form.used} onChange={(v) => setForm({ ...form, used: v })} /><Field label="Price AED" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} /></div><label style={{ display: "block", marginTop: 10, color: BRAND.muted }}><input type="checkbox" checked={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.checked })} /> Paid</label><Button onClick={addPackage} style={{ marginTop: 12 }}>Add Package</Button><div style={{ marginTop: 14 }}>{packages.length === 0 ? <div style={{ color: BRAND.muted, textAlign: "center", padding: "12px 0" }}>No packages yet. Add one above.</div> : packages.map((p) => { const left = Math.max(Number(p.total || 0) - Number(p.used || 0), 0); return <div key={p.id} style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: 12, marginTop: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div><b>{p.name}</b><div style={{ color: BRAND.muted }}>{Number(p.used || 0)}/{Number(p.total || 0)} used · {left} left · {moneyAED(p.price)} · {p.paid ? "Paid" : "Unpaid"}</div></div><div style={{ display: "flex", gap: 6 }}><Button variant="dark" onClick={() => save(packages.map((x) => x.id === p.id ? { ...x, used: Math.min(Number(x.used || 0) + 1, Number(x.total || 0)) } : x))}>+ Use</Button><Button variant="red" onClick={() => save(packages.filter((x) => x.id !== p.id))}>x</Button></div></div></div>})}</div></Card>;
}
