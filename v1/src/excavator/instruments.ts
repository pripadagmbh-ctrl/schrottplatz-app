import * as THREE from "three";

/**
 * Bordinstrument in der Fahrerkabine.
 *
 * Ein kleines Display rechts neben dem Fahrer, gezeichnet auf eine Leinwand
 * und als unbeleuchtete Textur aufgezogen — ein Display leuchtet selbst und
 * soll im Schatten nicht abdunkeln. Es zeigt Achsstellungen, Hydraulikdruck,
 * Greiferzustand und Öltemperatur.
 */

/** Was das Display anzeigt — der Bagger reicht seinen Zustand herein. */
export interface InstrumentReadout {
  boomAngle: number;
  stickAngle: number;
  cabYaw: number;
  closure: number;
  carriedMassKg: number;
  carriedCount: number;
  /** 0 = eingefahren, 1 = abgestützt */
  outriggerDown: number;
  /** Achsaktivität 0..1 — treibt Druck und Temperatur */
  activity: number;
}

/** Auffrischrate: viermal je Sekunde reicht, Zeichnen kostet sonst unnötig */
const REFRESH_S = 0.25;

export class InstrumentPanel {
  private canvas: HTMLCanvasElement;
  private texture: THREE.CanvasTexture;
  private t = 0;

  /**
   * @param parent Kabinenhub-Gruppe — das Display fährt mit der Kabine hoch
   * @param cx X-Mitte der Kabine
   * @param cz Z-Mitte der Kabine
   */
  constructor(parent: THREE.Object3D, cx: number, cz: number) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 320;
    this.canvas.height = 224;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.26, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x121416, roughness: 0.7 })
    );
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.33, 0.23),
      new THREE.MeshBasicMaterial({ map: this.texture })
    );
    screen.position.z = 0.012;
    const holder = new THREE.Group();
    holder.add(frame, screen);
    // Rechts neben dem Fahrer: er blickt in +Z, seine rechte Seite ist −X.
    // Tief genug, dass das Display nicht in die Arbeitssicht ragt.
    holder.position.set(cx - 0.42, 1.16, cz + 0.46);
    holder.rotation.y = 2.55; // Bildfläche zum Fahrer gedreht
    holder.rotation.x = -0.3; // leicht nach hinten gekippt, wie im Armaturenbrett
    parent.add(holder);
  }

  /** Aus der Hauptschleife aufrufen; zeichnet nur viermal je Sekunde neu. */
  update(dt: number, r: InstrumentReadout): void {
    this.t += dt;
    if (this.t < REFRESH_S) return;
    this.t = 0;
    this.draw(r);
  }

  /** Einmal zeichnen, unabhängig von der Drosselung (für den Aufbau). */
  draw(r: InstrumentReadout): void {
    const x = this.canvas.getContext("2d");
    if (!x) return;
    const W = this.canvas.width;
    const H = this.canvas.height;
    x.fillStyle = "#0f1417";
    x.fillRect(0, 0, W, H);

    // Kopfzeile
    x.fillStyle = "#1b2429";
    x.fillRect(0, 0, W, 30);
    x.fillStyle = "#7ec96a";
    x.font = "bold 17px Consolas, monospace";
    x.fillText("PRIPADA", 10, 21);
    x.fillStyle = "#8d979d";
    x.font = "13px Consolas, monospace";
    x.fillText(r.outriggerDown > 0.85 ? "ABGESTÜTZT" : "FAHRBETRIEB", 108, 21);

    const deg = (rad: number): number => Math.round(THREE.MathUtils.radToDeg(rad));
    const rows: Array<[string, string]> = [
      ["Oberwagen", `${Math.abs(deg(r.cabYaw) % 360)}°`],
      ["Hauptarm", `${deg(r.boomAngle)}°`],
      ["Ausleger", `${deg(r.stickAngle)}°`],
    ];
    x.font = "14px Consolas, monospace";
    rows.forEach(([label, value], i) => {
      const y = 54 + i * 26;
      x.fillStyle = "#8d979d";
      x.fillText(label, 10, y);
      x.fillStyle = "#e8e8e4";
      x.fillText(value, 130, y);
    });

    // Hydraulikdruck steigt mit Last und Achsbewegung
    const bar = Math.round(90 + r.activity * 120 + Math.min(r.carriedMassKg / 40, 90));
    x.fillStyle = "#8d979d";
    x.fillText("Hydraulik", 10, 132);
    x.fillStyle = bar > 260 ? "#e0864a" : "#e8e8e4";
    x.fillText(`${bar} bar`, 130, 132);
    x.fillStyle = "#232c31";
    x.fillRect(10, 140, 180, 8);
    x.fillStyle = bar > 260 ? "#e0864a" : "#7ec96a";
    x.fillRect(10, 140, Math.min(180, (bar / 320) * 180), 8);

    // Greiferstatus
    x.fillStyle = "#8d979d";
    x.fillText("Spinne", 10, 172);
    const zu = r.closure > 0.85;
    x.fillStyle = zu ? "#e0c14a" : "#7ec96a";
    x.fillText(
      r.carriedCount > 0
        ? `beladen · ${Math.round(r.carriedMassKg)} kg`
        : zu
          ? "geschlossen"
          : r.closure < 0.15
            ? "offen"
            : `${Math.round(r.closure * 100)} %`,
      130,
      172
    );

    // Öltemperatur — steigt langsam mit der Arbeit
    x.fillStyle = "#8d979d";
    x.fillText("Öltemperatur", 10, 200);
    x.fillStyle = "#e8e8e4";
    x.fillText(`${Math.round(44 + r.activity * 14)} °C`, 130, 200);

    this.texture.needsUpdate = true;
  }
}
