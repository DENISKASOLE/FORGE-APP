// Row-Level-Security equivalent for the /api/db query API. This file is the
// ONE place that decides who may read or write which rows.
//
// Model (same as Postgres RLS):
// - `select` / `delete` / update `using` are USING predicates: rows that
//   don't satisfy them simply don't match the statement.
// - `insert` and update `check` are WITH CHECK predicates on the NEW row:
//   a write that would produce a row failing them is rejected as a whole
//   with 42501 ("new row violates row-level security policy").
// - A missing policy means "denied" (predicate is FALSE).
//
// Each predicate is built for the caller from a column resolver `ref`, so
// the same rule works on the target table (ref = t.col), on proposed
// insert values (ref = v.col) and on post-update values (ref = new value
// if the column is being SET, else the existing column).
//
// Update rules are a list of permissive rules. Unlike Postgres, each rule
// can also restrict WHICH columns it lets you change, and a row passes only
// if a single rule satisfies both its USING (old row) and CHECK (new row).
// That is strictly tighter than Postgres' "OR all USINGs, OR all CHECKs".
//
// Provenance: health_screenings, buddy_pairs and buddy_members are ported
// verbatim from supabase/migrations. The v1 policies for clients, trainers,
// client_data, trainer_data and exercise_library are not in the repo, so
// the rules below are the tightest set that keeps every existing call site
// working (audited against src/ on 2026-09-28); reasoning is inline.
import type { AuthUser } from "./env";
import { type Frag, FALSE, TRUE, and, or, raw, sql } from "./db/sql";

export interface PolicyCtx {
  user: AuthUser;
  coachEmail: string;
}

export type Ref = (column: string) => Frag;
export type Predicate = (ref: Ref, ctx: PolicyCtx) => Frag;

export interface UpdateRule {
  name: string;
  /** If set, the rule only applies when every SET column is in this list. */
  onlyColumns?: readonly string[];
  /** If set, the rule never applies when a SET column is in this list. */
  denyColumns?: readonly string[];
  using: Predicate;
  check: Predicate;
}

export interface TablePolicy {
  select?: Predicate;
  insert?: Predicate;
  update?: readonly UpdateRule[];
  delete?: Predicate;
}

const uid = (ctx: PolicyCtx) => ctx.user.id;

/** The bootstrap coach: verified session whose email is env.COACH_EMAIL. */
export function isCoachAccount(ctx: PolicyCtx): boolean {
  const email = (ctx.user.email || "").trim().toLowerCase();
  const coach = (ctx.coachEmail || "").trim().toLowerCase();
  return !!coach && email === coach && ctx.user.email_verified === true;
}
const coachAccount = (ctx: PolicyCtx): Frag => (isCoachAccount(ctx) ? TRUE : FALSE);

// "Caller is the coach of, or is, client <clientIdRef>" - the ownership
// check v1 used on client_data, client-photos and health_screenings.
const coachOrSelfOfClient = (clientId: Frag, ctx: PolicyCtx): Frag =>
  sql`EXISTS (SELECT 1 FROM clients c WHERE c.id = ${clientId} AND (c.trainer_id = ${uid(ctx)} OR c.client_user_id = ${uid(ctx)}))`;

const selfOfClient = (clientId: Frag, ctx: PolicyCtx): Frag =>
  sql`EXISTS (SELECT 1 FROM clients c WHERE c.id = ${clientId} AND c.client_user_id = ${uid(ctx)})`;

const coachOfClient = (clientId: Frag, ctx: PolicyCtx): Frag =>
  sql`EXISTS (SELECT 1 FROM clients c WHERE c.id = ${clientId} AND c.trainer_id = ${uid(ctx)})`;

const ownsPair = (pairId: Frag, ctx: PolicyCtx): Frag =>
  sql`EXISTS (SELECT 1 FROM buddy_pairs p WHERE p.id = ${pairId} AND p.coach_id = ${uid(ctx)})`;

