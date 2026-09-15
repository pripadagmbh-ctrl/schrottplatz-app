import * as THREE from "three";
import { farbstoff, verschmelze, verschmelzeBunt, type Bauteil } from "./bauteile";

/**
 * Der Fahrer in der Kabine — Daniel. Bauteil für Bauteil.
 *
 * Teileliste `docs/baggerkonzept.md` Abschnitt 06.10, beschlossen in E-025,
 * Frage 4 von Patrick am 15.09.2026 mit „ja" beantwortet (Warnjacke, eckige
 * Schultern).
 *
 * WARUM ER UMGEBAUT WURDE. Patrick am 14.09.2026: „Jetzt aktuell ist es auch
 * Playmobil like samt Fahrer." Gemessen stimmte das Gefühl und hatte zwei
 * getrennte Ursachen:
 *
 *  1. FORM. Alles war Kapsel oder Kugel — Rumpf `CapsuleGeometry`, Schultern
 *     `SphereGeometry`, Hüfte, Beine, Hals: Kapseln. Keine einzige Kante brach
 *     die Silhouette. Dazu weißes Hemd und Jeans: Freizeitkleidung. Wer eine
 *     Umschlagmaschine fährt, trägt Warnkleidung — und die ist zugleich das
 *     einzige Farbsignal, das auf 15 m Entfernung noch lesbar ist.
 *
 *  2. PREIS. Daniel kostete **16 Netze und 4 648 Dreiecke** — 30 % der ganzen
 *     Maschine für eine Figur, die in der Außenansicht so groß ist wie eine
 *     Hand, während Ausleger und Stiel je 12 Dreiecke hatten. Jedes seiner
 *     16 Teile warf Schatten, kostete also zwei Zeichenrufe: 32 von rund 194.
 *
 * JETZT ZWEI NETZE: `06_FAHRER_HAUT` und `06_FAHRER_KLEIDUNG`. Dass die
 * Kleidung fünf Farben trägt (Orange, Reflexweiß, Hose, Stiefel, Haar) und
 * trotzdem ein Netz bleibt, geht über Eckfarben (`bauteile.ts`).
 *
 * WAS BEWUSST NICHT GEBAUT WURDE: eine Mütze (das Konzept nennt sie als
 * Ersatz für die Haarkugel, Patrick hat sie nicht verlangt) und die Abnahme
 * des Lederbands. Beides ist Charakter, nicht Technik — und beides kostet in
 * dieser Bauweise ohnehin kein Netz mehr.
 *
 * Aus der Innensicht ist absichtlich wenig von ihm zu sehen: Der Blick geht
 * vom Augpunkt aus, Kopf und Rumpf liegen hinter der Kamera. Sichtbar bleiben
 * die Unterarme an den Joysticks — die gehören zur Kabine, nicht hierher.
 *
 * @returns die Netze, die beim Wechsel in die Innensicht ausgeblendet werden.
 *          Aus 16 Einträgen sind zwei geworden; `setFirstPerson` arbeitet
 *          unverändert.
 */

/** Haut (m Farbe unverändert seit dem Prototyp). */
const HAUT = 0xe3b18c;
/**
 * Warnorange der Jacke.
 *
 * SW nach EN ISO 20471, Warnorange-Rot. Es ist das einzige an Daniel, was man
 * durch getöntes Glas aus 15 m noch sieht — deshalb kräftig und nicht pastell.
 */
const JACKE = 0xf0741a;
/** Reflexstreifen — silbrig hell, damit sie gegen das Orange stehen. */
const REFLEX = 0xdfe4e8;
/** Hose: unverändert die alte Jeansfarbe. */
const HOSE = 0x3d4b5c;
/** Stiefel: unverändert. */
const STIEFEL = 0x2a2724;
/** Haar: unverändert. */
const HAAR = 0x6b4a2e;
/** Lederband: unverändert. */
const LEDER = 0x2a2724;

