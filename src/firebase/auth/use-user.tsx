
"use client";

import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useAuth } from '../provider';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { useFirestore } from '../provider';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

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
    // onAuthStateChanged can take a null auth object, but it will just never fire.
    // So we can set up the listener immediately.
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
        
        try {
          const userDoc = await getDoc(userRef);
          
          const userData: {
            uid: string;
            email: string | null;
            displayName: string | null;
            photoURL: string | null;
            spinsToday?: number;
            spinsCooldownEnd?: Timestamp;
            scratchesToday?: number;
            scratchesCooldownEnd?: Timestamp;
            coinBalance?: number;
          } = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          };

          if (!userDoc.exists()) {
            const pastDate = Timestamp.fromDate(new Date(0));
            userData.coinBalance = 0;
            userData.spinsToday = 0;
            userData.spinsCooldownEnd = pastDate;
            userData.scratchesToday = 0;
            userData.scratchesCooldownEnd = pastDate;
            
            setDoc(userRef, userData, { merge: true }).catch((serverError) => {
              const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'create',
                requestResourceData: userData,
              }, auth.currentUser);
              errorEmitter.emit('permission-error', permissionError);
            });
          } else {
            // Ensure existing users have the new fields if they are missing
            const existingData = userDoc.data();
            const updates: any = {};
            if (!('spinsToday' in existingData) || !('spinsCooldownEnd' in existingData)) {
                updates.spinsToday = 0;
                updates.spinsCooldownEnd = Timestamp.fromDate(new Date(0));
            }
            if (!('scratchesToday' in existingData) || !('scratchesCooldownEnd' in existingData)) {
                updates.scratchesToday = 0;
                updates.scratchesCooldownEnd = Timestamp.fromDate(new Date(0));
            }
            // Add core user data to the updates
            updates.uid = user.uid;
            updates.email = user.email;
            updates.displayName = user.displayName;
            updates.photoURL = user.photoURL;

            if (Object.keys(updates).length > 4) { // more than just the base user data
                setDoc(userRef, updates, { merge: true }).catch((serverError) => {
                   const permissionError = new FirestorePermissionError({
                    path: userRef.path,
                    operation: 'update',
                    requestResourceData: updates,
                  }, auth.currentUser);
                  errorEmitter.emit('permission-error', permissionError);
                });
            }
          }
        } catch (error) {
          // This will catch errors from getDoc if it fails due to permissions
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
