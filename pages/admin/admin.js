const { getOrdersApi } = require('../../utils/data/index.js');
const menuStore = require('../../utils/menu-store.js');
const { formatPrice, formatDateTime } = require('../../utils/format.js');
const config = require('../../utils/app-config.js');

const ordersApi = getOrdersApi();

Page({
    data: {
        authorized: false,
        passInput: '',
        tabs: [
            { id: 'placed', name: '待接单' },
            { id: 'making', name: '制作中' },
            { id: 'ready', name: '可取餐' },
            { id: 'all', name: '全部' },
        ],
        activeTab: 'placed',
        orders: [],
        stats: {
            todayCount: 0,
            todayRevenueText: '¥0',
            pendingCount: 0,
            makingCount: 0,
        },
        menu: [],
        viewState: 'loading',
        // 云端模式下才有意义：告诉店长这是自动刷新，不是静止画面
        isRemote: false,
        pollSeconds: Math.round((config.orderPollInterval || 0) / 1000),
    },

    onLoad() {
        // 演示用的前端口令，输入正确才进入店长端。
        // 真实项目里这必须是服务端校验的角色权限，不能只靠前端判断。
        this.setData({ isRemote: ordersApi.isRemote === true });
    },

    onShow() {
        if (this.data.authorized) {
            this.refresh();
            this.startPolling();
        }
    },

    // 页面切到后台就停掉定时器，别在用户看不见的时候一直发请求
    onHide() {
        this.stopPolling();
    },

    onUnload() {
        this.stopPolling();
    },

    // 轮询：每隔几秒重新拉一次订单。土办法，但最容易看懂，
    // 也正好暴露它的缺点——不做这件事，店长端就不会自己出现新单。
    startPolling() {
        const interval = config.orderPollInterval;
        if (!interval || interval <= 0) {
            return;
        }
        const page = this;
        this.stopPolling();
        this.pollTimer = setInterval(function () {
            page.refresh();
        }, interval);
    },

    stopPolling() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    },

    handlePassInput(event) {
        this.setData({ passInput: event.detail.value });
    },

    handlePassSubmit() {
        if (this.data.passInput !== config.adminPasscode) {
            wx.showToast({ title: '口令不对', icon: 'none' });
            return;
        }
        this.setData({ authorized: true });
        this.refresh();
        this.startPolling();
    },

    refresh() {
        const page = this;
        const tab = this.data.activeTab;
        Promise.all([ordersApi.listByStatus(tab), ordersApi.stats()]).then(function (results) {
            const listResult = results[0];
            const statsResult = results[1];
            if (listResult.error || statsResult.error) {
                page.setData({ viewState: 'error' });
                return;
            }

            const orders = (listResult.data || []).map(function (order) {
                const items = order.items.map(function (item) {
                    return {
                        key: item.key,
                        name: item.name,
                        qty: item.qty,
                        specText: item.specText,
                        note: item.note,
                    };
                });
                return {
                    id: order.id,
                    no: order.no,
                    timeText: formatDateTime(order.createdAt),
                    status: order.status,
                    statusText: order.statusText,
                    pickupName: order.pickupName,
                    note: order.note,
                    itemCount: order.itemCount,
                    totalText: formatPrice(order.total),
                    items: items,
                    canStart: order.canStart,
                    canReady: order.canReady,
                    canFinish: order.canFinish,
                    canCancel: order.canCancel,
                };
            });

            const menu = menuStore.listAll().map(function (product) {
                return {
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    priceText: formatPrice(product.price),
                    offline: product.offline,
                };
            });

            const stats = statsResult.data;
            page.setData({
                orders: orders,
                menu: menu,
                stats: {
                    todayCount: stats.todayCount,
                    todayRevenueText: formatPrice(stats.todayRevenue),
                    pendingCount: stats.pendingCount,
                    makingCount: stats.makingCount,
                },
                viewState: orders.length === 0 ? 'empty' : 'ready',
            });
        });
    },

    handleTabTap(event) {
        this.setData({ activeTab: event.currentTarget.dataset.id });
        this.refresh();
    },

    // 订单状态推进：接单 -> 制作 -> 完成，或取消
    handleOrderAction(event) {
        const orderId = event.currentTarget.dataset.id;
        const next = event.currentTarget.dataset.next;
        const page = this;
        ordersApi.updateStatus(orderId, next).then(function (result) {
            if (result.error) {
                wx.showToast({ title: '操作失败：' + result.error, icon: 'none' });
                return;
            }
            page.refresh();
        });
    },

    handleCancelOrder(event) {
        const orderId = event.currentTarget.dataset.id;
        const page = this;
        wx.showModal({
            title: '取消订单',
            content: '取消后需要告知顾客，确定吗？',
            confirmText: '取消订单',
            confirmColor: '#b4453c',
            success(result) {
                if (!result.confirm) {
                    return;
                }
                ordersApi.updateStatus(orderId, 'cancelled').then(function () {
                    page.refresh();
                });
            },
        });
    },

    // 改价：失焦时保存，非法值直接回滚到原价
    handlePriceBlur(event) {
        const productId = event.currentTarget.dataset.id;
        const value = Number(event.detail.value);
        if (!(value >= 0) || Math.round(value * 100) / 100 !== value) {
            wx.showToast({ title: '请输入有效价格', icon: 'none' });
            this.refresh();
            return;
        }
        const result = menuStore.setPrice(productId, value);
        if (result.error) {
            wx.showToast({ title: '保存失败', icon: 'none' });
            return;
        }
        this.refresh();
        wx.showToast({ title: '价格已更新', icon: 'success' });
    },

    handleOfflineChange(event) {
        const productId = event.currentTarget.dataset.id;
        const offline = event.detail.value;
        menuStore.setOffline(productId, offline);
        this.refresh();
    },

    handleResetMenu() {
        const page = this;
        wx.showModal({
            title: '恢复默认菜单',
            content: '改过的价格和上下架状态都会还原。',
            success(result) {
                if (!result.confirm) {
                    return;
                }
                menuStore.resetAll();
                page.refresh();
                wx.showToast({ title: '已恢复默认', icon: 'success' });
            },
        });
    },

    handleClearOrders() {
        const page = this;
        const isRemote = this.data.isRemote;
        wx.showModal({
            title: '清空订单记录',
            content: isRemote
                ? '云端订单是所有人共享的，这一步会删掉全部顾客的订单，不可恢复。'
                : '所有本地订单都会被删除，不可恢复。',
            confirmText: '清空',
            confirmColor: '#b4453c',
            success(result) {
                if (!result.confirm) {
                    return;
                }
                ordersApi.clear().then(function () {
                    page.refresh();
                    wx.showToast({ title: '已清空', icon: 'success' });
                });
            },
        });
    },

    goMenu() {
        wx.reLaunch({ url: '/pages/index/index' });
    },
});
