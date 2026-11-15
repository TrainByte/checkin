# Windows 本机 Edge 签到

此目录用于 Windows 本机部署：两个独立 Edge 会话、普通网页签到操作、PushPlus 通知和任务计划。
它不会自动操作 Cloudflare Turnstile 验证框。需要真人交互时仍须本人完成。

## 准备

Windows 10/11；Microsoft Edge；Node.js 22+；两个 GLaDOS 账号。
电脑每天 19:30（Windows 本地时间）必须处于开机、唤醒、当前用户已登录状态。若机器未开机或未登录，任务不会按时执行。

## 安装

1. 在本地克隆 https://github.com/TrainByte/checkin ，或在已有克隆目录执行 git pull。
2. 打开 PowerShell，切换到仓库中的 local 目录。
3. 运行： powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
4. 安装过程会询问 PushPlus Token，并在两个独立的 Edge 窗口中分别登录 GLaDOS。完成对应登录和人工验证后，在终端按 Enter。
5. 安装程序自动注册 GLaDOS-Edge-Checkin 任务，每天 19:30 运行。

## 运行与核验

手动执行： powershell -NoProfile -ExecutionPolicy Bypass -File .\run-local.ps1
查看日志： %LOCALAPPDATA%\GLaDOSCheckin\logs\YYYY-MM-DD.log
浏览器配置： %LOCALAPPDATA%\GLaDOSCheckin\profiles\account-1 和 account-2。
PushPlus Token 采用当前 Windows 用户 DPAPI 加密，存放于 %LOCALAPPDATA%\GLaDOSCheckin\pushplus-token.dpapi。
请勿将浏览器配置、登录凭据或上述密钥文件上传 GitHub。

## 注意

- 普通签到按钮有机会在浏览器静默通过验证后完成签到；强制 Turnstile 真人验证则报错和通知。
- 不使用原有 GitHub Secrets 的 Cookie，首次需要对两个 Edge 独立配置各登录一次。
- 不自动兑换积分。尽量先查看积分流水，避免重复签到。
- 本机任务稳定前不要依赖此方案取代已经配置的远程任务；最终应只保留一个每日定时入口。
- Windows 任务依赖交互式用户会话，锁屏和系统休眠可能影响运行；没有本机实测前无法保证成功。

停用 Windows 任务： Disable-ScheduledTask -TaskName GLaDOS-Edge-Checkin
删除 Windows 任务： Unregister-ScheduledTask -TaskName GLaDOS-Edge-Checkin -Confirm:$false
