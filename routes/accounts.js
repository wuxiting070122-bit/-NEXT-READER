'use strict';
const {randomBytes, randomUUID, scrypt: derive, timingSafeEqual}=require('crypto');
const {promisify}=require('util');
const scrypt=promisify(derive);
const db=require('../coSqlite3');
const sql=(sql,args=[])=>db.SingleSQL({sql,args});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
let ready;
const setup=()=>ready ||= (async()=>{
 await sql('CREATE TABLE IF NOT EXISTS digital_users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP)');
 if(!(await sql('PRAGMA table_info(digital_users)')).some(c=>c.name==='role'))await sql("ALTER TABLE digital_users ADD COLUMN role TEXT NOT NULL DEFAULT 'reader'");
})();
async function requireAdmin(req){const id=requireUser(req);const [user]=await sql('SELECT role FROM digital_users WHERE id=?',[id]);if(user?.role!=='admin')fail('需要管理员权限',403);return id;}
async function profile(req){if(!req.session.user)return null;const [user]=await sql('SELECT id,username,role FROM digital_users WHERE id=?',[req.session.user.id]);return user||null;}
const requireUser=req=>{if(!req.session.user)fail('请先登录账号',401);return req.session.user.id;};
const attempts=new Map();
module.exports={requireUser,requireAdmin,profile,setup,install(app){
 const route=(path,method,fn)=>app.route('/api/account'+path,method,async(req,res)=>{
  res.type('json');res.setHeader('Cache-Control','no-store');
  try{
   if(method!=='get'&&req.headers.origin&&process.env.PUBLIC_ORIGIN){const oh=(req.headers.origin.split('//')[1]||'').split('/')[0];const ah=(process.env.PUBLIC_ORIGIN.split('//')[1]||'').split('/')[0];if(oh!==ah)fail('请求来源不匹配',403);}
   await setup();return await fn(req);
  }catch(e){res.status(e.status||500);return {error:e.status?e.message:'账号操作失败，请稍后重试'};}
 });
 const enter=async(req,user)=>{
  await new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
  req.session.user={id:user.id,username:user.username};
  await new Promise((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));
  return {user:await profile(req)};
 };
 for(const mode of ['register','login'])route('/'+mode,'post',async req=>{
  const now=Date.now(),key=req.socket.remoteAddress;
  for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);
  const limit=attempts.get(key)||{count:0,until:now+15*60*1000};
  if(++limit.count>40)fail('尝试次数过多，请 15 分钟后再试',429);attempts.set(key,limit);
  const {username,password}=req.body;
  if(typeof username!=='string'||!/^[a-zA-Z0-9_]{3,24}$/.test(username)||typeof password!=='string'||password.length<8||password.length>128)fail('账号需为 3–24 位字母、数字或下划线；密码需为 8–128 位');
  const name=username.toLowerCase();
  if(mode==='register'){
   const salt=randomBytes(16).toString('hex'),hash=(await scrypt(password,salt,64)).toString('hex');
   const user={id:randomUUID(),username:name};
   const rows=await sql('INSERT OR IGNORE INTO digital_users(id,username,password_hash) VALUES(?,?,?) RETURNING id',[user.id,name,salt+':'+hash]);
   if(!rows.length)fail('该账号已注册，请登录或更换账号',409);
   return enter(req,user);
  }
  const [user]=await sql('SELECT * FROM digital_users WHERE username=?',[name]);
  const [salt,hash]=(user?.password_hash||'00000000000000000000000000000000:'+ '00'.repeat(64)).split(':');
  const actual=await scrypt(password,salt,64);
  if(!user||!timingSafeEqual(actual,Buffer.from(hash,'hex')))fail('账号或密码不正确',401);
  return enter(req,user);
 });
 route('/me','get',async req=>({user:await profile(req)}));
 route('/logout','post',async req=>{await new Promise((resolve,reject)=>req.session.destroy(e=>e?reject(e):resolve()));return {ok:true};});
}};
