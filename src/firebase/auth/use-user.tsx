"use client";

import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useAuth } from '../provider';
import { doc, setDoc } from 'firebase/firestore';
import { useFirestore } from '../provider';

type UseUserReturn = {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
};

export function useUser(): UseUserReturn {
  const auth = useAuth();
  const firestore = useFirestore();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, [auth]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Create or update user profile in Firestore
        const userRef = doc(firestore, 'users', user.uid);
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        }, { merge: true });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, firestore]);

  return { user, loading, logout };
}
