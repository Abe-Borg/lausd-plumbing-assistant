import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The app statically imports the KB and the synthetic inputs that live
  // outside this package (repo-root /synthetic), per plan §3.
  server: {
    fs: {
      allow: ['../..'],
    },
  },
});
