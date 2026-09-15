import * as THREE from "three";
import { farbstoff, verschmelzeBunt, type Bauteil } from "../excavator/bauteile";
import {
  HAARTOENE,
  HAUTTOENE,
  JACKENTOENE,
  STATUR_KLEIN,
  STATUR_LANG,
  type Aussehen,
} from "../delivery/aussehen";

/**
 * DER MENSCH, DER AUS DEM WAGEN STEIGT — eine Figur, zwei Netze.
 *
 * Bis zum 15.09.2026 stieg aus jedem Lastwagen dieselbe Figur: `buildPerson`
 * aus `people.ts`, mit fest eingetippten Farben (`shirt: 0x3c4f63`), egal ob
 * Willi Bäring kam oder Frau Öztürk. Patrick am Gerät: „Schrotthändler sehen
 * verschieden aus — gepflegt bis ölig, klein und dick bis lang und dünn,
 * Wiedererkennungsmerkmale."
 *
 * ────────────────────────────────────────────────────────────────────────
 * WARUM DAS NICHT `buildPerson` GEWORDEN IST
 * ────────────────────────────────────────────────────────────────────────
 *
 * `buildPerson` baut NEUN Netze (zwei Beine, Rumpf, Schulterkugel, zwei Arme,
 * Hals, Kopf, Haarkappe), und alle neun werfen Schatten — **18 Zeichenrufe je
 * Figur**. Dazu kam in `vehicles.ts` noch der Kaffeebecher als zehntes Netz.
 * Gemessen auf Patricks Gerät (14.09.2026): 1322 Zeichenrufe, 21,0 ms je Bild;
 * Dreiecke sind fast gratis, Netze sind der Engpass. Genau deshalb wurde der
 * Baggerfahrer Daniel am 14.09. von 16 Netzen auf zwei zusammengelegt (E-025).
 *
 * Diese Figur macht es genauso: **`KUNDE_HAUT` und `KUNDE_KLEIDUNG`**, mehr
 * nicht. Dass die Kleidung sieben Farben trägt (Jacke, Hose, Stiefel, Haar,
 * Warnorange, Reflex, Merkmal), geht über Eckfarben (`bauteile.ts`), und die
 * kosten drei Zahlen je Eckpunkt — also nichts.
 *
 * `buildPerson` bleibt trotzdem stehen und unverändert: Mario, Janine,
 * Lambert und die beiden Polizisten schwingen damit Arme und Beine
 * (`people.ts`, `police.ts`). Ihnen die Gliedmaßen wegzunehmen wäre ein
 * zweiter Umbau in einem fremden Paket. Was die Kundenfigur dafür aufgibt,
 * steht unten unter „Der Gang".
 *
 * ────────────────────────────────────────────────────────────────────────
 * VERSCHIEDENE STATUR = ANDERE MASSE AM SELBEN BAU
 * ────────────────────────────────────────────────────────────────────────
 *
 * Es gibt nicht „die dicke Figur" und „die dünne Figur", es gibt eine Figur
 * mit zwei Reglern. `groesse` (1,58–1,92 m) streckt alle Höhen, `fuelle`
 * (0–1) verbreitert Rumpf, Schultern, Ober- und Unterschenkel und Arme — den
 * Kopf fast nicht, sonst wird aus einem stämmigen Mann ein Wasserkopf.
 *
 * `pflege` läuft nicht über die Form, sondern über die Farbe: Jede Farbe
 * dieser Figur wird zum Ölton hin gemischt, je öliger desto weiter. Das ist
 * ein Griff und wirkt auf Jacke, Hose, Stiefel und sogar die Warnweste — und
 * eine verdreckte Warnweste ist genau das, was man auf einem Platz sieht.
 */

