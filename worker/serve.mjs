import {api} from './api.mjs';
const csp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'";
function denied(setup=false,status=403){return new Response('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MUSE 관리자</title><body><h1>'+ (setup?'사이트 소유자 확인이 필요해요.':'관리자만 접근할 수 있어요.')+'</h1><p>'+(setup?'최초 설정에는 이 사이트를 만든 소유자의 ChatGPT 로그인이 필요해요. 일반 MUSE 이용과 관리자 설정 이후 로그인은 MUSE 계정을 사용해요.':'MUSE 관리자 계정으로 로그인하고 인증 앱 코드를 확인해주세요.')+'</p><a target="_top" href="'+(setup?'/signin-with-chatgpt?return_to=%2Fadmin%2Fsetup':'/')+'">'+(setup?'사이트 소유자로 인증':'MUSE 로그인으로')+'</a></body></html>',{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':csp,'referrer-policy':'same-origin','x-content-type-options':'nosniff'}})}
export async function serve(request,env,assets){let u=new URL(request.url),appEnv={...env,MUSE_AUTH_MODE:'native'};if(u.pathname.startsWith('/api/'))return api(request,appEnv);if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});let assetPath=u.pathname==='/'?'/index.html':u.pathname;
if(['/admin/setup','/admin-setup.html'].includes(u.pathname)){if(env.MUSE_TEST_ADMIN_PASSWORD_ONLY==='true')return Response.redirect(new URL('/#home',u).href,303);let auth=await api(new Request(new URL('/api/auth/admin-bootstrap',u),{headers:request.headers}),appEnv);if(!auth.ok)return denied(auth.status!==409,auth.status);assetPath='/admin-setup.html'}
if(u.pathname==='/admin'){let auth=await api(new Request(new URL('/api/admin/access',u),{headers:request.headers}),appEnv);if(!auth.ok)return denied(false,auth.status);assetPath='/index.html'}
const asset=assets[assetPath];
if(!asset)return new Response('Not found',{status:404});
const headers={
 'content-type':asset.type,
 'cache-control':asset.etag?'public, no-cache':asset.type.startsWith('image/')?'public,max-age=86400':'no-store',
 'x-content-type-options':'nosniff','referrer-policy':'same-origin',
 'permissions-policy':'camera=(), microphone=(), geolocation=()','content-security-policy':csp
};
if(asset.etag){
 headers.etag=asset.etag;
 const validators=request.headers.get('if-none-match')?.split(',').map(tag=>tag.trim().replace(/^W\//,''));
 if(validators?.includes(asset.etag)||validators?.includes('*'))return new Response(null,{status:304,headers});
}
return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0)),{headers});
}
