'use strict';

const db = require('../coSqlite3');

function htmlResult(code, msg) {
  return `
<html>
<head>
<meta charset="utf-8">
</head>
<body>
<div id="result" style="display:none">${code}</div>
${msg || ''}
</body>
</html>`;
}

function tableResult(rows) {
  return `
<html>
<head>
<meta charset="utf-8">
</head>
<body>
<table border="1" id="result">
${rows}
</table>
</body>
</html>`;
}

function today() {
  return new Date().toISOString().substring(0, 10);
}

//初始化_init
exports.Init = function* (req, res) {
  try {
    yield db.execSQL([
      {
        sql: 'DROP TABLE IF EXISTS borrow',
        args: []
      },
      {
        sql: 'DROP TABLE IF EXISTS readers',
        args: []
      },
      {
        sql: 'DROP TABLE IF EXISTS books',
        args: []
      },
      {
        sql: `
                CREATE TABLE books(
                    b_bookid TEXT PRIMARY KEY,
                    b_bookname TEXT,
                    b_bookpub TEXT,
                    b_bookdate TEXT,
                    b_bookauthor TEXT,
                    b_bookmem TEXT,
                    b_totalcnt INTEGER,
                    b_remaincnt INTEGER
                )`,
        args: []
      },
      {
        sql: `
                CREATE TABLE readers(
                    r_readerid TEXT PRIMARY KEY,
                    r_readername TEXT,
                    r_readersex TEXT,
                    r_readerdept TEXT,
                    r_readergrade INTEGER
                )`,
        args: []
      },
      {
        sql: `
                CREATE TABLE borrow(
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    r_readerid TEXT,
                    b_bookid TEXT,
                    borrowDate TEXT,
                    returnDate TEXT
                )`,
        args: []
      }
    ], true);

    return htmlResult(0, '数据库初始化成功');
  }
  catch (e) {
    return htmlResult(1, e.toString());
  }
};


//加书_book_func001 
exports.AddBook = function* (req, res) {
  try {
    let b = req.body;

    if (!b.b_bookid || !b.b_bookname)
      return htmlResult(2, '输入格式错误');

    let cnt = parseInt(b.bCnt);

    if (isNaN(cnt) || cnt <= 0)
      return htmlResult(2, '输入格式错误');

    let rows = yield db.execSQL(
      'SELECT * FROM books WHERE b_bookid=?',
      [b.b_bookid]
    );

    if (rows.length > 0)
      return htmlResult(1, '抱歉，书号已存在');

    yield db.execSQL(
      `INSERT INTO books
            VALUES(?,?,?,?,?,?,?,?)`,
      [
        b.b_bookid,
        b.b_bookname,
        b.b_bookpub || '',
        b.b_bookdate || '',
        b.b_bookauthor || '',
        b.b_bookmem || '',
        cnt,
        cnt
      ]
    );

    return htmlResult(0, '图书已添加成功');
  }
  catch (e) {
    return htmlResult(6, e.toString());
  }
};

//查书_book_func005 
exports.QueryBook = function* (req, res) {
  try {
    let sql = 'SELECT * FROM books WHERE 1=1';
    let args = [];

    if (req.body.b_bookid) {
      sql += ' AND b_bookid LIKE ?';
      args.push('%' + req.body.b_bookid + '%');
    }

    if (req.body.b_bookname) {
      sql += ' AND b_bookname LIKE ?';
      args.push('%' + req.body.b_bookname + '%');
    }

    if (req.body.b_bookpub) {
      sql += ' AND b_bookpub LIKE ?';
      args.push('%' + req.body.b_bookpub + '%');
    }

    if (req.body.b_bookauthor) {
      sql += ' AND b_bookauthor LIKE ?';
      args.push('%' + req.body.b_bookauthor + '%');
    }

    if (req.body.b_bookmem) {
      sql += ' AND b_bookmem LIKE ?';
      args.push('%' + req.body.b_bookmem + '%');
    }

    let rows = yield db.execSQL(sql, args);

    let html = '';

    for (let r of rows) {
      html += `
<tr>
<td>${r.b_bookid}</td>
<td>${r.b_bookname}</td>
<td>${r.b_totalcnt}</td>
<td>${r.b_remaincnt}</td>
<td>${r.b_bookpub || ''}</td>
<td>${r.b_bookdate || ''}</td>
<td>${r.b_bookauthor || ''}</td>
<td>${r.b_bookmem || ''}</td>
</tr>`;
    }

    return tableResult(html);
  }
  catch (e) {
    return tableResult('');
  }
};

