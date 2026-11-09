import { useMemo, useState } from "react";

type Operation = "upper" | "lower" | "title" | "trim" | "lines" | "unique" | "reverse";
const operations: { id: Operation; label: string; description: string }[] = [
  { id: "upper", label: "MAIÚSCULAS", description: "Converte todo o texto para maiúsculas." },
  { id: "lower", label: "minúsculas", description: "Converte todo o texto para minúsculas." },
  { id: "title", label: "Formato título", description: "Coloca a primeira letra de cada palavra em maiúscula." },
  { id: "trim", label: "Limpar espaços", description: "Remove espaços repetidos e linhas vazias." },
  { id: "lines", label: "Ordenar linhas", description: "Ordena as linhas alfabeticamente." },
  { id: "unique", label: "Remover duplicadas", description: "Mantém apenas linhas únicas." },
  { id: "reverse", label: "Inverter linhas", description: "Inverte a ordem das linhas." },
];

export default function TextTools() {
  const [source, setSource] = useState("");
  const [output, setOutput] = useState("");
  const [operation, setOperation] = useState<Operation>("trim");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Pronto para trabalhar.");
  const [error, setError] = useState("");
  const stats = useMemo(() => {
    const words = source.trim() ? source.trim().split(/\s+/u).length : 0;
    return { words, chars: source.length, noSpaces: source.replace(/\s/g, "").length, lines: source ? source.split(/\r?\n/u).length : 0 };
  }, [source]);

  async function process() {
    if (!source.trim()) { setError("Escreve ou cola algum texto antes de processar."); return; }
    setBusy(true); setError(""); setStatus("A aplicar a transformação…");
    await new Promise<void>((resolve) => window.setTimeout(resolve, 220));
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    let result = source;
    switch (operation) {
      case "upper": result = source.toLocaleUpperCase(); break;
      case "lower": result = source.toLocaleLowerCase(); break;
      case "title": result = source.toLocaleLowerCase().replace(/(^|\s)\p{L}/gu, (match) => match.toLocaleUpperCase()); break;
      case "trim": result = lines.map((line) => line.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n"); break;
      case "lines": result = [...lines].map((line) => line.trim()).filter(Boolean).sort((a,b) => a.localeCompare(b, "pt")).join("\n"); break;
      case "unique": result = [...new Set(lines.map((line) => line.trim()).filter(Boolean))].join("\n"); break;
      case "reverse": result = [...lines].reverse().join("\n"); break;
    }
    setOutput(result); setStatus("Transformação concluída."); setBusy(false);
  }

  async function copyOutput() {
    if (!output) return;
    try { await navigator.clipboard.writeText(output); setStatus("Resultado copiado."); }
    catch { setError("O navegador não permitiu copiar automaticamente. Seleciona o texto do resultado."); }
  }

  function download() {
    if (!output) return;
    const url = URL.createObjectURL(new Blob([output], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "texto-nexauren.txt"; link.click();
    URL.revokeObjectURL(url);
  }

  return <div className="text-toolbox">
    <section className="tool-panel text-input-panel">
      <div className="panel-topline"><div><h2>Texto de entrada</h2><p>Cola, escreve ou edita o conteúdo a transformar.</p></div><span className="text-live-badge">● LOCAL</span></div>
      <textarea className="text-editor" value={source} onChange={(e) => { setSource(e.target.value); setOutput(""); setError(""); setStatus("Texto atualizado."); }} placeholder="Escreve ou cola o teu texto aqui…" spellCheck/>
      <div className="text-stats"><span><b>{stats.words}</b> palavras</span><span><b>{stats.chars}</b> caracteres</span><span><b>{stats.noSpaces}</b> sem espaços</span><span><b>{stats.lines}</b> linhas</span></div>
      <button className="secondary-button" type="button" onClick={() => { setSource(""); setOutput(""); setError(""); setStatus("Área limpa."); }}>Limpar texto</button>
    </section>
    <section className="tool-panel text-operations-panel">
      <h2>Escolhe uma operação</h2>
      <div className="text-operation-grid">{operations.map((item) => <button type="button" key={item.id} className={operation === item.id ? "text-operation is-active" : "text-operation"} onClick={() => setOperation(item.id)}><b>{item.label}</b><small>{item.description}</small></button>)}</div>
      <button className="primary-button" type="button" disabled={busy || !source.trim()} onClick={process}>{busy ? "A processar texto…" : "Executar transformação"} <span>↗</span></button>
      <p className="status-note" aria-live="polite">{status}</p>
      {error && <div className="error-banner" role="alert">{error}</div>}
    </section>
    <section className="tool-panel text-output-panel">
      <div className="panel-topline"><div><h2>Resultado</h2><p>{output ? "O resultado está pronto para copiar ou guardar." : "O texto transformado aparece aqui."}</p></div><span className="text-output-count">{output.length} caracteres</span></div>
      <textarea className="text-editor text-output-editor" value={output} onChange={(e) => setOutput(e.target.value)} placeholder="O teu resultado aparecerá aqui…" spellCheck/>
      <div className="text-result-actions"><button type="button" className="secondary-button" disabled={!output} onClick={copyOutput}>Copiar resultado</button><button type="button" className="primary-button" disabled={!output} onClick={download}>Guardar .TXT</button></div>
    </section>
  </div>;
}
