# Source Locations in Validation Output

## Summary

Add line and column information to validation errors and warnings produced by the `cxtms` CLI and library. Locations are included by default in the format `path (line N, col M)` and can be suppressed with `--no-line-numbers`.

## Motivation

Currently, validation errors report only the schema path (e.g., `module.name` or `activities.0.steps.1.inputs.entityName`). For large YAML files, locating the offending line requires manual searching. Source line/column numbers let authors jump directly to the problem.

## Scope

- Applies to both `ModuleValidator` and `WorkflowValidator`.
- Applies to CLI output and the programmatic API return value.
- Covers YAML syntax errors, Ajv schema violations, and custom validator warnings.

## Out of Scope

- Changing schema definitions.
- Changing template files or skills.
- Adding automated test suite infrastructure (optional unit tests for the resolver may be added, but are not required).

## Design

### Architecture

A new shared utility, `src/yamlLocationResolver.ts`, is responsible for building a path-to-position map from raw YAML text. Both validators import it.

Both validators will:

1. Read the file content.
2. Parse it once with `YAML.parseDocument` to obtain the AST and build the location map.
3. Convert the document to a JS object with `document.toJS()` for validation.
4. Resolve each error/warning path to a `{ line, column }` location before pushing it into the result arrays.
5. Return the location in the API result.

The CLI will format locations by default and suppress them when `--no-line-numbers` is passed.

### Components

#### 1. `src/yamlLocationResolver.ts`

```ts
export interface SourceLocation {
  line: number;
  column: number;
}

export interface YAMLLocationMap {
  lookup(path: string): SourceLocation | undefined;
}

export function buildLocationMap(yamlText: string): YAMLLocationMap;
```

- Accepts dot-notation paths (`module.name`, `components.0.props.label`) and JSON-pointer paths (`/module/name`).
- Returns 1-based line and column numbers.
- Internally walks the `yaml` AST and registers positions for maps, sequences, and scalars.

#### 2. Updated `src/types.ts`

Add an optional `location` field to `ValidationError` and `ValidationWarning`:

```ts
export interface ValidationError {
  type: string;
  path: string;
  message: string;
  schemaPath?: string;
  example?: any;
  location?: { line: number; column: number };
}

export interface ValidationWarning {
  type: string;
  path: string;
  message: string;
  location?: { line: number; column: number };
}
```

The field is optional to preserve API backward compatibility.

#### 3. Updated `src/validator.ts`

- Parse the module YAML with `YAML.parseDocument` in `validateModule`.
- Build the location map.
- Pass the map to internal validation helpers.
- Attach `location` to every pushed error/warning using the error’s `path`.

#### 4. Updated `src/workflowValidator.ts`

- Same pattern as the module validator.
- Build the location map from workflow YAML.
- Attach `location` in workflow structure, activity, task, trigger, schedule, and expression validation.

#### 5. Updated `src/cli.ts`

- Add `--no-line-numbers` to the validate command options.
- In the human-readable formatter, render `path (line N, col M)` when `location` is present.
- In JSON output, include the `location` field unless `--no-line-numbers` is set.

### Data Flow

For each validated file:

1. Read file content.
2. Parse the AST with `YAML.parseDocument(content)`.
   - If parsing throws, capture the YAML syntax error and use the parser’s own line/column info.
3. Build the location map by walking `doc.contents`:
   - For each `YAMLMap`, register each key’s value node under `<parentPath>/<key>`.
   - For each `YAMLSeq`, register each item under `<parentPath>/<index>`.
   - Register scalar nodes at their own path.
4. Convert the document to JS with `doc.toJS()` and run existing validation logic unchanged.
5. Resolve locations when creating errors/warnings:
   - For Ajv errors, convert `instancePath` (JSON pointer) to the project’s dot-path convention, then look up.
   - For custom validator errors, look up the existing dot-path directly.
6. Return `ValidationResult` with `location` on each item.
7. Render in the CLI:
   - Default: `path (line N, col M)`
   - With `--no-line-numbers`: omit location suffix and strip `location` from JSON output.

#### Edge Cases

- **Path not found in map**: omit the `(line, col)` suffix. Do not hardcode a fallback location.
- **YAML aliases/merge keys**: map to the resolved node position.
- **Empty/null nodes**: location points to the node itself.
- **Location map build failure**: log a debug message and continue validation without locations. Validation must not fail because location mapping failed.

### Error Handling

- **YAML parse failures**: use line/column info from the `yaml` parser exception.
- **Location map build failures**: catch and degrade silently; validation continues without locations.
- **Path resolution failures**: omit location; do not throw.
- **CLI flag handling**: `--no-line-numbers` suppresses location rendering in both human and JSON output.
- **API backward compatibility**: `location` is optional, so existing consumers are unaffected.

### Testing

Since the project currently has no automated test suite, verify manually via the CLI:

1. Create a deliberately invalid module YAML (e.g., missing `module.appModuleId`, invalid component prop).
2. Run `npx cxtms modules/invalid-module.yaml` and confirm `path (line N, col M)` appears.
3. Run `npx cxtms modules/invalid-module.yaml --no-line-numbers` and confirm locations are omitted.
4. Run `npx cxtms modules/invalid-module.yaml --format json` and confirm `location` objects appear.
5. Repeat with an invalid workflow YAML (e.g., missing required task input, invalid expression).
6. Verify YAML syntax errors include line/column info.
7. Verify valid files pass without new warnings.

Optional: add a small `tests/yamlLocationResolver.test.ts` using `vitest` to cover the resolver utility.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Extra YAML parse impacts performance on large files | The AST parse is fast; measure with the largest project files if concerned. |
| Location map fails on unusual YAML constructs | Degrade silently; validation still works. |
| `--no-line-numbers` not respected in JSON output | Explicitly strip `location` from serialized results when the flag is set. |
| Existing API consumers break from new fields | Keep `location` optional. |

## Implementation Order

1. Create `src/yamlLocationResolver.ts`.
2. Update `src/types.ts` with optional `location`.
3. Integrate location map into `src/validator.ts`.
4. Integrate location map into `src/workflowValidator.ts`.
5. Update `src/cli.ts` formatting and `--no-line-numbers` flag.
6. Verify manually with sample module and workflow YAML files.
