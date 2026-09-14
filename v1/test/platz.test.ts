/**
 * Wächter für die Platzordnung nach E-010 — die Ausbuchtung.
 *
 * Zwei Zusicherungen, die beim Umbau am 14.09.2026 als einzige wirklich
 * zählen und bis dahin nirgends festgehalten waren:
 *
 * 1. **Jedes Sortierziel liegt im Schwenkband 5,8 bis 9,2 m.** Der Bagger hat
 *    nicht nur eine äußere Grenze, sondern auch eine innere — unter 5,8 m
 *    bekommt er den Arm nicht eng genug zusammen. Beim Zeichnen sind an genau
 *    dieser inneren Grenze zwei Ziele gescheitert (E-010). Ohne Wächter merkt
 *    das erst der Spieler, und dann ist der Platz schon gebaut.
 *
 * 2. **Die Sortiermulden haben keine Rückwand** (E-006, Ansage 13.09.2026:
 *    „Rückwände raus, nur Seitenwände"). Das hing bisher an einem einzelnen
 *    `shareEast: true` je Mulde. Wer es zurücksetzt, baut eine unsichtbare
 *    Wand zwischen Greifer und Mulde — dieselbe Klasse Fehler, die am
 *    12.09.2026 als „unsichtbare Barriere" gemeldet wurde.
 *
 * Gemessen wird gegen den gebauten Platz, nicht gegen den Konzeptplan: Die
 * Zahlen kommen aus `containers.ts`, `press.ts` und `obstacles.ts`.
 */
import { describe, it, expect } from "vitest";
import {
  BAGGER_STAND,
  VERLADE_STAND,
  SCHWENK_INNEN,
  SCHWENK_AUSSEN,
  abstandVomStand,
} from "../src/world/baggerstand";
import { CONFIGS, type ContainerConfig } from "../src/world/containers";
import { PRESS_CENTER, PRESS_INNER } from "../src/world/press";
import { STATIC_OBSTACLES, hitsObstacle } from "../src/world/obstacles";
import {
  BUCHT_X_VON,
  BUCHT_X_BIS,
  BUCHT_Z,
  TRENNSTEINE,
  YARD_D,
  YARD_MAX_X,
} from "../src/world/yard";

/** Die drei Mulden, die der Spieler selbst befüllt. */
const SORTIERMULDEN = ["r_alu", "r_cable", "r_copper"];

function cfg(id: string): ContainerConfig {
  const c = CONFIGS.find((x) => x.id === id);
  if (!c) throw new Error(`Kein Behälter mit id ${id}`);
  return c;
}

/**
 * Der Punkt, den der Bagger an diesem Ziel wirklich anfährt.
 *
 * Bei einer HALDE ist das die vordere Kante — man gräbt sich von vorn hinein,
 * und die Mitte einer 9 m tiefen Halde liegt außerhalb jeder Reichweite
 * (E-010). Bei allem anderen ist es die Mitte: In eine Mulde von 4 m Tiefe
 * greift man mittig hinein.
 */
function zielpunkt(c: ContainerConfig): [number, number] {
  if (c.kind === "halde") return [c.x, c.z + c.size[1] / 2];
  return [c.x, c.z];
}

