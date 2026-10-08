'use strict';
const $ = id => document.getElementById(id);
const config = {
 book: { label:'图书资料', hint:'用书名、作者或 ISBN 确认图书，补充版本与内容信息。', words:['ISBN','版本区别','内容简介','出版社'] },
 repair: { label:'修复方法', hint:'描述装订方式和破损状况。检索资料后，请结合实际书况判断。', words:['平装书','书脊开裂','书页脱落','封面破损','修复方法'] },
 circulation: { label:'流转渠道', hint:'填写地区和图书类型，查找渠道，并核实最新接收条件。', words:['旧书捐赠','社区书屋','图书交换','儿童绘本','接收条件'] }
};
let kind = 'book', books = [], noteKind = null, searchVersion = 0, notesVersion = 0;
function el(tag, text, cls) { const n = document.createElement(tag); if(text !== undefined) n.textContent = text; if(cls) n.className = cls; return n; }
function link(title,url) { const n = el('a',title); n.href=url; n.target='_blank'; n.rel='noopener noreferrer'; return n; }
async function api(path, options) { const r = await fetch(path,options); if (!r.ok) { const d=await r.json().catch(()=>({})); throw new Error(d.error || '请求失败，请稍后重试'); } return r.json(); }
const post = body => ({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
function changeKind(next) {
 kind=next; searchVersion++; $('results').replaceChildren(); $('external').replaceChildren(); $('search-status').textContent='';
 document.querySelectorAll('[data-kind]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.kind===kind)));
 $('guidance').textContent=config[kind].hint; $('city').disabled=kind!=='circulation'; $('city-field').hidden=kind!=='circulation'; $('chips').replaceChildren();
 config[kind].words.forEach(word=>{const b=el('button',word);b.type='button';b.onclick=()=>{ $('query').value=($('query').value+' '+word).trim().slice(0,300); };$('chips').append(b);});
 const book=books.find(b=>b.id===$('book').value);
 $('query').value=kind==='book'&&book ? [book.title,book.author].filter(Boolean).join(' ') : '';
}
async function loadNotes() {
 const version=++notesVersion, id=$('book').value;
 $('notes').textContent=id?'加载中…':'选择一本图书，查看保存的线索。'; if(!id)return;
 try {const notes=await api('/api/research/notes?book='+encodeURIComponent(id));if(version!==notesVersion)return;
 $('notes').replaceChildren(); if(!notes.length)$('notes').textContent='还没有保存的资料。';
 notes.forEach(n=>{const box=el('article',undefined,'note');box.append(link(n.title,n.url),el('div',config[n.kind].label+' · 记录于 '+n.created_at+' UTC','meta'),el('p',n.note));const del=el('button','移除资料');del.onclick=async()=>{if(!confirm('移除这条已保存的资料？'))return;try{await api('/api/research/notes/'+n.id,{method:'DELETE'});await loadNotes();}catch(e){$('save-status').textContent=e.message;}};box.append(del);$('notes').append(box);});
 }catch(e){if(version===notesVersion)$('notes').textContent=e.message;}
}
$('book').onchange=()=>{renderBooks();changeKind(kind);$('note-form').reset();noteKind=null;$('save-status').textContent='';loadNotes();};
document.querySelectorAll('[data-kind]').forEach(n=>n.onclick=()=>changeKind(n.dataset.kind));
$('search-form').onsubmit=async event=>{
 event.preventDefault(); const query=[$('query').value.trim(),kind==='circulation'?$('city').value.trim():''].filter(Boolean).join(' ');
 if(!query)return;const version=++searchVersion, searchedKind=kind; $('search-submit').disabled=true;$('search-status').textContent='正在查找资料…';$('results').replaceChildren();$('external').replaceChildren();
 try {const data=await api('/api/research/search',post({query,kind}));if(version!==searchVersion)return;
 $('search-status').textContent=data.mode==='live' ? (data.results.length ? '检索完成 · '+new Date(data.searchedAt).toLocaleString() : '未找到结果，请调整关键词。') : data.message;
 data.links.forEach(l=>$('external').append(link(l.title,l.url)));
 data.results.forEach(r=>{const box=el('article',undefined,'result');const title=el('h3');title.append(link(r.title,r.url));box.append(title,el('div',new URL(r.url).hostname+(r.published?' · '+r.published:' · 来源未提供发布日期'),'meta'),el('p',r.description));const save=el('button','选用这条资料');save.onclick=()=>{$('note-title').value=r.title.slice(0,200);$('note-url').value=r.url;noteKind=searchedKind;$('save-status').textContent='已选用「'+config[noteKind].label+'」资料，请核实原文并补充判断后保存。';$('note-title').focus();};box.append(save);$('results').append(box);});
 }catch(e){if(version===searchVersion)$('search-status').textContent=e.message;}finally{$('search-submit').disabled=false;}
};
$('note-form').onsubmit=async event=>{
 event.preventDefault();if(!$('book').value){$('save-status').textContent='请先选择要关联的馆藏图书。';return;}
 const button=event.submitter;button.disabled=true;
 try {await api('/api/research/notes',post({book_id:$('book').value,kind:noteKind||kind,title:$('note-title').value,url:$('note-url').value,note:$('note-text').value}));$('note-form').reset();noteKind=null;$('save-status').textContent='已保存到图书资料档案。';await loadNotes();}catch(e){$('save-status').textContent=e.message;}finally{button.disabled=false;}
};
changeKind('book');
api('/api/research/books').then(data=>{books=data;$('book').replaceChildren(new Option('不关联图书，直接搜索',''));books.forEach(b=>$('book').append(new Option(b.title+' · '+b.id,b.id)));renderBooks();}).catch(()=>{$('book').replaceChildren(new Option('馆藏加载失败，请刷新页面',''));});

function renderBooks(){
 const term=$('book-filter').value.trim().toLowerCase();$('book-cards').replaceChildren();
 const filtered=books.filter(b=>(b.title+' '+b.author+' '+b.id).toLowerCase().includes(term));
 if(!filtered.length)$('book-cards').textContent='没有找到这本书，试试其他关键词。';
 filtered.forEach(b=>{const button=el('button',undefined,'book-card');button.type='button';button.setAttribute('aria-pressed',String(b.id===$('book').value));
 const cover=el('span',b.title,'mini-cover'); const info=el('span',undefined,'book-info');info.append(el('strong',b.title),el('small',b.author||'作者未记录'),el('small',b.id));button.append(cover,info);button.onclick=()=>{$('book').value=b.id;$('book').onchange();};$('book-cards').append(button);});
 const selected=books.find(b=>b.id===$('book').value);$('current-book').replaceChildren();
 if(selected){$('current-book').append(el('span','当前正在照料','eyebrow'),el('h3',selected.title),el('p',selected.publisher||'出版社未记录'),el('small','书况尚未记录 · 可先查找资料'));}else $('current-book').textContent='选一本书，开始记录它的新一页。';
}
$('book-filter').oninput=renderBooks;$('unselect').onclick=()=>{$('book').value='';$('book').onchange();};
