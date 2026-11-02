# easyar-crs (Agent Plugin, v0.1.0)

MCP stdio server + skill wrapping the EasyAR CRS (Cloud Recognition Service) HTTP API. Zero dependencies, Node ≥ 18.

## Variables
| Var | Required | Use |
|---|---|---|
| EASYAR_API_KEY | yes (secret) | token request |
| EASYAR_API_SECRET | yes (secret) | signs the token request only |
| EASYAR_CRS_APP_ID | yes | CRS library AppId (sent with every call, used in token ACL) |
| EASYAR_CRS_SERVER_URL | yes for management tools | targets / grade / similar |
| EASYAR_CRS_CLIENT_URL | yes for search | `/v2/search` |
| EASYAR_REGION | no | `cn1` (default → uac.easyar.com) or `na1` (→ uac-na1.easyar.com) |

Variables are declared under `extensions["com.easyar.crs"].variables` in plugin.json, because the Agent Plugins 1.0.0 manifest schema has no top-level `variables` field (`additionalProperties: false`).

## Auth (token mode only)
POST `{uac}/token/v2` with `{apiKey, expires, acl, timestamp, signature}`; token cached until expiry (minus 60 s) and sent as `Authorization` header plus `appId` param. Signing lives in `signTokenRequest()` in `server/index.mjs`.

## Tools
crs_list_targets, crs_get_target, crs_grade_image, crs_find_similar, crs_create_target, crs_update_target, crs_delete_target (confirm:true), crs_search_image.

## Test
```
node scripts/smoke.mjs   # needs EASYAR_* env; calls crs_list_targets
```

## Live test (2026-11-02, library AR冰箱贴, read-only)
Verified: token exchange (SHA-256 signature; response `result.token` + `result.expiration`), `appId` in query for GET, in JSON body for POST, `crs_list_targets`, `crs_get_target`, `crs_grade_image`, `crs_find_similar`.
Real list response also includes `totalRecord`, `totalPage`, `pageSize`, `pageNum`, and per-target `created`, `systemMeta`; target detail includes `grade`, `allowSimilar`, `detectableFeatureDistribution`, `appKey`.

## Write test (2026-11-02 ~16:00 UTC+8, one temporary target, then deleted)
create → get → update (name+meta only) → get → delete → list all passed. PUT /target has **patch semantics**: sending only `name` and `meta` changed only those; `size`, `active`, image unchanged. `get` on a deleted id returns HTTP 200 with `statusCode:404, result:"Target not found"`. Library is back to its original 3 targets.
The server retries network resets (ECONNRESET etc.) up to 3× for token, list/get/grade/similar/update/delete/search. Create is never auto-retried.

## Pending / unverified
- `crs_search_image` (`/v2/search`, raw multipart file): not verified. TLS to `:8443` was reset from the test box. Retest from another network (one search call).
- Rate limits and health-check path: not documented in sources read.

## Docs
- Overview & auth: https://www.easyar.com/doc/en/api/cloud/cloud-recognition/apis.html
- API Key / token: https://easyar.com/doc/en/develop/apikey-auth.html
- Create: https://www.easyar.cn/doc/zh-cn/api/cloud/cloud-recognition/target-create.html
- List: https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-list.html
- Get: https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-get.html
- Update: https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-update.html
- Delete: https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-delete.html
- Similar: https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-similar.html
- Grade: https://www.easyar.com/doc/en/api/cloud/cloud-recognition/target-grade.html
- Search: https://easyar.com/doc/en/api/cloud/cloud-recognition/target-search.html

### Search verified (2026-11-02)
`crs_search_image` passed live from a mainland-China network: multipart `image` (raw JPEG) + `appId` + `notracking=true`, `Authorization: <token>` (no Bearer), POST `<client-url>:8443/v2/search` → HTTP 200, `statusCode 0`, `result.target.targetId` matched the source target (视辰名片). The cloud test box could not reach the CRS host (TLS resets), so network reachability depends on where the MCP runs.
