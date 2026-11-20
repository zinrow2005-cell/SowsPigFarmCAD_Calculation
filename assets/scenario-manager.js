/* V2.2.1 - 1230 facility layout scenarios. No original DXF modifications. */
(()=>{'use strict';
const $=id=>document.getElementById(id),api=window.HUWEI_FACILITY_EDITOR,model=window.HUWEI_CAD_MODEL;
if(!api||!model||!$('scenarioPanel'))return;
const ids=api.ids,storageKey='huwei-cad-scenarios-v225-'+String(model.sha256).slice(0,14),fmt=n=>Number(n).toFixed(2);
const clone=x=>JSON.parse(JSON.stringify(x)),area=p=>Math.abs(p.reduce((sum,q,i)=>{const r=p[(i+1)%p.length];return sum+q[0]*r[1]-q[1]*r[0]},0))/2;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
function segDist(a,b,c,d){const u=sub(b,a),v=sub(d,c),w=sub(a,c),aa=dot(u,u),bb=dot(u,v),cc=dot(v,v),dd=dot(u,w),ee=dot(v,w),D=aa*cc-bb*bb;let sn,sd=D,tn,td=D;
if(D<1e-12){sn=0;sd=1;tn=ee;td=cc;}else{sn=bb*ee-cc*dd;tn=aa*ee-bb*dd;if(sn<0){sn=0;tn=ee;td=cc;}else if(sn>sd){sn=sd;tn=ee+bb;td=cc;}}
if(tn<0){tn=0;if(-dd<0)sn=0;else if(-dd>aa)sn=sd;else{sn=-dd;sd=aa;}}else if(tn>td){tn=td;if(-dd+bb<0)sn=0;else if(-dd+bb>aa)sn=sd;else{sn=-dd+bb;sd=aa;}}
const t=Math.abs(tn)<1e-12?0:tn/td,s=Math.abs(sn)<1e-12?0:sn/sd;const p=mix(a,b,s),q=mix(c,d,t);return Math.hypot(p[0]-q[0],p[1]-q[1]);}
function dist(a,b){let v=Infinity;for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)v=Math.min(v,segDist(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]));return v;}
function dataMetrics(plan){
 const polys=ids.map(id=>plan[id]),sum=polys.reduce((acc,p)=>acc+area(p),0);
 const minGapValue=Math.max(0,Number($('auditMinGap')?.value)||1),pairs=[];
 for(let i=0;i<polys.length;i++)for(let j=i+1;j<polys.length;j++)pairs.push(dist(polys[i],polys[j]));
 const separated=pairs.filter(d=>Number.isFinite(d)&&d>1e-5),min=separated.length?Math.min(...separated):null;
 const touch=pairs.filter(d=>d<=1e-5).length,short=pairs.filter(d=>d>1e-5&&d<minGapValue).length;
 const parcelFree=676-sum,allCover=3507.75+sum,freePct=(4765-allCover)/4765*100;
 return {sum,parcelFree,allCover,freePct,allowance:4765*.8-allCover,min,touch,short};
}
function validPlan(plan){return api.validatePlan(plan).ok;}
function makeId(){return 'scheme_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);}
let records=[],selected='',active='',loaded=false,storageOk=true;
function persist(){try{const value=JSON.stringify({version:1,source:model.sha256,records,selected,active});localStorage.setItem(storageKey,value);if(localStorage.getItem(storageKey)!==value)throw Error('本機儲存驗證失敗');storageOk=true;return true;}catch(e){storageOk=false;report('本機儲存失敗或遭瀏覽器封鎖，請先匯出 JSON 備份',true);return false;}}
function report(message,warning=false){const el=$('scenarioState');el.textContent=message;el.classList.toggle('warn',warning);}
// Keep memory and disk consistent: failed writes must never silently look saved.
function commit(update){
 const before={records:clone(records),selected,active};
 try{update();if(persist())return true;}
 catch(e){report('方案操作失敗，原方案已保留：'+(e?.message||'資料格式錯誤'),true);}
 records=before.records;selected=before.selected;active=before.active;
 return false;
}

function lookup(id){return records.find(r=>r.id===id);}
function dirty(){const r=lookup(active);return r&&JSON.stringify(r.plan)!==JSON.stringify(api.snapshot());}
function label(r){return r.name+(r.id===active?'（目前方案）':'');}
function repop(){for(const field of ['scenarioSelect','scenarioCompareA','scenarioCompareB']){const el=$(field),previous=el.value;el.replaceChildren();for(const r of records){const opt=document.createElement('option');opt.value=r.id;opt.textContent=label(r);el.append(opt);}el.value=field==='scenarioSelect'?selected:previous;if(!el.value||!lookup(el.value))el.value=records[0]?.id||'';}
 if(records.length>=2&&$('scenarioCompareA').value===$('scenarioCompareB').value)$('scenarioCompareB').value=records.find(r=>r.id!==$('scenarioCompareA').value)?.id||records[0].id;
 renderCompare();}
function renderCompare(){const a=lookup($('scenarioCompareA').value),b=lookup($('scenarioCompareB').value);const box=$('scenarioCompareTable');box.replaceChildren();if(!a||!b)return;const A=dataMetrics(a.plan),B=dataMetrics(b.plan),rows=[['1230 設施面積','sum','m²',false],['1230 空地（未扣其他）','parcelFree','m²',true],['合併遮蔽試算','allCover','m²',false],['合併空地比','freePct','%',true],['距 80% 上限','allowance','m²',true],['最短非接觸間距','min','m',true],['相接／共牆組數','touch','組',false],['低於設施間距門檻組數','short','組',false]];
 const table=document.createElement('table'),thead=document.createElement('thead'),hr=document.createElement('tr');for(const v of ['比較項目','A','B','B − A']){const th=document.createElement('th');th.textContent=v;hr.append(th);}thead.append(hr);table.append(thead);const tbody=document.createElement('tbody');for(const [name,key,unit,more] of rows){const tr=document.createElement('tr');const delta=(B[key]??0)-(A[key]??0);const display=x=>x===null?'—':fmt(x)+' '+unit;for(const value of [name,display(A[key]),display(B[key]),A[key]===null||B[key]===null?'—':(delta>0?'+':'')+fmt(delta)+' '+unit]){const td=document.createElement('td');td.textContent=value;tr.append(td);}if(A[key]!==null&&B[key]!==null&&Math.abs(delta)>.001){tr.lastChild.className=more?(delta>0?'scenario-positive':'scenario-negative'):(delta<0?'scenario-positive':'scenario-negative');}tbody.append(tr);}table.append(tbody);box.append(table);const info=document.createElement('small');info.textContent='最短非接觸間距已排除 0 m 的相接／共牆；門檻取「配置檢查」中的設施間距設定（目前 '+fmt(Math.max(0,Number($('auditMinGap')?.value)||1))+' m）。這不是可通行淨寬；完整警示請套用方案後檢查。';box.append(info);}
function refresh(){repop();const cur=lookup(active);report(!storageOk?'本機儲存不可用：請立即備份 JSON，重新開啟後資料可能遺失。':cur?(dirty()?'目前配置有尚未存入「'+cur.name+'」的修改':'目前配置：「'+cur.name+'」已儲存'):'目前配置未關聯任何方案',!storageOk||!!dirty());}
function ensure(){if(loaded)return;loaded=true;try{const data=JSON.parse(localStorage.getItem(storageKey)||'null');if(data?.version===1&&data.source===model.sha256&&Array.isArray(data.records)){
 records=data.records.filter(r=>r&&typeof r.id==='string'&&typeof r.name==='string'&&r.name.trim()&&validPlan(r.plan)).slice(0,40).map(r=>({id:r.id,name:r.name.slice(0,70),plan:clone(r.plan),updated:r.updated||''}));selected=data.selected;active=data.active;}}
 catch(e){}if(!records.length){const id=makeId();records=[{id,name:'目前配置',plan:api.snapshot(),updated:new Date().toISOString()}];selected=active=id;persist();}if(!lookup(selected))selected=records[0].id;if(!lookup(active))active=selected;refresh();}
function apply(){const next=lookup($('scenarioSelect').value);if(!next)return;if(dirty()&&!confirm('目前配置尚未儲存，切換方案將捨棄這些修改。確定繼續？'))return;const previous=api.snapshot();const result=api.loadPlan(next.plan);if(!result.ok){report('無法套用：'+result.error,true);return;}if(!commit(()=>{active=selected=next.id;})){const reverted=api.loadPlan(previous);refresh();report(reverted.ok?'方案狀態儲存失敗，原圖面與已儲存工作配置均已還原。':'方案狀態儲存失敗，原圖面已盡力復原，但工作配置可能無法寫回。請立即匯出 JSON，重新載入前不要關閉。',true);return;}refresh();report('已套用「'+next.name+'」，圖面及配置檢查已更新。');}
function save(){const r=lookup(active);if(!r){report('請先另存新方案',true);return;}if(!commit(()=>{r.plan=api.snapshot();r.updated=new Date().toISOString();})){refresh();report('儲存失敗：原方案資料未覆蓋。請匯出備份並檢查可用空間。',true);return;}refresh();report('已儲存「'+r.name+'」的目前配置。');}
function cloneCurrent(){if(records.length>=40){report('方案最多 40 筆；請匯出備份並整理舊方案',true);return;}const name=prompt('新方案名稱','方案 '+(records.length+1));if(name===null)return;if(!name.trim()){report('方案名稱不可空白',true);return;}const id=makeId();if(!commit(()=>{records.push({id,name:name.trim().slice(0,70),plan:api.snapshot(),updated:new Date().toISOString()});selected=active=id;})){refresh();report('新增方案儲存失敗；原有方案保持不變。',true);return;}refresh();report('已新增「'+name.trim()+'」，目前編輯會歸屬於新方案。');}
function rename(){const r=lookup($('scenarioSelect').value);if(!r)return;const name=prompt('重新命名方案',r.name);if(name===null)return;if(!name.trim())return report('方案名稱不可空白',true);if(!commit(()=>{r.name=name.trim().slice(0,70);})){refresh();report('重新命名儲存失敗；已恢復原名稱。',true);return;}refresh();}
function remove(){const r=lookup($('scenarioSelect').value);if(!r)return;if(records.length<=1)return report('至少保留一筆方案；可重新命名或儲存目前配置',true);if(!confirm('刪除方案「'+r.name+'」？此動作不會改變目前 CAD 圖面。'))return;if(!commit(()=>{records=records.filter(v=>v.id!==r.id);selected=records[0].id;if(active===r.id)active='';})){refresh();report('刪除失敗；原方案未刪除。',true);return;}refresh();}
function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);}
function exportAll(){
 const currentPlan=api.snapshot(),hasUnsaved=!!dirty()||!lookup(active);
 const payload={type:'huwei-cad-scenarios',version:1,source:model.sha256,exportedAt:new Date().toISOString(),records:clone(records),currentPlan,workingPlanUnsaved:hasUnsaved,currentPlanName:lookup(active)?.name||'匯出時的工作配置'};
 download(JSON.stringify(payload,null,2),'虎尾場_1230配置方案備份_'+new Date().toISOString().slice(0,10)+'.json');
 report('已備份 '+records.length+' 筆方案，並包含目前圖面配置'+(hasUnsaved?'（含尚未儲存的修改）':'')+'。備份檔須由你自行保管。',!storageOk);
}
async function importAll(file){if(!file||file.size>1024*1024)return report('備份檔須為 1 MB 以內 JSON',true);let data;try{data=JSON.parse(await file.text());}catch(e){return report('檔案不是有效 JSON',true);}if(data?.type!=='huwei-cad-scenarios'||data.version!==1||data.source!==model.sha256||!Array.isArray(data.records)||data.records.length>40||!data.records.length||!data.records.every(r=>r&&typeof r.id==='string'&&typeof r.name==='string'&&r.name.trim()&&validPlan(r.plan)))return report('備份來源或格式不符，未覆蓋任何方案',true);if(data.currentPlan!==undefined&&!validPlan(data.currentPlan))return report('備份中的目前工作配置格式錯誤，未匯入',true);
 const working=data.currentPlan&&data.workingPlanUnsaved===true;
 if(!confirm('匯入 '+data.records.length+' 筆方案並取代目前的方案清單？'+(working?' 會額外保留當時未存檔的工作配置。':'')+' 請先備份。'))return;
 if(working&&data.records.length===40&&!data.records.some(r=>JSON.stringify(r.plan)===JSON.stringify(data.currentPlan)))return report('備份含40筆方案及未儲存配置，超出40筆上限；請先整理方案',true);const unique=new Set();if(!commit(()=>{records=data.records.map(r=>{let id=r.id;while(unique.has(id))id=makeId();unique.add(id);return {id,name:r.name.slice(0,70),plan:clone(r.plan),updated:r.updated||''};});if(working){const plan=clone(data.currentPlan);const exists=records.some(r=>JSON.stringify(r.plan)===JSON.stringify(plan));if(!exists){if(records.length>=40)throw Error('方案數已達40筆，無法保存未儲存配置');const id=makeId();records.push({id,name:'備份時的未儲存配置',plan,updated:data.exportedAt||''});}}
 selected=records[0].id;active='';})){refresh();report('匯入儲存失敗；已保留原本全部方案。請檢查瀏覽器空間。',true);return;}refresh();report('已匯入 '+records.length+' 筆方案，包含符合條件的備份工作配置。目前 CAD 圖面未更改；請選取並套用。');}
