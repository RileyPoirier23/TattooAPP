import { createClient } from '@supabase/supabase-js';

// FIX: Changed from import.meta.env to process.env to resolve TypeScript error. Assuming build process handles environment variables.
const supabaseUrl = process.env.VITE_SUPABASE_URL;
// FIX: Changed from import.meta.env to process.env to resolve TypeScript error. Assuming build process handles environment variables.
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and Anon Key must be provided in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);