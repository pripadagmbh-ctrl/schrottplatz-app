import * as THREE from "three";
import { umkugelRadius, type ItemManager, type ScrapItem } from "./scrapItems";
import { hitsObstacle, slideAround } from "./obstacles";
import {
  CONFIGS,
  gehoertHierhin,
  bayVorderkante,
  bayOeffnung,
  bayHalb,
  type ContainerConfig,
} from "./containers";
import { KAFFEE_ROT, BUCHT_Z } from "./yard";
import { BAGGER_STAND, SCHWENK_AUSSEN } from "./baggerstand";
import { findeBox, ausBox, type Box } from "./boxen";
import {
  wegFrei,
  streckeSchneidetZone,
  inZonen,
  nachbarn,
  SCHAUFEL_BREITE,
  type WegTeil,
  type Zone,
} from "./weg";
import { KAFFEE_THEKE } from "./yard";
import { OFFICE_X } from "./office";
import { ABKIPP_ZONE } from "../delivery/routes";
import {
  WheelLoader,
  LOADER_SPEED,
  brauchtSchieben,
  schiebeZiel,
  SCHIEB_MIN_M,
  SCHIEB_MIN_KG,
  ablagePlatz,
  anstellFuerZiel,
  haltFuerZiel,
  SCHIEB_VORLAUF,
} from "./loader";
import { aufFahrspur } from "./fahrspuren";
import { istVoll, fuellgrad } from "./fuellstand";
import { ABFALL } from "../materials/catalog";
import { lambertfunk, LAMBERT_FUNKNAME, type Lambertlage } from "./lambertfunk";

/**
 * Platzpersonal (Design 2026-08-29):
 * - Mario Baer steht an der Brückenwaage und wiegt ein und aus.
 * - Janine Prison schenkt am Klapptisch vor dem Büro Kaffee aus.
 * - Lambert Prison ist Platzwart: Er weist ankommende LKW ein und räumt
 *   zwischendurch herumliegende Kleinteile auf.
 * Alle Figuren sind stilisierte Low-Poly-Figuren aus runden Grundformen.
 */

export interface PersonColors {
  shirt: number;
  trousers: number;
  hair: number;
  skin?: number;
}

export interface PersonParts {
  group: THREE.Group;
  armLeft: THREE.Mesh;
  armRight: THREE.Mesh;
  legLeft: THREE.Mesh;
  legRight: THREE.Mesh;
}

/** Stehende Figur, Ursprung an den Füßen. */
export function buildPerson(colors: PersonColors): PersonParts {
  const skin = new THREE.MeshStandardMaterial({
    color: colors.skin ?? 0xe3b18c,
    roughness: 0.8,
  });
  const shirt = new THREE.MeshStandardMaterial({ color: colors.shirt, roughness: 0.85 });
  const trousers = new THREE.MeshStandardMaterial({ color: colors.trousers, roughness: 0.9 });
  const hair = new THREE.MeshStandardMaterial({ color: colors.hair, roughness: 0.95 });

  const group = new THREE.Group();
  const add = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number
  ): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    group.add(m);
    return m;
  };

  // Beine (Drehpunkt oben, damit sie beim Laufen pendeln können)
  const legGeo = new THREE.CapsuleGeometry(0.075, 0.4, 4, 10);
  legGeo.translate(0, -0.25, 0);
  const legLeft = add(legGeo, trousers, -0.1, 0.78, 0);
  const legRight = add(legGeo.clone(), trousers, 0.1, 0.78, 0);
  // Rumpf + Schultern
  add(new THREE.CapsuleGeometry(0.16, 0.32, 4, 12), shirt, 0, 1.06, 0);
  add(new THREE.SphereGeometry(0.17, 12, 10), shirt, 0, 1.22, 0);
  // Arme (Drehpunkt an der Schulter)
  const armGeo = new THREE.CapsuleGeometry(0.055, 0.38, 4, 10);
  armGeo.translate(0, -0.24, 0);
  const armLeft = add(armGeo, shirt, -0.22, 1.24, 0);
  const armRight = add(armGeo.clone(), shirt, 0.22, 1.24, 0);
  // Hals, Kopf, Haare
  add(new THREE.CapsuleGeometry(0.05, 0.06, 4, 10), skin, 0, 1.38, 0);
  const head = add(new THREE.SphereGeometry(0.115, 14, 12), skin, 0, 1.52, 0);
  head.scale.set(1, 1.12, 1.02);
  const cap = add(new THREE.SphereGeometry(0.122, 14, 12), hair, 0, 1.55, -0.01);
  cap.scale.set(1, 0.95, 1.02);

  return { group, armLeft, armRight, legLeft, legRight };
}

/**
 * Was Lambert gerade tut.
 *
 *   patrol  wartet und sieht sich um
 *   guide   weist einen LKW ein
 *   fetch   holt ein Teil (zu Fuss oder mit der Schaufel)
 *   carry   bringt es in seine Mulde
 *   shove   faehrt hinter ein Teil, das der Bagger nicht erreicht
 *   shoving schiebt es in die Reichweite des Baggers
 *   werkzeug geht zu einem Stueck, das Flex oder Abdrueckmaschine braucht
 *   trennt  arbeitet daran, bis es in seine Fraktionen faellt
 *   zurBude geht zu Janine, weil gerade nichts zu holen ist
 *   kaffee  steht an der Theke
 *   zurueckZurMaschine geht zurueck zum Radlader
 *
 * Die beiden letzten gibt es nur mit Radlader — von Hand schiebt niemand
 * einen halben Motorblock ueber den Platz.
 */
/**
 * Janines Kaffeewagen (Wunsch 11.09.2026).
 *
 * Ein alter Anhänger mit runder Alu-Haube, Verkaufsklappe zur Hofseite, die
 * als Vordach hochsteht, Theke mit Siebträgermaschine, zwei Hockern und einer
 * Lichterkette. Auf einem Schrottplatz ist so ein Wagen der einzige Ort mit
 * Farbe — deshalb Mintgrün und Messing statt Grau.
 */
function buildKaffeewagen(scene: THREE.Scene, pos: THREE.Vector3, rot: number): THREE.Group {
  const g = new THREE.Group();
  g.position.copy(pos);
  // Klappe und Theke sitzen in +x; die Drehung richtet sie zum Platz aus
  g.rotation.y = rot;
  scene.add(g);

  const alu = new THREE.MeshStandardMaterial({ color: 0xd8dee0, roughness: 0.25, metalness: 0.85 });
  const mint = new THREE.MeshStandardMaterial({ color: 0x5fbfa8, roughness: 0.5, metalness: 0.2 });
  const messing = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.8 });
  const holz = new THREE.MeshStandardMaterial({ color: 0x8d6a4a, roughness: 0.85 });
  const dunkel = new THREE.MeshStandardMaterial({ color: 0x2a2e31, roughness: 0.8 });

  // Wagenkasten: unten Mintband, oben die runde Aluhaube
  const L = 4.2; // Länge in z
  const B = 2.1; // Breite in x
  const kasten = new THREE.Mesh(new THREE.BoxGeometry(B, 1.05, L), mint);
  kasten.position.set(0, 1.05, 0);
  kasten.castShadow = true;
  g.add(kasten);
  const haube = new THREE.Mesh(new THREE.CylinderGeometry(B / 2, B / 2, L, 16, 1, false, 0, Math.PI), alu);
  haube.rotation.z = Math.PI / 2;
  haube.rotation.y = Math.PI / 2;
  haube.position.set(0, 1.58, 0);
  haube.castShadow = true;
  g.add(haube);
  // Zierstreifen auf halber Höhe
  const streifen = new THREE.Mesh(new THREE.BoxGeometry(B + 0.04, 0.12, L + 0.04), messing);
  streifen.position.set(0, 1.55, 0);
  g.add(streifen);

  // Verkaufsklappe zur Ostseite, hochgestellt als Vordach
  const klappe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, L - 1.2), alu);
  klappe.position.set(B / 2 + 0.55, 2.35, 0);
  klappe.rotation.z = -1.15;
  klappe.castShadow = true;
  g.add(klappe);
  const oeffnung = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.95, L - 1.4), dunkel);
  oeffnung.position.set(B / 2 + 0.01, 1.55, 0);
  g.add(oeffnung);
  // Theke: Brett vor der Öffnung
  const theke = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.09, L - 1.4), holz);
  theke.position.set(B / 2 + 0.28, 1.12, 0);
  theke.castShadow = true;
  g.add(theke);
  // Siebträgermaschine und Mühle auf der Theke
  const maschine = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.6), messing);
  maschine.position.set(B / 2 + 0.25, 1.36, -0.8);
  g.add(maschine);
  const muehle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.42, 10), dunkel);
  muehle.position.set(B / 2 + 0.25, 1.37, 0.1);
  g.add(muehle);
  for (const tz of [0.7, 0.95, 1.2]) {
    const tasse = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.08, 8), alu);
    tasse.position.set(B / 2 + 0.35, 1.2, tz);
    g.add(tasse);
  }

  // Räder und Deichsel — es ist ein Anhänger, kein Kiosk
  for (const rz of [-0.9, 0.9]) {
    const rad = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 14), dunkel);
    rad.rotation.z = Math.PI / 2;
    rad.position.set(B / 2 - 0.05, 0.34, rz);
    g.add(rad);
    const links = rad.clone();
    links.position.x = -B / 2 + 0.05;
    g.add(links);
  }
  const stuetzen = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), dunkel);
  stuetzen.position.set(0, 0.25, -L / 2 + 0.3);
  g.add(stuetzen);
  const deichsel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.3), dunkel);
  deichsel.position.set(0, 0.55, L / 2 + 0.6);
  g.add(deichsel);

  // Zwei Hocker und ein Stehtisch davor
  for (const hz of [-0.9, 0.6]) {
    const sitz = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.07, 10), holz);
    sitz.position.set(B / 2 + 1.5, 0.75, hz);
    g.add(sitz);
    const bein = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.72, 8), messing);
    bein.position.set(B / 2 + 1.5, 0.36, hz);
    g.add(bein);
  }

  // Lichterkette über der Klappe
  for (let i = 0; i < 7; i++) {
    const birne = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 8, 6),
      new THREE.MeshStandardMaterial({
        color: 0xffe2a8,
        emissive: 0xffc25a,
        emissiveIntensity: 0.85,
        roughness: 0.4,
      })
    );
    const t = i / 6 - 0.5;
    birne.position.set(B / 2 + 0.95, 2.25 - Math.cos(t * 2.4) * 0.16, t * (L - 1.4));
    g.add(birne);
  }

  // Kleine Tafel an der Wagenwand
  const tafel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.5), dunkel);
  tafel.position.set(B / 2 + 0.02, 0.9, -L / 2 + 0.5);
  g.add(tafel);
  return g;
}

/*
 * Lamberts Pausen (Auftrag 11.09.2026, Phase 0.2). Wenn nichts zu holen ist,
 * sitzt er nicht untaetig im Radlader — er geht zu Janine einen Kaffee
 * trinken und sieht danach wieder nach.
 */
/** Mindestabstand zwischen zwei Pausen (s) */
const PAUSE_ABSTAND_S = 180;
/** Pausendauer (s) — gewuerfelt */
const PAUSE_DAUER_S: [number, number] = [30, 90];
/** Kommt ein LKW, trinkt er aus: Rest halbiert, hoechstens so lange (s) */
const PAUSE_KURZ_MAX_S = 15;
/** So oft sieht er nach neuer Arbeit, wenn gerade nichts geht (s) */
const PRUEF_INTERVALL_S: [number, number] = [3, 5];
/** Korridorbreite zu Fuss — ein Mensch steigt ueber Kleinteile */
const FUSS_BREITE = 0.9;
/**
 * Faehrt Lambert den Radlader?
 *
 * Auf false steht die Maschine abgestellt in der Halle und Lambert arbeitet
 * zu Fuss — er raeumt dann nur noch, was er tragen kann. Zum Wiedereinschalten
 * genuegt `true`; die Logik des Radladers ist unveraendert vorhanden.
 */
// Wieder in Betrieb (Ansage 12.09.2026): Er bedient die weit aussen
// liegenden Silos und faehrt das Zwischenlager ab.
const RADLADER_IN_BETRIEB = true;
/**
 * Raeumt Lambert von sich aus auf dem Platz auf?
 *
 * Ansage 13.09.2026: „er kommt dann nicht mehr bei uns aufraeumen." Bis dahin
 * suchte er selbsttaetig nach Arbeit — blockierte Fahrspuren, Raeder mit
 * Alufelge, weit abgelegte Brocken, Buntmetall im Stahlhaufen — und war damit
 * staendig im Arbeitsbereich des Baggers unterwegs.
 *
 * Jetzt wartet er auf der Ostseite, bis er gerufen wird, und leert dann die
 * Sortierboxen in die Mulden an der Ostwand. Die alte Rangfolge ist nicht
 * geloescht, nur abgeschaltet: `true`, und sie ist unveraendert wieder da.
 */
const RAEUMT_AUF = false;
/**
 * Raeumt er von SICH AUS auf — ohne Ruf, aber in einem engen Rahmen?
 *
 * Patricks Gerätetest 16.09.2026, zwei Punkte, die zusammengehoeren:
 * „Lambert sortiert den Abfall mit dem Radlader in die Mulden" und „Mulden
 * befuellen, solange Platz ist; sonst andere Arbeit aufnehmen — z. B. Schrott
 * von der Bueroseite an den Bagger heranschieben."
 *
 * Das ist NICHT die alte Rangfolge von vor dem 13.09. (`RAEUMT_AUF`). Die
 * suchte Arbeit auf dem ganzen Platz — blockierte Fahrspuren, Raeder mit
 * Alufelge, Buntmetall im Stahlhaufen — und schickte ihn dabei staendig in den
 * Arbeitsbereich des Baggers. Diese hier kennt genau ZWEI Aufgaben, in fester
 * Reihenfolge:
 *
 *   1. Abfall, der herumliegt, in eine Abfallmulde — solange dort Platz ist
 *      (`world/fuellstand.ts`).
 *   2. sonst: Schrott von der Bueroseite an den Bagger heranschieben.
 *
 * Beide beruehren den Arbeitsbereich des Baggers nicht: Das Sperrgebiet
 * (`imBaggerrevier`) gilt unveraendert weiter, und die Bueroseite liegt
 * ohnehin auf der anderen Haelfte des Platzes. Gerufen wird er weiterhin mit
 * Y; der Ruf hat Vorrang vor beidem.
 */
