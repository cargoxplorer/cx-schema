/**
 * Workflow validator for CargoXplorer YAML workflow files
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

    // Load flow schemas from flow/ subdirectory
    const flowDir = path.join(schemasDir, 'flow');
    if (fs.existsSync(flowDir)) {
      this.loadSchemasFromDir(flowDir, 'flow', schemas);
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
        workflowData = YAML.parse(content) as YAMLWorkflow;
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

      // Validate inputs and variables
      this.validateInputs(workflowData, errors);
      this.validateVariables(workflowData, errors);

      // Validate against main workflow schema
      const validate = this.ajv.getSchema('workflow.json');
      if (validate && !validate(workflowData)) {
        this.addAjvErrors(validate.errors, '', errors);
      }

      const isFlowWorkflow = workflowData.workflow?.workflowType === 'Flow';

      if (isFlowWorkflow) {
        // Validate Flow-specific sections
        this.validateFlowWorkflow(workflowData, errors, warnings);
      } else {
        // Validate activities recursively (standard workflows)
        if (workflowData.activities && Array.isArray(workflowData.activities)) {
          this.validateActivities(workflowData.activities, 'activities', errors, warnings);
        }
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

    const isFlowWorkflow = workflowData.workflow?.workflowType === 'Flow';

    if (isFlowWorkflow) {
      if (!workflowData.entity) {
        errors.push({
          type: 'missing_property',
          path: 'entity',
          message: 'Missing required property: entity (required for Flow workflows)'
        });
      }
    } else {
      if (!workflowData.activities) {
        errors.push({
          type: 'missing_property',
          path: 'activities',
          message: 'Missing required property: activities'
        });
      }
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
   * Validate workflow inputs.
   * Top-level input properties are: name, type, props.
   * Settings like required, displayName, description belong inside props.
   */
  private validateInputs(
    workflowData: YAMLWorkflow,
    errors: ValidationError[]
  ): void {
    const inputs = workflowData.inputs;
    if (!inputs || !Array.isArray(inputs)) return;

    const propsOnlyFields = ['required', 'isRequired', 'displayName', 'description', 'multiple', 'visible', 'defaultValue', 'mapping', 'filter', 'options'];

    inputs.forEach((input: any, index: number) => {
      const inputPath = `inputs[${index}]`;

      for (const field of propsOnlyFields) {
        if (field in input) {
          errors.push({
            type: 'schema_violation',
            path: `${inputPath}.${field}`,
            message: `Invalid top-level property '${field}'. Move it inside 'props'`
          });
        }
      }
    });
  }

  /**
   * Validate workflow variables.
   * Top-level variable properties are: name, value, fromConfig.
   */
  private validateVariables(
    workflowData: YAMLWorkflow,
    errors: ValidationError[]
  ): void {
    const variables = workflowData.variables;
    if (!variables || !Array.isArray(variables)) return;

    variables.forEach((variable: any, index: number) => {
      const varPath = `variables[${index}]`;

      if ('type' in variable) {
        errors.push({
          type: 'schema_violation',
          path: `${varPath}.type`,
          message: `Invalid property 'type' on variable. Variables only support 'name', 'value', and 'fromConfig'`
        });
      }
    });
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
   * Validate Flow workflow sections (entity, states, transitions, aggregations)
   */
  private validateFlowWorkflow(
    workflowData: YAMLWorkflow,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    this.validateFlowEntity(workflowData, errors);
    const stateNames = this.validateFlowStates(workflowData, errors, warnings);
    this.validateFlowTransitions(workflowData, stateNames, errors, warnings);
    this.validateFlowAggregations(workflowData, errors);
  }

  /**
   * Validate Flow entity section
   */
  private validateFlowEntity(
    workflowData: YAMLWorkflow,
    errors: ValidationError[]
  ): void {
    const entity = workflowData.entity;
    if (!entity) return;

    if (!entity.name) {
      errors.push({
        type: 'missing_property',
        path: 'entity.name',
        message: 'Entity name is required for Flow workflows'
      });
    }
  }

  /**
   * Validate Flow states and return set of state names
   */
  private validateFlowStates(
    workflowData: YAMLWorkflow,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Set<string> {
    const stateNames = new Set<string>();
    const states = workflowData.states;
    if (!states || !Array.isArray(states)) return stateNames;

    let initialStateCount = 0;
    const parentStates = new Set<string>();

    // First pass: collect state names and parents
    for (const state of states) {
      if (state.name) stateNames.add(state.name);
      if (state.parent) parentStates.add(state.parent);
    }

    // Second pass: validate each state
    states.forEach((state: any, index: number) => {
      const statePath = `states[${index}]`;

      if (!state.name) {
        errors.push({
          type: 'missing_property',
          path: `${statePath}.name`,
          message: 'State name is required'
        });
        return;
      }

      // Check for duplicate names
      const duplicates = states.filter(
        (s: any) => s.name?.toLowerCase() === state.name?.toLowerCase()
      );
      if (duplicates.length > 1) {
        errors.push({
          type: 'schema_violation',
          path: `${statePath}.name`,
          message: `Duplicate state name '${state.name}'`
        });
      }

      if (state.isInitial) initialStateCount++;

      // Validate parent reference
      if (state.parent && !stateNames.has(state.parent)) {
        errors.push({
          type: 'schema_violation',
          path: `${statePath}.parent`,
          message: `Parent state '${state.parent}' not found`
        });
      }

      // Validate onEnter/onExit steps
      if (state.onEnter && Array.isArray(state.onEnter)) {
        state.onEnter.forEach((step: any, stepIndex: number) => {
          this.validateStep(step, `${statePath}.onEnter[${stepIndex}]`, errors, warnings);
        });
      }
      if (state.onExit && Array.isArray(state.onExit)) {
        state.onExit.forEach((step: any, stepIndex: number) => {
          this.validateStep(step, `${statePath}.onExit[${stepIndex}]`, errors, warnings);
        });
      }
    });

    if (initialStateCount > 1) {
      errors.push({
        type: 'schema_violation',
        path: 'states',
        message: `Found ${initialStateCount} initial states. At most one state can be marked as initial.`
      });
    }

    return stateNames;
  }

  /**
   * Validate Flow transitions
   */
  private validateFlowTransitions(
    workflowData: YAMLWorkflow,
    stateNames: Set<string>,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const transitions = workflowData.transitions;
    if (!transitions || !Array.isArray(transitions)) return;

    const transitionNames = new Set<string>();

    transitions.forEach((transition: any, index: number) => {
      const transPath = `transitions[${index}]`;

      if (!transition.name) {
        errors.push({
          type: 'missing_property',
          path: `${transPath}.name`,
          message: 'Transition name is required'
        });
      } else if (transitionNames.has(transition.name.toLowerCase())) {
        errors.push({
          type: 'schema_violation',
          path: `${transPath}.name`,
          message: `Duplicate transition name '${transition.name}'`
        });
      } else {
        transitionNames.add(transition.name.toLowerCase());
      }

      // Validate from states
      if (transition.from && stateNames.size > 0) {
        const fromStates = Array.isArray(transition.from) ? transition.from : [transition.from];
        for (const fromState of fromStates) {
          if (fromState !== '*' && !stateNames.has(fromState)) {
            errors.push({
              type: 'schema_violation',
              path: `${transPath}.from`,
              message: `Source state '${fromState}' not found in states`
            });
          }
        }
      }

      // Validate to state
      if (transition.to && stateNames.size > 0 && !stateNames.has(transition.to)) {
        errors.push({
          type: 'schema_violation',
          path: `${transPath}.to`,
          message: `Target state '${transition.to}' not found in states`
        });
      }

      // Validate trigger
      const validTriggers = ['auto', 'manual', 'event'];
      if (transition.trigger && !validTriggers.includes(transition.trigger)) {
        errors.push({
          type: 'schema_violation',
          path: `${transPath}.trigger`,
          message: `Invalid trigger '${transition.trigger}'. Valid triggers: ${validTriggers.join(', ')}`
        });
      }

      // Validate event trigger requires eventName
      if (transition.trigger === 'event' && !transition.eventName) {
        errors.push({
          type: 'missing_property',
          path: `${transPath}.eventName`,
          message: "eventName is required when trigger is 'event'"
        });
      }

      // Validate transition steps
      if (transition.steps && Array.isArray(transition.steps)) {
        transition.steps.forEach((step: any, stepIndex: number) => {
          this.validateStep(step, `${transPath}.steps[${stepIndex}]`, errors, warnings);
        });
      }
    });
  }

  /**
   * Validate Flow aggregations
   */
  private validateFlowAggregations(
    workflowData: YAMLWorkflow,
    errors: ValidationError[]
  ): void {
    const aggregations = workflowData.aggregations;
    if (!aggregations || !Array.isArray(aggregations)) return;

    const validFunctions = ['all', 'any', 'sum', 'count', 'first', 'last', 'distinct', 'groupBy'];
    const aggregationNames = new Set<string>();

    aggregations.forEach((aggregation: any, index: number) => {
      const aggPath = `aggregations[${index}]`;

      if (!aggregation.name) {
        errors.push({
          type: 'missing_property',
          path: `${aggPath}.name`,
          message: 'Aggregation name is required'
        });
      } else if (aggregationNames.has(aggregation.name.toLowerCase())) {
        errors.push({
          type: 'schema_violation',
          path: `${aggPath}.name`,
          message: `Duplicate aggregation name '${aggregation.name}'`
        });
      } else {
        aggregationNames.add(aggregation.name.toLowerCase());
      }

      if (!aggregation.expression) {
        errors.push({
          type: 'missing_property',
          path: `${aggPath}.expression`,
          message: 'Aggregation expression is required'
        });
      } else {
        const fnMatch = aggregation.expression.match(/^(\w+)\s*\(/);
        if (fnMatch) {
          if (!validFunctions.includes(fnMatch[1].toLowerCase())) {
            errors.push({
              type: 'schema_violation',
              path: `${aggPath}.expression`,
              message: `Invalid aggregation function '${fnMatch[1]}'. Valid functions: ${validFunctions.join(', ')}`
            });
          }
        } else {
          errors.push({
            type: 'schema_violation',
            path: `${aggPath}.expression`,
            message: 'Aggregation expression must start with a function call'
          });
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
