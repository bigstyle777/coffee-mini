# 架构说明

## 分层

```
页面（pages/*）
    ↓ 只调用 store 暴露的方法
数据层（utils/*-store.js）
    ↓ 当前实现：wx.getStorageSync / wx.setStorageSync
本地存储（storage）
```

页面里没有一处直接读写 storage，也没有一处出现 `wx.request`。这是刻意的：页面只认「方法名 + `{ data, error }`」，后面换成云端调用时，页面不用改。

## 各层职责

| 文件 | 职责 | 是否依赖 wx API |
|---|---|---|
| `utils/app-config.js` | 门店参数、满减规则、支付模式、店长口令 | 否 |
| `utils/menu-data.js` | 菜单种子数据（商品、杯型、温度、糖度、加料） | 否 |
| `utils/format.js` | 金额、时间、订单号格式化 | 否 |
| `utils/menu-store.js` | 读菜单，合并店长的改价/售罄覆盖 | 是（storage） |
| `utils/cart-store.js` | 购物车增删改查、同规格合并 | 是（storage） |
| `utils/order-store.js` | 订单创建、状态机、按状态查询、今日统计 | 是（storage） |
| `utils/user-store.js` | 本地顾客身份（模拟 openid） | 是（storage） |

## 页面职责

| 页面 | 做什么 | 不做 |
|---|---|---|
| `index` | 展示菜单、加购、汇总底部栏 | 不判断能不能加（交给 menu-store 的 offline 标记） |
| `detail` | 收集规格与数量、算单价 | 不写购物车逻辑（调用 cart-store） |
| `cart` | 改数量、算优惠、提交订单 | 不判断状态流转 |
| `pay` | 模拟/真实支付、把订单推进到已下单 | 不信任前端支付结果（注释里写明以服务端回调为准） |
| `orders` | 展示订单与状态、再来一单、取消 | 不自己算状态，读 store 的 decorated 字段 |
| `admin` | 看板、接单、改价、售罄 | 不直接改 storage |
| `about` | 说明数据与隐私、清空数据 | — |

## 数据流：一次下单

```
detail 页选规格
   → cartStore.add({ productId, specText, unitPrice, qty })
   → cart 页 cartStore.list() 展示，算 subtotal / discount / total
   → orderStore.create(...) 落一张 status=unpaid 的订单
   → 跳 pay 页，orderStore.get(orderId) 取金额
   → 支付成功 orderStore.updateStatus(id, 'placed')
   → 跳 orders 页，orderStore.list() 展示
   → 店长端 updateStatus: placed → making → ready → done
```

## 关键设计决策

### 1. 为什么用覆盖表存菜单改动

如果店长改价时把整份菜单写进 storage，那么以后改了 `menu-data.js` 的默认值（比如新增商品），老用户的 storage 里还是旧菜单，出现「代码更新了但用户看不到」。

覆盖表只存「被改过的字段」：`{ p01: { price: 20 }, p02: { offline: true } }`。读取时与种子数据合并，新增商品自动对所有人可见。

### 2. 为什么状态机放在数据层

页面按钮显示与否（`canStart` / `canReady` / `canFinish`）和状态流转合法性都由 order-store 统一算。页面只要绑 `data-next`，天然不会出现「已完成还能再点接单」。

### 3. 为什么顾客身份是本地随机串

真机上没有后端就拿不到 openid。这里随机生成一个 `u...` 存本地，让订单能归属到「某个人」，同时 `source: 'local-guest'` 标记来源，以后接真实登录时可以区分历史数据。

### 4. 商品图为什么是 CSS 渐变

远程图片在小程序里要配 downloadFile 合法域名，本地图又会把包体积做大。演示项目用渐变 + 单字既省体积又不依赖网络，视觉上也统一。真实项目换成 `<image>` + 云存储即可。

## 包体积

没有 npm 依赖、没有第三方组件库、没有图片资源，整包远小于 2MB 主包限制。真实项目加图片后再考虑分包。
