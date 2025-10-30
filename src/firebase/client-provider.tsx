"use client";

import React, { useState, useEffect } from 'react';
import { getFirebaseInstances } from './index';
import { FirebaseProvider } from './provider';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ app, auth, firestore }, setFirebase] = useState<{
    app: FirebaseApp | null;
    auth: Auth | null;
    firestore: Firestore | null;
  }>({ app: null, auth: null, firestore: null });

  useEffect(() => {
    // getFirebaseInstances should only be called on the client.
    const instances = getFirebaseInstances();
    setFirebase(instances);
  }, []);

  // While firebase is initializing, we can show a loader or null.
  // This prevents children from trying to access firebase context before it's ready.
  if (!app || !auth || !firestore) {
    return null;
  }

  return (
    <FirebaseProvider app={app} auth={auth} firestore={firestore}>
      {children}
    </FirebaseProvider>
  );
}
