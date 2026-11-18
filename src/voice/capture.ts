/**
 * Запись голоса с «ближним полем»:
 *  • шумоподавление и эхоподавление включены, автоусиление ВЫКЛЮЧЕНО (иначе далёкие голоса станут громкими);
 *  • фильтр 110–4200 Гц (речь), живой индикатор уровня;
 *  • автоматический конец фразы после паузы;
 *  • на выходе — только речь ближнего говорящего (см. vad.ts), 16 кГц WAV.
 */
import { analyze, Endpointer, FRAME_MS, type Analysis } from "./vad";
import { encodeWav, resampleTo16k } from "./wav";

export type CaptureResult = { wav: Blob | null; analysis: Analysis; seconds: number };

export class VoiceRecorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  private length = 0;
  private ep = new Endpointer();
  private rate = 16000;
  private stopped = false;
  private timer = 0;
  private nFrames = 0;

  static supported() { return !!navigator.mediaDevices?.getUserMedia && (!!window.AudioContext || !!(window as any).webkitAudioContext); }

  async start(onLevel: (db: number, state: "idle" | "speech" | "done") => void, onAutoStop: () => void, maxMs = 9000) {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false, channelCount: 1 } as MediaTrackConstraints
    });
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AC();
    if (this.ctx!.state === "suspended") await this.ctx!.resume();
    this.rate = this.ctx!.sampleRate;
    const src = this.ctx!.createMediaStreamSource(this.stream);
    const hp = this.ctx!.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 110; hp.Q.value = 0.7;
    const lp = this.ctx!.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 4200; lp.Q.value = 0.7;
    this.node = this.ctx!.createScriptProcessor(2048, 1, 1);
    const frame = Math.round((this.rate * FRAME_MS) / 1000);
    let carry = new Float32Array(0);
    this.node.onaudioprocess = (e) => {
      if (this.stopped) return;
      const inp = e.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(inp)); this.length += inp.length;
      const buf = new Float32Array(carry.length + inp.length); buf.set(carry); buf.set(inp, carry.length);
      let o = 0;
      for (; o + frame <= buf.length; o += frame) {
        let s = 0; for (let i = o; i < o + frame; i++) s += buf[i] * buf[i];
        const db = 10 * Math.log10(s / frame + 1e-10);
        const st = this.ep.push(db);
        onLevel(db, st);
        this.nFrames++;
        // речи нет уже 6 секунд — заканчиваем (покажем подсказку «говорите ближе»)
        if ((st === "done" || (st === "idle" && this.nFrames > 300)) && !this.stopped) { this.stopped = true; setTimeout(onAutoStop, 0); }
      }
      carry = buf.slice(o);
    };
    const mute = this.ctx!.createGain(); mute.gain.value = 0;
    src.connect(hp); hp.connect(lp); lp.connect(this.node); this.node.connect(mute); mute.connect(this.ctx!.destination);
    this.timer = window.setTimeout(() => { if (!this.stopped) { this.stopped = true; onAutoStop(); } }, maxMs);
  }

  async stop(): Promise<CaptureResult> {
    this.stopped = true;
    clearTimeout(this.timer);
    const pcm = new Float32Array(this.length);
    let o = 0; for (const c of this.chunks) { pcm.set(c, o); o += c.length; }
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    await this.ctx?.close().catch(() => undefined);
    const analysis = analyze(pcm, this.rate);
    const seconds = pcm.length / this.rate;
    if (!analysis.ok || !analysis.range) return { wav: null, analysis, seconds };
    let seg: Float32Array = pcm.slice(analysis.range[0], analysis.range[1]);
    // речь ближнего говорящего приводим к стандартному уровню (пик −3 dBFS) — только после отсечения далёких голосов
    let peak = 0; for (let i = 0; i < seg.length; i++) peak = Math.max(peak, Math.abs(seg[i]));
    if (peak > 0.001) { const g = Math.min(20, 0.7 / peak); for (let i = 0; i < seg.length; i++) seg[i] *= g; }
    seg = resampleTo16k(seg, this.rate);
    return { wav: new Blob([encodeWav(seg, 16000) as BlobPart], { type: "audio/wav" }), analysis, seconds };
  }

  cancel() {
    this.stopped = true; clearTimeout(this.timer);
    this.node?.disconnect(); this.stream?.getTracks().forEach((t) => t.stop()); void this.ctx?.close().catch(() => undefined);
  }
}
