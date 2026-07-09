# Schema Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `cxtms` actually enforce component/field/action JSON schemas, gated behind an opt-in `--schema-enforcement=warn|error` flag so the change is non-breaking under the `^1.9.x` auto-update model.

**Architecture:** Keep the existing Ajv instance (short-key registration) untouched so the default/off path is byte-for-byte identical to today. Add a second Ajv instance registered with each schema's existing `SchemaEntry.uri` (`file:///<abs>`) as its `$id`, which makes the relative `$ref ../schemas.json#/...` references resolve. When `schemaEnforcement` is `'warn'` or `'error'`, validation runs against this enforced instance and findings go to `warnings` (warn) or `errors` (error); compile failures are surfaced instead of swallowed.

**Tech Stack:** TypeScript, Ajv (Draft 7), `ajv-formats`, `yaml`, Vitest, Node.js.

## Global Constraints

- **DO NOT COMMIT.** The user controls commits and will say when. Each task ends with "verify tests pass" — never run `git commit`. Staging (`git add`) is allowed only if the user asks.
- **Off/default behavior is byte-for-byte unchanged.** `schemaEnforcement: false` (and flag-absent at the CLI) must produce the exact same `ValidationResult` and exit code as the current code. Achieved by leaving the existing `this.ajv` instance and its code paths untouched and routing only warn/error through the new instance.
- **`strictMode` is left untouched** (it remains a dead option). Do not read, remove, or repurpose it.
- **`additionalProperties: true` stays** everywhere — do not add `additionalProperties: false` to any schema (would be a breaking tightening).
- Tests run with `npx vitest run` (config: `"test": "vitest run"`). The CLI integration tests require a build first (`npm run build`).
- All file paths are relative to the repo root `/home/zero/Documents/ankocorp/cxtms/cx-schema`. Working branch: `fix/validator-schema-enforcement`.

---

## File Structure

- **Modify `src/types.ts`** — add `schemaEnforcement` to `ValidatorOptions` (inherited by `WorkflowValidatorOptions`).
- **Modify `src/validator.ts`** — store the option; add enforced Ajv instance + URI-keyed registration; gate `validateNestedComponent`; add `addAjvWarnings`.
- **Modify `src/workflowValidator.ts`** — mirror: store option; add enforced instance + URI registration; gate the `workflow.json` check; add `addAjvWarnings`.
- **Modify `src/cli.ts`** — `CLIOptions` field; `parseArgs` default + flag handling; thread into `validateFile`; help text.
- **Modify `schemas/components/layout.json`** — add `'flex'` to `orientation` enum; document real props.
- **Create `src/validator.test.ts`** — regression matrix (off/warn/error) for module + workflow + CLI.
- **Modify `CLAUDE.md`** and the relevant skill ref — document the flag.

---

### Task 1: Add `schemaEnforcement` option + baseline characterization tests

Establishes the option (unused for now) and locks today's behavior so every later task can prove "off mode = unchanged."

**Files:**
- Modify: `src/types.ts:58-62` (`ValidatorOptions`)
- Modify: `src/validator.ts:30-36` (constructor `this.options`)
- Modify: `src/workflowValidator.ts:27-33` (constructor `this.options`)
- Create: `src/validator.test.ts`

**Interfaces:**
- Produces: `ValidatorOptions.schemaEnforcement?: false | 'warn' | 'error'`; both constructors store `this.options.schemaEnforcement` (default `false`). No runtime behavior change yet.

- [ ] **Step 1: Add the option type**

In `src/types.ts`, replace the `ValidatorOptions` interface (lines 58-62):

```ts
export interface ValidatorOptions {
  schemasPath?: string;
  strictMode?: boolean;
  includeWarnings?: boolean;
  schemaEnforcement?: false | 'warn' | 'error';
}
```

- [ ] **Step 2: Store the option in `ModuleValidator`**

In `src/validator.ts`, replace the `this.options = { ... }` block (lines 32-36):

```ts
    this.options = {
      schemasPath: this.schemasDir,
      strictMode: options.strictMode ?? true,
      includeWarnings: options.includeWarnings ?? true,
      schemaEnforcement: options.schemaEnforcement ?? false
    };
```

- [ ] **Step 3: Store the option in `WorkflowValidator`**

In `src/workflowValidator.ts`, replace the `this.options = { ... }` block (lines 27-33):

