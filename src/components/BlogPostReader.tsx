import { useEffect, useState } from "react";
import { doc, getDoc, type Timestamp } from "firebase/firestore";
import { getFirebaseClient } from "../lib/firebase";
type Article = { slug: string; title: string; excerpt: string; body: string; coverUrl?: string; tags?: string[]; publishedAt?: Timestamp; seoTitle?: string; seoDescription?: string; status: string };
export default function BlogPostReader() {
  const [article,setArticle]=useState<Article|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [dateLocale,setDateLocale]=useState("en-US");
  useEffect(()=>{
    const root=document.documentElement;
    const updateLocale=()=>setDateLocale(root.lang==="pt"?"pt-PT":"en-US");
    updateLocale();
    const observer=new MutationObserver(updateLocale);
    observer.observe(root,{attributes:true,attributeFilter:["lang"]});
    return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    const slug=new URLSearchParams(window.location.search).get("slug");
    if(!slug){setError("O endereço do artigo não contém um identificador.");setLoading(false);return;}
    const {db}=getFirebaseClient();
    void getDoc(doc(db,"articles",slug)).then((snapshot)=>{
      if(!snapshot.exists()||snapshot.data().status!=="published"){setError("Este artigo não existe ou ainda não foi publicado.");return;}
      const data={...(snapshot.data() as Article),slug:snapshot.id};setArticle(data);
      document.title=(data.seoTitle||data.title)+" | Nexauren";
      const meta=document.querySelector('meta[name="description"]');if(meta)meta.setAttribute("content",data.seoDescription||data.excerpt);
      const heading=document.querySelector('meta[property="og:title"]');if(heading)heading.setAttribute("content",data.seoTitle||data.title);
      const description=document.querySelector('meta[property="og:description"]');if(description)description.setAttribute("content",data.seoDescription||data.excerpt);
      const canonical=document.querySelector('link[rel="canonical"]');if(canonical)canonical.setAttribute("href",window.location.href);
    }).catch(()=>setError("Não foi possível carregar este artigo.")).finally(()=>setLoading(false));
  },[]);
  if(loading)return <div className="blog-loading"><span className="loading-orbit"/>A preparar o artigo…</div>;
  if(error||!article)return <div className="blog-empty"><h2>Artigo indisponível</h2><p>{error}</p><a className="text-link" href="/blog">Voltar ao blog ↗</a></div>;
  return <article className="article-page blog-post-reader">
    <div className="article-meta">{(article.tags||["NEXAUREN"]).join(" · ").toUpperCase()} <span>•</span> {article.publishedAt?.toDate().toLocaleDateString(dateLocale)||"Publicado"}</div>
    <h1>{article.title}</h1><p className="article-intro">{article.excerpt}</p>
    {article.coverUrl&&<img className="blog-post-cover" src={article.coverUrl} alt={article.title}/>}
    <div className="article-body-text">{article.body.split(/\n{2,}/).map((paragraph,index)=>{
      const line=paragraph.trim();if(!line)return null;
      if(line.startsWith("### "))return <h3 key={index}>{line.slice(4)}</h3>;
      if(line.startsWith("## "))return <h2 key={index}>{line.slice(3)}</h2>;
      if(line.startsWith("# "))return <h2 key={index}>{line.slice(2)}</h2>;
      if(line.startsWith("- "))return <ul key={index}>{line.split("\n").map((item,i)=><li key={i}>{item.replace(/^- /,"")}</li>)}</ul>;
      return <p key={index}>{line}</p>;
    })}</div>
    <div className="article-tool-cta"><div><b>Explora mais ferramentas Nexauren</b><small>Continua a trabalhar com as ferramentas gratuitas da plataforma.</small></div><a href="/tools">Abrir ferramentas ↗</a></div>
  </article>;
}
