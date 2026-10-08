'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {spawn}=require('node:child_process');const {mkdtemp,rm}=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
test('search, validation, notes persistence and original borrowing',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'bookloop-'));let child;
 const start=()=>new Promise((resolve,reject)=>{child=spawn(process.execPath,['app.js'],{env:{...process.env,LIBRARY_DB:path.join(dir,'test.db'),PORT:'0',BRAVE_SEARCH_API_KEY:''}});let output='';const timer=setTimeout(()=>reject(Error('startup timeout')),10000);child.stdout.on('data',chunk=>{output+=chunk;const m=output.match(/Listening on port (\d+)/);if(m){clearTimeout(timer);resolve('http://127.0.0.1:'+m[1]);}});child.on('exit',code=>{clearTimeout(timer);if(code)reject(Error('server exit '+code));});});
 const stop=()=>new Promise(resolve=>{child.once('exit',resolve);child.kill();});
 try {
 let base=await start(),cookie='';const login=async(mode='login')=>{const r=await fetch(base+'/api/account/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'legacy_admin',password:'legacy-test-password'})});cookie=r.headers.get('set-cookie').split(';')[0];};await login('register');require('node:child_process').execFileSync(process.execPath,['scripts/set-admin.js','legacy_admin'],{env:{...process.env,LIBRARY_DB:path.join(dir,'test.db')}});const post=(url,body)=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
 let books=await (await fetch(base+'/api/research/books',{headers:{Cookie:cookie}})).json();assert.equal(books.length,7);
 let r=await post('/api/research/search',{query:'书脊 修复',kind:'repair'});let data=await r.json();assert.equal(data.mode,'external');assert.match(data.links[0].url,/%/);assert.equal(data.results.length,0);
 assert.equal((await post('/api/research/search',{query:' ',kind:'repair'})).status,400);
 const note={book_id:'B001',kind:'repair',title:'修复资料',url:'https://example.com/reference',note:'需要核实'};
 assert.equal((await post('/api/research/notes',{...note,url:'javascript:alert(1)'})).status,400);
 assert.equal((await post('/api/research/notes',{...note,book_id:'missing'})).status,400);
 assert.equal((await post('/api/research/notes',note)).status,200);
 let borrow=await (await post('/borrow_func201',{r_readerid:'R2023002',b_bookid:'B004'})).text();assert.match(borrow,/借书成功/);
 await stop();base=await start();await login();
 data=await (await fetch(base+'/api/research/notes?book=B001',{headers:{Cookie:cookie}})).json();assert.equal(data.length,1);assert.equal(data[0].note,'需要核实');
 const unreturned=await (await post('/reader_func105',{r_readerid:'R2023002'})).text();assert.match(unreturned,/B004/);
 const returned=await (await post('/borrow_func202',{r_readerid:'R2023002',b_bookid:'B004'})).text();assert.match(returned,/还书成功/);
 await fetch(base+'/api/research/notes/'+data[0].id,{method:'DELETE',headers:{Cookie:cookie}});assert.equal((await (await fetch(base+'/api/research/notes?book=B001',{headers:{Cookie:cookie}})).json()).length,0);
 assert.equal((await fetch(base+'/')).url,base+'/research.html');
 }finally{if(child&&child.exitCode===null)await stop();await rm(dir,{recursive:true,force:true});}
});
