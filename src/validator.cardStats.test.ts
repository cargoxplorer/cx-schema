import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ModuleValidator } from './validator';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-card-stats-'));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

async function validate(layoutYaml: string) {
  const file = path.join(dir, `${Math.random().toString(36).slice(2)}-module.yaml`);
  fs.writeFileSync(file, `module:
  name: CardStatsTest
  appModuleId: 7b1e3c52-9a4d-4f6e-8c2b-1d3e5f7a9b0c
  application: CXTMS
components:
  - name: CardStatsTest/Page
    layout:
${layoutYaml}`);
  return new ModuleValidator().validateModule(file);
}

const schemaErrors = (r: any) => r.errors.filter((e: any) => e.type === 'schema_violation');

const card = (header: string) => `      component: card
      name: invoiceCard
      props:
        options:
          header:
${header}      children: []
`;

const stats = (props: string) => `      component: stats
      name: totals
      props:
${props}`;

describe('ModuleValidator card header', () => {
  it('accepts title, titleType, badge and action', async () => {
    const result = await validate(card(`            title: "Invoice {{ invoiceForm.transactionNumber }}"
            titleType: h2
            subheader: { en-US: Details }
            icon: tabler-file
            iconColor: primary.main
            badge:
              label: "{{ invoiceForm.status }}"
            action:
              - component: dropdown
                name: invoiceActions
            sx: { pb: 0 }
`));

    expect(schemaErrors(result)).toEqual([]);
  });

  it('accepts a card whose props key is left empty', async () => {
    const result = await validate(`      component: card\n      name: emptyCard\n      props:\n      children: []\n`);

    expect(schemaErrors(result)).toEqual([]);
  });

  it('rejects a titleType other than h1-h6', async () => {
    const errors = schemaErrors(await validate(card(`            title: Invoice\n            titleType: h9\n`)));

    expect(errors.some((e: any) => e.path.endsWith('/header/titleType'))).toBe(true);
  });

  it('rejects an unknown header key', async () => {
    const errors = schemaErrors(await validate(card(`            title: Invoice\n            subtitle: Details\n`)));

    expect(errors.some((e: any) => e.path.endsWith('/header') && e.message.includes("'subtitle'"))).toBe(true);
  });

  it('rejects a header action that is not a component list', async () => {
    const errors = schemaErrors(await validate(card(`            title: Invoice\n            action:\n              - label: Edit\n`)));

    expect(errors.some((e: any) => e.path.includes('/header/action'))).toBe(true);
  });

  it('rejects a header badge without a label', async () => {
    const errors = schemaErrors(await validate(card(`            title: Invoice\n            badge:\n              colorKey: open\n`)));

    expect(errors.some((e: any) => e.path.includes('/header/badge'))).toBe(true);
  });
});

describe('ModuleValidator stats', () => {
  it('accepts every documented prop', async () => {
    const result = await validate(stats(`        variant: cards
        size: lg
        align: end
        className: totals-strip
        items:
          - label: { en-US: Weight }
            value: "{{ orderSummary.totalWeight }}"
            unit: Lb
            decimals: 2
            caption: "Due {{ format invoiceForm.dueDate L }}"
            emphasis: true
            icon: tabler-weight
            color: info
`));

    expect(schemaErrors(result)).toEqual([]);
  });

  it('rejects an unknown variant', async () => {
    const errors = schemaErrors(await validate(stats(`        variant: bogus\n        items: []\n`)));

    expect(errors.some((e: any) => e.path.endsWith('/props/variant'))).toBe(true);
  });

  it('rejects items that are not a list', async () => {
    const errors = schemaErrors(await validate(stats(`        items: not-a-list\n`)));

    expect(errors.some((e: any) => e.path.endsWith('/props/items'))).toBe(true);
  });

  it('rejects a misspelled item key', async () => {
    const errors = schemaErrors(await validate(stats(`        items:\n          - label: Weight\n            value: 1\n            colr: info\n`)));

    expect(errors.some((e: any) => e.path.endsWith('/items/0') && e.message.includes("'colr'"))).toBe(true);
  });

  it('rejects an item color outside the theme colors', async () => {
    const errors = schemaErrors(await validate(stats(`        items:\n          - label: Weight\n            value: 1\n            color: purple\n`)));

    expect(errors.some((e: any) => e.path.endsWith('/items/0/color'))).toBe(true);
  });

  it('requires items', async () => {
    const errors = schemaErrors(await validate(stats(`        variant: row\n`)));

    expect(errors.some((e: any) => e.message.includes('items'))).toBe(true);
  });
});
