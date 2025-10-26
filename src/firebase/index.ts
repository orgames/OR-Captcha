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

if (getApps().length) {
  app = getApp();
} else {
  app = initializeApp(firebaseConfig);
}

auth = getAuth(app);
firestore = getFirestore(app);

export { app, auth, firestore };
