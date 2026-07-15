import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://thititongumpun.github.io',
  base: '/TimeCheese',
  vite: {
    plugins: [tailwindcss()],
  },
});
