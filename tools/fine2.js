const C=require('../src/core.js');const D=Math.PI/180;
const k=+process.argv[2], c=+process.argv[3], tc=+process.argv[4];
function miss(inc){const m={...C.MOONS[k]};Object.assign(m,C.makeOrbit(C.sunLon(m.tp)+Math.PI,inc,m.sgn));
 let best=9,bt=0;for(let t=tc-0.05;t<=tc+0.05;t+=0.000005){const s=C.moonState(m,t);const eq=C.eclToEq(s.u);const th=(90+360.9*t)*D;const f0=eq[0]*Math.cos(th)+eq[1]*Math.sin(th),f2=eq[2];const cc=f0*Math.cos(40*D)+f2*Math.sin(40*D);const a=Math.acos(Math.min(1,cc))/D;if(a<best){best=a;bt=t;}}return [best*69,bt];}
let b=[1e9];const R=+process.argv[5]||0.003, S=+process.argv[6]||0.0001; for(let inc=c-R;inc<=c+R;inc+=S){const [mi,t]=miss(inc);if(mi<b[0])b=[mi,inc,t];}
console.log(k,'inc',b[1].toFixed(4),'miss mi',b[0].toFixed(2),'t',b[2].toFixed(4));
