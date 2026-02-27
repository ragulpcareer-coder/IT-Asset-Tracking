import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    build: {
        assetsDir: 'static',
        rollupOptions: {
            external: ['canvg', 'html2canvas', 'dompurify'],
            output: {
                manualChunks: undefined,
            },
        },
    },
});
