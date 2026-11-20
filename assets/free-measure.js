/* V2.0.3: Local, non-destructive CAD measure overlay. CAD units = meters. */
(()=>{'use strict';
const svg=document.getElementById('cadSvg'),viewport=document.getElementById('cadViewport'),start=document.getElementById('measureOpen'),panel=document.getElementById('measurePanel');
if(!svg||!viewport||!start||!panel)return;
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const layer=document.createElementNS(ns,'g');layer.setAttribute('id','freeMeasureOverlay');layer.setAttribute('pointer-events','none');svg.append(layer);
const modes={line:'兩點',horizontal:'水平',vertical:'垂直',chain:'連續'};
let active=false,kind='line',points=[],lastResults=[],snapped=false,down=null,dragged=false, multi=false;
const fmt=n=>Number(n).toFixed(2),length=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function mk(tag,attrs={},parent=layer){let node=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);parent.append(node);return node;}
function svgPoint(ev){const m=svg.getScreenCTM();if(!m)return [0,0];const p=svg.createSVGPoint();p.x=ev.clientX;p.y=ev.clientY;const q=p.matrixTransform(m.inverse());return [q.x,q.y];}
function snapCandidates(){const model=window.HUWEI_CAD_MODEL||{};const coords=[];for(const r of model.regions||[])for(const p of r.points||[])coords.push(p);for(const w of model.walls||[])coords.push(w.a,w.b);for(const p of window.HUWEI_PARCELS?.getData?.()||[])for(const q of p.points||[])coords.push(q);return coords;}
let candidates=[];
function pointFromEvent(ev){const raw=svgPoint(ev),m=svg.getScreenCTM(),scale=Math.hypot(m?.a||1,m?.b||0)||1;let best=raw,nearest=12/scale;snapped=false;if($('measureSnap').checked){for(const p of candidates){const d=length(raw,p);if(d<nearest){nearest=d;best=[p[0],p[1]];snapped=true;}}}return best;}
function metric(a,b){if(kind==='horizontal')return Math.abs(b[0]-a[0]);if(kind==='vertical')return Math.abs(b[1]-a[1]);return length(a,b);}
function projected(a,b){if(kind==='horizontal')return [b[0],a[1]];if(kind==='vertical')return [a[0],b[1]];return b;}
function render(){layer.replaceChildren();let segs=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=projected(a,points[i]),d=metric(a,points[i]);segs.push({a,b,d});}const scale=Math.hypot(svg.getScreenCTM()?.a||1,svg.getScreenCTM()?.b||0)||1;
for(const [i,s] of segs.entries()){mk('line',{x1:s.a[0],y1:s.a[1],x2:s.b[0],y2:s.b[1],stroke:'#e67f2e','stroke-width':2.4/scale,'vector-effect':'non-scaling-stroke','stroke-dasharray':kind==='chain'?'6 3':''});const mid=[(s.a[0]+s.b[0])/2,(s.a[1]+s.b[1])/2];const txt=mk('text',{x:mid[0],y:mid[1]-10/scale,'font-size':12/scale,fill:'#a5510d','text-anchor':'middle','font-weight':'800',stroke:'#fff','stroke-width':3/scale,'paint-order':'stroke'});txt.textContent=fmt(s.d)+' m';}
for(const [i,p] of points.entries()){mk('circle',{cx:p[0],cy:p[1],r:5/scale,fill:i===0?'#148f88':'#e67f2e',stroke:'#fff','stroke-width':2/scale});const label=mk('text',{x:p[0]+8/scale,y:p[1]-8/scale,'font-size':11/scale,fill:'#195962',stroke:'#fff','stroke-width':3/scale,'paint-order':'stroke'});label.textContent=String.fromCharCode(65+i%26);}
$('measureCount').textContent=points.length+' 個點';const total=segs.reduce((s,v)=>s+v.d,0);$('measureResult').textContent=segs.length?(kind==='chain'?'總長 ':'長度 ')+fmt(total)+' m':'尚未丈量';$('measureDetail').innerHTML=segs.map((s,i)=>`<span>${i+1}. ${fmt(s.d)} m</span>`).join('');$('measureFinish').disabled=kind!=='chain'||points.length<2;$('measureUndo').disabled=points.length===0;
}
function clear(){points=[];lastResults=[];render();}
function setKind(value){kind=value;points=[];render();$('measureMode').value=value;$('measureHelp').textContent=kind==='chain'?'依序點選各轉折，完成時按「完成」。':'依序點選起點 A 與終點 B，便會顯示距離。';}
function toggle(on){active=!!on;panel.hidden=!active;start.classList.toggle('primary',active);start.setAttribute('aria-pressed',String(active));start.textContent=active?'✕ 離開丈量':'↔ 自由丈量';viewport.classList.toggle('measuring',active);if(active){candidates=snapCandidates();$('measureMode').value=kind;render();}else{down=null;points=[];layer.replaceChildren();}}
start.addEventListener('click',()=>toggle(!active));$('measureClose').onclick=()=>toggle(false);$('measureMode').onchange=e=>setKind(e.target.value);$('measureClear').onclick=clear;$('measureUndo').onclick=()=>{points.pop();render();};$('measureFinish').onclick=()=>{if(kind!=='chain'||points.length<2)return;lastResults=[...points];$('measureHelp').textContent='連續丈量已完成；可複製結果或清除重新量測。';};$('measureCopy').onclick=()=>{const rows=[`模式：${modes[kind]}`,...points.slice(1).map((p,i)=>`${i+1}. ${fmt(metric(points[i],p))} m`),`合計：${fmt(points.slice(1).reduce((sum,p,i)=>sum+metric(points[i],p),0))} m`];const txt=rows.join('\n');if(navigator.clipboard?.writeText)navigator.clipboard.writeText(txt).then(()=>{$('measureHelp').textContent='已複製丈量結果';}).catch(()=>{$('measureHelp').textContent=txt;});else $('measureHelp').textContent=txt;};
svg.addEventListener('pointerdown',e=>{if(!active||e.button!==0)return;down={id:e.pointerId,x:e.clientX,y:e.clientY};dragged=false;},{capture:true});
svg.addEventListener('pointermove',e=>{if(!active||!down||e.pointerId!==down.id)return;if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>7)dragged=true;},{capture:true});
svg.addEventListener('pointercancel',()=>{down=null;dragged=false;},{capture:true});
svg.addEventListener('pointerup',e=>{if(!active||!down||e.pointerId!==down.id)return;const isTap=!dragged&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<7;down=null;if(!isTap)return;e.preventDefault();const pt=pointFromEvent(e);if((kind!=='chain'&&points.length>=2)||(kind==='chain'&&lastResults.length)){points=[];lastResults=[];}points.push(pt);render();if(snapped)$('measureHelp').textContent='已吸附至 CAD 端點';},{capture:true});
svg.addEventListener('click',e=>{if(active){e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
window.addEventListener('keydown',e=>{if(!active)return;if(e.key==='Escape'){toggle(false);}else if(e.key==='Backspace'&&e.target.tagName!=='INPUT'){points.pop();render();}});
window.addEventListener('resize',()=>{if(active)render();});
})();
