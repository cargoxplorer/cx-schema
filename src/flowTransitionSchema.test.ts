import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import * as fs from 'fs';
import * as path from 'path';

// The workflow validator matches steps against an anyOf that ends in a generic
// fallback, so task-level violations are masked there. The task schema
// contract is therefore tested directly.
const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../schemas/workflows/tasks/flow-transition.json'), 'utf-8')
);
const validate = new Ajv({ strict: false, allErrors: true }).compile(schema);

const step = (inputs: Record<string, unknown>) => ({
  task: 'Flow/Transition@1',
  name: 'transition',
  inputs: { entityName: 'Order', entityId: '1', transition: 'approve', ...inputs },
});

describe('Flow/Transition executionMode input', () => {
  it.each(['Async', 'Sync'])('accepts executionMode %s', (mode) => {
    expect(validate(step({ executionMode: mode }))).toBe(true);
  });

  it('accepts a step without executionMode', () => {
    expect(validate(step({}))).toBe(true);
  });

  it('rejects an unknown executionMode value', () => {
    expect(validate(step({ executionMode: 'Later' }))).toBe(false);
  });
});
