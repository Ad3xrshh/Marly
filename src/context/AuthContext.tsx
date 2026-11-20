import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { useToast } from './ToastContext';

interface AuthContextValue {
  user: User | null;
  isAuthLoading: boolean;
  isSigningIn: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<boolean>;
  signOutUser: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { pushToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsAuthLoading(false);
      setAuthError(null);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const credential = await signInWithPopup(auth, googleAuthProvider);
      pushToast({
        title: 'Signed in to Marly',
        description: credential.user.email || credential.user.displayName || 'Google account connected.',
        variant: 'success',
      });
      return true;
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return false;
      }
      const message =
        error instanceof Error ? error.message : 'Unable to sign in with Google right now.';
      setAuthError(message);
      pushToast({
        title: 'Sign-in could not complete',
        description: 'Check popup permissions and try signing in again.',
        variant: 'info',
      });
      return false;
    } finally {
      setIsSigningIn(false);
    }
  }, [pushToast]);

  const signOutUser = useCallback(async () => {
    try {
      await signOut(auth);
      pushToast({
        title: 'Signed out',
        description: 'Your saved tasks remain safely stored in your account.',
        variant: 'info',
      });
    } catch (error) {
      console.error('Sign-out failed:', error);
      pushToast({
        title: 'Unable to sign out',
        description: 'Please try again in a moment.',
        variant: 'info',
      });
    }
  }, [pushToast]);

  const getAccessToken = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) return null;
    return current.getIdToken();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthLoading,
        isSigningIn,
        authError,
        signInWithGoogle,
        signOutUser,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
