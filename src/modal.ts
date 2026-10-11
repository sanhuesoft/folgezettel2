import { App, FuzzySuggestModal, TFile, FuzzyMatch, Modal, Setting, Notice, normalizePath } from "obsidian";
import { FolgezettelNode, compareFolgezettelNodes, getFolgezettelNodes } from "./folgezettel";
import { t } from "./i18n";
import type FolgezettelPlugin from "./main";

export class NoteSuggestModal extends FuzzySuggestModal<TFile> {
	private files: TFile[];
	private onChoose: (file: TFile) => void;

	constructor(app: App, files: TFile[], onChoose: (file: TFile) => void) {
		super(app);
		this.files = files;
		this.onChoose = onChoose;
		this.setPlaceholder(t("modalSearchInboxPlaceholder"));
	}

	getItems(): TFile[] {
		return this.files;
	}

	getItemText(item: TFile): string {
		// Display folder name and note title
		const folder = item.parent ? item.parent.name : "";
		return folder ? `${item.basename} (${folder})` : item.basename;
	}

	onChooseItem(item: TFile, evt: MouseEvent | KeyboardEvent): void {
		this.onChoose(item);
	}
}

export class ReferenceSuggestModal extends FuzzySuggestModal<FolgezettelNode> {
	private nodes: FolgezettelNode[];
	private onChoose: (node: FolgezettelNode) => void;

	constructor(app: App, nodes: FolgezettelNode[], onChoose: (node: FolgezettelNode) => void) {
		super(app);
		this.nodes = nodes;
		this.onChoose = onChoose;
		this.setPlaceholder(t("modalSearchRefPlaceholder"));
	}

	getItems(): FolgezettelNode[] {
		return this.nodes;
	}

	getItemText(node: FolgezettelNode): string {
		return node.title ? `${node.id} ${node.title}` : node.id;
	}

	getSuggestions(query: string): FuzzyMatch<FolgezettelNode>[] {
		const suggestions = super.getSuggestions(query);
		const cleanQuery = query.trim().toLowerCase();
		if (!cleanQuery) return suggestions;

		// Extract leading ID if query is or starts with a Folgezettel ID pattern (e.g. "12.1", "12.1b", "12")
		const idMatch = cleanQuery.match(/^([0-9]+(?:\.[0-9]+[a-z0-9]*)?)/);
		const targetId = idMatch ? idMatch[1] : null;

		return suggestions.sort((a, b) => {
			const aId = a.item.id.toLowerCase();
			const bId = b.item.id.toLowerCase();

			// 1. Exact ID match (e.g. query is "12.1" and node ID is exactly "12.1")
			const aExact = aId === cleanQuery || (targetId !== null && aId === targetId);
			const bExact = bId === cleanQuery || (targetId !== null && bId === targetId);
			if (aExact && !bExact) return -1;
			if (!aExact && bExact) return 1;

			// 2. ID prefix match: nodes whose ID begins with targetId or query
			const prefix = targetId ?? cleanQuery;
			const aPrefix = aId.startsWith(prefix);
			const bPrefix = bId.startsWith(prefix);
			if (aPrefix && !bPrefix) return -1;
			if (!aPrefix && bPrefix) return 1;

			// 3. If both start with the same ID prefix, sort hierarchically by Folgezettel node order!
			// (e.g. 12.1, 12.1a, 12.1b, 12.1b1, 12.1b2, 12.1b3, 12.1b4, 12.1c, 12.1d)
			if (aPrefix && bPrefix) {
				return compareFolgezettelNodes(a.item, b.item);
			}

			// 4. Fallback to Obsidian's default fuzzy score (higher score is better match)
			const scoreA = a.match?.score ?? 0;
			const scoreB = b.match?.score ?? 0;
			return scoreB - scoreA;
		});
	}

	onChooseItem(node: FolgezettelNode, evt: MouseEvent | KeyboardEvent): void {
		this.onChoose(node);
	}
}

export class ChangeThreadIdModal extends Modal {
	private plugin: FolgezettelPlugin;
	private currentMajor: number;
	private onComplete?: (oldMajor: number, newMajor: number) => void;

