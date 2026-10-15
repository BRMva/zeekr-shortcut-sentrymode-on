# 极氪哨兵模式自动开启

车停好、锁上之后，只要不在你设定的地点（家、公司等）附近，程序会在几分钟内自动帮你打开哨兵模式。

- **免费：** 运行在你自己的 Cloudflare 账号里，用免费计划就够。
- **不用一直开着电脑：** 程序在 Cloudflare 的服务器上自动运行，你的电脑、手机关着也照常工作。
- **全在网页上操作：** 不用写代码，按下面的步骤点选、填写即可，大约 15 分钟。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/dts88/zeekr-shortcut-sentrymode-on)

> 这是个人开发的非官方项目，和极氪公司无关。它通过极氪 App 使用的接口工作，如果极氪修改接口，可能会暂时失效。
> 已在新加坡账号上实测。东南亚、中东、拉美区的极氪账号理论上都能用；欧洲区暂不支持。

**目录**

1. [它会做什么](#它会做什么)
2. [开始前：准备四样东西](#开始前准备四样东西)
3. [一键部署：分步骤操作](#一键部署分步骤操作)
4. [确认它在工作](#确认它在工作)
5. [日常使用](#日常使用)：看记录、改设置、暂停、卸载、升级
6. [常见问题](#常见问题)
7. [隐私与安全](#隐私与安全)

---

## 它会做什么

程序每 5 分钟查看一次你的车，按下表处理：

| 车的状态 | 程序的动作 |
|---|---|
| 正在行驶 | 不动作 |
| 停在你设定的地点范围内（比如家里） | 不动作 |
| 停在范围外、已上锁、电量不低于 20%、哨兵关着 | **打开哨兵**；同一次停车最多尝试 3 次 |
| 这次停车期间哨兵开过，后来被关了（你自己关的，或车自己关的） | 不再打开，尊重这个决定 |

程序**从不关闭**哨兵。

---

## 开始前：准备四样东西

### 1. 一个极氪副账号，并把车分享给它

程序要登录一个极氪账号才能查看车况、打开哨兵。**请用另一个账号（副账号），不要用你手机上正在用的主账号**：同一个账号在别处登录，手机 App 会被登出。

1. 用另一个邮箱注册一个极氪账号，作为副账号。
2. 用主账号在极氪 App 里把车分享给这个副账号。
   <!-- 待补：极氪 App 里分享车辆的菜单路径与截图（docs/images/app-share-*.png）；分享时是否要勾选远程控制权限 -->
3. 用副账号在手机上登录一次极氪 App，确认能看到这辆车和哨兵模式开关，然后退出登录。之后不要再在手机上用这个副账号。

### 2. 不需要自动开哨兵的地点（最多 10 个）

在这些地点附近，程序不会自动开哨兵，比如家、公司。

1. 在电脑上打开 [Google 地图](https://www.google.com/maps)，找到这个地点，**右键**点一下。
2. 弹出菜单的第一行是一串数字（纬度, 经度），点一下就复制好了。
   <!-- 截图：docs/images/google-maps-coordinates.png（用公共地点，不要用自己家） -->
3. 按「名称, 纬度, 经度, 半径」的格式写下来，半径的单位是米。多个地点之间用分号隔开，例如：

```
Home, 1.3521, 103.8198, 600; Office, 1.2840, 103.8510, 600
```

- **名称**只会出现在运行记录里，方便你辨认，建议用英文。
- **半径**可以不写，默认 600 米。地下停车场里车的定位常会偏出几百米，半径太小会把"在家"误判成"在外"。如果附近有你希望照常开哨兵的地方（比如商场停车场），可以把半径改小。
- **逗号和分号要用英文半角的 `,` `;`**。用中文输入法时，最容易误打成全角的"，""；"。
- 至少要写一个地点；如果真的一个都不需要，写 `none`。

### 3. 一个 Cloudflare 账号（免费）

打开 https://dash.cloudflare.com/sign-up ，用邮箱和密码注册，再去邮箱里点验证链接。注册后默认就是免费计划，不需要绑定信用卡。

### 4. 一个 GitHub 账号（免费）

打开 https://github.com/signup 注册。一键部署时，Cloudflare 会把这个程序复制一份到你的 GitHub 账号里，再从那里部署。

---

## 一键部署：分步骤操作

建议用电脑操作，大约 10 分钟。界面文字以实际页面为准，Cloudflare 偶尔会调整措辞。

### 第 1 步：点部署按钮

点本页最上方的 **Deploy to Cloudflare** 按钮，或者直接打开：
https://deploy.workers.cloudflare.com/?url=https://github.com/dts88/zeekr-shortcut-sentrymode-on

还没登录 Cloudflare 的话，会先跳到登录页，登录后自动回到部署页面。

### 第 2 步：连接 GitHub

部署页面的标题是 **配置您的应用程序**。在 **Git 帐户** 一栏，按提示连接你的 GitHub 账号：

1. 页面会跳到 GitHub，请你授权 Cloudflare 的应用访问你的账号。
2. 确认授权后，会回到 Cloudflare 的部署页面。

<!-- 截图：docs/images/deploy-github-connect.png、docs/images/github-authorize.png -->
<!-- 待确认：GitHub 授权页上的选项（All repositories / Only select repositories）怎么选 -->

### 第 3 步：填写配置页面

逐项按下表填写或确认：

| 页面上的项 | 怎么填 |
|---|---|
| 项目名称（Worker 名称） | 保持默认的 `zeekr-sentry` |
| **创建专用 Git 存储库** | 保持默认名称。有"私有"选项的话建议勾选。这是程序在你 GitHub 里的副本，Cloudflare 从它部署 |
| STATE（Select KV 命名空间） | 保持 `new`，会自动新建一个存储空间，用来保存登录状态和停车记录 |
| **ZEEKR_EMAIL** | 副账号的邮箱 |
| **ZEEKR_PASSWORD** | 副账号的密码 |
| **GEOFENCES** | 第 2 样准备好的地点 |
| 启用预览构建 | **关闭**，用不到 |
| 使用 Cloudflare Access 保护 | **关闭**，用不到 |
| 高级设置 | 不用动 |

<!-- 截图：docs/images/deploy-config.png（填写后，密码与邮箱打码） -->
<!-- 待确认：项目名称字段在页面上的位置和名称 -->

### 第 4 步：部署

点页面底部的部署按钮，等 1–3 分钟，页面显示部署成功就完成了。

<!-- 截图：docs/images/deploy-success.png -->
<!-- 待确认：部署按钮和成功页面上的文字 -->

这一步 Cloudflare 自动完成了这些事：
- 在你的 GitHub 里建好程序副本；
- 建好存储空间；
- 设好每 5 分钟运行一次的定时；
- 把三项设置加密保存。

---

## 确认它在工作

### 看运行记录

1. 打开 Cloudflare 控制台，在左侧菜单进入 **Workers 和 Pages**，点开 `zeekr-sentry`。
2. 点上方的 **日志**（Logs）标签页。
3. 新部署的定时最多要 15 分钟才开始运行，期间可以先去做别的事。
4. 日志里也会有别的记录，按事件类型筛选 `scheduled`，只看定时运行的记录。

<!-- 截图：docs/images/logs.png -->

第一次运行应该看到类似这三行（开头的 `[v0.3.0]` 是程序版本号）：

```
[v0.3.0] logging in · zeekr-sentry 0.3.0 · https://github.com/dts88/zeekr-shortcut-sentrymode-on · based on Fryyyyy/zeekr_ev_api (MIT)
[v0.3.0] logged in (SG account, region SEA), 1 car(s)
[v0.3.0] car …123456 engine=engine-off locked=true battery=80% sentry=off 120 m from "Home" -> none: inside geofence "Home"
```

最后一行是每次检查的结果：

| 部分 | 意思 |
|---|---|
| `car …123456` | 车架号的最后 6 位 |
| `engine=engine-off` | 已熄火（`engine-running` 是行驶中） |
| `locked=true` | 已上锁 |
| `battery=80%` | 电量 |
| `sentry=off` | 哨兵当前是关的 |
| `120 m from "Home"` | 离最近的那个地点有多远 |
| `-> none: inside geofence "Home"` | 程序的决定和原因：在 Home 范围内，不动作 |

### 实地试一次

把车停在你设的地点范围以外，锁车。10 分钟内打开极氪 App，哨兵应该已经打开。日志里会出现：

```
[v0.3.0] car …123456 engine=engine-off locked=true battery=80% sentry=off 2400 m from "Home" -> enable: attempt 1/3
[v0.3.0] car …123456 sentry start sent
```

---

## 日常使用

### 看运行记录

Cloudflare 控制台 → **Workers 和 Pages** → `zeekr-sentry` → **日志**。

### 修改地点或密码

1. Cloudflare 控制台 → **Workers 和 Pages** → `zeekr-sentry` → **设置**（Settings）→ **变量和机密**（Variables and Secrets）。
2. 点要修改的那一项（比如 `GEOFENCES`）旁边的编辑按钮，输入新内容，保存。

为了安全，机密保存后看不到原来的内容，所以修改时要把整段重新输入一遍。

<!-- 截图：docs/images/settings-secrets.png -->

### 暂停与恢复

- **暂停：** **设置** → **触发事件**（Trigger Events），删掉那条每 5 分钟的定时。
- **恢复：** 同一个地方点 **添加** → **Cron 触发器**。有频率选项就选"分钟"、填 `5`；只有一个输入框就填 `*/5 * * * *`。保存。

### 卸载

1. Cloudflare 控制台 → **Workers 和 Pages** → `zeekr-sentry` → **设置** → 最下方删除这个 Worker。
2. Cloudflare 控制台 → **存储和数据库** → **Workers KV**，删掉部署时自动建的那个存储空间（名字里带 `zeekr-sentry`）。
3. 在 GitHub 上删掉第 3 步建的那个副本仓库（仓库页面 → **Settings** → 最下方 **Delete this repository**）。
4. 在极氪 App 里取消对副账号的车辆分享。

### 升级到新版本

新版本会发布在本页面。你在日志里看到的 `[v…]` 就是你正在用的版本。

升级方法：先按上面的"卸载"第 1–3 步删掉旧的，再按"一键部署"重新做一遍。三项设置需要重新填写。

---

## 常见问题

**要花钱吗？**
不用。Cloudflare 免费计划每天允许 10 万次请求，这个程序每天大约运行 300 次，远在额度以内。

**手机上的极氪 App 被登出了？**
`ZEEKR_EMAIL` 填的是主账号。按"修改地点或密码"改成副账号的邮箱和密码。

**车停在家里，哨兵却被打开了？**
看日志里那一行的 `… m from "Home"`。如果距离比你设的半径大，有三种可能：
- 地点坐标不准；
- 半径太小（地下停车场定位偏差大）；
- `GEOFENCES` 用了全角标点，或格式写错了。

**车停在外面，哨兵没打开？**
看日志里 `-> none:` 后面的原因：

| 日志里的原因 | 意思 |
|---|---|
| `inside geofence "…"` | 程序认为车在你设的地点范围内 |
| `not locked yet` | 车还没上锁，下次检查再试 |
| `battery 15% below 20%` | 电量低于 20%，为保护电池不打开 |
| `sentry turned off during this parking, respecting it` | 这次停车期间哨兵开过又被关了，不再打开 |
| `gave up after 3 attempts` | 同一次停车已尝试 3 次都没打开，不再尝试；下次停车会重新计数 |
| `not parked (engine-running)` | 车被判定为行驶中 |

**日志里的其他提示**

| 提示 | 意思 |
|---|---|
| `token expired, logging in again` | 登录过期，程序自动重新登录。偶尔出现是正常的 |
| `missing: …` | 少填了某项设置，按"修改地点或密码"补上 |
| `geofence 2 should look like …` | 第 2 个地点的格式不对 |
| `no Zeekr account with this email …` | 邮箱不对，或者是欧洲区账号（暂不支持） |
| `login needed but held back …` | 30 分钟内已经登录过一次，程序会等满 30 分钟再登录，避免账号被锁。如果一直出现，先检查密码对不对 |

**有两辆车怎么办？**
把两辆车都分享给副账号，程序会逐辆检查。

---

## 隐私与安全

- **你的账号和密码**以加密"机密"的形式保存在**你自己的** Cloudflare 账号里，作者和其他人都看不到。
- **你 GitHub 里的副本**只有程序代码，不含你的任何设置。
- **运行记录**里有车离地点的距离、电量等信息，截图分享给别人时请注意。
- 建议副账号用一个单独的密码，不要和其他网站共用。

---

## 没有 GitHub 账号？

也可以只用 Cloudflare 账号安装：在控制台新建 Worker，把一个程序文件粘贴进去，再手动设置几项。步骤见 [docs/setup-zh.md](docs/setup-zh.md)。

---

## 致谢与许可

本项目以 MIT 许可发布，作者 [dts88](https://github.com/dts88)。它基于以下开源项目：

- [Fryyyyy/zeekr_ev_api](https://github.com/Fryyyyy/zeekr_ev_api)（MIT）：极氪接口、登录与请求签名
- [Fryyyyy/zeekr_homeassistant](https://github.com/Fryyyyy/zeekr_homeassistant)（MIT）：哨兵命令和车况字段
- [wysie/zeekr_key_extractor](https://github.com/wysie/zeekr_key_extractor)（MIT）：从公开的极氪 App 中提取的常量

开发者说明（英文）：[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

---

**English:** This project turns Zeekr sentry mode on automatically when the car is parked and locked away from your
geofences. It runs free in your own Cloudflare account; click **Deploy to Cloudflare** above, then fill in a second
Zeekr account the car is shared with, its password, and your geofences (`Home, 1.3521, 103.8198, 600; …`).
Unofficial; not affiliated with Zeekr.
