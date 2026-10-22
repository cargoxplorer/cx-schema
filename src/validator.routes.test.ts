import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ModuleValidator } from './validator';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-routes-'));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

async function validate(routesYaml: string) {
  const file = path.join(dir, `${Math.random().toString(36).slice(2)}-module.yaml`);
  fs.writeFileSync(file, `module:
  name: RoutesTest
  displayName: { en-US: Routes Test }
  appModuleId: 5d2f8a90-1c3b-4e7a-9b6d-0f1e2a3b4c5d
  application: CXTMS
components:
  - name: RoutesTest/Page
    layout:
      component: layout
routes:
${routesYaml}`);
  return new ModuleValidator().validateModule(file);
}

const deprecated = (r: any) => r.warnings.filter((w: any) => w.type === 'deprecated_property');

const route = (props: string, children = '') => `  - name: RoutesTest/Page
    path: routes-test
    component: RoutesTest/Page
    props:
      title: { en-US: Routes }
${props}${children}`;

describe('ModuleValidator route permissions', () => {
  it('accepts permission as a string', async () => {
    const result = await validate(route('      permission: System/Orders/Read\n'));

    expect(result.errors).toEqual([]);
    expect(deprecated(result)).toEqual([]);
  });

  it('accepts permission as an array', async () => {
    const result = await validate(route('      permission: [System/Orders/Read, System/Orders/Update]\n'));

    expect(result.errors).toEqual([]);
    expect(deprecated(result)).toEqual([]);
  });

  it('warns on requiredPermissions without failing', async () => {
    const result = await validate(route('      requiredPermissions: [System/Orders/Read]\n'));

    expect(result.isValid).toBe(true);
    expect(deprecated(result)).toEqual([
      {
        type: 'deprecated_property',
        path: 'routes[0].props.requiredPermissions',
        message: 'Use "permission" instead of "requiredPermissions" in route props'
      }
    ]);
  });

  it('warns on permissions, including a string value', async () => {
    const result = await validate(route('      permissions: System/Orders/Read\n'));

    expect(result.isValid).toBe(true);
    expect(deprecated(result).map((w: any) => w.path)).toEqual(['routes[0].props.permissions']);
  });

  it('warns on child routes', async () => {
    const result = await validate(
      route(
        '      permission: System/Orders/Read\n',
        `    children:
      - name: RoutesTest/Child
        path: :id
        component: RoutesTest/Page
        props:
          title: { en-US: Child }
          requiredPermissions: [System/Orders/Read]
`
      )
    );

    expect(result.isValid).toBe(true);
    expect(deprecated(result).map((w: any) => w.path)).toEqual(['routes[0].children[0].props.requiredPermissions']);
  });
});
