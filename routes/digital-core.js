'use strict';
const db=require('../coSqlite3');
const sql=(sql,args=[])=>db.SingleSQL({sql,args});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
function safeURL(value){try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error();return u.href;}catch{fail('请输入有效的 http/https 来源链接');}}
function text(value,name,max,required=true){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))fail(name+'格式不正确');return value.trim();}
function anchor(resource,b){const p=resource.paragraphs[b.paragraph];if(!Number.isInteger(b.paragraph)||typeof p!=='string'||!Number.isInteger(b.start)||!Number.isInteger(b.end)||b.start<0||b.end<=b.start||b.end>p.length||b.version!==resource.version||p.slice(b.start,b.end)!==b.quote||!b.quote.trim())fail('选区与原文版本不一致，请重新选择');}
async function resource(id,includeArchived=false){const [row]=await sql('SELECT data FROM digital_resources WHERE id=?',[id]);if(!row)fail('资源不存在',404);const r=JSON.parse(row.data);if(r.archived&&!includeArchived)fail('资源已下架，暂不支持新的阅读互动',410);return r;}
async function notify(user,kind,text,target){if(user)await sql('INSERT INTO digital_notifications(user_id,kind,message,target) VALUES(?,?,?,?)',[user,kind,text,target]);}
module.exports={sql,fail,safeURL,text,anchor,resource,notify};
