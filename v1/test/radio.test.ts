/**
 * Waechter fuers Kabinenradio (Auftrag 14.09.2026: „Radio mit eigenen
 * Stuecken, Schlager-Melodie als Standard").
 *
 * Drei Dinge werden hier festgehalten:
 *  1. Die alte Schlagermelodie ist Ton fuer Ton die von frueher und ist
 *     Standard — sie soll nie wieder versehentlich verschwinden.
 *  2. Ein Stueck ist reine Datenkunde: Der Klangapparat kennt keinen Sender.
 *  3. Ein Senderwechsel blendet ueber und gilt nicht als Unterbrechung —
 *     sonst knackt es, und der Taktgeber wuerde unnoetig neu aufgesetzt.
 *
 * Gespielt wird gegen einen nachgebauten AudioContext: In Vitest gibt es
 * weder Browser noch Lautsprecher.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  BLUESROCK,
  SCHLAGER,
  SENDER,
  STANDARD_SENDER,
  findeSender,
  type Song,
} from "../src/audio/songs";
import { Music } from "../src/audio/music";
import { senderAnsage, senderListe } from "../src/ui/radio";

// ---------------------------------------------------------------- Attrappen

interface ParamRuf {
  art: string;
  wert: number;
  zeit: number;
}
interface FakeParam {
  value: number;
  verlauf: ParamRuf[];
  setValueAtTime: (w: number, t: number) => FakeParam;
  linearRampToValueAtTime: (w: number, t: number) => FakeParam;
  exponentialRampToValueAtTime: (w: number, t: number) => FakeParam;
  setTargetAtTime: (w: number, t: number) => FakeParam;
  cancelScheduledValues: (t: number) => FakeParam;
}

function param(): FakeParam {
  const p = { value: 0, verlauf: [] as ParamRuf[] } as FakeParam;
  const merke =
    (art: string) =>
    (w: number, t: number): FakeParam => {
      p.verlauf.push({ art, wert: w, zeit: t });
      if (art === "setValueAtTime") p.value = w;
      return p;
    };
  p.setValueAtTime = merke("setValueAtTime");
  p.linearRampToValueAtTime = merke("linear");
  p.exponentialRampToValueAtTime = merke("exp");
  p.setTargetAtTime = merke("target");
  p.cancelScheduledValues = (t: number): FakeParam => {
    p.verlauf.push({ art: "cancel", wert: 0, zeit: t });
    return p;
  };
  return p;
}

interface FakeNode {
  gain: FakeParam;
  frequency: FakeParam;
  Q: FakeParam;
  type: string;
  getrennt: number;
  connect: (ziel: unknown) => unknown;
  disconnect: () => void;
  start: (t: number) => void;
  stop: (t: number) => void;
}

class FakeCtx {
  state = "running";
  currentTime = 10;
  sampleRate = 48000;
  destination = {};
  gains: FakeNode[] = [];
  /** Angeworfene Quellen (Oszillatoren, Rauschen) */
  quellen = 0;

  private knoten(): FakeNode {
    const n: FakeNode = {
      gain: param(),
      frequency: param(),
      Q: param(),
      type: "",
      getrennt: 0,
      connect: (ziel: unknown) => ziel,
      disconnect: (): void => {
        n.getrennt++;
      },
      start: (): void => {
        this.quellen++;
      },
      stop: (): void => {},
    };
    return n;
  }
  createGain = (): FakeNode => {
    const n = this.knoten();
    this.gains.push(n);
    return n;
  };
  createBiquadFilter = (): FakeNode => this.knoten();
  createWaveShaper = (): FakeNode => this.knoten();
  createOscillator = (): FakeNode => this.knoten();
  createBufferSource = (): FakeNode => this.knoten();
  createBuffer = (_k: number, len: number): unknown => ({
    getChannelData: () => new Float32Array(len),
  });
}

/** Der Taktgeber laeuft im Test nicht von selbst — er wird von Hand gedreht. */
let takte: Array<() => void> = [];
let fristen: Array<() => void> = [];
let clearRufe = 0;
const echtesWindow = (globalThis as Record<string, unknown>).window;

