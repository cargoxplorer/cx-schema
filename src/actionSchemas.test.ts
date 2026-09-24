import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';
import { ModuleValidator } from './validator';

const SCHEMAS_DIR = path.join(__dirname, '../schemas');
const EXAMPLE = path.join(__dirname, '../examples/feedback-actions-module.yaml');

/**
 * Compile actions/all.json with every schema file registered under its
 * relative path, so cross-file $refs (e.g. ../schemas.json#/definitions/...)
 * resolve. The published ModuleValidator does not currently enforce action
 * arrays (pre-existing gap), so the schema contract is tested directly here.
 */
function compileAllActions() {
  const ajv = new Ajv({ strict: false, allErrors: true, allowUnionTypes: true });
  addFormats(ajv);
  const register = (dir: string, prefix: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        register(full, `${prefix}${entry.name}/`);
      } else if (entry.name.endsWith('.json')) {
        const schema = JSON.parse(fs.readFileSync(full, 'utf-8'));
        const relPath = `${prefix}${entry.name}`;
        // Set $id to a root-relative path matching the file's location so
        // Ajv's relative URI resolution (used for e.g. `../schemas.json#/...`
        // refs) works, while still registering under the plain relative
        // path so ajv.getSchema('actions/all.json') keeps working below.
        schema.$id = `/${relPath}`;
        ajv.addSchema(schema, relPath);
      }
    }
  };
  register(SCHEMAS_DIR, '');
  const validate = ajv.getSchema('actions/all.json');
  if (!validate) throw new Error('actions/all.json failed to compile');
  return validate;
}

describe('sound and vibrate action schemas', () => {
  const validate = compileAllActions();

  it.each([
    { sound: 'success' },
    { sound: 'scan' },
    { sound: { type: 'error', volume: 0.8 } },
    { vibrate: 'heavy' },
    { vibrate: { type: 'warning' } },
    { vibrate: { pattern: [100, 50, 100] } },
    { vibrate: { duration: 200 } }
  ])('accepts %j', (action) => {
    expect(validate(action)).toBe(true);
  });

  it.each([
    { sound: 'loud' },
    { sound: { type: 'success', volume: 2 } },
    { sound: { loop: true } },
    { vibrate: 'gentle' },
    { vibrate: { pattern: [] } },
    { vibrate: { duration: 200, intensity: 5 } }
  ])('rejects %j', (action) => {
    expect(validate(action)).toBe(false);
  });

  it('existing actions still compile and validate through the registry', () => {
    expect(validate({ refresh: 'ordersGrid' })).toBe(true);
  });

  it('the example module still passes full CLI validation', async () => {
    const validator = new ModuleValidator();
    const result = await validator.validateModule(EXAMPLE);
    expect(result.errors).toEqual([]);
    expect(result.isValid).toBe(true);
  });
});
