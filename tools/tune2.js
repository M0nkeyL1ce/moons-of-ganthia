const C=require('../src/core.js');
const DEG=Math.PI/180, A=C.A_KM, LAT=40*DEG, cL=Math.cos(LAT), sL=Math.sin(LAT);
function track(k, rp, inc, sgn, step){
  const e=1-rp/A, tp=40*k+22.5, lp=(270+0.9*tp)*DEG+Math.PI, P=[Math.cos(lp),Math.sin(lp),0], i=inc*DEG*sgn;
  const N=[Math.sin(i)*P[1],-Math.sin(i)*P[0],Math.cos(i)];
  const Q=[N[1]*P[2]-N[2]*P[1],N[2]*P[0]-N[0]*P[2],N[0]*P[1]-N[1]*P[0]], o={P,Q};
  let best={d:9};
  for(let t=tp-2.5;t<=tp+2.5;t+=step){
    const r=C.orbitPos(o,tp,t,e,A), d=Math.hypot(...r), eq=C.eclToEq(r.map(x=>x/d));
    const th=(90+360.9*t)*DEG, f0=eq[0]*Math.cos(th)+eq[1]*Math.sin(th), f2=eq[2];
    const c=f0*cL+f2*sL; if(c>Math.cos(best.d*DEG)){const l=(270+0.9*t)*DEG; best={d:Math.acos(Math.min(1,c))/DEG,t:t-tp,lit:(1-(Math.cos(l)*r[0]+Math.sin(l)*r[1])/d)/2};}
  }
  return best;
}
const rp=+process.argv[2], k=+process.argv[3], lo=+process.argv[4], hi=+process.argv[5];
let res=[];
for(const s of [1,-1]) for(let inc=lo;inc<=hi;inc+=0.05){ const b=track(k,rp,inc,s,0.0005); if(b.d<0.05) res.push({inc:+inc.toFixed(2),s,...b}); }
res.sort((a,b)=>Math.abs(a.t)-Math.abs(b.t)||a.d-b.d); res=res.filter((h,i,arr)=>arr.findIndex(x=>Math.abs(x.inc-h.inc)<1&&x.s===h.s)===i);
console.log(`rp ${rp} moon ${k}:`, res.slice(0,6).map(h=>`inc ${h.inc} sgn ${h.s} miss ${h.d.toFixed(4)}° at ${h.t.toFixed(3)}d lit ${(h.lit*100).toFixed(0)}%`).join('\n  '));
