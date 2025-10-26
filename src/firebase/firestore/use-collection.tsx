"use client";

import { useState, useEffect, useMemo } from 'react';
import {
  onSnapshot,
  query,
  collection,
  where,
  limit,
  orderBy,
  startAt,
  endAt,
  type Firestore,
  type CollectionReference,
  type DocumentData,
  type Query,
} from 'firebase/firestore';
import { useFirestore } from '../provider';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';
import { useAuth } from '../provider';

type QueryOptions = {
  where?: [string, '==', any];
  limit?: number;
  orderBy?: [string, 'asc' | 'desc'];
  startAt?: any;
  endAt?: any;
};

export function useCollection<T extends DocumentData>(
  path: string | null, // Allow path to be null
  options?: QueryOptions
): { data: T[] | null; loading: boolean } {
  const firestore = useFirestore();
  const auth = useAuth();
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);

  const collectionRef = useMemo(
    () => (firestore && path ? collection(firestore, path) : null),
    [firestore, path]
  );

  const queryRef = useMemo(() => {
    if (!collectionRef) return null;
    let q: Query = collectionRef;
    if (options?.where) q = query(q, where(...options.where));
    if (options?.orderBy) q = query(q, orderBy(...options.orderBy));
    if (options?.startAt) q = query(q, startAt(options.startAt));
    if (options?.endAt) q = query(q, endAt(options.endAt));
    if (options?.limit) q = query(q, limit(options.limit));
    return q;
  }, [collectionRef, options]);


  useEffect(() => {
    if (!queryRef || !collectionRef) {
      setLoading(false);
      setData(null);
      return;
    }

    const unsubscribe = onSnapshot(
      queryRef,
      (snapshot) => {
        const result: T[] = [];
        snapshot.forEach((doc) => {
          result.push({ id: doc.id, ...doc.data() } as T);
        });
        setData(result);
        setLoading(false);
      },
      async (error) => {
        const permissionError = new FirestorePermissionError({
          path: (collectionRef as CollectionReference).path,
          operation: 'list',
        }, auth?.currentUser ?? null);
        errorEmitter.emit('permission-error', permissionError);
        console.error(`Error fetching collection ${path}:`, error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [queryRef, collectionRef, path, auth]);

  return { data, loading };
}
