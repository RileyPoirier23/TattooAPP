
// @/services/authService.ts
import { getSupabase } from './supabaseClient';
import type { User, AuthCredentials, RegisterDetails, AdminUser } from '../types';
import { adaptSupabaseProfileToUser } from './dataAdapters';
import type { Session } from '@supabase/supabase-js';

const USER_STORAGE_KEY = 'inkspace_user_session';

// This promise resolves once the Supabase client has confirmed the initial session,
// preventing race conditions on app load. It fires only once.
const initialSessionPromise: Promise<Session | null> = new Promise((resolve) => {
    try {
        const supabase = getSupabase();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'INITIAL_SESSION') {
                subscription.unsubscribe();
                resolve(session);
            }
        });
    } catch (e) {
        // If Supabase isn't configured, resolve with null to allow the app to load in a logged-out state.
        resolve(null);
    }
});


class AuthService {
    
    async getCurrentUser(): Promise<User | null> {
        try {
            // Dev admin session is local only, check first
            const cachedUser = localStorage.getItem(USER_STORAGE_KEY);
            if(cachedUser) {
                const parsed = JSON.parse(cachedUser);
                if (parsed.type === 'admin') return parsed as AdminUser;
            }
            
            // Wait for the stable, initial session state before proceeding.
            const session = await initialSessionPromise;

            if (!session) {
                localStorage.removeItem(USER_STORAGE_KEY);
                return null;
            }

            // If we have a valid session, let's re-fetch the profile to ensure data is fresh.
            // This prevents stale data from being used if it was changed in another tab/session.
            const user = await this.getUserProfile(session.user.id);
            if(user) {
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
            } else {
                // If profile fetch fails, clear local session to prevent being logged in with no data
                localStorage.removeItem(USER_STORAGE_KEY);
            }
            return user;

        } catch (error) {
            console.error("Error getting current user:", error);
            localStorage.removeItem(USER_STORAGE_KEY);
            return null;
        }
    }

    async login(credentials: AuthCredentials): Promise<User> {
        // DEV ADMIN LOGIN: Use a non-email username to prevent collision with actual Supabase users.
        if (credentials.email === '__admin__' && credentials.password === 'root') {
            const adminUser: AdminUser = {
                id: 'admin-dev',
                email: '__admin__', // This is just an identifier, not a real email
                type: 'admin',
                data: { name: 'Admin' }
            };
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(adminUser));
            return adminUser;
        }

        const supabase = getSupabase();
        const { error } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password!,
        });
        if (error) throw error;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Could not retrieve user after login.");
        
        const profile = await this.getUserProfile(user.id);
        if (!profile) throw new Error("User profile not found. If you just registered, please check your email for a confirmation link.");

        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
        return profile;
    }

    async register(details: RegisterDetails): Promise<User | null> {
        const supabase = getSupabase();

        // The user's role and other details are passed as metadata to the signUp function.
        // A database trigger will use this metadata to create the public profile automatically and securely.
        const signUpOptions = {
            data: {
                full_name: details.name,
                role: details.type,
                city: (details.type === 'artist' || details.type === 'dual') ? details.city : undefined,
            }
        };

        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: details.email,
            password: details.password!,
            options: signUpOptions
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error("Registration succeeded but no user was returned.");

        // If a session is returned, it means email confirmation is likely disabled, and the user is logged in.
        // We can proceed to fetch their newly created profile.
        if (authData.session) {
            const newUser = await this.getUserProfile(authData.user.id);
            if (!newUser) {
                throw new Error("Profile creation failed automatically. Please try logging in or contact support.");
            }
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
            return newUser;
        } 
        
        // If no session is returned, it means email confirmation is required.
        // We return NULL to indicate success but no active session.
        else {
            return null;
        }
    }

    async logout(): Promise<void> {
        try {
            const supabase = getSupabase();
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
        } catch (e) {
            console.warn("Could not sign out from Supabase, probably due to missing config. Clearing local session only.");
        }
        localStorage.removeItem(USER_STORAGE_KEY);
    }

    async getUserProfile(userId: string): Promise<User | null> {
        const supabase = getSupabase();
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !profile) {
            console.error("Error fetching profile for user:", userId, error);
            return null;
        }

        let shopId: string | null = null;
        if (profile.role === 'shop-owner') {
             const { data: ownerShop, error: shopError } = await supabase.from('shops').select('id').eq('owner_id', profile.id).single();
            if (shopError && shopError.code !== 'PGRST116') { // Ignore 'exact one row not found' errors
                console.warn("Could not fetch shop for owner", shopError);
            }
            shopId = ownerShop?.id || null;
        }
        
        return adaptSupabaseProfileToUser(profile, shopId);
    }
}

export const authService = new AuthService();
