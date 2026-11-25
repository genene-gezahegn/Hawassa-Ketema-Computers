import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  if (mode === 'production') {
    const apiUrl = loadEnv(mode, process.cwd(), '').VITE_API_URL?.trim();
    if (!apiUrl) {
      throw new Error('VITE_API_URL must be set to the HTTPS production API URL before building.');
    }

    let parsedApiUrl;
    try {
      parsedApiUrl = new URL(apiUrl);
    } catch {
      throw new Error('VITE_API_URL must be a valid HTTPS production API URL.');
    }
    if (parsedApiUrl.protocol !== 'https:' || parsedApiUrl.username || parsedApiUrl.password) {
      throw new Error('VITE_API_URL must use HTTPS and must not contain credentials.');
    }
  }

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
  };
});
