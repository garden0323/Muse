'use strict';
const E=MuseEngine,$=id=>document.getElementById(id),clone=x=>JSON.parse(JSON.stringify(x));
const scene=$('scene'),ctx=scene.getContext('2d'),mini=$('minimap'),mc=mini.getContext('2d');
let viewport={w:1,h:1},cam={x:3000,y:2000,z:1},state,guestBoard=null,publication=null,mode='edit',preview=false,selection=null,tool=null,gesture=null,pointers=new Map(),history=[],future=[],images=new Map(),db,saveTimer,renderPending=false,dirty=false,lastSaved='',ready=false,revision=0;
const retrySave=document.createElement('button');retrySave.id='retrySave';retrySave.textContent='저장 재시도';retrySave.hidden=true;retrySave.onclick=()=>persist();$('saveState').after(retrySave);
const mediaPreparations=new Set();function prepareMedia(action){let job=action();mediaPreparations.add(job);job.then(()=>mediaPreparations.delete(job),()=>mediaPreparations.delete(job));return job}
const types={photo:'사진',text:'텍스트 메모',sticker:'스티커',mask:'친구 가림막',drawing:'그림'};
const baseStyle={ink:'#586044',paper:'#e6e9c9',font:'sans-serif',fontSize:24,align:'left',frame:'none',radius:5,border:0,opacity:100,shadow:true};
function object(type,x,y,w,h,content='',style={}){return{id:(crypto.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2)),type,x,y,w,h,r:0,z:0,content,caption:'',style:{...baseStyle,...style}}}
function blank(){return{schema:2,world:{w:E.W,h:E.H},items:[],background:{color:'#f3f0e3',pattern:'dots',image:null},start:{x:3000,y:2000,z:1},cover:{x:2500,y:1650,w:1000,h:700}}}
function sample(){let s=blank();s.world={w:10000,h:10000};s.start={x:5000,y:5000,z:1};s.cover={x:4500,y:4650,w:1000,h:700};const add=(t,x,y,w,h,c,st,r=0)=>{let o=object(t,x,y,w,h,c,st);o.r=r;o.z=s.items.length;s.items.push(o);return o};
add('photo',4600,4720,255,305,'assets/forest.jpg',{frame:'polaroid'},-7).caption='느리게 걷고 싶은 날';add('text',4910,4700,260,260,'요즘의 나는,\n\n조금 느리더라도\n내가 좋아하는 방향으로.\n작은 순간들을 잊지 않기.',{fontSize:18},3);add('text',5250,4725,230,290,'작은 취향이\n모여서\n하나의 나.',{paper:'#b3bc98',ink:'#fffef0',font:'serif',fontSize:31},5);add('sticker',5140,5025,90,90,'✳',{ink:'#92a56c',shadow:false},-12);add('text',4840,5065,285,100,'취향 수집실  /  첫 번째 기록',{paper:'#fffdf6',fontSize:18},-3);
add('photo',7200,2450,320,360,'assets/sea.jpg',{frame:'polaroid'},6).caption='우리만 아는 여름';add('text',7560,2500,310,220,'계획 없이 떠났던 그날.\n\n다음엔 조금 더 멀리 가보자.',{paper:'#e9d8c4'},-2);add('mask',7130,2380,820,530,'',{});add('text',2450,7370,380,260,'아직 쓰지 않은 이야기\n\n이 넓은 곳에\n조금씩 채워가고 싶어.',{paper:'#d9e6e9',fontSize:28},-4);add('sticker',2860,7480,150,150,'🌷',{},8);return E.fitWorld(s)}
function toast(t){$('toast').textContent=t;$('toast').hidden=false;clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('toast').hidden=true,3200)}
function openDialog(title,html,setup){MuseOverlays.closeAccount();$('dialog').dataset.edited='';$('dialog').dataset.protected=String(/삭제|상태 변경|재인증/.test(title));$('dialog').innerHTML='<h2>'+title+'</h2>'+html+'<div class="actions"><button id="closeDialog">닫기</button></div>';$('closeDialog').onclick=()=>$('dialog').close();$('dialog').showModal();setup?.()}
function snapshot(){return clone(state)}function beginChange(){history.push(snapshot());if(history.length>60)history.shift();future=[];dirty=true}
function changed(){revision++;dirty=true;updateHistory();scheduleSave();render();}
function updateHistory(){$('undo').disabled=!history.length||mode!=='edit';$('redo').disabled=!future.length||mode!=='edit'}
function undo(){if(mode!=='edit'||!history.length)return;future.push(snapshot());state=history.pop();selection=null;updateInspector();changed()}
function redo(){if(mode!=='edit'||!future.length)return;history.push(snapshot());state=future.pop();selection=null;updateInspector();changed()}
function storeRecord(key,val){return new Promise((resolve,reject)=>{let tx=db.transaction('boards','readwrite');tx.objectStore('boards').put(val,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
function readRecord(key){return new Promise((resolve,reject)=>{let r=db.transaction('boards').objectStore('boards').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function scheduleSave(){$('saveState').textContent='저장 중…';clearTimeout(saveTimer);saveTimer=setTimeout(persist,400)}
async function persist(){clearTimeout(saveTimer);let savingRevision=revision;try{if(!db)throw Error();await storeRecord('draft',snapshot());if(window.MUSE_BETA)await window.MuseBeta.saveBoard();if(revision!==savingRevision)return;dirty=false;lastSaved=new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});$('saveState').textContent=(window.MUSE_BETA?'서버 저장됨 · ':'초안 저장됨 · ')+lastSaved;$('retrySave').hidden=true}catch(e){if(db)await storeRecord('recovery',snapshot()).catch(()=>{});$('saveState').textContent='저장 실패 · 이 기기에 복구본 유지';$('retrySave').hidden=false;toast(e.message||'저장을 완료하지 못했어요. 다시 시도를 눌러주세요.')}}
function activeState(){if(guestBoard)return guestBoard;return mode==='view'&&$('version').value==='published'&&publication?publication:state}
function visibleItems(s){return s.items.filter(o=>o.type!=='mask')}
function clipPublic(c,s){c.beginPath();for(let r of E.publicRegions(s.items.filter(o=>o.type==='mask')))c.rect(r.x,r.y,r.w,r.h);c.clip()}
let imageRefreshPending=false,paintingScene=false;
const sceneImages=new Set();
function getImage(url){
 if(!url)return null;
 if(paintingScene)sceneImages.add(url);
 if(!images.has(url)){
   const im=new Image();
   im.decoding='async';
   images.set(url,im);
   im.onload=()=>{
     if(images.get(url)!==im||imageRefreshPending)return;
     imageRefreshPending=true;
     requestAnimationFrame(()=>{
       imageRefreshPending=false;
       if(!$('editor').hidden)render();
       if(!$('landing').hidden)drawCover();
       window.MuseMessages?.redrawShares();
       trimImages();
     });
   };
   im.onerror=()=>{if(images.get(url)===im)images.set(url,null)};
   im.src=url;
 }
 const im=images.get(url);
 if(!im?.complete||!im.naturalWidth)return null;
 images.delete(url);images.set(url,im);
 return im;
}
function trimImages(){
 if(images.size<=32)return;
 let pixels=0,kept=0;
 for(const [url,img] of [...images].reverse()){
   if(!img?.complete){if(img===null&&images.size>96)images.delete(url);continue;}
   pixels+=img.naturalWidth*img.naturalHeight;
   if((++kept>96||pixels>32_000_000)&&!sceneImages.has(url))images.delete(url);
 }
}
function round(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,Math.min(r,w/2,h/2))}
function photo(c,im,x,y,w,h){if(!im){c.fillStyle='#d8dfcb';c.fillRect(x,y,w,h);c.fillStyle='#82916e';c.font='18px sans-serif';c.fillText('사진 불러오는 중',x+20,y+45);return}let scale=Math.max(w/im.width,h/im.height),sw=w/scale,sh=h/scale;c.drawImage(im,(im.width-sw)/2,(im.height-sh)/2,sw,sh,x,y,w,h)}
function drawPhoto(c,o,unit){
  const st=o.style,frame=st.frame,diary=frame==='diary',wood=frame==='wood-frame';
  const u=diary||wood?Math.min(unit,o.w/100,o.h/100):unit;
  const pad=frame==='none'?0:(frame==='film'?13:wood?22:14)*u;
  const left=diary?32*u:pad;
  const captionDepth=(frame==='polaroid'?50:wood?52:34)*u;
  const bottom=o.caption?Math.max(captionDepth,st.fontSize+(wood?35:22)*u):frame==='polaroid'?50*u:pad;
  const photoW=Math.max(1,o.w-left-pad),photoH=Math.max(1,o.h-pad-bottom);

  c.fillStyle=frame==='film'?'#2d3027':wood?'#8b5f42':st.paper;
  round(c,0,0,o.w,o.h,st.radius);
  c.fill();
  c.shadowColor='transparent';
  c.save();
  round(c,0,0,o.w,o.h,st.radius);
  c.clip();

  if(diary){
    c.fillStyle='#7d8e6326';
    for(let y=9*u;y<o.h;y+=18*u)c.fillRect(10*u,y,o.w-10*u,u);
    c.fillStyle='#b66e6e66';
    c.fillRect(24*u,0,u,o.h);
    for(let y=12*u;y<o.h-4*u;y+=20*u){
      c.fillStyle='#7e755f';
      c.beginPath();
      c.arc(11*u,y,3*u,0,Math.PI*2);
      c.fill();
      c.strokeStyle='#514e40';
      c.lineWidth=1.6*u;
      c.beginPath();
      c.moveTo(2*u,y-2*u);
      c.quadraticCurveTo(7*u,y-5*u,13*u,y);
      c.stroke();
    }
  }
  if(wood){
    const grain=c.createLinearGradient(0,0,o.w,o.h);
    grain.addColorStop(0,'#b78660');
    grain.addColorStop(.45,'#84563c');
    grain.addColorStop(1,'#603e2c');
    c.fillStyle=grain;
    c.fillRect(0,0,o.w,o.h);
    c.strokeStyle='#e7bf956e';
    c.lineWidth=1.5*u;
    c.strokeRect(3*u,3*u,o.w-6*u,o.h-6*u);
    c.fillStyle='#543725';
    c.fillRect(10*u,10*u,o.w-20*u,o.h-20*u);
    c.fillStyle=st.paper;
    c.fillRect(13*u,13*u,o.w-26*u,o.h-26*u);
  }

  c.save();
  round(c,left,pad,photoW,photoH,st.radius);
  c.clip();
  photo(c,getImage(o.content),left,pad,photoW,photoH);
  c.restore();

  if(frame==='film'){
    c.fillStyle='#e6e1cd';
    for(let y=10;y<o.h;y+=25){c.fillRect(3,y,5,11);c.fillRect(o.w-8,y,5,11)}
  }
  if(o.caption){
    c.font=st.fontSize+'px '+st.font;
    c.fillStyle=st.ink;
    c.textAlign=st.align;
    c.textBaseline='bottom';
    const inset=diary?32*u:wood?22*u:18*u;
    const tx=st.align==='center'?o.w/2:st.align==='right'?o.w-inset:inset;
    c.fillText(o.caption,tx,o.h-(wood?17:10)*u,Math.max(1,o.w-2*inset));
  }
  c.restore();
}
function drawObject(c,o){c.save();c.translate(o.x+o.w/2,o.y+o.h/2);c.rotate(o.r*Math.PI/180);c.translate(-o.w/2,-o.h/2);let st=o.style,unit=st.unit||1;c.globalAlpha=st.opacity/100;c.shadowColor=st.shadow?'#45492a25':'transparent';c.shadowBlur=st.shadow?15:0;c.shadowOffsetY=st.shadow?5:0;
if(o.type==='photo')drawPhoto(c,o,unit);
else if(o.type==='text'){c.fillStyle=st.paper;round(c,0,0,o.w,o.h,st.radius);c.fill();c.shadowColor='transparent';c.save();round(c,0,0,o.w,o.h,st.radius);c.clip();c.fillStyle=st.ink;c.font=st.fontSize+'px '+st.font;c.textAlign=st.align;c.textBaseline='top';let x=st.align==='center'?o.w/2:st.align==='right'?o.w-22*unit:22*unit,y=22*unit;for(let line of o.content.split('\n')){let row='';for(let ch of line){if(c.measureText(row+ch).width>o.w-44*unit&&row){c.fillText(row,x,y);y+=st.fontSize*1.6;row=''}row+=ch}c.fillText(row,x,y);y+=st.fontSize*1.6}c.restore()}
else if(o.type==='drawing'){MuseDrawing.draw(c,o)}
else if(o.type==='sticker'){c.shadowColor='transparent';let src=window.MuseStickers?.url(o.content);if(src){let image=getImage(src);if(image)c.drawImage(image,0,0,o.w,o.h)}else{c.fillStyle=st.ink;c.textAlign='center';c.textBaseline='middle';c.font=Math.min(o.w,o.h)*.85+'px '+st.font;c.fillText(o.content,o.w/2,o.h/2,o.w)}}
if(st.border){c.strokeStyle=st.ink;c.lineWidth=st.border;round(c,0,0,o.w,o.h,st.radius);c.stroke()}c.restore()}
function drawMask(c,m,covered,s=activeState()){c.save();c.beginPath();c.rect(m.x,m.y,m.w,m.h);c.clip();if(covered){c.fillStyle='#e9eedf';c.fillRect(m.x,m.y,m.w,m.h)}let frost=c.createLinearGradient(m.x,m.y,m.x+m.w,m.y+m.h);frost.addColorStop(0,covered?'#eef2e5b8':'#e1eadb55');frost.addColorStop(1,covered?'#dce7d27a':'#c6d9b024');c.fillStyle=frost;c.fillRect(m.x,m.y,m.w,m.h);c.fillStyle='#687b55b0';c.textAlign='center';
const x=m.x+m.w/2,y=m.y+m.h/2,maxWidth=Math.max(1,m.w-2*Math.min(12,m.w*.08));
if(covered){
  const title='친구 가림막',description='친구가 되면 가림막 뒤가 보여요!';
  c.textBaseline='middle';
  c.font='600 20px sans-serif';
  const titleWidth=c.measureText(title).width;
  c.font='14px sans-serif';
  const scale=Math.min(1,m.h/46,maxWidth/Math.max(titleWidth,c.measureText(description).width));
  c.font='600 '+(20*scale)+'px sans-serif';
  c.fillText(title,x,y-9*scale,maxWidth);
  c.font=(14*scale)+'px sans-serif';
  c.fillText(description,x,y+11*scale,maxWidth);
}else{
  c.font='20px sans-serif';
  c.fillText('☁ 친구 전용 구역',x,y,Math.max(1,m.w-24));
}c.restore();c.save();c.strokeStyle='#93a97875';c.lineWidth=1.5/cam.z;c.setLineDash(covered?[]:[7/cam.z,5/cam.z]);c.strokeRect(m.x,m.y,m.w,m.h);c.restore()}

function background(c,s,rect){c.fillStyle=s.background.color;c.fillRect(rect.x,rect.y,rect.w,rect.h);if(s.background.image){let im=getImage(s.background.image);if(im){let pat=c.createPattern(im,'repeat');c.fillStyle=pat;c.fillRect(rect.x,rect.y,rect.w,rect.h)}}if(s.background.pattern==='none')return;c.save();c.strokeStyle='#8e96741c';c.fillStyle='#8e96744a';c.lineWidth=1/cam.z;let step=s.background.pattern==='grid'?60:40;for(let x=Math.floor(rect.x/step)*step;x<rect.x+rect.w;x+=step){if(s.background.pattern==='grid'){c.beginPath();c.moveTo(x,rect.y);c.lineTo(x,rect.y+rect.h);c.stroke()}else for(let y=Math.floor(rect.y/step)*step;y<rect.y+rect.h;y+=step)c.fillRect(x,y,1.3,1.3)}if(s.background.pattern==='grid')for(let y=Math.floor(rect.y/step)*step;y<rect.y+rect.h;y+=step){c.beginPath();c.moveTo(rect.x,y);c.lineTo(rect.x+rect.w,y);c.stroke()}c.restore()}
function sorted(items){return [...items].sort((a,b)=>a.z-b.z)}
function drawScene(){if(!state)return;sceneImages.clear();paintingScene=true;try{const s=activeState(),dpr=Math.min(devicePixelRatio||1,2);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,viewport.w,viewport.h);ctx.save();ctx.translate(viewport.w/2,viewport.h/2);ctx.scale(cam.z,cam.z);ctx.translate(-cam.x,-cam.y);let vr={x:cam.x-viewport.w/cam.z/2,y:cam.y-viewport.h/cam.z/2,w:viewport.w/cam.z,h:viewport.h/cam.z};ctx.beginPath();ctx.rect(0,0,E.W,E.H);ctx.clip();const x=Math.max(0,vr.x),y=Math.max(0,vr.y);background(ctx,s,{x,y,w:Math.max(0,Math.min(E.W,vr.x+vr.w)-x),h:Math.max(0,Math.min(E.H,vr.y+vr.h)-y)});
ctx.save();if(mode==='view'&&preview)clipPublic(ctx,s);for(const o of sorted(visibleItems(s).filter(o=>E.intersects(E.bounds(o),vr))))drawObject(ctx,o);ctx.restore();

if(mode==='edit'||preview)for(let m of s.items.filter(o=>o.type==='mask'))drawMask(ctx,m,mode==='view');
if(mode==='edit'&&selection){let o=state.items.find(o=>o.id===selection);if(o)drawSelection(o)}
if(gesture?.kind==='region'){let r=regionRect(gesture.a,gesture.b);ctx.strokeStyle='#78945e';ctx.fillStyle='#c6d9b050';ctx.lineWidth=2/cam.z;ctx.fillRect(r.x,r.y,r.w,r.h);ctx.strokeRect(r.x,r.y,r.w,r.h)}ctx.restore();drawMini();$('zoomLabel').textContent=Math.round(cam.z*100)+'%';$('coords').textContent=Math.round(cam.x).toLocaleString()+' · '+Math.round(cam.y).toLocaleString();$('empty').hidden=s.items.length>0;window.MuseDrawingUI?.preview();}finally{paintingScene=false}}
function drawSelection(o){let c=ctx;c.save();c.translate(o.x+o.w/2,o.y+o.h/2);c.rotate(o.r*Math.PI/180);c.strokeStyle='#77925d';c.fillStyle='#fffdf6';c.lineWidth=1.5/cam.z;c.strokeRect(-o.w/2,-o.h/2,o.w,o.h);let hs=9/cam.z;for(let [x,y] of [[-o.w/2,-o.h/2],[o.w/2,-o.h/2],[o.w/2,o.h/2],[-o.w/2,o.h/2]]){c.fillRect(x-hs/2,y-hs/2,hs,hs);c.strokeRect(x-hs/2,y-hs/2,hs,hs)}if(o.type!=='mask'){c.beginPath();c.moveTo(0,-o.h/2);c.lineTo(0,-o.h/2-28/cam.z);c.stroke();c.beginPath();c.arc(0,-o.h/2-32/cam.z,6/cam.z,0,Math.PI*2);c.fill();c.stroke()}c.restore()}
let miniCache;
function drawMini(){
 const size=mini.clientWidth,mh=mini.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
 if(!size||!mh)return;
 const width=Math.round(size*dpr),height=Math.round(mh*dpr);
 if(mini.width!==width||mini.height!==height){mini.width=width;mini.height=height}
 const s=activeState(),edited=mode==='edit'&&['move','resize','rotate'].includes(gesture?.kind);
 if(!miniCache||miniCache.state!==s||miniCache.revision!==revision||miniCache.mode!==mode||miniCache.preview!==preview||miniCache.edited!==edited||
    miniCache.canvas.width!==width||miniCache.canvas.height!==height||edited){
   const canvas=miniCache?.canvas||document.createElement('canvas');
   canvas.width=width;canvas.height=height;
   const layer=canvas.getContext('2d');
   layer.setTransform(dpr,0,0,dpr,0,0);
   layer.fillStyle=s.background.color;layer.fillRect(0,0,size,mh);layer.save();layer.scale(size/E.W,mh/E.H);if(mode==='view'&&preview)clipPublic(layer,s);for(let o of visibleItems(s)){let b=E.bounds(o);layer.fillStyle=o.type==='photo'?'#a8bea0':o.type==='text'?'#b5b58d':'#c8a68a';layer.fillRect(b.x,b.y,Math.max(2*E.W/size,b.w),Math.max(2*E.H/mh,b.h))}layer.restore();for(let m of s.items.filter(o=>o.type==='mask')){layer.fillStyle='#d3ddc2';layer.strokeStyle='#90a773';layer.fillRect(m.x/E.W*size,m.y/E.H*mh,m.w/E.W*size,m.h/E.H*mh);layer.strokeRect(m.x/E.W*size,m.y/E.H*mh,m.w/E.W*size,m.h/E.H*mh)}
   miniCache={state:s,revision,mode,preview,edited,canvas};
 }
 mc.setTransform(dpr,0,0,dpr,0,0);
 mc.clearRect(0,0,size,mh);
 mc.drawImage(miniCache.canvas,0,0,size,mh);
 let r=E.miniRect(cam,viewport,size,mh);mc.fillStyle='#fffef02a';mc.fillRect(r.x,r.y,r.w,r.h);mc.lineWidth=1.5;mc.strokeStyle='#5c7940';mc.strokeRect(r.x,r.y,r.w,r.h);mc.fillStyle='#738b57';mc.beginPath();mc.arc(cam.x/E.W*size,cam.y/E.H*mh,1.8,0,7);mc.fill()}
function render(){if(renderPending||$('editor').hidden)return;renderPending=true;requestAnimationFrame(()=>{renderPending=false;if(!$('editor').hidden)drawScene()})}
function resize(){let r=$('stage').getBoundingClientRect();if(!r.width||!r.height)return;viewport={w:r.width,h:r.height};let dpr=Math.min(devicePixelRatio||1,2);scene.width=Math.round(r.width*dpr);scene.height=Math.round(r.height*dpr);cam=E.camera(cam,viewport);render()}
function paintCover(canvas,s,maxSize){
  const r=s.cover,scale=maxSize/Math.max(r.w,r.h);
  canvas.width=Math.max(1,Math.round(r.w*scale));
  canvas.height=Math.max(1,Math.round(r.h*scale));
  canvas.parentElement?.style.setProperty('--cover-ratio',canvas.width/canvas.height);
  const c=canvas.getContext('2d');
  c.save();
  c.scale(canvas.width/r.w,canvas.height/r.h);
  c.translate(-r.x,-r.y);
  c.beginPath();
  c.rect(r.x,r.y,r.w,r.h);
  c.clip();
  background(c,s,r);
  c.save();
  clipPublic(c,s);
  for(const o of sorted(visibleItems(s)))if(E.intersects(E.bounds(o),r))drawObject(c,o);
  c.restore();
  for(const m of s.items.filter(o=>o.type==='mask'))drawMask(c,m,true,s);
  c.restore();
}
function drawCover(){if(state)paintCover($('cover'),state,900)}
function point(e){let r=scene.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}function world(e){return E.toWorld(point(e),cam,viewport)}
function selected(){return state.items.find(o=>o.id===selection)}
function handles(o){let r=o.r*Math.PI/180;let worldP=(x,y)=>({x:o.x+o.w/2+x*Math.cos(r)-y*Math.sin(r),y:o.y+o.h/2+x*Math.sin(r)+y*Math.cos(r)});return{corners:[[-o.w/2,-o.h/2],[o.w/2,-o.h/2],[o.w/2,o.h/2],[-o.w/2,o.h/2]].map(p=>worldP(...p)),rotate:worldP(0,-o.h/2-32/cam.z)}}
function regionRect(a,b){let x=E.clamp(Math.min(a.x,b.x),0,E.W),y=E.clamp(Math.min(a.y,b.y),0,E.H);return{x,y,w:Math.min(E.W-x,Math.abs(a.x-b.x)),h:Math.min(E.H-y,Math.abs(a.y-b.y))}}
scene.onpointerdown=e=>{if(e.button!==0&&e.pointerType!=='touch')return;e.preventDefault();window.MuseMessages?.closeDetail();scene.focus({preventScroll:true});scene.setPointerCapture(e.pointerId);pointers.set(e.pointerId,point(e));if(pointers.size>1){if(gesture?.kind==='ink'||gesture?.kind==='erase')finishDrawing();if(gesture?.kind==='pinch'||gesture?.kind==='blocked')return;if(gesture?.mutated)changed();let ps=[...pointers.values()];gesture={kind:'pinch',distance:Math.max(1,Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y)),zoom:cam.z,anchor:E.toWorld({x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2},cam,viewport)};return}let p=world(e);if(mode==='edit'&&window.MuseDrawingUI&&drawMode){startDrawing(p);return}if(mode==='edit'&&tool){gesture={kind:'region',a:p,b:p};render();return}
let o=selected();if(mode==='edit'&&o){let h=handles(o),near=q=>Math.hypot(q.x-p.x,q.y-p.y)<16/cam.z,corner=h.corners.findIndex(near);if(corner>=0){beginChange();gesture={kind:'resize',id:o.id,original:clone(o),corner,mutated:true};return}if(o.type!=='mask'&&near(h.rotate)){beginChange();gesture={kind:'rotate',id:o.id,original:clone(o),mutated:true};return}}
let target=mode==='edit'?sorted(state.items).reverse().find(o=>E.hit(o,p)&&(o.type!=='drawing'||MuseDrawing.hit(o,p,7/cam.z))):null;let input=MuseInput.start(point(e),e.timeStamp);let candidate=mode==='view'?sorted(visibleItems(activeState())).reverse().find(o=>E.hit(o,p)&&(o.type!=='drawing'||MuseDrawing.hit(o,p,7/cam.z))):null;if(target){selection=target.id;gesture={kind:'move',id:target.id,a:p,original:clone(target),mutated:false,input};updateInspector()}else{selection=null;gesture={kind:'pan',a:point(e),original:{...cam},input,candidate: candidate&&['photo','text'].includes(candidate.type)?candidate.id:null};updateInspector()}render()};
scene.onpointermove=e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,point(e));if(!gesture||gesture.kind==='blocked')return;if(gesture.kind==='ink'||gesture.kind==='erase'){moveDrawing(e);return}if(gesture.input)MuseInput.move(gesture.input,point(e));if(gesture.kind==='pinch'){let ps=[...pointers.values()];if(ps.length<2)return;let z=E.clamp(gesture.zoom*Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y)/gesture.distance,.2,2),mid={x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2};cam=E.camera({x:gesture.anchor.x-(mid.x-viewport.w/2)/z,y:gesture.anchor.y-(mid.y-viewport.h/2)/z,z},viewport)}else if(gesture.kind==='pan'&&gesture.input.dragged){let p=point(e);cam=E.camera({...cam,x:gesture.original.x-(p.x-gesture.a.x)/cam.z,y:gesture.original.y-(p.y-gesture.a.y)/cam.z},viewport)}else if(gesture.kind==='region')gesture.b=world(e);else{let o=state.items.find(o=>o.id===gesture.id),p=world(e),b=gesture.original;if(!o)return;if(gesture.kind==='move'){if(!gesture.mutated&&gesture.input.dragged){beginChange();gesture.mutated=true}if(gesture.mutated){o.x=E.clamp(b.x+p.x-gesture.a.x,0,E.W-o.w);o.y=E.clamp(b.y+p.y-gesture.a.y,0,E.H-o.h)}}else if(gesture.kind==='rotate'){o.r=Math.round(Math.atan2(p.y-b.y-b.h/2,p.x-b.x-b.w/2)*180/Math.PI+90)}else if(gesture.kind==='resize'){Object.assign(o,E.resizeObject(b,gesture.corner,p))}updateInspector(false)}render()};
function endPointer(e,cancel=false){if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);if(!gesture)return;if(gesture.kind==='ink'||gesture.kind==='erase'){finishDrawing(cancel);return}if(gesture.kind==='pinch'||gesture.kind==='blocked'){gesture=pointers.size?{kind:'blocked'}:null;render();return}let tapId=!cancel&&mode==='view'&&gesture.kind==='pan'&&gesture.candidate&&MuseInput.tap(gesture.input,point(e),e.timeStamp)?gesture.candidate:null;if(gesture.kind==='region'){let rect=regionRect(gesture.a,gesture.b);if(!cancel&&rect.w>=40&&rect.h>=40){beginChange();if(tool==='mask'){let o=object('mask',rect.x,rect.y,rect.w,rect.h);o.z=nextZ();state.items.push(o);selection=o.id;toast('가림막 구역을 만들었어요. 겹친 부분만 가려집니다.')}else{state.cover=rect;toast('대표 영역을 지정했어요. 소개 페이지에서 확인하세요.')}changed()}else toast('40 × 40 이상으로 구역을 끌어주세요');tool=null;$('hint').textContent=defaultHint();updateInspector()}else if(gesture.mutated)changed();gesture=null;pointers.clear();render();if(tapId)window.MuseMessages?.detail(tapId)}
// Details are dispatched only by a validated pointer-up, never compatibility click.
scene.addEventListener('click',e=>{e.preventDefault();e.stopPropagation()});scene.addEventListener('dragstart',e=>e.preventDefault());scene.addEventListener('contextmenu',e=>e.preventDefault());
scene.onpointerup=e=>endPointer(e);scene.onpointercancel=e=>endPointer(e,true);scene.onlostpointercapture=e=>{if(pointers.has(e.pointerId))endPointer(e,true)};
function setZoom(z,anchor={x:viewport.w/2,y:viewport.h/2}){let p=E.toWorld(anchor,cam,viewport);z=E.clamp(z,.2,2);cam=E.camera({x:p.x-(anchor.x-viewport.w/2)/z,y:p.y-(anchor.y-viewport.h/2)/z,z},viewport);render()}
scene.addEventListener('wheel',e=>{e.preventDefault();setZoom(cam.z*Math.exp(-e.deltaY*.001),point(e))},{passive:false});
let miniDown=false;function jump(e){let r=mini.getBoundingClientRect();cam=E.camera({...cam,x:(e.clientX-r.left)/r.width*E.W,y:(e.clientY-r.top)/r.height*E.H},viewport);render()}
mini.onpointerdown=e=>{e.preventDefault();if(miniDown!==false)return;miniDown=e.pointerId;mini.setPointerCapture(e.pointerId);jump(e)};mini.onpointermove=e=>{if(miniDown===e.pointerId)jump(e)};mini.onpointerup=mini.onpointercancel=mini.onlostpointercapture=e=>{if(miniDown===e.pointerId)miniDown=false};mini.onkeydown=e=>{let d={ArrowLeft:[-500,0],ArrowRight:[500,0],ArrowUp:[0,-500],ArrowDown:[0,500]}[e.key];if(d){e.preventDefault();cam=E.camera({...cam,x:cam.x+d[0],y:cam.y+d[1]},viewport);render()}};
function defaultHint(){return mode==='edit'?'빈 곳을 끌어 이동 · 요소를 눌러 꾸미기 · 휠로 확대':'어디든 끌어서 관람 · 미니맵을 눌러 이동 · 휠로 확대'}
function nextZ(){return Math.max(0,...state.items.map(o=>o.z))+1}
function add(type,content,style={}){if(mode!=='edit')return;window.MuseDrawingUI?.exit();let w=type==='photo'?300:type==='sticker'?110:300,h=type==='photo'?340:type==='sticker'?110:230;beginChange();let o=object(type,E.clamp(cam.x-w/2,0,E.W-w),E.clamp(cam.y-h/2,0,E.H-h),w,h,content,style);o.z=nextZ();state.items.push(o);selection=o.id;updateInspector();changed()}
function updateInspector(fill=true){let o=selected();$('inspector').hidden=!o||mode!=='edit';if(!o)return;$('selectedType').textContent=types[o.type];$('textFields').hidden=!['photo','text'].includes(o.type);$('content').parentElement.hidden=o.type!=='text';$('caption').parentElement.hidden=o.type!=='photo';$('styleFields').hidden=['mask','drawing'].includes(o.type);$('rotation').parentElement.hidden=o.type==='mask';$('frameLabel').hidden=o.type!=='photo';for(let id of ['ink','paper','fontSize','font','align','radius','border','shadow']){let show=o.type==='text'||o.type==='photo';if(['ink','fontSize','font','align'].includes(id)&&o.type==='photo')show=!!o.caption||(id==='ink'&&o.style.border>0);if(id==='paper'&&o.type==='photo')show=o.style.frame!=='none';$(id).closest('label').hidden=!show}$('advancedStyles').hidden=['mask','drawing'].includes(o.type);$('stickerOpacity').hidden=o.type!=='sticker';$('detailsStyles').hidden=!['text','photo'].includes(o.type);$('forward').hidden=$('backward').hidden=o.type==='mask';$('selectionHint').textContent=o.type==='mask'?'네 모서리 핸들로 구역 크기를 조절하세요.':'모서리 네모로 크기 · 위 원형 핸들로 회전';if(!fill){$('objW').value=Math.round(o.w);$('objH').value=Math.round(o.h);$('rotation').value=o.r;$('rotationLabel').textContent=o.r+'°';return}for(let id of ['content','caption'])$(id).value=o[id];$('objW').value=Math.round(o.w);$('objH').value=Math.round(o.h);$('rotation').value=o.r;$('rotationLabel').textContent=o.r+'°';for(let id of ['ink','paper','fontSize','font','align','frame','radius','border','opacity'])$(id).value=o.style[id];for(let id of ['ink','paper'])paintColor($(id),o.style[id]);$('shadow').checked=o.style.shadow;$('stickerAlpha').value=o.style.opacity}
function updateProp(fn){let o=selected();if(!o)return;beginChange();fn(o);changed();updateInspector(false)}
for(let id of ['content','caption'])$(id).oninput=()=>{updateProp(o=>o[id]=$(id).value);if(id==='caption')updateInspector()};
for(let [id,key] of [['objW','w'],['objH','h']])$(id).oninput=()=>{if(!$(id).value)return;updateProp(o=>{let n=Number($(id).value);o[key]=E.clamp(Number.isFinite(n)?n:100,40,key==='w'?E.W:E.H);o.x=E.clamp(o.x,0,E.W-o.w);o.y=E.clamp(o.y,0,E.H-o.h)})};
// A continuous edit creates one undo entry, while every input event redraws immediately.
let controlEdit=null;
function liveControl(id,apply){let el=$(id);function input(){let o=selected();if(!o)return;if(controlEdit!==id){beginChange();controlEdit=id}apply(o,el);changed();$('rotationLabel').textContent=o.r+'°'}el.oninput=input;el.onchange=()=>{if(controlEdit!==id)input();controlEdit=null};el.onblur=()=>{controlEdit=null}}
liveControl('rotation',(o,el)=>o.r=Number(el.value));
for(let id of ['fontSize','font','align','frame','radius','border','opacity','shadow'])liveControl(id,(o,el)=>{if(id==='shadow')o.style[id]=el.checked;else if(['fontSize','radius','border','opacity'].includes(id)){if(el.value==='')return;o.style[id]=E.clamp(Number(el.value),id==='fontSize'?4:id==='opacity'?10:0,id==='fontSize'?200:100)}else o.style[id]=el.value;if(id==='frame')updateInspector()});
liveControl('stickerAlpha',(o,el)=>o.style.opacity=Number(el.value));

