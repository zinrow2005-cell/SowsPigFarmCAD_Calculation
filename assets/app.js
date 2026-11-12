(()=>{'use strict';
const M=window.HUWEI_CAD_MODEL;
if(!M){document.body.textContent='CAD 資料沒有載入，請確認 assets/cad-model.js 存在。';return;}
const $=id=>document.getElementById(id),svgNS='http://www.w3.org/2000/svg';
const storageKey='huwei-cad-measurements-'+M.sha256.slice(0,14);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const modelRegions=[...M.regions];
const byRegion=new Map(modelRegions.map(r=>[r.id,r]));
const byEdge=new Map(M.edges.map(e=>[e.id,e]));
const byWall=new Map(M.walls.map(w=>[w.id,w]));
// Exact polygon union for multiple selectable shelter footprints. X-sweep slabs split at
// all vertices and edge intersections, then integrate union of vertical intervals.
// This prevents double counting overlapped buildings / side corridors.
function polygonArea(points){if(!Array.isArray(points)||points.length<3)return 0;let a=0;for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length];a+=p[0]*q[1]-q[0]*p[1]}return Math.abs(a)/2}
function unionPolygonArea(polygons){
 const segments=[], xs=[];const shapes=polygons.filter(p=>Array.isArray(p)&&p.length>=3&&p.every(q=>Array.isArray(q)&&q.length===2&&q.every(Number.isFinite)));
 for(const p of shapes){for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];xs.push(a[0],b[0]);if(Math.hypot(a[0]-b[0],a[1]-b[1])>1e-9)segments.push([a,b]);}}
 const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
  const [p,q]=segments[i], [r,s]=segments[j],u=[q[0]-p[0],q[1]-p[1]],v=[s[0]-r[0],s[1]-r[1]],den=cross(u,v);
  if(Math.abs(den)<1e-10)continue;const w=[r[0]-p[0],r[1]-p[1]],t=cross(w,v)/den,z=cross(w,u)/den;
  if(t>1e-8&&t<1-1e-8&&z>1e-8&&z<1-1e-8)xs.push(p[0]+t*u[0]);
 }
 xs.sort((a,b)=>a-b);const xuniq=xs.filter((x,i)=>i===0||Math.abs(x-xs[i-1])>1e-9);
 let result=0;
 for(let k=0;k<xuniq.length-1;k++){
  const left=xuniq[k],right=xuniq[k+1];if(right-left<=1e-10)continue;
  const mid=(left+right)/2,spans=[];
  for(const p of shapes){const ys=[];for(let i=0;i<p.length;i++){
    const a=p[i],b=p[(i+1)%p.length],xmin=Math.min(a[0],b[0]),xmax=Math.max(a[0],b[0]);
    if(mid>xmin&&mid<xmax&&xmax-xmin>1e-12)ys.push(a[1]+(mid-a[0])*(b[1]-a[1])/(b[0]-a[0]));
  }ys.sort((a,b)=>a-b);for(let i=0;i+1<ys.length;i+=2)if(ys[i+1]>ys[i])spans.push([ys[i],ys[i+1]]);
  }
  spans.sort((a,b)=>a[0]-b[0]);let length=0,l=null,h=null;
  for(const [a,b] of spans){if(l===null){l=a;h=b;continue}if(a<=h+1e-9)h=Math.max(h,b);else{length+=h-l;l=a;h=b}}
  if(l!==null)length+=h-l;
  result+=length*(right-left);
 }
 return Math.max(0,result);
}

