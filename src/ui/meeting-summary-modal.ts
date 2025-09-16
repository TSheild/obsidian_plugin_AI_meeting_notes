import { App, Modal, Notice } from "obsidian";
import { MeetingNotesContent } from "../types";
import { describeSources, formatDuration } from "../utils/notes";

interface MeetingSummaryModalOptions {
  onInsert?: () => Promise<void>;
}

export class MeetingSummaryModal extends Modal {
  constructor(
    app: App,
    private readonly result: MeetingNotesContent,
    private readonly options: MeetingSummaryModalOptions = {},
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ai-meeting-notes-modal");

    const header = contentEl.createEl("div", { cls: "ai-meeting-notes-header" });
    header.createEl("h2", { text: "AI Meeting Notes" });
    header.createEl("p", {
      text: `Recorded ${this.result.createdAt.toLocaleString()} • Duration ${formatDuration(
        this.result.recording.endedAt - this.result.recording.startedAt,
      )} • Sources ${describeSources(this.result.recording.sources)}`,
      cls: "ai-meeting-notes-meta",
    });

    if (this.result.summaryUsedFallback) {
      const warning = contentEl.createEl("div", {
        text: "The summarization service was unavailable. A heuristic fallback summary is shown.",
      });
      warning.addClass("ai-meeting-notes-warning");
    }

    const summarySection = contentEl.createDiv({ cls: "ai-meeting-notes-section" });
    summarySection.createEl("h3", { text: "Summary" });
    summarySection.createEl("p", { text: this.result.summary || "No summary available." });

    const actionsSection = contentEl.createDiv({ cls: "ai-meeting-notes-section" });
    actionsSection.createEl("h3", { text: "Action items" });
    if (this.result.actionItems.length > 0) {
      const list = actionsSection.createEl("ul", { cls: "ai-meeting-notes-action-list" });
      for (const item of this.result.actionItems) {
        list.createEl("li", { text: item });
      }
    } else {
      actionsSection.createEl("p", { text: "No action items detected." });
    }

    const transcriptDetails = contentEl.createEl("details", {
      cls: "ai-meeting-notes-transcript",
    });
    transcriptDetails.createEl("summary", { text: "Show transcript" });
    transcriptDetails.createEl("pre", { text: this.result.transcript || "Transcript unavailable." });

    const actions = contentEl.createDiv({ cls: "ai-meeting-notes-actions" });

    const copyButton = actions.createEl("button", { text: "Copy markdown" });
    copyButton.addEventListener("click", async () => {
      try {
        if (!navigator.clipboard) {
          throw new Error("Clipboard API is not available in this environment.");
        }
        await navigator.clipboard.writeText(this.result.markdown);
        new Notice("Meeting notes copied to clipboard.");
      } catch (error) {
        console.error("AI Meeting Notes: failed to copy to clipboard", error);
        new Notice("Unable to copy meeting notes. Please copy manually from the note modal.");
      }
    });

    if (this.options.onInsert) {
      const insertButton = actions.createEl("button", { text: "Insert into active note" });
      insertButton.addEventListener("click", async () => {
        insertButton.setAttribute("disabled", "true");
        try {
          await this.options.onInsert?.();
          new Notice("Meeting notes inserted into the active note.");
          this.close();
        } catch (error) {
          console.error("AI Meeting Notes: failed to insert notes", error);
          new Notice("Unable to insert meeting notes into the active file.");
        } finally {
          insertButton.removeAttribute("disabled");
        }
      });
    }

    const closeButton = actions.createEl("button", { text: "Close" });
    closeButton.addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
