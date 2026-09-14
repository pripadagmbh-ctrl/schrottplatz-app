import * as THREE from "three";

/**
 * Zwischenbild — Bildinterpolation zum festen Zeitschritt.
 *
 * ## Warum
 *
 * Die Physik rechnet in festen Schritten von 1/60 s, gezeichnet wird aber im
 * Takt des Bildschirms. Auf Patricks iPad sind das 48 Hz (gemessen 14.09.2026:
 * `FPS: 48 · Frame: 21,0 ms`). 60 durch 48 ist 1,25 — es passen also nicht
 * 1 Schritt in jedes Bild, sondern im Muster 2,1,1,1 (nachgerechnet in
 * test/zwischenbild.test.ts). Jedes vierte Bild rueckt die Welt die doppelte
 * Strecke vor: bei 3 m/s einmal 100 mm statt 50 mm. Genau das sah Patrick am
 * 14.09.2026 — "kein durchgaengiges Bild, sondern zwei schnelle Bilder
 * hintereinander".
 *
 * ## Verfahren
 *
 * Statt immer den letzten Physikzustand zu zeichnen, wird zwischen dem
 * vorletzten und dem letzten gemischt: `alpha = akkumulator / FIXED_DT`.
 * Das ist das Standardverfahren zum festen Zeitschritt und macht die Bewegung
 * glatt, unabhaengig von der Bildrate. Preis: Das Bild liegt bis zu einen
 * Schritt (16,7 ms) hinter der Rechnung — dieselbe Groessenordnung wie die
 * Bildsynchronisation selbst.
 *
 * ## Was unangetastet bleibt
 *
 * Die Zwischenpose steht nur waehrend `renderer.render` in der Szene. Direkt
 * danach setzt `zurueck()` jeden angefassten Knoten auf den gerechneten Stand,
 * und `weltmatrizen()` rechnet die Weltmatrizen der Wurzeln neu — Physik,
 * Greifen und jede Messung sehen weiterhin exakt dieselben Zahlen wie vorher.
 * Die Drehung wird dabei ueber den Euler-Winkel zurueckgesetzt, nicht ueber
 * das Quaternion: Fahrzeuge rechnen mit `group.rotation.y` weiter, und ein
 * aus dem Quaternion neu gewonnener Euler-Winkel koennte denselben Dreh mit
 * anderen Zahlen beschreiben (z. B. -2,78 statt 3,50) — der LKW wuerde
 * schlagartig anders lenken.
 */

/** Ab dieser Abweichung gilt ein Knoten als bewegt (Meter bzw. Quaternion-Einheit). */
const MERKLICH = 1e-7; // SW: knapp ueber Float-Rauschen, weit unter jeder sichtbaren Bewegung

interface Eintrag {
  obj: THREE.Object3D;
  /** Stand nach dem vorletzten Schritt */
  prevP: THREE.Vector3;
  prevQ: THREE.Quaternion;
  prevS: THREE.Vector3;
  /** Stand nach dem letzten Schritt — das ist die Wahrheit */
  currP: THREE.Vector3;
  currQ: THREE.Quaternion;
  currS: THREE.Vector3;
  /** Drehung so, wie das Spiel sie gesetzt hat (exaktes Zuruecksetzen) */
  ex: number;
  ey: number;
  ez: number;
  ordnung: THREE.EulerOrder;
  /** Hat sich zwischen den letzten beiden Schritten etwas getan? */
  bewegt: boolean;
  /** Umlauf der letzten Erfassung — fuer das Aufraeumen entfernter Knoten */
  runde: number;
}

export class Zwischenbild {
  /** Baugruppen, deren Unterbaum Bild fuer Bild gemischt wird */
  private wurzeln: THREE.Object3D[] = [];
  private wurzelSet = new Set<THREE.Object3D>();
  private eintraege = new Map<THREE.Object3D, Eintrag>();
  /** Nur die Knoten, die sich zuletzt wirklich bewegt haben */
  private bewegte: Eintrag[] = [];
  private angewandt: Eintrag[] = [];
  private szene: THREE.Object3D | null = null;
  /** Erstpose der noch nicht angemeldeten Szenenkinder */
  private kandidaten = new WeakMap<THREE.Object3D, number[]>();
  /** Knoten, die nur zeitweise mitlaufen — siehe zeitweise() */
  private zusatz: THREE.Object3D[] = [];
  private runde = 0;