const groupBy=new Map(M.groups.map(g=>[g.id,g]));
let saved={schema:'huwei-measurement-1',sha256:M.sha256,values:{},regionNotes:{},customWalls:[],customRegions:[],customEdges:[],coveredRegionIds:[],date:''};
try{
 const cached=JSON.parse(localStorage.getItem(storageKey)||'null');
 if(cached?.sha256===M.sha256&&cached?.schema===saved.schema)saved={...saved,...cached};
 else if(M.previousSourceSHA256){
  // Only fall back if no current audit exists. Preserve all user's previous numbers and sketches.
  const previousKey='huwei-cad-measurements-'+M.previousSourceSHA256.slice(0,14);
  const previous=JSON.parse(localStorage.getItem(previousKey)||'null');
  if(previous?.sha256===M.previousSourceSHA256&&previous?.schema===saved.schema){
   saved={...saved,...previous,sha256:M.sha256,migratedFromSource:M.previousSourceSHA256};
   localStorage.setItem(storageKey,JSON.stringify(saved));
  }
 }
}catch(e){/* allow fallback to export */}
for(const w of saved.customWalls){if(w.id&&Array.isArray(w.a)&&Array.isArray(w.b))byWall.set(w.id,w)}
for(const r of saved.customRegions){if(r.id&&Array.isArray(r.points)){byRegion.set(r.id,r);modelRegions.push(r);}}
for(const e of saved.customEdges){if(e.id&&Array.isArray(e.a)&&Array.isArray(e.b))byEdge.set(e.id,e);}
// Revised B/bath boundary geometry: old dimensions must not be represented as approved.
// Never erase user's numbers: keep them in saved.values for emergency JSON export.
if(saved.boundaryRevision!=='v1.2-B-bath2'){
 saved.legacyBoundaryValues=saved.legacyBoundaryValues||{};
 for(const id of Object.keys(saved.values)){
  if(/^edge_(?:B|bath2)_/.test(id)){
   // These IDs were reused for changed wall geometry. Archive, do NOT silently approve the old length.
   saved.legacyBoundaryValues[id]={...saved.values[id],originalRegion:id.startsWith('edge_B_')?'B':'bath2',sourceVersion:'before-v1.2'};
   delete saved.values[id];
  }
 }
 saved.boundaryRevision='v1.2-B-bath2';
 try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch(_e){}
}
// V1.2.5: the previous midWalk2 east portion is now an independently selectable bathroom1.
// Retain every former measured value as historical data, never silently approve the smaller corridor perimeter.
const BATH1_REV='v1.2.5-bath1-east-end';
if(saved.bath1Revision!==BATH1_REV){
 saved.legacyBoundaryValues=saved.legacyBoundaryValues||{};
 for(const id of Object.keys(saved.values))if(/^edge_midWalk2_[0-3]$/.test(id)){
  saved.legacyBoundaryValues['before_bath1_'+id]={...saved.values[id],originalRegion:'midWalk2',sourceVersion:'before-v1.2.5',reason:'浴室1分出後橫向走道周界縮短'};
  delete saved.values[id];
 }
 saved.bath1Revision=BATH1_REV;
 try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch(_e){}
}
// V1.2.2: the sample/storage corridor moved from east of the rooms to BETWEEN them.
// Do not silently reuse approved dimensions tied to an entirely different boundary.
const SAMPLE_PASS_REV='v1.2.2-between-rooms';
if(saved.samplePassRevision!==SAMPLE_PASS_REV){
 saved.legacyBoundaryValues=saved.legacyBoundaryValues||{};
 for(const id of Object.keys(saved.values||{})){
  if(/^edge_samplePass_[0-9]+$/.test(id)){
   saved.legacyBoundaryValues[id]={...saved.values[id],sourceVersion:'before-v1.2.2',oldLocation:'採精室／儲物室東側（舊錯誤邊界）'};
   delete saved.values[id];
  }
 }
 if(saved.regionNotes?.samplePass){
  saved.legacyRegionNotes=saved.legacyRegionNotes||{};
  saved.legacyRegionNotes.samplePass=saved.regionNotes.samplePass;
  delete saved.regionNotes.samplePass;
 }
 saved.samplePassRevision=SAMPLE_PASS_REV;
 try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch(_e){}
}
// The passage's original north edge pointed to a different spot. Retain but do not approve old measurements.
const SICK_PATH_NORTH_REV='v1.2.3-C-north-extended';
if(saved.sickPathNorthRevision!==SICK_PATH_NORTH_REV){
 saved.legacyBoundaryValues=saved.legacyBoundaryValues||{};
 for(const id of ['edge_sickPath_0','edge_sickPath_1']){
  if(saved.values?.[id]){
   saved.legacyBoundaryValues[id]={...saved.values[id],sourceVersion:'before-v1.2.3',reason:'病死豬運輸通道北側及東側交點已更正'};
   delete saved.values[id];
  }
 }
 saved.sickPathNorthRevision=SICK_PATH_NORTH_REV;
 try{localStorage.setItem(storageKey,JSON.stringify(saved));}catch(_e){}
}
// Only preserve existing, valid IDs. They are stored alongside the audited lengths,
// without changing the CAD source SHA or replacing the wall measurement records.
saved.coveredRegionIds=[...new Set(Array.isArray(saved.coveredRegionIds)?saved.coveredRegionIds:[])].filter(id=>byRegion.has(id));
for(const w of M.walls){if(saved.values[w.id]?.title)w.title=saved.values[w.id].title;}
let mode='region',selectedId='A',selectedSegment='',tab='edges',filter='',showAllWalls=false,drawMode='',drawPoints=[],zoom=1;
let coverageMode=false;
const coveredColors=['#a16ad8','#e79049','#41aa9b','#d96d92','#687ed0','#b38a4f','#77a655','#5c9bbd'];
const coverageColor=(id)=>coveredColors[Math.max(0,saved.coveredRegionIds.indexOf(id))%coveredColors.length];
const coverNumber=n=>Number(n).toLocaleString('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2});
function coverageStats(){const polygons=saved.coveredRegionIds.map(id=>byRegion.get(id)?.points).filter(Boolean);const gross=polygons.reduce((sum,p)=>sum+polygonArea(p),0);const net=unionPolygonArea(polygons);return{gross,net,overlap:Math.max(0,gross-net)};}
function toggleCoveredRegion(id){if(!byRegion.has(id))return;const list=saved.coveredRegionIds;const pos=list.indexOf(id);if(pos>=0)list.splice(pos,1);else list.push(id);save();paintAll();renderList();renderCoverage();}
function renderCoverage(){const selected=saved.coveredRegionIds,stats=coverageStats();$('coverageCount').textContent=selected.length+' 區';$('coverageGross').textContent=coverNumber(stats.gross)+' m²';$('coverageNet').innerHTML=coverNumber(stats.net)+' <small>m²</small>';$('coverageOverlap').textContent=coverNumber(stats.overlap)+' m²';$('coverageStripTotal').textContent=selected.length+' 區 · '+coverNumber(stats.net)+' m²';$('rightStatus').textContent=selected.length+' 區已選';$('rightStatus').classList.remove('done');
 $('coverageSelectedList').innerHTML=selected.length?selected.map((id,i)=>{const r=byRegion.get(id);return `<div class="coverage-row"><i class="coverage-swatch" style="background:${coverageColor(id)}"></i><div class="coverage-row-main"><strong>${i+1}. ${esc(r.name)}</strong><small>CAD 多邊形 ${coverNumber(polygonArea(r.points))} m²</small></div><button type="button" data-cover-remove="${esc(id)}">移除</button></div>`}).join(''):'<div class="coverage-empty">尚未選擇區塊。請在中間 CAD 或左側清單點選。</div>';
 $('coverageSelectedList').querySelectorAll('[data-cover-remove]').forEach(b=>b.onclick=()=>toggleCoveredRegion(b.dataset.coverRemove));
}
function setCoverageMode(v){coverageMode=!!v;const work=document.querySelector('.workspace');work.classList.toggle('coverage-active',coverageMode);svg.classList.toggle('coverage-selecting',coverageMode);$('toggleCoverage').setAttribute('aria-pressed',String(coverageMode));$('coverageStrip').hidden=!coverageMode;$('coveragePanel').hidden=!coverageMode;$('rightHeading').textContent=coverageMode?'遮蔽物面積':'區塊資料';$('rightEyebrow').textContent=coverageMode?'02 · 多區塊面積統計':'02 · 尺寸填寫與核定';$('mobileRightTab').textContent=coverageMode?'▧ 面積統計':'✎ 尺寸資料';$('btnWallList').disabled=coverageMode;$('addWall').disabled=coverageMode;$('addRegion').disabled=coverageMode;if(coverageMode){showAllWalls=false;$('btnWallList').textContent='切換全部牆段';}
 if(coverageMode&&drawMode){drawMode='';drawPoints=[];refreshDrawing();}
 paintAll();renderList();if(coverageMode){renderCoverage();if(window.innerWidth<=980)setMobile('center');}
 else{renderDetail();}
}

let view={x:-4.3,y:0,w:72,h:79};
const svg=$('cadSvg');const base=$('cadBase');base.innerHTML=M.baseSvg;
const overlay=$('regionOverlay'),edgeLayer=$('edgeOverlay'),wallLayer=$('wallOverlay'),selectedLayer=$('selectedOverlay');
const toast=msg=>{const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),3200)};
function save(){saved.date=new Date().toISOString();try{localStorage.setItem(storageKey,JSON.stringify(saved))}catch(e){if(!save.warned){toast('此預覽環境無法保存本機資料，請下載 JSON 另存。');save.warned=true}}}
function allWalls(){return [...M.walls,...saved.customWalls]}
function allRegs(){return modelRegions}
function allEdges(){return [...M.edges,...saved.customEdges]}
function segmentsForRegion(id){return allEdges().filter(e=>e.regionId===id)}
function wallsForRegion(id){return allWalls().filter(w=>(w.regions||[]).includes(id))}
function getVal(s){return saved.values[s.id]||{} }
function shownVal(s){const v=getVal(s).value;return v===undefined||v===null?String(s.cadLength??''):String(v)}
function getStatus(s){return getVal(s).status||'pending'}
function doneCount(arr){return arr.reduce((n,s)=>n+(getStatus(s)==='verified'?1:0),0)}
function completeness(id){const arr=segmentsForRegion(id);return [doneCount(arr),arr.length]}
function changeVal(id,val){const current=saved.values[id]||{};saved.values[id]={...current,value:val,status:current.status==='verified'?'pending':current.status||'pending'};save();refreshProgress()}
function changeStatus(id,st){saved.values[id]={...saved.values[id],status:st};save();refreshProgress();}
function mkSvg(tag,attr={},parent){const e=document.createElementNS(svgNS,tag);Object.entries(attr).forEach(([key,val])=>e.setAttribute(key,String(val)));if(parent)parent.appendChild(e);return e;}
function pointstr(a){return a.map(p=>`${p[0]},${p[1]}`).join(' ')}
function polygonCenter(p){const n=p.length;let sx=0,sy=0;for(const q of p){sx+=q[0];sy+=q[1]}return [sx/n,sy/n]}
function dist(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1])}
function regionCenter(r){return polygonCenter(r.points)}
function svgPt(e){const mat=svg.getScreenCTM();if(!mat)return [0,0];const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const p=pt.matrixTransform(mat.inverse());return [Math.round(p.x*10000)/10000,Math.round(p.y*10000)/10000]}
function setView(v){if(![v.x,v.y,v.w,v.h].every(Number.isFinite)||v.w<=0||v.h<=0)return;view={...v};svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);zoom=72/view.w;$('zoomLabel').textContent=Math.round(zoom*100)+'%';
 // Keep CAD zone and dimension labels readable without covering short corridors at high zoom.
 const pixelsPerUnit=Math.max(1,(svg.getBoundingClientRect().width||720)/view.w);
 const labelWorld=Math.min(.70,11/pixelsPerUnit);
 svg.style.setProperty('--zone-font',labelWorld.toFixed(4)+'px');
 svg.style.setProperty('--zone-stroke',Math.min(.30,labelWorld*.35).toFixed(4)+'px');
 svg.style.setProperty('--dim-font',Math.min(.62,12/pixelsPerUnit).toFixed(4)+'px');
 svg.style.setProperty('--dim-stroke',Math.min(.22,labelWorld*.35).toFixed(4)+'px');
}
function focusPoints(pts,padding=2.4){if(!pts?.length)return;const minx=Math.min(...pts.map(p=>p[0])),maxx=Math.max(...pts.map(p=>p[0])),miny=Math.min(...pts.map(p=>p[1])),maxy=Math.max(...pts.map(p=>p[1]));const w=Math.max(6,maxx-minx+padding*2),h=Math.max(7,maxy-miny+padding*2);const rect=svg.getBoundingClientRect(),aspect=rect.width>10&&rect.height>10?rect.width/rect.height:Math.max(.45,Math.min(2.4,window.innerWidth/Math.max(500,window.innerHeight-120)));let aw=w,ah=h;if(aw/ah<aspect)aw=ah*aspect;else ah=aw/aspect;setView({x:(minx+maxx-aw)/2,y:(miny+maxy-ah)/2,w:aw,h:ah})}
function zoomAt(factor,x,y){const w=Math.min(115,Math.max(3.6,view.w/factor)),h=view.h*w/view.w;const rx=(x-view.x)/view.w,ry=(y-view.y)/view.h;setView({x:x-rx*w,y:y-ry*h,w,h})}
function paintRegions(){overlay.replaceChildren();modelRegions.forEach(r=>{const g=mkSvg('g',{},overlay),isCovered=saved.coveredRegionIds.includes(r.id);const color=coverageMode?(isCovered?coverageColor(r.id):'#88afbb'):(groupBy.get(r.group)?.color||'#5ea99b');const p=mkSvg('polygon',{points:pointstr(r.points),class:`region-poly${!coverageMode&&r.id===selectedId&&mode==='region'?' active':''}${coverageMode?(isCovered?' coverage-selected':' coverage-unselected'):''}`,fill:color,'data-region':r.id},g);p.style.fill=color;if(coverageMode&&isCovered)p.style.stroke=color;p.addEventListener('click',e=>{if(drawMode||drag.moved)return;e.stopPropagation();coverageMode?toggleCoveredRegion(r.id):chooseRegion(r.id,false)});if(r.label!==false&&!r.id.startsWith('east')){const c=regionCenter(r),txt=mkSvg('text',{x:c[0],y:c[1],'class':'zone-name'},g);txt.textContent=r.name.length>15?r.name.slice(0,12):r.name;}})}
function paintHits(){edgeLayer.replaceChildren();wallLayer.replaceChildren();if(coverageMode)return;const whole=$('selectWholeSides').checked;if(mode==='region'){
 const r=byRegion.get(selectedId);if(r){segmentsForRegion(r.id).forEach(e=>{const poly=mkSvg('line',{x1:e.a[0],y1:e.a[1],x2:e.b[0],y2:e.b[1],class:'edge-hit','data-edge':e.id},edgeLayer);poly.style.pointerEvents=whole?'stroke':'none';poly.addEventListener('click',ev=>{if(drawMode||drag.moved)return;ev.stopPropagation();selectedSegment=e.id;renderDetail();paintSelection()})})}}
 allWalls().sort((a,b)=>({ '基地外緣':0,'參考界線':1,'走道邊界':2,'新增通道構件':3,'建築共牆':4,'內隔牆':5,'建築外牆':6,'現場補充牆段':7 }[a.kind]||0)-({ '基地外緣':0,'參考界線':1,'走道邊界':2,'新增通道構件':3,'建築共牆':4,'內隔牆':5,'建築外牆':6,'現場補充牆段':7 }[b.kind]||0)).forEach(w=>{const hit=mkSvg('line',{x1:w.a[0],y1:w.a[1],x2:w.b[0],y2:w.b[1],class:'wall-hit','data-wall':w.id},wallLayer);hit.style.pointerEvents=whole?'none':'stroke';hit.addEventListener('click',e=>{if(drawMode||drag.moved)return;e.stopPropagation();chooseWall(w.id,false);})});
}
function paintSelection(){selectedLayer.replaceChildren();if(coverageMode)return;const r=mode==='region'?byRegion.get(selectedId):null;if(r){mkSvg('polygon',{points:pointstr(r.points),class:'region-outline'},selectedLayer);const edge=byEdge.get(selectedSegment);if(edge){drawSelectedLine(edge,'edge-selected');}}
 if(mode==='wall'){const w=byWall.get(selectedId);if(w)drawSelectedLine(w,'wall-selected');}
 if(drawPoints.length){if(drawPoints.length>1)mkSvg('polyline',{points:pointstr(drawPoints),fill:'none',stroke:'#168f89','stroke-width':'.11','stroke-dasharray':'.25 .15'},selectedLayer);for(const pt of drawPoints)mkSvg('circle',{cx:pt[0],cy:pt[1],r:'.28',fill:'#189d92',stroke:'#fff','stroke-width':'.08'},selectedLayer)}
}
function drawSelectedLine(w,cls){mkSvg('line',{x1:w.a[0],y1:w.a[1],x2:w.b[0],y2:w.b[1],class:cls},selectedLayer);for(const p of [w.a,w.b])mkSvg('circle',{cx:p[0],cy:p[1],r:.18,class:'endpoint'},selectedLayer);if($('toggleDims').checked){const mid=[(w.a[0]+w.b[0])/2,(w.a[1]+w.b[1])/2],txt=mkSvg('text',{x:mid[0],y:mid[1]-.36,class:'dim-cad-label'},selectedLayer);txt.textContent=`${shownVal(w)} m`}}
function paintAll(){paintRegions();paintHits();paintSelection()}
function chooseRegion(id,focus=true){if(!byRegion.has(id))return;if(coverageMode){toggleCoveredRegion(id);return;}mode='region';selectedId=id;selectedSegment='';tab='edges';paintAll();renderDetail();renderList();if(focus)focusPoints(byRegion.get(id).points);if(window.innerWidth<=980)setMobile('right')}
function chooseWall(id,focus=true){if(!byWall.has(id))return;if(coverageMode){toast('目前為遮蔽物面積模式，請選擇區塊；如需核對牆長，請先退出面積模式。');return;}mode='wall';selectedId=id;selectedSegment='';paintAll();renderDetail();renderList();if(focus){const w=byWall.get(id);focusPoints([w.a,w.b],5)}if(window.innerWidth<=980)setMobile('right')}
function setMobile(v){document.querySelector('.workspace').dataset.mobile=v;document.querySelectorAll('[data-mobile]').forEach(b=>b.classList.toggle('active',b.dataset.mobile===v));}
function renderList(){const out=$('regionList');const q=filter.toLowerCase();const buf=[];if(showAllWalls){let ws=allWalls();if(q)ws=ws.filter(w=>`${w.title} ${w.layer} ${w.label} ${w.id}`.toLowerCase().includes(q));buf.push(`<div class="group-header"><span class="group-label">所有 CAD 實際牆段</span><small>${ws.length} 條</small></div>`);ws.forEach(w=>buf.push(`<button class="region-row ${mode==='wall'&&w.id===selectedId?'active':''}" data-selectwall="${esc(w.id)}"><span class="rowicon">╱</span><span class="row-main"><strong>${esc(w.title)}</strong><small>${esc(w.label)} · CAD ${w.cadLength}m</small></span><span class="row-status ${getStatus(w)==='verified'?'done':''}"></span></button>`));}else{
 for(const group of M.groups){let rs=modelRegions.filter(r=>r.group===group.id);if(q)rs=rs.filter(r=>`${r.name} ${r.note} ${r.id}`.toLowerCase().includes(q));if(!rs.length)continue;buf.push(`<div class="group-header"><span class="group-label"><i class="group-color" style="background:${group.color}"></i>${esc(group.label)}</span><small>${rs.length}</small></div>`);for(const r of rs){const [done,total]=completeness(r.id);buf.push(`<button class="region-row ${coverageMode?(saved.coveredRegionIds.includes(r.id)?'coverage-checked':''):(mode==='region'&&selectedId===r.id?'active':'')}" data-selectreg="${esc(r.id)}"><span class="rowicon">${coverageMode?(saved.coveredRegionIds.includes(r.id)?'✓':'＋'):(r.important?'⌖':'▤')}</span><span class="row-main"><strong>${esc(r.name)}</strong><small>${coverageMode?'CAD 面積 '+coverNumber(polygonArea(r.points))+' m²':`周界已核 ${done}/${total} · ${wallsForRegion(r.id).length} 段附近牆線`}</small></span><span class="row-status ${done===total&&total?'done':done?'part':''}"></span></button>`)} }
 }
 out.innerHTML=buf.join('')||'<div class="empty-state">沒有符合搜尋的區塊或牆線。</div>';
 out.querySelectorAll('[data-selectreg]').forEach(b=>b.onclick=()=>chooseRegion(b.dataset.selectreg));out.querySelectorAll('[data-selectwall]').forEach(b=>b.onclick=()=>chooseWall(b.dataset.selectwall));
 $('regionTotal').textContent=`${modelRegions.length} 區 · ${allWalls().length} 段實牆`;
}
function refreshProgress(){const arr=[...allEdges(),...allWalls()];const d=doneCount(arr);$('progressText').textContent=`已核對 ${d} / ${arr.length} 個尺寸欄位`;$('progressFill').style.width=`${arr.length?100*d/arr.length:0}%`;if(coverageMode){renderCoverage();return;}$('rightStatus').textContent=mode==='wall'?(getStatus(byWall.get(selectedId))==='verified'?'已核對':'待核對'):`區塊周界 ${doneCount(segmentsForRegion(selectedId))}/${segmentsForRegion(selectedId).length}`;$('rightStatus').classList.toggle('done',mode==='wall'?getStatus(byWall.get(selectedId))==='verified':segmentsForRegion(selectedId).length>0&&completeness(selectedId)[0]===completeness(selectedId)[1]);}
function dimensionRow(d){let status=getStatus(d),value=shownVal(d);return `<div class="dim-row ${selectedSegment===d.id?'selected':''}" id="row_${esc(d.id)}" data-highlight="${esc(d.id)}"><div class="dim-row-top"><strong>${esc(d.title)}</strong><small>${d.id.startsWith('edge_')?'含門洞之整面邊線':'原圖拆分線段'}</small></div><div class="dim-row-bottom"><div class="dim-col"><label>你核對的長度</label><div class="dim-input"><input type="number" min="0" step="0.001" inputmode="decimal" data-length="${esc(d.id)}" value="${esc(value)}" aria-label="${esc(d.title)}長度（公尺）"/><small>m</small></div></div><span class="cad-ref" title="從DXF座標計算；不代表現場實測">CAD ${d.cadLength}m</span><button type="button" class="verify ${status==='verified'?'done':''}" data-verify="${esc(d.id)}" title="標記此數值已現場核對">${status==='verified'?'✓ 已核':'○ 待核'}</button></div></div>`}
function renderDetail(){const host=$('detailPanel');if(mode==='region'){
 const r=byRegion.get(selectedId);if(!r)return;const es=segmentsForRegion(r.id),ws=wallsForRegion(r.id);const total=es.length;const note=saved.regionNotes[r.id]??'';
 let content=`<div class="detail-summary"><div class="type">${esc(groupBy.get(r.group)?.label||r.group)} · ${esc(r.id)}</div><h3>${esc(r.name)}</h3><p>${esc(r.note||'點選 CAD 線條或列表逐段修改尺寸。')}</p></div><div class="dimension-note"><b>整面牆長包含門口寬度，不另扣門洞。</b> 僅遇轉角才獨立量下一段。此頁周界含建築牆、走道及參考界線，需依現場判別；CAD 端點計算值尚非實測。輸出 DXF 只加尺寸標註，<b>不會把門洞畫成牆</b>。</div><div class="tabs"><button type="button" data-tab="edges" class="${tab==='edges'?'active':''}">整面邊線含門 (${total})</button><button type="button" data-tab="walls" class="${tab==='walls'?'active':''}">原圖拆段 (${ws.length})</button><button type="button" data-tab="notes" class="${tab==='notes'?'active':''}">核對紀錄</button></div>`;
 if(r.id==='giltBreedWhole')content+=`<div class="field-tip" style="padding:8px;border:1px solid #b6dfd8;border-radius:8px;background:#f2fbf8">這是新女豬育成＋配種舍的<strong>整棟外牆</strong>，內部14欄、配種夾欄、巡情公豬欄、G-07母豬通道和內部走道都不是獨立建築區塊。舊版若已填入各小區尺寸，原紀錄保留在核對 JSON，未自動轉成整棟牆長。</div>`;
if(r.id==='bath1'||r.id==='midWalk2')content+=`<div class="field-tip" style="padding:8px;border:1px solid #ecd3a5;border-radius:8px;background:#fff9ec">浴室1已依紅框另畫並和原橫向走道分開。新房間周界及西側門洞均為 CAD 待核草案；原走道的已核尺寸保留於歷史資料，請依新邊界重新丈量。</div>`;
if(r.id==='B'||r.id==='bath2')content+=`<div class="field-tip" style="padding:8px;border:1px solid #f1d3b0;border-radius:8px;background:#fff9f1">已修正 B 棟與三角區的選取邊界。原版填過的這兩區尺寸需重新核對，舊值保留而不自動認列為已核。</div>`;
 if(tab==='edges')content+=`<div class="section-title">完整邊線丈量 <small>一面牆包含中間門洞</small></div>${es.map(dimensionRow).join('')}<p class="field-tip">門洞寬度已計入兩端轉角間的整面長度，不另外拆出門寬。若有轉角，則另列下一段。非建築邊界仍須核對性質。</p>`;
 if(tab==='walls')content+=`<div class="section-title">CAD 原始短牆段 <small>只供交叉查證，不等於含門整面長度</small></div>${ws.length?ws.map(w=>dimensionRow(w)).join(''):'<div class="empty-state">這個區塊附近尚未辨認到 CAD 牆線。可在中央點選「＋補畫牆段」自行建立待核對線段。</div>'}<p class="field-tip">CAD 原始線段常在門洞處中斷。要填給代書的整面牆長，請切回「整面邊線含門」。必要時可勾選匯出這些原圖短牆段作為額外參考。</p>`;
 if(tab==='notes')content+=`<div class="section-title">現場核對說明</div><label class="detail-label">備註、未標示的門洞／轉折、實際丈量差異<textarea data-region-note="${esc(r.id)}" placeholder="例如：西側牆分兩段，門洞尚待現場丈量…">${esc(note)}</textarea></label><div class="coordinate">資料來源：${esc(r.source)}<br>目前共 ${es.length} 段周界、${ws.length} 段附近 CAD 牆線。<br>CAD 座標及相應長度保留原樣，不會因填寫而變更圖形幾何。</div>`;
 host.innerHTML=content;
}else{
 const w=byWall.get(selectedId);if(!w)return;const st=getStatus(w);host.innerHTML=`<div class="detail-summary"><div class="type">CAD 牆段／邊界 · ${esc(w.id)}</div><h3>${esc(w.title)}</h3><p>${esc(w.label||'全場線段')} · ${esc(w.kind)}</p></div><div class="dimension-note">以下長度由 DXF 兩端座標計算。此為原圖一段線，<b>門洞可能使它中斷</b>；整面牆（含門）請切至相鄰區塊的整面邊線填寫。輸入只會增設尺寸註記，不會拉伸牆。</div>${dimensionRow(w)}<label class="detail-label">牆段顯示名稱<input data-wall-title="${esc(w.id)}" value="${esc(w.title)}" /></label><label class="detail-label">現場備註<textarea data-item-note="${esc(w.id)}" placeholder="例：此段為原圖牆線；整面牆已於區塊周界填寫含門洞總長。">${esc(getVal(w).note||'')}</textarea></label><div class="coordinate">DXF 圖層：${esc(w.layer)}<br>端點 A：(${w.a[0]}, ${w.a[1]}) m<br>端點 B：(${w.b[0]}, ${w.b[1]}) m<br>CAD 幾何長：${w.cadLength} m</div><div class="section-title">相鄰區域</div><div class="quick-actions">${(w.regions||[]).map(id=>byRegion.has(id)?`<button type="button" data-go-region="${esc(id)}">${esc(byRegion.get(id).name)}</button>`:'').join('')||'尚未對應明確區域'}</div>${w.id.startsWith('manual_')?'<button type="button" class="btn" id="removeManual">刪除此補畫牆段</button>':''}`;
 }
 refreshProgress();bindDetail();}
