import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { BRAND } from "../../theme/tokens.js";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Field, inputStyle } from "../../components/ui/Field.jsx";
import { useIsMobile } from "../../lib/browser.js";
import { showToast } from "../../components/ui/Toast.jsx";
import { confirmDialog } from "../../components/ui/ConfirmDialog.jsx";
import { upsertSection } from "../../lib/clientData.js";
import { isoDate } from "../../lib/dateUtils.js";
import { ProgramTab } from "../train/TrainScreens.jsx";
import { ClientAvatar } from "../client-shell/ClientShellUI.jsx";

async function loadBuddyPairs(coachId) {
  const { data, error } = await supabase
    .from("buddy_pairs")
    .select("*, buddy_members(client_id, joined_at)")
    .eq("coach_id", coachId)
    .order("created_at", { ascending: false });
  if (error) { showToast(error.message || "Couldn't load buddy pairs.", "error"); return []; }
  return data || [];
}

// Fans a shared payment status out to the other member of clientId's buddy
// pair (if any), reusing the exact per-client profile fields/call
// PaymentsTab already uses for a single client - see DECISIONS.md "Billing:
// grouped over the existing PayPal flow". Self-contained (only needs a
// client id and reads the partner's current profile fresh from the
// database) so it can be called from anywhere a client's own paymentPaid
// just flipped to true, including PaymentsTab.jsx, which only ever has one
// client in scope and no access to the full clients array.
export async function markBuddyPairPaid(clientId) {
  const { data: membership } = await supabase.from("buddy_members").select("pair_id").eq("client_id", clientId).maybeSingle();
  if (!membership) return null;
  const { data: partnerRow } = await supabase.from("buddy_members").select("client_id").eq("pair_id", membership.pair_id).neq("client_id", clientId).maybeSingle();
  if (!partnerRow) return null;
  const partnerId = partnerRow.client_id;
  const { data: profileRow } = await supabase.from("client_data").select("data").eq("client_id", partnerId).eq("section", "profile").maybeSingle();
  const currentProfile = profileRow?.data || {};
  const nextDue = new Date(); nextDue.setDate(nextDue.getDate() + 30);
  const nextProfile = { ...currentProfile, paymentPaid: true, paymentDueDate: isoDate(nextDue), lastPaidAt: new Date().toISOString() };
  await upsertSection(partnerId, "profile", nextProfile);
  return partnerId;
}

