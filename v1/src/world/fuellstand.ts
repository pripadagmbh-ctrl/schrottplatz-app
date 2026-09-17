/**
 * Wie voll ist eine Mulde — und ab wann geht nichts mehr hinein?
 *
 * Anlass (Patrick, Gerätetest 16.09.2026): „Mulden befüllen, solange Platz
 * ist; sonst andere Arbeit aufnehmen." Damit Lambert das entscheiden kann,
 * braucht „Platz ist" eine Zahl. Bis hierher kannte das Spiel nur den INHALT
 * einer Mulde in Kilogramm (`GameContainer.contentKg`) — und Kilogramm sagen
 * nichts über Platz: 2.000 kg Messing liegen als flacher Fleck auf dem Boden,
 * 2.000 kg Kunststoff quellen über den Rand.
 *
 * GERECHNET WIRD NACH VOLUMEN, mit derselben Regel wie beim Beladen eines
 * LKW (E-033, `delivery/fuellgrad.ts`):
 *
 *     Masse = Füllgrad × Laderaum (m³) × Schüttdichte (kg/m³)
 *
 * hier nur nach dem Füllgrad aufgelöst und je Fraktion getrennt, weil in einer
 * Mulde mehrere liegen (E-028):
 *
 *     Schüttvolumen = Σ  Masse(f) / Schüttdichte(f)
 *     Füllgrad      = Schüttvolumen / Nutzvolumen
 *
 * Getrennt je Fraktion, nicht über eine Mischdichte: Sonst hinge der Füllgrad
 * einer halbvollen Holzmulde davon ab, ob noch ein Reifen dazwischenliegt.
 *
 * DAS NUTZVOLUMEN ist die lichte Grundfläche mal der Wandhöhe — also das, was
 * zwischen den Wänden bis Oberkante hineinpasst. Was darüber aufgeschüttet
 * wird, zählt bewusst nicht: Genau das rutscht wieder heraus, und danach
 * fragt die Regel („ab wann geht nichts mehr hinein").
 */
import { MULDE_STEIN, ROLLOFF_WAND, type ContainerConfig } from "./containers";
import { schuettdichte } from "../materials/schuettdichte";

/**
 * Ab diesem Füllgrad gilt eine Mulde als voll.
 *
 * Nicht 1,0 (SW): Schrott ist keine Flüssigkeit. Die letzten Prozent eines
 * Behälters füllt loses Material nie — es bildet eine Kuppe in der Mitte und
 * lässt die Ecken frei. 0,9 ist der Punkt, an dem ein Fahrer aufhört zu
 * laden, weil das Nächste wieder herunterrollt. Dieselbe Größenordnung wie
 * die Füllgrade, mit denen die Anlieferer kommen (`delivery/fuellgrad.ts`:
 * „randvoll" beginnt bei 0,85).
 */
export const VOLL_AB = 0.9;

/**
 * Lichte Grundfläche in m² — die Fläche zwischen den Wänden.
 *
 * `size` ist [Breite, Tiefe, Höhe]; bei einer `bay` liegt in `size[0]` die
 * Tiefe von der offenen Vorderkante bis zur Rückwand (siehe
 * `bayVorderkante`) und in `size[1]` die Breite an der Wand.
 */
export function lichteFlaeche(cfg: ContainerConfig): number {
  const [a, b] = cfg.size;
  switch (cfg.kind) {
    case "rolloff":
    case "grosscontainer":
      // Vier Wände, je `ROLLOFF_WAND` dick — auf beiden Achsen zweimal weg.
      return Math.max(0, a - 2 * ROLLOFF_WAND) * Math.max(0, b - 2 * ROLLOFF_WAND);
    case "bay": {
      /*
       * Eine Betonlego-Mulde hat ZWEI Wände: hinten und die Flanke, die vom
       * Bagger wegzeigt (siehe Bau in `containers.ts`). Zur offenen Seite und
       * zur Nachbarmulde hin steht nichts — deshalb je Achse nur EINE
       * Wandstärke.
       */
      const t = MULDE_STEIN.dicke;
      return Math.max(0, a - t) * Math.max(0, b - t);
    }
    default:
      // Haufen und offene Flächen haben keine Wand — sie laufen nicht über.
      return a * b;
  }
}

/** Nutzbare Höhe in m: bis Oberkante Wand, darüber rutscht es herunter. */
export function nutzHoehe(cfg: ContainerConfig): number {
  return cfg.size[2];
}

/** Was in die Mulde hineinpasst, in m³. */
export function nutzVolumen(cfg: ContainerConfig): number {
  return lichteFlaeche(cfg) * nutzHoehe(cfg);
}

/**
 * Wie viel Raum der Inhalt einnimmt, in m³ — je Fraktion mit ihrer eigenen
 * Schüttdichte.
 */
export function schuettVolumen(massen: Map<string, number>): number {
  let v = 0;
  for (const [id, kg] of massen) {
    if (!(kg > 0)) continue;
    v += kg / schuettdichte(id);
  }
  return v;
}

/**
 * Füllgrad einer Mulde (0 = leer, 1 = bis Oberkante). Kann über 1 gehen —
 * dann liegt eine Kuppe über dem Rand.
 */
export function fuellgrad(cfg: ContainerConfig, massen: Map<string, number>): number {
  const v = nutzVolumen(cfg);
  if (!(v > 0)) return 0;
  return schuettVolumen(massen) / v;
}

/** Ist kein Platz mehr? */
export function istVoll(
  cfg: ContainerConfig,
  massen: Map<string, number>,
  schwelle = VOLL_AB
): boolean {
  return fuellgrad(cfg, massen) >= schwelle;
}

/**
 * Wie viel Kilogramm einer Fraktion noch hineingehen, bis die Mulde als voll
 * gilt. Negativ heißt: sie ist schon darüber.
 *
 * Gebraucht für die Funkmeldung und für die Tests — eine Zahl in Kilogramm
 * lässt sich nachrechnen, ein Füllgrad zwischen 0 und 1 nicht.
 */
export function restKg(
  cfg: ContainerConfig,
  massen: Map<string, number>,
  fractionId: string,
  schwelle = VOLL_AB
): number {
  const rest = nutzVolumen(cfg) * schwelle - schuettVolumen(massen);
  return rest * schuettdichte(fractionId);
}
