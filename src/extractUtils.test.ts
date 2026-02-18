import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { computeExtractPriority } from './extractUtils';

// ============================================================================
// Unit tests: computeExtractPriority
// ============================================================================

describe('computeExtractPriority', () => {
  it('returns source priority + 1 when source has priority', () => {
    expect(computeExtractPriority(1)).toBe(2);
  });

  it('returns 1 when source has no priority', () => {
    expect(computeExtractPriority(undefined)).toBe(1);
  });

  it('handles priority 0 (returns 1)', () => {
    expect(computeExtractPriority(0)).toBe(1);
  });

  it('handles higher priority values', () => {
    expect(computeExtractPriority(5)).toBe(6);
    expect(computeExtractPriority(99)).toBe(100);
  });
});

// ============================================================================
// Integration tests: extract --copy behavior
// ============================================================================

describe('extract --copy integration', () => {
  const tmpDir = path.join(__dirname, '..', '.test-tmp');
  const sourceFile = path.join(tmpDir, 'source-module.yaml');
  const targetFile = path.join(tmpDir, 'target-module.yaml');
  const cliPath = path.join(__dirname, '..', 'dist', 'cli.js');

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeSourceModule(priority?: number) {
    const moduleObj: any = {
      name: 'SourceModule',
      appModuleId: '11111111-1111-1111-1111-111111111111',
      displayName: 'Source Module',
      application: 'cx',
    };
    if (priority !== undefined) {
      moduleObj.priority = priority;
    }
    const doc = {
      module: moduleObj,
      components: [
        { name: 'CompA', type: 'form', children: [] },
        { name: 'CompB', type: 'dataGrid', children: [] },
      ],
      routes: [
        { name: 'RouteA', path: '/a', component: 'CompA' },
        { name: 'RouteB', path: '/b', component: 'CompB' },
      ],
    };
    fs.writeFileSync(sourceFile, yaml.dump(doc, { indent: 2, lineWidth: -1, noRefs: true }), 'utf-8');
    return doc;
  }

  function readYaml(file: string): any {
    return yaml.load(fs.readFileSync(file, 'utf-8'));
  }

  it('source file is NOT modified when using --copy', async () => {
    writeSourceModule(1);
    const originalContent = fs.readFileSync(sourceFile, 'utf-8');

    const { execFileSync } = await import('child_process');
    execFileSync('node', [cliPath, 'extract', sourceFile, 'CompA', '--to', targetFile, '--copy'], {
      encoding: 'utf-8',
    });

    const afterContent = fs.readFileSync(sourceFile, 'utf-8');
    expect(afterContent).toBe(originalContent);
  });

  it('target module gets priority = source priority + 1', async () => {
    writeSourceModule(1);

    const { execFileSync } = await import('child_process');
    execFileSync('node', [cliPath, 'extract', sourceFile, 'CompA', '--to', targetFile, '--copy'], {
      encoding: 'utf-8',
    });

    const target = readYaml(targetFile);
    expect(target.module.priority).toBe(2);
  });

  it('target module gets priority 1 when source has no priority', async () => {
    writeSourceModule(); // no priority

    const { execFileSync } = await import('child_process');
    execFileSync('node', [cliPath, 'extract', sourceFile, 'CompA', '--to', targetFile, '--copy'], {
      encoding: 'utf-8',
    });

    const target = readYaml(targetFile);
    expect(target.module.priority).toBe(1);
  });

  it('target contains the copied component and its routes', async () => {
    writeSourceModule(3);

    const { execFileSync } = await import('child_process');
    execFileSync('node', [cliPath, 'extract', sourceFile, 'CompA', '--to', targetFile, '--copy'], {
      encoding: 'utf-8',
    });

    const target = readYaml(targetFile);
    expect(target.components).toHaveLength(1);
    expect(target.components[0].name).toBe('CompA');
    expect(target.routes).toHaveLength(1);
    expect(target.routes[0].component).toBe('CompA');
  });

  it('source retains all components when using --copy (not extract)', async () => {
    writeSourceModule(2);

    const { execFileSync } = await import('child_process');
    execFileSync('node', [cliPath, 'extract', sourceFile, 'CompA', '--to', targetFile, '--copy'], {
      encoding: 'utf-8',
    });

    const source = readYaml(sourceFile);
    expect(source.components).toHaveLength(2);
    expect(source.routes).toHaveLength(2);
  });

  it('without --copy, source IS modified (existing behavior)', async () => {
    writeSourceModule(1);

    const { execFileSync } = await import('child_process');
    execFileSync('node', [cliPath, 'extract', sourceFile, 'CompA', '--to', targetFile], {
      encoding: 'utf-8',
    });

    const source = readYaml(sourceFile);
    expect(source.components).toHaveLength(1);
    expect(source.components[0].name).toBe('CompB');
  });
});