//加读者_reader_func101 
exports.AddReader = function* (req, res) {
  try {
    let r = req.body;

    if (!r.r_readerid || !r.r_readername || !r.r_readersex)
      return htmlResult(2, '抱歉，输入格式错误');

    let rows = yield db.execSQL(
      'SELECT * FROM readers WHERE r_readerid=?',
      [r.r_readerid]
    );

    if (rows.length > 0)
      return htmlResult(1, '抱歉，证号已存在');

    yield db.execSQL(
      `INSERT INTO readers
            VALUES(?,?,?,?,?)`,
      [
        r.r_readerid,
        r.r_readername,
        r.r_readersex,
        r.r_readerdept || '',
        r.r_readergrade || null
      ]
    );

    return htmlResult(0, '读者已添加成功');
  }
  catch (e) {
    return htmlResult(6, e.toString());
  }
};

//查读者_reader_func104 
exports.QueryReader = function* (req, res) {
  try {
    let sql = 'SELECT * FROM readers WHERE 1=1';
    let args = [];

    if (req.body.r_readerid) {
      sql += ' AND r_readerid LIKE ?';
      args.push('%' + req.body.r_readerid + '%');
    }

    if (req.body.r_readername) {
      sql += ' AND r_readername LIKE ?';
      args.push('%' + req.body.r_readername + '%');
    }

    if (req.body.r_readerdept) {
      sql += ' AND r_readerdept LIKE ?';
      args.push('%' + req.body.r_readerdept + '%');
    }

    let rows = yield db.execSQL(sql, args);

    let html = '';

    for (let r of rows) {
      html += `
<tr>
<td>${r.r_readerid}</td>
<td>${r.r_readername}</td>
<td>${r.r_readersex}</td>
<td>${r.r_readerdept || ''}</td>
<td>${r.r_readergrade || ''}</td>
</tr>`;
    }

    return tableResult(html);
  }
  catch (e) {
    return tableResult('');
  }
};

//加书数量_book_func002 
exports.AddBookCount = function* (req, res) {
  try {
    let b = req.body;
    // 参数校验
    if (!b.b_bookid || !b.bCnt) {
      return htmlResult(2, '抱歉输入的格式有误');
    }
    let addNum = parseInt(b.bCnt);
    if (isNaN(addNum) || addNum <= 0) {
      return htmlResult(2, '抱歉输入的格式有误');
    }
    // 校验书号是否存在
    let book = yield db.execSQL('SELECT * FROM books WHERE b_bookid=?', [b.b_bookid]);
    if (book.length === 0) {
      return htmlResult(1, '抱歉，该书号不存在');
    }
    // 更新总库存、剩余库存
    yield db.execSQL(
      'UPDATE books SET b_totalcnt = b_totalcnt + ?, b_remaincnt = b_remaincnt + ? WHERE b_bookid=?',
      [addNum, addNum, b.b_bookid]
    );
    return htmlResult(0, '图书已增加成功');
  } catch (e) {
    return htmlResult(6, e.toString());
  }
};

//删书_book_func003
exports.DeleteBook = function* (req, res) {
  try {
    let b = req.body;
    if (!b.b_bookid || !b.bCnt) {
      return htmlResult(2, '抱歉输入的格式有误');
    }
    let subNum = parseInt(b.bCnt);
    if (isNaN(subNum) || subNum <= 0) {
      return htmlResult(2, '抱歉输入的格式有误');
    }
    // 校验图书存在
    let book = yield db.execSQL('SELECT * FROM books WHERE b_bookid=?', [b.b_bookid]);
    if (book.length === 0) {
      return htmlResult(1, '抱歉，该书号不存在');
    }
    // 校验剩余库存，防止负数
    if (book[0].b_remaincnt < subNum) {
      return htmlResult(2, '抱歉输入的格式有误：图书库存不足');
    }
    // 扣减库存
    yield db.execSQL(
      'UPDATE books SET b_totalcnt = b_totalcnt - ?, b_remaincnt = b_remaincnt - ? WHERE b_bookid=?',
      [subNum, subNum, b.b_bookid]
    );
    return htmlResult(0, '图书已减少成功');
  } catch (e) {
    return htmlResult(6, e.toString());
  }
};

//更新书_book_func004
exports.UpdateBook = function* (req, res) {
  try {
    let b = req.body;
    // 基础参数校验
    if (!b.b_bookid || !b.b_bookname) {
      return htmlResult(2, '抱歉输入的格式有误');
    }
    // 校验图书存在
    let book = yield db.execSQL('SELECT * FROM books WHERE b_bookid=?', [b.b_bookid]);
    if (book.length === 0) {
      return htmlResult(1, '抱歉，该书号不存在');
    }
    // 修改图书所有信息字段
    yield db.execSQL(
      `UPDATE books 
       SET b_bookname=?, b_bookpub=?, b_bookdate=?, b_bookauthor=?, b_bookmem=? 
       WHERE b_bookid=?`,
      [b.b_bookname, b.b_bookpub || '', b.b_bookdate || '', b.b_bookauthor || '', b.b_bookmem || '', b.b_bookid]
    );
    return htmlResult(0, '修改成功');
  } catch (e) {
    return htmlResult(6, e.toString());
  }
};

