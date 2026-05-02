import puppeteer from 'puppeteer';

export interface SnkrdunkSearchResult {
  id: string;
  name: string;
  price?: string;
  imageUrl?: string;
  url: string;
}

export interface SnkrdunkListing {
  price: number;
  currency: string;
  grade: string;
  isSold: boolean;
}

export interface SnkrdunkMarketStats {
  median_sold_psa10: number | null;
  median_listed_psa10: number | null;
  median_sold_raw: number | null;
  currency: string;
  sold_psa10_count: number;
  listed_psa10_count: number;
  method: string;
}

/**
 * Extracts card number (like 347/190 or SV4a 347/190) from a keyword safely.
 */
function extractSearchKeyword(keyword: string): string {
  const strictMatch = keyword.match(/\b[A-Z0-9][A-Za-z0-9-+]{1,5}\s+\d+\/[A-Za-z0-9-]+\b/);
  if (strictMatch) return strictMatch[0].trim();
  const simpleMatch = keyword.match(/\d+\/[A-Za-z0-9-]+/);
  if (simpleMatch) return simpleMatch[0].trim();
  return keyword;
}

/**
 * Searches Snkrdunk for a card by keyword.
 */
export async function searchSnkrdunk(keyword: string): Promise<SnkrdunkSearchResult[]> {
  let browser = null;
  try {
    const searchKeyword = extractSearchKeyword(keyword);
    console.log(`[SnkrdunkSearch] Original: "${keyword}" -> Extracted: "${searchKeyword}"`);

    // Try Japanese site first as it is more robust
    const searchUrl = `https://snkrdunk.com/search/result?keyword=${encodeURIComponent(searchKeyword)}`;
    console.log(`[SnkrdunkSearch] Searching (JP): ${searchUrl}`);

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });
    
    // Set a reasonable timeout
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 90000 });
    
    // Wait for content (JP site has different load patterns)
    await new Promise(resolve => setTimeout(resolve, 5000));

    const results = await page.evaluate(() => {
      // Snkrdunk results - both EN and JP have various structures
      // Use broad selectors to capture links that look like products
      const items = Array.from(document.querySelectorAll('a[href*="/trading-cards/"], .product-card-item, li[class*="product-list"] a, div[class*="CardContainer"] a, li[class*="Card"] a'));
      
      return items.map(item => {
        const url = (item as HTMLAnchorElement).href || (item.querySelector('a') as HTMLAnchorElement)?.href;
        if (!url) return null;

        const idMatch = url.match(/\/trading-cards\/([^/?]+)/);
        let id = idMatch ? idMatch[1] : '';
        if (id === 'used' || !id) return null;
        
        const imgEl = item.querySelector('img');
        
        let name = '';
        const possibleNames = Array.from(item.querySelectorAll('p, span, div, h3, h2'))
          .map(el => el.textContent?.trim() || '')
          .filter(text => text.length > 2 && !text.includes('$') && !text.includes('¥') && !text.includes('円') && !text.toLowerCase().includes('sold'));
        
        if (possibleNames.length > 0) {
          name = possibleNames[0];
        } else {
          name = item.getAttribute('title') || imgEl?.getAttribute('alt') || 'Unknown Card';
        }
        
        const imageUrl = imgEl?.src || imgEl?.getAttribute('data-src') || imgEl?.getAttribute('srcset')?.split(' ')[0] || '';

        return {
          id: id.startsWith('snkrdunk_') ? id : `snkrdunk_${id}`,
          name: name,
          imageUrl: imageUrl,
          url: url
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null && !!item.id && item.name && item.name.length > 2)
      .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
      .slice(0, 10);
    });

    console.log(`[SnkrdunkSearch] Extracted ${results.length} items`);
    return results;
  } catch (error: any) {
    console.error("[SnkrdunkSearch] Error:", error.message);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Searches pokeca-chart.com for a card by keyword.
 * Specifically handles card numbers if present.
 */
export async function searchPokecaChart(keyword: string): Promise<any[]> {
  let browser = null;
  try {
    const searchKeyword = extractSearchKeyword(keyword);
    console.log(`[PokecaChartSearch] Original: "${keyword}" -> Extracted: "${searchKeyword}"`);

    // pokeca-chart.com uses standard WordPress search
    const searchUrl = `https://pokeca-chart.com/?s=${encodeURIComponent(searchKeyword)}`;
    console.log(`[PokecaChartSearch] Searching: ${searchUrl}`);

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });
    
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    
    // Wait for content
    await new Promise(resolve => setTimeout(resolve, 8000));

    const results = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.entry-card-wrap, article, .post, .type-post, .card'));
      
      return items.map(item => {
        const linkEl = item.querySelector('a');
        const url = linkEl ? linkEl.href : '';
        const titleEl = item.querySelector('.entry-card-title, h1, h2, h3, .card-title');
        const name = titleEl ? titleEl.textContent?.trim() : '';
        const imgEl = item.querySelector('img');
        
        // Extract set/number from URL if possible (e.g., https://pokeca-chart.com/sv2a-201-165/)
        const urlMatch = url.match(/pokeca-chart\.com\/([^/]+)\//);
        const slug = urlMatch ? urlMatch[1] : '';
        
        // Handle lazy loaded images
        const imageUrl = imgEl?.src || imgEl?.getAttribute('data-src') || imgEl?.getAttribute('srcset')?.split(' ')[0] || '';

        return {
          id: `pokeca_${slug}`, // Use pokeca prefix to distinguish
          slug: slug,
          name: name,
          imageUrl: imageUrl,
          url: url
        };
      })
      .filter(item => item.url && item.name && !item.url.includes('/category/') && !item.url.includes('/tag/'))
      .slice(0, 5);
    });

    console.log(`[PokecaChartSearch] Extracted ${results.length} items`);
    return results;
  } catch (error: any) {
    console.error("[PokecaChartSearch] Error:", error.message);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Scrapes Snkrdunk PSA 10 market data using the exact URL and frontend button clicks.
 */
export async function scrapeSnkrdunkMarketStats(cardId: string): Promise<SnkrdunkMarketStats> {

  const snkrId = cardId.replace('snkrdunk_', '');
  const targetUrl = `https://snkrdunk.com/en/trading-cards/${snkrId}/used`;
  
  let browser = null;
  try {
    console.log(`[Scraper] Starting Snkrdunk detailed scrape: ${targetUrl}`);
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });

    console.log(`[Scraper] Clicking PSA 10 filter...`);
    await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      labels.forEach(el => {
        if (el.innerText.includes('PSA 10') || el.innerText.includes('PSA10')) {
          const radio = el.querySelector('input[type="radio"]') as HTMLInputElement;
          if (radio) {
            radio.click();
          }
        }
      });
    });

    // Wait for context to update (client-side rendering)
    await new Promise(resolve => setTimeout(resolve, 3000));

    const listings = await page.evaluate(() => {
      const items = document.querySelectorAll('a[href*="/en/trading-cards/used/listings/"]');
      const results: { price: number, currency: string, grade: string, isSold: boolean }[] = [];
      
      items.forEach(item => {
        const text = (item as HTMLElement).innerText;
        const priceMatch = text.match(/(SG\s*\$|US\s*\$|¥)\s*([\d,]+)/);
        const gradeMatch = text.match(/(SOLD\s*)?PSA\s*(\d+)/i);
        
        if (priceMatch) {
          results.push({
            price: parseInt(priceMatch[2].replace(/,/g, ''), 10),
            currency: priceMatch[1],
            grade: gradeMatch ? gradeMatch[2] : 'Raw',
            isSold: gradeMatch ? !!gradeMatch[1] : text.toUpperCase().includes('SOLD')
          });
        }
      });
      return results;
    });

    const soldPsa10 = listings.filter(l => l.grade === '10' && l.isSold).map(l => l.price).sort((a, b) => a - b);
    const listedPsa10 = listings.filter(l => l.grade === '10' && !l.isSold).map(l => l.price).sort((a, b) => a - b);
    const soldRaw = listings.filter(l => l.grade === 'Raw' && l.isSold).map(l => l.price).sort((a, b) => a - b);

    const getMedian = (arr: number[]) => {
      if (!arr.length) return null;
      const mid = Math.floor(arr.length / 2);
      return arr.length % 2 !== 0 ? arr[mid] : Math.round((arr[mid - 1] + arr[mid]) / 2);
    };

    // Assuming all items from the EN site will use the same currency (e.g. "US $" or "SG $")
    const fallbackCurrency = listings.length > 0 ? listings[0].currency : "US $";

    return {
      median_sold_psa10: getMedian(soldPsa10),
      median_listed_psa10: getMedian(listedPsa10),
      median_sold_raw: getMedian(soldRaw),
      currency: fallbackCurrency,
      sold_psa10_count: soldPsa10.length,
      listed_psa10_count: listedPsa10.length,
      method: "puppet_psa10_filter"
    };

  } catch (err: any) {
    console.error(`[Scraper] Error scraping ${cardId}:`, err.message);
    return {
      median_sold_psa10: null,
      median_listed_psa10: null,
      median_sold_raw: null,
      currency: "US $",
      sold_psa10_count: 0,
      listed_psa10_count: 0,
      method: "error"
    };
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Scrapes PSA 10 Population from grading.pokeca-chart.com
 * @param setIdStr e.g. 's6a-095-069' or 'S6a 095/069'
 */
export async function scrapePSAPopulation(setIdStr: string): Promise<{ total: number; psa10: number; psa9?: number; psa8?: number } | null> {
  const parts = setIdStr.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;

  // If the first part is a known set prefix, and second part is number
  let setCode = parts[0].toLowerCase();
  let cardNumber = parts[1].toLowerCase();

  // Handle case where it might be "SM-P 085" -> parts = ["SM-P", "085"]
  // Or "S6a 085/069" -> ["S6a", "085/069"] -> we need 085
  const cardNumMatch = cardNumber.match(/^(\d+)/);
  if (cardNumMatch) {
    cardNumber = cardNumMatch[1].padStart(3, '0'); // pokeca-chart often uses 3 digits like 085
  }

  // Try different combinations based on provided set and number
  const variations = [
    `${setCode}-${cardNumber}`,
    `${cardNumber}-${setCode}`,
    `${setCode}-en-${cardNumber}`,
    `${setCode}-jp-${cardNumber}`,
  ];

  // Specific logic for SVP (Promos)
  if (setCode.includes('svp') || setCode.includes('promo')) {
    variations.push(`svp-en-${cardNumber}`);
    variations.push(`svp-jp-${cardNumber}`);
    variations.push(`promo-${setCode}-${cardNumber}`);
  }

  // Specific logic for SM-P / XY-P
  if (setCode.includes('sm') || setCode.includes('xy')) {
    variations.push(`${setCode}-p-${cardNumber}`);
    variations.push(`p-${setCode}-${cardNumber}`);
  }

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    
    // We try variations until one works
    for (const variant of variations) {
      const cleanId = variant.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      const targetUrl = `https://grading.pokeca-chart.com/${cleanId}/`;
      
      try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log(`[PSA Scraper] Trying: ${targetUrl}`);
        const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
        
        if (response && response.status() === 404) {
          console.log(`[PSA Scraper] 404 for ${variant}`);
          await page.close();
          continue;
        }

        // Wait a bit for JS to render the table
        await new Promise(resolve => setTimeout(resolve, 5000));

        const popData = await page.evaluate(() => {
          const tables = Array.from(document.querySelectorAll('table'));
          const popTable = tables.find(t => t.innerText.includes('AUTH') && t.innerText.includes('10'));
          if (!popTable) return null;
          
          const rows = Array.from(popTable.rows);
          if (rows.length < 2) return null;
          
          const headers = Array.from(rows[0].cells).map(c => c.innerText.trim());
          const data = Array.from(rows[1].cells).map(c => c.innerText.trim());
          
          const getVal = (label: string) => {
            const idx = headers.indexOf(label);
            if (idx === -1) return 0;
            return parseInt(data[idx].replace(/,/g, ''), 10) || 0;
          };
          
          return {
            psa10: getVal('10'),
            psa9: getVal('9'),
            psa8: getVal('8'),
            total: getVal('ALL')
          };
        });
        
        if (popData && popData.psa10 !== null) {
          console.log(`[PSA Scraper] Found for ${cleanId}: PSA10=${popData.psa10}, PSA9=${popData.psa9}, Total=${popData.total}`);
          await page.close();
          return popData;
        }
        await page.close();
      } catch (err: any) {
        console.log(`[PSA Scraper] Failed variant ${variant}: ${err.message}`);
      }
    }
    
    return null;
  } catch (error: any) {
    console.error(`[PSA Scraper] Global puppeteer error:`, error.message);
    return null;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

export async function scrapePokecaChartAdvancedData(setIdStr: string): Promise<any | null> {
  const parts = setIdStr.trim().split(/[\s/-]+/).filter(Boolean);
  if (parts.length < 2) return null;

  const setCode = parts[0].toLowerCase();
  const cardNumber = parts[1].toLowerCase();

  const variations = [
    parts.join('-'),
    `${setCode}-${cardNumber}`,
    `${cardNumber}-${setCode}`,
    `${setCode}-en-${cardNumber}`,
    `svp-en-${cardNumber}`,
    `sm-p-${cardNumber}`,
    `p-sm-${cardNumber}`
  ];

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    
    for (const variant of variations) {
      const cleanId = variant.replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      const targetUrl = `https://pokeca-chart.com/${cleanId}/`;
      
      try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log(`[PokecaChart Scraper] Trying: ${targetUrl}`);
        const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
        
        if (response && response.status() === 404) {
          await page.close();
          continue;
        }
        const advancedData = await page.evaluate(() => {
          const result: any = { shops: [], stats: {} };
          const tables = Array.from(document.querySelectorAll('table'));
          
          for (const table of tables) {
            const txt = table.textContent || '';
            
            // Shop listings
            if (txt.includes('ショップ名') && txt.includes('最安値')) {
              const rows = Array.from(table.querySelectorAll('tr'));
              for (let i = 1; i < rows.length; i++) {
                const cells = Array.from(rows[i].querySelectorAll('td')).map(c => c.innerText.trim());
                if (cells.length >= 3) {
                  result.shops.push({
                    shop: cells[0] || 'Unknown',
                    condition: cells[1] || '-',
                    price: cells[2] || '-'
                  });
                }
              }
            } 
            
            // Simple price stat table (美品 | キズあり | PSA10)
            if (txt.includes('美品') && txt.includes('PSA10') && !txt.includes('比率')) {
              const rows = Array.from(table.querySelectorAll('tr'));
              if (rows.length >= 2) {
                const headers = Array.from(rows[0].cells).map(c => c.innerText.trim());
                const data = Array.from(rows[1].cells).map(c => c.innerText.trim());
                
                const rawIdx = headers.indexOf('美品');
                const psaIdx = headers.indexOf('PSA10');
                
                if (rawIdx !== -1) result.stats.raw_latest = data[rawIdx];
                if (psaIdx !== -1) result.stats.psa10_latest = data[psaIdx];
              }
            }
          }
          return (result.shops.length > 0 || Object.keys(result.stats).length > 0) ? result : null;
        });

        if (advancedData) {
          console.log(`[PokecaChart Scraper] Success for ${variant}`);
          await page.close();
          return advancedData;
        }
        await page.close();
      } catch (err: any) {
        console.log(`[PokecaChart Scraper] Failed variant ${variant}: ${err.message}`);
      }
    }
    
    return null;
  } catch (error: any) {
    console.error(`[PokecaChart Scraper] Global puppeteer error:`, error.message);
    return null;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
