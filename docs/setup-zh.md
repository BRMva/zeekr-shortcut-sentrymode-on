# 只用 Cloudflare 账号安装（不需要 GitHub）

适合没有 GitHub 账号的情况：在 Cloudflare 控制台新建一个 Worker，把程序文件粘贴进去，再手动设置几项。
装好后和一键部署的效果完全一样，每 5 分钟自动检查一次。

有 GitHub 账号的话，更推荐用 [一键部署](../README.md#一键部署分步骤操作)，步骤更少。

**开始前**，先按 README 里的 [准备四样东西](../README.md#开始前准备四样东西) 准备好副账号和地点（这种方式不需要 GitHub 账号）。
**只装一份：** 同一个极氪副账号装两份，两边会互相把对方挤下线。

括号里是英文界面的叫法，中文界面的措辞可能略有不同。

## 第 1 步：新建 Worker

登录 Cloudflare 控制台 → 左侧 **Workers 和 Pages**（Workers & Pages）→ **创建**（Create）。
在"创建新项目"页面选 **从 Hello World! 开始**（Start with Hello World!），名称填 `zeekr-sentry` → **部署**（Deploy）。

不要选 "Upload your static files"：那是放静态网页用的，程序不会运行。

## 第 2 步：粘贴程序

部署成功后点 **编辑代码**（Edit code），把编辑器里原有的代码全部删掉。
在浏览器打开 https://github.com/dts88/zeekr-shortcut-sentrymode-on/blob/main/dist/zeekr-sentry.js ，点右上角的 **Copy raw file** 复制全部内容，粘贴进编辑器，点 **部署**（Deploy）。

这时打开这个 Worker 的网址（Worker 页面上显示的 `...workers.dev` 地址），能看到版本号和"还缺哪些设置"的清单，说明程序已经在运行。

## 第 3 步：建存储空间并绑定

- 左侧菜单 **存储和数据库**（Storage & Databases）→ **Workers KV** → **创建实例**（Create instance），名称随意（例如 `zeekr-sentry-state`）→ **创建**（Create）。找不到菜单时，在顶部搜索框输入 `KV`。
- 回到 `zeekr-sentry` → **绑定**（Bindings）→ **添加绑定**（Add binding）→ 选 **KV 命名空间**（KV namespace）→ **添加绑定**。
- **变量名称**（Variable name）**必须填 `STATE`**（全大写，没有空格）；**KV 命名空间**选刚建的那个 → **添加绑定**保存。

## 第 4 步：加定时

`zeekr-sentry` → **设置**（Settings）→ **触发事件**（Trigger Events）→ **添加**（Add）→ **Cron 触发器**（Cron Triggers）。
有频率选项就选"分钟"、填 `5`；只有一个输入框就填 `*/5 * * * *`。保存。新加的定时最多要 15 分钟才开始运行。

## 第 5 步：填三项设置

`zeekr-sentry` → **设置** → **变量和机密**（Variables and Secrets）→ **添加**（Add），三项的类型都选 **Secret**（中文界面可能叫"密钥"）：

| 名称 | 填写内容 |
|---|---|
| `ZEEKR_EMAIL` | 副账号的邮箱 |
| `ZEEKR_PASSWORD` | 副账号的密码 |
| `GEOFENCES` | 准备好的地点，例如 `Home, 1.3521, 103.8198, 600` |

## 第 6 步：确认运行

- 刷新 Worker 的网址，应显示 `Setup is complete`。还缺什么，页面上会直接列出来。
- 打开 **日志**（Logs）。如果是空的，到 **设置** → **可观测性**（Observability）打开 Workers Logs。
  按事件类型筛选 `scheduled`，就只看定时运行的记录。下一次运行应出现 `logging in`、`logged in (... account, region ...)` 和一行车况。

Worker 的网址任何人都能打开，但页面上只有版本、出处和设置项的名称，不含邮箱、密码和地点。
日志里偶尔出现陌生地区访问网址的记录，多是网上的自动扫描，不用理会。

## 之后

看运行记录、修改设置、暂停、卸载和常见问题，见 README 的 [日常使用](../README.md#日常使用) 和 [常见问题](../README.md#常见问题)。

两处不同：
- **卸载**时没有 GitHub 副本仓库要删；
- **升级**时，到第 2 步的链接复制新版本的文件，在 **编辑代码** 里整体替换后点 **部署** 即可，设置不用重填。
