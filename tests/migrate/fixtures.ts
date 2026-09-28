import type { SupaState } from "./harness";

const bytes = (n: number, fill = 1) => new Uint8Array(n).fill(fill);

export function fixture(): SupaState {
  const clients = Array.from({ length: 5 }, (_, i) => ({
    id: `c${i + 1}`,
    trainer_id: "t1",
    client_user_id: i < 3 ? `u${i + 1}` : null,
    name: `Client ${i + 1}`,
    email: `client${i + 1}@example.com`,
    phone: null,
    age: 30 + i,
    weight_kg: "72.5",
    goal: "strength",
    injuries: "",
    photo: "",
    color: "#fff",
    invite_code: `INV${i + 1}`,
    invite_status: "accepted",
    created_at: "2026-08-01T10:00:00.123456+00:00",
    notes: `legacy note ${i + 1}`, // not in D1 -> clients.extra
  }));
  const clientData = clients.slice(0, 3).flatMap((c) => [
    { client_id: c.id, section: "profile", data: { paymentPaid: true, photo: "data:image/png;base64,AAAA" }, updated_at: "2026-09-01T08:00:00+00:00" },
    { client_id: c.id, section: "program", data: [{ day: 1, lifts: ["squat"] }], updated_at: "2026-09-02T08:00:00.5+00:00" },
  ]);
  return {
    tables: {
      trainers: [
        { id: "t1", email: "coach@example.com", name: "Denis", role: "Coach", phone: null, photo: "", created_at: "2026-07-01T00:00:00+00:00", bio: "hi" },
      ],
      clients,
      client_data: clientData,
      trainer_data: [{ trainer_id: "t1", section: "custom_exercise_library", data: { items: [{ id: "x", name: "Row" }] }, updated_at: "2026-09-03T00:00:00+00:00" }],
      health_screenings: [
        {
          id: "h1", client_id: "c1", screening_version: "v1", answers: { q1: true, q2: "no" }, needs_clearance: true,
          signed_name: "Client 1", signature_path: "c1/h1/signature.png", pdf_path: "c1/h1/screening.pdf",
          consents: ["terms", "privacy"], signed_at: "2026-08-27T09:00:00.999999+00:00",
        },
      ],
      buddy_pairs: [{ id: "p1", coach_id: "t1", name: "Pair A", slot_label: "Mon 7am", price: "120.50", created_at: "2026-08-30T12:00:00+00:00", updated_at: "2026-08-30T12:00:00+00:00" }],
      buddy_members: [
        { pair_id: "p1", client_id: "c1", joined_at: "2026-08-30T12:00:00+00:00" },
        { pair_id: "p1", client_id: "c2", joined_at: "2026-08-30T12:01:00+00:00" },
      ],
      exercise_library: [
        { id: "e1", name: "Back Squat", muscle_group: "Quads", movement_pattern: "Squat", coaching_cues: ["Brace", "Knees out", "Drive up"], needs_review: false, video_url: "https://v" },
        { id: "e2", name: "Row Machine", muscle_group: null, movement_pattern: null, coaching_cues: null, needs_review: true },
      ],
    },
    users: [
      { id: "t1", email: "coach@example.com", email_confirmed_at: "2026-07-01T00:00:00+00:00", user_metadata: { role: "trainer", name: "Denis" }, created_at: "2026-07-01T00:00:00+00:00", updated_at: "2026-07-01T00:00:00+00:00" },
      ...[1, 2, 3].map((i) => ({
        id: `u${i}`, email: `client${i}@example.com`, email_confirmed_at: i === 3 ? null : "2026-08-02T00:00:00+00:00",
        raw_user_meta_data: { role: "client", name: `Client ${i}` }, created_at: `2026-08-0${i}T00:00:00+00:00`, updated_at: "2026-08-05T00:00:00+00:00",
      })),
    ],
    buckets: {
      "client-photos": {
        "clients/c1/progress/a.jpg": { data: bytes(10), mimetype: "image/jpeg" },
        "clients/c1/progress/b.jpg": { data: bytes(20), mimetype: "image/jpeg" },
        "clients/c2/profile.jpg": { data: bytes(30), mimetype: "image/jpeg" },
        "clients/.emptyFolderPlaceholder": { data: bytes(0), mimetype: "text/plain" },
        "trainers/t1/me.jpg": { data: bytes(40), mimetype: "image/jpeg" },
      },
      "screening-documents": {
        "c1/h1/signature.png": { data: bytes(5), mimetype: "image/png" },
        "c1/h1/screening.pdf": { data: bytes(50), mimetype: "application/pdf" },
      },
    },
  };
}
