import { defineConfig } from 'vite';
import { roomMiddleware } from './room-server.js';
import { brotliCompressSync, constants } from 'node:zlib';
const connect = (server) => {
  server.middlewares.use(roomMiddleware());
};
export default defineConfig({
  plugins: [{ name: 'player-rooms', configureServer: connect, configurePreviewServer: connect },
    {name:'compress-client',apply:'build',generateBundle(_,bundle){
      for(const item of Object.values(bundle)){
        if(!/\.(js|css)$/.test(item.fileName))continue;
        const bytes=item.type==='chunk'?item.code:item.source;
        this.emitFile({type:'asset',fileName:item.fileName+'.br',source:brotliCompressSync(bytes,{params:{[constants.BROTLI_PARAM_QUALITY]:6}})});
      }
    }}],
});
