import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build --mode singlefile` inlines all JS/CSS into one self-contained
// dist/index.html — a portable demo artifact that opens with no server or Node.
// The default `dev` and `build` paths are unaffected (plugin only loads in this mode).
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'singlefile' ? [viteSingleFile()] : [])],
  // The app statically imports the KB and the synthetic inputs that live
  // outside this package (repo-root /synthetic), per plan §3.
  server: {
    fs: {
      allow: ['../..'],
    },
  },
}));
