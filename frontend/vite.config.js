import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { assistantPlugin } from './server/vitePluginAssistant.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // '' = load every variable, not just VITE_*. GROQ_API_KEY stays server-side:
  // only VITE_* variables are ever exposed to browser code.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), assistantPlugin(env)],
  }
})
