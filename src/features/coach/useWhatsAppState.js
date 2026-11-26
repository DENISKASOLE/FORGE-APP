// Messages settings + sent/skipped log, shared by the Home card and the
// Messages screen. Stored in trainer_data section "whatsapp".
import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient.js";
import { upsertTrainerData } from "../../lib/clientData.js";
import { pruneDone } from "../../lib/whatsappQueue.js";

export function useWhatsAppState(trainerId) {
  const [state, setState] = useState(null); // { settings, done }
  useEffect(() => {
    let active = true;
    if (!trainerId) return undefined;
    supabase.from("trainer_data").select("data").eq("trainer_id", trainerId).eq("section", "whatsapp").maybeSingle()
      .then(({ data }) => { if (active) setState({ settings: data?.data?.settings || {}, done: data?.data?.done || {} }); })
      .catch(() => { if (active) setState({ settings: {}, done: {} }); });
    return () => { active = false; };
  }, [trainerId]);
  function save(next) {
    const clean = { settings: next.settings, done: pruneDone(next.done) };
    setState(clean);
    upsertTrainerData(trainerId, "whatsapp", clean).catch(() => {});
  }
  return [state, save];
}

