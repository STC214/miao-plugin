# 2026-10-05 依赖兼容维护

`image-size` 更新至 `^2.0.4`。该主版本不再接受同步文件路径参数，`tools/image-size.js` 负责将文件路径或 file URL 读取为字节，并保留 `CharImg.getCardImg()` 同步返回宽高与布局信息的原有契约。未改变立绘选择、图像尺寸、渲染倍率或攻略发送行为。

`.github/tests/image-size-v2.test.mjs` 使用真实 PNG 验证 Buffer、中文文件路径、file URL 三种输入。连同原定制回归测试，执行 `node --test .github/tests/*.test.mjs`。

Yunzai 工作区其他依赖修复、锁定版本、可重装补丁、验证日志和回滚记录独立保存在维护机 `F:/Project/03_Game_Tools/Yunzai_Lotus_artifacts/dependencies-20261005/` 及 Docker `/root/Yunzai/backups/dependencies-20261005/`，不把整个框架策略写入本插件依赖。今后合并上游时应继续保留上述兼容层和回归测试。
