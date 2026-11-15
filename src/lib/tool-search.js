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
  }
  return normaliseToolSearch(parts.join(" "));
}

export function matchesToolSearch(query, values, dictionary = {}) {
  const tokens = normaliseToolSearch(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const searchable = buildTranslatedSearchText(values, dictionary);
  return tokens.every((token) => searchable.includes(token));
}
