import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import * as cheerio from 'cheerio';
import sharp from 'sharp';
import axios from 'axios';
import fs from 'fs';

import serviceAccount from '../serviceAccountKey.json';

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount),
  storageBucket: 'gen-lang-client-0326385388.firebasestorage.app'
});

const db = getFirestore('ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b');
const bucket = getStorage().bucket();

async function updateMissingImages() {
  const snapshot = await db.collection('products').where('card_number', '==', '240/193').get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const cardNumber = data.card_number; 
    let jpName = data.name_jp || data.name; 
    
    if (cardNumber === '240/193') {
        jpName = 'メガゲンガーex';
    }

    console.log(`Processing ${doc.id} - ${cardNumber} with keyword: ${jpName}`);

    try {
      // 1. Search using keyword via HTTP GET
      const searchUrl = `https://www.pokemon-card.com/card-search/index.php?keyword=${encodeURIComponent(jpName)}&sm_and_keyword=true`;
      const searchRes = await axios.get(searchUrl);
      const $search = cheerio.load(searchRes.data);
      
      // 2 & 3. Find first card link
      const firstCardHref = $search('.List_item a').first().attr('href');
      
      if (!firstCardHref) {
        console.log(`No search results found for ${jpName}`);
        continue;
      }
      
      const detailUrl = `https://www.pokemon-card.com${firstCardHref}`;
      console.log(`Found detail link: ${detailUrl}`);
      
      // 4. Get the image URL from detail page
      const detailRes = await axios.get(detailUrl);
      const $detail = cheerio.load(detailRes.data);
      const imageUrls: string[] = [];
      $detail('img').each((_, img) => {
          const src = $detail(img).attr('src');
          if (src && src.includes('card_images')) {
              imageUrls.push(`https://www.pokemon-card.com${src}`);
          }
      });

      if (imageUrls.length === 0) {
        console.log(`No image found on detail page for ${jpName}`);
        continue;
      }

      const imageUrl = imageUrls[0];
      console.log(`Found image URL: ${imageUrl}`);

      // 5. Download the image
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer', headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36'
      } });
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
}

updateMissingImages().catch(console.error);
