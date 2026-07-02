import { createClient } from "@supabase/supabase-js";

// These come from your Vercel/Netlify environment variables (and .env.local
// when running locally). The anon key is safe to ship in the browser bundle.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabase = Boolean(url && key);
export const supabase = hasSupabase ? createClient(url, key) : null;
