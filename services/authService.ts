// @/services/authService.ts
import { getSupabase } from './supabaseClient';
import type { User, AuthCredentials, RegisterDetails, Artist, Client, ShopOwner, UserRole, AdminUser, Admin } from '../types';

const USER_STORAGE_KEY = 'inkspace_user_session';

class AuthService {
    
    async getCurrentUser(): Promise<User | null> {
        try {
            // Dev admin session is local only, check first
            const cachedUser = localStorage.getItem(USER_STORAGE_KEY);
            if(cachedUser) {
                const parsed = JSON.parse(cachedUser);
                if (parsed.type === 'admin') return parsed as AdminUser;
            }
            
            // If supabase is not configured, we can't get a remote user. Return null.
            // This is a safe check before calling getSupabase() which would throw
            try {
                getSupabase();
            } catch (e) {
                return null;
            }

            const supabase = getSupabase();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                localStorage.removeItem(USER_STORAGE_KEY);
                return null;
            }

            if(cachedUser) {
                const parsed = JSON.parse(cachedUser);
                if (parsed.id === session.user.id) return parsed;
            }

            const user = await this.getUserProfile(session.user.id);
            if(user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
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
        if (!profile) throw new Error("User profile not found.");

        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile));
        return profile;
    }

    async register(details: RegisterDetails): Promise<User> {
        const supabase = getSupabase();
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: details.email,
            password: details.password!,
            options: {
                data: {
                    full_name: details.name,
                }
            }
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error("Registration succeeded but no user returned.");

        const profileData: { [key: string]: any } = {
            id: authData.user.id,
            username: details.email,
            full_name: details.name,
            role: details.type,
            is_verified: false, // New users are now unverified by default
        };

        if (details.type === 'artist' || details.type === 'dual') {
            profileData.city = details.city || null;
            profileData.specialty = 'New Artist';
            profileData.bio = `An artist based in ${details.city || 'a new city'}.`;
            profileData.portfolio = [];
        }

        const { error: profileError } = await supabase.from('profiles').insert(profileData);
        if (profileError) {
            // Attempt to clean up the auth user if profile creation fails
            // This is an advanced operation and might require admin privileges.
            console.error("Failed to create user profile:", profileError);
            throw new Error(`User created, but profile setup failed. Please contact support. Error: ${profileError.message}`);
        }
        
        const newUser = await this.getUserProfile(authData.user.id);
        if (!newUser) throw new Error("Could not retrieve new user profile after registration.");
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
        return newUser;
    }

    async logout(): Promise<void> {
        try {
            const supabase = getSupabase();
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
        } catch (e) {
            // If getSupabase throws, it means we weren't configured anyway, so logout is a no-op.
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
            console.error("Error fetching profile:", error);
            return null;
        }

        const baseUser = {
            id: profile.id,
            email: profile.username, // DB username is email
            type: profile.role as UserRole,
        };
        
        switch (profile.role) {
            case 'artist':
            case 'dual':
                return { ...baseUser, type: profile.role, data: { id: profile.id, name: profile.full_name, city: profile.city, specialty: profile.specialty, bio: profile.bio, portfolio: profile.portfolio, isVerified: profile.is_verified, socials: profile.socials, hourlyRate: profile.hourly_rate } as Artist };
            case 'client':
                return { ...baseUser, type: 'client', data: { id: profile.id, name: profile.full_name } as Client };
            case 'shop-owner':
                const { data: ownerShop, error: shopError } = await supabase.from('shops').select('id').eq('owner_id', profile.id).single();
                if (shopError && shopError.code !== 'PGRST116') { // Ignore 'exact one row not found' errors
                    console.warn("Could not fetch shop for owner", shopError);
                }
                return { ...baseUser, type: 'shop-owner', data: { id: profile.id, name: profile.full_name, shopId: ownerShop?.id || null } as ShopOwner };
            default:
                return null;
        }
    }
}

export const authService = new AuthService();
