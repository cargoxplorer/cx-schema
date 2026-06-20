#!/usr/bin/env node

/**
 * Generates schemas/workflows/task-required-inputs.json — a catalog of the
 * REQUIRED author-provided input keys for each workflow task.
 *
 * Source of truth: the CXTMS backend task handlers (IWorkflowTaskHandler
 * implementations in TMS.Workflows). Each handler reads its inputs through
 * typed accessors on WorkflowTaskContext:
 *   - taskContext.GetObject<T>("key") / GetInt32("key") / GetString("key") ...
 *     => REQUIRED (throws "Variable X is missing in input" if absent)
 *   - the *N variants (GetObjectN, GetInt32N, ToObjectN, ...) and TryGetValue
 *     => optional
 *
 * System-injected variables (organizationId, workflowId, executionId,
 * workflowName, activityName) are populated by the runtime before the author's
 * inputs are merged, so they are excluded — they are never authored under
 * `inputs:` and flagging them would false-positive on almost every task.
 *
 * The catalog is a presence-check aid for WorkflowValidator; it intentionally
 * captures only key NAMES and required/optional — not types or nested shapes.
 * Deep (type-level) validation remains the backend's responsibility.
 *
 * Usage:
 *   node scripts/generate-task-required-inputs.js [--backend <path>] [--out <path>]
 *
 * Defaults:
 *   --backend  ../trt-express-backend  (sibling of this repo; override with CX_BACKEND_PATH)
 *   --out      schemas/workflows/task-required-inputs.json
 *
 * Re-run this whenever backend task handlers change (new tasks, changed inputs).
 */

const fs = require('fs');
const path = require('path');

// --------------------------------------------------------------------------- //
// Config
// --------------------------------------------------------------------------- //

function parseArgs(argv) {
  const args = { backend: process.env.CX_BACKEND_PATH || null, out: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--backend') args.backend = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '-h' || a === '--help') {
      console.log('Usage: generate-task-required-inputs.js [--backend <path>] [--out <path>]');
      process.exit(0);
    }
  }
  return args;
}

const repoRoot = path.resolve(__dirname, '..');
const args = parseArgs(process.argv);
const backendRoot = path.resolve(
  args.backend || path.join(repoRoot, '..', 'trt-express-backend')
);
const workflowsSrc = path.join(backendRoot, 'src', 'TMS.Workflows');
const outPath = path.resolve(repoRoot, args.out || 'schemas/workflows/task-required-inputs.json');

// Variables the runtime injects / resolves regardless of author inputs, so
// reading them does NOT imply the author must provide them under `inputs:`.
//
// Two sources (both in the backend):
//  - Execution-layer scope vars: organizationId, workflowId, executionId,
//    workflowName, activityName (set in Workflows/Execution/*.cs).
//  - Current-user / session context vars declared as system constants in
//    TMS.Domain/Entities/Workflow.cs: currentUserId, currentEmployeeId,
//    currentContactId, currentContactType, ipAddress.
//
// NOTE: Workflow.cs ALSO declares constants named order, orderId, entity,
// entityId, entityName, entityType, trackedEntity, triggerType, eventType,
// changes, position — these are intentionally NOT excluded. They are output /
// context vars that collide with legitimate author-provided task INPUT names
// (e.g. Order/Create's required input is `order`). Excluding them would hide
// real missing-input findings.
const SYSTEM_INJECTED_VARS = new Set([
  // execution-layer scope
  'organizationId',
  'workflowId',
  'executionId',
  'workflowName',
  'activityName',
  // current-user / session context (Workflow.cs system constants)
  'currentUserId',
  'currentEmployeeId',
  'currentContactId',
  'currentContactType',
  'ipAddress'
]);

// taskContext.<Accessor>[<Type>]("key")  — captures accessor + key (type ignored).
// Accessors: ToObject*, GetObject*, Get<Type>. The nullable variants end in "N".
const INPUT_ACCESS_RE =
  /taskContext\.(ToObject\w*|GetObject\w*|Get[A-Za-z0-9_]+)\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"\s*\)/g;

const TASK_NAME_RE = /TaskName\s*=>\s*"([^"]+)"/;
const VERSION_RE = /Version\s*=>\s*(\d+)/;

// --------------------------------------------------------------------------- //
// Scrape
// --------------------------------------------------------------------------- //

function isRequired(accessor) {
  // Nullable variants (ToObjectN, GetInt32N, GetObjectN, ...EnhancedN) end in "N".
  return !/N$/.test(accessor);
}

function listHandlerFiles(root) {
  const out = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && /\.cs$/i.test(e.name)) out.push(full);
    }
  }
  walk(root);
  return out;
}

function scrapeHandler(src) {
  const tn = src.match(TASK_NAME_RE);
  if (!tn) return null;
  const taskName = tn[1];
  const version = (src.match(VERSION_RE) || [])[1];

  const required = new Set();
  let m;
  INPUT_ACCESS_RE.lastIndex = 0;
  while ((m = INPUT_ACCESS_RE.exec(src))) {
    const accessor = m[1];
    let key = m[2];
    // Optional keys are sometimes read with a trailing "?" (null-safe marker).
    key = key.replace(/\?+$/, '');
    if (!isRequired(accessor)) continue; // optional variant / TryGetValue-like
    if (SYSTEM_INJECTED_VARS.has(key)) continue;
    required.add(key);
  }
  return { taskName, version, required: [...required].sort() };
}

// --------------------------------------------------------------------------- //
// Main
// --------------------------------------------------------------------------- //

function main() {
  if (!fs.existsSync(workflowsSrc)) {
    console.error(
      `Backend workflows source not found: ${workflowsSrc}\n` +
        'Pass --backend <path> or set CX_BACKEND_PATH.'
    );
    process.exit(1);
  }

  const files = listHandlerFiles(workflowsSrc);
  const byBaseName = new Map(); // baseName -> Set(required keys) (merged across versions)
  let handlerCount = 0;

  for (const file of files) {
    const src = fs.readFileSync(file, 'utf-8');
    const hit = scrapeHandler(src);
    if (!hit) continue;
    handlerCount++;
    if (hit.required.length === 0) continue; // nothing author-provided to require

    // Key by base task name (strip @version). Merge required keys across versions.
    const base = hit.taskName;
    if (!byBaseName.has(base)) byBaseName.set(base, new Set());
    for (const k of hit.required) byBaseName.get(base).add(k);
  }

  // Build sorted JSON object keyed by canonical task name.
  const catalog = {};
  const names = [...byBaseName.keys()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
  for (const name of names) {
    catalog[name] = [...byBaseName.get(name)].sort();
  }

  const totalKeys = Object.values(catalog).reduce((n, ks) => n + ks.length, 0);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2) + '\n', 'utf-8');

  console.log(`Scraped ${handlerCount} handlers from ${workflowsSrc}`);
  console.log(`Catalog: ${names.length} tasks, ${totalKeys} required input keys`);
  console.log(`Written: ${path.relative(repoRoot, outPath)}`);
}

main();
