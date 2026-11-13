const config = require('./utils/app-config.js');

App({
    globalData: {
        appName: '拾光咖啡',
        shopName: config.shop.name,
        shopHours: config.shop.hours,
        shopAddress: config.shop.address,
    },

    onLaunch() {
        // 本地存储没有初始化步骤，这里只记录一次启动，方便排查版本问题。
        console.log('[coffee-mini] launched, dataSource =', config.dataSource);
    },
});