/** Hose — der Arbeitshosen-Ton aus `people.ts`, unverändert übernommen. */
const HOSE = 0x2b2f33;
/** Stiefel. SW, dasselbe Schwarzbraun wie am Baggerfahrer (`driver.ts`). */
const STIEFEL = 0x2a2724;
/** Warnorange nach EN ISO 20471, wie am Baggerfahrer (`driver.ts`). */
const WARN = 0xf0741a;
/** Reflexstreifen, wie am Baggerfahrer. */
const REFLEX = 0xdfe4e8;
/** Gold der Kette. SW — kräftig, sonst sieht man es auf 15 m nicht. */
const GOLD = 0xd8a628;
/** Stahl der Uhr. SW. */
const STAHL = 0xc9ccd2;
/** Leder der Bauchtasche. SW. */
const LEDER = 0x3a3129;
/**
 * Wohin die Farben wandern, wenn einer ölig ist: altes Öl auf Baumwolle.
 * SW, 15.09.2026.
 */
const OEL = 0x2b241c;
/**
 * Wie weit eine Farbe höchstens zum Ölton wandert (bei `pflege` = 0).
 *
 * 0,55. Bei 1,0 wäre der Ölige einfarbig schwarz und man erkennte ihn nicht
 * mehr wieder; bei 0,3 sähe man den Unterschied auf dem Gerät nicht.
 * SW, am Bildschirm einzustellen.
 */
const DRECK_MAX = 0.55;

/**
 * Wie viele Ecken ein Körperteil bekommt: sechs.
 *
 * Dieselbe Zahl und derselbe Grund wie beim Baggerfahrer (`driver.ts`,
 * E-025): „Ein Sechseck-Profil genügt, es bricht die Silhouette." Zwölf Ecken
 * sähen wieder rund aus — Playmobil —, vier wie ein Karton.
 */
const ECKEN = 6;

/** Farbe zum Ölton hin mischen. 0 = sauber, 1 = maximal dreckig. */
function schmutzig(farbe: number, anteil: number): number {
  const a = new THREE.Color(farbe);
  return a.lerp(new THREE.Color(OEL), anteil).getHex();
}

/** Ein stehendes Sechskantprofil mit Mitte bei (x, y, z). */
function hex(r: number, h: number, x: number, y: number, z: number, drehung = 0): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, h, ECKEN);
  if (drehung !== 0) g.rotateY(drehung);
  g.translate(x, y, z);
  return g;
}

/** Ein Quader mit Mitte bei (x, y, z). */
function box(
  bx: number,
  by: number,
  bz: number,
  x: number,
  y: number,
  z: number
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(bx, by, bz);
  g.translate(x, y, z);
  return g;
}

export interface Kundenfigur {
  /** Ursprung an den Füßen, Blickrichtung +z (wie `buildPerson`). */
  group: THREE.Group;
  haut: THREE.Mesh;
  kleidung: THREE.Mesh;
  /**
   * Ein Gehschritt.
   *
   * DER GANG. Die Figur hat keine beweglichen Glieder mehr — vier
   * Schwingteile wären vier zusätzliche Netze, also acht Zeichenrufe, und der
   * Engpass ist gemessen genau dort. Stattdessen wippt und wiegt sich der
   * ganze Körper im Schritttakt. Auf den 15 bis 30 m, aus denen man einen
   * Kunden über den Hof laufen sieht, liest sich das als Gehen; was fehlt,
   * ist das Scherenspiel der Beine aus der Nähe.
   *
   * Das ist die eine Sache, die diese Figur gegenüber `buildPerson`
   * aufgegeben hat, und sie gehört Patrick zur Abnahme vorgelegt.
   */
  schritt(dt: number, geht: boolean): void;
  dispose(): void;
}

/**
 * Die Figur bauen. Zwei Netze, sieben Farben, eine Statur.
 *
 * Alle Maße sind Anteile der Körperhöhe `a.groesse` — so ist der Kleine
 * wirklich klein und nicht nur gestaucht. Die Zahlenreihe stammt aus den
 * Proportionen von `buildPerson` (Kopf ≈ 1/13 der Höhe, Schulter bei 0,84,
 * Schritt bei 0,47) und ist damit dieselbe Figur, nur sauber auf die Füße
 * gestellt: Bei `buildPerson` begannen die Stiefel 25 cm über dem Boden.
 */
