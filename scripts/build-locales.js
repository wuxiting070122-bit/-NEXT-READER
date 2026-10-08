// JSON files are the editable source; scripts avoid a network race during page startup.
const fs=require('node:fs');
for(const lang of ['en','zh-CN']){
 const data=JSON.parse(fs.readFileSync(`static/locales/${lang}.json`,'utf8'));
 fs.writeFileSync(`static/locales/${lang}.js`,`window.BookloopLocales=window.BookloopLocales||{};\nwindow.BookloopLocales[${JSON.stringify(lang)}]=${JSON.stringify(data)};\n`);
}
