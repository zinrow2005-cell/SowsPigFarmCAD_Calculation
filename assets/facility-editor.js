/* V2.2.1 - editable planning geometry (original DXF remains immutable). */
(()=>{'use strict';
const $=id=>document.getElementById(id),svg=$('cadSvg'),panel=$('editorPanel'),ns='http://www.w3.org/2000/svg';
if(!svg||!panel||!window.HUWEI_CAD_MODEL||!window.HUWEI_EDITOR_UPDATE)return;
const model=window.HUWEI_CAD_MODEL,ids=Array.from({length:6},(_,i)=>'p1230_zone'+(i+1)),regions=ids.map(id=>model.regions.find(r=>r.id===id)),defaults=Object.fromEntries(regions.map(r=>[r.id,r.points.map(p=>[...p])]));
const storageKey='huwei-cad-facility-plans-v225-'+model.sha256.slice(0,14),fmt=n=>(+n).toFixed(2);
const polygonArea=poly=>Math.abs(poly.reduce((s,p,i)=>{const q=poly[(i+1)%poly.length];return s+p[0]*q[1]-p[1]*q[0]},0))/2;
const centroid=poly=>[poly.reduce((s,p)=>s+p[0],0)/poly.length,poly.reduce((s,p)=>s+p[1],0)/poly.length];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const inside=(p,poly)=>{let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];const cross=(p[0]-b[0])*(a[1]-b[1])-(p[1]-b[1])*(a[0]-b[0]);if(Math.abs(cross)<1e-7&&p[0]>=Math.min(a[0],b[0])-1e-7&&p[0]<=Math.max(a[0],b[0])+1e-7&&p[1]>=Math.min(a[1],b[1])-1e-7&&p[1]<=Math.max(a[1],b[1])+1e-7)return true;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
const signedArea=p=>p.reduce((s,q,i)=>{const r=p[(i+1)%p.length];return s+q[0]*r[1]-r[0]*q[1]},0)/2;
function intersection(subject,clip){let output=subject.map(p=>[...p]);const sign=signedArea(clip)>0?1:-1;for(let i=0;i<clip.length;i++){const a=clip[i],b=clip[(i+1)%clip.length],input=output;output=[];if(!input.length)break;const side=p=>sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));const intersect=(p,q)=>{const s1=side(p),s2=side(q),t=s1/(s1-s2);return [p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])];};for(let j=0;j<input.length;j++){const p=input[j],q=input[(j+1)%input.length],sp=side(p),sq=side(q);if(sp>=-1e-9)output.push([...p]);if((sp>=0&&sq<0)||(sp<0&&sq>=0))output.push(intersect(p,q));}}return output;}
const parcel=()=>window.HUWEI_PARCELS?.getData?.().find(r=>r.id==='p1230')?.points;
let active=false,current=ids[0],history=[],drag=null;
const touchPointers=new Set();
const el=(tag,attrs,host)=>{const x=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))x.setAttribute(k,String(v));host.append(x);return x;};
const layer=el('g',{id:'facilityEditOverlay'},svg),status=(txt,error=false)=>{const e=$('editorInfo');e.textContent=txt;e.classList.toggle('warning',error);};
function validate(poly,id){if(poly.length!==4||poly.some(p=>!p.every(Number.isFinite))||polygonArea(poly)<.04)return '尺寸或座標無效';const boundary=parcel();if(boundary&&!poly.every(p=>inside(p,boundary)))return '超出1230地籍參考外框，已取消';for(const r of regions){if(r.id===id)continue;const clip=intersection(poly,r.points);if(clip.length>=3&&polygonArea(clip)>1e-5)return '與「'+r.name+'」重疊 '+fmt(polygonArea(clip))+' m²，已取消';}return null;}
function currentRegion(){return model.regions.find(r=>r.id===current);}
function props(poly){const c=centroid(poly),w=distance(poly[0],poly[1]),h=distance(poly[1],poly[2]),angle=Math.atan2(poly[1][1]-poly[0][1],poly[1][0]-poly[0][0])*180/Math.PI;return {c,w,h,angle};}
function drawControls(){const {w,h,angle}=props(currentRegion().points);$('editorWidth').value=fmt(w);$('editorHeight').value=fmt(h);$('editorAngle').value=(Math.round(angle*10)/10).toString();$('editorDx').value='0';$('editorDy').value='0';status(currentRegion().name+'｜面積 '+fmt(polygonArea(currentRegion().points))+' m²；可在圖上拖曳，或輸入尺寸後套用。');}
function polyStr(poly){return poly.map(q=>q.join(',')).join(' ');}
function render(){layer.replaceChildren();if(!active)return;const p=currentRegion().points;const handle=el('polygon',{points:polyStr(p),class:'editor-handle','data-editor-handle':current},layer);handle.setAttribute('aria-label','拖曳移動'+currentRegion().name);if(drag?.preview)el('polygon',{points:polyStr(drag.preview),class:'editor-preview'},layer);}
function select(id){if(!ids.includes(id))return;current=id;$('editorFacility').value=id;drawControls();render();window.dispatchEvent(new CustomEvent('huwei:editor-selection',{detail:{id}}));}
function apply(id,poly,record=true){const bad=validate(poly,id);if(bad){status(bad,true);return false;}const previous=model.regions.find(r=>r.id===id).points.map(p=>[...p]);if(record){history.push({id,points:previous});if(history.length>40)history.shift();}window.HUWEI_EDITOR_UPDATE(id,poly);const now=model.regions.find(r=>r.id===id);if(now){now.labelPoint=centroid(poly);}const stored=persist();render();drawControls();if(!stored)warnUnsaved();window.dispatchEvent(new CustomEvent('huwei:facility-updated',{detail:{id}}));return true;}
function persist(){try{const plan=Object.fromEntries(regions.map(r=>[r.id,r.points]));const value=JSON.stringify({v:1,source:model.sha256,plan});localStorage.setItem(storageKey,value);return localStorage.getItem(storageKey)===value;}catch(e){return false;}}
function warnUnsaved(){status('無法寫入本機資料：目前圖面可繼續操作，但重新整理可能遺失。請開啟「方案比較」匯出備份 JSON，並檢查瀏覽器可用空間。',true);}
function setActive(on){active=on;panel.hidden=!on;$('editorOpen').setAttribute('aria-pressed',String(on));$('editorOpen').classList.toggle('primary',on);$('editorOpen').textContent=on?'✕ 離開配置':'✥ 配置編輯';if(on){if($('measureOpen')?.getAttribute('aria-pressed')==='true')$('measureOpen').click();if($('toggleCoverage')?.getAttribute('aria-pressed')==='true')$('toggleCoverage').click();const s=window.HUWEI_GET_SELECTION?.();if(ids.includes(s?.selectedId))current=s.selectedId;drawControls();}render();}
for(const r of regions){const option=document.createElement('option');option.value=r.id;option.textContent=r.name;$('editorFacility').append(option);}
$('editorOpen').onclick=()=>setActive(!active);$('editorClose').onclick=()=>setActive(false);$('editorFacility').onchange=e=>select(e.target.value);
$('editorApply').onclick=()=>{if(['editorWidth','editorHeight','editorAngle','editorDx','editorDy'].some(id=>$(id).value.trim()==='')){status('數值不可留白，請填入尺寸、角度及位移（無位移請填 0）。',true);return;}const r=currentRegion(),p=props(r.points);const w=Number($('editorWidth').value),h=Number($('editorHeight').value),a=Number($('editorAngle').value),dx=Number($('editorDx').value),dy=Number($('editorDy').value);if(![w,h,a,dx,dy].every(Number.isFinite)||w<.2||h<.2||w>100||h>100||Math.abs(dx)>100||Math.abs(dy)>100||Math.abs(a)>3600){status('請輸入有效的尺寸、角度與位移',true);return;}const rad=a*Math.PI/180,u=[Math.cos(rad),Math.sin(rad)],dir=(signedArea(r.points)>0?1:-1),v=[-u[1]*dir,u[0]*dir];const c=[p.c[0]+dx,p.c[1]+dy],p0=[c[0]-u[0]*w/2-v[0]*h/2,c[1]-u[1]*w/2-v[1]*h/2];const poly=[p0,[p0[0]+u[0]*w,p0[1]+u[1]*w],[p0[0]+u[0]*w+v[0]*h,p0[1]+u[1]*w+v[1]*h],[p0[0]+v[0]*h,p0[1]+v[1]*h]];apply(current,poly);};
$('editorUndo').onclick=()=>{const last=history.pop();if(!last){status('目前沒有可復原的修改');return;}if(last.plan){for(const id of ids)window.HUWEI_EDITOR_UPDATE(id,last.plan[id]);}else{window.HUWEI_EDITOR_UPDATE(last.id,last.points);current=last.id;$('editorFacility').value=current;}const stored=persist();drawControls();render();if(!stored)warnUnsaved();window.dispatchEvent(new CustomEvent('huwei:facility-updated',{detail:{undo:true}}));};
$('editorReset').onclick=()=>{if(!confirm('還原六項設施為 V2.2.5 合併隔離舍配置？目前的修改將由上一步紀錄保留。'))return;history.push({plan:snapshot()});if(history.length>40)history.shift();for(const id of ids)window.HUWEI_EDITOR_UPDATE(id,defaults[id]);const stored=persist();drawControls();render();if(stored)status('已還原 V2.2.5 預設規劃位置。');else warnUnsaved();window.dispatchEvent(new CustomEvent('huwei:facility-updated',{detail:{reset:true}}));};
function svgPoint(e){const m=svg.getScreenCTM();if(!m)return [0,0];const q=svg.createSVGPoint();q.x=e.clientX;q.y=e.clientY;const p=q.matrixTransform(m.inverse());return [p.x,p.y];}
svg.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')touchPointers.add(e.pointerId);if(touchPointers.size>1&&drag){drag=null;render();}if(!active||touchPointers.size>1||e.button!==0||!e.target.closest?.('[data-editor-handle]'))return;const id=e.target.closest('[data-editor-handle]').dataset.editorHandle;if(id!==current)return;e.preventDefault();e.stopImmediatePropagation();drag={id,pointerId:e.pointerId,start:svgPoint(e),base:currentRegion().points.map(p=>[...p]),preview:null};svg.setPointerCapture?.(e.pointerId);},true);
svg.addEventListener('pointermove',e=>{if(touchPointers.size>1||!drag||e.pointerId!==drag.pointerId)return;e.stopImmediatePropagation();const q=svgPoint(e),dx=q[0]-drag.start[0],dy=q[1]-drag.start[1];drag.preview=drag.base.map(p=>[p[0]+dx,p[1]+dy]);render();},true);
svg.addEventListener('pointerup',e=>{touchPointers.delete(e.pointerId);if(!drag||e.pointerId!==drag.pointerId)return;e.preventDefault();e.stopImmediatePropagation();const d=drag;drag=null;if(d.preview)apply(d.id,d.preview);render();},true);
svg.addEventListener('pointercancel',e=>{touchPointers.delete(e.pointerId);if(drag?.pointerId===e.pointerId){drag=null;render();}},true);
svg.addEventListener('lostpointercapture',e=>{touchPointers.delete(e.pointerId);if(drag?.pointerId===e.pointerId){drag=null;render();}},true);
window.addEventListener('blur',()=>{touchPointers.clear();drag=null;render();});
svg.addEventListener('click',e=>{if(!active)return;const hit=e.target.closest?.('[data-region]');if(hit&&ids.includes(hit.dataset.region)){select(hit.dataset.region);e.stopImmediatePropagation();e.preventDefault();return;}if(e.target.closest?.('[data-editor-handle]')){e.stopImmediatePropagation();e.preventDefault();}},true);
window.addEventListener('keydown',e=>{if(active&&e.key==='Escape')setActive(false);});
// Public planning snapshot and atomic plan switch: the underlying DXF and original defaults are unchanged.
function snapshot(){return Object.fromEntries(ids.map(id=>[id,model.regions.find(r=>r.id===id).points.map(q=>[...q])]));}
function validatePlan(plan){
 if(!plan||typeof plan!=='object')return {ok:false,error:'方案資料不存在'};
 for(const id of ids){const p=plan[id];if(!Array.isArray(p)||p.length!==4||p.some(q=>!Array.isArray(q)||q.length!==2||!q.every(Number.isFinite))||polygonArea(p)<.04)return {ok:false,error:'方案中的 '+id+' 座標或尺寸無效'};const border=parcel();if(border&&!p.every(q=>inside(q,border)))return {ok:false,error:id+' 超出 1230 參考邊界'};}
 for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const overlap=intersection(plan[ids[i]],plan[ids[j]]);if(overlap.length>=3&&polygonArea(overlap)>1e-5)return {ok:false,error:'方案內 '+ids[i]+' 與 '+ids[j]+' 重疊'};}
 return {ok:true};
}
function loadPlan(plan,options={}){
 const validity=validatePlan(plan);if(!validity.ok)return validity;
 const before=snapshot(),prevHistory=history.slice();
 try{
  for(const id of ids)if(window.HUWEI_EDITOR_UPDATE(id,plan[id])!==true)throw Error(id+' 圖面更新失敗');
  if(options.persist!==false&&!persist())throw Error('本機儲存失敗，圖面已還原先前配置');
 }catch(e){for(const id of ids)window.HUWEI_EDITOR_UPDATE(id,before[id]);history=prevHistory;drawControls();render();warnUnsaved();return {ok:false,error:e.message||'配置切換失敗'};}
 history=[];drawControls();render();window.dispatchEvent(new CustomEvent('huwei:facility-updated',{detail:{scenario:true}}));return {ok:true};
}
window.HUWEI_FACILITY_EDITOR={snapshot,loadPlan,validatePlan,defaults:()=>JSON.parse(JSON.stringify(defaults)),ids:[...ids]};
// Restore only known, finite planning coordinates and only if still inside land and collision-free.
try{const data=JSON.parse(localStorage.getItem(storageKey)||'null');if(data?.source===model.sha256&&data?.v===1){const plan=data.plan,border=parcel();let valid=!!plan;for(const id of ids){const poly=plan?.[id];if(!Array.isArray(poly)||poly.length!==4||poly.some(q=>!Array.isArray(q)||q.length!==2||!q.every(Number.isFinite))||polygonArea(poly)<.04||(border&&!poly.every(q=>inside(q,border)))){valid=false;break;}}if(valid)for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const cut=intersection(plan[ids[i]],plan[ids[j]]);if(cut.length>=3&&polygonArea(cut)>1e-5)valid=false;}if(valid)for(const id of ids)window.HUWEI_EDITOR_UPDATE(id,plan[id]);}}catch(e){}
})();
