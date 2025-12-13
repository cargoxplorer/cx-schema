/**
 * TypeScript type definitions for CX Schema Validator
 */

/**
 * Represents a validation error
 */
export interface ValidationError {
  type: string;
  path: string;
  message: string;
  schemaPath?: string;
  example?: any;
}

/**
 * Represents a validation warning
 */
export interface ValidationWarning {
  type: string;
  path: string;
  message: string;
}

/**
 * Summary statistics for validation results
 */
export interface ValidationSummary {
  file: string;
  timestamp: string;
  status: 'PASSED' | 'FAILED';
  errorCount: number;
  warningCount: number;
  errorsByType: Record<string, number>;
}

/**
 * Complete validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: ValidationSummary;
}

/**
 * Schema cache entry
 */
export interface SchemaEntry {
  schema: any;
  uri: string;
}

/**
 * Options for module validator
 */
export interface ValidatorOptions {
  schemasPath?: string;
  strictMode?: boolean;
  includeWarnings?: boolean;
}

/**
 * YAML module structure (partial, for validation purposes)
 */
export interface YAMLModule {
  module?: {
    name?: string;
    appModuleId?: string;
    displayName?: Record<string, string>;
    application?: string;
  };
  components?: any[];
  routes?: any[];
  entities?: any[];
  permissions?: any[];
  [key: string]: any;
}

/**
 * Workflow error types
 */
export type WorkflowErrorType =
  | 'yaml_syntax_error'
  | 'missing_property'
  | 'schema_violation'
  | 'invalid_task_type'
  | 'invalid_expression'
  | 'invalid_activity'
  | 'circular_reference'
  | 'version_mismatch'
  | 'deprecated_task'
  | 'file_not_found'
  | 'unexpected_error';

/**
 * YAML workflow structure (partial, for validation purposes)
 */
export interface YAMLWorkflow {
  workflow?: {
    workflowId?: string;
    name?: string;
    description?: string;
    version?: string;
    executionMode?: 'Sync' | 'Async';
    logLevel?: string;
    isActive?: boolean;
    enableAudit?: boolean;
    enableTransaction?: boolean;
    tags?: string[];
    workflowType?: 'Document' | 'Quote' | 'EmailTemplate';
    [key: string]: any;
  };
  inputs?: any[];
  outputs?: any[];
  variables?: any[];
  activities?: any[];
  triggers?: any[];
  schedules?: any[];
  events?: any;
  [key: string]: any;
}

/**
 * Workflow validation options
 */
export interface WorkflowValidatorOptions extends ValidatorOptions {
  validateTasks?: boolean;
  validateExpressions?: boolean;
}
