import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {visitRanks, seoulDay} from '../worker/visit-ranks.mjs';

const now = Date.parse('2026-11-11T14:59:59.999Z');
const day = '2026-11-11';

function fixture(counts) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  for (const name of ['0000_messaging','0001_private_beta','0006_repeat_visits','0007_visit_rank_cache']) {
    db.exec(readFileSync('drizzle/'+name+'.sql','utf8'));
  }
  const addUser = db.prepare('INSERT INTO users(id,name,handle) VALUES(?,?,?)');
  addUser.run('visitor','Visitor','visitor');
  const addVisit = db.prepare(`INSERT INTO visits(gallery_id,visitor,day,last_seen,visit_count)
    VALUES(?,'visitor',?,?,?) ON CONFLICT(gallery_id,visitor,day)
    DO UPDATE SET visit_count=excluded.visit_count`);
  function count(id,value,date=day) { addVisit.run(id,date,now,value); }
  counts.forEach((value,index)=>{
    const id=String.fromCharCode(97+index);
    addUser.run(id,id,'muse.'+id);
    db.prepare("INSERT INTO beta_members(user_id,role,joined,privacy_version) VALUES(?,'member',0,'test')").run(id);
    db.prepare("INSERT INTO galleries(id,owner,title,board,updated) VALUES(?,?,?,'{}',0)").run(id,id,id);
    if(value)count(id,value);
  });
  let refreshes=0,aggregations=0,reads=0;
  // Instrument the aggregate input to distinguish attempted writes from actual recomputation.
  db.function('count_rank_row',value=>{aggregations++;return value});
  const binding=()=>({prepare(sql){
    let args=[];
    const write=sql.includes('UPDATE visit_rank_cache');
    const stmt=db.prepare(write?sql.replaceAll('v.visit_count','count_rank_row(v.visit_count)'):sql);
    return {
      bind(...values){args=values;return this},
      async first(){
        const result=stmt.get(...args);
        if(write&&result)refreshes++;
        if(!write)reads++;
        return result;
      }
    };
  }});
  return {db,binding,count,metrics:()=>({refreshes,aggregations,reads})};
}

for (const [name,counts,expected] of [
  ['single 1st, 2nd, 3rd',[100,90,80,70],{a:1,b:2,c:3}],
  ['two tied 1st',[500,500,300,200],{a:1,b:1,c:3}],
  ['four tied 1st',[100,100,100,100,90],{a:1,b:1,c:1,d:1}],
  ['two tied 2nd',[1000,800,800,600],{a:1,b:2,c:2}],
  ['three tied 3rd',[100,90,80,80,80,70],{a:1,b:2,c:3,d:3,e:3}],
  ['multiple groups',[200,200,150,150,100],{a:1,b:1,c:3,d:3}],
  ['zero excluded',[5,2,0,0],{a:1,b:2}],
  ['all zero',[0,0],{}],
]) {
  test('competition rankings: '+name,async()=>{
    const f=fixture(counts);
    const snapshot=await visitRanks(f.binding(),now);
    assert.deepEqual(snapshot,{day,badges:Object.fromEntries(Object.entries(expected).map(([id,rank])=>[id,{total:rank,daily:rank}]))});
  });
}

test('cache reuse across bindings, simultaneous refresh and badge removal after ties form and split',async()=>{
  const f=fixture([100,90,80,70]);
  const ts=now-600000;
  const results=await Promise.all(Array.from({length:20},()=>visitRanks(f.binding(),ts)));
  assert.ok(results.every(r=>r.badges.c.daily===3));
  const first=f.metrics();
  assert.equal(first.refreshes,1);
  assert.ok(first.aggregations>0);
  f.count('d',90);
  assert.equal((await visitRanks(f.binding(),ts+119999)).badges.d,undefined);
  assert.deepEqual(f.metrics(),{...first,reads:first.reads+1});
  const changed=await visitRanks(f.binding(),ts+120000);
  assert.deepEqual(changed.badges,{a:{total:1,daily:1},b:{total:2,daily:2},d:{total:2,daily:2}});
  assert.equal(f.metrics().refreshes,2);
  assert.equal(f.metrics().aggregations,2*first.aggregations);
  f.count('d',95);
  assert.deepEqual((await visitRanks(f.binding(),ts+240000)).badges,{a:{total:1,daily:1},b:{total:3,daily:3},d:{total:2,daily:2}});
});

test('KST midnight invalidates only daily ranks immediately, including with old requests in flight',async()=>{
  const f=fixture([20,10,0]);
  assert.equal(seoulDay(now),day);
  assert.equal(seoulDay(now+1),'2026-11-12');
  assert.equal((await visitRanks(f.binding(),now)).badges.b.daily,2);
  const midnight=await visitRanks(f.binding(),now+1);
  assert.deepEqual(midnight,{day:'2026-11-12',badges:{a:{total:1,daily:null},b:{total:2,daily:null}}});
  await visitRanks(f.binding(),now);
  assert.equal(f.db.prepare('SELECT day FROM visit_rank_cache').get().day,'2026-11-12');
  f.count('c',1,'2026-11-12');
  assert.deepEqual((await visitRanks(f.binding(),now+300001)).badges,
    {a:{total:1,daily:null},b:{total:2,daily:null},c:{total:3,daily:1}});
});

test('historic counts persist, owner visits and hidden or suspended galleries do not affect public rankings',async()=>{
  const f=fixture([10,30,40,0]);
  f.count('d',15,'2020-01-01');
  f.db.prepare("UPDATE beta_members SET role='admin' WHERE user_id='b'").run();
  f.db.prepare("UPDATE beta_members SET active=0 WHERE user_id='c'").run();
  f.db.prepare("INSERT INTO visits(gallery_id,visitor,day,last_seen,visit_count) VALUES('a','a',?,0,99)").run(day);
  const snapshot=await visitRanks(f.binding(),now);
  assert.deepEqual(snapshot.badges,{a:{total:2,daily:1},d:{total:1,daily:null}});
  assert.equal(f.db.prepare('SELECT SUM(visit_count) n FROM visits').get().n,194);
});
