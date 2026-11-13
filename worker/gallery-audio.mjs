import {fail,id} from './api.mjs';
import {readBytes,isBlocked} from './beta.mjs';

const maxBytes=12*1024*1024;
const quota=120*1024*1024;
const types={
 'audio/mpeg':'audio/mpeg','audio/mp3':'audio/mpeg',
 'audio/mp4':'audio/mp4','audio/x-m4a':'audio/mp4','audio/m4a':'audio/mp4',
 'audio/aac':'audio/aac','audio/aacp':'audio/aac','audio/x-aac':'audio/aac',
 'audio/wav':'audio/wav','audio/wave':'audio/wav','audio/x-wav':'audio/wav','audio/vnd.wave':'audio/wav'
};
export const audioIdPattern=/^[a-f0-9-]{36}$/;

export function detectAudio(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const tag=(i,n=4)=>String.fromCharCode(...bytes.subarray(i,i+n));
 if(bytes.length<12)return null;
 if(tag(0)==='RIFF'&&tag(8)==='WAVE'){
   const end=view.getUint32(4,true)+8;
   let format=false,data=false;
   if(end>bytes.length)return null;
   for(let i=12;i+8<=end;){
     const size=view.getUint32(i+4,true);
     if(i+8+size>end)return null;
     if(tag(i)==='fmt '&&size>=16)format=[1,3,65534].includes(view.getUint16(i+8,true));
     if(tag(i)==='data'&&size>0)data=true;
     i+=8+size+(size%2);
   }
   return format&&data?'audio/wav':null;
 }
 if(tag(4)==='ftyp'){
   let sound=false,video=false,data=false;
   function scan(start,end,depth){
     for(let i=start;i+8<=end;){
       let size=view.getUint32(i),head=8;
       if(size===1){if(i+16>end)return;size=Number(view.getBigUint64(i+8));head=16}
       if(size===0)size=end-i;
       if(size<head||i+size>end)return;
       const type=tag(i+4),body=i+head;
       if(type==='hdlr'&&size>=head+12){sound||=tag(body+8)==='soun';video||=tag(body+8)==='vide'}
       if(type==='mdat'&&size>head)data=true;
       if(depth<3&&['moov','trak','mdia'].includes(type))scan(body,i+size,depth+1);
       i+=size;
     }
   }
   scan(0,bytes.length,0);
   return sound&&!video&&data?'audio/mp4':null;
 }
 let start=0;
 if(tag(0,3)==='ID3'){
   const size=bytes.subarray(6,10);
   if(size.some(n=>n>127))return null;
   start=10+size.reduce((n,b)=>n*128+b,0)+(bytes[5]&16?10:0);
 }
 if(start+7>bytes.length||bytes[start]!==255)return null;
 const a=bytes[start+1],b=bytes[start+2];
 if((a&246)===240&&((b>>2)&15)<13){
   const length=((bytes[start+3]&3)<<11)|(bytes[start+4]<<3)|(bytes[start+5]>>5);
   return length>=7&&start+length<=bytes.length?'audio/aac':null;
 }
 const version=(a>>3)&3,bitrateIndex=b>>4,sampleIndex=(b>>2)&3;
 if((a&224)===224&&version!==1&&(a&6)===2&&bitrateIndex>0&&bitrateIndex<15&&sampleIndex<3){
   const bitrate=(version===3?[32,40,48,56,64,80,96,112,128,160,192,224,256,320]:
     [8,16,24,32,40,48,56,64,80,96,112,128,144,160])[bitrateIndex-1];
   const sampleRate=[44100,48000,32000][sampleIndex]/(version===3?1:version===2?2:4);
   const length=Math.floor((version===3?144000:72000)*bitrate/sampleRate)+((b>>1)&1);
   if(start+length<=bytes.length)return 'audio/mpeg';
 }
 return null;
}

export async function normalizeMusic(music,uid,db){
 const {track}=music;
 if(!['none','quiet','upload'].includes(track))fail(400,'지원하지 않는 음악이에요.');
 let file={};
 if(track==='upload'){
   const row=typeof music.id==='string'&&audioIdPattern.test(music.id)&&await db.prepare(
     "SELECT id FROM media WHERE id=? AND owner=? AND state='ready' AND mime LIKE 'audio/%'"
   ).bind(music.id,uid).first();
   if(!row)fail(403,'본인이 업로드한 음악만 저장할 수 있어요.');
   file={id:row.id,name:String(music.name||'업로드한 음악').slice(0,120)};
 }
 return {track,...file,volume:Number.isFinite(music.volume)?Math.max(0,Math.min(1,music.volume)):.25,
   ...(track!=='none'&&music.loop===false?{loop:false}:{})};
}

