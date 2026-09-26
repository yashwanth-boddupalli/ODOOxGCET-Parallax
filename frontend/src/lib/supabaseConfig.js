// The project URL and *publishable* key are meant to be public: they ship to every
// browser anyway, and Row Level Security in the database decides what each user
// may read or change. They are committed on purpose so a Vercel build works with
// no dashboard setup. Env vars override them (e.g. for a staging project).
// Never put the secret / service_role key here.
// Plain constants (no import.meta) so the dev-server assistant can import them too.
export const DEFAULT_SUPABASE_URL = 'https://jfbrettpstcrbdjvcpkb.supabase.co';
export const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_wIbELG51VoP8kCd-wbsbKg_WrPBcYQC';
