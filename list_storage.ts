import { initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

// In AI studio environment, the admin SDK should be configured automatically.
initializeApp();

const bucket = getStorage().bucket("gen-lang-client-0326385388.firebasestorage.app");

async function listFiles() {
  try {
    const [files] = await bucket.getFiles();
    console.log('Files in bucket:');
    if (files.length === 0) {
        console.log('Bucket holds no files.');
    }
    files.forEach(file => {
      console.log(file.name);
    });
  } catch (e) {
    console.error('Error listing files:', e);
  }
}

listFiles().catch(console.error);
