/* Shared scroll smoothing: scroll-driven animations follow a critically-damped, time-based version of scrollY so motion eases instead of stepping with the wheel. */
var SM=window.__SM=(function(){
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches, y=scrollY, subs=[], run=false, last=0, TAU=95;
  function tick(now){
    var dt=Math.min(64,last?now-last:16); last=now;
    var d=scrollY-y; y=(Math.abs(d)<.15||reduce)?scrollY:y+d*(1-Math.exp(-dt/TAU));
    for(var i=0;i<subs.length;i++) subs[i]();
    if(y!==scrollY) requestAnimationFrame(tick); else {run=false;last=0}
  }
  function kick(){if(!run){run=true;requestAnimationFrame(tick)}}
  addEventListener('scroll',kick,{passive:true}); addEventListener('resize',kick);
  return {sub:function(f){subs.push(f)}, kick:kick, s:function(sec){return y-(sec.getBoundingClientRect().top+scrollY)}};
})();

/* Breakdown stack — pinned, scroll-scrubbed.
   Cards fly in alternately from left / right, tilted, ease to centre and stack;
   older cards stay behind, a little narrower, peeking above the newest. */
(function(){
  var sec=document.getElementById('breakdown'); if(!sec) return;
  var cards=[].slice.call(sec.querySelectorAll('[data-card]')); if(!cards.length) return;
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!reduce) document.documentElement.classList.add('vz-on');
  var FAR=1500, ROT=9, PEEK=0, SHRINK=0;
  // scroll windows in px scrolled past the section top (card 1 starts before pinning)
  var RANGES=[[null,300],[350,910],[1000,1560],[1650,2210]];
  function ease(t){return 1-Math.pow(1-t,3)}
  function clamp(v){return v<0?0:v>1?1:v}
  function update(){
    var s=SM.s(sec), vh=innerHeight;
    var e=cards.map(function(_,i){
      var a=RANGES[i][0]; if(a===null) a=-vh*0.55;
      var p=clamp((s-a)/(RANGES[i][1]-a));
      return reduce?(p>0?1:0):ease(p);
    });
    cards.forEach(function(c,i){
      var dir=(i%2===0)?-1:1;                       // 1st from left, 2nd from right, ...
      var d=0; for(var j=i+1;j<cards.length;j++) d+=e[j]; // how many newer cards sit on top
      var x=dir*FAR*(1-e[i]), rot=dir*ROT*(1-e[i])*(1-e[i]);
      var ty=-PEEK*d, sc=1-SHRINK*d;
      var covered=i+1<cards.length&&e[i+1]>=.999;     // fully hidden under the next card
      c.style.visibility=(e[i]>0&&!covered)?'visible':'hidden';
      if(e[i]>.96){ if(!c.classList.contains('is-in')){c.classList.add('is-in'); if(window.__bplay) window.__bplay(i,true)} } else if(e[i]<.02 && c.classList.contains('is-in')){c.classList.remove('is-in'); if(window.__bplay) window.__bplay(i,false)}
      c.style.zIndex=i+1;
      c.style.transform='translate3d('+x.toFixed(1)+'px,'+ty.toFixed(1)+'px,0) scale('+sc.toFixed(4)+') rotate('+rot.toFixed(2)+'deg)';
    });
  }
  var t=false; function on(){if(!t){t=true;requestAnimationFrame(function(){t=false;update()})}}
  SM.sub(update); addEventListener('resize',on); update();
})();

/* Statement: icon cards fall to the bottom of the block; hovering knocks them away. */
(function(){
  var sec=document.getElementById('statement'); if(!sec) return;
  var pin=sec.querySelector('.statement__pin')||sec, layer=sec.querySelector('.statement__cards'), els=[].slice.call(sec.querySelectorAll('.dcard'));
  var lead=sec.querySelector('.statement__lead'); if(!els.length) return;
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W=1440,H=810, R=81.5, G=2400, REST=0.42, FRIC=0.992;   // px/s² gravity, bounce, air drag
  var B=els.map(function(el,i){return{el:el,hx:+el.dataset.x,hy:+el.dataset.y,r0:+el.dataset.rot,
    x:0,y:0,vx:0,vy:0,a:+el.dataset.rot,va:0,t:0,go:false,delay:i*0.22}});
  var pointer=null, started=false, last=0, raf=0, W0=1440;
  var opened=false, RUN=800;
  function size(){var r=pin.getBoundingClientRect();W=r.width;H=r.height}
  function isOpen(){var r=sec.getBoundingClientRect();return -r.top>RUN*0.3}
  function draw(b){b.el.style.transform='translate3d('+(b.x).toFixed(1)+'px,'+(b.y).toFixed(1)+'px,0) rotate('+b.a.toFixed(1)+'deg)'}
  function place(b){b.x=W/2+b.hx; b.y=H/2+b.hy; b.el.style.opacity=1; draw(b)}
  if(reduce){size();B.forEach(place);return}
  function start(){
    if(started)return; started=true; size();
    if(lead){lead.style.transition='opacity .6s ease .1s';lead.style.opacity=1}
    B.forEach(function(b,i){ b.gone=false; // spawn above the block at its design x, a little jittered
      b.x=W/2+b.hx+(Math.random()-.5)*60; b.y=-R-60-i*40; b.vx=(Math.random()-.5)*120; b.vy=0;
      b.va=(Math.random()-.5)*160; b.el.style.opacity=1; b.go=false; b.t=0; draw(b)});
    last=performance.now(); raf=requestAnimationFrame(step);
  }
  if(lead){lead.style.opacity=0}
  new IntersectionObserver(function(es){if(es[0].isIntersecting)start()},{threshold:.5}).observe(pin);
  addEventListener('scroll',function(){var o=isOpen();if(o===opened)return;opened=o;
    if(o){B.forEach(function(b){b.vy=Math.max(b.vy,80+Math.random()*120);b.vx+=(Math.random()-.5)*160;b.va+=(Math.random()-.5)*120});if(!raf){last=performance.now();raf=requestAnimationFrame(step)}}
    else{started=false;B.forEach(function(b){b.el.style.opacity=0});start()}},{passive:true});
  pin.addEventListener('pointermove',function(e){var r=pin.getBoundingClientRect();pointer={x:e.clientX-r.left,y:e.clientY-r.top,px:pointer?pointer.x:0,py:pointer?pointer.y:0,t:performance.now()}; if(!raf){last=performance.now();raf=requestAnimationFrame(step)}});
  pin.addEventListener('pointerleave',function(){pointer=null});
  function step(now){
    var dt=Math.min(.033,(now-last)/1000); last=now; var moving=false;
    B.forEach(function(b,i){
      b.t+=dt; if(b.gone)return; if(b.t<b.delay){moving=true;return}
      // hover: knock away from the pointer
      if(pointer&&!opened){var dx=b.x-pointer.x, dy=b.y-pointer.y, d=Math.sqrt(dx*dx+dy*dy)||1;
        if(d<R+10&&(!b.hit||now-b.hit>350)){b.hit=now; var k=1;
          b.vx=dx/d*620+(Math.random()-.5)*120; b.vy=Math.min(-720,dy/d*620-380); b.va=(dx>=0?1:-1)*(180+Math.random()*160)}}
      b.vy+=G*dt; b.vx*=FRIC; b.x+=b.vx*dt; b.y+=b.vy*dt; b.a+=b.va*dt;
      // walls & floor
      var floor=opened?1e9:H-R-8;
      if(!opened&&b.y>floor){b.y=floor; if(Math.abs(b.vy)>140){b.vy=-b.vy*REST}else b.vy=0; b.vx*=.82; b.va*=.7}
      if(!opened){if(b.x<R){b.x=R;b.vx=Math.abs(b.vx)*.5} if(b.x>W-R){b.x=W-R;b.vx=-Math.abs(b.vx)*.5}}
      if(opened&&b.y>H+R+40){b.el.style.opacity=0;b.gone=true}
      if(b.y===floor&&b.vy===0){b.va*=.9; if(Math.abs(b.va)<4)b.va=0}
    });
    // simple card-vs-card separation
    for(var i=0;i<B.length;i++)for(var j=i+1;j<B.length;j++){var p=B[i],q=B[j]; if(opened||p.gone||q.gone)continue; var dx=q.x-p.x,dy=q.y-p.y,d=Math.sqrt(dx*dx+dy*dy)||1,m=2*R-8;
      if(d<m){var o=(m-d)/2,nx=dx/d,ny=dy/d;p.x-=nx*o;p.y-=ny*o;q.x+=nx*o;q.y+=ny*o;var rv=(q.vx-p.vx)*nx+(q.vy-p.vy)*ny;if(rv<0){p.vx+=nx*rv*.6;q.vx-=nx*rv*.6;p.vy+=ny*rv*.6;q.vy-=ny*rv*.6}}}
    B.forEach(function(b){if(b.gone)return;draw(b); if(b.vx*b.vx+b.vy*b.vy>25||b.va||opened)moving=true});
    raf=(moving||pointer)?requestAnimationFrame(step):0;
  }
})();

