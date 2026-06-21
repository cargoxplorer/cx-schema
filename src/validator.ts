/**
 * Main module validator
 */

import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';
import { buildLocationMap, normalizePath, YAMLLocationMap } from './yamlLocationResolver';
import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidatorOptions,
  YAMLModule,
  SchemaEntry
} from './types';
import {
  loadSchemas,
  resolveSchemaRef,
  extractExampleFromSchema
} from './utils/schemaLoader';

export class ModuleValidator {
  private ajv: Ajv;
  private ajvEnforced: Ajv;
  private schemas: Map<string, SchemaEntry>;
  private schemasDir: string;
  private options: Required<ValidatorOptions>;

  constructor(options: ValidatorOptions = {}) {
    this.schemasDir = options.schemasPath || path.join(__dirname, '../schemas');
    this.options = {
      schemasPath: this.schemasDir,
      strictMode: options.strictMode ?? true,
      includeWarnings: options.includeWarnings ?? true,
      schemaEnforcement: options.schemaEnforcement ?? false
    };

    // Initialize Ajv with Draft 7 support
    this.ajv = new Ajv({
      strict: false,
      allErrors: true,
      verbose: true,
      validateFormats: true,
      allowUnionTypes: true
    });

    // Add format validators
    addFormats(this.ajv);

    // Load all schemas
    this.schemas = loadSchemas(this.schemasDir);

    // Register schemas with Ajv
    this.registerSchemas();

    // Enforced instance: schemas registered under their file:// URI so that
    // relative $ref (e.g. "../schemas.json#/definitions/localized") resolve.
    // Used only when schemaEnforcement is 'warn' or 'error'.
    this.ajvEnforced = new Ajv({
      strict: false,
      allErrors: true,
      verbose: true,
      validateFormats: true,
      allowUnionTypes: true
    });
    addFormats(this.ajvEnforced);
    this.registerSchemasEnforced();
  }

  /**
   * Register all loaded schemas with Ajv
   */
  private registerSchemas(): void {
    // First, add all schemas to Ajv
    for (const [key, entry] of this.schemas.entries()) {
      try {
        const schemaId = this.getSchemaId(key);
        this.ajv.addSchema(entry.schema, schemaId);
      } catch (error) {
        console.error(`Error adding schema ${key}:`, error);
      }
    }
  }

  /**
   * Register schemas under their file:// URI so cross-file $ref resolve.
   * Used by the enforced instance for schemaEnforcement 'warn'/'error'.
   */
  private registerSchemasEnforced(): void {
    for (const [key, entry] of this.schemas.entries()) {
      try {
        const schemaWithId = { ...entry.schema, $id: entry.uri };
        this.ajvEnforced.addSchema(schemaWithId, entry.uri);
      } catch (error) {
        console.error(`Error registering enforced schema ${key}:`, error);
      }
    }
  }

  /**
   * Convert schema file path to schema ID for Ajv
   */
  private getSchemaId(key: string): string {
    if (key === 'schemas.json') {
      return 'schemas.json';
    }
    return key;
  }

  /**
   * Validate a YAML module file
   */
  async validateModule(filePath: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        errors.push({
          type: 'file_not_found',
          path: filePath,
          message: `File not found: ${filePath}`
        });
        return this.createResult(filePath, errors, warnings);
      }

      // Read and parse YAML
      const content = fs.readFileSync(filePath, 'utf-8');
      let moduleData: YAMLModule;
      let locationMap: YAMLLocationMap | undefined;

      const doc = YAML.parseDocument(content);
      if (doc.errors.length > 0) {
        const firstError = doc.errors[0];
        const linePos = firstError.linePos?.[0];
        errors.push({
          type: 'yaml_syntax_error',
          path: filePath,
          message: `YAML syntax error: ${firstError.message}`,
          location: linePos ? { line: linePos.line, column: linePos.col } : undefined
        });
        return this.createResult(filePath, errors, warnings);
      }
      moduleData = doc.toJS() as YAMLModule;
      locationMap = buildLocationMap(content);

