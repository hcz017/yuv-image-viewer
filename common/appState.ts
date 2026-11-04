import type { FileRow, SortKey } from "./types";

export type Mode =
  | { kind: "list"; dir: string }
  | { kind: "single"; dir: string; file: string }
  | { kind: "compare"; dir: string; a: string; b: string };

export interface AppState {
  mode: Mode;
  dir: string;
  rows: readonly FileRow[];
  selectionOrder: readonly string[];
  selectionAnchor: string | null;
  sortKey: SortKey;
  sortDesc: boolean;
  filter: string;
  generation: number;
  pendingMode: Exclude<Mode, { kind: "list" }> | null;
  pendingRows: readonly FileRow[] | null;
  displayedFile: string | null;
  modalOpen: boolean;
  error: string | null;
}

export type Action =
  | { type: "requestStarted"; token: number }
  | { type: "openDir"; token: number; dir: string; rows: readonly FileRow[] }
  | { type: "openFile"; token: number; dir: string; file: string; rows: readonly FileRow[] }
  | {
      type: "openCompare";
      token: number;
      dir: string;
      a: string;
      b: string;
      rows: readonly FileRow[];
    }
  | { type: "loadCommit"; token: number; mode: Mode; rows: readonly FileRow[]; displayedFile: string | null }
  | { type: "loadAbort"; token: number; error: string }
  | { type: "pathError"; message: string }
  | { type: "setSort"; key: SortKey }
  | { type: "setFilter"; value: string }
  | { type: "backToList" }
  | { type: "swapCompare" }
  | { type: "setModal"; open: boolean }
  | { type: "select"; order: readonly string[]; anchor: string | null };

export function initialState(dir = ""): AppState {
  return {
    mode: { kind: "list", dir },
    dir,
    rows: [],
    selectionOrder: [],
    selectionAnchor: null,
    sortKey: "name",
    sortDesc: false,
    filter: "",
    generation: 0,
    pendingMode: null,
    pendingRows: null,
    displayedFile: null,
    modalOpen: false,
    error: null,
  };
}

const NAVIGATION_ACTIONS = new Set<Action["type"]>([
  "openDir",
  "openFile",
  "openCompare",
  "loadCommit",
  "loadAbort",
  "backToList",
  "swapCompare",
]);

export function reduce(state: AppState, action: Action): AppState {
  if (state.modalOpen && NAVIGATION_ACTIONS.has(action.type)) {
    return state;
  }

  if ("token" in action && action.type !== "requestStarted" && action.token !== state.generation) {
    return state;
  }

  switch (action.type) {
    case "requestStarted":
      return { ...state, generation: action.token, error: null };

    case "openDir": {
      const sameDir = action.dir === state.dir;
      return {
        ...state,
        mode: { kind: "list", dir: action.dir },
        dir: action.dir,
        rows: action.rows,
        selectionOrder: sameDir ? state.selectionOrder : [],
        selectionAnchor: sameDir ? state.selectionAnchor : null,
        filter: sameDir ? state.filter : "",
        pendingMode: null,
        pendingRows: null,
        displayedFile: null,
        error: null,
      };
    }

    case "openFile":
      return {
        ...state,
        pendingMode: { kind: "single", dir: action.dir, file: action.file },
        pendingRows: action.rows,
        error: null,
      };

    case "openCompare":
      return {
        ...state,
        pendingMode: { kind: "compare", dir: action.dir, a: action.a, b: action.b },
        pendingRows: action.rows,
        error: null,
      };

    case "loadCommit":
      return {
        ...state,
        mode: action.mode,
        rows: action.rows,
        dir: action.mode.kind === "list" ? action.mode.dir : action.mode.dir,
        displayedFile: action.displayedFile,
        pendingMode: null,
        pendingRows: null,
        error: null,
      };

    case "loadAbort":
      return {
        ...state,
        error: action.error,
        pendingMode: null,
        pendingRows: null,
      };

    case "pathError":
      return { ...state, error: action.message };

    case "setSort":
      return {
        ...state,
        sortKey: action.key,
        sortDesc: state.sortKey === action.key ? !state.sortDesc : false,
      };

    case "setFilter":
      return {
        ...state,
        filter: action.value,
        selectionOrder: [],
        selectionAnchor: null,
      };

    case "backToList":
      return {
        ...state,
        mode: { kind: "list", dir: state.dir },
        pendingMode: null,
        pendingRows: null,
        displayedFile: null,
      };

    case "swapCompare":
      return state.mode.kind === "compare"
        ? { ...state, mode: { ...state.mode, a: state.mode.b, b: state.mode.a } }
        : state;

    case "setModal":
      return { ...state, modalOpen: action.open };

    case "select":
      return { ...state, selectionOrder: action.order, selectionAnchor: action.anchor };

    default:
      return state;
  }
}
