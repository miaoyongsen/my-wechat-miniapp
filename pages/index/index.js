const KEY='family_assets_v1', OLD='asset_demo_v1';
const TYPES=['A股','港股','美股','ETF','实物黄金','黄金ETF','银行活期','银行定期','外币','加密货币','现金'];
const CURRENCIES=['CNY','USD','HKD','JPY','EUR'];
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const num=v=>Number(v)||0;
const fmt=v=>num(v).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
const validDate=v=>{if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v))return false;const d=new Date(v+'T12:00:00');return !Number.isNaN(d.getTime())&&d.getFullYear()===Number(v.slice(0,4))&&d.getMonth()+1===Number(v.slice(5,7))&&d.getDate()===Number(v.slice(8,10))};
const id=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
function initial(){return {assets:[],accounts:['默认账户'],rates:{CNY:1,USD:0,HKD:0,JPY:0,EUR:0},baseline:null,snapshots:[],transactions:[]}}
Page({
 data:{tab:'home',types:TYPES,currencies:CURRENCIES,assets:[],accounts:[],total:'0.00',yearProfit:'--',yearRate:'--',yearTrend:'flat',dailyProfit:'--',dailyRate:'--',dailyTrend:'flat',dailyNote:'请先保存昨日快照',hidden:false,filter:'类型',groups:[],formOpen:false,form:{type:'A股',currency:'CNY',account:'默认账户',name:'',code:'',quantity:'',cost:'',price:'',balance:'',rate:'',start:'',maturity:'',note:''},editing:'',search:'',newAccount:'',rateCurrency:'USD',rateValue:'',baseValue:'',snapshotDate:'',snapshots:[],rates:[],viewTotal:'',viewYear:'',notice:'',sort:'收益率',undo:null,marketBusy:false,marketStatus:'云行情支持A股、美股、港股、BTC/ETH及参考汇率；需先部署 quotes 云函数',marketUpdatedAt:'',autoMarket:false,txTypes:['买入','卖出','现金分红','送股','拆分'],txOpen:false,txAsset:'',txType:'买入',txQuantity:'',txPrice:'',txCash:'',txDate:today(),txNote:'',txList:[],importText:'',flowTypes:['存入','取出'],flowType:'存入',flowAmount:'',flowDate:today(),flowNote:'',flowList:[],yearFlows:'0.00',dividendTotal:'0.00',unpricedCount:0,assetFilter:'全部',filterTypes:['全部'].concat(TYPES),accountFilter:'全部',search:'',snapshotCount:0,assetCount:0,txSearch:'',txTypeFilter:'全部',txFilterTypes:['全部','买入','卖出','现金分红','送股','拆分'],txShown:50,flowEditing:'',cloudJoined:false,cloudRole:'',cloudStatus:'云同步尚未连接',cloudCode:'',cloudRevision:0,cloudEnabled:false,cloudBusy:false,cloudInvite:'',},
 onLoad(){let db=wx.getStorageSync(KEY);if(!db||!Array.isArray(db.assets)){db=initial();const old=wx.getStorageSync(OLD)||[];db.assets=old.map(a=>({id:id(),type:'现金',name:a.name,account:'默认账户',currency:'CNY',balance:num(a.amount)}));wx.setStorageSync(KEY,db)}db.transactions=db.transactions||[];db.flows=db.flows||[];db.snapshots=db.snapshots||[];db.accounts=db.accounts&&db.accounts.length?db.accounts:['默认账户'];db.rates=db.rates||{CNY:1};db.rates.CNY=1;this.db=db;this.cloudDirty=!!wx.getStorageSync('family_cloud_pending');this.cloudBusy=false;this.cloudRevision=null;this.cloudEditVersion=0;this.setData({autoMarket:!!db.autoMarket,marketUpdatedAt:db.lastMarketUpdate||'',cloudEnabled:!!db.cloudEnabled});this.refresh();this.cloudStatusCheck()},
 onShow(){if(this.db){this.refresh();if(this.db.autoMarket)this.refreshMarket();if(this.db.cloudEnabled&&!this.cloudDirty)this.cloudDownload(false)}},
 save(){wx.setStorageSync(KEY,this.db);this.refresh();if(this.db.cloudEnabled){this.cloudDirty=true;this.cloudEditVersion++;wx.setStorageSync('family_cloud_pending',true);this.queueCloudSave()}},
 refresh(){const db=this.db;const value=a=>{const raw=this.isHolding(a)?num(a.quantity)*num(a.price):num(a.balance);return raw*(a.currency==='CNY'?1:(num(db.rates[a.currency])||0))};
 const selected=db.assets;const total=selected.reduce((s,a)=>s+value(a),0);const liquidTypes=['银行活期','银行定期','现金','外币'];const cash=selected.filter(a=>liquidTypes.includes(a.type)).reduce((s,a)=>s+value(a),0);const invested=Math.max(0,total-cash);const utilization=total>0?invested/total*100:0;const usdRate=num(db.rates.USD);const year=new Date().getFullYear();const baseline=db.baseline&&db.baseline.year===year?db.baseline:null;
 const flows=(db.flows||[]).filter(f=>f.date>=year+'-01-01'&&f.date<=(year+'-12-31')).reduce((n,f)=>n+(f.type==='存入'?num(f.amount):-num(f.amount)),0);const profit=baseline?total-num(baseline.amount)-num(baseline.external)-flows:null;
 const ydDate=new Date();ydDate.setDate(ydDate.getDate()-1);const yd=ydDate.getFullYear()+'-'+String(ydDate.getMonth()+1).padStart(2,'0')+'-'+String(ydDate.getDate()).padStart(2,'0');const prev=(db.snapshots||[]).find(s=>s.date===yd);const dailyFlow=(db.flows||[]).filter(f=>f.date===today()).reduce((n,f)=>n+(f.type==='存入'?num(f.amount):-num(f.amount)),0);const daily=prev?total-num(prev.amount)-dailyFlow:null;const dailyPct=prev&&num(prev.amount)>0?daily/num(prev.amount)*100:null;
 const search=this.data.search.trim().toLowerCase();let assets=selected.filter(a=>(this.data.assetFilter==='全部'||a.type===this.data.assetFilter)&&(this.data.accountFilter==='全部'||a.account===this.data.accountFilter)).filter(a=>!search||(a.name||'').toLowerCase().includes(search)||(a.code||'').toLowerCase().includes(search)||(a.account||'').toLowerCase().includes(search)).map(a=>({...a,value:value(a),displayValue:fmt(value(a)),gain:this.isHolding(a)?(num(a.price)-num(a.cost))*num(a.quantity)*(a.currency==='CNY'?1:num(db.rates[a.currency])):null,returnRate:this.isHolding(a)&&num(a.cost)>0?(num(a.price)/num(a.cost)-1)*100:null,returnText:this.isHolding(a)&&num(a.cost)>0?((num(a.price)/num(a.cost)-1)*100).toFixed(2)+'%':'--'}));
 if(this.data.sort==='收益率')assets.sort((a,b)=>(b.returnRate===null?-Infinity:b.returnRate)-(a.returnRate===null?-Infinity:a.returnRate));else assets.sort((a,b)=>b.value-a.value);
 const groups={};selected.forEach(a=>{const key=this.data.filter==='类型'?a.type:a.account;groups[key]=(groups[key]||0)+value(a)});
 this.setData({cashBalance:fmt(cash),utilization:utilization.toFixed(2)+'%',utilizationWidth:utilization.toFixed(1),usdCny:usdRate>0?usdRate.toFixed(4):'--',dailyProfit:daily===null?'--':(daily>0?'+':'')+fmt(daily),dailyRate:dailyPct===null?'--':(dailyPct>0?'+':'')+dailyPct.toFixed(2)+'%',dailyTrend:daily===null?'flat':daily>0?'up':daily<0?'down':'flat',dailyNote:daily===null?'缺少昨日快照，暂不能计算今日收益':'今日收益按昨日快照和今日净存入估算',assets,accounts:db.accounts,accountFilters:['全部'].concat(db.accounts),assetCount:db.assets.length,snapshotCount:db.snapshots.length,total:fmt(total),viewTotal:this.data.hidden?'••••••':fmt(total),yearProfit:profit===null?'未设置':(profit>0?'+':'')+fmt(profit),yearTrend:profit===null?'flat':profit>0?'up':profit<0?'down':'flat',yearRate:profit===null?'--':num(baseline.amount)>0?(profit/num(baseline.amount)*100).toFixed(2)+'%':'--',viewYear:this.data.hidden?'••••':profit===null?'未设置':fmt(profit),groups:Object.keys(groups).map(name=>({name,amount:fmt(groups[name]),percent:total>0?(groups[name]/total*100).toFixed(1):'0.0'})).sort((a,b)=>parseFloat(b.percent)-parseFloat(a.percent)),snapshots:db.snapshots.slice().reverse().map(s=>({...s,display:fmt(s.amount)})),rates:Object.keys(db.rates).map(currency=>({currency,rate:db.rates[currency]})),baselineText:baseline?fmt(baseline.amount):'未设置',yearFlows:fmt(flows),dividendTotal:fmt(db.transactions.filter(t=>t.type==='现金分红'&&t.date.startsWith(year+'-')).reduce((n,t)=>n+num(t.amount)*(t.currency==='CNY'?1:num(db.rates[t.currency])),0)),unpricedCount:selected.filter(a=>a.currency!=='CNY'&&!(num(db.rates[a.currency])>0)).length,flowList:(db.flows||[]).slice().reverse().slice(0,30).map(f=>({...f,display:fmt(f.amount)})),txList:db.transactions.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt||'').localeCompare(String(a.createdAt||''))).filter(t=>(this.data.txTypeFilter==='全部'||t.type===this.data.txTypeFilter)&&(!this.data.txSearch||((t.assetName||'')+' '+(t.note||'')+' '+(t.type||'')).toLowerCase().includes(this.data.txSearch.toLowerCase()))).slice(0,this.data.txShown).map(t=>({...t,amountText:fmt(t.amount),label:(db.assets.find(a=>a.id===t.assetId)||{}).name||t.assetName||'已移除资产'}))});
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
 snapshot(silent=false){if(this.db.assets.some(a=>a.currency!=='CNY'&&!(num(this.db.rates[a.currency])>0)))return silent?false:wx.showToast({title:'请先补齐外币汇率',icon:'none'});const amount=this.db.assets.reduce((s,a)=>s+(this.isHolding(a)?num(a.quantity)*num(a.price):num(a.balance))*(a.currency==='CNY'?1:num(this.db.rates[a.currency])),0);const index=this.db.snapshots.findIndex(s=>s.date===today());const record={id:index>=0?this.db.snapshots[index].id:id(),date:today(),amount};if(index>=0)this.db.snapshots[index]=record;else this.db.snapshots.push(record);this.save();if(!silent)wx.showToast({title:'快照已保存'});return true},
 removeSnapshot(e){const key=e.currentTarget.dataset.id;wx.showModal({title:'删除快照',content:'确认删除该日快照吗？',success:r=>{if(r.confirm){this.db.snapshots=this.db.snapshots.filter(x=>x.id!==key);this.save()}}})},
 toggleAutoMarket(e){this.db.autoMarket=!!e.detail.value;this.setData({autoMarket:this.db.autoMarket});this.save();if(this.db.autoMarket)this.refreshMarket()},
 refreshMarket(){
  if(this.data.marketBusy)return;
  const holdings=this.db.assets.filter(a=>this.isHolding(a)&&(a.code||a.type==='实物黄金')&&['A股','港股','美股','ETF','黄金ETF','加密货币','实物黄金'].includes(a.type)).map(a=>({id:a.id,type:a.type,code:a.code}));
  if(!holdings.length){this.setData({marketStatus:'没有可查询的资产代码；请在资产编辑中填写代码'});return}
  if(!wx.cloud||!wx.cloud.callFunction){this.setData({marketStatus:'当前微信基础库不支持云函数'});return}
  this.setData({marketBusy:true,marketStatus:'正在通过微信云开发查询行情…'});
  wx.cloud.callFunction({name:'quotes',data:{assets:holdings},success:r=>{
   const result=r.result||{};if(!result.ok){this.setData({marketStatus:'云函数未返回有效行情，原价格保持不变'});return}
   let count=0;const quotes=result.quotes||{};const missingAssets=[];
   for(const asset of this.db.assets){const quote=quotes[asset.id];if(!quote||!(Number(quote.price)>0)){if(['美股','港股'].includes(asset.type)&&asset.code)missingAssets.push(asset.code);continue;}
    if(asset.currency!==quote.currency){if(asset.type==='美股'||asset.type==='港股'||asset.type==='实物黄金'||!asset.quoteUpdatedAt){asset.currency=quote.currency}else{continue}}
    asset.price=Number(quote.price);if(quote.name&&!asset.name)asset.name=quote.name;asset.quoteUpdatedAt=quote.fetchedAt;count++;
   }
   let rateCount=0;if(result.rates){for(const [currency,rate] of Object.entries(result.rates)){if(currency==='CNY')continue;if(Number(rate)>0){this.db.rates[currency]=Number(rate);rateCount++}}}
   if(count||rateCount){this.db.lastMarketUpdate=result.fetchedAt;this.save()}const snapped=this.snapshot(true);
   this.setData({marketStatus:'更新报价 '+count+' 项、参考汇率 '+rateCount+' 项'+(result.errors&&result.errors.length?'；'+result.errors.join('；'):'')+(missingAssets.length?'；未获取：'+missingAssets.slice(0,8).join('、'):'')+(snapped?'；今日资产快照已保存':'；快照未保存，请检查外币汇率')+'。报价可能延迟。',marketUpdatedAt:result.fetchedAt||''});this.refresh();
  },fail:e=>{this.setData({marketStatus:'云函数调用失败：请确认 quotes 已部署至云环境；原价格保持不变'})},complete:()=>this.setData({marketBusy:false})});
 },

 cloudCall(action,extra={}){return new Promise((resolve,reject)=>wx.cloud.callFunction({name:'family-sync',data:{action,...extra},success:r=>resolve(r.result||{}),fail:reject}))},
 async cloudStatusCheck(){if(!wx.cloud)return;try{const r=await this.cloudCall('status');if(!r.ok)throw Error(r.message);this.cloudRevision=r.revision;this.setData({cloudJoined:true,cloudRevision:r.revision,cloudStatus:r.hasData?'云端已连接 · 版本 '+r.revision:'云端尚无数据，请在旧手机首次上传'});if(r.hasData&&!this.cloudDirty&&(this.db.cloudEnabled||(!this.db.assets.length&&!this.db.transactions.length&&!this.db.snapshots.length&&!(this.db.flows||[]).length)))this.cloudDownload(false)}catch(e){this.setData({cloudStatus:'云函数连接失败：'+e.message})}},
 cloudEnable(){wx.showModal({title:'首次上传',content:'请先复制JSON备份！只能在保存原始资产的旧手机首次上传，新手机请先下载。确认吗？',success:async r=>{if(!r.confirm)return;try{const remote=await this.cloudCall('read');if(!remote.ok)throw Error(remote.message);this.cloudRevision=remote.revision;if(remote.data){this.setData({cloudStatus:'云端已有数据，请先备份本机，再从云端下载，禁止直接覆盖'});return}this.db.cloudEnabled=true;wx.setStorageSync(KEY,this.db);this.setData({cloudEnabled:true});this.cloudDirty=true;this.cloudEditVersion++;wx.setStorageSync('family_cloud_pending',true);this.cloudUpload()}catch(e){this.setData({cloudStatus:'读取云端失败：'+e.message})}}})},
 cloudDisable(){this.db.cloudEnabled=false;wx.setStorageSync(KEY,this.db);this.setData({cloudEnabled:false,cloudStatus:'已暂停云同步'});this.cloudDirty=false;wx.removeStorageSync('family_cloud_pending')},
 queueCloudSave(){clearTimeout(this.cloudTimer);this.cloudTimer=setTimeout(()=>this.cloudUpload(),1800)},
 async cloudUpload(){if(!this.db.cloudEnabled||this.cloudBusy)return;if(this.cloudRevision===null){await this.cloudStatusCheck();if(this.cloudRevision===null)return}this.cloudBusy=true;this.setData({cloudBusy:true,cloudStatus:'正在上传…'});const rev=this.cloudRevision,edit=this.cloudEditVersion,payload=JSON.parse(JSON.stringify(this.db));delete payload.cloudEnabled;try{const r=await this.cloudCall('write',{revision:rev,data:payload});if(!r.ok){this.cloudDirty=true;this.setData({cloudStatus:'上传失败：'+r.message});if(r.code==='CONFLICT'){this.db.cloudEnabled=false;wx.setStorageSync(KEY,this.db);this.setData({cloudEnabled:false,cloudStatus:'其他设备已更新，暂停上传；请备份本机后下载云端'})}return}this.cloudRevision=r.revision;this.cloudDirty=edit!==this.cloudEditVersion;if(!this.cloudDirty)wx.removeStorageSync('family_cloud_pending');this.setData({cloudRevision:r.revision,cloudStatus:this.cloudDirty?'有修改待上传':'云端已保存 · 版本 '+r.revision});if(this.cloudDirty)this.queueCloudSave()}catch(e){this.cloudDirty=true;this.setData({cloudStatus:'网络异常，保留本机数据'})}finally{this.cloudBusy=false;this.setData({cloudBusy:false})}},
 cloudDownload(confirm=true,overwrite=false){if(this.cloudBusy)return;if(confirm){wx.showModal({title:'从云端恢复',content:'将覆盖当前设备资产！请先复制JSON备份。确定吗？',success:r=>{if(r.confirm)this.cloudDownload(false,true)}});return}if(this.cloudDirty&&!overwrite){this.setData({cloudStatus:'本机有待上传修改，先备份后手动下载'});return}this.cloudBusy=true;this.setData({cloudBusy:true});this.cloudCall('read').then(r=>{if(!r.ok)throw Error(r.message);this.cloudRevision=r.revision;if(!r.data){this.setData({cloudStatus:'云端没有资产，请在旧手机首次上传',cloudRevision:r.revision});return}const d=r.data;if(!Array.isArray(d.assets)||!Array.isArray(d.accounts)||!Array.isArray(d.snapshots)||!d.rates)throw Error('云端格式错误');d.cloudEnabled=true;wx.setStorageSync(KEY,d);this.db=d;this.cloudDirty=false;wx.removeStorageSync('family_cloud_pending');this.setData({cloudEnabled:true,cloudRevision:r.revision,cloudStatus:'云端同步成功 · 版本 '+r.revision,autoMarket:!!d.autoMarket});this.refresh()}).catch(e=>this.setData({cloudStatus:'下载失败：'+e.message})).finally(()=>{this.cloudBusy=false;this.setData({cloudBusy:false})})},
 cloudRetry(){if(!this.db.cloudEnabled)return this.setData({cloudStatus:'请先上传旧手机资产或下载云端数据'});this.cloudUpload()},
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
  this.db.transactions.push({id:id(),before:{quantity:oldQ,cost:oldCost},after:{quantity:a.quantity,cost:a.cost},assetId:a.id,assetName:a.name,type,quantity:type==='现金分红'?0:q,price:p,amount:type==='现金分红'?cash:q*p,currency:a.currency,date:this.data.txDate,note:this.data.txNote,createdAt:new Date().toISOString()});
  this.setData({txOpen:false});this.save();wx.showToast({title:'交易已记录'});
 },
 txSearchChange(e){this.setData({txSearch:e.detail.value,txShown:50});this.refresh()},
 txFilterChange(e){this.setData({txTypeFilter:this.data.txFilterTypes[Number(e.detail.value)],txShown:50});this.refresh()},
 moreTransactions(){this.setData({txShown:this.data.txShown+50});this.refresh()},
 removeTransaction(e){
  const key=e.currentTarget.dataset.id,t=this.db.transactions.find(x=>x.id===key);if(!t)return;
  const asset=this.db.assets.find(a=>a.id===t.assetId);
  const changesHoldings=t.type!=='现金分红';
  if(changesHoldings&&(!asset||!t.before||!t.after||Math.abs(num(asset.quantity)-num(t.after.quantity))>0.000001||Math.abs(num(asset.cost)-num(t.after.cost))>0.000001||this.db.transactions.some(x=>x.assetId===t.assetId&&x.id!==t.id&&x.createdAt>t.createdAt))){
   return wx.showModal({title:'无法安全撤销',content:'这笔交易之后持仓已变化，或是旧版交易记录。为避免错误修改持仓，请先手动核对资产，暂不允许删除这条交易。',showCancel:false});
  }
  wx.showModal({title:'撤销交易',content:'将删除这条交易记录'+(changesHoldings?'，并恢复交易前的持仓和成本。':'。')+'确认吗？',success:r=>{if(!r.confirm)return;if(changesHoldings){asset.quantity=t.before.quantity;asset.cost=t.before.cost}this.db.transactions=this.db.transactions.filter(x=>x.id!==key);this.save()}});
 },
 editFlow(e){const f=(this.db.flows||[]).find(x=>x.id===e.currentTarget.dataset.id);if(f)this.setData({flowEditing:f.id,flowType:f.type,flowAmount:String(f.amount),flowDate:f.date,flowNote:f.note||''})},
 cancelFlowEdit(){this.setData({flowEditing:'',flowAmount:'',flowNote:'',flowDate:today(),flowType:'存入'})},
 flowField(e){this.setData({[e.currentTarget.dataset.field]:e.detail.value})},
 flowTypeChange(e){this.setData({flowType:['存入','取出'][Number(e.detail.value)]})},
 addFlow(){
  const amount=Number(this.data.flowAmount),date=this.data.flowDate;
  if(!(amount>0)||!Number.isFinite(amount)||!validDate(date))return wx.showToast({title:'请检查日期和金额',icon:'none'});
  this.db.flows=this.db.flows||[];
  const entry={id:this.data.flowEditing||id(),date,type:this.data.flowType,amount,note:this.data.flowNote};const pos=this.db.flows.findIndex(f=>f.id===entry.id);if(pos>=0)this.db.flows[pos]=entry;else this.db.flows.push(entry);
  this.setData({flowAmount:'',flowNote:'',flowEditing:'',flowDate:today()});this.save();wx.showToast({title:'资金变动已记录'});
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
  if(db.assets.some(a=>!a||typeof a.name!=='string'||!TYPES.includes(a.type)||!CURRENCIES.includes(a.currency)||!db.accounts.includes(a.account)||!Number.isFinite(Number(a.quantity||0))||!Number.isFinite(Number(a.price||0))||!Number.isFinite(Number(a.balance||0))))return wx.showToast({title:'资产数据校验失败',icon:'none'});
  if(db.accounts.length===0||db.accounts.length>500||db.snapshots.length>20000||!Array.isArray(db.transactions||[])||!Array.isArray(db.flows||[])||(db.transactions||[]).length>100000||(db.flows||[]).length>100000||Object.keys(db.rates).some(k=>!CURRENCIES.includes(k)||!Number.isFinite(Number(db.rates[k]))||Number(db.rates[k])<0))return wx.showToast({title:'备份校验失败',icon:'none'});
  wx.showModal({title:'恢复本地备份',content:'将覆盖本机所有资产、账户和快照。请先导出当前数据！确认恢复吗？',success:r=>{if(!r.confirm)return;db.transactions=Array.isArray(db.transactions)?db.transactions:[];db.flows=Array.isArray(db.flows)?db.flows:[];db.rates.CNY=1;const previous=this.db;try{wx.setStorageSync(KEY,db);this.db=db;this.setData({importText:'',autoMarket:!!db.autoMarket});this.refresh()}catch(e){this.db=previous;wx.showModal({title:'恢复失败',content:'写入本地存储失败，原数据未被主动清除。',showCancel:false});return}wx.showToast({title:'恢复成功'})}});
 },
 exportData(){const content=JSON.stringify({version:2,exportedAt:new Date().toISOString(),data:this.db});wx.setClipboardData({data:content,success:()=>wx.showModal({title:'备份已复制',content:'JSON 数据已复制到剪贴板，请粘贴到安全位置保存。恢复前请保留当前备份，以免误覆盖。',showCancel:false})})}
});