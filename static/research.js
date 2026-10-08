'use strict';
const $=id=>document.getElementById(id), types={ebook:t('电子书'),article:t('文章'),link:t('资料链接')};
const state={user:null,resources:[],selected:null,notes:[],tags:new Set(),ranks:{view:[],open:[],loan:[]},rank:'view',exampleRanks:false,paused:matchMedia('(prefers-reduced-motion: reduce)').matches,selection:null,font:18,version:0};
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,action,cls)=>{const b=node('button',text,cls);b.type='button';b.onclick=action;return b;};
async function api(path,method='GET',body){const r=await fetch('/api/digital'+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok){if(r.status===401)openAccount();throw Error(I18n.error(data.error)||t('请求失败'));}return data;}
let toastTimer;function message(text){$('message').textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('message').textContent='',5500);}
const pendingLoans=new Set();
const current=()=>state.resources.find(b=>b.id===state.selected);
function cover(b,index=0){const box=node('span',undefined,'cover cover-'+index%3);if(['pride','walden','alice'].includes(b.id)){const art=node('span',undefined,'cover-art cover-'+b.id);art.setAttribute('aria-hidden','true');box.append(art);}else{box.textContent=b.english||b.title;box.style.background='#e3ceb0';}return box;}
function tag(keyword){const b=button(keyword,()=>{state.tags.has(keyword)?state.tags.delete(keyword):state.tags.add(keyword);renderCatalog();renderRanks();$('catalog').scrollIntoView({block:'start'});},'tag');b.setAttribute('aria-pressed',String(state.tags.has(keyword)));b.setAttribute('aria-label',t('筛选关键词 ')+keyword);return b;}
function renderCatalog(){
 const q=$('filter').value.trim().toLowerCase(),type=$('type-filter').value;
 const list=state.resources.filter(b=>(type==='all'||type===b.kind)&&[...state.tags].every(t=>b.tags.includes(t))&&[b.title,b.originalTitle,b.english,b.author,...b.tags,...b.paragraphs].join(' ').toLowerCase().includes(q));
 $('active-tags').replaceChildren(...[...state.tags].map(t=>button(t+' ×',()=>{state.tags.delete(t);renderCatalog();renderRanks();},'tag')));
 $('book-list').replaceChildren();list.forEach((b,i)=>{const item=node('div',undefined,'book-item');const row=button('',()=>select(b.id,true),'book-row');row.setAttribute('aria-pressed',String(b.id===state.selected));row.setAttribute('aria-label',t('打开 ')+b.title);const info=node('span',undefined,'book-info');info.append(node('strong',b.title),node('small',b.id==='alice'?'Alice in Wonderland':b.english),node('small',({pride:t('简·奥斯汀'),walden:t('亨利·戴维·梭罗'),alice:t('刘易斯·卡罗尔')}[b.id]||b.author)+' | '+(b.kind==='ebook'?t('英文原版'):types[b.kind])),node('small',b.borrowed?t('已借阅'):b.kind==='ebook'?t('可借阅电子版'):t('直接访问')));row.append(cover(b,i),info);item.append(row);{const action=button(pendingLoans.has(b.id)?t('处理中…'):b.borrowedByMe?t('已在书架'):b.lending==='limited'&&!b.available?t('已被借走'):b.lending==='limited'?t('借阅图书'):t('加入书架'),()=>loan(b.id),'catalog-loan');action.disabled=b.borrowedByMe||(b.lending==='limited'&&!b.available)||pendingLoans.has(b.id);action.setAttribute('aria-label',b.title+'：'+action.textContent);item.append(action);}$('book-list').append(item);});
 if(!list.length)$('book-list').append(node('p',t('未找到匹配资源，可清除筛选或收录新资源。'),'empty'));
 $('catalog-status').textContent=t('当前图书：{title}',{title:current()?.title||t('未选择')})+(state.tags.size||q||type!=='all'?t(' · 筛选 {count} 项',{count:list.length}):'');
}
async function ranks(){try{state.ranks=await api('/rankings');renderRanks();}catch(e){$('rank-caption').textContent=e.message;}}
function renderRanks(){
 document.querySelectorAll('[data-rank]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.rank===state.rank)));
 const rows=state.ranks[state.rank];const populated=!state.exampleRanks&&rows.length>0;
 const items=populated?rows.map(r=>({...state.resources.find(b=>b.id===r.resource_id),count:r.count})).filter(b=>b.id).slice(0,3):state.resources.slice(0,3);
 $('rank-caption').textContent=state.exampleRanks?t('近 7 天 · 示例数据'):populated?t('近 7 天 · 本机统计'):t('暂无统计 · 馆藏推荐');
 $('rank-list').replaceChildren();items.forEach((b,i)=>{const row=node('div',undefined,'rank-row'),info=button('',()=>select(b.id,true),'rank-book');info.append(node('strong',b.title),node('small',b.id==='alice'?'Alice in Wonderland':b.english||b.author),node('small',populated?t('{count} 次 · {author}',{count:b.count,author:b.author}):b.author));const tags=node('div',undefined,'rank-tags');b.tags.slice(0,3).forEach(t=>tags.append(tag(t)));row.append(node('span',populated||state.exampleRanks?String(i+1).padStart(2,'0'):'—','rank-number'),cover(b,i),info,tags);$('rank-list').append(row);});
 $('rank-position').textContent=['view','open','loan'].map(k=>k===state.rank?'●':'○').join('  ');$('rank-pause').textContent=state.paused?t('继续轮播'):t('暂停轮播');
}
function step(n){const keys=['view','open','loan'];state.rank=keys[(keys.indexOf(state.rank)+n+3)%3];renderRanks();}
let hoverRank=false;document.querySelector('.ranking').onmouseenter=()=>hoverRank=true;document.querySelector('.ranking').onmouseleave=()=>hoverRank=false;
setInterval(()=>{if(!state.paused&&!document.hidden&&!hoverRank&&!document.querySelector('.ranking').contains(document.activeElement))step(1);},8000);
async function select(id,record=false){
 const b=state.resources.find(b=>b.id===id);if(!b)return;const v=++state.version;state.selected=id;state.notes=[];state.selection=null;window.dispatchEvent(new Event('book-changing'));$('note').value='';document.querySelector('.annotations').classList.remove('show-notes');$('selected-quote').textContent=b.id==='pride'?'“ universally acknowledged ”':t('选中原文，为这段文字留下理解。');$('sample-note').hidden=b.id!=='pride';renderCatalog();renderReader();renderNotes();
 try{const notes=await api('/annotations/'+id);if(v!==state.version)return;state.notes=notes;renderReader();renderNotes();window.dispatchEvent(new Event('book-selected'));if(record){await api('/events/'+id,'POST',{kind:'view'});await ranks();}}catch(e){message(e.message);}
}
function renderReader(){
 const b=current();if(!b)return;$('reader-title').textContent=b.english||b.title;renderLoanControls();$('version').textContent=b.description+' · '+b.version;
 $('source-link').href=b.url;$('source-link').textContent=(b.originalRights||b.rights)?.includes('本站原创')?t('延伸阅读来源 ↗'):t('访问完整原文 ↗');document.querySelector('.chapter-label').textContent=b.chapters?.[0]?.title||t('开篇节选');
 const text=$('reader-text');text.replaceChildren();text.style.setProperty('font-size',state.font+'px','important');
 b.paragraphs.forEach((p,i)=>{const el=node('p');el.dataset.paragraph=i;el.tabIndex=-1;el.id='paragraph-'+i;
 const intervals=state.notes.filter(n=>n.version===b.version&&n.paragraph===i).map(n=>[n.start,n.end]).sort((a,b)=>a[0]-b[0]);if(b.id==='pride'&&i===0&&p.includes('universally acknowledged')){const j=p.indexOf('universally acknowledged');intervals.push([j,j+24]);intervals.sort((a,b)=>a[0]-b[0]);}let merged=[];for(const span of intervals){const last=merged.at(-1);if(last&&span[0]<=last[1])last[1]=Math.max(last[1],span[1]);else merged.push([...span]);}
 let pos=0;for(const [start,end] of merged){el.append(document.createTextNode(p.slice(pos,start)),node('mark',p.slice(start,end)));pos=end;}el.append(document.createTextNode(p.slice(pos)));text.append(el);});
 if(!b.paragraphs.length)text.append(node('p',t('这项资源收录了来源链接，尚未导入原文。可以访问来源阅读，或在资源管理中收录有权使用的节选。'),'empty'));
}
function renderNotes(){
 $('note-list').replaceChildren();if(!state.notes.length)$('note-list').append(node('p',t('还没有批注。你的第一次理解，可以从一个词开始。'),'empty'));
 state.notes.forEach(n=>{const box=node('article',undefined,'note-card');const quote=button(n.quote,()=>{if(n.version!==current().version){message(t('这是旧版原文的批注，保留原选段供核对。'));return;}$('paragraph-'+n.paragraph)?.scrollIntoView({block:'center',behavior:'auto'});$('selected-quote').textContent=n.quote;},'quote-link');box.append(quote,node('small',new Date(n.created_at.replace(' ','T')+'Z').toLocaleString(I18n.language)+t(' · 私人笔记')),node('p',n.note||t('仅划线')),button(t('删除'),async()=>{if(!confirm(t('删除这条私人批注？')))return;try{await api('/annotation/'+n.id,'DELETE');await reloadNotes();message(t('已删除批注'));}catch(e){message(e.message);}}));$('note-list').append(box);});
}
async function reloadNotes(){const id=state.selected,v=state.version;const notes=await api('/annotations/'+id);if(id!==state.selected||v!==state.version)return;state.notes=notes;renderReader();renderNotes();}
function capture(){
 const selection=window.getSelection();if(!selection||selection.isCollapsed||!selection.rangeCount)return;
 const r=selection.getRangeAt(0),element=n=>n.nodeType===1?n:n.parentElement;
 const p=element(r.startContainer)?.closest('[data-paragraph]'),end=element(r.endContainer)?.closest('[data-paragraph]');
 if(!p||p!==end||!$('reader-text').contains(p))return;
 const before=r.cloneRange();before.selectNodeContents(p);before.setEnd(r.startContainer,r.startOffset);const start=before.toString().length;const quote=r.toString();if(!quote.trim())return;
 $('sample-note').hidden=true;document.querySelector('.annotations').classList.remove('show-notes');state.selection={paragraph:Number(p.dataset.paragraph),start,end:start+quote.length,quote,version:current().version};$('selected-quote').textContent=quote;
}
document.addEventListener('selectionchange',capture);
async function save(highlight=false){
 const b=current();if(!b||!state.selection){message(t('请先在原文中选中一段文字。'));return;}
 if(!state.user){openAccount();return;}
 if(b.kind==='ebook'&&b.lending==='limited'&&!b.borrowedByMe){message(t('请先点击「借阅电子版」，再保存划线或批注。'));return;}
 if(!highlight&&!$('note').value.trim()){message(t('请填写批注，或使用「划线」仅保存选区。'));return;}
 const id=b.id,body={...state.selection,note:highlight?'':$('note').value};$('save-note').disabled=true;$('highlight').disabled=true;
 try{await api('/annotations/'+id,'POST',body);if(state.selected===id){$('note').value='';state.selection=null;$('selected-quote').textContent=t('已保存。可以继续选择原文。');await reloadNotes();document.querySelector('.annotations').classList.add('show-notes');}message(highlight?t('划线已保存'):t('私人批注已保存'));}catch(e){message(e.message);}finally{$('save-note').disabled=false;$('highlight').disabled=false;}
}
function renderLoanControls(){const b=current();if(!b)return;const ebook=b.kind==='ebook',busy=pendingLoans.has(b.id),blocked=b.lending==='limited'&&!b.available;
 $('loan-state').dataset.limited=String(b.lending==='limited');const label=b.borrowedByMe?t('已在书架'):blocked?t('已被借走'):b.lending==='limited'?t('借阅图书'):t('加入书架');
 $('loan-state').textContent=ebook?(b.borrowedByMe?t('我的借阅'):b.lending==='limited'?t('限额借阅'):t('开放共读')):t('开放阅读');
 $('loan-button').hidden=false;$('loan-button').textContent=busy?t('处理中…'):label;$('loan-button').disabled=busy||b.borrowedByMe||blocked;
 $('return-button').hidden=!b.borrowedByMe;$('return-button').textContent=ebook?t('归还'):t('移出书架');$('return-button').disabled=busy;
 $('loan-feature').disabled=busy||b.borrowedByMe||blocked;$('loan-feature').querySelector('strong').textContent=label;
}

async function refreshLoans(){const previous=state.user?.id;await loadAccount();state.resources=I18n.resources(await api('/resources'));if(previous!==state.user?.id&&state.selected)await select(state.selected);else{renderCatalog();renderLoanControls();}}
async function loan(id=state.selected,returning=false){if(!state.user){openAccount();return;}const b=state.resources.find(b=>b.id===id);if((!b&&!returning)||pendingLoans.has(id))return;
 if(!returning&&(b.borrowedByMe||(b.lending==='limited'&&!b.available))){message(t('已被借走'));return;}
 pendingLoans.add(id);renderCatalog();renderLoanControls();
 try{await api('/loans/'+id,returning?'DELETE':'POST');await refreshLoans();await ranks();message(returning?t('已移出书架，私人笔记仍保留。'):t('已加入书架，可以继续阅读和批注。'));}
 catch(e){message(e.message);try{await refreshLoans();}catch{}}
 finally{pendingLoans.delete(id);renderCatalog();renderLoanControls();}}
window.addEventListener('focus',()=>refreshLoans().catch(()=>{}));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshLoans().catch(()=>{});});