//shanduzhe_reader_func102
exports.DeleteReader = function* (req, res) {
  try {
    let r = req.body;
    if (!r.r_readerid) {
      return htmlResult(2, '抱歉，输入的格式有误');
    }
    // 校验读者存在
    let reader = yield db.execSQL('SELECT * FROM readers WHERE r_readerid=?', [r.r_readerid]);
    if (reader.length === 0) {
      return htmlResult(1, '抱歉，该证号不存在');
    }
    // 有未还书禁止删除
    let borrow = yield db.execSQL(
      'SELECT * FROM borrow WHERE r_readerid=? AND returnDate IS NULL',
      [r.r_readerid]
    );
    if (borrow.length > 0) {
      return htmlResult(2, '抱歉输入的格式有误：该读者有图书未归还');
    }
    // 执行删除
    yield db.execSQL('DELETE FROM readers WHERE r_readerid=?', [r.r_readerid]);
    return htmlResult(0, '读者已删除成功');
  } catch (e) {
    return htmlResult(6, e.toString());
  }
};


//更新读者_reader_func103
exports.UpdateReader = function* (req, res) {
  try {
    let r = req.body;
    // 必填项校验
    if (!r.r_readerid || !r.r_readername || !r.r_readersex) {
      return htmlResult(2, '抱歉输入的格式有误');
    }
    // 校验读者存在
    let reader = yield db.execSQL('SELECT * FROM readers WHERE r_readerid=?', [r.r_readerid]);
    if (reader.length === 0) {
      return htmlResult(1, '抱歉，该证号不存在');
    }
    // 更新读者信息
    yield db.execSQL(
      `UPDATE readers 
       SET r_readername=?, r_readersex=?, r_readerdept=?, r_readergrade=? 
       WHERE r_readerid=?`,
      [r.r_readername, r.r_readersex, r.r_readerdept || '', r.r_readergrade || null, r.r_readerid]
    );
    return htmlResult(0, '修改成功');
  } catch (e) {
    return htmlResult(6, e.toString());
  }
};

//查未还书_reader_func105
exports.UnreturnedBook = function* (req, res) {
  try {
    let r = req.body;
    if (!r.r_readerid) {
      return htmlResult(2, '抱歉，输入的格式有误');
    }
    // 联表查询该读者未还图书
    let list = yield db.execSQL(`
      SELECT b.b_bookid, b.b_bookname, br.borrowDate 
      FROM borrow br
      LEFT JOIN books b ON br.b_bookid = b.b_bookid
      WHERE br.r_readerid=? AND br.returnDate IS NULL
    `, [r.r_readerid]);

    const now = today();
    let html = '';
    for (let item of list) {
      // 计算应还日期（借书日+60天）
      let borrowDate = item.borrowDate;
      let dueDateObj = new Date(borrowDate);
      dueDateObj.setDate(dueDateObj.getDate() + 60);
      let dueDate = dueDateObj.toISOString().substring(0, 10);
      // 计算天数差，判断超期
      let borrowTime = new Date(borrowDate).getTime();
      let nowTime = new Date(now).getTime();
      let dayDiff = Math.floor((nowTime - borrowTime) / (1000 * 60 * 60 * 24));
      let isOver = dayDiff > 60 ? '是' : '否';

      html += `
<tr>
<td>${item.b_bookid}</td>
<td>${item.b_bookname}</td>
<td>${borrowDate}</td>
<td>${dueDate}</td>
<td>${isOver}</td>
</tr>`;
    }
    return tableResult(html);
  } catch (e) {
    return tableResult('');
  }
};

