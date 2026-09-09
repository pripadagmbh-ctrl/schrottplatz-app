import type { TutorialState } from "@/sim/systems/TutorialSystem";
import { makeT } from "./format";

/**
 * Einweisungs-Banner (M4b, E-026/E-027): unten Mitte ueber dem Griff-Chip, neutraler Systemtext,
 * Lektions-Titel + Schritt-Text + [Ueberspringen]. Text je Eingabegeraet: `_touch` bei grobem Zeiger, sonst `_kbd`.
 * Zeigt nach Abschluss 8 s lang „Einweisung abgeschlossen" und verschwindet.
 */
export class TutorialBanner {
  private readonly root: HTMLElement; private readonly title: HTMLElement; private readonly text: HTMLElement;
  private readonly t; private lastKey = ""; private doneUntil = 0;
  private readonly touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

  constructor(parent: HTMLElement, i18n: Record<string, unknown>, onSkip: () => void) {
    this.t = makeT(i18n);
    this.root = document.createElement("div"); this.root.className = "tut"; this.root.hidden = true; parent.appendChild(this.root);
    this.title = document.createElement("div"); this.title.className = "tut-title"; this.text = document.createElement("div"); this.text.className = "tut-text";
    const skip = document.createElement("button"); skip.type = "button"; skip.className = "tut-skip"; skip.id = "tut-skip"; skip.textContent = this.t("tutorial.skip");
    skip.addEventListener("pointerup", onSkip);
    this.root.append(this.title, this.text, skip);
  }

  update(s: TutorialState, nowMs: number): void {
    let key: string; let title = this.t("tutorial.title"); let text: string; let showSkip = true;
    if (s.finished) {
      if (this.lastKey && !this.lastKey.startsWith("done")) this.doneUntil = nowMs + 8000;
      if (nowMs > this.doneUntil) { if (!this.root.hidden) this.root.hidden = true; this.lastKey = "done:hidden"; return; }
      key = "done"; text = this.t("tutorial.done"); showSkip = false;
    } else if (!s.active) { if (!this.root.hidden) this.root.hidden = true; this.lastKey = ""; return; }
    else {
      key = `${s.lesson}:${s.step}:${s.done}:${s.need}:${s.wrong}`;
      title = this.t(`tutorial.l${s.lesson}`);
      const base = `tutorial.l${s.lesson}s${s.step}`; const dev = `${base}_${this.touch ? "touch" : "kbd"}`;
      const vars = { done: s.done, need: s.need, wrong: s.wrong };
      const devText = this.t(dev, vars); text = devText === dev ? this.t(base, vars) : devText;
    }
    if (key === this.lastKey) return; this.lastKey = key;
    this.root.hidden = false; this.title.textContent = title; this.text.textContent = text;
    (this.root.lastElementChild as HTMLElement).hidden = !showSkip;
  }
}
