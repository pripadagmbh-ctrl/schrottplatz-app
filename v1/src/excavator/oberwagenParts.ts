import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { AUSLEGER_FUSS, AUSLEGER_FUSS_AUSSEN } from "./armParts";
import { verschmelze } from "./bauteile";
import { drehkranzDeckel, PLATTE_UNTEN } from "./drehkranzParts";

/**
 * Der Oberwagen des Baggers, Bauteil für Bauteil.
 *
 * Teileliste `docs/baggerkonzept.md` Abschnitt 05, beschlossen in E-025;
 * Frage 2 („Geländer auf dem Oberwagen") hat Patrick am 15.09.2026 mit „ja,
 * mit Aufstieg, Knieleiste bleibt drin" beantwortet.
 *
 * WARUM. Gemessen am 14.09.2026 kam der ganze Oberwagen auf **120 Dreiecke** —
 * Motorhaube 12, Gegengewicht 12, dazu acht Lüftungsschlitze à 12. Weniger als
 * ein einzelner Fingernagel des Fahrers (der kostete 4 648). Und er kostete
 * dafür **10 Netze**, acht davon für die acht Schlitze.
 *
 * Alle Bezugsmaße sind im Frame des Oberwagens angeschrieben; sein Ursprung
 * liegt bei y 1,60 über Grund (`cabGroup.position` in `excavator.ts`).
 *
 * DREI NETZE (E-025: ein Netz je Starrkörper und Werkstoff):
 *   `05_OBERWAGEN_LACK`  — grün: Laufblech, gestufte Motorhaube mit
 *                          Wartungsklappe, Hydrauliktank, Ölkühler
 *   `04_DREHKRANZ`       — anthrazit: Deckplatte, Drehkranzdeckel,
 *                          Lüftungsgitter, Kühlergitter, Gegengewicht,
 *                          Geländer, Auspuff, Lagerböcke der Hubzylinder
 *   `05_LEUCHTEN`        — leuchtend: zwei Arbeitsscheinwerfer, zwei
 *                          Rückleuchten
 *
 * Der Name `04_DREHKRANZ` bleibt am Stahl-Netz, weil der Drehkranzdeckel darin
 * steckt und `test/baggerteile.test.ts` ihn dort sucht.
 *
 * DAS GELÄNDER ist der teuerste Einzelposten in Dreiecken (rund 1 800) und der
 * billigste in Netzen (null — es liegt im Stahl-Netz). Es ist zugleich das,
 * was eine Umschlagmaschine von einem Spielzeugbagger unterscheidet.
 */

/** Breite der Deckplatte (m) — unverändert. */
const DECK_B = 2.9;
/** Tiefe der Deckplatte (m) — unverändert. */
const DECK_T = 3.2;
/** Oberkante der Deckplatte im Oberwagen-Frame (m) — unverändert seit je. */
export const DECK_OBEN = 0.355;

/** Vorderkante der Motorhaube (m, im Oberwagen-Frame). Unverändert. */
export const HAUBE_VORN = -0.15;
/** Hinterkante der Motorhaube (m). Unverändert. */
export const HAUBE_HINTEN = -1.85;
/** Halbe Breite der Motorhaube unten (m). Unverändert. */
export const HAUBE_HALB = 1.25;
/** Oberkante der Motorhaube (m). Unverändert — die Silhouette bleibt. */
export const HAUBE_OBEN = 1.355;
/**
 * Höhe der unteren Haubenstufe (m). Konzept 05.2: unten 0,72 hoch, oben 1,00.
 *
 * Die Stufe ist der ganze Unterschied zwischen „Kiste" und „Motorraum": Unten
 * sitzt der Block, oben nur noch der Aufbau mit den Gittern.
 */
export const HAUBE_STUFE = DECK_OBEN + 0.72;

/**
 * DIE AUSSPARUNG für das Kabinenhubwerk (E-040, Paket 8 aus E-025).
 *
 * Der Mast hinter der Kabine steht mit seiner inneren Säule bei x −0,63,
 * z −0,894 — mitten in der Motorhaube. Und nicht nur der Fuß: In der
 * UNTERSTEN Kabinenstellung steht der Lenker so steil, dass er die
 * Haubenvorderkante (z −0,15) auf y 0,567 durchstößt. Eine Bohrung für die
 * Säule allein reicht deshalb nicht — die Aussparung muss nach VORN offen
 * sein.
 *
 * Gemessen, nicht geschätzt (`npx vite-node tools/kabinenhub-bahn.ts`):
 * Der Lenker läuft nur zwischen 49,1° und 65,7° Neigung überhaupt in die
 * Haube und reicht dabei nie hinter z −0,507. Die Tiefe von z −1,06 kommt
 * allein von der Mastsäule, die Breite von 0,34 m vom Lenkerkasten (0,14)
 * plus 10 cm Luft je Seite.
 *
 * WAS SIE KOSTET: 0,29 m³ von 3,91 m³ Haubenvolumen, also **7,4 %**. Die
 * Flanke bei x −1,25 bleibt stehen — dort sitzen die fünf Lüftungslamellen,
 * und auf ihrer Schulter steht der vordere Geländerpfosten (x −1,08). Eine
 * Aussparung bis zur Flanke („echte Ecke") hätte beide mitgenommen.
 */
