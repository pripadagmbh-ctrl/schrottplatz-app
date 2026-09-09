/**
 * Autosave (M4b, Briefing Kap. 17.6): ein Spielstand „autosave" in IndexedDB (Safari haelt localStorage bei
 * PWAs nicht zuverlaessig; IndexedDB ist die robustere Ablage). Der Blob ist `Simulation.save()` plus Kopf
 * { version, savedAt }. Lesen und Schreiben sind fehlertolerant: kaputt → `null` und `broken = true`, die App
 * fragt dann „Neu beginnen oder Importieren?". Export/Import als JSON-Datei — auch als Weg zwischen Geraeten.
 */
export interface SaveBlob { version: string; savedAt: string; sim: Record<string, unknown> }

const DB = "bagerana", STORE = "saves", KEY = "autosave";

export class SaveService {
  broken = false;
  private db: IDBDatabase | null = null;

  constructor(readonly version: string) {}

  private open(): Promise<IDBDatabase | null> {
    if (this.db) return Promise.resolve(this.db);
    if (typeof indexedDB === "undefined") return Promise.resolve(null);
    return new Promise((resolve) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
      req.onsuccess = () => { this.db = req.result; resolve(this.db); };
      req.onerror = () => resolve(null); req.onblocked = () => resolve(null);
    });
  }

  async load(): Promise<SaveBlob | null> {
    const db = await this.open(); if (!db) return null;
    const raw = await new Promise<unknown>((resolve) => {
      try { const tx = db.transaction(STORE, "readonly"); const r = tx.objectStore(STORE).get(KEY); r.onsuccess = () => resolve(r.result); r.onerror = () => resolve(undefined); }
      catch { resolve(undefined); }
    });
    if (raw === undefined || raw === null) return null;
    const blob = SaveService.parse(raw);
    if (!blob) this.broken = true;
    return blob;
  }

  async save(sim: Record<string, unknown>): Promise<boolean> {
    const db = await this.open(); if (!db) return false;
    const blob: SaveBlob = { version: this.version, savedAt: new Date().toISOString(), sim };
    return new Promise((resolve) => {
      try { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(blob, KEY); tx.oncomplete = () => resolve(true); tx.onerror = () => resolve(false); tx.onabort = () => resolve(false); }
      catch { resolve(false); }
    });
  }

  async clear(): Promise<void> {
    const db = await this.open(); if (!db) return;
    await new Promise<void>((resolve) => { try { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(KEY); tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); } catch { resolve(); } });
    this.broken = false;
  }

  /** Strukturpruefung des Kopfes; Inhalte prueft jedes System selbst beim Laden (QA H2). */
  static parse(raw: unknown): SaveBlob | null {
    if (!raw || typeof raw !== "object") return null;
    const b = raw as Partial<SaveBlob>;
    if (typeof b.version !== "string" || !b.sim || typeof b.sim !== "object" || Array.isArray(b.sim)) return null;
    return { version: b.version, savedAt: typeof b.savedAt === "string" ? b.savedAt : "", sim: b.sim as Record<string, unknown> };
  }

  /** Export als Datei-Download (Blob-URL; im Browser normal erlaubt). */
  exportFile(blob: SaveBlob): void {
    const url = URL.createObjectURL(new Blob([JSON.stringify(blob)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `bagerana-tag${(blob.sim["day"] as { day?: { day?: number } } | undefined)?.day?.day ?? 0}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async importFile(file: File): Promise<SaveBlob | null> {
    try { return SaveService.parse(JSON.parse(await file.text())); } catch { return null; }
  }
}
