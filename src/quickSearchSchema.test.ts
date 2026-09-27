import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

const SCHEMAS_DIR = path.join(__dirname, '../schemas');
const schemas = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, 'schemas.json'), 'utf-8'));
const kinds = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, 'quick-search-kinds.json'), 'utf-8'));

function compile(pointer: string) {
  const ajv = new Ajv({ strict: false, allErrors: true, allowUnionTypes: true });
  addFormats(ajv);
  ajv.addSchema(schemas, 'schemas.json');
  const validate = ajv.getSchema(`schemas.json#/definitions/${pointer}`);
  if (!validate) throw new Error(`${pointer} failed to compile`);
  return validate;
}

const valid = {
  enabled: true,
  filter: 'orderType: AirShipmentOrder',
  permission: 'AirShipments/Read',
  matchFields: ['orderNumber', 'trackingNumber'],
  select: ['orderNumber', 'billToContact.name', 'customValues.hawb'],
  groupLabel: { 'en-US': 'Air Shipments' },
  icon: 'ti-plane',
  order: 20,
  display: { title: '{{ orderNumber }}', subtitle: '{{ billToContact.name }}', badge: '{{ orderNumber }}' },
  open: { navigate: 'orders/{{ orderId }}' }
};

describe('quickSearch schema', () => {
  const validate = compile('quickSearch');

  it('accepts a full block', () => {
    expect(validate(valid)).toBe(true);
  });

  it('accepts a dialog open action', () => {
    expect(validate({ ...valid, open: { dialog: 'Orders/UpdateOrder' } })).toBe(true);
  });

  it('rejects an object dialog', () => {
    expect(validate({ ...valid, open: { dialog: { name: 'updateCustomerDialog', props: { contactId: '{{ contactId }}' } } } })).toBe(false);
  });

  it('rejects a dialog component name without a slash', () => {
    expect(validate({ ...valid, open: { dialog: 'UpdateOrder' } })).toBe(false);
  });

  it('rejects unknown properties', () => {
    expect(validate({ ...valid, matchField: ['orderNumber'] })).toBe(false);
  });

  it('requires enabled', () => {
    const { enabled, ...rest } = valid;
    expect(validate(rest)).toBe(false);
  });

  it('accepts an open with both navigate and dialog (semantic layer\'s job)', () => {
    expect(validate({ ...valid, open: { navigate: 'x', dialog: 'Orders/UpdateOrder' } })).toBe(true);
  });

  it('accepts an empty open (semantic layer\'s job)', () => {
    expect(validate({ ...valid, open: {} })).toBe(true);
  });

  it('accepts display without title (semantic layer\'s job)', () => {
    expect(validate({ ...valid, display: { subtitle: 'x' } })).toBe(true);
  });

  it('rejects non-integer order', () => {
    expect(validate({ ...valid, order: 'first' })).toBe(false);
  });
});

describe('entity schema', () => {
  const validate = compile('entity');

  it('accepts an entity with quickSearch', () => {
    expect(validate({ name: 'AirShipment', entityKind: 'Order', quickSearch: valid })).toBe(true);
  });

  it.each(['Job', 'Commodity', 'CalendarAvailabilityBlock', 'AuditChangeEntry'])('accepts entityKind %s', kind => {
    expect(validate({ name: 'X', entityKind: kind })).toBe(true);
  });
});

describe('quick-search-kinds.json', () => {
  it('lists exactly the v1 kinds', () => {
    expect(Object.keys(kinds)).toEqual(['AccountingTransaction', 'Commodity', 'Contact', 'Job', 'Order']);
  });

  it('every kind is an allowed entityKind', () => {
    const enumValues: string[] = schemas.definitions.entity.properties.entityKind.enum;
    for (const kind of Object.keys(kinds)) expect(enumValues).toContain(kind);
  });

  it('every kind has key, matchFields and select', () => {
    for (const [kind, v] of Object.entries<any>(kinds)) {
      expect(typeof v.key, kind).toBe('string');
      expect(v.matchFields.length, kind).toBeGreaterThan(0);
      expect(v.select, kind).toContain('customValues.*');
    }
  });
});
