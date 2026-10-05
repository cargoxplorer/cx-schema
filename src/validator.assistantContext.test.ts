import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ModuleValidator } from './validator';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-ac-'));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

async function validate(componentsYaml: string) {
  const file = path.join(dir, `${Math.random().toString(36).slice(2)}-module.yaml`);
  fs.writeFileSync(file, `module:
  name: AssistantContextTest
  appModuleId: 4f2b9c1d-7e3a-4b6f-8a1c-9d2e3f4a5b60
  displayName:
    en-US: Assistant Context Test
  application: CXTMS
components:
${componentsYaml}`);
  return new ModuleValidator().validateModule(file);
}

const good = `  - name: AirShipments/UpdateAirShipment
    displayName: { en-US: Update Air Shipment }
    assistantContext:
      kind: record
      icon: tabler-plane
      name: "Air Shipment {{ orderForm.orderNumber }}"
      data:
        orderId: "{{ orderId }}"
        orderNumber: "{{ orderForm.orderNumber }}"
        customer:
          name: "{{ orderForm.billToContact.name }}"
      questions:
        - "Where is {{ orderForm.orderNumber }} now?"
        - { en-US: "Why is it delayed?" }
    layout:
      component: layout
      name: updateAirShipmentLayout
`;

const contextErrors = (r: any) => r.errors.filter((e: any) => e.path.includes('assistantContext'));

describe('ModuleValidator assistantContext', () => {
  it('accepts a full declaration', async () => {
    expect(contextErrors(await validate(good))).toEqual([]);
  });

  it('accepts a declaration with only a name', async () => {
    const r = await validate(`  - name: Orders/List
    assistantContext:
      name: { en-US: Orders }
    layout:
      component: layout
`);
    expect(contextErrors(r)).toEqual([]);
  });

  it('accepts each kind', async () => {
    for (const kind of ['page', 'record', 'dialog']) {
      expect(contextErrors(await validate(good.replace('kind: record', `kind: ${kind}`)))).toEqual([]);
    }
  });

  it('components without assistantContext are unaffected', async () => {
    const r = await new ModuleValidator().validateModule(path.join(__dirname, '../examples/sample-module.yaml'));
    expect(r.errors).toEqual([]);
  });

  it.each([
    ['a missing name', good.replace('      name: "Air Shipment {{ orderForm.orderNumber }}"\n', '')],
    ['an unknown kind', good.replace('kind: record', 'kind: screen')],
    ['an unknown property', good.replace('icon: tabler-plane', 'icon: tabler-plane\n      prompt: hi')],
    ['data as a template string', good.replace(/      data:\n(        .*\n)+?      questions:/, '      data: "{{ orderForm }}"\n      questions:')],
    ['a malformed localized name', good.replace('name: "Air Shipment {{ orderForm.orderNumber }}"', 'name: { en: Order }')],
    ['six questions', good.replace('        - { en-US: "Why is it delayed?" }\n', '        - a\n        - b\n        - c\n        - d\n        - e\n')],
    ['a non-string question', good.replace('        - { en-US: "Why is it delayed?" }\n', '        - 42\n')]
  ])('rejects %s', async (_label, yaml) => {
    const errs = contextErrors(await validate(yaml));
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.every((e: any) => e.type === 'schema_violation' && e.path.startsWith('components[0].assistantContext'))).toBe(true);
  });

  it('reports data written as a template string at the data path', async () => {
    const r = await validate(good.replace(/      data:\n(        .*\n)+?      questions:/, '      data: "{{ orderForm }}"\n      questions:'));
    expect(contextErrors(r).some((e: any) => e.path === 'components[0].assistantContext/data')).toBe(true);
  });

  it('warns when assistantContext is placed on an inner component', async () => {
    const r = await validate(`  - name: Orders/Update
    layout:
      component: layout
      children:
        - component: form
          name: orderForm
          props:
            assistantContext:
              name: "Order {{ orderNumber }}"
`);
    expect(r.warnings).toContainEqual(expect.objectContaining({
      type: 'misplaced_assistant_context',
      path: 'components[0].layout.children[0].props.assistantContext'
    }));
  });

  it('the assistant context example passes full validation', async () => {
    const r = await new ModuleValidator().validateModule(path.join(__dirname, '../examples/assistant-context-module.yaml'));
    expect(r.errors).toEqual([]);
    expect(r.warnings.filter((w: any) => w.type === 'misplaced_assistant_context')).toEqual([]);
    expect(r.isValid).toBe(true);
  });
});
