import fs from "node:fs";

const dictionary = JSON.parse(fs.readFileSync("public/translations/en.json", "utf8"));
const catalog = JSON.parse(fs.readFileSync("src/data/activeTools.json", "utf8"));
const missing = [];

for (const category of catalog.categories ?? []) {
  for (const value of [category.name, category.description]) {
    if (typeof value === "string" && !(value in dictionary)) missing.push(value);
  }
}
for (const tool of catalog.tools ?? []) {
  for (const value of [tool.name, tool.description]) {
    if (typeof value === "string" && !(value in dictionary)) missing.push(value);
  }
}
const required = [
  "Executar ferramenta",
  "Processamento concluído no teu dispositivo.",
  "O resultado da operação vai aparecer nesta área.",
  "Pré-visualizar resultado",
  "Arraste e solte os ficheiros PDF aqui",
  "A preparar a normalização…",
  "A descodificar…",
  "A converter…",
  "A aplicar substituições…",
  "Segue a Nexauren Story para acompanhares novas ferramentas e novidades."
];
for (const key of required) if (!(key in dictionary)) missing.push(key);
for (const [key, value] of Object.entries(dictionary)) {
  if (!key.trim() || typeof value !== "string" || !value.trim()) {
    missing.push("Invalid entry: " + JSON.stringify(key));
  }
}
if (missing.length) {
  console.error("Missing or invalid English translations:");
  for (const item of [...new Set(missing)]) console.error(" - " + item);
  process.exit(1);
}
console.log("English translation check passed:", Object.keys(dictionary).length, "entries;", catalog.tools.length, "tools;", catalog.categories.length, "categories.");