export function baueKundenfigur(a: Aussehen): Kundenfigur {
  const H = THREE.MathUtils.clamp(a.groesse, STATUR_KLEIN, STATUR_LANG);
  const f = THREE.MathUtils.clamp(a.fuelle, 0, 1);
  const dreck = (1 - THREE.MathUtils.clamp(a.pflege, 0, 1)) * DRECK_MAX;
  const t = (farbe: number): number => schmutzig(farbe, dreck);

  const jacke = t(JACKENTOENE[a.jacke % JACKENTOENE.length]!);
  const hose = t(HOSE);
  const stiefel = t(STIEFEL);
  const haar = HAARTOENE[a.haar % HAARTOENE.length]!;
  const hautton = HAUTTOENE[a.haut % HAUTTOENE.length]!;

  /* Breiten. `f` = 0 ist lang und dünn, `f` = 1 klein und dick. */
  const rRumpf = 0.150 + 0.085 * f; // 15,0 – 23,5 cm Radius
  const rBein = 0.070 + 0.030 * f;
  const rArm = 0.050 + 0.020 * f;
  const rKopf = 0.106 + 0.014 * f; // der Kopf wächst kaum mit
  const bSchulter = 0.42 + 0.12 * f;

  /* Höhen als Anteil der Körperhöhe. */
  const ySohle = 0.025 * H;
  const yKnie = 0.26 * H;
  const ySchritt = 0.47 * H;
  const ySchulter = 0.82 * H;
  const yHals = 0.87 * H;
  const yKopf = 0.925 * H;
  const yHand = 0.50 * H;

  const kleider: Bauteil[] = [];
  const haeute: Bauteil[] = [];
  const spurX = 0.055 + 0.02 * f; // halber Standabstand der Füße

  // ---- Stiefel und Beine ------------------------------------------------
  for (const sx of [-1, 1]) {
    kleider.push({
      geo: box(rBein * 2.1, ySohle * 2, rBein * 3.0, sx * spurX, ySohle, 0.02 * H),
      farbe: stiefel,
    });
    // Ein Bein, zweiteilig: Unterschenkel schmaler als Oberschenkel. Das ist
    // der ganze Unterschied zwischen „Bein" und „Rohr".
    kleider.push({
      geo: hex(rBein * 0.82, yKnie - ySohle, sx * spurX, (yKnie + ySohle) / 2, 0),
      farbe: hose,
    });
    kleider.push({
      geo: hex(rBein, ySchritt - yKnie + 0.02 * H, sx * spurX, (ySchritt + yKnie) / 2, 0),
      farbe: hose,
    });
  }

  // ---- Rumpf: die Jacke -------------------------------------------------
  kleider.push({
    geo: hex(rRumpf, ySchulter - ySchritt, 0, (ySchulter + ySchritt) / 2, 0),
    farbe: jacke,
  });
  // Eckige Schultern statt der Kugel — dieselbe Lehre wie bei Daniel.
  kleider.push({
    geo: box(bSchulter, 0.055 * H, rRumpf * 1.6, 0, ySchulter, 0),
    farbe: jacke,
  });

  // ---- Warnweste --------------------------------------------------------
  if (a.weste) {
    // Sie sitzt über der Jacke, also ein Fingerbreit weiter außen, und ist
    // vorne offen — deshalb etwas kürzer als der Rumpf.
    kleider.push({
      geo: hex(rRumpf + 0.018, (ySchulter - ySchritt) * 0.62, 0, ySchritt + (ySchulter - ySchritt) * 0.62, 0),
      farbe: t(WARN),
    });
    for (const rel of [0.42, 0.72]) {
      kleider.push({
        geo: hex(rRumpf + 0.024, 0.016 * H, 0, ySchritt + (ySchulter - ySchritt) * rel, 0),
        farbe: t(REFLEX),
      });
    }
  }

  // ---- Arme -------------------------------------------------------------
  const xArm = bSchulter / 2 - rArm * 0.5;
  for (const sx of [-1, 1]) {
    kleider.push({
      geo: hex(rArm, ySchulter - yHand - 0.03 * H, sx * xArm, (ySchulter + yHand) / 2, 0),
      farbe: jacke,
    });
    haeute.push({ geo: hex(rArm * 0.88, 0.055 * H, sx * xArm, yHand, 0), farbe: hautton });
  }

  // ---- Hals, Kopf, Haar -------------------------------------------------
  haeute.push({ geo: hex(rKopf * 0.55, yKopf - yHals + 0.02 * H, 0, (yKopf + yHals) / 2, 0), farbe: hautton });
  const kopf = new THREE.SphereGeometry(rKopf, 10, 7);
  kopf.scale(1, 1.1, 1.02);
  kopf.translate(0, yKopf, 0);
  haeute.push({ geo: kopf, farbe: hautton });

  if (a.merkmal === "muetze") {
    // Eine Schirmmütze ersetzt die Haarkappe: flacher Deckel plus Schirm.
    kleider.push({ geo: hex(rKopf * 1.06, 0.035 * H, 0, yKopf + rKopf * 0.55, 0), farbe: jacke });
    kleider.push({
      geo: box(rKopf * 1.7, 0.012 * H, rKopf * 1.1, 0, yKopf + rKopf * 0.42, rKopf * 1.0),
      farbe: jacke,
    });
  } else {
    const kappe = new THREE.SphereGeometry(rKopf * 1.05, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.62);
    kappe.scale(1, 1.05, 1.02);
    kappe.translate(0, yKopf, -0.004);
    kleider.push({ geo: kappe, farbe: haar });
  }

  // ---- Das Wiedererkennungsmerkmal --------------------------------------
  if (a.merkmal === "goldkette") {
    /*
     * Ein Achteck-Ring auf dem Schlüsselbein — rund genug, und rund ist hier
     * teuer (40 Dreiecke). Er liegt einen Fingerbreit ÜBER der Schulterlinie
     * und ein Stück nach vorn: Läge er auf Halshöhe, hinge er in der Luft;
     * läge er tiefer, verschwände er unter der Warnweste.
     */
    const kette = new THREE.TorusGeometry(rKopf * 0.62, 0.009, 4, 8);
    kette.rotateX(Math.PI / 2);
    kette.translate(0, ySchulter + 0.015 * H, rRumpf * 0.35);
    kleider.push({ geo: kette, farbe: GOLD });
  }
  if (a.merkmal === "uhr") {
    // Am linken Handgelenk, direkt über der Hand.
    kleider.push({
      geo: box(rArm * 1.5, 0.022 * H, rArm * 1.5, -xArm, yHand + 0.035 * H, 0),
      farbe: STAHL,
    });
  }
  if (a.merkmal === "bauchtasche") {
    kleider.push({
      geo: box(rRumpf * 1.5, 0.055 * H, rRumpf * 0.7, 0, ySchritt + 0.06 * H, rRumpf * 0.75),
      farbe: t(LEDER),
    });
  }

  // ---- Der Kaffeebecher -------------------------------------------------
  /*
   * Er stand bis heute als EIGENES Netz in `vehicles.ts` (`becher`) und war
   * damit das zehnte. Jetzt gehört er zur Kleidung und kostet nichts mehr.
   * Er ist immer in der Hand — das ist die zweite kleine Einbuße gegenüber
   * dem beweglichen Arm, der ihn zum Mund führte.
   */
  kleider.push({
    geo: hex(0.042, 0.10, xArm * 0.92, yHand + 0.055 * H, 0.055),
    farbe: 0xe8e2d5,
  });

  const group = new THREE.Group();
  const gHaut = verschmelzeBunt(haeute, "KUNDE_HAUT");
  const gKleid = verschmelzeBunt(kleider, "KUNDE_KLEIDUNG");
  const haut = new THREE.Mesh(gHaut, farbstoff(0.8));
  haut.name = "KUNDE_HAUT";
  /*
   * NUR DIE KLEIDUNG WIRFT SCHATTEN — dieselbe Regel wie bei Daniel
   * (`test/fahrer.test.ts`). Der Kopf steckt in der Silhouette von Haar und
   * Schultern; sein Schatten wäre nicht zu unterscheiden, kostete aber einen
   * zweiten Zeichenruf.
   */
  haut.castShadow = false;
  const kleidung = new THREE.Mesh(gKleid, farbstoff(0.9));
  kleidung.name = "KUNDE_KLEIDUNG";
  kleidung.castShadow = true;
  group.add(haut, kleidung);

  let phase = 0;
  return {
    group,
    haut,
    kleidung,
    schritt(dt: number, geht: boolean): void {
      if (!geht) {
        phase = 0;
        group.position.y = 0;
        group.rotation.z = 0;
        return;
      }
      // 3,5 Schritte je Sekunde bei 1,5 m/s Gehtempo (`vehicles.ts`,
      // FAHRER_TEMPO) — das ist normaler Gang, kein Trippeln.
      phase += dt * 7;
      group.position.y = Math.abs(Math.sin(phase)) * 0.016 * H;
      group.rotation.z = Math.sin(phase * 0.5) * 0.045;
    },
    dispose(): void {
      gHaut.dispose();
      gKleid.dispose();
      (haut.material as THREE.Material).dispose();
      (kleidung.material as THREE.Material).dispose();
    },
  };
}

