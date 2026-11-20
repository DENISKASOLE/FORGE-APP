// Coach's first name for client-facing text ("Coach Denis").
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient.js";

export function useCoachName(trainerId) {
  const [name, setName] = useState("");
  useEffect(() => {
    let off = false;
    if (!trainerId) return undefined;
    supabase.from("trainers").select("name").eq("id", trainerId).maybeSingle().then(({ data }) => {
      if (!off && data?.name) setName(String(data.name).trim().split(/\s+/)[0]);
    }, () => {});
    return () => { off = true; };
  }, [trainerId]);
  return name;
}
