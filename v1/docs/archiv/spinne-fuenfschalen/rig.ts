/**
 * Zusammenbau des Fünfschalengreifers aus den Einzelteilen.
 *
 * Gebaut wird ausschließlich aus `teile.ts` — dort stehen die Hauptmaße der
 * Explosionszeichnung und die daraus abgetastete Kinematik. Hier steht nur,
 * wo welches Teil sitzt und was sich wie bewegt.
 *
 * Das Verbindungsprinzip der Zeichnung, Stück für Stück:
 *
 *   Oberer Zylinderanschluss   an der Mitteltraverse
 *   Hydraulikzylinder          dazwischen
 *   Obere Schalenanbindung     am Zylinder
 *   Greiferschale
 *   Untere Schalenanbindung    an der zentralen Gelenkeinheit (Stempel)
 *   Greiferspitze              an der Schale
 *
 * Jede Schale hat damit genau EINEN Drehpunkt — unten am Stempel — und wird
 * oben vom Zylinder geschoben. Ein Winkelhebel. Bis zur zweiten Fassung der
 * Zeichnung hatte ich die Schalen an der Mitteltraverse hängen; das war
 * falsch, und es ist der Grund, warum die Form nicht wie eine Birne aussah.
 *
 * Aufbau von oben nach unten, mit den Überdeckungen echter Verschraubungen:
 *
 *   Adapter           0,00 … −0,40
 *   Rotator          −0,36 … −0,66
 *   Drehwerksgehäuse −0,58 … −0,88
 *   Mitteltraverse   −0,80 … −1,20
 *   Stempel          −1,49 … −1,84   (Auge auf −1,66)
 */
import * as THREE from "three";
import {
  MASS,
  OBERE_ANBINDUNG,
  OFFEN,
  STEMPEL_AUGE,
  Stoffe,
  TRAVERSE_Y,
  ZU,
  ZYLINDER_AUFNAHME,
  baueAufhaengung,
  baueDrehwerksgehaeuse,
  baueGreiferschale,
  baueGreiferspitze,
  baueMitteltraverse,
  baueRotator,
  baueStempel,
  baueZylinder,
  mittellinie,
  nahtStoff,
  schalenEnde,
  schwenkFuer,
  stoffe,
} from "./teile";

/** Höhenlage jeder Baugruppe (Mitte, in Metern unter dem Aufhängepunkt). */
export const LAGE = {
  adapter: -0.2,
  rotator: -0.51,
  drehwerksgehaeuse: -0.73,
  traverse: TRAVERSE_Y,
  stempel: STEMPEL_AUGE.y,
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
  stab: THREE.Mesh;
  auge: THREE.Mesh;
  gehoertZu: Schale;
}

export interface Greifer {
  wurzel: THREE.Group;
  adapter: THREE.Group;
  rotator: THREE.Group;
  traverse: THREE.Group;
  stempel: THREE.Group;
  schalen: Schale[];
  zylinder: Zylinder[];
  setOeffnung(t: number): void;
  setDrehung(rad: number): void;
  oeffnung(): number;
}

/**
 * Wo die Kolbenstange an der Schale angreift, im Frame des Greifers.
 *
 * Die obere Anbindung sitzt fest an der Schale und dreht mit ihr um den
 * Drehpunkt am Stempel. Weil Aufnahme und Anbindung auf derselben Radialebene
 * liegen, ist das eine ebene Rechnung.
 */
function anbindungspunkt(schwenk: number): { r: number; y: number } {
  const c = Math.cos(-schwenk);
  const s = Math.sin(-schwenk);
  return {
    r: STEMPEL_AUGE.r + (OBERE_ANBINDUNG.y * s + OBERE_ANBINDUNG.z * c),
    y: STEMPEL_AUGE.y + (OBERE_ANBINDUNG.y * c - OBERE_ANBINDUNG.z * s),
  };
}

/** Abstand zwischen oberem Zylinderanschluss und oberer Schalenanbindung (m). */
export function zylinderLaenge(schwenk: number): number {
  const l = anbindungspunkt(schwenk);
  return Math.hypot(l.r - ZYLINDER_AUFNAHME.r, l.y - ZYLINDER_AUFNAHME.y);
}

/** Neigung des Zylinders gegen die Senkrechte (rad). */
export function zylinderNeigung(schwenk: number): number {
  const l = anbindungspunkt(schwenk);
  return Math.atan2(
    Math.abs(l.r - ZYLINDER_AUFNAHME.r),
    Math.abs(l.y - ZYLINDER_AUFNAHME.y)
  );
}

/**
 * Hebelarm des Zylinders am Drehpunkt der Schale (m).
 *
 * Der senkrechte Abstand des Stempelauges von der Wirkungslinie. Das Moment an
 * der Schale ist Zylinderkraft mal diesem Arm; geht er gegen null, steht die
 * Schale fest, egal wie viel Druck anliegt.
 */
