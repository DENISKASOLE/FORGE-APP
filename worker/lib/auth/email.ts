// STUB - replaced by auth agent
// Contract: sends the "set your password" email to a migrated user who has
// no password in v2 yet. The real implementation (auth agent) creates a
// single-use token and sends it through Resend.
import type { Env } from "../env";

export async function sendPasswordSetupEmail(
  _env: Env,
  _user: { id: string; email: string; user_metadata?: any },
  _origin: string,
): Promise<void> {
  throw new Error("sendPasswordSetupEmail is not implemented yet (auth agent stub)");
}