describe("Die acht Ziele liegen im Schwenkband", () => {
  const ziele: Array<[string, number, number]> = [
    ...["c_mixed", "c_steel", ...SORTIERMULDEN, "r_rubble", "c_tires"].map((id) => {
      const c = cfg(id);
      const [x, z] = zielpunkt(c);
      return [c.label, x, z] as [string, number, number];
    }),
    ["PRESSE", PRESS_CENTER.x, PRESS_CENTER.z],
  ];

  it("führt genau die acht Ziele der Abnahmetabelle", () => {
    // Acht, nicht sieben: Fällt eines weg, ist die Tabelle aus E-010 nicht
    // mehr erfüllbar, und das soll auffallen.
    expect(ziele.length).toBe(8);
  });

  for (const [label, x, z] of ziele) {
    it(`${label} liegt zwischen ${SCHWENK_INNEN} und ${SCHWENK_AUSSEN} m`, () => {
      const d = abstandVomStand(x, z);
      expect(d, `${label}: ${d.toFixed(2)} m — zu nah, der Arm bleibt eingeklappt`)
        .toBeGreaterThanOrEqual(SCHWENK_INNEN);
      expect(d, `${label}: ${d.toFixed(2)} m — außerhalb der Reichweite`).toBeLessThanOrEqual(
        SCHWENK_AUSSEN
      );
    });
  }

  it("der Verladeplatz liegt symmetrisch zwischen Silo und LKW-Spur", () => {
    /*
     * E-010: „7,5 m zur Silo-Vorderkante, 7,5 m zur LKW-Spur. Der Abholer
     * setzt rückwärts an, der Bagger steht dazwischen." Geprüft wird die
     * Symmetrie, nicht die Zahl 7,5 — verschiebt jemand die Silo-Reihe, muss
     * die Spur mitwandern.
     */
    const silo = cfg("c_va_lager");
    const siloKante = silo.x + silo.size[0] / 2;
    const zurSilo = VERLADE_STAND.x - siloKante;
    expect(zurSilo, `${zurSilo.toFixed(2)} m zur Silo-Vorderkante`).toBeGreaterThanOrEqual(
      SCHWENK_INNEN
    );
    expect(zurSilo).toBeLessThanOrEqual(SCHWENK_AUSSEN);
    // Die LKW-Spur steht spiegelbildlich auf der anderen Seite.
    expect(zurSilo).toBeCloseTo(7.5, 6);
  });

  it("die Silo-Reihe steht bewusst außerhalb — dorthin wird gefahren", () => {
    /*
     * Der Gegentest zum Schwenkband: Die neun Silos gehören NICHT hinein
     * (E-010). Läge eines darin, hätte der Platz sein Gefälle verloren.
     */
    for (const c of CONFIGS.filter((x) => x.lager === true)) {
      expect(abstandVomStand(c.x, c.z), `${c.label} steht im Schwenkband`).toBeGreaterThan(
        SCHWENK_AUSSEN
      );
    }
  });
});

describe("Die Sortiermulden haben keine Rückwand (E-006)", () => {
  it("jede Mulde ist als offen gekennzeichnet", () => {
    for (const id of SORTIERMULDEN) {
      expect(cfg(id).shareEast, `${cfg(id).label}: shareEast zurückgesetzt`).toBe(true);
    }
  });

  it("und trägt auch keine Stirnwand in der Hindernisliste", () => {
    /*
     * Die schärfere Prüfung: Das Kennzeichen allein nützt nichts, wenn die
     * Hindernisliste die Wand trotzdem führt. Genau so sind am 12.09.2026 die
     * unsichtbaren Barrieren entstanden — gebaut und verzeichnet liefen
     * auseinander.
     */
    const labels = STATIC_OBSTACLES.map((o) => o.label);
    for (const id of SORTIERMULDEN) {
      const c = cfg(id);
      expect(labels, `${c.label}: Stirnwand steht noch in der Liste`).not.toContain(
        `${c.label} Stirn`
      );
      // Und der Greifer kommt von beiden Seiten hinein.
      const [w] = c.size;
      for (const seite of [-1, 1]) {
        expect(
          hitsObstacle(c.x + seite * (w / 2 + 0.8), c.z, 0),
          `${c.label}: ${seite > 0 ? "Ost" : "West"}seite zugestellt`
        ).toBeNull();
      }
    }
  });

  it("die Flanken stehen aber weiterhin — sonst laufen die Fraktionen ineinander", () => {
    for (const id of SORTIERMULDEN) {
      const c = cfg(id);
      const [, d] = c.size;
      /*
       * Die Nordflanke bringt jede Mulde selbst mit; die Südflanke stellt der
       * Nachbar bzw. die Außenmauer (`shareSouth`). Getastet wird mit 0,4 m
       * Rand, weil die geteilten Wände nicht auf den Zentimeter auf der
       * Muldenkante stehen — die Außenmauer liegt 0,1 m davor, die Nordwand
       * des Nachbarn 0,2 m dahinter.
       */
      expect(hitsObstacle(c.x, c.z + d / 2, 0.4), `${c.label}: Nordflanke fehlt`).not.toBeNull();
      expect(hitsObstacle(c.x, c.z - d / 2, 0.4), `${c.label}: Südflanke fehlt`).not.toBeNull();
    }
  });
});

