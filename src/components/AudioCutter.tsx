import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";

function timeLabel(seconds: number) {
  if (!Number.isFinite(seconds)) return "00:00";
  const minutes = Math.floor(seconds / 60), remaining = Math.floor(seconds % 60);
  return String(minutes).padStart(2,"0") + ":" + String(remaining).padStart(2,"0");
}
function sizeLabel(bytes: number) { return bytes < 1048576 ? (bytes/1024).toFixed(1)+" KB" : (bytes/1048576).toFixed(2)+" MB"; }
function encodeWav(buffer: AudioBuffer, start: number, end: number, gain: number, fadeIn: number, fadeOut: number): Blob {
  const channels=buffer.numberOfChannels, rate=buffer.sampleRate;
  const from=Math.max(0,Math.floor(start*rate)), to=Math.min(buffer.length,Math.floor(end*rate));
  const frames=Math.max(1,to-from), bytes=frames*channels*2;
  const output=new ArrayBuffer(44+bytes), view=new DataView(output);
  const write=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
  write(0,"RIFF");view.setUint32(4,36+bytes,true);write(8,"WAVE");write(12,"fmt ");view.setUint32(16,16,true);
  view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,rate,true);view.setUint32(28,rate*channels*2,true);
  view.setUint16(32,channels*2,true);view.setUint16(34,16,true);write(36,"data");view.setUint32(40,bytes,true);
  const data=Array.from({length:channels},(_,channel)=>buffer.getChannelData(channel));
  const fadeInFrames=Math.min(frames,Math.floor(fadeIn*rate)),fadeOutFrames=Math.min(frames,Math.floor(fadeOut*rate));
  let offset=44;
  for(let frame=0;frame<frames;frame++){
    let envelope=1;
    if(fadeInFrames>0)envelope=Math.min(envelope,frame/fadeInFrames);
    if(fadeOutFrames>0)envelope=Math.min(envelope,(frames-1-frame)/fadeOutFrames);
    for(let channel=0;channel<channels;channel++){
      const sample=Math.max(-1,Math.min(1,data[channel][from+frame]*gain*envelope));
      view.setInt16(offset,sample<0?sample*32768:sample*32767,true);offset+=2;
    }
  }
  return new Blob([output],{type:"audio/wav"});
}

