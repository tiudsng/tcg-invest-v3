import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';
import axios from 'axios';
import fs from 'fs';

import serviceAccount from '../serviceAccountKey.json';

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: 'gen-lang-client-0326385388.firebasestorage.app'
});

const db = getFirestore('ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b');
const bucket = getStorage().bucket();

async function run() {
  const docId = 'snkrdunk_724996';
  const imageUrl = 'https://www.pokemon-card.com/assets/images/card_images/large/M2a/050000_P_MGENGAEX.jpg';

  console.log(`Downloading ${imageUrl}...`);
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const imgBuffer = Buffer.from(response.data, 'binary');

  console.log('Converting to WebP...');
  const webpBuffer = await sharp(imgBuffer)
    .webp({ quality: 85 })
    .toBuffer();

  const tmpPath = `/tmp/${docId}.webp`;
  fs.writeFileSync(tmpPath, webpBuffer);

  const destination = `card_images/${docId}.webp`;
  console.log(`Uploading to ${destination}...`);
  await bucket.upload(tmpPath, {
    destination: destination,
    metadata: {
      contentType: 'image/webp'
    }
  });

  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;
  console.log(`Uploaded! URL: ${publicUrl}`);

  await db.collection('products').doc(docId).update({
    image_url: publicUrl,
    updatedAt: FieldValue.serverTimestamp()
  });

  console.log('Updated firestore.');
}

run().catch(console.error);
