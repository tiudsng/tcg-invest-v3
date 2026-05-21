import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Use serviceAccountKey.json from root
import serviceAccount from '../serviceAccountKey.json';

initializeApp({
  credential: cert(serviceAccount),
  storageBucket: 'gen-lang-client-0326385388.firebasestorage.app'
});

const db = getFirestore('ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b');
const bucket = getStorage().bucket();

async function batchUpdateImages() {
  console.log('--- Starting Batch Card Image Update ---');
  
  // 1. Get Top 10 to exclude
  const lbSnap = await db.collection('leaderboard').get();
  const excludeIds = new Set(lbSnap.docs.map(d => d.data().card_id));
  console.log(`Excluding ${excludeIds.size} Top 10 cards:`, Array.from(excludeIds));

  // 2. Get all products
  const productsSnap = await db.collection('products').get();
  const totalProducts = productsSnap.size;
  const productsToProcess = productsSnap.docs.filter(d => !excludeIds.has(d.id));
  
  console.log(`Total products found: ${totalProducts}`);
  console.log(`Products to process (after exclusion): ${productsToProcess.length}`);

  const browser = await puppeteer.launch({ 
    headless: true, 
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (const doc of productsToProcess) {
    const data = doc.data();
    
    // Check if it already has a "storage.googleapis" or "firebasestorage" URL
    // We update anyway if user requested, but normally we'd skip.
    // However, the user said "Update products collection all card images", so I'll check if it's already a high-res webp.
    if (data.image_url && (data.image_url.includes('firebasestorage.app') || data.image_url.includes('storage.googleapis.com'))) {
        console.log(`[SKIP] ${doc.id} already has storage URL.`);
        skipCount++;
        continue;
    }

    const cardNumber = data.card_number;
    const nameJp = data.name_jp || data.name || '';
    // If we have card number like "240/193", we use it. Otherwise use name.
    const searchKeyword = (cardNumber && cardNumber.includes('/')) ? cardNumber : nameJp;

    console.log(`[PROCESS] ${doc.id} | Keyword: ${searchKeyword}`);

    try {
      let finalImageUrl = null;

      // 1. Try search on pokemon-card.com
      const searchUrl = `https://www.pokemon-card.com/card-search/index.php?keyword=${encodeURIComponent(searchKeyword)}&sm_and_keyword=true`;
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 1500));

      const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
          .map(a => a.href)
          .filter(h => h.includes('details.php/card/'));
      });

      if (links.length > 0) {
        await page.goto(links[0], { waitUntil: 'networkidle2', timeout: 30000 });
        const imageUrls = await page.evaluate(() => {
          const imgs = document.querySelectorAll('img');
          // Look for images in card_images directory which are the full card art
          return Array.from(imgs)
            .filter(i => i.src.includes('card_images'))
            .map(i => i.src);
        });
        
        if (imageUrls.length > 0) {
          finalImageUrl = imageUrls[0];
          console.log(`   Found candidate: ${finalImageUrl}`);
        }
      } else {
          // If no links found by card number, try by card name if different
          if (searchKeyword !== nameJp && nameJp) {
              console.log(`   No results for ${searchKeyword}, trying name: ${nameJp}`);
              const searchUrl2 = `https://www.pokemon-card.com/card-search/index.php?keyword=${encodeURIComponent(nameJp)}&sm_and_keyword=true`;
              await page.goto(searchUrl2, { waitUntil: 'networkidle2' });
              await new Promise(r => setTimeout(r, 1500));
              const links2 = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('a')).map(a => a.href).filter(h => h.includes('details.php/card/'));
              });
              if (links2.length > 0) {
                  await page.goto(links2[0], { waitUntil: 'networkidle2' });
                  const imageUrls2 = await page.evaluate(() => {
                      return Array.from(document.querySelectorAll('img')).filter(i => (i as HTMLImageElement).src.includes('card_images')).map(i => (i as HTMLImageElement).src);
                  });
                  if (imageUrls2.length > 0) finalImageUrl = imageUrls2[0];
              }
          }
      }

      if (!finalImageUrl) {
        console.log(`   [FAIL] Could not find image for ${doc.id}`);
        failCount++;
        continue;
      }

      // 2. Download and Process
      const response = await axios.get(finalImageUrl, { responseType: 'arraybuffer' });
      const imgBuffer = Buffer.from(response.data, 'binary');

      const webpBuffer = await sharp(imgBuffer)
        .webp({ quality: 90 })
        .toBuffer();

      const tmpPath = path.join('/tmp', `${doc.id}.webp`);
      fs.writeFileSync(tmpPath, webpBuffer);

      // 3. Upload
      const destination = `card_images/${doc.id}.webp`;
      await bucket.upload(tmpPath, {
        destination: destination,
        metadata: { contentType: 'image/webp' }
      });

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;
      
      // 4. Update Firestore
      await db.collection('products').doc(doc.id).update({
        image_url: publicUrl,
        image_url_fallback: finalImageUrl, // Keep track of original
        updatedAt: FieldValue.serverTimestamp()
      });

      console.log(`   [SUCCESS] Updated to ${publicUrl}`);
      fs.unlinkSync(tmpPath);
      successCount++;

    } catch (err: any) {
      console.error(`   [ERROR] Processing ${doc.id}: ${err.message}`);
      failCount++;
    }
    
    // Small delay to avoid aggressive scraping
    await new Promise(r => setTimeout(r, 1000));
  }

  await browser.close();
  console.log('\n--- Batch Update Complete ---');
  console.log(`Success: ${successCount}`);
  console.log(`Skipped: ${skipCount}`);
  console.log(`Failed: ${failCount}`);
}

batchUpdateImages().catch(console.error);
