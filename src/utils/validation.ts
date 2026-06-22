import { ErrorObject } from 'ajv';
import { ValidationError, ValidationWarning } from '../types';
import { normalizePath, resolveLocation, YAMLLocationMap } from '../yamlLocationResolver';

/**
 * Convert Ajv errors to our error format.
 */
export function addAjvErrors(
  ajvErrors: ErrorObject[] | null | undefined,
  basePath: string,
  errors: ValidationError[],
  enrich = false,
  locationMap?: YAMLLocationMap
): void {
  if (!ajvErrors) return;

  for (const error of ajvErrors) {
    const errorPath = normalizePath(`${basePath}${error.instancePath}`);
    errors.push({
      type: 'schema_violation',
      path: errorPath,
      message: enrich ? schemaMessage(error) : (error.message || 'Schema validation failed'),
      schemaPath: error.schemaPath,
      location: resolveLocation(locationMap, errorPath)
    });
  }
}

/**
 * Convert Ajv errors to warning entries (no schemaPath).
 * addAjvWarnings is only called from the enforced (warn) path.
 */
export function addAjvWarnings(
  ajvErrors: ErrorObject[] | null | undefined,
  basePath: string,
  warnings: ValidationWarning[],
  locationMap?: YAMLLocationMap
): void {
  if (!ajvErrors) return;

  for (const error of ajvErrors) {
    const warningPath = normalizePath(`${basePath}${error.instancePath}`);
    warnings.push({
      type: 'schema_violation',
      path: warningPath,
      message: schemaMessage(error),
      location: resolveLocation(locationMap, warningPath)
    });
  }
}

/**
 * Build a human-readable schema message, enriched with the offending property
 * name (additionalProperties) or allowed values (enum) when Ajv carries them
 * in error.params. Without this, "must NOT have additional properties" gives
 * no clue which property, and enum errors omit the allowed values.
 */
export function schemaMessage(error: ErrorObject): string {
  const base = error.message || 'Schema validation failed';
  const p = error.params as any;
  if (p && p.additionalProperty) {
    return `${base} (property: ${p.additionalProperty})`;
  }
  if (p && Array.isArray(p.allowedValues)) {
    return `${base} (allowed: ${p.allowedValues.join(', ')})`;
  }
  return base;
}
