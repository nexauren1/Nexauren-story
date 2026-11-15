import { useEffect, useRef, useState, type ChangeEvent } from "react";

function parsePageSet(value: string, total: number) {
  const selected = new Set<number>();
  for (const part of value.split(",")) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error("Usa páginas como 1-3,5,8-10.");
    const first = Number(match[1]), last = Number(match[2] || match[1]);
    if (first < 1 || last < first || last > total) throw new Error("As páginas têm de estar entre 1 e " + total + ".");
    for (let page = first; page <= last; page++) selected.add(page - 1);
  }
  if (!selected.size) throw new Error("Indica pelo menos uma página.");
  return [...selected].sort((a,b) => a-b);
}

export default function PDFRotator() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [angle, setAngle] = useState(90);
  const [scope, setScope] = useState<"all" | "custom">("all");
  const [pageRange, setPageRange] = useState("1");
  const [pageCount, setPageCount] = useState(0);
  const [currentRotation, setCurrentRotation] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function choose(next?: File) {
    if (!next) return;
    if (next.type !== "application/pdf" && !next.name.toLowerCase().endsWith(".pdf")) { setError("Selecciona um PDF válido."); return; }
    if (next.size > 60 * 1048576) { setError("O PDF ultrapassa o limite de 60 MB."); return; }
    setFile(next); setUrl(""); setError(""); setMessage(""); setProgress(0); setCurrentRotation(0);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.load(await next.arrayBuffer());
      setPageCount(doc.getPageCount());
      setPageRange("1-" + doc.getPageCount());
    } catch (cause) {
      setPageCount(0); setError(cause instanceof Error ? "Não foi possível ler o PDF. " + cause.message : "PDF inválido ou protegido.");
    }
  }
  function change(event: ChangeEvent<HTMLInputElement>) { void choose(event.target.files?.[0]); event.target.value = ""; }

  async function rotate() {
    if (!file || !pageCount || busy) return;
    setBusy(true); setProgress(10); setError(""); setMessage("A abrir o documento…");
    try {
      const { PDFDocument, degrees } = await import("pdf-lib");
      const doc = await PDFDocument.load(await file.arrayBuffer());
      const pages = doc.getPages();
      const indexes = scope === "all" ? pages.map((_, index) => index) : parsePageSet(pageRange, pages.length);
      setProgress(38); setMessage("A aplicar rotação a " + indexes.length + " página(s)…");
      indexes.forEach((index) => {
        const page = pages[index];
        const current = page.getRotation().angle;
        page.setRotation(degrees(((current + angle) % 360 + 360) % 360));
      });
      const bytes = await doc.save({ useObjectStreams: true });
      const safe = new Uint8Array(bytes.length); safe.set(bytes);
      setUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return URL.createObjectURL(new Blob([safe.buffer], { type:"application/pdf" })); });
      setProgress(100); setCurrentRotation(angle);
      setMessage("Orientação actualizada em " + indexes.length + " página(s).");
    } catch (cause) {
      setProgress(0); setError(cause instanceof Error ? cause.message : "Não foi possível rodar o PDF."); setMessage("");
    } finally { setBusy(false); }
  }

  return (
    <div className="tool-workspace nx-pdf-workspace">
      <section className="tool-panel nx-pdf-main-panel">
        <div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">01 / DOCUMENTO</span><h2>Documento PDF</h2><p>Carrega um documento e consulta o número de páginas detectado.</p></div><span className="nx-local-indicator"><i/> LOCAL</span></div>
        <label className="upload-zone nx-upload-zone">
          <input ref={input} className="file-input-hidden" type="file" accept="application/pdf,.pdf" onChange={change}/>
          <span className="nx-upload-symbol">PDF</span><strong>{file ? file.name : "Seleccionar documento"}</strong>
          <small>{file ? pageCount + " páginas · " + (file.size / 1048576).toFixed(2) + " MB" : "PDF até 60 MB · processamento no navegador"}</small>
          <span className="upload-cta">Escolher PDF</span>
        </label>
        {file && <div className="nx-pdf-document-chip"><span className="nx-pdf-file-icon">PDF</span><span><b>{file.name}</b><small>{pageCount} páginas disponíveis</small></span><button className="nx-ghost-button" onClick={() => { setFile(null); setUrl(""); setPageCount(0); setProgress(0); }}>Remover</button></div>}
        {message && <div className={progress === 100 ? "success-banner" : "processing-message"}><b>{progress === 100 ? "✓" : "◌"}</b>{message}</div>}
        {error && <div className="error-banner" role="alert">{error}</div>}
        {url && <a className="download-button nx-download-button" href={url} download={(file?.name.replace(/\.pdf$/i, "") || "documento") + "-rodado.pdf"}>↓ Descarregar PDF corrigido</a>}
      </section>
      <section className="tool-panel settings-panel nx-pdf-settings">
        <div>
          <div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">02 / ORIENTAÇÃO</span><h2>Rodar páginas</h2><p>Escolhe o ângulo e a que páginas será aplicado.</p></div></div>
          <div className="nx-rotation-preview">
            <div className="nx-rotation-sheet" style={{ transform: "rotate(" + (currentRotation % 360) + "deg)" }}><span>PDF</span><i/><i/><i/></div>
            <div><b>Pré-visualização</b><small>Rotação seleccionada: {angle > 0 ? "+" : ""}{angle}°</small></div>
          </div>
          <div className="settings-group">
            <span className="settings-label">Ângulo de rotação</span>
            <div className="nx-angle-options">
              <button type="button" className={angle === -90 ? "is-active" : ""} onClick={() => setAngle(-90)} disabled={!file || busy}><b>↶</b><span>90° esquerda</span></button>
              <button type="button" className={angle === 90 ? "is-active" : ""} onClick={() => setAngle(90)} disabled={!file || busy}><b>↻</b><span>90° direita</span></button>
              <button type="button" className={angle === 180 ? "is-active" : ""} onClick={() => setAngle(180)} disabled={!file || busy}><b>↕</b><span>180°</span></button>
            </div>
          </div>
          <div className="settings-group">
            <span className="settings-label">Aplicar a</span>
            <div className="nx-scope-switch">
              <button type="button" className={scope === "all" ? "is-active" : ""} onClick={() => setScope("all")} disabled={!file || busy}>Todas as páginas</button>
              <button type="button" className={scope === "custom" ? "is-active" : ""} onClick={() => setScope("custom")} disabled={!file || busy}>Páginas específicas</button>
            </div>
            {scope === "custom" && <label className="field-label nx-page-range-field">Números e intervalos<input value={pageRange} onChange={(event) => { setPageRange(event.target.value); setUrl(""); }} placeholder="Ex.: 1-3,5,8-10" disabled={!file || busy}/></label>}
            <p className="range-help">{scope === "all" ? "A rotação será aplicada a todas as " + pageCount + " páginas." : "Indica páginas separadas por vírgulas e intervalos. Exemplo: 1-3,5."}</p>
          </div>
          <div className="nx-progress-card"><div className="progress-heading"><span>Processamento</span><b>{progress}%</b></div><div className="progress-track"><div className="progress-fill" style={{ width: progress + "%" }}/></div><p>{busy ? "A aplicar alterações ao PDF…" : progress === 100 ? "Documento pronto." : "O documento original não é alterado."}</p></div>
        </div>
        <div className="settings-actions"><button className="nx-run-button" disabled={!file || !pageCount || busy || (scope === "custom" && !pageRange.trim())} onClick={() => void rotate()}><span>{busy ? "A rodar documento…" : "Aplicar rotação"}</span><b>{busy ? "◌" : "↗"}</b></button><p className="settings-footnote">A rotação altera a orientação da página sem converter o conteúdo em imagem.</p></div>
      </section>
    </div>
  );
}
