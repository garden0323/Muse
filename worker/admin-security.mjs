import {fail,id} from './api.mjs';
import {emptyBoard,privacyVersion} from './beta.mjs';
export const SUPER_ADMIN_HANDLE='muse.admin';
const enc=new TextEncoder(),alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes){let bits=0,value=0,out='';for(const b of bytes){value=(value<<8)|b;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5}}if(bits)out+=alphabet[(value<<(5-bits))&31];return out}
function unbase32(text){let bits=0,value=0,out=[];for(const ch of text){let n=alphabet.indexOf(ch);if(n<0)throw Error('invalid secret');value=(value<<5)|n;bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8}}return new Uint8Array(out)}
const b64=bytes=>btoa(String.fromCharCode(...bytes)),unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function key(env){if(!env.ADMIN_TOTP_ENCRYPTION_KEY)fail(503,'관리자 보안 저장소 설정이 필요해요.');let bytes=unb64(env.ADMIN_TOTP_ENCRYPTION_KEY);if(bytes.length!==32)fail(503,'관리자 보안 저장소 설정을 확인해주세요.');return crypto.subtle.importKey('raw',bytes,{name:'AES-GCM'},false,['encrypt','decrypt'])}
export async function encryptSecret(secret,uid,env){let iv=crypto.getRandomValues(new Uint8Array(12));let encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(uid)},await key(env),enc.encode(secret));return b64(iv)+'.'+b64(new Uint8Array(encrypted))}
export async function decryptSecret(value,uid,env){let [iv,data]=value.split('.');return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv),additionalData:enc.encode(uid)},await key(env),unb64(data)))}
export async function totp(secret,counter){const bytes=new Uint8Array(8),view=new DataView(bytes.buffer);view.setBigUint64(0,BigInt(counter));let k=await crypto.subtle.importKey('raw',unbase32(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);let mac=new Uint8Array(await crypto.subtle.sign('HMAC',k,bytes)),offset=mac[mac.length-1]&15;let value=((mac[offset]&127)<<24)|(mac[offset+1]<<16)|(mac[offset+2]<<8)|mac[offset+3];return String(value%1000000).padStart(6,'0')}
async function matchCode(secret,code){if(typeof code!=='string'||!/^\d{6}$/.test(code))return null;let current=Math.floor(Date.now()/30000);for(const offset of [0,-1,1]){let counter=current+offset;if(await totp(secret,counter)===code)return counter}return null}
export async function consumeAdminCode(db,uid,code,env){let security=await db.prepare('SELECT * FROM admin_security WHERE user_id=?').bind(uid).first();if(!security)fail(403,'관리자 추가 인증 설정이 필요해요.');let counter=await matchCode(await decryptSecret(security.secret_cipher,uid,env),code);if(counter===null)fail(403,'인증 앱 코드를 확인해주세요.');let used=await db.prepare('UPDATE admin_security SET last_counter=? WHERE user_id=? AND last_counter<? RETURNING user_id').bind(counter,uid,counter).first();if(!used)fail(403,'이미 사용한 코드예요. 인증 앱의 다음 코드를 입력해주세요.')}
export const isAdmin=role=>['admin','super_admin'].includes(role);
export function requireStepUp(s){if(!s||!s.mfa_verified_at||!(s.admin_verified_until>Date.now()))fail(403,'관리 작업 전 비밀번호와 인증 앱 코드로 재인증해주세요.')}
function owner(req,env){let uid=req.headers.get('oai-authenticated-user-id'),email=req.headers.get('oai-authenticated-user-email');if(env.MUSE_LEGACY_LINK!=='sites'||!uid||!env.BETA_ADMIN_EMAIL||email?.toLowerCase()!==env.BETA_ADMIN_EMAIL.toLowerCase())fail(403,'최초 관리자 설정은 사이트 소유자만 할 수 있어요.');return uid}
export async function bootstrapAdmin(req,env,{path,body,rate,hashPassword,digest,createSession,respond}){
 const db=env.DB,uid=owner(req,env),q=(sql,...values)=>db.prepare(sql).bind(...values);
 if(await q("SELECT 1 FROM beta_members WHERE role='super_admin'").first())fail(409,'최고 관리자 설정이 이미 완료됐어요.');
 if(await q('SELECT 1 FROM users WHERE handle=?',SUPER_ADMIN_HANDLE).first())fail(409,'지정한 ID가 이미 존재해요. 소유권 확인 없이 권한을 변경하지 않습니다.');
 if(path==='/api/auth/admin-bootstrap'&&req.method==='GET')return respond({handle:SUPER_ADMIN_HANDLE,available:true});
 if(req.method!=='POST')fail(405,'허용되지 않은 방식이에요.');
 await rate(db,'bootstrap:'+uid,10,3600000);
 if(path==='/api/auth/admin-bootstrap/start'){
 let challenge=id(),secret=base32(crypto.getRandomValues(new Uint8Array(20))),expires=Date.now()+600000;
 await q('DELETE FROM admin_setup_challenges WHERE owner_id=? OR expires<?',uid,Date.now()).run();
 await q('INSERT INTO admin_setup_challenges(id,owner_id,secret_cipher,expires) VALUES(?,?,?,?)',challenge,uid,await encryptSecret(secret,challenge,env),expires).run();
 return respond({challengeId:challenge,secret,expires,handle:SUPER_ADMIN_HANDLE});
 }
 if(path!=='/api/auth/admin-bootstrap/complete')fail(404,'없는 설정 경로예요.');
 if(typeof body.password!=='string'||body.password.length<12||body.password.length>128||enc.encode(body.password).length>512||body.password!==body.confirm)fail(400,'비밀번호는 12~128자로 입력하고 확인해주세요.');
 if(body.agree!==true)fail(400,'개인정보 처리 안내를 확인해주세요.');
 let challenge=await q('SELECT * FROM admin_setup_challenges WHERE id=? AND owner_id=? AND expires>?',body.challengeId||'',uid,Date.now()).first();if(!challenge)fail(403,'설정 시간이 만료됐어요. 인증 앱 등록을 다시 시작해주세요.');
 let secret=await decryptSecret(challenge.secret_cipher,challenge.id,env),counter=await matchCode(secret,body.code);if(counter===null)fail(403,'인증 앱의 6자리 코드를 확인해주세요.');
 let userId=id(),recovery=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join(''),publicCode;
 for(let tries=0;tries<20;tries++){publicCode=String(crypto.getRandomValues(new Uint32Array(1))[0]%100000000).padStart(8,'0');if(!await q('SELECT 1 FROM users WHERE code=?',publicCode).first())break}
 const pw=await hashPassword(body.password),recoveryHash=await digest(recovery),cipher=await encryptSecret(secret,userId,env),now=Date.now();
 try{await db.batch([
 q('INSERT INTO users(id,name,handle,code,last_seen) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM admin_setup_challenges WHERE id=? AND owner_id=? AND expires>?)',userId,'MUSE 최고 관리자',SUPER_ADMIN_HANDLE,publicCode,now,challenge.id,uid,now),
 q("INSERT INTO beta_members(user_id,role,joined,privacy_version) VALUES(?,'super_admin',?,?)",userId,now,privacyVersion),
 q('INSERT INTO auth_credentials(user_id,password_hash,recovery_hash,updated) VALUES(?,?,?,?)',userId,pw,recoveryHash,now),
 q('INSERT INTO admin_security(user_id,secret_cipher,last_counter,enabled_at) VALUES(?,?,?,?)',userId,cipher,counter,now),
 q('INSERT INTO board_drafts(owner,board,updated) VALUES(?,?,?)',userId,JSON.stringify(emptyBoard()),now),
 q('DELETE FROM admin_setup_challenges WHERE owner_id=?',uid),
 q('INSERT INTO audit_events(id,actor,kind,created) VALUES(?,?,?,?)',id(),userId,'super_admin_created',now)
 ])}catch(e){if(/FOREIGN KEY/.test(e.message))fail(403,'설정 시간이 만료됐거나 다른 탭에서 등록 키를 새로 만들었어요. 다시 시작해주세요.');if(/UNIQUE/.test(e.message))fail(409,'다른 설정이 먼저 완료됐어요. 기존 계정 권한은 변경하지 않았어요.');throw e}
 return respond({ok:true,recoveryCode:recovery},201,await createSession(db,userId,{mfaVerifiedAt:now}));
}

// Explicitly enabled by the Site operator for this disposable test server only.
export const passwordOnlyTestAdmin=(session,env)=>env.MUSE_TEST_ADMIN_PASSWORD_ONLY==='true'&&session?.role==='super_admin'&&session?.handle===SUPER_ADMIN_HANDLE;
export async function provisionTestAdmin(env,{hashPassword,digest}){
 if(env.MUSE_TEST_ADMIN_PASSWORD_ONLY!=='true'||!env.TEST_ADMIN_BOOTSTRAP_PASSWORD)return;
 const db=env.DB,q=(sql,...values)=>db.prepare(sql).bind(...values);
 const existing=await q('SELECT u.id,m.role FROM users u LEFT JOIN beta_members m ON m.user_id=u.id WHERE u.handle=?',SUPER_ADMIN_HANDLE).first();
 if(existing){if(existing.role!=='super_admin')fail(409,'지정한 ID가 이미 존재해요. 자동으로 관리자 권한을 부여하지 않습니다.');return}
 if(await q("SELECT 1 FROM beta_members WHERE role='super_admin'").first())fail(409,'다른 최고 관리자 계정이 이미 존재해요.');
 const password=env.TEST_ADMIN_BOOTSTRAP_PASSWORD;
 if(typeof password!=='string'||password.length<12||password.length>128)fail(503,'테스트 관리자 비밀 설정을 확인해주세요.');
 let uid=id(),code;for(let i=0;i<20;i++){code=String(crypto.getRandomValues(new Uint32Array(1))[0]%100000000).padStart(8,'0');if(!await q('SELECT 1 FROM users WHERE code=?',code).first())break}
 const passwordHash=await hashPassword(password),unusedRecovery=base32(crypto.getRandomValues(new Uint8Array(32))),recoveryHash=await digest(unusedRecovery),now=Date.now();
 try{await db.batch([
 q('INSERT INTO users(id,name,handle,code,last_seen) VALUES(?,?,?,?,?)',uid,'MUSE 최고 관리자',SUPER_ADMIN_HANDLE,code,now),
 q("INSERT INTO beta_members(user_id,role,joined,privacy_version) VALUES(?,'super_admin',?,?)",uid,now,privacyVersion),
 q('INSERT INTO auth_credentials(user_id,password_hash,recovery_hash,updated) VALUES(?,?,?,?)',uid,passwordHash,recoveryHash,now),
 q('INSERT INTO board_drafts(owner,board,updated) VALUES(?,?,?)',uid,JSON.stringify(emptyBoard()),now),
 q('INSERT INTO audit_events(id,actor,kind,created) VALUES(?,?,?,?)',id(),uid,'test_super_admin_created',now)
 ])}catch(e){if(/UNIQUE/.test(e.message)){let won=await q("SELECT 1 FROM users u JOIN beta_members m ON m.user_id=u.id WHERE u.handle=? AND m.role='super_admin'",SUPER_ADMIN_HANDLE).first();if(won)return;fail(409,'관리자 ID 또는 권한이 다른 계정과 충돌해요.')}throw e}
}
