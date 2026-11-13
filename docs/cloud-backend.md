# 云端后端：让两台设备看到同一份订单

这份文档说明云端模式**实际是怎么实现的**，以及它和真正能上线之间还差什么。

如果你只想知道怎么跑起来，看 README 的「两种运行模式」。

---

## 一、核心思路：只换数据层，页面不动

页面从不直接读 storage 或发请求，只调用一个统一接口：

```
pages/*  ──►  utils/data/index.js  ──┬──►  utils/data/local-orders.js  ──►  wx.getStorageSync
                                     └──►  utils/data/cloud-orders.js  ──►  托管后端的 PostgreSQL
```

`utils/data/index.js` 按 `utils/app-config.js` 里的 `dataSource` 二选一。

两个实现的**方法名、参数、返回结构完全一致**，而且都返回 Promise：

```js
ordersApi.list()                      // → Promise<{ data, error }>
ordersApi.create(payload)             // → Promise<{ data, error }>
ordersApi.updateStatus(orderId, next) // → Promise<{ data, error }>
ordersApi.stats()                     // → Promise<{ data, error }>
```

所以页面里没有任何 `if (是云端) ... else ...`。这也是这次改造唯一的架构决定：**把"数据从哪来"收敛到一个文件**。

一个细节：`local` 的底层是同步的，但接口统一包成 Promise。麻烦一点点，换来的是切换数据源时页面零改动。

---

## 二、数据库表

```sql
CREATE TABLE orders (
  id             TEXT PRIMARY KEY,          -- 与本地一致的字符串 id，页面拿它做跳转参数
  order_no       TEXT NOT NULL UNIQUE,      -- 展示用的订单号 SG...
  user_id        TEXT,
  status         TEXT NOT NULL DEFAULT 'unpaid',
  items          JSONB NOT NULL,            -- 订单行快照，下单时的名称与价格
  item_count     INTEGER NOT NULL DEFAULT 0,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,-- 金额一律存「分」的整数
  discount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents    INTEGER NOT NULL DEFAULT 0,
  pickup_name    TEXT,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at        TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
)
```

两个刻意的选择：

**金额存分，不存元。** `0.1 + 0.2 !== 0.3` 在收银场景是真事故。数据库存整数分，`cloud-orders.js` 在读写边界做一次 `×100 / ÷100`。

**订单行用 JSONB 快照。** 订单里存的是**下单当时**的商品名和单价，不是指向 `products` 表的外键。这样店长明天改价，昨天的订单金额不会跟着变——这是订单系统的硬要求，不是偷懒。

---

## 三、权限：现在是开放的，这是故意的，也是必须改的

```sql
CREATE POLICY orders_read_all   ON orders FOR SELECT TO authenticated, anon USING (true)
CREATE POLICY orders_insert_any ON orders FOR INSERT TO authenticated, anon WITH CHECK (true)
CREATE POLICY orders_update_any ON orders FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true)
CREATE POLICY orders_delete_any ON orders FOR DELETE TO authenticated, anon USING (true)
```

四个策略全是 `true`，意味着**任何能访问这个应用的人都能读、写、删全部订单**。

为什么这样设计？因为需求本身就是"店长要读所有人的订单"，而这个 demo 没有登录体系。在只有前端口令、没有服务端身份的前提下，做不到既跨设备读、又按人隔离。硬要写一套 `owner_id = auth.uid()`，结果是店长端一行都读不到——那种"看起来安全"其实是功能直接坏掉。

这个选择的教育意义在这里：**你可以亲手验证它有多不安全**。打开两个客户端，一个下单，另一个能直接把状态改掉、甚至删掉你的订单。真正的权限必须落在服务端角色上，前端的任何判断都只是界面。

生产环境至少要：

1. 用 `auth` 模块登录，拿到真实身份；
2. 建 `staff` 表记录哪些 uid 是店员；
3. 策略改成 `USING (EXISTS (SELECT 1 FROM staff WHERE staff.uid = auth.uid()))`；
4. 顾客的写权限限制为只能插自己的单；
5. 删掉 `orders_delete_any`，清空数据只允许服务端做。

---

## 四、SDK 初始化

