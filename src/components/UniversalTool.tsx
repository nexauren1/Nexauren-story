import { useMemo, useRef, useState, type ChangeEvent } from "react";

type Props = { toolId: string; name: string; category: string; description: string; kind: string };
const encoder = new TextEncoder();
const decoder = new TextDecoder();
function escapeHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;"); }
function decodeEntities(value: string) { const el = document.createElement("textarea"); el.innerHTML = value; return el.value; }
function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function sizeLabel(bytes: number) { return bytes < 1048576 ? (bytes / 1024).toFixed(1) + " KB" : (bytes / 1048576).toFixed(2) + " MB"; }
function parsePages(value: string, total: number) {
  const chosen = new Set<number>();
  for (const part of value.split(",")) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error("Indica páginas como 1-3,5,8-10.");
    const first = Number(match[1]); const last = Number(match[2] || match[1]);
    if (first < 1 || last < first || last > total) throw new Error("As páginas têm de estar entre 1 e " + total + ".");
    for (let page = first; page <= last; page++) chosen.add(page - 1);
  }
  return [...chosen].sort((a, b) => a - b);
}
function parsePageOrder(value: string, total: number): number[] {
  const chosen: number[] = [];
  for (const part of value.split(",")) {
    const match = part.trim().match(/^(\\d+)(?:\\s*-\\s*(\\d+))?$/);
    if (!match) throw new Error("Usa a ordem desejada, por exemplo 3,1-2,5.");
    const first = Number(match[1]); const last = Number(match[2] || match[1]);
    if (first < 1 || last < first || last > total) throw new Error("As páginas têm de estar entre 1 e " + total + ".");
    for (let page = first; page <= last; page++) if (!chosen.includes(page - 1)) chosen.push(page - 1);
  }
  if (!chosen.length) throw new Error("Indica pelo menos uma página.");
  return chosen;
}
function parseCsv(source: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === "\"" && quoted && source[i + 1] === "\"") { cell += "\""; i++; }
    else if (ch === "\"") quoted = !quoted;
    else if (ch === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) { if (ch === "\r" && source[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  row.push(cell); if (row.some((item) => item.length)) rows.push(row);
  if (quoted) throw new Error("O CSV contém aspas sem fecho.");
  return rows;
}
function colorChannels(hex: string): [number, number, number] {
  let value = hex.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(value)) value = value.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(value)) throw new Error("Usa uma cor HEX válida, por exemplo #3158C7.");
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}
function rgbHex(r: number, g: number, b: number) { return "#" + [r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("").toUpperCase(); }
function relativeLuminance(rgb: [number, number, number]) {
  const values = rgb.map((v) => v / 255).map((v) => v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4));
  return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
}
function encodeWav(channels: Float32Array[], sampleRate: number): Blob {
  const count = channels.length; const frames = channels[0]?.length ?? 0; const bytes = frames * count * 2;
  const buffer = new ArrayBuffer(44 + bytes); const view = new DataView(buffer);
  const write = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  write(0, "RIFF"); view.setUint32(4, 36 + bytes, true); write(8, "WAVE"); write(12, "fmt "); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, count, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * count * 2, true);
  view.setUint16(32, count * 2, true); view.setUint16(34, 16, true); write(36, "data"); view.setUint32(40, bytes, true);
  let offset = 44;
  for (let frame = 0; frame < frames; frame++) for (let channel = 0; channel < count; channel++) {
    const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
    view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true); offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}
