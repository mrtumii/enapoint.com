/* Netlify bundles the functions with esbuild, which resolves a relative .js/.mjs
   specifier to its .ts/.mts source. Plain `node --experimental-strip-types` does
   not, so the test runner registers this hook to do the same thing. */
const MAP = { ".js": ".ts", ".mjs": ".mts" };

export async function resolve(specifier, context, next) {
  for (const [from, to] of Object.entries(MAP)) {
    if (specifier.startsWith(".") && specifier.endsWith(from)) {
      try {
        return await next(specifier.slice(0, -from.length) + to, context);
      } catch {
        // fall through to the specifier as written
      }
    }
  }
  return next(specifier, context);
}
