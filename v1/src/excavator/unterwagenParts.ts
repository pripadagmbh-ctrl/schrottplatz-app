import * as THREE from "three";
import { verschmelze } from "./bauteile";
import { drehkranzRing, DREHKRANZ_Y_UNTEN } from "./drehkranzParts";

/**
 * Der Unterwagen des Baggers, Bauteil für Bauteil.
 *
 * Teileliste `docs/baggerkonzept.md` Abschnitt 01, Tafel 4 der Zeichnung.
 * Beschlossen in E-025; Frage 1 („Silhouette des Unterwagens") hat Patrick am
 * 15.09.2026 mit „ja, so bauen" beantwortet.
 *
 * WARUM. Patrick am 14.09.2026: „Die Reifen, die sind nicht so richtig
 * erkennbar." Gemessen war nicht das Rad schuld, sondern der Einbau:
 *
 *   Rahmen   Quader 2,40 × 0,90 × 4,40 bei y 1,15 → y 0,70 … 1,60, x ±1,20
 *   Rad      Mitte x ±1,25, Radius 0,62         → y 0,00 … 1,24, x 1,00 … 1,50
 *
 * Die obersten **54 cm** des 124 cm hohen Rades steckten im Rahmenkasten, in
 * der Breite 20 cm. Über 40 % der Radhöhe waren in einer Kiste versenkt, in
 * die das Rad hineinragte wie ein Nagel in ein Brett. Kein Kotflügel, keine
 * Achse, kein Achsschenkel — nichts, was das Rad mit der Maschine verband.
 *
 * JETZT: schmaler Mittelträger (1,50 m), Seitenwangen, deren Unterkante auf
 * **y 1,24** aufsetzt — genau auf der Radoberkante —, darunter sichtbare
 * Achsbrücken, darüber der Kotflügelbogen in der Wange. Danach steckt kein Rad
 * mehr im Rahmen, und man sieht unter der Maschine hindurch.
 *
 * WAS SICH NICHT ÄNDERT:
 *  - Rad: Durchmesser 1,24 m, Breite 0,50 m, Material — am 14.09. abgenommen
 *    („räder in ordnung").
 *  - Der KOLLIDER des Unterwagens (Quader 2,4 × 1,5 × 4,4, Mitte y 1,15). Er
 *    war noch nie deckungsgleich mit dem sichtbaren Kasten (E-025, Befund 3)
 *    und bleibt, wie er ist — sonst änderte sich, wie die Maschine Schrott
 *    beiseiteschiebt.
 *
 * ZWEI NETZE (E-025: ein Netz je Starrkörper und Werkstoff):
 *   `01_UNTERWAGEN_LACK`  — grün: Rahmen, Wangen, Sicken, Kotflügel, Tank
 *   `01_UNTERWAGEN_STAHL` — anthrazit: Achsbrücken, Achsschenkel, Aufstieg,
 *                           Handlauf, Werkzeugkasten, Ösen, Unterfahrschutz,
 *                           Pratzenausleger UND der Drehkranzring.
 *
 * Der Drehkranzring stand seit dem 15.09. als eigenes Netz `04_DREHKRANZ_RING`
 * da und wandert hier hinein — genau wie im Konzept vorgesehen (Abschnitt 04:
 * „0 eigene Netze").
 */

/** Halbe Breite des Mittelträgers (m) — Konzept 01.1: Kastenträger 1,50 m. */
const TRAEGER_HALB = 0.75;
/** Unterkante des Mittelträgers (m). Konzept 01.1: y 1,00 … 1,60. */
const TRAEGER_UNTEN = 1.0;
/** Oberkante des Rahmens (m) — dort setzt der Drehkranz auf. Unverändert. */
const RAHMEN_OBEN = DREHKRANZ_Y_UNTEN;
/** Halbe Länge des Rahmens (m) — unverändert 4,40 m lang. */
const RAHMEN_HALB = 2.2;

