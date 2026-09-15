/**
 * WÄCHTER FÜR DIE KUNDENFIGUR — vor allem für ihren Preis.
 *
 * Das ist derselbe Wächter wie `test/fahrer.test.ts` für den Baggerfahrer
 * Daniel, aus demselben Grund. Gemessen auf Patricks Gerät am 14.09.2026:
 * **1322 Zeichenrufe, 240.000 Dreiecke, 21,0 ms je Bild.** Dreiecke sind fast
 * gratis, Netze sind der Engpass — und jedes schattenwerfende Netz wird
 * zweimal gezeichnet.
 *
 * Die Figur, die aus dem Wagen steigt, hatte vorher **neun** Netze
 * (`buildPerson`) plus den Kaffeebecher, alle mit Schatten: 20 Zeichenrufe.
 * Jetzt sind es zwei, davon eines mit Schatten: **drei**. Wer der Figur ein
 * Merkmal als eigenes Netz anhängt — eine Kette, eine Mütze, eine Uhr —,
 * macht das rückgängig, ohne dass es am Bildschirm auffiele. Deshalb steht
 * hier eine Zahl und keine Beschreibung.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { baueKundenfigur, baueHund } from "../src/world/kundenfigur";
import { MERKMALE, AUSSEHEN_NEUTRAL, type Aussehen } from "../src/delivery/aussehen";
import { alleKunden } from "../src/delivery/customers";

function netze(o: THREE.Object3D): THREE.Mesh[] {
  const raus: THREE.Mesh[] = [];
  o.traverse((x) => {
    if (x instanceof THREE.Mesh) raus.push(x);
  });
  return raus;
}

function ecken(o: THREE.Object3D): number {
  return netze(o).reduce((s, m) => s + m.geometry.getAttribute("position").count, 0);
}

function mit(over: Partial<Aussehen>): Aussehen {
  return { ...AUSSEHEN_NEUTRAL, ...over };
}

describe("Der Preis der Figur", () => {
  it("jede Figur besteht aus genau zwei Netzen — egal welches Merkmal sie trägt", () => {
    for (const m of MERKMALE) {
      const f = baueKundenfigur(mit({ merkmal: m, weste: true }));
      expect(
        netze(f.group)
          .map((x) => x.name)
          .sort(),
        `Merkmal "${m}" — vorher waren es neun`
      ).toEqual(["KUNDE_HAUT", "KUNDE_KLEIDUNG"]);
      f.dispose();
    }
  });

  it("die Warnweste kostet kein zusätzliches Netz", () => {
    const ohne = baueKundenfigur(mit({ weste: false }));
    const mitWeste = baueKundenfigur(mit({ weste: true }));
    expect(netze(ohne.group).length).toBe(2);
    expect(netze(mitWeste.group).length).toBe(2);
    // … sie kostet Eckpunkte, und das ist richtig so
    expect(ecken(mitWeste.group), "die Weste ist unsichtbar").toBeGreaterThan(ecken(ohne.group));
    ohne.dispose();
    mitWeste.dispose();
  });

  it("nur die Kleidung wirft Schatten", () => {
    /*
     * Der Kopf steckt in der Silhouette von Haar und Schultern; sein Schatten
     * wäre nicht zu unterscheiden, kostete aber einen zweiten Zeichenruf.
     * Vorher warfen alle neun Teile Schatten.
     */
    const f = baueKundenfigur(AUSSEHEN_NEUTRAL);
    for (const m of netze(f.group)) {
      expect(m.castShadow, m.name).toBe(m.name.endsWith("_KLEIDUNG"));
    }
    f.dispose();
  });

  it("die Kleidung trägt ihre Farben an den Ecken, nicht am Material", () => {
    /*
     * Jacke, Hose, Stiefel, Haar, Warnorange, Reflex und Merkmal — sieben
     * Farben in EINEM Netz. Das geht nur über `vertexColors`. Fehlt das
     * Attribut, ist die Figur einfarbig weiß; fehlt das Materialflag, ist sie
     * einfarbig orange.
     */
    const f = baueKundenfigur(mit({ weste: true, merkmal: "goldkette" }));
    const k = f.kleidung;
    expect(k.geometry.getAttribute("color"), "Eckfarben fehlen").toBeDefined();
    const mat = k.material as THREE.MeshStandardMaterial;
    expect(mat.vertexColors, "Material liest die Eckfarben nicht").toBe(true);
    expect(mat.color.getHex(), "Material muss weiß sein, sonst färbt es alles ein").toBe(0xffffff);
    const a = k.geometry.getAttribute("color") as THREE.BufferAttribute;
    const farben = new Set<string>();
    for (let i = 0; i < a.count; i++) {
      farben.add(`${a.getX(i).toFixed(3)},${a.getY(i).toFixed(3)},${a.getZ(i).toFixed(3)}`);
    }
    expect(farben.size, "Zahl der Farben an der Kleidung").toBeGreaterThanOrEqual(5);
    f.dispose();
  });

  it("keine Figur wird größer als ein knappes Tausend Eckpunkte", () => {
    /*
     * Eine Obergrenze, kein Ziel. Sie steht hier, damit niemand die
     * Netzgrenze umgeht, indem er das eine Netz mit Kugeln vollpackt: Ein
     * Merkmal aus einer `SphereGeometry(32, 32)` wäre allein über 1000
     * Eckpunkte. SW, gemessen an der teuersten Ausführung (Weste + Kette).
     */
    for (const m of MERKMALE) {
      const f = baueKundenfigur(mit({ merkmal: m, weste: true }));
      expect(ecken(f.group), `Merkmal "${m}"`).toBeLessThan(1000);
      f.dispose();
    }
  });
});

