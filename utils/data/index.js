// 数据来源的总开关。页面只 require 这里的 getOrdersApi()，
// 不直接依赖具体的本地实现或云端实现。
//
// 两个实现都返回 { data, error }，而且都是 Promise，
// 所以切换数据源不需要改页面里的任何业务逻辑。
const config = require('../app-config.js');

let ordersApi = null;

// 云端实现加载失败时的兜底：所有方法都返回同一个错误码，
// 页面照常渲染并给出提示，不会因为 require 抛错直接白屏。
function createUnavailableApi(errorCode) {
    function fail() {
        return Promise.resolve({ data: null, error: errorCode });
    }
    return {
        isRemote: true,
        unavailable: true,
        list: fail,
        listByStatus: fail,
        get: fail,
        create: fail,
        updateStatus: fail,
        stats: fail,
        clear: fail,
    };
}

// 配置是否还是仓库里的占位符。没填就早点报错，别让人对着一个看不懂的网络错误排查。
function isCloudConfigured() {
    const cloud = config.cloud || {};
    if (!cloud.endpoint || !cloud.publishableKey) {
        return false;
    }
    if (cloud.endpoint.indexOf('your-endpoint') >= 0) {
        return false;
    }
    if (cloud.publishableKey.indexOf('your_app_id') >= 0) {
        return false;
    }
    return true;
}

function getOrdersApi() {
    if (ordersApi) {
        return ordersApi;
    }
    if (config.dataSource === 'cloud') {
        if (!isCloudConfigured()) {
            console.error('[data] cloud.endpoint / cloud.publishableKey 还是占位符，请填成你自己的');
            ordersApi = createUnavailableApi('CLOUD_NOT_CONFIGURED');
            return ordersApi;
        }
        // 延迟 require：本地模式下完全不加载云端 SDK，
        // 这样没执行过「构建 npm」的项目也能正常跑本地版。
        try {
            const { createCloudOrdersApi } = require('./cloud-orders.js');
            ordersApi = createCloudOrdersApi();
        } catch (error) {
            console.error('[data] 云端实现加载失败，通常是没执行「构建 npm」', error && error.message);
            ordersApi = createUnavailableApi('CLOUD_SDK_NOT_BUILT');
        }
    } else {
        const { createLocalOrdersApi } = require('./local-orders.js');
        ordersApi = createLocalOrdersApi();
    }
    return ordersApi;
}

function resetOrdersApi() {
    ordersApi = null;
}

module.exports = {
    getOrdersApi: getOrdersApi,
    resetOrdersApi: resetOrdersApi,
};
