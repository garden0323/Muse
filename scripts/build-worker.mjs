import {build} from 'esbuild';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.wav':'audio/wav'};
const assets={};
function walk(dir){
 for(const f of readdirSync(dir)){
   if(['server','.openai'].includes(f))continue;
   const p=path.join(dir,f),ext=path.extname(p);
   if(statSync(p).isDirectory()){walk(p);continue}
   if(!types[ext])continue;
   const data=readFileSync(p);
   assets['/'+path.relative('dist',p)]={
     type:types[ext],base64:data.toString('base64'),
     ...(['.js','.css'].includes(ext)?{etag:'"'+createHash('sha256').update(data).digest('base64url')+'"'}:{})
   };
 }
}
walk('dist');
mkdirSync('.local',{recursive:true});
mkdirSync('dist/server',{recursive:true});
writeFileSync('.local/worker-entry.mjs',"import {serve} from '../worker/serve.mjs';\nconst assets="+JSON.stringify(assets)+';\nexport default {fetch(request,env){return serve(request,env,assets)}};');
await build({entryPoints:['.local/worker-entry.mjs'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
console.log('Built Worker with '+Object.keys(assets).length+' preserved assets');
