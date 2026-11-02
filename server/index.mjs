#!/usr/bin/env node
// EasyAR CRS MCP server — zero-dependency stdio JSON-RPC (newline-delimited).
// Auth: TOKEN mode only. Docs: https://easyar.com/doc/en/develop/apikey-auth.html
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { createInterface } from "node:readline";

const SERVER_INFO = { name: "easyar-crs", version: "0.1.0" };
const PROTOCOL_VERSION = "2025-06-18";

class ConfigError extends Error {}

function env(name, { required = true } = {}) {
  const v = process.env[name];
  // Treat unresolved "${VAR}" placeholders as missing.
  if (!v || /^\$\{.*\}$/.test(v)) {
    if (required) throw new ConfigError(name);
    return undefined;
  }
  return v;
}

function requireConfig(names) {
  const missing = names.filter((n) => { try { env(n); return false; } catch { return true; } });
  if (missing.length) {
    throw new ConfigError(
      `Missing EasyAR CRS configuration: ${missing.join(", ")}. Set these plugin variables (see README.md).`
    );
  }
}

function uacHost() {
  const region = (env("EASYAR_REGION", { required: false }) || "cn1").toLowerCase();
  return region === "na1" ? "https://uac-na1.easyar.com" : "https://uac.easyar.com";
}

// ---- Token-request signing (ISOLATED) ---------------------------------------
// Per https://easyar.com/doc/en/develop/apikey-auth.html: sort params by key,
// concat key+value, append API Secret, sha256 hex. `acl` is signed as a JSON string.
// VERIFIED live 2026-11-02 (cn1): SHA-256 hex accepted by /token/v2.
// Numbers are stringified with String().
export function signTokenRequest(params, apiSecret) {
  const base = Object.keys(params)
    .sort()
    .map((k) => k + String(params[k]))
    .join("") + apiSecret;
  return createHash("sha256").update(base, "utf8").digest("hex");
}
// -----------------------------------------------------------------------------

let tokenCache = null; // { token, expiresAt }
const TOKEN_TTL_S = 3600;

