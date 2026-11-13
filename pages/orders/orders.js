const menuStore = require('../../utils/menu-store.js');
const { getOrdersApi } = require('../../utils/data/index.js');
const { createLocalCartStore } = require('../../utils/cart-store.js');
const { formatPrice, formatDateTime } = require('../../utils/format.js');

const ordersApi = getOrdersApi();
const cartStore = createLocalCartStore();

Page({
    data: {
        orders: [],
        viewState: 'loading',
    },

    onLoad(options) {
        if (options && options.created === '1') {
            wx.showToast({ title: '支付成功，门店已接单', icon: 'success' });
        }
    },

    onShow() {
        this.refresh();
    },

    refresh() {
        const page = this;
        ordersApi.list().then(function (result) {
            if (result.error) {
                page.setData({ viewState: 'error' });
                return;
            }
            const orders = result.data.map(function (order) {
                const items = order.items.map(function (item) {
                    return {
                        key: item.key,
                        name: item.name,
                        qty: item.qty,
                        specText: item.specText,
                        note: item.note,
                        unitPrice: item.unitPrice,
                        priceText: formatPrice(item.unitPrice * item.qty),
                    };
                });
                return {
                    id: order.id,
                    no: order.no,
                    timeText: formatDateTime(order.createdAt),
                    itemCount: order.itemCount,
                    pickupName: order.pickupName,
                    note: order.note,
                    totalText: formatPrice(order.total),
                    discountText: order.discount > 0 ? '-' + formatPrice(order.discount) : '',
                    status: order.status,
                    statusText: order.statusText,
                    statusHint: order.statusHint,
                    canPay: order.canPay,
                    canCancel: order.canCancel,
                    items: items,
                };
            });
            page.setData({
                orders: orders,
                viewState: orders.length === 0 ? 'empty' : 'ready',
            });
        });
    },

    handlePay(event) {
        const orderId = event.currentTarget.dataset.id;
        wx.navigateTo({ url: '/pages/pay/pay?orderId=' + orderId });
    },

    handleCancel(event) {
        const orderId = event.currentTarget.dataset.id;
        const page = this;
        wx.showModal({
            title: '取消订单',
            content: '取消后这笔订单不会再制作，确定吗？',
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

    // 再来一单：把历史订单里的商品按原规格重新放回购物车。
    handleReorder(event) {
        const orderId = event.currentTarget.dataset.id;
        const orders = this.data.orders;
        let target = null;
        for (let i = 0; i < orders.length; i += 1) {
            if (orders[i].id === orderId) {
                target = orders[i];
                break;
            }
        }
        if (!target) {
            return;
        }

        let added = 0;
        for (let i = 0; i < target.items.length; i += 1) {
            const item = target.items[i];
            const product = menuStore.find(item.productId);
            if (!product || product.offline) {
                continue;
            }
            const result = cartStore.add({
                productId: product.id,
                name: product.name,
                short: product.short,
                gradient: product.gradient,
                specText: item.specText,
                note: item.note,
                unitPrice: item.unitPrice,
                qty: item.qty,
            });
            if (!result.error) {
                added += 1;
            }
        }

        if (added === 0) {
            wx.showToast({ title: '这批商品已售罄', icon: 'none' });
            return;
        }
        wx.showToast({ title: '已放回购物车', icon: 'success' });
        setTimeout(function () {
            wx.navigateTo({ url: '/pages/cart/cart' });
        }, 600);
    },

    goAdmin() {
        wx.navigateTo({ url: '/pages/admin/admin' });
    },

    goAbout() {
        wx.navigateTo({ url: '/pages/about/about' });
    },

    goMenu() {
        wx.reLaunch({ url: '/pages/index/index' });
    },
});
