import {ApiError,minimumForPlacement,isPrintLocked} from './core.mjs';

export async function readSettings(db){
  const {results=[]}=await db.prepare('SELECT key,value FROM settings').all();
  return Object.fromEntries(results.map(row=>[row.key,row.value]));
}

export async function publicState(db){
  const settings=await readSettings(db);
  const {results:placements=[]}=await db.prepare(`
    SELECT p.slot_id,p.name,p.location,p.base_cents,p.version,p.print_locked,
           p.current_booking_id,p.current_amount_cents,
           s.id AS sponsor_id,s.brand_name,s.description,s.website,s.x_handle,s.views,
           a.id AS logo_asset_id,b.paid_at
    FROM placements p
    LEFT JOIN sponsors s ON s.id=p.current_sponsor_id AND s.status='active'
    LEFT JOIN bookings b ON b.id=p.current_booking_id
    LEFT JOIN assets a ON a.id=p.current_logo_asset_id AND a.is_public=1
    ORDER BY CASE WHEN substr(p.slot_id,1,1)='F' THEN 0 ELSE 1 END,
             CAST(substr(p.slot_id,2) AS INTEGER)
  `).all();
  const {results:activity=[]}=await db.prepare(`
    SELECT a.id,a.event_type,a.slot_id,a.sponsor_id,a.booking_id,a.amount_cents,
           a.previous_booking_id,a.previous_brand_name,a.previous_amount_cents,a.created_at,
           s.brand_name
    FROM activity a
    LEFT JOIN sponsors s ON s.id=a.sponsor_id
    ORDER BY a.created_at DESC
    LIMIT 30
  `).all();
  return {
    settings:{
      bookings_open:settings.bookings_open==='1',
      print_lock_at:settings.print_lock_at||'',
      terms_version:settings.terms_version||''
    },
    placements:placements.map(row=>({
      slot_id:row.slot_id,
      name:row.name,
      location:row.location,
      base_cents:row.base_cents,
      current_amount_cents:row.current_amount_cents||0,
      minimum_cents:minimumForPlacement(row),
      version:row.version,
      print_locked:isPrintLocked(settings,row),
      current_booking_id:row.current_booking_id||null,
      sponsor:row.sponsor_id?{
        id:row.sponsor_id,
        brand_name:row.brand_name,
        description:row.description,
        website:row.website||'',
        x_handle:row.x_handle||'',
        views:Number(row.views)||0,
        logo_url:row.logo_asset_id?'/api/assets/'+encodeURIComponent(row.logo_asset_id):'',
        paid_at:row.paid_at||''
      }:null
    })),
    activity
  };
}

