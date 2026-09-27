/**
 * Semantic rules for entity quickSearch blocks. Mirrors the backend's
 * QuickSearchConfigValidator (tms-backend-api), except `filter`, which only
 * the backend can check.
 */

export interface QuickSearchKind {
  key: string;
  matchFields: string[];
  select: string[];
}

export type QuickSearchKinds = Record<string, QuickSearchKind>;

const CUSTOM_VALUES_PREFIX = 'customValues.';
// {{ path }} or {{helper path }}
const TEMPLATE_PATH = /\{\{\s*(?:[A-Za-z]+\s+)?([A-Za-z_][\w.]*)\s*\}\}/g;

export function validateQuickSearch(
  entityName: string,
  entityKind: string | undefined | null,
  config: any,
  kinds: QuickSearchKinds
): string[] {
  if (!config || config.enabled !== true) return [];

  const prefix = `Entity '${entityName}' quickSearch:`;
  const kind = entityKind ? kinds[entityKind] : undefined;
  if (!kind) {
    return [`${prefix} entityKind must be one of ${Object.keys(kinds).join(', ')}.`];
  }

  const errors: string[] = [];
  const match: string[] = Array.isArray(config.matchFields) ? config.matchFields : [];
  const select: string[] = Array.isArray(config.select) ? config.select : [];

  if (match.length === 0) errors.push(`${prefix} matchFields must list at least one field.`);
  for (const f of match) {
    if (!kind.matchFields.includes(f)) {
      errors.push(`${prefix} matchFields '${f}' is not searchable for ${entityKind}. Allowed: ${kind.matchFields.join(', ')}.`);
    }
  }

  if (select.length === 0) errors.push(`${prefix} select must list at least one path.`);
  for (const p of select) {
    if (!isSelectable(kind, p)) errors.push(`${prefix} select '${p}' is not available for ${entityKind}.`);
  }

  if (!config.display?.title || !String(config.display.title).trim()) errors.push(`${prefix} display.title is required.`);
  if (!config.icon || !String(config.icon).trim()) errors.push(`${prefix} icon is required.`);

  const open = config.open && typeof config.open === 'object' ? config.open : {};
  const actions = ['navigate', 'dialog'].filter(a => a in open).length;
  if (actions !== 1) errors.push(`${prefix} open must define exactly one of navigate or dialog.`);

  const allowed = new Set<string>([...select, kind.key]);
  const templates = [config.display?.title, config.display?.subtitle, config.display?.badge, open.navigate]
    .filter((t): t is string => typeof t === 'string');
  const missing = new Set<string>();
  for (const t of templates) {
    for (const m of t.matchAll(TEMPLATE_PATH)) {
      if (!allowed.has(m[1])) missing.add(m[1]);
    }
  }
  for (const p of missing) errors.push(`${prefix} template path '${p}' must be listed in select.`);

  return errors;
}

function isSelectable(kind: QuickSearchKind, path: string): boolean {
  if (path === `${CUSTOM_VALUES_PREFIX}*`) return false;
  if (kind.select.includes(path)) return true;
  return path.startsWith(CUSTOM_VALUES_PREFIX)
    && path.length > CUSTOM_VALUES_PREFIX.length
    && kind.select.includes(`${CUSTOM_VALUES_PREFIX}*`);
}
