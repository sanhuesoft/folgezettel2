import { ItemView, WorkspaceLeaf, setIcon, Menu, Notice, TFile } from "obsidian";
import { FolgezettelNode, getFolgezettelNodes, getNextBranchId, getNextSiblingId, isAncestorOf } from "./folgezettel";
import { assignBranchNote, createBranchNote } from "./actions";
import { t } from "./i18n";
import type FolgezettelPlugin from "./main";

export const FOLGEZETTEL_VIEW_TYPE = "folgezettel-view";

export class FolgezettelView extends ItemView {
	private plugin: FolgezettelPlugin;
	private listContainerEl: HTMLElement;
	private createThreadBtn: HTMLButtonElement;
	private nextThreadId: string = "1.1";
	private collapsedNodes: Set<string> = new Set();
	private collapsedThreads: Set<number> = new Set();
	private searchQuery: string = "";
	private searchInputEl: HTMLInputElement;
	private searchContainerEl: HTMLElement;
	private activeFilePath: string | null = null;
	private autoScrollTimeout: number | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: FolgezettelPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return FOLGEZETTEL_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t("viewTitle");
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
		headerEl.createEl("h1", { text: t("viewTitle"), cls: "folgezettel-title" });

		const actionsEl = headerEl.createDiv({ cls: "folgezettel-header-actions" });

		// Focus / Reveal active note button
		const revealBtn = actionsEl.createEl("button", {
			cls: "clickable-icon folgezettel-icon-button",
			attr: { "aria-label": t("locateActiveNoteTooltip") },
		});
		setIcon(revealBtn, "crosshair");
		this.registerDomEvent(revealBtn, "click", () => {
			this.revealActiveNote(true);
		});

		// Collapse/Expand all toggle button
		const toggleCollapseBtn = actionsEl.createEl("button", {
			cls: "clickable-icon folgezettel-icon-button",
			attr: { "aria-label": t("collapseAllTooltip") },
		});
		setIcon(toggleCollapseBtn, "chevrons-up-down");
		this.registerDomEvent(toggleCollapseBtn, "click", () => {
			this.toggleCollapseAll();
		});

		// Search toggle button
		const searchToggleBtn = actionsEl.createEl("button", {
			cls: "clickable-icon folgezettel-icon-button",
			attr: { "aria-label": t("searchNotesTooltip") },
		});
		setIcon(searchToggleBtn, "search");
		this.registerDomEvent(searchToggleBtn, "click", () => {
			this.toggleSearchBar();
		});

		this.createThreadBtn = actionsEl.createEl("button", {
			cls: "clickable-icon folgezettel-icon-button",
			attr: { "aria-label": t("createThreadTooltip", this.nextThreadId) },
		});
		setIcon(this.createThreadBtn, "plus");

		this.registerDomEvent(this.createThreadBtn, "click", () => {
			this.createNewThread();
		});

		const refreshBtn = actionsEl.createEl("button", {
			cls: "clickable-icon folgezettel-icon-button",
			attr: { "aria-label": t("refreshOutlineTooltip") },
		});
		setIcon(refreshBtn, "refresh-cw");
		this.registerDomEvent(refreshBtn, "click", () => {
			this.renderOutline();
		});

		// Search input container (hidden by default)
		this.searchContainerEl = contentEl.createDiv({ cls: "folgezettel-search-container is-hidden" });
		const searchWrapper = this.searchContainerEl.createDiv({ cls: "folgezettel-search-wrapper" });
		setIcon(searchWrapper.createSpan({ cls: "folgezettel-search-icon" }), "search");
		this.searchInputEl = searchWrapper.createEl("input", {
			cls: "folgezettel-search-input",
			type: "search",
			placeholder: t("searchPlaceholder"),
		});

		this.registerDomEvent(this.searchInputEl, "input", () => {
			this.searchQuery = this.searchInputEl.value.trim().toLowerCase();
			this.renderOutline();
		});

