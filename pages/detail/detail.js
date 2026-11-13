const menuStore = require('../../utils/menu-store.js');
const { createLocalCartStore } = require('../../utils/cart-store.js');
const { formatPrice } = require('../../utils/format.js');

const cartStore = createLocalCartStore();

Page({
    data: {
        product: null,
        drinkable: true,
        offline: false,
        sizes: menuStore.SIZES,
        temps: menuStore.TEMPERATURES,
        sugars: menuStore.SUGARS,
        extras: [],
        sizeIndex: 0,
        tempIndex: 0,
        sugarIndex: 0,
        qty: 1,
        note: '',
        basePriceText: '¥0',
        unitPriceText: '¥0',
        totalText: '¥0',
        viewState: 'loading',
    },

    onLoad(options) {
        const product = menuStore.find(options.id);
        if (!product) {
            this.setData({ viewState: 'error' });
            return;
        }
        const extras = menuStore.EXTRAS.map(function (extra) {
            return {
                id: extra.id,
                name: extra.name,
                price: extra.price,
                priceText: '+' + formatPrice(extra.price),
                checked: false,
            };
        });
        this.setData(
            {
                product: product,
                drinkable: product.drinkable,
                offline: product.offline,
                extras: extras,
                basePriceText: formatPrice(product.price),
                viewState: 'ready',
            },
            () => {
                this.updatePrice();
            }
        );
        wx.setNavigationBarTitle({ title: product.name });
    },

    // 单价 = 基础价 + 杯型差价 + 已勾选加料；合计再乘杯数。
    computeUnitPrice() {
        const product = this.data.product;
        if (!product) {
            return 0;
        }
        let unit = product.price;
        if (this.data.drinkable) {
            unit += this.data.sizes[this.data.sizeIndex].extra;
        }
        const extras = this.data.extras;
        for (let i = 0; i < extras.length; i += 1) {
            if (extras[i].checked) {
                unit += extras[i].price;
            }
        }
        return unit;
    },

    updatePrice() {
        const unit = this.computeUnitPrice();
        this.setData({
            unitPriceText: formatPrice(unit),
            totalText: formatPrice(unit * this.data.qty),
        });
    },

    handleSizeTap(event) {
        this.setData({ sizeIndex: Number(event.currentTarget.dataset.index) }, () => {
            this.updatePrice();
        });
    },

    handleTempTap(event) {
        this.setData({ tempIndex: Number(event.currentTarget.dataset.index) });
    },

    handleSugarTap(event) {
        this.setData({ sugarIndex: Number(event.currentTarget.dataset.index) });
    },

    handleExtraTap(event) {
        const index = Number(event.currentTarget.dataset.index);
        const key = 'extras[' + index + '].checked';
        const next = {};
        next[key] = !this.data.extras[index].checked;
        this.setData(next, () => {
            this.updatePrice();
        });
    },

    handleQtyMinus() {
        if (this.data.qty <= 1) {
            return;
        }
        this.setData({ qty: this.data.qty - 1 }, () => {
            this.updatePrice();
        });
    },

    handleQtyPlus() {
        if (this.data.qty >= 9) {
            wx.showToast({ title: '单杯最多 9 份', icon: 'none' });
            return;
        }
        this.setData({ qty: this.data.qty + 1 }, () => {
            this.updatePrice();
        });
    },

    handleNoteInput(event) {
        this.setData({ note: event.detail.value });
    },

    buildSpecText() {
        if (!this.data.drinkable) {
            return '默认规格';
        }
        const parts = [
            this.data.sizes[this.data.sizeIndex].name,
            this.data.temps[this.data.tempIndex].name,
            this.data.sugars[this.data.sugarIndex].name,
        ];
        const extras = this.data.extras;
        for (let i = 0; i < extras.length; i += 1) {
            if (extras[i].checked) {
                parts.push(extras[i].name);
            }
        }
        return parts.join(' / ');
    },

    handleAdd() {
        const product = this.data.product;
        if (!product) {
            return;
        }
        if (this.data.offline) {
            wx.showToast({ title: '这款今天卖完了', icon: 'none' });
            return;
        }
        const result = cartStore.add({
            productId: product.id,
            name: product.name,
            short: product.short,
            gradient: product.gradient,
            specText: this.buildSpecText(),
            note: this.data.note.trim(),
            unitPrice: this.computeUnitPrice(),
            qty: this.data.qty,
        });
        if (result.error) {
            wx.showToast({ title: '加入失败，请重试', icon: 'none' });
            return;
        }
        wx.showToast({ title: '已加入购物车', icon: 'success' });
        setTimeout(function () {
            wx.navigateBack();
        }, 600);
    },

    goBackHome() {
        wx.reLaunch({ url: '/pages/index/index' });
    },
});
