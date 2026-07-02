import { describe, it, expect } from 'vitest';
import { buildLocationMap } from '../src/yamlLocationResolver';

const yaml = `
module:
  name: TestModule
  appModuleId: test-module
components:
  - name: Grid
    props:
      label: Orders
`;

describe('buildLocationMap', () => {
  it('returns location for a nested scalar', () => {
    const map = buildLocationMap(yaml);
    const loc = map.lookup('module.name');
    expect(loc).toBeDefined();
    expect(loc!.line).toBeGreaterThan(0);
    expect(loc!.column).toBeGreaterThan(0);
  });

  it('returns location for array items', () => {
    const map = buildLocationMap(yaml);
    const loc = map.lookup('components.0.name');
    expect(loc).toBeDefined();
    expect(loc!.line).toBeGreaterThan(0);
    expect(loc!.column).toBeGreaterThan(0);
  });

  it('returns undefined for unknown paths', () => {
    const map = buildLocationMap(yaml);
    expect(map.lookup('module.doesNotExist')).toBeUndefined();
  });

  it('accepts JSON pointer paths', () => {
    const map = buildLocationMap(yaml);
    const dotLoc = map.lookup('module.name');
    const pointerLoc = map.lookup('/module/name');
    expect(pointerLoc).toBeDefined();
    expect(pointerLoc).toEqual(dotLoc);
  });

  it('accepts bracket notation paths', () => {
    const map = buildLocationMap(yaml);
    const dotLoc = map.lookup('components.0.props.label');
    const bracketLoc = map.lookup('components[0].props.label');
    expect(bracketLoc).toBeDefined();
    expect(bracketLoc).toEqual(dotLoc);
  });

  it('orders nested scalars by line', () => {
    const map = buildLocationMap(yaml);
    const moduleName = map.lookup('module.name');
    const componentName = map.lookup('components.0.name');
    expect(componentName!.line).toBeGreaterThan(moduleName!.line);
  });
});