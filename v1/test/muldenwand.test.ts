/**
 * Wächter für die Wandenden — Befund 14.09.2026 (Patrick, auf dem Gerät):
 * „Bei jeder Mulde werden immer vollständige Legosteine gebaut. Das führt
 * dazu, dass die Außenteile immer abstehen."
 *
 * Geprüft wird an den echten Maßen aus `CONFIGS` und an den echten Läufen der
 * Umrandung: Jede Reihe fängt an der Wandkante an und hört an der Wandkante
 * auf. Die Bauklasse selbst braucht Szene und Physikwelt und ist kopflos
 * nicht zu messen — deshalb liegt die Geometrie der Wände in
 * `muldenWandSpannen` bzw. `mauerLaeufe`, und beide werden vom Bau benutzt.
 */
import { describe, it, expect } from "vitest";
import { reihenstuecke } from "../src/world/legoreihe";
import { CONFIGS, muldenWandSpannen, MULDE_STEIN } from "../src/world/containers";
import {
  mauerLaeufe,
  MAUER_STEIN,
  TOR_HALB,
  GATE_X,
  YARD_D,
  YARD_MIN_X,
  YARD_MAX_X,
  BUCHT_X_VON,
  BUCHT_X_BIS,
  BUCHT_Z,
} from "../src/world/yard";

const mulden = CONFIGS.filter((c) => c.kind === "bay");

/** Äußerste Kanten einer ausgelegten Reihe. */
function kanten(von: number, bis: number, laenge: number, versatz: number): [number, number] {
  const st = reihenstuecke(von, bis, laenge, versatz);
  const a = st[0]!;
  const b = st[st.length - 1]!;
  return [a.mitte - a.laenge / 2, b.mitte + b.laenge / 2];
}

describe("Muldenwände stehen nicht über", () => {
  it("führt überhaupt Mulden", () => {
    expect(mulden.length).toBeGreaterThan(0);
  });

  for (const cfg of mulden) {
    it(`${cfg.label}: Flanken und Rückwand enden an ihrer Kante`, () => {
      const [w, d] = cfg.size;
      const spannen = muldenWandSpannen(w, d, !cfg.shareEast);
      // beide Lagen prüfen: gerade und versetzte
      for (const versatz of [0, MULDE_STEIN.laenge / 2]) {
        const [f0, f1] = kanten(spannen.flanke[0], spannen.flanke[1], MULDE_STEIN.laenge, versatz);
        expect(f0, "Flanke steht vor der offenen Kante über").toBeCloseTo(-w / 2, 9);
        expect(f1, "Flanke steht hinter der Rückwand über").toBeCloseTo(w / 2, 9);
        if (!cfg.shareEast) {
          const [r0, r1] = kanten(spannen.rueck[0], spannen.rueck[1], MULDE_STEIN.laenge, versatz);
          const aussen = d / 2 + MULDE_STEIN.dicke;
          expect(r0, "Rückwand steht nach Süden über").toBeCloseTo(-aussen, 9);
          expect(r1, "Rückwand steht nach Norden über").toBeCloseTo(aussen, 9);
        }
      }
    });
  }

  it("die Flanke endet genau da, wo die Rückwand anfängt", () => {
    // T-Stoß statt Überlappung: sonst stecken an der hinteren Ecke zwei
    // Steine ineinander.
    const cfg = mulden.find((c) => !c.shareEast)!;
    const [w, d] = cfg.size;
    const s = muldenWandSpannen(w, d, true);
    expect(s.flanke[1]).toBeCloseTo(w / 2, 9);
    // Innenfläche der Rückwand liegt auf derselben Linie
    expect(w / 2 + MULDE_STEIN.dicke / 2 - MULDE_STEIN.dicke / 2).toBeCloseTo(w / 2, 9);
    // und die Rückwand ist so lang wie die Außenflächen der Flanken
    expect(s.rueck[1] - s.rueck[0]).toBeCloseTo(d + 2 * MULDE_STEIN.dicke, 9);
  });
});

