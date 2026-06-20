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

  it('enriches enum violations with the allowed values', async () => {
    const v = new ModuleValidator({ schemaEnforcement: 'warn' });
    const file = writeFixture('invalid.yaml', INVALID_ORIENTATION_MODULE);
    const res = await v.validateModule(file);
    const w = res.warnings.find(x => x.type === 'schema_violation' && /orientation/i.test(x.path));
    expect(w).toBeTruthy();
    expect(w!.message).toMatch(/allowed:.*horizontal.*vertical.*flex/);
  });
});

// A minimal valid workflow (Process type) used as a base.
const VALID_WORKFLOW = `
workflow:
  workflowId: 11111111-1111-1111-1111-111111111111
  name: w
  description: d
  executionMode: Async
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

// Same shape as VALID_WORKFLOW, but workflowId violates the format:uuid
// constraint enforced by workflow.json on the ajvEnforced instance.
const INVALID_WORKFLOW = `
workflow:
  workflowId: not-a-valid-uuid
  name: w
  description: d
  executionMode: Async
activities:
  - name: doThing
    steps:
      - task: utilities/httpRequest
        inputs: {}
inputs: []
outputs: []
`;

describe('schemaEnforcement workflow invalid input', () => {
  it('error mode rejects an invalid workflow', async () => {
    const v = new WorkflowValidator({ schemaEnforcement: 'error' });
    const file = writeFixture('wf-invalid.yaml', INVALID_WORKFLOW);
    const res = await v.validateWorkflow(file);
    expect(res.isValid).toBe(false);
    const violations = res.errors.filter(e => e.type === 'schema_violation');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some(e => /workflowId/i.test(e.path))).toBe(true);
  });

  it('warn mode flags an invalid workflow but stays valid', async () => {
    const v = new WorkflowValidator({ schemaEnforcement: 'warn' });
    const file = writeFixture('wf-invalid.yaml', INVALID_WORKFLOW);
    const res = await v.validateWorkflow(file);
    expect(res.isValid).toBe(true);
    const warnings = res.warnings.filter(w => w.type === 'schema_violation');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(w => /workflowId/i.test(w.path))).toBe(true);
  });
});

// Required-input presence check (schemas/workflows/task-required-inputs.json).
// Email/Send requires author-provided inputs: subject, body. (organizationId is
// system-injected and excluded from the catalog upstream.)
const EMAIL_SEND_MISSING_BODY = `
workflow:
  workflowId: 11111111-1111-1111-1111-111111111111
  name: t
  description: d
  executionMode: Async
activities:
  - name: send
    steps:
      - task: Email/Send@1
        name: email
        inputs:
          subject: hello
inputs: []
outputs: []
`;

const EMAIL_SEND_COMPLETE = `
workflow:
  workflowId: 11111111-1111-1111-1111-111111111111
  name: t
  description: d
  executionMode: Async
activities:
  - name: send
    steps:
      - task: Email/Send@1
        name: email
        inputs:
          subject: hello
          body: world
inputs: []
outputs: []
`;

describe('schemaEnforcement required-input presence check', () => {
  it('error mode flags a task missing a required input', async () => {
    const v = new WorkflowValidator({ schemaEnforcement: 'error' });
    const file = writeFixture('wf-missing.yaml', EMAIL_SEND_MISSING_BODY);
    const res = await v.validateWorkflow(file);
    expect(res.isValid).toBe(false);
    const missing = res.errors.filter(
      e => /missing required input 'body'/.test(e.message)
    );
    expect(missing.length).toBe(1);
    expect(missing[0].path).toMatch(/inputs\.body$/);
  });

  it('warn mode flags a missing required input as a warning but stays valid', async () => {
    const v = new WorkflowValidator({ schemaEnforcement: 'warn' });
    const file = writeFixture('wf-missing.yaml', EMAIL_SEND_MISSING_BODY);
    const res = await v.validateWorkflow(file);
    expect(res.isValid).toBe(true);
    const w = res.warnings.filter(x => /missing required input 'body'/.test(x.message));
    expect(w.length).toBe(1);
  });

  it('off mode does NOT flag a missing required input (baseline unchanged)', async () => {
    const v = new WorkflowValidator({});
    const file = writeFixture('wf-missing.yaml', EMAIL_SEND_MISSING_BODY);
    const res = await v.validateWorkflow(file);
    expect(res.errors.filter(e => /missing required input/.test(e.message))).toHaveLength(0);
    expect(res.warnings.filter(w => /missing required input/.test(w.message))).toHaveLength(0);
  });

  it('passes when all required inputs are present', async () => {
    const v = new WorkflowValidator({ schemaEnforcement: 'error' });
    const file = writeFixture('wf-complete.yaml', EMAIL_SEND_COMPLETE);
    const res = await v.validateWorkflow(file);
    expect(res.errors.filter(e => /missing required input/.test(e.message))).toHaveLength(0);
  });

  it('skips unknown tasks (no false positive)', async () => {
    const v = new WorkflowValidator({ schemaEnforcement: 'error' });
    const file = writeFixture('wf-unknown.yaml', `
