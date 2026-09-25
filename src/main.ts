import { Plugin, WorkspaceLeaf } from "obsidian";
import { FolgezettelView, FOLGEZETTEL_VIEW_TYPE } from "./view";

export default class FolgezettelPlugin extends Plugin {
	async onload(): Promise<void> {
		this.registerView(
			FOLGEZETTEL_VIEW_TYPE,
			(leaf: WorkspaceLeaf) => new FolgezettelView(leaf)
		);

		// Ribbon icon in left sidebar: click opens in tab, or focuses existing
		this.addRibbonIcon("list", "Folgezettel: Abrir esquema", (evt: MouseEvent) => {
			if (evt.ctrlKey || evt.metaKey) {
				this.activateViewInSidebar();
			} else {
				this.activateViewInTab();
			}
		});

		// Command palette: Open in a new tab
		this.addCommand({
			id: "open-folgezettel-tab",
			name: "Abrir esquema en una pestaña",
			callback: () => {
				this.activateViewInTab();
			},
		});

		// Command palette: Open in right sidebar
		this.addCommand({
			id: "open-folgezettel-sidebar",
			name: "Abrir esquema en la barra lateral",
			callback: () => {
				this.activateViewInSidebar();
			},
		});
	}

	onunload(): void {
		// Detach leaves when plugin disabled
		this.app.workspace.detachLeavesOfType(FOLGEZETTEL_VIEW_TYPE);
	}

	async activateViewInTab(): Promise<void> {
		const { workspace } = this.app;
		// Open as a standard workspace tab
		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({
			type: FOLGEZETTEL_VIEW_TYPE,
			active: true,
		});
		workspace.revealLeaf(leaf);
	}

	async activateViewInSidebar(): Promise<void> {
		const { workspace } = this.app;

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
		}
	}
}
