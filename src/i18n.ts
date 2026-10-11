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
		ribbonTooltip: "Open outline",
		ribbonVerzweigungTooltip: (id: string) => `Verzweigung [${id}]`,
		ribbonVerzweigungTooltipDefault: "Verzweigung",
		ribbonFortsetzungTooltip: (id: string) => `Fortsetzung [${id}]`,
		ribbonFortsetzungTooltipDefault: "Fortsetzung",
		ribbonFortsetzungTooltipExists: (id: string) => `Fortsetzung [${id}] (ya existe)`,
		ribbonCreateThreadTooltip: (id: string) => `Thread [${id}]`,
		ribbonCreateThreadTooltipDefault: "Thread",
		emptyVaultMessage: "No se encontraron notas Folgezettel en la raíz.",
		emptySearchMessage: "No hay notas que coincidan con la búsqueda.",

		// Header Buttons
		locateActiveNoteTooltip: "Localizar nota activa en el árbol",
		collapseAllTooltip: "Colapsar / Expandir todo",
		searchNotesTooltip: "Buscar notas (Cmd/Ctrl + F)",
		searchPlaceholder: "Escribe para buscar...",
		searchClearTooltip: "Limpiar búsqueda",
		createThreadTooltip: (id: string) => `Crear hilo ${id}`,
		createThreadBtnText: (id: string) => `Crear hilo ${id}`,
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
		createNoteBranchMenu: (id: string) => `Verzweigung [${id}]`,
		assignNoteBranchMenu: (id: string) => `Asignar como Verzweigung [${id}]`,
		continueThreadMenu: (id: string) => `Fortsetzung [${id}]`,
		assignNoteSiblingMenu: (id: string) => `Asignar como Fortsetzung [${id}]`,
		changeThreadIdMenu: (id: number) => `Cambiar ID [${id}]`,

		// Command Palette
		cmdOpenTab: "Abrir esquema en una pestaña",
		cmdOpenSidebar: "Abrir esquema en la barra lateral",
		cmdToggleCollapseAll: "Colapsar / Expandir todo",
		cmdCreateNextThread: (id: string) => `Crear hilo [${id}]`,
		cmdCreateNextThreadDefault: "Crear hilo nuevo",
		cmdRefreshOutline: "Actualizar esquema",
		cmdInsertReference: "Insertar referencia",

		cmdAssignBranchActive: (id: string) => `Asignar como Verzweigung en [${id}]`,
		cmdAssignBranchActiveDefault: "Asignar como Verzweigung (bifurcar / intercalar)",
		cmdCreateBranchActive: (id: string) => `Verzweigung (bifurcar / intercalar) en [${id}]`,
		cmdCreateBranchActiveDefault: "Verzweigung (bifurcar / intercalar)",
		cmdAssignSiblingActive: (id: string) => `Asignar como Fortsetzung en [${id}]`,
		cmdAssignSiblingActiveDefault: "Asignar como Fortsetzung (continuación)",
		cmdContinueThreadActive: (id: string) => `Fortsetzung (continuación) en [${id}]`,
		cmdContinueThreadActiveDefault: "Fortsetzung (continuación)",

		// Modals
		modalSearchInboxPlaceholder: "Escribe para buscar nota en Bandeja de entrada o Durmiendo...",
		modalSearchRefPlaceholder: "Escribe para buscar referencia Folgezettel por ID o título...",
		modalFolderLabel: (folder: string) => `(${folder})`,
		modalChangeThreadIdTitle: (id: number) => `Cambiar ID del hilo [${id}]`,
		modalChangeThreadIdDesc: (id: number) => `Introduce el nuevo ID numérico para este hilo. Se renombrarán automáticamente todas las notas subordinadas que pertenezcan a este hilo (ej. ${id}.1, ${id}.1a, etc.) y se actualizarán sus enlaces en la bóveda.`,
		modalChangeThreadIdInputLabel: "Nuevo ID del hilo",
		modalChangeThreadIdPlaceholder: "Ej. 15",
		modalChangeThreadIdConfirm: "Cambiar ID",
		modalChangeThreadIdCancel: "Cancelar",
		modalChangeThreadIdRenaming: "Renombrando...",
		modalChangeThreadIdInvalid: "Introduce un número entero positivo válido (ej. 1, 2, 15).",
		modalChangeThreadIdSame: "El nuevo ID debe ser diferente al ID actual.",
		modalChangeThreadIdExists: (id: number) => `El hilo [${id}] ya existe en la bóveda. Elige un ID que no esté en uso.`,
		modalChangeThreadIdCollision: (path: string) => `No se puede renombrar porque ya existe el archivo: ${path}`,

		// Notices & Alerts
		noticeNoCandidateNotes: "No hay notas disponibles en Bandeja de entrada ni Durmiendo.",
		noticeNoActiveFolgezettelNote: "No hay ninguna nota de Folgezettel activa abierta para crear una rama.",
		noticeNoteAssigned: (id: string) => `Nota asignada como [${id}] en la raíz.`,
		noticeErrorAssigning: (err: any) => `Error al asignar nota: ${err}`,
		noticeNoteCreated: (id: string) => `Nota creada: [${id}]`,
		noticeErrorCreatingNote: (err: any) => `Error al crear la nota: ${err}`,
		noticeNewThreadCreated: (id: string) => `Nuevo hilo creado: [${id}]`,
		noticeErrorCreatingThread: (err: any) => `Error al crear hilo: ${err}`,
		noticeNoFolgezettelNotesFound: "No se encontraron notas de Folgezettel en la bóveda.",
		noticeThreadRenamed: (oldId: string, newId: string, count: number) => `Hilo [${oldId}] renombrado a [${newId}] (${count} notas actualizadas).`,
		noticeErrorRenamingThread: (err: any) => `Error al renombrar el hilo: ${err}`,

		// Settings Tab
		settingsTitle: "Configuración de Folgezettel",
		settingsLanguageName: "Idioma de la interfaz",
		settingsLanguageDesc: "Elige el idioma del plugin o mantén automático para seguir el idioma de Obsidian.",
		settingsLanguageAuto: "Automático (según Obsidian)",
		settingsLanguageEs: "Español",
		settingsLanguageEn: "English",

		settingsRibbonHeading: "Botones en la barra lateral (Ribbon)",
		settingsRibbonOutline: "Botón 'Open outline'",
		settingsRibbonOutlineDesc: "Muestra el icono en el ribbon para abrir o enfocar la vista del esquema.",
		settingsRibbonCreateBranch: "Botón 'Verzweigung (bifurcar / intercalar)'",
		settingsRibbonCreateBranchDesc: "Muestra el icono en el ribbon para crear una bifurcación o intercalación (Verzweigung) a partir de la nota activa.",
		settingsRibbonCreateParallel: "Botón 'Fortsetzung (continuación)'",
		settingsRibbonCreateParallelDesc: "Muestra el icono en el ribbon para continuar directamente en el mismo nivel (Fortsetzung) a partir de la nota activa.",
		settingsRibbonCreateThread: "Botón 'Thread'",
		settingsRibbonCreateThreadDesc: "Muestra el icono en el ribbon para crear el siguiente hilo nuevo (ej. 19.1).",

		settingsQuickSwitcherHeading: "Búsqueda (Quick Switcher)",
		settingsEnhanceQuickSwitcher: "Mejorar búsqueda en Quick Switcher",
		settingsEnhanceQuickSwitcherDesc: "Prioriza coincidencias exactas de ID Folgezettel y ordena sus sub-ramas jerárquicamente al buscar por número en el Quick Switcher (Cmd/Ctrl + O).",
	},
	en: {
		// General & View
		viewTitle: "Folgezettel",
		ribbonTooltip: "Open outline",
		ribbonVerzweigungTooltip: (id: string) => `Verzweigung [${id}]`,
		ribbonVerzweigungTooltipDefault: "Verzweigung",
		ribbonFortsetzungTooltip: (id: string) => `Fortsetzung [${id}]`,
		ribbonFortsetzungTooltipDefault: "Fortsetzung",
		ribbonFortsetzungTooltipExists: (id: string) => `Fortsetzung [${id}] (already exists)`,
		ribbonCreateThreadTooltip: (id: string) => `Thread [${id}]`,
		ribbonCreateThreadTooltipDefault: "Thread",
		emptyVaultMessage: "No Folgezettel notes found at vault root.",
		emptySearchMessage: "No notes match your search.",

		// Header Buttons
		locateActiveNoteTooltip: "Locate active note in tree",
		collapseAllTooltip: "Collapse / Expand all",
		searchNotesTooltip: "Search notes (Cmd/Ctrl + F)",
		searchPlaceholder: "Type to search...",
		searchClearTooltip: "Clear search",
		createThreadTooltip: (id: string) => `Create thread ${id}`,
		createThreadBtnText: (id: string) => `Create thread ${id}`,
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
		createNoteBranchMenu: (id: string) => `Verzweigung [${id}]`,
		assignNoteBranchMenu: (id: string) => `Assign to [${id}]`,
		continueThreadMenu: (id: string) => `Fortsetzung [${id}]`,
		assignNoteSiblingMenu: (id: string) => `Assign to [${id}]`,
		changeThreadIdMenu: (id: number) => `Change ID [${id}]`,

		// Command Palette
		cmdOpenTab: "Open outline in a new tab",
		cmdOpenSidebar: "Open outline in sidebar",
		cmdToggleCollapseAll: "Collapse / Expand all",
		cmdCreateNextThread: (id: string) => `Create thread [${id}]`,
		cmdCreateNextThreadDefault: "Create new thread",
		cmdRefreshOutline: "Refresh outline",
		cmdInsertReference: "Insert reference",

		cmdAssignBranchActive: (id: string) => `Assign to [${id}]`,
		cmdAssignBranchActiveDefault: "Assign to branch",
		cmdCreateBranchActive: (id: string) => `Verzweigung at [${id}]`,
		cmdCreateBranchActiveDefault: "Verzweigung",
		cmdAssignSiblingActive: (id: string) => `Assign to [${id}]`,
		cmdAssignSiblingActiveDefault: "Assign to parallel note",
		cmdContinueThreadActive: (id: string) => `Fortsetzung at [${id}]`,
		cmdContinueThreadActiveDefault: "Fortsetzung",

		// Modals
		modalSearchInboxPlaceholder: "Type to search note in Inbox or Incubation...",
		modalSearchRefPlaceholder: "Type to search Folgezettel reference by ID or title...",
		modalFolderLabel: (folder: string) => `(${folder})`,
		modalChangeThreadIdTitle: (id: number) => `Change thread ID [${id}]`,
		modalChangeThreadIdDesc: (id: number) => `Enter the new numerical ID for this thread. All subordinate notes in this thread (e.g. ${id}.1, ${id}.1a, etc.) will be automatically renamed and vault links will be updated.`,
		modalChangeThreadIdInputLabel: "New thread ID",
		modalChangeThreadIdPlaceholder: "E.g. 15",
		modalChangeThreadIdConfirm: "Change ID",
		modalChangeThreadIdCancel: "Cancel",
		modalChangeThreadIdRenaming: "Renaming...",
		modalChangeThreadIdInvalid: "Enter a valid positive integer (e.g. 1, 2, 15).",
		modalChangeThreadIdSame: "The new ID must be different from the current ID.",
		modalChangeThreadIdExists: (id: number) => `Thread [${id}] already exists in the vault. Choose an unused ID.`,
		modalChangeThreadIdCollision: (path: string) => `Cannot rename because file already exists: ${path}`,

		// Notices & Alerts
		noticeNoCandidateNotes: "No notes available in Inbox or Incubation.",
		noticeNoActiveFolgezettelNote: "No active Folgezettel note currently open to create a branch.",
		noticeNoteAssigned: (id: string) => `Note assigned as [${id}] at root.`,
		noticeErrorAssigning: (err: any) => `Error assigning note: ${err}`,
		noticeNoteCreated: (id: string) => `Note created: [${id}]`,
		noticeErrorCreatingNote: (err: any) => `Error creating note: ${err}`,
		noticeNewThreadCreated: (id: string) => `New thread created: [${id}]`,
		noticeErrorCreatingThread: (err: any) => `Error creating thread: ${err}`,
		noticeNoFolgezettelNotesFound: "No Folgezettel notes found in vault.",
		noticeThreadRenamed: (oldId: string, newId: string, count: number) => `Thread [${oldId}] renamed to [${newId}] (${count} notes updated).`,
		noticeErrorRenamingThread: (err: any) => `Error renaming thread: ${err}`,

		// Settings Tab
		settingsTitle: "Folgezettel Settings",
		settingsLanguageName: "Interface Language",
		settingsLanguageDesc: "Choose plugin language or keep automatic to follow Obsidian's language.",
		settingsLanguageAuto: "Automatic (follows Obsidian)",
		settingsLanguageEs: "Español",
		settingsLanguageEn: "English",

		settingsRibbonHeading: "Left Ribbon Buttons",
		settingsRibbonOutline: "Open outline button",
		settingsRibbonOutlineDesc: "Show ribbon icon to open or focus the Folgezettel outline.",
		settingsRibbonCreateBranch: "'Verzweigung' button",
		settingsRibbonCreateBranchDesc: "Show ribbon icon to create a branch or intercalation (Verzweigung) from the active note.",
		settingsRibbonCreateParallel: "'Fortsetzung' button",
		settingsRibbonCreateParallelDesc: "Show ribbon icon to create a direct continuation at the same level (Fortsetzung) from the active note.",
		settingsRibbonCreateThread: "'Thread' button",
		settingsRibbonCreateThreadDesc: "Show ribbon icon to create the next major thread (e.g. 19.1).",

		settingsQuickSwitcherHeading: "Quick Switcher Search",
		settingsEnhanceQuickSwitcher: "Enhance Quick Switcher search",
		settingsEnhanceQuickSwitcherDesc: "Prioritizes exact Folgezettel ID matches and orders sub-branches hierarchically when searching by number in the Quick Switcher (Cmd/Ctrl + O).",
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
