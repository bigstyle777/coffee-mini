// 数据层冒烟测试：不需要微信环境，用 Node 直接跑。
// 用法：node scripts/store-smoke-test.js
// 作用：验证购物车、订单状态机、菜单覆盖、顾客身份这几个纯逻辑模块。

const memory = {};

global.wx = {
    getStorageSync(key) {
        return memory[key] === undefined ? '' : memory[key];
    },
    setStorageSync(key, value) {
        memory[key] = value;
    },
    removeStorageSync(key) {
        delete memory[key];
    },
    clearStorageSync() {
        Object.keys(memory).forEach(function (key) {
            delete memory[key];
        });
    },
};

const { createLocalCartStore } = require('../utils/cart-store.js');
const { createLocalOrderStore } = require('../utils/order-store.js');
const menuStore = require('../utils/menu-store.js');
const userStore = require('../utils/user-store.js');

let failed = 0;

function check(name, actual, expected) {
    const ok = actual === expected;
    if (!ok) {
        failed += 1;
    }
    console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + '  =>  ' + actual + (ok ? '' : '  (期望 ' + expected + ')'));
}

const cart = createLocalCartStore();
const orders = createLocalOrderStore();
const user = userStore.getIdentity();

check('顾客身份已生成', user.id.slice(0, 1), 'u');
check('菜单商品数量', menuStore.listAll().length, 12);

// 改价与上下架
menuStore.setPrice('p01', 20);
check('改价生效', menuStore.find('p01').price, 20);
menuStore.setOffline('p02', true);
check('售罄生效', menuStore.find('p02').offline, true);
menuStore.resetAll();
check('恢复默认价格', menuStore.find('p01').price, 18);

// 购物车合并同规格
const product = menuStore.find('p01');
const payload = {
    productId: product.id,
    name: product.name,
    short: product.short,
    gradient: product.gradient,
    specText: '中杯 355ml / 热 / 标准糖',
    note: '',
    unitPrice: product.price,
    qty: 2,
};
cart.add(payload);
const merged = cart.add(payload);
check('同规格合并行数', merged.data.length, 1);
check('同规格合并数量', merged.data[0].qty, 4);

// 订单状态机
const created = orders.create({
    items: [
        {
            productId: product.id,
            name: product.name,
            specText: payload.specText,
            note: '',
            unitPrice: product.price,
            qty: 4,
        },
    ],
    itemCount: 4,
    subtotal: 72,
    discount: 8,
    total: 64,
    pickupName: '到店自取',
    note: '两杯装一起',
    userId: user.id,
});
check('下单初始状态', created.data.status, 'unpaid');
check('待支付可支付', created.data.canPay, true);

const paid = orders.updateStatus(created.data.id, 'placed');
check('支付后状态', paid.data.status, 'placed');
check('已下单可接单', paid.data.canStart, true);

check('非法流转被拒绝', orders.updateStatus(created.data.id, 'done').error, 'INVALID_TRANSITION');

orders.updateStatus(created.data.id, 'making');
orders.updateStatus(created.data.id, 'ready');
const done = orders.updateStatus(created.data.id, 'done');
check('完成后状态', done.data.status, 'done');

const stats = orders.stats();
check('今日订单数', stats.data.todayCount, 1);
check('今日营业额', stats.data.todayRevenue, 64);
check('待接单数', stats.data.pendingCount, 0);

// 取消流转
const second = orders.create({
    items: [
        {
            productId: product.id,
            name: product.name,
            specText: payload.specText,
            note: '',
            unitPrice: product.price,
            qty: 1,
        },
    ],
    itemCount: 1,
    subtotal: 18,
    discount: 0,
    total: 18,
    pickupName: '堂食',
    note: '',
    userId: user.id,
});
check('待支付可取消', orders.updateStatus(second.data.id, 'cancelled').data.status, 'cancelled');
check('已取消不可再流转', orders.updateStatus(second.data.id, 'placed').error, 'INVALID_TRANSITION');

console.log('---');
if (failed === 0) {
    console.log('全部通过');
} else {
    console.log(failed + ' 项失败');
    process.exitCode = 1;
}