      // Validate module structure
      this.validateModuleStructure(moduleData, errors, warnings, filePath, locationMap);

      // Validate components
      if (moduleData.components && Array.isArray(moduleData.components)) {
        this.validateComponents(moduleData.components, errors, warnings, locationMap);
      }

      // Validate routes
      if (moduleData.routes && Array.isArray(moduleData.routes)) {
        this.validateRoutes(moduleData.routes, errors, warnings, locationMap);
      }

      // Validate entities
      if (moduleData.entities && Array.isArray(moduleData.entities)) {
        this.validateEntities(moduleData.entities, errors, warnings, locationMap);
      }

      // Validate configurations
      if (moduleData.configurations && Array.isArray(moduleData.configurations)) {
        this.validateConfigurations(moduleData.configurations, errors, warnings, locationMap);
      }

      return this.createResult(filePath, errors, warnings);
    } catch (error: any) {
      errors.push({
        type: 'unexpected_error',
        path: filePath,
        message: `Unexpected error: ${error.message}`
      });
      return this.createResult(filePath, errors, warnings);
    }
  }

  /**
   * Normalize file path: forward slashes, strip leading ./
   */
  private normalizeFilePath(p: string): string {
    return p.replace(/\\/g, '/').replace(/^\.\//, '');
  }

  /**
   * Resolve a source location for an error/warning path.
   * Returns undefined if no map is available or the path is not registered.
   */
  private resolveLocation(
    locationMap: YAMLLocationMap | undefined,
    path: string
  ): { line: number; column: number } | undefined {
    if (!locationMap) return undefined;
    try {
      return locationMap.lookup(path);
    } catch {
      return undefined;
    }
  }

  /**
   * Validate top-level module structure
   */
  private validateModuleStructure(
    moduleData: YAMLModule,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    filePath?: string,
    locationMap?: YAMLLocationMap
  ): void {
    // Check required top-level properties
    if (!moduleData.module) {
      errors.push({
        type: 'missing_property',
        path: 'module',
        message: 'Missing required property: module',
        location: this.resolveLocation(locationMap, 'module')
      });
      return;
    }

    if (!moduleData.components) {
      errors.push({
        type: 'missing_property',
        path: 'components',
        message: 'Missing required property: components',
        location: this.resolveLocation(locationMap, 'components')
      });
    }

    // Validate module metadata
    const module = moduleData.module;
    if (!module.name) {
      errors.push({
        type: 'missing_property',
        path: 'module.name',
        message: 'Missing required property: module.name',
        location: this.resolveLocation(locationMap, 'module.name')
      });
    }

    if (!module.appModuleId) {
      errors.push({
        type: 'missing_property',
        path: 'module.appModuleId',
        message: 'Missing required property: module.appModuleId',
        location: this.resolveLocation(locationMap, 'module.appModuleId')
      });
    }

    if (!module.displayName) {
      errors.push({
        type: 'missing_property',
        path: 'module.displayName',
        message: 'Missing required property: module.displayName',
        location: this.resolveLocation(locationMap, 'module.displayName')
      });
    }

    // filePath / fileName deprecation and validation
    if (module.fileName && !module.filePath) {
      warnings.push({
        type: 'deprecated_property',
        path: 'module.fileName',
        message: 'Use "filePath" instead of "fileName" in module section',
        location: this.resolveLocation(locationMap, 'module.fileName')
      });
    }

    const declaredPath = module.filePath ?? module.fileName;
    if (declaredPath && filePath) {
      const normalizedActual = this.normalizeFilePath(filePath);
      const normalizedDeclared = this.normalizeFilePath(declaredPath);
      if (!normalizedActual.endsWith(normalizedDeclared)) {
        warnings.push({
          type: 'file_path_mismatch',
          path: 'module.filePath',
          message: `Declared filePath "${normalizedDeclared}" does not match actual file path "${normalizedActual}"`,
          location: this.resolveLocation(locationMap, 'module.filePath')
        });
      }
    }
  }

  /**
   * Validate components array
   */
  private validateComponents(
    components: any[],
    errors: ValidationError[],
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap
  ): void {
    components.forEach((component, index) => {
      const componentPath = `components[${index}]`;
      this.validateComponent(component, componentPath, errors, warnings, locationMap);
    });
  }

  /**
   * Validate a single component
   */
  private validateComponent(
    component: any,
    componentPath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap
  ): void {
    if (!component || typeof component !== 'object') {
      errors.push({
        type: 'invalid_component',
        path: componentPath,
        message: 'Component must be an object',
        location: this.resolveLocation(locationMap, componentPath)
      });
      return;
    }

    // Check for required properties
    if (!component.name) {
      errors.push({
        type: 'missing_property',
        path: `${componentPath}.name`,
        message: 'Component must have a name property',
        location: this.resolveLocation(locationMap, `${componentPath}.name`)
      });
    }

    // Validate layout if present
    if (component.layout) {
      this.validateNestedComponent(
        component.layout,
        `${componentPath}.layout`,
        errors,
        warnings,
        locationMap
      );
    }

    // Check for deprecated properties
    this.checkDeprecatedProperties(component, componentPath, warnings, locationMap);
  }

  /**
   * Recursively validate nested components
   */
  private validateNestedComponent(
    component: any,
    componentPath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap
  ): void {
    if (!component || typeof component !== 'object') {
      return;
    }

    const componentType = component.component;
    if (!componentType) {
      errors.push({
        type: 'missing_property',
        path: `${componentPath}.component`,
        message: 'Component must have a component type',
        location: this.resolveLocation(locationMap, `${componentPath}.component`)
      });
      return;
    }

    // Validate against the specific component schema.
    const schemaKey = `components/${componentType}.json`;
    const entry = this.schemas.get(schemaKey);
    const enforce = this.options.schemaEnforcement;

    if (enforce === 'warn' || enforce === 'error') {
      // Enforced path: URI-keyed instance resolves cross-file $ref.
      if (entry) {
        try {
          const validate = this.ajvEnforced.getSchema(entry.uri);
          if (validate && !validate(component)) {
            if (enforce === 'error') {
              this.addAjvErrors(validate.errors, componentPath, errors, true, locationMap);
            } else {
              this.addAjvWarnings(validate.errors, componentPath, warnings, locationMap);
            }
          }
        } catch (error: any) {
          // Surface compile failures instead of swallowing them.
          const msg = `Schema enforcement skipped for ${schemaKey}: ${error.message}`;
          if (enforce === 'error') {
            errors.push({
              type: 'schema_compile_error',
              path: componentPath,
              message: msg,
              location: this.resolveLocation(locationMap, componentPath)
            });
          } else {
            warnings.push({
              type: 'schema_compile_error',
              path: componentPath,
              message: msg,
              location: this.resolveLocation(locationMap, componentPath)
            });
          }
        }
      }
    } else if (entry) {
      // Off path: pre-existing Ajv validation still runs against the legacy Ajv
      // instance; only the optional location field is added.
      try {
        const validate = this.ajv.getSchema(schemaKey);
        if (validate && !validate(component)) {
          this.addAjvErrors(validate.errors, componentPath, errors, false, locationMap);
        }
      } catch (error) {
        // Schema not found or validation error
      }
    }

    // Recursively validate children
    if (component.children && Array.isArray(component.children)) {
      component.children.forEach((child: any, index: number) => {
        this.validateNestedComponent(
          child,
          `${componentPath}.children[${index}]`,
          errors,
          warnings,
          locationMap
        );
      });
    }

    // Recursively validate props that may contain components
    if (component.props) {
      this.validateComponentProps(
        component.props,
        `${componentPath}.props`,
        errors,
        warnings,
        locationMap
      );
    }
  }

  /**
   * Validate component props that may contain nested components
   */
  private validateComponentProps(
    props: any,
    propsPath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap
  ): void {
    if (!props || typeof props !== 'object') {
      return;
    }

    // Check for nested layouts or components in props
    for (const [key, value] of Object.entries(props)) {
      if (value && typeof value === 'object' && (value as any).component) {
        this.validateNestedComponent(
          value,
          `${propsPath}.${key}`,
          errors,
          warnings,
          locationMap
        );
      }
    }
  }

  /**
   * Convert Ajv errors to our error format
   */
  private addAjvErrors(
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
        message: enrich ? this.schemaMessage(error) : (error.message || 'Schema validation failed'),
        schemaPath: error.schemaPath,
        location: this.resolveLocation(locationMap, errorPath)
      });
    }
  }

  /**
   * Convert Ajv errors to warning entries (no schemaPath). Always enriched —
   * addAjvWarnings is only called from the enforced (warn) path.
   */
  private addAjvWarnings(
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
        message: this.schemaMessage(error),
        location: this.resolveLocation(locationMap, warningPath)
      });
    }
  }

  /**
   * Build a human-readable schema message, enriched with the offending property
   * name (additionalProperties) or allowed values (enum) when Ajv carries them
   * in error.params. Without this, "must NOT have additional properties" gives
   * no clue which property, and enum errors omit the allowed values.
   */
  private schemaMessage(error: ErrorObject): string {
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

  /**
   * Validate routes array
   */
  private validateRoutes(
    routes: any[],
    errors: ValidationError[],
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap
  ): void {
    routes.forEach((route, index) => {
      const routePath = `routes[${index}]`;
      if (!route.path) {
        errors.push({
          type: 'missing_property',
          path: `${routePath}.path`,
          message: 'Route must have a path property',
          location: this.resolveLocation(locationMap, `${routePath}.path`)
        });
      }
      if (!route.component) {
        errors.push({
          type: 'missing_property',
          path: `${routePath}.component`,
          message: 'Route must have a component property',
          location: this.resolveLocation(locationMap, `${routePath}.component`)
        });
      }
    });
  }

  /**
   * Validate entities array
   */
  private validateEntities(
    entities: any[],
    errors: ValidationError[],
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap
  ): void {
    entities.forEach((entity, index) => {
      const entityPath = `entities[${index}]`;
      if (!entity.name) {
        errors.push({
          type: 'missing_property',
          path: `${entityPath}.name`,
          message: 'Entity must have a name property',
          location: this.resolveLocation(locationMap, `${entityPath}.name`)
        });
      }
    });
  }

  /**
   * Validate configurations array
   */
  private validateConfigurations(
    configurations: any[],
    errors: ValidationError[],
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap
  ): void {
    configurations.forEach((config, index) => {
      const configPath = `configurations[${index}]`;
      if (!config.configName) {
        errors.push({
          type: 'missing_property',
          path: `${configPath}.configName`,
          message: 'Configuration must have a configName property',
          location: this.resolveLocation(locationMap, `${configPath}.configName`)
        });
      }
      if (!config.component) {
        errors.push({
          type: 'missing_property',
          path: `${configPath}.component`,
          message: 'Configuration must have a component property',
          location: this.resolveLocation(locationMap, `${configPath}.component`)
        });
      }
    });
  }

  /**
   * Check for deprecated properties
   */
  private checkDeprecatedProperties(
    obj: any,
    path: string,
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap
  ): void {
    const deprecations: Record<string, string> = {
      key: 'Use "name" instead of "key"',
      type: 'Use "fieldType" instead of "type" for fields'
    };

    for (const [oldProp, message] of Object.entries(deprecations)) {
      if (oldProp in obj) {
        warnings.push({
          type: 'deprecated_property',
          path: `${path}.${oldProp}`,
          message,
          location: this.resolveLocation(locationMap, `${path}.${oldProp}`)
        });
      }
    }
  }

  /**
   * Create validation result
   */
  private createResult(
    filePath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): ValidationResult {
    const errorsByType: Record<string, number> = {};
    errors.forEach(error => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings: this.options.includeWarnings ? warnings : [],
      summary: {
        file: filePath,
        timestamp: new Date().toISOString(),
        status: errors.length === 0 ? 'PASSED' : 'FAILED',
        errorCount: errors.length,
        warningCount: warnings.length,
        errorsByType
      }
    };
  }
}
