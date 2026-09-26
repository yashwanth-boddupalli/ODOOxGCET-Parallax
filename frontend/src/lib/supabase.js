import { createClient } from '@supabase/supabase-js';

// The project URL and *publishable* key are meant to be public: they ship to every
// browser anyway, and Row Level Security in the database decides what each user
// may read or change. They are committed on purpose so a Vercel build works with
// no dashboard setup. Env vars override them (e.g. for a staging project).
// Never put the secret / service_role key here.
const DEFAULT_SUPABASE_URL = 'https://hxmrleteuapahkrldzii.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_X54oh5rB0N-EjaBsFH5Rww_LEMOhoIw';

const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
