"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { doc, onSnapshot, type DocumentData } from 'firebase/firestore';
import { useFirestore } from '../provider';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';
import { useAuth } from '../provider';

export function useDoc<T extends DocumentData>(
  path: string | null
): { data: T | null; loading: boolean; refetch: () => void; } {
  const firestore = useFirestore();
  const auth = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  const docRef = useMemo(() => (firestore && path ? doc(firestore, path) : null), [firestore, path]);

  const subscribe = useCallback(() => {
    if (!docRef) {
        setLoading(false);
        setData(null);
        return () => {};
    }
    const unsubscribe = onSnapshot(
      docRef,
      (doc) => {
        if (doc.exists()) {
          setData({ id: doc.id, ...doc.data() } as T);
        } else {
          setData(null);
        }
        setLoading(false);
      },
      async(error) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'get',
        }, auth?.currentUser ?? null);
        errorEmitter.emit('permission-error', permissionError);
        console.error(`Error fetching document ${path}:`, error);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [docRef, path, auth]);

  useEffect(() => {
    const unsubscribe = subscribe();
    return () => unsubscribe();
  }, [subscribe]);
  
  const refetch = () => {
      setLoading(true);
      const unsubscribe = subscribe();
      return () => unsubscribe();
  }

  return { data, loading, refetch };
}
