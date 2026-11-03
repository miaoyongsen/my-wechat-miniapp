// 微信云函数：复用旧版个人资产系统的数据源。
// 部署前在微信开发者工具中开通云开发，并部署此函数。
// 不写入资产数据；请求失败返回错误，不使用虚构汇率。
const https = require('https');
const cache = new Map();
function get(url, ttl) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.time < ttl) return Promise.resolve(hit.body);
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Referer: 'https://finance.sina.com.cn', 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = new TextDecoder('gbk').decode(Buffer.concat(chunks));
        cache.set(url, { body, time: Date.now() });
        resolve(body);
      });
    });
    req.on('timeout', () => req.destroy(new Error('请求超时')));
    req.on('error', reject);
  });
}
const symbolCode = s => {
  if (/^\d{6}\.SH$/i.test(s)) return 'sh' + s.slice(0,6);
  if (/^\d{6}\.SZ$/i.test(s)) return 'sz' + s.slice(0,6);
  if (/^\d{1,5}\.HK$/i.test(s)) return 'hk' + s.split('.')[0].padStart(5,'0');
  if (/^[A-Z.\-]+\.US$/i.test(s)) return 'us' + s.slice(0,-3);
  return null;
};
const number = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
async function fx() {
  const text = await get('https://www.chinamoney.com.cn/r/cms/www/chinamoney/data/fx/rfx-sp-quot.json', 300000);
  const rows = JSON.parse(text).records || [];
  const rates = { CNY: 1 };
  for (const row of rows) {
    if (['USD/CNY','HKD/CNY'].includes(row.ccyPair)) {
      const bid = number(row.bidPrc), ask = number(row.askPrc);
      if (bid && ask) rates[row.ccyPair.slice(0,3)] = (bid + ask) / 2;
    }
  }
  return rates;
}
async function quotes(symbols) {
  const results = {}, errors = {};
  const stocks = symbols.filter(s => symbolCode(s));
  if (stocks.length) {
    const body = await get('https://qt.gtimg.cn/q=' + stocks.map(symbolCode).join(','), 60000);
    for (const s of stocks) {
      const code = symbolCode(s);
      const match = body.match(new RegExp('v_' + code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '="([^"]*)"','i'));
      if (!match) { errors[s] = '行情不存在'; continue; }
      const f = match[1].split('~'), price = number(f[3]);
      if (!price) { errors[s] = '价格无效或停牌'; continue; }
      results[s] = { name:f[1], price, currency:s.endsWith('.HK')?'HKD':s.endsWith('.US')?'USD':'CNY', source:'Tencent', updatedAt:new Date().toISOString() };
    }
  }
  for (const s of symbols.filter(s => /^[A-Z0-9]+\.CRYPTO$/i.test(s))) {
    try {
      const coin = s.split('.')[0].toUpperCase();
      const body = await get('https://hq.sinajs.cn/list=hf_' + coin, 60000);
      const match = body.match(/="([^"]*)"/);
      const f = match ? match[1].split(',') : [];
      const price = number(f[2]);
      if (!price) { errors[s] = '数字资产行情不可用'; continue; }
      results[s] = { name:coin, price, currency:'USD', source:'Sina', updatedAt:new Date().toISOString() };
    } catch (e) { errors[s] = e.message; }
  }
  for (const s of symbols) if (!results[s] && !errors[s]) errors[s] = '代码格式不支持';
  return { quotes:results, errors };
}
exports.main = async event => {
  try {
    if (event.action === 'fx') return { ok:true, rates:await fx(), updatedAt:new Date().toISOString() };
    if (event.action === 'quotes') {
      const symbols = [...new Set((event.symbols || []).map(x=>String(x).trim().toUpperCase()))].slice(0,50);
      if (!symbols.length) return {ok:false,error:'缺少代码'};
      return {ok:true,...await quotes(symbols)};
    }
    return {ok:false,error:'不支持的操作'};
  } catch(e) { return {ok:false,error:e.message}; }
};
