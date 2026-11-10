import { mkdir as ti, readFile as ei, rename as $o, writeFile as Jo } from "fs/promises";
import { homedir as Uo } from "os";
import { dirname as Wo, join as dE } from "path";
var R_ = 50;
function G8($) {
  return structuredClone($);
}
async function Z_($) {
  try {
    return JSON.parse(await ei($, "utf8"));
  } catch (J) {
    if (J.code === "ENOENT") return null;
    throw J;
  }
}
async function qU($, J) {
  await ti(Wo($), { recursive: !0 });
  let U = `${$}.${process.pid}.tmp`;
  (await Jo(
    U,
    `${JSON.stringify(J, null, 2)}
`,
    "utf8",
  ),
    await $o(U, $));
}
class cE {
  root;
  projectPath;
  historyPath;
  constructor($ = process.env.PREVIZ_ENGINE_HOME || dE(Uo(), ".previs-engine")) {
    ((this.root = $), (this.projectPath = dE($, "project.json")), (this.historyPath = dE($, "history.json")));
  }
  async get() {
    let $ = await Z_(this.projectPath);
    if (!$) {
      let U = Oz();
      return (await qU(this.projectPath, U), G8(U));
    }
    let J = iQ($);
    if (J.some((U) => U.startsWith("Unsupported project version"))) throw Error(`Cannot open project: ${J.join("; ")}`);
    return G8($);
  }
  async replace($) {
    let J = { ...G8($), updatedAt: Date.now() };
    return (await qU(this.projectPath, J), G8(J));
  }
  async mutate($, J, U = !0) {
    let Q = await this.get(),
      W = G8(Q);
    (J(W), (W.updatedAt = Date.now()));
    let Y = iQ(W).filter((D) => D.startsWith("Unsupported project version") || D.includes("Duplicate element id"));
    if (Y.length) throw Error(`Project mutation rejected: ${Y.join("; ")}`);
    if (U) {
      let D = await this.readHistory();
      (D.past.push({ label: $, project: Q, createdAt: Date.now() }),
        (D.past = D.past.slice(-R_)),
        (D.future = []),
        await Promise.all([qU(this.projectPath, W), qU(this.historyPath, D)]));
    } else await qU(this.projectPath, W);
    return G8(W);
  }
  async reset($) {
    let J = await this.get(),
      U = Oz($),
      Q = await this.readHistory();
    return (
      Q.past.push({ label: "Create project", project: J, createdAt: Date.now() }),
      (Q.past = Q.past.slice(-R_)),
      (Q.future = []),
      await Promise.all([qU(this.projectPath, U), qU(this.historyPath, Q)]),
      G8(U)
    );
  }
  async undo() {
    let $ = await this.get(),
      J = await this.readHistory(),
      U = J.past.pop();
    if (!U) return null;
    return (
      J.future.push({ label: U.label, project: $, createdAt: Date.now() }),
      await Promise.all([qU(this.projectPath, U.project), qU(this.historyPath, J)]),
      { project: G8(U.project), label: U.label }
    );
  }
  async redo() {
    let $ = await this.get(),
      J = await this.readHistory(),
      U = J.future.pop();
    if (!U) return null;
    return (
      J.past.push({ label: U.label, project: $, createdAt: Date.now() }),
      await Promise.all([qU(this.projectPath, U.project), qU(this.historyPath, J)]),
      { project: G8(U.project), label: U.label }
    );
  }
  async readHistory() {
    return (await Z_(this.historyPath)) ?? { past: [], future: [] };
  }
}
function nE($) {
  return $ && typeof $ === "object" && !Array.isArray($) ? $ : {};
}
function zU($, J) {
  if (typeof $ !== "string" || !$.trim()) throw Error(`${J} is required`);
  return $.trim();
}
function e$($) {
  return typeof $ === "string" && $.trim() ? $.trim() : void 0;
}
function FJ($, J, U) {
  if ($ === void 0 && U !== void 0) return U;
  if (typeof $ !== "number" || !Number.isFinite($)) throw Error(`${J} must be a finite number`);
  return $;
}
function BU($, J = !1) {
  return typeof $ === "boolean" ? $ : J;
}
function ZJ($, J) {
  let U = nE($);
  return { x: FJ(U.x, `${J}.x`), y: FJ(U.y, `${J}.y`), z: FJ(U.z, `${J}.z`) };
}
function r1($) {
  return Math.max(0, Math.round($)) / 24;
}
function CX($, J) {
  let U = $.elements.find((Q) => Q.id === J);
  if (!U) throw Error(`Unknown element id: ${J}`);
  return U;
}
function iJ($, J) {
  let U = z1($),
    Q = J ? U.shots.find((W) => W.id === J) : CR($);
  if (!Q) throw Error(`Unknown shot id: ${J}`);
  return Q;
}
function e9($, J, U) {
  if ($ && !J) throw Error(`${U} is manually locked. Ask the user before setting override_locked=true.`);
}
function Qo($, J, U) {
  let Q = [...$.shots].sort((H, G) => H.startSec - G.startSec),
    W = Q.findIndex((H) => H.id === U.id);
  if (W <= 0) return null;
  let X = Q[W - 1],
    D = Iz($, [J], X.startSec + X.durationSec - 0.001)?.elements.find((H) => H.id === J.id);
  return D ? { ...D.position } : null;
}
function OJ($) {
  let J = z1($),
    U = Iz(J, $.elements, $.currentFrame / 24);
  return {
    project: $,
    runtime: {
      fps: 24,
      duration_sec: Kz($),
      current_frame: $.currentFrame,
      current_time_sec: $.currentFrame / 24,
      evaluated_frame: U,
    },
    catalog: { actions: b5, cameras: Hz, actors: Az, props: Mz, performances: bR },
    health: { project_issues: iQ($), plan_issues: xR(J, $.elements) },
    agent_rules: [
      "Use the exact element, shot, action and keyframe IDs returned here.",
      "All timeline writes use integer frames at 24fps.",
      "Never override a manually locked item without explicit user confirmation.",
      "Run director_validate after a multi-step edit.",
    ],
  };
}
class iE {
  repository;
  constructor($ = new cE()) {
    this.repository = $;
  }
  async execute($, J = {}) {
    let U = nE(J);
    if ($ === "director_get_state") return OJ(await this.repository.get());
    if ($ === "director_create_project") return OJ(await this.repository.reset(e$(U.name)));
    if ($ === "director_undo") {
      let Q = await this.repository.undo();
      return Q ? { undone: Q.label, ...OJ(Q.project) } : { undone: null, message: "Nothing to undo" };
    }
    if ($ === "director_redo") {
      let Q = await this.repository.redo();
      return Q ? { redone: Q.label, ...OJ(Q.project) } : { redone: null, message: "Nothing to redo" };
    }
    if ($ === "director_validate") return OJ(await this.repository.get());
    if ($ === "director_select") return this.select(U);
    if ($ === "director_add_element") return this.addElement(U);
    if ($ === "director_update_element") return this.updateElement(U);
    if ($ === "director_apply_action") return this.applyAction(U);
    if ($ === "director_set_motion_keyframe") return this.setMotionKeyframe(U);
    if ($ === "director_apply_camera") return this.applyCamera(U);
    if ($ === "director_set_camera_keyframe") return this.setCameraKeyframe(U);
    if ($ === "director_manage_shot") return this.manageShot(U);
    if ($ === "director_set_lock") return this.setLock(U);
    if ($ === "director_delete") return this.deleteItem(U);
    throw Error(`Unknown Director command: ${$}`);
  }
  async select($) {
    let J = $.frame === void 0 ? void 0 : Math.max(0, Math.round(FJ($.frame, "frame"))),
      U = e$($.shot_id),
      Q = await this.repository.mutate(
        "Select timeline position",
        (W) => {
          if (U) {
            let X = iJ(W, U);
            ((W.activeShotId = X.id), (W.currentFrame = Math.round(X.startSec * 24)));
          }
          if (J !== void 0) W.currentFrame = J;
        },
        !1,
      );
    return OJ(Q);
  }
  async addElement($) {
    let J = e$($.kind) ?? "mannequin",
      U = e$($.preset),
      Q = await this.repository.mutate("Add stage element", (W) => {
        let X = W.elements.length,
          Y;
        if (U) Y = pR(U, X);
        else if (J === "mannequin") Y = q1(X);
        else if (J === "crowd")
          Y = {
            id: l0("el"),
            kind: "crowd",
            name: `Crowd ${X + 1}`,
            position: { x: 0, y: 0, z: 0 },
            rotationDeg: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            color: "#8fa3b8",
            visible: !0,
            groupId: null,
            rows: 3,
            cols: 4,
            spacing: 0.8,
            poseId: "stand",
          };
        else {
          if (!["box", "sphere", "cylinder", "wall"].includes(J)) throw Error(`Unsupported element kind: ${J}`);
          Y = {
            id: l0("el"),
            kind: J,
            name: `Prop ${X + 1}`,
            position: { x: 0, y: J === "wall" ? 1.5 : 0.5, z: 0 },
            rotationDeg: { x: 0, y: 0, z: 0 },
            scale: J === "wall" ? { x: 5, y: 3, z: 0.15 } : { x: 1, y: 1, z: 1 },
            color: "#b7bcc5",
            visible: !0,
            groupId: null,
          };
        }
        if (((Y.name = e$($.name) ?? Y.name), $.position)) Y.position = ZJ($.position, "position");
        if ($.rotation_deg) Y.rotationDeg = ZJ($.rotation_deg, "rotation_deg");
        if ($.scale) Y.scale = ZJ($.scale, "scale");
        if (e$($.color)) Y.color = e$($.color);
        if (Y.kind === "mannequin")
          ((Y.identitySource = e$($.identity_source) ?? Y.identitySource ?? "temporary"),
            (Y.characterId = e$($.character_id) ?? Y.characterId ?? Y.id),
            (Y.performanceProfileId = e$($.performance_profile_id) ?? Y.performanceProfileId ?? "neutral"));
        W.elements.push(Y);
        for (let D of W.plans) for (let H of D.shots) H.elementStates[Y.id] = nQ(Y);
      });
    return OJ(Q);
  }
  async updateElement($) {
    let J = zU($.element_id, "element_id"),
      U = BU($.shot_only),
      Q = await this.repository.mutate("Update stage element", (W) => {
        let X = CX(W, J),
          Y = $.position ? ZJ($.position, "position") : X.position,
          D = $.rotation_deg ? ZJ($.rotation_deg, "rotation_deg") : X.rotationDeg;
        if (e$($.target_element_id) && e$($.facing)) {
          let G = CX(W, e$($.target_element_id)),
            K = Vz(e$($.facing), Y, G);
          if (K !== void 0) D = { ...D, y: K };
        }
        let H = $.scale ? ZJ($.scale, "scale") : X.scale;
        if (U) {
          let G = iJ(W, e$($.shot_id)),
            K = G.elementStates[X.id] ?? nQ(X);
          G.elementStates[X.id] = {
            ...K,
            position: Y,
            rotationDeg: D,
            scale: H,
            visible: $.visible === void 0 ? K.visible : BU($.visible),
          };
        } else {
          if (((X.position = Y), (X.rotationDeg = D), (X.scale = H), $.visible !== void 0)) X.visible = BU($.visible);
          if (e$($.name)) X.name = e$($.name);
          if (e$($.color)) X.color = e$($.color);
          if (X.kind === "mannequin") {
            if ($.height_m !== void 0) X.heightM = Math.max(0.2, Math.min(4, FJ($.height_m, "height_m")));
            if (e$($.pose_id)) X.poseId = e$($.pose_id);
            if (e$($.performance_profile_id)) X.performanceProfileId = e$($.performance_profile_id);
          }
          for (let G of W.plans)
            for (let K of G.shots) {
              let O = K.elementStates[X.id] ?? nQ(X);
              K.elementStates[X.id] = { ...O, position: Y, rotationDeg: D, scale: H, visible: X.visible };
            }
        }
      });
    return OJ(Q);
  }
  async applyAction($) {
    let J = zU($.element_id, "element_id"),
      U = zU($.action, "action"),
      Q = uR(U);
    if (!b5.some((X) => X.id === U)) throw Error(`Unknown action template: ${U}`);
    let W = await this.repository.mutate(`Apply action ${U}`, (X) => {
      let Y = CX(X, J),
        D = iJ(X, e$($.shot_id)),
        H = e$($.target_element_id),
        G = H ? CX(X, H) : void 0,
        K = Math.max(0, Math.round(FJ($.start_frame, "start_frame", 0))),
        O = Math.max(1, Math.round(FJ($.duration_frames, "duration_frames", Q.defaultDurationSec * 24))),
        N = hR({
          element: Y,
          target: G,
          facing: e$($.facing),
          proximityM: $.proximity_m === void 0 ? void 0 : FJ($.proximity_m, "proximity_m"),
          from: $.from ? ZJ($.from, "from") : (Qo(z1(X), Y, D) ?? D.elementStates[Y.id]?.position ?? Y.position),
          to: $.to ? ZJ($.to, "to") : void 0,
        }),
        F = e$($.source) === "manual" ? "manual" : "agent",
        B = FJ($.intensity, "intensity", 1),
        E = e$($.emotion),
        z = {
          id: l0("action"),
          elementId: J,
          action: U,
          startSec: r1(K),
          durationSec: r1(O),
          from: N.from,
          to: N.to,
          templateId: U,
          intensity: B,
          emotion: E,
          locked: BU($.locked),
          source: F,
          keyframes: lR(U, r1(O), N.from, N.to, F, N.facingYaw, B, E),
        };
      (D.actions.push(z), D.actions.sort((q, L) => q.startSec - L.startSec));
    });
    return OJ(W);
  }
  async setMotionKeyframe($) {
    let J = zU($.action_id, "action_id"),
      U = BU($.override_locked),
      Q = e$($.source) === "manual",
      W = await this.repository.mutate("Set motion keyframe", (X) => {
        let D = iJ(X, e$($.shot_id)).actions.find((N) => N.id === J);
        if (!D) throw Error(`Unknown action id: ${J}`);
        e9(D.locked, U || Q, `Action ${J}`);
        let H = e$($.keyframe_id),
          G = H ? D.keyframes?.find((N) => N.id === H) : void 0;
        e9(G?.locked, U || Q, `Motion keyframe ${H}`);
        let K = Math.max(0, Math.round(FJ($.frame, "frame"))),
          O = {
            id: G?.id ?? l0("kf"),
            timeSec: r1(K),
            position: $.position ? ZJ($.position, "position") : G?.position,
            rotationDeg: $.rotation_deg ? ZJ($.rotation_deg, "rotation_deg") : G?.rotationDeg,
            joints: $.joints === void 0 ? G?.joints : nE($.joints),
            pathIn: $.path_in ? ZJ($.path_in, "path_in") : G?.pathIn,
            pathOut: $.path_out ? ZJ($.path_out, "path_out") : G?.pathOut,
            pathMode: e$($.path_mode) ?? G?.pathMode,
            interpolation: e$($.interpolation) ?? G?.interpolation ?? "smooth",
            locked: $.locked === void 0 ? G?.locked : BU($.locked),
            source: e$($.source) === "manual" ? "manual" : "agent",
            note: e$($.note) ?? G?.note,
          };
        D.keyframes = [...(D.keyframes ?? []).filter((N) => N.id !== O.id), O].sort((N, F) => N.timeSec - F.timeSec);
      });
    return OJ(W);
  }
  async applyCamera($) {
    let J = zU($.move, "move");
    if (!Hz.some((W) => W.id === J)) throw Error(`Unknown camera template: ${J}`);
    let U = BU($.override_locked),
      Q = await this.repository.mutate(`Apply camera ${J}`, (W) => {
        let X = iJ(W, e$($.shot_id));
        for (let Y of X.cameraKeyframes ?? []) e9(Y.locked, U, `Camera keyframe ${Y.id}`);
        Object.assign(X, PR(X, J));
      });
    return OJ(Q);
  }
  async setCameraKeyframe($) {
    let J = BU($.override_locked),
      U = e$($.source) === "manual",
      Q = await this.repository.mutate("Set camera keyframe", (W) => {
        let X = iJ(W, e$($.shot_id)),
          Y = e$($.keyframe_id),
          D = Y ? X.cameraKeyframes?.find((O) => O.id === Y) : void 0;
        e9(D?.locked, J || U, `Camera keyframe ${Y}`);
        let H = {
          id: D?.id ?? l0("ckf"),
          timeSec: r1(Math.max(0, Math.round(FJ($.frame, "frame")))),
          position: $.position ? ZJ($.position, "position") : (D?.position ?? X.position),
          target: $.target ? ZJ($.target, "target") : (D?.target ?? X.target),
          fov: FJ($.fov, "fov", D?.fov ?? X.fov),
          rollDeg: FJ($.roll_deg, "roll_deg", D?.rollDeg ?? 0),
          interpolation: e$($.interpolation) ?? D?.interpolation ?? "smooth",
          locked: $.locked === void 0 ? D?.locked : BU($.locked),
          source: e$($.source) === "manual" ? "manual" : "agent",
          note: e$($.note) ?? D?.note,
        };
        X.cameraKeyframes = [...(X.cameraKeyframes ?? []).filter((O) => O.id !== H.id), H].sort(
          (O, N) => O.timeSec - N.timeSec,
        );
        let G = X.cameraKeyframes[0],
          K = X.cameraKeyframes[X.cameraKeyframes.length - 1];
        Object.assign(X, {
          position: G.position,
          target: G.target,
          fov: G.fov,
          rollDeg: G.rollDeg,
          cameraEnd: { position: K.position, target: K.target, fov: K.fov, rollDeg: K.rollDeg },
        });
      });
    return OJ(Q);
  }
  async manageShot($) {
    let J = zU($.operation, "operation"),
      U = await this.repository.mutate(`${J} shot`, (Q) => {
        let W = z1(Q);
        if (J === "add") {
          let Y = Math.max(
              0.041666666666666664,
              r1(Math.max(1, Math.round(FJ($.duration_frames, "duration_frames", 90)))),
            ),
            D = Nz(Q.elements, W.shots.length, Kz(Q), Y, Q.aspect);
          ((D.name = e$($.name) ?? D.name), W.shots.push(D), (Q.activeShotId = D.id));
        } else if (J === "duplicate") {
          let Y = iJ(Q, e$($.shot_id)),
            D = structuredClone(Y);
          ((D.id = l0("shot")),
            (D.name = `${Y.name} Copy`),
            (D.actions = D.actions.map((H) => ({
              ...H,
              id: l0("action"),
              keyframes: H.keyframes?.map((G) => ({ ...G, id: l0("kf") })),
            }))),
            (D.cameraKeyframes = D.cameraKeyframes?.map((H) => ({ ...H, id: l0("ckf") }))),
            W.shots.splice(W.shots.indexOf(Y) + 1, 0, D),
            (Q.activeShotId = D.id));
        } else if (J === "rename") iJ(Q, e$($.shot_id)).name = zU($.name, "name");
        else if (J === "delete") {
          let Y = iJ(Q, e$($.shot_id));
          if (W.shots.length === 1) throw Error("A plan must keep at least one shot");
          ((W.shots = W.shots.filter((D) => D.id !== Y.id)), (Q.activeShotId = W.shots[0].id));
        } else if (J === "reorder") {
          let Y = iJ(Q, e$($.shot_id)),
            D = Math.max(0, Math.min(W.shots.length - 1, Math.round(FJ($.index, "index"))));
          ((W.shots = W.shots.filter((H) => H.id !== Y.id)), W.shots.splice(D, 0, Y));
        } else throw Error(`Unsupported shot operation: ${J}`);
        let X = SR(W);
        Q.plans = Q.plans.map((Y) => (Y.id === W.id ? X : Y));
      });
    return OJ(U);
  }
  async setLock($) {
    let J = zU($.target, "target"),
      U = zU($.id, "id"),
      Q = BU($.locked, !0),
      W = await this.repository.mutate(`${Q ? "Lock" : "Unlock"} ${J}`, (X) => {
        let Y = iJ(X, e$($.shot_id));
        if (J === "action") {
          let D = Y.actions.find((H) => H.id === U);
          if (!D) throw Error(`Unknown action id: ${U}`);
          D.locked = Q;
        } else if (J === "motion_keyframe") {
          let D = Y.actions.flatMap((H) => H.keyframes ?? []).find((H) => H.id === U);
          if (!D) throw Error(`Unknown motion keyframe id: ${U}`);
          D.locked = Q;
        } else if (J === "camera_keyframe") {
          let D = Y.cameraKeyframes?.find((H) => H.id === U);
          if (!D) throw Error(`Unknown camera keyframe id: ${U}`);
          D.locked = Q;
        } else throw Error(`Unsupported lock target: ${J}`);
      });
    return OJ(W);
  }
  async deleteItem($) {
    let J = zU($.target, "target"),
      U = zU($.id, "id"),
      Q = BU($.override_locked),
      W = await this.repository.mutate(`Delete ${J}`, (X) => {
        let Y = iJ(X, e$($.shot_id));
        if (J === "element") {
          (CX(X, U), (X.elements = X.elements.filter((D) => D.id !== U)));
          for (let D of X.plans)
            for (let H of D.shots)
              (delete H.elementStates[U], (H.actions = H.actions.filter((G) => G.elementId !== U)));
        } else if (J === "action") {
          let D = Y.actions.find((H) => H.id === U);
          if (!D) throw Error(`Unknown action id: ${U}`);
          (e9(D.locked, Q, `Action ${U}`), (Y.actions = Y.actions.filter((H) => H.id !== U)));
        } else if (J === "motion_keyframe")
          for (let D of Y.actions) {
            let H = D.keyframes?.find((G) => G.id === U);
            if (H) e9(H.locked || D.locked, Q, `Motion keyframe ${U}`);
            D.keyframes = D.keyframes?.filter((G) => G.id !== U);
          }
        else if (J === "camera_keyframe") {
          let D = Y.cameraKeyframes?.find((H) => H.id === U);
          if (!D) throw Error(`Unknown camera keyframe id: ${U}`);
          (e9(D.locked, Q, `Camera keyframe ${U}`), (Y.cameraKeyframes = Y.cameraKeyframes?.filter((H) => H.id !== U)));
        } else throw Error(`Unsupported delete target: ${J}`);
      });
    return OJ(W);
  }
}
var __ = new iE();
async function Xo() {
  let $ = new Wz({ name: "previs-engine", version: "0.2.0" });
  for (let [J, U] of Object.entries(j5))
    $.registerTool(J, { description: U.description, inputSchema: U.inputSchema }, async (Q) => {
      try {
        let W = await __.execute(J, Q);
        return { content: [{ type: "text", text: JSON.stringify(W, null, 2) }], structuredContent: W };
      } catch (W) {
        return { isError: !0, content: [{ type: "text", text: W instanceof Error ? W.message : String(W) }] };
      }
    });
  await $.connect(new Xz());
}
var P_ = process.argv.indexOf("--http");
if (P_ >= 0) {
  let $ = Number(process.argv[P_ + 1]);
  await VR(__, Number.isInteger($) && $ > 0 ? $ : 4318);
} else await Xo();
