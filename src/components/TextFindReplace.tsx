import { useMemo, useState } from "react";
function escapeRegExp(value:string){return value.replace(/[.*+?^$()|[\]\\]/g,"\\$&").replace(/[{}]/g,"\\$&");}
export default function TextFindReplace(){
  const [source,setSource]=useState("A Nexauren reúne ferramentas digitais. As ferramentas Nexauren são práticas.");
  const [find,setFind]=useState("Nexauren"),[replacement,setReplacement]=useState("Nexauren Studio");
  const [caseSensitive,setCaseSensitive]=useState(false),[wholeWord,setWholeWord]=useState(false),[replaceFirst,setReplaceFirst]=useState(false);
  const [result,setResult]=useState(""),[busy,setBusy]=useState(false),[status,setStatus]=useState("Define o texto que pretendes encontrar.");
  const count=useMemo(()=>{if(!find)return 0;try{const pattern=wholeWord?"(?<![\\p{L}\\p{N}_])"+escapeRegExp(find)+"(?![\\p{L}\\p{N}_])":escapeRegExp(find);return [...source.matchAll(new RegExp(pattern,caseSensitive?"gu":"giu"))].length;}catch{return 0;}},[source,find,caseSensitive,wholeWord]);
  async function run(){if(!find){setStatus("Escreve primeiro o texto a localizar.");return;}setBusy(true);setStatus("A aplicar substituições…");await new Promise<void>(r=>window.setTimeout(r,160));try{const p=wholeWord?"(?<![\\p{L}\\p{N}_])"+escapeRegExp(find)+"(?![\\p{L}\\p{N}_])":escapeRegExp(find);const re=new RegExp(p,caseSensitive?"u":"iu");const all=new RegExp(p,caseSensitive?"gu":"giu");setResult(replacement?replaceFirst?source.replace(re,replacement):source.replace(all,replacement):replaceFirst?source.replace(re,""):source.replace(all,""));setStatus((replaceFirst?Math.min(1,count):count)+" substituição(ões) preparada(s).");}catch{setStatus("Não foi possível concluir a substituição. Verifica o texto.");}finally{setBusy(false);}}
  async function copy(){try{await navigator.clipboard.writeText(result);setStatus("Resultado copiado.");}catch{setStatus("Não foi possível copiar neste navegador.");}}
  return <div className="tool-workspace nx-text-converter">
    <section className="tool-panel"><div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">01 / PESQUISA</span><h2>Localizar texto</h2><p>Escreve o conteúdo e define o que queres substituir.</p></div><span className="nx-local-indicator"><i/> LOCAL</span></div>
      <textarea className="nx-textarea" value={source} onChange={e=>{setSource(e.target.value);setResult("");}} placeholder="Cola ou escreve o texto…"/>
      <div className="nx-find-fields"><label>Localizar<input value={find} onChange={e=>{setFind(e.target.value);setResult("");}} placeholder="Texto a localizar"/></label><label>Substituir por<input value={replacement} onChange={e=>setReplacement(e.target.value)} placeholder="Novo texto (vazio remove)"/></label></div>
      <div className="nx-find-options"><label><input type="checkbox" checked={caseSensitive} onChange={e=>setCaseSensitive(e.target.checked)}/> Distinguir maiúsculas/minúsculas</label><label><input type="checkbox" checked={wholeWord} onChange={e=>setWholeWord(e.target.checked)}/> Apenas palavras completas</label><label><input type="checkbox" checked={replaceFirst} onChange={e=>setReplaceFirst(e.target.checked)}/> Substituir apenas a primeira ocorrência</label></div>
      <div className="nx-find-count"><span>Ocorrências encontradas</span><b>{count}</b></div>
      <button className="nx-run-button" disabled={!find||!count||busy} onClick={()=>void run()}><span>{busy?"A substituir…":"Aplicar substituição"}</span><b>{busy?"◌":"↗"}</b></button><p className="nx-tool-status" aria-live="polite">{status}</p>
    </section>
    <section className="tool-panel"><div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">02 / RESULTADO</span><h2>Texto actualizado</h2><p>Confirma o resultado antes de copiar ou guardar.</p></div></div>
      <textarea className="nx-textarea nx-output-area" value={result} onChange={e=>setResult(e.target.value)} placeholder="O resultado da substituição aparece aqui…"/>
      <div className="nx-result-actions"><button className="nx-ghost-button" disabled={!result} onClick={()=>void copy()}>Copiar resultado</button><button className="nx-ghost-button" disabled={!result} onClick={()=>{const url=URL.createObjectURL(new Blob([result],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="texto-substituido.txt";a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Guardar TXT ↓</button></div>
    </section>
  </div>;
}
