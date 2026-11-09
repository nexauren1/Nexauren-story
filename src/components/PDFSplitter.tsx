import { useEffect, useRef, useState, type ChangeEvent } from "react";

function parsePages(value: string, total: number) {
  const selected = new Set<number>();
  for (const part of value.split(",")) {
    const token = part.trim();
    if (!token) continue;
    const match = token.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error("Usa páginas como 1-3,5,8-10.");
    const first = Number(match[1]), last = Number(match[2] || match[1]);
    if (first < 1 || last < first || last > total) throw new Error("O intervalo deve estar entre 1 e " + total + ".");
    for (let page = first; page <= last; page++) selected.add(page - 1);
  }
  if (!selected.size) throw new Error("Indica pelo menos uma página.");
  return [...selected].sort((a,b) => a-b);
}
function countPages(value: string, total: number) {
  try { return parsePages(value, total).length; } catch { return 0; }
}

export default function PDFSplitter() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [range, setRange] = useState("1-2");
  const [total, setTotal] = useState(0);
  const [outputName, setOutputName] = useState("paginas-extraidas");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState("");
  const [resultSize, setResultSize] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const selectedCount = countPages(range, total);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  async function choose(next?: File) {
    if (!next) return;
    if (next.type !== "application/pdf" && !next.name.toLowerCase().endsWith(".pdf")) { setError("Selecciona um PDF válido."); return; }
    if (next.size > 60 * 1048576) { setError("O PDF ultrapassa 60 MB."); return; }
    setFile(next); setUrl(""); setResultSize(0); setError(""); setMessage(""); setProgress(0);
    setOutputName(next.name.replace(/\.pdf$/i, "") + "-paginas");
    try {
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.load(await next.arrayBuffer());
      const pages = doc.getPageCount(); setTotal(pages); setRange("1-" + pages);
    } catch (cause) { setTotal(0); setError(cause instanceof Error ? "Não foi possível ler o PDF. " + cause.message : "PDF inválido ou protegido."); }
  }
  function change(event: ChangeEvent<HTMLInputElement>) { void choose(event.target.files?.[0]); event.target.value = ""; }
  function setPreset(kind: "all" | "odd" | "even" | "first" | "last") {
    if (!total) return;
    if (kind === "all") setRange("1-" + total);
    if (kind === "odd") setRange(Array.from({length:Math.ceil(total/2)},(_,i)=>String(i*2+1)).join(","));
    if (kind === "even") setRange(Array.from({length:Math.floor(total/2)},(_,i)=>String(i*2+2)).join(","));
    if (kind === "first") setRange("1");
    if (kind === "last") setRange(String(total));
    setUrl(""); setProgress(0); setMessage("");
  }
  async function split() {
    if (!file || !total || busy) return;
    setBusy(true); setProgress(10); setError(""); setMessage("A validar a selecção de páginas…");
    try {
      const { PDFDocument } = await import("pdf-lib");
      const source = await PDFDocument.load(await file.arrayBuffer());
      const indexes = parsePages(range, total);
      setProgress(35); setMessage("A extrair " + indexes.length + " página(s)…");
      const result = await PDFDocument.create();
      const pages = await result.copyPages(source, indexes);
      pages.forEach((page) => result.addPage(page));
      setProgress(78);
      const bytes = await result.save({ useObjectStreams:true });
      const safe = new Uint8Array(bytes.length); safe.set(bytes);
      const blob = new Blob([safe.buffer], { type:"application/pdf" });
      setUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return URL.createObjectURL(blob); });
      setResultSize(blob.size); setProgress(100); setMessage(indexes.length + " página(s) extraída(s) com sucesso.");
    } catch (cause) {
      setProgress(0); setError(cause instanceof Error ? cause.message : "Não foi possível dividir o PDF."); setMessage("");
    } finally { setBusy(false); }
  }
  function cleanFileName(value: string) { return (value.trim().replace(/\.pdf$/i,"").replace(/[\\/:*?"<>|]+/g,"-") || "paginas-extraidas") + ".pdf"; }

  return (
    <div className="tool-workspace nx-pdf-workspace">
      <section className="tool-panel nx-pdf-main-panel">
        <div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">01 / DOCUMENTO</span><h2>Documento original</h2><p>Escolhe o PDF do qual pretendes extrair páginas.</p></div><span className="nx-local-indicator"><i/> LOCAL</span></div>
        <label className="upload-zone nx-upload-zone">
          <input ref={input} className="file-input-hidden" type="file" accept="application/pdf,.pdf" onChange={change}/>
          <span className="nx-upload-symbol">PDF</span><strong>{file ? file.name : "Seleccionar ficheiro PDF"}</strong>
          <small>{file ? total + " páginas · " + (file.size/1048576).toFixed(2) + " MB" : "Um documento até 60 MB"}</small><span className="upload-cta">Escolher documento</span>
        </label>
        {file && <div className="nx-pdf-document-chip"><span className="nx-pdf-file-icon">PDF</span><span><b>{file.name}</b><small>{total} páginas disponíveis</small></span><button className="nx-ghost-button" type="button" onClick={() => { setFile(null); setTotal(0); setUrl(""); setProgress(0); }}>Remover</button></div>}
        <div className="nx-list-heading"><div><h3>Atalhos de selecção</h3><p>Escolhe rapidamente um conjunto de páginas.</p></div></div>
        <div className="nx-page-presets">
          <button type="button" disabled={!file||busy} onClick={()=>setPreset("all")}>Todas</button>
          <button type="button" disabled={!file||busy} onClick={()=>setPreset("odd")}>Ímpares</button>
          <button type="button" disabled={!file||busy} onClick={()=>setPreset("even")}>Pares</button>
          <button type="button" disabled={!file||busy} onClick={()=>setPreset("first")}>Primeira</button>
          <button type="button" disabled={!file||busy} onClick={()=>setPreset("last")}>Última</button>
        </div>
        {error && <div className="error-banner" role="alert">{error}</div>}
        {message && <div className={progress===100?"success-banner":"processing-message"}><b>{progress===100?"✓":"◌"}</b>{message}</div>}
        {url && <a className="download-button nx-download-button" href={url} download={cleanFileName(outputName)}>↓ Descarregar PDF extraído</a>}
      </section>
      <section className="tool-panel settings-panel nx-pdf-settings">
        <div>
          <div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">02 / PÁGINAS</span><h2>Escolher páginas</h2><p>Combina números individuais e intervalos.</p></div></div>
          <div className="settings-group">
            <label className="field-label">Páginas e intervalos<input value={range} onChange={(event)=>{setRange(event.target.value);setUrl("");setProgress(0);setMessage("");}} placeholder="Ex.: 1-3,5,8-10" disabled={!file||busy}/></label>
            <p className="range-help">Exemplo: 1-3,5,8-10 extrai as páginas 1, 2, 3, 5, 8, 9 e 10.</p>
          </div>
          <div className="nx-pdf-summary">
            <div><span>Páginas originais</span><strong>{total || "—"}</strong></div>
            <div><span>Páginas seleccionadas</span><strong>{selectedCount || "—"}</strong></div>
            <div><span>Tamanho do original</span><strong>{file ? (file.size/1048576).toFixed(2)+" MB" : "—"}</strong></div>
            <div><span>Tamanho do resultado</span><strong>{resultSize ? (resultSize/1048576).toFixed(2)+" MB" : "—"}</strong></div>
          </div>
          <div className="settings-group"><label className="field-label">Nome do novo PDF<input value={outputName} onChange={(event)=>setOutputName(event.target.value)} disabled={!file||busy}/></label></div>
          <div className="nx-progress-card"><div className="progress-heading"><span>Processamento</span><b>{progress}%</b></div><div className="progress-track"><div className="progress-fill" style={{width:progress+"%"}}/></div><p>{busy?"A extrair páginas…":progress===100?"Documento pronto para guardar.":"O ficheiro permanece no teu dispositivo."}</p></div>
        </div>
        <div className="settings-actions"><button className="nx-run-button" disabled={!file||!total||!selectedCount||busy} onClick={()=>void split()}><span>{busy?"A extrair páginas…":"Extrair "+selectedCount+" página(s)"}</span><b>{busy?"◌":"↗"}</b></button><p className="settings-footnote">O original não é alterado. As páginas seleccionadas são copiadas para um novo PDF.</p></div>
      </section>
    </div>
  );
}
