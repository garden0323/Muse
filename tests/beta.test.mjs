import test from 'node:test';import assert from 'node:assert/strict';import{DatabaseSync}from'node:sqlite';import{readFileSync}from'node:fs';import{api}from'../worker/api.mjs';import{emptyBoard,privacyVersion}from'../worker/beta.mjs';
const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(let f of ['0000_messaging','0001_private_beta','0005_realtime_messages','0006_repeat_visits','0007_visit_rank_cache'])db.exec(readFileSync('drizzle/'+f+'.sql','utf8'));const DB={prepare(sql){let v=[];let s={bind(...values){v=values;return s},async first(){return db.prepare(sql).get(...v)||null},async all(){return{results:db.prepare(sql).all(...v)}},async run(){return db.prepare(sql).run(...v)}};return s},async batch(ss){db.exec('BEGIN');try{let r=[];for(let s of ss)r.push(await s.run());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}};let files=new Map(),BUCKET={async put(k,b){files.set(k,b)},async get(k,opts){let body=files.get(k),r=opts?.range;return body?{body:r?body.subarray(r.offset,r.offset+r.length):body}:null},async delete(k){files.delete(k)}};const env={DB,BUCKET,BETA_ADMIN_EMAIL:'admin@test.invalid'};
async function req(uid,path,method='GET',data,opts={}){let r=await api(new Request('https://muse.test/api/'+path,{method,headers:{...(opts.account?{'x-muse-account':opts.account}:{}),...(opts.range?{range:opts.range}:{}),...(uid?{'oai-authenticated-user-id':uid,'oai-authenticated-user-email':uid+'@test.invalid'}:{}),...(method==='GET'?{}:{origin:opts.origin||'https://muse.test','content-type':opts.mime||'application/json'})},...(data===undefined?{}:{body:opts.mime?data:JSON.stringify(data)})}),env);let b=r.headers.get('content-type')?.includes('json')?await r.json():{bytes:(await r.arrayBuffer()).byteLength};return{status:r.status,headers:r.headers,...b}}
let invite,media;const registration={name:'관장',handle:'museum.admin',agree:true,privacyVersion};
test('unauthenticated and nonmember requests cannot reach private API',async()=>{assert.equal((await req(null,'session')).authenticated,false);for(let p of ['directory','board/draft','inbox','admin/overview','users']){assert.equal((await req(null,p)).status,401);assert.equal((await req('outsider',p)).status,403)}});
test('owner registration verifies identity, consent and unique account code',async()=>{assert.equal((await req('admin','auth/join','POST',{...registration,agree:false})).status,400);assert.equal((await req('admin','auth/join','POST',registration)).status,201);let b=await req('admin','session');assert.equal(b.role,'admin');assert.match(b.user.code,/^\d{8}$/);assert.equal((await req('admin','board/draft')).board.items.length,0)});
test('invitations are hashed, single use, independent of public account code',async()=>{invite=(await req('admin','admin/invites','POST',{})).token;assert.equal(invite.length,48);assert.notEqual(db.prepare('SELECT token_hash FROM beta_invites').get().token_hash,invite);assert.equal((await req('b','auth/join','POST',{...registration,handle:'museum.b',invite:(await req('admin','session')).user.code})).status,403);assert.equal((await req('b','auth/join','POST',{...registration,handle:'museum.b',invite})).status,201);assert.equal((await req('c','auth/join','POST',{...registration,handle:'museum.c',invite})).status,403);assert.equal((await req('b','admin/overview')).status,403);assert.equal((await req('c','auth/join','POST',{...registration,handle:'museum.c',invite:(await req('admin','admin/invites','POST',{})).token})).status,201)});
test('new requests revalidate identity; missing or different identity cannot reuse private state',async()=>{for(let i=0;i<3;i++)assert.equal((await req('b','session')).member,true);assert.equal((await req(null,'board/draft')).status,401);assert.equal((await req('admin','session')).user.handle,'museum.admin');assert.equal((await req('b','session')).user.handle,'museum.b')});
test('upload checks MIME, magic, streamed size, and owner authorization',async()=>{assert.equal((await req('b','uploads','POST',new Uint8Array(20),{mime:'image/svg+xml'})).status,415);assert.equal((await req('b','uploads','POST',new Uint8Array(20),{mime:'image/png'})).status,400);assert.equal((await req('b','uploads','POST',new Uint8Array(2097153),{mime:'image/png'})).status,413);let png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPyoAAAAASUVORK5CYII=','base64');let r=await req('b','uploads','POST',png,{mime:'image/png'});assert.equal(r.status,201);media=r.url;assert.equal((await req('admin',media.slice(5))).status,404);assert.match((await req('b',media.slice(5))).headers.get('cache-control'),/no-store/)});
test('drafts are per account; cloud revisions prevent silent lost updates; publish requires saved revision',async()=>{let b=emptyBoard();b.items=[{id:'photo',type:'photo',x:2600,y:1800,w:200,h:200,r:0,z:1,style:{},content:media},{id:'mask',type:'mask',x:2500,y:1700,w:500,h:500,r:0,z:2,style:{},content:''}];assert.equal((await req('b','board/draft','PUT',{board:b,revision:0})).revision,1);assert.equal((await req('b','board/draft','PUT',{board:b,revision:0})).status,409);assert.equal((await req('admin','board/draft')).board.items.length,0);assert.equal((await req('admin','board/draft','PUT',{board:b,revision:0})).status,403);assert.equal((await req('b','board/publish','POST',{revision:0})).status,409);assert.equal((await req('b','board/publish','POST',{revision:1})).status,200)});
test('protected original and URL absent until mutual follow; unfollow immediately revokes future reads',async()=>{assert.equal((await req('c','galleries/b')).board.items.length,1);assert.equal(JSON.stringify((await req('c','directory')).galleries).includes(media),false);await req('c','follows','POST',{target:'b',following:true});await req('b','follows','POST',{target:'c',following:true});assert.equal((await req('c',media.slice(5))).status,200);await req('b','follows','POST',{target:'c',following:false});assert.equal((await req('c',media.slice(5))).status,404);assert.equal((await req('c','galleries/b')).board.items.length,1)});
test('unchanged gallery checks omit board data but revalidate friend access',async()=>{
  const original=await req('c','galleries/b');
  const suffix='?known='+original.updated+'&friend='+original.friend;
  assert.equal((await req('c','galleries/b'+suffix)).unchanged,true);
  await req('b','follows','POST',{target:'c',following:true});
  const authorized=await req('c','galleries/b'+suffix);
  assert.equal(authorized.friend,true);
  assert.equal(authorized.board.items.some(o=>o.id==='photo'),true);
  await req('b','follows','POST',{target:'c',following:false});
  const revoked=await req('c','galleries/b?known='+authorized.updated+'&friend=true');
  assert.equal(revoked.friend,false);
  assert.equal(revoked.board.items.some(o=>o.id==='photo'),false);
});
test('profile follower and following lists expose the correct visible accounts', async () => {
  const followers = await req('c','profiles/b/followers');
  assert.equal(followers.status,200);
  assert.deepEqual(followers.users.map(u=>u.id),['c']);
  assert.deepEqual((await req('c','profiles/b/following')).users,[]);
  assert.deepEqual((await req('c','profiles/c/following')).users.map(u=>u.id),['b']);
  assert.equal((await req('c','profiles/admin/followers')).status,404);
  assert.equal((await req(null,'profiles/b/followers')).status,401);
});
test('public #code search and actual counts/activity/bookmarks are persisted',async()=>{let code=(await req('b','session')).user.code;assert.equal((await req('c','users?q=%23'+code)).users[0].id,'b');assert.equal((await req('b','directory')).users.find(p=>p.id==='b').followerCount,1);assert.ok((await req('b','activity')).items.length);await req('c','bookmarks','POST',{galleryId:'b',saved:true});assert.deepEqual((await req('c','directory')).saved,['b'])});
test('same-day re-entry increases totals, but presence updates and owner visits do not', async () => {
  const legacy = await req('c', 'visits/b', 'POST', {});
  assert.equal(legacy.status, 200);
  assert.equal(legacy.total, 1);
  assert.equal(legacy.today, 1);
  assert.equal(legacy.live, 1);
  assert.equal((await req('c', 'visits/b', 'POST', {})).total, 1);
  const repeat = await req('c', 'visits/b', 'POST', {entry:true});
  assert.equal(repeat.total, 2);
  assert.equal(repeat.today, 2);
  assert.equal(repeat.live, 1);
  const heartbeat = await req('c', 'visits/b', 'PATCH', {});
  assert.equal(heartbeat.total, 2);
  assert.equal(heartbeat.today, 2);
  assert.equal((await req('b', 'visits/b', 'POST', {entry:true})).total, 2);
  assert.equal((await req('b', 'directory')).galleries.find(g=>g.id==='b').stats.today, 2);
  db.prepare("UPDATE visits SET day='2000-01-01' WHERE gallery_id='b' AND visitor='c'").run();
  const afterMidnight = await req('c', 'visits/b', 'PATCH', {});
  assert.equal(afterMidnight.today, 0);
  assert.equal(afterMidnight.live, 1);
  const newDay = await req('c', 'visits/b', 'POST', {entry:true});
  assert.equal(newDay.total, 3);
  assert.equal(newDay.today, 1);
  await req('c', 'visits/b', 'DELETE', {});
  assert.equal((await req('b', 'visits/b')).live, 0);
});
test('profile and directory return the same rank snapshot while board heartbeats skip it', async () => {
  db.prepare("UPDATE visit_rank_cache SET expires=0").run();
  const directory = await req('c','directory');
  const profile = await req('c','profiles/b/visit-ranks');
  assert.equal(profile.status,200);
  assert.equal(profile.rankDay,directory.rankDay);
  assert.deepEqual(profile.badges,{total:1,daily:1});
  assert.deepEqual(directory.galleries.find(g=>g.owner==='b').badges,profile.badges);
  const entry = await req('c','galleries/b?ranks=1');
  assert.deepEqual(entry.badges,profile.badges);
  assert.equal(entry.rankDay,profile.rankDay);
  db.prepare("UPDATE visit_rank_cache SET expires=0").run();
  const heartbeat = await req('c','galleries/b?known='+entry.updated+'&friend='+entry.friend);
  assert.equal(heartbeat.unchanged,true);
  assert.equal(heartbeat.badges,undefined);
  assert.equal((await req('c','galleries/b')).badges,undefined);
  assert.equal(db.prepare('SELECT expires FROM visit_rank_cache').get().expires,0);
  assert.equal((await req('c','profiles/admin/visit-ranks')).status,404);
});
test('block denies new messages both ways and protected gallery access; admin can review report',async()=>{let tid=(await req('c','threads','POST',{peer:'b'})).id,mid=(await req('b',`threads/${tid}/messages`,'POST',{body:'report test'})).id;await req('c','reports','POST',{target:'b',messageId:mid,reason:'test'});await req('b','blocks','POST',{target:'c',blocked:true});for(let uid of ['b','c'])assert.equal((await req(uid,`threads/${tid}/messages`,'POST',{body:'blocked'})).status,403);assert.equal((await req('c','galleries/b')).status,404);assert.equal((await req('c','profiles/b/following')).status,404);let rid=(await req('admin','admin/overview')).reports[0].id;assert.equal((await req('admin','admin/reports','PATCH',{id:rid,status:'reviewed'})).status,200)});
test('revoked/expired invites, cross origin writes and suspended identities are rejected',async()=>{let i=await req('admin','admin/invites','POST',{});await req('admin','admin/invites/revoke','POST',{id:i.id});assert.equal((await req('d','auth/join','POST',{...registration,handle:'museum.d',invite:i.token})).status,403);i=await req('admin','admin/invites','POST',{});db.prepare('UPDATE beta_invites SET expires=0 WHERE id=?').run(i.id);assert.equal((await req('d','auth/join','POST',{...registration,handle:'museum.d',invite:i.token})).status,403);assert.equal((await req('b','profile','PATCH',{name:'bad',gallery:'bad'},{origin:'https://evil.test'})).status,403);await req('admin','admin/suspend','POST',{userId:'b',suspended:true});assert.equal((await req('b','inbox')).status,403);await req('admin','admin/suspend','POST',{userId:'b',suspended:false})});
test('delete removes photos and private text; account disabled; administrator requires ownership transfer',async()=>{assert.equal((await req('b','account/delete','POST',{confirm:'wrong'})).status,400);assert.equal((await req('b','account/delete','POST',{confirm:'계정 삭제'})).status,200);assert.equal((await req('b','session')).member,false);assert.equal((await req('b','board/draft')).status,403);assert.equal(files.size,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM media WHERE owner=?').get('b').n,0);assert.equal(db.prepare('SELECT body FROM messages WHERE sender=?').get('b').body,null);assert.equal((await req('admin','account/delete','POST',{confirm:'계정 삭제'})).status,409)});

test('stale tab account marker cannot write under a different authenticated account',async()=>{let r=await req('admin','profile','PATCH',{name:'wrong',gallery:'wrong'},{account:'b'});assert.equal(r.status,401);assert.equal((await req('admin','session')).user.name,'관장')});

test('home selects followed galleries before limiting, while explore samples eligible galleries independently', async () => {
  db.exec('DROP TRIGGER beta_capacity');
  const addUser = db.prepare('INSERT INTO users(id,name,handle,code) VALUES(?,?,?,?)');
  const addMember = db.prepare("INSERT INTO beta_members(user_id,role,joined,privacy_version) VALUES(?,'member',?,?)");
  const addGallery = db.prepare('INSERT INTO galleries(id,owner,title,board,updated) VALUES(?,?,?,?,?)');
  const board = JSON.stringify(emptyBoard());
  for (let n = 0; n < 34; n++) {
    const id = 'feed' + n;
    addUser.run(id, id, id, String(90000000 + n));
    addMember.run(id, n, privacyVersion);
    addGallery.run(id, id, id, board, n);
  }
  addGallery.run('admin', 'admin', 'Hidden gallery', board, 999);
  db.prepare('INSERT INTO follows(actor,target) VALUES(?,?)').run('feed33', 'feed0');
  db.prepare('INSERT INTO follows(actor,target) VALUES(?,?)').run('feed33', 'feed1');
  db.prepare('INSERT INTO blocks(actor,target) VALUES(?,?)').run('feed1', 'feed33');
  db.prepare('UPDATE beta_members SET active=0 WHERE user_id=?').run('feed2');
  const first = await req('feed33', 'directory?exploreSeed=1');
  const repeat = await req('feed33', 'directory?exploreSeed=1');
  const shuffled = await req('feed33', 'directory?exploreSeed=2147483646');
  assert.equal(first.status, 200);
  assert.deepEqual(first.feeds.home, ['feed0']);
  assert.equal(first.feeds.explore.length, 30);
  assert.ok(first.feeds.explore.includes('feed3'));
  assert.ok(['feed1', 'feed2', 'feed33', 'admin'].every(id => !first.feeds.explore.includes(id)));
  assert.deepEqual(first.feeds.explore, repeat.feeds.explore);
  assert.notDeepEqual(first.feeds.explore, shuffled.feeds.explore);
  assert.deepEqual(shuffled.feeds.home, ['feed0']);
});

test('diary and wooden photo frames survive saving, publishing, and reloading', async () => {
  const draft = await req('c','board/draft');
  const board = emptyBoard();
  const frames = ['diary','wood-frame'];
  board.items = frames.map((frame,i)=>({
    id:'frame-'+i,type:'photo',x:2600+i*200,y:1800,w:180,h:220,r:0,z:i,
    content:'assets/forest.jpg',caption:'테스트',style:{frame}
  }));
  const saved = await req('c','board/draft','PUT',{board,revision:draft.revision});
  assert.equal(saved.status,200);
  assert.deepEqual((await req('c','board/draft')).board.items.map(item=>item.style.frame),frames);
  assert.equal((await req('c','board/publish','POST',{revision:saved.revision})).status,200);
  assert.deepEqual((await req('c','galleries/c')).board.items.map(item=>item.style.frame),frames);
});

test('ranking endpoint reuses the badge cache and includes all visible ties beyond three cards',async()=>{
  const day=(await req('c','directory')).rankDay;
  const user=db.prepare('INSERT INTO users(id,name,handle) VALUES(?,?,?)');
  const member=db.prepare("INSERT INTO beta_members(user_id,role,joined,privacy_version) VALUES(?,'member',?,?)");
  const gallery=db.prepare('INSERT INTO galleries(id,owner,title,board,updated) VALUES(?,?,?,?,?)');
  const visit=db.prepare('INSERT INTO visits(gallery_id,visitor,day,last_seen,visit_count) VALUES(?,?,?,?,?)');
  for(const [n,count] of [100,80,80,80,60,0].entries()){
    const owner='rank-'+n;
    user.run(owner,'Rank '+n,'ranking'+n);member.run(owner,Date.now(),privacyVersion);
    gallery.run(owner,owner,'Ranking',JSON.stringify(emptyBoard()),Date.now());
    if(count)visit.run(owner,'c',day,Date.now(),count);
  }
  db.exec('UPDATE visit_rank_cache SET expires=0');
  const result=await req('c','visit-rankings');
  assert.equal(result.status,200);
  const expected=[{id:'rank-0',name:'Rank 0',rank:1,visits:100},...[1,2,3].map(n=>({id:'rank-'+n,name:'Rank '+n,rank:2,visits:80}))];
  assert.deepEqual(result.daily,expected);
  assert.deepEqual(result.total,expected);
  for(const row of result.daily){
    const badge=await req('c','profiles/'+row.id+'/visit-ranks');
    assert.equal(badge.badges.daily,row.rank);
  }
  const cached=db.prepare('SELECT expires FROM visit_rank_cache').get().expires;
  await req('c','blocks','POST',{target:'rank-1',blocked:true});
  assert.deepEqual((await req('c','visit-rankings')).daily,expected.filter(row=>row.id!=='rank-1'));
  assert.equal(db.prepare('SELECT expires FROM visit_rank_cache').get().expires,cached);
});

test('gallery audio validates uploads and ownership, supports byte ranges and protects unpublished or removed tracks',async()=>{
  const wav=readFileSync('dist/assets/muse-quiet.wav');
  const owner='rank-0',viewer='c',options={mime:'audio/wav'};
  assert.equal((await req(viewer,'audio','POST',wav,{...options,origin:'https://example.net'})).status,403);
  assert.equal((await req(owner,'audio','POST',new Uint8Array(20),options)).status,400);
  assert.equal((await req(owner,'audio','POST',new Uint8Array(12*1024*1024+1),options)).status,413);
  const first=await req(owner,'audio','POST',wav,options);
  assert.equal(first.status,201);
  const path='audio/'+first.id;
  assert.equal((await req(viewer,path)).status,404);
  assert.equal((await req(owner,'media/'+first.id)).status,404);
  const draft=await req(owner,'board/draft');
  draft.board.music={track:'upload',id:first.id,name:'Quiet room',volume:.4,loop:false};
  const viewerDraft=await req(viewer,'board/draft');
  assert.equal((await req(viewer,'board/draft','PUT',{board:draft.board,revision:viewerDraft.revision})).status,403);
  let saved=await req(owner,'board/draft','PUT',{board:draft.board,revision:draft.revision});
  assert.equal(saved.status,200);
  assert.equal((await req(viewer,path)).status,404);
  assert.equal((await req(owner,'board/publish','POST',{revision:saved.revision})).status,200);
  assert.deepEqual((await req(viewer,'galleries/'+owner)).board.music,draft.board.music);
  const ranged=await req(viewer,path,'GET',undefined,{range:'bytes=0-31'});
  assert.equal(ranged.status,206);assert.equal(ranged.bytes,32);
  assert.equal(ranged.headers.get('content-range'),'bytes 0-31/'+wav.length);
  assert.equal((await req(viewer,path,'HEAD')).bytes,0);
  assert.equal((await req(viewer,path,'GET',undefined,{range:'bytes=999999999-'})).status,416);
  assert.equal((await req(null,path)).status,401);
  const put=BUCKET.put;
  try{
    BUCKET.put=async()=>{throw Error('test storage failure')};
    assert.equal((await req(owner,'audio','POST',wav,options)).status,503);
    assert.equal((await req(viewer,path)).status,200);
  }finally{BUCKET.put=put}
  const replacement=await req(owner,'audio','POST',wav,options);
  draft.board.music.id=replacement.id;
  saved=await req(owner,'board/draft','PUT',{board:draft.board,revision:saved.revision});
  assert.equal((await req(viewer,path)).status,200);
  assert.equal((await req(viewer,'audio/'+replacement.id)).status,404);
  assert.equal((await req(owner,'board/publish','POST',{revision:saved.revision})).status,200);
  assert.equal((await req(viewer,path)).status,404);
  assert.equal((await req(viewer,'audio/'+replacement.id)).status,200);
  draft.board.music={track:'none',volume:.4};
  saved=await req(owner,'board/draft','PUT',{board:draft.board,revision:saved.revision});
  assert.equal((await req(owner,'board/publish','POST',{revision:saved.revision})).status,200);
  assert.equal((await req(viewer,'audio/'+replacement.id)).status,404);
  assert.equal((await req(viewer,'galleries/'+owner)).board.music.track,'none');
});
