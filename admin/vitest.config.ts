import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    css: true,
    // Keep repository tests deterministic even when an operator has enabled
    // live mode in the ignored .env.local used by the development server.
    env: {
      VITE_ADMIN_MODE: 'mock',
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_PUBLISHABLE_KEY: '',
    },
  },
});
