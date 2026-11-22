import { defineConfig } from 'vite';
import { roomMiddleware } from './room-server.js';
import { brotliCompressSync, constants } from 'node:zlib';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const connect = (server) => {
  server.middlewares.use(roomMiddleware());
};
export default defineConfig({
  plugins: [{ name: 'player-rooms', configureServer: connect, configurePreviewServer: connect },
    {name:'compress-client',apply:'build',async writeBundle({dir},bundle){
      // Vite resolves dynamic import preload lists when finalizing the chunks.
      for(const name of Object.keys(bundle).filter(name=>/\.(js|css)$/.test(name))){
        const file=join(dir,name);
        const bytes=await readFile(file);
        await writeFile(file+'.br',brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:6}}));
      }
    }}],
});
