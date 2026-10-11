import { App, TFile, SuggestModal, Modal } from "obsidian";
import { FolgezettelNode, parseFolgezettelId, compareFolgezettelNodes } from "./folgezettel";

function isRootFile(file: TFile): boolean {
	if (!file.path) return true;
	// If path has no slash or starts with slash without subdirectories, it is at root
	if (!file.path.includes("/") || file.path.indexOf("/") === file.path.length - 1) return true;
	if (file.parent) {
		if (typeof (file.parent as any).isRoot === "function") {
			return (file.parent as any).isRoot();
		}
		return file.parent.path === "/" || file.parent.path === "";
	}
	// Path like "note.md"
	const parts = file.path.split("/");
	return parts.length <= 1;
}

function parseNodeFromFile(file: TFile): FolgezettelNode | null {
	if (!isRootFile(file)) return null;
	if (!file.extension || file.extension.toLowerCase() !== "md") return null;

	const baseName = file.basename;
	const match = baseName.match(/^([0-9]+(?:\.[0-9]+[a-z0-9]*)?)(?:\s+(.*))?$/i);
	if (!match) return null;

	const id = match[1];
	const title = (match[2] || "").trim();
	const { major, tokens } = parseFolgezettelId(id);
	const depth = Math.max(0, tokens.length - 1);

	return {
		file,
		id,
		title,
		major,
		tokens,
		depth,
	};
}

function getFileFromSuggestion(sug: any): TFile | null {
	if (!sug) return null;
	if (sug instanceof TFile) return sug;
	if (sug.file instanceof TFile) return sug.file;
	if (sug.item instanceof TFile) return sug.item;
	if (sug.item?.file instanceof TFile) return sug.item.file;
	if (typeof sug.path === "string" && typeof sug.basename === "string") return sug as TFile;
	if (sug.file && typeof sug.file.path === "string" && typeof sug.file.basename === "string") return sug.file as TFile;
	if (sug.item && typeof sug.item.path === "string" && typeof sug.item.basename === "string") return sug.item as TFile;
	return null;
}

export function reorderFolgezettelSuggestions(items: any[], query: string): any[] {
	if (!Array.isArray(items) || items.length === 0) return items;

	const cleanQuery = (query || "").trim().toLowerCase();
	if (!cleanQuery) return items;

	// Check if query is or starts with a Folgezettel ID pattern (e.g. "12.1", "12.1b", "12")
	const idMatch = cleanQuery.match(/^([0-9]+(?:\.[0-9]+[a-z0-9]*)?)/);
	if (!idMatch) return items;

	const targetId = idMatch[1];

	// Map suggestions to Folgezettel nodes
	const folgezettelItems = new Map<any, FolgezettelNode>();
	for (const item of items) {
		const file = getFileFromSuggestion(item);
		if (file) {
			const node = parseNodeFromFile(file);
			if (node) {
				folgezettelItems.set(item, node);
			}
		}
	}

	if (folgezettelItems.size === 0) return items;

	return items.slice().sort((a, b) => {
		const nodeA = folgezettelItems.get(a);
		const nodeB = folgezettelItems.get(b);

		const idA = nodeA ? nodeA.id.toLowerCase() : "";
		const idB = nodeB ? nodeB.id.toLowerCase() : "";

		// 1. Exact ID match (e.g. "12.1" or "12.1b")
		const aExact = nodeA ? (idA === cleanQuery || idA === targetId) : false;
		const bExact = nodeB ? (idB === cleanQuery || idB === targetId) : false;
		if (aExact && !bExact) return -1;
		if (!aExact && bExact) return 1;

		// 2. ID prefix match: nodes whose ID begins with targetId
		const aPrefix = nodeA ? idA.startsWith(targetId) : false;
		const bPrefix = nodeB ? idB.startsWith(targetId) : false;
		if (aPrefix && !bPrefix) return -1;
		if (!aPrefix && bPrefix) return 1;

		// 3. Both are Folgezettel notes starting with the target ID:
		// Sort hierarchically using compareFolgezettelNodes!
		if (nodeA && nodeB && aPrefix && bPrefix) {
			return compareFolgezettelNodes(nodeA, nodeB);
		}

		return 0;
	});
}

export class SwitcherEnhancer {
	private app: App;
	private isEnabled: () => boolean;
	private cleanups: (() => void)[] = [];

	constructor(app: App, isEnabled: () => boolean) {
		this.app = app;
		this.isEnabled = isEnabled;
	}

	enable(): void {
		if (this.cleanups.length > 0) return;

		const isEnabled = this.isEnabled;

		const patchGetSuggestions = (modal: any) => {
			if (!modal || modal.__folgezettelPatched) return;
			const original = modal.getSuggestions;
			if (typeof original !== "function") return;

			modal.__folgezettelPatched = true;
			modal.getSuggestions = function (query: string, ...args: any[]) {
				const result = original.apply(this, [query, ...args]);
				if (!isEnabled()) return result;

				if (result instanceof Promise) {
					return result.then((items) => reorderFolgezettelSuggestions(items, query));
				}
				return reorderFolgezettelSuggestions(result, query);
			};
		};

		// 1. Hook SuggestModal.prototype.open
		try {
			const originalSuggestOpen = SuggestModal.prototype.open;
			SuggestModal.prototype.open = function (...args: any[]) {
				try {
					patchGetSuggestions(this);
				} catch (e) {}
				return originalSuggestOpen.apply(this, args);
			};
			this.cleanups.push(() => {
				SuggestModal.prototype.open = originalSuggestOpen;
			});
		} catch (e) {
			console.error("Error hooking SuggestModal.prototype.open:", e);
		}

		// 2. Hook Modal.prototype.open in case the switcher modal class overrides SuggestModal
		try {
			const originalModalOpen = Modal.prototype.open;
			Modal.prototype.open = function (...args: any[]) {
				try {
					if (typeof (this as any).getSuggestions === "function") {
						patchGetSuggestions(this);
					}
				} catch (e) {}
				return originalModalOpen.apply(this, args);
			};
			this.cleanups.push(() => {
				Modal.prototype.open = originalModalOpen;
			});
		} catch (e) {
			console.error("Error hooking Modal.prototype.open:", e);
		}

		// 3. Hook switcher:open command callback to ensure any instance is caught
		try {
			const cmd = (this.app as any).commands?.commands?.["switcher:open"];
			if (cmd && typeof cmd.callback === "function") {
				const origCallback = cmd.callback;
				cmd.callback = function (...args: any[]) {
					const res = origCallback.apply(this, args);
					// Give event loop a microtick to patch the open modal
					setTimeout(() => {
						try {
							const openModals = document.querySelectorAll(".modal-container");
							openModals.forEach((m: any) => {
								if (m && m._modalInstance) {
									patchGetSuggestions(m._modalInstance);
								}
							});
						} catch (e) {}
					}, 0);
					return res;
				};
				this.cleanups.push(() => {
					cmd.callback = origCallback;
				});
			}
		} catch (e) {}
	}

	disable(): void {
		for (const cleanup of this.cleanups) {
			try {
				cleanup();
			} catch (e) {}
		}
		this.cleanups = [];
	}
}
