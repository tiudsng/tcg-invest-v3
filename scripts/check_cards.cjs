
const { Firestore } = require('@google-cloud/firestore');
const db = new Firestore({
  credentials: require('/home/ubuntu/.hermes/firebase/gen-lang-client-0326385388-firebase-adminsdk.json'),
  projectId: 'gen-lang-client-0326385388',
  databaseId: 'ai-studio-507f7bd1-f48e-48fd-940f-92d962f6658b'
});

const ids = ['snkrdunk_146897', 'snkrdunk_93021', 'snkrdunk_107574'];
Promise.all(ids.map(id => db.collection('pokeca_gold').doc(id).get())).then(docs => {
  docs.forEach((d, i) => {
    if (d.exists) {
      const data = d.data();
      console.log(ids[i] + ': slug=' + data.slug + ' name_jp=' + data.name_jp + ' set_code=' + data.set_code);
    } else {
      console.log(ids[i] + ': NOT FOUND in pokeca_gold');
    }
  });
}).catch(e => console.error(e.message));
