import {placements,money,parseAmount,minimum,total} from './auction-core.mjs';
import {freshPreview,profileKey,profileActivity,recordProfileView,editSavedProfile,safeWebsite} from './preview-state.mjs';
import {createLogoEditor} from './logo-editor.mjs';
import {fetchSharedModel,recordSharedView,fetchBackendConfig,prepareBooking,uploadBookingLogo,createPaymentSession} from './backend-client.mjs';
const $=s=>document.querySelector(s);
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
let model=freshPreview(),selected='',expectedOwner=null,logo='',logoSource='',uploadPending=false,uploadTicket=0,storageProblem='',profileSlot='',editingKey='',editLogo='',cropTarget='placement',sharedBackend=false,backendConfig={available:false,bookings_open:false,payment_environment:''},checkoutPending=false;
const seenProfiles=new Set();
const DEMO_PROFILE={
  profileId:'demo-chatgpt',
  brand:'ChatGPT',
  owner:'OpenAI',
  description:'DEMO PREVIEW — ChatGPT is not a sponsor or affiliated with this project. This sample shows how a brand profile, website, X handle and rectangular T-shirt placement will appear.',
  website:'https://chatgpt.com/',
  x:'@OpenAI',
  demo:true,
  views:0,
  logo:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="260" viewBox="0 0 900 260"><rect width="900" height="260" rx="24" fill="white"/><text x="450" y="174" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="142" font-weight="700" letter-spacing="-5" fill="#111">ChatGPT</text></svg>`)
};
const DEMO_SPOTS={F03:DEMO_PROFILE,B03:DEMO_PROFILE};
const state=()=>model.auction;
function show(dialog,origin){dialog._opener=origin||document.activeElement;if(!dialog.open)dialog.showModal();dialog.scrollTop=0;requestAnimationFrame(()=>{dialog.scrollTop=0;});document.body.classList.add('modal-open');}
function commit(next){model=next;storageProblem='';render();return true;}
function link(text,href){const a=el('a',text,'profile-link');a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a;}
function linksFor(profile,target){target.replaceChildren();if(profile.website){try{const url=new URL(profile.website);if(['http:','https:'].includes(url.protocol))target.append(link(url.hostname.replace(/^www\./,''),url.href));}catch{}}}
function imageFor(p){const img=el('img');img.src=p.logo;img.alt=p.brand+' logo';return img;}
function revealSpot(id){document.querySelector('[data-view="both"]').click();const button=document.querySelector(`[data-spot="${id}"]`);button.scrollIntoView({behavior:'smooth',block:'center'});button.focus({preventScroll:true});button.classList.remove('spot-highlight');void button.offsetWidth;button.classList.add('spot-highlight');}
function render(){const current=state();$('#sponsor-total').textContent=money(total(current));$('#spots-filled').textContent=Object.keys(current.spots).length+' / 12';const summary=document.querySelectorAll('.auction-summary>div');summary[0].querySelector('span').textContent='SPONSOR TOTAL';summary[1].querySelector('span').textContent='CONFIRMED SPOTS';summary[0].querySelector('small').textContent='Current winning sponsorship amounts';$('.activity-head span').textContent='SPONSOR ACTIVITY';
for(const b of document.querySelectorAll('[data-spot]')){const id=b.dataset.spot,p=current.spots[id],demo=!p?DEMO_SPOTS[id]:null;b.replaceChildren();b.classList.toggle('occupied',Boolean(p));b.classList.toggle('demo-spot',Boolean(demo));if(p){b.append(imageFor(p));b.title=p.brand+' · View profile';b.setAttribute('aria-label',id+' · View '+p.brand+' profile');}else if(demo){const img=imageFor(demo);img.classList.add('demo-logo');b.append(img,el('small','DEMO','demo-chip'));b.title='Demo preview · '+demo.brand+' · Spot is still available';b.setAttribute('aria-label',id+' · Demo preview of '+demo.brand+' · Spot is still available');}else{b.append(el('span','＋ '+id),el('strong',money(placements[id].base)));b.title='';b.setAttribute('aria-label',id+' · '+placements[id].name+' · '+money(placements[id].base));}}
const wall=$('#sponsors-grid');const entries=Object.entries(current.spots);const demos=Object.entries(DEMO_SPOTS).filter(([id])=>!current.spots[id]);const wallEntries=[...entries.map(([id,p])=>[id,p,false]),...demos.map(([id,p])=>[id,p,true])];wall.classList.toggle('has-brands',wallEntries.length>0);const gravityLocked=wall.classList.contains('gravity-active');if(!gravityLocked){const previousIds=new Map([...wall.children].filter(n=>n.dataset?.slot).map(n=>[n.dataset.slot,n.dataset.claim]));wall.replaceChildren();for(const [id,p,isDemo] of wallEntries){const button=el('button',undefined,'wall-logo');button.type='button';button.dataset.slot=id;button.dataset.claim=isDemo?'demo-'+id:p.id;button.setAttribute('aria-label',isDemo?'View demo preview of '+p.brand+' on '+placements[id].name:'View '+p.brand+' on '+placements[id].name);if(isDemo)button.classList.add('demo-wall-logo');else if(previousIds.get(id)!==p.id)button.classList.add('new-claim');const frame=el('div',undefined,'wall-logo-frame');frame.append(imageFor(p));button.append(frame,el('strong',p.brand),el('span',isDemo?'DEMO PREVIEW · '+id:placements[id].location+' · '+id));button.onclick=()=>openProfile(p,button,id,!isDemo);wall.append(button);}if(!wallEntries.length){const empty=el('div',undefined,'wall-empty');empty.append(el('span','YOUR BRAND GOES HERE'),el('p','Claim a spot to join the wall.'));wall.append(empty);}}
for(const side of ['front','back']){const list=$('#'+side+'-spot-list');list.replaceChildren();for(const [id,placement] of Object.entries(placements).filter(([id])=>id.startsWith(side==='front'?'F':'B'))){const owner=current.spots[id],demo=!owner?DEMO_SPOTS[id]:null,row=el('button',undefined,'directory-row');row.type='button';const title=el('div',undefined,'directory-row-head');title.append(el('span',id,'directory-code'),el('strong',placement.name));const status=el('span',undefined,'directory-status');if(owner){status.append(imageFor(owner),el('b',owner.brand),el('small','CLAIMED'));row.classList.add('claimed');}else if(demo){status.append(imageFor(demo),el('b',demo.brand),el('small','DEMO'));row.classList.add('demo-directory');}else status.append(el('b',money(placement.base)),el('small','AVAILABLE'));title.append(status);row.append(title,el('p',placement.description));if(owner)row.append(el('span','Next takeover '+money(minimum(current,id)),'directory-next'));else if(demo)row.append(el('span','Preview only · spot still available from '+money(placement.base),'directory-next'));row.onclick=()=>owner?openProfile(owner,row,id):demo?openProfile(demo,row,id,false):openSpot(id,row);list.append(row);}}
const list=$('#activity-list');list.replaceChildren();for(const event of current.history.slice(0,12)){const li=el('li');const b=el('button',event.brand,'transaction-brand');const p=model.profiles?.[event.profileId]||Object.values(model.profiles||{}).find(p=>p.brand===event.brand);if(p)b.onclick=()=>openProfile(p,b);else b.disabled=true;li.append(
  b,
  el('span',event.slot+' · '+money(event.amount)),
  el('small',event.previous
    ?'Takeover · '+event.previous.brand+' had '+Number(event.previous.views||0).toLocaleString()+' views · previous amount '+money(event.previous.amount)
    :'Placement')
);list.append(li);}if(!list.children.length)list.append(el('li','Your placement story starts here.','empty-state'));
const nav=$('#my-profile');nav.replaceChildren(el('span','My Profile'));nav.setAttribute('aria-label','My Profile');
if(storageProblem)$('#preview-feedback').textContent=storageProblem;}
function openProfile(profile,origin,spot='',trackView=true){
  const isDemo=Boolean(profile.demo);
  profileSlot=spot;
  if(isDemo)trackView=false;
  if(trackView){
    if(sharedBackend){
      recordSharedView(profile.profileId).then(result=>{
        const views=Number(result?.views);
        if(!Number.isFinite(views))return;
        profile.views=views;
        if(model.profiles?.[profile.profileId])model.profiles[profile.profileId].views=views;
        for(const item of Object.values(model.auction?.spots||{})){
          if(item.profileId===profile.profileId)item.views=views;
        }
        const currentSpot=profileSlot?model.auction?.spots?.[profileSlot]:null;
        if($('#profile-dialog').open&&(!currentSpot||currentSpot.profileId===profile.profileId)){
          $('#profile-views').textContent=views.toLocaleString()+' views';
        }
      });
    }else{
      const next=recordProfileView(model,profile,spot,seenProfiles);
      if(next!==model)commit(next);
    }
  }
  const activity=profileActivity(model,profile);
  const sponsor=!isDemo&&spot?model.auction.spots[spot]:null;
  $('#profile-position').textContent=spot?placements[spot].name+(isDemo?' · DEMO PREVIEW':''):'Sponsor profile';
  const views=spot?(Number(sponsor?.views)||0):(Number(model.profileViews?.[profileKey(profile)])||0);
  $('#profile-views').textContent=isDemo?'Preview only':views.toLocaleString()+' views';
  const priceLabel=document.querySelector('.sponsored-price span');
  priceLabel.textContent=isDemo?'Spot starts at':'Sponsored for';
  $('#profile-sponsored').textContent=isDemo&&spot?money(placements[spot].base):money(sponsor?.amount??activity.total);
  $('#profile-logo').src=profile.logo;
  $('#profile-logo').alt=profile.brand+' logo';
  $('#profile-title').textContent=profile.brand;
  const by=$('#profile-owner');
  by.replaceChildren(el('span',isDemo?'demo profile · ':'by '));
  if(/^@?[A-Za-z0-9_]{1,15}$/.test(profile.x||'')){
    const handle=profile.x.replace(/^@/,'');
    by.append(link('@'+handle,'https://x.com/'+handle));
  }else{
    by.append(el('strong',profile.owner||profile.brand));
  }
  $('#profile-description').textContent=profile.description;
  const website=$('#profile-website');
  website.hidden=true;
  website.removeAttribute('href');
  if(profile.website){
    try{
      const url=new URL(profile.website);
      if(['http:','https:'].includes(url.protocol)){
        website.href=url.href;
        website.textContent='Visit '+url.hostname.replace(/^www\./,'');
        website.hidden=false;
      }
    }catch{}
  }
  const action=$('#profile-takeover');
  action.hidden=!spot;
  if(spot)action.textContent=isDemo?'Claim '+spot+' · '+money(placements[spot].base):'Take over '+spot+' · '+money(minimum(model.auction,spot));
  show($('#profile-dialog'),origin?.isConnected?origin:(spot?document.querySelector('[data-spot="'+spot+'"]'):$('#my-profile')));
}
$('#profile-takeover').onclick=()=>{const id=profileSlot;$('#profile-dialog').close();if(id)openSpot(id,document.querySelector('[data-spot="'+id+'"]'));};
function openAccount(origin=$('#my-profile')){
  const profiles=sharedBackend?[]:Object.values(model.profiles||{});
  const hasData=!sharedBackend&&(profiles.length>0||Object.keys(model.auction.spots).length>0||model.auction.history.length>0);
  $('#account-empty').hidden=hasData;
  $('#account-content').hidden=!hasData;
  $('#account-spots').textContent=Object.keys(model.auction.spots).length;
  $('#account-total').textContent=money(total(model.auction));
  $('#account-views').textContent=Object.values(model.profileViews||{}).reduce((sum,n)=>sum+(Number(n)||0),0);
  const brands=$('#account-brands');
  brands.replaceChildren();
  for(const p of profiles){
    const activity=profileActivity(model,p);
    const card=el('article',undefined,'account-brand');
    card.append(imageFor(p));
    const info=el('div');
    info.append(el('strong',p.brand),el('span',activity.spots.length+' active spots'));
    if(p.description)info.append(el('p',p.description,'account-brand-description'));
    const meta=el('div',undefined,'account-brand-meta');
    if(p.website){
      try{meta.append(link('Website',safeWebsite(p.website)));}catch{}
    }
    if(/^@?[A-Za-z0-9_]{1,15}$/.test(p.x||'')){
      const handle=p.x.replace(/^@/,'');
      meta.append(link('@'+handle,'https://x.com/'+handle));
    }
    if(meta.children.length)info.append(meta);
    const actions=el('div',undefined,'account-brand-actions');
    if(activity.spots.length){
      const view=el('button','View sponsor card','text-button');
      view.type='button';
      view.onclick=()=>{const id=activity.spots[0][0];$('#account-dialog').close();openProfile(model.auction.spots[id],view,id,false);};
      actions.append(view);
    }
    const edit=el('button','Edit profile','text-button');
    edit.type='button';
    edit.onclick=()=>{$('#account-dialog').close();openEdit(p,edit);};
    actions.append(edit);
    info.append(actions);
    card.append(info);
    brands.append(card);
  }
  const slots=$('#account-placements');
  slots.replaceChildren();
  for(const [id,p] of Object.entries(model.auction.spots)){
    const card=el('button',undefined,'profile-placement');
    card.type='button';
    card.append(imageFor(p));
    const detail=el('div');
    detail.append(el('strong',p.brand+' · '+id),el('span',placements[id].name+' · '+money(p.amount)));
    card.append(detail);
    card.onclick=()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();revealSpot(id);};
    slots.append(card);
  }
  if(!slots.children.length)slots.append(el('p','No active spots.','profile-empty'));
  const history=$('#account-history');
  history.replaceChildren();
  for(const e of model.auction.history){
    const li=el('li',undefined,'profile-transaction');
    const detail=el('div');
    detail.append(el('strong',e.brand+' · '+(e.previous?'takeover':'placement')),el('span',e.slot+' · '+placements[e.slot].name));
    const date=new Date(e.date);
    detail.append(el('small',Number.isNaN(date.valueOf())?'Saved activity':date.toLocaleString()));
    if(e.previous)detail.append(el('small','Previous sponsor: '+e.previous.brand+' · '+money(e.previous.amount)));
    li.append(detail,el('strong',money(e.amount),'transaction-amount'));
    history.append(li);
  }
  if(!history.children.length)history.append(el('li','No transactions yet.','profile-empty'));
  show($('#account-dialog'),origin);
}
$('#my-profile').onclick=()=>openAccount();
$('#account-add-spot').onclick=()=>{$('#account-dialog').close();$('#spots').scrollIntoView({behavior:'smooth'});};
function openEdit(p,origin){editingKey=profileKey(p);editLogo=p.logo;$('#edit-owner').value=p.owner||'';$('#edit-brand').value=p.brand;$('#edit-description').value=p.description;$('#edit-website').value=p.website||'';$('#edit-x').value=p.x||'';$('#edit-logo-preview').src=p.logo;$('#edit-logo-upload').value='';$('#edit-error').textContent='';show($('#edit-profile-dialog'),origin);}
$('#edit-profile-form').onsubmit=e=>{e.preventDefault();try{if(uploadPending)throw Error('Wait for your logo to finish loading.');if(!$('#edit-profile-form').reportValidity())return;const next=editSavedProfile(model,editingKey,{brand:$('#edit-brand').value,owner:$('#edit-owner').value,description:$('#edit-description').value,website:$('#edit-website').value,x:$('#edit-x').value,logo:editLogo});commit(next);$('#edit-profile-dialog').close();openAccount();if(storageProblem)$('#preview-feedback').textContent=storageProblem;}catch(error){$('#edit-error').textContent=error.message;}};
$('#edit-logo-upload').onchange=()=>{const file=$('#edit-logo-upload').files[0];$('#edit-logo-upload').value='';if(!file)return;editor.clear();if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){$('#edit-error').textContent='Choose a PNG, JPG or WebP smaller than 5 MB.';return;}cropTarget='profile';const request=++uploadTicket;uploadPending=true;$('#edit-save').disabled=true;const reader=new FileReader();reader.onload=()=>{if(request===uploadTicket)editor.open(reader.result,{name:'Profile logo',ratio:1},$('#edit-logo-upload'));};reader.onerror=()=>{if(request===uploadTicket){uploadPending=false;$('#edit-save').disabled=false;$('#edit-error').textContent='Could not read that image.';}};reader.readAsDataURL(file);};
function updatePay(){
  const button=$('#submit-bid');
  if(!backendConfig.bookings_open){
    button.textContent='Bookings temporarily unavailable';
    button.disabled=true;
    return;
  }
  let label='Continue to secure payment';
  try{label+=' · '+money(parseAmount($('#bid-amount').value));}catch{}
  button.textContent=checkoutPending?'Opening secure checkout…':uploadPending?'Loading logo…':label;
  button.disabled=checkoutPending||uploadPending;
}
function previewLogo(){const p=$('#crop-preview');p.hidden=!logo;$('#cropped-logo').src=logo||'';}
const editor=createLogoEditor({onSave:(result,source)=>{if(cropTarget==='profile'){editLogo=result;$('#edit-logo-preview').src=result;return;}logo=result;logoSource=source;previewLogo();$('#bid-error').textContent='';},onBusy:value=>{uploadPending=value;$('#edit-save').disabled=value;updatePay();},onError:message=>$(cropTarget==='profile'?'#edit-error':'#bid-error').textContent=message,openDialog:show});
function clearLogo(){++uploadTicket;editor.clear();logo='';logoSource='';$('#logo-upload').value='';previewLogo();}
function fillProfile(p){if(!p)return;$('#owner-name').value=p.owner||'';$('#brand').value=p.brand;$('#description').value=p.description;$('#website').value=p.website||'';$('#x-handle').value=p.x||'';logo=p.logo;logoSource=p.logo;previewLogo();}
function openSpot(id,origin){cropTarget='placement';selected=id;expectedOwner=model.auction.spots[id]?.id??null;$('#bid-form').reset();clearLogo();const p=placements[id],current=model.auction.spots[id];$('#dialog-code').textContent=id+' / '+p.location;$('#dialog-title').textContent=current?'Make it yours.':'Your brand here.';$('#dialog-description').textContent=p.name+' · '+(current?'Take over this placement with your brand.':'Choose your logo and make this space your own.');$('#current-bid').textContent=current?money(current.amount):'Available';$('#minimum-bid').textContent=money(minimum(model.auction,id));$('#bid-amount').value=String(minimum(model.auction,id)/100);$('#bid-error').textContent='';$('#refund-note').hidden=!current;if(current)$('#refund-note').textContent='A qualifying takeover replaces the current sponsor after payment is verified. Their eligible payment amount is automatically refunded to the original payment method; allow up to 7 days for it to appear.';$('#placement-preview-note').hidden=backendConfig.bookings_open;if(!backendConfig.bookings_open)$('#placement-preview-note').textContent='Bookings are temporarily unavailable.';fillProfile(model.profile);updateAmount();show($('#spot-dialog'),origin);}
function updateAmount(){updatePay();try{const amount=parseAmount($('#bid-amount').value),min=minimum(model.auction,selected);$('#next-price').textContent='Next takeover: '+money(amount*2);$('#bid-error').textContent=amount<min?'Minimum for this spot: '+money(min):'';}catch(e){$('#next-price').textContent=e.message;}}
$('#bid-amount').oninput=updateAmount;
$('#logo-upload').onchange=()=>{cropTarget='placement';const file=$('#logo-upload').files[0];$('#logo-upload').value='';if(!file)return;const request=++uploadTicket;editor.clear();if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){$('#bid-error').textContent='Choose a PNG, JPG or WebP smaller than 5 MB.';return;}uploadPending=true;updatePay();const reader=new FileReader();reader.onload=()=>{if(request!==uploadTicket)return;editor.open(reader.result,placements[selected],$('#logo-upload'));};reader.onerror=()=>{if(request===uploadTicket){uploadPending=false;updatePay();$('#bid-error').textContent='Could not read this image.';}};reader.readAsDataURL(file);};
$('#adjust-logo').onclick=()=>{cropTarget='placement';if(logoSource)editor.open(logoSource,placements[selected],$('#adjust-logo'),true);};
$('#bid-form').onsubmit=async e=>{
  e.preventDefault();
  try{
    if(!backendConfig.bookings_open)throw Error('Bookings are not open yet.');
    if(!$('#bid-form').reportValidity())return;
    if(uploadPending)throw Error('Wait for your logo to load.');
    if(!logo)throw Error('Choose a logo and press Use this logo.');
    checkoutPending=true;updatePay();$('#bid-error').textContent='';
    const prepared=await prepareBooking({
      slot_id:selected,
      amount_cents:parseAmount($('#bid-amount').value),
      owner_name:$('#owner-name').value,
      brand_name:$('#brand').value,
      description:$('#description').value,
      website:$('#website').value,
      x_handle:$('#x-handle').value.trim(),
      terms_version:backendConfig.terms_version||'2026-10-03'
    });
    const logoBlob=await fetch(logo).then(response=>response.blob());
    await uploadBookingLogo(prepared.booking_id,prepared.manage_token,logoBlob);
    const session=await createPaymentSession(prepared.booking_id,prepared.manage_token);
    window.location.assign(session.checkout_url);
  }catch(error){
    checkoutPending=false;updatePay();$('#bid-error').textContent=error.message||'Could not start checkout.';
  }
};
for(const b of document.querySelectorAll('[data-spot]'))b.onclick=()=>{const id=b.dataset.spot,p=state().spots[id],demo=!p?DEMO_SPOTS[id]:null;if(p)openProfile(p,b,id);else if(demo)openProfile(demo,b,id,false);else openSpot(id,b);};
for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>{document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.querySelectorAll('[data-side]').forEach(card=>card.hidden=button.dataset.view!=='both'&&card.dataset.side!==button.dataset.view);$('.model-grid').classList.toggle('single',button.dataset.view!=='both');};
for(const dialog of document.querySelectorAll('dialog')){dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});dialog.addEventListener('close',()=>{if(dialog.id==='spot-dialog'&&!dialog.open)clearLogo();if(dialog.id==='edit-profile-dialog'&&!dialog.open){++uploadTicket;editor.clear();}const top=[...document.querySelectorAll('dialog[open]')].at(-1);if(!top)document.body.classList.remove('modal-open');if(dialog._opener?.isConnected&&(!top||top.contains(dialog._opener)))dialog._opener.focus();});}
function closeAllDialogs(){for(const d of document.querySelectorAll('dialog[open]'))d.close();}
const reelsTrack=$('#reels-track');
if(reelsTrack){
  const moveReels=direction=>{
    const firstCard=reelsTrack.querySelector('.reel-card');
    const step=(firstCard?.getBoundingClientRect().width||320)+18;
    reelsTrack.scrollBy({left:direction*step,behavior:'smooth'});
  };
  $('#reels-prev')?.addEventListener('click',()=>moveReels(-1));
  $('#reels-next')?.addEventListener('click',()=>moveReels(1));
  reelsTrack.addEventListener('keydown',event=>{
    if(event.target.matches('.reel-video'))return;
    if(event.key==='ArrowRight'){event.preventDefault();moveReels(1);}
    if(event.key==='ArrowLeft'){event.preventDefault();moveReels(-1);}
  });
  const reelVideos=[...reelsTrack.querySelectorAll('.reel-video')];
  const toggleReel=video=>{
    if(video.paused){
      reelVideos.forEach(other=>{if(other!==video)other.pause();});
      video.play().catch(()=>{});
    }else{
      video.pause();
    }
  };
  reelVideos.forEach(video=>{
    video.controls=false;
    video.addEventListener('click',()=>toggleReel(video));
    video.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){
        event.preventDefault();
        toggleReel(video);
      }
    });
  });
}

async function hydrateSharedState(){
  const result=await fetchSharedModel();
  if(!result.available||!result.model)return false;
  sharedBackend=true;
  model=result.model;
  storageProblem='';
  render();
  return true;
}
async function hydrateBackendConfig(){
  backendConfig=await fetchBackendConfig();
  updatePay();
}
const paymentReturn=new URLSearchParams(location.search).get('payment');
if(paymentReturn==='complete')$('#preview-feedback').textContent='Payment submitted. The sponsor spot will update after Dodo confirms the payment webhook.';
if(paymentReturn==='cancelled')$('#preview-feedback').textContent='Payment was cancelled. No sponsor spot was confirmed.';
render();
Promise.all([hydrateSharedState(),hydrateBackendConfig()]).then(([available])=>{
  if(!available)return;
  setInterval(()=>{if(!document.hidden){hydrateSharedState();hydrateBackendConfig();}},15000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){hydrateSharedState();hydrateBackendConfig();}});
});


/* Opt-in gravity playground for the sponsor wall. */
function createGravityPlayground(){
  const wall=$('#sponsors-grid');
  const toggle=$('#gravity-toggle');
  const hint=$('#gravity-hint');
  if(!wall||!toggle)return null;

  let active=false,raf=0,last=0,bodies=[];
  let gravity={x:0,y:1500};
  let sensorLive=false,pointerLive=false;
  let motionHandler=null,orientationHandler=null;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const random=(min,max)=>min+Math.random()*(max-min);

  function rotateForScreen(x,y){
    const angle=Number(screen.orientation?.angle||window.orientation||0);
    if(angle===90)return {x:-y,y:x};
    if(angle===270||angle===-90)return {x:y,y:-x};
    if(angle===180)return {x:-x,y:-y};
    return {x,y};
  }

  function setSensorState(live){
    sensorLive=live;
    toggle.classList.toggle('sensor-live',sensorLive);
    if(sensorLive){
      pointerLive=false;
      toggle.classList.remove('pointer-live');
      hint.textContent='Tilt your phone — the logos follow gravity.';
    }
  }

  function useMotion(event){
    if(!active)return;
    const a=event.accelerationIncludingGravity;
    if(!a||!Number.isFinite(a.x)||!Number.isFinite(a.y))return;
    let vector=rotateForScreen(-a.x*115,a.y*115);
    if(Math.hypot(vector.x,vector.y)<80)return;
    gravity.x=clamp(vector.x,-1450,1450);
    gravity.y=clamp(vector.y,-1450,1450);
    setSensorState(true);
  }

  function useOrientation(event){
    if(!active||sensorLive||!Number.isFinite(event.gamma)||!Number.isFinite(event.beta))return;
    let vector=rotateForScreen(
      clamp(event.gamma,-45,45)/45*1050,
      clamp(event.beta,35,145)-90
    );
    gravity.x=clamp(vector.x,-1200,1200);
    gravity.y=clamp(640+vector.y*13,-1200,1350);
    setSensorState(true);
  }

  async function enableSensors(){
    let granted=false;
    try{
      if(typeof DeviceMotionEvent!=='undefined'&&typeof DeviceMotionEvent.requestPermission==='function'){
        granted=(await DeviceMotionEvent.requestPermission())==='granted';
      }else if('DeviceMotionEvent' in window){
        granted=true;
      }
    }catch{}
    try{
      if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
        granted=(await DeviceOrientationEvent.requestPermission())==='granted'||granted;
      }else if('DeviceOrientationEvent' in window){
        granted=true;
      }
    }catch{}
    if(!motionHandler){
      motionHandler=useMotion;
      window.addEventListener('devicemotion',motionHandler,{passive:true});
    }
    if(!orientationHandler){
      orientationHandler=useOrientation;
      window.addEventListener('deviceorientation',orientationHandler,{passive:true});
    }
    if(!granted)hint.textContent='Tilt sensors unavailable — move your pointer inside the box.';
    return granted;
  }

  function prepareBodies(){
    const nodes=[...wall.querySelectorAll('.wall-logo')];
    if(!nodes.length){
      bodies=[];
      toggle.disabled=true;
      return;
    }
    toggle.disabled=false;
    const wallRect=wall.getBoundingClientRect();
    const centers=nodes.map(node=>{
      const r=node.getBoundingClientRect();
      return {node,cx:r.left-wallRect.left+r.width/2,cy:r.top-wallRect.top+r.height/2};
    });
    wall.classList.add('gravity-active');
    for(const node of nodes)node.classList.remove('new-claim');
    const maxX=Math.max(0,wall.clientWidth-90),maxY=Math.max(0,wall.clientHeight-90);
    bodies=centers.map((item,index)=>{
      const w=item.node.offsetWidth||90,h=item.node.offsetHeight||90;
      const x=clamp(item.cx-w/2,0,Math.max(0,wall.clientWidth-w));
      const y=clamp(Math.min(item.cy-h/2,16+index*3),0,Math.max(0,wall.clientHeight-h));
      return {node:item.node,w,h,x,y,vx:random(-55,55),vy:random(90,170),angle:random(-5,5),va:random(-18,18)};
    });
    for(const b of bodies){
      b.node.style.transform=`translate3d(${b.x}px,${b.y}px,0) rotate(${b.angle}deg)`;
    }
  }

  function resolvePair(a,b){
    const acx=a.x+a.w/2,acy=a.y+a.h/2,bcx=b.x+b.w/2,bcy=b.y+b.h/2;
    let dx=bcx-acx,dy=bcy-acy;
    const ra=Math.min(a.w,a.h)*.43,rb=Math.min(b.w,b.h)*.43;
    const minDist=ra+rb;
    let dist=Math.hypot(dx,dy);
    if(dist>=minDist)return;
    if(dist<.001){dx=.01;dy=.01;dist=.014;}
    const nx=dx/dist,ny=dy/dist,overlap=minDist-dist;
    a.x-=nx*overlap*.5;a.y-=ny*overlap*.5;
    b.x+=nx*overlap*.5;b.y+=ny*overlap*.5;
    const rvx=b.vx-a.vx,rvy=b.vy-a.vy;
    const along=rvx*nx+rvy*ny;
    if(along<0){
      const impulse=-(1+.62)*along/2;
      const ix=impulse*nx,iy=impulse*ny;
      a.vx-=ix;a.vy-=iy;b.vx+=ix;b.vy+=iy;
      const spin=(nx*rvy-ny*rvx)*.018;
      a.va-=spin;b.va+=spin;
    }
  }

  function step(time){
    if(!active)return;
    const dt=Math.min(.032,Math.max(.008,(time-last)/1000||.016));
    last=time;
    const W=wall.clientWidth,H=wall.clientHeight;
    for(const b of bodies){
      b.vx+=gravity.x*dt;
      b.vy+=gravity.y*dt;
      const damping=Math.pow(.988,dt*60);
      b.vx*=damping;b.vy*=damping;b.va*=Math.pow(.982,dt*60);
      b.x+=b.vx*dt;b.y+=b.vy*dt;b.angle+=b.va*dt;

      if(b.x<0){b.x=0;b.vx=Math.abs(b.vx)*.7;b.va+=b.vy*.018}
      if(b.x+b.w>W){b.x=Math.max(0,W-b.w);b.vx=-Math.abs(b.vx)*.7;b.va-=b.vy*.018}
      if(b.y<0){b.y=0;b.vy=Math.abs(b.vy)*.7}
      if(b.y+b.h>H){b.y=Math.max(0,H-b.h);b.vy=-Math.abs(b.vy)*.66;b.vx*=.94;b.va*=.9}
    }
    for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++)resolvePair(bodies[i],bodies[j]);
    for(const b of bodies){
      b.x=clamp(b.x,0,Math.max(0,W-b.w));
      b.y=clamp(b.y,0,Math.max(0,H-b.h));
      b.node.style.transform=`translate3d(${b.x}px,${b.y}px,0) rotate(${b.angle}deg)`;
    }
    raf=requestAnimationFrame(step);
  }

  async function turnOn(){
    if(active)return;
    const logos=wall.querySelectorAll('.wall-logo');
    if(!logos.length)return;
    active=true;
    toggle.setAttribute('aria-pressed','true');
    toggle.textContent='Gravity OFF';
    gravity={x:0,y:1500};
    sensorLive=false;pointerLive=false;
    toggle.classList.remove('sensor-live','pointer-live');
    hint.textContent='Tilt your phone to move the logos.';
    prepareBodies();
    last=performance.now();
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(step);
    enableSensors().catch(()=>{});
  }

  function turnOff(){
    if(!active)return;
    active=false;
    cancelAnimationFrame(raf);
    wall.classList.remove('gravity-active');
    toggle.setAttribute('aria-pressed','false');
    toggle.textContent='Gravity ON';
    toggle.classList.remove('sensor-live','pointer-live');
    hint.textContent='Tilt your phone to move the logos.';
    for(const b of bodies)b.node.style.removeProperty('transform');
    bodies=[];
    sensorLive=false;pointerLive=false;
    gravity={x:0,y:1500};
    render();
  }

  toggle.addEventListener('click',()=>active?turnOff():turnOn());

  wall.addEventListener('pointermove',event=>{
    if(!active||sensorLive||event.pointerType==='touch')return;
    const r=wall.getBoundingClientRect();
    const dx=event.clientX-(r.left+r.width/2);
    const dy=event.clientY-(r.top+r.height/2);
    gravity.x=clamp(dx*4.2,-1200,1200);
    gravity.y=clamp(dy*4.2,-1200,1200);
    pointerLive=true;
    toggle.classList.add('pointer-live');
    hint.textContent='Move your pointer around the box to steer gravity.';
  });
  wall.addEventListener('pointerleave',()=>{
    if(!active||sensorLive)return;
    pointerLive=false;
    toggle.classList.remove('pointer-live');
    gravity={x:0,y:1500};
  });

  const observer=new MutationObserver(()=>{
    toggle.disabled=!wall.querySelector('.wall-logo');
    if(active){
      requestAnimationFrame(()=>{
        for(const b of bodies)b.node.style.removeProperty('transform');
        prepareBodies();
      });
    }
  });
  observer.observe(wall,{childList:true});
  toggle.disabled=!wall.querySelector('.wall-logo');

  window.addEventListener('resize',()=>{
    if(!active)return;
    const W=wall.clientWidth,H=wall.clientHeight;
    for(const b of bodies){
      b.x=clamp(b.x,0,Math.max(0,W-b.w));
      b.y=clamp(b.y,0,Math.max(0,H-b.h));
    }
  },{passive:true});

  return {turnOff};
}
const gravityPlayground=createGravityPlayground();
