import { App, FuzzySuggestModal, TFile } from "obsidian";
import { FolgezettelNode } from "./folgezettel";
import { t } from "./i18n";

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

	onChooseItem(node: FolgezettelNode, evt: MouseEvent | KeyboardEvent): void {
		this.onChoose(node);
	}
}
