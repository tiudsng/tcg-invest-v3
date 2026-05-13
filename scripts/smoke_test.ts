/**
 * Smoke Test — Data Integrity Auditor
 * 
 * Mission: Validate that Firestore leaderboard data is "meaningful" (truthiness),
 * not just "not broken" (stability).
 * 
 * This complements normalizeCard() (stability) with truthiness validation.
 * 
 * Run:
 *   node --loader ts-node/esm scripts/smoke_test.ts
 *   npx ts-node --esm scripts/smoke_test.ts
 * 
 * Exit codes:
 *   0  = all checks passed
 *   1  = CRITICAL data missing (block deploy)
 *   2  = WARNINGS (review needed, don't block)
 */

import * as fs from 'fs';
import * as admin from 'firebase-admin';

// ── Config ────────────────────────────────────────────────────────────────────

const PROJECT_ID = 'gen-lang-client-0326385388';
const ENV_SA = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
let SERVICE_ACCOUNT_PATH: Record<string, unknown>;

if (ENV_SA && ENV_SA.trim() !== '') {
  try {
    SERVICE_ACCOUNT_PATH = JSON.parse(ENV_SA);
  } catch {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON');
    process.exit(1);
  }
} else {
  const FILE_PATH = '/home/ubuntu/.hermes/firebase/gen-lang-client-0326385388-firebase-adminsdk.json';
  if (!fs.existsSync(FILE_PATH)) {
    console.error(`❌ Service account file not found: ${FILE_PATH}`);
    process.exit(1);
  }
  SERVICE_ACCOUNT_PATH = JSON.parse(fs.readFileSync(FILE_PATH, 'utf8'));
}

// ── Thresholds ────────────────────────────────────────────────────────────────

/** If >50% of cards fallback to '0%', something is wrong with the data source */
const MAX_ZERO_RATIO_ALLOWED = 0.50;
/** Cards with 0 PSA population total are suspicious */
const FLAG_ZERO_POPULATION = true;

// ── Firebase Init (admin SDK) ─────────────────────────────────────────────────

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(SERVICE_ACCOUNT_PATH),
    databaseURL: `https://${PROJECT_ID}.firebaseio.com`,
  });
}

const db = admin.firestore();

// ── Types ────────────────────────────────────────────────────────────────────

interface CheckResult {
  docId: string;
  checks: {
    psaRatioMissing:   boolean;  // psa_pop_10_percent is null/undefined/empty
    psaRatioZero:      boolean;  // psa_pop_10_percent === '0%' (likely fallback)
    psaRatioSuspicious: boolean; // ratio string doesn't end with '%'
    undefinedString:    boolean;  // value === 'undefined%' (bug in write pipeline)
    zeroPopulation:    boolean;  // psa_pop_total === 0
    zeroCount:          boolean;  // psa_pop_10 === 0
    priceZero:          boolean;  // psa10_price === 0 (suspicious for ranked cards)
  };
  severity: 'ok' | 'warn' | 'critical';
}

// ── Core Check Logic ───────────────────────────────────────────────────────────

function checkDoc(docId: string, data: Record<string, unknown>): CheckResult {
  const md = (data.market_data || {}) as Record<string, unknown>;
  const raw = data;

  const psaRatio   = (md.psa_pop_10_percent ?? (raw as any).psa_data?.psa10_ratio) as string | number | undefined;
  const psaTotal   = Number(md.psa_pop_total ?? (raw as any).psa_data?.total_graded ?? 0);
  const psa10      = Number(md.psa_pop_10 ?? (raw as any).psa_data?.psa10_count ?? 0);
  const price      = Number(md.psa10_price ?? md.psa10_latest_jpy ?? raw.price ?? 0);

  const ratioStr = typeof psaRatio === 'number' ? `${psaRatio}%` : (psaRatio ?? '');

  return {
    docId,
    checks: {
      psaRatioMissing:    ratioStr === '' || ratioStr === 'null' || ratioStr === 'undefined',
      psaRatioZero:       ratioStr === '0%',
      psaRatioSuspicious: ratioStr !== '' && !ratioStr.endsWith('%') && ratioStr !== 'null' && ratioStr !== 'undefined',
      undefinedString:     ratioStr === 'undefined%',
      zeroPopulation:     FLAG_ZERO_POPULATION && psaTotal === 0,
      zeroCount:          psa10 === 0,
      priceZero:          price === 0,
    },
    severity: 'ok',
  };
}

