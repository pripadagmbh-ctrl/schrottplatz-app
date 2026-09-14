import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Das Rad des Baggers, Bauteil für Bauteil.
 *
 * Vorbild ist ein Sennebogen 840 E Umschlagbagger auf Rädern. Bis zum
 * 14.09.2026 war ein Rad ein einziger `CylinderGeometry` mit 20
 * Umfangssegmenten: ein zwanzigeckiger schwarzer Klotz, ohne Felge, ohne Nabe,
 * ohne Profil. Bei 20 Ecken sieht man das Vieleck.
 *
 * Jetzt drei Bauteile je Rad: Reifen, Felge, Nabe.
 *
 * DIE BUDGETREGEL, gemessen auf Patricks Gerät (14.09.2026: FPS 48 · Frame
 * 21,0 ms · Zeichenrufe 1322 · 240k Dreiecke · Physik 0,5 ms · Bild 5,9 ms):
 *
 *   Dreiecke sind fast gratis, BAUTEILE sind teuer. Jedes schattenwerfende
 *   Teil wird zweimal gezeichnet, kostet also ZWEI Zeichenrufe.
 *
 * Daraus folgt die ganze Bauweise hier. Der Reifen darf 800 Dreiecke haben
 * statt der bisherigen 60 — aber er muss EIN Mesh bleiben. Karkasse und alle
 * Stollen werden deshalb zu einer Geometrie verschmolzen, statt als 25 kleine
 * Meshes nebeneinanderzustehen. Dasselbe bei der Felge mit ihren Radmuttern.
 * Was sich nicht gegeneinander bewegt, wird zusammengefasst.
 *
 * Und daraus folgt auch, wer Schatten wirft: nur der Reifen. Felge und Nabe
 * liegen innerhalb seiner Silhouette; ihr Schatten wäre nicht zu sehen, würde
 * aber vier Zeichenrufe je Rad kosten.
 *
 * DIE GRÖSSE BLEIBT. Der Raddurchmesser von 1,24 m stimmt mit dem Vorbild
 * überein und ist unverändert: Über die Stollenspitzen gemessen ist der Radius
 * weiterhin RAD_R = 0,62 m, die Breite weiterhin RAD_B = 0,50 m. Geändert hat
 * sich nur, was innerhalb dieser Hülle steht.
 *
 * DIE PHYSIK BLEIBT AUCH. Die Räder hatten nie einen eigenen Kollider — der
 * Unterwagen ist für Rapier ein Quader. Optische Tiefe kostet hier also nichts.
 */

/** Außenradius über die Stollenspitzen (m) — unverändert seit dem ersten Rad. */
export const RAD_R = 0.62;
/** Reifenbreite (m) — unverändert. */
export const RAD_B = 0.5;

/**
 * Umfangssegmente des Reifens.
 *
 * 32 statt 20. Bei 20 Ecken ist das Vieleck zu sehen: Die Sehne misst dann
 * 2 · 0,62 · sin(180°/20) = 0,194 m, und die Ecke steht 1,5 cm vor der
 * Kreislinie zurück. Bei 32 sind es 0,121 m Sehne und 6 mm — unter der
 * Auflösung, in der das Rad auf dem iPad zu sehen ist.
 *
 * Die Zahl bestimmt den Preis: Die Karkasse kostet SEGMENTE · Bänder · 2
 * Dreiecke.
 */
const SEGMENTE = 32;

/**
 * Radius, auf dem die Stollen SITZEN — der Rillengrund zwischen dem Profil (m).
 *
 * Die Stollen sind damit gut 3,4 cm hoch (siehe `STOLLEN_DECK`).
 *
 * Der erste Versuch am 14.09.2026 hatte 4,8 cm hohe Stollen auf einer
 * Lauffläche von 0,572 m und dazu eine Flanke, die mit 0,585 m NIEDRIGER lag
 * als die Stollenspitzen. Im Rasterbild war die Silhouette daraufhin ein
 * Zahnrad: Zwischen den Stollen fiel sie um 7,7 % des Radius ein. Ein echter
 * Reifen zeigt von vorn den runden Flankenbogen, und nur die Stollen stehen
 * darüber hinaus.
 */
const LAUFFLAECHE_R = RAD_R - 0.038;

