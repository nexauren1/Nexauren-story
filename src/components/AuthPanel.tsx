import { useEffect, useState, type FormEvent } from "react";
import {
  browserLocalPersistence,createUserWithEmailAndPassword,getRedirectResult,onAuthStateChanged,
  signInWithEmailAndPassword,signInWithPopup,signInWithRedirect,sendPasswordResetEmail,
  setPersistence,signOut,type User
} from "firebase/auth";
import type { Timestamp } from "firebase/firestore";
import { getFirebaseClient } from "../lib/firebase";
import { ensureUserProfile,subscribeAccountOverview,type AccountOverview } from "../lib/account";

const emptyOverview:AccountOverview={favorites:[],activity:[]};
function readableAuthError(error:unknown):string{
  const code=typeof error==="object"&&error!==null&&"code" in error?String((error as {code:unknown}).code):"";
  const messages:Record<string,string>={
    "auth/email-already-in-use":"Este e-mail já tem uma conta. Experimenta iniciar sessão.",
    "auth/invalid-credential":"E-mail ou palavra-passe incorrectos.",
    "auth/invalid-email":"O endereço de e-mail não é válido.",
    "auth/weak-password":"Escolhe uma palavra-passe com pelo menos 6 caracteres.",
    "auth/user-disabled":"Esta conta foi desactivada.",
    "auth/too-many-requests":"Demasiadas tentativas. Tenta novamente mais tarde.",
    "auth/popup-closed-by-user":"A janela do Google foi fechada antes de terminar.",
    "auth/popup-blocked":"O navegador bloqueou a janela. Permite pop-ups e tenta novamente.",
    "auth/unauthorized-domain":"Este domínio ainda não está autorizado no Firebase Authentication.",
    "auth/operation-not-allowed":"Este método de autenticação ainda não está activo no Firebase.",
    "auth/network-request-failed":"Falha de ligação. Verifica a Internet e tenta novamente."
  };
  if(code==="auth/unauthorized-domain"){
    const host=typeof window!=="undefined"?window.location.hostname:"este domínio";
    return "O domínio "+host+" ainda não está autorizado. No Firebase Console, abre Authentication → Settings → Authorized domains e adiciona este endereço sem https://.";
  }
  return messages[code]??"Não foi possível concluir a operação. Tenta novamente.";
}
function formatDate(value?:Timestamp){if(!value)return "";return value.toDate().toLocaleDateString("pt-PT",{day:"2-digit",month:"short"});}