export const NISCHE = { xVon: -0.8, xBis: -0.46, zHinten: -1.06 };

/** Höhe des Handlaufs über dem Deck (m). Konzept 05.4. SW nach Riss. */
const GELAENDER_H = 0.9;
/**
 * Halbe Breite des Geländers (m).
 *
 * 1,08 — die Mitte des Laufgangs zwischen oberer Haubenstufe (0,91) und
 * unterer (1,25). Weiter außen stünde der Pfosten über der Kante, weiter innen
 * auf dem Motoraufbau.
 */
const GELAENDER_X = 1.08;
/** Rohrhalbmesser des Geländers (m). SW. */
const ROHR_R = 0.028;
/** Umfangssegmente der Geländerrohre. Konzept 05.4: 8. */
const ROHR_SEG = 8;

/** Ein liegendes Rohr zwischen zwei Punkten — Handlauf, Knieleiste, Pfosten. */
function rohr(a: THREE.Vector3, b: THREE.Vector3): THREE.BufferGeometry {
  const d = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(ROHR_R, ROHR_R, d.length(), ROHR_SEG);
  g.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize())
  );
  g.translate(a.x + d.x / 2, a.y + d.y / 2, a.z + d.z / 2);
  return g;
}

/**
 * 05.1 — Laufblech mit Sicken auf dem Heckdeck.
 *
 * Das Blech, auf dem man steht, wenn man oben ist. Die Sicken sind
 * Trittsicherung; sie sind der Grund, warum das Deck nicht wie eine
 * Tischplatte aussieht.
 */
function laufblech(): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const blech = new THREE.BoxGeometry(0.34, 0.03, 1.5);
    blech.translate(sx * 1.26, DECK_OBEN + 0.015, -0.95);
    teile.push(blech);
    for (let i = 0; i < 6; i++) {
      const sicke = new THREE.BoxGeometry(0.3, 0.012, 0.05);
      sicke.translate(sx * 1.26, DECK_OBEN + 0.036, -0.35 - i * 0.23);
      teile.push(sicke);
    }
  }
  return teile;
}

/**
 * 05.2 — Motorhaube, GESTUFT, mit Wartungsklappe, zwei Scharnieren und
 * Verschluss.
 *
 * Vorher ein Quader 2,50 × 1,00 × 1,70 mit 12 Dreiecken. Oberkante und
 * Grundfläche bleiben, wo sie waren — nur die Stufe, die Klappe und die
 * Beschläge kommen dazu.
 */
function motorhaube(): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  const mitteZ = (HAUBE_VORN + HAUBE_HINTEN) / 2;
  const laenge = HAUBE_VORN - HAUBE_HINTEN;

  /**
   * Eine Stufe der Haube als drei Quader um die Aussparung herum: linkes
   * Band, rechter Teil, hinteres Stück. Vorher war jede Stufe EIN Quader —
   * die Aussparung ist der einzige Grund für die Teilung.
   */
  const stufe = (halb: number, yVon: number, yBis: number, zVon: number, zBis: number): void => {
    const felder: Array<[number, number, number, number]> = [
      [-halb, NISCHE.xVon, zVon, zBis],
      [NISCHE.xBis, halb, zVon, zBis],
      [NISCHE.xVon, NISCHE.xBis, zVon, Math.min(zBis, NISCHE.zHinten)],
    ];
    for (const [x0, x1, z0, z1] of felder) {
      if (x1 - x0 < 1e-6 || z1 - z0 < 1e-6) continue;
      const q = new THREE.BoxGeometry(x1 - x0, yBis - yVon, z1 - z0);
      q.translate((x0 + x1) / 2, (yVon + yBis) / 2, (z0 + z1) / 2);
      teile.push(q);
    }
  };
  stufe(HAUBE_HALB, DECK_OBEN, HAUBE_STUFE, HAUBE_HINTEN, HAUBE_VORN);
  stufe(
    HAUBE_HALB - 0.17,
    HAUBE_STUFE,
    HAUBE_OBEN,
    mitteZ - 0.06 - (laenge - 0.3) / 2,
    mitteZ - 0.06 + (laenge - 0.3) / 2
  );
  // Wartungsklappe links (+X), leicht vorstehend, mit Scharnieren und Verschluss
  const klappe = new THREE.BoxGeometry(0.035, 0.5, 0.92);
  klappe.translate(HAUBE_HALB + 0.01, DECK_OBEN + 0.36, mitteZ);
  teile.push(klappe);
  for (const dz of [-0.36, 0.36]) {
    const scharnier = new THREE.BoxGeometry(0.05, 0.07, 0.11);
    scharnier.translate(HAUBE_HALB + 0.02, DECK_OBEN + 0.6, mitteZ + dz);
    teile.push(scharnier);
  }
  const verschluss = new THREE.BoxGeometry(0.055, 0.1, 0.08);
  verschluss.translate(HAUBE_HALB + 0.03, DECK_OBEN + 0.2, mitteZ);
  teile.push(verschluss);
  return teile;
}

