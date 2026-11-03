const KEY='family_assets_v1', OLD='asset_demo_v1';
const TYPES=['A股','港股','美股','ETF','实物黄金','积存金','黄金ETF','银行活期','银行定期','外币','加密货币','现金'];
const CURRENCIES=['CNY','USD','HKD','JPY','EUR'];
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const num=v=>Number(v)||0;
const fmt=v=>num(v).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
const id=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
function initial(){return {assets:[],accounts:['默认账户'],rates:{CNY:1,USD:1,HKD:1,JPY:1,EUR:1},baseline:null,snapshots:[]}}
Page({
 data:{tab:'home',types:TYPES,currencies:CURRENCIES,assets:[],accounts:[],total:'0.00',yearProfit:'--',yearRate:'--',hidden:false,filter:'类型',groups:[],formOpen:false,form:{type:'A股',currency:'CNY',account:'默认账户',name:'',code:'',quantity:'',cost:'',price:'',balance:'',rate:'',start:'',maturity:'',note:''},editing:'',search:'',newAccount:'',rateCurrency:'USD',rateValue:'',baseValue:'',snapshotDate:'',snapshots:[],rates:[],viewTotal:'',viewYear:'',notice:'',sort:'收益率',undo:null,marketBusy:false,marketStatus:'行情尚未更新',marketUpdatedAt:'',autoMarket:false},
 onLoad(){let db=wx.getStorageSync(KEY);if(!db||!Array.isArray(db.assets)){db=initial();const old=wx.getStorageSync(OLD)||[];db.assets=old.map(a=>({id:id(),type:'现金',name:a.name,account:'默认账户',currency:'CNY',balance:num(a.amount)}));wx.setStorageSync(KEY,db)}this.db=db;this.setData({autoMarket:!!db.autoMarket});this.refresh()},
 onShow(){if(this.db){this.refresh();if(this.db.autoMarket)this.refreshMarket()}},
 save(){wx.setStorageSync(KEY,this.db);this.refresh()},
 refresh(){const db=this.db;const value=a=>{const raw=this.isHolding(a)?num(a.quantity)*num(a.price):num(a.balance);return raw*(a.currency==='CNY'?1:(num(db.rates[a.currency])||0))};
 const total=db.assets.reduce((s,a)=>s+value(a),0);const year=new Date().getFullYear();const baseline=db.baseline&&db.baseline.year===year?db.baseline:null;
 const profit=baseline?total-num(baseline.amount)-num(baseline.external):null;
 const search=this.data.search.trim().toLowerCase();let assets=db.assets.filter(a=>!search||(a.name||'').toLowerCase().includes(search)||(a.code||'').toLowerCase().includes(search)||(a.account||'').toLowerCase().includes(search)).map(a=>({...a,value:value(a),displayValue:fmt(value(a)),gain:this.isHolding(a)?(num(a.price)-num(a.cost))*num(a.quantity)*num(db.rates[a.currency]||1):null,returnRate:this.isHolding(a)&&num(a.cost)>0?(num(a.price)/num(a.cost)-1)*100:null,returnText:this.isHolding(a)&&num(a.cost)>0?((num(a.price)/num(a.cost)-1)*100).toFixed(2)+'%':'--'}));
 if(this.data.sort==='收益率')assets.sort((a,b)=>(b.returnRate===null?-Infinity:b.returnRate)-(a.returnRate===null?-Infinity:a.returnRate));else assets.sort((a,b)=>b.value-a.value);
 const groups={};db.assets.forEach(a=>{const key=this.data.filter==='类型'?a.type:a.account;groups[key]=(groups[key]||0)+value(a)});
 this.setData({assets,accounts:db.accounts,total:fmt(total),viewTotal:this.data.hidden?'••••••':fmt(total),yearProfit:profit===null?'未设置':fmt(profit),yearRate:profit===null?'--':num(baseline.amount)>0?(profit/num(baseline.amount)*100).toFixed(2)+'%':'--',viewYear:this.data.hidden?'••••':profit===null?'未设置':fmt(profit),groups:Object.keys(groups).map(name=>({name,amount:fmt(groups[name]),percent:total>0?(groups[name]/total*100).toFixed(1):'0.0'})).sort((a,b)=>parseFloat(b.percent)-parseFloat(a.percent)),snapshots:db.snapshots.slice().reverse().map(s=>({...s,display:fmt(s.amount)})),rates:Object.keys(db.rates).map(currency=>({currency,rate:db.rates[currency]})),baselineText:baseline?fmt(baseline.amount):'未设置'});
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
 openAdd(){this.setData({formOpen:true,editing:'',form:{type:'A股',currency:'CNY',account:this.db.accounts[0],name:'',code:'',quantity:'',cost:'',price:'',balance:'',rate:'',start:'',maturity:'',note:''}})},
 edit(e){const a=this.db.assets.find(x=>x.id===e.currentTarget.dataset.id);if(a)this.setData({formOpen:true,editing:a.id,form:{...a}})},
 cancel(){this.setData({formOpen:false})},
 saveAsset(){const f=this.data.form;const holding=this.isHolding(f);if(!f.name.trim()){wx.showToast({title:'请填写资产名称',icon:'none'});return}if(holding&&(!Number.isFinite(Number(f.quantity))||num(f.quantity)<0||num(f.price)<0)){wx.showToast({title:'检查数量和价格',icon:'none'});return}if(!holding&&num(f.balance)<0){wx.showToast({title:'余额不能为负',icon:'none'});return}
 const a={...f,id:this.data.editing||id(),name:f.name.trim(),quantity:num(f.quantity),price:num(f.price),cost:num(f.cost),balance:num(f.balance)};
 const index=this.db.assets.findIndex(x=>x.id===a.id);if(index>=0)this.db.assets[index]=a;else this.db.assets.push(a);this.setData({formOpen:false,tab:'assets'});this.save();wx.showToast({title:'已保存'})},
 remove(e){const i=this.db.assets.findIndex(x=>x.id===e.currentTarget.dataset.id);if(i<0)return;const removed=this.db.assets.splice(i,1)[0];this.setData({undo:removed});this.save();wx.showToast({title:'已移除，可撤销',icon:'none'})},
 undoDelete(){if(!this.data.undo)return;this.db.assets.push(this.data.undo);this.setData({undo:null});this.save()},
 onAccount(e){this.setData({newAccount:e.detail.value})},
 addAccount(){const name=this.data.newAccount.trim();if(!name||this.db.accounts.includes(name))return wx.showToast({title:'名称为空或已存在',icon:'none'});this.db.accounts.push(name);this.setData({newAccount:''});this.save()},
 rateCurrencyChange(e){this.setData({rateCurrency:CURRENCIES[e.detail.value]})},
 onRate(e){this.setData({rateValue:e.detail.value})},
 saveRate(){const rate=Number(this.data.rateValue);if(!(rate>0))return wx.showToast({title:'请输入有效汇率',icon:'none'});this.db.rates[this.data.rateCurrency]=rate;this.save();wx.showToast({title:'汇率已更新'})},
 onBase(e){this.setData({baseValue:e.detail.value})},
 setBaseline(){const v=Number(this.data.baseValue);if(!Number.isFinite(v)||v<0)return wx.showToast({title:'请输入有效金额',icon:'none'});this.db.baseline={year:new Date().getFullYear(),amount:v,external:0};this.save();wx.showToast({title:'年初基准已保存'})},
 snapshot(){const amount=this.db.assets.reduce((s,a)=>s+(this.isHolding(a)?num(a.quantity)*num(a.price):num(a.balance))*num(this.db.rates[a.currency]||1),0);this.db.snapshots.push({id:id(),date:today(),amount});this.save();wx.showToast({title:'快照已保存'})},
 toggleAutoMarket(e){this.db.autoMarket=!!e.detail.value;this.setData({autoMarket:this.db.autoMarket});this.save();if(this.db.autoMarket)this.refreshMarket()},
 async refreshMarket(){
  if(this.data.marketBusy)return;
  if(!wx.cloud || !wx.cloud.callFunction){this.setData({marketStatus:'未初始化云开发，请先部署行情云函数'});return}
  this.setData({marketBusy:true,marketStatus:'正在获取行情…'});
  const stocks=this.db.assets.filter(a=>this.isHolding(a)&&a.code&&['A股','港股','美股','ETF','黄金ETF','加密货币'].includes(a.type));
  const normalize=a=>{let c=String(a.code||'').trim().toUpperCase();if(a.type==='加密货币'&&!c.includes('.'))c+='.CRYPTO';return c};
  const codes=[...new Set(stocks.map(normalize))];
  let updated=0,errors=[],fxOk=false;
  try{
   const fx=await wx.cloud.callFunction({name:'market',data:{action:'fx'}});
   const result=fx.result||{};
   if(result.ok&&result.rates){
    for(const [currency,rate] of Object.entries(result.rates))if(Number(rate)>0){this.db.rates[currency]=Number(rate);fxOk=true}
   }else errors.push('汇率：'+(result.error||'不可用'));
  }catch(e){errors.push('汇率请求失败')}
  for(let i=0;i<codes.length;i+=50){
   try{
    const res=await wx.cloud.callFunction({name:'market',data:{action:'quotes',symbols:codes.slice(i,i+50)}});
    const result=res.result||{};
    if(!result.ok){errors.push(result.error||'行情请求失败');continue}
    for(const a of stocks){
     const quote=(result.quotes||{})[normalize(a)];
     if(quote&&Number(quote.price)>0&&quote.currency===a.currency){
      a.price=Number(quote.price);a.quoteUpdatedAt=quote.updatedAt;updated++;
     }
    }
    if(Object.keys(result.errors||{}).length)errors.push(Object.keys(result.errors).length+'个代码未取得报价');
   }catch(e){errors.push('行情请求失败')}
  }
  if(updated||fxOk){this.db.lastMarketUpdate=new Date().toISOString();wx.setStorageSync(KEY,this.db)}
  this.setData({marketBusy:false,marketUpdatedAt:this.db.lastMarketUpdate||'',marketStatus:'已更新'+updated+'项资产'+(fxOk?'，汇率已刷新':'')+(errors.length?'；'+errors.join('；'):'')});
  this.refresh();
 },
 exportData(){const content=JSON.stringify({version:1,exportedAt:new Date().toISOString(),data:this.db});wx.setClipboardData({data:content,success:()=>wx.showModal({title:'备份已复制',content:'JSON 数据已复制到剪贴板，请粘贴到安全位置保存。恢复功能将在后续版本完善。',showCancel:false})})}
});