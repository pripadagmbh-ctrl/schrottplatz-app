/**
 * Waechter fuer die Geraeusche (E-121, 06.10.2026).
 *
 * Anlass: Patrick, 06.10.2026 — „geräusche beim greifen, schrott geräusche …
 * Geäusche entscheidend. Kehr geräusch der Spinne überarbeiten."
 *
 * Hoeren kann ein Test nicht. Pruefen kann er:
 *  1. dass jedes Ereignis aus der Bestandstabelle einen Klang ausloest,
 *  2. dass die Stimmenbegrenzung greift (ein Haufen wird kein Maschinengewehr),
 *  3. dass `greifer:zugedrueckt` mit steigender Kraft lauter wird,
 *  4. dass Kehren je Untergrund einen anderen Klangweg nimmt,
 *  5. was ein voller Haufen in Bewegung an Knoten und Rechenzeit kostet.
 *
 * Gespielt wird gegen einen nachgebauten AudioContext, der mitschreibt, welche
 * Knoten entstehen und welche Pegel gesetzt werden.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AudioManager } from "../src/audio/audioManager";
import { EventBus, type GameEvents } from "../src/core/events";
import {
  aufprallKlang,
  aufprallPegel,
  bissPegel,
  familieVon,
  kehrKlang,
  Rasselbett,
  SCHLAG_AB_MS,
  Stimmenbudget,
  stoehnen,
} from "../src/audio/klangregeln";

// ---------------------------------------------------------------- Attrappen

interface Param {
  value: number;
  /** groesster je geplante Wert */
  max: number;
  /** zuletzt geplantes Ziel */
  ziel: number;
}

function param(): Param & Record<string, unknown> {
  const p: Param & Record<string, unknown> = { value: 0, max: 0, ziel: 0 };
  const merk = (v: number): typeof p => {
    p.max = Math.max(p.max, v);
    p.ziel = v;
    return p;
  };
  p.setValueAtTime = merk;
  p.linearRampToValueAtTime = merk;
  p.exponentialRampToValueAtTime = merk;
  p.setTargetAtTime = merk;
  p.cancelScheduledValues = () => p;
  return p;
}

class FakeCtx {
  state = "running";
  currentTime = 0;
  sampleRate = 8000; // klein: die Knisterpuffer werden im Test nur einmal gerechnet
  onstatechange: (() => void) | null = null;
  destination = {};
  quellen = 0;
  gains: Param[] = [];

  private knoten(quelle: boolean): Record<string, unknown> {
    if (quelle) this.quellen++;
    const k: Record<string, unknown> = {
      gain: param(),
      frequency: param(),
      Q: param(),
      detune: param(),
      playbackRate: param(),
      threshold: param(),
      knee: param(),
      ratio: param(),
      attack: param(),
      release: param(),
      type: "",
      buffer: null,
      loop: false,
      connect: (ziel: unknown) => ziel,
      disconnect: () => {},
      start: () => {},
      stop: () => {},
    };
    this.gains.push(k.gain as Param);
    return k;
  }
  createGain = (): unknown => this.knoten(false);
  createBiquadFilter = (): unknown => this.knoten(false);
  createDynamicsCompressor = (): unknown => this.knoten(false);
  createOscillator = (): unknown => this.knoten(true);
  createBufferSource = (): unknown => this.knoten(true);
  createBuffer = (_k: number, len: number): unknown => {
    const d = new Float32Array(len);
    return { getChannelData: () => d };
  };
  async resume(): Promise<void> {}
  async close(): Promise<void> {}
}

let ctx: FakeCtx;
const g = globalThis as Record<string, unknown>;
const echt = { window: g.window, document: g.document, AudioContext: g.AudioContext };

