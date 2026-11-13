const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {readFileSync}=require('node:fs');
const source=readFileSync('dist/theme.js','utf8');

test('theme defaults to the system, follows system changes and persists manual choices',()=>{
  const saved=new Map();
  let onChange;
  const system={matches:false,addEventListener:(event,fn)=>{assert.equal(event,'change');onChange=fn}};
  const create=()=>{
    const document={documentElement:{dataset:{}}};
    const window={matchMedia:()=>system};
    vm.runInNewContext(source,{document,window,localStorage:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)}});
    return {theme:window.MuseTheme,root:document.documentElement};
  };
  const first=create();
  assert.equal(first.root.dataset.theme,'light');
  system.matches=true;onChange();
  assert.equal(first.root.dataset.theme,'dark');
  first.theme.set('light');
  system.matches=false;onChange();system.matches=true;onChange();
  assert.equal(first.root.dataset.theme,'light');
  const reload=create();
  assert.equal(reload.theme.get(),'light');
  assert.equal(reload.root.dataset.theme,'light');
  reload.theme.set('system');
  assert.equal(reload.root.dataset.theme,'dark');
});
