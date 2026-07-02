# Source Locations in Validation Output — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add source line/column information to validation errors and warnings, surfaced as `path (line N, col M)` by default and suppressible with `--no-line-numbers`.

**Architecture:** A shared `src/yamlLocationResolver.ts` utility builds a path-to-position map from the `yaml` AST. Both validators look up each error/warning path in this map and attach an optional `location` field. The CLI formats the location and strips it when `--no-line-numbers` is passed.

**Tech Stack:** TypeScript, `yaml` v2.x, `ajv` v8.x, Node.js `fs`.

## Global Constraints

- Line and column numbers are 1-based.
- `location` is optional on `ValidationError` and `ValidationWarning` to preserve API backward compatibility.
- If a path cannot be resolved, omit the location suffix — no hardcoded fallback.
- If location-map construction fails, validation continues without locations.
- `--no-line-numbers` suppresses location rendering in both human-readable and JSON output.
- Output format is `path (line N, col M)`.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/yamlLocationResolver.ts` (new) | Parse YAML to AST and build a path-to-position map; expose `buildLocationMap(yamlText)` and `YAMLLocationMap.lookup(path)`. |
| `src/types.ts` (modify) | Add optional `location?: { line: number; column: number }` to `ValidationError` and `ValidationWarning`. |
| `src/validator.ts` (modify) | Build location map from module YAML; attach `location` to every error/warning; pass map to Ajv error helpers. |
| `src/workflowValidator.ts` (modify) | Build location map from workflow YAML; attach `location` to every error/warning; pass map to Ajv error helpers. |
| `src/cli.ts` (modify) | Add `--no-line-numbers` option; update formatters to render or strip location. |
| `tests/yamlLocationResolver.test.ts` (new, optional but recommended) | Unit tests for the resolver utility. |

---

### Task 1: Create `src/yamlLocationResolver.ts`

**Files:**
- Create: `src/yamlLocationResolver.ts`
- Test: `tests/yamlLocationResolver.test.ts`

**Interfaces:**
- Consumes: raw YAML text (`string`).
- Produces: `buildLocationMap(yamlText: string): YAMLLocationMap` and `YAMLLocationMap.lookup(path: string): SourceLocation | undefined`.

- [ ] **Step 1: Write the resolver implementation**

Create `src/yamlLocationResolver.ts`:

```ts
import YAML, {
  Document,
  Node,
  YAMLMap,
  YAMLSeq,
  Scalar,
  isMap,
  isSeq,
  isNode,
  LineCounter
} from 'yaml';

export interface SourceLocation {
  line: number;
  column: number;
}

export interface YAMLLocationMap {
  lookup(path: string): SourceLocation | undefined;
}

