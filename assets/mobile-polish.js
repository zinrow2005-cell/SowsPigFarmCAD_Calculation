/* V2.1.3 - viewport transitions and editor touch affordances, no geometry edits. */
(()=>{'use strict';
const svg=document.getElementById('cadSvg'),viewport=document.getElementById('cadViewport');
if(!svg||!viewport)return;
let lastW=0,lastH=0,frame=0,settle=0;
function update(){frame=0;const r=viewport.getBoundingClientRect();if(r.width<30||r.height<30)return;
 const changed=Math.abs(r.width-lastW)>1||Math.abs(r.height-lastH)>1;
 if(!changed)return;lastW=r.width;lastH=r.height;
 window.HUWEI_UPDATE_LABELS?.(false);
 window.HUWEI_SMART_LABELS?.();
 clearTimeout(settle);settle=setTimeout(()=>{window.HUWEI_REFRESH_REGIONS?.();window.HUWEI_UPDATE_LABELS?.(false);},170);
}
function queue(){if(!frame)frame=requestAnimationFrame(update);}
if(typeof ResizeObserver==='function'){new ResizeObserver(queue).observe(viewport);}
window.addEventListener('orientationchange',()=>{queue();setTimeout(queue,250);});
window.addEventListener('resize',queue,{passive:true});
window.addEventListener('pageshow',queue);
queue();
})();