  /** Diagnose fuers Debug-Overlay */
  knoten = 0;
  bewegteKnoten = 0;

  /**
   * Baugruppe fest anmelden.
   *
   * Noetig fuer den Bagger: Sein Wurzelknoten steht still, waehrend Ausleger
   * und Oberwagen arbeiten — die Selbsterkennung unten wuerde ihn erst beim
   * Losfahren bemerken.
   */
  wurzel(obj: THREE.Object3D): void {
    if (this.wurzelSet.has(obj)) return;
    this.wurzelSet.add(obj);
    this.wurzeln.push(obj);
  }

  /**
   * Szene beobachten: Jedes direkte Kind mit eigenen Kindern, das sich einmal
   * von seiner Erstpose wegbewegt hat, wird angemeldet und bleibt angemeldet.
   *
   * So kommen LKW, Radlader und Figuren von selbst dazu, ohne dass ihre Module
   * etwas nach aussen geben muessen. Einzelne Netze ohne Kinder — der lose
   * Schrott, die Containerschilder — bleiben aussen vor: Sie fallen als
   * Wackelkandidaten nicht auf und kosten sonst je Teil einen Eintrag.
   */
  beobachte(szene: THREE.Object3D): void {
    this.szene = szene;
  }

  /**
   * Knoten, die nur zeitweise mitlaufen: der Schrott in der Spinne.
   *
   * Loser Schrott bleibt aussen vor — er taumelt ohnehin unregelmaessig, und
   * zwei Posen je Teil zu halten kostet bei 150 Teilen mehr, als es bringt.
   * Was aber in der Spinne haengt, bewegt sich im Gleichschritt mit den
   * Schalen. Bliebe es ungemischt, waehrend die Maschine glatt laeuft, wuerde
   * die Ladung sichtbar gegen die Krallen zappeln — schlimmer als vorher.
   *
   * Die Liste wird bei jedem Schritt neu gesetzt; verschwundene Knoten raeumt
   * die Erfassung selbst wieder aus.
   */
  zeitweise(objs: THREE.Object3D[]): void {
    this.zusatz = objs;
  }

  /** Nach jedem Physikschritt aufrufen. */
  erfasse(): void {
    this.runde++;
    this.sucheBewegte();
    // Entfernte Baugruppen (abgefahrener LKW) fallen heraus
    for (let i = this.wurzeln.length - 1; i >= 0; i--) {
      if (!this.wurzeln[i].parent) {
        this.wurzelSet.delete(this.wurzeln[i]);
        this.wurzeln.splice(i, 1);
      }
    }
    this.bewegte.length = 0;
    let n = 0;
    const aufnehmen = (obj: THREE.Object3D): void => {
      n++;
      const e = this.hole(obj);
      e.runde = this.runde;
      // prev <- curr, curr <- Szene
      e.prevP.copy(e.currP);
      e.prevQ.copy(e.currQ);
      e.prevS.copy(e.currS);
      e.currP.copy(obj.position);
      e.currQ.copy(obj.quaternion);
      e.currS.copy(obj.scale);
      e.ex = obj.rotation.x;
      e.ey = obj.rotation.y;
      e.ez = obj.rotation.z;
      e.ordnung = obj.rotation.order;
      e.bewegt =
        e.prevP.manhattanDistanceTo(e.currP) > MERKLICH ||
        e.prevS.manhattanDistanceTo(e.currS) > MERKLICH ||
        Math.abs(e.prevQ.dot(e.currQ)) < 1 - MERKLICH;
      if (e.bewegt) this.bewegte.push(e);
    };
    for (const w of this.wurzeln) w.traverse(aufnehmen);
    for (const z of this.zusatz) if (z.parent) aufnehmen(z);
    this.knoten = n;
    this.bewegteKnoten = this.bewegte.length;
    // Aufraeumen erst, wenn sich merklich Totholz angesammelt hat
    if (this.eintraege.size > n + 64) {
      for (const [obj, e] of this.eintraege) {
        if (e.runde !== this.runde) this.eintraege.delete(obj);
      }
    }
  }

