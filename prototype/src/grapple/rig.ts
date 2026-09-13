/**
 * Das Rig: Hierarchie, Pivots und die beiden Bewegungen.
 *
 * Zwei Freiheitsgrade, mehr hat ein Mehrschalengreifer nicht:
 *
 *   - `setOeffnung(0…1)` schwenkt alle fünf Schalen um ihre Gelenkbolzen und
 *     führt die Zylinder nach.
 *   - `setDrehung(rad)` dreht den ganzen Greifer unter der Aufhängung um die
 *     Hochachse. Beides ist voneinander unabhängig.
 *
 * Die Hierarchie weicht an einer Stelle bewusst von der Wunschliste ab: Dort
 * standen Rotator, Mittelstück, Zylinder und Schalen nebeneinander. Mechanisch
 * geht das nicht — dreht der Rotator, muss alles unter ihm mitdrehen. Schalen
 * und Zylinder hängen deshalb unter `GRAPPLE_HEAD`, und der hängt unter
 * `ROTATOR`. Die Namen sind die gewünschten geblieben.
 *
 *   GRAPPLE_ROOT
 *   ├── ADAPTER                     01/02, fest am Stiel
 *   └── ROTATOR                     03, dreht um Y
 *       └── GRAPPLE_HEAD            06/07 Mittelstück, Haube, Gelenkring
 *           ├── CYLINDER_01…05      04, Pivot = Anlenkung, dreht um X
 *           │   ├── CYL_BARREL_0n
 *           │   └── CYL_ROD_0n      fährt aus und ein
 *           ├── SHELL_01…05         08, Pivot = Gelenkbolzen, dreht um X
 *           │   ├── SHELL_SEG_0n_1…6  Segmentkette, fest
 *           │   │   ├── SHELL_BODY_0n_k
 *           │   │   └── WEAR_PLATE_0n_k   09
 *           │   ├── SHELL_TIP_0n    10
 *           │   └── SHELL_LUG_0n
 *           ├── PIVOT_PIN_01…05     11
 *           └── HYDRAULIC_LINES     05
 */
import * as THREE from "three";
import {
  LASCHE,
  OFFEN,
  RING_Y,
  ROHRLAENGE,
  SCHALEN,
  ZU,
  GELENKRING,
  schwenkFuer,
} from "./form";
import {
  Stoffe,
  baueAufhaengung,
  baueGelenkbolzen,
  baueMittelstueck,
  baueRotator,
  baueSchale,
  baueSchlaeuche,
  baueZylinder,
  stoffe,
  zylinderAmKopf,
} from "./parts";

/** Wie weit die Kolbenstange im Rohr stecken bleibt (m). */
const EINSTAND = 0.08;

export interface Schale {
  /** Der Knoten, dessen Ursprung auf dem Gelenkbolzen liegt. */
  gelenk: THREE.Group;
  /** Winkel des Gelenks auf dem Gelenkring (rad). */
  winkel: number;
}

export interface Zylinder {
  gelenk: THREE.Group;
  rohr: THREE.Mesh;
  stange: THREE.Mesh;
  amKopf: THREE.Vector3;
  gehoertZu: Schale;
}

export interface Greifer {
  wurzel: THREE.Group;
  adapter: THREE.Group;
  rotator: THREE.Group;
  kopf: THREE.Group;
  schalen: Schale[];
  zylinder: Zylinder[];
  setOeffnung(t: number): void;
  setDrehung(rad: number): void;
  oeffnung(): number;
}

/**
 * Wo die Kolbenstange angreift, im Frame des Kopfes, bei gegebenem Schwenk.
 *
 * Die Lasche sitzt fest an der Schale; sie dreht also mit dem Gelenk um dessen
 * x-Achse. Weil Anlenkung und Lasche auf derselben Radialebene liegen, ist das
 * eine ebene Rechnung — der Zylinder schwenkt nur um eine Achse.
 */
function laschePunkt(schwenk: number): { r: number; y: number } {
  const phi = -(schwenk - ZU);
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  return {
    r: GELENKRING + (LASCHE.y * s + LASCHE.z * c),
    y: RING_Y + (LASCHE.y * c - LASCHE.z * s),
  };
}

/** Abstand zwischen Zylinderanlenkung und Lasche bei gegebenem Schwenk (m). */
export function zylinderLaenge(schwenk: number): number {
  const l = laschePunkt(schwenk);
  const a = zylinderAmKopf(0);
  return Math.hypot(l.r - a.z, l.y - a.y);
}

/** Neigung des Zylinders gegen die Senkrechte bei gegebenem Schwenk (rad). */
export function zylinderNeigung(schwenk: number): number {
  const l = laschePunkt(schwenk);
  const a = zylinderAmKopf(0);
  return Math.atan2(Math.abs(l.r - a.z), Math.abs(l.y - a.y));
}