function normalizePath(path: string): string {
  // Accept JSON pointers (/foo/bar), dot-notation (foo.bar), and bracket notation (foo[0].bar)
  if (path.startsWith('/')) {
    path = path.slice(1);
  }
  // Normalize separators to dots
  path = path.replace(/\//g, '.');
  // Convert array bracket notation to dot-notation
  return path.replace(/\[(\d+)\]/g, '.$1');
}

function registerNode(
  map: Map<string, SourceLocation>,
  node: Node,
  lineCounter: LineCounter,
  path: string
): void {
  if (!isNode(node)) return;

  const range = node.range;
  if (range && range[0] !== undefined) {
    const pos = lineCounter.linePos(range[0]);
    if (pos) {
      map.set(path, { line: pos.line, column: pos.col });
    }
  }
}

function walkNode(
  map: Map<string, SourceLocation>,
  node: any,
  lineCounter: LineCounter,
  path: string
): void {
  if (!isNode(node)) return;

  registerNode(map, node, lineCounter, path);

  if (isMap(node)) {
    for (const item of (node as YAMLMap).items) {
      const key = String((item.key as Scalar)?.value ?? item.key);
      const childPath = path ? `${path}.${key}` : key;
      // Register the value node at the child path
      walkNode(map, item.value, lineCounter, childPath);
    }
  } else if (isSeq(node)) {
    const seq = node as YAMLSeq;
    for (let i = 0; i < seq.items.length; i++) {
      walkNode(map, seq.items[i], lineCounter, `${path}.${i}`);
    }
  }
}

export function buildLocationMap(yamlText: string): YAMLLocationMap {
  const lineCounter = new LineCounter();
  const doc = YAML.parseDocument(yamlText, { lineCounter });
  const map = new Map<string, SourceLocation>();

  if (doc.contents) {
    walkNode(map, doc.contents, lineCounter, '');
  }

  return {
    lookup(path: string): SourceLocation | undefined {
      return map.get(normalizePath(path));
    }
  };
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/yamlLocationResolver.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildLocationMap } from '../src/yamlLocationResolver';

const yaml = `
module:
  name: TestModule
  appModuleId: test-module
components:
  - name: Grid
    props:
      label: Orders
`;

describe('buildLocationMap', () => {
  it('returns location for a nested scalar', () => {
    const map = buildLocationMap(yaml);
    const loc = map.lookup('module.name');
    expect(loc).toBeDefined();
    expect(loc!.line).toBeGreaterThan(0);
    expect(loc!.column).toBeGreaterThan(0);
  });

  it('returns location for array items', () => {
    const map = buildLocationMap(yaml);
    const loc = map.lookup('components.0.name');
    expect(loc).toBeDefined();
    expect(loc!.line).toBeGreaterThan(0);
    expect(loc!.column).toBeGreaterThan(0);
  });

  it('returns undefined for unknown paths', () => {
    const map = buildLocationMap(yaml);
    expect(map.lookup('module.doesNotExist')).toBeUndefined();
  });

  it('accepts JSON pointer paths', () => {
    const map = buildLocationMap(yaml);
    const dotLoc = map.lookup('module.name');
    const pointerLoc = map.lookup('/module/name');
    expect(pointerLoc).toBeDefined();
    expect(pointerLoc).toEqual(dotLoc);
  });

  it('accepts bracket notation paths', () => {
    const map = buildLocationMap(yaml);
    const dotLoc = map.lookup('components.0.props.label');
    const bracketLoc = map.lookup('components[0].props.label');
    expect(bracketLoc).toBeDefined();
    expect(bracketLoc).toEqual(dotLoc);
  });

  it('orders nested scalars by line', () => {
    const map = buildLocationMap(yaml);
    const moduleName = map.lookup('module.name');
    const componentName = map.lookup('components.0.name');
    expect(componentName!.line).toBeGreaterThan(moduleName!.line);
  });
});
```

- [ ] **Step 3: Run the test and verify it fails**

Run:

```bash
npx vitest run tests/yamlLocationResolver.test.ts
```

Expected: FAIL — `buildLocationMap` not found because the file is new.

- [ ] **Step 4: Verify the test passes**

Run:

```bash
npx vitest run tests/yamlLocationResolver.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/yamlLocationResolver.ts tests/yamlLocationResolver.test.ts
git commit -m "feat: add YAML source location resolver utility"
```

---

### Task 2: Update `src/types.ts`

**Files:**
- Modify: `src/types.ts:8-14` and `src/types.ts:19-23`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ValidationError` and `ValidationWarning` now have an optional `location` field.

- [ ] **Step 1: Add `location` to `ValidationError`**

Replace:

```ts
export interface ValidationError {
  type: string;
  path: string;
  message: string;
  schemaPath?: string;
  example?: any;
}
```

With:

```ts
export interface ValidationError {
  type: string;
  path: string;
  message: string;
  schemaPath?: string;
  example?: any;
  location?: { line: number; column: number };
}
```

- [ ] **Step 2: Add `location` to `ValidationWarning`**

Replace:

```ts
export interface ValidationWarning {
  type: string;
  path: string;
  message: string;
}
```

With:

```ts
export interface ValidationWarning {
  type: string;
  path: string;
  message: string;
  location?: { line: number; column: number };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add optional location to ValidationError and ValidationWarning"
```

---

### Task 3: Integrate Location Map into `src/validator.ts`

**Files:**
- Modify: `src/validator.ts`

**Interfaces:**
- Consumes: `buildLocationMap` and `YAMLLocationMap` from `src/yamlLocationResolver.ts`.
- Produces: `ModuleValidator` now attaches `location` to all errors/warnings.

- [ ] **Step 1: Import the resolver**

Add near the top of `src/validator.ts` (after the `YAML` import):

```ts
import { buildLocationMap, YAMLLocationMap } from './yamlLocationResolver';
```

- [ ] **Step 2: Parse YAML to AST and build the location map**

In `validateModule` (around line 130-143), replace:

```ts
      // Read and parse YAML
      const content = fs.readFileSync(filePath, 'utf-8');
      let moduleData: YAMLModule;

      try {
        moduleData = YAML.parse(content) as YAMLModule;
      } catch (yamlError: any) {
        errors.push({
          type: 'yaml_syntax_error',
          path: filePath,
          message: `YAML syntax error: ${yamlError.message}`
        });
        return this.createResult(filePath, errors, warnings);
      }
```

With:

```ts
      // Read and parse YAML
      const content = fs.readFileSync(filePath, 'utf-8');
      let moduleData: YAMLModule;
      let locationMap: YAMLLocationMap | undefined;

      try {
        const doc = YAML.parseDocument(content);
        moduleData = doc.toJS() as YAMLModule;
        locationMap = buildLocationMap(content);
      } catch (yamlError: any) {
        errors.push({
          type: 'yaml_syntax_error',
          path: filePath,
          message: `YAML syntax error: ${yamlError.message}`,
          location: yamlError.linePos && typeof yamlError.linePos === 'object'
            ? { line: yamlError.linePos.line, column: yamlError.linePos.col }
            : undefined
        });
        return this.createResult(filePath, errors, warnings);
      }
```

- [ ] **Step 3: Pass the location map through validation helpers**

Update the calls in `validateModule` to pass `locationMap`:

```ts
      // Validate module structure
      this.validateModuleStructure(moduleData, errors, warnings, filePath, locationMap);

      // Validate components
      if (moduleData.components && Array.isArray(moduleData.components)) {
        this.validateComponents(moduleData.components, errors, warnings, 'components', locationMap);
      }

      // Validate routes
      if (moduleData.routes && Array.isArray(moduleData.routes)) {
        this.validateRoutes(moduleData.routes, errors, warnings, locationMap);
      }

      // Validate entities
      if (moduleData.entities && Array.isArray(moduleData.entities)) {
        this.validateEntities(moduleData.entities, errors, warnings, locationMap);
      }

      // Validate configurations
      if (moduleData.configurations && Array.isArray(moduleData.configurations)) {
        this.validateConfigurations(moduleData.configurations, errors, warnings, locationMap);
      }
```

- [ ] **Step 4: Add a helper to resolve locations**

Add a private method to `ModuleValidator`:

```ts
  private resolveLocation(
    locationMap: YAMLLocationMap | undefined,
    path: string
  ): { line: number; column: number } | undefined {
    if (!locationMap) return undefined;
    try {
      return locationMap.lookup(path);
    } catch {
      return undefined;
    }
  }
```

- [ ] **Step 5: Update method signatures and error pushes**

Use grep to find every push site that needs a location:

```bash
grep -n 'errors.push\|warnings.push' src/validator.ts
```

Update each validation method to accept `locationMap?: YAMLLocationMap` and attach `location` to every pushed error/warning. For example, `validateModuleStructure` becomes:

```ts
  private validateModuleStructure(
    moduleData: YAMLModule,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    filePath?: string,
    locationMap?: YAMLLocationMap
  ): void {
    // ... existing checks ...
    if (!moduleData.module) {
      errors.push({
        type: 'missing_property',
        path: 'module',
        message: 'Missing required property: module',
        location: this.resolveLocation(locationMap, 'module')
      });
      return;
    }
    // ... repeat for every errors.push / warnings.push in this method ...
  }
```

Do the same for:
- `validateComponents`
- `validateComponent`
- `validateNestedComponent`
- `validateComponentProps`
- `validateRoutes`
- `validateEntities`
- `validateConfigurations`
- `checkDeprecatedProperties`

Each push should include:

```ts
location: this.resolveLocation(locationMap, errorPath)
```

where `errorPath` is the `path` value already being pushed.

- [ ] **Step 6: Update Ajv error helpers**

Update `addAjvErrors` and `addAjvWarnings` signatures to accept `locationMap?: YAMLLocationMap`:

```ts
  private addAjvErrors(
    ajvErrors: ErrorObject[] | null | undefined,
    basePath: string,
    errors: ValidationError[],
    enrich = false,
    locationMap?: YAMLLocationMap
  ): void {
    if (!ajvErrors) return;

    for (const error of ajvErrors) {
      const errorPath = `${basePath}${error.instancePath}`;
      errors.push({
        type: 'schema_violation',
        path: errorPath,
        message: enrich ? this.schemaMessage(error) : (error.message || 'Schema validation failed'),
        schemaPath: error.schemaPath,
        location: this.resolveLocation(locationMap, errorPath)
      });
    }
  }
```

And `addAjvWarnings`:

```ts
  private addAjvWarnings(
    ajvErrors: ErrorObject[] | null | undefined,
    basePath: string,
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap
  ): void {
    if (!ajvErrors) return;
    for (const error of ajvErrors) {
      const warningPath = `${basePath}${error.instancePath}`;
      warnings.push({
        type: 'schema_violation',
        path: warningPath,
        message: this.schemaMessage(error),
        location: this.resolveLocation(locationMap, warningPath)
      });
    }
  }
```

- [ ] **Step 7: Update callers of Ajv helpers**

Find every call to `this.addAjvErrors(...)` and `this.addAjvWarnings(...)` in `src/validator.ts` and append `locationMap` as the last argument.

- [ ] **Step 8: Build and verify module validation still works**

Run:

```bash
npm run build
npx cxtms modules/<any-module>.yaml
```

Expected: validation runs and, if there are errors, they include `path (line N, col M)`.

- [ ] **Step 9: Commit**

```bash
git add src/validator.ts
git commit -m "feat(module-validator): attach source locations to errors and warnings"
```

---

### Task 4: Integrate Location Map into `src/workflowValidator.ts`

**Files:**
- Modify: `src/workflowValidator.ts`

**Interfaces:**
- Consumes: `buildLocationMap` and `YAMLLocationMap` from `src/yamlLocationResolver.ts`.
- Produces: `WorkflowValidator` now attaches `location` to all errors/warnings.

- [ ] **Step 1: Import the resolver**

Add near the top of `src/workflowValidator.ts` (after the `YAML` import):

```ts
import { buildLocationMap, YAMLLocationMap } from './yamlLocationResolver';
```

- [ ] **Step 2: Parse YAML to AST and build the location map**

In `validateWorkflow` (around line 259-272), replace:

```ts
      // Read and parse YAML
      const content = fs.readFileSync(filePath, 'utf-8');
      let workflowData: YAMLWorkflow;

      try {
        workflowData = YAML.parse(content) as YAMLWorkflow;
      } catch (yamlError: any) {
        errors.push({
          type: 'yaml_syntax_error',
          path: filePath,
          message: `YAML syntax error: ${yamlError.message}`
        });
        return this.createResult(filePath, errors, warnings);
      }
```

With:

```ts
      // Read and parse YAML
      const content = fs.readFileSync(filePath, 'utf-8');
      let workflowData: YAMLWorkflow;
      let locationMap: YAMLLocationMap | undefined;

      try {
        const doc = YAML.parseDocument(content);
        workflowData = doc.toJS() as YAMLWorkflow;
        locationMap = buildLocationMap(content);
      } catch (yamlError: any) {
        errors.push({
          type: 'yaml_syntax_error',
          path: filePath,
          message: `YAML syntax error: ${yamlError.message}`,
          location: yamlError.linePos && typeof yamlError.linePos === 'object'
            ? { line: yamlError.linePos.line, column: yamlError.linePos.col }
            : undefined
        });
        return this.createResult(filePath, errors, warnings);
      }
```

- [ ] **Step 3: Add a helper to resolve locations**

Add a private method to `WorkflowValidator`:

```ts
  private resolveLocation(
    locationMap: YAMLLocationMap | undefined,
    path: string
  ): { line: number; column: number } | undefined {
    if (!locationMap) return undefined;
    try {
      return locationMap.lookup(path);
    } catch {
      return undefined;
    }
  }
```

- [ ] **Step 4: Pass location map through workflow validation**

Use grep to find every push site that needs a location:

```bash
grep -n 'errors.push\|warnings.push' src/workflowValidator.ts
```

Update `validateWorkflow` to pass `locationMap` to:
- `validateWorkflowStructure(workflowData, errors, warnings, filePath, locationMap)`
- `validateInputs(workflowData, errors, locationMap)`
- `validateVariables(workflowData, errors, locationMap)`
- `addAjvErrors(..., locationMap)` and `addAjvWarnings(..., locationMap)` calls
- `validateFlowWorkflow(workflowData, errors, warnings, locationMap)`
- `validateActivities(workflowData.activities, 'activities', errors, warnings, locationMap)`
- `validateEventSteps(workflowData.events, 'events', [...], errors, warnings, locationMap)`

Then update each of those methods to accept `locationMap?: YAMLLocationMap` and attach `location: this.resolveLocation(locationMap, path)` to every `errors.push` and `warnings.push`.

- [ ] **Step 5: Update Ajv error helpers**

Update `addAjvErrors` and `addAjvWarnings` in `src/workflowValidator.ts` exactly as in Task 3, accepting `locationMap?: YAMLLocationMap` and resolving locations.

- [ ] **Step 6: Build and verify workflow validation still works**

Run:

```bash
npm run build
npx cxtms workflows/<any-workflow>.yaml
```

Expected: validation runs and, if there are errors, they include `path (line N, col M)`.

- [ ] **Step 7: Commit**

```bash
git add src/workflowValidator.ts
git commit -m "feat(workflow-validator): attach source locations to errors and warnings"
```

---

### Task 5: Update `src/cli.ts`

**Files:**
- Modify: `src/cli.ts`

**Interfaces:**
- Consumes: `location` field on `ValidationError` / `ValidationWarning`.
- Produces: `--no-line-numbers` option; formatted output with/without locations.

- [ ] **Step 1: Add `noLineNumbers` to `CLIOptions`**

In the `CLIOptions` interface (around line 103), add:

```ts
  noLineNumbers: boolean;
```

- [ ] **Step 2: Parse `--no-line-numbers` in `parseArgs`**

In the default options object (around line 4013), add:

```ts
    noLineNumbers: false,
```

In the argument loop, add a branch:

```ts
    } else if (arg === '--no-line-numbers') {
      options.noLineNumbers = true;
```

- [ ] **Step 3: Add the flag to help text**

In `HELP_TEXT` (around line 230), add:

```
  ${chalk.green('--no-line-numbers')}       Suppress source line/column info in validation output
```

- [ ] **Step 4: Update `formatErrorPretty`**

Change the signature and add location rendering:

```ts
function formatErrorPretty(
  error: ValidationError,
  index: number,
  schemasPath: string,
  verbose: boolean,
  noLineNumbers: boolean
): string {
  const lines: string[] = [];

  const locationSuffix =
    !noLineNumbers && error.location
      ? ` (line ${error.location.line}, col ${error.location.column})`
      : '';

  // Error header
  lines.push(chalk.red(`\n┌─ Error #${index + 1}: ${error.type.toUpperCase().replace(/_/g, ' ')}`));
  lines.push(chalk.red('│'));

  // Path
  lines.push(chalk.red('│  ') + chalk.bold('Path:    ') + chalk.yellow((error.path || '/') + locationSuffix));

  // ... rest of function unchanged ...
}
```

- [ ] **Step 5: Update `formatWarningPretty`**

Change the signature:

```ts
function formatWarningPretty(
  warning: ValidationWarning,
  index: number,
  noLineNumbers: boolean
): string {
  const lines: string[] = [];
  const locationSuffix =
    !noLineNumbers && warning.location
      ? ` (line ${warning.location.line}, col ${warning.location.column})`
      : '';
  lines.push(chalk.yellow(`\n⚠ Warning #${index + 1}: ${warning.type.toUpperCase().replace(/_/g, ' ')}`));
  lines.push(chalk.gray(`  Path: ${warning.path}${locationSuffix}`));
  lines.push(`  ${warning.message}`);
  return lines.join('\n');
}
```

- [ ] **Step 6: Update `printResultPretty`**

Change the signature to accept `noLineNumbers: boolean` and pass it to the formatters:

```ts
function printResultPretty(
  result: ValidationResult,
  fileType: ValidationType,
  schemasPath: string,
  verbose: boolean,
  noLineNumbers: boolean
): void {
  // ... existing header/summary code unchanged ...

  errors.forEach((error, index) => {
    console.log(formatErrorPretty(error, index, schemasPath, verbose, noLineNumbers));
  });

  // ...

  warnings.forEach((warning, index) => {
    console.log(formatWarningPretty(warning, index, noLineNumbers));
  });

  // ... rest unchanged ...
}
```

- [ ] **Step 7: Update `printResultJson`**

Change the signature:

```ts
function printResultJson(result: ValidationResult, noLineNumbers: boolean): void {
  if (noLineNumbers) {
    const cleaned = {
      ...result,
      errors: result.errors.map(({ location, ...rest }) => rest),
      warnings: result.warnings.map(({ location, ...rest }) => rest)
    };
    console.log(JSON.stringify(cleaned, null, 2));
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}
```

- [ ] **Step 8: Update all call sites**

Find every call to `printResultPretty`, `printResultJson`, `formatErrorPretty`, and `formatWarningPretty` in `src/cli.ts` and pass `options.noLineNumbers`.

- [ ] **Step 9: Build and verify CLI formatting**

Run:

```bash
npm run build
npx cxtms modules/<invalid-module>.yaml
npx cxtms modules/<invalid-module>.yaml --no-line-numbers
npx cxtms modules/<invalid-module>.yaml --format json
npx cxtms modules/<invalid-module>.yaml --format json --no-line-numbers
```

Expected:
- Default output shows `path (line N, col M)`.
- `--no-line-numbers` removes the suffix from pretty output and removes `location` from JSON output.

- [ ] **Step 10: Commit**

```bash
git add src/cli.ts
git commit -m "feat(cli): render source locations and add --no-line-numbers flag"
```

---

### Task 6: Manual Verification

**Files:**
- Use: any `modules/*.yaml` and `workflows/*.yaml` files in the repo.

- [ ] **Step 1: Create a temporary invalid module YAML**

Create `/tmp/invalid-module.yaml`:

```yaml
module:
  name: BadModule
  # appModuleId intentionally missing
components:
  - name: MissingProps
    type: form
routes: []
```

- [ ] **Step 2: Verify module output**

Run:

```bash
npx cxtms /tmp/invalid-module.yaml
```

Expected: `module.appModuleId (line N, col M)` appears with the location of the `module` block.

Run:

```bash
npx cxtms /tmp/invalid-module.yaml --no-line-numbers
```

Expected: no `(line, col)` suffix.

- [ ] **Step 3: Create a temporary invalid workflow YAML**

Create `/tmp/invalid-workflow.yaml`:

```yaml
workflow:
  workflowId: bad-workflow
  # name intentionally missing
activities:
  - name: FirstActivity
    steps:
      - task: unknownTaskType
```

- [ ] **Step 4: Verify workflow output**

Run:

```bash
npx cxtms /tmp/invalid-workflow.yaml
```

Expected: `workflow.name (line N, col M)` and `activities.0.steps.0.task (line N, col M)` appear.

Run:

```bash
npx cxtms /tmp/invalid-workflow.yaml --format json
```

Expected: JSON contains `location` objects.

- [ ] **Step 5: Clean up temp files**

```bash
rm /tmp/invalid-module.yaml /tmp/invalid-workflow.yaml
```

- [ ] **Step 6: Final commit (if any cleanup needed)**

If no changes remain, no commit is needed.

---

## Self-Review Checklist

After completing all tasks, verify:

- [ ] Every `errors.push` and `warnings.push` in `src/validator.ts` includes a `location` resolved from the map.
- [ ] Every `errors.push` and `warnings.push` in `src/workflowValidator.ts` includes a `location` resolved from the map.
- [ ] `--no-line-numbers` removes locations from both pretty and JSON output.
- [ ] `location` is omitted (not `null`) when it cannot be resolved.
- [ ] YAML syntax errors include line/column info.
- [ ] The project still builds with `npm run build`.
- [ ] Valid module and workflow files still pass validation.

## Notes for Implementer

- The `yaml` package is already a dependency (`yaml: ^2.8.2`).
- `LineCounter` and `linePos` are part of the `yaml` package API.
- The project currently has no automated test runner wired to `npm test`; the optional resolver tests can be run with `npx vitest run tests/yamlLocationResolver.test.ts`.
- If a method has many `errors.push` calls, consider adding a small private helper in that validator:
  ```ts
  private pushError(
    errors: ValidationError[],
    locationMap: YAMLLocationMap | undefined,
    type: string,
    path: string,
    message: string,
    extra?: Partial<ValidationError>
  ): void {
    errors.push({
      type,
      path,
      message,
      ...extra,
      location: this.resolveLocation(locationMap, path)
    });
  }
  ```
  This reduces repetitive `location: this.resolveLocation(...)` lines, but is optional.
- Be careful with `error.instancePath`: in `validator.ts` it is used as `${basePath}${error.instancePath}`; in `workflowValidator.ts` it is used as `basePath ? `${basePath}${error.instancePath}` : error.instancePath.slice(1)`. Resolve locations using the final `path` value that is pushed into the error object.
