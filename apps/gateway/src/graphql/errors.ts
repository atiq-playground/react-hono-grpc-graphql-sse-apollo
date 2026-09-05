/**
 * Client-facing GraphQL errors vs internal failures.
 * Resolvers may throw freely; formatGatewayError decides what the browser sees.
 */
import * as Sentry from "@sentry/node";
import { GraphQLError, type GraphQLFormattedError } from "graphql";

/** Codes whose messages are safe to return as written. */
const CLIENT_SAFE_CODES = new Set([
  "BAD_USER_INPUT",
  "BAD_REQUEST",
  "GRAPHQL_PARSE_FAILED",
  "GRAPHQL_VALIDATION_FAILED",
  "PERSISTED_QUERY_NOT_FOUND",
  "PERSISTED_QUERY_NOT_SUPPORTED",
]);

const GENERIC_MESSAGE = "Something went wrong";

/** Throw a resolver error whose message is allowed through to the client. */
export function throwClientError(message: string, code = "BAD_USER_INPUT"): never {
  throw new GraphQLError(message, {
    extensions: { code },
  });
}

export function formatGatewayError(
  formattedError: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  const code = formattedError.extensions?.code;
  if (typeof code === "string" && CLIENT_SAFE_CODES.has(code)) {
    return {
      message: formattedError.message,
      locations: formattedError.locations,
      path: formattedError.path,
      extensions: { code },
    };
  }

  console.error("gateway GraphQL error:", error);
  Sentry.captureException(error);

  return {
    message: GENERIC_MESSAGE,
    locations: formattedError.locations,
    path: formattedError.path,
    extensions: { code: "INTERNAL_SERVER_ERROR" },
  };
}
