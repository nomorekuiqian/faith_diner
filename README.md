# 信仰充值站（原型）

每天一份“深夜菜单”：从公开推文里挑出看多论点（信仰主菜，按面值计价）和风险提醒（清醒小菜，免费，每单至少送一道）。点完菜下单，3D 小票机把小票打印出来，小票可以存成 PNG 或 PDF。每道信仰菜都写明取餐时间（验证事件）、兑现条件和作废条件。

- `/` 点菜：分类菜单、菜品详情（原来的信仰卡，右滑就是点菜）、点菜单、下单出票
- `/swipe` 滑卡：最早的右滑充值玩法
- `/calendar` 取餐日历，`/sources` 来源

- 前端：Next.js 15（App Router）+ motion（拖拽、3D 倾斜、翻面）+ canvas-confetti + three.js（小票机）+ jsPDF
- 小票：`src/lib/receipt.ts` 按 80mm 热敏纸的 576 点宽度画在 canvas 上，3D 场景的纸面、PNG、PDF 用的是同一张画布
- 后端：InsForge 项目 `faith-recharge`（`.insforge/project.json`，已在 .gitignore 里）

## 本地运行

```bash
npm install
npm run dev
```

`.env.local` 需要 `NEXT_PUBLIC_INSFORGE_URL` 和 `NEXT_PUBLIC_INSFORGE_ANON_KEY`（`npx -y @insforge/cli secrets get ANON_KEY` 可取）。

## 数据

| 表 / 视图 | 用途 | 客户端权限 |
| --- | --- | --- |
| `decks` | 每天一副牌 | 只读 |
| `cards` | 卡片内容、验证事件、作废/兑现条件、结算状态 `outcome` | 只读 |
| `verify_events` | 验证日历 | 只读 |
| `swipes` | 每台设备对每张卡的选择 | 不可直接读写 |
| `card_stats` | 每张卡的全站充值/存疑人数 | 只读 |
| `record_swipe()` / `reset_swipes()` | 记录或清除本设备的滑卡 | 可调用 |
| `orders` | 订单：单号、点的菜、小菜、合计 | 不可直接读写 |
| `deck_order_stats` | 每副牌的出单数 | 只读 |
| `place_order()` | 下单：后端按菜单价格算合计、生成单号，并把点过的菜计入全站统计 | 可调用 |

表结构在 `migrations/`。当天的牌组内容在 `data/deck-YYYY-MM-DD.json`，改完后运行：

```bash
npm run seed
```

## 已知限制

- 设备 id 存在浏览器本地，没有登录；任何人都能用伪造的设备 id 刷统计数。正式版需要限流或登录。
- 卡片里的数字来自推文，未经独立核实（卡片上已标注）。
- 牌组内容目前是手工从 MarketBrew 推文库挑选改写的，还没有自动 pipeline。
