'use strict';
const db = require('../coSqlite3');
const sql = (query, args = []) => db.SingleSQL({ sql: query, args });
const kinds = { book: '图书资料', repair: '修复方法', circulation: '流转渠道' };
function safeUrl(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
module.exports = function (app) {
  let ready;
  function init() {
    return ready ||= sql(`CREATE TABLE IF NOT EXISTS research_notes (
      id INTEGER PRIMARY KEY, book_id TEXT NOT NULL, kind TEXT NOT NULL,
      title TEXT NOT NULL, url TEXT NOT NULL, note TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  }
  const route = (path, method, handler) => app.route(path, method, async (req, res) => {
    res.type('json');
    try { await init(); return await handler(req, res); }
    catch (e) { res.status(e.status || 500); return { error: e.status ? e.message : '操作失败，请稍后重试' }; }
  });
  const invalid = msg => { const e = new Error(msg); e.status = 400; throw e; };
  route('/api/research/books', 'get', () => sql('SELECT b_bookid AS id,b_bookname AS title,b_bookauthor AS author,b_bookpub AS publisher FROM books ORDER BY b_bookid'));
  route('/api/research/search', 'post', async req => {
    const { query, kind } = req.body;
    if (typeof query !== 'string' || !query.trim() || query.length > 300 || !kinds[kind]) invalid('请输入 1—300 字的关键词并选择搜索方面');
    const q = query.trim();
    const links = [
      { title: '在百度搜索', url: 'https://www.baidu.com/s?wd=' + encodeURIComponent(q) },
      { title: '在必应搜索', url: 'https://www.bing.com/search?q=' + encodeURIComponent(q) }
    ];
    if (!process.env.BRAVE_SEARCH_API_KEY) return { mode: 'external', links, results: [], message: '可使用下方入口打开搜索。站内结果尚未启用。' };
    try {
      const url = new URL('https://api.search.brave.com/res/v1/web/search');
      url.searchParams.set('q', q); url.searchParams.set('count', '6');
      const response = await fetch(url, { headers: { 'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('upstream');
      const data = await response.json();
      const results = (data.web?.results || []).filter(r => safeUrl(r.url)).map(r => ({ title: String(r.title || ''), url: safeUrl(r.url), description: String(r.description || ''), published: r.page_age || null }));
      return { mode: 'live', results, links, searchedAt: new Date().toISOString() };
    } catch { return { mode: 'unavailable', results: [], links, message: '站内搜索暂时不可用，可以使用外部搜索入口。' }; }
  });
  route('/api/research/notes', 'get', req => sql('SELECT * FROM research_notes WHERE book_id=? ORDER BY id DESC', [String(req.query.book || '')]));
  route('/api/research/notes', 'post', async req => {
    const b = req.body;
    if (!kinds[b.kind] || typeof b.book_id !== 'string' || typeof b.title !== 'string' || !b.title.trim() || b.title.length > 200 || typeof b.url !== 'string' || b.url.length > 2000 || !safeUrl(b.url) || typeof b.note !== 'string' || b.note.length > 2000) invalid('请选择图书、填写标题和有效的 http/https 来源链接；笔记最多 2000 字');
    const books = await sql('SELECT b_bookid FROM books WHERE b_bookid=?', [b.book_id]);
    if (!books.length) invalid('关联图书不存在，请刷新馆藏');
    await sql('INSERT INTO research_notes(book_id,kind,title,url,note) VALUES(?,?,?,?,?)', [b.book_id,b.kind,b.title.trim(),safeUrl(b.url),b.note]);
    return { ok: true };
  });
  route('/api/research/notes/:id', 'delete', async req => {
    if (!/^\d+$/.test(req.params.id)) invalid('无效记录');
    await sql('DELETE FROM research_notes WHERE id=?', [req.params.id]); return { ok: true };
  });
};
