import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const TEXT_SIZE_DELTA = 'var(--table-text-size-delta, 0px)';

function accessibleFontSizes() {
  return {
    name: 'the-table-accessible-font-sizes',
    enforce: 'pre' as const,
    transform(source: string, id: string) {
      if (!id.split('?', 1)[0]?.endsWith('.css')) return null;

      const fontSize = /(\bfont-size\s*:\s*)(?!0(?:\s|;|!|$))(clamp\([^;{}]+\)|-?(?:\d*\.)?\d+(?:px|rem|em))(\s*!important)?/g;
      const fontShorthand = /(\bfont\s*:\s*)(?!inherit\b)([^;{}]*?)(-?(?:\d*\.)?\d+(?:px|rem|em))(?=\/|\s)([^;{}]*)/g;
      const code = source
        .replace(fontSize, (_match, property, size, important = '') => `${property}calc(${size} + ${TEXT_SIZE_DELTA})${important}`)
        .replace(fontShorthand, (_match, property, prefix, size, suffix) => `${property}${prefix}calc(${size} + ${TEXT_SIZE_DELTA})${suffix}`);

      return code === source ? null : { code, map: null };
    },
  };
}

export default defineConfig({
  plugins: [accessibleFontSizes(), react()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
