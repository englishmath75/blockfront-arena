import { defineConfig } from 'vite';
import { roomMiddleware } from './room-server.js';
const connect = (server) => {
  server.middlewares.use(roomMiddleware());
};
export default defineConfig({
  plugins: [{ name: 'player-rooms', configureServer: connect, configurePreviewServer: connect }],
});