const SELBST_AUFRAEUMEN = true;
/**
 * Bis wohin er Abfall aufsammelt (m, Weltkoordinaten).
 *
 * Derselbe Arbeitsteil des Platzes wie in `findStray` — der Kasten steht dort
 * schon so. Weiter draussen liegt nichts, was er einsammeln soll: im Norden
 * die Waage, im Sueden hinter z −20 die Muldenzeile.
 */
const ABFALL_FELD = { xMax: 22, zMin: -20, zMax: 22 };
/**
 * Die BUEROSEITE — der Streifen, aus dem er Schrott zum Bagger schiebt.
 *
 * Gerechnet, nicht gegriffen. Das Buero steht an der Westwand
 * (`OFFICE_X` = −35,1, Tiefe 9,0 m), seine Front liegt damit auf x −30,6;
 * davor liegt der grosse freie Mittelplatz. Nach Westen ist bei x −30,6
 * Schluss — dahinter ist Gebaeude. Nach Osten reicht der Streifen bis an die
 * alte Grenze von `findSchiebegut` (x +4), damit sich an dem, was er bisher
 * schon schob, nichts aendert; neu ist nur der Teil zwischen −30,6 und −24.
 *
 * In z bleibt es bei der alten Schranke: noerdlich von z −12 endet das
 * Sperrgebiet des Baggers (`REVIER_Z` = −11,9), suedlich davon hat er nichts
 * zu suchen.
 */
const BUEROSEITE = { xMin: OFFICE_X + 4.5, xMax: 4, zMin: -12, zMax: 22 };
/**
 * Wie viel Luft ein geschobener Brocken zum naechsten braucht (m).
 *
 * Die Schaufel ist 2,20 m breit (`SCHAUFEL_BREITE`); die Haelfte davon plus
 * ein halber Meter Rand sind 1,60 m. Weniger, und er schiebt den naechsten
 * Brocken in den vorigen hinein.
 */
const ABLAGE_LUECKE = 1.6;
/**
 * Wo er wartet: auf der Ostseite, zwischen Muldenreihe und Sortierboxen.
 *
 * Ansage: „Lambert faehrt von der Ostseite ran auf Befehl." Der Platz ist
 * gesucht, nicht gegriffen: Er liegt in der Gasse zwischen Grossteileflaeche
 * (bis x −16,75) und der Muldenreihe (ab x −12,25), also genau vor deren
 * offenen Seiten — von dort kommt er mit der Schaufel hinein, ohne quer durch
 * eine Zone zu fahren.
 */
const OSTPOSTEN = new THREE.Vector3(-15.0, 0, -18.0);
/**
 * Bis zu welcher Hoehe ein Stueck in einer Sortierbox noch als abholbar gilt.
 *
 * Die alte Schranke war 1,4 m — sie stammt von den flachen Absetzcontainern
 * und aus der Frage, ob ein Stueck auf einer Ladeflaeche liegt. In einer Box
 * mit 1,8 m Wand liegt der Haufen hoeher, und mit 1,4 m galt eine volle Box
 * als leer: Gemessen hat Lambert den Ruf sofort wieder abgesagt, weil die
 * gerade abgekippte Ladung noch uebereinander lag.
 */
const BOX_MAX_Y = 3.5;
/**
 * Abstellplatz des Radladers: vor dem Buero, suedlich daneben.
 *
 * Er stand bis zum 14.09.2026 in der ersten Werkstatthalle an der Westwand.
 * Die gibt es dort nicht mehr — die Hallen sind an die Nordwand gezogen, die
 * Silo-Reihe hat ihren Platz eingenommen (E-010). Die Koordinate bleibt
 * dieselbe, damit sich an Lamberts Verhalten nichts aendert; sie steht jetzt
 * nur ausgeschrieben statt als Hallenmitte.
 */
const RADLADER_PARKPLATZ = new THREE.Vector3(OFFICE_X + 1.5, 0, 18.8);
/** Blickrichtung dort — aus der Halle heraus (+X). */
const RADLADER_PARKYAW = Math.PI / 2;

/**
 * Wie lange er an einem Stueck arbeitet (s).
 *
 * Eine Alufelge vom Reifen zu bekommen ist keine Sekundensache: Ventil raus,
 * Wulst abdruecken, Felge heraushebeln. Neun Sekunden sind im Spiel lang genug,
 * dass man ihn dabei sieht, und kurz genug, dass er nicht den halben Tag an
 * einem Rad steht.
 */
const WERKZEUG_S = 9;
/** So weit laeuft er hoechstens zu einer Werkzeugarbeit (m) */
const WERKZEUG_WEITE = 26;
/** Abstand zwischen zwei Funkengarben (s) */
const FUNKEN_TAKT = 0.35;

/** Bis hierher traegt er von Hand, wenn der Radlader nicht hinkommt (kg) */
const HANDLAST_KG = 60;
/** So lange setzt er zurueck, wenn ihm etwas den Weg versperrt (s) */
const RUECKWAERTS_S = 1.6;
/**
 * Abkippplatz vor dem Bagger — dort landet die Fuhre, da faehrt er nicht
 * hinein.
 *
 * Die Zahl stand hier als Kopie und zeigte am 14.09.2026 abends noch auf
 * (−4,0 | −10), also auf eine Stelle, an der seit dem Platzumbau niemand mehr
 * abkippt. Jetzt kommt sie aus `routes.ts` — dort, wo auch der Kipper sie
 * liest.
 */
const ABKIPP = { x: ABKIPP_ZONE[0], z: ABKIPP_ZONE[1], hw: 4.5, hd: 4.5 };
/** In diesem Umkreis muss ein Teil frei liegen, damit er es holt (m) */
/** Um so viel wird eine Zone fuer die Wegpruefung geschrumpft (m) */
const ZONE_RAND = 1.0;
const RAND_RADIUS = 1.8;
/** So viele Nachbarn darf ein Teil hoechstens haben — sonst liegt es mitten drin */
const RAND_MAX_NACHBARN = 2;
/** In diesem Umkreis zaehlt ein Aufwachen als "von Lambert verursacht" (m) */
const WECK_RADIUS = 4;
/** So weit im Voraus werden schlafende Teile gemerkt (m) */
const WECK_MERK_RADIUS = 12;

/** Marios Gehtempo (m/s) — zuegig, er hat einen LKW warten. */
const MARIO_TEMPO = 2.0;

type LambertState =
  | "patrol"
  | "guide"
  | "fetch"
  | "carry"
  | "shove"
  | "shoving"
  | "werkzeug"
  | "trennt"
  | "zurBude"
  | "kaffee"
  | "zurueckZurMaschine";

export class StaffManager {
  private lambert: PersonParts;
  private mario!: PersonParts;
  /** Wohin Mario zur Kontrolle geht und wohin er zurueckkehrt */
  private readonly pruefPos = new THREE.Vector3();
  private readonly bueroTuer = new THREE.Vector3();
  private marioState: "innen" | "raus" | "pruefen" | "zurueck" = "innen";
  private marioT = 0;
  private marioPhase = 0;
  /**
   * Steht gerade ein Fahrzeug zur Kontrolle auf der Waage? Liefert dessen
   * Position — von main aus der Fahrzeugverwaltung gesetzt.
   */
  getWeighTruck: (() => THREE.Vector3 | null) | null = null;
  private lambertState: LambertState = "patrol";
  /** Ist er gerufen? Ohne Ruf bleibt er auf dem Ostposten stehen. */
  private gerufen = false;
  /**
   * Wohin das aufgenommene Stueck soll, wenn es NICHT die Standardmulde seiner
   * Fraktion ist.
   *
   * Beim Abfall gibt es zwei Ziele — den versetzbaren Muellcontainer auf dem
   * Hof und das Abfall-Silo an der Suedwand. Welches genommen wird, entscheidet
   * sich beim Annehmen der Arbeit (naechstes erreichbares mit Platz); ohne
   * dieses Feld wuerde `onArrived` es ein zweites Mal entscheiden und koennte
   * auf das andere kommen.
   */
  private zielMulde: ContainerConfig | null = null;
  /**
   * Was er gerade von sich aus tut — fuer die Funkmeldungen.
   *
   * `null` heisst: kein laufender Auftrag. Beim Wechsel von `null` auf eine
   * Arbeit meldet er sich an, beim Wechsel zurueck ab. So kommt je Lauf EINE
   * Meldung und nicht je Stueck.
   */
  private aufraeumLauf: "abfall" | "schieben" | null = null;
  /**
   * Hat er schon gemeldet, dass die Mulde voll ist? Sonst funkt er es bei
   * jeder Arbeitssuche neu — alle drei bis fuenf Sekunden.
   */
  private vollGemeldet = false;
  /**
   * Der Funkkanal. Denselben, den auch der Abholer und die Anlieferer
   * benutzen (`VehicleManager.onPickupFunk` → `hud.toast`); `main.ts` haengt
   * beide an dieselbe Zeile.
   */
  onFunk: ((wer: string, spruch: string) => void) | null = null;

  /** Eine Lage durchgeben. */
  private funk(lage: Lambertlage): void {
    this.onFunk?.(LAMBERT_FUNKNAME, lambertfunk(lage));
  }

  /**
   * Einen Lauf anmelden oder abmelden. Gemeldet wird nur der WECHSEL — wer
   * zwanzig Bretter in die Mulde faehrt, sagt einmal Bescheid und einmal, dass
   * er durch ist.
   */
  private setzeLauf(lauf: "abfall" | "schieben" | null): void {
    if (this.aufraeumLauf === lauf) return;
    if (this.aufraeumLauf === "abfall") this.funk("abfallFertig");
    else if (this.aufraeumLauf === "schieben") this.funk("schiebenFertig");
    this.aufraeumLauf = lauf;
    if (lauf === "abfall") this.funk("abfallAn");
    else if (lauf === "schieben") this.funk("schiebenAn");
  }
  /** Faehrt er gerade nur bis vor die offene Seite einer Mulde? */
  private zwischenhalt = false;

  /**
   * Wohin er geht, wenn eine Aufgabe zu Ende ist.
   *
   * Ohne Aufraeumdienst ist das sein Posten, nicht der alte Patrouillenweg:
   * Sonst faehrt er nach jedem abgelieferten Stueck erst nach Norden und dann
   * wieder zurueck.
   */
  private get ruhepunkt(): THREE.Vector3 {
    return RAEUMT_AUF ? this.patrol[this.patrolIdx]! : OSTPOSTEN;
  }

  /**
   * Lambert rufen (Taste Y / Knopf LAMBERT).
   *
   * Ansage 13.09.2026: „ich rufe Lambert, wenn voll, er kippt hinten in
   * Silos." Er kommt, raeumt die Sortierboxen leer und faehrt das Material zu
   * der Mulde seiner Fraktion an der Ostwand. Ist nichts mehr zu holen, stellt
   * er sich wieder auf seinen Posten.
   */
  rufeLambert(): "kommt" | "schon unterwegs" | "nichts zu holen" {
    if (this.gerufen) return "schon unterwegs";
    /*
     * Nur pruefen, OB etwas in den Boxen liegt — nicht, ob er es von seinem
     * jetzigen Standplatz aus erreicht. Der Weg haengt daran, wo er gerade
     * steht und was sonst herumliegt; danach zu fragen hiesse, den Ruf
     * abzulehnen, weil er noch nicht losgefahren ist.
     */
    if (!this.gibtEsBoxArbeit()) return "nichts zu holen";
    this.gerufen = true;
    this.naechstePruefung = 0;
    this.pruefUhr = 999;
    return "kommt";
  }

  /** Fuer HUD und Tests: arbeitet er gerade? */
  get lambertArbeitet(): boolean {
    return this.gerufen;
  }

  /** Wo Lambert steht — fuer Tests und das Debug-Overlay. */
  get lambertOrt(): THREE.Vector3 {
    return this.lambert.group.position;
  }

  /** Liegt ueberhaupt etwas in den Sortierboxen, das in eine Ostmulde gehoert? */
  private gibtEsBoxArbeit(): boolean {
    const boxen = CONFIGS.filter((c) => c.sortierbox === true);
    for (const it of this.items.items) {
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      const ziel = StaffManager.muldeFuer(it.materialId);
      if (!ziel || ziel.kind !== "bay") continue;
      const p = it.body.translation();
      if (p.y > BOX_MAX_Y) continue;
      if (
        boxen.some(
          (c) => Math.abs(p.x - c.x) <= c.size[0] / 2 && Math.abs(p.z - c.z) <= c.size[1] / 2
        )
      ) {
        return true;
      }
    }
    return false;
  }
  private lambertTarget = new THREE.Vector3();
  private walkPhase = 0;
  private waveT = 0;
  private carriedItemId: string | null = null;
  private stateT = 0;
  private patrolIdx = 0;

