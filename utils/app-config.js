// 全项目共用的开关与参数。改这里就能切换运行模式，不用动页面代码。
module.exports = {
    // 是否使用云端数据。当前为 false：所有数据落在本机 storage，不需要任何后端。
    // 改成 true 前请先看 docs/cloud-migration.md，并用 utils/data-service.js 里的云实现替换本地实现。
    useCloud: false,

    shop: {
        name: '拾光咖啡 · 科技园店',
        hours: '10:00 - 22:00',
        address: '科技园南路 18 号 一层',
        phone: '021-0000 0000',
    },

    // 满减活动
    promotion: {
        threshold: 50,
        amount: 8,
    },

    // 支付：mock 为 true 时使用页面内模拟支付，不调用 wx.requestPayment
    payment: {
        mock: true,
    },

    // 店长端的进入口令。真实项目应改成服务端校验的角色权限，这里只是演示用的前端开关。
    adminPasscode: '8888',
};
