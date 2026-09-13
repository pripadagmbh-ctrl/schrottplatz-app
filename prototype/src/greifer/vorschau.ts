/**
 * Vorschau des exportierten Greifers.
 *
 * Geladen wird die GLB-Datei, nicht das Modell aus dem Quelltext. Das ist der
 * Unterschied zwischen „sieht im Prüfstand gut aus" und „kommt in der Engine
 * an": Hierarchie, Pivots, Materialien und Animationen durchlaufen hier
 * denselben Weg wie später in Unity, Godot oder einer Web-App.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/*
 * Der Pfad ist BASIS-RELATIV, und die Datei liegt in `public/`.
 *
 * Vorher stand hier "/docs/greifer-mehrschalen.glb". Das lief in der
 * Entwicklung, weil Vite dort das Projektverzeichnis ausliefert — und war auf
 * GitHub Pages doppelt falsch: Die Seite liegt unter /schrottplatz-app/, also
 * ging der Ruf an den falschen Ort, und `docs/` wird ueberhaupt nicht
 * mitgebaut. Die Vorschau zeigte live nur die Fehlermeldung.
 *
 * `BASE_URL` ist das, was in `vite.config.ts` als `base` steht ("./"), und
 * `public/` ist das Verzeichnis, dessen Inhalt unveraendert im Build landet.
 */
const DATEI = new URL("greifer-mehrschalen.glb", document.baseURI).href;

const kopf = document.getElementById("kopf") as HTMLDivElement;
const leiste = document.getElementById("leiste") as HTMLDivElement;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const szene = new THREE.Scene();
szene.background = new THREE.Color(0xd9dde2);

const kamera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

/* Beleuchtung: ein Hauptlicht mit Schatten, dazu Himmel und Boden — damit
 * lackierter Stahl auch als lackierter Stahl gelesen wird. */
const sonne = new THREE.DirectionalLight(0xfff4e6, 2.4);
sonne.position.set(4, 7, 5);
sonne.castShadow = true;
sonne.shadow.mapSize.set(1024, 1024);
sonne.shadow.camera.left = -4;
sonne.shadow.camera.right = 4;
sonne.shadow.camera.top = 4;
sonne.shadow.camera.bottom = -4;
szene.add(sonne);
szene.add(new THREE.HemisphereLight(0xdfe8f2, 0x6b6257, 1.5));

const boden = new THREE.Mesh(
  new THREE.CircleGeometry(8, 48),
  new THREE.MeshStandardMaterial({ color: 0xb9bec4, roughness: 0.95 })
);
boden.rotation.x = -Math.PI / 2;
boden.position.y = -3.6;
boden.receiveShadow = true;
szene.add(boden);

let mixer: THREE.AnimationMixer | null = null;
let laufend: THREE.AnimationAction | null = null;
let winkel = 0.7;
let hoehe = 0.35;
let abstand = 7.2;

function kameraSetzen(): void {
  kamera.position.set(
    Math.sin(winkel) * Math.cos(hoehe) * abstand,
    Math.sin(hoehe) * abstand - 1.4,
    Math.cos(winkel) * Math.cos(hoehe) * abstand
  );
  kamera.lookAt(0, -1.6, 0);
}

/*
 * Die Groesse wird in jedem Bild nachgezogen, nicht nur beim resize-Ereignis.
 * Beim ersten Anlauf stand das Bild in einer Ecke: Das Fenster war beim Start
 * noch nicht fertig aufgebaut, und ein resize kam danach nie.
 */
let letzteBreite = 0;
let letzteHoehe = 0;
function groesse(): void {
  const w = renderer.domElement.clientWidth || innerWidth;
  const h = renderer.domElement.clientHeight || innerHeight;
  if (w === letzteBreite && h === letzteHoehe) return;
  letzteBreite = w;
  letzteHoehe = h;
  renderer.setSize(w, h, false);
  kamera.aspect = w / h;
  kamera.updateProjectionMatrix();
}

/* Ziehen dreht die Kamera — mehr Bedienung braucht eine Vorschau nicht. */
let zieht = false;
let letzteX = 0;
let letzteY = 0;
renderer.domElement.addEventListener("pointerdown", (e) => {
  zieht = true;
  letzteX = e.clientX;
  letzteY = e.clientY;
});
addEventListener("pointerup", () => {
  zieht = false;
});
addEventListener("pointermove", (e) => {
  if (!zieht) return;
  winkel -= (e.clientX - letzteX) * 0.008;
  hoehe = Math.max(-0.35, Math.min(1.1, hoehe + (e.clientY - letzteY) * 0.005));
  letzteX = e.clientX;
  letzteY = e.clientY;
});
renderer.domElement.addEventListener("wheel", (e) => {
  abstand = Math.max(3.5, Math.min(16, abstand + e.deltaY * 0.006));
});

new GLTFLoader().load(
  DATEI,
  (gltf) => {
    const wurzel = gltf.scene;
    wurzel.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    szene.add(wurzel);

    let dreiecke = 0;
    let meshes = 0;
    wurzel.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes++;
      const idx = m.geometry.getIndex();
      dreiecke += (idx ? idx.count : m.geometry.getAttribute("position").count) / 3;
    });
    const kasten = new THREE.Box3().setFromObject(wurzel);
    const mass = kasten.getSize(new THREE.Vector3());
    kopf.textContent =
      `${meshes} Meshes · ${dreiecke} Dreiecke\n` +
      `${mass.x.toFixed(2)} × ${mass.y.toFixed(2)} × ${mass.z.toFixed(2)} m\n` +
      `${gltf.animations.length} Clips`;

    mixer = new THREE.AnimationMixer(wurzel);
    for (const clip of gltf.animations) {
      const knopf = document.createElement("button");
      knopf.textContent = clip.name;
      knopf.addEventListener("click", () => {
        laufend?.fadeOut(0.15);
        const a = mixer!.clipAction(clip);
        a.reset();
        a.setLoop(THREE.LoopRepeat, Infinity);
        a.fadeIn(0.15).play();
        laufend = a;
        leiste.querySelectorAll("button").forEach((b) => b.classList.remove("an"));
        knopf.classList.add("an");
      });
      leiste.appendChild(knopf);
    }
    (leiste.firstElementChild as HTMLButtonElement | null)?.click();
  },
  undefined,
  (fehler) => {
    kopf.textContent = `GLB nicht ladbar:\n${String(fehler)}\n\nErst exportieren:\nnpx vite-node tools/greifer-export.ts`;
  }
);

const uhr = new THREE.Clock();
function bild(): void {
  requestAnimationFrame(bild);
  groesse();
  mixer?.update(uhr.getDelta());
  kameraSetzen();
  renderer.render(szene, kamera);
}
bild();
