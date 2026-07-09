# Schema Enforcement Design

## Problem

The `cxtms` validator reports `✓ PASSED` while **not enforcing** the per-component/field/action JSON schemas. Today it functions as a module-structure linter plus a handful of self-contained schemas; the bulk of `schemas/` is documentation-only.

Root cause: component/field/action schemas use `$ref: "../schemas.json#/definitions/..."`, but Ajv cannot resolve the reference. Schemas are registered under short keys (`schemas.json`, `components/layout.json`), and Ajv normalizes the relative ref to `/schemas.json`, which matches nothing. The schema fails to compile; that throw is swallowed by an empty `catch` at `validator.ts:318` (mirrored at `workflowValidator.ts:225`), so per-component validation silently never runs.

Evidence (verified 2026-06-18):

- A module containing `orientation: totallyinvalidvalue` on a layout passes `node dist/cli.js` with 0 errors. Compiling `schemas/components/layout.json` directly with Ajv correctly rejects it (`enum` error).
- Scope of the broken ref: **22/25 component schemas (88%)** and **17/18 field schemas (94%)** `$ref` into `schemas.json`; only schemas without such a cross-ref (e.g. `slot`, `navigate`, `refresh`) actually enforce.
- Both `ModuleValidator` and `WorkflowValidator` share the pattern (own `registerSchemas()`, own loader, same empty `catch`).
- No test covers the validator: the only test file is `src/extractUtils.test.ts` (13 tests, all for the `extract` command). The green suite is why the defect went undetected.
- The `SchemaEntry.uri` field (`{ schema, uri }`, `types.ts:50`) is populated as `file:///<abs-path>` by both loaders but **never used** at registration time — strong evidence of the intended design.

## Scope

Make component/field/action schema enforcement actually work, gated behind an **opt-in flag** so the change is non-breaking under the `^1.9.x` auto-update model (consuming projects like `cx-app-core` pin `"cxtms": "^1.9.67"`; current is 1.9.79, so any 1.9.x/1.10.x release auto-applies via `npx cxtms update`).

In scope: validator fix, new `schemaEnforcement` option + CLI flag, silent-catch surfacing, `layout.json` alignment, regression tests, skills/CLI doc sync.

Non-goals (see "Out of scope"): flipping the default to warn, removing the dead `strictMode` option, full alignment of every component/field schema, setting `additionalProperties: false` anywhere.

## Changes

### 1. Fix — URI-keyed schema registration

Reuse the already-computed `SchemaEntry.uri` (`file:///<abs-path>`). In `registerSchemas()` of both validators, register every schema — including `schemas.json` — **under its file:// URI as the Ajv `$id`** (e.g. `addSchema({ ...entry.schema, $id: entry.uri }, entry.uri)`). Then `../schemas.json` resolves against `file:///<abs>/schemas/components/layout.json` → `file:///<abs>/schemas/schemas.json`, which matches.

Change the `getSchema(...)` call sites to look up by URI. Add a `schemaUriFor(type)` helper — a `Map<string, string>` of component type → URI built at load time (or derived from `schemasDir`).

Apply identically to:

- `ModuleValidator` (`validator.ts`) — uses shared `loadSchemas` (`src/utils/schemaLoader.ts`) for `components/`, `fields/`, `actions/`.
- `WorkflowValidator` (`workflowValidator.ts`) — uses its own `loadWorkflowSchemas` for `workflows/`.

Rationale: explains the dead `uri` field, edits no schema files, adds no dependency, fixes both validators symmetrically.

### 2. New `schemaEnforcement` option + severity contract

Add a new `ValidatorOptions` field alongside the untouched `strictMode`:

```ts
schemaEnforcement?: false | 'warn' | 'error';   // default false
```

| Value | Component schemas enforced? | Violations reported as | Affects `valid`? | Exit code |
|---|---|---|---|---|
| `false` (default) | No — skipped entirely | — | No | unchanged |
| `'warn'` | Yes | **warnings** | No (`valid` stays structural-only) | 0 (unless structural errors) |
| `'error'` | Yes | **errors** | Yes (`valid = false` on any) | 1 |

Contract guarantee for backward compatibility: **`false` (and flag-absent) must produce byte-for-byte the same `ValidationResult` and exit code as today.** Warnings never flip `valid` or the exit code.

### 3. CLI wiring — `--schema-enforcement=warn|error`

- Absent → `schemaEnforcement: false`.
- `=warn` / `=error` → threaded into the validator constructor in `validateFile` (`cli.ts:4974–4980`).
- Bare flag or invalid value → error: *"must be one of: warn, error"*.
- No `off`/`false`/`none` CLI value — omitting the flag already means off (standard value-flag convention; keeps help text clean).
- Document in CLI help (`cli.ts` command list + OPTIONS section).

