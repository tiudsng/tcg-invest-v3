#!/bin/bash
# Deploy Firestore security rules
# Usage: bash deploy_firestore_rules.sh

PROJECT_ID="gen-lang-client-0326385388"

echo "═══════════════════════════════════════════"
echo "  FIRESTORE RULES DEPLOYMENT"
echo "═══════════════════════════════════════════"
echo ""
echo "Project: $PROJECT_ID"
echo ""
echo "Changes to deploy:"
grep -A4 "pokeca_gold" firestore.rules
echo ""
echo "To deploy, you need Firebase CLI installed."
echo "Since global npm install failed, trying npx..."

npx firebase deploy --only firestore:rules --project $PROJECT_ID 2>&1

echo ""
echo "If deploy succeeded, pokeca_gold collection will be publicly readable."
echo "Run test_data_integrity.ts again to verify."