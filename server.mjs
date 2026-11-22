import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import sirv from 'sirv';
import { roomMiddleware } from './room-server.js';

const files=sirv(fileURLToPath(new URL('./dist/',import.meta.url)),{brotli:true,maxAge:3600,setHeaders(res,path){
  if(path.endsWith('.html')) res.setHeader('Cache-Control','no-cache');
}});
const rooms=roomMiddleware();
const port=Number(process.env.PORT || 5174);
createServer((req,res)=>{
  if(req.url==='/healthz'){res.writeHead(200,{'Content-Type':'text/plain'});res.end('ok');return;}
  rooms(req,res,()=>files(req,res,()=>{res.writeHead(404);res.end();}));
}).listen(port,'0.0.0.0',()=>console.log('Blockfront listening on '+port));