/**
 * Unterkante der Seitenwangen (m).
 *
 * **1,24 — die Radoberkante.** Das ist die eine Zahl, um die es in diesem
 * ganzen Paket geht: Darunter darf kein Blech sein, sonst steckt das Rad
 * wieder in der Kiste.
 */
const WANGE_UNTEN = 1.24;
/** Mitte der Wangenblechdicke (m). Konzept 01.1: x ±1,14 … 1,20. */
const WANGE_X = 1.17;
/** Dicke eines Wangenblechs (m). */
const WANGE_DICKE = 0.06;

/** Radmitte in x (m) — aus `RAD_ECKEN` in `excavator.ts`, nicht abgeschrieben. */
export const RAD_X = 1.25;
/** Radmitte in z (m) — Radstand 3,00 m. */
export const RAD_Z = 1.5;
/** Radhalbmesser (m) — aus `wheelParts.ts`. */
const RAD_R = 0.62;

/**
 * Innenradius des Kotflügels (m). SW nach Augenmaß am gezeichneten Riss
 * (Konzept Abschnitt 9).
 *
 * 0,70 lässt 8 cm Luft über den Stollenspitzen (Radius 0,62). Weniger, und der
 * Bogen schnitte ins Rad, sobald die Maschine über eine Kante fährt; mehr, und
 * er schwebte darüber.
 */
const KOTFLUEGEL_R = 0.7;
/** Breite des Kotflügelbands (m). Konzept 01.4. */
const KOTFLUEGEL_B = 0.58;
/** Segmente des Kotflügelbogens. Konzept 01.4: 12. */
const KOTFLUEGEL_SEG = 12;

/**
 * 01.1 — Hauptrahmen: Kastenträger 1,50 × 0,60 × 4,40, an den Enden verjüngt.
 *
 * Die Verjüngung ist derselbe Kniff wie am Ausleger: `BoxGeometry` hat in
 * Längsrichtung nur die beiden Endquerschnitte, also genügt es, deren Breite
 * nachzuziehen. Vorn und hinten läuft der Träger auf 70 % zusammen — das ist
 * es, was ihn von einer Kiste unterscheidet.
 */
function hauptrahmen(): THREE.BufferGeometry {
  const hoehe = RAHMEN_OBEN - TRAEGER_UNTEN;
  const g = new THREE.BoxGeometry(TRAEGER_HALB * 2, hoehe, RAHMEN_HALB * 2);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getZ(i)) > RAHMEN_HALB - 1e-6) pos.setX(i, pos.getX(i) * 0.7);
  }
  pos.needsUpdate = true;
  g.translate(0, (TRAEGER_UNTEN + RAHMEN_OBEN) / 2, 0);
  return g;
}

/**
 * 01.1 — Seitenwangen links und rechts, mit drei Längssicken.
 *
 * Die Wange ist das Blech, das den Rahmen optisch bis über die Räder zieht.
 * Ihre UNTERKANTE bei 1,24 m ist der Kern des Pakets (siehe `WANGE_UNTEN`).
 * Die Sicken sind flache Aufkantungen — an ihnen sieht man, dass es ein
 * gekantetes Blech ist und kein gegossener Block.
 */
function seitenwangen(): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  const hoehe = RAHMEN_OBEN - WANGE_UNTEN;
  for (const sx of [-1, 1]) {
    const w = new THREE.BoxGeometry(WANGE_DICKE, hoehe, RAHMEN_HALB * 2 - 0.2);
    w.translate(sx * WANGE_X, (WANGE_UNTEN + RAHMEN_OBEN) / 2, 0);
    teile.push(w);
    for (const y of [WANGE_UNTEN + 0.08, WANGE_UNTEN + 0.18, WANGE_UNTEN + 0.28]) {
      const sicke = new THREE.BoxGeometry(0.025, 0.035, RAHMEN_HALB * 2 - 0.5);
      sicke.translate(sx * (WANGE_X + WANGE_DICKE / 2), y, 0);
      teile.push(sicke);
    }
    // Deckblech: schließt die Wange an den Mittelträger an
    const deck = new THREE.BoxGeometry(WANGE_X - TRAEGER_HALB, 0.05, RAHMEN_HALB * 2 - 0.2);
    deck.translate(sx * ((WANGE_X + TRAEGER_HALB) / 2), RAHMEN_OBEN - 0.025, 0);
    teile.push(deck);
  }
  return teile;
}

