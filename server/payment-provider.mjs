import DodoPayments from 'dodopayments';
import {ApiError} from './core.mjs';

const mode=env=>env.DODO_ENVIRONMENT==='live_mode'?'live_mode':'test_mode';

const client=env=>{
  if(!env.DODO_PAYMENTS_API_KEY)throw new ApiError(503,'DODO_API_KEY_MISSING','Dodo Payments API key is not configured.');
  return new DodoPayments({
    bearerToken:env.DODO_PAYMENTS_API_KEY,
    webhookKey:env.DODO_PAYMENTS_WEBHOOK_KEY||null,
    environment:mode(env),
    maxRetries:1,
    timeout:20000
  });
};

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

export async function createCheckoutSession(env,booking,request){
  if(!paymentProviderReady(env))throw new ApiError(503,'PAYMENT_PROVIDER_NOT_CONFIGURED','Dodo Payments test mode is not fully configured.');
  const dodo=client(env);
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
    customization:{
      pay_button_text:'Sponsor this spot'
    }
  };

  if(booking.identity_email){
    params.customer={
      email:booking.identity_email,
      name:booking.owner_name||booking.brand_name
    };
  }

  let session;
  try{
    session=await dodo.checkoutSessions.create(params);
  }catch(error){
    console.error('Dodo checkout creation failed',error);
    throw new ApiError(502,'DODO_CHECKOUT_FAILED','Could not create the Dodo Payments checkout session.');
  }

  if(!session?.session_id||!session?.checkout_url){
    throw new ApiError(502,'DODO_CHECKOUT_INVALID','Dodo Payments did not return a checkout URL.');
  }

  return {
    provider:'dodo',
    checkout_id:session.session_id,
    checkout_url:session.checkout_url
  };
}

export async function verifyPaymentWebhook(env,request){
  if(!env.DODO_PAYMENTS_WEBHOOK_KEY)throw new ApiError(503,'DODO_WEBHOOK_KEY_MISSING','Dodo Payments webhook key is not configured.');
  const raw=await request.text();
  const headers={
    'webhook-id':request.headers.get('webhook-id')||'',
    'webhook-signature':request.headers.get('webhook-signature')||'',
    'webhook-timestamp':request.headers.get('webhook-timestamp')||''
  };
  if(!headers['webhook-id']||!headers['webhook-signature']||!headers['webhook-timestamp']){
    throw new ApiError(400,'DODO_WEBHOOK_HEADERS_MISSING','Required Dodo webhook headers are missing.');
  }

  let event;
  try{
    event=client(env).webhooks.unwrap(raw,{headers});
  }catch(error){
    console.error('Dodo webhook verification failed',error);
    throw new ApiError(400,'DODO_WEBHOOK_INVALID','Dodo webhook signature verification failed.');
  }

  const payment=event?.data||{};
  const bookingId=String(payment?.metadata?.booking_id||'');
  if(!bookingId)throw new ApiError(400,'DODO_BOOKING_METADATA_MISSING','Dodo payment is missing the booking_id metadata.');

  return {
    provider:'dodo',
    event_id:headers['webhook-id'],
    type:String(event.type||''),
    booking_id:bookingId,
    payment_id:String(payment.payment_id||''),
    customer_id:String(payment.customer?.customer_id||''),
    amount_cents:Number(payment.total_amount)||0,
    payload_json:raw
  };
}

export async function issueRefund(){
  throw new ApiError(409,'MANUAL_REFUNDS_ENABLED','Refunds are handled manually in the Dodo Payments dashboard.');
}
