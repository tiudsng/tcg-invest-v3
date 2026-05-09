import fs from 'fs';
const html = fs.readFileSync('search_result.html', 'utf8');
const snippets = html.split('List_item').slice(1, 3);
console.log(snippets.map(s => s.substring(0, 500)));