function paintColor(button,color){button.value=color;button.style.borderLeft='24px solid '+color}
function chooseColor(initial,apply){const d=$('colorDialog');d.dataset.edited='';let chosen=initial;d.innerHTML='<h2>색 지정</h2><p>색을 고른 뒤 확인을 눌러 적용하세요.</p><div class="swatches" id="colorPresets"></div><label>색 선택<input type="color" id="colorPicker"></label><label>색상 코드<input id="colorHex" maxlength="7" placeholder="#C6D9B0"></label><div id="colorSample" style="height:45px;border-radius:8px;border:1px solid #ddd"></div><div class="actions"><button id="colorCancel">취소</button><button class="primary" id="colorConfirm">확인</button></div>';
function previewColor(v){if(!/^#[0-9a-f]{6}$/i.test(v))return;chosen=v;$('colorPicker').value=v;$('colorHex').value=v;$('colorSample').style.background=v;$('colorConfirm').disabled=false}
for(let color of ['#586044','#fffdf6','#c6d9b0','#a9cde0','#d9ad91','#77634f','#e6e9c9','#f3f0e3']){let b=document.createElement('button');b.style.background=color;b.setAttribute('aria-label',color);b.onclick=()=>previewColor(color);$('colorPresets').append(b)}
previewColor(initial);$('colorPicker').oninput=e=>previewColor(e.target.value);$('colorHex').oninput=e=>{if(/^#[0-9a-f]{6}$/i.test(e.target.value))previewColor(e.target.value);else $('colorConfirm').disabled=true};$('colorCancel').onclick=()=>d.close();$('colorConfirm').onclick=()=>{apply(chosen);d.close()};d.showModal()}
for(let id of ['ink','paper'])$(id).onclick=()=>{const o=selected();if(!o)return;const objectId=o.id;chooseColor(o.style[id],color=>{if(selection!==objectId)return;updateProp(o=>o.style[id]=color);paintColor($(id),color)})};

$('closeInspector').onclick=()=>{selection=null;updateInspector();render()};$('delete').onclick=()=>{if(!selected())return;beginChange();state.items=state.items.filter(o=>o.id!==selection);selection=null;updateInspector();changed()};$('duplicate').onclick=()=>{let o=selected();if(!o)return;beginChange();o=clone(o);o.id=(crypto.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2));o.x=E.clamp(o.x+40,0,E.W-o.w);o.y=E.clamp(o.y+40,0,E.H-o.h);o.z=nextZ();state.items.push(o);selection=o.id;updateInspector();changed()};
for(let [id,dir]of[['forward',1],['backward',-1]])$(id).onclick=()=>updateProp(o=>{let order=sorted(state.items.filter(x=>x.type!=='mask')),i=order.findIndex(x=>x.id===o.id),j=i+dir;if(j>=0&&j<order.length){[order[i],order[j]]=[order[j],order[i]];order.forEach((x,n)=>x.z=n)}});
$('undo').onclick=undo;$('redo').onclick=redo;$('zoomIn').onclick=()=>setZoom(cam.z*1.2);$('zoomOut').onclick=()=>setZoom(cam.z/1.2);$('zoomLabel').onclick=()=>setZoom(1);$('resetCamera').onclick=()=>{cam=E.camera({...activeState().start},viewport);render()};
$('addText').onclick=()=>openDialog('이야기 남기기','<label>내용<textarea id="newText" rows="4" placeholder="지금의 생각, 좋아하는 문장…"></textarea></label><button class="primary" id="createText">보드에 붙이기</button>',()=>{$('createText').onclick=()=>{let text=$('newText').value.trim();if(!text)return;add('text',text);$('dialog').close()};$('newText').focus()});
$('addSticker').onclick=()=>openDialog('작은 소품 붙이기','<p>하나를 고르면 지금 보는 곳의 중앙에 붙어요.</p><div class="stickers" id="stickers"></div>',()=>{for(let symbol of ['✳','🌷','🌿','⭐','🎀','🍋','☁','♡','✿','〰']){let b=document.createElement('button');b.textContent=symbol;b.onclick=()=>{add('sticker',symbol);$('dialog').close()};$('stickers').append(b)}});
async function optimize(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('JPG, PNG, WebP만 추가할 수 있어요.');if(file.size>10*1024*1024)throw Error('사진은 한 장에 10MB 이하로 선택해주세요.');let url=URL.createObjectURL(file),img=new Image();try{await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(Error('읽을 수 없는 이미지예요.'));img.src=url});let ratio=Math.min(1,1600/img.width,1600/img.height),c=document.createElement('canvas');c.width=Math.round(img.width*ratio);c.height=Math.round(img.height*ratio);let g=c.getContext('2d');g.drawImage(img,0,0,c.width,c.height);return{src:c.toDataURL(file.type==='image/png'?'image/png':'image/jpeg',.82),ratio:img.height/img.width}}finally{URL.revokeObjectURL(url)}}
$('addPhoto').onclick=()=>$('photoInput').click();$('photoInput').onchange=async e=>{let f=e.target.files[0];if(!f)return;await prepareMedia(async()=>{try{let im=await optimize(f);add('photo',im.src,{paper:'#fffdf6'});let o=selected();o.h=E.clamp(Math.round(o.w*im.ratio),40,E.H);updateInspector();changed()}catch(err){toast(err.message)}e.target.value=''})};
$('bgInput').onchange=async e=>{let f=e.target.files[0];if(!f)return;await prepareMedia(async()=>{try{let im=await optimize(f);beginChange();state.background.image=im.src;changed();toast('배경 이미지를 반복해서 적용했어요.')}catch(err){toast(err.message)}e.target.value=''})};
$('background').onclick=()=>openDialog('나의 보드 배경','<p>이 보드에만 적용됩니다. 사진은 반복 배경으로 배치돼요.</p><div class="swatches" id="swatches"></div><label>직접 고른 색<button id="bgColor" class="color-trigger">색 선택</button></label><label>배경 패턴<select id="pattern"><option value="dots">작은 점</option><option value="grid">격자</option><option value="none">단색</option></select></label><button id="bgUpload">배경 이미지 추가</button> <button id="bgRemove">배경 이미지 제거</button>',()=>{paintColor($('bgColor'),state.background.color);$('pattern').value=state.background.pattern;for(let color of ['#f3f0e3','#e6eddb','#dfedf1','#f3e3da','#dbcbb3','#ffffff']){let b=document.createElement('button');b.style.background=color;b.setAttribute('aria-label',color);b.onclick=()=>chooseColor(color,c=>{beginChange();state.background.color=c;paintColor($('bgColor'),c);changed()});$('swatches').append(b)}$('bgColor').onclick=()=>chooseColor(state.background.color,color=>{beginChange();state.background.color=color;paintColor($('bgColor'),color);changed()});$('pattern').onchange=()=>{beginChange();state.background.pattern=$('pattern').value;changed()};$('bgUpload').onclick=()=>$('bgInput').click();$('bgRemove').onclick=()=>{beginChange();state.background.image=null;changed()}});
function setRegion(t){window.MuseDrawingUI?.exit();tool=tool===t?null:t;selection=null;updateInspector();$('hint').textContent=tool?(t==='mask'?'보드에서 드래그하여 친구 가림막 구역을 그려주세요. Esc로 취소':'보드에서 드래그하여 대표 화면 영역을 그려주세요. Esc로 취소'):defaultHint();render()}
$('addMask').onclick=()=>setRegion('mask');$('selectCover').onclick=()=>setRegion('cover');$('setStart').onclick=()=>{beginChange();state.start={...cam};changed();toast('현재 카메라 위치와 줌을 입장 지점으로 저장했어요.')};
function setMode(m){window.MuseDrawingUI?.exit();window.MuseMessages?.closeDetail();gesture=null;pointers.clear();mode=m;selection=null;tool=null;preview=false;$('maskPreview').checked=false;$('toolbar').hidden=m!=='edit';$('toolbar').style.display=m==='edit'?'flex':'none';$('viewOptions').hidden=m!=='view';$('publish').hidden=m!=='edit';$('modeLabel').textContent=m==='edit'?'꾸미기':'관람';$('viewMode').textContent=m==='edit'?'관람하기':'꾸미기로';$('hint').textContent=defaultHint();updateInspector();updateHistory();window.MuseSocial?.onBoardMode(m);render()}
function showEditor(m){document.body.classList.add('board-active');$('viewMode').hidden=false;$('landing').hidden=true;$('other').hidden=true;$('editor').hidden=false;setMode(m);resize();cam=E.camera({...activeState().start},viewport);render()}
$('editEntry').onclick=()=>showEditor('edit');$('enter').onclick=()=>{$('version').value=publication?'published':'draft';showEditor('view')};$('viewMode').onclick=()=>{if(mode==='edit'){$('version').value='draft';setMode('view')}else setMode('edit')};$('maskPreview').onchange=()=>{preview=$('maskPreview').checked;render()};$('version').onchange=()=>{if($('version').value==='published'&&!publication){$('version').value='draft';toast('아직 공개한 버전이 없어요. 꾸미기에서 공개하기를 눌러주세요.')}cam=E.camera({...activeState().start},viewport);render()};
$('publish').onclick=async()=>{try{publication=snapshot();await storeRecord('published',publication);await persist();toast('이 브라우저의 공개 버전을 갱신했어요. 실제 SNS 발행은 아닙니다.')}catch{toast('공개 버전을 저장하지 못했어요.')}};
function showIntro(){document.body.classList.remove('board-active');if(dirty)persist();$('editor').hidden=true;$('other').hidden=true;$('landing').hidden=false;drawCover();document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='intro'));window.MuseSocial?.onBoardExit()}
$('back').onclick=showIntro;$('brand').onclick=e=>{e.preventDefault();showIntro()};
function manage(){if(window.MUSE_BETA){window.MuseBeta.manage();return}openDialog('전시관 관리','<p>초안은 이 브라우저에 저장됩니다. 공개하기를 누르면 서버 연결 시 공개본도 저장합니다. 방문 통계·배경음악은 미연동입니다.</p><button id="backup">초안 JSON 백업</button> <button id="restore">백업 불러오기</button><input type="file" id="restoreFile" accept="application/json" hidden><hr><button id="sample">샘플 보드 불러오기</button> <button id="newBlank">빈 보드로 시작</button><p>샘플/빈 보드 전환도 실행 취소로 되돌릴 수 있어요. 기존 첫 버전의 저장 데이터는 덮어쓰지 않습니다.</p>',()=>{$('backup').onclick=()=>{let b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='muse-board.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};$('restore').onclick=()=>$('restoreFile').click();$('restoreFile').onchange=async e=>{try{let parsed=JSON.parse(await e.target.files[0].text());E.fitWorld(parsed);validate(parsed);beginChange();state=parsed;selection=null;changed();drawCover();$('dialog').close();toast('백업을 불러왔어요.')}catch{toast('올바른 MUSE v2 백업 파일을 선택해주세요.')}};for(let [id,fn]of[['sample',sample],['newBlank',blank]])$(id).onclick=()=>{beginChange();state=fn();selection=null;cam=E.camera({...state.start},viewport);changed();drawCover();$('dialog').close();toast(id==='sample'?'샘플 보드를 불러왔어요.':'빈 보드로 시작해요. 실행 취소로 복구할 수 있어요.')}})}
function validate(s){if(s?.schema!==2||!Array.isArray(s.items)||s.items.length>2000||!s.background||!s.start||!s.cover)throw Error();let ids=new Set;for(let o of s.items){if(!types[o.type]||typeof o.id!=='string'||ids.has(o.id)||typeof o.content!=='string'||!o.style)throw Error();ids.add(o.id);for(let k of ['x','y','w','h','r','z'])if(!Number.isFinite(o[k]))throw Error();if(o.w<40||o.h<40||o.w>E.W||o.h>E.H||o.x<0||o.y<0||o.x+o.w>E.W||o.y+o.h>E.H)throw Error();if(o.type==='drawing')MuseDrawing.validate(o.drawing);if(o.type==='photo'&&!/^(data:image\/(png|jpeg|webp);base64,|assets\/|\/api\/media\/[a-f0-9-]{36}$)/.test(o.content))throw Error()}for(let k of ['x','y','z'])if(!Number.isFinite(s.start[k]))throw Error();if(s.start.z<.2||s.start.z>2)throw Error();if(s.background.image&&!/^(data:image\/(png|jpeg|webp);base64,|\/api\/media\/[a-f0-9-]{36}$)/.test(s.background.image))throw Error();for(let k of ['x','y','w','h'])if(!Number.isFinite(s.cover[k]))throw Error();if(s.cover.w<=0||s.cover.h<=0)throw Error()}
$('manage').onclick=manage;
function help(){if(window.MUSE_BETA){window.MuseBeta.help();return}openDialog('MUSE 프로토타입 테스트','<p><b>1. 내 전시관 또는 전시관 카드</b>를 누르면 바로 보드가 열려요. 상단 프로필 박스의 꾸미기를 누르면 편집할 수 있어요. 빈 곳 드래그는 카메라 이동, 요소 드래그는 배치입니다.</p><p><b>2. 우하단 미니맵</b>의 점을 클릭하거나 누른 채 끌어보세요. 테두리가 현재 시야입니다. 지도에 포커스 후 방향키로도 이동합니다.</p><p><b>3. 사진·글·스티커</b>는 현재 시야 중앙에 생깁니다. 선택하면 크기·회전 핸들과 속성 패널이 열려요. 사진은 JPG/PNG/WebP, 10MB 이하, 최대 1600px로 최적화합니다.</p><p><b>4. 친구 가림막·대표 영역</b> 버튼을 누른 뒤 보드에서 직사각형을 그리세요. 가림막과 겹친 부분만 가려지고 바깥 부분은 그대로 보입니다.</p><p><b>5. 관람</b> 중 요소는 움직이지 않습니다. 관장 전용 가림막 보기로 공개 모습을 확인하세요. 대표 화면에도 가림막이 적용됩니다.</p><p><b>6. 초안 자동 저장 / 공개하기</b>가 분리돼요. 공개 후 초안을 수정해도 공개 버전은 유지됩니다. 관리에서 백업·복원이 가능해요.</p><hr><p>보드: 6,000×4,000 월드, 줌 20~200%, 한 개 보드. 모바일 한 손가락 이동, 두 손가락 확대/이동.</p><p><b>로컬 데모 한계:</b> 홈·탐색·관계·방문 통계는 샘플입니다. 메시지에서 실제 사용자와 샘플 대화를 구분합니다. 실제 대화와 공개본은 서버에서 권한을 검사하며, 서버는 비친구에게 가림막과 겹치는 전시품 원본을 보내지 않습니다. 내 초안과 샘플 보드는 브라우저에 원본이 남는 편집 데모입니다. 배경음악은 미연동입니다.</p>')}
$('help').onclick=help;
document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)||$('dialog').open||$('colorDialog').open)return;if(e.key==='Escape'){window.MuseDrawingUI?.exit();tool=null;selection=null;gesture=null;$('hint').textContent=defaultHint();updateInspector();render()}if($('editor').hidden||mode!=='edit')return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo()}if((e.key==='Delete'||e.key==='Backspace')&&selection){e.preventDefault();$('delete').click()}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'&&selection){e.preventDefault();$('duplicate').click()}});
new ResizeObserver(resize).observe($('stage'));window.addEventListener('resize',resize);window.addEventListener('beforeunload',e=>{if(dirty){persist();e.preventDefault();e.returnValue=''}});
(async()=>{if(window.MUSE_BETA){let b=await window.MuseBoot;if(!b.member)return;window.MuseAccount=b.user;}try{db=await new Promise((resolve,reject)=>{let r=indexedDB.open(window.MUSE_BETA?'muse-account-'+window.MuseAccount.id:'muse-prototype-v2',1);r.onupgradeneeded=()=>r.result.createObjectStore('boards');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});let stored;if(window.MUSE_BETA){const [local,r]=await Promise.all([readRecord('draft'),fetch('/api/board/draft',{cache:'no-store',headers:{'x-muse-account':window.MuseAccount.id}})]);stored=local;if(!r.ok)throw Error();let b=await r.json();window.MuseDraftRevision=b.revision;const localSnapshot=stored&&JSON.stringify(stored);if(localSnapshot&&localSnapshot!==JSON.stringify(b.board)){window.MuseRecovery=stored;if(localSnapshot.includes('data:image/'))await storeRecord('recovery',stored)}window.MuseRecovery=(await readRecord('recovery'))||window.MuseRecovery;stored=b.board;}else stored=await readRecord('draft');if(stored){if(stored.world?.w!==E.W||stored.world?.h!==E.H)await storeRecord('before-world-resize',clone(stored));E.fitWorld(stored);validate(stored);state=stored}else state=window.MUSE_BETA?blank():sample();publication=window.MUSE_BETA?null:await readRecord('published');if(publication){if(publication.world?.w!==E.W||publication.world?.h!==E.H)await storeRecord('published-before-world-resize',clone(publication));E.fitWorld(publication);validate(publication);await storeRecord('published',publication)}}catch{if(window.MUSE_BETA){window.dispatchEvent(new Event('muse-load-error'));return}state=sample();toast('저장된 보드를 읽지 못해 샘플을 열었어요. 관리에서 백업할 수 있어요.')}ready=true;cam={...state.start};drawCover();updateHistory();render();if(db&&!window.MUSE_BETA)persist();window.dispatchEvent(new Event('muse-ready'))})();
