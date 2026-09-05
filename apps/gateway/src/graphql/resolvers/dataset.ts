import type { GatewayContext } from "../context.js";
import { findDatasetInfo } from "../dataset-query.js";

export const datasetResolvers = {
  async datasetInfo(_parent: unknown, _args: Record<string, unknown>, context: GatewayContext) {
    return findDatasetInfo(context.ch, context.redis);
  },
} as const;
