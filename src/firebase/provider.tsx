"use client";

import React, { createContext, useContext } from 'react';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

type FirebaseContextValue = {
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
};

const FirebaseContext = createContext<FirebaseContextValue>({
  app: null,
  auth: null,
firestore: null,
});

type FirebaseProviderProps = {
  children: React.ReactNode;
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
};

export function FirebaseProvider({ children, app, auth, firestore }: FirebaseProviderProps) {
  return (
    <FirebaseContext.Provider value={{ app, auth, firestore }}>
      {children}
      <FirebaseErrorListener />
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  return useContext(FirebaseContext);
}

export function useFirebaseApp(): FirebaseApp {
  const context = useContext(FirebaseContext);
  if (!context.app) {
    throw new Error('useFirebaseApp must be used within a FirebaseProvider');
  }
  return context.app;
}

export function useFirestore(): Firestore {
  const context = useContext(FirebaseContext);
  if (!context.firestore) {
    throw new Error('useFirestore must be used within a FirebaseProvider');
  }
  return context.firestore;
}

export function useAuth(): Auth {
  const context = useContext(FirebaseContext);
  if (!context.auth) {
    throw new Error('useAuth must be used within a FirebaseProvider');
  }
  return context.auth;
}