/**
 * 01.4 — Kotflügel über jedem Rad: ein Bogenband von 25° bis 155°.
 *
 * Gebaut aus zwölf flachen Quadern auf dem Bogen — als zwölf Meshes wären das
 * je Rad 12 Zeichenrufe gewesen, verschmolzen kosten sie keinen.
 *
 * Er ist das Teil, das aus einem Rad, das in einer Kiste steckt, ein Rad an
 * einem Fahrzeug macht: Der Bogen sagt dem Auge, wo das Rad aufhört.
 */
function kotfluegel(x: number, z: number): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  const a0 = THREE.MathUtils.degToRad(25);
  const a1 = THREE.MathUtils.degToRad(155);
  const schritt = (a1 - a0) / KOTFLUEGEL_SEG;
  // Sehnenlänge eines Segments, plus etwas Übermaß gegen Lücken in der Kurve
  const sehne = 2 * KOTFLUEGEL_R * Math.sin(schritt / 2) * 1.12;
  for (let i = 0; i < KOTFLUEGEL_SEG; i++) {
    const a = a0 + schritt * (i + 0.5);
    const g = new THREE.BoxGeometry(KOTFLUEGEL_B, 0.05, sehne);
    g.rotateX(-(a - Math.PI / 2));
    g.translate(x, RAD_R + Math.sin(a) * KOTFLUEGEL_R, z + Math.cos(a) * KOTFLUEGEL_R);
    teile.push(g);
  }
  return teile;
}

/**
 * 01.6 — Kraftstofftank links unter dem Rahmen, mit gefaster Unterkante.
 *
 * Der Kipper hat einen Tank (`delivery/vehicleModel.ts`), der Bagger hatte
 * keinen. Er sitzt links zwischen den Achsen, also genau in der Lücke, die
 * durch das Anheben der Wange entstanden ist — sonst wäre unter der Maschine
 * nichts als Luft.
 */
function tank(): THREE.BufferGeometry[] {
  const g = new THREE.BoxGeometry(0.42, 0.52, 1.2);
  // SW: links (+X) außen am Mittelträger, zwischen den Achsbrücken
  g.translate(0.95, 1.14, 0.1);
  const fase = new THREE.BoxGeometry(0.3, 0.1, 1.16);
  fase.translate(0.95, 0.86, 0.1);
  return [g, fase];
}

/** 01.2 — Achsbrücke vorn und hinten: 2,20 × 0,30 × 0,42, Mitte y 0,72. */
function achsbruecken(): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  for (const sz of [-1, 1]) {
    const g = new THREE.BoxGeometry(2.2, 0.3, 0.42);
    g.translate(0, 0.72, sz * RAD_Z);
    teile.push(g);
    // Differenzialtopf in der Mitte — sonst ist die Brücke ein Balken
    const topf = new THREE.CylinderGeometry(0.19, 0.19, 0.34, 10);
    topf.rotateZ(Math.PI / 2);
    topf.translate(0, 0.72, sz * RAD_Z);
    teile.push(topf);
    // Anbindung an den Mittelträger
    const steg = new THREE.BoxGeometry(0.5, 0.36, 0.3);
    steg.translate(0, 0.94, sz * RAD_Z);
    teile.push(steg);
  }
  return teile;
}