/**
 * Größter Radius der FLANKE — der Wulst (m).
 *
 * Ein Umschlagbaggerreifen ist an der Flanke dicker als in der Rille des
 * Profils; unter Last quillt er zusätzlich heraus. Genau daran erkennt man von
 * Weitem einen Reifen und nicht einen schwarzen Zylinder.
 *
 * 0,594 liegt ÜBER der Rille (0,582) und 2,6 cm unter den Stollenspitzen
 * (0,62). Damit ist die Silhouette von vorn ein runder Bogen, aus dem die
 * Stollen herausragen — und nicht ein Zahnkranz.
 */
const WULST_R = 0.594;

/**
 * Radius des Felgenhorns — dort sitzt der Reifen auf (m). SW, nach Augenmaß.
 *
 * Der Reifen hat hier seine Bohrung; die Felge wird um FELGEN_LUFT kleiner
 * gebaut. Beide auf denselben Radius zu legen war der erste Versuch, und im
 * Rasterbild bohrten sich daraufhin grüne Splitter durch den schwarzen Reifen:
 * zwei deckungsgleiche Flächen, zwischen denen der Tiefenpuffer nicht
 * entscheiden kann.
 */
const FELGEN_R = 0.42;
/** Luft zwischen Felgenmantel und Reifenbohrung (m) — gegen Flimmern. */
const FELGEN_LUFT = 0.01;

/** Zahl der Stollenpaare rundherum. */
/*
 * 16 Paare, also 32 Stollen. Der Teilungsabstand auf der Lauffläche ist damit
 * 2 · π · 0,582 / 16 = 0,229 m; bei 0,11 m Stollenlänge bleibt eine Rille von
 * 12 cm. Das ist das grobe Verhältnis eines Baustellenprofils, nicht die enge
 * Teilung eines Straßenreifens.
 *
 * Je Teilung stehen ZWEI Stollen nebeneinander, gegeneinander gekippt — das
 * Fischgrätmuster eines Traktionsprofils. Ein einzelner, über die ganze Breite
 * gekippter Stollen war der erste Versuch; bei 0,34 m Breite und 16° Kippung
 * wanderten seine Enden 9,4 cm gegeneinander, und im Bild wurde daraus ein
 * dünner Schrägstrich statt eines Klotzes.
 *
 * Budget: 32 Quader × 12 Dreiecke = 384, Karkasse 384 — zusammen 768 und damit
 * unter den 800, die ein Reifen haben darf.
 */
const STOLLEN = 16;

/** Werkstoffe des Rades. */
export interface RadStoffe {
  /** Gummi: fast schwarz, matt */
  gummi: THREE.MeshStandardMaterial;
  /** Felge: Maschinenfarbe, wie am Vorbild lackiert */
  felge: THREE.MeshStandardMaterial;
  /** Nabe: dunkler Guss mit Metallglanz */
  nabe: THREE.MeshStandardMaterial;
}

export function radStoffe(maschinenfarbe: THREE.MeshStandardMaterial): RadStoffe {
  /*
   * Die Felge bekommt die Maschinenfarbe, aber ein EIGENES Material: Ihr
   * Felgenbett ist ein offener Ring, und wer in die Felgenschüssel schaut,
   * sieht dessen Innenseite. Mit der Voreinstellung (nur Vorderseiten) wäre
   * die unsichtbar, und man blickte durch die Felge hindurch.
   *
   * Beidseitig zu zeichnen kostet keinen Zeichenruf — die Felge bleibt ein
   * Mesh. Es kostet ein paar Pixel Füllrate, und die ist nach der Messung vom
   * 14.09.2026 (Bild 5,9 ms von 21,0 ms) nicht der Engpass.
   */
  const felge = maschinenfarbe.clone();
  felge.side = THREE.DoubleSide;
  return {
    /*
     * 0x1a1c1e statt des bisherigen 0x2b2e31. Das alte Rad benutzte dasselbe
     * Dunkelgrau wie Deck, Gegengewicht und Pratzen — deshalb verschwand es im
     * Unterwagen. Gummi ist dunkler und matter als lackierter Stahl.
     */
    gummi: new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.95, metalness: 0.0 }),
    felge,
    nabe: new THREE.MeshStandardMaterial({ color: 0x3a3f43, roughness: 0.45, metalness: 0.75 }),
  };
}

