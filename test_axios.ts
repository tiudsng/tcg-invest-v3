import axios from 'axios';
import * as cheerio from 'cheerio';
const url = 'https://www.pokemon-card.com/card-search/index.php?keyword=' + encodeURIComponent('メガゲンガーex');
axios.get(url).then(res => {
    const $ = cheerio.load(res.data);
    const results = $('.CardInfoList');
    console.log(results.length);
    const links = $('a').get().map(a => $(a).attr('href')).filter(h => h && h.includes('details'));
    console.log(links);
});
