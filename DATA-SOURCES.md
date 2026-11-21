# 食物 / 条码数据源调研

调研时间：2026-11-21。目标：给轻卡找一个可以内置、覆盖新西兰和中国常见食品的「条码 + 营养」公开数据库。

## 一句话结论

**没有可以直接内置的「新西兰 + 中国全量条码库」。** 公开数据里只有 Open Food Facts 是真正的全球条码库（约 493 万条），但它在新西兰的覆盖一般、在中国只有约 1800 条；新西兰和中国的官方食物成分库（NZFCD、中国食物成分表）都**不允许转分发**。所以可行方案是「内置精选包 + 在线兜底 + 用户自己的食物库（可导出/导入）」，而不是塞一个全量库。

## 已核实的公开数据源

| 数据源 | 规模 | 有条码 | 新西兰 | 中国 | 许可 | 能否内置 |
| --- | --- | --- | --- | --- | --- | --- |
| [Open Food Facts](https://world.openfoodfacts.org/data) | 4,926,773 条商品 | 是 | 有，数量中等 | 约 1,802 条 | ODbL | 可以（需署名 + 衍生库同样 ODbL） |
| [OpenNutrition](https://www.opennutrition.app/download) | 326,759 条食物，313,442 条有 EAN | 是 | 无 | 无 | ODbL | 对中新无帮助（条码全是美国/加拿大前缀） |
| [USDA FoodData Central](https://fdc.nal.usda.gov/) | Branded 约 130 万条 | 有 GTIN/UPC | 少量 | 少量 | 公共领域 | 可以，但以美国商品为主 |
| [NZ Food Composition Database](https://www.foodcomposition.co.nz/) | 3,400+ 种食物 | 否（通用食物） | 权威 | — | 保留所有权利 | **不可以**转分发 |
| 中国食物成分表（CFCT） | 数千种 | 否 | — | 权威 | 版权保护 | **不可以**直接内置 |
| GS1 新西兰 / 中国 | 官方商品库 | 是 | 全 | 全 | 商业授权 | 不可以 |

### 细节

**Open Food Facts（OFF）**

- 全球约 493 万条商品，数据库用 ODbL，图片 CC-BY-SA。
- 官方导出：CSV 约 0.9 GB（解压约 9 GB）、MongoDB dump、JSONL、Hugging Face 上的 Parquet；API 适合单次扫码查询。
- API 使用条款：**1 次 API 调用 = 1 次真实扫码**，不要用 API 批量抓库；批量要用官方 dump。
- 中国覆盖非常少：查询 `countries_tags_en=china` 只有 **1,802** 条。
- 新西兰查询在调研时多次返回 503（服务端限流/超时），未能拿到稳定数字；需要做包时用 dump 里的 `countries_tags` 过滤。

**OpenNutrition**

- 326,759 行、313,442 行有 EAN-13；其中 297,811 行热量 + 三大营养素齐全。
- 数据包含 `ean_13`、`nutrition_100g`、`type`（grocery / everyday / restaurant / prepared）。
- 但**所有条码前缀都是 000–099（美国/加拿大）**：690–699（中国）0 条，940–949（新西兰）0 条。它是美国零售商品库，不适合直接做中新条码。
- ODbL，要求署名 OpenNutrition 并链接官网；衍生库同样 ODbL。

**USDA FoodData Central**

- Branded Foods 约 130 万条，带 GTIN/UPC，公共领域（CC0），可自由使用；但以美国市场为主。
- 适合补充全球品牌（可口可乐、雀巢等），对中新本地商品帮助有限。

**新西兰 NZFCD / FOODfiles**

- 3,400+ 种新西兰常见食物，是新西兰最权威的通用食物成分数据。
- 网站明确「保留所有权利」，使用受 Terms of Use 约束；**不能打包进 App 再分发**。
- 可考虑让用户自己去官网下载后导入（如果条款允许个人使用），但不适合内置。

**中国食物成分表（CFCT）**

- 版权归中国疾病预防控制中心营养与健康所等所有，书籍/数据库形式出版，**不能直接内置**。
- GitHub 上有些派生数据集（如 `ZHYmax/Food-composition-dataset`），但没有明确开源许可，不能作为商业/公开 App 的数据底座。

**GitHub 上的项目**

- [openfoodfacts/openfoodfacts-server](https://github.com/openfoodfacts/openfoodfacts-server)：OFF 的服务端与数据，代码 AGPL，数据 ODbL。
- [deadletterq/mcp-opennutrition](https://github.com/deadletterq/mcp-opennutrition)：OpenNutrition 的 MCP 服务，代码 MIT，数据 ODbL；数据本身是美国条码。
- 没有找到维护良好、许可证清晰的「中国超市条码库」或「新西兰超市条码库」仓库。

## 建议的架构（分层）

| 层 | 内容 | 体积 | 说明 |
| --- | --- | --- | --- |
| 1. 内置通用食物 | 现在 90 种，可扩到 300 种中新家常食物 | 几十 KB | 米饭、鸡蛋、青菜、牛羊肉、Kiwi 常见食材；不带条码 |
| 2. 内置精选条码包 | 从 OFF 按国家 + 完整营养过滤，NZ/CN 各 1,000–3,000 条 | 每包 150–400 KB | 需 ODbL 署名；扫码先查它 |
| 3. 在线兜底 | OFF 单条查询（现在已接） | 0 | 长尾商品；中国可能慢/少 |
| 4. 用户食物库 | 用户扫码/手动保存的食物 | 0 | 已支持导出/导入条码包，可分享 |

不建议把 493 万条塞进 PWA：压缩后约 1 GB，手机内存和启动解析都扛不住，而且 ODbL 的 Share-Alike 要求衍生库同样开放。

## 如果要内置精选包，怎么做

1. 用 OFF 官方 dump（Parquet + DuckDB 最方便），筛：
   - `countries_tags` 含 `en:new-zealand` 或 `en:china`
   - `code` 为 8–14 位数字
   - `nutriments.energy-kcal_100g`、`carbohydrates_100g`、`proteins_100g`、`fat_100g` 都存在
   - 优先 `unique_scans_n` 高的商品
2. 产出 `packs/nz.js`、`packs/cn.js`，格式同「食物库导出包」：
   ```json
   {"type":"qingka-food-pack","version":1,"source":"Open Food Facts (ODbL)","items":[...]}
   ```
3. App 里懒加载这两个包，扫码时先查本地包，再查 OFF API。
4. 在「关于」页和包里保留署名：
   > Contains data from Open Food Facts, available under the Open Database License (ODbL).

## 合规注意

- **OFF**：署名 + 衍生数据库同样 ODbL；如果 App 允许用户补充商品，最好把贡献回传 OFF（他们的条款鼓励这样做）。
- **OpenNutrition**：署名 + 链接 + 衍生库 ODbL。
- **NZFCD / 中国食物成分表**：不要打包再分发；如要商用/公开分发，需要单独授权。
- **条码前缀**只是 GS1 分配国，不等于商品销售国；用国家标签过滤更准。

## 已内置的数据（v1.2）

**通用食物库：286 种**

- `js/foods.js`：83 种基础食物（米面、肉蛋、蔬菜、水果等）
- `js/foods-extra.js`：203 种扩展食物
  - 中式菜肴 35 种（红烧肉、宫保鸡丁、麻婆豆腐…）
  - 中国常见食材 100+ 种（猪牛羊部位、河鲜、豆制品、时令蔬菜水果）
  - 新西兰常见食物 19 种（羊排、鹿肉、库马拉、斐济果、Pavlova、肉派、Marmite、Weet-Bix、Flat White…）

**新西兰包装条码包：2,500 条**

- 文件：`js/packs/nz.js`（约 191 KB）
- 来源：Open Food Facts 官方 CSV dump 中 `countries_tags` 含 `en:new-zealand` 的商品
- 筛选：条码 8–14 位、热量与三大营养素齐全、宏量总和 ≤ 100g
- 排序：按 `unique_scans_n`（扫码热度）取前 2,500 条
- 结果：匹配到 13,254 条新西兰商品，选前 2,500 条；包含本地品牌和在新西兰销售的进口商品
- 重新生成：

```powershell
python tools/build_pack.py --csv <OFF CSV dump> --country new-zealand \
  --out js/packs/nz.js --var NZ_PACK --title "新西兰包装食品" --limit 2500
```

署名（ODbL 要求）：

> Contains data from Open Food Facts, available under the Open Database License (ODbL).

## 下一步（待定）

- [x] 新西兰精选条码包（2,500 条）
- [x] 通用食物库 83 → 286
- [ ] 中国条码包（OFF 只有 1.8k 条，覆盖率有限，待定）
- [ ] 定期更新新西兰包（比如每季度用最新 dump 重新生成）
- [ ] 中国条码：如果 OFF 覆盖不够，是否接受接一个按次计费的国内条码 API（约 0.01–0.05 元/次）？
- [x] 用户食物库导出 / 导入（条码包）
