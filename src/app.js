// ---- Ganthian sky viewer: Sky, Orrery, Ley lines ----
(function(){
const $ = id => document.getElementById(id);
const app = $('app'), sky = $('sky'), ctx = sky.getContext('2d');
const mini = $('mini'), mctx = mini.getContext('2d');
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

const TRUE_DIAM = 2*MOON_R/PERI_KM/DEG;                 // closest moon, true apparent diameter (deg)
const SIZE_MODES = { true: 1, story: 2.5/TRUE_DIAM };
const EARTH_MOON_R = 0.259*DEG;                           // Earth's Moon apparent radius, for the scale ring
const DIROLE_LAT = 40;
const SPEED_RANGE = { night: [1/60, 240], year: [0.25, 30] };  // hours per second / nights per second
function speedVal(mode){ const [lo,hi] = SPEED_RANGE[mode], x = state.speedX[mode]/100; return Math.pow(10, Math.log10(lo) + (Math.log10(hi)-Math.log10(lo))*x); }
function speedLabel(mode){ const v = speedVal(mode);
  if(mode==='year') return `${v < 1 ? v.toFixed(2) : v < 10 ? v.toFixed(1) : Math.round(v)} night${v===1?'':'s'}/s`;
  if(v < 1) return `${Math.max(1,Math.round(v*60))} min/s`; if(v < 24) return `${v < 10 ? v.toFixed(1) : Math.round(v)} hr/s`; const d = v/24; return `${d < 10 ? d.toFixed(1) : Math.round(d)} days/s`; }

// the direction of the equator from a latitude: south in the northern hemisphere, north in the southern
function equatorYaw(lat){ return (lat < 0 ? 0 : 180)*DEG; }
const state = {
  // opens facing the equator (south, from Dirole), 45° across: about what an eye fixed on one thing sees clearly
  view:'sky', t: 102.0, lat: DIROLE_LAT, yaw: equatorYaw(DIROLE_LAT), pitch: 8*DEG, fov: 45*DEG,
  mode: 'year', playing: !reduceMotion, speedX: {night:43, year:58}, reverse: false,
  size: 'true', fixedHour: 0, dayAcc: 102,
  orb: {az: -60*DEG, el: 28*DEG, dist: 11},
  mapShift: 0, mapImg: null, mapFocus: null, mapMode: 'globe', followOn: false, follow: null, lastAim: null, /*@dm*/lure: 0, /*@end*/year: 9179, orbScale: 'enlarged',
  opt: {labels:true, sun:true, grid:false/*@dm*/, amber:false/*@end*/}
};

// ---------- deterministic star field ----------
function rng(seed){ return function(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(9179);
function randDir(){ const z = 2*R()-1, a = 2*Math.PI*R(), s = Math.sqrt(1-z*z); return [s*Math.cos(a), s*Math.sin(a), z]; }
const stars = [];
for(let i=0;i<2600;i++){
  const b = Math.pow(R(), 5.5), tint = R();
  const col = tint < .18 ? [190,210,255] : tint > .86 ? [255,214,170] : [245,244,236];
  stars.push({v:randDir(), b, col, tw: R()*6.28});
}
const band = [];
{ const gp = norm([Math.cos(192*DEG)*Math.cos(27*DEG), Math.sin(192*DEG)*Math.cos(27*DEG), Math.sin(27*DEG)]);
  const e1 = norm(cross(gp,[0,0,1])), e2 = cross(gp,e1);
  for(let i=0;i<3200;i++){
    const a = 2*Math.PI*R(); let g = 0; for(let k=0;k<4;k++) g += R(); g = (g-2)*7*DEG*(0.6+0.8*Math.abs(Math.sin(a*1.7)));
    const ca=Math.cos(a), sa=Math.sin(a), cg=Math.cos(g), sg=Math.sin(g);
    band.push({v:[ (e1[0]*ca+e2[0]*sa)*cg + gp[0]*sg, (e1[1]*ca+e2[1]*sa)*cg + gp[1]*sg, (e1[2]*ca+e2[2]*sa)*cg + gp[2]*sg ], b: 0.05 + 0.18*R()});
  }
}
function hill(azDeg){ const a = azDeg*DEG; return 1.3 + 0.9*Math.sin(3*a+.4) + 0.6*Math.sin(7*a+1.1) + 0.35*Math.sin(17*a+2) + 0.25*Math.sin(29*a); }

/*@dm*/// Amber Moon: on a ~1,000-year orbit around the sun (semi-major axis 100× Ganthia's), modelled as a real orbit.
// Solved so that (a) it was full, opposite the sun, when Sinclair saw it on the 39th of Greenmoon 9179, and
// (b) on its natural path (no Moon Lure pulls) it passes 178,000 km from the planet's centre, directly over Dirole
// at about 4 PM on the 40th of Violetmoon, just before sunset. Relative speed 31.4 km/s. Planet gravity is ignored
// (it bends the path by well under a degree).
const AMBER = { key:'amber', name:'Amber', month:'Fifthmoon', school:'1,000-year orbit', color:[255,150,50] };
const AMBER_TC = 399.6660, AMBER_RP0 = 1.78e5, AMBER_SPEED = 31.440, AMBER_V = AMBER_SPEED*86400; // km per day
const CONTACT_KM = R_PLANET + MOON_R;   // centres this close = the moons touch the ground
// Moon Lure: the net lure total bends the pass inward. 0 = natural 178,000 km miss; 30 = grazing impact; above 30 = a deeper hit.
function amberMiss(){ const L = state.lure; return L <= 30 ? CONTACT_KM + (AMBER_RP0 - CONTACT_KM)*(1 - L/30) : Math.max(0, CONTACT_KM*(1 - (L-30)/4)); }
function amberImpactT(){ const m = amberMiss(); return m <= CONTACT_KM + 1e-6 ? AMBER_TC - Math.sqrt(Math.max(0, CONTACT_KM*CONTACT_KM - m*m))/AMBER_V : null; }
const amberV = [0.1522702403501628, 0.9883388962818895, -1.8687148099137944e-17];   // direction of travel relative to Ganthia (ecliptic frame)
const amberB = [0.6597705617681254, -0.10196760368823982, 0.7445168994873455];   // Dirole's zenith at the moment of closest approach
function amberT(t){ return t + (state.year - 9179)*YEAR; }        // the pass belongs to 9179; later years see it receding
// sun-centred orbit, integrated once, stored as position relative to Ganthia every half day from 9179 day 0 to 9180 day 400
const AMB_TAB = (()=>{
  const DAYS = 86400, vp = 2*Math.PI*D_SUN/(YEAR*DAYS), GM = vp*vp*D_SUN;
  const P = t=>{ const S=sunVec(t); return [-S[0]*D_SUN, -S[1]*D_SUN, -S[2]*D_SUN]; };
  const Vp = t=>{ const th = sunLon(t)+Math.PI; return [-Math.sin(th)*vp, Math.cos(th)*vp, 0]; };
  const acc = r=>{ const d=Math.hypot(r[0],r[1],r[2]), k=-GM/(d*d*d); return [r[0]*k, r[1]*k, r[2]*k]; };
  const p0 = P(AMBER_TC), vP = Vp(AMBER_TC);
  const r0 = [p0[0]+amberB[0]*AMBER_RP0, p0[1]+amberB[1]*AMBER_RP0, p0[2]+amberB[2]*AMBER_RP0];
  const v0 = [vP[0]+amberV[0]*AMBER_SPEED, vP[1]+amberV[1]*AMBER_SPEED, vP[2]+amberV[2]*AMBER_SPEED];
  const STEP = 0.5, N = 1600, tab = new Array(N+1);
  function run(dir){
    let r = r0.slice(), v = v0.slice(), t = AMBER_TC; const sub = 10, h = dir*STEP/sub*DAYS;
    // first, step to the nearest grid time
    const tg = dir>0 ? Math.ceil(t/STEP)*STEP : Math.floor(t/STEP)*STEP;
    const rk = (dt)=>{ const a1=acc(r), r2=r.map((x,j)=>x+v[j]*dt/2), v2=v.map((x,j)=>x+a1[j]*dt/2), a2=acc(r2), r3=r.map((x,j)=>x+v2[j]*dt/2), v3=v.map((x,j)=>x+a2[j]*dt/2), a3=acc(r3), r4=r.map((x,j)=>x+v3[j]*dt), v4=v.map((x,j)=>x+a3[j]*dt), a4=acc(r4);
      r = r.map((x,j)=>x+dt/6*(v[j]+2*v2[j]+2*v3[j]+v4[j])); v = v.map((x,j)=>x+dt/6*(a1[j]+2*a2[j]+2*a3[j]+a4[j])); };
    rk((tg - t)*DAYS); t = tg;
    while(t >= 0 && t <= N*STEP){ const i = Math.round(t/STEP), p = P(t); tab[i] = [r[0]-p[0], r[1]-p[1], r[2]-p[2]]; for(let k=0;k<sub;k++) rk(h); t += dir*STEP; }
  }
  run(-1); run(1);
  return tab;
})();
function amberFar(tt){ const x = Math.max(0, Math.min(1600*0.5 - 1e-6, tt))/0.5, i = Math.floor(x), f = x - i, a = AMB_TAB[i], b = AMB_TAB[i+1]; return [a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f, a[2]+(b[2]-a[2])*f]; }
function amberNear(tt){ const m = amberMiss(), dt = (tt - AMBER_TC)*AMBER_V; return [amberB[0]*m + amberV[0]*dt, amberB[1]*m + amberV[1]*dt, amberB[2]*m + amberV[2]*dt]; }
// within 3 days of the pass a straight line is exact enough (and carries the Moon Lure offset); beyond 4 days use the orbit
function amberPosAt(tt){ const g = Math.abs(tt - AMBER_TC); if(g <= 3) return amberNear(tt); if(g >= 4) return amberFar(tt);
  const w = g - 3, n = amberNear(tt), f = amberFar(tt); return [n[0]+(f[0]-n[0])*w, n[1]+(f[1]-n[1])*w, n[2]+(f[2]-n[2])*w]; }
function amberPos(t){ const ti = amberImpactT(), tt = amberT(t); return amberPosAt(ti !== null && tt > ti ? ti : tt); }
function amberState(t){
  const r = amberPos(t), d = Math.hypot(r[0],r[1],r[2]), u=[r[0]/d,r[1]/d,r[2]/d], S = sunVec(t), cosPhi = -dot(S,u);
  const ti = amberImpactT();
  return {r, d, u, cosPhi, frac:(1+cosPhi)/2, shadow:shadowFactor(r,S), impact: ti !== null && amberT(t) >= ti, tImpact: ti};
}
/*@end*/// apparent magnitude, scaled from Earth's full Moon (-12.7) at the same apparent size
const ALBEDO = {black:.25, blue:.9, green:.9, gold:1.4, red:.8, silver:1.8, white:2.5, violet:.75/*@dm*/, amber:0.67/*@end*/};
// apparent magnitude, scaled from Earth's full Moon (-12.7) at the same apparent size and albedo
function moonMag(m, s){
/*@dm*/  // sunlight falls off with the body's distance from the sun as well as its distance from Ganthia
/*@end*/  let sunTerm = 0;
/*@dm*/  if(m.key==='amber'){ const S = sunVec(state.t), h = [s.r[0]-S[0]*D_SUN, s.r[1]-S[1]*D_SUN, s.r[2]-S[2]*D_SUN]; sunTerm = 5*Math.log10(Math.hypot(h[0],h[1],h[2])/D_SUN); }
/*@end*/  return -12.7 + 5*Math.log10(s.d/1.78e5) + sunTerm - 2.5*Math.log10(Math.max(0.005, s.frac*s.shadow*(ALBEDO[m.key]||1)));
}
/*@dm*/function amberMag(s){ return moonMag({key:'amber'}, s); }
/*@end*/// one brightness scale for stars and moons seen as points
function pointR(mag){ return Math.max(0.5, Math.min(2.8, 0.45 + (6.5 - mag)*0.13)); }

// ---------- shared helpers ----------
function smooth(a,b,x){ x=Math.max(0,Math.min(1,(x-a)/(b-a))); return x*x*(3-2*x); }
function lerp(a,b,t){ return a+(b-a)*t; }
function rgba(c,a){ return `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`; }
function shade(c,f){ return f>=0 ? [c[0]+(255-c[0])*f, c[1]+(255-c[1])*f, c[2]+(255-c[2])*f] : [c[0]*(1+f), c[1]*(1+f), c[2]*(1+f)]; }
function eclipseColor(c, sh){ const e=[c[0]*.22+60, c[1]*.1+16, c[2]*.08+10]; return [lerp(e[0],c[0],sh), lerp(e[1],c[1],sh), lerp(e[2],c[2],sh)]; }
function labelColor(m){ return m.key==='black' ? m.rim : m.color; }
function phasePath(g, Rr, cosPhi){
  g.beginPath();
  g.arc(0,0,Rr,-Math.PI/2,Math.PI/2,false);
  const rx = Math.max(0.001, Rr*Math.abs(cosPhi));
  if(cosPhi >= 0) g.ellipse(0,0,rx,Rr,0,Math.PI/2,3*Math.PI/2,false);
  else g.ellipse(0,0,rx,Rr,0,Math.PI/2,-Math.PI/2,true);
  g.closePath();
}
function drawMoonDisc(g, x, y, Rp, m, cosPhi, ang, shadow, dayness, night){
  const frac = (1+cosPhi)/2, isBlack = m.key==='black';
  const base = eclipseColor(m.color, shadow);
  if(Rp < 2.2){
    const a = (isBlack ? .45 : (.35 + .65*frac)*(.25+.75*shadow)) * (1-.55*dayness);
    g.fillStyle = rgba(isBlack ? m.rim : base, a);
    g.beginPath(); g.arc(x,y,Math.max(1.6,Rp),0,Math.PI*2); g.fill();
    return;
  }
  g.save(); g.translate(x,y); g.rotate(ang);
  g.fillStyle = rgba(shade(m.color,-.9), .93*night);
  g.beginPath(); g.arc(0,0,Rp,0,Math.PI*2); g.fill();
  if(frac > .003){
    phasePath(g, Rp, cosPhi);
    const gr = g.createRadialGradient(Rp*.3,0,0, 0,0,Rp);
    gr.addColorStop(0, rgba(shade(base, isBlack?.08:.18), 1));
    gr.addColorStop(.7, rgba(base, 1));
    gr.addColorStop(1, rgba(shade(base,-.28), 1));
    g.globalAlpha = 1 - .5*dayness;
    g.fillStyle = gr; g.fill();
    if(isBlack){ g.strokeStyle = rgba(m.rim, .55*frac*shadow); g.lineWidth = Math.max(1, Rp*.07); g.beginPath(); g.arc(0,0,Rp*.97,-Math.PI/2,Math.PI/2); g.stroke(); }
    g.globalAlpha = 1;
  }
  g.restore();
}
function drawHalo(g, x, y, Rp, m, frac, shadow, d, night){
  if(m.key==='black' || night < .05) return;
  const strength = .22*frac*shadow*night*Math.min(1, 6e5/d);
  if(strength < .01) return;
  const hr = Math.max(Rp*4.5, 9 + 14*strength*4);
  const gr = g.createRadialGradient(x,y,Rp*.6, x,y,hr);
  gr.addColorStop(0, rgba(m.color, strength)); gr.addColorStop(1, rgba(m.color, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(x,y,hr,0,Math.PI*2); g.fill();
}

// ---------- scene (shared by all views) ----------
let lastScene = null;
function computeScene(){
  const t = state.t, F = frame(t, state.lat);
  const S = sunVec(t), sunL = eqToLocal(eclToEq(S), F), sunAA = altAz(sunL);
  const bodies = [];
  MOONS.forEach((m,k)=>{
    if(!m.present) return;
    const s = moonState(m, t), L = eqToLocal(eclToEq(s.u), F);
    bodies.push({m, k, s, L, aa: altAz(L)});
  });
/*@dm*/  { const s = amberState(t), L = eqToLocal(eclToEq(s.u), F); bodies.push({m:AMBER, k:4, s, L, aa:altAz(L), amber:true, hidden:!state.opt.amber || s.impact}); }
/*@end*/  let closest = null;
  bodies.forEach(b=>{ if(/*@dm*/!b.amber && /*@end*/(!closest || b.s.d < closest.s.d)) closest = b; });
/*@dm*/  const ab = bodies.find(b=>b.amber);
/*@end*/  return {t, F, S, sunL, sunAA, bodies, closest/*@dm*/, amberImpact: state.opt.amber && ab.s.impact ? ab.s : null/*@end*/};
}

// =================== SKY VIEW ===================
let W=0, H=0, DPR=1, K=1, cam = {};
function setCamera(){
  const cy=Math.cos(state.yaw), sy=Math.sin(state.yaw), cp=Math.cos(state.pitch), sp=Math.sin(state.pitch);
  const fwd=[sy*cp, cy*cp, sp], right=[cy, -sy, 0], up=cross(right,fwd);
  K = (W/2)/Math.tan(state.fov/4);
  cam = {fwd, right, up, cx:W/2, cy:H/2};
}
function proj(L){
  const dx = dot(L,cam.right), dy = dot(L,cam.up), dz = dot(L,cam.fwd);
  if(dz < -0.55) return null;
  const s = K/(1+dz);
  return {x: cam.cx + dx*s, y: cam.cy - dy*s, s, dz};
}
function unproj(px,py){
  const X=(px-cam.cx)/K, Y=-(py-cam.cy)/K, r2=X*X+Y*Y, q=1/(1+r2);
  const a=2*X*q, b=2*Y*q, c=(1-r2)*q;
  return [cam.right[0]*a+cam.up[0]*b+cam.fwd[0]*c, cam.right[1]*a+cam.up[1]*b+cam.fwd[1]*c, cam.right[2]*a+cam.up[2]*b+cam.fwd[2]*c];
}
const buf = document.createElement('canvas'), bctx = buf.getContext('2d');
let img = null;
function renderSkyBuffer(sunL, sunAlt){
  const bw = Math.max(64, Math.ceil(W/5)), bh = Math.max(40, Math.ceil(H/5));
  if(buf.width!==bw || buf.height!==bh){ buf.width=bw; buf.height=bh; img = bctx.createImageData(bw,bh); }
  const d = smooth(-14, 8, sunAlt);
  const tw = Math.exp(-Math.pow((sunAlt+4)/6.5,2));
  const zR=lerp(4,46,d), zG=lerp(6,98,d), zB=lerp(15,186,d);
  const hR=lerp(11,158,d), hG=lerp(15,192,d), hB=lerp(31,228,d);
  const gR=lerp(7,40,d), gG=lerp(8,46,d), gB=lerp(11,34,d);
  const data = img.data, sx = W/bw, sy = H/bh;
  let p=0;
  for(let j=0;j<bh;j++){
    for(let i=0;i<bw;i++){
      const L = unproj((i+.5)*sx, (j+.5)*sy);
      const alt = L[2];
      let r,g,b;
      if(alt < 0){ const f = Math.min(1, -alt*3); r=gR*(1-.4*f); g=gG*(1-.4*f); b=gB*(1-.4*f); }
      else {
        const h = Math.pow(alt, .55);
        r = lerp(hR,zR,h); g = lerp(hG,zG,h); b = lerp(hB,zB,h);
        const cs = L[0]*sunL[0]+L[1]*sunL[1]+L[2]*sunL[2];
        if(tw > .01){ const w = tw*Math.pow(Math.max(cs,0),2.5)*Math.pow(1-alt,4)*.9; r += 235*w; g += 120*w; b += 60*w; const w2 = tw*Math.pow(1-alt,6)*.25; r+=70*w2; g+=40*w2; b+=50*w2; }
        if(d > .05){ const s = d*Math.pow(Math.max(cs,0),60)*.55; r+=255*s; g+=250*s; b+=235*s; }
      }
      data[p++]=r; data[p++]=g; data[p++]=b; data[p++]=255;
    }
  }
  bctx.putImageData(img,0,0);
  return d;
}
function drawSky(sc){
  setCamera();
  const sunAlt = state.opt.sun ? sc.sunAA.alt : -90;
  const dayness = renderSkyBuffer(sc.sunL, sunAlt);
  const night = 1 - dayness;
  const starVis = smooth(-5, -15, sunAlt);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(buf, 0, 0, W, H);

  if(state.opt.grid){
    ctx.strokeStyle = 'rgba(214,178,106,0.18)'; ctx.lineWidth = 1;
    const line = (pts)=>{ ctx.beginPath(); let pen=false; for(const L of pts){ const p=proj(L); if(!p||p.dz<-.3){pen=false;continue;} if(!pen){ctx.moveTo(p.x,p.y);pen=true;} else ctx.lineTo(p.x,p.y);} ctx.stroke(); };
    for(const alt of [30,60]){ const pts=[]; for(let a=0;a<=360;a+=3){ const ca=Math.cos(alt*DEG); pts.push([Math.sin(a*DEG)*ca, Math.cos(a*DEG)*ca, Math.sin(alt*DEG)]);} line(pts); }
    for(let az=0;az<360;az+=30){ const pts=[]; for(let alt=0;alt<=88;alt+=4){ const ca=Math.cos(alt*DEG); pts.push([Math.sin(az*DEG)*ca, Math.cos(az*DEG)*ca, Math.sin(alt*DEG)]);} line(pts); }
  }
  if(starVis > 0.01){
    const now = performance.now()/1000;
    for(const st of band){
      const L = eqToLocal(st.v, sc.F); if(L[2] < 0.01) continue;
      const p = proj(L); if(!p || p.x<0||p.y<0||p.x>W||p.y>H) continue;
      ctx.fillStyle = `rgba(200,205,230,${st.b*starVis*Math.min(1,L[2]*4)})`;
      ctx.fillRect(p.x, p.y, 1, 1);
    }
    for(const st of stars){
      const L = eqToLocal(st.v, sc.F); if(L[2] < 0.005) continue;
      const p = proj(L); if(!p || p.x<-2||p.y<-2||p.x>W+2||p.y>H+2) continue;
      const ext = Math.min(1, L[2]*5);
      const tw = reduceMotion ? 1 : 0.85 + 0.15*Math.sin(now*2.2 + st.tw);
      const smag = 6.5 - 8*st.b, a = Math.max(0.12, Math.min(1, (6.8 - smag)/4)) * starVis * ext * tw, r = pointR(smag);
      if(r > 0.9){ ctx.fillStyle = rgba(st.col, a); ctx.beginPath(); ctx.arc(p.x,p.y, r, 0, Math.PI*2); ctx.fill(); }
      else { ctx.fillStyle = rgba(st.col, a); ctx.fillRect(p.x-.5, p.y-.5, 1, 1); }
    }
  }
  if(state.opt.sun && sunAlt > -2){
    const p = proj(sc.sunL);
    if(p){ const r = Math.max(7, 0.267*DEG*p.s);
      const gr = ctx.createRadialGradient(p.x,p.y,r*.5,p.x,p.y,r*9);
      gr.addColorStop(0,'rgba(255,248,225,0.85)'); gr.addColorStop(1,'rgba(255,240,200,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x,p.y,r*9,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fffbea'; ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.fill(); }
  }
  const mag = SIZE_MODES[state.size];
  const drawn = [];
  const sorted = sc.bodies.filter(b=>!b.hidden).sort((a,b)=>b.s.d - a.s.d);
  for(const b of sorted){
    if(b.aa.alt < -1) continue;
    const p = proj(b.L); if(!p) continue;
    const Rp = (MOON_R/b.s.d)*mag*p.s;
    if(p.x < -60 || p.y < -60 || p.x > W+60 || p.y > H+60) continue;
    const Sl = sc.sunL, dd = dot(Sl, b.L);
    let perp = [Sl[0]-dd*b.L[0], Sl[1]-dd*b.L[1], Sl[2]-dd*b.L[2]];
    const pl = Math.hypot(perp[0],perp[1],perp[2]);
    let ang = 0;
    if(pl > 1e-6){ perp = [perp[0]/pl, perp[1]/pl, perp[2]/pl];
      const L2 = norm([b.L[0]+.01*perp[0], b.L[1]+.01*perp[1], b.L[2]+.01*perp[2]]); const p2 = proj(L2);
      if(p2) ang = Math.atan2(p2.y-p.y, p2.x-p.x); }
    if(Rp < 2.2){
      // too small to show a disc: a brilliant point whose size and glare follow its true brightness
      const mg = moonMag(b.m, b.s), lim = lerp(6.5, -4.5, dayness), al = Math.max(0, Math.min(1, (lim - mg)/3));
      if(al > 0.02){
        const rr = pointR(mg), col = b.m.key==='black' ? b.m.rim : shade(eclipseColor(b.m.color, b.s.shadow), .25);
        if(mg < 0 && night > .2){ const gr2 = rr*(3 + Math.min(8, -mg)*0.9); const gl = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,gr2); gl.addColorStop(0, rgba(col,.4*al*night)); gl.addColorStop(1, rgba(col,0)); ctx.fillStyle=gl; ctx.beginPath(); ctx.arc(p.x,p.y,gr2,0,Math.PI*2); ctx.fill(); }
        ctx.fillStyle = rgba(col, al); ctx.beginPath(); ctx.arc(p.x,p.y,rr,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${.55*al})`; ctx.beginPath(); ctx.arc(p.x,p.y,rr*.45,0,Math.PI*2); ctx.fill();
        drawn.push({b, p, Rp: rr});
      }
      continue;
    }
    drawHalo(ctx, p.x, p.y, Rp, b.m, b.s.frac, b.s.shadow, b.s.d, night);
    drawMoonDisc(ctx, p.x, p.y, Rp, b.m, b.s.cosPhi, ang, b.s.shadow, dayness, night);
    drawn.push({b, p, Rp});
  }
  const gc = [lerp(6,34,dayness), lerp(7,40,dayness), lerp(10,30,dayness)];
  ctx.fillStyle = rgba(gc,1); ctx.strokeStyle = rgba(gc,1); ctx.lineWidth = 1;
  for(let az=0; az<360; az+=2){
    const pts = [[az,hill(az)],[az+2,hill(az+2)],[az+2,-35],[az,-35]].map(([a,h])=>{ const ca=Math.cos(h*DEG); return proj([Math.sin(a*DEG)*ca, Math.cos(a*DEG)*ca, Math.sin(h*DEG)]); });
    if(pts.some(q=>!q)) continue;
    ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); for(let i=1;i<4;i++) ctx.lineTo(pts[i].x,pts[i].y); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.strokeStyle = `rgba(235,229,212,${0.05+0.1*night})`; ctx.beginPath(); let pen=false;
  for(let az=0; az<=360; az+=2){ const h=hill(az), ca=Math.cos(h*DEG); const q=proj([Math.sin(az*DEG)*ca, Math.cos(az*DEG)*ca, Math.sin(h*DEG)]); if(!q||q.dz<-.3){pen=false;continue;} if(!pen){ctx.moveTo(q.x,q.y);pen=true;} else ctx.lineTo(q.x,q.y); }
  ctx.stroke();
  ctx.font = '500 12px "IBM Plex Mono", monospace'; ctx.textAlign='center'; ctx.textBaseline='top';
  [['N',0],['NE',45],['E',90],['SE',135],['S',180],['SW',225],['W',270],['NW',315]].forEach(([n,a])=>{
    const q = proj([Math.sin(a*DEG)*.9994, Math.cos(a*DEG)*.9994, -0.035]); if(!q || q.dz < 0.05) return;
    ctx.fillStyle = n.length===1 ? 'rgba(214,178,106,0.95)' : 'rgba(162,156,176,0.75)'; ctx.fillText(n, q.x, q.y);
  });
  // Earth's Moon scale ring around the closest moon (true size, 0.52° across)
  for(const {b,p} of drawn){
    if(b !== sc.closest || b.aa.alt < hill(b.aa.az)) continue;
    const rr = Math.max(3, EARTH_MOON_R*p.s);
    ctx.save(); ctx.strokeStyle = 'rgba(214,178,106,0.75)'; ctx.lineWidth = 1; ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.arc(p.x,p.y,rr,0,Math.PI*2); ctx.stroke(); ctx.restore();
    if(rr > 14 && state.opt.labels){ ctx.font='500 10px "IBM Plex Mono", monospace'; ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillStyle='rgba(214,178,106,0.85)'; ctx.fillText("Earth's Moon", p.x, p.y+rr+3); }
    b.ringR = rr;
  }
  if(state.opt.labels){
    ctx.textAlign='left'; ctx.textBaseline='middle';
    for(const {b,p,Rp} of drawn){
      if(/*@dm*/b.amber || /*@end*/b.aa.alt < hill(b.aa.az)) continue;
      const isClosest = b === sc.closest;
      const off = Math.max(Rp, 2, isClosest ? (b.ringR||0) : 0) + 7;
      ctx.font = `${isClosest?'400 16px':'400 14px'} "IM Fell English SC", Georgia, serif`;
      ctx.fillStyle = 'rgba(5,7,13,0.6)'; ctx.fillText(b.m.name, p.x+off+1, p.y+1);
      ctx.fillStyle = rgba(labelColor(b.m), dayness>.5 ? .95 : .9); ctx.fillText(b.m.name, p.x+off, p.y);
    }
  }
/*@dm*/  drawAmberTag(sc, drawn, dayness);
/*@end*/}

/*@dm*/// Amber Moon tag: always labelled while it is switched on, even when too faint to see, in daylight,
// below the horizon (tag sits on the horizon) or outside the view (tag pins to the screen edge).
function drawAmberTag(sc, drawn, dayness){
  const b = sc.bodies.find(x=>x.amber); if(!b || b.hidden) return;
  const vis = drawn.find(d=>d.b===b);
  const below = b.aa.alt < hill(b.aa.az);
  let L = b.L, note = '';
  if(below){ const h = hill(b.aa.az)+1.5, ca = Math.cos(h*DEG); L = [Math.sin(b.aa.az*DEG)*ca, Math.cos(b.aa.az*DEG)*ca, Math.sin(h*DEG)]; note = 'below horizon'; }
  else {
    // judge visibility by brightness alone, not by whether it is on screen
    const mg = amberMag(b.s), lim = lerp(6.5, -4.5, dayness), seen = (lim - mg)/3 > 0.02;
    if(!seen) note = dayness > .5 ? 'in daylight' : 'too faint to see';
  }
  const col = AMBER.color;
  let p = proj(L), edge = false;
  const m = 26;
  if(!p || p.x < m || p.y < m || p.x > W-m || p.y > H-m){
    // pin to the screen edge in the moon's direction
    const dx = dot(L,cam.right), dy = -dot(L,cam.up), len = Math.hypot(dx,dy) || 1, ux = dx/len, uy = dy/len;
    const sx = (W/2 - m)/Math.max(1e-6, Math.abs(ux)), sy = (H/2 - m)/Math.max(1e-6, Math.abs(uy)), s = Math.min(sx, sy);
    p = {x: W/2 + ux*s, y: H/2 + uy*s}; edge = true;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(uy,ux)); ctx.fillStyle = rgba(col,.9);
    ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(-4,-6); ctx.lineTo(-4,6); ctx.closePath(); ctx.fill(); ctx.restore();
  } else if(!vis){
    ctx.save(); ctx.strokeStyle = rgba(col,.75); ctx.lineWidth = 1; ctx.setLineDash([2,3]); ctx.beginPath(); ctx.arc(p.x,p.y,6,0,Math.PI*2); ctx.stroke(); ctx.restore();
  }
  const off = vis ? Math.max(vis.Rp, 2) + 7 : 10;
  const text = `Amber${note ? ' · ' + note : ''}${b.s.d < 1e7 ? '' : ' · ' + fmtDist(b.s.d)}`;
  ctx.font = '400 14px "IM Fell English SC", Georgia, serif'; ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width;
  let tx = p.x + off, ty = p.y;
  let rightLim = W - 8;
  if(!roster.hidden && window.innerWidth > 760){ const rr = roster.getBoundingClientRect(), ar = app.getBoundingClientRect(); if(ty > rr.top - ar.top - 10 && ty < rr.bottom - ar.top + 10) rightLim = rr.left - ar.left - 8; }
  if(tx + tw > rightLim) tx = p.x - off - tw;
  if(edge){ ty = Math.max(16, Math.min(H-16, ty + (p.y > H/2 ? -14 : 14))); }
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(5,7,13,0.65)'; ctx.fillText(text, tx+1, ty+1);
  ctx.fillStyle = rgba(col, .95); ctx.fillText(text, tx, ty);
}
/*@end*/
// =================== ORRERY VIEW ===================
// World units: millions of km, ecliptic frame (x, y in the planet's orbital plane, z toward ecliptic north).
const U = 1e6;
let ocam = {};
function setOrreryCamera(){
  const {az, el, dist} = state.orb;
  const pos = [dist*Math.cos(el)*Math.cos(az), dist*Math.cos(el)*Math.sin(az), dist*Math.sin(el)];
  const fwd = norm([-pos[0],-pos[1],-pos[2]]), right = norm(cross(fwd,[0,0,1])), up = cross(right,fwd);
  const f = (Math.min(W,H)*0.5)/Math.tan(22*DEG);
  ocam = {pos, fwd, right, up, f, cx: W/2, cy: H*0.46};
}
function oproj(p){
  const v = [p[0]-ocam.pos[0], p[1]-ocam.pos[1], p[2]-ocam.pos[2]];
  const z = dot(v, ocam.fwd); if(z < 0.05) return null;
  const s = ocam.f/z;
  return {x: ocam.cx + dot(v,ocam.right)*s, y: ocam.cy - dot(v,ocam.up)*s, s, z};
}
const orbitPaths = MOONS.map(m=>{ const pts=[]; for(let i=0;i<=240;i++){ const r = orbitPos(m, m.tp, m.tp + YEAR*i/240); pts.push([r[0]/U, r[1]/U, r[2]/U]); } return pts; });
/*@dm*/function amberPath(){ const pts=[], ti = amberImpactT(); for(let t=397;t<=403;t+=0.02){ if(ti!==null && t>ti) break; const r=amberPosAt(t); pts.push([r[0]/U,r[1]/U,r[2]/U]); } return pts; }
/*@end*/function polyline3(pts, style, width, dash){
  ctx.strokeStyle = style; ctx.lineWidth = width; ctx.setLineDash(dash||[]);
  ctx.beginPath(); let pen=false;
  for(const p of pts){ const q = oproj(p); if(!q){pen=false;continue;} if(!pen){ctx.moveTo(q.x,q.y);pen=true;} else ctx.lineTo(q.x,q.y); }
  ctx.stroke(); ctx.setLineDash([]);
}
function drawOrrery(sc){
  setOrreryCamera();
  const bg = ctx.createRadialGradient(W/2,H*.45,0,W/2,H*.45,Math.max(W,H)*.75);
  bg.addColorStop(0,'#0b0d1a'); bg.addColorStop(1,'#04050a');
  ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);
  // faint background stars (direction only)
  for(let i=0;i<stars.length;i+=3){ const st=stars[i]; const v=st.v; const p=[ocam.pos[0]+v[0]*1e4, ocam.pos[1]+v[1]*1e4, ocam.pos[2]+v[2]*1e4]; const q=oproj(p); if(!q||q.x<0||q.y<0||q.x>W||q.y>H) continue; ctx.fillStyle=rgba(st.col,.15+.5*st.b); ctx.fillRect(q.x,q.y,1.2,1.2); }
  // ecliptic plane rings
  ctx.font = '500 10px "IBM Plex Mono", monospace'; ctx.textAlign='left'; ctx.textBaseline='middle';
  for(let rr=1; rr<=4; rr++){ const pts=[]; for(let a=0;a<=360;a+=4) pts.push([rr*Math.cos(a*DEG), rr*Math.sin(a*DEG), 0]); polyline3(pts, 'rgba(235,229,212,0.08)', 1); const q=oproj([rr,0,0]); if(q){ ctx.fillStyle='rgba(162,156,176,0.55)'; ctx.fillText(`${rr}M km`, q.x+3, q.y); } }
  for(let a=0;a<360;a+=30) polyline3([[0,0,0],[4.3*Math.cos(a*DEG),4.3*Math.sin(a*DEG),0]], 'rgba(235,229,212,0.05)', 1);
  const S = sc.S;
  // sunlight: sun drawn off-scale in its true direction
  const ACC = state.orbScale === 'accurate', sunDist = ACC ? D_SUN/U : 7.5;
  const sunP = [S[0]*sunDist, S[1]*sunDist, S[2]*sunDist];
  const sq = oproj(sunP);
  polyline3([[S[0]*sunDist*.94,S[1]*sunDist*.94,0],[0,0,0]], 'rgba(255,236,190,0.18)', 1, [6,6]);
  // planet's shadow (umbra) streaming away from the sun
  const L = UMBRA_LEN/U, A = [-S[0]*L, -S[1]*L, 0];
  const pq = oproj([0,0,0]), aq = oproj(A);
  const planetR = ACC ? R_PLANET/U : 0.11;
  const planetPx = r => Math.max(ACC ? 2 : 0, r);
  if(pq && aq){
    const dx=aq.x-pq.x, dy=aq.y-pq.y, len=Math.hypot(dx,dy)||1, nx=-dy/len, ny=dx/len, w=planetR*pq.s;
    const gr = ctx.createLinearGradient(pq.x,pq.y,aq.x,aq.y); gr.addColorStop(0,'rgba(0,0,0,0.65)'); gr.addColorStop(1,'rgba(0,0,0,0.05)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(pq.x+nx*w,pq.y+ny*w); ctx.lineTo(aq.x,aq.y); ctx.lineTo(pq.x-nx*w,pq.y-ny*w); ctx.closePath(); ctx.fill();
    if(state.opt.labels && len > 40){ ctx.fillStyle='rgba(162,156,176,0.7)'; ctx.textAlign='center'; ctx.fillText('shadow', aq.x, aq.y+12); }
  }
  // orbits
  MOONS.forEach((m,k)=>{
    if(!m.present) return;
    const isClosest = sc.closest && sc.closest.m===m;
    polyline3(orbitPaths[k], rgba(labelColor(m), isClosest ? .8 : .35), isClosest ? 1.6 : 1);
    const pp = oproj([m.P[0]*PERI_KM/U, m.P[1]*PERI_KM/U, 0]); if(pp){ ctx.fillStyle = rgba(labelColor(m), .7); ctx.fillRect(pp.x-1.5,pp.y-1.5,3,3); }
  });
/*@dm*/  if(state.opt.amber) polyline3(amberPath(), rgba(AMBER.color,.45), 1, [4,4]);
/*@end*/  // drawables sorted by depth: moons, planet, sun
  const items = [];
  for(const b of sc.bodies){ if(b.hidden) continue; const p=[b.s.r[0]/U,b.s.r[1]/U,b.s.r[2]/U]; const q=oproj(p); if(q) items.push({type:'moon', b, p, q}); }
  if(pq) items.push({type:'planet', q:pq});
  if(sq) items.push({type:'sun', q:sq});
  items.sort((a,b)=>b.q.z-a.q.z);
  for(const it of items){
    const q = it.q;
    if(it.type==='sun'){
      const r = ACC ? Math.max(2.5, R_SUN/U*q.s) : Math.max(10, 0.35*q.s);
      const gr = ctx.createRadialGradient(q.x,q.y,r*.4,q.x,q.y,r*4); gr.addColorStop(0,'rgba(255,240,200,0.6)'); gr.addColorStop(1,'rgba(255,240,200,0)');
      ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(q.x,q.y,r*4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff6d8'; ctx.beginPath(); ctx.arc(q.x,q.y,r,0,Math.PI*2); ctx.fill();
      if(state.opt.labels){ ctx.font='400 15px "IM Fell English SC", Georgia, serif'; ctx.textAlign='center'; ctx.fillStyle='rgba(255,240,205,0.9)'; ctx.fillText('Sun', q.x, q.y+r+12); ctx.font='500 10px "IBM Plex Mono", monospace'; ctx.fillStyle='rgba(162,156,176,0.8)'; ctx.fillText(ACC ? '150M km · to scale' : '150M km · not to scale', q.x, q.y+r+27); }
    } else if(it.type==='planet'){
      const r = planetPx(planetR*q.s);
      // lit hemisphere toward the sun
      const s2 = oproj([S[0]*0.01, S[1]*0.01, 0]); const ang = s2 ? Math.atan2(s2.y-q.y, s2.x-q.x) : 0;
      const toCam = norm([ocam.pos[0], ocam.pos[1], ocam.pos[2]]);
      ctx.fillStyle = '#0c1220'; ctx.beginPath(); ctx.arc(q.x,q.y,r,0,Math.PI*2); ctx.fill();
      ctx.save(); ctx.translate(q.x,q.y); ctx.rotate(ang); phasePath(ctx, r, dot(S,toCam));
      const gr = ctx.createRadialGradient(r*.3,0,0,0,0,r); gr.addColorStop(0,'#7fb0d8'); gr.addColorStop(.6,'#3f7d6a'); gr.addColorStop(1,'#26425a');
      ctx.fillStyle = gr; ctx.fill(); ctx.restore();
      // spin axis (23.4° tilt)
      const ax = [0, Math.sin(EPS), Math.cos(EPS)];
      const axl = planetR*2; polyline3([[-ax[0]*axl,-ax[1]*axl,-ax[2]*axl],[ax[0]*axl,ax[1]*axl,ax[2]*axl]], 'rgba(235,229,212,0.6)', 1);
      if(state.opt.labels){ ctx.font='400 15px "IM Fell English SC", Georgia, serif'; ctx.textAlign='left'; ctx.fillStyle='rgba(235,229,212,0.9)'; ctx.fillText('Ganthia', q.x+r+8, q.y-6); }
    } else {
      const b = it.b, rr = ACC ? Math.max(1.5, MOON_R/U*q.s) : Math.max(3, 0.045*q.s);
      const toCam = norm([ocam.pos[0]-it.p[0], ocam.pos[1]-it.p[1], ocam.pos[2]-it.p[2]]);
      const cosV = dot(S, toCam);
      const s2 = oproj([it.p[0]+S[0]*.05, it.p[1]+S[1]*.05, it.p[2]]); const ang = s2 ? Math.atan2(s2.y-q.y, s2.x-q.x) : 0;
      drawMoonDisc(ctx, q.x, q.y, rr, b.m, cosV, ang, b.s.shadow, 0, 1);
      if(b.m.key==='black'){ ctx.strokeStyle = rgba(b.m.rim,.6); ctx.lineWidth=1; ctx.beginPath(); ctx.arc(q.x,q.y,rr+1,0,Math.PI*2); ctx.stroke(); }
      if(state.opt.labels){ const isC = b===sc.closest; ctx.font=`400 ${isC?15:13}px "IM Fell English SC", Georgia, serif`; ctx.textAlign='left'; ctx.fillStyle=rgba(labelColor(b.m),.92); ctx.fillText(b.m.name, q.x+rr+6, q.y); }
    }
  }
  ctx.font='500 10px "IBM Plex Mono", monospace'; ctx.textAlign='center'; ctx.fillStyle='rgba(162,156,176,0.7)';
  ctx.fillText(ACC ? 'Everything to scale · bodies too small to see are drawn as dots · scroll in to zoom toward Ganthia' : 'Orbits to scale · planet and moons enlarged · sun shown closer than it is · drag to turn, scroll to zoom', W/2, ocam.cy + Math.min(W,H)*0.47 > H-160 ? H-170 : ocam.cy + Math.min(W,H)*0.47);
}

// =================== LEY-LINE MAP ===================
// Ley line: the track of points directly under a moon during its five closest days (21st–25th of its month).
// Longitude 0 is Dirole's meridian.
function subPoint(eqv, t){
  const th = lst(t), f0 = eqv[0]*Math.cos(th) + eqv[1]*Math.sin(th), f1 = -eqv[0]*Math.sin(th) + eqv[1]*Math.cos(th);
  return {lat: Math.asin(Math.max(-1,Math.min(1,eqv[2])))/DEG, lon: Math.atan2(f1, f0)/DEG};
}
// Width follows the moon's apparent size: 1 mile at the start and end of the window, widest at closest approach.
// The line fades out over the last half-day at each end, as it narrows toward 1 mile.
const leyLines = MOONS.map(m=>{
  const dEdge = moonState(m, m.tp-2.5).d, wFull = dEdge/moonState(m, m.tp-2.0).d;
  const pts=[]; for(let t=m.tp-2.5; t<=m.tp+2.5+1e-9; t+=0.008){ const s=moonState(m,t); const q=subPoint(eclToEq(s.u), t); q.wMi = dEdge/s.d; q.a = smooth(1, wFull, q.wMi); pts.push(q); }
  const per = subPoint(eclToEq(moonState(m,m.tp).u), m.tp);
  return {pts, per, wMax: dEdge/moonState(m,m.tp).d};
});
// stroke a polyline whose width and opacity vary point to point
function strokeSegs(sp, col, alphaMul, pxPerMile){
  ctx.lineCap = 'round';
  for(let i=1;i<sp.length;i++){
    const p0=sp[i-1], p1=sp[i]; if(!p0.ok || !p1.ok) continue;
    const al = (p0.a+p1.a)/2*alphaMul; if(al < .02) continue;
    ctx.strokeStyle = rgba(col, al); ctx.lineWidth = (p0.wMi+p1.wMi)/2*pxPerMile;
    ctx.beginPath(); ctx.moveTo(p0.x,p0.y); ctx.lineTo(p1.x,p1.y); ctx.stroke();
  }
  ctx.lineCap = 'butt';
}
function drawLey(k, m, sp, base, dim, backSp){
  const col = labelColor(m);
  if(backSp) strokeSegs(backSp, col, .16*dim, base*.6);
  if(m.key==='black'){ strokeSegs(sp, m.rim, .9*dim, base+2.5/1.3); strokeSegs(sp, [12,10,16], dim, base); }
  else strokeSegs(sp, col, .9*dim, base);
}
let mapRect = {x:0,y:0,w:0,h:0};
const nightBuf = document.createElement('canvas'); nightBuf.width=180; nightBuf.height=90; const nctx = nightBuf.getContext('2d'); const nimg = nctx.createImageData(180,90);
function m2s(lat, lon){ let L = ((lon + 180) % 360 + 360) % 360 - 180; return {x: mapRect.x + (L+180)/360*mapRect.w, y: mapRect.y + (90-lat)/180*mapRect.h}; }
function mapLayout(){
  const plaque = document.querySelector('.plaque').getBoundingClientRect(), appR = app.getBoundingClientRect(), dock = $('dock').getBoundingClientRect();
  const rosterR = roster.hidden ? null : roster.getBoundingClientRect();
  const narrow = window.innerWidth <= 760;
  const left = 16, right = (!narrow && rosterR) ? rosterR.left - appR.left - 14 : W - 16;
  const top = plaque.bottom - appR.top + 14, bottom = dock.top - appR.top - 34;
  let w = right-left, h = bottom-top;
  if(w/h > 2) w = h*2; else h = w/2;
  mapRect = {x: left + ((right-left)-w)/2, y: top + ((bottom-top)-h)/2, w, h};
}
function drawMap(sc){
  mapLayout();
  ctx.fillStyle = '#060810'; ctx.fillRect(0,0,W,H);
  const {x,y,w,h} = mapRect;
  if(w < 40) return;
  ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
  if(state.mapImg){
    const off = state.mapShift/360*w;
    for(const k of [-1,0,1]) ctx.drawImage(state.mapImg, x + off + k*w, y, w, h);
  } else {
    const g = ctx.createLinearGradient(0,y,0,y+h); g.addColorStop(0,'#14233a'); g.addColorStop(.5,'#1a2f4a'); g.addColorStop(1,'#14233a');
    ctx.fillStyle = g; ctx.fillRect(x,y,w,h);
  }
  // night side
  const sub = subPoint(eclToEq(sc.S), sc.t);
  const ss = [Math.cos(sub.lat*DEG)*Math.cos(sub.lon*DEG), Math.cos(sub.lat*DEG)*Math.sin(sub.lon*DEG), Math.sin(sub.lat*DEG)];
  let p=0; const D = nimg.data;
  for(let j=0;j<90;j++){ const la=(90-(j+.5)*2)*DEG, cl=Math.cos(la), sl=Math.sin(la);
    for(let i=0;i<180;i++){ const lo=(-180+(i+.5)*2)*DEG; const c = cl*Math.cos(lo)*ss[0]+cl*Math.sin(lo)*ss[1]+sl*ss[2];
      const a = smooth(0.1, -0.12, c)*0.55; D[p++]=2; D[p++]=3; D[p++]=10; D[p++]=a*255; } }
  nctx.putImageData(nimg,0,0); ctx.imageSmoothingEnabled = true; ctx.drawImage(nightBuf, x, y, w, h);
  // graticule
  ctx.lineWidth = 1;
  for(let lo=-180; lo<=180; lo+=30){ const a=m2s(0,lo); ctx.strokeStyle = lo===0 ? 'rgba(214,178,106,0.35)' : 'rgba(235,229,212,0.10)'; ctx.beginPath(); ctx.moveTo(a.x,y); ctx.lineTo(a.x,y+h); ctx.stroke(); }
  for(let la=-60; la<=60; la+=30){ const a=m2s(la,-180); ctx.strokeStyle = la===0 ? 'rgba(235,229,212,0.28)' : 'rgba(235,229,212,0.10)'; ctx.beginPath(); ctx.moveTo(x,a.y); ctx.lineTo(x+w,a.y); ctx.stroke(); }
  ctx.setLineDash([4,5]); ctx.strokeStyle='rgba(235,229,212,0.16)';
  for(const la of [23.4,-23.4,66.6,-66.6]){ const a=m2s(la,-180); ctx.beginPath(); ctx.moveTo(x,a.y); ctx.lineTo(x+w,a.y); ctx.stroke(); }
  ctx.setLineDash([]);
  // ley lines
  MOONS.forEach((m,k)=>{
    if(!m.present) return;
    const col = labelColor(m), focus = state.mapFocus, dim = focus && focus!==m.key ? .12 : 1, lw = Math.max(1.3, w/800) * (focus===m.key ? 1.6 : 1);
    let prev=null; const sp = leyLines[k].pts.map(q=>{ const s=m2s(q.lat,q.lon); const ok = !prev || Math.abs(s.x-prev.x) <= w/2; prev=s; return {x:s.x, y:s.y, ok, wMi:q.wMi, a:q.a}; });
    drawLey(k, m, sp, lw, dim, null);
    const pr = m2s(leyLines[k].per.lat, leyLines[k].per.lon);
    ctx.fillStyle = rgba(col,dim); ctx.beginPath(); ctx.arc(pr.x,pr.y,3.5,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(5,7,13,.8)'; ctx.lineWidth=1; ctx.stroke();
  });
  // live points under each moon
  for(const b of sc.bodies){
    if(b.hidden) continue;
    if(state.mapFocus && state.mapFocus!==b.m.key) continue;
    const q = subPoint(eclToEq(b.s.u), sc.t), s = m2s(q.lat,q.lon);
    ctx.strokeStyle = rgba(labelColor(b.m), .95); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(s.x,s.y,5,0,Math.PI*2); ctx.stroke();
    if(state.opt.labels){ ctx.font='400 13px "IM Fell English SC", Georgia, serif'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillStyle='rgba(5,7,13,.7)'; ctx.fillText(b.m.name, s.x+9, s.y+1); ctx.fillStyle=rgba(labelColor(b.m),.95); ctx.fillText(b.m.name, s.x+8, s.y); }
  }
  // sub-solar point
  { const s = m2s(sub.lat, sub.lon); ctx.fillStyle='#fff3c4'; ctx.beginPath(); ctx.arc(s.x,s.y,5,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='rgba(255,243,196,.5)'; for(let i=0;i<8;i++){ const a=i*Math.PI/4; ctx.beginPath(); ctx.moveTo(s.x+Math.cos(a)*7,s.y+Math.sin(a)*7); ctx.lineTo(s.x+Math.cos(a)*10,s.y+Math.sin(a)*10); ctx.stroke(); } }
/*@dm*/  if(sc.amberImpact){ const st = impactSite(sc.amberImpact), q = m2s(st.lat, st.lon); drawImpactMark(q.x, q.y); }
/*@end*/  // Dirole and observer
  const dr = m2s(DIROLE_LAT, 0);
  ctx.fillStyle = '#d6b26a'; ctx.strokeStyle='#05070d'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(dr.x, dr.y-7); ctx.lineTo(dr.x+6, dr.y); ctx.lineTo(dr.x, dr.y+7); ctx.lineTo(dr.x-6, dr.y); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.font='400 15px "IM Fell English SC", Georgia, serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillStyle='rgba(5,7,13,.75)'; ctx.fillText('Dirole', dr.x+11, dr.y-9); ctx.fillStyle='#ebe5d4'; ctx.fillText('Dirole', dr.x+10, dr.y-10);
  if(state.lat !== DIROLE_LAT){ const ob = m2s(state.lat, 0); ctx.strokeStyle='#d6b26a'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(ob.x-6,ob.y); ctx.lineTo(ob.x+6,ob.y); ctx.moveTo(ob.x,ob.y-6); ctx.lineTo(ob.x,ob.y+6); ctx.stroke(); ctx.font='500 10px "IBM Plex Mono", monospace'; ctx.fillStyle='#d6b26a'; ctx.fillText('observer', ob.x+9, ob.y); }
  ctx.restore();
  ctx.strokeStyle='rgba(235,229,212,0.25)'; ctx.lineWidth=1; ctx.strokeRect(x+.5,y+.5,w-1,h-1);
  // axis labels
  ctx.font='500 10px "IBM Plex Mono", monospace'; ctx.fillStyle='rgba(162,156,176,0.85)';
  ctx.textAlign='center'; ctx.textBaseline='top';
  for(let lo=-180; lo<=180; lo+=60){ const a=m2s(0,lo); ctx.fillText(lo===0?'0° Dirole':`${Math.abs(lo)}°${lo<0?'W':'E'}`, Math.min(x+w-20, Math.max(x+20, lo===180? x+w : a.x)), y+h+4); }
  ctx.textAlign='right'; ctx.textBaseline='middle';
  for(let la=-60; la<=60; la+=30){ const a=m2s(la,0); if(x > 40) ctx.fillText(la===0?'0°':`${Math.abs(la)}°${la>0?'N':'S'}`, x-5, a.y); }
  ctx.textAlign='left'; ctx.textBaseline='top'; ctx.fillStyle='rgba(162,156,176,0.75)';
  ctx.fillText(state.mapFocus ? `Showing the ${state.mapFocus[0].toUpperCase()+state.mapFocus.slice(1)} ley line · click it in the list again to show all` : 'Ley lines: ground path under each moon, 21st–25th of its month · dot = under it at closest · rings = under each moon now · click a moon in the list to isolate its line', x, y+h+18);
}

// =================== GLOBE (ley lines on a rotatable planet) ===================
const globe = {lon0: 0, lat0: 28, zoom: 1, cx:0, cy:0, R:100, c:[1,0,0], e:[0,1,0], n:[0,0,1]};
const gbuf = document.createElement('canvas'), gctx = gbuf.getContext('2d'); let gimg = null;
let tex = null; // {w,h,data}
function setTexture(im){
  const tw = 1440, th = 720, c = document.createElement('canvas'); c.width = tw; c.height = th;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0, tw, th);
  try{ tex = {w:tw, h:th, data: g.getImageData(0,0,tw,th).data}; }catch(e){ tex = null; }
}
function llVec(lat, lon){ const a=lat*DEG, b=lon*DEG, ca=Math.cos(a); return [ca*Math.cos(b), ca*Math.sin(b), Math.sin(a)]; }
function setGlobeCamera(){
  const l=globe.lon0*DEG, p=globe.lat0*DEG;
  globe.c=[Math.cos(p)*Math.cos(l), Math.cos(p)*Math.sin(l), Math.sin(p)];
  globe.e=[-Math.sin(l), Math.cos(l), 0];
  globe.n=[-Math.sin(p)*Math.cos(l), -Math.sin(p)*Math.sin(l), Math.cos(p)];
}
function gproj(v){ return {x: globe.cx + globe.R*dot(v,globe.e), y: globe.cy - globe.R*dot(v,globe.n), z: dot(v,globe.c)}; }
function globeLayout(){
  const plaque = document.querySelector('.plaque').getBoundingClientRect(), appR = app.getBoundingClientRect(), dock = $('dock').getBoundingClientRect();
  const rosterR = roster.hidden ? null : roster.getBoundingClientRect();
  const narrow = window.innerWidth <= 760;
  const right = (!narrow && rosterR) ? rosterR.left - appR.left - 14 : W - 16;
  const top = narrow ? Math.round(plaque.height) + 26 : 20, bottom = dock.top - appR.top - 34;
  const L = 16;
  globe.cx = (L+right)/2; globe.cy = (top+bottom)/2;
  globe.R = Math.max(40, Math.min(right-L, bottom-top)/2 - 6) * globe.zoom;
  return {top, bottom};
}
function polylineGlobe(pts, front, back){
  // pts: unit vectors; draws front-side segments with `front` style and far-side with `back` (null = skip)
  for(const [style, sideFront] of [[back,false],[front,true]]){
    if(!style) continue;
    ctx.strokeStyle = style.color; ctx.lineWidth = style.width; ctx.setLineDash(style.dash||[]);
    ctx.beginPath(); let pen=false;
    for(const v of pts){ const q=gproj(v); const vis = sideFront ? q.z > 0 : q.z <= 0; if(!vis){pen=false;continue;} if(!pen){ctx.moveTo(q.x,q.y);pen=true;} else ctx.lineTo(q.x,q.y); }
    ctx.stroke();
  }
  ctx.setLineDash([]);
}
const leyVecs = leyLines.map(L=>({pts: L.pts.map(q=>({v:llVec(q.lat,q.lon), wMi:q.wMi, a:q.a})), per: llVec(L.per.lat, L.per.lon)}));
function drawGlobe(sc){
  const lay = globeLayout(); setGlobeCamera();
  ctx.fillStyle = '#05060c'; ctx.fillRect(0,0,W,H);
  for(let i=0;i<stars.length;i+=4){ const st=stars[i]; const x=((st.v[0]*0.5+0.5)*W*1.7)%W, y=((st.v[1]*0.5+0.5)*H*1.9)%H; ctx.fillStyle=rgba(st.col,.12+.45*st.b); ctx.fillRect(x,y,1.1,1.1); }
  const {cx, cy, R} = globe;
  const sub = subPoint(eclToEq(sc.S), sc.t), sv = llVec(sub.lat, sub.lon);
  // render the sphere surface at reduced resolution
  const res = Math.max(80, Math.min(560, Math.round(2*R/ (R>300?1.6:1.2))));
  if(gbuf.width!==res){ gbuf.width=res; gbuf.height=res; gimg = gctx.createImageData(res,res); }
  const D = gimg.data, sh = state.mapShift; let p = 0;
  const c=globe.c, e=globe.e, n=globe.n;
  for(let j=0;j<res;j++){
    const Y = 1 - 2*(j+.5)/res;
    for(let i=0;i<res;i++){
      const X = 2*(i+.5)/res - 1, r2 = X*X+Y*Y;
      if(r2 > 1){ D[p++]=0; D[p++]=0; D[p++]=0; D[p++]=0; continue; }
      const Z = Math.sqrt(1-r2);
      const v0 = X*e[0]+Y*n[0]+Z*c[0], v1 = X*e[1]+Y*n[1]+Z*c[1], v2 = X*e[2]+Y*n[2]+Z*c[2];
      let r, g, b;
      if(tex){
        const lon = Math.atan2(v1,v0)/DEG, lat = Math.asin(v2)/DEG;
        let u = ((lon - sh + 180)/360) % 1; if(u<0) u+=1;
        const ti = ((Math.min(tex.h-1, Math.floor((90-lat)/180*tex.h)))*tex.w + Math.floor(u*tex.w))*4;
        r = tex.data[ti]; g = tex.data[ti+1]; b = tex.data[ti+2];
      } else {
        const lat = v2; r = 30 + 14*lat*lat; g = 62 + 10*lat*lat; b = 104 - 8*lat*lat;
      }
      const day = smooth(-0.08, 0.1, v0*sv[0]+v1*sv[1]+v2*sv[2]);
      const lit = (0.28 + 0.72*day) * (0.55 + 0.45*Z);
      D[p++] = r*lit; D[p++] = g*lit; D[p++] = b*lit*(day<.5 ? 1.08 : 1); D[p++] = 255;
    }
  }
  gctx.putImageData(gimg,0,0);
  // atmosphere rim
  const atm = ctx.createRadialGradient(cx,cy,R*.96,cx,cy,R*1.08); atm.addColorStop(0,'rgba(120,170,230,0.35)'); atm.addColorStop(1,'rgba(120,170,230,0)');
  ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(cx,cy,R*1.08,0,Math.PI*2); ctx.fill();
  ctx.imageSmoothingEnabled = true; ctx.drawImage(gbuf, cx-R, cy-R, 2*R, 2*R);
  // graticule
  const grat = {color:'rgba(235,229,212,0.13)', width:1};
  for(let lo=-180; lo<180; lo+=30){ const pts=[]; for(let la=-90; la<=90; la+=3) pts.push(llVec(la,lo)); polylineGlobe(pts, lo===0 ? {color:'rgba(214,178,106,0.45)', width:1} : grat, null); }
  for(let la=-60; la<=60; la+=30){ const pts=[]; for(let lo=-180; lo<=180; lo+=3) pts.push(llVec(la,lo)); polylineGlobe(pts, la===0 ? {color:'rgba(235,229,212,0.3)', width:1} : grat, null); }
  for(const la of [23.4,-23.4,66.6,-66.6]){ const pts=[]; for(let lo=-180; lo<=180; lo+=3) pts.push(llVec(la,lo)); polylineGlobe(pts, {color:'rgba(235,229,212,0.18)', width:1, dash:[3,4]}, null); }
  // ley lines: far side faint, near side bold
  const lw = Math.max(1.4, R/200);
  MOONS.forEach((m,k)=>{
    if(!m.present) return;
    const focus = state.mapFocus, dim = focus && focus!==m.key ? .1 : 1, w = lw*(focus===m.key?1.6:1);
    const col = labelColor(m);
    const proj = leyVecs[k].pts.map(q=>{ const s=gproj(q.v); return {x:s.x, y:s.y, z:s.z, wMi:q.wMi, a:q.a}; });
    const front = proj.map(p=>({...p, ok: p.z > 0})), back = proj.map(p=>({...p, ok: p.z <= 0}));
    drawLey(k, m, front, w, dim, back);
    const pq = gproj(leyVecs[k].per); if(pq.z > 0){ ctx.fillStyle = rgba(col,dim); ctx.beginPath(); ctx.arc(pq.x,pq.y,4,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='rgba(5,7,13,.8)'; ctx.lineWidth=1; ctx.stroke(); }
  });
  // live points under each moon
  ctx.textAlign='left'; ctx.textBaseline='middle';
  for(const b of sc.bodies){
    if(b.hidden || (state.mapFocus && state.mapFocus!==b.m.key)) continue;
    const q = subPoint(eclToEq(b.s.u), sc.t), s = gproj(llVec(q.lat,q.lon)); if(s.z <= 0) continue;
    ctx.strokeStyle = rgba(labelColor(b.m), .95); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(s.x,s.y,5.5,0,Math.PI*2); ctx.stroke();
    if(state.opt.labels){ ctx.font='400 13px "IM Fell English SC", Georgia, serif'; ctx.fillStyle='rgba(5,7,13,.75)'; ctx.fillText(b.m.name, s.x+10, s.y+1); ctx.fillStyle=rgba(labelColor(b.m),.95); ctx.fillText(b.m.name, s.x+9, s.y); }
  }
  // sub-solar point
  { const s = gproj(sv); if(s.z > 0){ ctx.fillStyle='#fff3c4'; ctx.beginPath(); ctx.arc(s.x,s.y,5,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='rgba(255,243,196,.6)'; ctx.lineWidth=1; for(let i=0;i<8;i++){ const a=i*Math.PI/4; ctx.beginPath(); ctx.moveTo(s.x+Math.cos(a)*7,s.y+Math.sin(a)*7); ctx.lineTo(s.x+Math.cos(a)*10,s.y+Math.sin(a)*10); ctx.stroke(); } } }
/*@dm*/  if(sc.amberImpact){ const st = impactSite(sc.amberImpact), q = gproj(llVec(st.lat, st.lon)); if(q.z > 0) drawImpactMark(q.x, q.y); }
/*@end*/  // Dirole and observer
  const dq = gproj(llVec(DIROLE_LAT, 0));
  if(dq.z > 0){
    ctx.fillStyle = '#d6b26a'; ctx.strokeStyle='#05070d'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(dq.x, dq.y-7); ctx.lineTo(dq.x+6, dq.y); ctx.lineTo(dq.x, dq.y+7); ctx.lineTo(dq.x-6, dq.y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.font='400 16px "IM Fell English SC", Georgia, serif'; ctx.fillStyle='rgba(5,7,13,.8)'; ctx.fillText('Dirole', dq.x+11, dq.y-9); ctx.fillStyle='#ebe5d4'; ctx.fillText('Dirole', dq.x+10, dq.y-10);
  }
  if(state.lat !== DIROLE_LAT){ const ob = gproj(llVec(state.lat,0)); if(ob.z>0){ ctx.strokeStyle='#d6b26a'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(ob.x-6,ob.y); ctx.lineTo(ob.x+6,ob.y); ctx.moveTo(ob.x,ob.y-6); ctx.lineTo(ob.x,ob.y+6); ctx.stroke(); ctx.font='500 10px "IBM Plex Mono", monospace'; ctx.fillStyle='#d6b26a'; ctx.fillText('observer', ob.x+9, ob.y); } }
  ctx.strokeStyle='rgba(235,229,212,0.25)'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.stroke();
  ctx.font='500 10px "IBM Plex Mono", monospace'; ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillStyle='rgba(162,156,176,0.8)';
  const cap = state.mapFocus ? `Showing the ${state.mapFocus[0].toUpperCase()+state.mapFocus.slice(1)} ley line · click it in the list again to show all` : 'Drag to turn · scroll to zoom · line width follows the moon’s apparent size (1 mile at the ends, about 1.9 miles at closest; drawn enlarged) · click a moon in the list to isolate its line';
  ctx.fillText(cap, cx, Math.min(lay.bottom + 10, cy + R + 14));
}

/*@dm*/// ---------- Amber impact ----------
function impactSite(s){ const ti = s.tImpact, r = amberPosAt(ti), d = Math.hypot(r[0],r[1],r[2]); return subPoint(eclToEq([r[0]/d,r[1]/d,r[2]/d]), ti); }
function drawImpact(sc){
  const s = sc.amberImpact, since = amberT(sc.t) - s.tImpact;
  if(state.view==='sky' && since < 2){ ctx.fillStyle = `rgba(255,110,40,${0.45*Math.max(0,1-since/2)})`; ctx.fillRect(0,0,W,H); }
  const site = impactSite(s), dp = dateParts(s.tImpact % YEAR);
  const msg = `The Amber Moon strikes Ganthia · ${ordinal(dp.day)} of ${MOONS[dp.mi].month}, ${clock(s.tImpact)} · ${Math.abs(site.lat).toFixed(0)}°${site.lat>=0?'N':'S'}, ${Math.abs(site.lon).toFixed(0)}°${site.lon>=0?'E':'W'} of Dirole`;
  ctx.font = '400 17px "IM Fell English SC", Georgia, serif'; const tw = ctx.measureText(msg).width;
  const x = W/2, y = 22; ctx.fillStyle = 'rgba(40,8,4,0.85)'; ctx.fillRect(x - tw/2 - 14, y - 4, tw + 28, 30);
  ctx.strokeStyle = 'rgba(255,140,70,0.8)'; ctx.strokeRect(x - tw/2 - 14 + .5, y - 4 + .5, tw + 27, 29);
  ctx.fillStyle = '#ffd2b0'; ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillText(msg, x, y + 2);
}
function drawImpactMark(px, py){ ctx.strokeStyle = '#ff7a3c'; ctx.lineWidth = 2.5; for(let i=0;i<4;i++){ const a=i*Math.PI/4; ctx.beginPath(); ctx.moveTo(px-Math.cos(a)*9, py-Math.sin(a)*9); ctx.lineTo(px+Math.cos(a)*9, py+Math.sin(a)*9); ctx.stroke(); } ctx.font='400 14px "IM Fell English SC", Georgia, serif'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillStyle='#ffb48a'; ctx.fillText('Impact', px+12, py+12); }
/*@end*/
// ---------- insets ----------
function drawMini(sc){
  const s = mini.width, c = s/2, Rr = s/2 - 18;
  mctx.setTransform(1,0,0,1,0,0); mctx.clearRect(0,0,s,s);
  mctx.fillStyle = 'rgba(9,10,19,0.82)'; mctx.beginPath(); mctx.arc(c,c,Rr+14,0,Math.PI*2); mctx.fill();
  if(state.view === 'orrery'){
    // the planet's year around the sun, seen from ecliptic north
    const rr = Rr*0.72;
    mctx.strokeStyle='rgba(235,229,212,0.22)'; mctx.lineWidth=2; mctx.beginPath(); mctx.arc(c,c,rr,0,Math.PI*2); mctx.stroke();
    mctx.fillStyle='#fff3c4'; mctx.beginPath(); mctx.arc(c,c,11,0,Math.PI*2); mctx.fill();
    const pos = l=>[c + rr*Math.cos(l), c - rr*Math.sin(l)];
    mctx.font='500 17px "IBM Plex Mono", monospace'; mctx.textAlign='center'; mctx.textBaseline='middle';
    MOONS.forEach((m,k)=>{ const l = sunLon(40*k)+Math.PI; const [x,y]=pos(l); const [x2,y2]=[c+(rr+18)*Math.cos(l), c-(rr+18)*Math.sin(l)];
      mctx.strokeStyle='rgba(235,229,212,0.25)'; mctx.lineWidth=1.5; mctx.beginPath(); mctx.moveTo(c+(rr-6)*Math.cos(l), c-(rr-6)*Math.sin(l)); mctx.lineTo(c+(rr+6)*Math.cos(l), c-(rr+6)*Math.sin(l)); mctx.stroke();
      mctx.fillStyle = m.present ? rgba(labelColor(m),.9) : 'rgba(162,156,176,0.5)'; mctx.fillText(m.name[0], x2, y2); });
    const [px,py] = pos(sunLon(sc.t)+Math.PI);
    mctx.fillStyle='#6fa6d6'; mctx.beginPath(); mctx.arc(px,py,8,0,Math.PI*2); mctx.fill();
    mctx.font='500 15px "IBM Plex Mono", monospace'; mctx.fillStyle='rgba(162,156,176,0.85)'; mctx.fillText('the year', c, c+30);
    return;
  }
  mctx.strokeStyle = 'rgba(235,229,212,0.22)'; mctx.lineWidth = 2; mctx.beginPath(); mctx.arc(c,c,Rr,0,Math.PI*2); mctx.stroke();
  mctx.strokeStyle = 'rgba(235,229,212,0.09)'; [1/3,2/3].forEach(f=>{ mctx.beginPath(); mctx.arc(c,c,Rr*f,0,Math.PI*2); mctx.stroke(); });
  const pos = (alt,az)=>{ const r = Rr*(90-alt)/90; return [c - r*Math.sin(az*DEG), c - r*Math.cos(az*DEG)]; };
  const yawD = state.yaw/DEG, half = state.fov/2/DEG;
  mctx.fillStyle = 'rgba(214,178,106,0.14)'; mctx.beginPath(); mctx.moveTo(c,c);
  for(let a=yawD-half; a<=yawD+half; a+=2){ const [x,y]=pos(0,a); mctx.lineTo(x,y); } mctx.closePath(); mctx.fill();
  mctx.font = '500 22px "IBM Plex Mono", monospace'; mctx.textAlign='center'; mctx.textBaseline='middle';
  [['N',0],['E',90],['S',180],['W',270]].forEach(([n,a])=>{ const r=Rr+8; mctx.fillStyle='rgba(214,178,106,0.9)'; mctx.fillText(n, c - r*Math.sin(a*DEG), c - r*Math.cos(a*DEG)); });
  if(state.opt.sun && sc.sunAA.alt > 0){ const [x,y]=pos(sc.sunAA.alt, sc.sunAA.az); mctx.fillStyle='#fff3c4'; mctx.beginPath(); mctx.arc(x,y,9,0,Math.PI*2); mctx.fill(); }
  for(const b of sc.bodies){
    if(b.hidden || b.aa.alt < 0) continue;
    const [x,y] = pos(b.aa.alt, b.aa.az), r = 3 + 6*Math.min(1, PERI_KM/b.s.d);
    mctx.fillStyle = rgba(b.m.key==='black' ? [70,62,86] : b.m.color, 1);
    mctx.beginPath(); mctx.arc(x,y,r,0,Math.PI*2); mctx.fill();
    if(b.m.key==='black'){ mctx.strokeStyle = rgba(b.m.rim,.8); mctx.lineWidth=1.5; mctx.stroke(); }
  }
}

// ---------- text, roster ----------
function ordinal(n){ const s=['th','st','nd','rd'], v=n%100; return n + (s[(v-20)%10] || s[v] || s[0]); }
function dateParts(t){ const d = Math.floor(t), mi = Math.floor(d/40), day = d%40 + 1; return {mi, day, doy:d+1}; }
function clock(t){ const h = (t - Math.floor(t))*24; let H = Math.floor(h), M = Math.round((h-H)*60); if(M===60){M=0;H=(H+1)%24;} const ap = H<12?'AM':'PM', h12 = (H%12)||12; return `${h12}:${String(M).padStart(2,'0')} ${ap}`; }
function facing(yawRad){ const n=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']; const a=((yawRad/DEG)%360+360)%360; return n[Math.round(a/22.5)%16]; }
function latStr(v){ return v===0 ? '0°' : `${Math.abs(v)}°${v>0?'N':'S'}`; }
function fmtDist(d){ return d >= 1e7 ? `${(d/1e6).toFixed(0)}M km` : d >= 1e6 ? `${(d/1e6).toFixed(2)}M km` : `${Math.round(d/1e3)}k km`; }

const roster = $('roster'), listEl = $('moonList'); const rows = [];
[...MOONS.filter(m=>m.present)/*@dm*/, AMBER/*@end*/].forEach(m=>{
  const li = document.createElement('li'), btn = document.createElement('button');
  btn.type='button';
  const cv = document.createElement('canvas'); cv.width=52; cv.height=52;
  const mid = document.createElement('div'); mid.style.minWidth='0';
  mid.innerHTML = `<div class="mname">${m.name} Moon<span class="tags"></span></div><div class="mmeta">${m.school} · ${m.month}</div>`;
  const num = document.createElement('div'); num.className='mnum';
  btn.append(cv, mid, num); li.append(btn); listEl.append(li);
  btn.addEventListener('click', ()=>{ /*@dm*/if(m===AMBER && !state.opt.amber){ state.opt.amber = true; $('optAmber').checked = true; syncLure(); } /*@end*/if(state.followOn && state.follow===m.key){ stopFollow(); if(state.view==='map') state.mapFocus = null; requestDraw(); return; } aimAt(m.key); });
  rows.push({m, li, cv, tags: mid.querySelector('.tags'), num, btn});
});
function drawPhaseIcon(cv, m, cosPhi, shadow){
  const g = cv.getContext('2d'); g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,52,52);
  g.strokeStyle='rgba(235,229,212,0.18)'; g.lineWidth=1.5; g.beginPath(); g.arc(26,26,22,0,Math.PI*2); g.stroke();
  drawMoonDisc(g, 26, 26, 20, m, cosPhi, 0, shadow, 0, 1);
}
let lastTextT = -1, lastTitle = '', lastSub = '';
const KICKERS = {sky:'The sky over Ganthia', orrery:'The moons in their orbits', map:'Ley lines of Ganthia'};
function updateText(sc){
  const dp = dateParts(sc.t);
  const title = `${ordinal(dp.day)} of ${MOONS[dp.mi].month}`;
  const sub = state.view==='sky' ? `${clock(sc.t)} · ${state.year} CR · ${latStr(state.lat)} · facing ${facing(state.yaw)}` : `${clock(sc.t)} at Dirole · ${state.year} CR · day ${dp.doy} of 400`;
  if(title!==lastTitle){ $('dateTitle').textContent = title; lastTitle = title; }
  if(sub!==lastSub){ $('dateSub').textContent = sub; lastSub = sub; }
  $('kicker').textContent = KICKERS[state.view];
  const now = performance.now();
  if(now - lastTextT < 220) return; lastTextT = now;
  for(const r of rows){
    const b = sc.bodies.find(x=>x.m===r.m); if(!b) continue;
    drawPhaseIcon(r.cv, r.m, b.s.cosPhi, b.s.shadow);
    let tags = '';
    if(sc.closest === b) tags += '<span class="tag">closest</span>';
    if(b.s.shadow < .97/*@dm*/ && !(b.amber && b.s.impact)/*@end*/) tags += '<span class="tag ecl">eclipse</span>';
    if(r.tags.innerHTML !== tags) r.tags.innerHTML = tags;
    r.li.classList.toggle('off', !!b.hidden);
    const up = b.aa.alt > hill(b.aa.az);
    const third = /*@dm*/(b.amber && b.s.impact) ? '<span class="down">impact</span>' : /*@end*/b.hidden ? '<span class="down">hidden</span>' : up ? Math.round(b.aa.alt)+'° up' : '<span class="down">below</span>';
    r.num.innerHTML = `${Math.round(b.s.frac*100)}% lit<br>${fmtDist(b.s.d)}<br>${third}`;
    r.btn.setAttribute('aria-label', `${r.m.name} Moon, ${Math.round(b.s.frac*100)} percent lit, ${b.hidden ? 'hidden; select to show' : up?'altitude '+Math.round(b.aa.alt)+' degrees':'below the horizon'}. Look at it.`);
  }
  syncSliders();
}
function syncSliders(){
  const dp = dateParts(state.t);
  if(document.activeElement !== $('year')){ $('year').value = state.year; }
  if(document.activeElement !== $('month')){ $('month').value = dp.mi + 1; }
  if(document.activeElement !== $('day')){ $('day').value = dp.day; }
  $('monthOut').textContent = MOONS[dp.mi].month;
  $('dayOut').textContent = ordinal(dp.day);
  const h = state.mode==='year' ? state.fixedHour : (state.t - Math.floor(state.t))*24;
  if(document.activeElement !== $('hour')){ $('hour').value = (Math.round(h*4)/4) % 24; }
  $('hourOut').textContent = clock(Math.floor(state.t) + h/24).replace(':00 ',' ');
}
function aimAt(key){
  const sc = computeScene(); const b = sc.bodies.find(x=>x.m.key===key); if(!b) return;
  state.lastAim = key; if(state.followOn){ state.follow = key; syncFollow(); }
  if(state.view==='sky'){ state.yaw = b.aa.az*DEG; state.pitch = Math.max(4, Math.min(80, b.aa.alt))*DEG; }
  else if(state.view==='orrery'){ const r=b.s.r; state.orb.az = Math.atan2(r[1], r[0]) + 0.5; }
  else { state.mapFocus = state.mapFocus===key && !state.followOn ? null : key; if(state.mapFocus && state.mapMode==='globe'){ const k = MOONS.findIndex(m=>m.key===key); if(k>=0){ const pp = leyLines[k].per; globe.lon0 = pp.lon; globe.lat0 = Math.max(-60, Math.min(60, pp.lat)); } } }
  requestDraw();
}
// Follow: while on, the moon last clicked in the list stays in view as time runs
function syncFollow(){ for(const r of rows){ const on = state.follow===r.m.key; r.li.classList.toggle('following', on); if(state.followOn) r.btn.setAttribute('aria-pressed', on); else r.btn.removeAttribute('aria-pressed'); } }
function stopFollow(){ if(!state.follow) return; state.follow = null; syncFollow(); }
function trackFollow(sc){
  if(!state.follow) return;
  const b = sc.bodies.find(x=>x.m.key===state.follow); if(!b || b.hidden) return;
  if(state.view==='sky'){ state.yaw = b.aa.az*DEG; state.pitch = Math.max(4, Math.min(80, b.aa.alt))*DEG; }
  else if(state.view==='orrery'){ const r=b.s.r; state.orb.az = Math.atan2(r[1], r[0]) + 0.5; }
  else if(state.mapMode==='globe'){ const q = subPoint(eclToEq(b.s.u), sc.t); globe.lon0 = q.lon; globe.lat0 = Math.max(-89, Math.min(89, q.lat)); }
}
$('optFollow').addEventListener('change', e=>{
  state.followOn = e.target.checked;
  if(!state.followOn){ state.follow = null; syncFollow(); requestDraw(); return; }
  // start on the moon last clicked, else the one shown on the map, else the closest
  const sc = computeScene(), visible = k => sc.bodies.some(b=>b.m.key===k && !b.hidden);
  const key = [state.lastAim, state.mapFocus].find(k=>k && visible(k)) || (sc.closest && sc.closest.m.key);
  if(key) aimAt(key);
});

// ---------- controls ----------
const speedSel = $('speed');
function fillSpeeds(){ speedSel.value = state.speedX[state.mode]; $('speedOut').textContent = speedLabel(state.mode); }
fillSpeeds();
speedSel.addEventListener('input', ()=>{ state.speedX[state.mode] = +speedSel.value; $('speedOut').textContent = speedLabel(state.mode); });
$('reverse').addEventListener('click', ()=>{ state.reverse = !state.reverse; $('reverse').setAttribute('aria-pressed', state.reverse); });
function nudgeSpeed(dx){ state.speedX[state.mode] = Math.max(0, Math.min(100, state.speedX[state.mode] + dx)); fillSpeeds(); }
function setPlaying(p){ state.playing = p; $('play').textContent = p ? 'Pause' : 'Play'; if(p){ lastFrame = performance.now(); } requestDraw(); }
$('play').addEventListener('click', ()=>setPlaying(!state.playing));
function setMode(mode){
  state.mode = mode;
  $('modeNight').setAttribute('aria-pressed', mode==='night'); $('modeYear').setAttribute('aria-pressed', mode==='year');
  if(mode==='year'){ state.fixedHour = Math.round(((state.t - Math.floor(state.t))*24)*4)/4; state.dayAcc = Math.floor(state.t); }
  fillSpeeds(); requestDraw();
}
$('modeNight').addEventListener('click', ()=>setMode('night'));
$('modeYear').addEventListener('click', ()=>setMode('year'));
document.querySelectorAll('[data-view]').forEach(b=>{ if(b.tagName!=='BUTTON') return; b.addEventListener('click', ()=>{
  state.view = b.dataset.view; app.dataset.view = state.view;
  document.querySelectorAll('button[data-view]').forEach(x=>x.setAttribute('aria-pressed', x===b));
  sky.style.cursor = (state.view==='map' && state.mapMode!=='globe') ? 'default' : '';
  try{ location.hash = state.view; }catch(e){}
  layout();
}); });
// the date is set as a month (1-10) and a day of that month (1-40)
function setDate(mi, day){ const d = mi*40 + day - 1, h = state.mode==='year' ? state.fixedHour/24 : state.t - Math.floor(state.t); state.t = d + h; state.dayAcc = d; lastTextT = -1; requestDraw(); }
$('month').addEventListener('input', e=>setDate(+e.target.value - 1, dateParts(state.t).day));
// the year field follows the clock as it plays; typing a whole number sets the year
$('year').addEventListener('input', e=>{ const v = e.target.value.trim(), y = Number(v); if(v === '' || !Number.isInteger(y)) return; state.year = y; lastTextT = -1; requestDraw(); });
$('year').addEventListener('change', e=>{ e.target.value = state.year; });
$('day').addEventListener('input', e=>setDate(dateParts(state.t).mi, +e.target.value));
$('hour').addEventListener('input', e=>{ const h = +e.target.value % 24; state.fixedHour = h; state.t = Math.floor(state.t) + h/24; lastTextT = -1; requestDraw(); });
// crossing the equator turns the view to face it from the new hemisphere
$('lat').addEventListener('input', e=>{ const was = state.lat; state.lat = +e.target.value; if((was < 0) !== (state.lat < 0)) state.yaw = equatorYaw(state.lat); $('latOut').textContent = latStr(state.lat); requestDraw(); });
document.querySelectorAll('[data-size]').forEach(b=>b.addEventListener('click', ()=>{ state.size = b.dataset.size; document.querySelectorAll('[data-size]').forEach(x=>x.setAttribute('aria-pressed', x===b)); requestDraw(); }));
[['optLabels','labels'],['optSun','sun'],['optGrid','grid']/*@dm*/,['optAmber','amber']/*@end*/].forEach(([id,k])=>$(id).addEventListener('change', e=>{ state.opt[k] = e.target.checked; /*@dm*/syncLure(); /*@end*/requestDraw(); }));
/*@dm*/function syncLure(){
  $('lureCtl').hidden = !state.opt.amber;
  const m = amberMiss(), L = state.lure;
  $('lureOut').textContent = L >= 30 ? `${L} · impact` : `${L} · misses by ${m >= 1e4 ? Math.round(m/1e3)+'k' : Math.round(m)} km`;
}
$('lure').addEventListener('input', e=>{ state.lure = +e.target.value; syncLure(); requestDraw(); });
syncLure();
/*@end*/$('mapShift').addEventListener('input', e=>{ state.mapShift = +e.target.value; $('mapShiftOut').textContent = `${state.mapShift}°`; requestDraw(); });
$('mapFile').addEventListener('change', e=>{
  const f = e.target.files && e.target.files[0]; if(!f) return;
  const url = URL.createObjectURL(f), im = new Image();
  im.onload = ()=>{ state.mapImg = im; setTexture(im); requestDraw(); };
  im.src = url;
});
document.querySelectorAll('[data-mapmode]').forEach(b=>b.addEventListener('click', ()=>{ state.mapMode = b.dataset.mapmode; document.querySelectorAll('[data-mapmode]').forEach(x=>x.setAttribute('aria-pressed', x===b)); sky.style.cursor = state.mapMode==='globe' ? '' : 'default'; requestDraw(); }));
function orbMinDist(){ return state.orbScale === 'accurate' ? 0.03 : 1.2; }
document.querySelectorAll('[data-orbscale]').forEach(b=>b.addEventListener('click', ()=>{ state.orbScale = b.dataset.orbscale; document.querySelectorAll('[data-orbscale]').forEach(x=>x.setAttribute('aria-pressed', x===b)); state.orb.dist = Math.max(orbMinDist(), state.orb.dist); requestDraw(); }));
const jump = $('jump');
MOONS.forEach((m,k)=>{ if(!m.present) return; const o=document.createElement('option'); o.value=k; o.textContent=`${m.name}: midnight, 23rd of ${m.month}`; jump.append(o); });
/*@dm*/{ const o=document.createElement('option'); o.value='amber'; o.textContent='Amber: 2 PM, 40th of Violetmoon (overhead Dirole about 4 PM)'; jump.append(o); }
/*@end*/jump.addEventListener('change', ()=>{
  if(jump.value==='') return;
  setPlaying(false);   // land on the moment; at night-by-night speed it would be gone within a second
  /*@dm*/if(jump.value==='amber'){ state.opt.amber = true; $('optAmber').checked = true; syncLure(); state.year = 9179; state.t = 399.5833; state.dayAcc = 399; state.fixedHour = 14; aimAt('amber'); }
  else /*@end*/{ const k = +jump.value; state.t = 40*k + 22; state.dayAcc = 40*k + 22; state.fixedHour = 0; if(state.view==='map') state.mapFocus = null; aimAt(MOONS[k].key); }
  jump.value=''; lastTextT = -1; requestDraw();
});
const rosterBtn = $('rosterToggle');
rosterBtn.addEventListener('click', ()=>{ roster.hidden = !roster.hidden; rosterBtn.setAttribute('aria-expanded', !roster.hidden); rosterBtn.setAttribute('aria-pressed', !roster.hidden); layout(); });
document.addEventListener('keydown', e=>{
  if(e.target.closest && e.target.closest('input,select,textarea')) return;
  if(e.code==='Space'){ e.preventDefault(); setPlaying(!state.playing); }
  if(e.key==='[' || e.key==='-'){ nudgeSpeed(-5); }
  if(e.key===']' || e.key==='=' || e.key==='+'){ nudgeSpeed(5); }
  if(e.key==='ArrowRight'){ state.t = (state.t + 0.25/24 + YEAR) % YEAR; requestDraw(); }
  if(e.key==='ArrowLeft'){ state.t = (state.t - 0.25/24 + YEAR) % YEAR; requestDraw(); }
});
const ptrs = new Map(); let pinch0 = 0, fov0 = 0, dist0 = 0, zoom0 = 1;
sky.addEventListener('pointerdown', e=>{ if(state.view==='map' && state.mapMode!=='globe') return; sky.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY}); sky.classList.add('drag');
  if(ptrs.size===2){ const [a,b]=[...ptrs.values()]; pinch0 = Math.hypot(a.x-b.x,a.y-b.y); fov0 = state.fov; dist0 = state.orb.dist; zoom0 = globe.zoom; } });
sky.addEventListener('pointermove', e=>{
  const prev = ptrs.get(e.pointerId); if(!prev) return;
  const cur = {x:e.clientX, y:e.clientY}; ptrs.set(e.pointerId, cur);
  if(ptrs.size===1){
    stopFollow();
    if(state.view==='sky'){ const scale = K/2; state.yaw -= (cur.x-prev.x)/scale; state.pitch = Math.max(-8*DEG, Math.min(89*DEG, state.pitch + (cur.y-prev.y)/scale)); }
    else if(state.view==='map'){ globe.lon0 -= (cur.x-prev.x)/globe.R/DEG; globe.lat0 = Math.max(-89, Math.min(89, globe.lat0 + (cur.y-prev.y)/globe.R/DEG)); }
    else { state.orb.az -= (cur.x-prev.x)*0.006; state.orb.el = Math.max(-85*DEG, Math.min(85*DEG, state.orb.el + (cur.y-prev.y)*0.006)); }
  } else if(ptrs.size===2 && pinch0>0){ const [a,b]=[...ptrs.values()]; const r = pinch0/Math.hypot(a.x-b.x,a.y-b.y);
    if(state.view==='sky') state.fov = Math.max(6*DEG, Math.min(160*DEG, fov0*r)); else if(state.view==='map') globe.zoom = Math.max(.6, Math.min(4, zoom0/r)); else state.orb.dist = Math.max(orbMinDist(), Math.min(40, dist0*r)); }
  requestDraw();
});
const endPtr = e=>{ ptrs.delete(e.pointerId); if(ptrs.size<2) pinch0=0; if(!ptrs.size) sky.classList.remove('drag'); };
sky.addEventListener('pointerup', endPtr); sky.addEventListener('pointercancel', endPtr);
sky.addEventListener('wheel', e=>{ if(state.view==='map' && state.mapMode!=='globe') return; e.preventDefault(); const f = Math.exp(e.deltaY*0.0012);
  if(state.view==='map'){ globe.zoom = Math.max(.6, Math.min(4, globe.zoom/f)); requestDraw(); return; }
  if(state.view==='sky') state.fov = Math.max(6*DEG, Math.min(160*DEG, state.fov*f)); else state.orb.dist = Math.max(orbMinDist(), Math.min(40, state.orb.dist*f)); requestDraw(); }, {passive:false});
mini.addEventListener('click', e=>{
  if(state.view!=='sky') return;
  const r = mini.getBoundingClientRect(), s = mini.width, c=s/2, Rr=s/2-18;
  const x = (e.clientX-r.left)*s/r.width - c, y = (e.clientY-r.top)*s/r.height - c;
  const rr = Math.min(Rr, Math.hypot(x,y)); const alt = 90 - 90*rr/Rr; const az = Math.atan2(-x, -y)/DEG;
  state.yaw = az*DEG; state.pitch = Math.max(2, Math.min(85, alt))*DEG; requestDraw();
});

// ---------- layout & loop ----------
function layout(){
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = sky.clientWidth; H = sky.clientHeight;
  sky.width = Math.round(W*DPR); sky.height = Math.round(H*DPR);
  const appR = app.getBoundingClientRect(), dock = $('dock').getBoundingClientRect(), plaque = document.querySelector('.plaque').getBoundingClientRect();
  const miniSize = mini.getBoundingClientRect().height || 150;
  const miniTop = dock.top - appR.top - 10 - miniSize;
  mini.style.top = miniTop + 'px';
  const narrow = window.innerWidth <= 760;
  if(narrow){ roster.style.top = (plaque.bottom - appR.top + 8) + 'px'; roster.style.maxHeight = Math.max(120, dock.top - plaque.bottom - 16) + 'px'; }
  else { roster.style.top = ''; roster.style.maxHeight = Math.max(160, (state.view==='map' ? dock.top - appR.top - 14 : miniTop) - 24) + 'px'; }
  if(firstLayout){ firstLayout = false; state.pitch = horizonPitch(dock.top - appR.top); }
  requestDraw();
}
// the opening tilt puts the horizon four-fifths of the way down the sky left above the controls,
// so the narrow 45° view shows the ground on any screen shape
let firstLayout = true;
function horizonPitch(skyBottom){
  const k = (W/2)/Math.tan(state.fov/4), off = 0.8*skyBottom - H/2;
  return Math.max(-8*DEG, Math.min(60*DEG, 2*Math.atan(off/k)));
}
function draw(){
  const sc = computeScene(); trackFollow(sc); lastScene = sc;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  if(state.view==='sky') drawSky(sc); else if(state.view==='orrery') drawOrrery(sc); else if(state.mapMode==='globe') drawGlobe(sc); else drawMap(sc);
/*@dm*/  if(sc.amberImpact) drawImpact(sc);
/*@end*/  if(state.view!=='map') drawMini(sc);
  updateText(sc);
}
if(window.innerWidth <= 760){ roster.hidden = true; }
let pending = false, lastFrame = performance.now();
function requestDraw(){ if(!pending){ pending = true; requestAnimationFrame(tick); } }
function tick(now){
  pending = false;
  const dt = Math.min(0.1, (now - lastFrame)/1000); lastFrame = now;
  if(state.playing){
    const dir = state.reverse ? -1 : 1;
    // carry the year when the calendar wraps either way
    const wrap = v => { if(v >= YEAR){ state.year++; return v - YEAR; } if(v < 0){ state.year--; return v + YEAR; } return v; };
    if(state.mode==='night'){ state.t = wrap(state.t + dir*speedVal('night')/24*dt); }
    else { state.dayAcc = wrap(state.dayAcc + dir*speedVal('year')*dt); state.t = Math.floor(state.dayAcc) + state.fixedHour/24; }
  }
  draw();
  if(state.playing || starTwinkle()) requestDraw();
}
function starTwinkle(){ return !reduceMotion && state.view==='sky' && lastScene && (!state.opt.sun || lastScene.sunAA.alt < -5); }
window.addEventListener('resize', layout);
$('play').textContent = state.playing ? 'Pause' : 'Play';
$('latOut').textContent = latStr(state.lat);
const h0 = (location.hash||'').slice(1);
if(['orrery','map'].includes(h0)){ const b=document.querySelector(`button[data-view="${h0}"]`); if(b) requestAnimationFrame(()=>b.click()); }
requestAnimationFrame(()=>{ layout(); });
if(document.fonts && document.fonts.ready) document.fonts.ready.then(()=>{ lastTitle=''; requestDraw(); });
})();
