# 2026-11-17 原上游合并与独有功能保留

## 版本范围

- fork 原版：`6645c2da14ca82106f79a124c05c38f86e7bb622`。
- 原上游：`yoimiya-kokomi/miao-plugin` 的 `3ad97bd1dc26fc1844ac853ea4482f2c8cca7985`。
- 使用保留两个父提交的 merge，不改 origin、不变更更新分支、不用上游整体覆盖 fork。
- 上游新增原神 7.3、星铁 4.7 数据、阿哈计算和光锥图片、瓦列里伤害、米提亚评分 / 组队计算，以及套装、日历和图片尺寸兼容修复。提交数量含合并提交，不等同于独立功能数量。

## 保留原则与重叠文件

圣遗物 4–200 件、40 件起分页、合并转发、逐页降级与重试、签到让行、大列表禁用超分，抽卡完整统计分页与欧皇图、模型映射、星辉冰旋和现有面板网关入口保持。与上游不重叠的 fork 运行文件按 Git 内容逐项比对；不只检查提交仍在历史中。

重叠部分：`apps/gacha/GachaData.js`、`models/character/CharImg.js`、`resources/meta-gs/artifact/calc.js`、`resources/meta-gs/weapon/catalyst/calc.js`。合并后继续运行现有自有功能测试，保留 `tools/image-size.js` 的同步路径 / 字节兼容接口；CharImg 接入上游读 Buffer 的修复，未改回上游直接调用 image-size 的依赖方式。

上游移除 `moment` 依赖声明，本 fork 继续保留此前的 `moment: ^2.31.0`，避免本次更新顺带改变依赖解析。新增 `components/Moment.js` 的兼容层仍保留；原生 Moment 走原实现，检测到 dayjs 才补齐插件和兼容方法。本次不重装运行依赖、不改变工作区 ONNX 构建策略。

## 代码级回归

新增 `.github/tests/upstream-20261117.test.mjs` 五项：

1. 饰金默认两名不同元素队友，以及显式 1/2/3 人条件下的精通和攻击比例。
2. 「贪噬禁果的异端」二件套使用 `cdmg: 16` 而不是暴击率。
3. 亚空异容所进场速度 145 边界和全队重复效果排除。
4. 神的瞬息欢愉进场欢愉 40 边界，不额外添加单次伤害倍率。
5. 本地 Moment 声明和 image-size 适配入口保留。

```sh
node --test --test-reporter=tap .github/tests/*.test.mjs
node --experimental-vm-modules tools/test-hsr-47-calc.mjs
git diff --check
```

原版 39 项通过；新增后 44 项，Windows 连续两轮通过。所有变更 JS / MJS 做语法检查，JSON 做解析检查。星铁 4.7 实际计算链测试需要机器人框架 lodash；维护机隔离目录缺少该依赖时明确记录，不把环境错误当成计算通过，交由软路由隔离副本复验。

## 部署、验收与回滚

证据目录：维护机 `NON_BLOG_PROJECTS/deploy/plugin-update-20261117/`，软路由 `/mnt/sda4/TRSS-Yunzai/yunzai/backups/plugin-update-20261117/`。保存原版增量包、更新包、二进制补丁、逐条命令 / 输出 / 退出码、保留文件清单与回滚程序。公开仓库不含账号、Cookie、节点口令或实际运行配置。

先在隔离副本执行更新 / 回滚 / 再应用测试，再快进部署；禁止强制拉取覆盖工作区。完成后核对本地、容器和 fork 提交一致，并确认插件加载、QQ / OneBot、验证码与缓存网关健康。验收不发送群消息，不执行签到、兑换等账号操作。详细最终结果以维护目录验收记录为准，不声称无限覆盖全部第三方接口。

```sh
# 在软路由执行，只回退此次两插件更新，不强推远端，不删依赖 / 数据：
python3 /mnt/sda4/TRSS-Yunzai/yunzai/backups/plugin-update-20261117/rollback.py --apply
```

回滚先检查已知提交、跟踪文件无后续编辑、原始包和更新包哈希，再用补丁反向应用恢复基线；对后来未知改动保护性停止。若机器人已加载新版，回滚后需重启机器人进程使其加载旧代码。
