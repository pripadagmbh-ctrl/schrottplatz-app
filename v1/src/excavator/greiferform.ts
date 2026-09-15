import * as THREE from "three";
import { baueSpinne } from "./grappleParts";
import {
  CLAW_CLOSED_SPLAY,
  CLAW_COUNT,
  CLAW_MAX_DEPTH,
  CLAW_OPEN_SPLAY,
  CLAW_RING_R,
  CLAW_RING_Y,
  CLAW_SEGMENTS,
  NACHDRUECK_RESERVE,
  WEICH_RESERVE,
  clawPoint,
  clawTipDepth,
} from "./clawGeometry";

/**
 * Was ein Greifer koennen muss — die eine Wahrheit fuer Modell, Kollider,
 * Bodenanschlag und Greifsystem (E-057, 15.09.2026).
 *
 * WARUM ES DIESE DATEI GIBT. Bis heute hing alles, was den Greifer angeht,
 * unmittelbar an `clawGeometry.ts`: Der Bagger drehte `CLAW_COUNT` Krallen
 * ueber `clawPoint`, der Bodenanschlag rechnete mit `CLAW_MAX_DEPTH`, das
 * Greifsystem las `SENSOR_RADIUS` und `SCHALENLUECKE` aus Modulkonstanten.
 * Das war richtig, solange es EINEN Greifer gab. Mit dem
 * Fuenfschalengreifer daneben (E-058) wuerde daraus an einem Dutzend Stellen
 * ein „wenn … sonst", und jede dieser Stellen waere eine Gelegenheit, die
 * Sichelkralle zu veraendern, ohne es zu merken.
 *
 * DIE HAERTESTE BEDINGUNG dieses Umbaus lautet deshalb: Die Sichelkralle ist
 * danach Zeichen fuer Zeichen dieselbe. Nicht „aehnlich" — identisch. Der
 * Waechter dazu (`test/greiferform.test.ts`) haelt jede Zahl der Form gegen
 * die alte Rechnung, bis 1e−9, ueber den ganzen Schliessweg und ueber ein
 * Punktegitter im Korb. Alle Werte hier sind aus `clawGeometry.ts` GEHOLT,
 * keiner ist abgeschrieben.
 *
 * DIE WINKELKONVENTION. `winkel` ist bei beiden Formen so gerichtet, dass
 * GROESSER = WEITER OFFEN gilt, und `zu` ist immer der kleinere Anschlag. Bei
 * der Sichelkralle ist das die Spreizung (zu 0,5495 … offen 1,555), beim
 * Fuenfschalengreifer der Schwenk der Schalen (zu 0 … offen 1,6799). Damit
 * rechnet der Bagger fuer beide mit demselben Code.
 *
 * WAS HIER NICHT HINEINGEHOERT: alles, was zwischen Greifer und Welt liegt —
 * Bodenanschlag, Eindringtiefe, Greiffenster. Die Form sagt, wo ihre Schalen
 * stehen und was in ihrem Korb liegt; was der Bagger damit anstellt, steht
 * weiter in `excavator.ts` und `gripSystem.ts`.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * ANNAHME: DIE GREIFERACHSE STEHT SENKRECHT.
 *
 * Aufgeschrieben, weil sie demnaechst fallen soll (Wunsch Patrick 15.09.2026:
 * „Greifer muss komplett zur Seite kippen koennen, zum Kehren und
 * Schleudern."). Gebaut ist die Neigung NICHT — hier steht nur, wo sie
 * anschlagen wird und wo nicht.
 *
 * TRAGFAEHIG AUCH GENEIGT, weil es im Frame des Greifers rechnet:
 *   `punkt`        Mittellinie im Greiferframe — dreht mit.
 *   `imKorb`       bekommt den Punkt bereits im Greiferframe (der Bagger
 *                  rechnet ihn mit `grappleGroup.quaternion` um). Kippt der
 *                  Greifer, kippt der Korb mit, ohne dass sich hier etwas
 *                  aendert.
 *   `sensorSitz`   wird in `getSensorPosition` mit derselben Drehung gelegt —
 *                  die Fuehlkugel kippt also mit.
 *   `sensorRadius`, `schalenluecke`, `kolliderRadius`, die vier Zahlen des
 *                  Schliessens: reine Bauteilmasse, richtungslos.
 *
 * HAENGT AN DER SENKRECHTEN — und ist beim Kippen neu zu fassen:
 *   `tiefe(winkel)`, `maxTiefe`   Beides ist eine Tiefe UNTER DEM URSPRUNG,
 *                  gemessen laengs der Greiferachse. Solange die Achse lotet,
 *                  ist das dasselbe wie „ueber dem Beton". Geneigt ist es das
 *                  nicht mehr: Gefragt waere dann die Ausladung in
 *                  Weltrichtung −y, also so etwas wie
 *                  `ausladung(winkel, richtung)`. Wer kippt, faengt hier an.
 *
 * Die drei Stellen im Bagger, die diese Tiefe senkrecht verrechnen, stehen mit
 * derselben Notiz in `excavator.ts`: `resolveGroundClamp`,
 * `surfaceUnderClaws` und `hoechsteKrallenspitze`.
 * ──────────────────────────────────────────────────────────────────────────
 */

