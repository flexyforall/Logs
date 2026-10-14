"""Emit use_figma scripts (prelude + slide JSON) from a deck's out/spec.json.

Usage: python3 figma_build.py OUT_DIR PAGE_ID 01,02,03,04 05,06,07,08 ...
Slides with row=1 (backup) go in a second row under the main deck."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from gru_kit import STYLES

PRELUDE = r'''
const ST = __ST__;
const page = await figma.getNodeByIdAsync(__PAGE__);
await figma.setCurrentPageAsync(page);
await figma.loadFontAsync({family:'Inter',style:'Regular'});
await figma.loadFontAsync({family:'Inter',style:'Medium'});
const icon = await figma.getNodeByIdAsync('747:1105');
const logoSrc = await figma.getNodeByIdAsync('2731:644');
const hx = h => { h = h.replace('#',''); return {r:parseInt(h.slice(0,2),16)/255, g:parseInt(h.slice(2,4),16)/255, b:parseInt(h.slice(4,6),16)/255}; };
const solid = (h,o) => ({type:'SOLID', color:hx(h), opacity:(o==null?1:o)});
const GT = {lr:[[1,0,0],[0,1,0]], rl:[[-1,0,1],[0,1,0]], tb:[[0,1,0],[-1,0,1]], bt:[[0,-1,1],[1,0,0]]};
const out = {frames:[], imgs:[], errors:[]};
async function txt(p, e) {
  const n = figma.createText(); p.appendChild(n);
  n.fontName = {family:'Inter', style:'Regular'};
  n.characters = e.r.map(r=>r[0]).join('');
  const k = e.k || 1;
  if (e.w) { n.textAutoResize = 'HEIGHT'; n.resize(e.w / k, 10); } else { n.textAutoResize = 'WIDTH_AND_HEIGHT'; }
  n.textAlignHorizontal = ({L:'LEFT', C:'CENTER', R:'RIGHT'})[e.a || 'L'];
  let i = 0;
  for (const r of e.r) { const L = r[0].length; if (L) n.setRangeFills(i, i+L, [solid('#FFFFFF', r[2])]); i += L; }
  i = 0;
  for (const r of e.r) { const L = r[0].length; if (L) await n.setRangeTextStyleIdAsync(i, i+L, ST[r[1]]); i += L; }
  if (k !== 1) n.rescale(k);
  n.x = e.x; n.y = e.y;
  n.name = e.n || 'text';
  return n;
}
function rect(p, e) {
  const n = figma.createRectangle(); p.appendChild(n);
  n.resize(Math.max(e.w, 0.01), Math.max(e.h, 0.01)); n.x = e.x; n.y = e.y;
  n.fills = e.f ? [solid(e.f, e.fo)] : [];
  if (e.s) { n.strokes = [solid(e.s, e.so)]; n.strokeWeight = e.sw || 2; n.strokeAlign = 'INSIDE'; if (e.d) n.dashPattern = [10, 8]; }
  if (e.rd) n.cornerRadius = e.rd;
  n.name = e.n || 'rect';
  return n;
}
function grad(p, e) {
  const n = figma.createRectangle(); p.appendChild(n);
  n.resize(e.w, e.h); n.x = e.x; n.y = e.y;
  n.fills = [{type:'GRADIENT_LINEAR', gradientTransform: GT[e.dir], gradientStops:[{position:0, color:{r:0,g:0,b:0,a:e.a0}}, {position:1, color:{r:0,g:0,b:0,a:e.a1}}]}];
  n.name = e.n || 'shade';
  return n;
}
async function arrow(p, e) {
  const v = figma.createVector(); p.appendChild(v);
  await v.setVectorNetworkAsync({vertices:[{x:0,y:0},{x:e.x2-e.x1, y:e.y2-e.y1, strokeCap:'ARROW_LINES'}], segments:[{start:0,end:1}], regions:[]});
  v.strokes = [solid('#FFFFFF', e.o)]; v.strokeWeight = 2; v.fills = [];
  v.x = Math.min(e.x1, e.x2); v.y = Math.min(e.y1, e.y2) - (e.y1 === e.y2 ? 0 : 0);
  v.name = 'arrow';
  return v;
}
function plus(p, e) { const n = icon.createInstance(); p.appendChild(n); n.rescale(e.sz / 19); n.x = e.x; n.y = e.y; n.name = 'Icon'; return n; }
function logo(p, e) { const n = logoSrc.clone(); p.appendChild(n); n.rescale(e.sz / 80); n.x = e.x; n.y = e.y; n.name = 'GRU logo'; return n; }
function img(p, e, sid) {
  const n = figma.createRectangle(); p.appendChild(n);
  n.resize(e.w, e.h); n.x = e.x; n.y = e.y; n.fills = [solid('#1A1A1A', 1)];
  if (e.o != null) n.opacity = e.o; if (e.rd) n.cornerRadius = e.rd;
  n.name = e.n; out.imgs.push({slide: sid, n: e.n, id: n.id});
  return n;
}
async function notesBlock(f, s) {
  const box = figma.createAutoLayout('VERTICAL', {name: 'Speaker notes · ' + s.id, itemSpacing: 16});
  page.appendChild(box);
  box.paddingTop = 40; box.paddingBottom = 40; box.paddingLeft = 40; box.paddingRight = 40;
  box.fills = [solid('#0D0D0D', 1)];
  box.counterAxisSizingMode = 'FIXED'; box.resize(1920, 100); box.primaryAxisSizingMode = 'AUTO';
  const h = figma.createText(); box.appendChild(h);
  h.fontName = {family:'Inter', style:'Medium'}; h.characters = 'SPEAKER NOTES · SLIDE ' + s.id; h.fontSize = 16; h.letterSpacing = {unit:'PERCENT', value:4};
  h.fills = [solid('#FFFFFF', 0.5)];
  const t = figma.createText(); box.appendChild(t);
  t.fontName = {family:'Inter', style:'Regular'}; t.characters = s.notes; t.fontSize = 22; t.lineHeight = {unit:'PIXELS', value:32};
  t.fills = [solid('#FFFFFF', 0.75)]; t.textAutoResize = 'HEIGHT'; t.layoutSizingHorizontal = 'FILL';
  box.x = f.x; box.y = f.y + 1080 + 60;
  return box;
}
const SLIDES = __SLIDES__;
for (const s of SLIDES) {
  const f = figma.createFrame(); page.appendChild(f);
  f.name = s.name; f.resize(1920, 1080); f.x = s.fx; f.y = s.fy;
  f.fills = [solid(s.bg, 1)]; f.clipsContent = true;
  for (const e of s.els) {
    try {
      if (e.t === 'x') await txt(f, e);
      else if (e.t === 'r') rect(f, e);
      else if (e.t === 'g') grad(f, e);
      else if (e.t === 'a') await arrow(f, e);
      else if (e.t === 'p') plus(f, e);
      else if (e.t === 'l') logo(f, e);
      else if (e.t === 'i') img(f, e, s.id);
    } catch (err) { out.errors.push(s.id + ':' + (e.n || e.t) + ':' + String(err).slice(0, 160)); }
  }
  const nb = await notesBlock(f, s);
  out.frames.push({id: f.id, name: f.name, notes: nb.id});
}
return out;
'''


def main(out_dir, page_id, batches):
    spec = json.load(open(os.path.join(out_dir, 'spec.json')))
    st = {k: v['id'] for k, v in STYLES.items()}
    slides = spec['slides']
    # row 0: main slides left to right; row 1: slides marked row=1 (backup)
    col = {0: 0, 1: 0}
    for s in slides:
        row = s.get('row', 0)
        s['fx'], s['fy'] = col[row] * 2040, row * 2400
        col[row] += 1
    by_id = {s['id']: s for s in slides}
    for bi, ids in enumerate(batches):
        data = json.dumps([by_id[i] for i in ids], ensure_ascii=False, separators=(',', ':')).replace('\u2028', '\\u2028')
        code = PRELUDE.replace('__ST__', json.dumps(st)).replace('__PAGE__', json.dumps(page_id)).replace('__SLIDES__', data)
        p = os.path.join(out_dir, f'figma_call_{bi + 1}.js')
        open(p, 'w').write(code)
        print(p, len(code))


if __name__ == '__main__':
    out_dir, page_id = sys.argv[1], sys.argv[2]
    batches = [b.split(',') for b in sys.argv[3:]]
    main(out_dir, page_id, batches)