beforeEach(() => {
  takte = [];
  fristen = [];
  clearRufe = 0;
  (globalThis as Record<string, unknown>).window = {
    setInterval: (f: () => void) => {
      takte.push(f);
      return takte.length;
    },
    clearInterval: () => {
      clearRufe++;
    },
    setTimeout: (f: () => void) => fristen.push(f),
  };
});
afterEach(() => {
  (globalThis as Record<string, unknown>).window = echtesWindow;
});

/** Musik anlegen, anwerfen und einen Taktgeber-Durchlauf ausloesen. */
function starte(sender?: string): { m: Music; ctx: FakeCtx } {
  const ctx = new FakeCtx();
  const m = new Music(ctx as unknown as BaseAudioContext, ctx.destination as unknown as AudioNode, sender);
  m.start();
  for (const f of takte) f();
  return { m, ctx };
}

// -------------------------------------------------------- Die alte Melodie

describe("Schlagerwelle — die Melodie von frueher", () => {
  it("ist der Standardsender", () => {
    expect(STANDARD_SENDER).toBe(SCHLAGER.id);
    expect(SENDER[0]).toBe(SCHLAGER);
    expect(findeSender(undefined)).toBe(SCHLAGER);
    expect(findeSender("gibtsnicht")).toBe(SCHLAGER);
  });

  it("haelt Grundton, Tempo und Klangfarbe der alten Fassung", () => {
    expect(SCHLAGER.grundtonHz).toBe(131); // ROOT_HZ = C3
    expect(60 / SCHLAGER.bpm).toBeCloseTo(0.46, 6); // BEAT_S = 0,46 s
    expect(SCHLAGER.schlaegeProTakt).toBe(4);
    expect(SCHLAGER.klang.bandpass).toEqual({ hz: 1100, q: 0.75 });
    expect(SCHLAGER.klang.hochpassHz).toBe(220);
    expect(SCHLAGER.shuffle).toBe(0);
  });

  it("hat die alte Kadenz C → G → Am → F", () => {
    expect(SCHLAGER.akkorde).toEqual([
      [0, 4, 7],
      [-5, -1, 2],
      [-3, 0, 4],
      [-7, -3, 0],
    ]);
  });

  it("hat die alte Melodie Ton fuer Ton", () => {
    const melodie = SCHLAGER.spuren.find((s) => s.musterProTakt)!;
    const toene = melodie.musterProTakt!.map((takt) => takt.map((t) => t.halbton));
    expect(toene).toEqual([
      [12, 12, 16, 14],
      [14, 11, 7, 11],
      [12, 16, 19, 16],
      [17, 14, 12, 12],
    ]);
    // ein Ton je Schlag, in der Reihenfolge der Schlaege
    for (const takt of melodie.musterProTakt!) {
      expect(takt.map((t) => t.schlag)).toEqual([0, 1, 2, 3]);
    }
  });
});

// ------------------------------------------------------------ Der Bluesrock

describe("Hallenfunk — der Bluesrock", () => {
  it("bleibt als zweiter Sender erhalten", () => {
    expect(SENDER).toContain(BLUESROCK);
    expect(BLUESROCK.bpm).toBe(128);
    expect(BLUESROCK.grundtonHz).toBeCloseTo(82.41, 2); // E2
    expect(BLUESROCK.shuffle).toBeGreaterThan(0); // Shuffle auf den Achteln
  });

  it("hat die Blue Note im Riff", () => {
    const riff = BLUESROCK.spuren.find((s) => s.stimme === "fuzz")!;
    expect(riff.muster!.some((t) => t.halbton === 6)).toBe(true);
  });

  it("laesst die Orgel nur in der zweiten Haelfte mitspielen", () => {
    const orgel = BLUESROCK.spuren.find((s) => s.stimme === "orgel")!;
    expect(orgel.takte).toEqual([2, 3]);
  });

  it("klingt anders als der Schlager — anderer Grundton, anderes Tempo, andere Besetzung", () => {
    expect(BLUESROCK.grundtonHz).not.toBeCloseTo(SCHLAGER.grundtonHz, 1);
    expect(BLUESROCK.bpm).not.toBeCloseTo(SCHLAGER.bpm, 1);
    const stimmen = (s: Song): string[] => [...new Set(s.spuren.map((p) => p.stimme))].sort();
    expect(stimmen(BLUESROCK)).not.toEqual(stimmen(SCHLAGER));
  });
});

