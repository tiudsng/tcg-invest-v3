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

// CRITICAL: Set the project ID in the environment so the underlying gRPC clients 
// for Firestore/Auth use the correct target project instead of the host project.
if (projectId) {
  process.env.GOOGLE_CLOUD_PROJECT = projectId;
  console.log(`[FirebaseAdmin] GOOGLE_CLOUD_PROJECT set to: ${projectId}`);
}

console.log(`[FirebaseAdmin] Attempting to initialize for Project: ${projectId}, Database: ${databaseId}`);

if (!admin.apps.length) {
  try {
    // Rely on environment variables (GOOGLE_APPLICATION_CREDENTIALS) 
    // which are automatically set in this environment. 
    admin.initializeApp({
      projectId: projectId
    });
    console.log(`[FirebaseAdmin] SDK Initialized for ${projectId}`);
  } catch (error) {
    console.error(`[FirebaseAdmin] Init error:`, error);
  }
}

// Ensure we target the right database instance
export const adminDb = getFirestore(admin.app(), databaseId);
export const adminAuth = admin.auth();

console.log(`[FirebaseAdmin] Firestore Instance created for Database: ${databaseId}`);
