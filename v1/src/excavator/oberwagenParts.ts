import * as THREE from "three";
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
const HAUBE_VORN = -0.15;
/** Hinterkante der Motorhaube (m). Unverändert. */
const HAUBE_HINTEN = -1.85;
/** Halbe Breite der Motorhaube unten (m). Unverändert. */
const HAUBE_HALB = 1.25;
/** Oberkante der Motorhaube (m). Unverändert — die Silhouette bleibt. */
const HAUBE_OBEN = 1.355;
/**
 * Höhe der unteren Haubenstufe (m). Konzept 05.2: unten 0,72 hoch, oben 1,00.
 *
 * Die Stufe ist der ganze Unterschied zwischen „Kiste" und „Motorraum": Unten
 * sitzt der Block, oben nur noch der Aufbau mit den Gittern.
 */
const HAUBE_STUFE = DECK_OBEN + 0.72;

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
  const unten = new THREE.BoxGeometry(HAUBE_HALB * 2, HAUBE_STUFE - DECK_OBEN, laenge);
  unten.translate(0, (DECK_OBEN + HAUBE_STUFE) / 2, mitteZ);
  teile.push(unten);
  const oben = new THREE.BoxGeometry(HAUBE_HALB * 2 - 0.34, HAUBE_OBEN - HAUBE_STUFE, laenge - 0.3);
  oben.translate(0, (HAUBE_STUFE + HAUBE_OBEN) / 2, mitteZ - 0.06);
  teile.push(oben);
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
 */
function tankUndKuehler(): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const kasten = new THREE.BoxGeometry(0.16, 0.44, 0.95);
    kasten.translate(sx * 1.32, DECK_OBEN + 0.22, -0.75);
    teile.push(kasten);
    const deckel = new THREE.BoxGeometry(0.2, 0.04, 0.99);
    deckel.translate(sx * 1.32, DECK_OBEN + 0.46, -0.75);
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
export function oberwagenStahl(hubAnker: Array<[number, number, number]>): THREE.BufferGeometry {
  return verschmelze(
    [
      drehkranzDeckel(DECK_B, DECK_T, DECK_OBEN),
      ...gitter(),
      ...gegengewicht(),
      ...gelaender(),
      ...auspuff(),
      ...hubLagerboecke(hubAnker),
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
