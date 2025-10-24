// @/services/supabaseClient.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// These are now cached here after the first call.
let supabase: SupabaseClient | null = null;
let supabaseInitializationError: string | null = null;

/**
 * Initializes the Supabase client. This function is called only once.
 */
function initializeSupabase() {
    // Prevent re-initialization
    if (supabase || supabaseInitializationError) {
        return;
    }

    // Use Vite's standard method for accessing environment variables on the client.
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        supabaseInitializationError = 'Supabase configuration is missing. Please provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file. Refer to README.md for setup instructions.';
        console.error(supabaseInitializationError);
        return;
    }

    try {
        supabase = createClient(supabaseUrl, supabaseAnonKey);
    } catch (e) {
        const message = e instanceof Error ? e.message : 'An unknown error occurred during Supabase client creation.';
        supabaseInitializationError = `Failed to initialize Supabase client: ${message}`;
        console.error(supabaseInitializationError);
        supabase = null;
    }
}

/**
 * A getter function that ensures the Supabase client is initialized and returns it.
 * This should be called by any function that needs to interact with Supabase.
 * It centralizes the initialization check and ensures a consistent, informative error is thrown if misconfigured.
 * @returns The Supabase client instance.
 * @throws An error if the Supabase client failed to initialize.
 */
export const getSupabase = (): SupabaseClient => {
    if (!supabase && !supabaseInitializationError) {
        initializeSupabase();
    }
    
    if (supabaseInitializationError) {
        throw new Error(supabaseInitializationError);
    }
    if (!supabase) {
        // This case should ideally not be reached if the logic is sound.
        throw new Error("Supabase client is not available for an unknown reason.");
    }

    return supabase;
};
