import {ApiError} from './core.mjs';

export function paymentProviderReady(env){
  return env.PAYMENTS_ENABLED==='true'&&env.PAYMENT_PROVIDER&&env.PAYMENT_PROVIDER!=='none';
}

export async function createCheckoutSession(_env,_booking,_request){
  throw new ApiError(503,'PAYMENT_PROVIDER_NOT_CONFIGURED','Payment provider is not connected yet.');
}

export async function verifyPaymentWebhook(_env,_request){
  throw new ApiError(503,'PAYMENT_PROVIDER_NOT_CONFIGURED','Payment webhook verification is not configured yet.');
}

export async function issueRefund(_env,_refund){
  throw new ApiError(503,'PAYMENT_PROVIDER_NOT_CONFIGURED','Automated refunds are not configured yet.');
}