		const clearSearchBtn = searchWrapper.createEl("button", {
			cls: "clickable-icon folgezettel-search-clear-btn",
			attr: { "aria-label": t("searchClearTooltip") },
		});
		setIcon(clearSearchBtn, "x");
		this.registerDomEvent(clearSearchBtn, "click", () => {
			this.searchQuery = "";
			this.searchInputEl.value = "";
			this.searchContainerEl.addClass("is-hidden");
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

		// Sincronización con nota activa: workspace active-leaf-change
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				this.handleActiveLeafChange();
			})
		);
		// Check currently active file on open
		this.handleActiveLeafChange();
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
			this.createThreadBtn.setAttribute("aria-label", t("createThreadTooltip", this.nextThreadId));
		}

		if (nodes.length === 0) {
			this.listContainerEl.createDiv({
				text: t("emptyVaultMessage"),
				cls: "folgezettel-empty-message",
			});
			return;
		}

		// Detect which nodes have children
		const parentNodeIds = new Set<string>();
		for (let i = 0; i < nodes.length; i++) {
			for (let j = 0; j < nodes.length; j++) {
				if (i !== j && isAncestorOf(nodes[i], nodes[j])) {
					parentNodeIds.add(nodes[i].id);
					break;
				}
			}
		}

		// Live Search Filter (with ancestor retention)
		const query = this.searchQuery.trim().toLowerCase();
		let visibleNodeIds: Set<string> | null = null;
		let matchingNodeIds: Set<string> | null = null;

		if (query) {
			visibleNodeIds = new Set<string>();
			matchingNodeIds = new Set<string>();

			for (const node of nodes) {
				const idMatch = node.id.toLowerCase().includes(query);
				const titleMatch = node.title.toLowerCase().includes(query);
				const label = (this.plugin?.settings?.threadLabels?.[String(node.major)] || "").toLowerCase();
				const labelMatch = label.includes(query);

				if (idMatch || titleMatch || labelMatch) {
					matchingNodeIds.add(node.id);
					visibleNodeIds.add(node.id);

					// Include all ancestors of this matching node so hierarchy is preserved
					for (const potentialAncestor of nodes) {
						if (isAncestorOf(potentialAncestor, node)) {
							visibleNodeIds.add(potentialAncestor.id);
						}
					}
				}
			}

			if (visibleNodeIds.size === 0) {
				this.listContainerEl.createDiv({
					text: t("emptySearchMessage"),
					cls: "folgezettel-empty-message",
				});
				return;
			}
		}

		// Pre-calculate existing IDs for quick sibling check
		const existingIds = new Set<string>(nodes.map(n => n.id.toLowerCase()));

		let lastMajor: number | null = null;

		for (const node of nodes) {
			// If filtering is active, skip non-matching and non-ancestor nodes
			if (visibleNodeIds && !visibleNodeIds.has(node.id)) {
				continue;
			}

			// Render thread header box before first node of each major group
			if (lastMajor !== node.major) {
				const majorStr = String(node.major);
				const currentLabel = this.plugin?.settings?.threadLabels?.[majorStr] || "";
				const hasLabel = currentLabel.length > 0;
				const isThreadCollapsed = this.collapsedThreads.has(node.major);

				const threadHeaderEl = this.listContainerEl.createDiv({
					cls: "folgezettel-thread-header",
				});

				const titleContainerEl = threadHeaderEl.createDiv({
					cls: "folgezettel-thread-title-container",
				});

				// Thread ID badge at the left of the title (e.g. [12])
				titleContainerEl.createSpan({
					cls: "folgezettel-thread-id",
					text: `[${node.major}]`,
				});

				// Heading element (shown when hasLabel is true)
				const headingEl = titleContainerEl.createEl("div", {
					cls: "folgezettel-thread-heading" + (hasLabel ? "" : " is-hidden"),
					text: currentLabel,
					attr: { title: t("clickToEditLabel") },
				});

				// Context menu on right click on thread header
				this.registerDomEvent(threadHeaderEl, "contextmenu", (evt: MouseEvent) => {
					evt.preventDefault();
					evt.stopPropagation();

					const menu = new Menu();

					// Find next available backbone note in this thread (major.1, major.2, etc.)
					let nextBackboneNum = 1;
					while (existingIds.has(`${node.major}.${nextBackboneNum}`)) {
						nextBackboneNum++;
					}
					const nextBackboneId = `${node.major}.${nextBackboneNum}`;

					// Option 1: Assign note to next backbone position
					menu.addItem((item) => {
						item.setTitle(t("assignNoteSiblingMenu", nextBackboneId))
							.setIcon("arrow-down-right")
							.onClick(() => {
								assignBranchNote(this.app, nextBackboneId, () => this.renderOutline());
							});
					});

					// Option 2: Continue thread with next backbone note
					menu.addItem((item) => {
						item.setTitle(t("continueThreadMenu", nextBackboneId))
							.setIcon("arrow-down")
							.onClick(() => {
								createBranchNote(this.app, nextBackboneId, () => this.renderOutline());
							});
					});

					// Option 3: Branch off root note (e.g. major.1) if it exists
					const rootNode = nodes.find((n) => n.id.toLowerCase() === `${node.major}.1`);
					if (rootNode) {
						const rootBranchId = getNextBranchId(rootNode.id, existingIds);
						menu.addSeparator();

						menu.addItem((item) => {
							item.setTitle(t("assignNoteBranchMenu", rootBranchId))
								.setIcon("git-branch")
								.onClick(() => {
									assignBranchNote(this.app, rootBranchId, () => this.renderOutline());
								});
						});

						menu.addItem((item) => {
							item.setTitle(t("createNoteBranchMenu", rootBranchId))
								.setIcon("plus")
								.onClick(() => {
									createBranchNote(this.app, rootBranchId, () => this.renderOutline());
								});
						});
					}

					// Option 4: Create next major thread
					menu.addSeparator();
					menu.addItem((item) => {
						item.setTitle(t("cmdCreateNextThread", this.nextThreadId))
							.setIcon("list-plus")
							.onClick(() => {
								this.createNewThread();
							});
					});

					menu.showAtMouseEvent(evt);
				});

				// Input field element (shown when hasLabel is false, or during edit)
				const inputEl = titleContainerEl.createEl("input", {
					type: "text",
					cls: "folgezettel-thread-label-input" + (hasLabel ? " is-hidden" : ""),
					attr: {
						placeholder: t("threadLabelPlaceholder", node.major),
						value: currentLabel,
						spellcheck: "false",
					},
				});

				// Collapse / expand chevron button at the far right
				const collapseBtn = threadHeaderEl.createDiv({
					cls: "clickable-icon folgezettel-thread-collapse-btn" + (isThreadCollapsed ? " is-collapsed" : ""),
					attr: { "aria-label": isThreadCollapsed ? t("expandThreadTooltip") : t("collapseThreadTooltip") },
				});
				setIcon(collapseBtn, "chevron-down");

				this.registerDomEvent(collapseBtn, "click", (e: MouseEvent) => {
					e.stopPropagation();
					if (this.collapsedThreads.has(node.major)) {
						this.collapsedThreads.delete(node.major);
					} else {
						this.collapsedThreads.add(node.major);
					}
					this.renderOutline();
				});

				// Click on heading activates edit mode
				this.registerDomEvent(headingEl, "click", (e: MouseEvent) => {
					e.stopPropagation();
					headingEl.addClass("is-hidden");
					inputEl.removeClass("is-hidden");
					inputEl.value = this.plugin?.settings?.threadLabels?.[majorStr] || "";
					inputEl.focus();
					inputEl.select();
				});

				let isSaving = false;
				const saveLabel = async () => {
					if (isSaving || !this.plugin) return;
					isSaving = true;
					try {
						const val = inputEl.value.trim();
						if (!this.plugin.settings.threadLabels) {
							this.plugin.settings.threadLabels = {};
						}
						if (val) {
							this.plugin.settings.threadLabels[majorStr] = val;
							headingEl.setText(val);
							inputEl.addClass("is-hidden");
							headingEl.removeClass("is-hidden");
						} else {
							delete this.plugin.settings.threadLabels[majorStr];
							headingEl.setText("");
							headingEl.addClass("is-hidden");
							inputEl.removeClass("is-hidden");
						}
						await this.plugin.saveSettings();
					} finally {
						isSaving = false;
					}
				};

				this.registerDomEvent(inputEl, "blur", saveLabel);
				this.registerDomEvent(inputEl, "keydown", (e: KeyboardEvent) => {
					if (e.key === "Enter") {
						inputEl.blur();
					} else if (e.key === "Escape") {
						const existingVal = this.plugin?.settings?.threadLabels?.[majorStr] || "";
						inputEl.value = existingVal;
						if (existingVal) {
							inputEl.addClass("is-hidden");
							headingEl.removeClass("is-hidden");
						} else {
							inputEl.blur();
						}
					}
				});
			}

			// Check if thread is collapsed
			if (this.collapsedThreads.has(node.major) && !query) {
				lastMajor = node.major;
				continue;
			}

			// Check if any ancestor is collapsed
			let isHiddenByCollapse = false;
			for (const potentialAncestor of nodes) {
				if (this.collapsedNodes.has(potentialAncestor.id) && isAncestorOf(potentialAncestor, node)) {
					isHiddenByCollapse = true;
					break;
				}
			}
			if (isHiddenByCollapse && !query) {
				lastMajor = node.major;
				continue;
			}

			const isNewTopic = lastMajor !== null && node.major !== lastMajor;
			lastMajor = node.major;

			const isCurrentActive = this.activeFilePath === node.file.path;
			const isDirectMatch = matchingNodeIds ? matchingNodeIds.has(node.id) : false;

			let itemClasses = "folgezettel-item";
			if (isNewTopic) itemClasses += " folgezettel-major-group-start";
			if (isCurrentActive) itemClasses += " is-active-note";
			if (isDirectMatch) itemClasses += " is-search-match";

			const itemEl = this.listContainerEl.createDiv({
				cls: itemClasses,
				attr: { "data-path": node.file.path },
			});

			// Prefix container: indent guide + [ID]
			const prefixEl = itemEl.createSpan({ cls: "folgezettel-prefix" });

			// Indentation and tree connector
			if (node.depth > 0) {
				const indentGuide = prefixEl.createSpan({ cls: "folgezettel-indent-guide" });
				indentGuide.setText("   ".repeat(node.depth - 1) + "└── ");
			}

			// Badge with [ID] (acts as collapse/expand toggle if node has children)
			const hasChildren = parentNodeIds.has(node.id);
			const isCollapsed = this.collapsedNodes.has(node.id);

			let idClasses = "folgezettel-node-id";
			if (hasChildren) {
				idClasses += " is-collapsible";
				if (isCollapsed) {
					idClasses += " is-collapsed";
				}
			}

			const idEl = prefixEl.createSpan({
				cls: idClasses,
				text: `[${node.id}] `,
				attr: hasChildren
					? { "aria-label": isCollapsed ? t("expandBranchTooltip") : t("collapseBranchTooltip") }
					: {},
			});

			if (hasChildren) {
				this.registerDomEvent(idEl, "click", (e: MouseEvent) => {
					e.stopPropagation();
					if (this.collapsedNodes.has(node.id)) {
						this.collapsedNodes.delete(node.id);
					} else {
						this.collapsedNodes.add(node.id);
					}
					this.renderOutline();
				});
			}

			// Title container (wraps cleanly under the start of title)
			const titleEl = itemEl.createSpan({
				cls: "folgezettel-node-title",
				text: node.title || "",
			});

			// Open file on click on title or row (excluding idEl if it has children)
			const handleOpenFile = (evt: MouseEvent) => {
				evt.preventDefault();
				const isNewLeaf = evt.ctrlKey || evt.metaKey;
				const leaf = this.app.workspace.getLeaf(isNewLeaf ? "tab" : false);
				leaf.openFile(node.file);
			};

			this.registerDomEvent(titleEl, "click", handleOpenFile);
			if (!hasChildren) {
				this.registerDomEvent(idEl, "click", handleOpenFile);
			}

			// Context menu on right click
			this.registerDomEvent(itemEl, "contextmenu", (evt: MouseEvent) => {
				evt.preventDefault();

				const targetBranchId = getNextBranchId(node.id, existingIds);
				const nextSibling = getNextSiblingId(node.id);
				const canContinueThread = nextSibling !== null && !existingIds.has(nextSibling.toLowerCase());

				const menu = new Menu();

				// Option 1: Asignar rama
				menu.addItem((item) => {
					item.setTitle(t("assignNoteBranchMenu", targetBranchId))
						.setIcon("git-branch")
						.onClick(() => {
							assignBranchNote(this.app, targetBranchId, () => this.renderOutline());
						});
				});

				// Option 2: Crear rama
				menu.addItem((item) => {
					item.setTitle(t("createNoteBranchMenu", targetBranchId))
						.setIcon("plus")
						.onClick(() => {
							createBranchNote(this.app, targetBranchId, () => this.renderOutline());
						});
				});

				// Option 3: Continuar hilo principal (sólo si está disponible en la columna vertebral)
				if (canContinueThread && nextSibling) {
					menu.addSeparator();

					menu.addItem((item) => {
						item.setTitle(t("assignNoteSiblingMenu", nextSibling))
							.setIcon("arrow-down-right")
							.onClick(() => {
								assignBranchNote(this.app, nextSibling, () => this.renderOutline());
							});
					});

					menu.addItem((item) => {
						item.setTitle(t("continueThreadMenu", nextSibling))
							.setIcon("arrow-down")
							.onClick(() => {
								createBranchNote(this.app, nextSibling, () => this.renderOutline());
							});
					});
				}

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

		// Footer: button to create new thread at the end of the list
		if (!query) {
			const footerEl = this.listContainerEl.createDiv({ cls: "folgezettel-footer" });
			const newThreadBtn = footerEl.createEl("button", {
				cls: "mod-cta folgezettel-new-thread-btn",
			});
			const iconSpan = newThreadBtn.createSpan({ cls: "folgezettel-btn-icon" });
			setIcon(iconSpan, "plus");
			newThreadBtn.createSpan({
				text: t("createThreadBtnText", this.nextThreadId),
			});

			this.registerDomEvent(newThreadBtn, "click", () => {
				this.createNewThread();
			});
		}
	}

	public getNextThreadId(): string {
		return this.nextThreadId;
	}

	public async createNewThread(): Promise<void> {
		const newFileName = `${this.nextThreadId}.md`;
		const newPath = `/${newFileName}`;

		try {
			let file = this.app.vault.getAbstractFileByPath(newPath);
			if (!file) {
				file = await this.app.vault.create(newPath, "");
			}

			if (file instanceof TFile) {
				new Notice(t("noticeNewThreadCreated", this.nextThreadId));
				this.renderOutline();
				// Open in new tab
				const newLeaf = this.app.workspace.getLeaf("tab");
				await newLeaf.openFile(file);
			}
		} catch (err) {
			console.error("Error al crear hilo Folgezettel:", err);
			new Notice(t("noticeErrorCreatingThread", err));
		}
	}

	public toggleSearchBar(): void {
		if (!this.searchContainerEl) return;
		const isHidden = this.searchContainerEl.hasClass("is-hidden");
		if (isHidden) {
			this.searchContainerEl.removeClass("is-hidden");
			this.searchInputEl.focus();
		} else {
			this.searchContainerEl.addClass("is-hidden");
			if (this.searchQuery) {
				this.searchQuery = "";
				this.searchInputEl.value = "";
				this.renderOutline();
			}
		}
	}

	public toggleCollapseAll(): void {
		const nodes = getFolgezettelNodes(this.app.vault);
		// Check which have children
		const parentIds: string[] = [];
		for (let i = 0; i < nodes.length; i++) {
			for (let j = 0; j < nodes.length; j++) {
				if (i !== j && isAncestorOf(nodes[i], nodes[j])) {
					parentIds.push(nodes[i].id);
					break;
				}
			}
		}

		if (this.collapsedNodes.size > 0 || this.collapsedThreads.size > 0) {
			// Expand all
			this.collapsedNodes.clear();
			this.collapsedThreads.clear();
		} else {
			// Collapse all parent nodes
			for (const id of parentIds) {
				this.collapsedNodes.add(id);
			}
		}
		this.renderOutline();
	}

	public setActiveFilePath(path: string | null): void {
		this.activeFilePath = path;
	}

	private handleActiveLeafChange(): void {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			// Do not clear the active note if switching to a non-file leaf like Folgezettel view itself
			return;
		}
		const newPath = activeFile.path;
		if (this.activeFilePath !== newPath) {
			this.activeFilePath = newPath;

			// Highlight active item without full re-render if possible
			if (this.listContainerEl) {
				const prevActive = this.listContainerEl.querySelector(".folgezettel-item.is-active-note");
				if (prevActive) {
					prevActive.removeClass("is-active-note");
				}

				if (newPath) {
					const newActiveEl = this.listContainerEl.querySelector(`[data-path="${CSS.escape(newPath)}"]`);
					if (newActiveEl) {
						newActiveEl.addClass("is-active-note");
					}
				}
			}

			// Smooth auto scroll to active note
			this.revealActiveNote(false);
		}
	}

	public revealActiveNote(forceExpandAndScroll: boolean = false): void {
		if (!this.activeFilePath || !this.listContainerEl) return;

		const targetPath = this.activeFilePath;
		const nodes = getFolgezettelNodes(this.app.vault);
		const targetNode = nodes.find(n => n.file.path === targetPath);

		if (!targetNode) return;

		// If hidden because an ancestor is collapsed, un-collapse ancestor
		if (forceExpandAndScroll) {
			let neededRerender = false;
			if (this.collapsedThreads.has(targetNode.major)) {
				this.collapsedThreads.delete(targetNode.major);
				neededRerender = true;
			}
			for (const potentialAncestor of nodes) {
				if (this.collapsedNodes.has(potentialAncestor.id) && isAncestorOf(potentialAncestor, targetNode)) {
					this.collapsedNodes.delete(potentialAncestor.id);
					neededRerender = true;
				}
			}
			if (neededRerender) {
				this.renderOutline();
			}
		}

		if (this.autoScrollTimeout) {
			window.clearTimeout(this.autoScrollTimeout);
		}

		this.autoScrollTimeout = window.setTimeout(() => {
			const itemEl = this.listContainerEl.querySelector(`[data-path="${CSS.escape(targetPath)}"]`) as HTMLElement;
			if (itemEl) {
				itemEl.scrollIntoView({ behavior: "smooth", block: "center" });
				itemEl.addClass("is-active-note");
			}
		}, 80);
	}

	async onClose(): Promise<void> {
		if (this.autoScrollTimeout) {
			window.clearTimeout(this.autoScrollTimeout);
		}
	}
}
