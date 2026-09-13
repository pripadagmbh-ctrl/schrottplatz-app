/**
 * Das Rig: Hierarchie, Pivots und die beiden Bewegungen.
 *
 * Zwei Freiheitsgrade, mehr hat ein Mehrschalengreifer nicht:
 *
 *   - `setOeffnung(0…1)` schwenkt alle Schalen um ihre Drehbolzen und
 *     führt die Zylinder nach.
 *   - `setDrehung(rad)` dreht den ganzen Greifer unter dem Adapter um die
 *     Hochachse. Beides ist voneinander unabhängig.
 *
 * Die Hierarchie weicht an einer Stelle bewusst von der Wunschliste ab: Dort
 * standen Rotator, Kopf, Zylinder und Schalen nebeneinander. Mechanisch geht
 * das nicht — dreht der Rotator, muss alles unter ihm mitdrehen. Schalen und
 * Zylinder hängen deshalb unter `GRAPPLE_HEAD`, und der hängt unter `ROTATOR`.
 * Die Namen sind die gewünschten geblieben.
 *
 *   GRAPPLE_ROOT
 *   ├── ADAPTER                     fest am Stiel
 *   └── ROTATOR                     dreht um Y
 *       └── GRAPPLE_HEAD
 *           ├── CYLINDER_01…04      Pivot = Zylinderaufnahme, dreht um X
 *           │   ├── CYL_BARREL_0n
 *           │   └── CYL_ROD_0n      fährt aus und ein
 *           ├── SHELL_01…04         Pivot = Gelenkbolzen, dreht um X
 *           │   ├── SHELL_BODY_0n
 *           │   ├── SHELL_FLANGE_0n_L / _R
 *           │   ├── WEAR_PLATE_0n
 *           │   ├── SHELL_TIP_0n
 *           │   └── SHELL_LUG_0n
 *           ├── PIVOT_PIN_01…04
 *           └── HYDRAULIC_LINES
 */
import * as THREE from "three";
import {
  BOLZENKREIS,
  KOPFHOEHE,
  LASCHE,
  OFFEN,
  ROHRLAENGE,
  SCHALEN,
  ZU,
  ZYLINDER_AUFNAHME,
  schwenkFuer,
} from "./form";
import {
  Stoffe,
  baueAdapter,
  baueGelenkbolzen,
  baueKopf,
  baueLasche,
  baueLeitungen,
  baueRotator,
  baueSchalenkoerper,
  baueSpitze,
  baueVerschleissmesser,
  baueWange,
  baueZylinder,
  stoffe,
} from "./parts";

/** Wie weit die Kolbenstange im Rohr stecken bleibt (m). */
const EINSTAND = 0.1;

export interface Schale {
  /** Der Knoten, dessen Ursprung auf dem Drehbolzen liegt. */
  gelenk: THREE.Group;
  /** Winkel des Gelenks auf dem Bolzenkreis (rad). */
  winkel: number;
}

export interface Zylinder {
  /** Knoten auf der Zylinderaufnahme am Kopf — hier wird geschwenkt. */
  gelenk: THREE.Group;
  rohr: THREE.Mesh;
  stange: THREE.Mesh;
  /** Aufnahmepunkt im Frame des Kopfes. */
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
  /** 0 = ganz zu, 1 = ganz offen. */
  setOeffnung(t: number): void;
  /** Drehung des Greifers um die Hochachse (rad). */
  setDrehung(rad: number): void;
  /** Aktueller Öffnungsgrad. */
  oeffnung(): number;
}

/**
 * Wo die Kolbenstange angreift, im Frame des Kopfes, bei gegebenem Schwenk.
 *
 * Die Lasche sitzt fest an der Schale; sie dreht also mit dem Gelenk um dessen
 * x-Achse. Weil Aufnahme und Lasche auf derselben Radialebene liegen, ist das
 * eine ebene Rechnung — der Zylinder schwenkt nur um eine Achse.
 */
