import {SUPER_ADMIN_HANDLE,bootstrapAdmin,consumeAdminCode,requireStepUp,isAdmin,passwordOnlyTestAdmin,provisionTestAdmin} from './admin-security.mjs';
import {eventStream} from './events.mjs';
import {argon2idAsync} from '@noble/hashes/argon2.js';
import {fail,id} from './api.mjs';
import {emptyBoard,privacyVersion,readBytes} from './beta.mjs';
const COOKIE='__Host-muse_session',DAY=86400000,IDLE=30*DAY,ABSOLUTE=90*DAY;
const encoder=new TextEncoder(),hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join(''),random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const digest=async s=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(s))));
const fromHex=h=>Uint8Array.from(h.match(/../g),x=>parseInt(x,16));
function equal(a,b){let n=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)n|=(a[i]||0)^(b[i]||0);return n===0}
let activeKDF=0;
export async function passwordHash(password,salt=hex(crypto.getRandomValues(new Uint8Array(16)))){if(activeKDF>=2)fail(429,'인증 요청이 많아요. 잠시 후 다시 시도해주세요.');activeKDF++;try{let out=await argon2idAsync(password,fromHex(salt),{m:19456,t:2,p:1,dkLen:32,maxmem:40*1024*1024,asyncTick:10});let result='argon2id$v=19$m=19456,t=2,p=1$'+salt+'$'+hex(out);out.fill(0);return result}finally{activeKDF--}}
async function passwordCheck(password,stored){let parts=stored?.split('$');if(parts?.length!==5||parts[0]!=='argon2id'||parts[2]!=='m=19456,t=2,p=1')return false;let calculated=await passwordHash(password,parts[3]);return equal(encoder.encode(calculated),encoder.encode(stored))}
const passwordValid=p=>typeof p==='string'&&p.length>=8&&p.length<=128&&encoder.encode(p).length<=512;
const handleValid=h=>typeof h==='string'&&/^[a-z][a-z0-9_.]{2,23}$/.test(h);
const codeValid=c=>typeof c==='string'&&/^\d{8}$/.test(c);
function authJSON(v,status=200,cookie){return new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, private','x-content-type-options':'nosniff',vary:'Cookie',...(cookie?{'set-cookie':cookie}:{})}})}
function cookieValue(token,age=IDLE/1000){return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(0,Math.floor(age))}`}
const tokenFrom=req=>req.headers.get('cookie')?.match(/(?:^|;\s*)__Host-muse_session=([a-f0-9]{64})(?:;|$)/)?.[1];
async function session(req,env){let token=tokenFrom(req);if(!token)return null;return env.DB.prepare('SELECT s.*,m.active,m.role,u.handle FROM auth_sessions s JOIN beta_members m ON m.user_id=s.user_id JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>? AND s.absolute_expires>? AND m.active=1').bind(await digest(token),Date.now(),Date.now()).first()}
async function createSession(db,uid,{mfaVerifiedAt=0}={}){let token=random(),now=Date.now();await db.prepare('INSERT INTO auth_sessions(token_hash,user_id,created,refreshed,expires,absolute_expires,mfa_verified_at) VALUES(?,?,?,?,?,?,?)').bind(await digest(token),uid,now,now,now+IDLE,now+ABSOLUTE,mfaVerifiedAt).run();return cookieValue(token)}
async function rate(db,key,limit,period){let bucket=Math.floor(Date.now()/period)*period,k=await digest(key),row=await db.prepare('INSERT INTO auth_rates(key,bucket,count) VALUES(?,?,1) ON CONFLICT(key,bucket) DO UPDATE SET count=count+1 RETURNING count').bind(k,bucket).first();if(row.count>limit)fail(429,'시도가 너무 많아요. 잠시 후 다시 시도해주세요.')}
function writeGuard(req){if(req.headers.get('origin')!==new URL(req.url).origin||req.headers.get('sec-fetch-site')==='cross-site')fail(403,'허용되지 않은 요청이에요.');if(!req.headers.get('content-type')?.startsWith('application/json'))fail(415,'JSON 요청만 허용돼요.')}
async function readAuth(req){try{return JSON.parse(new TextDecoder().decode(await readBytes(req,4096)))}catch(e){if(e.status)throw e;fail(400,'입력을 확인해주세요.')}}
// Only Sites-verified identity may link an existing account; ordinary native requests discard it.
async function legacyCandidate(req,db){let uid=req.headers.get('oai-authenticated-user-id');return uid?db.prepare('SELECT u.* FROM users u JOIN beta_members m ON m.user_id=u.id LEFT JOIN auth_credentials c ON c.user_id=u.id WHERE u.id=? AND m.active=1 AND c.user_id IS NULL').bind(uid).first():null}
export async function nativeAuth(req,env){if(!env.DB)fail(503,'저장소가 연결되지 않았어요.');let url=new URL(req.url),p=url.pathname,db=env.DB,s=await session(req,env),q=(sql,...v)=>db.prepare(sql).bind(...v),ip=req.headers.get('cf-connecting-ip')||'unknown';
await provisionTestAdmin(env,{hashPassword:passwordHash,digest});
if(p.startsWith('/api/auth/')){if(p.startsWith('/api/auth/admin-bootstrap')&&env.MUSE_TEST_ADMIN_PASSWORD_ONLY==='true')fail(410,'테스트 관리자 계정은 일반 로그인 화면에서 이용해주세요.');
 if(p==='/api/auth/admin-bootstrap'&&req.method==='GET')return{response:await bootstrapAdmin(req,env,{path:p,rate,hashPassword:passwordHash,digest,createSession,respond:authJSON})};
 if(req.method==='GET'&&p==='/api/auth/options'){let legacy=env.MUSE_LEGACY_LINK==='sites'?await legacyCandidate(req,db):null;return{response:authJSON({mode:'native',legacy:legacy?{handle:legacy.handle,code:legacy.code}:null})}}
 if(req.method==='GET'&&p==='/api/auth/available'){await rate(db,'availability:'+ip,120,60000);let h=url.searchParams.get('handle'),c=url.searchParams.get('code');return{response:authJSON({handle:h===null?null:h!==SUPER_ADMIN_HANDLE&&handleValid(h)&&!await q('SELECT 1 FROM users WHERE handle=?',h).first(),code:c===null?null:codeValid(c)&&!await q('SELECT 1 FROM users WHERE code=?',c).first()})}}
 if(req.method!=='POST')fail(405,'허용되지 않은 방식이에요.');writeGuard(req);let b=await readAuth(req);
 if(p.startsWith('/api/auth/admin-bootstrap/'))return{response:await bootstrapAdmin(req,env,{path:p,body:b,rate,hashPassword:passwordHash,digest,createSession,respond:authJSON})};
 await q('DELETE FROM auth_sessions WHERE expires<? OR absolute_expires<?',Date.now(),Date.now()).run();
 await q('DELETE FROM auth_rates WHERE bucket<?',Date.now()-2*DAY).run();
 if(p==='/api/auth/logout'){if(s)await q('DELETE FROM auth_sessions WHERE token_hash=?',s.token_hash).run();return{response:authJSON({ok:true},200,cookieValue('',0))}}
 if(p==='/api/auth/admin-mfa'||p==='/api/auth/admin-reauth'){if(!s||s.role!=='super_admin')fail(403,'관리자 인증 세션이 필요해요.');await rate(db,'admin-auth:'+s.user_id,5,900000);if(p.endsWith('reauth')){let credential=await q('SELECT password_hash FROM auth_credentials WHERE user_id=?',s.user_id).first();if(typeof b.password!=='string'||b.password.length>128||!await passwordCheck(b.password,credential.password_hash))fail(403,'비밀번호를 확인해주세요.')}await consumeAdminCode(db,s.user_id,b.code,env);let now=Date.now();if(p==='/api/auth/admin-mfa'){let cookie=await createSession(db,s.user_id,{mfaVerifiedAt:now});await q('DELETE FROM auth_sessions WHERE token_hash=?',s.token_hash).run();await q('INSERT INTO audit_events(id,actor,kind,created) VALUES(?,?,?,?)',id(),s.user_id,'admin_mfa_verified',now).run();return{response:authJSON({ok:true},200,cookie)}}await q('UPDATE auth_sessions SET mfa_verified_at=?,admin_verified_until=? WHERE token_hash=?',now,p.endsWith('reauth')?now+300000:0,s.token_hash).run();await q('INSERT INTO audit_events(id,actor,kind,created) VALUES(?,?,?,?)',id(),s.user_id,p.endsWith('reauth')?'admin_reauthenticated':'admin_mfa_verified',now).run();return{response:authJSON({ok:true,verifiedUntil:p.endsWith('reauth')?now+300000:0})}}
 if(p==='/api/auth/register'||p==='/api/auth/migrate'){if(b.handle===SUPER_ADMIN_HANDLE)fail(409,'관리자 전용 ID예요. 일반 회원가입에 사용할 수 없어요.');
 await rate(db,'register:'+ip,10,3600000);
 if(!handleValid(b.handle)||!codeValid(b.code)||!passwordValid(b.password)||b.password!==b.confirm)fail(400,'아이디(3~24자), 비밀번호(8~128자)와 확인, 숫자 8자리를 확인해주세요.');
 if(b.agree!==true||b.privacyVersion!==privacyVersion)fail(400,'개인정보 처리 안내를 확인해주세요.');
 let old=p.endsWith('/migrate')&&env.MUSE_LEGACY_LINK==='sites'?await legacyCandidate(req,db):null;if(p.endsWith('/migrate')&&!old)fail(403,'기존 계정 인증이 필요해요.');
 if(await q('SELECT 1 FROM users WHERE (handle=? OR code=?) AND id<>?',b.handle,b.code,old?.id||'').first())fail(409,'이미 사용 중인 아이디 또는 개인 식별 번호예요.');let uid=old?.id||id(),recovery=random(),pw=await passwordHash(b.password),rh=await digest(recovery);
 try{await db.batch([
 ...(old?[q('UPDATE users SET handle=?,code=? WHERE id=?',b.handle,b.code,uid)]:[q('INSERT INTO users(id,name,handle,code,last_seen) VALUES(?,?,?,?,?)',uid,b.handle,b.handle,b.code,Date.now()),q('INSERT INTO beta_members(user_id,role,joined,privacy_version) VALUES(?,?,?,?)',uid,'member',Date.now(),privacyVersion),q('INSERT INTO board_drafts(owner,board,updated) VALUES(?,?,?)',uid,JSON.stringify(emptyBoard()),Date.now())]),
 q('INSERT INTO auth_credentials(user_id,password_hash,recovery_hash,updated) VALUES(?,?,?,?)',uid,pw,rh,Date.now()),q('INSERT INTO audit_events(id,actor,kind,created) VALUES(?,?,?,?)',id(),uid,old?'native_migrated':'account_created',Date.now())
 ])}catch(e){if(/UNIQUE/i.test(e.message))fail(409,'이미 사용 중인 아이디 또는 개인 식별 번호예요.');throw e}
 return{response:authJSON({ok:true,recoveryCode:recovery},201,await createSession(db,uid))};
 }
 if(p==='/api/auth/login'){
 await rate(db,'login-ip:'+ip,60,900000);let handle=typeof b.handle==='string'?b.handle:'';await rate(db,'login-id:'+handle,10,900000);
 if(!handleValid(handle)||typeof b.password!=='string'||b.password.length>128)fail(401,'아이디 또는 비밀번호를 확인해주세요.');
 let u=await q('SELECT u.id,c.password_hash FROM users u JOIN auth_credentials c ON c.user_id=u.id JOIN beta_members m ON m.user_id=u.id WHERE u.handle=? AND m.active=1',handle).first();
 // Unknown IDs pay the same KDF cost to avoid a fast account-existence oracle.
 let valid=u?await passwordCheck(b.password,u.password_hash):(await passwordHash(b.password),false);if(!valid)fail(401,'아이디 또는 비밀번호를 확인해주세요.');
 return{response:authJSON({ok:true},200,await createSession(db,u.id))};
 }
 if(p==='/api/auth/recover'){
 await rate(db,'recover-ip:'+ip,10,3600000);let handle=String(b.handle||'');await rate(db,'recover-id:'+handle,5,3600000);
 if(!handleValid(handle)||!passwordValid(b.password)||b.password!==b.confirm||!/^([a-f0-9]{64})$/.test(b.recoveryCode||''))fail(400,'복구 정보를 확인해주세요.');
 let u=await q('SELECT c.* FROM auth_credentials c JOIN users u ON u.id=c.user_id JOIN beta_members m ON m.user_id=u.id WHERE u.handle=? AND m.active=1',handle).first();let rh=await digest(b.recoveryCode);if(!u||!equal(encoder.encode(rh),encoder.encode(u.recovery_hash)))fail(400,'복구 정보를 확인해주세요.');
 let recovery=random(),pw=await passwordHash(b.password);let changed=await q('UPDATE auth_credentials SET password_hash=?,recovery_hash=?,updated=? WHERE user_id=? AND recovery_hash=? RETURNING user_id',pw,await digest(recovery),Date.now(),u.user_id,rh).first();if(!changed)fail(409,'이미 사용한 복구 코드예요.');await q('DELETE FROM auth_sessions WHERE user_id=?',u.user_id).run();return{response:authJSON({ok:true,recoveryCode:recovery},200,await createSession(db,u.user_id))};
 }
 if(p==='/api/auth/password'){if(s?.role==='super_admin'&&!passwordOnlyTestAdmin(s,env))requireStepUp(s);
 if(!s)fail(401,'로그인이 필요해요.');await rate(db,'password:'+s.user_id,5,900000);let u=await q('SELECT * FROM auth_credentials WHERE user_id=?',s.user_id).first();if(!passwordValid(b.password)||b.password!==b.confirm||typeof b.current!=='string'||b.current.length>128||!await passwordCheck(b.current,u.password_hash))fail(400,'현재 비밀번호와 새 비밀번호를 확인해주세요.');let recovery=random(),pw=await passwordHash(b.password);await db.batch([q('UPDATE auth_credentials SET password_hash=?,recovery_hash=?,updated=? WHERE user_id=?',pw,await digest(recovery),Date.now(),s.user_id),q('DELETE FROM auth_sessions WHERE user_id=?',s.user_id)]);return{response:authJSON({ok:true,recoveryCode:recovery},200,await createSession(db,s.user_id))};
 }
 fail(404,'없는 인증 경로예요.');
}
if(s?.role==='super_admin'&&!passwordOnlyTestAdmin(s,env)&&!s.mfa_verified_at){if(p==='/api/session')return{response:authJSON({authenticated:true,member:false,mfaRequired:true})};fail(403,'관리자 인증 앱 코드 확인이 필요해요.')}
if(s&&isAdmin(s.role)&&!passwordOnlyTestAdmin(s,env)&&p.startsWith('/api/admin/')&&req.method!=='GET')requireStepUp(s);
if(p==='/api/events'&&req.method==='GET'){if(!s)fail(401,'로그인이 필요해요.');return{response:eventStream(req,env,s.user_id,s.token_hash)}}
let headers=new Headers(req.headers);for(let k of [...headers.keys()])if(k.startsWith('oai-authenticated-'))headers.delete(k);let renewed=null;if(s){headers.set('oai-authenticated-user-id',s.user_id);if(Date.now()-s.refreshed>DAY){let expires=Math.min(Date.now()+IDLE,s.absolute_expires);await q('UPDATE auth_sessions SET refreshed=?,expires=? WHERE token_hash=? AND expires>?',Date.now(),expires,s.token_hash,Date.now()).run();renewed=cookieValue(tokenFrom(req),(expires-Date.now())/1000)}}
return{request:new Request(req,{headers}),session:s,cookie:renewed};}
export async function finishAuth(response,ctx){if(ctx.session&&new URL(ctx.request.url).pathname==='/api/account/delete'&&response.ok){ctx.cookie=cookieValue('',0)}if(!ctx.cookie)return response;let headers=new Headers(response.headers);headers.set('set-cookie',ctx.cookie);return new Response(response.body,{status:response.status,headers})}
