import fetch from 'node-fetch';

async function run() {
  const res = await fetch('https://grading.pokeca-chart.com/svp-en-085/');
  const text = await res.text();
  console.log(text.substring(0, 1000));
  if (text.includes('PSA')) {
    console.log('Includes PSA');
  }
}
run();
