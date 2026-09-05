import type { GatewayContext } from "../context.js";
import { parseOverviewArgs } from "../input.js";
import { findVulnerabilityOverview } from "../overview-query.js";

export const overviewResolvers = {
  async vulnerabilityOverview(
    _parent: unknown,
    args: Record<string, unknown>,
    context: GatewayContext,
  ) {
    return findVulnerabilityOverview(context.ch, parseOverviewArgs(args));
  },
} as const;