export async function uploadGalleryAudio(req,env,uid){
 if(!env.BUCKET)fail(503,'음악 저장소가 연결되지 않았어요.');
 const declared=req.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
 if(declared!=='application/octet-stream'&&!Object.hasOwn(types,declared))fail(415,'MP3, M4A/AAC, WAV 파일을 선택해 주세요.');
 if(Number(req.headers.get('content-length'))>maxBytes)fail(413,'음악 파일은 12MB까지 올릴 수 있어요.');
 const bytes=await readBytes(req,maxBytes),mime=detectAudio(bytes);
 if(!mime||(declared!=='application/octet-stream'&&types[declared]!==mime))fail(400,'음악 파일 형식이 일치하지 않아요.');
 const mid=id(),key=uid+'/audio/'+mid,db=env.DB;
 const reserved=await db.prepare(`INSERT INTO media(id,owner,object_key,bytes,mime,created)
 SELECT ?,?,?,?,?,? WHERE COALESCE((SELECT SUM(bytes) FROM media WHERE owner=? AND mime LIKE 'audio/%'),0)+?<=?
 RETURNING id`).bind(mid,uid,key,bytes.length,mime,Date.now(),uid,bytes.length,quota).first();
 if(!reserved)fail(413,'음악 저장 한도에 도달했어요.');
 try{
   await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime}});
   await db.prepare("UPDATE media SET state='ready' WHERE id=? AND owner=?").bind(mid,uid).run();
 }catch{
   try{
     await env.BUCKET.delete(key);
     await db.prepare('DELETE FROM media WHERE id=? AND owner=?').bind(mid,uid).run();
   }catch{}
   fail(503,'음악을 저장하지 못했어요. 다시 시도해 주세요.');
 }
 return {id:mid};
}

function requestedRange(value,size){
 const match=/^bytes=(\d*)-(\d*)$/.exec(value);
 if(!match||(!match[1]&&!match[2]))return null;
 const offset=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
 const last=match[1]&&match[2]?Math.min(size-1,Number(match[2])):size-1;
 return Number.isSafeInteger(offset)&&Number.isSafeInteger(last)&&offset<size&&last>=offset?{offset,length:last-offset+1}:null;
}

export async function serveGalleryAudio(req,env,uid,mid){
 if(!env.BUCKET)fail(503,'음악 저장소가 연결되지 않았어요.');
 const db=env.DB;
 const row=await db.prepare(`SELECT a.* FROM media a JOIN beta_members m ON m.user_id=a.owner
   WHERE a.id=? AND a.state='ready' AND a.mime LIKE 'audio/%' AND m.active=1
   AND (a.owner=? OR m.role NOT IN ('admin','super_admin'))`).bind(mid,uid).first();
 if(!row)fail(404,'음악을 찾을 수 없어요.');
 if(row.owner!==uid){
   const gallery=await db.prepare('SELECT board FROM galleries WHERE owner=?').bind(row.owner).first();
   const music=gallery&&JSON.parse(gallery.board).music;
   if(music?.track!=='upload'||music.id!==mid||await isBlocked(db,uid,row.owner))fail(404,'음악을 찾을 수 없어요.');
 }
 const headers={'content-type':row.mime,'accept-ranges':'bytes','cache-control':'private, no-store',
   'x-content-type-options':'nosniff','cross-origin-resource-policy':'same-origin'};
 const rangeHeader=req.headers.get('range'),range=rangeHeader&&requestedRange(rangeHeader,row.bytes);
 if(rangeHeader&&!range)return new Response(null,{status:416,headers:{...headers,'content-range':'bytes */'+row.bytes}});
 const file=await env.BUCKET.get(row.object_key,range?{range}:undefined);
 if(!file)fail(404,'음악을 찾을 수 없어요.');
 if(range)headers['content-range']='bytes '+range.offset+'-'+(range.offset+range.length-1)+'/'+row.bytes;
 headers['content-length']=String(range?range.length:row.bytes);
 return new Response(req.method==='HEAD'?null:file.body,{status:range?206:200,headers});
}
