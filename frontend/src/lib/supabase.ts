import { createClient } from "@supabase/supabase-js";

// Fallback placeholders prevent createClient() from throwing during Next.js
// build-time module import. Real values from env vars are used at runtime.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