```js
// utils/cloud-client.js
const { createMiniProgramWorkBuddyCloud } = require('@tencent-ai/workbuddy-cloud-sdk/miniprogram');
const { createDiagnosticWx } = require('./workbuddy-cloud-diagnostics.js');

const cloud = createMiniProgramWorkBuddyCloud({
    endpoint: config.cloud.endpoint,             // 来自开通云服务返回的 publicConfig
    publishableKey: config.cloud.publishableKey, // 同上
    wx: createDiagnosticWx(wx),                  // 请求失败时在 vConsole 里打出可定位日志
});
```

- `endpoint` 和 `publishableKey` 必须来自 `publicConfig`，不要自己拼。
- 这两个值是**公开配置**，会进小程序包，`publishableKey` 只表明"是哪个应用"、本身不带任何权限。但本仓库里留的是**占位符**：填别人开源出来的值，你的订单就会写进别人的库。
- `createDiagnosticWx` 是官方提供的小程序请求诊断包装，请求失败时会在 vConsole 打印失败阶段与 HTTP 状态，排查域名白名单问题全靠它。

小程序端**必须执行「构建 npm」**（开发者工具 → 工具 → 构建 npm），SDK 才会被复制进 `miniprogram_npm/`。没执行时 `utils/data/index.js` 会捕获加载失败并返回 `CLOUD_SDK_NOT_BUILT`，页面给出提示而不是白屏。

---

## 五、店长端怎么知道"来了新单"

用**轮询**：进入店长端后每 5 秒重新拉一次列表和统计，页面切到后台就停掉定时器。间隔在 `app-config.js` 的 `orderPollInterval` 里改。

```js
startPolling() {
    const page = this;
    this.pollTimer = setInterval(function () { page.refresh(); }, interval);
}
```

选它是因为**最容易看懂**，而且它的缺点正好是教学点：

| 方案 | 延迟 | 代价 |
|---|---|---|
| 轮询（当前） | 0 ~ 5 秒 | 空请求多，人多了费配额 |
| 订阅消息 | 即时 | 要申请模板、要服务端触发 |
| WebSocket | 即时 | 要维护长连接 |

一个真实的坑：轮询期间如果店长正在某个 tab 里操作，列表会突然刷新。演示能接受，真要上线应该做增量合并或者用订阅推送。

---

## 六、怎么验证它真的通了

```bash
npm install                 # 装 SDK
node scripts/cloud-smoke-test.js
```

跑之前先把 `utils/app-config.js` 里的 `cloud.endpoint` 与 `cloud.publishableKey` 填成你自己的（仓库里是占位符，不填会直接连不上）。

这个脚本不用开发者工具，直接打真实后端。它做的是：

1. 用 `wx` 垫片（storage 用内存、`request` 用 Node 的 fetch）造一个最小运行环境；
2. 切到 `dataSource = 'cloud'`；
3. **顾客端**下单 → 校验写入成功、初始状态、金额按分往返无损；
4. **另建一个 api 实例**（相当于另一台设备）→ 必须先读到刚才那一笔；
5. 店长接单 → 校验状态流转与 `canStart`；
6. 重复接单 → 必须返回 `INVALID_TRANSITION`；
7. 校验经营统计；
8. 删掉脚本自己造的测试数据。

当前结果：**10 项断言全部通过**。

它验证的是数据面与映射逻辑，**不验证微信的域名白名单**——那必须在模拟器或真机里才看得见。真机上如果失败，先看 vConsole 里 `[WorkBuddy Cloud] request failed` 打印的 `stage` 与 `status`，再对照 `endpoint` 是否已加入小程序的 request 合法域名。

---

## 七、还差什么才能真上线

| 缺的东西 | 为什么必须补 |
|---|---|
| 登录 + 店员角色 | 现在任何人都能改、能删你的订单 |
| 状态流转的服务端原子性 | 现在是「读→校验→写」，两个人同时点可能都通过。应改成数据库函数 |
| 真实支付 | 需要企业主体 + 商户号，见 `docs/launch-checklist.md` |
| 请求域名白名单 | 真机不允许访问未备案的域名 |
| 菜单同步 | 目前菜单与购物车仍在本机，店长改价不会同步到顾客手机 |
| 数据分页与归档 | `list()` 固定取最近 200 条，长期运行要有归档策略 |
