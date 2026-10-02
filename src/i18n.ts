import { getLanguage } from "obsidian";

export type LocaleSetting = "auto" | "es" | "en";

let activeSetting: LocaleSetting = "auto";

export function setLocaleSetting(setting: LocaleSetting): void {
	activeSetting = setting;
}

export function getEffectiveLocale(): "es" | "en" {
	if (activeSetting === "es" || activeSetting === "en") {
		return activeSetting;
	}

	let lang = "";
	try {
		if (typeof getLanguage === "function") {
			lang = getLanguage() || "";
		}
	} catch (e) {}

	if (!lang && typeof window !== "undefined") {
		lang =
			window.localStorage.getItem("language") ||
			(window as any).moment?.locale() ||
			navigator.language ||
			"";
	}

	return lang.toLowerCase().startsWith("es") ? "es" : "en";
}

const STRINGS = {
	es: {
		// General & View
		viewTitle: "Folgezettel",
		ribbonTooltip: "Folgezettel: Abrir esquema",
		emptyVaultMessage: "No se encontraron notas Folgezettel en la raíz.",
		emptySearchMessage: "No hay notas que coincidan con la búsqueda.",

		// Header Buttons
		locateActiveNoteTooltip: "Localizar nota activa en el árbol",
		collapseAllTooltip: "Colapsar / Expandir todo",
		searchNotesTooltip: "Buscar notas (Cmd/Ctrl + F)",
		searchPlaceholder: "Escribe para buscar...",
		searchClearTooltip: "Limpiar búsqueda",
		createThreadTooltip: (id: string) => `Crear hilo ${id}`,
		refreshOutlineTooltip: "Actualizar esquema",

		// Thread Header
		threadLabelPlaceholder: (major: number) => `Rótulo del hilo ${major}...`,
		clickToEditLabel: "Haz clic para editar rótulo",
		collapseThreadTooltip: "Colapsar hilo",
		expandThreadTooltip: "Expandir hilo",

		// Node ID Badges
		collapseBranchTooltip: "Colapsar rama",
		expandBranchTooltip: "Expandir rama",

		// Context Menu
		assignNoteBranchMenu: (id: string) => `Asignar nota en [${id}]`,
		createNoteBranchMenu: (id: string) => `Crear la nota [${id}]`,
		assignNoteSiblingMenu: (id: string) => `Asignar nota en [${id}]`,
		continueThreadMenu: (id: string) => `Continuar hilo en [${id}]`,

		// Command Palette
		cmdOpenTab: "Abrir esquema en una pestaña",
		cmdOpenSidebar: "Abrir esquema en la barra lateral",
		cmdToggleCollapseAll: "Colapsar / Expandir todo",
		cmdCreateNextThread: (id: string) => `Crear hilo [${id}]`,
		cmdCreateNextThreadDefault: "Crear hilo nuevo",
		cmdRefreshOutline: "Actualizar esquema",
		cmdInsertReference: "Insertar referencia",

		cmdAssignBranchActive: (id: string) => `Asignar nota en [${id}]`,
		cmdAssignBranchActiveDefault: "Asignar nota en rama",
		cmdCreateBranchActive: (id: string) => `Crear la nota [${id}]`,
		cmdCreateBranchActiveDefault: "Crear la nota en rama",
		cmdAssignSiblingActive: (id: string) => `Asignar nota en [${id}]`,
		cmdAssignSiblingActiveDefault: "Asignar nota en siguiente hilo",
		cmdContinueThreadActive: (id: string) => `Continuar hilo en [${id}]`,
		cmdContinueThreadActiveDefault: "Continuar hilo",

		// Modals
		modalSearchInboxPlaceholder: "Escribe para buscar nota en Bandeja de entrada o Durmiendo...",
		modalSearchRefPlaceholder: "Escribe para buscar referencia Folgezettel por ID o título...",
		modalFolderLabel: (folder: string) => `(${folder})`,

		// Notices & Alerts
		noticeNoCandidateNotes: "No hay notas disponibles en Bandeja de entrada ni Durmiendo.",
		noticeNoteAssigned: (id: string) => `Nota asignada como [${id}] en la raíz.`,
		noticeErrorAssigning: (err: any) => `Error al asignar nota: ${err}`,
		noticeNoteCreated: (id: string) => `Nota creada: [${id}]`,
		noticeErrorCreatingNote: (err: any) => `Error al crear la nota: ${err}`,
		noticeNewThreadCreated: (id: string) => `Nuevo hilo creado: [${id}]`,
		noticeErrorCreatingThread: (err: any) => `Error al crear hilo: ${err}`,
		noticeNoFolgezettelNotesFound: "No se encontraron notas de Folgezettel en la bóveda.",

		// Settings Tab
		settingsTitle: "Configuración de Folgezettel",
		settingsLanguageName: "Idioma de la interfaz",
		settingsLanguageDesc: "Elige el idioma del plugin o mantén automático para seguir el idioma de Obsidian.",
		settingsLanguageAuto: "Automático (según Obsidian)",
		settingsLanguageEs: "Español",
		settingsLanguageEn: "English",
	},
	en: {
		// General & View
		viewTitle: "Folgezettel",
		ribbonTooltip: "Folgezettel: Open outline",
		emptyVaultMessage: "No Folgezettel notes found at vault root.",
		emptySearchMessage: "No notes match your search.",

		// Header Buttons
		locateActiveNoteTooltip: "Locate active note in tree",
		collapseAllTooltip: "Collapse / Expand all",
		searchNotesTooltip: "Search notes (Cmd/Ctrl + F)",
		searchPlaceholder: "Type to search...",
		searchClearTooltip: "Clear search",
		createThreadTooltip: (id: string) => `Create thread ${id}`,
		refreshOutlineTooltip: "Refresh outline",

		// Thread Header
		threadLabelPlaceholder: (major: number) => `Thread ${major} label...`,
		clickToEditLabel: "Click to edit label",
		collapseThreadTooltip: "Collapse thread",
		expandThreadTooltip: "Expand thread",

		// Node ID Badges
		collapseBranchTooltip: "Collapse branch",
		expandBranchTooltip: "Expand branch",

		// Context Menu
		assignNoteBranchMenu: (id: string) => `Assign note to [${id}]`,
		createNoteBranchMenu: (id: string) => `Create note [${id}]`,
		assignNoteSiblingMenu: (id: string) => `Assign note to [${id}]`,
		continueThreadMenu: (id: string) => `Continue thread in [${id}]`,

		// Command Palette
		cmdOpenTab: "Open outline in a new tab",
		cmdOpenSidebar: "Open outline in sidebar",
		cmdToggleCollapseAll: "Collapse / Expand all",
		cmdCreateNextThread: (id: string) => `Create thread [${id}]`,
		cmdCreateNextThreadDefault: "Create new thread",
		cmdRefreshOutline: "Refresh outline",
		cmdInsertReference: "Insert reference",

		cmdAssignBranchActive: (id: string) => `Assign note to [${id}]`,
		cmdAssignBranchActiveDefault: "Assign note to branch",
		cmdCreateBranchActive: (id: string) => `Create note [${id}]`,
		cmdCreateBranchActiveDefault: "Create note in branch",
		cmdAssignSiblingActive: (id: string) => `Assign note to [${id}]`,
		cmdAssignSiblingActiveDefault: "Assign note to next thread",
		cmdContinueThreadActive: (id: string) => `Continue thread in [${id}]`,
		cmdContinueThreadActiveDefault: "Continue thread",

		// Modals
		modalSearchInboxPlaceholder: "Type to search note in Inbox or Incubation...",
		modalSearchRefPlaceholder: "Type to search Folgezettel reference by ID or title...",
		modalFolderLabel: (folder: string) => `(${folder})`,

		// Notices & Alerts
		noticeNoCandidateNotes: "No notes available in Inbox or Incubation.",
		noticeNoteAssigned: (id: string) => `Note assigned as [${id}] at root.`,
		noticeErrorAssigning: (err: any) => `Error assigning note: ${err}`,
		noticeNoteCreated: (id: string) => `Note created: [${id}]`,
		noticeErrorCreatingNote: (err: any) => `Error creating note: ${err}`,
		noticeNewThreadCreated: (id: string) => `New thread created: [${id}]`,
		noticeErrorCreatingThread: (err: any) => `Error creating thread: ${err}`,
		noticeNoFolgezettelNotesFound: "No Folgezettel notes found in vault.",

		// Settings Tab
		settingsTitle: "Folgezettel Settings",
		settingsLanguageName: "Interface Language",
		settingsLanguageDesc: "Choose plugin language or keep automatic to follow Obsidian's language.",
		settingsLanguageAuto: "Automatic (follows Obsidian)",
		settingsLanguageEs: "Español",
		settingsLanguageEn: "English",
	},
};

export function t<K extends keyof typeof STRINGS["en"]>(
	key: K,
	...args: any[]
): any {
	const locale = getEffectiveLocale();
	const val = (STRINGS[locale] as any)[key] ?? (STRINGS["en"] as any)[key];
	if (typeof val === "function") {
		return val(...args);
	}
	return val;
}