beforeEach(() => {
  const horcher: Array<() => void> = [];
  g.window = {
    addEventListener: (t: string, f: () => void) => {
      if (t === "pointerdown") horcher.push(f);
    },
    setTimeout: () => 0,
    setInterval: () => 1,
    clearInterval: () => {},
  };
  g.document = { hidden: false, addEventListener: () => {} };
  g.AudioContext = function (): FakeCtx {
    ctx = new FakeCtx();
    return ctx;
  };
  (g as { _geste?: () => void })._geste = () => horcher.forEach((f) => f());
});

afterEach(() => {
  g.window = echt.window;
  g.document = echt.document;
  g.AudioContext = echt.AudioContext;
});

/** Manager mit Bus, nach der ersten Geste. Musik aus, damit sie nicht mitzaehlt. */
function starte(): { mgr: AudioManager; bus: EventBus } {
  const bus = new EventBus();
  const mgr = new AudioManager(bus);
  mgr.toggleMusic();
  (g as { _geste: () => void })._geste();
  return { mgr, bus };
}

/** Was hat `f` an Quellen angelegt, und welcher Pegel war der lauteste? */
function miss(f: () => void): { quellen: number; lautester: number } {
  const q0 = ctx.quellen;
  const g0 = ctx.gains.length;
  f();
  const neu = ctx.gains.slice(g0);
  return { quellen: ctx.quellen - q0, lautester: Math.max(0, ...neu.map((p) => p.max)) };
}

function aufprall(
  materialId: string,
  wucht: number,
  untergrund: GameEvents["schrott:aufprall"]["untergrund"] = "beton",
  massKg = 80
): GameEvents["schrott:aufprall"] {
  return { materialId, massKg, wucht, blech: false, untergrund, x: 0, y: 0, z: 0 };
}

// ---------------------------------------------------- 1. jedes Ereignis klingt

describe("Bestandstabelle: jedes Ereignis loest einen Klang aus", () => {
  it("Aufprall, Biss und Loslassen ueber den Bus", () => {
    const { bus } = starte();
    for (const u of ["beton", "stahl", "schrott"] as const) {
      ctx.currentTime += 2; // frisches Kontingent
      expect(miss(() => bus.emit("schrott:aufprall", aufprall("steel", 5, u))).quellen).toBeGreaterThan(0);
    }
    expect(miss(() => bus.emit("greifer:zugedrueckt", { handle: 1, kraftKN: 20, x: 0, y: 0, z: 0 })).quellen).toBeGreaterThan(0);
    expect(miss(() => bus.emit("released", { count: 1 })).quellen).toBeGreaterThan(0);
  });

  it("jedes Material hat einen Aufprallklang", () => {
    const { bus } = starte();
    const materialien = ["steel", "va", "alu", "copper", "brass", "zinc", "battery", "cable", "mixed", "wood", "tires", "rubble", "plastic"];
    for (const m of materialien) {
      ctx.currentTime += 2;
      expect(miss(() => bus.emit("schrott:aufprall", aufprall(m, 5))).quellen, m).toBeGreaterThan(0);
    }
  });

  it("die bisherigen Klaenge bleiben (Zuschnappen, Zupacken, Quetschen, Glas, Zaun, Abriss)", () => {
    const { mgr } = starte();
    for (const f of [
      () => mgr.playClawSnap(1),
      () => mgr.playGrab("copper"),
      () => mgr.playCrash(1),
      () => mgr.playGlass(),
      () => mgr.playRattle(),
      () => mgr.playTear(),
    ]) {
      expect(miss(f).quellen).toBeGreaterThan(0);
    }
  });

  it("Zupacken klingt nach dem Material, das gefasst wird", () => {
    const { mgr } = starte();
    const ohne = miss(() => mgr.playGrab()).quellen;
    const mit = miss(() => mgr.playGrab("alu")).quellen;
    expect(mit).toBeGreaterThan(ohne);
  });

  it("Zudruecken und Schalenfahrt ziehen ihre Dauertoene hoch", () => {
    const { mgr } = starte();
    const m = mgr as unknown as {
      stoehnGain: { gain: Param };
      schalenGain: { gain: Param };
      ventilGain: { gain: Param };
    };
    mgr.setGreifer(0, 0);
    expect(m.stoehnGain.gain.ziel).toBe(0);
    mgr.setGreifer(1, 0.5);
    expect(m.stoehnGain.gain.ziel).toBeGreaterThan(0);
    expect(m.schalenGain.gain.ziel).toBeGreaterThan(0);
    expect(m.ventilGain.gain.ziel).toBe(0);
    mgr.setGreifer(0, 1);
    expect(m.ventilGain.gain.ziel).toBeGreaterThan(0); // Ventil zischt erst am Ende
  });
});