function computeSeverity(r: CheckResult): CheckResult['severity'] {
  if (r.checks.undefinedString)     return 'critical';
  if (r.checks.psaRatioSuspicious)  return 'critical';
  if (r.checks.psaRatioMissing)     return 'critical';
  if (r.checks.priceZero && r.checks.zeroPopulation) return 'critical';
  if (r.checks.psaRatioZero || r.checks.zeroPopulation || r.checks.zeroCount) return 'warn';
  return 'ok';
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Smoke Test: Data Integrity Auditor');
  console.log('═'.repeat(60));
  console.log(`Project  : ${PROJECT_ID}`);
  console.log(`Started  : ${new Date().toISOString()}`);
  console.log('');

  // ── 1. Fetch leaderboard ─────────────────────────────────────────────────
  let snapshot: admin.firestore.QuerySnapshot;
  try {
    const app = admin.app();
    console.log(`Firebase app: ${app.name}, project: ${app.options.projectId}`);
    snapshot = await db.collection('leaderboard').get();
  } catch (err) {
    console.error('❌ FATAL: Firestore query failed:', (err as Error).message);
    console.error('Full error:', err);
    process.exit(1);
  }

  const totalDocs = snapshot.size;
  console.log(`Docs found: ${totalDocs}`);

  if (totalDocs === 0) {
    console.error('❌ CRITICAL: leaderboard is EMPTY. Aborting.');
    process.exit(1);
  }

  // ── 2. Run checks ─────────────────────────────────────────────────────────
  const results: CheckResult[] = [];
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() as Record<string, unknown>;
    const result = checkDoc(docSnap.id, data);
    result.severity = computeSeverity(result);
    results.push({ docId: docSnap.id, ...result });
  }

  // ── 3. Aggregate ──────────────────────────────────────────────────────────
  const criticalDocs = results.filter(r => r.severity === 'critical');
  const warnDocs     = results.filter(r => r.severity === 'warn');
  const okDocs       = results.filter(r => r.severity === 'ok');

  const zeroRatioCount = results.filter(r => r.checks.psaRatioZero).length;
  const zeroRatioPct   = (zeroRatioCount / totalDocs * 100).toFixed(1);
  const undefinedCount  = results.filter(r => r.checks.undefinedString).length;

  console.log('');
  console.log('─── Summary ────────────────────────────────────────');
  console.log(`  ✅ OK       : ${okDocs.length}/${totalDocs}`);
  console.log(`  ⚠️  WARN    : ${warnDocs.length}/${totalDocs}`);
  console.log(`  🚨 CRITICAL : ${criticalDocs.length}/${totalDocs}`);
  console.log('');

  if (zeroRatioCount > 0) {
    console.log(`  ⚠️  Cards with PSA ratio = '0%': ${zeroRatioCount}/${totalDocs} (${zeroRatioPct}%)`);
  }
  if (undefinedCount > 0) {
    console.log(`  🚨 Cards with 'undefined%': ${undefinedCount} — WRITE PIPELINE BUG!`);
  }

  // ── 4. Report CRITICALs ──────────────────────────────────────────────────
  if (criticalDocs.length > 0) {
    console.log('');
    console.log('─── 🚨 CRITICAL ────────────────────────────────────');
    for (const r of criticalDocs) {
      const reasons: string[] = [];
      if (r.checks.undefinedString)     reasons.push("'undefined%' string");
      if (r.checks.psaRatioMissing)     reasons.push('psa_pop_10_percent missing');
      if (r.checks.psaRatioSuspicious)  reasons.push(`suspicious format`);
      if (r.checks.priceZero && r.checks.zeroPopulation) reasons.push('price=0 AND pop=0');
      console.log(`  🚨 ${r.docId}: ${reasons.join(', ')}`);
    }
  }

  // ── 5. Report WARNs ──────────────────────────────────────────────────────
  if (warnDocs.length > 0) {
    console.log('');
    console.log('─── ⚠️  Warnings (top 5) ─────────────────────────────');
    for (const r of warnDocs.slice(0, 5)) {
      const reasons: string[] = [];
      if (r.checks.psaRatioZero)  reasons.push('ratio=0%');
      if (r.checks.zeroPopulation) reasons.push('pop=0');
      if (r.checks.zeroCount)     reasons.push('psa10=0');
      console.log(`  ⚠️  ${r.docId}: ${reasons.join(', ')}`);
    }
    if (warnDocs.length > 5) console.log(`  ... +${warnDocs.length - 5} more`);
  }

  // ── 6. Exit ──────────────────────────────────────────────────────────────
  console.log('');
  console.log('─'.repeat(60));
  console.log(`Completed: ${new Date().toISOString()}`);

  if (criticalDocs.length > 0) {
    console.log('');
    console.log('❌ FAILED: CRITICAL data issues. DO NOT DEPLOY.');
    process.exit(1);
  }

  if (parseFloat(zeroRatioPct) > MAX_ZERO_RATIO_ALLOWED * 100) {
    console.log('');
    console.log(`⚠️  WARN: ${zeroRatioPct}% zero-ratio cards exceeds ${(MAX_ZERO_RATIO_ALLOWED * 100).toFixed(0)}% threshold.`);
    console.log('   → Possible crawler/schema failure. Review before deploy.');
    process.exit(2);
  }

  if (warnDocs.length > totalDocs * 0.3) {
    console.log('');
    console.log(`⚠️  WARN: >30% cards have suspicious data. Review recommended.`);
    process.exit(2);
  }

  console.log('');
  console.log('✅ PASSED: Data integrity validated.');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ FATAL:', err);
  process.exit(1);
});
