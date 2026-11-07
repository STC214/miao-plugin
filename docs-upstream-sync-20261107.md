# 2026-11-07 原上游同步与重复复审

## 版本与范围

- 原版本：`b750c3b40a6217ffab1f93830ed80a7692601944`。
- 合入原上游：`9d8972c2b060ede67d1b0dc7565abb4fe39b3aa7`，7 提交，含合并提交。
- 首次合并：`322e1f20897f17f6e8235a307024e4a89579f779`。
- 复审仅新增本文件和 `.github/tests/upstream-20261107.test.mjs`；不继续追入新的上游版本。
- Lotus、面板网关、账号数据、喵喵运行配置和既有自定义功能不变。

## 六个上游文件逐项审查

### 角色属性

`models/attr/Attr.js#setCharAttr` 的特有角色数组新增：

```js
{ id: 10000136, attrs: { mastery: 100 } }
```

此值通过 `addAttr('mastery', 100, true)` 加到基础区，不是额外 Buff。原有菈乌玛 200、奈芙尔 100、旅行者 15 精通保留。星铁分支在此之前返回，不会套用原神角色 ID 的固定加成。

`resources/meta-gs/character/data.json` 和 `resources/meta-gs/character/米提亚/data.json` 两份 `talentId` 一致：

```json
{ "11361": "a", "11362": "e", "11364": "q" }
```

只把错误的爆发编号 11365 修正为 11364，普通攻击、战技和命座加级定义未变。

### 圣遗物评分

`resources/meta-gs/character/奥黛塔/artis.js` 将高命条件由 `cons >= 2` 改为 `cons >= 4`。四命及以上的充能权重为 50；零至三命沿用默认权重。计算先复制默认权重，不改写共享的 `usefulAttr`。复审验证 0–6 命并返回低命，排除高命计算污染后续请求。

### 武器静态/条件加成

`resources/meta-gs/weapon/index.js` 的实际 `step` 规则为起始值每级增加四分之一；`attr`（传给武器配置的 `staticStep`）生成 `isStatic: true` 和 `refine` 数组。

| 武器 | 面板静态项 R1→R5 | 伤害计算条件项 R1→R5 |
| --- | --- | --- |
| 漩流颂歌 | 治疗加成 4→8 | 治疗后生命百分比 21→42 |
| 究极霸王超级魔剑 | 攻击百分比 12→24 | 额外攻击百分比 12→24 |

审查调用链：

```text
weapon/index.js 的 step/attr
  -> catalyst/calc.js 或 claymore/calc.js
  -> Attr.setWeaponAttr：只累计 isStatic
  -> Weapon.getWeaponAffixBuffs(affix, false)
  -> DmgBuffs.getWeaponBuffs：排除静态项，只留下条件项
```

测试执行真实函数体，而不是只匹配源码字符串；覆盖精炼 1–5、非顺序切换精炼等级、静态/动态分离和武器标题不重复拼接。

## 自定义功能保护

圣遗物 4–200 件、40 件起分页、合并转发和逐页失败降级、重试、签到让行、高数量禁用超分；完整抽卡统计分页、欧皇图及模型映射；星辉冰旋计算和 image-size v2 兼容均保留。此次六个文件之外的运行源码没有变化，六个文件中的本地增强也未被上游覆盖。

## 验证命令

在插件根目录运行，命令适用于 Linux；Windows 可显式展开测试文件列表：

```sh
node --test --test-reporter=tap .github/tests/*.test.mjs
node --check .github/tests/upstream-20261107.test.mjs
git diff --check
```

原有 31 项加新增 8 项，共 39 项。维护机保留两轮输出及容器验收输出，成功/失败、退出码均按实际记录；未向 QQ 群发送测试消息。

## 容器启动的 ONNX 构建策略

实测容器入口 `/entrypoint.sh` 每次执行 `pnpm install --force`。工作区未声明 ONNX 构建策略时，包管理器会写入无效的占位文字。此前仅移除占位行属于临时处理，重启会重现。

正式处理是在工作区原 `allowBuilds` 下显式添加一行：

```yaml
allowBuilds:
  # 其余既有项原样保留
  onnxruntime-node: false
```

不改变已有 native 模块或模型，不重新下载，不改机器人入口，不改 Lotus 源码。部署记录保存原始文件、精确差异、哈希以及两次真实重启的前后记录；验收不能再调用“删除占位行”的临时补救。若日后主框架更新重置工作区文件，应保留或重新应用这一显式策略。

## 交付和回滚

维护机相对工作区的证据目录：`NON_BLOG_PROJECTS/deploy/miao-update-20261107/review/`。其中包含增量 Git 包、精确补丁、原版与更新版的字面命令和输出、运行配置快照及回滚入口。私有配置只在维护机/软路由留存，不提交到公开仓库。

回滚只接受本次已知提交及工作区哈希，检测到后续用户改动则停止；不清理账号、缓存或依赖。远端已推送历史不强制重写，如需撤销公开提交应使用保留历史的 revert。自动测试及运行健康检查不代表每条线上聊天命令都已人工实测。