describe("Verschiedene Statur ist derselbe Bau mit anderen Maßen", () => {
  /** Höhe und Breite der Kleidung, wie die Kamera sie sieht. */
  function mass(a: Aussehen): { hoch: number; breit: number; ecken: number } {
    const f = baueKundenfigur(a);
    const bb = new THREE.Box3().setFromObject(f.group);
    const r = { hoch: bb.max.y - bb.min.y, breit: bb.max.x - bb.min.x, ecken: ecken(f.group) };
    f.dispose();
    return r;
  }

  it("der Lange ist wirklich länger als der Kleine", () => {
    const klein = mass(mit({ groesse: 1.58 }));
    const lang = mass(mit({ groesse: 1.92 }));
    expect(lang.hoch - klein.hoch, "34 cm Unterschied").toBeGreaterThan(0.3);
  });

  it("die Figur steht auf dem Boden und reicht bis zum Scheitel", () => {
    /*
     * `buildPerson` liess die Stiefel 25 cm ÜBER dem Boden anfangen (Beine ab
     * y = 0,255) — im Spiel fiel das nie auf, weil alle Figuren gleich
     * schwebten. Hier ist der Ursprung die Sohle, und die Körperhöhe ist die
     * Körperhöhe.
     */
    for (const h of [1.58, 1.78, 1.92]) {
      const f = baueKundenfigur(mit({ groesse: h }));
      const bb = new THREE.Box3().setFromObject(f.group);
      expect(bb.min.y, `Sohle bei ${h} m`).toBeCloseTo(0, 2);
      expect(bb.max.y, `Scheitel bei ${h} m`).toBeGreaterThan(h - 0.06);
      expect(bb.max.y, `Scheitel bei ${h} m`).toBeLessThan(h + 0.06);
      f.dispose();
    }
  });

  it("der Dicke ist breiter, ohne größer zu werden", () => {
    const duenn = mass(mit({ fuelle: 0, groesse: 1.78 }));
    const dick = mass(mit({ fuelle: 1, groesse: 1.78 }));
    expect(dick.breit - duenn.breit, "Fülle wirkt in die Breite").toBeGreaterThan(0.1);
    expect(Math.abs(dick.hoch - duenn.hoch), "aber nicht in die Höhe").toBeLessThan(0.02);
  });

  it("es ist derselbe Bau: gleiche Zahl Eckpunkte in jeder Statur", () => {
    /*
     * DAS IST DER EIGENTLICHE PUNKT DIESER DATEI. „Verschiedene Statur heißt
     * andere Maße am selben Bau, nicht ein zweiter Bau." Wer für den Dicken
     * eine eigene Teileliste schreibt, fällt hier auf — die Eckpunktzahl wäre
     * eine andere.
     */
    const a = mass(mit({ groesse: 1.58, fuelle: 1, pflege: 0 }));
    const b = mass(mit({ groesse: 1.92, fuelle: 0, pflege: 1 }));
    expect(a.ecken).toBe(b.ecken);
  });

  it("ölig heißt dunkler, nicht anders gebaut", () => {
    const sauber = baueKundenfigur(mit({ pflege: 1 }));
    const oelig = baueKundenfigur(mit({ pflege: 0 }));
    expect(ecken(oelig.group), "gleiche Form").toBe(ecken(sauber.group));
    const hell = (m: THREE.Mesh): number => {
      const a = m.geometry.getAttribute("color") as THREE.BufferAttribute;
      let s = 0;
      for (let i = 0; i < a.count; i++) s += a.getX(i) + a.getY(i) + a.getZ(i);
      return s / a.count;
    };
    expect(hell(oelig.kleidung), "der Ölige ist nicht dunkler").toBeLessThan(
      hell(sauber.kleidung)
    );
    sauber.dispose();
    oelig.dispose();
  });
});

