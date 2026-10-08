'use strict';
// Only interface literals and known seed metadata are localized. Never translate reader text.
const I18n=(()=>{
 let language='en';
 try{if(localStorage.getItem('bookloop-language')==='zh-CN')language='zh-CN';}catch{}
 const dictionary=window.BookloopLocales[language];
 function translate(key,values={}){const value=Object.hasOwn(dictionary,key)?dictionary[key]:key;return String(value??'').replace(/\{(\w+)\}/g,(all,name)=>Object.hasOwn(values,name)?String(values[name]):all);}
 function localize(root){
  const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
  while(n=walk.nextNode()){
   if(n.parentElement?.closest('script,style,textarea,code'))continue;
   const source=n.textContent,trimmed=source.trim();
   if(Object.hasOwn(dictionary,trimmed))n.textContent=source.slice(0,source.indexOf(trimmed))+translate(trimmed)+source.slice(source.indexOf(trimmed)+trimmed.length);
  }
  root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el=>{
   for(const attr of ['placeholder','title','aria-label'])if(el.hasAttribute(attr))el.setAttribute(attr,translate(el.getAttribute(attr)));
  });
 }
 function html(markup){const tpl=document.createElement('template');tpl.innerHTML=markup;localize(tpl.content);return tpl.innerHTML;}
 const seedIds=new Set(['pride','walden','alice','repair-reading','reuse-reading','epa-reuse-excerpt']);
 function resources(rows){return rows.map(b=>{
  if(language!=='en'||!seedIds.has(b.id))return b;
  return {...b,originalTitle:b.title,originalRights:b.rights,title:b.english||b.title,author:translate(b.author),description:translate(b.description),rights:b.rights?translate(b.rights):b.rights,chapters:b.chapters?.map(c=>({...c,title:translate(c.title)}))};
 });}
 function error(value){if(!value)return translate('请求失败');if(value.endsWith('格式不正确'))return translate('{field}格式不正确',{field:language==='en'?({批注:'note',标题:'title',正文:'text',回复:'reply'}[value.slice(0,-5)]||translate(value.slice(0,-5)).toLowerCase()):value.slice(0,-5)});return translate(value);}
 let resume=null;
 try{const stored=sessionStorage.getItem('bookloop-language-resume');sessionStorage.removeItem('bookloop-language-resume');if(stored){const parsed=JSON.parse(stored);if(Date.now()-parsed.time<60000)resume=parsed;}}catch{}
 function resumeId(rows){return rows.some(b=>b.id===resume?.book)?resume.book:rows[0]?.id;}
 function restore(){
  if(!resume)return;const saved=resume;resume=null;
  if(saved.user!==(state.user?.id??null))return;
  // Restore unsent fields only to this same account, never passwords or publication consent.
  for(const [id,value] of Object.entries(saved.fields||{})){const el=document.getElementById(id);if(el&&el.type!=='password'&&el.type!=='checkbox'&&el.type!=='radio')el.value=value;}
  if(saved.context){({composed,replyTarget,selectedThread,editingResource,editingNote,practiceResource}=saved.context);if(editingResource){document.getElementById('resource-save').textContent=translate('保存资源修改');document.getElementById('resource-cancel-edit').hidden=false;}}
  state.tags=new Set(saved.tags||[]);state.font=saved.font||18;state.rank=saved.rank||'view';state.exampleRanks=Boolean(saved.exampleRanks);
  state.paused=state.paused||saved.paused;
  if(saved.selection?.version===current()?.version){state.selection=saved.selection;document.getElementById('selected-quote').textContent=saved.selection.quote;}
  renderCatalog();renderReader();renderNotes();renderRanks();
  document.getElementById('reader-text').scrollTop=saved.scroll||0;
  document.querySelector('.desktop').classList.toggle('focus',Boolean(saved.focus));
  document.querySelector('.desktop').classList.toggle('compact',Boolean(saved.compact));
  // Defer until the existing book-selected handler has restored the server's reading position.
  requestAnimationFrame(()=>{document.getElementById('reader-text').scrollTop=saved.scroll||0;});
 }
 function addSettings(dialog){
  const fieldset=document.createElement('fieldset');fieldset.className='language-settings';
  fieldset.innerHTML=html('<legend>界面语言</legend><label for="interface-language">Language / 语言</label><select id="interface-language"><option value="en">English</option><option value="zh-CN">简体中文</option></select><p>英文为默认语言；切换后保留当前阅读和未提交的笔记。</p><p id="language-error" role="alert"></p>');
  dialog.querySelector('.dialog-body').prepend(fieldset);
  const select=fieldset.querySelector('select');select.value=language;
  select.onchange=()=>{
   if(select.value===language)return;
   const fields={};document.querySelectorAll('textarea[id],input[id],select[id]').forEach(el=>{if(!['password','checkbox','radio','file','hidden'].includes(el.type)&&el.id!=='interface-language')fields[el.id]=el.value;});
   const saved={context:{composed,replyTarget,selectedThread,editingResource,editingNote,practiceResource},time:Date.now(),user:state.user?.id??null,book:state.selected,selection:state.selection,fields,tags:[...state.tags],font:state.font,rank:state.rank,exampleRanks:state.exampleRanks,paused:state.paused,scroll:document.getElementById('reader-text').scrollTop,focus:document.querySelector('.desktop').classList.contains('focus'),compact:document.querySelector('.desktop').classList.contains('compact')};
   try{sessionStorage.setItem('bookloop-language-resume',JSON.stringify(saved));localStorage.setItem('bookloop-language',select.value);location.reload();}
   catch{select.value=language;fieldset.querySelector('[role=alert]').textContent=translate('语言偏好无法保存，请检查浏览器存储设置。');}
  };
 }
 document.documentElement.lang=language;localize(document);document.documentElement.dataset.languageReady='true';
 return {get resuming(){return Boolean(resume);},language,t:translate,html,resources,error,addSettings,resumeId,restore};
})();
const t=I18n.t;