```ts
    this.options = {
      schemasPath: this.schemasDir,
      strictMode: options.strictMode ?? true,
      includeWarnings: options.includeWarnings ?? true,
      schemaEnforcement: options.schemaEnforcement ?? false,
      validateTasks: options.validateTasks ?? true,
      validateExpressions: options.validateExpressions ?? false
    };
```

- [ ] **Step 4: Write the baseline characterization tests**

Create `src/validator.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ModuleValidator } from './validator';
import { WorkflowValidator } from './workflowValidator';

// Fixtures are written to a temp dir so the repo stays clean.
let tmpDir: string;

function writeFixture(name: string, content: string): string {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, content, 'utf-8');
  return p;
}

// A module whose root layout has an INVALID orientation enum value.
// Today (bug era) this PASSES because component schemas are not enforced.
const INVALID_ORIENTATION_MODULE = `
module:
  name: t
  appModuleId: t
  displayName: {en-US: T}
  application: t
components:
  - name: root
    layout:
      component: layout
      name: l
      props:
        orientation: totallyinvalidvalue
        cols: 2
`;

const VALID_MODULE = `
module:
  name: t
  appModuleId: t
  displayName: {en-US: T}
  application: t
components:
  - name: root
    layout:
      component: layout
      name: l
      props:
        orientation: horizontal
        cols: 2
`;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-schema-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('schemaEnforcement baseline (off mode = current behavior)', () => {
  it('default (off) does NOT flag an invalid layout orientation', async () => {
    const v = new ModuleValidator({});
    const file = writeFixture('invalid.yaml', INVALID_ORIENTATION_MODULE);
    const res = await v.validateModule(file);
    expect(res.isValid).toBe(true);
    expect(res.errors.filter(e => e.type === 'schema_violation')).toHaveLength(0);
  });

  it('explicit off does NOT flag an invalid layout orientation', async () => {
    const v = new ModuleValidator({ schemaEnforcement: false });
    const file = writeFixture('invalid.yaml', INVALID_ORIENTATION_MODULE);
    const res = await v.validateModule(file);
    expect(res.isValid).toBe(true);
    expect(res.errors.filter(e => e.type === 'schema_violation')).toHaveLength(0);
  });

  it('a valid module passes', async () => {
    const v = new ModuleValidator({});
    const file = writeFixture('valid.yaml', VALID_MODULE);
    const res = await v.validateModule(file);
    expect(res.isValid).toBe(true);
  });
});
```

- [ ] **Step 5: Run the tests — they must pass (baseline locks current behavior)**

Run: `npx vitest run src/validator.test.ts`
Expected: PASS (3 tests). These assert today's buggy-but-stable behavior; they stay green for the rest of the plan because off mode is never altered.

- [ ] **Step 6: Do not commit** — the user controls commits.

---

### Task 2: Error-mode enforcement in `ModuleValidator`

Adds the URI-keyed enforced Ajv instance and routes `schemaEnforcement: 'error'` through it so invalid component schemas finally fail validation.

**Files:**
- Modify: `src/validator.ts` — constructor (new instance), new `registerSchemasEnforced`, `validateNestedComponent` (gate), new `addAjvWarnings`

**Interfaces:**
- Consumes: `ValidatorOptions.schemaEnforcement` (from Task 1), `SchemaEntry.uri` (already populated by `loadSchemas`).
- Produces: an enforced validation path; `schemaEnforcement: 'error'` pushes `schema_violation` entries into `errors` and flips `isValid` to `false`.

- [ ] **Step 1: Write the failing test**

Append to `src/validator.test.ts`:

```ts
describe('schemaEnforcement error mode', () => {
  it('flags an invalid layout orientation as an error', async () => {
    const v = new ModuleValidator({ schemaEnforcement: 'error' });
    const file = writeFixture('invalid.yaml', INVALID_ORIENTATION_MODULE);
    const res = await v.validateModule(file);
    expect(res.isValid).toBe(false);
    const violations = res.errors.filter(e => e.type === 'schema_violation');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some(e => /orientation/i.test(e.path))).toBe(true);
  });

  it('still passes a valid module', async () => {
    const v = new ModuleValidator({ schemaEnforcement: 'error' });
    const file = writeFixture('valid.yaml', VALID_MODULE);
    const res = await v.validateModule(file);
    expect(res.isValid).toBe(true);
    expect(res.errors.filter(e => e.type === 'schema_violation')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/validator.test.ts -t "error mode"`
