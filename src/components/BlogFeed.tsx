import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, type Timestamp } from "firebase/firestore";
import { getFirebaseClient } from "../lib/firebase";

type Article = { slug: string; title: string; excerpt: string; coverUrl?: string; tags?: string[]; publishedAt?: Timestamp; readingMinutes?: number };
function dateLabel(value?: Timestamp) { return value?.toDate().toLocaleDateString("pt-PT", { day:"numeric", month:"long", year:"numeric" }) ?? "Publicado recentemente"; }

export default function BlogFeed() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const { db } = getFirebaseClient();
    const stop = onSnapshot(query(collection(db, "articles"), where("status", "==", "published")), (snapshot) => {
      const items = snapshot.docs.map((entry) => ({ ...(entry.data() as Article), slug: entry.id }));
      items.sort((a, b) => (b.publishedAt?.toMillis() ?? 0) - (a.publishedAt?.toMillis() ?? 0));
      setArticles(items); setLoading(false); setError("");
    }, () => { setError("Não foi possível carregar os artigos. Verifica a ligação e as regras do Firestore."); setLoading(false); });
    return stop;
  }, []);
  return <section className="blog-feed">
    {loading && <div className="blog-loading"><span className="loading-orbit"/>A carregar publicações…</div>}
    {error && <div className="error-banner">{error}</div>}
    {!loading && !error && !articles.length && <div className="blog-empty"><span className="blog-art-icon">N.</span><h2>O próximo artigo começa aqui.</h2><p>Ainda não existem artigos publicados. O conteúdo publicado no painel de administração vai aparecer automaticamente nesta página.</p></div>}
    {!!articles.length && <div className="editorial-grid">{articles.map((article) => <article className="editorial-card blog-article-card" key={article.slug}>
      {article.coverUrl ? <img className="blog-card-cover" src={article.coverUrl} alt="" loading="lazy"/> : <span className="article-card-icon">N.</span>}
      <span className="article-kicker">{(article.tags?.[0] || "NEXAUREN").toUpperCase()} · {dateLabel(article.publishedAt)}</span>
      <h2>{article.title}</h2><p>{article.excerpt}</p>
      <a href={"/blog/article?slug=" + encodeURIComponent(article.slug)}>Ler artigo <b>↗</b></a>
    </article>)}</div>}
  </section>;
}
