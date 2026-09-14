/**
 * Vorschau des exportierten Fünfschalengreifers.
 *
 * Geladen wird die GLB-Datei, nicht das Modell aus dem Quelltext. Das ist der
 * Unterschied zwischen „sieht im Prüfstand gut aus" und „kommt in der Engine
 * an": Hierarchie, Pivots, Materialien und Animationen durchlaufen hier
 * denselben Weg wie später in Unity, Godot oder einer Web-App.
 *
 * Die Seite ist eine reine Vorschau. Sie hängt an keinem EventBus und rührt
 * das gespielte Spiel nicht an.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/*
 * Ueber `?url` aus dem Quellbaum, nicht ueber einen absoluten Pfad.
 *
 * `/docs/greifer-mehrschalen.glb` funktionierte nur beim Entwickeln: `docs/`
 * wird gar nicht mitgebaut, und die Seite liegt live unter einem
 * Unterverzeichnis — die Vorschau blieb dort leer. Mit dem Import kommt die
 * Datei in den Build und bekommt eine Pruefsumme im Namen, sodass nach einem
 * Export nicht die alte aus dem Zwischenspeicher gezeigt wird.
 */
import modellUrl from "./fuenfschalen.glb?url";
const DATEI = modellUrl;

/*
 * Der Regler hängt direkt an der Clipzeit von OEFFNEN.
 *
 * Der Clip ist linear gebaut: Clipzeit 0 s = ganz zu, Clipzeit 1,6 s = ganz
 * offen, 17 Stützstellen, 25 Kanäle (am Export vom 14.09.2026 nachgemessen).
 * Damit ist der Reglerweg dem Öffnungsgrad proportional, und die Seite muss die
 * Mechanik weder nachbauen noch selbst interpolieren — sie hält den Clip nur
 * an und setzt seine Zeit.
 */
const CLIP_OEFFNEN = "OEFFNEN";

const START_OEFFNUNG = 0.5; // SW: halb offen beim Start — die Bauform liest sich halb geöffnet am besten
const REGLER_STUFEN = 1000; // SW: stufenlos genug; muss zum max-Wert in greifer.html passen

const DREH_PRO_PIXEL = 0.008; // aus der bisherigen Vorschau übernommen
const KIPP_PRO_PIXEL = 0.005; // aus der bisherigen Vorschau übernommen
const KIPP_MIN = -0.35; // Auftrag M2-A3: Kamerakippung bleibt wie bisher begrenzt
const KIPP_MAX = 1.1;
const RAD_EMPFINDLICH = 0.0012; // SW: Mausrad, anteilig zum Abstand statt absolut
const ZOOM_NAH = 0.35; // SW: Anteil des Einpass-Abstands, näher geht nicht
const ZOOM_FERN = 2.6; // SW: Anteil des Einpass-Abstands, weiter geht nicht
const EINPASS_LUFT = 1.15; // SW: 15 % Rand um das Hüllmaß, damit nichts am Bildrand klebt

const kopf = document.getElementById("kopf") as HTMLDivElement;
const leiste = document.getElementById("leiste") as HTMLDivElement;
const clipLeiste = document.getElementById("clips") as HTMLDivElement;
const regler = document.getElementById("regler") as HTMLInputElement;
const gradanzeige = document.getElementById("gradanzeige") as HTMLSpanElement;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const glas = renderer.domElement;

const szene = new THREE.Scene();
szene.background = new THREE.Color(0xd9dde2);

const kamera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);

/* Beleuchtung: ein Hauptlicht mit Schatten, dazu Himmel und Boden — damit
 * lackierter Stahl auch als lackierter Stahl gelesen wird. */
const sonne = new THREE.DirectionalLight(0xfff4e6, 2.4);
sonne.position.set(4, 7, 5);
sonne.castShadow = true;
sonne.shadow.mapSize.set(1024, 1024);
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

// ----------------------------------------------------------------- Kamera ---

let winkel = 0.7; // SW: Startblick wie in der bisherigen Vorschau
let hoehe = 0.35;
let abstand = 7.2;
let einpassAbstand = 7.2;
let eigenerZoom = false; // sobald selbst gezoomt wurde, passt die Seite nicht mehr nach
let huellRadius = 3; // vorläufig, bis das Modell geladen ist
const ziel = new THREE.Vector3(0, -1.6, 0);

