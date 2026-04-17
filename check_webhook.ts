import axios from 'axios';

const token = '8672308171:AAF_pfDId4xQUBkrM9Ra2t1jq2Lrfta5ZE8';
async function check() {
  try {
    const res = await axios.get(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err);
  }
}
check();
