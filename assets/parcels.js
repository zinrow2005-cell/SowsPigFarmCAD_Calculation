(()=>{'use strict';
const M=window.HUWEI_CAD_MODEL,svg=document.getElementById('cadSvg'),layer=document.getElementById('parcelOverlay'),q=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
// V1.4.5: approved-for-planning V1.4.4 default geometry; no editing or storage override.
const parcels=[{"id": "p1226", "name": "1226地號(水利地).溝寬4M", "points": [[-1.841, -24.8], [-1.841, 4.1153], [40.165, 13.716271300044138], [52.2097844753633, -26.50787875059609], [48.377890937424475, -27.655307142219144], [37.406937257607716, 8.982732161698106], [2.159, 0.9263965430710499], [2.159, -24.8]], "width": 4, "status": "南緣沿原CAD北界"}, {"id": "p1230", "name": "1230地號(676平方米)", "points": [[52.2097844753633, -26.50787875059609], [62.0476, -23.115539711739064], [62.0476, 18.7178], [40.165, 13.716271300044138]], "referenceArea": 676, "status": "南緣沿原CAD北界；圖面參考"}];
let shown=true;
const clone=o=>JSON.parse(JSON.stringify(o));
function area(pts){return Math.abs(pts.reduce((s,p,i)=>{const n=pts[(i+1)%pts.length];return s+p[0]*n[1]-p[1]*n[0]},0))/2;}
function el(tag,attrs,host){const e=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));host.appendChild(e);return e;}
function draw(){layer.replaceChildren();layer.style.display=shown?'':'none';if(shown){for(const p of parcels){const g=el('g',{},layer);el('polygon',{points:p.points.map(a=>a.join(',')).join(' '),class:'parcel-geom '+p.id},g);const c=p.id==='p1226'?[(p.points[1][0]+p.points[2][0])/2,(p.points[1][1]+p.points[2][1])/2-2]:[48.2,-4.8];el('text',{x:c[0],y:c[1],class:'parcel-label','data-label-id':p.id,'text-anchor':'middle'},g).textContent=p.id==='p1226'?'1226地號(水利地).溝寬4M':'1230地號(676平方米)';}}
q('parcelToggle').textContent=shown?'▱ 隱藏新增土地':'▱ 顯示新增土地';q('parcelToggle').setAttribute('aria-pressed',String(shown));window.HUWEI_1230_LAYOUT?.redraw();window.HUWEI_REFRESH_REGIONS?.();}
function fit(points){const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x=Math.min(...xs)-4,y=Math.min(...ys)-4,w=Math.max(...xs)-x+4,h=Math.max(...ys)-y+4;window.HUWEI_SET_CAD_VIEW({x,y,w,h});}
const full=()=>fit([...parcels.flatMap(p=>p.points),...M.regions.flatMap(r=>r.points),...window.HUWEI_CALIBRATION.land]);
q('parcelToggle').onclick=()=>{shown=!shown;draw();};
q('parcelFit').onclick=()=>{shown=true;draw();fit(parcels.flatMap(p=>p.points));};
window.HUWEI_PARCELS={getData:()=>clone(parcels),fitAll:full,show:()=>{shown=true;draw();}};draw();full();
})();