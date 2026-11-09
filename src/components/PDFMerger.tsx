import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";

type PdfItem = { id: string; file: File; pages: number };
function sizeText(bytes: number) { return bytes < 1048576 ? (bytes / 1024).toFixed(1) + " KB" : (bytes / 1048576).toFixed(2) + " MB"; }

export default function PDFMerger() {
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<PdfItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [pages, setPages] = useState(0);
  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0);
  const totalPages = items.reduce((sum, item) => sum + item.pages, 0);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list).filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    if (!incoming.length) { setError("Selecciona ficheiros PDF válidos."); return; }
    if (incoming.some((file) => file.size > 60 * 1048576)) { setError("Cada PDF deve ter no máximo 60 MB."); return; }
    const unique = incoming.filter((file) => !items.some((item) => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified));
    if (!unique.length) { setMessage("Os documentos seleccionados já estão na lista."); return; }
    setError(""); setMessage("A analisar os documentos…"); setProgress(0);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const parsed: PdfItem[] = [];
      for (const file of unique) {
        const document = await PDFDocument.load(await file.arrayBuffer());
        parsed.push({ id: file.name + "-" + file.lastModified + "-" + Math.random().toString(36).slice(2), file, pages: document.getPageCount() });
      }
      setItems((previous) => [...previous, ...parsed]);
      setMessage(parsed.length + " documento(s) adicionado(s). Podes alterar a ordem antes de combinar.");
      setUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return ""; });
    } catch (cause) {
      setError(cause instanceof Error ? "Não foi possível abrir um dos PDFs. " + cause.message : "Verifica se os PDFs não estão protegidos.");
      setMessage("");
    }
  }
  function change(event: ChangeEvent<HTMLInputElement>) { if (event.target.files) void addFiles(event.target.files); event.target.value = ""; }
  function drop(event: DragEvent<HTMLLabelElement>) { event.preventDefault(); event.currentTarget.classList.remove("is-dragging"); void addFiles(event.dataTransfer.files); }
  function move(index: number, direction: -1 | 1) {
    setItems((previous) => {
      const target = index + direction;
      if (target < 0 || target >= previous.length) return previous;
      const next = [...previous]; [next[index], next[target]] = [next[target], next[index]]; return next;
    });
    setUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return ""; });
    setProgress(0); setMessage("Ordem actualizada. O resultado anterior foi invalidado.");
  }
  function remove(id: string) {
    setItems((previous) => previous.filter((item) => item.id !== id));
    setUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return ""; });
    setProgress(0); setMessage("Documento removido.");
  }
  async function merge() {
    if (items.length < 2 || busy) return;
    setBusy(true); setProgress(4); setError(""); setMessage("A preparar os documentos…");
    try {
      const { PDFDocument } = await import("pdf-lib");
      const output = await PDFDocument.create();
      let added = 0;
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        setMessage("A importar " + item.file.name + "…");
        const source = await PDFDocument.load(await item.file.arrayBuffer());
        const copied = await output.copyPages(source, source.getPageIndices());
        copied.forEach((page) => output.addPage(page));
        added += copied.length;
        setProgress(Math.round((index + 1) / items.length * 82));
      }
      setMessage("A gerar o PDF combinado…");
      const bytes = await output.save({ useObjectStreams: true });
      const safe = new Uint8Array(bytes.length); safe.set(bytes);
      const blob = new Blob([safe.buffer], { type: "application/pdf" });
      setUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return URL.createObjectURL(blob); });
      setPages(added); setProgress(100);
      setMessage("Documento criado com " + added + " páginas, pela ordem escolhida.");
    } catch (cause) {
      setProgress(0); setError(cause instanceof Error ? "Não foi possível combinar os ficheiros. " + cause.message : "Falha ao combinar PDFs."); setMessage("");
    } finally { setBusy(false); }
  }

  return (
    <div className="tool-workspace nx-pdf-workspace">
      <section className="tool-panel nx-pdf-main-panel">
        <div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">01 / DOCUMENTOS</span><h2>Organiza os teus PDFs</h2><p>Adiciona documentos e usa as setas para definir a ordem final.</p></div><span className="nx-local-indicator"><i/> LOCAL</span></div>
        <label className="upload-zone nx-upload-zone" onDragOver={(event) => { event.preventDefault(); event.currentTarget.classList.add("is-dragging"); }} onDragLeave={(event) => event.currentTarget.classList.remove("is-dragging")} onDrop={drop}>
          <input ref={input} className="file-input-hidden" type="file" accept="application/pdf,.pdf" multiple onChange={change}/>
          <span className="nx-upload-symbol">PDF</span><strong>Adicionar documentos PDF</strong><small>Arrasta os ficheiros para aqui ou escolhe no dispositivo · até 60 MB cada</small>
          <span className="upload-cta">Escolher PDFs</span>
        </label>
        <div className="nx-list-heading"><div><h3>Ordem de combinação</h3><p>{items.length} documentos · {totalPages} páginas · {sizeText(totalBytes)}</p></div><button type="button" className="nx-ghost-button" disabled={!items.length || busy} onClick={() => { setItems([]); setUrl(""); setPages(0); setProgress(0); setMessage("Lista limpa."); }}>Limpar lista</button></div>
        {items.length ? <div className="nx-pdf-order-list">
          {items.map((item, index) => <article className="nx-pdf-order-item" key={item.id}>
            <span className="nx-pdf-order-number">{String(index + 1).padStart(2, "0")}</span>
            <span className="nx-pdf-file-icon">PDF</span>
            <div className="nx-pdf-file-info"><b>{item.file.name}</b><small>{item.pages} páginas · {sizeText(item.file.size)}</small></div>
            <div className="nx-order-controls">
              <button type="button" disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label="Mover para cima">↑</button>
              <button type="button" disabled={busy || index === items.length - 1} onClick={() => move(index, 1)} aria-label="Mover para baixo">↓</button>
              <button type="button" className="nx-remove-order" disabled={busy} onClick={() => remove(item.id)} aria-label="Remover documento">×</button>
            </div>
          </article>)}
        </div> : <div className="tool-empty">Adiciona pelo menos dois PDFs para os combinar.</div>}
        {message && <div className={progress === 100 ? "success-banner" : "processing-message"}><b>{progress === 100 ? "✓" : "◌"}</b>{message}</div>}
        {error && <div className="error-banner" role="alert">{error}</div>}
        {url && <a className="download-button nx-download-button" href={url} download="documentos-combinados-nexauren.pdf">↓ Descarregar PDF combinado</a>}
      </section>

      <section className="tool-panel settings-panel nx-pdf-settings">
        <div>
          <div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">02 / RESUMO</span><h2>Documento final</h2><p>Confirma o conteúdo antes de combinar.</p></div></div>
          <div className="nx-pdf-summary">
            <div><span>Documentos</span><strong>{items.length}</strong></div>
            <div><span>Total de páginas</span><strong>{totalPages}</strong></div>
            <div><span>Tamanho original</span><strong>{sizeText(totalBytes)}</strong></div>
            <div><span>Páginas no resultado</span><strong>{url ? pages : "—"}</strong></div>
          </div>
          <div className="nx-progress-card"><div className="progress-heading"><span>Processamento</span><b>{progress}%</b></div><div className="progress-track"><div className="progress-fill" style={{ width: progress + "%" }}/></div><p>{busy ? "A combinar e preparar as páginas…" : progress === 100 ? "O documento está pronto." : "O processamento é feito localmente."}</p></div>
          <div className="tool-help-note"><strong>Privacidade:</strong> as páginas são copiadas no navegador. Os ficheiros originais não são enviados para a Nexauren.</div>
        </div>
        <div className="settings-actions">
          <button className="nx-run-button" disabled={items.length < 2 || busy} onClick={() => void merge()}><span>{busy ? "A combinar documentos…" : "Combinar " + items.length + " PDFs"}</span><b>{busy ? "◌" : "↗"}</b></button>
        </div>
      </section>
    </div>
  );
}
