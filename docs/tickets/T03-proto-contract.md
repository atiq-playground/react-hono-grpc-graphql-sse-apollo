# T03 Proto contract and Buf codegen

## Outcome

A single protobuf contract in `packages/proto` defines the columnar block format
and the streaming RPC, generates TypeScript for all three consumers, and is
proven to carry a real gRPC server-streaming call end to end.

This ticket freezes the shape everything downstream depends on. Get it right
here rather than revising it across four other tickets.

## Scope

- `findings.proto` defining:
  - `FindingBlock` as **columnar** parallel arrays, not repeated row messages,
    mirroring how ClickHouse streams native blocks and decoding into worker
    typed arrays with near-zero transform.
  - Dictionary encoding for low-cardinality columns (`severity`, `packageType`,
    `status`, `advisoryType`) carried as an index array plus a per-stream
    dictionary, so repeated strings are sent once.
  - `kaiStatus` as an optional/sparse column, present on 29,005 of 236,656 records.
  - `riskFactors` and `applicableRules` as nested repeated values with offset
    arrays rather than repeated messages.
  - A block sequence number and dataset version for resume support.
  - `FindingsService` with a `StreamFindings(StreamRequest) returns (stream FindingBlock)`
    server-streaming RPC accepting a cursor.
- Buf configuration and codegen producing TypeScript via `@bufbuild/protobuf`.
- Generated output consumed by `apps/producer`, `apps/gateway`, and the browser
  worker in `apps/dashboard`.
- A transport smoke test: a throwaway server and client exchanging several
  blocks over real gRPC.

## Acceptance criteria

- [ ] `buf lint` and `buf generate` succeed and output is reproducible
- [ ] Generated TypeScript typechecks under the repository's strict settings
- [ ] A server-streaming call delivers multiple `FindingBlock` messages to a client and terminates cleanly
- [ ] The dictionary encoding round trips: encode, decode, and compare against the source values
- [ ] The browser-targeted build of the generated code contains no Node-only imports

## Blocked by

- T01 Workspace foundation

## Risks

- **Bun http2 server support.** `node:http2` on Bun 1.3.14 exposes `createServer`,
  `createSecureServer`, and `connect`, but Bun's http2 *server* is newer than its
  client. If Connect-ES gRPC serving misbehaves, run `apps/producer` on Node
  instead; Node v24.19.0 is already installed and the Nx target can select the
  runtime. Discover this here, not in T05.
- Columnar blocks are meaningfully harder to define than repeated row messages,
  but reverting to rows would push per-record object allocation into the worker
  and undermine T08.
- Generated code must be tree-shakeable for the browser bundle; verify before
  T08 depends on it.
