import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  // Build output is ONE self-contained HTML file (JS + CSS + data inlined) so
  // the app runs by double-clicking the file from a desktop or network share —
  // no server, no installs. A normal multi-file build breaks on file:// because
  // browsers block external module scripts there.
  plugins: [react(), viteSingleFile()],
  // The app statically imports the KB and the synthetic inputs that live
  // outside this package (repo-root /synthetic), per plan §3.
  server: {
    fs: {
      allow: ['../..'],
    },
  },
});
