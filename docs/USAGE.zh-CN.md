[English](./USAGE.en.md) · [日本語](./USAGE.ja.md)

# EasyAR CRS 插件快速上手

本文说明如何在 Cursor 里使用 **easyar-crs** 智能体插件（v0.1.0）：管理 EasyAR 云识别（CRS）图库，并用一张本地图片到该图库里做识别。下列事实来自本仓库的 `README.md`、`plugin.json`、`mcp.json`、`server/index.mjs`、`skills/easyar-crs/SKILL.md`，安装步骤另据文中链接的 Cursor 插件文档。

## 1. 它能做什么

插件包含一个无 npm 依赖的 stdio MCP 服务，以及名为 `easyar-crs` 的技能。用日常说法跟 Cursor 的智能体对话即可。技能说明写明：当你提到 EasyAR CRS、云识别、识别图/目标图，或想上传、检查、搜索 AR 目标图时使用它。服务只使用 Token 认证：API Secret 只用于给换 Token 的请求签名，Token 会缓存到过期前 60 秒，之后的调用带上这个 Token。一共 8 个工具：

| 工具 | 你可以让它做的事 |
|---|---|
| `crs_list_targets` | 列出图库里的目标图。页码默认 1。每页条数默认 5，最大 100。 |
| `crs_get_target` | 按目标 ID 查看一条目标图。除非你要求，否则回复里会略去跟踪图。 |
| `crs_grade_image` | 在创建目标图之前，给本地图片打分。默认种类是 `detection`（检测）：−1 无效，0–1 容易，2 一般，3–4 困难。检测分数大于等于 3 时，技能会提醒你。其他种类是 `tracking`（跟踪）和 `detail`（细节）。 |
| `crs_find_similar` | 检查图库里是否已有相似目标图。结果为空表示没有。 |
| `crs_create_target` | 创建一条图像目标。先做可识别性评分，再查相似目标。若已有相似图，只有你明确接受后，智能体才会把 `allowSimilar` 设为 `1`。创建只请求一次，不会自动重试。 |
| `crs_update_target` | 只修改你点名的字段。实测为补丁语义：只提交 `name` 和 `meta` 时，`size`、`active` 和图片保持不变。`active` 设为 `0` 会关闭识别并保留目标图。 |
| `crs_delete_target` | 永久删除一条目标图。在确认之前工具会拒绝执行（需要 `confirm: true`）。 |
| `crs_search_image` | 用客户端 URL 把本地图片拿到图库里识别（`POST` `/v2/search`）。不需要跟踪图时请说明（`notracking` 为 `true`）。 |

本地图片必须是绝对路径，格式为 JPG 或 PNG，大小不超过 2 MB。新建目标图还需要名称（1–64 个字符：英文字母、英文标点、数字）和宽度（单位厘米，以文本传递，例如 `20`）。`meta` 可选，最大 2 MB。

列出、获取、评分、查相似、创建、更新、删除走服务端 URL。识别走客户端 URL。

## 2. 准备

- **Node.js 18 或更高版本**，并且 `node` 在 `PATH` 中。服务不需要安装任何包。`README.md` 写的是 Node ≥ 18。
- **Cursor**，并已加载本插件（见第 3 节）。
- **EasyAR 开发者账号**，能够登录 EasyAR 开发中心。

从该账号抄下面这些值。`README.md` 已经引用的两篇 EasyAR 文档是依据：