async function getToken() {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.token;
  const apiKey = env("EASYAR_API_KEY");
  const apiSecret = env("EASYAR_API_SECRET");
  const appId = env("EASYAR_CRS_APP_ID");
  const acl = JSON.stringify([
    { service: "ecs:crs", resource: [appId], effect: "Allow", permission: ["READ", "WRITE"] },
  ]);
  const params = { apiKey, expires: TOKEN_TTL_S, acl, timestamp: Date.now() };
  params.signature = signTokenRequest(params, apiSecret);
  const res = await fetchRetry(`${uacHost()}/token/v2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const body = await safeJson(res);
  // VERIFIED live: {statusCode:0,msg:"Success",result:{apiKey,expires,token,expiration:"...+0000"}}
  const token = body?.result?.token;
  if (!res.ok || body?.statusCode !== 0 || !token) {
    throw new Error(`Token request failed (HTTP ${res.status}): ${JSON.stringify(body).slice(0, 500)}`);
  }
  const exp = Date.parse(String(body.result.expiration || "").replace(/\+0000$/, "Z"));
  tokenCache = { token, expiresAt: Number.isFinite(exp) ? exp : Date.now() + TOKEN_TTL_S * 1000 };
  return token;
}

// Retry network-level failures (observed live: intermittent ECONNRESET during TLS).
// Only used for idempotent/read-only calls; never for target creation.
async function fetchRetry(url, init, { retries = 3, delayMs = 3000 } = {}) {
  for (let i = 0; ; i++) {
    try { return await fetch(url, init); }
    catch (e) {
      if (i >= retries || !/ECONNRESET|ETIMEDOUT|ECONNREFUSED|UND_ERR_SOCKET/.test(e.cause?.code || "")) throw e;
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
}

async function safeJson(res) {
  const t = await res.text();
  try { return JSON.parse(t); } catch { return { raw: t.slice(0, 1000) }; }
}

function joinUrl(base, path) {
  return base.replace(/\/+$/, "") + path;
}

async function crsJson(method, path, { query = {}, body, retry = true } = {}) {
  const token = await getToken();
  const appId = env("EASYAR_CRS_APP_ID");
  const url = new URL(joinUrl(env("EASYAR_CRS_SERVER_URL"), path));
  const init = { method, headers: { Authorization: token, "Content-Type": "application/json" } };
  if (method === "GET" || method === "DELETE") {
    for (const [k, v] of Object.entries({ ...query, appId })) if (v !== undefined) url.searchParams.set(k, String(v));
  } else {
    init.body = JSON.stringify({ ...body, appId });
  }
  const res = retry ? await fetchRetry(url, init) : await fetch(url, init);
  return { httpStatus: res.status, ...(await safeJson(res)) };
}

async function loadImageBase64(imagePath) {
  const buf = await readFile(imagePath);
  if (buf.length > 2 * 1024 * 1024) throw new Error(`Image ${imagePath} exceeds 2MB limit`);
  const ext = extname(imagePath).toLowerCase();
  if (![".jpg", ".jpeg", ".png"].includes(ext)) throw new Error("Only JPG and PNG images are supported");
  return { buf, b64: buf.toString("base64"), ext };
}

// Strip large trackingImage from output unless requested.
function trim(out, includeTrackingImage) {
  if (includeTrackingImage) return out;
  return JSON.parse(JSON.stringify(out, (k, v) => (k === "trackingImage" ? `<omitted ${String(v).length} chars>` : v)));
}

const SERVER_VARS = ["EASYAR_API_KEY", "EASYAR_API_SECRET", "EASYAR_CRS_APP_ID", "EASYAR_CRS_SERVER_URL"];
const CLIENT_VARS = ["EASYAR_API_KEY", "EASYAR_API_SECRET", "EASYAR_CRS_APP_ID", "EASYAR_CRS_CLIENT_URL"];

const str = (description) => ({ type: "string", description });
const imageProp = str("Absolute path to a local JPG/PNG image (max 2MB)");
const targetIdProp = str("Target ID (targetId)");

const TOOLS = [
  {
    name: "crs_list_targets",
    description: "List image targets in the CRS library (GET /targets/infos).",
    inputSchema: { type: "object", properties: {
      pageNum: { type: "integer", minimum: 1, description: "Page number, default 1" },
      pageSize: { type: "integer", minimum: 1, maximum: 100, description: "Page size, default 5, max 100" },
    } },
    vars: SERVER_VARS,
    run: (a) => crsJson("GET", "/targets/infos", { query: { pageNum: a.pageNum, pageSize: a.pageSize } }),
  },
  {
    name: "crs_get_target",
    description: "Get a single target's details (GET /target/{targetId}).",
    inputSchema: { type: "object", properties: { targetId: targetIdProp, includeTrackingImage: { type: "boolean" } }, required: ["targetId"] },
    vars: SERVER_VARS,
    run: async (a) => trim(await crsJson("GET", `/target/${encodeURIComponent(a.targetId)}`), a.includeTrackingImage),
  },
  {
    name: "crs_grade_image",
    description: "Rate how recognizable/trackable an image is before creating a target (POST /grade/{kind}). detection grade: -1 invalid, 0-1 easy, 2 average, 3-4 hard.",
    inputSchema: { type: "object", properties: {
      imagePath: imageProp,
      kind: { type: "string", enum: ["detection", "tracking", "detail"], description: "Default detection" },
    }, required: ["imagePath"] },
    vars: SERVER_VARS,
    run: async (a) => {
      const { b64 } = await loadImageBase64(a.imagePath);
      return crsJson("POST", `/grade/${a.kind || "detection"}`, { body: { image: b64 } });
    },
  },
  {
    name: "crs_find_similar",
    description: "Check whether similar targets already exist in the library (POST /similar). Empty results = none.",
    inputSchema: { type: "object", properties: { imagePath: imageProp }, required: ["imagePath"] },
    vars: SERVER_VARS,
    run: async (a) => {
      const { b64 } = await loadImageBase64(a.imagePath);
      return trim(await crsJson("POST", "/similar", { body: { image: b64 } }), false);
    },
  },
  {
    name: "crs_create_target",
    description: "Create a new image target (POST /targets). Run crs_grade_image and crs_find_similar first. Not auto-retried: on a network error, list targets before trying again to avoid duplicates.",
    inputSchema: { type: "object", properties: {
      imagePath: imageProp,
      name: str("1-64 chars: English letters, English punctuation, digits"),
      size: str("Target width in cm, as string, e.g. \"20\""),
      meta: str("AR content info string (max 2MB), e.g. base64 JSON or a URL. Default \"\""),
      active: { type: "string", enum: ["1", "0"] },
      allowSimilar: { type: "string", enum: ["1", "0"], description: "Force add even if similar exists. Default 0" },
    }, required: ["imagePath", "name", "size"] },
    vars: SERVER_VARS,
    run: async (a) => {
      const { b64 } = await loadImageBase64(a.imagePath);
      const body = { image: b64, name: a.name, size: String(a.size), meta: a.meta ?? "", type: "ImageTarget" };
      if (a.active) body.active = a.active;
      if (a.allowSimilar) body.allowSimilar = a.allowSimilar;
      return trim(await crsJson("POST", "/targets", { body, retry: false }), false);
    },
  },
  {
    name: "crs_update_target",
    description: "Update target properties (PUT /target/{targetId}). Patch semantics (verified live): only provided fields change.",
    inputSchema: { type: "object", properties: {
      targetId: targetIdProp, imagePath: imageProp, name: str("New name"), size: str("New width in cm"),
      meta: str("New meta string"), active: { type: "string", enum: ["1", "0"] },
      allowSimilar: { type: "string", enum: ["1", "0"] },
    }, required: ["targetId"] },
    vars: SERVER_VARS,
    run: async (a) => {
      const body = {};
      if (a.imagePath) { body.image = (await loadImageBase64(a.imagePath)).b64; body.type = "ImageTarget"; }
      for (const k of ["name", "size", "meta", "active", "allowSimilar"]) if (a[k] !== undefined) body[k] = String(a[k]);
      if (!Object.keys(body).length) throw new Error("Nothing to update: provide at least one field");
      return trim(await crsJson("PUT", `/target/${encodeURIComponent(a.targetId)}`, { body }), false);
    },
  },
  {
    name: "crs_delete_target",
    description: "Permanently delete a target (DELETE /target/{targetId}). Requires confirm:true.",
    inputSchema: { type: "object", properties: {
      targetId: targetIdProp,
      confirm: { type: "boolean", description: "Must be true to actually delete" },
    }, required: ["targetId", "confirm"] },
    vars: SERVER_VARS,
    preCheck: (a) => { if (a.confirm !== true) throw new Error("Refusing to delete: pass confirm:true after the user confirms."); },
    run: async (a) => trim(await crsJson("DELETE", `/target/${encodeURIComponent(a.targetId)}`), false),
  },
  {
    name: "crs_search_image",
    description: "Recognize an image against the library (POST /v2/search on the Client-end URL, multipart).",
    inputSchema: { type: "object", properties: {
      imagePath: imageProp,
      notracking: { type: "string", enum: ["true", "false"], description: "\"true\" = return targetId without trackingImage" },
    }, required: ["imagePath"] },
    vars: CLIENT_VARS,
    run: async (a) => {
      const { buf, ext } = await loadImageBase64(a.imagePath);
      const token = await getToken();
      const form = new FormData();
      // Verified live 2026-11-02: raw multipart file + appId field, raw token in Authorization.
      form.append("image", new Blob([buf], { type: ext === ".png" ? "image/png" : "image/jpeg" }), basename(a.imagePath));
      form.append("appId", env("EASYAR_CRS_APP_ID"));
      if (a.notracking) form.append("notracking", a.notracking);
      const res = await fetchRetry(joinUrl(env("EASYAR_CRS_CLIENT_URL"), "/v2/search"), {
        method: "POST", headers: { Authorization: token }, body: form,
      });
      return trim({ httpStatus: res.status, ...(await safeJson(res)) }, a.notracking === "false");
    },
  },
];

async function callTool(name, args = {}) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { isError: true, content: [{ type: "text", text: `Unknown tool: ${name}` }] };
  try {
    tool.preCheck?.(args);
    requireConfig(tool.vars);
    const out = await tool.run(args);
    const isError = out?.statusCode !== undefined && out.statusCode !== 0;
    return { isError, content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
  } catch (e) {
    return { isError: true, content: [{ type: "text", text: e instanceof ConfigError ? e.message : `Error: ${e.message}${e.cause ? " (" + (e.cause.code || e.cause.message) + ")" : ""}` }] };
  }
}

async function handle(msg) {
  const { id, method, params } = msg;
  switch (method) {
    case "initialize":
      return { protocolVersion: params?.protocolVersion || PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO };
    case "ping": return {};
    case "tools/list":
      return { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) };
    case "tools/call":
      return callTool(params?.name, params?.arguments);
    default:
      if (id === undefined) return undefined; // notification
      throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
  }
}

function send(obj) { process.stdout.write(JSON.stringify(obj) + "\n"); }

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const rl = createInterface({ input: process.stdin });
  rl.on("line", async (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }); }
    try {
      const result = await handle(msg);
      if (msg.id !== undefined) send({ jsonrpc: "2.0", id: msg.id, result });
    } catch (e) {
      if (msg.id !== undefined) send({ jsonrpc: "2.0", id: msg.id, error: { code: e.code || -32603, message: e.message } });
    }
  });
}
