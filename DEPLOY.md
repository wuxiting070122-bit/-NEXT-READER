# BOOKLOOP 网站部署说明

这是完整的 Node.js + SQLite 网站，包括英文默认界面、中文语言包、动效、账号、借阅、批注及讨论。需要 Node.js 22 或 24；不能作为纯静态网页直接上传到 GitHub Pages 或仅支持 HTML 的空间。

## 本地预览

解压后，在包含 package.json 的目录运行：

```sh
npm ci --omit=dev
npm start
```

访问 http://localhost:3000/research.html 。数据库首次启动时自动创建，包含示例馆藏，不含原作者的实际账号、借阅及批注。

## 上传到支持 Node.js 的服务器

上传解压后的全部文件。构建命令：`npm ci --omit=dev`；启动命令：`npm start`。

在部署平台的环境变量设置中配置（不要把密钥填写进前端文件）：

- `HOST=0.0.0.0`：允许平台通过容器网络访问。
- `PORT=3000`：通常由平台自动提供，使用平台提供的值即可。
- `PUBLIC_ORIGIN=https://你的域名`：填写浏览器实际访问的完整来源，不带路径或末尾斜杠。使用 HTTPS 反向代理时必须正确配置，否则提交表单会被拒绝。
- `SESSION_SECRET`：自行生成并保存一段随机密钥，例如运行 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`。
- `LIBRARY_DB=/挂载的持久目录/bookloop.db`：指向持久化磁盘上的文件，父目录必须存在且可写。未设置时数据库为应用目录下的 lib.db。

通过平台启用 HTTPS，将域名转发到应用端口。此版本使用 SQLite 和内存会话，适合单实例作品集演示；不要启用多实例或自动横向扩容。服务重启后需要重新登录，但持久磁盘中的账号、借阅和批注会保留。无持久磁盘的平台在重新部署后可能丢失数据库。

## 管理员

先在网站注册自己的账号，然后在同一服务器、同一 LIBRARY_DB 环境变量下运行：

```sh
node scripts/set-admin.js 你的账号
```

重新登录后可管理资源和处理举报。压缩包没有内置管理员密码。

## 包内文件

- static/：界面、图片、字体样式、语言包及前端脚本。
- routes/、app.js 等：服务端和数据库逻辑。
- data/：公开示例馆藏及阅读练习。
- tests/：自动化验证；运行 `node --test tests/*.test.js`。
- docs/：设计与使用说明。

node_modules、真实数据库、数据库备份、浏览器截图、测试账号与私人文档不包含在包中。安装依赖需要联网。公开文章与原作保留来源说明。
