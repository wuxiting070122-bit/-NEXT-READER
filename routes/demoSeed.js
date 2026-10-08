/**
 * 演示数据初始化（routes/demoSeed.js）
 * ------------------------------------------------------------------
 * 说明：这是为作品展示额外添加的辅助模块，**不属于作业代码**。
 * 作用：重建数据表并写入示例图书 / 读者 / 借阅记录，
 *      方便演示时直接看到结果，也可在误点「初始化」后恢复数据。
 * 学生作业的核心逻辑全部在 routes/library.js，本文件不含任何业务逻辑。
 *
 * 提供两个入口：
 *   exports.autoSeed() —— 应用启动时自动调用（基于 Promise，无需 co 驱动）
 *   exports.Seed       —— 路由 /seed 使用（生成器 + co 驱动，保留原框架风格）
 */
'use strict';

const db = require('../coSqlite3');

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().substring(0, 10);
}

function htmlResult(code, msg) {
  return `<html><head><meta charset="utf-8"></head><body>
<div id="result" style="display:none">${code}</div>${msg || ''}</body></html>`;
}

const DDL = [
  'DROP TABLE IF EXISTS borrow',
  'DROP TABLE IF EXISTS readers',
  'DROP TABLE IF EXISTS books',
  `CREATE TABLE books(
      b_bookid TEXT PRIMARY KEY,
      b_bookname TEXT,
      b_bookpub TEXT,
      b_bookdate TEXT,
      b_bookauthor TEXT,
      b_bookmem TEXT,
      b_totalcnt INTEGER,
      b_remaincnt INTEGER
  )`,
  `CREATE TABLE readers(
      r_readerid TEXT PRIMARY KEY,
      r_readername TEXT,
      r_readersex TEXT,
      r_readerdept TEXT,
      r_readergrade INTEGER
  )`,
  `CREATE TABLE borrow(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      r_readerid TEXT,
      b_bookid TEXT,
      borrowDate TEXT,
      returnDate TEXT
  )`
];

// [书号, 书名, 出版社, 出版日期, 作者, 备注, 总藏量, 可借余量]
const BOOKS = [
  ['B001', '数据库系统概念', '机械工业出版社', '2018-05-01', 'Abraham Silberschatz', '教材', 5, 4],
  ['B002', '计算机网络', '电子工业出版社', '2021-03-01', '谢希仁', '教材', 4, 3],
  ['B003', '百年孤独', '南海出版公司', '2011-06-01', '加西亚·马尔克斯', '文学', 3, 2],
  ['B004', '活着', '作家出版社', '2012-08-01', '余华', '文学', 2, 2],
  ['B005', 'JavaScript高级程序设计', '人民邮电出版社', '2020-09-01', 'Matt Frisbie', '技术', 3, 3],
  ['B006', '人类简史', '中信出版社', '2014-11-01', '尤瓦尔·赫拉利', '历史', 2, 1],
  ['B007', '设计模式', '机械工业出版社', '2019-01-01', 'Erich Gamma', '技术', 3, 3]
];

// [借书证号, 姓名, 性别, 单位, 年级]
const READERS = [
  ['R2023001', '张明', '男', '计算机学院', 2023],
  ['R2023002', '李静', '女', '外国语学院', 2023],
  ['R2023003', '王磊', '男', '物理学院', 2022],
  ['R2023004', '赵雪', '女', '艺术学院', 2024]
];

// [借书证号, 书号, 借阅日期, 归还日期(null 表示未还)]
const BORROWS = [
  ['R2023001', 'B002', daysAgo(75), null], // 已超期（借阅超 60 天）
  ['R2023001', 'B003', daysAgo(10), null],
  ['R2023003', 'B001', daysAgo(92), null], // 已超期
  ['R2023002', 'B005', daysAgo(30), daysAgo(5)],
  ['R2023004', 'B006', daysAgo(20), null]
];

// 核心逻辑：基于 SingleSQL（返回 Promise）顺序执行，不依赖 co / 生成器驱动
async function runSeed() {
  await db.SingleSQL({ sql: 'PRAGMA foreign_keys=ON;' }, true);
  for (const sql of DDL) {
    await db.SingleSQL({ sql }, true);
  }
  for (const b of BOOKS) {
    await db.SingleSQL({ sql: 'INSERT INTO books VALUES(?,?,?,?,?,?,?,?)', args: b }, true);
  }
  for (const r of READERS) {
    await db.SingleSQL({ sql: 'INSERT INTO readers VALUES(?,?,?,?,?)', args: r }, true);
  }
  for (const br of BORROWS) {
    await db.SingleSQL(
      { sql: 'INSERT INTO borrow(r_readerid,b_bookid,borrowDate,returnDate) VALUES(?,?,?,?)', args: br },
      true
    );
  }
}

// 供应用启动时自动调用（无 HTTP 请求、无需 co 驱动）
exports.autoSeed = async function () {
  const tables = await db.SingleSQL("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('books','readers','borrow')");
  if (tables.length === 0) await runSeed();
  else if (tables.length !== 3) throw new Error('数据库结构不完整，请备份后修复');
};

// 供路由 /seed（生成器 + co 驱动，保留课程框架风格）
exports.Seed = function* (req, res) {
  try {
    yield db.execSQL('PRAGMA foreign_keys=ON;');
    for (const sql of DDL) {
      yield db.execSQL(sql, true);
    }
    for (const b of BOOKS) {
      yield db.execSQL('INSERT INTO books VALUES(?,?,?,?,?,?,?,?)', b);
    }
    for (const r of READERS) {
      yield db.execSQL('INSERT INTO readers VALUES(?,?,?,?,?)', r);
    }
    for (const br of BORROWS) {
      yield db.execSQL(
        'INSERT INTO borrow(r_readerid,b_bookid,borrowDate,returnDate) VALUES(?,?,?,?)',
        br
      );
    }
    return htmlResult(0, '演示数据已重置：7 本图书、4 位读者、5 条借阅记录（含 2 条超期）');
  } catch (e) {
    return htmlResult(6, e.toString());
  }
};
