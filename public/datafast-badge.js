(()=>{
  const online=document.getElementById('datafast-online');
  const views=document.getElementById('datafast-views');
  if(!online||!views)return;
  const format=value=>Number(value||0).toLocaleString();
  async function refresh(){
    try{
      const response=await fetch('/api/datafast-stats',{headers:{accept:'application/json'},cache:'no-store'});
      if(!response.ok)return;
      const data=await response.json();
      if(!data?.ok)return;
      online.textContent=format(data.online);
      views.textContent=format(data.views);
    }catch{}
  }
  refresh();
  setInterval(refresh,30000);
})();
