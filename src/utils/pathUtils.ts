/**
 * Normalize a file path for comparison: forward slashes, strip leading ./
 */
export function normalizeFilePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '');
}
