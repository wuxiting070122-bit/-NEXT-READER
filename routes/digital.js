'use strict';
const {randomUUID}=require('crypto');
const accounts=require('./accounts');
const {sql,fail,safeURL,text,anchor,resource,notify}=require('./digital-core');
const seed=require('../data/digital-seed.json');
module.exports=app=>{
 let ready;
 async function setup(){
  await accounts.setup();
  await sql('CREATE TABLE IF NOT EXISTS digital_resources(id TEXT PRIMARY KEY,data TEXT NOT NULL)');
  await sql('CREATE TABLE IF NOT EXISTS digital_loans(id INTEGER PRIMARY KEY,resource_id TEXT NOT NULL,borrowed_at TEXT DEFAULT CURRENT_TIMESTAMP,returned_at TEXT)');
  await sql('CREATE TABLE IF NOT EXISTS digital_annotations(id TEXT PRIMARY KEY,resource_id TEXT NOT NULL,version TEXT NOT NULL,paragraph INTEGER NOT NULL,start INTEGER NOT NULL,end INTEGER NOT NULL,quote TEXT NOT NULL,note TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP)');
  await sql('CREATE TABLE IF NOT EXISTS digital_events(id INTEGER PRIMARY KEY,resource_id TEXT NOT NULL,kind TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP)');
  const add=async(table,name,type)=>{if(!(await sql('PRAGMA table_info('+table+')')).some(c=>c.name===name))await sql(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);};
  for(const t of ['digital_loans','digital_annotations'])await add(t,'user_id','TEXT REFERENCES digital_users(id)');
  await add('digital_loans','due_at','TEXT');await add('digital_loans','renewed','INTEGER NOT NULL DEFAULT 0');
  await sql('DROP INDEX IF EXISTS one_active_digital_loan');
  await sql('CREATE UNIQUE INDEX IF NOT EXISTS one_active_loan_per_reader ON digital_loans(resource_id,user_id) WHERE returned_at IS NULL');
  await sql('CREATE TABLE IF NOT EXISTS digital_reservations(id INTEGER PRIMARY KEY,resource_id TEXT NOT NULL,user_id TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(resource_id,user_id))');
  await sql('CREATE TABLE IF NOT EXISTS digital_progress(user_id TEXT NOT NULL,resource_id TEXT NOT NULL,version TEXT NOT NULL,paragraph INTEGER NOT NULL,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,resource_id))');
  await sql('CREATE TABLE IF NOT EXISTS digital_notifications(id INTEGER PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,message TEXT NOT NULL,target TEXT NOT NULL,read_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)');
  for(const b of [...seed,...require('../data/theme-seed.json')])await sql('INSERT OR IGNORE INTO digital_resources VALUES(?,?)',[b.id,JSON.stringify({...b,lending:'open',seats:1,loanDays:14,chapters:b.chapters||[{title:'开篇节选',start:0}]})]);
 }
 // All expiry/queue updates run on the same request path; opening the site processes overdue seats.
 async function expire(){
  const expired=await sql('UPDATE digital_loans SET returned_at=CURRENT_TIMESTAMP WHERE returned_at IS NULL AND due_at IS NOT NULL AND due_at<=CURRENT_TIMESTAMP RETURNING *');
  for(const loan of expired){await notify(loan.user_id,'expiry','限额电子借阅已到期，私人笔记仍保留。',loan.resource_id);await notifyQueue(loan.resource_id);}
 }
 async function notifyQueue(id){const [next]=await sql('SELECT user_id FROM digital_reservations WHERE resource_id=? ORDER BY id LIMIT 1',[id]);if(next)await notify(next.user_id,'reservation','预约资源有席位释放，请在我的借阅中查看。',id);}
 const route=(path,method,fn)=>app.route('/api/digital'+path,method,async(req,res)=>{
  res.type('json');res.setHeader('Cache-Control','no-store');try{
   if(method!=='get'&&req.headers.origin&&process.env.PUBLIC_ORIGIN){const oh=(req.headers.origin.split('//')[1]||'').split('/')[0];const ah=(process.env.PUBLIC_ORIGIN.split('//')[1]||'').split('/')[0];if(oh!==ah)fail('请求来源不匹配',403);}
   await(ready ||= setup());await expire();return await fn(req);
  }catch(e){res.status(e.status||500);return {error:e.status?e.message:'操作失败，请稍后重试'};}
 });
 function normalize(b,previous={}){
  const title=text(b.title,'标题',150);if(!['ebook','article','link'].includes(b.kind))fail('请选择资源类型');
  const content=text(b.content||'','正文',300000,false),paragraphs=[],chapters=[];
  for(const part of content.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean)){
   if(/^##\s+/.test(part)){const lines=part.split('\n');chapters.push({title:lines.shift().replace(/^##\s+/,''),start:paragraphs.length});if(lines.join('\n').trim())paragraphs.push(lines.join('\n'));}
   else paragraphs.push(part);
  }
  if(!chapters.length&&paragraphs.length)chapters.push({title:'正文',start:0});
  if(chapters.some(c=>c.start>=paragraphs.length))fail('章节标题后必须有正文');
  const lending=b.lending||'open',seats=Number(b.seats||1),loanDays=Number(b.loanDays||14);
  if(!['open','limited'].includes(lending)||!Number.isInteger(seats)||seats<1||seats>100||!Number.isInteger(loanDays)||loanDays<1||loanDays>60)fail('席位为 1–100，期限为 1–60 天');
  const changed=JSON.stringify(previous.paragraphs)!==JSON.stringify(paragraphs);
  return {...previous,id:previous.id||randomUUID(),title,kind:b.kind,url:safeURL(b.url),author:text(b.author||'未填写','作者',150),english:text(b.english||'','原文标题',200,false),description:text(b.description||'','说明',500,false),language:text(b.language||'en','语言',30),rights:text(b.rights||'','使用依据',500,false),tags:[...new Set(text(b.tags||'','关键词',300,false).split(/[,，]/).map(t=>t.trim().toUpperCase()).filter(Boolean))].slice(0,10),lending,seats,loanDays,paragraphs,chapters,version:changed?randomUUID():previous.version};
 }
 route('/resources','get',async req=>{
  const resources=await sql('SELECT data FROM digital_resources'),loans=await sql('SELECT * FROM digital_loans WHERE returned_at IS NULL'),queue=await sql('SELECT * FROM digital_reservations ORDER BY id');
  return resources.map(r=>JSON.parse(r.data)).filter(r=>!r.archived).map(r=>{const active=loans.filter(l=>l.resource_id===r.id),mine=active.find(l=>l.user_id===req.session.user?.id),waiting=queue.filter(q=>q.resource_id===r.id),position=waiting.findIndex(q=>q.user_id===req.session.user?.id);return {...r,lending:r.lending||'open',borrowed:active.length>0,borrowedByMe:!!mine,available:(r.lending||'open')==='open'||active.length<(r.seats||1),queuePosition:position+1,dueAt:mine?.due_at};});
 });
 route('/resources','post',async req=>{await accounts.requireAdmin(req);const r=normalize(req.body);await sql('INSERT INTO digital_resources VALUES(?,?)',[r.id,JSON.stringify(r)]);return r;});
 route('/admin/resources','get',async req=>{await accounts.requireAdmin(req);return(await sql('SELECT data FROM digital_resources')).map(r=>JSON.parse(r.data));});
 route('/resources/:id','put',async req=>{
  await accounts.requireAdmin(req);const old=await resource(req.params.id,true),r=normalize(req.body,old);
  if((old.lending||'open')!==r.lending||(old.seats||1)!==r.seats||(old.loanDays||14)!==r.loanDays){const active=await sql('SELECT id FROM digital_loans WHERE resource_id=? AND returned_at IS NULL UNION SELECT id FROM digital_reservations WHERE resource_id=?',[r.id,r.id]);if(active.length)fail('存在借阅或预约时不能变更借阅规则',409);}
  await sql('UPDATE digital_resources SET data=? WHERE id=?',[JSON.stringify(r),r.id]);return r;
 });
 route('/resources/:id/visibility','post',async req=>{await accounts.requireAdmin(req);if(typeof req.body.archived!=='boolean')fail('无效状态');const r=await resource(req.params.id,true);r.archived=req.body.archived;await sql('UPDATE digital_resources SET data=? WHERE id=?',[JSON.stringify(r),r.id]);return {ok:true};});
 route('/loans/:id','post',async req=>{
  const user=accounts.requireUser(req),r=await resource(req.params.id);
  const limited=r.lending==='limited';
  // Single atomic insert checks capacity and queue priority, including concurrent borrowers.
  const rows=await sql(`INSERT OR IGNORE INTO digital_loans(resource_id,user_id,due_at)
   SELECT ?,?,CASE WHEN ? THEN datetime('now',?) ELSE NULL END
   WHERE ?=0 OR ((SELECT COUNT(*) FROM digital_loans WHERE resource_id=? AND returned_at IS NULL) < ?
    AND (NOT EXISTS(SELECT 1 FROM digital_reservations WHERE resource_id=?)
      OR ?=(SELECT user_id FROM digital_reservations WHERE resource_id=? ORDER BY id LIMIT 1))) RETURNING id`,
   [r.id,user,limited?1:0,'+'+(r.loanDays||14)+' days',limited?1:0,r.id,r.seats||1,r.id,user,r.id]);
  if(!rows.length)fail('已被借走、已在书架中或席位正等待预约者领取',409);
  await sql('DELETE FROM digital_reservations WHERE resource_id=? AND user_id=?',[r.id,user]);return {ok:true};
 });
 route('/loans/:id','delete',async req=>{const user=accounts.requireUser(req);const rows=await sql('UPDATE digital_loans SET returned_at=CURRENT_TIMESTAMP WHERE resource_id=? AND user_id=? AND returned_at IS NULL RETURNING id',[req.params.id,user]);if(!rows.length)fail('只能归还自己借阅的图书',403);await notifyQueue(req.params.id);return {ok:true};});
 route('/loans/:id/renew','post',async req=>{const user=accounts.requireUser(req),r=await resource(req.params.id);if(r.lending!=='limited')fail('开放资源无需续借');const rows=await sql("UPDATE digital_loans SET due_at=datetime(due_at,?),renewed=1 WHERE resource_id=? AND user_id=? AND returned_at IS NULL AND renewed=0 AND NOT EXISTS(SELECT 1 FROM digital_reservations WHERE resource_id=?) RETURNING id",['+'+(r.loanDays||14)+' days',r.id,user,r.id]);if(!rows.length)fail('仅可续借一次，且需无其他读者预约',409);return {ok:true};});
 route('/reservations/:id','post',async req=>{const user=accounts.requireUser(req),r=await resource(req.params.id);if(r.kind!=='ebook'||r.lending!=='limited')fail('仅限额电子书可预约');if((await sql('SELECT id FROM digital_loans WHERE resource_id=? AND user_id=? AND returned_at IS NULL',[r.id,user])).length)fail('已借阅，无需预约');await sql('INSERT OR IGNORE INTO digital_reservations(resource_id,user_id) VALUES(?,?)',[r.id,user]);return {ok:true};});
 route('/reservations/:id','delete',async req=>{await sql('DELETE FROM digital_reservations WHERE resource_id=? AND user_id=?',[req.params.id,accounts.requireUser(req)]);await notifyQueue(req.params.id);return {ok:true};});
 route('/reservations','get',req=>sql('SELECT * FROM digital_reservations WHERE user_id=? ORDER BY id',[accounts.requireUser(req)]));
 route('/history','get',async req=>{const rows=await sql('SELECT * FROM digital_loans WHERE user_id=? ORDER BY id DESC',[accounts.requireUser(req)]);for(const row of rows){const r=await resource(row.resource_id,true);row.title=r.title;row.archived=!!r.archived;}return rows;});
 route('/annotations/:id','get',async req=>{await resource(req.params.id,true);if(!req.session.user)return [];return sql('SELECT * FROM digital_annotations WHERE resource_id=? AND user_id=? ORDER BY created_at DESC,id DESC',[req.params.id,req.session.user.id]);});
 route('/annotations/:id','post',async req=>{const user=accounts.requireUser(req),r=await resource(req.params.id),b=req.body;
  if(r.kind==='ebook'&&r.lending==='limited'&&!(await sql('SELECT id FROM digital_loans WHERE resource_id=? AND user_id=? AND returned_at IS NULL',[r.id,user])).length)fail('请先借阅该限额电子书',409);
  anchor(r,b);const note=text(b.note,'批注',2000,false),id=randomUUID();await sql('INSERT INTO digital_annotations(id,resource_id,version,paragraph,start,end,quote,note,user_id) VALUES(?,?,?,?,?,?,?,?,?)',[id,r.id,r.version,b.paragraph,b.start,b.end,b.quote,note,user]);return {ok:true,id};
 });
 route('/annotation/:id','put',async req=>{const rows=await sql('UPDATE digital_annotations SET note=? WHERE id=? AND user_id=? RETURNING id',[text(req.body.note,'批注',2000,false),req.params.id,accounts.requireUser(req)]);if(!rows.length)fail('批注不存在',404);return {ok:true};});
 route('/annotation/:id','delete',async req=>{const rows=await sql('DELETE FROM digital_annotations WHERE id=? AND user_id=? RETURNING id',[req.params.id,accounts.requireUser(req)]);if(!rows.length)fail('批注不存在或不属于当前账号',404);return {ok:true};});
 route('/progress/:id','get',async req=>{const [row]=await sql('SELECT * FROM digital_progress WHERE resource_id=? AND user_id=?',[req.params.id,accounts.requireUser(req)]);return row||{};});
 route('/progress/:id','put',async req=>{const user=accounts.requireUser(req),r=await resource(req.params.id),b=req.body;if(b.version!==r.version||!Number.isInteger(b.paragraph)||!r.paragraphs[b.paragraph])fail('阅读位置已失效，请重新选择');await sql('INSERT INTO digital_progress(user_id,resource_id,version,paragraph) VALUES(?,?,?,?) ON CONFLICT(user_id,resource_id) DO UPDATE SET version=excluded.version,paragraph=excluded.paragraph,updated_at=CURRENT_TIMESTAMP',[user,r.id,r.version,b.paragraph]);return {ok:true};});
 route('/notifications','get',req=>sql('SELECT * FROM digital_notifications WHERE user_id=? ORDER BY id DESC LIMIT 100',[accounts.requireUser(req)]));
 route('/notifications/:id/read','post',async req=>{await sql('UPDATE digital_notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?',[req.params.id,accounts.requireUser(req)]);return {ok:true};});
 route('/events/:id','post',async req=>{await resource(req.params.id);if(!['view','open'].includes(req.body.kind))fail('未知事件');await sql('INSERT INTO digital_events(resource_id,kind) VALUES(?,?)',[req.params.id,req.body.kind]);return {ok:true};});
 route('/rankings','get',async()=>{const rank=kind=>sql("SELECT resource_id,COUNT(*) AS count FROM digital_events WHERE kind=? AND created_at>=datetime('now','-7 days') GROUP BY resource_id ORDER BY count DESC,resource_id LIMIT 3",[kind]);return {view:await rank('view'),open:await rank('open'),loan:await sql("SELECT resource_id,COUNT(*) AS count FROM digital_loans WHERE borrowed_at>=datetime('now','-7 days') GROUP BY resource_id ORDER BY count DESC,resource_id LIMIT 3")};});
 require('./community')(route);
};