function setOpen(open){$('scenarioPanel').hidden=!open;$('scenarioOpen').setAttribute('aria-pressed',String(open));$('scenarioOpen').classList.toggle('primary',open);if(open){ensure();refresh();}}
$('scenarioOpen').addEventListener('click',()=>setOpen($('scenarioPanel').hidden));$('scenarioClose').addEventListener('click',()=>setOpen(false));$('scenarioSelect').addEventListener('change',e=>{const before=selected;selected=e.target.value;if(!persist()){selected=before;report('方案選取無法儲存，已恢復原選擇',true);}refresh();});$('scenarioApply').addEventListener('click',apply);$('scenarioSave').addEventListener('click',save);$('scenarioClone').addEventListener('click',cloneCurrent);$('scenarioRename').addEventListener('click',rename);$('scenarioDelete').addEventListener('click',remove);$('scenarioExport').addEventListener('click',exportAll);$('scenarioImport').addEventListener('click',()=>$('scenarioImportFile').click());$('scenarioImportFile').addEventListener('change',e=>{const file=e.target.files?.[0];e.target.value='';if(file)importAll(file);});for(const id of ['scenarioCompareA','scenarioCompareB'])$(id).addEventListener('change',renderCompare);
window.addEventListener('huwei:facility-updated',()=>{if(loaded&&!$('scenarioPanel').hidden)refresh();});
window.HUWEI_SCENARIOS={ensure,refresh,metrics:dataMetrics};
})();
