"""Emit use_figma scripts (prelude + slide JSON) from a deck's out/spec.json.

Usage: python3 figma_build.py OUT_DIR PAGE_ID 01,02,03,04 05,06,07,08 ...
Slides with row=1 (backup) go in a second row under the main deck."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from gru_kit import STYLES
from gru_outline import layout, glyph_path, upem

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
async function img(p, e, sid) {
  const n = figma.createRectangle(); p.appendChild(n);
  n.resize(e.w, e.h); n.x = e.x; n.y = e.y; n.fills = [solid('#1A1A1A', 1)];
  if (e.o != null) n.opacity = e.o; if (e.rd) n.cornerRadius = e.rd;
  n.name = e.n;
  if (e.from) { const src = await figma.getNodeByIdAsync(e.from); n.fills = JSON.parse(JSON.stringify(src.fills)); }
  else if (e.hash) { n.fills = [e.tf ? {type:'IMAGE', imageHash:e.hash, scaleMode:'CROP', imageTransform:e.tf} : {type:'IMAGE', imageHash:e.hash, scaleMode:'FILL'}]; }
  else out.imgs.push({slide: sid, n: e.n, id: n.id});
  return n;
}
let GLY = null;
async function outline(p, e) {
  if (!GLY) { const gn = await figma.getNodeByIdAsync(__GLYPHS__); GLY = JSON.parse(gn.characters); }
  const made = [];
  for (const [op, runs] of e.g) {
    const parts = []; let mnx = 1e9, mny = 1e9;
    const pts = [];
    for (const [fi, size100, by10, x10, seq] of runs) {
      const s = size100 / 100 / GLY.u[fi], by = by10 / 10;
      let xx = x10;
      for (let j = 0; j < seq.length; j += 2) {
        xx += seq[j + 1];
        const d = GLY.g[fi][seq[j]]; if (!d) continue;
        const gx = xx / 10;
        const toks = d.match(/[MLHVCQZ]|-?[0-9]*\.?[0-9]+/g);
        let cmd = '', i = 0, cx = 0, cy = 0;
        const X = v => gx + v * s, Y = v => by - v * s;
        while (i < toks.length) {
          const t = toks[i];
          if (/[MLHVCQZ]/.test(t)) { cmd = t; i++; if (cmd === 'Z') pts.push(['Z']); continue; }
          if (cmd === 'M' || cmd === 'L') { cx = +toks[i]; cy = +toks[i + 1]; i += 2; pts.push([cmd, X(cx), Y(cy)]); if (cmd === 'M') cmd = 'L'; }
          else if (cmd === 'H') { cx = +toks[i]; i += 1; pts.push(['L', X(cx), Y(cy)]); }
          else if (cmd === 'V') { cy = +toks[i]; i += 1; pts.push(['L', X(cx), Y(cy)]); }
          else if (cmd === 'C') { const a = toks.slice(i, i + 6).map(Number); i += 6; cx = a[4]; cy = a[5]; pts.push(['C', X(a[0]), Y(a[1]), X(a[2]), Y(a[3]), X(a[4]), Y(a[5])]); }
          else if (cmd === 'Q') { const a = toks.slice(i, i + 4).map(Number); i += 4; cx = a[2]; cy = a[3]; pts.push(['Q', X(a[0]), Y(a[1]), X(a[2]), Y(a[3])]); }
          else i++;
        }
      }
    }
    for (const q of pts) for (let k = 1; k < q.length; k += 2) { if (q[k] < mnx) mnx = q[k]; if (q[k + 1] < mny) mny = q[k + 1]; }
    if (!pts.length) continue;
    const data = pts.map(q => q.length === 1 ? 'Z' : q[0] + ' ' + q.slice(1).map((v, k) => (k % 2 ? v - mny : v - mnx).toFixed(2)).join(' ')).join(' ');
    const v = figma.createVector(); p.appendChild(v);
    v.vectorPaths = [{windingRule: 'NONZERO', data}];
    v.fills = [solid('#FFFFFF', op)]; v.strokes = [];
    v.x = mnx; v.y = mny; v.name = e.n || 'text';
    made.push(v);
  }
  if (made.length > 1) { const g = figma.group(made, p); g.name = e.n || 'text'; return g; }
  return made[0];
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
  const live = [];
  for (const e of s.els) {
    try {
      if (e.t === 'x') { await outline(f, e); live.push(await txt(f, e)); }
      else if (e.t === 'r') rect(f, e);
      else if (e.t === 'g') grad(f, e);
      else if (e.t === 'a') await arrow(f, e);
      else if (e.t === 'p') plus(f, e);
      else if (e.t === 'l') logo(f, e);
      else if (e.t === 'i') await img(f, e, s.id);
    } catch (err) { out.errors.push(s.id + ':' + (e.n || e.t) + ':' + String(err).slice(0, 160)); }
  }
  if (live.length) { const lg = figma.group(live, f); lg.name = 'Live text — editable, hidden (turn on when brand fonts render)'; lg.visible = false; }
  const nb = await notesBlock(f, s);
  let cs = 0, nc = 0;
  for (const e of s.els) { if (e.g) for (const [op, runs] of e.g) for (const r of runs) { cs += r[0] + r[1] + r[2] + r[3]; for (const v of r[4]) cs += v; } if (e.r) for (const r of e.r) nc += r[0].length; }
  out.frames.push({id: f.id, sid: s.id, cs, nc, notes: s.notes.length});
}
return out;
'''


def attach_glyphs(slides):
    used = {}
    for s in slides:
        for e in s['els']:
            if e['t'] != 'x':
                continue
            groups = {}
            for fi, gid, x, base, size, op in layout(e):
                used.setdefault(fi, set()).add(gid)
                key = (op,)
                runs = groups.setdefault(op, [])
                k = (fi, round(size * 100), round(base * 10))
                xi = round(x * 10)
                if not runs or tuple(runs[-1][:3]) != k:
                    runs.append([k[0], k[1], k[2], xi, []])
                    runs[-1].append(xi)
                runs[-1][4] += [gid, xi - runs[-1][5]]
                runs[-1][5] = xi
            e['g'] = [[op, [r[:5] for r in runs]] for op, runs in groups.items()]
    table = {'u': {fi: upem(fi) for fi in used}, 'g': {fi: {gid: glyph_path(fi, gid) for gid in sorted(g)} for fi, g in used.items()}}
    return table


GLYPH_CALL = r'''
const page = await figma.getNodeByIdAsync(__PAGE__);
await figma.setCurrentPageAsync(page);
await figma.loadFontAsync({family:'Inter', style:'Regular'});
const old = page.children.filter(n => n.name !== '_gru glyph table (temporary)');
const removed = old.length; for (const n of old) n.remove();
let t = page.children.find(n => n.name === '_gru glyph table (temporary)');
if (!t) { t = figma.createText(); page.appendChild(t); t.fontName = {family:'Inter', style:'Regular'}; t.name = '_gru glyph table (temporary)'; t.x = -4000; t.y = 0; t.visible = false; }
t.characters = __TABLE__;
return {glyphNode: t.id, removed};
'''


def main(out_dir, page_id, batches, glyph_node=None):
    spec = json.load(open(os.path.join(out_dir, 'spec.json')))
    st = {k: v['id'] for k, v in STYLES.items()}
    slides = spec['slides']
    # row 0: main slides left to right; row 1: slides marked row=1 (backup)
    col = {0: 0, 1: 0}
    for s in slides:
        row = s.get('row', 0)
        s['fx'], s['fy'] = col[row] * 2040, row * 2400
        col[row] += 1
    table = attach_glyphs(slides)
    gcode = GLYPH_CALL.replace('__PAGE__', json.dumps(page_id)).replace('__TABLE__', json.dumps(json.dumps(table, separators=(',', ':'))))
    open(os.path.join(out_dir, 'figma_call_0_glyphs.js'), 'w').write(gcode)
    print('glyph table call', len(gcode))
    by_id = {s['id']: s for s in slides}
    sums = {}
    for s in slides:
        cs = sum(r[0] + r[1] + r[2] + r[3] + sum(r[4]) for e in s['els'] if 'g' in e for _op, runs in e['g'] for r in runs)
        nc = sum(len(r[0]) for e in s['els'] if e['t'] == 'x' for r in e['r'])
        sums[s['id']] = dict(cs=cs, nc=nc, notes=len(s['notes']))
    json.dump(sums, open(os.path.join(out_dir, 'checksums.json'), 'w'), indent=0)
    for bi, ids in enumerate(batches):
        data = json.dumps([by_id[i] for i in ids], ensure_ascii=False, separators=(',', ':')).replace('\u2028', '\\u2028')
        code = PRELUDE.replace('__ST__', json.dumps(st)).replace('__PAGE__', json.dumps(page_id)).replace('__SLIDES__', data).replace('__GLYPHS__', json.dumps(glyph_node or 'GLYPH_NODE_ID'))
        p = os.path.join(out_dir, f'figma_call_{bi + 1}.js')
        open(p, 'w').write(code)
        print(p, len(code))


if __name__ == '__main__':
    out_dir, page_id = sys.argv[1], sys.argv[2]
    rest = sys.argv[3:]
    glyph_node = None
    if rest and rest[0].startswith('--glyphs='):
        glyph_node = rest[0].split('=', 1)[1]
        rest = rest[1:]
    main(out_dir, page_id, [b.split(',') for b in rest], glyph_node)
