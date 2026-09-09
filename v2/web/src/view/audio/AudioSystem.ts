import type { EventBus } from "@/shared/events";

/**
 * Erste Sounds (M4b, Briefing Kap. 15 gekuerzt): synthetisch per WebAudio, keine Dateien — reicht, um Feedback
 * zu pruefen, bevor echte Samples kommen. Haengt an Ereignissen des EventBus; die Simulation weiss nichts davon.
 * Browser erlauben Ton erst nach einer Nutzergeste: `unlock()` wird von der App beim ersten pointerdown/keydown gerufen.
 * Stumm-Schalter merkt sich localStorage (per-Geraet-Komfort, faellt bei Fehler auf „an" zurueck).
 */
export class AudioSystem {
  private ctx: AudioContext | null = null; private master: GainNode | null = null;
  muted = false;

  constructor(bus: EventBus) {
    try { this.muted = localStorage.getItem("bagerana.muted") === "1"; } catch { /* egal */ }
    bus.on("itemGrabbed", ({ kg }) => this.thud(Math.min(1, 0.4 + kg / 800)));
    bus.on("itemReleased", () => this.tone(180, 0.08, "triangle", 0.25));
    bus.on("sortPointsChanged", ({ correct }) => (correct ? this.chime([660, 880], 0.09) : this.buzz()));
    bus.on("containerSold", () => this.chime([523, 659, 784, 1047], 0.08));
    bus.on("moneyChanged", ({ reason }) => { if (reason.startsWith("Bonus")) this.chime([784, 988, 1175], 0.1); });
    bus.on("vehicleArrived", () => this.horn());
    bus.on("vehicleDumped", () => this.noise(0.5, 0.35));
    bus.on("dayPhaseChanged", ({ phase }) => { if (phase === "evening") this.chime([440, 554, 659], 0.16); if (phase === "work") this.chime([392, 523], 0.12); });
    bus.on("missionCompleted", () => this.chime([659, 784, 988, 1319], 0.09));
    bus.on("partTorn", ({ kg }) => { this.noise(0.4, 0.5); this.tone(90, 0.3, "sawtooth", Math.min(0.35, 0.15 + kg / 600)); });
    // Presse (M5b): Hydraulik als tiefer, langsam steigender Ton, Blechknicken als kurzes Rauschen je Quetschstufe,
    // Verweigerung als kurze Warnhupe — nie als Fehlerpiepsen (Briefing Kap. 15: „nie Buzzer").
    bus.on("pressStarted", () => this.hydraulics());
    bus.on("pressLidsClosed", () => { this.noise(0.3, 0.55); this.tone(80, 0.25, "square", 0.3); }); // Eisenplatten schlagen auf
    bus.on("pressDone", ({ purity }) => { this.noise(0.4, 0.5); this.chime(purity > 0.95 ? [330, 415, 523, 659] : [330, 415], 0.11); });
    bus.on("pressDenied", () => { this.tone(196, 0.5, "sawtooth", 0.16); this.tone(147, 0.5, "sawtooth", 0.16); });
  }

  /** Beim ersten Nutzer-Input rufen. */
  unlock(): void {
    if (this.ctx) { if (this.ctx.state === "suspended") void this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (!AC) return;
      this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.5; this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }
  toggleMute(): boolean {
    this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    try { localStorage.setItem("bagerana.muted", this.muted ? "1" : "0"); } catch { /* egal */ }
    return this.muted;
  }

  private tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.3, at = 0): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + at; const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  private chime(freqs: number[], step: number): void { freqs.forEach((f, i) => this.tone(f, step * 2.2, "sine", 0.25, i * step)); }
  private buzz(): void { this.tone(110, 0.25, "square", 0.12); this.tone(104, 0.25, "square", 0.12); }
  private horn(): void { this.tone(220, 0.35, "sawtooth", 0.12); this.tone(277, 0.35, "sawtooth", 0.12); }
  /** Hydraulikpumpe: tiefer Ton ueber den ganzen Zyklus (Klappen 1,6 s + Stempel 3 s + Halten 0,9 s + zurueck 2 s). */
  private hydraulics(): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime; const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(55, t0); o.frequency.linearRampToValueAtTime(78, t0 + 7.5);
    const f = this.ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 320;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.22, t0 + 0.15);
    g.gain.setValueAtTime(0.22, t0 + 7.2); g.gain.exponentialRampToValueAtTime(0.001, t0 + 7.9);
    o.connect(f); f.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + 8);
  }
  private thud(vol: number): void { this.tone(70, 0.12, "sine", 0.4 * vol); this.noise(0.06, 0.15 * vol); }
  private noise(dur: number, vol: number): void {
    if (!this.ctx || !this.master || this.muted) return;
    const n = Math.floor(this.ctx.sampleRate * dur); const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf; const g = this.ctx.createGain(); g.gain.value = vol;
    const f = this.ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
  }
}