// -------------------------------------------------------------- 2. Begrenzung

describe("Stimmenbegrenzung", () => {
  it("ein Haufen mit 200 Aufprallen im selben Moment gibt hoechstens 4 leise Schlaege", () => {
    const { mgr, bus } = starte();
    ctx.currentTime = 10;
    const schlaegeVorher = mgr.stimmen;
    for (let i = 0; i < 200; i++) bus.emit("schrott:aufprall", aufprall("steel", 2.5, "schrott", 20));
    expect(schlaegeVorher).toBe(0);
    expect(mgr.stimmen).toBe(4);
  });

  it("laute Schlaege kommen am Kontingent vorbei, aber nie ueber sechs Stimmen", () => {
    const { mgr, bus } = starte();
    ctx.currentTime = 10;
    for (let i = 0; i < 50; i++) bus.emit("schrott:aufprall", aufprall("steel", 7, "stahl", 800));
    expect(mgr.stimmen).toBe(6);
  });

  it("nach einem klappernden Haufen kommt ein lauter Schlag trotzdem durch", () => {
    const b = new Stimmenbudget();
    for (let i = 0; i < 20; i++) b.darf(0, 0.01, 0.2); // Kontingent leer
    expect(b.darf(0.02, 0.3, 0.2)).toBe(false); // leise: nein
    expect(b.darf(0.02, 0.3, 0.9)).toBe(true); // laut: ja
  });

  it("was abgewiesen wird, rasselt — gedeckelt", () => {
    const { mgr, bus } = starte();
    const bett = (mgr as unknown as { bettGain: { gain: Param } }).bettGain.gain;
    ctx.currentTime = 10;
    for (let i = 0; i < 500; i++) bus.emit("schrott:aufprall", aufprall("steel", 3, "schrott", 20));
    expect(bett.max).toBeGreaterThan(0);
    expect(bett.max).toBeLessThanOrEqual(0.12 + 1e-9);
  });

  it("das Kontingent fuellt sich wieder auf (4 je Sekunde)", () => {
    const b = new Stimmenbudget();
    let n = 0;
    for (let t = 0; t < 10; t += 0.01) if (b.darf(t, 0.05, 0.3)) n++;
    // 4 Vorrat + 4/s ueber 10 s = 44, Rundung an den Raendern
    expect(n).toBeGreaterThanOrEqual(42);
    expect(n).toBeLessThanOrEqual(45);
  });

  it("das Rasselbett klingt ab und bleibt unter dem Deckel", () => {
    const r = new Rasselbett();
    for (let i = 0; i < 100; i++) r.dazu(0, 0.5);
    expect(r.stand(0)).toBe(1);
    expect(r.stand(1)).toBeLessThan(0.1);
  });
});

// ----------------------------------------------------------------- 3. Kraft

