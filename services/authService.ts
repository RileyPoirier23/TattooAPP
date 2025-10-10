// @/services/authService.ts
import { supabase } from './supabaseClient';
import type { User, AuthCredentials, RegisterDetails, Artist, Client, ShopOwner, UserRole, AdminUser, Admin } from '../types';

const USER_STORAGE_KEY = 'inkspace_user_session';

class AuthService {
    
    async getCurrentUser(): Promise<User | null> {
        try {
            // Dev admin session is local only
            const cachedUser = localStorage.getItem(USER_STORAGE_KEY);
            if(cachedUser) {
                const parsed = JSON.parse(cachedUser);
                if (parsed.type === 'admin') return parsed as AdminUser;
            }
            
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
        const { error } = await supabase.auth.signOut();
        localStorage.removeItem(USER_STORAGE_KEY);
        if (error) throw error;
    }

    async getUserProfile(userId: string): Promise<User | null> {
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
                return { ...baseUser, type: profile.role, data: { id: profile.id, name: profile.full_name, city: profile.city, specialty: profile.specialty, bio: profile.bio, portfolio: profile.portfolio, isVerified: profile.is_verified } as Artist };
            case 'client':
                return { ...baseUser, type: 'client', data: { id: profile.id, name: profile.full_name } as Client };
            case 'shop-owner':
                 // This assumes shopId is managed elsewhere, e.g., on the shops table
                return { ...baseUser, type: 'shop-owner', data: { id: profile.id, name: profile.full_name, shopId: null } as ShopOwner };
            default:
                return null;
        }
    }
}

export const authService = new AuthService();