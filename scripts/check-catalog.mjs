import { readFile } from "node:fs/promises";
const catalog = JSON.parse(await readFile("src/data/toolCatalog.json", "utf8"));
const ids = catalog.tools.map((tool) => tool.id);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (catalog.tools.length !== 100 || catalog.categories.length !== 10 || duplicates.length) {
  console.error("Catálogo inválido:", { tools: catalog.tools.length, categories: catalog.categories.length, duplicates });
  process.exit(1);
}
console.log("Catálogo validado: 100 ferramentas, 10 categorias, sem IDs repetidos.");
