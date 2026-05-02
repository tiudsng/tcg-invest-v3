
import { searchSnkrdunk } from './src/lib/snkrdunkSearchService.ts';

async function main() {
  console.log("Searching for Chi-Yu ex on Snkrdunk...");
  const results = await searchSnkrdunk("Chi-Yu ex");
  console.log("Results JSON:", JSON.stringify(results, null, 2));
}

main().catch(console.error);
