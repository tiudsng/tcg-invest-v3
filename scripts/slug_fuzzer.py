#!/usr/bin/env python3
"""
slug_fuzzer.py — 自動修正失敗的 Slugs
用途：當 /get-item-id.php?slug=xxx 返回 -1 時，自動嘗試變體格式

變體策略：
1. 補零: sv2d-93 -> sv2d-093
2. 去零: sv2d-093 -> sv2d-93
3. 加 SAR: sv2d-93 -> sv2d-93-sar / sv2d-093-sar
4. 加 RR: sv2d-93 -> sv2d-93-rr / sv2d-093-rr
5. 替換 - 為 _: s12a-261 -> s12a_261
"""

import sys
import re
import urllib.request
import json
import time

sys.path.insert(0, '/data/llama')
from firebase_adapter import FirebaseAdapter

POKECA_API = 'https://pokeca-chart.com/ch/php'

def fetch_item_id(slug):
    """測試一個 slug 是否有效"""
    url = f'{POKECA_API}/get-item-id.php?slug={slug}'
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            content = r.read().decode()
            return int(content.strip().replace('"', ''))
    except:
        return -1

def generate_variants(slug):
    """生成 slug 變體"""
    variants = set()
    
    # 原始
    variants.add(slug)
    
    # 補零 case 1: sv2d-93 -> sv2d-093
    m = re.match(r'^([a-z]+)(\d+)-(\d+)$', slug.lower())
    if m:
        prefix, first_num, second_num = m.groups()
        # sv2d-93
        if len(second_num) == 2:
            variants.add(f'{prefix}{first_num}-{second_num.zfill(3)}')
        # sv2d-093 -> sv2d-93
        if len(second_num) == 3 and second_num.startswith('0'):
            variants.add(f'{prefix}{first_num}-{second_num.lstrip("0")}')
    
    # 補零 case 2: s12a-261 -> s12a-261 (already 3 digits)
    m2 = re.match(r'^([a-z]+\d+[a-z]?)-(\d+)$', slug.lower())
    if m2:
        prefix, num = m2.groups()
        if len(num) == 2:
            variants.add(f'{prefix}-{num.zfill(3)}')
        if len(num) == 3 and num.startswith('0'):
            variants.add(f'{prefix}-{num.lstrip("0")}')
    
    # SAR/RR variants
    base_slug = slug.rsplit('-', 1)[0] if '-' in slug else slug
    for suffix in ['sar', 'rr', 'hr', 'a', 'b']:
        variants.add(f'{base_slug}-{suffix}')
    
    # _ instead of -
    variants.add(slug.replace('-', '_'))
    
    return variants

def fuzz_slug(slug):
    """測試一個 slug 的所有變體"""
    variants = generate_variants(slug)
    
    for variant in variants:
        item_id = fetch_item_id(variant)
        if item_id > 0:
            return variant, item_id
    
    return None, -1

def main():
    fb = FirebaseAdapter()
    db = fb.db
    
    # 讀取 Firestore 中的所有 pokeca_gold slugs
    print('🔍 Scanning Firestore for invalid slugs...')
    snap = db.collection('pokeca_gold').get()
    
    invalid_docs = []
    for doc in snap:
        data = doc.to_dict()
        slug = data.get('slug', '').strip()
        if not slug or slug in ('null', 'undefined', ''):
            invalid_docs.append((doc.id, slug, data.get('name', 'N/A')))
            continue
        
        item_id = fetch_item_id(slug)
        if item_id <= 0:
            invalid_docs.append((doc.id, slug, data.get('name', 'N/A')))
    
    print(f'📊 Found {len(invalid_docs)} invalid slugs out of {len(snap)} total')
    
    if not invalid_docs:
        print('✅ All slugs are valid!')
        return
    
    # Fuzz each invalid slug
    print('\n🔧 Running fuzzer...\n')
    fixed = []
    
    for doc_id, slug, name in invalid_docs[:20]:  # Limit to 20 for now
        print(f'  Testing: {slug} ({name[:20]})')
        
        variant, item_id = fuzz_slug(slug)
        
        if item_id > 0:
            print(f'    ✅ Found: {variant} -> item_id={item_id}')
            fixed.append((doc_id, slug, variant, item_id))
        else:
            print(f'    ❌ No variant found')
    
    print(f'\n📝 Summary: {len(fixed)}/{len(invalid_docs)} slugs fixed')
    
    # Update Firestore with fixed slugs
    if fixed:
        print('\n💾 Updating Firestore...')
        for doc_id, old_slug, new_slug, item_id in fixed:
            doc_ref = db.collection('pokeca_gold').document(doc_id)
            doc_ref.update({'slug': new_slug})
            print(f'  ✅ {old_slug} -> {new_slug} (item_id={item_id})')
        
        print(f'\n🎉 Updated {len(fixed)} slugs in Firestore')
    
    # Export remaining unfixed slugs to JSON for manual review
    unfixed = [(doc_id, slug, name) for doc_id, slug, name in invalid_docs if not any(f[0] == doc_id for f in fixed)]
    if unfixed:
        with open('/tmp/unfixed_slugs.json', 'w') as f:
            json.dump(unfixed, f, ensure_ascii=False, indent=2)
        print(f'\n⚠️  {len(unfixed)} slugs remain unfixed — exported to /tmp/unfixed_slugs.json')

if __name__ == '__main__':
    main()