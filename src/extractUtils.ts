/**
 * Utility functions for the extract command
 */

/**
 * Compute the priority for a target module when copying a component.
 * Higher priority = higher override precedence.
 * - If source has a priority, target gets source + 1
 * - If source has no priority, target gets 1
 */
export function computeExtractPriority(sourcePriority: number | undefined): number {
  if (sourcePriority !== undefined && typeof sourcePriority === 'number') {
    return sourcePriority + 1;
  }
  return 1;
}