// trainer_data sections a CLIENT may read from their own coach. Audited
// client-reachable reads (everything else is coach-only UI):
// - articles: LearnTab.jsx (HomeLearnStrip on client Home, /learn tab)
// - checkin_template: CheckInsTab.jsx (client checkins / progress_hub)
// - custom_exercise_library: TrainScreens.jsx WorkoutSession (client workouts)
// NOT readable by clients: templates, trials, calendar, automations,
// package_catalog, foods, meal_presets, plan_templates,
// nutrition_studio_settings (all rendered only under isCoach / CoachDashboard).
export const CLIENT_READABLE_TRAINER_SECTIONS = ["articles", "checkin_template", "custom_exercise_library"] as const;

const sectionList = raw(CLIENT_READABLE_TRAINER_SECTIONS.map((s) => `'${s}'`).join(", "));

export const POLICIES: Record<string, TablePolicy> = {
  // clients
  // - select: the coach (trainer_id = uid) sees their roster; a client sees
  //   their own row (App.jsx loadRole). Nobody else sees anything.
  // - insert: coach only, for themself (CoachDashboard createClient /
  //   convertTrialToClient). client_user_id must be NULL: accounts are only
  //   linked through the claim RPCs, never by a coach naming a user id.
  // - update rules:
  //   coach: any column except id/client_user_id on their own clients, and
  //     trainer_id must stay theirs (cache.js updateClientRow: invite_code,
  //     invite_status, name, weight_kg).
  //   self: the client may change only name + weight_kg on their own row
  //     (ProfileTab autosave -> updateClientRow). The client /invite tab is
  //     only reachable by typing a URL, so invite_* is deliberately excluded.
  //   claim_orphans: App.jsx loadCoach runs
  //     `update clients set trainer_id = uid where trainer_id is null`; only
  //     the verified COACH_EMAIL account may adopt unowned rows.
  // - delete: coach only (ClientView delClient).
  clients: {
    select: (r, ctx) => or(sql`${r("trainer_id")} = ${uid(ctx)}`, sql`${r("client_user_id")} = ${uid(ctx)}`),
    insert: (r, ctx) => and(sql`${r("trainer_id")} = ${uid(ctx)}`, sql`${r("client_user_id")} IS NULL`),
    update: [
      {
        name: "coach",
        denyColumns: ["id", "client_user_id"],
        using: (r, ctx) => sql`${r("trainer_id")} = ${uid(ctx)}`,
        check: (r, ctx) => sql`${r("trainer_id")} = ${uid(ctx)}`,
      },
      {
        name: "self",
        onlyColumns: ["name", "weight_kg"],
        using: (r, ctx) => sql`${r("client_user_id")} = ${uid(ctx)}`,
        check: (r, ctx) => sql`${r("client_user_id")} = ${uid(ctx)}`,
      },
      {
        name: "claim_orphans",
        onlyColumns: ["trainer_id"],
        using: (r, ctx) => and(coachAccount(ctx), sql`${r("trainer_id")} IS NULL`),
        check: (r, ctx) => sql`${r("trainer_id")} = ${uid(ctx)}`,
      },
    ],
    delete: (r, ctx) => sql`${r("trainer_id")} = ${uid(ctx)}`,
  },

  // trainers
  // - select/update: own row only (App.jsx ensureTrainer/loadRole/loadCoach,
  //   CoachDashboard settings upsert). No client code reads the coach's row.
  // - insert: own row, and only for the verified COACH_EMAIL account
  //   (CONTRACTS: trainer rows exist only for the coach). Without this any
  //   signed-in user could insert a trainers row and be treated as a coach
  //   by loadRole. The upsert in CoachDashboard also passes this check.
  // - delete: never.
  trainers: {
    select: (r, ctx) => sql`${r("id")} = ${uid(ctx)}`,
    insert: (r, ctx) => and(coachAccount(ctx), sql`${r("id")} = ${uid(ctx)}`),
    update: [
      {
        name: "own",
        using: (r, ctx) => sql`${r("id")} = ${uid(ctx)}`,
        check: (r, ctx) => sql`${r("id")} = ${uid(ctx)}`,
      },
    ],
  },

  // client_data: full access for the client's coach and for the client
  // themself (v1 "client_data_trainer_or_client" pattern). The client's own
  // sections are written from many client screens via upsertSection.
  client_data: {
    select: (r, ctx) => coachOrSelfOfClient(r("client_id"), ctx),
    insert: (r, ctx) => coachOrSelfOfClient(r("client_id"), ctx),
    update: [
      {
        name: "coach_or_self",
        using: (r, ctx) => coachOrSelfOfClient(r("client_id"), ctx),
        check: (r, ctx) => coachOrSelfOfClient(r("client_id"), ctx),
      },
    ],
    delete: (r, ctx) => coachOrSelfOfClient(r("client_id"), ctx),
  },

  // trainer_data: full access for the owning trainer. A client may only
  // SELECT their own coach's rows, and only the sections listed in
  // CLIENT_READABLE_TRAINER_SECTIONS.
  trainer_data: {
    select: (r, ctx) =>
      or(
        sql`${r("trainer_id")} = ${uid(ctx)}`,
        and(
          sql`${r("section")} IN (${sectionList})`,
          sql`EXISTS (SELECT 1 FROM clients c WHERE c.client_user_id = ${uid(ctx)} AND c.trainer_id = ${r("trainer_id")})`,
        ),
      ),
    insert: (r, ctx) => sql`${r("trainer_id")} = ${uid(ctx)}`,
    update: [
      {
        name: "owner",
        using: (r, ctx) => sql`${r("trainer_id")} = ${uid(ctx)}`,
        check: (r, ctx) => sql`${r("trainer_id")} = ${uid(ctx)}`,
      },
    ],
    delete: (r, ctx) => sql`${r("trainer_id")} = ${uid(ctx)}`,
  },

  // health_screenings (v1 20260827084309): insert only for the client
  // themself; select by that client or their coach; append-only (no update
  // or delete for anyone).
  health_screenings: {
    select: (r, ctx) => coachOrSelfOfClient(r("client_id"), ctx),
    insert: (r, ctx) => selfOfClient(r("client_id"), ctx),
  },

  // buddy_pairs (v1 20260830120000 "buddy_pairs_owner"): coach only, FOR ALL.
  buddy_pairs: {
    select: (r, ctx) => sql`${r("coach_id")} = ${uid(ctx)}`,
    insert: (r, ctx) => sql`${r("coach_id")} = ${uid(ctx)}`,
    update: [
      {
        name: "owner",
        using: (r, ctx) => sql`${r("coach_id")} = ${uid(ctx)}`,
        check: (r, ctx) => sql`${r("coach_id")} = ${uid(ctx)}`,
      },
    ],
    delete: (r, ctx) => sql`${r("coach_id")} = ${uid(ctx)}`,
  },

  // buddy_members (v1 "buddy_members_via_pair_owner"): USING = caller owns
  // the pair; CHECK = caller owns the pair AND the client is theirs. The
  // client-side partner lookup in BuddyPairs.jsx markBuddyPairPaid was
  // blocked by this in v1 and stays blocked (returns no rows).
  buddy_members: {
    select: (r, ctx) => ownsPair(r("pair_id"), ctx),
    insert: (r, ctx) => and(ownsPair(r("pair_id"), ctx), coachOfClient(r("client_id"), ctx)),
    update: [
      {
        name: "via_pair_owner",
        using: (r, ctx) => ownsPair(r("pair_id"), ctx),
        check: (r, ctx) => and(ownsPair(r("pair_id"), ctx), coachOfClient(r("client_id"), ctx)),
      },
    ],
    delete: (r, ctx) => ownsPair(r("pair_id"), ctx),
  },

  // exercise_library: shared reference data, readable by any signed-in user
  // (TrainScreens useExerciseLibrary / useExerciseTaxonomyMap, both coach and
  // client). No writes through the API (seeded by migration).
  exercise_library: {
    select: () => TRUE,
  },
};

export function policyFor(table: string): TablePolicy {
  return Object.hasOwn(POLICIES, table) ? POLICIES[table] : {};
}

/** Update rules that may change exactly this set of columns. */
export function applicableUpdateRules(table: string, setColumns: readonly string[]): UpdateRule[] {
  return (policyFor(table).update || []).filter(
    (rule) =>
      (!rule.onlyColumns || setColumns.every((c) => rule.onlyColumns!.includes(c))) &&
      (!rule.denyColumns || !setColumns.some((c) => rule.denyColumns!.includes(c))),
  );
}
