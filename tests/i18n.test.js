const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const en=require('../static/locales/en.json'),zh=require('../static/locales/zh-CN.json');
function runtime(saved){
 const document={documentElement:{dataset:{}},createTreeWalker:()=>({nextNode:()=>null}),querySelectorAll:()=>[]};
 const context=vm.createContext({window:{BookloopLocales:{en,'zh-CN':zh}},document,NodeFilter:{SHOW_TEXT:4},localStorage:{getItem:()=>saved},sessionStorage:{getItem:()=>null,removeItem:()=>{}},Date});
 vm.runInContext(fs.readFileSync('static/i18n.js','utf8')+';this.locale=I18n',context);return context.locale;
}
test('English is default; only an explicit Chinese preference enables Chinese',()=>{
 assert.equal(runtime(null).language,'en');assert.equal(runtime('fr').language,'en');assert.equal(runtime('zh-CN').language,'zh-CN');
 assert.equal(runtime(null).t('已被借走'),'Checked out');assert.equal(runtime('zh-CN').t('已被借走'),'已被借走');
});
test('language packs have matching keys and interpolation placeholders',()=>{
 assert.deepEqual(Object.keys(en).sort(),Object.keys(zh).sort());
 for(const key of Object.keys(en))assert.deepEqual((en[key].match(/\{\w+\}/g)||[]).sort(),(zh[key].match(/\{\w+\}/g)||[]).sort(),key);
 const locale=runtime();assert.equal(locale.t('当前图书：{title}',{title:'我的书 <test>'}),'Current book: 我的书 <test>');
});
test('seed metadata localizes without changing original passages or custom resources',()=>{
 const original={id:'pride',title:'傲慢与偏见',english:'Pride and Prejudice',description:'英文原作 · 开篇六段节选；完整文本可访问来源',paragraphs:['保存批注','User-authored 中文']};
 const custom={id:'custom',title:'保存批注',description:'自定义',paragraphs:['正文']};
 const rows=runtime().resources([original,custom]);assert.equal(rows[0].title,'Pride and Prejudice');assert.equal(rows[0].originalTitle,'傲慢与偏见');assert.equal(rows[0].paragraphs,original.paragraphs);assert.equal(original.title,'傲慢与偏见');assert.equal(rows[1],custom);
 assert.equal(runtime('zh-CN').resources([original])[0],original);
});
test('server errors and notification messages have English translations',()=>{
 const locale=runtime();assert.equal(locale.error('批注格式不正确'),'Invalid note.');
 for(const file of ['routes/digital.js','routes/digital-core.js','routes/community.js','routes/accounts.js']){
  const code=fs.readFileSync(file,'utf8');
  for(const match of code.matchAll(/(?:fail|Error)\('([^']*[\u4e00-\u9fff][^']*)'/g))assert.ok(Object.hasOwn(en,match[1]),`${file}: ${match[1]}`);
 }
 assert.equal(locale.t('你的段落讨论收到新回复。'),'Your passage discussion has a new reply.');
});
