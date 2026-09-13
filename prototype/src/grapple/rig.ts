/**
 * Zusammenbau des Fünfschalengreifers aus den Einzelteilen.
 *
 * Gebaut wird ausschließlich aus `teile.ts` — dort stehen die Hauptmaße der
 * Explosionszeichnung und die daraus abgetastete Kinematik. Hier steht nur,
 * wo welches Teil sitzt und was sich wie bewegt.
 *
 * Zwei Freiheitsgrade, mehr hat ein Mehrschalengreifer nicht:
 *
 *   - `setOeffnung(0…1)` schwenkt die fünf Schalen um ihre Gelenkbolzen und
 *     führt die Zylinder nach.
 *   - `setDrehung(rad)` dreht alles unter dem Adapter um die Hochachse.
 *
 * Aufbau von oben nach unten, mit den Überdeckungen echter Verschraubungen:
 *
 *   Adapter          0,00 … −0,40    Position 1
 *   Rotator         −0,36 … −0,66    Position 2, angeflanscht
 *   Drehwerksgehäuse −0,60 … −0,85   Position 3, umschließt den Rotatorfuß
 *   Mitteltraverse  −0,78 … −1,23    Position 4
 *   Schalenbolzen         −1,155     auf Ø 0,68 am Rand der Traverse
 *
 * Die Hauptmaße sind Kantenlängen der Einzelteile; verschraubt überlappen sie
 * um die Flanschdicke. Stur gestapelt käme der Kopf auf 1,40 m statt 1,23 m.
 */
import * as THREE from "three";
import {
  ANLENKPUNKT,
  BOLZENKREIS,
  BOLZEN_Y,
  MASS,
  OFFEN,
  Stoffe,
  ZU,
  ZYLINDER_AUFNAHME,
  baueAufhaengung,
  baueDrehwerksgehaeuse,
  baueGreiferschale,
  baueGreiferspitze,
  baueHydraulikleitung,
  baueMitteltraverse,
  baueRotator,
  baueSchalenverstaerkung,
  baueZylinder,
  baueZylinderschutzblech,
  mittellinie,
  nahtStoff,
  schalenStationen,
  schwenkFuer,
  stoffe,
} from "./teile";

/** Höhenlage jeder Baugruppe (Mitte, in Metern unter dem Aufhängepunkt). */
export const LAGE = {
  adapter: -0.2,
  rotator: -0.51,
  drehwerksgehaeuse: -0.725,
  traverse: -1.005,
} as const;

/** Wie weit die Kolbenstange im Rohr steckt (m). */
const EINSTAND = 0.06;

export interface Schale {
  gelenk: THREE.Group;
  winkel: number;
}

export interface Zylinder {
  gelenk: THREE.Group;
  rohr: THREE.Group;
  stange: THREE.Group;
  schutz: THREE.Group;
  gehoertZu: Schale;
}

export interface Greifer {
  wurzel: THREE.Group;
  adapter: THREE.Group;
  rotator: THREE.Group;
  traverse: THREE.Group;
  schalen: Schale[];
  zylinder: Zylinder[];
  setOeffnung(t: number): void;
  setDrehung(rad: number): void;
  oeffnung(): number;
}

/**
 * Wo die Kolbenstange angreift, im Frame des Greifers, bei gegebenem Schwenk.
 *
 * Die Lasche sitzt fest auf dem Schalenrücken und dreht mit dem Gelenk um
 * dessen x-Achse. Weil Aufnahme und Lasche auf derselben Radialebene liegen,
 * ist das eine ebene Rechnung.
 */
function laschePunkt(schwenk: number): { r: number; y: number } {
  const phi = -schwenk;
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  return {
    r: BOLZENKREIS + (ANLENKPUNKT.y * s + ANLENKPUNKT.z * c),
    y: BOLZEN_Y + (ANLENKPUNKT.y * c - ANLENKPUNKT.z * s),
  };
}

/** Abstand zwischen Zylinderaufnahme und Lasche (m). */
export function zylinderLaenge(schwenk: number): number {
  const l = laschePunkt(schwenk);
  return Math.hypot(l.r - ZYLINDER_AUFNAHME.r, l.y - ZYLINDER_AUFNAHME.y);
}

/** Neigung des Zylinders gegen die Senkrechte (rad). */
export function zylinderNeigung(schwenk: number): number {
  const l = laschePunkt(schwenk);
  return Math.atan2(
    Math.abs(l.r - ZYLINDER_AUFNAHME.r),
    Math.abs(l.y - ZYLINDER_AUFNAHME.y)
  );
}

