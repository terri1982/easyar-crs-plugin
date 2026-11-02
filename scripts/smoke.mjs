#!/usr/bin/env node
// Spawns the MCP server and calls crs_list_targets. Requires EASYAR_* env vars.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = spawn(process.execPath, [join(root, "server/index.mjs")], { stdio: ["pipe", "pipe", "inherit"], env: process.env });
const msgs = [
  { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "0" } } },
  { jsonrpc: "2.0", method: "notifications/initialized" },
  { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "crs_list_targets", arguments: { pageNum: 1, pageSize: 5 } } },
];
let buf = "";
p.stdout.on("data", (d) => {
  buf += d;
  for (let i; (i = buf.indexOf("\n")) >= 0; ) {
    const r = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
    if (r.id === 2) {
      console.log(r.result.content[0].text);
      p.kill();
      process.exit(r.result.isError ? 1 : 0);
    }
  }
});
for (const m of msgs) p.stdin.write(JSON.stringify(m) + "\n");
setTimeout(() => { console.error("timeout"); p.kill(); process.exit(2); }, 30000);
