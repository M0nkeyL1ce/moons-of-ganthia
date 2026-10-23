const C=require('../src/core.js');const DEG=Math.PI/180,EPS=23.4*DEG,YEAR=400,D_SUN=1.5e8,R_PLANET=6371,MOON_R=806;
const src=require('fs').readFileSync(''+require('path').join(__dirname,'../src/app.js')+'','utf8');
const blk=src.slice(src.indexOf('const AMBER = {'),src.indexOf('// one brightness scale'));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], shadowFactor=()=>1;
const state={lure:0,year:9179,t:0};
const f=new Function('state','dot','shadowFactor','sunVec','sunLon','DEG','EPS','YEAR','D_SUN','R_PLANET','MOON_R', blk+';return {amberState,amberMag,AMB_TAB};');
const A=f(state,dot,shadowFactor,C.sunVec,C.sunLon,DEG,EPS,YEAR,D_SUN,R_PLANET,MOON_R);
console.log('table holes:',A.AMB_TAB.filter(x=>!x).length,'of',A.AMB_TAB.length);
const where=(t)=>{const s=A.amberState(t);const L=C.eqToLocal(C.eclToEq(s.u),C.frame(t,40));return {s,aa:C.altAz(L)};};
for(const [lab,t,y] of [['1st Black',0.9,9179],['39th Green 10:13PM',118.926,9179],['1st Red 9PM',200.875,9179],['1st Silver 8PM',240.83,9179],['1st White 6PM',320.75,9179],['1st Violet 6PM',360.75,9179],['20th Violet 6PM',379.75,9179],['38th Violet 5PM',397.71,9179],['40th 2PM',399.583,9179],['40th 4PM',399.666,9179],['40th 5PM',399.708,9179],['40th 8PM',399.833,9179],['1st Black 9180 6AM',0.25,9180],['10th Black 9180',9.9,9180]]){
  state.year=y; state.t=t; const {s,aa}=where(t); const el=Math.acos(dot(C.sunVec(t),s.u))/DEG;
  console.log(lab.padEnd(20),(s.d<1e7?(s.d/1e3).toFixed(0)+'k':(s.d/1e6).toFixed(0)+'M').padStart(6),'km lit',(s.frac*100|0).toString().padStart(3)+'%',el.toFixed(0).padStart(4)+'° from sun  alt',aa.alt.toFixed(0).padStart(4),'az',aa.az.toFixed(0).padStart(4),' mag',A.amberMag(s).toFixed(1));
}