/**
 * Die Karkasse: der Reifen ohne Profil, als Drehkörper um die Y-Achse.
 *
 * Der Umriss läuft vom Felgenhorn über die Flanke (Wulst) zur Lauffläche und
 * auf der anderen Seite zurück; der letzte Punkt schließt den Ring über die
 * Bohrung. Ohne diesen Rückweg wäre der Reifen von innen offen — man sähe
 * durch ihn hindurch, sobald die Felge nicht genau davor steht.
 */
function karkasse(): THREE.BufferGeometry {
  const h = RAD_B / 2;
  const umriss = [
    new THREE.Vector2(FELGEN_R, -h), // Felgenhorn innen
    new THREE.Vector2(WULST_R, -h + 0.09), // Flanke, dickste Stelle
    new THREE.Vector2(LAUFFLAECHE_R, -h + 0.16), // Schulter, Beginn der Lauffläche
    new THREE.Vector2(LAUFFLAECHE_R, h - 0.16), // Schulter
    new THREE.Vector2(WULST_R, h - 0.09), // Flanke
    new THREE.Vector2(FELGEN_R, h), // Felgenhorn außen
    new THREE.Vector2(FELGEN_R, -h), // zurück durch die Bohrung — schließt den Ring
  ];
  // 6 Bänder × SEGMENTE × 2 = 384 Dreiecke
  return new THREE.LatheGeometry(umriss, SEGMENTE);
}

/** Länge eines Stollens in Umfangsrichtung (m). */
const STOLLEN_LAENGE = 0.11;
/** Breite eines Stollens in Achsrichtung (m). */
const STOLLEN_BREITE = 0.16;
/** Kippung eines Stollens gegen die Umfangsrichtung (rad) — das Fischgrätmuster. */
const STOLLEN_KIPP = 0.2;
/** Achsversatz der beiden Stollen einer Teilung (m). */
const STOLLEN_VERSATZ = 0.095;

/**
 * Radius der DECKFLÄCHE eines Stollens (m) — nicht sein äußerster Punkt.
 *
 * Ein flacher Klotz auf einer runden Lauffläche steht mit seinen ECKEN weiter
 * heraus als mit seiner Mitte. Legte man die Deckfläche auf RAD_R, hätte das
 * Rad in Wirklichkeit 1,248 m statt 1,24 m — 8 mm, die die Maschine höher
 * stellen würden. Genau das hat `test/baggerteile.test.ts` am 14.09.2026
 * gemeldet, und deshalb steht hier die Rechnung statt des runden Wertes:
 *
 *   halber Umfangsausschlag einer Ecke = L/2 · cos κ + B/2 · sin κ
 *   Deckflächenradius = √(RAD_R² − Ausschlag²)
 *
 * Damit liegt die äußerste ECKE auf genau RAD_R, und der Durchmesser stimmt.
 */
const STOLLEN_ECKE =
  (STOLLEN_LAENGE / 2) * Math.cos(STOLLEN_KIPP) + (STOLLEN_BREITE / 2) * Math.sin(STOLLEN_KIPP);
const STOLLEN_DECK = Math.sqrt(RAD_R * RAD_R - STOLLEN_ECKE * STOLLEN_ECKE);

/**
 * Ein Stollen: ein Quader, der auf der Lauffläche steht.
 *
 * `i` ist die Teilung rundherum, `haelfte` die Reifenhälfte (−1 innen, +1
 * außen). Die beiden Stollen einer Teilung sind gegeneinander gekippt — daraus
 * wird das Fischgrätmuster eines Traktionsprofils. Ein Reifen mit lauter gleich
 * stehenden Klötzen sieht aus wie ein Zahnrad.
 */
function stollen(i: number, haelfte: -1 | 1): THREE.BufferGeometry {
  const hoehe = STOLLEN_DECK - LAUFFLAECHE_R;
  const g = new THREE.BoxGeometry(STOLLEN_LAENGE, hoehe, STOLLEN_BREITE); // (Umfang, radial, axial)
  // Kippen um die radiale Achse: die beiden Hälften gegeneinander
  g.rotateY(haelfte * STOLLEN_KIPP);
  // Auf die Lauffläche stellen, auf ihre Reifenhälfte schieben
  g.translate(0, LAUFFLAECHE_R + hoehe / 2, haelfte * STOLLEN_VERSATZ);
  // Radachse zeigt jetzt in Y statt in Z, dann um das Rad herumdrehen
  g.rotateX(-Math.PI / 2);
  g.rotateY((i / STOLLEN) * Math.PI * 2);
  return g;
}

