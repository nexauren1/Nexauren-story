import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildTranslatedSearchText, matchesToolSearch, normaliseToolSearch } from "../src/lib/tool-search.js";

const dictionary = JSON.parse(await readFile(new URL("../public/translations/en.json", import.meta.url), "utf8"));
const catalog = JSON.parse(await readFile(new URL("../src/data/activeTools.json", import.meta.url), "utf8"));

assert.equal(normaliseToolSearch("Áudio e Imagens"), "audio e imagens");

const getTool = (id) => {
  const tool = catalog.tools.find((item) => item.id === id);
  assert.ok(tool, "Missing catalogue tool: " + id);
  const category = catalog.categories.find((item) => item.id === tool.category);
  return [tool.name, tool.description, tool.id, tool.id.replaceAll("-", " "), category?.name, category?.description, category?.id];
};

assert.equal(matchesToolSearch("redimensionar imagem", getTool("image-resizer"), dictionary), true);
assert.equal(matchesToolSearch("image resizer", getTool("image-resizer"), dictionary), true);
assert.equal(matchesToolSearch("compressor resize", getTool("image-resizer"), dictionary), true);
assert.equal(matchesToolSearch("pdf nonsense xyz", getTool("image-resizer"), dictionary), false);
assert.equal(matchesToolSearch("merge pdf", getTool("pdf-merger"), dictionary), true);
assert.equal(matchesToolSearch("juntar PDFs", getTool("pdf-merger"), dictionary), true);
assert.equal(matchesToolSearch("trim audio", getTool("audio-cutter"), dictionary), true);
assert.equal(matchesToolSearch("cortar audio", getTool("audio-cutter"), dictionary), true);

for (const tool of catalog.tools) {
  const values = getTool(tool.id);
  assert.ok(buildTranslatedSearchText(values, dictionary).length > 0, "Empty search index: " + tool.id);
  const category = catalog.categories.find((item) => item.id === tool.category);
  for (const value of [tool.name, tool.description, category?.name, category?.description]) {
    assert.equal(typeof dictionary[value], "string", "Missing English search translation: " + value);
  }
}

console.log("Tool search checks passed: Portuguese, English, accents, multi-word queries and all " + catalog.tools.length + " catalogue entries.");
