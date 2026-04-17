import axios from 'axios';

async function test() {
  try {
    const res = await axios.post('http://localhost:3000/api/webhook/telegram', {
      message: {
        chat: { id: 123 },
        text: '小龍蝦 測試 123'
      }
    });
    console.log('Status:', res.status);
  } catch (err: any) {
    console.error('Error:', err.response?.status || err.message);
  }
}
test();
