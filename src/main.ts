import { Plugin, WorkspaceLeaf, Notice, TFile, MarkdownView, Editor, PluginSettingTab, Setting, App } from "obsidian";
import { FolgezettelView, FOLGEZETTEL_VIEW_TYPE } from "./view";
import { getFolgezettelNodes, parseFolgezettelFile, getNextBranchId, getFortsetzungId, FolgezettelNode } from "./folgezettel";
import { assignBranchNote, createBranchNote } from "./actions";
import { ReferenceSuggestModal } from "./modal";
import { t, setLocaleSetting, LocaleSetting } from "./i18n";
import { SwitcherEnhancer } from "./switcher";

export interface FolgezettelSettings {
	threadLabels: Record<string, string>;
	locale: LocaleSetting;
	showRibbonOutline: boolean;
	showRibbonCreateBranch: boolean;
	showRibbonCreateParallel: boolean;
	showRibbonCreateThread: boolean;
	enhanceQuickSwitcher: boolean;
}

export const DEFAULT_SETTINGS: FolgezettelSettings = {
	threadLabels: {},
	locale: "auto",
	showRibbonOutline: true,
	showRibbonCreateBranch: true,
	showRibbonCreateParallel: true,
	showRibbonCreateThread: true,
	enhanceQuickSwitcher: true,
};

export default class FolgezettelPlugin extends Plugin {
	settings: FolgezettelSettings;
	private ribbonOutlineEl: HTMLElement | null = null;
	private ribbonCreateBranchEl: HTMLElement | null = null;
	private ribbonCreateParallelEl: HTMLElement | null = null;
	private ribbonCreateThreadEl: HTMLElement | null = null;
	private switcherEnhancer: SwitcherEnhancer;

