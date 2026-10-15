# 极氪哨兵自动开启 · 安装指南

车停好、锁上之后，如果不在你设定的地点（家、公司等）附近，程序会自动帮你打开哨兵模式。
程序运行在你自己的 Cloudflare 账号里（免费），不用自己准备服务器，全部在网页上点选完成。

## 第一步：准备两样东西

**1. 一个副账号**

在极氪 App 里把车分享给另一个极氪账号（没有的话，用另一个邮箱注册一个）。
程序用这个副账号登录。不要用你手机上正在用的主账号，否则手机 App 会被登出。

**2. 不需要自动开哨兵的地点（最多 10 个）**

在 Google 地图上右键点这个地点，弹出的第一行就是经纬度，点一下即可复制。
每个地点写成「名称, 纬度, 经度, 半径（米）」，多个地点用英文分号 `;` 隔开，例如：

```
Home, 1.3521, 103.8198, 600; Office, 1.2840, 103.8510, 600
```

半径可以不写，默认 600 米：地下停车场里车的定位常会偏出几百米，半径太小会把"在家"误判成"在外"。
如果附近有你希望照常自动开哨兵的地方（比如商场停车场），可以把半径改小。
这一项必须填；如果真的一个地点都不需要，填 `none`。

## 第二步：安装（二选一）

|  | 方式一：一键部署 | 方式二：复制一个文件 |
|---|---|---|
| 需要的账号 | Cloudflare + GitHub | 只要 Cloudflare |
| 操作 | 点链接，填 3 项 | 新建、粘贴，再设置 4 处 |

两种方式装好后完全一样，每 5 分钟自动检查一次。账号都免费，没有的话过程中可以现场注册。
**只装一份：** 同一个极氪副账号装两份，两边会互相把对方挤下线。

### 方式一：一键部署

1. 打开一键部署链接：https://deploy.workers.cloudflare.com/?url=https://github.com/dts88/zeekr-shortcut-sentrymode-on
2. 登录 Cloudflare。
3. 按提示连接你的 GitHub 账号。Cloudflare 会在你的 GitHub 里新建一个仓库，用来存放这份程序。
4. 在设置页面填三项，其他保持默认：
   - `ZEEKR_EMAIL`：副账号的邮箱
   - `ZEEKR_PASSWORD`：副账号的密码
   - `GEOFENCES`：第一步准备好的地点
5. 点击部署，等一两分钟显示成功即可。

### 方式二：只用 Cloudflare 账号

括号里是英文界面的叫法，中文界面的措辞可能略有不同。

**1. 新建 Worker**

登录 Cloudflare 控制台 → 左侧 **Workers 和 Pages**（Workers & Pages）→ **创建**（Create）。
在"创建新项目"页面选 **从 Hello World! 开始**（Start with Hello World!），名称填 `zeekr-sentry` → **部署**（Deploy）。

不要选 "Upload your static files"：那是放静态网页用的，程序不会运行。

**2. 粘贴程序**

部署成功后点 **编辑代码**（Edit code），把编辑器里原有的代码全部删掉。
在浏览器打开 https://github.com/dts88/zeekr-shortcut-sentrymode-on/blob/main/dist/zeekr-sentry.js ，点右上角的 **Copy raw file** 复制全部内容，粘贴进编辑器，点 **部署**（Deploy）。

这时打开这个 Worker 的网址（Worker 页面上显示的 `...workers.dev` 地址），能看到版本号和"还缺哪些设置"的清单，说明程序已经在运行。

**3. 建存储空间并绑定**

- 左侧菜单 **存储和数据库**（Storage & Databases）→ **Workers KV** → **创建实例**（Create instance），名称随意（例如 `zeekr-sentry-state`）→ **创建**（Create）。找不到菜单时，在顶部搜索框输入 `KV`。
- 回到 `zeekr-sentry` → **绑定**（Bindings）→ **添加绑定**（Add binding）→ 选 **KV 命名空间**（KV namespace）→ **添加绑定**。
- **变量名称**（Variable name）**必须填 `STATE`**（全大写，没有空格）；**KV 命名空间**选刚建的那个 → **添加绑定**保存。

**4. 加定时**

`zeekr-sentry` → **设置**（Settings）→ **触发事件**（Trigger Events）→ **添加**（Add）→ **Cron 触发器**（Cron Triggers）。
有频率选项就选"分钟"、填 `5`；只有一个输入框就填 `*/5 * * * *`。保存。新加的定时最多要 15 分钟才开始运行。

**5. 填三项设置**

`zeekr-sentry` → **设置** → **变量和机密**（Variables and Secrets）→ **添加**（Add），三项的类型都选 **Secret**（中文界面可能叫"密钥"）：
`ZEEKR_EMAIL`、`ZEEKR_PASSWORD`、`GEOFENCES`，内容见第一步。

**6. 确认运行**

- 刷新 Worker 的网址，应显示 `Setup is complete`。还缺什么，页面上会直接列出来。
- 打开 **日志**（Logs）。如果是空的，到 **设置** → **可观测性**（Observability）打开 Workers Logs。
  按事件类型筛选 `scheduled`，就只看定时运行的记录。下一次运行应出现 `logging in`、`logged in (... account, region ...)` 和一行车况。

Worker 的网址任何人都能打开，但页面上只有版本、出处和设置项的名称，不含邮箱、密码和地点。
日志里偶尔出现陌生地区访问网址的记录，多是网上的自动扫描，不用理会。

## 以后

- **看运行记录：** Cloudflare 控制台 → **Workers 和 Pages** → `zeekr-sentry` → **日志**（Logs）
- **改地点或密码：** 同一个 Worker → **设置** → **变量和机密** → 点要改的那一项
- **暂停：** **设置** → **触发事件**，删掉那条定时；要恢复时按方式二第 4 步加回来
- **停用：** 在 **Workers 和 Pages** 里删除 `zeekr-sentry`

（Cloudflare 的界面文字偶尔会调整，以实际页面为准。）

## 程序怎么判断

- **行驶中：** 不动作，下一次停车算新的一次。
- **停在你设的地点范围内：** 不动作。
- **停在范围外、已上锁、电量不低于 20%、哨兵关着：** 自动打开哨兵。同一次停车最多尝试 3 次。
- **这次停车期间哨兵开过，后来被关了**（你自己关的，或车自己关的）：不再打开。
- **程序从不关闭哨兵。**

## 运行记录里的常见提示

每一行开头的 `[v…]` 是程序版本号。每次登录时还会写一行程序的名称、版本和出处。

| 提示 | 意思 |
|---|---|
| `-> enable: attempt 1/3` | 正在为这次停车开启哨兵 |
| `-> none: inside geofence "Home"` | 在你设的地点范围内，不开 |
| `-> none: not locked yet` | 还没上锁，等下一次检查 |
| `-> none: battery 15% below 20%` | 电量不足 20%，不开 |
| `token expired, logging in again` | 登录过期，自动重新登录；同一个副账号在别处登录过也会这样，偶尔出现正常 |
| `missing: ...` | 少填了某项设置 |
| `no storage: ...` | 方式二第 3 步没做好：存储空间没绑定，或名字不是 `STATE` |
| `no Zeekr account with this email` | 邮箱不对，或是欧洲区账号（暂不支持） |
| `geofence 2 should look like ...` | 第 2 个地点格式不对 |

手机 App 突然被登出：`ZEEKR_EMAIL` 用成了主账号，换成副账号即可。
