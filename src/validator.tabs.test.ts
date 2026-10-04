import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ModuleValidator } from './validator';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-tabs-'));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

async function validate(tabsYaml: string) {
  const file = path.join(dir, `${Math.random().toString(36).slice(2)}-module.yaml`);
  fs.writeFileSync(file, `module:
  name: TabsTest
  appModuleId: 5d2f8a90-1c3b-4e7a-9b6d-0f1e2a3b4c5d
  application: CXTMS
components:
  - name: TabsTest/Page
    layout:
${tabsYaml}`);
  return new ModuleValidator().validateModule(file);
}

const tabsErrors = (r: any) => r.errors.filter((e: any) => e.type === 'schema_violation');

const tabs = (extra: string) => `      component: tabs
      name: pageTabs
${extra}      children:
        - component: tab
          name: general
          props:
            label: { en-US: General }
`;

const header = (indent: string) => `${indent}header:
${indent}  title:
${indent}    - component: text
${indent}      name: pageTitle
${indent}      props: { value: Title }
`;

describe('ModuleValidator tabs', () => {
  it('accepts header under props', async () => {
    expect(tabsErrors(await validate(tabs(`      props:\n${header('        ')}`)))).toEqual([]);
  });

  it('accepts the legacy top-level inputs key', async () => {
    expect(tabsErrors(await validate(tabs(`      inputs:\n        - name: orderId\n          type: number\n`)))).toEqual([]);
  });

  it('rejects header placed beside props instead of under it', async () => {
    const errors = tabsErrors(await validate(tabs(header('      '))));

    expect(errors.some((e: any) => e.message.includes('header'))).toBe(true);
  });
});