	async onload(): Promise<void> {
		await this.loadSettings();
		setLocaleSetting(this.settings.locale);

		this.switcherEnhancer = new SwitcherEnhancer(
			this.app,
			() => this.settings.enhanceQuickSwitcher !== false
		);
		this.switcherEnhancer.enable();

		this.registerView(
			FOLGEZETTEL_VIEW_TYPE,
			(leaf: WorkspaceLeaf) => new FolgezettelView(leaf, this)
		);

		// Ribbon 1: Open outline
		this.ribbonOutlineEl = this.addRibbonIcon("list", t("ribbonTooltip"), (evt: MouseEvent) => {
			if (evt.ctrlKey || evt.metaKey) {
				this.activateViewInSidebar();
			} else {
				this.activateViewInTab();
			}
		});

		// Ribbon 2: Create Verzweigung note (arrow-down-right)
		this.ribbonCreateBranchEl = this.addRibbonIcon(
			"arrow-down-right",
			t("ribbonVerzweigungTooltipDefault"),
			() => {
				const node = this.getActiveFolgezettelNode();
				if (!node) return;

				const nodes = getFolgezettelNodes(this.app.vault);
				const existingIds = new Set(nodes.map((n) => n.id.toLowerCase()));
				const targetBranchId = getNextBranchId(node.id, existingIds);

				createBranchNote(this.app, targetBranchId, () => {
					const view = this.getView();
					if (view) view.renderOutline();
					this.updateRibbonButtons();
				});
			}
		);

		// Ribbon 3: Create Fortsetzung note (arrow-down)
		this.ribbonCreateParallelEl = this.addRibbonIcon(
			"arrow-down",
			t("ribbonFortsetzungTooltipDefault"),
			() => {
				const node = this.getActiveFolgezettelNode();
				if (!node) return;

				const nodes = getFolgezettelNodes(this.app.vault);
				const existingIds = new Set(nodes.map((n) => n.id.toLowerCase()));
				const fortsetzungId = getFortsetzungId(node);
				if (!fortsetzungId || existingIds.has(fortsetzungId.toLowerCase())) {
					return;
				}

				createBranchNote(this.app, fortsetzungId, () => {
					const view = this.getView();
					if (view) view.renderOutline();
					this.updateRibbonButtons();
				});
			}
		);

		// Ribbon 4: Create thread (list-plus)
		this.ribbonCreateThreadEl = this.addRibbonIcon(
			"list-plus",
			t("ribbonCreateThreadTooltipDefault"),
			() => {
				const view = this.getView();
				const threadId = view ? view.getNextThreadId() : this.computeNextThreadIdFallback();
				if (view) {
					view.createNewThread();
				} else {
					this.createThreadByFallback(threadId);
				}
				this.updateRibbonButtons();
			}
		);

		this.updateRibbonVisibility();

		// Command palette: Open in a new tab
		this.addCommand({
			id: "open-folgezettel-tab",
			name: t("cmdOpenTab"),
			callback: () => {
				this.activateViewInTab();
			},
		});

		// Command palette: Open in right sidebar
		this.addCommand({
			id: "open-folgezettel-sidebar",
			name: t("cmdOpenSidebar"),
			callback: () => {
				this.activateViewInSidebar();
			},
		});

		// Command palette: Colapsar / Expandir todo
		this.addCommand({
			id: "folgezettel-toggle-collapse-all",
			name: t("cmdToggleCollapseAll"),
			callback: async () => {
				const view = await this.getOrCreateView();
				if (view) {
					view.toggleCollapseAll();
				}
			},
		});

		// Command palette: Crear hilo [num]
		const cmdCreateThread = this.addCommand({
			id: "folgezettel-create-next-thread",
			name: t("cmdCreateNextThreadDefault"),
			checkCallback: (checking: boolean) => {
				const view = this.getView();
				const threadId = view ? view.getNextThreadId() : this.computeNextThreadIdFallback();
				cmdCreateThread.name = `${this.manifest.name}: ${t("cmdCreateNextThread", threadId)}`;
				if (checking) return true;

				if (view) {
					view.createNewThread();
				} else {
					this.createThreadByFallback(threadId);
				}
				return true;
			},
		});

		// Command palette: Actualizar esquema
		this.addCommand({
			id: "folgezettel-refresh-outline",
			name: t("cmdRefreshOutline"),
			callback: async () => {
				const view = await this.getOrCreateView();
				if (view) {
					view.renderOutline();
				}
			},
		});

		// Command palette: Insertar referencia
		this.addCommand({
			id: "folgezettel-insert-reference",
			name: t("cmdInsertReference"),
			icon: "link",
			editorCallback: (editor: Editor) => {
				const nodes = getFolgezettelNodes(this.app.vault);
				if (nodes.length === 0) {
					new Notice(t("noticeNoFolgezettelNotesFound"));
					return;
				}

				const modal = new ReferenceSuggestModal(this.app, nodes, (node: FolgezettelNode) => {
					const linkText = `[[${node.file.basename}|${node.id}]]`;
					editor.replaceSelection(linkText);
				});

				modal.open();
			},
		});

		// Active note contextual commands:
		// 1. Asignar rama
		const cmdAssignBranch = this.addCommand({
			id: "folgezettel-assign-branch-active",
			name: t("cmdAssignBranchActiveDefault"),
			icon: "git-branch",
			checkCallback: (checking: boolean) => {
				const node = this.getActiveFolgezettelNode();
				if (!node) return false;

				const nodes = getFolgezettelNodes(this.app.vault);
				const existingIds = new Set(nodes.map((n) => n.id.toLowerCase()));
				const targetBranchId = getNextBranchId(node.id, existingIds);

				cmdAssignBranch.name = `${this.manifest.name}: ${t("cmdAssignBranchActive", targetBranchId)}`;
				if (checking) return true;

				assignBranchNote(this.app, targetBranchId, () => {
					const view = this.getView();
					if (view) view.renderOutline();
				});
				return true;
			},
		});

		// 2. Crear rama
		const cmdCreateBranch = this.addCommand({
			id: "folgezettel-create-branch-active",
			name: t("cmdCreateBranchActiveDefault"),
			icon: "plus",
			checkCallback: (checking: boolean) => {
				const node = this.getActiveFolgezettelNode();
				if (!node) return false;

				const nodes = getFolgezettelNodes(this.app.vault);
				const existingIds = new Set(nodes.map((n) => n.id.toLowerCase()));
				const targetBranchId = getNextBranchId(node.id, existingIds);

				cmdCreateBranch.name = `${this.manifest.name}: ${t("cmdCreateBranchActive", targetBranchId)}`;
				if (checking) return true;

				createBranchNote(this.app, targetBranchId, () => {
					const view = this.getView();
					if (view) view.renderOutline();
				});
				return true;
			},
		});

		// 3. Asignar como Fortsetzung
		const cmdAssignSibling = this.addCommand({
			id: "folgezettel-assign-sibling-active",
			name: t("cmdAssignSiblingActiveDefault"),
			icon: "arrow-down",
			checkCallback: (checking: boolean) => {
				const node = this.getActiveFolgezettelNode();
				if (!node) return false;

				const fortsetzungId = getFortsetzungId(node);
				const nodes = getFolgezettelNodes(this.app.vault);
				const existingIds = new Set(nodes.map((n) => n.id.toLowerCase()));
				if (!fortsetzungId || existingIds.has(fortsetzungId.toLowerCase())) return false;

				cmdAssignSibling.name = `${this.manifest.name}: ${t("cmdAssignSiblingActive", fortsetzungId)}`;
				if (checking) return true;

				assignBranchNote(this.app, fortsetzungId, () => {
					const view = this.getView();
					if (view) view.renderOutline();
					this.updateRibbonButtons();
				});
				return true;
			},
		});

		// 4. Continuar con Fortsetzung
		const cmdCreateSibling = this.addCommand({
			id: "folgezettel-continue-thread-active",
			name: t("cmdContinueThreadActiveDefault"),
			icon: "arrow-down",
			checkCallback: (checking: boolean) => {
				const node = this.getActiveFolgezettelNode();
				if (!node) return false;

				const fortsetzungId = getFortsetzungId(node);
				const nodes = getFolgezettelNodes(this.app.vault);
				const existingIds = new Set(nodes.map((n) => n.id.toLowerCase()));
				if (!fortsetzungId || existingIds.has(fortsetzungId.toLowerCase())) return false;

				cmdCreateSibling.name = `${this.manifest.name}: ${t("cmdContinueThreadActive", fortsetzungId)}`;
				if (checking) return true;

				createBranchNote(this.app, fortsetzungId, () => {
					const view = this.getView();
					if (view) view.renderOutline();
					this.updateRibbonButtons();
				});
				return true;
			},
		});

		const updateActiveCommands = () => {
			const view = this.getView();
			const threadId = view ? view.getNextThreadId() : this.computeNextThreadIdFallback();
			cmdCreateThread.name = `${this.manifest.name}: ${t("cmdCreateNextThread", threadId)}`;

			const node = this.getActiveFolgezettelNode();
			if (!node) {
				cmdAssignBranch.name = `${this.manifest.name}: ${t("cmdAssignBranchActiveDefault")}`;
				cmdCreateBranch.name = `${this.manifest.name}: ${t("cmdCreateBranchActiveDefault")}`;
				cmdAssignSibling.name = `${this.manifest.name}: ${t("cmdAssignSiblingActiveDefault")}`;
				cmdCreateSibling.name = `${this.manifest.name}: ${t("cmdContinueThreadActiveDefault")}`;
			} else {
				const nodes = getFolgezettelNodes(this.app.vault);
				const existingIds = new Set(nodes.map((n) => n.id.toLowerCase()));
				const targetBranchId = getNextBranchId(node.id, existingIds);
				const fortsetzungId = getFortsetzungId(node);
				const isFortsetzungTaken = existingIds.has(fortsetzungId.toLowerCase());

				cmdAssignBranch.name = `${this.manifest.name}: ${t("cmdAssignBranchActive", targetBranchId)}`;
				cmdCreateBranch.name = `${this.manifest.name}: ${t("cmdCreateBranchActive", targetBranchId)}`;

				if (!isFortsetzungTaken) {
					cmdAssignSibling.name = `${this.manifest.name}: ${t("cmdAssignSiblingActive", fortsetzungId)}`;
					cmdCreateSibling.name = `${this.manifest.name}: ${t("cmdContinueThreadActive", fortsetzungId)}`;
				} else {
					cmdAssignSibling.name = `${this.manifest.name}: ${t("cmdAssignSiblingActiveDefault")}`;
					cmdCreateSibling.name = `${this.manifest.name}: ${t("cmdContinueThreadActiveDefault")}`;
				}
			}

			this.updateRibbonButtons();
		};

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				updateActiveCommands();
			})
		);
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				updateActiveCommands();
			})
		);
		this.registerEvent(
			this.app.vault.on("create", () => {
				updateActiveCommands();
			})
		);
		this.registerEvent(
			this.app.vault.on("delete", () => {
				updateActiveCommands();
			})
		);
		this.registerEvent(
			this.app.vault.on("rename", () => {
				updateActiveCommands();
			})
		);

		updateActiveCommands();

		this.addSettingTab(new FolgezettelSettingTab(this.app, this));
	}

	private setRibbonBtnEnabled(el: HTMLElement | null, enabled: boolean): void {
		if (!el) return;
		if (enabled) {
			el.removeClass("is-disabled");
			el.style.opacity = "";
			el.style.pointerEvents = "";
			el.removeAttribute("aria-disabled");
		} else {
			el.addClass("is-disabled");
			el.style.opacity = "0.35";
			el.style.pointerEvents = "none";
			el.setAttribute("aria-disabled", "true");
		}
	}

	public updateRibbonButtons(): void {
		const nodes = getFolgezettelNodes(this.app.vault);
		const existingIds = new Set(nodes.map((n) => n.id.toLowerCase()));

		// 1. Thread button
		const view = this.getView();
		const threadId = view ? view.getNextThreadId() : this.computeNextThreadIdFallback();
		if (this.ribbonCreateThreadEl) {
			this.ribbonCreateThreadEl.setAttribute(
				"aria-label",
				t("ribbonCreateThreadTooltip", threadId)
			);
		}

		// 2 & 3: Verzweigung and Fortsetzung buttons
		const node = this.getActiveFolgezettelNode();
		if (!node) {
			if (this.ribbonCreateBranchEl) {
				this.ribbonCreateBranchEl.setAttribute(
					"aria-label",
					t("ribbonVerzweigungTooltipDefault")
				);
				this.setRibbonBtnEnabled(this.ribbonCreateBranchEl, false);
			}
			if (this.ribbonCreateParallelEl) {
				this.ribbonCreateParallelEl.setAttribute(
					"aria-label",
					t("ribbonFortsetzungTooltipDefault")
				);
				this.setRibbonBtnEnabled(this.ribbonCreateParallelEl, false);
			}
		} else {
			const targetBranchId = getNextBranchId(node.id, existingIds);
			if (this.ribbonCreateBranchEl) {
				this.ribbonCreateBranchEl.setAttribute(
					"aria-label",
					t("ribbonVerzweigungTooltip", targetBranchId)
				);
				this.setRibbonBtnEnabled(this.ribbonCreateBranchEl, true);
			}

			const fortsetzungId = getFortsetzungId(node);
			const isFortsetzungTaken = existingIds.has(fortsetzungId.toLowerCase());
			if (this.ribbonCreateParallelEl) {
				if (isFortsetzungTaken) {
					this.ribbonCreateParallelEl.setAttribute(
						"aria-label",
						t("ribbonFortsetzungTooltipExists", fortsetzungId)
					);
					this.setRibbonBtnEnabled(this.ribbonCreateParallelEl, false);
				} else {
					this.ribbonCreateParallelEl.setAttribute(
						"aria-label",
						t("ribbonFortsetzungTooltip", fortsetzungId)
					);
					this.setRibbonBtnEnabled(this.ribbonCreateParallelEl, true);
				}
			}
		}
	}

	updateRibbonVisibility(): void {
		if (this.ribbonOutlineEl) {
			this.ribbonOutlineEl.style.display = this.settings.showRibbonOutline !== false ? "" : "none";
		}
		if (this.ribbonCreateBranchEl) {
			const showBranch = this.settings.showRibbonCreateBranch ?? (this.settings as any).showRibbonCreateNote ?? true;
			this.ribbonCreateBranchEl.style.display = showBranch ? "" : "none";
		}
		if (this.ribbonCreateParallelEl) {
			this.ribbonCreateParallelEl.style.display = this.settings.showRibbonCreateParallel !== false ? "" : "none";
		}
		if (this.ribbonCreateThreadEl) {
			this.ribbonCreateThreadEl.style.display = this.settings.showRibbonCreateThread !== false ? "" : "none";
		}
	}

	private getActiveFolgezettelNode(): FolgezettelNode | null {
		let activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView && activeView.file) {
				activeFile = activeView.file;
			}
		}
		if (!activeFile) return null;
		return parseFolgezettelFile(activeFile);
	}

	onunload(): void {
		// Detach leaves when plugin disabled
		this.app.workspace.detachLeavesOfType(FOLGEZETTEL_VIEW_TYPE);
		if (this.switcherEnhancer) {
			this.switcherEnhancer.disable();
		}
	}

	async activateViewInTab(): Promise<void> {
		const { workspace } = this.app;
		const activeFile = this.app.workspace.getActiveFile();

		// Check if there is already a leaf open with this view type
		const leaves = workspace.getLeavesOfType(FOLGEZETTEL_VIEW_TYPE);
		let targetLeaf: WorkspaceLeaf | null = null;

		// Prefer existing leaf in workspace tabs
		for (const l of leaves) {
			if (l.getRoot() === workspace.rootSplit) {
				targetLeaf = l;
				break;
			}
		}

		if (!targetLeaf && leaves.length > 0) {
			targetLeaf = leaves[0];
		}

		if (targetLeaf) {
			workspace.revealLeaf(targetLeaf);
			if (targetLeaf.view instanceof FolgezettelView) {
				if (activeFile) {
					targetLeaf.view.setActiveFilePath(activeFile.path);
				}
				targetLeaf.view.revealActiveNote(true);
			}
			return;
		}

		// Otherwise, open as a standard workspace tab
		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({
			type: FOLGEZETTEL_VIEW_TYPE,
			active: true,
		});
		workspace.revealLeaf(leaf);

		if (leaf.view instanceof FolgezettelView) {
			if (activeFile) {
				leaf.view.setActiveFilePath(activeFile.path);
			}
			leaf.view.revealActiveNote(true);
		}
	}

	async activateViewInSidebar(): Promise<void> {
		const { workspace } = this.app;
		const activeFile = this.app.workspace.getActiveFile();

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(FOLGEZETTEL_VIEW_TYPE);

		// Check if there is already a leaf in one of the sidebars
		for (const l of leaves) {
			if (l.getRoot() !== workspace.rootSplit) {
				leaf = l;
				break;
			}
		}

		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({
					type: FOLGEZETTEL_VIEW_TYPE,
					active: true,
				});
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
			if (leaf.view instanceof FolgezettelView) {
				if (activeFile) {
					leaf.view.setActiveFilePath(activeFile.path);
				}
				leaf.view.revealActiveNote(true);
			}
		}
	}

	private getView(): FolgezettelView | null {
		const leaves = this.app.workspace.getLeavesOfType(FOLGEZETTEL_VIEW_TYPE);
		if (leaves.length > 0 && leaves[0].view instanceof FolgezettelView) {
			return leaves[0].view;
		}
		return null;
	}

	private async getOrCreateView(): Promise<FolgezettelView | null> {
		const existing = this.getView();
		if (existing) {
			return existing;
		}
		await this.activateViewInTab();
		return this.getView();
	}

	private computeNextThreadIdFallback(): string {
		const nodes = getFolgezettelNodes(this.app.vault);
		let maxMajor = 0;
		for (const node of nodes) {
			if (node.major > maxMajor) {
				maxMajor = node.major;
			}
		}
		return `${maxMajor + 1}.1`;
	}

	private async createThreadByFallback(threadId: string): Promise<void> {
		const newPath = `/${threadId}.md`;
		try {
			let file = this.app.vault.getAbstractFileByPath(newPath);
			if (!file) {
				file = await this.app.vault.create(newPath, "");
			}
			if (file instanceof TFile) {
				new Notice(t("noticeNewThreadCreated", threadId));
				const newLeaf = this.app.workspace.getLeaf("tab");
				await newLeaf.openFile(file);
			}
		} catch (err) {
			new Notice(t("noticeErrorCreatingThread", err));
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}

class FolgezettelSettingTab extends PluginSettingTab {
	plugin: FolgezettelPlugin;

	constructor(app: App, plugin: FolgezettelPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName(t("settingsLanguageName"))
			.setDesc(t("settingsLanguageDesc"))
			.addDropdown((dropdown) => {
				dropdown
					.addOption("auto", t("settingsLanguageAuto"))
					.addOption("es", t("settingsLanguageEs"))
					.addOption("en", t("settingsLanguageEn"))
					.setValue(this.plugin.settings.locale || "auto")
					.onChange(async (val: string) => {
						this.plugin.settings.locale = val as LocaleSetting;
						setLocaleSetting(this.plugin.settings.locale);
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl).setName(t("settingsRibbonHeading")).setHeading();

		new Setting(containerEl)
			.setName(t("settingsRibbonOutline"))
			.setDesc(t("settingsRibbonOutlineDesc"))
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showRibbonOutline !== false)
					.onChange(async (val: boolean) => {
						this.plugin.settings.showRibbonOutline = val;
						await this.plugin.saveSettings();
						this.plugin.updateRibbonVisibility();
					});
			});

		new Setting(containerEl)
			.setName(t("settingsRibbonCreateBranch"))
			.setDesc(t("settingsRibbonCreateBranchDesc"))
			.addToggle((toggle) => {
				const current = this.plugin.settings.showRibbonCreateBranch ?? (this.plugin.settings as any).showRibbonCreateNote ?? true;
				toggle
					.setValue(current)
					.onChange(async (val: boolean) => {
						this.plugin.settings.showRibbonCreateBranch = val;
						await this.plugin.saveSettings();
						this.plugin.updateRibbonVisibility();
					});
			});

		new Setting(containerEl)
			.setName(t("settingsRibbonCreateParallel"))
			.setDesc(t("settingsRibbonCreateParallelDesc"))
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showRibbonCreateParallel !== false)
					.onChange(async (val: boolean) => {
						this.plugin.settings.showRibbonCreateParallel = val;
						await this.plugin.saveSettings();
						this.plugin.updateRibbonVisibility();
					});
			});

		new Setting(containerEl)
			.setName(t("settingsRibbonCreateThread"))
			.setDesc(t("settingsRibbonCreateThreadDesc"))
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.showRibbonCreateThread !== false)
					.onChange(async (val: boolean) => {
						this.plugin.settings.showRibbonCreateThread = val;
						await this.plugin.saveSettings();
						this.plugin.updateRibbonVisibility();
					});
			});

		new Setting(containerEl).setName(t("settingsQuickSwitcherHeading")).setHeading();

		new Setting(containerEl)
			.setName(t("settingsEnhanceQuickSwitcher"))
			.setDesc(t("settingsEnhanceQuickSwitcherDesc"))
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.enhanceQuickSwitcher !== false)
					.onChange(async (val: boolean) => {
						this.plugin.settings.enhanceQuickSwitcher = val;
						await this.plugin.saveSettings();
					});
			});
	}
}
