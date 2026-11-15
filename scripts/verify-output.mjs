import { readFile } from "node:fs/promises";
import { join } from "node:path";

const site = "https://nexaurenstory.com";
const active = JSON.parse(await readFile("src/data/activeTools.json", "utf8"));
const sitemap = await readFile("dist/sitemap.xml", "utf8");
const robots = await readFile("dist/robots.txt", "utf8");
const redirects = await readFile("dist/_redirects", "utf8");
const toolsPage = await readFile("dist/tools/index.html", "utf8");
const categoryPages = new Map();
const errors = [];

const homePage = await readFile("dist/index.html", "utf8");
const adsTxt = await readFile("dist/ads.txt", "utf8");
const adsPublisherLine = "google.com, pub-2381605116846917, DIRECT, f08c47fec0942fa0";
const faviconPng = await readFile("dist/favicon.png");
if (faviconPng.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
  errors.push("Favicon PNG ausente ou inválido.");
}
if (!adsTxt.split("\n").includes(adsPublisherLine)) {
  errors.push("ads.txt não contém a autorização do publicador AdSense configurado.");
}
if (!homePage.includes('href="/favicon.png"')) {
  errors.push("Favicon PNG não está ligado no cabeçalho do site.");
}
if (!homePage.includes('content="https://nexaurenstory.com/favicon.png"')) {
  errors.push("Imagem social não aponta para o logótipo Nexauren.");
}
const adsScriptMarker = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
const adsScriptCount = homePage.split(adsScriptMarker).length - 1;
if (adsScriptCount !== 1) {
  errors.push("O código AdSense deve aparecer exactamente uma vez na página inicial; encontrado: " + adsScriptCount);
}

function readStructuredData(html, route) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (!match) {
    errors.push("JSON-LD em falta: " + route);
    return null;
  }
  try { return JSON.parse(match[1]); }
  catch {
    errors.push("JSON-LD inválido: " + route);
    return null;
  }
}

function verifyOrganization(html, route) {
  const data = readStructuredData(html, route);
  if (!data) return;
  const graph = data["@graph"] ?? [];
  const organization = graph.find((item) => item["@type"] === "Organization");
  if (!organization) {
    errors.push("Organization schema em falta: " + route);
    return;
  }
  for (const social of [
    "https://www.youtube.com/@Nexauren",
    "https://bsky.app/profile/nexauren.bsky.social",
    "https://www.facebook.com/nexaurentech"
  ]) {
    if (!(organization.sameAs ?? []).includes(social)) {
      errors.push("Perfil social ausente do Organization schema: " + social);
    }
  }
}

function verifyBreadcrumb(html, route) {
  const data = readStructuredData(html, route);
  if (!data) return;
  const breadcrumb = (data["@graph"] ?? []).find((item) => item["@type"] === "BreadcrumbList");
  if (!breadcrumb) {
    errors.push("BreadcrumbList em falta: " + route);
    return;
  }
  const items = breadcrumb.itemListElement ?? [];
  if (items.length < 2) errors.push("BreadcrumbList tem menos de dois níveis: " + route);
  items.forEach((item, index) => {
    if (item.position !== index + 1 || !item.name) {
      errors.push("BreadcrumbList com posição ou nome inválido: " + route);
    }
    if (index < items.length - 1 && !item.item) {
      errors.push("Breadcrumb intermédio sem URL: " + route);
    }
  });
}

verifyOrganization(toolsPage, "/tools");
verifyBreadcrumb(toolsPage, "/tools");
const searchCards = (toolsPage.match(/data-search-values=/g) ?? []).length;
if (searchCards !== active.tools.length) {
  errors.push("Índice de pesquisa bilingue incompleto: " + searchCards + "/" + active.tools.length);
}

for (const category of active.categories) {
  const output = join("dist", "tools", category.id, "index.html");
  try {
    const html = await readFile(output, "utf8");
    categoryPages.set(category.id, html);
    verifyOrganization(html, "/tools/" + category.id);
    verifyBreadcrumb(html, "/tools/" + category.id);
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
    verifyOrganization(html, tool.path);
    verifyBreadcrumb(html, tool.path);
    if (!sitemap.includes(site + tool.path)) {
      errors.push("Página ausente no sitemap: " + tool.path);
    }
    if (!toolsPage.includes('href="' + tool.path + '"')) {
      errors.push("Ferramenta ausente do diretório principal: " + tool.path);
    }
    const categoryHtml = categoryPages.get(tool.category);
    if (!categoryHtml || !categoryHtml.includes('href="' + tool.path + '"')) {
      errors.push("Ferramenta ausente da página da categoria " + tool.category + ": " + tool.path);
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

if (errors.length) {
  console.error("Verificação do site falhou:");
  for (const error of [...new Set(errors)]) console.error(" - " + error);
  process.exit(1);
}
console.log("Pesquisa bilingue verificada: " + searchCards + " ferramentas no diretório.");
console.log("BreadcrumbList e Organization schema válidos em " + (active.categories.length + active.tools.length + 1) + " páginas de navegação.");
console.log("Ferramentas verificadas: " + active.tools.length + " páginas dedicadas, com presença no diretório, categoria e sitemap.");
console.log("SEO verificado: sitemap, robots.txt, painel privado, perfis oficiais e encaminhamento externo do blog.");
