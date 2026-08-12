import type { Plugin } from 'vite';

/**
 * Optional dev-server middleware. Logs requests when `DEBUG` is set.
 */
export function devServerMiddleware(): Plugin {
  return {
    name: 'gensource-dev-server-middleware',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (process.env.DEBUG) {
          console.log(`[dev] ${req.method} ${req.url}`);
        }
        next();
      });
    },
  };
}
