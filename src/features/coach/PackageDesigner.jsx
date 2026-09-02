import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field, inputStyle } from "../../components/ui/Field.jsx";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { moneyAED, upsertSection, upsertTrainerData } from "../../lib/clientData.js";
import { isoDate } from "../../lib/dateUtils.js";
import { uid } from "../../lib/uid.js";

async function loadPackageCatalog(trainerId) {
  const { data, error } = await supabase.from("trainer_data").select("data").eq("trainer_id", trainerId).eq("section", "package_catalog").maybeSingle();
  if (error) { showToast(error.message || "Couldn't load your packages.", "error"); return []; }
  return data?.data?.packages || [];
}

function fieldLabel(text) {
  return <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.14em" }}>{text}</div>;
}

function PackageForm({ initial, onCancel, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState(initial?.type || "sessions");
  const [sessions, setSessions] = useState(initial?.sessions || "");
  const [price, setPrice] = useState(initial?.price || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [saving, setSaving] = useState(false);
  async function submit() {
    if (!name.trim()) { showToast("Give this package a name.", "warn"); return; }
    if (!price || Number(price) <= 0) { showToast("Set a price.", "warn"); return; }
    if (type === "sessions" && (!sessions || Number(sessions) <= 0)) { showToast("Set how many sessions this pack includes.", "warn"); return; }
    setSaving(true);
    await onSave({ name: name.trim(), type, sessions: type === "sessions" ? Number(sessions) : null, price: Number(price), description: description.trim() });
    setSaving(false);
  }
  return (
    <Card style={{ display: "grid", gap: 10 }}>
      <div style={{ fontFamily: BRAND.display, fontSize: 18, fontWeight: 500 }}>{initial ? "Edit package" : "New package"}</div>
      <Field label="Package name" value={name} onChange={setName} placeholder="e.g. 8-Session Pack" />
      <div>
        {fieldLabel("Type")}
        <div style={{ display: "flex", gap: 8 }}>
          {[["sessions", "Session pack · in-person"], ["monthly", "Monthly · online"]].map(([k, label]) => (
            <button key={k} onClick={() => setType(k)} style={{ flex: 1, fontFamily: BRAND.sans, border: `${BRAND.hairline} solid ${type === k ? "transparent" : BRAND.line}`, background: type === k ? BRAND.btnBg : BRAND.card2, color: type === k ? BRAND.btnInk : BRAND.text, borderRadius: BRAND.radiusControl, padding: "10px 6px", fontWeight: 500, fontSize: 12, cursor: "pointer" }}>{label}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: type === "sessions" ? "1fr 1fr" : "1fr", gap: 10 }}>
        {type === "sessions" && <Field label="Sessions included" type="number" value={sessions} onChange={setSessions} placeholder="8" />}
        <Field label="Price (AED)" type="number" value={price} onChange={setPrice} placeholder="800" />
      </div>
      <Field label="Description (optional)" value={description} onChange={setDescription} textarea placeholder="What's included, validity, etc." />
      <div style={{ display: "flex", gap: 8 }}>
        <Button onClick={submit} disabled={saving} style={{ flex: 1 }}>{saving ? "Saving..." : initial ? "Save changes" : "Create package"}</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  );
}

function AssignRow({ pkg, clients, onAssign }) {
  const [clientId, setClientId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const eligible = clients.filter((c) => (pkg.type === "monthly" ? c.clientType === "Online" : c.clientType !== "Online"));
  async function submit() {
    if (!clientId) return;
    setAssigning(true);
    await onAssign(clients.find((c) => c.id === clientId));
    setAssigning(false);
    setClientId("");
  }
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, paddingTop: 10, borderTop: `${BRAND.hairline} solid ${BRAND.lineSoft}` }}>
      <select value={clientId} onChange={(e) => setClientId(e.target.value)} style={inputStyle({ maxWidth: 240, flex: 1 })}>
        <option value="">Assign to client...</option>
        {eligible.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <Button disabled={!clientId || assigning} onClick={submit}>{assigning ? "Assigning..." : "Assign"}</Button>
      {eligible.length === 0 && <div style={{ color: BRAND.dim, fontSize: 11, alignSelf: "center" }}>No {pkg.type === "monthly" ? "online" : "in-person"} clients yet.</div>}
    </div>
  );
}

export function PackageDesigner({ user, clients, updateClient, onBack }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { loadPackageCatalog(user.id).then((list) => { setPackages(list); setLoading(false); }); }, [user.id]);

  async function persist(next) {
    setPackages(next);
    await upsertTrainerData(user.id, "package_catalog", { packages: next });
  }

  async function createOrUpdate(fields) {
    if (editing) {
      await persist(packages.map((p) => (p.id === editing.id ? { ...p, ...fields } : p)));
      showToast("Package updated.", "success");
      setEditing(null);
    } else {
      await persist([{ id: uid(), ...fields, createdAt: new Date().toISOString() }, ...packages]);
      showToast("Package created.", "success");
    }
    setShowForm(false);
  }

  async function deletePackage(pkg) {
    if (!await confirmDialog(`Delete "${pkg.name}"? This only removes it from your package list - clients who already have it keep it.`, { danger: true, confirmLabel: "Delete" })) return;
    await persist(packages.filter((p) => p.id !== pkg.id));
  }

  async function assignToClient(pkg, client) {
    if (pkg.type === "monthly") {
      const nextProfile = { ...client.profile, price: pkg.price, paymentDueDate: isoDate(), paymentPaid: false };
      await upsertSection(client.id, "profile", nextProfile);
      updateClient({ ...client, ...nextProfile, profile: nextProfile });
      showToast(`"${pkg.name}" assigned to ${client.name} — ${moneyAED(pkg.price)}/mo, due today.`, "success");
    } else {
      const nextPackages = [{ id: uid(), name: pkg.name, total: pkg.sessions || 0, used: 0, price: pkg.price, paid: false }, ...(client.packages || [])];
      await upsertSection(client.id, "packages", nextPackages);
      updateClient({ ...client, packages: nextPackages });
      showToast(`"${pkg.name}" assigned to ${client.name}.`, "success");
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 14 }}>
      <Button variant="ghost" onClick={onBack} style={{ justifySelf: "start", padding: "8px 14px" }}>‹ Back</Button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontFamily: BRAND.display, fontSize: 24, fontWeight: 500, letterSpacing: "-0.01em" }}>Packages</div>
          <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 400, marginTop: 3 }}>Design the packages you offer, then assign them to clients in a tap.</div>
        </div>
        {!showForm && !editing && <Button onClick={() => setShowForm(true)}>+ New package</Button>}
      </div>

      {(showForm || editing) && <PackageForm initial={editing} onCancel={() => { setShowForm(false); setEditing(null); }} onSave={createOrUpdate} />}

      {loading && <Card><div style={{ color: BRAND.muted }}>Loading...</div></Card>}
      {!loading && packages.length === 0 && !showForm && (
        <Card>
          <div style={{ color: BRAND.text, fontWeight: 500, marginBottom: 6 }}>No packages yet</div>
          <div style={{ color: BRAND.muted, fontSize: 13, lineHeight: 1.55 }}>Create your standard offers here — session packs for in-person clients, monthly plans for online clients — then assign them to any client in one tap instead of typing the same price and sessions every time.</div>
        </Card>
      )}

      {packages.map((pkg) => (
        <Card key={pkg.id} style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 600, fontSize: 16, color: BRAND.text }}>{pkg.name}</div>
                <span style={{ background: pkg.type === "monthly" ? BRAND.blueBg : BRAND.greenBg, color: pkg.type === "monthly" ? BRAND.blue : BRAND.green, fontSize: 9, fontWeight: 600, borderRadius: 999, padding: "2px 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{pkg.type === "monthly" ? "Online · Monthly" : "In-person · Sessions"}</span>
              </div>
              <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 4 }}>
                {[pkg.type === "sessions" ? `${pkg.sessions} sessions` : "Renews monthly", `${moneyAED(pkg.price)}${pkg.type === "monthly" ? "/mo" : ""}`].join(" · ")}
              </div>
              {pkg.description && <div style={{ color: BRAND.dim, fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>{pkg.description}</div>}
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <Button variant="dark" onClick={() => setEditing(pkg)}>Edit</Button>
              <Button variant="red" onClick={() => deletePackage(pkg)}>Delete</Button>
            </div>
          </div>
          <AssignRow pkg={pkg} clients={clients} onAssign={(client) => assignToClient(pkg, client)} />
        </Card>
      ))}
    </div>
  );
}
