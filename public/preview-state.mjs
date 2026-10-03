import {placements, emptyState, claim, minimum, total} from './auction-core.mjs';

export const STORAGE_KEY='protest2.sponsorships.v2';
export const LEGACY_STORAGE_KEYS=['protest2.moderator-preview.v1'];
export const LEGACY_STORAGE_PREFIXES=['protest2-sponsor-draft-'];

export const freshPreview=()=>({
  version:2,
  enabled:true,
  auction:emptyState(),
  profile:null,
  profiles:{},
  profileViews:{}
});

export function safeWebsite(value){
  if(!value?.trim())return '';
  let url;
  try{url=new URL(value.trim());}
  catch{throw Error('Enter a complete website URL, such as https://yourbrand.com.');}
  if(!['https:','http:'].includes(url.protocol))throw Error('Website links must start with https:// or http://.');
  return url.href;
}

export function isWebsiteStorageKey(key){
  if(!key)return false;
  return key===STORAGE_KEY||
    LEGACY_STORAGE_KEYS.includes(key)||
    LEGACY_STORAGE_PREFIXES.some(prefix=>key.startsWith(prefix))||
    key.startsWith('protest2.sponsorships.')||
    key.startsWith('protest2.')||
    key.startsWith('protest2-');
}

export function clearWebsiteStorage(storage){
  const keys=[];
  for(let i=0;i<storage.length;i++){
    const key=storage.key(i);
    if(isWebsiteStorageKey(key)||LEGACY_STORAGE_PREFIXES.some(prefix=>key?.startsWith(prefix)))keys.push(key);
  }
  for(const key of keys)storage.removeItem(key);
}

export function resetSpot(model,slot){
  if(!placements[slot])throw Error('Choose a valid spot.');
  const spots={...model.auction.spots};
  delete spots[slot];
  return {...model,auction:{...model.auction,spots,history:model.auction.history.filter(e=>e.slot!==slot)}};
}

export function applyPreview(model,input){
  const profile={
    ...input.profile,
    brand:input.profile.brand.trim(),
    description:input.profile.description.trim(),
    website:safeWebsite(input.profile.website)
  };
  if(profile.brand.length>80||profile.description.length>300)throw Error('Keep the brand name under 80 characters and the description under 300.');
  if(profile.x&&!/^@?[A-Za-z0-9_]{1,15}$/.test(profile.x))throw Error('Enter a valid X handle.');
  profile.owner=String(profile.owner||'').trim().slice(0,80);
  profile.profileId=profileKey(profile);
  const auction=claim(model.auction,{...input,profile});
  return {
    ...model,
    version:2,
    enabled:true,
    profile,
    profiles:{...(model.profiles||{}),[profile.profileId]:profile},
    auction
  };
}

function storedValue(storage){
  const current=storage.getItem(STORAGE_KEY);
  if(current)return current;
  for(const key of LEGACY_STORAGE_KEYS){
    const value=storage.getItem(key);
    if(value)return value;
  }
  return '';
}

export function loadPreview(storage){
  const raw=storedValue(storage);
  if(!raw)return freshPreview();
  let m;
  try{
    m=JSON.parse(raw);
    if(![1,2].includes(m.version)||!m.auction?.spots||!Array.isArray(m.auction.history))throw Error();
    for(const [id,s] of Object.entries(m.auction.spots)){
      if(!placements[id]||!s.id||typeof s.brand!=='string'||typeof s.description!=='string'||!Number.isSafeInteger(s.amount)||s.amount<placements[id].base||!/^data:image\/(png|jpeg|webp);base64,/.test(s.logo))throw Error();
      safeWebsite(s.website);
    }
    for(const e of m.auction.history){
      if(!placements[e.slot]||typeof e.brand!=='string'||!Number.isSafeInteger(e.amount))throw Error();
    }
    if(m.profile&&(typeof m.profile.brand!=='string'||typeof m.profile.description!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(m.profile.logo)))throw Error();
    if(m.profiles&&typeof m.profiles!=='object')throw Error();
    if(m.profileViews&&typeof m.profileViews!=='object')throw Error();
  }catch{
    throw Error('Saved sponsorship data could not be read. Clear this site’s stored data in your browser settings and reload.');
  }
  const migrated=migrateProfiles(m);
  return {
    ...migrated,
    version:2,
    enabled:true,
    profiles:migrated.profiles||{},
    profileViews:migrated.profileViews||{}
  };
}

export function savePreview(storage,model){
  storage.setItem(STORAGE_KEY,JSON.stringify({...model,version:2,enabled:true}));
  for(const key of LEGACY_STORAGE_KEYS)storage.removeItem(key);
  const legacy=[];
  for(let i=0;i<storage.length;i++){
    const key=storage.key(i);
    if(LEGACY_STORAGE_PREFIXES.some(prefix=>key?.startsWith(prefix)))legacy.push(key);
  }
  for(const key of legacy)storage.removeItem(key);
}

