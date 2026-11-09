import {useState,type FormEvent} from "react";
import {createUserWithEmailAndPassword,signInWithEmailAndPassword,signInWithPopup} from "firebase/auth";
import {getFirebaseClient} from "../lib/firebase";
export default function AuthPanel(){
 const [mode,setMode]=useState<"login"|"register">("login");
 const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
 const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
 async function perform(action:()=>Promise<unknown>){
  setBusy(true);setMessage("");
  try{await action();setMessage("Sessão iniciada com sucesso.");}
  catch(e){setMessage(e instanceof Error?e.message.replace("Firebase: ",""):"Não foi possível concluir.");}
  finally{setBusy(false);}
 }
 function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const {auth}=getFirebaseClient();void perform(()=>mode==="register"?createUserWithEmailAndPassword(auth,email,password):signInWithEmailAndPassword(auth,email,password));}
 return <section className="auth-panel"><div className="eyebrow"><i className="status-dot"/> CONTA NEXAUREN</div>
  <h2>{mode==="login"?"Entra no teu espaço.":"Cria a tua conta."}</h2>
  <p className="muted">Guarda favoritos, acompanha ferramentas e personaliza a tua experiência.</p>
  <button className="google-button" disabled={busy} onClick={()=>{const {auth,googleProvider}=getFirebaseClient();void perform(()=>signInWithPopup(auth,googleProvider));}}><b>G</b> Continuar com Google</button>
  <div className="or"><span/> ou com e-mail <span/></div>
  <form onSubmit={submit}><label htmlFor="email">E-mail</label><input id="email" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nome@exemplo.com"/>
  <label htmlFor="password">Palavra-passe</label><input id="password" type="password" minLength={6} required autoComplete={mode==="login"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres"/>
  <button className="button primary full" disabled={busy}>{busy?"A processar…":mode==="login"?"Iniciar sessão":"Criar conta"}</button></form>
  {message&&<p className="auth-message" role="status">{message}</p>}
  <p className="switch">{mode==="login"?"Ainda não tens conta?":"Já tens uma conta?"} <button onClick={()=>{setMode(mode==="login"?"register":"login");setMessage("");}}>{mode==="login"?"Regista-te":"Entrar"}</button></p>
  <small>O Firebase será ligado ao ambiente de produção através das variáveis de configuração.</small>
 </section>;
}