/**
 * 05.6 — Hydrauliktank und Ölkühler seitlich auf dem Deck.
 *
 * Sie stehen zwischen Haube und Geländer und füllen den Streifen, der sonst
 * leeres Blech wäre. Beim Vorbild sitzt dort genau das.
 *
 * SEIT E-040 SITZEN SIE WEITER HINTEN und sind 23 cm kürzer: Sie standen bei
 * x ±1,32 genau da, wo jetzt die äußere Mastsäule des Kabinenhubs auf dem
 * Deck steht (x −1,47, z −0,894), und der äußere Lenker streifte in der
 * untersten Stellung ihren Deckel. Gemessen bleiben jetzt 4,6 cm Luft zur
 * Säule und 17 cm zum Schwenkraum des Lenkers. Alle x-Maße sind unverändert.
 */
function tankUndKuehler(): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  const mitteZ = -1.45;
  for (const sx of [-1, 1]) {
    const kasten = new THREE.BoxGeometry(0.16, 0.44, 0.72);
    kasten.translate(sx * 1.32, DECK_OBEN + 0.22, mitteZ);
    teile.push(kasten);
    const deckel = new THREE.BoxGeometry(0.2, 0.04, 0.76);
    deckel.translate(sx * 1.32, DECK_OBEN + 0.46, mitteZ);
    teile.push(deckel);
  }
  return teile;
}

/**
 * 05.2 — Lüftungsgitter (zwei Felder à fünf Lamellen) und Kühlergitter hinten.
 *
 * Vorher waren die acht Lamellen ACHT Netze — 16 Zeichenrufe für acht Quader
 * mit zusammen 96 Dreiecken. Jetzt liegen zehn Lamellen plus das Kühlergitter
 * im Stahl-Netz und kosten keinen einzigen.
 */
function gitter(): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const lamelle = new THREE.BoxGeometry(0.04, 0.42, 0.11);
      lamelle.translate(sx * (HAUBE_HALB + 0.01), DECK_OBEN + 0.46, -0.5 - i * 0.21);
      teile.push(lamelle);
    }
  }
  // Kühlergitter an der Rückwand der Haube: senkrechte Stäbe
  for (let i = 0; i < 9; i++) {
    const stab = new THREE.BoxGeometry(0.06, 0.5, 0.035);
    stab.translate(-0.8 + i * 0.2, DECK_OBEN + 0.4, HAUBE_HINTEN - 0.015);
    teile.push(stab);
  }
  return teile;
}

/**
 * 05.3 — Gegengewicht, gegossen: Fase, Griffleiste, Typenschild.
 *
 * Vorher ein Quader. Die Fase unten ist es, die ein Gussteil von einer Kiste
 * unterscheidet; die Griffleiste gibt der Fläche Maßstab.
 */
function gegengewicht(): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  const block = new THREE.BoxGeometry(2.4, 0.75, 0.7);
  block.translate(0, 0.5, -2.0);
  teile.push(block);
  // Fase: schmalerer Sockel darunter, so läuft das Gewicht nach unten aus
  const fase = new THREE.BoxGeometry(2.1, 0.12, 0.54);
  fase.translate(0, 0.07, -2.0);
  teile.push(fase);
  // Griffleiste quer über die Rückseite
  teile.push(
    rohr(new THREE.Vector3(-0.95, 0.72, -2.37), new THREE.Vector3(0.95, 0.72, -2.37))
  );
  for (const sx of [-0.95, 0.95]) {
    teile.push(rohr(new THREE.Vector3(sx, 0.72, -2.37), new THREE.Vector3(sx, 0.72, -2.32)));
  }
  // Typenschild
  const schild = new THREE.BoxGeometry(0.34, 0.16, 0.02);
  schild.translate(0.6, 0.42, -2.36);
  teile.push(schild);
  return teile;
}

