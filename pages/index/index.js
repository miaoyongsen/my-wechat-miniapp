const KEY='family_assets_v1', OLD='asset_demo_v1';
const TYPES=['A股','港股','美股','ETF','实物黄金','积存金','黄金ETF','银行活期','银行定期','外币','加密货币','现金'];
const CURRENCIES=['CNY','USD','HKD','JPY','EUR'];
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const num=v=>Number(v)||0;
const fmt=v=>num(v).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
const id=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
function initial(){return {assets:[],accounts:['默认账户'],rates:{CNY:1,USD:1,HKD:1,JPY:1,EUR:1},baseline:null,snapshots:[],transactions:[],people:['本人','家人']}}
Page({
 data:{tab:'home',types:TYPES,currencies:CURRENCIES,assets:[],accounts:[],total:'0.00',yearProfit:'--',yearRate:'--',hidden:false,filter:'类型',groups:[],formOpen:false,form:{type:'A股',currency:'CNY',account:'默认账户',name:'',code:'',quantity:'',cost:'',price:'',balance:'',rate:'',start:'',maturity:'',note:''},editing:'',search:'',newAccount:'',rateCurrency:'USD',rateValue:'',baseValue:'',snapshotDate:'',snapshots:[],rates:[],viewTotal:'',viewYear:'',notice:'',sort:'收益率',undo:null,marketBusy:false,marketStatus:'本地存储模式：股票行情可尝试直连，汇率和数字资产价格暂需手动维护',marketUpdatedAt:'',autoMarket:false,people:['本人','家人'],personFilter:'全部',txOpen:false,txAsset:'',txType:'买入',txQuantity:'',txPrice:'',txCash:'',txDate:today(),txNote:'',txList:[],importText:'',newPerson:''},
 onLoad(){let db=wx.getStorageSync(KEY);if(!db||!Array.isArray(db.assets)){db=initial();const old=wx.getStorageSync(OLD)||[];db.assets=old.map(a=>({id:id(),type:'现金',name:a.name,account:'默认账户',currency:'CNY',balance:num(a.amount)}));wx.setStorageSync(KEY,db)}db.transactions=db.transactions||[];db.people=db.people||['本人','家人'];this.db=db;this.setData({autoMarket:!!db.autoMarket,people:db.people,marketUpdatedAt:db.lastMarketUpdate||''});this.refresh()},
 onShow(){if(this.db){this.refresh();if(this.db.autoMarket)this.refreshMarket()}},
 save(){wx.setStorageSync(KEY,this.db);this.refresh()},
 refresh(){const db=this.db;const value=a=>{const raw=this.isHolding(a)?num(a.quantity)*num(a.price):num(a.balance);return raw*(a.currency==='CNY'?1:(num(db.rates[a.currency])||0))};
 const selected=db.assets.filter(a=>this.data.personFilter==='全部'||(a.owner||'本人')===this.data.personFilter);const total=selected.reduce((s,a)=>s+value(a),0);const year=new Date().getFullYear();const baseline=db.baseline&&db.baseline.year===year?db.baseline:null;
 const profit=baseline?total-num(baseline.amount)-num(baseline.external):null;
 const search=this.data.search.trim().toLowerCase();let assets=selected.filter(a=>!search||(a.name||'').toLowerCase().includes(search)||(a.code||'').toLowerCase().includes(search)||(a.account||'').toLowerCase().includes(search)).map(a=>({...a,value:value(a),displayValue:fmt(value(a)),gain:this.isHolding(a)?(num(a.price)-num(a.cost))*num(a.quantity)*(a.currency==='CNY'?1:num(db.rates[a.currency])):null,returnRate:this.isHolding(a)&&num(a.cost)>0?(num(a.price)/num(a.cost)-1)*100:null,returnText:this.isHolding(a)&&num(a.cost)>0?((num(a.price)/num(a.cost)-1)*100).toFixed(2)+'%':'--'}));
 if(this.data.sort==='收益率')assets.sort((a,b)=>(b.returnRate===null?-Infinity:b.returnRate)-(a.returnRate===null?-Infinity:a.returnRate));else assets.sort((a,b)=>b.value-a.value);
 const groups={};selected.forEach(a=>{const key=this.data.filter==='类型'?a.type:a.account;groups[key]=(groups[key]||0)+value(a)});
 this.setData({assets,accounts:db.accounts,total:fmt(total),viewTotal:this.data.hidden?'••••••':fmt(total),yearProfit:profit===null?'未设置':fmt(profit),yearRate:profit===null?'--':num(baseline.amount)>0?(profit/num(baseline.amount)*100).toFixed(2)+'%':'--',viewYear:this.data.hidden?'••••':profit===null?'未设置':fmt(profit),groups:Object.keys(groups).map(name=>({name,amount:fmt(groups[name]),percent:total>0?(groups[name]/total*100).toFixed(1):'0.0'})).sort((a,b)=>parseFloat(b.percent)-parseFloat(a.percent)),snapshots:db.snapshots.slice().reverse().map(s=>({...s,display:fmt(s.amount)})),rates:Object.keys(db.rates).map(currency=>({currency,rate:db.rates[currency]})),baselineText:baseline?fmt(baseline.amount):'未设置',people:db.people,txList:db.transactions.slice().reverse().slice(0,100).map(t=>({...t,amountText:fmt(t.amount),label:(db.assets.find(a=>a.id===t.assetId)||{}).name||t.assetName||'已移除资产'}))});
 },
 isHolding(a){return ['A股','港股','美股','ETF','实物黄金','积存金','黄金ETF','加密货币'].includes(a.type)},
 switchTab(e){this.setData({tab:e.currentTarget.dataset.tab,formOpen:false})},
 toggleHidden(){this.setData({hidden:!this.data.hidden});this.refresh()},
 toggleGroup(){this.setData({filter:this.data.filter==='类型'?'机构':'类型'});this.refresh()},
 toggleSort(){this.setData({sort:this.data.sort==='收益率'?'金额':'收益率'});this.refresh()},
 onSearch(e){this.setData({search:e.detail.value});this.refresh()},
 field(e){this.setData({['form.'+e.currentTarget.dataset.field]:e.detail.value})},
 typeChange(e){this.setData({'form.type':TYPES[e.detail.value]})},
 currencyChange(e){this.setData({'form.currency':CURRENCIES[e.detail.value]})},
 accountChange(e){this.setData({'form.account':this.db.accounts[e.detail.value]})},
 openAdd(){this.setData({formOpen:true,editing:'',form:{type:'A股',currency:'CNY',account:this.db.accounts[0],owner:'本人',name:'',code:'',quantity:'',cost:'',price:'',balance:'',rate:'',start:'',maturity:'',note:''}})},
 edit(e){const a=this.db.assets.find(x=>x.id===e.currentTarget.dataset.id);if(a)this.setData({formOpen:true,editing:a.id,form:{...a}})},
 cancel(){this.setData({formOpen:false})},
 saveAsset(){const f=this.data.form;const holding=this.isHolding(f);if(!f.name.trim()){wx.showToast({title:'请填写资产名称',icon:'none'});return}if(holding&&(!Number.isFinite(Number(f.quantity))||num(f.quantity)<0||num(f.price)<0)){wx.showToast({title:'检查数量和价格',icon:'none'});return}if(!holding&&num(f.balance)<0){wx.showToast({title:'余额不能为负',icon:'none'});return}
 const a={...f,owner:f.owner||'本人',id:this.data.editing||id(),name:f.name.trim(),quantity:num(f.quantity),price:num(f.price),cost:num(f.cost),balance:num(f.balance)};
 const index=this.db.assets.findIndex(x=>x.id===a.id);if(index>=0)this.db.assets[index]=a;else this.db.assets.push(a);this.setData({formOpen:false,tab:'assets'});this.save();wx.showToast({title:'已保存'})},
 remove(e){const i=this.db.assets.findIndex(x=>x.id===e.currentTarget.dataset.id);if(i<0)return;const removed=this.db.assets.splice(i,1)[0];this.setData({undo:removed});this.save();wx.showToast({title:'已移除，可撤销',icon:'none'})},
 undoDelete(){if(!this.data.undo)return;this.db.assets.push(this.data.undo);this.setData({undo:null});this.save()},
 onAccount(e){this.setData({newAccount:e.detail.value})},
 addAccount(){const name=this.data.newAccount.trim();if(!name||this.db.accounts.includes(name))return wx.showToast({title:'名称为空或已存在',icon:'none'});this.db.accounts.push(name);this.setData({newAccount:''});this.save()},
 rateCurrencyChange(e){this.setData({rateCurrency:CURRENCIES[e.detail.value]})},
 onRate(e){this.setData({rateValue:e.detail.value})},
 saveRate(){const rate=Number(this.data.rateValue);if(!(rate>0))return wx.showToast({title:'请输入有效汇率',icon:'none'});if(this.data.rateCurrency==='CNY'&&rate!==1)return wx.showToast({title:'人民币汇率必须为1',icon:'none'});this.db.rates[this.data.rateCurrency]=rate;this.save();wx.showToast({title:'汇率已更新'})},
 onBase(e){this.setData({baseValue:e.detail.value})},
 setBaseline(){const v=Number(this.data.baseValue);if(!Number.isFinite(v)||v<0)return wx.showToast({title:'请输入有效金额',icon:'none'});this.db.baseline={year:new Date().getFullYear(),amount:v,external:0};this.save();wx.showToast({title:'年初基准已保存'})},
 snapshot(){const amount=this.db.assets.reduce((s,a)=>s+(this.isHolding(a)?num(a.quantity)*num(a.price):num(a.balance))*(a.currency==='CNY'?1:num(this.db.rates[a.currency])),0);this.db.snapshots.push({id:id(),date:today(),amount});this.save();wx.showToast({title:'快照已保存'})},
 toggleAutoMarket(e){this.db.autoMarket=!!e.detail.value;this.setData({autoMarket:this.db.autoMarket});this.save();if(this.db.autoMarket)this.refreshMarket()},
 refreshMarket(){
  if(this.data.marketBusy)return;
  const holdings=this.db.assets.filter(a=>this.isHolding(a)&&a.code&&['A股','港股','美股','ETF','黄金ETF'].includes(a.type));
  const code=a=>{const c=String(a.code||'').trim().toUpperCase();if(/^\\d{6}\\.SH$/.test(c))return 'sh'+c.slice(0,6);if(/^\\d{6}\\.SZ$/.test(c))return 'sz'+c.slice(0,6);if(/^\\d{1,5}\\.HK$/.test(c))return 'hk'+c.split('.')[0].padStart(5,'0');if(/^[A-Z.\\-]+\\.US$/.test(c))return 'us'+c.slice(0,-3);return ''};
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
 onPersonFilter(e){this.setData({personFilter:e.currentTarget.dataset.person});this.refresh()},
 ownerChange(e){this.setData({'form.owner':this.db.people[Number(e.detail.value)]})},
 onNewPerson(e){this.setData({newPerson:e.detail.value})},
 addPerson(){const p=this.data.newPerson.trim();if(!p||p==='全部'||this.db.people.includes(p))return wx.showToast({title:'姓名无效或重复',icon:'none'});this.db.people.push(p);this.setData({newPerson:''});this.save()},
 openTransaction(e){const a=this.db.assets.find(x=>x.id===e.currentTarget.dataset.id);if(!a||!this.isHolding(a))return;this.setData({txOpen:true,txAsset:a.id,txType:'买入',txQuantity:'',txPrice:String(a.price||''),txCash:'',txDate:today(),txNote:''})},
 txField(e){this.setData({[e.currentTarget.dataset.field]:e.detail.value})},
 txTypeChange(e){this.setData({txType:['买入','卖出','现金分红','送股','拆分'][Number(e.detail.value)]})},
 closeTransaction(){this.setData({txOpen:false})},
 saveTransaction(){
  const a=this.db.assets.find(x=>x.id===this.data.txAsset);if(!a)return;
  const type=this.data.txType,q=Number(this.data.txQuantity),p=Number(this.data.txPrice),cash=Number(this.data.txCash);
  if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(this.data.txDate)||!Number.isFinite(q)||!Number.isFinite(p)||!Number.isFinite(cash)||q<0||p<0||cash<0)return wx.showToast({title:'请检查日期及金额',icon:'none'});
  if(type!=='现金分红'&&!(q>0))return wx.showToast({title:'数量必须大于0',icon:'none'});
  if(type==='现金分红'&&!(cash>0))return wx.showToast({title:'请填写实际到账分红',icon:'none'});
  if(['买入','卖出'].includes(type)&&!(p>0))return wx.showToast({title:'请填写成交单价',icon:'none'});
  const oldQ=num(a.quantity),oldCost=num(a.cost);
  if(type==='卖出'&&q>oldQ)return wx.showToast({title:'卖出数量超出持仓',icon:'none'});
  if(type==='买入'){a.cost=(oldQ*oldCost+q*p)/(oldQ+q);a.quantity=oldQ+q}
  if(type==='卖出'){a.quantity=oldQ-q;if(a.quantity===0)a.cost=0}
  if(type==='送股')a.quantity=oldQ+q;
  if(type==='拆分'){if(oldQ<=0)return wx.showToast({title:'没有持仓可拆分',icon:'none'});a.quantity=oldQ+q;a.cost=oldCost*oldQ/a.quantity}
  // 现金分红只记账，不自动增加现金资产，避免凭空重复计入家庭总资产。
  this.db.transactions.push({id:id(),assetId:a.id,assetName:a.name,type,quantity:type==='现金分红'?0:q,price:p,amount:type==='现金分红'?cash:q*p,currency:a.currency,date:this.data.txDate,note:this.data.txNote,createdAt:new Date().toISOString()});
  this.setData({txOpen:false});this.save();wx.showToast({title:'交易已记录'});
 },
 importField(e){this.setData({importText:e.detail.value})},
 pasteBackup(){wx.getClipboardData({success:r=>this.setData({importText:r.data}),fail:()=>wx.showToast({title:'读取剪贴板失败',icon:'none'})})},
 restoreData(){
  let parsed;try{parsed=JSON.parse(this.data.importText)}catch(e){return wx.showToast({title:'JSON 格式错误',icon:'none'})}
  const db=parsed&&parsed.data;
  if(!db||!Array.isArray(db.assets)||!Array.isArray(db.accounts)||!db.rates||typeof db.rates!=='object'||!Array.isArray(db.snapshots)||db.assets.length>20000)return wx.showToast({title:'备份结构不正确',icon:'none'});
  if(db.assets.some(a=>!a||typeof a.name!=='string'||typeof a.type!=='string'||!CURRENCIES.includes(a.currency)))return wx.showToast({title:'资产数据校验失败',icon:'none'});
  wx.showModal({title:'恢复本地备份',content:'将覆盖本机所有资产、账户和快照。请先导出当前数据！确认恢复吗？',success:r=>{if(!r.confirm)return;db.people=Array.isArray(db.people)?db.people:['本人','家人'];db.transactions=Array.isArray(db.transactions)?db.transactions:[];db.rates.CNY=1;this.db=db;this.setData({importText:'',personFilter:'全部',autoMarket:!!db.autoMarket});this.save();wx.showToast({title:'恢复成功'})}});
 },
 exportData(){const content=JSON.stringify({version:2,exportedAt:new Date().toISOString(),data:this.db});wx.setClipboardData({data:content,success:()=>wx.showModal({title:'备份已复制',content:'JSON 数据已复制到剪贴板，请粘贴到安全位置保存。恢复功能将在后续版本完善。',showCancel:false})})}
});