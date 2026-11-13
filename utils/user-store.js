const USER_KEY = 'coffee_user_v1';

// 本地生成一个设备级 id，用来模拟服务端的 openid，让订单能归属到「某个人」。
// 真实项目里这里应改成：wx.login() 拿 code -> 传给后端换 openid -> 后端返回会话。
// 具体改法见 docs/cloud-migration.md。
function readUser() {
    try {
        const raw = wx.getStorageSync(USER_KEY);
        if (raw && raw.id) {
            return raw;
        }
        return null;
    } catch (error) {
        return null;
    }
}

function writeUser(user) {
    try {
        wx.setStorageSync(USER_KEY, user);
        return null;
    } catch (error) {
        return 'CLIENT_EXCEPTION';
    }
}

function createUser() {
    const now = Date.now();
    return {
        id: 'u' + now + Math.floor(Math.random() * 1000),
        nickname: '',
        createdAt: now,
        // 标记身份来源，方便以后接真实登录时区分历史数据
        source: 'local-guest',
    };
}

function getIdentity() {
    let user = readUser();
    if (!user) {
        user = createUser();
        writeUser(user);
    }
    return user;
}

function setNickname(nickname) {
    const user = getIdentity();
    user.nickname = nickname;
    const error = writeUser(user);
    if (error) {
        return { data: null, error: error };
    }
    return { data: user, error: null };
}

function resetIdentity() {
    try {
        wx.removeStorageSync(USER_KEY);
        return { data: getIdentity(), error: null };
    } catch (error) {
        return { data: null, error: 'CLIENT_EXCEPTION' };
    }
}

module.exports = {
    getIdentity: getIdentity,
    setNickname: setNickname,
    resetIdentity: resetIdentity,
};
