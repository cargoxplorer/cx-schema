import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { WorkflowValidator } from './workflowValidator';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-permission-'));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

async function validate(yaml: string) {
  const file = path.join(dir, `${Math.random().toString(36).slice(2)}.yaml`);
  fs.writeFileSync(file, yaml);
  return new WorkflowValidator().validateWorkflow(file);
}

const base = (permissionLine: string, inputType = 'text') => `
workflow:
  name: "Stores / Create Store"
  workflowId: "6f1c2c1e-1b2a-4d3e-9f00-000000000010"
  workflowType: "McpTool"
  executionMode: "Sync"
  isActive: true
${permissionLine}
mcp:
  name: storevista_create_store
inputs:
  - name: importedFileUrl
    type: ${inputType}
    props: { required: true, description: "The manifest file" }
activities:
  - name: main
    steps:
      - task: "Utilities/Log@1"
        name: log
        inputs:
          message: "ok"
`;

describe('workflow.permission and file inputs', () => {
  it('accepts a workflow with a permission', async () => {
    const result = await validate(base('  permission: "System/Store/Create"'));
    expect(result.errors).toEqual([]);
  });

  it('rejects an empty permission', async () => {
    const result = await validate(base('  permission: ""'));
    expect(result.errors.some(e => /permission/.test(e.path ?? '') || /permission|minLength|fewer than 1/.test(e.message))).toBe(true);
  });

  it('accepts a file input', async () => {
    const result = await validate(base('', 'file'));
    expect(result.errors).toEqual([]);
  });
});
