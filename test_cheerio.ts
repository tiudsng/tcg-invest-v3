import fs from 'fs';
import * as cheerio from 'cheerio';
const html = fs.readFileSync('search_result.html', 'utf8');
const $ = cheerio.load(html);
$('a').each((i, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('details.php')) {
        console.log(href);
    }
});