function details(){const b=current();if(!b)return;const box=$('resource-details');box.replaceChildren(node('h3',b.title),node('p',b.english),node('p',t('作者 / ')+b.author),node('p',t('类型 / ')+types[b.kind]),node('p',b.description));const tags=node('div',undefined,'tags');b.tags.forEach(t=>{const btn=tag(t);const handler=btn.onclick;btn.onclick=()=>{$('resource-dialog').close();handler();};tags.append(btn);});const source=node('a',t('访问来源 ↗'));source.href=b.url;source.target='_blank';source.rel='noopener noreferrer';box.append(tags,node('p',t('版本 / ')+b.version),node('p',t('语言 / ')+(b.language||'en')),node('p',b.rights||t('内容使用依据请核对来源。')),source);const research=node('a',t('搜索此资源的背景资料 ↗'));research.href='https://www.bing.com/search?q='+encodeURIComponent([b.english||b.title,b.author].join(' '));research.target='_blank';research.rel='noopener noreferrer';const p=node('p');p.append(research);box.append(p);$('resource-dialog').showModal();}
$('filter').oninput=renderCatalog;$('type-filter').onchange=renderCatalog;$('clear-filter').onclick=()=>{$('filter').value='';$('type-filter').value='all';state.tags.clear();renderCatalog();renderRanks();};
$('rank-prev').onclick=()=>step(-1);$('rank-next').onclick=()=>step(1);$('rank-pause').onclick=()=>{state.paused=!state.paused;renderRanks();};document.querySelectorAll('[data-rank]').forEach(b=>b.onclick=()=>{state.rank=b.dataset.rank;renderRanks();});
$('highlight').onclick=()=>save(true);$('annotate').onclick=()=>{if(!state.selection){message(t('先选择需要批注的原文。'));return;}showPrivate(true);$('note').focus();};
$('annotation-form').onsubmit=e=>{e.preventDefault();save();};$('loan-button').onclick=()=>loan();$('return-button').onclick=()=>loan(state.selected,true);$('loan-feature').onclick=()=>loan();
$('smaller').onclick=()=>{state.font=Math.max(15,state.font-2);$('reader-text').style.setProperty('font-size',state.font+'px','important');};$('larger').onclick=()=>{state.font=Math.min(29,state.font+2);$('reader-text').style.setProperty('font-size',state.font+'px','important');};
$('details').onclick=details;$('info-feature').onclick=details;
$('read-feature').onclick=()=>{$('reader-text').focus();$('reader-text').scrollIntoView({block:'center'});if(current())api('/events/'+state.selected,'POST',{kind:'open'}).then(ranks).catch(e=>message(e.message));};
$('source-link').onclick=()=>{if(current())api('/events/'+state.selected,'POST',{kind:'open'}).then(ranks).catch(e=>message(e.message));};
function showPrivate(yes){$('private-panel').hidden=!yes;$('public-panel').hidden=yes;$('private-tab').setAttribute('aria-pressed',yes);$('public-tab').setAttribute('aria-pressed',!yes);}$('private-tab').onclick=()=>{showPrivate(true);document.querySelector('.annotations').classList.toggle('show-notes');};$('public-tab').onclick=()=>{showPrivate(false);window.dispatchEvent(new Event('show-discussions'));};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$('manage').onclick=async()=>{if(!state.user){openAccount();return;}if(state.user.role!=='admin'){message(t('资源管理仅向管理员开放。'));return;}$('manage-dialog').showModal();$('loan-history').textContent=t('加载中…');try{const history=await api('/history');$('loan-history').replaceChildren();history.forEach(h=>$('loan-history').append(node('p',`${state.resources.find(b=>b.id===h.resource_id)?.title||h.resource_id} · ${h.returned_at?t('已归还'):t('借阅中')} · ${h.borrowed_at} UTC`)));if(!history.length)$('loan-history').textContent=t('还没有电子借阅记录。');}catch(e){$('loan-history').textContent=e.message;}};
$('resource-form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{const data=Object.fromEntries(new FormData(e.target));const added=await api('/resources','POST',data);state.resources=I18n.resources(await api('/resources'));$('filter').value='';$('type-filter').value='all';state.tags.clear();await select(added.id);renderRanks();e.target.reset();$('manage-dialog').close();message(t('已收录到网络资源馆。'));}catch(err){$('manage-message').textContent=err.message;}finally{b.disabled=false;}};
(async()=>{try{await loadAccount();state.resources=I18n.resources(await api('/resources'));await select(I18n.resumeId(state.resources));await ranks();I18n.restore();}catch(e){$('book-list').textContent=t('加载失败，请刷新重试。');message(e.message);}})();

// Reference-calibrated layout. Keep the full functional page at the reference proportions.
function sizeReference(){document.documentElement.style.setProperty('--reference-scale',window.innerWidth>=1000?Math.min((document.documentElement.clientWidth-28)/1556,1.35):1);}
sizeReference();window.addEventListener('resize',sizeReference);
$('rank-caption').onclick=()=>{state.exampleRanks=!state.exampleRanks;renderRanks();};
$('compact').onclick=()=>document.querySelector('.desktop').classList.toggle('compact');
$('expand').onclick=()=>document.querySelector('.desktop').classList.toggle('focus');
$('reset-view').onclick=()=>{document.querySelector('.desktop').classList.remove('compact','focus');document.querySelectorAll('.window').forEach(w=>w.classList.remove('expanded','collapsed'));};
for(const panel of document.querySelectorAll('.workspace>.window,.ranking')){
 const title=panel.querySelector('.titlebar');const old=title.lastElementChild;if(old&&old.getAttribute('aria-hidden')==='true'&&!old.classList.contains('tiny-folder'))old.remove();
 const controls=node('span',undefined,'window-controls');const label=title.textContent.trim();
 controls.append(button('−',()=>panel.classList.toggle('collapsed')));
 if(!panel.classList.contains('ranking'))controls.append(button('□',()=>{panel.classList.remove('collapsed');panel.classList.toggle('expanded');}));
 controls.append(button('×',()=>{panel.classList.remove('expanded');panel.classList.toggle('collapsed');}));
 [...controls.children].forEach((b,i)=>b.setAttribute('aria-label',label+' '+(i===0?t('折叠或展开'):i===controls.children.length-1?t('收起窗口'):t('切换专注视图'))));title.append(controls);
}
$('font-menu').onclick=()=>{$('font-options').hidden=!$('font-options').hidden;$('chapter-options').hidden=true;};
$('chapter-menu').onclick=()=>{$('chapter-options').hidden=!$('chapter-options').hidden;$('font-options').hidden=true;};
$('chapter-start').onclick=()=>{$('reader-text').scrollTop=0;$('chapter-options').hidden=true;};
$('float-highlight').onclick=()=>save(true);
$('float-note').onclick=()=>{$('annotate').click();};
$('float-question').onclick=()=>{if(!state.selection){message(t('先选择原文，再写下你的疑问。'));return;}$('note').value=t('我的疑问：');$('annotate').click();};
$('previous-book').onclick=()=>{const i=state.resources.findIndex(b=>b.id===state.selected);select(state.resources[(i-1+state.resources.length)%state.resources.length]?.id,true);};
$('next-book').onclick=()=>{const i=state.resources.findIndex(b=>b.id===state.selected);select(state.resources[(i+1)%state.resources.length]?.id,true);};
// Move the type filter into management so the reference layout stays uncluttered.
const tools=document.querySelector('.catalog-tools');tools.hidden=false;$('manage-dialog').querySelector('.dialog-body').prepend(tools);

const pencilIcon='<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16 16 4l4 4L8 20l-5 1 1-5Z M13 7l4 4 M4 16l4 4" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
const bubbleIcon='<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14l2 2v12l-2 2H9l-4 3v-3H3V5Z" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
const pageIcon='<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 2h14v20H5Z M8 7h8 M8 11h8 M8 15h8 M8 18h6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
$('highlight').innerHTML=pencilIcon+t('划线');$('annotate').innerHTML=bubbleIcon+t('批注');$('float-highlight').innerHTML=pencilIcon+t('划线');$('float-note').innerHTML=pageIcon+t('写批注');$('private-tab').innerHTML=bubbleIcon+t(' 我的批注');

let accountMode='login';
function openAccount(mode='login'){
 accountMode=mode;$('login-tab').setAttribute('aria-pressed',mode==='login');$('register-tab').setAttribute('aria-pressed',mode==='register');
 $('confirm-field').hidden=mode!=='register';$('password-confirm').required=mode==='register';$('password').autocomplete=mode==='register'?'new-password':'current-password';
 $('account-submit').textContent=mode==='register'?t('注册并登录'):t('登录');$('account-error').textContent='';
 if(!$('account-dialog').open)$('account-dialog').showModal();
}
async function loadAccount(){const r=await fetch('/api/account/me');if(!r.ok)throw Error(t('无法读取账号状态'));state.user=(await r.json()).user;
 $('account-open').textContent=state.user?t('读者 · ')+state.user.username:t('登录 / 注册');$('logout').hidden=!state.user;$('my-loans').hidden=!state.user;
}
async function accountRequest(action,body){const r=await fetch('/api/account/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});const data=await r.json();if(!r.ok)throw Error(I18n.error(data.error));return data;}
$('account-open').onclick=()=>state.user?showLoans():openAccount();$('login-tab').onclick=()=>openAccount();$('register-tab').onclick=()=>openAccount('register');
$('account-form').onsubmit=async e=>{e.preventDefault();if(accountMode==='register'&&$('password').value!==$('password-confirm').value){$('account-error').textContent=t('两次输入的密码不一致');return;}
 $('account-submit').disabled=true;try{await accountRequest(accountMode,{username:$('username').value,password:$('password').value});$('account-form').reset();$('account-dialog').close();await refreshLoans();message(t('已登录，借阅与批注将保存在你的账号中。'));}catch(err){$('account-error').textContent=err.message;}finally{$('account-submit').disabled=false;}};
$('logout').onclick=async()=>{try{await accountRequest('logout');$('manage-dialog').close();$('my-loans-dialog').close();$('loan-history').replaceChildren();$('my-loans-list').replaceChildren();await refreshLoans();message(t('已退出账号'));}catch(e){message(e.message);}};
async function showLoans(){if(!state.user){openAccount();return;}const box=$('my-loans-list');box.textContent=t('加载中…');if(!$('my-loans-dialog').open)$('my-loans-dialog').showModal();try{const rows=await api('/history');box.replaceChildren();if(!rows.length)box.append(node('p',t('还没有借阅记录，去电子馆藏选择一本书吧。')));for(const h of rows){const book=state.resources.find(b=>b.id===h.resource_id);const item=node('article',undefined,'account-loan');item.append(node('strong',book?.title||h.title||t('图书')),node('p',(h.returned_at?t('已归还'):t('借阅中'))+' · '+new Date(h.borrowed_at.replace(' ','T')+'Z').toLocaleString(I18n.language)));if(!h.archived)item.append(button(t('打开阅读'),()=>{$('my-loans-dialog').close();select(h.resource_id);}));else item.append(node('p',t('该资源已下架，仍可归还。')));if(h.due_at)item.append(node('p',t('到期：')+new Date(h.due_at.replace(' ','T')+'Z').toLocaleString(I18n.language)));if(h.due_at&&!h.returned_at&&!h.renewed)item.append(button(t('续借'),async()=>{try{await api('/loans/'+h.resource_id+'/renew','POST');await showLoans();}catch(e){message(e.message);}}));if(!h.returned_at)item.append(button(book?.kind==='ebook'?t('归还图书'):t('移出书架'),async()=>{await loan(h.resource_id,true);await showLoans();}));box.append(item);}window.dispatchEvent(new Event('loan-history-loaded'));}catch(e){box.textContent=e.message;}}
$('my-loans').onclick=showLoans;