workflow:
  workflowId: 11111111-1111-1111-1111-111111111111
  name: t
  description: d
  executionMode: Async
activities:
  - name: send
    steps:
      - task: Does/NotExist@1
        name: x
        inputs: {}
inputs: []
outputs: []
`);
    const res = await v.validateWorkflow(file);
    expect(res.errors.filter(e => /missing required input/.test(e.message))).toHaveLength(0);
  });

  it('matches task name case-insensitively and strips @version', async () => {
    const v = new WorkflowValidator({ schemaEnforcement: 'error' });
    const file = writeFixture('wf-case.yaml', `
workflow:
  workflowId: 11111111-1111-1111-1111-111111111111
  name: t
  description: d
  executionMode: Async
activities:
  - name: send
    steps:
      - task: email/send@1
        name: x
        inputs:
          subject: hi
inputs: []
outputs: []
`);
    const res = await v.validateWorkflow(file);
    const missing = res.errors.filter(e => /missing required input 'body'/.test(e.message));
    expect(missing.length).toBe(1);
  });

  it('skips control-flow tasks; still checks nested steps', async () => {
    const v = new WorkflowValidator({ schemaEnforcement: 'error' });
    const file = writeFixture('wf-foreach.yaml', `
workflow:
  workflowId: 11111111-1111-1111-1111-111111111111
  name: t
  description: d
  executionMode: Async
activities:
  - name: loop
    steps:
      - task: foreach
        name: each
        inputs: {}
        steps:
          - task: Email/Send@1
            name: email
            inputs:
              subject: hi
inputs: []
outputs: []
`);
    const res = await v.validateWorkflow(file);
    // foreach itself is not in the catalog -> not flagged
    expect(res.errors.filter(e => /foreach/.test(e.path))).toHaveLength(0);
    // nested Email/Send is still validated -> body missing
    const nested = res.errors.filter(e => /missing required input 'body'/.test(e.message));
    expect(nested.length).toBe(1);
  });
});

import { execFileSync } from 'child_process';

const DIST_CLI = path.resolve(__dirname, '../dist/cli.js');

function runCli(file: string, ...extra: string[]): { result: any; exitCode: number } {
  try {
    const stdout = execFileSync('node', [DIST_CLI, file, '--format', 'json', ...extra], {
      encoding: 'utf-8'
    });
    return { result: JSON.parse(stdout), exitCode: 0 };
  } catch (e: any) {
    // Non-zero exit (e.g. --schema-enforcement=error found violations) still
    // writes the JSON result to stdout before exiting.
    const stdout = e.stdout ?? '';
    return { result: JSON.parse(stdout), exitCode: typeof e.status === 'number' ? e.status : 1 };
  }
}

describe('CLI --schema-enforcement', () => {
  it('absent flag = off (invalid orientation passes, exit 0)', () => {
    const file = writeFixture('invalid.yaml', INVALID_ORIENTATION_MODULE);
    const { result, exitCode } = runCli(file);
    expect(result.isValid).toBe(true);
    expect(exitCode).toBe(0);
  });

  it('--schema-enforcement=error flags the violation and exits non-zero', () => {
    const file = writeFixture('invalid.yaml', INVALID_ORIENTATION_MODULE);
    const { result, exitCode } = runCli(file, '--schema-enforcement=error');
    expect(result.isValid).toBe(false);
    expect(exitCode).not.toBe(0);
  });

  it('--schema-enforcement=warn stays valid and exits 0', () => {
    const file = writeFixture('invalid.yaml', INVALID_ORIENTATION_MODULE);
    const { result, exitCode } = runCli(file, '--schema-enforcement=warn');
    expect(result.isValid).toBe(true);
    expect(exitCode).toBe(0);
    expect((result.warnings || []).filter((w: any) => w.type === 'schema_violation').length).toBeGreaterThan(0);
  });
});

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
