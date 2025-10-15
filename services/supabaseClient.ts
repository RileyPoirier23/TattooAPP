
import { createClient } from '@supabase/supabase-js';

// FIX: Cast `import.meta` to `any` to resolve TypeScript error regarding the 'env' property.
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
// FIX: Cast `import.meta` to `any` to resolve TypeScript error regarding the 'env' property.
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and Anon Key must be provided in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
