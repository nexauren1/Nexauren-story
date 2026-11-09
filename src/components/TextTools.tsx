import { useMemo, useState } from "react";

type Operation = "upper" | "lower" | "title" | "sentence" | "trim" | "blank" | "sort" | "unique" | "reverse-lines" | "reverse-text" | "accents" | "slug" | "replace" | "frequency";
type OperationItem = { id: Operation; label: string; description: string; group: string; icon: string };
const operations: OperationItem[] = [
  { id:"upper", label:"MAIÚSCULAS", description:"Converte todo o texto em maiúsculas.", group:"Formato", icon:"Aa" },
  { id:"lower", label:"minúsculas", description:"Converte todo o texto em minúsculas.", group:"Formato", icon:"aa" },
  { id:"title", label:"Formato título", description:"Capitaliza o início de cada palavra.", group:"Formato", icon:"Tt" },
  { id:"sentence", label:"Frases", description:"Capitaliza o início de cada frase.", group:"Formato", icon:"¶" },
  { id:"trim", label:"Limpar espaços", description:"Remove espaços repetidos e extremos.", group:"Limpeza", icon:"⌫" },
  { id:"blank", label:"Linhas vazias", description:"Remove linhas vazias e repetições.", group:"Limpeza", icon:"↕" },
  { id:"accents", label:"Remover acentos", description:"Converte caracteres acentuados para básicos.", group:"Limpeza", icon:"á" },
  { id:"sort", label:"Ordenar linhas", description:"Ordena as linhas alfabeticamente.", group:"Linhas", icon:"A↧" },
  { id:"unique", label:"Linhas únicas", description:"Remove linhas repetidas.", group:"Linhas", icon:"≠" },
  { id:"reverse-lines", label:"Inverter linhas", description:"Inverte a ordem das linhas.", group:"Linhas", icon:"⇅" },
  { id:"slug", label:"Gerar slug", description:"Cria um endereço legível para URLs.", group:"Utilitários", icon:"/" },
  { id:"reverse-text", label:"Inverter texto", description:"Inverte todos os caracteres.", group:"Utilitários", icon:"↶" },
  { id:"replace", label:"Localizar e substituir", description:"Substitui palavras ou expressões.", group:"Utilitários", icon:"⌕" },
  { id:"frequency", label:"Frequência de palavras", description:"Mostra as palavras mais repetidas.", group:"Análise", icon:"▥" }
];
const groups = ["Todas", "Formato", "Limpeza", "Linhas", "Utilitários", "Análise"];
function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function escapeRegExp(value: string) { return value.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/[{}]/g, "\\$&"); }

