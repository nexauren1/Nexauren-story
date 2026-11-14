import { readFile, access } from "node:fs/promises";

const legacy = JSON.parse(await readFile("src/data/toolCatalog.json", "utf8"));
const legacyIds = legacy.tools.map((tool) => tool.id);
const duplicates = legacyIds.filter((id, index) => legacyIds.indexOf(id) !== index);
if (legacy.tools.length !== 100 || legacy.categories.length !== 10 || duplicates.length) {
  console.error("Catálogo interno inválido:", { tools: legacy.tools.length, categories: legacy.categories.length, duplicates });
  process.exit(1);
}

const active = JSON.parse(await readFile("src/data/activeTools.json", "utf8"));
const activeIds = active.tools.map((tool) => tool.id);
const activePaths = active.tools.map((tool) => tool.path);
const duplicateActiveIds = activeIds.filter((id, index) => activeIds.indexOf(id) !== index);
const duplicatePaths = activePaths.filter((path, index) => activePaths.indexOf(path) !== index);
const categoryIds = active.categories.map((category) => category.id);
if (!active.tools.length || !active.categories.length || duplicateActiveIds.length || duplicatePaths.length) {
  console.error("Catálogo público inválido:", { tools: active.tools.length, categories: active.categories.length, duplicateActiveIds, duplicatePaths });
  process.exit(1);
}
const locales = ["en"];
const dictionaries = {};
for (const locale of locales) {
  try {
    dictionaries[locale] = JSON.parse(await readFile("public/translations/" + locale + ".json", "utf8"));
  } catch {
    console.error("Ficheiro de tradução ausente ou inválido:", locale);
    process.exit(1);
  }
}
for (const tool of active.tools) {
  for (const locale of locales) {
    if (!dictionaries[locale][tool.name] || !dictionaries[locale][tool.description]) {
      console.error("Tradução em falta para ferramenta:", tool.id, locale);
      process.exit(1);
    }
  }
}
for (const category of active.categories) {
  for (const locale of locales) {
    if (!dictionaries[locale][category.name] || !dictionaries[locale][category.description]) {
      console.error("Tradução em falta para categoria:", category.id, locale);
      process.exit(1);
    }
  }
}
for (const tool of active.tools) {
  if (!categoryIds.includes(tool.category)) {
    console.error("Categoria inexistente para a ferramenta:", tool.id, tool.category);
    process.exit(1);
  }
  if (!/^\/tools\/[a-z0-9-]+$/.test(tool.path)) {
    console.error("Endereço público inválido:", tool.id, tool.path);
    process.exit(1);
  }
  try {
    await access("src/pages" + tool.path + ".astro");
  } catch {
    console.error("A ferramenta não tem uma página dedicada:", tool.id, tool.path);
    process.exit(1);
  }
}
console.log("Catálogo validado: " + active.tools.length + " ferramentas públicas em " + active.categories.length + " categorias; todas têm páginas Astro dedicadas.");
console.log("Idiomas validados: Inglês como idioma de interface, com Português como texto-base; nomes e descrições de todas as ferramentas traduzidos.");
console.log("Catálogo interno de experiências preservado: 100 definições; não são anunciadas como ferramentas públicas.");
