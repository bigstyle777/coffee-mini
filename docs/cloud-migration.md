# 接后端 / 上云怎么改

当前所有数据都在本机。这份文档说明：**只替换数据层，页面不动**。

## 先明确要接什么

| 需求 | 需不需要后端 |
|---|---|
| 顾客订单要传到店里 | 需要 |
| 老板在另一台设备上看订单 | 需要 |
| 菜单改价全店同步 | 需要 |
| 会员、优惠券、跨设备购物车 | 需要 |
| 只在一台设备上演示 | 不需要，现状即可 |

## 方案 A：微信云开发（最省事，不用买服务器）

适合小店自助点单，成本约 19.9 元/月（有免费开发环境，小程序发布后 15 天到期）。

### 1. 开通并建集合

在开发者工具里开通云开发，建三个集合：

| 集合 | 字段 | 权限 |
|---|---|---|
| `products` | `_id`、`name`、`price`、`offline`、`category` | 所有人可读 |
| `orders` | `_openid`、`items`、`total`、`status`、`createdAt`、`pickupName`、`note` | 仅创建者可读写（店长端走云函数） |
| `staff` | `_openid`、`role` | 仅管理端 |

### 2. 把 store 换成云调用

以购物车/订单为例，保持方法名不变，只换内部实现：

```js
// utils/order-store.js（云版本示意）
const db = wx.cloud.database();

function createCloudOrderStore() {
    return {
        list() {
            // 注意：本地实现是同步返回，云实现是异步，页面要改成 async/await
            return db.collection('orders').orderBy('createdAt', 'desc').get()
                .then(res => ({ data: res.data.map(decorate), error: null }))
                .catch(err => ({ data: null, error: err.errMsg }));
        },
        // ...
    };
}
```

页面侧把 `const result = orderStore.list()` 改成 `const result = await orderStore.list()`，
并把调用处所在方法标记为 `async`。这是唯一需要在页面做的事。

### 3. `{ data, error }` 约定不要破

不要在云实现里直接 `throw`，也不要返回裸数组。保持约定，页面就不用写两套错误处理。

## 方案 B：自建后端（Node / Python / Java 都行）

小程序端只要保证：

- 域名是 **HTTPS**，且在公众平台「开发管理 → 服务器域名」里配 `request` 合法域名
- 接口返回统一结构 `{ code: 0, data: ..., message: '' }`，由 store 转成 `{ data, error }`

## 真实支付怎么接

个人主体开不了微信支付，必须先转企业或个体工商户主体并申请商户号。

流程：

1. 后端调用「统一下单」接口，拿到 `timeStamp` `nonceStr` `package` `signType` `paySign`
2. 前端 `wx.requestPayment({...})`
3. **以服务端支付回调为准确认订单已付**，前端 success 只做提示

前端接入位置已经留好，见 `pages/pay/pay.js` 里 `---- 真实支付接入位置 ----` 的注释块。
把 `utils/app-config.js` 的 `payment.mock` 改成 `false` 就会走真实分支。

## 登录与 openid

`utils/user-store.js` 现在是本地随机 id。接真实登录时改成：

```js
wx.login({
    success(res) {
        // res.code 传给自己后端，换 openid + 会话票据
        wx.request({ url: 'https://your.api/login', method: 'POST', data: { code: res.code } });
    },
});
```

后端拿 `code` + `appid` + `secret` 调 `jscode2session` 换 `openid`，返回给前端存下来。
订单的 `userId` 字段直接换成 openid，历史本地订单的 `source: 'local-guest'` 可用于区分。

## 店长端权限

现在的前端口令（`app-config.js` 的 `adminPasscode`）只能防误触，**任何人都能改代码绕过**。

真实做法：

1. 云开发：用云函数校验 `cloud.getWXContext().OPENID` 是否在 `staff` 集合里
2. 自建后端：接口带登录态，服务端查角色，无权限直接 403

## 迁移顺序建议

1. 先接 `products`（只读），菜单来自云端，页面改 2 处
2. 再接 `orders` 写入与查询
3. 最后接支付与店长端权限

每步都能独立运行，不要一次全换。