/**
 * Wie viele Ecken ein „eckiges" Körperteil bekommt.
 *
 * Sechs. Das ist der Kern der Sache (Konzept 6c): „Ein Sechseck-Profil genügt,
 * es bricht die Silhouette." Bei zwölf Ecken sähe der Rumpf wieder rund aus,
 * bei vier wie ein Karton.
 */
const ECKEN = 6;

/** Ein Sechskantprofil, stehend, mit Mitte bei (x, y, z). */
function hexprisma(
  r: number,
  h: number,
  x: number,
  y: number,
  z: number,
  drehung = 0
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, h, ECKEN);
  g.rotateY(drehung);
  g.translate(x, y, z);
  return g;
}

/**
 * 06.10a — die WARNJACKE: Rumpf als Sechskantprofil mit zwei Reflexstreifen.
 *
 * Das war eine `CapsuleGeometry(0.16, 0.3)` — ein Ei. Das Sechskantprofil hat
 * dieselbe Bauhöhe und denselben Umfang, aber sechs senkrechte Kanten, an
 * denen das Licht bricht.
 */
function warnjacke(z: number): Bauteil[] {
  const teile: Bauteil[] = [];
  teile.push({ geo: hexprisma(0.175, 0.44, 0, 1.44, z), farbe: JACKE });
  // Zwei Reflexstreifen rund um den Rumpf — das Erkennungszeichen schlechthin
  for (const y of [1.3, 1.45]) {
    teile.push({ geo: hexprisma(0.181, 0.045, 0, y, z), farbe: REFLEX });
  }
  return teile;
}

/**
 * 06.10b — ECKIGE SCHULTERN und KRAGEN statt der Kugel.
 *
 * Die Schulterpartie war eine `SphereGeometry(0.17)`. Eine Kugel auf einem Ei
 * ist die Silhouette einer Spielfigur; ein querliegender Schulterbalken mit
 * zwei Kappen und ein Stehkragen sind die einer Jacke.
 */
function schultern(z: number): Bauteil[] {
  const teile: Bauteil[] = [];
  const balken = new THREE.BoxGeometry(0.46, 0.15, 0.27);
  balken.translate(0, 1.6, z);
  teile.push({ geo: balken, farbe: JACKE });
  for (const sx of [-1, 1]) {
    const kappe = new THREE.BoxGeometry(0.1, 0.13, 0.25);
    kappe.translate(sx * 0.255, 1.575, z);
    teile.push({ geo: kappe, farbe: JACKE });
  }
  // Kragen: kurzes Sechskantprofil, 45° gedreht, damit es gegen den Rumpf steht
  teile.push({ geo: hexprisma(0.105, 0.075, 0, 1.685, z, Math.PI / ECKEN), farbe: JACKE });
  return teile;
}

/** 06.10c — die Ärmel: Oberarme in Jackenfarbe, Form unverändert. */
function oberarme(z: number): Bauteil[] {
  const teile: Bauteil[] = [];
  for (const sx of [-1, 1] as const) {
    const g = new THREE.CapsuleGeometry(0.058, 0.22, 4, 8);
    g.rotateZ(sx * 0.28);
    g.translate(sx * 0.29, 1.44, z + 0.06);
    teile.push({ geo: g, farbe: JACKE });
  }
  return teile;
}

/**
 * 06.10d — Hüfte, Beine, Stiefel. Form unverändert (Konzept 6c: „Der Rest
 * bleibt, wie er ist — von außen sieht man ihn durch getöntes Glas").
 */