- API Key 与 API Secret：[获取并使用 API Key](https://easyar.com/doc/en/develop/apikey-auth.html)。登录开发中心，在「授权」下打开「云服务 API KEY」，点击「创建 API KEY」，并选择云识别。页面会显示 API Key 和 API Secret。EasyAR 提醒：不要泄露这两项，也不要直接写进网页、小程序等客户端。
- CRS AppId：同一页把它说明为云识别图库的 AppId，并写明到开发中心对应服务里查看。API Key 必须被授权使用这个图库。
- 服务端 URL 与客户端 URL：[云识别 API 简介](https://www.easyar.com/doc/en/api/cloud/cloud-recognition/apis.html) 是 README 所链的接口总览。这两个地址属于你自己的 CRS 图库。请在开发中心的图库里复制服务端 URL（目标图管理、评分、查相似）和客户端 URL（识别）。本仓库没有写明弹出这两项的具体菜单名称。复制客户端 URL 时保留端口：识别请求会在该 URL 后加上 `/v2/search`，已通过的那次识别使用的是端口 **8443**。

## 3. 安装

### 上架 Cursor Marketplace 之后

[Cursor 插件文档](https://cursor.com/docs/plugins) 对智能体插件（插件根目录有 `plugin.json`，本仓库就是这种）和 Cursor 插件使用同一套安装流程：

1. 在侧边栏打开 **Customize**。
2. 搜索 **EasyAR CRS**（插件 id 为 `easyar-crs`）。
3. 选择 **Install**，再选择项目范围或用户范围。

也可以在 [cursor.com/marketplace](https://cursor.com/marketplace) 浏览。Marketplace 中的插件在上架前会经过审核。本插件目前可能尚未上架。

### 在此之前，从本 GitHub 仓库使用

Cursor 公开文档写了 Marketplace 安装，以及未发布插件使用的本地目录。文档没有为「只有一个 Agent Plugin、没有 marketplace 清单」的仓库另写一套「粘贴 GitHub 地址即可安装」的步骤。如果更新的 Cursor 版本提供了更明确的从 GitHub 安装入口，以那个界面为准；下面是目前文档里的做法。

本仓库是放在根目录的单个插件（`plugin.json`、`mcp.json`、`skills/easyar-crs/SKILL.md`、`server/index.mjs`）。[本地试用插件](https://cursor.com/docs/plugins) 的步骤是：

1. 把仓库复制到 `~/.cursor/plugins/local/easyar-crs`，使 `plugin.json` 直接位于该文件夹内（Windows 上是用户目录下的 `.cursor/plugins/local/easyar-crs`）。指向 `~/.cursor/plugins/local` 之外的符号链接会被跳过。请复制文件，或把仓库作为真实目录克隆到这个位置。
2. 重启 Cursor，或执行 **Developer: Reload Window**。
3. 打开 **Customize**，确认能看到 `easyar-crs` 技能和 MCP 服务。允许本地插件导入时，Cursor 会发现这个目录。
4. 在 Enterprise 上，**Allow Local Plugin Imports** 默认关闭（Dashboard → Settings → Security & Identity → Marketplace and Plugins）。同一开关也控制 Customize 里的 **Import from Disk**。若已安装同名的 Marketplace 插件，加载的是 Marketplace 那一份。

团队 Marketplace 的 **Import from Repo**，以及 Customize 里的 **From GitHub Repository**，文档要求仓库里有 `.cursor-plugin/marketplace.json`。本仓库没有这个文件。

`mcp.json` 以工作目录 `${PLUGIN_ROOT}` 启动 `node server/index.mjs`。[Cursor 插件参考](https://cursor.com/docs/reference/plugins) 写明：Agent Plugin 的 `mcp.json` 会在 `command`、`args`、`env`、`cwd` 中展开 `${CURSOR_PLUGIN_ROOT}`，不会展开 `${PLUGIN_ROOT}`。如果 `node` 找不到 `server/index.mjs`，原因就是这一处差异。改这个变量属于插件本身的修改，不是上面的安装步骤。

## 4. 配置变量

`mcp.json` 把下表中的名字传给服务进程。服务只读进程环境。值若仍是字面量 `${NAME}`，会当作未设置。缺哪一项，回复会是 `Missing EasyAR CRS configuration: …`，并列出要设置的名字。

**这些值只留在你自己的电脑上。绝不要提交到仓库。** 也不要把 API Key 或 API Secret 贴进对话。技能要求智能体不要在对话里向你索取 Secret。`.gitignore` 忽略了 `.env*`，但服务不会去读 `.env` 文件；变量是由 `mcp.json` 传进去的。

Cursor 文档把 **Plugins → Configure**（在 Dashboard 中，安装时或之后）写成填写插件变量的地方，针对的是在清单顶层声明了 `variables` 的 Cursor 插件。本包是 Agent Plugin。Agent Plugins 1.0.0 没有顶层 `variables` 字段，因此 `plugin.json` 把这些名字写在 `extensions["com.easyar.crs"].variables` 下。如果 **Configure** 里出现这 6 项，就填在那里。如果没有出现，本仓库没有记载另一个 Cursor 设置界面。

| 变量 | 是否必填 | 是否保密 | 作用 |
|---|---|---|---|
| `EASYAR_API_KEY` | 是 | 是 | API Key，用于申请 Token。 |
| `EASYAR_API_SECRET` | 是 | 是 | API Secret。只为 Token 请求签名。 |
| `EASYAR_CRS_APP_ID` | 是 | 否 | CRS 图库 AppId。每次调用都会带上，并写入 Token 的访问范围。 |
| `EASYAR_CRS_SERVER_URL` | 列出、获取、评分、查相似、创建、更新、删除时必填 | 否 | 服务端 URL。`plugin.json` 将它标为必填。 |
| `EASYAR_CRS_CLIENT_URL` | 识别时必填 | 否 | 客户端 URL。识别会在其后追加 `/v2/search`。`plugin.json` 将它标为必填。若图库给出的地址带 8443 端口，请一并填上。 |
| `EASYAR_REGION` | 否 | 否 | `cn1`（默认）或 `na1`。用来选择 Token 服务。只有精确的 `na1` 会选择北美服务。其他任何值，包括拼写错误或空值，都会选择默认（`cn1`）服务。两个 Token 主机名见 README 的变量表。 |

## 5. 示例提问

把路径和目标 ID 换成你自己的。智能体遵循 `skills/easyar-crs/SKILL.md`。在 Cursor 里也可以用 `/easyar-crs` 调用该技能。

1. **列出** — 「列出我的 EasyAR CRS 图库里的目标图。」
2. **查看一条** — 「查看 CRS 目标 `<targetId>` 的详情，不要跟踪图。」
3. **评分** — 「在创建目标之前，给 `/absolute/path/image.jpg` 做检测评分，并告诉我识别会不会比较困难。」
4. **查相似** — 「检查 `/absolute/path/image.jpg` 是否和图库里已有的目标图相似。」
5. **创建** — 「用 `/absolute/path/image.jpg` 创建名为 `Poster_01` 的 CRS 目标图，宽度 20 厘米。先评分，并先检查相似目标。」
6. **更新** — 「把 CRS 目标 `<targetId>` 改名为 `Poster_02`。图片、尺寸和启用状态保持不变。」
7. **删除** — 「删除 CRS 目标 `<targetId>`。」智能体必须先向你确认。在把确认作为 `confirm: true` 传入之前，工具会返回 `Refusing to delete: pass confirm:true after the user confirms.`。只说一次「删除」不够。如果还可能用到这条目标，改为要求关闭识别（`active` 为 `0`）。
8. **识别** — 「用 `/absolute/path/photo.jpg` 在我的 CRS 图库里识别。我只要匹配到的目标 ID，不要跟踪图。」

## 6. 排查

**变量未设置。** 回复以 `Missing EasyAR CRS configuration:` 开头，并列出变量名。在你自己的电脑上补全。不要把 API Secret 发到对话里。

**Token 错误。** 换 Token 失败时，文本类似 `Token request failed (HTTP …)`，后面是 JSON 正文（截断到 500 个字符）。请核对 API Key、API Secret、`EASYAR_REGION`，以及该 Key 是否已获授权、可以对这个图库的 AppId 使用云识别。[API Key 文档](https://easyar.com/doc/en/develop/apikey-auth.html) 的错误表包括：`4001011`（API Key 无效）、`4001012`（时间戳无效；单位是毫秒，与标准时间相差不宜超过 5 分钟）、`4001015`（签名无效，Secret 与 Key 不匹配）、`4001017`（该 API Key 未授权此 AppId）、`4001024`（Token 已过期）。服务会把成功的 Token 缓存到过期前 60 秒，然后再重新申请。

**区域不对。** 把 `EASYAR_REGION` 设为与图库一致的 `cn1` 或 `na1`。默认是 `cn1`。只有 `na1` 会选择北美 Token 服务。

**网络。** 对连接被重置、超时、连接被拒绝或套接字错误（`UND_ERR_SOCKET`），服务最多重试 3 次。每次重试前的等待时间是 3 秒乘以尝试序号。重试范围是 Token 请求，以及列出、获取、评分、查相似、更新、删除和识别。创建不在重试之列。如果创建因网络失败，再次创建之前先列出图库，避免把已经保存成功的目标图又建一次。中国区域的图库，从部分中国大陆以外的网络可能访问不到。识别使用客户端 URL 的 **8443** 端口。一次已通过的识别来自中国大陆网络；更早的一次运行在另一个网络上出现了 TLS 连接重置。能不能连上，取决于运行这个 MCP 服务的那台机器所在的网络。

**找不到目标。** 对已删除的 ID 调用 `crs_get_target`，会返回 HTTP 200，同时 `statusCode` 为 404，`result` 为 `"Target not found"`。服务仍把这次调用当成错误，因为只要 `statusCode` 不是 0 就会按错误报告。请按接口原文查看 `statusCode` 和 `msg`。

**图片或更新被拒绝。** 文件必须是 JPG 或 PNG、不超过 2 MB，并且是绝对路径（提示为 `Only JPG and PNG images are supported`，或超过 2 MB 的说明）。更新时一个字段都不提供，会返回 `Nothing to update: provide at least one field`。

## 7. EasyAR 文档

与本仓库 README 中列出的链接相同：

- 概览与认证：https://www.easyar.com/doc/en/api/cloud/cloud-recognition/apis.html
- API Key 与 Token：https://easyar.com/doc/en/develop/apikey-auth.html
- 创建：https://www.easyar.cn/doc/zh-cn/api/cloud/cloud-recognition/target-create.html
- 列表：https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-list.html
- 获取：https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-get.html
- 更新：https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-update.html
- 删除：https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-delete.html
- 相似图：https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-similar.html
- 评分：https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-grade.html
- 识别：https://easyar.com/doc/en/api/cloud/cloud-recognition/target-search.html
