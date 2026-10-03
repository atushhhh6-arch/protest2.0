import {ApiError,normalizeBookingInput,normalizeProfileUpdate,validateLogoMeta,logoExtension} from './core.mjs';
import {publicState,createBookingHold,bookingForToken,setBookingLogo,markCheckoutCreated,finalizePaidBooking,myBooking,readSettings,recordView,updateSponsorProfile} from './db.mjs';
import {paymentProviderReady,createCheckoutSession,verifyPaymentWebhook,issueRefund} from './payment-provider.mjs';

const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{
  status,
  headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}
});
const ok=data=>json({ok:true,...data});
const fail=error=>{
  if(error instanceof ApiError)return json({ok:false,error:error.code,message:error.message,details:error.details??null},error.status);
  console.error(error);
  return json({ok:false,error:'INTERNAL_ERROR',message:'Unexpected server error.'},500);
};
const requireDb=env=>{if(!env.DB)throw new ApiError(503,'DATABASE_NOT_CONFIGURED','Database binding is not configured.');return env.DB;};
const requireLogos=env=>{if(!env.LOGOS)throw new ApiError(503,'LOGO_STORAGE_NOT_CONFIGURED','Logo storage binding is not configured.');return env.LOGOS;};
const bearer=request=>{
  const value=request.headers.get('authorization')||'';
  const match=value.match(/^Bearer\s+(.+)$/i);
  if(!match)throw new ApiError(401,'AUTH_REQUIRED','Booking access token is required.');
  return match[1].trim();
};
const admin=(request,env)=>{
  const value=request.headers.get('authorization')||'';
  const expected=env.ADMIN_SECRET;
  if(!expected||value!==`Bearer ${expected}`)throw new ApiError(401,'ADMIN_AUTH_REQUIRED','Admin authorization failed.');
};
const randomToken=()=>{
  const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
  return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
};
const hash=async text=>{
  const bytes=new TextEncoder().encode(text);
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  return [...digest].map(b=>b.toString(16).padStart(2,'0')).join('');
};
const parseJson=async request=>{try{return await request.json();}catch{throw new ApiError(400,'INVALID_JSON','Request body must be valid JSON.');}};
const holdMinutes=env=>Math.min(30,Math.max(5,Number(env.BOOKING_HOLD_MINUTES)||15));

async function verifyTurnstile(body,request,env){
  if(env.TURNSTILE_REQUIRED!=='true')return;
  if(!env.TURNSTILE_SECRET)throw new ApiError(503,'TURNSTILE_NOT_CONFIGURED','Bot protection is required but not configured.');
  const token=String(body.turnstile_token||'').trim();
  if(!token)throw new ApiError(400,'TURNSTILE_REQUIRED','Complete the verification challenge.');
  const form=new URLSearchParams();
  form.set('secret',env.TURNSTILE_SECRET);
  form.set('response',token);
  const ip=request.headers.get('cf-connecting-ip');
  if(ip)form.set('remoteip',ip);
  const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
    method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form
  });
  const result=await response.json().catch(()=>null);
  if(!result?.success)throw new ApiError(403,'TURNSTILE_FAILED','Verification failed. Try again.');
}

async function viewerHash(request,env){
  if(!env.VIEW_HASH_SALT)return '';
  const ip=request.headers.get('cf-connecting-ip')||'';
  const ua=(request.headers.get('user-agent')||'').slice(0,180);
  const day=new Date().toISOString().slice(0,10);
  return hash([env.VIEW_HASH_SALT,ip,ua,day].join('|'));
}

