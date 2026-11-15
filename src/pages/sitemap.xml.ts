import type { APIRoute } from "astro";
import catalog from "../data/activeTools.json";

const site = "https://nexaurenstory.com";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export const GET: APIRoute = () => {
  const routes = new Set([
    "/",
    "/tools",
    "/apps",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    ...catalog.categories.map((category) => "/tools/" + category.id),
    ...catalog.tools.map((tool) => tool.path)
  ]);
  const urls = [...routes].sort().map((route) =>
    "  <url><loc>" + escapeXml(site + route) + "</loc></url>"
  ).join("\n");
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls + "\n</urlset>\n";

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
};
