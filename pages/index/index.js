const KEY = 'asset_demo_v1';
Page({
  data: { assets: [], total: '0.00', name: '', amount: '' },
  onLoad() { this.refresh(); },
  refresh() {
    const assets = wx.getStorageSync(KEY) || [];
    const total = assets.reduce((sum, item) => sum + Number(item.amount), 0);
    this.setData({ assets, total: total.toFixed(2) });
  },
  onName(e) { this.setData({ name: e.detail.value }); },
  onAmount(e) { this.setData({ amount: e.detail.value }); },
  addAsset() {
    const name = this.data.name.trim();
    const amount = Number(this.data.amount);
    if (!name || !Number.isFinite(amount) || amount <= 0) {
      wx.showToast({ title: '请输入名称和正数金额', icon: 'none' }); return;
    }
    const assets = wx.getStorageSync(KEY) || [];
    assets.push({ id: String(Date.now()) + Math.random().toString(36).slice(2), name, category: '手动录入', amount: amount.toFixed(2) });
    wx.setStorageSync(KEY, assets);
    this.setData({ name: '', amount: '' });
    this.refresh();
  },
  removeAsset(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({ title: '删除资产', content: '确定删除这条记录？', success: res => {
      if (!res.confirm) return;
      const assets = (wx.getStorageSync(KEY) || []).filter(item => item.id !== id);
      wx.setStorageSync(KEY, assets); this.refresh();
    }});
  }
});
