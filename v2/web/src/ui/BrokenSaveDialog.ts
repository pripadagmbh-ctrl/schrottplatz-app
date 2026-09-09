import { makeT } from "./format";

/** Kaputter Spielstand (QA H2, Briefing 17.6): klare Wahl statt Schwarzbild — neu beginnen oder Datei importieren. */
export class BrokenSaveDialog {
  constructor(parent: HTMLElement, i18n: Record<string, unknown>, actions: { onRestart(): void; onImport(file: File): void }) {
    const t = makeT(i18n);
    const root = document.createElement("div"); root.className = "sheet"; parent.appendChild(root);
    const body = document.createElement("div"); body.className = "sheet-body"; root.appendChild(body);
    body.innerHTML = `<h2>${t("save.broken")}</h2><div class="sheet-actions"><button type="button" class="primary" data-act="restart">${t("day.restart")}</button><button type="button" data-act="import">${t("day.import")}</button></div>`;
    const file = document.createElement("input"); file.type = "file"; file.accept = "application/json,.json"; file.hidden = true; root.appendChild(file);
    file.addEventListener("change", () => { const f = file.files?.[0]; if (f) actions.onImport(f); });
    body.addEventListener("pointerup", (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>("button[data-act]")?.dataset["act"];
      if (act === "restart") actions.onRestart(); else if (act === "import") file.click();
    });
  }
}
