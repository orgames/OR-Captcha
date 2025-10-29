"use client";

import React from 'react';
import { getFirebaseInstances } from './index';
import { FirebaseProvider } from './provider';

export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { app, auth, firestore } = getFirebaseInstances();

  return (
    <FirebaseProvider app={app} auth={auth} firestore={firestore}>
      {children}
    </FirebaseProvider>
  );
}
