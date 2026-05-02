import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

// Use environment variables if available, otherwise fallback to the JSON config
const meta = (import.meta as any) || {};
const env = meta.env || (typeof process !== 'undefined' ? process.env : {});
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || env.FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || env.FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || env.FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || env.FIREBASE_APP_ID || firebaseConfig.appId,
  firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || env.FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL || env.FIREBASE_DATABASE_URL || (firebaseConfig as any).databaseURL
};

const app = initializeApp(config);
export const auth = getAuth(app);
export const storage = getStorage(app);

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  experimentalAutoDetectLongPolling: false,
  // @ts-ignore
  useFetchStreams: false,
  host: "firestore.googleapis.com",
  ssl: true
}, config.firestoreDatabaseId || '(default)');

export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');
