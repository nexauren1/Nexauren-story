import { readFile } from "node:fs/promises";
import { join } from "node:path";

const site = "https://nexaurenstory.com";
const active = JSON.parse(await readFile("src/data/activeTools.json", "utf8"));
const sitemap = await readFile("dist/sitemap.xml", "utf8");
const robots = await readFile("dist/robots.txt", "utf8");
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

for (const route of ["/about", "/contact"]) {
  if (!sitemap.includes(site + route)) errors.push("Página institucional ausente do sitemap: " + route);
}
if (sitemap.includes("/nexauren-control")) errors.push("O painel privado apareceu no sitemap.");
if (!robots.includes("Disallow: /nexauren-control")) errors.push("robots.txt não bloqueia o painel privado.");
if (!robots.includes("Sitemap: " + site + "/sitemap.xml")) errors.push("robots.txt não referencia o sitemap correcto.");

if (errors.length) {
  console.error("Verificação do site falhou:");
  for (const error of errors) console.error(" - " + error);
  process.exit(1);
}
console.log("Diretório verificado: /tools apresenta " + active.tools.length + " ferramentas pesquisáveis e filtros por categoria.");
console.log("Ferramentas verificadas: " + active.tools.length + " páginas dedicadas, com presença no diretório, categoria e sitemap.");
console.log("SEO verificado: sitemap, robots.txt e painel privado excluído.");