### 4. Surface schema-compile failures (replaces the silent catch)

The empty `catch` at `validator.ts:318` and `workflowValidator.ts:225`, plus the `registerSchemas` catches (`validator.ts:66`, `workflowValidator.ts:142`), become observable:

- Under `'warn'`: emit a warning, e.g. *"Schema enforcement skipped for components/foo.json: <reason>"*.
- Under `'error'`: emit an error.
- Under `false`: not attempted (enforcement is skipped up front).

This prevents a future broken `$ref` from silently disabling enforcement again.

### 5. Schema alignment — `schemas/components/layout.json`

So the new enforcement does not generate false positives, bring `layout.json` in line with the real renderer (`tms-frontend-web/.../layout-component.tsx`):

- Add `'flex'` to the `orientation` enum (impl supports `horizontal | vertical | flex`); note `direction: 'row' | 'column'`.
- Document the props the renderer actually reads: `className`, `childClassName`, `columns`, `containerTag`, `spacing`, `direction`, `justifyContent`, `alignItems`, `containerSx`, `itemDefaults`, `options`, `id`, `isVisible` / `isHidden`, and the margin/padding family.
- Keep `title`, `icon`, `toolbar`, `permission` — these are consumed by the screen/route shell from the root layout (`AppComponentScreen.tsx`, `appComponentScreen.screen.tsx`), not by `layout-component.tsx`; they are accurate as route-level metadata.
- **Keep `additionalProperties: true`** so undocumented props never trigger violations.

Source: cx-app scan (636 YAMLs / 3482 layout nodes) confirmed real-world usage: `className` (660), `childClassName` (327), `columns` (88), `containerTag` (78), `orientation: flex` (3), etc.

### 6. Tests — new `src/validator.test.ts`

Add the regression suite that should have existed:

- **Off (`false`)**: `orientation: <garbage>` → no schema error (locks bug-era behavior).
- **Warn (`'warn'`)**: same input → warning, `valid` true.
- **Error (`'error'`)**: same input → error, `valid` false.
- **Good input**: valid module → clean across all modes.
- **No-ref parity**: a `slot` violation still errors in `'error'` mode (guards against regressing already-working schemas).
- **flex passes**: after the enum fix, `orientation: flex` → no error in `'error'` mode.
- **Workflow parity**: a bad workflow task → warn/error per mode.
- **Compile-failure surfacing**: fixture with a deliberately-broken `$ref` → warn/error per mode (no longer silent).
- **CLI**: `--schema-enforcement=warn|error` flows through; absent flag = off.

### 7. Rollout & compatibility

- Ships as a **non-breaking minor/patch** (e.g. 1.9.80). Default off → `^1.9.x` consumers are unaffected on auto-update.
- Individual devs / CI pipelines opt in via `--schema-enforcement=warn|error` on their own schedule.

### 8. Skills & CLI doc sync

Per the repo rule "keep skills and CLI in sync": document `--schema-enforcement` in the relevant skill files (`cxtms-module-builder` / `cxtms-developer` SKILL.md or ref docs) so Claude Code surfaces the flag, and in the CLI help text.

## Out of scope

- Flipping the default to `'warn'` (future major).
- Removing the dead `strictMode` option (separate, technically API-breaking cleanup).
- Full alignment of all component/field/action schemas (same `additionalProperties: true` safety makes partial docs non-breaking; follow-up).
- Setting `additionalProperties: false` anywhere (would be a breaking tightening).

## Decisions locked

| Decision | Value |
|---|---|
| Fix mechanism | URI-keyed schema registration (reuse `SchemaEntry.uri`) |
| Control | New `schemaEnforcement` option + `--schema-enforcement=warn\|error` flag (absence = off) |
| `strictMode` | Untouched (left as-is) |
| Severity contract | warnings never affect `valid`/exit; errors do |
| Rollout | Opt-in, non-breaking, 1.9.x/1.10.x |
| `additionalProperties` | Stays `true` everywhere |

## References

- `src/validator.ts:60–80` (registerSchemas/getSchemaId), `:310–321` (component schema validate + silent catch), `:249–344` (validateComponent/NestedComponent)
- `src/workflowValidator.ts:138–142` (registerSchemas), `:189` / `:225` (getSchema + catch)
- `src/utils/schemaLoader.ts` (loadSchemas, `uri` field), `src/types.ts:50` (SchemaEntry)
- `src/cli.ts:4974–4980` (validateFile), `:5211` (update command), `scripts/postinstall.js` (consumer install → `.cx-schema/`)
- `schemas/components/layout.json`, `schemas/schemas.json`
- Consumer scan: `cx-app/` (6 sub-projects)
