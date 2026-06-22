export interface ScopeContext {
  globals: Set<string>;
  loopVars: Set<string>;
}

export function copyScope(scope: ScopeContext): ScopeContext {
  return {
    globals: new Set(scope.globals),
    loopVars: new Set(scope.loopVars)
  };
}

export function getAvailableNames(scope: ScopeContext): Set<string> {
  return new Set([...scope.globals, ...scope.loopVars]);
}

export function mergeGlobals(target: ScopeContext, source: ScopeContext): void {
  source.globals.forEach(name => target.globals.add(name));
}

export function createGlobalScope(workflowData: any): ScopeContext {
  const globals = new Set<string>();

  (workflowData.inputs || [])
    .filter((input: any) => input && typeof input === 'object' && typeof input.name === 'string')
    .forEach((input: any) => globals.add(input.name));

  (workflowData.variables || [])
    .filter((variable: any) => variable && typeof variable === 'object' && typeof variable.name === 'string')
    .forEach((variable: any) => globals.add(variable.name));

  const triggers = workflowData.triggers || [];
  const hasEntityTrigger = triggers.some((t: any) => t && t.type === 'Entity');
  if (hasEntityTrigger) {
    [
      'entity',
      'entityId',
      'entityName',
      'eventType',
      'position',
      'changes',
      'trackedEntity',
      'entityType'
    ].forEach(name => globals.add(name));

    // Order and AccountingTransaction entity triggers also inject DivisionId.
    // Variable lookup is case-insensitive, so it satisfies 'divisionId'.
    const entityNames = new Set(
      triggers
        .filter((t: any) => t && t.type === 'Entity' && typeof t.entityName === 'string')
        .map((t: any) => t.entityName.toLowerCase())
    );
    if (entityNames.has('order') || entityNames.has('accountingtransaction')) {
      globals.add('divisionId');
    }
  }

  return { globals, loopVars: new Set<string>() };
}

export function addActivityVariables(scope: ScopeContext, activity: any): ScopeContext {
  const child = copyScope(scope);
  (activity.variables || [])
    .filter((variable: any) => variable && typeof variable === 'object' && typeof variable.name === 'string')
    .forEach((variable: any) => child.globals.add(variable.name));
  return child;
}

export function addSetVariableOutputs(scope: ScopeContext, step: any): void {
  if (!step.inputs || typeof step.inputs !== 'object') return;
  const variables = step.inputs.variables;
  if (!Array.isArray(variables)) return;

  variables
    .filter((variable: any) => variable && typeof variable === 'object' && typeof variable.name === 'string')
    .forEach((variable: any) => scope.globals.add(variable.name));
}

export function addLoopVariables(scope: ScopeContext, taskType: string, step: any): ScopeContext {
  const child = copyScope(scope);
  if (taskType === 'foreach') {
    child.loopVars.add(step.item || 'item');
    child.loopVars.add('index');
  } else if (taskType === 'while') {
    child.loopVars.add('iteration');
  }
  return child;
}
