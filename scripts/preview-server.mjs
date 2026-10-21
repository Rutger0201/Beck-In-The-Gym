import { createServer } from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
const root=resolve(import.meta.dirname,'../.local/preview');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.ttf':'font/ttf'};
const server=createServer(async(request,response)=>{
  if(request.method!=='GET'&&request.method!=='HEAD'){response.writeHead(503,{'Content-Type':'application/json'});response.end(JSON.stringify({message:'Design preview only. Nothing was submitted.'}));return;}
  try{
    const url=new URL(request.url,'http://localhost');const decoded=decodeURIComponent(url.pathname);
    let file=resolve(root,'.'+decoded);if(file!==root&&!file.startsWith(root+sep))throw new Error();
    if((await stat(file)).isDirectory())file=resolve(file,'index.html');
    response.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});response.end(request.method==='HEAD'?undefined:await readFile(file));
  }catch{response.writeHead(404);response.end('Not found');}
});
const port=Number(process.env.PREVIEW_PORT||4173);server.listen(port,'127.0.0.1',()=>console.log(`Local design preview: http://127.0.0.1:${port}`));
