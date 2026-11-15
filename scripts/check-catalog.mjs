const locales = ["en", "es", "fr", "de"];
const dictionaries = Object.fromEntries(await Promise.all(locales.map(async (locale) => {
  try {
    const dictionary = JSON.parse(await readFile("public/translations/" + locale + ".json", "utf8"));
    return [locale, dictionary];
  } catch {
    console.error("Ficheiro de tradução ausente ou inválido:", locale);
    process.exit(1);
  }
})));
for (const category of active.categories) {
  if (!category.id || !category.name || !category.description) {
    console.error("Categoria pública incompleta:", category);
    process.exit(1);
  }
  for (const locale of locales) {
    for (const value of [category.name, category.description]) {
      if (typeof dictionaries[locale][value] !== "string" || !dictionaries[locale][value].trim()) {
        console.error("Tradução em falta para categoria:", category.id, locale, value);
        process.exit(1);
      }
    }
  }
}
for (const tool of active.tools) {
  if (!categoryIds.includes(tool.category) || !/^\\/tools\\/[a-z0-9-]+$/.test(tool.path)) {
    console.error("Categoria ou endereço público inválido:", tool.id, tool.category, tool.path);
    process.exit(1);
  }
  for (const locale of locales) {
    for (const value of [tool.name, tool.description]) {
      if (typeof dictionaries[locale][value] !== "string" || !dictionaries[locale][value].trim()) {
        console.error("Tradução em falta para ferramenta:", tool.id, locale, value);
        process.exit(1);
      }
    }
  }
  try { await access("src/pages" + tool.path + ".astro"); }
  catch { console.error("A ferramenta não tem uma página dedicada:", tool.id, tool.path); process.exit(1); }
}
await access("src/pages/tools/[category].astro");
console.log("Catálogo validado:", active.tools.length, "ferramentas públicas em", active.categories.length, "categorias.");
console.log("Páginas dedicadas e traduções inglesas validadas; catálogo interno preservado.");
