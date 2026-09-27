import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ModuleValidator } from './validator';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-qs-'));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

async function validate(entitiesYaml: string, validator = new ModuleValidator()) {
  const file = path.join(dir, `${Math.random().toString(36).slice(2)}-module.yaml`);
  fs.writeFileSync(file, `module:
  name: QuickSearchTest
  appModuleId: 0b8c7d1e-3a51-4c6f-9f7e-2d6f3c1a9b10
  application: CXTMS
entities:
${entitiesYaml}`);
  return validator.validateModule(file);
}

const good = `  - name: AirShipment
    entityKind: Order
    quickSearch:
      enabled: true
      filter: "orderType: AirShipmentOrder"
      matchFields: [orderNumber, trackingNumber]
      select: [orderNumber, billToContact.name]
      icon: ti-plane
      display:
        title: "{{ orderNumber }}"
        subtitle: "{{ billToContact.name }}"
      open:
        navigate: "orders/{{ orderId }}"
`;

const quickSearchErrors = (r: any) => r.errors.filter((e: any) => e.path.includes('quickSearch'));

describe('ModuleValidator quickSearch', () => {
  it('accepts a valid block', async () => {
    expect(quickSearchErrors(await validate(good))).toEqual([]);
  });

  it('reports schema violations with the entity path', async () => {
    const r = await validate(good.replace('icon: ti-plane', 'icon: ti-plane\n      bogus: 1'));
    expect(quickSearchErrors(r).some((e: any) => e.type === 'schema_violation' && e.path.startsWith('entities[0].quickSearch'))).toBe(true);
  });

  it('reports semantic violations', async () => {
    const r = await validate(good.replace('[orderNumber, trackingNumber]', '[customValues.hawb]'));
    const errs = quickSearchErrors(r);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toMatchObject({ type: 'invalid_quick_search', path: 'entities[0].quickSearch' });
    expect(errs[0].message).toContain("matchFields 'customValues.hawb'");
  });

  it('rejects a missing entityKind when enabled', async () => {
    const r = await validate(good.replace('    entityKind: Order\n', ''));
    expect(quickSearchErrors(r)[0].message).toContain('entityKind must be one of');
  });

  it('EntitiesWithoutQuickSearch_AreUnaffected', async () => {
    const r = await new ModuleValidator().validateModule(path.join(__dirname, '../examples/sample-module.yaml'));
    expect(r.errors).toEqual([]);
  });

  it('MissingKindsFile_ReportsClearError', async () => {
    const schemasCopy = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-qs-schemas-'));
    fs.cpSync(path.join(__dirname, '../schemas'), schemasCopy, { recursive: true });
    fs.rmSync(path.join(schemasCopy, 'quick-search-kinds.json'));
    try {
      const r = await validate(good, new ModuleValidator({ schemasPath: schemasCopy }));
      const errs = quickSearchErrors(r);
      expect(errs).toHaveLength(1);
      expect(errs[0].message).toContain('quick-search-kinds.json');
    } finally {
      fs.rmSync(schemasCopy, { recursive: true, force: true });
    }
  });

  it('MalformedKindsFile_ReportsClearError_AndOtherModulesStillValidate', async () => {
    const schemasCopy = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-qs-schemas-'));
    fs.cpSync(path.join(__dirname, '../schemas'), schemasCopy, { recursive: true });
    fs.writeFileSync(path.join(schemasCopy, 'quick-search-kinds.json'), '{ bad');
    try {
      const validator = new ModuleValidator({ schemasPath: schemasCopy });

      const r = await validate(good, validator);
      const errs = quickSearchErrors(r);
      expect(errs).toHaveLength(1);
      expect(errs[0].message).toContain('quick-search-kinds.json');

      const other = await validator.validateModule(path.join(__dirname, '../examples/sample-module.yaml'));
      expect(other.errors).toEqual([]);
    } finally {
      fs.rmSync(schemasCopy, { recursive: true, force: true });
    }
  });
});
