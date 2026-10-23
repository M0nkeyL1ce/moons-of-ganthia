// ---- Ganthian sky core (pure math) ----
const DEG = Math.PI/180;
const YEAR = 400, EPS = 23.4*DEG;
const A_KM = 2.30e6, PERI_KM = 1.78e5, ECC = 1 - PERI_KM/A_KM, MOON_R = 806; // 1/10 the volume of Earth's Moon (1737 km × 0.1^(1/3))
const R_PLANET = 6371, R_SUN = 696000, D_SUN = 1.5e8;
const MOONS = [
  {key:'black',  name:'Black',  month:'Blackmoon',  school:'Necromancy',    color:[52,47,62],   rim:[160,140,205], inc:49.714, sgn: 1, present:true},
  {key:'blue',   name:'Blue',   month:'Bluemoon',   school:'Transmutation', color:[86,148,240], inc:18, sgn:-1, present:true},
  {key:'green',  name:'Green',  month:'Greenmoon',  school:'Conjuration',   color:[92,196,112], inc:40, sgn: 1, present:true},
  {key:'gold',   name:'Gold',   month:'Goldmoon',   school:'Abjuration',    color:[243,200,80], inc:75, sgn:-1, present:true},
  {key:'fifth',  name:'Amber',  month:'Fifthmoon',  school:'(lost)',        color:[255,150,50], inc:30, sgn: 1, present:false},
  {key:'red',    name:'Red',    month:'Redmoon',    school:'Evocation',     color:[236,78,64],  inc:52.994, sgn: 1, present:true},
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
MOONS.forEach((m,k)=>{ m.tp = 40*k + 22.5; Object.assign(m, makeOrbit(sunLon(m.tp)+Math.PI, m.inc, m.sgn)); });
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
// shadow factor 0..1 (1 = fully lit by sun)
function shadowFactor(rvec, S){
  const d=Math.hypot(rvec[0],rvec[1],rvec[2]); const u=[rvec[0]/d,rvec[1]/d,rvec[2]/d];
  const sep=Math.acos(Math.max(-1,Math.min(1,-dot(u,S))));
  const um=(R_PLANET - d*(R_SUN-R_PLANET)/D_SUN)/d, pen=(R_PLANET + d*(R_SUN+R_PLANET)/D_SUN)/d, mr=MOON_R/d;
  if(sep >= pen+mr) return 1;
  if(um>0 && sep <= um-mr) return 0;
  const lo = Math.max(0, um), x=(sep - lo)/((pen+mr)-lo);
  return Math.max(0,Math.min(1,x));
}
function moonState(m, t){
  const r = orbitPos(m, m.tp, t), d=Math.hypot(r[0],r[1],r[2]), S=sunVec(t);
  const u=[r[0]/d,r[1]/d,r[2]/d], cosPhi = -dot(S,u);
  return {r, d, u, cosPhi, frac:(1+cosPhi)/2, shadow:shadowFactor(r,S)};
}
const UMBRA_LEN = R_PLANET*D_SUN/(R_SUN-R_PLANET);
if (typeof module!=='undefined') module.exports={PERI_KM,makeOrbit,sunLon,MOONS,moonState,sunVec,eclToEq,frame,eqToLocal,altAz,YEAR,ECC,A_KM,orbitPos,DEG};