	constructor(
		app: App,
		plugin: FolgezettelPlugin,
		currentMajor: number,
		onComplete?: (oldMajor: number, newMajor: number) => void
	) {
		super(app);
		this.plugin = plugin;
		this.currentMajor = currentMajor;
		this.onComplete = onComplete;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("folgezettel-change-id-modal");

		contentEl.createEl("h2", { text: t("modalChangeThreadIdTitle", this.currentMajor) });
		contentEl.createEl("p", {
			text: t("modalChangeThreadIdDesc", this.currentMajor),
			cls: "setting-item-description",
		});

		let inputVal = "";
		const errorEl = contentEl.createDiv({ cls: "folgezettel-modal-error is-hidden" });

		new Setting(contentEl)
			.setName(t("modalChangeThreadIdInputLabel"))
			.addText((text) => {
				text.setPlaceholder(t("modalChangeThreadIdPlaceholder"))
					.setValue("")
					.onChange((val) => {
						inputVal = val;
						errorEl.addClass("is-hidden");
					});
				text.inputEl.focus();
				text.inputEl.addEventListener("keydown", (evt) => {
					if (evt.key === "Enter") {
						evt.preventDefault();
						submitBtn.buttonEl.click();
					}
				});
			});

		const buttonsSetting = new Setting(contentEl);
		buttonsSetting.addButton((btn) => {
			btn.setButtonText(t("modalChangeThreadIdCancel")).onClick(() => {
				this.close();
			});
		});

		const submitBtn = buttonsSetting.addButton((btn) => {
			btn.setButtonText(t("modalChangeThreadIdConfirm"))
				.setCta()
				.onClick(async () => {
					const trimmed = inputVal.trim();
					if (!/^[1-9]\d*$/.test(trimmed)) {
						errorEl.setText(t("modalChangeThreadIdInvalid"));
						errorEl.removeClass("is-hidden");
						return;
					}

					const newMajor = parseInt(trimmed, 10);
					if (newMajor === this.currentMajor) {
						errorEl.setText(t("modalChangeThreadIdSame"));
						errorEl.removeClass("is-hidden");
						return;
					}

					const allNodes = getFolgezettelNodes(this.app.vault);
					if (allNodes.some((n) => n.major === newMajor)) {
						errorEl.setText(t("modalChangeThreadIdExists", newMajor));
						errorEl.removeClass("is-hidden");
						return;
					}

					const nodesToRename = allNodes.filter((n) => n.major === this.currentMajor);
					nodesToRename.sort(compareFolgezettelNodes);

					const oldMajorStr = String(this.currentMajor);
					const newMajorStr = String(newMajor);

					const plans: { file: TFile; oldId: string; newId: string; newPath: string }[] = [];
					for (const n of nodesToRename) {
						const newId = newMajorStr + n.id.slice(oldMajorStr.length);
						const parentPath = n.file.parent?.path;
						const parentPrefix = parentPath && parentPath !== "/" ? `${parentPath}/` : "";
						const ext = n.file.extension || "md";
						const newFileName = n.title ? `${newId} ${n.title}.${ext}` : `${newId}.${ext}`;
						const newPath = normalizePath(`${parentPrefix}${newFileName}`);

						const existingFile = this.app.vault.getAbstractFileByPath(newPath);
						if (existingFile) {
							errorEl.setText(t("modalChangeThreadIdCollision", newPath));
							errorEl.removeClass("is-hidden");
							return;
						}

						plans.push({
							file: n.file,
							oldId: n.id,
							newId,
							newPath,
						});
					}

					btn.setDisabled(true);
					btn.setButtonText(t("modalChangeThreadIdRenaming"));

					this.close();

					try {
						let successCount = 0;
						for (const plan of plans) {
							await this.app.fileManager.renameFile(plan.file, plan.newPath);
							successCount++;
						}

						if (this.plugin.settings?.threadLabels && this.plugin.settings.threadLabels[oldMajorStr]) {
							this.plugin.settings.threadLabels[newMajorStr] = this.plugin.settings.threadLabels[oldMajorStr];
							delete this.plugin.settings.threadLabels[oldMajorStr];
							await this.plugin.saveSettings();
						}

						new Notice(t("noticeThreadRenamed", oldMajorStr, newMajorStr, successCount));
						if (this.onComplete) {
							this.onComplete(this.currentMajor, newMajor);
						}
					} catch (err) {
						console.error("Error renaming thread notes:", err);
						new Notice(t("noticeErrorRenamingThread", err));
					}
				});
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

