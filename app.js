'use strict';
const session = require('express-session');
const bodyParser = require('body-parser');
const srvstatic = require('serve-static');
const path = require("path");
//:init
const app = require('./WebApp')();
require("./coSqlite3")({ file: (process.env.LIBRARY_DB || 'lib.db') });//连接数据库，要求必须使用这个数据库名字

//:prepare middle ware
app.use(bodyParser.json({limit:'1mb'}));//request数据处理中间件(json化数据)
app.use(bodyParser.urlencoded({ extended: false, limit:'1mb' }));//request数据处理中间件(url解码)
//app.use(cookieParser());
app.use(session({ name: 'bbs', secret: process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex'), resave: false, saveUninitialized: false, cookie: { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 } }));//会话管理中间件

//根的重定向拦截器
app.use('/', function (req, res, next) {
	var url = req._path;
	res.writeHead(302, {
		'Location': '/research.html'//演示首页（课程自带检验页为 /__index.htm）
		//add other headers here...
	});
	res.end();
});

app.use(srvstatic(path.join(__dirname, '/static')));//静态文件服务中间件

// The legacy course/demo APIs are administrative, never reader endpoints.
app.use(async function(req,res,next){
 if(/^\/(?:init|seed|book_func\d+|reader_func\d+|borrow_func\d+)$/.test(req.path)||req.path.startsWith('/api/research/')){
  try{const accounts=require('./routes/accounts');await accounts.setup();await accounts.requireAdmin(req);
   if(req.method!=='GET'&&req.headers.origin&&process.env.PUBLIC_ORIGIN){const oh=(req.headers.origin.split('//')[1]||'').split('/')[0];const ah=(process.env.PUBLIC_ORIGIN.split('//')[1]||'').split('/')[0];if(oh!==ah)return res.status(403).json({error:'请求来源不匹配'});}
  }catch(e){return res.status(e.status||500).json({error:e.message});}
 }
 next();
});
//:router at here
app.use(function (req, res, next) {//no-chache head for router and pre check
	res.setHeader('Cache-control', 'no-cache');
	res.setHeader('Pragma', 'no-cache');
	res.setHeader('Content-Type', 'text/html;charset=utf-8');
	next();
});

//请在此处设定路由(可参考bbs例子中的 ./routes/index.js中的代码，路由函数的实现请参考bbs例子中的./routes/txt.js和user.js)
const lib = require('./routes/library');

app.route('/init', 'post', lib.Init);

app.route('/book_func001', 'post', lib.AddBook);
app.route('/book_func002', 'post', lib.AddBookCount);
app.route('/book_func003', 'post', lib.DeleteBook);
app.route('/book_func004', 'post', lib.UpdateBook);
app.route('/book_func005', 'post', lib.QueryBook);

app.route('/reader_func101', 'post', lib.AddReader);
app.route('/reader_func102', 'post', lib.DeleteReader);
app.route('/reader_func103', 'post', lib.UpdateReader);
app.route('/reader_func104', 'post', lib.QueryReader);
app.route('/reader_func105', 'post', lib.UnreturnedBook);

app.route('/borrow_func201', 'post', lib.BorrowBook);
app.route('/borrow_func202', 'post', lib.ReturnBook);
app.route('/borrow_func203', 'post', lib.OverdueReader);

//:下面是一段使用myModule.js注册'/hello'和'/x/hello'入口路由URL的例子,可以注释掉
const my = require('./myModule.js');
app.route('/hello', '*', my.Hello);
app.route('/x/hello', '*', my.Hello);
//-------- 例子结束了 ------------

//演示辅助（非作业代码，作品展示用）：重建数据表并写入示例数据
const seed = require('./routes/demoSeed');
app.route('/seed', 'post', seed.Seed);

require('./routes/research')(app);
require('./routes/accounts').install(app);
require('./routes/digital')(app);
app.use(app.router);//use router
//:handler error
app.use(function (err, req, res, next) {
	if (!next)
		return res();//404
	//:log
	if (String == err.constructor)
		err = { no: 500, msg: err };
	if (null == err.no || null == err.msg || res.finished || res._sent)
		return next(err);//未处理的异常或处理了却无法发送的异常
	res.send(err);
});

//:create server
let port = process.env.PORT || 3000;//默认 3000，避免占用 80 端口需管理员权限
var server = require('http').createServer(app.OnRequest);
server.on('error', onError);
server.on('listening', onListening);


// 应用启动后自动载入演示数据（作品展示用，非作业代码），老师打开即有内容可看
seed.autoSeed().then(() => server.listen(port, process.env.HOST || '127.0.0.1')).catch(err => { console.error('数据库初始化失败', err.message); process.exit(1); });

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
	if (error.syscall !== 'listen') {
		throw error;
	}
	// handle specific listen errors with friendly messages
	switch (error.code) {
		case 'EACCES':
			console.error('Port ' + port + ' requires elevated privileges');
			process.exit(1);
			break;
		case 'EADDRINUSE':
			console.error('Port ' + port + ' is already in use');
			process.exit(1);
			break;
		default:
			throw error;
	}
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
	var addr = server.address();
	var bind = typeof addr === 'string'
		? 'pipe ' + addr
		: 'port ' + addr.port;
	console.log('Listening on ' + bind);
}

/**
 * 捕获未知异常，防止Node进程在异常时退出
 */
process.on('uncaughtException', function (err) {
	console.log(err);
});