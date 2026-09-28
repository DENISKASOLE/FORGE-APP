// Storage access rules, ported 1:1 from the v1 Supabase storage.objects
// policies:
//   supabase/migrations/20260826110550_client_photos_bucket_trainer_path.sql
//   supabase/migrations/20260827084309_health_screenings.sql
//
// client-photos (select/insert/update/delete all share one rule):
//   clients/{clientId}/...  -> clients row exists AND (trainer_id = uid OR
//                              client_user_id = uid OR trainer_id IS NULL)
//   trainers/{trainerId}/.. -> trainerId = uid
// screening-documents:
//   insert: {clientId}/...  -> client_user_id = uid
//   select: {clientId}/...  -> client_user_id = uid OR trainer_id = uid
//   update/delete: no v1 policy -> always denied (append-only audit trail)
//
// storage.foldername(name) only returns *folders*, so every rule needs the
// object to sit below the id folder (e.g. "clients/{id}/x.jpg", never
// "clients/{id}").
import type { Bucket } from "./config";

export type FileAction = "read" | "insert" | "update" | "delete";

export interface ClientOwnership {
  trainer_id: string | null;
  client_user_id: string | null;
}

export async function findClientOwnership(db: D1Database, clientId: string): Promise<ClientOwnership | null> {
  return db
    .prepare("SELECT trainer_id, client_user_id FROM clients WHERE id = ?")
    .bind(clientId)
    .first<ClientOwnership>();
}

function clientPhotosRule(c: ClientOwnership, uid: string): boolean {
  // v1 also granted access when the client has no trainer assigned.
  return c.trainer_id === uid || c.client_user_id === uid || c.trainer_id === null;
}

function screeningRule(c: ClientOwnership, uid: string, action: FileAction): boolean {
  if (action === "insert") return c.client_user_id === uid;
  if (action === "read") return c.client_user_id === uid || c.trainer_id === uid;
  return false;
}

export async function canAccess(
  db: D1Database,
  uid: string,
  bucket: Bucket,
  segments: string[],
  action: FileAction,
): Promise<boolean> {
  if (!uid) return false;
  if (bucket === "client-photos") {
    if (segments.length < 3) return false;
    const [scope, id] = segments;
    if (scope === "trainers") return id === uid;
    if (scope !== "clients") return false;
    const owner = await findClientOwnership(db, id);
    return !!owner && clientPhotosRule(owner, uid);
  }
  if (bucket === "screening-documents") {
    if (segments.length < 2) return false;
    if (action === "update" || action === "delete") return false;
    const owner = await findClientOwnership(db, segments[0]);
    return !!owner && screeningRule(owner, uid, action);
  }
  return false;
}
