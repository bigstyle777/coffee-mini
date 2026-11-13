// 本地实现：把现有 utils/order-store.js 包一层 Promise。
// 包装的目的是让本地版和云端版有完全相同的调用方式，页面不用关心数据从哪来。
const { createLocalOrderStore } = require('../order-store.js');
const { STATUS } = require('../order-status.js');

const store = createLocalOrderStore();

// 同步结果转成 Promise，页面统一用 .then() 处理。
function toPromise(result) {
    return Promise.resolve(result);
}

function createLocalOrdersApi() {
    return {
        isRemote: false,

        list() {
            return toPromise(store.list());
        },

        listByStatus(status) {
            return toPromise(store.listByStatus(status));
        },

        get(orderId) {
            return toPromise(store.get(orderId));
        },

        create(payload) {
            return toPromise(store.create(payload));
        },

        updateStatus(orderId, nextStatus) {
            return toPromise(store.updateStatus(orderId, nextStatus));
        },

        stats() {
            return toPromise(store.stats());
        },

        clear() {
            return toPromise(store.clear());
        },
    };
}

module.exports = {
    STATUS: STATUS,
    createLocalOrdersApi: createLocalOrdersApi,
};
