  }
  processReadBuffer() {
    while (!0)
      try {
        let $ = this._readBuffer.readMessage();
        if ($ === null) break;
        this.onmessage?.($);
      } catch ($) {
        this.onerror?.($);
      }
  }
  async close() {
    if (
      (this._stdin.off("data", this._ondata),
      this._stdin.off("error", this._onerror),
      this._stdin.listenerCount("data") === 0)
    )
      this._stdin.pause();
    (this._readBuffer.clear(), this.onclose?.());
  }
  send($) {
    return new Promise((J) => {
      let U = FR($);
      if (this._stdout.write(U)) J();
      else this._stdout.once("drain", J);
    });
  }
}
import { createReadStream as Al } from "fs";
import { access as Ml, stat as Rl } from "fs/promises";
import { createServer as Zl } from "http";
import { extname as Pl, join as Dz, normalize as _l, resolve as Sl } from "path";
import { fileURLToPath as Cl } from "url";
import { spawn as Dl } from "child_process";
import { access as Hl, mkdtemp as Gl, readFile as Kl, rm as Nl, writeFile as Ol } from "fs/promises";
import { tmpdir as Fl } from "os";
import { join as Yz } from "path";
var Yl = {
    x: B$.number().describe("World-space X coordinate in metres"),
    y: B$.number().describe("World-space Y coordinate in metres"),
    z: B$.number().describe("World-space Z coordinate in metres"),
  },
  DJ = () => B$.object(Yl),
  j5 = {
    director_get_state: {
      description:
        "Read the complete Director project, evaluated current frame, exact IDs, templates, locks and health issues. Call this before editing.",
      inputSchema: {},
    },
    director_create_project: {
      description: "Create a clean local previs project with two actors, four shots and a 15-second timeline.",
      inputSchema: { name: B$.string().optional().describe("Project title") },
    },
    director_select: {
      description: "Select a shot or seek to an exact integer frame at 24fps.",
      inputSchema: { shot_id: B$.string().optional(), frame: B$.number().int().min(0).optional() },
    },
    director_add_element: {
      description:
        "Add a stable-ID actor, animal, crowd or greybox prop to every shot. Prefer preset IDs from director_get_state.",
      inputSchema: {
        kind: B$.enum(["mannequin", "crowd", "box", "sphere", "cylinder", "wall"]).optional(),
        preset: B$.enum([
          "person",
          "tall-person",
          "child",
          "quadruped",
          "small-animal",
          "crowd-3",
          "crowd-5",
          "table",
          "round-table",
          "chair",
          "sofa",
          "door",
          "wall",
          "column",
          "car",
          "screen",
          "crate",
        ]).optional(),
        name: B$.string().optional(),
        position: DJ().optional(),
        rotation_deg: DJ().optional(),
        scale: DJ().optional(),
        color: B$.string().optional(),
        identity_source: B$.enum(["workshop", "temporary", "image-analysis"]).optional(),
        character_id: B$.string().optional(),
        performance_profile_id: B$.enum([
          "neutral",
          "restrained",
          "confident",
          "energetic",
          "nervous",
          "tired",
          "authoritative",
          "casual",
        ]).optional(),
      },
    },
    director_update_element: {
      description:
        "Move, rotate, scale, rename or recolour a stage element. Use shot_only for blocking that only applies to one shot.",
      inputSchema: {
        element_id: B$.string(),
        shot_id: B$.string().optional(),
        shot_only: B$.boolean().optional(),
        name: B$.string().optional(),
        position: DJ().optional(),
        rotation_deg: DJ().optional(),
        target_element_id: B$.string().optional(),
        facing: B$.enum(["toward-target", "away-from-target", "face-each-other", "same-as-target", "keep"]).optional(),
        scale: DJ().optional(),
        color: B$.string().optional(),
        visible: B$.boolean().optional(),
        height_m: B$.number().min(0.2).max(4).optional(),
        pose_id: B$.string().optional(),
        performance_profile_id: B$.enum([
          "neutral",
          "restrained",
          "confident",
          "energetic",
          "nervous",
          "tired",
          "authoritative",
          "casual",
        ]).optional(),
      },
    },
    director_apply_action: {
      description: "Apply a professional motion template to an exact actor ID and generate editable motion keyframes.",
      inputSchema: {
        element_id: B$.string(),
        shot_id: B$.string().optional(),
        action: B$.string().describe("Action template ID from director_get_state"),
        start_frame: B$.number().int().min(0).optional(),
        duration_frames: B$.number().int().positive().optional(),
        from: DJ().optional(),
        to: DJ().optional(),
        target_element_id: B$.string().optional(),
        facing: B$.enum(["toward-target", "away-from-target", "face-each-other", "same-as-target", "keep"]).optional(),
        proximity_m: B$.number().min(0).max(10).optional(),
        emotion: B$.enum(["neutral", "tender", "intimate", "tense", "joyful", "grief", "menacing"]).optional(),
        intensity: B$.number().min(0.1).max(3).optional(),
        locked: B$.boolean().optional(),
        source: B$.enum(["agent", "manual"]).optional(),
      },
    },
    director_set_motion_keyframe: {
      description:
        "Add or edit an actor motion keyframe, including Bezier path handles, rotation and joints. Locked work requires explicit override.",
      inputSchema: {
        shot_id: B$.string().optional(),
        action_id: B$.string(),
        keyframe_id: B$.string().optional(),
        frame: B$.number().int().min(0),
        position: DJ().optional(),
        rotation_deg: DJ().optional(),
        path_in: DJ().optional(),
        path_out: DJ().optional(),
        path_mode: B$.enum(["corner", "smooth"]).optional(),
        joints: B$.record(B$.string(), DJ()).optional(),
        interpolation: B$.enum(["hold", "linear", "smooth", "ease-in", "ease-out"]).optional(),
        note: B$.string().optional(),
        locked: B$.boolean().optional(),
        source: B$.enum(["agent", "manual"]).optional(),
        override_locked: B$.boolean().optional(),
      },
    },
    director_apply_camera: {
      description: "Apply a professional camera move template and generate editable camera keyframes.",
      inputSchema: {
        shot_id: B$.string().optional(),
        move: B$.string().describe("Camera template ID from director_get_state"),
        override_locked: B$.boolean().optional(),
      },
    },
    director_set_camera_keyframe: {
      description: "Add or edit a camera keyframe with exact frame, position, target, field of view and roll.",
      inputSchema: {
        shot_id: B$.string().optional(),
        keyframe_id: B$.string().optional(),
        frame: B$.number().int().min(0),
        position: DJ().optional(),
        target: DJ().optional(),
        fov: B$.number().min(5).max(140).optional(),
        roll_deg: B$.number().min(-180).max(180).optional(),
        interpolation: B$.enum(["hold", "linear", "smooth", "ease-in", "ease-out"]).optional(),
        note: B$.string().optional(),
        locked: B$.boolean().optional(),
        source: B$.enum(["agent", "manual"]).optional(),
        override_locked: B$.boolean().optional(),
      },
    },
    director_manage_shot: {
      description: "Add, duplicate, rename, reorder or delete a shot. Shot times are normalized automatically.",
      inputSchema: {
        operation: B$.enum(["add", "duplicate", "rename", "reorder", "delete"]),
        shot_id: B$.string().optional(),
        name: B$.string().optional(),
        duration_frames: B$.number().int().positive().optional(),
        index: B$.number().int().min(0).optional(),
      },
    },
    director_set_lock: {
      description: "Lock or unlock a manually approved action or keyframe. Agents must preserve locked work.",
      inputSchema: {
        target: B$.enum(["action", "motion_keyframe", "camera_keyframe"]),
        id: B$.string(),
        shot_id: B$.string().optional(),
        locked: B$.boolean().optional(),
      },
    },
    director_delete: {
      description: "Delete an element, action or keyframe. Locked work requires explicit override.",
      inputSchema: {
        target: B$.enum(["element", "action", "motion_keyframe", "camera_keyframe"]),
        id: B$.string(),
        shot_id: B$.string().optional(),
        override_locked: B$.boolean().optional(),
      },
    },
    director_undo: {
      description: "Undo exactly one Director edit. History stores up to 50 complete project snapshots.",
      inputSchema: {},
    },
    director_redo: { description: "Redo exactly one previously undone Director edit.", inputSchema: {} },
    director_validate: {
      description:
        "Inspect the project for collisions, overlaps, discontinuities, missing paths, invalid ranges and camera problems.",
      inputSchema: {},
    },
  };
var BR = new Set([
  "director_select",
  "director_add_element",
  "director_update_element",
  "director_apply_action",
  "director_set_motion_keyframe",
  "director_apply_camera",
  "director_set_camera_keyframe",
  "director_manage_shot",
  "director_set_lock",
  "director_delete",
  "director_undo",
  "director_redo",
  "director_validate",
]);
async function ql($) {
  try {
    return (await Hl($), !0);
  } catch {
    return !1;
  }
}
async function zl() {
  let $ = [
    process.env.CODEX_CLI_PATH,
    "/Applications/ChatGPT.app/Contents/Resources/codex",
    "/opt/homebrew/bin/codex",
    "/usr/local/bin/codex",
  ].filter((J) => Boolean(J));
  for (let J of $) if (await ql(J)) return J;
  throw Error(
    "\u672A\u627E\u5230 Codex CLI\u3002\u8BF7\u5148\u5B89\u88C5\u6216\u6253\u5F00 Codex \u684C\u9762\u7248\u3002",
  );
}
function Bl($, J, U, Q = 180000) {
  return new Promise((W, X) => {
    let Y = Dl($, J, { stdio: ["pipe", "pipe", "pipe"], env: process.env }),
      D = [],
      H = [];
    (Y.stdout.on("data", (K) => D.push(Buffer.from(K))), Y.stderr.on("data", (K) => H.push(Buffer.from(K))));
    let G = setTimeout(() => {
      (Y.kill("SIGTERM"), X(Error("\u5BFC\u6F14\u52A9\u624B\u54CD\u5E94\u8D85\u65F6")));
    }, Q);
    (Y.once("error", (K) => {
      (clearTimeout(G), X(K));
    }),
      Y.once("close", (K) => {
        clearTimeout(G);
        let O = Buffer.concat(D).toString("utf8"),
          N = Buffer.concat(H).toString("utf8");
        if (K === 0) W({ stdout: O, stderr: N });
        else X(Error(N.trim() || O.trim() || `Codex exited with ${K}`));
      }),
      Y.stdin.end(U));
  });
}
function El($) {
  if (!$ || typeof $ !== "object") throw Error("\u5BFC\u6F14\u52A9\u624B\u8FD4\u56DE\u4E86\u65E0\u6548\u7ED3\u679C");
  let J = $,
    U = typeof J.message === "string" && J.message.trim() ? J.message.trim() : "\u5DF2\u5B8C\u6210\u3002",
    Q = Array.isArray(J.commands)
      ? J.commands.flatMap((W) => {
          if (!W || typeof W !== "object") return [];
          let X = W;
          if (typeof X.name !== "string" || !BR.has(X.name)) return [];
          let Y = {};
          if (typeof X.arguments_json === "string" && X.arguments_json.trim())
            try {
              let D = JSON.parse(X.arguments_json);
              if (D && typeof D === "object" && !Array.isArray(D)) Y = D;
            } catch {
              return [];
            }
          return [{ name: X.name, arguments: Y }];
        })
      : [];
  return { message: U, commands: Q };
}
var Ll = new Set(["director_apply_action", "director_set_motion_keyframe", "director_set_camera_keyframe"]),
  wl = new Set([
    "director_add_element",
    "director_update_element",
    "director_apply_action",
    "director_set_motion_keyframe",
    "director_apply_camera",
    "director_set_camera_keyframe",
    "director_manage_shot",
    "director_set_lock",
    "director_delete",
    "director_undo",
  ]);
