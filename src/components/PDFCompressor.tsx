import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";

type FinishedFile = { id: string; name: string; originalSize: number; blob: Blob; url: string; savedSize: number };
function sizeLabel(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
function outputName(name: string) {
  return `${name.replace(/\.pdf$/i, "")}-otimizado.pdf`;
}

export default function PDFCompressor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [finished, setFinished] = useState<FinishedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [quality, setQuality] = useState<"balanced" | "structure">("balanced");

  useEffect(() => () => finished.forEach((file) => URL.revokeObjectURL(file.url)), [finished]);

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list).filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    if (!incoming.length) {
      setError("Seleciona ficheiros PDF válidos.");
      return;
    }
    const oversized = incoming.find((file) => file.size > 60 * 1024 * 1024);
    if (oversized) {
      setError(`${oversized.name} ultrapassa o limite de 60 MB.`);
      return;
    }
    setFiles((previous) => [...previous, ...incoming].filter((file, index, all) =>
      all.findIndex((candidate) => candidate.name === file.name && candidate.size === file.size && candidate.lastModified === file.lastModified) === index
    ));
    setFinished((previous) => {
      previous.forEach((file) => URL.revokeObjectURL(file.url));
      return [];
    });
    setProgress(0);
    setError("");
    setMessage("");
  }

  function changeFiles(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  }
  function dropFiles(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.currentTarget.classList.remove("is-dragging");
    addFiles(event.dataTransfer.files);
  }
  function removeFile(index: number) {
    setFiles((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
    setFinished((previous) => {
      previous.forEach((file) => URL.revokeObjectURL(file.url));
      return [];
    });
    setProgress(0);
    setMessage("");
  }

  async function compress() {
    if (!files.length || busy) return;
    setBusy(true);
    setProgress(2);
    setError("");
    setMessage("");
    const results: FinishedFile[] = [];
    try {
      const { PDFDocument } = await import("pdf-lib");
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        setMessage(`A otimizar ${file.name}…`);
        setProgress(Math.round((index / files.length) * 90) + 5);
        const document = await PDFDocument.load(await file.arrayBuffer(), {
          updateMetadata: false,
        });
        const output = await document.save({
          useObjectStreams: true,
          addDefaultPage: false,
          objectsPerTick: 60,
          updateFieldAppearances: false,
        });
        const blob = new Blob([output], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        results.push({
          id: `${file.name}-${file.lastModified}-${index}`,
          name: file.name,
          originalSize: file.size,
          blob,
          url,
          savedSize: blob.size,
        });
      }
      setFinished(results);
      setProgress(100);
      const before = results.reduce((sum, file) => sum + file.originalSize, 0);
      const after = results.reduce((sum, file) => sum + file.savedSize, 0);
      const difference = Math.round((1 - after / before) * 100);
      setMessage(
        after < before
          ? `Otimização concluída. Os ficheiros ficaram ${difference}% mais pequenos no total.`
          : "Otimização concluída. Os documentos foram regravados; não houve redução significativa no tamanho.",
      );
    } catch (cause) {
      results.forEach((file) => URL.revokeObjectURL(file.url));
      setError(cause instanceof Error
        ? `Não foi possível otimizar o PDF. ${cause.message}`
        : "Não foi possível otimizar os ficheiros. Verifica se os PDFs não estão protegidos por palavra-passe.");
      setProgress(0);
      setMessage("");
    } finally {
      setBusy(false);
    }
  }

  const originalTotal = files.reduce((sum, file) => sum + file.size, 0);
  const outputTotal = finished.reduce((sum, file) => sum + file.savedSize, 0);
  const savings = originalTotal > 0 && finished.length ? Math.round((1 - outputTotal / originalTotal) * 100) : 0;

  return (
    <div className="tool-workspace pdf-workspace">
      <section className="tool-panel">
        <div className="panel-topline"><div><h2>Ficheiros PDF</h2><p>Adicione um ou vários documentos para otimização.</p></div></div>
        <label
          className="upload-zone pdf-upload-zone"
          onDragOver={(event) => { event.preventDefault(); event.currentTarget.classList.add("is-dragging"); }}
          onDragLeave={(event) => event.currentTarget.classList.remove("is-dragging")}
          onDrop={dropFiles}
        >
          <input ref={inputRef} className="file-input-hidden" type="file" accept="application/pdf,.pdf" multiple onChange={changeFiles}/>
          <span className="upload-icon pdf-upload-icon">PDF</span>
          <strong>Arraste e solte os ficheiros PDF aqui</strong>
          <small>ou clique para selecionar no seu dispositivo<br/>Até 60 MB por ficheiro</small>
          <span className="upload-cta">Selecionar PDF</span>
        </label>
        <div className="files-heading"><h3>Ficheiros carregados</h3><span>{files.length} ficheiro(s) · {sizeLabel(originalTotal)} total</span></div>
        {files.length ? (
          <div className="processing-list">
            {files.map((file, index) => (
              <div className="processing-file" key={`${file.name}-${file.lastModified}-${index}`}>
                <span className="file-type-icon">PDF</span>
                <div><b>{file.name}</b><small>{sizeLabel(file.size)} · PDF</small></div>
                <button type="button" className="remove-file-button" onClick={() => removeFile(index)} disabled={busy} aria-label={`Remover ${file.name}`}>×</button>
              </div>
            ))}
          </div>
        ) : <div className="tool-empty">Ainda não adicionaste documentos.</div>}
        {finished.length > 0 && (
          <div className="pdf-results">
            <h3>Arquivos processados — {finished.length} ficheiro(s)</h3>
            {finished.map((file) => (
              <div className="pdf-result-row" key={file.id}>
                <span className="file-type-icon">PDF</span>
                <div><b>{file.name}</b><small>Original: {sizeLabel(file.originalSize)} → Novo: {sizeLabel(file.savedSize)} · {Math.round((1 - file.savedSize / file.originalSize) * 100)}%</small></div>
                <a href={file.url} download={outputName(file.name)} className="pdf-download-single">↓</a>
              </div>
            ))}
          </div>
        )}
        {error && <div className="error-banner" role="alert">{error}</div>}
        {message && <div className={progress === 100 ? "success-banner" : "processing-message"}><b>{progress === 100 ? "✓" : "◌"}</b>{message}</div>}
      </section>

      <section className="tool-panel settings-panel">
        <div>
          <h2>Configurações de Compressão</h2>
          <div className="settings-group">
            <span className="settings-label">Método de otimização</span>
            <label className="radio-option"><input type="radio" name="pdf-quality" checked={quality === "balanced"} onChange={() => setQuality("balanced")}/><span><b>Equilibrado</b><small>Reorganiza os objetos e usa object streams.</small></span></label>
            <label className="radio-option"><input type="radio" name="pdf-quality" checked={quality === "structure"} onChange={() => setQuality("structure")}/><span><b>Estrutura</b><small>Regrava o documento sem atualizar metadados.</small></span></label>
          </div>
          <div className="tool-help-note"><strong>Nota importante:</strong> esta versão otimiza a estrutura interna do PDF no navegador. Não reamostra fotografias incorporadas, por isso a redução varia conforme o documento e pode ser pequena ou inexistente.</div>
          <div className="settings-group">
            <h3 className="panel-section-title">Resumo da compressão</h3>
            <div className="result-box">
              <div className="result-line"><span>Tamanho total antes:</span><strong>{files.length ? sizeLabel(originalTotal) : "—"}</strong></div>
              <div className="result-line"><span>Tamanho total depois:</span><strong className="good">{finished.length ? sizeLabel(outputTotal) : "—"}</strong></div>
              <div className="result-line"><span>Redução total:</span><strong className={savings > 0 ? "good" : ""}>{finished.length ? `${savings}%` : "—"}</strong></div>
            </div>
            <div className="progress-heading"><span>Processamento</span><span>{progress}%</span></div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }}/></div>
            <p className="status-note">{busy ? "A otimizar os documentos…" : progress === 100 ? "Concluído — os ficheiros estão prontos para descarregar." : "Os PDFs ficam no teu dispositivo."}</p>
          </div>
        </div>
        <div className="settings-actions">
          <button className="primary-button" onClick={compress} disabled={!files.length || busy}>{busy ? "A processar PDFs…" : "↓  Comprimir ficheiros"}</button>
          {finished.length > 0 && <button className="secondary-button" onClick={() => finished.forEach((file, index) => window.setTimeout(() => { const link = document.createElement("a"); link.href = file.url; link.download = outputName(file.name); link.click(); }, index * 350))}>↓  Baixar todos individualmente</button>}
          <p className="settings-footnote">O processamento ocorre no navegador. Os ficheiros não são enviados para a Nexauren.</p>
        </div>
      </section>
    </div>
  );
}
