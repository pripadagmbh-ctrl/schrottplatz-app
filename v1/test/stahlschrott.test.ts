/**
 * Die Stahlschrott-Regel — Wächter über den Vorschlag vom 15.09.2026 (E-042).
 *
 * Die Regel steht in `tools/stahlschrott.ts` und ändert das Spiel noch nicht.
 * Sie wird trotzdem hier bewacht, weil sie die **Vorlage** für den Umbau ist:
 * Wer die Zahlen später nach `src/materials/` holt, muss dieselben Stücke auf
 * denselben Seiten wiederfinden. Anders gesagt — diese Datei ist der
 * schriftliche Teil der Absprache, nicht der Test einer Spielmechanik.
 *
 * Patricks Ansage, wörtlich:
 *
 * > „Ich möchte ein bisschen strenger werden, was Stahlschrott ist. Das ist
 * > halt so das Premium. Es geht da eher so um Bahnschwellen, Bremsscheiben,
 * > Träger — das ist so wirklich ganz gutes Material. Auch bei so Gitterboxen
 * > bin ich mir nicht sicher, ob das dann wirklich Stahlschrott ist."
 */
import { describe, it, expect } from "vitest";
import {
  alleEintraege,
  alleUrteile,
  aussenflaeche,
  huellVolumen,
  urteile,
  wandstaerkeMm,
  STAHL_KG_M3,
  VERBUND_BIS,
  WAND_AB_MM,
} from "../tools/stahlschrott";
import type { PileSpec } from "../src/world/objektkatalog";

const alle = alleUrteile();

function stueck(name: string) {
  const u = alle.find((x) => x.spec.name === name);
  if (!u) throw new Error(`Katalogeintrag „${name}" nicht gefunden`);
  return u;
}

describe("Das Maß: rechnerische Wandstärke", () => {
  it("rechnet die Fläche eines Würfels richtig", () => {
    expect(aussenflaeche("box", [1, 1, 1])).toBeCloseTo(6, 6);
    expect(huellVolumen("box", [1, 1, 1])).toBeCloseTo(1, 6);
  });

  it("gibt für einen Vollstahl-Würfel ein Sechstel der Kante zurück", () => {
    // Ein Würfel von 0,30 m Kante aus Vollstahl wiegt 7850 × 0,027 = 212 kg.
    // Über 6 × 0,09 m² Fläche verteilt sind das 0,30/6 = 50 mm.
    const wuerfel: PileSpec = {
      materialId: "steel",
      massKg: STAHL_KG_M3 * 0.027,
      kind: "box",
      dims: [0.3, 0.3, 0.3],
    };
    expect(wandstaerkeMm(wuerfel)).toBeCloseTo(50, 6);
  });

  it("trifft bei Rohrform den Mantel plus die beiden Deckel", () => {
    // r = 0,5 m, l = 1 m → 2π·0,5·1 + 2π·0,25 = π + 0,5π = 4,712 m².
    expect(aussenflaeche("cyl", [0.5, 1])).toBeCloseTo(Math.PI * 1.5, 6);
  });

  it("misst Herdblech als Herdblech und einen Träger als Träger", () => {
    // Gegenprobe an der Wirklichkeit: Herdblech ist rund 1 mm dick, der Steg
    // eines IPE 280 ist 6,5 mm dick. Beides kommt aus Masse und Maß heraus,
    // ohne dass es jemand eingetragen hat.
    expect(stueck("Elektroherd").wand).toBeGreaterThan(1.0);
    expect(stueck("Elektroherd").wand).toBeLessThan(2.0);
    expect(stueck("Doppel-T-Träger").wand).toBeGreaterThan(6.0);
    expect(stueck("Doppel-T-Träger").wand).toBeLessThan(8.0);
  });
});