export async function createBookingHold(db,input,{bookingId,tokenHash,holdMinutes,now=new Date()}){
  const settings=await readSettings(db);
  if(settings.bookings_open!=='1')throw new ApiError(403,'BOOKINGS_CLOSED','Bookings are not open yet.');
  const placement=await db.prepare('SELECT * FROM placements WHERE slot_id=?').bind(input.slotId).first();
  if(!placement)throw new ApiError(404,'SPOT_NOT_FOUND','Spot not found.');
  if(isPrintLocked(settings,placement,now))throw new ApiError(409,'PRINT_LOCKED','This spot is locked for printing.');
  const minimum=minimumForPlacement(placement);
  if(input.amountCents<minimum)throw new ApiError(409,'BID_TOO_LOW','Minimum for this spot has changed.',{minimum_cents:minimum});
  if(input.termsVersion!==(settings.terms_version||''))throw new ApiError(409,'TERMS_CHANGED','Terms were updated. Reload and accept the latest version.',{terms_version:settings.terms_version||''});
  const expiresAt=new Date(now.getTime()+holdMinutes*60_000).toISOString();
  let result;
  try{
    result=await db.batch([
      db.prepare("UPDATE bookings SET status='expired',updated_at=? WHERE status IN ('pending','checkout_created') AND hold_expires_at<=?")
        .bind(now.toISOString(),now.toISOString()),
      db.prepare('DELETE FROM spot_holds WHERE slot_id=? AND expires_at<=?').bind(input.slotId,now.toISOString()),
      db.prepare(`
        INSERT INTO bookings(
          id,slot_id,amount_cents,expected_version,status,hold_expires_at,manage_token_hash,
          owner_name,brand_name,description,website,x_handle,identity_email,terms_version,created_at,updated_at
        )
        SELECT ?,p.slot_id,?,p.version,'pending',?,?,?,?,?,?,?,?,?,?,?
        FROM placements p
        WHERE p.slot_id=?
          AND p.print_locked=0
          AND p.version=?
          AND ?>=CASE WHEN COALESCE(p.current_amount_cents,0)>0 THEN p.current_amount_cents*2 ELSE p.base_cents END
      `).bind(
        bookingId,input.amountCents,expiresAt,tokenHash,
        input.ownerName,input.brandName,input.description,input.website,input.xHandle,input.identityEmail,
        input.termsVersion,now.toISOString(),now.toISOString(),
        input.slotId,placement.version,input.amountCents
      ),
      db.prepare(`
        INSERT INTO spot_holds(slot_id,booking_id,expires_at,created_at)
        SELECT ?,?,?,?
        WHERE EXISTS(SELECT 1 FROM bookings WHERE id=?)
      `).bind(input.slotId,bookingId,expiresAt,now.toISOString(),bookingId)
    ]);
  }catch(error){
    if(String(error).toLowerCase().includes('unique'))throw new ApiError(409,'SPOT_BUSY','Someone else is checking out this spot. Try again shortly.');
    throw error;
  }
  const inserted=Number(result?.[2]?.meta?.changes)||0;
  if(!inserted){
    const fresh=await db.prepare('SELECT * FROM placements WHERE slot_id=?').bind(input.slotId).first();
    const latestSettings=await readSettings(db);
    if(isPrintLocked(latestSettings,fresh,now))throw new ApiError(409,'PRINT_LOCKED','This spot is locked for printing.');
    throw new ApiError(409,'SPOT_CHANGED','This spot changed. Reload it before paying.',{minimum_cents:minimumForPlacement(fresh),version:fresh?.version});
  }
  return {bookingId,expiresAt,minimumCents:minimum,expectedVersion:placement.version};
}

export async function bookingForToken(db,tokenHash,bookingId=''){
  const sql=bookingId
    ?'SELECT * FROM bookings WHERE id=? AND manage_token_hash=?'
    :'SELECT * FROM bookings WHERE manage_token_hash=? ORDER BY created_at DESC LIMIT 1';
  const row=bookingId
    ?await db.prepare(sql).bind(bookingId,tokenHash).first()
    :await db.prepare(sql).bind(tokenHash).first();
  if(!row)throw new ApiError(401,'INVALID_BOOKING_TOKEN','Booking access token is invalid.');
  return row;
}

export async function setBookingLogo(db,bookingId,assetId,now=new Date()){
  const result=await db.prepare(`
    UPDATE bookings
    SET logo_asset_id=?,updated_at=?
    WHERE id=? AND status IN ('pending','checkout_created')
      AND hold_expires_at>?
  `).bind(assetId,now.toISOString(),bookingId,now.toISOString()).run();
  if(!(Number(result.meta?.changes)||0))throw new ApiError(409,'BOOKING_EXPIRED','This booking hold has expired.');
}

export async function markCheckoutCreated(db,bookingId,provider,checkoutId,now=new Date()){
  await db.prepare(`
    UPDATE bookings SET status='checkout_created',payment_provider=?,provider_checkout_id=?,updated_at=?
    WHERE id=? AND status='pending'
  `).bind(provider,checkoutId,now.toISOString(),bookingId).run();
}

export async function markPaymentFailed(db,{bookingId,provider='',paymentId='',customerId='',now=new Date()}){
  await db.batch([
    db.prepare(`
      UPDATE bookings
      SET status='failed',payment_provider=?,provider_payment_id=?,provider_customer_id=?,updated_at=?
      WHERE id=? AND status IN ('pending','checkout_created')
    `).bind(provider,paymentId,customerId,now.toISOString(),bookingId),
    db.prepare('DELETE FROM spot_holds WHERE booking_id=?').bind(bookingId)
  ]);
  return await db.prepare('SELECT * FROM bookings WHERE id=?').bind(bookingId).first();
}

