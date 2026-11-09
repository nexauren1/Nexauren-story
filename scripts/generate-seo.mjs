import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const root = "dist";
const site = "https://nexaurenstory.com";
const pages = [];
async function walk(folder) {
  const entries = await readdir(folder, { withFileTypes: true });
  for (const entry of entries) {
    const filePath = join(folder, entry.name);
    if (entry.isDirectory()) { await walk(filePath); continue; }
    if (!entry.isFile() || !entry.name.endsWith(".html") || entry.name === "404.html") continue;
    const html = await readFile(filePath, "utf8");
    if (/<meta\s+name=[\"']robots[\"']\s+content=[\"'][^\"']*noindex/i.test(html)) continue;
    const local = relative(root, filePath).split(sep).join("/");
    let route;
    if (local === "index.html") route = "/";
    else if (local.endsWith("/index.html")) route = "/" + local.slice(0, -"index.html".length);
    else route = "/" + local.replace(/\.html$/, "");
    const info = await stat(filePath);
    pages.push({ route, lastmod: info.mtime.toISOString().slice(0, 10) });
  }
}
await walk(root);
const unique = [...new Map(pages.map((page) => [page.route, page])).values()].sort((a, b) => a.route.localeCompare(b.route));
const rows = unique.map((page) => "  <url><loc>" + site + page.route + "</loc><lastmod>" + page.lastmod + "</lastmod></url>").join("\n");
const xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n" + rows + "\n</urlset>\n";
await writeFile(join(root, "sitemap.xml"), xml);
await writeFile(join(root, "robots.txt"), "User-agent: *\nAllow: /\nDisallow: /nexauren-control\nSitemap: " + site + "/sitemap.xml\n");
console.log("SEO gerado automaticamente: " + unique.length + " URLs no sitemap.xml");