Expected: FAIL — `isValid` is `true` (no enforcement yet), so the first assertion fails.

- [ ] **Step 3: Add the enforced Ajv instance + URI-keyed registration**

In `src/validator.ts`, add a new private field next to `private ajv: Ajv;` (line 25):

```ts
  private ajv: Ajv;
  private ajvEnforced: Ajv;
  private schemas: Map<string, SchemaEntry>;
```

In the constructor, after the existing `this.registerSchemas();` call (line 54), add:

```ts
    // Enforced instance: schemas registered under their file:// URI so that
    // relative $ref (e.g. "../schemas.json#/definitions/localized") resolve.
    // Used only when schemaEnforcement is 'warn' or 'error'.
    this.ajvEnforced = new Ajv({
      strict: false,
      allErrors: true,
      verbose: true,
      validateFormats: true,
      allowUnionTypes: true
    });
    addFormats(this.ajvEnforced);
    this.registerSchemasEnforced();
```

Add the new registration method immediately after the existing `registerSchemas()` method (after line 70):

```ts
  /**
   * Register schemas under their file:// URI so cross-file $ref resolve.
   * Used by the enforced instance for schemaEnforcement 'warn'/'error'.
   */
  private registerSchemasEnforced(): void {
    for (const [key, entry] of this.schemas.entries()) {
      try {
        const schemaWithId = { ...entry.schema, $id: entry.uri };
        this.ajvEnforced.addSchema(schemaWithId, entry.uri);
      } catch (error) {
        console.error(`Error registering enforced schema ${key}:`, error);
      }
    }
  }
```

- [ ] **Step 4: Add the warnings formatter**

In `src/validator.ts`, immediately after the existing `addAjvErrors` method (after line 391), add:

```ts
  /**
   * Convert Ajv errors to warning entries (no schemaPath).
   */
  private addAjvWarnings(
    ajvErrors: ErrorObject[] | null | undefined,
    basePath: string,
    warnings: ValidationWarning[]
  ): void {
    if (!ajvErrors) return;
    for (const error of ajvErrors) {
      warnings.push({
        type: 'schema_violation',
        path: `${basePath}${error.instancePath}`,
        message: error.message || 'Schema validation failed'
      });
    }
  }
```

- [ ] **Step 5: Gate `validateNestedComponent` on the enforcement mode**

In `src/validator.ts`, replace the schema-validation block inside `validateNestedComponent` (the block currently at lines 310-321):

```ts
    // Try to validate against specific component schema
    const schemaKey = `components/${componentType}.json`;
    if (this.schemas.has(schemaKey)) {
      try {
        const validate = this.ajv.getSchema(schemaKey);
        if (validate && !validate(component)) {
          this.addAjvErrors(validate.errors, componentPath, errors);
        }
      } catch (error) {
        // Schema not found or validation error
      }
    }
```

with:

```ts
    // Validate against the specific component schema.
    const schemaKey = `components/${componentType}.json`;
    const entry = this.schemas.get(schemaKey);
    const enforce = this.options.schemaEnforcement;

    if (enforce === 'warn' || enforce === 'error') {
      // Enforced path: URI-keyed instance resolves cross-file $ref.
      if (entry) {
        try {
          const validate = this.ajvEnforced.getSchema(entry.uri);
          if (validate && !validate(component)) {
            if (enforce === 'error') {
              this.addAjvErrors(validate.errors, componentPath, errors);
            } else {
              this.addAjvWarnings(validate.errors, componentPath, warnings);
            }
          }
        } catch (error: any) {
          // Surface compile failures instead of swallowing them.
          const msg = `Schema enforcement skipped for ${schemaKey}: ${error.message}`;
          if (enforce === 'error') {
            errors.push({ type: 'schema_compile_error', path: componentPath, message: msg });
          } else {
            warnings.push({ type: 'schema_compile_error', path: componentPath, message: msg });
          }
        }
      }
    } else if (entry) {
      // Off path: unchanged from original behavior (byte-for-byte).
      try {
        const validate = this.ajv.getSchema(schemaKey);
        if (validate && !validate(component)) {
          this.addAjvErrors(validate.errors, componentPath, errors);
        }
      } catch (error) {
        // Schema not found or validation error
      }
    }
```

