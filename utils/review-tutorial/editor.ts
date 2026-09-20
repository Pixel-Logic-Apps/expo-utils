import {buildTutorialHtml, ReviewTutorialParams} from "./html";
import {REVIEW_TUTORIAL_TRANSITIONS} from "./timings";

/** Standalone development tool. The app receives only buildTutorialHtml(). */
export function buildTutorialEditorHtml(params: ReviewTutorialParams): string {
    const html = JSON.stringify(buildTutorialHtml(params)).replace(/</g, "\\u003c");
    const segments = JSON.stringify(REVIEW_TUTORIAL_TRANSITIONS);
    return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ajustar animações · Tutorial de avaliação</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f5f7;color:#20252b;font:14px/1.5 system-ui,sans-serif}
main{max-width:1280px;margin:auto;padding:32px}h1{font-size:24px;letter-spacing:-.6px;margin:0 0 5px}
p{margin:0;color:#606a74}header{margin-bottom:24px}.layout{display:grid;grid-template-columns:minmax(0,1fr) 370px;gap:24px;align-items:start}
.panel{background:white;border:1px solid #e0e4e9;border-radius:16px;padding:20px}.viewer{position:sticky;top:24px}
iframe{display:block;width:100%;aspect-ratio:426/240;border:0;border-radius:14px;background:#fff;box-shadow:0 3px 24px #20252b12}
.transport{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:20px 0 12px}button{font:inherit;font-weight:550;border:1px solid #d4dae2;border-radius:7px;background:#fff;color:inherit;padding:8px 12px;cursor:pointer}
button:hover{background:#f0f3f7}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
.primary{background:#235ec7;border-color:#235ec7;color:white}.primary:hover{background:#174cae}.small{font-size:12px;padding:5px 8px}
.progress{display:flex;gap:14px;align-items:center}.progress input{flex:1}.clock{font-variant-numeric:tabular-nums;white-space:nowrap;color:#626d79;font-size:12px}
input[type=range]{accent-color:#235ec7;width:100%;margin:0;cursor:pointer}input[type=number]{width:68px;border:1px solid #d4dae2;border-radius:6px;padding:5px;font:inherit;font-variant-numeric:tabular-nums}
.loop{display:flex;gap:8px;align-items:center;margin:12px 0 0;color:#606a74;font-size:12px}.loop input{accent-color:#235ec7}
.section-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}h2{font-size:16px;margin:0}
.transition{padding:14px 0;border-top:1px solid #edf0f3}.transition.active .name{color:#235ec7}.row{display:flex;align-items:center;gap:8px;justify-content:space-between}
.name{font-weight:600;font-size:13px}.number{display:flex;gap:5px;align-items:center;color:#66717d}.range{display:flex;align-items:center;gap:12px;margin-top:10px}.range button{flex:none}
.reference{font-size:11px;color:#7d8791;margin-top:3px}.export{margin-top:24px}.export p{font-size:12px;margin:6px 0 12px}
textarea{width:100%;height:245px;resize:vertical;border:1px solid #e0e4e9;background:#f8fafc;border-radius:8px;padding:12px;font:12px/1.5 ui-monospace,monospace;color:#35414e}
.buttons{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}#status{font-size:12px;min-height:20px;margin-top:8px;color:#596b59}
#scope{font-size:12px;margin-top:10px;color:#606a74}button:disabled{opacity:.5;cursor:wait}
@media(max-width:850px){main{padding:20px}.layout{display:flex;flex-direction:column}.viewer{display:contents}.panel{padding:16px;width:100%}.layout>aside{order:2}.export{order:3;margin-top:0}h1{font-size:21px}}
</style></head><body><main>
<header><h1>Ajustar animações</h1><p>Altere a duração de cada transição. Os próximos eventos acompanham o ajuste.</p></header>
<div class="layout"><section class="viewer">
<div class="panel"><iframe id="preview" title="Tutorial de avaliação"></iframe>
<div class="transport"><button id="play" class="primary" disabled>Pausar</button><button id="whole" disabled>Tutorial inteiro</button><button id="back" title="Voltar 0,1 segundo" disabled>−0,1 s</button><button id="forward" title="Avançar 0,1 segundo" disabled>+0,1 s</button></div>
<div class="progress"><input id="scrub" type="range" min="0" max="19" step=".01" value="0" aria-label="Posição do tutorial"><output id="clock" class="clock">0,00 / 19,00 s</output></div>
<label class="loop"><input type="checkbox" id="loop">Repetir somente o trecho selecionado</label><p id="scope">Tutorial completo</p></div>
<section class="panel export"><h2>Usar os ajustes</h2><p>Copie <code>timings</code> para as props do tutorial ou baixe o HTML para o Remote Config. As escolhas ficam salvas neste navegador.</p>
<textarea id="json" readonly aria-label="Configuração das durações"></textarea><div class="buttons"><button id="copy">Copiar JSON</button><button id="download-json">Baixar JSON</button><button id="download-html">Baixar HTML</button></div><p id="status" role="status"></p></section>
</section><aside class="panel"><div class="section-title"><h2>Duração das transições</h2><button id="reset" class="small">Restaurar padrão</button></div><div id="controls"></div></aside></div>
</main><script>
(function(){
  var HTML=${html},TRANSITIONS=${segments};
  var frame=document.getElementById('preview'),api=null,selected='slideDown',looping=false;
  var storageKey='expo-utils:review-tutorial:'+${JSON.stringify(params.appName).replace(/</g, "\\u003c")}+':'+TRANSITIONS.map(function(s){return s.defaultDuration;}).join(',');
  var controls=document.getElementById('controls'),scrub=document.getElementById('scrub');
  var output=document.getElementById('json'),status=document.getElementById('status');
  function seconds(n){return n.toFixed(2).replace('.',',');}
  TRANSITIONS.forEach(function(s){
    var row=document.createElement('div');row.className='transition';row.dataset.key=s.key;
    row.innerHTML='<div class="row"><label class="name" for="duration-'+s.key+'">'+s.label+'</label><span class="number"><input id="duration-'+s.key+'" type="number" min=".05" max="30" step=".05" aria-label="'+s.label+' em segundos"><span>s</span></span></div><div class="range"><input type="range" min=".05" max="'+(s.key==='typing'?10:3)+'" step=".05" aria-label="Duração: '+s.label+'"><button class="small" aria-label="Repetir '+s.label+'">Ver trecho</button></div><div class="reference">Padrão: '+seconds(s.defaultDuration)+' s</div>';
    function change(e){
      if(!api||!Number.isFinite(e.target.valueAsNumber))return;
      var values=api.getState().timings;values[s.key]=e.target.valueAsNumber;
      api.setTimings(values);selected=s.key;render();save();previewSegment();
    }
    row.querySelector('[type=range]').addEventListener('input',change);
    row.querySelector('[type=number]').addEventListener('change',change);
    row.querySelector('button').addEventListener('click',function(){if(api){selected=s.key;previewSegment();render();}});
    controls.appendChild(row);
  });
  function save(){try{localStorage.setItem(storageKey,JSON.stringify(api.getState().timings));status.textContent='Ajustes salvos neste navegador.';}catch(e){status.textContent='Use o JSON para guardar os ajustes.';}}
  function bounds(){
    var state=api.getState(),s=state.segments.find(function(s){return s.key===selected;});
    return {start:Math.max(0,s.at-.45),end:Math.min(state.duration-.01,s.until+.65)};
  }
  function previewSegment(){looping=true;document.getElementById('loop').checked=true;api.seek(bounds().start);api.play();}
  function render(){
    var state=api.getState();scrub.max=state.duration;
    TRANSITIONS.forEach(function(s){
      var row=controls.querySelector('[data-key="'+s.key+'"]'),value=state.timings[s.key];
      row.classList.toggle('active',selected===s.key);
      row.querySelector('[type=number]').value=Number(value.toFixed(2));
      var range=row.querySelector('[type=range]');range.max=Math.max(s.key==='typing'?10:3,value);range.value=value;
    });
    output.value=JSON.stringify({timings:state.timings},null,2);
  }
  document.getElementById('play').onclick=function(){if(api){api.getState().playing?api.pause():api.play();}};
  document.getElementById('whole').onclick=function(){if(api){looping=false;document.getElementById('loop').checked=false;api.seek(0);api.play();}};
  document.getElementById('loop').onchange=function(e){if(api){looping=e.target.checked;if(looping)previewSegment();}};
  document.getElementById('back').onclick=function(){if(api)api.seek(Math.max(0,api.getState().time-.1));};
  document.getElementById('forward').onclick=function(){if(api)api.seek(api.getState().time+.1);};
  scrub.oninput=function(){if(api){looping=false;document.getElementById('loop').checked=false;api.seek(Number(scrub.value));}};
  document.getElementById('reset').onclick=function(){if(api){api.setTimings({});render();save();previewSegment();}};
  document.getElementById('copy').onclick=async function(){
    try{await navigator.clipboard.writeText(output.value);status.textContent='JSON copiado.';}
    catch(e){output.focus();output.select();status.textContent='JSON selecionado. Use Ctrl+C ou ⌘C para copiar.';}
  };
  function download(name,text,type){
    var url=URL.createObjectURL(new Blob([text],{type:type})),a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},1000);status.textContent='Arquivo preparado: '+name;
  }
  document.getElementById('download-json').onclick=function(){if(api)download('tutorial-timings.json',output.value,'application/json');};
  document.getElementById('download-html').onclick=function(){
    if(!api)return;
    var doc=new DOMParser().parseFromString(HTML,'text/html');
    doc.getElementById('tutorial-timings').textContent=JSON.stringify(api.getState().timings);
    download('review-tutorial.html','<!DOCTYPE html>'+doc.documentElement.outerHTML,'text/html');
  };
  function update(){
    if(api){
      var state=api.getState(),b=looping?bounds():null;
      if(b&&state.playing&&(state.time>=b.end||state.time<b.start-.02)){api.seek(b.start);api.play();state=api.getState();}
      scrub.value=state.time;document.getElementById('clock').textContent=seconds(state.time)+' / '+seconds(state.duration)+' s';
      document.getElementById('play').textContent=state.playing?'Pausar':'Reproduzir';
      document.getElementById('scope').textContent=looping?'Trecho: '+TRANSITIONS.find(function(s){return s.key===selected;}).label:'Tutorial completo';
    }
    requestAnimationFrame(update);
  }
  frame.addEventListener('load',async function(){
    await frame.contentWindow.reviewTutorialReady;api=frame.contentWindow.reviewTutorial;
    if(!api)return;
    try{var saved=JSON.parse(localStorage.getItem(storageKey));if(saved)api.setTimings(saved);}catch(e){}
    document.querySelectorAll('button[disabled]').forEach(function(b){b.disabled=false;});render();update();
  });
  frame.srcdoc=HTML;
})();
</script></body></html>`;
}
