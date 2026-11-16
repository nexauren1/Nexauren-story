import fs from "node:fs";
import vm from "node:vm";

const dictionary = JSON.parse(fs.readFileSync("public/translations/en.json", "utf8"));
const catalog = JSON.parse(fs.readFileSync("src/data/activeTools.json", "utf8"));
const missing = [];
const layoutSource = fs.readFileSync("src/layouts/SiteLayout.astro", "utf8");
const inlineScripts = [];
let searchFrom = 0;
const openScript = "<script is:inline>";
const closeScript = "</script>";
while (true) {
  const openAt = layoutSource.indexOf(openScript, searchFrom);
  if (openAt < 0) break;
  const bodyStart = openAt + openScript.length;
  const closeAt = layoutSource.indexOf(closeScript, bodyStart);
  if (closeAt < 0) {
    missing.push("Unclosed inline script in SiteLayout");
    break;
  }
  inlineScripts.push(layoutSource.slice(bodyStart, closeAt));
  searchFrom = closeAt + closeScript.length;
}
if (inlineScripts.length < 2) missing.push("SiteLayout is missing one of its expected inline scripts");
for (let index = 0; index < inlineScripts.length; index++) {
  try { new vm.Script(inlineScripts[index], { filename: "SiteLayout.astro:inline-script-" + index }); }
  catch (error) { missing.push("Invalid inline JavaScript: " + error.message); }
}

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
const logoSource = fs.readFileSync("public/favicon.svg", "utf8");
const logoDimensions = logoSource.match(/<svg\b[^>]*\bwidth="(\d+)"[^>]*\bheight="(\d+)"/);
if (!logoDimensions || Number(logoDimensions[1]) < 112 || Number(logoDimensions[2]) < 112) {
  missing.push("Organization logo must declare at least 112x112 dimensions");
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
  "Apoia a Nexauren Story",
  "Pesquisa rápida:",
  "Limpar pesquisa e filtros",
  "Imagem",
  "Áudio",
  "Converter",
  "Antes de descarregar, acompanha as novidades e novas ferramentas nos nossos canais.",
  "Continuar para o download",
  "Exportar relatório JSON ↓",
  "Exportar páginas CSV ↓",
  "Segue a Nexauren Story para acompanhares novas ferramentas e novidades.",
  "Aplicações",
  "APLICAÇÕES ANDROID",
  "Aplicações para o",
  "dia a dia.",
  "Conhece as aplicações Android da Nexauren e consulta as páginas oficiais de distribuição.",
  "Ver todas as aplicações",
  "ANDROID · APKPURE",
  "51 ferramentas para editar, redimensionar, comprimir e converter imagens no telemóvel.",
  "Ver detalhes da aplicação",
  "Uma aplicação prática para gerir e organizar ficheiros compactados no Android.",
  "Guias e tutoriais",
  "Análises de aplicações",
  "Novidades tecnológicas",
  "Guias práticos, análises de aplicações e explicações claras para compreender melhor a tecnologia e resolver problemas digitais do dia a dia.",
  "Ler artigos no blog",
  "Confirma os detalhes antes de instalar",
  "As versões, dimensões e requisitos podem mudar. Consulta sempre a informação atualizada na página oficial de distribuição.",
  "Descobre aplicações Android da Nexauren para editar imagens e gerir ficheiros. Consulta funcionalidades, requisitos e as páginas oficiais na APKPure."
];
const downloadClickHandler = layoutSource.match(/document\\.addEventListener\\("click",\\s*event\\s*=>\\s*\\{[\\s\\S]*?\\n\\s*\\},\\s*true\\);/);
if (!downloadClickHandler || !downloadClickHandler[0].includes('target.closest("a[download]")') ||
    !downloadClickHandler[0].includes('target.closest("[data-nexa-download-trigger]")') ||
    !downloadClickHandler[0].includes("replayingDownload")) {
  missing.push("Download interception must cover download links and explicit triggers in the capture phase");
}
for (const [file, expected] of [
  ["src/components/PDFInfo.tsx", 2],
  ["src/components/PDFCompressor.tsx", 1],
  ["src/components/TextCaseConverter.tsx", 1],
  ["src/components/TextFindReplace.tsx", 1],
  ["src/components/TextTools.tsx", 1]
]) {
  const source = fs.readFileSync(file, "utf8");
  const actual = (source.match(/data-nexa-download-trigger/g) ?? []).length;
  if (actual !== expected) missing.push(file + ": expected " + expected + " optional download prompt trigger(s), found " + actual);
}
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
console.log("English translation and inline JavaScript checks passed:", Object.keys(dictionary).length, "entries;", catalog.tools.length, "tools;", catalog.categories.length, "categories.");
