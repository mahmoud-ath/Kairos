/**
 * The error model shared by the service layer and Server Actions.
 *
 * It lives on its own — not inside `services/tasks.ts` — because every feature
 * raises it: habits, statistics, push, backup and the actions that wrap them.
 * Importing the task service just to describe "this input is not acceptable"
 * made unrelated features depend on tasks, which is exactly the coupling the
 * architecture review flagged (A5).
 *
 * Deliberately not importing `server-only`: this is a small value type, and
 * keeping it importable is what lets a unit test (or a future pure adapter)
 * assert on it without the React server condition.
 */
export class ServiceError extends Error {
  /** Per-field messages, when the problem belongs to specific inputs. */
  readonly fieldErrors?: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "ServiceError";
    this.fieldErrors = fieldErrors;
  }
}
