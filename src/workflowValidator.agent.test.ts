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

  it('rejects an Agent workflow with executionMode Async', async () => {
    const result = await validate(base.replace('executionMode: "Sync"', 'executionMode: "Async"'));
    expect(result.errors.some(e => /executionMode|Sync/.test(e.message))).toBe(true);
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

  it('accepts a tool with mode: approval', async () => {
    const result = await validate(base.replace(
      '    - workflow: "MCP / Get Order Status"\n      instructions: "Call first."',
      '    - workflow: "MCP / Get Order Status"\n      instructions: "Call first."\n    - workflow: "MCP / Cancel Shipment"\n      mode: approval'
    ));
    expect(result.errors).toEqual([]);
  });

  it('rejects an invalid tool mode', async () => {
    const result = await validate(base.replace(
      '    - workflow: "MCP / Get Order Status"\n      instructions: "Call first."',
      '    - workflow: "MCP / Get Order Status"\n      mode: sometimes'
    ));
    expect(result.errors.some(e => /mode/.test(e.path))).toBe(true);
  });

  it('accepts a valid model.contextWindow', async () => {
    const result = await validate(base.replace(
      'agent:\n  instructions: "Triage the order."',
      'agent:\n  instructions: "Triage the order."\n  model:\n    name: "claude-sonnet-4-5"\n    contextWindow: 200000'
    ));
    expect(result.errors).toEqual([]);
  });

  it('rejects a non-positive model.contextWindow', async () => {
    const result = await validate(base.replace(
      'agent:\n  instructions: "Triage the order."',
      'agent:\n  instructions: "Triage the order."\n  model:\n    contextWindow: 0'
    ));
    expect(result.errors.some(e => /contextWindow/.test(e.path))).toBe(true);
  });

  it('rejects a non-integer model.contextWindow', async () => {
    const result = await validate(base.replace(
      'agent:\n  instructions: "Triage the order."',
      'agent:\n  instructions: "Triage the order."\n  model:\n    contextWindow: 128.5'
    ));
    expect(result.errors.some(e => /contextWindow/.test(e.path))).toBe(true);
  });

  it('accepts legacy workflow types EmailTemplate and Webhook', async () => {
    const legacyBase = (type: string) => `
workflow:
  name: "Legacy Type Workflow"
  workflowId: "6f1c2c1e-1b2a-4d3e-9f00-000000000002"
  workflowType: "${type}"
  executionMode: "Sync"
  isActive: true
activities:
  - name: main
    steps:
      - task: "Utilities/Log@1"
        name: log
        inputs: { message: hi }
`;

    for (const type of ['EmailTemplate', 'Webhook']) {
      const result = await validate(legacyBase(type));
      expect(result.errors.filter(e => /workflowType/.test(e.message))).toEqual([]);
    }
  });

  const withUi = (ui: string) => base.replace(
    'agent:\n  instructions: "Triage the order."',
    `agent:\n  instructions: "Triage the order."\n  ui:\n${ui}`
  );

  it('accepts agent.ui display metadata', async () => {
    const result = await validate(withUi(
      '    name: "Tracking Agent"\n    shortDescription: "Status, ETAs, exceptions, POD"\n    icon: "map-pin"\n    color: info\n    prompts:\n      - "Which shipments are delayed today?"'
    ));
    expect(result.errors).toEqual([]);
  });

  it('rejects an unknown agent.ui.color', async () => {
    const result = await validate(withUi('    color: blue'));
    expect(result.errors.some(e => /color/.test(e.path))).toBe(true);
  });

  it('rejects more than 5 agent.ui.prompts', async () => {
    const prompts = [1, 2, 3, 4, 5, 6].map(i => `      - "Prompt ${i}"`).join('\n');
    const result = await validate(withUi(`    prompts:\n${prompts}`));
    expect(result.errors.some(e => /prompts/.test(e.path))).toBe(true);
  });

  it('rejects an unknown agent.ui property', async () => {
    const result = await validate(withUi('    theme: dark'));
    expect(result.errors.some(e => e.path.split('/').includes('ui') || /\btheme\b/.test(e.message))).toBe(true);
  });

  it('accepts a tool with mode: always', async () => {
    const result = await validate(base.replace(
      '    - workflow: "MCP / Get Order Status"\n      instructions: "Call first."',
      '    - workflow: "MCP / Get Order Status"\n      instructions: "Call first."\n    - workflow: "MCP / Void Invoice"\n      mode: always'
    ));
    expect(result.errors).toEqual([]);
  });
});
