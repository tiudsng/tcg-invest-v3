import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function listLeaderboard() {
  try {
    const querySnapshot = await getDocs(collection(db, 'list_1'));
    const cards = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        rank: data.rank,
        name: data.name_zh || data.name_jp || data.card_id,
        price: data.market_data?.psa10_price || 'N/A'
      };
    });
    
    cards.sort((a, b) => a.rank - b.rank);
    console.log(JSON.stringify(cards, null, 2));
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
  }
}

listLeaderboard();
