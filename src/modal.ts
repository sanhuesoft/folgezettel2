import { App, FuzzySuggestModal, TFile } from "obsidian";

export class NoteSuggestModal extends FuzzySuggestModal<TFile> {
	private files: TFile[];
	private onChoose: (file: TFile) => void;

	constructor(app: App, files: TFile[], onChoose: (file: TFile) => void) {
		super(app);
		this.files = files;
		this.onChoose = onChoose;
		this.setPlaceholder("Escribe para buscar nota en Bandeja de entrada o Durmiendo...");
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
