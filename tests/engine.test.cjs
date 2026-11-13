const assert=require('node:assert/strict'),E=require('../dist/engine.js');
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name)}
test('월드↔화면 변환: 줌별 왕복',()=>{for(let z of [.2,.5,1,2]){let c={x:4567,y:7890,z},v={w:1320,h:780},p={x:5321,y:8123},q=E.toWorld(E.toScreen(p,c,v),c,v);assert.ok(Math.abs(q.x-p.x)<1e-9);assert.ok(Math.abs(q.y-p.y)<1e-9)}});
test('모든 모서리와 줌에서 카메라 경계',()=>{for(let z of [.2,1,2])for(let x of [-1000,5000,12000])for(let y of [-1000,5000,12000]){let v={w:1000,h:700},c=E.camera({x,y,z},v);assert.ok(c.x-v.w/z/2>=0);assert.ok(c.x+v.w/z/2<=E.W);assert.ok(c.y-v.h/z/2>=0);assert.ok(c.y+v.h/z/2<=E.H)}});
test('월드보다 큰 뷰포트도 중심 유지',()=>assert.deepEqual(E.camera({x:0,y:99999,z:.2},{w:3000,h:3000}),{x:3000,y:2000,z:.2}));
test('직사각형 미니맵 시야 사각형이 실제 좌표/줌과 일치',()=>{let c={x:4500,y:1000,z:.5},v={w:1000,h:600};assert.deepEqual(E.miniRect(c,v,180,120),{x:105,y:12,w:60,h:36})});
test('회전 오브젝트 실제 히트 테스트',()=>{let o={x:100,y:100,w:200,h:40,r:90};assert.equal(E.hit(o,{x:200,y:200}),true);assert.equal(E.hit(o,{x:110,y:120}),false)});
const area=rs=>rs.reduce((a,r)=>a+r.w*r.h,0),pointVisible=(rs,x,y)=>rs.some(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h);
test('일부 교차: 가림막 안만 제외하고 오브젝트 바깥 부분 유지',()=>{let rs=E.publicRegions([{x:100,y:100,w:200,h:200}]);assert.equal(area(rs),E.W*E.H-40000);assert.equal(pointVisible(rs,290,150),false);assert.equal(pointVisible(rs,310,150),true);assert.equal(pointVisible(rs,90,150),true)});
test('겹친 가림막은 합집합: 중복 영역 재노출 없음',()=>{let rs=E.publicRegions([{x:100,y:100,w:200,h:200},{x:200,y:200,w:200,h:200}]);assert.equal(area(rs),E.W*E.H-70000);for(let p of [[150,150],[250,250],[350,350]])assert.equal(pointVisible(rs,...p),false);assert.equal(pointVisible(rs,410,350),true)});
test('가림막 없거나 월드 전체 가림: 원래 면적/빈 공개 영역',()=>{assert.equal(area(E.publicRegions([])),E.W*E.H);assert.deepEqual(E.publicRegions([{x:0,y:0,w:E.W,h:E.H}]),[])});
test('왼쪽 아래 포함 네 모서리 리사이즈: 반대 꼭짓점 고정',()=>{let b={x:300,y:200,w:200,h:100,r:0};for(let [corner,p,expected] of [[0,{x:250,y:150},{x:250,y:150,w:250,h:150}],[1,{x:550,y:150},{x:300,y:150,w:250,h:150}],[2,{x:550,y:350},{x:300,y:200,w:250,h:150}],[3,{x:250,y:350},{x:250,y:200,w:250,h:150}]])assert.deepEqual(E.resizeObject(b,corner,p),expected)});
test('가림막 리사이즈 역방향 교차도 최소 40px 유지',()=>{let r=E.resizeObject({x:300,y:200,w:200,h:100,r:0},3,{x:600,y:100});assert.equal(r.w,40);assert.equal(r.h,40);assert.equal(r.x,460);assert.equal(r.y,200)});
test('기존 보드 이관: 비율 유지, 경계, 반복 실행 안전',()=>{let s={world:{w:10000,h:10000},items:[{x:9000,y:9000,w:500,h:300,style:{fontSize:24,radius:5,border:0}}],start:{x:5000,y:5000,z:1},cover:{x:0,y:0,w:1000,h:700}};E.fitWorld(s);assert.deepEqual(s.world,{w:6000,h:4000});assert.equal(s.items[0].w/s.items[0].h,500/300);assert.ok(s.items[0].x+s.items[0].w<=E.W);assert.ok(s.items[0].y+s.items[0].h<=E.H);let before=JSON.stringify(s);E.fitWorld(s);assert.equal(JSON.stringify(s),before)});
console.log(count+' tests passed');
