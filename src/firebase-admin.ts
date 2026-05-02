// src/firebase-admin.ts
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

// Load config manually to be absolutely sure in all environments (Node/TSX)
let firebaseConfig: any = {};
try {
  const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
} catch (e) {
  console.error("[FirebaseAdmin] Failed to read config file:", e);
}

const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
const projectId = firebaseConfig.projectId;

if (!admin.apps.length) {
  try {
    // Attempt to initialize using ADC (Application Default Credentials)
    // but specify projectId if we have it from config.
    admin.initializeApp({
      projectId: projectId
    });
    console.log(`[FirebaseAdmin] SDK Initialized. Project: ${admin.app().options.projectId || 'Auto-detected'}`);
  } catch (error) {
    console.error(`[FirebaseAdmin] Init error:`, error);
  }
}

// Ensure we target the right database instance
export const adminDb = getFirestore(admin.app(), databaseId);
export const adminAuth = admin.auth();

console.log(`[FirebaseAdmin] Firestore Instance created for Database: ${databaseId}`);