describe("Die Regel", () => {
  it("nimmt Patricks Premium-Beispiele auf", () => {
    // „Es geht da eher so um Bahnschwellen, Bremsscheiben, Träger."
    // Bahnschwellen liegen im Katalog nur als Beton und Holz; das Nächste am
    // Bahnkörper ist das Schienenbündel.
    for (const name of ["Doppel-T-Träger", "Schienenbündel", "Profilstahl", "LKW-Achse"]) {
      expect(stueck(name).neu, name).toBe("steel");
    }
  });

  it("wirft Dünnblech heraus, so schwer es auch ist", () => {
    // „Ein Elektroherd, das ist vor allem Blechschrott. Das ist nicht massiv."
    for (const name of ["Elektroherd", "Blech", "Blechtafel", "Badewanne", "Seecontainer 20 Fuß"]) {
      expect(stueck(name).neu, name).toBe("mixed");
    }
  });

  it("antwortet auf die Gitterbox: Mischschrott, mit 3,0 mm", () => {
    const box = stueck("Gitterbox");
    expect(box.wand).toBeLessThan(WAND_AB_MM);
    expect(box.heute).toBe("steel");
    expect(box.neu).toBe("mixed");
  });

  it("räumt den Widerspruch Elektroherd / Einbauherd weg", () => {
    // Der Befund aus `docs/fraktionen.md`: derselbe Küchenherd, zwei Mulden,
    // nur weil an einem Eintrag eine Stückliste steht und am anderen nicht.
    expect(stueck("Elektroherd").heute).not.toBe(stueck("Einbauherd mit Umluftofen").heute);
    expect(stueck("Elektroherd").neu).toBe(stueck("Einbauherd mit Umluftofen").neu);
  });

  it("räumt den Widerspruch Seecontainer / Baustellencontainer weg", () => {
    // Die beiden mit gemessenem Farbabstand 0,00 (`docs/fraktionen.md`, 2.3)
    // landeten in zwei verschiedenen Mulden. Jetzt nicht mehr.
    expect(stueck("Seecontainer 20 Fuß").heute).not.toBe(stueck("Baustellencontainer").heute);
    expect(stueck("Seecontainer 20 Fuß").neu).toBe(stueck("Baustellencontainer").neu);
  });

  it("lässt ein Stück Premium sein, an dem noch etwas dranhängt", () => {
    // „Natürlich hast du mal Tanks, wo dann noch was dran ist."
    const tank: PileSpec = {
      materialId: "steel",
      massKg: 900,
      kind: "cyl",
      dims: [0.8, 3.0],
      zusammensetzung: [
        { materialId: "steel", anteil: 0.92 },
        { materialId: "plastic", anteil: 0.08 },
      ],
    };
    expect(urteile(tank).wand).toBeGreaterThan(WAND_AB_MM);
    expect(urteile(tank).heute).toBe("mixed"); // 8 % reissen die alten 5 %
    expect(urteile(tank).neu).toBe("steel");
  });

  it("wirft echten Verbund heraus, auch wenn er dickwandig ist", () => {
    const motor = stueck("Motorblock-Rest"); // 18 % Alu und Kupfer
    expect(motor.wand).toBeGreaterThan(WAND_AB_MM);
    expect(motor.fremd).toBeGreaterThan(VERBUND_BIS);
    expect(motor.neu).toBe("mixed");
  });

  it("fasst Buntmetall, VA und Abfall nicht an", () => {
    for (const u of alle) {
      if (u.grund !== "kein-stahl") continue;
      expect(u.neu, u.spec.name ?? u.spec.materialId).toBe(u.heute);
    }
  });

  it("macht aus keinem Nicht-Stahl plötzlich Stahlschrott", () => {
    for (const u of alle) {
      if (u.neu === "steel") expect(u.spec.materialId === "steel" || u.heute === "mixed").toBe(true);
    }
  });
});

describe("Der Katalog, den die Regel liest", () => {
  it("findet auch die nicht exportierten Listen", () => {
    const eintraege = alleEintraege();
    const listen = new Set(eintraege.map((e) => e.liste));
    expect(listen.has("BIG_SPECS")).toBe(true);
    expect(listen.has("HUGE_SPECS")).toBe(true);
    // Mehr als die 271 der Bestandsaufnahme, weil BIG_SPECS und HUGE_SPECS
    // dort fehlten (`docs/fraktionen.md`, 1.1).
    expect(eintraege.length).toBeGreaterThan(271);
  });

  it("wird strenger, nicht lockerer", () => {
    const heute = alle.filter((u) => u.heute === "steel").length;
    const neu = alle.filter((u) => u.neu === "steel").length;
    expect(neu).toBeLessThan(heute);
  });
});
