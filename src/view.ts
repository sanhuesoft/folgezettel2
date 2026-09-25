import { ItemView, WorkspaceLeaf, setIcon, Menu, Notice, TFile } from "obsidian";
import { FolgezettelNode, getFolgezettelNodes, getNextBranchId } from "./folgezettel";
import { NoteSuggestModal } from "./modal";

export const FOLGEZETTEL_VIEW_TYPE = "folgezettel-view";

export class FolgezettelView extends ItemView {
	private listContainerEl: HTMLElement;
	private createThreadBtn: HTMLButtonElement;
	private nextThreadId: string = "1.1";

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return FOLGEZETTEL_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Folgezettel";
	}

	getIcon(): string {
		return "list";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("folgezettel-view-container");
		container.addClass("is-readable-line-width");

		// Mimic the exact CodeMirror / Live Preview DOM structure of the note view
		const scrollerEl = container.createDiv({ cls: "cm-scroller" });
		const sizerEl = scrollerEl.createDiv({ cls: "cm-sizer" });
		const contentEl = sizerEl.createDiv({ cls: "cm-content folgezettel-content" });

		// Header bar with H1 title and actions (create thread + refresh)
		const headerEl = contentEl.createDiv({ cls: "folgezettel-header inline-title" });
		headerEl.createEl("h1", { text: "Folgezettel", cls: "folgezettel-title" });

		const actionsEl = headerEl.createDiv({ cls: "folgezettel-header-actions" });

		this.createThreadBtn = actionsEl.createEl("button", {
			cls: "clickable-icon folgezettel-icon-button",
			attr: { "aria-label": "Crear hilo 1.1" },
		});
		setIcon(this.createThreadBtn, "plus");

		this.registerDomEvent(this.createThreadBtn, "click", () => {
			this.createNewThread();
		});

		const refreshBtn = actionsEl.createEl("button", {
			cls: "clickable-icon folgezettel-icon-button",
			attr: { "aria-label": "Actualizar esquema" },
		});
		setIcon(refreshBtn, "refresh-cw");
		this.registerDomEvent(refreshBtn, "click", () => {
			this.renderOutline();
		});

		// Tree list container inside the content
		this.listContainerEl = contentEl.createDiv({ cls: "folgezettel-tree-list" });

		// Debounced render to prevent excessive renders during fast writes or renames
		const triggerRender = this.debounce(() => this.renderOutline(), 100);

		// Initial render
		this.renderOutline();

		// Auto refresh on vault file events (creation, deletion, rename, modify)
		this.registerEvent(this.app.vault.on("create", triggerRender));
		this.registerEvent(this.app.vault.on("delete", triggerRender));
		this.registerEvent(this.app.vault.on("rename", triggerRender));
		this.registerEvent(this.app.vault.on("modify", triggerRender));
	}

	private debounce(fn: (...args: any[]) => void, delay: number): (...args: any[]) => void {
		let timeoutId: number | null = null;
		return (...args: any[]) => {
			if (timeoutId !== null) {
				window.clearTimeout(timeoutId);
			}
			timeoutId = window.setTimeout(() => {
				fn(...args);
			}, delay);
		};
	}

	public renderOutline(): void {
		if (!this.listContainerEl) return;
		this.listContainerEl.empty();

		const nodes: FolgezettelNode[] = getFolgezettelNodes(this.app.vault);

		// Calculate N+1 for the next top-level thread
		let maxMajor = 0;
		for (const node of nodes) {
			if (node.major > maxMajor) {
				maxMajor = node.major;
			}
		}
		this.nextThreadId = `${maxMajor + 1}.1`;

		if (this.createThreadBtn) {
			this.createThreadBtn.setAttribute("aria-label", `Crear hilo ${this.nextThreadId}`);
		}

		if (nodes.length === 0) {
			this.listContainerEl.createDiv({
				text: "No se encontraron notas Folgezettel en la raíz.",
				cls: "folgezettel-empty-message",
			});
			return;
		}

		let lastMajor: number | null = null;

		for (const node of nodes) {
			const isNewTopic = lastMajor !== null && node.major !== lastMajor;
			lastMajor = node.major;

			const itemEl = this.listContainerEl.createDiv({
				cls: isNewTopic ? "folgezettel-item folgezettel-major-group-start" : "folgezettel-item",
			});

			// Prefix container: indent guide + [ID]
			const prefixEl = itemEl.createSpan({ cls: "folgezettel-prefix" });

			// Indentation and tree connector matching user reference
			if (node.depth > 0) {
				const indentGuide = prefixEl.createSpan({ cls: "folgezettel-indent-guide" });
				// 3 spaces per indent level before connector
				indentGuide.setText("   ".repeat(node.depth - 1) + "└── ");
			}

			// Badge with [ID]
			prefixEl.createSpan({
				cls: "folgezettel-node-id",
				text: `[${node.id}] `,
			});

			// Title container (will wrap indented under the start of the title)
			itemEl.createSpan({
				cls: "folgezettel-node-title",
				text: node.title || "",
			});

			// Open file on click
			this.registerDomEvent(itemEl, "click", (evt: MouseEvent) => {
				evt.preventDefault();
				// If Cmd/Ctrl is pressed or click is in middle tab, handle appropriately
				const isNewLeaf = evt.ctrlKey || evt.metaKey;
				// If this view is in the main root split, open the note in an adjacent/new leaf or reuse editor
				const leaf = this.app.workspace.getLeaf(isNewLeaf ? "tab" : false);
				leaf.openFile(node.file);
			});

			// Context menu on right click
			this.registerDomEvent(itemEl, "contextmenu", (evt: MouseEvent) => {
				evt.preventDefault();

				// Pre-calculate target branch ID for the menu items
				const currentNodes = getFolgezettelNodes(this.app.vault);
				const existingIds = new Set<string>(currentNodes.map(n => n.id.toLowerCase()));
				const targetId = getNextBranchId(node.id, existingIds);

				const menu = new Menu();

				menu.addItem((item) => {
					item.setTitle(`Asignar nota en [${targetId}]`)
						.setIcon("git-branch")
						.onClick(() => {
							this.assignBranch(node, targetId);
						});
				});

				menu.addItem((item) => {
					item.setTitle(`Crear la nota [${targetId}]`)
						.setIcon("plus")
						.onClick(() => {
							this.createBranch(targetId);
						});
				});

				menu.showAtMouseEvent(evt);
			});

			// Hover preview support (Obsidian native)
			this.registerDomEvent(itemEl, "mouseover", (event: MouseEvent) => {
				this.app.workspace.trigger("hover-link", {
					event,
					source: FOLGEZETTEL_VIEW_TYPE,
					hoverParent: this.listContainerEl,
					targetEl: itemEl,
					linktext: node.file.path,
					sourcePath: node.file.path,
				});
			});
		}
	}

	private async assignBranch(parentNode: FolgezettelNode, targetId: string): Promise<void> {
		// Collect markdown files in "Bandeja de entrada" and "Durmiendo"
		const allMarkdown = this.app.vault.getMarkdownFiles();
		const candidates: TFile[] = [];

		for (const file of allMarkdown) {
			const folderName = file.parent ? file.parent.name.trim().toLowerCase() : "";
			if (folderName === "bandeja de entrada" || folderName === "durmiendo") {
				candidates.push(file);
			}
		}

		if (candidates.length === 0) {
			new Notice("No hay notas disponibles en Bandeja de entrada ni Durmiendo.");
			return;
		}

		// Open FuzzySuggestModal
		const modal = new NoteSuggestModal(this.app, candidates, async (chosenFile: TFile) => {
			// Extract title from chosen file: if it already had an ID or numbers, clean it up or keep basename
			let title = chosenFile.basename;
			// Strip leading digit patterns if present (e.g. "1.1 algo")
			title = title.replace(/^([0-9]+(?:\.[0-9]+[a-z0-9]*)?)\s*/i, "").trim();

			const newFileName = title ? `${targetId} ${title}.md` : `${targetId}.md`;
			const newPath = `/${newFileName}`;

			try {
				await this.app.fileManager.renameFile(chosenFile, newPath);
				new Notice(`Nota asignada como [${targetId}] en la raíz.`);
				this.renderOutline();
			} catch (err) {
				console.error("Error al renombrar y mover nota Folgezettel:", err);
				new Notice(`Error al asignar nota: ${err}`);
			}
		});

		modal.open();
	}

	private async createBranch(targetId: string): Promise<void> {
		const newFileName = `${targetId}.md`;
		const newPath = `/${newFileName}`;

		try {
			// Check if file already exists
			let file = this.app.vault.getAbstractFileByPath(newPath);
			if (!file) {
				file = await this.app.vault.create(newPath, "");
			}

			if (file instanceof TFile) {
				new Notice(`Nota creada: [${targetId}]`);
				this.renderOutline();
				// Open in new tab
				const newLeaf = this.app.workspace.getLeaf("tab");
				await newLeaf.openFile(file);
			}
		} catch (err) {
			console.error("Error al crear nota Folgezettel:", err);
			new Notice(`Error al crear la nota: ${err}`);
		}
	}

	private async createNewThread(): Promise<void> {
		const newFileName = `${this.nextThreadId}.md`;
		const newPath = `/${newFileName}`;

		try {
			let file = this.app.vault.getAbstractFileByPath(newPath);
			if (!file) {
				file = await this.app.vault.create(newPath, "");
			}

			if (file instanceof TFile) {
				new Notice(`Nuevo hilo creado: [${this.nextThreadId}]`);
				this.renderOutline();
				// Open in new tab
				const newLeaf = this.app.workspace.getLeaf("tab");
				await newLeaf.openFile(file);
			}
		} catch (err) {
			console.error("Error al crear hilo Folgezettel:", err);
			new Notice(`Error al crear hilo: ${err}`);
		}
	}

	async onClose(): Promise<void> {
		// Cleanup if needed
	}
}
