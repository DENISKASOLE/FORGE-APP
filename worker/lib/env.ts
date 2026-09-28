// Bindings and vars available to the Worker. Keep in sync with wrangler.jsonc.
export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  FILES: R2Bucket;
  AI_LIMITER: RateLimit;
  AUTH_LIMITER: RateLimit;
  API_LIMITER: RateLimit;

  APP_ENV: string;
  PAYPAL_ENV: string;
  GEMINI_MODEL: string;
  RESEND_FROM: string;
  COACH_EMAIL: string;
  MIGRATION_ENABLED: string;
  SUPABASE_URL: string;
  MAX_UPLOAD_BYTES: string;
  R2_SOFT_CAP_BYTES: string;

  GEMINI_API_KEY?: string;
  FATSECRET_CLIENT_ID?: string;
  FATSECRET_CLIENT_SECRET?: string;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_SECRET?: string;
  RESEND_API_KEY?: string;
  FILE_URL_SECRET?: string;
  MIGRATION_ADMIN_TOKEN?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;

  // Cutover route (migrate agent). Max password-setup emails per UTC day;
  // defaults to 90 to stay under Resend's free 100/day.
  MIGRATION_EMAIL_DAILY_MAX?: string;
}

// The authenticated caller. Shape mirrors the parts of a Supabase `User`
// the frontend reads (id, email, user_metadata), so the client shim can
// return it unchanged from auth.getUser()/getSession().
export interface AuthUser {
  id: string;
  email: string;
  email_verified: boolean;
  user_metadata: { name?: string; role?: string; [k: string]: unknown };
}

export type AppContext = {
  Bindings: Env;
  Variables: { user: AuthUser | null };
};