/** Kennung einer Greiferform — sie steht so auch im Spielstand. */
export type GreiferId = "sichel" | "fuenfschalen";

/** Der gebaute Greifer, wie der Bagger ihn bewegt. */
export interface Greiferbau {
  /** Haengt unter `grappleGroup`. */
  gruppe: THREE.Object3D;
  /** Schale `i` auf diesen Winkel stellen (rad, groesser = weiter offen). */
  setWinkel(i: number, winkel: number): void;
  /**
   * Nach allen Schalen aufzurufen: Zylinder und andere abhaengige Teile
   * nachfuehren. Getrennt von `setWinkel`, weil eine Hydraulik erst dann
   * stimmt, wenn alle Schalen stehen.
   */
  nachfuehren(): void;
}

export interface Greiferform {
  readonly id: GreiferId;
  /** Klartext fuers Menue und fuers Ereignis. */
  readonly name: string;
  /** Zahl der Schalen. */
  readonly schalen: number;
  /** Stationen je Schale: 0 = Gelenk, `stationen` = Spitze. */
  readonly stationen: number;
  /** Anschlag geschlossen (rad). */
  readonly zu: number;
  /** Anschlag offen (rad). */
  readonly offen: number;
  /**
   * Punkt auf der Mittellinie einer Schale, im Frame des Greifers.
   * `a` ist der Umfangswinkel der Schale, `k` die Station.
   */
  punkt(a: number, winkel: number, k: number, out: THREE.Vector3): THREE.Vector3;
  /**
   * Tiefe des tiefsten GEZEICHNETEN Punktes unter dem Ursprung (m).
   * Setzt voraus, dass die Greiferachse lotet — siehe Kopf der Datei.
   */
  tiefe(winkel: number): number;
  /** Dieselbe Tiefe, ueber den ganzen Schliessweg genommen (m). */
  readonly maxTiefe: number;
  /** Liegt dieser Punkt (im Frame des Greifers) im Schalenkorb? */
  imKorb(p: THREE.Vector3, winkel: number): boolean;
  /** Abstand vom Ursprung des Greifers bis zur Sensormitte (m). */
  readonly sensorSitz: number;
  /** Radius der Sensorkugel (m) — gerechnet, siehe `sensorRadiusVon`. */
  readonly sensorRadius: number;
  /** Luft, die `imKorb` unter die Spitzen legt (m). */
  readonly korbLuftUnten: number;
  /** Abstand zweier benachbarter Schalen bei geschlossenem Greifer (m). */
  readonly schalenluecke: number;
  /** Nachdrueck-Reserve einer Schale an massivem Stahl (rad). */
  readonly nachdrueckReserve: number;
  /** Dieselbe Reserve an Nachgiebigem (rad). */
  readonly weichReserve: number;
  /** Wie weit Ladung den Greifer hoechstens offen haelt (rad). */
  readonly ladungOffen: number;
  /** Wie schnell eine freie Schale ihrem Sollwinkel folgt (rad/s). */
  readonly rate: number;
  /** Radius der Kapseln, die eine Schale physisch nachbilden (m). */
  readonly kolliderRadius: number;
  /** Ein neues Modell bauen — je Bagger eines, nicht wiederverwendbar. */
  baue(): Greiferbau;
}

/** Was `sensorRadiusVon` und `schalenlueckeVon` von einer Form brauchen. */
type Kernform = Pick<
  Greiferform,
  "zu" | "offen" | "stationen" | "schalen" | "punkt" | "korbLuftUnten" | "sensorSitz"
>;

/**
 * Der noetige Sensorradius einer Form — GERECHNET, nicht gewaehlt (E-030).
 *
 * Die Regel steht seit dem 15.09.2026 und gilt fuer jede Form gleich: Die
 * Kugel reicht so tief, wie die Schalenmittellinie in IRGENDEINER Stellung
 * reicht, plus der Luft, die `imKorb` darunter legt. In der Breite bleibt sie
 * Vorfilter — was seitlich noch als gefasst gilt, entscheidet `imKorb`.
 *
 * Der Grund dafuer steht ausfuehrlich in `gripSystem.ts`: Die alte Kugel war
 * 46 cm zu kurz, und genau die untersten 46 cm des Korbs sind der Boden, auf
 * dem das Material liegt.
 *
 * 201 Stuetzstellen ueber den Weg, weil der tiefste Punkt weder ganz offen
 * noch ganz zu liegt, sondern dazwischen.
 */
