export const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
export function fitTransform(w,h,iw,ih,fill=false){return {x:w/2,y:h/2,scale:(fill?Math.max:Math.min)(w/iw,h/ih)};}
export function zoomTransform(t,x,y,factor,min,max){const scale=clamp(t.scale*factor,min,max),r=scale/t.scale;return {x:x+(t.x-x)*r,y:y+(t.y-y)*r,scale};}
export function boundedTransform(t,w,h,iw,ih){const margin=Math.min(24,w/5,h/5);return {...t,x:clamp(t.x,margin-iw*t.scale/2,w-margin+iw*t.scale/2),y:clamp(t.y,margin-ih*t.scale/2,h-margin+ih*t.scale/2)};}
