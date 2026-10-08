/**
 * sqlite3 兼容层（sqlite3-compat.js）
 * ------------------------------------------------------------------
 * 作用：用纯 WASM 版 SQLite 提供与原 sqlite3 模块一致的
 *       Database / all / exec 异步接口。
 * 原因：原生 sqlite3 模块在部署沙箱中无预编译包、且无法联网编译，
 *       换成 WASM 版后零编译、跨平台可运行。
 * 影响：课程框架 coSqlite3.js 仅需把 require('sqlite3') 指向本文件，
 *       其余代码（含全部作业逻辑）无需任何改动。
 */
'use strict';

const wasm = require('node-sqlite3-wasm');

class Database {
  constructor(file, mode, cb) {
    if (typeof mode === 'function') {
      cb = mode;
      mode = undefined;
    }
    try {
      this._db = new wasm.Database(file || ':memory:');
      // 使用内存日志：避免在受限环境中创建 -journal 临时文件导致写入失败。
      // 代价是断电/崩溃时无法回滚未完成事务（演示场景可接受）。
      if (file && file !== ':memory:') {
        try { this._db.exec('PRAGMA journal_mode=MEMORY;'); } catch (e) { /* 忽略 */ }
      }
      if (cb) process.nextTick(() => cb(null));
    } catch (e) {
      if (cb) process.nextTick(() => cb(e));
      else throw e;
    }
  }

  /** 执行 SQL（查询类返回结果行，写入类返回空数组），与原 sqlite3 行为一致 */
  all(sql, args, cb) {
    if (typeof args === 'function') {
      cb = args;
      args = [];
    }
    try {
      const rows = this._db.all(sql, args || []);
      cb(null, rows);
    } catch (e) {
      cb(e);
    }
  }

  /** 执行多条 SQL */
  exec(sql, cb) {
    try {
      this._db.exec(sql);
      if (cb) cb(null);
    } catch (e) {
      if (cb) cb(e);
      else throw e;
    }
  }

  close(cb) {
    try {
      this._db.close();
      if (cb) cb(null);
    } catch (e) {
      if (cb) cb(e);
    }
  }
}

module.exports = {
  Database,
  OPEN_READONLY: 1,
  OPEN_READWRITE: 2,
  OPEN_CREATE: 4
};