export function runRuleChecks(logo){
  const results=[];
  const check=(label,fn)=>{try{fn();results.push({label,ok:true});}catch(e){results.push({label,ok:false,detail:e.message});}};
  const assert=(v,msg)=>{if(!v)throw Error(msg);};
  const profile={brand:'Check A',description:'Local rule check',logo,website:'',x:''};
  let m=freshPreview();
  const add=(model,amount,id,expectedOwner)=>applyPreview(model,{slot:'F01',amount,profile:{...profile,brand:id},id,date:new Date().toISOString(),expectedOwner});
  check('All 12 spots and starting prices',()=>assert(Object.keys(placements).length===12&&placements.F03.base===35000&&placements.F06.base===10000&&placements.B01.base===20000,'Placement configuration is incorrect.'));
  check('First brand placement at $200',()=>{m=add(m,20000,'Check A',null);assert(m.auction.spots.F01.brand==='Check A','Brand was not applied.');});
  check('Bids below the 2× minimum are blocked',()=>{let blocked=false;try{add(m,39999,'Check B','Check A');}catch{blocked=true;}assert(blocked,'Underpriced takeover was accepted.');});
  check('Takeover replaces brand and totals correctly',()=>{m=add(m,40000,'Check B','Check A');assert(minimum(m.auction,'F01')===80000&&total(m.auction)===40000,'Takeover minimum or total is incorrect.');assert(m.auction.history[0].previous?.amount===20000,'Previous sponsor amount was lost.');});
  check('Reset returns the spot to its starting price',()=>{m=resetSpot(m,'F01');assert(minimum(m.auction,'F01')===20000&&total(m.auction)===0&&m.auction.history.length===0,'Reset did not clear the spot.');});
  return results;
}

export function profileKey(p){
  if(p.profileId)return p.profileId;
  return 'brand:'+encodeURIComponent([
    String(p.brand||'').trim().toLowerCase(),
    String(p.x||'').replace(/^@/,'').toLowerCase(),
    String(p.website||'').replace(/\/$/,'').toLowerCase()
  ].join('|'));
}

export function migrateProfiles(model){
  const profiles={...(model.profiles||{})};
  const normalizedSpots={};
  for(const [id,raw] of Object.entries(model.auction.spots||{})){
    const p={...raw};
    p.profileId=profileKey(p);
    normalizedSpots[id]=p;
    profiles[p.profileId]={...(profiles[p.profileId]||{}),...p};
  }
  let currentProfile=model.profile?{...model.profile}:null;
  if(currentProfile){
    currentProfile.profileId=profileKey(currentProfile);
    profiles[currentProfile.profileId]={...(profiles[currentProfile.profileId]||{}),...currentProfile};
  }
  const findId=brand=>{
    const matches=Object.values(profiles).filter(p=>p.brand?.trim().toLowerCase()===brand?.trim().toLowerCase());
    return matches.length===1?profileKey(matches[0]):undefined;
  };
  const history=(model.auction.history||[]).map(e=>({
    ...e,
    profileId:e.profileId||findId(e.brand),
    previous:e.previous?{...e.previous,profileId:e.previous.profileId||findId(e.previous.brand)}:null
  }));
  return {
    ...model,
    profiles,
    profile:currentProfile,
    auction:{...model.auction,spots:normalizedSpots,history}
  };
}

export function profileActivity(model,profile){
  const key=profileKey(profile);
  const matches=p=>p&&(p.profileId?p.profileId===key:p.brand?.trim().toLowerCase()===profile.brand.trim().toLowerCase());
  const spots=Object.entries(model.auction.spots).filter(([,p])=>profileKey(p)===key);
  const transactions=[];
  for(const e of model.auction.history){
    if(matches(e))transactions.push({...e,kind:e.previous?'takeover':'placement'});
    if(matches(e.previous))transactions.push({...e,amount:e.previous.amount,brand:e.previous.brand,kind:'refund'});
  }
  return {spots,transactions,total:spots.reduce((sum,[,p])=>sum+p.amount,0)};
}

export function recordProfileView(model,profile,slot,seen){
  const key=profileKey(profile);
  const seenKey=slot?key+':'+slot:key;
  if(seen.has(seenKey))return model;
  seen.add(seenKey);
  const views={...(model.profileViews||{}),[key]:Math.max(0,Number(model.profileViews?.[key])||0)+1};
  let auction=model.auction;
  if(slot&&auction.spots[slot]){
    auction={
      ...auction,
      spots:{
        ...auction.spots,
        [slot]:{...auction.spots[slot],views:(Number(auction.spots[slot].views)||0)+1}
      }
    };
  }
  return {...model,profileViews:views,auction};
}

export function editSavedProfile(model,key,changes){
  const old=model.profiles?.[key];
  if(!old)throw Error('Profile not found.');
  const p={
    ...old,
    ...changes,
    profileId:key,
    brand:String(changes.brand||'').trim(),
    description:String(changes.description||'').trim(),
    owner:String(changes.owner||'').trim(),
    website:safeWebsite(changes.website),
    x:String(changes.x||'').trim()
  };
  if(!p.brand||p.brand.length>80||!p.description||p.description.length>300||p.owner.length>80)throw Error('Add a brand name and description within the field limits.');
  if(p.x&&!/^@?[A-Za-z0-9_]{1,15}$/.test(p.x))throw Error('Enter a valid X handle.');
  if(!/^data:image\/(png|jpeg|webp);base64,/.test(p.logo||''))throw Error('Choose a valid logo.');
  const spots=Object.fromEntries(Object.entries(model.auction.spots).map(([id,s])=>[
    id,
    profileKey(s)===key?{...s,brand:p.brand,owner:p.owner,description:p.description,website:p.website,x:p.x,logo:p.logo}:s
  ]));
  return {
    ...model,
    profiles:{...model.profiles,[key]:p},
    profile:model.profile&&profileKey(model.profile)===key?p:model.profile,
    auction:{...model.auction,spots}
  };
}
