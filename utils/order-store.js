const { makeOrderNo } = require('./format.js');

const ORDER_KEY = 'coffee_orders_v1';

// 订单状态机：待支付 -> 已下单 -> 制作中 -> 可取餐 -> 已完成，未完成前可取消。
const STATUS = {
    UNPAID: 'unpaid',
    PLACED: 'placed',
    MAKING: 'making',
    READY: 'ready',
    DONE: 'done',
    CANCELLED: 'cancelled',
};

const STATUS_META = {
    unpaid: { text: '待支付', hint: '完成支付后门店才会收到订单' },
    placed: { text: '已下单', hint: '门店已收到订单，等待接单' },
    making: { text: '制作中', hint: '咖啡师正在制作，请稍候' },
    ready: { text: '可取餐', hint: '凭订单号到吧台取餐' },
    done: { text: '已完成', hint: '祝你喝得开心' },
    cancelled: { text: '已取消', hint: '这笔订单已取消' },
};

// 只允许表里列出的流转，避免页面写出非法状态。
const ALLOWED_NEXT = {
    unpaid: ['placed', 'cancelled'],
    placed: ['making', 'cancelled'],
    making: ['ready', 'cancelled'],
    ready: ['done'],
    done: [],
    cancelled: [],
};

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

function canTransition(from, to) {
    const next = ALLOWED_NEXT[from];
    if (!next) {
        return false;
    }
    return next.indexOf(to) >= 0;
}

function decorate(order) {
    const meta = STATUS_META[order.status] || STATUS_META.placed;
    const items = order.items.map(function (item, index) {
        return {
            key: order.id + '-' + index,
            productId: item.productId,
            name: item.name,
            specText: item.specText,
            note: item.note,
            qty: item.qty,
            unitPrice: item.unitPrice,
        };
    });
    return {
        id: order.id,
        no: order.no,
        createdAt: order.createdAt,
        paidAt: order.paidAt || 0,
        userId: order.userId || '',
        status: order.status,
        statusText: meta.text,
        statusHint: meta.hint,
        itemCount: order.itemCount,
        subtotal: order.subtotal,
        discount: order.discount,
        total: order.total,
        pickupName: order.pickupName,
        note: order.note || '',
        items: items,
        canPay: order.status === STATUS.UNPAID,
        canCancel: order.status === STATUS.UNPAID || order.status === STATUS.PLACED,
        canStart: order.status === STATUS.PLACED,
        canReady: order.status === STATUS.MAKING,
        canFinish: order.status === STATUS.READY,
    };
}

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
