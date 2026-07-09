import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ModuleValidator } from './validator';

const EXAMPLE = path.join(__dirname, '../examples/feedback-actions-module.yaml');

describe('sound and vibrate action schemas', () => {
  it('accepts presets, object forms, pattern and duration', async () => {
    const validator = new ModuleValidator();
    const result = await validator.validateModule(EXAMPLE);
    expect(result.errors).toEqual([]);
    expect(result.isValid).toBe(true);
  });

  it('rejects an unknown sound preset', async () => {
    const yaml = fs
      .readFileSync(EXAMPLE, 'utf-8')
      .replace('- sound: success', '- sound: loud');
    const tmp = path.join(os.tmpdir(), `invalid-sound-${process.pid}.yaml`);
    fs.writeFileSync(tmp, yaml);
    try {
      const validator = new ModuleValidator();
      const result = await validator.validateModule(tmp);
      expect(result.isValid).toBe(false);
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('rejects unknown properties in the vibrate object form', async () => {
    const yaml = fs
      .readFileSync(EXAMPLE, 'utf-8')
      .replace('duration: 200', 'duration: 200\n                  intensity: 5');
    const tmp = path.join(os.tmpdir(), `invalid-vibrate-${process.pid}.yaml`);
    fs.writeFileSync(tmp, yaml);
    try {
      const validator = new ModuleValidator();
      const result = await validator.validateModule(tmp);
      expect(result.isValid).toBe(false);
    } finally {
      fs.unlinkSync(tmp);
    }
  });
});
