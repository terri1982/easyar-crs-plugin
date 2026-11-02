[简体中文](./USAGE.zh-CN.md) · [日本語](./USAGE.ja.md)

# EasyAR CRS plugin — quick start

This guide is for using the **easyar-crs** agent plugin (v0.1.0) in Cursor. It manages an EasyAR Cloud Recognition (CRS) image library and recognizes a photo against that library. Facts below come from this repository's `README.md`, `plugin.json`, `mcp.json`, `server/index.mjs`, and `skills/easyar-crs/SKILL.md`, plus the Cursor plugin docs linked in the install section.

## 1. What it does

The plugin is a stdio MCP server with no npm dependencies, plus a skill named `easyar-crs`. Talk to Cursor's agent in ordinary language. The skill description says to use it when you mention EasyAR CRS, 云识别, 识别图/目标图, or when you want to upload, check, or search AR target images. The server uses token authentication only: your API Secret signs the token request, the token is cached until 60 seconds before it expires, and later calls send that token. Eight tools are exposed:

| Tool | What you can ask for |
|---|---|
| `crs_list_targets` | List image targets in the library. Page number defaults to 1. Page size defaults to 5 and cannot exceed 100. |
| `crs_get_target` | Show one target by its target ID. The tracking image is omitted unless you ask for it. |
| `crs_grade_image` | Score a local image before creating a target. The default kind is `detection`: −1 invalid, 0–1 easy, 2 average, 3–4 hard. The skill warns you when the detection grade is 3 or higher. Other kinds are `tracking` and `detail`. |
| `crs_find_similar` | Check whether similar targets are already in the library. An empty result means none. |
| `crs_create_target` | Create an image target. Run grade and the similar-target check first. If something similar exists, the agent sets `allowSimilar` to `1` only after you explicitly accept that. Create is a single attempt (it is never retried automatically). |
| `crs_update_target` | Change only the fields you name. A live check showed patch behavior: sending `name` and `meta` left `size`, `active`, and the image unchanged. `active` `0` turns recognition off and keeps the target. |
| `crs_delete_target` | Permanently delete one target. The tool refuses until deletion has been confirmed (`confirm: true`). |
| `crs_search_image` | Recognize a local image against the library, using the client URL (`POST` `/v2/search`). Use this when you want a match. Ask to skip the tracking image unless you need it (`notracking` `true`). |

A local image must be an absolute path to a JPG or PNG file of at most 2 MB. A new target also needs a name (1–64 characters: English letters, English punctuation, and digits) and a width in centimetres, passed as text (for example `20`). `meta` is optional and can be up to 2 MB.

List, get, grade, similar, create, update, and delete use the server URL. Search uses the client URL.

## 2. Prerequisites

- **Node.js 18 or newer** on the `PATH`, as `node`. The server installs no packages. `README.md` states Node ≥ 18.
- **Cursor**, with this plugin loaded (section 3).
- **An EasyAR developer account** that can sign in to the EasyAR Developer Center.

Copy these values from that account. Two EasyAR pages already linked from `README.md` are the references:

