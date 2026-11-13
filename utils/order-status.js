// 订单状态机的唯一实现。本地实现与云端实现都从这里取规则，避免两套逻辑跑偏。

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

function canTransition(from, to) {
    const next = ALLOWED_NEXT[from];
    if (!next) {
        return false;
    }
    return next.indexOf(to) >= 0;
}

// 把存下来的原始订单转成页面直接能用的形状。
// 统一在这里算好 canPay / canCancel 这类标记，页面就不用自己判断状态。
function decorate(order) {
    const meta = STATUS_META[order.status] || STATUS_META.placed;
    const items = (order.items || []).map(function (item, index) {
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

module.exports = {
    STATUS: STATUS,
    STATUS_META: STATUS_META,
    ALLOWED_NEXT: ALLOWED_NEXT,
    canTransition: canTransition,
    decorate: decorate,
};
