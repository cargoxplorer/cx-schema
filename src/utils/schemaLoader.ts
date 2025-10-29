/**
 * Schema loading and caching utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import { SchemaEntry } from '../types';

/**
 * Recursively loads all JSON schema files from a directory
 */
export function loadSchemas(schemasDir: string): Map<string, SchemaEntry> {
  const schemas = new Map<string, SchemaEntry>();

  // Load main schemas.json
  const mainSchemaPath = path.join(schemasDir, 'schemas.json');
  if (fs.existsSync(mainSchemaPath)) {
    const schema = JSON.parse(fs.readFileSync(mainSchemaPath, 'utf-8'));
    schemas.set('schemas.json', {
      schema,
      uri: `file:///${mainSchemaPath.replace(/\\/g, '/')}`
    });
  }

  // Load schemas from subdirectories
  const subdirs = ['components', 'fields', 'actions'];

  for (const subdir of subdirs) {
    const subdirPath = path.join(schemasDir, subdir);
    if (fs.existsSync(subdirPath)) {
      loadSchemasFromDir(subdirPath, subdir, schemas);
    }
  }

  return schemas;
}

/**
 * Recursively loads schemas from a directory
 */
function loadSchemasFromDir(
  dir: string,
  relativePath: string,
  schemas: Map<string, SchemaEntry>
): void {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      loadSchemasFromDir(filePath, `${relativePath}/${file}`, schemas);
    } else if (file.endsWith('.json')) {
      try {
        const schema = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const key = `${relativePath}/${file}`;
        schemas.set(key, {
          schema,
          uri: `file:///${filePath.replace(/\\/g, '/')}`
        });
      } catch (error) {
        console.error(`Error loading schema ${filePath}:`, error);
      }
    }
  }
}

/**
 * Resolves a relative reference to an absolute path
 */
export function resolveSchemaRef(ref: string, currentPath: string): string {
  if (ref.startsWith('file://')) {
    return ref;
  }

  // Handle relative paths
  if (ref.startsWith('../') || ref.startsWith('./')) {
    const currentDir = path.dirname(currentPath);
    const resolved = path.normalize(path.join(currentDir, ref));
    return resolved;
  }

  // Direct file reference
  return ref;
}

/**
 * Extracts examples from schema for error reporting
 */
export function extractExampleFromSchema(schema: any): any {
  if (!schema) return undefined;

  // Check for x-example
  if (schema['x-example'] !== undefined) {
    return schema['x-example'];
  }

  // Check for x-examples
  if (schema['x-examples'] !== undefined) {
    return schema['x-examples'];
  }

  // Check for examples array
  if (Array.isArray(schema.examples) && schema.examples.length > 0) {
    return schema.examples[0];
  }

  // Check for enum values
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum;
  }

  return undefined;
}
