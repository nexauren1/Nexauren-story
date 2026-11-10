import { useEffect, useRef, useState, type ChangeEvent } from "react";

type Position = "center" | "top-left" | "top" | "top-right" | "left" | "right" | "bottom-left" | "bottom" | "bottom-right";
type Format = "image/png" | "image/jpeg" | "image/webp";
const positions: { id:Position; label:string }[] = [
  {id:"top-left",label:"Superior esquerdo"},{id:"top",label:"Superior centro"},{id:"top-right",label:"Superior direito"},
  {id:"left",label:"Centro esquerdo"},{id:"center",label:"Centro"},{id:"right",label:"Centro direito"},
  {id:"bottom-left",label:"Inferior esquerdo"},{id:"bottom",label:"Inferior centro"},{id:"bottom-right",label:"Inferior direito"}
];
export default function ImageWatermark(){
  const input=useRef<HTMLInputElement>(null);
  const [file,setFile]=useState<File|null>(null),[source,setSource]=useState(""),[result,setResult]=useState("");
  const [size,setSize]=useState({w:0,h:0}),[text,setText]=useState("NEXAUREN"),[position,setPosition]=useState<Position>("bottom-right");
  const [fontSize,setFontSize]=useState(44),[opacity,setOpacity]=useState(55),[color,setColor]=useState("#ffffff");
  const [outline,setOutline]=useState(true),[format,setFormat]=useState<Format>("image/png");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  useEffect(()=>{if(!file){setSource("");return;}const url=URL.createObjectURL(file);setSource(url);const img=new Image();img.onload=()=>setSize({w:img.naturalWidth,h:img.naturalHeight});img.onerror=()=>setError("Não foi possível abrir a imagem.");img.src=url;return()=>URL.revokeObjectURL(url);},[file]);
  useEffect(()=>()=>{if(result)URL.revokeObjectURL(result);},[result]);
  function invalidate(){setResult(p=>{if(p)URL.revokeObjectURL(p);return "";});setNotice("");}
  function choose(e:ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];e.target.value="";if(!f)return;if(!f.type.startsWith("image/")){setError("Selecciona uma imagem válida.");return;}if(f.size>35*1048576){setError("A imagem ultrapassa 35 MB.");return;}setFile(f);setError("");invalidate();}
  async function exportImage(){
    if(!file||!source||!text.trim()||busy)return;
    setBusy(true);setError("");setNotice("");
    try{
      const img=new Image();img.src=source;await new Promise<void>((res,rej)=>{img.onload=()=>res();img.onerror=()=>rej(new Error("Não foi possível descodificar a imagem."));});
      const canvas=document.createElement("canvas");canvas.width=size.w;canvas.height=size.h;
      const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas indisponível.");
      ctx.drawImage(img,0,0);const actualSize=Math.max(12,Math.round(fontSize*Math.max(1,size.w/1200)));
      const margin=Math.max(14,Math.round(size.w*.025));ctx.font="700 "+actualSize+"px system-ui, sans-serif";ctx.textBaseline="middle";
      const measured=ctx.measureText(text);let x=margin,y=size.h-margin;
      if(position.includes("right"))x=size.w-margin-measured.width;
      else if(position==="top"||position==="center"||position==="bottom")x=(size.w-measured.width)/2;
      if(position.startsWith("top"))y=margin+actualSize/2;
      else if(position.startsWith("bottom"))y=size.h-margin-actualSize/2;
      else y=size.h/2;
      ctx.save();ctx.globalAlpha=opacity/100;ctx.fillStyle=color;
      if(outline){ctx.lineWidth=Math.max(2,actualSize*.07);ctx.strokeStyle=color.toLowerCase()==="#ffffff"?"rgba(0,0,0,.58)":"rgba(255,255,255,.62)";ctx.strokeText(text,x,y);}
      ctx.fillText(text,x,y);ctx.restore();
      const blob=await new Promise<Blob>((res,rej)=>canvas.toBlob(v=>v?res(v):rej(new Error("Não foi possível exportar a imagem.")),format,.93));
      setResult(p=>{if(p)URL.revokeObjectURL(p);return URL.createObjectURL(blob);});setNotice("Marca de água aplicada. A imagem original foi preservada.");
    }catch(e){setError(e instanceof Error?e.message:"Falha ao aplicar a marca de água.");}
    finally{setBusy(false);}
  }
  const ext=format==="image/jpeg"?"jpg":format==="image/webp"?"webp":"png";
  return <div className="tool-workspace nx-image-workspace">
    <section className="tool-panel nx-image-main-panel">
      <div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">01 / PRÉ-VISUALIZAÇÃO</span><h2>Marca de água</h2><p>Confirma a imagem e o texto antes de exportar.</p></div><span className="nx-local-indicator"><i/> LOCAL</span></div>
      {!file?<label className="upload-zone nx-upload-zone"><input ref={input} className="file-input-hidden" type="file" accept="image/*" onChange={choose}/><span className="nx-upload-symbol">◈</span><strong>Escolher imagem</strong><small>PNG, JPG ou WebP · até 35 MB</small><span className="upload-cta">Seleccionar imagem</span></label>:<>
        <div className="nx-watermark-preview"><img src={source} alt="Imagem original"/>{text.trim()&&<span data-position={position} style={{fontSize:Math.max(12,fontSize/3.5)+"px",color,opacity:opacity/100,textShadow:outline?"0 1px 4px rgba(0,0,0,.9)":"none"}}>{text}</span>}</div>
        <div className="nx-image-meta"><span>{file.name}</span><b>{size.w} × {size.h} px</b><button className="nx-ghost-button" type="button" onClick={()=>{setFile(null);setSource("");invalidate();}}>Trocar imagem</button></div>
      </>}
      {notice&&<div className="success-banner"><b>✓</b>{notice}</div>}{error&&<div className="error-banner" role="alert">{error}</div>}
      {result&&<><div className="nx-tool-panel-heading"><div><h2>Resultado exportado</h2><p>Pré-visualiza o ficheiro com a marca de água.</p></div></div><img className="nx-watermark-result" src={result} alt="Imagem com marca de água"/><a className="download-button nx-download-button" href={result} download={(file?.name.replace(/\.[^.]+$/,"")||"imagem")+"-watermark."+ext}>↓ Descarregar imagem</a></>}
    </section>
    <section className="tool-panel settings-panel nx-image-settings">
      <div><div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">02 / PERSONALIZAÇÃO</span><h2>Configurar marca</h2><p>Ajusta o texto, a posição e o estilo.</p></div></div>
        <div className="settings-group"><label className="field-label">Texto da marca<input value={text} maxLength={80} disabled={!file||busy} onChange={e=>{setText(e.target.value);invalidate();}} placeholder="Ex.: © Nexauren"/></label></div>
        <div className="settings-group"><span className="settings-label">Posição</span><div className="nx-position-grid">{positions.map(p=><button type="button" key={p.id} title={p.label} aria-label={p.label} className={position===p.id?"is-active":""} disabled={!file||busy} onClick={()=>{setPosition(p.id);invalidate();}}><i/></button>)}</div></div>
        <div className="settings-group"><div className="nx-quality-row"><span>Tamanho do texto</span><b>{fontSize}px</b></div><input type="range" min="18" max="110" value={fontSize} disabled={!file||busy} onChange={e=>{setFontSize(Number(e.target.value));invalidate();}}/></div>
        <div className="settings-group"><div className="nx-quality-row"><span>Opacidade</span><b>{opacity}%</b></div><input type="range" min="10" max="100" value={opacity} disabled={!file||busy} onChange={e=>{setOpacity(Number(e.target.value));invalidate();}}/></div>
        <div className="settings-group"><label className="field-label nx-background-field">Cor do texto<span><input type="color" value={color} disabled={!file||busy} onChange={e=>{setColor(e.target.value);invalidate();}}/><b>{color.toUpperCase()}</b></span></label><label className="nx-check-line"><input type="checkbox" checked={outline} disabled={!file||busy} onChange={e=>{setOutline(e.target.checked);invalidate();}}/> Contorno para melhorar a leitura</label></div>
        <div className="settings-group"><label className="field-label">Formato de saída<select value={format} disabled={!file||busy} onChange={e=>{setFormat(e.target.value as Format);invalidate();}}><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option></select></label></div>
      </div>
      <div className="settings-actions"><button className="nx-run-button" disabled={!file||!text.trim()||busy} onClick={()=>void exportImage()}><span>{busy?"A aplicar marca de água…":"Aplicar e exportar"}</span><b>{busy?"◌":"↗"}</b></button><p className="settings-footnote">A imagem é processada localmente. Não é enviada para um servidor.</p></div>
    </section>
  </div>;
}
