import YAML, {
  Node,
  YAMLMap,
  YAMLSeq,
  Scalar,
  isMap,
  isSeq,
  isNode,
  LineCounter
} from 'yaml';

export interface SourceLocation {
  line: number;
  column: number;
}

export interface YAMLLocationMap {
  lookup(path: string): SourceLocation | undefined;
}

export function normalizePath(path: string): string {
  // Accept JSON pointers (/foo/bar), dot-notation (foo.bar), and bracket notation (foo[0].bar)
  if (path.startsWith('/')) {
    path = path.slice(1);
  }
  // Normalize separators to dots
  path = path.replace(/\//g, '.');
  // Convert array bracket notation to dot-notation
  return path.replace(/\[(\d+)\]/g, '.$1');
}

function registerNode(
  map: Map<string, SourceLocation>,
  node: Node,
  lineCounter: LineCounter,
  path: string
): void {
  if (!isNode(node)) return;

  const range = node.range;
  if (range && range[0] !== undefined) {
    const pos = lineCounter.linePos(range[0]);
    if (pos) {
      map.set(path, { line: pos.line, column: pos.col });
    }
  }
}

function walkNode(
  map: Map<string, SourceLocation>,
  node: any,
  lineCounter: LineCounter,
  path: string
): void {
  if (!isNode(node)) return;

  registerNode(map, node, lineCounter, path);

  if (isMap(node)) {
    for (const item of (node as YAMLMap).items) {
      const key = String((item.key as Scalar)?.value ?? item.key);
      const childPath = path ? `${path}.${key}` : key;
      // Register the value node at the child path
      walkNode(map, item.value, lineCounter, childPath);
    }
  } else if (isSeq(node)) {
    const seq = node as YAMLSeq;
    for (let i = 0; i < seq.items.length; i++) {
      walkNode(map, seq.items[i], lineCounter, `${path}.${i}`);
    }
  }
}

export function buildLocationMap(yamlText: string): YAMLLocationMap {
  const lineCounter = new LineCounter();
  const doc = YAML.parseDocument(yamlText, { lineCounter });
  const map = new Map<string, SourceLocation>();

  if (doc.contents) {
    walkNode(map, doc.contents, lineCounter, '');
  }

  return {
    lookup(path: string): SourceLocation | undefined {
      return map.get(normalizePath(path));
    }
  };
}