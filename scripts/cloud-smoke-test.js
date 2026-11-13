// 云端数据层冒烟测试：用 Node 直接打真实的托管后端，验证「一个客户端写入、另一个客户端读取」。
// 这一步验证的是数据面与 utils/data/cloud-orders.js 的映射逻辑，
// 不验证微信的域名白名单（那要在真机/模拟器里才有意义）。
//
// 用法：node scripts/cloud-smoke-test.js
const path = require('path');

// ---- 1. 造一个最小可用的 wx 环境 ----
const memory = {};

function makeWx() {
    return {
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
        getAccountInfoSync() {
            return { miniProgram: { appId: 'wx558b4f5834ba0913' } };
        },
        getSystemInfoSync() {
            return { platform: 'devtools', SDKVersion: '3.0.0' };
        },
        request(options) {
            const method = options.method || 'GET';
            const headers = Object.assign({}, options.header || {});
            let body;
            if (options.data !== undefined && method !== 'GET') {
                if (typeof options.data === 'string') {
                    body = options.data;
                } else {
                    body = JSON.stringify(options.data);
                    if (!headers['Content-Type']) {
                        headers['Content-Type'] = 'application/json';
                    }
                }
            }
            fetch(options.url, { method: method, headers: headers, body: body })
                .then(function (res) {
                    return res.text().then(function (text) {
                        let payload = text;
                        try {
                            payload = JSON.parse(text);
                        } catch (error) {
                            // 保持原样，交给上层判断
                        }
                        const responseHeaders = {};
                        res.headers.forEach(function (value, key) {
                            responseHeaders[key] = value;
                        });
                        const result = {
                            data: payload,
                            statusCode: res.status,
                            header: responseHeaders,
                            errMsg: 'request:ok',
                        };
                        if (options.success) {
                            options.success(result);
                        }
                        if (options.complete) {
                            options.complete(result);
                        }
                    });
                })
                .catch(function (error) {
                    const result = { errMsg: 'request:fail ' + (error && error.message) };
                    if (options.fail) {
                        options.fail(result);
                    }
                    if (options.complete) {
                        options.complete(result);
                    }
                });
            return { abort() {} };
        },
    };
}

global.wx = makeWx();

// ---- 2. 切到云端模式 ----
const config = require('../utils/app-config.js');
config.dataSource = 'cloud';

const { getOrdersApi } = require('../utils/data/index.js');
const { getCloud } = require('../utils/cloud-client.js');

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
    if (condition) {
        passed += 1;
        console.log('PASS  ' + name + (detail ? '  =>  ' + detail : ''));
    } else {
        failed += 1;
        console.log('FAIL  ' + name + (detail ? '  =>  ' + detail : ''));
    }
}

const customerApi = getOrdersApi();

// 模拟另一台设备：另建一套 api 实例，互不共享任何内存状态
function anotherDevice() {
    return getOrdersApi();
}
const staffApi = anotherDevice();

const createdId = [];

function run() {
    console.log('endpoint =', config.cloud.endpoint);
    console.log('--- 1. 顾客端下单（写入云端）---');
    return customerApi
        .create({
            items: [
                {
                    productId: 'p-smoke',
                    name: '冒烟测试拿铁',
                    specText: '中杯 / 热 / 半糖',
                    note: '这是脚本生成的测试单',
                    unitPrice: 18,
                    qty: 2,
                },
            ],
            itemCount: 2,
            subtotal: 36,
            discount: 0,
            total: 36,
            pickupName: '自取',
            note: 'cloud-smoke-test',
            userId: 'smoke-customer',
        })
        .then(function (result) {
            check('下单写入成功', !result.error && !!result.data, result.error || (result.data && result.data.no));
            if (!result.data) {
                return Promise.reject(new Error('下单失败，后续无法继续'));
            }
            createdId.push(result.data.id);
            check('初始状态是待支付', result.data.status === 'unpaid', result.data.status);
            check('金额按分存回来后仍是 36', result.data.total === 36, String(result.data.total));
            return staffApi.list();
        })
        .then(function (result) {
            console.log('--- 2. 店长端读取（另一个客户端实例）---');
            check('店长端能读到订单列表', !result.error && Array.isArray(result.data), result.error || result.data.length + ' 笔');
            const found = (result.data || []).filter(function (order) {
                return order.id === createdId[0];
            })[0];
            check('店长端读到了顾客刚下的那一笔', !!found, found ? found.no : '没找到');
            check('订单行内容完整', !!found && found.items.length === 1 && found.items[0].qty === 2, found ? found.items[0].name + ' × ' + found.items[0].qty : '');
            return staffApi.updateStatus(createdId[0], 'placed');
        })
        .then(function (result) {
            console.log('--- 3. 店长接单（状态机流转）---');
            check('接单成功', !result.error && result.data && result.data.status === 'placed', result.error || (result.data && result.data.statusText));
            check('接单后 canStart 为真', !!result.data && result.data.canStart === true);
            return customerApi.updateStatus(createdId[0], 'placed');
        })
        .then(function (result) {
            console.log('--- 4. 非法流转必须被拒绝 ---');
            check('重复接单返回 INVALID_TRANSITION', result.error === 'INVALID_TRANSITION', result.error || '竟然成功了');
            return customerApi.stats();
        })
        .then(function (result) {
            console.log('--- 5. 经营统计 ---');
            check('统计能算出来', !result.error && result.data.todayCount >= 1, JSON.stringify(result.data));
            return cleanup();
        })
        .catch(function (error) {
            failed += 1;
            console.log('FAIL  执行中断 =>  ' + (error && error.message));
            return cleanup();
        })
        .then(function () {
            console.log('---');
            console.log('通过 ' + passed + ' 项，失败 ' + failed + ' 项');
            if (failed > 0) {
                process.exitCode = 1;
            }
        });
}

// 收尾：删掉脚本自己造的数据，不留垃圾
function cleanup() {
    if (createdId.length === 0) {
        return Promise.resolve();
    }
    const db = getCloud().database;
    return db
        .from('orders')
        .delete()
        .eq('id', createdId[0])
        .select()
        .then(function (res) {
            console.log('[cleanup] 已删除测试订单，剩余返回行数 =', (res.data || []).length);
        })
        .catch(function (error) {
            console.log('[cleanup] 删除测试订单失败（不影响结论）：', error && error.message);
        });
}

run();