/**
 * 05.4 — das umlaufende GELÄNDER auf dem Heckdeck.
 *
 * WO ES STEHT, und warum es nicht an der Deckkante steht: Zwischen Motorhaube
 * (±1,25 m) und Deckkante (±1,45 m) bleiben 20 cm — zu wenig, um darauf zu
 * gehen, und im Bild klebte das Geländer an der Haubenflanke wie ein
 * angeschraubter Käfig (erster Versuch, 15.09.2026).
 *
 * Am Vorbild ist das Heckdeck die SCHULTER der gestuften Haube: Die untere
 * Stufe reicht bis ±1,25 m, die obere nur bis ±0,91 m, dazwischen liegt auf
 * y 1,075 ein 34 cm breiter Laufgang rund um den Motoraufbau. Genau dort steht
 * das Geländer — und erst dadurch bekommt die Stufe einen Sinn.
 *
 * Es beginnt bei z −0,35, also hinter der Kabine, und läuft bis z −1,80 sowie
 * quer über das Heck. Sechs Pfosten, wie im Konzept.
 */
function gelaender(): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  const yFuss = HAUBE_STUFE;
  const yHand = yFuss + GELAENDER_H;
  const yKnie = yFuss + GELAENDER_H * 0.5;
  const zVorn = -0.35;
  const zHinten = -1.8;
  const pfosten: Array<[number, number]> = [];
  for (const sx of [-1, 1]) {
    const x = sx * GELAENDER_X;
    for (const y of [yHand, yKnie]) {
      teile.push(rohr(new THREE.Vector3(x, y, zVorn), new THREE.Vector3(x, y, zHinten)));
    }
    for (let i = 0; i < 3; i++) {
      pfosten.push([x, zVorn + ((zHinten - zVorn) * i) / 2]);
    }
  }
  // Querlauf hinten — er schließt den Rundgang
  for (const y of [yHand, yKnie]) {
    teile.push(
      rohr(
        new THREE.Vector3(-GELAENDER_X, y, zHinten),
        new THREE.Vector3(GELAENDER_X, y, zHinten)
      )
    );
  }
  for (const [x, z] of pfosten) {
    teile.push(rohr(new THREE.Vector3(x, yFuss, z), new THREE.Vector3(x, yHand + 0.02, z)));
    // Fußplatte, mit der der Pfosten auf dem Laufgang verschraubt ist
    const platte = new THREE.BoxGeometry(0.1, 0.02, 0.1);
    platte.translate(x, yFuss + 0.01, z);
    teile.push(platte);
  }
  return teile;
}

/** 05.5 — Auspuffrohr mit Regenkappe, oben aus der Haube. */
function auspuff(): THREE.BufferGeometry[] {
  const x = -0.86;
  const z = -0.55;
  const rohrG = new THREE.CylinderGeometry(0.058, 0.07, 0.5, 10);
  rohrG.translate(x, HAUBE_OBEN + 0.2, z);
  const kappe = new THREE.CylinderGeometry(0.095, 0.075, 0.05, 10);
  kappe.translate(x, HAUBE_OBEN + 0.47, z);
  const scharnier = new THREE.BoxGeometry(0.03, 0.06, 0.09);
  scharnier.translate(x, HAUBE_OBEN + 0.44, z + 0.09);
  return [rohrG, kappe, scharnier];
}

/**
 * Lagerböcke der beiden Hubzylinder, vorn unter der Deckplatte.
 *
 * Sie sind neu und nötig: Die Fußanker sitzen bei y 0,02 im Oberwagen-Frame,
 * also 20 cm UNTER der Deckplatte, die seit dem Drehkranz-Paket erst bei
 * y 0,22 beginnt. Ohne Bock käme der Zylinder aus der Luft.
 *
 * @param anker Fußanker im Oberwagen-Frame (x, y, z) — aus `excavator.ts`
 */
function hubLagerboecke(anker: Array<[number, number, number]>): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  for (const [x, y, z] of anker) {
    for (const s of [-1, 1]) {
      const blech = new THREE.BoxGeometry(0.035, PLATTE_UNTEN - y + 0.06, 0.26);
      blech.translate(x + s * 0.14, (y + PLATTE_UNTEN + 0.06) / 2, z);
      teile.push(blech);
    }
    const steg = new THREE.BoxGeometry(0.32, 0.05, 0.26);
    steg.translate(x, PLATTE_UNTEN + 0.02, z);
    teile.push(steg);
  }
  return teile;
}

/* ------------------------------------------------------ DER AUSLEGERBOCK */

