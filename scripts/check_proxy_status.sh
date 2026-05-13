#!/bin/bash
# check_proxy_status.sh — Herman Proxy 健康檢查腳本
# 用法: ./check_proxy_status.sh 或加入 crontab

PROXY_URL="http://127.0.0.1:18765/health"
LOG_FILE="/tmp/herman_proxy_health.log"
MAX_RESTARTS=3

# 顏色輸出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_proxy() {
    response=$(curl -s --max-time 5 "$PROXY_URL")
    if [ $? -eq 0 ] && echo "$response" | grep -q "ok"; then
        echo -e "${GREEN}✅ Proxy 健康${NC} — $(date '+%Y-%m-%d %H:%M:%S')"
        return 0
    else
        echo -e "${RED}❌ Proxy 無響應${NC} — $(date '+%Y-%m-%d %H:%M:%S')"
        return 1
    fi
}

restart_proxy() {
    echo -e "${YELLOW}⚠️  嘗試重啟 Proxy...${NC}"
    
    # Kill existing process
    pkill -f "herman_proxy.py" 2>/dev/null
    sleep 2
    
    # Restart
    cd /data/llama
    nohup /home/ubuntu/.hermes/hermes-agent/venv/bin/python3 herman_proxy.py >> /tmp/herman_proxy.log 2>&1 &
    sleep 3
    
    if curl -s --max-time 5 "$PROXY_URL" | grep -q "ok"; then
        echo -e "${GREEN}✅ Proxy 重啟成功${NC}"
        return 0
    else
        echo -e "${RED}❌ Proxy 重啟失敗${NC}"
        return 1
    fi
}

# 主邏輯
if check_proxy; then
    exit 0
else
    restart_proxy
    exit $?
fi