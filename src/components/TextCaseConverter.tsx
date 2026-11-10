import { useMemo, useState } from "react";

type CaseMode="camel"|"pascal"|"snake"|"kebab"|"constant"|"dot"|"title"|"sentence";
const modes:{id:CaseMode;name:string;example:string}[]=[
{id:"camel",name:"camelCase",example:"minhaVariavelDeTexto"},{id:"pascal",name:"PascalCase",example:"MinhaVariavelDeTexto"},
{id:"snake",name:"snake_case",example:"minha_variavel_de_texto"},{id:"kebab",name:"kebab-case",example:"minha-variavel-de-texto"},
{id:"constant",name:"CONSTANT_CASE",example:"MINHA_VARIAVEL_DE_TEXTO"},{id:"dot",name:"dot.case",example:"minha.variavel.de.texto"},
{id:"title",name:"Formato título",example:"Minha Variável De Texto"},{id:"sentence",name:"Frase",example:"Minha variável de texto"}
];
function wordsOf(value:string){return value.normalize("NFC").match(/[\p{L}\p{N}]+/gu)||[];}
function convert(value:string,mode:CaseMode){
  const words=wordsOf(value).map(w=>w.toLocaleLowerCase());
  if(mode==="camel")return words.map((w,i)=>i===0?w:w.charAt(0).toLocaleUpperCase()+w.slice(1)).join("");
  if(mode==="pascal")return words.map(w=>w.charAt(0).toLocaleUpperCase()+w.slice(1)).join("");
  if(mode==="snake")return words.join("_");
  if(mode==="kebab")return words.join("-");
  if(mode==="constant")return words.join("_").toLocaleUpperCase();
  if(mode==="dot")return words.join(".");
  if(mode==="title")return words.map(w=>w.charAt(0).toLocaleUpperCase()+w.slice(1)).join(" ");
  return words.length?words[0].charAt(0).toLocaleUpperCase()+words[0].slice(1)+" "+words.slice(1).join(" "):"";
}
export default function TextCaseConverter(){
  const [source,setSource]=useState("A minha variável de texto"),[mode,setMode]=useState<CaseMode>("camel"),[busy,setBusy]=useState(false),[result,setResult]=useState("");
  const preview=useMemo(()=>convert(source,mode),[source,mode]);
  async function run(){if(!source.trim())return;setBusy(true);setResult("");await new Promise<void>(r=>window.setTimeout(r,180));setResult(preview);setBusy(false);}
  async function copy(){if(!result)return;try{await navigator.clipboard.writeText(result);}catch{}}
  return <div className="tool-workspace nx-text-converter">
    <section className="tool-panel"><div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">01 / TEXTO DE ENTRADA</span><h2>Escreve o conteúdo</h2><p>Insere uma frase, nome de variável ou expressão.</p></div><span className="nx-local-indicator"><i/> LOCAL</span></div>
      <textarea className="nx-textarea" value={source} onChange={e=>{setSource(e.target.value);setResult("");}} placeholder="Escreve o texto a converter…"/>
      <div className="nx-case-grid">{modes.map(m=><button type="button" className={mode===m.id?"is-active":""} onClick={()=>{setMode(m.id);setResult("");}}><b>{m.name}</b><small>{m.example}</small></button>)}</div>
    </section>
    <section className="tool-panel"><div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">02 / RESULTADO</span><h2>Pré-visualização</h2><p>O resultado actualiza-se à medida que escreves.</p></div></div>
      <div className="nx-case-output"><span>{modes.find(m=>m.id===mode)?.name}</span><strong>{preview||"—"}</strong></div>
      <button className="nx-run-button" disabled={!source.trim()||busy} onClick={()=>void run()}><span>{busy?"A converter…":"Gerar conversão"}</span><b>{busy?"◌":"↗"}</b></button>
      {result&&<div className="nx-result-actions"><button className="nx-ghost-button" onClick={()=>void copy()}>Copiar resultado</button><button className="nx-ghost-button" onClick={()=>{const url=URL.createObjectURL(new Blob([result],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="texto-convertido.txt";a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Guardar TXT ↓</button></div>}
      <p className="settings-footnote">A conversão utiliza caracteres Unicode e é executada localmente.</p>
    </section>
  </div>;
}
