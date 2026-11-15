const SEARCH_ALIASES = {
  image: "images imagem imagens photo photos picture pictures fotografia fotografias",
  pdf: "document documentos documents ficheiro files arquivo archives",
  text: "texto words characters string formatting",
  audio: "som sound musica music",
  "image-resizer": "redimensionar redimensionar imagem resize resizing image compression photo resize image compressor",
  "image-cropper": "recortar recorte cortar crop cropping image trim",
  "image-convert": "converter conversor converter imagem image format conversion",
  "pdf-merger": "juntar juntar pdfs combinar combinar pdf merge merging combine combine pdf join",
  "pdf-splitter": "extrair extrair paginas separar dividir split extract pages divide",
  "pdf-split": "extrair paginas dividir split extract pages",
  "pdf-compressor": "comprimir compress compression reduzir tamanho reduce size",
  "pdf-rotator": "rodar rodar paginas rotate rotation orientation",
  "pdf-rotate": "rodar rodar paginas rotate rotation",
  "audio-cutter": "cortar cortar audio trim trimming cut audio",
  "audio-normalizer": "normalizar normalizar volume normalize normalise loudness",
  "text-case-converter": "converter formato texto text case converter camelcase snakecase",
  "text-find-replace": "localizar substituir procurar find replace search",
  "text-toolbox": "caixa ferramentas texto text utilities word counter"
};

export function normaliseToolSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function buildTranslatedSearchText(values, dictionary = {}) {
  const parts = [];
  for (const value of values ?? []) {
    if (typeof value !== "string" || !value.trim()) continue;
    parts.push(value);
    const translated = dictionary[value];
    if (typeof translated === "string" && translated.trim()) parts.push(translated);
    const alias = SEARCH_ALIASES[value.toLocaleLowerCase()];
    if (alias) parts.push(alias);
  }
  return normaliseToolSearch(parts.join(" "));
}

export function matchesToolSearch(query, values, dictionary = {}) {
  const tokens = normaliseToolSearch(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const searchable = buildTranslatedSearchText(values, dictionary);
  return tokens.every((token) => searchable.includes(token));
}
