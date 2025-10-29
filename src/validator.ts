/**
 * Main module validator
 */

import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
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
  private schemas: Map<string, SchemaEntry>;
  private schemasDir: string;
  private options: Required<ValidatorOptions>;

  constructor(options: ValidatorOptions = {}) {
    this.schemasDir = options.schemasPath || path.join(__dirname, '../schemas');
    this.options = {
      schemasPath: this.schemasDir,
      strictMode: options.strictMode ?? true,
      includeWarnings: options.includeWarnings ?? true
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

      try {
        moduleData = yaml.load(content) as YAMLModule;
      } catch (yamlError: any) {
        errors.push({
          type: 'yaml_syntax_error',
          path: filePath,
          message: `YAML syntax error: ${yamlError.message}`
        });
        return this.createResult(filePath, errors, warnings);
      }

      // Validate module structure
      this.validateModuleStructure(moduleData, errors, warnings);

      // Validate components
      if (moduleData.components && Array.isArray(moduleData.components)) {
        this.validateComponents(moduleData.components, errors, warnings);
      }

      // Validate routes
      if (moduleData.routes && Array.isArray(moduleData.routes)) {
        this.validateRoutes(moduleData.routes, errors, warnings);
      }

      // Validate entities
      if (moduleData.entities && Array.isArray(moduleData.entities)) {
        this.validateEntities(moduleData.entities, errors, warnings);
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
   * Validate top-level module structure
   */
  private validateModuleStructure(
    moduleData: YAMLModule,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check required top-level properties
    if (!moduleData.module) {
      errors.push({
        type: 'missing_property',
        path: 'module',
        message: 'Missing required property: module'
      });
      return;
    }

    if (!moduleData.components) {
      errors.push({
        type: 'missing_property',
        path: 'components',
        message: 'Missing required property: components'
      });
    }

    // Validate module metadata
    const module = moduleData.module;
    if (!module.name) {
      errors.push({
        type: 'missing_property',
        path: 'module.name',
        message: 'Missing required property: module.name'
      });
    }

    if (!module.appModuleId) {
      errors.push({
        type: 'missing_property',
        path: 'module.appModuleId',
        message: 'Missing required property: module.appModuleId'
      });
    }

    if (!module.displayName) {
      errors.push({
        type: 'missing_property',
        path: 'module.displayName',
        message: 'Missing required property: module.displayName'
      });
    }
  }

  /**
   * Validate components array
   */
  private validateComponents(
    components: any[],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    components.forEach((component, index) => {
      const componentPath = `components[${index}]`;
      this.validateComponent(component, componentPath, errors, warnings);
    });
  }

  /**
   * Validate a single component
   */
  private validateComponent(
    component: any,
    componentPath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!component || typeof component !== 'object') {
      errors.push({
        type: 'invalid_component',
        path: componentPath,
        message: 'Component must be an object'
      });
      return;
    }

    // Check for required properties
    if (!component.name) {
      errors.push({
        type: 'missing_property',
        path: `${componentPath}.name`,
        message: 'Component must have a name property'
      });
    }

    // Validate layout if present
    if (component.layout) {
      this.validateNestedComponent(
        component.layout,
        `${componentPath}.layout`,
        errors,
        warnings
      );
    }

    // Check for deprecated properties
    this.checkDeprecatedProperties(component, componentPath, warnings);
  }

  /**
   * Recursively validate nested components
   */
  private validateNestedComponent(
    component: any,
    componentPath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!component || typeof component !== 'object') {
      return;
    }

    const componentType = component.component;
    if (!componentType) {
      errors.push({
        type: 'missing_property',
        path: `${componentPath}.component`,
        message: 'Component must have a component type'
      });
      return;
    }

    // Try to validate against specific component schema
    const schemaKey = `components/${componentType}.json`;
    if (this.schemas.has(schemaKey)) {
      try {
        const validate = this.ajv.getSchema(schemaKey);
        if (validate && !validate(component)) {
          this.addAjvErrors(validate.errors, componentPath, errors);
        }
      } catch (error: any) {
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
          warnings
        );
      });
    }

    // Recursively validate props that may contain components
    if (component.props) {
      this.validateComponentProps(
        component.props,
        `${componentPath}.props`,
        errors,
        warnings
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
    warnings: ValidationWarning[]
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
          warnings
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
    errors: ValidationError[]
  ): void {
    if (!ajvErrors) return;

    for (const error of ajvErrors) {
      const errorPath = `${basePath}${error.instancePath}`;
      errors.push({
        type: 'schema_violation',
        path: errorPath,
        message: error.message || 'Schema validation failed',
        schemaPath: error.schemaPath
      });
    }
  }

  /**
   * Validate routes array
   */
  private validateRoutes(
    routes: any[],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    routes.forEach((route, index) => {
      const routePath = `routes[${index}]`;
      if (!route.path) {
        errors.push({
          type: 'missing_property',
          path: `${routePath}.path`,
          message: 'Route must have a path property'
        });
      }
      if (!route.component) {
        errors.push({
          type: 'missing_property',
          path: `${routePath}.component`,
          message: 'Route must have a component property'
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
    warnings: ValidationWarning[]
  ): void {
    entities.forEach((entity, index) => {
      const entityPath = `entities[${index}]`;
      if (!entity.name) {
        errors.push({
          type: 'missing_property',
          path: `${entityPath}.name`,
          message: 'Entity must have a name property'
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
    warnings: ValidationWarning[]
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
          message
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
