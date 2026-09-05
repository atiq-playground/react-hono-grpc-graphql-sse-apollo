import { mkdir } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { EXPORT_DIR } from "../../env.js";
import { parseExportJobId } from "./job-store.js";

// Local artifacts intentionally make T24 a single-node playground workflow.
// A multi-replica gateway must replace this boundary with shared storage.
const EXPORT_ROOT = resolve(EXPORT_DIR);

export function exportArtifactName(id: string): string {
  return `${parseExportJobId(id)}.csv`;
}

export function exportTemporaryArtifactName(id: string): string {
  return `${parseExportJobId(id)}.csv.part`;
}

export function resolveExportArtifactPath(id: string, artifactName: string): string {
  const expected = exportArtifactName(id);
  if (artifactName !== expected || basename(artifactName) !== artifactName) {
    throw new Error("Invalid export artifact metadata");
  }
  const artifactPath = resolve(EXPORT_ROOT, artifactName);
  if (dirname(artifactPath) !== EXPORT_ROOT) {
    throw new Error("Export artifact escaped the configured directory");
  }
  return artifactPath;
}

export function resolveExportTemporaryPath(id: string): string {
  const artifactName = exportTemporaryArtifactName(id);
  const artifactPath = resolve(EXPORT_ROOT, artifactName);
  if (basename(artifactName) !== artifactName || dirname(artifactPath) !== EXPORT_ROOT) {
    throw new Error("Export artifact escaped the configured directory");
  }
  return artifactPath;
}

export async function ensureExportDirectory(): Promise<void> {
  await mkdir(EXPORT_ROOT, { recursive: true, mode: 0o700 });
}

export function exportAttachmentFilename(id: string): string {
  return `findings-export-${parseExportJobId(id)}.csv`;
}
