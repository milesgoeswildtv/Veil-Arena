export function applyTelegramVisualEditorAdapter(html) {
  const script = `
<script id="afterdark-visual-editor-adapter">
(()=>{
  const preview=new URLSearchParams(location.search).get('afterdarkPreview')==='1';
  if(!preview||window.parent===window)return;

  const SLOT_SELECTORS={
    'arena.header':'.arena-heading',
    'arena.stats':'.stats',
    'arena.eventPlate':'#liveEventStage',
    'arena.viewerState':'#viewerStateCard',
    'arena.roster':'.roster-panel',
    'arena.sponsor':'.sponsorship-card',
    'arena.results':'#hero'
  };
  const CAPABILITIES={
    'arena.header':{layout:['gap'],style:['opacity'],asset:false},
    'arena.stats':{layout:['gap'],style:['opacity'],asset:false},
    'arena.eventPlate':{layout:['padding','gap'],style:['opacity','color','fontSize','lineHeight'],asset:true},
    'arena.viewerState':{layout:[],style:['opacity'],asset:false},
    'arena.roster':{layout:['gap'],style:['opacity'],asset:false},
    'arena.sponsor':{layout:['gap','minHeight'],style:['opacity'],asset:true},
    'arena.results':{layout:[],style:['opacity'],asset:false}
  };
  const SLOT_VARS={
    'arena.header':{layout:{gap:'--av-header-gap'},style:{opacity:'--av-header-opacity'}},
    'arena.stats':{layout:{gap:'--av-stats-gap'},style:{opacity:'--av-stats-opacity'}},
    'arena.eventPlate':{layout:{padding:'--av-event-padding',gap:'--av-event-gap'},style:{opacity:'--av-event-opacity',color:'--av-event-color',fontSize:'--av-event-font-size',lineHeight:'--av-event-line-height'}},
    'arena.viewerState':{layout:{},style:{opacity:'--av-viewer-opacity'}},
    'arena.roster':{layout:{gap:'--av-roster-gap'},style:{opacity:'--av-roster-opacity'}},
    'arena.sponsor':{layout:{gap:'--av-sponsor-gap',minHeight:'--av-sponsor-min-height'},style:{opacity:'--av-sponsor-opacity'}},
    'arena.results':{layout:{},style:{opacity:'--av-results-opacity'}}
  };

  function pick(slot,group,bp,key){
    const direct=slot?.[group]?.[bp]?.[key];
    if(direct!==undefined)return direct;
    return slot?.[group]?.desktop?.[key];
  }
  function cssValue(key,value){
    if(value==null)return null;
    if(['gap','padding','minHeight','fontSize'].includes(key))return Number(value)+'px';
    if(key==='opacity'||key==='lineHeight')return String(Number(value));
    return String(value);
  }
  function setVar(name,value){
    if(value==null||value==='NaNpx'||value==='NaN')return;
    document.documentElement.style.setProperty(name,value);
  }
  function applyManifest(manifest,bp){
    if(!manifest||manifest.projectId!=='veil-arena')return;
    for(const [slotId,mapping] of Object.entries(SLOT_VARS)){
      const slot=manifest.slots?.[slotId];if(!slot)continue;
      for(const [key,varName] of Object.entries(mapping.layout)){
        setVar(varName,cssValue(key,pick(slot,'layout',bp,key)));
      }
      for(const [key,varName] of Object.entries(mapping.style)){
        setVar(varName,cssValue(key,pick(slot,'style',bp,key)));
      }
    }
    const eventAsset=manifest.slots?.['arena.eventPlate']?.asset;
    if(typeof eventAsset==='string'&&(eventAsset.startsWith('/telegram/')||eventAsset.startsWith('https://'))){
      document.querySelectorAll('.live-event-plate').forEach(img=>img.src=eventAsset);
    }
    const sponsorAsset=manifest.slots?.['arena.sponsor']?.asset;
    if(typeof sponsorAsset==='string'&&(sponsorAsset.startsWith('/telegram/')||sponsorAsset.startsWith('https://'))){
      setVar('--av-sponsor-asset','url("'+sponsorAsset.replaceAll('"','%22')+'")');
    }
    requestAnimationFrame(sendRects);
  }

  function slotElements(){
    return Object.entries(SLOT_SELECTORS).map(([id,selector])=>({id,el:document.querySelector(selector)})).filter(x=>x.el);
  }
  function sendRects(){
    const rects=slotElements().map(({id,el})=>{
      const r=el.getBoundingClientRect();
      return {id,x:r.left,y:r.top,width:r.width,height:r.height};
    });
    window.parent.postMessage({type:'afterdark:rects',rects},'*');
  }
  function sendReady(){
    window.parent.postMessage({type:'afterdark:ready',projectId:'veil-arena',capabilities:CAPABILITIES},'*');
    sendRects();
  }

  function previewState(){
    const names=['SAM','CREK','RUBY','PSYCHEE','ZERO','DROOPY','MICHAEL','MH_0','SEAL','WRAITH','JD','PIXIE'];
    const players=names.map((displayName,index)=>({
      id:'preview-'+(index+1),
      displayName,
      alive:index<8,
      ready:true,
      simulated:index>8,
      eliminations:index%4,
      revivals:index===3?1:0,
      crowdPinsSurvived:index%3
    }));
    return {
      id:'afterdark-preview',
      arenaCode:'PREVIEW',
      status:'running',
      round:7,
      playerCount:players.length,
      aliveCount:8,
      readyCount:players.length,
      registrationLocked:true,
      paused:false,
      testMode:false,
      hostId:'preview-2',
      winnerId:null,
      nextAdvanceAt:Date.now()+14000,
      crowdVote:null,
      players,
      viewer:{id:'preview-1',joined:true,alive:true,isHost:false,canVote:false,ready:true,rematchEligible:false},
      lastEvent:{
        type:'mass_brawl',
        text:'1. **SAM** ducks a wild swing from **CREK** and stays standing.\\n2. **RUBY** sends **ZERO** stumbling into the rail.\\n3. **PSYCHEE** survives a brutal two-on-one rush.\\n4. **DROOPY** finds the opening and turns the whole round sideways.'
      },
      displayLog:[],
      history:[],
      reactions:[],
      sponsorships:[],
      recap:null,
      cooldownRemainingMs:0,
      cooldownText:''
    };
  }

  document.addEventListener('click',event=>{
    const match=slotElements().find(({el})=>el===event.target||el.contains(event.target));
    if(match){
      event.preventDefault();
      event.stopImmediatePropagation();
      window.parent.postMessage({type:'afterdark:select',id:match.id},'*');
    }
  },true);

  window.addEventListener('message',event=>{
    const data=event.data||{};
    if(data.type==='afterdark:manifest')applyManifest(data.manifest,data.breakpoint||'desktop');
  });
  window.addEventListener('resize',sendRects);
  window.addEventListener('scroll',sendRects,{passive:true});
  new ResizeObserver(()=>sendRects()).observe(document.body);

  if(typeof acceptState==='function')acceptState(previewState(),true);
  document.body.dataset.afterdarkPreview='1';
  sendReady();
})();
</script>`;
  return html.includes('afterdark-visual-editor-adapter') ? html : html.replace('</body>', script+'\n</body>');
}
