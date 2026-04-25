import { adminAuth, adminDb } from './src/firebase-admin';

async function test() {
  try {
    console.log('Testing Admin SDK Auth...');
    const token = await adminAuth.createCustomToken('bot-system-user');
    console.log('Custom Token generated successfully!');
    
    console.log('Testing Admin SDK write to config/leaderboard...');
    await adminDb.doc('config/leaderboard').set({ rankings: ['snkrdunk_test'], updatedAt: new Date() });
    console.log('Success!');
  } catch (err: any) {
    console.error('Test Failed:', err.message);
    if (err.stack) console.error(err.stack);
  }
}

test();
