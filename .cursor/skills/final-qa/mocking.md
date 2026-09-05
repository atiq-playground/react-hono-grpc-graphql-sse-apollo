# Mocking Boundaries

Mock only true system boundaries:

- Cloudflare R2 bindings in Worker tests;
- network responses for immutable manifests and artifacts;
- time or randomness where deterministic evidence requires control;
- browser APIs that the test environment cannot provide faithfully.

Prefer:

- small contract-valid fixtures;
- in-memory adapters behind an existing public port;
- real domain and query behavior;
- Mock Service Worker or the repository's established network boundary for React integration;
- Playwright route interception only when a real local Worker path is unavailable or the failure itself is under test.

Do not mock:

- internal modules merely to isolate a function;
- React hooks or child components to assert wiring;
- Web Worker messages without validating their shared contract;
- implementation call order when observable behavior is available.

Every mock should correspond to a named production boundary and return data accepted by the same validator used in production.