// --------------------------------------------------------- Datenkunde

describe("Ein Stueck ist nur ein Datensatz", () => {
  it("jeder Sender ist vollstaendig und in sich stimmig", () => {
    const ids = new Set<string>();
    for (const s of SENDER) {
      expect(ids.has(s.id)).toBe(false);
      ids.add(s.id);
      expect(s.sender.length).toBeGreaterThan(0);
      expect(s.beschreibung.length).toBeGreaterThan(0);
      expect(s.bpm).toBeGreaterThan(40);
      expect(s.akkorde.length).toBeGreaterThan(0);
      expect(s.spuren.length).toBeGreaterThan(0);
      expect(s.pegel).toBeGreaterThan(0);
      for (const spur of s.spuren) {
        const muster = spur.musterProTakt ?? (spur.muster ? [spur.muster] : []);
        expect(muster.length).toBeGreaterThan(0);
        // Ein Muster je Takt heisst: fuer JEDEN Takt eines
        if (spur.musterProTakt) expect(spur.musterProTakt.length).toBe(s.akkorde.length);
        for (const takt of muster) {
          for (const ton of takt) {
            expect(ton.schlag).toBeGreaterThanOrEqual(0);
            expect(ton.schlag).toBeLessThan(s.schlaegeProTakt);
            expect(ton.laenge).toBeGreaterThan(0);
          }
        }
        // Nur Takte, die es in der Schleife gibt
        for (const t of spur.takte ?? []) expect(t).toBeLessThan(s.akkorde.length);
      }
    }
  });

  it("spielt beide Sender, ohne dass der Apparat sie kennt", () => {
    for (const s of SENDER) {
      const { ctx } = starte(s.id);
      expect(ctx.quellen).toBeGreaterThan(0);
    }
  });
});

// ------------------------------------------------------------ Senderwechsel