/**
 * DER HUND — der einzige Sonderfall, und der einzige, der ein Netz kostet.
 *
 * Auftrag wörtlich: „Er läuft nicht mit, er sitzt im Fahrerhaus oder auf der
 * Ladefläche und wird nicht simuliert. Wenn er mehr kostet als ein Netz, lass
 * ihn weg." Er kostet **genau ein Netz** — Rumpf, Kopf, Schnauze, zwei Ohren,
 * Vorderläufe und Rute sind zu einer Geometrie verschmolzen —, und weil er im
 * getönten Fahrerhaus sitzt, wirft er **keinen** Schatten. Damit ist er ein
 * Zeichenruf, nicht zwei.
 *
 * Er hängt am FAHRZEUG, nicht an der Figur: Er sitzt schon da, wenn der Wagen
 * durchs Tor rollt, und er bleibt sitzen, wenn sein Herrchen zum Kaffeewagen
 * geht. Ein Hund, der beim Aussteigen erscheint und beim Einsteigen
 * verschwindet, wäre schlechter als keiner.
 *
 * Drei von 23 Kunden haben einen (`test/kundenaussehen.test.ts` deckelt es
 * bei jedem Fünften). Der Ursprung liegt zwischen den Vorderpfoten,
 * Blickrichtung +z.
 */
