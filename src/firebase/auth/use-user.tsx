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
    
    if (user) {
        handleUserChange(user);
    }

  }, [user, auth, firestore]);

  return { user, loading, logout };
}