function fieldLabel(text) {
  return <div style={{ color: BRAND.muted, fontSize: 11, fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.14em" }}>{text}</div>;
}

function BuddyPairForm({ clients, pairedClientIds, onCancel, onCreate }) {
  const [name, setName] = useState("");
  const [slotLabel, setSlotLabel] = useState("");
  const [price, setPrice] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [saving, setSaving] = useState(false);
  const available = clients.filter((c) => !pairedClientIds.has(c.id));
  async function submit() {
    if (!a || !b) { showToast("Pick two clients for this pair.", "warn"); return; }
    if (a === b) { showToast("Pick two different clients.", "warn"); return; }
    setSaving(true);
    await onCreate({ name: name.trim(), slotLabel: slotLabel.trim(), price: price ? Number(price) : null, memberIds: [a, b] });
    setSaving(false);
  }
  return (
    <Card style={{ display: "grid", gap: 10 }}>
      <div style={{ fontFamily: BRAND.display, fontSize: 18, fontWeight: 500 }}>New buddy pair</div>
      <Field label="Pair name (optional)" value={name} onChange={setName} placeholder="e.g. Ken & Sam" />
      <Field label="Slot label" value={slotLabel} onChange={setSlotLabel} placeholder="e.g. Tue 6pm" />
      <Field label="Shared monthly price (optional)" value={price} onChange={setPrice} type="number" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label>
          {fieldLabel("Member 1")}
          <select value={a} onChange={(e) => setA(e.target.value)} style={inputStyle()}>
            <option value="">Choose client...</option>
            {available.map((c) => <option key={c.id} value={c.id} disabled={c.id === b}>{c.name}</option>)}
          </select>
        </label>
        <label>
          {fieldLabel("Member 2")}
          <select value={b} onChange={(e) => setB(e.target.value)} style={inputStyle()}>
            <option value="">Choose client...</option>
            {available.map((c) => <option key={c.id} value={c.id} disabled={c.id === a}>{c.name}</option>)}
          </select>
        </label>
      </div>
      {available.length < 2 && <div style={{ color: BRAND.yellow, fontSize: 12 }}>You need at least two clients who aren't already in a pair.</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <Button onClick={submit} disabled={saving} style={{ flex: 1 }}>{saving ? "Creating..." : "Create pair"}</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  );
}

function SwapMemberRow({ clients, pairedClientIds, currentClientId, onSwap, onCancel }) {
  const [next, setNext] = useState("");
  const available = clients.filter((c) => c.id === currentClientId || !pairedClientIds.has(c.id));
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
      <select value={next} onChange={(e) => setNext(e.target.value)} style={inputStyle({ maxWidth: 220, flex: 1 })}>
        <option value="">Swap in...</option>
        {available.filter((c) => c.id !== currentClientId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <Button disabled={!next} onClick={() => onSwap(next)}>Swap</Button>
      <Button variant="ghost" onClick={onCancel}>Cancel</Button>
    </div>
  );
}

function PairPriceRow({ pair, onSetPrice }) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(pair.price || "");
  const [saving, setSaving] = useState(false);
  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", color: BRAND.gold, fontFamily: BRAND.sans, fontWeight: 500, fontSize: 12, cursor: "pointer", padding: 0 }}>
        {pair.price ? `Shared price: $${pair.price}/mo · edit` : "Set shared price"}
      </button>
    );
  }
  async function submit() {
    setSaving(true);
    await onSetPrice(Number(price) || null);
    setSaving(false);
    setEditing(false);
  }
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
      <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="Monthly price" style={inputStyle({ maxWidth: 140, fontSize: 13, padding: "8px 10px" })} />
      <Button disabled={saving} onClick={submit} style={{ fontSize: 12, padding: "8px 14px" }}>{saving ? "Saving..." : "Send to both"}</Button>
      <Button variant="ghost" onClick={() => setEditing(false)} style={{ fontSize: 12, padding: "8px 14px" }}>Cancel</Button>
    </div>
  );
}

export function BuddyPairsScreen({ user, clients, updateClient, onBack }) {
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [swapping, setSwapping] = useState(null); // { pairId, clientId }
  const [openPairId, setOpenPairId] = useState(null);

  async function reload() { setPairs(await loadBuddyPairs(user.id)); setLoading(false); }
  useEffect(() => { reload(); }, [user.id]);

  const pairedClientIds = new Set(pairs.flatMap((p) => p.buddy_members.map((m) => m.client_id)));
  function clientFor(id) { return clients.find((c) => c.id === id); }
  function clientName(id) { return clientFor(id)?.name || "Unknown"; }

  async function createPair({ name, slotLabel, price, memberIds }) {
    const { data: pair, error } = await supabase.from("buddy_pairs").insert({ coach_id: user.id, name: name || null, slot_label: slotLabel || null, price }).select().single();
    if (error) { showToast(error.message || "Couldn't create the pair.", "error"); return; }
    const { error: memErr } = await supabase.from("buddy_members").insert(memberIds.map((id) => ({ pair_id: pair.id, client_id: id })));
    if (memErr) {
      showToast(memErr.message || "Couldn't add both members - the pair was not created.", "error");
      await supabase.from("buddy_pairs").delete().eq("id", pair.id);
      return;
    }
    showToast("Buddy pair created.", "success");
    setShowForm(false);
    await reload();
  }

  async function deletePair(pair) {
    const label = pair.name || pair.buddy_members.map((m) => clientName(m.client_id)).join(" & ");
    if (!await confirmDialog(`Delete "${label}"? Both clients keep their own programs, logs, and payment history - only the pairing itself is removed.`, { danger: true, confirmLabel: "Delete" })) return;
    const { error } = await supabase.from("buddy_pairs").delete().eq("id", pair.id);
    if (error) { showToast(error.message, "error"); return; }
    if (openPairId === pair.id) setOpenPairId(null);
    await reload();
  }

  async function swapMember(pair, oldClientId, newClientId) {
    const { error: delErr } = await supabase.from("buddy_members").delete().eq("pair_id", pair.id).eq("client_id", oldClientId);
    if (delErr) { showToast(delErr.message, "error"); return; }
    const { error } = await supabase.from("buddy_members").insert({ pair_id: pair.id, client_id: newClientId });
    if (error) { showToast(error.message || "Couldn't swap that member in.", "error"); return; }
    showToast("Member swapped.", "success");
    setSwapping(null);
    await reload();
  }

  async function setSharedPrice(pair, price) {
    const { error } = await supabase.from("buddy_pairs").update({ price }).eq("id", pair.id);
    if (error) { showToast(error.message, "error"); return; }
    const dueDate = isoDate();
    for (const m of pair.buddy_members) {
      const client = clientFor(m.client_id);
      if (!client) continue;
      const nextProfile = { ...client.profile, price, paymentDueDate: dueDate, paymentPaid: false };
      await upsertSection(client.id, "profile", nextProfile);
      updateClient?.({ ...client, ...nextProfile, profile: nextProfile });
    }
    showToast(price ? "Shared price sent to both members." : "Shared price cleared.", "success");
    await reload();
  }

  const openPair = openPairId ? pairs.find((p) => p.id === openPairId) : null;
  if (openPair) {
    return <BuddyPairSlotView pair={openPair} clients={clients} updateClient={updateClient} onBack={() => setOpenPairId(null)} />;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 14 }}>
      <Button variant="ghost" onClick={onBack} style={{ justifySelf: "start", padding: "8px 14px" }}>‹ Back</Button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontFamily: BRAND.display, fontSize: 24, fontWeight: 500, letterSpacing: "-0.01em" }}>Buddy Pairs</div>
          <div style={{ color: BRAND.muted, fontSize: 13, fontWeight: 400, marginTop: 3 }}>Two clients, one shared slot - training and payment stay grouped, progress stays personal.</div>
        </div>
        {!showForm && <Button onClick={() => setShowForm(true)}>+ New pair</Button>}
      </div>

      {showForm && <BuddyPairForm clients={clients} pairedClientIds={pairedClientIds} onCancel={() => setShowForm(false)} onCreate={createPair} />}

      {loading && <Card><div style={{ color: BRAND.muted }}>Loading...</div></Card>}
      {!loading && pairs.length === 0 && !showForm && (
        <Card>
          <div style={{ color: BRAND.text, fontWeight: 500, marginBottom: 6 }}>No buddy pairs yet</div>
          <div style={{ color: BRAND.muted, fontSize: 13, lineHeight: 1.55 }}>Create one when two clients share a 1:1 slot. Their programs, logs, and check-ins stay completely separate - only the slot and (optionally) the payment are shared.</div>
        </Card>
      )}

      {pairs.map((pair) => {
        const memberIds = pair.buddy_members.map((m) => m.client_id);
        const label = pair.name || memberIds.map(clientName).join(" & ");
        return (
          <Card key={pair.id} style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 16, color: BRAND.text }}>{label}</div>
                {pair.slot_label && <div style={{ color: BRAND.muted, fontSize: 12, marginTop: 3 }}>{pair.slot_label}</div>}
                <PairPriceRow pair={pair} onSetPrice={(price) => setSharedPrice(pair, price)} />
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <Button onClick={() => setOpenPairId(pair.id)} disabled={memberIds.length < 2}>Open slot</Button>
                <Button variant="red" onClick={() => deletePair(pair)}>Delete</Button>
              </div>
            </div>
            <div style={{ display: "grid", gap: 8, marginTop: 12, paddingTop: 12, borderTop: `${BRAND.hairline} solid ${BRAND.lineSoft}` }}>
              {memberIds.map((id) => {
                const c = clientFor(id);
                const isSwapping = swapping?.pairId === pair.id && swapping?.clientId === id;
                return (
                  <div key={id}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        {c && <ClientAvatar client={c} size={30} />}
                        <span style={{ fontWeight: 500, fontSize: 13, color: BRAND.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c?.name || "Unknown client"}</span>
                      </div>
                      {!isSwapping && <button onClick={() => setSwapping({ pairId: pair.id, clientId: id })} style={{ background: "none", border: "none", color: BRAND.muted, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>Swap</button>}
                    </div>
                    {isSwapping && (
                      <SwapMemberRow
                        clients={clients}
                        pairedClientIds={pairedClientIds}
                        currentClientId={id}
                        onCancel={() => setSwapping(null)}
                        onSwap={(newId) => swapMember(pair, id, newId)}
                      />
                    )}
                  </div>
                );
              })}
              {memberIds.length < 2 && <div style={{ color: BRAND.yellow, fontSize: 12 }}>Missing a member - swap or delete and recreate this pair.</div>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function BuddyPairSlotView({ pair, clients, updateClient, onBack }) {
  const isMobile = useIsMobile(760);
  const members = pair.buddy_members.map((m) => clients.find((c) => c.id === m.client_id)).filter(Boolean);
  const label = pair.name || members.map((m) => m.name).join(" & ");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 14 }}>
      <Button variant="ghost" onClick={onBack} style={{ justifySelf: "start", padding: "8px 14px" }}>‹ Back to Buddy Pairs</Button>
      <div>
        <div style={{ fontFamily: BRAND.display, fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em", color: BRAND.text }}>{label}</div>
        {pair.slot_label && <div style={{ color: BRAND.gold, fontSize: 13, fontWeight: 500, marginTop: 2 }}>{pair.slot_label}</div>}
      </div>
      {members.length < 2 && <Card><div style={{ color: BRAND.yellow }}>This pair is missing a member. Go back to Buddy Pairs to swap one in.</div></Card>}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, alignItems: "start" }}>
        {members.map((m) => (
          <div key={m.id} style={{ display: "grid", gap: 10, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, background: BRAND.bg, paddingBottom: 4, zIndex: 1 }}>
              <ClientAvatar client={m} size={36} />
              <div style={{ fontWeight: 600, fontSize: 15, color: BRAND.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
            </div>
            <ProgramTab client={m} updateClient={updateClient} isCoach />
          </div>
        ))}
      </div>
    </div>
  );
}
