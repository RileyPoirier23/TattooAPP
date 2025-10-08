// @/services/authService.ts

import { users as seedUsers } from '../data/seed';
import type { User, AuthCredentials, RegisterDetails } from '../types';

const USER_STORAGE_KEY = 'inkspace_user';

class AuthService {
    private users: User[];

    constructor() {
        // In a real app, this would be an API call. Here we load from our seed file.
        this.users = [...seedUsers];
    }

    getCurrentUser(): User | null {
        try {
            const storedUser = localStorage.getItem(USER_STORAGE_KEY);
            return storedUser ? JSON.parse(storedUser) : null;
        } catch (error) {
            console.error("Failed to parse user from localStorage", error);
            return null;
        }
    }
    
    login(credentials: AuthCredentials): Promise<User> {
        return new Promise((resolve, reject) => {
            setTimeout(() => { // Simulate network delay
                const user = this.users.find(u => u.username === credentials.username);

                if (user && user.password === credentials.password) {
                    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
                    resolve(user);
                } else {
                    reject(new Error("Invalid username or password."));
                }
            }, 500);
        });
    }

    register(details: RegisterDetails): Promise<User> {
        return new Promise((resolve, reject) => {
            setTimeout(() => { // Simulate network delay
                const userExists = this.users.some(u => u.username === details.username);
                if (userExists) {
                    return reject(new Error("Username already exists."));
                }

                let newUser: User;
                const newId = `user-${Date.now()}`;

                if (details.type === 'artist') {
                    newUser = {
                        id: newId,
                        username: details.username,
                        password: details.password,
                        type: 'artist',
                        data: {
                            id: newId,
                            name: details.name,
                            city: details.city,
                            specialty: 'New Artist',
                            bio: 'Just getting started, excited to create!',
                            portfolio: ['https://images.pexels.com/photos/1269968/pexels-photo-1269968.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'],
                        },
                    };
                } else if (details.type === 'client') {
                     newUser = {
                        id: newId,
                        username: details.username,
                        password: details.password,
                        type: 'client',
                        data: { name: details.name },
                    };
                } else { // shop-owner
                     newUser = {
                        id: newId,
                        username: details.username,
                        password: details.password,
                        type: 'shop-owner',
                        data: {
                            id: newId,
                            name: details.name,
                            shopId: null, // They would create/link a shop after registration
                        },
                    };
                }
                
                this.users.push(newUser); // Add to our in-memory user list
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
                resolve(newUser);
            }, 500);
        });
    }

    logout(): Promise<void> {
        return new Promise((resolve) => {
             localStorage.removeItem(USER_STORAGE_KEY);
             resolve();
        });
    }
}

export const authService = new AuthService();