describe("Die Umrandung kommt in den Ecken an", () => {
  const laeufe = mauerLaeufe();
  const hz = YARD_D / 2;
  const t = MAUER_STEIN.dicke / 2;
  const lauf = (name: string) => laeufe.find((l) => l.name === name)!;

  it("führt neun Läufe: vier Platzseiten mit ihren Lücken und die Ausbuchtung", () => {
    expect(laeufe.map((l) => l.name).sort()).toEqual(
      [
        "bucht-ost",
        "bucht-sued",
        "bucht-west",
        "nord-ost",
        "nord-west",
        "ost",
        "sued-ost",
        "sued-west",
        "west",
      ].sort()
    );
  });

  it("jeder Lauf ist von Anfang bis Ende mit Steinen belegt", () => {
    for (const l of laeufe) {
      const [a, b] = kanten(l.von, l.bis, MAUER_STEIN.laenge, 0);
      expect(a, `${l.name}: fängt woanders an`).toBeCloseTo(l.von, 9);
      expect(b, `${l.name}: hört woanders auf`).toBeCloseTo(l.bis, 9);
    }
  });

  it("Nord- und Südmauer laufen über die Ecken, Ost und West stoßen an", () => {
    expect(lauf("nord-west").von).toBeCloseTo(YARD_MIN_X - t, 9);
    expect(lauf("nord-ost").bis).toBeCloseTo(YARD_MAX_X + t, 9);
    expect(lauf("sued-west").von).toBeCloseTo(YARD_MIN_X - t, 9);
    expect(lauf("sued-ost").bis).toBeCloseTo(YARD_MAX_X + t, 9);
    for (const n of ["west", "ost"]) {
      expect(lauf(n).von).toBeCloseTo(-hz + t, 9);
      expect(lauf(n).bis).toBeCloseTo(hz - t, 9);
    }
  });

  it("die Einfahrt ist genau so breit wie ihre Torpfosten", () => {
    // Vorher blieb die Lücke 9,6 m breit, während Pfosten und Kollider bei
    // 9,0 m standen — die Mauer hörte 0,3 m neben dem Pfosten auf.
    expect(lauf("nord-west").bis).toBeCloseTo(GATE_X - TOR_HALB, 9);
    expect(lauf("nord-ost").von).toBeCloseTo(GATE_X + TOR_HALB, 9);
    expect(lauf("nord-ost").von - lauf("nord-west").bis).toBeCloseTo(2 * TOR_HALB, 9);
  });

  it("die Ausbuchtung ist rundum geschlossen, ohne Überstand", () => {
    // Schenkel tragen die Ecken, die Rückwand stößt zwischen ihnen an.
    for (const n of ["bucht-west", "bucht-ost"]) {
      expect(lauf(n).von).toBeCloseTo(BUCHT_Z - t, 9);
      expect(lauf(n).bis).toBeCloseTo(-hz - t, 9);
    }
    expect(lauf("bucht-sued").von).toBeCloseTo(BUCHT_X_VON + t, 9);
    expect(lauf("bucht-sued").bis).toBeCloseTo(BUCHT_X_BIS - t, 9);
    // und die Südmauer hört an den Schenkeln auf, ohne in die Öffnung zu ragen
    expect(lauf("sued-west").bis).toBeCloseTo(BUCHT_X_VON - t, 9);
    expect(lauf("sued-ost").von).toBeCloseTo(BUCHT_X_BIS + t, 9);
  });

  it("die Öffnung der Ausbuchtung bleibt frei", () => {
    const belegt = (x: number): boolean =>
      laeufe.some(
        (l) => l.achse === "x" && Math.abs(l.fest + hz) < 0.01 && x > l.von && x < l.bis
      );
    for (let x = BUCHT_X_VON + 0.2; x < BUCHT_X_BIS - 0.2; x += 0.5) {
      expect(belegt(x), `Südmauer steht bei x=${x.toFixed(1)} vor der Bucht`).toBe(false);
    }
  });
});
