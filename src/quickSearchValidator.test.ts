import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { validateQuickSearch, QuickSearchKinds } from './quickSearchValidator';

const kinds: QuickSearchKinds = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../schemas/quick-search-kinds.json'), 'utf-8'));

const valid = () => ({
  enabled: true,
  matchFields: ['orderNumber'],
  select: ['orderNumber', 'billToContact.name', 'customValues.hawb'],
  icon: 'ti-plane',
  display: { title: '{{ orderNumber }}', subtitle: '{{ billToContact.name }} {{ customValues.hawb }}' },
  open: { navigate: 'orders/{{ orderId }}' }
});

const run = (config: any, kind: string | null = 'Order') => validateQuickSearch('AirShipment', kind, config, kinds);

describe('validateQuickSearch', () => {
  it('accepts a valid config', () => expect(run(valid())).toEqual([]));

  it('DisabledConfig_IsNotValidated', () => expect(run({ enabled: false }, null)).toEqual([]));

  it.each([null, 'Other', 'Calendar'])('rejects unsupported entityKind %s', kind => {
    const errors = run(valid(), kind);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^Entity 'AirShipment' quickSearch: entityKind must be one of AccountingTransaction, Commodity, Contact, Job, Order\.$/);
  });

  it('rejects a match field not in the allow-list, including customValues', () => {
    const c = valid(); c.matchFields = ['customValues.hawb'];
    const errors = run(c);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("matchFields 'customValues.hawb' is not searchable for Order");
  });

  it('requires at least one match field', () => {
    const c = valid(); c.matchFields = [];
    expect(run(c).some(e => e.includes('matchFields must list at least one field'))).toBe(true);
  });

  it('rejects an unknown select path', () => {
    const c = valid(); c.select.push('shipper.name');
    const errors = run(c);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("select 'shipper.name' is not available for Order");
  });

  it('rejects the literal customValues.* wildcard in select', () => {
    const c = valid(); c.select.push('customValues.*');
    expect(run(c).some(e => e.includes("select 'customValues.*'"))).toBe(true);
  });

  it('rejects a template path that is not selected', () => {
    const c: any = valid(); c.display.badge = '{{ orderStatus.orderStatusName }}';
    const errors = run(c);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("template path 'orderStatus.orderStatusName' must be listed in select");
  });

  it.each(['{{number orderNumber }}', '{{orderNumber}}', '#{{ orderId }}'])('understands template %s', title => {
    const c = valid(); c.display.title = title;
    expect(run(c)).toEqual([]);
  });

  it('requires display.title and icon', () => {
    const c: any = valid(); c.display = {}; delete c.icon;
    expect(run(c)).toHaveLength(2);
  });

  it.each([[{}], [{ navigate: 'a', dialog: { name: 'd' } }]])('requires exactly one open action %j', open => {
    const c: any = valid(); c.open = open;
    expect(run(c).filter(e => e.includes('open must define exactly one of navigate or dialog'))).toHaveLength(1);
  });

  it('checks navigate template paths', () => {
    const c: any = valid(); c.open = { navigate: 'orders/{{ trackingNumber }}' };
    expect(run(c)[0]).toContain("template path 'trackingNumber'");
  });
});
