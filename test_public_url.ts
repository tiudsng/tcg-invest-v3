import axios from 'axios';

async function testPublic() {
  const url = 'https://ais-pre-ftcax24l24nvnbnocscdcn-180619972674.us-west2.run.app/api/webhook/telegram';
  try {
    const res = await axios.post(url, { test: 1 }, { maxRedirects: 0 });
    console.log('Status:', res.status);
  } catch (err: any) {
    console.log('Error status:', err.response?.status);
    console.log('Location header:', err.response?.headers?.location);
  }
}
testPublic();
