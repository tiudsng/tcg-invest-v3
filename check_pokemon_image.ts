import https from 'https';

https.get('https://www.pokemon-card.com/card-search/details.php/card/50000/regu/all', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const match = data.match(/\/assets\/images\/card_images\/[^\.]+\.jpg/g);
    console.log('Matches:', match);
  });
}).on('error', console.error);