- API Key and API Secret: [Get and use API Key](https://easyar.com/doc/en/develop/apikey-auth.html). Sign in to the Developer Center. Under **Authorization**, open **Cloud Service API KEY**, choose **Create API KEY**, and select **cloud recognition**. The page then shows the API Key and API Secret. EasyAR warns you to keep both private and to keep them off client apps such as web pages and mini programs.
- CRS AppId: the same page describes it as the AppId of the cloud-recognition library, and says to take the AppId from the relevant service in the Developer Center. The API Key has to be allowed to use that library.
- Server URL and Client URL: [Introduction to cloud recognition APIs](https://www.easyar.com/doc/en/api/cloud/cloud-recognition/apis.html) is the API overview linked from the README. Those two addresses belong to your CRS library. Copy the server-end URL (target management, grade, similar) and the client-end URL (search) from the library in the Developer Center. This repository does not name the exact menu that displays them. Keep the port on the client URL: search calls that URL plus `/v2/search`, and the search that passed used port **8443**.

## 3. Install

### After it is listed in the Cursor Marketplace

[Cursor's plugin docs](https://cursor.com/docs/plugins) use the same install flow for an Agent Plugin (`plugin.json` at the plugin root, which is what this repo is) and for a Cursor Plugin:

1. Open **Customize** in the sidebar.
2. Search for **EasyAR CRS** (plugin id `easyar-crs`).
3. Choose **Install**, then a project scope or a user scope.

You can also browse [cursor.com/marketplace](https://cursor.com/marketplace). Marketplace plugins are reviewed before they are listed. This plugin may not be listed yet.

### From this GitHub repository until then

Cursor's public docs describe Marketplace install and a local folder for a plugin that is not published yet. They do not describe a separate "paste this GitHub URL" install for a single Agent Plugin. If a newer Cursor build adds a clearer GitHub install button, use that screen; the steps below are the ones documented today.

This repository is one plugin at the repo root (`plugin.json`, `mcp.json`, `skills/easyar-crs/SKILL.md`, `server/index.mjs`). [Test plugins locally](https://cursor.com/docs/plugins) says:

1. Copy the repository into `~/.cursor/plugins/local/easyar-crs` so `plugin.json` is directly inside that folder (on Windows, the same `.cursor/plugins/local/easyar-crs` directory under your user profile). Cursor skips a symlink that points outside `~/.cursor/plugins/local`. Copy the files, or clone the repo as a real directory in that folder.
2. Restart Cursor, or run **Developer: Reload Window**.
3. Open **Customize** and confirm the `easyar-crs` skill and MCP server are listed. Cursor discovers this folder when local plugin imports are allowed.
4. On Enterprise, **Allow Local Plugin Imports** is off by default (Dashboard → Settings → Security & Identity → Marketplace and Plugins). That switch also controls **Import from Disk** in Customize. If a Marketplace plugin with the same name is already installed, the Marketplace copy is the one that loads.

Team-marketplace **Import from Repo**, and **From GitHub Repository** in Customize, are documented for a repository that contains `.cursor-plugin/marketplace.json`. This repository has no such file.

`mcp.json` starts `node server/index.mjs` with working directory `${PLUGIN_ROOT}`. [Cursor's plugin reference](https://cursor.com/docs/reference/plugins) says an Agent Plugin `mcp.json` expands `${CURSOR_PLUGIN_ROOT}` in `command`, `args`, `env`, and `cwd`, and does not expand `${PLUGIN_ROOT}`. If `node` cannot find `server/index.mjs`, that difference is why. Updating the variable would be a plugin change, separate from these steps.

## 4. Configure the variables

`mcp.json` forwards the names below into the server process. The server reads the process environment. A value that is still the literal `${NAME}` counts as unset. A missing name produces `Missing EasyAR CRS configuration: …` plus the names to set.

**Keep every value on your machine. Never commit these values.** Never paste the API Key or API Secret into chat. The skill tells the agent to avoid asking for the secret in chat. `.gitignore` ignores `.env*`, and the server does not load a `.env` file; `mcp.json` is what passes the variables in.

Cursor documents **Plugins → Configure** (dashboard, at install time or later) as the place to type plugin variable values, for a Cursor Plugin that declares a top-level `variables` schema. This package is an Agent Plugin. Agent Plugins 1.0.0 has no top-level `variables` field, so `plugin.json` declares the names under `extensions["com.easyar.crs"].variables`. If **Configure** shows these six fields, enter the values there. If it does not, this repository does not document another Cursor screen for them.

| Variable | Required | Secret | Role |
|---|---|---|---|
| `EASYAR_API_KEY` | yes | yes | API Key, sent on the token request. |
| `EASYAR_API_SECRET` | yes | yes | API Secret. Signs the token request only. |
| `EASYAR_CRS_APP_ID` | yes | no | CRS library AppId. Sent on every call, and placed in the token access list. |
| `EASYAR_CRS_SERVER_URL` | yes for list, get, grade, similar, create, update, and delete | no | Server-end URL. `plugin.json` marks it required. |
| `EASYAR_CRS_CLIENT_URL` | yes for search | no | Client-end URL. Search appends `/v2/search`. `plugin.json` marks it required. Include port 8443 when that is how the library publishes this URL. |
| `EASYAR_REGION` | no | no | `cn1` (default) or `na1`. Chooses the token service. Only the exact value `na1` selects the North America service. Any other value, including a typo or an empty value, selects the default (`cn1`) service. The README variables table names the two token hosts. |

## 5. Example prompts

Replace the path and the target ID with your own. The agent follows `skills/easyar-crs/SKILL.md`. In Cursor, a plugin skill can also be invoked as `/easyar-crs`.

1. **List** — "List the image targets in my EasyAR CRS library."
2. **Get one** — "Show the details for CRS target `<targetId>`. Leave out the tracking image."
3. **Grade** — "Grade `/absolute/path/image.jpg` for detection before I create a target, and tell me if recognition will be hard."
4. **Similar targets** — "Check whether `/absolute/path/image.jpg` is similar to any target already in the library."
5. **Create** — "Create a CRS image target named `Poster_01` from `/absolute/path/image.jpg`, width 20 cm. Grade it and check for similar targets first."
6. **Update** — "Rename CRS target `<targetId>` to `Poster_02`. Leave the image, size, and active flag as they are."
7. **Delete** — "Delete CRS target `<targetId>`." The agent has to ask you to confirm first. The tool returns `Refusing to delete: pass confirm:true after the user confirms.` until that confirmation is passed as `confirm: true`. Saying "delete" once is not enough. If you might still need the target, ask to turn recognition off (`active` `0`) instead.
8. **Search** — "Recognize `/absolute/path/photo.jpg` against my CRS library. I only need the matched target ID, not the tracking image."

## 6. Troubleshooting

**Unset variables.** The reply starts with `Missing EasyAR CRS configuration:` and lists the names. Fill those in on your machine. Keep the API Secret out of the chat.

**Token errors.** A failed token request looks like `Token request failed (HTTP …)` followed by the JSON body (truncated to 500 characters). Check the API Key, the API Secret, `EASYAR_REGION`, and that this key is allowed to use this library's AppId for cloud recognition. The [API Key page](https://easyar.com/doc/en/develop/apikey-auth.html) error table includes `4001011` (API Key invalid), `4001012` (timestamp invalid; the timestamp is milliseconds and should stay within 5 minutes of standard time), `4001015` (signature invalid; the secret does not match the key), `4001017` (AppId is not authorized by this API Key), and `4001024` (token expired). The server caches a successful token until 60 seconds before expiry and then requests a new one.

**Wrong region.** Set `EASYAR_REGION` to `cn1` or `na1` to match the library. The default is `cn1`. Only `na1` selects the North America token service.

**Network.** The server retries a connection reset, timeout, connection refused, or socket error (`UND_ERR_SOCKET`) up to 3 times for the token request and for list, get, grade, similar, update, delete, and search. The wait before each retry is 3 seconds times the attempt number. Create is never part of that retry. If create fails because of the network, list the library before you create again, so a target that was actually saved is not added a second time. A China-region library can be unreachable from some networks outside mainland China. Search uses the client URL on port **8443**. A verified search succeeded from a mainland China network; an earlier run saw TLS connection resets from another network. Reachability follows the machine where this MCP server runs.

**Target not found.** `crs_get_target` on an id that was deleted returns HTTP 200 with `statusCode` 404 and `result` `"Target not found"`. The server still treats that call as an error, because any `statusCode` other than 0 is reported as an error. Read `statusCode` and `msg` as the API returned them.

**Image or update rejected.** The file must be JPG or PNG, at most 2 MB, given as an absolute path (`Only JPG and PNG images are supported`, or the 2 MB limit message). Update with no fields returns `Nothing to update: provide at least one field`.

## 7. EasyAR documentation

Links as listed in this repository's README:

- Overview and auth: https://www.easyar.com/doc/en/api/cloud/cloud-recognition/apis.html
- API Key and token: https://easyar.com/doc/en/develop/apikey-auth.html
- Create: https://www.easyar.cn/doc/zh-cn/api/cloud/cloud-recognition/target-create.html
- List: https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-list.html
- Get: https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-get.html
- Update: https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-update.html
- Delete: https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-delete.html
- Similar: https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-similar.html
- Grade: https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-grade.html
- Search: https://easyar.com/doc/en/api/cloud/cloud-recognition/target-search.html
