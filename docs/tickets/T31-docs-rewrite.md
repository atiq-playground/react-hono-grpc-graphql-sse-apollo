# T31 Documentation rewrite for the shipped architecture

## Outcome

Every canonical document describes the ClickHouse-authoritative architecture
that is actually running after T30. The old browser-owned corpus index and
browser-side ingestion-block vocabulary is retired, the new live and pagination
vocabulary is defined, and the rules, tech stack, structure map, README, and
ticket index agree with the code.

## Scope

- `docs/RULES.md`: full pass beyond the T18 minimal edits. Remove remaining
  worker or columnar-block phrasing, describe the bounded GraphQL query
  contract, `DatasetEvent` SSE relay, server-side export, and the Zustand
  scope (live and connection state only).
- `docs/CONTEXT.md`: retire the old browser-owned index and the browser-unit
  sense of **Finding Block** (keep it as the gRPC ingestion unit); redefine **Stream
  Cursor** as the Redis entry id carried in `Last-Event-ID`; add **Dataset
  Event**, **Cursor** (keyset pagination cursor), **Time Range** (presets and
  the `publishedAt` semantics, Live versus windowed), and **Export Job**.
- `docs/TECH_STACK.md`: remove Web Worker and browser protobuf; add Redis
  Streams, GraphQL codegen, `react-day-picker` (if adopted in T26), and
  GraphQL response compression plus the intentional identity encoding of SSE.
- `AGENTS.md`: rewrite the Delivery Phases to include Phase 5 with its
  verifiable end state, and refresh the engineering principle on query work
  (ClickHouse authoritative, no heavy transforms on the render thread).
- `docs/STRUCTURE.md`: map the post-T30 tree (`features/explore`,
  `features/overview`, `features/live`, `graphql/` modules on the gateway,
  `packages/shared` contracts, no legacy browser query worker directory).
- `README.md`: setup sequence including `ingest --force`, the simulator
  variable, and how to observe live updates.
- `docs/tickets/README.md`: update the phase seams, index, and conventions so
  the ticket set and docs agree; note T32 owns tests.
- `.cursor/rules/**`: sweep for remaining old worker, browser-index, or stream
  bootstrap wording not caught in T18 (including `typescript/*.mdc` examples
  and `common/security.mdc`).

## Implementation evidence and status

- Canonical docs now distinguish 236,656 Source Records from 236,653 current
  Findings and define the identity tuple including `packageVersion`.
- Ticket acceptance checkboxes remain historical rather than being
  mass-updated from source inspection. The ticket index records
  implementation-by-source separately from pending T32 runtime evidence.
- ADR-0002 remains proposed. Its browser protobuf option is documented only as
  deferred architecture, never as current runtime.

## Acceptance criteria

- [ ] `rg -n -i "compact[ ]index|query[-]worker|worker[-]protocol|stream[D]escriptor|base6[4]" docs AGENTS.md README.md .cursor/rules` returns only ADR history and superseded-ticket content
- [ ] `docs/CONTEXT.md` defines Dataset Event, Cursor, Time Range, and Export Job and no longer defines the retired browser index
- [ ] `docs/RULES.md`, `AGENTS.md`, `docs/TECH_STACK.md`, and `docs/tickets/README.md` agree with each other and with the code after T30
- [ ] `docs/STRUCTURE.md` matches the actual tree (spot-check every listed directory exists)
- [ ] No document links to a file that does not exist
- [ ] `README.md` setup instructions are followable from a clean clone with Docker running
- [ ] No emojis are present in any committed documentation

## Blocked by

- T30 Cleanup

## Risks

- Rewriting `RULES.md` while T32 is still pending can change what QA is
  supposed to verify; finish this ticket before T32 starts.
- A Finding must still not be equated with a CVE. Current Finding identity is
  now settled by bounded source evidence and product requirements.
- Superseded tickets T05 through T12 stay in the tree as history; do not
  delete or rewrite them here.
