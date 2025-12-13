/**
 * Workflow validator for CargoXplorer YAML workflow files
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
  WorkflowValidatorOptions,
  YAMLWorkflow,
  SchemaEntry
} from './types';

export class WorkflowValidator {
  private ajv: Ajv;
  private schemas: Map<string, SchemaEntry>;
  private schemasDir: string;
  private options: Required<WorkflowValidatorOptions>;

  constructor(options: WorkflowValidatorOptions = {}) {
    this.schemasDir = options.schemasPath || path.join(__dirname, '../schemas/workflows');
    this.options = {
      schemasPath: this.schemasDir,
      strictMode: options.strictMode ?? true,
      includeWarnings: options.includeWarnings ?? true,
      validateTasks: options.validateTasks ?? true,
      validateExpressions: options.validateExpressions ?? false
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

    // Load all workflow schemas
    this.schemas = this.loadWorkflowSchemas(this.schemasDir);

    // Register schemas with Ajv
    this.registerSchemas();
  }

  /**
   * Load all workflow schemas from the schemas/workflows directory
   */
  private loadWorkflowSchemas(schemasDir: string): Map<string, SchemaEntry> {
    const schemas = new Map<string, SchemaEntry>();

    // Load main workflow.json
    const mainSchemaPath = path.join(schemasDir, 'workflow.json');
    if (fs.existsSync(mainSchemaPath)) {
      const schema = JSON.parse(fs.readFileSync(mainSchemaPath, 'utf-8'));
      schemas.set('workflow.json', {
        schema,
        uri: `file:///${mainSchemaPath.replace(/\\/g, '/')}`
      });
    }

    // Load workflow sub-schemas
    const subSchemas = ['input.json', 'output.json', 'variable.json', 'trigger.json', 'schedule.json', 'activity.json'];
    for (const schemaFile of subSchemas) {
      const schemaPath = path.join(schemasDir, schemaFile);
      if (fs.existsSync(schemaPath)) {
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
        schemas.set(schemaFile, {
          schema,
          uri: `file:///${schemaPath.replace(/\\/g, '/')}`
        });
      }
    }

    // Load task schemas from tasks/ subdirectory
    const tasksDir = path.join(schemasDir, 'tasks');
    if (fs.existsSync(tasksDir)) {
      this.loadSchemasFromDir(tasksDir, 'tasks', schemas);
    }

    // Load common schemas from common/ subdirectory
    const commonDir = path.join(schemasDir, 'common');
    if (fs.existsSync(commonDir)) {
      this.loadSchemasFromDir(commonDir, 'common', schemas);
    }

    return schemas;
  }

  /**
   * Recursively load schemas from a directory
   */
  private loadSchemasFromDir(
    dir: string,
    relativePath: string,
    schemas: Map<string, SchemaEntry>
  ): void {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        this.loadSchemasFromDir(filePath, `${relativePath}/${file}`, schemas);
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
   * Register all loaded schemas with Ajv
   */
  private registerSchemas(): void {
    for (const [key, entry] of this.schemas.entries()) {
      try {
        this.ajv.addSchema(entry.schema, key);
      } catch (error) {
        console.error(`Error adding schema ${key}:`, error);
      }
    }
  }

  /**
   * Validate a YAML workflow file
   */
  async validateWorkflow(filePath: string): Promise<ValidationResult> {
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
      let workflowData: YAMLWorkflow;

      try {
        workflowData = yaml.load(content) as YAMLWorkflow;
      } catch (yamlError: any) {
        errors.push({
          type: 'yaml_syntax_error',
          path: filePath,
          message: `YAML syntax error: ${yamlError.message}`
        });
        return this.createResult(filePath, errors, warnings);
      }

      // Validate workflow structure
      this.validateWorkflowStructure(workflowData, errors, warnings);

      // Validate against main workflow schema
      const validate = this.ajv.getSchema('workflow.json');
      if (validate && !validate(workflowData)) {
        this.addAjvErrors(validate.errors, '', errors);
      }

      // Validate activities recursively
      if (workflowData.activities && Array.isArray(workflowData.activities)) {
        this.validateActivities(workflowData.activities, 'activities', errors, warnings);
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
   * Validate top-level workflow structure
   */
  private validateWorkflowStructure(
    workflowData: YAMLWorkflow,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check required top-level properties
    if (!workflowData.workflow) {
      errors.push({
        type: 'missing_property',
        path: 'workflow',
        message: 'Missing required property: workflow'
      });
      return;
    }

    if (!workflowData.activities) {
      errors.push({
        type: 'missing_property',
        path: 'activities',
        message: 'Missing required property: activities'
      });
    }

    // Validate workflow metadata
    const workflow = workflowData.workflow;
    if (!workflow.workflowId) {
      errors.push({
        type: 'missing_property',
        path: 'workflow.workflowId',
        message: 'Missing required property: workflow.workflowId'
      });
    }

    if (!workflow.name) {
      errors.push({
        type: 'missing_property',
        path: 'workflow.name',
        message: 'Missing required property: workflow.name'
      });
    }

    // Check for deprecated properties
    this.checkDeprecatedProperties(workflow, 'workflow', warnings);
  }

  /**
   * Validate activities array recursively
   */
  private validateActivities(
    activities: any[],
    basePath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    activities.forEach((activity, index) => {
      const activityPath = `${basePath}[${index}]`;
      this.validateActivity(activity, activityPath, errors, warnings);
    });
  }

  /**
   * Validate a single activity
   */
  private validateActivity(
    activity: any,
    activityPath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!activity || typeof activity !== 'object') {
      errors.push({
        type: 'invalid_activity',
        path: activityPath,
        message: 'Activity must be an object'
      });
      return;
    }

    // Check for required properties
    if (!activity.name) {
      errors.push({
        type: 'missing_property',
        path: `${activityPath}.name`,
        message: 'Activity must have a name property'
      });
    }

    if (!activity.steps || !Array.isArray(activity.steps)) {
      errors.push({
        type: 'missing_property',
        path: `${activityPath}.steps`,
        message: 'Activity must have a steps array'
      });
      return;
    }

    // Validate each step
    activity.steps.forEach((step: any, stepIndex: number) => {
      const stepPath = `${activityPath}.steps[${stepIndex}]`;
      this.validateStep(step, stepPath, errors, warnings);
    });
  }

  /**
   * Validate a single step (task)
   */
  private validateStep(
    step: any,
    stepPath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!step || typeof step !== 'object') {
      errors.push({
        type: 'schema_violation',
        path: stepPath,
        message: 'Step must be an object'
      });
      return;
    }

    // Check for task type
    if (!step.task) {
      errors.push({
        type: 'missing_property',
        path: `${stepPath}.task`,
        message: 'Step must have a task property'
      });
      return;
    }

    // Validate nested structures (foreach, switch, while)
    this.validateNestedSteps(step, stepPath, errors, warnings);
  }

  /**
   * Validate nested structures within control flow tasks
   */
  private validateNestedSteps(
    step: any,
    stepPath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const taskType = step.task;

    // Handle foreach
    if (taskType === 'foreach') {
      if (step.steps && Array.isArray(step.steps)) {
        step.steps.forEach((nestedStep: any, index: number) => {
          this.validateStep(nestedStep, `${stepPath}.steps[${index}]`, errors, warnings);
        });
      }
    }

    // Handle switch
    if (taskType === 'switch') {
      if (step.cases && Array.isArray(step.cases)) {
        step.cases.forEach((caseItem: any, caseIndex: number) => {
          if (caseItem.steps && Array.isArray(caseItem.steps)) {
            caseItem.steps.forEach((nestedStep: any, stepIndex: number) => {
              this.validateStep(
                nestedStep,
                `${stepPath}.cases[${caseIndex}].steps[${stepIndex}]`,
                errors,
                warnings
              );
            });
          }
        });
      }
      if (step.default && step.default.steps && Array.isArray(step.default.steps)) {
        step.default.steps.forEach((nestedStep: any, index: number) => {
          this.validateStep(nestedStep, `${stepPath}.default.steps[${index}]`, errors, warnings);
        });
      }
    }

    // Handle while
    if (taskType === 'while') {
      if (step.steps && Array.isArray(step.steps)) {
        step.steps.forEach((nestedStep: any, index: number) => {
          this.validateStep(nestedStep, `${stepPath}.steps[${index}]`, errors, warnings);
        });
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
      const errorPath = basePath ? `${basePath}${error.instancePath}` : error.instancePath.slice(1);
      errors.push({
        type: 'schema_violation',
        path: errorPath || '/',
        message: error.message || 'Schema validation failed',
        schemaPath: error.schemaPath
      });
    }
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
      // Add deprecated workflow properties here as needed
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

  /**
   * Get all loaded schema keys
   */
  getLoadedSchemas(): string[] {
    return Array.from(this.schemas.keys());
  }
}
