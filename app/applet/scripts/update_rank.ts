import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from '../serviceAccountKey.json';

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore('ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b');
async function run() {
  const docRef = db.collection('config').doc('leaderboard');
  const docSnap = await docRef.get();
  const data = docSnap.data();
  
  if (data && data.rankings) {
    let rankings = data.rankings;
    
    // Remove if it's already there
    rankings = rankings.filter(r => r !== 'snkrdunk_724996');
    
    // Insert at index 2 (3rd position)
    rankings.splice(2, 0, 'snkrdunk_724996');
    
    // Keep only top 10 if necessary, but here we can just keep them all or 10.
    rankings = rankings.slice(0, 10);
    
    await docRef.update({ rankings });
    console.log('Updated rankings:', rankings);
  }
}
run().catch(console.error);