function beine(z: number): Bauteil[] {
  const teile: Bauteil[] = [];
  const huefte = new THREE.CapsuleGeometry(0.12, 0.12, 4, 8);
  huefte.translate(0, 1.12, z + 0.08);
  teile.push({ geo: huefte, farbe: HOSE });
  for (const sx of [-0.1, 0.1]) {
    const ober = new THREE.CapsuleGeometry(0.07, 0.26, 4, 8);
    ober.rotateX(Math.PI / 2);
    ober.translate(sx, 1.1, z + 0.26);
    teile.push({ geo: ober, farbe: HOSE });
    const unter = new THREE.CapsuleGeometry(0.065, 0.24, 4, 8);
    unter.translate(sx, 0.88, z + 0.44);
    teile.push({ geo: unter, farbe: HOSE });
    const stiefel = new THREE.SphereGeometry(0.075, 8, 6);
    stiefel.translate(sx, 0.7, z + 0.5);
    teile.push({ geo: stiefel, farbe: STIEFEL });
  }
  return teile;
}

/** 06.10e — Haar und Lederband. Unverändert, nur nicht mehr als eigene Netze. */
function haarUndBand(z: number): Bauteil[] {
  const teile: Bauteil[] = [];
  const kappe = new THREE.SphereGeometry(0.122, 12, 10);
  kappe.scale(1, 0.95, 1.02);
  kappe.translate(0, 1.9, z - 0.02);
  teile.push({ geo: kappe, farbe: HAAR });
  const nacken = new THREE.SphereGeometry(0.1, 10, 8);
  nacken.scale(1, 0.7, 0.7);
  nacken.translate(0, 1.84, z - 0.06);
  teile.push({ geo: nacken, farbe: HAAR });
  const band = new THREE.TorusGeometry(0.075, 0.01, 6, 14);
  band.rotateX(Math.PI / 2);
  band.translate(0, 1.65, z + 0.01);
  teile.push({ geo: band, farbe: LEDER });
  return teile;
}

/** 06.10f — Hals und Kopf. Das einzige, was Haut ist. */
function hautteile(z: number): THREE.BufferGeometry[] {
  const hals = new THREE.CapsuleGeometry(0.05, 0.06, 4, 8);
  hals.translate(0, 1.73, z - 0.01);
  const kopf = new THREE.SphereGeometry(0.115, 12, 10);
  kopf.scale(1, 1.12, 1.02);
  kopf.translate(0, 1.87, z - 0.01);
  return [hals, kopf];
}

export function buildDriver(
  parent: THREE.Object3D,
  cx: number,
  cz: number
): THREE.Object3D[] {
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  g.name = "06_FAHRER";
  parent.add(g);

  // Alle Teile sind um denselben Rumpfbezug gebaut — er stand vorher an
  // jedem Körperteil einzeln.
  const z = -0.24;

  const haut = new THREE.Mesh(
    verschmelze(hautteile(z), "Fahrerhaut"),
    new THREE.MeshStandardMaterial({ color: HAUT, roughness: 0.8 })
  );
  haut.name = "06_FAHRER_HAUT";
  /*
   * Nur die Kleidung wirft Schatten. Der Kopf liegt vollständig in ihrer
   * Silhouette; sein Schatten wäre nicht zu sehen, würde aber zwei Zeichenrufe
   * kosten (Budgetregel E-025). Vorher warfen ALLE 16 Teile Schatten — 32
   * Zeichenrufe von rund 194 für eine Figur hinter getöntem Glas.
   */
  haut.castShadow = false;
  g.add(haut);

  const kleidung = new THREE.Mesh(
    verschmelzeBunt(
      [...warnjacke(z), ...schultern(z), ...oberarme(z), ...beine(z), ...haarUndBand(z)],
      "Fahrerkleidung"
    ),
    farbstoff(0.88)
  );
  kleidung.name = "06_FAHRER_KLEIDUNG";
  kleidung.castShadow = true;
  g.add(kleidung);

  /*
   * `setFirstPerson` blendet diese Liste aus. Sie hatte 16 Einträge und hat
   * jetzt zwei; die Unterarme an den Joysticks stehen nicht darin und bleiben
   * in der Kabinenansicht sichtbar wie bisher. Die Kabinenansicht ändert sich
   * dadurch nicht.
   */
  return [haut, kleidung];
}
