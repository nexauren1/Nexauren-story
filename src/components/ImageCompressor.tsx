import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";

type OutputFormat = "image/webp" | "image/jpeg" | "image/png";
type DecodedImage = { source: CanvasImageSource; width: number; height: number; dispose: () => void };

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}
function safeName(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-") || "image";
}
async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, dispose: () => bitmap.close() };
    } catch {
      // Fall back to HTMLImageElement for formats supported by the browser decoder.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      let settled = false;
      const finish = () => {
        if (settled) return;
        if (element.naturalWidth > 0 && element.naturalHeight > 0) {
          settled = true;
          resolve(element);
        } else if (element.complete) {
          settled = true;
          reject(new Error("Este formato de imagem não é suportado pelo navegador. Usa JPG, PNG ou WebP."));
        }
      };
      element.onload = finish;
      element.onerror = () => {
        if (!settled) {
          settled = true;
          reject(new Error("Não foi possível descodificar a imagem. Experimenta exportá-la como JPG, PNG ou WebP."));
        }
      };
      element.src = url;
      if (element.complete) queueMicrotask(finish);
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, dispose: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export default function ImageCompressor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [quality, setQualidade] = useState(78);
  const [format, setFormat] = useState<OutputFormat>("image/webp");
  const [maxWidth, setMaxWidth] = useState("");
  const [maxHeight, setMaxHeight] = useState("");
  const [background, setBackground] = useState("#ffffff");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [output, setOutput] = useState<Blob | null>(null);
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 });
  const [previewResult, setPreviewResult] = useState(false);

  useEffect(() => {
    if (!file) {
      setSourceUrl("");
      setOriginalDimensions({ width: 0, height: 0 });
      return;
    }
    const url = URL.createObjectURL(file);
    let cancelled = false;
    setSourceUrl(url);
    setError("");
    setNotice("");
    setOutput(null);
    setResultUrl("");
    setProgress(0);
    setPreviewResult(false);
    void decodeImage(file).then(decoded => {
      try {
        if (cancelled) return;
        setOriginalDimensions({ width: decoded.width, height: decoded.height });
      } finally {
        decoded.dispose();
      }
    }).catch(cause => {
      if (!cancelled) {
        setError(cause instanceof Error ? cause.message : "Não foi possível abrir a imagem.");
        setSourceUrl("");
      }
    });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    if (!resultUrl) return;
    return () => URL.revokeObjectURL(resultUrl);
  }, [resultUrl]);

  function selectFile(next?: File) {
    if (!next) return;
    const extensionIsImage = /\.(jpe?g|png|webp|gif|bmp|avif|tiff?)$/i.test(next.name);
    if (!next.type.startsWith("image/") && !extensionIsImage) {
      setError("Seleciona um ficheiro de imagem válido.");
      return;
    }
    if (next.size > 50 * 1024 * 1024) {
      setError("A imagem deve ter menos de 50 MB.");
      return;
    }
    setError("");
    setFile(next);
  }
  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0]);
    event.target.value = "";
  }
  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.currentTarget.classList.remove("is-dragging");
    selectFile(event.dataTransfer.files?.[0]);
  }

  async function compress() {
    if (!file || busy) return;
    setBusy(true);
    setProgress(5);
    setError("");
    setNotice("");
    setOutput(null);
    setResultUrl("");
    try {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      setProgress(16);
      const decoded = await decodeImage(file);
      try {
        const originalWidth = decoded.width;
        const originalHeight = decoded.height;
        if (!originalWidth || !originalHeight || originalWidth * originalHeight > 120_000_000) {
          throw new Error("Esta imagem é demasiado grande para ser processada com segurança neste navegador (máximo de 120 megapíxeis).");
        }
        const widthLimit = Math.max(0, Number(maxWidth) || 0);
        const heightLimit = Math.max(0, Number(maxHeight) || 0);
        const scale = Math.min(
          1,
          widthLimit > 0 ? widthLimit / originalWidth : 1,
          heightLimit > 0 ? heightLimit / originalHeight : 1
        );
        const width = Math.max(1, Math.round(originalWidth * scale));
        const height = Math.max(1, Math.round(originalHeight * scale));
        setProgress(42);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { alpha: format !== "image/jpeg" });
        if (!context) throw new Error("O navegador não conseguiu iniciar o processador de imagens.");
        if (format === "image/jpeg") {
          context.fillStyle = background;
          context.fillRect(0, 0, width, height);
        }
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(decoded.source, 0, 0, width, height);
        setProgress(70);
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            value => value ? resolve(value) : reject(new Error("O navegador não conseguiu criar a imagem comprimida.")),
            format,
            format === "image/png" ? undefined : quality / 100
          );
        });
        setProgress(92);
        setOutput(blob);
        setResultUrl(URL.createObjectURL(blob));
        setPreviewResult(true);
        const reduction = Math.round((1 - blob.size / file.size) * 100);
        setNotice(blob.size < file.size
          ? "Concluído. A nova imagem ficou " + reduction + "% mais leve."
          : "A imagem foi convertida, mas o ficheiro não ficou mais pequeno. Experimenta reduzir a qualidade ou as dimensões.");
        setProgress(100);
      } finally {
        decoded.dispose();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Compression failed. Please try another image.");
      setProgress(0);
    } finally {
      setBusy(false);
    }
  }

  const reduction = output && file ? Math.round((1 - output.size / file.size) * 100) : null;
  const extension = format === "image/jpeg" ? "jpg" : format === "image/png" ? "png" : "webp";

  return (
    <div className="ns-compressor-workspace">
      <section className="ns-compressor-preview ns-compressor-card">
        <div className="ns-compressor-card-heading">
          <div><span className="ns-section-kicker">PRÉ-VISUALIZAÇÃO DA IMAGEM</span><h2>Pré-visualização da imagem</h2></div>
          {output && <span className="ns-compressor-ready">✓ PRONTA</span>}
        </div>
        {!file ? (
          <label
            className="ns-compressor-upload"
            onDragOver={event => { event.preventDefault(); event.currentTarget.classList.add("is-dragging"); }}
            onDragLeave={event => event.currentTarget.classList.remove("is-dragging")}
            onDrop={onDrop}
          >
            <input ref={inputRef} type="file" accept="image/*" onChange={onFileChange} />
            <span className="ns-compressor-cloud">↑</span>
            <strong>Arrasta e larga uma imagem aqui</strong>
            <small>ou seleciona um ficheiro do teu dispositivo<br/>JPG · PNG · WebP · AVIF · até 50 MB</small>
            <span className="ns-compressor-choose">Escolher imagem</span>
          </label>
        ) : (
          <>
            <div className="ns-compressor-image-stage">
              <img
                src={previewResult && resultUrl ? resultUrl : sourceUrl}
                alt={previewResult && resultUrl ? "Pré-visualização da imagem comprimida" : "Pré-visualização da imagem original"}
                onError={() => setError("The image preview could not be displayed. Try JPG, PNG or WebP.")}
              />
              <span>{previewResult && resultUrl ? "COMPRIMIDA" : "ORIGINAL"}</span>
            </div>
            <div className="ns-compressor-file">
              <span className="ns-compressor-file-icon">▧</span>
              <span><b>{file.name}</b><small>{formatSize(file.size)} · {originalDimensions.width} × {originalDimensions.height} px</small></span>
              <button type="button" onClick={() => { setFile(null); setOutput(null); setResultUrl(""); setError(""); setNotice(""); setProgress(0); }}>Remover</button>
              <button type="button" onClick={() => inputRef.current?.click()}>Substituir</button>
              <input ref={inputRef} type="file" accept="image/*" onChange={onFileChange} />
            </div>
            {output && <div className="ns-compressor-switch"><button type="button" className={!previewResult ? "active" : ""} onClick={() => setPreviewResult(false)}>Original</button><button type="button" className={previewResult ? "active" : ""} onClick={() => setPreviewResult(true)}>Compressed</button></div>}
          </>
        )}
        {error && <p className="ns-compressor-error" role="alert">{error}</p>}
        {notice && <p className="ns-compressor-success" role="status">{notice}</p>}
      </section>

      <section className="ns-compressor-settings ns-compressor-card">
        <div className="ns-compressor-card-heading"><div><span className="ns-section-kicker">MOTOR DE COMPRESSÃO</span><h2>Definições de compressão</h2></div><span className="ns-compressor-engine-dot">● LOCAL</span></div>
        <div className="ns-compressor-settings-grid">
          <label>Formato de saída
            <select value={format} disabled={!file || busy} onChange={event => { setFormat(event.target.value as OutputFormat); setOutput(null); setResultUrl(""); setNotice(""); }}>
              <option value="image/webp">WebP — recomendado</option>
              <option value="image/jpeg">JPG — fotografias</option>
              <option value="image/png">PNG — transparência</option>
            </select>
          </label>
          <label>Largura máxima (px)
            <input type="number" inputMode="numeric" min="1" max="16000" placeholder="Largura original" value={maxWidth} disabled={!file || busy} onChange={event => { setMaxWidth(event.target.value); setOutput(null); setResultUrl(""); setNotice(""); }}/>
          </label>
          <label>Altura máxima (px)
            <input type="number" inputMode="numeric" min="1" max="16000" placeholder="Altura original" value={maxHeight} disabled={!file || busy} onChange={event => { setMaxHeight(event.target.value); setOutput(null); setResultUrl(""); setNotice(""); }}/>
          </label>
          <label className="ns-compressor-quality">Qualidade <b>{quality}%</b>
            <input type="range" min="20" max="100" step="1" value={quality} disabled={!file || busy || format === "image/png"} onChange={event => { setQualidade(Number(event.target.value)); setOutput(null); setResultUrl(""); setNotice(""); }}/>
            <small>Uma qualidade mais baixa costuma criar um ficheiro menor. PNG é um formato sem perdas e não utiliza esta definição.</small>
          </label>
          {format === "image/jpeg" && <label>Fundo JPG
            <span className="ns-compressor-color"><input type="color" value={background} disabled={!file || busy} onChange={event => setBackground(event.target.value)}/><b>{background.toUpperCase()}</b></span>
          </label>}
        </div>
        <div className="ns-compressor-stats">
          <div><small>Ficheiro original</small><b>{file ? formatSize(file.size) : "—"}</b></div>
          <div><small>Novo ficheiro</small><b>{output ? formatSize(output.size) : "—"}</b></div>
          <div><small>Variação do tamanho</small><b className={reduction !== null && reduction > 0 ? "positive" : ""}>{reduction === null ? "—" : reduction > 0 ? reduction + "% mais pequeno" : reduction < 0 ? Math.abs(reduction) + "% maior" : "Mesmo tamanho"}</b></div>
        </div>
        <div className="ns-compressor-progress"><div><span>Processamento</span><b>{progress}%</b></div><span className="track"><i style={{ width: progress + "%" }}/></span></div>
        <div className="ns-compressor-actions">
          <button type="button" className="ns-button ns-button-primary" disabled={!file || busy} onClick={compress}>{busy ? "A comprimir imagem…" : "Comprimir imagem"} <span>{busy ? "◌" : "↗"}</span></button>
          {output && resultUrl && <a className="ns-button ns-button-outline" href={resultUrl} download={safeName(file?.name ?? "image") + "-nexauren." + extension}>↓ Descarregar imagem comprimida</a>}
          <small>Os ficheiros são processados localmente no teu navegador. A imagem original nunca é enviada para a Nexauren.</small>
        </div>
      </section>
    </div>
  );
}