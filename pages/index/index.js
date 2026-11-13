const menuStore = require('../../utils/menu-store.js');
const { createLocalCartStore } = require('../../utils/cart-store.js');
const { formatPrice } = require('../../utils/format.js');
const config = require('../../utils/app-config.js');

const cartStore = createLocalCartStore();

function defaultSpec(product) {
    if (!product.drinkable) {
        return '默认规格';
    }
    return '中杯 355ml / 热 / 标准糖';
}

Page({
    data: {
        shopName: '',
        shopHours: '',
        categories: menuStore.CATEGORIES,
        activeCategory: 'all',
        products: [],
        cartCount: 0,
        cartTotalText: '¥0',
        viewState: 'ready',
    },

    onLoad() {
        this.setData({
            shopName: config.shop.name,
            shopHours: config.shop.hours,
        });
        this.refreshView();
    },

    onShow() {
        this.refreshView();
    },

    // 把购物车数量摊到商品列表上，同时算出底部结算栏的件数和金额。
    refreshView() {
        const result = cartStore.list();
        const lines = result.data || [];
        const categoryId = this.data.activeCategory;
        const products = menuStore.listByCategory(categoryId).map(function (product) {
            let qty = 0;
            for (let i = 0; i < lines.length; i += 1) {
                if (lines[i].productId === product.id) {
                    qty += lines[i].qty;
                }
            }
            return {
                id: product.id,
                name: product.name,
                en: product.en,
                desc: product.desc,
                tag: product.tag,
                short: product.short,
                gradient: product.gradient,
                priceText: formatPrice(product.price),
                offline: product.offline,
                qty: qty,
            };
        });

        let count = 0;
        let total = 0;
        for (let i = 0; i < lines.length; i += 1) {
            count += lines[i].qty;
            total += lines[i].unitPrice * lines[i].qty;
        }

        this.setData({
            products: products,
            viewState: products.length === 0 ? 'empty' : 'ready',
            cartCount: count,
            cartTotalText: formatPrice(total),
        });
    },

    handleCategoryTap(event) {
        const categoryId = event.currentTarget.dataset.id;
        this.setData({ activeCategory: categoryId });
        this.refreshView();
    },

    handleProductTap(event) {
        const productId = event.currentTarget.dataset.id;
        wx.navigateTo({ url: '/pages/detail/detail?id=' + productId });
    },

    // 列表上的加号：按默认规格直接加一杯，想改规格就点商品进详情页。
    handlePlus(event) {
        const productId = event.currentTarget.dataset.id;
        const product = menuStore.find(productId);
        if (!product) {
            return;
        }
        if (product.offline) {
            wx.showToast({ title: '这款今天卖完了', icon: 'none' });
            return;
        }
        const added = cartStore.add({
            productId: product.id,
            name: product.name,
            short: product.short,
            gradient: product.gradient,
            specText: defaultSpec(product),
            note: '',
            unitPrice: product.price,
            qty: 1,
        });
        if (added.error) {
            wx.showToast({ title: '加入失败，请重试', icon: 'none' });
            return;
        }
        this.refreshView();
    },

    // 列表上的减号：减掉同商品最后加入的那一杯。
    handleMinus(event) {
        const productId = event.currentTarget.dataset.id;
        const result = cartStore.list();
        const lines = result.data || [];
        for (let i = lines.length - 1; i >= 0; i -= 1) {
            if (lines[i].productId !== productId) {
                continue;
            }
            if (lines[i].qty > 1) {
                cartStore.updateQty(lines[i].id, lines[i].qty - 1);
            } else {
                cartStore.remove(lines[i].id);
            }
            break;
        }
        this.refreshView();
    },

    goCart() {
        if (this.data.cartCount === 0) {
            wx.showToast({ title: '购物车还是空的', icon: 'none' });
            return;
        }
        wx.navigateTo({ url: '/pages/cart/cart' });
    },

    goOrders() {
        wx.navigateTo({ url: '/pages/orders/orders' });
    },
});
