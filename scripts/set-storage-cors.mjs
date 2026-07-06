import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Storage } from "@google-cloud/storage";

const serviceAccountPath = join(process.cwd(), "menu3d-qr-firebase-adminsdk-fbsvc-e667f4402f.json");
let serviceAccount;

try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
} catch (error) {
  console.error(`Error: Could not read service account key at ${serviceAccountPath}. Make sure the file exists.`);
  process.exit(1);
}

const storage = new Storage({
  projectId: serviceAccount.project_id,
  credentials: {
    client_email: serviceAccount.client_email,
    private_key: serviceAccount.private_key
  }
});

// Allow passing bucket name as command line argument, e.g. node scripts/set-storage-cors.mjs my-bucket.appspot.com
const argBucket = process.argv[2];
const envBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const defaultBuckets = ["menu3d-qr.appspot.com", "menu3d-qr.firebasestorage.app"];

const bucketNames = argBucket 
  ? [argBucket] 
  : (envBucket ? [envBucket] : defaultBuckets);

async function configureCors() {
  console.log("Checking storage buckets for CORS configuration...");
  let configuredAny = false;

  for (const name of bucketNames) {
    if (!name || name === "dummy-storage-bucket.appspot.com" || name === "-") {
      continue;
    }
    
    try {
      const bucket = storage.bucket(name);
      const [exists] = await bucket.exists();
      
      if (exists) {
        console.log(`- Found active bucket: ${name}`);
        const corsConfiguration = [
          {
            origin: ["*"],
            method: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
            responseHeader: ["*"],
            maxAgeSeconds: 3600
          }
        ];
        await bucket.setCorsConfiguration(corsConfiguration);
        console.log(`  ✓ CORS configuration set successfully on ${name}!`);
        configuredAny = true;
      } else {
        console.log(`- Bucket ${name} does not exist.`);
      }
    } catch (error) {
      console.error(`  ✗ Error configuring ${name}:`, error.message);
    }
  }

  if (!configuredAny) {
    console.log("\n[WARNING] No active storage buckets were found and configured.");
    console.log("Please ensure you have clicked 'Get Started' under the 'Storage' tab in the Firebase Console:");
    console.log("https://console.firebase.google.com/project/menu3d-qr/storage");
    console.log("\nOnce enabled, run this script with your bucket name, for example:");
    console.log("node scripts/set-storage-cors.mjs <your-bucket-name>.appspot.com");
  }
}

configureCors();