export function baueHund(a: Aussehen): THREE.Mesh | null {
  if (a.merkmal !== "hund") return null;
  /** Fell. SW — schwarz-lohfarben, wie ein Schäferhund. */
  const FELL = 0x6b5237;
  const SATTEL = 0x2c2622;
  const teile: Bauteil[] = [
    // Sitzender Rumpf, nach hinten geneigt
    { geo: box(0.26, 0.42, 0.30, 0, 0.30, -0.04), farbe: SATTEL },
    { geo: box(0.24, 0.20, 0.26, 0, 0.13, -0.10), farbe: FELL },
    // Vorderläufe
    { geo: box(0.07, 0.30, 0.09, -0.08, 0.15, 0.10), farbe: FELL },
    { geo: box(0.07, 0.30, 0.09, 0.08, 0.15, 0.10), farbe: FELL },
    // Hals und Kopf
    { geo: box(0.17, 0.14, 0.17, 0, 0.55, 0.01), farbe: SATTEL },
    { geo: box(0.17, 0.16, 0.19, 0, 0.66, 0.04), farbe: FELL },
    // Schnauze
    { geo: box(0.09, 0.08, 0.15, 0, 0.63, 0.16), farbe: SATTEL },
    // Stehohren — das Erkennungszeichen schlechthin
    { geo: box(0.05, 0.11, 0.02, -0.055, 0.78, 0.0), farbe: SATTEL },
    { geo: box(0.05, 0.11, 0.02, 0.055, 0.78, 0.0), farbe: SATTEL },
    // Rute, am Boden liegend
    { geo: box(0.06, 0.06, 0.24, 0, 0.06, -0.26), farbe: FELL },
  ];
  const geo = verschmelzeBunt(teile, "KUNDE_HUND");
  const hund = new THREE.Mesh(geo, farbstoff(0.95));
  hund.name = "KUNDE_HUND";
  hund.castShadow = false;
  return hund;
}
