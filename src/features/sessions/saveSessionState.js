import { showToast } from "../../components/ui/Toast.jsx";
import { upsertSection } from "../../lib/clientData.js";

// Saves whatever changed (packages and/or ledger) and updates the screen.
export async function saveSessionState(prev, next, updateClient) {
  updateClient?.(next);
  try {
    const jobs = [upsertSection(next.id, "session_ledger", next.sessionLedger)];
    if (next.packages !== prev.packages) jobs.push(upsertSection(next.id, "packages", next.packages));
    await Promise.all(jobs);
  } catch {
    showToast("Saved on this device - will sync when you're online", "info");
  }
}

