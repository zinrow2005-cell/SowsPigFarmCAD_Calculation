/* HUWEI CAD desk handover exporter v1.1.0.
   Preserve all 1,116 user-supplied source entities; the current V1.2.5 DXF includes the corridor north edge and bathroom1 draft geometry. Add named dimension reference layers only.
   Region perimeter sides span door openings and are not physical wall infills. */
(function(){'use strict';
const model=window.HUWEI_CAD_MODEL;
const source=window.HUWEI_CAD_DXF_B64;
if(!model||!source)return;
const digits=v=>Number(v).toFixed(4).replace(/0+$/,'').replace(/\.$/,'')||'0';
const f=n=>String(Number(n).toFixed(3));
function originalText(){const bin=atob(source);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
const lf=s=>s.replace(/\r\n/g,'\n');
const layerCode=[["HW_CALIBRATED_ESTIMATE",2],["HW_LAND_4089_ESTIMATE",6],
 ['HW_VERIFIED_DIM',3],       // green: verified by user, geometry unchanged
 ['HW_PENDING_DIM',30],       // orange: NOT field-verified
 ['HW_FIELD_SKETCH',4],       // user sketched line, not a built wall
 ['HW_DIM_INFO',8],
 ['HW_PARCEL_1230_DRAFT',30],
 ['HW_WATER_1226_DRAFT',5],['HW_PARCEL_DIM', 6],['HW_1230_LAYOUT_REF', 140]           // other supporting reference labels
];
const dxfLayer=([name,color])=>`0\nLAYER\n2\n${name}\n70\n0\n62\n${color}\n6\nCONTINUOUS\n`;
const xy=p=>[p[0],-p[1]]; // SVG measurement Y-down -> original DXF Y-up
function line(a,b,layer){const p=xy(a),q=xy(b);return `0\nLINE\n8\n${layer}\n10\n${digits(p[0])}\n20\n${digits(p[1])}\n30\n0\n11\n${digits(q[0])}\n21\n${digits(q[1])}\n31\n0\n`;}
function textEntity(point,txt,height,angle,layer){const p=xy(point);const safe=String(txt).replace(/[\r\n\x00-\x1f]/g,' ').slice(0,250);return `0\nTEXT\n8\n${layer}\n10\n${digits(p[0])}\n20\n${digits(p[1])}\n30\n0\n40\n${digits(height)}\n1\n${safe}\n50\n${digits(angle)}\n`}
function isValid(e){return e&&Array.isArray(e.a)&&Array.isArray(e.b)&&e.a.length===2&&e.b.length===2&&e.a.concat(e.b).every(Number.isFinite)&&Number.isFinite(Number(e.value))&&Number(e.value)>0;}
function dim(e,layer,offset){const a=e.a,b=e.b,dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<0.07)return '';
 // For polygon boundaries, the outside normal points away from the area's center.
 let nx=-dy/len,ny=dx/len;
 if(e.center){const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],toward=(e.center[0]-mid[0])*nx+(e.center[1]-mid[1])*ny;if(toward>0){nx=-nx;ny=-ny;}}
 const p=[a[0]+nx*offset,a[1]+ny*offset],q=[b[0]+nx*offset,b[1]+ny*offset],t=[(p[0]+q[0])/2+nx*.30,(p[1]+q[1])/2+ny*.30];
 let angle=Math.atan2(-dy,dx)*180/Math.PI;
 if(angle>90)angle-=180;if(angle< -90)angle+=180;
 // The number is the user's audited dimension, not the geometric length of the CAD endpoints.
 const label=`${e.prefix||''}${f(e.value)}m`;
 return line(a,[a[0]+nx*(offset+.11),a[1]+ny*(offset+.11)],layer)+line(b,[b[0]+nx*(offset+.11),b[1]+ny*(offset+.11)],layer)+line(p,q,layer)+textEntity(t,label,0.27,angle,layer);
}
function makeFile(opts={}){
 let text=lf(originalText());
 if(!text.includes('0\nSECTION\n2\nENTITIES\n')||!text.includes('0\nTABLE\n2\nLAYER\n'))throw Error('原始 DXF 結構不完整，已停止輸出');
 if(model.sha256!==opts.sourceSha)throw Error('原 CAD 來源識別不符，已停止輸出');
 const layerTable=/0\nTABLE\n2\nLAYER\n70\n(\d+)\n/;
 if(!layerTable.test(text))throw Error('找不到 DXF 圖層表，已停止輸出');
 let extraLayers='';let created=0;
 for(const row of layerCode){if(!text.includes('0\nLAYER\n2\n'+row[0]+'\n')){extraLayers+=dxfLayer(row);created++;}}
 text=text.replace(layerTable,(all,n)=>all.replace('70\n'+n+'\n','70\n'+(Number(n)+created)+'\n'));
 const start=text.indexOf('0\nTABLE\n2\nLAYER\n'),end=text.indexOf('0\nENDTAB\n',start);
 if(end<0)throw Error('原始 DXF 圖層表不完整');
 text=text.slice(0,end)+extraLayers+text.slice(end);
 let entities='',stats={verified:0,pending:0,fieldSketch:0};
 const add=(e,layer,pad)=>{if(!isValid(e))return;entities+=dim(e,layer,pad);stats[layer==='HW_VERIFIED_DIM'?'verified':'pending']++;};
 for(const e of (opts.entries||[])){
  if(e.status==='verified')add(e,'HW_VERIFIED_DIM',0.48);
  else if(opts.includePending)add({...e,prefix:'PEND '+(e.prefix||'')},'HW_PENDING_DIM',0.68);
 }
 for(const w of(opts.sketches||[])){
  if(!w?.a||!w?.b||!w.a.concat(w.b).every(Number.isFinite))continue;
  entities+=line(w.a,w.b,'HW_FIELD_SKETCH');stats.fieldSketch++;
  if(w.status==='verified'&&Number(w.value)>0)add({...w,prefix:'REF '+(w.prefix||'')},'HW_VERIFIED_DIM',0.36);
  else if(opts.includePending&&Number(w.value)>0)add({...w,prefix:'SKETCH '+(w.prefix||'')},'HW_PENDING_DIM',0.44);
 }
 // Editable cadastral reference polygons. Never added to building coverage totals.
 for(const p of (opts.parcels||[])){
  if(!Array.isArray(p.points)||p.points.length<3||!p.points.every(pt=>Array.isArray(pt)&&pt.length===2&&pt.every(Number.isFinite)))continue;
  const layer=p.id==='p1226'?'HW_WATER_1226_DRAFT':'HW_PARCEL_1230_DRAFT';
  for(let i=0;i<p.points.length;i++){const a=p.points[i],b=p.points[(i+1)%p.points.length];entities+=line(a,b,layer);entities+=dim({a,b,value:Math.hypot(b[0]-a[0],b[1]-a[1]),prefix:`P${i+1}-P${(i+1)%p.points.length+1} `},"HW_PARCEL_DIM",.6);}
  const c=[p.points.reduce((a,b)=>a+b[0],0)/p.points.length,p.points.reduce((a,b)=>a+b[1],0)/p.points.length];
  entities+=textEntity(c,p.name,0.85,0,layer);
 }

 const layout=(window.HUWEI_1230_LAYOUT&&window.HUWEI_1230_LAYOUT.getData)?window.HUWEI_1230_LAYOUT.getData():[];
 for(const [a,b] of (window.HUWEI_1230_LAYOUT?.getLines?.()||[]))entities+=line(a,b,'HW_1230_LAYOUT_REF');
 for(const z of layout){
  if(z.id.endsWith("_open"))continue;
  if(!Array.isArray(z.points)||z.points.length<3) continue;
  
  const c=[z.points.reduce((a,b)=>a+b[0],0)/z.points.length,z.points.reduce((a,b)=>a+b[1],0)/z.points.length];
  entities+=textEntity(c,`${z.name} ${z.area}`,0.55,0,'HW_1230_LAYOUT_REF');
 }

 const cal=window.HUWEI_CALIBRATION;
 if(cal){for(const q of cal.regions){for(const ring of [q.points,...(q.holes||[])])for(let i=0;i<ring.length;i++)entities+=line(ring[i],ring[(i+1)%ring.length],'HW_CALIBRATED_ESTIMATE');}for(let i=0;i<cal.land.length;i++)entities+=line(cal.land[i],cal.land[(i+1)%cal.land.length],'HW_LAND_4089_ESTIMATE');entities+=textEntity([8,cal.land[5][1]-.6],'1231 + 1230-1 / 4089 m2 ESTIMATE - NOT SURVEY',.6,0,'HW_LAND_4089_ESTIMATE');entities+=textEntity([8,42],'CALIBRATED FOOTPRINTS / ESTIMATE ONLY',.6,0,'HW_CALIBRATED_ESTIMATE');}
 const tail=text.lastIndexOf('0\nENDSEC\n0\nEOF');
 const entStart=text.indexOf('0\nSECTION\n2\nENTITIES\n');
 if(tail<entStart)throw Error('無法安全找到 ENTITIES 尾端');
 text=text.slice(0,tail)+entities+text.slice(tail);
 // Assign explicit non-conflicting handles to sparse source records and appended entities.
 const rows=text.trimEnd().split('\n'), pairs=[]; for(let i=0;i<rows.length;i+=2)pairs.push([rows[i],rows[i+1]]);
 let next=Math.max(0x100000,...pairs.filter(p=>p[0].trim()==='5').map(p=>parseInt(p[1],16)||0))+1;
 const records=[];for(const p of pairs){if(p[0].trim()==='0'||!records.length)records.push([]);records[records.length-1].push(p);}
 for(const rec of records){const type=rec[0][1].trim();if(!['SECTION','ENDSEC','ENDTAB','EOF'].includes(type)&&!rec.some(p=>p[0].trim()==='5'))rec.splice(type==='TABLE'?2:1,0,['5',(next++).toString(16).toUpperCase()]);}
 text=records.flat().flat().join('\n')+'\n';
 text=text.replace(/\n/g,'\r\n');
 return {text,stats,bytes:new TextEncoder().encode(text)};
}
window.HUWEI_DXF_EXPORT={makeFile,originalText};
})();
