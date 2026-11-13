const config = require('../../utils/app-config.js');
const { getOrdersApi } = require('../../utils/data/index.js');
const { createLocalCartStore } = require('../../utils/cart-store.js');
const userStore = require('../../utils/user-store.js');
const menuStore = require('../../utils/menu-store.js');

const ordersApi = getOrdersApi();
const cartStore = createLocalCartStore();

Page({
    data: {
        appName: '拾光咖啡点单',
        version: '1.0.0',
        shopName: '',
        shopAddress: '',
        shopPhone: '',
        mockPay: true,
        storageInfo: [],
        isRemote: false,
    },

    onLoad() {
        this.setData({
            shopName: config.shop.name,
            shopAddress: config.shop.address,
            shopPhone: config.shop.phone,
            mockPay: config.payment.mock,
            isRemote: ordersApi.isRemote === true,
        });
    },

    onShow() {
        this.refreshStorage();
    },

    refreshStorage() {
        const page = this;
        const user = userStore.getIdentity();
        const cart = cartStore.list().data || [];
        const products = menuStore.listAll();
        let offlineCount = 0;
        for (let i = 0; i < products.length; i += 1) {
            if (products[i].offline) {
                offlineCount += 1;
            }
        }
        ordersApi.list().then(function (result) {
            const orders = result.data || [];
            const rows = [
                { key: 'coffee_user_v1', name: '顾客身份（本地生成的模拟 id）', value: user.id },
                { key: 'coffee_cart_v1', name: '购物车行数', value: cart.length + ' 行' },
            ];
            if (ordersApi.isRemote) {
                rows.push({
                    key: 'orders 表 · 云端',
                    name: '订单数量',
                    value: result.error ? '读取失败' : orders.length + ' 笔',
                });
            } else {
                rows.push({
                    key: 'coffee_orders_v1',
                    name: '订单数量',
                    value: orders.length + ' 笔',
                });
            }
            rows.push({
                key: 'coffee_menu_overrides_v1',
                name: '菜单覆盖（售罄商品）',
                value: offlineCount + ' 个',
            });
            page.setData({ storageInfo: rows });
        });
    },

    handleClearAll() {
        const page = this;
        wx.showModal({
            title: '清除全部本地数据',
            content: '顾客身份、购物车、订单、菜单改动全部删除，相当于换了一台新手机。',
            confirmText: '全部清除',
            confirmColor: '#b4453c',
            success(result) {
                if (!result.confirm) {
                    return;
                }
                wx.clearStorageSync();
                page.refreshStorage();
                wx.showToast({ title: '已清除', icon: 'success' });
            },
        });
    },
});
