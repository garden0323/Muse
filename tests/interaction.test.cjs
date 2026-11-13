const {test}=require('node:test'),assert=require('node:assert/strict'),I=require('../dist/interaction.js');
test('short mouse and touch taps, within 7 CSS pixels, qualify',()=>{for(const type of ['mouse','touch']){let g=I.start({x:10,y:10},0);assert.equal(I.tap(g,{x:14,y:13},100),true,type)}});
test('drag stays sticky after returning to original point; no release click',()=>{let g=I.start({x:10,y:10},0);I.move(g,{x:18,y:10});I.move(g,{x:10,y:10});assert.equal(I.tap(g,{x:10,y:10},100),false)});
test('release far away without intermediate move is never a tap',()=>{let g=I.start({x:0,y:0},0);assert.equal(I.tap(g,{x:100,y:0},100),false)});
test('long press and pointer cancellation never count as clicks',()=>{let g=I.start({x:0,y:0},0);assert.equal(I.tap(g,{x:0,y:0},501),false);g.cancelled=true;assert.equal(I.tap(g,{x:0,y:0},100),false)});
