import { readFile, access } from "node:fs/promises";
const legacy = JSON.parse(await readFile("src/data/toolCatalog.json", "utf8"));
const legacyIds = legacy.tools.map((tool) => tool.id);
const legacyDuplicates = legacyIds.filter((id, index) => legacyIds.indexOf(id) !== index);
if (legacy.tools.length !== 100 || legacy.categories.length !== 10 || legacyDuplicates.length) {
  console.error("Catálogo interno inválido:", { tools: legacy.tools.length, categories: legacy.categories.length, duplicates: legacyDuplicates });
  process.exit(1);
}
const active = JSON.parse(await readFile("src/data/activeTools.json", "utf8"));
const ids = active.tools.map((tool) => tool.id), paths = active.tools.map((tool) => tool.path);
const categoryIds = active.categories.map((category) => category.id);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
const duplicatePaths = paths.filter((path, index) => paths.indexOf(path) !== index);
const duplicateCategories = categoryIds.filter((id, index) => categoryIds.indexOf(id) !== index);
if (!ids.length || !categoryIds.length || duplicateIds.length || duplicatePaths.length || duplicateCategories.length) {
  console.error("Catálogo público inválido:", { duplicateIds, duplicatePaths, duplicateCategories });
  process.exit(1);
}
const dictionary = JSON.parse(await readFile("public/translations/en.json", "utf8"));
for (const category of active.categories) for (const value of [category.name, category.description]) {
  if (!dictionary[value]) { console.error("Tradução inglesa em falta para categoria:", category.id, value); process.exit(1); }
}
for (const tool of active.tools) {
  if (!categoryIds.includes(tool.category) || !/^\/tools\/[a-z0-9-]+$/.test(tool.path)) {
    console.error("Categoria ou endereço público inválido:", tool.id, tool.category, tool.path); process.exit(1);
  }
  for (const value of [tool.name, tool.description]) {
    if (!dictionary[value]) { console.error("Tradução inglesa em falta para ferramenta:", tool.id, value); process.exit(1); }
  }
  try { await access("src/pages" + tool.path + ".astro"); }
  catch { console.error("A ferramenta não tem uma página dedicada:", tool.id, tool.path); process.exit(1); }
}
await access("src/pages/tools/[category].astro");
console.log("Catálogo validado:", active.tools.length, "ferramentas públicas em", active.categories.length, "categorias.");
console.log("Páginas dedicadas e traduções inglesas validadas; catálogo interno preservado.");
