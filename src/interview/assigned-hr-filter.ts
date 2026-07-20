export const ASSIGNED_HR_FILTER_UNASSIGNED = 'unassigned';

export function isAssignedHrFilterUnassigned(
  assignedHrId: string | undefined,
): boolean {
  return assignedHrId === ASSIGNED_HR_FILTER_UNASSIGNED;
}
