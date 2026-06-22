# Workflow Input Presence Validator — Design

Date: 2026-06-22
Status: Draft

## 1. Goal

Extend the `WorkflowValidator` in `cx-schema` so that, when `--schema-enforcement=warn|error` is enabled, it can tell whether a required task input key is supplied either:

- directly in `step.inputs`, or
- by an in-scope variable (global, activity, control-flow loop, or `SetVariable`).

It should also emit lightweight warnings when a step input value, condition, or output mapping references a variable that is not known to be in scope.

Validation without the flag must remain unchanged.

## 2. Background

The current validator (`src/workflowValidator.ts`) already checks the generated `task-required-inputs.json` catalog under `--schema-enforcement`. For each step whose task is in the catalog, it verifies that every required key exists in `step.inputs`. It also treats workflow-level `inputs[*].name` as available variables.

What it does **not** do:

- recognize variables introduced by `workflow.variables`, `activity.variables`, or `Utilities/SetVariable`
- recognize loop variables inside `foreach` / `while`
- track step outputs as available dotted paths (`ActivityName.StepName.outputName`)
- warn when a value references an undefined variable root

This design closes those gaps without attempting full template evaluation or branch-correctness proofs.

## 3. Scope

In scope:

- Required-key presence check extended to all known in-scope variable sources.
- Basic reference scanning inside step input values, conditions, and output mappings.
- Control-flow scope: `foreach` / `while` loop vars, `switch` cases not leaking branch-local vars.
- Respects `--schema-enforcement=warn` vs `--schema-enforcement=error`.

Out of scope:

- Type checking of input values.
- Deep evaluation of templates, expressions, or mapping objects.
- Sound branch-sensitive dataflow analysis (e.g., proving a variable is defined on every path).
- Changing default validation behavior when enforcement is off.

## 4. Design

### 4.1 Scope context

Validation will carry a small immutable-ish context object through the walk:

```ts
interface ScopeContext {
  globals: Set<string>;       // top-level names known so far
  nestedPaths: Set<string>;   // ActivityName.StepName.outputName paths
  loopVars: Set<string>;      // item, index, iteration, etc.
}
```

Each call receives a copy, so nested control-flow tasks can add local names without affecting siblings or the post-control-flow scope.

### 4.2 Variable sources

The following names are added to scope as validation walks the document:

| Source | Names added | Scope |
|---|---|---|
| `workflow.inputs[*].name` | input name | global |
| `workflow.variables[*].name` | variable name | global |
| activity `variables[*].name` | variable name | activity-local copy of globals |
| `Utilities/SetVariable` `inputs.variables[*].name` | variable name | global (mutates the running scope) |
| step `outputs[*].name` | `activityName.stepName.outputName` | nestedPaths |
| `foreach` | `item` (or custom name) + `index` | loopVars for nested steps |
| `while` | `iteration` | loopVars for nested steps |

Trigger-specific globals (e.g., `entity`, `entityId`, `eventType`, `changes` for entity triggers) are seeded based on the workflow's declared trigger types.

System-injected variables (`organizationId`, `workflowId`, `currentUserId`, …) are already excluded from the required-input catalog, so they do not need special handling for the presence check. They may be added to the scope for completeness.

### 4.3 Required-input check

For a step whose task is in `task-required-inputs.json`, for each required key `k`:

```ts
const providedLocally = step.inputs && typeof step.inputs === 'object' && k in step.inputs;
const providedByScope = ctx.globals.has(k) || ctx.loopVars.has(k);
if (!providedLocally && !providedByScope) {
  // warn or error depending on schemaEnforcement
}
```

`nestedPaths` is not used here because required keys are top-level input keys, not dotted paths.

### 4.4 Reference scanning

A lightweight scanner extracts root variable names from:

- string templates: `{{foo.bar}}` → `foo`
- NCalc conditions/expressions: `[foo] == 1` → `foo`
- mapping object roots: `foreach`, `extends`, `switch.expression`, `coalesce` items, `resolve.filter`, `expression`

For each referenced root `r`, if `r` is not in `ctx.globals || ctx.loopVars || ctx.nestedPaths`, emit an `undefined_variable_reference` warning/error.

The scanner is intentionally shallow. It does not evaluate expressions or follow nested template resolution.

### 4.5 Control-flow handling

- **`foreach` / `while`**: nested steps receive a scope copy with loop vars added. Variables set inside the loop body are merged back into the parent scope optimistically (matching the runtime, which writes loop outputs back to `activityVariables`).
- **`switch`**: each case receives a copy of the pre-switch scope. Variables set inside a case are **not** merged into the post-switch scope, because only one case runs at runtime.
- **Activity / workflow event handlers**: validated with the scope that exists at the point they would run (`onActivityStarted` before steps, `onActivityCompleted`/`onActivityFailed` after steps).

### 4.6 Error reporting

Two new validation types:

- `missing_required_input` — required key not in `step.inputs` and not in scope.
- `undefined_variable_reference` — referenced root not in scope.

Severity is controlled by `schemaEnforcement`:

- `off` — checks skipped.
- `warn` — added to `warnings[]`.
- `error` — added to `errors[]`.

Paths use the existing `locationMap` so editors can jump to the offending YAML line.

## 5. Testing

There is no automated test suite in `cx-schema`. Verification is manual:

1. Create workflow YAMLs covering:
   - missing required input satisfied by workflow variable
   - missing required input satisfied by `SetVariable`
   - undefined reference in a template
   - loop variable used inside and outside `foreach`
   - branch-local variable not leaking from `switch`
   - output path reference (`ActivityName.StepName.outputName`)
2. Run:
   - `npx cxtms <file.yaml>` — no new output
   - `npx cxtms <file.yaml> --schema-enforcement=warn` — expected warnings
   - `npx cxtms <file.yaml> --schema-enforcement=error` — expected failures
3. Regenerate `task-required-inputs.json` if backend handlers changed (`node scripts/generate-task-required-inputs.js`).

## 6. Options considered

| Option | Scope | Effort | Verdict |
|---|---|---|---|
| 1 — expand required-key presence only | globals + variables + SetVariable | 1–2 days | too limited |
| 2 — track outputs/loops + basic reference lint (this design) | everything in §4 | 3–5 days | **selected** |
| 3 — branch-sensitive dataflow | definite/possible definitions per branch | 2–3 weeks | excessive false positives |
| 4 — full value-level linter | deep parsing of all mapping objects | +1–1.5 weeks | overkill for first version |

## 7. Open questions

- Should trigger-specific seed variables be inferred automatically from `workflow.triggers`, or should a fixed list be used? This design proposes inferring from declared triggers.
- Should `undefined_variable_reference` be emitted for dotted paths that match `nestedPaths` but are referenced without the full prefix? This design keeps `nestedPaths` separate and only warns on exact root matches.

## 8. Files affected

- `src/workflowValidator.ts` — main implementation
- `schemas/workflows/task-required-inputs.json` — no structural change, but regeneration may be needed
- `docs/superpowers/specs/2026-06-22-workflow-input-validation-design.md` — this document
