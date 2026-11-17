import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createApi } from './server/api'

function diagnosisApi(): Plugin {
  return {
    name: 'diagnosis-api',
    configureServer(server) {
      const app = createApi(server.config.root)
      const handle = app as unknown as (
        req: IncomingMessage,
        res: ServerResponse,
        next: (error?: unknown) => void,
      ) => void
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] ?? ''
        if (path.startsWith('/api')) {
          handle(req, res, next)
          return
        }
        next()
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.PORT || 5173)
  return {
    plugins: [react(), diagnosisApi()],
    server: {
      host: '0.0.0.0',
      port: Number.isFinite(port) ? port : 5173,
    },
  }
})
