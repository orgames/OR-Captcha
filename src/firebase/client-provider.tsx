"use client";

import React from 'react';
import { getFirebaseInstances } from './index';
import { FirebaseProvider } from './provider';

export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // We are calling this on the client, so we can be sure the instances are valid.
  const { app, auth, firestore } = getFirebaseInstances();

  return (
    <FirebaseProvider app={app} auth={auth} firestore={firestore}>
      {children}
    </FirebaseProvider>
  );
}