export default function TextTools() {
  const [source, setSource] = useState("");
  const [output, setOutput] = useState("");
  const [operation, setOperation] = useState<Operation>("trim");
  const [group, setGroup] = useState("Todas");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Pronto para trabalhar.");
  const [error, setError] = useState("");
  const stats = useMemo(() => {
    const words = source.trim() ? source.trim().split(/\s+/u).length : 0;
    return { words, chars: source.length, noSpaces: source.replace(/\s/g, "").length,
      lines: source ? source.split(/\r\n|\r|\n/u).length : 0,
      paragraphs: source.trim() ? source.trim().split(/\n\s*\n/u).length : 0,
      reading: Math.max(0, Math.ceil(words / 200)) };
  }, [source]);
  const visibleOperations = operations.filter((item) => group === "Todas" || item.group === group);
  const chosen = operations.find((item) => item.id === operation);

  async function process() {
    if (!source.trim()) { setError("Escreve ou cola algum texto antes de processar."); return; }
    if (operation === "replace" && !findText) { setError("Escreve o texto que pretendes localizar."); return; }
    setBusy(true); setError(""); setStatus("A preparar a transformação…");
    await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
    try {
      const lines = source.replace(/\r\n?/g, "\n").split("\n");
      let result = source;
      switch (operation) {
        case "upper": result = source.toLocaleUpperCase(); break;
        case "lower": result = source.toLocaleLowerCase(); break;
        case "title": result = source.toLocaleLowerCase().replace(/(^|[\s-])\p{L}/gu, (match) => match.toLocaleUpperCase()); break;
        case "sentence": result = source.toLocaleLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (match) => match.toLocaleUpperCase()); break;
        case "trim": result = lines.map((line) => line.replace(/[ \t]+/g, " ").trim()).join("\n"); break;
        case "blank": result = lines.map((line) => line.trim()).filter(Boolean).join("\n"); break;
        case "sort": result = [...lines].map((line) => line.trim()).filter(Boolean).sort((a,b) => a.localeCompare(b, "pt", { sensitivity:"base" })).join("\n"); break;
        case "unique": {
          const seen = new Set<string>();
          result = lines.filter((line) => { const key = line.trim().toLocaleLowerCase(); if (!key || seen.has(key)) return false; seen.add(key); return true; }).join("\n");
          break;
        }
        case "reverse-lines": result = [...lines].reverse().join("\n"); break;
        case "reverse-text": result = Array.from(source).reverse().join(""); break;
        case "accents": result = source.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); break;
        case "slug": result = slugify(source); break;
        case "replace": result = source.replace(new RegExp(escapeRegExp(findText), caseSensitive ? "gu" : "giu"), replaceText); break;
        case "frequency": {
          const words = source.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
          const counts = new Map<string, number>();
          words.forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1));
          result = ["PALAVRA\tOCORRÊNCIAS", ...[...counts.entries()].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt")).slice(0, 50).map(([word, count]) => word + "\t" + count)].join("\n");
          break;
        }
      }
      setOutput(result); setStatus("Transformação concluída. Resultado pronto.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível transformar o texto."); }
    finally { setBusy(false); }
  }
  async function copyOutput() {
    if (!output) return;
    try { await navigator.clipboard.writeText(output); setStatus("Resultado copiado para a área de transferência."); }
    catch { setError("O navegador não permitiu copiar automaticamente. Seleciona o texto do resultado."); }
  }
  function download() {
    if (!output) return;
    const url = URL.createObjectURL(new Blob([output], { type:"text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "resultado-nexauren.txt"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="nx-text-tool">
      <section className="nx-text-metrics" aria-label="Estatísticas do texto">
        <div><span>Palavras</span><strong>{stats.words.toLocaleString("pt-PT")}</strong></div>
        <div><span>Caracteres</span><strong>{stats.chars.toLocaleString("pt-PT")}</strong></div>
        <div><span>Sem espaços</span><strong>{stats.noSpaces.toLocaleString("pt-PT")}</strong></div>
        <div><span>Linhas / parágrafos</span><strong>{stats.lines} / {stats.paragraphs}</strong></div>
        <div><span>Leitura estimada</span><strong>{stats.reading} min</strong></div>
      </section>
      <div className="nx-text-layout">
        <section className="tool-panel nx-text-editor-panel">
          <div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">01 / ENTRADA</span><h2>O teu texto</h2><p>Escreve ou cola o conteúdo que pretendes trabalhar.</p></div><span className="nx-local-indicator"><i/> LOCAL</span></div>
          <textarea className="nx-textarea" value={source} onChange={(event) => { setSource(event.target.value); setOutput(""); setError(""); setStatus("Texto actualizado."); }} placeholder="Começa a escrever ou cola o teu texto aqui…" spellCheck aria-label="Texto de entrada"/>
          <div className="nx-editor-footer"><span>{stats.chars.toLocaleString("pt-PT")} caracteres</span><div><button type="button" className="nx-ghost-button" onClick={() => { setSource(""); setOutput(""); setError(""); setStatus("Área limpa."); }}>Limpar</button><button type="button" className="nx-ghost-button" disabled={!source} onClick={async () => { try { await navigator.clipboard.writeText(source); setStatus("Texto de entrada copiado."); } catch { setError("Não foi possível copiar neste navegador."); } }}>Copiar entrada</button></div></div>
        </section>
        <section className="tool-panel nx-text-actions-panel">
          <div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">02 / FERRAMENTAS</span><h2>Transformar texto</h2><p>Escolhe uma operação e aplica-a ao teu conteúdo.</p></div></div>
          <div className="nx-operation-groups" aria-label="Filtrar operações">{groups.map((item) => <button type="button" key={item} className={group === item ? "is-active" : ""} onClick={() => setGroup(item)}>{item}</button>)}</div>
          <div className="nx-operation-grid">{visibleOperations.map((item) => <button type="button" key={item.id} className={operation === item.id ? "nx-operation-card is-active" : "nx-operation-card"} onClick={() => setOperation(item.id)}><span>{item.icon}</span><b>{item.label}</b><small>{item.description}</small></button>)}</div>
          {operation === "replace" && <div className="nx-replace-fields"><label>Localizar<input value={findText} onChange={(event) => setFindText(event.target.value)} placeholder="Texto a localizar"/></label><label>Substituir por<input value={replaceText} onChange={(event) => setReplaceText(event.target.value)} placeholder="Novo texto"/></label><label className="nx-check-line"><input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)}/> Distinguir maiúsculas e minúsculas</label></div>}
          <div className="nx-selected-operation"><span>Operação seleccionada</span><strong>{chosen?.label ?? "—"}</strong><small>{chosen?.description}</small></div>
          <button className="nx-run-button" type="button" disabled={busy || !source.trim() || (operation === "replace" && !findText)} onClick={() => void process()}><span>{busy ? "A processar texto…" : "Executar transformação"}</span><b>{busy ? "◌" : "↗"}</b></button>
          <p className="nx-tool-status" aria-live="polite">{busy ? "A processar localmente…" : status}</p>
          {error && <div className="error-banner" role="alert">{error}</div>}
        </section>
        <section className="tool-panel nx-text-result-panel">
          <div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">03 / SAÍDA</span><h2>Resultado</h2><p>{output ? "O resultado está pronto para copiar ou guardar." : "O conteúdo transformado aparece aqui."}</p></div><span className="nx-result-count">{output.length.toLocaleString("pt-PT")} caracteres</span></div>
          <textarea className="nx-textarea nx-output-area" value={output} onChange={(event) => setOutput(event.target.value)} placeholder="O resultado aparecerá aqui…" spellCheck aria-label="Resultado"/>
          <div className="nx-result-actions"><button className="nx-ghost-button" type="button" disabled={!output} onClick={() => void copyOutput()}>Copiar resultado</button><button className="nx-run-button nx-save-button" type="button" disabled={!output} onClick={download}>Guardar TXT <b>↓</b></button></div>
        </section>
      </div>
    </div>
  );
}