/**
 * 01.3 — Achsschenkel / Lenkkopf vorn, 0,24 × 0,34 × 0,24 bei x ±1,00.
 *
 * ABWEICHUNG VOM KONZEPT, bewusst: Dort steht „beweglich (dreht mit der
 * Lenkung)". Ein mitdrehender Achsschenkel wäre ein eigener Starrkörper und
 * damit ein eigenes Netz je Vorderrad — zwei Netze, vier Zeichenrufe, für ein
 * Teil von 24 cm Kantenlänge, das hinter dem Rad sitzt. Die Budgetregel wiegt
 * schwerer: Er steht hier fest im Stahl-Netz. Sichtbar lenkt das Rad, und
 * darum geht es.
 */
function achsschenkel(): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.24, 0.34, 0.24);
      g.translate(sx * 1.0, 0.72, sz * RAD_Z);
      teile.push(g);
      // Achsstummel bis in die Nabe
      const stummel = new THREE.CylinderGeometry(0.075, 0.075, 0.28, 8);
      stummel.rotateZ(Math.PI / 2);
      stummel.translate(sx * 1.14, RAD_R, sz * RAD_Z);
      teile.push(stummel);
    }
  }
  return teile;
}

/**
 * 01.5 — Aufstieg rechts vorn: drei Stufen und ein Handlauf zum Deck.
 *
 * −X ist rechts (Regel siehe `RAD_ECKEN` in `excavator.ts`). Der Aufstieg ist
 * das, was einer Maschine Maßstab gibt: An einer Leiter mit 28-cm-Stufen liest
 * das Auge ab, wie hoch der Oberwagen wirklich steht.
 */
function aufstieg(): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  /*
   * x −1,28: AUSSEN an der Seitenwange (die bei −1,17 steht) und INNEN vor dem
   * Rad (das von −1,00 bis −1,50 reicht) — aber bei z 1,00, also in der Lücke
   * zwischen Vorderrad (z 1,25 … 1,75) und Fahrzeugmitte. Stünde der Aufstieg
   * weiter innen, steckte er in der Wange; weiter außen, im Rad.
   */
  const x = -1.28;
  for (let i = 0; i < 3; i++) {
    const stufe = new THREE.BoxGeometry(0.26, 0.05, 0.3);
    stufe.translate(x, 0.52 + i * 0.3, 1.0);
    teile.push(stufe);
    const wange = new THREE.BoxGeometry(0.04, 0.3, 0.05);
    wange.translate(x - 0.11, 0.67 + i * 0.3, 1.0);
    teile.push(wange);
  }
  /*
   * Der Handlauf endet bei y 1,80 — 2 cm UNTER der Deckplatte des Oberwagens
   * (1,82). Im ersten Versuch am 15.09.2026 reichte er bis 2,10 und stand
   * damit mitten durch die Deckplatte, die 2,90 m breit ist und ihn an dieser
   * Stelle überdeckt. Im Riss war das ein Strich, der aus dem Deck wuchs.
   */
  const holm = new THREE.CylinderGeometry(0.025, 0.025, 0.72, 8);
  holm.translate(x - 0.11, 1.44, 1.18);
  teile.push(holm);
  const bogen = new THREE.CylinderGeometry(0.025, 0.025, 0.28, 8);
  bogen.rotateX(Math.PI / 2);
  bogen.translate(x - 0.11, 1.78, 1.04);
  teile.push(bogen);
  return teile;
}

/** 01.6 — Tankstutzen mit Deckel, oben auf dem Tank. */
function tankstutzen(): THREE.BufferGeometry[] {
  const hals = new THREE.CylinderGeometry(0.07, 0.07, 0.09, 10);
  hals.translate(0.95, 1.44, 0.5);
  const deckel = new THREE.CylinderGeometry(0.085, 0.085, 0.035, 10);
  deckel.translate(0.95, 1.5, 0.5);
  return [hals, deckel];
}

