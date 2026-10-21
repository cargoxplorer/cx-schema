import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

const SCHEMAS_DIR = path.join(__dirname, '../schemas');

/** Compile components/map.json with every schema registered so its cross-file $refs resolve. */
function compileMap() {
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
        schema.$id = `/${relPath}`;
        ajv.addSchema(schema, relPath);
      }
    }
  };
  register(SCHEMAS_DIR, '');
  const validate = ajv.getSchema('components/map.json');
  if (!validate) throw new Error('components/map.json failed to compile');
  return validate;
}

const map = (props: Record<string, unknown>) => ({ component: 'map', name: 'm', props });

describe('map component schema', () => {
  const validate = compileMap();

  it.each([
    map({ paths: '{{ shiftTrack.paths }}' }),
    map({ paths: [{ points: '{{ shiftTrack.points }}' }] }),
    map({
      paths: [
        {
          points: [
            { lat: 33.749, lng: -84.388, recordedAt: '2026-10-16T08:00:00Z' },
            { lat: 33.79, lng: -84.32 }
          ],
          color: 'success',
          width: 6,
          dashed: true,
          gapMinutes: 10,
          label: 'Shift track'
        },
        { points: [], color: '#e53935', width: '{{ lineWidth }}', dashed: '{{ isPlanned }}' }
      ]
    }),
    map({ markers: [{ id: 1, lat: 33.7, lng: -84.3, color: 'warning', text: 'A' }] }),
    map({ markers: [{ id: 1, lat: 33.7, lng: -84.3, color: 'rgb(30, 136, 229)' }] }),
    map({ refreshInterval: 60000 }),
    map({ refreshInterval: 0 }),
    map({ refreshInterval: '{{ refreshMs }}' }),
    map({ refreshInterval: 30000, refreshHandler: 'driverTrack' }),
    map({ refreshHandler: ['driverTrack', 'liveMap'] }),
    map({ refreshHandler: '{{ trackHandler }}' }),
    map({ stops: '{{ dispatchRoute.stops }}', fitBounds: true })
  ])('accepts %j', (component) => {
    expect(validate(component)).toBe(true);
  });

  it.each([
    map({ paths: { points: [] } }),
    map({ paths: [{ color: 'primary' }] }),
    map({ paths: [{ points: [{ lat: 33.7 }] }] }),
    map({ paths: [{ points: [{ lat: '33.7', lng: -84.3 }] }] }),
    map({ paths: [{ points: [], width: -1 }] }),
    map({ paths: [{ points: [], dashed: 'yes' }] }),
    map({ paths: [{ points: [], gapMinutes: 'ten' }] }),
    map({ markers: [{ id: 1, lat: 33.7, lng: -84.3, color: 1 }] }),
    map({ markers: [{ id: 1, lat: 33.7, lng: -84.3, text: 7 }] }),
    map({ refreshInterval: -5 }),
    map({ refreshInterval: 'fast' }),
    // milliseconds: a value meant as seconds is caught
    map({ refreshInterval: 60 }),
    map({ refreshHandler: 7 }),
    map({ refreshHandler: [7] })
  ])('rejects %j', (component) => {
    expect(validate(component)).toBe(false);
  });

  it('every x-example validates', () => {
    const schema = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, 'components/map.json'), 'utf-8'));
    for (const example of schema['x-examples']) {
      expect(validate(example)).toBe(true);
    }
  });
});
