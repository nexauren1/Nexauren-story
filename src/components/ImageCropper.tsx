import { useEffect, useRef, useState, type ChangeEvent } from "react";

type Format = "image/png" | "image/jpeg" | "image/webp";
type RatioPreset = "free" | "original" | "square" | "portrait" | "landscape" | "photo";
const ratios: { id: RatioPreset; label: string; value: number | null }[] = [
  { id:"free", label:"Livre", value:null }, { id:"original", label:"Original", value:null },
  { id:"square", label:"1:1", value:1 }, { id:"portrait", label:"4:5", value:4/5 },
  { id:"landscape", label:"16:9", value:16/9 }, { id:"photo", label:"3:2", value:3/2 }
];

export default function ImageCropper() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [result, setResult] = useState("");
  const [dims, setDims] = useState({ w:0, h:0 });
  const [x, setX] = useState(0); const [y, setY] = useState(0);
  const [w, setW] = useState(0); const [h, setH] = useState(0);
  const [preset, setPreset] = useState<RatioPreset>("free");
  const [format, setFormat] = useState<Format>("image/png");
  const [quality, setQuality] = useState(92);
  const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(0);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");

  useEffect(() => {
    if (!file) { setImageUrl(""); return; }
    const url = URL.createObjectURL(file); setImageUrl(url);
    const img = new Image();
    img.onload = () => {
      setDims({ w:img.naturalWidth, h:img.naturalHeight });
      setX(0); setY(0); setW(img.naturalWidth); setH(img.naturalHeight);
      setPreset("free"); setResult(""); setError(""); setMessage(""); setProgress(0);
    };
    img.onerror = () => setError("Não foi possível abrir a imagem.");
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result); }, [result]);

  function clearResult() {
    setResult((previous) => { if (previous) URL.revokeObjectURL(previous); return ""; });
    setProgress(0); setMessage("");
  }
  function choose(next?: File) {
    if (!next) return;
    if (!next.type.startsWith("image/")) { setError("Selecciona uma imagem válida."); return; }
    if (next.size > 35 * 1048576) { setError("A imagem ultrapassa 35 MB."); return; }
    setFile(next);
  }
  function change(event: ChangeEvent<HTMLInputElement>) { choose(event.target.files?.[0]); event.target.value = ""; }

  function applyRatio(next: RatioPreset) {
    setPreset(next); clearResult();
    if (!dims.w || !dims.h || next === "free") return;
    const selected = ratios.find((item) => item.id === next);
    const target = next === "original" ? dims.w / dims.h : selected?.value;
    if (!target) return;
    let nextW = w || dims.w, nextH = h || dims.h;
    if (nextW / nextH > target) nextW = Math.round(nextH * target);
    else nextH = Math.round(nextW / target);
    nextW = Math.max(1, Math.min(dims.w, nextW));
    nextH = Math.max(1, Math.min(dims.h, nextH));
    setW(nextW); setH(nextH);
    setX(Math.max(0, Math.floor((dims.w - nextW) / 2)));
    setY(Math.max(0, Math.floor((dims.h - nextH) / 2)));
  }
  function setCropValue(key: "x" | "y" | "w" | "h", value: number) {
    clearResult();
    if (key === "x") setX(Math.max(0, Math.min(dims.w - w, value)));
    if (key === "y") setY(Math.max(0, Math.min(dims.h - h, value)));
    if (key === "w") setW(Math.max(1, Math.min(dims.w - x, value)));
    if (key === "h") setH(Math.max(1, Math.min(dims.h - y, value)));
    setPreset("free");
  }
  function resetArea() { setX(0); setY(0); setW(dims.w); setH(dims.h); setPreset("free"); clearResult(); }
  function centerCrop() {
    if (!dims.w || !dims.h) return;
    const side = Math.min(dims.w, dims.h);
    setW(side); setH(side); setX(Math.floor((dims.w - side)/2)); setY(Math.floor((dims.h - side)/2));
    setPreset("square"); clearResult();
  }

  async function crop() {
    if (!file || !imageUrl || busy) return;
    if (x < 0 || y < 0 || w < 1 || h < 1 || x + w > dims.w || y + h > dims.h) {
      setError("A área de corte tem de estar dentro dos limites da imagem."); return;
    }
    setBusy(true); setProgress(10); setError(""); setMessage("A preparar a área de corte…");
    try {
      const img = new Image(); img.src = imageUrl;
      await new Promise<void>((resolve,reject) => { img.onload=()=>resolve(); img.onerror=()=>reject(new Error("Falha ao abrir imagem.")); });
      setProgress(32);
      const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponível.");
      if (format === "image/jpeg") { ctx.fillStyle="#fff"; ctx.fillRect(0,0,w,h); }
      ctx.drawImage(img,x,y,w,h,0,0,w,h); setProgress(72);
      const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Não foi possível gerar a imagem.")),format,quality/100));
      setProgress(94);
      setResult((previous) => { if (previous) URL.revokeObjectURL(previous); return URL.createObjectURL(blob); });
      setProgress(100); setMessage("Recorte criado. " + w + " × " + h + " px, pronto para descarregar.");
    } catch (cause) {
      setProgress(0); setError(cause instanceof Error ? cause.message : "Não foi possível cortar a imagem."); setMessage("");
    } finally { setBusy(false); }
  }
  const extension = format === "image/jpeg" ? "jpg" : format === "image/png" ? "png" : "webp";
  const selection = { left:(x/Math.max(1,dims.w))*100+"%", top:(y/Math.max(1,dims.h))*100+"%", width:(w/Math.max(1,dims.w))*100+"%", height:(h/Math.max(1,dims.h))*100+"%" };

  return (
    <div className="tool-workspace nx-image-workspace">
      <section className="tool-panel nx-image-main-panel">
        <div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">01 / PRÉ-VISUALIZAÇÃO</span><h2>{result ? "Resultado final" : "Área de recorte"}</h2><p>{result ? "A imagem exportada está pronta." : "A selecção é destacada sobre a imagem original."}</p></div><span className="nx-local-indicator"><i/> LOCAL</span></div>
        {!file ? <label className="upload-zone nx-upload-zone">
          <input ref={input} className="file-input-hidden" type="file" accept="image/*" onChange={change}/>
          <span className="nx-upload-symbol">◈</span><strong>Escolher imagem para recortar</strong><small>PNG, JPG, WebP · até 35 MB</small><span className="upload-cta">Seleccionar imagem</span>
        </label> : <>
          <div className="nx-crop-preview" style={{aspectRatio:dims.w>0?dims.w+" / "+dims.h:"4 / 3",width:dims.w>0?Math.min(460*dims.w/dims.h,760)+"px":"100%"}}>
            {result ? <img src={result} alt="Imagem recortada"/> : <>
              <img src={imageUrl} alt="Imagem original"/>
              <div className="nx-crop-selection" style={selection}><span>ÁREA SELECCIONADA</span></div>
            </>}
          </div>
          <div className="nx-image-meta"><span>{file.name}</span><b>{dims.w} × {dims.h} px</b><button className="nx-ghost-button" type="button" onClick={() => { setFile(null); setResult(""); setError(""); setMessage(""); }}>Trocar imagem</button></div>
          <div className="nx-crop-shortcuts"><button type="button" onClick={resetArea} disabled={busy}>Imagem completa</button><button type="button" onClick={centerCrop} disabled={busy}>Corte quadrado central</button></div>
        </>}
        {error && <div className="error-banner" role="alert">{error}</div>}
        {message && <div className={progress===100?"success-banner":"processing-message"}><b>{progress===100?"✓":"◌"}</b>{message}</div>}
        {result && <a className="download-button nx-download-button" href={result} download={(file?.name.replace(/\.[^.]+$/,"")||"imagem")+"-recortada."+extension}>↓ Descarregar imagem recortada</a>}
      </section>

      <section className="tool-panel settings-panel nx-image-settings">
        <div>
          <div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">02 / CONTROLO</span><h2>Definir recorte</h2><p>Usa proporções rápidas ou ajusta os valores exactos.</p></div></div>
          <div className="settings-group">
            <span className="settings-label">Proporção</span>
            <div className="nx-ratio-grid">{ratios.map((item) => <button type="button" key={item.id} className={preset===item.id?"is-active":""} disabled={!file||busy} onClick={() => applyRatio(item.id)}>{item.label}</button>)}</div>
          </div>
          <div className="settings-group">
            <span className="settings-label">Posição e dimensões (px)</span>
            <div className="field-grid">
              <label className="field-label">X<input type="number" min="0" max={Math.max(0,dims.w-w)} value={x} disabled={!file||busy} onChange={(e)=>setCropValue("x",Number(e.target.value))}/></label>
              <label className="field-label">Y<input type="number" min="0" max={Math.max(0,dims.h-h)} value={y} disabled={!file||busy} onChange={(e)=>setCropValue("y",Number(e.target.value))}/></label>
              <label className="field-label">Largura<input type="number" min="1" max={dims.w} value={w} disabled={!file||busy} onChange={(e)=>setCropValue("w",Number(e.target.value))}/></label>
              <label className="field-label">Altura<input type="number" min="1" max={dims.h} value={h} disabled={!file||busy} onChange={(e)=>setCropValue("h",Number(e.target.value))}/></label>
            </div>
          </div>
          <div className="settings-group">
            <label className="field-label">Formato de saída<select value={format} disabled={!file||busy} onChange={(e)=>{setFormat(e.target.value as Format);clearResult();}}><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option></select></label>
            {format!=="image/png" && <div className="nx-quality-row"><span>Qualidade JPG/WebP</span><b>{quality}%</b></div>}
            {format!=="image/png" && <input type="range" min="35" max="100" value={quality} disabled={!file||busy} onChange={(e)=>{setQuality(Number(e.target.value));clearResult();}}/>}
          </div>
          <div className="nx-progress-card"><div className="progress-heading"><span>Processamento</span><b>{progress}%</b></div><div className="progress-track"><div className="progress-fill" style={{width:progress+"%"}}/></div><p>{busy?"A aplicar o recorte…":progress===100?"Imagem pronta para guardar.":"O recorte é processado neste dispositivo."}</p></div>
        </div>
        <div className="settings-actions"><button className="nx-run-button" disabled={!file||busy||w<1||h<1} onClick={()=>void crop()}><span>{busy?"A recortar imagem…":"Aplicar recorte"}</span><b>{busy?"◌":"↗"}</b></button><p className="settings-footnote">A imagem original mantém-se intacta. A exportação é feita localmente no navegador.</p></div>
      </section>
    </div>
  );
}
