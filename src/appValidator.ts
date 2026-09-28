/**
 * App manifest validator for CXTMS app.yaml files
 */

import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';
import {
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ValidatorOptions
} from './types';

export class AppValidator {
  private ajv: Ajv;
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

    // Load and register app.json
    const schemaPath = path.join(this.schemasDir, 'app.json');
    if (fs.existsSync(schemaPath)) {
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
      this.ajv.addSchema(schema, 'app.json');
    }
  }

  /**
   * Validate a YAML app manifest (app.yaml) file
   */
  async validateApp(filePath: string): Promise<ValidationResult> {
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
      let appData: any;

      try {
        appData = YAML.parse(content);
      } catch (yamlError: any) {
        errors.push({
          type: 'yaml_syntax_error',
          path: filePath,
          message: `YAML syntax error: ${yamlError.message}`
        });
        return this.createResult(filePath, errors, warnings);
      }

      // Validate against app schema
      const validate = this.ajv.getSchema('app.json');
      if (validate && !validate(appData)) {
        this.addAjvErrors(validate.errors, '', errors);
      } else if (!validate) {
        errors.push({
          type: 'unexpected_error',
          path: filePath,
          message: `app.json schema not found in ${this.schemasDir}. Reinstall @cxtms/cx-schema.`
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
        path: errorPath || '/',
        message: `${errorPath || '(root)'} ${error.message || 'Schema validation failed'}`,
        schemaPath: error.schemaPath
      });
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