/* Flow creation — title appears small and keeps growing; cards sit stacked in the centre.
   Each card grows from small to full size, then flies off up-left (tilted) revealing the next small card
   underneath, which grows in turn. The last card stays. */
(function(){
  var sec=document.getElementById('flows'); if(!sec) return;
  var title=sec.querySelector('.flows__title'), cards=[].slice.call(sec.querySelectorAll('.fcard'));
  if(!title||!cards.length) return;
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var T1=80/144, T2=1;                      // drawn at the final size and scaled down, so the resting title stays sharp
  var G=.6;                                 // card scale when it is still "small"
  // [grow from, grow to, exit from, exit to] in px scrolled past the section top
  var EXIT=[[-.42,-.9,-12,7,-19],[.45,-.75,11,6,17],[0,-1,0,10,-9]];   // per card: x (of viewport width), y (of viewport height), tilt°
  var W=[[700,1200,1350,1850],[1600,2100,2250,2750],[2500,3000,null,null]];
  function clamp(v){return v<0?0:v>1?1:v}
  function io(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
  function out(t){return 1-Math.pow(1-t,3)}
  function update(){
    var s=SM.s(sec), vh=Math.max(innerHeight,720), a0=-vh*.35;
    var ap=clamp((s-a0)/(250-a0)), g2=clamp((s-300)/2700);
    if(reduce){ap=s>a0?1:0;g2=s>300?1:0}
    var sc=T1+(T2-T1)*io(g2);
    title.style.opacity=ap;
    title.style.transform='translate3d(0,'+((1-ap)*24).toFixed(1)+'px,0) scale('+sc.toFixed(4)+')';
    cards.forEach(function(c,i){
      var w=W[i]||W[W.length-1];
      var gp=clamp((s-w[0])/(w[1]-w[0])), ep=w[2]===null?0:clamp((s-w[2])/(w[3]-w[2]));
      if(reduce){gp=gp>0?1:0;ep=ep>0?1:0}
      var prevExit=i===0?1:clamp((s-W[i-1][2])/(W[i-1][3]-W[i-1][2]));
      var shown=i===0?gp>0:prevExit>0, gone=ep>=1;
      var gq=io(gp), scale=(G+(1-G)*gq), x=0,y=0,z=0,rot=0,rx=(1-gq)*9,ry=0, op=i===0?clamp(gp*4):1;
      if(ep>0){ var e=Math.pow(ep,2.2), t=ep, v=EXIT[i%EXIT.length];
        x=v[0]*innerWidth*e; y=v[1]*vh*e; rot=v[2]*e; z=240*e; rx=v[3]*t; ry=v[4]*t }
      c.style.visibility=(shown&&!gone)?'visible':'hidden'; c.style.opacity=op; c.style.zIndex=cards.length-i;
      c.style.transform='perspective(1500px) translate3d('+x.toFixed(1)+'px,'+y.toFixed(1)+'px,'+z.toFixed(1)+'px) rotateX('+rx.toFixed(2)+'deg) rotateY('+ry.toFixed(2)+'deg) rotate('+rot.toFixed(2)+'deg) scale('+scale.toFixed(4)+')';
    });
  }
  var t=false; function on(){if(!t){t=true;requestAnimationFrame(function(){t=false;update()})}}
  SM.sub(update); addEventListener('resize',on); update();
})();

/* Hero intro: loader -> dial wakes up, hand sweeps and pops the activity icons -> phone rises -> card settles, copy appears. */
(function(){
  var hero=document.getElementById('hero-intro'); if(!hero) return;
  var card=hero.querySelector('.hero__card'), dial=hero.querySelector('.dial'), hand=hero.querySelector('.dial__hand'),
      wake=hero.querySelector('.dial__wake'), loader=hero.querySelector('.loader'), spin=hero.querySelector('.loader__spin'),
      mock=hero.querySelector('.hero__mockup'), head=hero.querySelector('.hero__head'),
      title=hero.querySelector('.hero__title'), lead=hero.querySelector('.hero__lead'), store=hero.querySelector('.appstore'),
      orbs=[].slice.call(hero.querySelectorAll('.orb')), circle=hero.querySelector('.dial__circle');
  var root=document.documentElement;
  function done(){
    root.classList.remove('hero-anim'); hero.style.padding=''; card.style.height=''; card.style.borderRadius='';
    [dial,mock,head,hand,wake,loader].forEach(function(e){e.style.opacity='';e.style.transform=''});
    orbs.forEach(function(o){o.style.opacity='';o.style.transform=''});
    hand.style.opacity=0; wake.style.opacity=0; loader.style.opacity=0;
    [title,lead,store].forEach(function(e){e.style.opacity='';e.style.scale='';e.style.transform=''});
  }
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){done();return}
  var cr=circle.getBoundingClientRect(), cx=cr.left+cr.width/2, cy=cr.top+cr.height/2;
  var ang=orbs.map(function(o){var r=o.getBoundingClientRect();return Math.atan2(r.left+r.width/2-cx,-(r.top+r.height/2-cy))*180/Math.PI});
  var A0=-78, A1=56;
  function cl(v){return v<0?0:v>1?1:v}
  function ease(t){return 1-Math.pow(1-t,3)}
  function io(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
  function back(t){var c=1.9;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)}
  var T={load:1500, dial:[1300,2000], sweep:[1900,4300], hand:[4300,4800], phone:[4400,5500], card:[5300,6300], copy:[5800,6800]};
  function seg(t,a){return cl((t-a[0])/(a[1]-a[0]))}
  var ticks=(function(){var h='';for(var q=0;q<60;q++)h+='<i style="transform:rotate('+q*6+'deg);opacity:.2;height:12px;width:2px;margin-left:-1px"></i>';spin.innerHTML=h;return [].slice.call(spin.children)})();
  var t0=performance.now(), fid=0;
  // make sure the first frame is the loader on the grey card
  function frame(now){
    var t=(now-t0)*1.3;
    // loader: spins, fades in, then out as the dial wakes
    var lo=cl(t/300)*(1-seg(t,[1300,1800]));
    var lz=seg(t,[1300,1850]); loader.style.opacity=lo; loader.style.transform='scale('+(0.92+1.5*io(lz)).toFixed(3)+')';
    var pr=io(cl(t/1250))*60, ld=Math.min(59,Math.floor(pr));
    for(var q=0;q<60;q++){var v=cl(pr-q), e=ticks[q]; e.style.opacity=(.2+.8*v).toFixed(3); var on=q===ld&&pr<60&&pr>0; e.style.background=on?'#ff7234':'#fff'; e.style.height=(on?16:12)+'px'}
    // dial wakes up
    var d=ease(seg(t,T.dial)); dial.style.opacity=d; dial.style.transform='scale('+(.94+.06*d).toFixed(4)+')';
    // hand + wake + orbs
    var sp=io(seg(t,T.sweep)), a=A0+(A1-A0)*sp;
    var ho=seg(t,T.sweep)>0?(1-seg(t,T.hand)):0; if(seg(t,T.dial)<.2) ho=0;
    hand.style.opacity=ho; hand.style.transform='rotate('+a.toFixed(2)+'deg)';
    wake.style.opacity=ho*.9;
    wake.style.background='conic-gradient(from '+A0+'deg, rgba(255,150,100,0) 0deg, rgba(255,150,100,.26) '+Math.max(.1,a-A0).toFixed(1)+'deg, rgba(255,150,100,0) '+Math.max(.1,a-A0).toFixed(1)+'deg)';
    orbs.forEach(function(o,i){
      var pop=cl((a-ang[i]+2)/16); if(seg(t,T.sweep)<=0) pop=0;
      var s=pop<=0?0:back(pop);
      o.style.opacity=pop>0?Math.min(1,pop*3):0; o.style.transform='scale('+(.3+.7*s).toFixed(3)+')';
    });
    // phone + hand rise from the bottom
    var p=ease(seg(t,T.phone)); mock.style.opacity=seg(t,T.phone)>0?1:0; mock.style.transform='translate3d(0,'+((1-p)*(card.offsetHeight*.55)).toFixed(1)+'px,0)';
    // card: full-bleed -> inset rounded
    var c=io(seg(t,T.card)); hero.style.padding=(16*c).toFixed(2)+'px'; card.style.height=(812-32*c).toFixed(2)+'px'; card.style.borderRadius=(24*c).toFixed(2)+'px';
    // copy
    head.style.opacity=1; var k=seg(t,T.copy);
    var k1=cl(k*1.6), k2=cl((k-.15)*1.6), k3=cl((k-.3)*1.6), sp=window.__sp||ease;
    title.style.opacity=ease(cl(k1*2)); title.style.scale=(.82+.18*sp(k1)).toFixed(4);
    lead.style.opacity=ease(cl(k2*2)); lead.style.scale=(.82+.18*sp(k2)).toFixed(4);
    store.style.opacity=ease(cl(k3*2)); store.style.scale=(.82+.18*sp(k3)).toFixed(4);
    if(t<T.copy[1]+50) fid=requestAnimationFrame(frame); else done();
  }
  // initial hero state: full-bleed card
  hero.style.padding='0'; card.style.height='812px'; card.style.borderRadius='0';
  fid=requestAnimationFrame(frame);
})();

