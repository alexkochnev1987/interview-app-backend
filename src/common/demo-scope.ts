/** Appends the demo value to `params` and returns the SQL predicate scoping a
 *  query to rows matching that demo flag. */
export function demoScopeClause(params: unknown[], demo: boolean, column = 'demo'): string {
  params.push(demo === true);
  return `${column} = $${params.length}`;
}