function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const link = document.createElement("a");
  link.href = url; link.download = name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export default function UniversalTool({ toolId, name, category, description, kind }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [paramA, setParamA] = useState("");
  const [paramB, setParamB] = useState("");
  const [paramC, setParamC] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState("image/webp");
  const [result, setResult] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [downloadName, setDownloadName] = useState("resultado.txt");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [complete, setComplete] = useState(false);
  const isFileTool = ["image", "pdf", "audio"].includes(kind);
  const accepts = kind === "image" ? "image/*" : kind === "pdf" ? ".pdf,application/pdf" : "audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac";
  const helper = useMemo(() => {
    if (toolId.startsWith("pdf-")) return "Seleciona um PDF. Para operações de várias páginas, indica intervalos como 1-3,5.";
    if (toolId.startsWith("audio-")) return "O áudio é descodificado no dispositivo e exportado em WAV PCM.";
    if (toolId.startsWith("image-")) return "O processamento da imagem é feito localmente no teu navegador.";
    if (toolId.includes("date") || toolId.includes("weekday") || toolId.includes("days-in") || toolId.includes("unix-time") || toolId.includes("age-")) return "Usa uma data no formato indicado. Os cálculos são feitos no teu dispositivo.";
    if (kind === "calculators") return "Introduz os valores nos campos e executa o cálculo.";
    return "Os dados são processados no teu dispositivo. Nada é enviado para a Nexauren.";
  }, [toolId, kind]);

  function setNewFiles(list: FileList | File[]) {
    const selected = Array.from(list);
    if (!selected.length) return;
    if (selected.some((file) => file.size > 60 * 1048576)) { setError("Cada ficheiro deve ter no máximo 60 MB."); return; }
    if (kind !== "pdf" && selected.length > 1) { setError("Esta ferramenta aceita apenas um ficheiro."); return; }
    setFiles(kind === "pdf" && toolId === "pdf-merge" ? selected : selected.slice(0, 1));
    setResult(""); setResultUrl(""); setError(""); setNotice(""); setComplete(false); setProgress(0);
  }
  function onFileChange(event: ChangeEvent<HTMLInputElement>) { if (event.target.files) setNewFiles(event.target.files); event.target.value = ""; }

  async function runTextOperation(): Promise<string> {
    const value = text;
    const lines = value.replace(/\r\n/g, "\n").split("\n");
    switch (toolId) {
      case "uuid-generator": return crypto.randomUUID();
      case "password-generator": { const length = Math.max(8, Math.min(128, Number(paramA) || 24)); const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-_"; const random = crypto.getRandomValues(new Uint32Array(length)); return Array.from(random, (value) => alphabet[value % alphabet.length]).join(""); }
      case "random-number-generator": { const min = Number(paramA || 0); const max = Number(paramB || 100); if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) throw new Error("Define um intervalo válido."); const amount = Math.max(1, Math.min(100, Number(paramC) || 10)); const random = crypto.getRandomValues(new Uint32Array(amount)); return Array.from(random, (value) => String(Math.floor(value / 4294967296 * (max - min + 1)) + min)).join("\n"); }
      case "hex-generator": { const length = Math.max(8, Math.min(128, Number(paramA) || 32)); const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil(length / 2))); return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("").slice(0, length); }
      case "css-gradient-generator": return "background: linear-gradient(135deg, #3158C7 0%, #16A085 100%);";
      case "text-word-counter": {
        const words = value.trim() ? value.trim().split(/\s+/u).length : 0;
        return "PALAVRAS  " + words + "\nCARACTERES  " + value.length + "\nSEM ESPAÇOS  " + value.replace(/\s/g, "").length + "\nLINHAS  " + (value ? lines.length : 0) + "\nPARÁGRAFOS  " + (value.trim() ? value.trim().split(/\n\s*\n/).length : 0);
      }
      case "text-character-counter": return "Caracteres: " + value.length + "\nSem espaços: " + value.replace(/\s/g, "").length + "\nBytes UTF-8: " + encoder.encode(value).length;
      case "text-uppercase": return value.toLocaleUpperCase();
      case "text-lowercase": return value.toLocaleLowerCase();
      case "text-title-case": return value.toLocaleLowerCase().replace(/(^|[\s-])\p{L}/gu, (part) => part.toLocaleUpperCase());
      case "text-clean-spaces": return lines.map((line) => line.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n");
      case "text-sort-lines": return [...lines].map((line) => line.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt")).join("\n");
      case "text-unique-lines": return [...new Set(lines.map((line) => line.trim()).filter(Boolean))].join("\n");
      case "text-reverse-lines": return [...lines].reverse().join("\n");
      case "text-slug": return slugify(value);
      case "base64-encode": { const bytes = encoder.encode(value); let binary = ""; bytes.forEach((byte) => binary += String.fromCharCode(byte)); return btoa(binary); }
      case "base64-decode": { const binary = atob(value.trim()); const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0)); return decoder.decode(bytes); }
      case "url-encode": return encodeURIComponent(value);
      case "url-decode": return decodeURIComponent(value);
      case "html-escape": return escapeHtml(value);
      case "html-unescape": return decodeEntities(value);
      case "csv-to-json": {
        const rows = parseCsv(value); if (rows.length < 2) throw new Error("Adiciona uma linha de cabeçalho e pelo menos uma linha de dados.");
        const headers = rows[0]; return JSON.stringify(rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))), null, 2);
      }
      case "json-to-csv": {
        const data = JSON.parse(value); if (!Array.isArray(data) || !data.length || typeof data[0] !== "object") throw new Error("O JSON tem de ser uma lista de objetos.");
        const headers = [...new Set(data.flatMap((entry) => Object.keys(entry)))];
        const quote = (v: unknown) => "\"" + String(v ?? "").replace(/"/g, "\"\"") + "\"";
        return [headers.map(quote).join(","), ...data.map((entry) => headers.map((header) => quote(entry[header])).join(","))].join("\n");
      }
      case "text-to-binary": return [...encoder.encode(value)].map((byte) => byte.toString(2).padStart(8, "0")).join(" ");
      case "binary-to-text": {
        const bits = value.trim().split(/\s+/); if (!bits.length || bits.some((bit) => !/^[01]{8}$/.test(bit))) throw new Error("Usa grupos de 8 bits separados por espaços.");
        return decoder.decode(new Uint8Array(bits.map((bit) => parseInt(bit, 2))));
      }
      case "json-formatter": return JSON.stringify(JSON.parse(value), null, 2);
      case "json-minifier": return JSON.stringify(JSON.parse(value));
      case "json-validator": JSON.parse(value); return "JSON válido. A estrutura pode ser interpretada sem erros.";
      case "jwt-decoder": {
        const parts = value.trim().split("."); if (parts.length !== 3) throw new Error("Um JWT deve conter três partes separadas por pontos.");
        const parse = (part: string) => JSON.stringify(JSON.parse(decoder.decode(Uint8Array.from(atob(part.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)))), null, 2);
        return "CABEÇALHO\n" + parse(parts[0]) + "\n\nPAYLOAD\n" + parse(parts[1]) + "\n\nAtenção: a assinatura não foi validada.";
      }
      case "regex-tester": {
        const expression = new RegExp(paramA, paramB.includes("g") ? paramB : paramB + "g");
        const matches = [...value.matchAll(expression)]; return matches.length ? matches.map((match, index) => (index + 1) + ". " + match[0] + " (posição " + match.index + ")").join("\n") : "Nenhuma correspondência encontrada.";
      }
      case "timestamp-converter": {
        const timestamp = Number(value.trim()); if (!Number.isFinite(timestamp)) throw new Error("Introduz um timestamp Unix em segundos ou milissegundos.");
        const date = new Date(Math.abs(timestamp) < 1e12 ? timestamp * 1000 : timestamp); if (Number.isNaN(date.getTime())) throw new Error("Timestamp fora do intervalo.");
        return "ISO: " + date.toISOString() + "\nLocal: " + date.toLocaleString() + "\nUnix (s): " + Math.floor(date.getTime() / 1000);
      }
      case "url-parser": {
        const url = new URL(value.trim()); return JSON.stringify({ protocol: url.protocol, hostname: url.hostname, port: url.port, pathname: url.pathname, query: Object.fromEntries(url.searchParams), hash: url.hash }, null, 2);
      }
      case "html-preview-code": return escapeHtml(value);
      case "css-minifier": return value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{}:;,])\s*/g, "$1").trim();
      case "csv-validator": {
        const rows = parseCsv(value); if (rows.length < 2) throw new Error("Adiciona cabeçalho e linhas de dados.");
        const expected = rows[0].length; const invalid = rows.map((row, index) => ({ index: index + 1, count: row.length })).filter((row) => row.count !== expected);
        return invalid.length ? "Encontradas " + invalid.length + " linha(s) com número de colunas diferente de " + expected + ":\n" + invalid.map((row) => "Linha " + row.index + ": " + row.count + " colunas").join("\n") : "CSV válido: " + rows.length + " linhas e " + expected + " colunas.";
      }
      case "sha256-generator": {
        const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
        return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      }
      case "lorem-generator": {
        const words = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua".split(" ");
        const count = Math.max(10, Math.min(1000, Number(paramA) || 80)); return Array.from({ length: count }, (_, index) => words[index % words.length]).join(" ").replace(/([.!?]\s+)([a-z])/g, (m) => m.toUpperCase()) + ".";
      }
      case "username-generator": {
        const base = slugify(value || "nexauren").replace(/-/g, ""); const suffix = crypto.getRandomValues(new Uint16Array(1))[0] % 10000;
        return base + suffix.toString().padStart(4, "0");
      }
      case "html-starter-generator": return "<!doctype html>\n<html lang=\"pt\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <title>" + escapeHtml(value || "Nova página") + "</title>\n</head>\n<body>\n  <main>\n    <h1>" + escapeHtml(value || "Olá, mundo!") + "</h1>\n  </main>\n</body>\n</html>";
      case "json-schema-generator": {
        const sample = JSON.parse(value); const infer = (entry: unknown): unknown => {
          if (entry === null) return { type: "null" }; if (Array.isArray(entry)) return { type: "array", items: entry.length ? infer(entry[0]) : {} };
          if (typeof entry === "object") return { type: "object", properties: Object.fromEntries(Object.entries(entry as Record<string, unknown>).map(([key, val]) => [key, infer(val)])), required: Object.keys(entry as object) };
          return { type: typeof entry === "number" ? "number" : typeof entry, ...(typeof entry === "string" ? { minLength: 0 } : {}) };
        };
        return JSON.stringify({ "$schema": "https://json-schema.org/draft/2020-12/schema", ...infer(sample) }, null, 2);
      }
      default: throw new Error("Esta operação ainda não está disponível nesta área.");
    }
  }

  async function runCalculator(): Promise<string> {
    const a = Number(paramA.replace(",", ".")); const b = Number(paramB.replace(",", ".")); const c = Number(paramC.replace(",", "."));
    const fmt = (n: number) => Number.isFinite(n) ? new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 6 }).format(n) : "—";
    switch (toolId) {
      case "percentage-calculator": return fmt(a * b / 100) + " (" + fmt(b) + "% de " + fmt(a) + ")";
      case "percentage-change": if (!a) throw new Error("O valor inicial não pode ser zero."); return fmt(((b - a) / Math.abs(a)) * 100) + "% de variação";
      case "discount-calculator": return "Desconto: " + fmt(a * b / 100) + "\nPreço final: " + fmt(a * (1 - b / 100));
      case "vat-calculator": return "IVA: " + fmt(a * b / 100) + "\nTotal com IVA: " + fmt(a * (1 + b / 100));
      case "rule-of-three": if (!a) throw new Error("O primeiro valor não pode ser zero."); return "Resultado: " + fmt((b * c) / a);
      case "average-calculator": {
        const values = text.split(/[,\s;]+/).map(Number).filter(Number.isFinite); if (!values.length) throw new Error("Escreve números separados por vírgulas ou espaços.");
        return "Quantidade: " + values.length + "\nSoma: " + fmt(values.reduce((sum, n) => sum + n, 0)) + "\nMédia: " + fmt(values.reduce((sum, n) => sum + n, 0) / values.length);
      }
      case "simple-interest": return "Juros: " + fmt(a * (b / 100) * c) + "\nMontante final: " + fmt(a * (1 + (b / 100) * c));
      case "compound-interest": return "Montante final: " + fmt(a * Math.pow(1 + b / 100, c)) + "\nJuros acumulados: " + fmt(a * Math.pow(1 + b / 100, c) - a);
      case "bill-splitter": if (b <= 0) throw new Error("O número de pessoas tem de ser superior a zero."); return "Cada pessoa paga: " + fmt(a / b);
      case "unit-converter": {
        const unit = paramB || "km-mi"; const factors: Record<string, number> = { "km-mi": .621371, "mi-km": 1.60934, "kg-lb": 2.20462, "lb-kg": .453592, "c-f": 1.8, "m-ft": 3.28084, "ft-m": .3048 };
        if (unit === "c-f") return fmt(a * 1.8 + 32) + " °F";
        if (unit === "f-c") return fmt((a - 32) / 1.8) + " °C";
        if (unit === "c-k") return fmt(a + 273.15) + " K";
        if (factors[unit] === undefined) throw new Error("Escolhe km-mi, mi-km, kg-lb, lb-kg, m-ft, ft-m, c-f, f-c ou c-k.");
        return fmt(a * factors[unit]);
      }
      default: throw new Error("Cálculo desconhecido.");
    }
  }

  async function runColor(): Promise<string> {
    if (toolId === "random-color") { const bytes = crypto.getRandomValues(new Uint8Array(3)); return rgbHex(bytes[0], bytes[1], bytes[2]); }
    if (toolId === "rgb-to-hex") { return rgbHex(Number(paramA), Number(paramB), Number(paramC)); }
    if (toolId === "hex-to-rgb") { const rgb = colorChannels(text); return "rgb(" + rgb.join(", ") + ")\nR: " + rgb[0] + "\nG: " + rgb[1] + "\nB: " + rgb[2]; }
    if (toolId === "contrast-checker") {
      const first = relativeLuminance(colorChannels(text)); const second = relativeLuminance(colorChannels(paramA));
      const ratio = (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
      return "Rácio de contraste: " + ratio.toFixed(2) + ":1\nWCAG AA texto normal: " + (ratio >= 4.5 ? "Passa" : "Não passa") + "\nWCAG AAA texto normal: " + (ratio >= 7 ? "Passa" : "Não passa");
    }
    const base = colorChannels(text || "#3158C7");
    const hex = (values: number[]) => rgbHex(values[0], values[1], values[2]);
    if (toolId === "complementary-color") return "Original: " + hex(base) + "\nComplementar: " + hex(base.map((n) => 255 - n));
    if (toolId === "analogous-palette") return [base, [base[1], base[2], base[0]], [base[2], base[0], base[1]], base.map((n) => Math.round(n * .72)), base.map((n) => Math.min(255, Math.round(n + (255 - n) * .28)))].map(hex).join("\n");
    if (toolId === "gradient-css" || toolId === "css-gradient-generator") return "background: linear-gradient(135deg, " + (text || "#3158C7") + ", " + (paramA || "#16A085") + ");";
    if (toolId === "color-mixer") { const other = colorChannels(paramA || "#16A085"); return hex(base.map((n, index) => (n + other[index]) / 2)); }
    if (toolId === "alpha-color") { const alpha = Math.max(0, Math.min(100, Number(paramA) || 100)); return text.replace("#", "#") + Math.round(alpha * 2.55).toString(16).padStart(2, "0").toUpperCase(); }
    if (toolId === "text-color-picker") {
      const lum = relativeLuminance(base); const black = (lum + .05) / .05; const white = 1.05 / (lum + .05);
      return "Fundo: " + hex(base) + "\nCor de texto sugerida: " + (black >= white ? "#000000" : "#FFFFFF") + "\nContraste: " + Math.max(black, white).toFixed(2) + ":1";
    }
    return hex(base);
  }

  async function runDate(): Promise<string> {
    if (toolId === "time-converter") {
      const match = text.match(/^(\\d{1,2}):(\\d{2})\\s*(AM|PM)?$/i);
      if (!match) throw new Error("Usa HH:MM, opcionalmente com AM ou PM.");
      let hour = Number(match[1]); const minute = Number(match[2]); const suffix = (match[3] || "").toUpperCase();
      if (minute > 59 || hour > 23) throw new Error("Hora fora do intervalo.");
      if (suffix) hour = hour % 12 + (suffix === "PM" ? 12 : 0);
      return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
    }
    const date = new Date(text || new Date().toISOString().slice(0, 10));
    if (Number.isNaN(date.getTime())) throw new Error("Introduz uma data válida.");
    const date2 = new Date(paramA);
    const diff = Math.abs(date.getTime() - date2.getTime());
    switch (toolId) {
      case "date-difference": if (Number.isNaN(date2.getTime())) throw new Error("Introduz a segunda data."); return "Dias: " + Math.floor(diff / 86400000) + "\nSemanas: " + (diff / 604800000).toFixed(2);
      case "date-add-days": date.setDate(date.getDate() + Number(paramA)); return date.toLocaleDateString("pt-PT") + "\nISO: " + date.toISOString().slice(0, 10);
      case "date-subtract-days": date.setDate(date.getDate() - Number(paramA)); return date.toLocaleDateString("pt-PT") + "\nISO: " + date.toISOString().slice(0, 10);
      case "date-to-iso": return date.toISOString();
      case "unix-time": return "Segundos: " + Math.floor(date.getTime() / 1000) + "\nMilissegundos: " + date.getTime();
      case "age-calculator": if (Number.isNaN(date2.getTime())) throw new Error("Introduz a data de referência."); { let years = date2.getFullYear() - date.getFullYear(); if (date2 < new Date(date2.getFullYear(), date.getMonth(), date.getDate())) years--; return "Anos completos: " + years; }
      case "weekday-finder": return date.toLocaleDateString("pt-PT", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      case "days-in-month": return "Dias: " + new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      case "iso-week": { const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); copy.setUTCDate(copy.getUTCDate() + 4 - (copy.getUTCDay() || 7)); const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1)); return "Semana ISO: " + Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7); }
      default: throw new Error("Operação de data desconhecida.");
    }
  }

  async function processFile(): Promise<void> {
    const file = files[0];
    if (kind === "pdf") {
      const { PDFDocument, degrees } = await import("pdf-lib");
      if (toolId === "pdf-merge") {
        if (files.length < 2) throw new Error("Seleciona pelo menos dois PDFs.");
        const merged = await PDFDocument.create();
        for (let i = 0; i < files.length; i++) {
          setNotice("A importar " + files[i].name + "…"); setProgress(15 + Math.round((i / files.length) * 65));
          const source = await PDFDocument.load(await files[i].arrayBuffer());
          const pages = await merged.copyPages(source, source.getPageIndices()); pages.forEach((page) => merged.addPage(page));
        }
        const out = await merged.save({ useObjectStreams: true }); const mergedBytes = new Uint8Array(out.byteLength); mergedBytes.set(out); const mergedBlob = new Blob([mergedBytes.buffer], { type: "application/pdf" }); setResultUrl(URL.createObjectURL(mergedBlob)); setDownloadName("nexauren-pdf-combinado.pdf"); setResult("PDF combinado com " + merged.getPageCount() + " páginas."); return;
        setResult("PDF combinado com " + merged.getPageCount() + " páginas."); setDownloadName("nexauren-pdf-combinado.pdf"); setResultUrl(""); return;
      }
      if (!file) throw new Error("Seleciona um ficheiro PDF.");
      setNotice("A analisar o documento…"); setProgress(25);
      const doc = await PDFDocument.load(await file.arrayBuffer()); const pages = doc.getPages(); const total = pages.length;
      if (toolId === "pdf-page-count") { setResult("Páginas: " + total + "\nTamanho: " + sizeLabel(file.size) + "\nTítulo: " + (doc.getTitle() || "—") + "\nAutor: " + (doc.getAuthor() || "—")); return; }
      if (toolId === "pdf-metadata") { setResult(JSON.stringify({ title: doc.getTitle(), author: doc.getAuthor(), subject: doc.getSubject(), creator: doc.getCreator(), producer: doc.getProducer(), keywords: doc.getKeywords(), pageCount: total }, null, 2)); return; }
      let output = doc;
      if (toolId === "pdf-split" || toolId === "pdf-remove-pages" || toolId === "pdf-reorder-pages") {
        const indices = toolId === "pdf-reorder-pages" ? parsePageOrder(paramA || "1-" + total, total) : parsePages(paramA || "1-" + total, total);
        if (toolId === "pdf-reorder-pages") {
          const ordered = await PDFDocument.create(); const copied = await ordered.copyPages(doc, indices); copied.forEach((page) => ordered.addPage(page)); output = ordered;
        } else if (toolId === "pdf-split") {
          const extracted = await PDFDocument.create(); const copied = await extracted.copyPages(doc, indices); copied.forEach((page) => extracted.addPage(page)); output = extracted;
        } else {
          if (indices.length >= total) throw new Error("Não podes remover todas as páginas.");
          for (const index of [...indices].sort((a, b) => b - a)) doc.removePage(index);
        }
      } else if (toolId === "pdf-rotate") {
        pages.forEach((page) => page.setRotation(degrees((page.getRotation().angle + 90) % 360)));
      } else if (toolId === "pdf-duplicate-page") {
        const index = Math.max(1, Number(paramA) || 1) - 1; if (index >= total) throw new Error("A página indicada não existe.");
        const copied = await doc.copyPages(doc, [index]); doc.insertPage(index + 1, copied[0]);
      } else if (toolId === "pdf-clean-metadata") {
        doc.setTitle(""); doc.setAuthor(""); doc.setSubject(""); doc.setKeywords([]); doc.setCreator(""); doc.setProducer("");
      } else if (toolId === "pdf-compressor") {
        setNotice("A reestruturar o documento PDF…");
      }
      setProgress(80);
      const bytes = await output.save({ useObjectStreams: true, updateMetadata: false });
      const nameOut = file.name.replace(/\.pdf$/i, "") + "-nexauren.pdf";
      setResult("Processamento concluído. " + output.getPageCount() + " páginas no ficheiro final.\nOriginal: " + sizeLabel(file.size) + "\nNovo: " + sizeLabel(bytes.length));
      const pdfBytes = new Uint8Array(bytes.byteLength); pdfBytes.set(bytes); setDownloadName(nameOut); setResultUrl(URL.createObjectURL(new Blob([pdfBytes.buffer], { type: "application/pdf" })));
      return;
    }
    if (kind === "image") {
      if (!file) throw new Error("Seleciona uma imagem.");
      const imageUrl = URL.createObjectURL(file); const image = new Image(); image.src = imageUrl;
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Não foi possível descodificar a imagem.")); });
      const w = image.naturalWidth; const h = image.naturalHeight;
      if (toolId === "image-info") { setResult("Nome: " + file.name + "\nFormato: " + file.type + "\nDimensões: " + w + " × " + h + " px\nTamanho: " + sizeLabel(file.size)); URL.revokeObjectURL(imageUrl); return; }
      if (toolId === "image-base64") { const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Falha ao ler a imagem.")); reader.readAsDataURL(file); }); setResult(data); URL.revokeObjectURL(imageUrl); return; }
      let width = w; let height = h;
      if (toolId === "image-crop") { width = Math.max(1, Math.min(w, Number(paramA) || Math.floor(w * .75))); height = Math.max(1, Math.min(h, Number(paramB) || Math.floor(h * .75))); }
      if (toolId === "image-rotate" && Math.round(Number(paramA) || 90) % 180 !== 0) { width = h; height = w; }
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("O navegador não conseguiu iniciar o processamento.");
      if (toolId === "image-grayscale") ctx.filter = "grayscale(1)";
      if (toolId === "image-invert") ctx.filter = "invert(1)";
      if (toolId === "image-compress") ctx.filter = "contrast(1.02) saturate(.98)";
      if (toolId === "image-rotate") { const angle = Number(paramA) || 90; ctx.translate(width / 2, height / 2); ctx.rotate(angle * Math.PI / 180); ctx.drawImage(image, -w / 2, -h / 2, w, h); }
      else if (toolId === "image-flip") { ctx.translate(width, 0); ctx.scale(-1, 1); ctx.drawImage(image, 0, 0, width, height); }
      else if (toolId === "image-crop") { const sx = Math.floor((w - width) / 2); const sy = Math.floor((h - height) / 2); ctx.drawImage(image, sx, sy, width, height, 0, 0, width, height); }
      else ctx.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(imageUrl); setProgress(65);
      const mime = toolId === "image-convert" ? format : "image/webp";
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Não foi possível gerar a imagem.")), mime, .84));
      const extension = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
      setDownloadName(file.name.replace(/\.[^.]+$/, "") + "-nexauren." + extension);
      setResult("Imagem processada: " + width + " × " + height + " px\nOriginal: " + sizeLabel(file.size) + "\nNovo: " + sizeLabel(blob.size));
      setResultUrl(URL.createObjectURL(blob)); return;
    }
    if (kind === "audio") {
      if (!file) throw new Error("Seleciona um áudio.");
      const AudioContextClass = window.AudioContext;
      const context = new AudioContextClass(); const source = await context.decodeAudioData(await file.arrayBuffer()); await context.close();
      if (toolId === "audio-info") { setResult("Duração: " + source.duration.toFixed(2) + " segundos\nCanais: " + source.numberOfChannels + "\nFrequência: " + source.sampleRate + " Hz\nAmostras: " + source.length); return; }
      const channels = Array.from({ length: source.numberOfChannels }, (_, index) => new Float32Array(source.getChannelData(index)));
      let start = 0; let end = source.length;
      if (toolId === "audio-trim-silence") {
        const threshold = .012; let first = end; let last = 0;
        channels.forEach((channel) => { for (let i = 0; i < channel.length; i += 1) if (Math.abs(channel[i]) > threshold) { first = Math.min(first, i); last = Math.max(last, i); } });
        start = Math.max(0, first - Math.floor(source.sampleRate * .03)); end = Math.min(source.length, last + Math.floor(source.sampleRate * .03));
        if (end <= start) throw new Error("Não foi encontrado áudio acima do limiar de silêncio.");
      }
      let outputChannels = channels.map((channel) => channel.slice(start, end));
      const gainDb = Number(paramA) || 3; const gain = Math.pow(10, gainDb / 20);
      if (toolId === "audio-volume") outputChannels = outputChannels.map((channel) => Float32Array.from(channel, (sample) => Math.max(-1, Math.min(1, sample * gain))));
      if (toolId === "audio-normalizer") {
        let peak = 0; outputChannels.forEach((channel) => channel.forEach((sample) => peak = Math.max(peak, Math.abs(sample))));
        const factor = peak ? Math.min(8, .891 / peak) : 1; outputChannels = outputChannels.map((channel) => Float32Array.from(channel, (sample) => sample * factor));
      }
      if (toolId === "audio-fade-in" || toolId === "audio-fade-out") outputChannels = outputChannels.map((channel) => Float32Array.from(channel, (sample, index) => {
        const ratio = channel.length > 1 ? index / (channel.length - 1) : 1; const fade = toolId === "audio-fade-in" ? Math.min(1, ratio * 8) : Math.min(1, (1 - ratio) * 8); return sample * fade;
      }));
      if (toolId === "audio-reverse") outputChannels = outputChannels.map((channel) => channel.reverse());
      if (toolId === "audio-speed") {
        const speed = Math.max(.5, Math.min(2, Number(paramA) || 1.25)); outputChannels = outputChannels.map((channel) => {
          const length = Math.max(1, Math.floor(channel.length / speed)); const out = new Float32Array(length);
          for (let i = 0; i < length; i++) { const position = i * speed; const low = Math.floor(position); const high = Math.min(channel.length - 1, low + 1); const mix = position - low; out[i] = channel[low] * (1 - mix) + channel[high] * mix; }
          return out;
        });
      }
      if (toolId === "audio-mono" && outputChannels.length > 1) {
        const mono = new Float32Array(outputChannels[0].length); outputChannels.forEach((channel) => channel.forEach((sample, index) => mono[index] += sample / outputChannels.length)); outputChannels = [mono];
      }
      if (!outputChannels[0]?.length) throw new Error("O trecho selecionado está vazio.");
      const wav = encodeWav(outputChannels, source.sampleRate); setProgress(85);
      setDownloadName(file.name.replace(/\.[^.]+$/, "") + "-nexauren.wav"); setResult("Áudio processado com sucesso.\nDuração final: " + (outputChannels[0].length / source.sampleRate).toFixed(2) + " s\nFormato: WAV PCM 16-bit");
      setResultUrl(URL.createObjectURL(wav)); return;
    }
  }

  async function process() {
    if (busy) return;
    setBusy(true); setProgress(8); setError(""); setNotice("A preparar o motor de processamento…"); setResult(""); setComplete(false);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      setProgress(28);
      let output = "";
      if (["image", "pdf", "audio"].includes(kind)) await processFile();
      else if (kind === "calculators") output = await runCalculator();
      else if (kind === "colors") output = await runColor();
      else if (kind === "dates") output = await runDate();
      else output = await runTextOperation();
      if (output) setResult(output);
      setProgress(100); setNotice("Processamento concluído no teu dispositivo."); setComplete(true);
      try { const used = JSON.parse(localStorage.getItem("nexauren:tool-usage") || "[]"); const next = [...new Set([...used, toolId])]; localStorage.setItem("nexauren:tool-usage", JSON.stringify(next)); window.dispatchEvent(new CustomEvent("nexauren:tool-used", { detail: { toolId } })); } catch { /* storage may be disabled */ }
      try { const { getFirebaseClient } = await import("../lib/firebase"); const { recordActivity } = await import("../lib/account"); const activeUser = getFirebaseClient().auth.currentUser; if (activeUser) await recordActivity(activeUser, { id: toolId, title: name, kind: "tool", href: "/tools/" + toolId }); } catch { /* Firestore sync is retried by a future interaction. */ }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "O processamento falhou. Verifica os dados e tenta novamente.");
      setProgress(0); setNotice(""); setComplete(false);
    } finally { setBusy(false); }
  }

  const fields = kind === "calculators" || kind === "colors" || kind === "dates" || kind === "developer" || (kind === "pdf" && ["pdf-split", "pdf-remove-pages", "pdf-reorder-pages", "pdf-duplicate-page"].includes(toolId)) || (kind === "generators" && ["password-generator", "random-number-generator", "hex-generator"].includes(toolId)) || (kind === "image" && ["image-crop", "image-rotate"].includes(toolId)) || (kind === "audio" && ["audio-volume", "audio-speed"].includes(toolId));
  const labelA = toolId === "regex-tester" ? "Expressão regular" : toolId === "date-difference" || toolId === "age-calculator" || toolId === "contrast-checker" || toolId === "color-mixer" ? "Segundo valor" : toolId === "unit-converter" ? "Valor numérico" : toolId === "pdf-split" || toolId === "pdf-remove-pages" || toolId === "pdf-reorder-pages" ? "Páginas (ex.: 1-3,5)" : toolId === "image-crop" ? "Largura de corte" : toolId === "image-rotate" ? "Ângulo em graus" : toolId === "rgb-to-hex" ? "Canal vermelho (R)" : toolId === "password-generator" || toolId === "hex-generator" ? "Comprimento" : toolId === "random-number-generator" ? "Valor mínimo" : toolId === "audio-volume" ? "Ganho em dB" : toolId === "audio-speed" ? "Velocidade (0,5 a 2)" : "Valor / opção";
  const labelB = toolId === "regex-tester" ? "Opções RegEx" : toolId === "contrast-checker" || toolId === "color-mixer" ? "Segunda cor HEX" : toolId === "image-crop" ? "Altura de corte" : toolId === "rgb-to-hex" ? "Canal verde (G)" : toolId === "random-number-generator" ? "Valor máximo" : toolId === "unit-converter" ? "Conversão (ex.: km-mi)" : "Segundo valor";
  const showMainText = !isFileTool || kind === "dates" || kind === "colors" || kind === "calculators" && toolId === "average-calculator";
  return <div className="universal-tool">
    <div className="universal-tool-main">
      <section className="tool-panel universal-input-panel">
        <div className="panel-topline"><div><h2>Área de trabalho</h2><p>{description}</p></div><span className="text-live-badge">● MOTOR LOCAL</span></div>
        {isFileTool && <label className="upload-zone universal-upload"><input ref={fileInput} className="file-input-hidden" type="file" accept={accepts} multiple={toolId === "pdf-merge"} onChange={onFileChange}/><span className="upload-icon">{kind === "pdf" ? "PDF" : kind === "audio" ? "♫" : "◈"}</span><strong>{files.length ? files.map((file) => file.name).join(", ") : "Seleciona ou arrasta o ficheiro"}</strong><small>{files.length ? files.map((file) => sizeLabel(file.size)).join(" · ") : helper}</small><span className="upload-cta">{files.length ? "Trocar ficheiro" : "Selecionar ficheiro"}</span></label>}
        {showMainText && <label className="universal-label"><span>{kind === "dates" ? "Data ou hora principal" : kind === "colors" ? "Cor HEX / texto principal" : kind === "calculators" ? "Lista de valores / entrada" : "Entrada"}</span><textarea value={text} onChange={(e) => setText(e.target.value)} className="universal-editor" placeholder={kind === "colors" ? "#3158C7" : kind === "dates" ? "2026-11-09" : "Escreve ou cola os dados aqui…"} spellCheck={false}/></label>}
        {fields && <div className="universal-fields">
          <label className="universal-label"><span>{labelA}</span><input value={paramA} onChange={(e) => setParamA(e.target.value)} placeholder={toolId === "regex-tester" ? "\\d+" : toolId.includes("date") || toolId === "age-calculator" ? "2026-12-31" : "Introduz um valor"}/></label>
          <label className="universal-label"><span>{labelB}</span><input value={paramB} onChange={(e) => setParamB(e.target.value)} placeholder={toolId === "regex-tester" ? "g, i, m…" : "Introduz um valor"}/></label>
          {(kind === "calculators" || toolId === "rgb-to-hex" || toolId === "random-number-generator") && <label className="universal-label"><span>Terceiro valor</span><input value={paramC} onChange={(e) => setParamC(e.target.value)} placeholder="Se necessário"/></label>}
        </div>}
        {kind === "image" && <label className="universal-label format-select"><span>Formato de saída</span><select value={format} onChange={(e) => setFormat(e.target.value)}><option value="image/webp">WebP</option><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></label>}
        {error && <div className="error-banner" role="alert">{error}</div>}
        {notice && <div className={complete ? "success-banner" : "processing-message"}><b>{complete ? "✓" : "◌"}</b>{notice}</div>}
      </section>
      <section className="tool-panel universal-settings">
        <div><span className="section-kicker">NEXAUREN ENGINE / {category.toUpperCase()}</span><h2>Controlos e execução</h2><p className="tool-engine-help">{helper}</p>
          <div className="engine-status"><span className={busy ? "engine-light is-busy" : complete ? "engine-light is-done" : "engine-light"}/><span>{busy ? "Motor a trabalhar" : complete ? "Operação concluída" : "Motor em espera"}</span><b>{progress}%</b></div>
          <div className="progress-track engine-progress"><div className="progress-fill" style={{ width: progress + "%" }}/></div>
          <div className="engine-stages"><span className={progress >= 8 ? "is-active" : ""}>Preparação</span><span className={progress >= 28 ? "is-active" : ""}>Processamento</span><span className={progress >= 100 ? "is-active" : ""}>Finalização</span></div>
          <button type="button" className="primary-button engine-run-button" disabled={busy || (isFileTool && !files.length)} onClick={process}>{busy ? "A processar…" : "Executar ferramenta"} <b>↗</b></button>
          <div className="engine-assurance"><span>◈</span><div><b>Privacidade local</b><small>Os ficheiros e dados permanecem no teu dispositivo, salvo quando descarregas o resultado.</small></div></div>
        </div>
      </section>
    </div>
    <section className="tool-panel universal-result-panel">
      <div className="panel-topline"><div><h2>Resultado</h2><p>{result ? "O processamento terminou. Revê e guarda o resultado." : "O resultado da operação vai aparecer nesta área."}</p></div><span className="text-output-count">{result.length.toLocaleString("pt-PT")} caracteres</span></div>
      {result && <pre className="universal-result" aria-live="polite">{result}</pre>}
      {resultUrl && <div className="universal-download-row"><span><b>Ficheiro pronto</b><small>{downloadName}</small></span><a className="download-button" href={resultUrl} download={downloadName}>↓ Descarregar resultado</a></div>}
      {!result && !resultUrl && <div className="tool-empty universal-empty"><span>✧</span>O resultado será apresentado aqui depois da execução.</div>}
      <div className="universal-result-actions"><button className="secondary-button" disabled={!result} onClick={() => navigator.clipboard.writeText(result).then(() => setNotice("Resultado copiado para a área de transferência.")).catch(() => setError("Não foi possível copiar automaticamente."))}>Copiar texto</button><button className="secondary-button" disabled={!result && !resultUrl} onClick={() => { setText(""); setResult(""); setResultUrl(""); setProgress(0); setNotice(""); setComplete(false); setFiles([]); }}>Reiniciar ferramenta</button></div>
      <p className="settings-footnote">{helper}</p>
    </section>
  </div>;
}
