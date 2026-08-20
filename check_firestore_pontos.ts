import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  console.log("=== CHECKING prePontos COLLECTION ===");
  const snapPre = await getDocs(collection(db, "prePontos"));
  console.log(`Total de documentos em 'prePontos': ${snapPre.size}`);

  let pendentes = 0;
  snapPre.forEach(docSnap => {
    const data = docSnap.data();
    if (data.status === "pendente") {
      pendentes++;
      console.log(`Pendente ID ${docSnap.id}: User ${data.userId} (${data.userName}) -> dia ${data.dayKey} hora ${data.quando} / ${data.hora}`);
    }
  });
  console.log(`Total de pré-pontos pendentes: ${pendentes}`);

  console.log("\n=== CHECKING 'pontos' QUERY WITH where('mes', '==', '2026-08') ===");
  const q = query(collection(db, "pontos"), where("mes", "==", "2026-08"));
  const snapQuery = await getDocs(q);
  console.log(`Docs retornados pela query 'mes == 2026-08': ${snapQuery.size}`);

  const snapAll = await getDocs(collection(db, "pontos"));
  console.log(`Docs totais na coleção 'pontos': ${snapAll.size}`);

  let semCampoMes = 0;
  snapAll.forEach(docSnap => {
    const d = docSnap.data();
    if (!d.mes && docSnap.id.includes("_2026-08")) {
      semCampoMes++;
      console.log(`Doc ID ${docSnap.id} NÃO TEM O CAMPO 'mes'!`);
    }
  });
  console.log(`Docs sem campo 'mes': ${semCampoMes}`);
}

run().catch(console.error);
