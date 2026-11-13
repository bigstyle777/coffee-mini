const CART_KEY = 'coffee_cart_v1';

// 购物车存在本地存储里，读出来永远保证是数组。
function readCart() {
    try {
        const raw = wx.getStorageSync(CART_KEY);
        if (!raw) {
            return [];
        }
        if (Object.prototype.toString.call(raw) === '[object Array]') {
            return raw;
        }
        return [];
    } catch (error) {
        return [];
    }
}

function writeCart(list) {
    try {
        wx.setStorageSync(CART_KEY, list);
        return null;
    } catch (error) {
        return 'CLIENT_EXCEPTION';
    }
}

function makeLineId() {
    return 'c' + Date.now() + Math.floor(Math.random() * 1000);
}

// 每一行购物车：同样是商品、同样规格、同样备注才算同一行，合并数量。
function isSameLine(line, payload) {
    return (
        line.productId === payload.productId &&
        line.specText === payload.specText &&
        line.note === payload.note
    );
}

function createLocalCartStore() {
    return {
        list() {
            return { data: readCart(), error: null };
        },

        add(payload) {
            if (!payload || !payload.productId || !(payload.qty > 0)) {
                return { data: null, error: 'INVALID_PAYLOAD' };
            }
            const list = readCart();
            let merged = false;
            for (let i = 0; i < list.length; i += 1) {
                if (isSameLine(list[i], payload)) {
                    list[i].qty += payload.qty;
                    merged = true;
                    break;
                }
            }
            if (!merged) {
                list.push({
                    id: makeLineId(),
                    productId: payload.productId,
                    name: payload.name,
                    short: payload.short,
                    gradient: payload.gradient,
                    specText: payload.specText,
                    note: payload.note || '',
                    unitPrice: payload.unitPrice,
                    qty: payload.qty,
                });
            }
            const error = writeCart(list);
            if (error) {
                return { data: null, error: error };
            }
            return { data: list, error: null };
        },

        updateQty(lineId, qty) {
            if (!lineId) {
                return { data: null, error: 'INVALID_ID' };
            }
            if (!(qty > 0)) {
                return { data: null, error: 'INVALID_PAYLOAD' };
            }
            const list = readCart();
            let hit = false;
            for (let i = 0; i < list.length; i += 1) {
                if (list[i].id === lineId) {
                    list[i].qty = qty;
                    hit = true;
                    break;
                }
            }
            if (!hit) {
                return { data: null, error: 'NOT_FOUND_OR_FORBIDDEN' };
            }
            const error = writeCart(list);
            if (error) {
                return { data: null, error: error };
            }
            return { data: list, error: null };
        },

        remove(lineId) {
            if (!lineId) {
                return { data: null, error: 'INVALID_ID' };
            }
            const list = readCart();
            const next = list.filter(function (item) {
                return item.id !== lineId;
            });
            if (next.length === list.length) {
                return { data: null, error: 'NOT_FOUND_OR_FORBIDDEN' };
            }
            const error = writeCart(next);
            if (error) {
                return { data: null, error: error };
            }
            return { data: next, error: null };
        },

        clear() {
            try {
                wx.removeStorageSync(CART_KEY);
                return { data: [], error: null };
            } catch (error) {
                return { data: null, error: 'CLIENT_EXCEPTION' };
            }
        },
    };
}

module.exports = {
    createLocalCartStore: createLocalCartStore,
};
