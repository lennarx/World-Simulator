import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Genera favicon, 192, 512, maskable 512 y apple-touch-icon 180 desde public/icon.svg (`npm run icons`).
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#1d4e6b' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#1d4e6b' } },
  },
  images: ['public/icon.svg'],
});