  private hole(obj: THREE.Object3D): Eintrag {
    let e = this.eintraege.get(obj);
    if (!e) {
      // Neu dazugekommen: prev = curr, damit der erste Schritt nicht springt
      e = {
        obj,
        prevP: obj.position.clone(),
        prevQ: obj.quaternion.clone(),
        prevS: obj.scale.clone(),
        currP: obj.position.clone(),
        currQ: obj.quaternion.clone(),
        currS: obj.scale.clone(),
        ex: obj.rotation.x,
        ey: obj.rotation.y,
        ez: obj.rotation.z,
        ordnung: obj.rotation.order,
        bewegt: false,
        runde: this.runde,
      };
      this.eintraege.set(obj, e);
    }
    return e;
  }

  private sucheBewegte(): void {
    if (!this.szene) return;
    for (const kind of this.szene.children) {
      if (kind.children.length === 0) continue;
      if (this.wurzelSet.has(kind)) continue;
      const erst = this.kandidaten.get(kind);
      const p = kind.position;
      const q = kind.quaternion;
      if (!erst) {
        this.kandidaten.set(kind, [p.x, p.y, p.z, q.x, q.y, q.z, q.w]);
        continue;
      }
      if (
        Math.abs(erst[0] - p.x) > MERKLICH ||
        Math.abs(erst[1] - p.y) > MERKLICH ||
        Math.abs(erst[2] - p.z) > MERKLICH ||
        Math.abs(erst[3] - q.x) > MERKLICH ||
        Math.abs(erst[4] - q.y) > MERKLICH ||
        Math.abs(erst[5] - q.z) > MERKLICH ||
        Math.abs(erst[6] - q.w) > MERKLICH
      ) {
        this.wurzel(kind);
      }
    }
  }

  /**
   * Zwischenpose in die Szene schreiben. `alpha` = akkumulator / FIXED_DT.
   *
   * Bei alpha >= 1 (Pause, Einzelschritt, Messbetrieb) bleibt alles stehen,
   * wie es gerechnet wurde — dann gibt es nichts zu mischen.
   */
  zeichne(alpha: number): void {
    this.angewandt.length = 0;
    const a = alpha <= 0 ? 0 : alpha >= 1 ? 1 : alpha;
    if (a >= 1) return;
    for (const e of this.bewegte) {
      e.obj.position.lerpVectors(e.prevP, e.currP, a);
      e.obj.quaternion.slerpQuaternions(e.prevQ, e.currQ, a);
      e.obj.scale.lerpVectors(e.prevS, e.currS, a);
      this.angewandt.push(e);
    }
  }

  /** Gerechneten Stand wiederherstellen — direkt nach dem Zeichnen. */
  zurueck(): void {
    for (const e of this.angewandt) {
      e.obj.position.copy(e.currP);
      e.obj.rotation.set(e.ex, e.ey, e.ez, e.ordnung);
      e.obj.scale.copy(e.currS);
    }
    this.angewandt.length = 0;
  }

  /**
   * Weltmatrizen der Wurzeln neu rechnen.
   *
   * Zweimal je Bild noetig: vor dem Zeichnen, damit die Kabinenkamera am
   * gezeichneten Augpunkt haengt, und nach `zurueck()`, damit die Spiellogik
   * (Hydraulik, Krallenkontakte, Kipperpritsche) wieder die gerechneten
   * Weltposen liest und nicht die gemischten.
   */
  weltmatrizen(): void {
    for (const w of this.wurzeln) w.updateMatrixWorld(true);
  }
}
