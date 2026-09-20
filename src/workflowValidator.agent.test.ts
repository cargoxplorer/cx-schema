import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { WorkflowValidator } from './workflowValidator';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-agent-'));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

async function validate(yaml: string) {
  const file = path.join(dir, `${Math.random().toString(36).slice(2)}.yaml`);
  fs.writeFileSync(file, yaml);
  return new WorkflowValidator().validateWorkflow(file);
}

const base = `
workflow:
  name: "Agents / Triage"
  workflowId: "6f1c2c1e-1b2a-4d3e-9f00-000000000001"
  workflowType: "Agent"
  executionMode: "Sync"
  isActive: true
agent:
  instructions: "Triage the order."
  session:
    type: "task"
  tools:
    - workflow: "MCP / Get Order Status"
      instructions: "Call first."
inputs:
  - name: orderNumber
    type: string
    props: { required: true }
`;

describe('Agent workflow schema', () => {
  it('accepts a minimal agent workflow without activities', async () => {
    const result = await validate(base);
    expect(result.errors).toEqual([]);
  });

  it('rejects activities on an agent workflow', async () => {
    const result = await validate(base + `
activities:
  - name: main
    steps: []
`);
    expect(result.errors.some(e => /activities/.test(e.message))).toBe(true);
  });

  it('rejects an unknown session type', async () => {
    const result = await validate(base.replace('type: "task"', 'type: "batch"'));
    expect(result.errors.some(e => /session|type|enum/.test(e.message))).toBe(true);
  });

  it('requires the agent section', async () => {
    const result = await validate(base.replace(/agent:[\s\S]*?inputs:/, 'inputs:'));
    expect(result.errors.some(e => /agent/.test(e.message))).toBe(true);
  });

  it('still lists McpTool as a valid type', async () => {
    const result = await validate(base.replace('"Agent"', '"McpTool"').replace(/agent:[\s\S]*?inputs:/, 'mcp:\n  name: t\ninputs:') + `
activities:
  - name: main
    steps:
      - task: "Utilities/Log@1"
        name: log
        inputs: { message: hi }
`);
    expect(result.errors.filter(e => /workflowType/.test(e.message))).toEqual([]);
  });
});
