"use client";

import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useAuth } from '../provider';
import { doc, setDoc, getDoc } from 'firebase/firestore';
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
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    if (auth) {
      await signOut(auth);
    }
  }, [auth]);

  useEffect(() => {
    if (!auth || !firestore) {
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userRef = doc(firestore, 'users', user.uid);
        
        try {
          const userDoc = await getDoc(userRef);
          
          const userData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          };

          if (!userDoc.exists()) {
            const data = { ...userData, coinBalance: 0 };
            setDoc(userRef, data, { merge: true }).catch((serverError) => {
              const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'create',
                requestResourceData: data,
              }, auth.currentUser);
              errorEmitter.emit('permission-error', permissionError);
            });
          } else {
            setDoc(userRef, userData, { merge: true }).catch((serverError) => {
               const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: userData,
              }, auth.currentUser);
              errorEmitter.emit('permission-error', permissionError);
            });
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
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, firestore]);

  return { user, loading, logout };
}
