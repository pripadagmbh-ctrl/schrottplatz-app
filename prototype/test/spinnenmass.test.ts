/**
 * Wächter für das Mindestmaß jedes Behälters: die offene Spinne muss hinein.
 *
 * Befund 12.09.2026: „bei Presse kam ich nicht an Boden" und „Container und
 * Presse müssen mindestens so groß sein, dass ich mit der Spinne reinfassen
 * kann."
 *
 * Gemessen ist der Greifer offen 3,38 m breit. Die Presskammer war 3,20 m
 * tief, die Absetzcontainer 2,30 m — der Greifer setzte auf den Rändern auf,
 * bevor er unten war. Befüllen ging dadurch noch (man lässt von oben fallen),
 * Ausräumen nicht mehr. Ein Behälter, den man nicht leeren kann, ist eine
 * Sackgasse: Das Material ist drin und kommt nie wieder heraus.
 *
 * Der Test prüft die Eigenschaft, nicht die Zahl — ändert sich die Armgeometrie,
 * ändert sich das Mindestmaß mit.
 */
import { describe, it, expect } from "vitest";
import { clawSpan, CLAW_OPEN_SPLAY } from "../src/excavator/clawGeometry";
import { CONFIGS } from "../src/world/containers";
import { PRESS_INNER } from "../src/world/press";

/** Luft, die der Greifer beidseits braucht — die Arme sind nicht dünn. */
const LUFT = 0.3;
/**
 * Wandstärke, die vom Außenmaß abgeht.
 *
 * `size` ist das Außenmaß; die Bordwände nehmen davon etwas weg. Nachgemessen
 * an den echten Kollidern eines Absetzcontainers: 4,20 m außen ergeben 4,08 m
 * lichte Weite. Ohne diesen Abzug hätte der Test 4,00 m durchgewunken, obwohl
 * innen nur 3,88 m frei sind — 25 cm Luft statt der geforderten 30.
 */
const WANDSTAERKE = 0.14;

const SPANNE = clawSpan(CLAW_OPEN_SPLAY);

describe("Mindestmaß der Behälter", () => {
  it("die Presskammer nimmt die offene Spinne auf", () => {
    expect(PRESS_INNER.tiefe, `Kammertiefe (Spinne ${SPANNE.toFixed(2)} m)`).toBeGreaterThan(
      SPANNE + 2 * LUFT
    );
    expect(PRESS_INNER.laenge).toBeGreaterThan(SPANNE + 2 * LUFT);
  });

  it("jeder Absetzcontainer nimmt die offene Spinne auf", () => {
    for (const c of CONFIGS) {
      if (c.kind !== "rolloff") continue;
      const [w, d] = c.size;
      expect(Math.min(w, d) - WANDSTAERKE, `${c.label}: lichte Weite`).toBeGreaterThan(
        SPANNE + 2 * LUFT
      );
    }
  });

  it("die Lagermulden nehmen die offene Spinne auf", () => {
    // Sie sind nach einer Seite offen — dort greift man hinein —, aber quer
    // muss der Greifer trotzdem zwischen die Wände passen.
    for (const c of CONFIGS) {
      if (c.kind !== "bay") continue;
      const breite = c.size[0];
      expect(breite, `${c.label}: lichte Weite`).toBeGreaterThan(SPANNE);
    }
  });
});
