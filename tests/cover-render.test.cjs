const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');

test('representative covers paint the selected background to every canvas edge at any aspect ratio', () => {
  const source = readFileSync('dist/app.js', 'utf8');
  const calls = [];
  const ctx = Object.fromEntries(['save','restore','scale','translate','beginPath','rect','clip']
    .map(name => [name, (...args) => calls.push([name, ...args])]));
  const sandbox = {
    background: (_ctx, state, rect) => calls.push(['background', state.background.image, rect]),
    clipPublic: () => calls.push(['public clip']),
    sorted: items => items,
    visibleItems: () => [],
    drawMask: () => calls.push(['mask'])
  };
  vm.createContext(sandbox);
  vm.runInContext(source.slice(source.indexOf('function paintCover('), source.indexOf('function drawCover()')), sandbox);
  for (const [w,h] of [[240,600],[700,250],[1000,700]]) {
    calls.length = 0;
    const canvas = {getContext: () => ctx};
    const cover = {x: 1200, y: 2500, w, h};
    const image = '/api/media/example';
    sandbox.paintCover(canvas, {cover, background:{image}, items:[{type:'mask'}]}, 900);
    const [, sx, sy] = calls.find(([name]) => name === 'scale');
    assert.equal(Math.round(w*sx), canvas.width);
    assert.equal(Math.round(h*sy), canvas.height);
    assert.deepEqual(calls.find(([name]) => name === 'translate'), ['translate', -cover.x, -cover.y]);
    assert.deepEqual(calls.find(([name]) => name === 'background'), ['background', image, cover]);
    assert.ok(calls.findIndex(([name]) => name === 'public clip') < calls.findIndex(([name]) => name === 'mask'));
  }
});
