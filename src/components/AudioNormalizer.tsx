import { useEffect, useRef, useState, type ChangeEvent } from "react";

function makeWav(data: AudioBuffer, gain: number, mono: boolean) {
  const channels = mono ? 1 : data.numberOfChannels;
  const frames = data.length, rate = data.sampleRate, bytes = frames * channels * 2;
  const buffer = new ArrayBuffer(44 + bytes), view = new DataView(buffer);
  const write = (offset:number,value:string)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
  write(0,"RIFF");view.setUint32(4,36+bytes,true);write(8,"WAVE");write(12,"fmt ");view.setUint32(16,16,true);
  view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,rate,true);view.setUint32(28,rate*channels*2,true);
  view.setUint16(32,channels*2,true);view.setUint16(34,16,true);write(36,"data");view.setUint32(40,bytes,true);
  const source=Array.from({length:data.numberOfChannels},(_,index)=>data.getChannelData(index));
  let offset=44;
  for(let frame=0;frame<frames;frame++){
    if(mono){
      let sum=0;for(let channel=0;channel<source.length;channel++)sum+=source[channel][frame];
      const sample=Math.max(-1,Math.min(1,(sum/source.length)*gain));
      view.setInt16(offset,sample<0?sample*32768:sample*32767,true);offset+=2;
    }else{
      for(let channel=0;channel<channels;channel++){
        const sample=Math.max(-1,Math.min(1,source[channel][frame]*gain));
        view.setInt16(offset,sample<0?sample*32768:sample*32767,true);offset+=2;
      }
    }
  }
  return new Blob([buffer],{type:"audio/wav"});
}
function sizeLabel(bytes:number){return bytes<1048576?(bytes/1024).toFixed(1)+" KB":(bytes/1048576).toFixed(2)+" MB";}