function bindDetail(){const host=$('detailPanel');host.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;selectedSegment='';renderDetail();paintSelection()});host.querySelectorAll('[data-length]').forEach(inp=>{
  inp.addEventListener('input',()=>{changeVal(inp.dataset.length,inp.value);const card=inp.closest('.dim-row');const verify=card?.querySelector('[data-verify]');if(verify){verify.classList.remove('done');verify.textContent='○ 待核'}paintSelection()});
  inp.addEventListener('focus',()=>{selectedSegment=inp.dataset.length;if(mode==='region'){paintSelection()}else paintSelection();});
 });
 host.querySelectorAll('[data-verify]').forEach(b=>b.onclick=()=>{const id=b.dataset.verify,item=byEdge.get(id)||byWall.get(id);if(!item)return;const raw=shownVal(item);if(!Number.isFinite(Number(raw))||Number(raw)<=0){toast('請先填寫大於 0 的有效牆長，才能核對。');return;}changeStatus(id,getStatus(item)==='verified'?'pending':'verified');renderDetail();renderList();paintSelection()});
 host.querySelectorAll('[data-highlight]').forEach(card=>{card.addEventListener('mouseover',()=>{if(mode==='region'){selectedSegment=card.dataset.highlight;paintSelection()}})});
 host.querySelectorAll('[data-go-region]').forEach(b=>b.onclick=()=>chooseRegion(b.dataset.goRegion));
 host.querySelectorAll('[data-region-note]').forEach(t=>t.addEventListener('input',()=>{saved.regionNotes[t.dataset.regionNote]=t.value;save()}));
 host.querySelectorAll('[data-item-note]').forEach(t=>t.addEventListener('input',()=>{saved.values[t.dataset.itemNote]={...saved.values[t.dataset.itemNote],note:t.value};save()}));
 host.querySelectorAll('[data-wall-title]').forEach(t=>t.addEventListener('change',()=>{const w=byWall.get(t.dataset.wallTitle);if(w){w.title=t.value.trim()||w.title;const own=saved.customWalls.find(x=>x.id===w.id);if(!own){saved.values[w.id]={...saved.values[w.id],title:w.title}}save();renderList();renderDetail()}}));
 const del=$('removeManual');if(del)del.onclick=()=>{if(!confirm('只移除此補畫牆段？不會改動原始 CAD。'))return;saved.customWalls=saved.customWalls.filter(w=>w.id!==selectedId);byWall.delete(selectedId);save();chooseRegion('A')};
}
function report(){const date=new Date().toISOString(),records=[];
 for(const e of allEdges()){const r=byRegion.get(e.regionId);records.push({recordType:'區塊周界',id:e.id,group:r?.group||'',area:r?.name||'',segment:e.title,cadLength:e.cadLength,confirmedLength:shownVal(e),status:getStatus(e),note:getVal(e).note||'',layer:'區域輪廓（非實牆總長）'});}
 for(const w of allWalls())records.push({recordType:'CAD 牆段',id:w.id,group:'',area:w.label||'',segment:w.title,cadLength:w.cadLength,confirmedLength:shownVal(w),status:getStatus(w),note:getVal(w).note||'',layer:w.layer});
 return{schema:'huwei-cad-audit-export-1',generatedAt:date,originalCad:M.sourceFile,originalCadSHA256:M.sha256,units:'m',coverageSelection:{ids:[...saved.coveredRegionIds],...coverageStats(),unit:'m²',basis:'DXF planar polygons, overlaps merged; unverified shelter eligibility'},warning:'整面邊線包含中間的門洞寬度，門洞不分拆。原圖短牆段只是圖元片段；CAD 計算尺寸不是實測，僅 verified 為使用者核對值。匯出 DXF 不更改原圖幾何。',regions:modelRegions.map(r=>({id:r.id,name:r.name,group:r.group,note:saved.regionNotes[r.id]||'',source:r.source,points:r.points})),records,changes:saved};
}
function download(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function exportDxf(){
 if(!window.HUWEI_DXF_EXPORT){const msg='DXF 匯出模組尚未載入，請確認已部署完整新版檔案。';const f=$('exportFeedback');if(f){f.hidden=false;f.dataset.state='error';f.textContent=msg;}return toast(msg);}
 const includePending=$('includePendingDxf').checked;
 const includeSourceWalls=$('includeSourceWalls').checked;
 const only=$('onlyCurrentArea').checked;
 let current=mode==='region'?selectedId:(byWall.get(selectedId)?.regions||[])[0]||'';
 if(only&&!current)return toast('目前牆段沒有對應區塊，請先選擇一個區塊。');
 const regionInfo=(e)=>byRegion.get(e.regionId);
 const entries=allEdges().filter(e=>!only||e.regionId===current).map(e=>({
  id:e.id,a:e.a,b:e.b,value:shownVal(e),status:getStatus(e),
  center:polygonCenter(regionInfo(e)?.points||[e.a,e.b]),
  prefix:`${e.regionId}-${e.order||1} `
 }));
 // Original disjoint wall fragments are opt-in to avoid double dimensioning at door openings.
 if(includeSourceWalls)for(const w of allWalls().filter(w=>!w.id.startsWith('manual_')&&(!only||(w.regions||[]).includes(current)))){
  entries.push({id:w.id,a:w.a,b:w.b,value:shownVal(w),status:getStatus(w),prefix:`SEG-${w.cadHandle||w.id} `});
 }
 const sketches=saved.customWalls.filter(w=>!only||(w.regions||[]).includes(current)).map(w=>({
  a:w.a,b:w.b,value:shownVal(w),status:getStatus(w),prefix:`SKETCH-${w.id.slice(-5)} `
 }));
 const audited=entries.filter(e=>e.status==='verified'&&Number(e.value)>0).length+sketches.filter(e=>e.status==='verified'&&Number(e.value)>0).length;
 const feedback=$('exportFeedback');
 if(feedback){feedback.hidden=false;feedback.dataset.state='working';feedback.textContent='正在建立代書 DXF…';}
 try{
  const res=window.HUWEI_DXF_EXPORT.makeFile({sourceSha:M.sha256,entries,sketches,includePending});
  const date=new Date().toISOString().slice(0,10);
  // A blank audit still produces the original, editable CAD; no blocking confirm dialog.
  // 保留使用者原始 1,116 個圖元、此前新增通道補線及浴室1待核圖層；尺寸資料不改動實體 CAD 牆長。
  download(new Blob([res.bytes],{type:'application/dxf'}),`虎尾場_代書CAD核對參考_${date}.dxf`);
  const detail=audited?`已核標註 ${res.stats.verified} 處`:'目前尚無已核定尺寸，這份檔案只有原始 CAD 與選擇加入的待核參考標註';
  const notice=`DXF 已送交瀏覽器下載；${audited?'含已核尺寸 '+res.stats.verified+' 筆':'目前沒有已核定尺寸'}。請查看下載清單。`;
  if(feedback){feedback.dataset.state='success';feedback.textContent=notice;}
  $('dxfExportStatus').textContent=`${notice} 若找不到檔案，請檢查下載權限或改用離線 HTML。保留原圖門洞與牆線，新增通道北邊線及浴室1待核隔牆；請另外下載核對 JSON 交代書。`;
  toast(audited?`DXF 已送出下載 · 已核 ${res.stats.verified} 處`:'原始 DXF 已送出下載（尚無已核定尺寸）');
 }catch(e){
  const message='DXF 匯出失敗：'+(e?.message||e);
  if(feedback){feedback.dataset.state='error';feedback.textContent=message;}
  $('dxfExportStatus').textContent=message;
  toast(message);
 }
}
function exportJson(){const obj=report();download(new Blob([JSON.stringify(obj,null,2)],{type:'application/json;charset=utf-8'}),'虎尾場_全場CAD牆線尺寸核對_'+new Date().toISOString().slice(0,10)+'.json');toast('已下載核對資料 JSON，可直接上傳此對話。')}
function exportCsv(){const data=report(),columns=['recordType','id','group','area','segment','cadLength','confirmedLength','status','note','layer'];const lines=[columns.join(',')];for(const r of data.records)lines.push(columns.map(c=>'"'+String(r[c]??'').replace(/"/g,'""')+'"').join(','));download(new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),'虎尾場_尺寸核對.csv');toast('已匯出全部尺寸為 CSV。')}
function copyReport(){const obj=report(),arr=obj.records.filter(r=>r.status==='verified'||(saved.values[r.id]&&saved.values[r.id].value!==undefined&&String(saved.values[r.id].value)!==String(r.cadLength)));const txt=['虎尾場 CAD 尺寸核對（僅列已核定或有修改的欄位）',`DXF：${M.sourceFile}`,`已修改／核對 ${arr.length} 筆；未列的仍待核對。`,...arr.map(r=>`${r.recordType}｜${r.area}｜${r.segment}｜CAD ${r.cadLength}m｜核對 ${r.confirmedLength}m｜${r.status==='verified'?'已核對':'待核對'}`),'請依這份核對清單更新 CAD，未核對不得視為實測。'].join('\n');if(navigator.clipboard?.writeText){navigator.clipboard.writeText(txt).then(()=>toast('已複製尺寸摘要，可以貼回聊天室。')).catch(()=>fallbackCopy(txt))}else fallbackCopy(txt)}
function fallbackCopy(t){const ta=document.createElement('textarea');ta.value=t;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');toast('已複製尺寸摘要。')}catch(e){toast('複製失敗，請改下載 JSON。')}ta.remove()}
async function importJson(file){if(!file||file.size>6e6){toast('請選擇小於 6MB 的尺寸核對 JSON。');return}let data;try{data=JSON.parse(await file.text())}catch(e){toast('檔案不是有效的 JSON。');return}let changes=data?.changes?.schema==='huwei-measurement-1'?data.changes:data;if(changes?.schema!=='huwei-measurement-1'||![M.sha256,M.previousSourceSHA256].includes(changes?.sha256)){
 toast('檔案的 CAD 來源不同或格式錯誤，已拒絕合併核對資料。');return
}if(!confirm('要將這份尺寸核對資料合併到目前的工作台？請先下載目前 JSON 備份。'))return;for(const [id,v] of Object.entries(changes.values||{})){
 if(!/^\w[\w-]*$/.test(id))continue;
 const raw=v?.value;
 if(raw!==undefined&&(raw===''||(!Number.isFinite(Number(raw))||Number(raw)<0)))continue;
 // IDs reused for revised boundaries must not silently import old approved lengths.
 if(/^edge_(?:B|bath2)_/.test(id)&&changes.boundaryRevision!=='v1.2-B-bath2'){
  saved.legacyBoundaryValues=saved.legacyBoundaryValues||{};
  saved.legacyBoundaryValues[id]={...v,sourceVersion:'import-before-v1.2'};
  continue;
 }
 if(/^edge_midWalk2_[0-3]$/.test(id)&&changes.bath1Revision!==BATH1_REV){
  saved.legacyBoundaryValues=saved.legacyBoundaryValues||{};
  saved.legacyBoundaryValues['before_bath1_'+id]={...v,sourceVersion:'import-before-v1.2.5',reason:'浴室1分出後橫向走道邊界改變'};
  continue;
 }
 if(/^edge_samplePass_[0-9]+$/.test(id)&&changes.samplePassRevision!==SAMPLE_PASS_REV){
  saved.legacyBoundaryValues=saved.legacyBoundaryValues||{};
  saved.legacyBoundaryValues[id]={...v,sourceVersion:'import-before-v1.2.2',oldLocation:'採精／儲物室東側'};
  continue;
 }
 if(['edge_sickPath_0','edge_sickPath_1'].includes(id)&&changes.sickPathNorthRevision!==SICK_PATH_NORTH_REV){
  saved.legacyBoundaryValues=saved.legacyBoundaryValues||{};
  saved.legacyBoundaryValues[id]={...v,sourceVersion:'import-before-v1.2.3',reason:'通道北側新邊線取代舊幾何'};
  continue;
 }
 saved.values[id]={...saved.values[id],...v};
}
for(const [id,v] of Object.entries(changes.legacyBoundaryValues||{})){
 if((/^edge_(?:B|bath2)_\d+$/.test(id)||['edge_sickPath_0','edge_sickPath_1'].includes(id))&&v&&typeof v==='object'){
  saved.legacyBoundaryValues=saved.legacyBoundaryValues||{};
  saved.legacyBoundaryValues[id]=v;
 }
}
for(const [id,v] of Object.entries(changes.regionNotes||{})){if(typeof v==='string'){if(id==='samplePass'&&changes.samplePassRevision!==SAMPLE_PASS_REV){saved.legacyRegionNotes=saved.legacyRegionNotes||{};saved.legacyRegionNotes[id]=v.slice(0,10000)}else saved.regionNotes[id]=v.slice(0,10000)}}for(const r of (changes.customRegions||[])){if(!r?.id?.startsWith("userzone_")||!Array.isArray(r.points)||r.points.length<3||!r.points.flat().every(Number.isFinite))continue;if(!byRegion.has(r.id)){saved.customRegions.push(r);byRegion.set(r.id,r);modelRegions.push(r)}}for(const e of (changes.customEdges||[])){if(!e?.id?.startsWith("edge_userzone_")||!byRegion.has(e.regionId)||!Array.isArray(e.a)||!Array.isArray(e.b)||!e.a.concat(e.b).every(Number.isFinite))continue;if(!byEdge.has(e.id)){saved.customEdges.push(e);byEdge.set(e.id,e)}}for(const w of (changes.customWalls||[])){if(!w?.id?.startsWith('manual_')||!Array.isArray(w.a)||!Array.isArray(w.b)||w.a.length!==2||w.b.length!==2||!w.a.concat(w.b).every(Number.isFinite))continue;if(!byWall.has(w.id)){saved.customWalls.push(w);byWall.set(w.id,w)}}if(Array.isArray(changes.coveredRegionIds))saved.coveredRegionIds=[...new Set(changes.coveredRegionIds)].filter(id=>byRegion.has(id));save();renderList();paintAll();renderDetail();if(coverageMode)renderCoverage();toast('核對資料已合併，沒有改動 CAD 原始圖。')}
// Mark-up overlay only: clicking two points creates a new measurement segment; original DXF untouched.
function refreshDrawing(){ $('cadViewport').classList.toggle('drawing',!!drawMode);$('drawingTip').hidden=!drawMode;$('drawingTip').textContent=drawMode==='wall'?'先點牆段起點，再點終點。按 Esc 取消。':drawMode==='region'?'依序點選至少三個區塊角點，再按「完成框選」。按 Esc 取消。':'';$('addWall').textContent=drawMode==='wall'?'取消補畫':'＋ 補畫牆段';$('addRegion').textContent=drawMode==='region'?'取消框選':'＋ 補畫區塊';$('finishDrawing').hidden=!(drawMode==='region'&&drawPoints.length>=3);paintSelection();if(drawMode&&window.innerWidth<=980)setMobile('center')}
function setDraw(mode){drawMode=drawMode===mode?'':mode;drawPoints=[];refreshDrawing()}
function addPoint(point){drawPoints.push(point);refreshDrawing();if(drawMode==='wall'&&drawPoints.length===2){const id='manual_'+Date.now().toString(36),[a,b]=drawPoints;const w={id,title:'新增待核牆段',a,b,cadLength:+dist(a,b).toFixed(3),kind:'現場補充牆段',layer:'USER_MEASUREMENTS',regions:mode==='region'?[selectedId]:[],label:mode==='region'?byRegion.get(selectedId)?.name:'自行補畫'};saved.customWalls.push(w);byWall.set(id,w);save();setDraw('wall');chooseWall(id,false);toast('已新增待核牆段。請在右側輸入現場長度與名稱。')}}
function finishRegion(){if(drawMode!=='region'||drawPoints.length<3)return toast('請至少標出三個不同的區塊角點。');$('regionDialog').showModal();$('regionName').focus()}
function createRegion(){const n=$('regionName').value.trim();if(!n){toast('請輸入區塊名稱。');return}const id='userzone_'+Date.now().toString(36),r={id,name:n,group:$('regionGroup').value,source:'使用者在 CAD 圖面自行框選；非原始建築牆線',note:'自行新增的區塊，邊界座標是畫面點選的 CAD 坐標，並非已確認的現場牆長。',important:false,points:drawPoints.map(p=>[...p]),label:true};modelRegions.push(r);saved.customRegions.push(r);byRegion.set(id,r);for(let i=0;i<r.points.length;i++){const a=r.points[i],b=r.points[(i+1)%r.points.length],edge={id:`edge_${id}_${i}`,regionId:id,dir:'周界',order:i+1,a,b,cadLength:+dist(a,b).toFixed(3),title:`自訂周界段 ${i+1}`,type:'使用者補畫界線'};saved.customEdges.push(edge);byEdge.set(edge.id,edge)}$('regionDialog').close();$('regionName').value='';save();setDraw('region');chooseRegion(id,true);renderList();toast('已加入新區塊，請逐段核對尺寸。')}
const drag={start:null,moved:false};const ptsPointers=new Map();let pinch=null;
svg.addEventListener('pointerdown',ev=>{ptsPointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});if(ptsPointers.size===2){const a=[...ptsPointers.values()];pinch={distance:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),view:{...view}}}if(ev.button!==0)return;drag.start={x:ev.clientX,y:ev.clientY,view:{...view}};drag.moved=false; });
svg.addEventListener('pointermove',ev=>{if(!ptsPointers.has(ev.pointerId))return;ptsPointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});if(pinch&&ptsPointers.size===2){const a=[...ptsPointers.values()];const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);const c=[(a[0].x+a[1].x)/2,(a[0].y+a[1].y)/2],rect=svg.getBoundingClientRect();const factor=d/Math.max(1,pinch.distance);const neww=Math.min(115,Math.max(3.6,pinch.view.w/factor)),newh=pinch.view.h*neww/pinch.view.w;const rx=(c[0]-rect.left)/rect.width,ry=(c[1]-rect.top)/rect.height;setView({x:pinch.view.x+rx*(pinch.view.w-neww),y:pinch.view.y+ry*(pinch.view.h-newh),w:neww,h:newh});drag.moved=true;return}if(!drag.start||drawMode)return;const dx=ev.clientX-drag.start.x,dy=ev.clientY-drag.start.y;if(Math.abs(dx)+Math.abs(dy)<7)return;if(!drag.moved){try{svg.setPointerCapture(ev.pointerId)}catch(e){}}drag.moved=true;const rect=svg.getBoundingClientRect();setView({...drag.start.view,x:drag.start.view.x-dx*drag.start.view.w/rect.width,y:drag.start.view.y-dy*drag.start.view.h/rect.height});});
svg.addEventListener('pointerup',ev=>{ptsPointers.delete(ev.pointerId);if(ptsPointers.size<2)pinch=null;const moved=drag.moved;drag.start=null;if(drawMode&&!moved){ev.stopImmediatePropagation();addPoint(svgPt(ev));}setTimeout(()=>{drag.moved=false},0)});
svg.addEventListener('pointercancel',ev=>{ptsPointers.delete(ev.pointerId);drag.start=null;pinch=null});
svg.addEventListener('wheel',ev=>{ev.preventDefault();const p=svgPt(ev);zoomAt(ev.deltaY<0?1.20:1/1.20,p[0],p[1])},{passive:false});
svg.addEventListener('click',e=>{if(drawMode||drag.moved)return;const regionNode=e.target.closest?.('[data-region]');if(regionNode)coverageMode?toggleCoveredRegion(regionNode.dataset.region):chooseRegion(regionNode.dataset.region,false)});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&drawMode)setDraw(drawMode)});
$('search').addEventListener('input',e=>{filter=e.target.value;renderList()});
$('btnWallList').onclick=()=>{showAllWalls=!showAllWalls;$('btnWallList').textContent=showAllWalls?'顯示區塊清單':'切換全部牆段';renderList()};
document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>chooseRegion(b.dataset.jump));document.querySelectorAll('[data-wall]').forEach(b=>b.onclick=()=>chooseWall(b.dataset.wall));
$('zoomIn').onclick=()=>zoomAt(1.25,view.x+view.w/2,view.y+view.h/2);
$('zoomOut').onclick=()=>zoomAt(1/1.25,view.x+view.w/2,view.y+view.h/2);
$('fit').onclick=()=>setView({x:-4.3,y:0,w:72,h:79});
$('toggleReference').onchange=e=>base.classList.toggle('show-reference',e.target.checked);
$('toggleDims').onchange=paintSelection;$('selectWholeSides').onchange=()=>{paintHits();toast($('selectWholeSides').checked?'點線時選整面牆（含門洞）':'點線時選原始 CAD 短牆段')};
$('toggleCoverage').onclick=()=>setCoverageMode(!coverageMode);
$('coverageExit').onclick=()=>setCoverageMode(false);
$('coverageViewResult').onclick=()=>{if(window.innerWidth<=980)setMobile('right');else $('rightScroll').scrollTop=0};
$('coverageClear').onclick=()=>{if(saved.coveredRegionIds.length&& !confirm('要清除這次遮蔽物面積的全部選取嗎？牆線核對數字不受影響。'))return;saved.coveredRegionIds=[];save();paintAll();renderList();renderCoverage();};
$('coverageDownload').onclick=()=>{const stats=coverageStats();const cols=[['區塊','CAD 面積(m²)'],...saved.coveredRegionIds.map(id=>[byRegion.get(id).name,polygonArea(byRegion.get(id).points).toFixed(3)]),['各區面積合計',stats.gross.toFixed(3)],['重疊面積',stats.overlap.toFixed(3)],['扣除重疊後總面積',stats.net.toFixed(3)]];const csv='\ufeff'+cols.map(row=>row.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\r\n');download(new Blob([csv],{type:'text/csv;charset=utf-8'}),'虎尾場_遮蔽物面積核對_'+new Date().toISOString().slice(0,10)+'.csv');toast('已匯出遮蔽範圍選取清單與面積合計。');};
$('addWall').onclick=()=>setDraw('wall');$('addRegion').onclick=()=>setDraw('region');$('finishDrawing').onclick=finishRegion;$('cancelRegion').onclick=()=>$('regionDialog').close();$('regionForm').addEventListener('submit',e=>{e.preventDefault();createRegion()});
$('btnDownloadDxf').onclick=exportDxf;$('btnExportDxf').onclick=exportDxf;$('btnExport').onclick=exportJson;$('btnSave').onclick=exportJson;$('btnExportCsv').onclick=exportCsv;$('btnCopy').onclick=copyReport;
$('btnImport').onclick=()=>$('inputImport').click();$('inputImport').onchange=e=>{const f=e.target.files?.[0];e.target.value='';if(f)importJson(f)};
document.querySelectorAll('[data-mobile]').forEach(b=>b.onclick=()=>setMobile(b.dataset.mobile));
// default view does not alter local CAD. user can inspect every source entity by zooming.
setMobile(window.innerWidth<=980?'center':'center');setView(view);paintAll();renderList();renderDetail();
})();
