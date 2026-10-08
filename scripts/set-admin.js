'use strict';
// Local operator only: no public role-escalation endpoint and no first-user admin.
const {Database}=require('node-sqlite3-wasm');
const username=process.argv[2]?.toLowerCase();
if(!username){console.error('用法：node scripts/set-admin.js 已注册账号');process.exit(1);}
const db=new Database(process.env.LIBRARY_DB||'lib.db');
try{const row=db.all('SELECT id FROM digital_users WHERE username=?',[username])[0];if(!row)throw Error('请先在网站注册该账号');db.run("UPDATE digital_users SET role='admin' WHERE id=?",[row.id]);console.log('已将指定账号设为管理员；重新打开账号菜单即可生效。');}catch(e){console.error(e.message);process.exitCode=1;}finally{db.close();}
