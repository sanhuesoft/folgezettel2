import { TFile, Vault } from "obsidian";

export interface FolgezettelNode {
	file: TFile;
	id: string;
	title: string;
	major: number;
	tokens: string[];
	depth: number;
}

export function parseFolgezettelId(idStr: string): { major: number; tokens: string[] } {
	const dotIndex = idStr.indexOf(".");
	if (dotIndex === -1) {
		const major = parseInt(idStr, 10);
		return { major: isNaN(major) ? 0 : major, tokens: [] };
	}

	const major = parseInt(idStr.slice(0, dotIndex), 10);
	const rest = idStr.slice(dotIndex + 1);
	const tokens: string[] = [];
	const regex = /([0-9]+|[a-zA-Z]+)/g;
	let match;
	while ((match = regex.exec(rest)) !== null) {
		tokens.push(match[1].toLowerCase());
	}

	return {
		major: isNaN(major) ? 0 : major,
		tokens,
	};
}

export function parseFolgezettelFile(file: TFile): FolgezettelNode | null {
	// Only files in vault root: file.parent is vault root ("/")
	if (file.parent && file.parent.path !== "/" && file.parent.path !== "") {
		return null;
	}

	// Filename must start with a digit and be .md
	if (!file.extension || file.extension.toLowerCase() !== "md") {
		return null;
	}

	const baseName = file.basename;
	const match = baseName.match(/^([0-9]+(?:\.[0-9]+[a-z0-9]*)?)(?:\s+(.*))?$/i);
	if (!match) {
		return null;
	}

	const id = match[1];
	const title = (match[2] || "").trim();
	const { major, tokens } = parseFolgezettelId(id);

	// Depth: 7.6 (1 token "6") has depth 0 (main thread)
	// 7.6a (2 tokens "6","a") has depth 1 (digression / sub-thread)
	// 7.6a1 (3 tokens "6","a","1") has depth 2
	// If only integer id like "7", depth is 0
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

export function compareFolgezettelNodes(a: FolgezettelNode, b: FolgezettelNode): number {
	if (a.major !== b.major) {
		return a.major - b.major;
	}

	const maxLen = Math.max(a.tokens.length, b.tokens.length);
	for (let i = 0; i < maxLen; i++) {
		if (a.tokens[i] === undefined) return -1;
		if (b.tokens[i] === undefined) return 1;

		const tA = a.tokens[i];
		const tB = b.tokens[i];
		const isNumA = /^\d+$/.test(tA);
		const isNumB = /^\d+$/.test(tB);

		if (isNumA && isNumB) {
			const diff = parseInt(tA, 10) - parseInt(tB, 10);
			if (diff !== 0) return diff;
		} else {
			const diff = tA.localeCompare(tB);
			if (diff !== 0) return diff;
		}
	}

	return a.title.localeCompare(b.title);
}

export function getFolgezettelNodes(vault: Vault): FolgezettelNode[] {
	const markdownFiles = vault.getMarkdownFiles();
	const nodes: FolgezettelNode[] = [];

	for (const file of markdownFiles) {
		const node = parseFolgezettelFile(file);
		if (node) {
			nodes.push(node);
		}
	}

	nodes.sort(compareFolgezettelNodes);
	return nodes;
}

export function getNextBranchId(parentId: string, existingIds: Set<string>): string {
	const lastChar = parentId.slice(-1);
	const endsWithDigit = /\d/.test(lastChar);

	if (endsWithDigit) {
		// Parent ends in digit (e.g. 2.2, 7.6a1) -> branch with letters: a, b, c, ...
		for (let i = 0; i < 26; i++) {
			const letter = String.fromCharCode(97 + i);
			const candidate = `${parentId}${letter}`;
			if (!existingIds.has(candidate.toLowerCase())) {
				return candidate;
			}
		}
		// If a-z are exhausted, continue with aa, ab...
		for (let i = 0; i < 26; i++) {
			for (let j = 0; j < 26; j++) {
				const candidate = `${parentId}${String.fromCharCode(97 + i)}${String.fromCharCode(97 + j)}`;
				if (!existingIds.has(candidate.toLowerCase())) {
					return candidate;
				}
			}
		}
	} else {
		// Parent ends in letter (e.g. 2.2a, 3.1b) -> branch with digits: 1, 2, 3, ...
		for (let i = 1; i <= 9999; i++) {
			const candidate = `${parentId}${i}`;
			if (!existingIds.has(candidate.toLowerCase())) {
				return candidate;
			}
		}
	}

	return `${parentId}a`;
}
