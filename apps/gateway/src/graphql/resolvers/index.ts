import { datasetResolvers } from "./dataset.js";
import { exportMutationResolvers, exportQueryResolvers } from "./exports.js";
import { facetsResolvers } from "./facets.js";
import { findingsResolvers } from "./findings.js";
import { overviewResolvers } from "./overview.js";

export const resolvers = {
  Query: {
    ...findingsResolvers,
    ...facetsResolvers,
    ...overviewResolvers,
    ...datasetResolvers,
    ...exportQueryResolvers,
  },
  Mutation: exportMutationResolvers,
} as const;
