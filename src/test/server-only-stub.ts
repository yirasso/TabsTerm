/**
 * Stands in for the `server-only` package under Vitest.
 *
 * The real module throws on import so a client bundle can never pull a server
 * module in with it. That is exactly right for `next build` and exactly wrong
 * for a test runner, which is neither a client nor a server bundle and would
 * simply fail to load anything marked with it.
 *
 * Empty on purpose: the guard belongs to the build, and the build still has it.
 */
export {};
