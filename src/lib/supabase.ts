import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

/**
 * Browser Supabase client. The site remains fully static when the variables
 * are not configured; auth and other backend features simply stay disabled.
 */
export const supabase: SupabaseClient | null =
	supabaseUrl && supabaseAnonKey
		? createClient(supabaseUrl, supabaseAnonKey, {
				auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
			})
		: null;

export const isSupabaseConfigured: boolean = Boolean(supabase);