describe("Der Hund", () => {
  it("kostet genau ein Netz und wirft keinen Schatten", () => {
    const h = baueHund(mit({ merkmal: "hund" }))!;
    expect(h, "kein Hund gebaut").toBeTruthy();
    expect(netze(h).length, "mehr als ein Netz").toBe(1);
    expect(h.castShadow, "er sitzt im getönten Fahrerhaus").toBe(false);
    expect(h.geometry.getAttribute("position").count, "Eckpunkte").toBeLessThan(400);
  });

  it("gibt es nur, wo er im Datensatz steht", () => {
    for (const m of MERKMALE) {
      const h = baueHund(mit({ merkmal: m }));
      expect(h === null, `Merkmal "${m}"`).toBe(m !== "hund");
    }
  });

  it("er hängt nicht an der Figur — die Figur bleibt zwei Netze", () => {
    const f = baueKundenfigur(mit({ merkmal: "hund" }));
    expect(netze(f.group).length).toBe(2);
    f.dispose();
  });
});

describe("Jeder Kunde lässt sich bauen", () => {
  it("alle 23 kommen als zwei Netze heraus, und sie sehen verschieden aus", () => {
    const umrisse = new Set<string>();
    let eckenSumme = 0;
    for (const k of alleKunden()) {
      const f = baueKundenfigur(k.aussehen);
      expect(netze(f.group).length, k.name).toBe(2);
      const bb = new THREE.Box3().setFromObject(f.group);
      umrisse.add(`${(bb.max.y - bb.min.y).toFixed(3)}/${(bb.max.x - bb.min.x).toFixed(3)}`);
      eckenSumme += ecken(f.group);
      f.dispose();
    }
    /*
     * Wenn die Figur das Aussehen nicht wirklich läse, käme 23-mal derselbe
     * Umriss heraus — genau der Zustand von vor dem 15.09.2026.
     */
    expect(umrisse.size, "zu viele Kunden sehen gleich aus").toBeGreaterThanOrEqual(20);
    // Fürs Protokoll im Log: mittlere Eckpunktzahl je Figur
    expect(Math.round(eckenSumme / 23), "mittlere Eckpunkte je Figur").toBeLessThan(900);
  });

  it("drei gleichzeitig anwesende Figuren sind sechs Netze und drei Schatten", () => {
    /*
     * Der Fall, nach dem gefragt wurde: Auf dem Platz stehen höchstens drei
     * Wagen (`PARK_SLOTS`), also höchstens drei Fahrer an der Theke.
     */
    const drei = alleKunden()
      .slice(0, 3)
      .map((k) => baueKundenfigur(k.aussehen));
    const alle = drei.flatMap((f) => netze(f.group));
    expect(alle.length, "Netze").toBe(6);
    expect(alle.filter((m) => m.castShadow).length, "davon mit Schatten").toBe(3);
    // 6 + 3 = 9 Zeichenrufe. Mit `buildPerson` waren es 3 × 20 = 60.
    expect(alle.length + alle.filter((m) => m.castShadow).length).toBe(9);
    for (const f of drei) f.dispose();
  });
});