/**
 * DER AUSLEGERBOCK (E-050) — das Gelenk, an dem die ganze Last hängt.
 *
 * BEFUND vom 15.09.2026 (Patrick am Gerät: „Keine Verbindung des Arms am
 * Turm"), nachgemessen mit `npx vite-node tools/auslegerbock.ts`: Der tiefste
 * Punkt des Auslegerfußes liegt auf y 2,691 über Grund, das nächste Bauteil
 * darunter ist die Deckplatte auf y 1,955. Dazwischen standen über die ganze
 * Breite **0,736 m nichts**. Der Arm schwebte über dem Aufbau.
 *
 * WAS HIER GEBAUT WIRD, Teil für Teil wie am Vorbild (Umschlagmaschine):
 *   zwei LAGERWANGEN aus dickem Blech, auf die Deckplatte geschweißt,
 *   dazwischen der Auslegerfuß, ein durchgehender BOLZEN mit SICHERUNG,
 *   dazu Schmiernippel, zwei Querbleche und die Fußflansche der Wangen.
 *
 * DER DREHPUNKT WANDERT NICHT. Die Achse des Lagerauges wird von außen
 * hereingereicht (`oberwagenStahl(hubAnker, bockAchse)`) und kommt in
 * `excavator.ts` aus `BOOM_PIVOT` selbst — es gibt keine zweite Zahl, die
 * auseinanderlaufen könnte. `test/auslegerbock.test.ts` prüft es zusätzlich an
 * der gebauten Maschine.
 *
 * DIE BREITE ist von beiden Seiten eingeklemmt und deshalb gemessen, nicht
 * geschätzt (alle Werte im Oberwagen-Frame, Ursprung y 1,60):
 *
 *   0,275  äußere Fläche der Auslegerfußlasche  (`AUSLEGER_FUSS_AUSSEN`)
 *   0,305  Innenfläche der Wange                 → 30 mm Luft zum Arm
 *   0,365  Außenfläche der Wange                 (60 mm Blech)
 *   0,385  Außenfläche des Lagerauges
 *   0,405  Bolzenende
 *   0,443  äußerster Punkt (Kopf der Sicherungsschraube)
 *   0,490  nächster Punkt der KABINE im Bockfenster — gemessen
 *
 * Es bleiben also 47 mm zur Kabine und 30 mm zum Arm. Beide Zahlen sind das
 * Ergebnis der Abtastung, nicht ihre Vorgabe.
 */
export const BOCK = {
  /** Innenfläche einer Lagerwange (m). 30 mm Luft zum Auslegerfuß. */
  xInnen: AUSLEGER_FUSS_AUSSEN + 0.03,
  /** Dicke des Wangenblechs (m). SW: so dick wie der Auslegerfuß selbst. */
  dicke: 0.06,
  /**
   * Radius des Lagerauges (m). 40 mm größer als die Fußlasche des Auslegers
   * (0,260) — nur dadurch SITZT der Fuß sichtbar IM Bock, statt daneben.
   */
  augeR: AUSLEGER_FUSS.r + 0.04,
  /** Dicke des Lagerauges (m) — es steht 20 mm über die Wange hinaus. */
  augeDicke: 0.08,
  /** Radius des durchgehenden Bolzens (m). Fußbolzen des Auslegers: 0,099. */
  bolzenR: 0.1,
} as const;

/** Mitte des Wangenblechs (m) — Bezugsebene für Auge, Flansch und Sicherung. */
const BOCK_X_MITTE = BOCK.xInnen + BOCK.dicke / 2;
/** Außenfläche des Lagerauges (m). */
const BOCK_X_AUGE = BOCK.xInnen + BOCK.augeDicke;
/** Ende des Bolzens (m) — er steht 20 mm über das Auge hinaus. */
const BOCK_X_BOLZEN = BOCK_X_AUGE + 0.02;

