import { detectP010Alignment, type P010Alignment } from "../../common/bitdepth";
import { formatFromName } from "../../common/filenameParser";
import { resolveSpec } from "../../common/resolveSpec";
import { validateSpec } from "../../common/spec";
import type { Spec, YuvFormat } from "../../common/types";
import type { HostApi } from "./host";

export interface LoadDeps {
  host: HostApi;
  maxTextureSize: number;
  chooseFormat(name: string): Promise<YuvFormat | null>;
  askManual(name: string, fileSize: number, format: YuvFormat, reason: string): Promise<Spec | null>;
  confirmLarge(name: string, size: number): Promise<boolean>;
  cachedSpec(
    path: string,
    size: number,
    modifiedMs: number,
    maxTextureSize: number
  ): Promise<Spec | null>;
  saveSpec(path: string, size: number, modifiedMs: number, spec: Spec): Promise<void>;
}

export interface LoadedFile {
  spec: Spec;
  data: Uint8Array;
  alignment: P010Alignment;
}

export type LoadOutcome =
  | { kind: "loaded"; file: LoadedFile }
  | { kind: "cancelled" }
  | { kind: "error"; message: string };

const confirmedLarge = new Set<string>();
const LARGE_FILE_BYTES = 128 * 1024 * 1024;

export async function loadFile(
  deps: LoadDeps,
  file: string,
  fallbackFormat: YuvFormat | null
): Promise<LoadOutcome> {
  try {
    const stat = await deps.host.statPath(file);
    if (!stat.is_dir) {
      if (stat.size > LARGE_FILE_BYTES && !confirmedLarge.has(file)) {
        const confirmed = await deps.confirmLarge(stat.name, stat.size);
        if (!confirmed) {
          return { kind: "cancelled" };
        }
        confirmedLarge.add(file);
      }
    }

    // 优先使用与文件路径、大小、修改时间都匹配的缓存规格
    let spec: Spec | null = await deps.cachedSpec(
      stat.path,
      stat.size,
      stat.modified_ms,
      deps.maxTextureSize
    );

    if (!spec) {
      let format: YuvFormat | null =
        fallbackFormat ?? formatFromName(stat.name);
      if (!format || format === "yuv") {
        format = await deps.chooseFormat(stat.name);
        if (!format) {
          return { kind: "cancelled" };
        }
      }

      let resolution = resolveSpec({
        name: stat.name,
        fileSize: stat.size,
        format,
        maxTextureSize: deps.maxTextureSize,
      });

      if (resolution.kind === "chooseFormat") {
        const chosen = await deps.chooseFormat(stat.name);
        if (!chosen) {
          return { kind: "cancelled" };
        }
        format = chosen;
        resolution = resolveSpec({
          name: stat.name,
          fileSize: stat.size,
          format,
          maxTextureSize: deps.maxTextureSize,
        });
      }

      if (resolution.kind === "resolved") {
        spec = resolution.spec;
      } else if (resolution.kind === "manual") {
        const manual = await deps.askManual(stat.name, stat.size, format, resolution.reason);
        if (!manual) {
          return { kind: "cancelled" };
        }
        spec = manual;
        // 只有用户确认手动规格后才写入缓存
        await deps.saveSpec(stat.path, stat.size, stat.modified_ms, manual);
      } else if (resolution.kind === "invalid") {
        return { kind: "error", message: resolution.message };
      } else {
        return { kind: "error", message: "无法确定图像的像素格式" };
      }
    }

    if (!spec) {
      return { kind: "error", message: "无法确定图像的像素格式" };
    }

    const check = validateSpec(spec, stat.size, deps.maxTextureSize);
    if (check.kind === "invalid") {
      return { kind: "error", message: check.reason ?? "规格不合法" };
    }

    const data = await deps.host.readFileBytes(file);
    if (data.length < check.expected) {
      return { kind: "error", message: "读取到的数据短于规格所需字节数" };
    }

    // 无法判断 P010 对齐方式时默认按高位对齐处理
    const alignment: P010Alignment =
      spec.format === "p010" ? detectP010Alignment(data) : "high";
    const resolvedAlignment: P010Alignment =
      alignment === "unknown" ? "high" : alignment;

    return { kind: "loaded", file: { spec, data, alignment: resolvedAlignment } };
  } catch (error) {
    return { kind: "error", message: String(error) };
  }
}
