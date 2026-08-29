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
  return (
    <Card>
      <div style={{ fontFamily: BRAND.display, fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text, marginBottom: 12 }}>Packages</div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 14 }}>
        <Mini label="Total Sessions" value={totalSessions} />
        <Mini label="Used" value={usedSessions} />
        <Mini label="Left" value={Math.max(totalSessions - usedSessions, 0)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        <Field label="Package name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Field label="Total sessions" type="number" value={form.total} onChange={(v) => setForm({ ...form, total: v })} />
        <Field label="Used sessions" type="number" value={form.used} onChange={(v) => setForm({ ...form, used: v })} />
        <Field label="Price AED" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 14 }}>
        <input type="checkbox" checked={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.checked })} /> Paid
      </label>
      <Button onClick={addPackage} style={{ marginTop: 12 }}>Add Package</Button>
      <div style={{ marginTop: 14 }}>
        {packages.length === 0 ? (
          <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 14, textAlign: "center", padding: "12px 0" }}>No packages yet. Add one above.</div>
        ) : packages.map((p) => {
          const total = Number(p.total || 0);
          const used = Number(p.used || 0);
          const left = Math.max(total - used, 0);
          const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((used / total) * 100))) : 0;
          return (
            <div key={p.id} style={{ borderTop: `${BRAND.hairline} solid ${BRAND.lineSoft}`, paddingTop: 12, marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: BRAND.sans, fontWeight: 500, fontSize: 14, color: BRAND.text }}>{p.name}</div>
                  <div style={{ fontFamily: BRAND.sans, color: BRAND.muted, fontSize: 13, lineHeight: 1.6, marginTop: 2 }}>
                    {used}/{total} used · {left} left · {moneyAED(p.price)} · {p.paid ? <span style={{ color: BRAND.green }}>Paid</span> : <span style={{ color: BRAND.yellow }}>Unpaid</span>}
                  </div>
                  <div style={{ height: 4, borderRadius: 999, background: BRAND.lineSoft, overflow: "hidden", marginTop: 8 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: BRAND.green, borderRadius: 999 }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <Button variant="dark" onClick={() => save(packages.map((x) => x.id === p.id ? { ...x, used: Math.min(Number(x.used || 0) + 1, Number(x.total || 0)) } : x))}>+ Use</Button>
                  <Button variant="red" onClick={() => save(packages.filter((x) => x.id !== p.id))}>x</Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
