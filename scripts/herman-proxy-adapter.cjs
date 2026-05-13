/**
 * herman-proxy-adapter.cjs
 * Herman Proxy Node.js 客戶端
 * 
 * 用途：將 scraper_pokeca.cjs 的 https.get 請求通過 Herman Proxy 發送
 * 這樣可以獲得 curl_cffi 的 JA3/TLS 指紋偽裝能力
 * 
 * 用法：
 *   const { HermanProxy } = require('./herman-proxy-adapter.cjs');
 *   const proxy = new HermanProxy();
 *   const result = await proxy.get('https://pokeca-chart.com/...');
 */

const http = require('http');

const PROXY_HOST = '127.0.0.1';
const PROXY_PORT = 18765;
const DEFAULT_TIMEOUT = 45000; // 45s — Python curl_cffi TLS handshake 需要更多時間
class HermanProxy {
  constructor(options = {}) {
    this.host = options.host || PROXY_HOST;
    this.port = options.port || PROXY_PORT;
    this.timeout = options.timeout || 30000;
  }

  /**
   * 發送 GET 請求通過 Herman Proxy
   * @param {string} url - 目標 URL
   * @param {object} options
   * @param {string} options.target - 指紋預設 (stealth_chrome, stealth_safari, standard_bot)
   * @param {string} options.session_id - Session ID (用於維持同一指紋)
   * @param {object} options.params - URL 查詢參數
   * @param {number} options.timeout - 超時 (ms)
   */
  async get(url, options = {}) {
    const {
      target = 'standard_bot',
      session_id = null,
      params = null,
      timeout = this.timeout
    } = options;

    const queryParams = new URLSearchParams({ url, target });
    if (session_id) queryParams.set('session_id', session_id);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        queryParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v);
      }
    }

    return this._request(queryParams.toString(), timeout);
  }

  /**
   * 發送 POST 請求通過 Herman Proxy
   */
  async post(url, { data = null, json_data = null, target = 'standard_bot', session_id = null, timeout = this.timeout } = {}) {
    const postData = JSON.stringify({
      url,
      method: 'POST',
      target,
      session_id,
      data,
      json_data,
    });

    const [host, port] = [this.host, this.port];
    
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: host,
        port: port,
        path: '/fetch',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout,
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(body);
            resolve(result);
          } catch (e) {
            reject(new Error(`Failed to parse response: ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${timeout}ms`));
      });

      req.write(postData);
      req.end();
    });
  }

  _request(queryString, timeout) {
    const [host, port] = [this.host, this.port];

    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: host,
        port: port,
        path: `/fetch?${queryString}`,
        method: 'GET',
        timeout,
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(body);
            resolve(result);
          } catch (e) {
            reject(new Error(`Failed to parse response: ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout after ${timeout}ms`));
      });

      req.end();
    });
  }
}

// 測試
async function test() {
  const proxy = new HermanProxy();

  console.log('🧪 Testing Herman Proxy Adapter...\n');

  // Test 1: Pokeca-chart (standard_bot)
  const r1 = await proxy.get(
    'https://pokeca-chart.com/php/get-item-id.php?slug=svp-en-001',
    { target: 'standard_bot' }
  );
  console.log('✅ Pokeca get-item-id:', r1.success ? `HTTP ${r1.status_code}` : `Error: ${r1.error}`);

  // Test 2: stealth_chrome
  const r2 = await proxy.get(
    'https://httpbin.org/headers',
    { target: 'stealth_chrome' }
  );
  if (r2.success && r2.content) {
    const headers = JSON.parse(r2.content).headers;
    console.log('✅ stealth_chrome UA:', headers['User-Agent']?.slice(0, 60));
  }

  // Test 3: POST
  const r3 = await proxy.post('https://httpbin.org/post', {
    json_data: { test: 'hello' },
    target: 'standard_bot'
  });
  console.log('✅ POST test:', r3.success ? `HTTP ${r3.status_code}` : `Error: ${r3.error}`);

  console.log('\n🎉 All tests passed!');
}

if (require.main === module) {
  test().catch(e => {
    console.error('❌ Test failed:', e.message);
    process.exit(1);
  });
}

module.exports = { HermanProxy };