/* spring-scale-in: every text block springs from .6 to 1 (with overshoot) the first time it is visible. Uses the CSS `scale` property so it composes with scroll-driven transforms. */
(function(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var K=170, C=21, N=60, DUR=900, pts=[];            // stiffness, damping, samples, ms
  function raw(t){var w=Math.sqrt(K), z=C/(2*w), wd=w*Math.sqrt(1-z*z); return 1-Math.exp(-z*w*t)*(Math.cos(wd*t)+z*w/wd*Math.sin(wd*t))}
  var T=DUR/1000*1.0, i; for(i=0;i<=N;i++) pts.push(raw(i/N*T).toFixed(4));
  var lin='linear('+pts.join(',')+')';
  window.__sp=function(t){return raw(Math.max(0,Math.min(1,t))*T)};
  var SEL='.statement__title,.statement__lead,.flows__title,.foot__about,.foot__copy,.foot__legal,.foot h4,.foot a,.foot li';
  var els=[].slice.call(document.querySelectorAll(SEL)).filter(function(e){return !e.closest('#hero-intro')});
  var root=document.documentElement; root.classList.add('sp-on');
  els.forEach(function(e){e.classList.add('sp'); e.style.transformOrigin=getComputedStyle(e).textAlign==='center'?'50% 60%':'0% 60%'});
  var pending=els.slice(), queued=false;
  function eff(e){var o=e.style.opacity===''?1:parseFloat(e.style.opacity); for(var n=e.parentElement;n&&n!==document.body;n=n.parentElement){o*=parseFloat(getComputedStyle(n).opacity)} return o}
  function play(e){
    e.classList.add('sp-done');
    var a=e.animate([{scale:.82},{scale:1}],{duration:DUR,easing:lin,fill:'backwards'});
    e.animate([{opacity:0},{opacity:1}],{duration:380,easing:'ease-out',fill:'backwards'});
  }
  function check(){
    queued=false; var vh=innerHeight;
    pending=pending.filter(function(e){
      var r=e.getBoundingClientRect();
      if(r.bottom<0||r.top>vh*.94||!r.width) return true;
      if(getComputedStyle(e).visibility==='hidden') return true;
      if(eff(e)<.55) return true;
      play(e); return false;
    });
  }
  function q(){if(!queued){queued=true;requestAnimationFrame(check)}}
  addEventListener('scroll',q,{passive:true}); addEventListener('resize',q); (function loop(){check(); if(pending.length) setTimeout(loop,200)})();
})();