export function sensorRadiusVon(f: Kernform): number {
  const p = new THREE.Vector3();
  let tiefste = 0;
  for (let i = 0; i <= 200; i++) {
    const winkel = f.zu + ((f.offen - f.zu) * i) / 200;
    tiefste = Math.max(tiefste, -f.punkt(0, winkel, f.stationen, p).y);
  }
  return tiefste + f.korbLuftUnten - f.sensorSitz;
}

/**
 * Abstand zweier benachbarter Schalen beim geschlossenen Greifer (m).
 *
 * Gemessen an der Station, die `krallenKontakte` abtastet (60 % der
 * Schalenlaenge). Wofuer die Zahl gebraucht wird, steht bei `noetigeKrallen`
 * in `gripSystem.ts`: Ein Teil, das kleiner ist als die Luecke, kann zwei
 * Schalen gar nicht beruehren — von ihm zwei Kontakte zu verlangen ist eine
 * Bedingung, die es nie erfuellen kann (E-043).
 */
export function schalenlueckeVon(f: Kernform): number {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const station = Math.round(f.stationen * 0.6);
  f.punkt(0, f.zu, station, a);
  f.punkt((1 / f.schalen) * Math.PI * 2, f.zu, station, b);
  return a.distanceTo(b);
}

/**
 * Wie weit ein Punkt unter den Spitzen noch als „im Korb" gilt (m).
 *
 * Gilt fuer beide Formen gleich: Es ist keine Eigenschaft des Greifers,
 * sondern die Toleranz, mit der wir „liegt zwischen den Schalen" meinen. Die
 * Zahl stammt aus `isInsideGrapple` und ist dort begruendet (vorher 0,35 m —
 * damit galt als gefasst, was einen halben Meter neben der Spinne schwebte).
 */
export const KORB_LUFT_UNTEN = 0.18;
/** Dasselbe zur Seite: So viel Luft legt `imKorb` um den Korbradius (m). */
export const KORB_LUFT_SEITE = 0.14;
/** Und nach oben, ueber den Korbrand hinaus (m). */
export const KORB_LUFT_OBEN = 0.22;

/* -------------------------------------------------------- Die Sichelkralle */

/** Kern der Sichelkralle — daraus werden Sensorradius und Luecke gerechnet. */
const SICHEL_KERN: Kernform = {
  zu: CLAW_CLOSED_SPLAY,
  offen: CLAW_OPEN_SPLAY,
  stationen: CLAW_SEGMENTS,
  schalen: CLAW_COUNT,
  punkt: clawPoint,
  korbLuftUnten: KORB_LUFT_UNTEN,
  /**
   * Sensorsitz 1,50 m unter dem Kardangelenk.
   *
   * Spiegelt `GRAPPLE_LINK + 0.2 + PALM_TO_SENSOR` aus `excavator.ts`
   * (0,55 + 0,20 + 0,75). Der Bagger setzt die Kugel ab jetzt aus dieser Zahl,
   * statt sie selbst zusammenzurechnen — `test/greiffenster.test.ts` misst sie
   * am gebauten Bagger nach und faellt um, sobald sie dort anders wird.
   */
  sensorSitz: 1.5,
};

const sichelTip = new THREE.Vector3();

/**
 * Sichelkralle — der Greifer des Prototyps, Stand 12.09.2026 mittags.
 *
 * Jede Zahl wird aus `clawGeometry.ts` geholt. Diese Datei fuegt der Form
 * NICHTS hinzu und nimmt ihr nichts weg; sie gibt ihr nur einen Namen, unter
 * dem eine zweite Form danebenstehen kann.
 */