export default function AudioNormalizer(){
  const input=useRef<HTMLInputElement>(null);
  const [file,setFile]=useState<File|null>(null),[buffer,setBuffer]=useState<AudioBuffer|null>(null);
  const [peak,setPeak]=useState(0),[target,setTarget]=useState(-1),[maxBoost,setMaxBoost]=useState(12);
  const [onlyReduce,setOnlyReduce]=useState(false),[mono,setMono]=useState(false);
  const [busy,setBusy]=useState(false),[progress,setProgress]=useState(0);
  const [url,setUrl]=useState(""),[resultSize,setResultSize]=useState(0);
  const [error,setError]=useState(""),[message,setMessage]=useState("");
  const [analysis,setAnalysis]=useState(false);
  useEffect(()=>()=>{if(url)URL.revokeObjectURL(url);},[url]);

  async function choose(next?:File){
    if(!next)return;
    if(!next.type.startsWith("audio/")&&!/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(next.name)){setError("Selecciona um ficheiro de áudio válido.");return;}
    if(next.size>55*1048576){setError("O áudio ultrapassa 55 MB.");return;}
    setFile(next);setBuffer(null);setUrl("");setResultSize(0);setPeak(0);setError("");setMessage("");setProgress(0);setAnalysis(true);
    let context:AudioContext|undefined;
    try{
      context=new AudioContext();
      const decoded=await context.decodeAudioData(await next.arrayBuffer());
      await new Promise<void>((resolve)=>requestAnimationFrame(()=>resolve()));
      let max=0;
      for(let channelIndex=0;channelIndex<decoded.numberOfChannels;channelIndex++){
        const channel=decoded.getChannelData(channelIndex);
        for(let index=0;index<channel.length;index++)if(Math.abs(channel[index])>max)max=Math.abs(channel[index]);
      }
      setBuffer(decoded);setPeak(max);setMessage("Análise concluída. Pico máximo encontrado em todos os canais.");
    }catch(cause){setError(cause instanceof Error?"Não foi possível descodificar este áudio. "+cause.message:"Formato de áudio não suportado.");}
    finally{if(context)await context.close().catch(()=>{});setAnalysis(false);}
  }
  function change(event:ChangeEvent<HTMLInputElement>){void choose(event.target.files?.[0]);event.target.value="";}
  function invalidate(){setUrl((previous)=>{if(previous)URL.revokeObjectURL(previous);return "";});setResultSize(0);setProgress(0);}
  const targetLinear=Math.pow(10,target/20);
  const maxLinear=Math.pow(10,maxBoost/20);
  const suggestedGain=peak>0?Math.min(targetLinear/peak,onlyReduce?1:maxLinear):1;
  const actualGainDb=20*Math.log10(Math.max(suggestedGain,.000001));
  const outputPeak=peak*suggestedGain;

  async function normalize(){
    if(!buffer||!file||busy)return;
    setBusy(true);setProgress(8);setError("");setMessage("A preparar a normalização…");
    try{
      await new Promise<void>((resolve)=>requestAnimationFrame(()=>resolve()));
      setProgress(22);
      const blob=makeWav(buffer,suggestedGain,mono);
      setProgress(86);
      const objectUrl=URL.createObjectURL(blob);
      setUrl((previous)=>{if(previous)URL.revokeObjectURL(previous);return objectUrl;});
      setResultSize(blob.size);setProgress(100);
      setMessage("Áudio exportado. O nível foi ajustado sem ultrapassar o limite de pico definido.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Falha ao normalizar o áudio.");setProgress(0);setMessage("");}
    finally{setBusy(false);}
  }

  return (
    <div className="tool-workspace nx-audio-workspace">
      <section className="tool-panel nx-audio-main-panel">
        <div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">01 / ANÁLISE</span><h2>Áudio de entrada</h2><p>O pico é medido em todos os canais antes de aplicar o ganho.</p></div><span className="nx-local-indicator"><i/> LOCAL</span></div>
        <label className="upload-zone nx-upload-zone nx-audio-upload">
          <input ref={input} className="file-input-hidden" type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" onChange={change}/>
          <span className="nx-upload-symbol">♫</span><strong>{file?file.name:"Seleccionar áudio"}</strong>
          <small>{file?(buffer?Math.round(buffer.duration)+" segundos · "+buffer.numberOfChannels+" canais":"A analisar…"):"MP3, WAV, M4A, AAC, OGG, FLAC · até 55 MB"}</small>
          <span className="upload-cta">Escolher ficheiro</span>
        </label>
        {file&&buffer&&<div className="nx-audio-file-line"><span className="nx-audio-file-symbol">♫</span><span><b>{file.name}</b><small>{sizeLabel(file.size)} · {buffer.sampleRate.toLocaleString("pt-PT")} Hz · {buffer.numberOfChannels===1?"Mono":"Estéreo"}</small></span><button className="nx-ghost-button" type="button" onClick={()=>{setFile(null);setBuffer(null);invalidate();setPeak(0);}}>Remover</button></div>}
        <div className="nx-normalizer-meter">
          <div className="nx-meter-heading"><span>Pico original</span><b>{peak>0?(20*Math.log10(peak)).toFixed(2)+" dBFS":"—"}</b></div>
          <div className="nx-meter-track"><i style={{width:Math.min(100,peak*100)+"%"}}/></div>
          <div className="nx-meter-scale"><span>-∞</span><span>-12 dB</span><span>-6 dB</span><span>0 dBFS</span></div>
          <p>{analysis?"A analisar os canais e os níveis de amostra…":peak>0?"Pico máximo analisado sem saltar amostras.":"Carrega um ficheiro para analisar o nível."}</p>
        </div>
        {message&&<div className={progress===100?"success-banner":"processing-message"}><b>{progress===100?"✓":"◌"}</b>{message}</div>}
        {error&&<div className="error-banner" role="alert">{error}</div>}
        {url&&<div className="nx-audio-result"><div><b>Pré-visualizar áudio normalizado</b><small>{sizeLabel(resultSize)} · WAV PCM 16-bit</small></div><audio controls src={url}/><a className="download-button nx-download-button" href={url} download={(file?.name.replace(/\.[^.]+$/,"")||"audio")+"-normalizado.wav"}>↓ Descarregar WAV</a></div>}
      </section>
      <section className="tool-panel settings-panel nx-audio-settings">
        <div>
          <div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">02 / NORMALIZAÇÃO</span><h2>Definir nível de saída</h2><p>Ajusta o pico de destino e o limite máximo de amplificação.</p></div></div>
          <div className="settings-group">
            <label className="field-label">Pico de saída<select value={target} disabled={!buffer||busy} onChange={(event)=>{setTarget(Number(event.target.value));invalidate();}}><option value={-1}>-1 dBFS · recomendado</option><option value={-2}>-2 dBFS</option><option value={-3}>-3 dBFS</option><option value={-6}>-6 dBFS</option><option value={-9}>-9 dBFS</option><option value={-12}>-12 dBFS</option></select></label>
            <p className="range-help">O pico de destino deixa margem abaixo do limite digital de 0 dBFS.</p>
          </div>
          <div className="settings-group">
            <label className="field-label">Amplificação máxima<select value={maxBoost} disabled={!buffer||busy||onlyReduce} onChange={(event)=>{setMaxBoost(Number(event.target.value));invalidate();}}><option value={0}>0 dB · sem amplificação</option><option value={6}>+6 dB</option><option value={12}>+12 dB</option><option value={18}>+18 dB</option></select></label>
            <label className="nx-check-line"><input type="checkbox" checked={onlyReduce} disabled={!buffer||busy} onChange={(event)=>{setOnlyReduce(event.target.checked);invalidate();}}/> Só reduzir volume, nunca amplificar</label>
          </div>
          <div className="settings-group">
            <span className="settings-label">Canais de saída</span>
            <div className="nx-scope-switch"><button className={!mono?"is-active":""} disabled={!buffer||busy} onClick={()=>{setMono(false);invalidate();}}>Manter canais</button><button className={mono?"is-active":""} disabled={!buffer||busy} onClick={()=>{setMono(true);invalidate();}}>Converter para mono</button></div>
            <p className="range-help">A conversão mono mistura os canais num só canal.</p>
          </div>
          <div className="nx-audio-summary">
            <div><span>Ganho calculado</span><strong>{peak>0?(actualGainDb>0?"+":"")+actualGainDb.toFixed(2)+" dB":"—"}</strong></div>
            <div><span>Pico estimado após ganho</span><strong>{peak>0?(20*Math.log10(Math.max(outputPeak,.000001))).toFixed(2)+" dBFS":"—"}</strong></div>
          </div>
          <div className="nx-progress-card"><div className="progress-heading"><span>Processamento</span><b>{progress}%</b></div><div className="progress-track"><div className="progress-fill" style={{width:progress+"%"}}/></div><p>{busy?"A processar as amostras de áudio…":progress===100?"Exportação concluída.":"O original não é alterado."}</p></div>
          <div className="tool-help-note"><strong>Nota:</strong> normalizar o pico não é o mesmo que compressão dinâmica ou nivelamento de loudness (LUFS). O áudio pode continuar a ter diferenças de volume entre partes.</div>
        </div>
        <div className="settings-actions"><button className="nx-run-button" disabled={!buffer||busy||analysis} onClick={()=>void normalize()}><span>{busy?"A normalizar áudio…":"Normalizar e exportar WAV"}</span><b>{busy?"◌":"↗"}</b></button><p className="settings-footnote">O processamento é local. O áudio original não é enviado para um servidor.</p></div>
      </section>
    </div>
  );
}