export function hebelarm(schwenk: number): number {
  const l = anbindungspunkt(schwenk);
  const d = Math.max(
    Math.hypot(l.r - ZYLINDER_AUFNAHME.r, l.y - ZYLINDER_AUFNAHME.y),
    1e-6
  );
  const ux = (l.r - ZYLINDER_AUFNAHME.r) / d;
  const uy = (l.y - ZYLINDER_AUFNAHME.y) / d;
  return Math.abs(
    (STEMPEL_AUGE.r - ZYLINDER_AUFNAHME.r) * uy - (STEMPEL_AUGE.y - ZYLINDER_AUFNAHME.y) * ux
  );
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

  const stempel = baueStempel(st);
  stempel.position.y = LAGE.stempel;
  rotator.add(stempel);

  const schalen: Schale[] = [];
  const zylinder: Zylinder[] = [];

  for (let i = 0; i < MASS.schalen; i++) {
    const nr = String(i + 1).padStart(2, "0");
    const a = (i / MASS.schalen) * Math.PI * 2;
    const sin = Math.sin(a);
    const cos = Math.cos(a);

    /* --- Schale: Ursprung auf dem Stempelauge --- */
    const gelenk = new THREE.Group();
    gelenk.name = `SHELL_${nr}`;
    gelenk.position.set(sin * STEMPEL_AUGE.r, STEMPEL_AUGE.y, cos * STEMPEL_AUGE.r);
    gelenk.rotation.order = "YXZ";
    gelenk.rotation.y = a; // lokales +z zeigt radial nach außen
    rotator.add(gelenk);

    const schale = baueGreiferschale(st);
    schale.name = `SHELL_BODY_${nr}`;
    gelenk.add(schale);

    /*
     * Greiferspitze am Ende der letzten Station, in Laufrichtung der Schale.
     * Die Spitze zeigt in ihrem Frame nach −y; eine Drehung um x um `th` bringt
     * (0,−1,0) genau auf die Richtung (0, −cos th, −sin th), in der die Schale
     * dort läuft.
     */
    const ende = schalenEnde();
    const spitze = baueGreiferspitze(st);
    spitze.name = `SHELL_TIP_${nr}`;
    spitze.position.set(0, ende.y, ende.z);
    spitze.rotation.x = ende.th;
    gelenk.add(spitze);

    const schaleRef: Schale = { gelenk, winkel: a };
    schalen.push(schaleRef);

    /* --- Zylinder: Ursprung am oberen Anschluss an der Mitteltraverse --- */
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

    const { gehaeuse: rohrTeil, stange, stab, auge } = baueZylinder(st);
    rohrTeil.name = `CYL_BARREL_${nr}`;
    stange.name = `CYL_ROD_${nr}`;
    /*
     * Stab und Auge bewegen sich einzeln, seit nicht mehr die ganze Gruppe
     * skaliert wird. Sie brauchen darum eigene Namen — der Export legt seine
     * Animationsspuren auf Namen, und was keinen hat, bewegt sich im GLB nicht.
     */
    stab.name = `CYL_ROD_SHAFT_${nr}`;
    auge.name = `CYL_ROD_EYE_${nr}`;
    zylGelenk.add(rohrTeil);
    zylGelenk.add(stange);

    zylinder.push({ gelenk: zylGelenk, rohr: rohrTeil, stange, stab, auge, gehoertZu: schaleRef });
  }

  let stand = 0;

  const setOeffnung = (t: number): void => {
    stand = Math.min(1, Math.max(0, t));
    const schwenk = schwenkFuer(stand);
    for (const s of schalen) {
      s.gelenk.rotation.x = rund(-schwenk);
    }
    const l = anbindungspunkt(schwenk);
    const dr = l.r - ZYLINDER_AUFNAHME.r;
    const dy = l.y - ZYLINDER_AUFNAHME.y;
    const dist = Math.max(Math.hypot(dr, dy), 0.2);
    /*
     * Das Rohr zeigt in seinem Frame nach −y. Eine Drehung um x um ψ bringt
     * (0,−1,0) auf (0, −cos ψ, −sin ψ). Damit das auf (0, dy, dr) zeigt:
     *   ψ = atan2(−dr, −dy)
     */
    const psi = rund(Math.atan2(-dr, -dy));
    const rohrLaenge = MASS.zylinder.laenge * 0.6;
    const auszug = MASS.zylinder.laenge - rohrLaenge - 0.12;
    /*
     * Das Auge der Kolbenstange sitzt GENAU auf dem Anlenkpunkt, also `dist`
     * unter dem oberen Gelenk. Vorher wurde die ganze Stangengruppe skaliert,
     * das Auge also mitgedehnt und mitverschoben — es stand 14 cm hinter
     * seinem Bolzen. Jetzt wird nur der Stab gedehnt; das Auge wird gesetzt.
     */
    const frei = Math.max(dist - rohrLaenge, 0.04);
    for (const z of zylinder) {
      z.gelenk.rotation.x = psi;
      z.stange.position.y = rund(-rohrLaenge);
      z.stab.scale.y = rund((frei + EINSTAND) / auszug);
      z.stab.position.y = rund(EINSTAND - (frei + EINSTAND) / 2);
      z.auge.position.y = rund(-frei);
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
    stempel,
    schalen,
    zylinder,
    setOeffnung,
    setDrehung,
    oeffnung: () => stand,
  };
}

/** Hüllmaße des Greifers bei gegebenem Öffnungsgrad (Durchmesser, Tiefe). */
export function huelle(oeffnung: number): { breite: number; hoehe: number } {
  const bahn = mittellinie(schwenkFuer(oeffnung));
  return {
    breite: 2 * Math.max(...bahn.map((p) => p.r)),
    hoehe: -Math.min(...bahn.map((p) => p.y)),
  };
}

export const SCHWENK_BEREICH = { zu: ZU, offen: OFFEN };
