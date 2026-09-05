# T04 Dataset ingest

## Outcome

The 389MB nested source corpus is flattened and loaded into ClickHouse once, as
a genuine ETL step, so every subsequent query reads pre-parsed columnar data
rather than re-parsing JSON.

## Scope

- Copy `ui_demo.json` into `apps/producer/data/raw/` and confirm it is gitignored.
  The only copy on the machine today is at
  `../security-vulnerability-dashboard/ui_demo.json`.
- An `ingest` Nx target (`bunx nx run producer:ingest` →
  `apps/producer/scripts/ingest.ts`) that:
  - Streams the file with a bounded SAX or token parser. The corpus is never
    parsed wholesale into memory.
  - Walks the `groups -> repos -> images -> vulnerabilities[]` hierarchy,
    flattening each vulnerability into one row carrying its group, repo, and
    image context.
  - Preserves source-provided context values that are blank rather than omitting
    or inferring them, per the Source Context definition in
    [CONTEXT.md](../CONTEXT.md).
  - Performs a streaming batched `INSERT` into ClickHouse.
  - Reports progress and a final row count.

## Expected corpus shape

Verified from a bounded schema inspection of the source:

- 236,656 vulnerability objects
- 45 groups, 740 repositories, 1,030 images
- 1,030 vulnerability arrays, of which 1,025 are non-empty
- `kaiStatus` present on 29,005 records
- `riskFactors` non-empty on 234,200 records, empty on 2,456
- `applicableRules`: 236,656 arrays holding 288,919 items total
- All other observed fields present on all 236,656 records

## Acceptance criteria

- [ ] `SELECT count() FROM findings` returns exactly 236,656
- [ ] `SELECT uniqExact(group)` returns 45 and `uniqExact(image)` returns 1,030
- [ ] `SELECT countIf(kaiStatus IS NOT NULL)` returns 29,005
- [ ] Peak resident memory during ingest stays bounded and well under the file size
- [ ] Re-running ingest is idempotent, or refuses to run against a populated table without an explicit flag
- [ ] Blank source values remain blank in ClickHouse and are distinguishable from nulls

## Blocked by

- T02 Local infrastructure

## Risks

- A naive `JSON.parse` will consume roughly a gigabyte of heap and must not be used.
- The hierarchy is deeply nested, so the parser must track its path to attribute
  each vulnerability to the correct group, repo, and image.
- Row counts are the contract for this ticket. If any assertion above disagrees
  with reality, stop and re-inspect rather than adjusting the expected numbers.