  /**
   * Warteposten am Rand des Schrottfelds. Ist gerade nichts wegzuräumen,
   * stellt er sich dorthin, statt sinnlos Runden zu drehen.
   */
  private readonly patrol = [
    // Beide Posten liegen ausserhalb des Abkippplatzes (0/7, 8 x 8 m) und
    // neben der Einfahrtsspur. Vorher stand er mitten in der Abladestelle —
    // gemessen 92 Prozent der Zeit (11.09.2026).
    new THREE.Vector3(-3.0, 0, -3.0),
    new THREE.Vector3(-20.0, 0, -3.0),
  ];
  /** Einweisplatz neben dem Abkippplatz */
  /** Einweisplatz: am Rand des Abkippplatzes, nicht darin */
  private readonly guidePos = new THREE.Vector3(-4.5, 0, -5.0);

  /** Baggerposition — um die Maschine selbst geht er herum */
  getExcavatorPos: (() => THREE.Vector3) | null = null;
  /**
   * Position der Spinne. Lambert arbeitet mitten im Schrottfeld — das liegt
   * nun einmal vor dem Bagger. Ausweichen muss er nur dem, was sich gerade
   * über ihm bewegt, nicht der ganzen Maschine (Design-Fix 29.08.2026).
   */
  getGrapplePos: (() => THREE.Vector3) | null = null;
  /** Liegt (x,z) auf einer Sortierflaeche — Haufen oder Mulde? */
  private static inZone(x: number, z: number): boolean {
    for (const c of CONFIGS) {
      const [w, d] = c.size;
      if (Math.abs(x - c.x) < w / 2 + 1.0 && Math.abs(z - c.z) < d / 2 + 1.0) return true;
    }
    return false;
  }

  /**
   * Teil, das gerade eine Fahrspur blockiert. Das hat Vorrang vor allem
   * anderen: Solange es dort liegt, steht der Betrieb.
   */
  getBlockingItem: (() => (typeof this.items.items)[number] | null) | null = null;

  /**
   * Was Lambert bewegen kann. Von Hand sind das Kleinteile; mit dem Radlader
   * räumt er auch schwere Brocken von der Fahrspur.
   */
  get tragkraft(): number {
    return (this.faehrt ? 900 : HANDLAST_KG) * (this.getLiftBonus?.() ?? 1);
  }

  /** Sitzt er gerade im Radlader? Zu Fuss gelten andere Regeln. */
  private get faehrt(): boolean {
    return this.hasLoader && !this.zuFuss;
  }
  /** Tempofaktor aus dem Bulldozer — von main gesetzt */
  getSpeedBonus: (() => number) | null = null;
  /** Traglastfaktor aus dem Stapler — von main gesetzt */
  getLiftBonus: (() => number) | null = null;

  /**
   * Zu Fuss unterwegs, obwohl der Radlader da ist: Wenn mit der Maschine
   * nichts zu erreichen ist, steigt er aus und sortiert Kleinteile von Hand
   * oder geht Kaffee trinken (Auftrag 11.09.2026, Rangfolge in Phase 0.2).
   */
  private zuFuss = false;
  /** Restzeit an der aktuellen Werkzeugarbeit (s) */
  private trennRestS = 0;
  /** Taktgeber fuer die Funken */
  private funkenRestS = 0;
  /**
   * Ein Stueck ist fertig getrennt — das Spiel macht daraus die Fraktionen.
   *
   * Die Trennung selbst steht in `ItemManager.zerlege`; hier wird nur
   * gemeldet, dass die Arbeit getan ist. So kennt der Platzwart weder
   * Fraktionen noch Preise.
   */
  onTrennen: ((item: ScrapItem) => void) | null = null;
  /** Funken beim Flexen — Ort fuer Partikel und Klang. */
  onFunken: ((x: number, y: number, z: number) => void) | null = null;

  /**
   * Wo ein Behaelter gerade steht. Absetzcontainer lassen sich vom Bagger
   * verschieben; ohne diese Abfrage wuerfe Lambert weiter an die Stelle, an
   * der der Container beim Aufbau stand.
   */
  getMuldenOrt: ((id: string) => { x: number; z: number } | null) | null = null;

  /** Wo der Radlader steht, solange Lambert zu Fuss unterwegs ist. */
  private readonly maschinePos = new THREE.Vector3();
  /** Restliche Pausenzeit (s) */
  private pauseRestS = 0;
  /** Zeit seit der letzten Pause (s) — siehe PAUSE_ABSTAND_S */
  private seitPauseS = PAUSE_ABSTAND_S;
  /** Wann er das naechste Mal nach Arbeit sieht (s) */
  private naechstePruefung = 0;
  /** Zeit seit der letzten Arbeitssuche (s) */
  private pruefUhr = 0;
  /** Restliche Zeit, in der er zurueckstoesst (s) */
  private rueckwaertsS = 0;
  /** Fuer das Debug-Overlay: von ihm aufgeweckte Koerper je Minute */
  private weckSpur: number[] = [];
  private schlafendeHandles = new Set<number>();
  private weckUhr = 0;
  /** Blickrichtung des abgestellten Radladers */
  private loaderYaw = 0;

  /** Radlader vorhanden? Wird vom Upgrade-System gesetzt. */
  private _hasLoader = false;
  private loader: WheelLoader | null = null;

  get hasLoader(): boolean {
    return this._hasLoader;
  }

  /**
   * Radlader freischalten. Von da an fährt Lambert statt zu laufen und kann
   * auch schwere Brocken von den Fahrspuren räumen.
   *
   * Steht `RADLADER_IN_BETRIEB` auf false, wird er trotzdem gebaut und
   * gezeigt — nur eben abgestellt in der Halle, und Lambert bleibt zu Fuß.
   */
  setLoader(on: boolean): void {
    if (on && !RADLADER_IN_BETRIEB) {
      /*
       * Ausser Betrieb (Ansage 12.09.2026: "koennen wir den Radlader ausser
       * Funktion setzen fuer den Moment und in der Halle parken?").
       *
       * `_hasLoader` bleibt false — daran haengt die ganze Entscheidung, ob
       * Lambert faehrt oder laeuft, ob er schwere Brocken raeumt und ob er
       * zur Maschine zurueckgeht. So ist der Radlader mit einem Wert
       * vollstaendig aus dem Spiel, ohne dass an seiner Logik etwas
       * auseinandergenommen wird.
       *
       * Sichtbar bleibt er: Ein Hof, auf dem die Maschine verschwunden ist,
       * sieht falsch aus. Er steht vorne in der ersten Halle, Schaufel zum
       * Tor.
       */
      this._hasLoader = false;
      this.loader?.setVisible(true);
      this.maschinePos.copy(RADLADER_PARKPLATZ);
      this.loaderYaw = RADLADER_PARKYAW;
      // dt von 1 s, damit er die Parkstellung sofort einnimmt statt sie
      // ueber die naechsten Bilder anzufahren
      this.loader?.update(1, RADLADER_PARKPLATZ, RADLADER_PARKYAW, false);
      this.zeigeRichtige();
      return;
    }
    this._hasLoader = on;
    this.loader?.setVisible(on);
    if (on) this.maschinePos.copy(this.lambert.group.position);
    this.zeigeRichtige();
  }

  /**
   * Zu Fuss oder auf der Maschine — nie beides. Steigt er aus, bleibt der
   * Radlader stehen, wo er ihn abgestellt hat.
   */
  private zeigeRichtige(): void {
    this.lambert.group.visible = !this.faehrt;
  }
  /** Karossen — durch die läuft er nicht hindurch */
  getObstaclePositions: (() => THREE.Vector3[]) | null = null;
  /**
   * Standflächen der Fahrzeuge. Weder zu Fuss noch mit dem Radlader geht es
   * durch einen stehenden LKW hindurch (Befund 11.09.2026).
   */
  getVehicleBoxes: (() => Box[]) | null = null;