function kameraSetzen(): void {
  kamera.position.set(
    ziel.x + Math.sin(winkel) * Math.cos(hoehe) * abstand,
    ziel.y + Math.sin(hoehe) * abstand,
    ziel.z + Math.cos(winkel) * Math.cos(hoehe) * abstand
  );
  kamera.lookAt(ziel);
}

/** Abstand, bei dem die Hüllkugel des Modells gerade ins Bild passt. */
function abstandFuerHuelle(radius: number): number {
  const senkrecht = THREE.MathUtils.degToRad(kamera.fov);
  const waagerecht = 2 * Math.atan(Math.tan(senkrecht / 2) * kamera.aspect);
  return (radius / Math.sin(Math.min(senkrecht, waagerecht) / 2)) * EINPASS_LUFT;
}

function zoomSetzen(neu: number, eigen: boolean): void {
  abstand = Math.max(
    einpassAbstand * ZOOM_NAH,
    Math.min(einpassAbstand * ZOOM_FERN, neu)
  );
  if (eigen) eigenerZoom = true;
}

/*
 * Die Größe wird in jedem Bild nachgezogen, nicht nur beim resize-Ereignis.
 * Beim ersten Anlauf stand das Bild in einer Ecke: Das Fenster war beim Start
 * noch nicht fertig aufgebaut, und ein resize kam danach nie.
 *
 * setViewOffset schiebt das Bild um die Höhe der Bedienleiste nach oben. So
 * sitzt das Modell in der Mitte der FREIEN Fläche und nicht hinter dem Regler —
 * auf dem iPhone mini quer ist die Leiste sonst fast ein Drittel des Bildes.
 * Damit die Pixel quadratisch bleiben, rechnet der Seitenverhältniswert mit der
 * gedachten Gesamthöhe (Bild + Leiste).
 */
let letzteBreite = 0;
let letzteHoehe = 0;
let letzteLeiste = -1;
function groesse(): void {
  const w = glas.clientWidth || innerWidth;
  const h = glas.clientHeight || innerHeight;
  const lh = Math.min(leiste.offsetHeight, Math.round(h * 0.5));
  if (w === letzteBreite && h === letzteHoehe && lh === letzteLeiste) return;
  letzteBreite = w;
  letzteHoehe = h;
  letzteLeiste = lh;
  renderer.setSize(w, h, false);
  kamera.aspect = w / (h + lh);
  kamera.setViewOffset(w, h + lh, 0, lh, w, h);
  kamera.updateProjectionMatrix();
  einpassAbstand = abstandFuerHuelle(huellRadius);
  if (!eigenerZoom) abstand = einpassAbstand;
}

// --------------------------------------------------- Finger und Mauszeiger ---

/*
 * Geister-Zeiger-Sicherung (Lehre aus v2, CLAUDE.md).
 *
 * Die alte Fassung merkte sich nur ein `zieht`-Flag und hörte am `window`. Ein
 * Finger, der über den Bildrand rutschte oder dessen Loslassen verschluckt
 * wurde, blieb damit für immer „gedrückt" — das Modell drehte sich von allein
 * weiter. Jetzt wird jeder Zeiger einzeln nach `pointerId` geführt:
 *
 * - `setPointerCapture` auf dem Canvas: die Ereignisse kommen auch dann noch
 *   an, wenn der Finger die Fläche verlässt.
 * - `pointerup`, `pointercancel`, `pointerleave` und `lostpointercapture`
 *   löschen den Zeiger wieder — jeder Weg, auf dem ein Finger verschwinden
 *   kann, räumt auf.
 * - Ein primärer `pointerdown` (der erste Finger einer Geste) leert die Liste
 *   vorher: Reste einer verschluckten Geste sterben spätestens bei der
 *   nächsten Berührung.
 * - Verlässt das Fenster den Vordergrund oder meldet die Maus „keine Taste
 *   gedrückt", wird alles losgelassen.
 *
 * Ist die Liste leer, wird nicht gezogen — ohne Ausnahme.
 */
type Zeigerstand = { x: number; y: number };
const zeiger = new Map<number, Zeigerstand>();
let kneifBasis = 0; // Fingerabstand beim Ansetzen des Kneifens, in Pixeln
let kneifAbstand = 0; // Kameraabstand beim Ansetzen des Kneifens