/**
 * Der UMRISS einer Lagerwange in der y-z-Ebene, gegen den Drehpunkt gerechnet.
 *
 * Jede Zahl hat eine Kante, an die sie stößt:
 *   hinten  z −0,14  →  10 mm vor der Vorderwand der Motorhaube (`HAUBE_VORN`
 *                       = −0,15); weiter hinten stünde die Wange in der Haube.
 *   vorn    z  1,05  →  die Lotrechte über dem Fuß des rechten und linken
 *                       HUBZYLINDERS. Der erste Entwurf reichte bis 1,20 und
 *                       wurde gemessen verworfen: Das Zylinderrohr streifte die
 *                       vordere Ecke des Fußflansches um 9 mm (bei 47°
 *                       Auslegerwinkel, `tools/auslegerbock.ts`). Mit 1,05
 *                       bleiben dort 0,10 m.
 *   oben    y  1,35  →  die Achse selbst; die Oberkante des Blechs liegt auf
 *                       Achshöhe, darüber schaut nur noch das runde Auge
 *                       heraus. Genau so sieht ein Auslegerbock aus.
 *   Kante oben  z 0,35 … 0,75  →  der HALS, 0,40 m breit. Er ist SCHMALER als
 *                       das Lagerauge (0,60 m): Das Auge tritt zu beiden Seiten
 *                       0,10 m hervor und liest sich dadurch als runder Kopf.
 *                       Im ersten Entwurf war der Hals genau so breit wie das
 *                       Auge — im Riss ergab das eine glatte Kuppe, an der man
 *                       das Lager nicht mehr fand.
 *   Schulter y 0,85  →  Mitte zwischen Deck (0,355) und Achse (1,35); dort
 *                       knickt der Umriss von der breiten Basis in den
 *                       schmalen Hals. Ohne den Knick liest sich die Wange als
 *                       Dreieck statt als Schweißteil.
 */
/** Vorderkante des Bockfußes (m) — über dem Fuß der Hubzylinder, siehe oben. */
const BOCK_Z_VORN = 1.05;
/** Hinterkante des Bockfußes (m) — 10 mm vor der Motorhaube. */
const BOCK_Z_HINTEN = HAUBE_VORN + 0.01;
/** Halbe Breite des Halses (m) — zwei Drittel des Lagerauges. */
const BOCK_HALS = 0.2;
/** Halbe Breite der Wange auf Schulterhöhe (m). */
const BOCK_SCHULTER = 0.34;

function bockUmriss(yAuge: number, zAuge: number): Array<[number, number]> {
  const yDeck = DECK_OBEN;
  const ySchulter = (yDeck + yAuge) / 2;
  return [
    [BOCK_Z_HINTEN, yDeck],
    [BOCK_Z_VORN, yDeck],
    [zAuge + BOCK_SCHULTER, ySchulter],
    [zAuge + BOCK_HALS, yAuge],
    [zAuge - BOCK_HALS, yAuge],
    [zAuge - BOCK_SCHULTER, ySchulter],
  ];
}

/**
 * Ein Blech, dessen Umriss in der y-z-Ebene liegt und das in x ausgezogen ist.
 *
 * `ExtrudeGeometry` baut in der x-y-Ebene und zieht nach +z aus. Die Drehung um
 * −90° um Y legt den Umriss in die y-z-Ebene der Maschine: (u, v, d) wird zu
 * (−d, v, u), also u → z, v → y, Dicke → x.
 */
