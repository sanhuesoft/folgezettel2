import { App, Notice, TFile } from "obsidian";
import { NoteSuggestModal } from "./modal";
import { t } from "./i18n";

export async function assignBranchNote(
	app: App,
	targetId: string,
	onComplete?: () => void
): Promise<void> {
	// Collect markdown files in "Bandeja de entrada", "Durmiendo", "Inbox", "Incubation"
	const allMarkdown = app.vault.getMarkdownFiles();
	const candidates: TFile[] = [];

	for (const file of allMarkdown) {
		const folderName = file.parent ? file.parent.name.trim().toLowerCase() : "";
		if (
			folderName === "bandeja de entrada" ||
			folderName === "durmiendo" ||
			folderName === "inbox" ||
			folderName === "incubation" ||
			folderName === "sleeping"
		) {
			candidates.push(file);
		}
	}

	if (candidates.length === 0) {
		new Notice(t("noticeNoCandidateNotes"));
		return;
	}

	// Open FuzzySuggestModal
	const modal = new NoteSuggestModal(app, candidates, async (chosenFile: TFile) => {
		// Extract title from chosen file: if it already had an ID or numbers, clean it up or keep basename
		let title = chosenFile.basename;
		// Strip leading digit patterns if present (e.g. "1.1 algo")
		title = title.replace(/^([0-9]+(?:\.[0-9]+[a-z0-9]*)?)\s*/i, "").trim();

		const newFileName = title ? `${targetId} ${title}.md` : `${targetId}.md`;
		const newPath = `/${newFileName}`;

		try {
			await app.fileManager.renameFile(chosenFile, newPath);
			new Notice(t("noticeNoteAssigned", targetId));
			if (onComplete) {
				onComplete();
			}
		} catch (err) {
			console.error("Error al renombrar y mover nota Folgezettel:", err);
			new Notice(t("noticeErrorAssigning", err));
		}
	});

	modal.open();
}

export async function createBranchNote(
	app: App,
	targetId: string,
	onComplete?: () => void
): Promise<void> {
	const newFileName = `${targetId}.md`;
	const newPath = `/${newFileName}`;

	try {
		// Check if file already exists
		let file = app.vault.getAbstractFileByPath(newPath);
		if (!file) {
			file = await app.vault.create(newPath, "");
		}

		if (file instanceof TFile) {
			new Notice(t("noticeNoteCreated", targetId));
			if (onComplete) {
				onComplete();
			}
			// Open in new tab
			const newLeaf = app.workspace.getLeaf("tab");
			await newLeaf.openFile(file);
		}
	} catch (err) {
		console.error("Error al crear nota Folgezettel:", err);
		new Notice(t("noticeErrorCreatingNote", err));
	}
}
