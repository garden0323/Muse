import Stickers from '../dist/sticker-catalog.js';
const stickerIds=new Set(Stickers.items.map(s=>s.id));
import Drawing from '../dist/drawing-core.js';
import {fail,id,protectedObject} from './api.mjs';
import {seoulDay,visitRanks,memberBadges} from './visit-ranks.mjs';
import {normalizeMusic,uploadGalleryAudio,serveGalleryAudio} from './gallery-audio.mjs';
export const privacyVersion='2026-11-10-v1';
const isAdminRole=role=>role==='admin'||role==='super_admin';
const bj=(v,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, private','x-content-type-options':'nosniff','vary':'Cookie'}});
export function emptyBoard(){return{schema:2,world:{w:6000,h:4000},items:[],background:{color:'#f3f0e3',pattern:'dots',image:null},start:{x:3000,y:2000,z:1},cover:{x:2500,y:1650,w:1000,h:700},music:{track:'none',volume:.25}}}
export async function readBytes(req,max){const reader=req.body?.getReader();if(!reader)return new Uint8Array();let parts=[],size=0;while(true){let r=await reader.read();if(r.done)break;size+=r.value.length;if(size>max){await reader.cancel();fail(413,'업로드 크기 제한을 초과했어요.')}parts.push(r.value)}let out=new Uint8Array(size),n=0;for(let p of parts){out.set(p,n);n+=p.length}return out}
async function hash(v){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),v=>v.toString(16).padStart(2,'0')).join('')}
export async function membership(req,env){let uid=req.headers.get('oai-authenticated-user-id');return uid?env.DB.prepare('SELECT * FROM beta_members WHERE user_id=? AND active=1').bind(uid).first():null}
export async function isHiddenAdmin(db,target,viewer){return target!==viewer&&!!await db.prepare("SELECT 1 FROM beta_members WHERE user_id=? AND role IN('admin','super_admin')").bind(target).first()}
export async function isBlocked(db,a,b){return !!await db.prepare('SELECT 1 FROM blocks WHERE (actor=? AND target=?) OR (actor=? AND target=?)').bind(a,b,b,a).first()}
export async function isMutual(db,a,b){return a===b||!await isBlocked(db,a,b)&&!!await db.prepare('SELECT 1 FROM follows f JOIN follows g ON f.actor=g.target AND f.target=g.actor WHERE f.actor=? AND f.target=?').bind(a,b).first()}
async function profile(db,uid){let u=await db.prepare('SELECT u.*,(SELECT COUNT(*) FROM follows WHERE actor=u.id) following_count,(SELECT COUNT(*) FROM follows WHERE target=u.id) follower_count FROM users u WHERE id=?').bind(uid).first();return u&&{id:u.id,name:u.name,handle:u.handle,code:u.code,bio:u.bio,gallery:u.gallery_title,receipts:!!u.receipts,online:!!u.online&&Date.now()-u.last_seen<45000,followingCount:u.following_count,followerCount:u.follower_count}}
export async function validateBoard(b,uid,env){if(b?.schema!==2||b.world?.w!==6000||b.world?.h!==4000||!Array.isArray(b.items)||b.items.length>1000||!b.background||!b.start||!b.cover||JSON.stringify(b).length>900000)fail(400,'보드 데이터 형식·용량을 확인하세요.');let sources=[b.background.image],ids=new Set(),vectorPoints=0;for(let o of b.items){if(!['photo','text','sticker','mask','drawing'].includes(o.type)||typeof o.id!=='string'||ids.has(o.id)||o.id.length>100||typeof o.content!=='string'||o.content.length>10000||!o.style)fail(400,'올바르지 않은 전시품이에요.');ids.add(o.id);for(let k of ['x','y','w','h','r','z'])if(!Number.isFinite(o[k]))fail(400,'좌표가 올바르지 않아요.');if(o.x<0||o.y<0||o.w<40||o.h<40||o.x+o.w>6000||o.y+o.h>4000)fail(400,'보드 경계를 벗어난 전시품이에요.');if(o.type==='sticker'&&o.content.startsWith('muse-sticker:')&&!stickerIds.has(o.content.slice(13)))fail(400,'지원하지 않는 스티커예요.');if(o.type==='drawing'){try{o.drawing=Drawing.validate(o.drawing);vectorPoints+=o.drawing.points.length;if(vectorPoints>30000)fail(400,'그림이 많아요. 일부 선을 정리한 뒤 저장해주세요.')}catch(e){fail(400,e.message)}}if(o.type==='photo')sources.push(o.content);const st=o.style,num=(v,d,min,max)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):d;o.style={ink:/^#[a-f0-9]{6}$/i.test(st.ink)?st.ink:'#586044',paper:/^#[a-f0-9]{6}$/i.test(st.paper)?st.paper:'#e6e9c9',font:['sans-serif','serif','cursive'].includes(st.font)?st.font:'sans-serif',align:['left','center','right'].includes(st.align)?st.align:'left',frame:['none','polaroid','film','paper','diary','wood-frame'].includes(st.frame)?st.frame:'none',fontSize:num(st.fontSize,24,4,200),radius:num(st.radius,5,0,80),border:num(st.border,0,0,16),opacity:num(st.opacity,100,10,100),shadow:!!st.shadow,unit:num(st.unit,1,.05,2)};o.caption=String(o.caption||'').slice(0,200)}for(let k of ['x','y','z'])if(!Number.isFinite(b.start[k]))fail(400,'시작 위치가 올바르지 않아요.');if(b.start.z<.2||b.start.z>2)fail(400,'확대 비율이 올바르지 않아요.');for(let k of ['x','y','w','h'])if(!Number.isFinite(b.cover[k]))fail(400,'대표 영역이 올바르지 않아요.');if(b.cover.x<0||b.cover.y<0||b.cover.w<=0||b.cover.h<=0||b.cover.x+b.cover.w>6000||b.cover.y+b.cover.h>4000)fail(400,'대표 영역이 보드 밖에 있어요.');if(!/^#[a-f0-9]{6}$/i.test(b.background.color)||!['none','dots','grid'].includes(b.background.pattern))fail(400,'배경 설정이 올바르지 않아요.');for(let src of sources.filter(Boolean)){if(/^assets\/(forest|sea|city|room|flowers)\.jpg$/.test(src))continue;let mid=src.match(/^\/api\/media\/([a-f0-9-]{36})$/)?.[1];if(!mid||!await env.DB.prepare("SELECT 1 FROM media WHERE id=? AND owner=? AND state='ready' AND mime LIKE 'image/%'").bind(mid,uid).first())fail(403,'본인이 업로드한 사진만 저장할 수 있어요.')}if(b.music)b.music=await normalizeMusic(b.music,uid,env.DB);return b}
async function stats(db,gid){let day=seoulDay();return{total:(await db.prepare('SELECT COALESCE(SUM(visit_count),0) n FROM visits WHERE gallery_id=?').bind(gid).first()).n,today:(await db.prepare('SELECT COALESCE(SUM(visit_count),0) n FROM visits WHERE gallery_id=? AND day=?').bind(gid,day).first()).n,live:(await db.prepare('SELECT COUNT(DISTINCT visitor) n FROM visits WHERE gallery_id=? AND last_seen>?').bind(gid,Date.now()-45000).first()).n}}
export async function betaDispatch(req,env){let url=new URL(req.url),p=url.pathname,method=req.method,uid=req.headers.get('oai-authenticated-user-id'),db=env.DB;if(!db)fail(503,'저장소가 연결되지 않았어요.');let expected=req.headers.get('x-muse-account');if(expected&&expected!==uid)fail(401,'로그인 계정이 변경되었어요. 새로고침해주세요.');const q=(s,...v)=>db.prepare(s).bind(...v),one=(s,...v)=>q(s,...v).first(),all=async(s,...v)=>(await q(s,...v).all()).results,body=async()=>{try{return JSON.parse(new TextDecoder().decode(await readBytes(req,1100000)))}catch(e){if(e.status)throw e;fail(400,'올바른 JSON이 아니에요.')}};
if(method!=='GET'&&!(method==='HEAD'&&p.startsWith('/api/audio/'))){if(req.headers.get('origin')!==url.origin)fail(403,'허용되지 않은 요청이에요.');if(!['/api/uploads','/api/audio'].includes(p)&&!req.headers.get('content-type')?.startsWith('application/json'))fail(415,'JSON 요청만 허용돼요.')}
if(p==='/api/session'&&method==='GET'){let m=await membership(req,env);return bj({authenticated:!!uid,member:!!m,user:m?await profile(db,uid):null,role:m?.role,adminPasswordOnly:env.MUSE_TEST_ADMIN_PASSWORD_ONLY==='true'&&m?.role==='super_admin',privacyVersion,testing:!!env.LOCAL_PREVIEW,ownerEligible:!!env.BETA_ADMIN_EMAIL&&req.headers.get('oai-authenticated-user-email')?.toLowerCase()===env.BETA_ADMIN_EMAIL.toLowerCase()})}
if(p==='/api/auth/join'&&method==='POST'){if(!uid)fail(401,'먼저 ChatGPT로 로그인하세요.');let b=await body(),old=await one('SELECT * FROM beta_members WHERE user_id=?',uid);if(old){if(!old.active)fail(403,'이용이 중지된 계정이에요.');return bj({ok:true})}if(b.agree!==true||b.privacyVersion!==privacyVersion)fail(400,'개인정보 안내를 확인하고 가입해주세요.');let owner=!!env.BETA_ADMIN_EMAIL&&req.headers.get('oai-authenticated-user-email')?.toLowerCase()===env.BETA_ADMIN_EMAIL.toLowerCase(),invite=null;if(!owner){let attempts=await one("SELECT COUNT(*) n FROM audit_events WHERE actor=? AND kind='invite_attempt' AND created>?",uid,Date.now()-60000);if(attempts.n>=10)fail(429,'잠시 후 다시 시도해주세요.');await q('INSERT INTO audit_events(id,actor,kind,created) VALUES(?,?,?,?)',id(),uid,'invite_attempt',Date.now()).run();invite=await one('SELECT * FROM beta_invites WHERE token_hash=? AND revoked=0 AND uses=0 AND expires>?',await hash(String(b.invite||'')),Date.now());if(!invite)fail(403,'사용할 수 없는 초대 코드예요.')}let name=String(b.name||'').trim().slice(0,25),handle=String(b.handle||'').toLowerCase();if(!name||!/^([a-z][a-z0-9_.]{2,23})$/.test(handle))fail(400,'이름과 영문 아이디(3~24자)를 확인하세요.');let code;for(let i=0;i<20;i++){code=String(crypto.getRandomValues(new Uint32Array(1))[0]%100000000).padStart(8,'0');if(!await one('SELECT 1 FROM users WHERE code=?',code))break}try{await db.batch([q('INSERT INTO users(id,name,handle,code,last_seen) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,handle=excluded.handle,code=COALESCE(users.code,excluded.code)',uid,name,handle,code,Date.now()),q('INSERT INTO beta_members(user_id,role,invite_id,joined,privacy_version) VALUES(?,?,?,?,?)',uid,owner?'admin':'member',invite?.id||null,Date.now(),privacyVersion),q('INSERT OR IGNORE INTO board_drafts(owner,board,updated) VALUES(?,?,?)',uid,JSON.stringify(emptyBoard()),Date.now())])}catch(e){if(/BETA_FULL|INVITE_INVALID|UNIQUE/.test(e.message))fail(409,'정원이 찼거나 아이디·초대 코드를 사용할 수 없어요.');throw e}return bj({ok:true},201)}
let member=await membership(req,env);if(!uid)fail(401,'로그인이 만료되었어요.');if(!member)fail(403,'초대 가입을 완료하거나 이용 상태를 확인해주세요.');
if(p==='/api/audio'&&method==='POST')return bj(await uploadGalleryAudio(req,env,uid),201);
const audioMatch=p.match(/^\/api\/audio\/([a-f0-9-]{36})$/);
if(audioMatch&&['GET','HEAD'].includes(method))return serveGalleryAudio(req,env,uid,audioMatch[1]);
if(p==='/api/visit-rankings'&&method==='GET'){
 const ranks=await visitRanks(db);
 const users=await all(`
   SELECT u.id,u.name,
     (SELECT COALESCE(SUM(visit_count),0) FROM visits WHERE gallery_id=g.id AND visitor<>g.owner) AS total,
     (SELECT COALESCE(SUM(visit_count),0) FROM visits WHERE gallery_id=g.id AND visitor<>g.owner AND day=?) AS daily
   FROM json_each(?) winner
   JOIN galleries g ON g.owner=winner.key
   JOIN users u ON u.id=g.owner
   JOIN beta_members m ON m.user_id=u.id AND m.active=1 AND m.role NOT IN ('admin','super_admin')
   WHERE NOT EXISTS (SELECT 1 FROM blocks WHERE actor=? AND target=u.id)
     AND NOT EXISTS (SELECT 1 FROM blocks WHERE actor=u.id AND target=?)
   ORDER BY u.name COLLATE NOCASE,u.id
 `,ranks.day,JSON.stringify(ranks.badges),uid,uid);
 const entries=kind=>users.filter(u=>ranks.badges[u.id][kind]!==null).map(u=>({
   id:u.id,name:u.name,rank:ranks.badges[u.id][kind],visits:u[kind]
 })).sort((a,b)=>a.rank-b.rank);
 return bj({day:ranks.day,total:entries('total'),daily:entries('daily')});
}
const rankProfile=p.match(/^\/api\/profiles\/([^/]+)\/visit-ranks$/);
if(rankProfile&&method==='GET'){
 const target=decodeURIComponent(rankProfile[1]);
 if(!await one("SELECT 1 FROM beta_members WHERE user_id=? AND active=1 AND (user_id=? OR role NOT IN ('admin','super_admin'))",target,uid) ||
    target!==uid&&await isBlocked(db,uid,target))fail(404,'사용자를 찾을 수 없어요.');
 const ranks=await visitRanks(db);
 return bj({rankDay:ranks.day,badges:memberBadges(ranks,target)});
}
const followList=p.match(/^\/api\/profiles\/([^/]+)\/(followers|following)$/);
if(followList&&method==='GET'){
 const target=decodeURIComponent(followList[1]);
 if(!await one('SELECT 1 FROM beta_members WHERE user_id=? AND active=1',target)
   ||await isHiddenAdmin(db,target,uid)||await isBlocked(db,uid,target))fail(404,'관장을 찾을 수 없어요.');
 const followers=followList[2]==='followers';
 const memberColumn=followers?'actor':'target',targetColumn=followers?'target':'actor';
 const users=await all(`SELECT u.id,u.name,u.handle
   FROM follows f JOIN users u ON u.id=f.${memberColumn} JOIN beta_members m ON m.user_id=u.id
   WHERE f.${targetColumn}=? AND m.active=1 AND (u.id=? OR m.role NOT IN ('admin','super_admin'))
   AND NOT EXISTS (SELECT 1 FROM blocks WHERE actor=? AND target=u.id)
   AND NOT EXISTS (SELECT 1 FROM blocks WHERE actor=u.id AND target=?)
   ORDER BY u.name COLLATE NOCASE,u.handle,u.id`,target,uid,uid,uid);
 return bj({users});
}
let guest=p.match(/^\/api\/guestbook\/([^/]+)$/);if(guest){let gid=decodeURIComponent(guest[1]);if(await isHiddenAdmin(db,gid,uid)||!await one('SELECT 1 FROM galleries WHERE id=?',gid)||await isBlocked(db,uid,gid))fail(404,'전시관이 없어요.');if(method==='GET')return bj({items:await all('SELECT g.id,g.author,g.body,g.created,u.name,u.handle FROM guestbook g JOIN users u ON u.id=g.author WHERE g.gallery_id=? AND NOT EXISTS(SELECT 1 FROM beta_members m WHERE m.user_id=g.author AND m.role IN(\'admin\',\'super_admin\') AND m.user_id<>?) AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.actor=? AND b.target=g.author) OR (b.actor=g.author AND b.target=?)) ORDER BY g.created DESC LIMIT 50',gid,uid,uid,uid)});if(method==='POST'){let b=await body(),text=String(b.body||'').trim();if(!text||text.length>500)fail(400,'방명록은 1~500자로 입력하세요.');if((await one('SELECT COUNT(*) n FROM guestbook WHERE author=? AND created>?',uid,Date.now()-60000)).n>=5)fail(429,'방명록은 1분에 다섯 번까지 남길 수 있어요.');await db.batch([q('INSERT INTO guestbook(id,gallery_id,author,body,created) VALUES(?,?,?,?,?)',id(),gid,uid,text,Date.now()),...(gid===uid?[]:[q('INSERT INTO activity(id,recipient,actor,kind,created) VALUES(?,?,?,?,?)',id(),gid,uid,'guestbook',Date.now())])]);return bj({ok:true},201)}if(method==='DELETE'){let b=await body();await q('DELETE FROM guestbook WHERE id=? AND gallery_id=? AND (author=? OR gallery_id=?)',b.id,gid,uid,uid).run();return bj({ok:true})}fail(405,'허용되지 않은 방식이에요.');}
if(p==='/api/stickers/preferences'){if(method==='GET'){let pref=await one('SELECT recent,favorites FROM sticker_preferences WHERE user_id=?',uid);return bj(pref?{recent:JSON.parse(pref.recent),favorites:JSON.parse(pref.favorites)}:{recent:[],favorites:[]})}if(method==='PUT'){let b=await body();for(let [key,max]of[['recent',30],['favorites',100]])if(!Array.isArray(b[key])||b[key].length>max||b[key].some(id=>!stickerIds.has(id)))fail(400,'스티커 목록을 확인해주세요.');await q('INSERT INTO sticker_preferences(user_id,recent,favorites) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET recent=excluded.recent,favorites=excluded.favorites',uid,JSON.stringify([...new Set(b.recent)]),JSON.stringify([...new Set(b.favorites)])).run();return bj({ok:true})}}
if(p==='/api/board/draft'){if(method==='GET'){let r=await one('SELECT * FROM board_drafts WHERE owner=?',uid);return bj({board:r?JSON.parse(r.board):emptyBoard(),revision:r?.revision||0})}if(method==='PUT'){let b=await body();await validateBoard(b.board,uid,env);if(!Number.isInteger(b.revision))fail(400,'저장 버전이 없어요.');let old=await one('SELECT * FROM board_drafts WHERE owner=?',uid);if(!old){await q('INSERT OR IGNORE INTO board_drafts(owner,board,updated) VALUES(?,?,?)',uid,JSON.stringify(emptyBoard()),Date.now()).run();old=await one('SELECT * FROM board_drafts WHERE owner=?',uid)}let saved=await one('UPDATE board_drafts SET board=?,revision=revision+1,updated=? WHERE owner=? AND revision=? RETURNING revision',JSON.stringify(b.board),Date.now(),uid,b.revision);if(!saved)fail(409,'다른 기기에서 먼저 수정했어요. 현재 보드를 백업한 뒤 서버 버전을 불러오세요.');if(Date.now()-old.updated>300000)await db.batch([q('INSERT INTO board_backups(id,owner,board,created) VALUES(?,?,?,?)',id(),uid,old.board,Date.now()),q('DELETE FROM board_backups WHERE owner=? AND id NOT IN(SELECT id FROM board_backups WHERE owner=? ORDER BY created DESC LIMIT 5)',uid,uid)]);return bj(saved)}}
if(p==='/api/board/publish'&&method==='POST'){let b=await body(),d=await one('SELECT * FROM board_drafts WHERE owner=?',uid);if(!d||d.revision!==b.revision)fail(409,'초안을 먼저 저장하세요.');await validateBoard(JSON.parse(d.board),uid,env);let me=await profile(db,uid);await q('INSERT INTO galleries(id,owner,title,board,updated) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,board=excluded.board,updated=excluded.updated',uid,uid,me.gallery,d.board,Date.now()).run();return bj({ok:true,id:uid})}
if(p==='/api/board/backups'&&method==='GET')return bj({backups:await all('SELECT id,created FROM board_backups WHERE owner=? ORDER BY created DESC LIMIT 5',uid)});
let m=p.match(/^\/api\/board\/backups\/([^/]+)$/);if(m&&method==='GET'){let r=await one('SELECT board FROM board_backups WHERE id=? AND owner=?',m[1],uid);if(!r)fail(404,'백업이 없어요.');return bj({board:JSON.parse(r.board)})}
if(p==='/api/uploads'&&method==='POST'){if(!env.BUCKET)fail(503,'사진 저장소가 연결되지 않았어요.');let mime=req.headers.get('content-type')?.split(';')[0];if(!['image/png','image/jpeg','image/webp'].includes(mime))fail(415,'JPG·PNG·WebP만 가능해요.');let bytes=await readBytes(req,2097152),s=new TextDecoder().decode(bytes.slice(0,12));let valid=bytes.length>=12&&(mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:mime==='image/png'?Array.from(bytes.slice(0,8)).join(',')==='137,80,78,71,13,10,26,10':s.startsWith('RIFF')&&s.endsWith('WEBP'));if(!valid)fail(400,'파일 형식이 일치하지 않아요.');let mid=id(),key=uid+'/'+mid,r=await one('INSERT INTO media(id,owner,object_key,bytes,mime,created) SELECT ?,?,?,?,?,? WHERE COALESCE((SELECT SUM(bytes) FROM media WHERE owner=? AND mime NOT LIKE \'audio/%\'),0)+?<=52428800 RETURNING id',mid,uid,key,bytes.length,mime,Date.now(),uid,bytes.length);if(!r)fail(413,'사진 저장 한도 50MB를 초과했어요.');try{await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime}});await q("UPDATE media SET state='ready' WHERE id=?",mid).run()}catch(e){await q("UPDATE media SET state='failed' WHERE id=?",mid).run();throw e}return bj({url:'/api/media/'+mid,id:mid},201)}
m=p.match(/^\/api\/media\/([a-f0-9-]{36})$/);if(m&&method==='GET'){let r=await one("SELECT * FROM media WHERE id=? AND state='ready' AND mime LIKE 'image/%'",m[1]);if(!r||await isHiddenAdmin(db,r.owner,uid))fail(404,'사진이 없어요.');if(r.owner!==uid){let g=await one('SELECT board FROM galleries WHERE owner=?',r.owner);if(!g||await isBlocked(db,uid,r.owner))fail(404,'사진에 접근할 수 없어요.');let b=JSON.parse(g.board),friend=await isMutual(db,uid,r.owner),src='/api/media/'+r.id;if(b.background.image!==src&&!b.items.some(o=>o.type==='photo'&&o.content===src&&(friend||!protectedObject(b,o))))fail(404,'사진에 접근할 수 없어요.')}let file=await env.BUCKET.get(r.object_key);if(!file)fail(404,'사진이 없어요.');return new Response(file.body,{headers:{'content-type':r.mime,'cache-control':'no-store, private','x-content-type-options':'nosniff','cross-origin-resource-policy':'same-origin'}})}
if(p==='/api/profile'&&method==='PATCH'){let b=await body(),name=String(b.name||'').trim().slice(0,25),bio=String(b.bio||'').slice(0,150),title=String(b.gallery||'').trim().slice(0,60);if(!name||!title)fail(400,'이름과 전시관 이름을 입력하세요.');await db.batch([q('UPDATE users SET name=?,bio=?,gallery_title=? WHERE id=?',name,bio,title,uid),q('UPDATE galleries SET title=? WHERE owner=?',title,uid)]);return bj({user:await profile(db,uid)})}
if(p==='/api/directory'&&method==='GET'){
 const requestedSeed=Number(url.searchParams.get('exploreSeed'));
 const seed=Number.isInteger(requestedSeed)&&requestedSeed>0&&requestedSeed<2147483647
   ?requestedSeed:1+crypto.getRandomValues(new Uint32Array(1))[0]%2147483646;
 const now=Date.now(),day=seoulDay(now);
 const rows=await all(`
  WITH visible AS (
    SELECT g.id,g.owner,g.updated,((g.rowid % 2147483647) * ?) % 2147483647 AS shuffle
    FROM galleries g JOIN beta_members m ON m.user_id=g.owner
    WHERE m.active=1 AND (g.owner=? OR m.role NOT IN ('admin','super_admin'))
      AND NOT EXISTS (SELECT 1 FROM blocks WHERE actor=? AND target=g.owner)
      AND NOT EXISTS (SELECT 1 FROM blocks WHERE actor=g.owner AND target=?)
  ),
  home AS (
    SELECT id FROM visible WHERE owner<>? AND owner IN (SELECT target FROM follows WHERE actor=?)
    ORDER BY updated DESC,id LIMIT 30
  ),
  explore AS (
    SELECT id FROM visible WHERE owner<>? ORDER BY shuffle,id LIMIT 30
  ),
  saved AS (
    SELECT id FROM visible WHERE owner<>? AND id IN (SELECT gallery_id FROM bookmarks WHERE owner=?)
    ORDER BY updated DESC,id LIMIT 30
  ),
  selected AS (
    SELECT id FROM home UNION SELECT id FROM explore UNION SELECT id FROM saved
    UNION SELECT id FROM visible WHERE owner=?
  )
  SELECT g.*,v.shuffle,g.id IN (SELECT id FROM home) AS home,
    g.id IN (SELECT id FROM explore) AS explore,g.id IN (SELECT id FROM saved) AS saved,
    (SELECT COALESCE(SUM(visit_count),0) FROM visits WHERE gallery_id=g.id) AS total,
    (SELECT COALESCE(SUM(visit_count),0) FROM visits WHERE gallery_id=g.id AND day=?) AS today,
    (SELECT COUNT(DISTINCT visitor) FROM visits WHERE gallery_id=g.id AND last_seen>?) AS live
  FROM selected JOIN galleries g ON g.id=selected.id JOIN visible v ON v.id=g.id
  ORDER BY g.updated DESC,g.id
 `,seed,uid,uid,uid,uid,uid,uid,uid,uid,uid,day,now-45000);
 const [profiles,following,followers,blocks,bookmarks,ranks]=await Promise.all([
   all(`SELECT u.*,(SELECT COUNT(*) FROM follows WHERE actor=u.id) following_count,
     (SELECT COUNT(*) FROM follows WHERE target=u.id) follower_count
     FROM users u JOIN beta_members m ON m.user_id=u.id
     WHERE m.active=1 AND (u.id=? OR m.role NOT IN ('admin','super_admin'))
     ORDER BY (u.id=? OR u.id IN (SELECT value FROM json_each(?))) DESC,m.joined DESC LIMIT 200`,
     uid,uid,JSON.stringify(rows.map(g=>g.owner))),
   all('SELECT target FROM follows WHERE actor=?',uid),
   all('SELECT actor FROM follows WHERE target=?',uid),
   all('SELECT actor,target FROM blocks WHERE actor=? OR target=?',uid,uid),
   all('SELECT gallery_id FROM bookmarks WHERE owner=?',uid),
   visitRanks(db)
 ]);
 const users=profiles.map(u=>({id:u.id,name:u.name,handle:u.handle,code:u.code,bio:u.bio,gallery:u.gallery_title,
   receipts:!!u.receipts,online:!!u.online&&now-u.last_seen<45000,followingCount:u.following_count,followerCount:u.follower_count}));
 const galleries=rows.map(g=>{
   const b=JSON.parse(g.board);
   const masks={items:b.items.filter(o=>o.type==='mask')};
   b.items=b.items.filter(o=>o.x<b.cover.x+b.cover.w&&o.x+o.w>b.cover.x&&o.y<b.cover.y+b.cover.h&&o.y+o.h>b.cover.y&&
     (o.type==='mask'||!masks.items.length||!protectedObject(masks,o)));
   return{id:g.id,owner:g.owner,title:g.title,updated:g.updated,coverBoard:b,badges:memberBadges(ranks,g.owner),stats:{total:g.total,today:g.today,live:g.live}};
 });
 return bj({users,galleries,rankDay:ranks.day,feeds:{
   home:rows.filter(g=>g.home).map(g=>g.id),
   explore:rows.filter(g=>g.explore).sort((a,b)=>a.shuffle-b.shuffle).map(g=>g.id),
   saved:rows.filter(g=>g.saved).map(g=>g.id)
 },following:following.map(r=>r.target).filter(id=>users.some(u=>u.id===id)),
 followers:followers.map(r=>r.actor).filter(id=>users.some(u=>u.id===id)),
 blocked:blocks.map(r=>r.actor===uid?r.target:r.actor),
 saved:bookmarks.map(r=>r.gallery_id).filter(id=>galleries.some(g=>g.id===id))});
}
if(p==='/api/bookmarks'&&method==='POST'){let b=await body();if(await isHiddenAdmin(db,b.galleryId,uid)||!await one('SELECT 1 FROM galleries WHERE id=?',b.galleryId))fail(404,'전시관이 없어요.');if(b.saved)await q('INSERT OR IGNORE INTO bookmarks(owner,gallery_id) VALUES(?,?)',uid,b.galleryId).run();else await q('DELETE FROM bookmarks WHERE owner=? AND gallery_id=?',uid,b.galleryId).run();return bj({ok:true})}
if(p==='/api/activity'&&method==='GET')return bj({items:await all('SELECT * FROM activity WHERE recipient=? AND actor NOT IN(SELECT user_id FROM beta_members WHERE role IN(\'admin\',\'super_admin\') AND user_id<>?) ORDER BY created DESC LIMIT 50',uid,uid)});
if(p==='/api/activity/read'&&method==='POST'){await q('UPDATE activity SET read_at=? WHERE recipient=?',Date.now(),uid).run();return bj({ok:true})}
m=p.match(/^\/api\/visits\/([^/]+)$/);if(m){
 const gid=decodeURIComponent(m[1]);
 if(await isHiddenAdmin(db,gid,uid)||!await one('SELECT 1 FROM galleries WHERE id=?',gid)||await isBlocked(db,uid,gid))fail(404,'전시관이 없어요.');
 if(method==='POST'&&gid!==uid){
   const {entry}=await body();
   const now=Date.now(),day=seoulDay(now);
   // Older clients also send empty POSTs for heartbeats. Keep those deduplicated.
   await q(`INSERT INTO visits(gallery_id,visitor,day,last_seen) VALUES(?,?,?,?)
     ON CONFLICT(gallery_id,visitor,day) DO UPDATE SET
       last_seen=excluded.last_seen,visit_count=visits.visit_count+?`,gid,uid,day,now,entry===true?1:0).run();
 }
 if(method==='PATCH'&&gid!==uid){
   await q(`UPDATE visits SET last_seen=? WHERE gallery_id=? AND visitor=?
     AND day=(SELECT MAX(day) FROM visits WHERE gallery_id=? AND visitor=?)`,Date.now(),gid,uid,gid,uid).run();
 }
 if(method==='DELETE')await q('UPDATE visits SET last_seen=0 WHERE gallery_id=? AND visitor=?',gid,uid).run();
 return bj(await stats(db,gid));
}
if(p==='/api/account/export'&&method==='GET')return bj({version:1,profile:await profile(db,uid),draft:await one('SELECT board,revision FROM board_drafts WHERE owner=?',uid),published:await one('SELECT board,updated FROM galleries WHERE owner=?',uid),follows:await all('SELECT * FROM follows WHERE actor=? OR target=?',uid,uid),messages:await all('SELECT m.* FROM messages m JOIN threads t ON t.id=m.thread_id WHERE t.a=? OR t.b=?',uid,uid)});
async function deleteAccount(targetId){
 let files=await all('SELECT object_key FROM media WHERE owner=?',targetId);if(files.length&&!env.BUCKET)fail(503,'사진 저장소가 연결되지 않았어요.');for(let f of files)await env.BUCKET.delete(f.object_key);await db.batch([q('UPDATE beta_members SET active=0 WHERE user_id=?',targetId),q('DELETE FROM bookmarks WHERE owner=? OR gallery_id=?',targetId,targetId),q('DELETE FROM visits WHERE gallery_id=? OR visitor=?',targetId,targetId),q('DELETE FROM galleries WHERE owner=?',targetId),q('DELETE FROM board_drafts WHERE owner=?',targetId),q('DELETE FROM board_backups WHERE owner=?',targetId),...(env.MUSE_AUTH_MODE==='native'?[q('DELETE FROM guestbook WHERE author=? OR gallery_id=?',targetId,targetId)]:[]),q('DELETE FROM sticker_preferences WHERE user_id=?',targetId),q('DELETE FROM media WHERE owner=?',targetId),q('DELETE FROM follows WHERE actor=? OR target=?',targetId,targetId),q('DELETE FROM activity WHERE actor=? OR recipient=?',targetId,targetId),q('UPDATE messages SET body=NULL,ref=NULL,revoked=1 WHERE sender=?',targetId),q("UPDATE users SET name='탈퇴한 관장',bio='',gallery_title='삭제된 전시관',online=0,last_seen=0 WHERE id=?",targetId),q('INSERT INTO audit_events(id,actor,kind,created) VALUES(?,?,?,?)',id(),targetId,'account_deleted',Date.now()),q('DELETE FROM message_events WHERE user_id=?',targetId),
 ...(env.MUSE_AUTH_MODE==='native'?[q('DELETE FROM auth_sessions WHERE user_id=?',targetId),q('DELETE FROM auth_credentials WHERE user_id=?',targetId)]:[]),
 ...(targetId!==uid?[q('INSERT INTO audit_events(id,actor,kind,created,detail) VALUES(?,?,?,?,?)',id(),uid,'admin_account_deleted',Date.now(),targetId)]:[])]);
}
if(p==='/api/account/delete'&&method==='POST'){
 const b=await body();
 if(b.confirm!=='계정 삭제')fail(400,'계정 삭제를 정확히 입력하세요.');
 if(isAdminRole(member.role))fail(409,'관리자는 먼저 운영 권한을 이전해야 해요.');
 await deleteAccount(uid);
 return bj({ok:true});
}
if(p==='/api/client-errors'&&method==='POST'){let b=await body(),n=await one("SELECT COUNT(*) n FROM audit_events WHERE actor=? AND kind='client_error' AND created>?",uid,Date.now()-60000);if(n.n<10)await q('INSERT INTO audit_events(id,actor,kind,created,detail) VALUES(?,?,?,?,?)',id(),uid,'client_error',Date.now(),String(b.code||'unknown').replace(/[^a-z0-9_-]/gi,'').slice(0,60)).run();return bj({ok:true})}
if(p.startsWith('/api/admin/')){if(!['admin','super_admin'].includes(member.role))fail(403,'관리자만 접근할 수 있어요.');if(p==='/api/admin/access'&&method==='GET')return bj({ok:true});if(p==='/api/admin/overview'&&method==='GET')return bj({members:await all('SELECT m.*,u.name,u.handle,u.code FROM beta_members m JOIN users u ON m.user_id=u.id WHERE NOT EXISTS (SELECT 1 FROM audit_events a WHERE a.actor=m.user_id AND a.kind=\'account_deleted\') ORDER BY m.active DESC,m.joined DESC'),invites:await all('SELECT id,created,expires,uses,revoked FROM beta_invites ORDER BY created DESC LIMIT 40'),reports:await all('SELECT * FROM reports ORDER BY created DESC LIMIT 50'),events:await all('SELECT kind,COUNT(*) count FROM audit_events GROUP BY kind')});if(p==='/api/admin/invites'&&method==='POST'){let token=Array.from(crypto.getRandomValues(new Uint8Array(24)),v=>v.toString(16).padStart(2,'0')).join(''),iid=id();await q('INSERT INTO beta_invites(id,token_hash,created_by,created,expires) VALUES(?,?,?,?,?)',iid,await hash(token),uid,Date.now(),Date.now()+604800000).run();return bj({id:iid,token},201)}if(p==='/api/admin/invites/revoke'&&method==='POST'){let b=await body();await q('UPDATE beta_invites SET revoked=1 WHERE id=?',b.id).run();return bj({ok:true})}if(p==='/api/admin/reports'&&method==='PATCH'){let b=await body();if(!['reviewed','dismissed'].includes(b.status))fail(400,'상태가 올바르지 않아요.');await q('UPDATE reports SET status=?,reviewed_at=? WHERE id=?',b.status,Date.now(),b.id).run();return bj({ok:true})}if(method==='POST'&&(p==='/api/admin/suspend'||p==='/api/admin/members/delete')){
 const b=await body();
 if(typeof b.userId!=='string'||b.userId===uid)fail(400,'선택한 회원을 확인해주세요.');
 const target=await one(`SELECT u.handle,m.role FROM users u JOIN beta_members m ON m.user_id=u.id
   WHERE u.id=? AND NOT EXISTS (SELECT 1 FROM audit_events a WHERE a.actor=u.id AND a.kind='account_deleted')`,b.userId);
 if(!target)fail(404,'회원을 찾을 수 없어요.');
 if(isAdminRole(target.role))fail(403,'관리자 계정은 여기서 변경할 수 없어요.');
 if(p==='/api/admin/members/delete'){
   if(b.confirm!==true)fail(400,'회원 삭제를 확인해주세요.');
   await deleteAccount(b.userId);
 }else{
   if(typeof b.suspended!=='boolean'||(b.confirmHandle!==undefined&&b.confirmHandle!==target.handle))fail(400,'회원 이용 상태를 확인해주세요.');
   await db.batch([
     q("UPDATE beta_members SET active=? WHERE user_id=? AND role NOT IN('admin','super_admin')",b.suspended?0:1,b.userId),
     q('INSERT INTO audit_events(id,actor,kind,created,detail) VALUES(?,?,?,?,?)',id(),uid,b.suspended?'admin_member_suspended':'admin_member_resumed',Date.now(),b.userId)
   ]);
 }
 return bj({ok:true});
}fail(404,'없는 관리 경로입니다.')}
return null;}