/* Less Noise story: text 1 -> text 2 -> headline -> headline lifts, phone rises. All driven by scroll inside a sticky pin. */
(function(){
  var sec=document.getElementById('hero-noise'); if(!sec) return;
  var card=sec.querySelector('.hero__card'), ring=sec.querySelector('.noise__ring img'), sweep=sec.querySelector('.nsweep'),
      t1=sec.querySelector('.nstory--1'), t2=sec.querySelector('.nstory--2'), head=sec.querySelector('.noise__head'),
      title=sec.querySelector('.noise__title'), lead=sec.querySelector('.noise__lead'), phone=sec.querySelector('.noise__phone'),
      halo=sec.querySelector('.noise__halo');
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){t1.style.display=t2.style.display=sweep.style.display='none';return}
  function cl(v){return v<0?0:v>1?1:v}
  function io(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
  function ease(t){return 1-Math.pow(1-t,3)}
  function lerp(a,b,t){return a+(b-a)*t}
  function seg(s,a,b){return cl((s-a)/(b-a))}
  function words(p){var w=p.textContent.split(' '); p.innerHTML=w.map(function(x){return '<span class="w">'+x+'</span>'}).join(' '); return [].slice.call(p.querySelectorAll('.w'))}
  var W1=words(t1.querySelector('p')), W2=words(t2.querySelector('p'));
  function mix(a,b,t){return 'rgb('+[0,1,2].map(function(i){return Math.round(lerp(a[i],b[i],t))}).join(',')+')'}
  function rgba(a,b,t,al){return 'rgba('+[0,1,2].map(function(i){return Math.round(lerp(a[i],b[i],t))}).join(',')+','+al+')'}
  function hl(ws,u,off,dim,bright){
    var n=ws.length; ws.forEach(function(w,i){var k=cl(off+u*(n-off+1)-i); w.style.color=mix(dim,bright,k)});
  }
  var BG=[[[232,232,232],[221,221,221]],[[152,152,155],[172,172,175]],[[77,75,83],[201,201,201]]];
  var enter=0, q=false, SP=function(t){return window.__sp?window.__sp(t):ease(t)};
  function update(){
    q=false;
    var r=sec.getBoundingClientRect(), s=SM.s(sec); if(r.bottom<-200||r.top>innerHeight+200) return;
    var a=io(seg(s,700,1200)), b=io(seg(s,1500,2000));
    var c1=[lerp(lerp(BG[0][0][0],BG[1][0][0],a),BG[2][0][0],b),lerp(lerp(BG[0][0][1],BG[1][0][1],a),BG[2][0][1],b),lerp(lerp(BG[0][0][2],BG[1][0][2],a),BG[2][0][2],b)];
    var c2=[lerp(lerp(BG[0][1][0],BG[1][1][0],a),BG[2][1][0],b),lerp(lerp(BG[0][1][1],BG[1][1][1],a),BG[2][1][1],b),lerp(lerp(BG[0][1][2],BG[1][1][2],a),BG[2][1][2],b)];
    card.style.background='linear-gradient(180deg,'+mix(c1,c1,0)+' 0%,'+mix(c2,c2,0)+' 139.02%)';
    ring.style.opacity=lerp(.55,1,seg(s,700,1200)).toFixed(3);
    halo.style.opacity=(.6*b).toFixed(3);
    // hand + wake
    var ang=140+250*seg(s,0,2200), hv=1-.65*seg(s,2500,3200);
    sweep.style.setProperty('--a',ang.toFixed(2)+'deg'); sweep.style.opacity=hv.toFixed(3);
    // text 1 (springs in the first time the card is on screen)
    var e1=enter?Math.min(1,(performance.now()-enter)/1000):0;
    var out1=io(seg(s,900,1150));
    t1.style.opacity=(ease(cl(e1*2.5))*(1-out1)).toFixed(3);
    t1.style.transform='scale('+(lerp(.82,1,SP(e1))+.06*out1).toFixed(4)+')';
    hl(W1,seg(s,60,900),2.5,[179,179,182],[28,28,30]);
    // text 2
    var in2=seg(s,1050,1350), out2=io(seg(s,1750,2000));
    t2.style.opacity=(ease(in2)*(1-out2)).toFixed(3);
    t2.style.transform='scale('+(lerp(.82,1,SP(in2))+.06*out2).toFixed(4)+')';
    hl(W2,seg(s,1300,1750),3,[196,196,199],[255,255,255]);
    var d2=[255,255,255]; W2.forEach(function(w,i){});
    // headline: appears centred, then lifts to the top
    var hi=seg(s,1950,2300), lift=io(seg(s,2500,3200));
    title.style.opacity=ease(hi).toFixed(3); title.style.scale=lerp(.82,1,SP(hi)).toFixed(4);
    var hl2=seg(s,2050,2400); lead.style.opacity=ease(hl2).toFixed(3); lead.style.scale=lerp(.82,1,SP(hl2)).toFixed(4);
    head.style.transform='translate(-50%,-50%) translateY('+(232*(1-lift)).toFixed(1)+'px)';
    // phone rises
    var pr=io(seg(s,2500,3300)); phone.style.transform='translateY('+((1-pr)*900).toFixed(1)+'px)';
    if(enter&&e1<1) requestAnimationFrame(update);
  }
  function req(){if(!q){q=true;requestAnimationFrame(update)}}
  new IntersectionObserver(function(en){if(en[0].isIntersecting&&!enter){enter=performance.now();req()}},{threshold:.35}).observe(card);
  SM.sub(update); addEventListener('resize',req); update();
})();

