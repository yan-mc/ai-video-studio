var IZ = "184",
  a8 = { LEFT: 0, MIDDLE: 1, RIGHT: 2, ROTATE: 0, DOLLY: 1, PAN: 2 },
  t8 = { ROTATE: 0, PAN: 1, DOLLY_PAN: 2, DOLLY_ROTATE: 3 },
  VZ = 0,
  sz = 1,
  kZ = 2;
var DX = 1,
  AZ = 2,
  x1 = 3,
  g1 = 0,
  kJ = 1,
  AJ = 2,
  TU = 0,
  HX = 1,
  az = 2,
  tz = 3,
  ez = 4,
  MZ = 5;
var h1 = 100,
  RZ = 101,
  ZZ = 102,
  PZ = 103,
  _Z = 104,
  SZ = 200,
  CZ = 201,
  TZ = 202,
  jZ = 203,
  vZ = 204,
  bZ = 205,
  fZ = 206,
  yZ = 207,
  xZ = 208,
  gZ = 209,
  hZ = 210,
  uZ = 211,
  lZ = 212,
  mZ = 213,
  pZ = 214,
  dZ = 0,
  cZ = 1,
  nZ = 2,
  $B = 3,
  iZ = 4,
  oZ = 5,
  rZ = 6,
  sZ = 7,
  aZ = 0,
  tZ = 1,
  eZ = 2,
  OU = 0,
  JB = 1,
  UB = 2,
  WB = 3,
  QB = 4,
  XB = 5,
  YB = 6,
  DB = 7;
var u1 = 301,
  x9 = 302,
  l1 = 303,
  NG = 304,
  GX = 306,
  $P = 1000,
  OG = 1001,
  JP = 1002,
  e8 = 1003,
  UP = 1004;
var KX = 1005;
var MJ = 1006,
  FG = 1007;
var g9 = 1008;
var FU = 1009,
  WP = 1010,
  QP = 1011,
  NX = 1012,
  HB = 1013,
  $9 = 1014,
  X8 = 1015,
  Y8 = 1016,
  GB = 1017,
  KB = 1018,
  m1 = 1020,
  XP = 35902,
  YP = 35899,
  DP = 1021,
  HP = 1022,
  jU = 1023,
  h9 = 1026,
  u9 = 1027,
  GP = 1028,
  NB = 1029,
  l9 = 1030,
  OB = 1031;
var FB = 1033,
  qG = 33776,
  zG = 33777,
  BG = 33778,
  EG = 33779,
  qB = 35840,
  zB = 35841,
  BB = 35842,
  EB = 35843,
  LB = 36196,
  wB = 37492,
  IB = 37496,
  VB = 37488,
  kB = 37489,
  LG = 37490,
  AB = 37491,
  MB = 37808,
  RB = 37809,
  ZB = 37810,
  PB = 37811,
  _B = 37812,
  SB = 37813,
  CB = 37814,
  TB = 37815,
  jB = 37816,
  vB = 37817,
  bB = 37818,
  fB = 37819,
  yB = 37820,
  xB = 37821,
  gB = 36492,
  hB = 36494,
  uB = 36495,
  lB = 36283,
  mB = 36284,
  wG = 36285,
  pB = 36286;
var dB = 0,
  KP = 1,
  m9 = "",
  J9 = "srgb",
  cB = "srgb-linear",
  nB = "linear",
  W0 = "srgb";
var NP = 512,
  OP = 513,
  FP = 514,
  IG = 515,
  qP = 516,
  zP = 517,
  VG = 518,
  BP = 519;
var iB = "300 es",
  oB = 2000;
function rl($) {
  for (let J = $.length - 1; J >= 0; --J) if ($[J] >= 65535) return !0;
  return !1;
}
function sl($) {
  return ArrayBuffer.isView($) && !($ instanceof DataView);
}
function b1($) {
  return document.createElementNS("http://www.w3.org/1999/xhtml", $);
}
function EP() {
  let $ = b1("canvas");
  return (($.style.display = "block"), $);
}
var dR = {},
  f1 = null;
function XX(...$) {
  let J = "THREE." + $.shift();
  if (f1) f1("log", J, ...$);
  else console.log(J, ...$);
}
function LP($) {
  let J = $[0];
  if (typeof J === "string" && J.startsWith("TSL:")) {
    let U = $[1];
    if (U && U.isStackTrace) $[0] += " " + U.getLocation();
    else $[1] = 'Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.';
  }
  return $;
}
function i$(...$) {
  $ = LP($);
  let J = "THREE." + $.shift();
  if (f1) f1("warn", J, ...$);
  else {
    let U = $[0];
    if (U && U.isStackTrace) console.warn(U.getError(J));
    else console.warn(J, ...$);
  }
}
function s$(...$) {
  $ = LP($);
  let J = "THREE." + $.shift();
  if (f1) f1("error", J, ...$);
  else {
    let U = $[0];
    if (U && U.isStackTrace) console.error(U.getError(J));
    else console.error(J, ...$);
  }
}
function HG(...$) {
  let J = $.join(" ");
  if (J in dR) return;
  ((dR[J] = !0), i$(...$));
}
function wP($, J, U) {
  return new Promise(function (Q, W) {
    function X() {
      switch ($.clientWaitSync(J, $.SYNC_FLUSH_COMMANDS_BIT, 0)) {
        case $.WAIT_FAILED:
          W();
          break;
        case $.TIMEOUT_EXPIRED:
          setTimeout(X, U);
          break;
        default:
          Q();
      }
    }
    setTimeout(X, U);
  });
}
var IP = { [0]: 1, [2]: 6, [4]: 7, [3]: 5, [1]: 0, [6]: 2, [7]: 4, [5]: 3 };
class vU {
  addEventListener($, J) {
    if (this._listeners === void 0) this._listeners = {};
    let U = this._listeners;
    if (U[$] === void 0) U[$] = [];
    if (U[$].indexOf(J) === -1) U[$].push(J);
  }
  hasEventListener($, J) {
    let U = this._listeners;
    if (U === void 0) return !1;
    return U[$] !== void 0 && U[$].indexOf(J) !== -1;
  }
  removeEventListener($, J) {
    let U = this._listeners;
    if (U === void 0) return;
    let Q = U[$];
    if (Q !== void 0) {
      let W = Q.indexOf(J);
      if (W !== -1) Q.splice(W, 1);
    }
  }
  dispatchEvent($) {
    let J = this._listeners;
    if (J === void 0) return;
    let U = J[$.type];
    if (U !== void 0) {
      $.target = this;
      let Q = U.slice(0);
      for (let W = 0, X = Q.length; W < X; W++) Q[W].call(this, $);
      $.target = null;
    }
  }
}
var i0 = [
    "00",
    "01",
    "02",
    "03",
    "04",
    "05",
    "06",
    "07",
    "08",
    "09",
    "0a",
    "0b",
    "0c",
    "0d",
    "0e",
    "0f",
    "10",
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
    "17",
    "18",
    "19",
    "1a",
    "1b",
    "1c",
    "1d",
    "1e",
    "1f",
    "20",
    "21",
    "22",
    "23",
    "24",
    "25",
    "26",
    "27",
    "28",
    "29",
    "2a",
    "2b",
    "2c",
    "2d",
    "2e",
    "2f",
    "30",
    "31",
    "32",
    "33",
    "34",
    "35",
    "36",
    "37",
    "38",
    "39",
    "3a",
    "3b",
    "3c",
    "3d",
    "3e",
    "3f",
    "40",
    "41",
    "42",
    "43",
    "44",
    "45",
    "46",
    "47",
    "48",
    "49",
    "4a",
    "4b",
    "4c",
    "4d",
    "4e",
    "4f",
    "50",
    "51",
    "52",
    "53",
    "54",
    "55",
    "56",
    "57",
    "58",
    "59",
    "5a",
    "5b",
    "5c",
    "5d",
    "5e",
    "5f",
    "60",
    "61",
    "62",
    "63",
    "64",
    "65",
    "66",
    "67",
    "68",
    "69",
    "6a",
    "6b",
    "6c",
    "6d",
    "6e",
    "6f",
    "70",
    "71",
    "72",
    "73",
    "74",
    "75",
    "76",
    "77",
    "78",
    "79",
    "7a",
    "7b",
    "7c",
    "7d",
    "7e",
    "7f",
    "80",
    "81",
    "82",
    "83",
    "84",
    "85",
    "86",
    "87",
    "88",
    "89",
    "8a",
    "8b",
    "8c",
    "8d",
    "8e",
    "8f",
    "90",
    "91",
    "92",
    "93",
    "94",
    "95",
    "96",
    "97",
    "98",
    "99",
    "9a",
    "9b",
    "9c",
    "9d",
    "9e",
    "9f",
    "a0",
    "a1",
    "a2",
    "a3",
    "a4",
    "a5",
    "a6",
    "a7",
    "a8",
    "a9",
    "aa",
    "ab",
    "ac",
    "ad",
    "ae",
    "af",
    "b0",
    "b1",
    "b2",
    "b3",
    "b4",
    "b5",
    "b6",
    "b7",
    "b8",
    "b9",
    "ba",
    "bb",
    "bc",
    "bd",
    "be",
    "bf",
    "c0",
    "c1",
    "c2",
    "c3",
    "c4",
    "c5",
    "c6",
    "c7",
    "c8",
    "c9",
    "ca",
    "cb",
    "cc",
    "cd",
    "ce",
    "cf",
    "d0",
    "d1",
    "d2",
    "d3",
    "d4",
    "d5",
    "d6",
    "d7",
    "d8",
    "d9",
    "da",
    "db",
    "dc",
    "dd",
    "de",
    "df",
    "e0",
    "e1",
    "e2",
    "e3",
    "e4",
    "e5",
    "e6",
    "e7",
    "e8",
    "e9",
    "ea",
    "eb",
    "ec",
    "ed",
    "ee",
    "ef",
    "f0",
    "f1",
    "f2",
    "f3",
    "f4",
    "f5",
    "f6",
    "f7",
    "f8",
    "f9",
    "fa",
    "fb",
    "fc",
    "fd",
    "fe",
    "ff",
  ],
  cR = 1234567,
  WX = Math.PI / 180,
  y1 = 180 / Math.PI;
function W8() {
  let $ = (Math.random() * 4294967295) | 0,
    J = (Math.random() * 4294967295) | 0,
    U = (Math.random() * 4294967295) | 0,
    Q = (Math.random() * 4294967295) | 0;
  return (
    i0[$ & 255] +
    i0[($ >> 8) & 255] +
    i0[($ >> 16) & 255] +
    i0[($ >> 24) & 255] +
    "-" +
    i0[J & 255] +
    i0[(J >> 8) & 255] +
    "-" +
    i0[((J >> 16) & 15) | 64] +
    i0[(J >> 24) & 255] +
    "-" +
    i0[(U & 63) | 128] +
    i0[(U >> 8) & 255] +
    "-" +
    i0[(U >> 16) & 255] +
    i0[(U >> 24) & 255] +
    i0[Q & 255] +
    i0[(Q >> 8) & 255] +
    i0[(Q >> 16) & 255] +
    i0[(Q >> 24) & 255]
  ).toLowerCase();
}
function V6($, J, U) {
  return Math.max(J, Math.min(U, $));
}
function rB($, J) {
  return (($ % J) + J) % J;
}
function al($, J, U, Q, W) {
  return Q + (($ - J) * (W - Q)) / (U - J);
}
function tl($, J, U) {
  if ($ !== J) return (U - $) / (J - $);
  else return 0;
}
function QX($, J, U) {
  return (1 - U) * $ + U * J;
}
function el($, J, U, Q) {
  return QX($, J, 1 - Math.exp(-U * Q));
}
function $m($, J = 1) {
  return J - Math.abs(rB($, J * 2) - J);
}
function Jm($, J, U) {
  if ($ <= J) return 0;
  if ($ >= U) return 1;
  return (($ = ($ - J) / (U - J)), $ * $ * (3 - 2 * $));
}
function Um($, J, U) {
  if ($ <= J) return 0;
  if ($ >= U) return 1;
  return (($ = ($ - J) / (U - J)), $ * $ * $ * ($ * ($ * 6 - 15) + 10));
}
function Wm($, J) {
  return $ + Math.floor(Math.random() * (J - $ + 1));
}
function Qm($, J) {
  return $ + Math.random() * (J - $);
}
function Xm($) {
  return $ * (0.5 - Math.random());
}
function Ym($) {
  if ($ !== void 0) cR = $;
  let J = (cR += 1831565813);
  return (
    (J = Math.imul(J ^ (J >>> 15), J | 1)),
    (J ^= J + Math.imul(J ^ (J >>> 7), J | 61)),
    ((J ^ (J >>> 14)) >>> 0) / 4294967296
  );
}
function Dm($) {
  return $ * WX;
}
function Hm($) {
  return $ * y1;
}
function Gm($) {
  return ($ & ($ - 1)) === 0 && $ !== 0;
}
function Km($) {
  return Math.pow(2, Math.ceil(Math.log($) / Math.LN2));
}
function Nm($) {
  return Math.pow(2, Math.floor(Math.log($) / Math.LN2));
}
function Om($, J, U, Q, W) {
  let { cos: X, sin: Y } = Math,
    D = X(U / 2),
    H = Y(U / 2),
    G = X((J + Q) / 2),
    K = Y((J + Q) / 2),
    O = X((J - Q) / 2),
    N = Y((J - Q) / 2),
    F = X((Q - J) / 2),
    B = Y((Q - J) / 2);
  switch (W) {
    case "XYX":
      $.set(D * K, H * O, H * N, D * G);
      break;
    case "YZY":
      $.set(H * N, D * K, H * O, D * G);
      break;
    case "ZXZ":
      $.set(H * O, H * N, D * K, D * G);
      break;
    case "XZX":
      $.set(D * K, H * B, H * F, D * G);
      break;
    case "YXY":
      $.set(H * F, D * K, H * B, D * G);
      break;
    case "ZYZ":
      $.set(H * B, H * F, D * K, D * G);
      break;
    default:
      i$("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: " + W);
  }
}
function KU($, J) {
  switch (J.constructor) {
    case Float32Array:
      return $;
    case Uint32Array:
      return $ / 4294967295;
    case Uint16Array:
      return $ / 65535;
    case Uint8Array:
      return $ / 255;
    case Int32Array:
      return Math.max($ / 2147483647, -1);
    case Int16Array:
      return Math.max($ / 32767, -1);
    case Int8Array:
      return Math.max($ / 127, -1);
    default:
      throw Error("Invalid component type.");
  }
}
function l6($, J) {
  switch (J.constructor) {
    case Float32Array:
      return $;
    case Uint32Array:
      return Math.round($ * 4294967295);
    case Uint16Array:
      return Math.round($ * 65535);
    case Uint8Array:
      return Math.round($ * 255);
    case Int32Array:
      return Math.round($ * 2147483647);
    case Int16Array:
      return Math.round($ * 32767);
    case Int8Array:
      return Math.round($ * 127);
    default:
      throw Error("Invalid component type.");
  }
}
var sB = {
  DEG2RAD: WX,
  RAD2DEG: y1,
  generateUUID: W8,
  clamp: V6,
  euclideanModulo: rB,
  mapLinear: al,
  inverseLerp: tl,
  lerp: QX,
  damp: el,
  pingpong: $m,
  smoothstep: Jm,
  smootherstep: Um,
  randInt: Wm,
  randFloat: Qm,
  randFloatSpread: Xm,
  seededRandom: Ym,
  degToRad: Dm,
  radToDeg: Hm,
  isPowerOfTwo: Gm,
  ceilPowerOfTwo: Km,
  floorPowerOfTwo: Nm,
  setQuaternionFromProperEuler: Om,
  normalize: l6,
  denormalize: KU,
};
class d$ {
  static {
    d$.prototype.isVector2 = !0;
  }
  constructor($ = 0, J = 0) {
    ((this.x = $), (this.y = J));
  }
  get width() {
    return this.x;
  }
  set width($) {
    this.x = $;
  }
  get height() {
    return this.y;
  }
  set height($) {
    this.y = $;
  }
  set($, J) {
    return ((this.x = $), (this.y = J), this);
  }
  setScalar($) {
    return ((this.x = $), (this.y = $), this);
  }
  setX($) {
    return ((this.x = $), this);
  }
  setY($) {
    return ((this.y = $), this);
  }
  setComponent($, J) {
    switch ($) {
      case 0:
        this.x = J;
        break;
      case 1:
        this.y = J;
        break;
      default:
        throw Error("index is out of range: " + $);
    }
    return this;
  }
  getComponent($) {
    switch ($) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      default:
        throw Error("index is out of range: " + $);
    }
  }
  clone() {
    return new this.constructor(this.x, this.y);
  }
  copy($) {
    return ((this.x = $.x), (this.y = $.y), this);
  }
  add($) {
    return ((this.x += $.x), (this.y += $.y), this);
  }
  addScalar($) {
    return ((this.x += $), (this.y += $), this);
  }
  addVectors($, J) {
    return ((this.x = $.x + J.x), (this.y = $.y + J.y), this);
  }
  addScaledVector($, J) {
    return ((this.x += $.x * J), (this.y += $.y * J), this);
  }
  sub($) {
    return ((this.x -= $.x), (this.y -= $.y), this);
  }
  subScalar($) {
    return ((this.x -= $), (this.y -= $), this);
  }
  subVectors($, J) {
    return ((this.x = $.x - J.x), (this.y = $.y - J.y), this);
  }
  multiply($) {
    return ((this.x *= $.x), (this.y *= $.y), this);
  }
  multiplyScalar($) {
    return ((this.x *= $), (this.y *= $), this);
  }
  divide($) {
    return ((this.x /= $.x), (this.y /= $.y), this);
  }
  divideScalar($) {
    return this.multiplyScalar(1 / $);
  }
  applyMatrix3($) {
    let J = this.x,
      U = this.y,
      Q = $.elements;
    return ((this.x = Q[0] * J + Q[3] * U + Q[6]), (this.y = Q[1] * J + Q[4] * U + Q[7]), this);
  }
  min($) {
    return ((this.x = Math.min(this.x, $.x)), (this.y = Math.min(this.y, $.y)), this);
  }
  max($) {
    return ((this.x = Math.max(this.x, $.x)), (this.y = Math.max(this.y, $.y)), this);
  }
  clamp($, J) {
    return ((this.x = V6(this.x, $.x, J.x)), (this.y = V6(this.y, $.y, J.y)), this);
  }
  clampScalar($, J) {
    return ((this.x = V6(this.x, $, J)), (this.y = V6(this.y, $, J)), this);
  }
  clampLength($, J) {
    let U = this.length();
    return this.divideScalar(U || 1).multiplyScalar(V6(U, $, J));
  }
  floor() {
    return ((this.x = Math.floor(this.x)), (this.y = Math.floor(this.y)), this);
  }
  ceil() {
    return ((this.x = Math.ceil(this.x)), (this.y = Math.ceil(this.y)), this);
  }
  round() {
    return ((this.x = Math.round(this.x)), (this.y = Math.round(this.y)), this);
  }
  roundToZero() {
    return ((this.x = Math.trunc(this.x)), (this.y = Math.trunc(this.y)), this);
  }
  negate() {
    return ((this.x = -this.x), (this.y = -this.y), this);
  }
  dot($) {
    return this.x * $.x + this.y * $.y;
  }
  cross($) {
    return this.x * $.y - this.y * $.x;
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  manhattanLength() {
    return Math.abs(this.x) + Math.abs(this.y);
  }
  normalize() {
    return this.divideScalar(this.length() || 1);
  }
  angle() {
    return Math.atan2(-this.y, -this.x) + Math.PI;
  }
  angleTo($) {
    let J = Math.sqrt(this.lengthSq() * $.lengthSq());
    if (J === 0) return Math.PI / 2;
    let U = this.dot($) / J;
    return Math.acos(V6(U, -1, 1));
  }
  distanceTo($) {
    return Math.sqrt(this.distanceToSquared($));
  }
  distanceToSquared($) {
    let J = this.x - $.x,
      U = this.y - $.y;
    return J * J + U * U;
  }
  manhattanDistanceTo($) {
    return Math.abs(this.x - $.x) + Math.abs(this.y - $.y);
  }
  setLength($) {
    return this.normalize().multiplyScalar($);
  }
  lerp($, J) {
    return ((this.x += ($.x - this.x) * J), (this.y += ($.y - this.y) * J), this);
  }
  lerpVectors($, J, U) {
    return ((this.x = $.x + (J.x - $.x) * U), (this.y = $.y + (J.y - $.y) * U), this);
  }
  equals($) {
    return $.x === this.x && $.y === this.y;
  }
  fromArray($, J = 0) {
    return ((this.x = $[J]), (this.y = $[J + 1]), this);
  }
  toArray($ = [], J = 0) {
    return (($[J] = this.x), ($[J + 1] = this.y), $);
  }
  fromBufferAttribute($, J) {
    return ((this.x = $.getX(J)), (this.y = $.getY(J)), this);
  }
  rotateAround($, J) {
    let U = Math.cos(J),
      Q = Math.sin(J),
      W = this.x - $.x,
      X = this.y - $.y;
    return ((this.x = W * U - X * Q + $.x), (this.y = W * Q + X * U + $.y), this);
  }
  random() {
    return ((this.x = Math.random()), (this.y = Math.random()), this);
  }
  *[Symbol.iterator]() {
    (yield this.x, yield this.y);
  }
}
class H0 {
  constructor($ = 0, J = 0, U = 0, Q = 1) {
    ((this.isQuaternion = !0), (this._x = $), (this._y = J), (this._z = U), (this._w = Q));
  }
  static slerpFlat($, J, U, Q, W, X, Y) {
    let D = U[Q + 0],
      H = U[Q + 1],
      G = U[Q + 2],
      K = U[Q + 3],
      O = W[X + 0],
      N = W[X + 1],
      F = W[X + 2],
      B = W[X + 3];
    if (K !== B || D !== O || H !== N || G !== F) {
      let E = D * O + H * N + G * F + K * B;
      if (E < 0) ((O = -O), (N = -N), (F = -F), (B = -B), (E = -E));
      let z = 1 - Y;
      if (E < 0.9995) {
        let q = Math.acos(E),
          L = Math.sin(q);
        ((z = Math.sin(z * q) / L),
          (Y = Math.sin(Y * q) / L),
          (D = D * z + O * Y),
          (H = H * z + N * Y),
          (G = G * z + F * Y),
          (K = K * z + B * Y));
      } else {
        ((D = D * z + O * Y), (H = H * z + N * Y), (G = G * z + F * Y), (K = K * z + B * Y));
        let q = 1 / Math.sqrt(D * D + H * H + G * G + K * K);
        ((D *= q), (H *= q), (G *= q), (K *= q));
      }
    }
    (($[J] = D), ($[J + 1] = H), ($[J + 2] = G), ($[J + 3] = K));
  }
  static multiplyQuaternionsFlat($, J, U, Q, W, X) {
    let Y = U[Q],
      D = U[Q + 1],
      H = U[Q + 2],
      G = U[Q + 3],
      K = W[X],
      O = W[X + 1],
      N = W[X + 2],
      F = W[X + 3];
    return (
      ($[J] = Y * F + G * K + D * N - H * O),
      ($[J + 1] = D * F + G * O + H * K - Y * N),
      ($[J + 2] = H * F + G * N + Y * O - D * K),
      ($[J + 3] = G * F - Y * K - D * O - H * N),
      $
    );
  }
  get x() {
    return this._x;
  }
  set x($) {
    ((this._x = $), this._onChangeCallback());
  }
  get y() {
    return this._y;
  }
  set y($) {
    ((this._y = $), this._onChangeCallback());
  }
  get z() {
    return this._z;
  }
  set z($) {
    ((this._z = $), this._onChangeCallback());
  }
  get w() {
    return this._w;
  }
  set w($) {
    ((this._w = $), this._onChangeCallback());
  }
  set($, J, U, Q) {
    return ((this._x = $), (this._y = J), (this._z = U), (this._w = Q), this._onChangeCallback(), this);
  }
  clone() {
    return new this.constructor(this._x, this._y, this._z, this._w);
  }
  copy($) {
    return ((this._x = $.x), (this._y = $.y), (this._z = $.z), (this._w = $.w), this._onChangeCallback(), this);
  }
  setFromEuler($, J = !0) {
    let { _x: U, _y: Q, _z: W, _order: X } = $,
      Y = Math.cos,
      D = Math.sin,
      H = Y(U / 2),
      G = Y(Q / 2),
      K = Y(W / 2),
      O = D(U / 2),
      N = D(Q / 2),
      F = D(W / 2);
    switch (X) {
      case "XYZ":
        ((this._x = O * G * K + H * N * F),
          (this._y = H * N * K - O * G * F),
          (this._z = H * G * F + O * N * K),
          (this._w = H * G * K - O * N * F));
        break;
      case "YXZ":
        ((this._x = O * G * K + H * N * F),
          (this._y = H * N * K - O * G * F),
          (this._z = H * G * F - O * N * K),
          (this._w = H * G * K + O * N * F));
        break;
      case "ZXY":
        ((this._x = O * G * K - H * N * F),
          (this._y = H * N * K + O * G * F),
          (this._z = H * G * F + O * N * K),
          (this._w = H * G * K - O * N * F));
        break;
      case "ZYX":
        ((this._x = O * G * K - H * N * F),
          (this._y = H * N * K + O * G * F),
          (this._z = H * G * F - O * N * K),
          (this._w = H * G * K + O * N * F));
        break;
      case "YZX":
        ((this._x = O * G * K + H * N * F),
          (this._y = H * N * K + O * G * F),
          (this._z = H * G * F - O * N * K),
          (this._w = H * G * K - O * N * F));
        break;
      case "XZY":
        ((this._x = O * G * K - H * N * F),
          (this._y = H * N * K - O * G * F),
          (this._z = H * G * F + O * N * K),
          (this._w = H * G * K + O * N * F));
        break;
      default:
        i$("Quaternion: .setFromEuler() encountered an unknown order: " + X);
    }
    if (J === !0) this._onChangeCallback();
    return this;
  }
  setFromAxisAngle($, J) {
    let U = J / 2,
      Q = Math.sin(U);
    return (
      (this._x = $.x * Q),
      (this._y = $.y * Q),
      (this._z = $.z * Q),
      (this._w = Math.cos(U)),
      this._onChangeCallback(),
      this
    );
  }
  setFromRotationMatrix($) {
    let J = $.elements,
      U = J[0],
      Q = J[4],
      W = J[8],
      X = J[1],
      Y = J[5],
      D = J[9],
      H = J[2],
      G = J[6],
      K = J[10],
      O = U + Y + K;
    if (O > 0) {
      let N = 0.5 / Math.sqrt(O + 1);
      ((this._w = 0.25 / N), (this._x = (G - D) * N), (this._y = (W - H) * N), (this._z = (X - Q) * N));
    } else if (U > Y && U > K) {
      let N = 2 * Math.sqrt(1 + U - Y - K);
      ((this._w = (G - D) / N), (this._x = 0.25 * N), (this._y = (Q + X) / N), (this._z = (W + H) / N));
    } else if (Y > K) {
      let N = 2 * Math.sqrt(1 + Y - U - K);
      ((this._w = (W - H) / N), (this._x = (Q + X) / N), (this._y = 0.25 * N), (this._z = (D + G) / N));
    } else {
      let N = 2 * Math.sqrt(1 + K - U - Y);
      ((this._w = (X - Q) / N), (this._x = (W + H) / N), (this._y = (D + G) / N), (this._z = 0.25 * N));
    }
    return (this._onChangeCallback(), this);
  }
  setFromUnitVectors($, J) {
    let U = $.dot(J) + 1;
    if (U < 0.00000001)
      if (((U = 0), Math.abs($.x) > Math.abs($.z))) ((this._x = -$.y), (this._y = $.x), (this._z = 0), (this._w = U));
      else ((this._x = 0), (this._y = -$.z), (this._z = $.y), (this._w = U));
    else
      ((this._x = $.y * J.z - $.z * J.y),
        (this._y = $.z * J.x - $.x * J.z),
        (this._z = $.x * J.y - $.y * J.x),
        (this._w = U));
    return this.normalize();
  }
  angleTo($) {
    return 2 * Math.acos(Math.abs(V6(this.dot($), -1, 1)));
  }
  rotateTowards($, J) {
    let U = this.angleTo($);
    if (U === 0) return this;
    let Q = Math.min(1, J / U);
    return (this.slerp($, Q), this);
  }
  identity() {
    return this.set(0, 0, 0, 1);
  }
  invert() {
    return this.conjugate();
  }
  conjugate() {
    return ((this._x *= -1), (this._y *= -1), (this._z *= -1), this._onChangeCallback(), this);
  }
  dot($) {
    return this._x * $._x + this._y * $._y + this._z * $._z + this._w * $._w;
  }
  lengthSq() {
    return this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w;
  }
  length() {
    return Math.sqrt(this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w);
  }
  normalize() {
    let $ = this.length();
    if ($ === 0) ((this._x = 0), (this._y = 0), (this._z = 0), (this._w = 1));
    else
      (($ = 1 / $), (this._x = this._x * $), (this._y = this._y * $), (this._z = this._z * $), (this._w = this._w * $));
    return (this._onChangeCallback(), this);
  }
  multiply($) {
    return this.multiplyQuaternions(this, $);
  }
  premultiply($) {
    return this.multiplyQuaternions($, this);
  }
  multiplyQuaternions($, J) {
    let { _x: U, _y: Q, _z: W, _w: X } = $,
      Y = J._x,
      D = J._y,
      H = J._z,
      G = J._w;
    return (
      (this._x = U * G + X * Y + Q * H - W * D),
      (this._y = Q * G + X * D + W * Y - U * H),
      (this._z = W * G + X * H + U * D - Q * Y),
      (this._w = X * G - U * Y - Q * D - W * H),
      this._onChangeCallback(),
      this
    );
  }
  slerp($, J) {
    let { _x: U, _y: Q, _z: W, _w: X } = $,
      Y = this.dot($);
    if (Y < 0) ((U = -U), (Q = -Q), (W = -W), (X = -X), (Y = -Y));
    let D = 1 - J;
    if (Y < 0.9995) {
      let H = Math.acos(Y),
        G = Math.sin(H);
      ((D = Math.sin(D * H) / G),
        (J = Math.sin(J * H) / G),
        (this._x = this._x * D + U * J),
        (this._y = this._y * D + Q * J),
        (this._z = this._z * D + W * J),
        (this._w = this._w * D + X * J),
        this._onChangeCallback());
    } else
      ((this._x = this._x * D + U * J),
        (this._y = this._y * D + Q * J),
        (this._z = this._z * D + W * J),
        (this._w = this._w * D + X * J),
        this.normalize());
    return this;
  }
  slerpQuaternions($, J, U) {
    return this.copy($).slerp(J, U);
  }
  random() {
    let $ = 2 * Math.PI * Math.random(),
      J = 2 * Math.PI * Math.random(),
      U = Math.random(),
      Q = Math.sqrt(1 - U),
      W = Math.sqrt(U);
    return this.set(Q * Math.sin($), Q * Math.cos($), W * Math.sin(J), W * Math.cos(J));
  }
  equals($) {
    return $._x === this._x && $._y === this._y && $._z === this._z && $._w === this._w;
  }
  fromArray($, J = 0) {
    return (
      (this._x = $[J]),
      (this._y = $[J + 1]),
      (this._z = $[J + 2]),
      (this._w = $[J + 3]),
      this._onChangeCallback(),
      this
    );
  }
  toArray($ = [], J = 0) {
    return (($[J] = this._x), ($[J + 1] = this._y), ($[J + 2] = this._z), ($[J + 3] = this._w), $);
  }
  fromBufferAttribute($, J) {
    return (
      (this._x = $.getX(J)),
      (this._y = $.getY(J)),
      (this._z = $.getZ(J)),
      (this._w = $.getW(J)),
      this._onChangeCallback(),
      this
    );
  }
  toJSON() {
    return this.toArray();
  }
  _onChange($) {
    return ((this._onChangeCallback = $), this);
  }
  _onChangeCallback() {}
  *[Symbol.iterator]() {
    (yield this._x, yield this._y, yield this._z, yield this._w);
  }
}
class C {
  static {
    C.prototype.isVector3 = !0;
  }
  constructor($ = 0, J = 0, U = 0) {
    ((this.x = $), (this.y = J), (this.z = U));
  }
  set($, J, U) {
    if (U === void 0) U = this.z;
    return ((this.x = $), (this.y = J), (this.z = U), this);
  }
  setScalar($) {
    return ((this.x = $), (this.y = $), (this.z = $), this);
  }
  setX($) {
    return ((this.x = $), this);
  }
  setY($) {
    return ((this.y = $), this);
  }
  setZ($) {
    return ((this.z = $), this);
  }
  setComponent($, J) {
    switch ($) {
      case 0:
        this.x = J;
        break;
      case 1:
        this.y = J;
        break;
      case 2:
        this.z = J;
        break;
      default:
        throw Error("index is out of range: " + $);
    }
    return this;
  }
  getComponent($) {
    switch ($) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      case 2:
        return this.z;
      default:
        throw Error("index is out of range: " + $);
    }
  }
  clone() {
    return new this.constructor(this.x, this.y, this.z);
  }
  copy($) {
    return ((this.x = $.x), (this.y = $.y), (this.z = $.z), this);
  }
  add($) {
    return ((this.x += $.x), (this.y += $.y), (this.z += $.z), this);
  }
  addScalar($) {
    return ((this.x += $), (this.y += $), (this.z += $), this);
  }
  addVectors($, J) {
    return ((this.x = $.x + J.x), (this.y = $.y + J.y), (this.z = $.z + J.z), this);
  }
  addScaledVector($, J) {
    return ((this.x += $.x * J), (this.y += $.y * J), (this.z += $.z * J), this);
  }
  sub($) {
    return ((this.x -= $.x), (this.y -= $.y), (this.z -= $.z), this);
  }
  subScalar($) {
    return ((this.x -= $), (this.y -= $), (this.z -= $), this);
  }
  subVectors($, J) {
    return ((this.x = $.x - J.x), (this.y = $.y - J.y), (this.z = $.z - J.z), this);
  }
  multiply($) {
    return ((this.x *= $.x), (this.y *= $.y), (this.z *= $.z), this);
  }
  multiplyScalar($) {
    return ((this.x *= $), (this.y *= $), (this.z *= $), this);
  }
  multiplyVectors($, J) {
    return ((this.x = $.x * J.x), (this.y = $.y * J.y), (this.z = $.z * J.z), this);
  }
  applyEuler($) {
    return this.applyQuaternion(nR.setFromEuler($));
  }
  applyAxisAngle($, J) {
    return this.applyQuaternion(nR.setFromAxisAngle($, J));
  }
  applyMatrix3($) {
    let J = this.x,
      U = this.y,
      Q = this.z,
      W = $.elements;
    return (
      (this.x = W[0] * J + W[3] * U + W[6] * Q),
      (this.y = W[1] * J + W[4] * U + W[7] * Q),
      (this.z = W[2] * J + W[5] * U + W[8] * Q),
      this
    );
  }
  applyNormalMatrix($) {
    return this.applyMatrix3($).normalize();
  }
  applyMatrix4($) {
    let J = this.x,
      U = this.y,
      Q = this.z,
      W = $.elements,
      X = 1 / (W[3] * J + W[7] * U + W[11] * Q + W[15]);
    return (
      (this.x = (W[0] * J + W[4] * U + W[8] * Q + W[12]) * X),
      (this.y = (W[1] * J + W[5] * U + W[9] * Q + W[13]) * X),
      (this.z = (W[2] * J + W[6] * U + W[10] * Q + W[14]) * X),
      this
    );
  }
  applyQuaternion($) {
    let J = this.x,
      U = this.y,
      Q = this.z,
      W = $.x,
      X = $.y,
      Y = $.z,
      D = $.w,
      H = 2 * (X * Q - Y * U),
      G = 2 * (Y * J - W * Q),
      K = 2 * (W * U - X * J);
    return (
      (this.x = J + D * H + X * K - Y * G),
      (this.y = U + D * G + Y * H - W * K),
      (this.z = Q + D * K + W * G - X * H),
      this
    );
  }
  project($) {
    return this.applyMatrix4($.matrixWorldInverse).applyMatrix4($.projectionMatrix);
  }
  unproject($) {
    return this.applyMatrix4($.projectionMatrixInverse).applyMatrix4($.matrixWorld);
  }
  transformDirection($) {
    let J = this.x,
      U = this.y,
      Q = this.z,
      W = $.elements;
    return (
      (this.x = W[0] * J + W[4] * U + W[8] * Q),
      (this.y = W[1] * J + W[5] * U + W[9] * Q),
      (this.z = W[2] * J + W[6] * U + W[10] * Q),
      this.normalize()
    );
  }
  divide($) {
    return ((this.x /= $.x), (this.y /= $.y), (this.z /= $.z), this);
  }
  divideScalar($) {
    return this.multiplyScalar(1 / $);
  }
  min($) {
    return ((this.x = Math.min(this.x, $.x)), (this.y = Math.min(this.y, $.y)), (this.z = Math.min(this.z, $.z)), this);
  }
  max($) {
    return ((this.x = Math.max(this.x, $.x)), (this.y = Math.max(this.y, $.y)), (this.z = Math.max(this.z, $.z)), this);
  }
  clamp($, J) {
    return ((this.x = V6(this.x, $.x, J.x)), (this.y = V6(this.y, $.y, J.y)), (this.z = V6(this.z, $.z, J.z)), this);
  }
  clampScalar($, J) {
    return ((this.x = V6(this.x, $, J)), (this.y = V6(this.y, $, J)), (this.z = V6(this.z, $, J)), this);
  }
  clampLength($, J) {
    let U = this.length();
    return this.divideScalar(U || 1).multiplyScalar(V6(U, $, J));
  }
  floor() {
    return ((this.x = Math.floor(this.x)), (this.y = Math.floor(this.y)), (this.z = Math.floor(this.z)), this);
  }
  ceil() {
    return ((this.x = Math.ceil(this.x)), (this.y = Math.ceil(this.y)), (this.z = Math.ceil(this.z)), this);
  }
  round() {
    return ((this.x = Math.round(this.x)), (this.y = Math.round(this.y)), (this.z = Math.round(this.z)), this);
  }
  roundToZero() {
    return ((this.x = Math.trunc(this.x)), (this.y = Math.trunc(this.y)), (this.z = Math.trunc(this.z)), this);
  }
  negate() {
    return ((this.x = -this.x), (this.y = -this.y), (this.z = -this.z), this);
  }
  dot($) {
    return this.x * $.x + this.y * $.y + this.z * $.z;
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  manhattanLength() {
    return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z);
  }
  normalize() {
    return this.divideScalar(this.length() || 1);
  }
  setLength($) {
    return this.normalize().multiplyScalar($);
  }
  lerp($, J) {
    return ((this.x += ($.x - this.x) * J), (this.y += ($.y - this.y) * J), (this.z += ($.z - this.z) * J), this);
  }
  lerpVectors($, J, U) {
    return ((this.x = $.x + (J.x - $.x) * U), (this.y = $.y + (J.y - $.y) * U), (this.z = $.z + (J.z - $.z) * U), this);
  }
  cross($) {
    return this.crossVectors(this, $);
  }
  crossVectors($, J) {
    let { x: U, y: Q, z: W } = $,
      X = J.x,
      Y = J.y,
      D = J.z;
    return ((this.x = Q * D - W * Y), (this.y = W * X - U * D), (this.z = U * Y - Q * X), this);
  }
  projectOnVector($) {
    let J = $.lengthSq();
    if (J === 0) return this.set(0, 0, 0);
    let U = $.dot(this) / J;
    return this.copy($).multiplyScalar(U);
  }
  projectOnPlane($) {
    return (Rz.copy(this).projectOnVector($), this.sub(Rz));
  }
  reflect($) {
    return this.sub(Rz.copy($).multiplyScalar(2 * this.dot($)));
  }
  angleTo($) {
    let J = Math.sqrt(this.lengthSq() * $.lengthSq());
    if (J === 0) return Math.PI / 2;
    let U = this.dot($) / J;
    return Math.acos(V6(U, -1, 1));
  }
  distanceTo($) {
    return Math.sqrt(this.distanceToSquared($));
  }
  distanceToSquared($) {
    let J = this.x - $.x,
      U = this.y - $.y,
      Q = this.z - $.z;
    return J * J + U * U + Q * Q;
  }
  manhattanDistanceTo($) {
    return Math.abs(this.x - $.x) + Math.abs(this.y - $.y) + Math.abs(this.z - $.z);
  }
  setFromSpherical($) {
    return this.setFromSphericalCoords($.radius, $.phi, $.theta);
  }
  setFromSphericalCoords($, J, U) {
    let Q = Math.sin(J) * $;
    return ((this.x = Q * Math.sin(U)), (this.y = Math.cos(J) * $), (this.z = Q * Math.cos(U)), this);
  }
  setFromCylindrical($) {
    return this.setFromCylindricalCoords($.radius, $.theta, $.y);
  }
  setFromCylindricalCoords($, J, U) {
    return ((this.x = $ * Math.sin(J)), (this.y = U), (this.z = $ * Math.cos(J)), this);
  }
  setFromMatrixPosition($) {
    let J = $.elements;
    return ((this.x = J[12]), (this.y = J[13]), (this.z = J[14]), this);
  }
  setFromMatrixScale($) {
    let J = this.setFromMatrixColumn($, 0).length(),
      U = this.setFromMatrixColumn($, 1).length(),
      Q = this.setFromMatrixColumn($, 2).length();
    return ((this.x = J), (this.y = U), (this.z = Q), this);
  }
  setFromMatrixColumn($, J) {
    return this.fromArray($.elements, J * 4);
  }
  setFromMatrix3Column($, J) {
    return this.fromArray($.elements, J * 3);
  }
  setFromEuler($) {
    return ((this.x = $._x), (this.y = $._y), (this.z = $._z), this);
  }
  setFromColor($) {
    return ((this.x = $.r), (this.y = $.g), (this.z = $.b), this);
  }
  equals($) {
    return $.x === this.x && $.y === this.y && $.z === this.z;
  }
  fromArray($, J = 0) {
    return ((this.x = $[J]), (this.y = $[J + 1]), (this.z = $[J + 2]), this);
  }
  toArray($ = [], J = 0) {
    return (($[J] = this.x), ($[J + 1] = this.y), ($[J + 2] = this.z), $);
  }
  fromBufferAttribute($, J) {
    return ((this.x = $.getX(J)), (this.y = $.getY(J)), (this.z = $.getZ(J)), this);
  }
  random() {
    return ((this.x = Math.random()), (this.y = Math.random()), (this.z = Math.random()), this);
  }
  randomDirection() {
    let $ = Math.random() * Math.PI * 2,
      J = Math.random() * 2 - 1,
      U = Math.sqrt(1 - J * J);
    return ((this.x = U * Math.cos($)), (this.y = J), (this.z = U * Math.sin($)), this);
  }
  *[Symbol.iterator]() {
    (yield this.x, yield this.y, yield this.z);
  }
}
var Rz = new C(),
  nR = new H0();
class X6 {
  static {
    X6.prototype.isMatrix3 = !0;
  }
  constructor($, J, U, Q, W, X, Y, D, H) {
    if (((this.elements = [1, 0, 0, 0, 1, 0, 0, 0, 1]), $ !== void 0)) this.set($, J, U, Q, W, X, Y, D, H);
  }
  set($, J, U, Q, W, X, Y, D, H) {
    let G = this.elements;
    return (
      (G[0] = $),
      (G[1] = Q),
      (G[2] = Y),
      (G[3] = J),
      (G[4] = W),
      (G[5] = D),
      (G[6] = U),
      (G[7] = X),
      (G[8] = H),
      this
    );
  }
  identity() {
    return (this.set(1, 0, 0, 0, 1, 0, 0, 0, 1), this);
  }
  copy($) {
    let J = this.elements,
      U = $.elements;
    return (
      (J[0] = U[0]),
      (J[1] = U[1]),
      (J[2] = U[2]),
      (J[3] = U[3]),
      (J[4] = U[4]),
      (J[5] = U[5]),
      (J[6] = U[6]),
      (J[7] = U[7]),
      (J[8] = U[8]),
      this
    );
  }
  extractBasis($, J, U) {
    return ($.setFromMatrix3Column(this, 0), J.setFromMatrix3Column(this, 1), U.setFromMatrix3Column(this, 2), this);
  }
  setFromMatrix4($) {
    let J = $.elements;
    return (this.set(J[0], J[4], J[8], J[1], J[5], J[9], J[2], J[6], J[10]), this);
  }
  multiply($) {
    return this.multiplyMatrices(this, $);
  }
  premultiply($) {
    return this.multiplyMatrices($, this);
  }
  multiplyMatrices($, J) {
    let U = $.elements,
      Q = J.elements,
      W = this.elements,
      X = U[0],
      Y = U[3],
      D = U[6],
      H = U[1],
      G = U[4],
      K = U[7],
      O = U[2],
      N = U[5],
      F = U[8],
      B = Q[0],
      E = Q[3],
      z = Q[6],
      q = Q[1],
      L = Q[4],
      V = Q[7],
      k = Q[2],
      R = Q[5],
      _ = Q[8];
    return (
      (W[0] = X * B + Y * q + D * k),
      (W[3] = X * E + Y * L + D * R),
      (W[6] = X * z + Y * V + D * _),
      (W[1] = H * B + G * q + K * k),
      (W[4] = H * E + G * L + K * R),
      (W[7] = H * z + G * V + K * _),
      (W[2] = O * B + N * q + F * k),
      (W[5] = O * E + N * L + F * R),
      (W[8] = O * z + N * V + F * _),
      this
    );
  }
  multiplyScalar($) {
    let J = this.elements;
    return (
      (J[0] *= $),
      (J[3] *= $),
      (J[6] *= $),
      (J[1] *= $),
      (J[4] *= $),
      (J[7] *= $),
      (J[2] *= $),
      (J[5] *= $),
      (J[8] *= $),
      this
    );
  }
  determinant() {
    let $ = this.elements,
      J = $[0],
      U = $[1],
      Q = $[2],
      W = $[3],
      X = $[4],
      Y = $[5],
      D = $[6],
      H = $[7],
      G = $[8];
    return J * X * G - J * Y * H - U * W * G + U * Y * D + Q * W * H - Q * X * D;
  }
  invert() {
    let $ = this.elements,
      J = $[0],
      U = $[1],
      Q = $[2],
      W = $[3],
      X = $[4],
      Y = $[5],
      D = $[6],
      H = $[7],
      G = $[8],
      K = G * X - Y * H,
      O = Y * D - G * W,
      N = H * W - X * D,
      F = J * K + U * O + Q * N;
    if (F === 0) return this.set(0, 0, 0, 0, 0, 0, 0, 0, 0);
    let B = 1 / F;
    return (
      ($[0] = K * B),
      ($[1] = (Q * H - G * U) * B),
      ($[2] = (Y * U - Q * X) * B),
      ($[3] = O * B),
      ($[4] = (G * J - Q * D) * B),
      ($[5] = (Q * W - Y * J) * B),
      ($[6] = N * B),
      ($[7] = (U * D - H * J) * B),
      ($[8] = (X * J - U * W) * B),
      this
    );
  }
  transpose() {
    let $,
      J = this.elements;
    return (
      ($ = J[1]),
      (J[1] = J[3]),
      (J[3] = $),
      ($ = J[2]),
      (J[2] = J[6]),
      (J[6] = $),
      ($ = J[5]),
      (J[5] = J[7]),
      (J[7] = $),
      this
    );
  }
  getNormalMatrix($) {
    return this.setFromMatrix4($).invert().transpose();
  }
  transposeIntoArray($) {
    let J = this.elements;
    return (
      ($[0] = J[0]),
      ($[1] = J[3]),
      ($[2] = J[6]),
      ($[3] = J[1]),
      ($[4] = J[4]),
      ($[5] = J[7]),
      ($[6] = J[2]),
      ($[7] = J[5]),
      ($[8] = J[8]),
      this
    );
  }
  setUvTransform($, J, U, Q, W, X, Y) {
    let D = Math.cos(W),
      H = Math.sin(W);
    return (
      this.set(U * D, U * H, -U * (D * X + H * Y) + X + $, -Q * H, Q * D, -Q * (-H * X + D * Y) + Y + J, 0, 0, 1),
      this
    );
  }
  scale($, J) {
    return (this.premultiply(Zz.makeScale($, J)), this);
  }
  rotate($) {
    return (this.premultiply(Zz.makeRotation(-$)), this);
  }
  translate($, J) {
    return (this.premultiply(Zz.makeTranslation($, J)), this);
  }
  makeTranslation($, J) {
    if ($.isVector2) this.set(1, 0, $.x, 0, 1, $.y, 0, 0, 1);
    else this.set(1, 0, $, 0, 1, J, 0, 0, 1);
    return this;
  }
  makeRotation($) {
    let J = Math.cos($),
      U = Math.sin($);
    return (this.set(J, -U, 0, U, J, 0, 0, 0, 1), this);
  }
  makeScale($, J) {
    return (this.set($, 0, 0, 0, J, 0, 0, 0, 1), this);
  }
  equals($) {
    let J = this.elements,
      U = $.elements;
    for (let Q = 0; Q < 9; Q++) if (J[Q] !== U[Q]) return !1;
    return !0;
  }
  fromArray($, J = 0) {
    for (let U = 0; U < 9; U++) this.elements[U] = $[U + J];
    return this;
  }
  toArray($ = [], J = 0) {
    let U = this.elements;
    return (
      ($[J] = U[0]),
      ($[J + 1] = U[1]),
      ($[J + 2] = U[2]),
      ($[J + 3] = U[3]),
      ($[J + 4] = U[4]),
      ($[J + 5] = U[5]),
      ($[J + 6] = U[6]),
      ($[J + 7] = U[7]),
      ($[J + 8] = U[8]),
      $
    );
  }
  clone() {
    return new this.constructor().fromArray(this.elements);
  }
}
var Zz = new X6(),
  iR = new X6().set(0.4123908, 0.3575843, 0.1804808, 0.212639, 0.7151687, 0.0721923, 0.0193308, 0.1191948, 0.9505322),
  oR = new X6().set(
    3.2409699,
    -1.5373832,
    -0.4986108,
    -0.9692436,
    1.8759675,
    0.0415551,
    0.0556301,
    -0.203977,
    1.0569715,
  );
function Fm() {
  let $ = {
      enabled: !0,
      workingColorSpace: "srgb-linear",
      spaces: {},
      convert: function (W, X, Y) {
        if (this.enabled === !1 || X === Y || !X || !Y) return W;
        if (this.spaces[X].transfer === "srgb") ((W.r = Q8(W.r)), (W.g = Q8(W.g)), (W.b = Q8(W.b)));
        if (this.spaces[X].primaries !== this.spaces[Y].primaries)
          (W.applyMatrix3(this.spaces[X].toXYZ), W.applyMatrix3(this.spaces[Y].fromXYZ));
        if (this.spaces[Y].transfer === "srgb") ((W.r = v1(W.r)), (W.g = v1(W.g)), (W.b = v1(W.b)));
        return W;
      },
      workingToColorSpace: function (W, X) {
        return this.convert(W, this.workingColorSpace, X);
      },
      colorSpaceToWorking: function (W, X) {
        return this.convert(W, X, this.workingColorSpace);
      },
      getPrimaries: function (W) {
        return this.spaces[W].primaries;
      },
      getTransfer: function (W) {
        if (W === "") return "linear";
        return this.spaces[W].transfer;
      },
      getToneMappingMode: function (W) {
        return this.spaces[W].outputColorSpaceConfig.toneMappingMode || "standard";
      },
      getLuminanceCoefficients: function (W, X = this.workingColorSpace) {
        return W.fromArray(this.spaces[X].luminanceCoefficients);
      },
      define: function (W) {
        Object.assign(this.spaces, W);
      },
      _getMatrix: function (W, X, Y) {
        return W.copy(this.spaces[X].toXYZ).multiply(this.spaces[Y].fromXYZ);
      },
      _getDrawingBufferColorSpace: function (W) {
        return this.spaces[W].outputColorSpaceConfig.drawingBufferColorSpace;
      },
      _getUnpackColorSpace: function (W = this.workingColorSpace) {
        return this.spaces[W].workingColorSpaceConfig.unpackColorSpace;
      },
      fromWorkingColorSpace: function (W, X) {
        return (
          HG("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),
          $.workingToColorSpace(W, X)
        );
      },
      toWorkingColorSpace: function (W, X) {
        return (
          HG("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),
          $.colorSpaceToWorking(W, X)
        );
      },
    },
    J = [0.64, 0.33, 0.3, 0.6, 0.15, 0.06],
    U = [0.2126, 0.7152, 0.0722],
    Q = [0.3127, 0.329];
  return (
    $.define({
      ["srgb-linear"]: {
        primaries: J,
        whitePoint: Q,
        transfer: "linear",
        toXYZ: iR,
        fromXYZ: oR,
        luminanceCoefficients: U,
        workingColorSpaceConfig: { unpackColorSpace: "srgb" },
        outputColorSpaceConfig: { drawingBufferColorSpace: "srgb" },
      },
      ["srgb"]: {
        primaries: J,
        whitePoint: Q,
        transfer: "srgb",
        toXYZ: iR,
        fromXYZ: oR,
        luminanceCoefficients: U,
        outputColorSpaceConfig: { drawingBufferColorSpace: "srgb" },
      },
    }),
    $
  );
}
var R6 = Fm();
function Q8($) {
  return $ < 0.04045 ? $ * 0.0773993808 : Math.pow($ * 0.9478672986 + 0.0521327014, 2.4);
}
function v1($) {
  return $ < 0.0031308 ? $ * 12.92 : 1.055 * Math.pow($, 0.41666) - 0.055;
}
var B1;
class aB {
  static getDataURL($, J = "image/png") {
    if (/^data:/i.test($.src)) return $.src;
    if (typeof HTMLCanvasElement > "u") return $.src;
    let U;
    if ($ instanceof HTMLCanvasElement) U = $;
    else {
      if (B1 === void 0) B1 = b1("canvas");
      ((B1.width = $.width), (B1.height = $.height));
      let Q = B1.getContext("2d");
      if ($ instanceof ImageData) Q.putImageData($, 0, 0);
      else Q.drawImage($, 0, 0, $.width, $.height);
      U = B1;
    }
    return U.toDataURL(J);
  }
  static sRGBToLinear($) {
    if (
      (typeof HTMLImageElement < "u" && $ instanceof HTMLImageElement) ||
      (typeof HTMLCanvasElement < "u" && $ instanceof HTMLCanvasElement) ||
      (typeof ImageBitmap < "u" && $ instanceof ImageBitmap)
    ) {
      let J = b1("canvas");
      ((J.width = $.width), (J.height = $.height));
      let U = J.getContext("2d");
      U.drawImage($, 0, 0, $.width, $.height);
      let Q = U.getImageData(0, 0, $.width, $.height),
        W = Q.data;
      for (let X = 0; X < W.length; X++) W[X] = Q8(W[X] / 255) * 255;
      return (U.putImageData(Q, 0, 0), J);
    } else if ($.data) {
      let J = $.data.slice(0);
      for (let U = 0; U < J.length; U++)
        if (J instanceof Uint8Array || J instanceof Uint8ClampedArray) J[U] = Math.floor(Q8(J[U] / 255) * 255);
        else J[U] = Q8(J[U]);
      return { data: J, width: $.width, height: $.height };
    } else return (i$("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."), $);
  }
}
var qm = 0;
class OX {
  constructor($ = null) {
    ((this.isSource = !0),
      Object.defineProperty(this, "id", { value: qm++ }),
      (this.uuid = W8()),
      (this.data = $),
      (this.dataReady = !0),
      (this.version = 0));
  }
  getSize($) {
    let J = this.data;
    if (typeof HTMLVideoElement < "u" && J instanceof HTMLVideoElement) $.set(J.videoWidth, J.videoHeight, 0);
    else if (typeof VideoFrame < "u" && J instanceof VideoFrame) $.set(J.displayWidth, J.displayHeight, 0);
    else if (J !== null) $.set(J.width, J.height, J.depth || 0);
    else $.set(0, 0, 0);
    return $;
  }
  set needsUpdate($) {
    if ($ === !0) this.version++;
  }
  toJSON($) {
    let J = $ === void 0 || typeof $ === "string";
    if (!J && $.images[this.uuid] !== void 0) return $.images[this.uuid];
    let U = { uuid: this.uuid, url: "" },
      Q = this.data;
    if (Q !== null) {
      let W;
      if (Array.isArray(Q)) {
        W = [];
        for (let X = 0, Y = Q.length; X < Y; X++)
          if (Q[X].isDataTexture) W.push(Pz(Q[X].image));
          else W.push(Pz(Q[X]));
      } else W = Pz(Q);
      U.url = W;
    }
    if (!J) $.images[this.uuid] = U;
    return U;
  }
}
function Pz($) {
  if (
    (typeof HTMLImageElement < "u" && $ instanceof HTMLImageElement) ||
    (typeof HTMLCanvasElement < "u" && $ instanceof HTMLCanvasElement) ||
    (typeof ImageBitmap < "u" && $ instanceof ImageBitmap)
  )
    return aB.getDataURL($);
  else if ($.data) return { data: Array.from($.data), width: $.width, height: $.height, type: $.data.constructor.name };
  else return (i$("Texture: Unable to serialize Texture."), {});
}
var zm = 0,
  _z = new C();
class j0 extends vU {
  constructor(
    $ = j0.DEFAULT_IMAGE,
    J = j0.DEFAULT_MAPPING,
    U = 1001,
    Q = 1001,
    W = 1006,
    X = 1008,
    Y = 1023,
    D = 1009,
    H = j0.DEFAULT_ANISOTROPY,
    G = "",
  ) {
    super();
    ((this.isTexture = !0),
      Object.defineProperty(this, "id", { value: zm++ }),
      (this.uuid = W8()),
      (this.name = ""),
      (this.source = new OX($)),
      (this.mipmaps = []),
      (this.mapping = J),
      (this.channel = 0),
      (this.wrapS = U),
      (this.wrapT = Q),
      (this.magFilter = W),
      (this.minFilter = X),
      (this.anisotropy = H),
      (this.format = Y),
      (this.internalFormat = null),
      (this.type = D),
      (this.offset = new d$(0, 0)),
      (this.repeat = new d$(1, 1)),
      (this.center = new d$(0, 0)),
      (this.rotation = 0),
      (this.matrixAutoUpdate = !0),
      (this.matrix = new X6()),
      (this.generateMipmaps = !0),
      (this.premultiplyAlpha = !1),
      (this.flipY = !0),
      (this.unpackAlignment = 4),
      (this.colorSpace = G),
      (this.userData = {}),
      (this.updateRanges = []),
      (this.version = 0),
      (this.onUpdate = null),
      (this.renderTarget = null),
      (this.isRenderTargetTexture = !1),
      (this.isArrayTexture = $ && $.depth && $.depth > 1 ? !0 : !1),
      (this.pmremVersion = 0),
      (this.normalized = !1));
  }
  get width() {
    return this.source.getSize(_z).x;
  }
  get height() {
    return this.source.getSize(_z).y;
  }
  get depth() {
    return this.source.getSize(_z).z;
  }
  get image() {
    return this.source.data;
  }
  set image($) {
    this.source.data = $;
  }
  updateMatrix() {
    this.matrix.setUvTransform(
      this.offset.x,
      this.offset.y,
      this.repeat.x,
      this.repeat.y,
      this.rotation,
      this.center.x,
      this.center.y,
    );
  }
  addUpdateRange($, J) {
    this.updateRanges.push({ start: $, count: J });
  }
  clearUpdateRanges() {
    this.updateRanges.length = 0;
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy($) {
    return (
      (this.name = $.name),
      (this.source = $.source),
      (this.mipmaps = $.mipmaps.slice(0)),
      (this.mapping = $.mapping),
      (this.channel = $.channel),
      (this.wrapS = $.wrapS),
      (this.wrapT = $.wrapT),
      (this.magFilter = $.magFilter),
      (this.minFilter = $.minFilter),
      (this.anisotropy = $.anisotropy),
      (this.format = $.format),
      (this.internalFormat = $.internalFormat),
      (this.type = $.type),
      (this.normalized = $.normalized),
      this.offset.copy($.offset),
      this.repeat.copy($.repeat),
      this.center.copy($.center),
      (this.rotation = $.rotation),
      (this.matrixAutoUpdate = $.matrixAutoUpdate),
      this.matrix.copy($.matrix),
      (this.generateMipmaps = $.generateMipmaps),
      (this.premultiplyAlpha = $.premultiplyAlpha),
      (this.flipY = $.flipY),
      (this.unpackAlignment = $.unpackAlignment),
      (this.colorSpace = $.colorSpace),
      (this.renderTarget = $.renderTarget),
      (this.isRenderTargetTexture = $.isRenderTargetTexture),
      (this.isArrayTexture = $.isArrayTexture),
      (this.userData = JSON.parse(JSON.stringify($.userData))),
      (this.needsUpdate = !0),
      this
    );
  }
  setValues($) {
    for (let J in $) {
      let U = $[J];
      if (U === void 0) {
        i$(`Texture.setValues(): parameter '${J}' has value of undefined.`);
        continue;
      }
      let Q = this[J];
      if (Q === void 0) {
        i$(`Texture.setValues(): property '${J}' does not exist.`);
        continue;
      }
      if (Q && U && Q.isVector2 && U.isVector2) Q.copy(U);
      else if (Q && U && Q.isVector3 && U.isVector3) Q.copy(U);
      else if (Q && U && Q.isMatrix3 && U.isMatrix3) Q.copy(U);
      else this[J] = U;
    }
  }
  toJSON($) {
    let J = $ === void 0 || typeof $ === "string";
    if (!J && $.textures[this.uuid] !== void 0) return $.textures[this.uuid];
    let U = {
      metadata: { version: 4.7, type: "Texture", generator: "Texture.toJSON" },
      uuid: this.uuid,
      name: this.name,
      image: this.source.toJSON($).uuid,
      mapping: this.mapping,
      channel: this.channel,
      repeat: [this.repeat.x, this.repeat.y],
      offset: [this.offset.x, this.offset.y],
      center: [this.center.x, this.center.y],
      rotation: this.rotation,
      wrap: [this.wrapS, this.wrapT],
      format: this.format,
      internalFormat: this.internalFormat,
      type: this.type,
      normalized: this.normalized,
      colorSpace: this.colorSpace,
      minFilter: this.minFilter,
      magFilter: this.magFilter,
      anisotropy: this.anisotropy,
      flipY: this.flipY,
      generateMipmaps: this.generateMipmaps,
      premultiplyAlpha: this.premultiplyAlpha,
      unpackAlignment: this.unpackAlignment,
    };
    if (Object.keys(this.userData).length > 0) U.userData = this.userData;
    if (!J) $.textures[this.uuid] = U;
    return U;
  }
  dispose() {
    this.dispatchEvent({ type: "dispose" });
  }
  transformUv($) {
    if (this.mapping !== 300) return $;
    if (($.applyMatrix3(this.matrix), $.x < 0 || $.x > 1))
      switch (this.wrapS) {
        case 1000:
          $.x = $.x - Math.floor($.x);
          break;
        case 1001:
          $.x = $.x < 0 ? 0 : 1;
          break;
        case 1002:
          if (Math.abs(Math.floor($.x) % 2) === 1) $.x = Math.ceil($.x) - $.x;
          else $.x = $.x - Math.floor($.x);
          break;
      }
    if ($.y < 0 || $.y > 1)
      switch (this.wrapT) {
        case 1000:
          $.y = $.y - Math.floor($.y);
          break;
        case 1001:
          $.y = $.y < 0 ? 0 : 1;
          break;
        case 1002:
          if (Math.abs(Math.floor($.y) % 2) === 1) $.y = Math.ceil($.y) - $.y;
          else $.y = $.y - Math.floor($.y);
          break;
      }
    if (this.flipY) $.y = 1 - $.y;
    return $;
  }
  set needsUpdate($) {
    if ($ === !0) (this.version++, (this.source.needsUpdate = !0));
  }
  set needsPMREMUpdate($) {
    if ($ === !0) this.pmremVersion++;
  }
}
j0.DEFAULT_IMAGE = null;
j0.DEFAULT_MAPPING = 300;
j0.DEFAULT_ANISOTROPY = 1;
class q0 {
  static {
    q0.prototype.isVector4 = !0;
  }
  constructor($ = 0, J = 0, U = 0, Q = 1) {
    ((this.x = $), (this.y = J), (this.z = U), (this.w = Q));
  }
  get width() {
    return this.z;
  }
  set width($) {
    this.z = $;
  }
  get height() {
    return this.w;
  }
  set height($) {
    this.w = $;
  }
  set($, J, U, Q) {
    return ((this.x = $), (this.y = J), (this.z = U), (this.w = Q), this);
  }
  setScalar($) {
    return ((this.x = $), (this.y = $), (this.z = $), (this.w = $), this);
  }
  setX($) {
    return ((this.x = $), this);
  }
  setY($) {
    return ((this.y = $), this);
  }
  setZ($) {
    return ((this.z = $), this);
  }
  setW($) {
    return ((this.w = $), this);
  }
  setComponent($, J) {
    switch ($) {
      case 0:
        this.x = J;
        break;
      case 1:
        this.y = J;
        break;
      case 2:
        this.z = J;
        break;
      case 3:
        this.w = J;
        break;
      default:
        throw Error("index is out of range: " + $);
    }
    return this;
  }
  getComponent($) {
    switch ($) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      case 2:
        return this.z;
      case 3:
        return this.w;
      default:
        throw Error("index is out of range: " + $);
    }
  }
  clone() {
    return new this.constructor(this.x, this.y, this.z, this.w);
  }
  copy($) {
    return ((this.x = $.x), (this.y = $.y), (this.z = $.z), (this.w = $.w !== void 0 ? $.w : 1), this);
  }
  add($) {
    return ((this.x += $.x), (this.y += $.y), (this.z += $.z), (this.w += $.w), this);
  }
  addScalar($) {
    return ((this.x += $), (this.y += $), (this.z += $), (this.w += $), this);
  }
  addVectors($, J) {
    return ((this.x = $.x + J.x), (this.y = $.y + J.y), (this.z = $.z + J.z), (this.w = $.w + J.w), this);
  }
  addScaledVector($, J) {
    return ((this.x += $.x * J), (this.y += $.y * J), (this.z += $.z * J), (this.w += $.w * J), this);
  }
  sub($) {
    return ((this.x -= $.x), (this.y -= $.y), (this.z -= $.z), (this.w -= $.w), this);
  }
  subScalar($) {
    return ((this.x -= $), (this.y -= $), (this.z -= $), (this.w -= $), this);
  }
  subVectors($, J) {
    return ((this.x = $.x - J.x), (this.y = $.y - J.y), (this.z = $.z - J.z), (this.w = $.w - J.w), this);
  }
  multiply($) {
    return ((this.x *= $.x), (this.y *= $.y), (this.z *= $.z), (this.w *= $.w), this);
  }
  multiplyScalar($) {
    return ((this.x *= $), (this.y *= $), (this.z *= $), (this.w *= $), this);
  }
  applyMatrix4($) {
    let J = this.x,
      U = this.y,
      Q = this.z,
      W = this.w,
      X = $.elements;
    return (
      (this.x = X[0] * J + X[4] * U + X[8] * Q + X[12] * W),
      (this.y = X[1] * J + X[5] * U + X[9] * Q + X[13] * W),
      (this.z = X[2] * J + X[6] * U + X[10] * Q + X[14] * W),
      (this.w = X[3] * J + X[7] * U + X[11] * Q + X[15] * W),
      this
    );
  }
  divide($) {
    return ((this.x /= $.x), (this.y /= $.y), (this.z /= $.z), (this.w /= $.w), this);
  }
  divideScalar($) {
    return this.multiplyScalar(1 / $);
  }
  setAxisAngleFromQuaternion($) {
    this.w = 2 * Math.acos($.w);
    let J = Math.sqrt(1 - $.w * $.w);
    if (J < 0.0001) ((this.x = 1), (this.y = 0), (this.z = 0));
    else ((this.x = $.x / J), (this.y = $.y / J), (this.z = $.z / J));
    return this;
  }
  setAxisAngleFromRotationMatrix($) {
    let J,
      U,
      Q,
      W,
      X = 0.01,
      Y = 0.1,
      D = $.elements,
      H = D[0],
      G = D[4],
      K = D[8],
      O = D[1],
      N = D[5],
      F = D[9],
      B = D[2],
      E = D[6],
      z = D[10];
    if (Math.abs(G - O) < 0.01 && Math.abs(K - B) < 0.01 && Math.abs(F - E) < 0.01) {
      if (Math.abs(G + O) < 0.1 && Math.abs(K + B) < 0.1 && Math.abs(F + E) < 0.1 && Math.abs(H + N + z - 3) < 0.1)
        return (this.set(1, 0, 0, 0), this);
      J = Math.PI;
      let L = (H + 1) / 2,
        V = (N + 1) / 2,
        k = (z + 1) / 2,
        R = (G + O) / 4,
        _ = (K + B) / 4,
        S = (F + E) / 4;
      if (L > V && L > k)
        if (L < 0.01) ((U = 0), (Q = 0.707106781), (W = 0.707106781));
        else ((U = Math.sqrt(L)), (Q = R / U), (W = _ / U));
      else if (V > k)
        if (V < 0.01) ((U = 0.707106781), (Q = 0), (W = 0.707106781));
        else ((Q = Math.sqrt(V)), (U = R / Q), (W = S / Q));
      else if (k < 0.01) ((U = 0.707106781), (Q = 0.707106781), (W = 0));
      else ((W = Math.sqrt(k)), (U = _ / W), (Q = S / W));
      return (this.set(U, Q, W, J), this);
    }
    let q = Math.sqrt((E - F) * (E - F) + (K - B) * (K - B) + (O - G) * (O - G));
    if (Math.abs(q) < 0.001) q = 1;
    return (
      (this.x = (E - F) / q),
      (this.y = (K - B) / q),
      (this.z = (O - G) / q),
      (this.w = Math.acos((H + N + z - 1) / 2)),
      this
    );
  }
  setFromMatrixPosition($) {
    let J = $.elements;
    return ((this.x = J[12]), (this.y = J[13]), (this.z = J[14]), (this.w = J[15]), this);
  }
  min($) {
    return (
      (this.x = Math.min(this.x, $.x)),
      (this.y = Math.min(this.y, $.y)),
      (this.z = Math.min(this.z, $.z)),
      (this.w = Math.min(this.w, $.w)),
      this
    );
  }
  max($) {
    return (
      (this.x = Math.max(this.x, $.x)),
      (this.y = Math.max(this.y, $.y)),
      (this.z = Math.max(this.z, $.z)),
      (this.w = Math.max(this.w, $.w)),
      this
    );
  }
  clamp($, J) {
    return (
      (this.x = V6(this.x, $.x, J.x)),
      (this.y = V6(this.y, $.y, J.y)),
      (this.z = V6(this.z, $.z, J.z)),
      (this.w = V6(this.w, $.w, J.w)),
      this
    );
  }
  clampScalar($, J) {
    return (
      (this.x = V6(this.x, $, J)),
      (this.y = V6(this.y, $, J)),
      (this.z = V6(this.z, $, J)),
      (this.w = V6(this.w, $, J)),
      this
    );
  }
  clampLength($, J) {
    let U = this.length();
    return this.divideScalar(U || 1).multiplyScalar(V6(U, $, J));
  }
  floor() {
    return (
      (this.x = Math.floor(this.x)),
      (this.y = Math.floor(this.y)),
      (this.z = Math.floor(this.z)),
      (this.w = Math.floor(this.w)),
      this
    );
  }
  ceil() {
    return (
      (this.x = Math.ceil(this.x)),
      (this.y = Math.ceil(this.y)),
      (this.z = Math.ceil(this.z)),
      (this.w = Math.ceil(this.w)),
      this
    );
  }
  round() {
    return (
      (this.x = Math.round(this.x)),
      (this.y = Math.round(this.y)),
      (this.z = Math.round(this.z)),
      (this.w = Math.round(this.w)),
      this
    );
  }
  roundToZero() {
    return (
      (this.x = Math.trunc(this.x)),
      (this.y = Math.trunc(this.y)),
      (this.z = Math.trunc(this.z)),
      (this.w = Math.trunc(this.w)),
      this
    );
  }
  negate() {
    return ((this.x = -this.x), (this.y = -this.y), (this.z = -this.z), (this.w = -this.w), this);
  }
  dot($) {
    return this.x * $.x + this.y * $.y + this.z * $.z + this.w * $.w;
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
  }
  manhattanLength() {
    return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z) + Math.abs(this.w);
  }
  normalize() {
    return this.divideScalar(this.length() || 1);
  }
  setLength($) {
    return this.normalize().multiplyScalar($);
  }
  lerp($, J) {
    return (
      (this.x += ($.x - this.x) * J),
      (this.y += ($.y - this.y) * J),
      (this.z += ($.z - this.z) * J),
      (this.w += ($.w - this.w) * J),
      this
    );
  }
  lerpVectors($, J, U) {
    return (
      (this.x = $.x + (J.x - $.x) * U),
      (this.y = $.y + (J.y - $.y) * U),
      (this.z = $.z + (J.z - $.z) * U),
      (this.w = $.w + (J.w - $.w) * U),
      this
    );
  }
  equals($) {
    return $.x === this.x && $.y === this.y && $.z === this.z && $.w === this.w;
  }
  fromArray($, J = 0) {
    return ((this.x = $[J]), (this.y = $[J + 1]), (this.z = $[J + 2]), (this.w = $[J + 3]), this);
  }
  toArray($ = [], J = 0) {
    return (($[J] = this.x), ($[J + 1] = this.y), ($[J + 2] = this.z), ($[J + 3] = this.w), $);
  }
  fromBufferAttribute($, J) {
    return ((this.x = $.getX(J)), (this.y = $.getY(J)), (this.z = $.getZ(J)), (this.w = $.getW(J)), this);
  }
  random() {
    return (
      (this.x = Math.random()),
      (this.y = Math.random()),
      (this.z = Math.random()),
      (this.w = Math.random()),
      this
    );
  }
  *[Symbol.iterator]() {
    (yield this.x, yield this.y, yield this.z, yield this.w);
  }
}
class tB extends vU {
  constructor($ = 1, J = 1, U = {}) {
    super();
    ((U = Object.assign(
      {
        generateMipmaps: !1,
        internalFormat: null,
        minFilter: 1006,
        depthBuffer: !0,
        stencilBuffer: !1,
        resolveDepthBuffer: !0,
        resolveStencilBuffer: !0,
        depthTexture: null,
        samples: 0,
        count: 1,
        depth: 1,
        multiview: !1,
      },
      U,
    )),
      (this.isRenderTarget = !0),
      (this.width = $),
      (this.height = J),
      (this.depth = U.depth),
      (this.scissor = new q0(0, 0, $, J)),
      (this.scissorTest = !1),
      (this.viewport = new q0(0, 0, $, J)),
      (this.textures = []));
    let Q = { width: $, height: J, depth: U.depth },
      W = new j0(Q),
      X = U.count;
    for (let Y = 0; Y < X; Y++)
      ((this.textures[Y] = W.clone()),
        (this.textures[Y].isRenderTargetTexture = !0),
        (this.textures[Y].renderTarget = this));
    (this._setTextureOptions(U),
      (this.depthBuffer = U.depthBuffer),
      (this.stencilBuffer = U.stencilBuffer),
      (this.resolveDepthBuffer = U.resolveDepthBuffer),
      (this.resolveStencilBuffer = U.resolveStencilBuffer),
      (this._depthTexture = null),
      (this.depthTexture = U.depthTexture),
      (this.samples = U.samples),
      (this.multiview = U.multiview));
  }
  _setTextureOptions($ = {}) {
    let J = { minFilter: 1006, generateMipmaps: !1, flipY: !1, internalFormat: null };
    if ($.mapping !== void 0) J.mapping = $.mapping;
    if ($.wrapS !== void 0) J.wrapS = $.wrapS;
    if ($.wrapT !== void 0) J.wrapT = $.wrapT;
    if ($.wrapR !== void 0) J.wrapR = $.wrapR;
    if ($.magFilter !== void 0) J.magFilter = $.magFilter;
    if ($.minFilter !== void 0) J.minFilter = $.minFilter;
    if ($.format !== void 0) J.format = $.format;
    if ($.type !== void 0) J.type = $.type;
    if ($.anisotropy !== void 0) J.anisotropy = $.anisotropy;
    if ($.colorSpace !== void 0) J.colorSpace = $.colorSpace;
    if ($.flipY !== void 0) J.flipY = $.flipY;
    if ($.generateMipmaps !== void 0) J.generateMipmaps = $.generateMipmaps;
    if ($.internalFormat !== void 0) J.internalFormat = $.internalFormat;
    for (let U = 0; U < this.textures.length; U++) this.textures[U].setValues(J);
  }
  get texture() {
    return this.textures[0];
  }
  set texture($) {
    this.textures[0] = $;
  }
  set depthTexture($) {
    if (this._depthTexture !== null) this._depthTexture.renderTarget = null;
    if ($ !== null) $.renderTarget = this;
    this._depthTexture = $;
  }
  get depthTexture() {
    return this._depthTexture;
  }
  setSize($, J, U = 1) {
    if (this.width !== $ || this.height !== J || this.depth !== U) {
      ((this.width = $), (this.height = J), (this.depth = U));
      for (let Q = 0, W = this.textures.length; Q < W; Q++)
        if (
          ((this.textures[Q].image.width = $),
          (this.textures[Q].image.height = J),
          (this.textures[Q].image.depth = U),
          this.textures[Q].isData3DTexture !== !0)
        )
          this.textures[Q].isArrayTexture = this.textures[Q].image.depth > 1;
      this.dispose();
    }
    (this.viewport.set(0, 0, $, J), this.scissor.set(0, 0, $, J));
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy($) {
    ((this.width = $.width),
      (this.height = $.height),
      (this.depth = $.depth),
      this.scissor.copy($.scissor),
      (this.scissorTest = $.scissorTest),
      this.viewport.copy($.viewport),
      (this.textures.length = 0));
    for (let J = 0, U = $.textures.length; J < U; J++) {
      ((this.textures[J] = $.textures[J].clone()),
        (this.textures[J].isRenderTargetTexture = !0),
        (this.textures[J].renderTarget = this));
      let Q = Object.assign({}, $.textures[J].image);
      this.textures[J].source = new OX(Q);
    }
    if (
      ((this.depthBuffer = $.depthBuffer),
      (this.stencilBuffer = $.stencilBuffer),
      (this.resolveDepthBuffer = $.resolveDepthBuffer),
      (this.resolveStencilBuffer = $.resolveStencilBuffer),
      $.depthTexture !== null)
    )
      this.depthTexture = $.depthTexture.clone();
    return ((this.samples = $.samples), (this.multiview = $.multiview), this);
  }
  dispose() {
    this.dispatchEvent({ type: "dispose" });
  }
}
class pJ extends tB {
  constructor($ = 1, J = 1, U = {}) {
    super($, J, U);
    this.isWebGLRenderTarget = !0;
  }
}
class kG extends j0 {
  constructor($ = null, J = 1, U = 1, Q = 1) {
    super(null);
    ((this.isDataArrayTexture = !0),
      (this.image = { data: $, width: J, height: U, depth: Q }),
      (this.magFilter = 1003),
      (this.minFilter = 1003),
      (this.wrapR = 1001),
      (this.generateMipmaps = !1),
      (this.flipY = !1),
      (this.unpackAlignment = 1),
      (this.layerUpdates = new Set()));
  }
  addLayerUpdate($) {
    this.layerUpdates.add($);
  }
  clearLayerUpdates() {
    this.layerUpdates.clear();
  }
}
class eB extends j0 {
  constructor($ = null, J = 1, U = 1, Q = 1) {
    super(null);
    ((this.isData3DTexture = !0),
      (this.image = { data: $, width: J, height: U, depth: Q }),
      (this.magFilter = 1003),
      (this.minFilter = 1003),
      (this.wrapR = 1001),
      (this.generateMipmaps = !1),
      (this.flipY = !1),
      (this.unpackAlignment = 1));
  }
}
class x6 {
  static {
    x6.prototype.isMatrix4 = !0;
  }
  constructor($, J, U, Q, W, X, Y, D, H, G, K, O, N, F, B, E) {
    if (((this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), $ !== void 0))
      this.set($, J, U, Q, W, X, Y, D, H, G, K, O, N, F, B, E);
  }
  set($, J, U, Q, W, X, Y, D, H, G, K, O, N, F, B, E) {
    let z = this.elements;
    return (
      (z[0] = $),
      (z[4] = J),
      (z[8] = U),
      (z[12] = Q),
      (z[1] = W),
      (z[5] = X),
      (z[9] = Y),
      (z[13] = D),
      (z[2] = H),
      (z[6] = G),
      (z[10] = K),
      (z[14] = O),
      (z[3] = N),
      (z[7] = F),
      (z[11] = B),
      (z[15] = E),
      this
    );
  }
  identity() {
    return (this.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1), this);
  }
  clone() {
    return new x6().fromArray(this.elements);
  }
  copy($) {
    let J = this.elements,
      U = $.elements;
    return (
      (J[0] = U[0]),
      (J[1] = U[1]),
      (J[2] = U[2]),
      (J[3] = U[3]),
      (J[4] = U[4]),
      (J[5] = U[5]),
      (J[6] = U[6]),
      (J[7] = U[7]),
      (J[8] = U[8]),
      (J[9] = U[9]),
      (J[10] = U[10]),
      (J[11] = U[11]),
      (J[12] = U[12]),
      (J[13] = U[13]),
      (J[14] = U[14]),
      (J[15] = U[15]),
      this
    );
  }
  copyPosition($) {
    let J = this.elements,
      U = $.elements;
    return ((J[12] = U[12]), (J[13] = U[13]), (J[14] = U[14]), this);
  }
  setFromMatrix3($) {
    let J = $.elements;
    return (this.set(J[0], J[3], J[6], 0, J[1], J[4], J[7], 0, J[2], J[5], J[8], 0, 0, 0, 0, 1), this);
  }
  extractBasis($, J, U) {
    if (this.determinant() === 0) return ($.set(1, 0, 0), J.set(0, 1, 0), U.set(0, 0, 1), this);
    return ($.setFromMatrixColumn(this, 0), J.setFromMatrixColumn(this, 1), U.setFromMatrixColumn(this, 2), this);
  }
  makeBasis($, J, U) {
    return (this.set($.x, J.x, U.x, 0, $.y, J.y, U.y, 0, $.z, J.z, U.z, 0, 0, 0, 0, 1), this);
  }
  extractRotation($) {
    if ($.determinant() === 0) return this.identity();
    let J = this.elements,
      U = $.elements,
      Q = 1 / E1.setFromMatrixColumn($, 0).length(),
      W = 1 / E1.setFromMatrixColumn($, 1).length(),
      X = 1 / E1.setFromMatrixColumn($, 2).length();
    return (
      (J[0] = U[0] * Q),
      (J[1] = U[1] * Q),
      (J[2] = U[2] * Q),
      (J[3] = 0),
      (J[4] = U[4] * W),
      (J[5] = U[5] * W),
      (J[6] = U[6] * W),
      (J[7] = 0),
      (J[8] = U[8] * X),
      (J[9] = U[9] * X),
      (J[10] = U[10] * X),
      (J[11] = 0),
      (J[12] = 0),
      (J[13] = 0),
      (J[14] = 0),
      (J[15] = 1),
      this
    );
  }
  makeRotationFromEuler($) {
    let J = this.elements,
      U = $.x,
      Q = $.y,
      W = $.z,
      X = Math.cos(U),
      Y = Math.sin(U),
      D = Math.cos(Q),
      H = Math.sin(Q),
      G = Math.cos(W),
      K = Math.sin(W);
    if ($.order === "XYZ") {
      let O = X * G,
        N = X * K,
        F = Y * G,
        B = Y * K;
      ((J[0] = D * G),
        (J[4] = -D * K),
        (J[8] = H),
        (J[1] = N + F * H),
        (J[5] = O - B * H),
        (J[9] = -Y * D),
        (J[2] = B - O * H),
        (J[6] = F + N * H),
        (J[10] = X * D));
    } else if ($.order === "YXZ") {
      let O = D * G,
        N = D * K,
        F = H * G,
        B = H * K;
      ((J[0] = O + B * Y),
        (J[4] = F * Y - N),
        (J[8] = X * H),
        (J[1] = X * K),
        (J[5] = X * G),
        (J[9] = -Y),
        (J[2] = N * Y - F),
        (J[6] = B + O * Y),
        (J[10] = X * D));
    } else if ($.order === "ZXY") {
      let O = D * G,
        N = D * K,
        F = H * G,
        B = H * K;
      ((J[0] = O - B * Y),
        (J[4] = -X * K),
        (J[8] = F + N * Y),
        (J[1] = N + F * Y),
        (J[5] = X * G),
        (J[9] = B - O * Y),
        (J[2] = -X * H),
        (J[6] = Y),
        (J[10] = X * D));
    } else if ($.order === "ZYX") {
      let O = X * G,
        N = X * K,
        F = Y * G,
        B = Y * K;
      ((J[0] = D * G),
        (J[4] = F * H - N),
        (J[8] = O * H + B),
        (J[1] = D * K),
        (J[5] = B * H + O),
        (J[9] = N * H - F),
        (J[2] = -H),
        (J[6] = Y * D),
        (J[10] = X * D));
    } else if ($.order === "YZX") {
      let O = X * D,
        N = X * H,
        F = Y * D,
        B = Y * H;
      ((J[0] = D * G),
        (J[4] = B - O * K),
        (J[8] = F * K + N),
        (J[1] = K),
        (J[5] = X * G),
        (J[9] = -Y * G),
        (J[2] = -H * G),
        (J[6] = N * K + F),
        (J[10] = O - B * K));
    } else if ($.order === "XZY") {
      let O = X * D,
        N = X * H,
        F = Y * D,
        B = Y * H;
      ((J[0] = D * G),
        (J[4] = -K),
        (J[8] = H * G),
        (J[1] = O * K + B),
        (J[5] = X * G),
        (J[9] = N * K - F),
        (J[2] = F * K - N),
        (J[6] = Y * G),
        (J[10] = B * K + O));
    }
    return ((J[3] = 0), (J[7] = 0), (J[11] = 0), (J[12] = 0), (J[13] = 0), (J[14] = 0), (J[15] = 1), this);
  }
  makeRotationFromQuaternion($) {
    return this.compose(Bm, $, Em);
  }
  lookAt($, J, U) {
    let Q = this.elements;
    if ((TJ.subVectors($, J), TJ.lengthSq() === 0)) TJ.z = 1;
    if ((TJ.normalize(), c8.crossVectors(U, TJ), c8.lengthSq() === 0)) {
      if (Math.abs(U.z) === 1) TJ.x += 0.0001;
      else TJ.z += 0.0001;
      (TJ.normalize(), c8.crossVectors(U, TJ));
    }
    return (
      c8.normalize(),
      f5.crossVectors(TJ, c8),
      (Q[0] = c8.x),
      (Q[4] = f5.x),
      (Q[8] = TJ.x),
      (Q[1] = c8.y),
      (Q[5] = f5.y),
      (Q[9] = TJ.y),
      (Q[2] = c8.z),
      (Q[6] = f5.z),
      (Q[10] = TJ.z),
      this
    );
  }
  multiply($) {
    return this.multiplyMatrices(this, $);
  }
  premultiply($) {
    return this.multiplyMatrices($, this);
  }
  multiplyMatrices($, J) {
    let U = $.elements,
      Q = J.elements,
      W = this.elements,
      X = U[0],
      Y = U[4],
      D = U[8],
      H = U[12],
      G = U[1],
      K = U[5],
      O = U[9],
      N = U[13],
      F = U[2],
      B = U[6],
      E = U[10],
      z = U[14],
      q = U[3],
      L = U[7],
      V = U[11],
      k = U[15],
      R = Q[0],
      _ = Q[4],
      S = Q[8],
      w = Q[12],
      M = Q[1],
      m = Q[5],
      P = Q[9],
      u = Q[13],
      n = Q[2],
      b = Q[6],
      i = Q[10],
      x = Q[14],
      l = Q[3],
      r = Q[7],
      G$ = Q[11],
      k$ = Q[15];
    return (
      (W[0] = X * R + Y * M + D * n + H * l),
      (W[4] = X * _ + Y * m + D * b + H * r),
      (W[8] = X * S + Y * P + D * i + H * G$),
      (W[12] = X * w + Y * u + D * x + H * k$),
      (W[1] = G * R + K * M + O * n + N * l),
      (W[5] = G * _ + K * m + O * b + N * r),
      (W[9] = G * S + K * P + O * i + N * G$),
      (W[13] = G * w + K * u + O * x + N * k$),
      (W[2] = F * R + B * M + E * n + z * l),
      (W[6] = F * _ + B * m + E * b + z * r),
      (W[10] = F * S + B * P + E * i + z * G$),
      (W[14] = F * w + B * u + E * x + z * k$),
      (W[3] = q * R + L * M + V * n + k * l),
      (W[7] = q * _ + L * m + V * b + k * r),
      (W[11] = q * S + L * P + V * i + k * G$),
      (W[15] = q * w + L * u + V * x + k * k$),
      this
    );
  }
  multiplyScalar($) {
    let J = this.elements;
    return (
      (J[0] *= $),
      (J[4] *= $),
      (J[8] *= $),
      (J[12] *= $),
      (J[1] *= $),
      (J[5] *= $),
      (J[9] *= $),
      (J[13] *= $),
      (J[2] *= $),
      (J[6] *= $),
      (J[10] *= $),
      (J[14] *= $),
      (J[3] *= $),
      (J[7] *= $),
      (J[11] *= $),
      (J[15] *= $),
      this
    );
  }
  determinant() {
    let $ = this.elements,
      J = $[0],
      U = $[4],
      Q = $[8],
      W = $[12],
      X = $[1],
      Y = $[5],
      D = $[9],
      H = $[13],
      G = $[2],
      K = $[6],
      O = $[10],
      N = $[14],
      F = $[3],
      B = $[7],
      E = $[11],
      z = $[15],
      q = D * N - H * O,
      L = Y * N - H * K,
      V = Y * O - D * K,
      k = X * N - H * G,
      R = X * O - D * G,
      _ = X * K - Y * G;
    return (
      J * (B * q - E * L + z * V) -
      U * (F * q - E * k + z * R) +
      Q * (F * L - B * k + z * _) -
      W * (F * V - B * R + E * _)
    );
  }
  transpose() {
    let $ = this.elements,
      J;
    return (
      (J = $[1]),
      ($[1] = $[4]),
      ($[4] = J),
      (J = $[2]),
      ($[2] = $[8]),
      ($[8] = J),
      (J = $[6]),
      ($[6] = $[9]),
      ($[9] = J),
      (J = $[3]),
      ($[3] = $[12]),
      ($[12] = J),
      (J = $[7]),
      ($[7] = $[13]),
      ($[13] = J),
      (J = $[11]),
      ($[11] = $[14]),
      ($[14] = J),
      this
    );
  }
  setPosition($, J, U) {
    let Q = this.elements;
    if ($.isVector3) ((Q[12] = $.x), (Q[13] = $.y), (Q[14] = $.z));
    else ((Q[12] = $), (Q[13] = J), (Q[14] = U));
    return this;
  }
  invert() {
    let $ = this.elements,
      J = $[0],
      U = $[1],
      Q = $[2],
      W = $[3],
      X = $[4],
      Y = $[5],
      D = $[6],
      H = $[7],
      G = $[8],
      K = $[9],
      O = $[10],
      N = $[11],
      F = $[12],
      B = $[13],
      E = $[14],
      z = $[15],
      q = J * Y - U * X,
      L = J * D - Q * X,
      V = J * H - W * X,
      k = U * D - Q * Y,
      R = U * H - W * Y,
      _ = Q * H - W * D,
      S = G * B - K * F,
      w = G * E - O * F,
      M = G * z - N * F,
      m = K * E - O * B,
      P = K * z - N * B,
      u = O * z - N * E,
      n = q * u - L * P + V * m + k * M - R * w + _ * S;
    if (n === 0) return this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    let b = 1 / n;
    return (
      ($[0] = (Y * u - D * P + H * m) * b),
      ($[1] = (Q * P - U * u - W * m) * b),
      ($[2] = (B * _ - E * R + z * k) * b),
      ($[3] = (O * R - K * _ - N * k) * b),
      ($[4] = (D * M - X * u - H * w) * b),
      ($[5] = (J * u - Q * M + W * w) * b),
      ($[6] = (E * V - F * _ - z * L) * b),
      ($[7] = (G * _ - O * V + N * L) * b),
      ($[8] = (X * P - Y * M + H * S) * b),
      ($[9] = (U * M - J * P - W * S) * b),
      ($[10] = (F * R - B * V + z * q) * b),
      ($[11] = (K * V - G * R - N * q) * b),
      ($[12] = (Y * w - X * m - D * S) * b),
      ($[13] = (J * m - U * w + Q * S) * b),
      ($[14] = (B * L - F * k - E * q) * b),
      ($[15] = (G * k - K * L + O * q) * b),
      this
    );
  }
  scale($) {
    let J = this.elements,
      U = $.x,
      Q = $.y,
      W = $.z;
    return (
      (J[0] *= U),
      (J[4] *= Q),
      (J[8] *= W),
      (J[1] *= U),
      (J[5] *= Q),
      (J[9] *= W),
      (J[2] *= U),
      (J[6] *= Q),
      (J[10] *= W),
      (J[3] *= U),
      (J[7] *= Q),
      (J[11] *= W),
      this
    );
  }
  getMaxScaleOnAxis() {
    let $ = this.elements,
      J = $[0] * $[0] + $[1] * $[1] + $[2] * $[2],
      U = $[4] * $[4] + $[5] * $[5] + $[6] * $[6],
      Q = $[8] * $[8] + $[9] * $[9] + $[10] * $[10];
    return Math.sqrt(Math.max(J, U, Q));
  }
  makeTranslation($, J, U) {
    if ($.isVector3) this.set(1, 0, 0, $.x, 0, 1, 0, $.y, 0, 0, 1, $.z, 0, 0, 0, 1);
    else this.set(1, 0, 0, $, 0, 1, 0, J, 0, 0, 1, U, 0, 0, 0, 1);
    return this;
  }
  makeRotationX($) {
    let J = Math.cos($),
      U = Math.sin($);
    return (this.set(1, 0, 0, 0, 0, J, -U, 0, 0, U, J, 0, 0, 0, 0, 1), this);
  }
  makeRotationY($) {
    let J = Math.cos($),
      U = Math.sin($);
    return (this.set(J, 0, U, 0, 0, 1, 0, 0, -U, 0, J, 0, 0, 0, 0, 1), this);
  }
  makeRotationZ($) {
    let J = Math.cos($),
      U = Math.sin($);
    return (this.set(J, -U, 0, 0, U, J, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1), this);
  }
  makeRotationAxis($, J) {
    let U = Math.cos(J),
      Q = Math.sin(J),
      W = 1 - U,
      X = $.x,
      Y = $.y,
      D = $.z,
      H = W * X,
      G = W * Y;
    return (
      this.set(
        H * X + U,
        H * Y - Q * D,
        H * D + Q * Y,
        0,
        H * Y + Q * D,
        G * Y + U,
        G * D - Q * X,
        0,
        H * D - Q * Y,
        G * D + Q * X,
        W * D * D + U,
        0,
        0,
        0,
        0,
        1,
      ),
      this
    );
  }
  makeScale($, J, U) {
    return (this.set($, 0, 0, 0, 0, J, 0, 0, 0, 0, U, 0, 0, 0, 0, 1), this);
  }
  makeShear($, J, U, Q, W, X) {
    return (this.set(1, U, W, 0, $, 1, X, 0, J, Q, 1, 0, 0, 0, 0, 1), this);
  }
  compose($, J, U) {
    let Q = this.elements,
      W = J._x,
      X = J._y,
      Y = J._z,
      D = J._w,
      H = W + W,
      G = X + X,
      K = Y + Y,
      O = W * H,
      N = W * G,
      F = W * K,
      B = X * G,
      E = X * K,
      z = Y * K,
      q = D * H,
      L = D * G,
      V = D * K,
      k = U.x,
      R = U.y,
      _ = U.z;
    return (
      (Q[0] = (1 - (B + z)) * k),
      (Q[1] = (N + V) * k),
      (Q[2] = (F - L) * k),
      (Q[3] = 0),
      (Q[4] = (N - V) * R),
      (Q[5] = (1 - (O + z)) * R),
      (Q[6] = (E + q) * R),
      (Q[7] = 0),
      (Q[8] = (F + L) * _),
      (Q[9] = (E - q) * _),
      (Q[10] = (1 - (O + B)) * _),
      (Q[11] = 0),
      (Q[12] = $.x),
      (Q[13] = $.y),
      (Q[14] = $.z),
      (Q[15] = 1),
      this
    );
  }
  decompose($, J, U) {
    let Q = this.elements;
    (($.x = Q[12]), ($.y = Q[13]), ($.z = Q[14]));
    let W = this.determinant();
    if (W === 0) return (U.set(1, 1, 1), J.identity(), this);
    let X = E1.set(Q[0], Q[1], Q[2]).length(),
      Y = E1.set(Q[4], Q[5], Q[6]).length(),
      D = E1.set(Q[8], Q[9], Q[10]).length();
    if (W < 0) X = -X;
    YU.copy(this);
    let H = 1 / X,
      G = 1 / Y,
      K = 1 / D;
    return (
      (YU.elements[0] *= H),
      (YU.elements[1] *= H),
      (YU.elements[2] *= H),
      (YU.elements[4] *= G),
      (YU.elements[5] *= G),
      (YU.elements[6] *= G),
      (YU.elements[8] *= K),
      (YU.elements[9] *= K),
      (YU.elements[10] *= K),
      J.setFromRotationMatrix(YU),
      (U.x = X),
      (U.y = Y),
      (U.z = D),
      this
    );
  }
  makePerspective($, J, U, Q, W, X, Y = 2000, D = !1) {
    let H = this.elements,
      G = (2 * W) / (J - $),
      K = (2 * W) / (U - Q),
      O = (J + $) / (J - $),
      N = (U + Q) / (U - Q),
      F,
      B;
    if (D) ((F = W / (X - W)), (B = (X * W) / (X - W)));
    else if (Y === 2000) ((F = -(X + W) / (X - W)), (B = (-2 * X * W) / (X - W)));
    else if (Y === 2001) ((F = -X / (X - W)), (B = (-X * W) / (X - W)));
    else throw Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: " + Y);
    return (
      (H[0] = G),
      (H[4] = 0),
      (H[8] = O),
      (H[12] = 0),
      (H[1] = 0),
      (H[5] = K),
      (H[9] = N),
      (H[13] = 0),
      (H[2] = 0),
      (H[6] = 0),
      (H[10] = F),
      (H[14] = B),
      (H[3] = 0),
      (H[7] = 0),
      (H[11] = -1),
      (H[15] = 0),
      this
    );
  }
  makeOrthographic($, J, U, Q, W, X, Y = 2000, D = !1) {
    let H = this.elements,
      G = 2 / (J - $),
      K = 2 / (U - Q),
      O = -(J + $) / (J - $),
      N = -(U + Q) / (U - Q),
      F,
      B;
    if (D) ((F = 1 / (X - W)), (B = X / (X - W)));
    else if (Y === 2000) ((F = -2 / (X - W)), (B = -(X + W) / (X - W)));
    else if (Y === 2001) ((F = -1 / (X - W)), (B = -W / (X - W)));
    else throw Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: " + Y);
    return (
      (H[0] = G),
      (H[4] = 0),
      (H[8] = 0),
      (H[12] = O),
      (H[1] = 0),
      (H[5] = K),
      (H[9] = 0),
      (H[13] = N),
      (H[2] = 0),
      (H[6] = 0),
      (H[10] = F),
      (H[14] = B),
      (H[3] = 0),
      (H[7] = 0),
      (H[11] = 0),
      (H[15] = 1),
      this
    );
  }
  equals($) {
    let J = this.elements,
      U = $.elements;
    for (let Q = 0; Q < 16; Q++) if (J[Q] !== U[Q]) return !1;
    return !0;
  }
  fromArray($, J = 0) {
    for (let U = 0; U < 16; U++) this.elements[U] = $[U + J];
    return this;
  }
  toArray($ = [], J = 0) {
    let U = this.elements;
    return (
      ($[J] = U[0]),
      ($[J + 1] = U[1]),
      ($[J + 2] = U[2]),
      ($[J + 3] = U[3]),
      ($[J + 4] = U[4]),
      ($[J + 5] = U[5]),
      ($[J + 6] = U[6]),
      ($[J + 7] = U[7]),
      ($[J + 8] = U[8]),
      ($[J + 9] = U[9]),
      ($[J + 10] = U[10]),
      ($[J + 11] = U[11]),
      ($[J + 12] = U[12]),
      ($[J + 13] = U[13]),
      ($[J + 14] = U[14]),
      ($[J + 15] = U[15]),
      $
    );
  }
}
var E1 = new C(),
  YU = new x6(),
  Bm = new C(0, 0, 0),
  Em = new C(1, 1, 1),
  c8 = new C(),
  f5 = new C(),
  TJ = new C(),
  rR = new x6(),
  sR = new H0();
class NU {
  constructor($ = 0, J = 0, U = 0, Q = NU.DEFAULT_ORDER) {
    ((this.isEuler = !0), (this._x = $), (this._y = J), (this._z = U), (this._order = Q));
  }
  get x() {
    return this._x;
  }
  set x($) {
    ((this._x = $), this._onChangeCallback());
  }
  get y() {
    return this._y;
  }
  set y($) {
    ((this._y = $), this._onChangeCallback());
  }
  get z() {
    return this._z;
  }
  set z($) {
    ((this._z = $), this._onChangeCallback());
  }
  get order() {
    return this._order;
  }
  set order($) {
    ((this._order = $), this._onChangeCallback());
  }
  set($, J, U, Q = this._order) {
    return ((this._x = $), (this._y = J), (this._z = U), (this._order = Q), this._onChangeCallback(), this);
  }
  clone() {
    return new this.constructor(this._x, this._y, this._z, this._order);
  }
  copy($) {
    return (
      (this._x = $._x),
      (this._y = $._y),
      (this._z = $._z),
      (this._order = $._order),
      this._onChangeCallback(),
      this
    );
  }
  setFromRotationMatrix($, J = this._order, U = !0) {
    let Q = $.elements,
      W = Q[0],
      X = Q[4],
      Y = Q[8],
      D = Q[1],
      H = Q[5],
      G = Q[9],
      K = Q[2],
      O = Q[6],
      N = Q[10];
    switch (J) {
      case "XYZ":
        if (((this._y = Math.asin(V6(Y, -1, 1))), Math.abs(Y) < 0.9999999))
          ((this._x = Math.atan2(-G, N)), (this._z = Math.atan2(-X, W)));
        else ((this._x = Math.atan2(O, H)), (this._z = 0));
        break;
      case "YXZ":
        if (((this._x = Math.asin(-V6(G, -1, 1))), Math.abs(G) < 0.9999999))
          ((this._y = Math.atan2(Y, N)), (this._z = Math.atan2(D, H)));
        else ((this._y = Math.atan2(-K, W)), (this._z = 0));
        break;
      case "ZXY":
        if (((this._x = Math.asin(V6(O, -1, 1))), Math.abs(O) < 0.9999999))
          ((this._y = Math.atan2(-K, N)), (this._z = Math.atan2(-X, H)));
        else ((this._y = 0), (this._z = Math.atan2(D, W)));
        break;
      case "ZYX":
        if (((this._y = Math.asin(-V6(K, -1, 1))), Math.abs(K) < 0.9999999))
          ((this._x = Math.atan2(O, N)), (this._z = Math.atan2(D, W)));
        else ((this._x = 0), (this._z = Math.atan2(-X, H)));
        break;
      case "YZX":
        if (((this._z = Math.asin(V6(D, -1, 1))), Math.abs(D) < 0.9999999))
          ((this._x = Math.atan2(-G, H)), (this._y = Math.atan2(-K, W)));
        else ((this._x = 0), (this._y = Math.atan2(Y, N)));
        break;
      case "XZY":
        if (((this._z = Math.asin(-V6(X, -1, 1))), Math.abs(X) < 0.9999999))
          ((this._x = Math.atan2(O, H)), (this._y = Math.atan2(Y, W)));
        else ((this._x = Math.atan2(-G, N)), (this._y = 0));
        break;
      default:
        i$("Euler: .setFromRotationMatrix() encountered an unknown order: " + J);
    }
    if (((this._order = J), U === !0)) this._onChangeCallback();
    return this;
  }
  setFromQuaternion($, J, U) {
    return (rR.makeRotationFromQuaternion($), this.setFromRotationMatrix(rR, J, U));
  }
  setFromVector3($, J = this._order) {
    return this.set($.x, $.y, $.z, J);
  }
  reorder($) {
    return (sR.setFromEuler(this), this.setFromQuaternion(sR, $));
  }
  equals($) {
    return $._x === this._x && $._y === this._y && $._z === this._z && $._order === this._order;
  }
  fromArray($) {
    if (((this._x = $[0]), (this._y = $[1]), (this._z = $[2]), $[3] !== void 0)) this._order = $[3];
    return (this._onChangeCallback(), this);
  }
  toArray($ = [], J = 0) {
    return (($[J] = this._x), ($[J + 1] = this._y), ($[J + 2] = this._z), ($[J + 3] = this._order), $);
  }
  _onChange($) {
    return ((this._onChangeCallback = $), this);
  }
  _onChangeCallback() {}
  *[Symbol.iterator]() {
    (yield this._x, yield this._y, yield this._z, yield this._order);
  }
}
NU.DEFAULT_ORDER = "XYZ";
class FX {
  constructor() {
    this.mask = 1;
  }
  set($) {
    this.mask = ((1 << $) | 0) >>> 0;
  }
  enable($) {
    this.mask |= (1 << $) | 0;
  }
  enableAll() {
    this.mask = -1;
  }
  toggle($) {
    this.mask ^= (1 << $) | 0;
  }
  disable($) {
    this.mask &= ~((1 << $) | 0);
  }
  disableAll() {
    this.mask = 0;
  }
  test($) {
    return (this.mask & $.mask) !== 0;
  }
  isEnabled($) {
    return (this.mask & ((1 << $) | 0)) !== 0;
  }
}
var Lm = 0,
  aR = new C(),
  L1 = new H0(),
  tU = new x6(),
  y5 = new C(),
  rQ = new C(),
  wm = new C(),
  Im = new H0(),
  tR = new C(1, 0, 0),
  eR = new C(0, 1, 0),
  $Z = new C(0, 0, 1),
  JZ = { type: "added" },
  Vm = { type: "removed" },
  w1 = { type: "childadded", child: null },
  Sz = { type: "childremoved", child: null };
class F0 extends vU {
  constructor() {
    super();
    ((this.isObject3D = !0),
      Object.defineProperty(this, "id", { value: Lm++ }),
      (this.uuid = W8()),
      (this.name = ""),
      (this.type = "Object3D"),
      (this.parent = null),
      (this.children = []),
      (this.up = F0.DEFAULT_UP.clone()));
    let $ = new C(),
      J = new NU(),
      U = new H0(),
      Q = new C(1, 1, 1);
    function W() {
      U.setFromEuler(J, !1);
    }
    function X() {
      J.setFromQuaternion(U, void 0, !1);
    }
    (J._onChange(W),
      U._onChange(X),
      Object.defineProperties(this, {
        position: { configurable: !0, enumerable: !0, value: $ },
        rotation: { configurable: !0, enumerable: !0, value: J },
        quaternion: { configurable: !0, enumerable: !0, value: U },
        scale: { configurable: !0, enumerable: !0, value: Q },
        modelViewMatrix: { value: new x6() },
        normalMatrix: { value: new X6() },
      }),
      (this.matrix = new x6()),
      (this.matrixWorld = new x6()),
      (this.matrixAutoUpdate = F0.DEFAULT_MATRIX_AUTO_UPDATE),
      (this.matrixWorldAutoUpdate = F0.DEFAULT_MATRIX_WORLD_AUTO_UPDATE),
      (this.matrixWorldNeedsUpdate = !1),
      (this.layers = new FX()),
      (this.visible = !0),
      (this.castShadow = !1),
      (this.receiveShadow = !1),
      (this.frustumCulled = !0),
      (this.renderOrder = 0),
      (this.animations = []),
      (this.customDepthMaterial = void 0),
      (this.customDistanceMaterial = void 0),
      (this.static = !1),
      (this.userData = {}),
      (this.pivot = null));
  }
  onBeforeShadow() {}
  onAfterShadow() {}
  onBeforeRender() {}
  onAfterRender() {}
  applyMatrix4($) {
    if (this.matrixAutoUpdate) this.updateMatrix();
    (this.matrix.premultiply($), this.matrix.decompose(this.position, this.quaternion, this.scale));
  }
  applyQuaternion($) {
    return (this.quaternion.premultiply($), this);
  }
  setRotationFromAxisAngle($, J) {
    this.quaternion.setFromAxisAngle($, J);
  }
  setRotationFromEuler($) {
    this.quaternion.setFromEuler($, !0);
  }
  setRotationFromMatrix($) {
    this.quaternion.setFromRotationMatrix($);
  }
  setRotationFromQuaternion($) {
    this.quaternion.copy($);
  }
  rotateOnAxis($, J) {
    return (L1.setFromAxisAngle($, J), this.quaternion.multiply(L1), this);
  }
  rotateOnWorldAxis($, J) {
    return (L1.setFromAxisAngle($, J), this.quaternion.premultiply(L1), this);
  }
  rotateX($) {
    return this.rotateOnAxis(tR, $);
  }
  rotateY($) {
    return this.rotateOnAxis(eR, $);
  }
  rotateZ($) {
    return this.rotateOnAxis($Z, $);
  }
  translateOnAxis($, J) {
    return (aR.copy($).applyQuaternion(this.quaternion), this.position.add(aR.multiplyScalar(J)), this);
  }
  translateX($) {
    return this.translateOnAxis(tR, $);
  }
  translateY($) {
    return this.translateOnAxis(eR, $);
  }
  translateZ($) {
    return this.translateOnAxis($Z, $);
  }
  localToWorld($) {
    return (this.updateWorldMatrix(!0, !1), $.applyMatrix4(this.matrixWorld));
  }
  worldToLocal($) {
    return (this.updateWorldMatrix(!0, !1), $.applyMatrix4(tU.copy(this.matrixWorld).invert()));
  }
  lookAt($, J, U) {
    if ($.isVector3) y5.copy($);
    else y5.set($, J, U);
    let Q = this.parent;
    if ((this.updateWorldMatrix(!0, !1), rQ.setFromMatrixPosition(this.matrixWorld), this.isCamera || this.isLight))
      tU.lookAt(rQ, y5, this.up);
    else tU.lookAt(y5, rQ, this.up);
    if ((this.quaternion.setFromRotationMatrix(tU), Q))
      (tU.extractRotation(Q.matrixWorld), L1.setFromRotationMatrix(tU), this.quaternion.premultiply(L1.invert()));
  }
  add($) {
    if (arguments.length > 1) {
      for (let J = 0; J < arguments.length; J++) this.add(arguments[J]);
      return this;
    }
    if ($ === this) return (s$("Object3D.add: object can't be added as a child of itself.", $), this);
    if ($ && $.isObject3D)
      ($.removeFromParent(),
        ($.parent = this),
        this.children.push($),
        $.dispatchEvent(JZ),
        (w1.child = $),
        this.dispatchEvent(w1),
        (w1.child = null));
    else s$("Object3D.add: object not an instance of THREE.Object3D.", $);
    return this;
  }
  remove($) {
    if (arguments.length > 1) {
      for (let U = 0; U < arguments.length; U++) this.remove(arguments[U]);
      return this;
    }
    let J = this.children.indexOf($);
    if (J !== -1)
      (($.parent = null),
        this.children.splice(J, 1),
        $.dispatchEvent(Vm),
        (Sz.child = $),
        this.dispatchEvent(Sz),
        (Sz.child = null));
    return this;
  }
  removeFromParent() {
    let $ = this.parent;
    if ($ !== null) $.remove(this);
    return this;
  }
  clear() {
    return this.remove(...this.children);
  }
  attach($) {
    if ((this.updateWorldMatrix(!0, !1), tU.copy(this.matrixWorld).invert(), $.parent !== null))
      ($.parent.updateWorldMatrix(!0, !1), tU.multiply($.parent.matrixWorld));
    return (
      $.applyMatrix4(tU),
      $.removeFromParent(),
      ($.parent = this),
      this.children.push($),
      $.updateWorldMatrix(!1, !0),
      $.dispatchEvent(JZ),
      (w1.child = $),
      this.dispatchEvent(w1),
      (w1.child = null),
      this
    );
  }
  getObjectById($) {
    return this.getObjectByProperty("id", $);
  }
  getObjectByName($) {
    return this.getObjectByProperty("name", $);
  }
  getObjectByProperty($, J) {
    if (this[$] === J) return this;
    for (let U = 0, Q = this.children.length; U < Q; U++) {
      let X = this.children[U].getObjectByProperty($, J);
      if (X !== void 0) return X;
    }
    return;
  }
  getObjectsByProperty($, J, U = []) {
    if (this[$] === J) U.push(this);
    let Q = this.children;
    for (let W = 0, X = Q.length; W < X; W++) Q[W].getObjectsByProperty($, J, U);
    return U;
  }
  getWorldPosition($) {
    return (this.updateWorldMatrix(!0, !1), $.setFromMatrixPosition(this.matrixWorld));
  }
  getWorldQuaternion($) {
    return (this.updateWorldMatrix(!0, !1), this.matrixWorld.decompose(rQ, $, wm), $);
  }
  getWorldScale($) {
    return (this.updateWorldMatrix(!0, !1), this.matrixWorld.decompose(rQ, Im, $), $);
  }
  getWorldDirection($) {
    this.updateWorldMatrix(!0, !1);
    let J = this.matrixWorld.elements;
    return $.set(J[8], J[9], J[10]).normalize();
  }
  raycast() {}
  traverse($) {
    $(this);
    let J = this.children;
    for (let U = 0, Q = J.length; U < Q; U++) J[U].traverse($);
  }
  traverseVisible($) {
    if (this.visible === !1) return;
    $(this);
    let J = this.children;
    for (let U = 0, Q = J.length; U < Q; U++) J[U].traverseVisible($);
  }
  traverseAncestors($) {
    let J = this.parent;
    if (J !== null) ($(J), J.traverseAncestors($));
  }
  updateMatrix() {
    this.matrix.compose(this.position, this.quaternion, this.scale);
    let $ = this.pivot;
    if ($ !== null) {
      let { x: J, y: U, z: Q } = $,
        W = this.matrix.elements;
      ((W[12] += J - W[0] * J - W[4] * U - W[8] * Q),
        (W[13] += U - W[1] * J - W[5] * U - W[9] * Q),
        (W[14] += Q - W[2] * J - W[6] * U - W[10] * Q));
    }
    this.matrixWorldNeedsUpdate = !0;
  }
  updateMatrixWorld($) {
    if (this.matrixAutoUpdate) this.updateMatrix();
    if (this.matrixWorldNeedsUpdate || $) {
      if (this.matrixWorldAutoUpdate === !0)
        if (this.parent === null) this.matrixWorld.copy(this.matrix);
        else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
      ((this.matrixWorldNeedsUpdate = !1), ($ = !0));
    }
    let J = this.children;
    for (let U = 0, Q = J.length; U < Q; U++) J[U].updateMatrixWorld($);
  }
  updateWorldMatrix($, J) {
    let U = this.parent;
    if ($ === !0 && U !== null) U.updateWorldMatrix(!0, !1);
    if (this.matrixAutoUpdate) this.updateMatrix();
    if (this.matrixWorldAutoUpdate === !0)
      if (this.parent === null) this.matrixWorld.copy(this.matrix);
      else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
    if (J === !0) {
      let Q = this.children;
      for (let W = 0, X = Q.length; W < X; W++) Q[W].updateWorldMatrix(!1, !0);
    }
  }
  toJSON($) {
    let J = $ === void 0 || typeof $ === "string",
      U = {};
    if (J)
      (($ = {
        geometries: {},
        materials: {},
        textures: {},
        images: {},
        shapes: {},
        skeletons: {},
        animations: {},
        nodes: {},
      }),
        (U.metadata = { version: 4.7, type: "Object", generator: "Object3D.toJSON" }));
    let Q = {};
    if (((Q.uuid = this.uuid), (Q.type = this.type), this.name !== "")) Q.name = this.name;
    if (this.castShadow === !0) Q.castShadow = !0;
    if (this.receiveShadow === !0) Q.receiveShadow = !0;
    if (this.visible === !1) Q.visible = !1;
    if (this.frustumCulled === !1) Q.frustumCulled = !1;
    if (this.renderOrder !== 0) Q.renderOrder = this.renderOrder;
    if (this.static !== !1) Q.static = this.static;
    if (Object.keys(this.userData).length > 0) Q.userData = this.userData;
    if (
      ((Q.layers = this.layers.mask),
      (Q.matrix = this.matrix.toArray()),
      (Q.up = this.up.toArray()),
      this.pivot !== null)
    )
      Q.pivot = this.pivot.toArray();
    if (this.matrixAutoUpdate === !1) Q.matrixAutoUpdate = !1;
    if (this.morphTargetDictionary !== void 0) Q.morphTargetDictionary = Object.assign({}, this.morphTargetDictionary);
    if (this.morphTargetInfluences !== void 0) Q.morphTargetInfluences = this.morphTargetInfluences.slice();
    if (this.isInstancedMesh) {
      if (
        ((Q.type = "InstancedMesh"),
        (Q.count = this.count),
        (Q.instanceMatrix = this.instanceMatrix.toJSON()),
        this.instanceColor !== null)
      )
        Q.instanceColor = this.instanceColor.toJSON();
    }
    if (this.isBatchedMesh) {
      if (
        ((Q.type = "BatchedMesh"),
        (Q.perObjectFrustumCulled = this.perObjectFrustumCulled),
        (Q.sortObjects = this.sortObjects),
        (Q.drawRanges = this._drawRanges),
        (Q.reservedRanges = this._reservedRanges),
        (Q.geometryInfo = this._geometryInfo.map((Y) => ({
          ...Y,
          boundingBox: Y.boundingBox ? Y.boundingBox.toJSON() : void 0,
          boundingSphere: Y.boundingSphere ? Y.boundingSphere.toJSON() : void 0,
        }))),
        (Q.instanceInfo = this._instanceInfo.map((Y) => ({ ...Y }))),
        (Q.availableInstanceIds = this._availableInstanceIds.slice()),
        (Q.availableGeometryIds = this._availableGeometryIds.slice()),
        (Q.nextIndexStart = this._nextIndexStart),
        (Q.nextVertexStart = this._nextVertexStart),
        (Q.geometryCount = this._geometryCount),
        (Q.maxInstanceCount = this._maxInstanceCount),
        (Q.maxVertexCount = this._maxVertexCount),
        (Q.maxIndexCount = this._maxIndexCount),
        (Q.geometryInitialized = this._geometryInitialized),
        (Q.matricesTexture = this._matricesTexture.toJSON($)),
        (Q.indirectTexture = this._indirectTexture.toJSON($)),
        this._colorsTexture !== null)
      )
        Q.colorsTexture = this._colorsTexture.toJSON($);
      if (this.boundingSphere !== null) Q.boundingSphere = this.boundingSphere.toJSON();
      if (this.boundingBox !== null) Q.boundingBox = this.boundingBox.toJSON();
    }
    function W(Y, D) {
      if (Y[D.uuid] === void 0) Y[D.uuid] = D.toJSON($);
      return D.uuid;
    }
    if (this.isScene) {
      if (this.background) {
        if (this.background.isColor) Q.background = this.background.toJSON();
        else if (this.background.isTexture) Q.background = this.background.toJSON($).uuid;
      }
      if (this.environment && this.environment.isTexture && this.environment.isRenderTargetTexture !== !0)
        Q.environment = this.environment.toJSON($).uuid;
    } else if (this.isMesh || this.isLine || this.isPoints) {
      Q.geometry = W($.geometries, this.geometry);
      let Y = this.geometry.parameters;
      if (Y !== void 0 && Y.shapes !== void 0) {
        let D = Y.shapes;
        if (Array.isArray(D))
          for (let H = 0, G = D.length; H < G; H++) {
            let K = D[H];
            W($.shapes, K);
          }
        else W($.shapes, D);
      }
    }
    if (this.isSkinnedMesh) {
      if (((Q.bindMode = this.bindMode), (Q.bindMatrix = this.bindMatrix.toArray()), this.skeleton !== void 0))
        (W($.skeletons, this.skeleton), (Q.skeleton = this.skeleton.uuid));
    }
    if (this.material !== void 0)
      if (Array.isArray(this.material)) {
        let Y = [];
        for (let D = 0, H = this.material.length; D < H; D++) Y.push(W($.materials, this.material[D]));
        Q.material = Y;
      } else Q.material = W($.materials, this.material);
    if (this.children.length > 0) {
      Q.children = [];
      for (let Y = 0; Y < this.children.length; Y++) Q.children.push(this.children[Y].toJSON($).object);
    }
    if (this.animations.length > 0) {
      Q.animations = [];
      for (let Y = 0; Y < this.animations.length; Y++) {
        let D = this.animations[Y];
        Q.animations.push(W($.animations, D));
      }
    }
    if (J) {
      let Y = X($.geometries),
        D = X($.materials),
        H = X($.textures),
        G = X($.images),
        K = X($.shapes),
        O = X($.skeletons),
        N = X($.animations),
        F = X($.nodes);
      if (Y.length > 0) U.geometries = Y;
      if (D.length > 0) U.materials = D;
      if (H.length > 0) U.textures = H;
      if (G.length > 0) U.images = G;
      if (K.length > 0) U.shapes = K;
      if (O.length > 0) U.skeletons = O;
      if (N.length > 0) U.animations = N;
      if (F.length > 0) U.nodes = F;
    }
    return ((U.object = Q), U);
    function X(Y) {
      let D = [];
      for (let H in Y) {
        let G = Y[H];
        (delete G.metadata, D.push(G));
      }
      return D;
    }
  }
  clone($) {
    return new this.constructor().copy(this, $);
  }
  copy($, J = !0) {
    if (
      ((this.name = $.name),
      this.up.copy($.up),
      this.position.copy($.position),
      (this.rotation.order = $.rotation.order),
      this.quaternion.copy($.quaternion),
      this.scale.copy($.scale),
      (this.pivot = $.pivot !== null ? $.pivot.clone() : null),
      this.matrix.copy($.matrix),
      this.matrixWorld.copy($.matrixWorld),
      (this.matrixAutoUpdate = $.matrixAutoUpdate),
      (this.matrixWorldAutoUpdate = $.matrixWorldAutoUpdate),
      (this.matrixWorldNeedsUpdate = $.matrixWorldNeedsUpdate),
      (this.layers.mask = $.layers.mask),
      (this.visible = $.visible),
      (this.castShadow = $.castShadow),
      (this.receiveShadow = $.receiveShadow),
      (this.frustumCulled = $.frustumCulled),
      (this.renderOrder = $.renderOrder),
      (this.static = $.static),
      (this.animations = $.animations.slice()),
      (this.userData = JSON.parse(JSON.stringify($.userData))),
      J === !0)
    )
      for (let U = 0; U < $.children.length; U++) {
        let Q = $.children[U];
        this.add(Q.clone());
      }
    return this;
  }
}
F0.DEFAULT_UP = new C(0, 1, 0);
F0.DEFAULT_MATRIX_AUTO_UPDATE = !0;
F0.DEFAULT_MATRIX_WORLD_AUTO_UPDATE = !0;
class GJ extends F0 {
  constructor() {
    super();
    ((this.isGroup = !0), (this.type = "Group"));
  }
}
var km = { type: "move" };
class qX {
  constructor() {
    ((this._targetRay = null), (this._grip = null), (this._hand = null));
  }
  getHandSpace() {
    if (this._hand === null)
      ((this._hand = new GJ()),
        (this._hand.matrixAutoUpdate = !1),
        (this._hand.visible = !1),
        (this._hand.joints = {}),
        (this._hand.inputState = { pinching: !1 }));
    return this._hand;
  }
  getTargetRaySpace() {
    if (this._targetRay === null)
      ((this._targetRay = new GJ()),
        (this._targetRay.matrixAutoUpdate = !1),
        (this._targetRay.visible = !1),
        (this._targetRay.hasLinearVelocity = !1),
        (this._targetRay.linearVelocity = new C()),
        (this._targetRay.hasAngularVelocity = !1),
        (this._targetRay.angularVelocity = new C()));
    return this._targetRay;
  }
  getGripSpace() {
    if (this._grip === null)
      ((this._grip = new GJ()),
        (this._grip.matrixAutoUpdate = !1),
        (this._grip.visible = !1),
        (this._grip.hasLinearVelocity = !1),
        (this._grip.linearVelocity = new C()),
        (this._grip.hasAngularVelocity = !1),
        (this._grip.angularVelocity = new C()),
        (this._grip.eventsEnabled = !1));
    return this._grip;
  }
  dispatchEvent($) {
    if (this._targetRay !== null) this._targetRay.dispatchEvent($);
    if (this._grip !== null) this._grip.dispatchEvent($);
    if (this._hand !== null) this._hand.dispatchEvent($);
    return this;
  }
  connect($) {
    if ($ && $.hand) {
      let J = this._hand;
      if (J) for (let U of $.hand.values()) this._getHandJoint(J, U);
    }
    return (this.dispatchEvent({ type: "connected", data: $ }), this);
  }
  disconnect($) {
    if ((this.dispatchEvent({ type: "disconnected", data: $ }), this._targetRay !== null)) this._targetRay.visible = !1;
    if (this._grip !== null) this._grip.visible = !1;
    if (this._hand !== null) this._hand.visible = !1;
    return this;
  }
  update($, J, U) {
    let Q = null,
      W = null,
      X = null,
      Y = this._targetRay,
      D = this._grip,
      H = this._hand;
    if ($ && J.session.visibilityState !== "visible-blurred") {
      if (H && $.hand) {
        X = !0;
        for (let B of $.hand.values()) {
          let E = J.getJointPose(B, U),
            z = this._getHandJoint(H, B);
          if (E !== null)
            (z.matrix.fromArray(E.transform.matrix),
              z.matrix.decompose(z.position, z.rotation, z.scale),
              (z.matrixWorldNeedsUpdate = !0),
              (z.jointRadius = E.radius));
          z.visible = E !== null;
        }
        let G = H.joints["index-finger-tip"],
          K = H.joints["thumb-tip"],
          O = G.position.distanceTo(K.position),
          N = 0.02,
          F = 0.005;
        if (H.inputState.pinching && O > N + F)
          ((H.inputState.pinching = !1),
            this.dispatchEvent({ type: "pinchend", handedness: $.handedness, target: this }));
        else if (!H.inputState.pinching && O <= N - F)
          ((H.inputState.pinching = !0),
            this.dispatchEvent({ type: "pinchstart", handedness: $.handedness, target: this }));
      } else if (D !== null && $.gripSpace) {
        if (((W = J.getPose($.gripSpace, U)), W !== null)) {
          if (
            (D.matrix.fromArray(W.transform.matrix),
            D.matrix.decompose(D.position, D.rotation, D.scale),
            (D.matrixWorldNeedsUpdate = !0),
            W.linearVelocity)
          )
            ((D.hasLinearVelocity = !0), D.linearVelocity.copy(W.linearVelocity));
          else D.hasLinearVelocity = !1;
          if (W.angularVelocity) ((D.hasAngularVelocity = !0), D.angularVelocity.copy(W.angularVelocity));
          else D.hasAngularVelocity = !1;
          if (D.eventsEnabled) D.dispatchEvent({ type: "gripUpdated", data: $, target: this });
        }
      }
      if (Y !== null) {
        if (((Q = J.getPose($.targetRaySpace, U)), Q === null && W !== null)) Q = W;
        if (Q !== null) {
          if (
            (Y.matrix.fromArray(Q.transform.matrix),
            Y.matrix.decompose(Y.position, Y.rotation, Y.scale),
            (Y.matrixWorldNeedsUpdate = !0),
            Q.linearVelocity)
          )
            ((Y.hasLinearVelocity = !0), Y.linearVelocity.copy(Q.linearVelocity));
          else Y.hasLinearVelocity = !1;
          if (Q.angularVelocity) ((Y.hasAngularVelocity = !0), Y.angularVelocity.copy(Q.angularVelocity));
          else Y.hasAngularVelocity = !1;
          this.dispatchEvent(km);
        }
      }
    }
    if (Y !== null) Y.visible = Q !== null;
    if (D !== null) D.visible = W !== null;
    if (H !== null) H.visible = X !== null;
    return this;
  }
  _getHandJoint($, J) {
    if ($.joints[J.jointName] === void 0) {
      let U = new GJ();
      ((U.matrixAutoUpdate = !1), (U.visible = !1), ($.joints[J.jointName] = U), $.add(U));
    }
    return $.joints[J.jointName];
  }
}
var VP = {
    aliceblue: 15792383,
    antiquewhite: 16444375,
    aqua: 65535,
    aquamarine: 8388564,
    azure: 15794175,
    beige: 16119260,
    bisque: 16770244,
    black: 0,
    blanchedalmond: 16772045,
    blue: 255,
    blueviolet: 9055202,
    brown: 10824234,
    burlywood: 14596231,
    cadetblue: 6266528,
    chartreuse: 8388352,
    chocolate: 13789470,
    coral: 16744272,
    cornflowerblue: 6591981,
    cornsilk: 16775388,
    crimson: 14423100,
    cyan: 65535,
    darkblue: 139,
    darkcyan: 35723,
    darkgoldenrod: 12092939,
    darkgray: 11119017,
    darkgreen: 25600,
    darkgrey: 11119017,
    darkkhaki: 12433259,
    darkmagenta: 9109643,
    darkolivegreen: 5597999,
    darkorange: 16747520,
    darkorchid: 10040012,
    darkred: 9109504,
    darksalmon: 15308410,
    darkseagreen: 9419919,
    darkslateblue: 4734347,
    darkslategray: 3100495,
    darkslategrey: 3100495,
    darkturquoise: 52945,
    darkviolet: 9699539,
    deeppink: 16716947,
    deepskyblue: 49151,
    dimgray: 6908265,
    dimgrey: 6908265,
    dodgerblue: 2003199,
    firebrick: 11674146,
    floralwhite: 16775920,
    forestgreen: 2263842,
    fuchsia: 16711935,
    gainsboro: 14474460,
    ghostwhite: 16316671,
    gold: 16766720,
    goldenrod: 14329120,
    gray: 8421504,
    green: 32768,
    greenyellow: 11403055,
    grey: 8421504,
    honeydew: 15794160,
    hotpink: 16738740,
    indianred: 13458524,
    indigo: 4915330,
    ivory: 16777200,
    khaki: 15787660,
    lavender: 15132410,
    lavenderblush: 16773365,
    lawngreen: 8190976,
    lemonchiffon: 16775885,
    lightblue: 11393254,
    lightcoral: 15761536,
    lightcyan: 14745599,
    lightgoldenrodyellow: 16448210,
    lightgray: 13882323,
    lightgreen: 9498256,
    lightgrey: 13882323,
    lightpink: 16758465,
    lightsalmon: 16752762,
    lightseagreen: 2142890,
    lightskyblue: 8900346,
    lightslategray: 7833753,
    lightslategrey: 7833753,
    lightsteelblue: 11584734,
    lightyellow: 16777184,
    lime: 65280,
    limegreen: 3329330,
    linen: 16445670,
    magenta: 16711935,
    maroon: 8388608,
    mediumaquamarine: 6737322,
    mediumblue: 205,
    mediumorchid: 12211667,
    mediumpurple: 9662683,
    mediumseagreen: 3978097,
    mediumslateblue: 8087790,
    mediumspringgreen: 64154,
    mediumturquoise: 4772300,
    mediumvioletred: 13047173,
    midnightblue: 1644912,
    mintcream: 16121850,
    mistyrose: 16770273,
    moccasin: 16770229,
    navajowhite: 16768685,
    navy: 128,
    oldlace: 16643558,
    olive: 8421376,
    olivedrab: 7048739,
    orange: 16753920,
    orangered: 16729344,
    orchid: 14315734,
    palegoldenrod: 15657130,
    palegreen: 10025880,
    paleturquoise: 11529966,
    palevioletred: 14381203,
    papayawhip: 16773077,
    peachpuff: 16767673,
    peru: 13468991,
    pink: 16761035,
    plum: 14524637,
    powderblue: 11591910,
    purple: 8388736,
    rebeccapurple: 6697881,
    red: 16711680,
    rosybrown: 12357519,
    royalblue: 4286945,
    saddlebrown: 9127187,
    salmon: 16416882,
    sandybrown: 16032864,
    seagreen: 3050327,
    seashell: 16774638,
    sienna: 10506797,
    silver: 12632256,
    skyblue: 8900331,
    slateblue: 6970061,
    slategray: 7372944,
    slategrey: 7372944,
    snow: 16775930,
    springgreen: 65407,
    steelblue: 4620980,
    tan: 13808780,
    teal: 32896,
    thistle: 14204888,
    tomato: 16737095,
    turquoise: 4251856,
    violet: 15631086,
    wheat: 16113331,
    white: 16777215,
    whitesmoke: 16119285,
    yellow: 16776960,
    yellowgreen: 10145074,
  },
  n8 = { h: 0, s: 0, l: 0 },
  x5 = { h: 0, s: 0, l: 0 };
function Cz($, J, U) {
  if (U < 0) U += 1;
  if (U > 1) U -= 1;
  if (U < 0.16666666666666666) return $ + (J - $) * 6 * U;
  if (U < 0.5) return J;
  if (U < 0.6666666666666666) return $ + (J - $) * 6 * (0.6666666666666666 - U);
  return $;
}
class W6 {
  constructor($, J, U) {
    return ((this.isColor = !0), (this.r = 1), (this.g = 1), (this.b = 1), this.set($, J, U));
  }
  set($, J, U) {
    if (J === void 0 && U === void 0) {
      let Q = $;
      if (Q && Q.isColor) this.copy(Q);
      else if (typeof Q === "number") this.setHex(Q);
      else if (typeof Q === "string") this.setStyle(Q);
    } else this.setRGB($, J, U);
    return this;
  }
  setScalar($) {
    return ((this.r = $), (this.g = $), (this.b = $), this);
  }
  setHex($, J = "srgb") {
    return (
      ($ = Math.floor($)),
      (this.r = (($ >> 16) & 255) / 255),
      (this.g = (($ >> 8) & 255) / 255),
      (this.b = ($ & 255) / 255),
      R6.colorSpaceToWorking(this, J),
      this
    );
  }
  setRGB($, J, U, Q = R6.workingColorSpace) {
    return ((this.r = $), (this.g = J), (this.b = U), R6.colorSpaceToWorking(this, Q), this);
  }
  setHSL($, J, U, Q = R6.workingColorSpace) {
    if ((($ = rB($, 1)), (J = V6(J, 0, 1)), (U = V6(U, 0, 1)), J === 0)) this.r = this.g = this.b = U;
    else {
      let W = U <= 0.5 ? U * (1 + J) : U + J - U * J,
        X = 2 * U - W;
      ((this.r = Cz(X, W, $ + 0.3333333333333333)),
        (this.g = Cz(X, W, $)),
        (this.b = Cz(X, W, $ - 0.3333333333333333)));
    }
    return (R6.colorSpaceToWorking(this, Q), this);
  }
  setStyle($, J = "srgb") {
    function U(W) {
      if (W === void 0) return;
      if (parseFloat(W) < 1) i$("Color: Alpha component of " + $ + " will be ignored.");
    }
    let Q;
    if ((Q = /^(\w+)\(([^\)]*)\)/.exec($))) {
      let W,
        X = Q[1],
        Y = Q[2];
      switch (X) {
        case "rgb":
        case "rgba":
          if ((W = /^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(Y)))
            return (
              U(W[4]),
              this.setRGB(
                Math.min(255, parseInt(W[1], 10)) / 255,
                Math.min(255, parseInt(W[2], 10)) / 255,
                Math.min(255, parseInt(W[3], 10)) / 255,
                J,
              )
            );
          if ((W = /^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(Y)))
            return (
              U(W[4]),
              this.setRGB(
                Math.min(100, parseInt(W[1], 10)) / 100,
                Math.min(100, parseInt(W[2], 10)) / 100,
                Math.min(100, parseInt(W[3], 10)) / 100,
                J,
              )
            );
          break;
        case "hsl":
        case "hsla":
          if ((W = /^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(Y)))
            return (U(W[4]), this.setHSL(parseFloat(W[1]) / 360, parseFloat(W[2]) / 100, parseFloat(W[3]) / 100, J));
          break;
        default:
          i$("Color: Unknown color model " + $);
      }
    } else if ((Q = /^\#([A-Fa-f\d]+)$/.exec($))) {
      let W = Q[1],
        X = W.length;
      if (X === 3)
        return this.setRGB(
          parseInt(W.charAt(0), 16) / 15,
          parseInt(W.charAt(1), 16) / 15,
          parseInt(W.charAt(2), 16) / 15,
          J,
        );
      else if (X === 6) return this.setHex(parseInt(W, 16), J);
      else i$("Color: Invalid hex color " + $);
    } else if ($ && $.length > 0) return this.setColorName($, J);
    return this;
  }
  setColorName($, J = "srgb") {
    let U = VP[$.toLowerCase()];
    if (U !== void 0) this.setHex(U, J);
    else i$("Color: Unknown color " + $);
    return this;
  }
  clone() {
    return new this.constructor(this.r, this.g, this.b);
  }
  copy($) {
    return ((this.r = $.r), (this.g = $.g), (this.b = $.b), this);
  }
  copySRGBToLinear($) {
    return ((this.r = Q8($.r)), (this.g = Q8($.g)), (this.b = Q8($.b)), this);
  }
  copyLinearToSRGB($) {
    return ((this.r = v1($.r)), (this.g = v1($.g)), (this.b = v1($.b)), this);
  }
  convertSRGBToLinear() {
    return (this.copySRGBToLinear(this), this);
  }
  convertLinearToSRGB() {
    return (this.copyLinearToSRGB(this), this);
  }
  getHex($ = "srgb") {
    return (
      R6.workingToColorSpace(o0.copy(this), $),
      Math.round(V6(o0.r * 255, 0, 255)) * 65536 +
        Math.round(V6(o0.g * 255, 0, 255)) * 256 +
        Math.round(V6(o0.b * 255, 0, 255))
    );
  }
  getHexString($ = "srgb") {
    return ("000000" + this.getHex($).toString(16)).slice(-6);
  }
  getHSL($, J = R6.workingColorSpace) {
    R6.workingToColorSpace(o0.copy(this), J);
    let { r: U, g: Q, b: W } = o0,
      X = Math.max(U, Q, W),
      Y = Math.min(U, Q, W),
      D,
      H,
      G = (Y + X) / 2;
    if (Y === X) ((D = 0), (H = 0));
    else {
      let K = X - Y;
      switch (((H = G <= 0.5 ? K / (X + Y) : K / (2 - X - Y)), X)) {
        case U:
          D = (Q - W) / K + (Q < W ? 6 : 0);
          break;
        case Q:
          D = (W - U) / K + 2;
          break;
        case W:
          D = (U - Q) / K + 4;
          break;
      }
      D /= 6;
    }
    return (($.h = D), ($.s = H), ($.l = G), $);
  }
  getRGB($, J = R6.workingColorSpace) {
    return (R6.workingToColorSpace(o0.copy(this), J), ($.r = o0.r), ($.g = o0.g), ($.b = o0.b), $);
  }
  getStyle($ = "srgb") {
    R6.workingToColorSpace(o0.copy(this), $);
    let { r: J, g: U, b: Q } = o0;
    if ($ !== "srgb") return `color(${$} ${J.toFixed(3)} ${U.toFixed(3)} ${Q.toFixed(3)})`;
    return `rgb(${Math.round(J * 255)},${Math.round(U * 255)},${Math.round(Q * 255)})`;
  }
  offsetHSL($, J, U) {
    return (this.getHSL(n8), this.setHSL(n8.h + $, n8.s + J, n8.l + U));
  }
  add($) {
    return ((this.r += $.r), (this.g += $.g), (this.b += $.b), this);
  }
  addColors($, J) {
    return ((this.r = $.r + J.r), (this.g = $.g + J.g), (this.b = $.b + J.b), this);
  }
  addScalar($) {
    return ((this.r += $), (this.g += $), (this.b += $), this);
  }
  sub($) {
    return (
      (this.r = Math.max(0, this.r - $.r)),
      (this.g = Math.max(0, this.g - $.g)),
      (this.b = Math.max(0, this.b - $.b)),
      this
    );
  }
  multiply($) {
    return ((this.r *= $.r), (this.g *= $.g), (this.b *= $.b), this);
  }
  multiplyScalar($) {
    return ((this.r *= $), (this.g *= $), (this.b *= $), this);
  }
  lerp($, J) {
    return ((this.r += ($.r - this.r) * J), (this.g += ($.g - this.g) * J), (this.b += ($.b - this.b) * J), this);
  }
  lerpColors($, J, U) {
    return ((this.r = $.r + (J.r - $.r) * U), (this.g = $.g + (J.g - $.g) * U), (this.b = $.b + (J.b - $.b) * U), this);
  }
  lerpHSL($, J) {
    (this.getHSL(n8), $.getHSL(x5));
    let U = QX(n8.h, x5.h, J),
      Q = QX(n8.s, x5.s, J),
      W = QX(n8.l, x5.l, J);
    return (this.setHSL(U, Q, W), this);
  }
  setFromVector3($) {
    return ((this.r = $.x), (this.g = $.y), (this.b = $.z), this);
  }
  applyMatrix3($) {
    let J = this.r,
      U = this.g,
      Q = this.b,
      W = $.elements;
    return (
      (this.r = W[0] * J + W[3] * U + W[6] * Q),
      (this.g = W[1] * J + W[4] * U + W[7] * Q),
      (this.b = W[2] * J + W[5] * U + W[8] * Q),
      this
    );
  }
  equals($) {
    return $.r === this.r && $.g === this.g && $.b === this.b;
  }
  fromArray($, J = 0) {
    return ((this.r = $[J]), (this.g = $[J + 1]), (this.b = $[J + 2]), this);
  }
  toArray($ = [], J = 0) {
    return (($[J] = this.r), ($[J + 1] = this.g), ($[J + 2] = this.b), $);
  }
  fromBufferAttribute($, J) {
    return ((this.r = $.getX(J)), (this.g = $.getY(J)), (this.b = $.getZ(J)), this);
  }
  toJSON() {
    return this.getHex();
  }
  *[Symbol.iterator]() {
    (yield this.r, yield this.g, yield this.b);
  }
}
var o0 = new W6();
W6.NAMES = VP;
class zX {
  constructor($, J = 1, U = 1000) {
    ((this.isFog = !0), (this.name = ""), (this.color = new W6($)), (this.near = J), (this.far = U));
  }
  clone() {
    return new zX(this.color, this.near, this.far);
  }
  toJSON() {
    return { type: "Fog", name: this.name, color: this.color.getHex(), near: this.near, far: this.far };
  }
}
class AG extends F0 {
  constructor() {
    super();
    if (
      ((this.isScene = !0),
      (this.type = "Scene"),
      (this.background = null),
      (this.environment = null),
      (this.fog = null),
      (this.backgroundBlurriness = 0),
      (this.backgroundIntensity = 1),
      (this.backgroundRotation = new NU()),
      (this.environmentIntensity = 1),
      (this.environmentRotation = new NU()),
      (this.overrideMaterial = null),
      typeof __THREE_DEVTOOLS__ < "u")
    )
      __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe", { detail: this }));
  }
  copy($, J) {
    if ((super.copy($, J), $.background !== null)) this.background = $.background.clone();
    if ($.environment !== null) this.environment = $.environment.clone();
    if ($.fog !== null) this.fog = $.fog.clone();
    if (
      ((this.backgroundBlurriness = $.backgroundBlurriness),
      (this.backgroundIntensity = $.backgroundIntensity),
      this.backgroundRotation.copy($.backgroundRotation),
      (this.environmentIntensity = $.environmentIntensity),
      this.environmentRotation.copy($.environmentRotation),
      $.overrideMaterial !== null)
    )
      this.overrideMaterial = $.overrideMaterial.clone();
    return ((this.matrixAutoUpdate = $.matrixAutoUpdate), this);
  }
  toJSON($) {
    let J = super.toJSON($);
    if (this.fog !== null) J.object.fog = this.fog.toJSON();
    if (this.backgroundBlurriness > 0) J.object.backgroundBlurriness = this.backgroundBlurriness;
    if (this.backgroundIntensity !== 1) J.object.backgroundIntensity = this.backgroundIntensity;
    if (((J.object.backgroundRotation = this.backgroundRotation.toArray()), this.environmentIntensity !== 1))
      J.object.environmentIntensity = this.environmentIntensity;
    return ((J.object.environmentRotation = this.environmentRotation.toArray()), J);
  }
}
var DU = new C(),
  eU = new C(),
  Tz = new C(),
  $8 = new C(),
  I1 = new C(),
  V1 = new C(),
  UZ = new C(),
  jz = new C(),
  vz = new C(),
  bz = new C(),
  fz = new q0(),
  yz = new q0(),
  xz = new q0();
class vJ {
  constructor($ = new C(), J = new C(), U = new C()) {
    ((this.a = $), (this.b = J), (this.c = U));
  }
  static getNormal($, J, U, Q) {
    (Q.subVectors(U, J), DU.subVectors($, J), Q.cross(DU));
    let W = Q.lengthSq();
    if (W > 0) return Q.multiplyScalar(1 / Math.sqrt(W));
    return Q.set(0, 0, 0);
  }
  static getBarycoord($, J, U, Q, W) {
    (DU.subVectors(Q, J), eU.subVectors(U, J), Tz.subVectors($, J));
    let X = DU.dot(DU),
      Y = DU.dot(eU),
      D = DU.dot(Tz),
      H = eU.dot(eU),
      G = eU.dot(Tz),
      K = X * H - Y * Y;
    if (K === 0) return (W.set(0, 0, 0), null);
    let O = 1 / K,
      N = (H * D - Y * G) * O,
      F = (X * G - Y * D) * O;
    return W.set(1 - N - F, F, N);
  }
  static containsPoint($, J, U, Q) {
    if (this.getBarycoord($, J, U, Q, $8) === null) return !1;
    return $8.x >= 0 && $8.y >= 0 && $8.x + $8.y <= 1;
  }
  static getInterpolation($, J, U, Q, W, X, Y, D) {
    if (this.getBarycoord($, J, U, Q, $8) === null) {
      if (((D.x = 0), (D.y = 0), "z" in D)) D.z = 0;
      if ("w" in D) D.w = 0;
      return null;
    }
    return (D.setScalar(0), D.addScaledVector(W, $8.x), D.addScaledVector(X, $8.y), D.addScaledVector(Y, $8.z), D);
  }
  static getInterpolatedAttribute($, J, U, Q, W, X) {
    return (
      fz.setScalar(0),
      yz.setScalar(0),
      xz.setScalar(0),
      fz.fromBufferAttribute($, J),
      yz.fromBufferAttribute($, U),
      xz.fromBufferAttribute($, Q),
      X.setScalar(0),
      X.addScaledVector(fz, W.x),
      X.addScaledVector(yz, W.y),
      X.addScaledVector(xz, W.z),
      X
    );
  }
  static isFrontFacing($, J, U, Q) {
    return (DU.subVectors(U, J), eU.subVectors($, J), DU.cross(eU).dot(Q) < 0);
  }
  set($, J, U) {
    return (this.a.copy($), this.b.copy(J), this.c.copy(U), this);
  }
  setFromPointsAndIndices($, J, U, Q) {
    return (this.a.copy($[J]), this.b.copy($[U]), this.c.copy($[Q]), this);
  }
  setFromAttributeAndIndices($, J, U, Q) {
    return (this.a.fromBufferAttribute($, J), this.b.fromBufferAttribute($, U), this.c.fromBufferAttribute($, Q), this);
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy($) {
    return (this.a.copy($.a), this.b.copy($.b), this.c.copy($.c), this);
  }
  getArea() {
    return (DU.subVectors(this.c, this.b), eU.subVectors(this.a, this.b), DU.cross(eU).length() * 0.5);
  }
  getMidpoint($) {
    return $.addVectors(this.a, this.b).add(this.c).multiplyScalar(0.3333333333333333);
  }
  getNormal($) {
    return vJ.getNormal(this.a, this.b, this.c, $);
  }
  getPlane($) {
    return $.setFromCoplanarPoints(this.a, this.b, this.c);
  }
  getBarycoord($, J) {
    return vJ.getBarycoord($, this.a, this.b, this.c, J);
  }
  getInterpolation($, J, U, Q, W) {
    return vJ.getInterpolation($, this.a, this.b, this.c, J, U, Q, W);
  }
  containsPoint($) {
    return vJ.containsPoint($, this.a, this.b, this.c);
  }
  isFrontFacing($) {
    return vJ.isFrontFacing(this.a, this.b, this.c, $);
  }
  intersectsBox($) {
    return $.intersectsTriangle(this);
  }
  closestPointToPoint($, J) {
    let U = this.a,
      Q = this.b,
      W = this.c,
      X,
      Y;
    (I1.subVectors(Q, U), V1.subVectors(W, U), jz.subVectors($, U));
    let D = I1.dot(jz),
      H = V1.dot(jz);
    if (D <= 0 && H <= 0) return J.copy(U);
    vz.subVectors($, Q);
    let G = I1.dot(vz),
      K = V1.dot(vz);
    if (G >= 0 && K <= G) return J.copy(Q);
    let O = D * K - G * H;
    if (O <= 0 && D >= 0 && G <= 0) return ((X = D / (D - G)), J.copy(U).addScaledVector(I1, X));
    bz.subVectors($, W);
    let N = I1.dot(bz),
      F = V1.dot(bz);
    if (F >= 0 && N <= F) return J.copy(W);
    let B = N * H - D * F;
    if (B <= 0 && H >= 0 && F <= 0) return ((Y = H / (H - F)), J.copy(U).addScaledVector(V1, Y));
    let E = G * F - N * K;
    if (E <= 0 && K - G >= 0 && N - F >= 0)
      return (UZ.subVectors(W, Q), (Y = (K - G) / (K - G + (N - F))), J.copy(Q).addScaledVector(UZ, Y));
    let z = 1 / (E + B + O);
    return ((X = B * z), (Y = O * z), J.copy(U).addScaledVector(I1, X).addScaledVector(V1, Y));
  }
  equals($) {
    return $.a.equals(this.a) && $.b.equals(this.b) && $.c.equals(this.c);
  }
}
class bU {
  constructor($ = new C(1 / 0, 1 / 0, 1 / 0), J = new C(-1 / 0, -1 / 0, -1 / 0)) {
    ((this.isBox3 = !0), (this.min = $), (this.max = J));
  }
  set($, J) {
    return (this.min.copy($), this.max.copy(J), this);
  }
  setFromArray($) {
    this.makeEmpty();
    for (let J = 0, U = $.length; J < U; J += 3) this.expandByPoint(HU.fromArray($, J));
    return this;
  }
  setFromBufferAttribute($) {
    this.makeEmpty();
    for (let J = 0, U = $.count; J < U; J++) this.expandByPoint(HU.fromBufferAttribute($, J));
    return this;
  }
  setFromPoints($) {
    this.makeEmpty();
    for (let J = 0, U = $.length; J < U; J++) this.expandByPoint($[J]);
    return this;
  }
  setFromCenterAndSize($, J) {
    let U = HU.copy(J).multiplyScalar(0.5);
    return (this.min.copy($).sub(U), this.max.copy($).add(U), this);
  }
  setFromObject($, J = !1) {
    return (this.makeEmpty(), this.expandByObject($, J));
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy($) {
    return (this.min.copy($.min), this.max.copy($.max), this);
  }
  makeEmpty() {
    return ((this.min.x = this.min.y = this.min.z = 1 / 0), (this.max.x = this.max.y = this.max.z = -1 / 0), this);
  }
  isEmpty() {
    return this.max.x < this.min.x || this.max.y < this.min.y || this.max.z < this.min.z;
  }
  getCenter($) {
    return this.isEmpty() ? $.set(0, 0, 0) : $.addVectors(this.min, this.max).multiplyScalar(0.5);
  }
  getSize($) {
    return this.isEmpty() ? $.set(0, 0, 0) : $.subVectors(this.max, this.min);
  }
  expandByPoint($) {
    return (this.min.min($), this.max.max($), this);
  }
  expandByVector($) {
    return (this.min.sub($), this.max.add($), this);
  }
  expandByScalar($) {
    return (this.min.addScalar(-$), this.max.addScalar($), this);
  }
  expandByObject($, J = !1) {
    $.updateWorldMatrix(!1, !1);
    let U = $.geometry;
    if (U !== void 0) {
      let W = U.getAttribute("position");
      if (J === !0 && W !== void 0 && $.isInstancedMesh !== !0)
        for (let X = 0, Y = W.count; X < Y; X++) {
          if ($.isMesh === !0) $.getVertexPosition(X, HU);
          else HU.fromBufferAttribute(W, X);
          (HU.applyMatrix4($.matrixWorld), this.expandByPoint(HU));
        }
      else {
        if ($.boundingBox !== void 0) {
          if ($.boundingBox === null) $.computeBoundingBox();
          g5.copy($.boundingBox);
        } else {
          if (U.boundingBox === null) U.computeBoundingBox();
          g5.copy(U.boundingBox);
        }
        (g5.applyMatrix4($.matrixWorld), this.union(g5));
      }
    }
    let Q = $.children;
    for (let W = 0, X = Q.length; W < X; W++) this.expandByObject(Q[W], J);
    return this;
  }
  containsPoint($) {
    return (
      $.x >= this.min.x &&
      $.x <= this.max.x &&
      $.y >= this.min.y &&
      $.y <= this.max.y &&
      $.z >= this.min.z &&
      $.z <= this.max.z
    );
  }
  containsBox($) {
    return (
      this.min.x <= $.min.x &&
      $.max.x <= this.max.x &&
      this.min.y <= $.min.y &&
      $.max.y <= this.max.y &&
      this.min.z <= $.min.z &&
      $.max.z <= this.max.z
    );
  }
  getParameter($, J) {
    return J.set(
      ($.x - this.min.x) / (this.max.x - this.min.x),
      ($.y - this.min.y) / (this.max.y - this.min.y),
      ($.z - this.min.z) / (this.max.z - this.min.z),
    );
  }
  intersectsBox($) {
    return (
      $.max.x >= this.min.x &&
      $.min.x <= this.max.x &&
      $.max.y >= this.min.y &&
      $.min.y <= this.max.y &&
      $.max.z >= this.min.z &&
      $.min.z <= this.max.z
    );
  }
  intersectsSphere($) {
    return (this.clampPoint($.center, HU), HU.distanceToSquared($.center) <= $.radius * $.radius);
  }
  intersectsPlane($) {
    let J, U;
    if ($.normal.x > 0) ((J = $.normal.x * this.min.x), (U = $.normal.x * this.max.x));
    else ((J = $.normal.x * this.max.x), (U = $.normal.x * this.min.x));
    if ($.normal.y > 0) ((J += $.normal.y * this.min.y), (U += $.normal.y * this.max.y));
    else ((J += $.normal.y * this.max.y), (U += $.normal.y * this.min.y));
    if ($.normal.z > 0) ((J += $.normal.z * this.min.z), (U += $.normal.z * this.max.z));
    else ((J += $.normal.z * this.max.z), (U += $.normal.z * this.min.z));
    return J <= -$.constant && U >= -$.constant;
  }
  intersectsTriangle($) {
    if (this.isEmpty()) return !1;
    (this.getCenter(sQ),
      h5.subVectors(this.max, sQ),
      k1.subVectors($.a, sQ),
      A1.subVectors($.b, sQ),
      M1.subVectors($.c, sQ),
      i8.subVectors(A1, k1),
      o8.subVectors(M1, A1),
      v9.subVectors(k1, M1));
    let J = [
      0,
      -i8.z,
      i8.y,
      0,
      -o8.z,
      o8.y,
      0,
      -v9.z,
      v9.y,
      i8.z,
      0,
      -i8.x,
      o8.z,
      0,
      -o8.x,
      v9.z,
      0,
      -v9.x,
      -i8.y,
      i8.x,
      0,
      -o8.y,
      o8.x,
      0,
      -v9.y,
      v9.x,
      0,
    ];
    if (!gz(J, k1, A1, M1, h5)) return !1;
    if (((J = [1, 0, 0, 0, 1, 0, 0, 0, 1]), !gz(J, k1, A1, M1, h5))) return !1;
    return (u5.crossVectors(i8, o8), (J = [u5.x, u5.y, u5.z]), gz(J, k1, A1, M1, h5));
  }
  clampPoint($, J) {
    return J.copy($).clamp(this.min, this.max);
  }
  distanceToPoint($) {
    return this.clampPoint($, HU).distanceTo($);
  }
  getBoundingSphere($) {
    if (this.isEmpty()) $.makeEmpty();
    else (this.getCenter($.center), ($.radius = this.getSize(HU).length() * 0.5));
    return $;
  }
  intersect($) {
    if ((this.min.max($.min), this.max.min($.max), this.isEmpty())) this.makeEmpty();
    return this;
  }
  union($) {
    return (this.min.min($.min), this.max.max($.max), this);
  }
  applyMatrix4($) {
    if (this.isEmpty()) return this;
    return (
      J8[0].set(this.min.x, this.min.y, this.min.z).applyMatrix4($),
      J8[1].set(this.min.x, this.min.y, this.max.z).applyMatrix4($),
      J8[2].set(this.min.x, this.max.y, this.min.z).applyMatrix4($),
      J8[3].set(this.min.x, this.max.y, this.max.z).applyMatrix4($),
      J8[4].set(this.max.x, this.min.y, this.min.z).applyMatrix4($),
      J8[5].set(this.max.x, this.min.y, this.max.z).applyMatrix4($),
      J8[6].set(this.max.x, this.max.y, this.min.z).applyMatrix4($),
      J8[7].set(this.max.x, this.max.y, this.max.z).applyMatrix4($),
      this.setFromPoints(J8),
      this
    );
  }
  translate($) {
    return (this.min.add($), this.max.add($), this);
  }
  equals($) {
    return $.min.equals(this.min) && $.max.equals(this.max);
  }
  toJSON() {
    return { min: this.min.toArray(), max: this.max.toArray() };
  }
  fromJSON($) {
    return (this.min.fromArray($.min), this.max.fromArray($.max), this);
  }
}
var J8 = [new C(), new C(), new C(), new C(), new C(), new C(), new C(), new C()],
  HU = new C(),
  g5 = new bU(),
  k1 = new C(),
  A1 = new C(),
  M1 = new C(),
  i8 = new C(),
  o8 = new C(),
  v9 = new C(),
  sQ = new C(),
  h5 = new C(),
  u5 = new C(),
  b9 = new C();
function gz($, J, U, Q, W) {
  for (let X = 0, Y = $.length - 3; X <= Y; X += 3) {
    b9.fromArray($, X);
    let D = W.x * Math.abs(b9.x) + W.y * Math.abs(b9.y) + W.z * Math.abs(b9.z),
      H = J.dot(b9),
      G = U.dot(b9),
      K = Q.dot(b9);
    if (Math.max(-Math.max(H, G, K), Math.min(H, G, K)) > D) return !1;
  }
  return !0;
}
var Z0 = new C(),
  l5 = new d$(),
  Am = 0;
class bJ extends vU {
  constructor($, J, U = !1) {
    super();
    if (Array.isArray($)) throw TypeError("THREE.BufferAttribute: array should be a Typed Array.");
    ((this.isBufferAttribute = !0),
      Object.defineProperty(this, "id", { value: Am++ }),
      (this.name = ""),
      (this.array = $),
      (this.itemSize = J),
      (this.count = $ !== void 0 ? $.length / J : 0),
      (this.normalized = U),
      (this.usage = 35044),
      (this.updateRanges = []),
      (this.gpuType = 1015),
      (this.version = 0));
  }
  onUploadCallback() {}
  set needsUpdate($) {
    if ($ === !0) this.version++;
  }
  setUsage($) {
    return ((this.usage = $), this);
  }
  addUpdateRange($, J) {
    this.updateRanges.push({ start: $, count: J });
  }
  clearUpdateRanges() {
    this.updateRanges.length = 0;
  }
  copy($) {
    return (
      (this.name = $.name),
      (this.array = new $.array.constructor($.array)),
      (this.itemSize = $.itemSize),
      (this.count = $.count),
      (this.normalized = $.normalized),
      (this.usage = $.usage),
      (this.gpuType = $.gpuType),
      this
    );
  }
  copyAt($, J, U) {
    (($ *= this.itemSize), (U *= J.itemSize));
    for (let Q = 0, W = this.itemSize; Q < W; Q++) this.array[$ + Q] = J.array[U + Q];
    return this;
  }
  copyArray($) {
    return (this.array.set($), this);
  }
  applyMatrix3($) {
    if (this.itemSize === 2)
      for (let J = 0, U = this.count; J < U; J++)
        (l5.fromBufferAttribute(this, J), l5.applyMatrix3($), this.setXY(J, l5.x, l5.y));
    else if (this.itemSize === 3)
      for (let J = 0, U = this.count; J < U; J++)
        (Z0.fromBufferAttribute(this, J), Z0.applyMatrix3($), this.setXYZ(J, Z0.x, Z0.y, Z0.z));
    return this;
  }
  applyMatrix4($) {
    for (let J = 0, U = this.count; J < U; J++)
      (Z0.fromBufferAttribute(this, J), Z0.applyMatrix4($), this.setXYZ(J, Z0.x, Z0.y, Z0.z));
    return this;
  }
  applyNormalMatrix($) {
    for (let J = 0, U = this.count; J < U; J++)
      (Z0.fromBufferAttribute(this, J), Z0.applyNormalMatrix($), this.setXYZ(J, Z0.x, Z0.y, Z0.z));
    return this;
  }
  transformDirection($) {
    for (let J = 0, U = this.count; J < U; J++)
      (Z0.fromBufferAttribute(this, J), Z0.transformDirection($), this.setXYZ(J, Z0.x, Z0.y, Z0.z));
    return this;
  }
  set($, J = 0) {
    return (this.array.set($, J), this);
  }
  getComponent($, J) {
    let U = this.array[$ * this.itemSize + J];
    if (this.normalized) U = KU(U, this.array);
    return U;
  }
  setComponent($, J, U) {
    if (this.normalized) U = l6(U, this.array);
    return ((this.array[$ * this.itemSize + J] = U), this);
  }
  getX($) {
    let J = this.array[$ * this.itemSize];
    if (this.normalized) J = KU(J, this.array);
    return J;
  }
  setX($, J) {
    if (this.normalized) J = l6(J, this.array);
    return ((this.array[$ * this.itemSize] = J), this);
  }
  getY($) {
    let J = this.array[$ * this.itemSize + 1];
    if (this.normalized) J = KU(J, this.array);
    return J;
  }
  setY($, J) {
    if (this.normalized) J = l6(J, this.array);
    return ((this.array[$ * this.itemSize + 1] = J), this);
  }
  getZ($) {
    let J = this.array[$ * this.itemSize + 2];
    if (this.normalized) J = KU(J, this.array);
    return J;
  }
  setZ($, J) {
    if (this.normalized) J = l6(J, this.array);
    return ((this.array[$ * this.itemSize + 2] = J), this);
  }
  getW($) {
    let J = this.array[$ * this.itemSize + 3];
    if (this.normalized) J = KU(J, this.array);
    return J;
  }
  setW($, J) {
    if (this.normalized) J = l6(J, this.array);
    return ((this.array[$ * this.itemSize + 3] = J), this);
  }
  setXY($, J, U) {
    if ((($ *= this.itemSize), this.normalized)) ((J = l6(J, this.array)), (U = l6(U, this.array)));
    return ((this.array[$ + 0] = J), (this.array[$ + 1] = U), this);
  }
  setXYZ($, J, U, Q) {
    if ((($ *= this.itemSize), this.normalized))
      ((J = l6(J, this.array)), (U = l6(U, this.array)), (Q = l6(Q, this.array)));
    return ((this.array[$ + 0] = J), (this.array[$ + 1] = U), (this.array[$ + 2] = Q), this);
  }
  setXYZW($, J, U, Q, W) {
    if ((($ *= this.itemSize), this.normalized))
      ((J = l6(J, this.array)), (U = l6(U, this.array)), (Q = l6(Q, this.array)), (W = l6(W, this.array)));
    return ((this.array[$ + 0] = J), (this.array[$ + 1] = U), (this.array[$ + 2] = Q), (this.array[$ + 3] = W), this);
  }
  onUpload($) {
    return ((this.onUploadCallback = $), this);
  }
  clone() {
    return new this.constructor(this.array, this.itemSize).copy(this);
  }
  toJSON() {
    let $ = {
      itemSize: this.itemSize,
      type: this.array.constructor.name,
      array: Array.from(this.array),
      normalized: this.normalized,
    };
    if (this.name !== "") $.name = this.name;
    if (this.usage !== 35044) $.usage = this.usage;
    return $;
  }
  dispose() {
    this.dispatchEvent({ type: "dispose" });
  }
}
class MG extends bJ {
  constructor($, J, U) {
    super(new Uint16Array($), J, U);
  }
}
class RG extends bJ {
  constructor($, J, U) {
    super(new Uint32Array($), J, U);
  }
}
class S6 extends bJ {
  constructor($, J, U) {
    super(new Float32Array($), J, U);
  }
}
var Mm = new bU(),
  aQ = new C(),
  hz = new C();
class p1 {
  constructor($ = new C(), J = -1) {
    ((this.isSphere = !0), (this.center = $), (this.radius = J));
  }
  set($, J) {
    return (this.center.copy($), (this.radius = J), this);
  }
  setFromPoints($, J) {
    let U = this.center;
    if (J !== void 0) U.copy(J);
    else Mm.setFromPoints($).getCenter(U);
    let Q = 0;
    for (let W = 0, X = $.length; W < X; W++) Q = Math.max(Q, U.distanceToSquared($[W]));
    return ((this.radius = Math.sqrt(Q)), this);
  }
  copy($) {
    return (this.center.copy($.center), (this.radius = $.radius), this);
  }
  isEmpty() {
    return this.radius < 0;
  }
  makeEmpty() {
    return (this.center.set(0, 0, 0), (this.radius = -1), this);
  }
  containsPoint($) {
    return $.distanceToSquared(this.center) <= this.radius * this.radius;
  }
  distanceToPoint($) {
    return $.distanceTo(this.center) - this.radius;
  }
  intersectsSphere($) {
    let J = this.radius + $.radius;
    return $.center.distanceToSquared(this.center) <= J * J;
  }
  intersectsBox($) {
    return $.intersectsSphere(this);
  }
  intersectsPlane($) {
    return Math.abs($.distanceToPoint(this.center)) <= this.radius;
  }
  clampPoint($, J) {
    let U = this.center.distanceToSquared($);
    if ((J.copy($), U > this.radius * this.radius))
      (J.sub(this.center).normalize(), J.multiplyScalar(this.radius).add(this.center));
    return J;
  }
  getBoundingBox($) {
    if (this.isEmpty()) return ($.makeEmpty(), $);
    return ($.set(this.center, this.center), $.expandByScalar(this.radius), $);
  }
  applyMatrix4($) {
    return (this.center.applyMatrix4($), (this.radius = this.radius * $.getMaxScaleOnAxis()), this);
  }
  translate($) {
    return (this.center.add($), this);
  }
  expandByPoint($) {
    if (this.isEmpty()) return (this.center.copy($), (this.radius = 0), this);
    aQ.subVectors($, this.center);
    let J = aQ.lengthSq();
    if (J > this.radius * this.radius) {
      let U = Math.sqrt(J),
        Q = (U - this.radius) * 0.5;
      (this.center.addScaledVector(aQ, Q / U), (this.radius += Q));
    }
    return this;
  }
  union($) {
    if ($.isEmpty()) return this;
    if (this.isEmpty()) return (this.copy($), this);
    if (this.center.equals($.center) === !0) this.radius = Math.max(this.radius, $.radius);
    else
      (hz.subVectors($.center, this.center).setLength($.radius),
        this.expandByPoint(aQ.copy($.center).add(hz)),
        this.expandByPoint(aQ.copy($.center).sub(hz)));
    return this;
  }
  equals($) {
    return $.center.equals(this.center) && $.radius === this.radius;
  }
  clone() {
    return new this.constructor().copy(this);
  }
  toJSON() {
    return { radius: this.radius, center: this.center.toArray() };
  }
  fromJSON($) {
    return ((this.radius = $.radius), this.center.fromArray($.center), this);
  }
}
var Rm = 0,
  mJ = new x6(),
  uz = new F0(),
  R1 = new C(),
  jJ = new bU(),
  tQ = new bU(),
  T0 = new C();
class Q0 extends vU {
  constructor() {
    super();
    ((this.isBufferGeometry = !0),
      Object.defineProperty(this, "id", { value: Rm++ }),
      (this.uuid = W8()),
      (this.name = ""),
      (this.type = "BufferGeometry"),
      (this.index = null),
      (this.indirect = null),
      (this.indirectOffset = 0),
      (this.attributes = {}),
      (this.morphAttributes = {}),
      (this.morphTargetsRelative = !1),
      (this.groups = []),
      (this.boundingBox = null),
      (this.boundingSphere = null),
      (this.drawRange = { start: 0, count: 1 / 0 }),
      (this.userData = {}));
  }
  getIndex() {
    return this.index;
  }
  setIndex($) {
    if (Array.isArray($)) this.index = new (rl($) ? RG : MG)($, 1);
    else this.index = $;
    return this;
  }
  setIndirect($, J = 0) {
    return ((this.indirect = $), (this.indirectOffset = J), this);
  }
  getIndirect() {
    return this.indirect;
  }
  getAttribute($) {
    return this.attributes[$];
  }
  setAttribute($, J) {
    return ((this.attributes[$] = J), this);
  }
  deleteAttribute($) {
    return (delete this.attributes[$], this);
  }
  hasAttribute($) {
    return this.attributes[$] !== void 0;
  }
  addGroup($, J, U = 0) {
    this.groups.push({ start: $, count: J, materialIndex: U });
  }
  clearGroups() {
    this.groups = [];
  }
  setDrawRange($, J) {
    ((this.drawRange.start = $), (this.drawRange.count = J));
  }
  applyMatrix4($) {
    let J = this.attributes.position;
    if (J !== void 0) (J.applyMatrix4($), (J.needsUpdate = !0));
    let U = this.attributes.normal;
    if (U !== void 0) {
      let W = new X6().getNormalMatrix($);
      (U.applyNormalMatrix(W), (U.needsUpdate = !0));
    }
    let Q = this.attributes.tangent;
    if (Q !== void 0) (Q.transformDirection($), (Q.needsUpdate = !0));
    if (this.boundingBox !== null) this.computeBoundingBox();
    if (this.boundingSphere !== null) this.computeBoundingSphere();
    return this;
  }
  applyQuaternion($) {
    return (mJ.makeRotationFromQuaternion($), this.applyMatrix4(mJ), this);
  }
  rotateX($) {
    return (mJ.makeRotationX($), this.applyMatrix4(mJ), this);
  }
  rotateY($) {
    return (mJ.makeRotationY($), this.applyMatrix4(mJ), this);
  }
  rotateZ($) {
    return (mJ.makeRotationZ($), this.applyMatrix4(mJ), this);
  }
  translate($, J, U) {
    return (mJ.makeTranslation($, J, U), this.applyMatrix4(mJ), this);
  }
  scale($, J, U) {
    return (mJ.makeScale($, J, U), this.applyMatrix4(mJ), this);
  }
  lookAt($) {
    return (uz.lookAt($), uz.updateMatrix(), this.applyMatrix4(uz.matrix), this);
  }
  center() {
    return (this.computeBoundingBox(), this.boundingBox.getCenter(R1).negate(), this.translate(R1.x, R1.y, R1.z), this);
  }
  setFromPoints($) {
    let J = this.getAttribute("position");
    if (J === void 0) {
      let U = [];
      for (let Q = 0, W = $.length; Q < W; Q++) {
        let X = $[Q];
        U.push(X.x, X.y, X.z || 0);
      }
      this.setAttribute("position", new S6(U, 3));
    } else {
      let U = Math.min($.length, J.count);
      for (let Q = 0; Q < U; Q++) {
        let W = $[Q];
        J.setXYZ(Q, W.x, W.y, W.z || 0);
      }
      if ($.length > J.count)
        i$("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry.");
      J.needsUpdate = !0;
    }
    return this;
  }
  computeBoundingBox() {
    if (this.boundingBox === null) this.boundingBox = new bU();
    let $ = this.attributes.position,
      J = this.morphAttributes.position;
    if ($ && $.isGLBufferAttribute) {
      (s$("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.", this),
        this.boundingBox.set(new C(-1 / 0, -1 / 0, -1 / 0), new C(1 / 0, 1 / 0, 1 / 0)));
      return;
    }
    if ($ !== void 0) {
      if ((this.boundingBox.setFromBufferAttribute($), J))
        for (let U = 0, Q = J.length; U < Q; U++) {
          let W = J[U];
          if ((jJ.setFromBufferAttribute(W), this.morphTargetsRelative))
            (T0.addVectors(this.boundingBox.min, jJ.min),
              this.boundingBox.expandByPoint(T0),
              T0.addVectors(this.boundingBox.max, jJ.max),
              this.boundingBox.expandByPoint(T0));
          else (this.boundingBox.expandByPoint(jJ.min), this.boundingBox.expandByPoint(jJ.max));
        }
    } else this.boundingBox.makeEmpty();
    if (isNaN(this.boundingBox.min.x) || isNaN(this.boundingBox.min.y) || isNaN(this.boundingBox.min.z))
      s$(
        'BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',
        this,
      );
  }
  computeBoundingSphere() {
    if (this.boundingSphere === null) this.boundingSphere = new p1();
    let $ = this.attributes.position,
      J = this.morphAttributes.position;
    if ($ && $.isGLBufferAttribute) {
      (s$("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.", this),
        this.boundingSphere.set(new C(), 1 / 0));
      return;
    }
    if ($) {
      let U = this.boundingSphere.center;
      if ((jJ.setFromBufferAttribute($), J))
        for (let W = 0, X = J.length; W < X; W++) {
          let Y = J[W];
          if ((tQ.setFromBufferAttribute(Y), this.morphTargetsRelative))
            (T0.addVectors(jJ.min, tQ.min), jJ.expandByPoint(T0), T0.addVectors(jJ.max, tQ.max), jJ.expandByPoint(T0));
          else (jJ.expandByPoint(tQ.min), jJ.expandByPoint(tQ.max));
        }
      jJ.getCenter(U);
      let Q = 0;
      for (let W = 0, X = $.count; W < X; W++)
        (T0.fromBufferAttribute($, W), (Q = Math.max(Q, U.distanceToSquared(T0))));
      if (J)
        for (let W = 0, X = J.length; W < X; W++) {
          let Y = J[W],
            D = this.morphTargetsRelative;
          for (let H = 0, G = Y.count; H < G; H++) {
            if ((T0.fromBufferAttribute(Y, H), D)) (R1.fromBufferAttribute($, H), T0.add(R1));
            Q = Math.max(Q, U.distanceToSquared(T0));
          }
        }
      if (((this.boundingSphere.radius = Math.sqrt(Q)), isNaN(this.boundingSphere.radius)))
        s$(
          'BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',
          this,
        );
    }
  }
  computeTangents() {
    let $ = this.index,
      J = this.attributes;
    if ($ === null || J.position === void 0 || J.normal === void 0 || J.uv === void 0) {
      s$("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");
      return;
    }
    let { position: U, normal: Q, uv: W } = J;
    if (this.hasAttribute("tangent") === !1) this.setAttribute("tangent", new bJ(new Float32Array(4 * U.count), 4));
    let X = this.getAttribute("tangent"),
      Y = [],
      D = [];
    for (let S = 0; S < U.count; S++) ((Y[S] = new C()), (D[S] = new C()));
    let H = new C(),
      G = new C(),
      K = new C(),
      O = new d$(),
      N = new d$(),
      F = new d$(),
      B = new C(),
      E = new C();
    function z(S, w, M) {
      (H.fromBufferAttribute(U, S),
        G.fromBufferAttribute(U, w),
        K.fromBufferAttribute(U, M),
        O.fromBufferAttribute(W, S),
        N.fromBufferAttribute(W, w),
        F.fromBufferAttribute(W, M),
        G.sub(H),
        K.sub(H),
        N.sub(O),
        F.sub(O));
      let m = 1 / (N.x * F.y - F.x * N.y);
      if (!isFinite(m)) return;
      (B.copy(G).multiplyScalar(F.y).addScaledVector(K, -N.y).multiplyScalar(m),
        E.copy(K).multiplyScalar(N.x).addScaledVector(G, -F.x).multiplyScalar(m),
        Y[S].add(B),
        Y[w].add(B),
        Y[M].add(B),
        D[S].add(E),
        D[w].add(E),
        D[M].add(E));
    }
    let q = this.groups;
    if (q.length === 0) q = [{ start: 0, count: $.count }];
    for (let S = 0, w = q.length; S < w; ++S) {
      let M = q[S],
        m = M.start,
        P = M.count;
      for (let u = m, n = m + P; u < n; u += 3) z($.getX(u + 0), $.getX(u + 1), $.getX(u + 2));
    }
    let L = new C(),
      V = new C(),
      k = new C(),
      R = new C();
    function _(S) {
      (k.fromBufferAttribute(Q, S), R.copy(k));
      let w = Y[S];
      (L.copy(w), L.sub(k.multiplyScalar(k.dot(w))).normalize(), V.crossVectors(R, w));
      let m = V.dot(D[S]) < 0 ? -1 : 1;
      X.setXYZW(S, L.x, L.y, L.z, m);
    }
    for (let S = 0, w = q.length; S < w; ++S) {
      let M = q[S],
        m = M.start,
        P = M.count;
      for (let u = m, n = m + P; u < n; u += 3) (_($.getX(u + 0)), _($.getX(u + 1)), _($.getX(u + 2)));
    }
  }
  computeVertexNormals() {
    let $ = this.index,
      J = this.getAttribute("position");
    if (J !== void 0) {
      let U = this.getAttribute("normal");
      if (U === void 0) ((U = new bJ(new Float32Array(J.count * 3), 3)), this.setAttribute("normal", U));
      else for (let O = 0, N = U.count; O < N; O++) U.setXYZ(O, 0, 0, 0);
      let Q = new C(),
        W = new C(),
        X = new C(),
        Y = new C(),
        D = new C(),
        H = new C(),
        G = new C(),
        K = new C();
      if ($)
        for (let O = 0, N = $.count; O < N; O += 3) {
          let F = $.getX(O + 0),
            B = $.getX(O + 1),
            E = $.getX(O + 2);
          (Q.fromBufferAttribute(J, F),
            W.fromBufferAttribute(J, B),
            X.fromBufferAttribute(J, E),
            G.subVectors(X, W),
            K.subVectors(Q, W),
            G.cross(K),
            Y.fromBufferAttribute(U, F),
            D.fromBufferAttribute(U, B),
            H.fromBufferAttribute(U, E),
            Y.add(G),
            D.add(G),
            H.add(G),
            U.setXYZ(F, Y.x, Y.y, Y.z),
            U.setXYZ(B, D.x, D.y, D.z),
            U.setXYZ(E, H.x, H.y, H.z));
        }
      else
        for (let O = 0, N = J.count; O < N; O += 3)
          (Q.fromBufferAttribute(J, O + 0),
            W.fromBufferAttribute(J, O + 1),
            X.fromBufferAttribute(J, O + 2),
            G.subVectors(X, W),
            K.subVectors(Q, W),
            G.cross(K),
            U.setXYZ(O + 0, G.x, G.y, G.z),
            U.setXYZ(O + 1, G.x, G.y, G.z),
            U.setXYZ(O + 2, G.x, G.y, G.z));
      (this.normalizeNormals(), (U.needsUpdate = !0));
    }
  }
  normalizeNormals() {
    let $ = this.attributes.normal;
    for (let J = 0, U = $.count; J < U; J++)
      (T0.fromBufferAttribute($, J), T0.normalize(), $.setXYZ(J, T0.x, T0.y, T0.z));
  }
  toNonIndexed() {
    function $(Y, D) {
      let { array: H, itemSize: G, normalized: K } = Y,
        O = new H.constructor(D.length * G),
        N = 0,
        F = 0;
      for (let B = 0, E = D.length; B < E; B++) {
        if (Y.isInterleavedBufferAttribute) N = D[B] * Y.data.stride + Y.offset;
        else N = D[B] * G;
        for (let z = 0; z < G; z++) O[F++] = H[N++];
      }
      return new bJ(O, G, K);
    }
    if (this.index === null) return (i$("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."), this);
    let J = new Q0(),
      U = this.index.array,
      Q = this.attributes;
    for (let Y in Q) {
      let D = Q[Y],
        H = $(D, U);
      J.setAttribute(Y, H);
    }
    let W = this.morphAttributes;
    for (let Y in W) {
      let D = [],
        H = W[Y];
      for (let G = 0, K = H.length; G < K; G++) {
        let O = H[G],
          N = $(O, U);
        D.push(N);
      }
      J.morphAttributes[Y] = D;
    }
    J.morphTargetsRelative = this.morphTargetsRelative;
    let X = this.groups;
    for (let Y = 0, D = X.length; Y < D; Y++) {
      let H = X[Y];
      J.addGroup(H.start, H.count, H.materialIndex);
    }
    return J;
  }
  toJSON() {
    let $ = { metadata: { version: 4.7, type: "BufferGeometry", generator: "BufferGeometry.toJSON" } };
    if ((($.uuid = this.uuid), ($.type = this.type), this.name !== "")) $.name = this.name;
    if (Object.keys(this.userData).length > 0) $.userData = this.userData;
    if (this.parameters !== void 0) {
      let D = this.parameters;
      for (let H in D) if (D[H] !== void 0) $[H] = D[H];
      return $;
    }
    $.data = { attributes: {} };
    let J = this.index;
    if (J !== null) $.data.index = { type: J.array.constructor.name, array: Array.prototype.slice.call(J.array) };
    let U = this.attributes;
    for (let D in U) {
      let H = U[D];
      $.data.attributes[D] = H.toJSON($.data);
    }
    let Q = {},
      W = !1;
    for (let D in this.morphAttributes) {
      let H = this.morphAttributes[D],
        G = [];
      for (let K = 0, O = H.length; K < O; K++) {
        let N = H[K];
        G.push(N.toJSON($.data));
      }
      if (G.length > 0) ((Q[D] = G), (W = !0));
    }
    if (W) (($.data.morphAttributes = Q), ($.data.morphTargetsRelative = this.morphTargetsRelative));
    let X = this.groups;
    if (X.length > 0) $.data.groups = JSON.parse(JSON.stringify(X));
    let Y = this.boundingSphere;
    if (Y !== null) $.data.boundingSphere = Y.toJSON();
    return $;
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy($) {
    ((this.index = null),
      (this.attributes = {}),
      (this.morphAttributes = {}),
      (this.groups = []),
      (this.boundingBox = null),
      (this.boundingSphere = null));
    let J = {};
    this.name = $.name;
    let U = $.index;
    if (U !== null) this.setIndex(U.clone());
    let Q = $.attributes;
    for (let H in Q) {
      let G = Q[H];
      this.setAttribute(H, G.clone(J));
    }
    let W = $.morphAttributes;
    for (let H in W) {
      let G = [],
        K = W[H];
      for (let O = 0, N = K.length; O < N; O++) G.push(K[O].clone(J));
      this.morphAttributes[H] = G;
    }
    this.morphTargetsRelative = $.morphTargetsRelative;
    let X = $.groups;
    for (let H = 0, G = X.length; H < G; H++) {
      let K = X[H];
      this.addGroup(K.start, K.count, K.materialIndex);
    }
    let Y = $.boundingBox;
    if (Y !== null) this.boundingBox = Y.clone();
    let D = $.boundingSphere;
    if (D !== null) this.boundingSphere = D.clone();
    return (
      (this.drawRange.start = $.drawRange.start),
      (this.drawRange.count = $.drawRange.count),
      (this.userData = $.userData),
      this
    );
  }
  dispose() {
    this.dispatchEvent({ type: "dispose" });
  }
}
class $E {
  constructor($, J) {
    ((this.isInterleavedBuffer = !0),
      (this.array = $),
      (this.stride = J),
      (this.count = $ !== void 0 ? $.length / J : 0),
      (this.usage = 35044),
      (this.updateRanges = []),
      (this.version = 0),
      (this.uuid = W8()));
  }
  onUploadCallback() {}
  set needsUpdate($) {
    if ($ === !0) this.version++;
  }
  setUsage($) {
    return ((this.usage = $), this);
  }
  addUpdateRange($, J) {
    this.updateRanges.push({ start: $, count: J });
  }
  clearUpdateRanges() {
    this.updateRanges.length = 0;
  }
  copy($) {
    return (
      (this.array = new $.array.constructor($.array)),
      (this.count = $.count),
      (this.stride = $.stride),
      (this.usage = $.usage),
      this
    );
  }
  copyAt($, J, U) {
    (($ *= this.stride), (U *= J.stride));
    for (let Q = 0, W = this.stride; Q < W; Q++) this.array[$ + Q] = J.array[U + Q];
    return this;
  }
  set($, J = 0) {
    return (this.array.set($, J), this);
  }
  clone($) {
    if ($.arrayBuffers === void 0) $.arrayBuffers = {};
    if (this.array.buffer._uuid === void 0) this.array.buffer._uuid = W8();
    if ($.arrayBuffers[this.array.buffer._uuid] === void 0)
      $.arrayBuffers[this.array.buffer._uuid] = this.array.slice(0).buffer;
    let J = new this.array.constructor($.arrayBuffers[this.array.buffer._uuid]),
      U = new this.constructor(J, this.stride);
    return (U.setUsage(this.usage), U);
  }
  onUpload($) {
    return ((this.onUploadCallback = $), this);
  }
  toJSON($) {
    if ($.arrayBuffers === void 0) $.arrayBuffers = {};
    if (this.array.buffer._uuid === void 0) this.array.buffer._uuid = W8();
    if ($.arrayBuffers[this.array.buffer._uuid] === void 0)
      $.arrayBuffers[this.array.buffer._uuid] = Array.from(new Uint32Array(this.array.buffer));
    return { uuid: this.uuid, buffer: this.array.buffer._uuid, type: this.array.constructor.name, stride: this.stride };
  }
}
var HJ = new C();
class YX {
  constructor($, J, U, Q = !1) {
    ((this.isInterleavedBufferAttribute = !0),
      (this.name = ""),
      (this.data = $),
      (this.itemSize = J),
      (this.offset = U),
      (this.normalized = Q));
  }
  get count() {
    return this.data.count;
  }
  get array() {
    return this.data.array;
  }
  set needsUpdate($) {
    this.data.needsUpdate = $;
  }
  applyMatrix4($) {
    for (let J = 0, U = this.data.count; J < U; J++)
      (HJ.fromBufferAttribute(this, J), HJ.applyMatrix4($), this.setXYZ(J, HJ.x, HJ.y, HJ.z));
    return this;
  }
  applyNormalMatrix($) {
    for (let J = 0, U = this.count; J < U; J++)
      (HJ.fromBufferAttribute(this, J), HJ.applyNormalMatrix($), this.setXYZ(J, HJ.x, HJ.y, HJ.z));
    return this;
  }
  transformDirection($) {
    for (let J = 0, U = this.count; J < U; J++)
      (HJ.fromBufferAttribute(this, J), HJ.transformDirection($), this.setXYZ(J, HJ.x, HJ.y, HJ.z));
    return this;
  }
  getComponent($, J) {
    let U = this.array[$ * this.data.stride + this.offset + J];
    if (this.normalized) U = KU(U, this.array);
    return U;
  }
  setComponent($, J, U) {
    if (this.normalized) U = l6(U, this.array);
    return ((this.data.array[$ * this.data.stride + this.offset + J] = U), this);
  }
  setX($, J) {
    if (this.normalized) J = l6(J, this.array);
    return ((this.data.array[$ * this.data.stride + this.offset] = J), this);
  }
  setY($, J) {
    if (this.normalized) J = l6(J, this.array);
    return ((this.data.array[$ * this.data.stride + this.offset + 1] = J), this);
  }
  setZ($, J) {
    if (this.normalized) J = l6(J, this.array);
    return ((this.data.array[$ * this.data.stride + this.offset + 2] = J), this);
  }
  setW($, J) {
    if (this.normalized) J = l6(J, this.array);
    return ((this.data.array[$ * this.data.stride + this.offset + 3] = J), this);
  }
  getX($) {
    let J = this.data.array[$ * this.data.stride + this.offset];
    if (this.normalized) J = KU(J, this.array);
    return J;
  }
  getY($) {
    let J = this.data.array[$ * this.data.stride + this.offset + 1];
    if (this.normalized) J = KU(J, this.array);
    return J;
  }
  getZ($) {
    let J = this.data.array[$ * this.data.stride + this.offset + 2];
    if (this.normalized) J = KU(J, this.array);
    return J;
  }
  getW($) {
    let J = this.data.array[$ * this.data.stride + this.offset + 3];
    if (this.normalized) J = KU(J, this.array);
    return J;
  }
  setXY($, J, U) {
    if ((($ = $ * this.data.stride + this.offset), this.normalized)) ((J = l6(J, this.array)), (U = l6(U, this.array)));
    return ((this.data.array[$ + 0] = J), (this.data.array[$ + 1] = U), this);
  }
  setXYZ($, J, U, Q) {
    if ((($ = $ * this.data.stride + this.offset), this.normalized))
      ((J = l6(J, this.array)), (U = l6(U, this.array)), (Q = l6(Q, this.array)));
    return ((this.data.array[$ + 0] = J), (this.data.array[$ + 1] = U), (this.data.array[$ + 2] = Q), this);
  }
  setXYZW($, J, U, Q, W) {
    if ((($ = $ * this.data.stride + this.offset), this.normalized))
      ((J = l6(J, this.array)), (U = l6(U, this.array)), (Q = l6(Q, this.array)), (W = l6(W, this.array)));
    return (
      (this.data.array[$ + 0] = J),
      (this.data.array[$ + 1] = U),
      (this.data.array[$ + 2] = Q),
      (this.data.array[$ + 3] = W),
      this
    );
  }
  clone($) {
    if ($ === void 0) {
      XX("InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");
      let J = [];
      for (let U = 0; U < this.count; U++) {
        let Q = U * this.data.stride + this.offset;
        for (let W = 0; W < this.itemSize; W++) J.push(this.data.array[Q + W]);
      }
      return new bJ(new this.array.constructor(J), this.itemSize, this.normalized);
    } else {
      if ($.interleavedBuffers === void 0) $.interleavedBuffers = {};
      if ($.interleavedBuffers[this.data.uuid] === void 0) $.interleavedBuffers[this.data.uuid] = this.data.clone($);
      return new YX($.interleavedBuffers[this.data.uuid], this.itemSize, this.offset, this.normalized);
    }
  }
  toJSON($) {
    if ($ === void 0) {
      XX(
        "InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.",
      );
      let J = [];
      for (let U = 0; U < this.count; U++) {
        let Q = U * this.data.stride + this.offset;
        for (let W = 0; W < this.itemSize; W++) J.push(this.data.array[Q + W]);
      }
      return { itemSize: this.itemSize, type: this.array.constructor.name, array: J, normalized: this.normalized };
    } else {
      if ($.interleavedBuffers === void 0) $.interleavedBuffers = {};
      if ($.interleavedBuffers[this.data.uuid] === void 0) $.interleavedBuffers[this.data.uuid] = this.data.toJSON($);
      return {
        isInterleavedBufferAttribute: !0,
        itemSize: this.itemSize,
        data: this.data.uuid,
        offset: this.offset,
        normalized: this.normalized,
      };
    }
  }
}
var Zm = 0;
class D8 extends vU {
  constructor() {
    super();
    ((this.isMaterial = !0),
      Object.defineProperty(this, "id", { value: Zm++ }),
      (this.uuid = W8()),
      (this.name = ""),
      (this.type = "Material"),
      (this.blending = 1),
      (this.side = 0),
      (this.vertexColors = !1),
      (this.opacity = 1),
      (this.transparent = !1),
      (this.alphaHash = !1),
      (this.blendSrc = 204),
      (this.blendDst = 205),
      (this.blendEquation = 100),
      (this.blendSrcAlpha = null),
      (this.blendDstAlpha = null),
      (this.blendEquationAlpha = null),
      (this.blendColor = new W6(0, 0, 0)),
      (this.blendAlpha = 0),
      (this.depthFunc = 3),
      (this.depthTest = !0),
      (this.depthWrite = !0),
      (this.stencilWriteMask = 255),
      (this.stencilFunc = 519),
      (this.stencilRef = 0),
      (this.stencilFuncMask = 255),
      (this.stencilFail = 7680),
      (this.stencilZFail = 7680),
      (this.stencilZPass = 7680),
      (this.stencilWrite = !1),
      (this.clippingPlanes = null),
      (this.clipIntersection = !1),
      (this.clipShadows = !1),
      (this.shadowSide = null),
      (this.colorWrite = !0),
      (this.precision = null),
      (this.polygonOffset = !1),
      (this.polygonOffsetFactor = 0),
      (this.polygonOffsetUnits = 0),
      (this.dithering = !1),
      (this.alphaToCoverage = !1),
      (this.premultipliedAlpha = !1),
      (this.forceSinglePass = !1),
      (this.allowOverride = !0),
      (this.visible = !0),
      (this.toneMapped = !0),
      (this.userData = {}),
      (this.version = 0),
      (this._alphaTest = 0));
  }
  get alphaTest() {
    return this._alphaTest;
  }
  set alphaTest($) {
    if (this._alphaTest > 0 !== $ > 0) this.version++;
    this._alphaTest = $;
  }
  onBeforeRender() {}
  onBeforeCompile() {}
  customProgramCacheKey() {
    return this.onBeforeCompile.toString();
  }
  setValues($) {
    if ($ === void 0) return;
    for (let J in $) {
      let U = $[J];
      if (U === void 0) {
        i$(`Material: parameter '${J}' has value of undefined.`);
        continue;
      }
      let Q = this[J];
      if (Q === void 0) {
        i$(`Material: '${J}' is not a property of THREE.${this.type}.`);
        continue;
      }
      if (Q && Q.isColor) Q.set(U);
      else if (Q && Q.isVector3 && U && U.isVector3) Q.copy(U);
      else this[J] = U;
    }
  }
  toJSON($) {
    let J = $ === void 0 || typeof $ === "string";
    if (J) $ = { textures: {}, images: {} };
    let U = { metadata: { version: 4.7, type: "Material", generator: "Material.toJSON" } };
    if (((U.uuid = this.uuid), (U.type = this.type), this.name !== "")) U.name = this.name;
    if (this.color && this.color.isColor) U.color = this.color.getHex();
    if (this.roughness !== void 0) U.roughness = this.roughness;
    if (this.metalness !== void 0) U.metalness = this.metalness;
    if (this.sheen !== void 0) U.sheen = this.sheen;
    if (this.sheenColor && this.sheenColor.isColor) U.sheenColor = this.sheenColor.getHex();
    if (this.sheenRoughness !== void 0) U.sheenRoughness = this.sheenRoughness;
    if (this.emissive && this.emissive.isColor) U.emissive = this.emissive.getHex();
    if (this.emissiveIntensity !== void 0 && this.emissiveIntensity !== 1) U.emissiveIntensity = this.emissiveIntensity;
    if (this.specular && this.specular.isColor) U.specular = this.specular.getHex();
    if (this.specularIntensity !== void 0) U.specularIntensity = this.specularIntensity;
    if (this.specularColor && this.specularColor.isColor) U.specularColor = this.specularColor.getHex();
    if (this.shininess !== void 0) U.shininess = this.shininess;
    if (this.clearcoat !== void 0) U.clearcoat = this.clearcoat;
    if (this.clearcoatRoughness !== void 0) U.clearcoatRoughness = this.clearcoatRoughness;
    if (this.clearcoatMap && this.clearcoatMap.isTexture) U.clearcoatMap = this.clearcoatMap.toJSON($).uuid;
    if (this.clearcoatRoughnessMap && this.clearcoatRoughnessMap.isTexture)
      U.clearcoatRoughnessMap = this.clearcoatRoughnessMap.toJSON($).uuid;
    if (this.clearcoatNormalMap && this.clearcoatNormalMap.isTexture)
      ((U.clearcoatNormalMap = this.clearcoatNormalMap.toJSON($).uuid),
        (U.clearcoatNormalScale = this.clearcoatNormalScale.toArray()));
    if (this.sheenColorMap && this.sheenColorMap.isTexture) U.sheenColorMap = this.sheenColorMap.toJSON($).uuid;
    if (this.sheenRoughnessMap && this.sheenRoughnessMap.isTexture)
      U.sheenRoughnessMap = this.sheenRoughnessMap.toJSON($).uuid;
    if (this.dispersion !== void 0) U.dispersion = this.dispersion;
    if (this.iridescence !== void 0) U.iridescence = this.iridescence;
    if (this.iridescenceIOR !== void 0) U.iridescenceIOR = this.iridescenceIOR;
    if (this.iridescenceThicknessRange !== void 0) U.iridescenceThicknessRange = this.iridescenceThicknessRange;
    if (this.iridescenceMap && this.iridescenceMap.isTexture) U.iridescenceMap = this.iridescenceMap.toJSON($).uuid;
    if (this.iridescenceThicknessMap && this.iridescenceThicknessMap.isTexture)
      U.iridescenceThicknessMap = this.iridescenceThicknessMap.toJSON($).uuid;
    if (this.anisotropy !== void 0) U.anisotropy = this.anisotropy;
    if (this.anisotropyRotation !== void 0) U.anisotropyRotation = this.anisotropyRotation;
    if (this.anisotropyMap && this.anisotropyMap.isTexture) U.anisotropyMap = this.anisotropyMap.toJSON($).uuid;
    if (this.map && this.map.isTexture) U.map = this.map.toJSON($).uuid;
    if (this.matcap && this.matcap.isTexture) U.matcap = this.matcap.toJSON($).uuid;
    if (this.alphaMap && this.alphaMap.isTexture) U.alphaMap = this.alphaMap.toJSON($).uuid;
    if (this.lightMap && this.lightMap.isTexture)
      ((U.lightMap = this.lightMap.toJSON($).uuid), (U.lightMapIntensity = this.lightMapIntensity));
    if (this.aoMap && this.aoMap.isTexture)
      ((U.aoMap = this.aoMap.toJSON($).uuid), (U.aoMapIntensity = this.aoMapIntensity));
    if (this.bumpMap && this.bumpMap.isTexture)
      ((U.bumpMap = this.bumpMap.toJSON($).uuid), (U.bumpScale = this.bumpScale));
    if (this.normalMap && this.normalMap.isTexture)
      ((U.normalMap = this.normalMap.toJSON($).uuid),
        (U.normalMapType = this.normalMapType),
        (U.normalScale = this.normalScale.toArray()));
    if (this.displacementMap && this.displacementMap.isTexture)
      ((U.displacementMap = this.displacementMap.toJSON($).uuid),
        (U.displacementScale = this.displacementScale),
        (U.displacementBias = this.displacementBias));
    if (this.roughnessMap && this.roughnessMap.isTexture) U.roughnessMap = this.roughnessMap.toJSON($).uuid;
    if (this.metalnessMap && this.metalnessMap.isTexture) U.metalnessMap = this.metalnessMap.toJSON($).uuid;
    if (this.emissiveMap && this.emissiveMap.isTexture) U.emissiveMap = this.emissiveMap.toJSON($).uuid;
    if (this.specularMap && this.specularMap.isTexture) U.specularMap = this.specularMap.toJSON($).uuid;
    if (this.specularIntensityMap && this.specularIntensityMap.isTexture)
      U.specularIntensityMap = this.specularIntensityMap.toJSON($).uuid;
    if (this.specularColorMap && this.specularColorMap.isTexture)
      U.specularColorMap = this.specularColorMap.toJSON($).uuid;
    if (this.envMap && this.envMap.isTexture) {
      if (((U.envMap = this.envMap.toJSON($).uuid), this.combine !== void 0)) U.combine = this.combine;
    }
    if (this.envMapRotation !== void 0) U.envMapRotation = this.envMapRotation.toArray();
    if (this.envMapIntensity !== void 0) U.envMapIntensity = this.envMapIntensity;
    if (this.reflectivity !== void 0) U.reflectivity = this.reflectivity;
    if (this.refractionRatio !== void 0) U.refractionRatio = this.refractionRatio;
    if (this.gradientMap && this.gradientMap.isTexture) U.gradientMap = this.gradientMap.toJSON($).uuid;
    if (this.transmission !== void 0) U.transmission = this.transmission;
    if (this.transmissionMap && this.transmissionMap.isTexture) U.transmissionMap = this.transmissionMap.toJSON($).uuid;
    if (this.thickness !== void 0) U.thickness = this.thickness;
    if (this.thicknessMap && this.thicknessMap.isTexture) U.thicknessMap = this.thicknessMap.toJSON($).uuid;
    if (this.attenuationDistance !== void 0 && this.attenuationDistance !== 1 / 0)
      U.attenuationDistance = this.attenuationDistance;
    if (this.attenuationColor !== void 0) U.attenuationColor = this.attenuationColor.getHex();
    if (this.size !== void 0) U.size = this.size;
    if (this.shadowSide !== null) U.shadowSide = this.shadowSide;
    if (this.sizeAttenuation !== void 0) U.sizeAttenuation = this.sizeAttenuation;
    if (this.blending !== 1) U.blending = this.blending;
    if (this.side !== 0) U.side = this.side;
    if (this.vertexColors === !0) U.vertexColors = !0;
    if (this.opacity < 1) U.opacity = this.opacity;
    if (this.transparent === !0) U.transparent = !0;
    if (this.blendSrc !== 204) U.blendSrc = this.blendSrc;
    if (this.blendDst !== 205) U.blendDst = this.blendDst;
    if (this.blendEquation !== 100) U.blendEquation = this.blendEquation;
    if (this.blendSrcAlpha !== null) U.blendSrcAlpha = this.blendSrcAlpha;
    if (this.blendDstAlpha !== null) U.blendDstAlpha = this.blendDstAlpha;
    if (this.blendEquationAlpha !== null) U.blendEquationAlpha = this.blendEquationAlpha;
    if (this.blendColor && this.blendColor.isColor) U.blendColor = this.blendColor.getHex();
    if (this.blendAlpha !== 0) U.blendAlpha = this.blendAlpha;
    if (this.depthFunc !== 3) U.depthFunc = this.depthFunc;
    if (this.depthTest === !1) U.depthTest = this.depthTest;
    if (this.depthWrite === !1) U.depthWrite = this.depthWrite;
    if (this.colorWrite === !1) U.colorWrite = this.colorWrite;
    if (this.stencilWriteMask !== 255) U.stencilWriteMask = this.stencilWriteMask;
    if (this.stencilFunc !== 519) U.stencilFunc = this.stencilFunc;
    if (this.stencilRef !== 0) U.stencilRef = this.stencilRef;
    if (this.stencilFuncMask !== 255) U.stencilFuncMask = this.stencilFuncMask;
    if (this.stencilFail !== 7680) U.stencilFail = this.stencilFail;
    if (this.stencilZFail !== 7680) U.stencilZFail = this.stencilZFail;
    if (this.stencilZPass !== 7680) U.stencilZPass = this.stencilZPass;
    if (this.stencilWrite === !0) U.stencilWrite = this.stencilWrite;
    if (this.rotation !== void 0 && this.rotation !== 0) U.rotation = this.rotation;
    if (this.polygonOffset === !0) U.polygonOffset = !0;
    if (this.polygonOffsetFactor !== 0) U.polygonOffsetFactor = this.polygonOffsetFactor;
    if (this.polygonOffsetUnits !== 0) U.polygonOffsetUnits = this.polygonOffsetUnits;
    if (this.linewidth !== void 0 && this.linewidth !== 1) U.linewidth = this.linewidth;
    if (this.dashSize !== void 0) U.dashSize = this.dashSize;
    if (this.gapSize !== void 0) U.gapSize = this.gapSize;
    if (this.scale !== void 0) U.scale = this.scale;
    if (this.dithering === !0) U.dithering = !0;
    if (this.alphaTest > 0) U.alphaTest = this.alphaTest;
    if (this.alphaHash === !0) U.alphaHash = !0;
    if (this.alphaToCoverage === !0) U.alphaToCoverage = !0;
    if (this.premultipliedAlpha === !0) U.premultipliedAlpha = !0;
    if (this.forceSinglePass === !0) U.forceSinglePass = !0;
    if (this.allowOverride === !1) U.allowOverride = !1;
    if (this.wireframe === !0) U.wireframe = !0;
    if (this.wireframeLinewidth > 1) U.wireframeLinewidth = this.wireframeLinewidth;
    if (this.wireframeLinecap !== "round") U.wireframeLinecap = this.wireframeLinecap;
    if (this.wireframeLinejoin !== "round") U.wireframeLinejoin = this.wireframeLinejoin;
    if (this.flatShading === !0) U.flatShading = !0;
    if (this.visible === !1) U.visible = !1;
    if (this.toneMapped === !1) U.toneMapped = !1;
    if (this.fog === !1) U.fog = !1;
    if (Object.keys(this.userData).length > 0) U.userData = this.userData;
    function Q(W) {
      let X = [];
      for (let Y in W) {
        let D = W[Y];
        (delete D.metadata, X.push(D));
      }
      return X;
    }
    if (J) {
      let W = Q($.textures),
        X = Q($.images);
      if (W.length > 0) U.textures = W;
      if (X.length > 0) U.images = X;
    }
    return U;
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy($) {
    ((this.name = $.name),
      (this.blending = $.blending),
      (this.side = $.side),
      (this.vertexColors = $.vertexColors),
      (this.opacity = $.opacity),
      (this.transparent = $.transparent),
      (this.blendSrc = $.blendSrc),
      (this.blendDst = $.blendDst),
      (this.blendEquation = $.blendEquation),
      (this.blendSrcAlpha = $.blendSrcAlpha),
      (this.blendDstAlpha = $.blendDstAlpha),
      (this.blendEquationAlpha = $.blendEquationAlpha),
      this.blendColor.copy($.blendColor),
      (this.blendAlpha = $.blendAlpha),
      (this.depthFunc = $.depthFunc),
      (this.depthTest = $.depthTest),
      (this.depthWrite = $.depthWrite),
      (this.stencilWriteMask = $.stencilWriteMask),
      (this.stencilFunc = $.stencilFunc),
      (this.stencilRef = $.stencilRef),
      (this.stencilFuncMask = $.stencilFuncMask),
      (this.stencilFail = $.stencilFail),
      (this.stencilZFail = $.stencilZFail),
      (this.stencilZPass = $.stencilZPass),
      (this.stencilWrite = $.stencilWrite));
    let J = $.clippingPlanes,
      U = null;
    if (J !== null) {
      let Q = J.length;
      U = Array(Q);
      for (let W = 0; W !== Q; ++W) U[W] = J[W].clone();
    }
    return (
      (this.clippingPlanes = U),
      (this.clipIntersection = $.clipIntersection),
      (this.clipShadows = $.clipShadows),
      (this.shadowSide = $.shadowSide),
      (this.colorWrite = $.colorWrite),
      (this.precision = $.precision),
      (this.polygonOffset = $.polygonOffset),
      (this.polygonOffsetFactor = $.polygonOffsetFactor),
      (this.polygonOffsetUnits = $.polygonOffsetUnits),
      (this.dithering = $.dithering),
      (this.alphaTest = $.alphaTest),
      (this.alphaHash = $.alphaHash),
      (this.alphaToCoverage = $.alphaToCoverage),
      (this.premultipliedAlpha = $.premultipliedAlpha),
      (this.forceSinglePass = $.forceSinglePass),
      (this.allowOverride = $.allowOverride),
      (this.visible = $.visible),
      (this.toneMapped = $.toneMapped),
      (this.userData = JSON.parse(JSON.stringify($.userData))),
      this
    );
  }
  dispose() {
    this.dispatchEvent({ type: "dispose" });
  }
  set needsUpdate($) {
    if ($ === !0) this.version++;
  }
}
class BX extends D8 {
  constructor($) {
    super();
    ((this.isSpriteMaterial = !0),
      (this.type = "SpriteMaterial"),
      (this.color = new W6(16777215)),
      (this.map = null),
      (this.alphaMap = null),
      (this.rotation = 0),
      (this.sizeAttenuation = !0),
      (this.transparent = !0),
      (this.fog = !0),
      this.setValues($));
  }
  copy($) {
    return (
      super.copy($),
      this.color.copy($.color),
      (this.map = $.map),
      (this.alphaMap = $.alphaMap),
      (this.rotation = $.rotation),
      (this.sizeAttenuation = $.sizeAttenuation),
      (this.fog = $.fog),
      this
    );
  }
}
var Z1,
  eQ = new C(),
  P1 = new C(),
  _1 = new C(),
  S1 = new d$(),
  $X = new d$(),
  kP = new x6(),
  m5 = new C(),
  JX = new C(),
  p5 = new C(),
  WZ = new d$(),
  lz = new d$(),
  QZ = new d$();
class ZG extends F0 {
  constructor($ = new BX()) {
    super();
    if (((this.isSprite = !0), (this.type = "Sprite"), Z1 === void 0)) {
      Z1 = new Q0();
      let J = new Float32Array([-0.5, -0.5, 0, 0, 0, 0.5, -0.5, 0, 1, 0, 0.5, 0.5, 0, 1, 1, -0.5, 0.5, 0, 0, 1]),
        U = new $E(J, 5);
      (Z1.setIndex([0, 1, 2, 0, 2, 3]),
        Z1.setAttribute("position", new YX(U, 3, 0, !1)),
        Z1.setAttribute("uv", new YX(U, 2, 3, !1)));
    }
    ((this.geometry = Z1), (this.material = $), (this.center = new d$(0.5, 0.5)), (this.count = 1));
  }
  raycast($, J) {
    if ($.camera === null) s$('Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.');
    if (
      (P1.setFromMatrixScale(this.matrixWorld),
      kP.copy($.camera.matrixWorld),
      this.modelViewMatrix.multiplyMatrices($.camera.matrixWorldInverse, this.matrixWorld),
      _1.setFromMatrixPosition(this.modelViewMatrix),
      $.camera.isPerspectiveCamera && this.material.sizeAttenuation === !1)
    )
      P1.multiplyScalar(-_1.z);
    let U = this.material.rotation,
      Q,
      W;
    if (U !== 0) ((W = Math.cos(U)), (Q = Math.sin(U)));
    let X = this.center;
    (d5(m5.set(-0.5, -0.5, 0), _1, X, P1, Q, W),
      d5(JX.set(0.5, -0.5, 0), _1, X, P1, Q, W),
      d5(p5.set(0.5, 0.5, 0), _1, X, P1, Q, W),
      WZ.set(0, 0),
      lz.set(1, 0),
      QZ.set(1, 1));
    let Y = $.ray.intersectTriangle(m5, JX, p5, !1, eQ);
    if (Y === null) {
      if (
        (d5(JX.set(-0.5, 0.5, 0), _1, X, P1, Q, W),
        lz.set(0, 1),
        (Y = $.ray.intersectTriangle(m5, p5, JX, !1, eQ)),
        Y === null)
      )
        return;
    }
    let D = $.ray.origin.distanceTo(eQ);
    if (D < $.near || D > $.far) return;
    J.push({
      distance: D,
      point: eQ.clone(),
      uv: vJ.getInterpolation(eQ, m5, JX, p5, WZ, lz, QZ, new d$()),
      face: null,
      object: this,
    });
  }
  copy($, J) {
    if ((super.copy($, J), $.center !== void 0)) this.center.copy($.center);
    return ((this.material = $.material), this);
  }
}
function d5($, J, U, Q, W, X) {
  if ((S1.subVectors($, U).addScalar(0.5).multiply(Q), W !== void 0))
    (($X.x = X * S1.x - W * S1.y), ($X.y = W * S1.x + X * S1.y));
  else $X.copy(S1);
  ($.copy(J), ($.x += $X.x), ($.y += $X.y), $.applyMatrix4(kP));
}
var U8 = new C(),
  mz = new C(),
  c5 = new C(),
  r8 = new C(),
  pz = new C(),
  n5 = new C(),
  dz = new C();
class p9 {
  constructor($ = new C(), J = new C(0, 0, -1)) {
    ((this.origin = $), (this.direction = J));
  }
  set($, J) {
    return (this.origin.copy($), this.direction.copy(J), this);
  }
  copy($) {
    return (this.origin.copy($.origin), this.direction.copy($.direction), this);
  }
  at($, J) {
    return J.copy(this.origin).addScaledVector(this.direction, $);
  }
  lookAt($) {
    return (this.direction.copy($).sub(this.origin).normalize(), this);
  }
  recast($) {
    return (this.origin.copy(this.at($, U8)), this);
  }
  closestPointToPoint($, J) {
    J.subVectors($, this.origin);
    let U = J.dot(this.direction);
    if (U < 0) return J.copy(this.origin);
    return J.copy(this.origin).addScaledVector(this.direction, U);
  }
  distanceToPoint($) {
    return Math.sqrt(this.distanceSqToPoint($));
  }
  distanceSqToPoint($) {
    let J = U8.subVectors($, this.origin).dot(this.direction);
    if (J < 0) return this.origin.distanceToSquared($);
    return (U8.copy(this.origin).addScaledVector(this.direction, J), U8.distanceToSquared($));
  }
  distanceSqToSegment($, J, U, Q) {
    (mz.copy($).add(J).multiplyScalar(0.5), c5.copy(J).sub($).normalize(), r8.copy(this.origin).sub(mz));
    let W = $.distanceTo(J) * 0.5,
      X = -this.direction.dot(c5),
      Y = r8.dot(this.direction),
      D = -r8.dot(c5),
      H = r8.lengthSq(),
      G = Math.abs(1 - X * X),
      K,
      O,
      N,
      F;
    if (G > 0)
      if (((K = X * D - Y), (O = X * Y - D), (F = W * G), K >= 0))
        if (O >= -F)
          if (O <= F) {
            let B = 1 / G;
            ((K *= B), (O *= B), (N = K * (K + X * O + 2 * Y) + O * (X * K + O + 2 * D) + H));
          } else ((O = W), (K = Math.max(0, -(X * O + Y))), (N = -K * K + O * (O + 2 * D) + H));
        else ((O = -W), (K = Math.max(0, -(X * O + Y))), (N = -K * K + O * (O + 2 * D) + H));
      else if (O <= -F)
        ((K = Math.max(0, -(-X * W + Y))),
          (O = K > 0 ? -W : Math.min(Math.max(-W, -D), W)),
          (N = -K * K + O * (O + 2 * D) + H));
      else if (O <= F) ((K = 0), (O = Math.min(Math.max(-W, -D), W)), (N = O * (O + 2 * D) + H));
      else
        ((K = Math.max(0, -(X * W + Y))),
          (O = K > 0 ? W : Math.min(Math.max(-W, -D), W)),
          (N = -K * K + O * (O + 2 * D) + H));
    else ((O = X > 0 ? -W : W), (K = Math.max(0, -(X * O + Y))), (N = -K * K + O * (O + 2 * D) + H));
    if (U) U.copy(this.origin).addScaledVector(this.direction, K);
    if (Q) Q.copy(mz).addScaledVector(c5, O);
    return N;
  }
  intersectSphere($, J) {
    U8.subVectors($.center, this.origin);
    let U = U8.dot(this.direction),
      Q = U8.dot(U8) - U * U,
      W = $.radius * $.radius;
    if (Q > W) return null;
    let X = Math.sqrt(W - Q),
      Y = U - X,
      D = U + X;
    if (D < 0) return null;
    if (Y < 0) return this.at(D, J);
    return this.at(Y, J);
  }
  intersectsSphere($) {
    if ($.radius < 0) return !1;
    return this.distanceSqToPoint($.center) <= $.radius * $.radius;
  }
  distanceToPlane($) {
    let J = $.normal.dot(this.direction);
    if (J === 0) {
      if ($.distanceToPoint(this.origin) === 0) return 0;
      return null;
    }
    let U = -(this.origin.dot($.normal) + $.constant) / J;
    return U >= 0 ? U : null;
  }
  intersectPlane($, J) {
    let U = this.distanceToPlane($);
    if (U === null) return null;
    return this.at(U, J);
  }
  intersectsPlane($) {
    let J = $.distanceToPoint(this.origin);
    if (J === 0) return !0;
    if ($.normal.dot(this.direction) * J < 0) return !0;
    return !1;
  }
  intersectBox($, J) {
    let U,
      Q,
      W,
      X,
      Y,
      D,
      H = 1 / this.direction.x,
      G = 1 / this.direction.y,
      K = 1 / this.direction.z,
      O = this.origin;
    if (H >= 0) ((U = ($.min.x - O.x) * H), (Q = ($.max.x - O.x) * H));
    else ((U = ($.max.x - O.x) * H), (Q = ($.min.x - O.x) * H));
    if (G >= 0) ((W = ($.min.y - O.y) * G), (X = ($.max.y - O.y) * G));
    else ((W = ($.max.y - O.y) * G), (X = ($.min.y - O.y) * G));
    if (U > X || W > Q) return null;
    if (W > U || isNaN(U)) U = W;
    if (X < Q || isNaN(Q)) Q = X;
    if (K >= 0) ((Y = ($.min.z - O.z) * K), (D = ($.max.z - O.z) * K));
    else ((Y = ($.max.z - O.z) * K), (D = ($.min.z - O.z) * K));
    if (U > D || Y > Q) return null;
    if (Y > U || U !== U) U = Y;
    if (D < Q || Q !== Q) Q = D;
    if (Q < 0) return null;
    return this.at(U >= 0 ? U : Q, J);
  }
  intersectsBox($) {
    return this.intersectBox($, U8) !== null;
  }
  intersectTriangle($, J, U, Q, W) {
    (pz.subVectors(J, $), n5.subVectors(U, $), dz.crossVectors(pz, n5));
    let X = this.direction.dot(dz),
      Y;
    if (X > 0) {
      if (Q) return null;
      Y = 1;
    } else if (X < 0) ((Y = -1), (X = -X));
    else return null;
    r8.subVectors(this.origin, $);
    let D = Y * this.direction.dot(n5.crossVectors(r8, n5));
    if (D < 0) return null;
    let H = Y * this.direction.dot(pz.cross(r8));
    if (H < 0) return null;
    if (D + H > X) return null;
    let G = -Y * r8.dot(dz);
    if (G < 0) return null;
    return this.at(G / X, W);
  }
  applyMatrix4($) {
    return (this.origin.applyMatrix4($), this.direction.transformDirection($), this);
  }
  equals($) {
    return $.origin.equals(this.origin) && $.direction.equals(this.direction);
  }
  clone() {
    return new this.constructor().copy(this);
  }
}
class KJ extends D8 {
  constructor($) {
    super();
    ((this.isMeshBasicMaterial = !0),
      (this.type = "MeshBasicMaterial"),
      (this.color = new W6(16777215)),
      (this.map = null),
      (this.lightMap = null),
      (this.lightMapIntensity = 1),
      (this.aoMap = null),
      (this.aoMapIntensity = 1),
      (this.specularMap = null),
      (this.alphaMap = null),
      (this.envMap = null),
      (this.envMapRotation = new NU()),
      (this.combine = 0),
      (this.reflectivity = 1),
      (this.refractionRatio = 0.98),
      (this.wireframe = !1),
      (this.wireframeLinewidth = 1),
      (this.wireframeLinecap = "round"),
      (this.wireframeLinejoin = "round"),
      (this.fog = !0),
      this.setValues($));
  }
  copy($) {
    return (
      super.copy($),
      this.color.copy($.color),
      (this.map = $.map),
      (this.lightMap = $.lightMap),
      (this.lightMapIntensity = $.lightMapIntensity),
      (this.aoMap = $.aoMap),
      (this.aoMapIntensity = $.aoMapIntensity),
      (this.specularMap = $.specularMap),
      (this.alphaMap = $.alphaMap),
      (this.envMap = $.envMap),
      this.envMapRotation.copy($.envMapRotation),
      (this.combine = $.combine),
      (this.reflectivity = $.reflectivity),
      (this.refractionRatio = $.refractionRatio),
      (this.wireframe = $.wireframe),
      (this.wireframeLinewidth = $.wireframeLinewidth),
      (this.wireframeLinecap = $.wireframeLinecap),
      (this.wireframeLinejoin = $.wireframeLinejoin),
      (this.fog = $.fog),
      this
    );
  }
}
var XZ = new x6(),
  f9 = new p9(),
  i5 = new p1(),
  YZ = new C(),
  o5 = new C(),
  r5 = new C(),
  s5 = new C(),
  cz = new C(),
  a5 = new C(),
  DZ = new C(),
  t5 = new C();
class X$ extends F0 {
  constructor($ = new Q0(), J = new KJ()) {
    super();
    ((this.isMesh = !0),
      (this.type = "Mesh"),
      (this.geometry = $),
      (this.material = J),
      (this.morphTargetDictionary = void 0),
      (this.morphTargetInfluences = void 0),
      (this.count = 1),
      this.updateMorphTargets());
  }
  copy($, J) {
    if ((super.copy($, J), $.morphTargetInfluences !== void 0))
      this.morphTargetInfluences = $.morphTargetInfluences.slice();
    if ($.morphTargetDictionary !== void 0) this.morphTargetDictionary = Object.assign({}, $.morphTargetDictionary);
    return (
      (this.material = Array.isArray($.material) ? $.material.slice() : $.material),
      (this.geometry = $.geometry),
      this
    );
  }
  updateMorphTargets() {
    let J = this.geometry.morphAttributes,
      U = Object.keys(J);
    if (U.length > 0) {
      let Q = J[U[0]];
      if (Q !== void 0) {
        ((this.morphTargetInfluences = []), (this.morphTargetDictionary = {}));
        for (let W = 0, X = Q.length; W < X; W++) {
          let Y = Q[W].name || String(W);
          (this.morphTargetInfluences.push(0), (this.morphTargetDictionary[Y] = W));
        }
      }
    }
  }
  getVertexPosition($, J) {
    let U = this.geometry,
      Q = U.attributes.position,
      W = U.morphAttributes.position,
      X = U.morphTargetsRelative;
    J.fromBufferAttribute(Q, $);
    let Y = this.morphTargetInfluences;
    if (W && Y) {
      a5.set(0, 0, 0);
      for (let D = 0, H = W.length; D < H; D++) {
        let G = Y[D],
          K = W[D];
        if (G === 0) continue;
        if ((cz.fromBufferAttribute(K, $), X)) a5.addScaledVector(cz, G);
        else a5.addScaledVector(cz.sub(J), G);
      }
      J.add(a5);
    }
    return J;
  }
  raycast($, J) {
    let U = this.geometry,
      Q = this.material,
      W = this.matrixWorld;
    if (Q === void 0) return;
    if (U.boundingSphere === null) U.computeBoundingSphere();
    if (
      (i5.copy(U.boundingSphere), i5.applyMatrix4(W), f9.copy($.ray).recast($.near), i5.containsPoint(f9.origin) === !1)
    ) {
      if (f9.intersectSphere(i5, YZ) === null) return;
      if (f9.origin.distanceToSquared(YZ) > ($.far - $.near) ** 2) return;
    }
    if ((XZ.copy(W).invert(), f9.copy($.ray).applyMatrix4(XZ), U.boundingBox !== null)) {
      if (f9.intersectsBox(U.boundingBox) === !1) return;
    }
    this._computeIntersections($, J, f9);
  }
  _computeIntersections($, J, U) {
    let Q,
      W = this.geometry,
      X = this.material,
      Y = W.index,
      D = W.attributes.position,
      H = W.attributes.uv,
      G = W.attributes.uv1,
      K = W.attributes.normal,
      O = W.groups,
      N = W.drawRange;
    if (Y !== null)
      if (Array.isArray(X))
        for (let F = 0, B = O.length; F < B; F++) {
          let E = O[F],
            z = X[E.materialIndex],
            q = Math.max(E.start, N.start),
            L = Math.min(Y.count, Math.min(E.start + E.count, N.start + N.count));
          for (let V = q, k = L; V < k; V += 3) {
            let R = Y.getX(V),
              _ = Y.getX(V + 1),
              S = Y.getX(V + 2);
            if (((Q = e5(this, z, $, U, H, G, K, R, _, S)), Q))
              ((Q.faceIndex = Math.floor(V / 3)), (Q.face.materialIndex = E.materialIndex), J.push(Q));
          }
        }
      else {
        let F = Math.max(0, N.start),
          B = Math.min(Y.count, N.start + N.count);
        for (let E = F, z = B; E < z; E += 3) {
          let q = Y.getX(E),
            L = Y.getX(E + 1),
            V = Y.getX(E + 2);
          if (((Q = e5(this, X, $, U, H, G, K, q, L, V)), Q)) ((Q.faceIndex = Math.floor(E / 3)), J.push(Q));
        }
      }
    else if (D !== void 0)
      if (Array.isArray(X))
        for (let F = 0, B = O.length; F < B; F++) {
          let E = O[F],
            z = X[E.materialIndex],
            q = Math.max(E.start, N.start),
            L = Math.min(D.count, Math.min(E.start + E.count, N.start + N.count));
          for (let V = q, k = L; V < k; V += 3) {
            let R = V,
              _ = V + 1,
              S = V + 2;
            if (((Q = e5(this, z, $, U, H, G, K, R, _, S)), Q))
              ((Q.faceIndex = Math.floor(V / 3)), (Q.face.materialIndex = E.materialIndex), J.push(Q));
          }
        }
      else {
        let F = Math.max(0, N.start),
          B = Math.min(D.count, N.start + N.count);
        for (let E = F, z = B; E < z; E += 3) {
          let q = E,
            L = E + 1,
            V = E + 2;
          if (((Q = e5(this, X, $, U, H, G, K, q, L, V)), Q)) ((Q.faceIndex = Math.floor(E / 3)), J.push(Q));
        }
      }
  }
}
function Pm($, J, U, Q, W, X, Y, D) {
  let H;
  if (J.side === 1) H = Q.intersectTriangle(Y, X, W, !0, D);
  else H = Q.intersectTriangle(W, X, Y, J.side === 0, D);
  if (H === null) return null;
  (t5.copy(D), t5.applyMatrix4($.matrixWorld));
  let G = U.ray.origin.distanceTo(t5);
  if (G < U.near || G > U.far) return null;
  return { distance: G, point: t5.clone(), object: $ };
}
function e5($, J, U, Q, W, X, Y, D, H, G) {
  ($.getVertexPosition(D, o5), $.getVertexPosition(H, r5), $.getVertexPosition(G, s5));
  let K = Pm($, J, U, Q, o5, r5, s5, DZ);
  if (K) {
    let O = new C();
    if ((vJ.getBarycoord(DZ, o5, r5, s5, O), W)) K.uv = vJ.getInterpolatedAttribute(W, D, H, G, O, new d$());
    if (X) K.uv1 = vJ.getInterpolatedAttribute(X, D, H, G, O, new d$());
    if (Y) {
      if (((K.normal = vJ.getInterpolatedAttribute(Y, D, H, G, O, new C())), K.normal.dot(Q.direction) > 0))
        K.normal.multiplyScalar(-1);
    }
    let N = { a: D, b: H, c: G, normal: new C(), materialIndex: 0 };
    (vJ.getNormal(o5, r5, s5, N.normal), (K.face = N), (K.barycoord = O));
  }
  return K;
}
class JE extends j0 {
  constructor($ = null, J = 1, U = 1, Q, W, X, Y, D, H = 1003, G = 1003, K, O) {
    super(null, X, Y, D, H, G, Q, W, K, O);
    ((this.isDataTexture = !0),
      (this.image = { data: $, width: J, height: U }),
      (this.generateMipmaps = !1),
      (this.flipY = !1),
      (this.unpackAlignment = 1));
  }
}
var nz = new C(),
  _m = new C(),
  Sm = new X6();
class GU {
  constructor($ = new C(1, 0, 0), J = 0) {
    ((this.isPlane = !0), (this.normal = $), (this.constant = J));
  }
  set($, J) {
    return (this.normal.copy($), (this.constant = J), this);
  }
  setComponents($, J, U, Q) {
    return (this.normal.set($, J, U), (this.constant = Q), this);
  }
  setFromNormalAndCoplanarPoint($, J) {
    return (this.normal.copy($), (this.constant = -J.dot(this.normal)), this);
  }
  setFromCoplanarPoints($, J, U) {
    let Q = nz.subVectors(U, J).cross(_m.subVectors($, J)).normalize();
    return (this.setFromNormalAndCoplanarPoint(Q, $), this);
  }
  copy($) {
    return (this.normal.copy($.normal), (this.constant = $.constant), this);
  }
  normalize() {
    let $ = 1 / this.normal.length();
    return (this.normal.multiplyScalar($), (this.constant *= $), this);
  }
  negate() {
    return ((this.constant *= -1), this.normal.negate(), this);
  }
  distanceToPoint($) {
    return this.normal.dot($) + this.constant;
  }
  distanceToSphere($) {
    return this.distanceToPoint($.center) - $.radius;
  }
  projectPoint($, J) {
    return J.copy($).addScaledVector(this.normal, -this.distanceToPoint($));
  }
  intersectLine($, J, U = !0) {
    let Q = $.delta(nz),
      W = this.normal.dot(Q);
    if (W === 0) {
      if (this.distanceToPoint($.start) === 0) return J.copy($.start);
      return null;
    }
    let X = -($.start.dot(this.normal) + this.constant) / W;
    if (U === !0 && (X < 0 || X > 1)) return null;
    return J.copy($.start).addScaledVector(Q, X);
  }
  intersectsLine($) {
    let J = this.distanceToPoint($.start),
      U = this.distanceToPoint($.end);
    return (J < 0 && U > 0) || (U < 0 && J > 0);
  }
  intersectsBox($) {
    return $.intersectsPlane(this);
  }
  intersectsSphere($) {
    return $.intersectsPlane(this);
  }
  coplanarPoint($) {
    return $.copy(this.normal).multiplyScalar(-this.constant);
  }
  applyMatrix4($, J) {
    let U = J || Sm.getNormalMatrix($),
      Q = this.coplanarPoint(nz).applyMatrix4($),
      W = this.normal.applyMatrix3(U).normalize();
    return ((this.constant = -Q.dot(W)), this);
  }
  translate($) {
    return ((this.constant -= $.dot(this.normal)), this);
  }
  equals($) {
    return $.normal.equals(this.normal) && $.constant === this.constant;
  }
  clone() {
    return new this.constructor().copy(this);
  }
}
var y9 = new p1(),
  Cm = new d$(0.5, 0.5),
  $G = new C();
class d9 {
  constructor($ = new GU(), J = new GU(), U = new GU(), Q = new GU(), W = new GU(), X = new GU()) {
    this.planes = [$, J, U, Q, W, X];
  }
  set($, J, U, Q, W, X) {
    let Y = this.planes;
    return (Y[0].copy($), Y[1].copy(J), Y[2].copy(U), Y[3].copy(Q), Y[4].copy(W), Y[5].copy(X), this);
  }
  copy($) {
    let J = this.planes;
    for (let U = 0; U < 6; U++) J[U].copy($.planes[U]);
    return this;
  }
  setFromProjectionMatrix($, J = 2000, U = !1) {
    let Q = this.planes,
      W = $.elements,
      X = W[0],
      Y = W[1],
      D = W[2],
      H = W[3],
      G = W[4],
      K = W[5],
      O = W[6],
      N = W[7],
      F = W[8],
      B = W[9],
      E = W[10],
      z = W[11],
      q = W[12],
      L = W[13],
      V = W[14],
      k = W[15];
    if (
      (Q[0].setComponents(H - X, N - G, z - F, k - q).normalize(),
      Q[1].setComponents(H + X, N + G, z + F, k + q).normalize(),
      Q[2].setComponents(H + Y, N + K, z + B, k + L).normalize(),
      Q[3].setComponents(H - Y, N - K, z - B, k - L).normalize(),
      U)
    )
      (Q[4].setComponents(D, O, E, V).normalize(), Q[5].setComponents(H - D, N - O, z - E, k - V).normalize());
    else if ((Q[4].setComponents(H - D, N - O, z - E, k - V).normalize(), J === 2000))
      Q[5].setComponents(H + D, N + O, z + E, k + V).normalize();
    else if (J === 2001) Q[5].setComponents(D, O, E, V).normalize();
    else throw Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: " + J);
    return this;
  }
  intersectsObject($) {
    if ($.boundingSphere !== void 0) {
      if ($.boundingSphere === null) $.computeBoundingSphere();
      y9.copy($.boundingSphere).applyMatrix4($.matrixWorld);
    } else {
      let J = $.geometry;
      if (J.boundingSphere === null) J.computeBoundingSphere();
      y9.copy(J.boundingSphere).applyMatrix4($.matrixWorld);
    }
    return this.intersectsSphere(y9);
  }
  intersectsSprite($) {
    y9.center.set(0, 0, 0);
    let J = Cm.distanceTo($.center);
    return ((y9.radius = 0.7071067811865476 + J), y9.applyMatrix4($.matrixWorld), this.intersectsSphere(y9));
  }
  intersectsSphere($) {
    let J = this.planes,
      U = $.center,
      Q = -$.radius;
    for (let W = 0; W < 6; W++) if (J[W].distanceToPoint(U) < Q) return !1;
    return !0;
  }
  intersectsBox($) {
    let J = this.planes;
    for (let U = 0; U < 6; U++) {
      let Q = J[U];
      if (
        (($G.x = Q.normal.x > 0 ? $.max.x : $.min.x),
        ($G.y = Q.normal.y > 0 ? $.max.y : $.min.y),
        ($G.z = Q.normal.z > 0 ? $.max.z : $.min.z),
        Q.distanceToPoint($G) < 0)
      )
        return !1;
    }
    return !0;
  }
  containsPoint($) {
    let J = this.planes;
    for (let U = 0; U < 6; U++) if (J[U].distanceToPoint($) < 0) return !1;
    return !0;
  }
  clone() {
    return new this.constructor().copy(this);
  }
}
class fU extends D8 {
  constructor($) {
    super();
    ((this.isLineBasicMaterial = !0),
      (this.type = "LineBasicMaterial"),
      (this.color = new W6(16777215)),
      (this.map = null),
      (this.linewidth = 1),
      (this.linecap = "round"),
      (this.linejoin = "round"),
      (this.fog = !0),
      this.setValues($));
  }
  copy($) {
    return (
      super.copy($),
      this.color.copy($.color),
      (this.map = $.map),
      (this.linewidth = $.linewidth),
      (this.linecap = $.linecap),
      (this.linejoin = $.linejoin),
      (this.fog = $.fog),
      this
    );
  }
}
var GG = new C(),
  KG = new C(),
  HZ = new x6(),
  UX = new p9(),
  JG = new p1(),
  iz = new C(),
  GZ = new C();
class s0 extends F0 {
  constructor($ = new Q0(), J = new fU()) {
    super();
    ((this.isLine = !0),
      (this.type = "Line"),
      (this.geometry = $),
      (this.material = J),
      (this.morphTargetDictionary = void 0),
      (this.morphTargetInfluences = void 0),
      this.updateMorphTargets());
  }
  copy($, J) {
    return (
      super.copy($, J),
      (this.material = Array.isArray($.material) ? $.material.slice() : $.material),
      (this.geometry = $.geometry),
      this
    );
  }
  computeLineDistances() {
    let $ = this.geometry;
    if ($.index === null) {
      let J = $.attributes.position,
        U = [0];
      for (let Q = 1, W = J.count; Q < W; Q++)
        (GG.fromBufferAttribute(J, Q - 1),
          KG.fromBufferAttribute(J, Q),
          (U[Q] = U[Q - 1]),
          (U[Q] += GG.distanceTo(KG)));
      $.setAttribute("lineDistance", new S6(U, 1));
    } else i$("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");
    return this;
  }
  raycast($, J) {
    let U = this.geometry,
      Q = this.matrixWorld,
      W = $.params.Line.threshold,
      X = U.drawRange;
    if (U.boundingSphere === null) U.computeBoundingSphere();
    if ((JG.copy(U.boundingSphere), JG.applyMatrix4(Q), (JG.radius += W), $.ray.intersectsSphere(JG) === !1)) return;
    (HZ.copy(Q).invert(), UX.copy($.ray).applyMatrix4(HZ));
    let Y = W / ((this.scale.x + this.scale.y + this.scale.z) / 3),
      D = Y * Y,
      H = this.isLineSegments ? 2 : 1,
      G = U.index,
      O = U.attributes.position;
    if (G !== null) {
      let N = Math.max(0, X.start),
        F = Math.min(G.count, X.start + X.count);
      for (let B = N, E = F - 1; B < E; B += H) {
        let z = G.getX(B),
          q = G.getX(B + 1),
          L = UG(this, $, UX, D, z, q, B);
        if (L) J.push(L);
      }
      if (this.isLineLoop) {
        let B = G.getX(F - 1),
          E = G.getX(N),
          z = UG(this, $, UX, D, B, E, F - 1);
        if (z) J.push(z);
      }
    } else {
      let N = Math.max(0, X.start),
        F = Math.min(O.count, X.start + X.count);
      for (let B = N, E = F - 1; B < E; B += H) {
        let z = UG(this, $, UX, D, B, B + 1, B);
        if (z) J.push(z);
      }
      if (this.isLineLoop) {
        let B = UG(this, $, UX, D, F - 1, N, F - 1);
        if (B) J.push(B);
      }
    }
  }
  updateMorphTargets() {
    let J = this.geometry.morphAttributes,
      U = Object.keys(J);
    if (U.length > 0) {
      let Q = J[U[0]];
      if (Q !== void 0) {
        ((this.morphTargetInfluences = []), (this.morphTargetDictionary = {}));
        for (let W = 0, X = Q.length; W < X; W++) {
          let Y = Q[W].name || String(W);
          (this.morphTargetInfluences.push(0), (this.morphTargetDictionary[Y] = W));
        }
      }
    }
  }
}
function UG($, J, U, Q, W, X, Y) {
  let D = $.geometry.attributes.position;
  if ((GG.fromBufferAttribute(D, W), KG.fromBufferAttribute(D, X), U.distanceSqToSegment(GG, KG, iz, GZ) > Q)) return;
  iz.applyMatrix4($.matrixWorld);
  let G = J.ray.origin.distanceTo(iz);
  if (G < J.near || G > J.far) return;
  return {
    distance: G,
    point: GZ.clone().applyMatrix4($.matrixWorld),
    index: Y,
    face: null,
    faceIndex: null,
    barycoord: null,
    object: $,
  };
}
var KZ = new C(),
  NZ = new C();
class PG extends s0 {
  constructor($, J) {
    super($, J);
    ((this.isLineSegments = !0), (this.type = "LineSegments"));
  }
  computeLineDistances() {
    let $ = this.geometry;
    if ($.index === null) {
      let J = $.attributes.position,
        U = [];
      for (let Q = 0, W = J.count; Q < W; Q += 2)
        (KZ.fromBufferAttribute(J, Q),
          NZ.fromBufferAttribute(J, Q + 1),
          (U[Q] = Q === 0 ? 0 : U[Q - 1]),
          (U[Q + 1] = U[Q] + KZ.distanceTo(NZ)));
      $.setAttribute("lineDistance", new S6(U, 1));
    } else i$("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");
    return this;
  }
}
class _G extends j0 {
  constructor($ = [], J = 301, U, Q, W, X, Y, D, H, G) {
    super($, J, U, Q, W, X, Y, D, H, G);
    ((this.isCubeTexture = !0), (this.flipY = !1));
  }
  get images() {
    return this.image;
  }
  set images($) {
    this.image = $;
  }
}
class SG extends j0 {
  constructor($, J, U, Q, W, X, Y, D, H) {
    super($, J, U, Q, W, X, Y, D, H);
    ((this.isCanvasTexture = !0), (this.needsUpdate = !0));
  }
}
class U9 extends j0 {
  constructor($, J, U = 1014, Q, W, X, Y = 1003, D = 1003, H, G = 1026, K = 1) {
    if (G !== 1026 && G !== 1027)
      throw Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");
    let O = { width: $, height: J, depth: K };
    super(O, Q, W, X, Y, D, G, U, H);
    ((this.isDepthTexture = !0), (this.flipY = !1), (this.generateMipmaps = !1), (this.compareFunction = null));
  }
  copy($) {
    return (
      super.copy($),
      (this.source = new OX(Object.assign({}, $.image))),
      (this.compareFunction = $.compareFunction),
      this
    );
  }
  toJSON($) {
    let J = super.toJSON($);
    if (this.compareFunction !== null) J.compareFunction = this.compareFunction;
    return J;
  }
}
class UE extends U9 {
  constructor($, J = 1014, U = 301, Q, W, X = 1003, Y = 1003, D, H = 1026) {
    let G = { width: $, height: $, depth: 1 },
      K = [G, G, G, G, G, G];
    super($, $, J, U, Q, W, X, Y, D, H);
    ((this.image = K), (this.isCubeDepthTexture = !0), (this.isCubeTexture = !0));
  }
  get images() {
    return this.image;
  }
  set images($) {
    this.image = $;
  }
}
class CG extends j0 {
  constructor($ = null) {
    super();
    ((this.sourceTexture = $), (this.isExternalTexture = !0));
  }
  copy($) {
    return (super.copy($), (this.sourceTexture = $.sourceTexture), this);
  }
}
class p6 extends Q0 {
  constructor($ = 1, J = 1, U = 1, Q = 1, W = 1, X = 1) {
    super();
    ((this.type = "BoxGeometry"),
      (this.parameters = { width: $, height: J, depth: U, widthSegments: Q, heightSegments: W, depthSegments: X }));
    let Y = this;
    ((Q = Math.floor(Q)), (W = Math.floor(W)), (X = Math.floor(X)));
    let D = [],
      H = [],
      G = [],
      K = [],
      O = 0,
      N = 0;
    (F("z", "y", "x", -1, -1, U, J, $, X, W, 0),
      F("z", "y", "x", 1, -1, U, J, -$, X, W, 1),
      F("x", "z", "y", 1, 1, $, U, J, Q, X, 2),
      F("x", "z", "y", 1, -1, $, U, -J, Q, X, 3),
      F("x", "y", "z", 1, -1, $, J, U, Q, W, 4),
      F("x", "y", "z", -1, -1, $, J, -U, Q, W, 5),
      this.setIndex(D),
      this.setAttribute("position", new S6(H, 3)),
      this.setAttribute("normal", new S6(G, 3)),
      this.setAttribute("uv", new S6(K, 2)));
    function F(B, E, z, q, L, V, k, R, _, S, w) {
      let M = V / _,
        m = k / S,
        P = V / 2,
        u = k / 2,
        n = R / 2,
        b = _ + 1,
        i = S + 1,
        x = 0,
        l = 0,
        r = new C();
      for (let G$ = 0; G$ < i; G$++) {
        let k$ = G$ * m - u;
        for (let h$ = 0; h$ < b; h$++) {
          let b$ = h$ * M - P;
          ((r[B] = b$ * q),
            (r[E] = k$ * L),
            (r[z] = n),
            H.push(r.x, r.y, r.z),
            (r[B] = 0),
            (r[E] = 0),
            (r[z] = R > 0 ? 1 : -1),
            G.push(r.x, r.y, r.z),
            K.push(h$ / _),
            K.push(1 - G$ / S),
            (x += 1));
        }
      }
      for (let G$ = 0; G$ < S; G$++)
        for (let k$ = 0; k$ < _; k$++) {
          let h$ = O + k$ + b * G$,
            b$ = O + k$ + b * (G$ + 1),
            b6 = O + (k$ + 1) + b * (G$ + 1),
            k6 = O + (k$ + 1) + b * G$;
          (D.push(h$, b$, k6), D.push(b$, b6, k6), (l += 6));
        }
      (Y.addGroup(N, l, w), (N += l), (O += x));
    }
  }
  copy($) {
    return (super.copy($), (this.parameters = Object.assign({}, $.parameters)), this);
  }
  static fromJSON($) {
    return new p6($.width, $.height, $.depth, $.widthSegments, $.heightSegments, $.depthSegments);
  }
}
class W9 extends Q0 {
  constructor($ = 1, J = 1, U = 4, Q = 8, W = 1) {
    super();
    ((this.type = "CapsuleGeometry"),
      (this.parameters = { radius: $, height: J, capSegments: U, radialSegments: Q, heightSegments: W }),
      (J = Math.max(0, J)),
      (U = Math.max(1, Math.floor(U))),
      (Q = Math.max(3, Math.floor(Q))),
      (W = Math.max(1, Math.floor(W))));
    let X = [],
      Y = [],
      D = [],
      H = [],
      G = J / 2,
      K = (Math.PI / 2) * $,
      O = J,
      N = 2 * K + O,
      F = U * 2 + W,
      B = Q + 1,
      E = new C(),
      z = new C();
    for (let q = 0; q <= F; q++) {
      let L = 0,
        V = 0,
        k = 0,
        R = 0;
      if (q <= U) {
        let w = q / U,
          M = (w * Math.PI) / 2;
        ((V = -G - $ * Math.cos(M)), (k = $ * Math.sin(M)), (R = -$ * Math.cos(M)), (L = w * K));
      } else if (q <= U + W) {
        let w = (q - U) / W;
        ((V = -G + w * J), (k = $), (R = 0), (L = K + w * O));
      } else {
        let w = (q - U - W) / U,
          M = (w * Math.PI) / 2;
        ((V = G + $ * Math.sin(M)), (k = $ * Math.cos(M)), (R = $ * Math.sin(M)), (L = K + O + w * K));
      }
      let _ = Math.max(0, Math.min(1, L / N)),
        S = 0;
      if (q === 0) S = 0.5 / Q;
      else if (q === F) S = -0.5 / Q;
      for (let w = 0; w <= Q; w++) {
        let M = w / Q,
          m = M * Math.PI * 2,
          P = Math.sin(m),
          u = Math.cos(m);
        ((z.x = -k * u),
          (z.y = V),
          (z.z = k * P),
          Y.push(z.x, z.y, z.z),
          E.set(-k * u, R, k * P),
          E.normalize(),
          D.push(E.x, E.y, E.z),
          H.push(M + S, _));
      }
      if (q > 0) {
        let w = (q - 1) * B;
        for (let M = 0; M < Q; M++) {
          let m = w + M,
            P = w + M + 1,
            u = q * B + M,
            n = q * B + M + 1;
          (X.push(m, P, u), X.push(P, n, u));
        }
      }
    }
    (this.setIndex(X),
      this.setAttribute("position", new S6(Y, 3)),
      this.setAttribute("normal", new S6(D, 3)),
      this.setAttribute("uv", new S6(H, 2)));
  }
  copy($) {
    return (super.copy($), (this.parameters = Object.assign({}, $.parameters)), this);
  }
  static fromJSON($) {
    return new W9($.radius, $.height, $.capSegments, $.radialSegments, $.heightSegments);
  }
}
class K0 extends Q0 {
  constructor($ = 1, J = 1, U = 1, Q = 32, W = 1, X = !1, Y = 0, D = Math.PI * 2) {
    super();
    ((this.type = "CylinderGeometry"),
      (this.parameters = {
        radiusTop: $,
        radiusBottom: J,
        height: U,
        radialSegments: Q,
        heightSegments: W,
        openEnded: X,
        thetaStart: Y,
        thetaLength: D,
      }));
    let H = this;
    ((Q = Math.floor(Q)), (W = Math.floor(W)));
    let G = [],
      K = [],
      O = [],
      N = [],
      F = 0,
      B = [],
      E = U / 2,
      z = 0;
    if ((q(), X === !1)) {
      if ($ > 0) L(!0);
      if (J > 0) L(!1);
    }
    (this.setIndex(G),
      this.setAttribute("position", new S6(K, 3)),
      this.setAttribute("normal", new S6(O, 3)),
      this.setAttribute("uv", new S6(N, 2)));
    function q() {
      let V = new C(),
        k = new C(),
        R = 0,
        _ = (J - $) / U;
      for (let S = 0; S <= W; S++) {
        let w = [],
          M = S / W,
          m = M * (J - $) + $;
        for (let P = 0; P <= Q; P++) {
          let u = P / Q,
            n = u * D + Y,
            b = Math.sin(n),
            i = Math.cos(n);
          ((k.x = m * b),
            (k.y = -M * U + E),
            (k.z = m * i),
            K.push(k.x, k.y, k.z),
            V.set(b, _, i).normalize(),
            O.push(V.x, V.y, V.z),
            N.push(u, 1 - M),
            w.push(F++));
        }
        B.push(w);
      }
      for (let S = 0; S < Q; S++)
        for (let w = 0; w < W; w++) {
          let M = B[w][S],
            m = B[w + 1][S],
            P = B[w + 1][S + 1],
            u = B[w][S + 1];
          if ($ > 0 || w !== 0) (G.push(M, m, u), (R += 3));
          if (J > 0 || w !== W - 1) (G.push(m, P, u), (R += 3));
        }
      (H.addGroup(z, R, 0), (z += R));
    }
    function L(V) {
      let k = F,
        R = new d$(),
        _ = new C(),
        S = 0,
        w = V === !0 ? $ : J,
        M = V === !0 ? 1 : -1;
      for (let P = 1; P <= Q; P++) (K.push(0, E * M, 0), O.push(0, M, 0), N.push(0.5, 0.5), F++);
      let m = F;
      for (let P = 0; P <= Q; P++) {
        let n = (P / Q) * D + Y,
          b = Math.cos(n),
          i = Math.sin(n);
        ((_.x = w * i),
          (_.y = E * M),
          (_.z = w * b),
          K.push(_.x, _.y, _.z),
          O.push(0, M, 0),
          (R.x = b * 0.5 + 0.5),
          (R.y = i * 0.5 * M + 0.5),
          N.push(R.x, R.y),
          F++);
      }
      for (let P = 0; P < Q; P++) {
        let u = k + P,
          n = m + P;
        if (V === !0) G.push(n, n + 1, u);
        else G.push(n + 1, n, u);
        S += 3;
      }
      (H.addGroup(z, S, V === !0 ? 1 : 2), (z += S));
    }
  }
  copy($) {
    return (super.copy($), (this.parameters = Object.assign({}, $.parameters)), this);
  }
  static fromJSON($) {
    return new K0(
      $.radiusTop,
      $.radiusBottom,
      $.height,
      $.radialSegments,
      $.heightSegments,
      $.openEnded,
      $.thetaStart,
      $.thetaLength,
    );
  }
}
class d1 extends K0 {
  constructor($ = 1, J = 1, U = 32, Q = 1, W = !1, X = 0, Y = Math.PI * 2) {
    super(0, $, J, U, Q, W, X, Y);
    ((this.type = "ConeGeometry"),
      (this.parameters = {
        radius: $,
        height: J,
        radialSegments: U,
        heightSegments: Q,
        openEnded: W,
        thetaStart: X,
        thetaLength: Y,
      }));
  }
  static fromJSON($) {
    return new d1($.radius, $.height, $.radialSegments, $.heightSegments, $.openEnded, $.thetaStart, $.thetaLength);
  }
}
class TG extends Q0 {
  constructor($ = [], J = [], U = 1, Q = 0) {
    super();
    ((this.type = "PolyhedronGeometry"), (this.parameters = { vertices: $, indices: J, radius: U, detail: Q }));
    let W = [],
      X = [];
    if (
      (Y(Q),
      H(U),
      G(),
      this.setAttribute("position", new S6(W, 3)),
      this.setAttribute("normal", new S6(W.slice(), 3)),
      this.setAttribute("uv", new S6(X, 2)),
      Q === 0)
    )
      this.computeVertexNormals();
    else this.normalizeNormals();
    function Y(q) {
      let L = new C(),
        V = new C(),
        k = new C();
      for (let R = 0; R < J.length; R += 3) (N(J[R + 0], L), N(J[R + 1], V), N(J[R + 2], k), D(L, V, k, q));
    }
    function D(q, L, V, k) {
      let R = k + 1,
        _ = [];
      for (let S = 0; S <= R; S++) {
        _[S] = [];
        let w = q.clone().lerp(V, S / R),
          M = L.clone().lerp(V, S / R),
          m = R - S;
        for (let P = 0; P <= m; P++)
          if (P === 0 && S === R) _[S][P] = w;
          else _[S][P] = w.clone().lerp(M, P / m);
      }
      for (let S = 0; S < R; S++)
        for (let w = 0; w < 2 * (R - S) - 1; w++) {
          let M = Math.floor(w / 2);
          if (w % 2 === 0) (O(_[S][M + 1]), O(_[S + 1][M]), O(_[S][M]));
          else (O(_[S][M + 1]), O(_[S + 1][M + 1]), O(_[S + 1][M]));
        }
    }
    function H(q) {
      let L = new C();
      for (let V = 0; V < W.length; V += 3)
        ((L.x = W[V + 0]),
          (L.y = W[V + 1]),
          (L.z = W[V + 2]),
          L.normalize().multiplyScalar(q),
          (W[V + 0] = L.x),
          (W[V + 1] = L.y),
          (W[V + 2] = L.z));
    }
    function G() {
      let q = new C();
      for (let L = 0; L < W.length; L += 3) {
        ((q.x = W[L + 0]), (q.y = W[L + 1]), (q.z = W[L + 2]));
        let V = E(q) / 2 / Math.PI + 0.5,
          k = z(q) / Math.PI + 0.5;
        X.push(V, 1 - k);
      }
      (F(), K());
    }
    function K() {
      for (let q = 0; q < X.length; q += 6) {
        let L = X[q + 0],
          V = X[q + 2],
          k = X[q + 4],
          R = Math.max(L, V, k),
          _ = Math.min(L, V, k);
        if (R > 0.9 && _ < 0.1) {
          if (L < 0.2) X[q + 0] += 1;
          if (V < 0.2) X[q + 2] += 1;
          if (k < 0.2) X[q + 4] += 1;
        }
      }
    }
    function O(q) {
      W.push(q.x, q.y, q.z);
    }
    function N(q, L) {
      let V = q * 3;
      ((L.x = $[V + 0]), (L.y = $[V + 1]), (L.z = $[V + 2]));
    }
    function F() {
      let q = new C(),
        L = new C(),
        V = new C(),
        k = new C(),
        R = new d$(),
        _ = new d$(),
        S = new d$();
      for (let w = 0, M = 0; w < W.length; w += 9, M += 6) {
        (q.set(W[w + 0], W[w + 1], W[w + 2]),
          L.set(W[w + 3], W[w + 4], W[w + 5]),
          V.set(W[w + 6], W[w + 7], W[w + 8]),
          R.set(X[M + 0], X[M + 1]),
          _.set(X[M + 2], X[M + 3]),
          S.set(X[M + 4], X[M + 5]),
          k.copy(q).add(L).add(V).divideScalar(3));
        let m = E(k);
        (B(R, M + 0, q, m), B(_, M + 2, L, m), B(S, M + 4, V, m));
      }
    }
    function B(q, L, V, k) {
      if (k < 0 && q.x === 1) X[L] = q.x - 1;
      if (V.x === 0 && V.z === 0) X[L] = k / 2 / Math.PI + 0.5;
    }
    function E(q) {
      return Math.atan2(q.z, -q.x);
    }
    function z(q) {
      return Math.atan2(-q.y, Math.sqrt(q.x * q.x + q.z * q.z));
    }
  }
  copy($) {
    return (super.copy($), (this.parameters = Object.assign({}, $.parameters)), this);
  }
  static fromJSON($) {
    return new TG($.vertices, $.indices, $.radius, $.detail);
  }
}
class Q9 extends TG {
  constructor($ = 1, J = 0) {
    let U = [1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1],
      Q = [0, 2, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 3, 1, 3, 4, 1, 4, 2];
    super(U, Q, $, J);
    ((this.type = "OctahedronGeometry"), (this.parameters = { radius: $, detail: J }));
  }
  static fromJSON($) {
    return new Q9($.radius, $.detail);
  }
}
class yU extends Q0 {
  constructor($ = 1, J = 1, U = 1, Q = 1) {
    super();
    ((this.type = "PlaneGeometry"), (this.parameters = { width: $, height: J, widthSegments: U, heightSegments: Q }));
    let W = $ / 2,
      X = J / 2,
      Y = Math.floor(U),
      D = Math.floor(Q),
      H = Y + 1,
      G = D + 1,
      K = $ / Y,
      O = J / D,
      N = [],
      F = [],
      B = [],
      E = [];
    for (let z = 0; z < G; z++) {
      let q = z * O - X;
      for (let L = 0; L < H; L++) {
        let V = L * K - W;
        (F.push(V, -q, 0), B.push(0, 0, 1), E.push(L / Y), E.push(1 - z / D));
      }
    }
    for (let z = 0; z < D; z++)
      for (let q = 0; q < Y; q++) {
        let L = q + H * z,
          V = q + H * (z + 1),
          k = q + 1 + H * (z + 1),
          R = q + 1 + H * z;
        (N.push(L, V, R), N.push(V, k, R));
      }
    (this.setIndex(N),
      this.setAttribute("position", new S6(F, 3)),
      this.setAttribute("normal", new S6(B, 3)),
      this.setAttribute("uv", new S6(E, 2)));
  }
  copy($) {
    return (super.copy($), (this.parameters = Object.assign({}, $.parameters)), this);
  }
  static fromJSON($) {
    return new yU($.width, $.height, $.widthSegments, $.heightSegments);
  }
}
class NJ extends Q0 {
  constructor($ = 1, J = 32, U = 16, Q = 0, W = Math.PI * 2, X = 0, Y = Math.PI) {
    super();
    ((this.type = "SphereGeometry"),
      (this.parameters = {
        radius: $,
        widthSegments: J,
        heightSegments: U,
        phiStart: Q,
        phiLength: W,
        thetaStart: X,
        thetaLength: Y,
      }),
      (J = Math.max(3, Math.floor(J))),
      (U = Math.max(2, Math.floor(U))));
    let D = Math.min(X + Y, Math.PI),
      H = 0,
      G = [],
      K = new C(),
      O = new C(),
      N = [],
      F = [],
      B = [],
      E = [];
    for (let z = 0; z <= U; z++) {
      let q = [],
        L = z / U,
        V = 0;
      if (z === 0 && X === 0) V = 0.5 / J;
      else if (z === U && D === Math.PI) V = -0.5 / J;
      for (let k = 0; k <= J; k++) {
        let R = k / J;
        ((K.x = -$ * Math.cos(Q + R * W) * Math.sin(X + L * Y)),
          (K.y = $ * Math.cos(X + L * Y)),
          (K.z = $ * Math.sin(Q + R * W) * Math.sin(X + L * Y)),
          F.push(K.x, K.y, K.z),
          O.copy(K).normalize(),
          B.push(O.x, O.y, O.z),
          E.push(R + V, 1 - L),
          q.push(H++));
      }
      G.push(q);
    }
    for (let z = 0; z < U; z++)
      for (let q = 0; q < J; q++) {
        let L = G[z][q + 1],
          V = G[z][q],
          k = G[z + 1][q],
          R = G[z + 1][q + 1];
        if (z !== 0 || X > 0) N.push(L, V, R);
        if (z !== U - 1 || D < Math.PI) N.push(V, k, R);
      }
    (this.setIndex(N),
      this.setAttribute("position", new S6(F, 3)),
      this.setAttribute("normal", new S6(B, 3)),
      this.setAttribute("uv", new S6(E, 2)));
  }
  copy($) {
    return (super.copy($), (this.parameters = Object.assign({}, $.parameters)), this);
  }
  static fromJSON($) {
    return new NJ($.radius, $.widthSegments, $.heightSegments, $.phiStart, $.phiLength, $.thetaStart, $.thetaLength);
  }
}
class H8 extends Q0 {
  constructor($ = 1, J = 0.4, U = 12, Q = 48, W = Math.PI * 2, X = 0, Y = Math.PI * 2) {
    super();
    ((this.type = "TorusGeometry"),
      (this.parameters = {
        radius: $,
        tube: J,
        radialSegments: U,
        tubularSegments: Q,
        arc: W,
        thetaStart: X,
        thetaLength: Y,
      }),
      (U = Math.floor(U)),
      (Q = Math.floor(Q)));
    let D = [],
      H = [],
      G = [],
      K = [],
      O = new C(),
      N = new C(),
      F = new C();
    for (let B = 0; B <= U; B++) {
      let E = X + (B / U) * Y;
      for (let z = 0; z <= Q; z++) {
        let q = (z / Q) * W;
        ((N.x = ($ + J * Math.cos(E)) * Math.cos(q)),
          (N.y = ($ + J * Math.cos(E)) * Math.sin(q)),
          (N.z = J * Math.sin(E)),
          H.push(N.x, N.y, N.z),
          (O.x = $ * Math.cos(q)),
          (O.y = $ * Math.sin(q)),
          F.subVectors(N, O).normalize(),
          G.push(F.x, F.y, F.z),
          K.push(z / Q),
          K.push(B / U));
      }
    }
    for (let B = 1; B <= U; B++)
      for (let E = 1; E <= Q; E++) {
        let z = (Q + 1) * B + E - 1,
          q = (Q + 1) * (B - 1) + E - 1,
          L = (Q + 1) * (B - 1) + E,
          V = (Q + 1) * B + E;
        (D.push(z, q, V), D.push(q, L, V));
      }
    (this.setIndex(D),
      this.setAttribute("position", new S6(H, 3)),
      this.setAttribute("normal", new S6(G, 3)),
      this.setAttribute("uv", new S6(K, 2)));
  }
  copy($) {
    return (super.copy($), (this.parameters = Object.assign({}, $.parameters)), this);
  }
  static fromJSON($) {
    return new H8($.radius, $.tube, $.radialSegments, $.tubularSegments, $.arc);
  }
}
function c9($) {
  let J = {};
  for (let U in $) {
    J[U] = {};
    for (let Q in $[U]) {
      let W = $[U][Q];
      if (OZ(W))
        if (W.isRenderTargetTexture)
          (i$("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),
            (J[U][Q] = null));
        else J[U][Q] = W.clone();
      else if (Array.isArray(W))
        if (OZ(W[0])) {
          let X = [];
          for (let Y = 0, D = W.length; Y < D; Y++) X[Y] = W[Y].clone();
          J[U][Q] = X;
        } else J[U][Q] = W.slice();
      else J[U][Q] = W;
    }
  }
  return J;
}
function a0($) {
  let J = {};
  for (let U = 0; U < $.length; U++) {
    let Q = c9($[U]);
    for (let W in Q) J[W] = Q[W];
  }
  return J;
}
function OZ($) {
  return (
    $ &&
    ($.isColor ||
      $.isMatrix3 ||
      $.isMatrix4 ||
      $.isVector2 ||
      $.isVector3 ||
      $.isVector4 ||
      $.isTexture ||
      $.isQuaternion)
  );
}
function Tm($) {
  let J = [];
  for (let U = 0; U < $.length; U++) J.push($[U].clone());
  return J;
}
function WE($) {
  let J = $.getRenderTarget();
  if (J === null) return $.outputColorSpace;
  if (J.isXRRenderTarget === !0) return J.texture.colorSpace;
  return R6.workingColorSpace;
}
var AP = { clone: c9, merge: a0 },
  jm = `void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,
  vm = `void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;
class dJ extends D8 {
  constructor($) {
    super();
    if (
      ((this.isShaderMaterial = !0),
      (this.type = "ShaderMaterial"),
      (this.defines = {}),
      (this.uniforms = {}),
      (this.uniformsGroups = []),
      (this.vertexShader = jm),
      (this.fragmentShader = vm),
      (this.linewidth = 1),
      (this.wireframe = !1),
      (this.wireframeLinewidth = 1),
      (this.fog = !1),
      (this.lights = !1),
      (this.clipping = !1),
      (this.forceSinglePass = !0),
      (this.extensions = { clipCullDistance: !1, multiDraw: !1 }),
      (this.defaultAttributeValues = { color: [1, 1, 1], uv: [0, 0], uv1: [0, 0] }),
      (this.index0AttributeName = void 0),
      (this.uniformsNeedUpdate = !1),
      (this.glslVersion = null),
      $ !== void 0)
    )
      this.setValues($);
  }
  copy($) {
    return (
      super.copy($),
      (this.fragmentShader = $.fragmentShader),
      (this.vertexShader = $.vertexShader),
      (this.uniforms = c9($.uniforms)),
      (this.uniformsGroups = Tm($.uniformsGroups)),
      (this.defines = Object.assign({}, $.defines)),
      (this.wireframe = $.wireframe),
      (this.wireframeLinewidth = $.wireframeLinewidth),
      (this.fog = $.fog),
      (this.lights = $.lights),
      (this.clipping = $.clipping),
      (this.extensions = Object.assign({}, $.extensions)),
      (this.glslVersion = $.glslVersion),
      (this.defaultAttributeValues = Object.assign({}, $.defaultAttributeValues)),
      (this.index0AttributeName = $.index0AttributeName),
      (this.uniformsNeedUpdate = $.uniformsNeedUpdate),
      this
    );
  }
  toJSON($) {
    let J = super.toJSON($);
    ((J.glslVersion = this.glslVersion), (J.uniforms = {}));
    for (let Q in this.uniforms) {
      let X = this.uniforms[Q].value;
      if (X && X.isTexture) J.uniforms[Q] = { type: "t", value: X.toJSON($).uuid };
      else if (X && X.isColor) J.uniforms[Q] = { type: "c", value: X.getHex() };
      else if (X && X.isVector2) J.uniforms[Q] = { type: "v2", value: X.toArray() };
      else if (X && X.isVector3) J.uniforms[Q] = { type: "v3", value: X.toArray() };
      else if (X && X.isVector4) J.uniforms[Q] = { type: "v4", value: X.toArray() };
      else if (X && X.isMatrix3) J.uniforms[Q] = { type: "m3", value: X.toArray() };
      else if (X && X.isMatrix4) J.uniforms[Q] = { type: "m4", value: X.toArray() };
      else J.uniforms[Q] = { value: X };
    }
    if (Object.keys(this.defines).length > 0) J.defines = this.defines;
    ((J.vertexShader = this.vertexShader),
      (J.fragmentShader = this.fragmentShader),
      (J.lights = this.lights),
      (J.clipping = this.clipping));
    let U = {};
    for (let Q in this.extensions) if (this.extensions[Q] === !0) U[Q] = !0;
    if (Object.keys(U).length > 0) J.extensions = U;
    return J;
  }
}
class QE extends dJ {
  constructor($) {
    super($);
    ((this.isRawShaderMaterial = !0), (this.type = "RawShaderMaterial"));
  }
}
class cJ extends D8 {
  constructor($) {
    super();
    ((this.isMeshStandardMaterial = !0),
      (this.type = "MeshStandardMaterial"),
      (this.defines = { STANDARD: "" }),
      (this.color = new W6(16777215)),
      (this.roughness = 1),
      (this.metalness = 0),
      (this.map = null),
      (this.lightMap = null),
      (this.lightMapIntensity = 1),
      (this.aoMap = null),
      (this.aoMapIntensity = 1),
      (this.emissive = new W6(0)),
      (this.emissiveIntensity = 1),
      (this.emissiveMap = null),
      (this.bumpMap = null),
      (this.bumpScale = 1),
      (this.normalMap = null),
      (this.normalMapType = 0),
      (this.normalScale = new d$(1, 1)),
      (this.displacementMap = null),
      (this.displacementScale = 1),
      (this.displacementBias = 0),
      (this.roughnessMap = null),
      (this.metalnessMap = null),
      (this.alphaMap = null),
      (this.envMap = null),
      (this.envMapRotation = new NU()),
      (this.envMapIntensity = 1),
      (this.wireframe = !1),
      (this.wireframeLinewidth = 1),
      (this.wireframeLinecap = "round"),
      (this.wireframeLinejoin = "round"),
      (this.flatShading = !1),
      (this.fog = !0),
      this.setValues($));
  }
  copy($) {
    return (
      super.copy($),
      (this.defines = { STANDARD: "" }),
      this.color.copy($.color),
      (this.roughness = $.roughness),
      (this.metalness = $.metalness),
      (this.map = $.map),
      (this.lightMap = $.lightMap),
      (this.lightMapIntensity = $.lightMapIntensity),
      (this.aoMap = $.aoMap),
      (this.aoMapIntensity = $.aoMapIntensity),
      this.emissive.copy($.emissive),
      (this.emissiveMap = $.emissiveMap),
      (this.emissiveIntensity = $.emissiveIntensity),
      (this.bumpMap = $.bumpMap),
      (this.bumpScale = $.bumpScale),
      (this.normalMap = $.normalMap),
      (this.normalMapType = $.normalMapType),
      this.normalScale.copy($.normalScale),
      (this.displacementMap = $.displacementMap),
      (this.displacementScale = $.displacementScale),
      (this.displacementBias = $.displacementBias),
      (this.roughnessMap = $.roughnessMap),
      (this.metalnessMap = $.metalnessMap),
      (this.alphaMap = $.alphaMap),
      (this.envMap = $.envMap),
      this.envMapRotation.copy($.envMapRotation),
      (this.envMapIntensity = $.envMapIntensity),
      (this.wireframe = $.wireframe),
      (this.wireframeLinewidth = $.wireframeLinewidth),
      (this.wireframeLinecap = $.wireframeLinecap),
      (this.wireframeLinejoin = $.wireframeLinejoin),
      (this.flatShading = $.flatShading),
      (this.fog = $.fog),
      this
    );
  }
}
class XE extends D8 {
  constructor($) {
    super();
    ((this.isMeshDepthMaterial = !0),
      (this.type = "MeshDepthMaterial"),
      (this.depthPacking = 3200),
      (this.map = null),
      (this.alphaMap = null),
      (this.displacementMap = null),
      (this.displacementScale = 1),
      (this.displacementBias = 0),
      (this.wireframe = !1),
      (this.wireframeLinewidth = 1),
      this.setValues($));
  }
  copy($) {
    return (
      super.copy($),
      (this.depthPacking = $.depthPacking),
      (this.map = $.map),
      (this.alphaMap = $.alphaMap),
      (this.displacementMap = $.displacementMap),
      (this.displacementScale = $.displacementScale),
      (this.displacementBias = $.displacementBias),
      (this.wireframe = $.wireframe),
      (this.wireframeLinewidth = $.wireframeLinewidth),
      this
    );
  }
}
class YE extends D8 {
  constructor($) {
    super();
    ((this.isMeshDistanceMaterial = !0),
      (this.type = "MeshDistanceMaterial"),
      (this.map = null),
      (this.alphaMap = null),
      (this.displacementMap = null),
      (this.displacementScale = 1),
      (this.displacementBias = 0),
      this.setValues($));
  }
  copy($) {
    return (
      super.copy($),
      (this.map = $.map),
      (this.alphaMap = $.alphaMap),
      (this.displacementMap = $.displacementMap),
      (this.displacementScale = $.displacementScale),
      (this.displacementBias = $.displacementBias),
      this
    );
  }
}
class EX extends fU {
  constructor($) {
    super();
    ((this.isLineDashedMaterial = !0),
      (this.type = "LineDashedMaterial"),
      (this.scale = 1),
      (this.dashSize = 3),
      (this.gapSize = 1),
      this.setValues($));
  }
  copy($) {
    return (super.copy($), (this.scale = $.scale), (this.dashSize = $.dashSize), (this.gapSize = $.gapSize), this);
  }
}
function WG($, J) {
  if (!$ || $.constructor === J) return $;
  if (typeof J.BYTES_PER_ELEMENT === "number") return new J($);
  return Array.prototype.slice.call($);
}
class n9 {
  constructor($, J, U, Q) {
    ((this.parameterPositions = $),
      (this._cachedIndex = 0),
      (this.resultBuffer = Q !== void 0 ? Q : new J.constructor(U)),
      (this.sampleValues = J),
      (this.valueSize = U),
      (this.settings = null),
      (this.DefaultSettings_ = {}));
  }
  evaluate($) {
    let J = this.parameterPositions,
      U = this._cachedIndex,
      Q = J[U],
      W = J[U - 1];
    U: {
      $: {
        let X;
        J: {
          W: if (!($ < Q)) {
            for (let Y = U + 2; ;) {
              if (Q === void 0) {
                if ($ < W) break W;
                return ((U = J.length), (this._cachedIndex = U), this.copySampleValue_(U - 1));
              }
              if (U === Y) break;
              if (((W = Q), (Q = J[++U]), $ < Q)) break $;
            }
            X = J.length;
            break J;
          }
          if (!($ >= W)) {
            let Y = J[1];
            if ($ < Y) ((U = 2), (W = Y));
            for (let D = U - 2; ;) {
              if (W === void 0) return ((this._cachedIndex = 0), this.copySampleValue_(0));
              if (U === D) break;
              if (((Q = W), (W = J[--U - 1]), $ >= W)) break $;
            }
            ((X = U), (U = 0));
            break J;
          }
          break U;
        }
        while (U < X) {
          let Y = (U + X) >>> 1;
          if ($ < J[Y]) X = Y;
          else U = Y + 1;
        }
        if (((Q = J[U]), (W = J[U - 1]), W === void 0)) return ((this._cachedIndex = 0), this.copySampleValue_(0));
        if (Q === void 0) return ((U = J.length), (this._cachedIndex = U), this.copySampleValue_(U - 1));
      }
      ((this._cachedIndex = U), this.intervalChanged_(U, W, Q));
    }
    return this.interpolate_(U, W, $, Q);
  }
  getSettings_() {
    return this.settings || this.DefaultSettings_;
  }
  copySampleValue_($) {
    let J = this.resultBuffer,
      U = this.sampleValues,
      Q = this.valueSize,
      W = $ * Q;
    for (let X = 0; X !== Q; ++X) J[X] = U[W + X];
    return J;
  }
  interpolate_() {
    throw Error("call to abstract method");
  }
  intervalChanged_() {}
}
class DE extends n9 {
  constructor($, J, U, Q) {
    super($, J, U, Q);
    ((this._weightPrev = -0),
      (this._offsetPrev = -0),
      (this._weightNext = -0),
      (this._offsetNext = -0),
      (this.DefaultSettings_ = { endingStart: 2400, endingEnd: 2400 }));
  }
  intervalChanged_($, J, U) {
    let Q = this.parameterPositions,
      W = $ - 2,
      X = $ + 1,
      Y = Q[W],
      D = Q[X];
    if (Y === void 0)
      switch (this.getSettings_().endingStart) {
        case 2401:
          ((W = $), (Y = 2 * J - U));
          break;
        case 2402:
          ((W = Q.length - 2), (Y = J + Q[W] - Q[W + 1]));
          break;
        default:
          ((W = $), (Y = U));
      }
    if (D === void 0)
      switch (this.getSettings_().endingEnd) {
        case 2401:
          ((X = $), (D = 2 * U - J));
          break;
        case 2402:
          ((X = 1), (D = U + Q[1] - Q[0]));
          break;
        default:
          ((X = $ - 1), (D = J));
      }
    let H = (U - J) * 0.5,
      G = this.valueSize;
    ((this._weightPrev = H / (J - Y)),
      (this._weightNext = H / (D - U)),
      (this._offsetPrev = W * G),
      (this._offsetNext = X * G));
  }
  interpolate_($, J, U, Q) {
    let W = this.resultBuffer,
      X = this.sampleValues,
      Y = this.valueSize,
      D = $ * Y,
      H = D - Y,
      G = this._offsetPrev,
      K = this._offsetNext,
      O = this._weightPrev,
      N = this._weightNext,
      F = (U - J) / (Q - J),
      B = F * F,
      E = B * F,
      z = -O * E + 2 * O * B - O * F,
      q = (1 + O) * E + (-1.5 - 2 * O) * B + (-0.5 + O) * F + 1,
      L = (-1 - N) * E + (1.5 + N) * B + 0.5 * F,
      V = N * E - N * B;
    for (let k = 0; k !== Y; ++k) W[k] = z * X[G + k] + q * X[H + k] + L * X[D + k] + V * X[K + k];
    return W;
  }
}
class HE extends n9 {
  constructor($, J, U, Q) {
    super($, J, U, Q);
  }
  interpolate_($, J, U, Q) {
    let W = this.resultBuffer,
      X = this.sampleValues,
      Y = this.valueSize,
      D = $ * Y,
      H = D - Y,
      G = (U - J) / (Q - J),
      K = 1 - G;
    for (let O = 0; O !== Y; ++O) W[O] = X[H + O] * K + X[D + O] * G;
    return W;
  }
}
class GE extends n9 {
  constructor($, J, U, Q) {
    super($, J, U, Q);
  }
  interpolate_($) {
    return this.copySampleValue_($ - 1);
  }
}
class KE extends n9 {
  interpolate_($, J, U, Q) {
    let W = this.resultBuffer,
      X = this.sampleValues,
      Y = this.valueSize,
      D = $ * Y,
      H = D - Y,
      G = this.settings || this.DefaultSettings_,
      K = G.inTangents,
      O = G.outTangents;
    if (!K || !O) {
      let B = (U - J) / (Q - J),
        E = 1 - B;
      for (let z = 0; z !== Y; ++z) W[z] = X[H + z] * E + X[D + z] * B;
      return W;
    }
    let N = Y * 2,
      F = $ - 1;
    for (let B = 0; B !== Y; ++B) {
      let E = X[H + B],
        z = X[D + B],
        q = F * N + B * 2,
        L = O[q],
        V = O[q + 1],
        k = $ * N + B * 2,
        R = K[k],
        _ = K[k + 1],
        S = (U - J) / (Q - J),
        w,
        M,
        m,
        P,
        u;
      for (let n = 0; n < 8; n++) {
        ((w = S * S), (M = w * S), (m = 1 - S), (P = m * m), (u = P * m));
        let i = u * J + 3 * P * S * L + 3 * m * w * R + M * Q - U;
        if (Math.abs(i) < 0.0000000001) break;
        let x = 3 * P * (L - J) + 6 * m * S * (R - L) + 3 * w * (Q - R);
        if (Math.abs(x) < 0.0000000001) break;
        ((S = S - i / x), (S = Math.max(0, Math.min(1, S))));
      }
      W[B] = u * E + 3 * P * S * V + 3 * m * w * _ + M * z;
    }
    return W;
  }
}
class nJ {
  constructor($, J, U, Q) {
    if ($ === void 0) throw Error("THREE.KeyframeTrack: track name is undefined");
    if (J === void 0 || J.length === 0) throw Error("THREE.KeyframeTrack: no keyframes in track named " + $);
    ((this.name = $),
      (this.times = WG(J, this.TimeBufferType)),
      (this.values = WG(U, this.ValueBufferType)),
      this.setInterpolation(Q || this.DefaultInterpolation));
  }
  static toJSON($) {
    let J = $.constructor,
      U;
    if (J.toJSON !== this.toJSON) U = J.toJSON($);
    else {
      U = { name: $.name, times: WG($.times, Array), values: WG($.values, Array) };
      let Q = $.getInterpolation();
      if (Q !== $.DefaultInterpolation) U.interpolation = Q;
    }
    return ((U.type = $.ValueTypeName), U);
  }
  InterpolantFactoryMethodDiscrete($) {
    return new GE(this.times, this.values, this.getValueSize(), $);
  }
  InterpolantFactoryMethodLinear($) {
    return new HE(this.times, this.values, this.getValueSize(), $);
  }
  InterpolantFactoryMethodSmooth($) {
    return new DE(this.times, this.values, this.getValueSize(), $);
  }
  InterpolantFactoryMethodBezier($) {
    let J = new KE(this.times, this.values, this.getValueSize(), $);
    if (this.settings) J.settings = this.settings;
    return J;
  }
  setInterpolation($) {
    let J;
    switch ($) {
      case 2300:
        J = this.InterpolantFactoryMethodDiscrete;
        break;
      case 2301:
        J = this.InterpolantFactoryMethodLinear;
        break;
      case 2302:
        J = this.InterpolantFactoryMethodSmooth;
        break;
      case 2303:
        J = this.InterpolantFactoryMethodBezier;
        break;
    }
    if (J === void 0) {
      let U = "unsupported interpolation for " + this.ValueTypeName + " keyframe track named " + this.name;
      if (this.createInterpolant === void 0)
        if ($ !== this.DefaultInterpolation) this.setInterpolation(this.DefaultInterpolation);
        else throw Error(U);
      return (i$("KeyframeTrack:", U), this);
    }
    return ((this.createInterpolant = J), this);
  }
  getInterpolation() {
    switch (this.createInterpolant) {
      case this.InterpolantFactoryMethodDiscrete:
        return 2300;
      case this.InterpolantFactoryMethodLinear:
        return 2301;
      case this.InterpolantFactoryMethodSmooth:
        return 2302;
      case this.InterpolantFactoryMethodBezier:
        return 2303;
    }
  }
  getValueSize() {
    return this.values.length / this.times.length;
  }
  shift($) {
    if ($ !== 0) {
      let J = this.times;
      for (let U = 0, Q = J.length; U !== Q; ++U) J[U] += $;
    }
    return this;
  }
  scale($) {
    if ($ !== 1) {
      let J = this.times;
      for (let U = 0, Q = J.length; U !== Q; ++U) J[U] *= $;
    }
    return this;
  }
  trim($, J) {
    let U = this.times,
      Q = U.length,
      W = 0,
      X = Q - 1;
    while (W !== Q && U[W] < $) ++W;
    while (X !== -1 && U[X] > J) --X;
    if ((++X, W !== 0 || X !== Q)) {
      if (W >= X) ((X = Math.max(X, 1)), (W = X - 1));
      let Y = this.getValueSize();
      ((this.times = U.slice(W, X)), (this.values = this.values.slice(W * Y, X * Y)));
    }
    return this;
  }
  validate() {
    let $ = !0,
      J = this.getValueSize();
    if (J - Math.floor(J) !== 0) (s$("KeyframeTrack: Invalid value size in track.", this), ($ = !1));
    let U = this.times,
      Q = this.values,
      W = U.length;
    if (W === 0) (s$("KeyframeTrack: Track is empty.", this), ($ = !1));
    let X = null;
    for (let Y = 0; Y !== W; Y++) {
      let D = U[Y];
      if (typeof D === "number" && isNaN(D)) {
        (s$("KeyframeTrack: Time is not a valid number.", this, Y, D), ($ = !1));
        break;
      }
      if (X !== null && X > D) {
        (s$("KeyframeTrack: Out of order keys.", this, Y, D, X), ($ = !1));
        break;
      }
      X = D;
    }
    if (Q !== void 0) {
      if (sl(Q))
        for (let Y = 0, D = Q.length; Y !== D; ++Y) {
          let H = Q[Y];
          if (isNaN(H)) {
            (s$("KeyframeTrack: Value is not a valid number.", this, Y, H), ($ = !1));
            break;
          }
        }
    }
    return $;
  }
  optimize() {
    let $ = this.times.slice(),
      J = this.values.slice(),
      U = this.getValueSize(),
      Q = this.getInterpolation() === 2302,
      W = $.length - 1,
      X = 1;
    for (let Y = 1; Y < W; ++Y) {
      let D = !1,
        H = $[Y],
        G = $[Y + 1];
      if (H !== G && (Y !== 1 || H !== $[0]))
        if (!Q) {
          let K = Y * U,
            O = K - U,
            N = K + U;
          for (let F = 0; F !== U; ++F) {
            let B = J[K + F];
            if (B !== J[O + F] || B !== J[N + F]) {
              D = !0;
              break;
            }
          }
        } else D = !0;
      if (D) {
        if (Y !== X) {
          $[X] = $[Y];
          let K = Y * U,
            O = X * U;
          for (let N = 0; N !== U; ++N) J[O + N] = J[K + N];
        }
        ++X;
      }
    }
    if (W > 0) {
      $[X] = $[W];
      for (let Y = W * U, D = X * U, H = 0; H !== U; ++H) J[D + H] = J[Y + H];
      ++X;
    }
    if (X !== $.length) ((this.times = $.slice(0, X)), (this.values = J.slice(0, X * U)));
    else ((this.times = $), (this.values = J));
    return this;
  }
  clone() {
    let $ = this.times.slice(),
      J = this.values.slice(),
      Q = new this.constructor(this.name, $, J);
    return ((Q.createInterpolant = this.createInterpolant), Q);
  }
}
nJ.prototype.ValueTypeName = "";
nJ.prototype.TimeBufferType = Float32Array;
nJ.prototype.ValueBufferType = Float32Array;
nJ.prototype.DefaultInterpolation = 2301;
class i9 extends nJ {
  constructor($, J, U) {
    super($, J, U);
  }
}
i9.prototype.ValueTypeName = "bool";
i9.prototype.ValueBufferType = Array;
i9.prototype.DefaultInterpolation = 2300;
i9.prototype.InterpolantFactoryMethodLinear = void 0;
i9.prototype.InterpolantFactoryMethodSmooth = void 0;
class NE extends nJ {
  constructor($, J, U, Q) {
    super($, J, U, Q);
  }
}
NE.prototype.ValueTypeName = "color";
class OE extends nJ {
  constructor($, J, U, Q) {
    super($, J, U, Q);
  }
}
OE.prototype.ValueTypeName = "number";
class FE extends n9 {
  constructor($, J, U, Q) {
    super($, J, U, Q);
  }
  interpolate_($, J, U, Q) {
    let W = this.resultBuffer,
      X = this.sampleValues,
      Y = this.valueSize,
      D = (U - J) / (Q - J),
      H = $ * Y;
    for (let G = H + Y; H !== G; H += 4) H0.slerpFlat(W, 0, X, H - Y, X, H, D);
    return W;
  }
}
class jG extends nJ {
  constructor($, J, U, Q) {
    super($, J, U, Q);
  }
  InterpolantFactoryMethodLinear($) {
    return new FE(this.times, this.values, this.getValueSize(), $);
  }
}
jG.prototype.ValueTypeName = "quaternion";
jG.prototype.InterpolantFactoryMethodSmooth = void 0;
class o9 extends nJ {
  constructor($, J, U) {
    super($, J, U);
  }
}
o9.prototype.ValueTypeName = "string";
o9.prototype.ValueBufferType = Array;
o9.prototype.DefaultInterpolation = 2300;
o9.prototype.InterpolantFactoryMethodLinear = void 0;
o9.prototype.InterpolantFactoryMethodSmooth = void 0;
class qE extends nJ {
  constructor($, J, U, Q) {
    super($, J, U, Q);
  }
}
qE.prototype.ValueTypeName = "vector";
var DG = {
  enabled: !1,
  files: {},
  add: function ($, J) {
    if (this.enabled === !1) return;
    if (FZ($)) return;
    this.files[$] = J;
  },
  get: function ($) {
    if (this.enabled === !1) return;
    if (FZ($)) return;
    return this.files[$];
  },
  remove: function ($) {
    delete this.files[$];
  },
  clear: function () {
    this.files = {};
  },
};
function FZ($) {
  try {
    let J = $.slice($.indexOf(":") + 1);
    return new URL(J).protocol === "blob:";
  } catch (J) {
    return !1;
  }
}
class zE {
  constructor($, J, U) {
    let Q = this,
      W = !1,
      X = 0,
      Y = 0,
      D = void 0,
      H = [];
    ((this.onStart = void 0),
      (this.onLoad = $),
      (this.onProgress = J),
      (this.onError = U),
      (this._abortController = null),
      (this.itemStart = function (G) {
        if ((Y++, W === !1)) {
          if (Q.onStart !== void 0) Q.onStart(G, X, Y);
        }
        W = !0;
      }),
      (this.itemEnd = function (G) {
        if ((X++, Q.onProgress !== void 0)) Q.onProgress(G, X, Y);
        if (X === Y) {
          if (((W = !1), Q.onLoad !== void 0)) Q.onLoad();
        }
      }),
      (this.itemError = function (G) {
        if (Q.onError !== void 0) Q.onError(G);
      }),
      (this.resolveURL = function (G) {
        if (D) return D(G);
        return G;
      }),
      (this.setURLModifier = function (G) {
        return ((D = G), this);
      }),
      (this.addHandler = function (G, K) {
        return (H.push(G, K), this);
      }),
      (this.removeHandler = function (G) {
        let K = H.indexOf(G);
        if (K !== -1) H.splice(K, 2);
        return this;
      }),
      (this.getHandler = function (G) {
        for (let K = 0, O = H.length; K < O; K += 2) {
          let N = H[K],
            F = H[K + 1];
          if (N.global) N.lastIndex = 0;
          if (N.test(G)) return F;
        }
        return null;
      }),
      (this.abort = function () {
        return (this.abortController.abort(), (this._abortController = null), this);
      }));
  }
  get abortController() {
    if (!this._abortController) this._abortController = new AbortController();
    return this._abortController;
  }
}
var MP = new zE();
class LX {
  constructor($) {
    if (
      ((this.manager = $ !== void 0 ? $ : MP),
      (this.crossOrigin = "anonymous"),
      (this.withCredentials = !1),
      (this.path = ""),
      (this.resourcePath = ""),
      (this.requestHeader = {}),
      typeof __THREE_DEVTOOLS__ < "u")
    )
      __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe", { detail: this }));
  }
  load() {}
  loadAsync($, J) {
    let U = this;
    return new Promise(function (Q, W) {
      U.load($, Q, J, W);
    });
  }
  parse() {}
  setCrossOrigin($) {
    return ((this.crossOrigin = $), this);
  }
  setWithCredentials($) {
    return ((this.withCredentials = $), this);
  }
  setPath($) {
    return ((this.path = $), this);
  }
  setResourcePath($) {
    return ((this.resourcePath = $), this);
  }
  setRequestHeader($) {
    return ((this.requestHeader = $), this);
  }
  abort() {
    return this;
  }
}
LX.DEFAULT_MATERIAL_NAME = "__DEFAULT";
var C1 = new WeakMap();
class BE extends LX {
  constructor($) {
    super($);
  }
  load($, J, U, Q) {
    if (this.path !== void 0) $ = this.path + $;
    $ = this.manager.resolveURL($);
    let W = this,
      X = DG.get(`image:${$}`);
    if (X !== void 0) {
      if (X.complete === !0)
        (W.manager.itemStart($),
          setTimeout(function () {
            if (J) J(X);
            W.manager.itemEnd($);
          }, 0));
      else {
        let K = C1.get(X);
        if (K === void 0) ((K = []), C1.set(X, K));
        K.push({ onLoad: J, onError: Q });
      }
      return X;
    }
    let Y = b1("img");
    function D() {
      if ((G(), J)) J(this);
      let K = C1.get(this) || [];
      for (let O = 0; O < K.length; O++) {
        let N = K[O];
        if (N.onLoad) N.onLoad(this);
      }
      (C1.delete(this), W.manager.itemEnd($));
    }
    function H(K) {
      if ((G(), Q)) Q(K);
      DG.remove(`image:${$}`);
      let O = C1.get(this) || [];
      for (let N = 0; N < O.length; N++) {
        let F = O[N];
        if (F.onError) F.onError(K);
      }
      (C1.delete(this), W.manager.itemError($), W.manager.itemEnd($));
    }
    function G() {
      (Y.removeEventListener("load", D, !1), Y.removeEventListener("error", H, !1));
    }
    if ((Y.addEventListener("load", D, !1), Y.addEventListener("error", H, !1), $.slice(0, 5) !== "data:")) {
      if (this.crossOrigin !== void 0) Y.crossOrigin = this.crossOrigin;
    }
    return (DG.add(`image:${$}`, Y), W.manager.itemStart($), (Y.src = $), Y);
  }
}
class vG extends LX {
  constructor($) {
    super($);
  }
  load($, J, U, Q) {
    let W = new j0(),
      X = new BE(this.manager);
    return (
      X.setCrossOrigin(this.crossOrigin),
      X.setPath(this.path),
      X.load(
        $,
        function (Y) {
          if (((W.image = Y), (W.needsUpdate = !0), J !== void 0)) J(W);
        },
        U,
        Q,
      ),
      W
    );
  }
}
class bG extends F0 {
  constructor($, J = 1) {
    super();
    ((this.isLight = !0), (this.type = "Light"), (this.color = new W6($)), (this.intensity = J));
  }
  dispose() {
    this.dispatchEvent({ type: "dispose" });
  }
  copy($, J) {
    return (super.copy($, J), this.color.copy($.color), (this.intensity = $.intensity), this);
  }
  toJSON($) {
    let J = super.toJSON($);
    return ((J.object.color = this.color.getHex()), (J.object.intensity = this.intensity), J);
  }
}
var oz = new x6(),
  qZ = new C(),
  zZ = new C();
class RP {
  constructor($) {
    ((this.camera = $),
      (this.intensity = 1),
      (this.bias = 0),
      (this.biasNode = null),
      (this.normalBias = 0),
      (this.radius = 1),
      (this.blurSamples = 8),
      (this.mapSize = new d$(512, 512)),
      (this.mapType = 1009),
      (this.map = null),
      (this.mapPass = null),
      (this.matrix = new x6()),
      (this.autoUpdate = !0),
      (this.needsUpdate = !1),
      (this._frustum = new d9()),
      (this._frameExtents = new d$(1, 1)),
      (this._viewportCount = 1),
      (this._viewports = [new q0(0, 0, 1, 1)]));
  }
  getViewportCount() {
    return this._viewportCount;
  }
  getFrustum() {
    return this._frustum;
  }
  updateMatrices($) {
    let J = this.camera,
      U = this.matrix;
    if (
      (qZ.setFromMatrixPosition($.matrixWorld),
      J.position.copy(qZ),
      zZ.setFromMatrixPosition($.target.matrixWorld),
      J.lookAt(zZ),
      J.updateMatrixWorld(),
      oz.multiplyMatrices(J.projectionMatrix, J.matrixWorldInverse),
      this._frustum.setFromProjectionMatrix(oz, J.coordinateSystem, J.reversedDepth),
      J.coordinateSystem === 2001 || J.reversedDepth)
    )
      U.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 1, 0, 0, 0, 0, 1);
    else U.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    U.multiply(oz);
  }
  getViewport($) {
    return this._viewports[$];
  }
  getFrameExtents() {
    return this._frameExtents;
  }
  dispose() {
    if (this.map) this.map.dispose();
    if (this.mapPass) this.mapPass.dispose();
  }
  copy($) {
    return (
      (this.camera = $.camera.clone()),
      (this.intensity = $.intensity),
      (this.bias = $.bias),
      (this.radius = $.radius),
      (this.autoUpdate = $.autoUpdate),
      (this.needsUpdate = $.needsUpdate),
      (this.normalBias = $.normalBias),
      (this.blurSamples = $.blurSamples),
      this.mapSize.copy($.mapSize),
      (this.biasNode = $.biasNode),
      this
    );
  }
  clone() {
    return new this.constructor().copy(this);
  }
  toJSON() {
    let $ = {};
    if (this.intensity !== 1) $.intensity = this.intensity;
    if (this.bias !== 0) $.bias = this.bias;
    if (this.normalBias !== 0) $.normalBias = this.normalBias;
    if (this.radius !== 1) $.radius = this.radius;
    if (this.mapSize.x !== 512 || this.mapSize.y !== 512) $.mapSize = this.mapSize.toArray();
    return (($.camera = this.camera.toJSON(!1).object), delete $.camera.matrix, $);
  }
}
var QG = new C(),
  XG = new H0(),
  CU = new C();
class wX extends F0 {
  constructor() {
    super();
    ((this.isCamera = !0),
      (this.type = "Camera"),
      (this.matrixWorldInverse = new x6()),
      (this.projectionMatrix = new x6()),
      (this.projectionMatrixInverse = new x6()),
      (this.coordinateSystem = 2000),
      (this._reversedDepth = !1));
  }
  get reversedDepth() {
    return this._reversedDepth;
  }
  copy($, J) {
    return (
      super.copy($, J),
      this.matrixWorldInverse.copy($.matrixWorldInverse),
      this.projectionMatrix.copy($.projectionMatrix),
      this.projectionMatrixInverse.copy($.projectionMatrixInverse),
      (this.coordinateSystem = $.coordinateSystem),
      this
    );
  }
  getWorldDirection($) {
    return super.getWorldDirection($).negate();
  }
  updateMatrixWorld($) {
    if ((super.updateMatrixWorld($), this.matrixWorld.decompose(QG, XG, CU), CU.x === 1 && CU.y === 1 && CU.z === 1))
      this.matrixWorldInverse.copy(this.matrixWorld).invert();
    else this.matrixWorldInverse.compose(QG, XG, CU.set(1, 1, 1)).invert();
  }
  updateWorldMatrix($, J) {
    if ((super.updateWorldMatrix($, J), this.matrixWorld.decompose(QG, XG, CU), CU.x === 1 && CU.y === 1 && CU.z === 1))
      this.matrixWorldInverse.copy(this.matrixWorld).invert();
    else this.matrixWorldInverse.compose(QG, XG, CU.set(1, 1, 1)).invert();
  }
  clone() {
    return new this.constructor().copy(this);
  }
}
var s8 = new C(),
  BZ = new d$(),
  EZ = new d$();
class r0 extends wX {
  constructor($ = 50, J = 1, U = 0.1, Q = 2000) {
    super();
    ((this.isPerspectiveCamera = !0),
      (this.type = "PerspectiveCamera"),
      (this.fov = $),
      (this.zoom = 1),
      (this.near = U),
      (this.far = Q),
      (this.focus = 10),
      (this.aspect = J),
      (this.view = null),
      (this.filmGauge = 35),
      (this.filmOffset = 0),
      this.updateProjectionMatrix());
  }
  copy($, J) {
    return (
      super.copy($, J),
      (this.fov = $.fov),
      (this.zoom = $.zoom),
      (this.near = $.near),
      (this.far = $.far),
      (this.focus = $.focus),
      (this.aspect = $.aspect),
      (this.view = $.view === null ? null : Object.assign({}, $.view)),
      (this.filmGauge = $.filmGauge),
      (this.filmOffset = $.filmOffset),
      this
    );
  }
  setFocalLength($) {
    let J = (0.5 * this.getFilmHeight()) / $;
    ((this.fov = y1 * 2 * Math.atan(J)), this.updateProjectionMatrix());
  }
  getFocalLength() {
    let $ = Math.tan(WX * 0.5 * this.fov);
    return (0.5 * this.getFilmHeight()) / $;
  }
  getEffectiveFOV() {
    return y1 * 2 * Math.atan(Math.tan(WX * 0.5 * this.fov) / this.zoom);
  }
  getFilmWidth() {
    return this.filmGauge * Math.min(this.aspect, 1);
  }
  getFilmHeight() {
    return this.filmGauge / Math.max(this.aspect, 1);
  }
  getViewBounds($, J, U) {
    (s8.set(-1, -1, 0.5).applyMatrix4(this.projectionMatrixInverse),
      J.set(s8.x, s8.y).multiplyScalar(-$ / s8.z),
      s8.set(1, 1, 0.5).applyMatrix4(this.projectionMatrixInverse),
      U.set(s8.x, s8.y).multiplyScalar(-$ / s8.z));
  }
  getViewSize($, J) {
    return (this.getViewBounds($, BZ, EZ), J.subVectors(EZ, BZ));
  }
  setViewOffset($, J, U, Q, W, X) {
    if (((this.aspect = $ / J), this.view === null))
      this.view = { enabled: !0, fullWidth: 1, fullHeight: 1, offsetX: 0, offsetY: 0, width: 1, height: 1 };
    ((this.view.enabled = !0),
      (this.view.fullWidth = $),
      (this.view.fullHeight = J),
      (this.view.offsetX = U),
      (this.view.offsetY = Q),
      (this.view.width = W),
      (this.view.height = X),
      this.updateProjectionMatrix());
  }
  clearViewOffset() {
    if (this.view !== null) this.view.enabled = !1;
    this.updateProjectionMatrix();
  }
  updateProjectionMatrix() {
    let $ = this.near,
      J = ($ * Math.tan(WX * 0.5 * this.fov)) / this.zoom,
      U = 2 * J,
      Q = this.aspect * U,
      W = -0.5 * Q,
      X = this.view;
    if (this.view !== null && this.view.enabled) {
      let { fullWidth: D, fullHeight: H } = X;
      ((W += (X.offsetX * Q) / D), (J -= (X.offsetY * U) / H), (Q *= X.width / D), (U *= X.height / H));
    }
    let Y = this.filmOffset;
    if (Y !== 0) W += ($ * Y) / this.getFilmWidth();
    (this.projectionMatrix.makePerspective(W, W + Q, J, J - U, $, this.far, this.coordinateSystem, this.reversedDepth),
      this.projectionMatrixInverse.copy(this.projectionMatrix).invert());
  }
  toJSON($) {
    let J = super.toJSON($);
    if (
      ((J.object.fov = this.fov),
      (J.object.zoom = this.zoom),
      (J.object.near = this.near),
      (J.object.far = this.far),
      (J.object.focus = this.focus),
      (J.object.aspect = this.aspect),
      this.view !== null)
    )
      J.object.view = Object.assign({}, this.view);
    return ((J.object.filmGauge = this.filmGauge), (J.object.filmOffset = this.filmOffset), J);
  }
}
class IX extends wX {
  constructor($ = -1, J = 1, U = 1, Q = -1, W = 0.1, X = 2000) {
    super();
    ((this.isOrthographicCamera = !0),
      (this.type = "OrthographicCamera"),
      (this.zoom = 1),
      (this.view = null),
      (this.left = $),
      (this.right = J),
      (this.top = U),
      (this.bottom = Q),
      (this.near = W),
      (this.far = X),
      this.updateProjectionMatrix());
  }
  copy($, J) {
    return (
      super.copy($, J),
      (this.left = $.left),
      (this.right = $.right),
      (this.top = $.top),
      (this.bottom = $.bottom),
      (this.near = $.near),
      (this.far = $.far),
      (this.zoom = $.zoom),
      (this.view = $.view === null ? null : Object.assign({}, $.view)),
      this
    );
  }
  setViewOffset($, J, U, Q, W, X) {
    if (this.view === null)
      this.view = { enabled: !0, fullWidth: 1, fullHeight: 1, offsetX: 0, offsetY: 0, width: 1, height: 1 };
    ((this.view.enabled = !0),
      (this.view.fullWidth = $),
      (this.view.fullHeight = J),
      (this.view.offsetX = U),
      (this.view.offsetY = Q),
      (this.view.width = W),
      (this.view.height = X),
      this.updateProjectionMatrix());
  }
  clearViewOffset() {
    if (this.view !== null) this.view.enabled = !1;
    this.updateProjectionMatrix();
  }
  updateProjectionMatrix() {
    let $ = (this.right - this.left) / (2 * this.zoom),
      J = (this.top - this.bottom) / (2 * this.zoom),
      U = (this.right + this.left) / 2,
      Q = (this.top + this.bottom) / 2,
      W = U - $,
      X = U + $,
      Y = Q + J,
      D = Q - J;
    if (this.view !== null && this.view.enabled) {
      let H = (this.right - this.left) / this.view.fullWidth / this.zoom,
        G = (this.top - this.bottom) / this.view.fullHeight / this.zoom;
      ((W += H * this.view.offsetX),
        (X = W + H * this.view.width),
        (Y -= G * this.view.offsetY),
        (D = Y - G * this.view.height));
    }
    (this.projectionMatrix.makeOrthographic(W, X, Y, D, this.near, this.far, this.coordinateSystem, this.reversedDepth),
      this.projectionMatrixInverse.copy(this.projectionMatrix).invert());
  }
  toJSON($) {
    let J = super.toJSON($);
    if (
      ((J.object.zoom = this.zoom),
      (J.object.left = this.left),
      (J.object.right = this.right),
      (J.object.top = this.top),
      (J.object.bottom = this.bottom),
      (J.object.near = this.near),
      (J.object.far = this.far),
      this.view !== null)
    )
      J.object.view = Object.assign({}, this.view);
    return J;
  }
}
class ZP extends RP {
  constructor() {
    super(new IX(-5, 5, 5, -5, 0.5, 500));
    this.isDirectionalLightShadow = !0;
  }
}
class fG extends bG {
  constructor($, J) {
    super($, J);
    ((this.isDirectionalLight = !0),
      (this.type = "DirectionalLight"),
      this.position.copy(F0.DEFAULT_UP),
      this.updateMatrix(),
      (this.target = new F0()),
      (this.shadow = new ZP()));
  }
  dispose() {
    (super.dispose(), this.shadow.dispose());
  }
  copy($) {
    return (super.copy($), (this.target = $.target.clone()), (this.shadow = $.shadow.clone()), this);
  }
  toJSON($) {
    let J = super.toJSON($);
    return ((J.object.shadow = this.shadow.toJSON()), (J.object.target = this.target.uuid), J);
  }
}
class yG extends bG {
  constructor($, J) {
    super($, J);
    ((this.isAmbientLight = !0), (this.type = "AmbientLight"));
  }
}
var T1 = -90,
  j1 = 1;
class EE extends F0 {
  constructor($, J, U) {
    super();
    ((this.type = "CubeCamera"), (this.renderTarget = U), (this.coordinateSystem = null), (this.activeMipmapLevel = 0));
    let Q = new r0(T1, j1, $, J);
    ((Q.layers = this.layers), this.add(Q));
    let W = new r0(T1, j1, $, J);
    ((W.layers = this.layers), this.add(W));
    let X = new r0(T1, j1, $, J);
    ((X.layers = this.layers), this.add(X));
    let Y = new r0(T1, j1, $, J);
    ((Y.layers = this.layers), this.add(Y));
    let D = new r0(T1, j1, $, J);
    ((D.layers = this.layers), this.add(D));
    let H = new r0(T1, j1, $, J);
    ((H.layers = this.layers), this.add(H));
  }
  updateCoordinateSystem() {
    let $ = this.coordinateSystem,
      J = this.children.concat(),
      [U, Q, W, X, Y, D] = J;
    for (let H of J) this.remove(H);
    if ($ === 2000)
      (U.up.set(0, 1, 0),
        U.lookAt(1, 0, 0),
        Q.up.set(0, 1, 0),
        Q.lookAt(-1, 0, 0),
        W.up.set(0, 0, -1),
        W.lookAt(0, 1, 0),
        X.up.set(0, 0, 1),
        X.lookAt(0, -1, 0),
        Y.up.set(0, 1, 0),
        Y.lookAt(0, 0, 1),
        D.up.set(0, 1, 0),
        D.lookAt(0, 0, -1));
    else if ($ === 2001)
      (U.up.set(0, -1, 0),
        U.lookAt(-1, 0, 0),
        Q.up.set(0, -1, 0),
        Q.lookAt(1, 0, 0),
        W.up.set(0, 0, 1),
        W.lookAt(0, 1, 0),
        X.up.set(0, 0, -1),
        X.lookAt(0, -1, 0),
        Y.up.set(0, -1, 0),
        Y.lookAt(0, 0, 1),
        D.up.set(0, -1, 0),
        D.lookAt(0, 0, -1));
    else throw Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: " + $);
    for (let H of J) (this.add(H), H.updateMatrixWorld());
  }
  update($, J) {
    if (this.parent === null) this.updateMatrixWorld();
    let { renderTarget: U, activeMipmapLevel: Q } = this;
    if (this.coordinateSystem !== $.coordinateSystem)
      ((this.coordinateSystem = $.coordinateSystem), this.updateCoordinateSystem());
    let [W, X, Y, D, H, G] = this.children,
      K = $.getRenderTarget(),
      O = $.getActiveCubeFace(),
      N = $.getActiveMipmapLevel(),
      F = $.xr.enabled;
    $.xr.enabled = !1;
    let B = U.texture.generateMipmaps;
    U.texture.generateMipmaps = !1;
    let E = !1;
    if ($.isWebGLRenderer === !0) E = $.state.buffers.depth.getReversed();
    else E = $.reversedDepthBuffer;
    if (($.setRenderTarget(U, 0, Q), E && $.autoClear === !1)) $.clearDepth();
    if (($.render(J, W), $.setRenderTarget(U, 1, Q), E && $.autoClear === !1)) $.clearDepth();
    if (($.render(J, X), $.setRenderTarget(U, 2, Q), E && $.autoClear === !1)) $.clearDepth();
    if (($.render(J, Y), $.setRenderTarget(U, 3, Q), E && $.autoClear === !1)) $.clearDepth();
    if (($.render(J, D), $.setRenderTarget(U, 4, Q), E && $.autoClear === !1)) $.clearDepth();
    if (($.render(J, H), (U.texture.generateMipmaps = B), $.setRenderTarget(U, 5, Q), E && $.autoClear === !1))
      $.clearDepth();
    ($.render(J, G), $.setRenderTarget(K, O, N), ($.xr.enabled = F), (U.texture.needsPMREMUpdate = !0));
  }
}
class LE extends r0 {
  constructor($ = []) {
    super();
    ((this.isArrayCamera = !0), (this.isMultiViewCamera = !1), (this.cameras = $));
  }
}
var wE = "\\[\\]\\.:\\/",
  bm = new RegExp("[" + wE + "]", "g"),
  IE = "[^" + wE + "]",
  fm = "[^" + wE.replace("\\.", "") + "]",
  ym = /((?:WC+[\/:])*)/.source.replace("WC", IE),
  xm = /(WCOD+)?/.source.replace("WCOD", fm),
  gm = /(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC", IE),
  hm = /\.(WC+)(?:\[(.+)\])?/.source.replace("WC", IE),
  um = new RegExp("^" + ym + xm + gm + hm + "$"),
  lm = ["material", "materials", "bones", "map"];
class PP {
  constructor($, J, U) {
    let Q = U || m6.parseTrackName(J);
    ((this._targetGroup = $), (this._bindings = $.subscribe_(J, Q)));
  }
  getValue($, J) {
    this.bind();
    let U = this._targetGroup.nCachedObjects_,
      Q = this._bindings[U];
    if (Q !== void 0) Q.getValue($, J);
  }
  setValue($, J) {
    let U = this._bindings;
    for (let Q = this._targetGroup.nCachedObjects_, W = U.length; Q !== W; ++Q) U[Q].setValue($, J);
  }
  bind() {
    let $ = this._bindings;
    for (let J = this._targetGroup.nCachedObjects_, U = $.length; J !== U; ++J) $[J].bind();
  }
  unbind() {
    let $ = this._bindings;
    for (let J = this._targetGroup.nCachedObjects_, U = $.length; J !== U; ++J) $[J].unbind();
  }
}
class m6 {
  constructor($, J, U) {
    ((this.path = J),
      (this.parsedPath = U || m6.parseTrackName(J)),
      (this.node = m6.findNode($, this.parsedPath.nodeName)),
      (this.rootNode = $),
      (this.getValue = this._getValue_unbound),
      (this.setValue = this._setValue_unbound));
  }
  static create($, J, U) {
    if (!($ && $.isAnimationObjectGroup)) return new m6($, J, U);
    else return new m6.Composite($, J, U);
  }
  static sanitizeNodeName($) {
    return $.replace(/\s/g, "_").replace(bm, "");
  }
  static parseTrackName($) {
    let J = um.exec($);
    if (J === null) throw Error("PropertyBinding: Cannot parse trackName: " + $);
    let U = { nodeName: J[2], objectName: J[3], objectIndex: J[4], propertyName: J[5], propertyIndex: J[6] },
      Q = U.nodeName && U.nodeName.lastIndexOf(".");
    if (Q !== void 0 && Q !== -1) {
      let W = U.nodeName.substring(Q + 1);
      if (lm.indexOf(W) !== -1) ((U.nodeName = U.nodeName.substring(0, Q)), (U.objectName = W));
    }
    if (U.propertyName === null || U.propertyName.length === 0)
      throw Error("PropertyBinding: can not parse propertyName from trackName: " + $);
    return U;
  }
  static findNode($, J) {
    if (J === void 0 || J === "" || J === "." || J === -1 || J === $.name || J === $.uuid) return $;
    if ($.skeleton) {
      let U = $.skeleton.getBoneByName(J);
      if (U !== void 0) return U;
    }
    if ($.children) {
      let U = function (W) {
          for (let X = 0; X < W.length; X++) {
            let Y = W[X];
            if (Y.name === J || Y.uuid === J) return Y;
            let D = U(Y.children);
            if (D) return D;
          }
          return null;
        },
        Q = U($.children);
      if (Q) return Q;
    }
    return null;
  }
  _getValue_unavailable() {}
  _setValue_unavailable() {}
  _getValue_direct($, J) {
    $[J] = this.targetObject[this.propertyName];
  }
  _getValue_array($, J) {
    let U = this.resolvedProperty;
    for (let Q = 0, W = U.length; Q !== W; ++Q) $[J++] = U[Q];
  }
  _getValue_arrayElement($, J) {
    $[J] = this.resolvedProperty[this.propertyIndex];
  }
  _getValue_toArray($, J) {
    this.resolvedProperty.toArray($, J);
  }
  _setValue_direct($, J) {
    this.targetObject[this.propertyName] = $[J];
  }
  _setValue_direct_setNeedsUpdate($, J) {
    ((this.targetObject[this.propertyName] = $[J]), (this.targetObject.needsUpdate = !0));
  }
  _setValue_direct_setMatrixWorldNeedsUpdate($, J) {
    ((this.targetObject[this.propertyName] = $[J]), (this.targetObject.matrixWorldNeedsUpdate = !0));
  }
  _setValue_array($, J) {
    let U = this.resolvedProperty;
    for (let Q = 0, W = U.length; Q !== W; ++Q) U[Q] = $[J++];
  }
  _setValue_array_setNeedsUpdate($, J) {
    let U = this.resolvedProperty;
    for (let Q = 0, W = U.length; Q !== W; ++Q) U[Q] = $[J++];
    this.targetObject.needsUpdate = !0;
  }
  _setValue_array_setMatrixWorldNeedsUpdate($, J) {
    let U = this.resolvedProperty;
    for (let Q = 0, W = U.length; Q !== W; ++Q) U[Q] = $[J++];
    this.targetObject.matrixWorldNeedsUpdate = !0;
  }
  _setValue_arrayElement($, J) {
    this.resolvedProperty[this.propertyIndex] = $[J];
  }
  _setValue_arrayElement_setNeedsUpdate($, J) {
    ((this.resolvedProperty[this.propertyIndex] = $[J]), (this.targetObject.needsUpdate = !0));
  }
  _setValue_arrayElement_setMatrixWorldNeedsUpdate($, J) {
    ((this.resolvedProperty[this.propertyIndex] = $[J]), (this.targetObject.matrixWorldNeedsUpdate = !0));
  }
  _setValue_fromArray($, J) {
    this.resolvedProperty.fromArray($, J);
  }
  _setValue_fromArray_setNeedsUpdate($, J) {
    (this.resolvedProperty.fromArray($, J), (this.targetObject.needsUpdate = !0));
  }
  _setValue_fromArray_setMatrixWorldNeedsUpdate($, J) {
    (this.resolvedProperty.fromArray($, J), (this.targetObject.matrixWorldNeedsUpdate = !0));
  }
  _getValue_unbound($, J) {
    (this.bind(), this.getValue($, J));
  }
  _setValue_unbound($, J) {
    (this.bind(), this.setValue($, J));
  }
  bind() {
    let $ = this.node,
      J = this.parsedPath,
      U = J.objectName,
      Q = J.propertyName,
      W = J.propertyIndex;
    if (!$) (($ = m6.findNode(this.rootNode, J.nodeName)), (this.node = $));
    if (((this.getValue = this._getValue_unavailable), (this.setValue = this._setValue_unavailable), !$)) {
      i$("PropertyBinding: No target node found for track: " + this.path + ".");
      return;
    }
    if (U) {
      let H = J.objectIndex;
      switch (U) {
        case "materials":
          if (!$.material) {
            s$("PropertyBinding: Can not bind to material as node does not have a material.", this);
            return;
          }
          if (!$.material.materials) {
            s$(
              "PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",
              this,
            );
            return;
          }
          $ = $.material.materials;
          break;
        case "bones":
          if (!$.skeleton) {
            s$("PropertyBinding: Can not bind to bones as node does not have a skeleton.", this);
            return;
          }
          $ = $.skeleton.bones;
          for (let G = 0; G < $.length; G++)
            if ($[G].name === H) {
              H = G;
              break;
            }
          break;
        case "map":
          if ("map" in $) {
            $ = $.map;
            break;
          }
          if (!$.material) {
            s$("PropertyBinding: Can not bind to material as node does not have a material.", this);
            return;
          }
          if (!$.material.map) {
            s$("PropertyBinding: Can not bind to material.map as node.material does not have a map.", this);
            return;
          }
          $ = $.material.map;
          break;
        default:
          if ($[U] === void 0) {
            s$("PropertyBinding: Can not bind to objectName of node undefined.", this);
            return;
          }
          $ = $[U];
      }
      if (H !== void 0) {
        if ($[H] === void 0) {
          s$("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.", this, $);
          return;
        }
        $ = $[H];
      }
    }
    let X = $[Q];
    if (X === void 0) {
      let H = J.nodeName;
      s$("PropertyBinding: Trying to update property for track: " + H + "." + Q + " but it wasn't found.", $);
      return;
    }
    let Y = this.Versioning.None;
    if (((this.targetObject = $), $.isMaterial === !0)) Y = this.Versioning.NeedsUpdate;
    else if ($.isObject3D === !0) Y = this.Versioning.MatrixWorldNeedsUpdate;
    let D = this.BindingType.Direct;
    if (W !== void 0) {
      if (Q === "morphTargetInfluences") {
        if (!$.geometry) {
          s$("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.", this);
          return;
        }
        if (!$.geometry.morphAttributes) {
          s$(
            "PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",
            this,
          );
          return;
        }
        if ($.morphTargetDictionary[W] !== void 0) W = $.morphTargetDictionary[W];
      }
      ((D = this.BindingType.ArrayElement), (this.resolvedProperty = X), (this.propertyIndex = W));
    } else if (X.fromArray !== void 0 && X.toArray !== void 0)
      ((D = this.BindingType.HasFromToArray), (this.resolvedProperty = X));
    else if (Array.isArray(X)) ((D = this.BindingType.EntireArray), (this.resolvedProperty = X));
    else this.propertyName = Q;
    ((this.getValue = this.GetterByBindingType[D]), (this.setValue = this.SetterByBindingTypeAndVersioning[D][Y]));
  }
  unbind() {
    ((this.node = null), (this.getValue = this._getValue_unbound), (this.setValue = this._setValue_unbound));
  }
}
m6.Composite = PP;
m6.prototype.BindingType = { Direct: 0, EntireArray: 1, ArrayElement: 2, HasFromToArray: 3 };
m6.prototype.Versioning = { None: 0, NeedsUpdate: 1, MatrixWorldNeedsUpdate: 2 };
m6.prototype.GetterByBindingType = [
  m6.prototype._getValue_direct,
  m6.prototype._getValue_array,
  m6.prototype._getValue_arrayElement,
  m6.prototype._getValue_toArray,
];
m6.prototype.SetterByBindingTypeAndVersioning = [
  [
    m6.prototype._setValue_direct,
    m6.prototype._setValue_direct_setNeedsUpdate,
    m6.prototype._setValue_direct_setMatrixWorldNeedsUpdate,
  ],
  [
    m6.prototype._setValue_array,
    m6.prototype._setValue_array_setNeedsUpdate,
    m6.prototype._setValue_array_setMatrixWorldNeedsUpdate,
  ],
  [
    m6.prototype._setValue_arrayElement,
    m6.prototype._setValue_arrayElement_setNeedsUpdate,
    m6.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate,
  ],
  [
    m6.prototype._setValue_fromArray,
    m6.prototype._setValue_fromArray_setNeedsUpdate,
    m6.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate,
  ],
];
var CU$ = new Float32Array(1);
var LZ = new x6();
class c1 {
  constructor($, J, U = 0, Q = 1 / 0) {
    ((this.ray = new p9($, J)),
      (this.near = U),
      (this.far = Q),
      (this.camera = null),
      (this.layers = new FX()),
      (this.params = { Mesh: {}, Line: { threshold: 1 }, LOD: {}, Points: { threshold: 1 }, Sprite: {} }));
  }
  set($, J) {
    this.ray.set($, J);
  }
  setFromCamera($, J) {
    if (J.isPerspectiveCamera)
      (this.ray.origin.setFromMatrixPosition(J.matrixWorld),
        this.ray.direction.set($.x, $.y, 0.5).unproject(J).sub(this.ray.origin).normalize(),
        (this.camera = J));
    else if (J.isOrthographicCamera)
      (this.ray.origin.set($.x, $.y, (J.near + J.far) / (J.near - J.far)).unproject(J),
        this.ray.direction.set(0, 0, -1).transformDirection(J.matrixWorld),
        (this.camera = J));
    else s$("Raycaster: Unsupported camera type: " + J.type);
  }
  setFromXRController($) {
    return (
      LZ.identity().extractRotation($.matrixWorld),
      this.ray.origin.setFromMatrixPosition($.matrixWorld),
      this.ray.direction.set(0, 0, -1).applyMatrix4(LZ),
      this
    );
  }
  intersectObject($, J = !0, U = []) {
    return (rz($, this, U, J), U.sort(wZ), U);
  }
  intersectObjects($, J = !0, U = []) {
    for (let Q = 0, W = $.length; Q < W; Q++) rz($[Q], this, U, J);
    return (U.sort(wZ), U);
  }
}
function wZ($, J) {
  return $.distance - J.distance;
}
function rz($, J, U, Q) {
  let W = !0;
  if ($.layers.test(J.layers)) {
    if ($.raycast(J, U) === !1) W = !1;
  }
  if (W === !0 && Q === !0) {
    let X = $.children;
    for (let Y = 0, D = X.length; Y < D; Y++) rz(X[Y], J, U, !0);
  }
}
class VX {
  constructor($ = 1, J = 0, U = 0) {
    ((this.radius = $), (this.phi = J), (this.theta = U));
  }
  set($, J, U) {
    return ((this.radius = $), (this.phi = J), (this.theta = U), this);
  }
  copy($) {
    return ((this.radius = $.radius), (this.phi = $.phi), (this.theta = $.theta), this);
  }
  makeSafe() {
    return ((this.phi = V6(this.phi, 0.000001, Math.PI - 0.000001)), this);
  }
  setFromVector3($) {
    return this.setFromCartesianCoords($.x, $.y, $.z);
  }
  setFromCartesianCoords($, J, U) {
    if (((this.radius = Math.sqrt($ * $ + J * J + U * U)), this.radius === 0)) ((this.theta = 0), (this.phi = 0));
    else ((this.theta = Math.atan2($, U)), (this.phi = Math.acos(V6(J / this.radius, -1, 1))));
    return this;
  }
  clone() {
    return new this.constructor().copy(this);
  }
}
class VE {
  static {
    VE.prototype.isMatrix2 = !0;
  }
  constructor($, J, U, Q) {
    if (((this.elements = [1, 0, 0, 1]), $ !== void 0)) this.set($, J, U, Q);
  }
  identity() {
    return (this.set(1, 0, 0, 1), this);
  }
  fromArray($, J = 0) {
    for (let U = 0; U < 4; U++) this.elements[U] = $[U + J];
    return this;
  }
  set($, J, U, Q) {
    let W = this.elements;
    return ((W[0] = $), (W[2] = J), (W[1] = U), (W[3] = Q), this);
  }
}
class xG extends PG {
  constructor($ = 10, J = 10, U = 4473924, Q = 8947848) {
    ((U = new W6(U)), (Q = new W6(Q)));
    let W = J / 2,
      X = $ / J,
      Y = $ / 2,
      D = [],
      H = [];
    for (let O = 0, N = 0, F = -Y; O <= J; O++, F += X) {
      (D.push(-Y, 0, F, Y, 0, F), D.push(F, 0, -Y, F, 0, Y));
      let B = O === W ? U : Q;
      (B.toArray(H, N), (N += 3), B.toArray(H, N), (N += 3), B.toArray(H, N), (N += 3), B.toArray(H, N), (N += 3));
    }
    let G = new Q0();
    (G.setAttribute("position", new S6(D, 3)), G.setAttribute("color", new S6(H, 3)));
    let K = new fU({ vertexColors: !0, toneMapped: !1 });
    super(G, K);
    this.type = "GridHelper";
  }
  dispose() {
    (this.geometry.dispose(), this.material.dispose());
  }
}
var YG = new C(),
  L0 = new wX();
class gG extends PG {
  constructor($) {
    let J = new Q0(),
      U = new fU({ color: 16777215, vertexColors: !0, toneMapped: !1 }),
      Q = [],
      W = [],
      X = {};
    (Y("n1", "n2"),
      Y("n2", "n4"),
      Y("n4", "n3"),
      Y("n3", "n1"),
      Y("f1", "f2"),
      Y("f2", "f4"),
      Y("f4", "f3"),
      Y("f3", "f1"),
      Y("n1", "f1"),
      Y("n2", "f2"),
      Y("n3", "f3"),
      Y("n4", "f4"),
      Y("p", "n1"),
      Y("p", "n2"),
      Y("p", "n3"),
      Y("p", "n4"),
      Y("u1", "u2"),
      Y("u2", "u3"),
      Y("u3", "u1"),
      Y("c", "t"),
      Y("p", "c"),
      Y("cn1", "cn2"),
      Y("cn3", "cn4"),
      Y("cf1", "cf2"),
      Y("cf3", "cf4"));
    function Y(F, B) {
      (D(F), D(B));
    }
    function D(F) {
      if ((Q.push(0, 0, 0), W.push(0, 0, 0), X[F] === void 0)) X[F] = [];
      X[F].push(Q.length / 3 - 1);
    }
    (J.setAttribute("position", new S6(Q, 3)), J.setAttribute("color", new S6(W, 3)));
    super(J, U);
    if (((this.type = "CameraHelper"), (this.camera = $), this.camera.updateProjectionMatrix))
      this.camera.updateProjectionMatrix();
    ((this.matrix = $.matrixWorld), (this.matrixAutoUpdate = !1), (this.pointMap = X), this.update());
    let H = new W6(16755200),
      G = new W6(16711680),
      K = new W6(43775),
      O = new W6(16777215),
      N = new W6(3355443);
    this.setColors(H, G, K, O, N);
  }
  setColors($, J, U, Q, W) {
    let Y = this.geometry.getAttribute("color");
    return (
      Y.setXYZ(0, $.r, $.g, $.b),
      Y.setXYZ(1, $.r, $.g, $.b),
      Y.setXYZ(2, $.r, $.g, $.b),
      Y.setXYZ(3, $.r, $.g, $.b),
      Y.setXYZ(4, $.r, $.g, $.b),
      Y.setXYZ(5, $.r, $.g, $.b),
      Y.setXYZ(6, $.r, $.g, $.b),
      Y.setXYZ(7, $.r, $.g, $.b),
      Y.setXYZ(8, $.r, $.g, $.b),
      Y.setXYZ(9, $.r, $.g, $.b),
      Y.setXYZ(10, $.r, $.g, $.b),
      Y.setXYZ(11, $.r, $.g, $.b),
      Y.setXYZ(12, $.r, $.g, $.b),
      Y.setXYZ(13, $.r, $.g, $.b),
      Y.setXYZ(14, $.r, $.g, $.b),
      Y.setXYZ(15, $.r, $.g, $.b),
      Y.setXYZ(16, $.r, $.g, $.b),
      Y.setXYZ(17, $.r, $.g, $.b),
      Y.setXYZ(18, $.r, $.g, $.b),
      Y.setXYZ(19, $.r, $.g, $.b),
      Y.setXYZ(20, $.r, $.g, $.b),
      Y.setXYZ(21, $.r, $.g, $.b),
      Y.setXYZ(22, $.r, $.g, $.b),
      Y.setXYZ(23, $.r, $.g, $.b),
      Y.setXYZ(24, J.r, J.g, J.b),
      Y.setXYZ(25, J.r, J.g, J.b),
      Y.setXYZ(26, J.r, J.g, J.b),
      Y.setXYZ(27, J.r, J.g, J.b),
      Y.setXYZ(28, J.r, J.g, J.b),
      Y.setXYZ(29, J.r, J.g, J.b),
      Y.setXYZ(30, J.r, J.g, J.b),
      Y.setXYZ(31, J.r, J.g, J.b),
      Y.setXYZ(32, U.r, U.g, U.b),
      Y.setXYZ(33, U.r, U.g, U.b),
      Y.setXYZ(34, U.r, U.g, U.b),
      Y.setXYZ(35, U.r, U.g, U.b),
      Y.setXYZ(36, U.r, U.g, U.b),
      Y.setXYZ(37, U.r, U.g, U.b),
      Y.setXYZ(38, Q.r, Q.g, Q.b),
      Y.setXYZ(39, Q.r, Q.g, Q.b),
      Y.setXYZ(40, W.r, W.g, W.b),
      Y.setXYZ(41, W.r, W.g, W.b),
      Y.setXYZ(42, W.r, W.g, W.b),
      Y.setXYZ(43, W.r, W.g, W.b),
      Y.setXYZ(44, W.r, W.g, W.b),
      Y.setXYZ(45, W.r, W.g, W.b),
      Y.setXYZ(46, W.r, W.g, W.b),
      Y.setXYZ(47, W.r, W.g, W.b),
      Y.setXYZ(48, W.r, W.g, W.b),
      Y.setXYZ(49, W.r, W.g, W.b),
      (Y.needsUpdate = !0),
      this
    );
  }
  update() {
    let $ = this.geometry,
      J = this.pointMap,
      U = 1,
      Q = 1,
      W,
      X;
    if ((L0.projectionMatrixInverse.copy(this.camera.projectionMatrixInverse), this.camera.reversedDepth === !0))
      ((W = 1), (X = 0));
    else if (this.camera.coordinateSystem === 2000) ((W = -1), (X = 1));
    else if (this.camera.coordinateSystem === 2001) ((W = 0), (X = 1));
    else throw Error("THREE.CameraHelper.update(): Invalid coordinate system: " + this.camera.coordinateSystem);
    (A0("c", J, $, L0, 0, 0, W),
      A0("t", J, $, L0, 0, 0, X),
      A0("n1", J, $, L0, -1, -1, W),
      A0("n2", J, $, L0, 1, -1, W),
      A0("n3", J, $, L0, -1, 1, W),
      A0("n4", J, $, L0, 1, 1, W),
      A0("f1", J, $, L0, -1, -1, X),
      A0("f2", J, $, L0, 1, -1, X),
      A0("f3", J, $, L0, -1, 1, X),
      A0("f4", J, $, L0, 1, 1, X),
      A0("u1", J, $, L0, 0.7, 1.1, W),
      A0("u2", J, $, L0, -0.7, 1.1, W),
      A0("u3", J, $, L0, 0, 2, W),
      A0("cf1", J, $, L0, -1, 0, X),
      A0("cf2", J, $, L0, 1, 0, X),
      A0("cf3", J, $, L0, 0, -1, X),
      A0("cf4", J, $, L0, 0, 1, X),
      A0("cn1", J, $, L0, -1, 0, W),
      A0("cn2", J, $, L0, 1, 0, W),
      A0("cn3", J, $, L0, 0, -1, W),
      A0("cn4", J, $, L0, 0, 1, W),
      ($.getAttribute("position").needsUpdate = !0));
  }
  dispose() {
    (this.geometry.dispose(), this.material.dispose());
  }
}
function A0($, J, U, Q, W, X, Y) {
  YG.set(W, X, Y).unproject(Q);
  let D = J[$];
  if (D !== void 0) {
    let H = U.getAttribute("position");
    for (let G = 0, K = D.length; G < K; G++) H.setXYZ(D[G], YG.x, YG.y, YG.z);
  }
}
class n1 extends vU {
  constructor($, J = null) {
    super();
    ((this.object = $),
      (this.domElement = J),
      (this.enabled = !0),
      (this.state = -1),
      (this.keys = {}),
      (this.mouseButtons = { LEFT: null, MIDDLE: null, RIGHT: null }),
      (this.touches = { ONE: null, TWO: null }));
  }
  connect($) {
    if ($ === void 0) {
      i$("Controls: connect() now requires an element.");
      return;
    }
    if (this.domElement !== null) this.disconnect();
    this.domElement = $;
  }
  disconnect() {}
  dispose() {}
  update() {}
}
function kE($, J, U, Q) {
  let W = mm(Q);
  switch (U) {
    case 1021:
      return $ * J;
    case 1028:
      return (($ * J) / W.components) * W.byteLength;
    case 1029:
      return (($ * J) / W.components) * W.byteLength;
    case 1030:
      return (($ * J * 2) / W.components) * W.byteLength;
    case 1031:
      return (($ * J * 2) / W.components) * W.byteLength;
    case 1022:
      return (($ * J * 3) / W.components) * W.byteLength;
    case 1023:
      return (($ * J * 4) / W.components) * W.byteLength;
    case 1033:
      return (($ * J * 4) / W.components) * W.byteLength;
    case 33776:
    case 33777:
      return Math.floor(($ + 3) / 4) * Math.floor((J + 3) / 4) * 8;
    case 33778:
    case 33779:
      return Math.floor(($ + 3) / 4) * Math.floor((J + 3) / 4) * 16;
    case 35841:
    case 35843:
      return (Math.max($, 16) * Math.max(J, 8)) / 4;
    case 35840:
    case 35842:
      return (Math.max($, 8) * Math.max(J, 8)) / 2;
    case 36196:
    case 37492:
    case 37488:
    case 37489:
      return Math.floor(($ + 3) / 4) * Math.floor((J + 3) / 4) * 8;
    case 37496:
    case 37490:
    case 37491:
      return Math.floor(($ + 3) / 4) * Math.floor((J + 3) / 4) * 16;
    case 37808:
      return Math.floor(($ + 3) / 4) * Math.floor((J + 3) / 4) * 16;
    case 37809:
      return Math.floor(($ + 4) / 5) * Math.floor((J + 3) / 4) * 16;
    case 37810:
      return Math.floor(($ + 4) / 5) * Math.floor((J + 4) / 5) * 16;
    case 37811:
      return Math.floor(($ + 5) / 6) * Math.floor((J + 4) / 5) * 16;
    case 37812:
      return Math.floor(($ + 5) / 6) * Math.floor((J + 5) / 6) * 16;
    case 37813:
      return Math.floor(($ + 7) / 8) * Math.floor((J + 4) / 5) * 16;
    case 37814:
      return Math.floor(($ + 7) / 8) * Math.floor((J + 5) / 6) * 16;
    case 37815:
      return Math.floor(($ + 7) / 8) * Math.floor((J + 7) / 8) * 16;
    case 37816:
      return Math.floor(($ + 9) / 10) * Math.floor((J + 4) / 5) * 16;
    case 37817:
      return Math.floor(($ + 9) / 10) * Math.floor((J + 5) / 6) * 16;
    case 37818:
      return Math.floor(($ + 9) / 10) * Math.floor((J + 7) / 8) * 16;
    case 37819:
      return Math.floor(($ + 9) / 10) * Math.floor((J + 9) / 10) * 16;
    case 37820:
      return Math.floor(($ + 11) / 12) * Math.floor((J + 9) / 10) * 16;
    case 37821:
      return Math.floor(($ + 11) / 12) * Math.floor((J + 11) / 12) * 16;
    case 36492:
    case 36494:
    case 36495:
      return Math.ceil($ / 4) * Math.ceil(J / 4) * 16;
    case 36283:
    case 36284:
      return Math.ceil($ / 4) * Math.ceil(J / 4) * 8;
    case 36285:
    case 36286:
      return Math.ceil($ / 4) * Math.ceil(J / 4) * 16;
  }
  throw Error(`Unable to determine texture byte length for ${U} format.`);
}
function mm($) {
  switch ($) {
    case 1009:
    case 1010:
      return { byteLength: 1, components: 1 };
    case 1012:
    case 1011:
    case 1016:
      return { byteLength: 2, components: 1 };
    case 1017:
    case 1018:
      return { byteLength: 2, components: 4 };
    case 1014:
    case 1013:
    case 1015:
      return { byteLength: 4, components: 1 };
    case 35902:
    case 35899:
      return { byteLength: 4, components: 3 };
  }
  throw Error(`Unknown texture type ${$}.`);
}
if (typeof __THREE_DEVTOOLS__ < "u")
  __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register", { detail: { revision: "184" } }));
if (typeof window < "u")
  if (window.__THREE__) i$("WARNING: Multiple instances of Three.js being imported.");
  else window.__THREE__ = "184";
function sP() {
  let $ = null,
    J = !1,
    U = null,
    Q = null;
  function W(X, Y) {
    (U(X, Y), (Q = $.requestAnimationFrame(W)));
  }
  return {
    start: function () {
      if (J === !0) return;
      if (U === null) return;
      if ($ === null) return;
      ((Q = $.requestAnimationFrame(W)), (J = !0));
    },
    stop: function () {
      if ($ !== null) $.cancelAnimationFrame(Q);
      J = !1;
    },
    setAnimationLoop: function (X) {
      U = X;
    },
    setContext: function (X) {
      $ = X;
    },
  };
}
function pm($) {
  let J = new WeakMap();
  function U(D, H) {
    let { array: G, usage: K } = D,
      O = G.byteLength,
      N = $.createBuffer();
    ($.bindBuffer(H, N), $.bufferData(H, G, K), D.onUploadCallback());
    let F;
    if (G instanceof Float32Array) F = $.FLOAT;
    else if (typeof Float16Array < "u" && G instanceof Float16Array) F = $.HALF_FLOAT;
    else if (G instanceof Uint16Array)
      if (D.isFloat16BufferAttribute) F = $.HALF_FLOAT;
      else F = $.UNSIGNED_SHORT;
    else if (G instanceof Int16Array) F = $.SHORT;
    else if (G instanceof Uint32Array) F = $.UNSIGNED_INT;
    else if (G instanceof Int32Array) F = $.INT;
    else if (G instanceof Int8Array) F = $.BYTE;
    else if (G instanceof Uint8Array) F = $.UNSIGNED_BYTE;
    else if (G instanceof Uint8ClampedArray) F = $.UNSIGNED_BYTE;
    else throw Error("THREE.WebGLAttributes: Unsupported buffer data format: " + G);
    return { buffer: N, type: F, bytesPerElement: G.BYTES_PER_ELEMENT, version: D.version, size: O };
  }
  function Q(D, H, G) {
    let { array: K, updateRanges: O } = H;
    if (($.bindBuffer(G, D), O.length === 0)) $.bufferSubData(G, 0, K);
    else {
      O.sort((F, B) => F.start - B.start);
      let N = 0;
      for (let F = 1; F < O.length; F++) {
        let B = O[N],
          E = O[F];
        if (E.start <= B.start + B.count + 1) B.count = Math.max(B.count, E.start + E.count - B.start);
        else (++N, (O[N] = E));
      }
      O.length = N + 1;
      for (let F = 0, B = O.length; F < B; F++) {
        let E = O[F];
        $.bufferSubData(G, E.start * K.BYTES_PER_ELEMENT, K, E.start, E.count);
      }
      H.clearUpdateRanges();
    }
    H.onUploadCallback();
  }
  function W(D) {
    if (D.isInterleavedBufferAttribute) D = D.data;
    return J.get(D);
  }
  function X(D) {
    if (D.isInterleavedBufferAttribute) D = D.data;
    let H = J.get(D);
    if (H) ($.deleteBuffer(H.buffer), J.delete(D));
  }
  function Y(D, H) {
    if (D.isInterleavedBufferAttribute) D = D.data;
    if (D.isGLBufferAttribute) {
      let K = J.get(D);
      if (!K || K.version < D.version)
        J.set(D, { buffer: D.buffer, type: D.type, bytesPerElement: D.elementSize, version: D.version });
      return;
    }
    let G = J.get(D);
    if (G === void 0) J.set(D, U(D, H));
    else if (G.version < D.version) {
      if (G.size !== D.array.byteLength)
        throw Error(
          "THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.",
        );
      (Q(G.buffer, D, H), (G.version = D.version));
    }
  }
  return { get: W, remove: X, update: Y };
}
var dm = `#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,
  cm = `#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,
  nm = `#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,
  im = `#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,
  om = `#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,
  rm = `#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,
  sm = `#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,
  am = `#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,
  tm = `#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,
  em = `#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,
  $p = `vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,
  Jp = `vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,
  Up = `float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,
  Wp = `#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,
  Qp = `#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,
  Xp = `#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,
  Yp = `#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,
  Dp = `#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,
  Hp = `#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,
  Gp = `#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,
  Kp = `#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,
  Np = `#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,
  Op = `#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,
  Fp = `#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,
  qp = `#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,
  zp = `vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,
  Bp = `#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,
  Ep = `#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,
  Lp = `#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,
  wp = `#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,
  Ip = "gl_FragColor = linearToOutputTexel( gl_FragColor );",
  Vp = `vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,
  kp = `#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,
  Ap = `#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,
  Mp = `#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,
  Rp = `#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,
  Zp = `#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,
  Pp = `#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,
  _p = `#ifdef USE_FOG
	varying float vFogDepth;
#endif`,
  Sp = `#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,
  Cp = `#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,
  Tp = `#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,
  jp = `#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,
  vp = `LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,
  bp = `varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,
  fp = `uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,
  yp = `#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,
  xp = `ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,
  gp = `varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,
  hp = `BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,
  up = `varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,
  lp = `PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,
  mp = `uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,
  pp = `
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = inverseTransformDirection( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,
  dp = `#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,
  cp = `#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,
  np = `#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,
  ip = `#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,
  op = `#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,
  rp = `#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,
  sp = `#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,
  ap = `#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,
  tp = `#ifdef USE_MAP
	uniform sampler2D map;
#endif`,
  ep = `#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,
  $d = `#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,
  Jd = `float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,
  Ud = `#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,
  Wd = `#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,
  Qd = `#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,
  Xd = `#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,
  Yd = `#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,
  Dd = `#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,
  Hd = `float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,
  Gd = `#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,
  Kd = `#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,
  Nd = `#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,
  Od = `#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,
  Fd = `#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,
  qd = `#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,
  zd = `#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,
  Bd = `#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,
  Ed = `#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,
  Ld = `#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,
  wd = `vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,
  Id = `#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,
  Vd = `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,
  kd = `#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,
  Ad = `#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,
  Md = `float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,
  Rd = `#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,
  Zd = `#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,
  Pd = `#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,
  _d = `#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,
  Sd = `float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,
  Cd = `#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,
  Td = `#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,
  jd = `#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,
  vd = `#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,
  bd = `float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,
  fd = `#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,
  yd = `#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,
  xd = `#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,
  gd = `#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,
  hd = `#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,
  ud = `#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,
  ld = `#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,
  md = `#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,
  pd = `#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,
  dd = `varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,
  cd = `uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,
  nd = `varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,
  id = `#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,
  od = `varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,
  rd = `uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,
  sd = `#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,
  ad = `#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,
  td = `#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,
  ed = `#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,
  $c = `varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,
  Jc = `uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,
  Uc = `uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,
  Wc = `uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,
  Qc = `#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,
  Xc = `uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,
  Yc = `#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,
  Dc = `#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,
  Hc = `#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,
  Gc = `#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,
  Kc = `#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,
  Nc = `#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,
  Oc = `#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,
  Fc = `#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,
  qc = `#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,
  zc = `#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,
  Bc = `#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,
  Ec = `#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,
  Lc = `uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,
  wc = `uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,
  Ic = `#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,
  Vc = `uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,
  kc = `uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,
  Ac = `uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,
  z6 = {
    alphahash_fragment: dm,
    alphahash_pars_fragment: cm,
    alphamap_fragment: nm,
    alphamap_pars_fragment: im,
    alphatest_fragment: om,
    alphatest_pars_fragment: rm,
    aomap_fragment: sm,
    aomap_pars_fragment: am,
    batching_pars_vertex: tm,
    batching_vertex: em,
    begin_vertex: $p,
    beginnormal_vertex: Jp,
    bsdfs: Up,
    iridescence_fragment: Wp,
    bumpmap_pars_fragment: Qp,
    clipping_planes_fragment: Xp,
    clipping_planes_pars_fragment: Yp,
    clipping_planes_pars_vertex: Dp,
    clipping_planes_vertex: Hp,
    color_fragment: Gp,
    color_pars_fragment: Kp,
    color_pars_vertex: Np,
    color_vertex: Op,
    common: Fp,
    cube_uv_reflection_fragment: qp,
    defaultnormal_vertex: zp,
    displacementmap_pars_vertex: Bp,
    displacementmap_vertex: Ep,
    emissivemap_fragment: Lp,
    emissivemap_pars_fragment: wp,
    colorspace_fragment: Ip,
    colorspace_pars_fragment: Vp,
    envmap_fragment: kp,
    envmap_common_pars_fragment: Ap,
    envmap_pars_fragment: Mp,
    envmap_pars_vertex: Rp,
    envmap_physical_pars_fragment: yp,
    envmap_vertex: Zp,
    fog_vertex: Pp,
    fog_pars_vertex: _p,
    fog_fragment: Sp,
    fog_pars_fragment: Cp,
    gradientmap_pars_fragment: Tp,
    lightmap_pars_fragment: jp,
    lights_lambert_fragment: vp,
    lights_lambert_pars_fragment: bp,
    lights_pars_begin: fp,
    lights_toon_fragment: xp,
    lights_toon_pars_fragment: gp,
    lights_phong_fragment: hp,
    lights_phong_pars_fragment: up,
    lights_physical_fragment: lp,
    lights_physical_pars_fragment: mp,
    lights_fragment_begin: pp,
    lights_fragment_maps: dp,
    lights_fragment_end: cp,
    lightprobes_pars_fragment: np,
    logdepthbuf_fragment: ip,
    logdepthbuf_pars_fragment: op,
    logdepthbuf_pars_vertex: rp,
    logdepthbuf_vertex: sp,
    map_fragment: ap,
    map_pars_fragment: tp,
    map_particle_fragment: ep,
    map_particle_pars_fragment: $d,
    metalnessmap_fragment: Jd,
    metalnessmap_pars_fragment: Ud,
    morphinstance_vertex: Wd,
    morphcolor_vertex: Qd,
    morphnormal_vertex: Xd,
    morphtarget_pars_vertex: Yd,
    morphtarget_vertex: Dd,
    normal_fragment_begin: Hd,
    normal_fragment_maps: Gd,
    normal_pars_fragment: Kd,
    normal_pars_vertex: Nd,
    normal_vertex: Od,
    normalmap_pars_fragment: Fd,
    clearcoat_normal_fragment_begin: qd,
    clearcoat_normal_fragment_maps: zd,
    clearcoat_pars_fragment: Bd,
    iridescence_pars_fragment: Ed,
    opaque_fragment: Ld,
    packing: wd,
    premultiplied_alpha_fragment: Id,
    project_vertex: Vd,
    dithering_fragment: kd,
    dithering_pars_fragment: Ad,
    roughnessmap_fragment: Md,
    roughnessmap_pars_fragment: Rd,
    shadowmap_pars_fragment: Zd,
    shadowmap_pars_vertex: Pd,
    shadowmap_vertex: _d,
    shadowmask_pars_fragment: Sd,
    skinbase_vertex: Cd,
    skinning_pars_vertex: Td,
    skinning_vertex: jd,
    skinnormal_vertex: vd,
    specularmap_fragment: bd,
    specularmap_pars_fragment: fd,
    tonemapping_fragment: yd,
    tonemapping_pars_fragment: xd,
    transmission_fragment: gd,
    transmission_pars_fragment: hd,
    uv_pars_fragment: ud,
    uv_pars_vertex: ld,
    uv_vertex: md,
    worldpos_vertex: pd,
    background_vert: dd,
    background_frag: cd,
    backgroundCube_vert: nd,
    backgroundCube_frag: id,
    cube_vert: od,
    cube_frag: rd,
    depth_vert: sd,
    depth_frag: ad,
    distance_vert: td,
    distance_frag: ed,
    equirect_vert: $c,
    equirect_frag: Jc,
    linedashed_vert: Uc,
    linedashed_frag: Wc,
    meshbasic_vert: Qc,
    meshbasic_frag: Xc,
    meshlambert_vert: Yc,
    meshlambert_frag: Dc,
    meshmatcap_vert: Hc,
    meshmatcap_frag: Gc,
    meshnormal_vert: Kc,
    meshnormal_frag: Nc,
    meshphong_vert: Oc,
    meshphong_frag: Fc,
    meshphysical_vert: qc,
    meshphysical_frag: zc,
    meshtoon_vert: Bc,
    meshtoon_frag: Ec,
    points_vert: Lc,
    points_frag: wc,
    shadow_vert: Ic,
    shadow_frag: Vc,
    sprite_vert: kc,
    sprite_frag: Ac,
  },
  V$ = {
    common: {
      diffuse: { value: new W6(16777215) },
      opacity: { value: 1 },
      map: { value: null },
      mapTransform: { value: new X6() },
      alphaMap: { value: null },
      alphaMapTransform: { value: new X6() },
      alphaTest: { value: 0 },
    },
    specularmap: { specularMap: { value: null }, specularMapTransform: { value: new X6() } },
    envmap: {
      envMap: { value: null },
      envMapRotation: { value: new X6() },
      reflectivity: { value: 1 },
      ior: { value: 1.5 },
      refractionRatio: { value: 0.98 },
      dfgLUT: { value: null },
    },
    aomap: { aoMap: { value: null }, aoMapIntensity: { value: 1 }, aoMapTransform: { value: new X6() } },
    lightmap: { lightMap: { value: null }, lightMapIntensity: { value: 1 }, lightMapTransform: { value: new X6() } },
    bumpmap: { bumpMap: { value: null }, bumpMapTransform: { value: new X6() }, bumpScale: { value: 1 } },
    normalmap: {
      normalMap: { value: null },
      normalMapTransform: { value: new X6() },
      normalScale: { value: new d$(1, 1) },
    },
    displacementmap: {
      displacementMap: { value: null },
      displacementMapTransform: { value: new X6() },
      displacementScale: { value: 1 },
      displacementBias: { value: 0 },
    },
    emissivemap: { emissiveMap: { value: null }, emissiveMapTransform: { value: new X6() } },
    metalnessmap: { metalnessMap: { value: null }, metalnessMapTransform: { value: new X6() } },
    roughnessmap: { roughnessMap: { value: null }, roughnessMapTransform: { value: new X6() } },
    gradientmap: { gradientMap: { value: null } },
    fog: {
      fogDensity: { value: 0.00025 },
      fogNear: { value: 1 },
      fogFar: { value: 2000 },
      fogColor: { value: new W6(16777215) },
    },
    lights: {
      ambientLightColor: { value: [] },
      lightProbe: { value: [] },
      directionalLights: { value: [], properties: { direction: {}, color: {} } },
      directionalLightShadows: {
        value: [],
        properties: { shadowIntensity: 1, shadowBias: {}, shadowNormalBias: {}, shadowRadius: {}, shadowMapSize: {} },
      },
      directionalShadowMatrix: { value: [] },
      spotLights: {
        value: [],
        properties: { color: {}, position: {}, direction: {}, distance: {}, coneCos: {}, penumbraCos: {}, decay: {} },
      },
      spotLightShadows: {
        value: [],
        properties: { shadowIntensity: 1, shadowBias: {}, shadowNormalBias: {}, shadowRadius: {}, shadowMapSize: {} },
      },
      spotLightMap: { value: [] },
      spotLightMatrix: { value: [] },
      pointLights: { value: [], properties: { color: {}, position: {}, decay: {}, distance: {} } },
      pointLightShadows: {
        value: [],
        properties: {
          shadowIntensity: 1,
          shadowBias: {},
          shadowNormalBias: {},
          shadowRadius: {},
          shadowMapSize: {},
          shadowCameraNear: {},
          shadowCameraFar: {},
        },
      },
      pointShadowMatrix: { value: [] },
      hemisphereLights: { value: [], properties: { direction: {}, skyColor: {}, groundColor: {} } },
      rectAreaLights: { value: [], properties: { color: {}, position: {}, width: {}, height: {} } },
      ltc_1: { value: null },
      ltc_2: { value: null },
      probesSH: { value: null },
      probesMin: { value: new C() },
      probesMax: { value: new C() },
      probesResolution: { value: new C() },
    },
    points: {
      diffuse: { value: new W6(16777215) },
      opacity: { value: 1 },
      size: { value: 1 },
      scale: { value: 1 },
      map: { value: null },
      alphaMap: { value: null },
      alphaMapTransform: { value: new X6() },
      alphaTest: { value: 0 },
      uvTransform: { value: new X6() },
    },
    sprite: {
      diffuse: { value: new W6(16777215) },
      opacity: { value: 1 },
      center: { value: new d$(0.5, 0.5) },
      rotation: { value: 0 },
      map: { value: null },
      mapTransform: { value: new X6() },
      alphaMap: { value: null },
      alphaMapTransform: { value: new X6() },
      alphaTest: { value: 0 },
    },
  },
  gU = {
    basic: {
      uniforms: a0([V$.common, V$.specularmap, V$.envmap, V$.aomap, V$.lightmap, V$.fog]),
      vertexShader: z6.meshbasic_vert,
      fragmentShader: z6.meshbasic_frag,
    },
    lambert: {
      uniforms: a0([
        V$.common,
        V$.specularmap,
        V$.envmap,
        V$.aomap,
        V$.lightmap,
        V$.emissivemap,
        V$.bumpmap,
        V$.normalmap,
        V$.displacementmap,
        V$.fog,
        V$.lights,
        { emissive: { value: new W6(0) }, envMapIntensity: { value: 1 } },
      ]),
      vertexShader: z6.meshlambert_vert,
      fragmentShader: z6.meshlambert_frag,
    },
    phong: {
      uniforms: a0([
        V$.common,
        V$.specularmap,
        V$.envmap,
        V$.aomap,
        V$.lightmap,
        V$.emissivemap,
        V$.bumpmap,
        V$.normalmap,
        V$.displacementmap,
        V$.fog,
        V$.lights,
        {
          emissive: { value: new W6(0) },
          specular: { value: new W6(1118481) },
          shininess: { value: 30 },
          envMapIntensity: { value: 1 },
        },
      ]),
      vertexShader: z6.meshphong_vert,
      fragmentShader: z6.meshphong_frag,
    },
    standard: {
      uniforms: a0([
        V$.common,
        V$.envmap,
        V$.aomap,
        V$.lightmap,
        V$.emissivemap,
        V$.bumpmap,
        V$.normalmap,
        V$.displacementmap,
        V$.roughnessmap,
        V$.metalnessmap,
        V$.fog,
        V$.lights,
        {
          emissive: { value: new W6(0) },
          roughness: { value: 1 },
          metalness: { value: 0 },
          envMapIntensity: { value: 1 },
        },
      ]),
      vertexShader: z6.meshphysical_vert,
      fragmentShader: z6.meshphysical_frag,
    },
    toon: {
      uniforms: a0([
        V$.common,
        V$.aomap,
        V$.lightmap,
        V$.emissivemap,
        V$.bumpmap,
        V$.normalmap,
        V$.displacementmap,
        V$.gradientmap,
        V$.fog,
        V$.lights,
        { emissive: { value: new W6(0) } },
      ]),
      vertexShader: z6.meshtoon_vert,
      fragmentShader: z6.meshtoon_frag,
    },
    matcap: {
      uniforms: a0([V$.common, V$.bumpmap, V$.normalmap, V$.displacementmap, V$.fog, { matcap: { value: null } }]),
      vertexShader: z6.meshmatcap_vert,
      fragmentShader: z6.meshmatcap_frag,
    },
    points: { uniforms: a0([V$.points, V$.fog]), vertexShader: z6.points_vert, fragmentShader: z6.points_frag },
    dashed: {
      uniforms: a0([V$.common, V$.fog, { scale: { value: 1 }, dashSize: { value: 1 }, totalSize: { value: 2 } }]),
      vertexShader: z6.linedashed_vert,
      fragmentShader: z6.linedashed_frag,
    },
    depth: {
      uniforms: a0([V$.common, V$.displacementmap]),
      vertexShader: z6.depth_vert,
      fragmentShader: z6.depth_frag,
    },
    normal: {
      uniforms: a0([V$.common, V$.bumpmap, V$.normalmap, V$.displacementmap, { opacity: { value: 1 } }]),
      vertexShader: z6.meshnormal_vert,
      fragmentShader: z6.meshnormal_frag,
    },
    sprite: { uniforms: a0([V$.sprite, V$.fog]), vertexShader: z6.sprite_vert, fragmentShader: z6.sprite_frag },
    background: {
      uniforms: { uvTransform: { value: new X6() }, t2D: { value: null }, backgroundIntensity: { value: 1 } },
      vertexShader: z6.background_vert,
      fragmentShader: z6.background_frag,
    },
    backgroundCube: {
      uniforms: {
        envMap: { value: null },
        backgroundBlurriness: { value: 0 },
        backgroundIntensity: { value: 1 },
        backgroundRotation: { value: new X6() },
      },
      vertexShader: z6.backgroundCube_vert,
      fragmentShader: z6.backgroundCube_frag,
    },
    cube: {
      uniforms: { tCube: { value: null }, tFlip: { value: -1 }, opacity: { value: 1 } },
      vertexShader: z6.cube_vert,
      fragmentShader: z6.cube_frag,
    },
    equirect: {
      uniforms: { tEquirect: { value: null } },
      vertexShader: z6.equirect_vert,
      fragmentShader: z6.equirect_frag,
    },
    distance: {
      uniforms: a0([
        V$.common,
        V$.displacementmap,
        { referencePosition: { value: new C() }, nearDistance: { value: 1 }, farDistance: { value: 1000 } },
      ]),
      vertexShader: z6.distance_vert,
      fragmentShader: z6.distance_frag,
    },
    shadow: {
      uniforms: a0([V$.lights, V$.fog, { color: { value: new W6(0) }, opacity: { value: 1 } }]),
      vertexShader: z6.shadow_vert,
      fragmentShader: z6.shadow_frag,
    },
  };
gU.physical = {
  uniforms: a0([
    gU.standard.uniforms,
    {
      clearcoat: { value: 0 },
      clearcoatMap: { value: null },
      clearcoatMapTransform: { value: new X6() },
      clearcoatNormalMap: { value: null },
      clearcoatNormalMapTransform: { value: new X6() },
      clearcoatNormalScale: { value: new d$(1, 1) },
      clearcoatRoughness: { value: 0 },
      clearcoatRoughnessMap: { value: null },
      clearcoatRoughnessMapTransform: { value: new X6() },
      dispersion: { value: 0 },
      iridescence: { value: 0 },
      iridescenceMap: { value: null },
      iridescenceMapTransform: { value: new X6() },
      iridescenceIOR: { value: 1.3 },
      iridescenceThicknessMinimum: { value: 100 },
      iridescenceThicknessMaximum: { value: 400 },
      iridescenceThicknessMap: { value: null },
      iridescenceThicknessMapTransform: { value: new X6() },
      sheen: { value: 0 },
      sheenColor: { value: new W6(0) },
      sheenColorMap: { value: null },
      sheenColorMapTransform: { value: new X6() },
      sheenRoughness: { value: 1 },
      sheenRoughnessMap: { value: null },
      sheenRoughnessMapTransform: { value: new X6() },
      transmission: { value: 0 },
      transmissionMap: { value: null },
      transmissionMapTransform: { value: new X6() },
      transmissionSamplerSize: { value: new d$() },
      transmissionSamplerMap: { value: null },
      thickness: { value: 0 },
      thicknessMap: { value: null },
      thicknessMapTransform: { value: new X6() },
      attenuationDistance: { value: 0 },
      attenuationColor: { value: new W6(0) },
      specularColor: { value: new W6(1, 1, 1) },
      specularColorMap: { value: null },
      specularColorMapTransform: { value: new X6() },
      specularIntensity: { value: 1 },
      specularIntensityMap: { value: null },
      specularIntensityMapTransform: { value: new X6() },
      anisotropyVector: { value: new d$() },
      anisotropyMap: { value: null },
      anisotropyMapTransform: { value: new X6() },
    },
  ]),
  vertexShader: z6.meshphysical_vert,
  fragmentShader: z6.meshphysical_frag,
};
var hG = { r: 0, b: 0, g: 0 },
  Mc = new x6(),
  aP = new X6();
aP.set(-1, 0, 0, 0, 1, 0, 0, 0, 1);
function Rc($, J, U, Q, W, X) {
  let Y = new W6(0),
    D = W === !0 ? 0 : 1,
    H,
    G,
    K = null,
    O = 0,
    N = null;
  function F(L) {
    let V = L.isScene === !0 ? L.background : null;
    if (V && V.isTexture) {
      let k = L.backgroundBlurriness > 0;
      V = J.get(V, k);
    }
    return V;
  }
  function B(L) {
    let V = !1,
      k = F(L);
    if (k === null) z(Y, D);
    else if (k && k.isColor) (z(k, 1), (V = !0));
    let R = $.xr.getEnvironmentBlendMode();
    if (R === "additive") U.buffers.color.setClear(0, 0, 0, 1, X);
    else if (R === "alpha-blend") U.buffers.color.setClear(0, 0, 0, 0, X);
    if ($.autoClear || V)
      (U.buffers.depth.setTest(!0),
        U.buffers.depth.setMask(!0),
        U.buffers.color.setMask(!0),
        $.clear($.autoClearColor, $.autoClearDepth, $.autoClearStencil));
  }
  function E(L, V) {
    let k = F(V);
    if (k && (k.isCubeTexture || k.mapping === GX)) {
      if (G === void 0)
        ((G = new X$(
          new p6(1, 1, 1),
          new dJ({
            name: "BackgroundCubeMaterial",
            uniforms: c9(gU.backgroundCube.uniforms),
            vertexShader: gU.backgroundCube.vertexShader,
            fragmentShader: gU.backgroundCube.fragmentShader,
            side: kJ,
            depthTest: !1,
            depthWrite: !1,
            fog: !1,
            allowOverride: !1,
          }),
        )),
          G.geometry.deleteAttribute("normal"),
          G.geometry.deleteAttribute("uv"),
          (G.onBeforeRender = function (R, _, S) {
            this.matrixWorld.copyPosition(S.matrixWorld);
          }),
          Object.defineProperty(G.material, "envMap", {
            get: function () {
              return this.uniforms.envMap.value;
            },
          }),
          Q.update(G));
      if (
        ((G.material.uniforms.envMap.value = k),
        (G.material.uniforms.backgroundBlurriness.value = V.backgroundBlurriness),
        (G.material.uniforms.backgroundIntensity.value = V.backgroundIntensity),
        G.material.uniforms.backgroundRotation.value
          .setFromMatrix4(Mc.makeRotationFromEuler(V.backgroundRotation))
          .transpose(),
        k.isCubeTexture && k.isRenderTargetTexture === !1)
      )
        G.material.uniforms.backgroundRotation.value.premultiply(aP);
      if (
        ((G.material.toneMapped = R6.getTransfer(k.colorSpace) !== W0),
        K !== k || O !== k.version || N !== $.toneMapping)
      )
        ((G.material.needsUpdate = !0), (K = k), (O = k.version), (N = $.toneMapping));
      (G.layers.enableAll(), L.unshift(G, G.geometry, G.material, 0, 0, null));
    } else if (k && k.isTexture) {
      if (H === void 0)
        ((H = new X$(
          new yU(2, 2),
          new dJ({
            name: "BackgroundMaterial",
            uniforms: c9(gU.background.uniforms),
            vertexShader: gU.background.vertexShader,
            fragmentShader: gU.background.fragmentShader,
            side: g1,
            depthTest: !1,
            depthWrite: !1,
            fog: !1,
            allowOverride: !1,
          }),
        )),
          H.geometry.deleteAttribute("normal"),
          Object.defineProperty(H.material, "map", {
            get: function () {
              return this.uniforms.t2D.value;
            },
          }),
          Q.update(H));
      if (
        ((H.material.uniforms.t2D.value = k),
        (H.material.uniforms.backgroundIntensity.value = V.backgroundIntensity),
        (H.material.toneMapped = R6.getTransfer(k.colorSpace) !== W0),
        k.matrixAutoUpdate === !0)
      )
        k.updateMatrix();
      if ((H.material.uniforms.uvTransform.value.copy(k.matrix), K !== k || O !== k.version || N !== $.toneMapping))
        ((H.material.needsUpdate = !0), (K = k), (O = k.version), (N = $.toneMapping));
      (H.layers.enableAll(), L.unshift(H, H.geometry, H.material, 0, 0, null));
    }
  }
  function z(L, V) {
    (L.getRGB(hG, WE($)), U.buffers.color.setClear(hG.r, hG.g, hG.b, V, X));
  }
  function q() {
    if (G !== void 0) (G.geometry.dispose(), G.material.dispose(), (G = void 0));
    if (H !== void 0) (H.geometry.dispose(), H.material.dispose(), (H = void 0));
  }
  return {
    getClearColor: function () {
      return Y;
    },
    setClearColor: function (L, V = 1) {
      (Y.set(L), (D = V), z(Y, D));
    },
    getClearAlpha: function () {
      return D;
    },
    setClearAlpha: function (L) {
      ((D = L), z(Y, D));
    },
    render: B,
    addToRenderList: E,
    dispose: q,
  };
}
function Zc($, J) {
  let U = $.getParameter($.MAX_VERTEX_ATTRIBS),
    Q = {},
    W = N(null),
    X = W,
    Y = !1;
  function D(P, u, n, b, i) {
    let x = !1,
      l = O(P, b, n, u);
    if (X !== l) ((X = l), G(X.object));
    if (((x = F(P, b, n, i)), x)) B(P, b, n, i);
    if (i !== null) J.update(i, $.ELEMENT_ARRAY_BUFFER);
    if (x || Y) {
      if (((Y = !1), k(P, u, n, b), i !== null)) $.bindBuffer($.ELEMENT_ARRAY_BUFFER, J.get(i).buffer);
    }
  }
  function H() {
    return $.createVertexArray();
  }
  function G(P) {
    return $.bindVertexArray(P);
  }
  function K(P) {
    return $.deleteVertexArray(P);
  }
  function O(P, u, n, b) {
    let i = b.wireframe === !0,
      x = Q[u.id];
    if (x === void 0) ((x = {}), (Q[u.id] = x));
    let l = P.isInstancedMesh === !0 ? P.id : 0,
      r = x[l];
    if (r === void 0) ((r = {}), (x[l] = r));
    let G$ = r[n.id];
    if (G$ === void 0) ((G$ = {}), (r[n.id] = G$));
    let k$ = G$[i];
    if (k$ === void 0) ((k$ = N(H())), (G$[i] = k$));
    return k$;
  }
  function N(P) {
    let u = [],
      n = [],
      b = [];
    for (let i = 0; i < U; i++) ((u[i] = 0), (n[i] = 0), (b[i] = 0));
    return {
      geometry: null,
      program: null,
      wireframe: !1,
      newAttributes: u,
      enabledAttributes: n,
      attributeDivisors: b,
      object: P,
      attributes: {},
      index: null,
    };
  }
  function F(P, u, n, b) {
    let i = X.attributes,
      x = u.attributes,
      l = 0,
      r = n.getAttributes();
    for (let G$ in r)
      if (r[G$].location >= 0) {
        let h$ = i[G$],
          b$ = x[G$];
        if (b$ === void 0) {
          if (G$ === "instanceMatrix" && P.instanceMatrix) b$ = P.instanceMatrix;
          if (G$ === "instanceColor" && P.instanceColor) b$ = P.instanceColor;
        }
        if (h$ === void 0) return !0;
        if (h$.attribute !== b$) return !0;
        if (b$ && h$.data !== b$.data) return !0;
        l++;
      }
    if (X.attributesNum !== l) return !0;
    if (X.index !== b) return !0;
    return !1;
  }
  function B(P, u, n, b) {
    let i = {},
      x = u.attributes,
      l = 0,
      r = n.getAttributes();
    for (let G$ in r)
      if (r[G$].location >= 0) {
        let h$ = x[G$];
        if (h$ === void 0) {
          if (G$ === "instanceMatrix" && P.instanceMatrix) h$ = P.instanceMatrix;
          if (G$ === "instanceColor" && P.instanceColor) h$ = P.instanceColor;
        }
        let b$ = {};
        if (((b$.attribute = h$), h$ && h$.data)) b$.data = h$.data;
        ((i[G$] = b$), l++);
      }
    ((X.attributes = i), (X.attributesNum = l), (X.index = b));
  }
  function E() {
    let P = X.newAttributes;
    for (let u = 0, n = P.length; u < n; u++) P[u] = 0;
  }
  function z(P) {
    q(P, 0);
  }
  function q(P, u) {
    let { newAttributes: n, enabledAttributes: b, attributeDivisors: i } = X;
    if (((n[P] = 1), b[P] === 0)) ($.enableVertexAttribArray(P), (b[P] = 1));
    if (i[P] !== u) ($.vertexAttribDivisor(P, u), (i[P] = u));
  }
  function L() {
    let { newAttributes: P, enabledAttributes: u } = X;
    for (let n = 0, b = u.length; n < b; n++) if (u[n] !== P[n]) ($.disableVertexAttribArray(n), (u[n] = 0));
  }
  function V(P, u, n, b, i, x, l) {
    if (l === !0) $.vertexAttribIPointer(P, u, n, i, x);
    else $.vertexAttribPointer(P, u, n, b, i, x);
  }
  function k(P, u, n, b) {
    E();
    let i = b.attributes,
      x = n.getAttributes(),
      l = u.defaultAttributeValues;
    for (let r in x) {
      let G$ = x[r];
      if (G$.location >= 0) {
        let k$ = i[r];
        if (k$ === void 0) {
          if (r === "instanceMatrix" && P.instanceMatrix) k$ = P.instanceMatrix;
          if (r === "instanceColor" && P.instanceColor) k$ = P.instanceColor;
        }
        if (k$ !== void 0) {
          let { normalized: h$, itemSize: b$ } = k$,
            b6 = J.get(k$);
          if (b6 === void 0) continue;
          let { buffer: k6, type: a, bytesPerElement: Z$ } = b6,
            u$ = a === $.INT || a === $.UNSIGNED_INT || k$.gpuType === HB;
          if (k$.isInterleavedBufferAttribute) {
            let S$ = k$.data,
              o$ = S$.stride,
              y6 = k$.offset;
            if (S$.isInstancedInterleavedBuffer) {
              for (let B6 = 0; B6 < G$.locationSize; B6++) q(G$.location + B6, S$.meshPerAttribute);
              if (P.isInstancedMesh !== !0 && b._maxInstanceCount === void 0)
                b._maxInstanceCount = S$.meshPerAttribute * S$.count;
            } else for (let B6 = 0; B6 < G$.locationSize; B6++) z(G$.location + B6);
            $.bindBuffer($.ARRAY_BUFFER, k6);
            for (let B6 = 0; B6 < G$.locationSize; B6++)
              V(G$.location + B6, b$ / G$.locationSize, a, h$, o$ * Z$, (y6 + (b$ / G$.locationSize) * B6) * Z$, u$);
          } else {
            if (k$.isInstancedBufferAttribute) {
              for (let S$ = 0; S$ < G$.locationSize; S$++) q(G$.location + S$, k$.meshPerAttribute);
              if (P.isInstancedMesh !== !0 && b._maxInstanceCount === void 0)
                b._maxInstanceCount = k$.meshPerAttribute * k$.count;
            } else for (let S$ = 0; S$ < G$.locationSize; S$++) z(G$.location + S$);
            $.bindBuffer($.ARRAY_BUFFER, k6);
            for (let S$ = 0; S$ < G$.locationSize; S$++)
              V(G$.location + S$, b$ / G$.locationSize, a, h$, b$ * Z$, (b$ / G$.locationSize) * S$ * Z$, u$);
          }
        } else if (l !== void 0) {
          let h$ = l[r];
          if (h$ !== void 0)
            switch (h$.length) {
              case 2:
                $.vertexAttrib2fv(G$.location, h$);
                break;
              case 3:
                $.vertexAttrib3fv(G$.location, h$);
                break;
              case 4:
                $.vertexAttrib4fv(G$.location, h$);
                break;
              default:
                $.vertexAttrib1fv(G$.location, h$);
            }
        }
      }
    }
    L();
  }
  function R() {
    M();
    for (let P in Q) {
      let u = Q[P];
      for (let n in u) {
        let b = u[n];
        for (let i in b) {
          let x = b[i];
          for (let l in x) (K(x[l].object), delete x[l]);
          delete b[i];
        }
      }
      delete Q[P];
    }
  }
  function _(P) {
    if (Q[P.id] === void 0) return;
    let u = Q[P.id];
    for (let n in u) {
      let b = u[n];
      for (let i in b) {
        let x = b[i];
        for (let l in x) (K(x[l].object), delete x[l]);
        delete b[i];
      }
    }
    delete Q[P.id];
  }
  function S(P) {
    for (let u in Q) {
      let n = Q[u];
      for (let b in n) {
        let i = n[b];
        if (i[P.id] === void 0) continue;
        let x = i[P.id];
        for (let l in x) (K(x[l].object), delete x[l]);
        delete i[P.id];
      }
    }
  }
  function w(P) {
    for (let u in Q) {
      let n = Q[u],
        b = P.isInstancedMesh === !0 ? P.id : 0,
        i = n[b];
      if (i === void 0) continue;
      for (let x in i) {
        let l = i[x];
        for (let r in l) (K(l[r].object), delete l[r]);
        delete i[x];
      }
      if ((delete n[b], Object.keys(n).length === 0)) delete Q[u];
    }
  }
  function M() {
    if ((m(), (Y = !0), X === W)) return;
    ((X = W), G(X.object));
  }
  function m() {
    ((W.geometry = null), (W.program = null), (W.wireframe = !1));
  }
  return {
    setup: D,
    reset: M,
    resetDefaultState: m,
    dispose: R,
    releaseStatesOfGeometry: _,
    releaseStatesOfObject: w,
    releaseStatesOfProgram: S,
    initAttributes: E,
    enableAttribute: z,
    disableUnusedAttributes: L,
  };
}
function Pc($, J, U) {
  let Q;
  function W(H) {
    Q = H;
  }
  function X(H, G) {
    ($.drawArrays(Q, H, G), U.update(G, Q, 1));
  }
  function Y(H, G, K) {
    if (K === 0) return;
    ($.drawArraysInstanced(Q, H, G, K), U.update(G, Q, K));
  }
  function D(H, G, K) {
    if (K === 0) return;
    J.get("WEBGL_multi_draw").multiDrawArraysWEBGL(Q, H, 0, G, 0, K);
    let N = 0;
    for (let F = 0; F < K; F++) N += G[F];
    U.update(N, Q, 1);
  }
  ((this.setMode = W), (this.render = X), (this.renderInstances = Y), (this.renderMultiDraw = D));
}
function _c($, J, U, Q) {
  let W;
  function X() {
    if (W !== void 0) return W;
    if (J.has("EXT_texture_filter_anisotropic") === !0) {
      let S = J.get("EXT_texture_filter_anisotropic");
      W = $.getParameter(S.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
    } else W = 0;
    return W;
  }
  function Y(S) {
    if (S !== jU && Q.convert(S) !== $.getParameter($.IMPLEMENTATION_COLOR_READ_FORMAT)) return !1;
    return !0;
  }
  function D(S) {
    let w = S === Y8 && (J.has("EXT_color_buffer_half_float") || J.has("EXT_color_buffer_float"));
    if (S !== FU && Q.convert(S) !== $.getParameter($.IMPLEMENTATION_COLOR_READ_TYPE) && S !== X8 && !w) return !1;
    return !0;
  }
  function H(S) {
    if (S === "highp") {
      if (
        $.getShaderPrecisionFormat($.VERTEX_SHADER, $.HIGH_FLOAT).precision > 0 &&
        $.getShaderPrecisionFormat($.FRAGMENT_SHADER, $.HIGH_FLOAT).precision > 0
      )
        return "highp";
      S = "mediump";
    }
    if (S === "mediump") {
      if (
        $.getShaderPrecisionFormat($.VERTEX_SHADER, $.MEDIUM_FLOAT).precision > 0 &&
        $.getShaderPrecisionFormat($.FRAGMENT_SHADER, $.MEDIUM_FLOAT).precision > 0
      )
        return "mediump";
    }
    return "lowp";
  }
  let G = U.precision !== void 0 ? U.precision : "highp",
    K = H(G);
  if (K !== G) (i$("WebGLRenderer:", G, "not supported, using", K, "instead."), (G = K));
  let O = U.logarithmicDepthBuffer === !0,
    N = U.reversedDepthBuffer === !0 && J.has("EXT_clip_control");
  if (U.reversedDepthBuffer === !0 && N === !1)
    i$(
      "WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.",
    );
  let F = $.getParameter($.MAX_TEXTURE_IMAGE_UNITS),
    B = $.getParameter($.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
    E = $.getParameter($.MAX_TEXTURE_SIZE),
    z = $.getParameter($.MAX_CUBE_MAP_TEXTURE_SIZE),
    q = $.getParameter($.MAX_VERTEX_ATTRIBS),
    L = $.getParameter($.MAX_VERTEX_UNIFORM_VECTORS),
    V = $.getParameter($.MAX_VARYING_VECTORS),
    k = $.getParameter($.MAX_FRAGMENT_UNIFORM_VECTORS),
    R = $.getParameter($.MAX_SAMPLES),
    _ = $.getParameter($.SAMPLES);
  return {
    isWebGL2: !0,
    getMaxAnisotropy: X,
    getMaxPrecision: H,
    textureFormatReadable: Y,
    textureTypeReadable: D,
    precision: G,
    logarithmicDepthBuffer: O,
    reversedDepthBuffer: N,
    maxTextures: F,
    maxVertexTextures: B,
    maxTextureSize: E,
    maxCubemapSize: z,
    maxAttributes: q,
    maxVertexUniforms: L,
    maxVaryings: V,
    maxFragmentUniforms: k,
    maxSamples: R,
    samples: _,
  };
}
function Sc($) {
  let J = this,
    U = null,
    Q = 0,
    W = !1,
    X = !1,
    Y = new GU(),
    D = new X6(),
    H = { value: null, needsUpdate: !1 };
  ((this.uniform = H),
    (this.numPlanes = 0),
    (this.numIntersection = 0),
    (this.init = function (O, N) {
      let F = O.length !== 0 || N || Q !== 0 || W;
      return ((W = N), (Q = O.length), F);
    }),
    (this.beginShadows = function () {
      ((X = !0), K(null));
    }),
    (this.endShadows = function () {
      X = !1;
    }),
    (this.setGlobalState = function (O, N) {
      U = K(O, N, 0);
    }),
    (this.setState = function (O, N, F) {
      let { clippingPlanes: B, clipIntersection: E, clipShadows: z } = O,
        q = $.get(O);
      if (!W || B === null || B.length === 0 || (X && !z))
        if (X) K(null);
        else G();
      else {
        let L = X ? 0 : Q,
          V = L * 4,
          k = q.clippingState || null;
        ((H.value = k), (k = K(B, N, V, F)));
        for (let R = 0; R !== V; ++R) k[R] = U[R];
        ((q.clippingState = k), (this.numIntersection = E ? this.numPlanes : 0), (this.numPlanes += L));
      }
    }));
  function G() {
    if (H.value !== U) ((H.value = U), (H.needsUpdate = Q > 0));
    ((J.numPlanes = Q), (J.numIntersection = 0));
  }
  function K(O, N, F, B) {
    let E = O !== null ? O.length : 0,
      z = null;
    if (E !== 0) {
      if (((z = H.value), B !== !0 || z === null)) {
        let q = F + E * 4,
          L = N.matrixWorldInverse;
        if ((D.getNormalMatrix(L), z === null || z.length < q)) z = new Float32Array(q);
        for (let V = 0, k = F; V !== E; ++V, k += 4)
          (Y.copy(O[V]).applyMatrix4(L, D), Y.normal.toArray(z, k), (z[k + 3] = Y.constant));
      }
      ((H.value = z), (H.needsUpdate = !0));
    }
    return ((J.numPlanes = E), (J.numIntersection = 0), z);
  }
}
var X9 = 4,
  _P = [0.125, 0.215, 0.35, 0.446, 0.526, 0.582],
  r9 = 20,
  Cc = 256,
  kX = new IX(),
  SP = new W6(),
  AE = null,
  ME = 0,
  RE = 0,
  ZE = !1,
  Tc = new C();
class SE {
  constructor($) {
    ((this._renderer = $),
      (this._pingPongRenderTarget = null),
      (this._lodMax = 0),
      (this._cubeSize = 0),
      (this._sizeLods = []),
      (this._sigmas = []),
      (this._lodMeshes = []),
      (this._backgroundBox = null),
      (this._cubemapMaterial = null),
      (this._equirectMaterial = null),
      (this._blurMaterial = null),
      (this._ggxMaterial = null));
  }
  fromScene($, J = 0, U = 0.1, Q = 100, W = {}) {
    let { size: X = 256, position: Y = Tc } = W;
    ((AE = this._renderer.getRenderTarget()),
      (ME = this._renderer.getActiveCubeFace()),
      (RE = this._renderer.getActiveMipmapLevel()),
      (ZE = this._renderer.xr.enabled),
      (this._renderer.xr.enabled = !1),
      this._setSize(X));
    let D = this._allocateTargets();
    if (((D.depthBuffer = !0), this._sceneToCubeUV($, U, Q, D, Y), J > 0)) this._blur(D, 0, 0, J);
    return (this._applyPMREM(D), this._cleanup(D), D);
  }
  fromEquirectangular($, J = null) {
    return this._fromTexture($, J);
  }
  fromCubemap($, J = null) {
    return this._fromTexture($, J);
  }
  compileCubemapShader() {
    if (this._cubemapMaterial === null) ((this._cubemapMaterial = jP()), this._compileMaterial(this._cubemapMaterial));
  }
  compileEquirectangularShader() {
    if (this._equirectMaterial === null)
      ((this._equirectMaterial = TP()), this._compileMaterial(this._equirectMaterial));
  }
  dispose() {
    if ((this._dispose(), this._cubemapMaterial !== null)) this._cubemapMaterial.dispose();
    if (this._equirectMaterial !== null) this._equirectMaterial.dispose();
    if (this._backgroundBox !== null) (this._backgroundBox.geometry.dispose(), this._backgroundBox.material.dispose());
  }
  _setSize($) {
    ((this._lodMax = Math.floor(Math.log2($))), (this._cubeSize = Math.pow(2, this._lodMax)));
  }
  _dispose() {
    if (this._blurMaterial !== null) this._blurMaterial.dispose();
    if (this._ggxMaterial !== null) this._ggxMaterial.dispose();
    if (this._pingPongRenderTarget !== null) this._pingPongRenderTarget.dispose();
    for (let $ = 0; $ < this._lodMeshes.length; $++) this._lodMeshes[$].geometry.dispose();
  }
  _cleanup($) {
    (this._renderer.setRenderTarget(AE, ME, RE),
      (this._renderer.xr.enabled = ZE),
      ($.scissorTest = !1),
      i1($, 0, 0, $.width, $.height));
  }
  _fromTexture($, J) {
    if ($.mapping === u1 || $.mapping === x9)
      this._setSize($.image.length === 0 ? 16 : $.image[0].width || $.image[0].image.width);
    else this._setSize($.image.width / 4);
    ((AE = this._renderer.getRenderTarget()),
      (ME = this._renderer.getActiveCubeFace()),
      (RE = this._renderer.getActiveMipmapLevel()),
      (ZE = this._renderer.xr.enabled),
      (this._renderer.xr.enabled = !1));
    let U = J || this._allocateTargets();
    return (this._textureToCubeUV($, U), this._applyPMREM(U), this._cleanup(U), U);
  }
  _allocateTargets() {
    let $ = 3 * Math.max(this._cubeSize, 112),
      J = 4 * this._cubeSize,
      U = { magFilter: MJ, minFilter: MJ, generateMipmaps: !1, type: Y8, format: jU, colorSpace: cB, depthBuffer: !1 },
      Q = CP($, J, U);
    if (
      this._pingPongRenderTarget === null ||
      this._pingPongRenderTarget.width !== $ ||
      this._pingPongRenderTarget.height !== J
    ) {
      if (this._pingPongRenderTarget !== null) this._dispose();
      this._pingPongRenderTarget = CP($, J, U);
      let { _lodMax: W } = this;
      (({ lodMeshes: this._lodMeshes, sizeLods: this._sizeLods, sigmas: this._sigmas } = jc(W)),
        (this._blurMaterial = bc(W, $, J)),
        (this._ggxMaterial = vc(W, $, J)));
    }
    return Q;
  }
  _compileMaterial($) {
    let J = new X$(new Q0(), $);
    this._renderer.compile(J, kX);
  }
  _sceneToCubeUV($, J, U, Q, W) {
    let D = new r0(90, 1, J, U),
      H = [1, -1, 1, 1, 1, 1],
      G = [1, 1, 1, -1, -1, -1],
      K = this._renderer,
      O = K.autoClear,
      N = K.toneMapping;
    if ((K.getClearColor(SP), (K.toneMapping = OU), (K.autoClear = !1), K.state.buffers.depth.getReversed()))
      (K.setRenderTarget(Q), K.clearDepth(), K.setRenderTarget(null));
    if (this._backgroundBox === null)
      this._backgroundBox = new X$(
        new p6(),
        new KJ({ name: "PMREM.Background", side: kJ, depthWrite: !1, depthTest: !1 }),
      );
    let B = this._backgroundBox,
      E = B.material,
      z = !1,
      q = $.background;
    if (q) {
      if (q.isColor) (E.color.copy(q), ($.background = null), (z = !0));
    } else (E.color.copy(SP), (z = !0));
    for (let L = 0; L < 6; L++) {
      let V = L % 3;
      if (V === 0) (D.up.set(0, H[L], 0), D.position.set(W.x, W.y, W.z), D.lookAt(W.x + G[L], W.y, W.z));
      else if (V === 1) (D.up.set(0, 0, H[L]), D.position.set(W.x, W.y, W.z), D.lookAt(W.x, W.y + G[L], W.z));
      else (D.up.set(0, H[L], 0), D.position.set(W.x, W.y, W.z), D.lookAt(W.x, W.y, W.z + G[L]));
      let k = this._cubeSize;
      if ((i1(Q, V * k, L > 2 ? k : 0, k, k), K.setRenderTarget(Q), z)) K.render(B, D);
      K.render($, D);
    }
    ((K.toneMapping = N), (K.autoClear = O), ($.background = q));
  }
  _textureToCubeUV($, J) {
    let U = this._renderer,
      Q = $.mapping === u1 || $.mapping === x9;
    if (Q) {
      if (this._cubemapMaterial === null) this._cubemapMaterial = jP();
      this._cubemapMaterial.uniforms.flipEnvMap.value = $.isRenderTargetTexture === !1 ? -1 : 1;
    } else if (this._equirectMaterial === null) this._equirectMaterial = TP();
    let W = Q ? this._cubemapMaterial : this._equirectMaterial,
      X = this._lodMeshes[0];
    X.material = W;
    let Y = W.uniforms;
    Y.envMap.value = $;
    let D = this._cubeSize;
    (i1(J, 0, 0, 3 * D, 2 * D), U.setRenderTarget(J), U.render(X, kX));
  }
  _applyPMREM($) {
    let J = this._renderer,
      U = J.autoClear;
    J.autoClear = !1;
    let Q = this._lodMeshes.length;
    for (let W = 1; W < Q; W++) this._applyGGXFilter($, W - 1, W);
    J.autoClear = U;
  }
  _applyGGXFilter($, J, U) {
    let Q = this._renderer,
      W = this._pingPongRenderTarget,
      X = this._ggxMaterial,
      Y = this._lodMeshes[U];
    Y.material = X;
    let D = X.uniforms,
      H = U / (this._lodMeshes.length - 1),
      G = J / (this._lodMeshes.length - 1),
      K = Math.sqrt(H * H - G * G),
      O = 0 + H * 1.25,
      N = K * O,
      { _lodMax: F } = this,
      B = this._sizeLods[U],
      E = 3 * B * (U > F - X9 ? U - F + X9 : 0),
      z = 4 * (this._cubeSize - B);
    ((D.envMap.value = $.texture),
      (D.roughness.value = N),
      (D.mipInt.value = F - J),
      i1(W, E, z, 3 * B, 2 * B),
      Q.setRenderTarget(W),
      Q.render(Y, kX),
      (D.envMap.value = W.texture),
      (D.roughness.value = 0),
      (D.mipInt.value = F - U),
      i1($, E, z, 3 * B, 2 * B),
      Q.setRenderTarget($),
      Q.render(Y, kX));
  }
  _blur($, J, U, Q, W) {
    let X = this._pingPongRenderTarget;
    (this._halfBlur($, X, J, U, Q, "latitudinal", W), this._halfBlur(X, $, U, U, Q, "longitudinal", W));
  }
  _halfBlur($, J, U, Q, W, X, Y) {
    let D = this._renderer,
      H = this._blurMaterial;
    if (X !== "latitudinal" && X !== "longitudinal") s$("blur direction must be either latitudinal or longitudinal!");
    let G = 3,
      K = this._lodMeshes[Q];
    K.material = H;
    let O = H.uniforms,
      N = this._sizeLods[U] - 1,
      F = isFinite(W) ? Math.PI / (2 * N) : (2 * Math.PI) / (2 * r9 - 1),
      B = W / F,
      E = isFinite(W) ? 1 + Math.floor(G * B) : r9;
    if (E > r9)
      i$(
        `sigmaRadians, ${W}, is too large and will clip, as it requested ${E} samples when the maximum is set to ${r9}`,
      );
    let z = [],
      q = 0;
    for (let _ = 0; _ < r9; ++_) {
      let S = _ / B,
        w = Math.exp((-S * S) / 2);
      if ((z.push(w), _ === 0)) q += w;
      else if (_ < E) q += 2 * w;
    }
    for (let _ = 0; _ < z.length; _++) z[_] = z[_] / q;
    if (
      ((O.envMap.value = $.texture),
      (O.samples.value = E),
      (O.weights.value = z),
      (O.latitudinal.value = X === "latitudinal"),
      Y)
    )
      O.poleAxis.value = Y;
    let { _lodMax: L } = this;
    ((O.dTheta.value = F), (O.mipInt.value = L - U));
    let V = this._sizeLods[Q],
      k = 3 * V * (Q > L - X9 ? Q - L + X9 : 0),
      R = 4 * (this._cubeSize - V);
    (i1(J, k, R, 3 * V, 2 * V), D.setRenderTarget(J), D.render(K, kX));
  }
}
function jc($) {
  let J = [],
    U = [],
    Q = [],
    W = $,
    X = $ - X9 + 1 + _P.length;
  for (let Y = 0; Y < X; Y++) {
    let D = Math.pow(2, W);
    J.push(D);
    let H = 1 / D;
    if (Y > $ - X9) H = _P[Y - $ + X9 - 1];
    else if (Y === 0) H = 0;
    U.push(H);
    let G = 1 / (D - 2),
      K = -G,
      O = 1 + G,
      N = [K, K, O, K, O, O, K, K, O, O, K, O],
      F = 6,
      B = 6,
      E = 3,
      z = 2,
      q = 1,
      L = new Float32Array(E * B * F),
      V = new Float32Array(z * B * F),
      k = new Float32Array(q * B * F);
    for (let _ = 0; _ < F; _++) {
      let S = ((_ % 3) * 2) / 3 - 1,
        w = _ > 2 ? 0 : -1,
        M = [
          S,
          w,
          0,
          S + 0.6666666666666666,
          w,
          0,
          S + 0.6666666666666666,
          w + 1,
          0,
          S,
          w,
          0,
          S + 0.6666666666666666,
          w + 1,
          0,
          S,
          w + 1,
          0,
        ];
      (L.set(M, E * B * _), V.set(N, z * B * _));
      let m = [_, _, _, _, _, _];
      k.set(m, q * B * _);
    }
    let R = new Q0();
    if (
      (R.setAttribute("position", new bJ(L, E)),
      R.setAttribute("uv", new bJ(V, z)),
      R.setAttribute("faceIndex", new bJ(k, q)),
      Q.push(new X$(R, null)),
      W > X9)
    )
      W--;
  }
  return { lodMeshes: Q, sizeLods: J, sigmas: U };
}
function CP($, J, U) {
  let Q = new pJ($, J, U);
  return ((Q.texture.mapping = GX), (Q.texture.name = "PMREM.cubeUv"), (Q.scissorTest = !0), Q);
}
function i1($, J, U, Q, W) {
  ($.viewport.set(J, U, Q, W), $.scissor.set(J, U, Q, W));
}
function vc($, J, U) {
  return new dJ({
    name: "PMREMGGXConvolution",
    defines: { GGX_SAMPLES: Cc, CUBEUV_TEXEL_WIDTH: 1 / J, CUBEUV_TEXEL_HEIGHT: 1 / U, CUBEUV_MAX_MIP: `${$}.0` },
    uniforms: { envMap: { value: null }, roughness: { value: 0 }, mipInt: { value: 0 } },
    vertexShader: lG(),
    fragmentShader: `

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,
    blending: TU,
    depthTest: !1,
    depthWrite: !1,
  });
}
function bc($, J, U) {
  let Q = new Float32Array(r9),
    W = new C(0, 1, 0);
  return new dJ({
    name: "SphericalGaussianBlur",
    defines: { n: r9, CUBEUV_TEXEL_WIDTH: 1 / J, CUBEUV_TEXEL_HEIGHT: 1 / U, CUBEUV_MAX_MIP: `${$}.0` },
    uniforms: {
      envMap: { value: null },
      samples: { value: 1 },
      weights: { value: Q },
      latitudinal: { value: !1 },
      dTheta: { value: 0 },
      mipInt: { value: 0 },
      poleAxis: { value: W },
    },
    vertexShader: lG(),
    fragmentShader: `

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,
    blending: TU,
    depthTest: !1,
    depthWrite: !1,
  });
}
function TP() {
  return new dJ({
    name: "EquirectangularToCubeUV",
    uniforms: { envMap: { value: null } },
    vertexShader: lG(),
    fragmentShader: `

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,
    blending: TU,
    depthTest: !1,
    depthWrite: !1,
  });
}
function jP() {
  return new dJ({
    name: "CubemapToCubeUV",
    uniforms: { envMap: { value: null }, flipEnvMap: { value: -1 } },
    vertexShader: lG(),
    fragmentShader: `

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,
    blending: TU,
    depthTest: !1,
    depthWrite: !1,
  });
}
function lG() {
  return `

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`;
}
class jE extends pJ {
  constructor($ = 1, J = {}) {
    super($, $, J);
    this.isWebGLCubeRenderTarget = !0;
    let U = { width: $, height: $, depth: 1 },
      Q = [U, U, U, U, U, U];
    ((this.texture = new _G(Q)), this._setTextureOptions(J), (this.texture.isRenderTargetTexture = !0));
  }
  fromEquirectangularTexture($, J) {
    ((this.texture.type = J.type),
      (this.texture.colorSpace = J.colorSpace),
      (this.texture.generateMipmaps = J.generateMipmaps),
      (this.texture.minFilter = J.minFilter),
      (this.texture.magFilter = J.magFilter));
    let U = {
        uniforms: { tEquirect: { value: null } },
        vertexShader: `

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,
        fragmentShader: `

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`,
      },
      Q = new p6(5, 5, 5),
      W = new dJ({
        name: "CubemapFromEquirect",
        uniforms: c9(U.uniforms),
        vertexShader: U.vertexShader,
        fragmentShader: U.fragmentShader,
        side: kJ,
        blending: TU,
      });
    W.uniforms.tEquirect.value = J;
    let X = new X$(Q, W),
      Y = J.minFilter;
    if (J.minFilter === g9) J.minFilter = MJ;
    return (new EE(1, 10, this).update($, X), (J.minFilter = Y), X.geometry.dispose(), X.material.dispose(), this);
  }
  clear($, J = !0, U = !0, Q = !0) {
    let W = $.getRenderTarget();
    for (let X = 0; X < 6; X++) ($.setRenderTarget(this, X), $.clear(J, U, Q));
    $.setRenderTarget(W);
  }
}
function fc($) {
  let J = new WeakMap(),
    U = new WeakMap(),
    Q = null;
  function W(N, F = !1) {
    if (N === null || N === void 0) return null;
    if (F) return Y(N);
    return X(N);
  }
  function X(N) {
    if (N && N.isTexture) {
      let F = N.mapping;
      if (F === l1 || F === NG)
        if (J.has(N)) {
          let B = J.get(N).texture;
          return D(B, N.mapping);
        } else {
          let B = N.image;
          if (B && B.height > 0) {
            let E = new jE(B.height);
            return (
              E.fromEquirectangularTexture($, N),
              J.set(N, E),
              N.addEventListener("dispose", G),
              D(E.texture, N.mapping)
            );
          } else return null;
        }
    }
    return N;
  }
  function Y(N) {
    if (N && N.isTexture) {
      let F = N.mapping,
        B = F === l1 || F === NG,
        E = F === u1 || F === x9;
      if (B || E) {
        let z = U.get(N),
          q = z !== void 0 ? z.texture.pmremVersion : 0;
        if (N.isRenderTargetTexture && N.pmremVersion !== q) {
          if (Q === null) Q = new SE($);
          return (
            (z = B ? Q.fromEquirectangular(N, z) : Q.fromCubemap(N, z)),
            (z.texture.pmremVersion = N.pmremVersion),
            U.set(N, z),
            z.texture
          );
        } else if (z !== void 0) return z.texture;
        else {
          let L = N.image;
          if ((B && L && L.height > 0) || (E && L && H(L))) {
            if (Q === null) Q = new SE($);
            return (
              (z = B ? Q.fromEquirectangular(N) : Q.fromCubemap(N)),
              (z.texture.pmremVersion = N.pmremVersion),
              U.set(N, z),
              N.addEventListener("dispose", K),
              z.texture
            );
          } else return null;
        }
      }
    }
    return N;
  }
  function D(N, F) {
    if (F === l1) N.mapping = u1;
    else if (F === NG) N.mapping = x9;
    return N;
  }
  function H(N) {
    let F = 0,
      B = 6;
    for (let E = 0; E < B; E++) if (N[E] !== void 0) F++;
    return F === B;
  }
  function G(N) {
    let F = N.target;
    F.removeEventListener("dispose", G);
    let B = J.get(F);
    if (B !== void 0) (J.delete(F), B.dispose());
  }
  function K(N) {
    let F = N.target;
    F.removeEventListener("dispose", K);
    let B = U.get(F);
    if (B !== void 0) (U.delete(F), B.dispose());
  }
  function O() {
    if (((J = new WeakMap()), (U = new WeakMap()), Q !== null)) (Q.dispose(), (Q = null));
  }
  return { get: W, dispose: O };
}
function yc($) {
  let J = {};
  function U(Q) {
    if (J[Q] !== void 0) return J[Q];
    let W = $.getExtension(Q);
    return ((J[Q] = W), W);
  }
  return {
    has: function (Q) {
      return U(Q) !== null;
    },
    init: function () {
      (U("EXT_color_buffer_float"),
        U("WEBGL_clip_cull_distance"),
        U("OES_texture_float_linear"),
        U("EXT_color_buffer_half_float"),
        U("WEBGL_multisampled_render_to_texture"),
        U("WEBGL_render_shared_exponent"));
    },
    get: function (Q) {
      let W = U(Q);
      if (W === null) HG("WebGLRenderer: " + Q + " extension not supported.");
      return W;
    },
  };
}
function xc($, J, U, Q) {
  let W = {},
    X = new WeakMap();
  function Y(O) {
    let N = O.target;
    if (N.index !== null) J.remove(N.index);
    for (let B in N.attributes) J.remove(N.attributes[B]);
    (N.removeEventListener("dispose", Y), delete W[N.id]);
    let F = X.get(N);
    if (F) (J.remove(F), X.delete(N));
    if ((Q.releaseStatesOfGeometry(N), N.isInstancedBufferGeometry === !0)) delete N._maxInstanceCount;
    U.memory.geometries--;
  }
  function D(O, N) {
    if (W[N.id] === !0) return N;
    return (N.addEventListener("dispose", Y), (W[N.id] = !0), U.memory.geometries++, N);
  }
  function H(O) {
    let N = O.attributes;
    for (let F in N) J.update(N[F], $.ARRAY_BUFFER);
  }
  function G(O) {
    let N = [],
      F = O.index,
      B = O.attributes.position,
      E = 0;
    if (B === void 0) return;
    if (F !== null) {
      let L = F.array;
      E = F.version;
      for (let V = 0, k = L.length; V < k; V += 3) {
        let R = L[V + 0],
          _ = L[V + 1],
          S = L[V + 2];
        N.push(R, _, _, S, S, R);
      }
    } else {
      let L = B.array;
      E = B.version;
      for (let V = 0, k = L.length / 3 - 1; V < k; V += 3) {
        let R = V + 0,
          _ = V + 1,
          S = V + 2;
        N.push(R, _, _, S, S, R);
      }
    }
    let z = new (B.count >= 65535 ? RG : MG)(N, 1);
    z.version = E;
    let q = X.get(O);
    if (q) J.remove(q);
    X.set(O, z);
  }
  function K(O) {
    let N = X.get(O);
    if (N) {
      let F = O.index;
      if (F !== null) {
        if (N.version < F.version) G(O);
      }
    } else G(O);
    return X.get(O);
  }
  return { get: D, update: H, getWireframeAttribute: K };
}
function gc($, J, U) {
  let Q;
  function W(O) {
    Q = O;
  }
  let X, Y;
  function D(O) {
    ((X = O.type), (Y = O.bytesPerElement));
  }
  function H(O, N) {
    ($.drawElements(Q, N, X, O * Y), U.update(N, Q, 1));
  }
  function G(O, N, F) {
    if (F === 0) return;
    ($.drawElementsInstanced(Q, N, X, O * Y, F), U.update(N, Q, F));
  }
  function K(O, N, F) {
    if (F === 0) return;
    J.get("WEBGL_multi_draw").multiDrawElementsWEBGL(Q, N, 0, X, O, 0, F);
    let E = 0;
    for (let z = 0; z < F; z++) E += N[z];
    U.update(E, Q, 1);
  }
  ((this.setMode = W), (this.setIndex = D), (this.render = H), (this.renderInstances = G), (this.renderMultiDraw = K));
}
function hc($) {
  let J = { geometries: 0, textures: 0 },
    U = { frame: 0, calls: 0, triangles: 0, points: 0, lines: 0 };
  function Q(X, Y, D) {
    switch ((U.calls++, Y)) {
      case $.TRIANGLES:
        U.triangles += D * (X / 3);
        break;
      case $.LINES:
        U.lines += D * (X / 2);
        break;
      case $.LINE_STRIP:
        U.lines += D * (X - 1);
        break;
      case $.LINE_LOOP:
        U.lines += D * X;
        break;
      case $.POINTS:
        U.points += D * X;
        break;
      default:
        s$("WebGLInfo: Unknown draw mode:", Y);
        break;
    }
  }
  function W() {
    ((U.calls = 0), (U.triangles = 0), (U.points = 0), (U.lines = 0));
  }
  return { memory: J, render: U, programs: null, autoReset: !0, reset: W, update: Q };
}
function uc($, J, U) {
  let Q = new WeakMap(),
    W = new q0();
  function X(Y, D, H) {
    let G = Y.morphTargetInfluences,
      K = D.morphAttributes.position || D.morphAttributes.normal || D.morphAttributes.color,
      O = K !== void 0 ? K.length : 0,
      N = Q.get(D);
    if (N === void 0 || N.count !== O) {
      let M = function () {
        (S.dispose(), Q.delete(D), D.removeEventListener("dispose", M));
      };
      if (N !== void 0) N.texture.dispose();
      let F = D.morphAttributes.position !== void 0,
        B = D.morphAttributes.normal !== void 0,
        E = D.morphAttributes.color !== void 0,
        z = D.morphAttributes.position || [],
        q = D.morphAttributes.normal || [],
        L = D.morphAttributes.color || [],
        V = 0;
      if (F === !0) V = 1;
      if (B === !0) V = 2;
      if (E === !0) V = 3;
      let k = D.attributes.position.count * V,
        R = 1;
      if (k > J.maxTextureSize) ((R = Math.ceil(k / J.maxTextureSize)), (k = J.maxTextureSize));
      let _ = new Float32Array(k * R * 4 * O),
        S = new kG(_, k, R, O);
      ((S.type = X8), (S.needsUpdate = !0));
      let w = V * 4;
      for (let m = 0; m < O; m++) {
        let P = z[m],
          u = q[m],
          n = L[m],
          b = k * R * 4 * m;
        for (let i = 0; i < P.count; i++) {
          let x = i * w;
          if (F === !0)
            (W.fromBufferAttribute(P, i),
              (_[b + x + 0] = W.x),
              (_[b + x + 1] = W.y),
              (_[b + x + 2] = W.z),
              (_[b + x + 3] = 0));
          if (B === !0)
            (W.fromBufferAttribute(u, i),
              (_[b + x + 4] = W.x),
              (_[b + x + 5] = W.y),
              (_[b + x + 6] = W.z),
              (_[b + x + 7] = 0));
          if (E === !0)
            (W.fromBufferAttribute(n, i),
              (_[b + x + 8] = W.x),
              (_[b + x + 9] = W.y),
              (_[b + x + 10] = W.z),
              (_[b + x + 11] = n.itemSize === 4 ? W.w : 1));
        }
      }
      ((N = { count: O, texture: S, size: new d$(k, R) }), Q.set(D, N), D.addEventListener("dispose", M));
    }
    if (Y.isInstancedMesh === !0 && Y.morphTexture !== null)
      H.getUniforms().setValue($, "morphTexture", Y.morphTexture, U);
    else {
      let F = 0;
      for (let E = 0; E < G.length; E++) F += G[E];
      let B = D.morphTargetsRelative ? 1 : 1 - F;
      (H.getUniforms().setValue($, "morphTargetBaseInfluence", B),
        H.getUniforms().setValue($, "morphTargetInfluences", G));
    }
    (H.getUniforms().setValue($, "morphTargetsTexture", N.texture, U),
      H.getUniforms().setValue($, "morphTargetsTextureSize", N.size));
  }
  return { update: X };
}
function lc($, J, U, Q, W) {
  let X = new WeakMap();
  function Y(G) {
    let K = W.render.frame,
      O = G.geometry,
      N = J.get(G, O);
    if (X.get(N) !== K) (J.update(N), X.set(N, K));
    if (G.isInstancedMesh) {
      if (G.hasEventListener("dispose", H) === !1) G.addEventListener("dispose", H);
      if (X.get(G) !== K) {
        if ((U.update(G.instanceMatrix, $.ARRAY_BUFFER), G.instanceColor !== null))
          U.update(G.instanceColor, $.ARRAY_BUFFER);
        X.set(G, K);
      }
    }
    if (G.isSkinnedMesh) {
      let F = G.skeleton;
      if (X.get(F) !== K) (F.update(), X.set(F, K));
    }
    return N;
  }
  function D() {
    X = new WeakMap();
  }
  function H(G) {
    let K = G.target;
    if (
      (K.removeEventListener("dispose", H),
      Q.releaseStatesOfObject(K),
      U.remove(K.instanceMatrix),
      K.instanceColor !== null)
    )
      U.remove(K.instanceColor);
  }
  return { update: Y, dispose: D };
}
var mc = {
  [JB]: "LINEAR_TONE_MAPPING",
  [UB]: "REINHARD_TONE_MAPPING",
  [WB]: "CINEON_TONE_MAPPING",
  [QB]: "ACES_FILMIC_TONE_MAPPING",
  [YB]: "AGX_TONE_MAPPING",
  [DB]: "NEUTRAL_TONE_MAPPING",
  [XB]: "CUSTOM_TONE_MAPPING",
};
function pc($, J, U, Q, W) {
  let X = new pJ(J, U, { type: $, depthBuffer: Q, stencilBuffer: W, depthTexture: Q ? new U9(J, U) : void 0 }),
    Y = new pJ(J, U, { type: Y8, depthBuffer: !1, stencilBuffer: !1 }),
    D = new Q0();
  (D.setAttribute("position", new S6([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3)),
    D.setAttribute("uv", new S6([0, 2, 0, 0, 2, 0], 2)));
  let H = new QE({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: `
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,
      fragmentShader: `
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,
      depthTest: !1,
      depthWrite: !1,
    }),
    G = new X$(D, H),
    K = new IX(-1, 1, 1, -1, 0, 1),
    O = null,
    N = null,
    F = !1,
    B,
    E = null,
    z = [],
    q = !1;
  ((this.setSize = function (L, V) {
    (X.setSize(L, V), Y.setSize(L, V));
    for (let k = 0; k < z.length; k++) {
      let R = z[k];
      if (R.setSize) R.setSize(L, V);
    }
  }),
    (this.setEffects = function (L) {
      ((z = L), (q = z.length > 0 && z[0].isRenderPass === !0));
      let { width: V, height: k } = X;
      for (let R = 0; R < z.length; R++) {
        let _ = z[R];
        if (_.setSize) _.setSize(V, k);
      }
    }),
    (this.begin = function (L, V) {
      if (F) return !1;
      if (L.toneMapping === OU && z.length === 0) return !1;
      if (((E = V), V !== null)) {
        let { width: k, height: R } = V;
        if (X.width !== k || X.height !== R) this.setSize(k, R);
      }
      if (q === !1) L.setRenderTarget(X);
      return ((B = L.toneMapping), (L.toneMapping = OU), !0);
    }),
    (this.hasRenderPass = function () {
      return q;
    }),
    (this.end = function (L, V) {
      ((L.toneMapping = B), (F = !0));
      let k = X,
        R = Y;
      for (let _ = 0; _ < z.length; _++) {
        let S = z[_];
        if (S.enabled === !1) continue;
        if ((S.render(L, R, k, V), S.needsSwap !== !1)) {
          let w = k;
          ((k = R), (R = w));
        }
      }
      if (O !== L.outputColorSpace || N !== L.toneMapping) {
        if (((O = L.outputColorSpace), (N = L.toneMapping), (H.defines = {}), R6.getTransfer(O) === W0))
          H.defines.SRGB_TRANSFER = "";
        let _ = mc[N];
        if (_) H.defines[_] = "";
        H.needsUpdate = !0;
      }
      ((H.uniforms.tDiffuse.value = k.texture), L.setRenderTarget(E), L.render(G, K), (E = null), (F = !1));
    }),
    (this.isCompositing = function () {
      return F;
    }),
    (this.dispose = function () {
      if (X.depthTexture) X.depthTexture.dispose();
      (X.dispose(), Y.dispose(), D.dispose(), H.dispose());
    }));
}
var tP = new j0(),
  CE = new U9(1, 1),
  eP = new kG(),
  $_ = new eB(),
  J_ = new _G(),
  vP = [],
  bP = [],
  fP = new Float32Array(16),
  yP = new Float32Array(9),
  xP = new Float32Array(4);
function o1($, J, U) {
  let Q = $[0];
  if (Q <= 0 || Q > 0) return $;
  let W = J * U,
    X = vP[W];
  if (X === void 0) ((X = new Float32Array(W)), (vP[W] = X));
  if (J !== 0) {
    Q.toArray(X, 0);
    for (let Y = 1, D = 0; Y !== J; ++Y) ((D += U), $[Y].toArray(X, D));
  }
  return X;
}
function _0($, J) {
  if ($.length !== J.length) return !1;
  for (let U = 0, Q = $.length; U < Q; U++) if ($[U] !== J[U]) return !1;
  return !0;
}
function S0($, J) {
  for (let U = 0, Q = J.length; U < Q; U++) $[U] = J[U];
}
function mG($, J) {
  let U = bP[J];
  if (U === void 0) ((U = new Int32Array(J)), (bP[J] = U));
  for (let Q = 0; Q !== J; ++Q) U[Q] = $.allocateTextureUnit();
  return U;
}
function dc($, J) {
  let U = this.cache;
  if (U[0] === J) return;
  ($.uniform1f(this.addr, J), (U[0] = J));
}
function cc($, J) {
  let U = this.cache;
  if (J.x !== void 0) {
    if (U[0] !== J.x || U[1] !== J.y) ($.uniform2f(this.addr, J.x, J.y), (U[0] = J.x), (U[1] = J.y));
  } else {
    if (_0(U, J)) return;
    ($.uniform2fv(this.addr, J), S0(U, J));
  }
}
function nc($, J) {
  let U = this.cache;
  if (J.x !== void 0) {
    if (U[0] !== J.x || U[1] !== J.y || U[2] !== J.z)
      ($.uniform3f(this.addr, J.x, J.y, J.z), (U[0] = J.x), (U[1] = J.y), (U[2] = J.z));
  } else if (J.r !== void 0) {
    if (U[0] !== J.r || U[1] !== J.g || U[2] !== J.b)
      ($.uniform3f(this.addr, J.r, J.g, J.b), (U[0] = J.r), (U[1] = J.g), (U[2] = J.b));
  } else {
    if (_0(U, J)) return;
    ($.uniform3fv(this.addr, J), S0(U, J));
  }
}
function ic($, J) {
  let U = this.cache;
  if (J.x !== void 0) {
    if (U[0] !== J.x || U[1] !== J.y || U[2] !== J.z || U[3] !== J.w)
      ($.uniform4f(this.addr, J.x, J.y, J.z, J.w), (U[0] = J.x), (U[1] = J.y), (U[2] = J.z), (U[3] = J.w));
  } else {
    if (_0(U, J)) return;
    ($.uniform4fv(this.addr, J), S0(U, J));
  }
}
function oc($, J) {
  let U = this.cache,
    Q = J.elements;
  if (Q === void 0) {
    if (_0(U, J)) return;
    ($.uniformMatrix2fv(this.addr, !1, J), S0(U, J));
  } else {
    if (_0(U, Q)) return;
    (xP.set(Q), $.uniformMatrix2fv(this.addr, !1, xP), S0(U, Q));
  }
}
function rc($, J) {
  let U = this.cache,
    Q = J.elements;
  if (Q === void 0) {
    if (_0(U, J)) return;
    ($.uniformMatrix3fv(this.addr, !1, J), S0(U, J));
  } else {
    if (_0(U, Q)) return;
    (yP.set(Q), $.uniformMatrix3fv(this.addr, !1, yP), S0(U, Q));
  }
}
function sc($, J) {
  let U = this.cache,
    Q = J.elements;
  if (Q === void 0) {
    if (_0(U, J)) return;
    ($.uniformMatrix4fv(this.addr, !1, J), S0(U, J));
  } else {
    if (_0(U, Q)) return;
    (fP.set(Q), $.uniformMatrix4fv(this.addr, !1, fP), S0(U, Q));
  }
}
function ac($, J) {
  let U = this.cache;
  if (U[0] === J) return;
  ($.uniform1i(this.addr, J), (U[0] = J));
}
function tc($, J) {
  let U = this.cache;
  if (J.x !== void 0) {
    if (U[0] !== J.x || U[1] !== J.y) ($.uniform2i(this.addr, J.x, J.y), (U[0] = J.x), (U[1] = J.y));
  } else {
    if (_0(U, J)) return;
    ($.uniform2iv(this.addr, J), S0(U, J));
  }
}
function ec($, J) {
  let U = this.cache;
  if (J.x !== void 0) {
    if (U[0] !== J.x || U[1] !== J.y || U[2] !== J.z)
      ($.uniform3i(this.addr, J.x, J.y, J.z), (U[0] = J.x), (U[1] = J.y), (U[2] = J.z));
  } else {
    if (_0(U, J)) return;
    ($.uniform3iv(this.addr, J), S0(U, J));
  }
}
function $n($, J) {
  let U = this.cache;
  if (J.x !== void 0) {
    if (U[0] !== J.x || U[1] !== J.y || U[2] !== J.z || U[3] !== J.w)
      ($.uniform4i(this.addr, J.x, J.y, J.z, J.w), (U[0] = J.x), (U[1] = J.y), (U[2] = J.z), (U[3] = J.w));
  } else {
    if (_0(U, J)) return;
    ($.uniform4iv(this.addr, J), S0(U, J));
  }
}
function Jn($, J) {
  let U = this.cache;
  if (U[0] === J) return;
  ($.uniform1ui(this.addr, J), (U[0] = J));
}
function Un($, J) {
  let U = this.cache;
  if (J.x !== void 0) {
    if (U[0] !== J.x || U[1] !== J.y) ($.uniform2ui(this.addr, J.x, J.y), (U[0] = J.x), (U[1] = J.y));
  } else {
    if (_0(U, J)) return;
    ($.uniform2uiv(this.addr, J), S0(U, J));
  }
}
function Wn($, J) {
  let U = this.cache;
  if (J.x !== void 0) {
    if (U[0] !== J.x || U[1] !== J.y || U[2] !== J.z)
      ($.uniform3ui(this.addr, J.x, J.y, J.z), (U[0] = J.x), (U[1] = J.y), (U[2] = J.z));
  } else {
    if (_0(U, J)) return;
    ($.uniform3uiv(this.addr, J), S0(U, J));
  }
}
function Qn($, J) {
  let U = this.cache;
  if (J.x !== void 0) {
    if (U[0] !== J.x || U[1] !== J.y || U[2] !== J.z || U[3] !== J.w)
      ($.uniform4ui(this.addr, J.x, J.y, J.z, J.w), (U[0] = J.x), (U[1] = J.y), (U[2] = J.z), (U[3] = J.w));
  } else {
    if (_0(U, J)) return;
    ($.uniform4uiv(this.addr, J), S0(U, J));
  }
}
function Xn($, J, U) {
  let Q = this.cache,
    W = U.allocateTextureUnit();
  if (Q[0] !== W) ($.uniform1i(this.addr, W), (Q[0] = W));
  let X;
  if (this.type === $.SAMPLER_2D_SHADOW) ((CE.compareFunction = U.isReversedDepthBuffer() ? VG : IG), (X = CE));
  else X = tP;
  U.setTexture2D(J || X, W);
}
function Yn($, J, U) {
  let Q = this.cache,
    W = U.allocateTextureUnit();
  if (Q[0] !== W) ($.uniform1i(this.addr, W), (Q[0] = W));
  U.setTexture3D(J || $_, W);
}
function Dn($, J, U) {
  let Q = this.cache,
    W = U.allocateTextureUnit();
  if (Q[0] !== W) ($.uniform1i(this.addr, W), (Q[0] = W));
  U.setTextureCube(J || J_, W);
}
function Hn($, J, U) {
  let Q = this.cache,
    W = U.allocateTextureUnit();
  if (Q[0] !== W) ($.uniform1i(this.addr, W), (Q[0] = W));
  U.setTexture2DArray(J || eP, W);
}
function Gn($) {
  switch ($) {
    case 5126:
      return dc;
    case 35664:
      return cc;
    case 35665:
      return nc;
    case 35666:
      return ic;
    case 35674:
      return oc;
    case 35675:
      return rc;
    case 35676:
      return sc;
    case 5124:
    case 35670:
      return ac;
    case 35667:
    case 35671:
      return tc;
    case 35668:
    case 35672:
      return ec;
    case 35669:
    case 35673:
      return $n;
    case 5125:
      return Jn;
    case 36294:
      return Un;
    case 36295:
      return Wn;
    case 36296:
      return Qn;
    case 35678:
    case 36198:
    case 36298:
    case 36306:
    case 35682:
      return Xn;
    case 35679:
    case 36299:
    case 36307:
      return Yn;
    case 35680:
    case 36300:
    case 36308:
    case 36293:
      return Dn;
    case 36289:
    case 36303:
    case 36311:
    case 36292:
      return Hn;
  }
}
function Kn($, J) {
  $.uniform1fv(this.addr, J);
}
function Nn($, J) {
  let U = o1(J, this.size, 2);
  $.uniform2fv(this.addr, U);
}
function On($, J) {
  let U = o1(J, this.size, 3);
  $.uniform3fv(this.addr, U);
}
function Fn($, J) {
  let U = o1(J, this.size, 4);
  $.uniform4fv(this.addr, U);
}
function qn($, J) {
  let U = o1(J, this.size, 4);
  $.uniformMatrix2fv(this.addr, !1, U);
}
function zn($, J) {
  let U = o1(J, this.size, 9);
  $.uniformMatrix3fv(this.addr, !1, U);
}
function Bn($, J) {
  let U = o1(J, this.size, 16);
  $.uniformMatrix4fv(this.addr, !1, U);
}
function En($, J) {
  $.uniform1iv(this.addr, J);
}
function Ln($, J) {
  $.uniform2iv(this.addr, J);
}
function wn($, J) {
  $.uniform3iv(this.addr, J);
}
function In($, J) {
  $.uniform4iv(this.addr, J);
}
function Vn($, J) {
  $.uniform1uiv(this.addr, J);
}
function kn($, J) {
  $.uniform2uiv(this.addr, J);
}
function An($, J) {
  $.uniform3uiv(this.addr, J);
}
function Mn($, J) {
  $.uniform4uiv(this.addr, J);
}
function Rn($, J, U) {
  let Q = this.cache,
    W = J.length,
    X = mG(U, W);
  if (!_0(Q, X)) ($.uniform1iv(this.addr, X), S0(Q, X));
  let Y;
  if (this.type === $.SAMPLER_2D_SHADOW) Y = CE;
  else Y = tP;
  for (let D = 0; D !== W; ++D) U.setTexture2D(J[D] || Y, X[D]);
}
function Zn($, J, U) {
  let Q = this.cache,
    W = J.length,
    X = mG(U, W);
  if (!_0(Q, X)) ($.uniform1iv(this.addr, X), S0(Q, X));
  for (let Y = 0; Y !== W; ++Y) U.setTexture3D(J[Y] || $_, X[Y]);
}
function Pn($, J, U) {
  let Q = this.cache,
    W = J.length,
    X = mG(U, W);
  if (!_0(Q, X)) ($.uniform1iv(this.addr, X), S0(Q, X));
  for (let Y = 0; Y !== W; ++Y) U.setTextureCube(J[Y] || J_, X[Y]);
}
function _n($, J, U) {
  let Q = this.cache,
    W = J.length,
    X = mG(U, W);
  if (!_0(Q, X)) ($.uniform1iv(this.addr, X), S0(Q, X));
  for (let Y = 0; Y !== W; ++Y) U.setTexture2DArray(J[Y] || eP, X[Y]);
}
function Sn($) {
  switch ($) {
    case 5126:
      return Kn;
    case 35664:
      return Nn;
    case 35665:
      return On;
    case 35666:
      return Fn;
    case 35674:
      return qn;
    case 35675:
      return zn;
    case 35676:
      return Bn;
    case 5124:
    case 35670:
      return En;
    case 35667:
    case 35671:
      return Ln;
    case 35668:
    case 35672:
      return wn;
    case 35669:
    case 35673:
      return In;
    case 5125:
      return Vn;
    case 36294:
      return kn;
    case 36295:
      return An;
    case 36296:
      return Mn;
    case 35678:
    case 36198:
    case 36298:
    case 36306:
    case 35682:
      return Rn;
    case 35679:
    case 36299:
    case 36307:
      return Zn;
    case 35680:
    case 36300:
    case 36308:
    case 36293:
      return Pn;
    case 36289:
    case 36303:
    case 36311:
    case 36292:
      return _n;
  }
}
class U_ {
  constructor($, J, U) {
    ((this.id = $), (this.addr = U), (this.cache = []), (this.type = J.type), (this.setValue = Gn(J.type)));
  }
}
class W_ {
  constructor($, J, U) {
    ((this.id = $),
      (this.addr = U),
      (this.cache = []),
      (this.type = J.type),
      (this.size = J.size),
      (this.setValue = Sn(J.type)));
  }
}
class Q_ {
  constructor($) {
    ((this.id = $), (this.seq = []), (this.map = {}));
  }
  setValue($, J, U) {
    let Q = this.seq;
    for (let W = 0, X = Q.length; W !== X; ++W) {
      let Y = Q[W];
      Y.setValue($, J[Y.id], U);
    }
  }
}
var PE = /(\w+)(\])?(\[|\.)?/g;
function gP($, J) {
  ($.seq.push(J), ($.map[J.id] = J));
}
function Cn($, J, U) {
  let Q = $.name,
    W = Q.length;
  PE.lastIndex = 0;
  while (!0) {
    let X = PE.exec(Q),
      Y = PE.lastIndex,
      D = X[1],
      H = X[2] === "]",
      G = X[3];
    if (H) D = D | 0;
    if (G === void 0 || (G === "[" && Y + 2 === W)) {
      gP(U, G === void 0 ? new U_(D, $, J) : new W_(D, $, J));
      break;
    } else {
      let O = U.map[D];
      if (O === void 0) ((O = new Q_(D)), gP(U, O));
      U = O;
    }
  }
}
class RX {
  constructor($, J) {
    ((this.seq = []), (this.map = {}));
    let U = $.getProgramParameter(J, $.ACTIVE_UNIFORMS);
    for (let X = 0; X < U; ++X) {
      let Y = $.getActiveUniform(J, X),
        D = $.getUniformLocation(J, Y.name);
      Cn(Y, D, this);
    }
    let Q = [],
      W = [];
    for (let X of this.seq)
      if (X.type === $.SAMPLER_2D_SHADOW || X.type === $.SAMPLER_CUBE_SHADOW || X.type === $.SAMPLER_2D_ARRAY_SHADOW)
        Q.push(X);
      else W.push(X);
    if (Q.length > 0) this.seq = Q.concat(W);
  }
  setValue($, J, U, Q) {
    let W = this.map[J];
    if (W !== void 0) W.setValue($, U, Q);
  }
  setOptional($, J, U) {
    let Q = J[U];
    if (Q !== void 0) this.setValue($, U, Q);
  }
  static upload($, J, U, Q) {
    for (let W = 0, X = J.length; W !== X; ++W) {
      let Y = J[W],
        D = U[Y.id];
      if (D.needsUpdate !== !1) Y.setValue($, D.value, Q);
    }
  }
  static seqWithValue($, J) {
    let U = [];
    for (let Q = 0, W = $.length; Q !== W; ++Q) {
      let X = $[Q];
      if (X.id in J) U.push(X);
    }
    return U;
  }
}
function hP($, J, U) {
  let Q = $.createShader(J);
  return ($.shaderSource(Q, U), $.compileShader(Q), Q);
}
var Tn = 37297,
  jn = 0;
function vn($, J) {
  let U = $.split(`
`),
    Q = [],
    W = Math.max(J - 6, 0),
    X = Math.min(J + 6, U.length);
  for (let Y = W; Y < X; Y++) {
    let D = Y + 1;
    Q.push(`${D === J ? ">" : " "} ${D}: ${U[Y]}`);
  }
  return Q.join(`
`);
}
var uP = new X6();
function bn($) {
  R6._getMatrix(uP, R6.workingColorSpace, $);
  let J = `mat3( ${uP.elements.map((U) => U.toFixed(4))} )`;
  switch (R6.getTransfer($)) {
    case nB:
      return [J, "LinearTransferOETF"];
    case W0:
      return [J, "sRGBTransferOETF"];
    default:
      return (i$("WebGLProgram: Unsupported color space: ", $), [J, "LinearTransferOETF"]);
  }
}
function lP($, J, U) {
  let Q = $.getShaderParameter(J, $.COMPILE_STATUS),
    X = ($.getShaderInfoLog(J) || "").trim();
  if (Q && X === "") return "";
  let Y = /ERROR: 0:(\d+)/.exec(X);
  if (Y) {
    let D = parseInt(Y[1]);
    return (
      U.toUpperCase() +
      `

` +
      X +
      `

` +
      vn($.getShaderSource(J), D)
    );
  } else return X;
}
function fn($, J) {
  let U = bn(J);
  return [`vec4 ${$}( vec4 value ) {`, `	return ${U[1]}( vec4( value.rgb * ${U[0]}, value.a ) );`, "}"].join(`
`);
}
var yn = {
  [JB]: "Linear",
  [UB]: "Reinhard",
  [WB]: "Cineon",
  [QB]: "ACESFilmic",
  [YB]: "AgX",
  [DB]: "Neutral",
  [XB]: "Custom",
};
function xn($, J) {
  let U = yn[J];
  if (U === void 0)
    return (
      i$("WebGLProgram: Unsupported toneMapping:", J),
      "vec3 " + $ + "( vec3 color ) { return LinearToneMapping( color ); }"
    );
  return "vec3 " + $ + "( vec3 color ) { return " + U + "ToneMapping( color ); }";
}
var uG = new C();
function gn() {
  R6.getLuminanceCoefficients(uG);
  let $ = uG.x.toFixed(4),
    J = uG.y.toFixed(4),
    U = uG.z.toFixed(4);
  return [
    "float luminance( const in vec3 rgb ) {",
    `	const vec3 weights = vec3( ${$}, ${J}, ${U} );`,
    "\treturn dot( weights, rgb );",
    "}",
  ].join(`
`);
}
function hn($) {
  return [
    $.extensionClipCullDistance ? "#extension GL_ANGLE_clip_cull_distance : require" : "",
    $.extensionMultiDraw ? "#extension GL_ANGLE_multi_draw : require" : "",
  ].filter(MX).join(`
`);
}
function un($) {
  let J = [];
  for (let U in $) {
    let Q = $[U];
    if (Q === !1) continue;
    J.push("#define " + U + " " + Q);
  }
  return J.join(`
`);
}
function ln($, J) {
  let U = {},
    Q = $.getProgramParameter(J, $.ACTIVE_ATTRIBUTES);
  for (let W = 0; W < Q; W++) {
    let X = $.getActiveAttrib(J, W),
      Y = X.name,
      D = 1;
    if (X.type === $.FLOAT_MAT2) D = 2;
    if (X.type === $.FLOAT_MAT3) D = 3;
    if (X.type === $.FLOAT_MAT4) D = 4;
    U[Y] = { type: X.type, location: $.getAttribLocation(J, Y), locationSize: D };
  }
  return U;
}
function MX($) {
  return $ !== "";
}
function mP($, J) {
  let U = J.numSpotLightShadows + J.numSpotLightMaps - J.numSpotLightShadowsWithMaps;
  return $.replace(/NUM_DIR_LIGHTS/g, J.numDirLights)
    .replace(/NUM_SPOT_LIGHTS/g, J.numSpotLights)
    .replace(/NUM_SPOT_LIGHT_MAPS/g, J.numSpotLightMaps)
    .replace(/NUM_SPOT_LIGHT_COORDS/g, U)
    .replace(/NUM_RECT_AREA_LIGHTS/g, J.numRectAreaLights)
    .replace(/NUM_POINT_LIGHTS/g, J.numPointLights)
    .replace(/NUM_HEMI_LIGHTS/g, J.numHemiLights)
    .replace(/NUM_DIR_LIGHT_SHADOWS/g, J.numDirLightShadows)
    .replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g, J.numSpotLightShadowsWithMaps)
    .replace(/NUM_SPOT_LIGHT_SHADOWS/g, J.numSpotLightShadows)
    .replace(/NUM_POINT_LIGHT_SHADOWS/g, J.numPointLightShadows);
}
function pP($, J) {
  return $.replace(/NUM_CLIPPING_PLANES/g, J.numClippingPlanes).replace(
    /UNION_CLIPPING_PLANES/g,
    J.numClippingPlanes - J.numClipIntersection,
  );
}
var mn = /^[ \t]*#include +<([\w\d./]+)>/gm;
function TE($) {
  return $.replace(mn, dn);
}
var pn = new Map();
function dn($, J) {
  let U = z6[J];
  if (U === void 0) {
    let Q = pn.get(J);
    if (Q !== void 0)
      ((U = z6[Q]), i$('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.', J, Q));
    else throw Error("Can not resolve #include <" + J + ">");
  }
  return TE(U);
}
var cn =
  /#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;
function dP($) {
  return $.replace(cn, nn);
}
function nn($, J, U, Q) {
  let W = "";
  for (let X = parseInt(J); X < parseInt(U); X++)
    W += Q.replace(/\[\s*i\s*\]/g, "[ " + X + " ]").replace(/UNROLLED_LOOP_INDEX/g, X);
  return W;
}
function cP($) {
  let J = `precision ${$.precision} float;
	precision ${$.precision} int;
	precision ${$.precision} sampler2D;
	precision ${$.precision} samplerCube;
	precision ${$.precision} sampler3D;
	precision ${$.precision} sampler2DArray;
	precision ${$.precision} sampler2DShadow;
	precision ${$.precision} samplerCubeShadow;
	precision ${$.precision} sampler2DArrayShadow;
	precision ${$.precision} isampler2D;
	precision ${$.precision} isampler3D;
	precision ${$.precision} isamplerCube;
	precision ${$.precision} isampler2DArray;
	precision ${$.precision} usampler2D;
	precision ${$.precision} usampler3D;
	precision ${$.precision} usamplerCube;
	precision ${$.precision} usampler2DArray;
	`;
  if ($.precision === "highp")
    J += `
#define HIGH_PRECISION`;
  else if ($.precision === "mediump")
    J += `
#define MEDIUM_PRECISION`;
  else if ($.precision === "lowp")
    J += `
#define LOW_PRECISION`;
  return J;
}
var on = { [DX]: "SHADOWMAP_TYPE_PCF", [x1]: "SHADOWMAP_TYPE_VSM" };
function rn($) {
  return on[$.shadowMapType] || "SHADOWMAP_TYPE_BASIC";
}
var sn = { [u1]: "ENVMAP_TYPE_CUBE", [x9]: "ENVMAP_TYPE_CUBE", [GX]: "ENVMAP_TYPE_CUBE_UV" };
function an($) {
  if ($.envMap === !1) return "ENVMAP_TYPE_CUBE";
  return sn[$.envMapMode] || "ENVMAP_TYPE_CUBE";
}
var tn = { [x9]: "ENVMAP_MODE_REFRACTION" };
function en($) {
  if ($.envMap === !1) return "ENVMAP_MODE_REFLECTION";
  return tn[$.envMapMode] || "ENVMAP_MODE_REFLECTION";
}
var $i = { [aZ]: "ENVMAP_BLENDING_MULTIPLY", [tZ]: "ENVMAP_BLENDING_MIX", [eZ]: "ENVMAP_BLENDING_ADD" };
function Ji($) {
  if ($.envMap === !1) return "ENVMAP_BLENDING_NONE";
  return $i[$.combine] || "ENVMAP_BLENDING_NONE";
}
function Ui($) {
  let J = $.envMapCubeUVHeight;
  if (J === null) return null;
  let U = Math.log2(J) - 2,
    Q = 1 / J;
  return { texelWidth: 1 / (3 * Math.max(Math.pow(2, U), 112)), texelHeight: Q, maxMip: U };
}
function Wi($, J, U, Q) {
  let W = $.getContext(),
    X = U.defines,
    Y = U.vertexShader,
    D = U.fragmentShader,
    H = rn(U),
    G = an(U),
    K = en(U),
    O = Ji(U),
    N = Ui(U),
    F = hn(U),
    B = un(X),
    E = W.createProgram(),
    z,
    q,
    L = U.glslVersion
      ? "#version " +
        U.glslVersion +
        `
`
      : "";
  if (U.isRawShaderMaterial) {
    if (
      ((z = ["#define SHADER_TYPE " + U.shaderType, "#define SHADER_NAME " + U.shaderName, B].filter(MX).join(`
`)),
      z.length > 0)
    )
      z += `
`;
    if (
      ((q = ["#define SHADER_TYPE " + U.shaderType, "#define SHADER_NAME " + U.shaderName, B].filter(MX).join(`
`)),
      q.length > 0)
    )
      q += `
`;
  } else
    ((z = [
      cP(U),
      "#define SHADER_TYPE " + U.shaderType,
      "#define SHADER_NAME " + U.shaderName,
      B,
      U.extensionClipCullDistance ? "#define USE_CLIP_DISTANCE" : "",
      U.batching ? "#define USE_BATCHING" : "",
      U.batchingColor ? "#define USE_BATCHING_COLOR" : "",
      U.instancing ? "#define USE_INSTANCING" : "",
      U.instancingColor ? "#define USE_INSTANCING_COLOR" : "",
      U.instancingMorph ? "#define USE_INSTANCING_MORPH" : "",
      U.useFog && U.fog ? "#define USE_FOG" : "",
      U.useFog && U.fogExp2 ? "#define FOG_EXP2" : "",
      U.map ? "#define USE_MAP" : "",
      U.envMap ? "#define USE_ENVMAP" : "",
      U.envMap ? "#define " + K : "",
      U.lightMap ? "#define USE_LIGHTMAP" : "",
      U.aoMap ? "#define USE_AOMAP" : "",
      U.bumpMap ? "#define USE_BUMPMAP" : "",
      U.normalMap ? "#define USE_NORMALMAP" : "",
      U.normalMapObjectSpace ? "#define USE_NORMALMAP_OBJECTSPACE" : "",
      U.normalMapTangentSpace ? "#define USE_NORMALMAP_TANGENTSPACE" : "",
      U.displacementMap ? "#define USE_DISPLACEMENTMAP" : "",
      U.emissiveMap ? "#define USE_EMISSIVEMAP" : "",
      U.anisotropy ? "#define USE_ANISOTROPY" : "",
      U.anisotropyMap ? "#define USE_ANISOTROPYMAP" : "",
      U.clearcoatMap ? "#define USE_CLEARCOATMAP" : "",
      U.clearcoatRoughnessMap ? "#define USE_CLEARCOAT_ROUGHNESSMAP" : "",
      U.clearcoatNormalMap ? "#define USE_CLEARCOAT_NORMALMAP" : "",
      U.iridescenceMap ? "#define USE_IRIDESCENCEMAP" : "",
      U.iridescenceThicknessMap ? "#define USE_IRIDESCENCE_THICKNESSMAP" : "",
      U.specularMap ? "#define USE_SPECULARMAP" : "",
      U.specularColorMap ? "#define USE_SPECULAR_COLORMAP" : "",
      U.specularIntensityMap ? "#define USE_SPECULAR_INTENSITYMAP" : "",
      U.roughnessMap ? "#define USE_ROUGHNESSMAP" : "",
      U.metalnessMap ? "#define USE_METALNESSMAP" : "",
      U.alphaMap ? "#define USE_ALPHAMAP" : "",
      U.alphaHash ? "#define USE_ALPHAHASH" : "",
      U.transmission ? "#define USE_TRANSMISSION" : "",
      U.transmissionMap ? "#define USE_TRANSMISSIONMAP" : "",
      U.thicknessMap ? "#define USE_THICKNESSMAP" : "",
      U.sheenColorMap ? "#define USE_SHEEN_COLORMAP" : "",
      U.sheenRoughnessMap ? "#define USE_SHEEN_ROUGHNESSMAP" : "",
      U.mapUv ? "#define MAP_UV " + U.mapUv : "",
      U.alphaMapUv ? "#define ALPHAMAP_UV " + U.alphaMapUv : "",
      U.lightMapUv ? "#define LIGHTMAP_UV " + U.lightMapUv : "",
      U.aoMapUv ? "#define AOMAP_UV " + U.aoMapUv : "",
      U.emissiveMapUv ? "#define EMISSIVEMAP_UV " + U.emissiveMapUv : "",
      U.bumpMapUv ? "#define BUMPMAP_UV " + U.bumpMapUv : "",
      U.normalMapUv ? "#define NORMALMAP_UV " + U.normalMapUv : "",
      U.displacementMapUv ? "#define DISPLACEMENTMAP_UV " + U.displacementMapUv : "",
      U.metalnessMapUv ? "#define METALNESSMAP_UV " + U.metalnessMapUv : "",
      U.roughnessMapUv ? "#define ROUGHNESSMAP_UV " + U.roughnessMapUv : "",
      U.anisotropyMapUv ? "#define ANISOTROPYMAP_UV " + U.anisotropyMapUv : "",
      U.clearcoatMapUv ? "#define CLEARCOATMAP_UV " + U.clearcoatMapUv : "",
      U.clearcoatNormalMapUv ? "#define CLEARCOAT_NORMALMAP_UV " + U.clearcoatNormalMapUv : "",
      U.clearcoatRoughnessMapUv ? "#define CLEARCOAT_ROUGHNESSMAP_UV " + U.clearcoatRoughnessMapUv : "",
      U.iridescenceMapUv ? "#define IRIDESCENCEMAP_UV " + U.iridescenceMapUv : "",
      U.iridescenceThicknessMapUv ? "#define IRIDESCENCE_THICKNESSMAP_UV " + U.iridescenceThicknessMapUv : "",
      U.sheenColorMapUv ? "#define SHEEN_COLORMAP_UV " + U.sheenColorMapUv : "",
      U.sheenRoughnessMapUv ? "#define SHEEN_ROUGHNESSMAP_UV " + U.sheenRoughnessMapUv : "",
      U.specularMapUv ? "#define SPECULARMAP_UV " + U.specularMapUv : "",
      U.specularColorMapUv ? "#define SPECULAR_COLORMAP_UV " + U.specularColorMapUv : "",
      U.specularIntensityMapUv ? "#define SPECULAR_INTENSITYMAP_UV " + U.specularIntensityMapUv : "",
      U.transmissionMapUv ? "#define TRANSMISSIONMAP_UV " + U.transmissionMapUv : "",
      U.thicknessMapUv ? "#define THICKNESSMAP_UV " + U.thicknessMapUv : "",
      U.vertexTangents && U.flatShading === !1 ? "#define USE_TANGENT" : "",
      U.vertexNormals ? "#define HAS_NORMAL" : "",
      U.vertexColors ? "#define USE_COLOR" : "",
      U.vertexAlphas ? "#define USE_COLOR_ALPHA" : "",
      U.vertexUv1s ? "#define USE_UV1" : "",
      U.vertexUv2s ? "#define USE_UV2" : "",
      U.vertexUv3s ? "#define USE_UV3" : "",
      U.pointsUvs ? "#define USE_POINTS_UV" : "",
      U.flatShading ? "#define FLAT_SHADED" : "",
      U.skinning ? "#define USE_SKINNING" : "",
      U.morphTargets ? "#define USE_MORPHTARGETS" : "",
      U.morphNormals && U.flatShading === !1 ? "#define USE_MORPHNORMALS" : "",
      U.morphColors ? "#define USE_MORPHCOLORS" : "",
      U.morphTargetsCount > 0 ? "#define MORPHTARGETS_TEXTURE_STRIDE " + U.morphTextureStride : "",
      U.morphTargetsCount > 0 ? "#define MORPHTARGETS_COUNT " + U.morphTargetsCount : "",
      U.doubleSided ? "#define DOUBLE_SIDED" : "",
      U.flipSided ? "#define FLIP_SIDED" : "",
      U.shadowMapEnabled ? "#define USE_SHADOWMAP" : "",
      U.shadowMapEnabled ? "#define " + H : "",
      U.sizeAttenuation ? "#define USE_SIZEATTENUATION" : "",
      U.numLightProbes > 0 ? "#define USE_LIGHT_PROBES" : "",
      U.logarithmicDepthBuffer ? "#define USE_LOGARITHMIC_DEPTH_BUFFER" : "",
      U.reversedDepthBuffer ? "#define USE_REVERSED_DEPTH_BUFFER" : "",
      "uniform mat4 modelMatrix;",
      "uniform mat4 modelViewMatrix;",
      "uniform mat4 projectionMatrix;",
      "uniform mat4 viewMatrix;",
      "uniform mat3 normalMatrix;",
      "uniform vec3 cameraPosition;",
      "uniform bool isOrthographic;",
      "#ifdef USE_INSTANCING",
      "\tattribute mat4 instanceMatrix;",
      "#endif",
      "#ifdef USE_INSTANCING_COLOR",
      "\tattribute vec3 instanceColor;",
      "#endif",
      "#ifdef USE_INSTANCING_MORPH",
      "\tuniform sampler2D morphTexture;",
      "#endif",
      "attribute vec3 position;",
      "attribute vec3 normal;",
      "attribute vec2 uv;",
      "#ifdef USE_UV1",
      "\tattribute vec2 uv1;",
      "#endif",
      "#ifdef USE_UV2",
      "\tattribute vec2 uv2;",
      "#endif",
      "#ifdef USE_UV3",
      "\tattribute vec2 uv3;",
      "#endif",
      "#ifdef USE_TANGENT",
      "\tattribute vec4 tangent;",
      "#endif",
      "#if defined( USE_COLOR_ALPHA )",
      "\tattribute vec4 color;",
      "#elif defined( USE_COLOR )",
      "\tattribute vec3 color;",
      "#endif",
      "#ifdef USE_SKINNING",
      "\tattribute vec4 skinIndex;",
      "\tattribute vec4 skinWeight;",
      "#endif",
      `
`,
    ].filter(MX).join(`
`)),
      (q = [
        cP(U),
        "#define SHADER_TYPE " + U.shaderType,
        "#define SHADER_NAME " + U.shaderName,
        B,
        U.useFog && U.fog ? "#define USE_FOG" : "",
        U.useFog && U.fogExp2 ? "#define FOG_EXP2" : "",
        U.alphaToCoverage ? "#define ALPHA_TO_COVERAGE" : "",
        U.map ? "#define USE_MAP" : "",
        U.matcap ? "#define USE_MATCAP" : "",
        U.envMap ? "#define USE_ENVMAP" : "",
        U.envMap ? "#define " + G : "",
        U.envMap ? "#define " + K : "",
        U.envMap ? "#define " + O : "",
        N ? "#define CUBEUV_TEXEL_WIDTH " + N.texelWidth : "",
        N ? "#define CUBEUV_TEXEL_HEIGHT " + N.texelHeight : "",
        N ? "#define CUBEUV_MAX_MIP " + N.maxMip + ".0" : "",
        U.lightMap ? "#define USE_LIGHTMAP" : "",
        U.aoMap ? "#define USE_AOMAP" : "",
        U.bumpMap ? "#define USE_BUMPMAP" : "",
        U.normalMap ? "#define USE_NORMALMAP" : "",
        U.normalMapObjectSpace ? "#define USE_NORMALMAP_OBJECTSPACE" : "",
        U.normalMapTangentSpace ? "#define USE_NORMALMAP_TANGENTSPACE" : "",
        U.packedNormalMap ? "#define USE_PACKED_NORMALMAP" : "",
        U.emissiveMap ? "#define USE_EMISSIVEMAP" : "",
        U.anisotropy ? "#define USE_ANISOTROPY" : "",
        U.anisotropyMap ? "#define USE_ANISOTROPYMAP" : "",
        U.clearcoat ? "#define USE_CLEARCOAT" : "",
        U.clearcoatMap ? "#define USE_CLEARCOATMAP" : "",
        U.clearcoatRoughnessMap ? "#define USE_CLEARCOAT_ROUGHNESSMAP" : "",
        U.clearcoatNormalMap ? "#define USE_CLEARCOAT_NORMALMAP" : "",
        U.dispersion ? "#define USE_DISPERSION" : "",
        U.iridescence ? "#define USE_IRIDESCENCE" : "",
        U.iridescenceMap ? "#define USE_IRIDESCENCEMAP" : "",
        U.iridescenceThicknessMap ? "#define USE_IRIDESCENCE_THICKNESSMAP" : "",
        U.specularMap ? "#define USE_SPECULARMAP" : "",
        U.specularColorMap ? "#define USE_SPECULAR_COLORMAP" : "",
        U.specularIntensityMap ? "#define USE_SPECULAR_INTENSITYMAP" : "",
        U.roughnessMap ? "#define USE_ROUGHNESSMAP" : "",
        U.metalnessMap ? "#define USE_METALNESSMAP" : "",
        U.alphaMap ? "#define USE_ALPHAMAP" : "",
        U.alphaTest ? "#define USE_ALPHATEST" : "",
        U.alphaHash ? "#define USE_ALPHAHASH" : "",
        U.sheen ? "#define USE_SHEEN" : "",
        U.sheenColorMap ? "#define USE_SHEEN_COLORMAP" : "",
        U.sheenRoughnessMap ? "#define USE_SHEEN_ROUGHNESSMAP" : "",
        U.transmission ? "#define USE_TRANSMISSION" : "",
        U.transmissionMap ? "#define USE_TRANSMISSIONMAP" : "",
        U.thicknessMap ? "#define USE_THICKNESSMAP" : "",
        U.vertexTangents && U.flatShading === !1 ? "#define USE_TANGENT" : "",
        U.vertexColors || U.instancingColor ? "#define USE_COLOR" : "",
        U.vertexAlphas || U.batchingColor ? "#define USE_COLOR_ALPHA" : "",
        U.vertexUv1s ? "#define USE_UV1" : "",
        U.vertexUv2s ? "#define USE_UV2" : "",
        U.vertexUv3s ? "#define USE_UV3" : "",
        U.pointsUvs ? "#define USE_POINTS_UV" : "",
        U.gradientMap ? "#define USE_GRADIENTMAP" : "",
        U.flatShading ? "#define FLAT_SHADED" : "",
        U.doubleSided ? "#define DOUBLE_SIDED" : "",
        U.flipSided ? "#define FLIP_SIDED" : "",
        U.shadowMapEnabled ? "#define USE_SHADOWMAP" : "",
        U.shadowMapEnabled ? "#define " + H : "",
        U.premultipliedAlpha ? "#define PREMULTIPLIED_ALPHA" : "",
        U.numLightProbes > 0 ? "#define USE_LIGHT_PROBES" : "",
        U.numLightProbeGrids > 0 ? "#define USE_LIGHT_PROBES_GRID" : "",
        U.decodeVideoTexture ? "#define DECODE_VIDEO_TEXTURE" : "",
        U.decodeVideoTextureEmissive ? "#define DECODE_VIDEO_TEXTURE_EMISSIVE" : "",
        U.logarithmicDepthBuffer ? "#define USE_LOGARITHMIC_DEPTH_BUFFER" : "",
        U.reversedDepthBuffer ? "#define USE_REVERSED_DEPTH_BUFFER" : "",
        "uniform mat4 viewMatrix;",
        "uniform vec3 cameraPosition;",
        "uniform bool isOrthographic;",
        U.toneMapping !== OU ? "#define TONE_MAPPING" : "",
        U.toneMapping !== OU ? z6.tonemapping_pars_fragment : "",
        U.toneMapping !== OU ? xn("toneMapping", U.toneMapping) : "",
        U.dithering ? "#define DITHERING" : "",
        U.opaque ? "#define OPAQUE" : "",
        z6.colorspace_pars_fragment,
        fn("linearToOutputTexel", U.outputColorSpace),
        gn(),
        U.useDepthPacking ? "#define DEPTH_PACKING " + U.depthPacking : "",
        `
`,
      ].filter(MX).join(`
`)));
  if (
    ((Y = TE(Y)),
    (Y = mP(Y, U)),
    (Y = pP(Y, U)),
    (D = TE(D)),
    (D = mP(D, U)),
    (D = pP(D, U)),
    (Y = dP(Y)),
    (D = dP(D)),
    U.isRawShaderMaterial !== !0)
  )
    ((L = `#version 300 es
`),
      (z =
        [F, "#define attribute in", "#define varying out", "#define texture2D texture"].join(`
`) +
        `
` +
        z),
      (q =
        [
          "#define varying in",
          U.glslVersion === iB ? "" : "layout(location = 0) out highp vec4 pc_fragColor;",
          U.glslVersion === iB ? "" : "#define gl_FragColor pc_fragColor",
          "#define gl_FragDepthEXT gl_FragDepth",
          "#define texture2D texture",
          "#define textureCube texture",
          "#define texture2DProj textureProj",
          "#define texture2DLodEXT textureLod",
          "#define texture2DProjLodEXT textureProjLod",
          "#define textureCubeLodEXT textureLod",
          "#define texture2DGradEXT textureGrad",
          "#define texture2DProjGradEXT textureProjGrad",
          "#define textureCubeGradEXT textureGrad",
        ].join(`
`) +
        `
` +
        q));
  let V = L + z + Y,
    k = L + q + D,
    R = hP(W, W.VERTEX_SHADER, V),
    _ = hP(W, W.FRAGMENT_SHADER, k);
  if ((W.attachShader(E, R), W.attachShader(E, _), U.index0AttributeName !== void 0))
    W.bindAttribLocation(E, 0, U.index0AttributeName);
  else if (U.morphTargets === !0) W.bindAttribLocation(E, 0, "position");
  W.linkProgram(E);
  function S(P) {
    if ($.debug.checkShaderErrors) {
      let u = W.getProgramInfoLog(E) || "",
        n = W.getShaderInfoLog(R) || "",
        b = W.getShaderInfoLog(_) || "",
        i = u.trim(),
        x = n.trim(),
        l = b.trim(),
        r = !0,
        G$ = !0;
      if (W.getProgramParameter(E, W.LINK_STATUS) === !1)
        if (((r = !1), typeof $.debug.onShaderError === "function")) $.debug.onShaderError(W, E, R, _);
        else {
          let k$ = lP(W, R, "vertex"),
            h$ = lP(W, _, "fragment");
          s$(
            "THREE.WebGLProgram: Shader Error " +
              W.getError() +
              " - VALIDATE_STATUS " +
              W.getProgramParameter(E, W.VALIDATE_STATUS) +
              `

Material Name: ` +
              P.name +
              `
Material Type: ` +
              P.type +
              `

Program Info Log: ` +
              i +
              `
` +
              k$ +
              `
` +
              h$,
          );
        }
      else if (i !== "") i$("WebGLProgram: Program Info Log:", i);
      else if (x === "" || l === "") G$ = !1;
      if (G$)
        P.diagnostics = {
          runnable: r,
          programLog: i,
          vertexShader: { log: x, prefix: z },
          fragmentShader: { log: l, prefix: q },
        };
    }
    (W.deleteShader(R), W.deleteShader(_), (w = new RX(W, E)), (M = ln(W, E)));
  }
  let w;
  this.getUniforms = function () {
    if (w === void 0) S(this);
    return w;
  };
  let M;
  this.getAttributes = function () {
    if (M === void 0) S(this);
    return M;
  };
  let m = U.rendererExtensionParallelShaderCompile === !1;
  return (
    (this.isReady = function () {
      if (m === !1) m = W.getProgramParameter(E, Tn);
      return m;
    }),
    (this.destroy = function () {
      (Q.releaseStatesOfProgram(this), W.deleteProgram(E), (this.program = void 0));
    }),
    (this.type = U.shaderType),
    (this.name = U.shaderName),
    (this.id = jn++),
    (this.cacheKey = J),
    (this.usedTimes = 1),
    (this.program = E),
    (this.vertexShader = R),
    (this.fragmentShader = _),
    this
  );
}
var Qi = 0;
class X_ {
  constructor() {
    ((this.shaderCache = new Map()), (this.materialCache = new Map()));
  }
  update($) {
    let { vertexShader: J, fragmentShader: U } = $,
      Q = this._getShaderStage(J),
      W = this._getShaderStage(U),
      X = this._getShaderCacheForMaterial($);
    if (X.has(Q) === !1) (X.add(Q), Q.usedTimes++);
    if (X.has(W) === !1) (X.add(W), W.usedTimes++);
    return this;
  }
  remove($) {
    let J = this.materialCache.get($);
    for (let U of J) if ((U.usedTimes--, U.usedTimes === 0)) this.shaderCache.delete(U.code);
    return (this.materialCache.delete($), this);
  }
  getVertexShaderID($) {
    return this._getShaderStage($.vertexShader).id;
  }
  getFragmentShaderID($) {
    return this._getShaderStage($.fragmentShader).id;
  }
  dispose() {
    (this.shaderCache.clear(), this.materialCache.clear());
  }
  _getShaderCacheForMaterial($) {
    let J = this.materialCache,
      U = J.get($);
    if (U === void 0) ((U = new Set()), J.set($, U));
    return U;
  }
  _getShaderStage($) {
    let J = this.shaderCache,
      U = J.get($);
    if (U === void 0) ((U = new Y_($)), J.set($, U));
    return U;
  }
}
class Y_ {
  constructor($) {
    ((this.id = Qi++), (this.code = $), (this.usedTimes = 0));
  }
}
function Xi($) {
  return $ === l9 || $ === LG || $ === wG;
}
function Yi($, J, U, Q, W, X) {
  let Y = new FX(),
    D = new X_(),
    H = new Set(),
    G = [],
    K = new Map(),
    O = Q.logarithmicDepthBuffer,
    N = Q.precision,
    F = {
      MeshDepthMaterial: "depth",
      MeshDistanceMaterial: "distance",
      MeshNormalMaterial: "normal",
      MeshBasicMaterial: "basic",
      MeshLambertMaterial: "lambert",
      MeshPhongMaterial: "phong",
      MeshToonMaterial: "toon",
      MeshStandardMaterial: "physical",
      MeshPhysicalMaterial: "physical",
      MeshMatcapMaterial: "matcap",
      LineBasicMaterial: "basic",
      LineDashedMaterial: "dashed",
      PointsMaterial: "points",
      ShadowMaterial: "shadow",
      SpriteMaterial: "sprite",
    };
  function B(w) {
    if ((H.add(w), w === 0)) return "uv";
    return `uv${w}`;
  }
  function E(w, M, m, P, u, n) {
    let b = P.fog,
      i = u.geometry,
      x = w.isMeshStandardMaterial || w.isMeshLambertMaterial || w.isMeshPhongMaterial ? P.environment : null,
      l = w.isMeshStandardMaterial || (w.isMeshLambertMaterial && !w.envMap) || (w.isMeshPhongMaterial && !w.envMap),
      r = J.get(w.envMap || x, l),
      G$ = !!r && r.mapping === GX ? r.image.height : null,
      k$ = F[w.type];
    if (w.precision !== null) {
      if (((N = Q.getMaxPrecision(w.precision)), N !== w.precision))
        i$("WebGLProgram.getParameters:", w.precision, "not supported, using", N, "instead.");
    }
    let h$ = i.morphAttributes.position || i.morphAttributes.normal || i.morphAttributes.color,
      b$ = h$ !== void 0 ? h$.length : 0,
      b6 = 0;
    if (i.morphAttributes.position !== void 0) b6 = 1;
    if (i.morphAttributes.normal !== void 0) b6 = 2;
    if (i.morphAttributes.color !== void 0) b6 = 3;
    let k6, a, Z$, u$;
    if (k$) {
      let Y6 = gU[k$];
      ((k6 = Y6.vertexShader), (a = Y6.fragmentShader));
    } else
      ((k6 = w.vertexShader),
        (a = w.fragmentShader),
        D.update(w),
        (Z$ = D.getVertexShaderID(w)),
        (u$ = D.getFragmentShaderID(w)));
    let S$ = $.getRenderTarget(),
      o$ = $.state.buffers.depth.getReversed(),
      y6 = u.isInstancedMesh === !0,
      B6 = u.isBatchedMesh === !0,
      A6 = !!w.map,
      a6 = !!w.matcap,
      t6 = !!r,
      F6 = !!w.aoMap,
      v0 = !!w.lightMap,
      m0 = !!w.bumpMap,
      M0 = !!w.normalMap,
      j = !!w.displacementMap,
      e0 = !!w.emissiveMap,
      Z6 = !!w.metalnessMap,
      f6 = !!w.roughnessMap,
      M$ = w.anisotropy > 0,
      O0 = w.clearcoat > 0,
      r$ = w.dispersion > 0,
      Z = w.iridescence > 0,
      I = w.sheen > 0,
      y = w.transmission > 0,
      e = M$ && !!w.anisotropyMap,
      J$ = O0 && !!w.clearcoatMap,
      K$ = O0 && !!w.clearcoatNormalMap,
      E$ = O0 && !!w.clearcoatRoughnessMap,
      o = Z && !!w.iridescenceMap,
      t = Z && !!w.iridescenceThicknessMap,
      z$ = I && !!w.sheenColorMap,
      j$ = I && !!w.sheenRoughnessMap,
      O$ = !!w.specularMap,
      L$ = !!w.specularColorMap,
      Q6 = !!w.specularIntensityMap,
      K6 = y && !!w.transmissionMap,
      E6 = y && !!w.thicknessMap,
      T = !!w.gradientMap,
      q$ = !!w.alphaMap,
      s = w.alphaTest > 0,
      N$ = !!w.alphaHash,
      v$ = !!w.extensions,
      W$ = OU;
    if (w.toneMapped) {
      if (S$ === null || S$.isXRRenderTarget === !0) W$ = $.toneMapping;
    }
    let l$ = {
      shaderID: k$,
      shaderType: w.type,
      shaderName: w.name,
      vertexShader: k6,
      fragmentShader: a,
      defines: w.defines,
      customVertexShaderID: Z$,
      customFragmentShaderID: u$,
      isRawShaderMaterial: w.isRawShaderMaterial === !0,
      glslVersion: w.glslVersion,
      precision: N,
      batching: B6,
      batchingColor: B6 && u._colorsTexture !== null,
      instancing: y6,
      instancingColor: y6 && u.instanceColor !== null,
      instancingMorph: y6 && u.morphTexture !== null,
      outputColorSpace:
        S$ === null ? $.outputColorSpace : S$.isXRRenderTarget === !0 ? S$.texture.colorSpace : R6.workingColorSpace,
      alphaToCoverage: !!w.alphaToCoverage,
      map: A6,
      matcap: a6,
      envMap: t6,
      envMapMode: t6 && r.mapping,
      envMapCubeUVHeight: G$,
      aoMap: F6,
      lightMap: v0,
      bumpMap: m0,
      normalMap: M0,
      displacementMap: j,
      emissiveMap: e0,
      normalMapObjectSpace: M0 && w.normalMapType === KP,
      normalMapTangentSpace: M0 && w.normalMapType === dB,
      packedNormalMap: M0 && w.normalMapType === dB && Xi(w.normalMap.format),
      metalnessMap: Z6,
      roughnessMap: f6,
      anisotropy: M$,
      anisotropyMap: e,
      clearcoat: O0,
      clearcoatMap: J$,
      clearcoatNormalMap: K$,
      clearcoatRoughnessMap: E$,
      dispersion: r$,
      iridescence: Z,
      iridescenceMap: o,
      iridescenceThicknessMap: t,
      sheen: I,
      sheenColorMap: z$,
      sheenRoughnessMap: j$,
      specularMap: O$,
      specularColorMap: L$,
      specularIntensityMap: Q6,
      transmission: y,
      transmissionMap: K6,
      thicknessMap: E6,
      gradientMap: T,
      opaque: w.transparent === !1 && w.blending === HX && w.alphaToCoverage === !1,
      alphaMap: q$,
      alphaTest: s,
      alphaHash: N$,
      combine: w.combine,
      mapUv: A6 && B(w.map.channel),
      aoMapUv: F6 && B(w.aoMap.channel),
      lightMapUv: v0 && B(w.lightMap.channel),
      bumpMapUv: m0 && B(w.bumpMap.channel),
      normalMapUv: M0 && B(w.normalMap.channel),
      displacementMapUv: j && B(w.displacementMap.channel),
      emissiveMapUv: e0 && B(w.emissiveMap.channel),
      metalnessMapUv: Z6 && B(w.metalnessMap.channel),
      roughnessMapUv: f6 && B(w.roughnessMap.channel),
      anisotropyMapUv: e && B(w.anisotropyMap.channel),
      clearcoatMapUv: J$ && B(w.clearcoatMap.channel),
      clearcoatNormalMapUv: K$ && B(w.clearcoatNormalMap.channel),
      clearcoatRoughnessMapUv: E$ && B(w.clearcoatRoughnessMap.channel),
      iridescenceMapUv: o && B(w.iridescenceMap.channel),
      iridescenceThicknessMapUv: t && B(w.iridescenceThicknessMap.channel),
      sheenColorMapUv: z$ && B(w.sheenColorMap.channel),
      sheenRoughnessMapUv: j$ && B(w.sheenRoughnessMap.channel),
      specularMapUv: O$ && B(w.specularMap.channel),
      specularColorMapUv: L$ && B(w.specularColorMap.channel),
      specularIntensityMapUv: Q6 && B(w.specularIntensityMap.channel),
      transmissionMapUv: K6 && B(w.transmissionMap.channel),
      thicknessMapUv: E6 && B(w.thicknessMap.channel),
      alphaMapUv: q$ && B(w.alphaMap.channel),
      vertexTangents: !!i.attributes.tangent && (M0 || M$),
      vertexNormals: !!i.attributes.normal,
      vertexColors: w.vertexColors,
      vertexAlphas: w.vertexColors === !0 && !!i.attributes.color && i.attributes.color.itemSize === 4,
      pointsUvs: u.isPoints === !0 && !!i.attributes.uv && (A6 || q$),
      fog: !!b,
      useFog: w.fog === !0,
      fogExp2: !!b && b.isFogExp2,
      flatShading:
        w.wireframe === !1 &&
        (w.flatShading === !0 ||
          (i.attributes.normal === void 0 &&
            M0 === !1 &&
            (w.isMeshLambertMaterial ||
              w.isMeshPhongMaterial ||
              w.isMeshStandardMaterial ||
              w.isMeshPhysicalMaterial))),
      sizeAttenuation: w.sizeAttenuation === !0,
      logarithmicDepthBuffer: O,
      reversedDepthBuffer: o$,
      skinning: u.isSkinnedMesh === !0,
      morphTargets: i.morphAttributes.position !== void 0,
      morphNormals: i.morphAttributes.normal !== void 0,
      morphColors: i.morphAttributes.color !== void 0,
      morphTargetsCount: b$,
      morphTextureStride: b6,
      numDirLights: M.directional.length,
      numPointLights: M.point.length,
      numSpotLights: M.spot.length,
      numSpotLightMaps: M.spotLightMap.length,
      numRectAreaLights: M.rectArea.length,
      numHemiLights: M.hemi.length,
      numDirLightShadows: M.directionalShadowMap.length,
      numPointLightShadows: M.pointShadowMap.length,
      numSpotLightShadows: M.spotShadowMap.length,
      numSpotLightShadowsWithMaps: M.numSpotLightShadowsWithMaps,
      numLightProbes: M.numLightProbes,
      numLightProbeGrids: n.length,
      numClippingPlanes: X.numPlanes,
      numClipIntersection: X.numIntersection,
      dithering: w.dithering,
      shadowMapEnabled: $.shadowMap.enabled && m.length > 0,
      shadowMapType: $.shadowMap.type,
      toneMapping: W$,
      decodeVideoTexture: A6 && w.map.isVideoTexture === !0 && R6.getTransfer(w.map.colorSpace) === W0,
      decodeVideoTextureEmissive:
        e0 && w.emissiveMap.isVideoTexture === !0 && R6.getTransfer(w.emissiveMap.colorSpace) === W0,
      premultipliedAlpha: w.premultipliedAlpha,
      doubleSided: w.side === AJ,
      flipSided: w.side === kJ,
      useDepthPacking: w.depthPacking >= 0,
      depthPacking: w.depthPacking || 0,
      index0AttributeName: w.index0AttributeName,
      extensionClipCullDistance: v$ && w.extensions.clipCullDistance === !0 && U.has("WEBGL_clip_cull_distance"),
      extensionMultiDraw: ((v$ && w.extensions.multiDraw === !0) || B6) && U.has("WEBGL_multi_draw"),
      rendererExtensionParallelShaderCompile: U.has("KHR_parallel_shader_compile"),
      customProgramCacheKey: w.customProgramCacheKey(),
    };
    return ((l$.vertexUv1s = H.has(1)), (l$.vertexUv2s = H.has(2)), (l$.vertexUv3s = H.has(3)), H.clear(), l$);
  }
  function z(w) {
    let M = [];
    if (w.shaderID) M.push(w.shaderID);
    else (M.push(w.customVertexShaderID), M.push(w.customFragmentShaderID));
    if (w.defines !== void 0) for (let m in w.defines) (M.push(m), M.push(w.defines[m]));
    if (w.isRawShaderMaterial === !1) (q(M, w), L(M, w), M.push($.outputColorSpace));
    return (M.push(w.customProgramCacheKey), M.join());
  }
  function q(w, M) {
    (w.push(M.precision),
      w.push(M.outputColorSpace),
      w.push(M.envMapMode),
      w.push(M.envMapCubeUVHeight),
      w.push(M.mapUv),
      w.push(M.alphaMapUv),
      w.push(M.lightMapUv),
      w.push(M.aoMapUv),
      w.push(M.bumpMapUv),
      w.push(M.normalMapUv),
      w.push(M.displacementMapUv),
      w.push(M.emissiveMapUv),
      w.push(M.metalnessMapUv),
      w.push(M.roughnessMapUv),
      w.push(M.anisotropyMapUv),
      w.push(M.clearcoatMapUv),
      w.push(M.clearcoatNormalMapUv),
      w.push(M.clearcoatRoughnessMapUv),
      w.push(M.iridescenceMapUv),
      w.push(M.iridescenceThicknessMapUv),
      w.push(M.sheenColorMapUv),
      w.push(M.sheenRoughnessMapUv),
      w.push(M.specularMapUv),
      w.push(M.specularColorMapUv),
      w.push(M.specularIntensityMapUv),
      w.push(M.transmissionMapUv),
      w.push(M.thicknessMapUv),
      w.push(M.combine),
      w.push(M.fogExp2),
      w.push(M.sizeAttenuation),
      w.push(M.morphTargetsCount),
      w.push(M.morphAttributeCount),
      w.push(M.numDirLights),
      w.push(M.numPointLights),
      w.push(M.numSpotLights),
      w.push(M.numSpotLightMaps),
      w.push(M.numHemiLights),
      w.push(M.numRectAreaLights),
      w.push(M.numDirLightShadows),
      w.push(M.numPointLightShadows),
      w.push(M.numSpotLightShadows),
      w.push(M.numSpotLightShadowsWithMaps),
      w.push(M.numLightProbes),
      w.push(M.shadowMapType),
      w.push(M.toneMapping),
      w.push(M.numClippingPlanes),
      w.push(M.numClipIntersection),
      w.push(M.depthPacking));
  }
  function L(w, M) {
    if ((Y.disableAll(), M.instancing)) Y.enable(0);
    if (M.instancingColor) Y.enable(1);
    if (M.instancingMorph) Y.enable(2);
    if (M.matcap) Y.enable(3);
    if (M.envMap) Y.enable(4);
    if (M.normalMapObjectSpace) Y.enable(5);
    if (M.normalMapTangentSpace) Y.enable(6);
    if (M.clearcoat) Y.enable(7);
    if (M.iridescence) Y.enable(8);
    if (M.alphaTest) Y.enable(9);
    if (M.vertexColors) Y.enable(10);
    if (M.vertexAlphas) Y.enable(11);
    if (M.vertexUv1s) Y.enable(12);
    if (M.vertexUv2s) Y.enable(13);
    if (M.vertexUv3s) Y.enable(14);
    if (M.vertexTangents) Y.enable(15);
    if (M.anisotropy) Y.enable(16);
    if (M.alphaHash) Y.enable(17);
    if (M.batching) Y.enable(18);
    if (M.dispersion) Y.enable(19);
    if (M.batchingColor) Y.enable(20);
    if (M.gradientMap) Y.enable(21);
    if (M.packedNormalMap) Y.enable(22);
    if (M.vertexNormals) Y.enable(23);
    if ((w.push(Y.mask), Y.disableAll(), M.fog)) Y.enable(0);
    if (M.useFog) Y.enable(1);
    if (M.flatShading) Y.enable(2);
    if (M.logarithmicDepthBuffer) Y.enable(3);
    if (M.reversedDepthBuffer) Y.enable(4);
    if (M.skinning) Y.enable(5);
    if (M.morphTargets) Y.enable(6);
    if (M.morphNormals) Y.enable(7);
    if (M.morphColors) Y.enable(8);
    if (M.premultipliedAlpha) Y.enable(9);
    if (M.shadowMapEnabled) Y.enable(10);
    if (M.doubleSided) Y.enable(11);
    if (M.flipSided) Y.enable(12);
    if (M.useDepthPacking) Y.enable(13);
    if (M.dithering) Y.enable(14);
    if (M.transmission) Y.enable(15);
    if (M.sheen) Y.enable(16);
    if (M.opaque) Y.enable(17);
    if (M.pointsUvs) Y.enable(18);
    if (M.decodeVideoTexture) Y.enable(19);
    if (M.decodeVideoTextureEmissive) Y.enable(20);
    if (M.alphaToCoverage) Y.enable(21);
    if (M.numLightProbeGrids > 0) Y.enable(22);
    w.push(Y.mask);
  }
  function V(w) {
    let M = F[w.type],
      m;
    if (M) {
      let P = gU[M];
      m = AP.clone(P.uniforms);
    } else m = w.uniforms;
    return m;
  }
  function k(w, M) {
    let m = K.get(M);
    if (m !== void 0) ++m.usedTimes;
    else ((m = new Wi($, M, w, W)), G.push(m), K.set(M, m));
    return m;
  }
  function R(w) {
    if (--w.usedTimes === 0) {
      let M = G.indexOf(w);
      ((G[M] = G[G.length - 1]), G.pop(), K.delete(w.cacheKey), w.destroy());
    }
  }
  function _(w) {
    D.remove(w);
  }
  function S() {
    D.dispose();
  }
  return {
    getParameters: E,
    getProgramCacheKey: z,
    getUniforms: V,
    acquireProgram: k,
    releaseProgram: R,
    releaseShaderCache: _,
    programs: G,
    dispose: S,
  };
}
function Di() {
  let $ = new WeakMap();
  function J(Y) {
    return $.has(Y);
  }
  function U(Y) {
    let D = $.get(Y);
    if (D === void 0) ((D = {}), $.set(Y, D));
    return D;
  }
  function Q(Y) {
    $.delete(Y);
  }
  function W(Y, D, H) {
    $.get(Y)[D] = H;
  }
  function X() {
    $ = new WeakMap();
  }
  return { has: J, get: U, remove: Q, update: W, dispose: X };
}
function Hi($, J) {
  if ($.groupOrder !== J.groupOrder) return $.groupOrder - J.groupOrder;
  else if ($.renderOrder !== J.renderOrder) return $.renderOrder - J.renderOrder;
  else if ($.material.id !== J.material.id) return $.material.id - J.material.id;
  else if ($.materialVariant !== J.materialVariant) return $.materialVariant - J.materialVariant;
  else if ($.z !== J.z) return $.z - J.z;
  else return $.id - J.id;
}
function nP($, J) {
  if ($.groupOrder !== J.groupOrder) return $.groupOrder - J.groupOrder;
  else if ($.renderOrder !== J.renderOrder) return $.renderOrder - J.renderOrder;
  else if ($.z !== J.z) return J.z - $.z;
  else return $.id - J.id;
}
function iP() {
  let $ = [],
    J = 0,
    U = [],
    Q = [],
    W = [];
  function X() {
    ((J = 0), (U.length = 0), (Q.length = 0), (W.length = 0));
  }
  function Y(N) {
    let F = 0;
    if (N.isInstancedMesh) F += 2;
    if (N.isSkinnedMesh) F += 1;
    return F;
  }
  function D(N, F, B, E, z, q) {
    let L = $[J];
    if (L === void 0)
      ((L = {
        id: N.id,
        object: N,
        geometry: F,
        material: B,
        materialVariant: Y(N),
        groupOrder: E,
        renderOrder: N.renderOrder,
        z,
        group: q,
      }),
        ($[J] = L));
    else
      ((L.id = N.id),
        (L.object = N),
        (L.geometry = F),
        (L.material = B),
        (L.materialVariant = Y(N)),
        (L.groupOrder = E),
        (L.renderOrder = N.renderOrder),
        (L.z = z),
        (L.group = q));
    return (J++, L);
  }
  function H(N, F, B, E, z, q) {
    let L = D(N, F, B, E, z, q);
    if (B.transmission > 0) Q.push(L);
    else if (B.transparent === !0) W.push(L);
    else U.push(L);
  }
  function G(N, F, B, E, z, q) {
    let L = D(N, F, B, E, z, q);
    if (B.transmission > 0) Q.unshift(L);
    else if (B.transparent === !0) W.unshift(L);
    else U.unshift(L);
  }
  function K(N, F) {
    if (U.length > 1) U.sort(N || Hi);
    if (Q.length > 1) Q.sort(F || nP);
    if (W.length > 1) W.sort(F || nP);
  }
  function O() {
    for (let N = J, F = $.length; N < F; N++) {
      let B = $[N];
      if (B.id === null) break;
      ((B.id = null), (B.object = null), (B.geometry = null), (B.material = null), (B.group = null));
    }
  }
  return { opaque: U, transmissive: Q, transparent: W, init: X, push: H, unshift: G, finish: O, sort: K };
}
function Gi() {
  let $ = new WeakMap();
  function J(Q, W) {
    let X = $.get(Q),
      Y;
    if (X === void 0) ((Y = new iP()), $.set(Q, [Y]));
    else if (W >= X.length) ((Y = new iP()), X.push(Y));
    else Y = X[W];
    return Y;
  }
  function U() {
    $ = new WeakMap();
  }
  return { get: J, dispose: U };
}
function Ki() {
  let $ = {};
  return {
    get: function (J) {
      if ($[J.id] !== void 0) return $[J.id];
      let U;
      switch (J.type) {
        case "DirectionalLight":
          U = { direction: new C(), color: new W6() };
          break;
        case "SpotLight":
          U = {
            position: new C(),
            direction: new C(),
            color: new W6(),
            distance: 0,
            coneCos: 0,
            penumbraCos: 0,
            decay: 0,
          };
          break;
        case "PointLight":
          U = { position: new C(), color: new W6(), distance: 0, decay: 0 };
          break;
        case "HemisphereLight":
          U = { direction: new C(), skyColor: new W6(), groundColor: new W6() };
          break;
        case "RectAreaLight":
          U = { color: new W6(), position: new C(), halfWidth: new C(), halfHeight: new C() };
          break;
      }
      return (($[J.id] = U), U);
    },
  };
}
function Ni() {
  let $ = {};
  return {
    get: function (J) {
      if ($[J.id] !== void 0) return $[J.id];
      let U;
      switch (J.type) {
        case "DirectionalLight":
          U = { shadowIntensity: 1, shadowBias: 0, shadowNormalBias: 0, shadowRadius: 1, shadowMapSize: new d$() };
          break;
        case "SpotLight":
          U = { shadowIntensity: 1, shadowBias: 0, shadowNormalBias: 0, shadowRadius: 1, shadowMapSize: new d$() };
          break;
        case "PointLight":
          U = {
            shadowIntensity: 1,
            shadowBias: 0,
            shadowNormalBias: 0,
            shadowRadius: 1,
            shadowMapSize: new d$(),
            shadowCameraNear: 1,
            shadowCameraFar: 1000,
          };
          break;
      }
      return (($[J.id] = U), U);
    },
  };
}
var Oi = 0;
function Fi($, J) {
  return (J.castShadow ? 2 : 0) - ($.castShadow ? 2 : 0) + (J.map ? 1 : 0) - ($.map ? 1 : 0);
}
function qi($) {
  let J = new Ki(),
    U = Ni(),
    Q = {
      version: 0,
      hash: {
        directionalLength: -1,
        pointLength: -1,
        spotLength: -1,
        rectAreaLength: -1,
        hemiLength: -1,
        numDirectionalShadows: -1,
        numPointShadows: -1,
        numSpotShadows: -1,
        numSpotMaps: -1,
        numLightProbes: -1,
      },
      ambient: [0, 0, 0],
      probe: [],
      directional: [],
      directionalShadow: [],
      directionalShadowMap: [],
      directionalShadowMatrix: [],
      spot: [],
      spotLightMap: [],
      spotShadow: [],
      spotShadowMap: [],
      spotLightMatrix: [],
      rectArea: [],
      rectAreaLTC1: null,
      rectAreaLTC2: null,
      point: [],
      pointShadow: [],
      pointShadowMap: [],
      pointShadowMatrix: [],
      hemi: [],
      numSpotLightShadowsWithMaps: 0,
      numLightProbes: 0,
    };
  for (let G = 0; G < 9; G++) Q.probe.push(new C());
  let W = new C(),
    X = new x6(),
    Y = new x6();
  function D(G) {
    let K = 0,
      O = 0,
      N = 0;
    for (let M = 0; M < 9; M++) Q.probe[M].set(0, 0, 0);
    let F = 0,
      B = 0,
      E = 0,
      z = 0,
      q = 0,
      L = 0,
      V = 0,
      k = 0,
      R = 0,
      _ = 0,
      S = 0;
    G.sort(Fi);
    for (let M = 0, m = G.length; M < m; M++) {
      let P = G[M],
        u = P.color,
        n = P.intensity,
        b = P.distance,
        i = null;
      if (P.shadow && P.shadow.map)
        if (P.shadow.map.texture.format === l9) i = P.shadow.map.texture;
        else i = P.shadow.map.depthTexture || P.shadow.map.texture;
      if (P.isAmbientLight) ((K += u.r * n), (O += u.g * n), (N += u.b * n));
      else if (P.isLightProbe) {
        for (let x = 0; x < 9; x++) Q.probe[x].addScaledVector(P.sh.coefficients[x], n);
        S++;
      } else if (P.isDirectionalLight) {
        let x = J.get(P);
        if ((x.color.copy(P.color).multiplyScalar(P.intensity), P.castShadow)) {
          let l = P.shadow,
            r = U.get(P);
          ((r.shadowIntensity = l.intensity),
            (r.shadowBias = l.bias),
            (r.shadowNormalBias = l.normalBias),
            (r.shadowRadius = l.radius),
            (r.shadowMapSize = l.mapSize),
            (Q.directionalShadow[F] = r),
            (Q.directionalShadowMap[F] = i),
            (Q.directionalShadowMatrix[F] = P.shadow.matrix),
            L++);
        }
        ((Q.directional[F] = x), F++);
      } else if (P.isSpotLight) {
        let x = J.get(P);
        (x.position.setFromMatrixPosition(P.matrixWorld),
          x.color.copy(u).multiplyScalar(n),
          (x.distance = b),
          (x.coneCos = Math.cos(P.angle)),
          (x.penumbraCos = Math.cos(P.angle * (1 - P.penumbra))),
          (x.decay = P.decay),
          (Q.spot[E] = x));
        let l = P.shadow;
        if (P.map) {
          if (((Q.spotLightMap[R] = P.map), R++, l.updateMatrices(P), P.castShadow)) _++;
        }
        if (((Q.spotLightMatrix[E] = l.matrix), P.castShadow)) {
          let r = U.get(P);
          ((r.shadowIntensity = l.intensity),
            (r.shadowBias = l.bias),
            (r.shadowNormalBias = l.normalBias),
            (r.shadowRadius = l.radius),
            (r.shadowMapSize = l.mapSize),
            (Q.spotShadow[E] = r),
            (Q.spotShadowMap[E] = i),
            k++);
        }
        E++;
      } else if (P.isRectAreaLight) {
        let x = J.get(P);
        (x.color.copy(u).multiplyScalar(n),
          x.halfWidth.set(P.width * 0.5, 0, 0),
          x.halfHeight.set(0, P.height * 0.5, 0),
          (Q.rectArea[z] = x),
          z++);
      } else if (P.isPointLight) {
        let x = J.get(P);
        if (
          (x.color.copy(P.color).multiplyScalar(P.intensity),
          (x.distance = P.distance),
          (x.decay = P.decay),
          P.castShadow)
        ) {
          let l = P.shadow,
            r = U.get(P);
          ((r.shadowIntensity = l.intensity),
            (r.shadowBias = l.bias),
            (r.shadowNormalBias = l.normalBias),
            (r.shadowRadius = l.radius),
            (r.shadowMapSize = l.mapSize),
            (r.shadowCameraNear = l.camera.near),
            (r.shadowCameraFar = l.camera.far),
            (Q.pointShadow[B] = r),
            (Q.pointShadowMap[B] = i),
            (Q.pointShadowMatrix[B] = P.shadow.matrix),
            V++);
        }
        ((Q.point[B] = x), B++);
      } else if (P.isHemisphereLight) {
        let x = J.get(P);
        (x.skyColor.copy(P.color).multiplyScalar(n),
          x.groundColor.copy(P.groundColor).multiplyScalar(n),
          (Q.hemi[q] = x),
          q++);
      }
    }
    if (z > 0)
      if ($.has("OES_texture_float_linear") === !0)
        ((Q.rectAreaLTC1 = V$.LTC_FLOAT_1), (Q.rectAreaLTC2 = V$.LTC_FLOAT_2));
      else ((Q.rectAreaLTC1 = V$.LTC_HALF_1), (Q.rectAreaLTC2 = V$.LTC_HALF_2));
    ((Q.ambient[0] = K), (Q.ambient[1] = O), (Q.ambient[2] = N));
    let w = Q.hash;
    if (
      w.directionalLength !== F ||
      w.pointLength !== B ||
      w.spotLength !== E ||
      w.rectAreaLength !== z ||
      w.hemiLength !== q ||
      w.numDirectionalShadows !== L ||
      w.numPointShadows !== V ||
      w.numSpotShadows !== k ||
      w.numSpotMaps !== R ||
      w.numLightProbes !== S
    )
      ((Q.directional.length = F),
        (Q.spot.length = E),
        (Q.rectArea.length = z),
        (Q.point.length = B),
        (Q.hemi.length = q),
        (Q.directionalShadow.length = L),
        (Q.directionalShadowMap.length = L),
        (Q.pointShadow.length = V),
        (Q.pointShadowMap.length = V),
        (Q.spotShadow.length = k),
        (Q.spotShadowMap.length = k),
        (Q.directionalShadowMatrix.length = L),
        (Q.pointShadowMatrix.length = V),
        (Q.spotLightMatrix.length = k + R - _),
        (Q.spotLightMap.length = R),
        (Q.numSpotLightShadowsWithMaps = _),
        (Q.numLightProbes = S),
        (w.directionalLength = F),
        (w.pointLength = B),
        (w.spotLength = E),
        (w.rectAreaLength = z),
        (w.hemiLength = q),
        (w.numDirectionalShadows = L),
        (w.numPointShadows = V),
        (w.numSpotShadows = k),
        (w.numSpotMaps = R),
        (w.numLightProbes = S),
        (Q.version = Oi++));
  }
  function H(G, K) {
    let O = 0,
      N = 0,
      F = 0,
      B = 0,
      E = 0,
      z = K.matrixWorldInverse;
    for (let q = 0, L = G.length; q < L; q++) {
      let V = G[q];
      if (V.isDirectionalLight) {
        let k = Q.directional[O];
        (k.direction.setFromMatrixPosition(V.matrixWorld),
          W.setFromMatrixPosition(V.target.matrixWorld),
          k.direction.sub(W),
          k.direction.transformDirection(z),
          O++);
      } else if (V.isSpotLight) {
        let k = Q.spot[F];
        (k.position.setFromMatrixPosition(V.matrixWorld),
          k.position.applyMatrix4(z),
          k.direction.setFromMatrixPosition(V.matrixWorld),
          W.setFromMatrixPosition(V.target.matrixWorld),
          k.direction.sub(W),
          k.direction.transformDirection(z),
          F++);
      } else if (V.isRectAreaLight) {
        let k = Q.rectArea[B];
        (k.position.setFromMatrixPosition(V.matrixWorld),
          k.position.applyMatrix4(z),
          Y.identity(),
          X.copy(V.matrixWorld),
          X.premultiply(z),
          Y.extractRotation(X),
          k.halfWidth.set(V.width * 0.5, 0, 0),
          k.halfHeight.set(0, V.height * 0.5, 0),
          k.halfWidth.applyMatrix4(Y),
          k.halfHeight.applyMatrix4(Y),
          B++);
      } else if (V.isPointLight) {
        let k = Q.point[N];
        (k.position.setFromMatrixPosition(V.matrixWorld), k.position.applyMatrix4(z), N++);
      } else if (V.isHemisphereLight) {
        let k = Q.hemi[E];
        (k.direction.setFromMatrixPosition(V.matrixWorld), k.direction.transformDirection(z), E++);
      }
    }
  }
  return { setup: D, setupView: H, state: Q };
}
function oP($) {
  let J = new qi($),
    U = [],
    Q = [],
    W = [];
  function X(N) {
    ((O.camera = N), (U.length = 0), (Q.length = 0), (W.length = 0));
  }
  function Y(N) {
    U.push(N);
  }
  function D(N) {
    Q.push(N);
  }
  function H(N) {
    W.push(N);
  }
  function G() {
    J.setup(U);
  }
  function K(N) {
    J.setupView(U, N);
  }
  let O = {
    lightsArray: U,
    shadowsArray: Q,
    lightProbeGridArray: W,
    camera: null,
    lights: J,
    transmissionRenderTarget: {},
    textureUnits: 0,
  };
  return { init: X, state: O, setupLights: G, setupLightsView: K, pushLight: Y, pushShadow: D, pushLightProbeGrid: H };
}
function zi($) {
  let J = new WeakMap();
  function U(W, X = 0) {
    let Y = J.get(W),
      D;
    if (Y === void 0) ((D = new oP($)), J.set(W, [D]));
    else if (X >= Y.length) ((D = new oP($)), Y.push(D));
    else D = Y[X];
    return D;
  }
  function Q() {
    J = new WeakMap();
  }
  return { get: U, dispose: Q };
}
var Bi = `void main() {
	gl_Position = vec4( position, 1.0 );
}`,
  Ei = `uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,
  Li = [new C(1, 0, 0), new C(-1, 0, 0), new C(0, 1, 0), new C(0, -1, 0), new C(0, 0, 1), new C(0, 0, -1)],
  wi = [new C(0, -1, 0), new C(0, -1, 0), new C(0, 0, 1), new C(0, 0, -1), new C(0, -1, 0), new C(0, -1, 0)],
  rP = new x6(),
  AX = new C(),
  _E = new C();
function Ii($, J, U) {
  let Q = new d9(),
    W = new d$(),
    X = new d$(),
    Y = new q0(),
    D = new XE(),
    H = new YE(),
    G = {},
    K = U.maxTextureSize,
    O = { [g1]: kJ, [kJ]: g1, [AJ]: AJ },
    N = new dJ({
      defines: { VSM_SAMPLES: 8 },
      uniforms: { shadow_pass: { value: null }, resolution: { value: new d$() }, radius: { value: 4 } },
      vertexShader: Bi,
      fragmentShader: Ei,
    }),
    F = N.clone();
  F.defines.HORIZONTAL_PASS = 1;
  let B = new Q0();
  B.setAttribute("position", new bJ(new Float32Array([-1, -1, 0.5, 3, -1, 0.5, -1, 3, 0.5]), 3));
  let E = new X$(B, N),
    z = this;
  ((this.enabled = !1), (this.autoUpdate = !0), (this.needsUpdate = !1), (this.type = DX));
  let q = this.type;
  this.render = function (_, S, w) {
    if (z.enabled === !1) return;
    if (z.autoUpdate === !1 && z.needsUpdate === !1) return;
    if (_.length === 0) return;
    if (this.type === AZ)
      (i$("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."), (this.type = DX));
    let M = $.getRenderTarget(),
      m = $.getActiveCubeFace(),
      P = $.getActiveMipmapLevel(),
      u = $.state;
    if ((u.setBlending(TU), u.buffers.depth.getReversed() === !0)) u.buffers.color.setClear(0, 0, 0, 0);
    else u.buffers.color.setClear(1, 1, 1, 1);
    (u.buffers.depth.setTest(!0), u.setScissorTest(!1));
    let n = q !== this.type;
    if (n)
      S.traverse(function (b) {
        if (b.material)
          if (Array.isArray(b.material)) b.material.forEach((i) => (i.needsUpdate = !0));
          else b.material.needsUpdate = !0;
      });
    for (let b = 0, i = _.length; b < i; b++) {
      let x = _[b],
        l = x.shadow;
      if (l === void 0) {
        i$("WebGLShadowMap:", x, "has no shadow.");
        continue;
      }
      if (l.autoUpdate === !1 && l.needsUpdate === !1) continue;
      W.copy(l.mapSize);
      let r = l.getFrameExtents();
      if ((W.multiply(r), X.copy(l.mapSize), W.x > K || W.y > K)) {
        if (W.x > K) ((X.x = Math.floor(K / r.x)), (W.x = X.x * r.x), (l.mapSize.x = X.x));
        if (W.y > K) ((X.y = Math.floor(K / r.y)), (W.y = X.y * r.y), (l.mapSize.y = X.y));
      }
      let G$ = $.state.buffers.depth.getReversed();
      if (((l.camera._reversedDepth = G$), l.map === null || n === !0)) {
        if (l.map !== null) {
          if (l.map.depthTexture !== null) (l.map.depthTexture.dispose(), (l.map.depthTexture = null));
          l.map.dispose();
        }
        if (this.type === x1) {
          if (x.isPointLight) {
            i$("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");
            continue;
          }
          ((l.map = new pJ(W.x, W.y, { format: l9, type: Y8, minFilter: MJ, magFilter: MJ, generateMipmaps: !1 })),
            (l.map.texture.name = x.name + ".shadowMap"),
            (l.map.depthTexture = new U9(W.x, W.y, X8)),
            (l.map.depthTexture.name = x.name + ".shadowMapDepth"),
            (l.map.depthTexture.format = h9),
            (l.map.depthTexture.compareFunction = null),
            (l.map.depthTexture.minFilter = e8),
            (l.map.depthTexture.magFilter = e8));
        } else {
          if (x.isPointLight) ((l.map = new jE(W.x)), (l.map.depthTexture = new UE(W.x, $9)));
          else ((l.map = new pJ(W.x, W.y)), (l.map.depthTexture = new U9(W.x, W.y, $9)));
          if (((l.map.depthTexture.name = x.name + ".shadowMap"), (l.map.depthTexture.format = h9), this.type === DX))
            ((l.map.depthTexture.compareFunction = G$ ? VG : IG),
              (l.map.depthTexture.minFilter = MJ),
              (l.map.depthTexture.magFilter = MJ));
          else
            ((l.map.depthTexture.compareFunction = null),
              (l.map.depthTexture.minFilter = e8),
              (l.map.depthTexture.magFilter = e8));
        }
        l.camera.updateProjectionMatrix();
      }
      let k$ = l.map.isWebGLCubeRenderTarget ? 6 : 1;
      for (let h$ = 0; h$ < k$; h$++) {
        if (l.map.isWebGLCubeRenderTarget) ($.setRenderTarget(l.map, h$), $.clear());
        else {
          if (h$ === 0) ($.setRenderTarget(l.map), $.clear());
          let b$ = l.getViewport(h$);
          (Y.set(X.x * b$.x, X.y * b$.y, X.x * b$.z, X.y * b$.w), u.viewport(Y));
        }
        if (x.isPointLight) {
          let { camera: b$, matrix: b6 } = l,
            k6 = x.distance || b$.far;
          if (k6 !== b$.far) ((b$.far = k6), b$.updateProjectionMatrix());
          (AX.setFromMatrixPosition(x.matrixWorld),
            b$.position.copy(AX),
            _E.copy(b$.position),
            _E.add(Li[h$]),
            b$.up.copy(wi[h$]),
            b$.lookAt(_E),
            b$.updateMatrixWorld(),
            b6.makeTranslation(-AX.x, -AX.y, -AX.z),
            rP.multiplyMatrices(b$.projectionMatrix, b$.matrixWorldInverse),
            l._frustum.setFromProjectionMatrix(rP, b$.coordinateSystem, b$.reversedDepth));
        } else l.updateMatrices(x);
        ((Q = l.getFrustum()), k(S, w, l.camera, x, this.type));
      }
      if (l.isPointLightShadow !== !0 && this.type === x1) L(l, w);
      l.needsUpdate = !1;
    }
    ((q = this.type), (z.needsUpdate = !1), $.setRenderTarget(M, m, P));
  };
  function L(_, S) {
    let w = J.update(E);
    if (N.defines.VSM_SAMPLES !== _.blurSamples)
      ((N.defines.VSM_SAMPLES = _.blurSamples),
        (F.defines.VSM_SAMPLES = _.blurSamples),
        (N.needsUpdate = !0),
        (F.needsUpdate = !0));
    if (_.mapPass === null) _.mapPass = new pJ(W.x, W.y, { format: l9, type: Y8 });
    ((N.uniforms.shadow_pass.value = _.map.depthTexture),
      (N.uniforms.resolution.value = _.mapSize),
      (N.uniforms.radius.value = _.radius),
      $.setRenderTarget(_.mapPass),
      $.clear(),
      $.renderBufferDirect(S, null, w, N, E, null),
      (F.uniforms.shadow_pass.value = _.mapPass.texture),
      (F.uniforms.resolution.value = _.mapSize),
      (F.uniforms.radius.value = _.radius),
      $.setRenderTarget(_.map),
      $.clear(),
      $.renderBufferDirect(S, null, w, F, E, null));
  }
  function V(_, S, w, M) {
    let m = null,
      P = w.isPointLight === !0 ? _.customDistanceMaterial : _.customDepthMaterial;
    if (P !== void 0) m = P;
    else if (
      ((m = w.isPointLight === !0 ? H : D),
      ($.localClippingEnabled &&
        S.clipShadows === !0 &&
        Array.isArray(S.clippingPlanes) &&
        S.clippingPlanes.length !== 0) ||
        (S.displacementMap && S.displacementScale !== 0) ||
        (S.alphaMap && S.alphaTest > 0) ||
        (S.map && S.alphaTest > 0) ||
        S.alphaToCoverage === !0)
    ) {
      let u = m.uuid,
        n = S.uuid,
        b = G[u];
      if (b === void 0) ((b = {}), (G[u] = b));
      let i = b[n];
      if (i === void 0) ((i = m.clone()), (b[n] = i), S.addEventListener("dispose", R));
      m = i;
    }
    if (((m.visible = S.visible), (m.wireframe = S.wireframe), M === x1))
      m.side = S.shadowSide !== null ? S.shadowSide : S.side;
    else m.side = S.shadowSide !== null ? S.shadowSide : O[S.side];
    if (
      ((m.alphaMap = S.alphaMap),
      (m.alphaTest = S.alphaToCoverage === !0 ? 0.5 : S.alphaTest),
      (m.map = S.map),
      (m.clipShadows = S.clipShadows),
      (m.clippingPlanes = S.clippingPlanes),
      (m.clipIntersection = S.clipIntersection),
      (m.displacementMap = S.displacementMap),
      (m.displacementScale = S.displacementScale),
      (m.displacementBias = S.displacementBias),
      (m.wireframeLinewidth = S.wireframeLinewidth),
      (m.linewidth = S.linewidth),
      w.isPointLight === !0 && m.isMeshDistanceMaterial === !0)
    ) {
      let u = $.properties.get(m);
      u.light = w;
    }
    return m;
  }
  function k(_, S, w, M, m) {
    if (_.visible === !1) return;
    if (_.layers.test(S.layers) && (_.isMesh || _.isLine || _.isPoints)) {
      if ((_.castShadow || (_.receiveShadow && m === x1)) && (!_.frustumCulled || Q.intersectsObject(_))) {
        _.modelViewMatrix.multiplyMatrices(w.matrixWorldInverse, _.matrixWorld);
        let n = J.update(_),
          b = _.material;
        if (Array.isArray(b)) {
          let i = n.groups;
          for (let x = 0, l = i.length; x < l; x++) {
            let r = i[x],
              G$ = b[r.materialIndex];
            if (G$ && G$.visible) {
              let k$ = V(_, G$, M, m);
              (_.onBeforeShadow($, _, S, w, n, k$, r),
                $.renderBufferDirect(w, null, n, k$, _, r),
                _.onAfterShadow($, _, S, w, n, k$, r));
            }
          }
        } else if (b.visible) {
          let i = V(_, b, M, m);
          (_.onBeforeShadow($, _, S, w, n, i, null),
            $.renderBufferDirect(w, null, n, i, _, null),
            _.onAfterShadow($, _, S, w, n, i, null));
        }
      }
    }
    let u = _.children;
    for (let n = 0, b = u.length; n < b; n++) k(u[n], S, w, M, m);
  }
  function R(_) {
    _.target.removeEventListener("dispose", R);
    for (let w in G) {
      let M = G[w],
        m = _.target.uuid;
      if (m in M) (M[m].dispose(), delete M[m]);
    }
  }
}
function Vi($, J) {
  function U() {
    let T = !1,
      q$ = new q0(),
      s = null,
      N$ = new q0(0, 0, 0, 0);
    return {
      setMask: function (v$) {
        if (s !== v$ && !T) ($.colorMask(v$, v$, v$, v$), (s = v$));
      },
      setLocked: function (v$) {
        T = v$;
      },
      setClear: function (v$, W$, l$, Y6, R0) {
        if (R0 === !0) ((v$ *= Y6), (W$ *= Y6), (l$ *= Y6));
        if ((q$.set(v$, W$, l$, Y6), N$.equals(q$) === !1)) ($.clearColor(v$, W$, l$, Y6), N$.copy(q$));
      },
      reset: function () {
        ((T = !1), (s = null), N$.set(-1, 0, 0, 0));
      },
    };
  }
  function Q() {
    let T = !1,
      q$ = !1,
      s = null,
      N$ = null,
      v$ = null;
    return {
      setReversed: function (W$) {
        if (q$ !== W$) {
          let l$ = J.get("EXT_clip_control");
          if (W$) l$.clipControlEXT(l$.LOWER_LEFT_EXT, l$.ZERO_TO_ONE_EXT);
          else l$.clipControlEXT(l$.LOWER_LEFT_EXT, l$.NEGATIVE_ONE_TO_ONE_EXT);
          q$ = W$;
          let Y6 = v$;
          ((v$ = null), this.setClear(Y6));
        }
      },
      getReversed: function () {
        return q$;
      },
      setTest: function (W$) {
        if (W$) S$($.DEPTH_TEST);
        else o$($.DEPTH_TEST);
      },
      setMask: function (W$) {
        if (s !== W$ && !T) ($.depthMask(W$), (s = W$));
      },
      setFunc: function (W$) {
        if (q$) W$ = IP[W$];
        if (N$ !== W$) {
          switch (W$) {
            case dZ:
              $.depthFunc($.NEVER);
              break;
            case cZ:
              $.depthFunc($.ALWAYS);
              break;
            case nZ:
              $.depthFunc($.LESS);
              break;
            case $B:
              $.depthFunc($.LEQUAL);
              break;
            case iZ:
              $.depthFunc($.EQUAL);
              break;
            case oZ:
              $.depthFunc($.GEQUAL);
              break;
            case rZ:
              $.depthFunc($.GREATER);
              break;
            case sZ:
              $.depthFunc($.NOTEQUAL);
              break;
            default:
              $.depthFunc($.LEQUAL);
          }
          N$ = W$;
        }
      },
      setLocked: function (W$) {
        T = W$;
      },
      setClear: function (W$) {
        if (v$ !== W$) {
          if (((v$ = W$), q$)) W$ = 1 - W$;
          $.clearDepth(W$);
        }
      },
      reset: function () {
        ((T = !1), (s = null), (N$ = null), (v$ = null), (q$ = !1));
      },
    };
  }
  function W() {
    let T = !1,
      q$ = null,
      s = null,
      N$ = null,
      v$ = null,
      W$ = null,
      l$ = null,
      Y6 = null,
      R0 = null;
    return {
      setTest: function (d6) {
        if (!T)
          if (d6) S$($.STENCIL_TEST);
          else o$($.STENCIL_TEST);
      },
      setMask: function (d6) {
        if (q$ !== d6 && !T) ($.stencilMask(d6), (q$ = d6));
      },
      setFunc: function (d6, EU, oJ) {
        if (s !== d6 || N$ !== EU || v$ !== oJ) ($.stencilFunc(d6, EU, oJ), (s = d6), (N$ = EU), (v$ = oJ));
      },
      setOp: function (d6, EU, oJ) {
        if (W$ !== d6 || l$ !== EU || Y6 !== oJ) ($.stencilOp(d6, EU, oJ), (W$ = d6), (l$ = EU), (Y6 = oJ));
      },
      setLocked: function (d6) {
        T = d6;
      },
      setClear: function (d6) {
        if (R0 !== d6) ($.clearStencil(d6), (R0 = d6));
      },
      reset: function () {
        ((T = !1),
          (q$ = null),
          (s = null),
          (N$ = null),
          (v$ = null),
          (W$ = null),
          (l$ = null),
          (Y6 = null),
          (R0 = null));
      },
    };
  }
  let X = new U(),
    Y = new Q(),
    D = new W(),
    H = new WeakMap(),
    G = new WeakMap(),
    K = {},
    O = {},
    N = {},
    F = new WeakMap(),
    B = [],
    E = null,
    z = !1,
    q = null,
    L = null,
    V = null,
    k = null,
    R = null,
    _ = null,
    S = null,
    w = new W6(0, 0, 0),
    M = 0,
    m = !1,
    P = null,
    u = null,
    n = null,
    b = null,
    i = null,
    x = $.getParameter($.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
    l = !1,
    r = 0,
    G$ = $.getParameter($.VERSION);
  if (G$.indexOf("WebGL") !== -1) ((r = parseFloat(/^WebGL (\d)/.exec(G$)[1])), (l = r >= 1));
  else if (G$.indexOf("OpenGL ES") !== -1) ((r = parseFloat(/^OpenGL ES (\d)/.exec(G$)[1])), (l = r >= 2));
  let k$ = null,
    h$ = {},
    b$ = $.getParameter($.SCISSOR_BOX),
    b6 = $.getParameter($.VIEWPORT),
    k6 = new q0().fromArray(b$),
    a = new q0().fromArray(b6);
  function Z$(T, q$, s, N$) {
    let v$ = new Uint8Array(4),
      W$ = $.createTexture();
    ($.bindTexture(T, W$),
      $.texParameteri(T, $.TEXTURE_MIN_FILTER, $.NEAREST),
      $.texParameteri(T, $.TEXTURE_MAG_FILTER, $.NEAREST));
    for (let l$ = 0; l$ < s; l$++)
      if (T === $.TEXTURE_3D || T === $.TEXTURE_2D_ARRAY)
        $.texImage3D(q$, 0, $.RGBA, 1, 1, N$, 0, $.RGBA, $.UNSIGNED_BYTE, v$);
      else $.texImage2D(q$ + l$, 0, $.RGBA, 1, 1, 0, $.RGBA, $.UNSIGNED_BYTE, v$);
    return W$;
  }
  let u$ = {};
  ((u$[$.TEXTURE_2D] = Z$($.TEXTURE_2D, $.TEXTURE_2D, 1)),
    (u$[$.TEXTURE_CUBE_MAP] = Z$($.TEXTURE_CUBE_MAP, $.TEXTURE_CUBE_MAP_POSITIVE_X, 6)),
    (u$[$.TEXTURE_2D_ARRAY] = Z$($.TEXTURE_2D_ARRAY, $.TEXTURE_2D_ARRAY, 1, 1)),
    (u$[$.TEXTURE_3D] = Z$($.TEXTURE_3D, $.TEXTURE_3D, 1, 1)),
    X.setClear(0, 0, 0, 1),
    Y.setClear(1),
    D.setClear(0),
    S$($.DEPTH_TEST),
    Y.setFunc($B),
    m0(!1),
    M0(sz),
    S$($.CULL_FACE),
    F6(TU));
  function S$(T) {
    if (K[T] !== !0) ($.enable(T), (K[T] = !0));
  }
  function o$(T) {
    if (K[T] !== !1) ($.disable(T), (K[T] = !1));
  }
  function y6(T, q$) {
    if (N[T] !== q$) {
      if (($.bindFramebuffer(T, q$), (N[T] = q$), T === $.DRAW_FRAMEBUFFER)) N[$.FRAMEBUFFER] = q$;
      if (T === $.FRAMEBUFFER) N[$.DRAW_FRAMEBUFFER] = q$;
      return !0;
    }
    return !1;
  }
  function B6(T, q$) {
    let s = B,
      N$ = !1;
    if (T) {
      if (((s = F.get(q$)), s === void 0)) ((s = []), F.set(q$, s));
      let v$ = T.textures;
      if (s.length !== v$.length || s[0] !== $.COLOR_ATTACHMENT0) {
        for (let W$ = 0, l$ = v$.length; W$ < l$; W$++) s[W$] = $.COLOR_ATTACHMENT0 + W$;
        ((s.length = v$.length), (N$ = !0));
      }
    } else if (s[0] !== $.BACK) ((s[0] = $.BACK), (N$ = !0));
    if (N$) $.drawBuffers(s);
  }
  function A6(T) {
    if (E !== T) return ($.useProgram(T), (E = T), !0);
    return !1;
  }
  let a6 = { [h1]: $.FUNC_ADD, [RZ]: $.FUNC_SUBTRACT, [ZZ]: $.FUNC_REVERSE_SUBTRACT };
  ((a6[PZ] = $.MIN), (a6[_Z] = $.MAX));
  let t6 = {
    [SZ]: $.ZERO,
    [CZ]: $.ONE,
    [TZ]: $.SRC_COLOR,
    [vZ]: $.SRC_ALPHA,
    [hZ]: $.SRC_ALPHA_SATURATE,
    [xZ]: $.DST_COLOR,
    [fZ]: $.DST_ALPHA,
    [jZ]: $.ONE_MINUS_SRC_COLOR,
    [bZ]: $.ONE_MINUS_SRC_ALPHA,
    [gZ]: $.ONE_MINUS_DST_COLOR,
    [yZ]: $.ONE_MINUS_DST_ALPHA,
    [uZ]: $.CONSTANT_COLOR,
    [lZ]: $.ONE_MINUS_CONSTANT_COLOR,
    [mZ]: $.CONSTANT_ALPHA,
    [pZ]: $.ONE_MINUS_CONSTANT_ALPHA,
  };
  function F6(T, q$, s, N$, v$, W$, l$, Y6, R0, d6) {
    if (T === TU) {
      if (z === !0) (o$($.BLEND), (z = !1));
      return;
    }
    if (z === !1) (S$($.BLEND), (z = !0));
    if (T !== MZ) {
      if (T !== q || d6 !== m) {
        if (L !== h1 || R !== h1) ($.blendEquation($.FUNC_ADD), (L = h1), (R = h1));
        if (d6)
          switch (T) {
            case HX:
              $.blendFuncSeparate($.ONE, $.ONE_MINUS_SRC_ALPHA, $.ONE, $.ONE_MINUS_SRC_ALPHA);
              break;
            case az:
              $.blendFunc($.ONE, $.ONE);
              break;
            case tz:
              $.blendFuncSeparate($.ZERO, $.ONE_MINUS_SRC_COLOR, $.ZERO, $.ONE);
              break;
            case ez:
              $.blendFuncSeparate($.DST_COLOR, $.ONE_MINUS_SRC_ALPHA, $.ZERO, $.ONE);
              break;
            default:
              s$("WebGLState: Invalid blending: ", T);
              break;
          }
        else
          switch (T) {
            case HX:
              $.blendFuncSeparate($.SRC_ALPHA, $.ONE_MINUS_SRC_ALPHA, $.ONE, $.ONE_MINUS_SRC_ALPHA);
              break;
            case az:
              $.blendFuncSeparate($.SRC_ALPHA, $.ONE, $.ONE, $.ONE);
              break;
            case tz:
              s$("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");
              break;
            case ez:
              s$("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");
              break;
            default:
              s$("WebGLState: Invalid blending: ", T);
              break;
          }
        ((V = null), (k = null), (_ = null), (S = null), w.set(0, 0, 0), (M = 0), (q = T), (m = d6));
      }
      return;
    }
    if (((v$ = v$ || q$), (W$ = W$ || s), (l$ = l$ || N$), q$ !== L || v$ !== R))
      ($.blendEquationSeparate(a6[q$], a6[v$]), (L = q$), (R = v$));
    if (s !== V || N$ !== k || W$ !== _ || l$ !== S)
      ($.blendFuncSeparate(t6[s], t6[N$], t6[W$], t6[l$]), (V = s), (k = N$), (_ = W$), (S = l$));
    if (Y6.equals(w) === !1 || R0 !== M) ($.blendColor(Y6.r, Y6.g, Y6.b, R0), w.copy(Y6), (M = R0));
    ((q = T), (m = !1));
  }
  function v0(T, q$) {
    T.side === AJ ? o$($.CULL_FACE) : S$($.CULL_FACE);
    let s = T.side === kJ;
    if (q$) s = !s;
    (m0(s),
      T.blending === HX && T.transparent === !1
        ? F6(TU)
        : F6(
            T.blending,
            T.blendEquation,
            T.blendSrc,
            T.blendDst,
            T.blendEquationAlpha,
            T.blendSrcAlpha,
            T.blendDstAlpha,
            T.blendColor,
            T.blendAlpha,
            T.premultipliedAlpha,
          ),
      Y.setFunc(T.depthFunc),
      Y.setTest(T.depthTest),
      Y.setMask(T.depthWrite),
      X.setMask(T.colorWrite));
    let N$ = T.stencilWrite;
    if ((D.setTest(N$), N$))
      (D.setMask(T.stencilWriteMask),
        D.setFunc(T.stencilFunc, T.stencilRef, T.stencilFuncMask),
        D.setOp(T.stencilFail, T.stencilZFail, T.stencilZPass));
    (e0(T.polygonOffset, T.polygonOffsetFactor, T.polygonOffsetUnits),
      T.alphaToCoverage === !0 ? S$($.SAMPLE_ALPHA_TO_COVERAGE) : o$($.SAMPLE_ALPHA_TO_COVERAGE));
  }
  function m0(T) {
    if (P !== T) {
      if (T) $.frontFace($.CW);
      else $.frontFace($.CCW);
      P = T;
    }
  }
  function M0(T) {
    if (T !== VZ) {
      if ((S$($.CULL_FACE), T !== u))
        if (T === sz) $.cullFace($.BACK);
        else if (T === kZ) $.cullFace($.FRONT);
        else $.cullFace($.FRONT_AND_BACK);
    } else o$($.CULL_FACE);
    u = T;
  }
  function j(T) {
    if (T !== n) {
      if (l) $.lineWidth(T);
      n = T;
    }
  }
  function e0(T, q$, s) {
    if (T) {
      if ((S$($.POLYGON_OFFSET_FILL), b !== q$ || i !== s)) {
        if (((b = q$), (i = s), Y.getReversed())) q$ = -q$;
        $.polygonOffset(q$, s);
      }
    } else o$($.POLYGON_OFFSET_FILL);
  }
  function Z6(T) {
    if (T) S$($.SCISSOR_TEST);
    else o$($.SCISSOR_TEST);
  }
  function f6(T) {
    if (T === void 0) T = $.TEXTURE0 + x - 1;
    if (k$ !== T) ($.activeTexture(T), (k$ = T));
  }
  function M$(T, q$, s) {
    if (s === void 0)
      if (k$ === null) s = $.TEXTURE0 + x - 1;
      else s = k$;
    let N$ = h$[s];
    if (N$ === void 0) ((N$ = { type: void 0, texture: void 0 }), (h$[s] = N$));
    if (N$.type !== T || N$.texture !== q$) {
      if (k$ !== s) ($.activeTexture(s), (k$ = s));
      ($.bindTexture(T, q$ || u$[T]), (N$.type = T), (N$.texture = q$));
    }
  }
  function O0() {
    let T = h$[k$];
    if (T !== void 0 && T.type !== void 0) ($.bindTexture(T.type, null), (T.type = void 0), (T.texture = void 0));
  }
  function r$() {
    try {
      $.compressedTexImage2D(...arguments);
    } catch (T) {
      s$("WebGLState:", T);
    }
  }
  function Z() {
    try {
      $.compressedTexImage3D(...arguments);
    } catch (T) {
      s$("WebGLState:", T);
    }
  }
  function I() {
    try {
      $.texSubImage2D(...arguments);
    } catch (T) {
      s$("WebGLState:", T);
    }
  }
  function y() {
    try {
      $.texSubImage3D(...arguments);
    } catch (T) {
      s$("WebGLState:", T);
    }
  }
  function e() {
    try {
      $.compressedTexSubImage2D(...arguments);
    } catch (T) {
      s$("WebGLState:", T);
    }
  }
  function J$() {
    try {
      $.compressedTexSubImage3D(...arguments);
    } catch (T) {
      s$("WebGLState:", T);
    }
  }
  function K$() {
    try {
      $.texStorage2D(...arguments);
    } catch (T) {
      s$("WebGLState:", T);
    }
  }
  function E$() {
    try {
      $.texStorage3D(...arguments);
    } catch (T) {
      s$("WebGLState:", T);
    }
  }
  function o() {
    try {
      $.texImage2D(...arguments);
    } catch (T) {
      s$("WebGLState:", T);
    }
  }
  function t() {
    try {
      $.texImage3D(...arguments);
    } catch (T) {
      s$("WebGLState:", T);
    }
  }
  function z$(T) {
    if (O[T] !== void 0) return O[T];
    else return $.getParameter(T);
  }
  function j$(T, q$) {
    if (O[T] !== q$) ($.pixelStorei(T, q$), (O[T] = q$));
  }
  function O$(T) {
    if (k6.equals(T) === !1) ($.scissor(T.x, T.y, T.z, T.w), k6.copy(T));
  }
  function L$(T) {
    if (a.equals(T) === !1) ($.viewport(T.x, T.y, T.z, T.w), a.copy(T));
  }
  function Q6(T, q$) {
    let s = G.get(q$);
    if (s === void 0) ((s = new WeakMap()), G.set(q$, s));
    let N$ = s.get(T);
    if (N$ === void 0) ((N$ = $.getUniformBlockIndex(q$, T.name)), s.set(T, N$));
  }
  function K6(T, q$) {
    let N$ = G.get(q$).get(T);
    if (H.get(q$) !== N$) ($.uniformBlockBinding(q$, N$, T.__bindingPointIndex), H.set(q$, N$));
  }
  function E6() {
    ($.disable($.BLEND),
      $.disable($.CULL_FACE),
      $.disable($.DEPTH_TEST),
      $.disable($.POLYGON_OFFSET_FILL),
      $.disable($.SCISSOR_TEST),
      $.disable($.STENCIL_TEST),
      $.disable($.SAMPLE_ALPHA_TO_COVERAGE),
      $.blendEquation($.FUNC_ADD),
      $.blendFunc($.ONE, $.ZERO),
      $.blendFuncSeparate($.ONE, $.ZERO, $.ONE, $.ZERO),
      $.blendColor(0, 0, 0, 0),
      $.colorMask(!0, !0, !0, !0),
      $.clearColor(0, 0, 0, 0),
      $.depthMask(!0),
      $.depthFunc($.LESS),
      Y.setReversed(!1),
      $.clearDepth(1),
      $.stencilMask(4294967295),
      $.stencilFunc($.ALWAYS, 0, 4294967295),
      $.stencilOp($.KEEP, $.KEEP, $.KEEP),
      $.clearStencil(0),
      $.cullFace($.BACK),
      $.frontFace($.CCW),
      $.polygonOffset(0, 0),
      $.activeTexture($.TEXTURE0),
      $.bindFramebuffer($.FRAMEBUFFER, null),
      $.bindFramebuffer($.DRAW_FRAMEBUFFER, null),
      $.bindFramebuffer($.READ_FRAMEBUFFER, null),
      $.useProgram(null),
      $.lineWidth(1),
      $.scissor(0, 0, $.canvas.width, $.canvas.height),
      $.viewport(0, 0, $.canvas.width, $.canvas.height),
      $.pixelStorei($.PACK_ALIGNMENT, 4),
      $.pixelStorei($.UNPACK_ALIGNMENT, 4),
      $.pixelStorei($.UNPACK_FLIP_Y_WEBGL, !1),
      $.pixelStorei($.UNPACK_PREMULTIPLY_ALPHA_WEBGL, !1),
      $.pixelStorei($.UNPACK_COLORSPACE_CONVERSION_WEBGL, $.BROWSER_DEFAULT_WEBGL),
      $.pixelStorei($.PACK_ROW_LENGTH, 0),
      $.pixelStorei($.PACK_SKIP_PIXELS, 0),
      $.pixelStorei($.PACK_SKIP_ROWS, 0),
      $.pixelStorei($.UNPACK_ROW_LENGTH, 0),
      $.pixelStorei($.UNPACK_IMAGE_HEIGHT, 0),
      $.pixelStorei($.UNPACK_SKIP_PIXELS, 0),
      $.pixelStorei($.UNPACK_SKIP_ROWS, 0),
      $.pixelStorei($.UNPACK_SKIP_IMAGES, 0),
      (K = {}),
      (O = {}),
      (k$ = null),
      (h$ = {}),
      (N = {}),
      (F = new WeakMap()),
      (B = []),
      (E = null),
      (z = !1),
      (q = null),
      (L = null),
      (V = null),
      (k = null),
      (R = null),
      (_ = null),
      (S = null),
      (w = new W6(0, 0, 0)),
      (M = 0),
      (m = !1),
      (P = null),
      (u = null),
      (n = null),
      (b = null),
      (i = null),
      k6.set(0, 0, $.canvas.width, $.canvas.height),
      a.set(0, 0, $.canvas.width, $.canvas.height),
      X.reset(),
      Y.reset(),
      D.reset());
  }
  return {
    buffers: { color: X, depth: Y, stencil: D },
    enable: S$,
    disable: o$,
    bindFramebuffer: y6,
    drawBuffers: B6,
    useProgram: A6,
    setBlending: F6,
    setMaterial: v0,
    setFlipSided: m0,
    setCullFace: M0,
    setLineWidth: j,
    setPolygonOffset: e0,
    setScissorTest: Z6,
    activeTexture: f6,
    bindTexture: M$,
    unbindTexture: O0,
    compressedTexImage2D: r$,
    compressedTexImage3D: Z,
    texImage2D: o,
    texImage3D: t,
    pixelStorei: j$,
    getParameter: z$,
    updateUBOMapping: Q6,
    uniformBlockBinding: K6,
    texStorage2D: K$,
    texStorage3D: E$,
    texSubImage2D: I,
    texSubImage3D: y,
    compressedTexSubImage2D: e,
    compressedTexSubImage3D: J$,
    scissor: O$,
    viewport: L$,
    reset: E6,
  };
}
function ki($, J, U, Q, W, X, Y) {
  let D = J.has("WEBGL_multisampled_render_to_texture") ? J.get("WEBGL_multisampled_render_to_texture") : null,
    H = typeof navigator > "u" ? !1 : /OculusBrowser/g.test(navigator.userAgent),
    G = new d$(),
    K = new WeakMap(),
    O = new Set(),
    N,
    F = new WeakMap(),
    B = !1;
  try {
    B = typeof OffscreenCanvas < "u" && new OffscreenCanvas(1, 1).getContext("2d") !== null;
  } catch (Z) {}
  function E(Z, I) {
    return B ? new OffscreenCanvas(Z, I) : b1("canvas");
  }
  function z(Z, I, y) {
    let e = 1,
      J$ = r$(Z);
    if (J$.width > y || J$.height > y) e = y / Math.max(J$.width, J$.height);
    if (e < 1)
      if (
        (typeof HTMLImageElement < "u" && Z instanceof HTMLImageElement) ||
        (typeof HTMLCanvasElement < "u" && Z instanceof HTMLCanvasElement) ||
        (typeof ImageBitmap < "u" && Z instanceof ImageBitmap) ||
        (typeof VideoFrame < "u" && Z instanceof VideoFrame)
      ) {
        let K$ = Math.floor(e * J$.width),
          E$ = Math.floor(e * J$.height);
        if (N === void 0) N = E(K$, E$);
        let o = I ? E(K$, E$) : N;
        return (
          (o.width = K$),
          (o.height = E$),
          o.getContext("2d").drawImage(Z, 0, 0, K$, E$),
          i$(
            "WebGLRenderer: Texture has been resized from (" +
              J$.width +
              "x" +
              J$.height +
              ") to (" +
              K$ +
              "x" +
              E$ +
              ").",
          ),
          o
        );
      } else {
        if ("data" in Z) i$("WebGLRenderer: Image in DataTexture is too big (" + J$.width + "x" + J$.height + ").");
        return Z;
      }
    return Z;
  }
  function q(Z) {
    return Z.generateMipmaps;
  }
  function L(Z) {
    $.generateMipmap(Z);
  }
  function V(Z) {
    if (Z.isWebGLCubeRenderTarget) return $.TEXTURE_CUBE_MAP;
    if (Z.isWebGL3DRenderTarget) return $.TEXTURE_3D;
    if (Z.isWebGLArrayRenderTarget || Z.isCompressedArrayTexture) return $.TEXTURE_2D_ARRAY;
    return $.TEXTURE_2D;
  }
  function k(Z, I, y, e, J$, K$ = !1) {
    if (Z !== null) {
      if ($[Z] !== void 0) return $[Z];
      i$("WebGLRenderer: Attempt to use non-existing WebGL internal format '" + Z + "'");
    }
    let E$;
    if (e) {
      if (((E$ = J.get("EXT_texture_norm16")), !E$))
        i$("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension");
    }
    let o = I;
    if (I === $.RED) {
      if (y === $.FLOAT) o = $.R32F;
      if (y === $.HALF_FLOAT) o = $.R16F;
      if (y === $.UNSIGNED_BYTE) o = $.R8;
      if (y === $.UNSIGNED_SHORT && E$) o = E$.R16_EXT;
      if (y === $.SHORT && E$) o = E$.R16_SNORM_EXT;
    }
    if (I === $.RED_INTEGER) {
      if (y === $.UNSIGNED_BYTE) o = $.R8UI;
      if (y === $.UNSIGNED_SHORT) o = $.R16UI;
      if (y === $.UNSIGNED_INT) o = $.R32UI;
      if (y === $.BYTE) o = $.R8I;
      if (y === $.SHORT) o = $.R16I;
      if (y === $.INT) o = $.R32I;
    }
    if (I === $.RG) {
      if (y === $.FLOAT) o = $.RG32F;
      if (y === $.HALF_FLOAT) o = $.RG16F;
      if (y === $.UNSIGNED_BYTE) o = $.RG8;
      if (y === $.UNSIGNED_SHORT && E$) o = E$.RG16_EXT;
      if (y === $.SHORT && E$) o = E$.RG16_SNORM_EXT;
    }
    if (I === $.RG_INTEGER) {
      if (y === $.UNSIGNED_BYTE) o = $.RG8UI;
      if (y === $.UNSIGNED_SHORT) o = $.RG16UI;
      if (y === $.UNSIGNED_INT) o = $.RG32UI;
      if (y === $.BYTE) o = $.RG8I;
      if (y === $.SHORT) o = $.RG16I;
      if (y === $.INT) o = $.RG32I;
    }
    if (I === $.RGB_INTEGER) {
      if (y === $.UNSIGNED_BYTE) o = $.RGB8UI;
      if (y === $.UNSIGNED_SHORT) o = $.RGB16UI;
      if (y === $.UNSIGNED_INT) o = $.RGB32UI;
      if (y === $.BYTE) o = $.RGB8I;
      if (y === $.SHORT) o = $.RGB16I;
      if (y === $.INT) o = $.RGB32I;
    }
    if (I === $.RGBA_INTEGER) {
      if (y === $.UNSIGNED_BYTE) o = $.RGBA8UI;
      if (y === $.UNSIGNED_SHORT) o = $.RGBA16UI;
      if (y === $.UNSIGNED_INT) o = $.RGBA32UI;
      if (y === $.BYTE) o = $.RGBA8I;
      if (y === $.SHORT) o = $.RGBA16I;
      if (y === $.INT) o = $.RGBA32I;
    }
    if (I === $.RGB) {
      if (y === $.UNSIGNED_SHORT && E$) o = E$.RGB16_EXT;
      if (y === $.SHORT && E$) o = E$.RGB16_SNORM_EXT;
      if (y === $.UNSIGNED_INT_5_9_9_9_REV) o = $.RGB9_E5;
      if (y === $.UNSIGNED_INT_10F_11F_11F_REV) o = $.R11F_G11F_B10F;
    }
    if (I === $.RGBA) {
      let t = K$ ? nB : R6.getTransfer(J$);
      if (y === $.FLOAT) o = $.RGBA32F;
      if (y === $.HALF_FLOAT) o = $.RGBA16F;
      if (y === $.UNSIGNED_BYTE) o = t === W0 ? $.SRGB8_ALPHA8 : $.RGBA8;
      if (y === $.UNSIGNED_SHORT && E$) o = E$.RGBA16_EXT;
      if (y === $.SHORT && E$) o = E$.RGBA16_SNORM_EXT;
      if (y === $.UNSIGNED_SHORT_4_4_4_4) o = $.RGBA4;
      if (y === $.UNSIGNED_SHORT_5_5_5_1) o = $.RGB5_A1;
    }
    if (o === $.R16F || o === $.R32F || o === $.RG16F || o === $.RG32F || o === $.RGBA16F || o === $.RGBA32F)
      J.get("EXT_color_buffer_float");
    return o;
  }
  function R(Z, I) {
    let y;
    if (Z) {
      if (I === null || I === $9 || I === m1) y = $.DEPTH24_STENCIL8;
      else if (I === X8) y = $.DEPTH32F_STENCIL8;
      else if (I === NX)
        ((y = $.DEPTH24_STENCIL8),
          i$("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment."));
    } else if (I === null || I === $9 || I === m1) y = $.DEPTH_COMPONENT24;
    else if (I === X8) y = $.DEPTH_COMPONENT32F;
    else if (I === NX) y = $.DEPTH_COMPONENT16;
    return y;
  }
  function _(Z, I) {
    if (q(Z) === !0 || (Z.isFramebufferTexture && Z.minFilter !== e8 && Z.minFilter !== MJ))
      return Math.log2(Math.max(I.width, I.height)) + 1;
    else if (Z.mipmaps !== void 0 && Z.mipmaps.length > 0) return Z.mipmaps.length;
    else if (Z.isCompressedTexture && Array.isArray(Z.image)) return I.mipmaps.length;
    else return 1;
  }
  function S(Z) {
    let I = Z.target;
    if ((I.removeEventListener("dispose", S), M(I), I.isVideoTexture)) K.delete(I);
    if (I.isHTMLTexture) O.delete(I);
  }
  function w(Z) {
    let I = Z.target;
    (I.removeEventListener("dispose", w), P(I));
  }
  function M(Z) {
    let I = Q.get(Z);
    if (I.__webglInit === void 0) return;
    let y = Z.source,
      e = F.get(y);
    if (e) {
      let J$ = e[I.__cacheKey];
      if ((J$.usedTimes--, J$.usedTimes === 0)) m(Z);
      if (Object.keys(e).length === 0) F.delete(y);
    }
    Q.remove(Z);
  }
  function m(Z) {
    let I = Q.get(Z);
    $.deleteTexture(I.__webglTexture);
    let y = Z.source,
      e = F.get(y);
    (delete e[I.__cacheKey], Y.memory.textures--);
  }
  function P(Z) {
    let I = Q.get(Z);
    if (Z.depthTexture) (Z.depthTexture.dispose(), Q.remove(Z.depthTexture));
    if (Z.isWebGLCubeRenderTarget)
      for (let e = 0; e < 6; e++) {
        if (Array.isArray(I.__webglFramebuffer[e]))
          for (let J$ = 0; J$ < I.__webglFramebuffer[e].length; J$++) $.deleteFramebuffer(I.__webglFramebuffer[e][J$]);
        else $.deleteFramebuffer(I.__webglFramebuffer[e]);
        if (I.__webglDepthbuffer) $.deleteRenderbuffer(I.__webglDepthbuffer[e]);
      }
    else {
      if (Array.isArray(I.__webglFramebuffer))
        for (let e = 0; e < I.__webglFramebuffer.length; e++) $.deleteFramebuffer(I.__webglFramebuffer[e]);
      else $.deleteFramebuffer(I.__webglFramebuffer);
      if (I.__webglDepthbuffer) $.deleteRenderbuffer(I.__webglDepthbuffer);
      if (I.__webglMultisampledFramebuffer) $.deleteFramebuffer(I.__webglMultisampledFramebuffer);
      if (I.__webglColorRenderbuffer) {
        for (let e = 0; e < I.__webglColorRenderbuffer.length; e++)
          if (I.__webglColorRenderbuffer[e]) $.deleteRenderbuffer(I.__webglColorRenderbuffer[e]);
      }
      if (I.__webglDepthRenderbuffer) $.deleteRenderbuffer(I.__webglDepthRenderbuffer);
    }
    let y = Z.textures;
    for (let e = 0, J$ = y.length; e < J$; e++) {
      let K$ = Q.get(y[e]);
      if (K$.__webglTexture) ($.deleteTexture(K$.__webglTexture), Y.memory.textures--);
      Q.remove(y[e]);
    }
    Q.remove(Z);
  }
  let u = 0;
  function n() {
    u = 0;
  }
  function b() {
    return u;
  }
  function i(Z) {
    u = Z;
  }
  function x() {
    let Z = u;
    if (Z >= W.maxTextures)
      i$("WebGLTextures: Trying to use " + Z + " texture units while this GPU supports only " + W.maxTextures);
    return ((u += 1), Z);
  }
  function l(Z) {
    let I = [];
    return (
      I.push(Z.wrapS),
      I.push(Z.wrapT),
      I.push(Z.wrapR || 0),
      I.push(Z.magFilter),
      I.push(Z.minFilter),
      I.push(Z.anisotropy),
      I.push(Z.internalFormat),
      I.push(Z.format),
      I.push(Z.type),
      I.push(Z.generateMipmaps),
      I.push(Z.premultiplyAlpha),
      I.push(Z.flipY),
      I.push(Z.unpackAlignment),
      I.push(Z.colorSpace),
      I.join()
    );
  }
  function r(Z, I) {
    let y = Q.get(Z);
    if (Z.isVideoTexture) M$(Z);
    if (Z.isRenderTargetTexture === !1 && Z.isExternalTexture !== !0 && Z.version > 0 && y.__version !== Z.version) {
      let e = Z.image;
      if (e === null) i$("WebGLRenderer: Texture marked for update but no image data found.");
      else if (e.complete === !1) i$("WebGLRenderer: Texture marked for update but image is incomplete");
      else {
        o$(y, Z, I);
        return;
      }
    } else if (Z.isExternalTexture) y.__webglTexture = Z.sourceTexture ? Z.sourceTexture : null;
    U.bindTexture($.TEXTURE_2D, y.__webglTexture, $.TEXTURE0 + I);
  }
  function G$(Z, I) {
    let y = Q.get(Z);
    if (Z.isRenderTargetTexture === !1 && Z.version > 0 && y.__version !== Z.version) {
      o$(y, Z, I);
      return;
    } else if (Z.isExternalTexture) y.__webglTexture = Z.sourceTexture ? Z.sourceTexture : null;
    U.bindTexture($.TEXTURE_2D_ARRAY, y.__webglTexture, $.TEXTURE0 + I);
  }
  function k$(Z, I) {
    let y = Q.get(Z);
    if (Z.isRenderTargetTexture === !1 && Z.version > 0 && y.__version !== Z.version) {
      o$(y, Z, I);
      return;
    }
    U.bindTexture($.TEXTURE_3D, y.__webglTexture, $.TEXTURE0 + I);
  }
  function h$(Z, I) {
    let y = Q.get(Z);
    if (Z.isCubeDepthTexture !== !0 && Z.version > 0 && y.__version !== Z.version) {
      y6(y, Z, I);
      return;
    }
    U.bindTexture($.TEXTURE_CUBE_MAP, y.__webglTexture, $.TEXTURE0 + I);
  }
  let b$ = { [$P]: $.REPEAT, [OG]: $.CLAMP_TO_EDGE, [JP]: $.MIRRORED_REPEAT },
    b6 = {
      [e8]: $.NEAREST,
      [UP]: $.NEAREST_MIPMAP_NEAREST,
      [KX]: $.NEAREST_MIPMAP_LINEAR,
      [MJ]: $.LINEAR,
      [FG]: $.LINEAR_MIPMAP_NEAREST,
      [g9]: $.LINEAR_MIPMAP_LINEAR,
    },
    k6 = {
      [NP]: $.NEVER,
      [BP]: $.ALWAYS,
      [OP]: $.LESS,
      [IG]: $.LEQUAL,
      [FP]: $.EQUAL,
      [VG]: $.GEQUAL,
      [qP]: $.GREATER,
      [zP]: $.NOTEQUAL,
    };
  function a(Z, I) {
    if (
      I.type === X8 &&
      J.has("OES_texture_float_linear") === !1 &&
      (I.magFilter === MJ ||
        I.magFilter === FG ||
        I.magFilter === KX ||
        I.magFilter === g9 ||
        I.minFilter === MJ ||
        I.minFilter === FG ||
        I.minFilter === KX ||
        I.minFilter === g9)
    )
      i$(
        "WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device.",
      );
    if (
      ($.texParameteri(Z, $.TEXTURE_WRAP_S, b$[I.wrapS]),
      $.texParameteri(Z, $.TEXTURE_WRAP_T, b$[I.wrapT]),
      Z === $.TEXTURE_3D || Z === $.TEXTURE_2D_ARRAY)
    )
      $.texParameteri(Z, $.TEXTURE_WRAP_R, b$[I.wrapR]);
    if (
      ($.texParameteri(Z, $.TEXTURE_MAG_FILTER, b6[I.magFilter]),
      $.texParameteri(Z, $.TEXTURE_MIN_FILTER, b6[I.minFilter]),
      I.compareFunction)
    )
      ($.texParameteri(Z, $.TEXTURE_COMPARE_MODE, $.COMPARE_REF_TO_TEXTURE),
        $.texParameteri(Z, $.TEXTURE_COMPARE_FUNC, k6[I.compareFunction]));
    if (J.has("EXT_texture_filter_anisotropic") === !0) {
      if (I.magFilter === e8) return;
      if (I.minFilter !== KX && I.minFilter !== g9) return;
      if (I.type === X8 && J.has("OES_texture_float_linear") === !1) return;
      if (I.anisotropy > 1 || Q.get(I).__currentAnisotropy) {
        let y = J.get("EXT_texture_filter_anisotropic");
        ($.texParameterf(Z, y.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(I.anisotropy, W.getMaxAnisotropy())),
          (Q.get(I).__currentAnisotropy = I.anisotropy));
      }
    }
  }
  function Z$(Z, I) {
    let y = !1;
    if (Z.__webglInit === void 0) ((Z.__webglInit = !0), I.addEventListener("dispose", S));
    let e = I.source,
      J$ = F.get(e);
    if (J$ === void 0) ((J$ = {}), F.set(e, J$));
    let K$ = l(I);
    if (K$ !== Z.__cacheKey) {
      if (J$[K$] === void 0) ((J$[K$] = { texture: $.createTexture(), usedTimes: 0 }), Y.memory.textures++, (y = !0));
      J$[K$].usedTimes++;
      let E$ = J$[Z.__cacheKey];
      if (E$ !== void 0) {
        if ((J$[Z.__cacheKey].usedTimes--, E$.usedTimes === 0)) m(I);
      }
      ((Z.__cacheKey = K$), (Z.__webglTexture = J$[K$].texture));
    }
    return y;
  }
  function u$(Z, I, y) {
    return Math.floor(Math.floor(Z / y) / I);
  }
  function S$(Z, I, y, e) {
    let K$ = Z.updateRanges;
    if (K$.length === 0) U.texSubImage2D($.TEXTURE_2D, 0, 0, 0, I.width, I.height, y, e, I.data);
    else {
      K$.sort((j$, O$) => j$.start - O$.start);
      let E$ = 0;
      for (let j$ = 1; j$ < K$.length; j$++) {
        let O$ = K$[E$],
          L$ = K$[j$],
          Q6 = O$.start + O$.count,
          K6 = u$(L$.start, I.width, 4),
          E6 = u$(O$.start, I.width, 4);
        if (L$.start <= Q6 + 1 && K6 === E6 && u$(L$.start + L$.count - 1, I.width, 4) === K6)
          O$.count = Math.max(O$.count, L$.start + L$.count - O$.start);
        else (++E$, (K$[E$] = L$));
      }
      K$.length = E$ + 1;
      let o = U.getParameter($.UNPACK_ROW_LENGTH),
        t = U.getParameter($.UNPACK_SKIP_PIXELS),
        z$ = U.getParameter($.UNPACK_SKIP_ROWS);
      U.pixelStorei($.UNPACK_ROW_LENGTH, I.width);
      for (let j$ = 0, O$ = K$.length; j$ < O$; j$++) {
        let L$ = K$[j$],
          Q6 = Math.floor(L$.start / 4),
          K6 = Math.ceil(L$.count / 4),
          E6 = Q6 % I.width,
          T = Math.floor(Q6 / I.width),
          q$ = K6,
          s = 1;
        (U.pixelStorei($.UNPACK_SKIP_PIXELS, E6),
          U.pixelStorei($.UNPACK_SKIP_ROWS, T),
          U.texSubImage2D($.TEXTURE_2D, 0, E6, T, q$, 1, y, e, I.data));
      }
      (Z.clearUpdateRanges(),
        U.pixelStorei($.UNPACK_ROW_LENGTH, o),
        U.pixelStorei($.UNPACK_SKIP_PIXELS, t),
        U.pixelStorei($.UNPACK_SKIP_ROWS, z$));
    }
  }
  function o$(Z, I, y) {
    let e = $.TEXTURE_2D;
    if (I.isDataArrayTexture || I.isCompressedArrayTexture) e = $.TEXTURE_2D_ARRAY;
    if (I.isData3DTexture) e = $.TEXTURE_3D;
    let J$ = Z$(Z, I),
      K$ = I.source;
    U.bindTexture(e, Z.__webglTexture, $.TEXTURE0 + y);
    let E$ = Q.get(K$);
    if (K$.version !== E$.__version || J$ === !0) {
      if ((U.activeTexture($.TEXTURE0 + y), (typeof ImageBitmap < "u" && I.image instanceof ImageBitmap) === !1)) {
        let s = R6.getPrimaries(R6.workingColorSpace),
          N$ = I.colorSpace === m9 ? null : R6.getPrimaries(I.colorSpace),
          v$ = I.colorSpace === m9 || s === N$ ? $.NONE : $.BROWSER_DEFAULT_WEBGL;
        (U.pixelStorei($.UNPACK_FLIP_Y_WEBGL, I.flipY),
          U.pixelStorei($.UNPACK_PREMULTIPLY_ALPHA_WEBGL, I.premultiplyAlpha),
          U.pixelStorei($.UNPACK_COLORSPACE_CONVERSION_WEBGL, v$));
      }
      U.pixelStorei($.UNPACK_ALIGNMENT, I.unpackAlignment);
      let t = z(I.image, !1, W.maxTextureSize);
      t = O0(I, t);
      let z$ = X.convert(I.format, I.colorSpace),
        j$ = X.convert(I.type),
        O$ = k(I.internalFormat, z$, j$, I.normalized, I.colorSpace, I.isVideoTexture);
      a(e, I);
      let L$,
        Q6 = I.mipmaps,
        K6 = I.isVideoTexture !== !0,
        E6 = E$.__version === void 0 || J$ === !0,
        T = K$.dataReady,
        q$ = _(I, t);
      if (I.isDepthTexture) {
        if (((O$ = R(I.format === u9, I.type)), E6))
          if (K6) U.texStorage2D($.TEXTURE_2D, 1, O$, t.width, t.height);
          else U.texImage2D($.TEXTURE_2D, 0, O$, t.width, t.height, 0, z$, j$, null);
      } else if (I.isDataTexture)
        if (Q6.length > 0) {
          if (K6 && E6) U.texStorage2D($.TEXTURE_2D, q$, O$, Q6[0].width, Q6[0].height);
          for (let s = 0, N$ = Q6.length; s < N$; s++)
            if (((L$ = Q6[s]), K6)) {
              if (T) U.texSubImage2D($.TEXTURE_2D, s, 0, 0, L$.width, L$.height, z$, j$, L$.data);
            } else U.texImage2D($.TEXTURE_2D, s, O$, L$.width, L$.height, 0, z$, j$, L$.data);
          I.generateMipmaps = !1;
        } else if (K6) {
          if (E6) U.texStorage2D($.TEXTURE_2D, q$, O$, t.width, t.height);
          if (T) S$(I, t, z$, j$);
        } else U.texImage2D($.TEXTURE_2D, 0, O$, t.width, t.height, 0, z$, j$, t.data);
      else if (I.isCompressedTexture)
        if (I.isCompressedArrayTexture) {
          if (K6 && E6) U.texStorage3D($.TEXTURE_2D_ARRAY, q$, O$, Q6[0].width, Q6[0].height, t.depth);
          for (let s = 0, N$ = Q6.length; s < N$; s++)
            if (((L$ = Q6[s]), I.format !== jU))
              if (z$ !== null)
                if (K6) {
                  if (T)
                    if (I.layerUpdates.size > 0) {
                      let v$ = kE(L$.width, L$.height, I.format, I.type);
                      for (let W$ of I.layerUpdates) {
                        let l$ = L$.data.subarray(
                          (W$ * v$) / L$.data.BYTES_PER_ELEMENT,
                          ((W$ + 1) * v$) / L$.data.BYTES_PER_ELEMENT,
                        );
                        U.compressedTexSubImage3D($.TEXTURE_2D_ARRAY, s, 0, 0, W$, L$.width, L$.height, 1, z$, l$);
                      }
                      I.clearLayerUpdates();
                    } else
                      U.compressedTexSubImage3D(
                        $.TEXTURE_2D_ARRAY,
                        s,
                        0,
                        0,
                        0,
                        L$.width,
                        L$.height,
                        t.depth,
                        z$,
                        L$.data,
                      );
                } else
                  U.compressedTexImage3D($.TEXTURE_2D_ARRAY, s, O$, L$.width, L$.height, t.depth, 0, L$.data, 0, 0);
              else i$("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");
            else if (K6) {
              if (T) U.texSubImage3D($.TEXTURE_2D_ARRAY, s, 0, 0, 0, L$.width, L$.height, t.depth, z$, j$, L$.data);
            } else U.texImage3D($.TEXTURE_2D_ARRAY, s, O$, L$.width, L$.height, t.depth, 0, z$, j$, L$.data);
        } else {
          if (K6 && E6) U.texStorage2D($.TEXTURE_2D, q$, O$, Q6[0].width, Q6[0].height);
          for (let s = 0, N$ = Q6.length; s < N$; s++)
            if (((L$ = Q6[s]), I.format !== jU))
              if (z$ !== null)
                if (K6) {
                  if (T) U.compressedTexSubImage2D($.TEXTURE_2D, s, 0, 0, L$.width, L$.height, z$, L$.data);
                } else U.compressedTexImage2D($.TEXTURE_2D, s, O$, L$.width, L$.height, 0, L$.data);
              else i$("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");
            else if (K6) {
              if (T) U.texSubImage2D($.TEXTURE_2D, s, 0, 0, L$.width, L$.height, z$, j$, L$.data);
            } else U.texImage2D($.TEXTURE_2D, s, O$, L$.width, L$.height, 0, z$, j$, L$.data);
        }
      else if (I.isDataArrayTexture)
        if (K6) {
          if (E6) U.texStorage3D($.TEXTURE_2D_ARRAY, q$, O$, t.width, t.height, t.depth);
          if (T)
            if (I.layerUpdates.size > 0) {
              let s = kE(t.width, t.height, I.format, I.type);
              for (let N$ of I.layerUpdates) {
                let v$ = t.data.subarray(
                  (N$ * s) / t.data.BYTES_PER_ELEMENT,
                  ((N$ + 1) * s) / t.data.BYTES_PER_ELEMENT,
                );
                U.texSubImage3D($.TEXTURE_2D_ARRAY, 0, 0, 0, N$, t.width, t.height, 1, z$, j$, v$);
              }
              I.clearLayerUpdates();
            } else U.texSubImage3D($.TEXTURE_2D_ARRAY, 0, 0, 0, 0, t.width, t.height, t.depth, z$, j$, t.data);
        } else U.texImage3D($.TEXTURE_2D_ARRAY, 0, O$, t.width, t.height, t.depth, 0, z$, j$, t.data);
      else if (I.isData3DTexture)
        if (K6) {
          if (E6) U.texStorage3D($.TEXTURE_3D, q$, O$, t.width, t.height, t.depth);
          if (T) U.texSubImage3D($.TEXTURE_3D, 0, 0, 0, 0, t.width, t.height, t.depth, z$, j$, t.data);
        } else U.texImage3D($.TEXTURE_3D, 0, O$, t.width, t.height, t.depth, 0, z$, j$, t.data);
      else if (I.isFramebufferTexture) {
        if (E6)
          if (K6) U.texStorage2D($.TEXTURE_2D, q$, O$, t.width, t.height);
          else {
            let { width: s, height: N$ } = t;
            for (let v$ = 0; v$ < q$; v$++)
              (U.texImage2D($.TEXTURE_2D, v$, O$, s, N$, 0, z$, j$, null), (s >>= 1), (N$ >>= 1));
          }
      } else if (I.isHTMLTexture) {
        if ("texElementImage2D" in $) {
          let s = $.canvas;
          if (!s.hasAttribute("layoutsubtree")) s.setAttribute("layoutsubtree", "true");
          if (t.parentNode !== s) {
            (s.appendChild(t),
              O.add(I),
              (s.onpaint = (Y6) => {
                let R0 = Y6.changedElements;
                for (let d6 of O) if (R0.includes(d6.image)) d6.needsUpdate = !0;
              }),
              s.requestPaint());
            return;
          }
          let N$ = 0,
            v$ = $.RGBA,
            W$ = $.RGBA,
            l$ = $.UNSIGNED_BYTE;
          ($.texElementImage2D($.TEXTURE_2D, N$, v$, W$, l$, t),
            $.texParameteri($.TEXTURE_2D, $.TEXTURE_MIN_FILTER, $.LINEAR),
            $.texParameteri($.TEXTURE_2D, $.TEXTURE_WRAP_S, $.CLAMP_TO_EDGE),
            $.texParameteri($.TEXTURE_2D, $.TEXTURE_WRAP_T, $.CLAMP_TO_EDGE));
        }
      } else if (Q6.length > 0) {
        if (K6 && E6) {
          let s = r$(Q6[0]);
          U.texStorage2D($.TEXTURE_2D, q$, O$, s.width, s.height);
        }
        for (let s = 0, N$ = Q6.length; s < N$; s++)
          if (((L$ = Q6[s]), K6)) {
            if (T) U.texSubImage2D($.TEXTURE_2D, s, 0, 0, z$, j$, L$);
          } else U.texImage2D($.TEXTURE_2D, s, O$, z$, j$, L$);
        I.generateMipmaps = !1;
      } else if (K6) {
        if (E6) {
          let s = r$(t);
          U.texStorage2D($.TEXTURE_2D, q$, O$, s.width, s.height);
        }
        if (T) U.texSubImage2D($.TEXTURE_2D, 0, 0, 0, z$, j$, t);
      } else U.texImage2D($.TEXTURE_2D, 0, O$, z$, j$, t);
      if (q(I)) L(e);
      if (((E$.__version = K$.version), I.onUpdate)) I.onUpdate(I);
    }
    Z.__version = I.version;
  }
  function y6(Z, I, y) {
    if (I.image.length !== 6) return;
    let e = Z$(Z, I),
      J$ = I.source;
    U.bindTexture($.TEXTURE_CUBE_MAP, Z.__webglTexture, $.TEXTURE0 + y);
    let K$ = Q.get(J$);
    if (J$.version !== K$.__version || e === !0) {
      U.activeTexture($.TEXTURE0 + y);
      let E$ = R6.getPrimaries(R6.workingColorSpace),
        o = I.colorSpace === m9 ? null : R6.getPrimaries(I.colorSpace),
        t = I.colorSpace === m9 || E$ === o ? $.NONE : $.BROWSER_DEFAULT_WEBGL;
      (U.pixelStorei($.UNPACK_FLIP_Y_WEBGL, I.flipY),
        U.pixelStorei($.UNPACK_PREMULTIPLY_ALPHA_WEBGL, I.premultiplyAlpha),
        U.pixelStorei($.UNPACK_ALIGNMENT, I.unpackAlignment),
        U.pixelStorei($.UNPACK_COLORSPACE_CONVERSION_WEBGL, t));
      let z$ = I.isCompressedTexture || I.image[0].isCompressedTexture,
        j$ = I.image[0] && I.image[0].isDataTexture,
        O$ = [];
      for (let W$ = 0; W$ < 6; W$++) {
        if (!z$ && !j$) O$[W$] = z(I.image[W$], !0, W.maxCubemapSize);
        else O$[W$] = j$ ? I.image[W$].image : I.image[W$];
        O$[W$] = O0(I, O$[W$]);
      }
      let L$ = O$[0],
        Q6 = X.convert(I.format, I.colorSpace),
        K6 = X.convert(I.type),
        E6 = k(I.internalFormat, Q6, K6, I.normalized, I.colorSpace),
        T = I.isVideoTexture !== !0,
        q$ = K$.__version === void 0 || e === !0,
        s = J$.dataReady,
        N$ = _(I, L$);
      a($.TEXTURE_CUBE_MAP, I);
      let v$;
      if (z$) {
        if (T && q$) U.texStorage2D($.TEXTURE_CUBE_MAP, N$, E6, L$.width, L$.height);
        for (let W$ = 0; W$ < 6; W$++) {
          v$ = O$[W$].mipmaps;
          for (let l$ = 0; l$ < v$.length; l$++) {
            let Y6 = v$[l$];
            if (I.format !== jU)
              if (Q6 !== null)
                if (T) {
                  if (s)
                    U.compressedTexSubImage2D(
                      $.TEXTURE_CUBE_MAP_POSITIVE_X + W$,
                      l$,
                      0,
                      0,
                      Y6.width,
                      Y6.height,
                      Q6,
                      Y6.data,
                    );
                } else
                  U.compressedTexImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X + W$, l$, E6, Y6.width, Y6.height, 0, Y6.data);
              else i$("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()");
            else if (T) {
              if (s)
                U.texSubImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X + W$, l$, 0, 0, Y6.width, Y6.height, Q6, K6, Y6.data);
            } else U.texImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X + W$, l$, E6, Y6.width, Y6.height, 0, Q6, K6, Y6.data);
          }
        }
      } else {
        if (((v$ = I.mipmaps), T && q$)) {
          if (v$.length > 0) N$++;
          let W$ = r$(O$[0]);
          U.texStorage2D($.TEXTURE_CUBE_MAP, N$, E6, W$.width, W$.height);
        }
        for (let W$ = 0; W$ < 6; W$++)
          if (j$) {
            if (T) {
              if (s)
                U.texSubImage2D(
                  $.TEXTURE_CUBE_MAP_POSITIVE_X + W$,
                  0,
                  0,
                  0,
                  O$[W$].width,
                  O$[W$].height,
                  Q6,
                  K6,
                  O$[W$].data,
                );
            } else
              U.texImage2D(
                $.TEXTURE_CUBE_MAP_POSITIVE_X + W$,
                0,
                E6,
                O$[W$].width,
                O$[W$].height,
                0,
                Q6,
                K6,
                O$[W$].data,
              );
            for (let l$ = 0; l$ < v$.length; l$++) {
              let R0 = v$[l$].image[W$].image;
              if (T) {
                if (s)
                  U.texSubImage2D(
                    $.TEXTURE_CUBE_MAP_POSITIVE_X + W$,
                    l$ + 1,
                    0,
                    0,
                    R0.width,
                    R0.height,
                    Q6,
                    K6,
                    R0.data,
                  );
              } else
                U.texImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X + W$, l$ + 1, E6, R0.width, R0.height, 0, Q6, K6, R0.data);
            }
          } else {
            if (T) {
              if (s) U.texSubImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X + W$, 0, 0, 0, Q6, K6, O$[W$]);
            } else U.texImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X + W$, 0, E6, Q6, K6, O$[W$]);
            for (let l$ = 0; l$ < v$.length; l$++) {
              let Y6 = v$[l$];
              if (T) {
                if (s) U.texSubImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X + W$, l$ + 1, 0, 0, Q6, K6, Y6.image[W$]);
              } else U.texImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X + W$, l$ + 1, E6, Q6, K6, Y6.image[W$]);
            }
          }
      }
      if (q(I)) L($.TEXTURE_CUBE_MAP);
      if (((K$.__version = J$.version), I.onUpdate)) I.onUpdate(I);
    }
    Z.__version = I.version;
  }
  function B6(Z, I, y, e, J$, K$) {
    let E$ = X.convert(y.format, y.colorSpace),
      o = X.convert(y.type),
      t = k(y.internalFormat, E$, o, y.normalized, y.colorSpace),
      z$ = Q.get(I),
      j$ = Q.get(y);
    if (((j$.__renderTarget = I), !z$.__hasExternalTextures)) {
      let O$ = Math.max(1, I.width >> K$),
        L$ = Math.max(1, I.height >> K$);
      if (J$ === $.TEXTURE_3D || J$ === $.TEXTURE_2D_ARRAY) U.texImage3D(J$, K$, t, O$, L$, I.depth, 0, E$, o, null);
      else U.texImage2D(J$, K$, t, O$, L$, 0, E$, o, null);
    }
    if ((U.bindFramebuffer($.FRAMEBUFFER, Z), f6(I)))
      D.framebufferTexture2DMultisampleEXT($.FRAMEBUFFER, e, J$, j$.__webglTexture, 0, Z6(I));
    else if (J$ === $.TEXTURE_2D || (J$ >= $.TEXTURE_CUBE_MAP_POSITIVE_X && J$ <= $.TEXTURE_CUBE_MAP_NEGATIVE_Z))
      $.framebufferTexture2D($.FRAMEBUFFER, e, J$, j$.__webglTexture, K$);
    U.bindFramebuffer($.FRAMEBUFFER, null);
  }
  function A6(Z, I, y) {
    if (($.bindRenderbuffer($.RENDERBUFFER, Z), I.depthBuffer)) {
      let e = I.depthTexture,
        J$ = e && e.isDepthTexture ? e.type : null,
        K$ = R(I.stencilBuffer, J$),
        E$ = I.stencilBuffer ? $.DEPTH_STENCIL_ATTACHMENT : $.DEPTH_ATTACHMENT;
      if (f6(I)) D.renderbufferStorageMultisampleEXT($.RENDERBUFFER, Z6(I), K$, I.width, I.height);
      else if (y) $.renderbufferStorageMultisample($.RENDERBUFFER, Z6(I), K$, I.width, I.height);
      else $.renderbufferStorage($.RENDERBUFFER, K$, I.width, I.height);
      $.framebufferRenderbuffer($.FRAMEBUFFER, E$, $.RENDERBUFFER, Z);
    } else {
      let e = I.textures;
      for (let J$ = 0; J$ < e.length; J$++) {
        let K$ = e[J$],
          E$ = X.convert(K$.format, K$.colorSpace),
          o = X.convert(K$.type),
          t = k(K$.internalFormat, E$, o, K$.normalized, K$.colorSpace);
        if (f6(I)) D.renderbufferStorageMultisampleEXT($.RENDERBUFFER, Z6(I), t, I.width, I.height);
        else if (y) $.renderbufferStorageMultisample($.RENDERBUFFER, Z6(I), t, I.width, I.height);
        else $.renderbufferStorage($.RENDERBUFFER, t, I.width, I.height);
      }
    }
    $.bindRenderbuffer($.RENDERBUFFER, null);
  }
  function a6(Z, I, y) {
    let e = I.isWebGLCubeRenderTarget === !0;
    if ((U.bindFramebuffer($.FRAMEBUFFER, Z), !(I.depthTexture && I.depthTexture.isDepthTexture)))
      throw Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");
    let J$ = Q.get(I.depthTexture);
    if (
      ((J$.__renderTarget = I),
      !J$.__webglTexture || I.depthTexture.image.width !== I.width || I.depthTexture.image.height !== I.height)
    )
      ((I.depthTexture.image.width = I.width),
        (I.depthTexture.image.height = I.height),
        (I.depthTexture.needsUpdate = !0));
    if (e) {
      if (J$.__webglInit === void 0) ((J$.__webglInit = !0), I.depthTexture.addEventListener("dispose", S));
      if (J$.__webglTexture === void 0) {
        ((J$.__webglTexture = $.createTexture()),
          U.bindTexture($.TEXTURE_CUBE_MAP, J$.__webglTexture),
          a($.TEXTURE_CUBE_MAP, I.depthTexture));
        let z$ = X.convert(I.depthTexture.format),
          j$ = X.convert(I.depthTexture.type),
          O$;
        if (I.depthTexture.format === h9) O$ = $.DEPTH_COMPONENT24;
        else if (I.depthTexture.format === u9) O$ = $.DEPTH24_STENCIL8;
        for (let L$ = 0; L$ < 6; L$++)
          $.texImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X + L$, 0, O$, I.width, I.height, 0, z$, j$, null);
      }
    } else r(I.depthTexture, 0);
    let K$ = J$.__webglTexture,
      E$ = Z6(I),
      o = e ? $.TEXTURE_CUBE_MAP_POSITIVE_X + y : $.TEXTURE_2D,
      t = I.depthTexture.format === u9 ? $.DEPTH_STENCIL_ATTACHMENT : $.DEPTH_ATTACHMENT;
    if (I.depthTexture.format === h9)
      if (f6(I)) D.framebufferTexture2DMultisampleEXT($.FRAMEBUFFER, t, o, K$, 0, E$);
      else $.framebufferTexture2D($.FRAMEBUFFER, t, o, K$, 0);
    else if (I.depthTexture.format === u9)
      if (f6(I)) D.framebufferTexture2DMultisampleEXT($.FRAMEBUFFER, t, o, K$, 0, E$);
      else $.framebufferTexture2D($.FRAMEBUFFER, t, o, K$, 0);
    else throw Error("Unknown depthTexture format");
  }
  function t6(Z) {
    let I = Q.get(Z),
      y = Z.isWebGLCubeRenderTarget === !0;
    if (I.__boundDepthTexture !== Z.depthTexture) {
      let e = Z.depthTexture;
      if (I.__depthDisposeCallback) I.__depthDisposeCallback();
      if (e) {
        let J$ = () => {
          (delete I.__boundDepthTexture, delete I.__depthDisposeCallback, e.removeEventListener("dispose", J$));
        };
        (e.addEventListener("dispose", J$), (I.__depthDisposeCallback = J$));
      }
      I.__boundDepthTexture = e;
    }
    if (Z.depthTexture && !I.__autoAllocateDepthBuffer)
      if (y) for (let e = 0; e < 6; e++) a6(I.__webglFramebuffer[e], Z, e);
      else {
        let e = Z.texture.mipmaps;
        if (e && e.length > 0) a6(I.__webglFramebuffer[0], Z, 0);
        else a6(I.__webglFramebuffer, Z, 0);
      }
    else if (y) {
      I.__webglDepthbuffer = [];
      for (let e = 0; e < 6; e++)
        if ((U.bindFramebuffer($.FRAMEBUFFER, I.__webglFramebuffer[e]), I.__webglDepthbuffer[e] === void 0))
          ((I.__webglDepthbuffer[e] = $.createRenderbuffer()), A6(I.__webglDepthbuffer[e], Z, !1));
        else {
          let J$ = Z.stencilBuffer ? $.DEPTH_STENCIL_ATTACHMENT : $.DEPTH_ATTACHMENT,
            K$ = I.__webglDepthbuffer[e];
          ($.bindRenderbuffer($.RENDERBUFFER, K$), $.framebufferRenderbuffer($.FRAMEBUFFER, J$, $.RENDERBUFFER, K$));
        }
    } else {
      let e = Z.texture.mipmaps;
      if (e && e.length > 0) U.bindFramebuffer($.FRAMEBUFFER, I.__webglFramebuffer[0]);
      else U.bindFramebuffer($.FRAMEBUFFER, I.__webglFramebuffer);
      if (I.__webglDepthbuffer === void 0)
        ((I.__webglDepthbuffer = $.createRenderbuffer()), A6(I.__webglDepthbuffer, Z, !1));
      else {
        let J$ = Z.stencilBuffer ? $.DEPTH_STENCIL_ATTACHMENT : $.DEPTH_ATTACHMENT,
          K$ = I.__webglDepthbuffer;
        ($.bindRenderbuffer($.RENDERBUFFER, K$), $.framebufferRenderbuffer($.FRAMEBUFFER, J$, $.RENDERBUFFER, K$));
      }
    }
    U.bindFramebuffer($.FRAMEBUFFER, null);
  }
  function F6(Z, I, y) {
    let e = Q.get(Z);
    if (I !== void 0) B6(e.__webglFramebuffer, Z, Z.texture, $.COLOR_ATTACHMENT0, $.TEXTURE_2D, 0);
    if (y !== void 0) t6(Z);
  }
  function v0(Z) {
    let I = Z.texture,
      y = Q.get(Z),
      e = Q.get(I);
    Z.addEventListener("dispose", w);
    let J$ = Z.textures,
      K$ = Z.isWebGLCubeRenderTarget === !0,
      E$ = J$.length > 1;
    if (!E$) {
      if (e.__webglTexture === void 0) e.__webglTexture = $.createTexture();
      ((e.__version = I.version), Y.memory.textures++);
    }
    if (K$) {
      y.__webglFramebuffer = [];
      for (let o = 0; o < 6; o++)
        if (I.mipmaps && I.mipmaps.length > 0) {
          y.__webglFramebuffer[o] = [];
          for (let t = 0; t < I.mipmaps.length; t++) y.__webglFramebuffer[o][t] = $.createFramebuffer();
        } else y.__webglFramebuffer[o] = $.createFramebuffer();
    } else {
      if (I.mipmaps && I.mipmaps.length > 0) {
        y.__webglFramebuffer = [];
        for (let o = 0; o < I.mipmaps.length; o++) y.__webglFramebuffer[o] = $.createFramebuffer();
      } else y.__webglFramebuffer = $.createFramebuffer();
      if (E$)
        for (let o = 0, t = J$.length; o < t; o++) {
          let z$ = Q.get(J$[o]);
          if (z$.__webglTexture === void 0) ((z$.__webglTexture = $.createTexture()), Y.memory.textures++);
        }
      if (Z.samples > 0 && f6(Z) === !1) {
        ((y.__webglMultisampledFramebuffer = $.createFramebuffer()),
          (y.__webglColorRenderbuffer = []),
          U.bindFramebuffer($.FRAMEBUFFER, y.__webglMultisampledFramebuffer));
        for (let o = 0; o < J$.length; o++) {
          let t = J$[o];
          ((y.__webglColorRenderbuffer[o] = $.createRenderbuffer()),
            $.bindRenderbuffer($.RENDERBUFFER, y.__webglColorRenderbuffer[o]));
          let z$ = X.convert(t.format, t.colorSpace),
            j$ = X.convert(t.type),
            O$ = k(t.internalFormat, z$, j$, t.normalized, t.colorSpace, Z.isXRRenderTarget === !0),
            L$ = Z6(Z);
          ($.renderbufferStorageMultisample($.RENDERBUFFER, L$, O$, Z.width, Z.height),
            $.framebufferRenderbuffer(
              $.FRAMEBUFFER,
              $.COLOR_ATTACHMENT0 + o,
              $.RENDERBUFFER,
              y.__webglColorRenderbuffer[o],
            ));
        }
        if (($.bindRenderbuffer($.RENDERBUFFER, null), Z.depthBuffer))
          ((y.__webglDepthRenderbuffer = $.createRenderbuffer()), A6(y.__webglDepthRenderbuffer, Z, !0));
        U.bindFramebuffer($.FRAMEBUFFER, null);
      }
    }
    if (K$) {
      (U.bindTexture($.TEXTURE_CUBE_MAP, e.__webglTexture), a($.TEXTURE_CUBE_MAP, I));
      for (let o = 0; o < 6; o++)
        if (I.mipmaps && I.mipmaps.length > 0)
          for (let t = 0; t < I.mipmaps.length; t++)
            B6(y.__webglFramebuffer[o][t], Z, I, $.COLOR_ATTACHMENT0, $.TEXTURE_CUBE_MAP_POSITIVE_X + o, t);
        else B6(y.__webglFramebuffer[o], Z, I, $.COLOR_ATTACHMENT0, $.TEXTURE_CUBE_MAP_POSITIVE_X + o, 0);
      if (q(I)) L($.TEXTURE_CUBE_MAP);
      U.unbindTexture();
    } else if (E$) {
      for (let o = 0, t = J$.length; o < t; o++) {
        let z$ = J$[o],
          j$ = Q.get(z$),
          O$ = $.TEXTURE_2D;
        if (Z.isWebGL3DRenderTarget || Z.isWebGLArrayRenderTarget)
          O$ = Z.isWebGL3DRenderTarget ? $.TEXTURE_3D : $.TEXTURE_2D_ARRAY;
        if (
          (U.bindTexture(O$, j$.__webglTexture),
          a(O$, z$),
          B6(y.__webglFramebuffer, Z, z$, $.COLOR_ATTACHMENT0 + o, O$, 0),
          q(z$))
        )
          L(O$);
      }
      U.unbindTexture();
    } else {
      let o = $.TEXTURE_2D;
      if (Z.isWebGL3DRenderTarget || Z.isWebGLArrayRenderTarget)
        o = Z.isWebGL3DRenderTarget ? $.TEXTURE_3D : $.TEXTURE_2D_ARRAY;
      if ((U.bindTexture(o, e.__webglTexture), a(o, I), I.mipmaps && I.mipmaps.length > 0))
        for (let t = 0; t < I.mipmaps.length; t++) B6(y.__webglFramebuffer[t], Z, I, $.COLOR_ATTACHMENT0, o, t);
      else B6(y.__webglFramebuffer, Z, I, $.COLOR_ATTACHMENT0, o, 0);
      if (q(I)) L(o);
      U.unbindTexture();
    }
    if (Z.depthBuffer) t6(Z);
  }
  function m0(Z) {
    let I = Z.textures;
    for (let y = 0, e = I.length; y < e; y++) {
      let J$ = I[y];
      if (q(J$)) {
        let K$ = V(Z),
          E$ = Q.get(J$).__webglTexture;
        (U.bindTexture(K$, E$), L(K$), U.unbindTexture());
      }
    }
  }
  let M0 = [],
    j = [];
  function e0(Z) {
    if (Z.samples > 0) {
      if (f6(Z) === !1) {
        let { textures: I, width: y, height: e } = Z,
          J$ = $.COLOR_BUFFER_BIT,
          K$ = Z.stencilBuffer ? $.DEPTH_STENCIL_ATTACHMENT : $.DEPTH_ATTACHMENT,
          E$ = Q.get(Z),
          o = I.length > 1;
        if (o)
          for (let z$ = 0; z$ < I.length; z$++)
            (U.bindFramebuffer($.FRAMEBUFFER, E$.__webglMultisampledFramebuffer),
              $.framebufferRenderbuffer($.FRAMEBUFFER, $.COLOR_ATTACHMENT0 + z$, $.RENDERBUFFER, null),
              U.bindFramebuffer($.FRAMEBUFFER, E$.__webglFramebuffer),
              $.framebufferTexture2D($.DRAW_FRAMEBUFFER, $.COLOR_ATTACHMENT0 + z$, $.TEXTURE_2D, null, 0));
        U.bindFramebuffer($.READ_FRAMEBUFFER, E$.__webglMultisampledFramebuffer);
        let t = Z.texture.mipmaps;
        if (t && t.length > 0) U.bindFramebuffer($.DRAW_FRAMEBUFFER, E$.__webglFramebuffer[0]);
        else U.bindFramebuffer($.DRAW_FRAMEBUFFER, E$.__webglFramebuffer);
        for (let z$ = 0; z$ < I.length; z$++) {
          if (Z.resolveDepthBuffer) {
            if (Z.depthBuffer) J$ |= $.DEPTH_BUFFER_BIT;
            if (Z.stencilBuffer && Z.resolveStencilBuffer) J$ |= $.STENCIL_BUFFER_BIT;
          }
          if (o) {
            $.framebufferRenderbuffer(
              $.READ_FRAMEBUFFER,
              $.COLOR_ATTACHMENT0,
              $.RENDERBUFFER,
              E$.__webglColorRenderbuffer[z$],
            );
            let j$ = Q.get(I[z$]).__webglTexture;
            $.framebufferTexture2D($.DRAW_FRAMEBUFFER, $.COLOR_ATTACHMENT0, $.TEXTURE_2D, j$, 0);
          }
          if (($.blitFramebuffer(0, 0, y, e, 0, 0, y, e, J$, $.NEAREST), H === !0)) {
            if (
              ((M0.length = 0),
              (j.length = 0),
              M0.push($.COLOR_ATTACHMENT0 + z$),
              Z.depthBuffer && Z.resolveDepthBuffer === !1)
            )
              (M0.push(K$), j.push(K$), $.invalidateFramebuffer($.DRAW_FRAMEBUFFER, j));
            $.invalidateFramebuffer($.READ_FRAMEBUFFER, M0);
          }
        }
        if ((U.bindFramebuffer($.READ_FRAMEBUFFER, null), U.bindFramebuffer($.DRAW_FRAMEBUFFER, null), o))
          for (let z$ = 0; z$ < I.length; z$++) {
            (U.bindFramebuffer($.FRAMEBUFFER, E$.__webglMultisampledFramebuffer),
              $.framebufferRenderbuffer(
                $.FRAMEBUFFER,
                $.COLOR_ATTACHMENT0 + z$,
                $.RENDERBUFFER,
                E$.__webglColorRenderbuffer[z$],
              ));
            let j$ = Q.get(I[z$]).__webglTexture;
            (U.bindFramebuffer($.FRAMEBUFFER, E$.__webglFramebuffer),
              $.framebufferTexture2D($.DRAW_FRAMEBUFFER, $.COLOR_ATTACHMENT0 + z$, $.TEXTURE_2D, j$, 0));
          }
        U.bindFramebuffer($.DRAW_FRAMEBUFFER, E$.__webglMultisampledFramebuffer);
      } else if (Z.depthBuffer && Z.resolveDepthBuffer === !1 && H) {
        let I = Z.stencilBuffer ? $.DEPTH_STENCIL_ATTACHMENT : $.DEPTH_ATTACHMENT;
        $.invalidateFramebuffer($.DRAW_FRAMEBUFFER, [I]);
      }
    }
  }
  function Z6(Z) {
    return Math.min(W.maxSamples, Z.samples);
  }
  function f6(Z) {
    let I = Q.get(Z);
    return Z.samples > 0 && J.has("WEBGL_multisampled_render_to_texture") === !0 && I.__useRenderToTexture !== !1;
  }
  function M$(Z) {
    let I = Y.render.frame;
    if (K.get(Z) !== I) (K.set(Z, I), Z.update());
  }
  function O0(Z, I) {
    let { colorSpace: y, format: e, type: J$ } = Z;
    if (Z.isCompressedTexture === !0 || Z.isVideoTexture === !0) return I;
    if (y !== cB && y !== m9)
      if (R6.getTransfer(y) === W0) {
        if (e !== jU || J$ !== FU)
          i$("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.");
      } else s$("WebGLTextures: Unsupported texture color space:", y);
    return I;
  }
  function r$(Z) {
    if (typeof HTMLImageElement < "u" && Z instanceof HTMLImageElement)
      ((G.width = Z.naturalWidth || Z.width), (G.height = Z.naturalHeight || Z.height));
    else if (typeof VideoFrame < "u" && Z instanceof VideoFrame)
      ((G.width = Z.displayWidth), (G.height = Z.displayHeight));
    else ((G.width = Z.width), (G.height = Z.height));
    return G;
  }
  ((this.allocateTextureUnit = x),
    (this.resetTextureUnits = n),
    (this.getTextureUnits = b),
    (this.setTextureUnits = i),
    (this.setTexture2D = r),
    (this.setTexture2DArray = G$),
    (this.setTexture3D = k$),
    (this.setTextureCube = h$),
    (this.rebindTextures = F6),
    (this.setupRenderTarget = v0),
    (this.updateRenderTargetMipmap = m0),
    (this.updateMultisampleRenderTarget = e0),
    (this.setupDepthRenderbuffer = t6),
    (this.setupFrameBufferTexture = B6),
    (this.useMultisampledRTT = f6),
    (this.isReversedDepthBuffer = function () {
      return U.buffers.depth.getReversed();
    }));
}
function Ai($, J) {
  function U(Q, W = m9) {
    let X,
      Y = R6.getTransfer(W);
    if (Q === FU) return $.UNSIGNED_BYTE;
    if (Q === GB) return $.UNSIGNED_SHORT_4_4_4_4;
    if (Q === KB) return $.UNSIGNED_SHORT_5_5_5_1;
    if (Q === XP) return $.UNSIGNED_INT_5_9_9_9_REV;
    if (Q === YP) return $.UNSIGNED_INT_10F_11F_11F_REV;
    if (Q === WP) return $.BYTE;
    if (Q === QP) return $.SHORT;
    if (Q === NX) return $.UNSIGNED_SHORT;
    if (Q === HB) return $.INT;
    if (Q === $9) return $.UNSIGNED_INT;
    if (Q === X8) return $.FLOAT;
    if (Q === Y8) return $.HALF_FLOAT;
    if (Q === DP) return $.ALPHA;
    if (Q === HP) return $.RGB;
    if (Q === jU) return $.RGBA;
    if (Q === h9) return $.DEPTH_COMPONENT;
    if (Q === u9) return $.DEPTH_STENCIL;
    if (Q === GP) return $.RED;
    if (Q === NB) return $.RED_INTEGER;
    if (Q === l9) return $.RG;
    if (Q === OB) return $.RG_INTEGER;
    if (Q === FB) return $.RGBA_INTEGER;
    if (Q === qG || Q === zG || Q === BG || Q === EG)
      if (Y === W0)
        if (((X = J.get("WEBGL_compressed_texture_s3tc_srgb")), X !== null)) {
          if (Q === qG) return X.COMPRESSED_SRGB_S3TC_DXT1_EXT;
          if (Q === zG) return X.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;
          if (Q === BG) return X.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;
          if (Q === EG) return X.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT;
        } else return null;
      else if (((X = J.get("WEBGL_compressed_texture_s3tc")), X !== null)) {
        if (Q === qG) return X.COMPRESSED_RGB_S3TC_DXT1_EXT;
        if (Q === zG) return X.COMPRESSED_RGBA_S3TC_DXT1_EXT;
        if (Q === BG) return X.COMPRESSED_RGBA_S3TC_DXT3_EXT;
        if (Q === EG) return X.COMPRESSED_RGBA_S3TC_DXT5_EXT;
      } else return null;
    if (Q === qB || Q === zB || Q === BB || Q === EB)
      if (((X = J.get("WEBGL_compressed_texture_pvrtc")), X !== null)) {
        if (Q === qB) return X.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;
        if (Q === zB) return X.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;
        if (Q === BB) return X.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;
        if (Q === EB) return X.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG;
      } else return null;
    if (Q === LB || Q === wB || Q === IB || Q === VB || Q === kB || Q === LG || Q === AB)
      if (((X = J.get("WEBGL_compressed_texture_etc")), X !== null)) {
        if (Q === LB || Q === wB) return Y === W0 ? X.COMPRESSED_SRGB8_ETC2 : X.COMPRESSED_RGB8_ETC2;
        if (Q === IB) return Y === W0 ? X.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC : X.COMPRESSED_RGBA8_ETC2_EAC;
        if (Q === VB) return X.COMPRESSED_R11_EAC;
        if (Q === kB) return X.COMPRESSED_SIGNED_R11_EAC;
        if (Q === LG) return X.COMPRESSED_RG11_EAC;
        if (Q === AB) return X.COMPRESSED_SIGNED_RG11_EAC;
      } else return null;
    if (
      Q === MB ||
      Q === RB ||
      Q === ZB ||
      Q === PB ||
      Q === _B ||
      Q === SB ||
      Q === CB ||
      Q === TB ||
      Q === jB ||
      Q === vB ||
      Q === bB ||
      Q === fB ||
      Q === yB ||
      Q === xB
    )
      if (((X = J.get("WEBGL_compressed_texture_astc")), X !== null)) {
        if (Q === MB) return Y === W0 ? X.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR : X.COMPRESSED_RGBA_ASTC_4x4_KHR;
        if (Q === RB) return Y === W0 ? X.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR : X.COMPRESSED_RGBA_ASTC_5x4_KHR;
        if (Q === ZB) return Y === W0 ? X.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR : X.COMPRESSED_RGBA_ASTC_5x5_KHR;
        if (Q === PB) return Y === W0 ? X.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR : X.COMPRESSED_RGBA_ASTC_6x5_KHR;
        if (Q === _B) return Y === W0 ? X.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR : X.COMPRESSED_RGBA_ASTC_6x6_KHR;
        if (Q === SB) return Y === W0 ? X.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR : X.COMPRESSED_RGBA_ASTC_8x5_KHR;
        if (Q === CB) return Y === W0 ? X.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR : X.COMPRESSED_RGBA_ASTC_8x6_KHR;
        if (Q === TB) return Y === W0 ? X.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR : X.COMPRESSED_RGBA_ASTC_8x8_KHR;
        if (Q === jB) return Y === W0 ? X.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR : X.COMPRESSED_RGBA_ASTC_10x5_KHR;
        if (Q === vB) return Y === W0 ? X.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR : X.COMPRESSED_RGBA_ASTC_10x6_KHR;
        if (Q === bB) return Y === W0 ? X.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR : X.COMPRESSED_RGBA_ASTC_10x8_KHR;
        if (Q === fB) return Y === W0 ? X.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR : X.COMPRESSED_RGBA_ASTC_10x10_KHR;
        if (Q === yB) return Y === W0 ? X.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR : X.COMPRESSED_RGBA_ASTC_12x10_KHR;
        if (Q === xB) return Y === W0 ? X.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR : X.COMPRESSED_RGBA_ASTC_12x12_KHR;
      } else return null;
    if (Q === gB || Q === hB || Q === uB)
      if (((X = J.get("EXT_texture_compression_bptc")), X !== null)) {
        if (Q === gB) return Y === W0 ? X.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT : X.COMPRESSED_RGBA_BPTC_UNORM_EXT;
        if (Q === hB) return X.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;
        if (Q === uB) return X.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT;
      } else return null;
    if (Q === lB || Q === mB || Q === wG || Q === pB)
      if (((X = J.get("EXT_texture_compression_rgtc")), X !== null)) {
        if (Q === lB) return X.COMPRESSED_RED_RGTC1_EXT;
        if (Q === mB) return X.COMPRESSED_SIGNED_RED_RGTC1_EXT;
        if (Q === wG) return X.COMPRESSED_RED_GREEN_RGTC2_EXT;
        if (Q === pB) return X.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT;
      } else return null;
    if (Q === m1) return $.UNSIGNED_INT_24_8;
    return $[Q] !== void 0 ? $[Q] : null;
  }
  return { convert: U };
}
var Mi = `
void main() {

	gl_Position = vec4( position, 1.0 );

}`,
  Ri = `
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;
class D_ {
  constructor() {
    ((this.texture = null), (this.mesh = null), (this.depthNear = 0), (this.depthFar = 0));
  }
  init($, J) {
    if (this.texture === null) {
      let U = new CG($.texture);
      if ($.depthNear !== J.depthNear || $.depthFar !== J.depthFar)
        ((this.depthNear = $.depthNear), (this.depthFar = $.depthFar));
      this.texture = U;
    }
  }
  getMesh($) {
    if (this.texture !== null) {
      if (this.mesh === null) {
        let J = $.cameras[0].viewport,
          U = new dJ({
            vertexShader: Mi,
            fragmentShader: Ri,
            uniforms: { depthColor: { value: this.texture }, depthWidth: { value: J.z }, depthHeight: { value: J.w } },
          });
        this.mesh = new X$(new yU(20, 20), U);
      }
    }
    return this.mesh;
  }
  reset() {
    ((this.texture = null), (this.mesh = null));
  }
  getDepthTexture() {
    return this.texture;
  }
}
class H_ extends vU {
  constructor($, J) {
    super();
    let U = this,
      Q = null,
      W = 1,
      X = null,
      Y = "local-floor",
      D = 1,
      H = null,
      G = null,
      K = null,
      O = null,
      N = null,
      F = null,
      B = typeof XRWebGLBinding < "u",
      E = new D_(),
      z = {},
      q = J.getContextAttributes(),
      L = null,
      V = null,
      k = [],
      R = [],
      _ = new d$(),
      S = null,
      w = new r0();
    w.viewport = new q0();
    let M = new r0();
    M.viewport = new q0();
    let m = [w, M],
      P = new LE(),
      u = null,
      n = null;
    ((this.cameraAutoUpdate = !0),
      (this.enabled = !1),
      (this.isPresenting = !1),
      (this.getController = function (a) {
        let Z$ = k[a];
        if (Z$ === void 0) ((Z$ = new qX()), (k[a] = Z$));
        return Z$.getTargetRaySpace();
      }),
      (this.getControllerGrip = function (a) {
        let Z$ = k[a];
        if (Z$ === void 0) ((Z$ = new qX()), (k[a] = Z$));
        return Z$.getGripSpace();
      }),
      (this.getHand = function (a) {
        let Z$ = k[a];
        if (Z$ === void 0) ((Z$ = new qX()), (k[a] = Z$));
        return Z$.getHandSpace();
      }));
    function b(a) {
      let Z$ = R.indexOf(a.inputSource);
      if (Z$ === -1) return;
      let u$ = k[Z$];
      if (u$ !== void 0)
        (u$.update(a.inputSource, a.frame, H || X), u$.dispatchEvent({ type: a.type, data: a.inputSource }));
    }
    function i() {
      (Q.removeEventListener("select", b),
        Q.removeEventListener("selectstart", b),
        Q.removeEventListener("selectend", b),
        Q.removeEventListener("squeeze", b),
        Q.removeEventListener("squeezestart", b),
        Q.removeEventListener("squeezeend", b),
        Q.removeEventListener("end", i),
        Q.removeEventListener("inputsourceschange", x));
      for (let a = 0; a < k.length; a++) {
        let Z$ = R[a];
        if (Z$ === null) continue;
        ((R[a] = null), k[a].disconnect(Z$));
      }
      ((u = null), (n = null), E.reset());
      for (let a in z) delete z[a];
      ($.setRenderTarget(L),
        (N = null),
        (O = null),
        (K = null),
        (Q = null),
        (V = null),
        k6.stop(),
        (U.isPresenting = !1),
        $.setPixelRatio(S),
        $.setSize(_.width, _.height, !1),
        U.dispatchEvent({ type: "sessionend" }));
    }
    ((this.setFramebufferScaleFactor = function (a) {
      if (((W = a), U.isPresenting === !0)) i$("WebXRManager: Cannot change framebuffer scale while presenting.");
    }),
      (this.setReferenceSpaceType = function (a) {
        if (((Y = a), U.isPresenting === !0)) i$("WebXRManager: Cannot change reference space type while presenting.");
      }),
      (this.getReferenceSpace = function () {
        return H || X;
      }),
      (this.setReferenceSpace = function (a) {
        H = a;
      }),
      (this.getBaseLayer = function () {
        return O !== null ? O : N;
      }),
      (this.getBinding = function () {
        if (K === null && B) K = new XRWebGLBinding(Q, J);
        return K;
      }),
      (this.getFrame = function () {
        return F;
      }),
      (this.getSession = function () {
        return Q;
      }),
      (this.setSession = async function (a) {
        if (((Q = a), Q !== null)) {
          if (
            ((L = $.getRenderTarget()),
            Q.addEventListener("select", b),
            Q.addEventListener("selectstart", b),
            Q.addEventListener("selectend", b),
            Q.addEventListener("squeeze", b),
            Q.addEventListener("squeezestart", b),
            Q.addEventListener("squeezeend", b),
            Q.addEventListener("end", i),
            Q.addEventListener("inputsourceschange", x),
            q.xrCompatible !== !0)
          )
            await J.makeXRCompatible();
          if (((S = $.getPixelRatio()), $.getSize(_), !(B && "createProjectionLayer" in XRWebGLBinding.prototype))) {
            let u$ = {
              antialias: q.antialias,
              alpha: !0,
              depth: q.depth,
              stencil: q.stencil,
              framebufferScaleFactor: W,
            };
            ((N = new XRWebGLLayer(Q, J, u$)),
              Q.updateRenderState({ baseLayer: N }),
              $.setPixelRatio(1),
              $.setSize(N.framebufferWidth, N.framebufferHeight, !1),
              (V = new pJ(N.framebufferWidth, N.framebufferHeight, {
                format: jU,
                type: FU,
                colorSpace: $.outputColorSpace,
                stencilBuffer: q.stencil,
                resolveDepthBuffer: N.ignoreDepthValues === !1,
                resolveStencilBuffer: N.ignoreDepthValues === !1,
              })));
          } else {
            let u$ = null,
              S$ = null,
              o$ = null;
            if (q.depth)
              ((o$ = q.stencil ? J.DEPTH24_STENCIL8 : J.DEPTH_COMPONENT24),
                (u$ = q.stencil ? u9 : h9),
                (S$ = q.stencil ? m1 : $9));
            let y6 = { colorFormat: J.RGBA8, depthFormat: o$, scaleFactor: W };
            ((K = this.getBinding()),
              (O = K.createProjectionLayer(y6)),
              Q.updateRenderState({ layers: [O] }),
              $.setPixelRatio(1),
              $.setSize(O.textureWidth, O.textureHeight, !1),
              (V = new pJ(O.textureWidth, O.textureHeight, {
                format: jU,
                type: FU,
                depthTexture: new U9(
                  O.textureWidth,
                  O.textureHeight,
                  S$,
                  void 0,
                  void 0,
                  void 0,
                  void 0,
                  void 0,
                  void 0,
                  u$,
                ),
                stencilBuffer: q.stencil,
                colorSpace: $.outputColorSpace,
                samples: q.antialias ? 4 : 0,
                resolveDepthBuffer: O.ignoreDepthValues === !1,
                resolveStencilBuffer: O.ignoreDepthValues === !1,
              })));
          }
          ((V.isXRRenderTarget = !0),
            this.setFoveation(D),
            (H = null),
            (X = await Q.requestReferenceSpace(Y)),
            k6.setContext(Q),
            k6.start(),
            (U.isPresenting = !0),
            U.dispatchEvent({ type: "sessionstart" }));
        }
      }),
      (this.getEnvironmentBlendMode = function () {
        if (Q !== null) return Q.environmentBlendMode;
      }),
      (this.getDepthTexture = function () {
        return E.getDepthTexture();
      }));
    function x(a) {
      for (let Z$ = 0; Z$ < a.removed.length; Z$++) {
        let u$ = a.removed[Z$],
          S$ = R.indexOf(u$);
        if (S$ >= 0) ((R[S$] = null), k[S$].disconnect(u$));
      }
      for (let Z$ = 0; Z$ < a.added.length; Z$++) {
        let u$ = a.added[Z$],
          S$ = R.indexOf(u$);
        if (S$ === -1) {
          for (let y6 = 0; y6 < k.length; y6++)
            if (y6 >= R.length) {
              (R.push(u$), (S$ = y6));
              break;
            } else if (R[y6] === null) {
              ((R[y6] = u$), (S$ = y6));
              break;
            }
          if (S$ === -1) break;
        }
        let o$ = k[S$];
        if (o$) o$.connect(u$);
      }
    }
    let l = new C(),
      r = new C();
    function G$(a, Z$, u$) {
      (l.setFromMatrixPosition(Z$.matrixWorld), r.setFromMatrixPosition(u$.matrixWorld));
      let S$ = l.distanceTo(r),
        o$ = Z$.projectionMatrix.elements,
        y6 = u$.projectionMatrix.elements,
        B6 = o$[14] / (o$[10] - 1),
        A6 = o$[14] / (o$[10] + 1),
        a6 = (o$[9] + 1) / o$[5],
        t6 = (o$[9] - 1) / o$[5],
        F6 = (o$[8] - 1) / o$[0],
        v0 = (y6[8] + 1) / y6[0],
        m0 = B6 * F6,
        M0 = B6 * v0,
        j = S$ / (-F6 + v0),
        e0 = j * -F6;
      if (
        (Z$.matrixWorld.decompose(a.position, a.quaternion, a.scale),
        a.translateX(e0),
        a.translateZ(j),
        a.matrixWorld.compose(a.position, a.quaternion, a.scale),
        a.matrixWorldInverse.copy(a.matrixWorld).invert(),
        o$[10] === -1)
      )
        (a.projectionMatrix.copy(Z$.projectionMatrix), a.projectionMatrixInverse.copy(Z$.projectionMatrixInverse));
      else {
        let Z6 = B6 + j,
          f6 = A6 + j,
          M$ = m0 - e0,
          O0 = M0 + (S$ - e0),
          r$ = ((a6 * A6) / f6) * Z6,
          Z = ((t6 * A6) / f6) * Z6;
        (a.projectionMatrix.makePerspective(M$, O0, r$, Z, Z6, f6),
          a.projectionMatrixInverse.copy(a.projectionMatrix).invert());
      }
    }
    function k$(a, Z$) {
      if (Z$ === null) a.matrixWorld.copy(a.matrix);
      else a.matrixWorld.multiplyMatrices(Z$.matrixWorld, a.matrix);
      a.matrixWorldInverse.copy(a.matrixWorld).invert();
    }
    this.updateCamera = function (a) {
      if (Q === null) return;
      let { near: Z$, far: u$ } = a;
      if (E.texture !== null) {
        if (E.depthNear > 0) Z$ = E.depthNear;
        if (E.depthFar > 0) u$ = E.depthFar;
      }
      if (((P.near = M.near = w.near = Z$), (P.far = M.far = w.far = u$), u !== P.near || n !== P.far))
        (Q.updateRenderState({ depthNear: P.near, depthFar: P.far }), (u = P.near), (n = P.far));
      ((P.layers.mask = a.layers.mask | 6), (w.layers.mask = P.layers.mask & -5), (M.layers.mask = P.layers.mask & -3));
      let S$ = a.parent,
        o$ = P.cameras;
      k$(P, S$);
      for (let y6 = 0; y6 < o$.length; y6++) k$(o$[y6], S$);
      if (o$.length === 2) G$(P, w, M);
      else P.projectionMatrix.copy(w.projectionMatrix);
      h$(a, P, S$);
    };
    function h$(a, Z$, u$) {
      if (u$ === null) a.matrix.copy(Z$.matrixWorld);
      else (a.matrix.copy(u$.matrixWorld), a.matrix.invert(), a.matrix.multiply(Z$.matrixWorld));
      if (
        (a.matrix.decompose(a.position, a.quaternion, a.scale),
        a.updateMatrixWorld(!0),
        a.projectionMatrix.copy(Z$.projectionMatrix),
        a.projectionMatrixInverse.copy(Z$.projectionMatrixInverse),
        a.isPerspectiveCamera)
      )
        ((a.fov = y1 * 2 * Math.atan(1 / a.projectionMatrix.elements[5])), (a.zoom = 1));
    }
    ((this.getCamera = function () {
      return P;
    }),
      (this.getFoveation = function () {
        if (O === null && N === null) return;
        return D;
      }),
      (this.setFoveation = function (a) {
        if (((D = a), O !== null)) O.fixedFoveation = a;
        if (N !== null && N.fixedFoveation !== void 0) N.fixedFoveation = a;
      }),
      (this.hasDepthSensing = function () {
        return E.texture !== null;
      }),
      (this.getDepthSensingMesh = function () {
        return E.getMesh(P);
      }),
      (this.getCameraTexture = function (a) {
        return z[a];
      }));
    let b$ = null;
    function b6(a, Z$) {
      if (((G = Z$.getViewerPose(H || X)), (F = Z$), G !== null)) {
        let u$ = G.views;
        if (N !== null) ($.setRenderTargetFramebuffer(V, N.framebuffer), $.setRenderTarget(V));
        let S$ = !1;
        if (u$.length !== P.cameras.length) ((P.cameras.length = 0), (S$ = !0));
        for (let A6 = 0; A6 < u$.length; A6++) {
          let a6 = u$[A6],
            t6 = null;
          if (N !== null) t6 = N.getViewport(a6);
          else {
            let v0 = K.getViewSubImage(O, a6);
            if (((t6 = v0.viewport), A6 === 0))
              ($.setRenderTargetTextures(V, v0.colorTexture, v0.depthStencilTexture), $.setRenderTarget(V));
          }
          let F6 = m[A6];
          if (F6 === void 0) ((F6 = new r0()), F6.layers.enable(A6), (F6.viewport = new q0()), (m[A6] = F6));
          if (
            (F6.matrix.fromArray(a6.transform.matrix),
            F6.matrix.decompose(F6.position, F6.quaternion, F6.scale),
            F6.projectionMatrix.fromArray(a6.projectionMatrix),
            F6.projectionMatrixInverse.copy(F6.projectionMatrix).invert(),
            F6.viewport.set(t6.x, t6.y, t6.width, t6.height),
            A6 === 0)
          )
            (P.matrix.copy(F6.matrix), P.matrix.decompose(P.position, P.quaternion, P.scale));
          if (S$ === !0) P.cameras.push(F6);
        }
        let o$ = Q.enabledFeatures;
        if (o$ && o$.includes("depth-sensing") && Q.depthUsage == "gpu-optimized" && B) {
          K = U.getBinding();
          let A6 = K.getDepthInformation(u$[0]);
          if (A6 && A6.isValid && A6.texture) E.init(A6, Q.renderState);
        }
        if (o$ && o$.includes("camera-access") && B) {
          ($.state.unbindTexture(), (K = U.getBinding()));
          for (let A6 = 0; A6 < u$.length; A6++) {
            let a6 = u$[A6].camera;
            if (a6) {
              let t6 = z[a6];
              if (!t6) ((t6 = new CG()), (z[a6] = t6));
              let F6 = K.getCameraImage(a6);
              t6.sourceTexture = F6;
            }
          }
        }
      }
      for (let u$ = 0; u$ < k.length; u$++) {
        let S$ = R[u$],
          o$ = k[u$];
        if (S$ !== null && o$ !== void 0) o$.update(S$, Z$, H || X);
      }
      if (b$) b$(a, Z$);
      if (Z$.detectedPlanes) U.dispatchEvent({ type: "planesdetected", data: Z$ });
      F = null;
    }
    let k6 = new sP();
    (k6.setAnimationLoop(b6),
      (this.setAnimationLoop = function (a) {
        b$ = a;
      }),
      (this.dispose = function () {}));
  }
}
var Zi = new x6(),
  G_ = new X6();
G_.set(-1, 0, 0, 0, 1, 0, 0, 0, 1);
function Pi($, J) {
  function U(z, q) {
    if (z.matrixAutoUpdate === !0) z.updateMatrix();
    q.value.copy(z.matrix);
  }
  function Q(z, q) {
    if ((q.color.getRGB(z.fogColor.value, WE($)), q.isFog)) ((z.fogNear.value = q.near), (z.fogFar.value = q.far));
    else if (q.isFogExp2) z.fogDensity.value = q.density;
  }
  function W(z, q, L, V, k) {
    if (q.isNodeMaterial) q.uniformsNeedUpdate = !1;
    else if (q.isMeshBasicMaterial) X(z, q);
    else if (q.isMeshLambertMaterial) {
      if ((X(z, q), q.envMap)) z.envMapIntensity.value = q.envMapIntensity;
    } else if (q.isMeshToonMaterial) (X(z, q), O(z, q));
    else if (q.isMeshPhongMaterial) {
      if ((X(z, q), K(z, q), q.envMap)) z.envMapIntensity.value = q.envMapIntensity;
    } else if (q.isMeshStandardMaterial) {
      if ((X(z, q), N(z, q), q.isMeshPhysicalMaterial)) F(z, q, k);
    } else if (q.isMeshMatcapMaterial) (X(z, q), B(z, q));
    else if (q.isMeshDepthMaterial) X(z, q);
    else if (q.isMeshDistanceMaterial) (X(z, q), E(z, q));
    else if (q.isMeshNormalMaterial) X(z, q);
    else if (q.isLineBasicMaterial) {
      if ((Y(z, q), q.isLineDashedMaterial)) D(z, q);
    } else if (q.isPointsMaterial) H(z, q, L, V);
    else if (q.isSpriteMaterial) G(z, q);
    else if (q.isShadowMaterial) (z.color.value.copy(q.color), (z.opacity.value = q.opacity));
    else if (q.isShaderMaterial) q.uniformsNeedUpdate = !1;
  }
  function X(z, q) {
    if (((z.opacity.value = q.opacity), q.color)) z.diffuse.value.copy(q.color);
    if (q.emissive) z.emissive.value.copy(q.emissive).multiplyScalar(q.emissiveIntensity);
    if (q.map) ((z.map.value = q.map), U(q.map, z.mapTransform));
    if (q.alphaMap) ((z.alphaMap.value = q.alphaMap), U(q.alphaMap, z.alphaMapTransform));
    if (q.bumpMap) {
      if (
        ((z.bumpMap.value = q.bumpMap),
        U(q.bumpMap, z.bumpMapTransform),
        (z.bumpScale.value = q.bumpScale),
        q.side === kJ)
      )
        z.bumpScale.value *= -1;
    }
    if (q.normalMap) {
      if (
        ((z.normalMap.value = q.normalMap),
        U(q.normalMap, z.normalMapTransform),
        z.normalScale.value.copy(q.normalScale),
        q.side === kJ)
      )
        z.normalScale.value.negate();
    }
    if (q.displacementMap)
      ((z.displacementMap.value = q.displacementMap),
        U(q.displacementMap, z.displacementMapTransform),
        (z.displacementScale.value = q.displacementScale),
        (z.displacementBias.value = q.displacementBias));
    if (q.emissiveMap) ((z.emissiveMap.value = q.emissiveMap), U(q.emissiveMap, z.emissiveMapTransform));
    if (q.specularMap) ((z.specularMap.value = q.specularMap), U(q.specularMap, z.specularMapTransform));
    if (q.alphaTest > 0) z.alphaTest.value = q.alphaTest;
    let L = J.get(q),
      V = L.envMap,
      k = L.envMapRotation;
    if (V) {
      if (
        ((z.envMap.value = V),
        z.envMapRotation.value.setFromMatrix4(Zi.makeRotationFromEuler(k)).transpose(),
        V.isCubeTexture && V.isRenderTargetTexture === !1)
      )
        z.envMapRotation.value.premultiply(G_);
      ((z.reflectivity.value = q.reflectivity), (z.ior.value = q.ior), (z.refractionRatio.value = q.refractionRatio));
    }
    if (q.lightMap)
      ((z.lightMap.value = q.lightMap),
        (z.lightMapIntensity.value = q.lightMapIntensity),
        U(q.lightMap, z.lightMapTransform));
    if (q.aoMap) ((z.aoMap.value = q.aoMap), (z.aoMapIntensity.value = q.aoMapIntensity), U(q.aoMap, z.aoMapTransform));
  }
  function Y(z, q) {
    if ((z.diffuse.value.copy(q.color), (z.opacity.value = q.opacity), q.map))
      ((z.map.value = q.map), U(q.map, z.mapTransform));
  }
  function D(z, q) {
    ((z.dashSize.value = q.dashSize), (z.totalSize.value = q.dashSize + q.gapSize), (z.scale.value = q.scale));
  }
  function H(z, q, L, V) {
    if (
      (z.diffuse.value.copy(q.color),
      (z.opacity.value = q.opacity),
      (z.size.value = q.size * L),
      (z.scale.value = V * 0.5),
      q.map)
    )
      ((z.map.value = q.map), U(q.map, z.uvTransform));
    if (q.alphaMap) ((z.alphaMap.value = q.alphaMap), U(q.alphaMap, z.alphaMapTransform));
    if (q.alphaTest > 0) z.alphaTest.value = q.alphaTest;
  }
  function G(z, q) {
    if ((z.diffuse.value.copy(q.color), (z.opacity.value = q.opacity), (z.rotation.value = q.rotation), q.map))
      ((z.map.value = q.map), U(q.map, z.mapTransform));
    if (q.alphaMap) ((z.alphaMap.value = q.alphaMap), U(q.alphaMap, z.alphaMapTransform));
    if (q.alphaTest > 0) z.alphaTest.value = q.alphaTest;
  }
  function K(z, q) {
    (z.specular.value.copy(q.specular), (z.shininess.value = Math.max(q.shininess, 0.0001)));
  }
  function O(z, q) {
    if (q.gradientMap) z.gradientMap.value = q.gradientMap;
  }
  function N(z, q) {
    if (((z.metalness.value = q.metalness), q.metalnessMap))
      ((z.metalnessMap.value = q.metalnessMap), U(q.metalnessMap, z.metalnessMapTransform));
    if (((z.roughness.value = q.roughness), q.roughnessMap))
      ((z.roughnessMap.value = q.roughnessMap), U(q.roughnessMap, z.roughnessMapTransform));
    if (q.envMap) z.envMapIntensity.value = q.envMapIntensity;
  }
  function F(z, q, L) {
    if (((z.ior.value = q.ior), q.sheen > 0)) {
      if (
        (z.sheenColor.value.copy(q.sheenColor).multiplyScalar(q.sheen),
        (z.sheenRoughness.value = q.sheenRoughness),
        q.sheenColorMap)
      )
        ((z.sheenColorMap.value = q.sheenColorMap), U(q.sheenColorMap, z.sheenColorMapTransform));
      if (q.sheenRoughnessMap)
        ((z.sheenRoughnessMap.value = q.sheenRoughnessMap), U(q.sheenRoughnessMap, z.sheenRoughnessMapTransform));
    }
    if (q.clearcoat > 0) {
      if (((z.clearcoat.value = q.clearcoat), (z.clearcoatRoughness.value = q.clearcoatRoughness), q.clearcoatMap))
        ((z.clearcoatMap.value = q.clearcoatMap), U(q.clearcoatMap, z.clearcoatMapTransform));
      if (q.clearcoatRoughnessMap)
        ((z.clearcoatRoughnessMap.value = q.clearcoatRoughnessMap),
          U(q.clearcoatRoughnessMap, z.clearcoatRoughnessMapTransform));
      if (q.clearcoatNormalMap) {
        if (
          ((z.clearcoatNormalMap.value = q.clearcoatNormalMap),
          U(q.clearcoatNormalMap, z.clearcoatNormalMapTransform),
          z.clearcoatNormalScale.value.copy(q.clearcoatNormalScale),
          q.side === kJ)
        )
          z.clearcoatNormalScale.value.negate();
      }
    }
    if (q.dispersion > 0) z.dispersion.value = q.dispersion;
    if (q.iridescence > 0) {
      if (
        ((z.iridescence.value = q.iridescence),
        (z.iridescenceIOR.value = q.iridescenceIOR),
        (z.iridescenceThicknessMinimum.value = q.iridescenceThicknessRange[0]),
        (z.iridescenceThicknessMaximum.value = q.iridescenceThicknessRange[1]),
        q.iridescenceMap)
      )
        ((z.iridescenceMap.value = q.iridescenceMap), U(q.iridescenceMap, z.iridescenceMapTransform));
      if (q.iridescenceThicknessMap)
        ((z.iridescenceThicknessMap.value = q.iridescenceThicknessMap),
          U(q.iridescenceThicknessMap, z.iridescenceThicknessMapTransform));
    }
    if (q.transmission > 0) {
      if (
        ((z.transmission.value = q.transmission),
        (z.transmissionSamplerMap.value = L.texture),
        z.transmissionSamplerSize.value.set(L.width, L.height),
        q.transmissionMap)
      )
        ((z.transmissionMap.value = q.transmissionMap), U(q.transmissionMap, z.transmissionMapTransform));
      if (((z.thickness.value = q.thickness), q.thicknessMap))
        ((z.thicknessMap.value = q.thicknessMap), U(q.thicknessMap, z.thicknessMapTransform));
      ((z.attenuationDistance.value = q.attenuationDistance), z.attenuationColor.value.copy(q.attenuationColor));
    }
    if (q.anisotropy > 0) {
      if (
        (z.anisotropyVector.value.set(
          q.anisotropy * Math.cos(q.anisotropyRotation),
          q.anisotropy * Math.sin(q.anisotropyRotation),
        ),
        q.anisotropyMap)
      )
        ((z.anisotropyMap.value = q.anisotropyMap), U(q.anisotropyMap, z.anisotropyMapTransform));
    }
    if (
      ((z.specularIntensity.value = q.specularIntensity),
      z.specularColor.value.copy(q.specularColor),
      q.specularColorMap)
    )
      ((z.specularColorMap.value = q.specularColorMap), U(q.specularColorMap, z.specularColorMapTransform));
    if (q.specularIntensityMap)
      ((z.specularIntensityMap.value = q.specularIntensityMap),
        U(q.specularIntensityMap, z.specularIntensityMapTransform));
  }
  function B(z, q) {
    if (q.matcap) z.matcap.value = q.matcap;
  }
  function E(z, q) {
    let L = J.get(q).light;
    (z.referencePosition.value.setFromMatrixPosition(L.matrixWorld),
      (z.nearDistance.value = L.shadow.camera.near),
      (z.farDistance.value = L.shadow.camera.far));
  }
  return { refreshFogUniforms: Q, refreshMaterialUniforms: W };
}
function _i($, J, U, Q) {
  let W = {},
    X = {},
    Y = [],
    D = $.getParameter($.MAX_UNIFORM_BUFFER_BINDINGS);
  function H(L, V) {
    let k = V.program;
    Q.uniformBlockBinding(L, k);
  }
  function G(L, V) {
    let k = W[L.id];
    if (k === void 0) (B(L), (k = K(L)), (W[L.id] = k), L.addEventListener("dispose", z));
    let R = V.program;
    Q.updateUBOMapping(L, R);
    let _ = J.render.frame;
    if (X[L.id] !== _) (N(L), (X[L.id] = _));
  }
  function K(L) {
    let V = O();
    L.__bindingPointIndex = V;
    let k = $.createBuffer(),
      R = L.__size,
      _ = L.usage;
    return (
      $.bindBuffer($.UNIFORM_BUFFER, k),
      $.bufferData($.UNIFORM_BUFFER, R, _),
      $.bindBuffer($.UNIFORM_BUFFER, null),
      $.bindBufferBase($.UNIFORM_BUFFER, V, k),
      k
    );
  }
  function O() {
    for (let L = 0; L < D; L++) if (Y.indexOf(L) === -1) return (Y.push(L), L);
    return (s$("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."), 0);
  }
  function N(L) {
    let V = W[L.id],
      k = L.uniforms,
      R = L.__cache;
    $.bindBuffer($.UNIFORM_BUFFER, V);
    for (let _ = 0, S = k.length; _ < S; _++) {
      let w = Array.isArray(k[_]) ? k[_] : [k[_]];
      for (let M = 0, m = w.length; M < m; M++) {
        let P = w[M];
        if (F(P, _, M, R) === !0) {
          let u = P.__offset,
            n = Array.isArray(P.value) ? P.value : [P.value],
            b = 0;
          for (let i = 0; i < n.length; i++) {
            let x = n[i],
              l = E(x);
            if (typeof x === "number" || typeof x === "boolean")
              ((P.__data[0] = x), $.bufferSubData($.UNIFORM_BUFFER, u + b, P.__data));
            else if (x.isMatrix3)
              ((P.__data[0] = x.elements[0]),
                (P.__data[1] = x.elements[1]),
                (P.__data[2] = x.elements[2]),
                (P.__data[3] = 0),
                (P.__data[4] = x.elements[3]),
                (P.__data[5] = x.elements[4]),
                (P.__data[6] = x.elements[5]),
                (P.__data[7] = 0),
                (P.__data[8] = x.elements[6]),
                (P.__data[9] = x.elements[7]),
                (P.__data[10] = x.elements[8]),
                (P.__data[11] = 0));
            else if (ArrayBuffer.isView(x)) P.__data.set(new x.constructor(x.buffer, x.byteOffset, P.__data.length));
            else (x.toArray(P.__data, b), (b += l.storage / Float32Array.BYTES_PER_ELEMENT));
          }
          $.bufferSubData($.UNIFORM_BUFFER, u, P.__data);
        }
      }
    }
    $.bindBuffer($.UNIFORM_BUFFER, null);
  }
  function F(L, V, k, R) {
    let _ = L.value,
      S = V + "_" + k;
    if (R[S] === void 0) {
      if (typeof _ === "number" || typeof _ === "boolean") R[S] = _;
      else if (ArrayBuffer.isView(_)) R[S] = _.slice();
      else R[S] = _.clone();
      return !0;
    } else {
      let w = R[S];
      if (typeof _ === "number" || typeof _ === "boolean") {
        if (w !== _) return ((R[S] = _), !0);
      } else if (ArrayBuffer.isView(_)) return !0;
      else if (w.equals(_) === !1) return (w.copy(_), !0);
    }
    return !1;
  }
  function B(L) {
    let V = L.uniforms,
      k = 0,
      R = 16;
    for (let S = 0, w = V.length; S < w; S++) {
      let M = Array.isArray(V[S]) ? V[S] : [V[S]];
      for (let m = 0, P = M.length; m < P; m++) {
        let u = M[m],
          n = Array.isArray(u.value) ? u.value : [u.value];
        for (let b = 0, i = n.length; b < i; b++) {
          let x = n[b],
            l = E(x),
            r = k % R,
            G$ = r % l.boundary,
            k$ = r + G$;
          if (((k += G$), k$ !== 0 && R - k$ < l.storage)) k += R - k$;
          ((u.__data = new Float32Array(l.storage / Float32Array.BYTES_PER_ELEMENT)),
            (u.__offset = k),
            (k += l.storage));
        }
      }
    }
    let _ = k % R;
    if (_ > 0) k += R - _;
    return ((L.__size = k), (L.__cache = {}), this);
  }
  function E(L) {
    let V = { boundary: 0, storage: 0 };
    if (typeof L === "number" || typeof L === "boolean") ((V.boundary = 4), (V.storage = 4));
    else if (L.isVector2) ((V.boundary = 8), (V.storage = 8));
    else if (L.isVector3 || L.isColor) ((V.boundary = 16), (V.storage = 12));
    else if (L.isVector4) ((V.boundary = 16), (V.storage = 16));
    else if (L.isMatrix3) ((V.boundary = 48), (V.storage = 48));
    else if (L.isMatrix4) ((V.boundary = 64), (V.storage = 64));
    else if (L.isTexture) i$("WebGLRenderer: Texture samplers can not be part of an uniforms group.");
    else if (ArrayBuffer.isView(L)) ((V.boundary = 16), (V.storage = L.byteLength));
    else i$("WebGLRenderer: Unsupported uniform value type.", L);
    return V;
  }
  function z(L) {
    let V = L.target;
    V.removeEventListener("dispose", z);
    let k = Y.indexOf(V.__bindingPointIndex);
    (Y.splice(k, 1), $.deleteBuffer(W[V.id]), delete W[V.id], delete X[V.id]);
  }
  function q() {
    for (let L in W) $.deleteBuffer(W[L]);
    ((Y = []), (W = {}), (X = {}));
  }
  return { bind: H, update: G, dispose: q };
}
var Si = new Uint16Array([
    12469, 15057, 12620, 14925, 13266, 14620, 13807, 14376, 14323, 13990, 14545, 13625, 14713, 13328, 14840, 12882,
    14931, 12528, 14996, 12233, 15039, 11829, 15066, 11525, 15080, 11295, 15085, 10976, 15082, 10705, 15073, 10495,
    13880, 14564, 13898, 14542, 13977, 14430, 14158, 14124, 14393, 13732, 14556, 13410, 14702, 12996, 14814, 12596,
    14891, 12291, 14937, 11834, 14957, 11489, 14958, 11194, 14943, 10803, 14921, 10506, 14893, 10278, 14858, 9960,
    14484, 14039, 14487, 14025, 14499, 13941, 14524, 13740, 14574, 13468, 14654, 13106, 14743, 12678, 14818, 12344,
    14867, 11893, 14889, 11509, 14893, 11180, 14881, 10751, 14852, 10428, 14812, 10128, 14765, 9754, 14712, 9466, 14764,
    13480, 14764, 13475, 14766, 13440, 14766, 13347, 14769, 13070, 14786, 12713, 14816, 12387, 14844, 11957, 14860,
    11549, 14868, 11215, 14855, 10751, 14825, 10403, 14782, 10044, 14729, 9651, 14666, 9352, 14599, 9029, 14967, 12835,
    14966, 12831, 14963, 12804, 14954, 12723, 14936, 12564, 14917, 12347, 14900, 11958, 14886, 11569, 14878, 11247,
    14859, 10765, 14828, 10401, 14784, 10011, 14727, 9600, 14660, 9289, 14586, 8893, 14508, 8533, 15111, 12234, 15110,
    12234, 15104, 12216, 15092, 12156, 15067, 12010, 15028, 11776, 14981, 11500, 14942, 11205, 14902, 10752, 14861,
    10393, 14812, 9991, 14752, 9570, 14682, 9252, 14603, 8808, 14519, 8445, 14431, 8145, 15209, 11449, 15208, 11451,
    15202, 11451, 15190, 11438, 15163, 11384, 15117, 11274, 15055, 10979, 14994, 10648, 14932, 10343, 14871, 9936,
    14803, 9532, 14729, 9218, 14645, 8742, 14556, 8381, 14461, 8020, 14365, 7603, 15273, 10603, 15272, 10607, 15267,
    10619, 15256, 10631, 15231, 10614, 15182, 10535, 15118, 10389, 15042, 10167, 14963, 9787, 14883, 9447, 14800, 9115,
    14710, 8665, 14615, 8318, 14514, 7911, 14411, 7507, 14279, 7198, 15314, 9675, 15313, 9683, 15309, 9712, 15298, 9759,
    15277, 9797, 15229, 9773, 15166, 9668, 15084, 9487, 14995, 9274, 14898, 8910, 14800, 8539, 14697, 8234, 14590, 7790,
    14479, 7409, 14367, 7067, 14178, 6621, 15337, 8619, 15337, 8631, 15333, 8677, 15325, 8769, 15305, 8871, 15264, 8940,
    15202, 8909, 15119, 8775, 15022, 8565, 14916, 8328, 14804, 8009, 14688, 7614, 14569, 7287, 14448, 6888, 14321, 6483,
    14088, 6171, 15350, 7402, 15350, 7419, 15347, 7480, 15340, 7613, 15322, 7804, 15287, 7973, 15229, 8057, 15148, 8012,
    15046, 7846, 14933, 7611, 14810, 7357, 14682, 7069, 14552, 6656, 14421, 6316, 14251, 5948, 14007, 5528, 15356, 5942,
    15356, 5977, 15353, 6119, 15348, 6294, 15332, 6551, 15302, 6824, 15249, 7044, 15171, 7122, 15070, 7050, 14949, 6861,
    14818, 6611, 14679, 6349, 14538, 6067, 14398, 5651, 14189, 5311, 13935, 4958, 15359, 4123, 15359, 4153, 15356, 4296,
    15353, 4646, 15338, 5160, 15311, 5508, 15263, 5829, 15188, 6042, 15088, 6094, 14966, 6001, 14826, 5796, 14678, 5543,
    14527, 5287, 14377, 4985, 14133, 4586, 13869, 4257, 15360, 1563, 15360, 1642, 15358, 2076, 15354, 2636, 15341, 3350,
    15317, 4019, 15273, 4429, 15203, 4732, 15105, 4911, 14981, 4932, 14836, 4818, 14679, 4621, 14517, 4386, 14359, 4156,
    14083, 3795, 13808, 3437, 15360, 122, 15360, 137, 15358, 285, 15355, 636, 15344, 1274, 15322, 2177, 15281, 2765,
    15215, 3223, 15120, 3451, 14995, 3569, 14846, 3567, 14681, 3466, 14511, 3305, 14344, 3121, 14037, 2800, 13753, 2467,
    15360, 0, 15360, 1, 15359, 21, 15355, 89, 15346, 253, 15325, 479, 15287, 796, 15225, 1148, 15133, 1492, 15008, 1749,
    14856, 1882, 14685, 1886, 14506, 1783, 14324, 1608, 13996, 1398, 13702, 1183,
  ]),
  xU = null;
function Ci() {
  if (xU === null)
    ((xU = new JE(Si, 16, 16, l9, Y8)),
      (xU.name = "DFG_LUT"),
      (xU.minFilter = MJ),
      (xU.magFilter = MJ),
      (xU.wrapS = OG),
      (xU.wrapT = OG),
      (xU.generateMipmaps = !1),
      (xU.needsUpdate = !0));
  return xU;
}
class pG {
  constructor($ = {}) {
    let {
      canvas: J = EP(),
      context: U = null,
      depth: Q = !0,
      stencil: W = !1,
      alpha: X = !1,
      antialias: Y = !1,
      premultipliedAlpha: D = !0,
      preserveDrawingBuffer: H = !1,
      powerPreference: G = "default",
      failIfMajorPerformanceCaveat: K = !1,
      reversedDepthBuffer: O = !1,
      outputBufferType: N = FU,
    } = $;
    this.isWebGLRenderer = !0;
    let F;
    if (U !== null) {
      if (typeof WebGLRenderingContext < "u" && U instanceof WebGLRenderingContext)
        throw Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");
      F = U.getContextAttributes().alpha;
    } else F = X;
    let B = N,
      E = new Set([FB, OB, NB]),
      z = new Set([FU, $9, NX, m1, GB, KB]),
      q = new Uint32Array(4),
      L = new Int32Array(4),
      V = new C(),
      k = null,
      R = null,
      _ = [],
      S = [],
      w = null;
    ((this.domElement = J),
      (this.debug = { checkShaderErrors: !0, onShaderError: null }),
      (this.autoClear = !0),
      (this.autoClearColor = !0),
      (this.autoClearDepth = !0),
      (this.autoClearStencil = !0),
      (this.sortObjects = !0),
      (this.clippingPlanes = []),
      (this.localClippingEnabled = !1),
      (this.toneMapping = OU),
      (this.toneMappingExposure = 1),
      (this.transmissionResolutionScale = 1));
    let M = this,
      m = !1,
      P = null;
    this._outputColorSpace = J9;
    let u = 0,
      n = 0,
      b = null,
      i = -1,
      x = null,
      l = new q0(),
      r = new q0(),
      G$ = null,
      k$ = new W6(0),
      h$ = 0,
      b$ = J.width,
      b6 = J.height,
      k6 = 1,
      a = null,
      Z$ = null,
      u$ = new q0(0, 0, b$, b6),
      S$ = new q0(0, 0, b$, b6),
      o$ = !1,
      y6 = new d9(),
      B6 = !1,
      A6 = !1,
      a6 = new x6(),
      t6 = new C(),
      F6 = new q0(),
      v0 = { background: null, fog: null, environment: null, overrideMaterial: null, isScene: !0 },
      m0 = !1;
    function M0() {
      return b === null ? k6 : 1;
    }
    let j = U;
    function e0(A, f) {
      return J.getContext(A, f);
    }
    try {
      let A = {
        alpha: !0,
        depth: Q,
        stencil: W,
        antialias: Y,
        premultipliedAlpha: D,
        preserveDrawingBuffer: H,
        powerPreference: G,
        failIfMajorPerformanceCaveat: K,
      };
      if ("setAttribute" in J) J.setAttribute("data-engine", `three.js r${IZ}`);
      if (
        (J.addEventListener("webglcontextlost", v$, !1),
        J.addEventListener("webglcontextrestored", W$, !1),
        J.addEventListener("webglcontextcreationerror", l$, !1),
        j === null)
      ) {
        if (((j = e0("webgl2", A)), j === null))
          if (e0("webgl2")) throw Error("Error creating WebGL context with your selected attributes.");
          else throw Error("Error creating WebGL context.");
      }
    } catch (A) {
      throw (s$("WebGLRenderer: " + A.message), A);
    }
    let Z6, f6, M$, O0, r$, Z, I, y, e, J$, K$, E$, o, t, z$, j$, O$, L$, Q6, K6, E6, T, q$;
    function s() {
      if (
        ((Z6 = new yc(j)),
        Z6.init(),
        (E6 = new Ai(j, Z6)),
        (f6 = new _c(j, Z6, $, E6)),
        (M$ = new Vi(j, Z6)),
        f6.reversedDepthBuffer && O)
      )
        M$.buffers.depth.setReversed(!0);
      ((O0 = new hc(j)),
        (r$ = new Di()),
        (Z = new ki(j, Z6, M$, r$, f6, E6, O0)),
        (I = new fc(M)),
        (y = new pm(j)),
        (T = new Zc(j, y)),
        (e = new xc(j, y, O0, T)),
        (J$ = new lc(j, e, y, T, O0)),
        (L$ = new uc(j, f6, Z)),
        (z$ = new Sc(r$)),
        (K$ = new Yi(M, I, Z6, f6, T, z$)),
        (E$ = new Pi(M, r$)),
        (o = new Gi()),
        (t = new zi(Z6)),
        (O$ = new Rc(M, I, M$, J$, F, D)),
        (j$ = new Ii(M, J$, f6)),
        (q$ = new _i(j, O0, f6, M$)),
        (Q6 = new Pc(j, Z6, O0)),
        (K6 = new gc(j, Z6, O0)),
        (O0.programs = K$.programs),
        (M.capabilities = f6),
        (M.extensions = Z6),
        (M.properties = r$),
        (M.renderLists = o),
        (M.shadowMap = j$),
        (M.state = M$),
        (M.info = O0));
    }
    if ((s(), B !== FU)) w = new pc(B, J.width, J.height, Q, W);
    let N$ = new H_(M, j);
    ((this.xr = N$),
      (this.getContext = function () {
        return j;
      }),
      (this.getContextAttributes = function () {
        return j.getContextAttributes();
      }),
      (this.forceContextLoss = function () {
        let A = Z6.get("WEBGL_lose_context");
        if (A) A.loseContext();
      }),
      (this.forceContextRestore = function () {
        let A = Z6.get("WEBGL_lose_context");
        if (A) A.restoreContext();
      }),
      (this.getPixelRatio = function () {
        return k6;
      }),
      (this.setPixelRatio = function (A) {
        if (A === void 0) return;
        ((k6 = A), this.setSize(b$, b6, !1));
      }),
      (this.getSize = function (A) {
        return A.set(b$, b6);
      }),
      (this.setSize = function (A, f, d = !0) {
        if (N$.isPresenting) {
          i$("WebGLRenderer: Can't change size while VR device is presenting.");
          return;
        }
        if (((b$ = A), (b6 = f), (J.width = Math.floor(A * k6)), (J.height = Math.floor(f * k6)), d === !0))
          ((J.style.width = A + "px"), (J.style.height = f + "px"));
        if (w !== null) w.setSize(J.width, J.height);
        this.setViewport(0, 0, A, f);
      }),
      (this.getDrawingBufferSize = function (A) {
        return A.set(b$ * k6, b6 * k6).floor();
      }),
      (this.setDrawingBufferSize = function (A, f, d) {
        ((b$ = A),
          (b6 = f),
          (k6 = d),
          (J.width = Math.floor(A * d)),
          (J.height = Math.floor(f * d)),
          this.setViewport(0, 0, A, f));
      }),
      (this.setEffects = function (A) {
        if (B === FU) {
          s$("THREE.WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");
          return;
        }
        if (A) {
          for (let f = 0; f < A.length; f++)
            if (A[f].isOutputPass === !0) {
              i$(
                "THREE.WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.",
              );
              break;
            }
        }
        w.setEffects(A || []);
      }),
      (this.getCurrentViewport = function (A) {
        return A.copy(l);
      }),
      (this.getViewport = function (A) {
        return A.copy(u$);
      }),
      (this.setViewport = function (A, f, d, g) {
        if (A.isVector4) u$.set(A.x, A.y, A.z, A.w);
        else u$.set(A, f, d, g);
        M$.viewport(l.copy(u$).multiplyScalar(k6).round());
      }),
      (this.getScissor = function (A) {
        return A.copy(S$);
      }),
      (this.setScissor = function (A, f, d, g) {
        if (A.isVector4) S$.set(A.x, A.y, A.z, A.w);
        else S$.set(A, f, d, g);
        M$.scissor(r.copy(S$).multiplyScalar(k6).round());
      }),
      (this.getScissorTest = function () {
        return o$;
      }),
      (this.setScissorTest = function (A) {
        M$.setScissorTest((o$ = A));
      }),
      (this.setOpaqueSort = function (A) {
        a = A;
      }),
      (this.setTransparentSort = function (A) {
        Z$ = A;
      }),
      (this.getClearColor = function (A) {
        return A.copy(O$.getClearColor());
      }),
      (this.setClearColor = function () {
        O$.setClearColor(...arguments);
      }),
      (this.getClearAlpha = function () {
        return O$.getClearAlpha();
      }),
      (this.setClearAlpha = function () {
        O$.setClearAlpha(...arguments);
      }),
      (this.clear = function (A = !0, f = !0, d = !0) {
        let g = 0;
        if (A) {
          let h = !1;
          if (b !== null) {
            let R$ = b.texture.format;
            h = E.has(R$);
          }
          if (h) {
            let R$ = b.texture.type,
              T$ = z.has(R$),
              A$ = O$.getClearColor(),
              y$ = O$.getClearAlpha(),
              p$ = A$.r,
              D6 = A$.g,
              L6 = A$.b;
            if (T$) ((q[0] = p$), (q[1] = D6), (q[2] = L6), (q[3] = y$), j.clearBufferuiv(j.COLOR, 0, q));
            else ((L[0] = p$), (L[1] = D6), (L[2] = L6), (L[3] = y$), j.clearBufferiv(j.COLOR, 0, L));
          } else g |= j.COLOR_BUFFER_BIT;
        }
        if (f) ((g |= j.DEPTH_BUFFER_BIT), this.state.buffers.depth.setMask(!0));
        if (d) ((g |= j.STENCIL_BUFFER_BIT), this.state.buffers.stencil.setMask(4294967295));
        if (g !== 0) j.clear(g);
      }),
      (this.clearColor = function () {
        this.clear(!0, !1, !1);
      }),
      (this.clearDepth = function () {
        this.clear(!1, !0, !1);
      }),
      (this.clearStencil = function () {
        this.clear(!1, !1, !0);
      }),
      (this.setNodesHandler = function (A) {
        (A.setRenderer(this), (P = A));
      }),
      (this.dispose = function () {
        (J.removeEventListener("webglcontextlost", v$, !1),
          J.removeEventListener("webglcontextrestored", W$, !1),
          J.removeEventListener("webglcontextcreationerror", l$, !1),
          O$.dispose(),
          o.dispose(),
          t.dispose(),
          r$.dispose(),
          I.dispose(),
          J$.dispose(),
          T.dispose(),
          q$.dispose(),
          K$.dispose(),
          N$.dispose(),
          N$.removeEventListener("sessionstart", oE),
          N$.removeEventListener("sessionend", rE),
          D9.stop());
      }));
    function v$(A) {
      (A.preventDefault(), XX("WebGLRenderer: Context Lost."), (m = !0));
    }
    function W$() {
      (XX("WebGLRenderer: Context Restored."), (m = !1));
      let A = O0.autoReset,
        f = j$.enabled,
        d = j$.autoUpdate,
        g = j$.needsUpdate,
        h = j$.type;
      (s(), (O0.autoReset = A), (j$.enabled = f), (j$.autoUpdate = d), (j$.needsUpdate = g), (j$.type = h));
    }
    function l$(A) {
      s$("WebGLRenderer: A WebGL context could not be created. Reason: ", A.statusMessage);
    }
    function Y6(A) {
      let f = A.target;
      (f.removeEventListener("dispose", Y6), R0(f));
    }
    function R0(A) {
      (d6(A), r$.remove(A));
    }
    function d6(A) {
      let f = r$.get(A).programs;
      if (f !== void 0) {
        if (
          (f.forEach(function (d) {
            K$.releaseProgram(d);
          }),
          A.isShaderMaterial)
        )
          K$.releaseShaderCache(A);
      }
    }
    this.renderBufferDirect = function (A, f, d, g, h, R$) {
      if (f === null) f = v0;
      let T$ = h.isMesh && h.matrixWorld.determinant() < 0,
        A$ = T_(A, f, d, g, h);
      M$.setMaterial(g, T$);
      let y$ = d.index,
        p$ = 1;
      if (g.wireframe === !0) {
        if (((y$ = e.getWireframeAttribute(d)), y$ === void 0)) return;
        p$ = 2;
      }
      let D6 = d.drawRange,
        L6 = d.attributes.position,
        c$ = D6.start * p$,
        c6 = (D6.start + D6.count) * p$;
      if (R$ !== null) ((c$ = Math.max(c$, R$.start * p$)), (c6 = Math.min(c6, (R$.start + R$.count) * p$)));
      if (y$ !== null) ((c$ = Math.max(c$, 0)), (c6 = Math.min(c6, y$.count)));
      else if (L6 !== void 0 && L6 !== null) ((c$ = Math.max(c$, 0)), (c6 = Math.min(c6, L6.count)));
      let w0 = c6 - c$;
      if (w0 < 0 || w0 === 1 / 0) return;
      T.setup(h, g, A$, d, y$);
      let z0,
        e6 = Q6;
      if (y$ !== null) ((z0 = y.get(y$)), (e6 = K6), e6.setIndex(z0));
      if (h.isMesh)
        if (g.wireframe === !0) (M$.setLineWidth(g.wireframeLinewidth * M0()), e6.setMode(j.LINES));
        else e6.setMode(j.TRIANGLES);
      else if (h.isLine) {
        let p0 = g.linewidth;
        if (p0 === void 0) p0 = 1;
        if ((M$.setLineWidth(p0 * M0()), h.isLineSegments)) e6.setMode(j.LINES);
        else if (h.isLineLoop) e6.setMode(j.LINE_LOOP);
        else e6.setMode(j.LINE_STRIP);
      } else if (h.isPoints) e6.setMode(j.POINTS);
      else if (h.isSprite) e6.setMode(j.TRIANGLES);
      if (h.isBatchedMesh)
        if (!Z6.get("WEBGL_multi_draw")) {
          let { _multiDrawStarts: p0, _multiDrawCounts: C$, _multiDrawCount: PJ } = h,
            j6 = y$ ? y.get(y$).bytesPerElement : 1,
            fJ = r$.get(g).currentProgram.getUniforms();
          for (let LU = 0; LU < PJ; LU++) (fJ.setValue(j, "_gl_DrawID", LU), e6.render(p0[LU] / j6, C$[LU]));
        } else e6.renderMultiDraw(h._multiDrawStarts, h._multiDrawCounts, h._multiDrawCount);
      else if (h.isInstancedMesh) e6.renderInstances(c$, w0, h.count);
      else if (d.isInstancedBufferGeometry) {
        let p0 = d._maxInstanceCount !== void 0 ? d._maxInstanceCount : 1 / 0,
          C$ = Math.min(d.instanceCount, p0);
        e6.renderInstances(c$, w0, C$);
      } else e6.render(c$, w0);
    };
    function EU(A, f, d) {
      if (A.transparent === !0 && A.side === AJ && A.forceSinglePass === !1)
        ((A.side = kJ),
          (A.needsUpdate = !0),
          jX(A, f, d),
          (A.side = g1),
          (A.needsUpdate = !0),
          jX(A, f, d),
          (A.side = AJ));
      else jX(A, f, d);
    }
    ((this.compile = function (A, f, d = null) {
      if (d === null) d = A;
      if (
        ((R = t.get(d)),
        R.init(f),
        S.push(R),
        d.traverseVisible(function (h) {
          if (h.isLight && h.layers.test(f.layers)) {
            if ((R.pushLight(h), h.castShadow)) R.pushShadow(h);
          }
        }),
        A !== d)
      )
        A.traverseVisible(function (h) {
          if (h.isLight && h.layers.test(f.layers)) {
            if ((R.pushLight(h), h.castShadow)) R.pushShadow(h);
          }
        });
      R.setupLights();
      let g = new Set();
      return (
        A.traverse(function (h) {
          if (!(h.isMesh || h.isPoints || h.isLine || h.isSprite)) return;
          let R$ = h.material;
          if (R$)
            if (Array.isArray(R$))
              for (let T$ = 0; T$ < R$.length; T$++) {
                let A$ = R$[T$];
                (EU(A$, d, h), g.add(A$));
              }
            else (EU(R$, d, h), g.add(R$));
        }),
        (R = S.pop()),
        g
      );
    }),
      (this.compileAsync = function (A, f, d = null) {
        let g = this.compile(A, f, d);
        return new Promise((h) => {
          function R$() {
            if (
              (g.forEach(function (T$) {
                if (r$.get(T$).currentProgram.isReady()) g.delete(T$);
              }),
              g.size === 0)
            ) {
              h(A);
              return;
            }
            setTimeout(R$, 10);
          }
          if (Z6.get("KHR_parallel_shader_compile") !== null) R$();
          else setTimeout(R$, 10);
        });
      }));
    let oJ = null;
    function S_(A) {
      if (oJ) oJ(A);
    }
    function oE() {
      D9.stop();
    }
    function rE() {
      D9.start();
    }
    let D9 = new sP();
    if ((D9.setAnimationLoop(S_), typeof self < "u")) D9.setContext(self);
    ((this.setAnimationLoop = function (A) {
      ((oJ = A), N$.setAnimationLoop(A), A === null ? D9.stop() : D9.start());
    }),
      N$.addEventListener("sessionstart", oE),
      N$.addEventListener("sessionend", rE),
      (this.render = function (A, f) {
        if (f !== void 0 && f.isCamera !== !0) {
          s$("WebGLRenderer.render: camera is not an instance of THREE.Camera.");
          return;
        }
        if (m === !0) return;
        if (P !== null) P.renderStart(A, f);
        let d = N$.enabled === !0 && N$.isPresenting === !0,
          g = w !== null && (b === null || d) && w.begin(M, b);
        if (A.matrixWorldAutoUpdate === !0) A.updateMatrixWorld();
        if (f.parent === null && f.matrixWorldAutoUpdate === !0) f.updateMatrixWorld();
        if (N$.enabled === !0 && N$.isPresenting === !0 && (w === null || w.isCompositing() === !1)) {
          if (N$.cameraAutoUpdate === !0) N$.updateCamera(f);
          f = N$.getCamera();
        }
        if (A.isScene === !0) A.onBeforeRender(M, A, f, b);
        if (
          ((R = t.get(A, S.length)),
          R.init(f),
          (R.state.textureUnits = Z.getTextureUnits()),
          S.push(R),
          a6.multiplyMatrices(f.projectionMatrix, f.matrixWorldInverse),
          y6.setFromProjectionMatrix(a6, oB, f.reversedDepth),
          (A6 = this.localClippingEnabled),
          (B6 = z$.init(this.clippingPlanes, A6)),
          (k = o.get(A, _.length)),
          k.init(),
          _.push(k),
          N$.enabled === !0 && N$.isPresenting === !0)
        ) {
          let T$ = M.xr.getDepthSensingMesh();
          if (T$ !== null) tG(T$, f, -1 / 0, M.sortObjects);
        }
        if ((tG(A, f, 0, M.sortObjects), k.finish(), M.sortObjects === !0)) k.sort(a, Z$);
        if (((m0 = N$.enabled === !1 || N$.isPresenting === !1 || N$.hasDepthSensing() === !1), m0))
          O$.addToRenderList(k, A);
        if ((this.info.render.frame++, B6 === !0)) z$.beginShadows();
        let h = R.state.shadowsArray;
        if ((j$.render(h, A, f), B6 === !0)) z$.endShadows();
        if (this.info.autoReset === !0) this.info.reset();
        if ((g && w.hasRenderPass()) === !1) {
          let { opaque: T$, transmissive: A$ } = k;
          if ((R.setupLights(), f.isArrayCamera)) {
            let y$ = f.cameras;
            if (A$.length > 0)
              for (let p$ = 0, D6 = y$.length; p$ < D6; p$++) {
                let L6 = y$[p$];
                aE(T$, A$, A, L6);
              }
            if (m0) O$.render(A);
            for (let p$ = 0, D6 = y$.length; p$ < D6; p$++) {
              let L6 = y$[p$];
              sE(k, A, L6, L6.viewport);
            }
          } else {
            if (A$.length > 0) aE(T$, A$, A, f);
            if (m0) O$.render(A);
            sE(k, A, f);
          }
        }
        if (b !== null && n === 0) (Z.updateMultisampleRenderTarget(b), Z.updateRenderTargetMipmap(b));
        if (g) w.end(M);
        if (A.isScene === !0) A.onAfterRender(M, A, f);
        if ((T.resetDefaultState(), (i = -1), (x = null), S.pop(), S.length > 0)) {
          if (((R = S[S.length - 1]), Z.setTextureUnits(R.state.textureUnits), B6 === !0))
            z$.setGlobalState(M.clippingPlanes, R.state.camera);
        } else R = null;
        if ((_.pop(), _.length > 0)) k = _[_.length - 1];
        else k = null;
        if (P !== null) P.renderEnd();
      }));
    function tG(A, f, d, g) {
      if (A.visible === !1) return;
      if (A.layers.test(f.layers)) {
        if (A.isGroup) d = A.renderOrder;
        else if (A.isLOD) {
          if (A.autoUpdate === !0) A.update(f);
        } else if (A.isLightProbeGrid) R.pushLightProbeGrid(A);
        else if (A.isLight) {
          if ((R.pushLight(A), A.castShadow)) R.pushShadow(A);
        } else if (A.isSprite) {
          if (!A.frustumCulled || y6.intersectsSprite(A)) {
            if (g) F6.setFromMatrixPosition(A.matrixWorld).applyMatrix4(a6);
            let T$ = J$.update(A),
              A$ = A.material;
            if (A$.visible) k.push(A, T$, A$, d, F6.z, null);
          }
        } else if (A.isMesh || A.isLine || A.isPoints) {
          if (!A.frustumCulled || y6.intersectsObject(A)) {
            let T$ = J$.update(A),
              A$ = A.material;
            if (g) {
              if (A.boundingSphere !== void 0) {
                if (A.boundingSphere === null) A.computeBoundingSphere();
                F6.copy(A.boundingSphere.center);
              } else {
                if (T$.boundingSphere === null) T$.computeBoundingSphere();
                F6.copy(T$.boundingSphere.center);
              }
              F6.applyMatrix4(A.matrixWorld).applyMatrix4(a6);
            }
            if (Array.isArray(A$)) {
              let y$ = T$.groups;
              for (let p$ = 0, D6 = y$.length; p$ < D6; p$++) {
                let L6 = y$[p$],
                  c$ = A$[L6.materialIndex];
                if (c$ && c$.visible) k.push(A, T$, c$, d, F6.z, L6);
              }
            } else if (A$.visible) k.push(A, T$, A$, d, F6.z, null);
          }
        }
      }
      let R$ = A.children;
      for (let T$ = 0, A$ = R$.length; T$ < A$; T$++) tG(R$[T$], f, d, g);
    }
    function sE(A, f, d, g) {
      let { opaque: h, transmissive: R$, transparent: T$ } = A;
      if ((R.setupLightsView(d), B6 === !0)) z$.setGlobalState(M.clippingPlanes, d);
      if (g) M$.viewport(l.copy(g));
      if (h.length > 0) TX(h, f, d);
      if (R$.length > 0) TX(R$, f, d);
      if (T$.length > 0) TX(T$, f, d);
      (M$.buffers.depth.setTest(!0),
        M$.buffers.depth.setMask(!0),
        M$.buffers.color.setMask(!0),
        M$.setPolygonOffset(!1));
    }
    function aE(A, f, d, g) {
      if ((d.isScene === !0 ? d.overrideMaterial : null) !== null) return;
      if (R.state.transmissionRenderTarget[g.id] === void 0) {
        let c$ = Z6.has("EXT_color_buffer_half_float") || Z6.has("EXT_color_buffer_float");
        R.state.transmissionRenderTarget[g.id] = new pJ(1, 1, {
          generateMipmaps: !0,
          type: c$ ? Y8 : FU,
          minFilter: g9,
          samples: Math.max(4, f6.samples),
          stencilBuffer: W,
          resolveDepthBuffer: !1,
          resolveStencilBuffer: !1,
          colorSpace: R6.workingColorSpace,
        });
      }
      let R$ = R.state.transmissionRenderTarget[g.id],
        T$ = g.viewport || l;
      R$.setSize(T$.z * M.transmissionResolutionScale, T$.w * M.transmissionResolutionScale);
      let A$ = M.getRenderTarget(),
        y$ = M.getActiveCubeFace(),
        p$ = M.getActiveMipmapLevel();
      if ((M.setRenderTarget(R$), M.getClearColor(k$), (h$ = M.getClearAlpha()), h$ < 1))
        M.setClearColor(16777215, 0.5);
      if ((M.clear(), m0)) O$.render(d);
      let D6 = M.toneMapping;
      M.toneMapping = OU;
      let L6 = g.viewport;
      if (g.viewport !== void 0) g.viewport = void 0;
      if ((R.setupLightsView(g), B6 === !0)) z$.setGlobalState(M.clippingPlanes, g);
      if (
        (TX(A, d, g),
        Z.updateMultisampleRenderTarget(R$),
        Z.updateRenderTargetMipmap(R$),
        Z6.has("WEBGL_multisampled_render_to_texture") === !1)
      ) {
        let c$ = !1;
        for (let c6 = 0, w0 = f.length; c6 < w0; c6++) {
          let z0 = f[c6],
            { object: e6, geometry: p0, material: C$, group: PJ } = z0;
          if (C$.side === AJ && e6.layers.test(g.layers)) {
            let j6 = C$.side;
            ((C$.side = kJ),
              (C$.needsUpdate = !0),
              tE(e6, d, g, p0, C$, PJ),
              (C$.side = j6),
              (C$.needsUpdate = !0),
              (c$ = !0));
          }
        }
        if (c$ === !0) (Z.updateMultisampleRenderTarget(R$), Z.updateRenderTargetMipmap(R$));
      }
      if ((M.setRenderTarget(A$, y$, p$), M.setClearColor(k$, h$), L6 !== void 0)) g.viewport = L6;
      M.toneMapping = D6;
    }
    function TX(A, f, d) {
      let g = f.isScene === !0 ? f.overrideMaterial : null;
      for (let h = 0, R$ = A.length; h < R$; h++) {
        let T$ = A[h],
          { object: A$, geometry: y$, group: p$ } = T$,
          D6 = T$.material;
        if (D6.allowOverride === !0 && g !== null) D6 = g;
        if (A$.layers.test(d.layers)) tE(A$, f, d, y$, D6, p$);
      }
    }
    function tE(A, f, d, g, h, R$) {
      if (
        (A.onBeforeRender(M, f, d, g, h, R$),
        A.modelViewMatrix.multiplyMatrices(d.matrixWorldInverse, A.matrixWorld),
        A.normalMatrix.getNormalMatrix(A.modelViewMatrix),
        h.onBeforeRender(M, f, d, g, A, R$),
        h.transparent === !0 && h.side === AJ && h.forceSinglePass === !1)
      )
        ((h.side = kJ),
          (h.needsUpdate = !0),
          M.renderBufferDirect(d, f, g, h, A, R$),
          (h.side = g1),
          (h.needsUpdate = !0),
          M.renderBufferDirect(d, f, g, h, A, R$),
          (h.side = AJ));
      else M.renderBufferDirect(d, f, g, h, A, R$);
      A.onAfterRender(M, f, d, g, h, R$);
    }
    function jX(A, f, d) {
      if (f.isScene !== !0) f = v0;
      let g = r$.get(A),
        h = R.state.lights,
        R$ = R.state.shadowsArray,
        T$ = h.state.version,
        A$ = K$.getParameters(A, h.state, R$, f, d, R.state.lightProbeGridArray),
        y$ = K$.getProgramCacheKey(A$),
        p$ = g.programs;
      ((g.environment =
        A.isMeshStandardMaterial || A.isMeshLambertMaterial || A.isMeshPhongMaterial ? f.environment : null),
        (g.fog = f.fog));
      let D6 =
        A.isMeshStandardMaterial || (A.isMeshLambertMaterial && !A.envMap) || (A.isMeshPhongMaterial && !A.envMap);
      if (
        ((g.envMap = I.get(A.envMap || g.environment, D6)),
        (g.envMapRotation = g.environment !== null && A.envMap === null ? f.environmentRotation : A.envMapRotation),
        p$ === void 0)
      )
        (A.addEventListener("dispose", Y6), (p$ = new Map()), (g.programs = p$));
      let L6 = p$.get(y$);
      if (L6 !== void 0) {
        if (g.currentProgram === L6 && g.lightsStateVersion === T$) return ($L(A, A$), L6);
      } else {
        if (((A$.uniforms = K$.getUniforms(A)), P !== null && A.isNodeMaterial)) P.build(A, d, A$);
        (A.onBeforeCompile(A$, M), (L6 = K$.acquireProgram(A$, y$)), p$.set(y$, L6), (g.uniforms = A$.uniforms));
      }
      let c$ = g.uniforms;
      if ((!A.isShaderMaterial && !A.isRawShaderMaterial) || A.clipping === !0) c$.clippingPlanes = z$.uniform;
      if (($L(A, A$), (g.needsLights = v_(A)), (g.lightsStateVersion = T$), g.needsLights))
        ((c$.ambientLightColor.value = h.state.ambient),
          (c$.lightProbe.value = h.state.probe),
          (c$.directionalLights.value = h.state.directional),
          (c$.directionalLightShadows.value = h.state.directionalShadow),
          (c$.spotLights.value = h.state.spot),
          (c$.spotLightShadows.value = h.state.spotShadow),
          (c$.rectAreaLights.value = h.state.rectArea),
          (c$.ltc_1.value = h.state.rectAreaLTC1),
          (c$.ltc_2.value = h.state.rectAreaLTC2),
          (c$.pointLights.value = h.state.point),
          (c$.pointLightShadows.value = h.state.pointShadow),
          (c$.hemisphereLights.value = h.state.hemi),
          (c$.directionalShadowMatrix.value = h.state.directionalShadowMatrix),
          (c$.spotLightMatrix.value = h.state.spotLightMatrix),
          (c$.spotLightMap.value = h.state.spotLightMap),
          (c$.pointShadowMatrix.value = h.state.pointShadowMatrix));
      return (
        (g.lightProbeGrid = R.state.lightProbeGridArray.length > 0),
        (g.currentProgram = L6),
        (g.uniformsList = null),
        L6
      );
    }
    function eE(A) {
      if (A.uniformsList === null) {
        let f = A.currentProgram.getUniforms();
        A.uniformsList = RX.seqWithValue(f.seq, A.uniforms);
      }
      return A.uniformsList;
    }
    function $L(A, f) {
      let d = r$.get(A);
      ((d.outputColorSpace = f.outputColorSpace),
        (d.batching = f.batching),
        (d.batchingColor = f.batchingColor),
        (d.instancing = f.instancing),
        (d.instancingColor = f.instancingColor),
        (d.instancingMorph = f.instancingMorph),
        (d.skinning = f.skinning),
        (d.morphTargets = f.morphTargets),
        (d.morphNormals = f.morphNormals),
        (d.morphColors = f.morphColors),
        (d.morphTargetsCount = f.morphTargetsCount),
        (d.numClippingPlanes = f.numClippingPlanes),
        (d.numIntersection = f.numClipIntersection),
        (d.vertexAlphas = f.vertexAlphas),
        (d.vertexTangents = f.vertexTangents),
        (d.toneMapping = f.toneMapping));
    }
    function C_(A, f) {
      if (A.length === 0) return null;
      if (A.length === 1) return A[0].texture !== null ? A[0] : null;
      V.setFromMatrixPosition(f.matrixWorld);
      for (let d = 0, g = A.length; d < g; d++) {
        let h = A[d];
        if (h.texture !== null && h.boundingBox.containsPoint(V)) return h;
      }
      return null;
    }
    function T_(A, f, d, g, h) {
      if (f.isScene !== !0) f = v0;
      Z.resetTextureUnits();
      let R$ = f.fog,
        T$ = g.isMeshStandardMaterial || g.isMeshLambertMaterial || g.isMeshPhongMaterial ? f.environment : null,
        A$ = b === null ? M.outputColorSpace : b.isXRRenderTarget === !0 ? b.texture.colorSpace : R6.workingColorSpace,
        y$ = g.isMeshStandardMaterial || (g.isMeshLambertMaterial && !g.envMap) || (g.isMeshPhongMaterial && !g.envMap),
        p$ = I.get(g.envMap || T$, y$),
        D6 = g.vertexColors === !0 && !!d.attributes.color && d.attributes.color.itemSize === 4,
        L6 = !!d.attributes.tangent && (!!g.normalMap || g.anisotropy > 0),
        c$ = !!d.morphAttributes.position,
        c6 = !!d.morphAttributes.normal,
        w0 = !!d.morphAttributes.color,
        z0 = OU;
      if (g.toneMapped) {
        if (b === null || b.isXRRenderTarget === !0) z0 = M.toneMapping;
      }
      let e6 = d.morphAttributes.position || d.morphAttributes.normal || d.morphAttributes.color,
        p0 = e6 !== void 0 ? e6.length : 0,
        C$ = r$.get(g),
        PJ = R.state.lights;
      if (B6 === !0) {
        if (A6 === !0 || A !== x) {
          let Y0 = A === x && g.id === i;
          z$.setState(g, A, Y0);
        }
      }
      let j6 = !1;
      if (g.version === C$.__version) {
        if (C$.needsLights && C$.lightsStateVersion !== PJ.state.version) j6 = !0;
        else if (C$.outputColorSpace !== A$) j6 = !0;
        else if (h.isBatchedMesh && C$.batching === !1) j6 = !0;
        else if (!h.isBatchedMesh && C$.batching === !0) j6 = !0;
        else if (h.isBatchedMesh && C$.batchingColor === !0 && h.colorTexture === null) j6 = !0;
        else if (h.isBatchedMesh && C$.batchingColor === !1 && h.colorTexture !== null) j6 = !0;
        else if (h.isInstancedMesh && C$.instancing === !1) j6 = !0;
        else if (!h.isInstancedMesh && C$.instancing === !0) j6 = !0;
        else if (h.isSkinnedMesh && C$.skinning === !1) j6 = !0;
        else if (!h.isSkinnedMesh && C$.skinning === !0) j6 = !0;
        else if (h.isInstancedMesh && C$.instancingColor === !0 && h.instanceColor === null) j6 = !0;
        else if (h.isInstancedMesh && C$.instancingColor === !1 && h.instanceColor !== null) j6 = !0;
        else if (h.isInstancedMesh && C$.instancingMorph === !0 && h.morphTexture === null) j6 = !0;
        else if (h.isInstancedMesh && C$.instancingMorph === !1 && h.morphTexture !== null) j6 = !0;
        else if (C$.envMap !== p$) j6 = !0;
        else if (g.fog === !0 && C$.fog !== R$) j6 = !0;
        else if (
          C$.numClippingPlanes !== void 0 &&
          (C$.numClippingPlanes !== z$.numPlanes || C$.numIntersection !== z$.numIntersection)
        )
          j6 = !0;
        else if (C$.vertexAlphas !== D6) j6 = !0;
        else if (C$.vertexTangents !== L6) j6 = !0;
        else if (C$.morphTargets !== c$) j6 = !0;
        else if (C$.morphNormals !== c6) j6 = !0;
        else if (C$.morphColors !== w0) j6 = !0;
        else if (C$.toneMapping !== z0) j6 = !0;
        else if (C$.morphTargetsCount !== p0) j6 = !0;
        else if (!!C$.lightProbeGrid !== R.state.lightProbeGridArray.length > 0) j6 = !0;
      } else ((j6 = !0), (C$.__version = g.version));
      let fJ = C$.currentProgram;
      if (j6 === !0) {
        if (((fJ = jX(g, f, h)), P && g.isNodeMaterial)) P.onUpdateProgram(g, fJ, C$);
      }
      let LU = !1,
        K8 = !1,
        $W = !1,
        $0 = fJ.getUniforms(),
        I0 = C$.uniforms;
      if (M$.useProgram(fJ.program)) ((LU = !0), (K8 = !0), ($W = !0));
      if (g.id !== i) ((i = g.id), (K8 = !0));
      if (C$.needsLights) {
        let Y0 = C_(R.state.lightProbeGridArray, h);
        if (C$.lightProbeGrid !== Y0) ((C$.lightProbeGrid = Y0), (K8 = !0));
      }
      if (LU || x !== A) {
        if (M$.buffers.depth.getReversed() && A.reversedDepth !== !0)
          ((A._reversedDepth = !0), A.updateProjectionMatrix());
        ($0.setValue(j, "projectionMatrix", A.projectionMatrix), $0.setValue(j, "viewMatrix", A.matrixWorldInverse));
        let O8 = $0.map.cameraPosition;
        if (O8 !== void 0) O8.setValue(j, t6.setFromMatrixPosition(A.matrixWorld));
        if (f6.logarithmicDepthBuffer) $0.setValue(j, "logDepthBufFC", 2 / (Math.log(A.far + 1) / Math.LN2));
        if (
          g.isMeshPhongMaterial ||
          g.isMeshToonMaterial ||
          g.isMeshLambertMaterial ||
          g.isMeshBasicMaterial ||
          g.isMeshStandardMaterial ||
          g.isShaderMaterial
        )
          $0.setValue(j, "isOrthographic", A.isOrthographicCamera === !0);
        if (x !== A) ((x = A), (K8 = !0), ($W = !0));
      }
      if (C$.needsLights) {
        if (PJ.state.directionalShadowMap.length > 0)
          $0.setValue(j, "directionalShadowMap", PJ.state.directionalShadowMap, Z);
        if (PJ.state.spotShadowMap.length > 0) $0.setValue(j, "spotShadowMap", PJ.state.spotShadowMap, Z);
        if (PJ.state.pointShadowMap.length > 0) $0.setValue(j, "pointShadowMap", PJ.state.pointShadowMap, Z);
      }
      if (h.isSkinnedMesh) {
        ($0.setOptional(j, h, "bindMatrix"), $0.setOptional(j, h, "bindMatrixInverse"));
        let Y0 = h.skeleton;
        if (Y0) {
          if (Y0.boneTexture === null) Y0.computeBoneTexture();
          $0.setValue(j, "boneTexture", Y0.boneTexture, Z);
        }
      }
      if (h.isBatchedMesh) {
        if (
          ($0.setOptional(j, h, "batchingTexture"),
          $0.setValue(j, "batchingTexture", h._matricesTexture, Z),
          $0.setOptional(j, h, "batchingIdTexture"),
          $0.setValue(j, "batchingIdTexture", h._indirectTexture, Z),
          $0.setOptional(j, h, "batchingColorTexture"),
          h._colorsTexture !== null)
        )
          $0.setValue(j, "batchingColorTexture", h._colorsTexture, Z);
      }
      let N8 = d.morphAttributes;
      if (N8.position !== void 0 || N8.normal !== void 0 || N8.color !== void 0) L$.update(h, d, fJ);
      if (K8 || C$.receiveShadow !== h.receiveShadow)
        ((C$.receiveShadow = h.receiveShadow), $0.setValue(j, "receiveShadow", h.receiveShadow));
      if (
        (g.isMeshStandardMaterial || g.isMeshLambertMaterial || g.isMeshPhongMaterial) &&
        g.envMap === null &&
        f.environment !== null
      )
        I0.envMapIntensity.value = f.environmentIntensity;
      if (I0.dfgLUT !== void 0) I0.dfgLUT.value = Ci();
      if (K8) {
        if (($0.setValue(j, "toneMappingExposure", M.toneMappingExposure), C$.needsLights)) j_(I0, $W);
        if (R$ && g.fog === !0) E$.refreshFogUniforms(I0, R$);
        if (
          (E$.refreshMaterialUniforms(I0, g, k6, b6, R.state.transmissionRenderTarget[A.id]),
          C$.needsLights && C$.lightProbeGrid)
        ) {
          let Y0 = C$.lightProbeGrid;
          ((I0.probesSH.value = Y0.texture),
            I0.probesMin.value.copy(Y0.boundingBox.min),
            I0.probesMax.value.copy(Y0.boundingBox.max),
            I0.probesResolution.value.copy(Y0.resolution));
        }
        RX.upload(j, eE(C$), I0, Z);
      }
      if (g.isShaderMaterial && g.uniformsNeedUpdate === !0) (RX.upload(j, eE(C$), I0, Z), (g.uniformsNeedUpdate = !1));
      if (g.isSpriteMaterial) $0.setValue(j, "center", h.center);
      if (
        ($0.setValue(j, "modelViewMatrix", h.modelViewMatrix),
        $0.setValue(j, "normalMatrix", h.normalMatrix),
        $0.setValue(j, "modelMatrix", h.matrixWorld),
        g.uniformsGroups !== void 0)
      ) {
        let Y0 = g.uniformsGroups;
        for (let O8 = 0, JW = Y0.length; O8 < JW; O8++) {
          let JL = Y0[O8];
          (q$.update(JL, fJ), q$.bind(JL, fJ));
        }
      }
      return fJ;
    }
    function j_(A, f) {
      ((A.ambientLightColor.needsUpdate = f),
        (A.lightProbe.needsUpdate = f),
        (A.directionalLights.needsUpdate = f),
        (A.directionalLightShadows.needsUpdate = f),
        (A.pointLights.needsUpdate = f),
        (A.pointLightShadows.needsUpdate = f),
        (A.spotLights.needsUpdate = f),
        (A.spotLightShadows.needsUpdate = f),
        (A.rectAreaLights.needsUpdate = f),
        (A.hemisphereLights.needsUpdate = f));
    }
    function v_(A) {
      return (
        A.isMeshLambertMaterial ||
        A.isMeshToonMaterial ||
        A.isMeshPhongMaterial ||
        A.isMeshStandardMaterial ||
        A.isShadowMaterial ||
        (A.isShaderMaterial && A.lights === !0)
      );
    }
    ((this.getActiveCubeFace = function () {
      return u;
    }),
      (this.getActiveMipmapLevel = function () {
        return n;
      }),
      (this.getRenderTarget = function () {
        return b;
      }),
      (this.setRenderTargetTextures = function (A, f, d) {
        let g = r$.get(A);
        if (((g.__autoAllocateDepthBuffer = A.resolveDepthBuffer === !1), g.__autoAllocateDepthBuffer === !1))
          g.__useRenderToTexture = !1;
        ((r$.get(A.texture).__webglTexture = f),
          (r$.get(A.depthTexture).__webglTexture = g.__autoAllocateDepthBuffer ? void 0 : d),
          (g.__hasExternalTextures = !0));
      }),
      (this.setRenderTargetFramebuffer = function (A, f) {
        let d = r$.get(A);
        ((d.__webglFramebuffer = f), (d.__useDefaultFramebuffer = f === void 0));
      }));
    let b_ = j.createFramebuffer();
    ((this.setRenderTarget = function (A, f = 0, d = 0) {
      ((b = A), (u = f), (n = d));
      let g = null,
        h = !1,
        R$ = !1;
      if (A) {
        let A$ = r$.get(A);
        if (A$.__useDefaultFramebuffer !== void 0) {
          (M$.bindFramebuffer(j.FRAMEBUFFER, A$.__webglFramebuffer),
            l.copy(A.viewport),
            r.copy(A.scissor),
            (G$ = A.scissorTest),
            M$.viewport(l),
            M$.scissor(r),
            M$.setScissorTest(G$),
            (i = -1));
          return;
        } else if (A$.__webglFramebuffer === void 0) Z.setupRenderTarget(A);
        else if (A$.__hasExternalTextures)
          Z.rebindTextures(A, r$.get(A.texture).__webglTexture, r$.get(A.depthTexture).__webglTexture);
        else if (A.depthBuffer) {
          let D6 = A.depthTexture;
          if (A$.__boundDepthTexture !== D6) {
            if (D6 !== null && r$.has(D6) && (A.width !== D6.image.width || A.height !== D6.image.height))
              throw Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");
            Z.setupDepthRenderbuffer(A);
          }
        }
        let y$ = A.texture;
        if (y$.isData3DTexture || y$.isDataArrayTexture || y$.isCompressedArrayTexture) R$ = !0;
        let p$ = r$.get(A).__webglFramebuffer;
        if (A.isWebGLCubeRenderTarget) {
          if (Array.isArray(p$[f])) g = p$[f][d];
          else g = p$[f];
          h = !0;
        } else if (A.samples > 0 && Z.useMultisampledRTT(A) === !1) g = r$.get(A).__webglMultisampledFramebuffer;
        else if (Array.isArray(p$)) g = p$[d];
        else g = p$;
        (l.copy(A.viewport), r.copy(A.scissor), (G$ = A.scissorTest));
      } else (l.copy(u$).multiplyScalar(k6).floor(), r.copy(S$).multiplyScalar(k6).floor(), (G$ = o$));
      if (d !== 0) g = b_;
      if (M$.bindFramebuffer(j.FRAMEBUFFER, g)) M$.drawBuffers(A, g);
      if ((M$.viewport(l), M$.scissor(r), M$.setScissorTest(G$), h)) {
        let A$ = r$.get(A.texture);
        j.framebufferTexture2D(
          j.FRAMEBUFFER,
          j.COLOR_ATTACHMENT0,
          j.TEXTURE_CUBE_MAP_POSITIVE_X + f,
          A$.__webglTexture,
          d,
        );
      } else if (R$) {
        let A$ = f;
        for (let y$ = 0; y$ < A.textures.length; y$++) {
          let p$ = r$.get(A.textures[y$]);
          j.framebufferTextureLayer(j.FRAMEBUFFER, j.COLOR_ATTACHMENT0 + y$, p$.__webglTexture, d, A$);
        }
      } else if (A !== null && d !== 0) {
        let A$ = r$.get(A.texture);
        j.framebufferTexture2D(j.FRAMEBUFFER, j.COLOR_ATTACHMENT0, j.TEXTURE_2D, A$.__webglTexture, d);
      }
      i = -1;
    }),
      (this.readRenderTargetPixels = function (A, f, d, g, h, R$, T$, A$ = 0) {
        if (!(A && A.isWebGLRenderTarget)) {
          s$("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");
          return;
        }
        let y$ = r$.get(A).__webglFramebuffer;
        if (A.isWebGLCubeRenderTarget && T$ !== void 0) y$ = y$[T$];
        if (y$) {
          M$.bindFramebuffer(j.FRAMEBUFFER, y$);
          try {
            let p$ = A.textures[A$],
              D6 = p$.format,
              L6 = p$.type;
            if (A.textures.length > 1) j.readBuffer(j.COLOR_ATTACHMENT0 + A$);
            if (!f6.textureFormatReadable(D6)) {
              s$("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");
              return;
            }
            if (!f6.textureTypeReadable(L6)) {
              s$(
                "WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.",
              );
              return;
            }
            if (f >= 0 && f <= A.width - g && d >= 0 && d <= A.height - h)
              j.readPixels(f, d, g, h, E6.convert(D6), E6.convert(L6), R$);
          } finally {
            let p$ = b !== null ? r$.get(b).__webglFramebuffer : null;
            M$.bindFramebuffer(j.FRAMEBUFFER, p$);
          }
        }
      }),
      (this.readRenderTargetPixelsAsync = async function (A, f, d, g, h, R$, T$, A$ = 0) {
        if (!(A && A.isWebGLRenderTarget))
          throw Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");
        let y$ = r$.get(A).__webglFramebuffer;
        if (A.isWebGLCubeRenderTarget && T$ !== void 0) y$ = y$[T$];
        if (y$)
          if (f >= 0 && f <= A.width - g && d >= 0 && d <= A.height - h) {
            M$.bindFramebuffer(j.FRAMEBUFFER, y$);
            let p$ = A.textures[A$],
              D6 = p$.format,
              L6 = p$.type;
            if (A.textures.length > 1) j.readBuffer(j.COLOR_ATTACHMENT0 + A$);
            if (!f6.textureFormatReadable(D6))
              throw Error(
                "THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.",
              );
            if (!f6.textureTypeReadable(L6))
              throw Error(
                "THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.",
              );
            let c$ = j.createBuffer();
            (j.bindBuffer(j.PIXEL_PACK_BUFFER, c$),
              j.bufferData(j.PIXEL_PACK_BUFFER, R$.byteLength, j.STREAM_READ),
              j.readPixels(f, d, g, h, E6.convert(D6), E6.convert(L6), 0));
            let c6 = b !== null ? r$.get(b).__webglFramebuffer : null;
            M$.bindFramebuffer(j.FRAMEBUFFER, c6);
            let w0 = j.fenceSync(j.SYNC_GPU_COMMANDS_COMPLETE, 0);
            return (
              j.flush(),
              await wP(j, w0, 4),
              j.bindBuffer(j.PIXEL_PACK_BUFFER, c$),
              j.getBufferSubData(j.PIXEL_PACK_BUFFER, 0, R$),
              j.deleteBuffer(c$),
              j.deleteSync(w0),
              R$
            );
          } else
            throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.");
      }),
      (this.copyFramebufferToTexture = function (A, f = null, d = 0) {
        let g = Math.pow(2, -d),
          h = Math.floor(A.image.width * g),
          R$ = Math.floor(A.image.height * g),
          T$ = f !== null ? f.x : 0,
          A$ = f !== null ? f.y : 0;
        (Z.setTexture2D(A, 0), j.copyTexSubImage2D(j.TEXTURE_2D, d, 0, 0, T$, A$, h, R$), M$.unbindTexture());
      }));
    let f_ = j.createFramebuffer(),
      y_ = j.createFramebuffer();
    if (
      ((this.copyTextureToTexture = function (A, f, d = null, g = null, h = 0, R$ = 0) {
        let T$,
          A$,
          y$,
          p$,
          D6,
          L6,
          c$,
          c6,
          w0,
          z0 = A.isCompressedTexture ? A.mipmaps[R$] : A.image;
        if (d !== null)
          ((T$ = d.max.x - d.min.x),
            (A$ = d.max.y - d.min.y),
            (y$ = d.isBox3 ? d.max.z - d.min.z : 1),
            (p$ = d.min.x),
            (D6 = d.min.y),
            (L6 = d.isBox3 ? d.min.z : 0));
        else {
          let I0 = Math.pow(2, -h);
          if (((T$ = Math.floor(z0.width * I0)), (A$ = Math.floor(z0.height * I0)), A.isDataArrayTexture))
            y$ = z0.depth;
          else if (A.isData3DTexture) y$ = Math.floor(z0.depth * I0);
          else y$ = 1;
          ((p$ = 0), (D6 = 0), (L6 = 0));
        }
        if (g !== null) ((c$ = g.x), (c6 = g.y), (w0 = g.z));
        else ((c$ = 0), (c6 = 0), (w0 = 0));
        let e6 = E6.convert(f.format),
          p0 = E6.convert(f.type),
          C$;
        if (f.isData3DTexture) (Z.setTexture3D(f, 0), (C$ = j.TEXTURE_3D));
        else if (f.isDataArrayTexture || f.isCompressedArrayTexture)
          (Z.setTexture2DArray(f, 0), (C$ = j.TEXTURE_2D_ARRAY));
        else (Z.setTexture2D(f, 0), (C$ = j.TEXTURE_2D));
        (M$.activeTexture(j.TEXTURE0),
          M$.pixelStorei(j.UNPACK_FLIP_Y_WEBGL, f.flipY),
          M$.pixelStorei(j.UNPACK_PREMULTIPLY_ALPHA_WEBGL, f.premultiplyAlpha),
          M$.pixelStorei(j.UNPACK_ALIGNMENT, f.unpackAlignment));
        let PJ = M$.getParameter(j.UNPACK_ROW_LENGTH),
          j6 = M$.getParameter(j.UNPACK_IMAGE_HEIGHT),
          fJ = M$.getParameter(j.UNPACK_SKIP_PIXELS),
          LU = M$.getParameter(j.UNPACK_SKIP_ROWS),
          K8 = M$.getParameter(j.UNPACK_SKIP_IMAGES);
        (M$.pixelStorei(j.UNPACK_ROW_LENGTH, z0.width),
          M$.pixelStorei(j.UNPACK_IMAGE_HEIGHT, z0.height),
          M$.pixelStorei(j.UNPACK_SKIP_PIXELS, p$),
          M$.pixelStorei(j.UNPACK_SKIP_ROWS, D6),
          M$.pixelStorei(j.UNPACK_SKIP_IMAGES, L6));
        let $W = A.isDataArrayTexture || A.isData3DTexture,
          $0 = f.isDataArrayTexture || f.isData3DTexture;
        if (A.isDepthTexture) {
          let I0 = r$.get(A),
            N8 = r$.get(f),
            Y0 = r$.get(I0.__renderTarget),
            O8 = r$.get(N8.__renderTarget);
          (M$.bindFramebuffer(j.READ_FRAMEBUFFER, Y0.__webglFramebuffer),
            M$.bindFramebuffer(j.DRAW_FRAMEBUFFER, O8.__webglFramebuffer));
          for (let JW = 0; JW < y$; JW++) {
            if ($W)
              (j.framebufferTextureLayer(j.READ_FRAMEBUFFER, j.COLOR_ATTACHMENT0, r$.get(A).__webglTexture, h, L6 + JW),
                j.framebufferTextureLayer(
                  j.DRAW_FRAMEBUFFER,
                  j.COLOR_ATTACHMENT0,
                  r$.get(f).__webglTexture,
                  R$,
                  w0 + JW,
                ));
            j.blitFramebuffer(p$, D6, T$, A$, c$, c6, T$, A$, j.DEPTH_BUFFER_BIT, j.NEAREST);
          }
          (M$.bindFramebuffer(j.READ_FRAMEBUFFER, null), M$.bindFramebuffer(j.DRAW_FRAMEBUFFER, null));
        } else if (h !== 0 || A.isRenderTargetTexture || r$.has(A)) {
          let I0 = r$.get(A),
            N8 = r$.get(f);
          (M$.bindFramebuffer(j.READ_FRAMEBUFFER, f_), M$.bindFramebuffer(j.DRAW_FRAMEBUFFER, y_));
          for (let Y0 = 0; Y0 < y$; Y0++) {
            if ($W) j.framebufferTextureLayer(j.READ_FRAMEBUFFER, j.COLOR_ATTACHMENT0, I0.__webglTexture, h, L6 + Y0);
            else j.framebufferTexture2D(j.READ_FRAMEBUFFER, j.COLOR_ATTACHMENT0, j.TEXTURE_2D, I0.__webglTexture, h);
            if ($0) j.framebufferTextureLayer(j.DRAW_FRAMEBUFFER, j.COLOR_ATTACHMENT0, N8.__webglTexture, R$, w0 + Y0);
            else j.framebufferTexture2D(j.DRAW_FRAMEBUFFER, j.COLOR_ATTACHMENT0, j.TEXTURE_2D, N8.__webglTexture, R$);
            if (h !== 0) j.blitFramebuffer(p$, D6, T$, A$, c$, c6, T$, A$, j.COLOR_BUFFER_BIT, j.NEAREST);
            else if ($0) j.copyTexSubImage3D(C$, R$, c$, c6, w0 + Y0, p$, D6, T$, A$);
            else j.copyTexSubImage2D(C$, R$, c$, c6, p$, D6, T$, A$);
          }
          (M$.bindFramebuffer(j.READ_FRAMEBUFFER, null), M$.bindFramebuffer(j.DRAW_FRAMEBUFFER, null));
        } else if ($0)
          if (A.isDataTexture || A.isData3DTexture) j.texSubImage3D(C$, R$, c$, c6, w0, T$, A$, y$, e6, p0, z0.data);
          else if (f.isCompressedArrayTexture) j.compressedTexSubImage3D(C$, R$, c$, c6, w0, T$, A$, y$, e6, z0.data);
          else j.texSubImage3D(C$, R$, c$, c6, w0, T$, A$, y$, e6, p0, z0);
        else if (A.isDataTexture) j.texSubImage2D(j.TEXTURE_2D, R$, c$, c6, T$, A$, e6, p0, z0.data);
        else if (A.isCompressedTexture)
          j.compressedTexSubImage2D(j.TEXTURE_2D, R$, c$, c6, z0.width, z0.height, e6, z0.data);
        else j.texSubImage2D(j.TEXTURE_2D, R$, c$, c6, T$, A$, e6, p0, z0);
        if (
          (M$.pixelStorei(j.UNPACK_ROW_LENGTH, PJ),
          M$.pixelStorei(j.UNPACK_IMAGE_HEIGHT, j6),
          M$.pixelStorei(j.UNPACK_SKIP_PIXELS, fJ),
          M$.pixelStorei(j.UNPACK_SKIP_ROWS, LU),
          M$.pixelStorei(j.UNPACK_SKIP_IMAGES, K8),
          R$ === 0 && f.generateMipmaps)
        )
          j.generateMipmap(C$);
        M$.unbindTexture();
      }),
      (this.initRenderTarget = function (A) {
        if (r$.get(A).__webglFramebuffer === void 0) Z.setupRenderTarget(A);
      }),
      (this.initTexture = function (A) {
        if (A.isCubeTexture) Z.setTextureCube(A, 0);
        else if (A.isData3DTexture) Z.setTexture3D(A, 0);
        else if (A.isDataArrayTexture || A.isCompressedArrayTexture) Z.setTexture2DArray(A, 0);
        else Z.setTexture2D(A, 0);
        M$.unbindTexture();
      }),
      (this.resetState = function () {
        ((u = 0), (n = 0), (b = null), M$.reset(), T.reset());
      }),
      typeof __THREE_DEVTOOLS__ < "u")
    )
      __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe", { detail: this }));
  }
  get coordinateSystem() {
    return oB;
  }
  get outputColorSpace() {
    return this._outputColorSpace;
  }
  set outputColorSpace($) {
    this._outputColorSpace = $;
    let J = this.getContext();
    ((J.drawingBufferColorSpace = R6._getDrawingBufferColorSpace($)), (J.unpackColorSpace = R6._getUnpackColorSpace()));
  }
}
var vE = Math.PI / 180;
function dG($, J, U) {
  let Q = new W9($, J, 4, 12),
    W = new X$(Q, U);
  return ((W.position.y = -J / 2), W);
}
function bE($, J) {
  let U = $,
    Q = new cJ({ color: J, roughness: 0.75, metalness: 0.05 }),
    W = {},
    X = (B, E, z, q, L) => {
      let V = new GJ();
      return (V.position.set(E, z, q), L.add(V), (W[B] = V), V);
    },
    Y = new GJ(),
    D = X("hips", 0, 0.53 * U, 0, Y),
    H = new X$(new NJ(0.075 * U, 12, 10), Q);
  (H.scale.set(1.25, 0.75, 0.9), D.add(H));
  let G = X("spine", 0, 0.02 * U, 0, D),
    K = new X$(new W9(0.085 * U, 0.16 * U, 4, 12), Q);
  ((K.position.y = 0.13 * U), G.add(K));
  let O = X("neck", 0, 0.245 * U, 0, G),
    N = new X$(new NJ(0.068 * U, 14, 12), Q);
  ((N.position.y = 0.075 * U), O.add(N));
  let F = new X$(new NJ(0.015 * U, 6, 6), Q);
  (F.position.set(0, 0.075 * U, 0.065 * U), O.add(F));
  for (let B of ["L", "R"]) {
    let E = B === "L" ? -1 : 1,
      z = X(`shoulder${B}`, E * 0.115 * U, 0.215 * U, 0, G);
    z.add(dG(0.03 * U, 0.165 * U, Q));
    let q = X(`elbow${B}`, 0, -0.165 * U, 0, z);
    q.add(dG(0.026 * U, 0.15 * U, Q));
    let L = new X$(new NJ(0.03 * U, 8, 8), Q);
    ((L.position.y = -0.17 * U), q.add(L));
  }
  for (let B of ["L", "R"]) {
    let E = B === "L" ? -1 : 1,
      z = X(`hip${B}`, E * 0.06 * U, -0.02 * U, 0, D);
    z.add(dG(0.042 * U, 0.245 * U, Q));
    let q = X(`knee${B}`, 0, -0.245 * U, 0, z);
    q.add(dG(0.036 * U, 0.235 * U, Q));
    let L = new X$(new p6(0.055 * U, 0.03 * U, 0.12 * U), Q);
    (L.position.set(0, -0.25 * U, 0.035 * U), q.add(L));
  }
  return ((Y.userData.mannequin = { joints: W, material: Q }), Y);
}
function fE($, J) {
  let U = $.userData.mannequin;
  if (!U) return;
  for (let Q of Object.values(U.joints)) Q.rotation.set(0, 0, 0);
  for (let [Q, W] of Object.entries(J)) {
    let X = U.joints[Q];
    if (X && W) X.rotation.set(W.x * vE, W.y * vE, W.z * vE);
  }
}
function yE($, J) {
  $.userData.mannequin?.material.color.set(J);
}
var N_ = { type: "change" },
  gE = { type: "start" },
  F_ = { type: "end" },
  cG = new p9(),
  O_ = new GU(),
  Ti = Math.cos(70 * sB.DEG2RAD),
  C0 = new C(),
  RJ = 2 * Math.PI,
  s6 = {
    NONE: -1,
    ROTATE: 0,
    DOLLY: 1,
    PAN: 2,
    TOUCH_ROTATE: 3,
    TOUCH_PAN: 4,
    TOUCH_DOLLY_PAN: 5,
    TOUCH_DOLLY_ROTATE: 6,
  },
  xE = 0.000001;
class hE extends n1 {
  constructor($, J = null) {
    super($, J);
    if (
      ((this.state = s6.NONE),
      (this.target = new C()),
      (this.cursor = new C()),
      (this.minDistance = 0),
      (this.maxDistance = 1 / 0),
      (this.minZoom = 0),
      (this.maxZoom = 1 / 0),
      (this.minTargetRadius = 0),
      (this.maxTargetRadius = 1 / 0),
      (this.minPolarAngle = 0),
      (this.maxPolarAngle = Math.PI),
      (this.minAzimuthAngle = -1 / 0),
      (this.maxAzimuthAngle = 1 / 0),
      (this.enableDamping = !1),
      (this.dampingFactor = 0.05),
      (this.enableZoom = !0),
      (this.zoomSpeed = 1),
      (this.enableRotate = !0),
      (this.rotateSpeed = 1),
      (this.keyRotateSpeed = 1),
      (this.enablePan = !0),
      (this.panSpeed = 1),
      (this.screenSpacePanning = !0),
      (this.keyPanSpeed = 7),
      (this.zoomToCursor = !1),
      (this.autoRotate = !1),
      (this.autoRotateSpeed = 2),
      (this.keys = { LEFT: "ArrowLeft", UP: "ArrowUp", RIGHT: "ArrowRight", BOTTOM: "ArrowDown" }),
      (this.mouseButtons = { LEFT: a8.ROTATE, MIDDLE: a8.DOLLY, RIGHT: a8.PAN }),
      (this.touches = { ONE: t8.ROTATE, TWO: t8.DOLLY_PAN }),
      (this.target0 = this.target.clone()),
      (this.position0 = this.object.position.clone()),
      (this.zoom0 = this.object.zoom),
      (this._cursorStyle = "auto"),
      (this._domElementKeyEvents = null),
      (this._lastPosition = new C()),
      (this._lastQuaternion = new H0()),
      (this._lastTargetPosition = new C()),
      (this._quat = new H0().setFromUnitVectors($.up, new C(0, 1, 0))),
      (this._quatInverse = this._quat.clone().invert()),
      (this._spherical = new VX()),
      (this._sphericalDelta = new VX()),
      (this._scale = 1),
      (this._panOffset = new C()),
      (this._rotateStart = new d$()),
      (this._rotateEnd = new d$()),
      (this._rotateDelta = new d$()),
      (this._panStart = new d$()),
      (this._panEnd = new d$()),
      (this._panDelta = new d$()),
      (this._dollyStart = new d$()),
      (this._dollyEnd = new d$()),
      (this._dollyDelta = new d$()),
      (this._dollyDirection = new C()),
      (this._mouse = new d$()),
      (this._performCursorZoom = !1),
      (this._pointers = []),
      (this._pointerPositions = {}),
      (this._controlActive = !1),
      (this._onPointerMove = vi.bind(this)),
      (this._onPointerDown = ji.bind(this)),
      (this._onPointerUp = bi.bind(this)),
      (this._onContextMenu = li.bind(this)),
      (this._onMouseWheel = xi.bind(this)),
      (this._onKeyDown = gi.bind(this)),
      (this._onTouchStart = hi.bind(this)),
      (this._onTouchMove = ui.bind(this)),
      (this._onMouseDown = fi.bind(this)),
      (this._onMouseMove = yi.bind(this)),
      (this._interceptControlDown = mi.bind(this)),
      (this._interceptControlUp = pi.bind(this)),
      this.domElement !== null)
    )
      this.connect(this.domElement);
    this.update();
  }
  set cursorStyle($) {
    if (((this._cursorStyle = $), $ === "grab")) this.domElement.style.cursor = "grab";
    else this.domElement.style.cursor = "auto";
  }
  get cursorStyle() {
    return this._cursorStyle;
  }
  connect($) {
    (super.connect($),
      this.domElement.addEventListener("pointerdown", this._onPointerDown),
      this.domElement.addEventListener("pointercancel", this._onPointerUp),
      this.domElement.addEventListener("contextmenu", this._onContextMenu),
      this.domElement.addEventListener("wheel", this._onMouseWheel, { passive: !1 }),
      this.domElement
        .getRootNode()
        .addEventListener("keydown", this._interceptControlDown, { passive: !0, capture: !0 }),
      (this.domElement.style.touchAction = "none"));
  }
  disconnect() {
    (this.domElement.removeEventListener("pointerdown", this._onPointerDown),
      this.domElement.ownerDocument.removeEventListener("pointermove", this._onPointerMove),
      this.domElement.ownerDocument.removeEventListener("pointerup", this._onPointerUp),
      this.domElement.removeEventListener("pointercancel", this._onPointerUp),
      this.domElement.removeEventListener("wheel", this._onMouseWheel),
      this.domElement.removeEventListener("contextmenu", this._onContextMenu),
      this.stopListenToKeyEvents(),
      this.domElement.getRootNode().removeEventListener("keydown", this._interceptControlDown, { capture: !0 }),
      (this.domElement.style.touchAction = ""));
  }
  dispose() {
    this.disconnect();
  }
  getPolarAngle() {
    return this._spherical.phi;
  }
  getAzimuthalAngle() {
    return this._spherical.theta;
  }
  getDistance() {
    return this.object.position.distanceTo(this.target);
  }
  listenToKeyEvents($) {
    ($.addEventListener("keydown", this._onKeyDown), (this._domElementKeyEvents = $));
  }
  stopListenToKeyEvents() {
    if (this._domElementKeyEvents !== null)
      (this._domElementKeyEvents.removeEventListener("keydown", this._onKeyDown), (this._domElementKeyEvents = null));
  }
  saveState() {
    (this.target0.copy(this.target), this.position0.copy(this.object.position), (this.zoom0 = this.object.zoom));
  }
  reset() {
    (this.target.copy(this.target0),
      this.object.position.copy(this.position0),
      (this.object.zoom = this.zoom0),
      this.object.updateProjectionMatrix(),
      this.dispatchEvent(N_),
      this.update(),
      (this.state = s6.NONE));
  }
  pan($, J) {
    (this._pan($, J), this.update());
  }
  dollyIn($) {
    (this._dollyIn($), this.update());
  }
  dollyOut($) {
    (this._dollyOut($), this.update());
  }
  rotateLeft($) {
    (this._rotateLeft($), this.update());
  }
  rotateUp($) {
    (this._rotateUp($), this.update());
  }
  update($ = null) {
    let J = this.object.position;
    if (
      (C0.copy(J).sub(this.target),
      C0.applyQuaternion(this._quat),
      this._spherical.setFromVector3(C0),
      this.autoRotate && this.state === s6.NONE)
    )
      this._rotateLeft(this._getAutoRotationAngle($));
    if (this.enableDamping)
      ((this._spherical.theta += this._sphericalDelta.theta * this.dampingFactor),
        (this._spherical.phi += this._sphericalDelta.phi * this.dampingFactor));
    else ((this._spherical.theta += this._sphericalDelta.theta), (this._spherical.phi += this._sphericalDelta.phi));
    let U = this.minAzimuthAngle,
      Q = this.maxAzimuthAngle;
    if (isFinite(U) && isFinite(Q)) {
      if (U < -Math.PI) U += RJ;
      else if (U > Math.PI) U -= RJ;
      if (Q < -Math.PI) Q += RJ;
      else if (Q > Math.PI) Q -= RJ;
      if (U <= Q) this._spherical.theta = Math.max(U, Math.min(Q, this._spherical.theta));
      else
        this._spherical.theta =
          this._spherical.theta > (U + Q) / 2 ? Math.max(U, this._spherical.theta) : Math.min(Q, this._spherical.theta);
    }
    if (
      ((this._spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this._spherical.phi))),
      this._spherical.makeSafe(),
      this.enableDamping === !0)
    )
      this.target.addScaledVector(this._panOffset, this.dampingFactor);
    else this.target.add(this._panOffset);
    (this.target.sub(this.cursor),
      this.target.clampLength(this.minTargetRadius, this.maxTargetRadius),
      this.target.add(this.cursor));
    let W = !1;
    if ((this.zoomToCursor && this._performCursorZoom) || this.object.isOrthographicCamera)
      this._spherical.radius = this._clampDistance(this._spherical.radius);
    else {
      let X = this._spherical.radius;
      ((this._spherical.radius = this._clampDistance(this._spherical.radius * this._scale)),
        (W = X != this._spherical.radius));
    }
    if (
      (C0.setFromSpherical(this._spherical),
      C0.applyQuaternion(this._quatInverse),
      J.copy(this.target).add(C0),
      this.object.lookAt(this.target),
      this.enableDamping === !0)
    )
      ((this._sphericalDelta.theta *= 1 - this.dampingFactor),
        (this._sphericalDelta.phi *= 1 - this.dampingFactor),
        this._panOffset.multiplyScalar(1 - this.dampingFactor));
    else (this._sphericalDelta.set(0, 0, 0), this._panOffset.set(0, 0, 0));
    if (this.zoomToCursor && this._performCursorZoom) {
      let X = null;
      if (this.object.isPerspectiveCamera) {
        let Y = C0.length();
        X = this._clampDistance(Y * this._scale);
        let D = Y - X;
        (this.object.position.addScaledVector(this._dollyDirection, D), this.object.updateMatrixWorld(), (W = !!D));
      } else if (this.object.isOrthographicCamera) {
        let Y = new C(this._mouse.x, this._mouse.y, 0);
        Y.unproject(this.object);
        let D = this.object.zoom;
        ((this.object.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.object.zoom / this._scale))),
          this.object.updateProjectionMatrix(),
          (W = D !== this.object.zoom));
        let H = new C(this._mouse.x, this._mouse.y, 0);
        (H.unproject(this.object),
          this.object.position.sub(H).add(Y),
          this.object.updateMatrixWorld(),
          (X = C0.length()));
      } else
        (console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),
          (this.zoomToCursor = !1));
      if (X !== null)
        if (this.screenSpacePanning)
          this.target.set(0, 0, -1).transformDirection(this.object.matrix).multiplyScalar(X).add(this.object.position);
        else if (
          (cG.origin.copy(this.object.position),
          cG.direction.set(0, 0, -1).transformDirection(this.object.matrix),
          Math.abs(this.object.up.dot(cG.direction)) < Ti)
        )
          this.object.lookAt(this.target);
        else (O_.setFromNormalAndCoplanarPoint(this.object.up, this.target), cG.intersectPlane(O_, this.target));
    } else if (this.object.isOrthographicCamera) {
      let X = this.object.zoom;
      if (
        ((this.object.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.object.zoom / this._scale))),
        X !== this.object.zoom)
      )
        (this.object.updateProjectionMatrix(), (W = !0));
    }
    if (
      ((this._scale = 1),
      (this._performCursorZoom = !1),
      W ||
        this._lastPosition.distanceToSquared(this.object.position) > xE ||
        8 * (1 - this._lastQuaternion.dot(this.object.quaternion)) > xE ||
        this._lastTargetPosition.distanceToSquared(this.target) > xE)
    )
      return (
        this.dispatchEvent(N_),
        this._lastPosition.copy(this.object.position),
        this._lastQuaternion.copy(this.object.quaternion),
        this._lastTargetPosition.copy(this.target),
        !0
      );
    return !1;
  }
  _getAutoRotationAngle($) {
    if ($ !== null) return (RJ / 60) * this.autoRotateSpeed * $;
    else return (RJ / 60 / 60) * this.autoRotateSpeed;
  }
  _getZoomScale($) {
    let J = Math.abs($ * 0.01);
    return Math.pow(0.95, this.zoomSpeed * J);
  }
  _rotateLeft($) {
    this._sphericalDelta.theta -= $;
  }
  _rotateUp($) {
    this._sphericalDelta.phi -= $;
  }
  _panLeft($, J) {
    (C0.setFromMatrixColumn(J, 0), C0.multiplyScalar(-$), this._panOffset.add(C0));
  }
  _panUp($, J) {
    if (this.screenSpacePanning === !0) C0.setFromMatrixColumn(J, 1);
    else (C0.setFromMatrixColumn(J, 0), C0.crossVectors(this.object.up, C0));
    (C0.multiplyScalar($), this._panOffset.add(C0));
  }
  _pan($, J) {
    let U = this.domElement;
    if (this.object.isPerspectiveCamera) {
      let Q = this.object.position;
      C0.copy(Q).sub(this.target);
      let W = C0.length();
      ((W *= Math.tan(((this.object.fov / 2) * Math.PI) / 180)),
        this._panLeft((2 * $ * W) / U.clientHeight, this.object.matrix),
        this._panUp((2 * J * W) / U.clientHeight, this.object.matrix));
    } else if (this.object.isOrthographicCamera)
      (this._panLeft(
        ($ * (this.object.right - this.object.left)) / this.object.zoom / U.clientWidth,
        this.object.matrix,
      ),
        this._panUp(
          (J * (this.object.top - this.object.bottom)) / this.object.zoom / U.clientHeight,
          this.object.matrix,
        ));
    else
      (console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),
        (this.enablePan = !1));
  }
  _dollyOut($) {
    if (this.object.isPerspectiveCamera || this.object.isOrthographicCamera) this._scale /= $;
    else
      (console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),
        (this.enableZoom = !1));
  }
  _dollyIn($) {
    if (this.object.isPerspectiveCamera || this.object.isOrthographicCamera) this._scale *= $;
    else
      (console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),
        (this.enableZoom = !1));
  }
  _updateZoomParameters($, J) {
    if (!this.zoomToCursor) return;
    this._performCursorZoom = !0;
    let U = this.domElement.getBoundingClientRect(),
      Q = $ - U.left,
      W = J - U.top,
      X = U.width,
      Y = U.height;
    ((this._mouse.x = (Q / X) * 2 - 1),
      (this._mouse.y = -(W / Y) * 2 + 1),
      this._dollyDirection
        .set(this._mouse.x, this._mouse.y, 1)
        .unproject(this.object)
        .sub(this.object.position)
        .normalize());
  }
  _clampDistance($) {
    return Math.max(this.minDistance, Math.min(this.maxDistance, $));
  }
  _handleMouseDownRotate($) {
    this._rotateStart.set($.clientX, $.clientY);
  }
  _handleMouseDownDolly($) {
    (this._updateZoomParameters($.clientX, $.clientX), this._dollyStart.set($.clientX, $.clientY));
  }
  _handleMouseDownPan($) {
    this._panStart.set($.clientX, $.clientY);
  }
  _handleMouseMoveRotate($) {
    (this._rotateEnd.set($.clientX, $.clientY),
      this._rotateDelta.subVectors(this._rotateEnd, this._rotateStart).multiplyScalar(this.rotateSpeed));
    let J = this.domElement;
    (this._rotateLeft((RJ * this._rotateDelta.x) / J.clientHeight),
      this._rotateUp((RJ * this._rotateDelta.y) / J.clientHeight),
      this._rotateStart.copy(this._rotateEnd),
      this.update());
  }
  _handleMouseMoveDolly($) {
    if (
      (this._dollyEnd.set($.clientX, $.clientY),
      this._dollyDelta.subVectors(this._dollyEnd, this._dollyStart),
      this._dollyDelta.y > 0)
    )
      this._dollyOut(this._getZoomScale(this._dollyDelta.y));
    else if (this._dollyDelta.y < 0) this._dollyIn(this._getZoomScale(this._dollyDelta.y));
    (this._dollyStart.copy(this._dollyEnd), this.update());
  }
  _handleMouseMovePan($) {
    (this._panEnd.set($.clientX, $.clientY),
      this._panDelta.subVectors(this._panEnd, this._panStart).multiplyScalar(this.panSpeed),
      this._pan(this._panDelta.x, this._panDelta.y),
      this._panStart.copy(this._panEnd),
      this.update());
  }
  _handleMouseWheel($) {
    if ((this._updateZoomParameters($.clientX, $.clientY), $.deltaY < 0)) this._dollyIn(this._getZoomScale($.deltaY));
    else if ($.deltaY > 0) this._dollyOut(this._getZoomScale($.deltaY));
    this.update();
  }
  _handleKeyDown($) {
    let J = !1;
    switch ($.code) {
      case this.keys.UP:
        if ($.ctrlKey || $.metaKey || $.shiftKey) {
          if (this.enableRotate) this._rotateUp((RJ * this.keyRotateSpeed) / this.domElement.clientHeight);
        } else if (this.enablePan) this._pan(0, this.keyPanSpeed);
        J = !0;
        break;
      case this.keys.BOTTOM:
        if ($.ctrlKey || $.metaKey || $.shiftKey) {
          if (this.enableRotate) this._rotateUp((-RJ * this.keyRotateSpeed) / this.domElement.clientHeight);
        } else if (this.enablePan) this._pan(0, -this.keyPanSpeed);
        J = !0;
        break;
      case this.keys.LEFT:
        if ($.ctrlKey || $.metaKey || $.shiftKey) {
          if (this.enableRotate) this._rotateLeft((RJ * this.keyRotateSpeed) / this.domElement.clientHeight);
        } else if (this.enablePan) this._pan(this.keyPanSpeed, 0);
        J = !0;
        break;
      case this.keys.RIGHT:
        if ($.ctrlKey || $.metaKey || $.shiftKey) {
          if (this.enableRotate) this._rotateLeft((-RJ * this.keyRotateSpeed) / this.domElement.clientHeight);
        } else if (this.enablePan) this._pan(-this.keyPanSpeed, 0);
        J = !0;
        break;
    }
    if (J) ($.preventDefault(), this.update());
  }
  _handleTouchStartRotate($) {
    if (this._pointers.length === 1) this._rotateStart.set($.pageX, $.pageY);
    else {
      let J = this._getSecondPointerPosition($),
        U = 0.5 * ($.pageX + J.x),
        Q = 0.5 * ($.pageY + J.y);
      this._rotateStart.set(U, Q);
    }
  }
  _handleTouchStartPan($) {
    if (this._pointers.length === 1) this._panStart.set($.pageX, $.pageY);
    else {
      let J = this._getSecondPointerPosition($),
        U = 0.5 * ($.pageX + J.x),
        Q = 0.5 * ($.pageY + J.y);
      this._panStart.set(U, Q);
    }
  }
  _handleTouchStartDolly($) {
    let J = this._getSecondPointerPosition($),
      U = $.pageX - J.x,
      Q = $.pageY - J.y,
      W = Math.sqrt(U * U + Q * Q);
    this._dollyStart.set(0, W);
  }
  _handleTouchStartDollyPan($) {
    if (this.enableZoom) this._handleTouchStartDolly($);
    if (this.enablePan) this._handleTouchStartPan($);
  }
  _handleTouchStartDollyRotate($) {
    if (this.enableZoom) this._handleTouchStartDolly($);
    if (this.enableRotate) this._handleTouchStartRotate($);
  }
  _handleTouchMoveRotate($) {
    if (this._pointers.length == 1) this._rotateEnd.set($.pageX, $.pageY);
    else {
      let U = this._getSecondPointerPosition($),
        Q = 0.5 * ($.pageX + U.x),
        W = 0.5 * ($.pageY + U.y);
      this._rotateEnd.set(Q, W);
    }
    this._rotateDelta.subVectors(this._rotateEnd, this._rotateStart).multiplyScalar(this.rotateSpeed);
    let J = this.domElement;
    (this._rotateLeft((RJ * this._rotateDelta.x) / J.clientHeight),
      this._rotateUp((RJ * this._rotateDelta.y) / J.clientHeight),
      this._rotateStart.copy(this._rotateEnd));
  }
  _handleTouchMovePan($) {
    if (this._pointers.length === 1) this._panEnd.set($.pageX, $.pageY);
    else {
      let J = this._getSecondPointerPosition($),
        U = 0.5 * ($.pageX + J.x),
        Q = 0.5 * ($.pageY + J.y);
      this._panEnd.set(U, Q);
    }
    (this._panDelta.subVectors(this._panEnd, this._panStart).multiplyScalar(this.panSpeed),
      this._pan(this._panDelta.x, this._panDelta.y),
      this._panStart.copy(this._panEnd));
  }
  _handleTouchMoveDolly($) {
    let J = this._getSecondPointerPosition($),
      U = $.pageX - J.x,
      Q = $.pageY - J.y,
      W = Math.sqrt(U * U + Q * Q);
    (this._dollyEnd.set(0, W),
      this._dollyDelta.set(0, Math.pow(this._dollyEnd.y / this._dollyStart.y, this.zoomSpeed)),
      this._dollyOut(this._dollyDelta.y),
      this._dollyStart.copy(this._dollyEnd));
    let X = ($.pageX + J.x) * 0.5,
      Y = ($.pageY + J.y) * 0.5;
    this._updateZoomParameters(X, Y);
  }
  _handleTouchMoveDollyPan($) {
    if (this.enableZoom) this._handleTouchMoveDolly($);
    if (this.enablePan) this._handleTouchMovePan($);
  }
  _handleTouchMoveDollyRotate($) {
    if (this.enableZoom) this._handleTouchMoveDolly($);
    if (this.enableRotate) this._handleTouchMoveRotate($);
  }
  _addPointer($) {
    this._pointers.push($.pointerId);
  }
  _removePointer($) {
    delete this._pointerPositions[$.pointerId];
    for (let J = 0; J < this._pointers.length; J++)
      if (this._pointers[J] == $.pointerId) {
        this._pointers.splice(J, 1);
        return;
      }
  }
  _isTrackingPointer($) {
    for (let J = 0; J < this._pointers.length; J++) if (this._pointers[J] == $.pointerId) return !0;
    return !1;
  }
  _trackPointer($) {
    let J = this._pointerPositions[$.pointerId];
    if (J === void 0) ((J = new d$()), (this._pointerPositions[$.pointerId] = J));
    J.set($.pageX, $.pageY);
  }
  _getSecondPointerPosition($) {
    let J = $.pointerId === this._pointers[0] ? this._pointers[1] : this._pointers[0];
    return this._pointerPositions[J];
  }
  _customWheelEvent($) {
    let J = $.deltaMode,
      U = { clientX: $.clientX, clientY: $.clientY, deltaY: $.deltaY };
    switch (J) {
      case 1:
        U.deltaY *= 16;
        break;
      case 2:
        U.deltaY *= 100;
        break;
    }
    if ($.ctrlKey && !this._controlActive) U.deltaY *= 10;
    return U;
  }
}
function ji($) {
  if (this.enabled === !1) return;
  if (this._pointers.length === 0)
    (this.domElement.setPointerCapture($.pointerId),
      this.domElement.ownerDocument.addEventListener("pointermove", this._onPointerMove),
      this.domElement.ownerDocument.addEventListener("pointerup", this._onPointerUp));
  if (this._isTrackingPointer($)) return;
  if ((this._addPointer($), $.pointerType === "touch")) this._onTouchStart($);
  else this._onMouseDown($);
  if (this._cursorStyle === "grab") this.domElement.style.cursor = "grabbing";
}
function vi($) {
  if (this.enabled === !1) return;
  if ($.pointerType === "touch") this._onTouchMove($);
  else this._onMouseMove($);
}
function bi($) {
  switch ((this._removePointer($), this._pointers.length)) {
    case 0:
      if (
        (this.domElement.releasePointerCapture($.pointerId),
        this.domElement.ownerDocument.removeEventListener("pointermove", this._onPointerMove),
        this.domElement.ownerDocument.removeEventListener("pointerup", this._onPointerUp),
        this.dispatchEvent(F_),
        (this.state = s6.NONE),
        this._cursorStyle === "grab")
      )
        this.domElement.style.cursor = "grab";
      break;
    case 1:
      let J = this._pointers[0],
        U = this._pointerPositions[J];
      this._onTouchStart({ pointerId: J, pageX: U.x, pageY: U.y });
      break;
  }
}
function fi($) {
  let J;
  switch ($.button) {
    case 0:
      J = this.mouseButtons.LEFT;
      break;
    case 1:
      J = this.mouseButtons.MIDDLE;
      break;
    case 2:
      J = this.mouseButtons.RIGHT;
      break;
    default:
      J = -1;
  }
  switch (J) {
    case a8.DOLLY:
      if (this.enableZoom === !1) return;
      (this._handleMouseDownDolly($), (this.state = s6.DOLLY));
      break;
    case a8.ROTATE:
      if ($.ctrlKey || $.metaKey || $.shiftKey) {
        if (this.enablePan === !1) return;
        (this._handleMouseDownPan($), (this.state = s6.PAN));
      } else {
        if (this.enableRotate === !1) return;
        (this._handleMouseDownRotate($), (this.state = s6.ROTATE));
      }
      break;
    case a8.PAN:
      if ($.ctrlKey || $.metaKey || $.shiftKey) {
        if (this.enableRotate === !1) return;
        (this._handleMouseDownRotate($), (this.state = s6.ROTATE));
      } else {
        if (this.enablePan === !1) return;
        (this._handleMouseDownPan($), (this.state = s6.PAN));
      }
      break;
    default:
      this.state = s6.NONE;
  }
  if (this.state !== s6.NONE) this.dispatchEvent(gE);
}
function yi($) {
  switch (this.state) {
    case s6.ROTATE:
      if (this.enableRotate === !1) return;
      this._handleMouseMoveRotate($);
      break;
    case s6.DOLLY:
      if (this.enableZoom === !1) return;
      this._handleMouseMoveDolly($);
      break;
    case s6.PAN:
      if (this.enablePan === !1) return;
      this._handleMouseMovePan($);
      break;
  }
}
function xi($) {
  if (this.enabled === !1 || this.enableZoom === !1 || this.state !== s6.NONE) return;
  ($.preventDefault(),
    this.dispatchEvent(gE),
    this._handleMouseWheel(this._customWheelEvent($)),
    this.dispatchEvent(F_));
}
function gi($) {
  if (this.enabled === !1) return;
  this._handleKeyDown($);
}
function hi($) {
  switch ((this._trackPointer($), this._pointers.length)) {
    case 1:
      switch (this.touches.ONE) {
        case t8.ROTATE:
          if (this.enableRotate === !1) return;
          (this._handleTouchStartRotate($), (this.state = s6.TOUCH_ROTATE));
          break;
        case t8.PAN:
          if (this.enablePan === !1) return;
          (this._handleTouchStartPan($), (this.state = s6.TOUCH_PAN));
          break;
        default:
          this.state = s6.NONE;
      }
      break;
    case 2:
      switch (this.touches.TWO) {
        case t8.DOLLY_PAN:
          if (this.enableZoom === !1 && this.enablePan === !1) return;
          (this._handleTouchStartDollyPan($), (this.state = s6.TOUCH_DOLLY_PAN));
          break;
        case t8.DOLLY_ROTATE:
          if (this.enableZoom === !1 && this.enableRotate === !1) return;
          (this._handleTouchStartDollyRotate($), (this.state = s6.TOUCH_DOLLY_ROTATE));
          break;
        default:
          this.state = s6.NONE;
      }
      break;
    default:
      this.state = s6.NONE;
  }
  if (this.state !== s6.NONE) this.dispatchEvent(gE);
}
function ui($) {
  switch ((this._trackPointer($), this.state)) {
    case s6.TOUCH_ROTATE:
      if (this.enableRotate === !1) return;
      (this._handleTouchMoveRotate($), this.update());
      break;
    case s6.TOUCH_PAN:
      if (this.enablePan === !1) return;
      (this._handleTouchMovePan($), this.update());
      break;
    case s6.TOUCH_DOLLY_PAN:
      if (this.enableZoom === !1 && this.enablePan === !1) return;
      (this._handleTouchMoveDollyPan($), this.update());
      break;
    case s6.TOUCH_DOLLY_ROTATE:
      if (this.enableZoom === !1 && this.enableRotate === !1) return;
      (this._handleTouchMoveDollyRotate($), this.update());
      break;
    default:
      this.state = s6.NONE;
  }
}
function li($) {
  if (this.enabled === !1) return;
  $.preventDefault();
}
function mi($) {
  if ($.key === "Control")
    ((this._controlActive = !0),
      this.domElement.getRootNode().addEventListener("keyup", this._interceptControlUp, { passive: !0, capture: !0 }));
}
function pi($) {
  if ($.key === "Control")
    ((this._controlActive = !1),
      this.domElement
        .getRootNode()
        .removeEventListener("keyup", this._interceptControlUp, { passive: !0, capture: !0 }));
}
var s9 = new c1(),
  t0 = new C(),
  Y9 = new C(),
  N0 = new H0(),
  q_ = { X: new C(1, 0, 0), Y: new C(0, 1, 0), Z: new C(0, 0, 1) },
  uE = { type: "change" },
  z_ = { type: "mouseDown", mode: null },
  B_ = { type: "mouseUp", mode: null },
  E_ = { type: "objectChange" };
class mE extends n1 {
  constructor($, J = null) {
    super(void 0, J);
    let U = new V_(this);
    this._root = U;
    let Q = new k_();
    ((this._gizmo = Q), U.add(Q));
    let W = new A_();
    ((this._plane = W), U.add(W));
    let X = this;
    function Y(L, V) {
      let k = V;
      (Object.defineProperty(X, L, {
        get: function () {
          return k !== void 0 ? k : V;
        },
        set: function (R) {
          if (k !== R)
            ((k = R), (W[L] = R), (Q[L] = R), X.dispatchEvent({ type: L + "-changed", value: R }), X.dispatchEvent(uE));
        },
      }),
        (X[L] = V),
        (W[L] = V),
        (Q[L] = V));
    }
    (Y("camera", $),
      Y("object", void 0),
      Y("enabled", !0),
      Y("axis", null),
      Y("mode", "translate"),
      Y("translationSnap", null),
      Y("rotationSnap", null),
      Y("scaleSnap", null),
      Y("space", "world"),
      Y("size", 1),
      Y("dragging", !1),
      Y("showX", !0),
      Y("showY", !0),
      Y("showZ", !0),
      Y("showXY", !0),
      Y("showYZ", !0),
      Y("showXZ", !0),
      Y("minX", -1 / 0),
      Y("maxX", 1 / 0),
      Y("minY", -1 / 0),
      Y("maxY", 1 / 0),
      Y("minZ", -1 / 0),
      Y("maxZ", 1 / 0));
    let D = new C(),
      H = new C(),
      G = new H0(),
      K = new H0(),
      O = new C(),
      N = new H0(),
      F = new C(),
      B = new C(),
      E = new C(),
      z = 0,
      q = new C();
    if (
      (Y("worldPosition", D),
      Y("worldPositionStart", H),
      Y("worldQuaternion", G),
      Y("worldQuaternionStart", K),
      Y("cameraPosition", O),
      Y("cameraQuaternion", N),
      Y("pointStart", F),
      Y("pointEnd", B),
      Y("rotationAxis", E),
      Y("rotationAngle", z),
      Y("eye", q),
      (this._offset = new C()),
      (this._startNorm = new C()),
      (this._endNorm = new C()),
      (this._cameraScale = new C()),
      (this._parentPosition = new C()),
      (this._parentQuaternion = new H0()),
      (this._parentQuaternionInv = new H0()),
      (this._parentScale = new C()),
      (this._worldScaleStart = new C()),
      (this._worldQuaternionInv = new H0()),
      (this._worldScale = new C()),
      (this._positionStart = new C()),
      (this._quaternionStart = new H0()),
      (this._scaleStart = new C()),
      (this._getPointer = di.bind(this)),
      (this._onPointerDown = ni.bind(this)),
      (this._onPointerHover = ci.bind(this)),
      (this._onPointerMove = ii.bind(this)),
      (this._onPointerUp = oi.bind(this)),
      J !== null)
    )
      this.connect(J);
  }
  connect($) {
    (super.connect($),
      this.domElement.addEventListener("pointerdown", this._onPointerDown),
      this.domElement.addEventListener("pointermove", this._onPointerHover),
      this.domElement.addEventListener("pointerup", this._onPointerUp),
      (this.domElement.style.touchAction = "none"));
  }
  disconnect() {
    (this.domElement.removeEventListener("pointerdown", this._onPointerDown),
      this.domElement.removeEventListener("pointermove", this._onPointerHover),
      this.domElement.removeEventListener("pointermove", this._onPointerMove),
      this.domElement.removeEventListener("pointerup", this._onPointerUp),
      (this.domElement.style.touchAction = ""));
  }
  getHelper() {
    return this._root;
  }
  pointerHover($) {
    if (this.object === void 0 || this.dragging === !0) return;
    if ($ !== null) s9.setFromCamera($, this.camera);
    let J = lE(this._gizmo.picker[this.mode], s9);
    if (J) this.axis = J.object.name;
    else this.axis = null;
  }
  pointerDown($) {
    if (this.object === void 0 || this.dragging === !0 || ($ != null && $.button !== 0)) return;
    if (this.axis !== null) {
      if ($ !== null) s9.setFromCamera($, this.camera);
      let J = lE(this._plane, s9, !0);
      if (J)
        (this.object.updateMatrixWorld(),
          this.object.parent.updateMatrixWorld(),
          this._positionStart.copy(this.object.position),
          this._quaternionStart.copy(this.object.quaternion),
          this._scaleStart.copy(this.object.scale),
          this.object.matrixWorld.decompose(this.worldPositionStart, this.worldQuaternionStart, this._worldScaleStart),
          this.pointStart.copy(J.point).sub(this.worldPositionStart));
      ((this.dragging = !0), (z_.mode = this.mode), this.dispatchEvent(z_));
    }
  }
  pointerMove($) {
    let J = this.axis,
      U = this.mode,
      Q = this.object,
      W = this.space;
    if (U === "scale") W = "local";
    else if (J === "E" || J === "XYZE" || J === "XYZ") W = "world";
    if (Q === void 0 || J === null || this.dragging === !1 || ($ !== null && $.button !== -1)) return;
    if ($ !== null) s9.setFromCamera($, this.camera);
    let X = lE(this._plane, s9, !0);
    if (!X) return;
    if ((this.pointEnd.copy(X.point).sub(this.worldPositionStart), U === "translate")) {
      if ((this._offset.copy(this.pointEnd).sub(this.pointStart), W === "local" && J !== "XYZ"))
        this._offset.applyQuaternion(this._worldQuaternionInv);
      if (J.indexOf("X") === -1) this._offset.x = 0;
      if (J.indexOf("Y") === -1) this._offset.y = 0;
      if (J.indexOf("Z") === -1) this._offset.z = 0;
      if (W === "local" && J !== "XYZ") this._offset.applyQuaternion(this._quaternionStart).divide(this._parentScale);
      else this._offset.applyQuaternion(this._parentQuaternionInv).divide(this._parentScale);
      if ((Q.position.copy(this._offset).add(this._positionStart), this.translationSnap)) {
        if (W === "local") {
          if ((Q.position.applyQuaternion(N0.copy(this._quaternionStart).invert()), J.search("X") !== -1))
            Q.position.x = Math.round(Q.position.x / this.translationSnap) * this.translationSnap;
          if (J.search("Y") !== -1)
            Q.position.y = Math.round(Q.position.y / this.translationSnap) * this.translationSnap;
          if (J.search("Z") !== -1)
            Q.position.z = Math.round(Q.position.z / this.translationSnap) * this.translationSnap;
          Q.position.applyQuaternion(this._quaternionStart);
        }
        if (W === "world") {
          if (Q.parent) Q.position.add(t0.setFromMatrixPosition(Q.parent.matrixWorld));
          if (J.search("X") !== -1)
            Q.position.x = Math.round(Q.position.x / this.translationSnap) * this.translationSnap;
          if (J.search("Y") !== -1)
            Q.position.y = Math.round(Q.position.y / this.translationSnap) * this.translationSnap;
          if (J.search("Z") !== -1)
            Q.position.z = Math.round(Q.position.z / this.translationSnap) * this.translationSnap;
          if (Q.parent) Q.position.sub(t0.setFromMatrixPosition(Q.parent.matrixWorld));
        }
      }
      ((Q.position.x = Math.max(this.minX, Math.min(this.maxX, Q.position.x))),
        (Q.position.y = Math.max(this.minY, Math.min(this.maxY, Q.position.y))),
        (Q.position.z = Math.max(this.minZ, Math.min(this.maxZ, Q.position.z))));
    } else if (U === "scale") {
      if (J.search("XYZ") !== -1) {
        let Y = this.pointEnd.length() / this.pointStart.length();
        if (this.pointEnd.dot(this.pointStart) < 0) Y *= -1;
        Y9.set(Y, Y, Y);
      } else {
        if (
          (t0.copy(this.pointStart),
          Y9.copy(this.pointEnd),
          t0.applyQuaternion(this._worldQuaternionInv),
          Y9.applyQuaternion(this._worldQuaternionInv),
          Y9.divide(t0),
          J.search("X") === -1)
        )
          Y9.x = 1;
        if (J.search("Y") === -1) Y9.y = 1;
        if (J.search("Z") === -1) Y9.z = 1;
      }
      if ((Q.scale.copy(this._scaleStart).multiply(Y9), this.scaleSnap)) {
        if (J.search("X") !== -1) Q.scale.x = Math.round(Q.scale.x / this.scaleSnap) * this.scaleSnap || this.scaleSnap;
        if (J.search("Y") !== -1) Q.scale.y = Math.round(Q.scale.y / this.scaleSnap) * this.scaleSnap || this.scaleSnap;
        if (J.search("Z") !== -1) Q.scale.z = Math.round(Q.scale.z / this.scaleSnap) * this.scaleSnap || this.scaleSnap;
      }
    } else if (U === "rotate") {
      this._offset.copy(this.pointEnd).sub(this.pointStart);
      let Y = 20 / this.worldPosition.distanceTo(t0.setFromMatrixPosition(this.camera.matrixWorld)),
        D = !1;
      if (J === "XYZE")
        (this.rotationAxis.copy(this._offset).cross(this.eye).normalize(),
          (this.rotationAngle = this._offset.dot(t0.copy(this.rotationAxis).cross(this.eye)) * Y));
      else if (J === "X" || J === "Y" || J === "Z") {
        if ((this.rotationAxis.copy(q_[J]), t0.copy(q_[J]), W === "local")) t0.applyQuaternion(this.worldQuaternion);
        if ((t0.cross(this.eye), t0.length() === 0)) D = !0;
        else this.rotationAngle = this._offset.dot(t0.normalize()) * Y;
      }
      if (J === "E" || D)
        (this.rotationAxis.copy(this.eye),
          (this.rotationAngle = this.pointEnd.angleTo(this.pointStart)),
          this._startNorm.copy(this.pointStart).normalize(),
          this._endNorm.copy(this.pointEnd).normalize(),
          (this.rotationAngle *= this._endNorm.cross(this._startNorm).dot(this.eye) < 0 ? 1 : -1));
      if (this.rotationSnap)
        this.rotationAngle = Math.round(this.rotationAngle / this.rotationSnap) * this.rotationSnap;
      if (W === "local" && J !== "E" && J !== "XYZE")
        (Q.quaternion.copy(this._quaternionStart),
          Q.quaternion.multiply(N0.setFromAxisAngle(this.rotationAxis, this.rotationAngle)).normalize());
      else
        (this.rotationAxis.applyQuaternion(this._parentQuaternionInv),
          Q.quaternion.copy(N0.setFromAxisAngle(this.rotationAxis, this.rotationAngle)),
          Q.quaternion.multiply(this._quaternionStart).normalize());
    }
    (this.dispatchEvent(uE), this.dispatchEvent(E_));
  }
  pointerUp($) {
    if ($ !== null && $.button !== 0) return;
    if (this.dragging && this.axis !== null) ((B_.mode = this.mode), this.dispatchEvent(B_));
    ((this.dragging = !1), (this.axis = null));
  }
  dispose() {
    (this.disconnect(), this._root.dispose());
  }
  attach($) {
    return ((this.object = $), (this._root.visible = !0), this);
  }
  detach() {
    return ((this.object = void 0), (this.axis = null), (this._root.visible = !1), this);
  }
  reset() {
    if (!this.enabled) return;
    if (this.dragging)
      (this.object.position.copy(this._positionStart),
        this.object.quaternion.copy(this._quaternionStart),
        this.object.scale.copy(this._scaleStart),
        this.dispatchEvent(uE),
        this.dispatchEvent(E_),
        this.pointStart.copy(this.pointEnd));
  }
  getRaycaster() {
    return s9;
  }
  getMode() {
    return this.mode;
  }
  setMode($) {
    this.mode = $;
  }
  setTranslationSnap($) {
    this.translationSnap = $;
  }
  setRotationSnap($) {
    this.rotationSnap = $;
  }
  setScaleSnap($) {
    this.scaleSnap = $;
  }
  setSize($) {
    this.size = $;
  }
  setSpace($) {
    this.space = $;
  }
  setColors($, J, U, Q) {
    let W = this._gizmo.materialLib;
    if (
      (W.xAxis.color.set($),
      W.yAxis.color.set(J),
      W.zAxis.color.set(U),
      W.active.color.set(Q),
      W.xAxisTransparent.color.set($),
      W.yAxisTransparent.color.set(J),
      W.zAxisTransparent.color.set(U),
      W.activeTransparent.color.set(Q),
      W.xAxis._color)
    )
      W.xAxis._color.set($);
    if (W.yAxis._color) W.yAxis._color.set(J);
    if (W.zAxis._color) W.zAxis._color.set(U);
    if (W.active._color) W.active._color.set(Q);
    if (W.xAxisTransparent._color) W.xAxisTransparent._color.set($);
    if (W.yAxisTransparent._color) W.yAxisTransparent._color.set(J);
    if (W.zAxisTransparent._color) W.zAxisTransparent._color.set(U);
    if (W.activeTransparent._color) W.activeTransparent._color.set(Q);
  }
}
function di($) {
  if (this.domElement.ownerDocument.pointerLockElement) return { x: 0, y: 0, button: $.button };
  else {
    let J = this.domElement.getBoundingClientRect();
    return {
      x: (($.clientX - J.left) / J.width) * 2 - 1,
      y: (-($.clientY - J.top) / J.height) * 2 + 1,
      button: $.button,
    };
  }
}
function ci($) {
  if (!this.enabled) return;
  switch ($.pointerType) {
    case "mouse":
    case "pen":
      this.pointerHover(this._getPointer($));
      break;
  }
}
function ni($) {
  if (!this.enabled) return;
  if (!document.pointerLockElement) this.domElement.setPointerCapture($.pointerId);
  (this.domElement.addEventListener("pointermove", this._onPointerMove),
    this.pointerHover(this._getPointer($)),
    this.pointerDown(this._getPointer($)));
}
function ii($) {
  if (!this.enabled) return;
  this.pointerMove(this._getPointer($));
}
function oi($) {
  if (!this.enabled) return;
  (this.domElement.releasePointerCapture($.pointerId),
    this.domElement.removeEventListener("pointermove", this._onPointerMove),
    this.pointerUp(this._getPointer($)));
}
function lE($, J, U) {
  let Q = J.intersectObject($, !0);
  for (let W = 0; W < Q.length; W++) if (Q[W].object.visible || U) return Q[W];
  return !1;
}
var nG = new NU(),
  X0 = new C(0, 1, 0),
  L_ = new C(0, 0, 0),
  w_ = new x6(),
  iG = new H0(),
  rG = new H0(),
  hU = new C(),
  I_ = new x6(),
  _X = new C(1, 0, 0),
  a9 = new C(0, 1, 0),
  SX = new C(0, 0, 1),
  oG = new C(),
  ZX = new C(),
  PX = new C();
class V_ extends F0 {
  constructor($) {
    super();
    ((this.isTransformControlsRoot = !0), (this.controls = $), (this.visible = !1));
  }
  updateMatrixWorld($) {
    let J = this.controls;
    if (J.object !== void 0) {
      if ((J.object.updateMatrixWorld(), J.object.parent === null))
        console.error("TransformControls: The attached 3D object must be a part of the scene graph.");
      else J.object.parent.matrixWorld.decompose(J._parentPosition, J._parentQuaternion, J._parentScale);
      (J.object.matrixWorld.decompose(J.worldPosition, J.worldQuaternion, J._worldScale),
        J._parentQuaternionInv.copy(J._parentQuaternion).invert(),
        J._worldQuaternionInv.copy(J.worldQuaternion).invert());
    }
    if (
      (J.camera.updateMatrixWorld(),
      J.camera.matrixWorld.decompose(J.cameraPosition, J.cameraQuaternion, J._cameraScale),
      J.camera.isOrthographicCamera)
    )
      J.camera.getWorldDirection(J.eye).negate();
    else J.eye.copy(J.cameraPosition).sub(J.worldPosition).normalize();
    super.updateMatrixWorld($);
  }
  dispose() {
    this.traverse(function ($) {
      if ($.geometry) $.geometry.dispose();
      if ($.material) $.material.dispose();
    });
  }
}
class k_ extends F0 {
  constructor() {
    super();
    ((this.isTransformControlsGizmo = !0), (this.type = "TransformControlsGizmo"));
    let $ = new KJ({ depthTest: !1, depthWrite: !1, fog: !1, toneMapped: !1, transparent: !0 }),
      J = new fU({ depthTest: !1, depthWrite: !1, fog: !1, toneMapped: !1, transparent: !0 }),
      U = $.clone();
    U.opacity = 0.15;
    let Q = J.clone();
    Q.opacity = 0.5;
    let W = $.clone();
    W.color.setHex(16711680);
    let X = $.clone();
    X.color.setHex(65280);
    let Y = $.clone();
    Y.color.setHex(255);
    let D = $.clone();
    (D.color.setHex(16711680), (D.opacity = 0.5));
    let H = $.clone();
    (H.color.setHex(65280), (H.opacity = 0.5));
    let G = $.clone();
    (G.color.setHex(255), (G.opacity = 0.5));
    let K = $.clone();
    K.opacity = 0.25;
    let O = $.clone();
    (O.color.setHex(16776960), (O.opacity = 0.25));
    let N = $.clone();
    N.color.setHex(16776960);
    let F = $.clone();
    (F.color.setHex(7895160),
      (this.materialLib = {
        xAxis: W,
        yAxis: X,
        zAxis: Y,
        active: N,
        xAxisTransparent: D,
        yAxisTransparent: H,
        zAxisTransparent: G,
        activeTransparent: O,
      }));
    let B = new K0(0, 0.04, 0.1, 12);
    B.translate(0, 0.05, 0);
    let E = new p6(0.08, 0.08, 0.08);
    E.translate(0, 0.04, 0);
    let z = new Q0();
    z.setAttribute("position", new S6([0, 0, 0, 1, 0, 0], 3));
    let q = new K0(0.0075, 0.0075, 0.5, 3);
    q.translate(0, 0.25, 0);
    function L(b, i) {
      let x = new H8(b, 0.0075, 3, 64, i * Math.PI * 2);
      return (x.rotateY(Math.PI / 2), x.rotateX(Math.PI / 2), x);
    }
    function V() {
      let b = new Q0();
      return (b.setAttribute("position", new S6([0, 0, 0, 1, 1, 1], 3)), b);
    }
    let k = {
        X: [
          [new X$(B, W), [0.5, 0, 0], [0, 0, -Math.PI / 2]],
          [new X$(B, W), [-0.5, 0, 0], [0, 0, Math.PI / 2]],
          [new X$(q, W), [0, 0, 0], [0, 0, -Math.PI / 2]],
        ],
        Y: [[new X$(B, X), [0, 0.5, 0]], [new X$(B, X), [0, -0.5, 0], [Math.PI, 0, 0]], [new X$(q, X)]],
        Z: [
          [new X$(B, Y), [0, 0, 0.5], [Math.PI / 2, 0, 0]],
          [new X$(B, Y), [0, 0, -0.5], [-Math.PI / 2, 0, 0]],
          [new X$(q, Y), null, [Math.PI / 2, 0, 0]],
        ],
        XYZ: [[new X$(new Q9(0.1, 0), K), [0, 0, 0]]],
        XY: [[new X$(new p6(0.15, 0.15, 0.01), G), [0.15, 0.15, 0]]],
        YZ: [[new X$(new p6(0.15, 0.15, 0.01), D), [0, 0.15, 0.15], [0, Math.PI / 2, 0]]],
        XZ: [[new X$(new p6(0.15, 0.15, 0.01), H), [0.15, 0, 0.15], [-Math.PI / 2, 0, 0]]],
      },
      R = {
        X: [
          [new X$(new K0(0.2, 0, 0.6, 4), U), [0.3, 0, 0], [0, 0, -Math.PI / 2]],
          [new X$(new K0(0.2, 0, 0.6, 4), U), [-0.3, 0, 0], [0, 0, Math.PI / 2]],
        ],
        Y: [
          [new X$(new K0(0.2, 0, 0.6, 4), U), [0, 0.3, 0]],
          [new X$(new K0(0.2, 0, 0.6, 4), U), [0, -0.3, 0], [0, 0, Math.PI]],
        ],
        Z: [
          [new X$(new K0(0.2, 0, 0.6, 4), U), [0, 0, 0.3], [Math.PI / 2, 0, 0]],
          [new X$(new K0(0.2, 0, 0.6, 4), U), [0, 0, -0.3], [-Math.PI / 2, 0, 0]],
        ],
        XYZ: [[new X$(new Q9(0.2, 0), U)]],
        XY: [[new X$(new p6(0.2, 0.2, 0.01), U), [0.15, 0.15, 0]]],
        YZ: [[new X$(new p6(0.2, 0.2, 0.01), U), [0, 0.15, 0.15], [0, Math.PI / 2, 0]]],
        XZ: [[new X$(new p6(0.2, 0.2, 0.01), U), [0.15, 0, 0.15], [-Math.PI / 2, 0, 0]]],
      },
      _ = {
        START: [[new X$(new Q9(0.01, 2), Q), null, null, null, "helper"]],
        END: [[new X$(new Q9(0.01, 2), Q), null, null, null, "helper"]],
        DELTA: [[new s0(V(), Q), null, null, null, "helper"]],
        X: [[new s0(z, Q), [-1000, 0, 0], null, [1e6, 1, 1], "helper"]],
        Y: [[new s0(z, Q), [0, -1000, 0], [0, 0, Math.PI / 2], [1e6, 1, 1], "helper"]],
        Z: [[new s0(z, Q), [0, 0, -1000], [0, -Math.PI / 2, 0], [1e6, 1, 1], "helper"]],
      },
      S = {
        XYZE: [[new X$(L(0.5, 1), F), null, [0, Math.PI / 2, 0]]],
        X: [[new X$(L(0.5, 0.5), W)]],
        Y: [[new X$(L(0.5, 0.5), X), null, [0, 0, -Math.PI / 2]]],
        Z: [[new X$(L(0.5, 0.5), Y), null, [0, Math.PI / 2, 0]]],
        E: [[new X$(L(0.75, 1), O), null, [0, Math.PI / 2, 0]]],
      },
      w = { AXIS: [[new s0(z, Q), [-1000, 0, 0], null, [1e6, 1, 1], "helper"]] },
      M = {
        XYZE: [[new X$(new NJ(0.25, 10, 8), U)]],
        X: [[new X$(new H8(0.5, 0.1, 4, 24), U), [0, 0, 0], [0, -Math.PI / 2, -Math.PI / 2]]],
        Y: [[new X$(new H8(0.5, 0.1, 4, 24), U), [0, 0, 0], [Math.PI / 2, 0, 0]]],
        Z: [[new X$(new H8(0.5, 0.1, 4, 24), U), [0, 0, 0], [0, 0, -Math.PI / 2]]],
        E: [[new X$(new H8(0.75, 0.1, 2, 24), U)]],
      },
      m = {
        X: [
          [new X$(E, W), [0.5, 0, 0], [0, 0, -Math.PI / 2]],
          [new X$(q, W), [0, 0, 0], [0, 0, -Math.PI / 2]],
          [new X$(E, W), [-0.5, 0, 0], [0, 0, Math.PI / 2]],
        ],
        Y: [[new X$(E, X), [0, 0.5, 0]], [new X$(q, X)], [new X$(E, X), [0, -0.5, 0], [0, 0, Math.PI]]],
        Z: [
          [new X$(E, Y), [0, 0, 0.5], [Math.PI / 2, 0, 0]],
          [new X$(q, Y), [0, 0, 0], [Math.PI / 2, 0, 0]],
          [new X$(E, Y), [0, 0, -0.5], [-Math.PI / 2, 0, 0]],
        ],
        XY: [[new X$(new p6(0.15, 0.15, 0.01), G), [0.15, 0.15, 0]]],
        YZ: [[new X$(new p6(0.15, 0.15, 0.01), D), [0, 0.15, 0.15], [0, Math.PI / 2, 0]]],
        XZ: [[new X$(new p6(0.15, 0.15, 0.01), H), [0.15, 0, 0.15], [-Math.PI / 2, 0, 0]]],
        XYZ: [[new X$(new p6(0.1, 0.1, 0.1), K)]],
      },
      P = {
        X: [
          [new X$(new K0(0.2, 0, 0.6, 4), U), [0.3, 0, 0], [0, 0, -Math.PI / 2]],
          [new X$(new K0(0.2, 0, 0.6, 4), U), [-0.3, 0, 0], [0, 0, Math.PI / 2]],
        ],
        Y: [
          [new X$(new K0(0.2, 0, 0.6, 4), U), [0, 0.3, 0]],
          [new X$(new K0(0.2, 0, 0.6, 4), U), [0, -0.3, 0], [0, 0, Math.PI]],
        ],
        Z: [
          [new X$(new K0(0.2, 0, 0.6, 4), U), [0, 0, 0.3], [Math.PI / 2, 0, 0]],
          [new X$(new K0(0.2, 0, 0.6, 4), U), [0, 0, -0.3], [-Math.PI / 2, 0, 0]],
        ],
        XY: [[new X$(new p6(0.2, 0.2, 0.01), U), [0.15, 0.15, 0]]],
        YZ: [[new X$(new p6(0.2, 0.2, 0.01), U), [0, 0.15, 0.15], [0, Math.PI / 2, 0]]],
        XZ: [[new X$(new p6(0.2, 0.2, 0.01), U), [0.15, 0, 0.15], [-Math.PI / 2, 0, 0]]],
        XYZ: [[new X$(new p6(0.2, 0.2, 0.2), U), [0, 0, 0]]],
      },
      u = {
        X: [[new s0(z, Q), [-1000, 0, 0], null, [1e6, 1, 1], "helper"]],
        Y: [[new s0(z, Q), [0, -1000, 0], [0, 0, Math.PI / 2], [1e6, 1, 1], "helper"]],
        Z: [[new s0(z, Q), [0, 0, -1000], [0, -Math.PI / 2, 0], [1e6, 1, 1], "helper"]],
      };
    function n(b) {
      let i = new F0();
      for (let x in b)
        for (let l = b[x].length; l--;) {
          let r = b[x][l][0].clone(),
            G$ = b[x][l][1],
            k$ = b[x][l][2],
            h$ = b[x][l][3],
            b$ = b[x][l][4];
          if (((r.name = x), (r.tag = b$), G$)) r.position.set(G$[0], G$[1], G$[2]);
          if (k$) r.rotation.set(k$[0], k$[1], k$[2]);
          if (h$) r.scale.set(h$[0], h$[1], h$[2]);
          r.updateMatrix();
          let b6 = r.geometry.clone();
          (b6.applyMatrix4(r.matrix),
            (r.geometry = b6),
            (r.renderOrder = 1 / 0),
            r.position.set(0, 0, 0),
            r.rotation.set(0, 0, 0),
            r.scale.set(1, 1, 1),
            i.add(r));
        }
      return i;
    }
    ((this.gizmo = {}),
      (this.picker = {}),
      (this.helper = {}),
      this.add((this.gizmo.translate = n(k))),
      this.add((this.gizmo.rotate = n(S))),
      this.add((this.gizmo.scale = n(m))),
      this.add((this.picker.translate = n(R))),
      this.add((this.picker.rotate = n(M))),
      this.add((this.picker.scale = n(P))),
      this.add((this.helper.translate = n(_))),
      this.add((this.helper.rotate = n(w))),
      this.add((this.helper.scale = n(u))),
      (this.picker.translate.visible = !1),
      (this.picker.rotate.visible = !1),
      (this.picker.scale.visible = !1));
  }
  updateMatrixWorld($) {
    let U = (this.mode === "scale" ? "local" : this.space) === "local" ? this.worldQuaternion : rG;
    ((this.gizmo.translate.visible = this.mode === "translate"),
      (this.gizmo.rotate.visible = this.mode === "rotate"),
      (this.gizmo.scale.visible = this.mode === "scale"),
      (this.helper.translate.visible = this.mode === "translate"),
      (this.helper.rotate.visible = this.mode === "rotate"),
      (this.helper.scale.visible = this.mode === "scale"));
    let Q = [];
    ((Q = Q.concat(this.picker[this.mode].children)),
      (Q = Q.concat(this.gizmo[this.mode].children)),
      (Q = Q.concat(this.helper[this.mode].children)));
    for (let W = 0; W < Q.length; W++) {
      let X = Q[W];
      ((X.visible = !0), X.rotation.set(0, 0, 0), X.position.copy(this.worldPosition));
      let Y;
      if (this.camera.isOrthographicCamera) Y = (this.camera.top - this.camera.bottom) / this.camera.zoom;
      else
        Y =
          this.worldPosition.distanceTo(this.cameraPosition) *
          Math.min((1.9 * Math.tan((Math.PI * this.camera.fov) / 360)) / this.camera.zoom, 7);
      if ((X.scale.set(1, 1, 1).multiplyScalar((Y * this.size) / 4), X.tag === "helper")) {
        if (((X.visible = !1), X.name === "AXIS")) {
          if (((X.visible = !!this.axis), this.axis === "X")) {
            if (
              (N0.setFromEuler(nG.set(0, 0, 0)),
              X.quaternion.copy(U).multiply(N0),
              Math.abs(X0.copy(_X).applyQuaternion(U).dot(this.eye)) > 0.9)
            )
              X.visible = !1;
          }
          if (this.axis === "Y") {
            if (
              (N0.setFromEuler(nG.set(0, 0, Math.PI / 2)),
              X.quaternion.copy(U).multiply(N0),
              Math.abs(X0.copy(a9).applyQuaternion(U).dot(this.eye)) > 0.9)
            )
              X.visible = !1;
          }
          if (this.axis === "Z") {
            if (
              (N0.setFromEuler(nG.set(0, Math.PI / 2, 0)),
              X.quaternion.copy(U).multiply(N0),
              Math.abs(X0.copy(SX).applyQuaternion(U).dot(this.eye)) > 0.9)
            )
              X.visible = !1;
          }
          if (this.axis === "XYZE")
            (N0.setFromEuler(nG.set(0, Math.PI / 2, 0)),
              X0.copy(this.rotationAxis),
              X.quaternion.setFromRotationMatrix(w_.lookAt(L_, X0, a9)),
              X.quaternion.multiply(N0),
              (X.visible = this.dragging));
          if (this.axis === "E") X.visible = !1;
        } else if (X.name === "START") (X.position.copy(this.worldPositionStart), (X.visible = this.dragging));
        else if (X.name === "END") (X.position.copy(this.worldPosition), (X.visible = this.dragging));
        else if (X.name === "DELTA")
          (X.position.copy(this.worldPositionStart),
            X.quaternion.copy(this.worldQuaternionStart),
            t0
              .set(0.0000000001, 0.0000000001, 0.0000000001)
              .add(this.worldPositionStart)
              .sub(this.worldPosition)
              .multiplyScalar(-1),
            t0.applyQuaternion(this.worldQuaternionStart.clone().invert()),
            X.scale.copy(t0),
            (X.visible = this.dragging));
        else {
          if ((X.quaternion.copy(U), this.dragging)) X.position.copy(this.worldPositionStart);
          else X.position.copy(this.worldPosition);
          if (this.axis) X.visible = this.axis.search(X.name) !== -1;
        }
        continue;
      }
      if ((X.quaternion.copy(U), this.mode === "translate" || this.mode === "scale")) {
        if (X.name === "X") {
          if (Math.abs(X0.copy(_X).applyQuaternion(U).dot(this.eye)) > 0.99)
            (X.scale.set(0.0000000001, 0.0000000001, 0.0000000001), (X.visible = !1));
        }
        if (X.name === "Y") {
          if (Math.abs(X0.copy(a9).applyQuaternion(U).dot(this.eye)) > 0.99)
            (X.scale.set(0.0000000001, 0.0000000001, 0.0000000001), (X.visible = !1));
        }
        if (X.name === "Z") {
          if (Math.abs(X0.copy(SX).applyQuaternion(U).dot(this.eye)) > 0.99)
            (X.scale.set(0.0000000001, 0.0000000001, 0.0000000001), (X.visible = !1));
        }
        if (X.name === "XY") {
          if (Math.abs(X0.copy(SX).applyQuaternion(U).dot(this.eye)) < 0.2)
            (X.scale.set(0.0000000001, 0.0000000001, 0.0000000001), (X.visible = !1));
        }
        if (X.name === "YZ") {
          if (Math.abs(X0.copy(_X).applyQuaternion(U).dot(this.eye)) < 0.2)
            (X.scale.set(0.0000000001, 0.0000000001, 0.0000000001), (X.visible = !1));
        }
        if (X.name === "XZ") {
          if (Math.abs(X0.copy(a9).applyQuaternion(U).dot(this.eye)) < 0.2)
            (X.scale.set(0.0000000001, 0.0000000001, 0.0000000001), (X.visible = !1));
        }
      } else if (this.mode === "rotate") {
        if ((iG.copy(U), X0.copy(this.eye).applyQuaternion(N0.copy(U).invert()), X.name.search("E") !== -1))
          X.quaternion.setFromRotationMatrix(w_.lookAt(this.eye, L_, a9));
        if (X.name === "X")
          (N0.setFromAxisAngle(_X, Math.atan2(-X0.y, X0.z)), N0.multiplyQuaternions(iG, N0), X.quaternion.copy(N0));
        if (X.name === "Y")
          (N0.setFromAxisAngle(a9, Math.atan2(X0.x, X0.z)), N0.multiplyQuaternions(iG, N0), X.quaternion.copy(N0));
        if (X.name === "Z")
          (N0.setFromAxisAngle(SX, Math.atan2(X0.y, X0.x)), N0.multiplyQuaternions(iG, N0), X.quaternion.copy(N0));
      }
      if (
        ((X.visible = X.visible && (X.name.indexOf("X") === -1 || this.showX)),
        (X.visible = X.visible && (X.name.indexOf("Y") === -1 || this.showY)),
        (X.visible = X.visible && (X.name.indexOf("Z") === -1 || this.showZ)),
        (X.visible = X.visible && (X.name.indexOf("E") === -1 || (this.showX && this.showY && this.showZ))),
        (X.visible = X.visible && (X.name.indexOf("XY") === -1 || this.showXY)),
        (X.visible = X.visible && (X.name.indexOf("YZ") === -1 || this.showYZ)),
        (X.visible = X.visible && (X.name.indexOf("XZ") === -1 || this.showXZ)),
        (X.material._color = X.material._color || X.material.color.clone()),
        (X.material._opacity = X.material._opacity || X.material.opacity),
        X.material.color.copy(X.material._color),
        (X.material.opacity = X.material._opacity),
        this.enabled && this.axis)
      ) {
        if (X.name === this.axis) (X.material.color.copy(this.materialLib.active.color), (X.material.opacity = 1));
        else if (
          this.axis.split("").some(function (D) {
            return X.name === D;
          })
        )
          (X.material.color.copy(this.materialLib.active.color), (X.material.opacity = 1));
      }
    }
    super.updateMatrixWorld($);
  }
}
class A_ extends X$ {
  constructor() {
    super(
      new yU(1e5, 1e5, 2, 2),
      new KJ({ visible: !1, wireframe: !0, side: AJ, transparent: !0, opacity: 0.1, toneMapped: !1 }),
    );
    ((this.isTransformControlsPlane = !0), (this.type = "TransformControlsPlane"));
  }
  updateMatrixWorld($) {
    let J = this.space;
    if ((this.position.copy(this.worldPosition), this.mode === "scale")) J = "local";
    switch (
      (oG.copy(_X).applyQuaternion(J === "local" ? this.worldQuaternion : rG),
      ZX.copy(a9).applyQuaternion(J === "local" ? this.worldQuaternion : rG),
      PX.copy(SX).applyQuaternion(J === "local" ? this.worldQuaternion : rG),
      X0.copy(ZX),
      this.mode)
    ) {
      case "translate":
      case "scale":
        switch (this.axis) {
          case "X":
            (X0.copy(this.eye).cross(oG), hU.copy(oG).cross(X0));
            break;
          case "Y":
            (X0.copy(this.eye).cross(ZX), hU.copy(ZX).cross(X0));
            break;
          case "Z":
            (X0.copy(this.eye).cross(PX), hU.copy(PX).cross(X0));
            break;
          case "XY":
            hU.copy(PX);
            break;
          case "YZ":
            hU.copy(oG);
            break;
          case "XZ":
            (X0.copy(PX), hU.copy(ZX));
            break;
          case "XYZ":
          case "E":
            hU.set(0, 0, 0);
            break;
        }
        break;
      case "rotate":
      default:
        hU.set(0, 0, 0);
    }
    if (hU.length() === 0) this.quaternion.copy(this.cameraQuaternion);
    else (I_.lookAt(t0.set(0, 0, 0), hU, X0), this.quaternion.setFromRotationMatrix(I_));
    super.updateMatrixWorld($);
  }
}
function M_($) {
  if (/^(https?:|data:|blob:|file:)/i.test($)) return $;
  return $;
}
var t9 = Math.PI / 180,
  sG = 180 / Math.PI;
function aG($) {
  return new cJ({ color: $, roughness: 0.72 });
}
function ri($, J, U) {
  let Q = new GJ(),
    X = U === "small" ? $ * 0.34 : $ * 0.48,
    Y = new X$(new W9(X * 0.34, X * 0.75, 5, 10), aG(J));
  ((Y.rotation.z = Math.PI / 2), (Y.position.y = X * 0.72));
  let D = new X$(new NJ(X * 0.28, 16, 12), aG(J));
  (D.position.set(X * 0.62, X * 0.88, 0), Q.add(Y, D));
  for (let G of [-0.34, 0.34])
    for (let K of [-0.2, 0.2]) {
      let O = new X$(new K0(X * 0.07, X * 0.085, X * 0.58, 10), aG(J));
      (O.position.set(X * G, X * 0.34, X * K), Q.add(O));
    }
  let H = new X$(new K0(X * 0.035, X * 0.065, X * 0.6, 8), aG(J));
  return ((H.rotation.z = -Math.PI / 3), H.position.set(-X * 0.72, X * 0.78, 0), Q.add(H), Q);
}
function si($) {
  let J = $.children.find((U) => U.userData.isDirectorActorLabel);
  if (!J) return;
  (J.material.map?.dispose(), J.material.dispose(), $.remove(J));
}
function pE($, J, U, Q) {
  si($);
  let W = document.createElement("canvas");
  ((W.width = 512), (W.height = 128));
  let X = W.getContext("2d");
  if (!X) return;
  (X.clearRect(0, 0, W.width, W.height),
    (X.fillStyle = "rgba(18, 20, 24, 0.92)"),
    X.beginPath(),
    X.roundRect(8, 10, 496, 108, 28),
    X.fill(),
    (X.fillStyle = U),
    X.fillRect(8, 10, 14, 108),
    (X.font = "600 46px -apple-system, BlinkMacSystemFont, sans-serif"),
    (X.textAlign = "center"),
    (X.textBaseline = "middle"),
    (X.fillStyle = "#ffffff"),
    X.fillText(J.slice(0, 12), 264, 66));
  let Y = new SG(W);
  Y.colorSpace = J9;
  let D = new ZG(new BX({ map: Y, transparent: !0, depthTest: !1 }));
  if (((D.userData.isDirectorActorLabel = !0), $.userData.elementId)) D.userData.elementId = $.userData.elementId;
  ((D.renderOrder = 999), D.position.set(0, Q + 0.24, 0), D.scale.set(1.55, 0.39, 1), $.add(D));
}
class ai {
  scene = new AG();
  camera;
  shotCamera;
  renderer;
  monitorRenderer = null;
  monitorContainer = null;
  orbit;
  gizmo;
  gizmoHelper;
  transformControlsVisible = !0;
  cameraHelpersVisible = !1;
  transformDragging = !1;
  transformDirty = !1;
  pointerDownWasTransform = !1;
  transformMode = "translate";
  cameraRigSelected = !1;
  grid;
  ground;
  shotCameraHelper;
  shotCameraBody;
  shotTargetMarker;
  shotPath;
  actionPathGroup = new GJ();
  shotTarget = new C(0, 1, 0);
  shotRollDeg = 0;
  objects = new Map();
  elementCache = new Map();
  raf = 0;
  container;
  texLoader = new vG();
  pendingTextures = 0;
  onTransformCommit;
  onPick;
  onDoublePick;
  onCameraChanged;
  onCameraRigPick;
  onCameraRigCommit;
  onActionPointPick;
  onActionHandlePick;
  onActionHandleCommit;
  constructor($) {
    this.container = $;
    let J = $.clientWidth || 800,
      U = $.clientHeight || 600;
    ((this.scene.background = new W6(1447964)),
      (this.scene.fog = new zX(1447964, 40, 90)),
      (this.camera = new r0(45, J / U, 0.05, 200)),
      this.camera.position.set(5, 3.2, 6.5),
      (this.shotCamera = new r0(45, 1.7777777777777777, 0.05, 200)),
      this.shotCamera.position.set(0, 2.3, 7),
      this.shotCamera.lookAt(this.shotTarget),
      (this.renderer = new pG({ antialias: !0, preserveDrawingBuffer: !0, alpha: !0 })),
      this.renderer.setSize(J, U),
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)),
      (this.renderer.outputColorSpace = J9),
      $.appendChild(this.renderer.domElement),
      this.scene.add(new yG(16777215, 0.7)));
    let Q = new fG(16777215, 0.9);
    (Q.position.set(6, 10, 4),
      this.scene.add(Q),
      (this.grid = new xG(40, 40, 3817287, 2501168)),
      this.scene.add(this.grid),
      (this.ground = new X$(new yU(200, 200), new KJ({ visible: !1 }))),
      (this.ground.rotation.x = -Math.PI / 2),
      (this.ground.userData.isGround = !0),
      this.scene.add(this.ground),
      (this.shotCameraBody = new GJ()));
    let W = new X$(new p6(0.42, 0.26, 0.34), new cJ({ color: 15198443, roughness: 0.65 }));
    W.position.z = 0.12;
    let X = new X$(new K0(0.11, 0.16, 0.24, 16), new cJ({ color: 7567746, roughness: 0.75 }));
    ((X.rotation.x = Math.PI / 2),
      (X.position.z = -0.18),
      this.shotCameraBody.add(W, X),
      this.shotCameraBody.traverse((H) => {
        H.userData.isShotCameraRig = !0;
      }),
      this.shotCamera.add(this.shotCameraBody),
      (this.shotCamera.userData.isShotCameraRig = !0),
      this.scene.add(this.shotCamera),
      (this.shotCameraHelper = new gG(this.shotCamera)),
      this.shotCameraHelper.traverse((H) => {
        H.userData.isShotCameraHelper = !0;
      }),
      this.scene.add(this.shotCameraHelper),
      (this.shotTargetMarker = new X$(new NJ(0.09, 14, 10), new KJ({ color: 16777215 }))),
      this.shotTargetMarker.position.copy(this.shotTarget),
      this.scene.add(this.shotTargetMarker),
      (this.shotPath = new s0(
        new Q0().setFromPoints([this.shotCamera.position.clone(), this.shotCamera.position.clone()]),
        new EX({ color: 12567498, dashSize: 0.28, gapSize: 0.18, transparent: !0, opacity: 0.7 }),
      )),
      this.shotPath.computeLineDistances(),
      this.scene.add(this.shotPath),
      this.scene.add(this.actionPathGroup),
      (this.orbit = new hE(this.camera, this.renderer.domElement)),
      this.orbit.target.set(0, 1, 0),
      (this.orbit.enableDamping = !0),
      (this.orbit.dampingFactor = 0.08),
      (this.orbit.maxPolarAngle = Math.PI * 0.495),
      this.orbit.addEventListener("change", () => this.onCameraChanged?.()),
      (this.gizmo = new mE(this.camera, this.renderer.domElement)),
      this.gizmo.setSize(0.72),
      (this.gizmoHelper = this.gizmo.getHelper()),
      this.gizmoHelper.traverse((H) => {
        H.userData.isGizmo = !0;
      }),
      this.scene.add(this.gizmoHelper),
      this.gizmo.addEventListener("dragging-changed", (H) => {
        let G = H.value;
        if (((this.transformDragging = G), (this.orbit.enabled = !G), G)) this.transformDirty = !1;
        else if (this.transformDirty) this.commitTransform();
      }),
      this.gizmo.addEventListener("mouseDown", () => {
        this.pointerDownWasTransform = !0;
      }),
      this.gizmo.addEventListener("objectChange", () => {
        this.transformDirty = !0;
      }));
    let Y = null;
    (this.renderer.domElement.addEventListener("pointerdown", (H) => {
      ((Y = { x: H.clientX, y: H.clientY }), (this.pointerDownWasTransform = this.transformDragging));
    }),
      this.renderer.domElement.addEventListener("pointerup", (H) => {
        if (!Y) return;
        let G = Math.hypot(H.clientX - Y.x, H.clientY - Y.y);
        Y = null;
        let K = this.pointerDownWasTransform || this.transformDragging;
        if (((this.pointerDownWasTransform = !1), K)) return;
        if (G > 4) return;
        this.pick(H);
      }),
      this.renderer.domElement.addEventListener("dblclick", (H) => this.pick(H, !0)));
    let D = () => {
      if (((this.raf = requestAnimationFrame(D)), this.exportCameraActive))
        (this.setShotHelpersVisible(!1, this.exportActorLabels), this.renderer.render(this.scene, this.shotCamera));
      else
        (this.orbit.update(),
          this.faceBillboards(),
          this.shotCameraHelper.update(),
          this.renderer.render(this.scene, this.camera));
      if (this.monitorRenderer) {
        let H = this.gizmoHelper.visible;
        (this.setShotHelpersVisible(!1, !0),
          (this.gizmoHelper.visible = !1),
          this.monitorRenderer.render(this.scene, this.shotCamera),
          this.setShotHelpersVisible(!0),
          (this.gizmoHelper.visible = H));
      }
    };
    D();
  }
  dispose() {
    (cancelAnimationFrame(this.raf),
      this.gizmo.detach(),
      this.gizmo.dispose(),
      this.orbit.dispose(),
      this.scene.traverse(($) => {
        let J = $;
        if (J.geometry) J.geometry.dispose();
        let U = J.material;
        if (Array.isArray(U)) U.forEach((Q) => Q.dispose());
        else U?.dispose();
      }),
      this.renderer.dispose(),
      this.monitorRenderer?.dispose(),
      this.monitorRenderer?.domElement.remove(),
      (this.monitorContainer = null),
      this.renderer.domElement.remove());
  }
  attachMonitor($) {
    (this.monitorRenderer?.dispose(), this.monitorRenderer?.domElement.remove());
    let J = new pG({ antialias: !0 });
    (J.setPixelRatio(Math.min(window.devicePixelRatio, 2)),
      J.setSize($.clientWidth || 240, $.clientHeight || 135, !1),
      (J.outputColorSpace = J9),
      (J.domElement.style.width = "100%"),
      (J.domElement.style.height = "100%"),
      $.replaceChildren(J.domElement),
      (this.monitorRenderer = J),
      (this.monitorContainer = $));
  }
  resize() {
    let $ = this.container.clientWidth,
      J = this.container.clientHeight;
    if (!$ || !J) return;
    if (
      ((this.camera.aspect = $ / J),
      this.camera.updateProjectionMatrix(),
      this.renderer.setSize($, J),
      this.monitorRenderer && this.monitorContainer)
    ) {
      let U = this.monitorContainer.clientWidth,
        Q = this.monitorContainer.clientHeight;
      if (U && Q) this.monitorRenderer.setSize(U, Q, !1);
    }
  }
  get texturesReady() {
    return this.pendingTextures === 0;
  }
  syncElements($) {
    let J = new Map($.map((U) => [U.id, U]));
    for (let [U, Q] of this.objects)
      if (!J.has(U)) {
        if (this.gizmo.object === Q) this.gizmo.detach();
        (this.scene.remove(Q), this.objects.delete(U), this.elementCache.delete(U));
      }
    for (let U of $) {
      let Q = this.elementCache.get(U.id),
        W = this.objects.get(U.id);
      if (
        !W ||
        (Q &&
          (Q.kind !== U.kind ||
            (U.kind === "mannequin" &&
              (Q.heightM !== U.heightM || Q.bodyType !== U.bodyType || Q.animalSpecies !== U.animalSpecies)) ||
            (U.kind === "billboard" && (Q.imagePath !== U.imagePath || Q.heightM !== U.heightM)) ||
            (U.kind === "crowd" &&
              JSON.stringify({ r: Q.rows, c: Q.cols, s: Q.spacing }) !==
                JSON.stringify({ r: U.rows, c: U.cols, s: U.spacing }))))
      ) {
        if (W) {
          if (this.gizmo.object === W) this.gizmo.detach();
          this.scene.remove(W);
        }
        if (((W = this.buildObject(U)), U.kind === "mannequin"))
          pE(W, U.name, U.color, U.bodyType === "animal" ? Math.max(0.8, U.heightM * 0.55) : U.heightM);
        else if (U.kind === "crowd") pE(W, U.name, U.color, 1.95);
        (W.traverse((Y) => {
          Y.userData.elementId = U.id;
        }),
          this.scene.add(W),
          this.objects.set(U.id, W));
      }
      if (!(this.transformDragging && this.gizmo.object === W)) this.applyElementState(W, U, Q);
      this.elementCache.set(U.id, structuredClone(U));
    }
  }
  buildObject($) {
    switch ($.kind) {
      case "box":
        return new X$(new p6(1, 1, 1), new cJ({ color: $.color, roughness: 0.8 }));
      case "sphere":
        return new X$(new NJ(0.5, 20, 16), new cJ({ color: $.color, roughness: 0.8 }));
      case "cylinder":
        return new X$(new K0(0.4, 0.4, 1, 20), new cJ({ color: $.color, roughness: 0.8 }));
      case "wall":
        return new X$(new p6(3, 2.4, 0.12), new cJ({ color: $.color, roughness: 0.9 }));
      case "mannequin":
        return $.bodyType === "animal" ? ri($.heightM, $.color, $.animalSpecies) : bE($.heightM, $.color);
      case "billboard": {
        let J = new GJ();
        J.userData.isBillboard = !0;
        let U = $.heightM,
          Q = new KJ({ color: 16777215, transparent: !0, alphaTest: 0.05, side: AJ }),
          W = new X$(new yU(U * 0.55, U), Q);
        ((W.position.y = U / 2), J.add(W));
        let X = new X$(new d1(0.1, 0.05, 4), new KJ({ color: 2073308 }));
        return (
          (X.position.y = 0.025),
          J.add(X),
          this.pendingTextures++,
          this.texLoader.load(
            M_($.imagePath),
            (Y) => {
              ((Y.colorSpace = J9), (Q.map = Y), (Q.needsUpdate = !0));
              let D = Y.image.width / Y.image.height;
              ((W.scale.x = (D * U) / (U * 0.55)), this.pendingTextures--);
            },
            void 0,
            () => {
              (this.pendingTextures--, Q.color.set(5594214));
            },
          ),
          J
        );
      }
      case "crowd": {
        let J = new GJ(),
          U = oQ($.poseId)?.joints ?? {};
        for (let Q = 0; Q < $.rows; Q++)
          for (let W = 0; W < $.cols; W++) {
            let X = bE(1.65, $.color);
            (fE(X, U),
              X.position.set((W - ($.cols - 1) / 2) * $.spacing, 0, (Q - ($.rows - 1) / 2) * $.spacing),
              J.add(X));
          }
        return J;
      }
    }
  }
  applyElementState($, J, U) {
    if (
      ($.position.set(J.position.x, J.position.y, J.position.z),
      $.rotation.set(J.rotationDeg.x * t9, J.rotationDeg.y * t9, J.rotationDeg.z * t9),
      $.scale.set(J.scale.x, J.scale.y, J.scale.z),
      ($.visible = J.visible),
      !U || U.color !== J.color)
    ) {
      if (J.kind === "mannequin")
        if (J.bodyType === "animal")
          $.traverse((Q) => {
            Q.material?.color?.set(J.color);
          });
        else yE($, J.color);
      else if (J.kind === "crowd") $.children.forEach((Q) => yE(Q, J.color));
      else if (J.kind !== "billboard") $.material.color?.set(J.color);
    }
    if ((J.kind === "mannequin" || J.kind === "crowd") && (!U || U.name !== J.name || U.color !== J.color))
      pE(
        $,
        J.name,
        J.color,
        J.kind === "crowd" ? 1.95 : J.bodyType === "animal" ? Math.max(0.8, J.heightM * 0.55) : J.heightM,
      );
    if (J.kind === "mannequin" && J.bodyType !== "animal") {
      let Q = U;
      if (!Q || JSON.stringify(Q.joints) !== JSON.stringify(J.joints)) fE($, J.joints);
    }
  }
  setSelection($) {
    for (let [J, U] of this.objects) {
      let Q = $.includes(J);
      U.traverse((W) => {
        let Y = W.material;
        if (Y?.emissive) Y.emissive.set(Q ? 2050652 : 0);
      });
    }
    if ($.length === 1) {
      this.cameraRigSelected = !1;
      let J = this.objects.get($[0]);
      if (J) this.gizmo.attach(J);
      else this.gizmo.detach();
    } else if (!this.cameraRigSelected) this.gizmo.detach();
    ((this.gizmo.enabled = this.transformControlsVisible), (this.gizmoHelper.visible = this.transformControlsVisible));
  }
  setTransformMode($) {
    ((this.transformMode = $), this.gizmo.setMode($));
  }
  setTransformControlsVisible($) {
    ((this.transformControlsVisible = $), (this.gizmo.enabled = $), (this.gizmoHelper.visible = $));
  }
  pick($, J = !1) {
    let U = this.renderer.domElement.getBoundingClientRect(),
      Q = new d$((($.clientX - U.left) / U.width) * 2 - 1, -(($.clientY - U.top) / U.height) * 2 + 1),
      W = new c1();
    W.setFromCamera(Q, this.camera);
    let X = W.intersectObjects(this.scene.children, !0);
    for (let Y of X) {
      let D = Y.object;
      if (D.userData.isGizmo || D.userData.isGround) continue;
      let H = D;
      while (H) {
        if (H.userData.isDirectorPathHandle) {
          ((this.cameraRigSelected = !1),
            this.gizmo.attach(H),
            this.setTransformMode("translate"),
            (this.gizmo.enabled = this.transformControlsVisible),
            (this.gizmoHelper.visible = this.transformControlsVisible),
            this.onActionHandlePick?.(H.userData.actionId, H.userData.keyframeId, H.userData.pathHandleSide));
          return;
        }
        H = H.parent;
      }
      let G = D;
      while (G) {
        if (G.userData.actionId && G.userData.keyframeId) {
          this.onActionPointPick?.(G.userData.actionId, G.userData.keyframeId);
          return;
        }
        G = G.parent;
      }
      let K = D;
      while (K) {
        if (K.userData.isShotCameraRig) {
          ((this.cameraRigSelected = !0),
            this.gizmo.attach(this.shotCamera),
            (this.gizmo.enabled = this.transformControlsVisible),
            (this.gizmoHelper.visible = this.transformControlsVisible),
            this.onCameraRigPick?.());
          return;
        }
        K = K.parent;
      }
      let O;
      while (D) {
        if (D.userData.elementId) {
          O = D.userData.elementId;
          break;
        }
        D = D.parent;
      }
      if (O) {
        if (((this.cameraRigSelected = !1), J)) this.onDoublePick?.(O);
        else this.onPick?.(O, $.shiftKey);
        return;
      }
    }
    ((this.cameraRigSelected = !1), this.onPick?.(null, !1));
  }
  commitTransform() {
    let $ = this.gizmo.object;
    if (!$) return;
    if ($.userData.isDirectorPathHandle) {
      let U = $.userData.pathBase,
        Q = $.userData.actionId,
        W = $.userData.keyframeId,
        X = $.userData.pathHandleSide;
      if (U && Q && W && X)
        this.onActionHandleCommit?.(Q, W, X, { x: $.position.x - U.x, y: $.position.y - U.y, z: $.position.z - U.z });
      this.transformDirty = !1;
      return;
    }
    if ($ === this.shotCamera) {
      let U = this.shotRollDeg;
      if (this.transformMode === "rotate") {
        let Q = Math.max(0.5, this.shotCamera.position.distanceTo(this.shotTarget)),
          W = new C(0, 0, -1).applyQuaternion(this.shotCamera.quaternion).normalize();
        (this.shotTarget.copy(this.shotCamera.position).addScaledVector(W, Q),
          (U = -this.shotCamera.rotation.z * sG),
          (this.shotRollDeg = U),
          this.shotTargetMarker.position.copy(this.shotTarget));
      } else if ((this.shotCamera.lookAt(this.shotTarget), U)) this.shotCamera.rotateZ(-U * t9);
      (this.shotCamera.scale.set(1, 1, 1),
        this.shotCameraHelper.update(),
        this.onCameraRigCommit?.({
          position: { x: this.shotCamera.position.x, y: this.shotCamera.position.y, z: this.shotCamera.position.z },
          target: { x: this.shotTarget.x, y: this.shotTarget.y, z: this.shotTarget.z },
          fov: this.shotCamera.fov,
          rollDeg: U,
        }),
        (this.transformDirty = !1));
      return;
    }
    let J = $.userData.elementId;
    if (!J) return;
    (this.onTransformCommit?.(
      J,
      {
        position: { x: $.position.x, y: $.position.y, z: $.position.z },
        rotationDeg: { x: $.rotation.x * sG, y: $.rotation.y * sG, z: $.rotation.z * sG },
        scale: { x: $.scale.x, y: $.scale.y, z: $.scale.z },
      },
      this.transformMode,
    ),
      (this.transformDirty = !1));
  }
  ackTransform($, J) {
    this.elementCache.set($, structuredClone(J));
  }
  faceBillboards() {
    for (let $ of this.objects.values())
      if ($.userData.isBillboard)
        $.rotation.y = Math.atan2(this.camera.position.x - $.position.x, this.camera.position.z - $.position.z);
  }
  getCameraPose() {
    return {
      position: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
      target: { x: this.orbit.target.x, y: this.orbit.target.y, z: this.orbit.target.z },
      fov: this.camera.fov,
    };
  }
  applyShot($) {
    (this.camera.position.set($.position.x, $.position.y, $.position.z),
      this.orbit.target.set($.target.x, $.target.y, $.target.z),
      (this.camera.fov = $.fov),
      this.camera.updateProjectionMatrix(),
      this.orbit.update());
  }
  applyCameraPose($) {
    if (
      (this.shotCamera.position.set($.position.x, $.position.y, $.position.z),
      this.shotTarget.set($.target.x, $.target.y, $.target.z),
      this.shotCamera.lookAt(this.shotTarget),
      (this.shotRollDeg = $.rollDeg ?? 0),
      this.shotRollDeg)
    )
      this.shotCamera.rotateZ(-this.shotRollDeg * t9);
    ((this.shotCamera.fov = $.fov),
      this.shotCamera.updateProjectionMatrix(),
      this.shotTargetMarker.position.copy(this.shotTarget),
      this.shotCameraHelper.update());
  }
  setCameraPath($) {
    this.shotPath.geometry.dispose();
    let J = $.map((U) => new C(U.position.x, U.position.y, U.position.z));
    ((this.shotPath.geometry = new Q0().setFromPoints(J.length >= 2 ? J : [new C(), new C()])),
      this.shotPath.computeLineDistances());
  }
  exportCameraActive = !1;
  exportActorLabels = !1;
  setExportMode($, J = 0, U = 0, Q = !1) {
    if ($)
      ((this.exportCameraActive = !0),
        (this.exportActorLabels = Q),
        this.renderer.setPixelRatio(1),
        this.renderer.setSize(J, U, !1),
        (this.shotCamera.aspect = J / U),
        this.shotCamera.updateProjectionMatrix());
    else
      ((this.exportCameraActive = !1),
        (this.exportActorLabels = !1),
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)),
        this.resize());
  }
  setCameraHelpersVisible($) {
    ((this.cameraHelpersVisible = $),
      (this.shotCameraBody.visible = $),
      (this.shotCameraHelper.visible = $),
      (this.shotTargetMarker.visible = $),
      (this.shotPath.visible = $));
  }
  setActionPaths($) {
    if (this.gizmo.object) {
      let J = this.gizmo.object;
      while (J && J.parent !== this.actionPathGroup) J = J.parent;
      if (J?.parent === this.actionPathGroup) this.gizmo.detach();
    }
    while (this.actionPathGroup.children.length) {
      let J = this.actionPathGroup.children.pop();
      if (!J) continue;
      let U = J;
      U.geometry?.dispose();
      let Q = U.material;
      if (Array.isArray(Q)) Q.forEach((W) => W.dispose());
      else Q?.dispose();
    }
    for (let J of $) {
      let U = this.elementCache.get(J.elementId)?.color ?? "#e1e3e7",
        Q = [...(J.keyframes ?? [])].sort((F, B) => F.timeSec - B.timeSec),
        X = (Q.length ? TR(Q, J.from, 18) : [{ position: J.from }, { position: J.to }]).map(
          ({ position: F }) => new C(F.x, Math.max(0.035, F.y + 0.035), F.z),
        );
      if (X.slice(1).reduce((F, B, E) => F + B.distanceTo(X[E]), 0) < 0.05) continue;
      let D = X[0],
        H = X[X.length - 1],
        G = new s0(
          new Q0().setFromPoints(X),
          new EX({ color: U, dashSize: 0.2, gapSize: 0.14, transparent: !0, opacity: 0.72 }),
        );
      (G.computeLineDistances(),
        this.actionPathGroup.add(G),
        Q.forEach((F, B) => {
          let E = F.position ?? J.from,
            z = new C(E.x, Math.max(0.035, E.y + 0.035), E.z),
            q = new X$(
              new NJ(B === 0 || B === Q.length - 1 ? 0.1 : 0.075, 12, 8),
              new KJ({ color: U, transparent: !0, opacity: B === 0 || B === Q.length - 1 ? 0.95 : 0.72 }),
            );
          if (
            (q.position.copy(z),
            (q.userData.actionId = J.id),
            (q.userData.keyframeId = F.id),
            this.actionPathGroup.add(q),
            F.pathMode === "smooth" || F.pathIn || F.pathOut)
          )
            ["in", "out"].forEach((L) => {
              let V = jR(F, L);
              if (!V || !F.position) return;
              let k = new X$(new p6(0.11, 0.11, 0.11), new KJ({ color: 16777215, transparent: !0, opacity: 0.88 }));
              (k.position.set(V.x, Math.max(0.05, V.y + 0.05), V.z),
                (k.userData.isDirectorPathHandle = !0),
                (k.userData.actionId = J.id),
                (k.userData.keyframeId = F.id),
                (k.userData.pathHandleSide = L),
                (k.userData.pathBase = { x: F.position.x, y: F.position.y + 0.05, z: F.position.z }));
              let R = new s0(
                new Q0().setFromPoints([z, k.position.clone()]),
                new fU({ color: 16777215, transparent: !0, opacity: 0.34 }),
              );
              this.actionPathGroup.add(R, k);
            });
        }));
      let K = [...X].reverse().find((F) => F.distanceTo(H) > 0.001) ?? D,
        O = H.clone().sub(K).normalize(),
        N = new X$(new d1(0.09, 0.28, 10), new KJ({ color: U, transparent: !0, opacity: 0.85 }));
      (N.position.copy(H), N.quaternion.setFromUnitVectors(new C(0, 1, 0), O), this.actionPathGroup.add(N));
    }
  }
  setShotHelpersVisible($, J = $) {
    ((this.shotCameraBody.visible = $ && this.cameraHelpersVisible),
      (this.shotCameraHelper.visible = $ && this.cameraHelpersVisible),
      (this.shotTargetMarker.visible = $ && this.cameraHelpersVisible),
      (this.shotPath.visible = $ && this.cameraHelpersVisible),
      (this.actionPathGroup.visible = $));
    for (let U of this.objects.values())
      U.traverse((Q) => {
        if (Q.userData.isDirectorActorLabel) Q.visible = J;
      });
  }
  setFov($) {
    ((this.camera.fov = $), this.camera.updateProjectionMatrix());
  }
  applyPresetPose($, J, U, Q, W) {
    let X = $ * t9,
      Y = J * t9,
      D = W.y + U * Math.sin(-X) + 1,
      H = U * Math.cos(X);
    (this.camera.position.set(W.x + H * Math.sin(Y), Math.max(0.2, D), W.z + H * Math.cos(Y)),
      this.orbit.target.set(W.x, W.y + 0.9, W.z),
      (this.camera.fov = Q),
      this.camera.updateProjectionMatrix(),
      this.orbit.update());
  }
  getFocusPoint($) {
    let J = $.length > 0 ? $ : [...this.objects.keys()],
      U = new bU(),
      Q = !1;
    for (let X of J) {
      let Y = this.objects.get(X);
      if (Y?.visible) (U.expandByObject(Y), (Q = !0));
    }
    if (!Q) return { x: 0, y: 0, z: 0 };
    let W = U.getCenter(new C());
    return { x: W.x, y: W.y, z: W.z };
  }
  captureShot($, J = 1600, U = !1) {
    return this.captureFrame($, J, { includeHelpers: !1, includeActorLabels: U, transparent: !1 });
  }
  captureTransparent($, J = 1600) {
    return this.captureFrame($, J, { includeHelpers: !1, includeActorLabels: !1, transparent: !0 });
  }
  captureTopView($, J = 1600, U = !1) {
    let Q = {
      position: this.shotCamera.position.clone(),
      target: this.shotTarget.clone(),
      fov: this.shotCamera.fov,
      quaternion: this.shotCamera.quaternion.clone(),
    };
    (this.shotCamera.position.set(0, 16, 0.01),
      this.shotTarget.set(0, 0, 0),
      this.shotCamera.lookAt(this.shotTarget),
      (this.shotCamera.fov = 42),
      this.shotCamera.updateProjectionMatrix());
    try {
      return this.captureFrame($, J, { includeHelpers: U, includeActorLabels: !1, transparent: !1 });
    } finally {
      (this.shotCamera.position.copy(Q.position),
        this.shotTarget.copy(Q.target),
        this.shotCamera.quaternion.copy(Q.quaternion),
        (this.shotCamera.fov = Q.fov),
        this.shotCamera.updateProjectionMatrix());
    }
  }
  captureFrame($, J, U) {
    let Q = kR[$],
      W = Math.round(J / Q),
      X = this.renderer.getPixelRatio(),
      Y = this.renderer.domElement.width / X,
      D = this.renderer.domElement.height / X,
      H = this.shotCamera.aspect,
      G = this.grid.visible,
      K = this.gizmoHelper.visible,
      O = this.scene.background;
    try {
      if (
        ((this.grid.visible = !1),
        (this.gizmoHelper.visible = !1),
        this.setShotHelpersVisible(U.includeHelpers, U.includeActorLabels),
        U.transparent)
      )
        this.scene.background = null;
      return (
        this.renderer.setPixelRatio(1),
        this.renderer.setSize(J, W, !1),
        (this.shotCamera.aspect = Q),
        this.shotCamera.updateProjectionMatrix(),
        this.renderer.render(this.scene, this.shotCamera),
        this.renderer.domElement.toDataURL("image/png")
      );
    } finally {
      ((this.grid.visible = G),
        (this.gizmoHelper.visible = K),
        this.setShotHelpersVisible(!0),
        (this.scene.background = O),
        this.renderer.setPixelRatio(X),
        this.renderer.setSize(Y, D, !1),
        (this.shotCamera.aspect = H),
        this.shotCamera.updateProjectionMatrix());
    }
  }
  setPanorama($) {
    if (!$) {
      this.scene.background = new W6(1447964);
      return;
    }
    this.texLoader.load(M_($), (J) => {
      ((J.mapping = l1), (J.colorSpace = J9), (this.scene.background = J));
    });
  }
  snapshotForDescription() {
    let $ = [];
    for (let [J, U] of this.objects) {
      let Q = this.elementCache.get(J);
      if (!Q) continue;
      let W = new C();
      if ((U.getWorldPosition(W), Q.kind === "mannequin" || Q.kind === "billboard"))
        W.y += Q.heightM ? Q.heightM / 2 : 0.85;
      let X = new C(0, 0, 1).applyQuaternion(U.getWorldQuaternion(new H0()));
      $.push({
        id: J,
        name: Q.name,
        kind: Q.kind,
        worldPos: { x: W.x, y: W.y, z: W.z },
        forwardDir: { x: X.x, y: X.y, z: X.z },
        visible: Q.visible,
      });
    }
    return { camera: this.getCameraPose(), aspect: this.camera.aspect, elements: $ };
  }
  diagnostics() {
    (this.scene.updateMatrixWorld(!0), this.shotCamera.updateMatrixWorld(!0));
    let $ = new x6().multiplyMatrices(this.shotCamera.projectionMatrix, this.shotCamera.matrixWorldInverse),
      J = new d9().setFromProjectionMatrix($),
      U = [...this.objects.entries()].map(([Q, W]) => {
        let X = this.elementCache.get(Q),
          Y = W.getWorldPosition(new C()),
          D = 0;
        W.traverse((G) => {
          if (G.isMesh && G.visible) D += 1;
        });
        let H = new bU().setFromObject(W);
        return {
          id: Q,
          name: X?.name ?? Q,
          kind: X?.kind ?? "box",
          rootVisible: W.visible,
          visibleMeshCount: D,
          worldPos: { x: Y.x, y: Y.y, z: Y.z },
          distanceToShotCamera: Y.distanceTo(this.shotCamera.position),
          insideShotFrustum: W.visible && !H.isEmpty() && J.intersectsBox(H),
        };
      });
    return {
      webglContextLost: this.renderer.getContext().isContextLost(),
      stageSize: { width: this.container.clientWidth, height: this.container.clientHeight },
      monitorAttached: Boolean(this.monitorRenderer),
      sceneObjectCount: this.scene.children.length,
      renderedElementCount: this.objects.size,
      elements: U,
    };
  }
}