function Il() {
  return Object.entries(j5).map(([$, J]) => {
    let U = {},
      Q = [];
    try {
      let W = J.inputSchema.toJSONSchema?.() ?? {};
      if (W.properties && typeof W.properties === "object") U = W.properties;
      if (Array.isArray(W.required)) Q = W.required;
    } catch {}
    return {
      type: "function",
      function: { name: $, description: J.description, parameters: { type: "object", properties: U, required: Q } },
    };
  });
}
function ER($, J = 4000) {
  let U = JSON.stringify($);
  return U.length > J
    ? `${U.slice(0, J)}
...(\u622A\u65AD)`
    : U;
}
function zR($, J = 6000) {
  if ($ && typeof $ === "object" && "health" in $) {
    let U = $,
      Q = JSON.stringify({ health: U.health }),
      W = Math.max(1000, J - Q.length),
      X = "";
    try {
      let Y = JSON.stringify({ project: U.project ?? {} });
      X =
        Y.length > W
          ? `${Y.slice(0, W)}
...(project \u5DF2\u622A\u65AD)`
          : Y;
    } catch {
      X = "";
    }
    return `${X}
${Q}`;
  }
  return ER($, J);
}
async function Vl($, J) {
  let U = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    Q = "deepseek-v4-pro",
    W = { model: "deepseek-v4-pro", messages: $, tools: J, tool_choice: "auto" },
    X = new AbortController(),
    Y = setTimeout(() => X.abort(), 600000);
  try {
    let D = await fetch(`${U}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify(W),
        signal: X.signal,
      }),
      H = await D.json();
    if (!D.ok) {
      let G = H.error?.message;
      throw Error(`DeepSeek API ${D.status}: ${G ?? JSON.stringify(H).slice(0, 200)}`);
    }
    return H.choices?.[0]?.message ?? {};
  } catch (D) {
    if (D instanceof Error && D.name === "AbortError")
      throw Error("DeepSeek API \u54CD\u5E94\u8D85\u65F6\uFF08600s\uFF09");
    throw D;
  } finally {
    clearTimeout(Y);
  }
}
async function kl($, J, U) {
  let Q = J.slice(-12).map(
      (N) => `${N.role === "user" ? "\u7528\u6237" : "\u5BFC\u6F14\u52A9\u624B"}\uFF1A${N.content}`,
    ).join(`
`),
    W = `\u4F60\u662F\u6D1B\u4E66 AI \u5BFC\u6F14\u53F0\u5185\u7684\u4E13\u4E1A\u7535\u5F71\u9884\u6F14\u52A9\u624B\uFF0C\u901A\u8FC7\u5DE5\u5177\u64CD\u4F5C 3D \u821E\u53F0\u3002

\u5DE5\u4F5C\u89C4\u5219\uFF1A
1. \u52A8\u624B\u524D\u5FC5\u987B\u5148\u8C03\u7528 director_get_state \u83B7\u53D6\u771F\u5B9E\u5143\u7D20 ID\u3001\u52A8\u4F5C/\u8FD0\u955C\u6A21\u677F\u548C\u9501\u5B9A\u72B6\u6001\uFF0C\u7EDD\u4E0D\u7F16\u9020\u4EBA\u7269\u6216\u4E34\u65F6\u89D2\u8272\u3002
2. \u6240\u6709\u65F6\u95F4\u7EBF\u5199\u5165\u4F7F\u7528 24fps \u6574\u6570\u5E27\uFF1Bduration_seconds \xD7 24 = duration_frames\u3002
3. \u7EDD\u4E0D\u8986\u76D6\u4EBA\u5DE5\u9501\u5B9A\u7684\u5185\u5BB9\uFF0C\u9664\u975E\u7528\u6237\u660E\u786E\u8981\u6C42\uFF08\u6B64\u65F6\u4F20 override_locked=true\uFF09\u3002
4. \u52A8\u4F5C\u6A21\u677F ID \u548C\u8FD0\u955C\u6A21\u677F ID \u5FC5\u987B\u4F7F\u7528 get_state \u8FD4\u56DE\u7684\u771F\u5B9E ID\uFF0C\u4E0D\u8981\u81C6\u9020\u3002
5. \u591A\u6B65\u7F16\u8F91\u5B8C\u6210\u540E\u5FC5\u987B\u8C03\u7528 director_validate \u68C0\u67E5\u78B0\u649E/\u91CD\u53E0/\u8DEF\u5F84\u95EE\u9898\u3002
6. \u4F7F\u7528\u4E2D\u6587\u56DE\u590D\uFF0C\u7B80\u660E\u8BF4\u660E\u4F60\u505A\u4E86\u4EC0\u4E48\u3002`,
    X = [
      {
        role: "system",
        content: `\u4F60\u662F\u6D1B\u4E66 AI \u5BFC\u6F14\u53F0\u5185\u7684\u4E13\u4E1A\u7535\u5F71\u9884\u6F14\u52A9\u624B\uFF0C\u901A\u8FC7\u5DE5\u5177\u64CD\u4F5C 3D \u821E\u53F0\u3002

\u5DE5\u4F5C\u89C4\u5219\uFF1A
1. \u52A8\u624B\u524D\u5FC5\u987B\u5148\u8C03\u7528 director_get_state \u83B7\u53D6\u771F\u5B9E\u5143\u7D20 ID\u3001\u52A8\u4F5C/\u8FD0\u955C\u6A21\u677F\u548C\u9501\u5B9A\u72B6\u6001\uFF0C\u7EDD\u4E0D\u7F16\u9020\u4EBA\u7269\u6216\u4E34\u65F6\u89D2\u8272\u3002
2. \u6240\u6709\u65F6\u95F4\u7EBF\u5199\u5165\u4F7F\u7528 24fps \u6574\u6570\u5E27\uFF1Bduration_seconds \xD7 24 = duration_frames\u3002
3. \u7EDD\u4E0D\u8986\u76D6\u4EBA\u5DE5\u9501\u5B9A\u7684\u5185\u5BB9\uFF0C\u9664\u975E\u7528\u6237\u660E\u786E\u8981\u6C42\uFF08\u6B64\u65F6\u4F20 override_locked=true\uFF09\u3002
4. \u52A8\u4F5C\u6A21\u677F ID \u548C\u8FD0\u955C\u6A21\u677F ID \u5FC5\u987B\u4F7F\u7528 get_state \u8FD4\u56DE\u7684\u771F\u5B9E ID\uFF0C\u4E0D\u8981\u81C6\u9020\u3002
5. \u591A\u6B65\u7F16\u8F91\u5B8C\u6210\u540E\u5FC5\u987B\u8C03\u7528 director_validate \u68C0\u67E5\u78B0\u649E/\u91CD\u53E0/\u8DEF\u5F84\u95EE\u9898\u3002
6. \u4F7F\u7528\u4E2D\u6587\u56DE\u590D\uFF0C\u7B80\u660E\u8BF4\u660E\u4F60\u505A\u4E86\u4EC0\u4E48\u3002`,
      },
      {
        role: "user",
        content: `\u5F53\u524D\u5B8C\u6574\u5DE5\u7A0B\u72B6\u6001(JSON)\uFF1A
${zR(U, 20000)}

\u6700\u8FD1\u5BF9\u8BDD\uFF1A
${Q}

\u8BF7\u6839\u636E\u5BF9\u8BDD\u7EE7\u7EED\u6267\u884C\u3002`,
      },
    ],
    Y = Il(),
    D = [],
    H = !1,
    G = !1;
  for (let N = 0; N < 20; N++) {
    let F = await Vl(X, Y),
      B = F.tool_calls ?? [];
    if (B.length === 0)
      return {
        message: F.content?.trim() || "\u5DF2\u5B8C\u6210\u3002",
        commands: D,
        state: await $.execute("director_get_state"),
      };
    X.push({ role: "assistant", content: F.content ?? null, tool_calls: B });
    for (let E of B) {
      let z = {};
      try {
        z = JSON.parse(E.function.arguments || "{}");
      } catch {}
      let q = E.function.name;
      if (wl.has(q)) H = !0;
      if (q === "director_validate") G = !0;
      try {
        if (Ll.has(q)) z = { ...z, source: "agent" };
        let L = await $.execute(q, z);
        (D.push({ name: q, ok: !0 }), X.push({ role: "tool", tool_call_id: E.id, content: zR(L) }));
      } catch (L) {
        let V = L instanceof Error ? L.message : String(L);
        (D.push({ name: q, ok: !1, error: V }),
          X.push({ role: "tool", tool_call_id: E.id, content: `\u9519\u8BEF: ${ER(V, 500)}` }));
      }
    }
  }
  let K = [...X].reverse().find((N) => N.role === "assistant" && typeof N.content === "string" && N.content.trim()),
    O =
      K && typeof K.content === "string"
        ? K.content.trim()
        : "\u5DF2\u8FBE\u5230\u6700\u5927\u5DE5\u5177\u8F6E\u6B21\uFF0C\u5148\u5230\u8FD9\u91CC\u3002";
  if (H && !G)
    try {
      (await $.execute("director_validate"), D.push({ name: "director_validate", ok: !0 }));
    } catch (N) {
      D.push({ name: "director_validate", ok: !1, error: N instanceof Error ? N.message : String(N) });
    }
  return { message: O, commands: D, state: await $.execute("director_get_state") };
}
async function LR($, J) {
  let U = await $.execute("director_get_state");
  if (process.env.DEEPSEEK_API_KEY) return kl($, J, U);
  let Q = await zl(),
    W = await Gl(Yz(Fl(), "previs-engine-agent-")),
    X = Yz(W, "response.schema.json"),
    Y = Yz(W, "response.json");
  await Ol(
    X,
    JSON.stringify({
      type: "object",
      additionalProperties: !1,
      required: ["message", "commands"],
      properties: {
        message: { type: "string" },
        commands: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: !1,
            required: ["name", "arguments_json"],
            properties: {
              name: { type: "string" },
              arguments_json: { type: "string", description: "A JSON object encoded as a string" },
            },
          },
        },
      },
    }),
    "utf8",
  );
  let H = J.slice(-12).map(
      (K) => `${K.role === "user" ? "\u7528\u6237" : "\u5BFC\u6F14\u52A9\u624B"}\uFF1A${K.content}`,
    ).join(`
`),
    G = `\u4F60\u662F\u6D1B\u4E66 AI \u5BFC\u6F14\u53F0\u5185\u7684\u4E13\u4E1A\u7535\u5F71\u9884\u6F14\u52A9\u624B\u3002\u4F60\u53EA\u8F93\u51FA\u7B26\u5408 schema \u7684 JSON\u3002

\u5DE5\u4F5C\u89C4\u5219\uFF1A
1. \u6839\u636E\u5DE5\u7A0B\u72B6\u6001\u4E2D\u7684\u7CBE\u786E ID \u64CD\u4F5C\uFF0C\u7EDD\u4E0D\u7F16\u9020\u4EBA\u7269\u6216\u4E34\u65F6\u89D2\u8272\u3002
2. \u7528\u6237\u9700\u6C42\u660E\u786E\u65F6\uFF0C\u8F93\u51FA\u53EF\u6267\u884C commands\uFF1B\u9700\u6C42\u542B\u7CCA\u65F6\u5148\u5728 message \u4E2D\u63D0\u51FA\u4E00\u4E2A\u6E05\u695A\u95EE\u9898\uFF0Ccommands \u7559\u7A7A\u3002
3. \u6240\u6709\u65F6\u95F4\u90FD\u662F 24fps \u7684\u6574\u6570\u5E27\u3002\u52A8\u4F5C\u548C\u8FD0\u955C\u8981\u843D\u5728\u5F53\u524D\u5206\u955C\u65F6\u957F\u5185\u3002
4. locked=true \u662F\u4EBA\u5DE5\u51B3\u5B9A\uFF0C\u9664\u975E\u7528\u6237\u660E\u786E\u8981\u6C42\u8986\u76D6\uFF0C\u5426\u5219\u7EDD\u4E0D\u4F7F\u7528 override_locked\u3002
5. \u4EBA\u7269\u6DFB\u52A0\u4F18\u5148\u4F7F\u7528 director_add_element \u7684 preset\u3002\u89D2\u8272\u3001\u52A8\u7269\u3001\u7FA4\u4F17\u548C\u9053\u5177\u5FC5\u987B\u6709\u7A33\u5B9A ID\u3002
6. \u591A\u6B65\u4FEE\u6539\u6700\u540E\u6DFB\u52A0 director_validate\u3002\u4E0D\u8981\u91CD\u7F6E\u5DE5\u7A0B\u3002
7. \u4E0D\u6267\u884C\u5BFC\u51FA\uFF0C\u5BFC\u51FA\u5FC5\u987B\u7531\u7528\u6237\u5728\u754C\u9762\u624B\u52A8\u786E\u8BA4\u3002
8. \u56DE\u7B54\u7528\u7B80\u6D01\u4E2D\u6587\uFF0C\u8BF4\u660E\u5C06\u505A\u4EC0\u4E48\u6216\u5DF2\u7ECF\u505A\u4E86\u4EC0\u4E48\u3002

\u5141\u8BB8\u7684\u547D\u4EE4\uFF1A${[...BR].join(", ")}

\u5F53\u524D\u5B8C\u6574\u5DE5\u7A0B\u72B6\u6001\uFF1A
${JSON.stringify(U)}

\u6700\u8FD1\u5BF9\u8BDD\uFF1A
${H}`;
  try {
    await Bl(
      Q,
      [
        "exec",
        "--ephemeral",
        "--skip-git-repo-check",
        "--ignore-user-config",
        "--ignore-rules",
        "-s",
        "read-only",
        "-c",
        'approval_policy="never"',
        "--output-schema",
        X,
        "--output-last-message",
        Y,
        "-",
      ],
      G,
    );
    let K = El(JSON.parse(await Kl(Y, "utf8"))),
      O = [];
    for (let N of K.commands)
      try {
        let F = { ...(N.arguments ?? {}) };
        if (
          N.name === "director_apply_action" ||
          N.name === "director_set_motion_keyframe" ||
          N.name === "director_set_camera_keyframe"
        )
          F.source = "agent";
        (await $.execute(N.name, F), O.push({ name: N.name, ok: !0 }));
      } catch (F) {
        O.push({ name: N.name, ok: !1, error: F instanceof Error ? F.message : String(F) });
        break;
      }
    return { message: K.message, commands: O, state: await $.execute("director_get_state") };
  } finally {
    await Nl(W, { recursive: !0, force: !0 });
  }
}
var Tl = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
function K1($, J, U) {
  ($.writeHead(J, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "http://127.0.0.1:5173",
    "Access-Control-Allow-Headers": "Content-Type",
  }),
    $.end(JSON.stringify(U)));
}
async function jl($, J = 2000000) {
  let U = [],
    Q = 0;
  for await (let W of $) {
    let X = Buffer.isBuffer(W) ? W : Buffer.from(W);
    if (((Q += X.length), Q > J)) throw Error(`Request body exceeds ${Math.round(J / 1e6)}MB`);
    U.push(X);
  }
  return Buffer.concat(U);
}
async function wR($) {
  return JSON.parse((await jl($)).toString("utf8") || "{}");
}
async function IR($) {
  try {
    return (await Ml($), !0);
  } catch {
    return !1;
  }
}
function vl() {
  if (process.env.PREVIZ_ENGINE_WEB_ROOT) return Sl(process.env.PREVIZ_ENGINE_WEB_ROOT);
  return Cl(new URL("./web", import.meta.url));
}
async function bl($, J) {
  let U = vl();
  if (!(await IR(U))) return !1;
  let Q = new URL($.url ?? "/", "http://127.0.0.1"),
    W = _l(decodeURIComponent(Q.pathname)).replace(/^(\.\.(\/|\\|$))+/, ""),
    X = Dz(U, W === "/" ? "index.html" : W);
  if (!X.startsWith(U)) return !1;
  try {
    if ((await Rl(X)).isDirectory()) X = Dz(X, "index.html");
  } catch {
    X = Dz(U, "index.html");
  }
  if (!(await IR(X))) return !1;
  return (
    J.writeHead(200, {
      "Content-Type": Tl[Pl(X)] ?? "application/octet-stream",
      "Cache-Control": X.endsWith("index.html") ? "no-cache" : "public, max-age=3600",
    }),
    Al(X).pipe(J),
    !0
  );
}
async function VR($, J) {
  let U = Zl(async (W, X) => {
      try {
        if (W.method === "OPTIONS") {
          (X.writeHead(204, {
            "Access-Control-Allow-Origin": "http://127.0.0.1:5173",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          }),
            X.end());
          return;
        }
        if (W.method === "GET" && W.url === "/api/health") {
          K1(X, 200, { ok: !0, service: "previs-engine", transport: "http" });
          return;
        }
        if (W.method === "GET" && W.url === "/api/project") {
          K1(X, 200, await $.execute("director_get_state"));
          return;
        }
        if (W.method === "POST" && W.url === "/api/command") {
          let Y = await wR(W);
          if (typeof Y.name !== "string") throw Error("Command name is required");
          K1(X, 200, { ok: !0, result: await $.execute(Y.name, Y.arguments) });
          return;
        }
        if (W.method === "POST" && W.url === "/api/agent/chat") {
          let Y = await wR(W);
          if (!Array.isArray(Y.messages) || !Y.messages.length)
            throw Error("\u5BF9\u8BDD\u6D88\u606F\u4E0D\u80FD\u4E3A\u7A7A");
          let D = Y.messages.slice(-12).map((H) => {
            if (!H || typeof H !== "object") throw Error("\u5BF9\u8BDD\u6D88\u606F\u683C\u5F0F\u65E0\u6548");
            let G = H;
            if ((G.role !== "user" && G.role !== "assistant") || typeof G.content !== "string")
              throw Error("\u5BF9\u8BDD\u6D88\u606F\u683C\u5F0F\u65E0\u6548");
            return { role: G.role, content: G.content.slice(0, 6000) };
          });
          K1(X, 200, { ok: !0, result: await LR($, D) });
          return;
        }
        if (W.method === "GET" && (await bl(W, X))) return;
        K1(X, 404, { ok: !1, error: "Not found" });
      } catch (Y) {
        K1(X, 400, { ok: !1, error: Y instanceof Error ? Y.message : String(Y) });
      }
    }),
    Q = process.env.PREVIZ_ENGINE_HOST ?? "127.0.0.1";
  (await new Promise((W, X) => {
    (U.once("error", X), U.listen(J, Q, () => W()));
  }),
    process.stderr.write(`Previs engine stage: http://${Q === "0.0.0.0" ? "localhost" : Q}:${J}
`));
}
var kR = { "16:9": 1.7777777777777777, "9:16": 0.5625, "4:3": 1.3333333333333333, "1:1": 1 };
import { webcrypto as MR } from "crypto";
var AR = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
var fl = 128,
  u8,
  N1;
function yl($) {
  if ($ < 0) throw RangeError("Wrong ID size");
  try {
    if (!u8 || u8.length < $) ((u8 = Buffer.allocUnsafe($ * fl)), MR.getRandomValues(u8), (N1 = 0));
    else if (N1 + $ > u8.length) (MR.getRandomValues(u8), (N1 = 0));
  } catch (J) {
    throw ((u8 = void 0), J);
  }
  N1 += $;
}
function O1($ = 21) {
  yl(($ |= 0));
  let J = "";
  for (let U = N1 - $; U < N1; U++) J += AR[u8[U] & 63];
  return J;
}
var l8 = ($, J) =>
    J.map(([U, Q, W, X = "\u6807\u51C6"]) => ({ id: U, label: Q, category: $, description: W, intensity: X })),
  Hz = [
    ...l8("\u7A33\u5B9A", [
      [
        "static",
        "\u9501\u5B9A\u673A\u4F4D",
        "\u5B8C\u5168\u56FA\u5B9A\uFF0C\u5F3A\u8C03\u8868\u6F14\u548C\u6784\u56FE",
        "\u514B\u5236",
      ],
    ]),
    ...l8("\u63A8\u62C9", [
      ["push", "\u8F68\u9053\u63A8\u8FD1", "\u6CBF\u89C6\u7EBF\u65B9\u5411\u7A33\u5B9A\u9760\u8FD1\u4E3B\u4F53"],
      ["pull", "\u8F68\u9053\u62C9\u8FDC", "\u4ECE\u4E3B\u4F53\u9000\u51FA\u5E76\u4EA4\u4EE3\u73AF\u5883"],
      [
        "zoom-in",
        "\u5149\u5B66\u53D8\u7126\u63A8\u8FD1",
        "\u673A\u4F4D\u4E0D\u52A8\uFF0C\u4EC5\u6536\u7A84\u89C6\u89D2",
      ],
      ["zoom-out", "\u5149\u5B66\u53D8\u7126\u62C9\u8FDC", "\u673A\u4F4D\u4E0D\u52A8\uFF0C\u6269\u5927\u89C6\u89D2"],
      [
        "dolly-zoom",
        "\u5E0C\u533A\u67EF\u514B\u53D8\u7126",
        "\u673A\u4F4D\u4E0E\u7126\u6BB5\u53CD\u5411\u53D8\u5316\uFF0C\u5236\u9020\u7A7A\u95F4\u5F02\u53D8",
        "\u5F3A\u70C8",
      ],
    ]),
    ...l8("\u6A2A\u79FB", [
      ["truck-left", "\u5DE6\u6A2A\u79FB", "\u6444\u5F71\u673A\u5E73\u884C\u5411\u5DE6\u79FB\u52A8"],
      ["truck-right", "\u53F3\u6A2A\u79FB", "\u6444\u5F71\u673A\u5E73\u884C\u5411\u53F3\u79FB\u52A8"],
    ]),
    ...l8("\u6447\u6444", [
      [
        "pan-left",
        "\u5411\u5DE6\u6447\u6444",
        "\u673A\u4F4D\u56FA\u5B9A\uFF0C\u89C6\u7EBF\u5411\u5DE6\u5BFB\u627E\u4E3B\u4F53",
      ],
      [
        "pan-right",
        "\u5411\u53F3\u6447\u6444",
        "\u673A\u4F4D\u56FA\u5B9A\uFF0C\u89C6\u7EBF\u5411\u53F3\u5BFB\u627E\u4E3B\u4F53",
      ],
      ["tilt-up", "\u5411\u4E0A\u6447\u6444", "\u7531\u4F4E\u5904\u63ED\u793A\u9AD8\u5904\u4FE1\u606F"],
      ["tilt-down", "\u5411\u4E0B\u6447\u6444", "\u7531\u9AD8\u5904\u843D\u5411\u4EBA\u7269\u6216\u7EC6\u8282"],
      [
        "whip-pan-left",
        "\u5DE6\u7529\u955C",
        "\u5FEB\u901F\u5DE6\u7529\u5E76\u5728\u76EE\u6807\u5904\u5236\u52A8",
        "\u5F3A\u70C8",
      ],
      [
        "whip-pan-right",
        "\u53F3\u7529\u955C",
        "\u5FEB\u901F\u53F3\u7529\u5E76\u5728\u76EE\u6807\u5904\u5236\u52A8",
        "\u5F3A\u70C8",
      ],
    ]),
    ...l8("\u5347\u964D", [
      ["crane-up", "\u5347\u955C\u5934", "\u5782\u76F4\u5347\u9AD8\uFF0C\u6269\u5927\u7A7A\u95F4"],
      ["crane-down", "\u964D\u955C\u5934", "\u5782\u76F4\u4E0B\u964D\uFF0C\u9760\u8FD1\u4EBA\u7269"],
      ["jib-up", "\u6447\u81C2\u5347\u8D77", "\u6444\u5F71\u673A\u548C\u6CE8\u89C6\u70B9\u5171\u540C\u4E0A\u626C"],
      ["jib-down", "\u6447\u81C2\u843D\u4E0B", "\u6444\u5F71\u673A\u548C\u6CE8\u89C6\u70B9\u5171\u540C\u4E0B\u964D"],
    ]),
    ...l8("\u5F27\u7EBF", [
      ["orbit", "\u534A\u73AF\u7ED5", "\u56F4\u7ED5\u4E3B\u4F53\u5EFA\u7ACB\u7A7A\u95F4\u5173\u7CFB"],
      ["arc-left", "\u5DE6\u5F27\u7EBF", "\u6CBF\u4E3B\u4F53\u5DE6\u4FA7\u5C0F\u5F27\u79FB\u52A8"],
      ["arc-right", "\u53F3\u5F27\u7EBF", "\u6CBF\u4E3B\u4F53\u53F3\u4FA7\u5C0F\u5F27\u79FB\u52A8"],
    ]),
    ...l8("\u8DDF\u62CD", [
      ["follow", "\u540E\u65B9\u8DDF\u62CD", "\u4FDD\u6301\u8DDD\u79BB\u8DDF\u968F\u4E3B\u4F53"],
      ["tracking", "\u4FA7\u5411\u8DDF\u62CD", "\u5E73\u884C\u8DDF\u968F\u4EBA\u7269\u8FD0\u52A8"],
      ["steadicam", "\u7A33\u5B9A\u5668\u8DDF\u62CD", "\u5E26\u8F7B\u5FAE\u547C\u5438\u7684\u5E73\u6ED1\u8DDF\u62CD"],
    ]),
    ...l8("\u8868\u73B0\u6027", [
      ["handheld", "\u8F7B\u624B\u6301", "\u7EC6\u5FAE\u547C\u5438\u548C\u8EAB\u4F53\u53CD\u9988", "\u514B\u5236"],
      [
        "handheld-intense",
        "\u5F3A\u624B\u6301",
        "\u51B2\u7A81\u573A\u9762\u7684\u660E\u663E\u9707\u52A8",
        "\u5F3A\u70C8",
      ],
      ["roll-left", "\u5DE6\u503E\u63ED\u793A", "\u753B\u9762\u9010\u6E10\u5411\u5DE6\u503E\u659C", "\u5F3A\u70C8"],
      ["roll-right", "\u53F3\u503E\u63ED\u793A", "\u753B\u9762\u9010\u6E10\u5411\u53F3\u503E\u659C", "\u5F3A\u70C8"],
    ]),
  ];
var SU = ($, J) => ({ x: $.x + J.x, y: $.y + J.y, z: $.z + J.z }),
  RR = ($, J) => ({ x: $.x - J.x, y: $.y - J.y, z: $.z - J.z }),
  m8 = ($, J) => ({ x: $.x * J, y: $.y * J, z: $.z * J }),
  xl = ($) => Math.max(0.001, Math.hypot($.x, $.y, $.z)),
  ZR = ($) => m8($, 1 / xl($));
function F1($, J, U, Q, W = 0, X) {
  return {
    id: `ckf-${O1(7)}`,
    timeSec: $,
    position: J,
    target: U,
    fov: Q,
    rollDeg: W,
    interpolation: "smooth",
    source: "template",
    note: X,
  };
}
function Gz($, J) {
  let U = Math.max(0.25, $.durationSec),
    Q = { ...$.position },
    W = { ...$.target },
    X = ZR(RR(W, Q)),
    Y = ZR({ x: X.z, y: 0, z: -X.x }),
    D = { ...Q },
    H = { ...W },
    G = $.fov,
    K = $.rollDeg ?? 0;
  if (J === "push" || J === "follow" || J === "steadicam") D = SU(Q, m8(X, 1.6));
  if (J === "pull") D = SU(Q, m8(X, -1.8));
  if (J === "truck-left" || J === "tracking") D = SU(Q, m8(Y, -1.8));
  if (J === "truck-right") D = SU(Q, m8(Y, 1.8));
  if (J === "crane-up") D.y += 1.6;
  if (J === "crane-down") D.y = Math.max(0.3, D.y - 1.4);
  if (J === "jib-up") ((D.y += 1.5), (H.y += 0.7));
  if (J === "jib-down") ((D.y = Math.max(0.3, D.y - 1.3)), (H.y = Math.max(0.2, H.y - 0.6)));
  if (J === "pan-left" || J === "whip-pan-left") H = SU(W, m8(Y, -2.4));
  if (J === "pan-right" || J === "whip-pan-right") H = SU(W, m8(Y, 2.4));
  if (J === "tilt-up") H.y += 1.5;
  if (J === "tilt-down") H.y = Math.max(0, H.y - 1.3);
  if (J === "zoom-in") G = Math.max(12, $.fov * 0.68);
  if (J === "zoom-out") G = Math.min(85, $.fov * 1.35);
  if (J === "dolly-zoom") ((D = SU(Q, m8(X, 1.8))), (G = Math.min(90, $.fov * 1.45)));
  if (J === "roll-left") K -= 14;
  if (J === "roll-right") K += 14;
  if (J === "orbit" || J === "arc-left" || J === "arc-right") {
    let N = RR(Q, W),
      F = ((J === "orbit" ? 55 : J === "arc-left" ? -28 : 28) * Math.PI) / 180;
    D = SU(W, { x: N.x * Math.cos(F) + N.z * Math.sin(F), y: N.y, z: -N.x * Math.sin(F) + N.z * Math.cos(F) });
  }
  let O = [F1(0, Q, W, $.fov, $.rollDeg ?? 0, "\u8D77\u59CB\u673A\u4F4D")];
  if (J === "whip-pan-left" || J === "whip-pan-right")
    (O.push(F1(U * 0.72, Q, W, $.fov, $.rollDeg ?? 0, "\u7529\u955C\u8D77\u52BF")),
      O.push(F1(U * 0.9, D, H, G, K, "\u5FEB\u901F\u7529\u52A8")));
  else if (J === "handheld" || J === "handheld-intense") {
    let N = J === "handheld-intense" ? 0.12 : 0.035;
    (O.push(F1(U * 0.35, SU(Q, { x: N, y: -N * 0.4, z: 0 }), W, $.fov, K, "\u624B\u6301\u547C\u5438")),
      O.push(F1(U * 0.68, SU(Q, { x: -N * 0.7, y: N * 0.5, z: 0 }), W, $.fov, K, "\u8EAB\u4F53\u53CD\u9988")));
  }
  return (O.push(F1(U, D, H, G, K, "\u7ED3\u675F\u673A\u4F4D")), O);
}
function PR($, J) {
  let U = Gz($, J),
    Q = U[U.length - 1];
  return {
    cameraMove: J,
    cameraKeyframes: U,
    cameraEnd: { position: { ...Q.position }, target: { ...Q.target }, fov: Q.fov, rollDeg: Q.rollDeg },
  };
}
var _R = 1,
  gl = 24;
function l0($) {
  return `${$}-${O1(8)}`;
}
function nQ($) {
  return {
    position: structuredClone($.position),
    rotationDeg: structuredClone($.rotationDeg),
    scale: structuredClone($.scale),
    visible: $.visible,
  };
}
function SR($) {
  let J = 0;
  return {
    ...$,
    shots: $.shots.map((U) => {
      let Q = { ...U, startSec: J, durationSec: Math.max(1 / gl, U.durationSec) };
      return ((J += Q.durationSec), Q);
    }),
  };
}
function Kz($) {
  return (
    ($.plans.find((U) => U.id === $.activePlanId) ?? $.plans[0])?.shots.reduce((U, Q) => U + Q.durationSec, 0) ?? 0
  );
}
function q1($ = 0) {
  return {
    id: l0("el"),
    kind: "mannequin",
    name: `Actor ${$ + 1}`,
    position: { x: $ * 1.4 - 0.7, y: 0, z: 0 },
    rotationDeg: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    color: $ % 2 ? "#55c2ff" : "#ff7a66",
    visible: !0,
    groupId: null,
    poseId: "stand",
    joints: {},
    heightM: 1.72,
    identitySource: "temporary",
    performanceProfileId: "neutral",
  };
}
function Nz($, J = 0, U = 0, Q = 3.75, W = "16:9") {
  let X = { x: J % 2 ? 2.6 : 0, y: 2.2, z: J % 2 ? 6.2 : 7.2 },
    Y = { x: 0, y: 1, z: 0 },
    D = {
      id: l0("shot"),
      name: `Shot ${J + 1}`,
      position: X,
      target: Y,
      fov: J % 2 ? 42 : 50,
      aspect: W,
      createdAt: Date.now(),
      startSec: U,
      durationSec: Q,
      cameraEnd: { position: { ...X }, target: { ...Y }, fov: J % 2 ? 42 : 50 },
      cameraMove: "static",
      elementStates: Object.fromEntries($.map((H) => [H.id, nQ(H)])),
      actions: [],
    };
  return ((D.cameraKeyframes = Gz(D, "static")), D);
}
function Oz($ = "Untitled Previs") {
  let J = [q1(0), q1(1)],
    U = Array.from({ length: 4 }, (X, Y) => Nz(J, Y, Y * 3.75)),
    Q = {
      id: l0("plan"),
      name: "Main Plan",
      summary: "15 seconds, 4 shots, agent-ready 3D previs",
      createdAt: Date.now(),
      shots: U,
    },
    W = Date.now();
  return {
    version: _R,
    id: l0("project"),
    name: $,
    aspect: "16:9",
    elements: J,
    plans: [Q],
    activePlanId: Q.id,
    activeShotId: U[0].id,
    currentFrame: 0,
    createdAt: W,
    updatedAt: W,
  };
}
function z1($) {
  let J = $.plans.find((U) => U.id === $.activePlanId) ?? $.plans[0];
  if (!J) throw Error("Project has no director plan");
  return J;
}
function CR($) {
  let J = z1($),
    U = J.shots.find((Q) => Q.id === $.activeShotId) ?? J.shots[0];
  if (!U) throw Error("Project has no shot");
  return U;
}
function iQ($) {
  let J = [];
  if ($.version !== _R) J.push(`Unsupported project version: ${$.version}`);
  if (!$.plans.length) J.push("Project has no plans");
  if (!$.elements.length) J.push("Project has no stage elements");
  let U = new Set();
  for (let Q of $.elements) {
    if (U.has(Q.id)) J.push(`Duplicate element id: ${Q.id}`);
    U.add(Q.id);
  }
  for (let Q of $.plans) {
    if (!Q.shots.length) J.push(`Plan ${Q.id} has no shots`);
    for (let W of Q.shots)
      for (let X of W.actions)
        if (!U.has(X.elementId)) J.push(`Action ${X.id} references missing element ${X.elementId}`);
  }
  return J;
}
var J6 = ($ = 0, J = 0, U = 0) => ({ x: $, y: J, z: U }),
  hl = [
    { id: "stand", label: "\u7AD9\u7ACB", joints: {} },
    {
      id: "sit",
      label: "\u5750",
      rootYOffsetH: -0.24,
      joints: { hipL: J6(-90), hipR: J6(-90), kneeL: J6(90), kneeR: J6(90), spine: J6(5) },
    },
    {
      id: "walk",
      label: "\u884C\u8D70",
      joints: { hipL: J6(-25), hipR: J6(20), kneeR: J6(40), shoulderL: J6(20), shoulderR: J6(-25), spine: J6(3) },
    },
    {
      id: "run",
      label: "\u5954\u8DD1",
      joints: {
        hipL: J6(-50),
        hipR: J6(35),
        kneeL: J6(20),
        kneeR: J6(80),
        shoulderL: J6(40),
        shoulderR: J6(-45),
        elbowL: J6(-90),
        elbowR: J6(-90),
        spine: J6(12),
      },
    },
    { id: "point", label: "\u6307\u5411", joints: { shoulderR: J6(-85), neck: J6(0, 12), spine: J6(0, 8) } },
    {
      id: "hug",
      label: "\u73AF\u62B1",
      joints: { shoulderL: J6(-60, 25), shoulderR: J6(-60, -25), elbowL: J6(-35), elbowR: J6(-35) },
    },
    {
      id: "kneel",
      label: "\u5355\u819D\u8DEA",
      rootYOffsetH: -0.17,
      joints: { hipR: J6(-90), kneeR: J6(90), kneeL: J6(90), spine: J6(8) },
    },
    { id: "lie", label: "\u8EBA", rootYOffsetH: -0.46, joints: { hips: J6(-90), neck: J6(20) } },
    {
      id: "wave",
      label: "\u6325\u624B",
      joints: { shoulderR: J6(0, 0, -150), elbowR: J6(0, 0, -20), neck: J6(0, 0, 6) },
    },
    {
      id: "armscross",
      label: "\u62B1\u81C2",
      joints: { shoulderL: J6(-55, 35), shoulderR: J6(-55, -35), elbowL: J6(-100), elbowR: J6(-100) },
    },
    {
      id: "headdown",
      label: "\u4F4E\u5934\u6C89\u601D",
      joints: { neck: J6(25), spine: J6(10), shoulderL: J6(5), shoulderR: J6(5) },
    },
    {
      id: "lean",
      label: "\u501A\u9760",
      joints: { spine: J6(-8, 0, 6), hipL: J6(-10), kneeL: J6(15), shoulderL: J6(0, 0, 10) },
    },
  ];
function oQ($) {
  return hl.find((J) => J.id === $);
}
function Fz($, J) {
  return { x: $.x + (J?.x ?? 0), y: $.y + (J?.y ?? 0), z: $.z + (J?.z ?? 0) };
}
function ul($, J, U, Q, W) {
  let X = Math.max(0, Math.min(1, W)),
    Y = 1 - X;
  return {
    x: Y * Y * Y * $.x + 3 * Y * Y * X * J.x + 3 * Y * X * X * U.x + X * X * X * Q.x,
    y: Y * Y * Y * $.y + 3 * Y * Y * X * J.y + 3 * Y * X * X * U.y + X * X * X * Q.y,
    z: Y * Y * Y * $.z + 3 * Y * Y * X * J.z + 3 * Y * X * X * U.z + X * X * X * Q.z,
  };
}
function qz($, J, U, Q) {
  let W = $.position ?? Q,
    X = J.position ?? W;
  if (!$.pathOut && !J.pathIn) return { x: W.x + (X.x - W.x) * U, y: W.y + (X.y - W.y) * U, z: W.z + (X.z - W.z) * U };
  return ul(W, Fz(W, $.pathOut), Fz(X, J.pathIn), X, U);
}
function TR($, J, U = 16) {
  let Q = [...$].filter((Y) => Y.position).sort((Y, D) => Y.timeSec - D.timeSec);
  if (Q.length === 0) return [{ position: J }];
  if (Q.length === 1) return [{ position: Q[0].position ?? J, keyframeId: Q[0].id }];
  let W = [];
  Q.slice(0, -1).forEach((Y, D) => {
    let H = Q[D + 1];
    for (let G = 0; G < U; G += 1) {
      let K = G / U;
      W.push({ position: qz(Y, H, K, J), keyframeId: G === 0 ? Y.id : void 0 });
    }
  });
  let X = Q[Q.length - 1];
  return (W.push({ position: X.position ?? J, keyframeId: X.id }), W);
}
function jR($, J) {
  if (!$.position) return null;
  return Fz($.position, J === "in" ? $.pathIn : $.pathOut);
}
var bR = [
  {
    id: "neutral",
    label: "\u81EA\u7136\u5199\u5B9E",
    description: "\u52A8\u4F5C\u5E45\u5EA6\u81EA\u7136\uFF0C\u9002\u5408\u591A\u6570\u5267\u60C5",
    motionScale: 1,
    personalSpaceM: 0.8,
    defaultPoseId: "stand",
  },
  {
    id: "restrained",
    label: "\u514B\u5236\u5185\u655B",
    description: "\u51CF\u5C11\u80A2\u4F53\u5E45\u5EA6\uFF0C\u4EE5\u5934\u773C\u548C\u91CD\u5FC3\u8868\u8FBE",
    motionScale: 0.72,
    personalSpaceM: 0.9,
    defaultPoseId: "stand",
  },
  {
    id: "confident",
    label: "\u6C89\u7A33\u81EA\u4FE1",
    description: "\u8EAB\u4F53\u5F00\u653E\uFF0C\u52A8\u4F5C\u660E\u786E\u800C\u4E0D\u8FC7\u5EA6",
    motionScale: 0.92,
    personalSpaceM: 1,
    defaultPoseId: "stand",
  },
  {
    id: "energetic",
    label: "\u654F\u6377\u5916\u653E",
    description: "\u52A8\u4F5C\u901F\u5EA6\u5FEB\u3001\u5E45\u5EA6\u66F4\u660E\u663E",
    motionScale: 1.28,
    personalSpaceM: 0.75,
    defaultPoseId: "stand",
  },
  {
    id: "nervous",
    label: "\u7D27\u5F20\u8B66\u89C9",
    description: "\u52A8\u4F5C\u504F\u788E\uFF0C\u89C6\u7EBF\u4E0E\u80A9\u9888\u53CD\u5E94\u66F4\u5F3A",
    motionScale: 1.12,
    personalSpaceM: 1.15,
    defaultPoseId: "headdown",
  },
  {
    id: "tired",
    label: "\u75B2\u60EB\u8FDF\u7F13",
    description: "\u91CD\u5FC3\u504F\u4F4E\uFF0C\u52A8\u4F5C\u542F\u52A8\u548C\u6536\u52BF\u66F4\u6162",
    motionScale: 0.68,
    personalSpaceM: 0.75,
    defaultPoseId: "lean",
  },
  {
    id: "authoritative",
    label: "\u5A01\u4E25\u5E84\u91CD",
    description: "\u51CF\u5C11\u591A\u4F59\u52A8\u4F5C\uFF0C\u4FDD\u6301\u7A33\u5B9A\u7A7A\u95F4\u5360\u4F4D",
    motionScale: 0.82,
    personalSpaceM: 1.25,
    defaultPoseId: "stand",
  },
  {
    id: "casual",
    label: "\u677E\u5F1B\u751F\u6D3B\u5316",
    description: "\u8F7B\u5FAE\u91CD\u5FC3\u504F\u79FB\u548C\u4E0D\u5BF9\u79F0\u7AD9\u59FF",
    motionScale: 0.88,
    personalSpaceM: 0.7,
    defaultPoseId: "lean",
  },
];
var vR = {
  neutral: { label: "\u81EA\u7136", amplitude: 1 },
  tender: { label: "\u6E29\u67D4", amplitude: 0.72 },
  intimate: { label: "\u4EB2\u5BC6", amplitude: 0.62 },
  tense: { label: "\u7D27\u5F20", amplitude: 1.15 },
  joyful: { label: "\u559C\u60A6", amplitude: 1.22 },
  grief: { label: "\u60B2\u4F24", amplitude: 0.6 },
  menacing: { label: "\u5A01\u538B", amplitude: 1.3 },
};
function fR($) {
  return vR[$ ?? "neutral"] ?? vR.neutral;
}
var v5 = new Set([
  "walk",
  "fast-walk",
  "run",
  "follow",
  "pass-by",
  "dodge",
  "enter-car",
  "exit-car",
  "step-forward",
  "step-back",
]);
function Lz($) {
  return Math.max(0, Math.min(1, $));
}
function T9($) {
  let J = Lz($);
  return J * J * (3 - 2 * J);
}
function ll($, J) {
  let U = Lz($);
  if (J === "hold") return 0;
  if (J === "linear") return U;
  if (J === "ease-in") return U * U;
  if (J === "ease-out") return 1 - (1 - U) * (1 - U);
  return T9(U);
}
function j9($, J, U) {
  return $ + (J - $) * U;
}
function p8($, J, U) {
  return { x: j9($.x, J.x, U), y: j9($.y, J.y, U), z: j9($.z, J.z, U) };
}
function yR($, J) {
  let U = [...$].sort((Y, D) => Y.timeSec - D.timeSec);
  if (!U.length) return null;
  let Q = [...U].reverse().find((Y) => Y.timeSec <= J) ?? U[0],
    W = U.find((Y) => Y.timeSec > J) ?? Q,
    X = W === Q ? 0 : (J - Q.timeSec) / Math.max(0.001, W.timeSec - Q.timeSec);
  return { left: Q, right: W, progress: ll(X, Q.interpolation) };
}
function ml($, J, U) {
  let Q = new Set([...Object.keys($ ?? {}), ...Object.keys(J ?? {})]);
  return Object.fromEntries(
    [...Q].map((W) => {
      let X = $?.[W] ?? { x: 0, y: 0, z: 0 },
        Y = J?.[W] ?? X;
      return [W, p8(X, Y, U)];
    }),
  );
}
function zz($, J) {
  return Object.fromEntries(Object.entries($ ?? {}).map(([U, Q]) => [U, { x: Q.x * J, y: Q.y * J, z: Q.z * J }]));
}
function Bz($) {
  if (
    $ === "walk" ||
    $ === "fast-walk" ||
    $ === "follow" ||
    $ === "pass-by" ||
    $ === "step-back" ||
    $ === "step-forward"
  )
    return "walk";
  if ($ === "run" || $ === "dodge") return "run";
  if ($ === "sit") return "sit";
  if ($ === "kneel" || $ === "crouch") return "kneel";
  if ($ === "lie-down" || $ === "fall") return "lie";
  if ($ === "point") return "point";
  if ($ === "wave" || $ === "raise-hand") return "wave";
  if ($ === "hug") return "hug";
  if ($ === "sew" || $ === "read" || $ === "write" || $ === "hold") return "stand";
  return "stand";
}
function pl($, J, U) {
  let Q = (K = 0, O = 0, N = 0) => ({ x: K, y: O, z: N }),
    W = Math.max(1, U * ($ === "run" ? 2.3 : $ === "fast-walk" ? 1.8 : 1.35)),
    X = Math.sin(J * Math.PI * 2 * W),
    Y = Math.min(1, J / 0.12, (1 - J) / 0.12);
  if ($ === "walk" || $ === "fast-walk" || $ === "follow" || $ === "pass-by") {
    let K = $ === "fast-walk" ? 38 : 28;
    return {
      hipL: Q(X * K * Y),
      hipR: Q(-X * K * Y),
      kneeL: Q(Math.max(0, -X) * 48 * Y),
      kneeR: Q(Math.max(0, X) * 48 * Y),
      shoulderL: Q(-X * 24 * Y),
      shoulderR: Q(X * 24 * Y),
      spine: Q(4 * Y),
    };
  }
  if ($ === "run" || $ === "dodge")
    return {
      hipL: Q(X * 52 * Y),
      hipR: Q(-X * 52 * Y),
      kneeL: Q((18 + Math.max(0, -X) * 75) * Y),
      kneeR: Q((18 + Math.max(0, X) * 75) * Y),
      shoulderL: Q(-X * 42 * Y),
      shoulderR: Q(X * 42 * Y),
      elbowL: Q(-75 * Y),
      elbowR: Q(-75 * Y),
      spine: Q(13 * Y),
    };
  if ($ === "wave")
    return {
      shoulderR: Q(0, 0, -145),
      elbowR: Q(0, 0, -25 + Math.sin(J * Math.PI * 8) * 28),
      neck: Q(0, Math.sin(J * Math.PI * 2) * 5, 0),
    };
  if ($ === "raise-hand") return { shoulderR: Q(0, 0, -145 * T9(J)), elbowR: Q(0, 0, -22 * T9(J)) };
  if ($ === "turn") return { hips: Q(0, J * 55, 0), spine: Q(0, J * 28, 0), neck: Q(0, J * 18, 0) };
  if ($ === "look-back")
    return { spine: Q(0, Math.sin(J * Math.PI) * 22, 0), neck: Q(0, Math.sin(J * Math.PI) * 55, 0) };
  if ($ === "pick-up" || $ === "put-down") {
    let K = Math.sin(J * Math.PI);
    return {
      spine: Q(K * 38),
      hipL: Q(-K * 25),
      hipR: Q(-K * 25),
      kneeL: Q(K * 38),
      kneeR: Q(K * 38),
      shoulderR: Q(K * 72),
      elbowR: Q(-K * 24),
      neck: Q(K * 14),
    };
  }
  if ($ === "push")
    return {
      spine: Q(16),
      hipL: Q(-18),
      kneeL: Q(20),
      shoulderL: Q(78, 0, 10),
      shoulderR: Q(78, 0, -10),
      elbowL: Q(-18),
      elbowR: Q(-18),
    };
  if ($ === "pull")
    return {
      spine: Q(-12),
      hipR: Q(18),
      kneeR: Q(18),
      shoulderL: Q(50, 0, 12),
      shoulderR: Q(50, 0, -12),
      elbowL: Q(-95),
      elbowR: Q(-95),
    };
  if ($ === "open-door" || $ === "close-door")
    return {
      spine: Q(0, Math.sin(J * Math.PI) * 18, 0),
      shoulderR: Q(55, 0, -20),
      elbowR: Q(-65 + J * 28),
      neck: Q(0, Math.sin(J * Math.PI) * 16, 0),
    };
  if ($ === "face-to-face")
    return { neck: Q(0, Math.sin(J * Math.PI * 0.5) * 18, 0), spine: Q(0, Math.sin(J * Math.PI * 0.5) * 6, 0) };
  if ($ === "stand-up" || $ === "get-up") {
    let K = 1 - T9(J);
    return { hipL: Q(-90 * K), hipR: Q(-90 * K), kneeL: Q(90 * K), kneeR: Q(90 * K), spine: Q(28 * K) };
  }
  if ($ === "stop")
    return {
      spine: Q(Math.sin(J * Math.PI) * 7),
      hipL: Q(-Math.sin(J * Math.PI) * 8),
      hipR: Q(Math.sin(J * Math.PI) * 8),
    };
  if ($ === "sew")
    return {
      shoulderL: Q(35, 0, 12),
      shoulderR: Q(38, 0, -12),
      elbowL: Q(-62 + Math.sin(J * Math.PI * 10) * 12),
      elbowR: Q(-66 - Math.sin(J * Math.PI * 10) * 10),
      neck: Q(16, 0, 0),
      spine: Q(7, 0, 0),
    };
  if ($ === "read")
    return { shoulderL: Q(28, 0, 15), shoulderR: Q(28, 0, -15), elbowL: Q(-72), elbowR: Q(-72), neck: Q(14, 0, 0) };
  if ($ === "write")
    return {
      shoulderL: Q(28, 0, 10),
      shoulderR: Q(42, 0, -8),
      elbowL: Q(-62),
      elbowR: Q(-72 + Math.sin(J * Math.PI * 9) * 8),
      neck: Q(15, 0, 0),
    };
  if ($ === "speak")
    return {
      shoulderR: Q(0, 0, -18 + Math.sin(J * Math.PI * 4) * 10),
      elbowR: Q(0, 0, -28),
      neck: Q(0, Math.sin(J * Math.PI * 3) * 3, 0),
    };
  if ($ === "nod") return { neck: Q(Math.sin(J * Math.PI * 4) * 16, 0, 0) };
  if ($ === "shake-head") return { neck: Q(0, Math.sin(J * Math.PI * 4) * 24, 0) };
  if ($ === "look-up") return { neck: Q(-22, 0, 0) };
  if ($ === "look-down") return { neck: Q(22, 0, 0) };
  if ($ === "look-at") return { neck: Q(0, Math.sin(J * Math.PI) * 16, 0), spine: Q(0, Math.sin(J * Math.PI) * 5, 0) };
  if ($ === "reach") return { shoulderR: Q(72, 0, -6), elbowR: Q(-18, 0, 0), spine: Q(8, 0, 0) };
  if ($ === "hold") return { shoulderL: Q(32, 0, 16), shoulderR: Q(32, 0, -16), elbowL: Q(-76), elbowR: Q(-76) };
  if ($ === "idle-breathe")
    return {
      spine: Q(Math.sin(J * Math.PI * 4) * 1.8),
      shoulderL: Q(Math.sin(J * Math.PI * 4) * 1.2),
      shoulderR: Q(Math.sin(J * Math.PI * 4) * 1.2),
    };
  if ($ === "listen") return { neck: Q(0, 8, 3), spine: Q(2, 4, 0) };
  if ($ === "hesitate") return { neck: Q(8, Math.sin(J * Math.PI) * 10, 0), shoulderR: Q(18, 0, -10), elbowR: Q(-45) };
  if ($ === "bow") return { spine: Q(Math.sin(J * Math.PI) * 38), neck: Q(Math.sin(J * Math.PI) * 12) };
  if ($ === "cross-arms") return oQ("armscross")?.joints ?? {};
  if ($ === "hands-on-hips")
    return { shoulderL: Q(15, 0, 38), shoulderR: Q(15, 0, -38), elbowL: Q(-95), elbowR: Q(-95) };
  if ($ === "clap") {
    let K = Math.abs(Math.sin(J * Math.PI * 8));
    return { shoulderL: Q(55, 0, 18 + K * 20), shoulderR: Q(55, 0, -18 - K * 20), elbowL: Q(-65), elbowR: Q(-65) };
  }
  if ($ === "drink") return { shoulderR: Q(115, 0, -8), elbowR: Q(-115), neck: Q(-8) };
  if ($ === "phone") return { shoulderR: Q(45, 0, -25), elbowR: Q(-125), neck: Q(0, 8, 0) };
  if ($ === "hand-over" || $ === "receive") return { shoulderR: Q(72, 0, -5), elbowR: Q(-28), spine: Q(5) };
  if ($ === "step-back" || $ === "step-forward")
    return {
      hipL: Q(X * 22 * Y),
      hipR: Q(-X * 22 * Y),
      kneeL: Q(Math.max(0, -X) * 35 * Y),
      kneeR: Q(Math.max(0, X) * 35 * Y),
      shoulderL: Q(-X * 12 * Y),
      shoulderR: Q(X * 12 * Y),
    };
  if ($ === "glance") return { neck: Q(0, Math.sin(J * Math.PI) * 30, 0) };
  if ($ === "inspect")
    return { neck: Q(18, Math.sin(J * Math.PI * 2) * 7, 0), spine: Q(8), shoulderL: Q(22), shoulderR: Q(22) };
  if ($ === "knock") return { shoulderR: Q(70, 0, -8), elbowR: Q(-60 + Math.sin(J * Math.PI * 8) * 24) };
  let D = Bz($),
    H = oQ(D)?.joints ?? {},
    G = $ === "sit" || $ === "kneel" || $ === "lie-down" || $ === "fall" ? T9(J) : 1;
  return Object.fromEntries(Object.entries(H).map(([K, O]) => [K, { x: O.x * G, y: O.y * G, z: O.z * G }]));
}
function wz($, J, U, Q = 1, W) {
  let X = (Q ?? 1) * (W ? fR(W).amplitude : 1),
    Y = pl($, J, U);
  return X === 1 ? Y : zz(Y, X);
}
function Ez($, J, U) {
  let Q = yR(J.keyframes ?? [], Math.max(0, U - J.startSec));
  if (Q) {
    let { left: H, right: G, progress: K } = Q,
      O = H.position && G.position ? qz(H, G, K, $.position) : (H.position ?? $.position),
      N = H.rotationDeg && G.rotationDeg ? p8(H.rotationDeg, G.rotationDeg, K) : (H.rotationDeg ?? $.rotationDeg);
    return {
      ...$,
      position: O,
      rotationDeg: N,
      ...($.kind === "mannequin"
        ? { poseId: J.templateId ?? Bz(J.action), joints: zz(ml(H.joints, G.joints, K), $.motionScale ?? 1) }
        : {}),
    };
  }
  let W = Lz((U - J.startSec) / Math.max(0.01, J.durationSec)),
    X = T9(W),
    Y = v5.has(J.action) || J.from.x !== J.to.x || J.from.z !== J.to.z,
    D = (Math.atan2(J.to.x - J.from.x, J.to.z - J.from.z) * 180) / Math.PI;
  return {
    ...$,
    position: Y ? p8(J.from, J.to, X) : $.position,
    rotationDeg:
      J.fromRotationDeg && J.toRotationDeg
        ? p8(J.fromRotationDeg, J.toRotationDeg, X)
        : Y && Math.hypot(J.to.x - J.from.x, J.to.z - J.from.z) > 0.05
          ? { ...$.rotationDeg, y: D }
          : $.rotationDeg,
    ...($.kind === "mannequin"
      ? { poseId: Bz(J.action), joints: zz(wz(J.action, W, J.durationSec, J.intensity, J.emotion), $.motionScale ?? 1) }
      : {}),
  };
}
function dl($, J, U) {
  let Q = [...$.shots].sort((N, F) => N.startSec - F.startSec),
    W = Q.findIndex((N) => N.id === U),
    X = J.position,
    Y = J.rotationDeg;
  if (W < 0) return { position: { ...X }, rotationDeg: { ...Y } };
  let D = (N) => !!N && (N.position.x !== X.x || N.position.y !== X.y || N.position.z !== X.z),
    H = (N) => !!N && (N.rotationDeg.x !== Y.x || N.rotationDeg.y !== Y.y || N.rotationDeg.z !== Y.z),
    G = { ...X },
    K = { ...Y };
  for (let N = 0; N < W; N++) {
    let F = Q[N].elementStates[J.id],
      B = N === 0 ? (F ? { ...F.position } : { ...X }) : D(F) ? { ...F.position } : G,
      E = N === 0 ? (F ? { ...F.rotationDeg } : { ...Y }) : H(F) ? { ...F.rotationDeg } : K,
      z = Q[N].actions.filter((L) => L.elementId === J.id).sort((L, V) => L.startSec - V.startSec),
      q = { ...J, position: B, rotationDeg: E };
    for (let L of z) q = Ez(q, L, L.startSec + L.durationSec);
    ((G = { ...q.position }), (K = { ...q.rotationDeg }));
  }
  let O = Q[W].elementStates[J.id];
  return { position: D(O) ? { ...O.position } : G, rotationDeg: H(O) ? { ...O.rotationDeg } : K };
}
function cl($) {
  return $.shots.reduce((J, U) => Math.max(J, U.startSec + U.durationSec), 0);
}
function nl($, J) {
  let U = Math.max(0, Math.min(J, Math.max(0, cl($) - 0.001)));
  return $.shots.find((Q) => U >= Q.startSec && U < Q.startSec + Q.durationSec) ?? $.shots[$.shots.length - 1];
}
function Iz($, J, U) {
  let Q = nl($, U);
  if (!Q) return null;
  let W = Math.max(0, Math.min(Q.durationSec, U - Q.startSec)),
    X = T9(W / Math.max(0.01, Q.durationSec)),
    Y = yR(Q.cameraKeyframes ?? [], W),
    D = Y
      ? {
          position: p8(Y.left.position, Y.right.position, Y.progress),
          target: p8(Y.left.target, Y.right.target, Y.progress),
          fov: j9(Y.left.fov, Y.right.fov, Y.progress),
          rollDeg: j9(Y.left.rollDeg ?? 0, Y.right.rollDeg ?? Y.left.rollDeg ?? 0, Y.progress),
        }
      : {
          position: p8(Q.position, Q.cameraEnd.position, X),
          target: p8(Q.target, Q.cameraEnd.target, X),
          fov: j9(Q.fov, Q.cameraEnd.fov, X),
          rollDeg: j9(Q.rollDeg ?? 0, Q.cameraEnd.rollDeg ?? Q.rollDeg ?? 0, X),
        };
  if (Q.cameraMove === "handheld" || Q.cameraMove === "handheld-intense") {
    let G = Q.cameraMove === "handheld-intense" ? 0.085 : 0.025,
      K = Math.sin(U * 13.7) * G;
    D.position = { ...D.position, x: D.position.x + K, y: D.position.y + Math.cos(U * 11.1) * G * 0.72 };
  }
  let H = J.map((G) => {
    let K = Q.elementStates[G.id],
      O = dl($, G, Q.id),
      N = K ? { ...G, position: O.position, rotationDeg: O.rotationDeg, scale: { ...K.scale }, visible: K.visible } : G,
      F = Q.actions.filter((B) => B.elementId === G.id && W >= B.startSec).sort((B, E) => B.startSec - E.startSec);
    for (let B of F)
      if (W <= B.startSec + B.durationSec) N = Ez(N, B, W);
      else N = Ez(N, B, B.startSec + B.durationSec);
    return N;
  });
  return { shot: Q, localTimeSec: W, camera: D, elements: H };
}
function xR($, J) {
  let U = [];
  if ($.shots.length === 0)
    return [
      { id: "no-shots", severity: "error", shotId: "", message: "\u65B9\u6848\u91CC\u8FD8\u6CA1\u6709\u955C\u5934" },
    ];
  for (let [Q, W] of $.shots.entries()) {
    if (W.durationSec < 0.25)
      U.push({
        id: `${W.id}-duration`,
        severity: "error",
        shotId: W.id,
        message: `${W.name} \u65F6\u957F\u8FC7\u77ED`,
      });
    if (W.position.y < 0.05 || W.cameraEnd.position.y < 0.05)
      U.push({
        id: `${W.id}-ground`,
        severity: "error",
        shotId: W.id,
        message: `${W.name} \u6444\u5F71\u673A\u8FDB\u5165\u5730\u9762`,
      });
    let X = J.filter((H) => W.elementStates[H.id]?.visible !== !1);
    if (X.length === 0)
      U.push({
        id: `${W.id}-empty`,
        severity: "warning",
        shotId: W.id,
        message: `${W.name} \u6CA1\u6709\u53EF\u89C1\u4E3B\u4F53`,
      });
    let Y = X.map((H) => ({ element: H, position: W.elementStates[H.id]?.position ?? H.position }));
    for (let { element: H, position: G } of Y)
      if (Math.hypot(W.position.x - G.x, W.position.y - G.y, W.position.z - G.z) < 0.65)
        U.push({
          id: `${W.id}-${H.id}-camera-collision`,
          severity: "error",
          shotId: W.id,
          message: `${W.name} \u7684\u6444\u5F71\u673A\u4E0E\u300C${H.name}\u300D\u53D1\u751F\u78B0\u649E`,
        });
    for (let H = 0; H < Y.length; H += 1)
      for (let G = H + 1; G < Y.length; G += 1) {
        let K = Y[H],
          O = Y[G];
        if (Math.hypot(K.position.x - O.position.x, K.position.z - O.position.z) < 0.42)
          U.push({
            id: `${W.id}-${K.element.id}-${O.element.id}-overlap`,
            severity: "warning",
            shotId: W.id,
            message: `${W.name} \u7684\u300C${K.element.name}\u300D\u4E0E\u300C${O.element.name}\u300D\u4F4D\u7F6E\u91CD\u53E0`,
          });
      }
    let D = $.shots[Q - 1];
    if (D) {
      let H = { x: D.position.x - D.target.x, z: D.position.z - D.target.z },
        G = { x: W.position.x - W.target.x, z: W.position.z - W.target.z },
        K = Math.hypot(H.x, H.z),
        O = Math.hypot(G.x, G.z);
      if ((K > 0.01 && O > 0.01 ? (H.x * G.x + H.z * G.z) / (K * O) : 1) < -0.45)
        U.push({
          id: `${W.id}-axis`,
          severity: "warning",
          shotId: W.id,
          message: `${D.name} \u5230 ${W.name} \u53EF\u80FD\u53D1\u751F\u8D8A\u8F74\uFF0C\u8BF7\u68C0\u67E5\u4EBA\u7269\u671D\u5411`,
        });
    }
    for (let H of W.actions) {
      if (H.startSec < 0 || H.startSec + H.durationSec > W.durationSec + 0.01)
        U.push({
          id: `${W.id}-${H.id}-range`,
          severity: "warning",
          shotId: W.id,
          message: `${W.name} \u7684\u52A8\u4F5C\u8D85\u51FA\u955C\u5934\u65F6\u957F`,
        });
      let G = Math.hypot(H.to.x - H.from.x, H.to.z - H.from.z);
      if (G / Math.max(H.durationSec, 0.01) > 6)
        U.push({
          id: `${W.id}-${H.id}-speed`,
          severity: "warning",
          shotId: W.id,
          message: `${W.name} \u7684\u4EBA\u7269\u79FB\u52A8\u901F\u5EA6\u5F02\u5E38`,
        });
      if (v5.has(H.action) && G < 0.15)
        U.push({
          id: `${W.id}-${H.id}-no-path`,
          severity: "warning",
          shotId: W.id,
          message: `${W.name} \u7684\u300C${H.action}\u300D\u6CA1\u6709\u8BBE\u7F6E\u79FB\u52A8\u8DEF\u5F84`,
        });
      if (H.from.y < 0 || H.to.y < 0)
        U.push({
          id: `${W.id}-${H.id}-underground`,
          severity: "error",
          shotId: W.id,
          message: `${W.name} \u7684\u52A8\u4F5C\u8DEF\u5F84\u8FDB\u5165\u5730\u9762`,
        });
      for (let O of H.keyframes ?? [])
        if (O.timeSec < 0 || O.timeSec > H.durationSec + 0.01)
          U.push({
            id: `${W.id}-${H.id}-${O.id}-keyframe-range`,
            severity: "warning",
            shotId: W.id,
            message: `${W.name} \u7684\u4EBA\u7269\u5173\u952E\u5E27\u8D85\u51FA\u52A8\u4F5C\u65F6\u957F`,
          });
    }
    for (let H of W.cameraKeyframes ?? []) {
      if (H.timeSec < 0 || H.timeSec > W.durationSec + 0.01)
        U.push({
          id: `${W.id}-${H.id}-camera-keyframe-range`,
          severity: "warning",
          shotId: W.id,
          message: `${W.name} \u7684\u6444\u5F71\u673A\u5173\u952E\u5E27\u8D85\u51FA\u955C\u5934\u65F6\u957F`,
        });
      if (H.position.y < 0.05)
        U.push({
          id: `${W.id}-${H.id}-camera-keyframe-ground`,
          severity: "error",
          shotId: W.id,
          message: `${W.name} \u7684\u6444\u5F71\u673A\u5173\u952E\u5E27\u8FDB\u5165\u5730\u9762`,
        });
    }
    for (let H of J) {
      let G = W.actions.filter((K) => K.elementId === H.id).sort((K, O) => K.startSec - O.startSec);
      for (let K = 1; K < G.length; K += 1) {
        let O = G[K - 1],
          N = G[K];
        if (N.startSec < O.startSec + O.durationSec - 0.05)
          U.push({
            id: `${W.id}-${H.id}-${N.id}-overlap`,
            severity: "error",
            shotId: W.id,
            message: `${W.name} \u7684\u300C${H.name}\u300D\u52A8\u4F5C\u65F6\u95F4\u53D1\u751F\u91CD\u53E0`,
          });
        if (Math.hypot(N.from.x - O.to.x, N.from.z - O.to.z) > 0.8)
          U.push({
            id: `${W.id}-${H.id}-${N.id}-jump`,
            severity: "warning",
            shotId: W.id,
            message: `${W.name} \u7684\u300C${H.name}\u300D\u52A8\u4F5C\u4E4B\u95F4\u53D1\u751F\u4F4D\u7F6E\u8DF3\u53D8`,
          });
      }
    }
  }
  return U;
}
function gR($, J) {
  return (Math.atan2(J.x - $.x, J.z - $.z) * 180) / Math.PI;
}
function Vz($, J, U) {
  switch ($) {
    case "toward-target":
    case "face-each-other":
      return gR(J, U.position);
    case "away-from-target":
      return gR(J, U.position) + 180;
    case "same-as-target":
      return U.rotationDeg.y;
    case "keep":
    default:
      return;
  }
}
function il($, J, U) {
  let Q = $.x - J.x,
    W = $.z - J.z,
    X = Math.hypot(Q, W) || 1;
  return { x: J.x + (Q / X) * U, y: J.y, z: J.z + (W / X) * U };
}
function hR($) {
  let { element: J, target: U, facing: Q, proximityM: W } = $,
    X = $.from ? { ...$.from } : { ...J.position },
    Y = $.to ? { ...$.to } : { ...X };
  if (U && W !== void 0 && !$.to) Y = il(X, U.position, W);
  let D = U && Q ? Vz(Q, X, U) : void 0;
  return { from: X, to: Y, facingYaw: D };
}
var d8 = ($, J) =>
    J.map(([U, Q, W, X, Y, D]) => ({
      id: U,
      label: Q,
      category: $,
      description: W,
      defaultDurationSec: X,
      moving: Y,
      suggestedDistance: D,
    })),
  b5 = [
    ...d8("\u57FA\u7840", [
      ["stand", "\u7AD9\u7ACB", "\u7A33\u5B9A\u7AD9\u59FF", 2],
      ["wait", "\u7B49\u5F85", "\u5E26\u8F7B\u5FAE\u547C\u5438\u7684\u7B49\u5F85", 2],
      ["idle-breathe", "\u81EA\u7136\u547C\u5438", "\u514B\u5236\u7684\u5F85\u673A\u547C\u5438", 3],
      ["stop", "\u505C\u6B65", "\u4ECE\u8FD0\u52A8\u4E2D\u6536\u4F4F\u91CD\u5FC3", 0.8],
      ["turn", "\u8F6C\u8EAB", "\u8EAB\u4F53\u4E0E\u89C6\u7EBF\u5171\u540C\u8F6C\u5411", 1.2],
    ]),
    ...d8("\u8D70\u4F4D", [
      ["walk", "\u884C\u8D70", "\u81EA\u7136\u6B65\u901F\u8D70\u4F4D", 2.5, !0, 2],
      ["fast-walk", "\u5FEB\u8D70", "\u76EE\u7684\u660E\u786E\u7684\u5FEB\u6B65", 2, !0, 2.6],
      ["run", "\u8DD1\u52A8", "\u5FEB\u901F\u8DD1\u52A8", 1.8, !0, 3.2],
      ["step-forward", "\u5411\u524D\u4E00\u6B65", "\u5C0F\u8303\u56F4\u9760\u8FD1", 1, !0, 0.7],
      ["step-back", "\u540E\u9000\u4E00\u6B65", "\u8B66\u60D5\u6216\u8BA9\u4F4D", 1, !0, -0.7],
      ["follow", "\u8DDF\u968F", "\u8DDF\u968F\u53E6\u4E00\u4EBA\u7269\u7684\u7A7A\u95F4\u8282\u594F", 2.5, !0, 2],
      ["pass-by", "\u64E6\u80A9\u800C\u8FC7", "\u4ECE\u53E6\u4E00\u4EBA\u7269\u8EAB\u4FA7\u901A\u8FC7", 2.2, !0, 2.4],
      ["dodge", "\u95EA\u907F", "\u5FEB\u901F\u4FA7\u5411\u8EB2\u907F", 0.9, !0, 1.2],
    ]),
    ...d8("\u89C6\u7EBF", [
      ["look-up", "\u62AC\u773C", "\u7531\u4F4E\u5904\u62AC\u8D77\u89C6\u7EBF", 0.9],
      ["look-down", "\u4F4E\u5934", "\u89C6\u7EBF\u548C\u5934\u90E8\u5411\u4E0B", 0.9],
      ["look-at", "\u6CE8\u89C6", "\u7A33\u5B9A\u770B\u5411\u76EE\u6807", 1.2],
      ["look-back", "\u56DE\u671B", "\u5934\u80A9\u5148\u540E\u56DE\u8F6C", 1.1],
      ["glance", "\u5FEB\u901F\u4E00\u77A5", "\u77ED\u4FC3\u770B\u5411\u4FA7\u65B9\u540E\u6536\u56DE", 0.7],
      ["inspect", "\u4ED4\u7EC6\u89C2\u5BDF", "\u5C0F\u5E45\u626B\u89C6\u76EE\u6807\u7EC6\u8282", 1.8],
    ]),
    ...d8("\u4EA4\u6D41", [
      ["speak", "\u8BF4\u8BDD", "\u514B\u5236\u7684\u53E3\u5934\u8868\u8FBE\u624B\u52BF", 2],
      ["listen", "\u503E\u542C", "\u8EAB\u4F53\u5FAE\u5411\u8BF4\u8BDD\u8005\u5F00\u653E", 2],
      ["nod", "\u70B9\u5934", "\u786E\u8BA4\u5F0F\u70B9\u5934", 0.8],
      ["shake-head", "\u6447\u5934", "\u5426\u5B9A\u5F0F\u6447\u5934", 0.9],
      ["face-to-face", "\u9762\u5BF9\u9762", "\u5EFA\u7ACB\u53CC\u4EBA\u4EA4\u6D41\u671D\u5411", 1.2],
      ["hand-over", "\u9012\u4EA4", "\u5C06\u624B\u4E2D\u7269\u9012\u5411\u76EE\u6807", 1.2],
      ["receive", "\u63A5\u53D6", "\u4F38\u624B\u63A5\u8FC7\u7269\u54C1", 1.2],
    ]),
    ...d8("\u624B\u90E8", [
      ["reach", "\u4F38\u624B", "\u624B\u81C2\u4F38\u5411\u76EE\u6807", 1],
      ["hold", "\u6258\u6301", "\u53CC\u624B\u7A33\u5B9A\u6258\u4F4F\u7269\u4F53", 1.4],
      ["pick-up", "\u62FF\u8D77", "\u4FEF\u8EAB\u6216\u4F38\u624B\u62FF\u8D77\u7269\u4F53", 1.3],
      ["put-down", "\u653E\u4E0B", "\u5C06\u7269\u4F53\u7A33\u5B9A\u653E\u4E0B", 1.3],
      ["point", "\u6307\u5411", "\u660E\u786E\u6307\u5411\u76EE\u6807", 1],
      ["wave", "\u6325\u624B", "\u62DB\u547C\u5F0F\u6325\u624B", 1.2],
      ["raise-hand", "\u62AC\u624B", "\u62AC\u8D77\u4E00\u53EA\u624B", 0.8],
      ["clap", "\u9F13\u638C", "\u8FDE\u7EED\u4E24\u5230\u4E09\u6B21\u9F13\u638C", 1.4],
      ["knock", "\u6572\u51FB", "\u624B\u90E8\u8FDE\u7EED\u6572\u51FB", 1.1],
      ["phone", "\u63A5\u542C\u7535\u8BDD", "\u62AC\u624B\u8D34\u8FD1\u8033\u4FA7", 1.5],
      ["drink", "\u996E\u7528", "\u62AC\u624B\u996E\u7528\u540E\u653E\u56DE", 1.8],
    ]),
    ...d8("\u59FF\u6001", [
      ["sit", "\u5750\u4E0B", "\u91CD\u5FC3\u540E\u79FB\u5750\u4E0B", 1.5],
      ["stand-up", "\u8D77\u8EAB", "\u4ECE\u5750\u59FF\u6062\u590D\u7AD9\u7ACB", 1.5],
      ["crouch", "\u8E72\u4E0B", "\u964D\u4F4E\u91CD\u5FC3\u89C2\u5BDF", 1.2],
      ["kneel", "\u8DEA\u4E0B", "\u5355\u819D\u843D\u5730", 1.4],
      ["lie-down", "\u8EBA\u4E0B", "\u8EAB\u4F53\u843D\u5411\u5730\u9762", 1.8],
      ["bow", "\u97A0\u8EAC", "\u4E0A\u8EAB\u524D\u503E\u540E\u6062\u590D", 1.3],
      ["cross-arms", "\u62B1\u81C2", "\u53CC\u81C2\u6536\u4E8E\u80F8\u524D", 1.2],
      ["hands-on-hips", "\u53C9\u8170", "\u53CC\u624B\u843D\u4E8E\u8170\u4FA7", 1.2],
    ]),
    ...d8("\u60C5\u7EEA", [
      ["hesitate", "\u8FDF\u7591", "\u6B32\u8A00\u53C8\u6B62\u7684\u5C0F\u52A8\u4F5C", 1.5],
      ["hug", "\u62E5\u62B1", "\u5411\u76EE\u6807\u5F20\u81C2\u9760\u8FD1", 1.8],
      ["fall", "\u8DCC\u5012", "\u5931\u53BB\u91CD\u5FC3\u5012\u5730", 1.2],
      ["get-up", "\u722C\u8D77", "\u4ECE\u5730\u9762\u6062\u590D\u7AD9\u7ACB", 1.8],
    ]),
    ...d8("\u4E13\u9879", [
      ["read", "\u9605\u8BFB", "\u53CC\u624B\u6301\u5377\u6216\u4E66\u9605\u8BFB", 2],
      ["write", "\u4E66\u5199", "\u4E00\u624B\u6276\u6301\u4E00\u624B\u843D\u7B14", 2],
      ["sew", "\u7F1D\u7EAB", "\u4F4E\u5934\u53CC\u624B\u8FDE\u7EED\u8D70\u9488", 2],
      ["open-door", "\u5F00\u95E8", "\u4F38\u624B\u5E76\u62C9\u5F00\u95E8", 1.5],
      ["close-door", "\u5173\u95E8", "\u8F6C\u8EAB\u5C06\u95E8\u5408\u4E0A", 1.4],
      ["push", "\u63A8\u7269", "\u53CC\u624B\u5411\u524D\u65BD\u529B", 1.5],
      ["pull", "\u62C9\u7269", "\u91CD\u5FC3\u540E\u79FB\u62C9\u52A8\u7269\u4F53", 1.5],
      ["enter-car", "\u8FDB\u5165\u8F66\u8F86", "\u9760\u8FD1\u5E76\u8FDB\u5165\u8F66\u8F86", 2.2, !0, 1.5],
      ["exit-car", "\u79BB\u5F00\u8F66\u8F86", "\u4ECE\u8F66\u8F86\u4E2D\u51FA\u6765\u5E76\u7AD9\u7A33", 2.2, !0, 1.5],
    ]),
  ];
function uR($) {
  return (
    b5.find((J) => J.id === $) ?? {
      id: $,
      label: $,
      category: "\u57FA\u7840",
      description: "\u57FA\u7840\u52A8\u4F5C",
      defaultDurationSec: 1.5,
    }
  );
}
function ol($, J, U) {
  return { x: $.x + (J.x - $.x) * U, y: $.y + (J.y - $.y) * U, z: $.z + (J.z - $.z) * U };
}
function lR($, J, U, Q, W = "template", X, Y = 1, D) {
  let G = Math.hypot(Q.x - U.x, Q.z - U.z) > 0.05 ? (Math.atan2(Q.x - U.x, Q.z - U.z) * 180) / Math.PI : void 0,
    K = X !== void 0 ? X : G,
    O = v5.has($),
    N,
    F;
  if (O) {
    let E = Math.max(
      6,
      Math.min(47, Math.ceil(J * ($ === "run" || $ === "dodge" ? 2.3 : $ === "fast-walk" ? 1.8 : 1.35) * 4)),
    );
    ((N = Array.from({ length: E + 1 }, (z, q) => q / E)),
      (F = (z) => (z === 0 ? "ease-in" : z === N.length - 2 ? "ease-out" : "linear")));
  } else ((N = [0, 0.18, 0.5, 0.82, 1]), (F = (B) => (B === 0 || B === N.length - 1 ? "ease-out" : "smooth")));
  return N.map((B, E) => ({
    id: `kf-${O1(7)}`,
    timeSec: Number((J * B).toFixed(3)),
    position: ol(U, Q, B),
    rotationDeg: K === void 0 ? void 0 : { x: 0, y: K, z: 0 },
    joints: wz($, B, J, Y, D),
    interpolation: F(E),
    source: W,
    note:
      E === 0
        ? "\u8D77\u52BF"
        : E === N.length - 1
          ? "\u6536\u52BF"
          : O
            ? void 0
            : E === 2
              ? "\u52A8\u4F5C\u5CF0\u503C"
              : void 0,
  }));
}
var mR = ["#6ea8fe", "#f28b82", "#81c995", "#c58af9", "#f6c85f", "#78d9ec", "#ff9e64", "#b6a0ff"];
function kz($) {
  return mR[Math.abs($) % mR.length];
}
var Az = [
    { id: "person", label: "\u6807\u51C6\u4EBA\u7269", description: "\u6210\u5E74\u4EBA\u767D\u6A21", kind: "person" },
    {
      id: "tall-person",
      label: "\u9AD8\u4E2A\u4EBA\u7269",
      description: "\u8F83\u9AD8\u4F53\u578B\uFF0C\u7528\u4E8E\u5F62\u6210\u8EAB\u9AD8\u5DEE",
      kind: "person",
    },
    {
      id: "child",
      label: "\u513F\u7AE5\u4EBA\u7269",
      description: "\u8F83\u77EE\u7684\u4EBA\u7269\u6BD4\u4F8B",
      kind: "person",
    },
    {
      id: "quadruped",
      label: "\u56DB\u8DB3\u52A8\u7269",
      description: "\u4E2D\u578B\u52A8\u7269\u8D70\u4F4D\u767D\u6A21",
      kind: "animal",
    },
    {
      id: "small-animal",
      label: "\u5C0F\u578B\u52A8\u7269",
      description: "\u5C0F\u578B\u52A8\u7269\u8D70\u4F4D\u767D\u6A21",
      kind: "animal",
    },
    { id: "crowd-3", label: "\u5C0F\u578B\u7FA4\u4F17", description: "3 x 3 \u7FA4\u4F17\u9635\u5217", kind: "crowd" },
    { id: "crowd-5", label: "\u5927\u578B\u7FA4\u4F17", description: "4 x 5 \u7FA4\u4F17\u9635\u5217", kind: "crowd" },
  ],
  Mz = [
    { id: "table", label: "\u957F\u684C", kind: "box", scale: { x: 1.8, y: 0.75, z: 0.9 }, y: 0.375 },
    { id: "round-table", label: "\u5706\u684C", kind: "cylinder", scale: { x: 1.25, y: 0.75, z: 1.25 }, y: 0.375 },
    { id: "chair", label: "\u6905\u5B50", kind: "box", scale: { x: 0.55, y: 0.48, z: 0.55 }, y: 0.24 },
    { id: "sofa", label: "\u6C99\u53D1", kind: "box", scale: { x: 2.1, y: 0.75, z: 0.9 }, y: 0.375 },
    { id: "door", label: "\u95E8", kind: "wall", scale: { x: 0.85, y: 1, z: 1 }, y: 1.2 },
    { id: "wall", label: "\u5899\u4F53", kind: "wall", scale: { x: 2.5, y: 2, z: 0.15 }, y: 1.2 },
    { id: "column", label: "\u7ACB\u67F1", kind: "cylinder", scale: { x: 0.55, y: 2.4, z: 0.55 }, y: 1.2 },
    { id: "car", label: "\u8F66\u8F86", kind: "box", scale: { x: 2.2, y: 1.3, z: 4 }, y: 0.65 },
    { id: "screen", label: "\u5C4F\u5E55", kind: "box", scale: { x: 2.2, y: 1.3, z: 0.12 }, y: 1.3 },
    { id: "crate", label: "\u7BB1\u5B50", kind: "box", scale: { x: 0.8, y: 0.8, z: 0.8 }, y: 0.4 },
  ];
function pR($, J) {
  let U = Az.find((W) => W.id === $);
  if (U) {
    if (U.kind === "crowd") {
      let X = U.id === "crowd-5";
      return {
        id: l0("el"),
        kind: "crowd",
        name: `Crowd ${J + 1}`,
        position: { x: 0, y: 0, z: 0 },
        rotationDeg: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        color: kz(J),
        visible: !0,
        groupId: null,
        rows: X ? 4 : 3,
        cols: X ? 5 : 3,
        spacing: 0.8,
        poseId: "stand",
      };
    }
    let W = q1(J);
    if (W.kind !== "mannequin") return W;
    return (
      (W.bodyType = U.kind === "animal" ? "animal" : "person"),
      (W.animalSpecies = U.kind === "animal" ? (U.id === "small-animal" ? "small" : "quadruped") : void 0),
      (W.heightM =
        U.id === "tall-person"
          ? 1.9
          : U.id === "child"
            ? 1.25
            : U.id === "small-animal"
              ? 0.55
              : U.id === "quadruped"
                ? 1.05
                : 1.72),
      (W.name = U.kind === "animal" ? `Animal ${J + 1}` : `Actor ${J + 1}`),
      (W.color = kz(J)),
      W
    );
  }
  let Q = Mz.find((W) => W.id === $);
  if (!Q) throw Error(`Unknown element preset: ${$}`);
  return {
    id: l0("el"),
    kind: Q.kind,
    name: `Prop ${J + 1}`,
    position: { x: 0, y: Q.y, z: 0 },
    rotationDeg: { x: 0, y: 0, z: 0 },
    scale: { ...Q.scale },
    color: "#b7bcc5",
    visible: !0,
    groupId: null,
  };
}
