/**
 * Workflow validator for CXTMS YAML workflow files
 */

import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import YAML from 'yaml';
import { buildLocationMap, YAMLLocationMap } from './yamlLocationResolver';
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
  private ajvEnforced: Ajv;
  private schemas: Map<string, SchemaEntry>;
  private schemasDir: string;
  private options: Required<WorkflowValidatorOptions>;
  // Per-task required author-input keys (generated from backend handlers).
  // Keyed by lowercased base task name (version stripped).
  private requiredInputs: Map<string, string[]>;

  constructor(options: WorkflowValidatorOptions = {}) {
    this.schemasDir = options.schemasPath || path.join(__dirname, '../schemas/workflows');
    this.options = {
      schemasPath: this.schemasDir,
      strictMode: options.strictMode ?? true,
      includeWarnings: options.includeWarnings ?? true,
      schemaEnforcement: options.schemaEnforcement ?? false,
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

    // Per-task required-input catalog (generated from backend handlers).
    this.requiredInputs = this.loadRequiredInputs();
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
        uri: pathToFileURL(mainSchemaPath).href
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
          uri: pathToFileURL(schemaPath).href
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
            uri: pathToFileURL(filePath).href
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
   * Register schemas under their file:// URI so cross-file $ref resolve.
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
   * Load the per-task required-input catalog (generated from backend task
   * handlers via scripts/generate-task-required-inputs.js). Keyed by lowercased
   * base task name (version stripped). System-injected variables are already
   * excluded upstream. Missing/unreadable file => empty map (check is skipped).
   */
  private loadRequiredInputs(): Map<string, string[]> {
    const map = new Map<string, string[]>();
    const catalogPath = path.join(this.schemasDir, 'task-required-inputs.json');
    if (!fs.existsSync(catalogPath)) return map;
    try {
      const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
      for (const [taskName, keys] of Object.entries(catalog)) {
        if (Array.isArray(keys)) {
          map.set(taskName.toLowerCase(), keys as string[]);
        }
      }
    } catch (error) {
      console.error('Error loading task-required-inputs.json:', error);
    }
    return map;
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
   * Convert Ajv errors to warning entries (no schemaPath).
   */
  private addAjvWarnings(
    ajvErrors: ErrorObject[] | null | undefined,
    basePath: string,
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap
  ): void {
    if (!ajvErrors) return;
    for (const error of ajvErrors) {
      const warningPath = `${basePath}${error.instancePath}`;
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
   * in error.params.
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
      workflowData = doc.toJS() as YAMLWorkflow;
      locationMap = buildLocationMap(content);

      // Validate workflow structure
      this.validateWorkflowStructure(workflowData, errors, warnings, filePath, locationMap);

      // Validate inputs and variables
      this.validateInputs(workflowData, errors, locationMap);
      this.validateVariables(workflowData, errors, locationMap);

      // Validate against main workflow schema
      const enforce = this.options.schemaEnforcement;
      if (enforce === 'warn' || enforce === 'error') {
        const wfEntry = this.schemas.get('workflow.json');
        try {
          const validate = wfEntry ? this.ajvEnforced.getSchema(wfEntry.uri) : undefined;
          if (validate && !validate(workflowData)) {
            if (enforce === 'error') {
              this.addAjvErrors(validate.errors, '', errors, true, locationMap);
            } else {
              this.addAjvWarnings(validate.errors, '', warnings, locationMap);
            }
          }
        } catch (error: any) {
          const msg = `Schema enforcement skipped for workflow.json: ${error.message}`;
          if (enforce === 'error') {
            errors.push({
              type: 'schema_compile_error',
              path: '',
              message: msg,
              location: this.resolveLocation(locationMap, '')
            });
          } else {
            warnings.push({
              type: 'schema_compile_error',
              path: '',
              message: msg,
              location: this.resolveLocation(locationMap, '')
            });
          }
        }
      } else {
        // Off path: unchanged (byte-for-byte).
        const validate = this.ajv.getSchema('workflow.json');
        if (validate && !validate(workflowData)) {
          this.addAjvErrors(validate.errors, '', errors, false, locationMap);
        }
      }

      const isFlowWorkflow = workflowData.workflow?.workflowType === 'Flow';

      if (isFlowWorkflow) {
        // Validate Flow-specific sections
        this.validateFlowWorkflow(workflowData, errors, warnings, locationMap);
      } else {
        // Validate activities recursively (standard workflows)
        if (workflowData.activities && Array.isArray(workflowData.activities)) {
          this.validateActivities(workflowData.activities, 'activities', errors, warnings, locationMap);
        }
      }

      // Validate workflow-level event handler steps
      this.validateEventSteps(
        workflowData.events,
        'events',
        ['onWorkflowStarted', 'onWorkflowCompleted', 'onWorkflowExecuted', 'onWorkflowFailed'],
        errors,
        warnings,
        locationMap
      );

      // Warn on deprecated onWorkflowExecuted
      if (workflowData.events && !Array.isArray(workflowData.events) && workflowData.events.onWorkflowExecuted) {
        warnings.push({
          type: 'deprecated_property',
          path: 'events.onWorkflowExecuted',
          message: 'Use "onWorkflowCompleted" instead of "onWorkflowExecuted"',
          location: this.resolveLocation(locationMap, 'events.onWorkflowExecuted')
        });
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
   * Validate top-level workflow structure
   */
  private validateWorkflowStructure(
    workflowData: YAMLWorkflow,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    filePath?: string,
    locationMap?: YAMLLocationMap
  ): void {
    // Check required top-level properties
    if (!workflowData.workflow) {
      errors.push({
        type: 'missing_property',
        path: 'workflow',
        message: 'Missing required property: workflow',
        location: this.resolveLocation(locationMap, 'workflow')
      });
      return;
    }

    const isFlowWorkflow = workflowData.workflow?.workflowType === 'Flow';

    if (isFlowWorkflow) {
      if (!workflowData.entity) {
        errors.push({
          type: 'missing_property',
          path: 'entity',
          message: 'Missing required property: entity (required for Flow workflows)',
          location: this.resolveLocation(locationMap, 'entity')
        });
      }
    } else {
      if (!workflowData.activities) {
        errors.push({
          type: 'missing_property',
          path: 'activities',
          message: 'Missing required property: activities',
          location: this.resolveLocation(locationMap, 'activities')
        });
      }
    }

    // Validate workflow metadata
    const workflow = workflowData.workflow;
    if (!workflow.workflowId) {
      errors.push({
        type: 'missing_property',
        path: 'workflow.workflowId',
        message: 'Missing required property: workflow.workflowId',
        location: this.resolveLocation(locationMap, 'workflow.workflowId')
      });
    }

    if (!workflow.name) {
      errors.push({
        type: 'missing_property',
        path: 'workflow.name',
        message: 'Missing required property: workflow.name',
        location: this.resolveLocation(locationMap, 'workflow.name')
      });
    }

    // Check for deprecated properties
    this.checkDeprecatedProperties(workflow, 'workflow', warnings, locationMap);

    // filePath / fileName deprecation and validation
    if (workflow.fileName && !workflow.filePath) {
      warnings.push({
        type: 'deprecated_property',
        path: 'workflow.fileName',
        message: 'Use "filePath" instead of "fileName" in workflow section',
        location: this.resolveLocation(locationMap, 'workflow.fileName')
      });
    }

    const declaredPath = workflow.filePath ?? workflow.fileName;
    if (declaredPath && filePath) {
      const normalizedActual = this.normalizeFilePath(filePath);
      const normalizedDeclared = this.normalizeFilePath(declaredPath);
      if (!normalizedActual.endsWith(normalizedDeclared)) {
        warnings.push({
          type: 'file_path_mismatch',
          path: 'workflow.filePath',
          message: `Declared filePath "${normalizedDeclared}" does not match actual file path "${normalizedActual}"`,
          location: this.resolveLocation(locationMap, 'workflow.filePath')
        });
      }
    }
  }

  /**
   * Validate workflow inputs.
   * Top-level input properties are: name, type, props.
   * Settings like required, displayName, description belong inside props.
   */
  private validateInputs(
    workflowData: YAMLWorkflow,
    errors: ValidationError[],
    locationMap?: YAMLLocationMap
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
            message: `Invalid top-level property '${field}'. Move it inside 'props'`,
            location: this.resolveLocation(locationMap, `${inputPath}.${field}`)
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
    errors: ValidationError[],
    locationMap?: YAMLLocationMap
  ): void {
    const variables = workflowData.variables;
    if (!variables || !Array.isArray(variables)) return;

    variables.forEach((variable: any, index: number) => {
      const varPath = `variables[${index}]`;

      if ('type' in variable) {
        errors.push({
          type: 'schema_violation',
          path: `${varPath}.type`,
          message: `Invalid property 'type' on variable. Variables only support 'name', 'value', and 'fromConfig'`,
          location: this.resolveLocation(locationMap, `${varPath}.type`)
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
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap
  ): void {
    activities.forEach((activity, index) => {
      const activityPath = `${basePath}[${index}]`;
      this.validateActivity(activity, activityPath, errors, warnings, locationMap);
    });
  }

  /**
   * Validate a single activity
   */
  private validateActivity(
    activity: any,
    activityPath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap
  ): void {
    if (!activity || typeof activity !== 'object') {
      errors.push({
        type: 'invalid_activity',
        path: activityPath,
        message: 'Activity must be an object',
        location: this.resolveLocation(locationMap, activityPath)
      });
      return;
    }

    // Check for required properties
    if (!activity.name) {
      errors.push({
        type: 'missing_property',
        path: `${activityPath}.name`,
        message: 'Activity must have a name property',
        location: this.resolveLocation(locationMap, `${activityPath}.name`)
      });
    }

    if (!activity.steps || !Array.isArray(activity.steps)) {
      errors.push({
        type: 'missing_property',
        path: `${activityPath}.steps`,
        message: 'Activity must have a steps array',
        location: this.resolveLocation(locationMap, `${activityPath}.steps`)
      });
      return;
    }

    // Validate each step
    activity.steps.forEach((step: any, stepIndex: number) => {
      const stepPath = `${activityPath}.steps[${stepIndex}]`;
      this.validateStep(step, stepPath, errors, warnings, locationMap);
    });

    // Validate activity-level event handler steps
    this.validateEventSteps(
      activity.events,
      `${activityPath}.events`,
      ['onActivityStarted', 'onActivityCompleted', 'onActivityFailed'],
      errors,
      warnings,
      locationMap
    );
  }

  /**
   * Validate steps inside event handlers (object format)
   */
  private validateEventSteps(
    events: any,
    basePath: string,
    eventNames: string[],
    errors: ValidationError[],
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap
  ): void {
    if (!events || typeof events !== 'object' || Array.isArray(events)) return;

    for (const eventName of eventNames) {
      const steps = events[eventName];
      if (steps && Array.isArray(steps)) {
        steps.forEach((step: any, index: number) => {
          this.validateStep(step, `${basePath}.${eventName}[${index}]`, errors, warnings, locationMap);
        });
      }
    }
  }

  /**
   * Validate a single step (task)
   */
  private validateStep(
    step: any,
    stepPath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap
  ): void {
    if (!step || typeof step !== 'object') {
      errors.push({
        type: 'schema_violation',
        path: stepPath,
        message: 'Step must be an object',
        location: this.resolveLocation(locationMap, stepPath)
      });
      return;
    }

    // Check for task type
    if (!step.task) {
      errors.push({
        type: 'missing_property',
        path: `${stepPath}.task`,
        message: 'Step must have a task property',
        location: this.resolveLocation(locationMap, `${stepPath}.task`)
      });
      return;
    }

    // Required-input presence check (schemaEnforcement warn/error only).
    this.validateRequiredInputs(step, stepPath, errors, warnings, locationMap);

    // Validate nested structures (foreach, switch, while)
    this.validateNestedSteps(step, stepPath, errors, warnings, locationMap);
  }

  /**
   * Presence check: for tasks in the required-input catalog, confirm each
   * required author-provided input key is present in step.inputs. System-
   * injected variables (organizationId, workflowId, ...) are already excluded
   * from the catalog. Only runs under schemaEnforcement 'warn'/'error'.
   * Unknown tasks and control-flow tasks (foreach/switch/while) are absent
   * from the catalog and are silently skipped.
   */
  private validateRequiredInputs(
    step: any,
    stepPath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap
  ): void {
    const enforce = this.options.schemaEnforcement;
    if (enforce !== 'warn' && enforce !== 'error') return;
    if (!step.task || typeof step.task !== 'string') return;

    const baseName = step.task.split('@')[0].toLowerCase();
    const required = this.requiredInputs.get(baseName);
    if (!required || required.length === 0) return;

    const inputs =
      step.inputs && typeof step.inputs === 'object' ? (step.inputs as object) : null;
    for (const key of required) {
      if (!inputs || !(key in inputs)) {
        const message = `Task '${step.task.split('@')[0]}' is missing required input '${key}'`;
        const entryPath = `${stepPath}.inputs.${key}`;
        if (enforce === 'error') {
          errors.push({
            type: 'schema_violation',
            path: entryPath,
            message,
            location: this.resolveLocation(locationMap, entryPath)
          });
        } else {
          warnings.push({
            type: 'schema_violation',
            path: entryPath,
            message,
            location: this.resolveLocation(locationMap, entryPath)
          });
        }
      }
    }
  }

  /**
   * Validate nested structures within control flow tasks
   */
  private validateNestedSteps(
    step: any,
    stepPath: string,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap
  ): void {
    const taskType = step.task;

    // Handle foreach
    if (taskType === 'foreach') {
      if (step.steps && Array.isArray(step.steps)) {
        step.steps.forEach((nestedStep: any, index: number) => {
          this.validateStep(nestedStep, `${stepPath}.steps[${index}]`, errors, warnings, locationMap);
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
                warnings,
                locationMap
              );
            });
          }
        });
      }
      if (step.default && step.default.steps && Array.isArray(step.default.steps)) {
        step.default.steps.forEach((nestedStep: any, index: number) => {
          this.validateStep(nestedStep, `${stepPath}.default.steps[${index}]`, errors, warnings, locationMap);
        });
      }
    }

    // Handle while
    if (taskType === 'while') {
      if (step.steps && Array.isArray(step.steps)) {
        step.steps.forEach((nestedStep: any, index: number) => {
          this.validateStep(nestedStep, `${stepPath}.steps[${index}]`, errors, warnings, locationMap);
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
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap
  ): void {
    this.validateFlowEntity(workflowData, errors, locationMap);
    const stateNames = this.validateFlowStates(workflowData, errors, warnings, locationMap);
    this.validateFlowTransitions(workflowData, stateNames, errors, warnings, locationMap);
    this.validateFlowAggregations(workflowData, errors, locationMap);
  }

  /**
   * Validate Flow entity section
   */
  private validateFlowEntity(
    workflowData: YAMLWorkflow,
    errors: ValidationError[],
    locationMap?: YAMLLocationMap
  ): void {
    const entity = workflowData.entity;
    if (!entity) return;

    if (!entity.name) {
      errors.push({
        type: 'missing_property',
        path: 'entity.name',
        message: 'Entity name is required for Flow workflows',
        location: this.resolveLocation(locationMap, 'entity.name')
      });
    }
  }

  /**
   * Validate Flow states and return set of state names
   */
  private validateFlowStates(
    workflowData: YAMLWorkflow,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap
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
          message: 'State name is required',
          location: this.resolveLocation(locationMap, `${statePath}.name`)
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
          message: `Duplicate state name '${state.name}'`,
          location: this.resolveLocation(locationMap, `${statePath}.name`)
        });
      }

      if (state.isInitial) initialStateCount++;

      // Validate parent reference
      if (state.parent && !stateNames.has(state.parent)) {
        errors.push({
          type: 'schema_violation',
          path: `${statePath}.parent`,
          message: `Parent state '${state.parent}' not found`,
          location: this.resolveLocation(locationMap, `${statePath}.parent`)
        });
      }

      // Validate onEnter/onExit steps
      if (state.onEnter && Array.isArray(state.onEnter)) {
        state.onEnter.forEach((step: any, stepIndex: number) => {
          this.validateStep(step, `${statePath}.onEnter[${stepIndex}]`, errors, warnings, locationMap);
        });
      }
      if (state.onExit && Array.isArray(state.onExit)) {
        state.onExit.forEach((step: any, stepIndex: number) => {
          this.validateStep(step, `${statePath}.onExit[${stepIndex}]`, errors, warnings, locationMap);
        });
      }
    });

    if (initialStateCount > 1) {
      errors.push({
        type: 'schema_violation',
        path: 'states',
        message: `Found ${initialStateCount} initial states. At most one state can be marked as initial.`,
        location: this.resolveLocation(locationMap, 'states')
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
    warnings: ValidationWarning[],
    locationMap?: YAMLLocationMap
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
          message: 'Transition name is required',
          location: this.resolveLocation(locationMap, `${transPath}.name`)
        });
      } else if (transitionNames.has(transition.name.toLowerCase())) {
        errors.push({
          type: 'schema_violation',
          path: `${transPath}.name`,
          message: `Duplicate transition name '${transition.name}'`,
          location: this.resolveLocation(locationMap, `${transPath}.name`)
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
              message: `Source state '${fromState}' not found in states`,
              location: this.resolveLocation(locationMap, `${transPath}.from`)
            });
          }
        }
      }

      // Validate to state
      if (transition.to && stateNames.size > 0 && !stateNames.has(transition.to)) {
        errors.push({
          type: 'schema_violation',
          path: `${transPath}.to`,
          message: `Target state '${transition.to}' not found in states`,
          location: this.resolveLocation(locationMap, `${transPath}.to`)
        });
      }

      // Validate trigger
      const validTriggers = ['auto', 'manual', 'event'];
      if (transition.trigger && !validTriggers.includes(transition.trigger)) {
        errors.push({
          type: 'schema_violation',
          path: `${transPath}.trigger`,
          message: `Invalid trigger '${transition.trigger}'. Valid triggers: ${validTriggers.join(', ')}`,
          location: this.resolveLocation(locationMap, `${transPath}.trigger`)
        });
      }

      // Validate event trigger requires eventName
      if (transition.trigger === 'event' && !transition.eventName) {
        errors.push({
          type: 'missing_property',
          path: `${transPath}.eventName`,
          message: "eventName is required when trigger is 'event'",
          location: this.resolveLocation(locationMap, `${transPath}.eventName`)
        });
      }

      // Validate transition steps
      if (transition.steps && Array.isArray(transition.steps)) {
        transition.steps.forEach((step: any, stepIndex: number) => {
          this.validateStep(step, `${transPath}.steps[${stepIndex}]`, errors, warnings, locationMap);
        });
      }
    });
  }

  /**
   * Validate Flow aggregations
   */
  private validateFlowAggregations(
    workflowData: YAMLWorkflow,
    errors: ValidationError[],
    locationMap?: YAMLLocationMap
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
          message: 'Aggregation name is required',
          location: this.resolveLocation(locationMap, `${aggPath}.name`)
        });
      } else if (aggregationNames.has(aggregation.name.toLowerCase())) {
        errors.push({
          type: 'schema_violation',
          path: `${aggPath}.name`,
          message: `Duplicate aggregation name '${aggregation.name}'`,
          location: this.resolveLocation(locationMap, `${aggPath}.name`)
        });
      } else {
        aggregationNames.add(aggregation.name.toLowerCase());
      }

      if (!aggregation.expression) {
        errors.push({
          type: 'missing_property',
          path: `${aggPath}.expression`,
          message: 'Aggregation expression is required',
          location: this.resolveLocation(locationMap, `${aggPath}.expression`)
        });
      } else {
        const fnMatch = aggregation.expression.match(/^(\w+)\s*\(/);
        if (fnMatch) {
          if (!validFunctions.includes(fnMatch[1].toLowerCase())) {
            errors.push({
              type: 'schema_violation',
              path: `${aggPath}.expression`,
              message: `Invalid aggregation function '${fnMatch[1]}'. Valid functions: ${validFunctions.join(', ')}`,
              location: this.resolveLocation(locationMap, `${aggPath}.expression`)
            });
          }
        } else {
          errors.push({
            type: 'schema_violation',
            path: `${aggPath}.expression`,
            message: 'Aggregation expression must start with a function call',
            location: this.resolveLocation(locationMap, `${aggPath}.expression`)
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
    errors: ValidationError[],
    enrich = false,
    locationMap?: YAMLLocationMap
  ): void {
    if (!ajvErrors) return;

    for (const error of ajvErrors) {
      const errorPath = basePath ? `${basePath}${error.instancePath}` : error.instancePath.slice(1);
      const finalPath = errorPath || '/';
      errors.push({
        type: 'schema_violation',
        path: finalPath,
        message: enrich ? this.schemaMessage(error) : (error.message || 'Schema validation failed'),
        schemaPath: error.schemaPath,
        location: this.resolveLocation(locationMap, finalPath)
      });
    }
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
      // Add deprecated workflow properties here as needed
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

  /**
   * Get all loaded schema keys
   */
  getLoadedSchemas(): string[] {
    return Array.from(this.schemas.keys());
  }
}
