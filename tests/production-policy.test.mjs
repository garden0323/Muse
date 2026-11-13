import test from 'node:test';import assert from'node:assert/strict';import{serve}from'../worker/serve.mjs';
test('production assets keep strict CSP; image previews allowed but data URL fetch is forbidden',async()=>{let r=await serve(new Request('https://muse.test/'),{},{'/index.html':{base64:btoa('<!doctype html>'),type:'text/html'}});let csp=r.headers.get('content-security-policy');assert.match(csp,/connect-src 'self';/);assert.match(csp,/img-src 'self' data: blob:/);assert.equal(r.status,200)});

test('static script validators reuse unchanged bytes and send a fresh body for stale validators',async()=>{
 const url='https://muse.test/theme.js';
 const assets={'/theme.js':{base64:btoa('content'),type:'text/javascript',etag:'"revision"'}};
 const changed=await serve(new Request(url,{headers:{'if-none-match':'"old"'}}),{},assets);
 assert.equal(changed.status,200);
 assert.equal(await changed.text(),'content');
 const unchanged=await serve(new Request(url,{headers:{'if-none-match':'W/"revision"'}}),{},assets);
 assert.equal(unchanged.status,304);
 assert.equal(await unchanged.text(),'');
 assert.equal(unchanged.headers.get('etag'),'"revision"');
});