function blechInYZ(umriss: Array<[number, number]>, xMitte: number, dicke: number): THREE.BufferGeometry {
  const form = new THREE.Shape();
  form.moveTo(umriss[0]![0], umriss[0]![1]);
  for (let i = 1; i < umriss.length; i++) form.lineTo(umriss[i]![0], umriss[i]![1]);
  form.closePath();
  const roh = new THREE.ExtrudeGeometry(form, { depth: dicke, bevelEnabled: false });
  /*
   * `ExtrudeGeometry` liefert als einzige Form hier ein UNINDIZIERTES Netz;
   * `mergeGeometries` verlangt aber, dass alle Teile denselben Aufbau haben —
   * entweder alle mit Index oder alle ohne. `mergeVertices` indiziert es.
   * (Ohne diesen Schritt bricht der Bau des ganzen Oberwagens ab; gemessen
   * 15.09.2026: „failed with geometry at index 53".)
   */
  const g = mergeVertices(roh);
  g.rotateY(-Math.PI / 2);
  g.translate(xMitte + dicke / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

/**
 * EIN BAUTEIL DES BOCKS — in Maßen, nicht in Dreiecken.
 *
 * WARUM ES DIESE ZWISCHENSTUFE GIBT. Ein Freigang lässt sich an einem
 * verschmolzenen Netz nur noch abtasten, und abtasten heißt raten mit
 * Rasterweite. An einem Quader, einer Walze und einem Blech mit Umriss
 * rechnet man den Abstand dagegen EXAKT aus. `tools/auslegerbock.ts` misst
 * deshalb gegen diese Liste — gegen dieselben Zahlen, aus denen auch die
 * Dreiecke entstehen. Es gibt keine zweite Beschreibung des Bauteils, die
 * stillschweigend davonlaufen könnte (der Fehler, den `tools/kabinenhub-bahn.ts`
 * noch machen musste: dort stehen die Hindernisse ein zweites Mal im Werkzeug).
 *
 * Alle Achsen zeigen wie am Bagger: x quer, y hoch, z nach vorn.
 */
export type BockTeil =
  | { art: "quader"; name: string; x: [number, number]; y: [number, number]; z: [number, number] }
  /** Walze mit Achse in x-Richtung — Lagerauge, Bolzen, Schraubenkopf. */
  | { art: "walze"; name: string; x: [number, number]; y: number; z: number; r: number }
  /** Blech: Umriss in der y-z-Ebene (Paare z|y), Dicke in x. */
  | { art: "blech"; name: string; x: [number, number]; umriss: Array<[number, number]> };

/**
 * DER AUSLEGERBOCK, Bauteil für Bauteil.
 *
 * @param yAuge Höhe der Lagerachse im Oberwagen-Frame (m)
 * @param zAuge Lage der Lagerachse in Fahrtrichtung (m)
 */
export function auslegerbockTeile(yAuge: number, zAuge: number): BockTeil[] {
  const umriss = bockUmriss(yAuge, zAuge);
  const ySchulter = (DECK_OBEN + yAuge) / 2;
  const teile: BockTeil[] = [];

  for (const s of [-1, 1]) {
    const seite = s < 0 ? "R" : "L"; // −X ist rechts (siehe RAD_ECKEN in excavator.ts)
    const spanne = (a: number, b: number): [number, number] =>
      s < 0 ? [-b, -a] : [a, b];
    teile.push({
      art: "blech",
      name: `LAGERWANGE_${seite}`,
      x: spanne(BOCK.xInnen, BOCK.xInnen + BOCK.dicke),
      umriss,
    });
    // Lagerauge: der runde Kopf der Wange, 20 mm nach außen vorstehend
    teile.push({
      art: "walze",
      name: `LAGERAUGE_${seite}`,
      x: spanne(BOCK.xInnen, BOCK_X_AUGE),
      y: yAuge,
      z: zAuge,
      r: BOCK.augeR,
    });
    /*
     * Fußflansch: das Blech, mit dem die Wange auf der Deckplatte steht. Er
     * ist das, was „eingeschweißt" von „danebengestellt" unterscheidet.
     *
     * Er steht nur 20 mm je Seite über die Wange hinaus. Mit 40 mm (erster
     * Entwurf) blieben dem Rohr des Hubzylinders bei 70° Auslegerwinkel nur
     * 9 mm — gemessen, nicht geschätzt.
     */
    teile.push({
      art: "quader",
      name: `WANGENFLANSCH_${seite}`,
      x: spanne(BOCK_X_MITTE - (BOCK.dicke + 0.04) / 2, BOCK_X_MITTE + (BOCK.dicke + 0.04) / 2),
      y: [DECK_OBEN, DECK_OBEN + 0.03],
      z: [BOCK_Z_HINTEN, BOCK_Z_VORN],
    });
    /*
     * BOLZENSICHERUNG: ein Flachstahl über dem Bolzenende, mit zwei Schrauben
     * an das Lagerauge geschraubt. Ohne sie wäre der Bolzen nur ein Zapfen.
     */
    teile.push({
      art: "quader",
      name: `BOLZENSICHERUNG_${seite}`,
      x: spanne(BOCK_X_BOLZEN, BOCK_X_BOLZEN + 0.023),
      y: [yAuge - 0.15, yAuge + 0.15],
      z: [zAuge - 0.045, zAuge + 0.045],
    });
    for (const dy of [-0.12, 0.12]) {
      teile.push({
        art: "walze",
        name: `SICHERUNGSSCHRAUBE_${seite}`,
        x: spanne(BOCK_X_BOLZEN + 0.023, BOCK_X_BOLZEN + 0.038),
        y: yAuge + dy,
        z: zAuge,
        r: 0.024,
      });
    }
    // Schmiernippel am Lagerauge — an jedem Bolzen sitzt einer
    teile.push({
      art: "walze",
      name: `SCHMIERNIPPEL_${seite}`,
      x: spanne(BOCK_X_AUGE, BOCK_X_AUGE + 0.04),
      y: yAuge + 0.21,
      z: zAuge,
      r: 0.02,
    });
  }

  /*
   * DER DURCHGEHENDE BOLZEN. Er gehört zum Bock, nicht zum Ausleger: Am
   * Vorbild ist er gegen den Bock gesichert, und der Arm dreht sich auf ihm.
   * Mit r = 0,10 umschließt er den (unveränderten) Fußbolzen des Auslegers
   * (r = 0,099) vollständig — es ist also kein zweiter Bolzen zu sehen.
   *
   * Er ist das EINZIGE Teil des Bocks, das den Arm berühren DARF: Er steckt in
   * dessen Bohrung. `tools/auslegerbock.ts` nimmt ihn deshalb von der
   * Freigangsmessung aus, und nur ihn.
   */
  teile.push({
    art: "walze",
    name: "BOLZEN",
    x: [-BOCK_X_BOLZEN, BOCK_X_BOLZEN],
    y: yAuge,
    z: zAuge,
    r: BOCK.bolzenR,
  });

  /*
   * ZWEI QUERBLECHE zwischen den Wangen, vorn und hinten. Sie schließen den
   * Bock zu einem U — von schräg hinten sieht man sonst zwischen den Wangen
   * hindurch auf das Deck. Beide enden auf Schulterhöhe und bleiben damit
   * innerhalb des Wangenumrisses; der Arm streicht nur durch die Kreisscheibe
   * r ≤ 0,31 um den Drehpunkt, also weit darüber.
   */
  for (const [name, zMitte] of [["QUERBLECH_HINTEN", 0.13], ["QUERBLECH_VORN", 0.79]] as const) {
    teile.push({
      art: "quader",
      name,
      x: [-BOCK.xInnen, BOCK.xInnen],
      y: [DECK_OBEN, ySchulter],
      z: [zMitte - 0.07, zMitte + 0.07],
    });
  }

  return teile;
}

/** Aus einem Maß ein Netzteil machen. */
function bockForm(t: BockTeil): THREE.BufferGeometry {
  const mitte = (a: [number, number]): number => (a[0] + a[1]) / 2;
  if (t.art === "blech") return blechInYZ(t.umriss, mitte(t.x), t.x[1] - t.x[0]);
  if (t.art === "walze") {
    const seiten = t.r > 0.05 ? 16 : 6; // Schraubenköpfe und Nippel sind Sechskant
    const g = new THREE.CylinderGeometry(t.r, t.r, t.x[1] - t.x[0], seiten);
    g.rotateZ(Math.PI / 2);
    g.translate(mitte(t.x), t.y, t.z);
    return g;
  }
  const g = new THREE.BoxGeometry(t.x[1] - t.x[0], t.y[1] - t.y[0], t.z[1] - t.z[0]);
  g.translate(mitte(t.x), mitte(t.y), mitte(t.z));
  return g;
}

/**
 * Der Auslegerbock als Netzteile — er liegt im Stahl-Netz des Oberwagens und
 * kostet deshalb KEINEN zusätzlichen Zeichenruf.
 */
export function auslegerbock(yAuge: number, zAuge: number): THREE.BufferGeometry[] {
  return auslegerbockTeile(yAuge, zAuge).map(bockForm);
}

/** Das LACK-Netz des Oberwagens (grün). */
export function oberwagenLack(): THREE.BufferGeometry {
  return verschmelze(
    [...laufblech(), ...motorhaube(), ...tankUndKuehler()],
    "Oberwagen-Lack"
  );
}

/**
 * Das STAHL-Netz des Oberwagens (anthrazit) — es heißt weiter `04_DREHKRANZ`,
 * weil der Drehkranzdeckel darin steckt.
 */
export function oberwagenStahl(
  hubAnker: Array<[number, number, number]>,
  bockAchse: { y: number; z: number },
  ohneBock = false
): THREE.BufferGeometry {
  return verschmelze(
    [
      drehkranzDeckel(DECK_B, DECK_T, DECK_OBEN),
      ...gitter(),
      ...gegengewicht(),
      ...gelaender(),
      ...auspuff(),
      ...hubLagerboecke(hubAnker),
      ...(ohneBock ? [] : auslegerbock(bockAchse.y, bockAchse.z)),
    ],
    "Oberwagen-Stahl"
  );
}

/**
 * 05.7 — zwei Arbeitsscheinwerfer hinten und zwei Rückleuchten.
 *
 * Der Kipper hat Scheinwerfer, Rückleuchten und Dachleuchten; der Bagger hatte
 * kein einziges Licht. Eigenes Netz, weil es als einziges leuchtet.
 */
export function oberwagenLeuchten(): THREE.BufferGeometry {
  const teile: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    /*
     * Die Strahler sitzen an der RÜCKWAND DER UNTEREN Haubenstufe (bis
     * y 1,075). Am ersten Versuch hingen sie auf Höhe der Oberkante (1,355) —
     * dort steht die obere Stufe aber 15 cm weiter vorn, und die Strahler
     * schwebten frei hinter der Maschine.
     */
    const strahler = new THREE.BoxGeometry(0.16, 0.13, 0.06);
    strahler.translate(sx * 0.72, HAUBE_STUFE - 0.18, HAUBE_HINTEN - 0.03);
    teile.push(strahler);
    const rueck = new THREE.BoxGeometry(0.1, 0.16, 0.04);
    rueck.translate(sx * 0.96, 0.46, -2.37);
    teile.push(rueck);
  }
  return verschmelze(teile, "Oberwagen-Leuchten");
}