describe("Zudruecken: haerter = lauter", () => {
  it("bissPegel steigt mit der Kraft", () => {
    let vorher = -1;
    for (const kn of [0, 5, 15, 25, 35, 49.05]) {
      expect(bissPegel(kn)).toBeGreaterThan(vorher);
      vorher = bissPegel(kn);
    }
    expect(bissPegel(0)).toBeGreaterThan(0); // auch ein leichter Biss ist hoerbar
  });

  it("greifer:zugedrueckt mit 45 kN ist lauter als mit 5 kN", () => {
    const { bus } = starte();
    const biss = (kn: number): number => {
      ctx.currentTime += 1;
      return miss(() => bus.emit("greifer:zugedrueckt", { handle: 1, kraftKN: kn, x: 0, y: 0, z: 0 })).lautester;
    };
    const leise = biss(5);
    const mittel = biss(25);
    const laut = biss(45);
    expect(mittel).toBeGreaterThan(leise);
    expect(laut).toBeGreaterThan(mittel);
  });

  it("mehrere Koerper im selben Biss knirschen nur einmal", () => {
    const { bus } = starte();
    ctx.currentTime = 5;
    const erst = miss(() => bus.emit("greifer:zugedrueckt", { handle: 1, kraftKN: 30, x: 0, y: 0, z: 0 })).quellen;
    const zweit = miss(() => bus.emit("greifer:zugedrueckt", { handle: 2, kraftKN: 30, x: 0, y: 0, z: 0 })).quellen;
    expect(erst).toBeGreaterThan(0);
    expect(zweit).toBe(0);
  });

  it("das Stoehnen wird mit der Kraft lauter und hoeher", () => {
    const a = stoehnen(0.2);
    const b = stoehnen(0.8);
    expect(b.laut).toBeGreaterThan(a.laut);
    expect(b.hz).toBeGreaterThan(a.hz);
    expect(stoehnen(0).laut).toBe(0);
  });
});

// ----------------------------------------------------------------- 4. Kehren

describe("Kehren je Untergrund", () => {
  it("nimmt je Untergrund einen eigenen Klangweg, die anderen schweigen", () => {
    const { mgr } = starte();
    const kehr = (mgr as unknown as { kehr: Record<string, { gain: { gain: Param } }> }).kehr;
    for (const u of ["beton", "stahl", "schrott"] as const) {
      mgr.setScrape(0.7, u);
      for (const v of ["beton", "stahl", "schrott"]) {
        if (v === u) expect(kehr[v]!.gain.gain.ziel, `${u}`).toBeGreaterThan(0);
        else expect(kehr[v]!.gain.gain.ziel, `${u}→${v}`).toBe(0);
      }
    }
    mgr.setScrape(0);
    for (const v of ["beton", "stahl", "schrott"]) expect(kehr[v]!.gain.gain.ziel).toBe(0);
  });

  it("schneller = lauter und heller", () => {
    for (const u of ["beton", "stahl", "schrott"] as const) {
      const a = kehrKlang(0.2, u);
      const b = kehrKlang(0.9, u);
      expect(b.laut).toBeGreaterThan(a.laut);
      expect(b.hz).toBeGreaterThan(a.hz);
    }
  });

  it("die drei Untergruende liegen in verschiedenen Lagen (Stahl am hoechsten)", () => {
    const hz = (u: "beton" | "stahl" | "schrott"): number => kehrKlang(0.5, u).hz;
    expect(hz("stahl")).toBeGreaterThan(hz("schrott"));
    expect(hz("schrott")).toBeGreaterThan(hz("beton"));
  });
});

// ------------------------------------------------------- Klangregeln, pur

