const menuStore = require('../../utils/menu-store.js');
const { createLocalCartStore } = require('../../utils/cart-store.js');
const { createLocalOrderStore } = require('../../utils/order-store.js');
const { formatPrice } = require('../../utils/format.js');
const userStore = require('../../utils/user-store.js');
const config = require('../../utils/app-config.js');

const cartStore = createLocalCartStore();
const orderStore = createLocalOrderStore();

Page({
    data: {
        lines: [],
        itemCount: 0,
        subtotalText: '¥0',
        discountText: '¥0',
        totalText: '¥0',
        discountHint: '',
        pickupTypes: menuStore.PICKUP_TYPES,
        pickupIndex: 0,
        note: '',
        viewState: 'loading',
        submitting: false,
    },

    onShow() {
        this.refresh();
    },

    refresh() {
        const result = cartStore.list();
        if (result.error) {
            this.setData({ viewState: 'error' });
            return;
        }
        const raw = result.data;
        if (raw.length === 0) {
            this.setData({ lines: [], itemCount: 0, viewState: 'empty' });
            return;
        }
        let subtotal = 0;
        let count = 0;
        const lines = raw.map(function (line) {
            subtotal += line.unitPrice * line.qty;
            count += line.qty;
            return {
                id: line.id,
                productId: line.productId,
                name: line.name,
                short: line.short,
                gradient: line.gradient,
                specText: line.specText,
                note: line.note,
                qty: line.qty,
                unitPrice: line.unitPrice,
                unitPriceText: formatPrice(line.unitPrice),
                lineTotalText: formatPrice(line.unitPrice * line.qty),
            };
        });

        const threshold = config.promotion.threshold;
        const amount = config.promotion.amount;
        let discount = 0;
        if (subtotal >= threshold) {
            discount = amount;
        }
        const gap = threshold - subtotal;
        const hint = discount > 0
            ? '已享满 ' + threshold + ' 减 ' + amount
            : '再买 ' + formatPrice(gap) + ' 可减 ' + amount;

        this.setData({
            lines: lines,
            itemCount: count,
            subtotalText: formatPrice(subtotal),
            discountText: discount > 0 ? '-' + formatPrice(discount) : '¥0',
            totalText: formatPrice(subtotal - discount),
            discountHint: hint,
            viewState: 'ready',
        });
    },

    handleIncrease(event) {
        const lineId = event.currentTarget.dataset.id;
        const line = this.findLine(lineId);
        if (!line) {
            return;
        }
        cartStore.updateQty(lineId, line.qty + 1);
        this.refresh();
    },

    handleDecrease(event) {
        const lineId = event.currentTarget.dataset.id;
        const line = this.findLine(lineId);
        if (!line) {
            return;
        }
        if (line.qty <= 1) {
            this.confirmRemove(lineId, line.name);
            return;
        }
        cartStore.updateQty(lineId, line.qty - 1);
        this.refresh();
    },

    handleRemove(event) {
        const lineId = event.currentTarget.dataset.id;
        const line = this.findLine(lineId);
        if (!line) {
            return;
        }
        this.confirmRemove(lineId, line.name);
    },

    findLine(lineId) {
        const lines = this.data.lines;
        for (let i = 0; i < lines.length; i += 1) {
            if (lines[i].id === lineId) {
                return lines[i];
            }
        }
        return null;
    },

    confirmRemove(lineId, name) {
        const page = this;
        wx.showModal({
            title: '移出购物车',
            content: '确定不喝「' + name + '」了吗？',
            confirmText: '移出',
            confirmColor: '#b4453c',
            success(result) {
                if (!result.confirm) {
                    return;
                }
                cartStore.remove(lineId);
                page.refresh();
            },
        });
    },

    handlePickupTap(event) {
        this.setData({ pickupIndex: Number(event.currentTarget.dataset.index) });
    },

    handleNoteInput(event) {
        this.setData({ note: event.detail.value });
    },

    // 提交后先落一张「待支付」订单，再跳支付页；支付成功才会流转到「已下单」。
    handleSubmit() {
        if (this.data.submitting || this.data.lines.length === 0) {
            return;
        }
        this.setData({ submitting: true });

        const user = userStore.getIdentity();
        const lines = this.data.lines;
        let subtotal = 0;
        let count = 0;
        const items = lines.map(function (line) {
            subtotal += line.unitPrice * line.qty;
            count += line.qty;
            return {
                productId: line.productId,
                name: line.name,
                specText: line.specText,
                note: line.note,
                unitPrice: line.unitPrice,
                qty: line.qty,
            };
        });

        const discount = subtotal >= config.promotion.threshold ? config.promotion.amount : 0;
        const created = orderStore.create({
            items: items,
            itemCount: count,
            subtotal: subtotal,
            discount: discount,
            total: subtotal - discount,
            pickupName: this.data.pickupTypes[this.data.pickupIndex].name,
            note: this.data.note.trim(),
            userId: user.id,
        });

        if (created.error) {
            this.setData({ submitting: false });
            wx.showToast({ title: '下单失败，请重试', icon: 'none' });
            return;
        }

        cartStore.clear();
        this.setData({ submitting: false });
        wx.redirectTo({ url: '/pages/pay/pay?orderId=' + created.data.id });
    },

    goMenu() {
        wx.reLaunch({ url: '/pages/index/index' });
    },
});
