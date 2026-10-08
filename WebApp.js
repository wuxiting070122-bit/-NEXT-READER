/**
 * 课程框架兼容实现（WebApp.js）
 * ------------------------------------------------------------------
 * 说明：课程提供的原始 WebApp.js 在下载包中为空文件（0 字节），
 * 本文件依据 bbs.js / demo/04_webApp.js 中的调用方式还原其接口，
 * 使作业代码无需任何改动即可运行。仅补充框架，未改动任何作业逻辑。
 *
 * 对外接口：
 *   const app = require('./WebApp')();
 *   app.use([path,] fn)            挂载中间件（path 为 '/' 时精确匹配根路径）
 *   app.route(url, method, fn)     注册路由，fn 支持 generator（function*）
 *   app.router                     路由中间件（占位，路由已直接注册）
 *   app.OnRequest                  http.createServer 的请求处理函数
 *   req._path                      当前请求路径
 *   res.send(x)                    发送字符串 / 对象 / HTML
 */
'use strict';

const express = require('express');

/** 极简 co：把 generator 中 yield 的 Promise / generator 串联执行 */
function toPromise(obj) {
  if (!obj) return Promise.resolve(obj);
  if (typeof obj.then === 'function') return obj;
  if (typeof obj.next === 'function') return co(obj);          // generator 对象
  if (typeof obj === 'function') {                             // thunk
    return new Promise((resolve, reject) => {
      obj((err, ...rest) => (err ? reject(err) : resolve(rest.length > 1 ? rest : rest[0])));
    });
  }
  return Promise.resolve(obj);
}

function co(gen) {
  return new Promise((resolve, reject) => {
    if (typeof gen === 'function') gen = gen.call(null);
    if (!gen || typeof gen.next !== 'function') return resolve(gen);

    const next = (ret) => {
      if (ret.done) return resolve(ret.value);
      toPromise(ret.value).then(onFulfilled, onRejected);
    };
    const onFulfilled = (res) => {
      let ret;
      try { ret = gen.next(res); } catch (e) { return reject(e); }
      next(ret);
    };
    const onRejected = (err) => {
      let ret;
      try { ret = gen.throw(err); } catch (e) { return reject(e); }
      next(ret);
    };
    onFulfilled(undefined);
  });
}

function isGeneratorFunction(fn) {
  return !!fn && !!fn.constructor && /GeneratorFunction/.test(fn.constructor.name);
}

function WebApp() {
  const app = express();
  const api = {};

  // 框架约定：请求进入时补齐 req._path / res._sent
  app.use(function (req, res, next) {
    req._path = req.path;
    if (undefined === res._sent) res._sent = false;
    next();
  });

  api.use = function (path, fn) {
    if (typeof path === 'function') {
      app.use(path);
      return api;
    }
    if (path === '/') {
      // 课程框架语义：根挂载为精确匹配，否则会拦截全部请求（含静态资源与接口）
      app.use(function (req, res, next) {
        if (req.path !== '/') return next();
        return fn(req, res, next);
      });
      return api;
    }
    app.use(path, fn);
    return api;
  };

  api.route = function (url, method, fn) {
    const handler = function (req, res, next) {
      const done = (value) => {
        if (res.headersSent || value === undefined || value === null) return;
        res.send(value);
      };
      if (isGeneratorFunction(fn)) {
        co(fn.bind(null, req, res)).then(done).catch(next);
      } else {
        Promise.resolve(fn(req, res, next)).then(done).catch(next);
      }
    };
    let m = String(method || 'all').toLowerCase();
    if (m === '*') m = 'all';
    if (typeof app[m] === 'function') app[m](url, handler);
    else app.all(url, handler);
    return api;
  };

  api.router = function (req, res, next) { next(); };
  api.OnRequest = app;

  return api;
}

module.exports = function () {
  return WebApp();
};