export default function AuthPanel(){
  const [mode,setMode]=useState<"login"|"register">("login");
  const [email,setEmail]=useState(""),[password,setPassword]=useState(""),[showPassword,setShowPassword]=useState(false);
  const [busy,setBusy]=useState(false),[checking,setChecking]=useState(true),[message,setMessage]=useState("");
  const [user,setUser]=useState<User|null>(null),[overview,setOverview]=useState<AccountOverview>(emptyOverview);
  useEffect(()=>{
    if(!user){setOverview(emptyOverview);return;}
    return subscribeAccountOverview(user,setOverview,()=>setMessage("Não foi possível actualizar os dados da conta. Verifica a ligação e as regras do Firestore."));
  },[user]);
  useEffect(()=>{
    const {auth}=getFirebaseClient();let active=true;
    const stop=onAuthStateChanged(auth,current=>{
      setUser(current);setMessage("");
      if(!current){setOverview(emptyOverview);setChecking(false);return;}
      setChecking(true);
      void ensureUserProfile(current).catch(()=>{
        if(active&&auth.currentUser?.uid===current.uid)setMessage("A sessão está activa, mas não foi possível sincronizar o perfil. Verifica as regras do Firestore.");
      }).finally(()=>{if(active&&auth.currentUser?.uid===current.uid)setChecking(false);});
    });
    void getRedirectResult(auth).catch(error=>setMessage(readableAuthError(error)));
    return()=>{active=false;stop();};
  },[]);
  async function perform(action:()=>Promise<unknown>,success="Pedido concluído."){
    setBusy(true);setMessage("");
    try{await action();setMessage(success);}catch(error){setMessage(readableAuthError(error));}
    finally{setBusy(false);}
  }
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const {auth}=getFirebaseClient();
    void perform(async()=>{await setPersistence(auth,browserLocalPersistence);return mode==="register"?createUserWithEmailAndPassword(auth,email.trim(),password):signInWithEmailAndPassword(auth,email.trim(),password);});
  }
  function continueWithGoogle(){
    const {auth,googleProvider}=getFirebaseClient();googleProvider.setCustomParameters({prompt:"select_account"});
    const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    void perform(async()=>{await setPersistence(auth,browserLocalPersistence);return mobile?signInWithRedirect(auth,googleProvider):signInWithPopup(auth,googleProvider);});
  }
  function leaveAccount(){const {auth}=getFirebaseClient();void perform(()=>signOut(auth));}
  function resetPassword(){
    if(!email.trim()){setMessage("Escreve primeiro o teu e-mail para receberes o link de recuperação.");return;}
    const {auth}=getFirebaseClient();void perform(()=>sendPasswordResetEmail(auth,email.trim()),"Enviámos um link de recuperação para o teu e-mail.");
  }
  if(checking)return <section className="nx-auth-loading" aria-live="polite"><span className="nx-auth-spinner"/><b>A preparar o teu espaço pessoal</b><small>A verificar a sessão e a sincronizar os dados protegidos…</small></section>;

  if(user){
    const displayName=user.displayName??user.email?.split("@")[0]??"Utilizador";
    return <section className="nx-account-dashboard">
      <div className="nx-account-welcome">
        <div className="nx-account-avatar">{user.photoURL?<img src={user.photoURL} alt="" referrerPolicy="no-referrer"/>:<span>{displayName.charAt(0).toUpperCase()}</span>}</div>
        <div className="nx-account-identity"><span className="nx-account-status"><i/> CONTA LIGADA</span><h2>Olá, {displayName.split(/\s+/)[0]}.</h2><p>{user.email??"Conta Google"}</p></div>
        <button className="nx-signout-button" onClick={leaveAccount} disabled={busy}>{busy?"A sair…":"Terminar sessão ↗"}</button>
      </div>
      <div className="nx-account-stats">
        <div><span className="nx-stat-icon">☆</span><span><b>{overview.favorites.length}</b><small>Favoritos guardados</small></span></div>
        <div><span className="nx-stat-icon">↗</span><span><b>{overview.activity.length}</b><small>Actividades recentes</small></span></div>
        <div><span className="nx-stat-icon">✓</span><span><b>Activo</b><small>Sincronização da conta</small></span></div>
      </div>
      <div className="nx-account-content-grid">
        <section className="nx-account-content-card">
          <div className="nx-account-card-heading"><div><span>O TEU ESPAÇO</span><h3>Favoritos</h3></div><b>{overview.favorites.length.toString().padStart(2,"0")}</b></div>
          {overview.favorites.length?<ul className="nx-account-list">{overview.favorites.map(item=><li key={item.id}><span className="nx-account-list-icon">{item.kind==="app"?"▣":item.kind==="article"?"▤":"◈"}</span><span className="nx-account-list-copy"><a href={item.href}>{item.title}</a><small>{item.kind==="app"?"Aplicação":item.kind==="article"?"Artigo":item.kind==="tool"?"Ferramenta":"Secção"} · {formatDate(item.savedAt)}</small></span><a className="nx-account-open" href={item.href} aria-label={"Abrir "+item.title}>↗</a></li>)}</ul>:<div className="nx-account-empty"><span>☆</span><b>Ainda não tens favoritos</b><p>Guarda ferramentas, aplicações e artigos para os encontrares aqui.</p><a href="/tools">Explorar ferramentas ↗</a></div>}
        </section>
        <section className="nx-account-content-card">
          <div className="nx-account-card-heading"><div><span>O TEU PERCURSO</span><h3>Actividade recente</h3></div><b>{overview.activity.length.toString().padStart(2,"0")}</b></div>
          {overview.activity.length?<ul className="nx-account-list nx-activity-list">{overview.activity.map(item=><li key={item.id}><span className="nx-account-list-icon">◷</span><span className="nx-account-list-copy"><a href={item.href}>{item.title}</a><small>{item.kind==="tool"?"Ferramenta utilizada":"Página visitada"} · {formatDate(item.usedAt)}</small></span><a className="nx-account-open" href={item.href} aria-label={"Abrir "+item.title}>↗</a></li>)}</ul>:<div className="nx-account-empty"><span>◷</span><b>A tua actividade começa aqui</b><p>Quando utilizares ferramentas e explorares o site, o histórico aparece nesta área.</p><a href="/tools">Começar agora ↗</a></div>}
        </section>
      </div>
      {message&&<p className="nx-auth-message" role="status">{message}</p>}
      <div className="nx-account-privacy"><span>◈</span><p>Os teus favoritos e a tua actividade estão associados à tua conta Firebase. Usa a mesma conta noutros dispositivos para sincronizar os dados.</p></div>
    </section>;
  }

  return <section className="nx-auth-card">
    <div className="nx-auth-card-top"><span className="nx-auth-card-mark">N.</span><span className="nx-account-status"><i/> ACESSO SEGURO</span></div>
    <div className="nx-auth-heading"><span className="nx-panel-kicker">NEXAUREN ID / PERSONAL SPACE</span><h2>{mode==="login"?"Bem-vindo de volta.":"Cria o teu espaço."}</h2><p>{mode==="login"?"Entra para continuares a partir de onde ficaste.":"Regista-te para guardar favoritos e sincronizar a tua actividade."}</p></div>
    <div className="nx-auth-tabs"><button type="button" className={mode==="login"?"is-active":""} onClick={()=>{setMode("login");setMessage("");}}>Iniciar sessão</button><button type="button" className={mode==="register"?"is-active":""} onClick={()=>{setMode("register");setMessage("");}}>Criar conta</button></div>
    <button className="nx-google-button" disabled={busy} onClick={continueWithGoogle}><b>G</b><span>{busy?"A processar…":"Continuar com Google"}</span><i>↗</i></button>
    <div className="nx-auth-divider"><span/>OU UTILIZA O E-MAIL<span/></div>
    <form className="nx-auth-form" onSubmit={submit}>
      <label htmlFor="email">Endereço de e-mail</label><input id="email" type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nome@exemplo.com"/>
      <div className="nx-password-label"><label htmlFor="password">Palavra-passe</label>{mode==="login"&&<button type="button" onClick={resetPassword} disabled={busy}>Recuperar acesso</button>}</div>
      <div className="nx-password-field"><input id="password" type={showPassword?"text":"password"} minLength={6} required autoComplete={mode==="login"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres"/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Ocultar palavra-passe":"Mostrar palavra-passe"}>{showPassword?"Ocultar":"Mostrar"}</button></div>
      <button className="nx-auth-submit" disabled={busy}><span>{busy?"A processar…":mode==="login"?"Entrar na Nexauren":"Criar a minha conta"}</span><b>{busy?"◌":"↗"}</b></button>
    </form>
    {message&&<p className="nx-auth-message" role="status">{message}</p>}
    <div className="nx-auth-footnote"><span>◈</span><p>A tua sessão é protegida pelo Firebase Authentication. Nunca partilhamos a tua palavra-passe.</p></div>
  </section>;
}
