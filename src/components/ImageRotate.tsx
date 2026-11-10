import { useEffect, useRef, useState, type ChangeEvent } from "react";

type Format="image/png"|"image/jpeg"|"image/webp";
export default function ImageRotate(){
  const input=useRef<HTMLInputElement>(null);
  const [file,setFile]=useState<File|null>(null),[source,setSource]=useState(""),[result,setResult]=useState("");
  const [dims,setDims]=useState({w:0,h:0}),[rotation,setRotation]=useState(0),[flipX,setFlipX]=useState(false),[flipY,setFlipY]=useState(false);
  const [format,setFormat]=useState<Format>("image/png"),[background,setBackground]=useState("#ffffff"),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  useEffect(()=>{if(!file){setSource("");return;}const url=URL.createObjectURL(file);setSource(url);const img=new Image();img.onload=()=>setDims({w:img.naturalWidth,h:img.naturalHeight});img.onerror=()=>setError("Não foi possível abrir a imagem.");img.src=url;return()=>URL.revokeObjectURL(url);},[file]);
  useEffect(()=>()=>{if(result)URL.revokeObjectURL(result);},[result]);
  function invalidate(){setResult(p=>{if(p)URL.revokeObjectURL(p);return "";});setMessage("");}
  function choose(e:ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];e.target.value="";if(!f)return;if(!f.type.startsWith("image/")){setError("Selecciona uma imagem válida.");return;}if(f.size>35*1048576){setError("A imagem ultrapassa 35 MB.");return;}setFile(f);setRotation(0);setFlipX(false);setFlipY(false);invalidate();setError("");}
  function rotate(delta:number){setRotation(v=>(v+delta+360)%360);invalidate();}
  async function exportImage(){
    if(!file||!source||busy)return;setBusy(true);setError("");setMessage("A preparar a transformação…");
    try{
      const img=new Image();img.src=source;await new Promise<void>((res,rej)=>{img.onload=()=>res();img.onerror=()=>rej(new Error("Falha ao descodificar imagem."));});
      const sideways=rotation===90||rotation===270;const canvas=document.createElement("canvas");canvas.width=sideways?dims.h:dims.w;canvas.height=sideways?dims.w:dims.h;
      const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas indisponível.");
      if(format==="image/jpeg"){ctx.fillStyle=background;ctx.fillRect(0,0,canvas.width,canvas.height);}
      ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rotation*Math.PI/180);ctx.scale(flipX?-1:1,flipY?-1:1);ctx.drawImage(img,-dims.w/2,-dims.h/2,dims.w,dims.h);
      const blob=await new Promise<Blob>((res,rej)=>canvas.toBlob(b=>b?res(b):rej(new Error("Não foi possível exportar a imagem.")),format,.94));
      setResult(p=>{if(p)URL.revokeObjectURL(p);return URL.createObjectURL(blob);});setMessage("Imagem transformada com sucesso.");
    }catch(e){setError(e instanceof Error?e.message:"Falha ao transformar a imagem.");}
    finally{setBusy(false);}
  }
  const ext=format==="image/jpeg"?"jpg":format==="image/webp"?"webp":"png";
  return <div className="tool-workspace nx-image-workspace">
    <section className="tool-panel nx-image-main-panel">
      <div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">01 / PRÉ-VISUALIZAÇÃO</span><h2>Orientação da imagem</h2><p>Roda ou espelha a imagem antes de guardar.</p></div><span className="nx-local-indicator"><i/> LOCAL</span></div>
      {!file?<label className="upload-zone nx-upload-zone"><input ref={input} className="file-input-hidden" type="file" accept="image/*" onChange={choose}/><span className="nx-upload-symbol">↻</span><strong>Seleccionar imagem</strong><small>PNG, JPG, WebP · até 35 MB</small><span className="upload-cta">Escolher imagem</span></label>:<>
        <div className="nx-transform-preview"><img src={source} alt="Pré-visualização" style={{transform:"rotate("+rotation+"deg) scale("+(flipX?-1:1)+","+(flipY?-1:1)+")"}}/></div>
        <div className="nx-image-meta"><span>{file.name}</span><b>{rotation%180===0?dims.w+" × "+dims.h:dims.h+" × "+dims.w} px</b><button className="nx-ghost-button" onClick={()=>{setFile(null);invalidate();}}>Trocar imagem</button></div>
        <div className="nx-transform-quick"><button onClick={()=>rotate(-90)} disabled={busy}>↶ Rodar -90°</button><button onClick={()=>rotate(90)} disabled={busy}>↻ Rodar +90°</button><button onClick={()=>{setRotation(0);setFlipX(false);setFlipY(false);invalidate();}} disabled={busy}>Repor</button></div>
      </>}
      {message&&<div className="success-banner"><b>✓</b>{message}</div>}{error&&<div className="error-banner" role="alert">{error}</div>}
      {result&&<><img className="nx-watermark-result" src={result} alt="Imagem transformada"/><a className="download-button nx-download-button" href={result} download={(file?.name.replace(/\.[^.]+$/,"")||"imagem")+"-rodada."+ext}>↓ Descarregar imagem</a></>}
    </section>
    <section className="tool-panel settings-panel nx-image-settings">
      <div><div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">02 / TRANSFORMAÇÃO</span><h2>Ajustes</h2><p>Combina rotação e espelhamento.</p></div></div>
        <div className="settings-group"><span className="settings-label">Rotação</span><div className="nx-angle-options"><button className={rotation===0?"is-active":""} onClick={()=>{setRotation(0);invalidate();}} disabled={!file||busy}><b>0°</b><span>Original</span></button><button className={rotation===90?"is-active":""} onClick={()=>rotate(90)} disabled={!file||busy}><b>↻</b><span>90° direita</span></button><button className={rotation===180?"is-active":""} onClick={()=>{setRotation(180);invalidate();}} disabled={!file||busy}><b>↕</b><span>180°</span></button><button className={rotation===270?"is-active":""} onClick={()=>{setRotation(270);invalidate();}} disabled={!file||busy}><b>↶</b><span>90° esquerda</span></button></div></div>
        <div className="settings-group"><span className="settings-label">Espelhar</span><div className="nx-scope-switch"><button className={flipX?"is-active":""} onClick={()=>{setFlipX(v=>!v);invalidate();}} disabled={!file||busy}>Horizontal ↔</button><button className={flipY?"is-active":""} onClick={()=>{setFlipY(v=>!v);invalidate();}} disabled={!file||busy}>Vertical ↕</button></div></div>
        <div className="settings-group"><label className="field-label">Formato<select value={format} onChange={e=>{setFormat(e.target.value as Format);invalidate();}} disabled={!file||busy}><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option></select></label>{format==="image/jpeg"&&<label className="field-label nx-background-field">Fundo JPG<span><input type="color" value={background} onChange={e=>{setBackground(e.target.value);invalidate();}}/><b>{background.toUpperCase()}</b></span></label>}</div>
      </div><div className="settings-actions"><button className="nx-run-button" disabled={!file||busy} onClick={()=>void exportImage()}><span>{busy?"A transformar imagem…":"Aplicar transformação"}</span><b>{busy?"◌":"↗"}</b></button><p className="settings-footnote">Roda e espelha sem modificar o ficheiro original. Processamento local.</p></div>
    </section>
  </div>;
}
