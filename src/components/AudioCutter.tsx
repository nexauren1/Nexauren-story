import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";

function timeLabel(seconds: number) {
  if (!Number.isFinite(seconds)) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2,"0")}:${String(remaining).padStart(2,"0")}`;
}
function sizeLabel(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
function encodeWav(buffer: AudioBuffer, start: number, end: number): Blob {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const from = Math.max(0, Math.floor(start * sampleRate));
  const to = Math.min(buffer.length, Math.floor(end * sampleRate));
  const frames = Math.max(1, to - from);
  const bytesPerSample = 2;
  const dataSize = frames * channels * bytesPerSample;
  const output = new ArrayBuffer(44 + dataSize);
  const view = new DataView(output);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  write(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); write(8, "WAVE");
  write(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true); view.setUint16(34, 16, true);
  write(36, "data"); view.setUint32(40, dataSize, true);
  let offset = 44;
  const channelData = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  for (let frame = from; frame < to; frame++) {
    for (let channel = 0; channel < channels; channel++) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }
  return new Blob([output], { type: "audio/wav" });
}

export default function AudioCutter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const [resultUrl, setResultUrl] = useState("");
  const [resultSize, setResultSize] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!file) { setAudioUrl(""); setBuffer(null); return; }
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setResultUrl("");
    setResultSize(0);
    setError("");
    setNotice("");
    setProgress(0);
    setPeaks([]);
    let active = true;
    async function decode() {
      try {
        const AudioContextClass = window.AudioContext;
        const context = new AudioContextClass();
        const decoded = await context.decodeAudioData(await file!.arrayBuffer());
        await context.close();
        if (!active) return;
        setBuffer(decoded);
        setDuration(decoded.duration);
        setStart(0);
        setEnd(decoded.duration);
        const values: number[] = [];
        const channel = decoded.getChannelData(0);
        const bucketSize = Math.max(1, Math.floor(channel.length / 150));
        for (let i = 0; i < 150; i++) {
          const from = i * bucketSize;
          let peak = 0;
          for (let j = from; j < Math.min(channel.length, from + bucketSize); j += 8) peak = Math.max(peak, Math.abs(channel[j]));
          values.push(Math.max(.06, peak));
        }
        setPeaks(values);
      } catch {
        setError("Não foi possível descodificar este áudio. Experimenta um ficheiro MP3 ou WAV compatível.");
      }
    }
    void decode();
    return () => { active = false; URL.revokeObjectURL(url); };
  }, [file]);

  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);
  const selectedDuration = Math.max(0, end - start);
  const selectedSize = useMemo(() => buffer ? Math.round(buffer.sampleRate * selectedDuration * buffer.numberOfChannels * 2) : 0, [buffer, selectedDuration]);

  function selectFile(next?: File) {
    if (!next) return;
    if (!next.type.startsWith("audio/") && !/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(next.name)) {
      setError("Seleciona um ficheiro de áudio válido.");
      return;
    }
    if (next.size > 55 * 1024 * 1024) {
      setError("O ficheiro ultrapassa o limite de 55 MB.");
      return;
    }
    setFile(next);
  }
  function onChange(event: ChangeEvent<HTMLInputElement>) { selectFile(event.target.files?.[0]); event.target.value = ""; }
  function onDrop(event: DragEvent<HTMLLabelElement>) { event.preventDefault(); event.currentTarget.classList.remove("is-dragging"); selectFile(event.dataTransfer.files?.[0]); }
  function updateStart(value: number) { setStart(Math.min(value, Math.max(0, end - .1))); }
  function updateEnd(value: number) { setEnd(Math.max(value, Math.min(duration, start + .1))); }

  async function playSelection() {
    const player = audioRef.current;
    if (!player || !audioUrl) return;
    if (playing) { player.pause(); setPlaying(false); return; }
    player.currentTime = start;
    await player.play();
    setPlaying(true);
  }

  async function cutAudio() {
    if (!buffer || !file || selectedDuration < .1 || busy) return;
    setBusy(true);
    setProgress(15);
    setError("");
    setNotice("");
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      setProgress(40);
      const blob = encodeWav(buffer, start, end);
      setProgress(90);
      const url = URL.createObjectURL(blob);
      setResultUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return url; });
      setResultSize(blob.size);
      setProgress(100);
      setNotice("Trecho exportado com sucesso. O áudio foi processado neste dispositivo.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível cortar o áudio.");
      setProgress(0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tool-workspace audio-workspace">
      <section className="tool-panel">
        {!file ? (
          <label className="upload-zone audio-upload-zone" onDragOver={(event) => { event.preventDefault(); event.currentTarget.classList.add("is-dragging"); }} onDragLeave={(event) => event.currentTarget.classList.remove("is-dragging")} onDrop={onDrop}>
            <input ref={inputRef} className="file-input-hidden" type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" onChange={onChange}/>
            <span className="upload-icon audio-upload-icon">♫</span><strong>Adicione o seu ficheiro de áudio</strong><small>Arraste e solte ou selecione no dispositivo<br/>MP3, WAV, M4A, AAC, OGG · máximo 55 MB</small><span className="upload-cta">Selecionar áudio</span>
          </label>
        ) : (
          <>
            <div className="audio-file-heading"><div><b>{file.name}</b><small>{sizeLabel(file.size)} · Duração total {timeLabel(duration)}</small></div><button className="secondary-button" onClick={() => { setFile(null); setResultUrl(""); setNotice(""); setError(""); }}>Trocar áudio</button></div>
            <div className="audio-wave-wrap">
              <div className="audio-wave" aria-label="Forma de onda do áudio">
                {peaks.map((peak, index) => <span key={index} style={{ height: `${Math.round(peak * 100)}%` }}/>)}
                <div className="wave-selection" style={{ left: `${duration ? start/duration*100 : 0}%`, width: `${duration ? selectedDuration/duration*100 : 100}%` }}/>
              </div>
              <div className="audio-time-row"><span>Início <strong>{timeLabel(start)}</strong></span><span>Fim <strong>{timeLabel(end)}</strong></span><span>Duração <strong>{timeLabel(selectedDuration)}</strong></span></div>
            </div>
            <div className="audio-selected">
              <div className="audio-range">
                <label>Início <input type="range" min="0" max={Math.max(duration,.1)} step=".1" value={start} onChange={(event) => updateStart(Number(event.target.value))}/><b>{timeLabel(start)}</b></label>
                <label>Fim <input type="range" min="0" max={Math.max(duration,.1)} step=".1" value={end} onChange={(event) => updateEnd(Number(event.target.value))}/><b>{timeLabel(end)}</b></label>
              </div>
            </div>
            <audio ref={audioRef} src={audioUrl} controls className="audio-native-player" onEnded={() => setPlaying(false)} onTimeUpdate={(event) => { if (event.currentTarget.currentTime >= end) { event.currentTarget.pause(); setPlaying(false); } }}/>
            <div className="audio-controls"><button type="button" className="play-button" onClick={playSelection}>{playing ? "Ⅱ" : "▶"}</button><span className="audio-clock">{timeLabel(start)} <span>/ {timeLabel(end)}</span></span><span className="audio-size">Tamanho estimado: {sizeLabel(selectedSize)}</span></div>
          </>
        )}
        {error && <div className="error-banner" role="alert">{error}</div>}
        {notice && <div className="success-banner"><b>✓</b>{notice}</div>}
        <div className="audio-list-heading"><h3>Ficheiro carregado</h3><span>{file ? "1 ficheiro" : "0 ficheiros"}</span></div>
        {file ? <div className="processing-file"><span className="audio-file-icon">♫</span><div><b>{file.name}</b><small>Carregado agora · {timeLabel(duration)} · {sizeLabel(file.size)}</small></div><span className="file-done">{resultUrl ? "Cortado" : "Pronto"}</span></div> : <div className="tool-empty">Os ficheiros selecionados aparecem aqui.</div>}
      </section>

      <section className="tool-panel settings-panel">
        <div>
          <h2>Configurações de Corte</h2>
          <div className="settings-group">
            <span className="settings-label">Seleção do trecho</span>
            <div className="result-box">
              <div className="result-line"><span>Início:</span><strong>{timeLabel(start)}</strong></div>
              <div className="result-line"><span>Fim:</span><strong>{timeLabel(end)}</strong></div>
              <div className="result-line"><span>Duração selecionada:</span><strong className="good">{timeLabel(selectedDuration)}</strong></div>
            </div>
          </div>
          <div className="settings-group">
            <span className="settings-label">Formato de exportação</span>
            <div className="format-choice"><b>WAV · PCM 16-bit</b><small>Áudio sem compressão adicional. Mantém a taxa de amostragem e os canais do original.</small></div>
          </div>
          <div className="tool-help-note"><strong>Pré-visualização:</strong> use o botão de reprodução para ouvir o áudio desde o início selecionado. O corte final respeita os marcadores de início e fim.</div>
          <div className="progress-heading"><span>Processamento</span><span>{progress}%</span></div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }}/></div>
          <p className="status-note">{busy ? "A extrair o trecho selecionado…" : progress === 100 ? "Concluído — o ficheiro está pronto." : "Carrega um áudio e define o intervalo."}</p>
        </div>
        <div className="settings-actions">
          <button className="primary-button" disabled={!buffer || busy || selectedDuration < .1} onClick={cutAudio}>{busy ? "A cortar áudio…" : "✂  Cortar Áudio"}</button>
          {resultUrl && <a className="download-button" href={resultUrl} download={`${file?.name.replace(/\.[^.]+$/, "") ?? "audio"}-cortado.wav`}>↓  Baixar WAV</a>}
          {resultUrl && <div className="result-line"><span>Tamanho do novo áudio:</span><strong className="good">{sizeLabel(resultSize)}</strong></div>}
          <p className="settings-footnote">A descodificação e o corte são efetuados no navegador. O ficheiro original não é enviado para um servidor.</p>
        </div>
      </section>
    </div>
  );
}
