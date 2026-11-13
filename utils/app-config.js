// 全项目共用的开关与参数。改这里就能切换运行模式，不用动页面代码。
module.exports = {
    // 订单数据放在哪：'local' 只用本机 storage，'cloud' 走 WorkBuddy 托管后端。
    // local —— 零依赖、克隆即跑，但顾客端与店长端必须同一台设备。
    // cloud —— 两台设备共享同一份订单，需要先执行「构建 npm」，见 README。
    dataSource: 'local',

    // 云端连接参数。这两个值来自开通云服务时返回的 publicConfig。
    // 仓库里留的是占位符：填成你自己的，否则云端模式一定连不上。
    // 它们会进小程序包，属于公开配置（publishableKey 只表明是哪个应用，本身不带权限），
    // 但仍建议只填自己的——填别人的等于把自己的订单写进别人的库。
    cloud: {
        endpoint: 'https://your-endpoint.example.com',
        publishableKey: 'wbpk_your_app_id_your_publishable_key',
    },

    // 云端模式下店长端多久拉一次新订单（毫秒）。纯轮询，最土但最容易懂。
    orderPollInterval: 5000,

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
