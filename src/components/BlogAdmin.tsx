import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { getFirebaseClient } from "../lib/firebase";
import AuthPanel from "./AuthPanel";

type Draft={slug:string;title:string;status:string;updatedAt?:{toDate:()=>Date}};
function makeSlug(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}

export default function BlogAdmin(){
 const [user,setUser]=useState<User|null>(null);const [checking,setChecking]=useState(true);const [admin,setAdmin]=useState(false);
 const [title,setTitle]=useState("");const [slug,setSlug]=useState("");const [excerpt,setExcerpt]=useState("");const [body,setBody]=useState("");const [seoTitle,setSeoTitle]=useState("");const [seoDescription,setSeoDescription]=useState("");const [tags,setTags]=useState("Guias, Tecnologia");const [status,setStatus]=useState("draft");const [cover,setCover]=useState<File|null>(null);
 const [drafts,setDrafts]=useState<Draft[]>([]);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState("");
 useEffect(()=>{const {auth}=getFirebaseClient();const stop=onAuthStateChanged(auth,async(current)=>{setUser(current);if(!current){setAdmin(false);setChecking(false);return;}try{const token=await current.getIdTokenResult(true);setAdmin(token.claims.admin===true);}catch{setAdmin(false);}finally{setChecking(false);}});return stop;},[]);
 useEffect(()=>{if(!user||!admin)return;const {db}=getFirebaseClient();const stop=onSnapshot(collection(db,"articles"),(snapshot)=>{const all=snapshot.docs.map((entry)=>({slug:entry.id,...entry.data()} as Draft));all.sort((a,b)=>(b.updatedAt?.toDate().getTime()||0)-(a.updatedAt?.toDate().getTime()||0));setDrafts(all);},()=>setError("Não foi possível carregar os rascunhos."));return stop;},[user,admin]);
 function updateTitle(value:string){setTitle(value);if(!slug||slug===makeSlug(title))setSlug(makeSlug(value));}
 function onCoverChange(event:ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0];if(!file)return;if(!file.type.startsWith("image/")){setError("A imagem de capa tem de ser JPG, PNG ou WebP.");return;}if(file.size>8*1048576){setError("A imagem de capa não pode ultrapassar 8 MB.");return;}setCover(file);setError("");}
 async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!user||!admin)return;const postSlug=makeSlug(slug);if(!title.trim()||!postSlug||!excerpt.trim()||!body.trim()){setError("Preenche título, URL, resumo e conteúdo.");return;}setBusy(true);setError("");setMessage("A preparar artigo e imagem…");try{let coverUrl="";if(cover){const storage=getStorage(getFirebaseClient().app);const extension=cover.name.split(".").pop()?.toLowerCase()||"jpg";const imageRef=ref(storage,"articles/"+user.uid+"/"+postSlug+"-"+Date.now()+"."+extension);await uploadBytes(imageRef,cover,{contentType:cover.type});coverUrl=await getDownloadURL(imageRef);}
 const {db}=getFirebaseClient();const articleRef=doc(db,"articles",postSlug);
 await setDoc(articleRef,{slug:postSlug,title:title.trim(),excerpt:excerpt.trim(),body,...(coverUrl ? {coverUrl} : {}),seoTitle:seoTitle.trim()||title.trim(),seoDescription:seoDescription.trim()||excerpt.trim(),tags:tags.split(",").map((tag)=>tag.trim()).filter(Boolean),status,publishedAt:status==="published"?serverTimestamp():null,updatedAt:serverTimestamp(),authorId:user.uid,authorName:user.displayName||user.email||"Nexauren"},{merge:true});
 setMessage(status==="published"?"Artigo publicado. Já pode aparecer no blog.":"Rascunho guardado com sucesso.");setTitle("");setSlug("");setExcerpt("");setBody("");setSeoTitle("");setSeoDescription("");setCover(null);
 }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível guardar o artigo. Verifica Firestore e Storage.");setMessage("");}finally{setBusy(false);}}
 async function remove(slugValue:string){if(!window.confirm("Eliminar o artigo "+slugValue+"? Esta ação não pode ser desfeita."))return;try{const {db}=getFirebaseClient();await deleteDoc(doc(db,"articles",slugValue));setMessage("Artigo eliminado.");}catch{setError("Não foi possível eliminar o artigo.");}}
 if(checking)return <section className="admin-gate"><span className="loading-orbit"/>A verificar a sessão administrativa…</section>;
 if(!user)return <div className="admin-auth-wrap"><p>Inicia sessão com a tua conta Nexauren. Apenas uma conta com permissão administrativa pode publicar.</p><AuthPanel/></div>;
 if(!admin)return <section className="admin-gate"><span className="admin-lock">⌑</span><h2>Acesso restrito</h2><p>A tua conta está ligada, mas não tem a permissão de administrador. Acede com a conta autorizada ou configura a permissão admin no Firebase Admin.</p><a href="/account">Abrir conta ↗</a></section>;
 return <div className="blog-admin-workspace">
  <div className="admin-welcome"><div><span className="section-kicker">NEXAUREN CMS / ADMINISTRADOR</span><h2>Painel editorial</h2><p>Publica artigos, adiciona imagens e controla títulos e descrições para pesquisa.</p></div><span className="admin-secure-badge">● ADMIN VERIFIED</span></div>
  <form className="admin-editor-form" onSubmit={save}>
   <div className="admin-form-heading"><h3>Novo artigo</h3><span>EDITOR DE CONTEÚDO</span></div>
   <label>Título do artigo<input value={title} onChange={(e)=>updateTitle(e.target.value)} maxLength={110} required placeholder="Ex.: Como reduzir o tamanho de uma imagem"/></label>
   <label>Endereço amigável (slug)<input value={slug} onChange={(e)=>setSlug(makeSlug(e.target.value))} required placeholder="como-reduzir-imagem"/></label>
   <label>Resumo / introdução<textarea value={excerpt} onChange={(e)=>setExcerpt(e.target.value)} maxLength={260} required rows={3} placeholder="Um resumo para leitores e motores de pesquisa…"/></label>
   <label>Imagem de capa<input type="file" accept="image/*" onChange={onCoverChange}/><small>JPG, PNG ou WebP · até 8 MB. A imagem é enviada para Firebase Storage.</small></label>
   <label>Conteúdo do artigo<textarea className="admin-body-editor" value={body} onChange={(e)=>setBody(e.target.value)} rows={15} required placeholder={"Escreve o artigo aqui…\n\n## Um subtítulo\n\nParágrafos normais, listas iniciadas com - e títulos com ##."}/><small>Editor de texto com Markdown básico: #, ##, ### e listas com -.</small></label>
   <div className="admin-seo-grid"><label>Título SEO<input value={seoTitle} onChange={(e)=>setSeoTitle(e.target.value)} maxLength={65} placeholder="Título otimizado para pesquisa"/></label><label>Descrição SEO<textarea value={seoDescription} onChange={(e)=>setSeoDescription(e.target.value)} maxLength={160} rows={2} placeholder="Resumo de até 160 caracteres"/></label></div>
   <label>Etiquetas, separadas por vírgulas<input value={tags} onChange={(e)=>setTags(e.target.value)} placeholder="Tecnologia, Guias, Android"/></label>
   <div className="admin-publish-row"><label>Estado<select value={status} onChange={(e)=>setStatus(e.target.value)}><option value="draft">Guardar como rascunho</option><option value="published">Publicar no blog</option></select></label><button className="primary-button" disabled={busy}>{busy?"A guardar…":status==="published"?"Publicar artigo":"Guardar rascunho"} <b>↗</b></button></div>
   {message&&<p className="auth-message" role="status">{message}</p>}{error&&<div className="error-banner" role="alert">{error}</div>}
  </form>
  <section className="admin-drafts"><div className="admin-form-heading"><h3>Artigos guardados</h3><span>{drafts.length} ENTRADA(S)</span></div>{drafts.length?drafts.map((draft)=><div className="admin-draft-row" key={draft.slug}><span><b>{draft.title}</b><small>/{draft.slug} · {draft.status}</small></span><span className={draft.status==="published"?"draft-status is-published":"draft-status"}>{draft.status==="published"?"Publicado":"Rascunho"}</span><button type="button" className="remove-file-button" onClick={()=>remove(draft.slug)}>×</button></div>):<p className="empty-account">Ainda não existem artigos.</p>}</section>
 </div>;
}
