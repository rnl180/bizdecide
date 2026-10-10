import { App, cert, getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let app: App | undefined;

function getApp(): App {
  if (app) return app;
  if (getApps().length) return (app = getApps()[0]!);

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (b64) {
    const sa = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    app = initializeApp({ credential: cert(sa), projectId: sa.project_id, storageBucket });
  } else {
    // Firebase App Hosting / Google Cloud: credentials come from the environment.
    app = initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID, storageBucket });
  }
  return app;
}

let firestore: Firestore | undefined;
export function db(): Firestore {
  if (!firestore) {
    firestore = getFirestore(getApp());
    firestore.settings({ ignoreUndefinedProperties: true });
  }
  return firestore;
}

export function bucket() {
  return getStorage(getApp()).bucket();
}

export const col = {
  businesses: () => db().collection("businesses"),
  requests: () => db().collection("requests"),
  questions: () => db().collection("questions"),
  results: () => db().collection("results"),
};

export const now = () => new Date().toISOString();
