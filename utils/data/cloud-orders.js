// 云端实现：订单存在 WorkBuddy 托管后端的 PostgreSQL 里，两台设备看到同一份数据。
// 接口与 local-orders.js 完全一致，页面不需要知道数据到底在哪。
const { getCloud } = require('../cloud-client.js');
const { STATUS, canTransition, decorate } = require('../order-status.js');
const { makeOrderNo } = require('../format.js');

const TABLE = 'orders';
const PAGE_LIMIT = 200;

// 金额统一按「分」存整数，避免浮点数累加出现 45.99999999 这种结果。
function toCents(yuan) {
    return Math.round(Number(yuan || 0) * 100);
}

function toYuan(cents) {
    return Number(cents || 0) / 100;
}

function toMillis(isoText) {
    if (!isoText) {
        return 0;
    }
    const ms = Date.parse(isoText);
    return isNaN(ms) ? 0 : ms;
}

// 数据库行（下划线、金额用分）转成页面用的订单对象（驼峰、金额用元）。
function rowToOrder(row) {
    const items = Object.prototype.toString.call(row.items) === '[object Array]' ? row.items : [];
    return {
        id: row.id,
        no: row.order_no,
        createdAt: toMillis(row.created_at),
        paidAt: toMillis(row.paid_at),
        userId: row.user_id || '',
        status: row.status,
        items: items,
        itemCount: row.item_count,
        subtotal: toYuan(row.subtotal_cents),
        discount: toYuan(row.discount_cents),
        total: toYuan(row.total_cents),
        pickupName: row.pickup_name || '',
        note: row.note || '',
    };
}

// 只把可读的错误码交给页面，详细原因打到控制台，避免把后端原始信息显示给用户。
function toErrorObject(error) {
    if (!error) {
        return null;
    }
    console.error('[order] cloud error', error.code || '', error.message || '');
    return error.code || 'CLOUD_ERROR';
}

function db() {
    return getCloud().database;
}

function createCloudOrdersApi() {
    const api = {
        isRemote: true,

        // 全量列表，新的在前
        list() {
            return db()
                .from(TABLE)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(PAGE_LIMIT)
                .then(function (res) {
                    if (res.error) {
                        return { data: null, error: toErrorObject(res.error) };
                    }
                    const rows = res.data || [];
                    return {
                        data: rows.map(function (row) {
                            return decorate(rowToOrder(row));
                        }),
                        error: null,
                    };
                })
                .catch(function (error) {
                    return { data: null, error: toErrorObject(error) };
                });
        },

        listByStatus(status) {
            if (!status || status === 'all') {
                return api.list();
            }
            return api.list().then(function (result) {
                if (result.error) {
                    return result;
                }
                return {
                    data: result.data.filter(function (order) {
                        return order.status === status;
                    }),
                    error: null,
                };
            });
        },

        get(orderId) {
            if (!orderId) {
                return Promise.resolve({ data: null, error: 'INVALID_ID' });
            }
            return db()
                .from(TABLE)
                .select('*')
                .eq('id', orderId)
                .maybeSingle()
                .then(function (res) {
                    if (res.error) {
                        return { data: null, error: toErrorObject(res.error) };
                    }
                    if (!res.data) {
                        return { data: null, error: 'NOT_FOUND_OR_FORBIDDEN' };
                    }
                    return { data: decorate(rowToOrder(res.data)), error: null };
                })
                .catch(function (error) {
                    return { data: null, error: toErrorObject(error) };
                });
        },

        // 下单：先落一张「待支付」，支付成功后才流转到「已下单」。
        create(payload) {
            const items = payload && payload.items;
            if (!items || items.length === 0) {
                return Promise.resolve({ data: null, error: 'INVALID_PAYLOAD' });
            }
            const createdAt = Date.now();
            const row = {
                id: 'o' + createdAt + Math.floor(Math.random() * 1000),
                order_no: makeOrderNo(createdAt),
                user_id: payload.userId || '',
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
                item_count: payload.itemCount || 0,
                subtotal_cents: toCents(payload.subtotal),
                discount_cents: toCents(payload.discount),
                total_cents: toCents(payload.total),
                pickup_name: payload.pickupName || '',
                note: payload.note || '',
            };
            return db()
                .from(TABLE)
                .insert(row)
                .select()
                .then(function (res) {
                    if (res.error) {
                        return { data: null, error: toErrorObject(res.error) };
                    }
                    const created = (res.data || [])[0];
                    if (!created) {
                        return { data: null, error: 'CLOUD_WRITE_NOT_PERSISTED' };
                    }
                    return { data: decorate(rowToOrder(created)), error: null };
                })
                .catch(function (error) {
                    return { data: null, error: toErrorObject(error) };
                });
        },

        // 状态流转。先读当前状态，再按状态机校验，最后写回。
        // 注意：读和写不是原子的，两个人同时点可能都通过校验；演示够用，
        // 真实项目应该用一个数据库函数把「校验 + 更新」合成一步。
        updateStatus(orderId, nextStatus) {
            if (!orderId) {
                return Promise.resolve({ data: null, error: 'INVALID_ID' });
            }
            return db()
                .from(TABLE)
                .select('id, status')
                .eq('id', orderId)
                .maybeSingle()
                .then(function (res) {
                    if (res.error) {
                        return { data: null, error: toErrorObject(res.error) };
                    }
                    if (!res.data) {
                        return { data: null, error: 'NOT_FOUND_OR_FORBIDDEN' };
                    }
                    if (!canTransition(res.data.status, nextStatus)) {
                        return { data: null, error: 'INVALID_TRANSITION' };
                    }
                    const patch = {
                        status: nextStatus,
                        updated_at: new Date().toISOString(),
                    };
                    if (nextStatus === STATUS.PLACED) {
                        patch.paid_at = new Date().toISOString();
                    }
                    return db()
                        .from(TABLE)
                        .update(patch)
                        .eq('id', orderId)
                        .select()
                        .then(function (updateRes) {
                            if (updateRes.error) {
                                return { data: null, error: toErrorObject(updateRes.error) };
                            }
                            const updated = (updateRes.data || [])[0];
                            if (!updated) {
                                // 没报错但没有返回行：行被删了，或者被权限策略过滤掉了
                                return { data: null, error: 'NOT_FOUND_OR_FORBIDDEN' };
                            }
                            return { data: decorate(rowToOrder(updated)), error: null };
                        });
                })
                .catch(function (error) {
                    return { data: null, error: toErrorObject(error) };
                });
        },

        // 今日经营数据，店长端顶部用
        stats() {
            return api.list().then(function (result) {
                if (result.error) {
                    return result;
                }
                const orders = result.data;
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
            });
        },

        // 清空订单。云端是所有人共享的，这一步会删掉全部人的订单，仅演示用。
        clear() {
            return db()
                .from(TABLE)
                .delete()
                .neq('id', '')
                .select()
                .then(function (res) {
                    if (res.error) {
                        return { data: null, error: toErrorObject(res.error) };
                    }
                    return { data: res.data || [], error: null };
                })
                .catch(function (error) {
                    return { data: null, error: toErrorObject(error) };
                });
        },
    };
    return api;
}

module.exports = {
    createCloudOrdersApi: createCloudOrdersApi,
};