function kneifMessen(): number {
  const p = [...zeiger.values()];
  if (p.length < 2) return 0;
  return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
}
function kneifNeuAnsetzen(): void {
  kneifBasis = kneifMessen();
  kneifAbstand = abstand;
}
function loslassen(id: number): void {
  if (zeiger.delete(id)) kneifNeuAnsetzen();
}
function alleLoslassen(): void {
  zeiger.clear();
  kneifBasis = 0;
}

glas.addEventListener("pointerdown", (e) => {
  if (e.isPrimary) alleLoslassen();
  try {
    glas.setPointerCapture(e.pointerId);
  } catch {
    /* Wird der Fang verweigert, greifen die Aufräumer am window. */
  }
  zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
  kneifNeuAnsetzen();
  e.preventDefault();
});

glas.addEventListener("pointermove", (e) => {
  if (e.pointerType === "mouse" && e.buttons === 0) {
    alleLoslassen(); // Maustaste ist längst los, das Ereignis kam nie an
    return;
  }
  const stand = zeiger.get(e.pointerId);
  if (!stand) return;
  const dx = e.clientX - stand.x;
  const dy = e.clientY - stand.y;
  stand.x = e.clientX;
  stand.y = e.clientY;

  if (zeiger.size === 1) {
    // Ein Finger dreht: waagerecht um die Hochachse, senkrecht kippt die Kamera.
    winkel -= dx * DREH_PRO_PIXEL;
    hoehe = Math.max(KIPP_MIN, Math.min(KIPP_MAX, hoehe + dy * KIPP_PRO_PIXEL));
  } else if (zeiger.size >= 2 && kneifBasis > 0) {
    // Zwei Finger zoomen: auseinander ziehen holt das Modell heran.
    const jetzt = kneifMessen();
    if (jetzt > 0) zoomSetzen((kneifAbstand * kneifBasis) / jetzt, true);
  }
});

for (const art of ["pointerup", "pointercancel", "pointerleave", "lostpointercapture"]) {
  glas.addEventListener(art, (e) => loslassen((e as PointerEvent).pointerId));
}
addEventListener("pointerup", (e) => loslassen(e.pointerId));
addEventListener("pointercancel", (e) => loslassen(e.pointerId));
addEventListener("blur", alleLoslassen);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) alleLoslassen();
});

glas.addEventListener(
  "wheel",
  (e) => {
    zoomSetzen(abstand + e.deltaY * RAD_EMPFINDLICH * abstand, true);
    e.preventDefault();
  },
  { passive: false }
);

// -------------------------------------------------------- Regler und Clips ---

let mixer: THREE.AnimationMixer | null = null;
let oeffnenAktion: THREE.AnimationAction | null = null;
let oeffnenDauer = 0;
let laufend: THREE.AnimationAction | null = null;
let laufenderName: string | null = null;
let laufenderLeer = false;
let oeffnung = START_OEFFNUNG;

let zeileForm = "lade …";
let zeileMass = "";
let zeileClips = "";

function kopfSchreiben(): void {
  const zustand = laufenderName
    ? `Clip: ${laufenderName}${laufenderLeer ? " (ohne Kanäle)" : ""}`
    : `Öffnung: ${Math.round(oeffnung * 100)} %`;
  kopf.textContent = `${zeileForm}\n${zeileMass}\n${zeileClips}\n${zustand}`;
  gradanzeige.textContent = laufenderName ? "Clip" : `${Math.round(oeffnung * 100)} %`;
}

function knoepfeAus(): void {
  clipLeiste.querySelectorAll("button").forEach((b) => b.classList.remove("an"));
}

/**
 * Regler übernimmt: ein laufender Clip wird angehalten. Beides gleichzeitig
 * schreibt auf dieselben Knochen, das Modell würde zappeln.
 */
function oeffnungSetzen(wert: number): void {
  oeffnung = Math.max(0, Math.min(1, wert));
  if (laufend) {
    laufend.stop();
    laufend = null;
    laufenderName = null;
    laufenderLeer = false;
    knoepfeAus();
  }
  if (oeffnenAktion && mixer) {
    oeffnenAktion.reset();
    oeffnenAktion.play();
    oeffnenAktion.paused = true; // angehalten — die Clipzeit setzen wir selbst
    oeffnenAktion.time = oeffnung * oeffnenDauer;
    mixer.update(0);
  }
  kopfSchreiben();
}

regler.addEventListener("input", () => {
  oeffnungSetzen(Number(regler.value) / REGLER_STUFEN);
});

