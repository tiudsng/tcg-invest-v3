import fs from 'fs';
import * as cheerio from 'cheerio';
const html = fs.readFileSync('search_result.html', 'utf8');
const $ = cheerio.load(html);
const links = [];
$('a').each((i, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('details.php/card/')) {
        links.push({ href, text: $(el).text().trim() });
    }
});
console.log(links);
