const { getOrdersApi } = require('../../utils/data/index.js');
const { formatPrice } = require('../../utils/format.js');
const config = require('../../utils/app-config.js');

const ordersApi = getOrdersApi();

Page({
    data: {
        orderId: '',
        order: null,
        items: [],
        totalText: '¥0',
        subtotalText: '¥0',
        discountText: '',
        mockPay: true,
        paying: false,
        viewState: 'loading',
    },

    onLoad(options) {
        const orderId = options.orderId || '';
        const page = this;
        ordersApi.get(orderId).then(function (result) {
            if (result.error || !result.data) {
                page.setData({ viewState: 'error' });
                return;
            }
            const order = result.data;
            const items = order.items.map(function (item) {
                return {
                    key: item.key,
                    name: item.name,
                    qty: item.qty,
                    specText: item.specText,
                    priceText: formatPrice(item.unitPrice * item.qty),
                };
            });
            page.setData({
                orderId: order.id,
                order: order,
                items: items,
                totalText: formatPrice(order.total),
                subtotalText: formatPrice(order.subtotal),
                discountText: order.discount > 0 ? '-' + formatPrice(order.discount) : '',
                mockPay: config.payment.mock,
                // 已经不是待支付状态，说明重复进入，直接提示
                viewState: order.status === 'unpaid' ? 'ready' : 'already',
            });
        });
    },

    handlePay() {
        if (this.data.paying) {
            return;
        }
        const page = this;
        const order = this.data.order;

        // ---- 真实支付接入位置 ----
        // 生产环境应先由后端下单拿到支付参数（timeStamp / nonceStr / package / signType / paySign），再调用：
        // wx.requestPayment({
        //     timeStamp: payParams.timeStamp,
        //     nonceStr: payParams.nonceStr,
        //     package: payParams.package,
        //     signType: payParams.signType,
        //     paySign: payParams.paySign,
        //     success() { page.finishPay(); },
        //     fail() { wx.showToast({ title: '支付未完成', icon: 'none' }); },
        // });
        // 支付结果必须以服务端回调为准，不要只信前端 success。
        // 详见 docs/cloud-migration.md。

        if (!config.payment.mock) {
            wx.showToast({ title: '未配置真实支付', icon: 'none' });
            return;
        }

        this.setData({ paying: true });
        // 模拟支付：延迟 800ms 后把订单从「待支付」推进到「已下单」
        setTimeout(function () {
            ordersApi.updateStatus(order.id, 'placed').then(function (updated) {
                if (updated.error) {
                    page.setData({ paying: false });
                    wx.showModal({
                        title: '支付失败',
                        content: '订单状态异常，请回到订单页重试。',
                        showCancel: false,
                    });
                    return;
                }
                page.setData({ paying: false });
                wx.redirectTo({ url: '/pages/orders/orders?created=1' });
            });
        }, 800);
    },

    // 放弃支付：订单保留为待支付，用户之后还能在订单页继续付
    handleCancel() {
        wx.redirectTo({ url: '/pages/orders/orders' });
    },

    goOrders() {
        wx.redirectTo({ url: '/pages/orders/orders' });
    },
});