/* Breakdown illustrations: card 1 hand + clock, card 2 message feed, card 3 flickering squares. Card 4 is CSS only. */
(function(){
  var sec=document.getElementById('breakdown'); if(!sec) return;
  var cards=[].slice.call(sec.querySelectorAll('[data-card]')); if(cards.length<4) return;
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function cl(v){return v<0?0:v>1?1:v}
  function io(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
  /* ---- 1 · hand sweeps, clock counts to 5.20 ---- */
  var tot=cards[0].querySelector('.bv__total'), hand=cards[0].querySelector('.bv__hand'), BM={}, DOT='';
  [].forEach.call(tot.querySelectorAll('.px__g'),function(g){
    var ch=g.getAttribute('data-char'); if(ch==='.'){DOT=g.outerHTML;return}
    BM[ch]=[].map.call(g.children,function(c){return c.tagName==='I'?'1':'0'}).join('')});
  var EXTRA={ '1':'00100011000010000100001000010001110','3':'11110000010000101110000010000111110','4':'00010001100101010010111110001000010',
    '6':'01110100001000011110100011000101110','7':'11111000010001000100010000100001000','8':'01110100011000101110100011000101110','9':'01110100011000101111000010000101110' };
  for(var k in EXTRA) if(!BM[k]) BM[k]=EXTRA[k];
  function glyph(ch){return '<span class="px__g" style="--cols:5" data-char="'+ch+'">'+BM[ch].split('').map(function(v){return v==='1'?'<i></i>':'<b></b>'}).join('')+'</span>'}
  var lastV=-1;
  function clock(val){var v=Math.round(val*100); if(v===lastV) return; lastV=v;
    tot.innerHTML='<span class="px px--big px--ink" aria-hidden="true">'+glyph(String(Math.floor(v/100)%10))+DOT+'</span><span class="px px--big px--sec" aria-hidden="true">'+glyph(String(Math.floor(v/10)%10))+glyph(String(v%10))+'</span><span class="bv__h">h</span>'}
  var A0=48, A1=-32.5286, r1=0;
  window.__tl={A0:A0,A1:A1,set:function(e){setT(e)},stop:function(){cancelAnimationFrame(r1)}};
  function setT(e){var a=A0+(A1-A0)*e; hand.style.setProperty('--ha',a.toFixed(2)+'deg'); clock(5.2*e); if(window.__tlFill) window.__tlFill(e,a)}
  function tl(on){cancelAnimationFrame(r1); if(!on||reduce){setT(on?1:0);return}
    var t0=performance.now()+250; (function f(now){var p=cl((now-t0)/2100); var q=1-Math.pow(1-p,3); setT(q); if(p<1) r1=requestAnimationFrame(f)})(performance.now())}
  /* ---- 2 · message feed ---- */
  var list=cards[1].querySelector('.hlist'), content=[].map.call(list.children,function(e){return e.outerHTML}), r2=0, GAP=13.748, HOLD=1700, STEP=900, FOC=.045;
  function build(){list.innerHTML=[0,1,2,3,0,1].map(function(i){return content[i]}).join('')}
  function feed(on){cancelAnimationFrame(r2); build(); if(!on||reduce) return;
    var t0=performance.now()+1500, n=0, CYC=HOLD+STEP;
    (function f(now){
      var el=now-t0, k=Math.max(0,Math.floor(el/CYC));
      while(n<k){ list.removeChild(list.firstElementChild); var d=document.createElement('div'); d.innerHTML=content[(n+6)%4]; list.appendChild(d.firstChild); n++ }
      var loc=el-k*CYC, p=el<0?0:(loc<HOLD?0:io((loc-HOLD)/STEP)), ramp=cl((el+700)/700), it=list.children, step=it[0].offsetHeight+GAP;
      for(var i=0;i<it.length;i++){
        it[i].style.translate=p?('0 '+(-p*step).toFixed(2)+'px'):'';
        var s=i===1?1+FOC*ramp*(1-p):(i===2?1+FOC*ramp*p:1); it[i].style.scale=s===1?'':s.toFixed(4)}
      r2=requestAnimationFrame(f)})(performance.now())}
  /* ---- 3 · flickering squares ---- */
  var sq=[].slice.call(cards[2].querySelectorAll('.sg i')), base=sq.map(function(e){return e.style.opacity}), t3=0;
  var an3=[];
  function flick(on){an3.forEach(function(x){x.cancel()}); an3=[]; if(!on||reduce) return;
    sq.forEach(function(e,i){var o=parseFloat(base[i]); if(isNaN(o)) o=.5; var lo=.04, hi=Math.min(.9,Math.max(.35,o+.45));
      an3.push(e.animate([{opacity:lo},{opacity:hi}],{duration:2200,direction:'alternate',iterations:Infinity,easing:'ease-in-out',delay:-Math.random()*4400}))})}
  window.__bplay=function(i,on){ if(i===0) tl(on); else if(i===1) feed(on); else if(i===2) flick(on) };
  tl(false);
  cards.forEach(function(c,i){ if(c.classList.contains('is-in')) window.__bplay(i,true) });
})();

/* Footer pixel grid, timings measured from the screen recording: grey cells breathe .06-.275 alpha (4.4s, random phase);
   shapes ring > plus > asterisk > diamond change every 4.4s; each cell fades linearly 1.4s after a random 0-2.4s delay. */
(function(){
  var g=document.querySelector('.pixgrid'); if(!g) return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var cols=[].slice.call(g.querySelectorAll('.grid-col')), C=cols.length, R=cols[0].children.length, cx=(C-1)>>1, cy=(R-1)>>1;
  var cell=cols.map(function(c){return [].slice.call(c.children)});
  var P=4400;
  function mk(rows){var m={};rows.forEach(function(r,j){for(var i=0;i<r.length;i++)if(r[i]==='#')m[(cx+i-8)+','+(cy+j-7)]=1});return m}
  var S=[
    mk(['.................','......#####......','....##.....#.....','...##.......##...','...#.........#...','..#..........##..','..#...........#..','..#...........#..','..#...........#..','..#..........##..','...#.........#...','...##.......##...','....##.....#.....','......#####......','.................']),
    mk(['.................','........#........','........#........','........#........','........#........','........#........','........#........','..#############..','........#........','........#........','........#........','........#........','........#........','........#........','.................']),
    mk(['.................','........#........','........#........','....#...#...#....','.....#..#..#.....','......#.#.#......','.................','..#####...#####..','.................','......#.#.#......','.....#..#..#.....','....#...#...#....','........#........','........#........','.................']),
    mk(['.................','........#........','.......#.#.......','......#...#......','.....#.....#.....','....#.......#....','...#.........#...','..#...........#..','...#.........#...','....#.......#....','.....#.....#.....','......#...#......','.......#.#.......','........#........','.................'])
  ];
  cell.forEach(function(col){col.forEach(function(el){el.classList.remove('is-on','is-accent');el.style.setProperty('--d',(-Math.random()*P/1000).toFixed(2)+'s')})});
  var k=0, timer=0, alive=false;
  function apply(m,instant){cell.forEach(function(col,x){col.forEach(function(el,y){
    el.style.setProperty('--td',instant?'0s':(Math.random()*2.4).toFixed(2)+'s'); el.classList.toggle('is-on',!!m[x+','+y])})})}
  function step(){apply(S[k],false); k=(k+1)%S.length; timer=setTimeout(step,P)}
  g.classList.add('is-live'); apply(S[0],true); k=1; void g.offsetWidth;
  new IntersectionObserver(function(es){var v=es[0].isIntersecting;
    g.classList.toggle('is-paused',!v); if(v&&!alive){alive=true;timer=setTimeout(step,1200)}
    else if(!v&&alive){alive=false;clearTimeout(timer)}},{threshold:.2}).observe(g);
})();

/* Interaction layer: cursor, magnetic CTAs, link text-roll, pointer parallax, interactive footer grid. */
(function(){
  var fine=matchMedia('(hover:hover) and (pointer:fine)').matches, reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!fine||reduce) return;
  var $=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
  /* text roll */
  $('.foot__links a').forEach(function(a){ if(a.children.length) return; var t=a.textContent;
    a.innerHTML='<span class="roll"><span>'+t+'</span><span aria-hidden="true">'+t+'</span></span>'});
  /* magnetic */
  $('.appstore,.foot__logo').forEach(function(el){
    addEventListener('pointermove',function(e){var r=el.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2, dx=e.clientX-cx, dy=e.clientY-cy, d=Math.hypot(dx,dy), R=Math.max(r.width,r.height)/2+70;
      el.style.translate=d<R?(dx*.28).toFixed(1)+'px '+(dy*.28).toFixed(1)+'px':''},{passive:true})});
  /* hero parallax */
  var hero=document.querySelector('#hero-intro .hero__card'), mk=hero&&hero.querySelector('.hero__mockup'), dl=hero&&hero.querySelector('.dial');
  if(hero){hero.addEventListener('pointermove',function(e){var r=hero.getBoundingClientRect(), nx=(e.clientX-r.left)/r.width-.5, ny=(e.clientY-r.top)/r.height-.5;
      mk.style.translate=(-nx*26).toFixed(1)+'px '+(-ny*18).toFixed(1)+'px'; dl.style.translate=(nx*16).toFixed(1)+'px '+(ny*10).toFixed(1)+'px'},{passive:true});
    hero.addEventListener('pointerleave',function(){mk.style.translate='';dl.style.translate=''})}
  /* breakdown illustration parallax */
  $('.bcard__visual').forEach(function(v){var bv=v.querySelector('.bv'); if(!bv) return;
    v.addEventListener('pointermove',function(e){var r=v.getBoundingClientRect(); bv.style.translate=((.5-(e.clientX-r.left)/r.width)*28).toFixed(1)+'px '+((.5-(e.clientY-r.top)/r.height)*20).toFixed(1)+'px'},{passive:true});
    v.addEventListener('pointerleave',function(){bv.style.translate=''})});
  /* interactive footer grid: the cursor lights cells; they fade out slowly */
  var g=document.querySelector('.pixgrid'); if(g){
    var cols=$('.grid-col',g), C=cols.length, R=cols[0].children.length, pitch=14.624+8.686;
    g.addEventListener('pointermove',function(e){var r=g.firstElementChild.getBoundingClientRect(), gr=g.getBoundingClientRect(),
        c=Math.floor((e.clientX-gr.left)/pitch), rr=Math.floor((e.clientY-(gr.top+(gr.height-(R*pitch-8.686))/2))/pitch);
      for(var i=-1;i<=1;i++)for(var j=-1;j<=1;j++){ if((i||j)&&Math.random()>.35) continue; var col=cols[c+i]; var el=col&&col.children[rr+j]; if(!el) continue;
        el.style.setProperty('--td','0s'); el.classList.add('is-hot'); (function(el){setTimeout(function(){el.classList.remove('is-hot')},110)})(el)}},{passive:true})}
})();

