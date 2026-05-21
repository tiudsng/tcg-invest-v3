import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import axios from 'axios';
import fs from 'fs';

import serviceAccount from '../serviceAccountKey.json';

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount),
  storageBucket: 'gen-lang-client-0326385388.firebasestorage.app'
});

const db = getFirestore();
const bucket = getStorage().bucket();

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateMissingImages() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  // Find products that need an update. We limit to 240/193 for testing.
  const snapshot = await db.collection('products').where('card_number', '==', '240/193').get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const cardNumber = data.card_number; // "240/193"
    // Extract Japanese name. Usually it's in data.name_jp or data.name
    // In our DB it might be something like "MEGA Gengar ex SAR" or "メガゲンガーex"
    let jpName = data.name_jp || data.name; 
    
    // For 240/193 testing, we force it to Japanese name if it's not clear.
    if (cardNumber === '240/193') {
        jpName = 'メガゲンガーex';
    }

    console.log(`Processing ${doc.id} - ${cardNumber} with keyword: ${jpName}`);

    try {
      // 1. Search using keyword
      const searchUrl = `https://www.pokemon-card.com/card-search/index.php?keyword=${encodeURIComponent(jpName)}&sm_and_keyword=true`;
      console.log(`Navigating to ${searchUrl}`);
      await page.goto(searchUrl, { waitUntil: 'load', timeout: 60000 });
      
      // 2. Wait for JS
      await delay(3000);

      // 3. Click the first card
      // We look for a link that has details.php/card/
      const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
          .map(a => a.href)
          .filter(h => h.includes('details.php/card/'));
      });

      if (links.length === 0) {
        console.log(`No search results found for ${jpName}`);
        continue;
      }
      
      console.log(`Found detail link: ${links[0]}`);
      await page.goto(links[0], { waitUntil: 'load', timeout: 60000 });
      await delay(2000);

      // 4. Get the image URL
      const imageUrls = await page.evaluate(() => {
        const imgs = document.querySelectorAll('img');
        return Array.from(imgs).filter(i => i.src.includes('card_images')).map(i => i.src);
      });

      if (imageUrls.length === 0) {
        console.log(`No image found on detail page for ${jpName}`);
        continue;
      }

      const imageUrl = imageUrls[0];
      console.log(`Found image URL: ${imageUrl}`);

      // 5. Download the image
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imgBuffer = Buffer.from(response.data, 'binary');

      // 6. Convert to WebP 
      const webpBuffer = await sharp(imgBuffer)
        .webp({ quality: 85 })
        .toBuffer();

      const tmpPath = `/tmp/${doc.id}.webp`;
      fs.writeFileSync(tmpPath, webpBuffer);

      // 7. Upload to Firebase Storage
      const destination = `card_images/${doc.id}.webp`;
      console.log(`Uploading to Firebase Storage at ${destination}...`);
      await bucket.upload(tmpPath, {
        destination: destination,
        metadata: {
          contentType: 'image/webp'
        }
      });

      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;
      console.log(`Generated public URL: ${publicUrl}`);

      // 8. Update Firestore
      await db.collection('products').doc(doc.id).update({
        image_url: publicUrl,
        updatedAt: FieldValue.serverTimestamp()
      });

      console.log(`Document ${doc.id} successfully updated!`);

    } catch (err) {
      console.error(`Error processing ${doc.id}: ${err.message}`);
    }
  }

  await browser.close();
}

updateMissingImages().catch(console.error);
