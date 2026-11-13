(()=>{'use strict';
const old=window.MuseSocial,icon=old.icon,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let account,role,passwordOnlyAdmin=false,data={users:[],galleries:[],following:[],followers:[],blocked:[],saved:[]},page='home',profileId=null,visiting=null,remote=null,saveJob=null,conflict=false,locked=false,query='',tab='mutual',heartbeat=null;
const exploreSeed=1+crypto.getRandomValues(new Uint32Array(1))[0]%2147483646;
let directoryJob=null,directoryAt=0,routeEpoch=0,boardEntry=0,boardRanks=null;
const person=id=>data.users.find(u=>u.id===id),avatar=p=>'<span class="user-avatar '+(p?.id===account?.id?'me-avatar':'')+'">'+esc((p?.name||'?').slice(0,1))+'</span>',follows=p=>data.following.includes(p?.id),mutual=p=>follows(p)&&data.followers.includes(p?.id)&&!data.blocked.includes(p?.id),getStats=id=>data.galleries.find(g=>g.id===id)?.stats||{total:0,today:0,live:0};
async function api(path,method='GET',body){if(locked)throw Error('로그인을 다시 확인해주세요.');let r=await fetch('/api/'+path,{method,cache:'no-store',credentials:'same-origin',headers:{...(account?{'x-muse-account':account.id}:{}),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}).catch(()=>{throw Error('서버에 연결하지 못했어요. 연결을 확인하고 다시 시도하세요.')}),b;try{b=await r.json()}catch{throw Error('서버 응답을 확인할 수 없어요.')}if(r.status===401||r.status===403&&/초대 가입|이용.*중지/.test(b.error||''))lock(b.error);if(!r.ok){let e=Error(b.error||'요청에 실패했어요.');e.status=r.status;throw e}return b}
function lock(reason='로그인을 다시 확인해주세요.'){if(location.hash&&!location.hash.startsWith('#invite/'))sessionStorage.setItem('muse-return-route',location.hash);locked=true;coverObserver?.disconnect();miniCache=null;sceneImages.clear();clearTimeout(saveTimer);dirty=false;clearInterval(heartbeat);stopMusic();window.MuseMessages?.leave();window.MuseMessages?.clearPrivate();guestBoard=null;state=blank();publication=null;images.clear();$('other').innerHTML='';$('editor').hidden=true;document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.body.classList.remove('board-active','board-edit','board-view','messages-active');document.body.classList.add('auth-checking');$('authGate').hidden=false;window.MuseAuth.show({reason})}

function privacy(){openDialog('MUSE 비공개 베타 개인정보 안내','<p>시행일: 2026년 11월 10일 · MUSE 베타</p><p>가입 시 아이디·해시 처리된 비밀번호·공개 8자리 번호를 저장합니다. 이메일·전화번호는 받지 않습니다. 로그인 세션은 HttpOnly 쿠키로 보관하며 30일 미사용 또는 최초 발급 90일 후 만료됩니다. 복구 코드를 잃으면 계정 복구가 어려울 수 있습니다.</p><p>닉네임·아이디·공개 8자리 코드·소개·팔로우, 사진·글·보드 설정, 메시지·읽음 설정과 방문 기록을 서비스 제공을 위해 저장합니다. 전시관은 가입한 회원에게만 공개되며 친구 가림막 안은 맞팔 관계에서만 전달합니다. 방문자의 신원은 관장에게 표시하지 않습니다.</p><p>Cloudflare D1·R2와 Sites에서 처리합니다. 공급자의 처리 지역과 백업 보존 정책은 운영 안내를 확인해주세요. 광고·추적 도구는 추가하지 않습니다.</p><p>보드 복구본은 최근 5개를 유지합니다. 채팅은 종단간 암호화가 아니며 신고 증거는 관리자에게 보입니다. 운영 오류에는 콘텐츠 대신 오류 코드만 기록합니다.</p><p>설정에서 데이터 내보내기·계정 삭제를 이용할 수 있습니다. 삭제 시 원본 사진·보드·관계·작성 메시지 본문을 삭제합니다. 상대 대화의 취소 안내·탈퇴 표시, 신고 증거와 최소 운영 기록은 관리자가 검토 후 정리합니다. 공급자 백업의 잔존 기간은 별도 확인이 필요합니다.</p><p>운영자는 MUSE 관장입니다. 문의는 운영자에게 직접 연락하거나 사용자 신고 기능을 이용하세요. 초대 링크는 초대한 친구에게만 전달해주세요.</p>')}
async function showAuth(b){window.MuseAuth.show(b)}
function download(name,obj){let a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
const uploadJobs=new Map();
async function upload(src){if(!src?.startsWith('data:image/')){if(src?.startsWith('blob:'))throw Error('임시 사진 주소는 저장할 수 없어요. 사진을 다시 선택하세요.');return src}if(!uploadJobs.has(src))uploadJobs.set(src,MuseMedia.upload(src,account.id,p=>{$('saveState').textContent=p===100?'사진 확인 완료 · 보드 저장 중…':'사진 업로드 중 · '+p+'%'}).catch(e=>{uploadJobs.delete(src);if(e.status===401)lock();throw e}));return uploadJobs.get(src)}
async function saveBoard(){if(locked)throw Error('로그인을 다시 확인해주세요.');if(conflict)throw Error('저장 충돌이 있어요. 관리에서 백업하고 서버 초안을 다시 불러오세요.');if(saveJob){await saveJob;return saveBoard()}saveJob=(async()=>{while(mediaPreparations.size){$('saveState').textContent='사진 준비 중…';await Promise.all([...mediaPreparations])}let pending;do{pending=state.items.filter(o=>o.type==='photo'&&/^(data:|blob:)/.test(o.content));for(let o of pending){let src=o.content,url=await upload(src);if(o.content===src)o.content=url}if(/^(data:|blob:)/.test(state.background.image||'')){let src=state.background.image,url=await upload(src);if(state.background.image===src)state.background.image=url}}while(state.items.some(o=>o.type==='photo'&&/^(data:|blob:)/.test(o.content))||/^(data:|blob:)/.test(state.background.image||''));let s=snapshot(),clientRevision=revision;try{let r=await api('board/draft','PUT',{board:s,revision:window.MuseDraftRevision});window.MuseDraftRevision=r.revision;await storeRecord('draft',s);return{board:s,revision:r.revision,clientRevision}}catch(e){if(e.status===409)conflict=true;throw e}})();try{return await saveJob}finally{saveJob=null}}
let activityJob=null,activityAt=0,activitySnapshot;
async function loadActivity(){
 if(activityJob)return activityJob;
 if(activitySnapshot&&Date.now()-activityAt<5000)return activitySnapshot;
 activityJob=api('activity');
 try{
   const data=await activityJob;
   activitySnapshot=data;activityAt=Date.now();
   const n=data.items.filter(item=>!item.read_at).length;
   $('noticeCount').textContent=n;$('noticeCount').hidden=!n;
   document.querySelectorAll('.notification-dot').forEach(el=>el.hidden=!n);
   return data;
 }finally{activityJob=null}
}
async function refreshDirectory(){
 if(directoryJob)return directoryJob;
 directoryJob=(async()=>{
   data=await api('directory?exploreSeed='+exploreSeed);
   directoryAt=Date.now();
   account=person(account.id)||account;window.MuseAccount=account;
   window.MuseSocial.people=data.users.filter(u=>u.id!==account.id);
   $('sidebarName').textContent=account.name;
   document.querySelector('#accountButton small').textContent='@'+account.handle;
   document.querySelectorAll('.me-avatar').forEach(e=>e.textContent=account.name.slice(0,1));
   loadActivity().catch(()=>{});
 })();
 try{return await directoryJob}finally{directoryJob=null}
}
const initialDirectory=window.MuseBoot.then(session=>{
 if(!session.member)return;
 account=session.user;
 return refreshDirectory();
}).catch(()=>{});

function statsHTML(s){return '<div class="beta-stats"><span><b>'+s.total+'</b> 누적 방문</span><span><b>'+s.today+'</b> 오늘 방문</span><span><b>'+s.live+'</b> 관람 중</span></div>'}
const heading=(title,sub)=>'<div class="page-heading"><div><h1>'+title+'</h1><p>'+sub+'</p></div><span class="beta-pill">PRIVATE BETA</span></div>',empty=t=>'<div class="empty-social"><span class="beta-spark">✳</span><h2>'+t+'</h2><p>작은 취향부터 천천히 채워보세요.</p><button data-route="intro">내 전시관 보기</button></div>';
function coverCanvas(id,w=560){return '<canvas data-beta-cover="'+esc(id)+'" data-cover-size="'+w+'" width="'+w+'" height="'+Math.round(w*.64)+'" aria-label="전시관 대표 화면"></canvas>'}
const rankIcons={
 total:'<path d="M8 21h8m-4-4v4M7 4h10v5a5 5 0 0 1-10 0V4Zm0 2H3v2a4 4 0 0 0 5 4m9-6h4v2a4 4 0 0 1-5 4"/>',
 daily:'<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>'
};
const seoulRankDay=()=>new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10);
function rankBadges(badges,day){
 if(!badges)return '';
 return [['total','누적',badges.total],['daily','일일',day===seoulRankDay()?badges.daily:null]]
   .filter(([, ,rank])=>Number.isInteger(rank)&&rank>=1&&rank<=3)
   .map(([kind,label,rank])=>'<span class="visit-badge visit-badge--'+kind+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+rankIcons[kind]+'</svg>'+label+' '+rank+'위</span>').join('');
}
let rankKind='daily',rankSnapshot=null,rankRequest=null,rankRollover;
function exploreNav(active){
 return '<nav class="explore-subnav" aria-label="탐색 세부 메뉴">'+
   [['browse','전시관 탐색'],['ranking','랭킹']].map(([id,label])=>
     '<button data-route="explore"'+(id==='ranking'?' data-id="ranking"':'')+
     (active===id?' aria-current="page"':'')+'>'+label+'</button>').join('')+'</nav>';
}
function drawRanking(){
 const panel=$('rankingList');
 if(!panel)return;
 document.querySelectorAll('[data-rank-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.rankKind===rankKind)));
 $('rankingNote').textContent=rankKind==='daily'?'오늘 방문량 기준 · 한국 시간 00:00 초기화':'전체 누적 방문량 기준';
 const expired=rankKind==='daily'&&rankSnapshot?.day!==seoulRankDay();
 const rows=expired?[]:rankSnapshot?.[rankKind]||[];
 panel.innerHTML=rows.map(u=>'<button class="rank-card" data-enter="'+esc(u.id)+'"><span class="rank-number">'+u.rank+
   '</span><span class="rank-person"><span class="rank-name"><b>'+esc(u.name)+'</b>'+
   rankBadges({[rankKind]:u.rank},rankSnapshot.day)+'</span><span class="rank-visits">방문 '+
   Number(u.visits).toLocaleString('ko-KR')+'회</span></span><span class="rank-arrow" aria-hidden="true">›</span></button>').join('')||
   (expired?'<p class="rank-empty">새 날짜의 랭킹을 확인해 주세요. <button data-rank-retry>다시 불러오기</button></p>':'<p class="rank-empty">아직 표시할 방문 랭킹이 없어요.</p>');
}
async function openRanking(epoch){
 clearTimeout(rankRollover);rankSnapshot=null;
 $('other').innerHTML='<div class="ranking-view"><h1>탐색</h1>'+exploreNav('ranking')+
   '<div class="rank-switch" role="group" aria-label="랭킹 종류"><button data-rank-kind="total" aria-pressed="false">누적 랭킹</button>'+
   '<button data-rank-kind="daily" aria-pressed="true">일일 랭킹</button></div><p id="rankingNote"></p>'+
   '<section id="rankingList" aria-live="polite" aria-label="방문 랭킹"><p class="rank-empty">랭킹을 불러오는 중…</p></section></div>';
 if(!rankRequest)rankRequest=api('visit-rankings').finally(()=>{rankRequest=null});
 try{
   const result=await rankRequest;
   if(epoch!==routeEpoch||locked)return;
   rankSnapshot=result;drawRanking();
   const untilMidnight=86400000-(Date.now()+32400000)%86400000;
   rankRollover=setTimeout(()=>{if(epoch===routeEpoch)drawRanking()},untilMidnight+20);
 }catch{
   if(epoch===routeEpoch&&!locked)$('rankingList').innerHTML='<p class="rank-empty">랭킹을 불러오지 못했어요. <button data-rank-retry>다시 시도</button></p>';
 }
}
function galleryBadges(g){
 const badges=rankBadges(g?.badges,data.rankDay);
 return badges?'<div class="visit-badges">'+badges+'</div>':'';
}
function loadProfileRanks(id){
 return api('profiles/'+encodeURIComponent(id)+'/visit-ranks');
}
function directoryProfileRanks(id){
 return {badges:data.galleries.find(g=>g.owner===id)?.badges,rankDay:data.rankDay};
}
function refreshBoardRanks(id,entry){
 loadProfileRanks(id).then(result=>{
   if(!locked&&entry===boardEntry&&visiting===id){boardRanks=result;boardProfile()}
 }).catch(()=>{});
}
function galleryCard(g){let p=person(g.owner);return '<article class="exhibition-card"><button class="board-cover-button" data-profile="'+esc(g.owner)+'">'+coverCanvas(g.id)+'</button><div class="exhibition-info"><h3>'+esc(g.title)+'</h3><button class="beta-save" data-beta-save="'+esc(g.id)+'" aria-label="전시관 저장">'+icon('bookmark')+(data.saved.includes(g.id)?' 저장됨':'')+'</button><button class="author-button" data-profile="'+esc(g.owner)+'">'+avatar(p)+'<span>'+esc(p?.name)+' · @'+esc(p?.handle)+'</span></button>'+galleryBadges(g)+statsHTML(g.stats)+'</div></article>'}
let coverObserver;
function drawCovers(){
 coverObserver?.disconnect();
 const galleries=new Map(data.galleries.map(g=>[g.id,g]));
 const canvases=document.querySelectorAll('[data-beta-cover]');
 const paint=async canvas=>{
   const b=galleries.get(canvas.dataset.betaCover)?.coverBoard;
   if(!b)return;
   const sources=new Set([b.background.image,...b.items.map(o=>o.type==='photo'?o.content:
     o.type==='sticker'?window.MuseStickers?.url(o.content):null)]);
   await Promise.all([...sources].filter(Boolean).map(src=>{
     if(getImage(src))return;
     const im=images.get(src);
     if(!im||im.complete)return;
     return new Promise(resolve=>{
       function done(){im.removeEventListener('load',done);im.removeEventListener('error',done);resolve()}
       im.addEventListener('load',done);im.addEventListener('error',done);
     });
   }));
   if(canvas.isConnected)paintCover(canvas,b,Number(canvas.dataset.coverSize));
 };
 for(const canvas of canvases){
   const cover=galleries.get(canvas.dataset.betaCover)?.coverBoard.cover;
   if(cover){
     const scale=Number(canvas.dataset.coverSize)/Math.max(cover.w,cover.h);
     canvas.width=Math.max(1,Math.round(cover.w*scale));canvas.height=Math.max(1,Math.round(cover.h*scale));
     canvas.parentElement.style.setProperty('--cover-ratio',canvas.width/canvas.height);
   }
 }
 if(!('IntersectionObserver' in window)){canvases.forEach(paint);return}
 coverObserver=new IntersectionObserver((entries,observer)=>{
   for(const entry of entries)if(entry.isIntersecting){
     observer.unobserve(entry.target);
     if(entry.target.isConnected)paint(entry.target);
   }
 },{rootMargin:'160px'});
 canvases.forEach(canvas=>coverObserver.observe(canvas));
}
function friendRow(p){return '<div class="friend-row"><button class="author-button" data-profile="'+esc(p.id)+'">'+avatar(p)+'</button><div class="person"><b>'+esc(p.name)+'</b>'+(mutual(p)?'<span class="relation-label">맞팔 친구</span>':'')+'<p>@'+esc(p.handle)+' · #'+esc(p.code)+'</p><small>'+esc(p.bio)+'</small></div><button data-dm="'+esc(p.id)+'" aria-label="'+esc(p.name)+'에게 메시지">'+icon('message')+'</button><button data-follow="'+esc(p.id)+'" class="'+(follows(p)?'':'primary')+'">'+(follows(p)?'팔로잉':'팔로우')+'</button></div>'}
function followCounts(p,board=false){
 return [['followers','팔로워',p.followerCount],['following','팔로잉',p.followingCount]].map(([kind,label,count])=>
   '<button type="button" data-follow-list="'+kind+'" data-owner="'+esc(p.id)+'" aria-haspopup="dialog">'+
   '<b>'+esc(count)+'</b>'+(board?'<span>'+label+'</span>':' '+label)+'</button>').join('');
}
async function showFollowList(owner,kind){
 const title=kind==='followers'?'팔로워':'팔로잉';
 openDialog(title,'<div id="followListResults" class="follow-list-results" aria-live="polite"><p>목록을 불러오는 중…</p></div>');
 const results=$('followListResults');
 try{
   const {users}=await api('profiles/'+encodeURIComponent(owner)+'/'+kind);
   if(!results.isConnected||!$('dialog').open)return;
   results.innerHTML=users.length?'<ul>'+users.map(p=>'<li>'+avatar(p)+'<div><b>'+esc(p.name)+'</b><small>@'+esc(p.handle)+'</small></div></li>').join('')+'</ul>':
     '<p>'+(kind==='followers'?'표시할 팔로워가 없어요.':'표시할 팔로잉 계정이 없어요.')+'</p>';
 }catch(err){
   if(results.isConnected&&$('dialog').open)results.textContent=err.message;
 }
}
async function route(next,id=null,opts={}){if(!ready||locked)return;const epoch=++routeEpoch;++boardEntry;clearTimeout(rankRollover);if(next==='explore'&&id==='ranking'&&(page!==next||profileId!==id))rankKind='daily';coverObserver?.disconnect();sceneImages.clear();window.MuseMessages?.leave();clearInterval(heartbeat);stopMusic();page=next;profileId=id;visiting=null;boardRanks=null;remote=null;guestBoard=null;document.body.classList.remove('board-active','board-view','board-edit','messages-active');$('editor').hidden=true;$('landing').hidden=true;$('other').hidden=false;$('accountMenu').hidden=true;document.querySelectorAll('#sidebar [data-page],#bottomNav [data-route]').forEach(button=>{
 const current=(button.dataset.page||button.dataset.route)===next;
 button.classList.toggle('active',current);
 if(current)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
});if(opts.hash!==false)window.history.pushState(null,'','#'+next+(id?'/'+encodeURIComponent(id):''));try{if(next==='explore'&&id==='ranking'){await openRanking(epoch);return}if(!opts.local&&(Date.now()-directoryAt>20000||data.rankDay!==seoulRankDay())&&['home','explore','saved','friends'].includes(next))refreshDirectory().then(()=>{if(routeEpoch===epoch&&!locked)route(next,id,{hash:false,local:true})}).catch(()=>toast('최신 목록을 가져오지 못했어요. 다시 시도해주세요.'));if(next==='profile'||next==='board'&&id&&id!==account.id||next==='admin'||next==='notifications'){
 $('other').innerHTML='<div class="route-loading" role="status"><span></span><span></span><span></span><p>불러오는 중…</p></div>';
}if(next==='intro'||next==='profile'){await enter(next==='intro'?account.id:id||account.id);return}if(next==='messages'){window.MuseMessages.mount(id);return}if(next==='board'){await enter(id||account.id);return}if(next==='admin'){await admin();return}if(next==='about'){let p=person(id||account.id);if(!p){$('other').innerHTML=empty('찾을 수 없는 관장이에요.');return}let g=data.galleries.find(g=>g.owner===p.id),own=p.id===account.id;$('other').innerHTML=heading(own?'내 전시관':esc(p.name)+'의 전시관','취향이 모여 하나의 세계가 되는 곳.')+'<div class="beta-profile"><div class="beta-profile-head">'+avatar(p)+'<div><div class="ranked-name"><h2>'+esc(p.name)+'</h2><span id="aboutVisitBadges" class="visit-badges">'+rankBadges(g?.badges,data.rankDay)+'</span></div><p>@'+esc(p.handle)+' · #'+esc(p.code)+'</p><p>'+esc(p.bio||'아직 소개를 작성하지 않았어요.')+'</p></div></div><div class="profile-follow">'+followCounts(p)+'</div>'+statsHTML(getStats(p.id))+'<h3>'+esc(p.gallery)+'</h3>'+(g?'<button class="board-cover-button beta-cover-large" data-enter="'+esc(p.id)+'">'+coverCanvas(p.id,900)+'</button>':'<div class="beta-unpublished">아직 공개하지 않은 공간이에요.</div>')+'<div class="entry-actions">'+(own||g?'<button class="primary" data-enter="'+esc(p.id)+'">입장하기 '+icon('arrow')+'</button>':'')+(own?'<button data-edit-own>꾸미기</button><button data-profile-edit>프로필 수정</button><button data-beta-manage>관리</button>':'<button data-follow="'+esc(p.id)+'">'+(follows(p)?'팔로잉':'팔로우')+'</button><button data-dm="'+esc(p.id)+'">메시지</button>')+(g?'<button data-share-gallery="'+esc(p.id)+'">'+icon('share')+' 공유</button>':'')+'</div><p class="fine">친구 가림막은 맞팔 친구에게만 열려요. 관장 본인의 방문을 제외하고, 전시관에 입장할 때마다 집계해요.</p></div>';
 drawCovers();
 const badgeSlot=$('aboutVisitBadges');
 loadProfileRanks(p.id).then(result=>{
   if(!locked&&epoch===routeEpoch&&badgeSlot.isConnected)badgeSlot.innerHTML=rankBadges(result.badges,result.rankDay);
 }).catch(()=>{});
 return}if(next==='friends'){let list=data.users.filter(p=>p.id!==account.id&&!data.blocked.includes(p.id)&&(/^#?\d{8}$/.test(query.trim())?p.code===query.trim().replace(/^#/,''):tab==='mutual'&&mutual(p)||tab==='following'&&follows(p)||tab==='followers'&&data.followers.includes(p.id))).filter(p=>[p.name,p.handle,p.code].join(' ').toLowerCase().includes(query.trim().replace(/^#/,'').toLowerCase()));$('other').innerHTML=heading('친구','팔로우 관계를 관리하거나 #8자리 코드로 찾아보세요.')+'<label class="friend-search">'+icon('search')+'<input id="betaFriendSearch" aria-label="관장 검색" placeholder="이름 또는 #8자리 코드" value="'+esc(query)+'"></label><div class="section-tabs">'+[['mutual','맞팔 친구'],['following','팔로잉'],['followers','팔로워']].map(([k,v])=>'<button data-friend-tab="'+k+'" class="'+(tab===k?'active':'')+'">'+v+'</button>').join('')+'</div><div class="friend-list">'+(list.length?list.map(friendRow).join(''):'<div class="empty-social"><h2>아직 연결된 관장이 없어요.</h2><p>위 검색창에 #8자리 코드를 입력하거나 탐색에서 전시관을 만나보세요.</p><button data-route="explore">전시관 탐색</button></div>')+'</div>';return}if(next==='notifications'){let b=await loadActivity();if(epoch!==routeEpoch)return;$('other').innerHTML=heading('나에게 온 이야기','친구들이 전하는 작은 관심들.')+'<button id="betaReadAll">모두 읽음</button><div class="friend-list">'+(b.items.length?b.items.map(n=>'<div class="notification-row '+(!n.read_at?'unread':'')+'">'+avatar(person(n.actor))+'<p><b>'+esc(person(n.actor)?.name||'관장')+'</b>'+(n.kind==='guestbook'?'님이 방명록을 남겼어요.':'님이 나를 팔로우했어요.')+'</p><button data-profile="'+esc(n.actor)+'">전시관 보기</button></div>').join(''):empty('새로운 알림이 없어요.'))+'</div>';$('betaReadAll').onclick=async()=>{await api('activity/read','POST',{});activityAt=0;await loadActivity();route('notifications')};return}const feed=next==='home'?'home':next==='saved'?'saved':'explore';const gs=(data.feeds?.[feed]||[]).map(id=>data.galleries.find(g=>g.id===id)).filter(Boolean);const title={home:'홈',saved:'저장한 전시관',explore:'탐색'}[feed];const subtitle={home:'팔로우한 관장의 전시관 소식',saved:'다시 보고 싶은 전시관을 모아뒀어요.',explore:'다양한 관장의 공개 전시관을 둘러보세요.'}[feed];const emptyFeed=feed==='home'?'<div class="empty-social"><h2>팔로우한 관장의 새 소식이 없어요.</h2><p>탐색에서 마음에 드는 관장을 만나 팔로우해 보세요.</p><button data-route="explore">전시관 탐색</button></div>':empty(feed==='saved'?'아직 저장한 전시관이 없어요.':'아직 둘러볼 공개 전시관이 없어요.');$('other').innerHTML=heading(title,subtitle)+(feed==='explore'?exploreNav('browse'):'')+(gs.length?'<div class="explore-grid">'+gs.map(galleryCard).join('')+'</div>':emptyFeed)+'<div class="social-footer">muse. Everyone is a museum.<br>취향으로 연결되는 MUSE 베타</div>';drawCovers()}catch(e){if(!locked&&epoch===routeEpoch)$('other').innerHTML=empty(esc(e.message))}}
function boardProfile(){if(!visiting)return;let p=person(visiting)||remote?.owner||account,own=p.id===account.id,s=remote?.stats||getStats(p.id);$('boardProfile').innerHTML='<div class="bp-main"><button data-route="'+(own?'about':'about')+'" data-id="'+esc(p.id)+'" aria-label="전시관 소개로 돌아가기">←</button>'+avatar(p)+'<div class="bp-identity"><div class="ranked-name"><h1>'+esc(p.name)+(mutual(p)?'<span class="relation-label">맞팔 친구</span>':'')+'</h1><span class="visit-badges">'+rankBadges(boardRanks?.badges,boardRanks?.rankDay)+'</span></div><div>@'+esc(p.handle)+' · #'+esc(p.code)+'</div></div><div class="bp-actions">'+(own?'<button class="primary" data-edit-own>꾸미기</button><button data-profile-edit>프로필 수정</button><button data-beta-manage aria-label="전시관 관리">'+icon('settings')+'</button><button data-owner-mask aria-pressed="'+preview+'" aria-label="친구 가림막 미리보기">'+icon('cloud')+'</button>':'<button data-follow="'+esc(p.id)+'">'+(follows(p)?'팔로잉':'팔로우')+'</button><button data-dm="'+esc(p.id)+'" aria-label="메시지 보내기">'+icon('message')+'</button>')+'<button data-guestbook="'+esc(p.id)+'" aria-label="방명록">'+icon('message')+'</button><button data-share-gallery="'+esc(p.id)+'" aria-label="전시관 공유">'+icon('share')+'</button></div></div><div class="bp-description"><b>'+esc(p.gallery)+'</b><p>'+esc(p.bio)+'</p></div><div class="bp-bottom"><div class="bp-stats">'+followCounts(p,true)+'<i></i><div><b>'+s.total+'</b><span>누적 방문</span></div><div><b>'+s.today+'</b><span>오늘 방문</span></div><div><b>'+s.live+'</b><span>관람 중</span></div></div><span class="bp-guest-label">'+(own?'내 초안 관람':remote?.friend?'친구로 관람 중':'공개 구역 관람 중')+'</span></div>';$('boardProfile').hidden=mode!=='view'}
async function enter(id,objectId=null){if(locked)return;let entry=++boardEntry;stopMusic();window.MuseMessages?.leave();clearInterval(heartbeat);page='board';profileId=id;let own=id===account.id;let result=own?null:await api('galleries/'+encodeURIComponent(id)+'?ranks=1');if(entry!==boardEntry||locked)return;boardRanks=own?directoryProfileRanks(id):result;remote=result;guestBoard=remote?.board||null;visiting=id;if(location.hash!=='#board/'+encodeURIComponent(id))window.history.pushState(null,'','#board/'+encodeURIComponent(id));$('version').value='draft';document.querySelector('.board-top b').textContent=own?account.gallery:remote.title;showEditor('view');preview=!own&&!remote.friend;$('viewMode').hidden=!own;$('saveState').hidden=!own;$('viewOptions').hidden=true;boardProfile();render();playMusic();
 if(own)refreshBoardRanks(id,entry);
 if(objectId){let o=activeState().items.find(o=>o.id===objectId);if(o){cam=E.camera({x:o.x+o.w/2,y:o.y+o.h/2,z:1},viewport);render();window.MuseMessages.detail(o.id)}else toast('삭제되었거나 친구 가림막으로 보호된 전시품이에요.')}if(!own){let visitStats=await api('visits/'+encodeURIComponent(id),'POST',{entry:true});if(visiting!==id||entry!==boardEntry)return;remote.stats=visitStats;boardProfile();let checking=false;heartbeat=setInterval(async()=>{
 if(checking||document.visibilityState!=='visible')return;
 checking=true;
 try{
   const query=guestBoard===remote.board?'?known='+encodeURIComponent(remote.updated)+'&friend='+remote.friend:'';
   const next=await api('galleries/'+encodeURIComponent(id)+query);
   if(visiting!==id||entry!==boardEntry)return;
   if(!next.unchanged){
     remote={...next,stats:remote.stats};guestBoard=next.board;preview=!next.friend;
     if(musicSource(next.board.music)!==(audio.getAttribute('src')||''))playMusic();
     else if(next.board.music){audio.loop=next.board.music.loop!==false;audio.volume=next.board.music.volume??.25;}
     images.clear();window.MuseMessages.closeDetail();
     document.querySelectorAll('dialog[open]').forEach(d=>d.close());
     render();
   }
   const stats=await api('visits/'+encodeURIComponent(id),'PATCH',{});
   if(visiting!==id||entry!==boardEntry)return;
   if(!remote.stats||['total','today','live'].some(key=>stats[key]!==remote.stats[key])){
     remote.stats=stats;boardProfile();
   }
 }catch{
   if(visiting===id&&entry===boardEntry&&guestBoard===remote.board){
     guestBoard=blank();stopMusic();images.clear();window.MuseMessages.closeDetail();render();
   }
 }finally{checking=false}
},5000)}}
function editOwn(){clearInterval(heartbeat);++boardEntry;if(visiting!==account.id)boardRanks=directoryProfileRanks(account.id);visiting=account.id;remote=null;guestBoard=null;$('version').value='draft';document.querySelector('.board-top b').textContent=account.gallery;showEditor('edit');$('viewMode').hidden=false;$('saveState').hidden=false;stopMusic()}
async function follow(id){let p=person(id);if(!p)return;let apply=async()=>{await api('follows','POST',{target:id,following:!follows(p)});await refreshDirectory();if(visiting){if(visiting!==account.id){remote=await api('galleries/'+encodeURIComponent(visiting));guestBoard=remote.board;preview=!remote.friend;images.clear();window.MuseMessages.closeDetail()}boardProfile();render()}else route(page,profileId)};if(!follows(p)&&data.followers.includes(id))openDialog('맞팔 친구가 됩니다','<p>서로의 친구 가림막 안의 기록이 공개됩니다.</p><button id="confirmBetaFollow" class="primary">확인하고 팔로우</button>',()=>{$('confirmBetaFollow').onclick=async()=>{$('dialog').close();try{await apply()}catch(e){toast(e.message)}}});else await apply()}
function themeSettings(){
 const selected=window.MuseTheme.get();
 const options=[['system','시스템 설정에 따름'],['light','라이트 모드'],['dark','다크 모드']];
 openDialog('화면 테마','<fieldset class="theme-options"><legend>테마 선택</legend>'+
   options.map(([value,label])=>'<label><input type="radio" name="theme" value="'+value+'" '+
     (value===selected?'checked':'')+'><span>'+label+'</span></label>').join('')+'</fieldset>',()=>{
   $('dialog').querySelector('.theme-options').onchange=e=>{
     window.MuseTheme.set(e.target.value);
     $('dialog').dataset.edited='';
   };
 });
}
function profileEdit(){openDialog('프로필 수정','<label>이름<input id="betaName" maxlength="25" value="'+esc(account.name)+'"></label><label>소개<textarea id="betaBio" rows="3" maxlength="150">'+esc(account.bio)+'</textarea></label><label>전시관 이름<input id="betaTitle" maxlength="60" value="'+esc(account.gallery)+'"></label><p>공개 계정 코드: #'+esc(account.code)+'</p><button id="saveBetaProfile" class="primary">저장</button>',()=>{$('saveBetaProfile').onclick=async()=>{const button=$('saveBetaProfile');button.disabled=true;try{await api('profile','PATCH',{name:$('betaName').value,bio:$('betaBio').value,gallery:$('betaTitle').value});await refreshDirectory();$('dialog').close();visiting?boardProfile():route(page,profileId)}catch(e){toast(e.message)}finally{button.disabled=false}}})}
async function logout(){if(dirty){await saveBoard();dirty=false}await window.MuseAuth.request('logout',{});lock('로그아웃했어요.')}
function manage(){openDialog('전시관 관리','<p>초안은 계정별 서버에 자동 저장됩니다. 공개하기를 눌러 친구에게 반영하세요.</p><div class="dm-menu"><button id="betaBackup">현재 보드 JSON 백업</button><button id="betaRestore">JSON 백업 가져오기</button><input id="betaRestoreFile" type="file" accept="application/json" hidden><button id="betaReload">서버 초안 다시 불러오기</button><button id="betaBackups">최근 서버 복구본</button><button id="betaLegacy">이전 프로토타입 보드 가져오기</button><button id="betaRecovery">이 기기의 미동기화 복구본 내려받기</button><button id="betaMusicSettings">배경음악 설정</button><button id="betaExport">내 데이터 내보내기</button><button id="betaPrivacy">개인정보 안내</button>'+(['admin','super_admin'].includes(role)?'<button id="betaAdmin">관리자 대시보드</button><button id="betaManageLogout">로그아웃</button>':'<button id="betaManageLogout">로그아웃</button><button class="danger" id="betaDelete">계정 삭제</button>')+'</div><p>사진 원본 10MB 이하 · 최적화 후 장당 2MB · 계정 사진 저장 한도 50MB</p>',()=>{$('betaBackup').onclick=()=>download('muse-board.json',state);$('betaRecovery').onclick=()=>window.MuseRecovery?download('muse-recovery.json',window.MuseRecovery):toast('미동기화 복구본이 없어요.');$('betaRestore').onclick=()=>$('betaRestoreFile').click();$('betaRestoreFile').onchange=async e=>{try{let b=JSON.parse(await e.target.files[0].text());E.fitWorld(b);validate(b);beginChange();state=b;changed();$('dialog').close();drawCover()}catch{toast('올바른 MUSE 보드 JSON을 선택하세요.')}};$('betaReload').onclick=async()=>{try{let b=await api('board/draft');download('muse-before-reload.json',state);state=b.board;window.MuseDraftRevision=b.revision;conflict=false;dirty=false;history=[];future=[];await storeRecord('draft',snapshot());$('dialog').close();render();drawCover()}catch(e){toast(e.message)}};$('betaBackups').onclick=async()=>{let b=await api('board/backups');openDialog('최근 서버 복구본',b.backups.length?b.backups.map(r=>'<button data-cloud-backup="'+esc(r.id)+'">'+new Date(r.created).toLocaleString('ko-KR')+' 내려받기</button>').join(''):'<p>5분 이상 간격의 저장 때 이전 버전을 최근 5개까지 보관해요.</p>')};$('betaLegacy').onclick=legacy;$('betaMusicSettings').onclick=musicSettings;$('betaExport').onclick=async()=>download('muse-account.json',await api('account/export'));$('betaPrivacy').onclick=privacy;$('betaManageLogout').onclick=async()=>{try{await logout()}catch(e){toast(e.message)}};if($('betaAdmin'))$('betaAdmin').onclick=()=>{$('dialog').close();route('admin')};if($('betaDelete'))$('betaDelete').onclick=()=>openDialog('계정 삭제','<p>사진·보드·관계·작성 메시지 본문을 삭제합니다. 복구할 수 없으므로 먼저 데이터를 내보내세요.</p><label>확인 문구<input id="deleteConfirm" placeholder="계정 삭제"></label><button id="deleteNow" class="danger">계정 삭제 실행</button>',()=>{$('deleteNow').onclick=async()=>{try{await api('account/delete','POST',{confirm:$('deleteConfirm').value});lock('계정을 삭제했어요.');$('authGate').innerHTML+='<a class="primary auth-link" target="_top" href="/">로그인 화면으로</a>'}catch(e){toast(e.message)}}})})}
async function legacy(){try{let stored=await new Promise((resolve,reject)=>{let r=indexedDB.open('muse-prototype-v2',1);r.onupgradeneeded=()=>r.result.createObjectStore('boards');r.onsuccess=()=>{let db=r.result,g=db.transaction('boards').objectStore('boards').get('draft');g.onsuccess=()=>{resolve(g.result);db.close()};g.onerror=reject};r.onerror=reject});if(!stored){toast('이 브라우저에 이전 보드가 없어요.');return}openDialog('이전 보드 가져오기','<p>기존 공용 보드 원본은 유지합니다. 현재 초안을 먼저 JSON으로 백업하고 이 계정에 가져옵니다.</p><button id="legacyConfirm" class="primary">내 보드로 가져오기</button>',()=>{$('legacyConfirm').onclick=()=>{E.fitWorld(stored);validate(stored);download('muse-before-import.json',state);beginChange();state=stored;changed();drawCover();$('dialog').close()}})}catch{toast('이전 보드를 읽지 못했어요. JSON 백업을 사용해주세요.')}}
let adminMemberSearch='',adminMemberStatus='all';
function drawAdminMembers(members){
 const query=adminMemberSearch.trim().toLowerCase().replace(/^[@#]/,'');
 const filtered=members.filter(m=>(adminMemberStatus==='all'||(m.active?'active':'suspended')===adminMemberStatus)&&
   [m.name,m.handle,m.code].some(value=>String(value||'').toLowerCase().includes(query)));
 $('adminMembers').innerHTML=filtered.map(m=>`<div class="beta-admin-member">
   <div><b>${esc(m.name)}</b><br><small>@${esc(m.handle)} · #${esc(m.code)} · ${m.active?'활성':'이용 정지'}</small></div>
   ${['admin','super_admin'].includes(m.role)?'<small>관리자</small>':`<div class="admin-member-actions">
     <button data-suspend-user="${esc(m.user_id)}" data-suspended="${!!m.active}" data-handle="${esc(m.handle)}">${m.active?'이용 정지':'정지 해제'}</button>
     <button class="danger" data-delete-user="${esc(m.user_id)}" data-handle="${esc(m.handle)}">계정 삭제</button>
   </div>`}</div>`).join('')||'<p>조건에 맞는 회원이 없어요.</p>';
}
function confirmMemberAction({userId,handle,remove,suspended}){
 const action=remove?'계정 삭제':suspended?'이용 정지':'정지 해제';
 const consequence=remove?'전시관과 업로드한 사진이 삭제되고, 해당 계정으로 로그인할 수 없어요.':
   suspended?'회원의 서비스 이용을 중지해요.':'회원이 다시 서비스를 이용할 수 있어요.';
 openDialog(remove?'회원 계정 삭제':'회원 이용 상태 변경',
   '<p><b>@'+esc(handle)+'</b> · '+action+'</p><p>'+consequence+'</p><button id="memberActionExecute" class="'+(remove||suspended?'danger':'primary')+'">'+action+'</button>',
   ()=>{$('memberActionExecute').onclick=async()=>{
     const button=$('memberActionExecute');
     button.disabled=true;
     try{
       await api(remove?'admin/members/delete':'admin/suspend','POST',remove?{userId,confirm:true}:{userId,suspended});
       $('dialog').close();
       toast(action+' 처리했어요.');
       await admin();
     }catch(err){
       if(err.status===403&&err.message.includes('재인증')){
         $('dialog').close();
         window.MuseAuth.adminReauth(()=>confirmMemberAction({userId,handle,remove,suspended}));
       }else toast(err.message);
     }finally{button.disabled=false}
   }});
}
async function admin(){let epoch=routeEpoch,b=await api('admin/overview');if(epoch!==routeEpoch)return;$('other').innerHTML=heading('MUSE 관리자','활성 회원 '+b.members.filter(u=>u.active).length+'명 · '+(role==='super_admin'?'최고 관리자':'관리자'))+(passwordOnlyAdmin?'<div class="rail-panel"><p>테스트 관리자 계정으로 로그인되어 있어요.</p></div>':'<div class="rail-panel"><h3>중요 작업 보호</h3><p>회원 정지·삭제 및 신고 처리 전 비밀번호와 인증 앱 코드로 재인증해주세요. 최고 관리자는 이 화면에서 정지·삭제·권한 변경을 할 수 없어요.</p><button id="adminStepUp" class="primary">관리 작업 재인증</button></div>')+'<div class="rail-panel"><h3>신고 처리</h3>'+(b.reports.length?b.reports.map(r=>'<article class="beta-report"><b>'+esc(r.reason)+'</b><small>'+esc(r.status)+'</small><pre>'+esc(r.evidence||'사용자 신고')+'</pre><button data-report-review="'+esc(r.id)+'" data-status="reviewed">처리 완료</button><button data-report-review="'+esc(r.id)+'" data-status="dismissed">기각</button></article>').join(''):'<p>접수된 신고가 없어요.</p>')+'</div><div class="rail-panel"><h3>회원 관리</h3><div class="admin-member-filters"><input id="adminMemberSearch" type="search" aria-label="회원 검색" placeholder="이름·아이디·식별 번호" value="'+esc(adminMemberSearch)+'"><select id="adminMemberStatus" aria-label="회원 상태"><option value="all">전체</option><option value="active">활성</option><option value="suspended">이용 정지</option></select></div><div id="adminMembers"></div></div><div class="rail-panel"><h3>운영 기록</h3>'+b.events.map(e=>'<p>'+esc(e.kind)+' · '+e.count+'건</p>').join('')+'<p>서버 오류는 호스팅 Worker 로그에서 확인할 수 있어요.</p></div>';
 $('adminMemberStatus').value=adminMemberStatus;
 $('adminMemberStatus').onchange=e=>{adminMemberStatus=e.target.value;drawAdminMembers(b.members)};
 $('adminMemberSearch').oninput=e=>{adminMemberSearch=e.target.value;drawAdminMembers(b.members)};
 drawAdminMembers(b.members);if($('adminStepUp'))$('adminStepUp').onclick=()=>window.MuseAuth.adminReauth(()=>toast('5분 동안 관리 작업을 실행할 수 있어요.'))}

async function guestbook(gid){let b=await api('guestbook/'+encodeURIComponent(gid));openDialog('전시관 방명록','<p>이 전시관을 방문한 회원에게 보이는 글이에요.</p><form id="guestForm"><label>짧은 인사<textarea id="guestBody" maxlength="500" required></textarea></label><button class="primary">남기기</button></form><div class="guestbook-list">'+b.items.map(g=>'<article><b>'+esc(g.name)+'</b><small>'+new Date(g.created).toLocaleString('ko-KR')+'</small><p>'+esc(g.body)+'</p>'+(g.author===account.id||gid===account.id?'<button data-delete-guest="'+esc(g.id)+'">삭제</button>':'<button data-report-guest="'+esc(g.author)+'">신고</button>')+'</article>').join('')+'</div>',()=>{$('guestForm').onsubmit=async e=>{e.preventDefault();try{await api('guestbook/'+encodeURIComponent(gid),'POST',{body:$('guestBody').value});await guestbook(gid)}catch(e){toast(e.message)}};document.querySelectorAll('[data-delete-guest]').forEach(btn=>btn.onclick=async()=>{await api('guestbook/'+encodeURIComponent(gid),'DELETE',{id:btn.dataset.deleteGuest});guestbook(gid)});document.querySelectorAll('[data-report-guest]').forEach(btn=>btn.onclick=async()=>{await api('reports','POST',{target:btn.dataset.reportGuest,reason:'방명록 신고'});toast('신고를 접수했어요.')})})}
const audio=new Audio();
let muted=localStorage.getItem('muse-music-muted')==='1';
audio.muted=muted;
function musicSource(m){
 return m?.track==='quiet'?'/assets/muse-quiet.wav':
   m?.track==='upload'&&/^[a-f0-9-]{36}$/.test(m.id)?'/api/audio/'+m.id:'';
}
function stopMusic(){
 audio.pause();
 if(audio.hasAttribute('src')){audio.removeAttribute('src');audio.load()}
 if($('betaMusic'))$('betaMusic').hidden=true;
}
function startMusic(){
 const src=audio.getAttribute('src');
 if(!src)return;
 audio.play().catch(error=>{
   if(error.name!=='AbortError'&&audio.getAttribute('src')===src)
     toast(error.name==='NotAllowedError'?'배경음악을 들으려면 재생 버튼을 눌러주세요.':'배경음악을 재생하지 못했어요.');
 });
}
function playMusic(){
 const m=activeState().music,src=musicSource(m);
 if(!src){stopMusic();return}
 let box=$('betaMusic');
 if(!box){
   box=document.createElement('div');box.id='betaMusic';
   box.innerHTML='<button id="playBetaMusic">재생</button><button id="muteBetaMusic" aria-label="배경음악 음소거"></button>';
   $('stage').append(box);
   const play=$('playBetaMusic'),mute=$('muteBetaMusic');
   const updatePlay=()=>{play.textContent=audio.paused?'재생':'일시정지'};
   const updateMute=()=>{mute.textContent=muted?'음소거 해제':'음소거';mute.setAttribute('aria-pressed',String(muted))};
   for(const event of ['play','pause','ended','error'])audio.addEventListener(event,updatePlay);
   play.onclick=()=>{if(audio.paused){if(audio.error)audio.load();startMusic()}else audio.pause()};
   mute.onclick=()=>{muted=!muted;audio.muted=muted;localStorage.setItem('muse-music-muted',muted?'1':'0');updateMute()};
   updateMute();
 }
 box.hidden=false;audio.loop=m.loop!==false;audio.volume=m.volume??.25;
 if(audio.getAttribute('src')!==src)audio.src=src;
 startMusic();
}
function musicSettings(){
 const current=state.music||{track:'none',volume:.25};
 let selected=current.track==='upload'?{id:current.id,name:current.name}:null;
 openDialog('전시관 배경음악',
   '<label>곡<select id="betaTrack"><option value="none">음악 없음</option><option value="quiet">Quiet room · MUSE original</option>'+
   '<option value="upload"'+(selected?'':' disabled')+'>업로드한 음악</option></select></label>'+
   '<label>음악 파일<input id="betaAudioFile" type="file" accept=".mp3,.m4a,.aac,.wav,audio/mpeg,audio/mp4,audio/aac,audio/wav"></label>'+
   '<small>MP3, M4A/AAC, WAV · 최대 12MB</small><progress id="betaAudioProgress" max="100" hidden></progress>'+
   '<p id="betaAudioStatus" role="status"></p><audio id="betaAudioPreview" controls preload="none" hidden></audio>'+
   '<label>음량<input id="betaVolume" type="range" min="0" max="1" step="0.05"></label>'+
   '<label><input id="betaMusicLoop" type="checkbox"> 반복 재생</label>'+
   '<button id="saveBetaMusic" class="primary">설정 저장</button>',()=>{
   const dialog=$('dialog'),track=$('betaTrack'),input=$('betaAudioFile'),progress=$('betaAudioProgress'),
     message=$('betaAudioStatus'),sample=$('betaAudioPreview'),save=$('saveBetaMusic'),
     volume=$('betaVolume'),loop=$('betaMusicLoop');
   let upload=null;
   track.value=current.track;volume.value=current.volume;loop.checked=current.loop!==false;
   const choice=()=>({track:track.value,...(track.value==='upload'?selected:{}),volume:Number(volume.value),loop:loop.checked});
   function updatePreview(){
     const src=musicSource(choice());
     sample.pause();sample.hidden=!src;
     if(src)sample.src=src;else sample.removeAttribute('src');
     sample.load();sample.volume=Number(volume.value);sample.loop=loop.checked;
     message.textContent=track.value==='upload'?selected.name:'';
   }
   track.onchange=updatePreview;
   volume.oninput=()=>{sample.volume=Number(volume.value)};
   loop.onchange=()=>{sample.loop=loop.checked};
   sample.onerror=()=>{if(sample.getAttribute('src'))message.textContent='미리 듣기에 실패했어요. 이 브라우저에서 파일을 재생할 수 있는지 확인해 주세요.'};
   dialog.addEventListener('close',()=>{
     upload?.abort();sample.pause();sample.removeAttribute('src');sample.load();
   },{once:true});
   input.onchange=()=>{
     const file=input.files[0];
     if(!file)return;
     if(file.size>12*1024*1024){message.textContent='음악 파일은 12MB까지 올릴 수 있어요.';input.value='';return}
     const xhr=upload=new XMLHttpRequest();
     xhr.open('POST','/api/audio');xhr.responseType='json';
     xhr.setRequestHeader('x-muse-account',account.id);
     const extension=file.name.split('.').at(-1).toLowerCase();
     xhr.setRequestHeader('content-type',({mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',wav:'audio/wav'})[extension]||file.type||'application/octet-stream');
     progress.hidden=false;progress.removeAttribute('value');save.disabled=track.disabled=input.disabled=true;
     message.textContent='음악을 업로드하고 있어요…';
     xhr.upload.onprogress=e=>{if(e.lengthComputable)progress.value=e.loaded/e.total*100};
     xhr.onload=()=>{
       if(!input.isConnected)return;
       if(xhr.status===201&&xhr.response?.id){
         selected={id:xhr.response.id,name:file.name.slice(0,120)};
         track.querySelector('[value="upload"]').disabled=false;track.value='upload';updatePreview();
       }else message.textContent=xhr.response?.error||'업로드하지 못했어요. 다시 시도해 주세요.';
     };
     xhr.onerror=()=>{if(input.isConnected)message.textContent='연결이 끊겼어요. 다시 시도해 주세요.'};
     xhr.onloadend=()=>{upload=null;progress.hidden=true;save.disabled=track.disabled=input.disabled=false;input.value=''};
     xhr.send(file);
   };
   save.onclick=()=>{
     const next=choice();
     beginChange();state.music=next;changed();
     dialog.close();toast('음악을 초안에 저장했어요. 공개하기를 눌러 반영하세요.');
   };
   updatePreview();
 });
}
function help(){openDialog('MUSE 베타 이용 안내','<p>전시관 소개에서 입장하기를 누르면 6,000×4,000 보드를 탐험해요. 사진 위에서도 드래그로 카메라를 이동하고, 짧게 클릭하면 작은 상세 패널이 열립니다.</p><p>꾸미기에서 요소 이동·크기·회전·색·글꼴·정렬, 보드 배경·대표 영역·시작 위치를 수정하세요. 초안은 서버에 저장되며 공개하기를 눌러야 친구에게 반영됩니다.</p><p>맞팔 친구만 친구 가림막 안을 볼 수 있어요. 비친구에게는 일부라도 겹친 전시품의 원본 전체를 전달하지 않습니다.</p><p>메시지는 팔로우 없이도 바로 전송합니다. 연결 가능한 환경에서는 실시간으로 갱신하며 채팅 메뉴에서 알림 끄기·차단·신고를 이용합니다.</p><p>로그인은 MUSE 아이디와 비밀번호를 사용합니다. 새로고침·새 탭·복귀 시 서버에서 세션과 회원 상태를 확인하며, 인증 서비스가 세션을 무효화한 경우 다시 로그인해야 합니다.</p>')}
let sessionCheck=null,lastSessionCheck=0;
async function checkSession(){
 if(locked||!account)return;
 if(sessionCheck)return sessionCheck;
 if(Date.now()-lastSessionCheck<1000)return;
 lastSessionCheck=Date.now();
 sessionCheck=(async()=>{
   try{
     const r=await fetch('/api/session',{cache:'no-store'});
     if(!r.ok)return;
     const b=await r.json();
     if(!b.member||b.user.id!==account.id)lock('로그인이 만료되었거나 계정이 변경되었어요.');
   }catch{}
 })();
 try{return await sessionCheck}finally{sessionCheck=null}
}
function fromHash(){let [p,id]=(location.hash.slice(1)||(location.pathname==='/admin'?'admin':'')).split('/');try{id=id?decodeURIComponent(id):null}catch{id=null}route(['home','explore','friends','intro','profile','about','board','messages','notifications','saved','admin'].includes(p)?p:'home',id,{hash:false})}
function bind(){document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));new ResizeObserver(es=>$('stage').style.setProperty('--board-profile-height',es[0].contentRect.height+'px')).observe($('boardProfile'));document.querySelectorAll('#sidebar [data-page]').forEach(b=>b.onclick=()=>{query='';route(b.dataset.page)});$('brand').onclick=$('mobileBrand').onclick=e=>{e.preventDefault();route('home')};$('sidebarEdit').onclick=editOwn;$('editMusic').onclick=musicSettings;$('back').onclick=()=>route('intro');$('viewMode').onclick=()=>{setMode(mode==='edit'?'view':'edit');if(mode==='view'&&visiting===account.id){refreshBoardRanks(account.id,boardEntry);playMusic()}else stopMusic()};$('publish').onclick=async()=>{let button=$('publish');button.disabled=true;button.textContent='저장·공개 중…';clearTimeout(saveTimer);try{let saved=await saveBoard();if(saved.clientRevision!==revision)throw Error('저장 중 편집 내용이 바뀌었어요. 저장이 끝난 뒤 다시 공개해주세요.');await api('board/publish','POST',{revision:saved.revision});publication=saved.board;if(saved.clientRevision===revision){dirty=false;$('saveState').textContent='서버 저장·공개 완료';$('retrySave').hidden=true}toast('전시관을 공개했어요.');refreshDirectory().catch(()=>toast('공개는 완료됐어요. 목록은 잠시 후 갱신돼요.'))}catch(e){await storeRecord('recovery',snapshot()).catch(()=>{});$('saveState').textContent='저장·공개 실패 · 이전 공개본 유지';$('retrySave').hidden=false;toast(e.message)}finally{button.disabled=false;button.textContent='공개하기'}};$('help').onclick=help;$('accountMenu').innerHTML='<b>'+esc(account.name)+'</b><button id="accountBetaProfile">프로필 수정</button><button id="accountBetaManage">전시관 관리·백업</button>'+(['admin','super_admin'].includes(role)?'<button data-route="admin">베타 운영 관리</button>':'')+'<button id="accountBetaPrivacy">개인정보 안내</button><button id="betaTheme">화면 테마</button><button id="betaPassword">비밀번호 변경</button><a id="betaSignOut" href="#logout">로그아웃 · 현재 기기</a><small>MUSE 계정 · 안전한 자동 로그인</small>';$('accountBetaProfile').onclick=profileEdit;$('accountBetaManage').onclick=manage;$('accountBetaPrivacy').onclick=privacy;$('betaTheme').onclick=themeSettings;$('betaPassword').onclick=()=>window.MuseAuth.password();$('betaSignOut').onclick=async e=>{e.preventDefault();try{await logout()}catch(e){toast(e.message)}};$('globalSearchForm').onsubmit=e=>{e.preventDefault();query=$('globalSearch').value;route('friends')};$('mobileSearch').onclick=()=>{query='';route('friends')};document.addEventListener('click',async e=>{let b=e.target.closest('button,a');if(!b)return;let d=b.dataset;
 if(d.rankKind){rankKind=d.rankKind;if(rankSnapshot)drawRanking();else document.querySelectorAll('[data-rank-kind]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));return}
 if(b.hasAttribute('data-rank-retry')){openRanking(routeEpoch);return}
 try{if(d.route){e.preventDefault();if(d.route==='explore'&&d.id==='ranking'&&page==='explore'&&profileId==='ranking')return;await route(d.route,d.id||null)}else if(d.followList)await showFollowList(d.owner,d.followList);else if(d.profile)await route('profile',d.profile);else if(d.enter)await route('board',d.enter);else if(d.guestbook)await guestbook(d.guestbook);else if(d.follow)await follow(d.follow);else if(b.hasAttribute('data-edit-own'))editOwn();else if(b.hasAttribute('data-profile-edit'))profileEdit();else if(b.hasAttribute('data-beta-manage'))manage();else if(b.hasAttribute('data-owner-mask')){if(visiting===account.id){preview=!preview;boardProfile();render()}}else if(d.friendTab){tab=d.friendTab;route('friends')}else if(d.betaSave){await api('bookmarks','POST',{galleryId:d.betaSave,saved:!data.saved.includes(d.betaSave)});await refreshDirectory();route(page,profileId)}else if(d.cloudBackup)download('muse-cloud-backup.json',(await api('board/backups/'+d.cloudBackup)).board);else if(d.revokeInvite){await api('admin/invites/revoke','POST',{id:d.revokeInvite});admin()}else if(d.reportReview){await api('admin/reports','PATCH',{id:d.reportReview,status:d.status});admin()}else if(d.suspendUser||d.deleteUser){confirmMemberAction({userId:d.suspendUser||d.deleteUser,handle:d.handle,remove:!!d.deleteUser,suspended:d.suspended==='true'});}}catch(err){toast(err.message)}});document.addEventListener('input',e=>{if(e.target.id!=='betaFriendSearch')return;query=e.target.value;let pos=e.target.selectionStart;route('friends',null,{hash:false,local:true}).then(()=>{$('betaFriendSearch')?.focus();$('betaFriendSearch')?.setSelectionRange(pos,pos)})});window.addEventListener('popstate',fromHash);window.addEventListener('pageshow',e=>{if(e.persisted){document.body.classList.add('auth-checking');checkSession().finally(()=>{if(!locked)document.body.classList.remove('auth-checking')})}else checkSession()});window.addEventListener('focus',checkSession);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkSession()});window.addEventListener('error',()=>api('client-errors','POST',{code:'runtime_error'}).catch(()=>{}));}
window.MuseBeta={privacy,api,saveBoard,manage,help,lock,enter};window.MuseSocial={...old,people:[],getPerson:person,mutual,me:()=>account||{},currentGallery:()=>visiting||account?.id,resolveGallery:id=>id==='me'||id===account?.id?state:remote?.id===id?remote.board:null,route,onBoardMode:m=>{document.body.classList.toggle('board-view',m==='view');document.body.classList.toggle('board-edit',m==='edit');boardProfile()},onBoardExit:()=>route('intro'),refresh:async()=>{await refreshDirectory();visiting?boardProfile():route(page,profileId)}};
async function start(){let b=await window.MuseBoot;if(!b.member){showAuth(b);return}account=b.user;role=b.role;passwordOnlyAdmin=!!b.adminPasswordOnly;try{await initialDirectory;if(!directoryAt)await refreshDirectory();document.body.classList.remove('auth-checking');$('authGate').hidden=true;if(b.testing)document.body.classList.add('qa-environment');bind();setInterval(checkSession,30000);window.dispatchEvent(new Event('muse-beta-ready'));let back=sessionStorage.getItem('muse-return-route');if(back&&!location.hash){sessionStorage.removeItem('muse-return-route');window.history.replaceState(null,'',back)}fromHash()}catch(e){lock(e.message)}}
window.addEventListener('muse-ready',start,{once:true});window.addEventListener('muse-load-error',()=>lock('서버 초안을 읽지 못했어요. 새로고침으로 다시 연결하세요.'),{once:true});window.MuseBoot.then(b=>{if(!b.member)showAuth(b)});if(ready)start();
})();