export async function finalizePaidBooking(db,{bookingId,provider,paymentId,customerId='',amountCents,now=new Date()}){
  const current=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(bookingId).first();
  if(!current)throw new ApiError(404,'BOOKING_NOT_FOUND','Booking not found.');
  if(current.status==='paid')return {status:'paid',booking:current,idempotent:true};
  if(['conflict_refund_required','refunded','cancelled'].includes(current.status))return {status:current.status,booking:current,idempotent:true};
  if(Number(amountCents)!==Number(current.amount_cents))throw new ApiError(409,'PAYMENT_AMOUNT_MISMATCH','Paid amount does not match the booking amount.');

  const sponsorId=crypto.randomUUID();
  const activityId=crypto.randomUUID();
  const refundId=crypto.randomUUID();
  await db.batch([
    db.prepare(`
      UPDATE bookings
      SET status='finalizing',payment_provider=?,provider_payment_id=?,provider_customer_id=?,updated_at=?
      WHERE id=? AND status IN ('pending','checkout_created')
        AND logo_asset_id IS NOT NULL
        AND EXISTS(SELECT 1 FROM spot_holds h WHERE h.booking_id=bookings.id AND h.expires_at>?)
        AND EXISTS(
          SELECT 1 FROM placements p
          WHERE p.slot_id=bookings.slot_id
            AND p.version=bookings.expected_version
            AND p.print_locked=0
            AND bookings.amount_cents>=CASE WHEN COALESCE(p.current_amount_cents,0)>0 THEN p.current_amount_cents*2 ELSE p.base_cents END
        )
        AND EXISTS(
          SELECT 1 FROM assets a
          WHERE a.id=bookings.logo_asset_id AND a.moderation_status='approved'
        )
        AND NOT EXISTS(
          SELECT 1 FROM settings
          WHERE key='print_lock_at' AND value<>'' AND value<=?
        )
    `).bind(provider,paymentId,customerId,now.toISOString(),bookingId,now.toISOString(),now.toISOString()),
    db.prepare(`
      INSERT INTO activity(id,event_type,slot_id,sponsor_id,booking_id,amount_cents,previous_booking_id,previous_brand_name,previous_amount_cents,created_at)
      SELECT ?, CASE WHEN p.current_booking_id IS NULL THEN 'placement' ELSE 'takeover' END,
             b.slot_id, ?, b.id, b.amount_cents, p.current_booking_id, COALESCE(s.brand_name,''), COALESCE(p.current_amount_cents,0), ?
      FROM bookings b
      JOIN placements p ON p.slot_id=b.slot_id
      LEFT JOIN sponsors s ON s.id=p.current_sponsor_id
      WHERE b.id=? AND b.status='finalizing'
    `).bind(activityId,sponsorId,now.toISOString(),bookingId),
    db.prepare(`
      INSERT OR IGNORE INTO refunds(id,booking_id,amount_cents,reason,status,source_booking_id,created_at,updated_at)
      SELECT ?,p.current_booking_id,p.current_amount_cents,'takeover','pending',b.id,?,?
      FROM bookings b
      JOIN placements p ON p.slot_id=b.slot_id
      WHERE b.id=? AND b.status='finalizing' AND p.current_booking_id IS NOT NULL
    `).bind(refundId,now.toISOString(),now.toISOString(),bookingId),
    db.prepare(`
      INSERT INTO sponsors(id,status,owner_name,brand_name,description,website,x_handle,identity_email,views,created_at,updated_at)
      SELECT ?,'active',owner_name,brand_name,description,website,x_handle,identity_email,0,?,?
      FROM bookings WHERE id=? AND status='finalizing'
    `).bind(sponsorId,now.toISOString(),now.toISOString(),bookingId),
    db.prepare(`
      UPDATE assets SET is_public=1
      WHERE id=(SELECT logo_asset_id FROM bookings WHERE id=? AND status='finalizing')
    `).bind(bookingId),
    db.prepare(`
      UPDATE placements
      SET current_booking_id=?,current_sponsor_id=?,current_amount_cents=(SELECT amount_cents FROM bookings WHERE id=?),
          current_logo_asset_id=(SELECT logo_asset_id FROM bookings WHERE id=?),version=version+1,updated_at=?
      WHERE slot_id=(SELECT slot_id FROM bookings WHERE id=? AND status='finalizing')
    `).bind(bookingId,sponsorId,bookingId,bookingId,now.toISOString(),bookingId),
    db.prepare(`
      UPDATE bookings SET status='paid',sponsor_id=?,paid_at=?,updated_at=?
      WHERE id=? AND status='finalizing'
    `).bind(sponsorId,now.toISOString(),now.toISOString(),bookingId),
    db.prepare('DELETE FROM spot_holds WHERE booking_id=?').bind(bookingId)
  ]);

  const finalized=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(bookingId).first();
  if(finalized?.status==='paid')return {status:'paid',booking:finalized};

  await db.batch([
    db.prepare(`
      UPDATE bookings
      SET status='conflict_refund_required',payment_provider=?,provider_payment_id=?,provider_customer_id=?,updated_at=?
      WHERE id=? AND status IN ('pending','checkout_created')
    `).bind(provider,paymentId,customerId,now.toISOString(),bookingId),
    db.prepare(`
      INSERT OR IGNORE INTO refunds(id,booking_id,amount_cents,reason,status,source_booking_id,created_at,updated_at)
      SELECT ?,id,amount_cents,'spot_conflict','pending',id,?,?
      FROM bookings WHERE id=? AND status='conflict_refund_required'
    `).bind(crypto.randomUUID(),now.toISOString(),now.toISOString(),bookingId),
    db.prepare('DELETE FROM spot_holds WHERE booking_id=?').bind(bookingId)
  ]);
  const conflicted=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(bookingId).first();
  return {status:conflicted?.status||'conflict_refund_required',booking:conflicted};
}

