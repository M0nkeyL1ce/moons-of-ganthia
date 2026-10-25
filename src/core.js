// ---- Ganthian sky core (pure math) ----
const DEG = Math.PI/180;
const YEAR = 400, EPS = 23.4*DEG;
const A_KM = 2.30e6, PERI_KM = 1.78e5, ECC = 1 - PERI_KM/A_KM, MOON_R = 806; // 1/10 the volume of Earth's Moon (1737 km × 0.1^(1/3))
const R_PLANET = 6371, R_SUN = 696000, D_SUN = 1.5e8;
const MOONS = [
  {key:'black',  name:'Black',  month:'Blackmoon',  school:'Necromancy',    color:[52,47,62],   rim:[160,140,205], inc:41.8965, sgn: 1, present:true},
  {key:'blue',   name:'Blue',   month:'Bluemoon',   school:'Transmutation', color:[86,148,240], inc:18, sgn:-1, present:true},
  {key:'green',  name:'Green',  month:'Greenmoon',  school:'Conjuration',   color:[92,196,112], inc:40, sgn: 1, present:true},
  {key:'gold',   name:'Gold',   month:'Goldmoon',   school:'Abjuration',    color:[243,200,80], inc:75, sgn:-1, present:true},
  {key:'fifth',  name:/*@dm*/'Amber'/*@end*//*@player 'Fifth'*/,  month:'Fifthmoon',  school:'(lost)',        color:[255,150,50], inc:30, sgn: 1, present:false},
  {key:'red',    name:'Red',    month:'Redmoon',    school:'Evocation',     color:[236,78,64],  inc:56.1405, sgn:-1, present:true},
  {key:'silver', name:'Silver', month:'Silvermoon', school:'Enchantment',   color:[202,206,216],inc:55, sgn: 1, present:true},
  {key:'eighth', name:'Bronze', month:'Eighthmoon', school:'(shattered)',   color:[184,135,74], inc:47, sgn:-1, present:false},
  {key:'white',  name:'White',  month:'Whitemoon',  school:'Divination',    color:[246,243,234],inc:12, sgn: 1, present:true},
  {key:'violet', name:'Violet', month:'Violetmoon', school:'Illusion',      color:[166,112,242],inc:80, sgn:-1, present:true},
];
function sunLon(t){ return (270 + 0.9*t)*DEG; }
function cross(a,b){ return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
function dot(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function norm(a){ const l=Math.hypot(a[0],a[1],a[2]); return [a[0]/l,a[1]/l,a[2]/l]; }
function makeOrbit(lp, incDeg, sgn){
  const P=[Math.cos(lp),Math.sin(lp),0], i=incDeg*DEG*sgn;
  const N=[Math.sin(i)*P[1], -Math.sin(i)*P[0], Math.cos(i)];
  return {P, Q:cross(N,P)};
}
// Each month is named for the moon closest through all of it, the 1st to the 40th. The moons share one orbit
// size, so the closest moon changes halfway between two closest passes: each pass sits mid-month, at the
// start of the 21st (day 20.0), and the hand-overs fall on the 1st.
const PASS_DAY = 20;
MOONS.forEach((m,k)=>{ m.tp = 40*k + PASS_DAY; Object.assign(m, makeOrbit(sunLon(m.tp)+Math.PI, m.inc, m.sgn)); });
function kepler(M,e){ let E = M + e*Math.sin(M); for(let n=0;n<8;n++){ E -= (E - e*Math.sin(E) - M)/(1 - e*Math.cos(E)); } return E; }
function orbitPos(o, tp, t, e=ECC, a=A_KM){
  let M = 2*Math.PI*((t-tp)/YEAR); M = Math.atan2(Math.sin(M),Math.cos(M));
  const E = kepler(M,e), x = a*(Math.cos(E)-e), y = a*Math.sqrt(1-e*e)*Math.sin(E);
  return [o.P[0]*x+o.Q[0]*y, o.P[1]*x+o.Q[1]*y, o.P[2]*x+o.Q[2]*y];
}
function sunVec(t){ const l=sunLon(t); return [Math.cos(l),Math.sin(l),0]; }
const cE=Math.cos(EPS), sE=Math.sin(EPS);
function eclToEq(v){ return [v[0], v[1]*cE - v[2]*sE, v[1]*sE + v[2]*cE]; }
function lst(t){ return (90 + 360.9*t)*DEG; }
function frame(t, latDeg){ const th=lst(t), ph=latDeg*DEG; return {ct:Math.cos(th), st:Math.sin(th), cp:Math.cos(ph), sp:Math.sin(ph)}; }
// equatorial -> local [East, North, Up]
function eqToLocal(v, F){
  const f0 = v[0]*F.ct + v[1]*F.st, f1 = -v[0]*F.st + v[1]*F.ct, f2 = v[2];
  return [f1, -F.sp*f0 + F.cp*f2, F.cp*f0 + F.sp*f2];
}
function altAz(L){ return {alt:Math.asin(Math.max(-1,Math.min(1,L[2])))/DEG, az:((Math.atan2(L[0],L[1])/DEG)+360)%360}; }
// area two discs of radii r1, r2 share when their centers are d apart (small angles, so flat)
function discOverlap(r1, r2, d){
  if(d >= r1 + r2) return 0;
  if(d <= Math.abs(r1 - r2)) return Math.PI*Math.min(r1, r2)**2;
  const a = Math.acos(Math.max(-1, Math.min(1, (d*d + r1*r1 - r2*r2)/(2*d*r1)))), b = Math.acos(Math.max(-1, Math.min(1, (d*d + r2*r2 - r1*r1)/(2*d*r2))));
  return r1*r1*a + r2*r2*b - 0.5*Math.sqrt(Math.max(0, (-d + r1 + r2)*(d + r1 - r2)*(d - r1 + r2)*(d + r1 + r2)));
}
// 19 points spread evenly over a disc of radius 1 (center, then rings holding equal areas)
const DISC_SAMPLES = [[0,0], ...[...Array(6)].map((_,i)=>[0.459*Math.cos(i*Math.PI/3), 0.459*Math.sin(i*Math.PI/3)]),
  ...[...Array(12)].map((_,i)=>[0.827*Math.cos((i+.5)*Math.PI/6), 0.827*Math.sin((i+.5)*Math.PI/6)])];
// shadow factor 0..1 (1 = fully lit): the share of the sun's disc the planet leaves uncovered, seen from
// points across the moon's face and averaged. Behind the end of the umbra (1.39M km) the planet can no
// longer cover the whole sun, so a moon there dims only a little (about 10% at 4.4M km).
function shadowFactor(rvec, S, bodyR=MOON_R, planetR=R_PLANET, sunR=R_SUN, sunD=D_SUN){
  const z = -dot(rvec, S); if(z <= 0) return 1;                     // distance behind the planet along the shadow's axis
  const x0 = Math.hypot(rvec[0] + S[0]*z, rvec[1] + S[1]*z, rvec[2] + S[2]*z);   // and off the axis
  if(x0 >= planetR + z*(sunR + planetR)/sunD + bodyR) return 1;    // clear of the penumbra
  const rs = sunR/(sunD + z), rp = planetR/z, sun = Math.PI*rs*rs;
  let lit = 0;
  for(const [a, b] of DISC_SAMPLES){ const x = Math.hypot(x0 + a*bodyR, b*bodyR); lit += 1 - discOverlap(rs, rp, x/z + x/(sunD + z))/sun; }
  return Math.max(0, Math.min(1, lit/DISC_SAMPLES.length));
}
// An eclipse a person could notice: Espenak finds penumbral shading visible to the eye only once two-thirds
// of the Moon's disc is inside the penumbra. ECLIPSE_SEEN is how much light Earth's Moon keeps at that point,
// by the same model; a moon dimmer than that is shown as in eclipse.
const ECLIPSE_SEEN = (()=>{ const R_E = 6371, D_M = 384400, R_M = 1737, R_S = 696000, D_S = 1.496e8;
  const pen = R_E + D_M*(R_S + R_E)/D_S;
  return shadowFactor([-D_M, pen + R_M - (2/3)*(2*R_M), 0], [1,0,0], R_M, R_E, R_S, D_S); })();
function moonState(m, t){
  const r = orbitPos(m, m.tp, t), d=Math.hypot(r[0],r[1],r[2]), S=sunVec(t);
  const u=[r[0]/d,r[1]/d,r[2]/d], cosPhi = -dot(S,u);
  return {r, d, u, cosPhi, frac:(1+cosPhi)/2, shadow:shadowFactor(r,S)};
}
const UMBRA_LEN = R_PLANET*D_SUN/(R_SUN-R_PLANET);
if (typeof module!=='undefined') module.exports={ECLIPSE_SEEN,shadowFactor,PASS_DAY,PERI_KM,makeOrbit,sunLon,MOONS,moonState,sunVec,eclToEq,frame,eqToLocal,altAz,YEAR,ECC,A_KM,orbitPos,DEG};
