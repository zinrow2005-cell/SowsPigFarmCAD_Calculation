/* V2.0.4 – CAD geometry audit; no legal or survey certification. */
(()=>{'use strict';
const $=id=>document.getElementById(id),svg=$('cadSvg'),model=window.HUWEI_CAD_MODEL;
if(!model||!svg||!$('auditOpen')||!$('facilityAuditPanel'))return;
const ns='http://www.w3.org/2000/svg',ids=Array.from({length:6},(_,i)=>`p1230_zone${i+1}`);
const regions=()=>ids.map(id=>model.regions.find(r=>r.id===id)).filter(Boolean),parcel=()=>window.HUWEI_PARCELS?.getData?.().find(r=>r.id==='p1230')?.points||[];
const fmt=n=>Number(n).toFixed(2),area=p=>Math.abs(p.reduce((s,v,i)=>{const q=p[(i+1)%p.length];return s+v[0]*q[1]-v[1]*q[0]},0))/2;
const signedArea=p=>p.reduce((s,v,i)=>{const q=p[(i+1)%p.length];return s+v[0]*q[1]-q[0]*v[1]},0)/2;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
function inside(p,poly){let state=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i],ab=sub(b,a),ap=sub(p,a);if(Math.abs(ab[0]*ap[1]-ab[1]*ap[0])<1e-8&&dot(sub(p,a),sub(p,b))<=1e-8)return true;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])state=!state;}return state;}
function clip(subject,poly){let out=subject.map(p=>[...p]);const sign=signedArea(poly)>=0?1:-1;for(let i=0;i<poly.length&&out.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],src=out;out=[];const side=p=>sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));for(let j=0;j<src.length;j++){const p=src[j],q=src[(j+1)%src.length],sp=side(p),sq=side(q);if(sp>=-1e-8)out.push([...p]);if((sp>1e-8&&sq< -1e-8)||(sp< -1e-8&&sq>1e-8))out.push(mix(p,q,sp/(sp-sq)));}}return out;}
function segmentDistance(a,b,c,d){const u=sub(b,a),v=sub(d,c),w=sub(a,c),aa=dot(u,u),bb=dot(u,v),cc=dot(v,v),dd=dot(u,w),ee=dot(v,w),D=aa*cc-bb*bb;let sn,sd=D,tn,td=D;
if(D<1e-12){sn=0;sd=1;tn=ee;td=cc;}else{sn=bb*ee-cc*dd;tn=aa*ee-bb*dd;if(sn<0){sn=0;tn=ee;td=cc;}else if(sn>sd){sn=sd;tn=ee+bb;td=cc;}}
if(tn<0){tn=0;if(-dd<0)sn=0;else if(-dd>aa)sn=sd;else{sn=-dd;sd=aa;}}else if(tn>td){tn=td;if(-dd+bb<0)sn=0;else if(-dd+bb>aa)sn=sd;else{sn=-dd+bb;sd=aa;}}
const s=Math.abs(sn)<1e-12?0:sn/sd,t=Math.abs(tn)<1e-12?0:tn/td,p=mix(a,b,s),q=mix(c,d,t);return {d:Math.hypot(p[0]-q[0],p[1]-q[1]),p,q};}
function polyDist(a,b){let best={d:Infinity,p:null,q:null};for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){const candidate=segmentDistance(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]);if(candidate.d<best.d)best=candidate;}return best;}
function record(type,level,label,value,point,other){return {type,level,label,value,point,other};}
function scan(){const facility=regions(),border=parcel();if(border.length<3)return {rows:[],error:'無法讀取 1230 地籍參考外框'};
const minGap=Math.max(0,Number($('auditMinGap').value)||0),minPath=Math.max(0,Number($('auditMinPath').value)||0),rows=[];
for(const r of facility){const p=r.points;if(p.length<3||p.some(v=>!v.every(Number.isFinite))){rows.push(record('bad','bad',r.name+'：座標異常',null,null));continue;}
 const clipped=clip(p,border),outside=Math.max(0,area(p)-(clipped.length>2?area(clipped):0));if(outside>1e-5||!p.every(v=>inside(v,border)))rows.push(record('outside','bad',r.name+'：超出地籍參考外框',outside, p[0],null));
 const near=polyDist(p,border);if(outside<=1e-5&&near.d<1e-5)rows.push(record('border-touch','ok',r.name+'：貼齊參考地界（非越界）',0,near.p,near.q));else if(near.d<minGap-1e-7&&outside<=1e-5)rows.push(record('border','warn',r.name+' ↔ 地界，最短距離',near.d,near.p,near.q));
 }
for(let i=0;i<facility.length;i++)for(let j=i+1;j<facility.length;j++){
 const a=facility[i],b=facility[j],intr=clip(a.points,b.points),overlap=intr.length>=3?area(intr):0;
 if(overlap>1e-5){rows.push(record('overlap','bad',a.name+' ↔ '+b.name+'：重疊面積',overlap,intr[0],null));continue;}
 const near=polyDist(a.points,b.points);
 if(near.d<1e-5){rows.push(record('touch','ok',a.name+' ↔ '+b.name+'：相接／共牆',0,near.p,near.q));continue;}
 if(near.d<minGap-1e-7)rows.push(record('facility','warn',a.name+' ↔ '+b.name+'：最短間距',near.d,near.p,near.q));
 }
// Channel check uses a fixed east boundary only where it is actually vertical, and samples building's east silhouette.
const eastEdges=border.map((a,i)=>[a,border[(i+1)%border.length]]).filter(([a,b])=>Math.abs(a[0]-b[0])<1e-6&&Math.abs(a[1]-b[1])>2);
for(const r of facility){for(const [a,b] of eastEdges){const ylo=Math.min(a[1],b[1]),yhi=Math.max(a[1],b[1]);const pts=[];for(let i=0;i<r.points.length;i++){const p=r.points[i],q=r.points[(i+1)%r.points.length];if(p[1]>=ylo&&p[1]<=yhi)pts.push(p);for(const y of [ylo,yhi])if((p[1]-y)*(q[1]-y)<0)pts.push(mix(p,q,(y-p[1])/(q[1]-p[1])));}if(!pts.length)continue;const eastern=pts.reduce((v,p)=>p[0]>v[0]?p:v);if(eastern[0]>a[0]+1e-5)continue;const gap=a[0]-eastern[0];if(gap<1e-5)rows.push(record('path-touch','ok',r.name+'：東側貼界，無水平餘寬',0,eastern,[a[0],eastern[1]]));else if(gap<minPath-1e-7)rows.push(record('path','warn',r.name+' ↔ 東側地界：水平餘寬（非淨通道寬）',gap,eastern,[a[0],eastern[1]]));}}
rows.sort((a,b)=>({bad:0,warn:1,ok:2}[a.level]-{bad:0,warn:1,ok:2}[b.level])||(a.value??999)-(b.value??999));
return {rows,facilityCount:facility.length,covered:facility.reduce((s,r)=>s+area(r.points),0),minGap,minPath};}
const overlay=document.createElementNS(ns,'g');overlay.id='facilityAuditOverlay';overlay.setAttribute('pointer-events','none');svg.append(overlay);
let active=false;function draw(rows){overlay.replaceChildren();if(!active||!$('auditShowMarks').checked)return;const scale=Math.hypot(svg.getScreenCTM()?.a||1,svg.getScreenCTM()?.b||0)||1;let count=0;for(const r of rows){if(r.level==='ok'||!r.point||count++>=30)continue;const color=r.level==='bad'?'#cb514c':'#b3822d';if(r.other){const path=document.createElementNS(ns,'line');for(const [k,v] of Object.entries({x1:r.point[0],y1:r.point[1],x2:r.other[0],y2:r.other[1],stroke:color,'class':'audit-pin-line','stroke-dasharray':'4 3'}))path.setAttribute(k,String(v));overlay.append(path);}const c=document.createElementNS(ns,'circle');for(const [k,v] of Object.entries({cx:r.point[0],cy:r.point[1],r:5/scale,fill:color,stroke:'#fff','stroke-width':1.5/scale}))c.setAttribute(k,String(v));overlay.append(c);}}
function render(){if(!active)return;const result=scan(),summary=$('auditSummary'),list=$('auditResults');if(result.error){summary.textContent=result.error;summary.classList.add('alert');return;}
const bad=result.rows.filter(r=>r.level==='bad').length,warn=result.rows.filter(r=>r.level==='warn').length,touch=result.rows.filter(r=>r.level==='ok').length;
summary.classList.toggle('alert',bad+warn>0);summary.textContent=`${bad} 項重疊／超界 · ${warn} 項警示 · ${touch} 項相接／貼界資訊｜設施幾何面積合計 ${fmt(result.covered)} m²`;
list.replaceChildren();if(!result.rows.length){const d=document.createElement('div');d.className='audit-row';d.textContent='按目前設定的警示門檻，沒有發現配置問題。';list.append(d);}
for(const r of result.rows){const box=document.createElement('div');box.className='audit-row '+(r.level==='bad'?'bad':r.level==='warn'?'warn':'');const title=document.createElement('strong');title.textContent=(r.level==='bad'?'● 問題｜':r.level==='warn'?'△ 警示｜':'○ 資訊｜')+r.label;box.append(title);if(r.value!==null&&Number.isFinite(r.value)){const val=document.createElement('div');val.className='audit-value';val.textContent=fmt(r.value)+(r.type==='overlap'||r.type==='outside'?' m²':' m');box.append(val);}if(r.type==='path'||r.type==='path-touch'){const note=document.createElement('small');note.textContent='僅計算與東側參考地界的水平餘寬，非已驗證的可通行淨寬';box.append(note);}list.append(box);}
draw(result.rows);}
function setActive(value){active=value;$('facilityAuditPanel').hidden=!active;$('auditOpen').setAttribute('aria-pressed',String(active));$('auditOpen').classList.toggle('primary',active);if(!active)overlay.replaceChildren();else render();}
$('auditOpen').addEventListener('click',()=>setActive(!active));$('auditClose').addEventListener('click',()=>setActive(false));
for(const id of ['auditMinGap','auditMinPath']){$(id).addEventListener('input',()=>{const num=Number($(id).value);if(num>=0&&num<=20){try{localStorage.setItem('huwei-'+id,JSON.stringify(num));}catch(_){}}render();});try{const stored=JSON.parse(localStorage.getItem('huwei-'+id));if(typeof stored==='number'&&stored>=0&&stored<=20)$(id).value=stored;}catch(_){}}
$('auditShowMarks').addEventListener('change',render);
window.addEventListener('huwei:facility-updated',render);
window.HUWEI_FACILITY_AUDIT={scan,refresh:render};
})();
