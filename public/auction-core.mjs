export const placements={
 F01:{name:'Left Chest',location:'Front · Chest',base:20000,ratio:1.05,description:'One of two separate chest placements. Starting bid: $200.'},
 F02:{name:'Right Chest',location:'Front · Chest',base:20000,ratio:1.05,description:'The second chest placement, beside the first. Starting bid: $200.'},
 F03:{name:'Centre Rectangle',location:'Front · Stomach',base:35000,ratio:2.5,description:'A broad rectangular placement across the stomach. Starting bid: $350.'},
 F04:{name:'Lower Left',location:'Front · Below the stomach',base:15000,ratio:1.15,description:'The left of two lower-front placements. Starting bid: $150.'},
 F05:{name:'Lower Right',location:'Front · Below the stomach',base:15000,ratio:1.15,description:'The right of two lower-front placements. Starting bid: $150.'},
 F06:{name:'Left Sleeve',location:'Front view · Shoulder / sleeve',base:10000,ratio:0.9,description:'One logo on this sleeve. This physical spot is listed only on the front view, with no duplicate on the back. Starting bid: $100.'},
 F07:{name:'Right Sleeve',location:'Front view · Shoulder / sleeve',base:10000,ratio:0.9,description:'One logo on the other sleeve. This physical spot is listed only on the front view, with no duplicate on the back. Starting bid: $100.'},
 B01:{name:'Upper Back Left',location:'Back · Upper left',base:20000,ratio:1.1,description:'One of two separate upper-back placements. Starting bid: $200.'},
 B02:{name:'Upper Back Right',location:'Back · Upper right',base:20000,ratio:1.1,description:'The second upper-back placement, beside the first. Starting bid: $200.'},
 B03:{name:'Back Rectangle',location:'Back · Centre',base:35000,ratio:2.5,description:'A broad rectangular placement across the centre of the back. Starting bid: $350.'},
 B04:{name:'Lower Back Left',location:'Back · Lower left',base:15000,ratio:1.15,description:'The left of two lower-back placements. Starting bid: $150.'},
 B05:{name:'Lower Back Right',location:'Back · Lower right',base:15000,ratio:1.15,description:'The right of two lower-back placements. Starting bid: $150.'}
};
export const emptyState=()=>({version:1,spots:{},history:[]});
export const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:cents%100?2:0,maximumFractionDigits:2}).format(cents/100);
export function parseAmount(value){if(!/^\d+(\.\d{1,2})?$/.test(String(value).trim()))throw Error('Enter a USD amount with no more than two decimal places.');const [a,b='']=String(value).trim().split('.');const cents=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(cents)||cents<=0||cents>Number.MAX_SAFE_INTEGER/16)throw Error('Enter a valid bid amount.');return cents;}
export function minimum(state,id){if(!placements[id])throw Error('Unknown placement.');return state.spots[id]?state.spots[id].amount*2:placements[id].base;}
export const total=state=>Object.values(state.spots).reduce((sum,s)=>sum+s.amount,0);
export function claim(state,{slot,amount,profile,id,date,expectedOwner}){if(!placements[slot])throw Error('Unknown placement.');const previous=state.spots[slot];if((previous?.id??null)!==expectedOwner)throw Error('This spot changed. Reopen it to see the latest minimum before bidding.');const min=minimum(state,slot);if(!Number.isSafeInteger(amount)||amount<min||amount>Number.MAX_SAFE_INTEGER/16)throw Error('Your bid must be at least '+money(min)+'.');if(!profile.brand?.trim()||!profile.description?.trim())throw Error('Add your brand name and description.');if(!/^data:image\/(png|jpeg|webp);base64,/.test(profile.logo??''))throw Error('Upload a logo before claiming a spot.');const sponsor={...profile,id,amount,views:0,date};const event={id,slot,brand:profile.brand,amount,date,previous:previous?{brand:previous.brand,amount:previous.amount,refundStatus:'refund-required'}:null};return {...state,spots:{...state.spots,[slot]:sponsor},history:[event,...state.history].slice(0,50)};}