function laschePunkt(schwenk: number): { r: number; y: number } {
  const phi = -(schwenk - ZU);
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  return {
    r: BOLZENKREIS + (LASCHE.y * s + LASCHE.z * c),
    y: -KOPFHOEHE + (LASCHE.y * c - LASCHE.z * s),
  };
}

/** Abstand zwischen Zylinderaufnahme und Lasche bei gegebenem Schwenk (m). */
export function zylinderLaenge(schwenk: number): number {
  const l = laschePunkt(schwenk);
  return Math.hypot(
    l.r - ZYLINDER_AUFNAHME.r * BOLZENKREIS,
    l.y - ZYLINDER_AUFNAHME.y * KOPFHOEHE
  );
}

/** Neigung des Zylinders gegen die Senkrechte bei gegebenem Schwenk (rad). */
export function zylinderNeigung(schwenk: number): number {
  const l = laschePunkt(schwenk);
  /*
   * Gemessen gegen die Senkrechte, also mit Betraegen. Ohne die kam 170°
   * heraus: Die Lasche liegt UNTER der Aufnahme, dy ist negativ, und atan2
   * misst dann den Winkel nach oben statt die Schraege.
   */
  return Math.atan2(
    Math.abs(l.r - ZYLINDER_AUFNAHME.r * BOLZENKREIS),
    Math.abs(l.y - ZYLINDER_AUFNAHME.y * KOPFHOEHE)
  );
}

/** Zwei Nachkommastellen reichen — sonst wandern Fließkommareste ins glTF. */
function rund(x: number): number {
  return Math.round(x * 1e5) / 1e5;
}

