const C=require('../src/core.js');const D=Math.PI/180,DS=1.5e8,DAY=86400,E=23.4*D;
const vp=2*Math.PI*DS/(400*DAY), GM=vp*vp*DS, aObj=DS*Math.pow(1000,2/3), vo=Math.sqrt(GM*(2/DS-1/aObj));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2], nrm=a=>{const l=Math.hypot(...a);return a.map(x=>x/l)}, cr=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const Pp=t=>C.sunVec(t).map(x=>-x*DS);
const Vpl=t=>{const th=(270+0.9*t+180)*D;return [-Math.sin(th)*vp,Math.cos(th)*vp,0]};
const acc=r=>{const d=Math.hypot(...r),k=-GM/(d*d*d);return r.map(x=>x*k)};
function prop(r,v,days,steps){const h=days*DAY/steps;for(let i=0;i<steps;i++){const a1=acc(r),r2=r.map((x,j)=>x+v[j]*h/2),v2=v.map((x,j)=>x+a1[j]*h/2),a2=acc(r2),r3=r.map((x,j)=>x+v2[j]*h/2),v3=v.map((x,j)=>x+a2[j]*h/2),a3=acc(r3),r4=r.map((x,j)=>x+v3[j]*h),v4=v.map((x,j)=>x+a3[j]*h),a4=acc(r4);r=r.map((x,j)=>x+h/6*(v[j]+2*v2[j]+2*v3[j]+v4[j]));v=v.map((x,j)=>x+h/6*(a1[j]+2*a2[j]+2*a3[j]+a4[j]));}return [r,v];}
const eqToEcl=v=>[v[0],v[1]*Math.cos(E)+v[2]*Math.sin(E),-v[1]*Math.sin(E)+v[2]*Math.cos(E)];
const zen=t=>{const th=(90+360.9*t)*D, ph=40*D; return eqToEcl([Math.cos(ph)*Math.cos(th),Math.cos(ph)*Math.sin(th),Math.sin(ph)]);};
const tS=80+38+22.2/24;
function solveFull(tE){
  const vP=Vpl(tE), vh=nrm(vP), e1=nrm(cr(vh,[0,0,1])), e2=cr(vh,e1); let R={pa:1e9};
  const tryit=(s,ph)=>{const c=(vo*vo-vp*vp-s*s)/(2*vp*s); if(Math.abs(c)>1) return; const q=Math.sqrt(1-c*c),U=vh.map((x,i)=>c*x+q*(Math.cos(ph*D)*e1[i]+Math.sin(ph*D)*e2[i]));
    const [rS]=prop(Pp(tE),vP.map((x,i)=>-(x+s*U[i])),tE-tS,300); const u=nrm(rS.map((x,i)=>x-Pp(tS)[i])); const pa=Math.acos(Math.min(1,dot(u,C.sunVec(tS).map(x=>-x))))/D; if(pa<R.pa) R={s,ph,pa,U};};
  for(let s=25;s<=40;s+=0.5) for(let ph=-30;ph<=30;ph+=2) tryit(s,ph);
  const s0=R.s, p0=R.ph; for(let s=s0-0.6;s<=s0+0.6;s+=0.02) for(let ph=p0-2.5;ph<=p0+2.5;ph+=0.1) tryit(s,ph);
  return R;
}
let tE=399.69; // first guess: ~4:30 PM on the 40th
for(let it=0;it<4;it++){
  const R=solveFull(tE);
  // find evening time on day 400 when Dirole's zenith is perpendicular to the approach
  let best=null; for(let t=399.5;t<399.95;t+=0.0002){const z=dot(zen(t),R.U); if(best===null||Math.abs(z)<Math.abs(best.z)) best={t,z};}
  console.log(`iter ${it}: speed ${R.s.toFixed(2)} km/s, phase at sighting ${R.pa.toFixed(2)}°, zenith⊥approach at ${((best.t%1)*24).toFixed(2)} h (dot ${best.z.toExponential(1)})`);
  tE=best.t; if(it===3){
    const sunAlt=C.altAz(C.eqToLocal(C.eclToEq(C.sunVec(tE)),C.frame(tE,40))).alt;
    console.log('pass time', ((tE%1)*24).toFixed(3),'h; sun altitude at Dirole then',sunAlt.toFixed(1));
    require('fs').writeFileSync('amber_sol.json',JSON.stringify({tE,s:R.s,U:R.U,B:zen(tE)}));
  }
}
