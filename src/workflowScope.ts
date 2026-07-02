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

  // System-injected variables that are always available at runtime.
  [
    'organizationId',
    'currentUserId',
    'currentEmployeeId',
    'currentContactId',
    'executionId',
    'workflowId',
    'triggerType',
    'eventType',
    'position',
    'entityName',
    'entityId',
    'entity',
    'data',
    'changes',
    'trackedEntity',
    'entityType',
    'exception'
  ].forEach(name => globals.add(name));

  const triggers = workflowData.triggers || [];
  const entityNames = new Set(
    triggers
      .filter((t: any) => t && t.type === 'Entity' && typeof t.entityName === 'string')
      .map((t: any) => t.entityName.toLowerCase())
  );

  if (entityNames.size > 0) {
    // Common to all entity triggers
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

    // Order entity trigger injects a large set of Order fields.
    if (entityNames.has('order')) {
      [
        'orderId',
        'orderNumber',
        'trackingNumber',
        'organizationId',
        'divisionId',
        'divisionName',
        'orderType',
        'orderTypeName',
        'orderStatusId',
        'orderStatusName',
        'lastOrderStatusModified',
        'billToContactId',
        'billToContactName',
        'billToContactAccountNumber',
        'billToContactType',
        'employeeContactId',
        'employeeContactName',
        'salespersonContactId',
        'salespersonContactName',
        'equipmentTypeId',
        'equipmentTypeName',
        'isDraft',
        'created',
        'createdBy',
        'createdByUserName',
        'lastModified',
        'lastModifiedBy',
        'lastModifiedByUserName',
        'customValues'
      ].forEach(name => globals.add(name));
    }

    // AccountingTransaction entity trigger injects accounting fields.
    if (entityNames.has('accountingtransaction')) {
      [
        'accountingTransactionId',
        'organizationId',
        'transactionNumber',
        'divisionId',
        'divisionName',
        'accountId',
        'accountName',
        'accountType',
        'accountingTransactionStatus',
        'accountingTransactionType',
        'applyToContactId',
        'applyToContactName',
        'applyToContactType',
        'applyToContactAccountNumber',
        'billToContactAddressId',
        'billToContactAddressLine',
        'transactionDate',
        'dueDate',
        'paidDate',
        'amountDue',
        'amountPaid',
        'paidAs',
        'paymentTermsId',
        'paymentTermsDescription',
        'note',
        'isDraft',
        'created',
        'createdBy',
        'lastModified',
        'lastModifiedBy',
        'customValues'
      ].forEach(name => globals.add(name));
    }

    // OrderCommodity entity trigger injects order + commodity fields.
    if (entityNames.has('ordercommodity')) {
      [
        'orderId',
        'orderCommodityId',
        'commodityId',
        'orderNumber',
        'orderTrackingNumber',
        'orderOrganizationId',
        'commodityDescription',
        'commodityOrganizationId',
        'commodityStatusId',
        'commodityStatusName',
        'commodityTypeId',
        'commodityTypeDescription',
        'commodityTypeCode',
        'pieces',
        'weight',
        'weightTotal',
        'weightUnit',
        'length',
        'width',
        'height',
        'dimensionsUnit',
        'packageTypeId',
        'packageTypeName',
        'serialNumber',
        'note',
        'isDraft',
        'created',
        'createdBy',
        'lastModified',
        'lastModifiedBy',
        'customValues'
      ].forEach(name => globals.add(name));
    }

    // Commodity entity trigger injects commodity fields.
    if (entityNames.has('commodity')) {
      [
        'commodityId',
        'organizationId',
        'description',
        'note',
        'serialNumber',
        'commodityStatusId',
        'commodityStatusName',
        'commodityTypeId',
        'commodityTypeCode',
        'commodityTypeDescription',
        'packageTypeId',
        'packageTypeName',
        'length',
        'width',
        'height',
        'dimensionsUnit',
        'weight',
        'weightUnit',
        'pieces',
        'trackingNumber',
        'isDraft',
        'created',
        'createdBy',
        'lastModified',
        'lastModifiedBy',
        'customValues'
      ].forEach(name => globals.add(name));
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
