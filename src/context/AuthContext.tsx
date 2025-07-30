import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from '../services/StorageKeys';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  name: string;
  email: string;
  avatar?: string; // Optional avatar URL
  streak?: number; // Optional streak count
}

interface AuthContextType {
  isSignedIn: boolean;
  user: AuthUser | null;
  /** Returns true on success, false if validation fails. */
  signIn: (name: string, email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextType>(null!);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(StorageKeys.AUTH).then((json) => {
      if (json) setUser(JSON.parse(json));
    });
  }, []);

  const signIn = async (name: string, email: string, avatar?: string): Promise<void> => {
    const newUser: AuthUser = { name: name.trim(), email: email.trim(), avatar };
    await AsyncStorage.setItem(StorageKeys.AUTH, JSON.stringify(newUser));
    setUser(newUser);
  };

  const signOut = async (): Promise<void> => {
    await AsyncStorage.removeItem(StorageKeys.AUTH);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isSignedIn: user !== null, user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth() {
  return useContext(AuthContext);
}