/* Flow cards: dot-matrix voice meter + running timer, only while the section is on screen. */
(function(){
  var sec=document.getElementById('flows'); if(!sec) return;
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches; if(reduce) return;
  var holder=sec.querySelector('.fcard__wave'), tp=sec.querySelector('.tlog__t p:last-child'), sec_=175, raf=0, iv=0;
  var COLS=50, ROWS=11, P=5.8, W=COLS*P, H=ROWS*P, DPR=2, cv=null, cx=null, amp=new Float32Array(COLS), al=[], level=.5, tgt=.5, nextT=0, lastShift=0;
  if(holder){cv=document.createElement('canvas'); cv.width=W*DPR; cv.height=H*DPR; cv.style.cssText='display:block;width:'+W+'px;height:'+H+'px'; holder.appendChild(cv); cx=cv.getContext('2d'); cx.scale(DPR,DPR);
    for(var i=0;i<COLS*ROWS;i++) al.push(.25)}
  function fmt(n){var m=Math.floor(n/60),s=n%60;return (m<10?'0':'')+m+':'+(s<10?'0':'')+s}
  function draw(now){
    if(now>nextT){ tgt=Math.random()<.18?.04:.25+Math.random()*.75; nextT=now+180+Math.random()*420 }
    level+=(tgt-level)*.22;
    if(now-lastShift>62){ lastShift=now; for(var c=0;c<COLS-1;c++) amp[c]=amp[c+1]; amp[COLS-1]=Math.min(1,level*(.55+.45*Math.random())) }
    cx.clearRect(0,0,W,H); var mid=(ROWS-1)/2;
    for(var c=0;c<COLS;c++){ var reach=amp[c]*mid+.15;
      for(var r=0;r<ROWS;r++){ var d=Math.abs(r-mid), k=r*COLS+c, lit=d<=reach, edge=lit&&d>reach-1;
        var t=lit?(edge?1:.82):.26+Math.random()*.0; al[k]+=(t-al[k])*(lit?.5:.16);
        cx.fillStyle='rgba(255,255,255,'+al[k].toFixed(3)+')'; cx.beginPath(); cx.arc(c*P+P/2,r*P+P/2,1.5,0,6.2832); cx.fill() } }
    raf=requestAnimationFrame(draw)}
  function tick(){sec_++; if(!tp) return; tp.textContent=fmt(sec_); tp.animate([{opacity:.25,translate:'0 7px'},{opacity:1,translate:'0 0'}],{duration:420,easing:'cubic-bezier(.2,.8,.2,1)'})}
  new IntersectionObserver(function(es){var v=es[0].isIntersecting; cancelAnimationFrame(raf); clearInterval(iv); if(v){if(cx)raf=requestAnimationFrame(draw); iv=setInterval(tick,1000)}},{threshold:.1}).observe(sec);
})();

/* Manual entry card: the phone types real text with key presses, taps the check, then starts the next entry. */
(function(){
  var card=document.querySelector('.fcard--manual'), scr=card&&card.querySelector('.fp-screen'); if(!scr) return;
  var K=.4995, reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var phrases=['Created marketing document','Sync with stakeholders','Played video games','Walked the dog'];
  var wrap=document.createElement('div'); wrap.className='fp-type'; wrap.innerHTML='<span class="t"></span><i class="c"></i>'; scr.appendChild(wrap);
  var tx=wrap.firstChild, key=document.createElement('i'); key.className='fp-key'; scr.appendChild(key);
  var ok=document.createElement('i'); ok.className='fp-ok'; scr.appendChild(ok);
  if(reduce){tx.textContent=phrases[0];return}
  var rows=[['qwertyuiop',955,41,64.3],['asdfghjkl',1053,75,63.5],['zxcvbnm',1153,143,62]];
  function pos(ch){ if(ch===' ') return [331,1253,270,76]; for(var r=0;r<3;r++){var i=rows[r][0].indexOf(ch.toLowerCase()); if(i>=0) return [rows[r][2]+i*rows[r][3],rows[r][1],56,76]} return null}
  function press(ch){var p=pos(ch); if(!p) return; key.style.cssText='left:'+((p[0]-p[2]/2)*K)+'px;top:'+((p[1]-p[3]/2)*K)+'px;width:'+(p[2]*K)+'px;height:'+(p[3]*K)+'px;';
    key.animate([{opacity:1},{opacity:0}],{duration:200,easing:'ease-out',fill:'forwards'})}
  var alive=false, timer=0, idx=0;
  function wait(ms){return new Promise(function(r){timer=setTimeout(r,ms)})}
  async function run(){
    while(alive){
      var s=phrases[idx%phrases.length]; idx++; tx.textContent='';
      await wait(500);
      for(var i=0;i<s.length&&alive;i++){tx.textContent=s.slice(0,i+1); press(s[i]); await wait(s[i]===' '?110:62+Math.random()*60)}
      await wait(1100); if(!alive) break;
      ok.animate([{opacity:.9,scale:1},{opacity:0,scale:1.45}],{duration:650,easing:'cubic-bezier(.2,.8,.2,1)'});
      wrap.animate([{opacity:1,translate:'0 0'},{opacity:0,translate:'0 -10px'}],{duration:420,easing:'cubic-bezier(.4,0,.6,1)',fill:'forwards'});
      await wait(900); wrap.getAnimations().forEach(function(a){a.cancel()})
    }
  }
  new IntersectionObserver(function(es){var v=es[0].isIntersecting; if(v&&!alive){alive=true;run()} else if(!v&&alive){alive=false;clearTimeout(timer)}},{threshold:.15}).observe(card);
})();