export function baueGreifer(st: Stoffe = stoffe()): Greifer {
  const wurzel = new THREE.Group();
  wurzel.name = "GRAPPLE_ROOT";

  const adapter = baueAdapter(st);
  wurzel.add(adapter);

  const rotator = baueRotator(st);
  wurzel.add(rotator);

  const kopf = baueKopf(st);
  rotator.add(kopf);

  const schalen: Schale[] = [];
  const zylinder: Zylinder[] = [];
  const anschluesse: THREE.Vector3[] = [];

  for (let i = 0; i < SCHALEN; i++) {
    const nr = String(i + 1).padStart(2, "0");
    const a = (i / SCHALEN) * Math.PI * 2;
    const sin = Math.sin(a);
    const cos = Math.cos(a);

    /* --- Schale: Ursprung auf dem Drehbolzen --- */
    const gelenk = new THREE.Group();
    gelenk.name = `SHELL_${nr}`;
    gelenk.position.set(sin * BOLZENKREIS, -KOPFHOEHE, cos * BOLZENKREIS);
    gelenk.rotation.order = "YXZ";
    gelenk.rotation.y = a; // lokales +z zeigt radial nach außen
    kopf.add(gelenk);

    const koerper = baueSchalenkoerper(st);
    koerper.name = `SHELL_BODY_${nr}`;
    gelenk.add(koerper);
    for (const seite of [-1, 1]) {
      const wange = baueWange(st, seite);
      wange.name = `SHELL_FLANGE_${nr}_${seite < 0 ? "L" : "R"}`;
      gelenk.add(wange);
    }
    const messer = baueVerschleissmesser(st);
    messer.name = `WEAR_PLATE_${nr}`;
    gelenk.add(messer);
    const spitze = baueSpitze(st);
    spitze.name = `SHELL_TIP_${nr}`;
    gelenk.add(spitze);
    const lasche = baueLasche(st);
    lasche.name = `SHELL_LUG_${nr}`;
    gelenk.add(lasche);

    const schale: Schale = { gelenk, winkel: a };
    schalen.push(schale);

    /* --- Gelenkbolzen: sitzt am Kopf, nicht an der Schale --- */
    const bolzen = baueGelenkbolzen(st);
    bolzen.name = `PIVOT_PIN_${nr}`;
    bolzen.position.set(sin * BOLZENKREIS, -KOPFHOEHE, cos * BOLZENKREIS);
    bolzen.rotation.y = a;
    bolzen.rotation.z = Math.PI / 2;
    kopf.add(bolzen);

    /* --- Zylinder: Ursprung auf der Aufnahme am Kopf --- */
    const amKopf = new THREE.Vector3(
      sin * ZYLINDER_AUFNAHME.r * BOLZENKREIS,
      ZYLINDER_AUFNAHME.y * KOPFHOEHE,
      cos * ZYLINDER_AUFNAHME.r * BOLZENKREIS
    );
    const zylGelenk = new THREE.Group();
    zylGelenk.name = `CYLINDER_${nr}`;
    zylGelenk.position.copy(amKopf);
    zylGelenk.rotation.order = "YXZ";
    zylGelenk.rotation.y = a;
    kopf.add(zylGelenk);

    const { rohr, stange } = baueZylinder(st);
    rohr.name = `CYL_BARREL_${nr}`;
    stange.name = `CYL_ROD_${nr}`;
    zylGelenk.add(rohr);
    zylGelenk.add(stange);

    zylinder.push({ gelenk: zylGelenk, rohr, stange, amKopf, gehoertZu: schale });
    anschluesse.push(amKopf.clone().setY(amKopf.y + 0.12 * KOPFHOEHE));
  }

  kopf.add(baueLeitungen(st, anschluesse));

  let stand = 0;

  const setOeffnung = (t: number): void => {
    stand = Math.min(1, Math.max(0, t));
    const schwenk = schwenkFuer(stand);
    for (const s of schalen) {
      s.gelenk.rotation.x = rund(-(schwenk - ZU));
    }
    const l = laschePunkt(schwenk);
    for (const z of zylinder) {
      const dr = l.r - ZYLINDER_AUFNAHME.r * BOLZENKREIS;
      const dy = l.y - ZYLINDER_AUFNAHME.y * KOPFHOEHE;
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

/**
 * Hebelarm des Zylinders am Drehbolzen bei gegebenem Schwenk (m).
 *
 * Der senkrechte Abstand des Drehbolzens von der Wirkungslinie Aufnahme →
 * Lasche. Das Moment an der Schale ist Zylinderkraft mal diesem Arm, und
 * deshalb entscheidet er darüber, ob die Maschine ihre Kraft dort hat, wo
 * zugegriffen wird.
 */
export function hebelarm(schwenk: number): number {
  const l = laschePunkt(schwenk);
  const ar = ZYLINDER_AUFNAHME.r * BOLZENKREIS;
  const ay = ZYLINDER_AUFNAHME.y * KOPFHOEHE;
  const d = Math.max(Math.hypot(l.r - ar, l.y - ay), 1e-6);
  const ux = (l.r - ar) / d;
  const uy = (l.y - ay) / d;
  return Math.abs((BOLZENKREIS - ar) * uy - (-KOPFHOEHE - ay) * ux);
}

/**
 * Verhältnis Kolbenstange zu Kolben.
 *
 * Bestimmt, wie viel Kraft beim Einfahren übrig bleibt: Die Ringfläche ist
 * `1 − (Stange/Kolben)²` der Kolbenfläche. Eine dünne Stange ist hier kein
 * Detail, sondern der halbe Gewinn.
 */
export const STANGENVERHAELTNIS = 0.4;
/** Anteil der Kolbenfläche, der beim Einfahren wirkt. */
export const RINGFLAECHE = 1 - STANGENVERHAELTNIS * STANGENVERHAELTNIS;

/**
 * Schließmoment geteilt durch Öffnungsmoment, bei gleichem Öldruck.
 *
 * Über 1 heißt: Die Maschine drückt beim Zugreifen stärker zu, als sie aufgeht
 * — so gehört es sich. Geschlossen wird durch Einfahren, dort wirkt nur die
 * Ringfläche; dass es trotzdem reicht, kommt allein vom Hebelarm.
 */
export function kraftverhaeltnis(): number {
  return (hebelarm(ZU) / hebelarm(OFFEN)) * RINGFLAECHE;
}
