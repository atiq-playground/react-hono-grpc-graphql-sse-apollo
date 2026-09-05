import type { GatewayContext } from "../context.js";
import { findFinding, findFindings, findSearchSuggestions } from "../findings-query.js";
import { parseFindingId, parseFindingsArgs, parseSuggestionArgs } from "../input.js";

export const findingsResolvers = {
  async findings(_parent: unknown, args: Record<string, unknown>, context: GatewayContext) {
    return findFindings(context.ch, parseFindingsArgs(args));
  },

  async finding(_parent: unknown, args: Record<string, unknown>, context: GatewayContext) {
    return findFinding(context.ch, parseFindingId(args.id));
  },

  async searchSuggestions(
    _parent: unknown,
    args: Record<string, unknown>,
    context: GatewayContext,
  ) {
    const input = parseSuggestionArgs(args);
    return findSearchSuggestions(context.ch, input.prefix, input.limit);
  },
} as const;
