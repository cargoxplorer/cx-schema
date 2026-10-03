import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AppValidator } from './appValidator';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-app-yaml-'));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

async function validate(yaml: string) {
  const file = path.join(dir, `${Math.random().toString(36).slice(2)}.app.yaml`);
  fs.writeFileSync(file, yaml);
  return new AppValidator().validateApp(file);
}

const full = `
id: "4f29c257-e8e1-47ea-8cbd-2a112375de42"
name: "@cargox/cx-app-fedex"
version: 1.0.3
description: Rate, ship and track FedEx Express, Ground and Freight.
author: CargoXplorer
icon: https://cdn.example.com/fedex.svg
repository: https://github.com/cargoxplorer/cx-app-fedex
branch: main
listing:
  vendor: CargoXplorer
  summary: Rate, ship and track FedEx. Labels and POD directly from shipments.
  configName: apps.fedex
  permissions:
    - Read shipments, packages and addresses
    - Create labels and manifests
  features:
    - { icon: currency-dollar, title: Rate Shopping, description: Live rates at quote time }
    - { icon: barcode, title: Label Generation, description: ZPL / PDF labels and manifests }
  brand:
    mark: FedEx
    bg: "#4D148C"
    fg: "#FFFFFF"
`;

describe('AppValidator', () => {
  it('accepts a full app.yaml with listing and brand (mark: FedEx, 5 chars)', async () => {
    const result = await validate(full);
    expect(result.errors).toEqual([]);
  });

  it('accepts a minimal app.yaml (id + name + version only)', async () => {
    const result = await validate(`
id: "4f29c257-e8e1-47ea-8cbd-2a112375de42"
name: cx-app-minimal
version: 1.0.0
`);
    expect(result.errors).toEqual([]);
  });

  it('accepts a relative (non-URL) icon, e.g. icon.png', async () => {
    const result = await validate(full.replace(
      'icon: https://cdn.example.com/fedex.svg',
      'icon: icon.png'
    ));
    expect(result.errors).toEqual([]);
  });

  it('accepts a relative icon with another allowed image extension, e.g. logo.svg', async () => {
    const result = await validate(full.replace(
      'icon: https://cdn.example.com/fedex.svg',
      'icon: logo.svg'
    ));
    expect(result.errors).toEqual([]);
  });

  it('rejects a relative icon with a disallowed extension, e.g. logo.gif', async () => {
    const result = await validate(full.replace(
      'icon: https://cdn.example.com/fedex.svg',
      'icon: logo.gif'
    ));
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => /icon/.test(e.message))).toBe(true);
  });

  it('accepts an absolute http(s) icon URL regardless of extension', async () => {
    const result = await validate(full.replace(
      'icon: https://cdn.example.com/fedex.svg',
      'icon: https://example.com/x.png'
    ));
    expect(result.errors).toEqual([]);
  });

  it('accepts an empty icon', async () => {
    const result = await validate(full.replace(
      'icon: https://cdn.example.com/fedex.svg',
      'icon:'
    ));
    expect(result.errors).toEqual([]);
  });

  it('rejects an app.yaml missing id', async () => {
    const result = await validate(`
name: cx-app-no-id
version: 1.0.0
`);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => /id/.test(e.message))).toBe(true);
  });

  it('rejects an app.yaml missing name', async () => {
    const result = await validate(`
id: "4f29c257-e8e1-47ea-8cbd-2a112375de42"
version: 1.0.0
`);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => /name/.test(e.message))).toBe(true);
  });

  it('rejects an app.yaml missing version', async () => {
    const result = await validate(`
id: "4f29c257-e8e1-47ea-8cbd-2a112375de42"
name: cx-app-no-version
`);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => /version/.test(e.message))).toBe(true);
  });

  it('rejects a listing.features item without a title', async () => {
    const result = await validate(full.replace(
      '{ icon: currency-dollar, title: Rate Shopping, description: Live rates at quote time }',
      '{ icon: currency-dollar, description: Live rates at quote time }'
    ));
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => /title/.test(e.message))).toBe(true);
  });

  it('rejects a listing.brand.bg that is not a hex color', async () => {
    const result = await validate(full.replace('bg: "#4D148C"', 'bg: "purple"'));
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => /bg/.test(e.message))).toBe(true);
  });

  it('rejects a listing.brand.mark longer than 6 characters', async () => {
    const result = await validate(full.replace('mark: FedEx', 'mark: TooLong'));
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => /mark/.test(e.message))).toBe(true);
  });

  it.each(['ai.default', 'tms.browser.default'])(
    'accepts listing.configName outside the apps. prefix, e.g. %s',
    async (configName) => {
      const result = await validate(full.replace('configName: apps.fedex', `configName: ${configName}`));
      expect(result.errors).toEqual([]);
    }
  );

  it.each(['fedex', 'apps.', '.fedex', 'apps fedex'])(
    'rejects a listing.configName that is not a dotted config name, e.g. "%s"',
    async (configName) => {
      const result = await validate(full.replace('configName: apps.fedex', `configName: "${configName}"`));
      expect(result.errors.some(e => /configName/.test(e.path ?? e.message))).toBe(true);
    }
  );

  it('rejects an unknown listing property (strict inside listing)', async () => {
    const result = await validate(full.replace('vendor: CargoXplorer', 'vendor: CargoXplorer\n  bogus: nope'));
    expect(result.errors.length).toBeGreaterThan(0);
  });

  describe('real cx-app-*/app.yaml fixtures', () => {
    const fixturesDir = path.join(__dirname, 'fixtures', 'app-yaml');
    const fixtures = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.yaml'));

    it('found fixtures to validate', () => {
      expect(fixtures.length).toBeGreaterThan(0);
    });

    it.each(fixtures)('%s validates against the app.yaml schema', async fixture => {
      const result = await new AppValidator().validateApp(path.join(fixturesDir, fixture));
      expect(result.errors).toEqual([]);
    });
  });
});
