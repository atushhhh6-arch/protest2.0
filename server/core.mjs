export const TERMS_VERSION='2026-10-03';
export const MAX_LOGO_BYTES=5*1024*1024;
export const ALLOWED_LOGO_TYPES=new Set(['image/png','image/jpeg','image/webp']);

export class ApiError extends Error{
  constructor(status,code,message,details){super(message);this.status=status;this.code=code;this.details=details;}
}

const clean=(value,max,label,{required=false}={})=>{
  const text=String(value??'').trim();
  if(required&&!text)throw new ApiError(400,'INVALID_'+label.toUpperCase().replaceAll(' ','_'),label+' is required.');
  if(text.length>max)throw new ApiError(400,'INVALID_'+label.toUpperCase().replaceAll(' ','_'),label+' is too long.');
  return text;
};

export function safePublicUrl(value){
  const text=clean(value,500,'website');
  if(!text)return '';
  let url;
  try{url=new URL(text);}catch{throw new ApiError(400,'INVALID_WEBSITE','Enter a complete website URL.');}
  if(!['https:','http:'].includes(url.protocol))throw new ApiError(400,'INVALID_WEBSITE','Website must use http:// or https://.');
  return url.href;
}

export function normalizeX(value){
  const text=clean(value,16,'X handle');
  if(!text)return '';
  if(!/^@?[A-Za-z0-9_]{1,15}$/.test(text))throw new ApiError(400,'INVALID_X_HANDLE','Enter a valid X handle.');
  return '@'+text.replace(/^@/,'');
}

export function normalizeEmail(value){
  const text=clean(value,254,'email').toLowerCase();
  if(!text)return '';
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))throw new ApiError(400,'INVALID_EMAIL','Enter a valid email address.');
  return text;
}

export function normalizeBookingInput(body){
  if(!body||typeof body!=='object')throw new ApiError(400,'INVALID_BODY','Send booking details as JSON.');
  const slotId=clean(body.slot_id,3,'spot',{required:true}).toUpperCase();
  if(!/^[FB](0[1-7])$/.test(slotId))throw new ApiError(400,'INVALID_SPOT','Choose a valid spot.');
  const amount=Number(body.amount_cents);
  if(!Number.isSafeInteger(amount)||amount<=0||amount>100_000_000)throw new ApiError(400,'INVALID_AMOUNT','Enter a valid sponsorship amount.');
  return {
    slotId,
    amountCents:amount,
    ownerName:clean(body.owner_name,80,'owner name'),
    brandName:clean(body.brand_name,80,'brand name',{required:true}),
    description:clean(body.description,300,'description',{required:true}),
    website:safePublicUrl(body.website),
    xHandle:normalizeX(body.x_handle),
    identityEmail:normalizeEmail(body.email),
    termsVersion:clean(body.terms_version||TERMS_VERSION,40,'terms version',{required:true})
  };
}

export function minimumForPlacement(row){
  const current=Number(row?.current_amount_cents)||0;
  const base=Number(row?.base_cents)||0;
  return current>0?current*2:base;
}

export function isPrintLocked(settings,placement,now=new Date()){
  if(Number(placement?.print_locked)===1)return true;
  const raw=settings?.print_lock_at;
  if(!raw)return false;
  const when=new Date(raw);
  return !Number.isNaN(when.valueOf())&&now>=when;
}

export function validateLogoMeta(contentType,size){
  if(!ALLOWED_LOGO_TYPES.has(contentType))throw new ApiError(415,'INVALID_LOGO_TYPE','Logo must be PNG, JPG or WebP.');
  if(!Number.isSafeInteger(size)||size<=0||size>MAX_LOGO_BYTES)throw new ApiError(413,'LOGO_TOO_LARGE','Logo must be 5 MB or smaller.');
}

export function logoExtension(contentType){
  return contentType==='image/png'?'png':contentType==='image/webp'?'webp':'jpg';
}


export function normalizeProfileUpdate(body){
  if(!body||typeof body!=='object')throw new ApiError(400,'INVALID_BODY','Send profile details as JSON.');
  return {
    ownerName:clean(body.owner_name,80,'owner name'),
    description:clean(body.description,300,'description',{required:true}),
    website:safePublicUrl(body.website),
    xHandle:normalizeX(body.x_handle)
  };
}
