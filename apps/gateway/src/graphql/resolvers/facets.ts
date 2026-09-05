import type { GatewayContext } from "../context.js";
import { findFacets } from "../facets-query.js";
import { parseFacetsArgs } from "../input.js";

export const facetsResolvers = {
  async facets(_parent: unknown, args: Record<string, unknown>, context: GatewayContext) {
    return findFacets(context.ch, parseFacetsArgs(args));
  },
} as const;
