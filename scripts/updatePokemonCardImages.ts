import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import axios from 'axios';
import fs from 'fs';

import serviceAccount from '../serviceAccountKey.json';

// Initialize Firebase Admin (Make sure your environment has GOOGLE_APPLICATION_CREDENTIALS set or similar for Cloud Storage)
initializeApp({
  credential: cert(serviceAccount),
  storageBucket: 'gen-lang-client-0326385388.firebasestorage.app'
});

const db = getFirestore('ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b');
const bucket = getStorage().bucket();

async function updateMissingImages() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  // Find products that are missing images or need an update (example query)
  // For the test, we only pick 240/193
  const snapshot = await db.collection('products').where('snkrdunk_id', '==', '93021').get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const cardNumber = data.card_number; // e.g., "240/193"
    const jpName = data.name_jp || data.name; // Use Japanese name if available

    console.log(`Processing ${doc.id} - ${cardNumber}`);

    try {
      // 1. Search in pokemon-card.com
      let keyword = cardNumber;
      let searchUrl = `https://www.pokemon-card.com/card-search/index.php?keyword=${encodeURIComponent(keyword)}&sm_and_keyword=true`;
      await page.goto(searchUrl, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 2000));

      let links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
          .map(a => a.href)
          .filter(h => h.includes('details.php/card/'));
      });

      if (links.length === 0 && jpName) {
        console.log(`No search results found for ${keyword}, trying ${jpName}`);
        keyword = jpName.split(':')[0].trim(); // Take the name part before SA suffix if any
        searchUrl = `https://www.pokemon-card.com/card-search/index.php?keyword=${encodeURIComponent(keyword)}&sm_and_keyword=true`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 2000));
        links = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a'))
            .map(a => a.href)
            .filter(h => h.includes('details.php/card/'));
        });
      }

      if (links.length === 0) {
        console.log(`No search results found for ${cardNumber}`);
        continue;
      }

      await page.goto(links[0], { waitUntil: 'networkidle2' });

      // 4. Get the image URL from the detail page
      const imageUrls = await page.evaluate(() => {
        const imgs = document.querySelectorAll('img');
        return Array.from(imgs).filter(i => i.src.includes('card_images')).map(i => i.src);
      });

      if (imageUrls.length === 0) {
        console.log(`No image found on detail page for ${cardNumber}`);
        continue;
      }

      const imageUrl = imageUrls[0];
      console.log(`Found image: ${imageUrl}`);

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
      await bucket.upload(tmpPath, {
        destination: destination,
        metadata: {
          contentType: 'image/webp'
        }
      });

      // Get public URL
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;
      console.log(`Uploaded to: ${publicUrl}`);

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
