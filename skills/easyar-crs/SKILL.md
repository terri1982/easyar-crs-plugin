---
name: easyar-crs
description: Manage EasyAR CRS cloud-recognition image targets (list, inspect, grade, check similar, create, update, delete) and recognize an image against a CRS library. Use when the user mentions EasyAR CRS, 云识别, 识别图/目标图, or wants to upload/check/search AR target images.
---

# EasyAR CRS

Tools come from the `easyar-crs` MCP server (token auth, configured via plugin variables).

## When to use which tool
- Browse library: `crs_list_targets` (pageSize ≤ 100), then `crs_get_target` for one target.
- Before creating a target, always:
  1. `crs_grade_image` (kind `detection`): grade -1 = invalid image, 0–1 easy, 2 average, 3–4 hard. Warn the user on ≥3.
  2. `crs_find_similar`: if results are non-empty, tell the user which targets clash before creating.
- Create: `crs_create_target` (imagePath JPG/PNG ≤2MB, name 1–64 English letters/punctuation/digits, size in cm as string, meta ≤2MB). Only pass `allowSimilar:"1"` if the user explicitly accepts the clash.
- Edit / enable / disable: `crs_update_target` (send only fields that change; `active:"0"` disables recognition without deleting).
- Delete: `crs_delete_target` — ask the user first, then call with `confirm:true`. Prefer disabling if unsure.
- Test recognition: `crs_search_image` (uses the Client-end URL). Use `notracking:"true"` unless the tracking image is needed.

## Errors
- "Missing EasyAR CRS configuration: ..." → the listed plugin variables are unset; ask the user to set them. Never ask for the secret in chat.
- `statusCode` ≠ 0 → report `statusCode` and `msg` verbatim.
