import { sortRows, rowsFromEntries } from "../../common/fileEntry";
import { resolveOpenRequest, type StatInfo } from "../../common/openPath";
import type { PathPolicy } from "../../common/pathPolicy";
import { fromWireEntry, type FileRow } from "../../common/types";
import type { HostApi } from "./host";
import { nextToken, type Store } from "./store";

export interface OpenPathFlowDeps {
  host: HostApi;
  policy: PathPolicy;
  store: Store;
  gate: { paused: boolean };
  onDirectoryOpened: (dir: string) => void;
  loadSingle: (
    token: number,
    dir: string,
    file: string,
    rows: readonly FileRow[]
  ) => Promise<void>;
  loadCompare: (
    token: number,
    dir: string,
    a: string,
    b: string,
    rows: readonly FileRow[]
  ) => Promise<void>;
}

export interface OpenPathFlow {
  open(paths: readonly string[]): Promise<void>;
}

async function statAll(host: HostApi, paths: readonly string[]): Promise<Map<string, StatInfo>> {
  const result = new Map<string, StatInfo>();
  await Promise.all(
    paths.map(async (path) => {
      try {
        const info = await host.statPath(path);
        result.set(path, { exists: true, isDir: info.is_dir, supported: true });
      } catch (error) {
        const kind = (error as { kind?: string } | null)?.kind;
        result.set(path, {
          exists: kind === "not_supported",
          isDir: false,
          supported: false,
        });
      }
    })
  );
  return result;
}

async function listRows(deps: OpenPathFlowDeps, dir: string): Promise<FileRow[]> {
  const entries = await deps.host.listDirEntries(dir);
  const rows = rowsFromEntries(entries.map(fromWireEntry));
  const state = deps.store.get();
  return sortRows(rows, state.sortKey, state.sortDesc);
}

export function createOpenPathFlow(deps: OpenPathFlowDeps): OpenPathFlow {
  return {
    async open(paths) {
      if (deps.gate.paused || paths.length === 0) {
        return;
      }

      const infos = await statAll(deps.host, paths);
      const decision = resolveOpenRequest(
        paths,
        (path) => infos.get(path) ?? { exists: false, isDir: false, supported: false },
        deps.policy
      );

      if (decision.kind === "error") {
        deps.store.dispatch({ type: "pathError", message: decision.message });
        return;
      }

      if (decision.kind === "dir") {
        const token = nextToken();
        deps.store.dispatch({ type: "requestStarted", token });
        try {
          const rows = await listRows(deps, decision.dir);
          if (deps.store.get().generation !== token) {
            return;
          }
          deps.store.dispatch({ type: "openDir", token, dir: decision.dir, rows });
          deps.onDirectoryOpened(decision.dir);
        } catch (error) {
          deps.store.dispatch({ type: "pathError", message: String(error) });
        }
        return;
      }

      const token = nextToken();
      deps.store.dispatch({ type: "requestStarted", token });
      let rows: FileRow[];
      try {
        rows = await listRows(deps, decision.dir);
      } catch (error) {
        deps.store.dispatch({ type: "pathError", message: String(error) });
        return;
      }
      if (deps.store.get().generation !== token) {
        return;
      }

      if (decision.kind === "file") {
        deps.store.dispatch({
          type: "openFile",
          token,
          dir: decision.dir,
          file: decision.file,
          rows,
        });
        await deps.loadSingle(token, decision.dir, decision.file, rows);
      } else {
        deps.store.dispatch({
          type: "openCompare",
          token,
          dir: decision.dir,
          a: decision.a,
          b: decision.b,
          rows,
        });
        await deps.loadCompare(token, decision.dir, decision.a, decision.b, rows);
      }
      deps.onDirectoryOpened(decision.dir);
    },
  };
}
