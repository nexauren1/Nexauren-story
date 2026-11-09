import { readFile } from "node:fs/promises";
const catalog = JSON.parse(await readFile("src/data/toolCatalog.json", "utf8"));
const sitemap = await readFile("dist/sitemap.xml", "utf8");
const missing = catalog.tools.filter((tool) => !sitemap.includes("https://nexaurenstory.com/tools/" + tool.id));
if (missing.length) { console.error("Faltam URLs de ferramentas no sitemap:", missing.map((tool) => tool.id)); process.exit(1); }
if (sitemap.includes("/nexauren-control")) { console.error("A rota administrativa não pode aparecer no sitemap."); process.exit(1); }
console.log("SEO verificado: URLs das 100 ferramentas presentes; painel privado excluído.");