async function route(request,env,ctx){
  const url=new URL(request.url);
  const path=url.pathname;
  const method=request.method.toUpperCase();

  if(path==='/api/health'&&method==='GET'){
    let settings={};
    if(env.DB){try{settings=await readSettings(env.DB);}catch{}}
    return ok({
      backend:'protest2-v1',
      database:Boolean(env.DB),
      logo_storage:Boolean(env.LOGOS),
      payment_provider:paymentProviderReady(env),
      bookings_open:settings.bookings_open==='1',
      print_lock_at:settings.print_lock_at||''
    });
  }

  if(path==='/api/config'&&method==='GET'){
    const settings=await readSettings(requireDb(env));
    return ok({
      bookings_open:settings.bookings_open==='1'&&paymentProviderReady(env),
      database_bookings_open:settings.bookings_open==='1',
      payment_provider_ready:paymentProviderReady(env),
      print_lock_at:settings.print_lock_at||'',
      terms_version:settings.terms_version||''
    });
  }

  if(path==='/api/public-state'&&method==='GET')return ok(await publicState(requireDb(env)));

  if(path==='/api/bookings/prepare'&&method==='POST'){
    const db=requireDb(env);
    if(!paymentProviderReady(env))throw new ApiError(503,'PAYMENT_PROVIDER_NOT_CONFIGURED','Payments are still disabled.');
    const body=await parseJson(request);
    await verifyTurnstile(body,request,env);
    const input=normalizeBookingInput(body);
    const bookingId=crypto.randomUUID();
    const token=randomToken();
    const tokenHash=await hash(token);
    const created=await createBookingHold(db,input,{bookingId,tokenHash,holdMinutes:holdMinutes(env)});
    return ok({
      booking_id:bookingId,
      manage_token:token,
      hold_expires_at:created.expiresAt,
      minimum_cents:created.minimumCents,
      amount_cents:input.amountCents,
      next_minimum_cents:input.amountCents*2
    });
  }

  const logoMatch=path.match(/^\/api\/bookings\/([^/]+)\/logo$/);
  if(logoMatch&&method==='PUT'){
    const db=requireDb(env),bucket=requireLogos(env);
    const tokenHash=await hash(bearer(request));
    const booking=await bookingForToken(db,tokenHash,decodeURIComponent(logoMatch[1]));
    const contentType=(request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
    const body=await request.arrayBuffer();
    validateLogoMeta(contentType,body.byteLength);
    if(!['pending','checkout_created'].includes(booking.status))throw new ApiError(409,'BOOKING_NOT_EDITABLE','This booking can no longer be edited.');
    const assetId=crypto.randomUUID();
    const key=`logos/${booking.id}/${assetId}.${logoExtension(contentType)}`;
    await bucket.put(key,body,{httpMetadata:{contentType,cacheControl:'public, max-age=31536000, immutable'}});
    try{
      await db.batch([
        db.prepare("INSERT INTO assets(id,booking_id,object_key,content_type,size_bytes,is_public,moderation_status,created_at) VALUES(?,?,?,?,?,0,'pending',?)")
          .bind(assetId,booking.id,key,contentType,body.byteLength,new Date().toISOString()),
        db.prepare('UPDATE bookings SET logo_asset_id=?,updated_at=? WHERE id=?')
          .bind(assetId,new Date().toISOString(),booking.id)
      ]);
      await setBookingLogo(db,booking.id,assetId);
    }catch(error){
      ctx.waitUntil(bucket.delete(key));
      throw error;
    }
    return ok({asset_id:assetId});
  }

  const assetMatch=path.match(/^\/api\/assets\/([^/]+)$/);
  if(assetMatch&&method==='GET'){
    const db=requireDb(env),bucket=requireLogos(env);
    const asset=await db.prepare('SELECT * FROM assets WHERE id=? AND is_public=1').bind(decodeURIComponent(assetMatch[1])).first();
    if(!asset)throw new ApiError(404,'ASSET_NOT_FOUND','Asset not found.');
    const object=await bucket.get(asset.object_key);
    if(!object)throw new ApiError(404,'ASSET_NOT_FOUND','Asset not found.');
    return new Response(object.body,{headers:{'content-type':asset.content_type,'cache-control':'public, max-age=86400','etag':object.httpEtag||''}});
  }

  if(path==='/api/payments/session'&&method==='POST'){
    const db=requireDb(env);
    const tokenHash=await hash(bearer(request));
    const body=await parseJson(request);
    const booking=await bookingForToken(db,tokenHash,String(body.booking_id||''));
    if(!booking.logo_asset_id)throw new ApiError(409,'LOGO_REQUIRED','Upload the approved logo before checkout.');
    const asset=await db.prepare('SELECT moderation_status FROM assets WHERE id=?').bind(booking.logo_asset_id).first();
    if(asset?.moderation_status!=='approved')throw new ApiError(409,'LOGO_NOT_APPROVED','Logo must be approved before payment can start.');
    if(!['pending','checkout_created'].includes(booking.status))throw new ApiError(409,'BOOKING_NOT_PAYABLE','This booking cannot be paid.');
    if(new Date(booking.hold_expires_at)<=new Date())throw new ApiError(409,'BOOKING_EXPIRED','This booking hold has expired.');
    if(!paymentProviderReady(env))throw new ApiError(503,'PAYMENT_PROVIDER_NOT_CONFIGURED','Payment provider is not connected yet.');
    const session=await createCheckoutSession(env,booking,request);
    await markCheckoutCreated(db,booking.id,session.provider,session.checkout_id);
    return ok({checkout_url:session.checkout_url,checkout_id:session.checkout_id,provider:session.provider});
  }

  if(path==='/api/webhooks/payment'&&method==='POST'){
    const db=requireDb(env);
    if(!paymentProviderReady(env))throw new ApiError(503,'PAYMENT_PROVIDER_NOT_CONFIGURED','Payment webhook is not active.');
    const event=await verifyPaymentWebhook(env,request);
    const existing=await db.prepare('SELECT * FROM payment_events WHERE provider=? AND event_id=?').bind(event.provider,event.event_id).first();
    if(existing?.status==='processed')return ok({duplicate:true});
    if(!existing){
      await db.prepare('INSERT INTO payment_events(provider,event_id,event_type,booking_id,payload_json,status,created_at) VALUES(?,?,?,?,?,?,?)')
        .bind(event.provider,event.event_id,event.type,event.booking_id,event.payload_json||'', 'received',new Date().toISOString()).run();
    }
    try{
      if(event.type==='payment.succeeded'){
        await finalizePaidBooking(db,{
          bookingId:event.booking_id,provider:event.provider,paymentId:event.payment_id,
          customerId:event.customer_id||'',amountCents:event.amount_cents
        });
      }
      await db.prepare("UPDATE payment_events SET status='processed',processed_at=? WHERE provider=? AND event_id=?")
        .bind(new Date().toISOString(),event.provider,event.event_id).run();
    }catch(error){
      await db.prepare("UPDATE payment_events SET status='failed',last_error=? WHERE provider=? AND event_id=?")
        .bind(String(error?.message||error).slice(0,500),event.provider,event.event_id).run();
      throw error;
    }
    return ok({processed:true});
  }

  if(path==='/api/me'&&method==='GET'){
    const tokenHash=await hash(bearer(request));
    const data=await myBooking(requireDb(env),tokenHash);
    return ok({booking:{
      id:data.booking.id,slot_id:data.booking.slot_id,amount_cents:data.booking.amount_cents,status:data.booking.status,
      hold_expires_at:data.booking.hold_expires_at,paid_at:data.booking.paid_at||'',created_at:data.booking.created_at
    },sponsor:data.sponsor,refunds:data.refunds});
  }

  const viewMatch=path.match(/^\/api\/sponsors\/([^/]+)\/view$/);
  if(viewMatch&&method==='POST'){
    const db=requireDb(env);
    const sponsorId=decodeURIComponent(viewMatch[1]);
    const exists=await db.prepare("SELECT id FROM sponsors WHERE id=? AND status='active'").bind(sponsorId).first();
    if(!exists)throw new ApiError(404,'SPONSOR_NOT_FOUND','Sponsor not found.');
    const day=new Date().toISOString().slice(0,10);
    const vhash=await viewerHash(request,env);
    return ok(await recordView(db,{sponsorId,viewerHash:vhash,day}));
  }

  if(path==='/api/admin/overview'&&method==='GET'){
    admin(request,env);
    const db=requireDb(env);
    const [bookings,refunds,holds]=await Promise.all([
      db.prepare("SELECT id,slot_id,amount_cents,status,brand_name,created_at,paid_at FROM bookings ORDER BY created_at DESC LIMIT 100").all(),
      db.prepare("SELECT * FROM refunds WHERE status!='succeeded' ORDER BY created_at ASC LIMIT 100").all(),
      db.prepare("SELECT * FROM spot_holds ORDER BY expires_at ASC").all()
    ]);
    return ok({bookings:bookings.results||[],refunds:refunds.results||[],holds:holds.results||[]});
  }

  if(path==='/api/admin/settings'&&method==='POST'){
    admin(request,env);
    const db=requireDb(env),body=await parseJson(request),now=new Date().toISOString();
    const statements=[];
    if(typeof body.bookings_open==='boolean')statements.push(db.prepare("INSERT INTO settings(key,value,updated_at) VALUES('bookings_open',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(body.bookings_open?'1':'0',now));
    if(body.print_lock_at!==undefined){
      const value=String(body.print_lock_at||'');
      if(value&&!Number.isFinite(new Date(value).valueOf()))throw new ApiError(400,'INVALID_PRINT_LOCK','print_lock_at must be an ISO date or empty.');
      statements.push(db.prepare("INSERT INTO settings(key,value,updated_at) VALUES('print_lock_at',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(value,now));
    }
    if(statements.length)await db.batch(statements);
    return ok({settings:await readSettings(db)});
  }

  const refundMatch=path.match(/^\/api\/admin\/refunds\/([^/]+)\/status$/);
  if(refundMatch&&method==='POST'){
    admin(request,env);
    const db=requireDb(env),body=await parseJson(request);
    const allowed=new Set(['pending','processing','succeeded','failed']);
    if(!allowed.has(body.status))throw new ApiError(400,'INVALID_REFUND_STATUS','Invalid refund status.');
    await db.prepare('UPDATE refunds SET status=?,provider_refund_id=?,updated_at=? WHERE id=?')
      .bind(body.status,String(body.provider_refund_id||''),new Date().toISOString(),decodeURIComponent(refundMatch[1])).run();
    return ok({updated:true});
  }

  const testPaid=path.match(/^\/api\/admin\/bookings\/([^/]+)\/mark-paid$/);
  if(testPaid&&method==='POST'){
    admin(request,env);
    if(env.ALLOW_TEST_PAYMENTS!=='true')throw new ApiError(403,'TEST_PAYMENTS_DISABLED','Test payment finalization is disabled.');
    const db=requireDb(env),id=decodeURIComponent(testPaid[1]);
    const booking=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(id).first();
    if(!booking)throw new ApiError(404,'BOOKING_NOT_FOUND','Booking not found.');
    const result=await finalizePaidBooking(db,{bookingId:id,provider:'manual_test',paymentId:'test_'+crypto.randomUUID(),amountCents:booking.amount_cents});
    return ok(result);
  }

  if(path==='/api/admin/refunds/process'&&method==='POST'){
    admin(request,env);
    if(!paymentProviderReady(env))throw new ApiError(503,'PAYMENT_PROVIDER_NOT_CONFIGURED','Automated refunds are not configured.');
    const db=requireDb(env);
    const {results=[]}=await db.prepare("SELECT * FROM refunds WHERE status='pending' ORDER BY created_at ASC LIMIT 20").all();
    const processed=[];
    for(const refund of results){
      try{
        await db.prepare("UPDATE refunds SET status='processing',updated_at=? WHERE id=?").bind(new Date().toISOString(),refund.id).run();
        const issued=await issueRefund(env,refund);
        await db.prepare("UPDATE refunds SET status='succeeded',provider_refund_id=?,updated_at=? WHERE id=?")
          .bind(issued.refund_id,new Date().toISOString(),refund.id).run();
        processed.push({id:refund.id,status:'succeeded'});
      }catch(error){
        await db.prepare("UPDATE refunds SET status='failed',last_error=?,updated_at=? WHERE id=?")
          .bind(String(error?.message||error).slice(0,500),new Date().toISOString(),refund.id).run();
        processed.push({id:refund.id,status:'failed'});
      }
    }
    return ok({processed});
  }

  if(path.startsWith('/api/'))throw new ApiError(404,'API_NOT_FOUND','API route not found.');
  return env.ASSETS?env.ASSETS.fetch(request):new Response('Not found',{status:404});
}

export default{
  async fetch(request,env,ctx){
    try{return await route(request,env,ctx);}catch(error){return fail(error);}
  }
};