/**
 * Hebelarm des Zylinders am Gelenkbolzen (m).
 *
 * Der senkrechte Abstand des Bolzens von der Wirkungslinie Aufnahme → Lasche.
 * Das Moment an der Schale ist Zylinderkraft mal diesem Arm; geht er gegen
 * null, steht die Schale fest, egal wie viel Druck anliegt.
 */
export function hebelarm(schwenk: number): number {
  const l = laschePunkt(schwenk);
  const d = Math.max(
    Math.hypot(l.r - ZYLINDER_AUFNAHME.r, l.y - ZYLINDER_AUFNAHME.y),
    1e-6
  );
  const ux = (l.r - ZYLINDER_AUFNAHME.r) / d;
  const uy = (l.y - ZYLINDER_AUFNAHME.y) / d;
  return Math.abs((BOLZENKREIS - ZYLINDER_AUFNAHME.r) * uy - (BOLZEN_Y - ZYLINDER_AUFNAHME.y) * ux);
}

/** Zwei Nachkommastellen reichen — sonst wandern Fließkommareste ins glTF. */
function rund(x: number): number {
  return Math.round(x * 1e5) / 1e5;
}

export function baueGreifer(st: Stoffe = stoffe()): Greifer {
  nahtStoff(st);
  const wurzel = new THREE.Group();
  wurzel.name = "GRAPPLE_ROOT";

  const adapter = baueAufhaengung(st);
  adapter.position.y = LAGE.adapter;
  wurzel.add(adapter);

  /*
   * Alles unter dem Adapter hängt am Rotator — sonst dreht sich beim Drehen
   * nur das Motorgehäuse und der Greifer bleibt stehen.
   */
  const rotator = new THREE.Group();
  rotator.name = "ROTATOR";
  wurzel.add(rotator);

  const drehwerk = baueRotator(st);
  drehwerk.position.y = LAGE.rotator;
  rotator.add(drehwerk);

  const gehaeuse = baueDrehwerksgehaeuse(st);
  gehaeuse.position.y = LAGE.drehwerksgehaeuse;
  rotator.add(gehaeuse);

  const traverse = baueMitteltraverse(st);
  traverse.name = "GRAPPLE_HEAD";
  traverse.position.y = LAGE.traverse;
  rotator.add(traverse);

  const schalen: Schale[] = [];
  const zylinder: Zylinder[] = [];
  const leitungsziele: THREE.Vector3[] = [];
  const stationen = schalenStationen();

  for (let i = 0; i < MASS.schalen; i++) {
    const nr = String(i + 1).padStart(2, "0");
    const a = (i / MASS.schalen) * Math.PI * 2;
    const sin = Math.sin(a);
    const cos = Math.cos(a);

    /* --- Schale: Ursprung auf dem Gelenkbolzen --- */
    const gelenk = new THREE.Group();
    gelenk.name = `SHELL_${nr}`;
    gelenk.position.set(sin * BOLZENKREIS, BOLZEN_Y, cos * BOLZENKREIS);
    gelenk.rotation.order = "YXZ";
    gelenk.rotation.y = a; // lokales +z zeigt radial nach außen
    rotator.add(gelenk);

    const schale = baueGreiferschale(st);
    schale.name = `SHELL_BODY_${nr}`;
    gelenk.add(schale);

    /*
     * Greiferspitze am Ende der letzten Station, in Laufrichtung der Schale.
     *
     * Gerechnet, nicht geschätzt: Die Schale endet mit dem Winkel `th` gegen
     * die Senkrechte, läuft dort also in Richtung (0, −cos th, −sin th). Die
     * Spitze zeigt in ihrem eigenen Frame nach −y; eine Drehung um x um `th`
     * bringt (0,−1,0) genau auf diese Richtung.
     */
    const ende = stationen[stationen.length - 1]!;
    const spitze = baueGreiferspitze(st);
    spitze.name = `SHELL_TIP_${nr}`;
    spitze.position.set(0, ende.y, ende.z);
    spitze.rotation.x = ende.th;
    gelenk.add(spitze);

    const verstaerkung = baueSchalenverstaerkung(st);
    verstaerkung.name = `SHELL_REINFORCE_${nr}`;
    gelenk.add(verstaerkung);

    const schaleRef: Schale = { gelenk, winkel: a };
    schalen.push(schaleRef);

    /* --- Zylinder: Ursprung auf der Aufnahme an der Traverse --- */
    const zylGelenk = new THREE.Group();
    zylGelenk.name = `CYLINDER_${nr}`;
    zylGelenk.position.set(
      sin * ZYLINDER_AUFNAHME.r,
      ZYLINDER_AUFNAHME.y,
      cos * ZYLINDER_AUFNAHME.r
    );
    zylGelenk.rotation.order = "YXZ";
    zylGelenk.rotation.y = a;
    rotator.add(zylGelenk);

    const { gehaeuse: rohrTeil, stange } = baueZylinder(st);
    rohrTeil.name = `CYL_BARREL_${nr}`;
    stange.name = `CYL_ROD_${nr}`;
    zylGelenk.add(rohrTeil);
    zylGelenk.add(stange);

    /*
     * Schutzblech LAENGS ueber den Zylinder, nicht quer.
     *
     * Erst stand hier eine Drehung um 90° um x — damit lag das Blech waagerecht
     * und stand wie ein Fluegel vom Kopf ab. Es soll den Zylinder abdecken,
     * also liegt es parallel zu ihm, ein Stueck nach aussen versetzt.
     */
    const schutz = baueZylinderschutzblech(st);
    schutz.name = `CYL_SHIELD_${nr}`;
    schutz.position.set(0, -MASS.schutzblech.laenge / 2 - 0.05, MASS.zylinder.durchmesser * 0.5);
    zylGelenk.add(schutz);

    zylinder.push({ gelenk: zylGelenk, rohr: rohrTeil, stange, schutz, gehoertZu: schaleRef });
    leitungsziele.push(
      new THREE.Vector3(sin * ZYLINDER_AUFNAHME.r, ZYLINDER_AUFNAHME.y + 0.05, cos * ZYLINDER_AUFNAHME.r)
    );
  }

  /* --- Hydraulikleitungen: vom Drehwerk zu jedem Zylinder --- */
  const leitungen = new THREE.Group();
  leitungen.name = "HYDRAULIC_LINES";
  leitungsziele.forEach((ziel, i) => {
    const leitung = baueHydraulikleitung(st, 0.55);
    leitung.name = `HYDRAULIC_LINE_${String(i + 1).padStart(2, "0")}`;
    const winkel = Math.atan2(ziel.x, ziel.z);
    leitung.position.set(
      Math.sin(winkel) * 0.16,
      LAGE.drehwerksgehaeuse - 0.06,
      Math.cos(winkel) * 0.16
    );
    leitung.rotation.y = winkel - Math.PI / 2;
    rotator.add(leitung);
    leitungen.add(new THREE.Object3D());
  });

  let stand = 0;

  const setOeffnung = (t: number): void => {
    stand = Math.min(1, Math.max(0, t));
    const schwenk = schwenkFuer(stand);
    /*
     * Um den vollen Schwenk drehen, nicht um die Differenz zum Anschlag.
     *
     * Die Schale wird in `teile.ts` bei Spreizung 0 gebaut — dort liegt ihr
     * eigener Frame. `mittellinie()` rechnet genauso. Stand hier `-(schwenk −
     * ZU)`, dann sass die Schale im geschlossenen Zustand um 31° verdreht: Ihre
     * Spitze ragte quer durch die Drehachse bis 0,52 m auf die Gegenseite,
     * mitten in die Nachbarschale. Im Bild sah man es nicht, weil dort alles
     * dunkel ineinanderliegt — die Sektorpruefung hat es gefangen.
     */
    for (const s of schalen) {
      s.gelenk.rotation.x = rund(-schwenk);
    }
    const l = laschePunkt(schwenk);
    const dr = l.r - ZYLINDER_AUFNAHME.r;
    const dy = l.y - ZYLINDER_AUFNAHME.y;
    const dist = Math.max(Math.hypot(dr, dy), 0.2);
    /*
     * Das Rohr zeigt in seinem Frame nach −y. Eine Drehung um x um ψ bringt
     * (0,−1,0) auf (0, −cos ψ, −sin ψ). Damit das auf (0, dy, dr) zeigt:
     *   ψ = atan2(−dr, −dy)
     */
    const psi = rund(Math.atan2(-dr, -dy));
    for (const z of zylinder) {
      z.gelenk.rotation.x = psi;
      const rohrLaenge = MASS.zylinder.laenge * 0.6;
      const stangenLaenge = Math.max(dist - rohrLaenge + EINSTAND, 0.06);
      z.stange.scale.y = rund(stangenLaenge / (MASS.zylinder.laenge - rohrLaenge - 0.12));
      z.stange.position.y = rund(-rohrLaenge);
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
    traverse,
    schalen,
    zylinder,
    setOeffnung,
    setDrehung,
    oeffnung: () => stand,
  };
}

/** Hüllmaße des Greifers bei gegebenem Öffnungsgrad (Durchmesser, Höhe). */
export function huelle(oeffnung: number): { breite: number; hoehe: number } {
  const bahn = mittellinie(schwenkFuer(oeffnung));
  return {
    breite: 2 * Math.max(...bahn.map((p) => p.r)),
    hoehe: -Math.min(...bahn.map((p) => p.y)),
  };
}

export const SCHWENK_BEREICH = { zu: ZU, offen: OFFEN };
