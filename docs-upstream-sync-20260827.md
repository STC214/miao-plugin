# miao-plugin 上游自动同步与定制保护记录（2026-08-27）

> 记录范围：2026-08-27 对 `STC214/miao-plugin`、容器部署和上游同步策略所做的修改、验证结果及后续维护方法。

## 1. 自动更新与自动合并配置（最先阅读）

Fork 仓库：`https://github.com/STC214/miao-plugin`

上游仓库：`https://github.com/yoimiya-kokomi/miao-plugin`

本次在 Fork 中加入 GitHub Actions：

```text
.github/workflows/sync-upstream.yml
```

工作流每天北京时间 12:20（UTC 04:20）自动运行，也可以在 GitHub 的 Actions 页面使用 Run workflow 立即运行。

执行链路如下：

```text
获取 upstream/master
    ↓
更新 upstream-sync 分支
    ↓
在临时工作树合并上游
    ↓
语法检查
    ↓
定制功能单元检查
    ↓
无冲突且检查通过时创建 PR
    ↓
启用自动合并
```

需要在仓库网页开启一次：

```text
Settings → General → Pull Requests → Allow auto-merge
```

该设置只影响 PR 是否可以自动合并，不影响每日任务运行。开启后，无冲突、语法检查通过且单元检查通过的 PR 会自动合并；发生冲突或检查失败时，`master` 不会改变。

## 2. 分支职责

| 分支 | 用途 |
| --- | --- |
| `master` | 生产分支，包含我们的定制功能，Yunzai 容器跟踪此分支 |
| `upstream-sync` | 只保存上游最新内容，用于对照，不放置本项目定制提交 |
| Actions 临时工作树 | 将上游合并到 Fork 的 `master`，通过检查后生成 PR |

不要使用 Fork 页面上的强制同步功能，否则可能覆盖定制提交。

## 3. 本次提交

```text
c4292af2 20260827155000 修正自动同步PR生成流程
39a2abd1 20260827154500 为上游同步增加自动合并检查
0567f458 20260827153000 自动同步上游并保护自定义修改
 aa622969 2026082714 修复圣遗物列表转发图片内容
```

其中 `aa622969` 修复了圣遗物列表多图转发内容，后三个提交完成自动同步、检查和自动合并配置。

## 4. 重点保护的定制文件

上游 PR 合并前必须重点查看：

```text
apps/profile/ProfileArtis.js
apps/profile.js
components/common/Render.js
config/system/cfg_system.js
README.md
```

当前定制行为包括：

- `#圣遗物列表数量` 支持 4～200；
- 数量达到 40 时按每 24 个圣遗物分页；
- 多页结果合并成一条转发消息；
- 每页按顺序渲染，不并行占用资源；
- 数量达到 96 时关闭额外超分；
- 图片使用 `retType: 'base64'`，避免渲染函数先逐张发送后再转发；
- Lotus 签到协调器仍在分页之间和最终发送前生效。

## 5. 自动检查内容

工作流执行以下语法检查：

```bash
node --check apps/profile/ProfileArtis.js
node --check apps/profile.js
node --check components/common/Render.js
node --check config/system/cfg_system.js
```

定制单元检查文件：

```text
.github/tests/customization.test.mjs
```

检查项目：

- 分页步长仍为 24；
- 转发构造函数仍存在；
- 图片仍返回 Base64；
- 数量上限仍为 200；
- 96 条以上仍保留禁用超分逻辑。

本地验证结果：

```text
3 tests passed
0 tests failed
```

## 6. 日常查看与合并

1. 打开 `https://github.com/STC214/miao-plugin`。
2. 进入 **Pull requests**。
3. 查看标题“同步 miao-plugin 上游更新”的 PR。
4. 在 **Files changed** 检查重点文件。
5. 查看 Actions 检查是否通过。
6. 无冲突且行为正常时，自动合并会执行；若仓库策略要求人工确认，则点击 **Merge pull request**。

也可以使用分支比较页：

```text
https://github.com/STC214/miao-plugin/compare/master...upstream-update
```

## 7. 冲突与回滚

如果上游修改了同一重点文件，工作流会停在 PR，不修改 `master`。解决冲突后重新运行检查，再合并 PR。

发现合并后功能异常，优先使用反向提交回滚：

```bash
git log --oneline --graph -10
git revert -m 1 <合并提交ID>
git push origin master
```

容器内更新：

```bash
cd /root/Yunzai/plugins/miao-plugin
git pull --ff-only
```

检查当前版本：

```bash
git log -1 --oneline
git status --short
```

`git revert` 会保留完整历史，适合生产环境。只有在明确需要重写远程历史时才使用 `reset --hard` 与 `push --force-with-lease`。

## 8. 容器更新注意事项

容器中的 `miao-plugin` 应跟踪 Fork 的 `master`，不要把 `upstream-sync` 作为运行分支。只有 PR 合并后，容器执行 `#全部更新` 才会取得上游新版本。

Lotus-Plugin 的签到优先级代码属于独立仓库，不由 miao-plugin 上游同步工作流修改。更新 miao-plugin 不会覆盖 Lotus 的签到协调器。

## 9. 本次最终状态

- Fork 已配置 `upstream` 远程；
- `upstream-sync` 已推送；
- 自动同步工作流已推送到 `master`；
- 语法检查和定制单元检查通过；
- 自动合并开关已在 GitHub 网页开启；
- 发生冲突时 `master` 保持不变；
- 当前定制功能具备可审查、可回滚、可持续更新能力。