/**
 * Hebelarm des Zylinders am Gelenkbolzen bei gegebenem Schwenk (m).
 *
 * Der senkrechte Abstand des Gelenkbolzens von der Wirkungslinie Anlenkung →
 * Lasche. Das Moment an der Schale ist Zylinderkraft mal diesem Arm.
 */
export function hebelarm(schwenk: number): number {
  const l = laschePunkt(schwenk);
  const a = zylinderAmKopf(0);
  const d = Math.max(Math.hypot(l.r - a.z, l.y - a.y), 1e-6);
  const ux = (l.r - a.z) / d;
  const uy = (l.y - a.y) / d;
  return Math.abs((GELENKRING - a.z) * uy - (RING_Y - a.y) * ux);
}

/** Zwei Nachkommastellen reichen — sonst wandern Fließkommareste ins glTF. */
function rund(x: number): number {
  return Math.round(x * 1e5) / 1e5;
}

export function baueGreifer(st: Stoffe = stoffe()): Greifer {
  const wurzel = new THREE.Group();
  wurzel.name = "GRAPPLE_ROOT";

  const adapter = baueAufhaengung(st);
  wurzel.add(adapter);

  const rotator = baueRotator(st);
  wurzel.add(rotator);

  const kopf = baueMittelstueck(st);
  rotator.add(kopf);

  const schalen: Schale[] = [];
  const zylinder: Zylinder[] = [];
  const anschluesse: THREE.Vector3[] = [];

  for (let i = 0; i < SCHALEN; i++) {
    const nr = String(i + 1).padStart(2, "0");
    const a = (i / SCHALEN) * Math.PI * 2;

    const gelenk = baueSchale(st, a, nr);
    kopf.add(gelenk);
    const schale: Schale = { gelenk, winkel: a };
    schalen.push(schale);

    const bolzen = baueGelenkbolzen(st);
    bolzen.name = `PIVOT_PIN_${nr}`;
    bolzen.position.copy(gelenk.position);
    bolzen.rotation.y = a;
    bolzen.rotation.z = Math.PI / 2;
    kopf.add(bolzen);

    const amKopf = zylinderAmKopf(a);
    const zylGelenk = new THREE.Group();
    zylGelenk.name = `CYLINDER_${nr}`;
    zylGelenk.position.copy(amKopf);
    zylGelenk.rotation.order = "YXZ";
    zylGelenk.rotation.y = a;
    kopf.add(zylGelenk);

    const { rohr, stange } = baueZylinder(st);
    rohr.name = `CYL_BARREL_${nr}`;
    stange.name = `CYL_ROD_${nr}`;
    rohr.position.y = -ROHRLAENGE / 2;
    rohr.scale.y = ROHRLAENGE;
    stange.position.y = -0.5;
    zylGelenk.add(rohr);
    zylGelenk.add(stange);

    zylinder.push({ gelenk: zylGelenk, rohr, stange, amKopf, gehoertZu: schale });
    anschluesse.push(amKopf.clone().setY(amKopf.y + 0.06));
  }

  kopf.add(baueSchlaeuche(st, anschluesse));

  let stand = 0;

  const setOeffnung = (t: number): void => {
    stand = Math.min(1, Math.max(0, t));
    const schwenk = schwenkFuer(stand);
    for (const s of schalen) {
      s.gelenk.rotation.x = rund(-(schwenk - ZU));
    }
    const l = laschePunkt(schwenk);
    const a = zylinderAmKopf(0);
    for (const z of zylinder) {
      const dr = l.r - a.z;
      const dy = l.y - a.y;
      const dist = Math.max(Math.hypot(dr, dy), 0.2);
      /*
       * Das Rohr zeigt in seinem Frame nach −y. Eine Drehung um x um ψ bringt
       * (0,−1,0) auf (0, −cos ψ, −sin ψ). Damit das auf (0, dy, dr) zeigt:
       *   ψ = atan2(−dr, −dy)
       */
      z.gelenk.rotation.x = rund(Math.atan2(-dr, -dy));
      const stangenLaenge = Math.max(dist - ROHRLAENGE + EINSTAND, 0.08);
      z.stange.scale.y = rund(stangenLaenge);
      z.stange.position.y = rund(-(dist - stangenLaenge));
    }
  };

  const setDrehung = (rad: number): void => {
    rotator.rotation.y = rund(rad);
  };

  setOeffnung(0);
  setDrehung(0);

  return {
    wurzel,
    adapter,
    rotator,
    kopf,
    schalen,
    zylinder,
    setOeffnung,
    setDrehung,
    oeffnung: () => stand,
  };
}

/** Alle Schwenkwinkel, die im Rig vorkommen — für Prüfungen und Animationen. */
export const SCHWENK_BEREICH = { zu: ZU, offen: OFFEN };
