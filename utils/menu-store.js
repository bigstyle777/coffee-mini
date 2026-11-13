const { CATEGORIES, PRODUCTS, SIZES, TEMPERATURES, SUGARS, EXTRAS, PICKUP_TYPES } = require('./menu-data.js');

const OVERRIDE_KEY = 'coffee_menu_overrides_v1';

// 存储里只放「被店长改过的部分」，没改过的商品仍然用 menu-data.js 里的默认值。
// 这样改菜单不需要动代码，也不会把整份菜单冗余写进 storage。
function readOverrides() {
    try {
        const raw = wx.getStorageSync(OVERRIDE_KEY);
        if (raw && typeof raw === 'object') {
            return raw;
        }
        return {};
    } catch (error) {
        return {};
    }
}

function writeOverrides(map) {
    try {
        wx.setStorageSync(OVERRIDE_KEY, map);
        return null;
    } catch (error) {
        return 'CLIENT_EXCEPTION';
    }
}

function decorate(product, overrides) {
    const override = overrides[product.id] || {};
    const price = typeof override.price === 'number' ? override.price : product.price;
    return {
        id: product.id,
        category: product.category,
        name: product.name,
        en: product.en,
        desc: product.desc,
        tag: product.tag,
        short: product.short,
        gradient: product.gradient,
        drinkable: product.drinkable,
        price: price,
        defaultPrice: product.price,
        offline: override.offline === true,
    };
}

function listAll() {
    const overrides = readOverrides();
    return PRODUCTS.map(function (product) {
        return decorate(product, overrides);
    });
}

function listByCategory(categoryId) {
    const all = listAll();
    if (!categoryId || categoryId === 'all') {
        return all;
    }
    return all.filter(function (item) {
        return item.category === categoryId;
    });
}

function find(productId) {
    const all = listAll();
    for (let i = 0; i < all.length; i += 1) {
        if (all[i].id === productId) {
            return all[i];
        }
    }
    return null;
}

function setPrice(productId, price) {
    if (!productId) {
        return { data: null, error: 'INVALID_ID' };
    }
    if (!(price >= 0)) {
        return { data: null, error: 'INVALID_PAYLOAD' };
    }
    const overrides = readOverrides();
    const current = overrides[productId] || {};
    overrides[productId] = {
        price: price,
        offline: current.offline === true,
    };
    const error = writeOverrides(overrides);
    if (error) {
        return { data: null, error: error };
    }
    return { data: find(productId), error: null };
}

function setOffline(productId, offline) {
    if (!productId) {
        return { data: null, error: 'INVALID_ID' };
    }
    const overrides = readOverrides();
    const current = overrides[productId] || {};
    overrides[productId] = {
        price: typeof current.price === 'number' ? current.price : undefined,
        offline: offline === true,
    };
    if (typeof overrides[productId].price !== 'number') {
        delete overrides[productId].price;
    }
    const error = writeOverrides(overrides);
    if (error) {
        return { data: null, error: error };
    }
    return { data: find(productId), error: null };
}

function resetAll() {
    try {
        wx.removeStorageSync(OVERRIDE_KEY);
        return { data: listAll(), error: null };
    } catch (error) {
        return { data: null, error: 'CLIENT_EXCEPTION' };
    }
}

module.exports = {
    CATEGORIES: CATEGORIES,
    SIZES: SIZES,
    TEMPERATURES: TEMPERATURES,
    SUGARS: SUGARS,
    EXTRAS: EXTRAS,
    PICKUP_TYPES: PICKUP_TYPES,
    listAll: listAll,
    listByCategory: listByCategory,
    find: find,
    setPrice: setPrice,
    setOffline: setOffline,
    resetAll: resetAll,
};
