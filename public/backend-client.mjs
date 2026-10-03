const TOKEN_KEY='protest2.manage_tokens.v1';
const VIEWER_KEY='protest2.viewer_id.v1';

function viewerId(){
  try{
    let id=localStorage.getItem(VIEWER_KEY)||'';
    if(!id){
      id=crypto.randomUUID?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
      localStorage.setItem(VIEWER_KEY,id);
    }
    return id;
  }catch{
    return '';
  }
}

const publicProfile=row=>({
  profileId:row.sponsor.id,
  brand:row.sponsor.brand_name,
  owner:'',
  description:row.sponsor.description,
  website:row.sponsor.website||'',
  x:row.sponsor.x_handle||'',
  logo:row.sponsor.logo_url,
  views:Number(row.sponsor.views)||0
});

export async function fetchSharedModel(){
  let response;
  try{response=await fetch('/api/public-state',{headers:{accept:'application/json'},cache:'no-store'});}catch{return {available:false,model:null};}
  if(!response.ok)return {available:false,model:null};
  const data=await response.json().catch(()=>null);
  if(!data?.ok||!Array.isArray(data.placements))return {available:false,model:null};
  const spots={},profiles={};
  for(const row of data.placements){
    if(!row.sponsor)continue;
    const profile=publicProfile(row);
    profiles[profile.profileId]=profile;
    spots[row.slot_id]={
      ...profile,
      id:row.current_booking_id||profile.profileId,
      amount:Number(row.current_amount_cents)||0,
      date:row.sponsor.paid_at||'',
      views:Number(row.sponsor.views)||0
    };
  }
  const history=(data.activity||[]).map(item=>({
    id:item.id,
    slot:item.slot_id,
    brand:item.brand_name||'Sponsor',
    profileId:item.sponsor_id||'',
    amount:Number(item.amount_cents)||0,
    date:item.created_at,
    previous:item.previous_booking_id?{brand:item.previous_brand_name||'Previous sponsor',amount:Number(item.previous_amount_cents)||0}:null
  }));
  return {
    available:true,
    model:{version:2,enabled:true,auction:{version:1,spots,history},profile:null,profiles,profileViews:{}},
    settings:data.settings||{}
  };
}

export async function recordSharedView(sponsorId){
  if(!sponsorId)return null;
  try{
    const headers={accept:'application/json'};
    const id=viewerId();
    if(id)headers['x-protest-viewer']=id;
    const response=await fetch('/api/sponsors/'+encodeURIComponent(sponsorId)+'/view',{
      method:'POST',
      headers,
      cache:'no-store'
    });
    const data=await response.json().catch(()=>null);
    return response.ok&&data?.ok?data:null;
  }catch{
    return null;
  }
}

export function rememberManageToken(token){
  if(!token)return;
  const tokens=new Set(JSON.parse(localStorage.getItem(TOKEN_KEY)||'[]'));
  tokens.add(token);
  localStorage.setItem(TOKEN_KEY,JSON.stringify([...tokens].slice(-20)));
}

export function manageTokens(){
  try{return JSON.parse(localStorage.getItem(TOKEN_KEY)||'[]').filter(Boolean).slice(-20);}catch{return [];}
}

export async function fetchOwnedBookings(){
  const items=[];
  for(const token of manageTokens()){
    try{
      const response=await fetch('/api/me',{headers:{authorization:'Bearer '+token,accept:'application/json'},cache:'no-store'});
      if(!response.ok)continue;
      const data=await response.json();
      if(data?.ok)items.push({...data,manage_token:token});
    }catch{}
  }
  return items;
}


export async function prepareBooking(payload){
  const response=await fetch('/api/bookings/prepare',{
    method:'POST',
    headers:{'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify(payload)
  });
  const data=await response.json().catch(()=>({ok:false,error:'INVALID_RESPONSE',message:'Backend returned an invalid response.'}));
  if(!response.ok||!data.ok)throw new Error(data.message||'Could not prepare booking.');
  rememberManageToken(data.manage_token);
  return data;
}

export async function uploadBookingLogo(bookingId,manageToken,blob){
  const response=await fetch('/api/bookings/'+encodeURIComponent(bookingId)+'/logo',{
    method:'PUT',
    headers:{authorization:'Bearer '+manageToken,'content-type':blob.type||'application/octet-stream',accept:'application/json'},
    body:blob
  });
  const data=await response.json().catch(()=>({ok:false,message:'Backend returned an invalid response.'}));
  if(!response.ok||!data.ok)throw new Error(data.message||'Could not upload logo.');
  return data;
}

export async function createPaymentSession(bookingId,manageToken){
  const response=await fetch('/api/payments/session',{
    method:'POST',
    headers:{authorization:'Bearer '+manageToken,'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify({booking_id:bookingId})
  });
  const data=await response.json().catch(()=>({ok:false,message:'Backend returned an invalid response.'}));
  if(!response.ok||!data.ok)throw new Error(data.message||'Could not start payment.');
  return data;
}


export async function updateOwnedProfile(manageToken,profile){
  const response=await fetch('/api/me/profile',{
    method:'PATCH',
    headers:{authorization:'Bearer '+manageToken,'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify(profile)
  });
  const data=await response.json().catch(()=>({ok:false,message:'Backend returned an invalid response.'}));
  if(!response.ok||!data.ok)throw new Error(data.message||'Could not update sponsor profile.');
  return data.sponsor;
}


export async function fetchBackendConfig(){
  try{
    const response=await fetch('/api/config',{headers:{accept:'application/json'},cache:'no-store'});
    if(!response.ok)return {available:false,bookings_open:false};
    const data=await response.json();
    return data?.ok?{available:true,...data}:{available:false,bookings_open:false};
  }catch{
    return {available:false,bookings_open:false};
  }
}
