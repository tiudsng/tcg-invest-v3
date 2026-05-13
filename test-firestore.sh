#!/bin/bash
set -e
cd /home/ubuntu/tcg-invest-v3

SA_JSON=$(cat firebase-admin-sa.json)
PRIVATE_KEY=$(echo "$SA_JSON" | jq -r '.private_key')

HEADER=$(echo -n '{"alg":"RS256","typ":"JWT"}' | base64 -w0 | tr '/+' '_-' | tr -d '=')
IAT=$(date +%s)
EXP=$((IAT + 3600))
SCOPE="https://www.googleapis.com/auth/datastore"

PAYLOAD=$(echo -n "{\"iss\":\"firebase-adminsdk-fbsvc@gen-lang-client-0326385388.iam.gserviceaccount.com\",\"sub\":\"firebase-adminsdk-fbsvc@gen-lang-client-0326385388.iam.gserviceaccount.com\",\"aud\":\"https://oauth2.googleapis.com/token\",\"scope\":\"$SCOPE\",\"iat\":$IAT,\"exp\":$EXP}" | base64 -w0 | tr '/+' '_-' | tr -d '=')

SIGNING_INPUT="${HEADER}.${PAYLOAD}"
SIGNATURE=$(echo -n "$SIGNING_INPUT" | openssl dgst -sha256 -sign <(echo "$PRIVATE_KEY") -binary 2>/dev/null | base64 -w0 | tr '/+' '_-' | tr -d '=')
JWT="${SIGNING_INPUT}.${SIGNATURE}"

TOKEN_RESPONSE=$(curl -s -X POST https://oauth2.googleapis.com/token \
  -H "Content-Type: application/json" \
  -d "{\"grant_type\":\"urn:ietf:params:oauth:grant-type:jwt-bearer\",\"assertion\":\"$JWT\"}")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')
echo "Access token OK: ${ACCESS_TOKEN:0:30}..."

DB_ID="ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b"

# List first 3 documents in leaderboard
FIRESTORE_RESPONSE=$(curl -s -X POST \
  "https://firestore.googleapis.com/v1/projects/gen-lang-client-0326385388/databases/${DB_ID}/documents:runQuery" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"structuredQuery":{"from":[{"collectionId":"leaderboard"}],"limit":3}}')

echo "Firestore Response: $FIRESTORE_RESPONSE" | head -c 2000