//借书_borrow_func201
exports.BorrowBook = function* (req, res) {
  try {
    let b = req.body;
    if (!b.r_readerid || !b.b_bookid) {
      return htmlResult(2, '抱歉，输入的格式有误');
    }
    const now = today();

    // 1. 校验读者
    let reader = yield db.execSQL('SELECT * FROM readers WHERE r_readerid=?', [b.r_readerid]);
    if (reader.length === 0) {
      return htmlResult(1, '抱歉，该证号不存在');
    }
    // 2. 校验图书
    let book = yield db.execSQL('SELECT * FROM books WHERE b_bookid=?', [b.b_bookid]);
    if (book.length === 0) {
      return htmlResult(2, '抱歉，该书号不存在');
    }
    // 3. 检查该读者是否有超期未还图书
    let allBorrow = yield db.execSQL(
      'SELECT borrowDate FROM borrow WHERE r_readerid=? AND returnDate IS NULL',
      [b.r_readerid]
    );
    for (let item of allBorrow) {
      let bt = new Date(item.borrowDate).getTime();
      let nt = new Date(now).getTime();
      let diff = Math.floor((nt - bt) / (1000 * 60 * 60 * 24));
      if (diff > 60) {
        return htmlResult(3, '该读者有超期书未还');
      }
    }
    // 4. 检查是否已借阅该书（未还）
    let repeat = yield db.execSQL(
      'SELECT * FROM borrow WHERE r_readerid=? AND b_bookid=? AND returnDate IS NULL',
      [b.r_readerid, b.b_bookid]
    );
    if (repeat.length > 0) {
      return htmlResult(4, '该读者已经借阅此书');
    }
    // 5. 检查库存
    if (book[0].b_remaincnt <= 0) {
      return htmlResult(5, '该图书已经全部借出');
    }
    // 6. 执行借书：新增借阅记录 + 库存-1
    yield db.execSQL(
      'INSERT INTO borrow(r_readerid, b_bookid, borrowDate) VALUES(?,?,?)',
      [b.r_readerid, b.b_bookid, now]
    );
    yield db.execSQL(
      'UPDATE books SET b_remaincnt = b_remaincnt - 1 WHERE b_bookid=?',
      [b.b_bookid]
    );
    return htmlResult(0, '借书成功');
  } catch (e) {
    return htmlResult(6, e.toString());
  }
};


// 还书_borrow_func202
exports.ReturnBook = function* (req, res) {
  try {
    let b = req.body;
    if (!b.r_readerid || !b.b_bookid) {
      return htmlResult(2, '输入的格式有误');
    }
    const now = today();

    // 1. 校验读者
    let reader = yield db.execSQL('SELECT * FROM readers WHERE r_readerid=?', [b.r_readerid]);
    if (reader.length === 0) {
      return htmlResult(1, '抱歉，该证号不存在');
    }
    // 2. 校验图书
    let book = yield db.execSQL('SELECT * FROM books WHERE b_bookid=?', [b.b_bookid]);
    if (book.length === 0) {
      return htmlResult(2, '抱歉，该书号不存在');
    }
    // 3. 校验是否在借状态
    let borrow = yield db.execSQL(
      'SELECT * FROM borrow WHERE r_readerid=? AND b_bookid=? AND returnDate IS NULL',
      [b.r_readerid, b.b_bookid]
    );
    if (borrow.length === 0) {
      return htmlResult(3, '检测到并未借阅此书，请检查输入信息');
    }
    // 4. 更新还书日期 + 库存+1
    yield db.execSQL(
      'UPDATE borrow SET returnDate=? WHERE r_readerid=? AND b_bookid=? AND returnDate IS NULL',
      [now, b.r_readerid, b.b_bookid]
    );
    yield db.execSQL(
      'UPDATE books SET b_remaincnt = b_remaincnt + 1 WHERE b_bookid=?',
      [b.b_bookid]
    );
    return htmlResult(0, '还书成功');
  } catch (e) {
    return htmlResult(6, e.toString());
  }
};

//超期_ borrow_func203 
exports.OverdueReader = function* (req, res) {
  try {
    const now = today();
    // 联表查询所有未还书的读者
    let list = yield db.execSQL(`
      SELECT DISTINCT r.r_readerid, r.r_readername, r.r_readersex, r.r_readerdept, r.r_readergrade, br.borrowDate
      FROM readers r
      JOIN borrow br ON r.r_readerid = br.r_readerid
      WHERE br.returnDate IS NULL
    `, []);

    let html = '';
    let existr_readerid = []; // 去重，同一读者只显示一次
    for (let item of list) {
      let bt = new Date(item.borrowDate).getTime();
      let nt = new Date(now).getTime();
      let diff = Math.floor((nt - bt) / (1000 * 60 * 60 * 24));
      // 仅保留超期读者
      if (diff > 60 && !existr_readerid.includes(item.r_readerid)) {
        existr_readerid.push(item.r_readerid);
        html += `
<tr>
<td>${item.r_readerid}</td>
<td>${item.r_readername}</td>
<td>${item.r_readersex}</td>
<td>${item.r_readerdept || ''}</td>
<td>${item.r_readergrade || ''}</td>
</tr>`;
      }
    }
    return tableResult(html);
  } catch (e) {
    return tableResult('');
  }
};