import fetch from "node-fetch";
import * as cheerio from "cheerio";

async function run() {
  const res = await fetch("https://pokeca-chart.com/svp-en-085/");
  const text = await res.text();
  const $ = cheerio.load(text);
  
  console.log("Title:", $("title").text());
  
  const results: any[] = [];
  $("th").each((i, el) => {
     results.push({ th: $(el).text().trim(), td: $(el).next("td").text().trim() });
  });
  console.log("Headers:");
  console.log(results);
  
  // also specifically look for numbers of entries, sales, past, history, 統計, etc.
  const allText = $("body").text().replace(/\s+/g, " ");
  console.log("出品 included:", allText.includes("出品"));
  console.log("販売履歴 included:", allText.includes("販売履歴"));
  console.log("相場 included:", allText.includes("相場"));
  console.log("取集件数 included:", allText.includes("件数"));
  
  // try to find where the history_count comes from
  // "history_count": 2 in products json. Maybe from "件" strings?
  
  const snippets: string[] = [];
  $("*").each((i, el) => {
    const t = $(el).clone().children().remove().end().text().trim();
    if(t.includes("件")) {
      snippets.push(t);
    }
  });
  console.log("Elements containing 件:", snippets);
}
run();
