"use client";

import React from 'react';
import { app, auth, firestore } from './index';
import { FirebaseProvider } from './provider';

export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FirebaseProvider app={app} auth={auth} firestore={firestore}>
      {children}
    </FirebaseProvider>
  );
}
