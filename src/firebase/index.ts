"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

// Hooks
export { FirebaseProvider, useFirebase, useFirebaseApp, useFirestore, useAuth } from './provider';
export { FirebaseClientProvider } from './client-provider';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
export { useUser } from './auth/use-user';


let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

// This function should only be called on the client side.
function getFirebaseInstances() {
  if (typeof window !== "undefined") {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    auth = getAuth(app);
    firestore = getFirestore(app);
    return { app, auth, firestore };
  }
  // On the server, we return null instances.
  return { app: null, auth: null, firestore: null };
}


export { getFirebaseInstances };
