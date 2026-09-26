import type { Env } from './env';
import { handleApi } from './api';
import { errorResponse } from './http';
import { runScheduler } from './scheduler';

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url.pathname);
      } catch (err) {
        console.error('API error', request.method, url.pathname, err);
        return errorResponse(
          500,
          'Something went wrong on the server. Please try again in a moment.',
        );
      }
    }
    // Everything else is a static asset (SPA fallback is configured in wrangler.toml).
    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env, ctx): Promise<void> {
    ctx.waitUntil(
      runScheduler(env, new Date(controller.scheduledTime)).catch((err: unknown) =>
        console.error('Scheduler failed', err),
      ),
    );
  },
} satisfies ExportedHandler<Env>;
