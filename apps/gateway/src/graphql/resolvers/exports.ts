import type { GatewayContext } from "../context.js";
import { throwClientError } from "../errors.js";
import { scheduleExportJob } from "../export/export-worker.js";
import {
  createExportJob,
  findExportJob,
  parseExportJobId,
  toExportJob,
} from "../export/job-store.js";
import { parseExportArgs } from "../input.js";

function parseJobId(value: unknown): string {
  try {
    return parseExportJobId(value);
  } catch {
    throwClientError("Invalid export job id");
  }
}

export const exportQueryResolvers = {
  async exportJob(_parent: unknown, args: Record<string, unknown>, context: GatewayContext) {
    const job = await findExportJob(context.redis, parseJobId(args.id));
    return job === null ? null : toExportJob(job);
  },
} as const;

export const exportMutationResolvers = {
  async createExport(_parent: unknown, args: Record<string, unknown>, context: GatewayContext) {
    const job = await createExportJob(context.redis, parseExportArgs(args));
    scheduleExportJob(context, job.id);
    return toExportJob(job);
  },
} as const;
