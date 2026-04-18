const https = require('https');

https.get('https://www.pokemon-card.com/card-search/index.php?keyword=%E3%83%9F%E3%83%A5%E3%82%A6ex&regulation_sidebar_form=all&sm_and_up=on', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const matches = [...data.matchAll(/<img src="(\/assets\/images\/card_images\/large\/[^\"]+)"/g)];
    matches.forEach(m => console.log('https://www.pokemon-card.com' + m[1]));
  });
});
