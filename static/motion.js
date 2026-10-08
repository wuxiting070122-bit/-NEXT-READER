'use strict';
// Visual feedback only: never delays clicks, changes focus, or calls lending/account APIs.
(()=>{
 const root=document.documentElement,reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let quiet=false;
 try{quiet=localStorage.getItem('bookloop-motion')==='quiet';}catch{}
 root.dataset.motion=quiet?'quiet':'full';
 const preference=document.createElement('dialog');preference.className='window';preference.id='motion-dialog';preference.setAttribute('aria-labelledby','motion-title');
 preference.innerHTML=I18n.html(`<h2 class="titlebar"><span id="motion-title">界面动效</span><button type="button" aria-label="关闭界面动效">×</button></h2><div class="dialog-body"><p>暖棕色机械按键：按住时下沉，松开后回弹。</p><div class="motion-demo"><button type="button" id="motion-sample">试按一下</button><button type="button" disabled>不可用</button></div><p id="motion-sample-state" role="status">也可以用 Tab 选中，再按空格键。</p><label class="motion-choice"><input type="checkbox" id="motion-quiet">安静阅读：关闭位移动画与自动轮播</label><p id="motion-system-note"></p></div>`);
 document.body.append(preference);I18n.addSettings(preference);
 const trigger=document.createElement('button');trigger.type='button';trigger.id='motion-open';trigger.textContent=t('界面动效');document.querySelector('footer>span:last-child').append(' · ',trigger);
 trigger.onclick=()=>preference.showModal();preference.querySelector('.titlebar button').onclick=()=>preference.close();
 const check=preference.querySelector('#motion-quiet'),note=preference.querySelector('#motion-system-note');check.checked=quiet;
 const pausedByMotion=()=>root.dataset.motion==='quiet'||reduced.matches;
 function sync(){if(pausedByMotion())document.querySelectorAll('.workspace>.window,.ranking').forEach(p=>p.getAnimations().forEach(a=>a.cancel()));note.textContent=reduced.matches?t('当前系统已开启减少动态效果，网站会自动遵循。'):t('长时间阅读时，可以开启安静阅读。');if(pausedByMotion()&&typeof state!=='undefined'){state.paused=true;renderRanks();}}
 check.onchange=()=>{quiet=check.checked;root.dataset.motion=quiet?'quiet':'full';try{localStorage.setItem('bookloop-motion',root.dataset.motion);}catch{}sync();};
 reduced.addEventListener('change',sync);sync();
 // Existing rank controls must also respect the quiet reading setting.
 document.querySelector('#rank-pause').addEventListener('click',()=>{if(pausedByMotion()){state.paused=true;renderRanks();message(t('安静阅读或系统减少动态效果已开启，榜单可手动切换。'));}});
 const sample=preference.querySelector('#motion-sample'),sampleState=preference.querySelector('#motion-sample-state');
 sample.addEventListener('pointerdown',e=>{if(e.button===0)sampleState.textContent=t('按下：边缘凹入，按钮下沉。');});
 window.addEventListener('pointerup',()=>{if(sampleState.textContent.startsWith(t('按下：')))sampleState.textContent=t('已松开：按钮回弹。');});
 sample.addEventListener('pointercancel',()=>sampleState.textContent=t('操作已取消，按钮恢复。'));
 sample.addEventListener('click',()=>sampleState.textContent=t('已松开：按钮回弹，可以再试一次。'));
 // Enter gets the same tactile feedback as mouse/Space, without synthesizing a second click.
 let held=null;
 function release(){held?.classList.remove('key-held');held=null;}
 document.addEventListener('keydown',e=>{if(![' ','Enter'].includes(e.key)||e.repeat)return;const target=e.target.closest?.('button,a.button');if(!target||target.disabled)return;release();held=target;target.classList.add('key-held');});
 document.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key))release();});
 window.addEventListener('blur',release);document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
 document.addEventListener('focusout',release);
 document.addEventListener('pointerdown',e=>{const panel=e.target.closest?.('.workspace>.window,.ranking');if(!panel)return;document.querySelector('.window-current')?.classList.remove('window-current');panel.classList.add('window-current');});
 // Restore/reveal windows with a short fade. Layout changes themselves remain immediate.
 const panelObserver=new MutationObserver(records=>{
  if(pausedByMotion())return;
  for(const record of records){const panel=record.target,old=record.oldValue||'';
   const collapsedBefore=old.split(/\s+/).includes('collapsed'),collapsedNow=panel.classList.contains('collapsed');
   const expandedBefore=old.split(/\s+/).includes('expanded'),expandedNow=panel.classList.contains('expanded');
   if((collapsedBefore&&!collapsedNow)||expandedBefore!==expandedNow){panel.getAnimations().forEach(a=>a.cancel());panel.animate([{opacity:.7},{opacity:1}],{duration:140,easing:'ease-out'});}
  }
 });
 document.querySelectorAll('.workspace>.window,.ranking').forEach(p=>panelObserver.observe(p,{attributes:true,attributeFilter:['class'],attributeOldValue:true}));
})();