/**
 * Der REIFEN als EIN Mesh: Karkasse plus alle Stollen, verschmolzen.
 *
 * Das Verschmelzen ist der Kern der Sache. Als 25 einzelne Meshes wäre der
 * Reifen 25 Zeichenrufe wert (50 mit Schatten) und läge damit allein über dem,
 * was der ganze Bagger heute kostet. Als ein Mesh ist er einer.
 */
function reifenGeometrie(): THREE.BufferGeometry {
  const teile: THREE.BufferGeometry[] = [karkasse()];
  for (let i = 0; i < STOLLEN; i++) {
    teile.push(stollen(i, -1), stollen(i, 1));
  }
  const g = mergeGeometries(teile, false);
  if (!g) throw new Error("Reifen liess sich nicht verschmelzen");
  g.computeVertexNormals();
  return g;
}

/** Zahl der Radmuttern. SW: zehn, wie an einem LKW-Rad dieser Größe. */
const MUTTERN = 10;
/** Lochkreis der Radmuttern (m). SW, nach Augenmaß zwischen Nabe und Felgenbett. */
const LOCHKREIS = 0.25;

/**
 * Die FELGE als EIN Mesh: Felgenbett, Felgenscheibe und alle Radmuttern.
 *
 * Die Muttern stehen als Geometrie vor der Scheibe, nicht als Farbfleck — sie
 * sollen im Streiflicht einen Schatten auf die Scheibe werfen. Das ist das
 * eine Detail, an dem ein Rad aus der Nähe lebendig wird.
 */
function felgenGeometrie(): THREE.BufferGeometry {
  const teile: THREE.BufferGeometry[] = [];
  const bett = FELGEN_R - FELGEN_LUFT;
  const rand = (RAD_B - 0.06) / 2; // Kante des Felgenbetts, außen wie innen

  /*
   * Felgenbett: der Ring, auf dem der Reifen sitzt. OFFEN, nicht als voller
   * Zylinder.
   *
   * Der erste Versuch am 14.09.2026 war ein geschlossener Zylinder — und
   * damit lag die Felgenscheibe vollständig IN ihm drin, unsichtbar, während
   * nach außen der flache Deckel des Zylinders zeigte. Im Rasterbild war die
   * Felge eine grüne Platte, keine Felge. Offen sieht man in die Schüssel
   * hinein, und genau das macht ein Rad aus der Nähe plastisch.
   *
   * Um FELGEN_LUFT enger als die Reifenbohrung, damit die beiden Mäntel nicht
   * deckungsgleich liegen und flimmern.
   */
  teile.push(new THREE.CylinderGeometry(bett, bett, rand * 2, 24, 1, true));
  // Innenseite zu: Was zur Maschine zeigt, sieht man nie — aber ohne Deckel
  // blickt man an flachen Winkeln durch das Rad hindurch.
  const innen = new THREE.CylinderGeometry(bett, bett, 0.03, 24);
  innen.translate(0, -rand + 0.015, 0);
  teile.push(innen);
  /*
   * Felgenscheibe: der eingezogene Boden der Schüssel, ein Kegelstumpf wie bei
   * einer Tiefbettfelge. Sie liegt 7 cm hinter der Felgenkante — dieser
   * Einzug ist es, der von der Seite als Tiefe zu sehen ist.
   */
  const scheibe = new THREE.CylinderGeometry(0.34, bett - 0.005, 0.06, 24);
  scheibe.translate(0, rand - 0.1, 0);
  teile.push(scheibe);
  for (let i = 0; i < MUTTERN; i++) {
    const a = (i / MUTTERN) * Math.PI * 2;
    // Sechskant: sechs Segmente, mehr sieht man aus keiner Entfernung
    const m = new THREE.CylinderGeometry(0.042, 0.042, 0.06, 6);
    m.translate(Math.sin(a) * LOCHKREIS, rand - 0.045, Math.cos(a) * LOCHKREIS);
    teile.push(m);
  }
  const g = mergeGeometries(teile, false);
  if (!g) throw new Error("Felge liess sich nicht verschmelzen");
  return g;
}

