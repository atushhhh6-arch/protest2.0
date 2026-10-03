import {placements,money,parseAmount,minimum,total} from './auction-core.mjs';
import {freshPreview,profileKey,profileActivity,recordProfileView,editSavedProfile,safeWebsite,clearWebsiteStorage} from './preview-state.mjs';
import {createLogoEditor} from './logo-editor.mjs';
const $=s=>document.querySelector(s);
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
let model=freshPreview(),selected='',expectedOwner=null,logo='',logoSource='',uploadPending=false,uploadTicket=0,storageProblem='',profileSlot='',editingKey='',editLogo='',cropTarget='placement';
const seenProfiles=new Set();
try{clearWebsiteStorage(localStorage);clearWebsiteStorage(sessionStorage);}catch{}
const state=()=>model.auction;
function show(dialog,origin){dialog._opener=origin||document.activeElement;if(!dialog.open)dialog.showModal();dialog.scrollTop=0;requestAnimationFrame(()=>{dialog.scrollTop=0;});document.body.classList.add('modal-open');}
function commit(next){model=next;storageProblem='';render();return true;}
function link(text,href){const a=el('a',text,'profile-link');a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a;}
function linksFor(profile,target){target.replaceChildren();if(profile.website){try{const url=new URL(profile.website);if(['http:','https:'].includes(url.protocol))target.append(link(url.hostname.replace(/^www\./,''),url.href));}catch{}}}
function imageFor(p){const img=el('img');img.src=p.logo;img.alt=p.brand+' logo';return img;}
function revealSpot(id){document.querySelector('[data-view="both"]').click();const button=document.querySelector(`[data-spot="${id}"]`);button.scrollIntoView({behavior:'smooth',block:'center'});button.focus({preventScroll:true});button.classList.remove('spot-highlight');void button.offsetWidth;button.classList.add('spot-highlight');}
function render(){const current=state();$('#sponsor-total').textContent=money(total(current));$('#spots-filled').textContent=Object.keys(current.spots).length+' / 12';const summary=document.querySelectorAll('.auction-summary>div');summary[0].querySelector('span').textContent='SPONSOR TOTAL';summary[1].querySelector('span').textContent='CONFIRMED SPOTS';summary[0].querySelector('small').textContent='Current winning sponsorship amounts';$('.activity-head span').textContent='SPONSOR ACTIVITY';
for(const b of document.querySelectorAll('[data-spot]')){const id=b.dataset.spot,p=current.spots[id];b.replaceChildren();b.classList.toggle('occupied',Boolean(p));if(p){b.append(imageFor(p));b.title=p.brand+' · View profile';b.setAttribute('aria-label',id+' · View '+p.brand+' profile');}else{b.append(el('span','＋ '+id),el('strong',money(placements[id].base)));b.title='';b.setAttribute('aria-label',id+' · '+placements[id].name+' · '+money(placements[id].base));}}
const wall=$('#sponsors-grid');const previousIds=new Map([...wall.children].filter(n=>n.dataset?.slot).map(n=>[n.dataset.slot,n.dataset.claim]));wall.replaceChildren();const entries=Object.entries(current.spots);wall.classList.toggle('has-brands',entries.length>0);for(const [id,p] of entries){const button=el('button',undefined,'wall-logo');button.type='button';button.dataset.slot=id;button.dataset.claim=p.id;button.setAttribute('aria-label','View '+p.brand+' on '+placements[id].name);if(previousIds.get(id)!==p.id)button.classList.add('new-claim');const frame=el('div',undefined,'wall-logo-frame');frame.append(imageFor(p));button.append(frame,el('strong',p.brand),el('span',placements[id].location+' · '+id));button.onclick=()=>openProfile(p,button,id);wall.append(button);}if(!entries.length){const empty=el('div',undefined,'wall-empty');empty.append(el('span','YOUR BRAND GOES HERE'),el('p','Claim a spot to join the wall.'));wall.append(empty);}
for(const side of ['front','back']){const list=$('#'+side+'-spot-list');list.replaceChildren();for(const [id,placement] of Object.entries(placements).filter(([id])=>id.startsWith(side==='front'?'F':'B'))){const owner=current.spots[id],row=el('button',undefined,'directory-row');row.type='button';const title=el('div',undefined,'directory-row-head');title.append(el('span',id,'directory-code'),el('strong',placement.name));const status=el('span',undefined,'directory-status');if(owner){status.append(imageFor(owner),el('b',owner.brand),el('small','CLAIMED'));row.classList.add('claimed');}else status.append(el('b',money(placement.base)),el('small','AVAILABLE'));title.append(status);row.append(title,el('p',placement.description));if(owner)row.append(el('span','Next takeover '+money(minimum(current,id)),'directory-next'));row.onclick=()=>owner?openProfile(owner,row,id):openSpot(id,row);list.append(row);}}
const list=$('#activity-list');list.replaceChildren();for(const event of current.history.slice(0,12)){const li=el('li');const b=el('button',event.brand,'transaction-brand');const p=model.profiles?.[event.profileId]||Object.values(model.profiles||{}).find(p=>p.brand===event.brand);if(p)b.onclick=()=>openProfile(p,b);else b.disabled=true;li.append(b,el('span',event.slot+' · '+money(event.amount)),el('small',event.previous?'Takeover · previous sponsor amount '+money(event.previous.amount):'Placement'));list.append(li);}if(!list.children.length)list.append(el('li','Your placement story starts here.','empty-state'));
const nav=$('#my-profile');nav.replaceChildren(el('span','My Profile'));nav.setAttribute('aria-label','My Profile');
if(storageProblem)$('#preview-feedback').textContent=storageProblem;}
function openProfile(profile,origin,spot='',trackView=true){
  profileSlot=spot;
  if(trackView){
    const next=recordProfileView(model,profile,spot,seenProfiles);
    if(next!==model)commit(next);
  }
  const activity=profileActivity(model,profile);
  const sponsor=spot?model.auction.spots[spot]:null;
  $('#profile-position').textContent=spot?placements[spot].name:'Sponsor profile';
  const views=spot?(Number(sponsor?.views)||0):(Number(model.profileViews?.[profileKey(profile)])||0);
  $('#profile-views').textContent=views.toLocaleString()+' views';
  $('#profile-sponsored').textContent=money(sponsor?.amount??activity.total);
  $('#profile-logo').src=profile.logo;
  $('#profile-logo').alt=profile.brand+' logo';
  $('#profile-title').textContent=profile.brand;
  const by=$('#profile-owner');
  by.replaceChildren(el('span','by '));
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
  if(spot)action.textContent='Take over '+spot+' · '+money(minimum(model.auction,spot));
  show($('#profile-dialog'),origin?.isConnected?origin:(spot?document.querySelector('[data-spot="'+spot+'"]'):$('#my-profile')));
}
$('#profile-takeover').onclick=()=>{const id=profileSlot;$('#profile-dialog').close();if(id)openSpot(id,document.querySelector('[data-spot="'+id+'"]'));};
function openAccount(origin=$('#my-profile')){
  const profiles=Object.values(model.profiles||{});
  const hasData=profiles.length>0||Object.keys(model.auction.spots).length>0||model.auction.history.length>0;
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
function updatePay(){const button=$('#submit-bid');button.textContent='Bookings opening soon';button.disabled=true;}
function previewLogo(){const p=$('#crop-preview');p.hidden=!logo;$('#cropped-logo').src=logo||'';}
const editor=createLogoEditor({onSave:(result,source)=>{if(cropTarget==='profile'){editLogo=result;$('#edit-logo-preview').src=result;return;}logo=result;logoSource=source;previewLogo();$('#bid-error').textContent='';},onBusy:value=>{uploadPending=value;$('#edit-save').disabled=value;updatePay();},onError:message=>$(cropTarget==='profile'?'#edit-error':'#bid-error').textContent=message,openDialog:show});
function clearLogo(){++uploadTicket;editor.clear();logo='';logoSource='';$('#logo-upload').value='';previewLogo();}
function fillProfile(p){if(!p)return;$('#owner-name').value=p.owner||'';$('#brand').value=p.brand;$('#description').value=p.description;$('#website').value=p.website||'';$('#x-handle').value=p.x||'';logo=p.logo;logoSource=p.logo;previewLogo();}
function openSpot(id,origin){cropTarget='placement';selected=id;expectedOwner=model.auction.spots[id]?.id??null;$('#bid-form').reset();clearLogo();const p=placements[id],current=model.auction.spots[id];$('#dialog-code').textContent=id+' / '+p.location;$('#dialog-title').textContent=current?'Make it yours.':'Your brand here.';$('#dialog-description').textContent=p.name+' · '+(current?'Take over this placement with your brand.':'Choose your logo and make this space your own.');$('#current-bid').textContent=current?money(current.amount):'Available';$('#minimum-bid').textContent=money(minimum(model.auction,id));$('#bid-amount').value=String(minimum(model.auction,id)/100);$('#bid-error').textContent='';$('#refund-note').hidden=!current;if(current)$('#refund-note').textContent='A qualifying takeover will replace the current sponsor only after payment is verified, and the previous sponsor will be eligible for a full refund.';$('#placement-preview-note').hidden=false;fillProfile(model.profile);updateAmount();show($('#spot-dialog'),origin);}
function updateAmount(){updatePay();try{const amount=parseAmount($('#bid-amount').value),min=minimum(model.auction,selected);$('#next-price').textContent='Next takeover: '+money(amount*2);$('#bid-error').textContent=amount<min?'Minimum for this spot: '+money(min):'';}catch(e){$('#next-price').textContent=e.message;}}
$('#bid-amount').oninput=updateAmount;
$('#logo-upload').onchange=()=>{cropTarget='placement';const file=$('#logo-upload').files[0];$('#logo-upload').value='';if(!file)return;const request=++uploadTicket;editor.clear();if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){$('#bid-error').textContent='Choose a PNG, JPG or WebP smaller than 5 MB.';return;}uploadPending=true;updatePay();const reader=new FileReader();reader.onload=()=>{if(request!==uploadTicket)return;editor.open(reader.result,placements[selected],$('#logo-upload'));};reader.onerror=()=>{if(request===uploadTicket){uploadPending=false;updatePay();$('#bid-error').textContent='Could not read this image.';}};reader.readAsDataURL(file);};
$('#adjust-logo').onclick=()=>{cropTarget='placement';if(logoSource)editor.open(logoSource,placements[selected],$('#adjust-logo'),true);};
$('#bid-form').onsubmit=e=>{e.preventDefault();$('#bid-error').textContent='Bookings are not open yet. Payment checkout must be connected before a spot can be confirmed.';};
for(const b of document.querySelectorAll('[data-spot]'))b.onclick=()=>{const p=state().spots[b.dataset.spot];if(p)openProfile(p,b,b.dataset.spot);else openSpot(b.dataset.spot,b);};
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

render();
