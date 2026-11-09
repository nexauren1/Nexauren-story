import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseClient } from "../lib/firebase";

const levels=[
 {count:1,title:"Primeiro passo",description:"Experimentaste a tua primeira ferramenta.",icon:"✧"},
 {count:5,title:"Explorador",description:"Experimentaste cinco ferramentas diferentes.",icon:"⌖"},
 {count:10,title:"Curioso digital",description:"Exploraste dez ferramentas diferentes.",icon:"◈"},
 {count:25,title:"Criador ativo",description:"Usaste 25 ferramentas diferentes.",icon:"⚡"},
 {count:50,title:"Mestre de ferramentas",description:"Chegaste a metade da biblioteca.",icon:"✦"},
 {count:100,title:"Lenda Nexauren",description:"Exploraste as 100 ferramentas.",icon:"◆"}
];

export default function Achievements(){
 const [used,setUsed]=useState<string[]>([]);
 const [syncState,setSyncState]=useState("local");
 useEffect(()=>{
  const refreshLocal=()=>{try{setUsed(JSON.parse(localStorage.getItem("nexauren:tool-usage")||"[]"));}catch{setUsed([]);}setSyncState("local");};
  const {auth,db}=getFirebaseClient();
  let stopHistory:(()=>void)|undefined;
  const stopAuth=onAuthStateChanged(auth,(user)=>{
   stopHistory?.();stopHistory=undefined;
   if(!user){refreshLocal();return;}
   setSyncState("syncing");
   stopHistory=onSnapshot(collection(db,"users",user.uid,"toolHistory"),(snapshot)=>{
    const ids=[...new Set(snapshot.docs.map((entry)=>String(entry.data().id||"")).filter(Boolean))];
    setUsed(ids);setSyncState("synced");
   },()=>{refreshLocal();setSyncState("offline");});
  });
  const refresh=()=>{if(!auth.currentUser)refreshLocal();};
  window.addEventListener("nexauren:tool-used",refresh);
  return()=>{stopAuth();stopHistory?.();window.removeEventListener("nexauren:tool-used",refresh);};
 },[]);
 const count=used.length;
 return <section className="achievement-panel">
  <div className="achievement-summary"><div><span className="section-kicker">A TUA EVOLUÇÃO</span><h2>Conquistas desbloqueadas</h2><p>Experimenta ferramentas diferentes para desbloquear marcos da plataforma. {syncState==="synced"?"O progresso está sincronizado na tua conta.":"O progresso de visitante fica guardado neste navegador."}</p></div><strong>{count}<small>/100</small></strong></div>
  <div className="achievement-progress"><span style={{width:Math.min(100,count)+"%"}}/></div>
  <div className="achievement-grid">{levels.map((level)=>{const unlocked=count>=level.count;return <article className={unlocked?"achievement-card is-unlocked":"achievement-card"} key={level.count}><span className="achievement-icon">{unlocked?level.icon:"◇"}</span><span className="achievement-status">{unlocked?"DESBLOQUEADA":"BLOQUEADA"}</span><h3>{level.title}</h3><p>{level.description}</p><small>{level.count} ferramenta(s)</small></article>;})}</div>
  <p className="achievement-sync-note">{syncState==="synced"?"✓ Progresso atualizado através da conta Nexauren":syncState==="syncing"?"A sincronizar progresso…":syncState==="offline"?"Sem ligação ao histórico online; a mostrar progresso local.":"Entra na tua conta para sincronizar conquistas entre dispositivos."}</p>
 </section>;
}