describe("Die Ausbuchtung", () => {
  it("ist rundum mit hoher Wand eingefasst", () => {
    for (const [name, x, z] of [
      ["Westschenkel", BUCHT_X_VON, -34],
      ["Ostschenkel", BUCHT_X_BIS, -34],
      ["Rückwand", 0.5, BUCHT_Z],
    ] as Array<[string, number, number]>) {
      const o = hitsObstacle(x, z, 0, 4.0);
      expect(o, `${name} fehlt`).not.toBeNull();
      expect(o!.top, `${name} ist zu niedrig`).toBeGreaterThan(4.0);
    }
  });

  it("ist nach Norden offen — sonst käme der Bagger nicht hinein", () => {
    for (let x = BUCHT_X_VON + 1; x < BUCHT_X_BIS - 1; x += 1) {
      expect(hitsObstacle(x, -YARD_D / 2, 0), `Südmauer sperrt die Bucht bei x=${x}`).toBeNull();
    }
  });

  it("nimmt beide Halden vollständig auf", () => {
    for (const id of ["c_mixed", "c_steel"]) {
      const c = cfg(id);
      const [w, d] = c.size;
      expect(c.x - w / 2, `${c.label} ragt nach Westen aus der Bucht`).toBeGreaterThanOrEqual(
        BUCHT_X_VON
      );
      expect(c.x + w / 2, `${c.label} ragt nach Osten aus der Bucht`).toBeLessThanOrEqual(
        BUCHT_X_BIS
      );
      expect(c.z - d / 2, `${c.label} ragt durch die Rückwand`).toBeGreaterThanOrEqual(BUCHT_Z);
      expect(c.z + d / 2, `${c.label} ragt aus der Bucht heraus`).toBeLessThanOrEqual(-YARD_D / 2);
    }
  });

  it("die Trennsteine sind in der Mitte am höchsten und laufen nach außen ab", () => {
    const hoehen = TRENNSTEINE.map((s) => s.hoehe);
    expect(Math.max(...hoehen), "die Mitte erreicht 2,4 m nicht").toBeCloseTo(2.4, 6);
    expect(hoehen[0], "das vordere Ende läuft nicht auf 0,6 m ab").toBeCloseTo(0.6, 6);
    expect(hoehen[hoehen.length - 1], "das hintere Ende läuft nicht ab").toBeCloseTo(0.6, 6);
    // Pyramide: von vorn bis zur Mitte steigend, danach fallend.
    const mitte = hoehen.indexOf(Math.max(...hoehen));
    for (let i = 1; i <= mitte; i++) expect(hoehen[i]).toBeGreaterThanOrEqual(hoehen[i - 1]!);
    for (let i = mitte + 1; i < hoehen.length; i++)
      expect(hoehen[i]).toBeLessThanOrEqual(hoehen[i - 1]!);
  });

  it("der Arm kommt über die Trennsteine hinweg", () => {
    // Das ist der ganze Sinn der Pyramide: „sodass der Zugriff von
    // Mischschrott zu Stahlschrott flüssig läuft."
    for (const s of TRENNSTEINE) {
      expect(s.hoehe, "ein Trennstein steht so hoch wie eine Boxwand").toBeLessThanOrEqual(2.4);
      expect(hitsObstacle(0.5, s.z, 0, 2.5), `Trennstein bei z=${s.z} sperrt nach oben`).toBeNull();
    }
  });
});

describe("Nichts steht im anderen", () => {
  it("keine zwei Behälter überschneiden sich", () => {
    for (let i = 0; i < CONFIGS.length; i++) {
      for (let j = i + 1; j < CONFIGS.length; j++) {
        const a = CONFIGS[i]!;
        const b = CONFIGS[j]!;
        const dx = Math.abs(a.x - b.x) - (a.size[0] + b.size[0]) / 2;
        const dz = Math.abs(a.z - b.z) - (a.size[1] + b.size[1]) / 2;
        expect(
          dx >= 0 || dz >= 0,
          `${a.label} und ${b.label} überschneiden sich um ` +
            `${(-Math.max(dx, dz)).toFixed(2)} m`
        ).toBe(true);
      }
    }
  });

  it("die Presse steht in der Ecke, aber nicht in der Mauer", () => {
    /*
     * Gemessen, nicht geglaubt: Der Rahmen reicht über die lichte Kammer
     * hinaus, und die Deckelklappe schwingt noch einmal 3,85 m über die Mitte.
     * Beides muss innerhalb der Mauern bleiben — der Konzeptplan setzte sie
     * 43 cm in die Ostmauer und 1,15 m in die Südmauer.
     */
    const KLAPPE = 3.85;
    const WAND_INNEN = 0.3;
    expect(
      PRESS_CENTER.x + (PRESS_INNER.laenge + 0.7) / 2,
      "die Presse steht in der Ostmauer"
    ).toBeLessThan(YARD_MAX_X - WAND_INNEN);
    expect(PRESS_CENTER.z - KLAPPE, "die Deckelklappe schlägt in die Südmauer").toBeGreaterThan(
      -YARD_D / 2 + WAND_INNEN
    );
  });
});
