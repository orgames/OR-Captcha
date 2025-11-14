
"use client";

import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useAuth } from '../provider';
import { doc, setDoc, getDoc, runTransaction } from 'firebase/firestore';
import { useFirestore } from '../provider';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';
import { format } from "date-fns";

type UseUserReturn = {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
};

export function useUser(): UseUserReturn {
  const auth = useAuth();
  const firestore = useFirestore();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
       setUser(user);
       setLoading(false);
    });

    return () => unsubscribe();
  }, [auth]);


  const logout = useCallback(async () => {
    if (auth) {
      await signOut(auth);
    }
  }, [auth]);

  useEffect(() => {
    const handleUserChange = async (user: User | null) => {
        if (!user || !firestore || !auth) return;

        const userRef = doc(firestore, 'users', user.uid);
        const today = format(new Date(), 'yyyy-MM-dd');
        
        try {
          await runTransaction(firestore, async (transaction) => {
            const userDoc = await transaction.get(userRef);

            const updates: any = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
            };
            
            if (!userDoc.exists()) {
              updates.coinBalance = 0;
              updates.spinsToday = 0;
              updates.lastSpinDate = today;
              updates.scratchesToday = 0;
              updates.lastScratchDate = today;
              transaction.set(userRef, updates);
            } else {
              const userData = userDoc.data();
               if (userData.lastSpinDate !== today) {
                updates.spinsToday = 0;
                updates.lastSpinDate = today;
              }
              if (userData.lastScratchDate !== today) {
                updates.scratchesToday = 0;
                updates.lastScratchDate = today;
              }
              transaction.update(userRef, updates);
            }
          });
        } catch (error) {
           const permissionError = new FirestorePermissionError({
            path: userRef.path,
            operation: 'get',
          }, auth.currentUser);
          errorEmitter.emit('permission-error', permissionError);
        }
    }
    
    if (user) {
        handleUserChange(user);
    }

  }, [user, auth, firestore]);

  return { user, loading, logout };
}
