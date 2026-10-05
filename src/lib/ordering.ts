/**
 * Ordering helpers.
 *
 * Task positions are plain integers. Rather than shuffling numbers around in
 * the client, the UI sends the intended destination ("insert this task into
 * that group at that index") and the server rebuilds a consistent ordering for
 * the whole sibling set inside a transaction.
 *
 * The canonical sibling order is: group first (a scheduled date, or the empty
 * group for unscheduled tasks and subtasks), then the existing position, then
 * the id to keep the result deterministic.
 */

export type SiblingOrderInput = {
  id: string;
  position: number;
  /** `null` / `""` for unscheduled parent tasks and for every subtask. */
  groupKey?: string | null;
};

export function groupKeyOf(groupKey: string | null | undefined): string {
  return groupKey ?? "";
}

/** Stable sort of siblings into the canonical group + position order. */
export function sortSiblings<T extends SiblingOrderInput>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const groupA = groupKeyOf(a.groupKey);
    const groupB = groupKeyOf(b.groupKey);
    if (groupA !== groupB) return groupA < groupB ? -1 : 1;
    if (a.position !== b.position) return a.position - b.position;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Rebuild the ordered id list after moving `movedId` into `targetGroup` at
 * `targetIndex` (the index the task should occupy inside that group).
 *
 * Ids not present in `items` are ignored, and a missing `movedId` leaves the
 * order untouched. The relative order of the other groups is preserved; only
 * the destination group's internal order changes.
 */
export function computeReorderedIds<T extends SiblingOrderInput>(
  items: readonly T[],
  movedId: string,
  targetGroup: string | null | undefined,
  targetIndex: number,
): string[] {
  const sorted = sortSiblings(items.filter((item) => item.id !== movedId));
  const moved = items.find((item) => item.id === movedId);
  const ids = sorted.map((item) => item.id);
  if (!moved) return ids;

  const group = groupKeyOf(targetGroup);
  const members = sorted.filter((item) => groupKeyOf(item.groupKey) === group);

  // Insert before the member that currently occupies the target index.
  const anchor = members[Math.max(0, targetIndex)];
  if (anchor) {
    ids.splice(ids.indexOf(anchor.id), 0, movedId);
    return ids;
  }

  // Past the end of the group: insert right after its last member.
  const last = members.at(-1);
  if (last) {
    ids.splice(ids.indexOf(last.id) + 1, 0, movedId);
    return ids;
  }

  // Empty group: keep the canonical group order (unscheduled, then dates).
  const firstLater = sorted.findIndex((item) => groupKeyOf(item.groupKey) > group);
  ids.splice(firstLater === -1 ? ids.length : firstLater, 0, movedId);
  return ids;
}

/** Turn an ordered id list into the `position` values written to the database. */
export function positionsFromOrder(orderedIds: readonly string[]): Map<string, number> {
  const positions = new Map<string, number>();
  orderedIds.forEach((id, index) => positions.set(id, index));
  return positions;
}

/** Move an item inside an array (immutable). Used for optimistic updates. */
export function arrayMove<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length) return next;
  const clamped = Math.max(0, Math.min(to, next.length - 1));
  const [moved] = next.splice(from, 1);
  next.splice(clamped, 0, moved);
  return next;
}

/** Next position value for an appended task (end of its sibling set). */
export function nextPosition(positions: readonly number[]): number {
  if (positions.length === 0) return 0;
  return Math.max(...positions) + 1;
}