export default function AudioCutter() {
  const inputRef=useRef<HTMLInputElement>(null), audioRef=useRef<HTMLAudioElement>(null);
  const [file,setFile]=useState<File|null>(null),[audioUrl,setAudioUrl]=useState("");
  const [buffer,setBuffer]=useState<AudioBuffer|null>(null),[duration,setDuration]=useState(0),[peak,setPeak]=useState(0);
  const [start,setStart]=useState(0),[end,setEnd]=useState(0),[peaks,setPeaks]=useState<number[]>([]);
  const [playing,setPlaying]=useState(false),[resultUrl,setResultUrl]=useState(""),[resultSize,setResultSize]=useState(0);
  const [fadeIn,setFadeIn]=useState(0),[fadeOut,setFadeOut]=useState(0),[gain,setGain]=useState(1);
  const [busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState(""),[notice,setNotice]=useState("");

  useEffect(()=>{
    if(!file){setAudioUrl("");setBuffer(null);return;}
    const url=URL.createObjectURL(file);setAudioUrl(url);setBuffer(null);setDuration(0);
    setResultUrl((previous)=>{if(previous)URL.revokeObjectURL(previous);return "";});
    setResultSize(0);setError("");setNotice("");setProgress(0);setPeaks([]);setPlaying(false);setPeak(0);
    let active=true;
    async function decode(){
      let context:AudioContext|undefined;
      try{
        context=new AudioContext();
        const decoded=await context.decodeAudioData(await file!.arrayBuffer());
        if(!active)return;
        setBuffer(decoded);setDuration(decoded.duration);setStart(0);setEnd(decoded.duration);
        const values:number[]=[],channel=decoded.getChannelData(0),bucket=Math.max(1,Math.floor(channel.length/180));
        for(let i=0;i<180;i++){const from=i*bucket;let peak=0;for(let j=from;j<Math.min(channel.length,from+bucket);j+=4)peak=Math.max(peak,Math.abs(channel[j]));values.push(Math.max(.04,peak));}
        setPeaks(values);
        let exactPeak=0;for(let sampleIndex=0;sampleIndex<channel.length;sampleIndex++)exactPeak=Math.max(exactPeak,Math.abs(channel[sampleIndex]));setPeak(exactPeak);
      }catch{if(active)setError("Não foi possível descodificar este áudio. Experimenta um ficheiro MP3 ou WAV compatível.");}
      finally{if(context)await context.close().catch(()=>{});}
    }
    void decode();
    return()=>{active=false;URL.revokeObjectURL(url);};
  },[file]);
  useEffect(()=>()=>{if(resultUrl)URL.revokeObjectURL(resultUrl);},[resultUrl]);

  const selectedDuration=Math.max(0,end-start);
  const selectedSize=useMemo(()=>buffer?Math.round(buffer.sampleRate*selectedDuration*buffer.numberOfChannels*2+44):0,[buffer,selectedDuration]);
  const safeGain=peak>0?Math.min(gain,.98/peak):gain;
  function invalidate(){setResultUrl((previous)=>{if(previous)URL.revokeObjectURL(previous);return "";});setResultSize(0);setProgress(0);setNotice("");}
  function selectFile(next?:File){
    if(!next)return;
    if(!next.type.startsWith("audio/")&&!/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(next.name)){setError("Selecciona um ficheiro de áudio válido.");return;}
    if(next.size>55*1048576){setError("O ficheiro ultrapassa o limite de 55 MB.");return;}
    setFile(next);
  }
  function onChange(event:ChangeEvent<HTMLInputElement>){selectFile(event.target.files?.[0]);event.target.value="";}
  function onDrop(event:DragEvent<HTMLLabelElement>){event.preventDefault();event.currentTarget.classList.remove("is-dragging");selectFile(event.dataTransfer.files?.[0]);}
  function updateStart(value:number){setStart(Math.max(0,Math.min(value,Math.max(0,end-.05))));invalidate();}
  function updateEnd(value:number){setEnd(Math.min(duration,Math.max(value,start+.05)));invalidate();}
  function resetSelection(){setStart(0);setEnd(duration);invalidate();}
  async function playSelection(){
    const player=audioRef.current;if(!player||!audioUrl)return;
    if(playing){player.pause();setPlaying(false);return;}
    player.currentTime=start;
    try{await player.play();setPlaying(true);}catch{setError("Não foi possível reproduzir o áudio neste navegador.");}
  }
  async function cutAudio(){
    if(!buffer||!file||selectedDuration<.05||busy)return;
    if(fadeIn+fadeOut>selectedDuration){setError("A soma dos fades não pode ultrapassar a duração seleccionada.");return;}
    setBusy(true);setProgress(8);setError("");setNotice("");
    try{
      await new Promise<void>((resolve)=>requestAnimationFrame(()=>resolve()));
      setProgress(25);
      const blob=encodeWav(buffer,start,end,safeGain,fadeIn,fadeOut);
      setProgress(86);
      const url=URL.createObjectURL(blob);
      setResultUrl((previous)=>{if(previous)URL.revokeObjectURL(previous);return url;});
      setResultSize(blob.size);setProgress(100);
      setNotice("Trecho exportado em WAV PCM 16-bit, com os fades e o volume seleccionados.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível cortar o áudio.");setProgress(0);}
    finally{setBusy(false);}
  }

  return (
    <div className="tool-workspace nx-audio-workspace">
      <section className="tool-panel nx-audio-main-panel">
        <div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">01 / ÁUDIO</span><h2>{file?"Editar trecho":"Adicionar áudio"}</h2><p>Escolhe um intervalo e ouve exactamente a parte que será exportada.</p></div><span className="nx-local-indicator"><i/> LOCAL</span></div>
        {!file?<label className="upload-zone nx-upload-zone nx-audio-upload" onDragOver={(event)=>{event.preventDefault();event.currentTarget.classList.add("is-dragging");}} onDragLeave={(event)=>event.currentTarget.classList.remove("is-dragging")} onDrop={onDrop}>
          <input ref={inputRef} className="file-input-hidden" type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" onChange={onChange}/>
          <span className="nx-upload-symbol">♫</span><strong>Adicionar ficheiro de áudio</strong><small>Arrasta e solta ou escolhe no dispositivo · MP3, WAV, M4A, AAC, OGG · até 55 MB</small><span className="upload-cta">Seleccionar áudio</span>
        </label>:<>
          <div className="nx-audio-file-line"><span className="nx-audio-file-symbol">♫</span><span><b>{file.name}</b><small>{sizeLabel(file.size)} · {timeLabel(duration)} · {buffer?buffer.numberOfChannels+" canais":"A descodificar…"}</small></span><button className="nx-ghost-button" onClick={()=>{setFile(null);setPeak(0);invalidate();setError("");}}>Trocar áudio</button></div>
          <div className="nx-wave-container">
            <div className="nx-waveform">{peaks.map((peak,index)=><i key={index} style={{height:Math.round(peak*100)+"%"}}/>)}
              <div className="nx-wave-selection" style={{left:(duration?start/duration*100:0)+"%",width:(duration?selectedDuration/duration*100:100)+"%"}}/>
            </div>
            <div className="nx-wave-times"><span>00:00</span><b>Início {timeLabel(start)}</b><b>Fim {timeLabel(end)}</b><span>{timeLabel(duration)}</span></div>
          </div>
          <div className="nx-audio-range-row"><label>Início <input type="range" min="0" max={Math.max(duration,.05)} step=".05" value={start} onChange={(event)=>updateStart(Number(event.target.value))}/><b>{timeLabel(start)}</b></label>
            <label>Fim <input type="range" min="0" max={Math.max(duration,.05)} step=".05" value={end} onChange={(event)=>updateEnd(Number(event.target.value))}/><b>{timeLabel(end)}</b></label></div>
          <div className="nx-audio-transport"><button type="button" className="nx-audio-play" onClick={()=>void playSelection()}>{playing?"Ⅱ":"▶"}</button><span><b>{timeLabel(start)}</b><small> / {timeLabel(end)}</small></span><button type="button" className="nx-ghost-button" onClick={resetSelection}>Repor selecção</button><audio ref={audioRef} src={audioUrl} className="nx-audio-native" controls onEnded={()=>setPlaying(false)} onTimeUpdate={(event)=>{if(event.currentTarget.currentTime>=end){event.currentTarget.pause();setPlaying(false);}}}/></div>
        </>}
        {notice&&<div className="success-banner"><b>✓</b>{notice}</div>}
        {error&&<div className="error-banner" role="alert">{error}</div>}
        {resultUrl&&<div className="nx-audio-result"><div><b>Pré-visualizar resultado</b><small>{sizeLabel(resultSize)} · WAV PCM 16-bit</small></div><audio controls src={resultUrl}/><a href={resultUrl} className="download-button nx-download-button" download={(file?.name.replace(/\.[^.]+$/,"")||"audio")+"-cortado.wav"}>↓ Descarregar WAV</a></div>}
      </section>
      <section className="tool-panel settings-panel nx-audio-settings">
        <div>
          <div className="nx-tool-panel-heading"><div><span className="nx-panel-kicker">02 / AJUSTES</span><h2>Som e transições</h2><p>Personaliza a entrada e saída do excerto.</p></div></div>
          <div className="nx-audio-summary">
            <div><span>Duração seleccionada</span><strong>{timeLabel(selectedDuration)}</strong></div>
            <div><span>Tamanho WAV estimado</span><strong>{sizeLabel(selectedSize)}</strong></div>
          </div>
          <div className="settings-group"><label className="field-label">Fade in · entrada gradual<select value={fadeIn} disabled={!buffer||busy} onChange={(event)=>{setFadeIn(Number(event.target.value));invalidate();}}><option value={0}>Sem fade</option><option value={0.25}>0,25 segundos</option><option value={0.5}>0,5 segundos</option><option value={1}>1 segundo</option><option value={2}>2 segundos</option><option value={3}>3 segundos</option><option value={5}>5 segundos</option></select></label><p className="range-help">Aumenta o volume suavemente no início do trecho.</p></div>
          <div className="settings-group"><label className="field-label">Fade out · saída gradual<select value={fadeOut} disabled={!buffer||busy} onChange={(event)=>{setFadeOut(Number(event.target.value));invalidate();}}><option value={0}>Sem fade</option><option value={0.25}>0,25 segundos</option><option value={0.5}>0,5 segundos</option><option value={1}>1 segundo</option><option value={2}>2 segundos</option><option value={3}>3 segundos</option><option value={5}>5 segundos</option></select></label><p className="range-help">Reduz o volume suavemente no final do trecho.</p></div>
          <div className="settings-group"><label className="field-label">Volume de saída<select value={gain} disabled={!buffer||busy} onChange={(event)=>{setGain(Number(event.target.value));invalidate();}}><option value={0.5}>50% · mais baixo</option><option value={0.75}>75%</option><option value={1}>100% · original</option><option value={1.25}>125%</option><option value={1.5}>150% · mais alto</option></select></label><p className="range-help">Ganho aplicado: {(20*Math.log10(Math.max(safeGain,.000001))).toFixed(1)} dB. O pico é limitado a -0,18 dBFS para reduzir clipping.</p></div>
          <div className="nx-progress-card"><div className="progress-heading"><span>Exportação</span><b>{progress}%</b></div><div className="progress-track"><div className="progress-fill" style={{width:progress+"%"}}/></div><p>{busy?"A renderizar o trecho de áudio…":progress===100?"Exportação concluída.":"O áudio permanece no teu dispositivo."}</p></div>
        </div>
        <div className="settings-actions"><button className="nx-run-button" disabled={!buffer||busy||selectedDuration<.05||fadeIn+fadeOut>selectedDuration} onClick={()=>void cutAudio()}><span>{busy?"A exportar áudio…":"Cortar e exportar WAV"}</span><b>{busy?"◌":"↗"}</b></button><p className="settings-footnote">Exportação em WAV PCM 16-bit. Mantém a taxa de amostragem e o número de canais do original.</p></div>
      </section>
    </div>
  );
}