export async function myBooking(db,tokenHash){
  const booking=await bookingForToken(db,tokenHash);
  const sponsor=booking.sponsor_id
    ?await db.prepare('SELECT id,status,owner_name,brand_name,description,website,x_handle,views FROM sponsors WHERE id=?').bind(booking.sponsor_id).first()
    :null;
  const refunds=(await db.prepare('SELECT id,amount_cents,reason,status,provider_refund_id,created_at,updated_at FROM refunds WHERE booking_id=? ORDER BY created_at DESC').bind(booking.id).all()).results||[];
  return {booking,sponsor,refunds};
}

export async function recordView(db,{sponsorId,viewerHash,day,now=new Date()}){
  if(!viewerHash)return {tracked:false};
  const id=sponsorId+':'+viewerHash+':'+day;
  const insert=await db.prepare('INSERT OR IGNORE INTO view_events(id,sponsor_id,viewer_hash,day,created_at) VALUES(?,?,?,?,?)')
    .bind(id,sponsorId,viewerHash,day,now.toISOString()).run();
  if(Number(insert.meta?.changes)||0){
    await db.prepare("UPDATE sponsors SET views=views+1,updated_at=? WHERE id=? AND status='active'").bind(now.toISOString(),sponsorId).run();
    return {tracked:true};
  }
  return {tracked:false};
}


export async function updateSponsorProfile(db,tokenHash,profile,now=new Date()){
  const booking=await bookingForToken(db,tokenHash);
  if(!booking.sponsor_id||booking.status!=='paid')throw new ApiError(409,'PROFILE_NOT_ACTIVE','A paid sponsorship is required to edit this profile.');
  await db.prepare(`
    UPDATE sponsors
    SET owner_name=?,description=?,website=?,x_handle=?,updated_at=?
    WHERE id=? AND status='active'
  `).bind(profile.ownerName,profile.description,profile.website,profile.xHandle,now.toISOString(),booking.sponsor_id).run();
  return db.prepare('SELECT id,status,owner_name,brand_name,description,website,x_handle,views FROM sponsors WHERE id=?')
    .bind(booking.sponsor_id).first();
}