- [ ] **Step 6: Run the error-mode tests — they must pass**

Run: `npx vitest run src/validator.test.ts -t "error mode"`
Expected: PASS (2 tests). The invalid orientation now produces a `schema_violation` error and `isValid` is `false`.

- [ ] **Step 7: Run the full file — baseline still green**

Run: `npx vitest run src/validator.test.ts`
Expected: PASS (5 tests: 3 baseline + 2 error mode).

- [ ] **Step 8: Do not commit** — the user controls commits.

---

### Task 3: Warn-mode enforcement in `ModuleValidator`

Warn mode was wired in Step 5 of Task 2 (the `else` branch pushes to `warnings`). This task adds the tests proving warnings surface without flipping `isValid`.

**Files:**
- Modify: `src/validator.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `src/validator.test.ts`:

```ts
describe('schemaEnforcement warn mode', () => {
  it('flags an invalid layout orientation as a warning but stays valid', async () => {
    const v = new ModuleValidator({ schemaEnforcement: 'warn' });
    const file = writeFixture('invalid.yaml', INVALID_ORIENTATION_MODULE);
    const res = await v.validateModule(file);
    expect(res.isValid).toBe(true);
    expect(res.errors.filter(e => e.type === 'schema_violation')).toHaveLength(0);
    const warnings = res.warnings.filter(w => w.type === 'schema_violation');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(w => /orientation/i.test(w.path))).toBe(true);
  });

  it('a valid module produces no schema warnings', async () => {
    const v = new ModuleValidator({ schemaEnforcement: 'warn' });
    const file = writeFixture('valid.yaml', VALID_MODULE);
    const res = await v.validateModule(file);
    expect(res.isValid).toBe(true);
    expect(res.warnings.filter(w => w.type === 'schema_violation')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the tests — they should pass (warn path already implemented in Task 2)**

Run: `npx vitest run src/validator.test.ts -t "warn mode"`
Expected: PASS (2 tests). If a warning assertion fails, re-check that `this.options.includeWarnings` defaults to `true` (it does) so `createResult` returns warnings rather than `[]`.

- [ ] **Step 3: Run the whole suite**

Run: `npx vitest run`
Expected: PASS (all validator tests + the pre-existing 13 `extractUtils` tests).

- [ ] **Step 4: Do not commit** — the user controls commits.

---

### Task 4: Enforcement in `WorkflowValidator`

Mirror the module work for workflows. The top-level `workflow.json` schema transitively `$ref`s task/common/flow schemas, so validating the whole document against it (on the enforced instance) catches bad tasks too.

**Files:**
- Modify: `src/workflowValidator.ts` — constructor (enforced instance + registration), gate the `workflow.json` check (lines 188-192), add `addAjvWarnings`
- Modify: `src/validator.test.ts` (append workflow fixtures + tests)

**Interfaces:**
- Produces: `WorkflowValidator` honors `schemaEnforcement`; off mode uses the unchanged `this.ajv` path (byte-for-byte).

- [ ] **Step 1: Write the failing test**

Append to `src/validator.test.ts`:

```ts
// A minimal valid workflow (Process type) used as a base.
const VALID_WORKFLOW = `
workflow:
  workflowId: w
  name: w
  description: d
  executionMode: Async
  workflowType: Process
activities:
  - name: doThing
    steps:
      - task: utilities/httpRequest
        inputs: {}
inputs: []
outputs: []
`;

describe('schemaEnforcement workflow parity', () => {
  it('off mode: a valid workflow passes (baseline)', async () => {
    const v = new WorkflowValidator({});
    const file = writeFixture('wf.yaml', VALID_WORKFLOW);
    const res = await v.validateWorkflow(file);
    expect(res.errors.filter(e => e.type === 'unexpected_error')).toHaveLength(0);
  });

  it('error mode: a valid workflow passes', async () => {
    const v = new WorkflowValidator({ schemaEnforcement: 'error' });
    const file = writeFixture('wf.yaml', VALID_WORKFLOW);
    const res = await v.validateWorkflow(file);
    expect(res.isValid).toBe(true);
  });
});
```

Note: if the off-mode baseline test reveals that the current `workflow.json` check throws today (surfacing as `unexpected_error`), stop and record it — that is a pre-existing workflow bug being preserved in off mode and fixed under warn/error. Adjust the fixture only if the workflow is rejected for an unrelated structural reason.

- [ ] **Step 2: Run the test to see current state**

Run: `npx vitest run src/validator.test.ts -t "workflow parity"`
Expected: the two tests should PASS already (error mode falls through to the unchanged `this.ajv` path until Step 4). If the error-mode test fails, proceed — Step 4 fixes it.

- [ ] **Step 3: Add the enforced instance + URI registration to `WorkflowValidator`**

In `src/workflowValidator.ts`, add the field next to `private ajv: Ajv;` (line 20):

```ts
  private ajv: Ajv;
  private ajvEnforced: Ajv;
  private schemas: Map<string, SchemaEntry>;
```

In the constructor, after `this.registerSchemas();` (line 51), add:

```ts
    // Enforced instance for schemaEnforcement 'warn'/'error'.
    this.ajvEnforced = new Ajv({
      strict: false,
      allErrors: true,
      verbose: true,
      validateFormats: true,
      allowUnionTypes: true
    });
    addFormats(this.ajvEnforced);
    this.registerSchemasEnforced();
```

After the existing `registerSchemas()` method (after line 146), add:

```ts
  /**
   * Register schemas under their file:// URI so cross-file $ref resolve.
   */
  private registerSchemasEnforced(): void {
    for (const [key, entry] of this.schemas.entries()) {
      try {
        const schemaWithId = { ...entry.schema, $id: entry.uri };
        this.ajvEnforced.addSchema(schemaWithId, entry.uri);
      } catch (error) {
        console.error(`Error registering enforced schema ${key}:`, error);
      }
    }
  }

  /**
   * Convert Ajv errors to warning entries (no schemaPath).
   */
  private addAjvWarnings(
    ajvErrors: ErrorObject[] | null | undefined,
    basePath: string,
    warnings: ValidationWarning[]
  ): void {
    if (!ajvErrors) return;
    for (const error of ajvErrors) {
      warnings.push({
        type: 'schema_violation',
        path: `${basePath}${error.instancePath}`,
        message: error.message || 'Schema validation failed'
      });
    }
  }
```

- [ ] **Step 4: Gate the `workflow.json` check**

In `src/workflowValidator.ts`, replace lines 188-192:

```ts
      // Validate against main workflow schema
      const validate = this.ajv.getSchema('workflow.json');
      if (validate && !validate(workflowData)) {
        this.addAjvErrors(validate.errors, '', errors);
      }
```

with:

```ts
      // Validate against main workflow schema
      const enforce = this.options.schemaEnforcement;
      if (enforce === 'warn' || enforce === 'error') {
        const wfEntry = this.schemas.get('workflow.json');
        try {
          const validate = wfEntry ? this.ajvEnforced.getSchema(wfEntry.uri) : undefined;
          if (validate && !validate(workflowData)) {
            if (enforce === 'error') {
              this.addAjvErrors(validate.errors, '', errors);
            } else {
              this.addAjvWarnings(validate.errors, '', warnings);
            }
          }
        } catch (error: any) {
          const msg = `Schema enforcement skipped for workflow.json: ${error.message}`;
          if (enforce === 'error') {
            errors.push({ type: 'schema_compile_error', path: '', message: msg });
          } else {
            warnings.push({ type: 'schema_compile_error', path: '', message: msg });
          }
        }
      } else {
        // Off path: unchanged (byte-for-byte).
        const validate = this.ajv.getSchema('workflow.json');
        if (validate && !validate(workflowData)) {
          this.addAjvErrors(validate.errors, '', errors);
        }
      }
```

- [ ] **Step 5: Run the workflow tests — they must pass**

Run: `npx vitest run src/validator.test.ts -t "workflow parity"`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the whole suite**

Run: `npx vitest run`
Expected: PASS (all tests).

- [ ] **Step 7: Do not commit** — the user controls commits.

---

### Task 5: CLI flag `--schema-enforcement`

Wire the option through the CLI so `cxtms file.yaml --schema-enforcement=warn|error` works and absence means off.

**Files:**
- Modify: `src/cli.ts` — `CLIOptions` (line 103), `parseArgs` defaults (line 4006) + flag handling (after line 4055), `validateFile` (lines 4974-4980), help text

**Interfaces:**
- Produces: `CLIOptions.schemaEnforcement: false | 'warn' | 'error'`; `validateFile` passes it to both validator constructors.

- [ ] **Step 1: Write the failing CLI integration test**

Append to `src/validator.test.ts`:

```ts
import { execFileSync } from 'child_process';

const DIST_CLI = path.resolve(__dirname, '../dist/cli.js');

function runCli(file: string, ...extra: string[]): any {
  const stdout = execFileSync('node', [DIST_CLI, file, '--format', 'json', ...extra], {
    encoding: 'utf-8'
  });
  return JSON.parse(stdout);
}

describe('CLI --schema-enforcement', () => {
  it('absent flag = off (invalid orientation passes)', () => {
    const file = writeFixture('invalid.yaml', INVALID_ORIENTATION_MODULE);
    const res = runCli(file);
    expect(res.isValid).toBe(true);
  });

  it('--schema-enforcement=error flags the violation', () => {
    const file = writeFixture('invalid.yaml', INVALID_ORIENTATION_MODULE);
    const res = runCli(file, '--schema-enforcement=error');
    expect(res.isValid).toBe(false);
  });

  it('--schema-enforcement=warn stays valid', () => {
    const file = writeFixture('invalid.yaml', INVALID_ORIENTATION_MODULE);
    const res = runCli(file, '--schema-enforcement=warn');
    expect(res.isValid).toBe(true);
    expect((res.warnings || []).filter((w: any) => w.type === 'schema_violation').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails (no flag yet)**

Build first, then run:
```bash
npm run build
npx vitest run src/validator.test.ts -t "CLI --schema-enforcement"
```
Expected: FAIL — `--schema-enforcement=error` is unknown, so the validator gets no option and `isValid` stays `true`.

- [ ] **Step 3: Add the `CLIOptions` field**

In `src/cli.ts`, inside `interface CLIOptions` (starts line 103), add a field (e.g. after `quiet: boolean;` at line 114):

```ts
  quiet: boolean;
  schemaEnforcement: false | 'warn' | 'error';
```

- [ ] **Step 4: Add the default in `parseArgs`**

In `src/cli.ts`, in the `options` object literal inside `parseArgs` (starts line 4006), add the default (e.g. after `quiet: false,` at line 4016):

```ts
    quiet: false,
    schemaEnforcement: false,
```

- [ ] **Step 5: Parse the flag**

In `src/cli.ts`, in the argument loop inside `parseArgs`, add a branch after the `--quiet` branch (after line 4055):

```ts
    } else if (arg === '--quiet' || arg === '-q') {
      options.quiet = true;
    } else if (arg === '--schema-enforcement') {
      const seArg = args[++i];
      if (seArg === 'warn' || seArg === 'error') {
        options.schemaEnforcement = seArg;
      } else {
        console.error(chalk.red(`Invalid --schema-enforcement value: ${seArg}. Use: warn or error`));
        process.exit(2);
      }
    } else if (arg === '--json') {
```

- [ ] **Step 6: Thread the option into `validateFile`**

In `src/cli.ts`, replace the validator construction inside `validateFile` (lines 4972-4980):

```ts
  if (fileType === 'workflow') {
    const validator = new WorkflowValidator({
      schemasPath: path.join(schemasPath, 'workflows')
    });
    return validator.validateWorkflow(filePath);
  } else {
    const validator = new ModuleValidator({ schemasPath });
    return validator.validateModule(filePath);
  }
```

with:

```ts
  if (fileType === 'workflow') {
    const validator = new WorkflowValidator({
      schemasPath: path.join(schemasPath, 'workflows'),
      schemaEnforcement: options.schemaEnforcement
    });
    return validator.validateWorkflow(filePath);
  } else {
    const validator = new ModuleValidator({
      schemasPath,
      schemaEnforcement: options.schemaEnforcement
    });
    return validator.validateModule(filePath);
  }
```

- [ ] **Step 7: Document the flag in help text**

In `src/cli.ts`, find the OPTIONS help block (the chalk template listing `-h`, `--verbose`, `--quiet`, etc.). Add this line next to `--verbose` / `--quiet`:

```ts
  ${chalk.green('--schema-enforcement <mode>')}  Enforce component/field schemas: ${chalk.cyan('warn')} or ${chalk.cyan('error')} ${chalk.gray('(default: off)')}
```

- [ ] **Step 8: Rebuild and run the CLI tests — they must pass**

```bash
npm run build
npx vitest run src/validator.test.ts -t "CLI --schema-enforcement"
```
Expected: PASS (3 tests).

- [ ] **Step 9: Do not commit** — the user controls commits.

---

### Task 6: Align `schemas/components/layout.json`

Bring the layout schema in line with the real renderer so enforcement does not generate false positives. Adds `'flex'` to orientation and documents props the renderer reads.

**Files:**
- Modify: `schemas/components/layout.json`
- Modify: `src/validator.test.ts` (add a flex test)

- [ ] **Step 1: Write the failing test**

Append to `src/validator.test.ts`:

```ts
describe('layout orientation flex', () => {
  const FLEX_MODULE = `
module:
  name: t
  appModuleId: t
  displayName: {en-US: T}
  application: t
components:
  - name: root
    layout:
      component: layout
      name: l
      props:
        orientation: flex
        cols: 1
`;

  it('error mode accepts orientation: flex (renderer supports it)', async () => {
    const v = new ModuleValidator({ schemaEnforcement: 'error' });
    const file = writeFixture('flex.yaml', FLEX_MODULE);
    const res = await v.validateModule(file);
    const orientationViolations = res.errors.filter(
      e => e.type === 'schema_violation' && /orientation/i.test(e.path)
    );
    expect(orientationViolations).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/validator.test.ts -t "orientation flex"`
Expected: FAIL — the current enum is `["horizontal", "vertical"]`, so `flex` is flagged.

- [ ] **Step 3: Update the orientation enum**

In `schemas/components/layout.json`, replace the `orientation` property (currently):

```json
        "orientation": {
          "type": "string",
          "enum": ["horizontal", "vertical"],
          "description": "Layout orientation"
        },
```

with:

```json
        "orientation": {
          "type": "string",
          "enum": ["horizontal", "vertical", "flex"],
          "description": "Layout orientation. 'flex' renders children in a flex container."
        },
        "direction": {
          "type": "string",
          "enum": ["row", "column"],
          "description": "Flex direction (used with orientation: flex)"
        },
```

- [ ] **Step 4: Document the real renderer props**

In `schemas/components/layout.json`, inside the `props.properties` object (after `toolbar`), add the props the renderer actually reads (keep `additionalProperties` absent/true):

```json
        "columns": {
          "type": ["integer", "object"],
          "description": "Responsive 12-col grid: integer or per-breakpoint map (xs/sm/md/lg/xl)"
        },
        "spacing": {
          "description": "Grid spacing (number, string, or per-breakpoint map)"
        },
        "columnSpacing": { "description": "Column spacing" },
        "rowSpacing": { "description": "Row spacing" },
        "containerTag": {
          "type": "string",
          "enum": ["grid", "box"],
          "description": "Container element"
        },
        "containerSx": { "description": "MUI sx applied to the container" },
        "itemDefaults": {
          "type": "object",
          "description": "Default size/offset/order/sx applied to each child"
        },
        "className": { "type": "string", "description": "Container CSS class" },
        "childClassName": { "type": "string", "description": "CSS class applied to each child" },
        "id": { "type": "string" },
        "isVisible": { "type": "boolean" },
        "isHidden": { "type": "boolean" },
        "options": { "type": "object" },
        "justifyContent": {
          "type": "string",
          "enum": ["flex-start", "flex-end", "center", "space-between", "space-around", "space-evenly"]
        },
        "alignItems": {
          "type": "string",
          "enum": ["flex-start", "flex-end", "center", "stretch", "baseline"]
        },
        "margin": { "type": ["number", "string"] },
        "marginTop": { "type": ["number", "string"] },
        "marginBottom": { "type": ["number", "string"] },
        "marginLeft": { "type": ["number", "string"] },
        "marginRight": { "type": ["number", "string"] },
        "padding": { "type": ["number", "string"] },
        "paddingTop": { "type": ["number", "string"] },
        "paddingBottom": { "type": ["number", "string"] },
        "paddingLeft": { "type": ["number", "string"] },
        "paddingRight": { "type": ["number", "string"] }
```

(Do NOT add `additionalProperties: false`. `title`, `icon`, `toolbar`, `permission` remain — they are consumed by the screen shell at the root layout.)

- [ ] **Step 5: Sync the gitignored local copy (development only)**

Run:
```bash
cp schemas/components/layout.json .cx-schema/components/layout.json 2>/dev/null || true
```
(The consuming-project copy is regenerated by `postinstall.js`; this keeps the local dev copy in sync. The `|| true` handles the case where `.cx-schema/` does not exist.)

- [ ] **Step 6: Run the flex test — it must pass**

Run: `npx vitest run src/validator.test.ts -t "orientation flex"`
Expected: PASS.

- [ ] **Step 7: Run the whole suite**

Run: `npx vitest run`
Expected: PASS (all tests).

- [ ] **Step 8: Do not commit** — the user controls commits.

---

### Task 7: Docs + skills sync, and final verification

Document the flag where users and Claude Code look, and run a real-world check against `cx-app`.

**Files:**
- Modify: `CLAUDE.md` (CLI table)
- Modify: skill ref that documents CLI flags (locate via grep)

- [ ] **Step 1: Locate the skill CLI reference**

Run:
```bash
grep -rln "npx cxtms <file.yaml> --verbose\|--schema-enforcement\|cxtms <file.yaml>" skills/ CLAUDE.md docs/ 2>/dev/null
```
Open each hit and find the CLI options/flags list.

- [ ] **Step 2: Add the flag to `CLAUDE.md`'s CLI table**

In `CLAUDE.md`, find the validation row:

```markdown
| `npx cxtms <file.yaml> --verbose` | Validate with detailed errors |
```

Add directly after it:

```markdown
| `npx cxtms <file.yaml> --schema-enforcement=warn\|error` | Enforce component/field schemas (off by default; `warn` reports, `error` fails) |
```

- [ ] **Step 3: Add the flag to the skill reference**

In the skill file located in Step 1, add a row/line documenting `--schema-enforcement=warn|error` alongside the other validation flags, with the same wording as Step 2.

- [ ] **Step 4: Final full test run**

```bash
npm run build
npx vitest run
```
Expected: all tests PASS (13 `extractUtils` + the new `validator` tests).

- [ ] **Step 5: Real-world sanity check against cx-app**

Run the enforced validator on a few real cx-app modules (read-only — do not modify them):

```bash
node dist/cli.js "/home/zero/Documents/ankocorp/cxtms/cx-app/cx-app-core/modules/carrierrates-module.yaml" --schema-enforcement=warn
node dist/cli.js "/home/zero/Documents/ankocorp/cxtms/cx-app/cx-app-core/modules/datagrid module-module.yaml" --schema-enforcement=warn
```

Expected: both run without crashing; warnings (if any) are real schema gaps, not false positives from documented props. Confirm the default (no flag) still reports `✓ PASSED` identically to before:

```bash
node dist/cli.js "/home/zero/Documents/ankocorp/cxtms/cx-app/cx-app-core/modules/carrierrates-module.yaml"
```

- [ ] **Step 6: Do not commit** — the user controls commits. Report results and await instruction.

---

## Self-Review

**Spec coverage:**
- §1 fix (URI-keyed registration) → Task 2 Step 3 (`registerSchemasEnforced`) + Task 4 Step 3. ✓
- §2 `schemaEnforcement` option + severity contract → Task 1 (option), Task 2/3 (error/warn), Tasks 1 & 5 (off byte-for-byte). ✓
- §3 CLI flag → Task 5. ✓
- §4 surface compile failures → Task 2 Step 5 `catch`, Task 4 Step 4 `catch` (replaces silent swallow). ✓
- §5 layout.json alignment → Task 6. ✓
- §6 tests → Tasks 1-6. ✓
- §7 rollout (non-breaking) → guaranteed by the two-instance design (off path untouched) + Task 7 Step 5 sanity check. ✓
- §8 skills/CLI doc sync → Task 7. ✓

**Placeholder scan:** no TBD/TODO; every code step contains concrete code; the one "locate via grep" (Task 7 Step 1) includes the exact grep command and the exact text to add.

**Type consistency:** `schemaEnforcement: false | 'warn' | 'error'` is identical in `types.ts`, both constructors, `CLIOptions`, the `parseArgs` default, and every test. `registerSchemasEnforced` / `addAjvWarnings` names match across module and workflow validators. `entry.uri` lookup is used consistently in both enforced paths.

**Byte-for-byte guarantee:** the off path calls the original `this.ajv.getSchema(schemaKey)` with the original try/catch in both validators — no line of the original off-path logic is changed, so default output is unchanged.