describe("Aufprall-Regeln", () => {
  it("unter der Schwelle kein Schlag, nur Rasseln", () => {
    expect(aufprallKlang(aufprall("steel", SCHLAG_AB_MS - 0.01))).toBeNull();
    expect(aufprallKlang(aufprall("steel", SCHLAG_AB_MS))).not.toBeNull();
  });

  it("haerter und schwerer = lauter", () => {
    expect(aufprallPegel(5, 80)).toBeGreaterThan(aufprallPegel(2, 80));
    expect(aufprallPegel(5, 800)).toBeGreaterThan(aufprallPegel(5, 8));
  });

  it("Stahl dumpf, Blech scheppert, Alu und Kupfer heller", () => {
    const grund = (m: string, kg = 200, blech = false): number =>
      aufprallKlang({ materialId: m, massKg: kg, wucht: 5, blech, untergrund: "stahl" })!.teil.teiltoene[0]!;
    expect(familieVon("steel", 200, false)).toBe("stahl");
    expect(familieVon("steel", 200, true)).toBe("blech");
    expect(familieVon("steel", 10, false)).toBe("blech");
    expect(grund("steel")).toBeLessThan(grund("steel", 200, true));
    expect(grund("alu")).toBeGreaterThan(grund("steel"));
    expect(grund("copper")).toBeGreaterThan(grund("steel"));
    const blech = aufprallKlang({ materialId: "steel", massKg: 20, wucht: 5, blech: true, untergrund: "beton" })!;
    expect(blech.teil.scheppern).toBeGreaterThan(0);
  });

  it("jeder Klang hat Anteile ueber 300 Hz — sonst stumm auf dem iPhone-Lautsprecher", () => {
    for (const m of ["steel", "va", "alu", "copper", "cable", "battery", "wood", "tires", "rubble", "plastic"]) {
      for (const u of ["beton", "stahl", "schrott"] as const) {
        const r = aufprallKlang({ materialId: m, massKg: 500, wucht: 5, blech: false, untergrund: u })!;
        expect(Math.max(...r.teil.teiltoene), m).toBeGreaterThan(300);
        expect(Math.max(...r.grund.teiltoene), u).toBeGreaterThan(300);
      }
    }
  });
});

// ------------------------------------------------------------- 5. Rechenzeit

describe("Rechenzeit: voller Haufen in Bewegung", () => {
  it("300 Teile, jedes meldet so oft es darf (alle 0,18 s), 5 s lang", () => {
    const { mgr, bus } = starte();
    const TEILE = 300;
    const FPS = 60;
    const SEK = 5;
    const JE_BILD = Math.ceil(TEILE / 11); // 0,18 s Sperre je Teil bei 60 Hz
    const lauf = (start: number): { ereignisse: number; stimmen: number } => {
      let ereignisse = 0;
      let stimmen = 0;
      for (let bild = 0; bild < FPS * SEK; bild++) {
        ctx.currentTime = start + bild / FPS;
        for (let i = 0; i < JE_BILD; i++) {
          const wucht = 1.1 + Math.random() * 5;
          const m = ["steel", "alu", "copper", "mixed"][i % 4]!;
          bus.emit("schrott:aufprall", aufprall(m, wucht, "schrott", 5 + Math.random() * 200));
          ereignisse++;
        }
        stimmen = Math.max(stimmen, mgr.stimmen);
      }
      return { ereignisse, stimmen };
    };
    lauf(20); // Aufwaermen: der erste Lauf misst den Uebersetzer, nicht den Ton
    const q0 = ctx.quellen;
    const k0 = ctx.gains.length;
    const t0 = performance.now();
    const { ereignisse, stimmen } = lauf(40);
    const ms = performance.now() - t0;
    const quellenJeS = (ctx.quellen - q0) / SEK;
    const knotenJeS = (ctx.gains.length - k0) / SEK;
    console.info(
      `[E-121 Messung] ${ereignisse} Aufpralle in ${SEK} s (${(ereignisse / SEK).toFixed(0)}/s): ` +
        `${ms.toFixed(1)} ms JS gesamt = ${((ms / (FPS * SEK)) * 1000).toFixed(1)} µs je Bild; ` +
        `${quellenJeS.toFixed(0)} neue Quellen/s, ${knotenJeS.toFixed(0)} neue Knoten/s, ` +
        `hoechstens ${stimmen} Schlaege gleichzeitig`
    );
    expect(stimmen).toBeLessThanOrEqual(6);
    // 4 Schlaege/s plus laute: grosszuegige Obergrenze, damit ein Fehler im
    // Budget auffaellt (ohne Budget waeren es ueber 40 000 Knoten/s)
    expect(knotenJeS).toBeLessThan(1500);
  });
});