// ------------------------------------------------------------ Modell laden ---

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

    mixer = new THREE.AnimationMixer(wurzel);
    const clipOeffnen = gltf.animations.find((c) => c.name === CLIP_OEFFNEN) ?? null;
    if (clipOeffnen) {
      oeffnenDauer = clipOeffnen.duration;
      oeffnenAktion = mixer.clipAction(clipOeffnen);
      oeffnenAktion.play();
      oeffnenAktion.paused = true;
      /* Gemessen wird am ganz geöffneten Greifer: das ist das größte Hüllmaß
       * und die Zahl, die zählt, wenn es um Platz neben Mulde oder Presse
       * geht. Außerdem passt die Kamera dann in jeder Reglerstellung. */
      oeffnenAktion.time = oeffnenDauer;
      mixer.update(0);
    }
    wurzel.updateMatrixWorld(true);
    const kasten = new THREE.Box3().setFromObject(wurzel);
    const mass = kasten.getSize(new THREE.Vector3());
    kasten.getCenter(ziel);
    huellRadius = mass.length() * 0.5;

    // Boden, Licht und Schattenkamera auf das tatsächliche Modell stellen.
    boden.position.y = kasten.min.y - 0.02; // SW: 2 cm Luft, sonst flimmert der Schatten
    boden.geometry.dispose();
    boden.geometry = new THREE.CircleGeometry(Math.max(4, huellRadius * 3), 48);
    sonne.position.set(
      ziel.x + huellRadius * 1.6,
      ziel.y + huellRadius * 2.4,
      ziel.z + huellRadius * 1.8
    );
    sonne.target.position.copy(ziel);
    szene.add(sonne.target);
    const s = huellRadius * 1.6; // SW: Schattenfenster etwas größer als die Hüllkugel
    sonne.shadow.camera.left = -s;
    sonne.shadow.camera.right = s;
    sonne.shadow.camera.top = s;
    sonne.shadow.camera.bottom = -s;
    sonne.shadow.camera.far = huellRadius * 10;
    sonne.shadow.camera.updateProjectionMatrix();

    einpassAbstand = abstandFuerHuelle(huellRadius);
    if (!eigenerZoom) abstand = einpassAbstand;

    zeileForm = `Fünfschalengreifer · ${meshes} Meshes`;
    zeileMass =
      `${dreiecke} Dreiecke · ` +
      `${mass.x.toFixed(2)} × ${mass.y.toFixed(2)} × ${mass.z.toFixed(2)} m offen`;
    zeileClips = `${gltf.animations.length} Clips`;

    for (const clip of gltf.animations) {
      const knopf = document.createElement("button");
      knopf.textContent = clip.name;
      knopf.addEventListener("click", () => {
        if (!mixer) return;
        oeffnenAktion?.stop(); // erst den Regler loslassen, dann den Clip — nie beide
        laufend?.stop();
        const a = mixer.clipAction(clip);
        a.reset();
        a.setLoop(THREE.LoopRepeat, Infinity);
        a.play();
        laufend = a;
        laufenderName = clip.name;
        /* Sicherung gegen Clips ohne Kanäle: Die bewegen nichts, und der Kopf
         * sagt das offen, statt raten zu lassen, ob die Seite hängt.
         *
         * Der Fall trat wirklich ein — POSE_ZU, POSE_HALB und POSE_OFFEN kamen
         * zunächst leer aus dem Export, weil dessen Spurenfilter konstante
         * Spuren wegwirft und bei einer Pose jede Spur konstant ist. Seit dem
         * 14.09.2026 haben sie ihre Kanäle (`tools/fuenfschalen/export.ts`,
         * `posenTracks`), und die Gegenprobe des Exports bricht ab, wenn ein
         * Clip leer bleibt. Die Zeile hier bleibt als zweite Sicherung. */
        laufenderLeer = clip.tracks.length === 0;
        knoepfeAus();
        knopf.classList.add("an");
        kopfSchreiben();
      });
      clipLeiste.appendChild(knopf);
    }

    regler.value = String(Math.round(START_OEFFNUNG * REGLER_STUFEN));
    oeffnungSetzen(START_OEFFNUNG);
  },
  undefined,
  (fehler) => {
    kopf.textContent =
      `GLB nicht ladbar:\n${String(fehler)}\n\n` +
      `Die Datei wird über \`?url\` aus src/greifer/ eingebunden —\n` +
      `fehlt sie, muss sie erst exportiert werden.`;
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
