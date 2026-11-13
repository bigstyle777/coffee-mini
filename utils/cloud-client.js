// 云端客户端。整个小程序只初始化一次，所有云模块共用这一个实例。
// endpoint 与 publishableKey 取自开通云服务时返回的 publicConfig（存在 app-config.js 里）。
const { createMiniProgramWorkBuddyCloud } = require('@tencent-ai/workbuddy-cloud-sdk/miniprogram');
const { createDiagnosticWx } = require('./workbuddy-cloud-diagnostics.js');
const config = require('./app-config.js');

let client = null;

function getCloud() {
    if (client) {
        return client;
    }
    client = createMiniProgramWorkBuddyCloud({
        endpoint: config.cloud.endpoint,
        publishableKey: config.cloud.publishableKey,
        // 包一层 wx，请求失败时会在 vConsole 里打出可定位的日志
        wx: createDiagnosticWx(wx),
    });
    return client;
}

module.exports = {
    getCloud: getCloud,
};
