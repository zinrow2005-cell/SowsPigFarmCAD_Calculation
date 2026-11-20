(()=>{'use strict';
const M=window.HUWEI_CAD_MODEL,svg=document.getElementById('cadSvg'),layer=document.getElementById('parcelOverlay'),q=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
// V1.4.5: approved-for-planning V1.4.4 default geometry; no editing or storage override.
const parcels=[{"id":"p1226","name":"1226地號(水利地).溝寬4M","points":[[-1.841,-24.8],[-1.841,4.1153],[38.68859734726183,13.378821900047754],[51.42311793393724,-23.880767151641077],[62.0476,-20.217164679112297],[62.0476,-24.448297450605384],[48.935258340974926,-28.969779723712424],[36.06846950278995,8.676809424469141],[2.159,0.9263965430710499],[2.159,-24.8]],"width":4,"status":"西側水利地隨1230參考西界調整；寬4 m；待實測"},{"id":"p1230","name":"1230地號(676平方米)","points":[[38.68859734726183,13.378821900047754],[62.0476,18.7178],[62.0476,-20.217164679112297],[51.42311793393724,-23.880767151641077]],"referenceArea":676,"status":"面積校正參考外框；原圖646.35 m²，非正式地籍界址","registeredArea":676},{"id":"pSouthWater2m","name":"妊娠舍B棟南側水利地（寬2m）","points":[[-1.9175,74.8848],[60.693,74.8848],[60.693,76.8848],[-1.9175,76.8848]],"width":2,"status":"沿母豬場南側外緣左右對齊推繪，貼近妊娠舍B棟南側牆面向南2m；作為規劃參考，不計入母豬場土地與建物遮蔽面積。","planningOnly":true}];
let shown=true;
let southShown=true;
const clone=o=>JSON.parse(JSON.stringify(o));
function area(pts){return Math.abs(pts.reduce((s,p,i)=>{const n=pts[(i+1)%pts.length];return s+p[0]*n[1]-p[1]*n[0]},0))/2;}
function el(tag,attrs,host){const e=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));host.appendChild(e);return e;}
function draw(){layer.replaceChildren();layer.style.display=shown?'':'none';if(shown){for(const p of parcels){if(p.id==='pSouthWater2m'&&!southShown)continue;const g=el('g',{},layer);el('polygon',{points:p.points.map(a=>a.join(',')).join(' '),class:'parcel-geom '+p.id,'pointer-events':'none'},g);const c=p.id==='p1226'?[18.9,6.8]:p.id==='pSouthWater2m'?[29.38775,75.8848]:[48.2,-4.8];el('text',{x:c[0],y:c[1],class:'parcel-label','data-label-id':p.id,'text-anchor':'middle'},g).textContent=p.name;if(p.id==='pSouthWater2m'){const a=p.points[1],b=p.points[2],tx=a[0]-2;el('line',{x1:tx,y1:a[1],x2:tx,y2:b[1],stroke:'#14568b','stroke-width':'.12','pointer-events':'none'},g);el('text',{x:tx-.25,y:(a[1]+b[1])/2,'text-anchor':'end','font-size':'.7',fill:'#14568b','stroke':'#fff','stroke-width':'.16','paint-order':'stroke','pointer-events':'none'},g).textContent='2.00 m';}}}
q('parcelToggle').textContent=shown?'▱ 隱藏新增土地':'▱ 顯示新增土地';q('parcelToggle').setAttribute('aria-pressed',String(shown));window.HUWEI_1230_LAYOUT?.redraw();window.HUWEI_REFRESH_REGIONS?.();}
function fit(points){const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x=Math.min(...xs)-4,y=Math.min(...ys)-4,w=Math.max(...xs)-x+4,h=Math.max(...ys)-y+4;window.HUWEI_SET_CAD_VIEW({x,y,w,h});}
const full=()=>fit([...parcels.flatMap(p=>p.points),...M.regions.flatMap(r=>r.points),...window.HUWEI_CALIBRATION.land]);
q('parcelToggle').onclick=()=>{shown=!shown;draw();};
q('southWaterToggle').onchange=e=>{southShown=Boolean(e.target.checked);draw();};
q('parcelFit').onclick=()=>{shown=true;draw();fit(parcels.flatMap(p=>p.points));};
window.HUWEI_PARCELS={getData:()=>clone(parcels),fitAll:full,show:()=>{shown=true;draw();}};draw();full();
})();