// STUB - replaced by files agent
// Contract: R2 object helpers. The R2 key is `<bucket>/<path>`.
import type { Env } from "../env";

export async function putObject(
  env: Env,
  bucket: string,
  path: string,
  body: ReadableStream | ArrayBuffer,
  contentType: string,
  _size: number,
  _ownerUserId?: string | null,
): Promise<void> {
  await env.FILES.put(`${bucket}/${path}`, body, { httpMetadata: { contentType } });
}

export async function headObject(
  env: Env,
  bucket: string,
  path: string,
): Promise<{ size: number } | null> {
  const obj = await env.FILES.head(`${bucket}/${path}`);
  return obj ? { size: obj.size } : null;
}
