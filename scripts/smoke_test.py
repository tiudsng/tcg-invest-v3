#!/usr/bin/env python3
"""
Smoke Test — Data Integrity Auditor (Python)

Mission: Validate that Firestore leaderboard data is "meaningful" (truthiness),
not just "not broken" (stability).

This complements normalizeCard() (stability) with truthiness validation.

Run:
    python3 scripts/smoke_test.py
    python3 scripts/smoke_test.py --strict   # block deploy on warnings

Exit codes:
    0 = all checks passed
    1 = CRITICAL data issues (block deploy)
    2 = WARNINGS (review needed)
"""

import json
import sys
import os
from pathlib import Path

from google.oauth2 import service_account
import firebase_admin
from firebase_admin import credentials as fa_credentials
from google.cloud import firestore

# ── Config ────────────────────────────────────────────────────────────────────

PROJECT_ID = 'gen-lang-client-0326385388'
FIRESTORE_DB = 'ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b'

ENV_SA = os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON', '').strip()
if ENV_SA:
    SA_dict = json.loads(ENV_SA)
else:
    SA_PATH = Path.home() / '.hermes' / 'firebase' / f'{PROJECT_ID}-firebase-adminsdk.json'
    if not SA_PATH.exists():
        print(f'❌ Service account file not found: {SA_PATH}')
        sys.exit(1)
    with open(SA_PATH) as f:
        SA_dict = json.load(f)

# ── Firebase Init ─────────────────────────────────────────────────────────────

# Use google.oauth2 for direct firestore.Client (bypasses firebase-admin ADC issues)
creds = service_account.Credentials.from_service_account_info(
    SA_dict,
    scopes=['https://www.googleapis.com/auth/cloud-platform']
)
db = firestore.Client(credentials=creds, project=PROJECT_ID, database=FIRESTORE_DB)

# ── Thresholds ────────────────────────────────────────────────────────────────

MAX_ZERO_RATIO_ALLOWED = 0.50   # if >50% cards have 0% PSA ratio → suspicious
FLAG_ZERO_POPULATION = True

# ── Types ─────────────────────────────────────────────────────────────────────

class CheckResult:
    def __init__(self, doc_id: str):
        self.doc_id = doc_id
        self.checks = {
            'psa_ratio_missing':    False,
            'psa_ratio_zero':       False,
            'psa_ratio_suspicious': False,
            'undefined_string':      False,
            'zero_population':       False,
            'zero_count':           False,
            'price_zero':           False,
        }
        self.severity = 'ok'

# ── Core Check Logic ───────────────────────────────────────────────────────────

