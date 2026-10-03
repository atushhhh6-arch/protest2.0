import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBookingInput,normalizeProfileUpdate,minimumForPlacement,validateLogoMeta,ApiError} from './core.mjs';

test('normalizes a valid booking',()=>{
  const result=normalizeBookingInput({
    slot_id:'f01',amount_cents:20000,brand_name:'Brand',description:'Desc',
    website:'https://example.com',x_handle:'@brand',terms_version:'2026-10-03'
  });
  assert.equal(result.slotId,'F01');
  assert.equal(result.amountCents,20000);
  assert.equal(result.xHandle,'@brand');
});

test('rejects invalid amount',()=>{
  assert.throws(()=>normalizeBookingInput({slot_id:'F01',amount_cents:0,brand_name:'A',description:'B',terms_version:'2026-10-03'}),ApiError);
});

test('computes takeover minimum',()=>{
  assert.equal(minimumForPlacement({base_cents:20000,current_amount_cents:null}),20000);
  assert.equal(minimumForPlacement({base_cents:20000,current_amount_cents:50000}),100000);
});

test('validates logo limits',()=>{
  assert.doesNotThrow(()=>validateLogoMeta('image/png',1024));
  assert.throws(()=>validateLogoMeta('image/gif',1024),ApiError);
});


test('normalizes profile updates',()=>{
  const result=normalizeProfileUpdate({owner_name:'Owner',description:'Updated',website:'https://example.com',x_handle:'brand'});
  assert.equal(result.xHandle,'@brand');
  assert.equal(result.description,'Updated');
});