export const SICHELKRALLE: Greiferform = {
  id: "sichel",
  name: "Sichelkralle",
  ...SICHEL_KERN,
  tiefe: clawTipDepth,
  maxTiefe: CLAW_MAX_DEPTH,
  sensorRadius: sensorRadiusVon(SICHEL_KERN),
  schalenluecke: schalenlueckeVon(SICHEL_KERN),
  /**
   * Der Korb der Sichelkralle — unveraendert die Rechnung, die bis zum
   * 15.09.2026 in `Excavator.isInsideGrapple` stand: oben der Lagerkranz,
   * unten die Spitzen, dazwischen ein GERADER Kegel mit 0,14 m Luft.
   *
   * Dass dieser Kegel den wirklichen Korb unterschaetzt, ist gemessen und
   * bekannt (`tools/greifer-gegenueber.ts`, „Korbprofil"): Auf halber
   * Korbhoehe laesst er 0,340 m zu, wo die Schalen 0,630 m umschliessen. Bei
   * DIESER Form ist das die vorsichtige Seite des Irrtums — es wird nur
   * gefasst, was sicher drin liegt. Es bleibt deshalb, wie es ist (Regel 2:
   * Das Spielgefuehl des Prototyps ist der Massstab). Der Fuenfschalengreifer
   * bekommt eine eigene Korbform, weil derselbe Kegel bei ihm nur 28 % der
   * Korbflaeche treffen wuerde (E-058).
   */
  imKorb(p: THREE.Vector3, winkel: number): boolean {
    clawPoint(0, winkel, CLAW_SEGMENTS, sichelTip);
    const tipY = sichelTip.y;
    const tipR = Math.max(sichelTip.z, 0);
    if (p.y > CLAW_RING_Y + KORB_LUFT_OBEN || p.y < tipY - KORB_LUFT_UNTEN) return false;
    const t = THREE.MathUtils.clamp((CLAW_RING_Y - p.y) / Math.max(CLAW_RING_Y - tipY, 0.01), 0, 1);
    const r = THREE.MathUtils.lerp(CLAW_RING_R, tipR, t) + KORB_LUFT_SEITE;
    return Math.hypot(p.x, p.z) <= r;
  },
  nachdrueckReserve: NACHDRUECK_RESERVE,
  weichReserve: WEICH_RESERVE,
  /**
   * Ladung haelt die Schalen bis zu 0,50 rad offen.
   *
   * Stand aus `Excavator.currentSplay`, dort seit dem Prototyp. Als Anteil am
   * Oeffnungsweg sind das 49,7 % — so wird der Wert fuer die zweite Form
   * umgerechnet (Ansage Patrick 15.09.2026: „als Anteil am Oeffnungsweg,
   * damit sich beide gleich anfuehlen").
   */
  ladungOffen: 0.5,
  /**
   * 4,0 rad/s. Bewusst hoch: Eine unbehinderte Spinne soll sich anfuehlen wie
   * vorher, sichtbar werden soll nur, was haengen bleibt. Der Befehl selbst
   * verlangt ueber `CLOSE_TIME` = 0,4 s nur 1,0055 / 0,4 = 2,514 rad/s — die
   * Schale hat also das 1,591-fache an Spielraum.
   */
  rate: 4.0,
  /**
   * 0,09 m. Der Wert der Kapseln, die seit dem 13.09.2026 an jeder Kralle
   * haengen; er steht hier, weil die zweite Form ihn ebenfalls braucht.
   */
  kolliderRadius: 0.09,
  baue(): Greiferbau {
    const s = baueSpinne();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const hoch = new THREE.Vector3(0, 1, 0);
    return {
      gruppe: s.gruppe,
      setWinkel(i: number, winkel: number): void {
        /*
         * Um -Spreizung, nicht um -(Spreizung - ZU) — die Begruendung steht
         * unveraendert in `excavator.ts` bei `updateFingers`: Die Segmentkette
         * ist bei Spreizung 0 gebaut.
         */
        const g = s.gelenke[i];
        if (g) g.rotation.x = -winkel;
      },
      /*
       * Zylinder zwischen Traversen-Gelenk und Schale ausrichten — alles im
       * lokalen Spinnenraum, damit sie beim Pendeln nicht nachhinken.
       * Wortweise die Rechnung, die bis zum 15.09.2026 als
       * `Excavator.updateGrappleCylinders` dastand.
       */
      nachfuehren(): void {
        for (const c of s.zylinder) {
          a.copy(c.obenLokal);
          b.copy(c.untenAmGelenk).applyEuler(c.gelenk.rotation).add(c.gelenk.position);
          dir.copy(b).sub(a);
          const dist = Math.max(dir.length(), 0.2);
          dir.normalize();
          q.setFromUnitVectors(hoch, dir);
          c.rohr.position.copy(a).addScaledVector(dir, c.rohrLaenge / 2);
          c.rohr.quaternion.copy(q);
          c.rohr.scale.set(1, c.rohrLaenge, 1);
          const stangeLang = Math.max(dist - c.rohrLaenge + 0.08, 0.08);
          c.stange.position.copy(b).addScaledVector(dir, -stangeLang / 2);
          c.stange.quaternion.copy(q);
          c.stange.scale.set(1, stangeLang, 1);
        }
      },
    };
  },
};
