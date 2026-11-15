# GLaDOS 签到迁移说明

此分支参考 [badarch47/glados_checkin](https://github.com/badarch47/glados_checkin) 的签到流程、状态查询及通知结构，
在原有 TrainByte/checkin 仓库内保留账号 Cookie 和 PushPlus GitHub Actions Secrets。

## 改动
- 可从已有 `GLADOS`（每行一个 Cookie）或 `GLADOS2` 读取多账号。
- 采用网站 challenge/nonce 流程，遇到 Turnstile 失败时启用标准 Playwright Chromium 会话。
- 浏览器端仅接受 Cloudflare 自身正常签发的验证结果；如需真人验证，推送明确失败提示。
- 不使用浏览器隐身修改、自动模拟点击验证码或绕过防护的功能。
- 工作流默认不开启积分自动兑换（`AUTO_EXCHANGE=false`）。
- PushPlus 配置保持 `NOTIFY=pushplus:...`；原有 `GLADOS` 不必更名。
- 计划任务只在手动或定时触发，避免 keepalive 提交造成额外运行。

## 可选 Secrets
`GLADOS_UA` 可填写账号 1 登录浏览器的 User-Agent；第二账号若使用独立 `GLADOS2`，
可填写 `GLADOS_UA2`。如果两个 Cookie 都放在 `GLADOS` 中，则可以将两个 UA 按行放在 `GLADOS_UA`。

所有 Cookie 和通知密钥都应仅保存在 GitHub Actions Secrets，不要写入代码。

## 风险
网站若强制 Turnstile 真人验证，GitHub 托管 runner 不能代替本人完成；此时签到流程应失败并通知，而不是报告成功。
上游代码及站点协议可能发生变化，首次实测前不能保证真实签到成功。
