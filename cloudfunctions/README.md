# 微信云函数部署说明

云环境 ID：amiao-d1gyn5a6433de3cd1

本项目的 GitHub Actions 使用 miniprogram-ci 上传**小程序代码**，不会自动部署云函数。
请在微信云开发控制台创建 Node.js 云函数 `quotes`，上传 `cloudfunctions/quotes` 目录内容并安装依赖。
云函数需要访问公网 HTTPS（腾讯行情、CoinGecko、Frankfurter），若云环境限制出网，请启用对应网络能力。
不需要在小程序端配置第三方 request 合法域名；行情通过 `wx.cloud.callFunction` 获取。
行情是参考报价，可能延迟、限流或因第三方变更而不可用。失败时客户端保留原价格。
金融资产仍只存在手机本地，云函数仅收到资产类型、代码及随机本地资产 ID，不上传持仓数量、成本和账户。
