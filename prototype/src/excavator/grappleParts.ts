/**
 * Die Spinne am Bagger — zusammengesetzt aus den Bauteilen der
 * Explosionszeichnung.
 *
 * Gebaut wird ausschließlich aus `src/grapple/teile.ts`. Hier steht nur, wo
 * welches Teil sitzt und was der Bagger anfassen muss, um es zu bewegen.
 *
 * Bis zum 13.09.2026 stand hier eine eigene Sichelkralle mit eigenen Maßen,
 * während in `src/grapple/` ein zweiter, genauerer Greifer lag, den nur die
 * Vorschauseite zu sehen bekam. Zwei Modelle, die auseinanderlaufen, sobald
 * man an einem von beiden etwas ändert — genau der Fall, vor dem E-154 warnt.
 * Die alte Form liegt vollständig unter `docs/archiv/spinne-sichel/`.
 *
 * Der Kopf beginnt hier beim Rotator, nicht beim Adapter: Der Bagger bringt
 * sein eigenes Kardangelenk samt Gabeln mit, und die sitzen an derselben
 * Stelle, an der das Exportmodell seine Aufhängung trägt.
 */
import * as THREE from "three";
import {
  MASS,
  OBERE_ANBINDUNG,
  STEMPEL_AUGE,
  ZYLINDER_AUFNAHME,
  baueDrehwerksgehaeuse,
  baueGreiferschale,
  baueGreiferspitze,
  baueMitteltraverse,
  baueRotator,
  baueStempel,
  nahtStoff,
  schalenStationen,
  stoffe,
  type Stoffe,
} from "../grapple/teile";
import { LAGE } from "../grapple/rig";

export type SpinnenStoffe = Stoffe;
export function spinnenStoffe(): SpinnenStoffe {
  const st = stoffe();
  nahtStoff(st);
  return st;
}

export interface ZylinderAnlenkung {
  gelenk: THREE.Group;
  obenLokal: THREE.Vector3;
  untenAmGelenk: THREE.Vector3;
  rohr: THREE.Mesh;
  stange: THREE.Mesh;
  rohrLaenge: number;
}

export interface Spinne {
  gruppe: THREE.Group;
  /** Die fünf Schalengelenke — sie werden zum Öffnen gedreht. */
  gelenke: THREE.Group[];
  zylinder: ZylinderAnlenkung[];
}

/** Länge des Zylindergehäuses (m); der Rest ist Kolbenstange. */
const ROHR_LAENGE = MASS.zylinder.laenge * 0.6;

/**
 * Zylinder als zwei Einheitsmeshes.
 *
 * Bewusst einfacher als der Zylinder des Exportmodells: Der Bagger setzt Rohr
 * und Stange jeden Frame selbst, indem er sie in y skaliert
 * (`updateGrappleCylinders`). Ein Teil mit angebautem Auge würde dabei mit
 * gedehnt. Im Exportmodell, wo die Stange einzeln geführt wird, steckt die
 * ausführliche Fassung — hier zählt, dass es auf dem Tablet billig bleibt.
 */
function baueZylinderPaar(st: SpinnenStoffe): { rohr: THREE.Mesh; stange: THREE.Mesh } {
  const r = MASS.zylinder.durchmesser / 2;
  const rohr = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 10), st.gruen);
  rohr.name = "05_ZYLINDERGEHAEUSE";
  const stange = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.5, r * 0.5, 1, 8),
    st.chrom
  );
  stange.name = "05_KOLBENSTANGE";
  return { rohr, stange };
}

export function baueSpinne(st: SpinnenStoffe = spinnenStoffe()): Spinne {
  const gruppe = new THREE.Group();

  const drehwerk = baueRotator(st);
  drehwerk.position.y = LAGE.rotator;
  gruppe.add(drehwerk);

  const gehaeuse = baueDrehwerksgehaeuse(st);
  gehaeuse.position.y = LAGE.drehwerksgehaeuse;
  gruppe.add(gehaeuse);

  const traverse = baueMitteltraverse(st);
  traverse.position.y = LAGE.traverse;
  gruppe.add(traverse);

  const stempel = baueStempel(st);
  stempel.position.y = LAGE.stempel;
  gruppe.add(stempel);

  const stationen = schalenStationen();
  const ende = stationen[stationen.length - 1]!;
  const gelenke: THREE.Group[] = [];
  const zylinder: ZylinderAnlenkung[] = [];

  for (let i = 0; i < MASS.schalen; i++) {
    const a = (i / MASS.schalen) * Math.PI * 2;
    const sin = Math.sin(a);
    const cos = Math.cos(a);

    /*
     * Der Drehpunkt sitzt auf dem Stempelauge, am Äquator der geschlossenen
     * Kugel. Der Bagger dreht diesen Knoten um seine lokale x-Achse; die
     * Schale ist im geschlossenen Zustand gebaut, der Schwenk ist also die
     * Abweichung davon — und weil der geschlossene Anschlag null ist, ist er
     * gleich dem Spreizwinkel.
     */
    const gelenk = new THREE.Group();
    gelenk.position.set(sin * STEMPEL_AUGE.r, STEMPEL_AUGE.y, cos * STEMPEL_AUGE.r);
    gelenk.rotation.order = "YXZ";
    gelenk.rotation.y = a; // lokales +z zeigt radial nach außen
    gruppe.add(gelenk);
    gelenke.push(gelenk);

    gelenk.add(baueGreiferschale(st));
    const spitze = baueGreiferspitze(st);
    spitze.position.set(0, ende.y, ende.z);
    spitze.rotation.x = ende.th;
    gelenk.add(spitze);

    const { rohr, stange } = baueZylinderPaar(st);
    gruppe.add(rohr);
    gruppe.add(stange);
    zylinder.push({
      gelenk,
      obenLokal: new THREE.Vector3(
        sin * ZYLINDER_AUFNAHME.r,
        ZYLINDER_AUFNAHME.y,
        cos * ZYLINDER_AUFNAHME.r
      ),
      untenAmGelenk: new THREE.Vector3(0, OBERE_ANBINDUNG.y, OBERE_ANBINDUNG.z),
      rohr,
      stange,
      rohrLaenge: ROHR_LAENGE,
    });
  }

  return { gruppe, gelenke, zylinder };
}

/** Alle Bauteile einzeln, für den Prüfstand. */
export function einzelteile(st: SpinnenStoffe = spinnenStoffe()): Array<{
  name: string;
  teil: THREE.Object3D;
}> {
  const { rohr, stange } = baueZylinderPaar(st);
  rohr.scale.y = ROHR_LAENGE;
  stange.scale.y = 0.3;
  stange.position.y = -ROHR_LAENGE;
  const zyl = new THREE.Group();
  zyl.add(rohr, stange);
  const schale = new THREE.Group();
  schale.add(baueGreiferschale(st));
  const spitze = baueGreiferspitze(st);
  const st2 = schalenStationen();
  const ende = st2[st2.length - 1]!;
  spitze.position.set(0, ende.y, ende.z);
  spitze.rotation.x = ende.th;
  schale.add(spitze);
  return [
    { name: "Rotator", teil: baueRotator(st) },
    { name: "Drehwerksgehaeuse", teil: baueDrehwerksgehaeuse(st) },
    { name: "Mitteltraverse", teil: baueMitteltraverse(st) },
    { name: "Stempel", teil: baueStempel(st) },
    { name: "Zylinder", teil: zyl },
    { name: "Greiferschale", teil: schale },
  ];
}