/* Floating header: appears after the hero; its mini dial is the page's clock (hand + arc follow scroll), CTA is magnetic. */
(function(){
  var h=document.createElement('header'); h.className='nav'; h.setAttribute('aria-label','Site');
  h.innerHTML='<a class="nav__logo" href="#hero-intro" aria-label="Logs, back to top">'+
    '<span class="mark mark--nav" aria-hidden="true"><img class="mark__g0" src="assets/f_logo_g0.svg" alt=""><img class="mark__g1" src="assets/f_logo_g1.svg" alt=""><i class="mark__sweep"></i><img class="mark__mask" src="assets/f_logo_mask.svg" alt=""></span>'+
    '<img src="assets/f_logo_word.svg" alt="logs" class="nav__word"></a>'+
    '<span class="nav__time" aria-hidden="true">06:00</span><a class="nav__cta" href="#hero-intro"><span class="roll"><span>Get the app</span><span aria-hidden="true">Get the app</span></span></a>';
  document.body.appendChild(h);
  var mark=h.querySelector('.mark--nav'), tm=h.querySelector('.nav__time'), hero=document.getElementById('hero-intro'), foot=document.getElementById('footer'), root=document.documentElement;
  var SM=window.__SM, last=-1;
  function upd(){var y=SM&&SM.y!=null?SM.y:scrollY, max=document.documentElement.scrollHeight-innerHeight, p=max>0?Math.min(1,Math.max(0,y/max)):0;
    var show=y>hero.offsetHeight*.7 && foot.getBoundingClientRect().top>innerHeight*.35; h.classList.toggle('is-on',show);
    if(Math.abs(p-last)<.0005) return; last=p;
    var A=p*360; mark.style.setProperty('--a',A.toFixed(1)+'deg'); mark.style.setProperty('--b',(A-110).toFixed(1)+'deg');
    root.style.setProperty('--page','rgb('+(242+8*p).toFixed(0)+','+(242-4*p).toFixed(0)+','+(242-14*p).toFixed(0)+')');
    var mins=Math.round((6*60+p*(18*60-1))/5)*5, hh=Math.floor(mins/60)%24, mm=mins%60; tm.textContent=(hh<10?'0':'')+hh+':'+(mm<10?'0':'')+mm}
  if(SM&&SM.sub) SM.sub(upd); addEventListener('scroll',upd,{passive:true}); upd();
  var cta=h.querySelector('.nav__cta');
  if(matchMedia('(hover:hover) and (pointer:fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    cta.addEventListener('pointermove',function(e){var r=cta.getBoundingClientRect(); cta.style.translate=((e.clientX-r.left-r.width/2)*.3).toFixed(1)+'px '+((e.clientY-r.top-r.height/2)*.4).toFixed(1)+'px'});
    cta.addEventListener('pointerleave',function(){cta.style.translate=''})}
})();
(function(){var v=document.querySelector('.bcard__visual--icons'); if(!v) return;
  v.addEventListener('pointermove',function(e){var r=v.getBoundingClientRect(); v.style.setProperty('--mx',(e.clientX-r.left)+'px'); v.style.setProperty('--my',(e.clientY-r.top)+'px')},{passive:true})})();

/* Flow cards tilt with the pointer, so the three options feel like physical cards. */
(function(){
  if(!matchMedia('(hover:hover) and (pointer:fine)').matches||matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  [].slice.call(document.querySelectorAll('.fcard')).forEach(function(c){
    var kids=[].slice.call(c.children), box=document.createElement('div'); box.className='fcard__in3d';
    kids.forEach(function(k){box.appendChild(k)}); c.appendChild(box);
    c.addEventListener('pointermove',function(e){var r=c.getBoundingClientRect();
      box.style.transform='perspective(900px) rotateY('+(((e.clientX-r.left)/r.width-.5)*7).toFixed(2)+'deg) rotateX('+((.5-(e.clientY-r.top)/r.height)*5).toFixed(2)+'deg)'},{passive:true});
    c.addEventListener('pointerleave',function(){box.style.transform=''})})
})();

/* Card copy: titles rise word by word from a mask, eyebrows wipe in, every time a card settles into view. */
(function(){
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var sp=window.__sp, root=document.documentElement;
  function split(el){ if(el.dataset.split) return; el.dataset.split=1;
    var html=el.innerHTML.split(/(<br\s*\/?>)/i).map(function(part){ if(/^<br/i.test(part)) return part;
      return part.split(/(\s+)/).map(function(w){return /^\s+$/.test(w)||!w?w:'<span class="w"><span class="w__i">'+w+'</span></span>'}).join('')}).join('');
    el.innerHTML=html }
  var cards=[].slice.call(document.querySelectorAll('.bcard,.fcard'));
  cards.forEach(function(c){ c.querySelectorAll('.bcard__title,.fcard__title').forEach(split); c.classList.add('tx') });
  root.classList.add('tx-on');
  function play(c,on){ if(reduce) {c.classList.add('tx-in');return}
    var ws=[].slice.call(c.querySelectorAll('.w__i')), eb=c.querySelector('.bcard__eyebrow,.fcard__eyebrow');
    ws.forEach(function(w){w.getAnimations().forEach(function(a){a.cancel()})}); if(eb) eb.getAnimations().forEach(function(a){a.cancel()});
    c.classList.toggle('tx-in',on); if(!on) return;
    if(eb) eb.animate([{clipPath:'inset(0 100% 0 0)',translate:'-12px 0'},{clipPath:'inset(0 0% 0 0)',translate:'0 0'}],{duration:700,easing:'cubic-bezier(.2,.8,.2,1)',delay:60,fill:'backwards'});
    ws.forEach(function(w,i){ w.animate([{translate:'0 108%',rotate:'4deg'},{translate:'0 0',rotate:'0deg'}],{duration:950,easing:'cubic-bezier(.16,1,.3,1)',delay:180+i*38,fill:'backwards'}) })}
  // breakdown cards: tied to the stack state
  var prev=window.__bplay, bc=[].slice.call(document.querySelectorAll('.bcard'));
  window.__bplay=function(i,on){ if(prev) prev(i,on); if(bc[i]) play(bc[i],on) };
  bc.forEach(function(c){ if(c.classList.contains('is-in')) play(c,true) });
  // flow cards: copy reveals when the card becomes the front card (the one before it has started flying away)
  var fc=[].slice.call(document.querySelectorAll('.fcard'));
  function base(c){var r=c.getBoundingClientRect();return r.left+r.width/2}
  var home=fc.map(base);
  function chk(){fc.forEach(function(c,i){
    var vis=c.style.visibility!=='hidden'&&parseFloat(c.style.opacity||1)>.5, front=vis;
    if(vis&&i>0){var p=fc[i-1]; front=p.style.visibility==='hidden'||Math.abs(base(p)-home[i-1])>innerWidth*.12}
    if(front&&!c.classList.contains('tx-in')) play(c,true); else if(!vis&&c.classList.contains('tx-in')) play(c,false)})}
  if(window.__SM) window.__SM.sub(chk); addEventListener('scroll',chk,{passive:true}); chk();
})();

/* Card pixel icons: the full 3x3 grid lights up, then the cells that don't belong to this card's glyph fade away,
   and an orange "tick" walks clockwise through the glyph like the hand on the dial. */
(function(){
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cards=[].slice.call(document.querySelectorAll('.bcard')), ORDER=[0,1,2,5,8,7,6,3,4];
  var st=cards.map(function(c){var cells=[].slice.call(c.querySelectorAll('.bcard__icon i'));
    var mask=cells.map(function(e){var on=e.style.opacity!=='0'; e.style.opacity=''; return on});
    cells.forEach(function(e,i){e.classList.toggle('px-off',!mask[i])});
    return {cells:cells,mask:mask,t:0,iv:0}});
  function stop(s){clearTimeout(s.t);clearInterval(s.iv);s.cells.forEach(function(e){e.getAnimations().forEach(function(a){a.cancel()});e.classList.remove('px-tick')})}
  function play(i,on){var s=st[i]; if(!s) return; stop(s);
    if(!on||reduce){s.cells.forEach(function(e,k){e.classList.toggle('px-off',!s.mask[k])});return}
    s.cells.forEach(function(e){e.classList.remove('px-off')});
    var rnd=s.cells.map(function(_,k){return k}).sort(function(){return Math.random()-.5});
    rnd.forEach(function(k,n){s.cells[k].animate([{scale:0,rotate:'90deg'},{scale:1,rotate:'0deg'}],{duration:520,delay:120+n*45,easing:'cubic-bezier(.3,1.6,.5,1)',fill:'backwards'})});
    s.t=setTimeout(function(){
      s.cells.forEach(function(e,k){ if(!s.mask[k]){ e.animate([{scale:1,opacity:1},{scale:0,opacity:0}],{duration:420,delay:k*30,easing:'cubic-bezier(.5,0,.75,0)',fill:'forwards'}) }});
      var path=ORDER.filter(function(k){return s.mask[k]}), n=0;
      s.t=setTimeout(function(){ s.iv=setInterval(function(){
        s.cells.forEach(function(e){e.classList.remove('px-tick')}); s.cells[path[n%path.length]].classList.add('px-tick'); n++ },520) },700);
    },120+9*45+450);
  }
  var prev=window.__bplay; window.__bplay=function(i,on){ if(prev) prev(i,on); play(i,on) };
  cards.forEach(function(c,i){ if(c.classList.contains('is-in')) play(i,true) });
  // hover: the glyph pixels hop in a quick wave
  cards.forEach(function(c,i){var ic=c.querySelector('.bcard__icon'); if(!ic||reduce) return;
    ic.addEventListener('pointerenter',function(){st[i].cells.forEach(function(e,k){ if(st[i].mask[k]) e.animate([{translate:'0 0'},{translate:'0 -5px'},{translate:'0 0'}],{duration:380,delay:(k%3+Math.floor(k/3))*55,easing:'cubic-bezier(.3,0,.3,1)'}) })})});
})();

/* Card 1 is literally "an interactive timeline": once it has played, the visitor can grab the hand and scrub
   their own day. Hours count with the hand and the activity under it lights up. Keyboard works too. */
(function(){
  var card=document.querySelector('.bcard[data-card="1"]'); if(!card||!window.__tl) return;
  var vis=card.querySelector('.bcard__visual'), hand=card.querySelector('.bv__hand'),
      orbs=[].slice.call(card.querySelectorAll('.bv__orb')), T=window.__tl, EMAX=1.167, used=false;
  var e=0, tgt=0, raf=0, drag=false, hint=document.createElement('div');
  /* --- the dial fills up like the app: lit ticks + chips fanning out --- */
  var lit=card.querySelector('.bv__timeline--lit'), PX=580.57, PY=601.81, RAD=Math.PI/180;
  var all=orbs.slice(), base=[];
  orbs.forEach(function(o,i){o.setAttribute('data-orb',i);
    var cx=parseFloat(o.style.left)+44.8, cy=parseFloat(o.style.top)+44.8;
    base.push({el:o,a:Math.atan2(cx-PX,PY-cy)/RAD,r:Math.hypot(cx-PX,PY-cy),x:cx,y:cy,extra:false})});
  var mid=base.reduce(function(s,b){return s+b.a},0)/base.length;
  ['assets/ic_headphones.svg','assets/ic_house.svg'].forEach(function(src,k){
    var d=document.createElement('div'); d.className='bv__orb bv__orb--x'; d.setAttribute('aria-hidden','true');
    d.innerHTML='<img loading="lazy" decoding="async" src="'+src+'" alt="">';
    var ang=mid+(k?20.5:-21.5), r=556, cx=PX+r*Math.sin(ang*RAD), cy=PY-r*Math.cos(ang*RAD);
    d.style.left=(cx-44.8)+'px'; d.style.top=(cy-44.8)+'px';
    (orbs[0].parentNode).appendChild(d); base.push({el:d,a:ang,r:r,x:cx,y:cy,extra:true}); all.push(d)});
  function fill(t,a){
    var f=Math.min(1,t/1.0), span=Math.max(0,T.A0-a);
    if(lit){lit.style.setProperty('--from',a.toFixed(2)+'deg'); lit.style.setProperty('--span',span.toFixed(2)+'deg');
      lit.style.opacity=(t<.02?0:t<.96?.3+.3*Math.min(1,t/.96):.9).toFixed(3)}
    base.forEach(function(b){
      var na=mid+(b.a-mid)*(1+(b.extra?0:.08)*f), nx=PX+b.r*Math.sin(na*RAD), ny=PY-b.r*Math.cos(na*RAD);
      b.el.style.translate=(nx-b.x).toFixed(1)+'px '+(ny-b.y).toFixed(1)+'px';
      b.el.style.rotate=(na-b.a).toFixed(2)+'deg';
      if(b.extra){var v=Math.max(0,Math.min(1,(f-.45)/.3)); b.el.style.opacity=v.toFixed(2); b.el.style.scale=(.5+.5*v).toFixed(3)}});
  }
  function pivot(){var r=hand.getBoundingClientRect();return [r.left,r.top]}
  function angOf(x,y){var p=pivot();return Math.atan2(x-p[0],p[1]-y)*180/Math.PI}
  function toE(a){return Math.max(0,Math.min(EMAX,(T.A0-a)/(T.A0-T.A1)))}
  function orbAngles(){var p=pivot();return orbs.map(function(o){var r=o.getBoundingClientRect();
    return Math.atan2(r.left+r.width/2-p[0],p[1]-(r.top+r.height/2))*180/Math.PI})}
  var oa=null;
  function paint(){ T.set(e);
    if(!oa||!oa.length) oa=orbAngles();
    var a=T.A0+(T.A1-T.A0)*e, best=-1, bd=9;
    oa.forEach(function(v,i){var d=Math.abs(v-a); if(d<bd){bd=d;best=i}});
    orbs.forEach(function(o,i){o.classList.toggle('is-live',i===best&&bd<5.5)});
    fill(e,a);
    vis.setAttribute('aria-valuenow',(5.2*e).toFixed(2));
    vis.setAttribute('aria-valuetext',(5.2*e).toFixed(2)+' hours logged');
  }
  window.__tlFill=fill;
  function loop(){e+=(tgt-e)*.22; if(Math.abs(tgt-e)<.0004){e=tgt;raf=0} else raf=requestAnimationFrame(loop); paint()}
  function go(v){tgt=Math.max(0,Math.min(EMAX,v)); if(!raf) raf=requestAnimationFrame(loop)}
  function grab(ev){ if(ev.button) return; T.stop(); drag=true; used=true; hint.classList.remove('is-on'); card.classList.add('is-scrub'); oa=orbAngles();
    vis.setPointerCapture&&vis.setPointerCapture(ev.pointerId); move(ev) }
  function move(ev){ if(!drag) return; e=tgt=toE(angOf(ev.clientX,ev.clientY)); cancelAnimationFrame(raf); raf=0; paint() }
  function drop(){ drag=false; card.classList.remove('is-scrub') }
  vis.addEventListener('pointerdown',grab); vis.addEventListener('pointermove',move,{passive:true});
  addEventListener('pointerup',drop); addEventListener('pointercancel',drop);
  vis.setAttribute('tabindex','0'); vis.setAttribute('role','slider'); vis.setAttribute('aria-label','Scrub the day timeline');
  vis.setAttribute('aria-valuemin','0'); vis.setAttribute('aria-valuemax',(5.2*EMAX).toFixed(2));
  vis.addEventListener('keydown',function(ev){var s={ArrowRight:.04,ArrowUp:.04,ArrowLeft:-.04,ArrowDown:-.04,PageUp:.2,PageDown:-.2}[ev.key];
    if(s===undefined&&ev.key!=='Home'&&ev.key!=='End') return; ev.preventDefault(); T.stop(); used=true;
    go(ev.key==='Home'?0:ev.key==='End'?EMAX:tgt+s)});
  // a hint that never hides the real cursor
  hint.className='hint'; hint.textContent='Drag to scrub the day'; document.body.appendChild(hint);
  vis.addEventListener('pointerenter',function(){ if(!used) hint.classList.add('is-on') });
  vis.addEventListener('pointerleave',function(){ hint.classList.remove('is-on') });
  vis.addEventListener('pointermove',function(ev){ if(used){hint.classList.remove('is-on');return}
    hint.style.translate=(ev.clientX+18)+'px '+(ev.clientY+20)+'px' },{passive:true});
})();
