import { useRef, useState, type ChangeEvent } from "react";

type PageInfo={number:number;width:number;height:number;rotation:number};
type Info={pages:PageInfo[];title:string;author:string;subject:string;keywords:string[];creator:string;producer:string;creationDate:string;modificationDate:string};
function sizeLabel(n:number){return n<1048576?(n/1024).toFixed(1)+" KB":(n/1048576).toFixed(2)+" MB";}
function dateLabel(value:Date|undefined){return value&&!Number.isNaN(value.getTime())?value.toLocaleString("pt-PT"):"Não indicado";}
export default function PDFInfo(){
  const input=useRef<HTMLInputElement>(null);
  const [file,setFile]=useState<File|null>(null),[info,setInfo]=useState<Info|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  async function choose(e:ChangeEvent<HTMLInputElement>){
    const next=e.target.files?.[0];e.target.value="";if(!next)return;
    if(next.type!=="application/pdf"&&!next.name.toLowerCase().endsWith(".pdf")){setError("Selecciona um ficheiro PDF válido.");return;}
    if(next.size>60*1048576){setError("O PDF ultrapassa 60 MB.");return;}
    setFile(next);setInfo(null);setError("");setMessage("A analisar estrutura e páginas…");setBusy(true);
    try{
      const {PDFDocument}=await import("pdf-lib");
      const doc=await PDFDocument.load(await next.arrayBuffer(),{updateMetadata:false});
      const pages=doc.getPages().map((page,index)=>{const size=page.getSize();return{number:index+1,width:Math.round(size.width*100)/100,height:Math.round(size.height*100)/100,rotation:page.getRotation().angle};});
      const result:Info={pages,title:doc.getTitle()||"",author:doc.getAuthor()||"",subject:doc.getSubject()||"",keywords:doc.getKeywords()?.split(",").map(s=>s.trim()).filter(Boolean) ?? [],creator:doc.getCreator()||"",producer:doc.getProducer()||"",creationDate:dateLabel(doc.getCreationDate()),modificationDate:dateLabel(doc.getModificationDate())};
      setInfo(result);setMessage("Análise concluída. Foram encontradas "+pages.length+" páginas.");
    }catch(cause){setError(cause instanceof Error?"Não foi possível ler este PDF. "+cause.message:"PDF inválido ou protegido por palavra-passe.");setMessage("");}
    finally{setBusy(false);}
  }
  function report(format:"json"|"csv"){
    if(!file||!info)return;
    const content=format==="json"?JSON.stringify({file:file.name,sizeBytes:file.size,...info},null,2):[
      "pagina,largura_pt,altura_pt,rotacao_graus",
      ...info.pages.map(p=>[p.number,p.width,p.height,p.rotation].join(","))
    ].join("\n");
    const url=URL.createObjectURL(new Blob([content],{type:format==="json"?"application/json":"text/csv;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download=file.name.replace(/\.pdf$/i,"")+"-relatorio."+format;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const first=info?.pages[0],uniqueSizes=info?[...new Set(info.pages.map(p=>Math.round(p.width)+" × "+Math.round(p.height)+" pt"))]:[];
  return <div className="tool-workspace nx-pdf-workspace">
    <section className="tool-panel nx-pdf-main-panel">
      <div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">01 / INSPECÇÃO</span><h2>Informação do documento</h2><p>Consulta os metadados e as propriedades das páginas.</p></div><span className="nx-local-indicator"><i/> LOCAL</span></div>
      <label className="upload-zone nx-upload-zone"><input ref={input} className="file-input-hidden" type="file" accept=".pdf,application/pdf" onChange={choose}/><span className="nx-upload-symbol">PDF</span><strong>{file?file.name:"Seleccionar documento PDF"}</strong><small>{file?sizeLabel(file.size)+" · "+(info?info.pages.length+" páginas":"A analisar…"):"PDF até 60 MB"}</small><span className="upload-cta">Escolher PDF</span></label>
      {busy&&<div className="processing-message"><b>◌</b>A analisar as páginas e os metadados…</div>}
      {error&&<div className="error-banner" role="alert">{error}</div>}
      {message&&!busy&&<div className={info?"success-banner":"processing-message"}><b>{info?"✓":"◌"}</b>{message}</div>}
      {info&&<div className="nx-pdf-report-actions"><button className="nx-ghost-button" onClick={()=>report("json")}>Exportar relatório JSON ↓</button><button className="nx-ghost-button" onClick={()=>report("csv")}>Exportar páginas CSV ↓</button></div>}
    </section>
    <section className="tool-panel settings-panel nx-pdf-settings">
      <div><div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">02 / RESUMO</span><h2>Propriedades PDF</h2><p>Dados detectados no ficheiro carregado.</p></div></div>
        <div className="nx-pdf-summary"><div><span>Total de páginas</span><strong>{info?.pages.length??"—"}</strong></div><div><span>Tamanho do ficheiro</span><strong>{file?sizeLabel(file.size):"—"}</strong></div><div><span>Tamanho da primeira página</span><strong>{first?Math.round(first.width)+" × "+Math.round(first.height):"—"}</strong></div><div><span>Dimensões encontradas</span><strong>{uniqueSizes.length||"—"}</strong></div></div>
        <div className="nx-metadata-list">{[
          ["Título",info?.title],["Autor",info?.author],["Assunto",info?.subject],["Criador",info?.creator],["Produtor",info?.producer],
          ["Criado",info?.creationDate],["Modificado",info?.modificationDate],["Palavras-chave",info?.keywords.join(", ")]
        ].map(([label,value])=><div><span>{label}</span><b>{value||"Não indicado"}</b></div>)}</div>
        {info&&<div className="nx-pdf-page-table"><div className="nx-pdf-table-heading"><b>Páginas</b><span>{info.pages.length} entradas</span></div><div className="nx-pdf-page-list">{info.pages.slice(0,30).map(page=><div><span>Página {page.number}</span><b>{page.width} × {page.height} pt</b><small>{page.rotation}°</small></div>)}</div>{info.pages.length>30&&<small>Mostrando as primeiras 30 páginas. Exporta o CSV para consultar todas.</small>}</div>}
      </div>
      <p className="settings-footnote">A análise é feita localmente. Alguns PDFs não incluem metadados de autor, título ou datas.</p>
    </section>
  </div>;
}
