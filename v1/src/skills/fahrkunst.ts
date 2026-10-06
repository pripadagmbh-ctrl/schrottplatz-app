import type RAPIER from "@dimforge/rapier3d-compat";
import type { GameEvents } from "../core/events";
import type { GripSystem } from "../physics/gripSystem";
import type { Excavator } from "../excavator/excavator";

/**
 * FAHRKUNST — wie gut der Spieler den Bagger fuehrt, gemessen aus dem Spiel
 * (E-119, 06.10.2026).
 *
 * Ansage Patrick: Kein Punktesystem, kein Faehigkeitsbaum, keine Werte am
 * Bagger, die sich mit dem Fortschritt aendern. Das Spiel zeigt ehrlich, wie
 * gut der Spieler faehrt — in Einheiten, die ein Baggerfahrer versteht.
 *
 * NUR LESEN. Dieses Modul schreibt in keinen Koerper, keinen Greifer, kein
 * Pendel. Es liest, was Bagger und Physik ohnehin wissen, und rechnet keine
 * Groesse ein zweites Mal:
 *
 *   Pendelausschlag   `Excavator.neigung`          (E-115)
 *   Schliesskraft     `Excavator.schliesskraftKN`  (E-112)
 *   Abwurf            `linvel()` der Teile im Bild des Loslassens — das ist
 *                     genau die Zahl, die `releaseAll` gesetzt hat
 *                     (v = v_Gelenk + ω × r, E-115), nicht nachgerechnet
 *   Liegen            `isSleeping()` — die Physik sagt, wann ein Teil ruht;
 *                     ebenso, wenn der naechste Griff beginnt oder die Presse
 *                     anlaeuft (`jetztLiegtSie`, E-125)
 *   Fangradius        `Greiferform.sensorRadius` des angehaengten Greifers
 *
 * DIE FUENF DEFINITIONEN — hier und nur hier:
 *
 *   Ladungspunkt  Schwerpunkt aller Teile, die zusammen losgelassen wurden
 *                 (massengewichtet). Alle Werte beziehen sich auf ihn; bei
 *                 einem Teil ist es dessen Mitte.
 *
 *   Zyklus        Greifen → Loslassen → Ladung liegt. Er ZAEHLT nur, wenn die
 *                 Ladung waagerecht weiter als der Fangradius der Spinne von
 *                 der Greifstelle entfernt zur Ruhe kommt. Was naeher liegt,
 *                 koennte die Spinne aus derselben Stellung wieder fassen —
 *                 das ist Nachfassen oder Zappeln, kein Umschlag.
 *
 *   Praezision    cm — waagerechter Abstand des Ladungspunkts im Liegen zum
 *                 vorgegebenen Ablageziel. Ohne Ziel LEER (null): Ein Ziel
 *                 wird nicht erfunden.
 *
 *   Ruhe          Grad — Pendelausschlag im Bild des Loslassens.
 *
 *   Tempo         Zyklen pro Minute — 60 / Spielzeit vom Loslassen des
 *                 vorigen gezaehlten Zyklus bis zu diesem. Der erste Zyklus
 *                 nach dem Start (oder nach `neuBeginnen`) hat keinen
 *                 Vorgaenger und bleibt leer — es sei denn, `neuBeginnen()`
 *                 hat die Uhr gestellt, dann zaehlt ab dort.
 *
 *   Wurf          m/s und m — Betrag der Geschwindigkeit des Ladungspunkts im
 *                 Bild des Loslassens, und die waagerechte Strecke vom
 *                 Loslasspunkt bis zum Liegen. Abgesetzt ist auch geworfen,
 *                 nur kurz: Die Trennung trifft `releaseAll`, nicht diese
 *                 Messung.
 *
 *   Gefuehl       kN — Abstand der hoechsten Schliesskraft waehrend des
 *                 Haltens zur vorgegebenen Kraft. Ohne Vorgabe LEER; die
 *                 Spitzenkraft selbst steht immer im Ereignis (`kraftKN`).
 */

/** Was die Messung vom Greifer liest — mehr nicht. */
type GreiferQuelle = Pick<GripSystem, "grippedBodies" | "greiferform">;
/** Was die Messung vom Bagger liest — mehr nicht. */
type BaggerQuelle = Pick<Excavator, "neigung" | "schliesskraftKN">;

const GRAD = 180 / Math.PI;

interface Abwurf {
  koerper: RAPIER.RigidBody[];
  massen: number[];
  /** Ladungspunkt beim Greifen und beim Loslassen (waagerecht) */
  griffX: number;
  griffZ: number;
  losX: number;
  losZ: number;
  zeit: number;
  ruheGrad: number;
  wurfMS: number;
  kraftKN: number;
  fangradius: number;
  ziel: { x: number; z: number } | null;
  zielKraftKN: number | null;
}

export class Fahrkunst {
  /** Ablageziel (waagerecht). Setzt die Challenge; ohne Ziel keine Praezision. */
  ziel: { x: number; z: number } | null = null;
  /** Vorgegebene Schliesskraft (kN). Setzt die Challenge; ohne Vorgabe kein Gefuehl. */
  zielKraftKN: number | null = null;
  /** Ein Ereignis je gezaehltem Zyklus — main haengt den Bus daran. */
  onZyklus: ((e: GameEvents["fahrkunst:zyklus"]) => void) | null = null;

