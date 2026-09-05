/**
 * SDL text imports for Apollo typeDefs.
 * Bun resolves `with { type: "text" }` at runtime; tsc 5.x needs this ambient
 * module (Bun's attribute typings require TypeScript 7.1+).
 */
declare module "*.graphql" {
  const typeDefs: string;
  export default typeDefs;
}
