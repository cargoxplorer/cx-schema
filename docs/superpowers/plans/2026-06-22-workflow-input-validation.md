# Workflow Input Presence Validator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `WorkflowValidator` so required task input keys are accepted when present in `step.inputs` *or* provided by an in-scope variable (workflow/activity variables, `SetVariable`, or control-flow loop vars), respecting `--schema-enforcement=warn|error`.

**Architecture:** Add a small `workflowScope.ts` module that builds and copies scope contexts. Modify `workflowValidator.ts` to seed a scope from workflow inputs/variables/triggers, pass copies through activities and control-flow tasks, and check required inputs against the current scope.

**Tech Stack:** TypeScript, Ajv, YAML, Node.js CLI (`src/cli.ts` uses the validator).

## Global Constraints

- Default validation (no `--schema-enforcement` flag) must remain unchanged.
- Only keys listed in `schemas/workflows/task-required-inputs.json` are checked.
- System-injected variables (`organizationId`, `workflowId`, `currentUserId`, …) are already excluded from the catalog and do not need special handling.
- No template/expression evaluation; this is a key-presence check only.
- Branch-local variables do **not** leak out of `switch` cases.
- Loop variables (`item`/`index`/`iteration`) are visible only inside their loop body.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/workflowScope.ts` (new) | Scope context type and pure helper functions for building/copying/merging scope. |
| `src/workflowValidator.ts` (modify) | Seed scope, pass it through validation walk, check required inputs against scope. |
| `test-fixtures/workflow-input-validation/*.yaml` (new) | Manual test workflows for CLI verification. |

---

### Task 1: Create the scope helper module

**Files:**
- Create: `src/workflowScope.ts`

**Interfaces:**
- Produces: `ScopeContext`, `createGlobalScope`, `addActivityVariables`, `addSetVariableOutputs`, `addLoopVariables`, `copyScope`, `mergeGlobals`, `getAvailableNames`.

- [ ] **Step 1: Write `src/workflowScope.ts`**

```ts
export interface ScopeContext {
  globals: Set<string>;
  loopVars: Set<string>;
}

export function copyScope(scope: ScopeContext): ScopeContext {
  return {
    globals: new Set(scope.globals),
    loopVars: new Set(scope.loopVars)
  };
}

export function getAvailableNames(scope: ScopeContext): Set<string> {
  return new Set([...scope.globals, ...scope.loopVars]);
}

export function mergeGlobals(target: ScopeContext, source: ScopeContext): void {
  source.globals.forEach(name => target.globals.add(name));
}

export function createGlobalScope(workflowData: any): ScopeContext {
  const globals = new Set<string>();

  (workflowData.inputs || [])
    .filter((input: any) => input && typeof input === 'object' && typeof input.name === 'string')
    .forEach((input: any) => globals.add(input.name));

  (workflowData.variables || [])
    .filter((variable: any) => variable && typeof variable === 'object' && typeof variable.name === 'string')
    .forEach((variable: any) => globals.add(variable.name));

  const triggers = workflowData.triggers || [];
  const hasEntityTrigger = triggers.some((t: any) => t && t.type === 'Entity');
  if (hasEntityTrigger) {
    [
      'entity',
      'entityId',
      'entityName',
      'eventType',
      'position',
      'changes',
      'trackedEntity',
      'entityType'
    ].forEach(name => globals.add(name));
  }

  return { globals, loopVars: new Set<string>() };
}

export function addActivityVariables(scope: ScopeContext, activity: any): ScopeContext {
  const child = copyScope(scope);
  (activity.variables || [])
    .filter((variable: any) => variable && typeof variable === 'object' && typeof variable.name === 'string')
    .forEach((variable: any) => child.globals.add(variable.name));
  return child;
}

export function addSetVariableOutputs(scope: ScopeContext, step: any): void {
  if (!step.inputs || typeof step.inputs !== 'object') return;
  const variables = step.inputs.variables;
  if (!Array.isArray(variables)) return;

  variables
    .filter((variable: any) => variable && typeof variable === 'object' && typeof variable.name === 'string')
    .forEach((variable: any) => scope.globals.add(variable.name));
}

export function addLoopVariables(scope: ScopeContext, taskType: string, step: any): ScopeContext {
  const child = copyScope(scope);
  if (taskType === 'foreach') {
    child.loopVars.add(step.item || 'item');
    child.loopVars.add('index');
  } else if (taskType === 'while') {
    child.loopVars.add('iteration');
  }
  return child;
}
```

- [ ] **Step 2: Build the project to confirm the new file compiles**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/workflowScope.ts
git commit -m "feat(validator): add workflow scope helper module"
```

---

### Task 2: Wire scope through `WorkflowValidator`

**Files:**
- Modify: `src/workflowValidator.ts`

**Interfaces:**
- Consumes: everything from `src/workflowScope.ts`.
- Produces: validator methods that accept and mutate `ScopeContext` instead of `Set<string> availableInputs`.

- [ ] **Step 1: Add the import**

At the top of `src/workflowValidator.ts` (after existing imports):

```ts
import {
  ScopeContext,
  createGlobalScope,
  addActivityVariables,
  addSetVariableOutputs,
  addLoopVariables,
  copyScope,
  mergeGlobals,
  getAvailableNames
} from './workflowScope';
```

- [ ] **Step 2: Seed the global scope in `validateWorkflow`**

Replace the `availableInputs` construction block in `src/workflowValidator.ts:307-313`:

Old:
```ts
      // Collect workflow-level input names so required-task-input checks can
      // treat them as provided (backend injects workflow inputs as activity vars).
      const availableInputs = new Set<string>(
        (workflowData.inputs || [])
          .filter((input: any) => input && typeof input === 'object' && input.name)
          .map((input: any) => input.name)
      );
```

New:
```ts
      // Build the initial variable scope for required-task-input checks.
      const scope = createGlobalScope(workflowData);
```

Then replace every downstream usage of `availableInputs` in this method with `scope`:
- `validateFlowWorkflow(workflowData, ..., scope)`
- `validateActivities(workflowData.activities, ..., scope)`
- `validateEventSteps(workflowData.events, ..., scope)`

- [ ] **Step 3: Update all method signatures from `availableInputs?: Set<string>` to `scope?: ScopeContext`**

Find/replace across `src/workflowValidator.ts`:

Methods to update:
- `validateActivities`
- `validateActivity`
- `validateEventSteps`
- `validateStep`
- `validateRequiredInputs`
- `validateNestedSteps`
- `validateFlowWorkflow`
- `validateFlowStates`
- `validateFlowTransitions`

Example diff for `validateActivities`:

Old:
```ts
  private validateActivities(
    activities: any[],
    basePath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap,
    availableInputs?: Set<string>
  ): void {
    activities.forEach((activity, index) => {
      const activityPath = `${basePath}[${index}]`;
      this.validateActivity(activity, activityPath, errors, warnings, locationMap, availableInputs);
    });
  }
```

New:
```ts
  private validateActivities(
    activities: any[],
    basePath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap,
    scope?: ScopeContext
  ): void {
    activities.forEach((activity, index) => {
      const activityPath = `${basePath}[${index}]`;
      this.validateActivity(activity, activityPath, errors, warnings, locationMap, scope);
    });
  }
```

- [ ] **Step 4: Add activity variables in `validateActivity`**

Old:
```ts
    // Validate each step
    activity.steps.forEach((step: any, stepIndex: number) => {
      const stepPath = `${activityPath}.steps[${stepIndex}]`;
      this.validateStep(step, stepPath, errors, warnings, locationMap, availableInputs);
    });
```

New:
```ts
    // Activity variables get their own copy of the global scope.
    const activityScope = scope ? addActivityVariables(scope, activity) : undefined;

    // Validate each step
    activity.steps.forEach((step: any, stepIndex: number) => {
      const stepPath = `${activityPath}.steps[${stepIndex}]`;
      this.validateStep(step, stepPath, errors, warnings, locationMap, activityScope);
    });
```

Also pass `activityScope` to `validateEventSteps` at the end of `validateActivity`.

- [ ] **Step 5: Update `validateStep` to use scope and consume `SetVariable` outputs**

Old:
```ts
    // Required-input presence check (schemaEnforcement warn/error only).
    this.validateRequiredInputs(step, stepPath, errors, warnings, locationMap, availableInputs);

    // Validate nested structures (foreach, switch, while)
    this.validateNestedSteps(step, stepPath, errors, warnings, locationMap, availableInputs);
```

New:
```ts
    // Required-input presence check (schemaEnforcement warn/error only).
    this.validateRequiredInputs(step, stepPath, errors, warnings, locationMap, scope);

    // SetVariable writes back into the activity/global scope.
    if (scope && typeof step.task === 'string' && step.task.split('@')[0].toLowerCase() === 'utilities/setvariable') {
      addSetVariableOutputs(scope, step);
    }

    // Validate nested structures (foreach, switch, while)
    const childScope = this.validateNestedSteps(step, stepPath, errors, warnings, locationMap, scope);
    if (scope && childScope) {
      mergeGlobals(scope, childScope);
    }
```

- [ ] **Step 6: Update `validateRequiredInputs` to check scope**

Old:
```ts
  private validateRequiredInputs(
    step: any,
    stepPath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap,
    availableInputs?: Set<string>
  ): void {
    const enforce = this.options.schemaEnforcement;
    if (enforce !== 'warn' && enforce !== 'error') return;
    if (!step.task || typeof step.task !== 'string') return;

    const baseName = step.task.split('@')[0].toLowerCase();
    const required = this.requiredInputs.get(baseName);
    if (!required || required.length === 0) return;

    const inputs =
      step.inputs && typeof step.inputs === 'object' ? (step.inputs as object) : null;
    for (const key of required) {
      const missingFromStep = !inputs || !(key in inputs);
      const providedByWorkflow = availableInputs?.has(key) ?? false;
      if (missingFromStep && !providedByWorkflow) {
        const message = `Task '${step.task.split('@')[0]}' is missing required input '${key}'`;
        const entryPath = `${stepPath}.inputs.${key}`;
        if (enforce === 'error') {
          errors.push({
            type: 'schema_violation',
            path: entryPath,
            message,
            location: this.resolveLocation(locationMap, entryPath)
          });
        } else {
          warnings.push({
            type: 'schema_violation',
            path: entryPath,
            message,
            location: this.resolveLocation(locationMap, entryPath)
          });
        }
      }
    }
  }
```

New:
```ts
  private validateRequiredInputs(
    step: any,
    stepPath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap,
    scope?: ScopeContext
  ): void {
    const enforce = this.options.schemaEnforcement;
    if (enforce !== 'warn' && enforce !== 'error') return;
    if (!step.task || typeof step.task !== 'string') return;

    const baseName = step.task.split('@')[0].toLowerCase();
    const required = this.requiredInputs.get(baseName);
    if (!required || required.length === 0) return;

    const inputs =
      step.inputs && typeof step.inputs === 'object' ? (step.inputs as object) : null;
    const available = scope ? getAvailableNames(scope) : new Set<string>();
    for (const key of required) {
      const missingFromStep = !inputs || !(key in inputs);
      const providedByScope = available.has(key);
      if (missingFromStep && !providedByScope) {
        const message = `Task '${step.task.split('@')[0]}' is missing required input '${key}'`;
        const entryPath = `${stepPath}.inputs.${key}`;
        if (enforce === 'error') {
          errors.push({
            type: 'missing_required_input',
            path: entryPath,
            message,
            location: this.resolveLocation(locationMap, entryPath)
          });
        } else {
          warnings.push({
            type: 'missing_required_input',
            path: entryPath,
            message,
            location: this.resolveLocation(locationMap, entryPath)
          });
        }
      }
    }
  }
```

- [ ] **Step 7: Update `validateNestedSteps` to handle loop scope and return child scope**

Old signature:
```ts
  private validateNestedSteps(
    step: any,
    stepPath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap,
    availableInputs?: Set<string>
  ): void {
```

New signature:
```ts
  private validateNestedSteps(
    step: any,
    stepPath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap,
    scope?: ScopeContext
  ): ScopeContext | undefined {
```

New body:
```ts
    const taskType = step.task;

    // Handle foreach
    if (taskType === 'foreach') {
      const childScope = scope ? addLoopVariables(scope, 'foreach', step) : undefined;
      if (step.steps && Array.isArray(step.steps)) {
        step.steps.forEach((nestedStep: any, index: number) => {
          this.validateStep(nestedStep, `${stepPath}.steps[${index}]`, errors, warnings, locationMap, childScope);
        });
      }
      return childScope;
    }

    // Handle switch — cases do not leak into the post-switch scope.
    if (taskType === 'switch') {
      if (step.cases && Array.isArray(step.cases)) {
        step.cases.forEach((caseItem: any, caseIndex: number) => {
          const caseScope = scope ? copyScope(scope) : undefined;
          if (caseItem.steps && Array.isArray(caseItem.steps)) {
            caseItem.steps.forEach((nestedStep: any, stepIndex: number) => {
              this.validateStep(
                nestedStep,
                `${stepPath}.cases[${caseIndex}].steps[${stepIndex}]`,
                errors,
                warnings,
                locationMap,
                caseScope
              );
            });
          }
        });
      }
      if (step.default && step.default.steps && Array.isArray(step.default.steps)) {
        const defaultScope = scope ? copyScope(scope) : undefined;
        step.default.steps.forEach((nestedStep: any, index: number) => {
          this.validateStep(nestedStep, `${stepPath}.default.steps[${index}]`, errors, warnings, locationMap, defaultScope);
        });
      }
      return undefined;
    }

    // Handle while
    if (taskType === 'while') {
      const childScope = scope ? addLoopVariables(scope, 'while', step) : undefined;
      if (step.steps && Array.isArray(step.steps)) {
        step.steps.forEach((nestedStep: any, index: number) => {
          this.validateStep(nestedStep, `${stepPath}.steps[${index}]`, errors, warnings, locationMap, childScope);
        });
      }
      return childScope;
    }

    return undefined;
  }
```

- [ ] **Step 8: Update Flow workflow methods to use `scope`**

In `validateFlowWorkflow`, `validateFlowStates`, and `validateFlowTransitions`, replace `availableInputs?: Set<string>` with `scope?: ScopeContext` and pass `scope` through.

Inside `validateFlowStates`, when validating `state.onEnter` / `state.onExit` steps, pass `scope` (do not merge outputs back). When validating `transition.steps`, pass `scope`.

- [ ] **Step 9: Build and fix TypeScript errors**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/workflowValidator.ts
git commit -m "feat(validator): check required inputs against variable scope"
```

---

### Task 3: Manual verification with fixture workflows

**Files:**
- Create: `test-fixtures/workflow-input-validation/setvariable-satisfies-required.yaml`
- Create: `test-fixtures/workflow-input-validation/activity-variable-satisfies-required.yaml`
- Create: `test-fixtures/workflow-input-validation/foreach-loop-var.yaml`
- Create: `test-fixtures/workflow-input-validation/switch-branch-isolation.yaml`
- Create: `test-fixtures/workflow-input-validation/missing-input.yaml`

- [ ] **Step 1: Create the fixtures**

Example fixture `setvariable-satisfies-required.yaml`:

```yaml
workflow:
  workflowId: "11111111-1111-1111-1111-111111111111"
  name: "SetVariable satisfies required input"
activities:
  - name: Main
    steps:
      - task: Utilities/SetVariable
        name: SetOrder
        inputs:
          variables:
            - name: order
              value: "{}"
      - task: Order/Update@1
        name: UpdateOrder
        inputs:
          order: "{{order}}"
```

This should pass required-key validation because `order` is set by `SetVariable`.

Example fixture `missing-input.yaml`:

```yaml
workflow:
  workflowId: "22222222-2222-2222-2222-222222222222"
  name: "Missing required input"
activities:
  - name: Main
    steps:
      - task: Order/Update@1
        name: UpdateOrder
        inputs: {}
```

This should produce a `missing_required_input` warning/error.

Create the other fixtures to cover:
- `activity-variable-satisfies-required.yaml`: `activity.variables` provides the required key.
- `foreach-loop-var.yaml`: uses `item` inside the loop; uses `item` outside the loop to confirm it is **not** in scope after the loop.
- `switch-branch-isolation.yaml`: a variable set inside one case is used after the switch to confirm it is **not** treated as available.

- [ ] **Step 2: Run default validation (no enforcement)**

Run for each fixture:
```bash
npx cxtms test-fixtures/workflow-input-validation/<fixture>.yaml
```
Expected: no new output beyond existing structural validation. Default behavior is unchanged.

- [ ] **Step 3: Run with `--schema-enforcement=warn`**

Run for each fixture:
```bash
npx cxtms test-fixtures/workflow-input-validation/<fixture>.yaml --schema-enforcement=warn
```
Expected:
- Satisfied fixtures: no `missing_required_input` warnings.
- `missing-input.yaml`: one `missing_required_input` warning.
- `foreach-loop-var.yaml` (outside loop usage): one `missing_required_input` warning.
- `switch-branch-isolation.yaml` (post-switch usage): one `missing_required_input` warning.

- [ ] **Step 4: Run with `--schema-enforcement=error`**

Run:
```bash
npx cxtms test-fixtures/workflow-input-validation/missing-input.yaml --schema-enforcement=error
```
Expected: non-zero exit code and a `missing_required_input` error.

- [ ] **Step 5: Commit fixtures**

```bash
git add test-fixtures/workflow-input-validation
git commit -m "test(validator): add workflow input validation fixtures"
```

---

## Spec Coverage Check

| Spec Section | Implementing Task |
|---|---|
| Required-key presence check extended to scope | Task 2, Step 6 |
| `workflow.inputs` / `workflow.variables` seed scope | Task 1, `createGlobalScope` + Task 2, Step 2 |
| `activity.variables` create activity-local scope | Task 2, Step 4 |
| `Utilities/SetVariable` adds globals | Task 2, Step 5 |
| `foreach` / `while` loop vars | Task 2, Step 7 |
| `switch` cases isolated | Task 2, Step 7 |
| Respect `--schema-enforcement=warn|error` | Task 2, Step 6 |
| Default behavior unchanged | Task 3, Step 2 |

## Placeholder Scan

No placeholders. Every step includes exact file paths, exact code, and exact verification commands.

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-22-workflow-input-validation.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Which approach do you want?