def check_doc(doc_id: str, data: dict) -> CheckResult:
    r = CheckResult(doc_id)

    md = data.get('market_data', {})
    psa_data = data.get('psa_data', {})

    # PSA ratio — could be in market_data.psa_pop_10_percent or psa_data.psa10_ratio
    psa_ratio_raw = md.get('psa_pop_10_percent') or psa_data.get('psa10_ratio')
    psa_total = int(md.get('psa_pop_total') or psa_data.get('total_graded') or 0)
    psa10     = int(md.get('psa_pop_10') or psa_data.get('psa10_count') or 0)
    price     = float(md.get('psa10_price') or md.get('psa10_latest_jpy') or data.get('price') or 0)

    # Normalize ratio to string with '%'
    if psa_ratio_raw is None or psa_ratio_raw == '':
        ratio_str = ''
    elif isinstance(psa_ratio_raw, (int, float)):
        ratio_str = f'{psa_ratio_raw}%'
    elif isinstance(psa_ratio_raw, str):
        ratio_str = psa_ratio_raw if psa_ratio_raw.endswith('%') else psa_ratio_raw
    else:
        ratio_str = str(psa_ratio_raw)

    # Run checks
    r.checks['psa_ratio_missing']    = (ratio_str == '' or ratio_str in ('null', 'undefined'))
    r.checks['psa_ratio_zero']       = (ratio_str == '0%')
    r.checks['psa_ratio_suspicious'] = (
        ratio_str != '' and
        not ratio_str.endswith('%') and
        ratio_str not in ('null', 'undefined')
    )
    r.checks['undefined_string']      = (ratio_str == 'undefined%')
    r.checks['zero_population']       = FLAG_ZERO_POPULATION and psa_total == 0
    r.checks['zero_count']            = (psa10 == 0)
    r.checks['price_zero']            = (price == 0)

    # Severity
    if r.checks['undefined_string'] or r.checks['psa_ratio_suspicious']:
        r.severity = 'critical'
    elif r.checks['psa_ratio_missing']:
        r.severity = 'critical'
    elif r.checks['price_zero'] and r.checks['zero_population']:
        r.severity = 'critical'
    elif r.checks['psa_ratio_zero'] or r.checks['zero_population'] or r.checks['zero_count']:
        r.severity = 'warn'

    return r

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    strict = '--strict' in sys.argv

    print('🔍 Smoke Test: Data Integrity Auditor')
    print('═' * 60)
    print(f'Project  : {PROJECT_ID}')
    print(f'Database : ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b')
    print(f'Strict   : {strict}')
    print(f'Started  : {__import__("datetime").datetime.now().isoformat()}')
    print()

    # ── 1. Fetch leaderboard ─────────────────────────────────────────────────
    # Filter: only docs that have market_data or psa_data (actual card docs)
    # Exclude user accounts, settings docs, etc.
    try:
        all_docs = db.collection('leaderboard').get()
    except Exception as e:
        print(f'❌ FATAL: Could not connect to Firestore: {e}')
        sys.exit(1)

    docs = [d for d in all_docs if d.to_dict().get('market_data') or d.to_dict().get('psa_data')]
    excluded = len(all_docs) - len(docs)
    if excluded > 0:
        print(f'(Excluded {excluded} non-card docs)')
    total_docs = len(docs)
    print(f'Docs found: {total_docs}')

    if total_docs == 0:
        print('❌ CRITICAL: leaderboard collection is EMPTY. Aborting.')
        sys.exit(1)

    # ── 2. Run checks ─────────────────────────────────────────────────────────
    results = []
    for doc in docs:
        data = doc.to_dict()
        result = check_doc(doc.id, data)
        results.append(result)

    # ── 3. Aggregate ──────────────────────────────────────────────────────────
    critical = [r for r in results if r.severity == 'critical']
    warns    = [r for r in results if r.severity == 'warn']
    ok       = [r for r in results if r.severity == 'ok']

    zero_ratio_count = sum(1 for r in results if r.checks['psa_ratio_zero'])
    zero_ratio_pct   = zero_ratio_count / total_docs * 100
    undefined_count  = sum(1 for r in results if r.checks['undefined_string'])

    print()
    print('─── Summary ────────────────────────────────────────')
    print(f'  ✅ OK       : {len(ok)}/{total_docs}')
    print(f'  ⚠️  WARN    : {len(warns)}/{total_docs}')
    print(f'  🚨 CRITICAL : {len(critical)}/{total_docs}')
    print()

    if zero_ratio_count > 0:
        print(f'  ⚠️  Cards with PSA ratio = "0%": {zero_ratio_count}/{total_docs} ({zero_ratio_pct:.1f}%)')
    if undefined_count > 0:
        print(f'  🚨 Cards with "undefined%": {undefined_count} — WRITE PIPELINE BUG!')

    # ── 4. Report CRITICALs ──────────────────────────────────────────────────
    if critical:
        print()
        print('─── 🚨 CRITICAL ────────────────────────────────────')
        for r in critical:
            reasons = []
            if r.checks['undefined_string']:      reasons.append('"undefined%" string')
            if r.checks['psa_ratio_missing']:     reasons.append('psa_pop_10_percent missing')
            if r.checks['psa_ratio_suspicious']:  reasons.append('suspicious ratio format')
            if r.checks['price_zero'] and r.checks['zero_population']:
                reasons.append('price=0 AND pop=0')
            print(f'  🚨 {r.doc_id}: {", ".join(reasons)}')

    # ── 5. Report WARNs ──────────────────────────────────────────────────────
    if warns:
        print()
        print('─── ⚠️  Warnings (top 5) ─────────────────────────────')
        for r in warns[:5]:
            reasons = []
            if r.checks['psa_ratio_zero']:  reasons.append('ratio=0%')
            if r.checks['zero_population']: reasons.append('pop=0')
            if r.checks['zero_count']:       reasons.append('psa10=0')
            print(f'  ⚠️  {r.doc_id}: {", ".join(reasons)}')
        if len(warns) > 5:
            print(f'  ... +{len(warns) - 5} more')

    # ── 6. Exit ───────────────────────────────────────────────────────────────
    print()
    print('─' * 60)
    print(f'Completed: {__import__("datetime").datetime.now().isoformat()}')

    if critical:
        print()
        print('❌ FAILED: CRITICAL data issues. DO NOT DEPLOY.')
        sys.exit(1)

    if zero_ratio_pct > MAX_ZERO_RATIO_ALLOWED * 100:
        print()
        print(f'⚠️  WARN: {zero_ratio_pct:.1f}% zero-ratio cards exceeds {(MAX_ZERO_RATIO_ALLOWED * 100):.0f}% threshold.')
        print('   → Possible crawler/schema failure.')
        sys.exit(2 if strict else 0)

    if len(warns) > total_docs * 0.3:
        print()
        print(f'⚠️  WARN: {len(warns)/total_docs*100:.0f}% of cards have suspicious data.')
        sys.exit(2 if strict else 0)

    print()
    print('✅ PASSED: Data integrity validated.')
    sys.exit(0)

if __name__ == '__main__':
    main()
