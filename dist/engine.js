(function(root){
const W=6000,H=4000,clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function camera(c,v){const w=v.w/c.z,h=v.h/c.z;return {...c,x:w>=W?W/2:clamp(c.x,w/2,W-w/2),y:h>=H?H/2:clamp(c.y,h/2,H-h/2)}}
function toWorld(p,c,v){return{x:c.x+(p.x-v.w/2)/c.z,y:c.y+(p.y-v.h/2)/c.z}}
function toScreen(p,c,v){return{x:(p.x-c.x)*c.z+v.w/2,y:(p.y-c.y)*c.z+v.h/2}}
function miniRect(c,v,width,height=width){let left=Math.max(0,c.x-v.w/c.z/2),top=Math.max(0,c.y-v.h/c.z/2),right=Math.min(W,c.x+v.w/c.z/2),bottom=Math.min(H,c.y+v.h/c.z/2);return{x:left/W*width,y:top/H*height,w:(right-left)/W*width,h:(bottom-top)/H*height}}
function fitWorld(s){let old=s.world||{w:10000,h:10000};if(old.w===W&&old.h===H)return s;let scale=Math.min(W/old.w,H/old.h),ox=(W-old.w*scale)/2,oy=(H-old.h*scale)/2;for(let o of s.items){o.w=clamp(o.w*scale,40,W);o.h=clamp(o.h*scale,40,H);o.x=clamp(o.x*scale+ox,0,W-o.w);o.y=clamp(o.y*scale+oy,0,H-o.h);o.style.fontSize=clamp(o.style.fontSize*scale,4,200);o.style.unit=(o.style.unit||1)*scale;o.style.radius*=scale;o.style.border*=scale}let r=s.cover;s.cover={x:r.x*scale+ox,y:r.y*scale+oy,w:r.w*scale,h:r.h*scale};s.start={x:s.start.x*scale+ox,y:s.start.y*scale+oy,z:clamp(s.start.z/scale,.2,2)};s.world={w:W,h:H};return s}
function resizeObject(b,corner,p){let r=b.r*Math.PI/180,signs=[[-1,-1],[1,-1],[1,1],[-1,1]][corner],ax=b.x+b.w/2-signs[0]*b.w/2*Math.cos(r)+signs[1]*b.h/2*Math.sin(r),ay=b.y+b.h/2-signs[0]*b.w/2*Math.sin(r)-signs[1]*b.h/2*Math.cos(r),dx=p.x-ax,dy=p.y-ay,w=clamp(signs[0]*(dx*Math.cos(r)+dy*Math.sin(r)),40,W),h=clamp(signs[1]*(-dx*Math.sin(r)+dy*Math.cos(r)),40,H),cx=ax+signs[0]*w/2*Math.cos(r)-signs[1]*h/2*Math.sin(r),cy=ay+signs[0]*w/2*Math.sin(r)+signs[1]*h/2*Math.cos(r);return {w,h,x:clamp(cx-w/2,0,W-w),y:clamp(cy-h/2,0,H-h)}}

function bounds(o){let r=(o.r||0)*Math.PI/180,w=Math.abs(Math.cos(r))*o.w+Math.abs(Math.sin(r))*o.h,h=Math.abs(Math.sin(r))*o.w+Math.abs(Math.cos(r))*o.h;return{x:o.x+o.w/2-w/2,y:o.y+o.h/2-h/2,w,h}}
function intersects(a,b){return a.x<=b.x+b.w&&a.x+a.w>=b.x&&a.y<=b.y+b.h&&a.y+a.h>=b.y}
// Disjoint visible rectangles: subtract the union of mask areas from the world.
function publicRegions(masks){let regions=[{x:0,y:0,w:W,h:H}];for(let m of masks){regions=regions.flatMap(a=>{let x=Math.max(a.x,m.x),y=Math.max(a.y,m.y),right=Math.min(a.x+a.w,m.x+m.w),bottom=Math.min(a.y+a.h,m.y+m.h);if(right<=x||bottom<=y)return[a];return [{x:a.x,y:a.y,w:a.w,h:y-a.y},{x:a.x,y:bottom,w:a.w,h:a.y+a.h-bottom},{x:a.x,y,w:x-a.x,h:bottom-y},{x:right,y,w:a.x+a.w-right,h:bottom-y}].filter(r=>r.w>0&&r.h>0)})}return regions}
function hit(o,p){let a=-(o.r||0)*Math.PI/180,dx=p.x-o.x-o.w/2,dy=p.y-o.y-o.h/2,x=dx*Math.cos(a)-dy*Math.sin(a),y=dx*Math.sin(a)+dy*Math.cos(a);return Math.abs(x)<=o.w/2&&Math.abs(y)<=o.h/2}
const E={W,H,clamp,camera,toWorld,toScreen,miniRect,bounds,intersects,publicRegions,hit,fitWorld,resizeObject};if(typeof module!=='undefined')module.exports=E;else root.MuseEngine=E;
})(typeof window!=='undefined'?window:this);
