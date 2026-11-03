# 行情云函数（待部署）

复用旧版 personal-data 的腾讯行情、新浪数字资产及中国外汇交易中心汇率来源。已提交代码，**尚未部署到微信云环境，也尚未接入首页自动刷新**。

## 部署
1. 微信开发者工具中开通云开发并设置 app.js 的 wx.cloud.init({env:'你的环境ID'})。
2. 将 project.config.json 的 cloudfunctionRoot 配为 cloudfunctions/（若已有配置请合并）。
3. 右键 cloudfunctions/market，选择上传并部署（云端安装依赖）。
4. 调用示例：wx.cloud.callFunction({name:'market',data:{action:'quotes',symbols:['600519.SH','00700.HK','AAPL.US','BTC.CRYPTO']}})。
5. 汇率：wx.cloud.callFunction({name:'market',data:{action:'fx'}})。

## 约定
行情价格保留原币种；BTC.CRYPTO 返回 USD，不在云函数内做人民币换算。前端须使用实时 USD/CNY 汇率估值。网络失败不应覆盖旧价格，界面应标记旧报价和更新时间。A股代码后缀 .SH/.SZ，港股 .HK，美股 .US，数字资产 .CRYPTO。

注意：上述数据源属于第三方接口，稳定性、访问限制和使用条款需在实际部署环境验证。云函数部署后也应进行实盘行情与汇率核对。