/**
 * Die NABE als EIN Mesh: Nabenflansch und Nabenkappe.
 *
 * Das kleinste der drei Teile und das, was einem Rad die Mitte gibt. Ohne sie
 * hat die Felge ein Loch.
 */
function nabenGeometrie(): THREE.BufferGeometry {
  const rand = (RAD_B - 0.06) / 2;
  // Nabenflansch: sitzt INNERHALB des Lochkreises, sonst verdeckt er die
  // Radmuttern, für die die ganze Felgenscheibe da ist.
  const flansch = new THREE.CylinderGeometry(0.19, 0.19, 0.06, 12);
  flansch.translate(0, rand - 0.045, 0);
  /*
   * Nabenkappe: steht gut zwei Zentimeter über die Reifenflanke hinaus — das
   * ist das kleine Stück Tiefe, das man von schräg vorn sieht.
   *
   * Sie taucht 1,5 cm IN den Flansch ein. Setzte man sie bündig darauf, lägen
   * Kappenboden und Flanschdeckel in derselben Ebene, und der Tiefenpuffer
   * könnte nicht entscheiden, welche der beiden vorn liegt — im Rasterbild vom
   * 14.09.2026 waren daraus Splitter quer über die Felge geworden.
   */
  const kappe = new THREE.CylinderGeometry(0.11, 0.15, 0.09, 12);
  kappe.translate(0, rand + 0.015, 0);
  const g = mergeGeometries([flansch, kappe], false);
  if (!g) throw new Error("Nabe liess sich nicht verschmelzen");
  return g;
}

/**
 * Die drei Geometrien eines Rades, gebaut mit der Achse in Y und der
 * AUSSENSEITE bei +Y.
 *
 * Einmal bauen, viermal benutzen: Vier Räder teilen sich zwei Sätze (links und
 * rechts gespiegelt). Das spart Speicher, nicht Zeichenrufe — die kostet jedes
 * Mesh einzeln, gleich welche Geometrie darin steckt.
 */
export function radGeometrien(): {
  reifen: THREE.BufferGeometry;
  felge: THREE.BufferGeometry;
  nabe: THREE.BufferGeometry;
} {
  return { reifen: reifenGeometrie(), felge: felgenGeometrie(), nabe: nabenGeometrie() };
}

/**
 * Ein fertiges Rad als Gruppe, für die Ecke `ecke` (`VL`, `VR`, `HL`, `HR`).
 *
 * @param nachLinks true, wenn das Rad auf der linken Seite sitzt (+X). Die
 *        Aussenseite mit Felgenscheibe, Muttern und Nabenkappe muss nach
 *        aussen zeigen — sonst schaut man von der Seite in ein leeres
 *        Felgenbett. +Y wird dafür nach +X gedreht statt nach −X.
 *        (Die Regel „−X ist rechts" steht bei `RAD_ECKEN` in excavator.ts.)
 */
export function baueRad(
  geo: ReturnType<typeof radGeometrien>,
  st: RadStoffe,
  ecke: string,
  nachLinks: boolean
): THREE.Group {
  const g = new THREE.Group();
  g.name = `02_RAD_${ecke}`;
  g.rotation.z = nachLinks ? -Math.PI / 2 : Math.PI / 2;

  const reifen = new THREE.Mesh(geo.reifen, st.gummi);
  reifen.name = `02_RAD_${ecke}_REIFEN`;
  /*
   * Nur der Reifen wirft Schatten. Felge und Nabe liegen vollständig in seiner
   * Silhouette; ihr Schatten wäre nicht zu sehen, würde aber je Rad zwei
   * zusätzliche Zeichenrufe kosten (Budgetregel oben).
   */
  reifen.castShadow = true;
  g.add(reifen);

  const felge = new THREE.Mesh(geo.felge, st.felge);
  felge.name = `02_RAD_${ecke}_FELGE`;
  g.add(felge);

  const nabe = new THREE.Mesh(geo.nabe, st.nabe);
  nabe.name = `02_RAD_${ecke}_NABE`;
  g.add(nabe);

  return g;
}
