const KEY='family_assets_v1', OLD='asset_demo_v1';
const TYPES=['A股','港股','美股','ETF','实物黄金','积存金','黄金ETF','银行活期','银行定期','外币','加密货币','现金'];
const CURRENCIES=['CNY','USD','HKD','JPY','EUR'];
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const num=v=>Number(v)||0;
const fmt=v=>num(v).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
const validDate=v=>{if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v))return false;const d=new Date(v+'T12:00:00');return !Number.isNaN(d.getTime())&&d.getFullYear()===Number(v.slice(0,4))&&d.getMonth()+1===Number(v.slice(5,7))&&d.getDate()===Number(v.slice(8,10))};
const id=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
function initial(){return {assets:[],accounts:['默认账户'],rates:{CNY:1,USD:0,HKD:0,JPY:0,EUR:0},baseline:null,snapshots:[],transactions:[]}}
Page({
 data:{tab:'home',types:TYPES,currencies:CURRENCIES,assets:[],accounts:[],total:'0.00',yearProfit:'--',yearRate:'--',hidden:false,filter:'类型',groups:[],formOpen:false,form:{type:'A股',currency:'CNY',account:'默认账户',name:'',code:'',quantity:'',cost:'',price:'',balance:'',rate:'',start:'',maturity:'',note:''},editing:'',search:'',newAccount:'',rateCurrency:'USD',rateValue:'',baseValue:'',snapshotDate:'',snapshots:[],rates:[],viewTotal:'',viewYear:'',notice:'',sort:'收益率',undo:null,marketBusy:false,marketStatus:'本地存储模式：股票行情可尝试直连，汇率和数字资产价格暂需手动维护',marketUpdatedAt:'',autoMarket:false,txTypes:['买入','卖出','现金分红','送股','拆分'],txOpen:false,txAsset:'',txType:'买入',txQuantity:'',txPrice:'',txCash:'',txDate:today(),txNote:'',txList:[],importText:'',flowTypes:['存入','取出'],flowType:'存入',flowAmount:'',flowDate:today(),flowNote:'',flowList:[],yearFlows:'0.00',dividendTotal:'0.00',unpricedCount:0,assetFilter:'全部',filterTypes:['全部'].concat(TYPES),accountFilter:'全部',search:'',snapshotCount:0,assetCount:0,},
 onLoad(){let db=wx.getStorageSync(KEY);if(!db||!Array.isArray(db.assets)){db=initial();const old=wx.getStorageSync(OLD)||[];db.assets=old.map(a=>({id:id(),type:'现金',name:a.name,account:'默认账户',currency:'CNY',balance:num(a.amount)}));wx.setStorageSync(KEY,db)}db.transactions=db.transactions||[];db.flows=db.flows||[];db.snapshots=db.snapshots||[];db.accounts=db.accounts&&db.accounts.length?db.accounts:['默认账户'];db.rates=db.rates||{CNY:1};db.rates.CNY=1;this.db=db;this.setData({autoMarket:!!db.autoMarket,marketUpdatedAt:db.lastMarketUpdate||''});this.refresh()},
 onShow(){if(this.db){this.refresh();if(this.db.autoMarket)this.refreshMarket()}},
 save(){wx.setStorageSync(KEY,this.db);this.refresh()},
 refresh(){const db=this.db;const value=a=>{const raw=this.isHolding(a)?num(a.quantity)*num(a.price):num(a.balance);return raw*(a.currency==='CNY'?1:(num(db.rates[a.currency])||0))};
 const selected=db.assets;const total=selected.reduce((s,a)=>s+value(a),0);const year=new Date().getFullYear();const baseline=db.baseline&&db.baseline.year===year?db.baseline:null;
 const flows=(db.flows||[]).filter(f=>f.date>=year+'-01-01'&&f.date<=(year+'-12-31')).reduce((n,f)=>n+(f.type==='存入'?num(f.amount):-num(f.amount)),0);const profit=baseline?total-num(baseline.amount)-num(baseline.external)-flows:null;
 const search=this.data.search.trim().toLowerCase();let assets=selected.filter(a=>(this.data.assetFilter==='全部'||a.type===this.data.assetFilter)&&(this.data.accountFilter==='全部'||a.account===this.data.accountFilter)).filter(a=>!search||(a.name||'').toLowerCase().includes(search)||(a.code||'').toLowerCase().includes(search)||(a.account||'').toLowerCase().includes(search)).map(a=>({...a,value:value(a),displayValue:fmt(value(a)),gain:this.isHolding(a)?(num(a.price)-num(a.cost))*num(a.quantity)*(a.currency==='CNY'?1:num(db.rates[a.currency])):null,returnRate:this.isHolding(a)&&num(a.cost)>0?(num(a.price)/num(a.cost)-1)*100:null,returnText:this.isHolding(a)&&num(a.cost)>0?((num(a.price)/num(a.cost)-1)*100).toFixed(2)+'%':'--'}));
 if(this.data.sort==='收益率')assets.sort((a,b)=>(b.returnRate===null?-Infinity:b.returnRate)-(a.returnRate===null?-Infinity:a.returnRate));else assets.sort((a,b)=>b.value-a.value);
 const groups={};selected.forEach(a=>{const key=this.data.filter==='类型'?a.type:a.account;groups[key]=(groups[key]||0)+value(a)});
 this.setData({assets,accounts:db.accounts,accountFilters:['全部'].concat(db.accounts),assetCount:db.assets.length,snapshotCount:db.snapshots.length,total:fmt(total),viewTotal:this.data.hidden?'••••••':fmt(total),yearProfit:profit===null?'未设置':fmt(profit),yearRate:profit===null?'--':num(baseline.amount)>0?(profit/num(baseline.amount)*100).toFixed(2)+'%':'--',viewYear:this.data.hidden?'••••':profit===null?'未设置':fmt(profit),groups:Object.keys(groups).map(name=>({name,amount:fmt(groups[name]),percent:total>0?(groups[name]/total*100).toFixed(1):'0.0'})).sort((a,b)=>parseFloat(b.percent)-parseFloat(a.percent)),snapshots:db.snapshots.slice().reverse().map(s=>({...s,display:fmt(s.amount)})),rates:Object.keys(db.rates).map(currency=>({currency,rate:db.rates[currency]})),baselineText:baseline?fmt(baseline.amount):'未设置',yearFlows:fmt(flows),dividendTotal:fmt(db.transactions.filter(t=>t.type==='现金分红'&&t.date.startsWith(year+'-')).reduce((n,t)=>n+num(t.amount)*(t.currency==='CNY'?1:num(db.rates[t.currency])),0)),unpricedCount:selected.filter(a=>a.currency!=='CNY'&&!(num(db.rates[a.currency])>0)).length,flowList:(db.flows||[]).slice().reverse().slice(0,30).map(f=>({...f,display:fmt(f.amount)})),txList:db.transactions.slice().reverse().slice(0,100).map(t=>({...t,amountText:fmt(t.amount),label:(db.assets.find(a=>a.id===t.assetId)||{}).name||t.assetName||'已移除资产'}))});
 },
 isHolding(a){return ['A股','港股','美股','ETF','实物黄金','积存金','黄金ETF','加密货币'].includes(a.type)},
 switchTab(e){this.setData({tab:e.currentTarget.dataset.tab,formOpen:false})},
 toggleHidden(){this.setData({hidden:!this.data.hidden});this.refresh()},
 toggleGroup(){this.setData({filter:this.data.filter==='类型'?'机构':'类型'});this.refresh()},
 toggleSort(){this.setData({sort:this.data.sort==='收益率'?'金额':'收益率'});this.refresh()},
 onSearch(e){this.setData({search:e.detail.value});this.refresh()},
 clearSearch(){this.setData({search:''});this.refresh()},
 assetFilterChange(e){this.setData({assetFilter:this.data.filterTypes[Number(e.detail.value)]});this.refresh()},
 accountFilterChange(e){this.setData({accountFilter:this.data.accountFilters[Number(e.detail.value)]});this.refresh()},
 field(e){this.setData({['form.'+e.currentTarget.dataset.field]:e.detail.value})},
 typeChange(e){this.setData({'form.type':TYPES[e.detail.value]})},
 currencyChange(e){this.setData({'form.currency':CURRENCIES[e.detail.value]})},
 accountChange(e){this.setData({'form.account':this.db.accounts[e.detail.value]})},
 openAdd(){this.setData({formOpen:true,editing:'',form:{type:'A股',currency:'CNY',account:this.db.accounts[0],name:'',code:'',quantity:'',cost:'',price:'',balance:'',rate:'',start:'',maturity:'',note:''}})},
 edit(e){const a=this.db.assets.find(x=>x.id===e.currentTarget.dataset.id);if(a)this.setData({formOpen:true,editing:a.id,form:{...a}})},
 cancel(){this.setData({formOpen:false})},
 saveAsset(){const f=this.data.form;const holding=this.isHolding(f);if(!f.name.trim()){wx.showToast({title:'请填写资产名称',icon:'none'});return}if(holding&&(!Number.isFinite(Number(f.quantity))||num(f.quantity)<0||num(f.price)<0||num(f.cost)<0)){wx.showToast({title:'检查数量和价格',icon:'none'});return}if(!holding&&num(f.balance)<0){wx.showToast({title:'余额不能为负',icon:'none'});return}
 const a={...f,id:this.data.editing||id(),name:f.name.trim(),quantity:num(f.quantity),price:num(f.price),cost:num(f.cost),balance:num(f.balance)};
 const index=this.db.assets.findIndex(x=>x.id===a.id);if(index>=0)this.db.assets[index]=a;else this.db.assets.push(a);this.setData({formOpen:false,tab:'assets'});this.save();wx.showToast({title:'已保存'})},
 remove(e){const i=this.db.assets.findIndex(x=>x.id===e.currentTarget.dataset.id);if(i<0)return;wx.showModal({title:'移除资产',content:'将移除这项资产，历史交易记录会保留。确认吗？',success:r=>{if(!r.confirm)return;const removed=this.db.assets.splice(i,1)[0];this.setData({undo:removed});this.save();wx.showToast({title:'已移除，可撤销',icon:'none'})}})},
 undoDelete(){if(!this.data.undo)return;this.db.assets.push(this.data.undo);this.setData({undo:null});this.save()},
 onAccount(e){this.setData({newAccount:e.detail.value})},
 addAccount(){const name=this.data.newAccount.trim();if(!name||this.db.accounts.includes(name))return wx.showToast({title:'名称为空或已存在',icon:'none'});this.db.accounts.push(name);this.setData({newAccount:''});this.save()},
 renameAccount(e){const old=e.currentTarget.dataset.name;wx.showModal({title:'重命名账户',editable:true,placeholderText:old,success:r=>{if(!r.confirm)return;const name=(r.content||'').trim();if(!name||this.db.accounts.includes(name))return wx.showToast({title:'名称为空或已存在',icon:'none'});this.db.accounts=this.db.accounts.map(x=>x===old?name:x);this.db.assets.forEach(a=>{if(a.account===old)a.account=name});this.save()}})},
 deleteAccount(e){const name=e.currentTarget.dataset.name;if(this.db.accounts.length<=1)return wx.showToast({title:'至少保留一个账户',icon:'none'});if(this.db.assets.some(a=>a.account===name))return wx.showToast({title:'请先转移账户内资产',icon:'none'});wx.showModal({title:'删除空账户',content:'确认删除 '+name+' 吗？',success:r=>{if(r.confirm){this.db.accounts=this.db.accounts.filter(x=>x!==name);this.save()}}})},
 rateCurrencyChange(e){this.setData({rateCurrency:CURRENCIES[e.detail.value]})},
 onRate(e){this.setData({rateValue:e.detail.value})},
 saveRate(){const rate=Number(this.data.rateValue);if(!(rate>0))return wx.showToast({title:'请输入有效汇率',icon:'none'});if(this.data.rateCurrency==='CNY'&&rate!==1)return wx.showToast({title:'人民币汇率必须为1',icon:'none'});this.db.rates[this.data.rateCurrency]=rate;this.save();wx.showToast({title:'汇率已更新'})},
 onBase(e){this.setData({baseValue:e.detail.value})},
 setBaseline(){const v=Number(this.data.baseValue);if(!Number.isFinite(v)||v<0)return wx.showToast({title:'请输入有效金额',icon:'none'});this.db.baseline={year:new Date().getFullYear(),amount:v,external:0};this.save();wx.showToast({title:'年初基准已保存'})},
 snapshot(){if(this.db.assets.some(a=>a.currency!=='CNY'&&!(num(this.db.rates[a.currency])>0)))return wx.showToast({title:'请先补齐外币汇率',icon:'none'});const amount=this.db.assets.reduce((s,a)=>s+(this.isHolding(a)?num(a.quantity)*num(a.price):num(a.balance))*(a.currency==='CNY'?1:num(this.db.rates[a.currency])),0);const index=this.db.snapshots.findIndex(s=>s.date===today());const record={id:index>=0?this.db.snapshots[index].id:id(),date:today(),amount};if(index>=0)this.db.snapshots[index]=record;else this.db.snapshots.push(record);this.save();wx.showToast({title:'快照已保存'})},
 removeSnapshot(e){const key=e.currentTarget.dataset.id;wx.showModal({title:'删除快照',content:'确认删除该日快照吗？',success:r=>{if(r.confirm){this.db.snapshots=this.db.snapshots.filter(x=>x.id!==key);this.save()}}})},
 toggleAutoMarket(e){this.db.autoMarket=!!e.detail.value;this.setData({autoMarket:this.db.autoMarket});this.save();if(this.db.autoMarket)this.refreshMarket()},
 refreshMarket(){
  if(this.data.marketBusy)return;
  const holdings=this.db.assets.filter(a=>this.isHolding(a)&&a.code&&['A股','港股','美股','ETF','黄金ETF'].includes(a.type));
  const code=a=>{const c=String(a.code||'').trim().toUpperCase();if(/^[0-9]{6}[.]SH$/.test(c))return 'sh'+c.slice(0,6);if(/^[0-9]{6}[.]SZ$/.test(c))return 'sz'+c.slice(0,6);if(/^[0-9]{1,5}[.]HK$/.test(c))return 'hk'+c.split('.')[0].padStart(5,'0');if(/^[A-Z.-]+[.]US$/.test(c))return 'us'+c.slice(0,-3);return ''};
  const valid=holdings.filter(a=>code(a));
  if(!valid.length){this.setData({marketStatus:'没有可自动查询的股票代码；可在资产编辑页手动填写价格'});return}
  this.setData({marketBusy:true,marketStatus:'正在直连腾讯行情（无需云服务）…'});
  const symbols=[...new Set(valid.map(code))];
  wx.request({
   url:'https://qt.gtimg.cn/q='+symbols.join(','),method:'GET',responseType:'arraybuffer',
   success:res=>{
    try{
     const decoder=typeof TextDecoder!=='undefined'?new TextDecoder('gbk'):null;
     if(!decoder)throw Error('当前基础库不支持 GBK 解码');
     const body=decoder.decode(res.data), now=new Date().toISOString();
     let count=0;
     for(const a of valid){
      const symbol=code(a);
      const line=body.split(';').find(x=>x.includes('v_'+symbol+'='));
      if(!line)continue;
      const match=line.match(/="([^"]*)"/);
      if(!match)continue;
      const price=Number(match[1].split('~')[3]);
      const currency=symbol.startsWith('us')?'USD':symbol.startsWith('hk')?'HKD':'CNY';
      if(price>0&&a.currency===currency){a.price=price;a.quoteUpdatedAt=now;count++}
     }
     if(count){this.db.lastMarketUpdate=now;wx.setStorageSync(KEY,this.db)}
     this.setData({marketStatus:count?'成功更新 '+count+' 项；其余资产价格保持不变':'未获取有效报价，请检查代码、币种及接口',marketUpdatedAt:count?now:this.data.marketUpdatedAt});
     this.refresh();
    }catch(e){this.setData({marketStatus:'行情解析失败：'+e.message+'；请手动更新价格'})}
   },
   fail:()=>this.setData({marketStatus:'直连行情失败。请在开发者工具配置合法域名，或手动填写价格'}),
   complete:()=>this.setData({marketBusy:false})
  });
 },
 openTransaction(e){const a=this.db.assets.find(x=>x.id===e.currentTarget.dataset.id);if(!a||!this.isHolding(a))return;this.setData({txOpen:true,txAsset:a.id,txType:'买入',txQuantity:'',txPrice:String(a.price||''),txCash:'',txDate:today(),txNote:''})},
 txField(e){this.setData({[e.currentTarget.dataset.field]:e.detail.value})},
 txTypeChange(e){this.setData({txType:['买入','卖出','现金分红','送股','拆分'][Number(e.detail.value)]})},
 closeTransaction(){this.setData({txOpen:false})},
 saveTransaction(){
  const a=this.db.assets.find(x=>x.id===this.data.txAsset);if(!a)return;
  const type=this.data.txType,q=Number(this.data.txQuantity),p=Number(this.data.txPrice),cash=Number(this.data.txCash);
  if(!validDate(this.data.txDate)||!Number.isFinite(q)||!Number.isFinite(p)||!Number.isFinite(cash)||q<0||p<0||cash<0)return wx.showToast({title:'请检查日期及金额',icon:'none'});
  if(type!=='现金分红'&&!(q>0))return wx.showToast({title:'数量必须大于0',icon:'none'});
  if(type==='现金分红'&&!(cash>0))return wx.showToast({title:'请填写实际到账分红',icon:'none'});
  if(['买入','卖出'].includes(type)&&!(p>0))return wx.showToast({title:'请填写成交单价',icon:'none'});
  const oldQ=num(a.quantity),oldCost=num(a.cost);
  if(type==='卖出'&&q>oldQ)return wx.showToast({title:'卖出数量超出持仓',icon:'none'});
  if(type==='买入'){a.cost=(oldQ*oldCost+q*p)/(oldQ+q);a.quantity=oldQ+q}
  if(type==='卖出'){a.quantity=oldQ-q;if(a.quantity===0)a.cost=0}
  if(type==='送股'){if(oldQ<=0)return wx.showToast({title:'没有持仓可送股',icon:'none'});a.quantity=oldQ+q;a.cost=oldCost*oldQ/a.quantity}
  if(type==='拆分'){if(oldQ<=0)return wx.showToast({title:'没有持仓可拆分',icon:'none'});a.quantity=oldQ+q;a.cost=oldCost*oldQ/a.quantity}
  // 现金分红只记账，不自动增加现金资产，避免凭空重复计入家庭总资产。
  this.db.transactions.push({id:id(),assetId:a.id,assetName:a.name,type,quantity:type==='现金分红'?0:q,price:p,amount:type==='现金分红'?cash:q*p,currency:a.currency,date:this.data.txDate,note:this.data.txNote,createdAt:new Date().toISOString()});
  this.setData({txOpen:false});this.save();wx.showToast({title:'交易已记录'});
 },
 flowField(e){this.setData({[e.currentTarget.dataset.field]:e.detail.value})},
 flowTypeChange(e){this.setData({flowType:['存入','取出'][Number(e.detail.value)]})},
 addFlow(){
  const amount=Number(this.data.flowAmount),date=this.data.flowDate;
  if(!(amount>0)||!Number.isFinite(amount)||!validDate(date))return wx.showToast({title:'请检查日期和金额',icon:'none'});
  this.db.flows=this.db.flows||[];
  this.db.flows.push({id:id(),date,type:this.data.flowType,amount,note:this.data.flowNote});
  this.setData({flowAmount:'',flowNote:''});this.save();wx.showToast({title:'资金变动已记录'});
 },
 removeFlow(e){
  const target=e.currentTarget.dataset.id;
  wx.showModal({title:'删除资金记录',content:'删除后将影响年度收益计算，确认吗？',success:r=>{if(r.confirm){this.db.flows=(this.db.flows||[]).filter(f=>f.id!==target);this.save()}}});
 },
 importField(e){this.setData({importText:e.detail.value})},
 pasteBackup(){wx.getClipboardData({success:r=>this.setData({importText:r.data}),fail:()=>wx.showToast({title:'读取剪贴板失败',icon:'none'})})},
 restoreData(){
  let parsed;try{parsed=JSON.parse(this.data.importText)}catch(e){return wx.showToast({title:'JSON 格式错误',icon:'none'})}
  const db=parsed&&parsed.data;
  if(!db||!Array.isArray(db.assets)||!Array.isArray(db.accounts)||!db.rates||typeof db.rates!=='object'||!Array.isArray(db.snapshots)||db.assets.length>20000)return wx.showToast({title:'备份结构不正确',icon:'none'});
  if(db.assets.some(a=>!a||typeof a.name!=='string'||typeof a.type!=='string'||!CURRENCIES.includes(a.currency)))return wx.showToast({title:'资产数据校验失败',icon:'none'});
  wx.showModal({title:'恢复本地备份',content:'将覆盖本机所有资产、账户和快照。请先导出当前数据！确认恢复吗？',success:r=>{if(!r.confirm)return;db.transactions=Array.isArray(db.transactions)?db.transactions:[];db.flows=Array.isArray(db.flows)?db.flows:[];db.rates.CNY=1;this.db=db;this.setData({importText:'',autoMarket:!!db.autoMarket});this.save();wx.showToast({title:'恢复成功'})}});
 },
 exportData(){const content=JSON.stringify({version:2,exportedAt:new Date().toISOString(),data:this.db});wx.setClipboardData({data:content,success:()=>wx.showModal({title:'备份已复制',content:'JSON 数据已复制到剪贴板，请粘贴到安全位置保存。恢复前请保留当前备份，以免误覆盖。',showCancel:false})})}
});