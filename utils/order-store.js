const { makeOrderNo } = require('./format.js');
// 状态机与展示字段统一放在 order-status.js，本地实现与云端实现共用同一套规则，
// 避免两边各自维护一份、改一边忘另一边。
const { STATUS, STATUS_META, canTransition, decorate } = require('./order-status.js');

const ORDER_KEY = 'coffee_orders_v1';

function readOrders() {
    try {
        const raw = wx.getStorageSync(ORDER_KEY);
        if (Object.prototype.toString.call(raw) === '[object Array]') {
            // 兼容早期版本：那时候没有 status 字段，历史订单一律视为已下单
            for (let i = 0; i < raw.length; i += 1) {
                if (!raw[i].status) {
                    raw[i].status = STATUS.PLACED;
                }
            }
            return raw;
        }
        return [];
    } catch (error) {
        return [];
    }
}

function writeOrders(list) {
    try {
        wx.setStorageSync(ORDER_KEY, list);
        return null;
    } catch (error) {
        return 'CLIENT_EXCEPTION';
    }
}

// canTransition 与 decorate 由 order-status.js 提供，这里不再重复实现。

function createLocalOrderStore() {
    const store = {
        STATUS: STATUS,

        // 全量列表，新的在前
        list() {
            const orders = readOrders();
            const decorated = orders.map(decorate);
            decorated.sort(function (a, b) {
                return b.createdAt - a.createdAt;
            });
            return { data: decorated, error: null };
        },

        // 按状态筛选，店长端用
        listByStatus(status) {
            const result = store.list();
            if (!status || status === 'all') {
                return result;
            }
            return {
                data: result.data.filter(function (order) {
                    return order.status === status;
                }),
                error: null,
            };
        },

        get(orderId) {
            const orders = readOrders();
            for (let i = 0; i < orders.length; i += 1) {
                if (orders[i].id === orderId) {
                    return { data: decorate(orders[i]), error: null };
                }
            }
            return { data: null, error: 'NOT_FOUND_OR_FORBIDDEN' };
        },

        create(payload) {
            const items = payload && payload.items;
            if (!items || items.length === 0) {
                return { data: null, error: 'INVALID_PAYLOAD' };
            }
            const createdAt = Date.now();
            const order = {
                id: 'o' + createdAt + Math.floor(Math.random() * 1000),
                no: makeOrderNo(createdAt),
                createdAt: createdAt,
                paidAt: 0,
                userId: payload.userId || '',
                status: STATUS.UNPAID,
                items: items.map(function (item) {
                    return {
                        productId: item.productId,
                        name: item.name,
                        specText: item.specText,
                        note: item.note,
                        unitPrice: item.unitPrice,
                        qty: item.qty,
                    };
                }),
                itemCount: payload.itemCount,
                subtotal: payload.subtotal,
                discount: payload.discount,
                total: payload.total,
                pickupName: payload.pickupName,
                note: payload.note || '',
            };
            const orders = readOrders();
            orders.push(order);
            const error = writeOrders(orders);
            if (error) {
                return { data: null, error: error };
            }
            return { data: decorate(order), error: null };
        },

        // 状态流转。失败返回 NOT_FOUND_OR_FORBIDDEN / INVALID_TRANSITION。
        updateStatus(orderId, nextStatus) {
            if (!orderId) {
                return { data: null, error: 'INVALID_ID' };
            }
            const orders = readOrders();
            for (let i = 0; i < orders.length; i += 1) {
                if (orders[i].id !== orderId) {
                    continue;
                }
                if (!canTransition(orders[i].status, nextStatus)) {
                    return { data: null, error: 'INVALID_TRANSITION' };
                }
                orders[i].status = nextStatus;
                if (nextStatus === STATUS.PLACED) {
                    orders[i].paidAt = Date.now();
                }
                const error = writeOrders(orders);
                if (error) {
                    return { data: null, error: error };
                }
                return { data: decorate(orders[i]), error: null };
            }
            return { data: null, error: 'NOT_FOUND_OR_FORBIDDEN' };
        },

        // 今日经营数据，店长端顶部用
        stats() {
            const orders = readOrders();
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            let todayCount = 0;
            let todayRevenue = 0;
            let pendingCount = 0;
            let makingCount = 0;
            for (let i = 0; i < orders.length; i += 1) {
                const order = orders[i];
                const counted = order.status !== STATUS.UNPAID && order.status !== STATUS.CANCELLED;
                if (counted && order.createdAt >= startOfDay) {
                    todayCount += 1;
                    todayRevenue += order.total;
                }
                if (order.status === STATUS.PLACED) {
                    pendingCount += 1;
                }
                if (order.status === STATUS.MAKING) {
                    makingCount += 1;
                }
            }
            return {
                data: {
                    todayCount: todayCount,
                    todayRevenue: todayRevenue,
                    pendingCount: pendingCount,
                    makingCount: makingCount,
                },
                error: null,
            };
        },

        clear() {
            try {
                wx.removeStorageSync(ORDER_KEY);
                return { data: [], error: null };
            } catch (error) {
                return { data: null, error: 'CLIENT_EXCEPTION' };
            }
        },
    };
    return store;
}

module.exports = {
    STATUS: STATUS,
    STATUS_META: STATUS_META,
    createLocalOrderStore: createLocalOrderStore,
};
