import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Werkzeug zum Verschmelzen von Bauteilen — die Umsetzung der Budgetregel aus
 * E-025.
 *
 *   EIN NETZ JE STARRKÖRPER UND WERKSTOFF.
 *
 * Gemessen auf Patricks Gerät (14.09.2026: FPS 48 · Frame 21,0 ms · 1322
 * Zeichenrufe · 240k Dreiecke · Bild 5,9 ms): Dreiecke sind fast gratis, NETZE
 * sind teuer — jedes schattenwerfende Netz wird zweimal gezeichnet.
 *
 * WARUM ES HIER AUCH FARBEN GIBT. „Ein Netz je Werkstoff" hätte den Fahrer
 * fünf Netze gekostet: Haut, Jacke, Reflexstreifen, Hose, Stiefel. Ein Netz
 * kann aber mehr als eine Farbe tragen, wenn die Farbe an den Ecken steht
 * statt am Material (`vertexColors`). Das kostet drei Zahlen je Eckpunkt —
 * also nichts — und spart drei Netze, also sechs Zeichenrufe.
 *
 * Der Preis ist derselbe wie beim Verschmelzen überhaupt: Man kann im
 * Szenengraph nicht mehr auf ein Teil zeigen. Das Gegenmittel steht in E-025
 * und gilt hier genauso — je Baugruppe ein Modul, eine benannte Funktion je
 * Teil, die Positionsliste im Quelltext.
 */

/** Ein Bauteil auf dem Weg ins gemeinsame Netz: Form plus Farbe. */
export interface Bauteil {
  geo: THREE.BufferGeometry;
  /** Farbe als sRGB-Hex, genau wie sie sonst am Material stünde. */
  farbe: number;
}

/**
 * Mehrere Bauteile zu EINEM Netz verschmelzen, jedes mit seiner eigenen Farbe.
 *
 * Das Material dazu muss `vertexColors: true` tragen und selbst weiß sein —
 * `farbstoff()` unten baut genau so eines.
 */
export function verschmelzeBunt(teile: Bauteil[], name = "Bauteil"): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  for (const t of teile) {
    const g = t.geo;
    const n = g.getAttribute("position").count;
    const c = new THREE.Color(t.farbe);
    const farben = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      farben[i * 3] = c.r;
      farben[i * 3 + 1] = c.g;
      farben[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(farben, 3));
    geos.push(g);
  }
  const g = mergeGeometries(geos, false);
  if (!g) throw new Error(`${name} liess sich nicht verschmelzen`);
  g.computeVertexNormals();
  return g;
}

/** Mehrere Bauteile derselben Farbe zu EINEM Netz verschmelzen. */
export function verschmelze(geos: THREE.BufferGeometry[], name = "Bauteil"): THREE.BufferGeometry {
  const g = mergeGeometries(geos, false);
  if (!g) throw new Error(`${name} liess sich nicht verschmelzen`);
  g.computeVertexNormals();
  return g;
}

/**
 * Ein Material für ein buntes Netz.
 *
 * Es ist selbst weiß: Three multipliziert Materialfarbe und Eckfarbe, und mit
 * Weiß kommt genau die Eckfarbe heraus. Stünde hier eine Farbe, wäre jedes
 * Teil damit eingefärbt.
 */
export function farbstoff(rauheit = 0.85, metall = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: rauheit,
    metalness: metall,
  });
}
