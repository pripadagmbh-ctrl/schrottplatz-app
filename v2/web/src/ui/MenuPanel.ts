import { makeT } from "./format";

/**
 * Menue (M4b, Gerätetest 09.09.: „es gibt keine Möglichkeit mehr abzubrechen" — Autosave stellt immer wieder her).
 * ☰ oben rechts neben ⌖: Neues Spiel (zweistufig, loescht den Spielstand), Export/Import, Ton an/aus.
 * Reines DOM; Aktionen kommen aus der App.
 */
export interface MenuActions { onNewGame(): void; onExport(): void; onImport(file: File): void; onToggleMute(): boolean; onToggleFollowCab(): boolean; onPress(): void }
/** Zustand der Presse, wie ihn das Menue anzeigt (M5b) — kommt aus PressSystem.status(). */
export interface PressMenuState { items: number; wrecks: number; ready: boolean; blockedBy: string[]; running: boolean }

export class MenuPanel {
  private readonly panel: HTMLElement; private readonly newBtn: HTMLButtonElement; private readonly muteBtn: HTMLButtonElement;
  private confirmUntil = 0;

  private readonly camBtn: HTMLButtonElement; private readonly pressBtn: HTMLButtonElement; private pressKey = "";
  constructor(parent: HTMLElement, i18n: Record<string, unknown>, muted: boolean, followCab: boolean, private readonly actions: MenuActions) {
    const t = makeT(i18n);
    const open = document.createElement("button"); open.type = "button"; open.className = "menu-btn"; open.id = "btn-menu"; open.textContent = "☰"; open.setAttribute("aria-label", "Menü"); parent.appendChild(open);
    this.panel = document.createElement("div"); this.panel.className = "sell-panel menu-panel"; this.panel.hidden = true; parent.appendChild(this.panel);
    const head = document.createElement("div"); head.className = "sell-head"; head.textContent = "Bagerana";
    const close = document.createElement("button"); close.type = "button"; close.className = "sell-close"; close.textContent = "✕"; head.appendChild(close);
    const mk = (label: string) => { const b = document.createElement("button"); b.type = "button"; b.className = "menu-item"; b.textContent = label; return b; };
    this.newBtn = mk(t("menu.newGame")); const exp = mk(t("menu.export")); const imp = mk(t("menu.import")); this.muteBtn = mk("");
    this.setMute(muted); this.camBtn = mk(""); this.setFollow(followCab);
    this.pressBtn = mk(""); this.setPress({ items: 0, wrecks: 0, ready: false, blockedBy: [], running: false });
    const file = document.createElement("input"); file.type = "file"; file.accept = "application/json,.json"; file.hidden = true;
    this.panel.append(head, this.pressBtn, this.newBtn, exp, imp, this.muteBtn, this.camBtn, file);
    this.pressBtn.addEventListener("pointerup", () => { if (!this.pressBtn.disabled) { this.actions.onPress(); this.panel.hidden = true; } });
    this.camBtn.addEventListener("pointerup", () => this.setFollow(this.actions.onToggleFollowCab()));
    open.addEventListener("pointerup", () => { this.panel.hidden = !this.panel.hidden; this.resetConfirm(); });
    // Schliessen ist idempotent, deshalb auf pointerup UND click (falls Safari eines davon schluckt)
    const doClose = () => { this.panel.hidden = true; this.resetConfirm(); };
    close.addEventListener("pointerup", doClose); close.addEventListener("click", doClose);
    this.newBtn.addEventListener("pointerup", () => {
      const now = performance.now();
      if (now < this.confirmUntil) { this.actions.onNewGame(); return; }
      this.confirmUntil = now + 4000; this.newBtn.textContent = "Wirklich? Tag, Konto und Platz gehen verloren — nochmal tippen"; this.newBtn.classList.add("danger");
      setTimeout(() => { if (performance.now() >= this.confirmUntil) this.resetConfirm(); }, 4100);
    });
    exp.addEventListener("pointerup", () => this.actions.onExport());
    imp.addEventListener("pointerup", () => file.click());
    file.addEventListener("change", () => { const f = file.files?.[0]; if (f) this.actions.onImport(f); file.value = ""; });
    this.muteBtn.addEventListener("pointerup", () => this.setMute(this.actions.onToggleMute()));
    this.newLabel = t("menu.newGame");
  }
  private newLabel = "";
  private resetConfirm(): void { this.confirmUntil = 0; this.newBtn.textContent = this.newLabel; this.newBtn.classList.remove("danger"); }
  private setFollow(on: boolean): void { this.camBtn.textContent = on ? "🎥 Kamera dreht mit dem Oberwagen — antippen für fest" : "🎥 Kamera fest im Raum (wie Prototyp) — antippen für mitdrehen"; }
  private setMute(muted: boolean): void { this.muteBtn.textContent = muted ? "🔇 Ton aus — antippen für an" : "🔊 Ton an — antippen für aus"; }
  /**
   * Presse-Eintrag (M5b): Der Knopf sagt immer, warum er nicht geht — „Presse leer" bzw. welches Teil im Weg ist.
   * Ein gesperrter Knopf ohne Begruendung laesst den Spieler raten (Briefing Kap. 14).
   */
  setPress(s: PressMenuState): void {
    const key = `${s.items}:${s.wrecks}:${s.ready}:${s.running}:${s.blockedBy.join(",")}`;
    if (key === this.pressKey) return; this.pressKey = key;
    const namen: Record<string, string> = { battery: "Starterbatterie", engine: "Motor", tank: "Tank" };
    this.pressBtn.disabled = !s.ready || s.running;
    this.pressBtn.classList.toggle("dim", this.pressBtn.disabled);
    const menge = s.wrecks ? `${s.items} Teile + ${s.wrecks} Wrack` : `${s.items} Teile`;
    if (s.running) this.pressBtn.textContent = "🗜️ Presse läuft …";
    else if (s.items + s.wrecks === 0) this.pressBtn.textContent = "🗜️ Presse auslösen — Mulde ist leer";
    else if (s.blockedBy.length) this.pressBtn.textContent = `🗜️ Presse verweigert — erst ausbauen: ${s.blockedBy.map((b) => namen[b] ?? b).join(", ")}`;
    else this.pressBtn.textContent = `🗜️ Presse auslösen (${menge})`;
  }

  get open(): boolean { return !this.panel.hidden; }
}
