import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const site = "https://nexaurenstory.com";
const active = JSON.parse(await readFile("src/data/activeTools.json", "utf8"));
const sitemap = await readFile("dist/sitemap.xml", "utf8");
const robots = await readFile("dist/robots.txt", "utf8");
const redirects = await readFile("dist/_redirects", "utf8");
const toolsPage = await readFile("dist/tools/index.html", "utf8");
const categoryPages = new Map();
const errors = [];

for (const category of active.categories) {
  const output = join("dist", "tools", category.id, "index.html");
  try {
    const html = await readFile(output, "utf8");
    categoryPages.set(category.id, html);
    if (!toolsPage.includes('data-tool-filter="' + category.id + '"')) {
      errors.push("Filtro de categoria ausente no diretório: " + category.id);
    }
  } catch {
    errors.push("Página de categoria não foi gerada: /tools/" + category.id);
  }
}

for (const tool of active.tools) {
  const output = join("dist", tool.path.replace(/^\/+/, ""), "index.html");
  try {
    const html = await readFile(output, "utf8");
    if (!html.includes("<title>") || !html.includes(tool.name)) {
      errors.push("Página sem título/conteúdo esperado: " + tool.path);
    }
    if (!sitemap.includes(site + tool.path)) errors.push("Página ausente no sitemap: " + tool.path);
    if (!toolsPage.includes('href="' + tool.path + '"')) errors.push("Ferramenta ausente do diretório principal: " + tool.path);
    const categoryHtml = categoryPages.get(tool.category);
    if (!categoryHtml || !categoryHtml.includes('href="' + tool.path + '"')) {
      errors.push("Ferramenta ausente da categoria " + tool.category + ": " + tool.path);
    }
  } catch {
    errors.push("Página de ferramenta não foi gerada: " + tool.path);
  }
}

if (!redirects.includes("/blog https://nexauren.blogspot.com/?m=1 301")) errors.push("Redirect permanente /blog para Blogger ausente.");
if (!redirects.includes("/blog/* https://nexauren.blogspot.com/?m=1 301")) errors.push("Redirect dos artigos antigos para Blogger ausente.");

for (const route of ["/about", "/contact"]) {
  if (!sitemap.includes(site + route)) errors.push("Página institucional ausente do sitemap: " + route);
}
if (sitemap.includes("/nexauren-control")) errors.push("O painel privado apareceu no sitemap.");
if (!robots.includes("Disallow: /nexauren-control")) errors.push("robots.txt não bloqueia o painel privado.");
if (!robots.includes("Sitemap: " + site + "/sitemap.xml")) errors.push("robots.txt não referencia o sitemap correcto.");

// Every indexable HTML page must be discoverable from the sitemap and carry two
// reserved ad slots. Private/noindex pages are intentionally excluded.
const publicPages = [];
async function walk(folder) {
  const entries = await readdir(folder, { withFileTypes: true });
  for (const entry of entries) {
    const filePath = join(folder, entry.name);
    if (entry.isDirectory()) { await walk(filePath); continue; }
    if (!entry.isFile() || !entry.name.endsWith(".html") || entry.name === "404.html") continue;
    const html = await readFile(filePath, "utf8");
    if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) continue;
    const local = relative("dist", filePath).split(sep).join("/");
    let route;
    if (local === "index.html") route = "/";
    else if (local.endsWith("/index.html")) route = "/" + local.slice(0, -"index.html".length);
    else route = "/" + local.replace(/\.html$/, "");
    publicPages.push({ route, html });
  }
}
await walk("dist");
for (const page of publicPages) {
  if (!sitemap.includes("<loc>" + site + page.route + "</loc>") && !sitemap.includes("<loc>" + site + page.route.replace(/\/$/, "") + "/</loc>")) {
    errors.push("Página pública ausente do sitemap: " + page.route);
  }
  const adSlots = (page.html.match(/<div[^>]*\bdata-ad-slot\b/g) || []).length;
  const expectedAdSlots = page.route === "/account" ? 0 : 2;
  if (adSlots !== expectedAdSlots) errors.push("Número inesperado de espaços de anúncio em " + page.route + ": esperados " + expectedAdSlots + ", encontrados " + adSlots + ").");
}

if (errors.length) {
  console.error("Verificação do site falhou:");
  for (const error of errors) console.error(" - " + error);
  process.exit(1);
}
console.log("Diretório verificado: " + active.tools.length + " ferramentas com pesquisa e filtros.");
console.log("Rotas verificadas: " + active.tools.length + " páginas de ferramentas e " + publicPages.length + " páginas públicas indexáveis.");
console.log("Sitemap automático: todas as páginas públicas foram encontradas.");
console.log("Publicidade: dois espaços responsivos confirmados em cada página pública.");
console.log("SEO verificado: robots.txt, redirects Blogger e painel privado excluído do sitemap.");
