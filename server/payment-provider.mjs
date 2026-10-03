import {ApiError} from './core.mjs';

const environmentBase=env=>env.DODO_ENVIRONMENT==='live_mode'
  ?'https://live.dodopayments.com'
  :'https://test.dodopayments.com';

export function paymentProviderReady(env){
  return env.PAYMENTS_ENABLED==='true'&&
    env.PAYMENT_PROVIDER==='dodo'&&
    Boolean(env.DODO_PAYMENTS_API_KEY)&&
    Boolean(env.DODO_PRODUCT_ID);
}

const absoluteUrl=(value,request,fallbackPath)=>{
  if(value){
    try{return new URL(value).href;}catch{}
  }
  return new URL(fallbackPath,request.url).href;
};

async function dodoPost(env,path,body){
  if(!env.DODO_PAYMENTS_API_KEY)throw new ApiError(503,'DODO_API_KEY_MISSING','Dodo Payments API key is not configured.');
  let response;
  try{
    response=await fetch(environmentBase(env)+path,{
      method:'POST',
      headers:{
        authorization:'Bearer '+env.DODO_PAYMENTS_API_KEY,
        accept:'application/json',
        'content-type':'application/json'
      },
      body:JSON.stringify(body)
    });
  }catch(error){
    console.error('Dodo API request failed',error);
    throw new ApiError(502,'DODO_API_UNREACHABLE','Could not reach Dodo Payments.');
  }
  const data=await response.json().catch(()=>null);
  if(!response.ok){
    console.error('Dodo API error',response.status,data);
    throw new ApiError(502,'DODO_CHECKOUT_FAILED',data?.message||data?.error?.message||'Could not create the Dodo Payments checkout session.');
  }
  return data;
}

export async function createCheckoutSession(env,booking,request){
  if(!paymentProviderReady(env))throw new ApiError(503,'PAYMENT_PROVIDER_NOT_CONFIGURED','Dodo Payments test mode is not fully configured.');
  const returnUrl=absoluteUrl(
    env.DODO_RETURN_URL,
    request,
    '/?payment=complete&booking_id='+encodeURIComponent(booking.id)
  );
  const cancelUrl=absoluteUrl(
    env.DODO_CANCEL_URL,
    request,
    '/?payment=cancelled&booking_id='+encodeURIComponent(booking.id)
  );

  const params={
    product_cart:[{
      product_id:env.DODO_PRODUCT_ID,
      quantity:1,
      amount:Number(booking.amount_cents)
    }],
    billing_currency:'USD',
    return_url:returnUrl,
    cancel_url:cancelUrl,
    metadata:{
      booking_id:booking.id,
      slot_id:booking.slot_id,
      source:'protest2'
    },
    feature_flags:{
      allow_currency_selection:false,
      allow_discount_code:false
    },
    customization:{
      theme_config:{
        pay_button_text:'Sponsor this spot'
      }
    }
  };

  if(booking.identity_email){
    params.customer={
      email:booking.identity_email,
      name:booking.owner_name||booking.brand_name
    };
  }

  const session=await dodoPost(env,'/checkouts',params);
  if(!session?.session_id||!session?.checkout_url){
    throw new ApiError(502,'DODO_CHECKOUT_INVALID','Dodo Payments did not return a checkout URL.');
  }

  return {
    provider:'dodo',
    checkout_id:session.session_id,
    checkout_url:session.checkout_url
  };
}

const base64Bytes=value=>{
  let normalized=String(value||'').trim().replace(/-/g,'+').replace(/_/g,'/');
  while(normalized.length%4)normalized+='=';
  let raw;
  try{raw=atob(normalized);}catch{throw new Error('Invalid base64');}
  const out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
  return out;
};

const equalBytes=(a,b)=>{
  if(a.length!==b.length)return false;
  let diff=0;
  for(let i=0;i<a.length;i++)diff|=a[i]^b[i];
  return diff===0;
};

async function verifyStandardWebhook(secret,raw,headers){
  const id=headers['webhook-id'];
  const timestampRaw=headers['webhook-timestamp'];
  const signatureHeader=headers['webhook-signature'];
  if(!id||!timestampRaw||!signatureHeader)throw new Error('Missing required webhook headers.');

  const timestamp=Number.parseInt(timestampRaw,10);
  const now=Math.floor(Date.now()/1000);
  if(!Number.isFinite(timestamp)||Math.abs(now-timestamp)>300)throw new Error('Webhook timestamp is outside the allowed window.');

  const encodedSecret=String(secret||'').startsWith('whsec_')?String(secret).slice(6):String(secret||'');
  const keyBytes=base64Bytes(encodedSecret);
  if(!keyBytes.length)throw new Error('Webhook secret is empty.');

  const key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const message=new TextEncoder().encode(id+'.'+timestamp+'.'+raw);
  const expected=new Uint8Array(await crypto.subtle.sign('HMAC',key,message));

  for(const part of signatureHeader.split(' ')){
    const comma=part.indexOf(',');
    if(comma<0||part.slice(0,comma)!=='v1')continue;
    try{
      if(equalBytes(expected,base64Bytes(part.slice(comma+1))))return;
    }catch{}
  }
  throw new Error('Webhook signature does not match.');
}

export async function verifyPaymentWebhook(env,request){
  if(!env.DODO_PAYMENTS_WEBHOOK_KEY)throw new ApiError(503,'DODO_WEBHOOK_KEY_MISSING','Dodo Payments webhook key is not configured.');
  const raw=await request.text();
  const headers={
    'webhook-id':request.headers.get('webhook-id')||'',
    'webhook-signature':request.headers.get('webhook-signature')||'',
    'webhook-timestamp':request.headers.get('webhook-timestamp')||''
  };

  try{
    await verifyStandardWebhook(env.DODO_PAYMENTS_WEBHOOK_KEY,raw,headers);
  }catch(error){
    console.error('Dodo webhook verification failed',error);
    throw new ApiError(400,'DODO_WEBHOOK_INVALID','Dodo webhook signature verification failed.');
  }

  let event;
  try{event=JSON.parse(raw);}catch{throw new ApiError(400,'DODO_WEBHOOK_INVALID_JSON','Dodo webhook body is not valid JSON.');}
  const payment=event?.data||{};
  const bookingId=String(payment?.metadata?.booking_id||'');
  if(!bookingId)throw new ApiError(400,'DODO_BOOKING_METADATA_MISSING','Dodo payment is missing the booking_id metadata.');

  const totalAmount=Number(payment.total_amount)||0;
  const taxAmount=Math.max(0,Number(payment.tax)||0);
  const sponsorshipAmount=Math.max(0,totalAmount-taxAmount);
  if(payment.currency&&String(payment.currency).toUpperCase()!=='USD'){
    throw new ApiError(400,'DODO_CURRENCY_MISMATCH','Dodo payment currency did not match the USD booking.');
  }

  return {
    provider:'dodo',
    event_id:headers['webhook-id'],
    type:String(event.type||''),
    booking_id:bookingId,
    payment_id:String(payment.payment_id||''),
    customer_id:String(payment.customer?.customer_id||''),
    amount_cents:sponsorshipAmount,
    total_charged_cents:totalAmount,
    tax_cents:taxAmount,
    payload_json:raw
  };
}

export async function issueRefund(){
  throw new ApiError(409,'MANUAL_REFUNDS_ENABLED','Refunds are handled manually in the Dodo Payments dashboard.');
}
