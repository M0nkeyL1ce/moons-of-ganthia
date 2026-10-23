const C=require('../src/core.js');const D=Math.PI/180;
// verify Dirole on both ley lines
for(const k of [0,5]){const m=C.MOONS[k];let best=9,bt=0;for(let t=m.tp-2.5;t<=m.tp+2.5;t+=0.0002){const s=C.moonState(m,t);const eq=C.eclToEq(s.u);const th=(90+360.9*t)*D;const f0=eq[0]*Math.cos(th)+eq[1]*Math.sin(th),f2=eq[2];const a=Math.acos(Math.min(1,f0*Math.cos(40*D)+f2*Math.sin(40*D)))/D;if(a<best){best=a;bt=t;}}
console.log(m.name,'passes',(best*69).toFixed(2),'miles from Dirole at day',Math.floor(bt)+1,'hour',((bt%1)*24).toFixed(2));}
for(const m of C.MOONS){let mn=1,mx=0;for(let t=0;t<400;t+=0.5){const f=C.moonState(m,t).frac;mn=Math.min(mn,f);mx=Math.max(mx,f);}let first=null,last=null;for(let t=m.tp-1;t<m.tp+1;t+=1/1440){if(C.moonState(m,t).shadow<1){if(first===null)first=t;last=t;}}console.log(m.name.padEnd(7),'lit range',(mn*100|0)+'-'+(mx*100|0),' eclipse hrs',first===null?0:((last-first)*24).toFixed(1));}