  private zeit = 0;
  /** Loslassen des vorigen gezaehlten Zyklus (Spielzeit s), oder der Start. */
  private uhr: number | null = null;
  /** Was im letzten Bild in der Spinne hing */
  private gehalten: RAPIER.RigidBody[] = [];
  /** Wo jedes Teil war, als es gefasst wurde (waagerecht) */
  private griffOrt = new Map<number, { x: number; z: number }>();
  private spitzeKN = 0;
  private offen: Abwurf | null = null;

  constructor(
    private greifer: GreiferQuelle,
    private bagger: BaggerQuelle
  ) {}

  /** Uhr fuers Tempo ab jetzt stellen (Challenge-Start). Misst nichts um. */
  neuBeginnen(): void {
    this.uhr = this.zeit;
  }

  /**
   * Die losgelassene Ladung gilt ab jetzt als liegend — wie beim naechsten
   * Griff. Aufruf, wenn die Presse anlaeuft (E-125): Gleich schiebt der
   * Stempel alles weg, danach waere der Ort nicht mehr der des Spielers.
   *
   * Gemessen 06.10.2026 (`tools/challenge-ruhe.ts`): Ein Wrack, das quer auf
   * der Kammer liegt (auf Wandkrone und offener Klappe), schlaeft nie ein —
   * es zittert dort mit 0,3–1 mm/s. Ohne diesen Ausloeser bliebe sein Zyklus
   * offen, bis jemand wieder zugreift.
   */
  jetztLiegtSie(): void {
    if (this.offen && this.gehalten.length === 0) this.abschliessen(this.offen);
  }

  /**
   * Einmal je Physikschritt, NACH `grip.update` und VOR `physics.step` —
   * nur dort steht in `linvel()` noch genau, was `releaseAll` gesetzt hat.
   */
  update(dt: number): void {
    this.zeit += dt;
    const jetzt = this.greifer.grippedBodies;

    if (jetzt.length > 0) {
      // Neuer Griff, waehrend die vorige Ladung noch rollt: dann jetzt messen.
      if (this.gehalten.length === 0 && this.offen) this.abschliessen(this.offen);
      for (const b of jetzt) {
        if (!b.isValid() || this.griffOrt.has(b.handle)) continue;
        const p = b.translation();
        this.griffOrt.set(b.handle, { x: p.x, z: p.z });
      }
      this.spitzeKN = Math.max(this.spitzeKN, this.bagger.schliesskraftKN);
    } else if (this.gehalten.length > 0) {
      this.offen = this.loslassen(this.gehalten);
      this.griffOrt.clear();
      this.spitzeKN = 0;
    }
    this.gehalten = jetzt;

    if (this.offen && this.offen.koerper.every((b) => !b.isValid() || b.isSleeping())) {
      this.abschliessen(this.offen);
    }
  }

  private loslassen(koerper: RAPIER.RigidBody[]): Abwurf | null {
    const gueltig = koerper.filter((b) => b.isValid());
    const massen = gueltig.map((b) => b.mass());
    const m = massen.reduce((s, x) => s + x, 0);
    if (m <= 0) return null;
    let gx = 0, gz = 0, px = 0, pz = 0, vx = 0, vy = 0, vz = 0;
    gueltig.forEach((b, i) => {
      const w = massen[i]! / m;
      const p = b.translation();
      const v = b.linvel();
      const g = this.griffOrt.get(b.handle) ?? p;
      gx += w * g.x;
      gz += w * g.z;
      px += w * p.x;
      pz += w * p.z;
      vx += w * v.x;
      vy += w * v.y;
      vz += w * v.z;
    });
    return {
      koerper: gueltig,
      massen,
      griffX: gx,
      griffZ: gz,
      losX: px,
      losZ: pz,
      zeit: this.zeit,
      ruheGrad: this.bagger.neigung * GRAD,
      wurfMS: Math.hypot(vx, vy, vz),
      kraftKN: this.spitzeKN,
      fangradius: this.greifer.greiferform.sensorRadius,
      ziel: this.ziel ? { ...this.ziel } : null,
      zielKraftKN: this.zielKraftKN,
    };
  }

  private abschliessen(a: Abwurf): void {
    this.offen = null;
    // Ladungspunkt im Liegen — nur aus Teilen, die es noch gibt (E-103)
    let m = 0, x = 0, z = 0;
    a.koerper.forEach((b, i) => {
      if (!b.isValid()) return;
      const p = b.translation();
      m += a.massen[i]!;
      x += a.massen[i]! * p.x;
      z += a.massen[i]! * p.z;
    });
    // Alles in der Presse verschwunden: nichts mehr zu messen
    if (m <= 0) return;
    x /= m;
    z /= m;
    if (Math.hypot(x - a.griffX, z - a.griffZ) <= a.fangradius) return; // Zappeln
    const dauer = this.uhr === null ? null : a.zeit - this.uhr;
    this.uhr = a.zeit;
    this.onZyklus?.({
      praezisionCm: a.ziel ? Math.hypot(x - a.ziel.x, z - a.ziel.z) * 100 : null,
      ruheGrad: a.ruheGrad,
      tempoProMin: dauer && dauer > 0 ? 60 / dauer : null,
      wurfMS: a.wurfMS,
      wurfweiteM: Math.hypot(x - a.losX, z - a.losZ),
      kraftKN: a.kraftKN,
      gefuehlKN: a.zielKraftKN === null ? null : Math.abs(a.kraftKN - a.zielKraftKN),
      x,
      z,
    });
  }
}