  /**
   * @param weighPos Mitte der Wiegeplatte — dorthin geht Mario zur Kontrolle
   * @param kaffeePos Standplatz von Janines Kaffeewagen
   * @param bueroTuer Tür des Betriebsgebäudes — Marios Kommen und Gehen
   */
  constructor(
    scene: THREE.Scene,
    private items: ItemManager,
    weighPos: THREE.Vector3,
    kaffeePos: THREE.Vector3,
    bueroTuer: THREE.Vector3
  ) {
    /*
     * Mario arbeitet im Büro und kommt nur heraus, wenn ein LKW auf der Waage
     * steht (Wunsch 11.09.2026). Dann geht er an die Platte, sieht sich die
     * Ladung an und verschwindet wieder. Vorher stand er den ganzen Tag im
     * Freien neben der Waage — niemand macht das.
     */
    this.mario = buildPerson({ shirt: 0x2f5c8a, trousers: 0x2b2f33, hair: 0x39312b });
    this.bueroTuer.copy(bueroTuer);
    // Kontrollplatz: Westseite der Platte, also die Bueroseite — so laeuft er
    // nicht durch die Spur, in der der LKW gerade steht.
    this.pruefPos.set(weighPos.x - 3.2, 0, weighPos.z);
    this.mario.group.position.copy(bueroTuer);
    this.mario.group.visible = false;
    scene.add(this.mario.group);
    const brett = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.02, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xb98a4a, roughness: 0.9 })
    );
    brett.position.set(0.16, 1.05, 0.18);
    brett.rotation.z = 0.35;
    this.mario.group.add(brett);

    // Janine verkauft aus einem Kaffeewagen — kein Klapptisch mehr
    const wagen = buildKaffeewagen(scene, kaffeePos, KAFFEE_ROT);
    const janine = buildPerson({ shirt: 0xe8e2d5, trousers: 0x4a3b52, hair: 0x8a5a2b });
    /*
     * Janine haengt im Wagen, nicht daneben: Vorher stand sie in Weltkoordinaten
     * hinter der Aussenwand und war schlicht nicht zu sehen (Befund
     * 11.09.2026). Als Kind des Wagens dreht sie mit ihm mit, und der Platz
     * gilt im Wageninneren — direkt an der Klappe, Oberkoerper ueber der Theke.
     */
    janine.group.position.set(0.45, 0.55, 0);
    janine.group.rotation.y = Math.PI / 2; // schaut aus der Klappe heraus
    janine.legLeft.visible = false; // steht hinter der Theke
    janine.legRight.visible = false;
    wagen.add(janine.group);

    // Lambert Prison — Platzwart in Warnweste
    this.lambert = buildPerson({ shirt: 0xf2c018, trousers: 0x2f3a45, hair: 0x5a4632 });
    this.loader = new WheelLoader(scene);
    /*
     * Er faengt auf dem Ostposten an, nicht auf dem alten Patrouillenposten
     * mitten auf dem Platz. Von dort aus faehrt er los, wenn man ihn ruft —
     * und die Strecke zu den Sortierboxen ist frei, waehrend der Weg quer
     * ueber die Annahmeflaeche regelmaessig durch abgekippten Schrott
     * versperrt ist (gemessen: er kam nicht los).
     */
    this.lambert.group.position.copy(RAEUMT_AUF ? this.patrol[0] : OSTPOSTEN);
    scene.add(this.lambert.group);
    const vest = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.36, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xf2f26a, roughness: 0.7, emissive: 0x2a2a05 })
    );
    vest.position.set(0, 1.08, 0);
    this.lambert.group.add(vest);
    this.lambertTarget.copy(RAEUMT_AUF ? this.patrol[1] : OSTPOSTEN);
  }

  /*
   * Keine Namensschilder mehr ueber den Leuten.
   *
   * Ansage 13.09.2026: „wir koennen auch alle Schilder zur Benennung
   * wegmachen. Die einzigen Schilder, so wie's jetzt ist, sind diese kleinen
   * Containerschilder." MARIO, JANINE und LAMBERT schwebten als gelbe Tafeln
   * ueber den Koepfen — auch das ist Benennung. Wer wer ist, liest man an der
   * Weste, am Radlader und am Standort.
   */

  /**
   * @param truck Position des aktiven Fahrzeugs, wenn es gerade rangiert/ablädt
   */
  update(dt: number, truck: THREE.Vector3 | null): void {
    this.stateT += dt;
    this.seitPauseS += dt;
    this.pruefUhr += dt;
    const g = this.lambert.group;
    this.zaehleGeweckte(dt);

    // --- Werkzeugarbeit: er steht am Stueck und flext ---
    if (this.lambertState === "trennt") {
      const it = this.items.items.find((i) => i.id === this.carriedItemId);
      if (!it || !it.body.isValid() || !it.body.isDynamic()) {
        // Weggeraeumt, waehrend er daran arbeitete — dann eben nicht.
        this.giveUpTarget();
        return;
      }
      this.trennRestS -= dt;
      // Arm auf und ab, damit man die Arbeit sieht
      this.lambert.armRight.rotation.x = -0.9 + Math.sin(this.stateT * 9) * 0.35;
      this.funkenRestS -= dt;
      if (this.funkenRestS <= 0) {
        this.funkenRestS = FUNKEN_TAKT;
        const p = it.body.translation();
        this.onFunken?.(p.x, p.y + 0.25, p.z);
      }
      if (this.trennRestS <= 0) {
        this.lambert.armRight.rotation.x = 0;
        this.onTrennen?.(it);
        this.carriedItemId = null;
        this.lambertState = "patrol";
        this.lambertTarget.copy(this.patrol[this.patrolIdx]);
      }
      this.loader?.update(dt, this.maschinePos, this.loaderYaw, false);
      return;
    }

    // --- Kaffeepause ---
    if (this.lambertState === "kaffee") {
      // Kommt ein LKW, trinkt er aus: Rest halbiert, hoechstens 15 Sekunden.
      if (truck && this.pauseRestS > PAUSE_KURZ_MAX_S) {
        this.pauseRestS = Math.min(this.pauseRestS / 2, PAUSE_KURZ_MAX_S);
      }
      this.pauseRestS -= dt;
      if (this.pauseRestS <= 0) {
        this.lambert.armRight.rotation.x = 0;
        // Gemaechlich zurueck zur Maschine — oder gleich weiterarbeiten
        this.lambertState = this.hasLoader ? "zurueckZurMaschine" : "patrol";
        this.lambertTarget.copy(this.hasLoader ? this.maschinePos : this.patrol[this.patrolIdx]);
      }
      this.loader?.update(dt, this.maschinePos, this.loaderYaw, false);
      return; // waehrend der Pause keine Wegpruefungen
    }

    // Zuruecksetzen laeuft vor allem anderen ab
    if (this.rueckwaertsS > 0) {
      this.rueckwaertsS -= dt;
      const tempo = (this.faehrt ? LOADER_SPEED : 2.2) * 0.6;
      const rueck = this.avoidTmp.set(-Math.sin(g.rotation.y), 0, -Math.cos(g.rotation.y));
      const vorher = { x: g.position.x, z: g.position.z };
      g.position.addScaledVector(rueck, tempo * dt);
      if (hitsObstacle(g.position.x, g.position.z, 0.35)) {
        g.position.x = vorher.x;
        g.position.z = vorher.z;
        this.rueckwaertsS = 0;
      }
      this.loader?.update(dt, this.faehrt ? g.position : this.maschinePos, this.loaderYaw, true);
      this.lambertTarget.copy(g.position);
      return;
    }

    // Einweisen hat Vorrang: sobald ein LKW auf dem Platz rangiert. Was er
    // gerade in der Schaufel hat oder vor sich herschiebt, laesst er dafuer
    // aber nicht mitten auf dem Platz stehen.
    /*
     * Einweisen gehoert zum Aufraeumen „bei uns" und faellt mit ihm weg
     * (Ansage 13.09.2026). Es stand hier an der schaerfsten Stelle: Der Block
     * ueberschreibt JEDES Ziel, sobald ein LKW auf dem Platz ist. Gemessen
     * blieb Lambert dadurch auf seinem Posten stehen, obwohl er gerufen war
     * und ein Ziel hatte — jedes Bild setzte ihn zurueck auf „guide".
     */
    const gebunden =
      !RAEUMT_AUF || this.lambertState === "carry" || this.lambertState === "shoving";
    if (truck && !gebunden) {
      if (this.lambertState !== "guide") {
        this.lambertState = "guide";
        this.stateT = 0;
      }
      this.lambertTarget.copy(this.guidePos);
    } else if (this.lambertState === "guide") {
      this.lambertState = "patrol";
      this.stateT = 0;
      this.lambertTarget.copy(this.patrol[this.patrolIdx]);
    }

    /*
     * VORFAHRT FUER DEN LKW (Auftrag 17.09.2026: „Er darf nicht im Weg
     * stehen").
     *
     * Der Platz ist einspurig (E-029), und die Zufahrt laeuft quer ueber den
     * Hof: von (−27,5 | 22,5) diagonal bis (6,3 | −17,5). Genau dort liegt
     * auch der Abfall, den er einsammeln soll — gemessen verbringt er beim
     * Aufraeumen 13,2 % der Zeit innerhalb einer LKW-Breite davon, im Tiefsten
     * mit 0,00 m Abstand mitten drauf.
     *
     * Blockieren kann er niemanden: Lambert hat keinen Kollider, die
     * Fahrzeugverwaltung fragt ihn nirgends ab (gemessen: kein einziger Verweis
     * auf ihn in `delivery/vehicles.ts`). Ein LKW faehrt also durch ihn
     * HINDURCH — und genau das sieht falsch aus.
     *
     * Deshalb die einfachste Regel, die ein Platzwart auch haette: Sobald ein
     * Fahrzeug rangiert, unterbricht er das Aufraeumen und faehrt an den Rand.
     * Was er schon in der Schaufel hat oder vor sich herschiebt, bringt er
     * vorher zu Ende — es mitten auf dem Hof fallen zu lassen waere schlimmer.
     * Der RUF (Taste Y) ist davon unberuehrt: Wer ruft, will ihn jetzt.
     */
    this.rangiert = truck !== null;
    if (
      SELBST_AUFRAEUMEN &&
      !RAEUMT_AUF &&
      !this.gerufen &&
      this.rangiert &&
      this.aufraeumLauf !== null &&
      this.lambertState !== "carry" &&
      this.lambertState !== "shoving"
    ) {
      // Still abbrechen: Er ist nicht fertig, er macht Platz.
      this.aufraeumLauf = null;
      this.carriedItemId = null;
      this.lastAufgenommen = false;
      this.zielMulde = null;
      this.lambertState = "patrol";
      this.lambertTarget.copy(OSTPOSTEN);
    }

    // Ziel erreicht?
    const toTarget = this.lambertTarget.clone().sub(g.position);
    toTarget.y = 0;
    const dist = toTarget.length();
    const walking = dist > 0.4;

    if (walking) {
      toTarget.normalize();
      // Ausweichen: nicht in den Schwenkbereich des Baggers und nicht durch
      // Karossen hindurch — im Zweifel seitlich am Hindernis vorbei
      const step = this.avoid(g.position, toTarget);
      // zügiges Arbeitstempo: die Wege um den Schwenkbereich herum sind lang,
      // bei Schlendertempo käme er kaum hinterher
      const vorher = { x: g.position.x, z: g.position.z };
      // Mit dem Radlader ist er deutlich schneller unterwegs als zu Fuß
      const tempo = (this.hasLoader ? LOADER_SPEED : 2.2) * (this.getSpeedBonus?.() ?? 1);
      g.position.addScaledVector(step, tempo * dt);
      // Sicherheitsnetz: landet der Schritt trotz Ausweichen in einem
      // Bauwerk, wird er verworfen — Lambert läuft durch nichts hindurch
      const fahrzeug = this.getVehicleBoxes?.();
      const steckt =
        fahrzeug && findeBox(g.position.x, g.position.z, fahrzeug, this.eigenRadius);
      if (hitsObstacle(g.position.x, g.position.z, 0.35) || steckt) {
        /*
         * Zurueck auf den alten Platz — es sei denn, der war auch schon
         * belegt. Dann steckt er fest und wuerde ewig stehen bleiben: Genau
         * das war zu sehen, als ein LKW ueber ihm parkte und er 92 Prozent
         * der Zeit reglos in der Abladestelle stand (Messung 11.09.2026).
         * In dem Fall setzt er zurueck, wie es ein Fahrer auch taete.
         */
        const vorherSteckt =
          fahrzeug && findeBox(vorher.x, vorher.z, fahrzeug, this.eigenRadius);
        if (steckt && vorherSteckt) {
          ausBox(vorher.x, vorher.z, vorherSteckt, this.slideTmp);
          g.position.x = vorher.x + this.slideTmp.x * tempo * dt;
          g.position.z = vorher.z + this.slideTmp.z * tempo * dt;
          this.setzeZurueck();
        } else {
          g.position.x = vorher.x;
          g.position.z = vorher.z;
        }
      }
      g.rotation.y = Math.atan2(step.x, step.z);
      this.walkPhase += dt * 7;
      if (this.faehrt) {
        this.loaderYaw = g.rotation.y;
        this.loader?.update(dt, g.position, g.rotation.y, true);
      } else {
        this.loader?.update(dt, this.maschinePos, this.loaderYaw, false);
      }
      // Festgefahren? Wenn das Ausweichen ihn im Kreis schickt, kommt er dem
      // Ziel nicht näher — dann lieber aufgeben als endlos am Hindernis kleben.
      this.stuckT += dt;
      if (dist < this.bestDist - 0.3) {
        this.bestDist = dist;
        this.stuckT = 0;
      } else if (this.stuckT > 5) {
        this.giveUpTarget();
      }
    } else {
      this.walkPhase = 0;
      this.loader?.update(dt, this.faehrt ? g.position : this.maschinePos, this.loaderYaw, false);
      this.resetStuck();
      this.onArrived();
    }

    // Beine pendeln beim Laufen
    const swing = walking ? Math.sin(this.walkPhase) * 0.5 : 0;
    this.lambert.legLeft.rotation.x = swing;
    this.lambert.legRight.rotation.x = -swing;

    // Arme: winken beim Einweisen, sonst mitschwingen
    if (this.lambertState === "guide" && !walking) {
      this.waveT += dt * 6;
      this.lambert.armLeft.rotation.x = -2.1 + Math.sin(this.waveT) * 0.5;
      this.lambert.armRight.rotation.x = -2.1 - Math.sin(this.waveT) * 0.5;
      if (truck) {
        const look = truck.clone().sub(g.position);
        g.rotation.y = Math.atan2(look.x, look.z);
      }
    } else if (this.lambertState === "carry") {
      this.lambert.armLeft.rotation.x = -1.5;
      this.lambert.armRight.rotation.x = -1.5;
    } else {
      this.lambert.armLeft.rotation.x = -swing * 0.6;
      this.lambert.armRight.rotation.x = swing * 0.6;
    }

    // Schaufelstellung: gesenkt zum Aufnehmen und Schieben, gehoben zum Fahren
    if (this.hasLoader) {
      this.loader?.setLift(this.lambertState === "carry");
    }

    this.fuehreLast(g);
    this.updateMario(dt);
  }

  /**
   * Mario zwischen Büro und Waage.
   *
   *   innen    unsichtbar im Gebäude — sein Normalzustand
   *   raus     unterwegs zur Platte, sobald dort ein LKW steht
   *   pruefen  steht an der Ladung und sieht sie durch
   *   zurueck  geht wieder hinein
   *
   * Gerufen wird er von der Fahrzeugverwaltung: bei der Einfahrtswiegung
   * immer, bei der Ausfahrt nur für Abholer — die fahren voll vom Hof, und
   * was rausgeht, sieht er sich an (Wunsch 11.09.2026).
   */
  private updateMario(dt: number): void {
    const m = this.mario.group;
    const lkw = this.getWeighTruck?.() ?? null;
    this.marioT += dt;

    switch (this.marioState) {
      case "innen":
        if (lkw) {
          this.marioState = "raus";
          this.marioT = 0;
          m.visible = true;
          m.position.copy(this.bueroTuer);
        }
        break;
      case "raus":
        if (this.geheZu(m, this.pruefPos, dt)) {
          this.marioState = "pruefen";
          this.marioT = 0;
        }
        // Laeuft der LKW weg, bevor er da ist, dreht er wieder um
        if (!lkw && this.marioT > 1.5) {
          this.marioState = "zurueck";
          this.marioT = 0;
        }
        break;
      case "pruefen": {
        // Zur Ladung schauen und das Klemmbrett halten
        const ziel = lkw ?? this.pruefPos;
        const dx = ziel.x - m.position.x;
        const dz = ziel.z - m.position.z;
        if (Math.hypot(dx, dz) > 0.2) m.rotation.y = Math.atan2(dx, dz);
        this.mario.armLeft.rotation.x = -1.15;
        this.mario.armRight.rotation.x = -1.25;
        // Fertig, wenn der LKW weg ist — oder nach einer halben Minute, damit
        // er nicht draussen stehen bleibt, falls das Signal haengt
        if (!lkw || this.marioT > 30) {
          this.marioState = "zurueck";
          this.marioT = 0;
          this.mario.armLeft.rotation.x = 0;
          this.mario.armRight.rotation.x = 0;
        }
        break;
      }
      case "zurueck":
        // Kommt der naechste, dreht er auf dem Absatz um
        if (lkw) {
          this.marioState = "raus";
          this.marioT = 0;
          break;
        }
        if (this.geheZu(m, this.bueroTuer, dt)) {
          this.marioState = "innen";
          this.marioT = 0;
          m.visible = false;
        }
        break;
    }
  }

  /**
   * Einen Schritt Richtung Ziel gehen. Liefert true, sobald er da ist.
   * Bewusst ohne Ausweichlogik: Sein Weg führt über den freien Vorplatz.
   */
  private geheZu(m: THREE.Object3D, ziel: THREE.Vector3, dt: number): boolean {
    const dx = ziel.x - m.position.x;
    const dz = ziel.z - m.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.3) {
      this.mario.legLeft.rotation.x = 0;
      this.mario.legRight.rotation.x = 0;
      return true;
    }
    const schritt = Math.min(MARIO_TEMPO * dt, d);
    m.position.x += (dx / d) * schritt;
    m.position.z += (dz / d) * schritt;
    m.rotation.y = Math.atan2(dx, dz);
    this.marioPhase += dt * 7;
    const swing = Math.sin(this.marioPhase) * 0.5;
    this.mario.legLeft.rotation.x = swing;
    this.mario.legRight.rotation.x = -swing;
    this.mario.armLeft.rotation.x = -swing * 0.6;
    this.mario.armRight.rotation.x = swing * 0.6;
    return false;
  }

  /**
   * Was Lambert gerade bewegt, mit ihm mitfuehren.
   *
   * Zu Fuss traegt er es vor der Brust. Mit dem Radlader liegt es in der
   * Schaufel — und beim Schieben eben davor am Boden: Ein Radlader hebt einen
   * Traeger nicht auf Brusthoehe, er schiebt ihn ueber den Beton.
   */
  private fuehreLast(g: THREE.Object3D): void {
    if (!this.carriedItemId || !this.lastAufgenommen) return;
    const it = this.items.items.find((i) => i.id === this.carriedItemId);
    if (!it || !it.body.isValid()) {
      this.carriedItemId = null;
      this.lastAufgenommen = false;
      return;
    }
    let ziel: THREE.Vector3;
    if (this.hasLoader && this.loader) {
      ziel = this.loader.bucketPosition(this.lastTmp);
      if (this.lambertState === "shoving") {
        // vor der Schneide, am Boden — nicht in der Schaufel
        ziel.set(
          g.position.x + Math.sin(g.rotation.y) * SCHIEB_VORLAUF,
          0.35,
          g.position.z + Math.cos(g.rotation.y) * SCHIEB_VORLAUF
        );
      }
    } else {
      ziel = this.lastTmp.set(g.position.x, 1.15, g.position.z + 0.35);
    }
    it.body.setTranslation({ x: ziel.x, y: ziel.y, z: ziel.z }, true);
    it.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  private lastTmp = new THREE.Vector3();
  /**
   * Erst ab dem Moment, in dem er beim Teil steht, nimmt er es mit. Ohne das
   * sprang es ihm quer ueber den Platz entgegen, sobald er es sich vorgenommen
   * hatte — beim Schieben faellt so etwas sofort auf.
   */
  private lastAufgenommen = false;

  private stuckT = 0;
  private bestDist = Infinity;

  private resetStuck(): void {
    this.stuckT = 0;
    this.bestDist = Infinity;
  }

  /**
   * Ziel aufgeben und weiterziehen. Ein aufgesammeltes Teil legt er dabei ab,
   * sonst würde er es ewig mit sich herumtragen.
   */
  private giveUpTarget(): void {
    this.resetStuck();
    this.zwischenhalt = false;
    this.carriedItemId = null;
    this.lastAufgenommen = false;
    this.lambertState = "patrol";
    this.patrolIdx = (this.patrolIdx + 1) % this.patrol.length;
    this.lambertTarget.copy(this.patrol[this.patrolIdx]);
  }

  /** Reaktion beim Erreichen des Ziels — je nach Aufgabe. */
  private onArrived(): void {
    if (this.lambertState === "guide") return;

    if (this.lambertState === "shove") {
      // Hinter dem Teil angekommen: aufnehmen und in Richtung Bagger schieben
      const it = this.items.items.find((i) => i.id === this.carriedItemId);
      const ex = this.getExcavatorPos?.();
      if (it && it.body.isValid() && ex) {
        const p = it.body.translation();
        /*
         * Zum Fleck, der beim Annehmen der Arbeit gefunden wurde. Ohne ihn
         * (alte Rangfolge, kein Fleck gemerkt) wie bisher auf die Gerade.
         */
        const [zx, zz] = this.schiebeFleck
          ? haltFuerZiel(p.x, p.z, this.schiebeFleck[0], this.schiebeFleck[1])
          : schiebeZiel(p.x, p.z, ex.x, ex.z);
        this.lambertState = "shoving";
        this.lastAufgenommen = true;
        this.lambertTarget.set(zx, 0, zz);
      } else {
        this.carriedItemId = null;
        this.lastAufgenommen = false;
        this.lambertState = "patrol";
      }
      return;
    }
    if (this.lambertState === "shoving") {
      // Abgeliefert: Teil liegt jetzt im Arbeitsbereich des Baggers
      const it = this.items.items.find((i) => i.id === this.carriedItemId);
      if (it && it.body.isValid()) {
        it.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        it.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
      this.carriedItemId = null;
      this.lastAufgenommen = false;
      this.lambertState = "patrol";
      // Ein Stueck zuruecksetzen, sonst steht er dem Bagger im Schwenkbereich
      this.patrolIdx = (this.patrolIdx + 1) % this.patrol.length;
      this.lambertTarget.copy(this.ruhepunkt);
      return;
    }
    if (this.lambertState === "werkzeug") {
      const it = this.items.items.find((i) => i.id === this.carriedItemId);
      if (it && it.body.isValid() && this.items.brauchtWerkzeug(it)) {
        this.lambertState = "trennt";
        this.trennRestS = WERKZEUG_S;
        this.funkenRestS = 0;
      } else {
        this.giveUpTarget();
      }
      return;
    }
    if (this.lambertState === "fetch") {
      /*
       * Erst vor die Mulde, dann hinein.
       *
       * Eine Sortiermulde hat drei Waende, und die Gerade vom Posten zu einem
       * Stueck darin fuehrt quer durch die Flanke der Nachbarmulde. Gemessen
       * blieb Lambert dort haengen und gab nach fuenf Sekunden auf — sechsmal
       * hintereinander, die Box blieb voll. Deshalb ist die offene Seite ein
       * Zwischenhalt: Von dort geht es geradeaus hinein.
       */
      if (this.zwischenhalt) {
        this.zwischenhalt = false;
        const ziel = this.items.items.find((i) => i.id === this.carriedItemId);
        if (ziel && ziel.body.isValid()) {
          const p = ziel.body.translation();
          this.lambertTarget.set(p.x, 0, p.z);
          this.resetStuck();
          return;
        }
      }
      // Aufgenommen — jetzt zur Box, in die das Material gehört
      const it = this.items.items.find((i) => i.id === this.carriedItemId);
      if (it) {
        // Beim Abfall steht das Ziel schon fest (`zielMulde`) — es gibt zwei,
        // und die Wahl ist beim Annehmen der Arbeit gefallen.
        const mulde = this.zielMulde ?? StaffManager.muldeFuer(it.materialId);
        if (mulde) {
          this.lambertState = "carry";
          this.lastAufgenommen = true;
          // vor der Mulde stehen bleiben, nicht mitten hinein fahren
          const [ax, az] = StaffManager.anlieferPunkt(mulde);
          this.lambertTarget.set(ax, 0, az);
        } else {
          this.carriedItemId = null;
          this.lastAufgenommen = false;
          this.lambertState = "patrol";
        }
      } else {
        this.carriedItemId = null;
        this.lastAufgenommen = false;
        this.lambertState = "patrol";
      }
      return;
    }
    if (this.lambertState === "carry") {
      // In die Box legen: Lambert wirft es über die Wand hinein
      const it = this.items.items.find((i) => i.id === this.carriedItemId);
      if (it && it.body.isValid()) {
        const mulde = this.zielMulde ?? StaffManager.muldeFuer(it.materialId);
        if (mulde) {
          /*
           * ÜBER die Kante fallen lassen, nicht hinein.
           *
           * Vorher lag die Absetzhoehe bei `size[2] − 0,6`. Bei einem
           * Absetzcontainer mit 1,1 m Wand sind das 0,5 m — also mitten im
           * Boden des Behaelters. Rapier drueckt die Durchdringung mit voller
           * Wucht auseinander, und weil der Container ein beweglicher Koerper
           * ist, schoss er quer ueber den Platz (Befund 12.09.2026: „der
           * Radlader verschiebt jetzt immer wieder Container").
           *
           * Und an die Stelle, an der der Behaelter JETZT steht, nicht an die
           * aus der Aufbauliste — er laesst sich ja verschieben.
           */
          const ort = this.getMuldenOrt?.(mulde.id) ?? { x: mulde.x, z: mulde.z };
          const streu = Math.min(1.2, mulde.size[0] - 1.4);
          it.body.setTranslation(
            {
              x: ort.x + (Math.random() - 0.5) * streu,
              y: mulde.size[2] + 0.9,
              z: ort.z + (Math.random() - 0.5) * streu,
            },
            true
          );
          it.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
          it.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        }
      }
      this.carriedItemId = null;
      this.lastAufgenommen = false;
      const warAbfall = this.aufraeumLauf === "abfall";
      this.zielMulde = null;
      this.lambertState = "patrol";
      /*
       * Beim Aufraeumen NICHT erst zum Ostposten zurueck.
       *
       * Der Posten ist der Warteplatz fuer den Ruf; auf dem Weg dorthin steht
       * er gemessen 9,0 m Umweg je Stueck (Silo −20,8 | −25,0 → Posten
       * −15,0 | −18,0). Wer eine Fuhre abgeladen hat, dreht sich um und holt
       * die naechste. Er bleibt deshalb stehen, wo er ist, und sucht im
       * naechsten Bild weiter; ist nichts mehr da, faehrt er von dort aus auf
       * den Posten.
       *
       * Fuer die gerufene Boxarbeit bleibt es beim Alten — daran haengen die
       * Waechter aus `test/lambert.test.ts`.
       */
      if (warAbfall) {
        this.lambertTarget.copy(this.lambert.group.position);
        this.pruefUhr = this.naechstePruefung;
      } else {
        this.lambertTarget.copy(this.ruhepunkt);
      }
      return;
    }

    if (this.lambertState === "zurBude") {
      // An der Theke angekommen: Kaffee, und in der Zeit keine Wegpruefungen
      this.lambertState = "kaffee";
      this.pauseRestS =
        PAUSE_DAUER_S[0] + Math.random() * (PAUSE_DAUER_S[1] - PAUSE_DAUER_S[0]);
      this.lambert.armRight.rotation.x = -1.3;
      const zx = KAFFEE_THEKE.x - this.lambert.group.position.x;
      const zz = KAFFEE_THEKE.z + 1.2 - this.lambert.group.position.z;
      this.lambert.group.rotation.y = Math.atan2(zx, zz);
      return;
    }
    if (this.lambertState === "kaffee") return; // wird in update() abgezaehlt
    if (this.lambertState === "zurueckZurMaschine") {
      // Wieder aufgestiegen
      this.zuFuss = false;
      this.zeigeRichtige();
      this.lambertState = "patrol";
      this.naechstePruefung = 0;
      return;
    }

    // Nichts zu tun: In festem Takt nach Arbeit sehen, nicht jedes Bild.
    // Die Uhr laeuft in update() mit; hier wird nur abgelesen.
    if (this.pruefUhr < this.naechstePruefung) return;
    this.pruefUhr = 0;
    this.stateT = 0;
    this.naechstePruefung =
      PRUEF_INTERVALL_S[0] + Math.random() * (PRUEF_INTERVALL_S[1] - PRUEF_INTERVALL_S[0]);
    this.waehleAufgabe();
  }

  /**
   * Rangfolge seiner Arbeit (Auftrag 11.09.2026, Phase 0.2):
   *
   *   1. erreichbare Radlader-Arbeit
   *   2. sonst aussteigen und Kleinteile von Hand sortieren
   *   3. sonst Kaffeepause bei Janine
   *   4. sonst warten und gleich wieder nachsehen
   *
   * "Erreichbar" heisst: Der Fahrweg ist frei (siehe world/weg.ts). Vorher
   * fuhr er auf das naechstgelegene Teil zu, egal was dazwischen lag — und
   * pfluegte dabei durch den Haufen.
   */
  private waehleAufgabe(): void {
    const hol = (it: (typeof this.items.items)[number]): void => {
      this.carriedItemId = it.id;
      const p = it.body.translation();
      this.lambertTarget.set(p.x, 0, p.z);
      this.lambertState = "fetch";
    };
    /*
     * Auf Befehl, nicht von sich aus. Die alte Rangfolge steht unveraendert
     * darunter und laeuft wieder, sobald `RAEUMT_AUF` auf true steht.
     */
    if (!RAEUMT_AUF) {
      if (!this.gerufen) {
        /*
         * OHNE RUF: die zwei Aufgaben aus Patricks Geraetetest, in dieser
         * Reihenfolge (siehe `SELBST_AUFRAEUMEN`).
         *
         *   1. Abfall wegraeumen, solange in der Mulde Platz ist
         *   2. sonst Schrott von der Bueroseite an den Bagger schieben
         *   3. sonst warten — nicht patrouillieren, nicht Kaffee holen
         */
        if (SELBST_AUFRAEUMEN && this.faehrt && !this.rangiert) {
          const abfall = this.findAbfall();
          if (abfall) {
            this.vollGemeldet = false;
            this.setzeLauf("abfall");
            this.zielMulde = abfall.mulde;
            hol(abfall.it);
            return;
          }
          /*
           * Kein Ziel — lag es am Fuellstand? Dann einmal durchgeben und
           * danach schweigen, bis wieder Platz ist. Sonst funkt er es bei
           * jeder Arbeitssuche neu, also alle drei bis fuenf Sekunden.
           */
          if (this.abfallOhnePlatz && !this.vollGemeldet) {
            this.vollGemeldet = true;
            this.funk("muldeVoll");
          }
          const weit = this.findSchiebegut();
          if (weit && this.schiebeFleck) {
            const p = weit.body.translation();
            const [ax, az] = anstellFuerZiel(
              p.x,
              p.z,
              this.schiebeFleck[0],
              this.schiebeFleck[1]
            );
            this.setzeLauf("schieben");
            this.zielMulde = null;
            this.carriedItemId = weit.id;
            this.lambertTarget.set(ax, 0, az);
            this.lambertState = "shove";
            return;
          }
        }
        this.setzeLauf(null);
        this.zielMulde = null;
        this.lambertTarget.copy(OSTPOSTEN);
        return;
      }
      /*
       * Der Ruf hat Vorrang. Der laufende Aufraeumauftrag endet damit still —
       * „Abfall ist weg" waere an dieser Stelle schlicht falsch: Er hoert auf,
       * weil er gerufen ist, nicht weil er fertig ist.
       */
      this.aufraeumLauf = null;
      this.zielMulde = null;
      const ausDerBox = this.findBoxTeil();
      if (ausDerBox) {
        hol(ausDerBox);
        const p = ausDerBox.body.translation();
        const box = CONFIGS.filter((c) => c.sortierbox === true).find((c) => {
          // In WELTachsen, nicht in Muldenachsen: `bayHalb` dreht mit, wenn
          // eine Mulde nach Norden zeigt. Sonst sucht Lambert das Stueck in
          // einem um 90 Grad verdrehten Rechteck.
          const { hw, hd } = bayHalb(c);
          return Math.abs(p.x - c.x) <= hw && Math.abs(p.z - c.z) <= hd;
        });
        if (box && box.kind === "bay") {
          const [ax, az] = StaffManager.anlieferPunkt(box);
          this.lambertTarget.set(ax, 0, az);
          this.zwischenhalt = true;
        }
        return;
      }
      /*
       * Nichts erreichbar. Liegt trotzdem noch etwas in den Boxen, bleibt er
       * gerufen und sieht gleich wieder nach — der Weg kann durch die Spinne
       * oder durch herumliegenden Schrott versperrt sein, und beides geht
       * vorbei. Erst wenn die Boxen wirklich leer sind, ist Feierabend.
       */
      if (!this.gibtEsBoxArbeit()) this.gerufen = false;
      this.lambertTarget.copy(OSTPOSTEN);
      return;
    }
    // Eine blockierte Fahrspur legt den Betrieb lahm und hat Vorrang. Danach
    // kommt, was der Bagger nicht erreicht — daran kommt sonst niemand heran,
    // waehrend Sortierteile nur liegenbleiben. Stuende das Sortieren davor,
    // wuerde nie geschoben: Es liegt immer noch irgendwo Buntmetall herum.
    const blocker = this.findBlocker();
    if (blocker) {
      hol(blocker);
      return;
    }
    /*
     * Werkzeugarbeit vor dem Sortieren: Ein Rad mit Alufelge bringt getrennt
     * 602 statt 160 Euro je Tonne, und niemand sonst auf dem Platz kann es
     * trennen — der Bagger wuerde die Felge zerdruecken. Nur eine blockierte
     * Fahrspur hat noch Vorrang, daran haengt der ganze Betrieb.
     */
    const werkzeug = this.findWerkzeugTeil();
    if (werkzeug) {
      const p = werkzeug.body.translation();
      this.carriedItemId = werkzeug.id;
      this.lambertTarget.set(p.x, 0, p.z);
      this.lambertState = "werkzeug";
      return;
    }
    const weit = this.findSchiebegut();
    if (weit && this.schiebeFleck) {
      const p = weit.body.translation();
      const [ax, az] = anstellFuerZiel(p.x, p.z, this.schiebeFleck[0], this.schiebeFleck[1]);
      this.carriedItemId = weit.id;
      this.lambertTarget.set(ax, 0, az);
      this.lambertState = "shove";
      return;
    }
    const stray = this.findStray();
    if (stray) {
      hol(stray);
      return;
    }
    /*
     * Mit der Maschine ist nichts zu erreichen? Dann aussteigen und von Hand
     * sortieren — zu Fuss ist der Korridor schmal, er steigt ja drueber.
     * Erst nachsehen, dann absteigen: Sonst stand er neben dem Radlader und
     * hatte trotzdem nichts zu tun (Befund beim Messen 11.09.2026).
     */
    if (this.faehrt) {
      this.zuFuss = true; // nur fuer die Suche
      const kleinteil = this.findStray();
      this.zuFuss = false;
      if (kleinteil) {
        this.steigeAb();
        hol(kleinteil);
        return;
      }
    }
    if (this.gehePause()) return;
    this.patrolIdx = (this.patrolIdx + 1) % this.patrol.length;
    this.lambertTarget.copy(this.patrol[this.patrolIdx]);
  }

  /**
   * Wie viele schlafende Koerper Lambert aufweckt (Auftrag 11.09.2026,
   * Phase 0.2: Debug-Overlay vorher/nachher).
   *
   * Gezaehlt wird, was in seiner Naehe von schlafend auf wach springt —
   * genau das kostet Rechenzeit, und genau das soll die Wegregel verhindern.
   * Gemessen wird viermal je Sekunde, das reicht fuer eine Rate je Minute.
   */
  private zaehleGeweckte(dt: number): void {
    this.weckUhr += dt;
    if (this.weckUhr < 0.25) return;
    this.weckUhr = 0;
    const p = this.lambert.group.position;
    let neu = 0;
    for (const it of this.items.items) {
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      const q = it.body.translation();
      const d = Math.max(Math.abs(q.x - p.x), Math.abs(q.z - p.z));
      // Im weiteren Umkreis merken, im engeren zaehlen: Sonst entgeht das
      // Aufwachen genau der Teile, auf die er gerade zufaehrt.
      if (d > WECK_MERK_RADIUS) continue;
      const h = it.body.handle;
      if (it.body.isSleeping()) {
        this.schlafendeHandles.add(h);
      } else if (this.schlafendeHandles.delete(h) && d <= WECK_RADIUS) {
        neu++;
      }
    }
    this.weckSpur.push(neu);
    // Ein Fenster von einer Minute: 240 Messungen a 0,25 s
    if (this.weckSpur.length > 240) this.weckSpur.shift();
  }

  /** Von Lambert aufgeweckte Koerper je Minute (gleitendes Fenster). */
  get geweckteProMinute(): number {
    if (this.weckSpur.length === 0) return 0;
    const summe = this.weckSpur.reduce((a, b) => a + b, 0);
    return (summe / this.weckSpur.length) * 240;
  }

  /** Was Lambert gerade tut — fuers Debug-Overlay. */
  get taetigkeit(): string {
    return `${this.lambertState}${this.zuFuss ? " (zu Fuss)" : ""}`;
  }

  /**
   * Flaechen, in die der Radlader nicht hineinfaehrt: Abkippplatz,
   * Stahlhaufen, Ballenlager. Er arbeitet an ihren Aussengrenzen — hinein
   * faehrt er nicht (Wunsch 11.09.2026). Die Mulden stehen ohnehin schon als
   * Hindernis in obstacles.ts.
   */
  private get sperrZonen(): Zone[] {
    if (this.zonenCache.length === 0) {
      for (const c of CONFIGS) {
        if (c.kind === "bay") continue; // hat Waende, steht in obstacles.ts
        this.zonenCache.push({ x: c.x, z: c.z, hw: c.size[0] / 2, hd: c.size[1] / 2 });
      }
      // Der Abkippplatz vor dem Bagger: dort faellt die Fuhre herunter
      this.zonenCache.push({ x: ABKIPP.x, z: ABKIPP.z, hw: ABKIPP.hw, hd: ABKIPP.hd });
    }
    return this.zonenCache;
  }
  private zonenCache: Zone[] = [];

  /**
   * Setzt zurueck, wie es ein Fahrer tut, wenn ihm etwas den Weg versperrt.
   * Danach sucht er sich eine neue Aufgabe, statt weiter dagegenzudruecken.
   */
  private setzeZurueck(): void {
    if (this.rueckwaertsS > 0) return;
    this.rueckwaertsS = RUECKWAERTS_S;
    this.carriedItemId = null;
    this.lastAufgenommen = false;
    this.lambertState = "patrol";
    this.naechstePruefung = RUECKWAERTS_S + 0.5;
    this.pruefUhr = 0;
  }

  /** Aus dem Radlader steigen; die Maschine bleibt stehen, wo sie steht. */
  private steigeAb(): void {
    if (!this.hasLoader || this.zuFuss) return;
    this.maschinePos.copy(this.lambert.group.position);
    this.zuFuss = true;
    this.zeigeRichtige();
  }

  /**
   * Kaffeepause, wenn nichts zu holen ist — aber nicht ununterbrochen:
   * zwischen zwei Pausen liegen mindestens drei Minuten.
   */
  private gehePause(): boolean {
    if (this.seitPauseS < PAUSE_ABSTAND_S) return false;
    this.steigeAb();
    this.seitPauseS = 0;
    this.lambertState = "zurBude";
    this.lambertTarget.set(KAFFEE_THEKE.x + (Math.random() - 0.5) * 2.0, 0, KAFFEE_THEKE.z - 0.6);
    return true;
  }

  /**
   * Messschalter: Mit `true` faehrt er wieder wie vorher, quer durch alles.
   * Der Auftrag verlangt einen Vorher-Nachher-Vergleich der aufgeweckten
   * Koerper (Phase 0.2) — dafuer muss sich das alte Verhalten herstellen
   * lassen, ohne den Code zurueckzubauen. Im Spiel bleibt der Schalter aus.
   */
  pfluegenErlaubt = false;

  /**
   * Ist der Weg von Lambert zu (x,z) frei? Mit der Maschine gilt die
   * Schaufelbreite, zu Fuss ein schmaler Korridor — ein Mensch steigt ueber
   * Kleinteile, ein Radlader schiebt sie vor sich her.
   */
  private wegIstFrei(zielX: number, zielZ: number, ausser?: { id: string }): boolean {
    if (this.pfluegenErlaubt) return true;
    const von = this.lambert.group.position;
    this.wegTeile.length = 0;
    let ausserTeil: WegTeil | undefined;
    for (const it of this.items.items) {
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      const p = it.body.translation();
      if (p.y > 1.6) continue;
      const eintrag: WegTeil = {
        x: p.x,
        z: p.z,
        r: it.shape ? umkugelRadius(it.shape) : 0.3,
        massKg: it.massKg,
        schlaeft: it.body.isSleeping(),
      };
      this.wegTeile.push(eintrag);
      if (ausser && it.id === ausser.id) ausserTeil = eintrag;
    }
    if (
      !wegFrei(
        von.x,
        von.z,
        zielX,
        zielZ,
        this.wegTeile,
        this.faehrt ? SCHAUFEL_BREITE : FUSS_BREITE,
        ausserTeil
      )
    ) {
      return false;
    }
    /*
     * Mit der Maschine nicht quer durch Abkippplatz oder Haufen: Dort liegt
     * die Arbeit des Baggers, und wer hindurchfaehrt, wuehlt alles auf. Die
     * Zone wird fuer die Pruefung um einen Meter geschrumpft — sonst kaeme er
     * an kein Teil am Rand heran, und genau dort soll er arbeiten.
     */
    if (this.faehrt) {
      for (const zone of this.sperrZonen) {
        if (streckeSchneidetZone(von.x, von.z, zielX, zielZ, zone, ZONE_RAND)) return false;
      }
    }
    // Und er holt nur, was frei liegt — nicht, was mitten im Haufen steckt.
    if (ausserTeil && nachbarn(zielX, zielZ, this.wegTeile, RAND_RADIUS, ausserTeil) >
      RAND_MAX_NACHBARN) {
      return false;
    }
    return true;
  }

  private wegTeile: WegTeil[] = [];

  /**
   * Schrott, an den der Bagger nicht herankommt.
   *
   * Der Wunsch dahinter (10.09.2026): "Der soll den Schrott, der nicht
   * erreichbar ist, zu mir schieben." Gesucht wird deshalb nach Gewicht und
   * Entfernung, nicht nach Material — was zu weit draussen liegt, blockiert
   * den Betrieb, egal was drinsteckt. Ganz kleine Teile bleiben aussen vor —
   * dafuer lohnt die Fahrt nicht.
   */
  private findSchiebegut(): (typeof this.items.items)[number] | null {
    if (!this.hasLoader) return null;
    const ex = this.getExcavatorPos?.();
    if (!ex) return null;
    const gr = this.getGrapplePos?.();
    const von = this.lambert.group.position;
    let best: (typeof this.items.items)[number] | null = null;
    let bestD = Infinity;
    for (const it of this.items.items) {
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      // Fuer eine Schraube faehrt niemand den Lader an
      if (it.massKg < SCHIEB_MIN_KG) continue;
      /*
       * Abfall wird NICHT geschoben.
       *
       * Er hat seinen eigenen Weg (in die Mulde), und wenn die voll ist,
       * gehoert er erst recht nicht vor den Bagger: Der Spieler kann ihn dann
       * nirgends hinlegen und haette den Muell mitten im Arbeitsbereich. Ohne
       * diese Zeile schob Lambert bei voller Mulde genau das dorthin
       * (gemessen im Waechter „laesst den Abfall liegen").
       */
      if (ABFALL.has(it.materialId)) continue;
      const p = it.body.translation();
      if (p.y > 1.4) continue;
      if (!brauchtSchieben(p.x, p.z, ex.x, ex.z)) continue;
      // Was in einer Mulde oder auf einer Ladeflaeche liegt, liegt richtig
      if (hitsObstacle(p.x, p.z, 0.4)) continue;
      // Und was auf einer Sortierflaeche liegt — vor allem im Stahlhaufen —
      // liegt ebenfalls richtig. Dessen Rand ist gut 9 m vom Bagger entfernt;
      // ohne diese Regel schob Lambert den Haufen endlos in sich zusammen
      // (gemessen 10.09.2026).
      if (StaffManager.inZone(p.x, p.z)) continue;
      /*
       * Nur auf dem Arbeitsteil des Platzes, nicht hinten bei den Gebaeuden.
       *
       * Der Streifen reicht seit dem 17.09.2026 bis an die Buerofront
       * (x −30,6) statt bis x −24 — genau der Bereich, den Patrick meint
       * („Schrott von der Bueroseite an den Bagger heranschieben"). Alles
       * andere ist unveraendert; die Silo-Reihe faellt weiter durch
       * `inZone` heraus, ihre Aussenkante liegt auf x −33,0.
       */
      if (p.z < BUEROSEITE.zMin || p.z > BUEROSEITE.zMax) continue;
      if (p.x < BUEROSEITE.xMin || p.x > BUEROSEITE.xMax) continue;
      if (gr && Math.hypot(p.x - gr.x, p.z - gr.z) < StaffManager.GRAPPLE_KEEPOUT) continue;
      /*
       * Wohin damit? Nicht stur auf die Gerade zum Bagger — dort stehen die
       * Sortiermulde und der Muellcontainer, und genau daran scheiterte das
       * Schieben von der Bueroseite (0 von 8, gemessen 17.09.2026). Gesucht
       * wird der naechste FREIE Fleck im Schwenkband (`ablagePlatz`).
       */
      const fleck = ablagePlatz(p.x, p.z, ex.x, ex.z, (fx, fz) =>
        this.ablageFrei(fx, fz)
      );
      if (!fleck) continue;
      const [zx, zz] = fleck;
      if (Math.hypot(zx - ex.x, zz - ex.z) < SCHIEB_MIN_M) continue;
      /*
       * Und er selbst bleibt DRAUSSEN: Sein Halteplatz liegt 2,80 m hinter
       * dem Stueck; der muss ausserhalb des Schwenkbands liegen, sonst steht
       * er dem Arm im Weg (Auftrag 17.09.2026).
       */
      const [hx, hz] = haltFuerZiel(p.x, p.z, zx, zz);
      if (Math.hypot(hx - ex.x, hz - ex.z) <= SCHWENK_AUSSEN) continue;
      const [ax, az] = anstellFuerZiel(p.x, p.z, zx, zz);
      if (!this.reachable(ax, az)) continue;
      // Nicht durch den Haufen pfluegen: Der Anstellpunkt muss anfahrbar sein
      if (this.faehrt && inZonen(ax, az, this.sperrZonen, ZONE_RAND)) continue;
      if (!this.wegIstFrei(ax, az, it)) continue;
      const d = Math.hypot(p.x - von.x, p.z - von.z);
      if (d < bestD) {
        bestD = d;
        best = it;
        this.schiebeFleck = [zx, zz];
      }
    }
    return best;
  }

  /**
   * Darf dort ein geschobener Brocken liegen bleiben?
   *
   * Drei Dinge zugleich: kein Bauwerk, keine Sortierflaeche und keine
   * Fahrspur. Das Letzte ist neu (17.09.2026) — vorher konnte ein Brocken
   * mitten auf der Zufahrt landen und war damit genau der Stoerfall, den
   * `delivery/laneWatch.ts` meldet. Der Rand ist die halbe Kantenlaenge eines
   * grossen Teils (0,8 m), damit auch das Stueck selbst neben der Spur liegt.
   */
  private ablageFrei(x: number, z: number): boolean {
    if (hitsObstacle(x, z, 0.8)) return false;
    if (StaffManager.inZone(x, z)) return false;
    if (aufFahrspur(x, z, 0.8)) return false;
    /*
     * Und nicht auf einen Brocken, der schon dort liegt.
     *
     * Ohne diese Zeile landet ALLES auf demselben Fleck: Gemessen ist vor dem
     * Bagger nur ein einziger Sektor frei (Peilung 0 Grad, rund (−0,4 |
     * −14,3)) — die uebrigen Peilungen sind Mulde, Muellcontainer oder
     * Fahrspur. Sieben geschobene Brocken lagen damit uebereinander.
     */
    for (const it of this.items.items) {
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      const q = it.body.translation();
      if (q.y > 1.4) continue;
      if (Math.hypot(q.x - x, q.z - z) < ABLAGE_LUECKE) return false;
    }
    return true;
  }

  /** Der Fleck, auf den der naechste Brocken geschoben wird. */
  private schiebeFleck: [number, number] | null = null;

  /**
   * Wohin gehört welche Fraktion? Direkt aus containers.ts gelesen.
   *
   * Vorher standen die Koordinaten hier abgeschrieben — und blieben beim
   * Verschieben der Muldenzeile zurueck: Lambert trug Buntmetall zu einer
   * Stelle, an der seit dem Umbau nur noch Beton war. Zwei Wahrheiten ueber
   * dieselbe Sache halten nie. Stahl fehlt bewusst: der bleibt Sache des
   * Baggers, und das Ballenlager ist keine Mulde.
   *
   * Absetzcontainer gehen vor: Fuer Kupfer gibt es beides — den Container am
   * Bagger und die Hortmulde ganz hinten an der Suedwand. Wer eine Handvoll
   * Kupferrohr findet, traegt sie nicht zwanzig Meter weit, wenn drei Meter
   * weiter der richtige Behaelter steht.
   */
  private static muldeFuer(materialId: string): ContainerConfig | undefined {
    /*
     * Die Sortierboxen am Bagger sind seit dem 13.09.2026 selbst Mulden. Sie
     * sind Lamberts QUELLE, nicht sein Ziel — sonst traegt er aus der Alu-Box
     * in die Alu-Box und die Box wird nie leer (gemessen: 4 von 4 blieben
     * liegen, und er meldete sich nie ab).
     */
    /*
     * Seit E-010 traegt das Kennzeichen `lager` die Unterscheidung, nicht mehr
     * `!sortierbox`: Ziel ist die Silo-Reihe an der Westwand, Quelle sind die
     * Mulden am Bagger. Zusammengelegte Paare finden ihr Lager mit
     * (`gehoertHierhin`) — Messing landet im Kupferlager.
     */
    const passend = CONFIGS.filter((c) => c.lager === true && gehoertHierhin(c, materialId));
    return passend.find((c) => c.kind === "rolloff") ?? passend[0];
  }

  /**
   * Halteplatz vor einer Mulde: 2,2 m vor ihrer offenen Seite, nicht darin.
   *
   * Rechnet seit E-028 mit `bayVorderkante` statt mit einer eigenen Fallunter-
   * scheidung. Die alte las bei Oeffnung nach Norden `size[1]` statt
   * `size[0]` — also die Laenge an der Wand statt der Tiefe — und stellte
   * Lambert damit 0,9 m zu weit vorn ab, in die Mulde hinein. Solange keine
   * Mulde nach Norden zeigte, fiel das nicht auf; die halbe Silo-Reihe zeigt
   * jetzt so.
   */
  private static anlieferPunkt(c: ContainerConfig): [number, number] {
    const v = bayVorderkante(c);
    const o = bayOeffnung(c);
    return [v.x + o.x * 2.2, v.z + o.z * 2.2];
  }

  /**
   * Freier Weg von Lambert zum Ziel? Abgetastet wird die Luftlinie in
   * Meterschritten gegen die festen Bauten. Was nur um Ecken erreichbar wäre,
   * lässt er stehen — dafür ist der Bagger da.
   */
  /**
   * Sperrgebiet fuer Lambert: der Arbeitsbereich des Baggers.
   *
   * Ansage 12.09.2026: „der Lambert soll erst mal nicht in der Abladezone
   * fahren koennen, sondern nur von der Ostseite kommen koennen, also rechts
   * von den Containern und der Presse, weil der macht eigentlich nur
   * Scheisse." Er hatte dort nichts zu suchen und stand staendig im Weg oder
   * schob etwas an, das gerade gegriffen werden sollte.
   */
  /*
   * Die Grenze kommt seit E-010 aus den Mulden selbst, nicht mehr aus einer
   * abgeschriebenen −6,0.
   *
   * Die Sortiermulden sind am 14.09.2026 an die Westflanke gezogen und reichen
   * dort bis x −5,9. Mit der festen Schranke lag ihr oestliches Drittel im
   * Sperrgebiet: Gemessen blieben zwei von vier Stuecken liegen, weil sie in
   * der offenen Mulde ein Stueck nach Osten gerollt waren und damit als
   * unerreichbar galten — Lambert meldete sich nie ab. Die Regel bleibt
   * dieselbe (er faehrt nicht in den Arbeitsbereich des Baggers), sie wird nur
   * dort gezogen, wo die Mulden heute enden.
   */
  private static imBaggerrevier(x: number, z: number): boolean {
    return imBaggerrevier(x, z);
  }

  /** Halteplatz vor einer Mulde — als Modulfunktion, damit Tests sie lesen. */
  static anfahrtZu(c: ContainerConfig): [number, number] {
    return StaffManager.anlieferPunkt(c);
  }

  private reachable(tx: number, tz: number): boolean {
    if (StaffManager.imBaggerrevier(tx, tz)) return false;
    const from = this.lambert.group.position;
    const dx = tx - from.x;
    const dz = tz - from.z;
    const dist = Math.hypot(dx, dz);
    if (dist > this.reichweite) return false;
    const steps = Math.ceil(dist);
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      if (hitsObstacle(from.x + dx * f, from.z + dz * f, 0.5)) return false;
    }
    return true;
  }


  /**
   * So weit macht er sich auf den Weg. Zu Fuss ist bei 26 m Schluss — alles
   * Weitere waere ein halber Arbeitstag fuer ein Kleinteil. Mit dem Radlader
   * faehrt er den ganzen Platz ab; genau dafuer ist er da, denn was ganz
   * aussen liegt, erreicht sonst niemand (Wunsch 10.09.2026).
   */
  private get reichweite(): number {
    return this.hasLoader ? 60 : 26;
  }

  /** Wo Lambert gerade steht — der Baggerarm weicht ihm aus. */
  lambertPosition(): THREE.Vector3 {
    return this.lambert.group.position;
  }

  /** Abstand zur Maschine selbst — sie steht, er geht drumherum */
  private static readonly EXCAVATOR_KEEPOUT = 4.2;
  /** Abstand zur arbeitenden Spinne — darunter macht er Platz */
  private static readonly GRAPPLE_KEEPOUT = 5.5;
  private avoidTmp = new THREE.Vector3();
  /** Wie breit er selbst baut: zu Fuss schmal, mit dem Radlader eine Maschine. */
  private get eigenRadius(): number {
    return this.hasLoader ? 1.9 : 0.5;
  }
  private slideTmp = { x: 0, z: 0 };

  /**
   * Laufrichtung um Hindernisse herumlenken: Bagger-Schwenkbereich und
   * Karossen werden umgangen statt durchquert.
   */
  private avoid(pos: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 {
    const out = this.avoidTmp.copy(dir);
    const push = (ox: number, oz: number, radius: number): void => {
      const dx = pos.x - ox;
      const dz = pos.z - oz;
      const d = Math.hypot(dx, dz);
      if (d > radius || d < 0.01) return;
      // radial wegdrücken und tangential vorbeiführen
      const strength = (radius - d) / radius;
      out.x += (dx / d) * strength * 2.2 - (dz / d) * strength;
      out.z += (dz / d) * strength * 2.2 + (dx / d) * strength;
    };
    const ex = this.getExcavatorPos?.();
    if (ex) push(ex.x, ex.z, StaffManager.EXCAVATOR_KEEPOUT);
    const gr = this.getGrapplePos?.();
    if (gr) push(gr.x, gr.z, StaffManager.GRAPPLE_KEEPOUT);
    for (const c of this.getObstaclePositions?.() ?? []) push(c.x, c.z, 3.2);
    /*
     * Sperrige Schrottteile: zu Fuss steigt er nicht darueber, er geht
     * drumherum. Mit dem Radlader gilt das nur noch fuer richtige Brocken —
     * Kleinzeug schiebt so eine Maschine beiseite. Ohne diese Ausnahme blieb
     * er im Stahlhaufen stehen: Ringsum drueckte ihn alles gleichzeitig weg,
     * unterm Strich bewegte er sich nicht mehr (gemessen 10.09.2026).
     */
    const schwelle = this.hasLoader ? 400 : 120;
    for (const it of this.items.items) {
      if (it.massKg < schwelle || !it.body.isValid()) continue;
      const q = it.body.translation();
      if (Math.abs(q.x - pos.x) > 3 || Math.abs(q.z - pos.z) > 3) continue;
      if (it.id === this.carriedItemId) continue; // sein eigenes Ziel nicht
      push(q.x, q.z, this.hasLoader ? 1.2 : 1.5);
    }
    out.y = 0;
    out.normalize();
    // Fahrzeuge: an der Kante entlang statt hinein. Sie stehen schraeg auf
    // dem Hof, deshalb die gedrehte Box und nicht nur ein Umkreis.
    const boxen = this.getVehicleBoxes?.();
    if (boxen) {
      const vorn = findeBox(
        pos.x + out.x * (this.eigenRadius + 1.2),
        pos.z + out.z * (this.eigenRadius + 1.2),
        boxen,
        this.eigenRadius
      );
      if (vorn) {
        ausBox(pos.x, pos.z, vorn, this.slideTmp);
        out.set(this.slideTmp.x, 0, this.slideTmp.z);
      }
    }

    // Feste Bauten — Betonlego, Boxen, Schere — laufen lassen sich nicht
    // wegdrücken: hier wird die Richtung an der Wand entlang umgelenkt.
    if (slideAround(pos.x, pos.z, out.x, out.z, 0.7, this.slideTmp)) {
      out.set(this.slideTmp.x, 0, this.slideTmp.z);
    }
    return out.normalize();
  }

  /**
   * Teil, das gerade eine Fahrspur blockiert. Daran haengt der ganze Betrieb,
   * deshalb hat es Vorrang vor allem anderen.
   */
  private findBlocker(): (typeof this.items.items)[number] | null {
    const stoerfall = this.getBlockingItem?.();
    if (
      stoerfall &&
      stoerfall.body.isValid() &&
      stoerfall.massKg <= this.tragkraft &&
      this.reachable(stoerfall.body.translation().x, stoerfall.body.translation().z)
    ) {
      return stoerfall;
    }
    return null;
  }

  /** Kleinteil, das frei herumliegt (nicht in einer Zone, nicht gegriffen). */
  /**
   * Das naechste Stueck, das Werkzeug braucht.
   *
   * Was in der Spinne haengt, ist kinematisch und faellt damit heraus — er
   * soll nicht unter dem Bagger stehen und an etwas saegen, das gerade
   * hochgeht.
   */
  private findWerkzeugTeil(): ScrapItem | null {
    const von = this.lambert.group.position;
    let best: ScrapItem | null = null;
    let bestD = Infinity;
    for (const it of this.items.items) {
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      if (!this.items.brauchtWerkzeug(it)) continue;
      const p = it.body.translation();
      const d = Math.hypot(p.x - von.x, p.z - von.z);
      if (d > WERKZEUG_WEITE || d >= bestD) continue;
      best = it;
      bestD = d;
    }
    return best;
  }

  /**
   * Ein Stueck, das in einer Sortierbox liegt und in eine Ostmulde gehoert.
   *
   * Das ist seit dem 13.09.2026 Lamberts ganze Arbeit: „Lambert faehrt von der
   * Ostseite ran auf Befehl und macht die Mulden leer und faehrt sie zu der
   * Ostseite mit dem Radlader."
   *
   * Anders als `findStray` sucht das hier NICHT auf dem ganzen Platz, sondern
   * nur in den Boxen — was daneben liegt, ist nicht mehr seine Sache. Und das
   * Ziel ist immer eine `bay`: Die Sortierboxen selbst sind offene Flaechen,
   * `muldeFuer` liefert deshalb die Mulde an der Ostwand.
   */
  private findBoxTeil(): (typeof this.items.items)[number] | null {
    const boxen = CONFIGS.filter((c) => c.sortierbox === true);
    if (boxen.length === 0) return null;
    const gr = this.getGrapplePos?.();
    const von = this.lambert.group.position;
    let best: (typeof this.items.items)[number] | null = null;
    let bestD = Infinity;
    for (const it of this.items.items) {
      if (it.massKg > this.tragkraft) continue;
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      const ziel = StaffManager.muldeFuer(it.materialId);
      if (!ziel || ziel.kind !== "bay") continue;
      const p = it.body.translation();
      if (p.y > BOX_MAX_Y) continue;
      const box = boxen.find(
        (c) => Math.abs(p.x - c.x) <= c.size[0] / 2 && Math.abs(p.z - c.z) <= c.size[1] / 2
      );
      if (!box) continue;
      // Nicht dort zugreifen, wo die Spinne gerade arbeitet
      if (gr && Math.hypot(p.x - gr.x, p.z - gr.z) < StaffManager.GRAPPLE_KEEPOUT) continue;
      /*
       * Der Weg wird nur bis an den RAND der Box geprueft, nicht bis zum
       * Stueck.
       *
       * Sonst versperrt die Ladung sich selbst den Weg: Gemessen lag das
       * naechste Kupferstueck 0,7 m neben der Linie und galt als Hindernis —
       * Lambert blieb auf dem Posten stehen, obwohl die Box voll war. Was in
       * der Box liegt, ist sein Ziel und nicht sein Hindernis.
       */
      /*
       * Bei einer Mulde zaehlt die OFFENE Seite, nicht die naechste Kante:
       * Hinter der Rueckwand kommt er mit der Schaufel nicht hinein.
       */
      const anfahrt: [number, number] =
        box.kind === "bay"
          ? StaffManager.anlieferPunkt(box)
          : StaffManager.boxAnfahrt(box, von);
      if (!this.wegIstFrei(anfahrt[0], anfahrt[1], it)) continue;
      const d = Math.hypot(p.x - von.x, p.z - von.z);
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best;
  }

  /**
   * Punkt knapp vor der Box, auf der Seite, von der Lambert kommt.
   *
   * Bis dorthin muss der Weg frei sein; das Stueck selbst holt er dann mit der
   * Schaufel, ohne durch die uebrige Ladung zu fahren.
   */
  private static boxAnfahrt(
    box: ContainerConfig,
    von: { x: number; z: number }
  ): [number, number] {
    const hw = box.size[0] / 2;
    const hd = box.size[1] / 2;
    const dx = Math.max(-hw, Math.min(hw, von.x - box.x));
    const dz = Math.max(-hd, Math.min(hd, von.z - box.z));
    // Auf die naeher liegende Kante hinausschieben, plus einen Meter Luft
    if (hw - Math.abs(dx) < hd - Math.abs(dz)) {
      return [box.x + Math.sign(dx || 1) * (hw + 1.0), box.z + dz];
    }
    return [box.x + dx, box.z + Math.sign(dz || 1) * (hd + 1.0)];
  }

  /**
   * Alle Behaelter, in die Abfall gehoert.
   *
   * Zwei Stueck, und sie sind sehr verschieden: der versetzbare
   * MUELL-Container mitten auf dem Hof (`platzinventar`, E-034) und das
   * ABFALL-Silo an der Suedwand (`lager`, E-028). Welches genommen wird,
   * entscheidet nicht der Rang, sondern die Entfernung — und ob Lambert
   * ueberhaupt hinkommt.
   */
  private static abfallBehaelter(): ContainerConfig[] {
    return CONFIGS.filter(
      (c) =>
        (c.lager === true || c.platzinventar === true) &&
        (c.kind === "bay" || c.kind === "rolloff" || c.kind === "grosscontainer")
    );
  }

  /** Was in einem Behaelter liegt, je Fraktion — aus der Zonenzaehlung. */
  private muldenMassen(id: string): Map<string, number> {
    const m = new Map<string, number>();
    for (const it of this.items.items) {
      if (it.containerId !== id) continue;
      m.set(it.materialId, (m.get(it.materialId) ?? 0) + it.massKg);
    }
    return m;
  }

  /** Wie voll ein Behaelter ist (0 = leer, 1 = bis Oberkante) — fuer Tests und Overlay. */
  muldenFuellgrad(cfg: ContainerConfig): number {
    return fuellgrad(cfg, this.muldenMassen(cfg.id));
  }

  /** Halteplatz vor einem Behaelter — bei der Mulde die offene Seite, sonst die naechste Kante. */
  private anfahrtFuer(cfg: ContainerConfig): [number, number] {
    if (cfg.kind === "bay") return StaffManager.anlieferPunkt(cfg);
    const ort = this.getMuldenOrt?.(cfg.id) ?? { x: cfg.x, z: cfg.z };
    return StaffManager.boxAnfahrt(
      { ...cfg, x: ort.x, z: ort.z },
      this.lambert.group.position
    );
  }

  /**
   * Wohin dieses Abfallstueck soll: der naechste Behaelter, den er erreicht
   * UND in dem noch Platz ist.
   *
   * `null` heisst nicht „gibt es nicht", sondern „gerade nicht" — deshalb
   * setzt die Suche `abfallOhnePlatz`, wenn ein Behaelter nur am Fuellstand
   * gescheitert ist. Daran haengt die Funkmeldung „die Mulde ist voll": Ohne
   * die Unterscheidung klaenge ein unerreichbarer Container wie ein voller.
   */
  private abfallZiel(materialId: string): ContainerConfig | null {
    const von = this.lambert.group.position;
    let best: ContainerConfig | null = null;
    let bestD = Infinity;
    for (const c of StaffManager.abfallBehaelter()) {
      if (!gehoertHierhin(c, materialId)) continue;
      const [ax, az] = this.anfahrtFuer(c);
      if (!this.reachable(ax, az)) continue;
      if (istVoll(c, this.muldenMassen(c.id))) {
        this.abfallOhnePlatz = true;
        continue;
      }
      const d = Math.hypot(ax - von.x, az - von.z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  /** Letzte Abfallsuche scheiterte nur am Fuellstand, nicht am Weg. */
  private abfallOhnePlatz = false;
  /** Rangiert gerade ein Fahrzeug auf dem Platz? Dann hat es Vorfahrt. */
  private rangiert = false;

  /**
   * Abfall, der frei auf dem Hof liegt — mit der Mulde, in die er gehoert.
   *
   * Patricks Punkt: „Lambert sortiert den Abfall mit dem Radlader in die
   * Mulden." Gesucht wird nur nach der FRAKTION (Holz, Baumischabfall,
   * Reifen, Kunststoff — `ABFALLFRAKTIONEN`), nicht nach Gewicht oder
   * Entfernung: Abfall ist das Einzige, was er von sich aus anfasst.
   *
   * Was schon in einem Abfallbehaelter liegt, bleibt liegen — sonst traegt er
   * aus der Mulde in die Mulde (dieselbe Falle wie 13.09.2026 bei den
   * Sortierboxen).
   */
  private findAbfall(): { it: ScrapItem; mulde: ContainerConfig } | null {
    this.abfallOhnePlatz = false;
    const gr = this.getGrapplePos?.();
    const ex = this.getExcavatorPos?.();
    const von = this.lambert.group.position;
    let best: { it: ScrapItem; mulde: ContainerConfig } | null = null;
    let bestD = Infinity;
    for (const it of this.items.items) {
      if (!ABFALL.has(it.materialId)) continue;
      if (it.massKg > this.tragkraft) continue;
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      // Was in einem Abfallbehaelter liegt, liegt richtig
      if (it.containerId && StaffManager.abfallBehaelter().some((c) => c.id === it.containerId)) {
        continue;
      }
      const p = it.body.translation();
      if (p.y > 1.4) continue; // auf einer Ladeflaeche, nicht auf dem Hof
      if (Math.abs(p.x) > ABFALL_FELD.xMax) continue;
      if (p.z < ABFALL_FELD.zMin || p.z > ABFALL_FELD.zMax) continue;
      // Nicht dort zugreifen, wo die Spinne gerade arbeitet
      if (gr && Math.hypot(p.x - gr.x, p.z - gr.z) < StaffManager.GRAPPLE_KEEPOUT) continue;
      if (ex && Math.hypot(p.x - ex.x, p.z - ex.z) < StaffManager.EXCAVATOR_KEEPOUT) continue;
      const d = Math.hypot(p.x - von.x, p.z - von.z);
      if (d >= bestD) continue;
      if (!this.reachable(p.x, p.z)) continue;
      if (!this.wegIstFrei(p.x, p.z, it)) continue;
      const mulde = this.abfallZiel(it.materialId);
      if (!mulde) continue;
      bestD = d;
      best = { it, mulde };
    }
    return best;
  }

  private findStray(): (typeof this.items.items)[number] | null {
    // Lamberts Hauptaufgabe: Buntmetall aus dem Stahlschrott holen und in die
    // passende Box legen. Stahl und Störstoff lässt er liegen — der eine ist
    // Sache des Baggers, der andere kommt gesondert weg. Das nächstgelegene
    // Teil hat Vorrang, damit er nicht quer über den Platz läuft, während
    // Vorrang hat immer, was eine Fahrspur blockiert — daran hängt der
    // ganze Betrieb, und ein Kleinteil in der Box kann warten.
    const stoerfall = this.findBlocker();
    if (stoerfall) return stoerfall;

    // neben ihm etwas liegt.
    const ex = this.getExcavatorPos?.();
    const gr = this.getGrapplePos?.();
    const von = this.lambert.group.position;
    let best: (typeof this.items.items)[number] | null = null;
    let bestD = Infinity;
    for (const it of this.items.items) {
      // Was er heben kann, hängt am Ausbau: von Hand nur Kleinteile, mit
      // Stapler auch schwerere Stücke, mit Radlader ganze Brocken.
      if (it.massKg > this.tragkraft) continue;
      const mulde = StaffManager.muldeFuer(it.materialId);
      if (!mulde) continue;
      if (!it.body.isValid() || !it.body.isDynamic()) continue;
      const p = it.body.translation();
      if (p.y > 1.4) continue;
      // Liegt es schon in seiner Box, bleibt es dort. Alles andere — auch was
      // im Stahlhaufen steckt — holt er heraus; genau das ist seine Aufgabe.
      if (Math.hypot(p.x - mulde.x, p.z - mulde.z) < 2.8) continue;
      // Der Arbeitsteil des Platzes. Nach Sueden reicht er bis hinter die
      // letzte Mulde — die Zeile endet bei z = -17,65, und was daneben liegt,
      // soll er einraeumen duerfen.
      if (Math.abs(p.x) > 22 || p.z < -20 || p.z > 22) continue;
      // Nicht dort zugreifen, wo die Spinne gerade arbeitet
      if (gr && Math.hypot(p.x - gr.x, p.z - gr.z) < StaffManager.GRAPPLE_KEEPOUT) continue;
      if (ex && Math.hypot(p.x - ex.x, p.z - ex.z) < StaffManager.EXCAVATOR_KEEPOUT) continue;
      // Nur holen, wohin ein freier Weg führt — was hinter Boxen oder Mauern
      // liegt, ist Baggerarbeit
      if (!this.reachable(p.x, p.z)) continue;
      if (!this.wegIstFrei(p.x, p.z, it)) continue;
      const d = Math.hypot(p.x - von.x, p.z - von.z);
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best;
  }
}

/**
 * Sperrgebiet fuer Lambert: der Arbeitsbereich des Baggers.
 *
 * Steht als freie Funktion da, damit `test/silos.test.ts` sie lesen kann —
 * ohne sie waere die Regel nur in einer privaten Methode nachzubauen, und
 * zwei Wahrheiten ueber dieselbe Sache halten nie. Genau hier ist am
 * 15.09.2026 ein Silo unbemerkt aus Lamberts Revier gefallen.
 */
export function imBaggerrevier(x: number, z: number): boolean {
  return x > REVIER_X && z < REVIER_Z && z > BUCHT_Z;
}
const REVIER_X =
  Math.max(...CONFIGS.filter((c) => c.sortierbox).map((c) => c.x + c.size[0] / 2)) + 0.5;
/**
 * Nordgrenze des Reviers.
 *
 * Bis zum 15.09.2026 abends stand hier `max(z + Laenge/2)` ueber die
 * Sortierbox UND die Muellmulde. Seit der Muell ein frei versetzbarer
 * Container ist (E-034), waere Lamberts Sperrgebiet mit ihm gewandert: Wer
 * den Container in die Ecke schiebt, gibt den Bereich vor dem Bagger frei —
 * ein Sperrgebiet, das man wegtragen kann, ist keines.
 *
 * Jetzt haengt die Grenze an der Maschine selbst: so weit, wie der Arm reicht
 * (`SCHWENK_AUSSEN` = 9,2 m vor dem Sitz, also z −13,3), plus 1,4 m, damit
 * auch der Halteplatz des Kippers (z −12,5, `routes.ts`) drin liegt. Das ergibt
 * −11,9 — genau den Wert, der vorher zufaellig herauskam.
 */
const REVIER_Z = BAGGER_STAND.z + SCHWENK_AUSSEN + 1.4;