/** 01.7 — Werkzeugkasten rechts, 0,72 × 0,40 × 0,60, mit Deckel und Verschluss. */
function werkzeugkasten(): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  const kasten = new THREE.BoxGeometry(0.4, 0.42, 0.72);
  kasten.translate(-0.95, 1.16, -0.35);
  teile.push(kasten);
  const deckel = new THREE.BoxGeometry(0.44, 0.045, 0.76);
  deckel.translate(-0.95, 1.39, -0.35);
  teile.push(deckel);
  const verschluss = new THREE.BoxGeometry(0.05, 0.08, 0.1);
  verschluss.translate(-1.16, 1.32, -0.35);
  teile.push(verschluss);
  return teile;
}

/** 01.8 / 01.9 — Abschleppösen vorn und hinten, Unterfahrschutz hinten. */
function oesenUndSchutz(): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const oese = new THREE.BoxGeometry(0.07, 0.2, 0.22);
      oese.translate(sx * 0.32, 1.12, sz * (RAHMEN_HALB + 0.05));
      teile.push(oese);
      const loch = new THREE.CylinderGeometry(0.05, 0.05, 0.09, 8);
      loch.rotateZ(Math.PI / 2);
      loch.translate(sx * 0.32, 1.12, sz * (RAHMEN_HALB + 0.12));
      teile.push(loch);
    }
  }
  const schutz = new THREE.BoxGeometry(1.5, 0.14, 0.1);
  schutz.translate(0, 0.92, -(RAHMEN_HALB + 0.06));
  teile.push(schutz);
  return teile;
}

/**
 * 01.9 / 03.1 — die vier Pratzenausleger.
 *
 * Sie waren vier eigene Meshes (`03_PRATZE_*_AUSLEGER`) und liegen jetzt im
 * Unterwagen-Netz, wie im Konzept vorgesehen: Sie bewegen sich nicht — nur der
 * Fuß darunter fährt aus.
 *
 * Ihr INNERES Ende musste wandern: Es lag bei x ±1,05 und damit im alten,
 * 2,40 m breiten Kasten. Der neue Mittelträger ist 1,50 m breit; ohne diese
 * Verlängerung hinge der Ausleger frei in der Luft. Das ÄUSSERE Ende bleibt,
 * wo es war (x ±1,80) — dort sitzt der Fuß, und der wird nicht angefasst.
 */
function pratzenausleger(): THREE.BufferGeometry[] {
  const teile: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const von = new THREE.Vector3(sx * 0.62, 0.95, sz * 1.35);
      const bis = new THREE.Vector3(sx * 1.8, 0.7, sz * 1.35);
      const richtung = bis.clone().sub(von);
      const laenge = richtung.length();
      const g = new THREE.BoxGeometry(0.34, 0.34, laenge + 0.3);
      const q = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        richtung.clone().normalize()
      );
      g.applyQuaternion(q);
      g.translate(
        von.x + richtung.x / 2,
        von.y + richtung.y / 2,
        von.z + richtung.z / 2
      );
      teile.push(g);
    }
  }
  return teile;
}

/** Das LACK-Netz des Unterwagens (grün) — ein Mesh für 15 Teile. */
export function unterwagenLack(): THREE.BufferGeometry {
  const teile: THREE.BufferGeometry[] = [hauptrahmen(), ...seitenwangen(), ...tank()];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) teile.push(...kotfluegel(sx * RAD_X, sz * RAD_Z));
  return verschmelze(teile, "Unterwagen-Lack");
}

/** Das STAHL-Netz des Unterwagens (anthrazit) — ein Mesh für 14 Teile. */
export function unterwagenStahl(): THREE.BufferGeometry {
  const ring = drehkranzRing();
  ring.translate(0, DREHKRANZ_Y_UNTEN, 0);
  return verschmelze(
    [
      ...achsbruecken(),
      ...achsschenkel(),
      ...aufstieg(),
      ...tankstutzen(),
      ...werkzeugkasten(),
      ...oesenUndSchutz(),
      ...pratzenausleger(),
      ring,
    ],
    "Unterwagen-Stahl"
  );
}
