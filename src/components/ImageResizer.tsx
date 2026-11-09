import { useEffect, useMemo, useRef, useState, type DragEvent, type ChangeEvent } from "react";

type ImageFormat = "image/jpeg" | "image/png" | "image/webp";
function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
function safeBaseName(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-") || "imagem";
}

export default function ImageResizer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [keepRatio, setKeepRatio] = useState(true);
  const [quality, setQuality] = useState(75);
  const [format, setFormat] = useState<ImageFormat>("image/jpeg");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (!file) {
      setSourceUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    const image = new Image();
    image.onload = () => {
      setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight });
      setWidth(String(image.naturalWidth));
      setHeight(String(image.naturalHeight));
      setResultUrl("");
      setProcessedBlob(null);
      setProgress(0);
      setNotice("");
      setError("");
    };
    image.onerror = () => setError("Não foi possível abrir esta imagem.");
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => () => {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  }, [resultUrl]);

  const ratio = naturalSize.width > 0 ? naturalSize.height / naturalSize.width : 1;
  const newWidth = Math.max(1, Math.round(Number(width) || 1));
  const newHeight = Math.max(1, Math.round(Number(height) || 1));
  const reduction = useMemo(() => {
    if (!file || !processedBlob) return 0;
    return Math.round((1 - processedBlob.size / file.size) * 100);
  }, [file, processedBlob]);

  function setImage(next: File | undefined) {
    if (!next) return;
    if (!next.type.startsWith("image/")) {
      setError("Seleciona um ficheiro de imagem válido.");
      return;
    }
    if (next.size > 35 * 1024 * 1024) {
      setError("A imagem ultrapassa o limite de 35 MB.");
      return;
    }
    setFile(next);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setImage(event.target.files?.[0]);
    event.target.value = "";
  }
  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.currentTarget.classList.remove("is-dragging");
    setImage(event.dataTransfer.files?.[0]);
  }

  async function processImage() {
    if (!file || !sourceUrl) return;
    if (newWidth > 16000 || newHeight > 16000 || newWidth * newHeight > 120_000_000) {
      setError("Escolhe dimensões inferiores a 16.000 px e até 120 megapíxeis.");
      return;
    }
    setBusy(true);
    setProgress(8);
    setError("");
    setNotice("");
    try {
      const image = new Image();
      image.src = sourceUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Falha ao descodificar a imagem."));
      });
      setProgress(28);

      const canvas = document.createElement("canvas");
      canvas.width = newWidth;
      canvas.height = newHeight;
      const context = canvas.getContext("2d", { alpha: format !== "image/jpeg" });
      if (!context) throw new Error("O navegador não conseguiu iniciar o processamento.");
      if (format === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, newWidth, newHeight);
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, newWidth, newHeight);
      setProgress(65);

      const output = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error("Não foi possível gerar a imagem final.")),
          format,
          quality / 100,
        );
      });
      setProgress(92);
      const nextUrl = URL.createObjectURL(output);
      setResultUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return nextUrl;
      });
      setProcessedBlob(output);
      setProgress(100);
      const sizeDifference = Math.round((1 - output.size / file.size) * 100);
      setNotice(
        output.size < file.size
          ? `Concluído. O ficheiro ficou ${sizeDifference}% mais leve.`
          : output.size === file.size
            ? "Concluído. O tamanho do ficheiro manteve-se."
            : "Imagem processada. A nova versão ficou maior; experimenta reduzir a qualidade ou as dimensões.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ocorreu um erro ao processar a imagem.");
      setProgress(0);
    } finally {
      setBusy(false);
    }
  }

  function invalidateResult() {
    setResultUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return "";
    });
    setProcessedBlob(null);
    setProgress(0);
    setNotice("");
  }
  function updateWidth(value: string) {
    setWidth(value);
    if (keepRatio && value && Number(value) > 0) setHeight(String(Math.max(1, Math.round(Number(value) * ratio))));
    invalidateResult();
  }
  function updateHeight(value: string) {
    setHeight(value);
    if (keepRatio && value && Number(value) > 0 && ratio > 0) setWidth(String(Math.max(1, Math.round(Number(value) / ratio))));
    invalidateResult();
  }

  return (
    <div className="tool-workspace image-workspace">
      <section className="tool-panel">
        <div className="panel-topline">
          <h2>Pré-visualização do resultado</h2>
          {resultUrl && <span className="preview-mode-label">RESULTADO PRONTO</span>}
        </div>
        {!file ? (
          <label
            className="upload-zone"
            onDragOver={(event) => { event.preventDefault(); event.currentTarget.classList.add("is-dragging"); }}
            onDragLeave={(event) => event.currentTarget.classList.remove("is-dragging")}
            onDrop={onDrop}
          >
            <input ref={inputRef} className="file-input-hidden" type="file" accept="image/*" onChange={onFileChange}/>
            <span className="upload-icon">☁</span>
            <strong>Arraste e solte uma imagem aqui</strong>
            <small>ou clique para selecionar do seu dispositivo<br/>JPG, PNG, WebP · máximo 35 MB</small>
            <span className="upload-cta">Selecionar imagem</span>
          </label>
        ) : (
          <>
            <div className="preview-stage image-result-stage">
              <img src={resultUrl || sourceUrl} alt={resultUrl ? "Imagem processada" : "Imagem original"} />
              <span className="image-preview-badge">{resultUrl ? "RESULTADO" : "ORIGINAL"}</span>
            </div>
            <div className="file-caption">{file.name} · {naturalSize.width} × {naturalSize.height} px{resultUrl ? ` · Resultado: ${newWidth} × ${newHeight} px` : ""}</div>
            <div className="image-toolbar">
              <span className="file-selected"><b>▧</b><span><strong>{file.name}</strong><small>{readableSize(file.size)}</small></span></span>
              <button className="secondary-button" onClick={() => { setFile(null); setResultUrl(""); setProcessedBlob(null); setError(""); setNotice(""); }}>Remover imagem</button>
              <button className="secondary-button" onClick={() => inputRef.current?.click()}>Trocar</button>
              <input ref={inputRef} className="file-input-hidden" type="file" accept="image/*" onChange={onFileChange}/>
            </div>
          </>
        )}
        {error && <div className="error-banner" role="alert">{error}</div>}
        {notice && <div className="success-banner"><b>✓</b>{notice}</div>}
      </section>

      <section className="tool-panel settings-panel">
        <div>
          <h2>Configurações de Redimensionamento</h2>
          <div className="settings-group">
            <span className="settings-label">Dimensões</span>
            <div className="field-grid">
              <label className="field-label">Largura (px)<input type="number" min="1" max="16000" value={width} disabled={!file || busy} onChange={(event) => updateWidth(event.target.value)}/></label>
              <label className="field-label">Altura (px)<input type="number" min="1" max="16000" value={height} disabled={!file || busy} onChange={(event) => updateHeight(event.target.value)}/></label>
            </div>
            <label className="toggle-row ratio-toggle"><span>Manter proporção</span><input type="checkbox" checked={keepRatio} disabled={!file || busy} onChange={(event) => setKeepRatio(event.target.checked)}/></label>
          </div>
          <div className="settings-group">
            <div className="range-heading"><span>Qualidade</span><span className="range-value">{quality}%</span></div>
            <input type="range" min="20" max="100" step="1" value={quality} disabled={!file || busy} onChange={(event) => { setQuality(Number(event.target.value)); invalidateResult(); }}/>
            <p className="range-help">Uma qualidade entre 70% e 85% costuma equilibrar nitidez e tamanho. PNG não utiliza este controlo.</p>
          </div>
          <div className="settings-group">
            <label className="field-label">Formato de saída
              <select value={format} disabled={!file || busy} onChange={(event) => { setFormat(event.target.value as ImageFormat); invalidateResult(); }}>
                <option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option>
              </select>
            </label>
          </div>
        </div>
        <div>
          <h3 className="panel-section-title">Resultado</h3>
          <div className="result-box">
            <div className="result-line"><span>Tamanho original:</span><strong>{file ? readableSize(file.size) : "—"}</strong></div>
            <div className="result-line"><span>Novo tamanho:</span><strong className="good">{processedBlob ? readableSize(processedBlob.size) : "—"}</strong></div>
            <div className="result-line"><span>Redução:</span><strong className={reduction > 0 ? "good" : ""}>{processedBlob ? `${reduction}%` : "—"}</strong></div>
          </div>
          <div className="progress-heading"><span>Processamento</span><span>{progress}%</span></div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }}/></div>
          <p className="status-note">{busy ? "A preparar a imagem…" : progress === 100 ? "Concluído — o processamento foi feito no teu navegador." : "Seleciona uma imagem para começar."}</p>
        </div>
        <div className="settings-actions">
          <button className="primary-button" disabled={!file || busy} onClick={processImage}>{busy ? "A processar imagem…" : "↓  Redimensionar e Processar"}</button>
          {resultUrl && <a className="download-button" href={resultUrl} download={`${safeBaseName(file?.name ?? "imagem")}-nexauren.${format==="image/jpeg"?"jpg":format==="image/png"?"png":"webp"}`}>↓  Baixar imagem</a>}
          <p className="settings-footnote">Os ficheiros são processados localmente no dispositivo. Não são enviados para um servidor.</p>
        </div>
      </section>
    </div>
  );
}
