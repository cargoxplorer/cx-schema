/**
 * Main module validator
 */

import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';
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

    // Initialize Ajv with Draft 7 support and custom loader
    this.ajv = new Ajv({
      strict: false,
      allErrors: true,
      verbose: true,
      validateFormats: true,
      allowUnionTypes: true,
      loadSchema: async (uri: string) => this.loadSchemaByUri(uri)
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
    // First, add all schemas to Ajv with their URIs
    for (const [key, entry] of this.schemas.entries()) {
      try {
        const schemaId = this.getSchemaId(key);
        // Add schema with URI to allow reference resolution
        const schemaWithId = { ...entry.schema, $id: entry.uri };
        this.ajv.addSchema(schemaWithId, schemaId);
      } catch (error) {
        // Silently skip schemas that fail to register (they may have unresolved refs)
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
   * Load schema by URI for AJV's loadSchema callback
   */
  private async loadSchemaByUri(uri: string): Promise<any> {
    // Handle different URI formats and relative references
    let schemaKey: string | null = null;

    // First, try direct match
    for (const [key, entry] of this.schemas.entries()) {
      if (entry.uri === uri || uri.endsWith(`/${key}`) || uri.includes(key)) {
        schemaKey = key;
        break;
      }
    }

    // Try to resolve as a relative path from a file URI
    if (!schemaKey && uri.includes('.json')) {
      // Extract the path components from the URI
      const uriPath = uri.replace('file:///', '').replace(/\\/g, '/');
      const parts = uriPath.split('/');
      const filename = parts[parts.length - 1];

      // Find by filename in the schema map
      for (const [key] of this.schemas.entries()) {
        if (key.endsWith(filename) || key.endsWith(`/${filename.split('.')[0]}.json`)) {
          schemaKey = key;
          break;
        }
      }

      // If still not found, try to resolve relative paths
      if (!schemaKey && filename === 'schemas.json') {
        schemaKey = 'schemas.json';
      }
    }

    if (schemaKey && this.schemas.has(schemaKey)) {
      return this.schemas.get(schemaKey)?.schema;
    }

    // Return a minimal schema if we can't find it (prevents breaking validation)
    console.error(`Schema not found for URI: ${uri}`);
    return { type: 'object' };
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
        moduleData = YAML.parse(content) as YAMLModule;
      } catch (yamlError: any) {
        errors.push({
          type: 'yaml_syntax_error',
          path: filePath,
          message: `YAML syntax error: ${yamlError.message}`
        });
        return this.createResult(filePath, errors, warnings);
      }

      // Validate module structure
      this.validateModuleStructure(moduleData, errors, warnings, filePath);

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

      // Validate configurations
      if (moduleData.configurations && Array.isArray(moduleData.configurations)) {
        this.validateConfigurations(moduleData.configurations, errors, warnings);
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
   * Validate top-level module structure
   */
  private validateModuleStructure(
    moduleData: YAMLModule,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    filePath?: string
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

    // filePath / fileName deprecation and validation
    if (module.fileName && !module.filePath) {
      warnings.push({
        type: 'deprecated_property',
        path: 'module.fileName',
        message: 'Use "filePath" instead of "fileName" in module section'
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
          message: `Declared filePath "${normalizedDeclared}" does not match actual file path "${normalizedActual}"`
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
   * Validate component props that may contain nested components or actions
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

    // Check for nested layouts or components in props, and actions arrays
    for (const [key, value] of Object.entries(props)) {
      if (value && typeof value === 'object') {
        // Check if it's a nested component
        if ((value as any).component) {
          this.validateNestedComponent(
            value,
            `${propsPath}.${key}`,
            errors,
            warnings
          );
        }
        // Check if it's an actions array (common action props)
        else if (Array.isArray(value) && this.isActionArrayProp(key)) {
          this.validateActionArray(
            value,
            `${propsPath}.${key}`,
            errors
          );
        }
      }
      // Check for action arrays at top level (no wrapper object)
      else if (Array.isArray(value) && this.isActionArrayProp(key)) {
        this.validateActionArray(value, `${propsPath}.${key}`, errors);
      }
    }
  }

  /**
   * Check if a property name suggests it contains actions
   */
  private isActionArrayProp(key: string): boolean {
    const actionPropNames = [
      'onClick', 'onSuccess', 'onError', 'onClose',
      'submitActions', 'submitErrorActions', 'onEdit',
      'onRowClick', 'actions'
    ];
    return actionPropNames.includes(key);
  }

  /**
   * Validate an array of actions
   */
  private validateActionArray(
    actions: any[],
    basePath: string,
    errors: ValidationError[]
  ): void {
    if (!Array.isArray(actions)) {
      return;
    }

    actions.forEach((action, index) => {
      if (!action || typeof action !== 'object') {
        return;
      }

      // Get the action type (sound, vibrate, navigate, etc.)
      const actionType = Object.keys(action)[0];
      if (!actionType) {
        return;
      }

      // Try to validate against the specific action schema
      const schemaKey = `actions/${actionType}.json`;
      if (this.schemas.has(schemaKey)) {
        try {
          const validate = this.ajv.getSchema(schemaKey);
          if (validate && !validate(action)) {
            this.addAjvErrors(validate.errors, `${basePath}[${index}]`, errors);
          }
        } catch (error: any) {
          // Silently skip if schema validation fails
          // This can happen if the schema has unresolved references
        }
      }
    });
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
   * Validate configurations array
   */
  private validateConfigurations(
    configurations: any[],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    configurations.forEach((config, index) => {
      const configPath = `configurations[${index}]`;
      if (!config.configName) {
        errors.push({
          type: 'missing_property',
          path: `${configPath}.configName`,
          message: 'Configuration must have a configName property'
        });
      }
      if (!config.component) {
        errors.push({
          type: 'missing_property',
          path: `${configPath}.component`,
          message: 'Configuration must have a component property'
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