describe("Senderwechsel", () => {
  it("wechselt das Stueck und meldet es", () => {
    const { m } = starte();
    expect(m.songId).toBe(SCHLAGER.id);
    expect(m.setSong(BLUESROCK.id)).toBe(true);
    expect(m.songId).toBe(BLUESROCK.id);
    // derselbe Sender noch einmal: nichts zu tun, kein Aussetzer
    expect(m.setSong(BLUESROCK.id)).toBe(false);
  });

  it("faellt bei unbekanntem Sender auf den Standard zurueck", () => {
    const { m } = starte(BLUESROCK.id);
    m.setSong("radio-eriwan");
    expect(m.songId).toBe(SCHLAGER.id);
  });

  it("blendet ueber, statt zu knacken", () => {
    const { m, ctx } = starte();
    const alt = ctx.gains[0]!; // die Kette des ersten Senders
    const vorher = ctx.gains.length;
    m.setSong(BLUESROCK.id);
    // neue Kette entstanden
    expect(ctx.gains.length).toBeGreaterThan(vorher);
    const neu = ctx.gains[vorher]!;
    // Das alte Stueck faehrt auf null herunter — mit einer Rampe, nicht hart
    const abwaerts = alt.gain.verlauf.filter((r) => r.art === "linear" && r.wert === 0);
    expect(abwaerts.length).toBeGreaterThan(0);
    expect(abwaerts.at(-1)!.zeit).toBeGreaterThan(ctx.currentTime);
    // Das neue faengt bei null an und faehrt hoch — nie ein Sprung auf Pegel
    expect(neu.gain.verlauf[0]).toMatchObject({ art: "cancel" });
    expect(neu.gain.verlauf[1]).toMatchObject({ art: "setValueAtTime", wert: 0 });
    const hoch = neu.gain.verlauf.find((r) => r.art === "linear" && r.wert > 0);
    expect(hoch).toBeDefined();
    expect(hoch!.zeit).toBeGreaterThan(ctx.currentTime);
    for (const r of neu.gain.verlauf) {
      if (r.art === "setValueAtTime") expect(r.wert).toBe(0);
    }
  });

  it("ist keine Unterbrechung: Taktgeber laeuft weiter, Musik bleibt an", () => {
    const { m } = starte();
    const vorherTakte = takte.length;
    const vorherClear = clearRufe;
    m.setSong(BLUESROCK.id);
    expect(m.enabled).toBe(true);
    expect(clearRufe).toBe(vorherClear); // kein Abraeumen
    expect(takte.length).toBe(vorherTakte); // kein zweiter Taktgeber
  });

  it("haengt die alte Kette erst nach dem Ausklingen ab", () => {
    const { m, ctx } = starte();
    const alt = ctx.gains[0]!;
    m.setSong(BLUESROCK.id);
    expect(alt.getrennt).toBe(0); // sie klingt noch
    for (const f of fristen) f();
    expect(alt.getrennt).toBeGreaterThan(0);
  });

  it("spielt nach dem Wechsel das neue Stueck", () => {
    const { m, ctx } = starte();
    m.setSong(BLUESROCK.id);
    const vorher = ctx.quellen;
    ctx.currentTime += 2;
    for (const f of takte) f();
    expect(ctx.quellen).toBeGreaterThan(vorher);
  });

  it("bleibt still, wenn das Radio aus ist", () => {
    const { m, ctx } = starte();
    m.stop();
    const vorher = ctx.quellen;
    m.setSong(BLUESROCK.id);
    ctx.currentTime += 2;
    for (const f of takte) f();
    expect(ctx.quellen).toBe(vorher);
    expect(m.enabled).toBe(false);
    // Eingeschaltet laeuft dann der neue Sender
    m.start();
    for (const f of takte) f();
    expect(m.songId).toBe(BLUESROCK.id);
    expect(ctx.quellen).toBeGreaterThan(vorher);
  });

  it("nimmt nach einer echten Unterbrechung den Faden wieder auf", () => {
    const { m } = starte(BLUESROCK.id);
    const vorher = clearRufe;
    m.wiederaufnehmen();
    expect(clearRufe).toBeGreaterThan(vorher); // hier wird neu aufgesetzt
    expect(m.songId).toBe(BLUESROCK.id); // und zwar mit demselben Sender
  });
});

// ----------------------------------------------------------------- Das Menue

describe("Senderliste im Menue", () => {
  it("zeigt den laufenden Sender mit Zeichen UND Wort, nicht nur mit Farbe", () => {
    const liste = senderListe(SCHLAGER.id, true);
    const aktiv = liste.find((e) => e.gewaehlt)!;
    expect(aktiv.id).toBe(SCHLAGER.id);
    expect(aktiv.marke.trim().length).toBeGreaterThan(0);
    expect(aktiv.stand).toBe("läuft");
    for (const e of liste) {
      expect(e.titel).toContain(findeSender(e.id).sender);
      expect(e.beschreibung.length).toBeGreaterThan(0);
    }
  });

  it("sagt bei ausgeschaltetem Radio, dass der Sender still bleibt", () => {
    const liste = senderListe(BLUESROCK.id, false);
    const aktiv = liste.find((e) => e.gewaehlt)!;
    expect(aktiv.stand).toContain("aus");
    expect(senderAnsage(BLUESROCK, false)).toContain("aus");
    expect(senderAnsage(BLUESROCK, true)).toContain(BLUESROCK.sender);
  });

  it("markiert bei unbekannter Kennung den Standard", () => {
    const liste = senderListe("gibtsnicht", true);
    expect(liste.find((e) => e.gewaehlt)!.id).toBe(STANDARD_SENDER);
    expect(liste.filter((e) => e.gewaehlt).length).toBe(1);
  });
});
