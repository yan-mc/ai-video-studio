// @bun
var x_ = Object.create;
var { getPrototypeOf: g_, defineProperty: eG, getOwnPropertyNames: h_ } = Object;
var u_ = Object.prototype.hasOwnProperty;
function l_($) {
  return this[$];
}
var m_,
  p_,
  UL = ($, J, U) => {
    var Q = $ != null && typeof $ === "object";
    if (Q) {
      var W = J ? (m_ ??= new WeakMap()) : (p_ ??= new WeakMap()),
        X = W.get($);
      if (X) return X;
    }
    U = $ != null ? x_(g_($)) : {};
    let Y = J || !$ || !$.__esModule ? eG(U, "default", { value: $, enumerable: !0 }) : U;
    for (let D of h_($)) if (!u_.call(Y, D)) eG(Y, D, { get: l_.bind($, D), enumerable: !0 });
    if (Q) W.set($, Y);
    return Y;
  };
var P$ = ($, J) => () => (J || $((J = { exports: {} }).exports, J), J.exports);
var d_ = ($) => $;
function c_($, J) {
  this[$] = d_.bind(null, J);
}
var uU = ($, J) => {
  for (var U in J) eG($, U, { get: J[U], enumerable: !0, configurable: !0, set: c_.bind(J, U) });
};
var AQ = P$((AV) => {
  Object.defineProperty(AV, "__esModule", { value: !0 });
  AV.regexpCode =
    AV.getEsmExportName =
    AV.getProperty =
    AV.safeStringify =
    AV.stringify =
    AV.strConcat =
    AV.addCodeArg =
    AV.str =
    AV._ =
    AV.nil =
    AV._Code =
    AV.Name =
    AV.IDENTIFIER =
    AV._CodeOrName =
      void 0;
  class sH {}
  AV._CodeOrName = sH;
  AV.IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;
  class aW extends sH {
    constructor($) {
      super();
      if (!AV.IDENTIFIER.test($)) throw Error("CodeGen: name must be a valid identifier");
      this.str = $;
    }
    toString() {
      return this.str;
    }
    emptyStr() {
      return !1;
    }
    get names() {
      return { [this.str]: 1 };
    }
  }
  AV.Name = aW;
  class $U extends sH {
    constructor($) {
      super();
      this._items = typeof $ === "string" ? [$] : $;
    }
    toString() {
      return this.str;
    }
    emptyStr() {
      if (this._items.length > 1) return !1;
      let $ = this._items[0];
      return $ === "" || $ === '""';
    }
    get str() {
      var $;
      return ($ = this._str) !== null && $ !== void 0 ? $ : (this._str = this._items.reduce((J, U) => `${J}${U}`, ""));
    }
    get names() {
      var $;
      return ($ = this._names) !== null && $ !== void 0
        ? $
        : (this._names = this._items.reduce((J, U) => {
            if (U instanceof aW) J[U.str] = (J[U.str] || 0) + 1;
            return J;
          }, {}));
    }
  }
  AV._Code = $U;
  AV.nil = new $U("");
  function VV($, ...J) {
    let U = [$[0]],
      Q = 0;
    while (Q < J.length) (iF(U, J[Q]), U.push($[++Q]));
    return new $U(U);
  }
  AV._ = VV;
  var nF = new $U("+");
  function kV($, ...J) {
    let U = [kQ($[0])],
      Q = 0;
    while (Q < J.length) (U.push(nF), iF(U, J[Q]), U.push(nF, kQ($[++Q])));
    return (Tj(U), new $U(U));
  }
  AV.str = kV;
  function iF($, J) {
    if (J instanceof $U) $.push(...J._items);
    else if (J instanceof aW) $.push(J);
    else $.push(bj(J));
  }
  AV.addCodeArg = iF;
  function Tj($) {
    let J = 1;
    while (J < $.length - 1) {
      if ($[J] === nF) {
        let U = jj($[J - 1], $[J + 1]);
        if (U !== void 0) {
          $.splice(J - 1, 3, U);
          continue;
        }
        $[J++] = "+";
      }
      J++;
    }
  }
  function jj($, J) {
    if (J === '""') return $;
    if ($ === '""') return J;
    if (typeof $ == "string") {
      if (J instanceof aW || $[$.length - 1] !== '"') return;
      if (typeof J != "string") return `${$.slice(0, -1)}${J}"`;
      if (J[0] === '"') return $.slice(0, -1) + J.slice(1);
      return;
    }
    if (typeof J == "string" && J[0] === '"' && !($ instanceof aW)) return `"${$}${J.slice(1)}`;
    return;
  }
  function vj($, J) {
    return J.emptyStr() ? $ : $.emptyStr() ? J : kV`${$}${J}`;
  }
  AV.strConcat = vj;
  function bj($) {
    return typeof $ == "number" || typeof $ == "boolean" || $ === null ? $ : kQ(Array.isArray($) ? $.join(",") : $);
  }
  function fj($) {
    return new $U(kQ($));
  }
  AV.stringify = fj;
  function kQ($) {
    return JSON.stringify($)
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
  }
  AV.safeStringify = kQ;
  function yj($) {
    return typeof $ == "string" && AV.IDENTIFIER.test($) ? new $U(`.${$}`) : VV`[${$}]`;
  }
  AV.getProperty = yj;
  function xj($) {
    if (typeof $ == "string" && AV.IDENTIFIER.test($)) return new $U(`${$}`);
    throw Error(`CodeGen: invalid export name: ${$}, use explicit $id name mapping`);
  }
  AV.getEsmExportName = xj;
  function gj($) {
    return new $U($.toString());
  }
  AV.regexpCode = gj;
});
var aF = P$((PV) => {
  Object.defineProperty(PV, "__esModule", { value: !0 });
  PV.ValueScope = PV.ValueScopeName = PV.Scope = PV.varKinds = PV.UsedValueState = void 0;
  var LJ = AQ();
  class RV extends Error {
    constructor($) {
      super(`CodeGen: "code" for ${$} not defined`);
      this.value = $.value;
    }
  }
  var tH;
  (function ($) {
    (($[($.Started = 0)] = "Started"), ($[($.Completed = 1)] = "Completed"));
  })(tH || (PV.UsedValueState = tH = {}));
  PV.varKinds = { const: new LJ.Name("const"), let: new LJ.Name("let"), var: new LJ.Name("var") };
  class rF {
    constructor({ prefixes: $, parent: J } = {}) {
      ((this._names = {}), (this._prefixes = $), (this._parent = J));
    }
    toName($) {
      return $ instanceof LJ.Name ? $ : this.name($);
    }
    name($) {
      return new LJ.Name(this._newName($));
    }
    _newName($) {
      let J = this._names[$] || this._nameGroup($);
      return `${$}${J.index++}`;
    }
    _nameGroup($) {
      var J, U;
      if (
        ((U = (J = this._parent) === null || J === void 0 ? void 0 : J._prefixes) === null || U === void 0
          ? void 0
          : U.has($)) ||
        (this._prefixes && !this._prefixes.has($))
      )
        throw Error(`CodeGen: prefix "${$}" is not allowed in this scope`);
      return (this._names[$] = { prefix: $, index: 0 });
    }
  }
  PV.Scope = rF;
  class sF extends LJ.Name {
    constructor($, J) {
      super(J);
      this.prefix = $;
    }
    setValue($, { property: J, itemIndex: U }) {
      ((this.value = $), (this.scopePath = LJ._`.${new LJ.Name(J)}[${U}]`));
    }
  }
  PV.ValueScopeName = sF;
  var aj = LJ._`\n`;
  class ZV extends rF {
    constructor($) {
      super($);
      ((this._values = {}), (this._scope = $.scope), (this.opts = { ...$, _n: $.lines ? aj : LJ.nil }));
    }
    get() {
      return this._scope;
    }
    name($) {
      return new sF($, this._newName($));
    }
    value($, J) {
      var U;
      if (J.ref === void 0) throw Error("CodeGen: ref must be passed in value");
      let Q = this.toName($),
        { prefix: W } = Q,
        X = (U = J.key) !== null && U !== void 0 ? U : J.ref,
        Y = this._values[W];
      if (Y) {
        let G = Y.get(X);
        if (G) return G;
      } else Y = this._values[W] = new Map();
      Y.set(X, Q);
      let D = this._scope[W] || (this._scope[W] = []),
        H = D.length;
      return ((D[H] = J.ref), Q.setValue(J, { property: W, itemIndex: H }), Q);
    }
    getValue($, J) {
      let U = this._values[$];
      if (!U) return;
      return U.get(J);
    }
    scopeRefs($, J = this._values) {
      return this._reduceValues(J, (U) => {
        if (U.scopePath === void 0) throw Error(`CodeGen: name "${U}" has no value`);
        return LJ._`${$}${U.scopePath}`;
      });
    }
    scopeCode($ = this._values, J, U) {
      return this._reduceValues(
        $,
        (Q) => {
          if (Q.value === void 0) throw Error(`CodeGen: name "${Q}" has no value`);
          return Q.value.code;
        },
        J,
        U,
      );
    }
    _reduceValues($, J, U = {}, Q) {
      let W = LJ.nil;
      for (let X in $) {
        let Y = $[X];
        if (!Y) continue;
        let D = (U[X] = U[X] || new Map());
        Y.forEach((H) => {
          if (D.has(H)) return;
          D.set(H, tH.Started);
          let G = J(H);
          if (G) {
            let K = this.opts.es5 ? PV.varKinds.var : PV.varKinds.const;
            W = LJ._`${W}${K} ${H} = ${G};${this.opts._n}`;
          } else if ((G = Q === null || Q === void 0 ? void 0 : Q(H))) W = LJ._`${W}${G}${this.opts._n}`;
          else throw new RV(H);
          D.set(H, tH.Completed);
        });
      }
      return W;
    }
  }
  PV.ValueScope = ZV;
});
var q6 = P$((wJ) => {
  Object.defineProperty(wJ, "__esModule", { value: !0 });
  wJ.or =
    wJ.and =
    wJ.not =
    wJ.CodeGen =
    wJ.operators =
    wJ.varKinds =
    wJ.ValueScopeName =
    wJ.ValueScope =
    wJ.Scope =
    wJ.Name =
    wJ.regexpCode =
    wJ.stringify =
    wJ.getProperty =
    wJ.nil =
    wJ.strConcat =
    wJ.str =
    wJ._ =
      void 0;
  var _6 = AQ(),
    JU = aF(),
    j8 = AQ();
  Object.defineProperty(wJ, "_", {
    enumerable: !0,
    get: function () {
      return j8._;
    },
  });
  Object.defineProperty(wJ, "str", {
    enumerable: !0,
    get: function () {
      return j8.str;
    },
  });
  Object.defineProperty(wJ, "strConcat", {
    enumerable: !0,
    get: function () {
      return j8.strConcat;
    },
  });
  Object.defineProperty(wJ, "nil", {
    enumerable: !0,
    get: function () {
      return j8.nil;
    },
  });
  Object.defineProperty(wJ, "getProperty", {
    enumerable: !0,
    get: function () {
      return j8.getProperty;
    },
  });
  Object.defineProperty(wJ, "stringify", {
    enumerable: !0,
    get: function () {
      return j8.stringify;
    },
  });
  Object.defineProperty(wJ, "regexpCode", {
    enumerable: !0,
    get: function () {
      return j8.regexpCode;
    },
  });
  Object.defineProperty(wJ, "Name", {
    enumerable: !0,
    get: function () {
      return j8.Name;
    },
  });
  var Q5 = aF();
  Object.defineProperty(wJ, "Scope", {
    enumerable: !0,
    get: function () {
      return Q5.Scope;
    },
  });
  Object.defineProperty(wJ, "ValueScope", {
    enumerable: !0,
    get: function () {
      return Q5.ValueScope;
    },
  });
  Object.defineProperty(wJ, "ValueScopeName", {
    enumerable: !0,
    get: function () {
      return Q5.ValueScopeName;
    },
  });
  Object.defineProperty(wJ, "varKinds", {
    enumerable: !0,
    get: function () {
      return Q5.varKinds;
    },
  });
  wJ.operators = {
    GT: new _6._Code(">"),
    GTE: new _6._Code(">="),
    LT: new _6._Code("<"),
    LTE: new _6._Code("<="),
    EQ: new _6._Code("==="),
    NEQ: new _6._Code("!=="),
    NOT: new _6._Code("!"),
    OR: new _6._Code("||"),
    AND: new _6._Code("&&"),
    ADD: new _6._Code("+"),
  };
  class v8 {
    optimizeNodes() {
      return this;
    }
    optimizeNames($, J) {
      return this;
    }
  }
  class SV extends v8 {
    constructor($, J, U) {
      super();
      ((this.varKind = $), (this.name = J), (this.rhs = U));
    }
    render({ es5: $, _n: J }) {
      let U = $ ? JU.varKinds.var : this.varKind,
        Q = this.rhs === void 0 ? "" : ` = ${this.rhs}`;
      return `${U} ${this.name}${Q};` + J;
    }
    optimizeNames($, J) {
      if (!$[this.name.str]) return;
      if (this.rhs) this.rhs = eW(this.rhs, $, J);
      return this;
    }
    get names() {
      return this.rhs instanceof _6._CodeOrName ? this.rhs.names : {};
    }
  }
  class $q extends v8 {
    constructor($, J, U) {
      super();
      ((this.lhs = $), (this.rhs = J), (this.sideEffects = U));
    }
    render({ _n: $ }) {
      return `${this.lhs} = ${this.rhs};` + $;
    }
    optimizeNames($, J) {
      if (this.lhs instanceof _6.Name && !$[this.lhs.str] && !this.sideEffects) return;
      return ((this.rhs = eW(this.rhs, $, J)), this);
    }
    get names() {
      let $ = this.lhs instanceof _6.Name ? {} : { ...this.lhs.names };
      return W5($, this.rhs);
    }
  }
  class CV extends $q {
    constructor($, J, U, Q) {
      super($, U, Q);
      this.op = J;
    }
    render({ _n: $ }) {
      return `${this.lhs} ${this.op}= ${this.rhs};` + $;
    }
  }
  class TV extends v8 {
    constructor($) {
      super();
      ((this.label = $), (this.names = {}));
    }
    render({ _n: $ }) {
      return `${this.label}:` + $;
    }
  }
  class jV extends v8 {
    constructor($) {
      super();
      ((this.label = $), (this.names = {}));
    }
    render({ _n: $ }) {
      return `break${this.label ? ` ${this.label}` : ""};` + $;
    }
  }
  class vV extends v8 {
    constructor($) {
      super();
      this.error = $;
    }
    render({ _n: $ }) {
      return `throw ${this.error};` + $;
    }
    get names() {
      return this.error.names;
    }
  }
  class bV extends v8 {
    constructor($) {
      super();
      this.code = $;
    }
    render({ _n: $ }) {
      return `${this.code};` + $;
    }
    optimizeNodes() {
      return `${this.code}` ? this : void 0;
    }
    optimizeNames($, J) {
      return ((this.code = eW(this.code, $, J)), this);
    }
    get names() {
      return this.code instanceof _6._CodeOrName ? this.code.names : {};
    }
  }
  class X5 extends v8 {
    constructor($ = []) {
      super();
      this.nodes = $;
    }
    render($) {
      return this.nodes.reduce((J, U) => J + U.render($), "");
    }
    optimizeNodes() {
      let { nodes: $ } = this,
        J = $.length;
      while (J--) {
        let U = $[J].optimizeNodes();
        if (Array.isArray(U)) $.splice(J, 1, ...U);
        else if (U) $[J] = U;
        else $.splice(J, 1);
      }
      return $.length > 0 ? this : void 0;
    }
    optimizeNames($, J) {
      let { nodes: U } = this,
        Q = U.length;
      while (Q--) {
        let W = U[Q];
        if (W.optimizeNames($, J)) continue;
        (Jv($, W.names), U.splice(Q, 1));
      }
      return U.length > 0 ? this : void 0;
    }
    get names() {
      return this.nodes.reduce(($, J) => M9($, J.names), {});
    }
  }
  class b8 extends X5 {
    render($) {
      return "{" + $._n + super.render($) + "}" + $._n;
    }
  }
  class fV extends X5 {}
  class MQ extends b8 {}
  MQ.kind = "else";
  class oU extends b8 {
    constructor($, J) {
      super(J);
      this.condition = $;
    }
    render($) {
      let J = `if(${this.condition})` + super.render($);
      if (this.else) J += "else " + this.else.render($);
      return J;
    }
    optimizeNodes() {
      super.optimizeNodes();
      let $ = this.condition;
      if ($ === !0) return this.nodes;
      let J = this.else;
      if (J) {
        let U = J.optimizeNodes();
        J = this.else = Array.isArray(U) ? new MQ(U) : U;
      }
      if (J) {
        if ($ === !1) return J instanceof oU ? J : J.nodes;
        if (this.nodes.length) return this;
        return new oU(uV($), J instanceof oU ? [J] : J.nodes);
      }
      if ($ === !1 || !this.nodes.length) return;
      return this;
    }
    optimizeNames($, J) {
      var U;
      if (
        ((this.else = (U = this.else) === null || U === void 0 ? void 0 : U.optimizeNames($, J)),
        !(super.optimizeNames($, J) || this.else))
      )
        return;
      return ((this.condition = eW(this.condition, $, J)), this);
    }
    get names() {
      let $ = super.names;
      if ((W5($, this.condition), this.else)) M9($, this.else.names);
      return $;
    }
  }
  oU.kind = "if";
  class tW extends b8 {}
  tW.kind = "for";
  class yV extends tW {
    constructor($) {
      super();
      this.iteration = $;
    }
    render($) {
      return `for(${this.iteration})` + super.render($);
    }
    optimizeNames($, J) {
      if (!super.optimizeNames($, J)) return;
      return ((this.iteration = eW(this.iteration, $, J)), this);
    }
    get names() {
      return M9(super.names, this.iteration.names);
    }
  }
  class xV extends tW {
    constructor($, J, U, Q) {
      super();
      ((this.varKind = $), (this.name = J), (this.from = U), (this.to = Q));
    }
    render($) {
      let J = $.es5 ? JU.varKinds.var : this.varKind,
        { name: U, from: Q, to: W } = this;
      return `for(${J} ${U}=${Q}; ${U}<${W}; ${U}++)` + super.render($);
    }
    get names() {
      let $ = W5(super.names, this.from);
      return W5($, this.to);
    }
  }
  class tF extends tW {
    constructor($, J, U, Q) {
      super();
      ((this.loop = $), (this.varKind = J), (this.name = U), (this.iterable = Q));
    }
    render($) {
      return `for(${this.varKind} ${this.name} ${this.loop} ${this.iterable})` + super.render($);
    }
    optimizeNames($, J) {
      if (!super.optimizeNames($, J)) return;
      return ((this.iterable = eW(this.iterable, $, J)), this);
    }
    get names() {
      return M9(super.names, this.iterable.names);
    }
  }
  class eH extends b8 {
    constructor($, J, U) {
      super();
      ((this.name = $), (this.args = J), (this.async = U));
    }
    render($) {
      return `${this.async ? "async " : ""}function ${this.name}(${this.args})` + super.render($);
    }
  }
  eH.kind = "func";
  class $5 extends X5 {
    render($) {
      return "return " + super.render($);
    }
  }
  $5.kind = "return";
  class gV extends b8 {
    render($) {
      let J = "try" + super.render($);
      if (this.catch) J += this.catch.render($);
      if (this.finally) J += this.finally.render($);
      return J;
    }
    optimizeNodes() {
      var $, J;
      return (
        super.optimizeNodes(),
        ($ = this.catch) === null || $ === void 0 || $.optimizeNodes(),
        (J = this.finally) === null || J === void 0 || J.optimizeNodes(),
        this
      );
    }
    optimizeNames($, J) {
      var U, Q;
      return (
        super.optimizeNames($, J),
        (U = this.catch) === null || U === void 0 || U.optimizeNames($, J),
        (Q = this.finally) === null || Q === void 0 || Q.optimizeNames($, J),
        this
      );
    }
    get names() {
      let $ = super.names;
      if (this.catch) M9($, this.catch.names);
      if (this.finally) M9($, this.finally.names);
      return $;
    }
  }
  class J5 extends b8 {
    constructor($) {
      super();
      this.error = $;
    }
    render($) {
      return `catch(${this.error})` + super.render($);
    }
  }
  J5.kind = "catch";
  class U5 extends b8 {
    render($) {
      return "finally" + super.render($);
    }
  }
  U5.kind = "finally";
  class hV {
    constructor($, J = {}) {
      ((this._values = {}),
        (this._blockStarts = []),
        (this._constants = {}),
        (this.opts = {
          ...J,
          _n: J.lines
            ? `
`
            : "",
        }),
        (this._extScope = $),
        (this._scope = new JU.Scope({ parent: $ })),
        (this._nodes = [new fV()]));
    }
    toString() {
      return this._root.render(this.opts);
    }
    name($) {
      return this._scope.name($);
    }
    scopeName($) {
      return this._extScope.name($);
    }
    scopeValue($, J) {
      let U = this._extScope.value($, J);
      return ((this._values[U.prefix] || (this._values[U.prefix] = new Set())).add(U), U);
    }
    getScopeValue($, J) {
      return this._extScope.getValue($, J);
    }
    scopeRefs($) {
      return this._extScope.scopeRefs($, this._values);
    }
    scopeCode() {
      return this._extScope.scopeCode(this._values);
    }
    _def($, J, U, Q) {
      let W = this._scope.toName(J);
      if (U !== void 0 && Q) this._constants[W.str] = U;
      return (this._leafNode(new SV($, W, U)), W);
    }
    const($, J, U) {
      return this._def(JU.varKinds.const, $, J, U);
    }
    let($, J, U) {
      return this._def(JU.varKinds.let, $, J, U);
    }
    var($, J, U) {
      return this._def(JU.varKinds.var, $, J, U);
    }
    assign($, J, U) {
      return this._leafNode(new $q($, J, U));
    }
    add($, J) {
      return this._leafNode(new CV($, wJ.operators.ADD, J));
    }
    code($) {
      if (typeof $ == "function") $();
      else if ($ !== _6.nil) this._leafNode(new bV($));
      return this;
    }
    object(...$) {
      let J = ["{"];
      for (let [U, Q] of $) {
        if (J.length > 1) J.push(",");
        if ((J.push(U), U !== Q || this.opts.es5)) (J.push(":"), (0, _6.addCodeArg)(J, Q));
      }
      return (J.push("}"), new _6._Code(J));
    }
    if($, J, U) {
      if ((this._blockNode(new oU($)), J && U)) this.code(J).else().code(U).endIf();
      else if (J) this.code(J).endIf();
      else if (U) throw Error('CodeGen: "else" body without "then" body');
      return this;
    }
    elseIf($) {
      return this._elseNode(new oU($));
    }
    else() {
      return this._elseNode(new MQ());
    }
    endIf() {
      return this._endBlockNode(oU, MQ);
    }
    _for($, J) {
      if ((this._blockNode($), J)) this.code(J).endFor();
      return this;
    }
    for($, J) {
      return this._for(new yV($), J);
    }
    forRange($, J, U, Q, W = this.opts.es5 ? JU.varKinds.var : JU.varKinds.let) {
      let X = this._scope.toName($);
      return this._for(new xV(W, X, J, U), () => Q(X));
    }
    forOf($, J, U, Q = JU.varKinds.const) {
      let W = this._scope.toName($);
      if (this.opts.es5) {
        let X = J instanceof _6.Name ? J : this.var("_arr", J);
        return this.forRange("_i", 0, _6._`${X}.length`, (Y) => {
          (this.var(W, _6._`${X}[${Y}]`), U(W));
        });
      }
      return this._for(new tF("of", Q, W, J), () => U(W));
    }
    forIn($, J, U, Q = this.opts.es5 ? JU.varKinds.var : JU.varKinds.const) {
      if (this.opts.ownProperties) return this.forOf($, _6._`Object.keys(${J})`, U);
      let W = this._scope.toName($);
      return this._for(new tF("in", Q, W, J), () => U(W));
    }
    endFor() {
      return this._endBlockNode(tW);
    }
    label($) {
      return this._leafNode(new TV($));
    }
    break($) {
      return this._leafNode(new jV($));
    }
    return($) {
      let J = new $5();
      if ((this._blockNode(J), this.code($), J.nodes.length !== 1))
        throw Error('CodeGen: "return" should have one node');
      return this._endBlockNode($5);
    }
    try($, J, U) {
      if (!J && !U) throw Error('CodeGen: "try" without "catch" and "finally"');
      let Q = new gV();
      if ((this._blockNode(Q), this.code($), J)) {
        let W = this.name("e");
        ((this._currNode = Q.catch = new J5(W)), J(W));
      }
      if (U) ((this._currNode = Q.finally = new U5()), this.code(U));
      return this._endBlockNode(J5, U5);
    }
    throw($) {
      return this._leafNode(new vV($));
    }
    block($, J) {
      if ((this._blockStarts.push(this._nodes.length), $)) this.code($).endBlock(J);
      return this;
    }
    endBlock($) {
      let J = this._blockStarts.pop();
      if (J === void 0) throw Error("CodeGen: not in self-balancing block");
      let U = this._nodes.length - J;
      if (U < 0 || ($ !== void 0 && U !== $)) throw Error(`CodeGen: wrong number of nodes: ${U} vs ${$} expected`);
      return ((this._nodes.length = J), this);
    }
    func($, J = _6.nil, U, Q) {
      if ((this._blockNode(new eH($, J, U)), Q)) this.code(Q).endFunc();
      return this;
    }
    endFunc() {
      return this._endBlockNode(eH);
    }
    optimize($ = 1) {
      while ($-- > 0) (this._root.optimizeNodes(), this._root.optimizeNames(this._root.names, this._constants));
    }
    _leafNode($) {
      return (this._currNode.nodes.push($), this);
    }
    _blockNode($) {
      (this._currNode.nodes.push($), this._nodes.push($));
    }
    _endBlockNode($, J) {
      let U = this._currNode;
      if (U instanceof $ || (J && U instanceof J)) return (this._nodes.pop(), this);
      throw Error(`CodeGen: not in block "${J ? `${$.kind}/${J.kind}` : $.kind}"`);
    }
    _elseNode($) {
      let J = this._currNode;
      if (!(J instanceof oU)) throw Error('CodeGen: "else" without "if"');
      return ((this._currNode = J.else = $), this);
    }
    get _root() {
      return this._nodes[0];
    }
    get _currNode() {
      let $ = this._nodes;
      return $[$.length - 1];
    }
    set _currNode($) {
      let J = this._nodes;
      J[J.length - 1] = $;
    }
  }
  wJ.CodeGen = hV;
  function M9($, J) {
    for (let U in J) $[U] = ($[U] || 0) + (J[U] || 0);
    return $;
  }
  function W5($, J) {
    return J instanceof _6._CodeOrName ? M9($, J.names) : $;
  }
  function eW($, J, U) {
    if ($ instanceof _6.Name) return Q($);
    if (!W($)) return $;
    return new _6._Code(
      $._items.reduce((X, Y) => {
        if (Y instanceof _6.Name) Y = Q(Y);
        if (Y instanceof _6._Code) X.push(...Y._items);
        else X.push(Y);
        return X;
      }, []),
    );
    function Q(X) {
      let Y = U[X.str];
      if (Y === void 0 || J[X.str] !== 1) return X;
      return (delete J[X.str], Y);
    }
    function W(X) {
      return (
        X instanceof _6._Code && X._items.some((Y) => Y instanceof _6.Name && J[Y.str] === 1 && U[Y.str] !== void 0)
      );
    }
  }
  function Jv($, J) {
    for (let U in J) $[U] = ($[U] || 0) - (J[U] || 0);
  }
  function uV($) {
    return typeof $ == "boolean" || typeof $ == "number" || $ === null ? !$ : _6._`!${eF($)}`;
  }
  wJ.not = uV;
  var Uv = lV(wJ.operators.AND);
  function Wv(...$) {
    return $.reduce(Uv);
  }
  wJ.and = Wv;
  var Qv = lV(wJ.operators.OR);
  function Xv(...$) {
    return $.reduce(Qv);
  }
  wJ.or = Xv;
  function lV($) {
    return (J, U) => (J === _6.nil ? U : U === _6.nil ? J : _6._`${eF(J)} ${$} ${eF(U)}`);
  }
  function eF($) {
    return $ instanceof _6.Name ? $ : _6._`(${$})`;
  }
});
var C6 = P$((sV) => {
  Object.defineProperty(sV, "__esModule", { value: !0 });
  sV.checkStrictMode =
    sV.getErrorPath =
    sV.Type =
    sV.useFunc =
    sV.setEvaluated =
    sV.evaluatedPropsToName =
    sV.mergeEvaluated =
    sV.eachItem =
    sV.unescapeJsonPointer =
    sV.escapeJsonPointer =
    sV.escapeFragment =
    sV.unescapeFragment =
    sV.schemaRefOrVal =
    sV.schemaHasRulesButRef =
    sV.schemaHasRules =
    sV.checkUnknownRules =
    sV.alwaysValidSchema =
    sV.toHash =
      void 0;
  var U0 = q6(),
    Gv = AQ();
  function Kv($) {
    let J = {};
    for (let U of $) J[U] = !0;
    return J;
  }
  sV.toHash = Kv;
  function Nv($, J) {
    if (typeof J == "boolean") return J;
    if (Object.keys(J).length === 0) return !0;
    return (cV($, J), !nV(J, $.self.RULES.all));
  }
  sV.alwaysValidSchema = Nv;
  function cV($, J = $.schema) {
    let { opts: U, self: Q } = $;
    if (!U.strictSchema) return;
    if (typeof J === "boolean") return;
    let W = Q.RULES.keywords;
    for (let X in J) if (!W[X]) rV($, `unknown keyword: "${X}"`);
  }
  sV.checkUnknownRules = cV;
  function nV($, J) {
    if (typeof $ == "boolean") return !$;
    for (let U in $) if (J[U]) return !0;
    return !1;
  }
  sV.schemaHasRules = nV;
  function Ov($, J) {
    if (typeof $ == "boolean") return !$;
    for (let U in $) if (U !== "$ref" && J.all[U]) return !0;
    return !1;
  }
  sV.schemaHasRulesButRef = Ov;
  function Fv({ topSchemaRef: $, schemaPath: J }, U, Q, W) {
    if (!W) {
      if (typeof U == "number" || typeof U == "boolean") return U;
      if (typeof U == "string") return U0._`${U}`;
    }
    return U0._`${$}${J}${(0, U0.getProperty)(Q)}`;
  }
  sV.schemaRefOrVal = Fv;
  function qv($) {
    return iV(decodeURIComponent($));
  }
  sV.unescapeFragment = qv;
  function zv($) {
    return encodeURIComponent(Uq($));
  }
  sV.escapeFragment = zv;
  function Uq($) {
    if (typeof $ == "number") return `${$}`;
    return $.replace(/~/g, "~0").replace(/\//g, "~1");
  }
  sV.escapeJsonPointer = Uq;
  function iV($) {
    return $.replace(/~1/g, "/").replace(/~0/g, "~");
  }
  sV.unescapeJsonPointer = iV;
  function Bv($, J) {
    if (Array.isArray($)) for (let U of $) J(U);
    else J($);
  }
  sV.eachItem = Bv;
  function pV({ mergeNames: $, mergeToName: J, mergeValues: U, resultToName: Q }) {
    return (W, X, Y, D) => {
      let H =
        Y === void 0
          ? X
          : Y instanceof U0.Name
            ? (X instanceof U0.Name ? $(W, X, Y) : J(W, X, Y), Y)
            : X instanceof U0.Name
              ? (J(W, Y, X), X)
              : U(X, Y);
      return D === U0.Name && !(H instanceof U0.Name) ? Q(W, H) : H;
    };
  }
  sV.mergeEvaluated = {
    props: pV({
      mergeNames: ($, J, U) =>
        $.if(U0._`${U} !== true && ${J} !== undefined`, () => {
          $.if(
            U0._`${J} === true`,
            () => $.assign(U, !0),
            () => $.assign(U, U0._`${U} || {}`).code(U0._`Object.assign(${U}, ${J})`),
          );
        }),
      mergeToName: ($, J, U) =>
        $.if(U0._`${U} !== true`, () => {
          if (J === !0) $.assign(U, !0);
          else ($.assign(U, U0._`${U} || {}`), Wq($, U, J));
        }),
      mergeValues: ($, J) => ($ === !0 ? !0 : { ...$, ...J }),
      resultToName: oV,
    }),
    items: pV({
      mergeNames: ($, J, U) =>
        $.if(U0._`${U} !== true && ${J} !== undefined`, () =>
          $.assign(U, U0._`${J} === true ? true : ${U} > ${J} ? ${U} : ${J}`),
        ),
      mergeToName: ($, J, U) =>
        $.if(U0._`${U} !== true`, () => $.assign(U, J === !0 ? !0 : U0._`${U} > ${J} ? ${U} : ${J}`)),
      mergeValues: ($, J) => ($ === !0 ? !0 : Math.max($, J)),
      resultToName: ($, J) => $.var("items", J),
    }),
  };
  function oV($, J) {
    if (J === !0) return $.var("props", !0);
    let U = $.var("props", U0._`{}`);
    if (J !== void 0) Wq($, U, J);
    return U;
  }
  sV.evaluatedPropsToName = oV;
  function Wq($, J, U) {
    Object.keys(U).forEach((Q) => $.assign(U0._`${J}${(0, U0.getProperty)(Q)}`, !0));
  }
  sV.setEvaluated = Wq;
  var dV = {};
  function Ev($, J) {
    return $.scopeValue("func", { ref: J, code: dV[J.code] || (dV[J.code] = new Gv._Code(J.code)) });
  }
  sV.useFunc = Ev;
  var Jq;
  (function ($) {
    (($[($.Num = 0)] = "Num"), ($[($.Str = 1)] = "Str"));
  })(Jq || (sV.Type = Jq = {}));
  function Lv($, J, U) {
    if ($ instanceof U0.Name) {
      let Q = J === Jq.Num;
      return U
        ? Q
          ? U0._`"[" + ${$} + "]"`
          : U0._`"['" + ${$} + "']"`
        : Q
          ? U0._`"/" + ${$}`
          : U0._`"/" + ${$}.replace(/~/g, "~0").replace(/\\//g, "~1")`;
    }
    return U ? (0, U0.getProperty)($).toString() : "/" + Uq($);
  }
  sV.getErrorPath = Lv;
  function rV($, J, U = $.opts.strictSchema) {
    if (!U) return;
    if (((J = `strict mode: ${J}`), U === !0)) throw Error(J);
    $.self.logger.warn(J);
  }
  sV.checkStrictMode = rV;
});
var rU = P$((tV) => {
  Object.defineProperty(tV, "__esModule", { value: !0 });
  var n0 = q6(),
    yv = {
      data: new n0.Name("data"),
      valCxt: new n0.Name("valCxt"),
      instancePath: new n0.Name("instancePath"),
      parentData: new n0.Name("parentData"),
      parentDataProperty: new n0.Name("parentDataProperty"),
      rootData: new n0.Name("rootData"),
      dynamicAnchors: new n0.Name("dynamicAnchors"),
      vErrors: new n0.Name("vErrors"),
      errors: new n0.Name("errors"),
      this: new n0.Name("this"),
      self: new n0.Name("self"),
      scope: new n0.Name("scope"),
      json: new n0.Name("json"),
      jsonPos: new n0.Name("jsonPos"),
      jsonLen: new n0.Name("jsonLen"),
      jsonPart: new n0.Name("jsonPart"),
    };
  tV.default = yv;
});
var RQ = P$((Uk) => {
  Object.defineProperty(Uk, "__esModule", { value: !0 });
  Uk.extendErrors =
    Uk.resetErrorsCount =
    Uk.reportExtraError =
    Uk.reportError =
    Uk.keyword$DataError =
    Uk.keywordError =
      void 0;
  var T6 = q6(),
    D5 = C6(),
    XJ = rU();
  Uk.keywordError = { message: ({ keyword: $ }) => T6.str`must pass "${$}" keyword validation` };
  Uk.keyword$DataError = {
    message: ({ keyword: $, schemaType: J }) =>
      J ? T6.str`"${$}" keyword must be ${J} ($data)` : T6.str`"${$}" keyword is invalid ($data)`,
  };
  function gv($, J = Uk.keywordError, U, Q) {
    let { it: W } = $,
      { gen: X, compositeRule: Y, allErrors: D } = W,
      H = Jk($, J, U);
    if (Q !== null && Q !== void 0 ? Q : Y || D) eV(X, H);
    else $k(W, T6._`[${H}]`);
  }
  Uk.reportError = gv;
  function hv($, J = Uk.keywordError, U) {
    let { it: Q } = $,
      { gen: W, compositeRule: X, allErrors: Y } = Q,
      D = Jk($, J, U);
    if ((eV(W, D), !(X || Y))) $k(Q, XJ.default.vErrors);
  }
  Uk.reportExtraError = hv;
  function uv($, J) {
    ($.assign(XJ.default.errors, J),
      $.if(T6._`${XJ.default.vErrors} !== null`, () =>
        $.if(
          J,
          () => $.assign(T6._`${XJ.default.vErrors}.length`, J),
          () => $.assign(XJ.default.vErrors, null),
        ),
      ));
  }
  Uk.resetErrorsCount = uv;
  function lv({ gen: $, keyword: J, schemaValue: U, data: Q, errsCount: W, it: X }) {
    if (W === void 0) throw Error("ajv implementation error");
    let Y = $.name("err");
    $.forRange("i", W, XJ.default.errors, (D) => {
      if (
        ($.const(Y, T6._`${XJ.default.vErrors}[${D}]`),
        $.if(T6._`${Y}.instancePath === undefined`, () =>
          $.assign(T6._`${Y}.instancePath`, (0, T6.strConcat)(XJ.default.instancePath, X.errorPath)),
        ),
        $.assign(T6._`${Y}.schemaPath`, T6.str`${X.errSchemaPath}/${J}`),
        X.opts.verbose)
      )
        ($.assign(T6._`${Y}.schema`, U), $.assign(T6._`${Y}.data`, Q));
    });
  }
  Uk.extendErrors = lv;
  function eV($, J) {
    let U = $.const("err", J);
    ($.if(
      T6._`${XJ.default.vErrors} === null`,
      () => $.assign(XJ.default.vErrors, T6._`[${U}]`),
      T6._`${XJ.default.vErrors}.push(${U})`,
    ),
      $.code(T6._`${XJ.default.errors}++`));
  }
  function $k($, J) {
    let { gen: U, validateName: Q, schemaEnv: W } = $;
    if (W.$async) U.throw(T6._`new ${$.ValidationError}(${J})`);
    else (U.assign(T6._`${Q}.errors`, J), U.return(!1));
  }
  var R9 = {
    keyword: new T6.Name("keyword"),
    schemaPath: new T6.Name("schemaPath"),
    params: new T6.Name("params"),
    propertyName: new T6.Name("propertyName"),
    message: new T6.Name("message"),
    schema: new T6.Name("schema"),
    parentSchema: new T6.Name("parentSchema"),
  };
  function Jk($, J, U) {
    let { createErrors: Q } = $.it;
    if (Q === !1) return T6._`{}`;
    return mv($, J, U);
  }
  function mv($, J, U = {}) {
    let { gen: Q, it: W } = $,
      X = [pv(W, U), dv($, U)];
    return (cv($, J, X), Q.object(...X));
  }
  function pv({ errorPath: $ }, { instancePath: J }) {
    let U = J ? T6.str`${$}${(0, D5.getErrorPath)(J, D5.Type.Str)}` : $;
    return [XJ.default.instancePath, (0, T6.strConcat)(XJ.default.instancePath, U)];
  }
  function dv({ keyword: $, it: { errSchemaPath: J } }, { schemaPath: U, parentSchema: Q }) {
    let W = Q ? J : T6.str`${J}/${$}`;
    if (U) W = T6.str`${W}${(0, D5.getErrorPath)(U, D5.Type.Str)}`;
    return [R9.schemaPath, W];
  }
  function cv($, { params: J, message: U }, Q) {
    let { keyword: W, data: X, schemaValue: Y, it: D } = $,
      { opts: H, propertyName: G, topSchemaRef: K, schemaPath: O } = D;
    if ((Q.push([R9.keyword, W], [R9.params, typeof J == "function" ? J($) : J || T6._`{}`]), H.messages))
      Q.push([R9.message, typeof U == "function" ? U($) : U]);
    if (H.verbose) Q.push([R9.schema, Y], [R9.parentSchema, T6._`${K}${O}`], [XJ.default.data, X]);
    if (G) Q.push([R9.propertyName, G]);
  }
});
var Dk = P$((Xk) => {
  Object.defineProperty(Xk, "__esModule", { value: !0 });
  Xk.boolOrEmptySchema = Xk.topBoolOrEmptySchema = void 0;
  var sv = RQ(),
    av = q6(),
    tv = rU(),
    ev = { message: "boolean schema is false" };
  function $b($) {
    let { gen: J, schema: U, validateName: Q } = $;
    if (U === !1) Qk($, !1);
    else if (typeof U == "object" && U.$async === !0) J.return(tv.default.data);
    else (J.assign(av._`${Q}.errors`, null), J.return(!0));
  }
  Xk.topBoolOrEmptySchema = $b;
  function Jb($, J) {
    let { gen: U, schema: Q } = $;
    if (Q === !1) (U.var(J, !1), Qk($));
    else U.var(J, !0);
  }
  Xk.boolOrEmptySchema = Jb;
  function Qk($, J) {
    let { gen: U, data: Q } = $,
      W = { gen: U, keyword: "false schema", data: Q, schema: !1, schemaCode: !1, schemaValue: !1, params: {}, it: $ };
    (0, sv.reportError)(W, ev, void 0, J);
  }
});
var Xq = P$((Hk) => {
  Object.defineProperty(Hk, "__esModule", { value: !0 });
  Hk.getRules = Hk.isJSONType = void 0;
  var Wb = ["string", "number", "integer", "boolean", "null", "object", "array"],
    Qb = new Set(Wb);
  function Xb($) {
    return typeof $ == "string" && Qb.has($);
  }
  Hk.isJSONType = Xb;
  function Yb() {
    let $ = {
      number: { type: "number", rules: [] },
      string: { type: "string", rules: [] },
      array: { type: "array", rules: [] },
      object: { type: "object", rules: [] },
    };
    return {
      types: { ...$, integer: !0, boolean: !0, null: !0 },
      rules: [{ rules: [] }, $.number, $.string, $.array, $.object],
      post: { rules: [] },
      all: {},
      keywords: {},
    };
  }
  Hk.getRules = Yb;
});
var Yq = P$((Ok) => {
  Object.defineProperty(Ok, "__esModule", { value: !0 });
  Ok.shouldUseRule = Ok.shouldUseGroup = Ok.schemaHasRulesForType = void 0;
  function Hb({ schema: $, self: J }, U) {
    let Q = J.RULES.types[U];
    return Q && Q !== !0 && Kk($, Q);
  }
  Ok.schemaHasRulesForType = Hb;
  function Kk($, J) {
    return J.rules.some((U) => Nk($, U));
  }
  Ok.shouldUseGroup = Kk;
  function Nk($, J) {
    var U;
    return (
      $[J.keyword] !== void 0 ||
      ((U = J.definition.implements) === null || U === void 0 ? void 0 : U.some((Q) => $[Q] !== void 0))
    );
  }
  Ok.shouldUseRule = Nk;
});
var ZQ = P$((Ek) => {
  Object.defineProperty(Ek, "__esModule", { value: !0 });
  Ek.reportTypeError =
    Ek.checkDataTypes =
    Ek.checkDataType =
    Ek.coerceAndCheckDataType =
    Ek.getJSONTypes =
    Ek.getSchemaTypes =
    Ek.DataType =
      void 0;
  var Nb = Xq(),
    Ob = Yq(),
    Fb = RQ(),
    O6 = q6(),
    qk = C6(),
    $1;
  (function ($) {
    (($[($.Correct = 0)] = "Correct"), ($[($.Wrong = 1)] = "Wrong"));
  })($1 || (Ek.DataType = $1 = {}));
  function qb($) {
    let J = zk($.type);
    if (J.includes("null")) {
      if ($.nullable === !1) throw Error("type: null contradicts nullable: false");
    } else {
      if (!J.length && $.nullable !== void 0) throw Error('"nullable" cannot be used without "type"');
      if ($.nullable === !0) J.push("null");
    }
    return J;
  }
  Ek.getSchemaTypes = qb;
  function zk($) {
    let J = Array.isArray($) ? $ : $ ? [$] : [];
    if (J.every(Nb.isJSONType)) return J;
    throw Error("type must be JSONType or JSONType[]: " + J.join(","));
  }
  Ek.getJSONTypes = zk;
  function zb($, J) {
    let { gen: U, data: Q, opts: W } = $,
      X = Bb(J, W.coerceTypes),
      Y = J.length > 0 && !(X.length === 0 && J.length === 1 && (0, Ob.schemaHasRulesForType)($, J[0]));
    if (Y) {
      let D = Hq(J, Q, W.strictNumbers, $1.Wrong);
      U.if(D, () => {
        if (X.length) Eb($, J, X);
        else Gq($);
      });
    }
    return Y;
  }
  Ek.coerceAndCheckDataType = zb;
  var Bk = new Set(["string", "number", "integer", "boolean", "null"]);
  function Bb($, J) {
    return J ? $.filter((U) => Bk.has(U) || (J === "array" && U === "array")) : [];
  }
  function Eb($, J, U) {
    let { gen: Q, data: W, opts: X } = $,
      Y = Q.let("dataType", O6._`typeof ${W}`),
      D = Q.let("coerced", O6._`undefined`);
    if (X.coerceTypes === "array")
      Q.if(O6._`${Y} == 'object' && Array.isArray(${W}) && ${W}.length == 1`, () =>
        Q.assign(W, O6._`${W}[0]`)
          .assign(Y, O6._`typeof ${W}`)
          .if(Hq(J, W, X.strictNumbers), () => Q.assign(D, W)),
      );
    Q.if(O6._`${D} !== undefined`);
    for (let G of U) if (Bk.has(G) || (G === "array" && X.coerceTypes === "array")) H(G);
    (Q.else(),
      Gq($),
      Q.endIf(),
      Q.if(O6._`${D} !== undefined`, () => {
        (Q.assign(W, D), Lb($, D));
      }));
    function H(G) {
      switch (G) {
        case "string":
          Q.elseIf(O6._`${Y} == "number" || ${Y} == "boolean"`)
            .assign(D, O6._`"" + ${W}`)
            .elseIf(O6._`${W} === null`)
            .assign(D, O6._`""`);
          return;
        case "number":
          Q.elseIf(
            O6._`${Y} == "boolean" || ${W} === null
              || (${Y} == "string" && ${W} && ${W} == +${W})`,
          ).assign(D, O6._`+${W}`);
          return;
        case "integer":
          Q.elseIf(
            O6._`${Y} === "boolean" || ${W} === null
              || (${Y} === "string" && ${W} && ${W} == +${W} && !(${W} % 1))`,
          ).assign(D, O6._`+${W}`);
          return;
        case "boolean":
          Q.elseIf(O6._`${W} === "false" || ${W} === 0 || ${W} === null`)
            .assign(D, !1)
            .elseIf(O6._`${W} === "true" || ${W} === 1`)
            .assign(D, !0);
          return;
        case "null":
          (Q.elseIf(O6._`${W} === "" || ${W} === 0 || ${W} === false`), Q.assign(D, null));
          return;
        case "array":
          Q.elseIf(
            O6._`${Y} === "string" || ${Y} === "number"
              || ${Y} === "boolean" || ${W} === null`,
          ).assign(D, O6._`[${W}]`);
      }
    }
  }
  function Lb({ gen: $, parentData: J, parentDataProperty: U }, Q) {
    $.if(O6._`${J} !== undefined`, () => $.assign(O6._`${J}[${U}]`, Q));
  }
  function Dq($, J, U, Q = $1.Correct) {
    let W = Q === $1.Correct ? O6.operators.EQ : O6.operators.NEQ,
      X;
    switch ($) {
      case "null":
        return O6._`${J} ${W} null`;
      case "array":
        X = O6._`Array.isArray(${J})`;
        break;
      case "object":
        X = O6._`${J} && typeof ${J} == "object" && !Array.isArray(${J})`;
        break;
      case "integer":
        X = Y(O6._`!(${J} % 1) && !isNaN(${J})`);
        break;
      case "number":
        X = Y();
        break;
      default:
        return O6._`typeof ${J} ${W} ${$}`;
    }
    return Q === $1.Correct ? X : (0, O6.not)(X);
    function Y(D = O6.nil) {
      return (0, O6.and)(O6._`typeof ${J} == "number"`, D, U ? O6._`isFinite(${J})` : O6.nil);
    }
  }
  Ek.checkDataType = Dq;
  function Hq($, J, U, Q) {
    if ($.length === 1) return Dq($[0], J, U, Q);
    let W,
      X = (0, qk.toHash)($);
    if (X.array && X.object) {
      let Y = O6._`typeof ${J} != "object"`;
      ((W = X.null ? Y : O6._`!${J} || ${Y}`), delete X.null, delete X.array, delete X.object);
    } else W = O6.nil;
    if (X.number) delete X.integer;
    for (let Y in X) W = (0, O6.and)(W, Dq(Y, J, U, Q));
    return W;
  }
  Ek.checkDataTypes = Hq;
  var wb = {
    message: ({ schema: $ }) => `must be ${$}`,
    params: ({ schema: $, schemaValue: J }) => (typeof $ == "string" ? O6._`{type: ${$}}` : O6._`{type: ${J}}`),
  };
  function Gq($) {
    let J = Ib($);
    (0, Fb.reportError)(J, wb);
  }
  Ek.reportTypeError = Gq;
  function Ib($) {
    let { gen: J, data: U, schema: Q } = $,
      W = (0, qk.schemaRefOrVal)($, Q, "type");
    return {
      gen: J,
      keyword: "type",
      data: U,
      schema: Q.type,
      schemaCode: W,
      schemaValue: W,
      parentSchema: Q,
      params: {},
      it: $,
    };
  }
});
var kk = P$((Ik) => {
  Object.defineProperty(Ik, "__esModule", { value: !0 });
  Ik.assignDefaults = void 0;
  var J1 = q6(),
    Pb = C6();
  function _b($, J) {
    let { properties: U, items: Q } = $.schema;
    if (J === "object" && U) for (let W in U) wk($, W, U[W].default);
    else if (J === "array" && Array.isArray(Q)) Q.forEach((W, X) => wk($, X, W.default));
  }
  Ik.assignDefaults = _b;
  function wk($, J, U) {
    let { gen: Q, compositeRule: W, data: X, opts: Y } = $;
    if (U === void 0) return;
    let D = J1._`${X}${(0, J1.getProperty)(J)}`;
    if (W) {
      (0, Pb.checkStrictMode)($, `default is ignored for: ${D}`);
      return;
    }
    let H = J1._`${D} === undefined`;
    if (Y.useDefaults === "empty") H = J1._`${H} || ${D} === null || ${D} === ""`;
    Q.if(H, J1._`${D} = ${(0, J1.stringify)(U)}`);
  }
});
var uJ = P$((Rk) => {
  Object.defineProperty(Rk, "__esModule", { value: !0 });
  Rk.validateUnion =
    Rk.validateArray =
    Rk.usePattern =
    Rk.callValidateCode =
    Rk.schemaProperties =
    Rk.allSchemaProperties =
    Rk.noPropertyInData =
    Rk.propertyInData =
    Rk.isOwnProperty =
    Rk.hasPropFunc =
    Rk.reportMissingProp =
    Rk.checkMissingProp =
    Rk.checkReportMissingProp =
      void 0;
  var D0 = q6(),
    Kq = C6(),
    f8 = rU(),
    Sb = C6();
  function Cb($, J) {
    let { gen: U, data: Q, it: W } = $;
    U.if(Oq(U, Q, J, W.opts.ownProperties), () => {
      ($.setParams({ missingProperty: D0._`${J}` }, !0), $.error());
    });
  }
  Rk.checkReportMissingProp = Cb;
  function Tb({ gen: $, data: J, it: { opts: U } }, Q, W) {
    return (0, D0.or)(...Q.map((X) => (0, D0.and)(Oq($, J, X, U.ownProperties), D0._`${W} = ${X}`)));
  }
  Rk.checkMissingProp = Tb;
  function jb($, J) {
    ($.setParams({ missingProperty: J }, !0), $.error());
  }
  Rk.reportMissingProp = jb;
  function Ak($) {
    return $.scopeValue("func", { ref: Object.prototype.hasOwnProperty, code: D0._`Object.prototype.hasOwnProperty` });
  }
  Rk.hasPropFunc = Ak;
  function Nq($, J, U) {
    return D0._`${Ak($)}.call(${J}, ${U})`;
  }
  Rk.isOwnProperty = Nq;
  function vb($, J, U, Q) {
    let W = D0._`${J}${(0, D0.getProperty)(U)} !== undefined`;
    return Q ? D0._`${W} && ${Nq($, J, U)}` : W;
  }
  Rk.propertyInData = vb;
  function Oq($, J, U, Q) {
    let W = D0._`${J}${(0, D0.getProperty)(U)} === undefined`;
    return Q ? (0, D0.or)(W, (0, D0.not)(Nq($, J, U))) : W;
  }
  Rk.noPropertyInData = Oq;
  function Mk($) {
    return $ ? Object.keys($).filter((J) => J !== "__proto__") : [];
  }
  Rk.allSchemaProperties = Mk;
  function bb($, J) {
    return Mk(J).filter((U) => !(0, Kq.alwaysValidSchema)($, J[U]));
  }
  Rk.schemaProperties = bb;
  function fb(
    { schemaCode: $, data: J, it: { gen: U, topSchemaRef: Q, schemaPath: W, errorPath: X }, it: Y },
    D,
    H,
    G,
  ) {
    let K = G ? D0._`${$}, ${J}, ${Q}${W}` : J,
      O = [
        [f8.default.instancePath, (0, D0.strConcat)(f8.default.instancePath, X)],
        [f8.default.parentData, Y.parentData],
        [f8.default.parentDataProperty, Y.parentDataProperty],
        [f8.default.rootData, f8.default.rootData],
      ];
    if (Y.opts.dynamicRef) O.push([f8.default.dynamicAnchors, f8.default.dynamicAnchors]);
    let N = D0._`${K}, ${U.object(...O)}`;
    return H !== D0.nil ? D0._`${D}.call(${H}, ${N})` : D0._`${D}(${N})`;
  }
  Rk.callValidateCode = fb;
  var yb = D0._`new RegExp`;
  function xb({ gen: $, it: { opts: J } }, U) {
    let Q = J.unicodeRegExp ? "u" : "",
      { regExp: W } = J.code,
      X = W(U, Q);
    return $.scopeValue("pattern", {
      key: X.toString(),
      ref: X,
      code: D0._`${W.code === "new RegExp" ? yb : (0, Sb.useFunc)($, W)}(${U}, ${Q})`,
    });
  }
  Rk.usePattern = xb;
  function gb($) {
    let { gen: J, data: U, keyword: Q, it: W } = $,
      X = J.name("valid");
    if (W.allErrors) {
      let D = J.let("valid", !0);
      return (Y(() => J.assign(D, !1)), D);
    }
    return (J.var(X, !0), Y(() => J.break()), X);
    function Y(D) {
      let H = J.const("len", D0._`${U}.length`);
      J.forRange("i", 0, H, (G) => {
        ($.subschema({ keyword: Q, dataProp: G, dataPropType: Kq.Type.Num }, X), J.if((0, D0.not)(X), D));
      });
    }
  }
  Rk.validateArray = gb;
  function hb($) {
    let { gen: J, schema: U, keyword: Q, it: W } = $;
    if (!Array.isArray(U)) throw Error("ajv implementation error");
    if (U.some((H) => (0, Kq.alwaysValidSchema)(W, H)) && !W.opts.unevaluated) return;
    let Y = J.let("valid", !1),
      D = J.name("_valid");
    (J.block(() =>
      U.forEach((H, G) => {
        let K = $.subschema({ keyword: Q, schemaProp: G, compositeRule: !0 }, D);
        if ((J.assign(Y, D0._`${Y} || ${D}`), !$.mergeValidEvaluated(K, D))) J.if((0, D0.not)(Y));
      }),
    ),
      $.result(
        Y,
        () => $.reset(),
        () => $.error(!0),
      ));
  }
  Rk.validateUnion = hb;
});
var Tk = P$((Sk) => {
  Object.defineProperty(Sk, "__esModule", { value: !0 });
  Sk.validateKeywordUsage = Sk.validSchemaType = Sk.funcKeywordCode = Sk.macroKeywordCode = void 0;
  var YJ = q6(),
    Z9 = rU(),
    tb = uJ(),
    eb = RQ();
  function $f($, J) {
    let { gen: U, keyword: Q, schema: W, parentSchema: X, it: Y } = $,
      D = J.macro.call(Y.self, W, X, Y),
      H = _k(U, Q, D);
    if (Y.opts.validateSchema !== !1) Y.self.validateSchema(D, !0);
    let G = U.name("valid");
    ($.subschema(
      { schema: D, schemaPath: YJ.nil, errSchemaPath: `${Y.errSchemaPath}/${Q}`, topSchemaRef: H, compositeRule: !0 },
      G,
    ),
      $.pass(G, () => $.error(!0)));
  }
  Sk.macroKeywordCode = $f;
  function Jf($, J) {
    var U;
    let { gen: Q, keyword: W, schema: X, parentSchema: Y, $data: D, it: H } = $;
    Wf(H, J);
    let G = !D && J.compile ? J.compile.call(H.self, X, Y, H) : J.validate,
      K = _k(Q, W, G),
      O = Q.let("valid");
    ($.block$data(O, N), $.ok((U = J.valid) !== null && U !== void 0 ? U : O));
    function N() {
      if (J.errors === !1) {
        if ((E(), J.modifying)) Pk($);
        z(() => $.error());
      } else {
        let q = J.async ? F() : B();
        if (J.modifying) Pk($);
        z(() => Uf($, q));
      }
    }
    function F() {
      let q = Q.let("ruleErrs", null);
      return (
        Q.try(
          () => E(YJ._`await `),
          (L) =>
            Q.assign(O, !1).if(
              YJ._`${L} instanceof ${H.ValidationError}`,
              () => Q.assign(q, YJ._`${L}.errors`),
              () => Q.throw(L),
            ),
        ),
        q
      );
    }
    function B() {
      let q = YJ._`${K}.errors`;
      return (Q.assign(q, null), E(YJ.nil), q);
    }
    function E(q = J.async ? YJ._`await ` : YJ.nil) {
      let L = H.opts.passContext ? Z9.default.this : Z9.default.self,
        V = !(("compile" in J && !D) || J.schema === !1);
      Q.assign(O, YJ._`${q}${(0, tb.callValidateCode)($, K, L, V)}`, J.modifying);
    }
    function z(q) {
      var L;
      Q.if((0, YJ.not)((L = J.valid) !== null && L !== void 0 ? L : O), q);
    }
  }
  Sk.funcKeywordCode = Jf;
  function Pk($) {
    let { gen: J, data: U, it: Q } = $;
    J.if(Q.parentData, () => J.assign(U, YJ._`${Q.parentData}[${Q.parentDataProperty}]`));
  }
  function Uf($, J) {
    let { gen: U } = $;
    U.if(
      YJ._`Array.isArray(${J})`,
      () => {
        (U.assign(
          Z9.default.vErrors,
          YJ._`${Z9.default.vErrors} === null ? ${J} : ${Z9.default.vErrors}.concat(${J})`,
        ).assign(Z9.default.errors, YJ._`${Z9.default.vErrors}.length`),
          (0, eb.extendErrors)($));
      },
      () => $.error(),
    );
  }
  function Wf({ schemaEnv: $ }, J) {
    if (J.async && !$.$async) throw Error("async keyword in sync schema");
  }
  function _k($, J, U) {
    if (U === void 0) throw Error(`keyword "${J}" failed to compile`);
    return $.scopeValue("keyword", typeof U == "function" ? { ref: U } : { ref: U, code: (0, YJ.stringify)(U) });
  }
  function Qf($, J, U = !1) {
    return (
      !J.length ||
      J.some((Q) =>
        Q === "array"
          ? Array.isArray($)
          : Q === "object"
            ? $ && typeof $ == "object" && !Array.isArray($)
            : typeof $ == Q || (U && typeof $ > "u"),
      )
    );
  }
  Sk.validSchemaType = Qf;
  function Xf({ schema: $, opts: J, self: U, errSchemaPath: Q }, W, X) {
    if (Array.isArray(W.keyword) ? !W.keyword.includes(X) : W.keyword !== X) throw Error("ajv implementation error");
    let Y = W.dependencies;
    if (Y === null || Y === void 0 ? void 0 : Y.some((D) => !Object.prototype.hasOwnProperty.call($, D)))
      throw Error(`parent schema must have dependencies of ${X}: ${Y.join(",")}`);
    if (W.validateSchema) {
      if (!W.validateSchema($[X])) {
        let H = `keyword "${X}" value is invalid at path "${Q}": ` + U.errorsText(W.validateSchema.errors);
        if (J.validateSchema === "log") U.logger.error(H);
        else throw Error(H);
      }
    }
  }
  Sk.validateKeywordUsage = Xf;
});
var fk = P$((vk) => {
  Object.defineProperty(vk, "__esModule", { value: !0 });
  vk.extendSubschemaMode = vk.extendSubschemaData = vk.getSubschema = void 0;
  var PU = q6(),
    jk = C6();
  function Gf($, { keyword: J, schemaProp: U, schema: Q, schemaPath: W, errSchemaPath: X, topSchemaRef: Y }) {
    if (J !== void 0 && Q !== void 0) throw Error('both "keyword" and "schema" passed, only one allowed');
    if (J !== void 0) {
      let D = $.schema[J];
      return U === void 0
        ? {
            schema: D,
            schemaPath: PU._`${$.schemaPath}${(0, PU.getProperty)(J)}`,
            errSchemaPath: `${$.errSchemaPath}/${J}`,
          }
        : {
            schema: D[U],
            schemaPath: PU._`${$.schemaPath}${(0, PU.getProperty)(J)}${(0, PU.getProperty)(U)}`,
            errSchemaPath: `${$.errSchemaPath}/${J}/${(0, jk.escapeFragment)(U)}`,
          };
    }
    if (Q !== void 0) {
      if (W === void 0 || X === void 0 || Y === void 0)
        throw Error('"schemaPath", "errSchemaPath" and "topSchemaRef" are required with "schema"');
      return { schema: Q, schemaPath: W, topSchemaRef: Y, errSchemaPath: X };
    }
    throw Error('either "keyword" or "schema" must be passed');
  }
  vk.getSubschema = Gf;
  function Kf($, J, { dataProp: U, dataPropType: Q, data: W, dataTypes: X, propertyName: Y }) {
    if (W !== void 0 && U !== void 0) throw Error('both "data" and "dataProp" passed, only one allowed');
    let { gen: D } = J;
    if (U !== void 0) {
      let { errorPath: G, dataPathArr: K, opts: O } = J,
        N = D.let("data", PU._`${J.data}${(0, PU.getProperty)(U)}`, !0);
      (H(N),
        ($.errorPath = PU.str`${G}${(0, jk.getErrorPath)(U, Q, O.jsPropertySyntax)}`),
        ($.parentDataProperty = PU._`${U}`),
        ($.dataPathArr = [...K, $.parentDataProperty]));
    }
    if (W !== void 0) {
      let G = W instanceof PU.Name ? W : D.let("data", W, !0);
      if ((H(G), Y !== void 0)) $.propertyName = Y;
    }
    if (X) $.dataTypes = X;
    function H(G) {
      (($.data = G),
        ($.dataLevel = J.dataLevel + 1),
        ($.dataTypes = []),
        (J.definedProperties = new Set()),
        ($.parentData = J.data),
        ($.dataNames = [...J.dataNames, G]));
    }
  }
  vk.extendSubschemaData = Kf;
  function Nf($, { jtdDiscriminator: J, jtdMetadata: U, compositeRule: Q, createErrors: W, allErrors: X }) {
    if (Q !== void 0) $.compositeRule = Q;
    if (W !== void 0) $.createErrors = W;
    if (X !== void 0) $.allErrors = X;
    (($.jtdDiscriminator = J), ($.jtdMetadata = U));
  }
  vk.extendSubschemaMode = Nf;
});
var Fq = P$((s6$, yk) => {
  yk.exports = function $(J, U) {
    if (J === U) return !0;
    if (J && U && typeof J == "object" && typeof U == "object") {
      if (J.constructor !== U.constructor) return !1;
      var Q, W, X;
      if (Array.isArray(J)) {
        if (((Q = J.length), Q != U.length)) return !1;
        for (W = Q; W-- !== 0;) if (!$(J[W], U[W])) return !1;
        return !0;
      }
      if (J.constructor === RegExp) return J.source === U.source && J.flags === U.flags;
      if (J.valueOf !== Object.prototype.valueOf) return J.valueOf() === U.valueOf();
      if (J.toString !== Object.prototype.toString) return J.toString() === U.toString();
      if (((X = Object.keys(J)), (Q = X.length), Q !== Object.keys(U).length)) return !1;
      for (W = Q; W-- !== 0;) if (!Object.prototype.hasOwnProperty.call(U, X[W])) return !1;
      for (W = Q; W-- !== 0;) {
        var Y = X[W];
        if (!$(J[Y], U[Y])) return !1;
      }
      return !0;
    }
    return J !== J && U !== U;
  };
});
var gk = P$((a6$, xk) => {
  var y8 = (xk.exports = function ($, J, U) {
    if (typeof J == "function") ((U = J), (J = {}));
    U = J.cb || U;
    var Q = typeof U == "function" ? U : U.pre || function () {},
      W = U.post || function () {};
    H5(J, Q, W, $, "", $);
  });
  y8.keywords = {
    additionalItems: !0,
    items: !0,
    contains: !0,
    additionalProperties: !0,
    propertyNames: !0,
    not: !0,
    if: !0,
    then: !0,
    else: !0,
  };
  y8.arrayKeywords = { items: !0, allOf: !0, anyOf: !0, oneOf: !0 };
  y8.propsKeywords = { $defs: !0, definitions: !0, properties: !0, patternProperties: !0, dependencies: !0 };
  y8.skipKeywords = {
    default: !0,
    enum: !0,
    const: !0,
    required: !0,
    maximum: !0,
    minimum: !0,
    exclusiveMaximum: !0,
    exclusiveMinimum: !0,
    multipleOf: !0,
    maxLength: !0,
    minLength: !0,
    pattern: !0,
    format: !0,
    maxItems: !0,
    minItems: !0,
    uniqueItems: !0,
    maxProperties: !0,
    minProperties: !0,
  };
  function H5($, J, U, Q, W, X, Y, D, H, G) {
    if (Q && typeof Q == "object" && !Array.isArray(Q)) {
      J(Q, W, X, Y, D, H, G);
      for (var K in Q) {
        var O = Q[K];
        if (Array.isArray(O)) {
          if (K in y8.arrayKeywords)
            for (var N = 0; N < O.length; N++) H5($, J, U, O[N], W + "/" + K + "/" + N, X, W, K, Q, N);
        } else if (K in y8.propsKeywords) {
          if (O && typeof O == "object") for (var F in O) H5($, J, U, O[F], W + "/" + K + "/" + qf(F), X, W, K, Q, F);
        } else if (K in y8.keywords || ($.allKeys && !(K in y8.skipKeywords))) H5($, J, U, O, W + "/" + K, X, W, K, Q);
      }
      U(Q, W, X, Y, D, H, G);
    }
  }
  function qf($) {
    return $.replace(/~/g, "~0").replace(/\//g, "~1");
  }
});
var PQ = P$((mk) => {
  Object.defineProperty(mk, "__esModule", { value: !0 });
  mk.getSchemaRefs = mk.resolveUrl = mk.normalizeId = mk._getFullPath = mk.getFullPath = mk.inlineRef = void 0;
  var zf = C6(),
    Bf = Fq(),
    Ef = gk(),
    Lf = new Set([
      "type",
      "format",
      "pattern",
      "maxLength",
      "minLength",
      "maxProperties",
      "minProperties",
      "maxItems",
      "minItems",
      "maximum",
      "minimum",
      "uniqueItems",
      "multipleOf",
      "required",
      "enum",
      "const",
    ]);
  function wf($, J = !0) {
    if (typeof $ == "boolean") return !0;
    if (J === !0) return !qq($);
    if (!J) return !1;
    return hk($) <= J;
  }
  mk.inlineRef = wf;
  var If = new Set(["$ref", "$recursiveRef", "$recursiveAnchor", "$dynamicRef", "$dynamicAnchor"]);
  function qq($) {
    for (let J in $) {
      if (If.has(J)) return !0;
      let U = $[J];
      if (Array.isArray(U) && U.some(qq)) return !0;
      if (typeof U == "object" && qq(U)) return !0;
    }
    return !1;
  }
  function hk($) {
    let J = 0;
    for (let U in $) {
      if (U === "$ref") return 1 / 0;
      if ((J++, Lf.has(U))) continue;
      if (typeof $[U] == "object") (0, zf.eachItem)($[U], (Q) => (J += hk(Q)));
      if (J === 1 / 0) return 1 / 0;
    }
    return J;
  }
  function uk($, J = "", U) {
    if (U !== !1) J = U1(J);
    let Q = $.parse(J);
    return lk($, Q);
  }
  mk.getFullPath = uk;
  function lk($, J) {
    return $.serialize(J).split("#")[0] + "#";
  }
  mk._getFullPath = lk;
  var Vf = /#\/?$/;
  function U1($) {
    return $ ? $.replace(Vf, "") : "";
  }
  mk.normalizeId = U1;
  function kf($, J, U) {
    return ((U = U1(U)), $.resolve(J, U));
  }
  mk.resolveUrl = kf;
  var Af = /^[a-z_][-a-z0-9._]*$/i;
  function Mf($, J) {
    if (typeof $ == "boolean") return {};
    let { schemaId: U, uriResolver: Q } = this.opts,
      W = U1($[U] || J),
      X = { "": W },
      Y = uk(Q, W, !1),
      D = {},
      H = new Set();
    return (
      Ef($, { allKeys: !0 }, (O, N, F, B) => {
        if (B === void 0) return;
        let E = Y + N,
          z = X[B];
        if (typeof O[U] == "string") z = q.call(this, O[U]);
        (L.call(this, O.$anchor), L.call(this, O.$dynamicAnchor), (X[N] = z));
        function q(V) {
          let k = this.opts.uriResolver.resolve;
          if (((V = U1(z ? k(z, V) : V)), H.has(V))) throw K(V);
          H.add(V);
          let R = this.refs[V];
          if (typeof R == "string") R = this.refs[R];
          if (typeof R == "object") G(O, R.schema, V);
          else if (V !== U1(E))
            if (V[0] === "#") (G(O, D[V], V), (D[V] = O));
            else this.refs[V] = E;
          return V;
        }
        function L(V) {
          if (typeof V == "string") {
            if (!Af.test(V)) throw Error(`invalid anchor "${V}"`);
            q.call(this, `#${V}`);
          }
        }
      }),
      D
    );
    function G(O, N, F) {
      if (N !== void 0 && !Bf(O, N)) throw K(F);
    }
    function K(O) {
      return Error(`reference "${O}" resolves to more than one schema`);
    }
  }
  mk.getSchemaRefs = Mf;
});
var CQ = P$((QA) => {
  Object.defineProperty(QA, "__esModule", { value: !0 });
  QA.getData = QA.KeywordCxt = QA.validateFunctionCode = void 0;
  var ok = Dk(),
    dk = ZQ(),
    Bq = Yq(),
    G5 = ZQ(),
    Cf = kk(),
    SQ = Tk(),
    zq = fk(),
    m$ = q6(),
    U6 = rU(),
    Tf = PQ(),
    sU = C6(),
    _Q = RQ();
  function jf($) {
    if (ak($)) {
      if ((tk($), sk($))) {
        ff($);
        return;
      }
    }
    rk($, () => (0, ok.topBoolOrEmptySchema)($));
  }
  QA.validateFunctionCode = jf;
  function rk({ gen: $, validateName: J, schema: U, schemaEnv: Q, opts: W }, X) {
    if (W.code.es5)
      $.func(J, m$._`${U6.default.data}, ${U6.default.valCxt}`, Q.$async, () => {
        ($.code(m$._`"use strict"; ${ck(U, W)}`), bf($, W), $.code(X));
      });
    else $.func(J, m$._`${U6.default.data}, ${vf(W)}`, Q.$async, () => $.code(ck(U, W)).code(X));
  }
  function vf($) {
    return m$._`{${U6.default.instancePath}="", ${U6.default.parentData}, ${U6.default.parentDataProperty}, ${U6.default.rootData}=${U6.default.data}${$.dynamicRef ? m$._`, ${U6.default.dynamicAnchors}={}` : m$.nil}}={}`;
  }
  function bf($, J) {
    $.if(
      U6.default.valCxt,
      () => {
        if (
          ($.var(U6.default.instancePath, m$._`${U6.default.valCxt}.${U6.default.instancePath}`),
          $.var(U6.default.parentData, m$._`${U6.default.valCxt}.${U6.default.parentData}`),
          $.var(U6.default.parentDataProperty, m$._`${U6.default.valCxt}.${U6.default.parentDataProperty}`),
          $.var(U6.default.rootData, m$._`${U6.default.valCxt}.${U6.default.rootData}`),
          J.dynamicRef)
        )
          $.var(U6.default.dynamicAnchors, m$._`${U6.default.valCxt}.${U6.default.dynamicAnchors}`);
      },
      () => {
        if (
          ($.var(U6.default.instancePath, m$._`""`),
          $.var(U6.default.parentData, m$._`undefined`),
          $.var(U6.default.parentDataProperty, m$._`undefined`),
          $.var(U6.default.rootData, U6.default.data),
          J.dynamicRef)
        )
          $.var(U6.default.dynamicAnchors, m$._`{}`);
      },
    );
  }
  function ff($) {
    let { schema: J, opts: U, gen: Q } = $;
    rk($, () => {
      if (U.$comment && J.$comment) $A($);
      if ((uf($), Q.let(U6.default.vErrors, null), Q.let(U6.default.errors, 0), U.unevaluated)) yf($);
      (ek($), pf($));
    });
    return;
  }
  function yf($) {
    let { gen: J, validateName: U } = $;
    (($.evaluated = J.const("evaluated", m$._`${U}.evaluated`)),
      J.if(m$._`${$.evaluated}.dynamicProps`, () => J.assign(m$._`${$.evaluated}.props`, m$._`undefined`)),
      J.if(m$._`${$.evaluated}.dynamicItems`, () => J.assign(m$._`${$.evaluated}.items`, m$._`undefined`)));
  }
  function ck($, J) {
    let U = typeof $ == "object" && $[J.schemaId];
    return U && (J.code.source || J.code.process) ? m$._`/*# sourceURL=${U} */` : m$.nil;
  }
  function xf($, J) {
    if (ak($)) {
      if ((tk($), sk($))) {
        gf($, J);
        return;
      }
    }
    (0, ok.boolOrEmptySchema)($, J);
  }
  function sk({ schema: $, self: J }) {
    if (typeof $ == "boolean") return !$;
    for (let U in $) if (J.RULES.all[U]) return !0;
    return !1;
  }
  function ak($) {
    return typeof $.schema != "boolean";
  }
  function gf($, J) {
    let { schema: U, gen: Q, opts: W } = $;
    if (W.$comment && U.$comment) $A($);
    (lf($), mf($));
    let X = Q.const("_errs", U6.default.errors);
    (ek($, X), Q.var(J, m$._`${X} === ${U6.default.errors}`));
  }
  function tk($) {
    ((0, sU.checkUnknownRules)($), hf($));
  }
  function ek($, J) {
    if ($.opts.jtd) return nk($, [], !1, J);
    let U = (0, dk.getSchemaTypes)($.schema),
      Q = (0, dk.coerceAndCheckDataType)($, U);
    nk($, U, !Q, J);
  }
  function hf($) {
    let { schema: J, errSchemaPath: U, opts: Q, self: W } = $;
    if (J.$ref && Q.ignoreKeywordsWithRef && (0, sU.schemaHasRulesButRef)(J, W.RULES))
      W.logger.warn(`$ref: keywords ignored in schema at path "${U}"`);
  }
  function uf($) {
    let { schema: J, opts: U } = $;
    if (J.default !== void 0 && U.useDefaults && U.strictSchema)
      (0, sU.checkStrictMode)($, "default is ignored in the schema root");
  }
  function lf($) {
    let J = $.schema[$.opts.schemaId];
    if (J) $.baseId = (0, Tf.resolveUrl)($.opts.uriResolver, $.baseId, J);
  }
  function mf($) {
    if ($.schema.$async && !$.schemaEnv.$async) throw Error("async schema in sync schema");
  }
  function $A({ gen: $, schemaEnv: J, schema: U, errSchemaPath: Q, opts: W }) {
    let X = U.$comment;
    if (W.$comment === !0) $.code(m$._`${U6.default.self}.logger.log(${X})`);
    else if (typeof W.$comment == "function") {
      let Y = m$.str`${Q}/$comment`,
        D = $.scopeValue("root", { ref: J.root });
      $.code(m$._`${U6.default.self}.opts.$comment(${X}, ${Y}, ${D}.schema)`);
    }
  }
  function pf($) {
    let { gen: J, schemaEnv: U, validateName: Q, ValidationError: W, opts: X } = $;
    if (U.$async)
      J.if(
        m$._`${U6.default.errors} === 0`,
        () => J.return(U6.default.data),
        () => J.throw(m$._`new ${W}(${U6.default.vErrors})`),
      );
    else {
      if ((J.assign(m$._`${Q}.errors`, U6.default.vErrors), X.unevaluated)) df($);
      J.return(m$._`${U6.default.errors} === 0`);
    }
  }
  function df({ gen: $, evaluated: J, props: U, items: Q }) {
    if (U instanceof m$.Name) $.assign(m$._`${J}.props`, U);
    if (Q instanceof m$.Name) $.assign(m$._`${J}.items`, Q);
  }
  function nk($, J, U, Q) {
    let { gen: W, schema: X, data: Y, allErrors: D, opts: H, self: G } = $,
      { RULES: K } = G;
    if (X.$ref && (H.ignoreKeywordsWithRef || !(0, sU.schemaHasRulesButRef)(X, K))) {
      W.block(() => UA($, "$ref", K.all.$ref.definition));
      return;
    }
    if (!H.jtd) cf($, J);
    W.block(() => {
      for (let N of K.rules) O(N);
      O(K.post);
    });
    function O(N) {
      if (!(0, Bq.shouldUseGroup)(X, N)) return;
      if (N.type) {
        if ((W.if((0, G5.checkDataType)(N.type, Y, H.strictNumbers)), ik($, N), J.length === 1 && J[0] === N.type && U))
          (W.else(), (0, G5.reportTypeError)($));
        W.endIf();
      } else ik($, N);
      if (!D) W.if(m$._`${U6.default.errors} === ${Q || 0}`);
    }
  }
  function ik($, J) {
    let {
      gen: U,
      schema: Q,
      opts: { useDefaults: W },
    } = $;
    if (W) (0, Cf.assignDefaults)($, J.type);
    U.block(() => {
      for (let X of J.rules) if ((0, Bq.shouldUseRule)(Q, X)) UA($, X.keyword, X.definition, J.type);
    });
  }
  function cf($, J) {
    if ($.schemaEnv.meta || !$.opts.strictTypes) return;
    if ((nf($, J), !$.opts.allowUnionTypes)) of($, J);
    rf($, $.dataTypes);
  }
  function nf($, J) {
    if (!J.length) return;
    if (!$.dataTypes.length) {
      $.dataTypes = J;
      return;
    }
    (J.forEach((U) => {
      if (!JA($.dataTypes, U)) Eq($, `type "${U}" not allowed by context "${$.dataTypes.join(",")}"`);
    }),
      af($, J));
  }
  function of($, J) {
    if (J.length > 1 && !(J.length === 2 && J.includes("null")))
      Eq($, "use allowUnionTypes to allow union type keyword");
  }
  function rf($, J) {
    let U = $.self.RULES.all;
    for (let Q in U) {
      let W = U[Q];
      if (typeof W == "object" && (0, Bq.shouldUseRule)($.schema, W)) {
        let { type: X } = W.definition;
        if (X.length && !X.some((Y) => sf(J, Y))) Eq($, `missing type "${X.join(",")}" for keyword "${Q}"`);
      }
    }
  }
  function sf($, J) {
    return $.includes(J) || (J === "number" && $.includes("integer"));
  }
  function JA($, J) {
    return $.includes(J) || (J === "integer" && $.includes("number"));
  }
  function af($, J) {
    let U = [];
    for (let Q of $.dataTypes)
      if (JA(J, Q)) U.push(Q);
      else if (J.includes("integer") && Q === "number") U.push("integer");
    $.dataTypes = U;
  }
  function Eq($, J) {
    let U = $.schemaEnv.baseId + $.errSchemaPath;
    ((J += ` at "${U}" (strictTypes)`), (0, sU.checkStrictMode)($, J, $.opts.strictTypes));
  }
  class Lq {
    constructor($, J, U) {
      if (
        ((0, SQ.validateKeywordUsage)($, J, U),
        (this.gen = $.gen),
        (this.allErrors = $.allErrors),
        (this.keyword = U),
        (this.data = $.data),
        (this.schema = $.schema[U]),
        (this.$data = J.$data && $.opts.$data && this.schema && this.schema.$data),
        (this.schemaValue = (0, sU.schemaRefOrVal)($, this.schema, U, this.$data)),
        (this.schemaType = J.schemaType),
        (this.parentSchema = $.schema),
        (this.params = {}),
        (this.it = $),
        (this.def = J),
        this.$data)
      )
        this.schemaCode = $.gen.const("vSchema", WA(this.$data, $));
      else if (
        ((this.schemaCode = this.schemaValue), !(0, SQ.validSchemaType)(this.schema, J.schemaType, J.allowUndefined))
      )
        throw Error(`${U} value must be ${JSON.stringify(J.schemaType)}`);
      if ("code" in J ? J.trackErrors : J.errors !== !1) this.errsCount = $.gen.const("_errs", U6.default.errors);
    }
    result($, J, U) {
      this.failResult((0, m$.not)($), J, U);
    }
    failResult($, J, U) {
      if ((this.gen.if($), U)) U();
      else this.error();
      if (J) {
        if ((this.gen.else(), J(), this.allErrors)) this.gen.endIf();
      } else if (this.allErrors) this.gen.endIf();
      else this.gen.else();
    }
    pass($, J) {
      this.failResult((0, m$.not)($), void 0, J);
    }
    fail($) {
      if ($ === void 0) {
        if ((this.error(), !this.allErrors)) this.gen.if(!1);
        return;
      }
      if ((this.gen.if($), this.error(), this.allErrors)) this.gen.endIf();
      else this.gen.else();
    }
    fail$data($) {
      if (!this.$data) return this.fail($);
      let { schemaCode: J } = this;
      this.fail(m$._`${J} !== undefined && (${(0, m$.or)(this.invalid$data(), $)})`);
    }
    error($, J, U) {
      if (J) {
        (this.setParams(J), this._error($, U), this.setParams({}));
        return;
      }
      this._error($, U);
    }
    _error($, J) {
      ($ ? _Q.reportExtraError : _Q.reportError)(this, this.def.error, J);
    }
    $dataError() {
      (0, _Q.reportError)(this, this.def.$dataError || _Q.keyword$DataError);
    }
    reset() {
      if (this.errsCount === void 0) throw Error('add "trackErrors" to keyword definition');
      (0, _Q.resetErrorsCount)(this.gen, this.errsCount);
    }
    ok($) {
      if (!this.allErrors) this.gen.if($);
    }
    setParams($, J) {
      if (J) Object.assign(this.params, $);
      else this.params = $;
    }
    block$data($, J, U = m$.nil) {
      this.gen.block(() => {
        (this.check$data($, U), J());
      });
    }
    check$data($ = m$.nil, J = m$.nil) {
      if (!this.$data) return;
      let { gen: U, schemaCode: Q, schemaType: W, def: X } = this;
      if ((U.if((0, m$.or)(m$._`${Q} === undefined`, J)), $ !== m$.nil)) U.assign($, !0);
      if (W.length || X.validateSchema) {
        if ((U.elseIf(this.invalid$data()), this.$dataError(), $ !== m$.nil)) U.assign($, !1);
      }
      U.else();
    }
    invalid$data() {
      let { gen: $, schemaCode: J, schemaType: U, def: Q, it: W } = this;
      return (0, m$.or)(X(), Y());
      function X() {
        if (U.length) {
          if (!(J instanceof m$.Name)) throw Error("ajv implementation error");
          let D = Array.isArray(U) ? U : [U];
          return m$._`${(0, G5.checkDataTypes)(D, J, W.opts.strictNumbers, G5.DataType.Wrong)}`;
        }
        return m$.nil;
      }
      function Y() {
        if (Q.validateSchema) {
          let D = $.scopeValue("validate$data", { ref: Q.validateSchema });
          return m$._`!${D}(${J})`;
        }
        return m$.nil;
      }
    }
    subschema($, J) {
      let U = (0, zq.getSubschema)(this.it, $);
      ((0, zq.extendSubschemaData)(U, this.it, $), (0, zq.extendSubschemaMode)(U, $));
      let Q = { ...this.it, ...U, items: void 0, props: void 0 };
      return (xf(Q, J), Q);
    }
    mergeEvaluated($, J) {
      let { it: U, gen: Q } = this;
      if (!U.opts.unevaluated) return;
      if (U.props !== !0 && $.props !== void 0) U.props = sU.mergeEvaluated.props(Q, $.props, U.props, J);
      if (U.items !== !0 && $.items !== void 0) U.items = sU.mergeEvaluated.items(Q, $.items, U.items, J);
    }
    mergeValidEvaluated($, J) {
      let { it: U, gen: Q } = this;
      if (U.opts.unevaluated && (U.props !== !0 || U.items !== !0))
        return (Q.if(J, () => this.mergeEvaluated($, m$.Name)), !0);
    }
  }
  QA.KeywordCxt = Lq;
  function UA($, J, U, Q) {
    let W = new Lq($, U, J);
    if ("code" in U) U.code(W, Q);
    else if (W.$data && U.validate) (0, SQ.funcKeywordCode)(W, U);
    else if ("macro" in U) (0, SQ.macroKeywordCode)(W, U);
    else if (U.compile || U.validate) (0, SQ.funcKeywordCode)(W, U);
  }
  var tf = /^\/(?:[^~]|~0|~1)*$/,
    ef = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
  function WA($, { dataLevel: J, dataNames: U, dataPathArr: Q }) {
    let W, X;
    if ($ === "") return U6.default.rootData;
    if ($[0] === "/") {
      if (!tf.test($)) throw Error(`Invalid JSON-pointer: ${$}`);
      ((W = $), (X = U6.default.rootData));
    } else {
      let G = ef.exec($);
      if (!G) throw Error(`Invalid JSON-pointer: ${$}`);
      let K = +G[1];
      if (((W = G[2]), W === "#")) {
        if (K >= J) throw Error(H("property/index", K));
        return Q[J - K];
      }
      if (K > J) throw Error(H("data", K));
      if (((X = U[J - K]), !W)) return X;
    }
    let Y = X,
      D = W.split("/");
    for (let G of D)
      if (G) ((X = m$._`${X}${(0, m$.getProperty)((0, sU.unescapeJsonPointer)(G))}`), (Y = m$._`${Y} && ${X}`));
    return Y;
    function H(G, K) {
      return `Cannot access ${G} ${K} levels up, current level is ${J}`;
    }
  }
  QA.getData = WA;
});
var K5 = P$((DA) => {
  Object.defineProperty(DA, "__esModule", { value: !0 });
  class YA extends Error {
    constructor($) {
      super("validation failed");
      ((this.errors = $), (this.ajv = this.validation = !0));
    }
  }
  DA.default = YA;
});
var TQ = P$((GA) => {
  Object.defineProperty(GA, "__esModule", { value: !0 });
  var wq = PQ();
  class HA extends Error {
    constructor($, J, U, Q) {
      super(Q || `can't resolve reference ${U} from id ${J}`);
      ((this.missingRef = (0, wq.resolveUrl)($, J, U)),
        (this.missingSchema = (0, wq.normalizeId)((0, wq.getFullPath)($, this.missingRef))));
    }
  }
  GA.default = HA;
});
var O5 = P$((OA) => {
  Object.defineProperty(OA, "__esModule", { value: !0 });
  OA.resolveSchema = OA.getCompilingSchema = OA.resolveRef = OA.compileSchema = OA.SchemaEnv = void 0;
  var UU = q6(),
    Qy = K5(),
    P9 = rU(),
    WU = PQ(),
    KA = C6(),
    Xy = CQ();
  class jQ {
    constructor($) {
      var J;
      ((this.refs = {}), (this.dynamicAnchors = {}));
      let U;
      if (typeof $.schema == "object") U = $.schema;
      ((this.schema = $.schema),
        (this.schemaId = $.schemaId),
        (this.root = $.root || this),
        (this.baseId =
          (J = $.baseId) !== null && J !== void 0
            ? J
            : (0, WU.normalizeId)(U === null || U === void 0 ? void 0 : U[$.schemaId || "$id"])),
        (this.schemaPath = $.schemaPath),
        (this.localRefs = $.localRefs),
        (this.meta = $.meta),
        (this.$async = U === null || U === void 0 ? void 0 : U.$async),
        (this.refs = {}));
    }
  }
  OA.SchemaEnv = jQ;
  function Vq($) {
    let J = NA.call(this, $);
    if (J) return J;
    let U = (0, WU.getFullPath)(this.opts.uriResolver, $.root.baseId),
      { es5: Q, lines: W } = this.opts.code,
      { ownProperties: X } = this.opts,
      Y = new UU.CodeGen(this.scope, { es5: Q, lines: W, ownProperties: X }),
      D;
    if ($.$async)
      D = Y.scopeValue("Error", { ref: Qy.default, code: UU._`require("ajv/dist/runtime/validation_error").default` });
    let H = Y.scopeName("validate");
    $.validateName = H;
    let G = {
        gen: Y,
        allErrors: this.opts.allErrors,
        data: P9.default.data,
        parentData: P9.default.parentData,
        parentDataProperty: P9.default.parentDataProperty,
        dataNames: [P9.default.data],
        dataPathArr: [UU.nil],
        dataLevel: 0,
        dataTypes: [],
        definedProperties: new Set(),
        topSchemaRef: Y.scopeValue(
          "schema",
          this.opts.code.source === !0 ? { ref: $.schema, code: (0, UU.stringify)($.schema) } : { ref: $.schema },
        ),
        validateName: H,
        ValidationError: D,
        schema: $.schema,
        schemaEnv: $,
        rootId: U,
        baseId: $.baseId || U,
        schemaPath: UU.nil,
        errSchemaPath: $.schemaPath || (this.opts.jtd ? "" : "#"),
        errorPath: UU._`""`,
        opts: this.opts,
        self: this,
      },
      K;
    try {
      (this._compilations.add($), (0, Xy.validateFunctionCode)(G), Y.optimize(this.opts.code.optimize));
      let O = Y.toString();
      if (((K = `${Y.scopeRefs(P9.default.scope)}return ${O}`), this.opts.code.process))
        K = this.opts.code.process(K, $);
      let F = Function(`${P9.default.self}`, `${P9.default.scope}`, K)(this, this.scope.get());
      if ((this.scope.value(H, { ref: F }), (F.errors = null), (F.schema = $.schema), (F.schemaEnv = $), $.$async))
        F.$async = !0;
      if (this.opts.code.source === !0) F.source = { validateName: H, validateCode: O, scopeValues: Y._values };
      if (this.opts.unevaluated) {
        let { props: B, items: E } = G;
        if (
          ((F.evaluated = {
            props: B instanceof UU.Name ? void 0 : B,
            items: E instanceof UU.Name ? void 0 : E,
            dynamicProps: B instanceof UU.Name,
            dynamicItems: E instanceof UU.Name,
          }),
          F.source)
        )
          F.source.evaluated = (0, UU.stringify)(F.evaluated);
      }
      return (($.validate = F), $);
    } catch (O) {
      if ((delete $.validate, delete $.validateName, K)) this.logger.error("Error compiling schema, function code:", K);
      throw O;
    } finally {
      this._compilations.delete($);
    }
  }
  OA.compileSchema = Vq;
  function Yy($, J, U) {
    var Q;
    U = (0, WU.resolveUrl)(this.opts.uriResolver, J, U);
    let W = $.refs[U];
    if (W) return W;
    let X = Gy.call(this, $, U);
    if (X === void 0) {
      let Y = (Q = $.localRefs) === null || Q === void 0 ? void 0 : Q[U],
        { schemaId: D } = this.opts;
      if (Y) X = new jQ({ schema: Y, schemaId: D, root: $, baseId: J });
    }
    if (X === void 0) return;
    return ($.refs[U] = Dy.call(this, X));
  }
  OA.resolveRef = Yy;
  function Dy($) {
    if ((0, WU.inlineRef)($.schema, this.opts.inlineRefs)) return $.schema;
    return $.validate ? $ : Vq.call(this, $);
  }
  function NA($) {
    for (let J of this._compilations) if (Hy(J, $)) return J;
  }
  OA.getCompilingSchema = NA;
  function Hy($, J) {
    return $.schema === J.schema && $.root === J.root && $.baseId === J.baseId;
  }
  function Gy($, J) {
    let U;
    while (typeof (U = this.refs[J]) == "string") J = U;
    return U || this.schemas[J] || N5.call(this, $, J);
  }
  function N5($, J) {
    let U = this.opts.uriResolver.parse(J),
      Q = (0, WU._getFullPath)(this.opts.uriResolver, U),
      W = (0, WU.getFullPath)(this.opts.uriResolver, $.baseId, void 0);
    if (Object.keys($.schema).length > 0 && Q === W) return Iq.call(this, U, $);
    let X = (0, WU.normalizeId)(Q),
      Y = this.refs[X] || this.schemas[X];
    if (typeof Y == "string") {
      let D = N5.call(this, $, Y);
      if (typeof (D === null || D === void 0 ? void 0 : D.schema) !== "object") return;
      return Iq.call(this, U, D);
    }
    if (typeof (Y === null || Y === void 0 ? void 0 : Y.schema) !== "object") return;
    if (!Y.validate) Vq.call(this, Y);
    if (X === (0, WU.normalizeId)(J)) {
      let { schema: D } = Y,
        { schemaId: H } = this.opts,
        G = D[H];
      if (G) W = (0, WU.resolveUrl)(this.opts.uriResolver, W, G);
      return new jQ({ schema: D, schemaId: H, root: $, baseId: W });
    }
    return Iq.call(this, U, Y);
  }
  OA.resolveSchema = N5;
  var Ky = new Set(["properties", "patternProperties", "enum", "dependencies", "definitions"]);
  function Iq($, { baseId: J, schema: U, root: Q }) {
    var W;
    if (((W = $.fragment) === null || W === void 0 ? void 0 : W[0]) !== "/") return;
    for (let D of $.fragment.slice(1).split("/")) {
      if (typeof U === "boolean") return;
      let H = U[(0, KA.unescapeFragment)(D)];
      if (H === void 0) return;
      U = H;
      let G = typeof U === "object" && U[this.opts.schemaId];
      if (!Ky.has(D) && G) J = (0, WU.resolveUrl)(this.opts.uriResolver, J, G);
    }
    let X;
    if (typeof U != "boolean" && U.$ref && !(0, KA.schemaHasRulesButRef)(U, this.RULES)) {
      let D = (0, WU.resolveUrl)(this.opts.uriResolver, J, U.$ref);
      X = N5.call(this, Q, D);
    }
    let { schemaId: Y } = this.opts;
    if (((X = X || new jQ({ schema: U, schemaId: Y, root: Q, baseId: J })), X.schema !== X.root.schema)) return X;
    return;
  }
});
var qA = P$((W0$, zy) => {
  zy.exports = {
    $id: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#",
    description: "Meta-schema for $data reference (JSON AnySchema extension proposal)",
    type: "object",
    required: ["$data"],
    properties: { $data: { type: "string", anyOf: [{ format: "relative-json-pointer" }, { format: "json-pointer" }] } },
    additionalProperties: !1,
  };
});
var Mq = P$((Q0$, IA) => {
  var By = RegExp.prototype.test.bind(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu),
    BA = RegExp.prototype.test.bind(
      /^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)$/u,
    ),
    kq = RegExp.prototype.test.bind(/^[\da-f]{2}$/iu),
    EA = RegExp.prototype.test.bind(/^[\da-z\-._~]$/iu),
    Ey = RegExp.prototype.test.bind(/^[\da-z\-._~!$&'()*+,;=:@/]$/iu);
  function Aq($) {
    let J = "",
      U = 0,
      Q = 0;
    for (Q = 0; Q < $.length; Q++) {
      if (((U = $[Q].charCodeAt(0)), U === 48)) continue;
      if (!((U >= 48 && U <= 57) || (U >= 65 && U <= 70) || (U >= 97 && U <= 102))) return "";
      J += $[Q];
      break;
    }
    for (Q += 1; Q < $.length; Q++) {
      if (((U = $[Q].charCodeAt(0)), !((U >= 48 && U <= 57) || (U >= 65 && U <= 70) || (U >= 97 && U <= 102))))
        return "";
      J += $[Q];
    }
    return J;
  }
  var Ly = RegExp.prototype.test.bind(/[^!"$&'()*+,\-.;=_`a-z{}~]/u);
  function zA($) {
    return (($.length = 0), !0);
  }
  function wy($, J, U) {
    if ($.length) {
      let Q = Aq($);
      if (Q !== "") J.push(Q);
      else return ((U.error = !0), !1);
      $.length = 0;
    }
    return !0;
  }
  function Iy($) {
    let J = 0,
      U = { error: !1, address: "", zone: "" },
      Q = [],
      W = [],
      X = !1,
      Y = !1,
      D = wy;
    for (let H = 0; H < $.length; H++) {
      let G = $[H];
      if (G === "[" || G === "]") continue;
      if (G === ":") {
        if (X === !0) Y = !0;
        if (!D(W, Q, U)) break;
        if (++J > 7) {
          U.error = !0;
          break;
        }
        if (H > 0 && $[H - 1] === ":") X = !0;
        Q.push(":");
        continue;
      } else if (G === "%") {
        if (!D(W, Q, U)) break;
        D = zA;
      } else {
        W.push(G);
        continue;
      }
    }
    if (W.length)
      if (D === zA) U.zone = W.join("");
      else if (Y) Q.push(W.join(""));
      else Q.push(Aq(W));
    return ((U.address = Q.join("")), U);
  }
  function LA($) {
    if (Vy($, ":") < 2) return { host: $, isIPV6: !1 };
    let J = Iy($);
    if (!J.error) {
      let { address: U, address: Q } = J;
      if (J.zone) ((U += "%" + J.zone), (Q += "%25" + J.zone));
      return { host: U, isIPV6: !0, escapedHost: Q };
    } else return { host: $, isIPV6: !1 };
  }
  function Vy($, J) {
    let U = 0;
    for (let Q = 0; Q < $.length; Q++) if ($[Q] === J) U++;
    return U;
  }
  function ky($) {
    let J = $,
      U = [],
      Q = -1,
      W = 0;
    while ((W = J.length)) {
      if (W === 1)
        if (J === ".") break;
        else if (J === "/") {
          U.push("/");
          break;
        } else {
          U.push(J);
          break;
        }
      else if (W === 2) {
        if (J[0] === ".") {
          if (J[1] === ".") break;
          else if (J[1] === "/") {
            J = J.slice(2);
            continue;
          }
        } else if (J[0] === "/") {
          if (J[1] === "." || J[1] === "/") {
            U.push("/");
            break;
          }
        }
      } else if (W === 3) {
        if (J === "/..") {
          if (U.length !== 0) U.pop();
          U.push("/");
          break;
        }
      }
      if (J[0] === ".") {
        if (J[1] === ".") {
          if (J[2] === "/") {
            J = J.slice(3);
            continue;
          }
        } else if (J[1] === "/") {
          J = J.slice(2);
          continue;
        }
      } else if (J[0] === "/") {
        if (J[1] === ".") {
          if (J[2] === "/") {
            J = J.slice(2);
            continue;
          } else if (J[2] === ".") {
            if (J[3] === "/") {
              if (((J = J.slice(3)), U.length !== 0)) U.pop();
              continue;
            }
          }
        }
      }
      if ((Q = J.indexOf("/", 1)) === -1) {
        U.push(J);
        break;
      } else (U.push(J.slice(0, Q)), (J = J.slice(Q)));
    }
    return U.join("");
  }
  var Ay = { "@": "%40", "/": "%2F", "?": "%3F", "#": "%23", ":": "%3A" },
    My = /[@/?#:]/g,
    Ry = /[@/?#]/g;
  function wA($, J) {
    let U = J ? Ry : My;
    return ((U.lastIndex = 0), $.replace(U, (Q) => Ay[Q]));
  }
  function Zy($, J = !1) {
    if ($.indexOf("%") === -1) return $;
    let U = "";
    for (let Q = 0; Q < $.length; Q++) {
      if ($[Q] === "%" && Q + 2 < $.length) {
        let W = $.slice(Q + 1, Q + 3);
        if (kq(W)) {
          let X = W.toUpperCase(),
            Y = String.fromCharCode(parseInt(X, 16));
          if (J && EA(Y)) U += Y;
          else U += "%" + X;
          Q += 2;
          continue;
        }
      }
      U += $[Q];
    }
    return U;
  }
  function Py($) {
    let J = "";
    for (let U = 0; U < $.length; U++) {
      if ($[U] === "%" && U + 2 < $.length) {
        let Q = $.slice(U + 1, U + 3);
        if (kq(Q)) {
          let W = Q.toUpperCase(),
            X = String.fromCharCode(parseInt(W, 16));
          if (X !== "." && EA(X)) J += X;
          else J += "%" + W;
          U += 2;
          continue;
        }
      }
      if (Ey($[U])) J += $[U];
      else J += escape($[U]);
    }
    return J;
  }
  function _y($) {
    let J = "";
    for (let U = 0; U < $.length; U++) {
      if ($[U] === "%" && U + 2 < $.length) {
        let Q = $.slice(U + 1, U + 3);
        if (kq(Q)) {
          ((J += "%" + Q.toUpperCase()), (U += 2));
          continue;
        }
      }
      J += escape($[U]);
    }
    return J;
  }
  function Sy($) {
    let J = [];
    if ($.userinfo !== void 0) (J.push($.userinfo), J.push("@"));
    if ($.host !== void 0) {
      let U = unescape($.host);
      if (!BA(U)) {
        let Q = LA(U);
        if (Q.isIPV6 === !0) U = `[${Q.escapedHost}]`;
        else U = wA(U, !1);
      }
      J.push(U);
    }
    if (typeof $.port === "number" || typeof $.port === "string") (J.push(":"), J.push(String($.port)));
    return J.length ? J.join("") : void 0;
  }
  IA.exports = {
    nonSimpleDomain: Ly,
    recomposeAuthority: Sy,
    reescapeHostDelimiters: wA,
    normalizePercentEncoding: Zy,
    normalizePathEncoding: Py,
    escapePreservingEscapes: _y,
    removeDotSegments: ky,
    isIPv4: BA,
    isUUID: By,
    normalizeIPv6: LA,
    stringArrayToHexStripped: Aq,
  };
});
var RA = P$((X0$, MA) => {
  var { isUUID: Cy } = Mq(),
    Ty = /([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-.:;=@]|%[\da-f]{2})+)/iu,
    jy = ["http", "https", "ws", "wss", "urn", "urn:uuid"];
  function vy($) {
    return jy.indexOf($) !== -1;
  }
  function Rq($) {
    if ($.secure === !0) return !0;
    else if ($.secure === !1) return !1;
    else if ($.scheme)
      return (
        $.scheme.length === 3 &&
        ($.scheme[0] === "w" || $.scheme[0] === "W") &&
        ($.scheme[1] === "s" || $.scheme[1] === "S") &&
        ($.scheme[2] === "s" || $.scheme[2] === "S")
      );
    else return !1;
  }
  function VA($) {
    if (!$.host) $.error = $.error || "HTTP URIs must have a host.";
    return $;
  }
  function kA($) {
    let J = String($.scheme).toLowerCase() === "https";
    if ($.port === (J ? 443 : 80) || $.port === "") $.port = void 0;
    if (!$.path) $.path = "/";
    return $;
  }
  function by($) {
    return (
      ($.secure = Rq($)),
      ($.resourceName = ($.path || "/") + ($.query ? "?" + $.query : "")),
      ($.path = void 0),
      ($.query = void 0),
      $
    );
  }
  function fy($) {
    if ($.port === (Rq($) ? 443 : 80) || $.port === "") $.port = void 0;
    if (typeof $.secure === "boolean") (($.scheme = $.secure ? "wss" : "ws"), ($.secure = void 0));
    if ($.resourceName) {
      let [J, U] = $.resourceName.split("?");
      (($.path = J && J !== "/" ? J : void 0), ($.query = U), ($.resourceName = void 0));
    }
    return (($.fragment = void 0), $);
  }
  function yy($, J) {
    if (!$.path) return (($.error = "URN can not be parsed"), $);
    let U = $.path.match(Ty);
    if (U) {
      let Q = J.scheme || $.scheme || "urn";
      (($.nid = U[1].toLowerCase()), ($.nss = U[2]));
      let W = `${Q}:${J.nid || $.nid}`,
        X = Zq(W);
      if ((($.path = void 0), X)) $ = X.parse($, J);
    } else $.error = $.error || "URN can not be parsed.";
    return $;
  }
  function xy($, J) {
    if ($.nid === void 0) throw Error("URN without nid cannot be serialized");
    let U = J.scheme || $.scheme || "urn",
      Q = $.nid.toLowerCase(),
      W = `${U}:${J.nid || Q}`,
      X = Zq(W);
    if (X) $ = X.serialize($, J);
    let Y = $,
      D = $.nss;
    return ((Y.path = `${Q || J.nid}:${D}`), (J.skipEscape = !0), Y);
  }
  function gy($, J) {
    let U = $;
    if (((U.uuid = U.nss), (U.nss = void 0), !J.tolerant && (!U.uuid || !Cy(U.uuid))))
      U.error = U.error || "UUID is not valid.";
    return U;
  }
  function hy($) {
    let J = $;
    return ((J.nss = ($.uuid || "").toLowerCase()), J);
  }
  var AA = { scheme: "http", domainHost: !0, parse: VA, serialize: kA },
    uy = { scheme: "https", domainHost: AA.domainHost, parse: VA, serialize: kA },
    F5 = { scheme: "ws", domainHost: !0, parse: by, serialize: fy },
    ly = { scheme: "wss", domainHost: F5.domainHost, parse: F5.parse, serialize: F5.serialize },
    my = { scheme: "urn", parse: yy, serialize: xy, skipNormalize: !0 },
    py = { scheme: "urn:uuid", parse: gy, serialize: hy, skipNormalize: !0 },
    q5 = { http: AA, https: uy, ws: F5, wss: ly, urn: my, "urn:uuid": py };
  Object.setPrototypeOf(q5, null);
  function Zq($) {
    return ($ && (q5[$] || q5[$.toLowerCase()])) || void 0;
  }
  MA.exports = { wsIsSecure: Rq, SCHEMES: q5, isValidSchemeName: vy, getSchemeHandler: Zq };
});
var TA = P$((Y0$, z5) => {
  var {
      normalizeIPv6: dy,
      removeDotSegments: vQ,
      recomposeAuthority: cy,
      normalizePercentEncoding: ny,
      normalizePathEncoding: iy,
      escapePreservingEscapes: oy,
      reescapeHostDelimiters: ry,
      isIPv4: sy,
      nonSimpleDomain: ay,
    } = Mq(),
    { SCHEMES: ty, getSchemeHandler: PA } = RA();
  function ey($, J) {
    if (typeof $ === "string") $ = Qx($, J);
    else if (typeof $ === "object") $ = W1(_9($, J), J);
    return $;
  }
  function $x($, J, U) {
    let Q = U ? Object.assign({ scheme: "null" }, U) : { scheme: "null" },
      W = _A(W1($, Q), W1(J, Q), Q, !0);
    return ((Q.skipEscape = !0), _9(W, Q));
  }
  function _A($, J, U, Q) {
    let W = {};
    if (!Q) (($ = W1(_9($, U), U)), (J = W1(_9(J, U), U)));
    if (((U = U || {}), !U.tolerant && J.scheme))
      ((W.scheme = J.scheme),
        (W.userinfo = J.userinfo),
        (W.host = J.host),
        (W.port = J.port),
        (W.path = vQ(J.path || "")),
        (W.query = J.query));
    else {
      if (J.userinfo !== void 0 || J.host !== void 0 || J.port !== void 0)
        ((W.userinfo = J.userinfo),
          (W.host = J.host),
          (W.port = J.port),
          (W.path = vQ(J.path || "")),
          (W.query = J.query));
      else {
        if (!J.path)
          if (((W.path = $.path), J.query !== void 0)) W.query = J.query;
          else W.query = $.query;
        else {
          if (J.path[0] === "/") W.path = vQ(J.path);
          else {
            if (($.userinfo !== void 0 || $.host !== void 0 || $.port !== void 0) && !$.path) W.path = "/" + J.path;
            else if (!$.path) W.path = J.path;
            else W.path = $.path.slice(0, $.path.lastIndexOf("/") + 1) + J.path;
            W.path = vQ(W.path);
          }
          W.query = J.query;
        }
        ((W.userinfo = $.userinfo), (W.host = $.host), (W.port = $.port));
      }
      W.scheme = $.scheme;
    }
    return ((W.fragment = J.fragment), W);
  }
  function Jx($, J, U) {
    let Q = ZA($, U),
      W = ZA(J, U);
    return Q !== void 0 && W !== void 0 && Q.toLowerCase() === W.toLowerCase();
  }
  function _9($, J) {
    let U = {
        host: $.host,
        scheme: $.scheme,
        userinfo: $.userinfo,
        port: $.port,
        path: $.path,
        query: $.query,
        nid: $.nid,
        nss: $.nss,
        uuid: $.uuid,
        fragment: $.fragment,
        reference: $.reference,
        resourceName: $.resourceName,
        secure: $.secure,
        error: "",
      },
      Q = Object.assign({}, J),
      W = [],
      X = PA(Q.scheme || U.scheme);
    if (X && X.serialize) X.serialize(U, Q);
    if (U.path !== void 0)
      if (!Q.skipEscape) {
        if (((U.path = oy(U.path)), U.scheme !== void 0)) U.path = U.path.split("%3A").join(":");
      } else U.path = ny(U.path);
    if (Q.reference !== "suffix" && U.scheme) W.push(U.scheme, ":");
    let Y = cy(U);
    if (Y !== void 0) {
      if (Q.reference !== "suffix") W.push("//");
      if ((W.push(Y), U.path && U.path[0] !== "/")) W.push("/");
    }
    if (U.path !== void 0) {
      let D = U.path;
      if (!Q.absolutePath && (!X || !X.absolutePath)) D = vQ(D);
      if (Y === void 0 && D[0] === "/" && D[1] === "/") D = "/%2F" + D.slice(2);
      W.push(D);
    }
    if (U.query !== void 0) W.push("?", U.query);
    if (U.fragment !== void 0) W.push("#", U.fragment);
    return W.join("");
  }
  var Ux =
    /^(?:([^#/:?]+):)?(?:\/\/((?:([^#/?@]*)@)?(\[[^#/?\]]+\]|[^#/:?]*)(?::(\d*))?))?([^#?]*)(?:\?([^#]*))?(?:#((?:.|[\n\r])*))?/u;
  function Wx($, J) {
    if (J[2] !== void 0 && $.path && $.path[0] !== "/")
      return 'URI path must start with "/" when authority is present.';
    if (typeof $.port === "number" && ($.port < 0 || $.port > 65535)) return "URI port is malformed.";
    return;
  }
  function SA($, J) {
    let U = Object.assign({}, J),
      Q = { scheme: void 0, userinfo: void 0, host: "", port: void 0, path: "", query: void 0, fragment: void 0 },
      W = !1,
      X = !1;
    if (U.reference === "suffix")
      if (U.scheme) $ = U.scheme + ":" + $;
      else $ = "//" + $;
    let Y = $.match(Ux);
    if (Y) {
      if (
        ((Q.scheme = Y[1]),
        (Q.userinfo = Y[3]),
        (Q.host = Y[4]),
        (Q.port = parseInt(Y[5], 10)),
        (Q.path = Y[6] || ""),
        (Q.query = Y[7]),
        (Q.fragment = Y[8]),
        isNaN(Q.port))
      )
        Q.port = Y[5];
      let D = Wx(Q, Y);
      if (D !== void 0) ((Q.error = Q.error || D), (W = !0));
      if (Q.host)
        if (sy(Q.host) === !1) {
          let K = dy(Q.host);
          ((Q.host = K.host.toLowerCase()), (X = K.isIPV6));
        } else X = !0;
      if (
        Q.scheme === void 0 &&
        Q.userinfo === void 0 &&
        Q.host === void 0 &&
        Q.port === void 0 &&
        Q.query === void 0 &&
        !Q.path
      )
        Q.reference = "same-document";
      else if (Q.scheme === void 0) Q.reference = "relative";
      else if (Q.fragment === void 0) Q.reference = "absolute";
      else Q.reference = "uri";
      if (U.reference && U.reference !== "suffix" && U.reference !== Q.reference)
        Q.error = Q.error || "URI is not a " + U.reference + " reference.";
      let H = PA(U.scheme || Q.scheme);
      if (!U.unicodeSupport && (!H || !H.unicodeSupport)) {
        if (Q.host && (U.domainHost || (H && H.domainHost)) && X === !1 && ay(Q.host))
          try {
            Q.host = new URL("http://" + Q.host).hostname;
          } catch (G) {
            Q.error = Q.error || "Host's domain name can not be converted to ASCII: " + G;
          }
      }
      if (!H || (H && !H.skipNormalize)) {
        if ($.indexOf("%") !== -1) {
          if (Q.scheme !== void 0) Q.scheme = unescape(Q.scheme);
          if (Q.host !== void 0) Q.host = ry(unescape(Q.host), X);
        }
        if (Q.path) Q.path = iy(Q.path);
        if (Q.fragment)
          try {
            Q.fragment = encodeURI(decodeURIComponent(Q.fragment));
          } catch {
            Q.error = Q.error || "URI malformed";
          }
      }
      if (H && H.parse) H.parse(Q, U);
    } else Q.error = Q.error || "URI can not be parsed.";
    return { parsed: Q, malformedAuthorityOrPort: W };
  }
  function W1($, J) {
    return SA($, J).parsed;
  }
  function Qx($, J) {
    return CA($, J).normalized;
  }
  function CA($, J) {
    let { parsed: U, malformedAuthorityOrPort: Q } = SA($, J);
    return { normalized: Q ? $ : _9(U, J), malformedAuthorityOrPort: Q };
  }
  function ZA($, J) {
    if (typeof $ === "string") {
      let { normalized: U, malformedAuthorityOrPort: Q } = CA($, J);
      return Q ? void 0 : U;
    }
    if (typeof $ === "object") return _9($, J);
  }
  var Pq = { SCHEMES: ty, normalize: ey, resolve: $x, resolveComponent: _A, equal: Jx, serialize: _9, parse: W1 };
  z5.exports = Pq;
  z5.exports.default = Pq;
  z5.exports.fastUri = Pq;
});
var bA = P$((vA) => {
  Object.defineProperty(vA, "__esModule", { value: !0 });
  var jA = TA();
  jA.code = 'require("ajv/dist/runtime/uri").default';
  vA.default = jA;
});
var mA = P$((aU) => {
  Object.defineProperty(aU, "__esModule", { value: !0 });
  aU.CodeGen = aU.Name = aU.nil = aU.stringify = aU.str = aU._ = aU.KeywordCxt = void 0;
  var Yx = CQ();
  Object.defineProperty(aU, "KeywordCxt", {
    enumerable: !0,
    get: function () {
      return Yx.KeywordCxt;
    },
  });
  var Q1 = q6();
  Object.defineProperty(aU, "_", {
    enumerable: !0,
    get: function () {
      return Q1._;
    },
  });
  Object.defineProperty(aU, "str", {
    enumerable: !0,
    get: function () {
      return Q1.str;
    },
  });
  Object.defineProperty(aU, "stringify", {
    enumerable: !0,
    get: function () {
      return Q1.stringify;
    },
  });
  Object.defineProperty(aU, "nil", {
    enumerable: !0,
    get: function () {
      return Q1.nil;
    },
  });
  Object.defineProperty(aU, "Name", {
    enumerable: !0,
    get: function () {
      return Q1.Name;
    },
  });
  Object.defineProperty(aU, "CodeGen", {
    enumerable: !0,
    get: function () {
      return Q1.CodeGen;
    },
  });
  var Dx = K5(),
    hA = TQ(),
    Hx = Xq(),
    bQ = O5(),
    Gx = q6(),
    fQ = PQ(),
    B5 = ZQ(),
    Sq = C6(),
    fA = qA(),
    Kx = bA(),
    uA = ($, J) => new RegExp($, J);
  uA.code = "new RegExp";
  var Nx = ["removeAdditional", "useDefaults", "coerceTypes"],
    Ox = new Set([
      "validate",
      "serialize",
      "parse",
      "wrapper",
      "root",
      "schema",
      "keyword",
      "pattern",
      "formats",
      "validate$data",
      "func",
      "obj",
      "Error",
    ]),
    Fx = {
      errorDataPath: "",
      format: "`validateFormats: false` can be used instead.",
      nullable: '"nullable" keyword is supported by default.',
      jsonPointers: "Deprecated jsPropertySyntax can be used instead.",
      extendRefs: "Deprecated ignoreKeywordsWithRef can be used instead.",
      missingRefs: "Pass empty schema with $id that should be ignored to ajv.addSchema.",
      processCode: "Use option `code: {process: (code, schemaEnv: object) => string}`",
      sourceCode: "Use option `code: {source: true}`",
      strictDefaults: "It is default now, see option `strict`.",
      strictKeywords: "It is default now, see option `strict`.",
      uniqueItems: '"uniqueItems" keyword is always validated.',
      unknownFormats: "Disable strict mode or pass `true` to `ajv.addFormat` (or `formats` option).",
      cache: "Map is used as cache, schema object as key.",
      serialize: "Map is used as cache, schema object as key.",
      ajvErrors: "It is default now.",
    },
    qx = {
      ignoreKeywordsWithRef: "",
      jsPropertySyntax: "",
      unicode: '"minLength"/"maxLength" account for unicode characters by default.',
    },
    yA = 200;
  function zx($) {
    var J, U, Q, W, X, Y, D, H, G, K, O, N, F, B, E, z, q, L, V, k, R, _, S, w, M;
    let m = $.strict,
      P = (J = $.code) === null || J === void 0 ? void 0 : J.optimize,
      u = P === !0 || P === void 0 ? 1 : P || 0,
      n = (Q = (U = $.code) === null || U === void 0 ? void 0 : U.regExp) !== null && Q !== void 0 ? Q : uA,
      b = (W = $.uriResolver) !== null && W !== void 0 ? W : Kx.default;
    return {
      strictSchema: (Y = (X = $.strictSchema) !== null && X !== void 0 ? X : m) !== null && Y !== void 0 ? Y : !0,
      strictNumbers: (H = (D = $.strictNumbers) !== null && D !== void 0 ? D : m) !== null && H !== void 0 ? H : !0,
      strictTypes: (K = (G = $.strictTypes) !== null && G !== void 0 ? G : m) !== null && K !== void 0 ? K : "log",
      strictTuples: (N = (O = $.strictTuples) !== null && O !== void 0 ? O : m) !== null && N !== void 0 ? N : "log",
      strictRequired: (B = (F = $.strictRequired) !== null && F !== void 0 ? F : m) !== null && B !== void 0 ? B : !1,
      code: $.code ? { ...$.code, optimize: u, regExp: n } : { optimize: u, regExp: n },
      loopRequired: (E = $.loopRequired) !== null && E !== void 0 ? E : yA,
      loopEnum: (z = $.loopEnum) !== null && z !== void 0 ? z : yA,
      meta: (q = $.meta) !== null && q !== void 0 ? q : !0,
      messages: (L = $.messages) !== null && L !== void 0 ? L : !0,
      inlineRefs: (V = $.inlineRefs) !== null && V !== void 0 ? V : !0,
      schemaId: (k = $.schemaId) !== null && k !== void 0 ? k : "$id",
      addUsedSchema: (R = $.addUsedSchema) !== null && R !== void 0 ? R : !0,
      validateSchema: (_ = $.validateSchema) !== null && _ !== void 0 ? _ : !0,
      validateFormats: (S = $.validateFormats) !== null && S !== void 0 ? S : !0,
      unicodeRegExp: (w = $.unicodeRegExp) !== null && w !== void 0 ? w : !0,
      int32range: (M = $.int32range) !== null && M !== void 0 ? M : !0,
      uriResolver: b,
    };
  }
  class E5 {
    constructor($ = {}) {
      ((this.schemas = {}),
        (this.refs = {}),
        (this.formats = Object.create(null)),
        (this._compilations = new Set()),
        (this._loading = {}),
        (this._cache = new Map()),
        ($ = this.opts = { ...$, ...zx($) }));
      let { es5: J, lines: U } = this.opts.code;
      ((this.scope = new Gx.ValueScope({ scope: {}, prefixes: Ox, es5: J, lines: U })), (this.logger = Vx($.logger)));
      let Q = $.validateFormats;
      if (
        (($.validateFormats = !1),
        (this.RULES = (0, Hx.getRules)()),
        xA.call(this, Fx, $, "NOT SUPPORTED"),
        xA.call(this, qx, $, "DEPRECATED", "warn"),
        (this._metaOpts = wx.call(this)),
        $.formats)
      )
        Ex.call(this);
      if ((this._addVocabularies(), this._addDefaultMetaSchema(), $.keywords)) Lx.call(this, $.keywords);
      if (typeof $.meta == "object") this.addMetaSchema($.meta);
      (Bx.call(this), ($.validateFormats = Q));
    }
    _addVocabularies() {
      this.addKeyword("$async");
    }
    _addDefaultMetaSchema() {
      let { $data: $, meta: J, schemaId: U } = this.opts,
        Q = fA;
      if (U === "id") ((Q = { ...fA }), (Q.id = Q.$id), delete Q.$id);
      if (J && $) this.addMetaSchema(Q, Q[U], !1);
    }
    defaultMeta() {
      let { meta: $, schemaId: J } = this.opts;
      return (this.opts.defaultMeta = typeof $ == "object" ? $[J] || $ : void 0);
    }
    validate($, J) {
      let U;
      if (typeof $ == "string") {
        if (((U = this.getSchema($)), !U)) throw Error(`no schema with key or ref "${$}"`);
      } else U = this.compile($);
      let Q = U(J);
      if (!("$async" in U)) this.errors = U.errors;
      return Q;
    }
    compile($, J) {
      let U = this._addSchema($, J);
      return U.validate || this._compileSchemaEnv(U);
    }
    compileAsync($, J) {
      if (typeof this.opts.loadSchema != "function") throw Error("options.loadSchema should be a function");
      let { loadSchema: U } = this.opts;
      return Q.call(this, $, J);
      async function Q(G, K) {
        await W.call(this, G.$schema);
        let O = this._addSchema(G, K);
        return O.validate || X.call(this, O);
      }
      async function W(G) {
        if (G && !this.getSchema(G)) await Q.call(this, { $ref: G }, !0);
      }
      async function X(G) {
        try {
          return this._compileSchemaEnv(G);
        } catch (K) {
          if (!(K instanceof hA.default)) throw K;
          return (Y.call(this, K), await D.call(this, K.missingSchema), X.call(this, G));
        }
      }
      function Y({ missingSchema: G, missingRef: K }) {
        if (this.refs[G]) throw Error(`AnySchema ${G} is loaded but ${K} cannot be resolved`);
      }
      async function D(G) {
        let K = await H.call(this, G);
        if (!this.refs[G]) await W.call(this, K.$schema);
        if (!this.refs[G]) this.addSchema(K, G, J);
      }
      async function H(G) {
        let K = this._loading[G];
        if (K) return K;
        try {
          return await (this._loading[G] = U(G));
        } finally {
          delete this._loading[G];
        }
      }
    }
    addSchema($, J, U, Q = this.opts.validateSchema) {
      if (Array.isArray($)) {
        for (let X of $) this.addSchema(X, void 0, U, Q);
        return this;
      }
      let W;
      if (typeof $ === "object") {
        let { schemaId: X } = this.opts;
        if (((W = $[X]), W !== void 0 && typeof W != "string")) throw Error(`schema ${X} must be string`);
      }
      return (
        (J = (0, fQ.normalizeId)(J || W)),
        this._checkUnique(J),
        (this.schemas[J] = this._addSchema($, U, J, Q, !0)),
        this
      );
    }
    addMetaSchema($, J, U = this.opts.validateSchema) {
      return (this.addSchema($, J, !0, U), this);
    }
    validateSchema($, J) {
      if (typeof $ == "boolean") return !0;
      let U;
      if (((U = $.$schema), U !== void 0 && typeof U != "string")) throw Error("$schema must be a string");
      if (((U = U || this.opts.defaultMeta || this.defaultMeta()), !U))
        return (this.logger.warn("meta-schema not available"), (this.errors = null), !0);
      let Q = this.validate(U, $);
      if (!Q && J) {
        let W = "schema is invalid: " + this.errorsText();
        if (this.opts.validateSchema === "log") this.logger.error(W);
        else throw Error(W);
      }
      return Q;
    }
    getSchema($) {
      let J;
      while (typeof (J = gA.call(this, $)) == "string") $ = J;
      if (J === void 0) {
        let { schemaId: U } = this.opts,
          Q = new bQ.SchemaEnv({ schema: {}, schemaId: U });
        if (((J = bQ.resolveSchema.call(this, Q, $)), !J)) return;
        this.refs[$] = J;
      }
      return J.validate || this._compileSchemaEnv(J);
    }
    removeSchema($) {
      if ($ instanceof RegExp)
        return (this._removeAllSchemas(this.schemas, $), this._removeAllSchemas(this.refs, $), this);
      switch (typeof $) {
        case "undefined":
          return (this._removeAllSchemas(this.schemas), this._removeAllSchemas(this.refs), this._cache.clear(), this);
        case "string": {
          let J = gA.call(this, $);
          if (typeof J == "object") this._cache.delete(J.schema);
          return (delete this.schemas[$], delete this.refs[$], this);
        }
        case "object": {
          let J = $;
          this._cache.delete(J);
          let U = $[this.opts.schemaId];
          if (U) ((U = (0, fQ.normalizeId)(U)), delete this.schemas[U], delete this.refs[U]);
          return this;
        }
        default:
          throw Error("ajv.removeSchema: invalid parameter");
      }
    }
    addVocabulary($) {
      for (let J of $) this.addKeyword(J);
      return this;
    }
    addKeyword($, J) {
      let U;
      if (typeof $ == "string") {
        if (((U = $), typeof J == "object"))
          (this.logger.warn("these parameters are deprecated, see docs for addKeyword"), (J.keyword = U));
      } else if (typeof $ == "object" && J === void 0) {
        if (((J = $), (U = J.keyword), Array.isArray(U) && !U.length))
          throw Error("addKeywords: keyword must be string or non-empty array");
      } else throw Error("invalid addKeywords parameters");
      if ((Ax.call(this, U, J), !J)) return ((0, Sq.eachItem)(U, (W) => _q.call(this, W)), this);
      Rx.call(this, J);
      let Q = { ...J, type: (0, B5.getJSONTypes)(J.type), schemaType: (0, B5.getJSONTypes)(J.schemaType) };
      return (
        (0, Sq.eachItem)(
          U,
          Q.type.length === 0 ? (W) => _q.call(this, W, Q) : (W) => Q.type.forEach((X) => _q.call(this, W, Q, X)),
        ),
        this
      );
    }
    getKeyword($) {
      let J = this.RULES.all[$];
      return typeof J == "object" ? J.definition : !!J;
    }
    removeKeyword($) {
      let { RULES: J } = this;
      (delete J.keywords[$], delete J.all[$]);
      for (let U of J.rules) {
        let Q = U.rules.findIndex((W) => W.keyword === $);
        if (Q >= 0) U.rules.splice(Q, 1);
      }
      return this;
    }
    addFormat($, J) {
      if (typeof J == "string") J = new RegExp(J);
      return ((this.formats[$] = J), this);
    }
    errorsText($ = this.errors, { separator: J = ", ", dataVar: U = "data" } = {}) {
      if (!$ || $.length === 0) return "No errors";
      return $.map((Q) => `${U}${Q.instancePath} ${Q.message}`).reduce((Q, W) => Q + J + W);
    }
    $dataMetaSchema($, J) {
      let U = this.RULES.all;
      $ = JSON.parse(JSON.stringify($));
      for (let Q of J) {
        let W = Q.split("/").slice(1),
          X = $;
        for (let Y of W) X = X[Y];
        for (let Y in U) {
          let D = U[Y];
          if (typeof D != "object") continue;
          let { $data: H } = D.definition,
            G = X[Y];
          if (H && G) X[Y] = lA(G);
        }
      }
      return $;
    }
    _removeAllSchemas($, J) {
      for (let U in $) {
        let Q = $[U];
        if (!J || J.test(U)) {
          if (typeof Q == "string") delete $[U];
          else if (Q && !Q.meta) (this._cache.delete(Q.schema), delete $[U]);
        }
      }
    }
    _addSchema($, J, U, Q = this.opts.validateSchema, W = this.opts.addUsedSchema) {
      let X,
        { schemaId: Y } = this.opts;
      if (typeof $ == "object") X = $[Y];
      else if (this.opts.jtd) throw Error("schema must be object");
      else if (typeof $ != "boolean") throw Error("schema must be object or boolean");
      let D = this._cache.get($);
      if (D !== void 0) return D;
      U = (0, fQ.normalizeId)(X || U);
      let H = fQ.getSchemaRefs.call(this, $, U);
      if (
        ((D = new bQ.SchemaEnv({ schema: $, schemaId: Y, meta: J, baseId: U, localRefs: H })),
        this._cache.set(D.schema, D),
        W && !U.startsWith("#"))
      ) {
        if (U) this._checkUnique(U);
        this.refs[U] = D;
      }
      if (Q) this.validateSchema($, !0);
      return D;
    }
    _checkUnique($) {
      if (this.schemas[$] || this.refs[$]) throw Error(`schema with key or id "${$}" already exists`);
    }
    _compileSchemaEnv($) {
      if ($.meta) this._compileMetaSchema($);
      else bQ.compileSchema.call(this, $);
      if (!$.validate) throw Error("ajv implementation error");
      return $.validate;
    }
    _compileMetaSchema($) {
      let J = this.opts;
      this.opts = this._metaOpts;
      try {
        bQ.compileSchema.call(this, $);
      } finally {
        this.opts = J;
      }
    }
  }
  E5.ValidationError = Dx.default;
  E5.MissingRefError = hA.default;
  aU.default = E5;
  function xA($, J, U, Q = "error") {
    for (let W in $) {
      let X = W;
      if (X in J) this.logger[Q](`${U}: option ${W}. ${$[X]}`);
    }
  }
  function gA($) {
    return (($ = (0, fQ.normalizeId)($)), this.schemas[$] || this.refs[$]);
  }
  function Bx() {
    let $ = this.opts.schemas;
    if (!$) return;
    if (Array.isArray($)) this.addSchema($);
    else for (let J in $) this.addSchema($[J], J);
  }
  function Ex() {
    for (let $ in this.opts.formats) {
      let J = this.opts.formats[$];
      if (J) this.addFormat($, J);
    }
  }
  function Lx($) {
    if (Array.isArray($)) {
      this.addVocabulary($);
      return;
    }
    this.logger.warn("keywords option as map is deprecated, pass array");
    for (let J in $) {
      let U = $[J];
      if (!U.keyword) U.keyword = J;
      this.addKeyword(U);
    }
  }
  function wx() {
    let $ = { ...this.opts };
    for (let J of Nx) delete $[J];
    return $;
  }
  var Ix = { log() {}, warn() {}, error() {} };
  function Vx($) {
    if ($ === !1) return Ix;
    if ($ === void 0) return console;
    if ($.log && $.warn && $.error) return $;
    throw Error("logger must implement log, warn and error methods");
  }
  var kx = /^[a-z_$][a-z0-9_$:-]*$/i;
  function Ax($, J) {
    let { RULES: U } = this;
    if (
      ((0, Sq.eachItem)($, (Q) => {
        if (U.keywords[Q]) throw Error(`Keyword ${Q} is already defined`);
        if (!kx.test(Q)) throw Error(`Keyword ${Q} has invalid name`);
      }),
      !J)
    )
      return;
    if (J.$data && !("code" in J || "validate" in J))
      throw Error('$data keyword must have "code" or "validate" function');
  }
  function _q($, J, U) {
    var Q;
    let W = J === null || J === void 0 ? void 0 : J.post;
    if (U && W) throw Error('keyword with "post" flag cannot have "type"');
    let { RULES: X } = this,
      Y = W ? X.post : X.rules.find(({ type: H }) => H === U);
    if (!Y) ((Y = { type: U, rules: [] }), X.rules.push(Y));
    if (((X.keywords[$] = !0), !J)) return;
    let D = {
      keyword: $,
      definition: { ...J, type: (0, B5.getJSONTypes)(J.type), schemaType: (0, B5.getJSONTypes)(J.schemaType) },
    };
    if (J.before) Mx.call(this, Y, D, J.before);
    else Y.rules.push(D);
    ((X.all[$] = D), (Q = J.implements) === null || Q === void 0 || Q.forEach((H) => this.addKeyword(H)));
  }
  function Mx($, J, U) {
    let Q = $.rules.findIndex((W) => W.keyword === U);
    if (Q >= 0) $.rules.splice(Q, 0, J);
    else ($.rules.push(J), this.logger.warn(`rule ${U} is not defined`));
  }
  function Rx($) {
    let { metaSchema: J } = $;
    if (J === void 0) return;
    if ($.$data && this.opts.$data) J = lA(J);
    $.validateSchema = this.compile(J, !0);
  }
  var Zx = { $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#" };
  function lA($) {
    return { anyOf: [$, Zx] };
  }
});
var dA = P$((pA) => {
  Object.defineProperty(pA, "__esModule", { value: !0 });
  var Sx = {
    keyword: "id",
    code() {
      throw Error('NOT SUPPORTED: keyword "id", use "$id" for schema ID');
    },
  };
  pA.default = Sx;
});
var sA = P$((oA) => {
  Object.defineProperty(oA, "__esModule", { value: !0 });
  oA.callRef = oA.getValidate = void 0;
  var Tx = TQ(),
    cA = uJ(),
    IJ = q6(),
    X1 = rU(),
    nA = O5(),
    L5 = C6(),
    jx = {
      keyword: "$ref",
      schemaType: "string",
      code($) {
        let { gen: J, schema: U, it: Q } = $,
          { baseId: W, schemaEnv: X, validateName: Y, opts: D, self: H } = Q,
          { root: G } = X;
        if ((U === "#" || U === "#/") && W === G.baseId) return O();
        let K = nA.resolveRef.call(H, G, W, U);
        if (K === void 0) throw new Tx.default(Q.opts.uriResolver, W, U);
        if (K instanceof nA.SchemaEnv) return N(K);
        return F(K);
        function O() {
          if (X === G) return w5($, Y, X, X.$async);
          let B = J.scopeValue("root", { ref: G });
          return w5($, IJ._`${B}.validate`, G, G.$async);
        }
        function N(B) {
          let E = iA($, B);
          w5($, E, B, B.$async);
        }
        function F(B) {
          let E = J.scopeValue("schema", D.code.source === !0 ? { ref: B, code: (0, IJ.stringify)(B) } : { ref: B }),
            z = J.name("valid"),
            q = $.subschema({ schema: B, dataTypes: [], schemaPath: IJ.nil, topSchemaRef: E, errSchemaPath: U }, z);
          ($.mergeEvaluated(q), $.ok(z));
        }
      },
    };
  function iA($, J) {
    let { gen: U } = $;
    return J.validate
      ? U.scopeValue("validate", { ref: J.validate })
      : IJ._`${U.scopeValue("wrapper", { ref: J })}.validate`;
  }
  oA.getValidate = iA;
  function w5($, J, U, Q) {
    let { gen: W, it: X } = $,
      { allErrors: Y, schemaEnv: D, opts: H } = X,
      G = H.passContext ? X1.default.this : IJ.nil;
    if (Q) K();
    else O();
    function K() {
      if (!D.$async) throw Error("async schema referenced by sync schema");
      let B = W.let("valid");
      (W.try(
        () => {
          if ((W.code(IJ._`await ${(0, cA.callValidateCode)($, J, G)}`), F(J), !Y)) W.assign(B, !0);
        },
        (E) => {
          if ((W.if(IJ._`!(${E} instanceof ${X.ValidationError})`, () => W.throw(E)), N(E), !Y)) W.assign(B, !1);
        },
      ),
        $.ok(B));
    }
    function O() {
      $.result(
        (0, cA.callValidateCode)($, J, G),
        () => F(J),
        () => N(J),
      );
    }
    function N(B) {
      let E = IJ._`${B}.errors`;
      (W.assign(X1.default.vErrors, IJ._`${X1.default.vErrors} === null ? ${E} : ${X1.default.vErrors}.concat(${E})`),
        W.assign(X1.default.errors, IJ._`${X1.default.vErrors}.length`));
    }
    function F(B) {
      var E;
      if (!X.opts.unevaluated) return;
      let z = (E = U === null || U === void 0 ? void 0 : U.validate) === null || E === void 0 ? void 0 : E.evaluated;
      if (X.props !== !0)
        if (z && !z.dynamicProps) {
          if (z.props !== void 0) X.props = L5.mergeEvaluated.props(W, z.props, X.props);
        } else {
          let q = W.var("props", IJ._`${B}.evaluated.props`);
          X.props = L5.mergeEvaluated.props(W, q, X.props, IJ.Name);
        }
      if (X.items !== !0)
        if (z && !z.dynamicItems) {
          if (z.items !== void 0) X.items = L5.mergeEvaluated.items(W, z.items, X.items);
        } else {
          let q = W.var("items", IJ._`${B}.evaluated.items`);
          X.items = L5.mergeEvaluated.items(W, q, X.items, IJ.Name);
        }
    }
  }
  oA.callRef = w5;
  oA.default = jx;
});
var tA = P$((aA) => {
  Object.defineProperty(aA, "__esModule", { value: !0 });
  var fx = dA(),
    yx = sA(),
    xx = ["$schema", "$id", "$defs", "$vocabulary", { keyword: "$comment" }, "definitions", fx.default, yx.default];
  aA.default = xx;
});
var $M = P$((eA) => {
  Object.defineProperty(eA, "__esModule", { value: !0 });
  var I5 = q6(),
    x8 = I5.operators,
    V5 = {
      maximum: { okStr: "<=", ok: x8.LTE, fail: x8.GT },
      minimum: { okStr: ">=", ok: x8.GTE, fail: x8.LT },
      exclusiveMaximum: { okStr: "<", ok: x8.LT, fail: x8.GTE },
      exclusiveMinimum: { okStr: ">", ok: x8.GT, fail: x8.LTE },
    },
    hx = {
      message: ({ keyword: $, schemaCode: J }) => I5.str`must be ${V5[$].okStr} ${J}`,
      params: ({ keyword: $, schemaCode: J }) => I5._`{comparison: ${V5[$].okStr}, limit: ${J}}`,
    },
    ux = {
      keyword: Object.keys(V5),
      type: "number",
      schemaType: "number",
      $data: !0,
      error: hx,
      code($) {
        let { keyword: J, data: U, schemaCode: Q } = $;
        $.fail$data(I5._`${U} ${V5[J].fail} ${Q} || isNaN(${U})`);
      },
    };
  eA.default = ux;
});
var UM = P$((JM) => {
  Object.defineProperty(JM, "__esModule", { value: !0 });
  var yQ = q6(),
    mx = {
      message: ({ schemaCode: $ }) => yQ.str`must be multiple of ${$}`,
      params: ({ schemaCode: $ }) => yQ._`{multipleOf: ${$}}`,
    },
    px = {
      keyword: "multipleOf",
      type: "number",
      schemaType: "number",
      $data: !0,
      error: mx,
      code($) {
        let { gen: J, data: U, schemaCode: Q, it: W } = $,
          X = W.opts.multipleOfPrecision,
          Y = J.let("res"),
          D = X ? yQ._`Math.abs(Math.round(${Y}) - ${Y}) > 1e-${X}` : yQ._`${Y} !== parseInt(${Y})`;
        $.fail$data(yQ._`(${Q} === 0 || (${Y} = ${U}/${Q}, ${D}))`);
      },
    };
  JM.default = px;
});
var XM = P$((QM) => {
  Object.defineProperty(QM, "__esModule", { value: !0 });
  function WM($) {
    let J = $.length,
      U = 0,
      Q = 0,
      W;
    while (Q < J)
      if ((U++, (W = $.charCodeAt(Q++)), W >= 55296 && W <= 56319 && Q < J)) {
        if (((W = $.charCodeAt(Q)), (W & 64512) === 56320)) Q++;
      }
    return U;
  }
  QM.default = WM;
  WM.code = 'require("ajv/dist/runtime/ucs2length").default';
});
var DM = P$((YM) => {
  Object.defineProperty(YM, "__esModule", { value: !0 });
  var S9 = q6(),
    nx = C6(),
    ix = XM(),
    ox = {
      message({ keyword: $, schemaCode: J }) {
        let U = $ === "maxLength" ? "more" : "fewer";
        return S9.str`must NOT have ${U} than ${J} characters`;
      },
      params: ({ schemaCode: $ }) => S9._`{limit: ${$}}`,
    },
    rx = {
      keyword: ["maxLength", "minLength"],
      type: "string",
      schemaType: "number",
      $data: !0,
      error: ox,
      code($) {
        let { keyword: J, data: U, schemaCode: Q, it: W } = $,
          X = J === "maxLength" ? S9.operators.GT : S9.operators.LT,
          Y = W.opts.unicode === !1 ? S9._`${U}.length` : S9._`${(0, nx.useFunc)($.gen, ix.default)}(${U})`;
        $.fail$data(S9._`${Y} ${X} ${Q}`);
      },
    };
  YM.default = rx;
});
var GM = P$((HM) => {
  Object.defineProperty(HM, "__esModule", { value: !0 });
  var ax = uJ(),
    tx = C6(),
    Y1 = q6(),
    ex = {
      message: ({ schemaCode: $ }) => Y1.str`must match pattern "${$}"`,
      params: ({ schemaCode: $ }) => Y1._`{pattern: ${$}}`,
    },
    $g = {
      keyword: "pattern",
      type: "string",
      schemaType: "string",
      $data: !0,
      error: ex,
      code($) {
        let { gen: J, data: U, $data: Q, schema: W, schemaCode: X, it: Y } = $,
          D = Y.opts.unicodeRegExp ? "u" : "";
        if (Q) {
          let { regExp: H } = Y.opts.code,
            G = H.code === "new RegExp" ? Y1._`new RegExp` : (0, tx.useFunc)(J, H),
            K = J.let("valid");
          (J.try(
            () => J.assign(K, Y1._`${G}(${X}, ${D}).test(${U})`),
            () => J.assign(K, !1),
          ),
            $.fail$data(Y1._`!${K}`));
        } else {
          let H = (0, ax.usePattern)($, W);
          $.fail$data(Y1._`!${H}.test(${U})`);
        }
      },
    };
  HM.default = $g;
});
var NM = P$((KM) => {
  Object.defineProperty(KM, "__esModule", { value: !0 });
  var xQ = q6(),
    Ug = {
      message({ keyword: $, schemaCode: J }) {
        let U = $ === "maxProperties" ? "more" : "fewer";
        return xQ.str`must NOT have ${U} than ${J} properties`;
      },
      params: ({ schemaCode: $ }) => xQ._`{limit: ${$}}`,
    },
    Wg = {
      keyword: ["maxProperties", "minProperties"],
      type: "object",
      schemaType: "number",
      $data: !0,
      error: Ug,
      code($) {
        let { keyword: J, data: U, schemaCode: Q } = $,
          W = J === "maxProperties" ? xQ.operators.GT : xQ.operators.LT;
        $.fail$data(xQ._`Object.keys(${U}).length ${W} ${Q}`);
      },
    };
  KM.default = Wg;
});
var FM = P$((OM) => {
  Object.defineProperty(OM, "__esModule", { value: !0 });
  var gQ = uJ(),
    hQ = q6(),
    Xg = C6(),
    Yg = {
      message: ({ params: { missingProperty: $ } }) => hQ.str`must have required property '${$}'`,
      params: ({ params: { missingProperty: $ } }) => hQ._`{missingProperty: ${$}}`,
    },
    Dg = {
      keyword: "required",
      type: "object",
      schemaType: "array",
      $data: !0,
      error: Yg,
      code($) {
        let { gen: J, schema: U, schemaCode: Q, data: W, $data: X, it: Y } = $,
          { opts: D } = Y;
        if (!X && U.length === 0) return;
        let H = U.length >= D.loopRequired;
        if (Y.allErrors) G();
        else K();
        if (D.strictRequired) {
          let F = $.parentSchema.properties,
            { definedProperties: B } = $.it;
          for (let E of U)
            if ((F === null || F === void 0 ? void 0 : F[E]) === void 0 && !B.has(E)) {
              let z = Y.schemaEnv.baseId + Y.errSchemaPath,
                q = `required property "${E}" is not defined at "${z}" (strictRequired)`;
              (0, Xg.checkStrictMode)(Y, q, Y.opts.strictRequired);
            }
        }
        function G() {
          if (H || X) $.block$data(hQ.nil, O);
          else for (let F of U) (0, gQ.checkReportMissingProp)($, F);
        }
        function K() {
          let F = J.let("missing");
          if (H || X) {
            let B = J.let("valid", !0);
            ($.block$data(B, () => N(F, B)), $.ok(B));
          } else (J.if((0, gQ.checkMissingProp)($, U, F)), (0, gQ.reportMissingProp)($, F), J.else());
        }
        function O() {
          J.forOf("prop", Q, (F) => {
            ($.setParams({ missingProperty: F }),
              J.if((0, gQ.noPropertyInData)(J, W, F, D.ownProperties), () => $.error()));
          });
        }
        function N(F, B) {
          ($.setParams({ missingProperty: F }),
            J.forOf(
              F,
              Q,
              () => {
                (J.assign(B, (0, gQ.propertyInData)(J, W, F, D.ownProperties)),
                  J.if((0, hQ.not)(B), () => {
                    ($.error(), J.break());
                  }));
              },
              hQ.nil,
            ));
        }
      },
    };
  OM.default = Dg;
});
var zM = P$((qM) => {
  Object.defineProperty(qM, "__esModule", { value: !0 });
  var uQ = q6(),
    Gg = {
      message({ keyword: $, schemaCode: J }) {
        let U = $ === "maxItems" ? "more" : "fewer";
        return uQ.str`must NOT have ${U} than ${J} items`;
      },
      params: ({ schemaCode: $ }) => uQ._`{limit: ${$}}`,
    },
    Kg = {
      keyword: ["maxItems", "minItems"],
      type: "array",
      schemaType: "number",
      $data: !0,
      error: Gg,
      code($) {
        let { keyword: J, data: U, schemaCode: Q } = $,
          W = J === "maxItems" ? uQ.operators.GT : uQ.operators.LT;
        $.fail$data(uQ._`${U}.length ${W} ${Q}`);
      },
    };
  qM.default = Kg;
});
var k5 = P$((EM) => {
  Object.defineProperty(EM, "__esModule", { value: !0 });
  var BM = Fq();
  BM.code = 'require("ajv/dist/runtime/equal").default';
  EM.default = BM;
});
var wM = P$((LM) => {
  Object.defineProperty(LM, "__esModule", { value: !0 });
  var Cq = ZQ(),
    u0 = q6(),
    Fg = C6(),
    qg = k5(),
    zg = {
      message: ({ params: { i: $, j: J } }) =>
        u0.str`must NOT have duplicate items (items ## ${J} and ${$} are identical)`,
      params: ({ params: { i: $, j: J } }) => u0._`{i: ${$}, j: ${J}}`,
    },
    Bg = {
      keyword: "uniqueItems",
      type: "array",
      schemaType: "boolean",
      $data: !0,
      error: zg,
      code($) {
        let { gen: J, data: U, $data: Q, schema: W, parentSchema: X, schemaCode: Y, it: D } = $;
        if (!Q && !W) return;
        let H = J.let("valid"),
          G = X.items ? (0, Cq.getSchemaTypes)(X.items) : [];
        ($.block$data(H, K, u0._`${Y} === false`), $.ok(H));
        function K() {
          let B = J.let("i", u0._`${U}.length`),
            E = J.let("j");
          ($.setParams({ i: B, j: E }), J.assign(H, !0), J.if(u0._`${B} > 1`, () => (O() ? N : F)(B, E)));
        }
        function O() {
          return G.length > 0 && !G.some((B) => B === "object" || B === "array");
        }
        function N(B, E) {
          let z = J.name("item"),
            q = (0, Cq.checkDataTypes)(G, z, D.opts.strictNumbers, Cq.DataType.Wrong),
            L = J.const("indices", u0._`{}`);
          J.for(u0._`;${B}--;`, () => {
            if ((J.let(z, u0._`${U}[${B}]`), J.if(q, u0._`continue`), G.length > 1))
              J.if(u0._`typeof ${z} == "string"`, u0._`${z} += "_"`);
            J.if(u0._`typeof ${L}[${z}] == "number"`, () => {
              (J.assign(E, u0._`${L}[${z}]`), $.error(), J.assign(H, !1).break());
            }).code(u0._`${L}[${z}] = ${B}`);
          });
        }
        function F(B, E) {
          let z = (0, Fg.useFunc)(J, qg.default),
            q = J.name("outer");
          J.label(q).for(u0._`;${B}--;`, () =>
            J.for(u0._`${E} = ${B}; ${E}--;`, () =>
              J.if(u0._`${z}(${U}[${B}], ${U}[${E}])`, () => {
                ($.error(), J.assign(H, !1).break(q));
              }),
            ),
          );
        }
      },
    };
  LM.default = Bg;
});
var VM = P$((IM) => {
  Object.defineProperty(IM, "__esModule", { value: !0 });
  var Tq = q6(),
    Lg = C6(),
    wg = k5(),
    Ig = { message: "must be equal to constant", params: ({ schemaCode: $ }) => Tq._`{allowedValue: ${$}}` },
    Vg = {
      keyword: "const",
      $data: !0,
      error: Ig,
      code($) {
        let { gen: J, data: U, $data: Q, schemaCode: W, schema: X } = $;
        if (Q || (X && typeof X == "object")) $.fail$data(Tq._`!${(0, Lg.useFunc)(J, wg.default)}(${U}, ${W})`);
        else $.fail(Tq._`${X} !== ${U}`);
      },
    };
  IM.default = Vg;
});
var AM = P$((kM) => {
  Object.defineProperty(kM, "__esModule", { value: !0 });
  var lQ = q6(),
    Ag = C6(),
    Mg = k5(),
    Rg = {
      message: "must be equal to one of the allowed values",
      params: ({ schemaCode: $ }) => lQ._`{allowedValues: ${$}}`,
    },
    Zg = {
      keyword: "enum",
      schemaType: "array",
      $data: !0,
      error: Rg,
      code($) {
        let { gen: J, data: U, $data: Q, schema: W, schemaCode: X, it: Y } = $;
        if (!Q && W.length === 0) throw Error("enum must have non-empty array");
        let D = W.length >= Y.opts.loopEnum,
          H,
          G = () => (H !== null && H !== void 0 ? H : (H = (0, Ag.useFunc)(J, Mg.default))),
          K;
        if (D || Q) ((K = J.let("valid")), $.block$data(K, O));
        else {
          if (!Array.isArray(W)) throw Error("ajv implementation error");
          let F = J.const("vSchema", X);
          K = (0, lQ.or)(...W.map((B, E) => N(F, E)));
        }
        $.pass(K);
        function O() {
          (J.assign(K, !1), J.forOf("v", X, (F) => J.if(lQ._`${G()}(${U}, ${F})`, () => J.assign(K, !0).break())));
        }
        function N(F, B) {
          let E = W[B];
          return typeof E === "object" && E !== null ? lQ._`${G()}(${U}, ${F}[${B}])` : lQ._`${U} === ${E}`;
        }
      },
    };
  kM.default = Zg;
});
var RM = P$((MM) => {
  Object.defineProperty(MM, "__esModule", { value: !0 });
  var _g = $M(),
    Sg = UM(),
    Cg = DM(),
    Tg = GM(),
    jg = NM(),
    vg = FM(),
    bg = zM(),
    fg = wM(),
    yg = VM(),
    xg = AM(),
    gg = [
      _g.default,
      Sg.default,
      Cg.default,
      Tg.default,
      jg.default,
      vg.default,
      bg.default,
      fg.default,
      { keyword: "type", schemaType: ["string", "array"] },
      { keyword: "nullable", schemaType: "boolean" },
      yg.default,
      xg.default,
    ];
  MM.default = gg;
});
var vq = P$((PM) => {
  Object.defineProperty(PM, "__esModule", { value: !0 });
  PM.validateAdditionalItems = void 0;
  var C9 = q6(),
    jq = C6(),
    ug = {
      message: ({ params: { len: $ } }) => C9.str`must NOT have more than ${$} items`,
      params: ({ params: { len: $ } }) => C9._`{limit: ${$}}`,
    },
    lg = {
      keyword: "additionalItems",
      type: "array",
      schemaType: ["boolean", "object"],
      before: "uniqueItems",
      error: ug,
      code($) {
        let { parentSchema: J, it: U } = $,
          { items: Q } = J;
        if (!Array.isArray(Q)) {
          (0, jq.checkStrictMode)(U, '"additionalItems" is ignored when "items" is not an array of schemas');
          return;
        }
        ZM($, Q);
      },
    };
  function ZM($, J) {
    let { gen: U, schema: Q, data: W, keyword: X, it: Y } = $;
    Y.items = !0;
    let D = U.const("len", C9._`${W}.length`);
    if (Q === !1) ($.setParams({ len: J.length }), $.pass(C9._`${D} <= ${J.length}`));
    else if (typeof Q == "object" && !(0, jq.alwaysValidSchema)(Y, Q)) {
      let G = U.var("valid", C9._`${D} <= ${J.length}`);
      (U.if((0, C9.not)(G), () => H(G)), $.ok(G));
    }
    function H(G) {
      U.forRange("i", J.length, D, (K) => {
        if (($.subschema({ keyword: X, dataProp: K, dataPropType: jq.Type.Num }, G), !Y.allErrors))
          U.if((0, C9.not)(G), () => U.break());
      });
    }
  }
  PM.validateAdditionalItems = ZM;
  PM.default = lg;
});
var bq = P$((TM) => {
  Object.defineProperty(TM, "__esModule", { value: !0 });
  TM.validateTuple = void 0;
  var SM = q6(),
    A5 = C6(),
    pg = uJ(),
    dg = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "array", "boolean"],
      before: "uniqueItems",
      code($) {
        let { schema: J, it: U } = $;
        if (Array.isArray(J)) return CM($, "additionalItems", J);
        if (((U.items = !0), (0, A5.alwaysValidSchema)(U, J))) return;
        $.ok((0, pg.validateArray)($));
      },
    };
  function CM($, J, U = $.schema) {
    let { gen: Q, parentSchema: W, data: X, keyword: Y, it: D } = $;
    if ((K(W), D.opts.unevaluated && U.length && D.items !== !0))
      D.items = A5.mergeEvaluated.items(Q, U.length, D.items);
    let H = Q.name("valid"),
      G = Q.const("len", SM._`${X}.length`);
    U.forEach((O, N) => {
      if ((0, A5.alwaysValidSchema)(D, O)) return;
      (Q.if(SM._`${G} > ${N}`, () => $.subschema({ keyword: Y, schemaProp: N, dataProp: N }, H)), $.ok(H));
    });
    function K(O) {
      let { opts: N, errSchemaPath: F } = D,
        B = U.length,
        E = B === O.minItems && (B === O.maxItems || O[J] === !1);
      if (N.strictTuples && !E) {
        let z = `"${Y}" is ${B}-tuple, but minItems or maxItems/${J} are not specified or different at path "${F}"`;
        (0, A5.checkStrictMode)(D, z, N.strictTuples);
      }
    }
  }
  TM.validateTuple = CM;
  TM.default = dg;
});
var bM = P$((vM) => {
  Object.defineProperty(vM, "__esModule", { value: !0 });
  var ng = bq(),
    ig = {
      keyword: "prefixItems",
      type: "array",
      schemaType: ["array"],
      before: "uniqueItems",
      code: ($) => (0, ng.validateTuple)($, "items"),
    };
  vM.default = ig;
});
var xM = P$((yM) => {
  Object.defineProperty(yM, "__esModule", { value: !0 });
  var fM = q6(),
    rg = C6(),
    sg = uJ(),
    ag = vq(),
    tg = {
      message: ({ params: { len: $ } }) => fM.str`must NOT have more than ${$} items`,
      params: ({ params: { len: $ } }) => fM._`{limit: ${$}}`,
    },
    eg = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      error: tg,
      code($) {
        let { schema: J, parentSchema: U, it: Q } = $,
          { prefixItems: W } = U;
        if (((Q.items = !0), (0, rg.alwaysValidSchema)(Q, J))) return;
        if (W) (0, ag.validateAdditionalItems)($, W);
        else $.ok((0, sg.validateArray)($));
      },
    };
  yM.default = eg;
});
var hM = P$((gM) => {
  Object.defineProperty(gM, "__esModule", { value: !0 });
  var lJ = q6(),
    M5 = C6(),
    Jh = {
      message: ({ params: { min: $, max: J } }) =>
        J === void 0
          ? lJ.str`must contain at least ${$} valid item(s)`
          : lJ.str`must contain at least ${$} and no more than ${J} valid item(s)`,
      params: ({ params: { min: $, max: J } }) =>
        J === void 0 ? lJ._`{minContains: ${$}}` : lJ._`{minContains: ${$}, maxContains: ${J}}`,
    },
    Uh = {
      keyword: "contains",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      trackErrors: !0,
      error: Jh,
      code($) {
        let { gen: J, schema: U, parentSchema: Q, data: W, it: X } = $,
          Y,
          D,
          { minContains: H, maxContains: G } = Q;
        if (X.opts.next) ((Y = H === void 0 ? 1 : H), (D = G));
        else Y = 1;
        let K = J.const("len", lJ._`${W}.length`);
        if (($.setParams({ min: Y, max: D }), D === void 0 && Y === 0)) {
          (0, M5.checkStrictMode)(X, '"minContains" == 0 without "maxContains": "contains" keyword ignored');
          return;
        }
        if (D !== void 0 && Y > D) {
          ((0, M5.checkStrictMode)(X, '"minContains" > "maxContains" is always invalid'), $.fail());
          return;
        }
        if ((0, M5.alwaysValidSchema)(X, U)) {
          let E = lJ._`${K} >= ${Y}`;
          if (D !== void 0) E = lJ._`${E} && ${K} <= ${D}`;
          $.pass(E);
          return;
        }
        X.items = !0;
        let O = J.name("valid");
        if (D === void 0 && Y === 1) F(O, () => J.if(O, () => J.break()));
        else if (Y === 0) {
          if ((J.let(O, !0), D !== void 0)) J.if(lJ._`${W}.length > 0`, N);
        } else (J.let(O, !1), N());
        $.result(O, () => $.reset());
        function N() {
          let E = J.name("_valid"),
            z = J.let("count", 0);
          F(E, () => J.if(E, () => B(z)));
        }
        function F(E, z) {
          J.forRange("i", 0, K, (q) => {
            ($.subschema({ keyword: "contains", dataProp: q, dataPropType: M5.Type.Num, compositeRule: !0 }, E), z());
          });
        }
        function B(E) {
          if ((J.code(lJ._`${E}++`), D === void 0)) J.if(lJ._`${E} >= ${Y}`, () => J.assign(O, !0).break());
          else if ((J.if(lJ._`${E} > ${D}`, () => J.assign(O, !1).break()), Y === 1)) J.assign(O, !0);
          else J.if(lJ._`${E} >= ${Y}`, () => J.assign(O, !0));
        }
      },
    };
  gM.default = Uh;
});
var cM = P$((mM) => {
  Object.defineProperty(mM, "__esModule", { value: !0 });
  mM.validateSchemaDeps = mM.validatePropertyDeps = mM.error = void 0;
  var fq = q6(),
    Qh = C6(),
    mQ = uJ();
  mM.error = {
    message: ({ params: { property: $, depsCount: J, deps: U } }) => {
      let Q = J === 1 ? "property" : "properties";
      return fq.str`must have ${Q} ${U} when property ${$} is present`;
    },
    params: ({ params: { property: $, depsCount: J, deps: U, missingProperty: Q } }) => fq._`{property: ${$},
    missingProperty: ${Q},
    depsCount: ${J},
    deps: ${U}}`,
  };
  var Xh = {
    keyword: "dependencies",
    type: "object",
    schemaType: "object",
    error: mM.error,
    code($) {
      let [J, U] = Yh($);
      (uM($, J), lM($, U));
    },
  };
  function Yh({ schema: $ }) {
    let J = {},
      U = {};
    for (let Q in $) {
      if (Q === "__proto__") continue;
      let W = Array.isArray($[Q]) ? J : U;
      W[Q] = $[Q];
    }
    return [J, U];
  }
  function uM($, J = $.schema) {
    let { gen: U, data: Q, it: W } = $;
    if (Object.keys(J).length === 0) return;
    let X = U.let("missing");
    for (let Y in J) {
      let D = J[Y];
      if (D.length === 0) continue;
      let H = (0, mQ.propertyInData)(U, Q, Y, W.opts.ownProperties);
      if (($.setParams({ property: Y, depsCount: D.length, deps: D.join(", ") }), W.allErrors))
        U.if(H, () => {
          for (let G of D) (0, mQ.checkReportMissingProp)($, G);
        });
      else (U.if(fq._`${H} && (${(0, mQ.checkMissingProp)($, D, X)})`), (0, mQ.reportMissingProp)($, X), U.else());
    }
  }
  mM.validatePropertyDeps = uM;
  function lM($, J = $.schema) {
    let { gen: U, data: Q, keyword: W, it: X } = $,
      Y = U.name("valid");
    for (let D in J) {
      if ((0, Qh.alwaysValidSchema)(X, J[D])) continue;
      (U.if(
        (0, mQ.propertyInData)(U, Q, D, X.opts.ownProperties),
        () => {
          let H = $.subschema({ keyword: W, schemaProp: D }, Y);
          $.mergeValidEvaluated(H, Y);
        },
        () => U.var(Y, !0),
      ),
        $.ok(Y));
    }
  }
  mM.validateSchemaDeps = lM;
  mM.default = Xh;
});
var oM = P$((iM) => {
  Object.defineProperty(iM, "__esModule", { value: !0 });
  var nM = q6(),
    Gh = C6(),
    Kh = { message: "property name must be valid", params: ({ params: $ }) => nM._`{propertyName: ${$.propertyName}}` },
    Nh = {
      keyword: "propertyNames",
      type: "object",
      schemaType: ["object", "boolean"],
      error: Kh,
      code($) {
        let { gen: J, schema: U, data: Q, it: W } = $;
        if ((0, Gh.alwaysValidSchema)(W, U)) return;
        let X = J.name("valid");
        (J.forIn("key", Q, (Y) => {
          ($.setParams({ propertyName: Y }),
            $.subschema(
              { keyword: "propertyNames", data: Y, dataTypes: ["string"], propertyName: Y, compositeRule: !0 },
              X,
            ),
            J.if((0, nM.not)(X), () => {
              if (($.error(!0), !W.allErrors)) J.break();
            }));
        }),
          $.ok(X));
      },
    };
  iM.default = Nh;
});
var yq = P$((rM) => {
  Object.defineProperty(rM, "__esModule", { value: !0 });
  var R5 = uJ(),
    QU = q6(),
    Fh = rU(),
    Z5 = C6(),
    qh = {
      message: "must NOT have additional properties",
      params: ({ params: $ }) => QU._`{additionalProperty: ${$.additionalProperty}}`,
    },
    zh = {
      keyword: "additionalProperties",
      type: ["object"],
      schemaType: ["boolean", "object"],
      allowUndefined: !0,
      trackErrors: !0,
      error: qh,
      code($) {
        let { gen: J, schema: U, parentSchema: Q, data: W, errsCount: X, it: Y } = $;
        if (!X) throw Error("ajv implementation error");
        let { allErrors: D, opts: H } = Y;
        if (((Y.props = !0), H.removeAdditional !== "all" && (0, Z5.alwaysValidSchema)(Y, U))) return;
        let G = (0, R5.allSchemaProperties)(Q.properties),
          K = (0, R5.allSchemaProperties)(Q.patternProperties);
        (O(), $.ok(QU._`${X} === ${Fh.default.errors}`));
        function O() {
          J.forIn("key", W, (z) => {
            if (!G.length && !K.length) B(z);
            else J.if(N(z), () => B(z));
          });
        }
        function N(z) {
          let q;
          if (G.length > 8) {
            let L = (0, Z5.schemaRefOrVal)(Y, Q.properties, "properties");
            q = (0, R5.isOwnProperty)(J, L, z);
          } else if (G.length) q = (0, QU.or)(...G.map((L) => QU._`${z} === ${L}`));
          else q = QU.nil;
          if (K.length) q = (0, QU.or)(q, ...K.map((L) => QU._`${(0, R5.usePattern)($, L)}.test(${z})`));
          return (0, QU.not)(q);
        }
        function F(z) {
          J.code(QU._`delete ${W}[${z}]`);
        }
        function B(z) {
          if (H.removeAdditional === "all" || (H.removeAdditional && U === !1)) {
            F(z);
            return;
          }
          if (U === !1) {
            if (($.setParams({ additionalProperty: z }), $.error(), !D)) J.break();
            return;
          }
          if (typeof U == "object" && !(0, Z5.alwaysValidSchema)(Y, U)) {
            let q = J.name("valid");
            if (H.removeAdditional === "failing")
              (E(z, q, !1),
                J.if((0, QU.not)(q), () => {
                  ($.reset(), F(z));
                }));
            else if ((E(z, q), !D)) J.if((0, QU.not)(q), () => J.break());
          }
        }
        function E(z, q, L) {
          let V = { keyword: "additionalProperties", dataProp: z, dataPropType: Z5.Type.Str };
          if (L === !1) Object.assign(V, { compositeRule: !0, createErrors: !1, allErrors: !1 });
          $.subschema(V, q);
        }
      },
    };
  rM.default = zh;
});
var eM = P$((tM) => {
  Object.defineProperty(tM, "__esModule", { value: !0 });
  var Eh = CQ(),
    sM = uJ(),
    xq = C6(),
    aM = yq(),
    Lh = {
      keyword: "properties",
      type: "object",
      schemaType: "object",
      code($) {
        let { gen: J, schema: U, parentSchema: Q, data: W, it: X } = $;
        if (X.opts.removeAdditional === "all" && Q.additionalProperties === void 0)
          aM.default.code(new Eh.KeywordCxt(X, aM.default, "additionalProperties"));
        let Y = (0, sM.allSchemaProperties)(U);
        for (let O of Y) X.definedProperties.add(O);
        if (X.opts.unevaluated && Y.length && X.props !== !0)
          X.props = xq.mergeEvaluated.props(J, (0, xq.toHash)(Y), X.props);
        let D = Y.filter((O) => !(0, xq.alwaysValidSchema)(X, U[O]));
        if (D.length === 0) return;
        let H = J.name("valid");
        for (let O of D) {
          if (G(O)) K(O);
          else {
            if ((J.if((0, sM.propertyInData)(J, W, O, X.opts.ownProperties)), K(O), !X.allErrors)) J.else().var(H, !0);
            J.endIf();
          }
          ($.it.definedProperties.add(O), $.ok(H));
        }
        function G(O) {
          return X.opts.useDefaults && !X.compositeRule && U[O].default !== void 0;
        }
        function K(O) {
          $.subschema({ keyword: "properties", schemaProp: O, dataProp: O }, H);
        }
      },
    };
  tM.default = Lh;
});
var Q3 = P$((W3) => {
  Object.defineProperty(W3, "__esModule", { value: !0 });
  var $3 = uJ(),
    P5 = q6(),
    J3 = C6(),
    U3 = C6(),
    Ih = {
      keyword: "patternProperties",
      type: "object",
      schemaType: "object",
      code($) {
        let { gen: J, schema: U, data: Q, parentSchema: W, it: X } = $,
          { opts: Y } = X,
          D = (0, $3.allSchemaProperties)(U),
          H = D.filter((E) => (0, J3.alwaysValidSchema)(X, U[E]));
        if (D.length === 0 || (H.length === D.length && (!X.opts.unevaluated || X.props === !0))) return;
        let G = Y.strictSchema && !Y.allowMatchingProperties && W.properties,
          K = J.name("valid");
        if (X.props !== !0 && !(X.props instanceof P5.Name)) X.props = (0, U3.evaluatedPropsToName)(J, X.props);
        let { props: O } = X;
        N();
        function N() {
          for (let E of D) {
            if (G) F(E);
            if (X.allErrors) B(E);
            else (J.var(K, !0), B(E), J.if(K));
          }
        }
        function F(E) {
          for (let z in G)
            if (new RegExp(E).test(z))
              (0, J3.checkStrictMode)(X, `property ${z} matches pattern ${E} (use allowMatchingProperties)`);
        }
        function B(E) {
          J.forIn("key", Q, (z) => {
            J.if(P5._`${(0, $3.usePattern)($, E)}.test(${z})`, () => {
              let q = H.includes(E);
              if (!q)
                $.subschema({ keyword: "patternProperties", schemaProp: E, dataProp: z, dataPropType: U3.Type.Str }, K);
              if (X.opts.unevaluated && O !== !0) J.assign(P5._`${O}[${z}]`, !0);
              else if (!q && !X.allErrors) J.if((0, P5.not)(K), () => J.break());
            });
          });
        }
      },
    };
  W3.default = Ih;
});
var Y3 = P$((X3) => {
  Object.defineProperty(X3, "__esModule", { value: !0 });
  var kh = C6(),
    Ah = {
      keyword: "not",
      schemaType: ["object", "boolean"],
      trackErrors: !0,
      code($) {
        let { gen: J, schema: U, it: Q } = $;
        if ((0, kh.alwaysValidSchema)(Q, U)) {
          $.fail();
          return;
        }
        let W = J.name("valid");
        ($.subschema({ keyword: "not", compositeRule: !0, createErrors: !1, allErrors: !1 }, W),
          $.failResult(
            W,
            () => $.reset(),
            () => $.error(),
          ));
      },
      error: { message: "must NOT be valid" },
    };
  X3.default = Ah;
});
var H3 = P$((D3) => {
  Object.defineProperty(D3, "__esModule", { value: !0 });
  var Rh = uJ(),
    Zh = {
      keyword: "anyOf",
      schemaType: "array",
      trackErrors: !0,
      code: Rh.validateUnion,
      error: { message: "must match a schema in anyOf" },
    };
  D3.default = Zh;
});
var K3 = P$((G3) => {
  Object.defineProperty(G3, "__esModule", { value: !0 });
  var _5 = q6(),
    _h = C6(),
    Sh = {
      message: "must match exactly one schema in oneOf",
      params: ({ params: $ }) => _5._`{passingSchemas: ${$.passing}}`,
    },
    Ch = {
      keyword: "oneOf",
      schemaType: "array",
      trackErrors: !0,
      error: Sh,
      code($) {
        let { gen: J, schema: U, parentSchema: Q, it: W } = $;
        if (!Array.isArray(U)) throw Error("ajv implementation error");
        if (W.opts.discriminator && Q.discriminator) return;
        let X = U,
          Y = J.let("valid", !1),
          D = J.let("passing", null),
          H = J.name("_valid");
        ($.setParams({ passing: D }),
          J.block(G),
          $.result(
            Y,
            () => $.reset(),
            () => $.error(!0),
          ));
        function G() {
          X.forEach((K, O) => {
            let N;
            if ((0, _h.alwaysValidSchema)(W, K)) J.var(H, !0);
            else N = $.subschema({ keyword: "oneOf", schemaProp: O, compositeRule: !0 }, H);
            if (O > 0)
              J.if(_5._`${H} && ${Y}`)
                .assign(Y, !1)
                .assign(D, _5._`[${D}, ${O}]`)
                .else();
            J.if(H, () => {
              if ((J.assign(Y, !0), J.assign(D, O), N)) $.mergeEvaluated(N, _5.Name);
            });
          });
        }
      },
    };
  G3.default = Ch;
});
var O3 = P$((N3) => {
  Object.defineProperty(N3, "__esModule", { value: !0 });
  var jh = C6(),
    vh = {
      keyword: "allOf",
      schemaType: "array",
      code($) {
        let { gen: J, schema: U, it: Q } = $;
        if (!Array.isArray(U)) throw Error("ajv implementation error");
        let W = J.name("valid");
        U.forEach((X, Y) => {
          if ((0, jh.alwaysValidSchema)(Q, X)) return;
          let D = $.subschema({ keyword: "allOf", schemaProp: Y }, W);
          ($.ok(W), $.mergeEvaluated(D));
        });
      },
    };
  N3.default = vh;
});
var B3 = P$((z3) => {
  Object.defineProperty(z3, "__esModule", { value: !0 });
  var S5 = q6(),
    q3 = C6(),
    fh = {
      message: ({ params: $ }) => S5.str`must match "${$.ifClause}" schema`,
      params: ({ params: $ }) => S5._`{failingKeyword: ${$.ifClause}}`,
    },
    yh = {
      keyword: "if",
      schemaType: ["object", "boolean"],
      trackErrors: !0,
      error: fh,
      code($) {
        let { gen: J, parentSchema: U, it: Q } = $;
        if (U.then === void 0 && U.else === void 0)
          (0, q3.checkStrictMode)(Q, '"if" without "then" and "else" is ignored');
        let W = F3(Q, "then"),
          X = F3(Q, "else");
        if (!W && !X) return;
        let Y = J.let("valid", !0),
          D = J.name("_valid");
        if ((H(), $.reset(), W && X)) {
          let K = J.let("ifClause");
          ($.setParams({ ifClause: K }), J.if(D, G("then", K), G("else", K)));
        } else if (W) J.if(D, G("then"));
        else J.if((0, S5.not)(D), G("else"));
        $.pass(Y, () => $.error(!0));
        function H() {
          let K = $.subschema({ keyword: "if", compositeRule: !0, createErrors: !1, allErrors: !1 }, D);
          $.mergeEvaluated(K);
        }
        function G(K, O) {
          return () => {
            let N = $.subschema({ keyword: K }, D);
            if ((J.assign(Y, D), $.mergeValidEvaluated(N, Y), O)) J.assign(O, S5._`${K}`);
            else $.setParams({ ifClause: K });
          };
        }
      },
    };
  function F3($, J) {
    let U = $.schema[J];
    return U !== void 0 && !(0, q3.alwaysValidSchema)($, U);
  }
  z3.default = yh;
});
var L3 = P$((E3) => {
  Object.defineProperty(E3, "__esModule", { value: !0 });
  var gh = C6(),
    hh = {
      keyword: ["then", "else"],
      schemaType: ["object", "boolean"],
      code({ keyword: $, parentSchema: J, it: U }) {
        if (J.if === void 0) (0, gh.checkStrictMode)(U, `"${$}" without "if" is ignored`);
      },
    };
  E3.default = hh;
});
var I3 = P$((w3) => {
  Object.defineProperty(w3, "__esModule", { value: !0 });
  var lh = vq(),
    mh = bM(),
    ph = bq(),
    dh = xM(),
    ch = hM(),
    nh = cM(),
    ih = oM(),
    oh = yq(),
    rh = eM(),
    sh = Q3(),
    ah = Y3(),
    th = H3(),
    eh = K3(),
    $u = O3(),
    Ju = B3(),
    Uu = L3();
  function Wu($ = !1) {
    let J = [
      ah.default,
      th.default,
      eh.default,
      $u.default,
      Ju.default,
      Uu.default,
      ih.default,
      oh.default,
      nh.default,
      rh.default,
      sh.default,
    ];
    if ($) J.push(mh.default, dh.default);
    else J.push(lh.default, ph.default);
    return (J.push(ch.default), J);
  }
  w3.default = Wu;
});
var k3 = P$((V3) => {
  Object.defineProperty(V3, "__esModule", { value: !0 });
  var k0 = q6(),
    Xu = {
      message: ({ schemaCode: $ }) => k0.str`must match format "${$}"`,
      params: ({ schemaCode: $ }) => k0._`{format: ${$}}`,
    },
    Yu = {
      keyword: "format",
      type: ["number", "string"],
      schemaType: "string",
      $data: !0,
      error: Xu,
      code($, J) {
        let { gen: U, data: Q, $data: W, schema: X, schemaCode: Y, it: D } = $,
          { opts: H, errSchemaPath: G, schemaEnv: K, self: O } = D;
        if (!H.validateFormats) return;
        if (W) N();
        else F();
        function N() {
          let B = U.scopeValue("formats", { ref: O.formats, code: H.code.formats }),
            E = U.const("fDef", k0._`${B}[${Y}]`),
            z = U.let("fType"),
            q = U.let("format");
          (U.if(
            k0._`typeof ${E} == "object" && !(${E} instanceof RegExp)`,
            () => U.assign(z, k0._`${E}.type || "string"`).assign(q, k0._`${E}.validate`),
            () => U.assign(z, k0._`"string"`).assign(q, E),
          ),
            $.fail$data((0, k0.or)(L(), V())));
          function L() {
            if (H.strictSchema === !1) return k0.nil;
            return k0._`${Y} && !${q}`;
          }
          function V() {
            let k = K.$async ? k0._`(${E}.async ? await ${q}(${Q}) : ${q}(${Q}))` : k0._`${q}(${Q})`,
              R = k0._`(typeof ${q} == "function" ? ${k} : ${q}.test(${Q}))`;
            return k0._`${q} && ${q} !== true && ${z} === ${J} && !${R}`;
          }
        }
        function F() {
          let B = O.formats[X];
          if (!B) {
            L();
            return;
          }
          if (B === !0) return;
          let [E, z, q] = V(B);
          if (E === J) $.pass(k());
          function L() {
            if (H.strictSchema === !1) {
              O.logger.warn(R());
              return;
            }
            throw Error(R());
            function R() {
              return `unknown format "${X}" ignored in schema at path "${G}"`;
            }
          }
          function V(R) {
            let _ =
                R instanceof RegExp
                  ? (0, k0.regexpCode)(R)
                  : H.code.formats
                    ? k0._`${H.code.formats}${(0, k0.getProperty)(X)}`
                    : void 0,
              S = U.scopeValue("formats", { key: X, ref: R, code: _ });
            if (typeof R == "object" && !(R instanceof RegExp))
              return [R.type || "string", R.validate, k0._`${S}.validate`];
            return ["string", R, S];
          }
          function k() {
            if (typeof B == "object" && !(B instanceof RegExp) && B.async) {
              if (!K.$async) throw Error("async format in sync schema");
              return k0._`await ${q}(${Q})`;
            }
            return typeof z == "function" ? k0._`${q}(${Q})` : k0._`${q}.test(${Q})`;
          }
        }
      },
    };
  V3.default = Yu;
});
var M3 = P$((A3) => {
  Object.defineProperty(A3, "__esModule", { value: !0 });
  var Hu = k3(),
    Gu = [Hu.default];
  A3.default = Gu;
});
var P3 = P$((R3) => {
  Object.defineProperty(R3, "__esModule", { value: !0 });
  R3.contentVocabulary = R3.metadataVocabulary = void 0;
  R3.metadataVocabulary = ["title", "description", "default", "deprecated", "readOnly", "writeOnly", "examples"];
  R3.contentVocabulary = ["contentMediaType", "contentEncoding", "contentSchema"];
});
var C3 = P$((S3) => {
  Object.defineProperty(S3, "__esModule", { value: !0 });
  var Ou = tA(),
    Fu = RM(),
    qu = I3(),
    zu = M3(),
    _3 = P3(),
    Bu = [Ou.default, Fu.default, (0, qu.default)(), zu.default, _3.metadataVocabulary, _3.contentVocabulary];
  S3.default = Bu;
});
var b3 = P$((j3) => {
  Object.defineProperty(j3, "__esModule", { value: !0 });
  j3.DiscrError = void 0;
  var T3;
  (function ($) {
    (($.Tag = "tag"), ($.Mapping = "mapping"));
  })(T3 || (j3.DiscrError = T3 = {}));
});
var x3 = P$((y3) => {
  Object.defineProperty(y3, "__esModule", { value: !0 });
  var D1 = q6(),
    gq = b3(),
    f3 = O5(),
    Lu = TQ(),
    wu = C6(),
    Iu = {
      message: ({ params: { discrError: $, tagName: J } }) =>
        $ === gq.DiscrError.Tag ? `tag "${J}" must be string` : `value of tag "${J}" must be in oneOf`,
      params: ({ params: { discrError: $, tag: J, tagName: U } }) => D1._`{error: ${$}, tag: ${U}, tagValue: ${J}}`,
    },
    Vu = {
      keyword: "discriminator",
      type: "object",
      schemaType: "object",
      error: Iu,
      code($) {
        let { gen: J, data: U, schema: Q, parentSchema: W, it: X } = $,
          { oneOf: Y } = W;
        if (!X.opts.discriminator) throw Error("discriminator: requires discriminator option");
        let D = Q.propertyName;
        if (typeof D != "string") throw Error("discriminator: requires propertyName");
        if (Q.mapping) throw Error("discriminator: mapping is not supported");
        if (!Y) throw Error("discriminator: requires oneOf keyword");
        let H = J.let("valid", !1),
          G = J.const("tag", D1._`${U}${(0, D1.getProperty)(D)}`);
        (J.if(
          D1._`typeof ${G} == "string"`,
          () => K(),
          () => $.error(!1, { discrError: gq.DiscrError.Tag, tag: G, tagName: D }),
        ),
          $.ok(H));
        function K() {
          let F = N();
          J.if(!1);
          for (let B in F) (J.elseIf(D1._`${G} === ${B}`), J.assign(H, O(F[B])));
          (J.else(), $.error(!1, { discrError: gq.DiscrError.Mapping, tag: G, tagName: D }), J.endIf());
        }
        function O(F) {
          let B = J.name("valid"),
            E = $.subschema({ keyword: "oneOf", schemaProp: F }, B);
          return ($.mergeEvaluated(E, D1.Name), B);
        }
        function N() {
          var F;
          let B = {},
            E = q(W),
            z = !0;
          for (let k = 0; k < Y.length; k++) {
            let R = Y[k];
            if ((R === null || R === void 0 ? void 0 : R.$ref) && !(0, wu.schemaHasRulesButRef)(R, X.self.RULES)) {
              let S = R.$ref;
              if (((R = f3.resolveRef.call(X.self, X.schemaEnv.root, X.baseId, S)), R instanceof f3.SchemaEnv))
                R = R.schema;
              if (R === void 0) throw new Lu.default(X.opts.uriResolver, X.baseId, S);
            }
            let _ = (F = R === null || R === void 0 ? void 0 : R.properties) === null || F === void 0 ? void 0 : F[D];
            if (typeof _ != "object")
              throw Error(`discriminator: oneOf subschemas (or referenced schemas) must have "properties/${D}"`);
            ((z = z && (E || q(R))), L(_, k));
          }
          if (!z) throw Error(`discriminator: "${D}" must be required`);
          return B;
          function q({ required: k }) {
            return Array.isArray(k) && k.includes(D);
          }
          function L(k, R) {
            if (k.const) V(k.const, R);
            else if (k.enum) for (let _ of k.enum) V(_, R);
            else throw Error(`discriminator: "properties/${D}" must have "const" or "enum"`);
          }
          function V(k, R) {
            if (typeof k != "string" || k in B) throw Error(`discriminator: "${D}" values must be unique strings`);
            B[k] = R;
          }
        }
      },
    };
  y3.default = Vu;
});
var g3 = P$(($J$, Au) => {
  Au.exports = {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "http://json-schema.org/draft-07/schema#",
    title: "Core schema meta-schema",
    definitions: {
      schemaArray: { type: "array", minItems: 1, items: { $ref: "#" } },
      nonNegativeInteger: { type: "integer", minimum: 0 },
      nonNegativeIntegerDefault0: { allOf: [{ $ref: "#/definitions/nonNegativeInteger" }, { default: 0 }] },
      simpleTypes: { enum: ["array", "boolean", "integer", "null", "number", "object", "string"] },
      stringArray: { type: "array", items: { type: "string" }, uniqueItems: !0, default: [] },
    },
    type: ["object", "boolean"],
    properties: {
      $id: { type: "string", format: "uri-reference" },
      $schema: { type: "string", format: "uri" },
      $ref: { type: "string", format: "uri-reference" },
      $comment: { type: "string" },
      title: { type: "string" },
      description: { type: "string" },
      default: !0,
      readOnly: { type: "boolean", default: !1 },
      examples: { type: "array", items: !0 },
      multipleOf: { type: "number", exclusiveMinimum: 0 },
      maximum: { type: "number" },
      exclusiveMaximum: { type: "number" },
      minimum: { type: "number" },
      exclusiveMinimum: { type: "number" },
      maxLength: { $ref: "#/definitions/nonNegativeInteger" },
      minLength: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
      pattern: { type: "string", format: "regex" },
      additionalItems: { $ref: "#" },
      items: { anyOf: [{ $ref: "#" }, { $ref: "#/definitions/schemaArray" }], default: !0 },
      maxItems: { $ref: "#/definitions/nonNegativeInteger" },
      minItems: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
      uniqueItems: { type: "boolean", default: !1 },
      contains: { $ref: "#" },
      maxProperties: { $ref: "#/definitions/nonNegativeInteger" },
      minProperties: { $ref: "#/definitions/nonNegativeIntegerDefault0" },
      required: { $ref: "#/definitions/stringArray" },
      additionalProperties: { $ref: "#" },
      definitions: { type: "object", additionalProperties: { $ref: "#" }, default: {} },
      properties: { type: "object", additionalProperties: { $ref: "#" }, default: {} },
      patternProperties: {
        type: "object",
        additionalProperties: { $ref: "#" },
        propertyNames: { format: "regex" },
        default: {},
      },
      dependencies: {
        type: "object",
        additionalProperties: { anyOf: [{ $ref: "#" }, { $ref: "#/definitions/stringArray" }] },
      },
      propertyNames: { $ref: "#" },
      const: !0,
      enum: { type: "array", items: !0, minItems: 1, uniqueItems: !0 },
      type: {
        anyOf: [
          { $ref: "#/definitions/simpleTypes" },
          { type: "array", items: { $ref: "#/definitions/simpleTypes" }, minItems: 1, uniqueItems: !0 },
        ],
      },
      format: { type: "string" },
      contentMediaType: { type: "string" },
      contentEncoding: { type: "string" },
      if: { $ref: "#" },
      then: { $ref: "#" },
      else: { $ref: "#" },
      allOf: { $ref: "#/definitions/schemaArray" },
      anyOf: { $ref: "#/definitions/schemaArray" },
      oneOf: { $ref: "#/definitions/schemaArray" },
      not: { $ref: "#" },
    },
    default: !0,
  };
});
var uq = P$((VJ, hq) => {
  Object.defineProperty(VJ, "__esModule", { value: !0 });
  VJ.MissingRefError =
    VJ.ValidationError =
    VJ.CodeGen =
    VJ.Name =
    VJ.nil =
    VJ.stringify =
    VJ.str =
    VJ._ =
    VJ.KeywordCxt =
    VJ.Ajv =
      void 0;
  var Mu = mA(),
    Ru = C3(),
    Zu = x3(),
    h3 = g3(),
    Pu = ["/properties"],
    C5 = "http://json-schema.org/draft-07/schema";
  class pQ extends Mu.default {
    _addVocabularies() {
      if ((super._addVocabularies(), Ru.default.forEach(($) => this.addVocabulary($)), this.opts.discriminator))
        this.addKeyword(Zu.default);
    }
    _addDefaultMetaSchema() {
      if ((super._addDefaultMetaSchema(), !this.opts.meta)) return;
      let $ = this.opts.$data ? this.$dataMetaSchema(h3, Pu) : h3;
      (this.addMetaSchema($, C5, !1), (this.refs["http://json-schema.org/schema"] = C5));
    }
    defaultMeta() {
      return (this.opts.defaultMeta = super.defaultMeta() || (this.getSchema(C5) ? C5 : void 0));
    }
  }
  VJ.Ajv = pQ;
  hq.exports = VJ = pQ;
  hq.exports.Ajv = pQ;
  Object.defineProperty(VJ, "__esModule", { value: !0 });
  VJ.default = pQ;
  var _u = CQ();
  Object.defineProperty(VJ, "KeywordCxt", {
    enumerable: !0,
    get: function () {
      return _u.KeywordCxt;
    },
  });
  var H1 = q6();
  Object.defineProperty(VJ, "_", {
    enumerable: !0,
    get: function () {
      return H1._;
    },
  });
  Object.defineProperty(VJ, "str", {
    enumerable: !0,
    get: function () {
      return H1.str;
    },
  });
  Object.defineProperty(VJ, "stringify", {
    enumerable: !0,
    get: function () {
      return H1.stringify;
    },
  });
  Object.defineProperty(VJ, "nil", {
    enumerable: !0,
    get: function () {
      return H1.nil;
    },
  });
  Object.defineProperty(VJ, "Name", {
    enumerable: !0,
    get: function () {
      return H1.Name;
    },
  });
  Object.defineProperty(VJ, "CodeGen", {
    enumerable: !0,
    get: function () {
      return H1.CodeGen;
    },
  });
  var Su = K5();
  Object.defineProperty(VJ, "ValidationError", {
    enumerable: !0,
    get: function () {
      return Su.default;
    },
  });
  var Cu = TQ();
  Object.defineProperty(VJ, "MissingRefError", {
    enumerable: !0,
    get: function () {
      return Cu.default;
    },
  });
});
var r3 = P$((i3) => {
  Object.defineProperty(i3, "__esModule", { value: !0 });
  i3.formatNames = i3.fastFormats = i3.fullFormats = void 0;
  function _U($, J) {
    return { validate: $, compare: J };
  }
  i3.fullFormats = {
    date: _U(p3, dq),
    time: _U(mq(!0), cq),
    "date-time": _U(u3(!0), c3),
    "iso-time": _U(mq(), d3),
    "iso-date-time": _U(u3(), n3),
    duration: /^P(?!$)((\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?|(\d+W)?)$/,
    uri: gu,
    "uri-reference":
      /^(?:[a-z][a-z0-9+\-.]*:)?(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'"()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'"()*+,;=:@]|%[0-9a-f]{2})*)*)?(?:\?(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'"()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i,
    "uri-template":
      /^(?:(?:[^\x00-\x20"'<>%\\^`{|}]|%[0-9a-f]{2})|\{[+#./;?&=,!@|]?(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?(?:,(?:[a-z0-9_]|%[0-9a-f]{2})+(?::[1-9][0-9]{0,3}|\*)?)*\})*$/i,
    url: /^(?:https?|ftp):\/\/(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)(?:\.(?:[a-z0-9\u{00a1}-\u{ffff}]+-)*[a-z0-9\u{00a1}-\u{ffff}]+)*(?:\.(?:[a-z\u{00a1}-\u{ffff}]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?$/iu,
    email:
      /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i,
    hostname: /^(?=.{1,253}\.?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*\.?$/i,
    ipv4: /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
    ipv6: /^((([0-9a-f]{1,4}:){7}([0-9a-f]{1,4}|:))|(([0-9a-f]{1,4}:){6}(:[0-9a-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){5}(((:[0-9a-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9a-f]{1,4}:){4}(((:[0-9a-f]{1,4}){1,3})|((:[0-9a-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){3}(((:[0-9a-f]{1,4}){1,4})|((:[0-9a-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){2}(((:[0-9a-f]{1,4}){1,5})|((:[0-9a-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9a-f]{1,4}:){1}(((:[0-9a-f]{1,4}){1,6})|((:[0-9a-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9a-f]{1,4}){1,7})|((:[0-9a-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))$/i,
    regex: cu,
    uuid: /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i,
    "json-pointer": /^(?:\/(?:[^~/]|~0|~1)*)*$/,
    "json-pointer-uri-fragment": /^#(?:\/(?:[a-z0-9_\-.!$&'()*+,;:=@]|%[0-9a-f]{2}|~0|~1)*)*$/i,
    "relative-json-pointer": /^(?:0|[1-9][0-9]*)(?:#|(?:\/(?:[^~/]|~0|~1)*)*)$/,
    byte: hu,
    int32: { type: "number", validate: mu },
    int64: { type: "number", validate: pu },
    float: { type: "number", validate: m3 },
    double: { type: "number", validate: m3 },
    password: !0,
    binary: !0,
  };
  i3.fastFormats = {
    ...i3.fullFormats,
    date: _U(/^\d\d\d\d-[0-1]\d-[0-3]\d$/, dq),
    time: _U(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i, cq),
    "date-time": _U(
      /^\d\d\d\d-[0-1]\d-[0-3]\dt(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)$/i,
      c3,
    ),
    "iso-time": _U(/^(?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i, d3),
    "iso-date-time": _U(
      /^\d\d\d\d-[0-1]\d-[0-3]\d[t\s](?:[0-2]\d:[0-5]\d:[0-5]\d|23:59:60)(?:\.\d+)?(?:z|[+-]\d\d(?::?\d\d)?)?$/i,
      n3,
    ),
    uri: /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/)?[^\s]*$/i,
    "uri-reference": /^(?:(?:[a-z][a-z0-9+\-.]*:)?\/?\/)?(?:[^\\\s#][^\s#]*)?(?:#[^\\\s]*)?$/i,
    email:
      /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i,
  };
  i3.formatNames = Object.keys(i3.fullFormats);
  function vu($) {
    return $ % 4 === 0 && ($ % 100 !== 0 || $ % 400 === 0);
  }
  var bu = /^(\d\d\d\d)-(\d\d)-(\d\d)$/,
    fu = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  function p3($) {
    let J = bu.exec($);
    if (!J) return !1;
    let U = +J[1],
      Q = +J[2],
      W = +J[3];
    return Q >= 1 && Q <= 12 && W >= 1 && W <= (Q === 2 && vu(U) ? 29 : fu[Q]);
  }
  function dq($, J) {
    if (!($ && J)) return;
    if ($ > J) return 1;
    if ($ < J) return -1;
    return 0;
  }
  var lq = /^(\d\d):(\d\d):(\d\d(?:\.\d+)?)(z|([+-])(\d\d)(?::?(\d\d))?)?$/i;
  function mq($) {
    return function (U) {
      let Q = lq.exec(U);
      if (!Q) return !1;
      let W = +Q[1],
        X = +Q[2],
        Y = +Q[3],
        D = Q[4],
        H = Q[5] === "-" ? -1 : 1,
        G = +(Q[6] || 0),
        K = +(Q[7] || 0);
      if (G > 23 || K > 59 || ($ && !D)) return !1;
      if (W <= 23 && X <= 59 && Y < 60) return !0;
      let O = X - K * H,
        N = W - G * H - (O < 0 ? 1 : 0);
      return (N === 23 || N === -1) && (O === 59 || O === -1) && Y < 61;
    };
  }
  function cq($, J) {
    if (!($ && J)) return;
    let U = new Date("2020-01-01T" + $).valueOf(),
      Q = new Date("2020-01-01T" + J).valueOf();
    if (!(U && Q)) return;
    return U - Q;
  }
  function d3($, J) {
    if (!($ && J)) return;
    let U = lq.exec($),
      Q = lq.exec(J);
    if (!(U && Q)) return;
    if ((($ = U[1] + U[2] + U[3]), (J = Q[1] + Q[2] + Q[3]), $ > J)) return 1;
    if ($ < J) return -1;
    return 0;
  }
  var pq = /t|\s/i;
  function u3($) {
    let J = mq($);
    return function (Q) {
      let W = Q.split(pq);
      return W.length === 2 && p3(W[0]) && J(W[1]);
    };
  }
  function c3($, J) {
    if (!($ && J)) return;
    let U = new Date($).valueOf(),
      Q = new Date(J).valueOf();
    if (!(U && Q)) return;
    return U - Q;
  }
  function n3($, J) {
    if (!($ && J)) return;
    let [U, Q] = $.split(pq),
      [W, X] = J.split(pq),
      Y = dq(U, W);
    if (Y === void 0) return;
    return Y || cq(Q, X);
  }
  var yu = /\/|:/,
    xu =
      /^(?:[a-z][a-z0-9+\-.]*:)(?:\/?\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:]|%[0-9a-f]{2})*@)?(?:\[(?:(?:(?:(?:[0-9a-f]{1,4}:){6}|::(?:[0-9a-f]{1,4}:){5}|(?:[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){4}|(?:(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){3}|(?:(?:[0-9a-f]{1,4}:){0,2}[0-9a-f]{1,4})?::(?:[0-9a-f]{1,4}:){2}|(?:(?:[0-9a-f]{1,4}:){0,3}[0-9a-f]{1,4})?::[0-9a-f]{1,4}:|(?:(?:[0-9a-f]{1,4}:){0,4}[0-9a-f]{1,4})?::)(?:[0-9a-f]{1,4}:[0-9a-f]{1,4}|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?))|(?:(?:[0-9a-f]{1,4}:){0,5}[0-9a-f]{1,4})?::[0-9a-f]{1,4}|(?:(?:[0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4})?::)|[Vv][0-9a-f]+\.[a-z0-9\-._~!$&'()*+,;=:]+)\]|(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)|(?:[a-z0-9\-._~!$&'()*+,;=]|%[0-9a-f]{2})*)(?::\d*)?(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*|\/(?:(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)?|(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})+(?:\/(?:[a-z0-9\-._~!$&'()*+,;=:@]|%[0-9a-f]{2})*)*)(?:\?(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?(?:#(?:[a-z0-9\-._~!$&'()*+,;=:@/?]|%[0-9a-f]{2})*)?$/i;
  function gu($) {
    return yu.test($) && xu.test($);
  }
  var l3 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/gm;
  function hu($) {
    return ((l3.lastIndex = 0), l3.test($));
  }
  var uu = -2147483648,
    lu = 2147483647;
  function mu($) {
    return Number.isInteger($) && $ <= lu && $ >= uu;
  }
  function pu($) {
    return Number.isInteger($);
  }
  function m3() {
    return !0;
  }
  var du = /[^\\]\\Z/;
  function cu($) {
    if (du.test($)) return !1;
    try {
      return (new RegExp($), !0);
    } catch (J) {
      return !1;
    }
  }
});
var a3 = P$((s3) => {
  Object.defineProperty(s3, "__esModule", { value: !0 });
  s3.formatLimitDefinition = void 0;
  var iu = uq(),
    XU = q6(),
    g8 = XU.operators,
    T5 = {
      formatMaximum: { okStr: "<=", ok: g8.LTE, fail: g8.GT },
      formatMinimum: { okStr: ">=", ok: g8.GTE, fail: g8.LT },
      formatExclusiveMaximum: { okStr: "<", ok: g8.LT, fail: g8.GTE },
      formatExclusiveMinimum: { okStr: ">", ok: g8.GT, fail: g8.LTE },
    },
    ou = {
      message: ({ keyword: $, schemaCode: J }) => XU.str`should be ${T5[$].okStr} ${J}`,
      params: ({ keyword: $, schemaCode: J }) => XU._`{comparison: ${T5[$].okStr}, limit: ${J}}`,
    };
  s3.formatLimitDefinition = {
    keyword: Object.keys(T5),
    type: "string",
    schemaType: "string",
    $data: !0,
    error: ou,
    code($) {
      let { gen: J, data: U, schemaCode: Q, keyword: W, it: X } = $,
        { opts: Y, self: D } = X;
      if (!Y.validateFormats) return;
      let H = new iu.KeywordCxt(X, D.RULES.all.format.definition, "format");
      if (H.$data) G();
      else K();
      function G() {
        let N = J.scopeValue("formats", { ref: D.formats, code: Y.code.formats }),
          F = J.const("fmt", XU._`${N}[${H.schemaCode}]`);
        $.fail$data(
          (0, XU.or)(
            XU._`typeof ${F} != "object"`,
            XU._`${F} instanceof RegExp`,
            XU._`typeof ${F}.compare != "function"`,
            O(F),
          ),
        );
      }
      function K() {
        let N = H.schema,
          F = D.formats[N];
        if (!F || F === !0) return;
        if (typeof F != "object" || F instanceof RegExp || typeof F.compare != "function")
          throw Error(`"${W}": format "${N}" does not define "compare" function`);
        let B = J.scopeValue("formats", {
          key: N,
          ref: F,
          code: Y.code.formats ? XU._`${Y.code.formats}${(0, XU.getProperty)(N)}` : void 0,
        });
        $.fail$data(O(B));
      }
      function O(N) {
        return XU._`${N}.compare(${U}, ${Q}) ${T5[W].fail} 0`;
      }
    },
    dependencies: ["format"],
  };
  var ru = ($) => {
    return ($.addKeyword(s3.formatLimitDefinition), $);
  };
  s3.default = ru;
});
var JR = P$((dQ, $R) => {
  Object.defineProperty(dQ, "__esModule", { value: !0 });
  var G1 = r3(),
    au = a3(),
    oq = q6(),
    t3 = new oq.Name("fullFormats"),
    tu = new oq.Name("fastFormats"),
    rq = ($, J = { keywords: !0 }) => {
      if (Array.isArray(J)) return (e3($, J, G1.fullFormats, t3), $);
      let [U, Q] = J.mode === "fast" ? [G1.fastFormats, tu] : [G1.fullFormats, t3],
        W = J.formats || G1.formatNames;
      if ((e3($, W, U, Q), J.keywords)) (0, au.default)($);
      return $;
    };
  rq.get = ($, J = "full") => {
    let Q = (J === "fast" ? G1.fastFormats : G1.fullFormats)[$];
    if (!Q) throw Error(`Unknown format "${$}"`);
    return Q;
  };
  function e3($, J, U, Q) {
    var W, X;
    ((W = (X = $.opts.code).formats) !== null && W !== void 0) ||
      (X.formats = oq._`require("ajv-formats/dist/formats").${Q}`);
    for (let Y of J) $.addFormat(Y, U[Y]);
  }
  $R.exports = dQ = rq;
  Object.defineProperty(dQ, "__esModule", { value: !0 });
  dQ.default = rq;
});
var M6;
(function ($) {
  $.assertEqual = (W) => {};
  function J(W) {}
  $.assertIs = J;
  function U(W) {
    throw Error();
  }
  (($.assertNever = U),
    ($.arrayToEnum = (W) => {
      let X = {};
      for (let Y of W) X[Y] = Y;
      return X;
    }),
    ($.getValidEnumValues = (W) => {
      let X = $.objectKeys(W).filter((D) => typeof W[W[D]] !== "number"),
        Y = {};
      for (let D of X) Y[D] = W[D];
      return $.objectValues(Y);
    }),
    ($.objectValues = (W) => {
      return $.objectKeys(W).map(function (X) {
        return W[X];
      });
    }),
    ($.objectKeys =
      typeof Object.keys === "function"
        ? (W) => Object.keys(W)
        : (W) => {
            let X = [];
            for (let Y in W) if (Object.prototype.hasOwnProperty.call(W, Y)) X.push(Y);
            return X;
          }),
    ($.find = (W, X) => {
      for (let Y of W) if (X(Y)) return Y;
      return;
    }),
    ($.isInteger =
      typeof Number.isInteger === "function"
        ? (W) => Number.isInteger(W)
        : (W) => typeof W === "number" && Number.isFinite(W) && Math.floor(W) === W));
  function Q(W, X = " | ") {
    return W.map((Y) => (typeof Y === "string" ? `'${Y}'` : Y)).join(X);
  }
  (($.joinValues = Q),
    ($.jsonStringifyReplacer = (W, X) => {
      if (typeof X === "bigint") return X.toString();
      return X;
    }));
})(M6 || (M6 = {}));
var WL;
(function ($) {
  $.mergeShapes = (J, U) => {
    return { ...J, ...U };
  };
})(WL || (WL = {}));
var F$ = M6.arrayToEnum([
    "string",
    "nan",
    "number",
    "integer",
    "float",
    "boolean",
    "date",
    "bigint",
    "symbol",
    "function",
    "undefined",
    "null",
    "array",
    "object",
    "unknown",
    "promise",
    "void",
    "never",
    "map",
    "set",
  ]),
  lU = ($) => {
    switch (typeof $) {
      case "undefined":
        return F$.undefined;
      case "string":
        return F$.string;
      case "number":
        return Number.isNaN($) ? F$.nan : F$.number;
      case "boolean":
        return F$.boolean;
      case "function":
        return F$.function;
      case "bigint":
        return F$.bigint;
      case "symbol":
        return F$.symbol;
      case "object":
        if (Array.isArray($)) return F$.array;
        if ($ === null) return F$.null;
        if ($.then && typeof $.then === "function" && $.catch && typeof $.catch === "function") return F$.promise;
        if (typeof Map < "u" && $ instanceof Map) return F$.map;
        if (typeof Set < "u" && $ instanceof Set) return F$.set;
        if (typeof Date < "u" && $ instanceof Date) return F$.date;
        return F$.object;
      default:
        return F$.unknown;
    }
  };
var Y$ = M6.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite",
]);
class _J extends Error {
  get errors() {
    return this.issues;
  }
  constructor($) {
    super();
    ((this.issues = []),
      (this.addIssue = (U) => {
        this.issues = [...this.issues, U];
      }),
      (this.addIssues = (U = []) => {
        this.issues = [...this.issues, ...U];
      }));
    let J = new.target.prototype;
    if (Object.setPrototypeOf) Object.setPrototypeOf(this, J);
    else this.__proto__ = J;
    ((this.name = "ZodError"), (this.issues = $));
  }
  format($) {
    let J =
        $ ||
        function (W) {
          return W.message;
        },
      U = { _errors: [] },
      Q = (W) => {
        for (let X of W.issues)
          if (X.code === "invalid_union") X.unionErrors.map(Q);
          else if (X.code === "invalid_return_type") Q(X.returnTypeError);
          else if (X.code === "invalid_arguments") Q(X.argumentsError);
          else if (X.path.length === 0) U._errors.push(J(X));
          else {
            let Y = U,
              D = 0;
            while (D < X.path.length) {
              let H = X.path[D];
              if (D !== X.path.length - 1) Y[H] = Y[H] || { _errors: [] };
              else ((Y[H] = Y[H] || { _errors: [] }), Y[H]._errors.push(J(X)));
              ((Y = Y[H]), D++);
            }
          }
      };
    return (Q(this), U);
  }
  static assert($) {
    if (!($ instanceof _J)) throw Error(`Not a ZodError: ${$}`);
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, M6.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten($ = (J) => J.message) {
    let J = Object.create(null),
      U = [];
    for (let Q of this.issues)
      if (Q.path.length > 0) {
        let W = Q.path[0];
        ((J[W] = J[W] || []), J[W].push($(Q)));
      } else U.push($(Q));
    return { formErrors: U, fieldErrors: J };
  }
  get formErrors() {
    return this.flatten();
  }
}
_J.create = ($) => {
  return new _J($);
};
var n_ = ($, J) => {
    let U;
    switch ($.code) {
      case Y$.invalid_type:
        if ($.received === F$.undefined) U = "Required";
        else U = `Expected ${$.expected}, received ${$.received}`;
        break;
      case Y$.invalid_literal:
        U = `Invalid literal value, expected ${JSON.stringify($.expected, M6.jsonStringifyReplacer)}`;
        break;
      case Y$.unrecognized_keys:
        U = `Unrecognized key(s) in object: ${M6.joinValues($.keys, ", ")}`;
        break;
      case Y$.invalid_union:
        U = "Invalid input";
        break;
      case Y$.invalid_union_discriminator:
        U = `Invalid discriminator value. Expected ${M6.joinValues($.options)}`;
        break;
      case Y$.invalid_enum_value:
        U = `Invalid enum value. Expected ${M6.joinValues($.options)}, received '${$.received}'`;
        break;
      case Y$.invalid_arguments:
        U = "Invalid function arguments";
        break;
      case Y$.invalid_return_type:
        U = "Invalid function return type";
        break;
      case Y$.invalid_date:
        U = "Invalid date";
        break;
      case Y$.invalid_string:
        if (typeof $.validation === "object")
          if ("includes" in $.validation) {
            if (
              ((U = `Invalid input: must include "${$.validation.includes}"`),
              typeof $.validation.position === "number")
            )
              U = `${U} at one or more positions greater than or equal to ${$.validation.position}`;
          } else if ("startsWith" in $.validation) U = `Invalid input: must start with "${$.validation.startsWith}"`;
          else if ("endsWith" in $.validation) U = `Invalid input: must end with "${$.validation.endsWith}"`;
          else M6.assertNever($.validation);
        else if ($.validation !== "regex") U = `Invalid ${$.validation}`;
        else U = "Invalid";
        break;
      case Y$.too_small:
        if ($.type === "array")
          U = `Array must contain ${$.exact ? "exactly" : $.inclusive ? "at least" : "more than"} ${$.minimum} element(s)`;
        else if ($.type === "string")
          U = `String must contain ${$.exact ? "exactly" : $.inclusive ? "at least" : "over"} ${$.minimum} character(s)`;
        else if ($.type === "number")
          U = `Number must be ${$.exact ? "exactly equal to " : $.inclusive ? "greater than or equal to " : "greater than "}${$.minimum}`;
        else if ($.type === "bigint")
          U = `Number must be ${$.exact ? "exactly equal to " : $.inclusive ? "greater than or equal to " : "greater than "}${$.minimum}`;
        else if ($.type === "date")
          U = `Date must be ${$.exact ? "exactly equal to " : $.inclusive ? "greater than or equal to " : "greater than "}${new Date(Number($.minimum))}`;
        else U = "Invalid input";
        break;
      case Y$.too_big:
        if ($.type === "array")
          U = `Array must contain ${$.exact ? "exactly" : $.inclusive ? "at most" : "less than"} ${$.maximum} element(s)`;
        else if ($.type === "string")
          U = `String must contain ${$.exact ? "exactly" : $.inclusive ? "at most" : "under"} ${$.maximum} character(s)`;
        else if ($.type === "number")
          U = `Number must be ${$.exact ? "exactly" : $.inclusive ? "less than or equal to" : "less than"} ${$.maximum}`;
        else if ($.type === "bigint")
          U = `BigInt must be ${$.exact ? "exactly" : $.inclusive ? "less than or equal to" : "less than"} ${$.maximum}`;
        else if ($.type === "date")
          U = `Date must be ${$.exact ? "exactly" : $.inclusive ? "smaller than or equal to" : "smaller than"} ${new Date(Number($.maximum))}`;
        else U = "Invalid input";
        break;
      case Y$.custom:
        U = "Invalid input";
        break;
      case Y$.invalid_intersection_types:
        U = "Intersection results could not be merged";
        break;
      case Y$.not_multiple_of:
        U = `Number must be a multiple of ${$.multipleOf}`;
        break;
      case Y$.not_finite:
        U = "Number must be finite";
        break;
      default:
        ((U = J.defaultError), M6.assertNever($));
    }
    return { message: U };
  },
  F8 = n_;
var i_ = F8;
function s1() {
  return i_;
}
var vX = ($) => {
  let { data: J, path: U, errorMaps: Q, issueData: W } = $,
    X = [...U, ...(W.path || [])],
    Y = { ...W, path: X };
  if (W.message !== void 0) return { ...W, path: X, message: W.message };
  let D = "",
    H = Q.filter((G) => !!G)
      .slice()
      .reverse();
  for (let G of H) D = G(Y, { data: J, defaultError: D }).message;
  return { ...W, path: X, message: D };
};
function w$($, J) {
  let U = s1(),
    Q = vX({
      issueData: J,
      data: $.data,
      path: $.path,
      errorMaps: [$.common.contextualErrorMap, $.schemaErrorMap, U, U === F8 ? void 0 : F8].filter((W) => !!W),
    });
  $.common.issues.push(Q);
}
class d0 {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid") this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted") this.value = "aborted";
  }
  static mergeArray($, J) {
    let U = [];
    for (let Q of J) {
      if (Q.status === "aborted") return a$;
      if (Q.status === "dirty") $.dirty();
      U.push(Q.value);
    }
    return { status: $.value, value: U };
  }
  static async mergeObjectAsync($, J) {
    let U = [];
    for (let Q of J) {
      let W = await Q.key,
        X = await Q.value;
      U.push({ key: W, value: X });
    }
    return d0.mergeObjectSync($, U);
  }
  static mergeObjectSync($, J) {
    let U = {};
    for (let Q of J) {
      let { key: W, value: X } = Q;
      if (W.status === "aborted") return a$;
      if (X.status === "aborted") return a$;
      if (W.status === "dirty") $.dirty();
      if (X.status === "dirty") $.dirty();
      if (W.value !== "__proto__" && (typeof X.value < "u" || Q.alwaysSet)) U[W.value] = X.value;
    }
    return { status: $.value, value: U };
  }
}
var a$ = Object.freeze({ status: "aborted" }),
  UW = ($) => ({ status: "dirty", value: $ }),
  $J = ($) => ({ status: "valid", value: $ }),
  $K = ($) => $.status === "aborted",
  JK = ($) => $.status === "dirty",
  H9 = ($) => $.status === "valid",
  a1 = ($) => typeof Promise < "u" && $ instanceof Promise;
var f$;
(function ($) {
  (($.errToObj = (J) => (typeof J === "string" ? { message: J } : J || {})),
    ($.toString = (J) => (typeof J === "string" ? J : J?.message)));
})(f$ || (f$ = {}));
class rJ {
  constructor($, J, U, Q) {
    ((this._cachedPath = []), (this.parent = $), (this.data = J), (this._path = U), (this._key = Q));
  }
  get path() {
    if (!this._cachedPath.length)
      if (Array.isArray(this._key)) this._cachedPath.push(...this._path, ...this._key);
      else this._cachedPath.push(...this._path, this._key);
    return this._cachedPath;
  }
}
var QL = ($, J) => {
  if (H9(J)) return { success: !0, data: J.value };
  else {
    if (!$.common.issues.length) throw Error("Validation failed but no issues detected.");
    return {
      success: !1,
      get error() {
        if (this._error) return this._error;
        let U = new _J($.common.issues);
        return ((this._error = U), this._error);
      },
    };
  }
};
function H6($) {
  if (!$) return {};
  let { errorMap: J, invalid_type_error: U, required_error: Q, description: W } = $;
  if (J && (U || Q))
    throw Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  if (J) return { errorMap: J, description: W };
  return {
    errorMap: (Y, D) => {
      let { message: H } = $;
      if (Y.code === "invalid_enum_value") return { message: H ?? D.defaultError };
      if (typeof D.data > "u") return { message: H ?? Q ?? D.defaultError };
      if (Y.code !== "invalid_type") return { message: D.defaultError };
      return { message: H ?? U ?? D.defaultError };
    },
    description: W,
  };
}
class I6 {
  get description() {
    return this._def.description;
  }
  _getType($) {
    return lU($.data);
  }
  _getOrReturnCtx($, J) {
    return (
      J || {
        common: $.parent.common,
        data: $.data,
        parsedType: lU($.data),
        schemaErrorMap: this._def.errorMap,
        path: $.path,
        parent: $.parent,
      }
    );
  }
  _processInputParams($) {
    return {
      status: new d0(),
      ctx: {
        common: $.parent.common,
        data: $.data,
        parsedType: lU($.data),
        schemaErrorMap: this._def.errorMap,
        path: $.path,
        parent: $.parent,
      },
    };
  }
  _parseSync($) {
    let J = this._parse($);
    if (a1(J)) throw Error("Synchronous parse encountered promise.");
    return J;
  }
  _parseAsync($) {
    let J = this._parse($);
    return Promise.resolve(J);
  }
  parse($, J) {
    let U = this.safeParse($, J);
    if (U.success) return U.data;
    throw U.error;
  }
  safeParse($, J) {
    let U = {
        common: { issues: [], async: J?.async ?? !1, contextualErrorMap: J?.errorMap },
        path: J?.path || [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data: $,
        parsedType: lU($),
      },
      Q = this._parseSync({ data: $, path: U.path, parent: U });
    return QL(U, Q);
  }
  "~validate"($) {
    let J = {
      common: { issues: [], async: !!this["~standard"].async },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data: $,
      parsedType: lU($),
    };
    if (!this["~standard"].async)
      try {
        let U = this._parseSync({ data: $, path: [], parent: J });
        return H9(U) ? { value: U.value } : { issues: J.common.issues };
      } catch (U) {
        if (U?.message?.toLowerCase()?.includes("encountered")) this["~standard"].async = !0;
        J.common = { issues: [], async: !0 };
      }
    return this._parseAsync({ data: $, path: [], parent: J }).then((U) =>
      H9(U) ? { value: U.value } : { issues: J.common.issues },
    );
  }
  async parseAsync($, J) {
    let U = await this.safeParseAsync($, J);
    if (U.success) return U.data;
    throw U.error;
  }
  async safeParseAsync($, J) {
    let U = {
        common: { issues: [], contextualErrorMap: J?.errorMap, async: !0 },
        path: J?.path || [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data: $,
        parsedType: lU($),
      },
      Q = this._parse({ data: $, path: U.path, parent: U }),
      W = await (a1(Q) ? Q : Promise.resolve(Q));
    return QL(U, W);
  }
  refine($, J) {
    let U = (Q) => {
      if (typeof J === "string" || typeof J > "u") return { message: J };
      else if (typeof J === "function") return J(Q);
      else return J;
    };
    return this._refinement((Q, W) => {
      let X = $(Q),
        Y = () => W.addIssue({ code: Y$.custom, ...U(Q) });
      if (typeof Promise < "u" && X instanceof Promise)
        return X.then((D) => {
          if (!D) return (Y(), !1);
          else return !0;
        });
      if (!X) return (Y(), !1);
      else return !0;
    });
  }
  refinement($, J) {
    return this._refinement((U, Q) => {
      if (!$(U)) return (Q.addIssue(typeof J === "function" ? J(U, Q) : J), !1);
      else return !0;
    });
  }
  _refinement($) {
    return new VU({ schema: this, typeName: D$.ZodEffects, effect: { type: "refinement", refinement: $ } });
  }
  superRefine($) {
    return this._refinement($);
  }
  constructor($) {
    ((this.spa = this.safeParseAsync),
      (this._def = $),
      (this.parse = this.parse.bind(this)),
      (this.safeParse = this.safeParse.bind(this)),
      (this.parseAsync = this.parseAsync.bind(this)),
      (this.safeParseAsync = this.safeParseAsync.bind(this)),
      (this.spa = this.spa.bind(this)),
      (this.refine = this.refine.bind(this)),
      (this.refinement = this.refinement.bind(this)),
      (this.superRefine = this.superRefine.bind(this)),
      (this.optional = this.optional.bind(this)),
      (this.nullable = this.nullable.bind(this)),
      (this.nullish = this.nullish.bind(this)),
      (this.array = this.array.bind(this)),
      (this.promise = this.promise.bind(this)),
      (this.or = this.or.bind(this)),
      (this.and = this.and.bind(this)),
      (this.transform = this.transform.bind(this)),
      (this.brand = this.brand.bind(this)),
      (this.default = this.default.bind(this)),
      (this.catch = this.catch.bind(this)),
      (this.describe = this.describe.bind(this)),
      (this.pipe = this.pipe.bind(this)),
      (this.readonly = this.readonly.bind(this)),
      (this.isNullable = this.isNullable.bind(this)),
      (this.isOptional = this.isOptional.bind(this)),
      (this["~standard"] = { version: 1, vendor: "zod", validate: (J) => this["~validate"](J) }));
  }
  optional() {
    return IU.create(this, this._def);
  }
  nullable() {
    return q8.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return wU.create(this);
  }
  promise() {
    return DW.create(this, this._def);
  }
  or($) {
    return U7.create([this, $], this._def);
  }
  and($) {
    return W7.create(this, $, this._def);
  }
  transform($) {
    return new VU({
      ...H6(this._def),
      schema: this,
      typeName: D$.ZodEffects,
      effect: { type: "transform", transform: $ },
    });
  }
  default($) {
    let J = typeof $ === "function" ? $ : () => $;
    return new D7({ ...H6(this._def), innerType: this, defaultValue: J, typeName: D$.ZodDefault });
  }
  brand() {
    return new XK({ typeName: D$.ZodBranded, type: this, ...H6(this._def) });
  }
  catch($) {
    let J = typeof $ === "function" ? $ : () => $;
    return new H7({ ...H6(this._def), innerType: this, catchValue: J, typeName: D$.ZodCatch });
  }
  describe($) {
    return new this.constructor({ ...this._def, description: $ });
  }
  pipe($) {
    return lX.create(this, $);
  }
  readonly() {
    return G7.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
}
var o_ = /^c[^\s-]{8,}$/i,
  r_ = /^[0-9a-z]+$/,
  s_ = /^[0-9A-HJKMNP-TV-Z]{26}$/i,
  a_ = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i,
  t_ = /^[a-z0-9_-]{21}$/i,
  e_ = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,
  $S =
    /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/,
  JS = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i,
  US = "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$",
  UK,
  WS =
    /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,
  QS =
    /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/,
  XS =
    /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,
  YS =
    /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,
  DS = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/,
  HS = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/,
  XL =
    "((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))",
  GS = new RegExp(`^${XL}$`);
function YL($) {
  let J = "[0-5]\\d";
  if ($.precision) J = `${J}\\.\\d{${$.precision}}`;
  else if ($.precision == null) J = `${J}(\\.\\d+)?`;
  let U = $.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${J})${U}`;
}
function KS($) {
  return new RegExp(`^${YL($)}$`);
}
function NS($) {
  let J = `${XL}T${YL($)}`,
    U = [];
  if ((U.push($.local ? "Z?" : "Z"), $.offset)) U.push("([+-]\\d{2}:?\\d{2})");
  return ((J = `${J}(${U.join("|")})`), new RegExp(`^${J}$`));
}
function OS($, J) {
  if ((J === "v4" || !J) && WS.test($)) return !0;
  if ((J === "v6" || !J) && XS.test($)) return !0;
  return !1;
}
function FS($, J) {
  if (!e_.test($)) return !1;
  try {
    let [U] = $.split(".");
    if (!U) return !1;
    let Q = U.replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(U.length + ((4 - (U.length % 4)) % 4), "="),
      W = JSON.parse(atob(Q));
    if (typeof W !== "object" || W === null) return !1;
    if ("typ" in W && W?.typ !== "JWT") return !1;
    if (!W.alg) return !1;
    if (J && W.alg !== J) return !1;
    return !0;
  } catch {
    return !1;
  }
}
function qS($, J) {
  if ((J === "v4" || !J) && QS.test($)) return !0;
  if ((J === "v6" || !J) && YS.test($)) return !0;
  return !1;
}
class pU extends I6 {
  _parse($) {
    if (this._def.coerce) $.data = String($.data);
    if (this._getType($) !== F$.string) {
      let W = this._getOrReturnCtx($);
      return (w$(W, { code: Y$.invalid_type, expected: F$.string, received: W.parsedType }), a$);
    }
    let U = new d0(),
      Q = void 0;
    for (let W of this._def.checks)
      if (W.kind === "min") {
        if ($.data.length < W.value)
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, {
              code: Y$.too_small,
              minimum: W.value,
              type: "string",
              inclusive: !0,
              exact: !1,
              message: W.message,
            }),
            U.dirty());
      } else if (W.kind === "max") {
        if ($.data.length > W.value)
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { code: Y$.too_big, maximum: W.value, type: "string", inclusive: !0, exact: !1, message: W.message }),
            U.dirty());
      } else if (W.kind === "length") {
        let X = $.data.length > W.value,
          Y = $.data.length < W.value;
        if (X || Y) {
          if (((Q = this._getOrReturnCtx($, Q)), X))
            w$(Q, { code: Y$.too_big, maximum: W.value, type: "string", inclusive: !0, exact: !0, message: W.message });
          else if (Y)
            w$(Q, {
              code: Y$.too_small,
              minimum: W.value,
              type: "string",
              inclusive: !0,
              exact: !0,
              message: W.message,
            });
          U.dirty();
        }
      } else if (W.kind === "email") {
        if (!JS.test($.data))
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { validation: "email", code: Y$.invalid_string, message: W.message }),
            U.dirty());
      } else if (W.kind === "emoji") {
        if (!UK) UK = new RegExp(US, "u");
        if (!UK.test($.data))
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { validation: "emoji", code: Y$.invalid_string, message: W.message }),
            U.dirty());
      } else if (W.kind === "uuid") {
        if (!a_.test($.data))
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { validation: "uuid", code: Y$.invalid_string, message: W.message }),
            U.dirty());
      } else if (W.kind === "nanoid") {
        if (!t_.test($.data))
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { validation: "nanoid", code: Y$.invalid_string, message: W.message }),
            U.dirty());
      } else if (W.kind === "cuid") {
        if (!o_.test($.data))
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { validation: "cuid", code: Y$.invalid_string, message: W.message }),
            U.dirty());
      } else if (W.kind === "cuid2") {
        if (!r_.test($.data))
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { validation: "cuid2", code: Y$.invalid_string, message: W.message }),
            U.dirty());
      } else if (W.kind === "ulid") {
        if (!s_.test($.data))
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { validation: "ulid", code: Y$.invalid_string, message: W.message }),
            U.dirty());
      } else if (W.kind === "url")
        try {
          new URL($.data);
        } catch {
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { validation: "url", code: Y$.invalid_string, message: W.message }),
            U.dirty());
        }
      else if (W.kind === "regex") {
        if (((W.regex.lastIndex = 0), !W.regex.test($.data)))
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { validation: "regex", code: Y$.invalid_string, message: W.message }),
            U.dirty());
      } else if (W.kind === "trim") $.data = $.data.trim();
      else if (W.kind === "includes") {
        if (!$.data.includes(W.value, W.position))
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, {
              code: Y$.invalid_string,
              validation: { includes: W.value, position: W.position },
              message: W.message,
            }),
            U.dirty());
      } else if (W.kind === "toLowerCase") $.data = $.data.toLowerCase();
      else if (W.kind === "toUpperCase") $.data = $.data.toUpperCase();
      else if (W.kind === "startsWith") {
        if (!$.data.startsWith(W.value))
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { code: Y$.invalid_string, validation: { startsWith: W.value }, message: W.message }),
            U.dirty());
      } else if (W.kind === "endsWith") {
        if (!$.data.endsWith(W.value))
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { code: Y$.invalid_string, validation: { endsWith: W.value }, message: W.message }),
            U.dirty());
      } else if (W.kind === "datetime") {
        if (!NS(W).test($.data))
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { code: Y$.invalid_string, validation: "datetime", message: W.message }),
            U.dirty());
      } else if (W.kind === "date") {
        if (!GS.test($.data))
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { code: Y$.invalid_string, validation: "date", message: W.message }),
            U.dirty());
      } else if (W.kind === "time") {
        if (!KS(W).test($.data))
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { code: Y$.invalid_string, validation: "time", message: W.message }),
            U.dirty());
      } else if (W.kind === "duration") {
        if (!$S.test($.data))
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { validation: "duration", code: Y$.invalid_string, message: W.message }),
            U.dirty());
      } else if (W.kind === "ip") {
        if (!OS($.data, W.version))
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { validation: "ip", code: Y$.invalid_string, message: W.message }),
            U.dirty());
      } else if (W.kind === "jwt") {
        if (!FS($.data, W.alg))
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { validation: "jwt", code: Y$.invalid_string, message: W.message }),
            U.dirty());
      } else if (W.kind === "cidr") {
        if (!qS($.data, W.version))
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { validation: "cidr", code: Y$.invalid_string, message: W.message }),
            U.dirty());
      } else if (W.kind === "base64") {
        if (!DS.test($.data))
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { validation: "base64", code: Y$.invalid_string, message: W.message }),
            U.dirty());
      } else if (W.kind === "base64url") {
        if (!HS.test($.data))
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { validation: "base64url", code: Y$.invalid_string, message: W.message }),
            U.dirty());
      } else M6.assertNever(W);
    return { status: U.value, value: $.data };
  }
  _regex($, J, U) {
    return this.refinement((Q) => $.test(Q), { validation: J, code: Y$.invalid_string, ...f$.errToObj(U) });
  }
  _addCheck($) {
    return new pU({ ...this._def, checks: [...this._def.checks, $] });
  }
  email($) {
    return this._addCheck({ kind: "email", ...f$.errToObj($) });
  }
  url($) {
    return this._addCheck({ kind: "url", ...f$.errToObj($) });
  }
  emoji($) {
    return this._addCheck({ kind: "emoji", ...f$.errToObj($) });
  }
  uuid($) {
    return this._addCheck({ kind: "uuid", ...f$.errToObj($) });
  }
  nanoid($) {
    return this._addCheck({ kind: "nanoid", ...f$.errToObj($) });
  }
  cuid($) {
    return this._addCheck({ kind: "cuid", ...f$.errToObj($) });
  }
  cuid2($) {
    return this._addCheck({ kind: "cuid2", ...f$.errToObj($) });
  }
  ulid($) {
    return this._addCheck({ kind: "ulid", ...f$.errToObj($) });
  }
  base64($) {
    return this._addCheck({ kind: "base64", ...f$.errToObj($) });
  }
  base64url($) {
    return this._addCheck({ kind: "base64url", ...f$.errToObj($) });
  }
  jwt($) {
    return this._addCheck({ kind: "jwt", ...f$.errToObj($) });
  }
  ip($) {
    return this._addCheck({ kind: "ip", ...f$.errToObj($) });
  }
  cidr($) {
    return this._addCheck({ kind: "cidr", ...f$.errToObj($) });
  }
  datetime($) {
    if (typeof $ === "string")
      return this._addCheck({ kind: "datetime", precision: null, offset: !1, local: !1, message: $ });
    return this._addCheck({
      kind: "datetime",
      precision: typeof $?.precision > "u" ? null : $?.precision,
      offset: $?.offset ?? !1,
      local: $?.local ?? !1,
      ...f$.errToObj($?.message),
    });
  }
  date($) {
    return this._addCheck({ kind: "date", message: $ });
  }
  time($) {
    if (typeof $ === "string") return this._addCheck({ kind: "time", precision: null, message: $ });
    return this._addCheck({
      kind: "time",
      precision: typeof $?.precision > "u" ? null : $?.precision,
      ...f$.errToObj($?.message),
    });
  }
  duration($) {
    return this._addCheck({ kind: "duration", ...f$.errToObj($) });
  }
  regex($, J) {
    return this._addCheck({ kind: "regex", regex: $, ...f$.errToObj(J) });
  }
  includes($, J) {
    return this._addCheck({ kind: "includes", value: $, position: J?.position, ...f$.errToObj(J?.message) });
  }
  startsWith($, J) {
    return this._addCheck({ kind: "startsWith", value: $, ...f$.errToObj(J) });
  }
  endsWith($, J) {
    return this._addCheck({ kind: "endsWith", value: $, ...f$.errToObj(J) });
  }
  min($, J) {
    return this._addCheck({ kind: "min", value: $, ...f$.errToObj(J) });
  }
  max($, J) {
    return this._addCheck({ kind: "max", value: $, ...f$.errToObj(J) });
  }
  length($, J) {
    return this._addCheck({ kind: "length", value: $, ...f$.errToObj(J) });
  }
  nonempty($) {
    return this.min(1, f$.errToObj($));
  }
  trim() {
    return new pU({ ...this._def, checks: [...this._def.checks, { kind: "trim" }] });
  }
  toLowerCase() {
    return new pU({ ...this._def, checks: [...this._def.checks, { kind: "toLowerCase" }] });
  }
  toUpperCase() {
    return new pU({ ...this._def, checks: [...this._def.checks, { kind: "toUpperCase" }] });
  }
  get isDatetime() {
    return !!this._def.checks.find(($) => $.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find(($) => $.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find(($) => $.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find(($) => $.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find(($) => $.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find(($) => $.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find(($) => $.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find(($) => $.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find(($) => $.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find(($) => $.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find(($) => $.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find(($) => $.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find(($) => $.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find(($) => $.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find(($) => $.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find(($) => $.kind === "base64url");
  }
  get minLength() {
    let $ = null;
    for (let J of this._def.checks)
      if (J.kind === "min") {
        if ($ === null || J.value > $) $ = J.value;
      }
    return $;
  }
  get maxLength() {
    let $ = null;
    for (let J of this._def.checks)
      if (J.kind === "max") {
        if ($ === null || J.value < $) $ = J.value;
      }
    return $;
  }
}
pU.create = ($) => {
  return new pU({ checks: [], typeName: D$.ZodString, coerce: $?.coerce ?? !1, ...H6($) });
};
function zS($, J) {
  let U = ($.toString().split(".")[1] || "").length,
    Q = (J.toString().split(".")[1] || "").length,
    W = U > Q ? U : Q,
    X = Number.parseInt($.toFixed(W).replace(".", "")),
    Y = Number.parseInt(J.toFixed(W).replace(".", ""));
  return (X % Y) / 10 ** W;
}
class QW extends I6 {
  constructor() {
    super(...arguments);
    ((this.min = this.gte), (this.max = this.lte), (this.step = this.multipleOf));
  }
  _parse($) {
    if (this._def.coerce) $.data = Number($.data);
    if (this._getType($) !== F$.number) {
      let W = this._getOrReturnCtx($);
      return (w$(W, { code: Y$.invalid_type, expected: F$.number, received: W.parsedType }), a$);
    }
    let U = void 0,
      Q = new d0();
    for (let W of this._def.checks)
      if (W.kind === "int") {
        if (!M6.isInteger($.data))
          ((U = this._getOrReturnCtx($, U)),
            w$(U, { code: Y$.invalid_type, expected: "integer", received: "float", message: W.message }),
            Q.dirty());
      } else if (W.kind === "min") {
        if (W.inclusive ? $.data < W.value : $.data <= W.value)
          ((U = this._getOrReturnCtx($, U)),
            w$(U, {
              code: Y$.too_small,
              minimum: W.value,
              type: "number",
              inclusive: W.inclusive,
              exact: !1,
              message: W.message,
            }),
            Q.dirty());
      } else if (W.kind === "max") {
        if (W.inclusive ? $.data > W.value : $.data >= W.value)
          ((U = this._getOrReturnCtx($, U)),
            w$(U, {
              code: Y$.too_big,
              maximum: W.value,
              type: "number",
              inclusive: W.inclusive,
              exact: !1,
              message: W.message,
            }),
            Q.dirty());
      } else if (W.kind === "multipleOf") {
        if (zS($.data, W.value) !== 0)
          ((U = this._getOrReturnCtx($, U)),
            w$(U, { code: Y$.not_multiple_of, multipleOf: W.value, message: W.message }),
            Q.dirty());
      } else if (W.kind === "finite") {
        if (!Number.isFinite($.data))
          ((U = this._getOrReturnCtx($, U)), w$(U, { code: Y$.not_finite, message: W.message }), Q.dirty());
      } else M6.assertNever(W);
    return { status: Q.value, value: $.data };
  }
  gte($, J) {
    return this.setLimit("min", $, !0, f$.toString(J));
  }
  gt($, J) {
    return this.setLimit("min", $, !1, f$.toString(J));
  }
  lte($, J) {
    return this.setLimit("max", $, !0, f$.toString(J));
  }
  lt($, J) {
    return this.setLimit("max", $, !1, f$.toString(J));
  }
  setLimit($, J, U, Q) {
    return new QW({
      ...this._def,
      checks: [...this._def.checks, { kind: $, value: J, inclusive: U, message: f$.toString(Q) }],
    });
  }
  _addCheck($) {
    return new QW({ ...this._def, checks: [...this._def.checks, $] });
  }
  int($) {
    return this._addCheck({ kind: "int", message: f$.toString($) });
  }
  positive($) {
    return this._addCheck({ kind: "min", value: 0, inclusive: !1, message: f$.toString($) });
  }
  negative($) {
    return this._addCheck({ kind: "max", value: 0, inclusive: !1, message: f$.toString($) });
  }
  nonpositive($) {
    return this._addCheck({ kind: "max", value: 0, inclusive: !0, message: f$.toString($) });
  }
  nonnegative($) {
    return this._addCheck({ kind: "min", value: 0, inclusive: !0, message: f$.toString($) });
  }
  multipleOf($, J) {
    return this._addCheck({ kind: "multipleOf", value: $, message: f$.toString(J) });
  }
  finite($) {
    return this._addCheck({ kind: "finite", message: f$.toString($) });
  }
  safe($) {
    return this._addCheck({
      kind: "min",
      inclusive: !0,
      value: Number.MIN_SAFE_INTEGER,
      message: f$.toString($),
    })._addCheck({ kind: "max", inclusive: !0, value: Number.MAX_SAFE_INTEGER, message: f$.toString($) });
  }
  get minValue() {
    let $ = null;
    for (let J of this._def.checks)
      if (J.kind === "min") {
        if ($ === null || J.value > $) $ = J.value;
      }
    return $;
  }
  get maxValue() {
    let $ = null;
    for (let J of this._def.checks)
      if (J.kind === "max") {
        if ($ === null || J.value < $) $ = J.value;
      }
    return $;
  }
  get isInt() {
    return !!this._def.checks.find(($) => $.kind === "int" || ($.kind === "multipleOf" && M6.isInteger($.value)));
  }
  get isFinite() {
    let $ = null,
      J = null;
    for (let U of this._def.checks)
      if (U.kind === "finite" || U.kind === "int" || U.kind === "multipleOf") return !0;
      else if (U.kind === "min") {
        if (J === null || U.value > J) J = U.value;
      } else if (U.kind === "max") {
        if ($ === null || U.value < $) $ = U.value;
      }
    return Number.isFinite(J) && Number.isFinite($);
  }
}
QW.create = ($) => {
  return new QW({ checks: [], typeName: D$.ZodNumber, coerce: $?.coerce || !1, ...H6($) });
};
class XW extends I6 {
  constructor() {
    super(...arguments);
    ((this.min = this.gte), (this.max = this.lte));
  }
  _parse($) {
    if (this._def.coerce)
      try {
        $.data = BigInt($.data);
      } catch {
        return this._getInvalidInput($);
      }
    if (this._getType($) !== F$.bigint) return this._getInvalidInput($);
    let U = void 0,
      Q = new d0();
    for (let W of this._def.checks)
      if (W.kind === "min") {
        if (W.inclusive ? $.data < W.value : $.data <= W.value)
          ((U = this._getOrReturnCtx($, U)),
            w$(U, { code: Y$.too_small, type: "bigint", minimum: W.value, inclusive: W.inclusive, message: W.message }),
            Q.dirty());
      } else if (W.kind === "max") {
        if (W.inclusive ? $.data > W.value : $.data >= W.value)
          ((U = this._getOrReturnCtx($, U)),
            w$(U, { code: Y$.too_big, type: "bigint", maximum: W.value, inclusive: W.inclusive, message: W.message }),
            Q.dirty());
      } else if (W.kind === "multipleOf") {
        if ($.data % W.value !== BigInt(0))
          ((U = this._getOrReturnCtx($, U)),
            w$(U, { code: Y$.not_multiple_of, multipleOf: W.value, message: W.message }),
            Q.dirty());
      } else M6.assertNever(W);
    return { status: Q.value, value: $.data };
  }
  _getInvalidInput($) {
    let J = this._getOrReturnCtx($);
    return (w$(J, { code: Y$.invalid_type, expected: F$.bigint, received: J.parsedType }), a$);
  }
  gte($, J) {
    return this.setLimit("min", $, !0, f$.toString(J));
  }
  gt($, J) {
    return this.setLimit("min", $, !1, f$.toString(J));
  }
  lte($, J) {
    return this.setLimit("max", $, !0, f$.toString(J));
  }
  lt($, J) {
    return this.setLimit("max", $, !1, f$.toString(J));
  }
  setLimit($, J, U, Q) {
    return new XW({
      ...this._def,
      checks: [...this._def.checks, { kind: $, value: J, inclusive: U, message: f$.toString(Q) }],
    });
  }
  _addCheck($) {
    return new XW({ ...this._def, checks: [...this._def.checks, $] });
  }
  positive($) {
    return this._addCheck({ kind: "min", value: BigInt(0), inclusive: !1, message: f$.toString($) });
  }
  negative($) {
    return this._addCheck({ kind: "max", value: BigInt(0), inclusive: !1, message: f$.toString($) });
  }
  nonpositive($) {
    return this._addCheck({ kind: "max", value: BigInt(0), inclusive: !0, message: f$.toString($) });
  }
  nonnegative($) {
    return this._addCheck({ kind: "min", value: BigInt(0), inclusive: !0, message: f$.toString($) });
  }
  multipleOf($, J) {
    return this._addCheck({ kind: "multipleOf", value: $, message: f$.toString(J) });
  }
  get minValue() {
    let $ = null;
    for (let J of this._def.checks)
      if (J.kind === "min") {
        if ($ === null || J.value > $) $ = J.value;
      }
    return $;
  }
  get maxValue() {
    let $ = null;
    for (let J of this._def.checks)
      if (J.kind === "max") {
        if ($ === null || J.value < $) $ = J.value;
      }
    return $;
  }
}
XW.create = ($) => {
  return new XW({ checks: [], typeName: D$.ZodBigInt, coerce: $?.coerce ?? !1, ...H6($) });
};
class bX extends I6 {
  _parse($) {
    if (this._def.coerce) $.data = Boolean($.data);
    if (this._getType($) !== F$.boolean) {
      let U = this._getOrReturnCtx($);
      return (w$(U, { code: Y$.invalid_type, expected: F$.boolean, received: U.parsedType }), a$);
    }
    return $J($.data);
  }
}
bX.create = ($) => {
  return new bX({ typeName: D$.ZodBoolean, coerce: $?.coerce || !1, ...H6($) });
};
class e1 extends I6 {
  _parse($) {
    if (this._def.coerce) $.data = new Date($.data);
    if (this._getType($) !== F$.date) {
      let W = this._getOrReturnCtx($);
      return (w$(W, { code: Y$.invalid_type, expected: F$.date, received: W.parsedType }), a$);
    }
    if (Number.isNaN($.data.getTime())) {
      let W = this._getOrReturnCtx($);
      return (w$(W, { code: Y$.invalid_date }), a$);
    }
    let U = new d0(),
      Q = void 0;
    for (let W of this._def.checks)
      if (W.kind === "min") {
        if ($.data.getTime() < W.value)
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { code: Y$.too_small, message: W.message, inclusive: !0, exact: !1, minimum: W.value, type: "date" }),
            U.dirty());
      } else if (W.kind === "max") {
        if ($.data.getTime() > W.value)
          ((Q = this._getOrReturnCtx($, Q)),
            w$(Q, { code: Y$.too_big, message: W.message, inclusive: !0, exact: !1, maximum: W.value, type: "date" }),
            U.dirty());
      } else M6.assertNever(W);
    return { status: U.value, value: new Date($.data.getTime()) };
  }
  _addCheck($) {
    return new e1({ ...this._def, checks: [...this._def.checks, $] });
  }
  min($, J) {
    return this._addCheck({ kind: "min", value: $.getTime(), message: f$.toString(J) });
  }
  max($, J) {
    return this._addCheck({ kind: "max", value: $.getTime(), message: f$.toString(J) });
  }
  get minDate() {
    let $ = null;
    for (let J of this._def.checks)
      if (J.kind === "min") {
        if ($ === null || J.value > $) $ = J.value;
      }
    return $ != null ? new Date($) : null;
  }
  get maxDate() {
    let $ = null;
    for (let J of this._def.checks)
      if (J.kind === "max") {
        if ($ === null || J.value < $) $ = J.value;
      }
    return $ != null ? new Date($) : null;
  }
}
e1.create = ($) => {
  return new e1({ checks: [], coerce: $?.coerce || !1, typeName: D$.ZodDate, ...H6($) });
};
class fX extends I6 {
  _parse($) {
    if (this._getType($) !== F$.symbol) {
      let U = this._getOrReturnCtx($);
      return (w$(U, { code: Y$.invalid_type, expected: F$.symbol, received: U.parsedType }), a$);
    }
    return $J($.data);
  }
}
fX.create = ($) => {
  return new fX({ typeName: D$.ZodSymbol, ...H6($) });
};
class $7 extends I6 {
  _parse($) {
    if (this._getType($) !== F$.undefined) {
      let U = this._getOrReturnCtx($);
      return (w$(U, { code: Y$.invalid_type, expected: F$.undefined, received: U.parsedType }), a$);
    }
    return $J($.data);
  }
}
$7.create = ($) => {
  return new $7({ typeName: D$.ZodUndefined, ...H6($) });
};
class J7 extends I6 {
  _parse($) {
    if (this._getType($) !== F$.null) {
      let U = this._getOrReturnCtx($);
      return (w$(U, { code: Y$.invalid_type, expected: F$.null, received: U.parsedType }), a$);
    }
    return $J($.data);
  }
}
J7.create = ($) => {
  return new J7({ typeName: D$.ZodNull, ...H6($) });
};
class yX extends I6 {
  constructor() {
    super(...arguments);
    this._any = !0;
  }
  _parse($) {
    return $J($.data);
  }
}
yX.create = ($) => {
  return new yX({ typeName: D$.ZodAny, ...H6($) });
};
class G9 extends I6 {
  constructor() {
    super(...arguments);
    this._unknown = !0;
  }
  _parse($) {
    return $J($.data);
  }
}
G9.create = ($) => {
  return new G9({ typeName: D$.ZodUnknown, ...H6($) });
};
class dU extends I6 {
  _parse($) {
    let J = this._getOrReturnCtx($);
    return (w$(J, { code: Y$.invalid_type, expected: F$.never, received: J.parsedType }), a$);
  }
}
dU.create = ($) => {
  return new dU({ typeName: D$.ZodNever, ...H6($) });
};
class xX extends I6 {
  _parse($) {
    if (this._getType($) !== F$.undefined) {
      let U = this._getOrReturnCtx($);
      return (w$(U, { code: Y$.invalid_type, expected: F$.void, received: U.parsedType }), a$);
    }
    return $J($.data);
  }
}
xX.create = ($) => {
  return new xX({ typeName: D$.ZodVoid, ...H6($) });
};
class wU extends I6 {
  _parse($) {
    let { ctx: J, status: U } = this._processInputParams($),
      Q = this._def;
    if (J.parsedType !== F$.array)
      return (w$(J, { code: Y$.invalid_type, expected: F$.array, received: J.parsedType }), a$);
    if (Q.exactLength !== null) {
      let X = J.data.length > Q.exactLength.value,
        Y = J.data.length < Q.exactLength.value;
      if (X || Y)
        (w$(J, {
          code: X ? Y$.too_big : Y$.too_small,
          minimum: Y ? Q.exactLength.value : void 0,
          maximum: X ? Q.exactLength.value : void 0,
          type: "array",
          inclusive: !0,
          exact: !0,
          message: Q.exactLength.message,
        }),
          U.dirty());
    }
    if (Q.minLength !== null) {
      if (J.data.length < Q.minLength.value)
        (w$(J, {
          code: Y$.too_small,
          minimum: Q.minLength.value,
          type: "array",
          inclusive: !0,
          exact: !1,
          message: Q.minLength.message,
        }),
          U.dirty());
    }
    if (Q.maxLength !== null) {
      if (J.data.length > Q.maxLength.value)
        (w$(J, {
          code: Y$.too_big,
          maximum: Q.maxLength.value,
          type: "array",
          inclusive: !0,
          exact: !1,
          message: Q.maxLength.message,
        }),
          U.dirty());
    }
    if (J.common.async)
      return Promise.all(
        [...J.data].map((X, Y) => {
          return Q.type._parseAsync(new rJ(J, X, J.path, Y));
        }),
      ).then((X) => {
        return d0.mergeArray(U, X);
      });
    let W = [...J.data].map((X, Y) => {
      return Q.type._parseSync(new rJ(J, X, J.path, Y));
    });
    return d0.mergeArray(U, W);
  }
  get element() {
    return this._def.type;
  }
  min($, J) {
    return new wU({ ...this._def, minLength: { value: $, message: f$.toString(J) } });
  }
  max($, J) {
    return new wU({ ...this._def, maxLength: { value: $, message: f$.toString(J) } });
  }
  length($, J) {
    return new wU({ ...this._def, exactLength: { value: $, message: f$.toString(J) } });
  }
  nonempty($) {
    return this.min(1, $);
  }
}
wU.create = ($, J) => {
  return new wU({ type: $, minLength: null, maxLength: null, exactLength: null, typeName: D$.ZodArray, ...H6(J) });
};
function WW($) {
  if ($ instanceof B0) {
    let J = {};
    for (let U in $.shape) {
      let Q = $.shape[U];
      J[U] = IU.create(WW(Q));
    }
    return new B0({ ...$._def, shape: () => J });
  } else if ($ instanceof wU) return new wU({ ...$._def, type: WW($.element) });
  else if ($ instanceof IU) return IU.create(WW($.unwrap()));
  else if ($ instanceof q8) return q8.create(WW($.unwrap()));
  else if ($ instanceof cU) return cU.create($.items.map((J) => WW(J)));
  else return $;
}
class B0 extends I6 {
  constructor() {
    super(...arguments);
    ((this._cached = null), (this.nonstrict = this.passthrough), (this.augment = this.extend));
  }
  _getCached() {
    if (this._cached !== null) return this._cached;
    let $ = this._def.shape(),
      J = M6.objectKeys($);
    return ((this._cached = { shape: $, keys: J }), this._cached);
  }
  _parse($) {
    if (this._getType($) !== F$.object) {
      let H = this._getOrReturnCtx($);
      return (w$(H, { code: Y$.invalid_type, expected: F$.object, received: H.parsedType }), a$);
    }
    let { status: U, ctx: Q } = this._processInputParams($),
      { shape: W, keys: X } = this._getCached(),
      Y = [];
    if (!(this._def.catchall instanceof dU && this._def.unknownKeys === "strip")) {
      for (let H in Q.data) if (!X.includes(H)) Y.push(H);
    }
    let D = [];
    for (let H of X) {
      let G = W[H],
        K = Q.data[H];
      D.push({ key: { status: "valid", value: H }, value: G._parse(new rJ(Q, K, Q.path, H)), alwaysSet: H in Q.data });
    }
    if (this._def.catchall instanceof dU) {
      let H = this._def.unknownKeys;
      if (H === "passthrough")
        for (let G of Y) D.push({ key: { status: "valid", value: G }, value: { status: "valid", value: Q.data[G] } });
      else if (H === "strict") {
        if (Y.length > 0) (w$(Q, { code: Y$.unrecognized_keys, keys: Y }), U.dirty());
      } else if (H === "strip");
      else throw Error("Internal ZodObject error: invalid unknownKeys value.");
    } else {
      let H = this._def.catchall;
      for (let G of Y) {
        let K = Q.data[G];
        D.push({
          key: { status: "valid", value: G },
          value: H._parse(new rJ(Q, K, Q.path, G)),
          alwaysSet: G in Q.data,
        });
      }
    }
    if (Q.common.async)
      return Promise.resolve()
        .then(async () => {
          let H = [];
          for (let G of D) {
            let K = await G.key,
              O = await G.value;
            H.push({ key: K, value: O, alwaysSet: G.alwaysSet });
          }
          return H;
        })
        .then((H) => {
          return d0.mergeObjectSync(U, H);
        });
    else return d0.mergeObjectSync(U, D);
  }
  get shape() {
    return this._def.shape();
  }
  strict($) {
    return (
      f$.errToObj,
      new B0({
        ...this._def,
        unknownKeys: "strict",
        ...($ !== void 0
          ? {
              errorMap: (J, U) => {
                let Q = this._def.errorMap?.(J, U).message ?? U.defaultError;
                if (J.code === "unrecognized_keys") return { message: f$.errToObj($).message ?? Q };
                return { message: Q };
              },
            }
          : {}),
      })
    );
  }
  strip() {
    return new B0({ ...this._def, unknownKeys: "strip" });
  }
  passthrough() {
    return new B0({ ...this._def, unknownKeys: "passthrough" });
  }
  extend($) {
    return new B0({ ...this._def, shape: () => ({ ...this._def.shape(), ...$ }) });
  }
  merge($) {
    return new B0({
      unknownKeys: $._def.unknownKeys,
      catchall: $._def.catchall,
      shape: () => ({ ...this._def.shape(), ...$._def.shape() }),
      typeName: D$.ZodObject,
    });
  }
  setKey($, J) {
    return this.augment({ [$]: J });
  }
  catchall($) {
    return new B0({ ...this._def, catchall: $ });
  }
  pick($) {
    let J = {};
    for (let U of M6.objectKeys($)) if ($[U] && this.shape[U]) J[U] = this.shape[U];
    return new B0({ ...this._def, shape: () => J });
  }
  omit($) {
    let J = {};
    for (let U of M6.objectKeys(this.shape)) if (!$[U]) J[U] = this.shape[U];
    return new B0({ ...this._def, shape: () => J });
  }
  deepPartial() {
    return WW(this);
  }
  partial($) {
    let J = {};
    for (let U of M6.objectKeys(this.shape)) {
      let Q = this.shape[U];
      if ($ && !$[U]) J[U] = Q;
      else J[U] = Q.optional();
    }
    return new B0({ ...this._def, shape: () => J });
  }
  required($) {
    let J = {};
    for (let U of M6.objectKeys(this.shape))
      if ($ && !$[U]) J[U] = this.shape[U];
      else {
        let W = this.shape[U];
        while (W instanceof IU) W = W._def.innerType;
        J[U] = W;
      }
    return new B0({ ...this._def, shape: () => J });
  }
  keyof() {
    return DL(M6.objectKeys(this.shape));
  }
}
B0.create = ($, J) => {
  return new B0({ shape: () => $, unknownKeys: "strip", catchall: dU.create(), typeName: D$.ZodObject, ...H6(J) });
};
B0.strictCreate = ($, J) => {
  return new B0({ shape: () => $, unknownKeys: "strict", catchall: dU.create(), typeName: D$.ZodObject, ...H6(J) });
};
B0.lazycreate = ($, J) => {
  return new B0({ shape: $, unknownKeys: "strip", catchall: dU.create(), typeName: D$.ZodObject, ...H6(J) });
};
class U7 extends I6 {
  _parse($) {
    let { ctx: J } = this._processInputParams($),
      U = this._def.options;
    function Q(W) {
      for (let Y of W) if (Y.result.status === "valid") return Y.result;
      for (let Y of W) if (Y.result.status === "dirty") return (J.common.issues.push(...Y.ctx.common.issues), Y.result);
      let X = W.map((Y) => new _J(Y.ctx.common.issues));
      return (w$(J, { code: Y$.invalid_union, unionErrors: X }), a$);
    }
    if (J.common.async)
      return Promise.all(
        U.map(async (W) => {
          let X = { ...J, common: { ...J.common, issues: [] }, parent: null };
          return { result: await W._parseAsync({ data: J.data, path: J.path, parent: X }), ctx: X };
        }),
      ).then(Q);
    else {
      let W = void 0,
        X = [];
      for (let D of U) {
        let H = { ...J, common: { ...J.common, issues: [] }, parent: null },
          G = D._parseSync({ data: J.data, path: J.path, parent: H });
        if (G.status === "valid") return G;
        else if (G.status === "dirty" && !W) W = { result: G, ctx: H };
        if (H.common.issues.length) X.push(H.common.issues);
      }
      if (W) return (J.common.issues.push(...W.ctx.common.issues), W.result);
      let Y = X.map((D) => new _J(D));
      return (w$(J, { code: Y$.invalid_union, unionErrors: Y }), a$);
    }
  }
  get options() {
    return this._def.options;
  }
}
U7.create = ($, J) => {
  return new U7({ options: $, typeName: D$.ZodUnion, ...H6(J) });
};
var mU = ($) => {
  if ($ instanceof Q7) return mU($.schema);
  else if ($ instanceof VU) return mU($.innerType());
  else if ($ instanceof X7) return [$.value];
  else if ($ instanceof K9) return $.options;
  else if ($ instanceof Y7) return M6.objectValues($.enum);
  else if ($ instanceof D7) return mU($._def.innerType);
  else if ($ instanceof $7) return [void 0];
  else if ($ instanceof J7) return [null];
  else if ($ instanceof IU) return [void 0, ...mU($.unwrap())];
  else if ($ instanceof q8) return [null, ...mU($.unwrap())];
  else if ($ instanceof XK) return mU($.unwrap());
  else if ($ instanceof G7) return mU($.unwrap());
  else if ($ instanceof H7) return mU($._def.innerType);
  else return [];
};
class QK extends I6 {
  _parse($) {
    let { ctx: J } = this._processInputParams($);
    if (J.parsedType !== F$.object)
      return (w$(J, { code: Y$.invalid_type, expected: F$.object, received: J.parsedType }), a$);
    let U = this.discriminator,
      Q = J.data[U],
      W = this.optionsMap.get(Q);
    if (!W)
      return (
        w$(J, { code: Y$.invalid_union_discriminator, options: Array.from(this.optionsMap.keys()), path: [U] }),
        a$
      );
    if (J.common.async) return W._parseAsync({ data: J.data, path: J.path, parent: J });
    else return W._parseSync({ data: J.data, path: J.path, parent: J });
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  static create($, J, U) {
    let Q = new Map();
    for (let W of J) {
      let X = mU(W.shape[$]);
      if (!X.length)
        throw Error(`A discriminator value for key \`${$}\` could not be extracted from all schema options`);
      for (let Y of X) {
        if (Q.has(Y)) throw Error(`Discriminator property ${String($)} has duplicate value ${String(Y)}`);
        Q.set(Y, W);
      }
    }
    return new QK({ typeName: D$.ZodDiscriminatedUnion, discriminator: $, options: J, optionsMap: Q, ...H6(U) });
  }
}
function WK($, J) {
  let U = lU($),
    Q = lU(J);
  if ($ === J) return { valid: !0, data: $ };
  else if (U === F$.object && Q === F$.object) {
    let W = M6.objectKeys(J),
      X = M6.objectKeys($).filter((D) => W.indexOf(D) !== -1),
      Y = { ...$, ...J };
    for (let D of X) {
      let H = WK($[D], J[D]);
      if (!H.valid) return { valid: !1 };
      Y[D] = H.data;
    }
    return { valid: !0, data: Y };
  } else if (U === F$.array && Q === F$.array) {
    if ($.length !== J.length) return { valid: !1 };
    let W = [];
    for (let X = 0; X < $.length; X++) {
      let Y = $[X],
        D = J[X],
        H = WK(Y, D);
      if (!H.valid) return { valid: !1 };
      W.push(H.data);
    }
    return { valid: !0, data: W };
  } else if (U === F$.date && Q === F$.date && +$ === +J) return { valid: !0, data: $ };
  else return { valid: !1 };
}
class W7 extends I6 {
  _parse($) {
    let { status: J, ctx: U } = this._processInputParams($),
      Q = (W, X) => {
        if ($K(W) || $K(X)) return a$;
        let Y = WK(W.value, X.value);
        if (!Y.valid) return (w$(U, { code: Y$.invalid_intersection_types }), a$);
        if (JK(W) || JK(X)) J.dirty();
        return { status: J.value, value: Y.data };
      };
    if (U.common.async)
      return Promise.all([
        this._def.left._parseAsync({ data: U.data, path: U.path, parent: U }),
        this._def.right._parseAsync({ data: U.data, path: U.path, parent: U }),
      ]).then(([W, X]) => Q(W, X));
    else
      return Q(
        this._def.left._parseSync({ data: U.data, path: U.path, parent: U }),
        this._def.right._parseSync({ data: U.data, path: U.path, parent: U }),
      );
  }
}
W7.create = ($, J, U) => {
  return new W7({ left: $, right: J, typeName: D$.ZodIntersection, ...H6(U) });
};
class cU extends I6 {
  _parse($) {
    let { status: J, ctx: U } = this._processInputParams($);
    if (U.parsedType !== F$.array)
      return (w$(U, { code: Y$.invalid_type, expected: F$.array, received: U.parsedType }), a$);
    if (U.data.length < this._def.items.length)
      return (
        w$(U, { code: Y$.too_small, minimum: this._def.items.length, inclusive: !0, exact: !1, type: "array" }),
        a$
      );
    if (!this._def.rest && U.data.length > this._def.items.length)
      (w$(U, { code: Y$.too_big, maximum: this._def.items.length, inclusive: !0, exact: !1, type: "array" }),
        J.dirty());
    let W = [...U.data]
      .map((X, Y) => {
        let D = this._def.items[Y] || this._def.rest;
        if (!D) return null;
        return D._parse(new rJ(U, X, U.path, Y));
      })
      .filter((X) => !!X);
    if (U.common.async)
      return Promise.all(W).then((X) => {
        return d0.mergeArray(J, X);
      });
    else return d0.mergeArray(J, W);
  }
  get items() {
    return this._def.items;
  }
  rest($) {
    return new cU({ ...this._def, rest: $ });
  }
}
cU.create = ($, J) => {
  if (!Array.isArray($)) throw Error("You must pass an array of schemas to z.tuple([ ... ])");
  return new cU({ items: $, typeName: D$.ZodTuple, rest: null, ...H6(J) });
};
class gX extends I6 {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse($) {
    let { status: J, ctx: U } = this._processInputParams($);
    if (U.parsedType !== F$.object)
      return (w$(U, { code: Y$.invalid_type, expected: F$.object, received: U.parsedType }), a$);
    let Q = [],
      W = this._def.keyType,
      X = this._def.valueType;
    for (let Y in U.data)
      Q.push({
        key: W._parse(new rJ(U, Y, U.path, Y)),
        value: X._parse(new rJ(U, U.data[Y], U.path, Y)),
        alwaysSet: Y in U.data,
      });
    if (U.common.async) return d0.mergeObjectAsync(J, Q);
    else return d0.mergeObjectSync(J, Q);
  }
  get element() {
    return this._def.valueType;
  }
  static create($, J, U) {
    if (J instanceof I6) return new gX({ keyType: $, valueType: J, typeName: D$.ZodRecord, ...H6(U) });
    return new gX({ keyType: pU.create(), valueType: $, typeName: D$.ZodRecord, ...H6(J) });
  }
}
class hX extends I6 {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse($) {
    let { status: J, ctx: U } = this._processInputParams($);
    if (U.parsedType !== F$.map)
      return (w$(U, { code: Y$.invalid_type, expected: F$.map, received: U.parsedType }), a$);
    let Q = this._def.keyType,
      W = this._def.valueType,
      X = [...U.data.entries()].map(([Y, D], H) => {
        return { key: Q._parse(new rJ(U, Y, U.path, [H, "key"])), value: W._parse(new rJ(U, D, U.path, [H, "value"])) };
      });
    if (U.common.async) {
      let Y = new Map();
      return Promise.resolve().then(async () => {
        for (let D of X) {
          let H = await D.key,
            G = await D.value;
          if (H.status === "aborted" || G.status === "aborted") return a$;
          if (H.status === "dirty" || G.status === "dirty") J.dirty();
          Y.set(H.value, G.value);
        }
        return { status: J.value, value: Y };
      });
    } else {
      let Y = new Map();
      for (let D of X) {
        let { key: H, value: G } = D;
        if (H.status === "aborted" || G.status === "aborted") return a$;
        if (H.status === "dirty" || G.status === "dirty") J.dirty();
        Y.set(H.value, G.value);
      }
      return { status: J.value, value: Y };
    }
  }
}
hX.create = ($, J, U) => {
  return new hX({ valueType: J, keyType: $, typeName: D$.ZodMap, ...H6(U) });
};
class YW extends I6 {
  _parse($) {
    let { status: J, ctx: U } = this._processInputParams($);
    if (U.parsedType !== F$.set)
      return (w$(U, { code: Y$.invalid_type, expected: F$.set, received: U.parsedType }), a$);
    let Q = this._def;
    if (Q.minSize !== null) {
      if (U.data.size < Q.minSize.value)
        (w$(U, {
          code: Y$.too_small,
          minimum: Q.minSize.value,
          type: "set",
          inclusive: !0,
          exact: !1,
          message: Q.minSize.message,
        }),
          J.dirty());
    }
    if (Q.maxSize !== null) {
      if (U.data.size > Q.maxSize.value)
        (w$(U, {
          code: Y$.too_big,
          maximum: Q.maxSize.value,
          type: "set",
          inclusive: !0,
          exact: !1,
          message: Q.maxSize.message,
        }),
          J.dirty());
    }
    let W = this._def.valueType;
    function X(D) {
      let H = new Set();
      for (let G of D) {
        if (G.status === "aborted") return a$;
        if (G.status === "dirty") J.dirty();
        H.add(G.value);
      }
      return { status: J.value, value: H };
    }
    let Y = [...U.data.values()].map((D, H) => W._parse(new rJ(U, D, U.path, H)));
    if (U.common.async) return Promise.all(Y).then((D) => X(D));
    else return X(Y);
  }
  min($, J) {
    return new YW({ ...this._def, minSize: { value: $, message: f$.toString(J) } });
  }
  max($, J) {
    return new YW({ ...this._def, maxSize: { value: $, message: f$.toString(J) } });
  }
  size($, J) {
    return this.min($, J).max($, J);
  }
  nonempty($) {
    return this.min(1, $);
  }
}
YW.create = ($, J) => {
  return new YW({ valueType: $, minSize: null, maxSize: null, typeName: D$.ZodSet, ...H6(J) });
};
class t1 extends I6 {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse($) {
    let { ctx: J } = this._processInputParams($);
    if (J.parsedType !== F$.function)
      return (w$(J, { code: Y$.invalid_type, expected: F$.function, received: J.parsedType }), a$);
    function U(Y, D) {
      return vX({
        data: Y,
        path: J.path,
        errorMaps: [J.common.contextualErrorMap, J.schemaErrorMap, s1(), F8].filter((H) => !!H),
        issueData: { code: Y$.invalid_arguments, argumentsError: D },
      });
    }
    function Q(Y, D) {
      return vX({
        data: Y,
        path: J.path,
        errorMaps: [J.common.contextualErrorMap, J.schemaErrorMap, s1(), F8].filter((H) => !!H),
        issueData: { code: Y$.invalid_return_type, returnTypeError: D },
      });
    }
    let W = { errorMap: J.common.contextualErrorMap },
      X = J.data;
    if (this._def.returns instanceof DW) {
      let Y = this;
      return $J(async function (...D) {
        let H = new _J([]),
          G = await Y._def.args.parseAsync(D, W).catch((N) => {
            throw (H.addIssue(U(D, N)), H);
          }),
          K = await Reflect.apply(X, this, G);
        return await Y._def.returns._def.type.parseAsync(K, W).catch((N) => {
          throw (H.addIssue(Q(K, N)), H);
        });
      });
    } else {
      let Y = this;
      return $J(function (...D) {
        let H = Y._def.args.safeParse(D, W);
        if (!H.success) throw new _J([U(D, H.error)]);
        let G = Reflect.apply(X, this, H.data),
          K = Y._def.returns.safeParse(G, W);
        if (!K.success) throw new _J([Q(G, K.error)]);
        return K.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...$) {
    return new t1({ ...this._def, args: cU.create($).rest(G9.create()) });
  }
  returns($) {
    return new t1({ ...this._def, returns: $ });
  }
  implement($) {
    return this.parse($);
  }
  strictImplement($) {
    return this.parse($);
  }
  static create($, J, U) {
    return new t1({
      args: $ ? $ : cU.create([]).rest(G9.create()),
      returns: J || G9.create(),
      typeName: D$.ZodFunction,
      ...H6(U),
    });
  }
}
class Q7 extends I6 {
  get schema() {
    return this._def.getter();
  }
  _parse($) {
    let { ctx: J } = this._processInputParams($);
    return this._def.getter()._parse({ data: J.data, path: J.path, parent: J });
  }
}
Q7.create = ($, J) => {
  return new Q7({ getter: $, typeName: D$.ZodLazy, ...H6(J) });
};
class X7 extends I6 {
  _parse($) {
    if ($.data !== this._def.value) {
      let J = this._getOrReturnCtx($);
      return (w$(J, { received: J.data, code: Y$.invalid_literal, expected: this._def.value }), a$);
    }
    return { status: "valid", value: $.data };
  }
  get value() {
    return this._def.value;
  }
}
X7.create = ($, J) => {
  return new X7({ value: $, typeName: D$.ZodLiteral, ...H6(J) });
};
function DL($, J) {
  return new K9({ values: $, typeName: D$.ZodEnum, ...H6(J) });
}
class K9 extends I6 {
  _parse($) {
    if (typeof $.data !== "string") {
      let J = this._getOrReturnCtx($),
        U = this._def.values;
      return (w$(J, { expected: M6.joinValues(U), received: J.parsedType, code: Y$.invalid_type }), a$);
    }
    if (!this._cache) this._cache = new Set(this._def.values);
    if (!this._cache.has($.data)) {
      let J = this._getOrReturnCtx($),
        U = this._def.values;
      return (w$(J, { received: J.data, code: Y$.invalid_enum_value, options: U }), a$);
    }
    return $J($.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    let $ = {};
    for (let J of this._def.values) $[J] = J;
    return $;
  }
  get Values() {
    let $ = {};
    for (let J of this._def.values) $[J] = J;
    return $;
  }
  get Enum() {
    let $ = {};
    for (let J of this._def.values) $[J] = J;
    return $;
  }
  extract($, J = this._def) {
    return K9.create($, { ...this._def, ...J });
  }
  exclude($, J = this._def) {
    return K9.create(
      this.options.filter((U) => !$.includes(U)),
      { ...this._def, ...J },
    );
  }
}
K9.create = DL;
class Y7 extends I6 {
  _parse($) {
    let J = M6.getValidEnumValues(this._def.values),
      U = this._getOrReturnCtx($);
    if (U.parsedType !== F$.string && U.parsedType !== F$.number) {
      let Q = M6.objectValues(J);
      return (w$(U, { expected: M6.joinValues(Q), received: U.parsedType, code: Y$.invalid_type }), a$);
    }
    if (!this._cache) this._cache = new Set(M6.getValidEnumValues(this._def.values));
    if (!this._cache.has($.data)) {
      let Q = M6.objectValues(J);
      return (w$(U, { received: U.data, code: Y$.invalid_enum_value, options: Q }), a$);
    }
    return $J($.data);
  }
  get enum() {
    return this._def.values;
  }
}
Y7.create = ($, J) => {
  return new Y7({ values: $, typeName: D$.ZodNativeEnum, ...H6(J) });
};
class DW extends I6 {
  unwrap() {
    return this._def.type;
  }
  _parse($) {
    let { ctx: J } = this._processInputParams($);
    if (J.parsedType !== F$.promise && J.common.async === !1)
      return (w$(J, { code: Y$.invalid_type, expected: F$.promise, received: J.parsedType }), a$);
    let U = J.parsedType === F$.promise ? J.data : Promise.resolve(J.data);
    return $J(
      U.then((Q) => {
        return this._def.type.parseAsync(Q, { path: J.path, errorMap: J.common.contextualErrorMap });
      }),
    );
  }
}
DW.create = ($, J) => {
  return new DW({ type: $, typeName: D$.ZodPromise, ...H6(J) });
};
class VU extends I6 {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === D$.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse($) {
    let { status: J, ctx: U } = this._processInputParams($),
      Q = this._def.effect || null,
      W = {
        addIssue: (X) => {
          if ((w$(U, X), X.fatal)) J.abort();
          else J.dirty();
        },
        get path() {
          return U.path;
        },
      };
    if (((W.addIssue = W.addIssue.bind(W)), Q.type === "preprocess")) {
      let X = Q.transform(U.data, W);
      if (U.common.async)
        return Promise.resolve(X).then(async (Y) => {
          if (J.value === "aborted") return a$;
          let D = await this._def.schema._parseAsync({ data: Y, path: U.path, parent: U });
          if (D.status === "aborted") return a$;
          if (D.status === "dirty") return UW(D.value);
          if (J.value === "dirty") return UW(D.value);
          return D;
        });
      else {
        if (J.value === "aborted") return a$;
        let Y = this._def.schema._parseSync({ data: X, path: U.path, parent: U });
        if (Y.status === "aborted") return a$;
        if (Y.status === "dirty") return UW(Y.value);
        if (J.value === "dirty") return UW(Y.value);
        return Y;
      }
    }
    if (Q.type === "refinement") {
      let X = (Y) => {
        let D = Q.refinement(Y, W);
        if (U.common.async) return Promise.resolve(D);
        if (D instanceof Promise)
          throw Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        return Y;
      };
      if (U.common.async === !1) {
        let Y = this._def.schema._parseSync({ data: U.data, path: U.path, parent: U });
        if (Y.status === "aborted") return a$;
        if (Y.status === "dirty") J.dirty();
        return (X(Y.value), { status: J.value, value: Y.value });
      } else
        return this._def.schema._parseAsync({ data: U.data, path: U.path, parent: U }).then((Y) => {
          if (Y.status === "aborted") return a$;
          if (Y.status === "dirty") J.dirty();
          return X(Y.value).then(() => {
            return { status: J.value, value: Y.value };
          });
        });
    }
    if (Q.type === "transform")
      if (U.common.async === !1) {
        let X = this._def.schema._parseSync({ data: U.data, path: U.path, parent: U });
        if (!H9(X)) return a$;
        let Y = Q.transform(X.value, W);
        if (Y instanceof Promise)
          throw Error(
            "Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.",
          );
        return { status: J.value, value: Y };
      } else
        return this._def.schema._parseAsync({ data: U.data, path: U.path, parent: U }).then((X) => {
          if (!H9(X)) return a$;
          return Promise.resolve(Q.transform(X.value, W)).then((Y) => ({ status: J.value, value: Y }));
        });
    M6.assertNever(Q);
  }
}
VU.create = ($, J, U) => {
  return new VU({ schema: $, typeName: D$.ZodEffects, effect: J, ...H6(U) });
};
VU.createWithPreprocess = ($, J, U) => {
  return new VU({ schema: J, effect: { type: "preprocess", transform: $ }, typeName: D$.ZodEffects, ...H6(U) });
};
class IU extends I6 {
  _parse($) {
    if (this._getType($) === F$.undefined) return $J(void 0);
    return this._def.innerType._parse($);
  }
  unwrap() {
    return this._def.innerType;
  }
}
IU.create = ($, J) => {
  return new IU({ innerType: $, typeName: D$.ZodOptional, ...H6(J) });
};
class q8 extends I6 {
  _parse($) {
    if (this._getType($) === F$.null) return $J(null);
    return this._def.innerType._parse($);
  }
  unwrap() {
    return this._def.innerType;
  }
}
q8.create = ($, J) => {
  return new q8({ innerType: $, typeName: D$.ZodNullable, ...H6(J) });
};
class D7 extends I6 {
  _parse($) {
    let { ctx: J } = this._processInputParams($),
      U = J.data;
    if (J.parsedType === F$.undefined) U = this._def.defaultValue();
    return this._def.innerType._parse({ data: U, path: J.path, parent: J });
  }
  removeDefault() {
    return this._def.innerType;
  }
}
D7.create = ($, J) => {
  return new D7({
    innerType: $,
    typeName: D$.ZodDefault,
    defaultValue: typeof J.default === "function" ? J.default : () => J.default,
    ...H6(J),
  });
};
class H7 extends I6 {
  _parse($) {
    let { ctx: J } = this._processInputParams($),
      U = { ...J, common: { ...J.common, issues: [] } },
      Q = this._def.innerType._parse({ data: U.data, path: U.path, parent: { ...U } });
    if (a1(Q))
      return Q.then((W) => {
        return {
          status: "valid",
          value:
            W.status === "valid"
              ? W.value
              : this._def.catchValue({
                  get error() {
                    return new _J(U.common.issues);
                  },
                  input: U.data,
                }),
        };
      });
    else
      return {
        status: "valid",
        value:
          Q.status === "valid"
            ? Q.value
            : this._def.catchValue({
                get error() {
                  return new _J(U.common.issues);
                },
                input: U.data,
              }),
      };
  }
  removeCatch() {
    return this._def.innerType;
  }
}
H7.create = ($, J) => {
  return new H7({
    innerType: $,
    typeName: D$.ZodCatch,
    catchValue: typeof J.catch === "function" ? J.catch : () => J.catch,
    ...H6(J),
  });
};
class uX extends I6 {
  _parse($) {
    if (this._getType($) !== F$.nan) {
      let U = this._getOrReturnCtx($);
      return (w$(U, { code: Y$.invalid_type, expected: F$.nan, received: U.parsedType }), a$);
    }
    return { status: "valid", value: $.data };
  }
}
uX.create = ($) => {
  return new uX({ typeName: D$.ZodNaN, ...H6($) });
};
var Mo = Symbol("zod_brand");
class XK extends I6 {
  _parse($) {
    let { ctx: J } = this._processInputParams($),
      U = J.data;
    return this._def.type._parse({ data: U, path: J.path, parent: J });
  }
  unwrap() {
    return this._def.type;
  }
}
class lX extends I6 {
  _parse($) {
    let { status: J, ctx: U } = this._processInputParams($);
    if (U.common.async)
      return (async () => {
        let W = await this._def.in._parseAsync({ data: U.data, path: U.path, parent: U });
        if (W.status === "aborted") return a$;
        if (W.status === "dirty") return (J.dirty(), UW(W.value));
        else return this._def.out._parseAsync({ data: W.value, path: U.path, parent: U });
      })();
    else {
      let Q = this._def.in._parseSync({ data: U.data, path: U.path, parent: U });
      if (Q.status === "aborted") return a$;
      if (Q.status === "dirty") return (J.dirty(), { status: "dirty", value: Q.value });
      else return this._def.out._parseSync({ data: Q.value, path: U.path, parent: U });
    }
  }
  static create($, J) {
    return new lX({ in: $, out: J, typeName: D$.ZodPipeline });
  }
}
class G7 extends I6 {
  _parse($) {
    let J = this._def.innerType._parse($),
      U = (Q) => {
        if (H9(Q)) Q.value = Object.freeze(Q.value);
        return Q;
      };
    return a1(J) ? J.then((Q) => U(Q)) : U(J);
  }
  unwrap() {
    return this._def.innerType;
  }
}
G7.create = ($, J) => {
  return new G7({ innerType: $, typeName: D$.ZodReadonly, ...H6(J) });
};
var Ro = { object: B0.lazycreate },
  D$;
(function ($) {
  (($.ZodString = "ZodString"),
    ($.ZodNumber = "ZodNumber"),
    ($.ZodNaN = "ZodNaN"),
    ($.ZodBigInt = "ZodBigInt"),
    ($.ZodBoolean = "ZodBoolean"),
    ($.ZodDate = "ZodDate"),
    ($.ZodSymbol = "ZodSymbol"),
    ($.ZodUndefined = "ZodUndefined"),
    ($.ZodNull = "ZodNull"),
    ($.ZodAny = "ZodAny"),
    ($.ZodUnknown = "ZodUnknown"),
    ($.ZodNever = "ZodNever"),
    ($.ZodVoid = "ZodVoid"),
    ($.ZodArray = "ZodArray"),
    ($.ZodObject = "ZodObject"),
    ($.ZodUnion = "ZodUnion"),
    ($.ZodDiscriminatedUnion = "ZodDiscriminatedUnion"),
    ($.ZodIntersection = "ZodIntersection"),
    ($.ZodTuple = "ZodTuple"),
    ($.ZodRecord = "ZodRecord"),
    ($.ZodMap = "ZodMap"),
    ($.ZodSet = "ZodSet"),
    ($.ZodFunction = "ZodFunction"),
    ($.ZodLazy = "ZodLazy"),
    ($.ZodLiteral = "ZodLiteral"),
    ($.ZodEnum = "ZodEnum"),
    ($.ZodEffects = "ZodEffects"),
    ($.ZodNativeEnum = "ZodNativeEnum"),
    ($.ZodOptional = "ZodOptional"),
    ($.ZodNullable = "ZodNullable"),
    ($.ZodDefault = "ZodDefault"),
    ($.ZodCatch = "ZodCatch"),
    ($.ZodPromise = "ZodPromise"),
    ($.ZodBranded = "ZodBranded"),
    ($.ZodPipeline = "ZodPipeline"),
    ($.ZodReadonly = "ZodReadonly"));
})(D$ || (D$ = {}));
var Zo = pU.create,
  Po = QW.create,
  _o = uX.create,
  So = XW.create,
  Co = bX.create,
  To = e1.create,
  jo = fX.create,
  vo = $7.create,
  bo = J7.create,
  fo = yX.create,
  yo = G9.create,
  xo = dU.create,
  go = xX.create,
  ho = wU.create,
  HL = B0.create,
  uo = B0.strictCreate,
  lo = U7.create,
  mo = QK.create,
  po = W7.create,
  co = cU.create,
  no = gX.create,
  io = hX.create,
  oo = YW.create,
  ro = t1.create,
  so = Q7.create,
  ao = X7.create,
  to = K9.create,
  eo = Y7.create,
  $r = DW.create,
  Jr = VU.create,
  Ur = IU.create,
  Wr = q8.create,
  Qr = VU.createWithPreprocess,
  Xr = lX.create;
var aJ = {};
uU(aJ, {
  version: () => O4,
  util: () => Q$,
  treeifyError: () => EK,
  toJSONSchema: () => V9,
  toDotPath: () => VL,
  safeParseAsync: () => I8,
  safeParse: () => w8,
  safeEncodeAsync: () => _L,
  safeEncode: () => ZL,
  safeDecodeAsync: () => SL,
  safeDecode: () => PL,
  registry: () => KD,
  regexes: () => BJ,
  process: () => g6,
  prettifyError: () => LK,
  parseAsync: () => z9,
  parse: () => q9,
  meta: () => mD,
  locales: () => IW,
  isValidJWT: () => aL,
  isValidBase64URL: () => sL,
  isValidBase64: () => L4,
  initializeContext: () => M8,
  globalRegistry: () => f0,
  globalConfig: () => N9,
  formatError: () => L7,
  flattenError: () => E7,
  finalize: () => Z8,
  extractDefs: () => R8,
  encodeAsync: () => ML,
  encode: () => kL,
  describe: () => lD,
  decodeAsync: () => RL,
  decode: () => AL,
  createToJSONSchemaMethod: () => CN,
  createStandardJSONSchemaMethod: () => fW,
  config: () => E0,
  clone: () => b0,
  _xor: () => H2,
  _xid: () => l7,
  _void: () => SD,
  _uuidv7: () => f7,
  _uuidv6: () => b7,
  _uuidv4: () => v7,
  _uuid: () => j7,
  _url: () => kW,
  _uppercase: () => RW,
  _unknown: () => PD,
  _union: () => D2,
  _undefined: () => MD,
  _ulid: () => u7,
  _uint64: () => kD,
  _uint32: () => LD,
  _tuple: () => N2,
  _trim: () => TW,
  _transform: () => L2,
  _toUpperCase: () => vW,
  _toLowerCase: () => jW,
  _templateLiteral: () => P2,
  _symbol: () => AD,
  _superRefine: () => uD,
  _success: () => A2,
  _stringbool: () => pD,
  _stringFormat: () => I9,
  _string: () => ND,
  _startsWith: () => PW,
  _slugify: () => bW,
  _size: () => E9,
  _set: () => q2,
  _safeParseAsync: () => qW,
  _safeParse: () => FW,
  _safeEncodeAsync: () => aX,
  _safeEncode: () => rX,
  _safeDecodeAsync: () => tX,
  _safeDecode: () => sX,
  _regex: () => AW,
  _refine: () => hD,
  _record: () => O2,
  _readonly: () => Z2,
  _property: () => yD,
  _promise: () => S2,
  _positive: () => jD,
  _pipe: () => R2,
  _parseAsync: () => OW,
  _parse: () => NW,
  _overwrite: () => sJ,
  _optional: () => w2,
  _number: () => FD,
  _nullable: () => I2,
  _null: () => RD,
  _normalize: () => CW,
  _nonpositive: () => bD,
  _nonoptional: () => k2,
  _nonnegative: () => fD,
  _never: () => _D,
  _negative: () => vD,
  _nativeEnum: () => B2,
  _nanoid: () => x7,
  _nan: () => TD,
  _multipleOf: () => k8,
  _minSize: () => RU,
  _minLength: () => iU,
  _min: () => UJ,
  _mime: () => SW,
  _maxSize: () => A8,
  _maxLength: () => L9,
  _max: () => SJ,
  _map: () => F2,
  _mac: () => OD,
  _lte: () => SJ,
  _lt: () => AU,
  _lowercase: () => MW,
  _literal: () => E2,
  _length: () => w9,
  _lazy: () => _2,
  _ksuid: () => m7,
  _jwt: () => s7,
  _isoTime: () => AN,
  _isoDuration: () => MN,
  _isoDateTime: () => VN,
  _isoDate: () => kN,
  _ipv6: () => d7,
  _ipv4: () => p7,
  _intersection: () => K2,
  _int64: () => VD,
  _int32: () => ED,
  _int: () => qD,
  _includes: () => ZW,
  _guid: () => VW,
  _gte: () => UJ,
  _gt: () => MU,
  _float64: () => BD,
  _float32: () => zD,
  _file: () => xD,
  _enum: () => z2,
  _endsWith: () => _W,
  _encodeAsync: () => iX,
  _encode: () => cX,
  _emoji: () => y7,
  _email: () => T7,
  _e164: () => r7,
  _discriminatedUnion: () => G2,
  _default: () => V2,
  _decodeAsync: () => oX,
  _decode: () => nX,
  _date: () => CD,
  _custom: () => gD,
  _cuid2: () => h7,
  _cuid: () => g7,
  _coercedString: () => wN,
  _coercedNumber: () => RN,
  _coercedDate: () => _N,
  _coercedBoolean: () => ZN,
  _coercedBigint: () => PN,
  _cidrv6: () => n7,
  _cidrv4: () => c7,
  _check: () => Xw,
  _catch: () => M2,
  _boolean: () => wD,
  _bigint: () => ID,
  _base64url: () => o7,
  _base64: () => i7,
  _array: () => SN,
  _any: () => ZD,
  TimePrecision: () => IN,
  NEVER: () => YK,
  JSONSchemaGenerator: () => qO,
  JSONSchema: () => Yw,
  Doc: () => UY,
  $output: () => BN,
  $input: () => EN,
  $constructor: () => v,
  $brand: () => DK,
  $ZodXor: () => uY,
  $ZodXID: () => BY,
  $ZodVoid: () => yY,
  $ZodUnknown: () => bY,
  $ZodUnion: () => EW,
  $ZodUndefined: () => TY,
  $ZodUUID: () => HY,
  $ZodURL: () => KY,
  $ZodULID: () => zY,
  $ZodType: () => $6,
  $ZodTuple: () => M7,
  $ZodTransform: () => rY,
  $ZodTemplateLiteral: () => XD,
  $ZodSymbol: () => CY,
  $ZodSuccess: () => JD,
  $ZodStringFormat: () => h6,
  $ZodString: () => V8,
  $ZodSet: () => cY,
  $ZodRegistry: () => LN,
  $ZodRecord: () => pY,
  $ZodRealError: () => zJ,
  $ZodReadonly: () => QD,
  $ZodPromise: () => DD,
  $ZodPreprocess: () => I4,
  $ZodPrefault: () => eY,
  $ZodPipe: () => Z7,
  $ZodOptional: () => R7,
  $ZodObjectJIT: () => w4,
  $ZodObject: () => hY,
  $ZodNumberFormat: () => _Y,
  $ZodNumber: () => k7,
  $ZodNullable: () => aY,
  $ZodNull: () => jY,
  $ZodNonOptional: () => $D,
  $ZodNever: () => fY,
  $ZodNanoID: () => OY,
  $ZodNaN: () => WD,
  $ZodMap: () => dY,
  $ZodMAC: () => IY,
  $ZodLiteral: () => iY,
  $ZodLazy: () => HD,
  $ZodKSUID: () => EY,
  $ZodJWT: () => ZY,
  $ZodIntersection: () => mY,
  $ZodISOTime: () => B4,
  $ZodISODuration: () => E4,
  $ZodISODateTime: () => q4,
  $ZodISODate: () => z4,
  $ZodIPv6: () => wY,
  $ZodIPv4: () => LY,
  $ZodGUID: () => DY,
  $ZodFunction: () => YD,
  $ZodFile: () => oY,
  $ZodExactOptional: () => sY,
  $ZodError: () => B7,
  $ZodEnum: () => nY,
  $ZodEncodeError: () => O9,
  $ZodEmoji: () => NY,
  $ZodEmail: () => GY,
  $ZodE164: () => RY,
  $ZodDiscriminatedUnion: () => lY,
  $ZodDefault: () => tY,
  $ZodDate: () => xY,
  $ZodCustomStringFormat: () => PY,
  $ZodCustom: () => GD,
  $ZodCodec: () => LW,
  $ZodCheckUpperCase: () => X4,
  $ZodCheckStringFormat: () => zW,
  $ZodCheckStartsWith: () => D4,
  $ZodCheckSizeEquals: () => eK,
  $ZodCheckRegex: () => W4,
  $ZodCheckProperty: () => G4,
  $ZodCheckOverwrite: () => N4,
  $ZodCheckNumberFormat: () => rK,
  $ZodCheckMultipleOf: () => oK,
  $ZodCheckMinSize: () => tK,
  $ZodCheckMinLength: () => J4,
  $ZodCheckMimeType: () => K4,
  $ZodCheckMaxSize: () => aK,
  $ZodCheckMaxLength: () => $4,
  $ZodCheckLowerCase: () => Q4,
  $ZodCheckLessThan: () => $Y,
  $ZodCheckLengthEquals: () => U4,
  $ZodCheckIncludes: () => Y4,
  $ZodCheckGreaterThan: () => JY,
  $ZodCheckEndsWith: () => H4,
  $ZodCheckBigIntFormat: () => sK,
  $ZodCheck: () => n6,
  $ZodCatch: () => UD,
  $ZodCUID2: () => qY,
  $ZodCUID: () => FY,
  $ZodCIDRv6: () => kY,
  $ZodCIDRv4: () => VY,
  $ZodBoolean: () => BW,
  $ZodBigIntFormat: () => SY,
  $ZodBigInt: () => A7,
  $ZodBase64URL: () => MY,
  $ZodBase64: () => AY,
  $ZodAsyncError: () => kU,
  $ZodArray: () => gY,
  $ZodAny: () => vY,
});
var GL,
  YK = Object.freeze({ status: "aborted" });
function v($, J, U) {
  function Q(D, H) {
    if (!D._zod) Object.defineProperty(D, "_zod", { value: { def: H, constr: Y, traits: new Set() }, enumerable: !1 });
    if (D._zod.traits.has($)) return;
    (D._zod.traits.add($), J(D, H));
    let G = Y.prototype,
      K = Object.keys(G);
    for (let O = 0; O < K.length; O++) {
      let N = K[O];
      if (!(N in D)) D[N] = G[N].bind(D);
    }
  }
  let W = U?.Parent ?? Object;
  class X extends W {}
  Object.defineProperty(X, "name", { value: $ });
  function Y(D) {
    var H;
    let G = U?.Parent ? new X() : this;
    (Q(G, D), (H = G._zod).deferred ?? (H.deferred = []));
    for (let K of G._zod.deferred) K();
    return G;
  }
  return (
    Object.defineProperty(Y, "init", { value: Q }),
    Object.defineProperty(Y, Symbol.hasInstance, {
      value: (D) => {
        if (U?.Parent && D instanceof U.Parent) return !0;
        return D?._zod?.traits?.has($);
      },
    }),
    Object.defineProperty(Y, "name", { value: $ }),
    Y
  );
}
var DK = Symbol("zod_brand");
class kU extends Error {
  constructor() {
    super("Encountered Promise during synchronous parse. Use .parseAsync() instead.");
  }
}
class O9 extends Error {
  constructor($) {
    super(`Encountered unidirectional transform during encode: ${$}`);
    this.name = "ZodEncodeError";
  }
}
(GL = globalThis).__zod_globalConfig ?? (GL.__zod_globalConfig = {});
var N9 = globalThis.__zod_globalConfig;
function E0($) {
  if ($) Object.assign(N9, $);
  return N9;
}
var Q$ = {};
uU(Q$, {
  unwrapMessage: () => K7,
  uint8ArrayToHex: () => bS,
  uint8ArrayToBase64url: () => jS,
  uint8ArrayToBase64: () => LL,
  stringifyPrimitive: () => $$,
  slugify: () => KK,
  shallowClone: () => dX,
  safeExtend: () => qL,
  required: () => BL,
  randomString: () => RS,
  propertyKeyTypes: () => F7,
  promiseAllObject: () => MS,
  primitiveTypes: () => OK,
  prefixIssues: () => qJ,
  pick: () => NL,
  partial: () => zL,
  parsedType: () => U$,
  optionalKeys: () => FK,
  omit: () => OL,
  objectClone: () => VS,
  numKeys: () => ZS,
  nullish: () => z8,
  normalizeParams: () => H$,
  mergeDefs: () => nU,
  merge: () => SS,
  jsonStringifyReplacer: () => HW,
  joinValues: () => p,
  issue: () => KW,
  isPlainObject: () => E8,
  isObject: () => F9,
  hexToUint8Array: () => vS,
  getSizableOrigin: () => q7,
  getParsedType: () => PS,
  getLengthableOrigin: () => z7,
  getEnumValues: () => N7,
  getElementAtPath: () => AS,
  floatSafeRemainder: () => GK,
  finalizeIssue: () => JJ,
  extend: () => FL,
  explicitlyAborted: () => BK,
  escapeRegex: () => yJ,
  esc: () => mX,
  defineLazy: () => N6,
  createTransparentProxy: () => _S,
  cloneDef: () => kS,
  clone: () => b0,
  cleanRegex: () => O7,
  cleanEnum: () => CS,
  captureStackTrace: () => pX,
  cached: () => GW,
  base64urlToUint8Array: () => TS,
  base64ToUint8Array: () => EL,
  assignProp: () => B8,
  assertNotEqual: () => ES,
  assertNever: () => wS,
  assertIs: () => LS,
  assertEqual: () => BS,
  assert: () => IS,
  allowsEval: () => NK,
  aborted: () => L8,
  NUMBER_FORMAT_RANGES: () => qK,
  Class: () => wL,
  BIGINT_FORMAT_RANGES: () => zK,
});
function BS($) {
  return $;
}
function ES($) {
  return $;
}
function LS($) {}
function wS($) {
  throw Error("Unexpected value in exhaustive check");
}
function IS($) {}
function N7($) {
  let J = Object.values($).filter((Q) => typeof Q === "number");
  return Object.entries($)
    .filter(([Q, W]) => J.indexOf(+Q) === -1)
    .map(([Q, W]) => W);
}
function p($, J = "|") {
  return $.map((U) => $$(U)).join(J);
}
function HW($, J) {
  if (typeof J === "bigint") return J.toString();
  return J;
}
function GW($) {
  return {
    get value() {
      {
        let U = $();
        return (Object.defineProperty(this, "value", { value: U }), U);
      }
      throw Error("cached value already set");
    },
  };
}
function z8($) {
  return $ === null || $ === void 0;
}
function O7($) {
  let J = $.startsWith("^") ? 1 : 0,
    U = $.endsWith("$") ? $.length - 1 : $.length;
  return $.slice(J, U);
}
function GK($, J) {
  let U = $ / J,
    Q = Math.round(U),
    W = Number.EPSILON * Math.max(Math.abs(U), 1);
  if (Math.abs(U - Q) < W) return 0;
  return U - Q;
}
var KL = Symbol("evaluating");
function N6($, J, U) {
  let Q = void 0;
  Object.defineProperty($, J, {
    get() {
      if (Q === KL) return;
      if (Q === void 0) ((Q = KL), (Q = U()));
      return Q;
    },
    set(W) {
      Object.defineProperty($, J, { value: W });
    },
    configurable: !0,
  });
}
function VS($) {
  return Object.create(Object.getPrototypeOf($), Object.getOwnPropertyDescriptors($));
}
function B8($, J, U) {
  Object.defineProperty($, J, { value: U, writable: !0, enumerable: !0, configurable: !0 });
}
function nU(...$) {
  let J = {};
  for (let U of $) {
    let Q = Object.getOwnPropertyDescriptors(U);
    Object.assign(J, Q);
  }
  return Object.defineProperties({}, J);
}
function kS($) {
  return nU($._zod.def);
}
function AS($, J) {
  if (!J) return $;
  return J.reduce((U, Q) => U?.[Q], $);
}
function MS($) {
  let J = Object.keys($),
    U = J.map((Q) => $[Q]);
  return Promise.all(U).then((Q) => {
    let W = {};
    for (let X = 0; X < J.length; X++) W[J[X]] = Q[X];
    return W;
  });
}
function RS($ = 10) {
  let U = "";
  for (let Q = 0; Q < $; Q++) U += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
  return U;
}
function mX($) {
  return JSON.stringify($);
}
function KK($) {
  return $.toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
var pX = "captureStackTrace" in Error ? Error.captureStackTrace : (...$) => {};
function F9($) {
  return typeof $ === "object" && $ !== null && !Array.isArray($);
}
var NK = GW(() => {
  if (N9.jitless) return !1;
  if (typeof navigator < "u" && navigator?.userAgent?.includes("Cloudflare")) return !1;
  try {
    return (new Function(""), !0);
  } catch ($) {
    return !1;
  }
});
function E8($) {
  if (F9($) === !1) return !1;
  let J = $.constructor;
  if (J === void 0) return !0;
  if (typeof J !== "function") return !0;
  let U = J.prototype;
  if (F9(U) === !1) return !1;
  if (Object.prototype.hasOwnProperty.call(U, "isPrototypeOf") === !1) return !1;
  return !0;
}
function dX($) {
  if (E8($)) return { ...$ };
  if (Array.isArray($)) return [...$];
  if ($ instanceof Map) return new Map($);
  if ($ instanceof Set) return new Set($);
  return $;
}
function ZS($) {
  let J = 0;
  for (let U in $) if (Object.prototype.hasOwnProperty.call($, U)) J++;
  return J;
}
var PS = ($) => {
    let J = typeof $;
    switch (J) {
      case "undefined":
        return "undefined";
      case "string":
        return "string";
      case "number":
        return Number.isNaN($) ? "nan" : "number";
      case "boolean":
        return "boolean";
      case "function":
        return "function";
      case "bigint":
        return "bigint";
      case "symbol":
        return "symbol";
      case "object":
        if (Array.isArray($)) return "array";
        if ($ === null) return "null";
        if ($.then && typeof $.then === "function" && $.catch && typeof $.catch === "function") return "promise";
        if (typeof Map < "u" && $ instanceof Map) return "map";
        if (typeof Set < "u" && $ instanceof Set) return "set";
        if (typeof Date < "u" && $ instanceof Date) return "date";
        if (typeof File < "u" && $ instanceof File) return "file";
        return "object";
      default:
        throw Error(`Unknown data type: ${J}`);
    }
  },
  F7 = new Set(["string", "number", "symbol"]),
  OK = new Set(["string", "number", "bigint", "boolean", "symbol", "undefined"]);
function yJ($) {
  return $.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function b0($, J, U) {
  let Q = new $._zod.constr(J ?? $._zod.def);
  if (!J || U?.parent) Q._zod.parent = $;
  return Q;
}
function H$($) {
  let J = $;
  if (!J) return {};
  if (typeof J === "string") return { error: () => J };
  if (J?.message !== void 0) {
    if (J?.error !== void 0) throw Error("Cannot specify both `message` and `error` params");
    J.error = J.message;
  }
  if ((delete J.message, typeof J.error === "string")) return { ...J, error: () => J.error };
  return J;
}
function _S($) {
  let J;
  return new Proxy(
    {},
    {
      get(U, Q, W) {
        return (J ?? (J = $()), Reflect.get(J, Q, W));
      },
      set(U, Q, W, X) {
        return (J ?? (J = $()), Reflect.set(J, Q, W, X));
      },
      has(U, Q) {
        return (J ?? (J = $()), Reflect.has(J, Q));
      },
      deleteProperty(U, Q) {
        return (J ?? (J = $()), Reflect.deleteProperty(J, Q));
      },
      ownKeys(U) {
        return (J ?? (J = $()), Reflect.ownKeys(J));
      },
      getOwnPropertyDescriptor(U, Q) {
        return (J ?? (J = $()), Reflect.getOwnPropertyDescriptor(J, Q));
      },
      defineProperty(U, Q, W) {
        return (J ?? (J = $()), Reflect.defineProperty(J, Q, W));
      },
    },
  );
}
function $$($) {
  if (typeof $ === "bigint") return $.toString() + "n";
  if (typeof $ === "string") return `"${$}"`;
  return `${$}`;
}
function FK($) {
  return Object.keys($).filter((J) => {
    return $[J]._zod.optin === "optional" && $[J]._zod.optout === "optional";
  });
}
var qK = {
    safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
    int32: [-2147483648, 2147483647],
    uint32: [0, 4294967295],
    float32: [-340282346638528860000000000000000000000, 340282346638528860000000000000000000000],
    float64: [-Number.MAX_VALUE, Number.MAX_VALUE],
  },
  zK = {
    int64: [BigInt("-9223372036854775808"), BigInt("9223372036854775807")],
    uint64: [BigInt(0), BigInt("18446744073709551615")],
  };
function NL($, J) {
  let U = $._zod.def,
    Q = U.checks;
  if (Q && Q.length > 0) throw Error(".pick() cannot be used on object schemas containing refinements");
  let X = nU($._zod.def, {
    get shape() {
      let Y = {};
      for (let D in J) {
        if (!(D in U.shape)) throw Error(`Unrecognized key: "${D}"`);
        if (!J[D]) continue;
        Y[D] = U.shape[D];
      }
      return (B8(this, "shape", Y), Y);
    },
    checks: [],
  });
  return b0($, X);
}
function OL($, J) {
  let U = $._zod.def,
    Q = U.checks;
  if (Q && Q.length > 0) throw Error(".omit() cannot be used on object schemas containing refinements");
  let X = nU($._zod.def, {
    get shape() {
      let Y = { ...$._zod.def.shape };
      for (let D in J) {
        if (!(D in U.shape)) throw Error(`Unrecognized key: "${D}"`);
        if (!J[D]) continue;
        delete Y[D];
      }
      return (B8(this, "shape", Y), Y);
    },
    checks: [],
  });
  return b0($, X);
}
function FL($, J) {
  if (!E8(J)) throw Error("Invalid input to extend: expected a plain object");
  let U = $._zod.def.checks;
  if (U && U.length > 0) {
    let X = $._zod.def.shape;
    for (let Y in J)
      if (Object.getOwnPropertyDescriptor(X, Y) !== void 0)
        throw Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
  }
  let W = nU($._zod.def, {
    get shape() {
      let X = { ...$._zod.def.shape, ...J };
      return (B8(this, "shape", X), X);
    },
  });
  return b0($, W);
}
function qL($, J) {
  if (!E8(J)) throw Error("Invalid input to safeExtend: expected a plain object");
  let U = nU($._zod.def, {
    get shape() {
      let Q = { ...$._zod.def.shape, ...J };
      return (B8(this, "shape", Q), Q);
    },
  });
  return b0($, U);
}
function SS($, J) {
  if ($._zod.def.checks?.length)
    throw Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
  let U = nU($._zod.def, {
    get shape() {
      let Q = { ...$._zod.def.shape, ...J._zod.def.shape };
      return (B8(this, "shape", Q), Q);
    },
    get catchall() {
      return J._zod.def.catchall;
    },
    checks: J._zod.def.checks ?? [],
  });
  return b0($, U);
}
function zL($, J, U) {
  let W = J._zod.def.checks;
  if (W && W.length > 0) throw Error(".partial() cannot be used on object schemas containing refinements");
  let Y = nU(J._zod.def, {
    get shape() {
      let D = J._zod.def.shape,
        H = { ...D };
      if (U)
        for (let G in U) {
          if (!(G in D)) throw Error(`Unrecognized key: "${G}"`);
          if (!U[G]) continue;
          H[G] = $ ? new $({ type: "optional", innerType: D[G] }) : D[G];
        }
      else for (let G in D) H[G] = $ ? new $({ type: "optional", innerType: D[G] }) : D[G];
      return (B8(this, "shape", H), H);
    },
    checks: [],
  });
  return b0(J, Y);
}
function BL($, J, U) {
  let Q = nU(J._zod.def, {
    get shape() {
      let W = J._zod.def.shape,
        X = { ...W };
      if (U)
        for (let Y in U) {
          if (!(Y in X)) throw Error(`Unrecognized key: "${Y}"`);
          if (!U[Y]) continue;
          X[Y] = new $({ type: "nonoptional", innerType: W[Y] });
        }
      else for (let Y in W) X[Y] = new $({ type: "nonoptional", innerType: W[Y] });
      return (B8(this, "shape", X), X);
    },
  });
  return b0(J, Q);
}
function L8($, J = 0) {
  if ($.aborted === !0) return !0;
  for (let U = J; U < $.issues.length; U++) if ($.issues[U]?.continue !== !0) return !0;
  return !1;
}
function BK($, J = 0) {
  if ($.aborted === !0) return !0;
  for (let U = J; U < $.issues.length; U++) if ($.issues[U]?.continue === !1) return !0;
  return !1;
}
function qJ($, J) {
  return J.map((U) => {
    var Q;
    return ((Q = U).path ?? (Q.path = []), U.path.unshift($), U);
  });
}
function K7($) {
  return typeof $ === "string" ? $ : $?.message;
}
function JJ($, J, U) {
  let Q = $.message
      ? $.message
      : (K7($.inst?._zod.def?.error?.($)) ??
        K7(J?.error?.($)) ??
        K7(U.customError?.($)) ??
        K7(U.localeError?.($)) ??
        "Invalid input"),
    { inst: W, continue: X, input: Y, ...D } = $;
  if ((D.path ?? (D.path = []), (D.message = Q), J?.reportInput)) D.input = Y;
  return D;
}
function q7($) {
  if ($ instanceof Set) return "set";
  if ($ instanceof Map) return "map";
  if ($ instanceof File) return "file";
  return "unknown";
}
function z7($) {
  if (Array.isArray($)) return "array";
  if (typeof $ === "string") return "string";
  return "unknown";
}
function U$($) {
  let J = typeof $;
  switch (J) {
    case "number":
      return Number.isNaN($) ? "nan" : "number";
    case "object": {
      if ($ === null) return "null";
      if (Array.isArray($)) return "array";
      let U = $;
      if (U && Object.getPrototypeOf(U) !== Object.prototype && "constructor" in U && U.constructor)
        return U.constructor.name;
    }
  }
  return J;
}
function KW(...$) {
  let [J, U, Q] = $;
  if (typeof J === "string") return { message: J, code: "custom", input: U, inst: Q };
  return { ...J };
}
function CS($) {
  return Object.entries($)
    .filter(([J, U]) => {
      return Number.isNaN(Number.parseInt(J, 10));
    })
    .map((J) => J[1]);
}
function EL($) {
  let J = atob($),
    U = new Uint8Array(J.length);
  for (let Q = 0; Q < J.length; Q++) U[Q] = J.charCodeAt(Q);
  return U;
}
function LL($) {
  let J = "";
  for (let U = 0; U < $.length; U++) J += String.fromCharCode($[U]);
  return btoa(J);
}
function TS($) {
  let J = $.replace(/-/g, "+").replace(/_/g, "/"),
    U = "=".repeat((4 - (J.length % 4)) % 4);
  return EL(J + U);
}
function jS($) {
  return LL($).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function vS($) {
  let J = $.replace(/^0x/, "");
  if (J.length % 2 !== 0) throw Error("Invalid hex string length");
  let U = new Uint8Array(J.length / 2);
  for (let Q = 0; Q < J.length; Q += 2) U[Q / 2] = Number.parseInt(J.slice(Q, Q + 2), 16);
  return U;
}
function bS($) {
  return Array.from($)
    .map((J) => J.toString(16).padStart(2, "0"))
    .join("");
}
class wL {
  constructor(...$) {}
}
var IL = ($, J) => {
    (($.name = "$ZodError"),
      Object.defineProperty($, "_zod", { value: $._zod, enumerable: !1 }),
      Object.defineProperty($, "issues", { value: J, enumerable: !1 }),
      ($.message = JSON.stringify(J, HW, 2)),
      Object.defineProperty($, "toString", { value: () => $.message, enumerable: !1 }));
  },
  B7 = v("$ZodError", IL),
  zJ = v("$ZodError", IL, { Parent: Error });
function E7($, J = (U) => U.message) {
  let U = {},
    Q = [];
  for (let W of $.issues)
    if (W.path.length > 0) ((U[W.path[0]] = U[W.path[0]] || []), U[W.path[0]].push(J(W)));
    else Q.push(J(W));
  return { formErrors: Q, fieldErrors: U };
}
function L7($, J = (U) => U.message) {
  let U = { _errors: [] },
    Q = (W, X = []) => {
      for (let Y of W.issues)
        if (Y.code === "invalid_union" && Y.errors.length) Y.errors.map((D) => Q({ issues: D }, [...X, ...Y.path]));
        else if (Y.code === "invalid_key") Q({ issues: Y.issues }, [...X, ...Y.path]);
        else if (Y.code === "invalid_element") Q({ issues: Y.issues }, [...X, ...Y.path]);
        else {
          let D = [...X, ...Y.path];
          if (D.length === 0) U._errors.push(J(Y));
          else {
            let H = U,
              G = 0;
            while (G < D.length) {
              let K = D[G];
              if (G !== D.length - 1) H[K] = H[K] || { _errors: [] };
              else ((H[K] = H[K] || { _errors: [] }), H[K]._errors.push(J(Y)));
              ((H = H[K]), G++);
            }
          }
        }
    };
  return (Q($), U);
}
function EK($, J = (U) => U.message) {
  let U = { errors: [] },
    Q = (W, X = []) => {
      var Y, D;
      for (let H of W.issues)
        if (H.code === "invalid_union" && H.errors.length) H.errors.map((G) => Q({ issues: G }, [...X, ...H.path]));
        else if (H.code === "invalid_key") Q({ issues: H.issues }, [...X, ...H.path]);
        else if (H.code === "invalid_element") Q({ issues: H.issues }, [...X, ...H.path]);
        else {
          let G = [...X, ...H.path];
          if (G.length === 0) {
            U.errors.push(J(H));
            continue;
          }
          let K = U,
            O = 0;
          while (O < G.length) {
            let N = G[O],
              F = O === G.length - 1;
            if (typeof N === "string")
              (K.properties ?? (K.properties = {}),
                (Y = K.properties)[N] ?? (Y[N] = { errors: [] }),
                (K = K.properties[N]));
            else (K.items ?? (K.items = []), (D = K.items)[N] ?? (D[N] = { errors: [] }), (K = K.items[N]));
            if (F) K.errors.push(J(H));
            O++;
          }
        }
    };
  return (Q($), U);
}
function VL($) {
  let J = [],
    U = $.map((Q) => (typeof Q === "object" ? Q.key : Q));
  for (let Q of U)
    if (typeof Q === "number") J.push(`[${Q}]`);
    else if (typeof Q === "symbol") J.push(`[${JSON.stringify(String(Q))}]`);
    else if (/[^\w$]/.test(Q)) J.push(`[${JSON.stringify(Q)}]`);
    else {
      if (J.length) J.push(".");
      J.push(Q);
    }
  return J.join("");
}
function LK($) {
  let J = [],
    U = [...$.issues].sort((Q, W) => (Q.path ?? []).length - (W.path ?? []).length);
  for (let Q of U) if ((J.push(`\u2716 ${Q.message}`), Q.path?.length)) J.push(`  \u2192 at ${VL(Q.path)}`);
  return J.join(`
`);
}
var NW = ($) => (J, U, Q, W) => {
    let X = Q ? { ...Q, async: !1 } : { async: !1 },
      Y = J._zod.run({ value: U, issues: [] }, X);
    if (Y instanceof Promise) throw new kU();
    if (Y.issues.length) {
      let D = new (W?.Err ?? $)(Y.issues.map((H) => JJ(H, X, E0())));
      throw (pX(D, W?.callee), D);
    }
    return Y.value;
  },
  q9 = NW(zJ),
  OW = ($) => async (J, U, Q, W) => {
    let X = Q ? { ...Q, async: !0 } : { async: !0 },
      Y = J._zod.run({ value: U, issues: [] }, X);
    if (Y instanceof Promise) Y = await Y;
    if (Y.issues.length) {
      let D = new (W?.Err ?? $)(Y.issues.map((H) => JJ(H, X, E0())));
      throw (pX(D, W?.callee), D);
    }
    return Y.value;
  },
  z9 = OW(zJ),
  FW = ($) => (J, U, Q) => {
    let W = Q ? { ...Q, async: !1 } : { async: !1 },
      X = J._zod.run({ value: U, issues: [] }, W);
    if (X instanceof Promise) throw new kU();
    return X.issues.length
      ? { success: !1, error: new ($ ?? B7)(X.issues.map((Y) => JJ(Y, W, E0()))) }
      : { success: !0, data: X.value };
  },
  w8 = FW(zJ),
  qW = ($) => async (J, U, Q) => {
    let W = Q ? { ...Q, async: !0 } : { async: !0 },
      X = J._zod.run({ value: U, issues: [] }, W);
    if (X instanceof Promise) X = await X;
    return X.issues.length
      ? { success: !1, error: new $(X.issues.map((Y) => JJ(Y, W, E0()))) }
      : { success: !0, data: X.value };
  },
  I8 = qW(zJ),
  cX = ($) => (J, U, Q) => {
    let W = Q ? { ...Q, direction: "backward" } : { direction: "backward" };
    return NW($)(J, U, W);
  },
  kL = cX(zJ),
  nX = ($) => (J, U, Q) => {
    return NW($)(J, U, Q);
  },
  AL = nX(zJ),
  iX = ($) => async (J, U, Q) => {
    let W = Q ? { ...Q, direction: "backward" } : { direction: "backward" };
    return OW($)(J, U, W);
  },
  ML = iX(zJ),
  oX = ($) => async (J, U, Q) => {
    return OW($)(J, U, Q);
  },
  RL = oX(zJ),
  rX = ($) => (J, U, Q) => {
    let W = Q ? { ...Q, direction: "backward" } : { direction: "backward" };
    return FW($)(J, U, W);
  },
  ZL = rX(zJ),
  sX = ($) => (J, U, Q) => {
    return FW($)(J, U, Q);
  },
  PL = sX(zJ),
  aX = ($) => async (J, U, Q) => {
    let W = Q ? { ...Q, direction: "backward" } : { direction: "backward" };
    return qW($)(J, U, W);
  },
  _L = aX(zJ),
  tX = ($) => async (J, U, Q) => {
    return qW($)(J, U, Q);
  },
  SL = tX(zJ);
var BJ = {};
uU(BJ, {
  xid: () => kK,
  uuid7: () => hS,
  uuid6: () => gS,
  uuid4: () => xS,
  uuid: () => B9,
  uppercase: () => iK,
  unicodeEmail: () => CL,
  undefined: () => cK,
  ulid: () => VK,
  time: () => gK,
  string: () => uK,
  sha512_hex: () => YC,
  sha512_base64url: () => HC,
  sha512_base64: () => DC,
  sha384_hex: () => WC,
  sha384_base64url: () => XC,
  sha384_base64: () => QC,
  sha256_hex: () => $C,
  sha256_base64url: () => UC,
  sha256_base64: () => JC,
  sha1_hex: () => aS,
  sha1_base64url: () => eS,
  sha1_base64: () => tS,
  rfc5322Email: () => lS,
  number: () => w7,
  null: () => dK,
  nanoid: () => MK,
  md5_hex: () => oS,
  md5_base64url: () => sS,
  md5_base64: () => rS,
  mac: () => TK,
  lowercase: () => nK,
  ksuid: () => AK,
  ipv6: () => CK,
  ipv4: () => SK,
  integer: () => mK,
  idnEmail: () => mS,
  httpProtocol: () => fK,
  html5Email: () => uS,
  hostname: () => cS,
  hex: () => iS,
  guid: () => ZK,
  extendedDuration: () => yS,
  emoji: () => _K,
  email: () => PK,
  e164: () => yK,
  duration: () => RK,
  domain: () => nS,
  datetime: () => hK,
  date: () => xK,
  cuid2: () => IK,
  cuid: () => wK,
  cidrv6: () => vK,
  cidrv4: () => jK,
  browserEmail: () => pS,
  boolean: () => pK,
  bigint: () => lK,
  base64url: () => eX,
  base64: () => bK,
});
var wK = /^[cC][0-9a-z]{6,}$/,
  IK = /^[0-9a-z]+$/,
  VK = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/,
  kK = /^[0-9a-vA-V]{20}$/,
  AK = /^[A-Za-z0-9]{27}$/,
  MK = /^[a-zA-Z0-9_-]{21}$/,
  RK = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/,
  yS =
    /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/,
  ZK = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/,
  B9 = ($) => {
    if (!$)
      return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
    return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${$}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
  },
  xS = B9(4),
  gS = B9(6),
  hS = B9(7),
  PK = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/,
  uS =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  lS =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
  CL = /^[^\s@"]{1,64}@[^\s@]{1,255}$/u,
  mS = CL,
  pS =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  dS = "^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$";
function _K() {
  return new RegExp(dS, "u");
}
var SK =
    /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,
  CK =
    /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/,
  TK = ($) => {
    let J = yJ($ ?? ":");
    return new RegExp(`^(?:[0-9A-F]{2}${J}){5}[0-9A-F]{2}$|^(?:[0-9a-f]{2}${J}){5}[0-9a-f]{2}$`);
  },
  jK =
    /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/,
  vK =
    /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,
  bK = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/,
  eX = /^[A-Za-z0-9_-]*$/,
  cS =
    /^(?=.{1,253}\.?$)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[-0-9a-zA-Z]{0,61}[0-9a-zA-Z])?)*\.?$/,
  nS = /^([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
  fK = /^https?$/,
  yK = /^\+[1-9]\d{6,14}$/,
  TL =
    "(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))",
  xK = new RegExp(`^${TL}$`);
function jL($) {
  return typeof $.precision === "number"
    ? $.precision === -1
      ? "(?:[01]\\d|2[0-3]):[0-5]\\d"
      : $.precision === 0
        ? "(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d"
        : `(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d\\.\\d{${$.precision}}`
    : "(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?";
}
function gK($) {
  return new RegExp(`^${jL($)}$`);
}
function hK($) {
  let J = jL({ precision: $.precision }),
    U = ["Z"];
  if ($.local) U.push("");
  if ($.offset) U.push("([+-](?:[01]\\d|2[0-3]):[0-5]\\d)");
  let Q = `${J}(?:${U.join("|")})`;
  return new RegExp(`^${TL}T(?:${Q})$`);
}
var uK = ($) => {
    let J = $ ? `[\\s\\S]{${$?.minimum ?? 0},${$?.maximum ?? ""}}` : "[\\s\\S]*";
    return new RegExp(`^${J}$`);
  },
  lK = /^-?\d+n?$/,
  mK = /^-?\d+$/,
  w7 = /^-?\d+(?:\.\d+)?$/,
  pK = /^(?:true|false)$/i,
  dK = /^null$/i;
var cK = /^undefined$/i;
var nK = /^[^A-Z]*$/,
  iK = /^[^a-z]*$/,
  iS = /^[0-9a-fA-F]*$/;
function I7($, J) {
  return new RegExp(`^[A-Za-z0-9+/]{${$}}${J}$`);
}
function V7($) {
  return new RegExp(`^[A-Za-z0-9_-]{${$}}$`);
}
var oS = /^[0-9a-fA-F]{32}$/,
  rS = I7(22, "=="),
  sS = V7(22),
  aS = /^[0-9a-fA-F]{40}$/,
  tS = I7(27, "="),
  eS = V7(27),
  $C = /^[0-9a-fA-F]{64}$/,
  JC = I7(43, "="),
  UC = V7(43),
  WC = /^[0-9a-fA-F]{96}$/,
  QC = I7(64, ""),
  XC = V7(64),
  YC = /^[0-9a-fA-F]{128}$/,
  DC = I7(86, "=="),
  HC = V7(86);
var n6 = v("$ZodCheck", ($, J) => {
    var U;
    ($._zod ?? ($._zod = {}), ($._zod.def = J), (U = $._zod).onattach ?? (U.onattach = []));
  }),
  bL = { number: "number", bigint: "bigint", object: "date" },
  $Y = v("$ZodCheckLessThan", ($, J) => {
    n6.init($, J);
    let U = bL[typeof J.value];
    ($._zod.onattach.push((Q) => {
      let W = Q._zod.bag,
        X = (J.inclusive ? W.maximum : W.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
      if (J.value < X)
        if (J.inclusive) W.maximum = J.value;
        else W.exclusiveMaximum = J.value;
    }),
      ($._zod.check = (Q) => {
        if (J.inclusive ? Q.value <= J.value : Q.value < J.value) return;
        Q.issues.push({
          origin: U,
          code: "too_big",
          maximum: typeof J.value === "object" ? J.value.getTime() : J.value,
          input: Q.value,
          inclusive: J.inclusive,
          inst: $,
          continue: !J.abort,
        });
      }));
  }),
  JY = v("$ZodCheckGreaterThan", ($, J) => {
    n6.init($, J);
    let U = bL[typeof J.value];
    ($._zod.onattach.push((Q) => {
      let W = Q._zod.bag,
        X = (J.inclusive ? W.minimum : W.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
      if (J.value > X)
        if (J.inclusive) W.minimum = J.value;
        else W.exclusiveMinimum = J.value;
    }),
      ($._zod.check = (Q) => {
        if (J.inclusive ? Q.value >= J.value : Q.value > J.value) return;
        Q.issues.push({
          origin: U,
          code: "too_small",
          minimum: typeof J.value === "object" ? J.value.getTime() : J.value,
          input: Q.value,
          inclusive: J.inclusive,
          inst: $,
          continue: !J.abort,
        });
      }));
  }),
  oK = v("$ZodCheckMultipleOf", ($, J) => {
    (n6.init($, J),
      $._zod.onattach.push((U) => {
        var Q;
        (Q = U._zod.bag).multipleOf ?? (Q.multipleOf = J.value);
      }),
      ($._zod.check = (U) => {
        if (typeof U.value !== typeof J.value) throw Error("Cannot mix number and bigint in multiple_of check.");
        if (typeof U.value === "bigint" ? U.value % J.value === BigInt(0) : GK(U.value, J.value) === 0) return;
        U.issues.push({
          origin: typeof U.value,
          code: "not_multiple_of",
          divisor: J.value,
          input: U.value,
          inst: $,
          continue: !J.abort,
        });
      }));
  }),
  rK = v("$ZodCheckNumberFormat", ($, J) => {
    (n6.init($, J), (J.format = J.format || "float64"));
    let U = J.format?.includes("int"),
      Q = U ? "int" : "number",
      [W, X] = qK[J.format];
    ($._zod.onattach.push((Y) => {
      let D = Y._zod.bag;
      if (((D.format = J.format), (D.minimum = W), (D.maximum = X), U)) D.pattern = mK;
    }),
      ($._zod.check = (Y) => {
        let D = Y.value;
        if (U) {
          if (!Number.isInteger(D)) {
            Y.issues.push({ expected: Q, format: J.format, code: "invalid_type", continue: !1, input: D, inst: $ });
            return;
          }
          if (!Number.isSafeInteger(D)) {
            if (D > 0)
              Y.issues.push({
                input: D,
                code: "too_big",
                maximum: Number.MAX_SAFE_INTEGER,
                note: "Integers must be within the safe integer range.",
                inst: $,
                origin: Q,
                inclusive: !0,
                continue: !J.abort,
              });
            else
              Y.issues.push({
                input: D,
                code: "too_small",
                minimum: Number.MIN_SAFE_INTEGER,
                note: "Integers must be within the safe integer range.",
                inst: $,
                origin: Q,
                inclusive: !0,
                continue: !J.abort,
              });
            return;
          }
        }
        if (D < W)
          Y.issues.push({
            origin: "number",
            input: D,
            code: "too_small",
            minimum: W,
            inclusive: !0,
            inst: $,
            continue: !J.abort,
          });
        if (D > X)
          Y.issues.push({
            origin: "number",
            input: D,
            code: "too_big",
            maximum: X,
            inclusive: !0,
            inst: $,
            continue: !J.abort,
          });
      }));
  }),
  sK = v("$ZodCheckBigIntFormat", ($, J) => {
    n6.init($, J);
    let [U, Q] = zK[J.format];
    ($._zod.onattach.push((W) => {
      let X = W._zod.bag;
      ((X.format = J.format), (X.minimum = U), (X.maximum = Q));
    }),
      ($._zod.check = (W) => {
        let X = W.value;
        if (X < U)
          W.issues.push({
            origin: "bigint",
            input: X,
            code: "too_small",
            minimum: U,
            inclusive: !0,
            inst: $,
            continue: !J.abort,
          });
        if (X > Q)
          W.issues.push({
            origin: "bigint",
            input: X,
            code: "too_big",
            maximum: Q,
            inclusive: !0,
            inst: $,
            continue: !J.abort,
          });
      }));
  }),
  aK = v("$ZodCheckMaxSize", ($, J) => {
    var U;
    (n6.init($, J),
      (U = $._zod.def).when ??
        (U.when = (Q) => {
          let W = Q.value;
          return !z8(W) && W.size !== void 0;
        }),
      $._zod.onattach.push((Q) => {
        let W = Q._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
        if (J.maximum < W) Q._zod.bag.maximum = J.maximum;
      }),
      ($._zod.check = (Q) => {
        let W = Q.value;
        if (W.size <= J.maximum) return;
        Q.issues.push({
          origin: q7(W),
          code: "too_big",
          maximum: J.maximum,
          inclusive: !0,
          input: W,
          inst: $,
          continue: !J.abort,
        });
      }));
  }),
  tK = v("$ZodCheckMinSize", ($, J) => {
    var U;
    (n6.init($, J),
      (U = $._zod.def).when ??
        (U.when = (Q) => {
          let W = Q.value;
          return !z8(W) && W.size !== void 0;
        }),
      $._zod.onattach.push((Q) => {
        let W = Q._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
        if (J.minimum > W) Q._zod.bag.minimum = J.minimum;
      }),
      ($._zod.check = (Q) => {
        let W = Q.value;
        if (W.size >= J.minimum) return;
        Q.issues.push({
          origin: q7(W),
          code: "too_small",
          minimum: J.minimum,
          inclusive: !0,
          input: W,
          inst: $,
          continue: !J.abort,
        });
      }));
  }),
  eK = v("$ZodCheckSizeEquals", ($, J) => {
    var U;
    (n6.init($, J),
      (U = $._zod.def).when ??
        (U.when = (Q) => {
          let W = Q.value;
          return !z8(W) && W.size !== void 0;
        }),
      $._zod.onattach.push((Q) => {
        let W = Q._zod.bag;
        ((W.minimum = J.size), (W.maximum = J.size), (W.size = J.size));
      }),
      ($._zod.check = (Q) => {
        let W = Q.value,
          X = W.size;
        if (X === J.size) return;
        let Y = X > J.size;
        Q.issues.push({
          origin: q7(W),
          ...(Y ? { code: "too_big", maximum: J.size } : { code: "too_small", minimum: J.size }),
          inclusive: !0,
          exact: !0,
          input: Q.value,
          inst: $,
          continue: !J.abort,
        });
      }));
  }),
  $4 = v("$ZodCheckMaxLength", ($, J) => {
    var U;
    (n6.init($, J),
      (U = $._zod.def).when ??
        (U.when = (Q) => {
          let W = Q.value;
          return !z8(W) && W.length !== void 0;
        }),
      $._zod.onattach.push((Q) => {
        let W = Q._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
        if (J.maximum < W) Q._zod.bag.maximum = J.maximum;
      }),
      ($._zod.check = (Q) => {
        let W = Q.value;
        if (W.length <= J.maximum) return;
        let Y = z7(W);
        Q.issues.push({
          origin: Y,
          code: "too_big",
          maximum: J.maximum,
          inclusive: !0,
          input: W,
          inst: $,
          continue: !J.abort,
        });
      }));
  }),
  J4 = v("$ZodCheckMinLength", ($, J) => {
    var U;
    (n6.init($, J),
      (U = $._zod.def).when ??
        (U.when = (Q) => {
          let W = Q.value;
          return !z8(W) && W.length !== void 0;
        }),
      $._zod.onattach.push((Q) => {
        let W = Q._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
        if (J.minimum > W) Q._zod.bag.minimum = J.minimum;
      }),
      ($._zod.check = (Q) => {
        let W = Q.value;
        if (W.length >= J.minimum) return;
        let Y = z7(W);
        Q.issues.push({
          origin: Y,
          code: "too_small",
          minimum: J.minimum,
          inclusive: !0,
          input: W,
          inst: $,
          continue: !J.abort,
        });
      }));
  }),
  U4 = v("$ZodCheckLengthEquals", ($, J) => {
    var U;
    (n6.init($, J),
      (U = $._zod.def).when ??
        (U.when = (Q) => {
          let W = Q.value;
          return !z8(W) && W.length !== void 0;
        }),
      $._zod.onattach.push((Q) => {
        let W = Q._zod.bag;
        ((W.minimum = J.length), (W.maximum = J.length), (W.length = J.length));
      }),
      ($._zod.check = (Q) => {
        let W = Q.value,
          X = W.length;
        if (X === J.length) return;
        let Y = z7(W),
          D = X > J.length;
        Q.issues.push({
          origin: Y,
          ...(D ? { code: "too_big", maximum: J.length } : { code: "too_small", minimum: J.length }),
          inclusive: !0,
          exact: !0,
          input: Q.value,
          inst: $,
          continue: !J.abort,
        });
      }));
  }),
  zW = v("$ZodCheckStringFormat", ($, J) => {
    var U, Q;
    if (
      (n6.init($, J),
      $._zod.onattach.push((W) => {
        let X = W._zod.bag;
        if (((X.format = J.format), J.pattern)) (X.patterns ?? (X.patterns = new Set()), X.patterns.add(J.pattern));
      }),
      J.pattern)
    )
      (U = $._zod).check ??
        (U.check = (W) => {
          if (((J.pattern.lastIndex = 0), J.pattern.test(W.value))) return;
          W.issues.push({
            origin: "string",
            code: "invalid_format",
            format: J.format,
            input: W.value,
            ...(J.pattern ? { pattern: J.pattern.toString() } : {}),
            inst: $,
            continue: !J.abort,
          });
        });
    else (Q = $._zod).check ?? (Q.check = () => {});
  }),
  W4 = v("$ZodCheckRegex", ($, J) => {
    (zW.init($, J),
      ($._zod.check = (U) => {
        if (((J.pattern.lastIndex = 0), J.pattern.test(U.value))) return;
        U.issues.push({
          origin: "string",
          code: "invalid_format",
          format: "regex",
          input: U.value,
          pattern: J.pattern.toString(),
          inst: $,
          continue: !J.abort,
        });
      }));
  }),
  Q4 = v("$ZodCheckLowerCase", ($, J) => {
    (J.pattern ?? (J.pattern = nK), zW.init($, J));
  }),
  X4 = v("$ZodCheckUpperCase", ($, J) => {
    (J.pattern ?? (J.pattern = iK), zW.init($, J));
  }),
  Y4 = v("$ZodCheckIncludes", ($, J) => {
    n6.init($, J);
    let U = yJ(J.includes),
      Q = new RegExp(typeof J.position === "number" ? `^.{${J.position}}${U}` : U);
    ((J.pattern = Q),
      $._zod.onattach.push((W) => {
        let X = W._zod.bag;
        (X.patterns ?? (X.patterns = new Set()), X.patterns.add(Q));
      }),
      ($._zod.check = (W) => {
        if (W.value.includes(J.includes, J.position)) return;
        W.issues.push({
          origin: "string",
          code: "invalid_format",
          format: "includes",
          includes: J.includes,
          input: W.value,
          inst: $,
          continue: !J.abort,
        });
      }));
  }),
  D4 = v("$ZodCheckStartsWith", ($, J) => {
    n6.init($, J);
    let U = new RegExp(`^${yJ(J.prefix)}.*`);
    (J.pattern ?? (J.pattern = U),
      $._zod.onattach.push((Q) => {
        let W = Q._zod.bag;
        (W.patterns ?? (W.patterns = new Set()), W.patterns.add(U));
      }),
      ($._zod.check = (Q) => {
        if (Q.value.startsWith(J.prefix)) return;
        Q.issues.push({
          origin: "string",
          code: "invalid_format",
          format: "starts_with",
          prefix: J.prefix,
          input: Q.value,
          inst: $,
          continue: !J.abort,
        });
      }));
  }),
  H4 = v("$ZodCheckEndsWith", ($, J) => {
    n6.init($, J);
    let U = new RegExp(`.*${yJ(J.suffix)}$`);
    (J.pattern ?? (J.pattern = U),
      $._zod.onattach.push((Q) => {
        let W = Q._zod.bag;
        (W.patterns ?? (W.patterns = new Set()), W.patterns.add(U));
      }),
      ($._zod.check = (Q) => {
        if (Q.value.endsWith(J.suffix)) return;
        Q.issues.push({
          origin: "string",
          code: "invalid_format",
          format: "ends_with",
          suffix: J.suffix,
          input: Q.value,
          inst: $,
          continue: !J.abort,
        });
      }));
  });
function vL($, J, U) {
  if ($.issues.length) J.issues.push(...qJ(U, $.issues));
}
var G4 = v("$ZodCheckProperty", ($, J) => {
    (n6.init($, J),
      ($._zod.check = (U) => {
        let Q = J.schema._zod.run({ value: U.value[J.property], issues: [] }, {});
        if (Q instanceof Promise) return Q.then((W) => vL(W, U, J.property));
        vL(Q, U, J.property);
        return;
      }));
  }),
  K4 = v("$ZodCheckMimeType", ($, J) => {
    n6.init($, J);
    let U = new Set(J.mime);
    ($._zod.onattach.push((Q) => {
      Q._zod.bag.mime = J.mime;
    }),
      ($._zod.check = (Q) => {
        if (U.has(Q.value.type)) return;
        Q.issues.push({ code: "invalid_value", values: J.mime, input: Q.value.type, inst: $, continue: !J.abort });
      }));
  }),
  N4 = v("$ZodCheckOverwrite", ($, J) => {
    (n6.init($, J),
      ($._zod.check = (U) => {
        U.value = J.tx(U.value);
      }));
  });
class UY {
  constructor($ = []) {
    if (((this.content = []), (this.indent = 0), this)) this.args = $;
  }
  indented($) {
    ((this.indent += 1), $(this), (this.indent -= 1));
  }
  write($) {
    if (typeof $ === "function") {
      ($(this, { execution: "sync" }), $(this, { execution: "async" }));
      return;
    }
    let U = $.split(
        `
`,
      ).filter((X) => X),
      Q = Math.min(...U.map((X) => X.length - X.trimStart().length)),
      W = U.map((X) => X.slice(Q)).map((X) => " ".repeat(this.indent * 2) + X);
    for (let X of W) this.content.push(X);
  }
  compile() {
    let $ = Function,
      J = this?.args,
      Q = [...(this?.content ?? [""]).map((W) => `  ${W}`)];
    return new $(
      ...J,
      Q.join(`
`),
    );
  }
}
var O4 = { major: 4, minor: 4, patch: 3 };
var $6 = v("$ZodType", ($, J) => {
    var U;
    ($ ?? ($ = {}), ($._zod.def = J), ($._zod.bag = $._zod.bag || {}), ($._zod.version = O4));
    let Q = [...($._zod.def.checks ?? [])];
    if ($._zod.traits.has("$ZodCheck")) Q.unshift($);
    for (let W of Q) for (let X of W._zod.onattach) X($);
    if (Q.length === 0)
      ((U = $._zod).deferred ?? (U.deferred = []),
        $._zod.deferred?.push(() => {
          $._zod.run = $._zod.parse;
        }));
    else {
      let W = (Y, D, H) => {
          let G = L8(Y),
            K;
          for (let O of D) {
            if (O._zod.def.when) {
              if (BK(Y)) continue;
              if (!O._zod.def.when(Y)) continue;
            } else if (G) continue;
            let N = Y.issues.length,
              F = O._zod.check(Y);
            if (F instanceof Promise && H?.async === !1) throw new kU();
            if (K || F instanceof Promise)
              K = (K ?? Promise.resolve()).then(async () => {
                if ((await F, Y.issues.length === N)) return;
                if (!G) G = L8(Y, N);
              });
            else {
              if (Y.issues.length === N) continue;
              if (!G) G = L8(Y, N);
            }
          }
          if (K)
            return K.then(() => {
              return Y;
            });
          return Y;
        },
        X = (Y, D, H) => {
          if (L8(Y)) return ((Y.aborted = !0), Y);
          let G = W(D, Q, H);
          if (G instanceof Promise) {
            if (H.async === !1) throw new kU();
            return G.then((K) => $._zod.parse(K, H));
          }
          return $._zod.parse(G, H);
        };
      $._zod.run = (Y, D) => {
        if (D.skipChecks) return $._zod.parse(Y, D);
        if (D.direction === "backward") {
          let G = $._zod.parse({ value: Y.value, issues: [] }, { ...D, skipChecks: !0 });
          if (G instanceof Promise)
            return G.then((K) => {
              return X(K, Y, D);
            });
          return X(G, Y, D);
        }
        let H = $._zod.parse(Y, D);
        if (H instanceof Promise) {
          if (D.async === !1) throw new kU();
          return H.then((G) => W(G, Q, D));
        }
        return W(H, Q, D);
      };
    }
    N6($, "~standard", () => ({
      validate: (W) => {
        try {
          let X = w8($, W);
          return X.success ? { value: X.data } : { issues: X.error?.issues };
        } catch (X) {
          return I8($, W).then((Y) => (Y.success ? { value: Y.data } : { issues: Y.error?.issues }));
        }
      },
      vendor: "zod",
      version: 1,
    }));
  }),
  V8 = v("$ZodString", ($, J) => {
    ($6.init($, J),
      ($._zod.pattern = [...($?._zod.bag?.patterns ?? [])].pop() ?? uK($._zod.bag)),
      ($._zod.parse = (U, Q) => {
        if (J.coerce)
          try {
            U.value = String(U.value);
          } catch (W) {}
        if (typeof U.value === "string") return U;
        return (U.issues.push({ expected: "string", code: "invalid_type", input: U.value, inst: $ }), U);
      }));
  }),
  h6 = v("$ZodStringFormat", ($, J) => {
    (zW.init($, J), V8.init($, J));
  }),
  DY = v("$ZodGUID", ($, J) => {
    (J.pattern ?? (J.pattern = ZK), h6.init($, J));
  }),
  HY = v("$ZodUUID", ($, J) => {
    if (J.version) {
      let Q = { v1: 1, v2: 2, v3: 3, v4: 4, v5: 5, v6: 6, v7: 7, v8: 8 }[J.version];
      if (Q === void 0) throw Error(`Invalid UUID version: "${J.version}"`);
      J.pattern ?? (J.pattern = B9(Q));
    } else J.pattern ?? (J.pattern = B9());
    h6.init($, J);
  }),
  GY = v("$ZodEmail", ($, J) => {
    (J.pattern ?? (J.pattern = PK), h6.init($, J));
  }),
  KY = v("$ZodURL", ($, J) => {
    (h6.init($, J),
      ($._zod.check = (U) => {
        try {
          let Q = U.value.trim();
          if (!J.normalize && J.protocol?.source === fK.source) {
            if (!/^https?:\/\//i.test(Q)) {
              U.issues.push({
                code: "invalid_format",
                format: "url",
                note: "Invalid URL format",
                input: U.value,
                inst: $,
                continue: !J.abort,
              });
              return;
            }
          }
          let W = new URL(Q);
          if (J.hostname) {
            if (((J.hostname.lastIndex = 0), !J.hostname.test(W.hostname)))
              U.issues.push({
                code: "invalid_format",
                format: "url",
                note: "Invalid hostname",
                pattern: J.hostname.source,
                input: U.value,
                inst: $,
                continue: !J.abort,
              });
          }
          if (J.protocol) {
            if (
              ((J.protocol.lastIndex = 0),
              !J.protocol.test(W.protocol.endsWith(":") ? W.protocol.slice(0, -1) : W.protocol))
            )
              U.issues.push({
                code: "invalid_format",
                format: "url",
                note: "Invalid protocol",
                pattern: J.protocol.source,
                input: U.value,
                inst: $,
                continue: !J.abort,
              });
          }
          if (J.normalize) U.value = W.href;
          else U.value = Q;
          return;
        } catch (Q) {
          U.issues.push({ code: "invalid_format", format: "url", input: U.value, inst: $, continue: !J.abort });
        }
      }));
  }),
  NY = v("$ZodEmoji", ($, J) => {
    (J.pattern ?? (J.pattern = _K()), h6.init($, J));
  }),
  OY = v("$ZodNanoID", ($, J) => {
    (J.pattern ?? (J.pattern = MK), h6.init($, J));
  }),
  FY = v("$ZodCUID", ($, J) => {
    (J.pattern ?? (J.pattern = wK), h6.init($, J));
  }),
  qY = v("$ZodCUID2", ($, J) => {
    (J.pattern ?? (J.pattern = IK), h6.init($, J));
  }),
  zY = v("$ZodULID", ($, J) => {
    (J.pattern ?? (J.pattern = VK), h6.init($, J));
  }),
  BY = v("$ZodXID", ($, J) => {
    (J.pattern ?? (J.pattern = kK), h6.init($, J));
  }),
  EY = v("$ZodKSUID", ($, J) => {
    (J.pattern ?? (J.pattern = AK), h6.init($, J));
  }),
  q4 = v("$ZodISODateTime", ($, J) => {
    (J.pattern ?? (J.pattern = hK(J)), h6.init($, J));
  }),
  z4 = v("$ZodISODate", ($, J) => {
    (J.pattern ?? (J.pattern = xK), h6.init($, J));
  }),
  B4 = v("$ZodISOTime", ($, J) => {
    (J.pattern ?? (J.pattern = gK(J)), h6.init($, J));
  }),
  E4 = v("$ZodISODuration", ($, J) => {
    (J.pattern ?? (J.pattern = RK), h6.init($, J));
  }),
  LY = v("$ZodIPv4", ($, J) => {
    (J.pattern ?? (J.pattern = SK), h6.init($, J), ($._zod.bag.format = "ipv4"));
  }),
  wY = v("$ZodIPv6", ($, J) => {
    (J.pattern ?? (J.pattern = CK),
      h6.init($, J),
      ($._zod.bag.format = "ipv6"),
      ($._zod.check = (U) => {
        try {
          new URL(`http://[${U.value}]`);
        } catch {
          U.issues.push({ code: "invalid_format", format: "ipv6", input: U.value, inst: $, continue: !J.abort });
        }
      }));
  }),
  IY = v("$ZodMAC", ($, J) => {
    (J.pattern ?? (J.pattern = TK(J.delimiter)), h6.init($, J), ($._zod.bag.format = "mac"));
  }),
  VY = v("$ZodCIDRv4", ($, J) => {
    (J.pattern ?? (J.pattern = jK), h6.init($, J));
  }),
  kY = v("$ZodCIDRv6", ($, J) => {
    (J.pattern ?? (J.pattern = vK),
      h6.init($, J),
      ($._zod.check = (U) => {
        let Q = U.value.split("/");
        try {
          if (Q.length !== 2) throw Error();
          let [W, X] = Q;
          if (!X) throw Error();
          let Y = Number(X);
          if (`${Y}` !== X) throw Error();
          if (Y < 0 || Y > 128) throw Error();
          new URL(`http://[${W}]`);
        } catch {
          U.issues.push({ code: "invalid_format", format: "cidrv6", input: U.value, inst: $, continue: !J.abort });
        }
      }));
  });
function L4($) {
  if ($ === "") return !0;
  if (/\s/.test($)) return !1;
  if ($.length % 4 !== 0) return !1;
  try {
    return (atob($), !0);
  } catch {
    return !1;
  }
}
var AY = v("$ZodBase64", ($, J) => {
  (J.pattern ?? (J.pattern = bK),
    h6.init($, J),
    ($._zod.bag.contentEncoding = "base64"),
    ($._zod.check = (U) => {
      if (L4(U.value)) return;
      U.issues.push({ code: "invalid_format", format: "base64", input: U.value, inst: $, continue: !J.abort });
    }));
});
function sL($) {
  if (!eX.test($)) return !1;
  let J = $.replace(/[-_]/g, (Q) => (Q === "-" ? "+" : "/")),
    U = J.padEnd(Math.ceil(J.length / 4) * 4, "=");
  return L4(U);
}
var MY = v("$ZodBase64URL", ($, J) => {
    (J.pattern ?? (J.pattern = eX),
      h6.init($, J),
      ($._zod.bag.contentEncoding = "base64url"),
      ($._zod.check = (U) => {
        if (sL(U.value)) return;
        U.issues.push({ code: "invalid_format", format: "base64url", input: U.value, inst: $, continue: !J.abort });
      }));
  }),
  RY = v("$ZodE164", ($, J) => {
    (J.pattern ?? (J.pattern = yK), h6.init($, J));
  });
function aL($, J = null) {
  try {
    let U = $.split(".");
    if (U.length !== 3) return !1;
    let [Q] = U;
    if (!Q) return !1;
    let W = JSON.parse(atob(Q));
    if ("typ" in W && W?.typ !== "JWT") return !1;
    if (!W.alg) return !1;
    if (J && (!("alg" in W) || W.alg !== J)) return !1;
    return !0;
  } catch {
    return !1;
  }
}
var ZY = v("$ZodJWT", ($, J) => {
    (h6.init($, J),
      ($._zod.check = (U) => {
        if (aL(U.value, J.alg)) return;
        U.issues.push({ code: "invalid_format", format: "jwt", input: U.value, inst: $, continue: !J.abort });
      }));
  }),
  PY = v("$ZodCustomStringFormat", ($, J) => {
    (h6.init($, J),
      ($._zod.check = (U) => {
        if (J.fn(U.value)) return;
        U.issues.push({ code: "invalid_format", format: J.format, input: U.value, inst: $, continue: !J.abort });
      }));
  }),
  k7 = v("$ZodNumber", ($, J) => {
    ($6.init($, J),
      ($._zod.pattern = $._zod.bag.pattern ?? w7),
      ($._zod.parse = (U, Q) => {
        if (J.coerce)
          try {
            U.value = Number(U.value);
          } catch (Y) {}
        let W = U.value;
        if (typeof W === "number" && !Number.isNaN(W) && Number.isFinite(W)) return U;
        let X = typeof W === "number" ? (Number.isNaN(W) ? "NaN" : !Number.isFinite(W) ? "Infinity" : void 0) : void 0;
        return (
          U.issues.push({ expected: "number", code: "invalid_type", input: W, inst: $, ...(X ? { received: X } : {}) }),
          U
        );
      }));
  }),
  _Y = v("$ZodNumberFormat", ($, J) => {
    (rK.init($, J), k7.init($, J));
  }),
  BW = v("$ZodBoolean", ($, J) => {
    ($6.init($, J),
      ($._zod.pattern = pK),
      ($._zod.parse = (U, Q) => {
        if (J.coerce)
          try {
            U.value = Boolean(U.value);
          } catch (X) {}
        let W = U.value;
        if (typeof W === "boolean") return U;
        return (U.issues.push({ expected: "boolean", code: "invalid_type", input: W, inst: $ }), U);
      }));
  }),
  A7 = v("$ZodBigInt", ($, J) => {
    ($6.init($, J),
      ($._zod.pattern = lK),
      ($._zod.parse = (U, Q) => {
        if (J.coerce)
          try {
            U.value = BigInt(U.value);
          } catch (W) {}
        if (typeof U.value === "bigint") return U;
        return (U.issues.push({ expected: "bigint", code: "invalid_type", input: U.value, inst: $ }), U);
      }));
  }),
  SY = v("$ZodBigIntFormat", ($, J) => {
    (sK.init($, J), A7.init($, J));
  }),
  CY = v("$ZodSymbol", ($, J) => {
    ($6.init($, J),
      ($._zod.parse = (U, Q) => {
        let W = U.value;
        if (typeof W === "symbol") return U;
        return (U.issues.push({ expected: "symbol", code: "invalid_type", input: W, inst: $ }), U);
      }));
  }),
  TY = v("$ZodUndefined", ($, J) => {
    ($6.init($, J),
      ($._zod.pattern = cK),
      ($._zod.values = new Set([void 0])),
      ($._zod.parse = (U, Q) => {
        let W = U.value;
        if (typeof W > "u") return U;
        return (U.issues.push({ expected: "undefined", code: "invalid_type", input: W, inst: $ }), U);
      }));
  }),
  jY = v("$ZodNull", ($, J) => {
    ($6.init($, J),
      ($._zod.pattern = dK),
      ($._zod.values = new Set([null])),
      ($._zod.parse = (U, Q) => {
        let W = U.value;
        if (W === null) return U;
        return (U.issues.push({ expected: "null", code: "invalid_type", input: W, inst: $ }), U);
      }));
  }),
  vY = v("$ZodAny", ($, J) => {
    ($6.init($, J), ($._zod.parse = (U) => U));
  }),
  bY = v("$ZodUnknown", ($, J) => {
    ($6.init($, J), ($._zod.parse = (U) => U));
  }),
  fY = v("$ZodNever", ($, J) => {
    ($6.init($, J),
      ($._zod.parse = (U, Q) => {
        return (U.issues.push({ expected: "never", code: "invalid_type", input: U.value, inst: $ }), U);
      }));
  }),
  yY = v("$ZodVoid", ($, J) => {
    ($6.init($, J),
      ($._zod.parse = (U, Q) => {
        let W = U.value;
        if (typeof W > "u") return U;
        return (U.issues.push({ expected: "void", code: "invalid_type", input: W, inst: $ }), U);
      }));
  }),
  xY = v("$ZodDate", ($, J) => {
    ($6.init($, J),
      ($._zod.parse = (U, Q) => {
        if (J.coerce)
          try {
            U.value = new Date(U.value);
          } catch (D) {}
        let W = U.value,
          X = W instanceof Date;
        if (X && !Number.isNaN(W.getTime())) return U;
        return (
          U.issues.push({
            expected: "date",
            code: "invalid_type",
            input: W,
            ...(X ? { received: "Invalid Date" } : {}),
            inst: $,
          }),
          U
        );
      }));
  });
function yL($, J, U) {
  if ($.issues.length) J.issues.push(...qJ(U, $.issues));
  J.value[U] = $.value;
}
var gY = v("$ZodArray", ($, J) => {
  ($6.init($, J),
    ($._zod.parse = (U, Q) => {
      let W = U.value;
      if (!Array.isArray(W)) return (U.issues.push({ expected: "array", code: "invalid_type", input: W, inst: $ }), U);
      U.value = Array(W.length);
      let X = [];
      for (let Y = 0; Y < W.length; Y++) {
        let D = W[Y],
          H = J.element._zod.run({ value: D, issues: [] }, Q);
        if (H instanceof Promise) X.push(H.then((G) => yL(G, U, Y)));
        else yL(H, U, Y);
      }
      if (X.length) return Promise.all(X).then(() => U);
      return U;
    }));
});
function YY($, J, U, Q, W, X) {
  let Y = U in Q;
  if ($.issues.length) {
    if (W && X && !Y) return;
    J.issues.push(...qJ(U, $.issues));
  }
  if (!Y && !W) {
    if (!$.issues.length) J.issues.push({ code: "invalid_type", expected: "nonoptional", input: void 0, path: [U] });
    return;
  }
  if ($.value === void 0) {
    if (Y) J.value[U] = void 0;
  } else J.value[U] = $.value;
}
function tL($) {
  let J = Object.keys($.shape);
  for (let Q of J)
    if (!$.shape?.[Q]?._zod?.traits?.has("$ZodType"))
      throw Error(`Invalid element at key "${Q}": expected a Zod schema`);
  let U = FK($.shape);
  return { ...$, keys: J, keySet: new Set(J), numKeys: J.length, optionalKeys: new Set(U) };
}
function eL($, J, U, Q, W, X) {
  let Y = [],
    D = W.keySet,
    H = W.catchall._zod,
    G = H.def.type,
    K = H.optin === "optional",
    O = H.optout === "optional";
  for (let N in J) {
    if (N === "__proto__") continue;
    if (D.has(N)) continue;
    if (G === "never") {
      Y.push(N);
      continue;
    }
    let F = H.run({ value: J[N], issues: [] }, Q);
    if (F instanceof Promise) $.push(F.then((B) => YY(B, U, N, J, K, O)));
    else YY(F, U, N, J, K, O);
  }
  if (Y.length) U.issues.push({ code: "unrecognized_keys", keys: Y, input: J, inst: X });
  if (!$.length) return U;
  return Promise.all($).then(() => {
    return U;
  });
}
var hY = v("$ZodObject", ($, J) => {
    if (($6.init($, J), !Object.getOwnPropertyDescriptor(J, "shape")?.get)) {
      let D = J.shape;
      Object.defineProperty(J, "shape", {
        get: () => {
          let H = { ...D };
          return (Object.defineProperty(J, "shape", { value: H }), H);
        },
      });
    }
    let Q = GW(() => tL(J));
    N6($._zod, "propValues", () => {
      let D = J.shape,
        H = {};
      for (let G in D) {
        let K = D[G]._zod;
        if (K.values) {
          H[G] ?? (H[G] = new Set());
          for (let O of K.values) H[G].add(O);
        }
      }
      return H;
    });
    let W = F9,
      X = J.catchall,
      Y;
    $._zod.parse = (D, H) => {
      Y ?? (Y = Q.value);
      let G = D.value;
      if (!W(G)) return (D.issues.push({ expected: "object", code: "invalid_type", input: G, inst: $ }), D);
      D.value = {};
      let K = [],
        O = Y.shape;
      for (let N of Y.keys) {
        let F = O[N],
          B = F._zod.optin === "optional",
          E = F._zod.optout === "optional",
          z = F._zod.run({ value: G[N], issues: [] }, H);
        if (z instanceof Promise) K.push(z.then((q) => YY(q, D, N, G, B, E)));
        else YY(z, D, N, G, B, E);
      }
      if (!X) return K.length ? Promise.all(K).then(() => D) : D;
      return eL(K, G, D, H, Q.value, $);
    };
  }),
  w4 = v("$ZodObjectJIT", ($, J) => {
    hY.init($, J);
    let U = $._zod.parse,
      Q = GW(() => tL(J)),
      W = (N) => {
        let F = new UY(["shape", "payload", "ctx"]),
          B = Q.value,
          E = (V) => {
            let k = mX(V);
            return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
          };
        F.write("const input = payload.value;");
        let z = Object.create(null),
          q = 0;
        for (let V of B.keys) z[V] = `key_${q++}`;
        F.write("const newResult = {};");
        for (let V of B.keys) {
          let k = z[V],
            R = mX(V),
            _ = N[V],
            S = _?._zod?.optin === "optional",
            w = _?._zod?.optout === "optional";
          if ((F.write(`const ${k} = ${E(V)};`), S && w))
            F.write(`
        if (${k}.issues.length) {
          if (${R} in input) {
            payload.issues = payload.issues.concat(${k}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${R}, ...iss.path] : [${R}]
            })));
          }
        }
        
        if (${k}.value === undefined) {
          if (${R} in input) {
            newResult[${R}] = undefined;
          }
        } else {
          newResult[${R}] = ${k}.value;
        }
        
      `);
          else if (!S)
            F.write(`
        const ${k}_present = ${R} in input;
        if (${k}.issues.length) {
          payload.issues = payload.issues.concat(${k}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${R}, ...iss.path] : [${R}]
          })));
        }
        if (!${k}_present && !${k}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${R}]
          });
        }

        if (${k}_present) {
          if (${k}.value === undefined) {
            newResult[${R}] = undefined;
          } else {
            newResult[${R}] = ${k}.value;
          }
        }

      `);
          else
            F.write(`
        if (${k}.issues.length) {
          payload.issues = payload.issues.concat(${k}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${R}, ...iss.path] : [${R}]
          })));
        }
        
        if (${k}.value === undefined) {
          if (${R} in input) {
            newResult[${R}] = undefined;
          }
        } else {
          newResult[${R}] = ${k}.value;
        }
        
      `);
        }
        (F.write("payload.value = newResult;"), F.write("return payload;"));
        let L = F.compile();
        return (V, k) => L(N, V, k);
      },
      X,
      Y = F9,
      D = !N9.jitless,
      G = D && NK.value,
      K = J.catchall,
      O;
    $._zod.parse = (N, F) => {
      O ?? (O = Q.value);
      let B = N.value;
      if (!Y(B)) return (N.issues.push({ expected: "object", code: "invalid_type", input: B, inst: $ }), N);
      if (D && G && F?.async === !1 && F.jitless !== !0) {
        if (!X) X = W(J.shape);
        if (((N = X(N, F)), !K)) return N;
        return eL([], B, N, F, O, $);
      }
      return U(N, F);
    };
  });
function xL($, J, U, Q) {
  for (let X of $) if (X.issues.length === 0) return ((J.value = X.value), J);
  let W = $.filter((X) => !L8(X));
  if (W.length === 1) return ((J.value = W[0].value), W[0]);
  return (
    J.issues.push({
      code: "invalid_union",
      input: J.value,
      inst: U,
      errors: $.map((X) => X.issues.map((Y) => JJ(Y, Q, E0()))),
    }),
    J
  );
}
var EW = v("$ZodUnion", ($, J) => {
  ($6.init($, J),
    N6($._zod, "optin", () => (J.options.some((Q) => Q._zod.optin === "optional") ? "optional" : void 0)),
    N6($._zod, "optout", () => (J.options.some((Q) => Q._zod.optout === "optional") ? "optional" : void 0)),
    N6($._zod, "values", () => {
      if (J.options.every((Q) => Q._zod.values)) return new Set(J.options.flatMap((Q) => Array.from(Q._zod.values)));
      return;
    }),
    N6($._zod, "pattern", () => {
      if (J.options.every((Q) => Q._zod.pattern)) {
        let Q = J.options.map((W) => W._zod.pattern);
        return new RegExp(`^(${Q.map((W) => O7(W.source)).join("|")})$`);
      }
      return;
    }));
  let U = J.options.length === 1 ? J.options[0]._zod.run : null;
  $._zod.parse = (Q, W) => {
    if (U) return U(Q, W);
    let X = !1,
      Y = [];
    for (let D of J.options) {
      let H = D._zod.run({ value: Q.value, issues: [] }, W);
      if (H instanceof Promise) (Y.push(H), (X = !0));
      else {
        if (H.issues.length === 0) return H;
        Y.push(H);
      }
    }
    if (!X) return xL(Y, Q, $, W);
    return Promise.all(Y).then((D) => {
      return xL(D, Q, $, W);
    });
  };
});
function gL($, J, U, Q) {
  let W = $.filter((X) => X.issues.length === 0);
  if (W.length === 1) return ((J.value = W[0].value), J);
  if (W.length === 0)
    J.issues.push({
      code: "invalid_union",
      input: J.value,
      inst: U,
      errors: $.map((X) => X.issues.map((Y) => JJ(Y, Q, E0()))),
    });
  else J.issues.push({ code: "invalid_union", input: J.value, inst: U, errors: [], inclusive: !1 });
  return J;
}
var uY = v("$ZodXor", ($, J) => {
    (EW.init($, J), (J.inclusive = !1));
    let U = J.options.length === 1 ? J.options[0]._zod.run : null;
    $._zod.parse = (Q, W) => {
      if (U) return U(Q, W);
      let X = !1,
        Y = [];
      for (let D of J.options) {
        let H = D._zod.run({ value: Q.value, issues: [] }, W);
        if (H instanceof Promise) (Y.push(H), (X = !0));
        else Y.push(H);
      }
      if (!X) return gL(Y, Q, $, W);
      return Promise.all(Y).then((D) => {
        return gL(D, Q, $, W);
      });
    };
  }),
  lY = v("$ZodDiscriminatedUnion", ($, J) => {
    ((J.inclusive = !1), EW.init($, J));
    let U = $._zod.parse;
    N6($._zod, "propValues", () => {
      let W = {};
      for (let X of J.options) {
        let Y = X._zod.propValues;
        if (!Y || Object.keys(Y).length === 0)
          throw Error(`Invalid discriminated union option at index "${J.options.indexOf(X)}"`);
        for (let [D, H] of Object.entries(Y)) {
          if (!W[D]) W[D] = new Set();
          for (let G of H) W[D].add(G);
        }
      }
      return W;
    });
    let Q = GW(() => {
      let W = J.options,
        X = new Map();
      for (let Y of W) {
        let D = Y._zod.propValues?.[J.discriminator];
        if (!D || D.size === 0) throw Error(`Invalid discriminated union option at index "${J.options.indexOf(Y)}"`);
        for (let H of D) {
          if (X.has(H)) throw Error(`Duplicate discriminator value "${String(H)}"`);
          X.set(H, Y);
        }
      }
      return X;
    });
    $._zod.parse = (W, X) => {
      let Y = W.value;
      if (!F9(Y)) return (W.issues.push({ code: "invalid_type", expected: "object", input: Y, inst: $ }), W);
      let D = Q.value.get(Y?.[J.discriminator]);
      if (D) return D._zod.run(W, X);
      if (J.unionFallback || X.direction === "backward") return U(W, X);
      return (
        W.issues.push({
          code: "invalid_union",
          errors: [],
          note: "No matching discriminator",
          discriminator: J.discriminator,
          options: Array.from(Q.value.keys()),
          input: Y,
          path: [J.discriminator],
          inst: $,
        }),
        W
      );
    };
  }),
  mY = v("$ZodIntersection", ($, J) => {
    ($6.init($, J),
      ($._zod.parse = (U, Q) => {
        let W = U.value,
          X = J.left._zod.run({ value: W, issues: [] }, Q),
          Y = J.right._zod.run({ value: W, issues: [] }, Q);
        if (X instanceof Promise || Y instanceof Promise)
          return Promise.all([X, Y]).then(([H, G]) => {
            return hL(U, H, G);
          });
        return hL(U, X, Y);
      }));
  });
function F4($, J) {
  if ($ === J) return { valid: !0, data: $ };
  if ($ instanceof Date && J instanceof Date && +$ === +J) return { valid: !0, data: $ };
  if (E8($) && E8(J)) {
    let U = Object.keys(J),
      Q = Object.keys($).filter((X) => U.indexOf(X) !== -1),
      W = { ...$, ...J };
    for (let X of Q) {
      let Y = F4($[X], J[X]);
      if (!Y.valid) return { valid: !1, mergeErrorPath: [X, ...Y.mergeErrorPath] };
      W[X] = Y.data;
    }
    return { valid: !0, data: W };
  }
  if (Array.isArray($) && Array.isArray(J)) {
    if ($.length !== J.length) return { valid: !1, mergeErrorPath: [] };
    let U = [];
    for (let Q = 0; Q < $.length; Q++) {
      let W = $[Q],
        X = J[Q],
        Y = F4(W, X);
      if (!Y.valid) return { valid: !1, mergeErrorPath: [Q, ...Y.mergeErrorPath] };
      U.push(Y.data);
    }
    return { valid: !0, data: U };
  }
  return { valid: !1, mergeErrorPath: [] };
}
function hL($, J, U) {
  let Q = new Map(),
    W;
  for (let D of J.issues)
    if (D.code === "unrecognized_keys") {
      W ?? (W = D);
      for (let H of D.keys) {
        if (!Q.has(H)) Q.set(H, {});
        Q.get(H).l = !0;
      }
    } else $.issues.push(D);
  for (let D of U.issues)
    if (D.code === "unrecognized_keys")
      for (let H of D.keys) {
        if (!Q.has(H)) Q.set(H, {});
        Q.get(H).r = !0;
      }
    else $.issues.push(D);
  let X = [...Q].filter(([, D]) => D.l && D.r).map(([D]) => D);
  if (X.length && W) $.issues.push({ ...W, keys: X });
  if (L8($)) return $;
  let Y = F4(J.value, U.value);
  if (!Y.valid) throw Error(`Unmergable intersection. Error path: ${JSON.stringify(Y.mergeErrorPath)}`);
  return (($.value = Y.data), $);
}
var M7 = v("$ZodTuple", ($, J) => {
  $6.init($, J);
  let U = J.items;
  $._zod.parse = (Q, W) => {
    let X = Q.value;
    if (!Array.isArray(X)) return (Q.issues.push({ input: X, inst: $, expected: "tuple", code: "invalid_type" }), Q);
    Q.value = [];
    let Y = [],
      D = uL(U, "optin"),
      H = uL(U, "optout");
    if (!J.rest) {
      if (X.length < D)
        return (Q.issues.push({ code: "too_small", minimum: D, inclusive: !0, input: X, inst: $, origin: "array" }), Q);
      if (X.length > U.length)
        Q.issues.push({ code: "too_big", maximum: U.length, inclusive: !0, input: X, inst: $, origin: "array" });
    }
    let G = Array(U.length);
    for (let K = 0; K < U.length; K++) {
      let O = U[K]._zod.run({ value: X[K], issues: [] }, W);
      if (O instanceof Promise)
        Y.push(
          O.then((N) => {
            G[K] = N;
          }),
        );
      else G[K] = O;
    }
    if (J.rest) {
      let K = U.length - 1,
        O = X.slice(U.length);
      for (let N of O) {
        K++;
        let F = J.rest._zod.run({ value: N, issues: [] }, W);
        if (F instanceof Promise) Y.push(F.then((B) => lL(B, Q, K)));
        else lL(F, Q, K);
      }
    }
    if (Y.length) return Promise.all(Y).then(() => mL(G, Q, U, X, H));
    return mL(G, Q, U, X, H);
  };
});
function uL($, J) {
  for (let U = $.length - 1; U >= 0; U--) if ($[U]._zod[J] !== "optional") return U + 1;
  return 0;
}
function lL($, J, U) {
  if ($.issues.length) J.issues.push(...qJ(U, $.issues));
  J.value[U] = $.value;
}
function mL($, J, U, Q, W) {
  for (let X = 0; X < U.length; X++) {
    let Y = $[X],
      D = X < Q.length;
    if (Y.issues.length) {
      if (!D && X >= W) {
        J.value.length = X;
        break;
      }
      J.issues.push(...qJ(X, Y.issues));
    }
    J.value[X] = Y.value;
  }
  for (let X = J.value.length - 1; X >= Q.length; X--)
    if (U[X]._zod.optout === "optional" && J.value[X] === void 0) J.value.length = X;
    else break;
  return J;
}
var pY = v("$ZodRecord", ($, J) => {
    ($6.init($, J),
      ($._zod.parse = (U, Q) => {
        let W = U.value;
        if (!E8(W)) return (U.issues.push({ expected: "record", code: "invalid_type", input: W, inst: $ }), U);
        let X = [],
          Y = J.keyType._zod.values;
        if (Y) {
          U.value = {};
          let D = new Set();
          for (let G of Y)
            if (typeof G === "string" || typeof G === "number" || typeof G === "symbol") {
              D.add(typeof G === "number" ? G.toString() : G);
              let K = J.keyType._zod.run({ value: G, issues: [] }, Q);
              if (K instanceof Promise) throw Error("Async schemas not supported in object keys currently");
              if (K.issues.length) {
                U.issues.push({
                  code: "invalid_key",
                  origin: "record",
                  issues: K.issues.map((F) => JJ(F, Q, E0())),
                  input: G,
                  path: [G],
                  inst: $,
                });
                continue;
              }
              let O = K.value,
                N = J.valueType._zod.run({ value: W[G], issues: [] }, Q);
              if (N instanceof Promise)
                X.push(
                  N.then((F) => {
                    if (F.issues.length) U.issues.push(...qJ(G, F.issues));
                    U.value[O] = F.value;
                  }),
                );
              else {
                if (N.issues.length) U.issues.push(...qJ(G, N.issues));
                U.value[O] = N.value;
              }
            }
          let H;
          for (let G in W) if (!D.has(G)) ((H = H ?? []), H.push(G));
          if (H && H.length > 0) U.issues.push({ code: "unrecognized_keys", input: W, inst: $, keys: H });
        } else {
          U.value = {};
          for (let D of Reflect.ownKeys(W)) {
            if (D === "__proto__") continue;
            if (!Object.prototype.propertyIsEnumerable.call(W, D)) continue;
            let H = J.keyType._zod.run({ value: D, issues: [] }, Q);
            if (H instanceof Promise) throw Error("Async schemas not supported in object keys currently");
            if (typeof D === "string" && w7.test(D) && H.issues.length) {
              let O = J.keyType._zod.run({ value: Number(D), issues: [] }, Q);
              if (O instanceof Promise) throw Error("Async schemas not supported in object keys currently");
              if (O.issues.length === 0) H = O;
            }
            if (H.issues.length) {
              if (J.mode === "loose") U.value[D] = W[D];
              else
                U.issues.push({
                  code: "invalid_key",
                  origin: "record",
                  issues: H.issues.map((O) => JJ(O, Q, E0())),
                  input: D,
                  path: [D],
                  inst: $,
                });
              continue;
            }
            let K = J.valueType._zod.run({ value: W[D], issues: [] }, Q);
            if (K instanceof Promise)
              X.push(
                K.then((O) => {
                  if (O.issues.length) U.issues.push(...qJ(D, O.issues));
                  U.value[H.value] = O.value;
                }),
              );
            else {
              if (K.issues.length) U.issues.push(...qJ(D, K.issues));
              U.value[H.value] = K.value;
            }
          }
        }
        if (X.length) return Promise.all(X).then(() => U);
        return U;
      }));
  }),
  dY = v("$ZodMap", ($, J) => {
    ($6.init($, J),
      ($._zod.parse = (U, Q) => {
        let W = U.value;
        if (!(W instanceof Map))
          return (U.issues.push({ expected: "map", code: "invalid_type", input: W, inst: $ }), U);
        let X = [];
        U.value = new Map();
        for (let [Y, D] of W) {
          let H = J.keyType._zod.run({ value: Y, issues: [] }, Q),
            G = J.valueType._zod.run({ value: D, issues: [] }, Q);
          if (H instanceof Promise || G instanceof Promise)
            X.push(
              Promise.all([H, G]).then(([K, O]) => {
                pL(K, O, U, Y, W, $, Q);
              }),
            );
          else pL(H, G, U, Y, W, $, Q);
        }
        if (X.length) return Promise.all(X).then(() => U);
        return U;
      }));
  });
function pL($, J, U, Q, W, X, Y) {
  if ($.issues.length)
    if (F7.has(typeof Q)) U.issues.push(...qJ(Q, $.issues));
    else
      U.issues.push({
        code: "invalid_key",
        origin: "map",
        input: W,
        inst: X,
        issues: $.issues.map((D) => JJ(D, Y, E0())),
      });
  if (J.issues.length)
    if (F7.has(typeof Q)) U.issues.push(...qJ(Q, J.issues));
    else
      U.issues.push({
        origin: "map",
        code: "invalid_element",
        input: W,
        inst: X,
        key: Q,
        issues: J.issues.map((D) => JJ(D, Y, E0())),
      });
  U.value.set($.value, J.value);
}
var cY = v("$ZodSet", ($, J) => {
  ($6.init($, J),
    ($._zod.parse = (U, Q) => {
      let W = U.value;
      if (!(W instanceof Set)) return (U.issues.push({ input: W, inst: $, expected: "set", code: "invalid_type" }), U);
      let X = [];
      U.value = new Set();
      for (let Y of W) {
        let D = J.valueType._zod.run({ value: Y, issues: [] }, Q);
        if (D instanceof Promise) X.push(D.then((H) => dL(H, U)));
        else dL(D, U);
      }
      if (X.length) return Promise.all(X).then(() => U);
      return U;
    }));
});
function dL($, J) {
  if ($.issues.length) J.issues.push(...$.issues);
  J.value.add($.value);
}
var nY = v("$ZodEnum", ($, J) => {
    $6.init($, J);
    let U = N7(J.entries),
      Q = new Set(U);
    (($._zod.values = Q),
      ($._zod.pattern = new RegExp(
        `^(${U.filter((W) => F7.has(typeof W))
          .map((W) => (typeof W === "string" ? yJ(W) : W.toString()))
          .join("|")})$`,
      )),
      ($._zod.parse = (W, X) => {
        let Y = W.value;
        if (Q.has(Y)) return W;
        return (W.issues.push({ code: "invalid_value", values: U, input: Y, inst: $ }), W);
      }));
  }),
  iY = v("$ZodLiteral", ($, J) => {
    if (($6.init($, J), J.values.length === 0)) throw Error("Cannot create literal schema with no valid values");
    let U = new Set(J.values);
    (($._zod.values = U),
      ($._zod.pattern = new RegExp(
        `^(${J.values.map((Q) => (typeof Q === "string" ? yJ(Q) : Q ? yJ(Q.toString()) : String(Q))).join("|")})$`,
      )),
      ($._zod.parse = (Q, W) => {
        let X = Q.value;
        if (U.has(X)) return Q;
        return (Q.issues.push({ code: "invalid_value", values: J.values, input: X, inst: $ }), Q);
      }));
  }),
  oY = v("$ZodFile", ($, J) => {
    ($6.init($, J),
      ($._zod.parse = (U, Q) => {
        let W = U.value;
        if (W instanceof File) return U;
        return (U.issues.push({ expected: "file", code: "invalid_type", input: W, inst: $ }), U);
      }));
  }),
  rY = v("$ZodTransform", ($, J) => {
    ($6.init($, J),
      ($._zod.optin = "optional"),
      ($._zod.parse = (U, Q) => {
        if (Q.direction === "backward") throw new O9($.constructor.name);
        let W = J.transform(U.value, U);
        if (Q.async)
          return (W instanceof Promise ? W : Promise.resolve(W)).then((Y) => {
            return ((U.value = Y), (U.fallback = !0), U);
          });
        if (W instanceof Promise) throw new kU();
        return ((U.value = W), (U.fallback = !0), U);
      }));
  });
function cL($, J) {
  if (J === void 0 && ($.issues.length || $.fallback)) return { issues: [], value: void 0 };
  return $;
}
var R7 = v("$ZodOptional", ($, J) => {
    ($6.init($, J),
      ($._zod.optin = "optional"),
      ($._zod.optout = "optional"),
      N6($._zod, "values", () => {
        return J.innerType._zod.values ? new Set([...J.innerType._zod.values, void 0]) : void 0;
      }),
      N6($._zod, "pattern", () => {
        let U = J.innerType._zod.pattern;
        return U ? new RegExp(`^(${O7(U.source)})?$`) : void 0;
      }),
      ($._zod.parse = (U, Q) => {
        if (J.innerType._zod.optin === "optional") {
          let W = U.value,
            X = J.innerType._zod.run(U, Q);
          if (X instanceof Promise) return X.then((Y) => cL(Y, W));
          return cL(X, W);
        }
        if (U.value === void 0) return U;
        return J.innerType._zod.run(U, Q);
      }));
  }),
  sY = v("$ZodExactOptional", ($, J) => {
    (R7.init($, J),
      N6($._zod, "values", () => J.innerType._zod.values),
      N6($._zod, "pattern", () => J.innerType._zod.pattern),
      ($._zod.parse = (U, Q) => {
        return J.innerType._zod.run(U, Q);
      }));
  }),
  aY = v("$ZodNullable", ($, J) => {
    ($6.init($, J),
      N6($._zod, "optin", () => J.innerType._zod.optin),
      N6($._zod, "optout", () => J.innerType._zod.optout),
      N6($._zod, "pattern", () => {
        let U = J.innerType._zod.pattern;
        return U ? new RegExp(`^(${O7(U.source)}|null)$`) : void 0;
      }),
      N6($._zod, "values", () => {
        return J.innerType._zod.values ? new Set([...J.innerType._zod.values, null]) : void 0;
      }),
      ($._zod.parse = (U, Q) => {
        if (U.value === null) return U;
        return J.innerType._zod.run(U, Q);
      }));
  }),
  tY = v("$ZodDefault", ($, J) => {
    ($6.init($, J),
      ($._zod.optin = "optional"),
      N6($._zod, "values", () => J.innerType._zod.values),
      ($._zod.parse = (U, Q) => {
        if (Q.direction === "backward") return J.innerType._zod.run(U, Q);
        if (U.value === void 0) return ((U.value = J.defaultValue), U);
        let W = J.innerType._zod.run(U, Q);
        if (W instanceof Promise) return W.then((X) => nL(X, J));
        return nL(W, J);
      }));
  });
function nL($, J) {
  if ($.value === void 0) $.value = J.defaultValue;
  return $;
}
var eY = v("$ZodPrefault", ($, J) => {
    ($6.init($, J),
      ($._zod.optin = "optional"),
      N6($._zod, "values", () => J.innerType._zod.values),
      ($._zod.parse = (U, Q) => {
        if (Q.direction === "backward") return J.innerType._zod.run(U, Q);
        if (U.value === void 0) U.value = J.defaultValue;
        return J.innerType._zod.run(U, Q);
      }));
  }),
  $D = v("$ZodNonOptional", ($, J) => {
    ($6.init($, J),
      N6($._zod, "values", () => {
        let U = J.innerType._zod.values;
        return U ? new Set([...U].filter((Q) => Q !== void 0)) : void 0;
      }),
      ($._zod.parse = (U, Q) => {
        let W = J.innerType._zod.run(U, Q);
        if (W instanceof Promise) return W.then((X) => iL(X, $));
        return iL(W, $);
      }));
  });
function iL($, J) {
  if (!$.issues.length && $.value === void 0)
    $.issues.push({ code: "invalid_type", expected: "nonoptional", input: $.value, inst: J });
  return $;
}
var JD = v("$ZodSuccess", ($, J) => {
    ($6.init($, J),
      ($._zod.parse = (U, Q) => {
        if (Q.direction === "backward") throw new O9("ZodSuccess");
        let W = J.innerType._zod.run(U, Q);
        if (W instanceof Promise)
          return W.then((X) => {
            return ((U.value = X.issues.length === 0), U);
          });
        return ((U.value = W.issues.length === 0), U);
      }));
  }),
  UD = v("$ZodCatch", ($, J) => {
    ($6.init($, J),
      ($._zod.optin = "optional"),
      N6($._zod, "optout", () => J.innerType._zod.optout),
      N6($._zod, "values", () => J.innerType._zod.values),
      ($._zod.parse = (U, Q) => {
        if (Q.direction === "backward") return J.innerType._zod.run(U, Q);
        let W = J.innerType._zod.run(U, Q);
        if (W instanceof Promise)
          return W.then((X) => {
            if (((U.value = X.value), X.issues.length))
              ((U.value = J.catchValue({
                ...U,
                error: { issues: X.issues.map((Y) => JJ(Y, Q, E0())) },
                input: U.value,
              })),
                (U.issues = []),
                (U.fallback = !0));
            return U;
          });
        if (((U.value = W.value), W.issues.length))
          ((U.value = J.catchValue({ ...U, error: { issues: W.issues.map((X) => JJ(X, Q, E0())) }, input: U.value })),
            (U.issues = []),
            (U.fallback = !0));
        return U;
      }));
  }),
  WD = v("$ZodNaN", ($, J) => {
    ($6.init($, J),
      ($._zod.parse = (U, Q) => {
        if (typeof U.value !== "number" || !Number.isNaN(U.value))
          return (U.issues.push({ input: U.value, inst: $, expected: "nan", code: "invalid_type" }), U);
        return U;
      }));
  }),
  Z7 = v("$ZodPipe", ($, J) => {
    ($6.init($, J),
      N6($._zod, "values", () => J.in._zod.values),
      N6($._zod, "optin", () => J.in._zod.optin),
      N6($._zod, "optout", () => J.out._zod.optout),
      N6($._zod, "propValues", () => J.in._zod.propValues),
      ($._zod.parse = (U, Q) => {
        if (Q.direction === "backward") {
          let X = J.out._zod.run(U, Q);
          if (X instanceof Promise) return X.then((Y) => WY(Y, J.in, Q));
          return WY(X, J.in, Q);
        }
        let W = J.in._zod.run(U, Q);
        if (W instanceof Promise) return W.then((X) => WY(X, J.out, Q));
        return WY(W, J.out, Q);
      }));
  });
function WY($, J, U) {
  if ($.issues.length) return (($.aborted = !0), $);
  return J._zod.run({ value: $.value, issues: $.issues, fallback: $.fallback }, U);
}
var LW = v("$ZodCodec", ($, J) => {
  ($6.init($, J),
    N6($._zod, "values", () => J.in._zod.values),
    N6($._zod, "optin", () => J.in._zod.optin),
    N6($._zod, "optout", () => J.out._zod.optout),
    N6($._zod, "propValues", () => J.in._zod.propValues),
    ($._zod.parse = (U, Q) => {
      if ((Q.direction || "forward") === "forward") {
        let X = J.in._zod.run(U, Q);
        if (X instanceof Promise) return X.then((Y) => QY(Y, J, Q));
        return QY(X, J, Q);
      } else {
        let X = J.out._zod.run(U, Q);
        if (X instanceof Promise) return X.then((Y) => QY(Y, J, Q));
        return QY(X, J, Q);
      }
    }));
});
function QY($, J, U) {
  if ($.issues.length) return (($.aborted = !0), $);
  if ((U.direction || "forward") === "forward") {
    let W = J.transform($.value, $);
    if (W instanceof Promise) return W.then((X) => XY($, X, J.out, U));
    return XY($, W, J.out, U);
  } else {
    let W = J.reverseTransform($.value, $);
    if (W instanceof Promise) return W.then((X) => XY($, X, J.in, U));
    return XY($, W, J.in, U);
  }
}
function XY($, J, U, Q) {
  if ($.issues.length) return (($.aborted = !0), $);
  return U._zod.run({ value: J, issues: $.issues }, Q);
}
var I4 = v("$ZodPreprocess", ($, J) => {
    Z7.init($, J);
  }),
  QD = v("$ZodReadonly", ($, J) => {
    ($6.init($, J),
      N6($._zod, "propValues", () => J.innerType._zod.propValues),
      N6($._zod, "values", () => J.innerType._zod.values),
      N6($._zod, "optin", () => J.innerType?._zod?.optin),
      N6($._zod, "optout", () => J.innerType?._zod?.optout),
      ($._zod.parse = (U, Q) => {
        if (Q.direction === "backward") return J.innerType._zod.run(U, Q);
        let W = J.innerType._zod.run(U, Q);
        if (W instanceof Promise) return W.then(oL);
        return oL(W);
      }));
  });
function oL($) {
  return (($.value = Object.freeze($.value)), $);
}
var XD = v("$ZodTemplateLiteral", ($, J) => {
    $6.init($, J);
    let U = [];
    for (let Q of J.parts)
      if (typeof Q === "object" && Q !== null) {
        if (!Q._zod.pattern)
          throw Error(`Invalid template literal part, no pattern found: ${[...Q._zod.traits].shift()}`);
        let W = Q._zod.pattern instanceof RegExp ? Q._zod.pattern.source : Q._zod.pattern;
        if (!W) throw Error(`Invalid template literal part: ${Q._zod.traits}`);
        let X = W.startsWith("^") ? 1 : 0,
          Y = W.endsWith("$") ? W.length - 1 : W.length;
        U.push(W.slice(X, Y));
      } else if (Q === null || OK.has(typeof Q)) U.push(yJ(`${Q}`));
      else throw Error(`Invalid template literal part: ${Q}`);
    (($._zod.pattern = new RegExp(`^${U.join("")}$`)),
      ($._zod.parse = (Q, W) => {
        if (typeof Q.value !== "string")
          return (Q.issues.push({ input: Q.value, inst: $, expected: "string", code: "invalid_type" }), Q);
        if ((($._zod.pattern.lastIndex = 0), !$._zod.pattern.test(Q.value)))
          return (
            Q.issues.push({
              input: Q.value,
              inst: $,
              code: "invalid_format",
              format: J.format ?? "template_literal",
              pattern: $._zod.pattern.source,
            }),
            Q
          );
        return Q;
      }));
  }),
  YD = v("$ZodFunction", ($, J) => {
    return (
      $6.init($, J),
      ($._def = J),
      ($._zod.def = J),
      ($.implement = (U) => {
        if (typeof U !== "function") throw Error("implement() must be called with a function");
        return function (...Q) {
          let W = $._def.input ? q9($._def.input, Q) : Q,
            X = Reflect.apply(U, this, W);
          if ($._def.output) return q9($._def.output, X);
          return X;
        };
      }),
      ($.implementAsync = (U) => {
        if (typeof U !== "function") throw Error("implementAsync() must be called with a function");
        return async function (...Q) {
          let W = $._def.input ? await z9($._def.input, Q) : Q,
            X = await Reflect.apply(U, this, W);
          if ($._def.output) return await z9($._def.output, X);
          return X;
        };
      }),
      ($._zod.parse = (U, Q) => {
        if (typeof U.value !== "function")
          return (U.issues.push({ code: "invalid_type", expected: "function", input: U.value, inst: $ }), U);
        if ($._def.output && $._def.output._zod.def.type === "promise") U.value = $.implementAsync(U.value);
        else U.value = $.implement(U.value);
        return U;
      }),
      ($.input = (...U) => {
        let Q = $.constructor;
        if (Array.isArray(U[0]))
          return new Q({
            type: "function",
            input: new M7({ type: "tuple", items: U[0], rest: U[1] }),
            output: $._def.output,
          });
        return new Q({ type: "function", input: U[0], output: $._def.output });
      }),
      ($.output = (U) => {
        return new $.constructor({ type: "function", input: $._def.input, output: U });
      }),
      $
    );
  }),
  DD = v("$ZodPromise", ($, J) => {
    ($6.init($, J),
      ($._zod.parse = (U, Q) => {
        return Promise.resolve(U.value).then((W) => J.innerType._zod.run({ value: W, issues: [] }, Q));
      }));
  }),
  HD = v("$ZodLazy", ($, J) => {
    ($6.init($, J),
      N6($._zod, "innerType", () => {
        let U = J;
        if (!U._cachedInner) U._cachedInner = J.getter();
        return U._cachedInner;
      }),
      N6($._zod, "pattern", () => $._zod.innerType?._zod?.pattern),
      N6($._zod, "propValues", () => $._zod.innerType?._zod?.propValues),
      N6($._zod, "optin", () => $._zod.innerType?._zod?.optin ?? void 0),
      N6($._zod, "optout", () => $._zod.innerType?._zod?.optout ?? void 0),
      ($._zod.parse = (U, Q) => {
        return $._zod.innerType._zod.run(U, Q);
      }));
  }),
  GD = v("$ZodCustom", ($, J) => {
    (n6.init($, J),
      $6.init($, J),
      ($._zod.parse = (U, Q) => {
        return U;
      }),
      ($._zod.check = (U) => {
        let Q = U.value,
          W = J.fn(Q);
        if (W instanceof Promise) return W.then((X) => rL(X, U, Q, $));
        rL(W, U, Q, $);
        return;
      }));
  });
function rL($, J, U, Q) {
  if (!$) {
    let W = { code: "custom", input: U, inst: Q, path: [...(Q._zod.def.path ?? [])], continue: !Q._zod.def.abort };
    if (Q._zod.def.params) W.params = Q._zod.def.params;
    J.issues.push(KW(W));
  }
}
var IW = {};
uU(IW, {
  zhTW: () => qN,
  zhCN: () => FN,
  yo: () => zN,
  vi: () => ON,
  uz: () => NN,
  ur: () => KN,
  uk: () => C7,
  ua: () => GN,
  tr: () => HN,
  th: () => DN,
  ta: () => YN,
  sv: () => XN,
  sl: () => QN,
  ru: () => WN,
  ro: () => UN,
  pt: () => JN,
  ps: () => e4,
  pl: () => $N,
  ota: () => t4,
  no: () => a4,
  nl: () => s4,
  ms: () => r4,
  mk: () => o4,
  lt: () => i4,
  ko: () => n4,
  km: () => _7,
  kh: () => c4,
  ka: () => d4,
  ja: () => p4,
  it: () => m4,
  is: () => l4,
  id: () => u4,
  hy: () => h4,
  hu: () => g4,
  hr: () => x4,
  he: () => y4,
  frCA: () => f4,
  fr: () => b4,
  fi: () => v4,
  fa: () => j4,
  es: () => T4,
  eo: () => C4,
  en: () => P7,
  el: () => S4,
  de: () => _4,
  da: () => P4,
  cs: () => Z4,
  ca: () => R4,
  bg: () => M4,
  be: () => A4,
  az: () => k4,
  ar: () => V4,
});
var KC = () => {
  let $ = {
    string: { unit: "\u062D\u0631\u0641", verb: "\u0623\u0646 \u064A\u062D\u0648\u064A" },
    file: { unit: "\u0628\u0627\u064A\u062A", verb: "\u0623\u0646 \u064A\u062D\u0648\u064A" },
    array: { unit: "\u0639\u0646\u0635\u0631", verb: "\u0623\u0646 \u064A\u062D\u0648\u064A" },
    set: { unit: "\u0639\u0646\u0635\u0631", verb: "\u0623\u0646 \u064A\u062D\u0648\u064A" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "\u0645\u062F\u062E\u0644",
      email: "\u0628\u0631\u064A\u062F \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A",
      url: "\u0631\u0627\u0628\u0637",
      emoji: "\u0625\u064A\u0645\u0648\u062C\u064A",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "\u062A\u0627\u0631\u064A\u062E \u0648\u0648\u0642\u062A \u0628\u0645\u0639\u064A\u0627\u0631 ISO",
      date: "\u062A\u0627\u0631\u064A\u062E \u0628\u0645\u0639\u064A\u0627\u0631 ISO",
      time: "\u0648\u0642\u062A \u0628\u0645\u0639\u064A\u0627\u0631 ISO",
      duration: "\u0645\u062F\u0629 \u0628\u0645\u0639\u064A\u0627\u0631 ISO",
      ipv4: "\u0639\u0646\u0648\u0627\u0646 IPv4",
      ipv6: "\u0639\u0646\u0648\u0627\u0646 IPv6",
      cidrv4: "\u0645\u062F\u0649 \u0639\u0646\u0627\u0648\u064A\u0646 \u0628\u0635\u064A\u063A\u0629 IPv4",
      cidrv6: "\u0645\u062F\u0649 \u0639\u0646\u0627\u0648\u064A\u0646 \u0628\u0635\u064A\u063A\u0629 IPv6",
      base64: "\u0646\u064E\u0635 \u0628\u062A\u0631\u0645\u064A\u0632 base64-encoded",
      base64url: "\u0646\u064E\u0635 \u0628\u062A\u0631\u0645\u064A\u0632 base64url-encoded",
      json_string: "\u0646\u064E\u0635 \u0639\u0644\u0649 \u0647\u064A\u0626\u0629 JSON",
      e164: "\u0631\u0642\u0645 \u0647\u0627\u062A\u0641 \u0628\u0645\u0639\u064A\u0627\u0631 E.164",
      jwt: "JWT",
      template_literal: "\u0645\u062F\u062E\u0644",
    },
    Q = { nan: "NaN" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `\u0645\u062F\u062E\u0644\u0627\u062A \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644\u0629: \u064A\u0641\u062A\u0631\u0636 \u0625\u062F\u062E\u0627\u0644 instanceof ${W.expected}\u060C \u0648\u0644\u0643\u0646 \u062A\u0645 \u0625\u062F\u062E\u0627\u0644 ${D}`;
        return `\u0645\u062F\u062E\u0644\u0627\u062A \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644\u0629: \u064A\u0641\u062A\u0631\u0636 \u0625\u062F\u062E\u0627\u0644 ${X}\u060C \u0648\u0644\u0643\u0646 \u062A\u0645 \u0625\u062F\u062E\u0627\u0644 ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1)
          return `\u0645\u062F\u062E\u0644\u0627\u062A \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644\u0629: \u064A\u0641\u062A\u0631\u0636 \u0625\u062F\u062E\u0627\u0644 ${$$(W.values[0])}`;
        return `\u0627\u062E\u062A\u064A\u0627\u0631 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062A\u0648\u0642\u0639 \u0627\u0646\u062A\u0642\u0627\u0621 \u0623\u062D\u062F \u0647\u0630\u0647 \u0627\u0644\u062E\u064A\u0627\u0631\u0627\u062A: ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return ` \u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u0644\u0627\u0632\u0645: \u064A\u0641\u062A\u0631\u0636 \u0623\u0646 \u062A\u0643\u0648\u0646 ${W.origin ?? "\u0627\u0644\u0642\u064A\u0645\u0629"} ${X} ${W.maximum.toString()} ${Y.unit ?? "\u0639\u0646\u0635\u0631"}`;
        return `\u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u0644\u0627\u0632\u0645: \u064A\u0641\u062A\u0631\u0636 \u0623\u0646 \u062A\u0643\u0648\u0646 ${W.origin ?? "\u0627\u0644\u0642\u064A\u0645\u0629"} ${X} ${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y)
          return `\u0623\u0635\u063A\u0631 \u0645\u0646 \u0627\u0644\u0644\u0627\u0632\u0645: \u064A\u0641\u062A\u0631\u0636 \u0644\u0640 ${W.origin} \u0623\u0646 \u064A\u0643\u0648\u0646 ${X} ${W.minimum.toString()} ${Y.unit}`;
        return `\u0623\u0635\u063A\u0631 \u0645\u0646 \u0627\u0644\u0644\u0627\u0632\u0645: \u064A\u0641\u062A\u0631\u0636 \u0644\u0640 ${W.origin} \u0623\u0646 \u064A\u0643\u0648\u0646 ${X} ${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `\u0646\u064E\u0635 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062C\u0628 \u0623\u0646 \u064A\u0628\u062F\u0623 \u0628\u0640 "${W.prefix}"`;
        if (X.format === "ends_with")
          return `\u0646\u064E\u0635 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062C\u0628 \u0623\u0646 \u064A\u0646\u062A\u0647\u064A \u0628\u0640 "${X.suffix}"`;
        if (X.format === "includes")
          return `\u0646\u064E\u0635 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062C\u0628 \u0623\u0646 \u064A\u062A\u0636\u0645\u0651\u064E\u0646 "${X.includes}"`;
        if (X.format === "regex")
          return `\u0646\u064E\u0635 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062C\u0628 \u0623\u0646 \u064A\u0637\u0627\u0628\u0642 \u0627\u0644\u0646\u0645\u0637 ${X.pattern}`;
        return `${U[X.format] ?? W.format} \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644`;
      }
      case "not_multiple_of":
        return `\u0631\u0642\u0645 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644: \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0645\u0646 \u0645\u0636\u0627\u0639\u0641\u0627\u062A ${W.divisor}`;
      case "unrecognized_keys":
        return `\u0645\u0639\u0631\u0641${W.keys.length > 1 ? "\u0627\u062A" : ""} \u063A\u0631\u064A\u0628${W.keys.length > 1 ? "\u0629" : ""}: ${p(W.keys, "\u060C ")}`;
      case "invalid_key":
        return `\u0645\u0639\u0631\u0641 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644 \u0641\u064A ${W.origin}`;
      case "invalid_union":
        return "\u0645\u062F\u062E\u0644 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644";
      case "invalid_element":
        return `\u0645\u062F\u062E\u0644 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644 \u0641\u064A ${W.origin}`;
      default:
        return "\u0645\u062F\u062E\u0644 \u063A\u064A\u0631 \u0645\u0642\u0628\u0648\u0644";
    }
  };
};
function V4() {
  return { localeError: KC() };
}
var NC = () => {
  let $ = {
    string: { unit: "simvol", verb: "olmal\u0131d\u0131r" },
    file: { unit: "bayt", verb: "olmal\u0131d\u0131r" },
    array: { unit: "element", verb: "olmal\u0131d\u0131r" },
    set: { unit: "element", verb: "olmal\u0131d\u0131r" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "input",
      email: "email address",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO datetime",
      date: "ISO date",
      time: "ISO time",
      duration: "ISO duration",
      ipv4: "IPv4 address",
      ipv6: "IPv6 address",
      cidrv4: "IPv4 range",
      cidrv6: "IPv6 range",
      base64: "base64-encoded string",
      base64url: "base64url-encoded string",
      json_string: "JSON string",
      e164: "E.164 number",
      jwt: "JWT",
      template_literal: "input",
    },
    Q = { nan: "NaN" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `Yanl\u0131\u015F d\u0259y\u0259r: g\xF6zl\u0259nil\u0259n instanceof ${W.expected}, daxil olan ${D}`;
        return `Yanl\u0131\u015F d\u0259y\u0259r: g\xF6zl\u0259nil\u0259n ${X}, daxil olan ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1)
          return `Yanl\u0131\u015F d\u0259y\u0259r: g\xF6zl\u0259nil\u0259n ${$$(W.values[0])}`;
        return `Yanl\u0131\u015F se\xE7im: a\u015Fa\u011F\u0131dak\u0131lardan biri olmal\u0131d\u0131r: ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `\xC7ox b\xF6y\xFCk: g\xF6zl\u0259nil\u0259n ${W.origin ?? "d\u0259y\u0259r"} ${X}${W.maximum.toString()} ${Y.unit ?? "element"}`;
        return `\xC7ox b\xF6y\xFCk: g\xF6zl\u0259nil\u0259n ${W.origin ?? "d\u0259y\u0259r"} ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y) return `\xC7ox ki\xE7ik: g\xF6zl\u0259nil\u0259n ${W.origin} ${X}${W.minimum.toString()} ${Y.unit}`;
        return `\xC7ox ki\xE7ik: g\xF6zl\u0259nil\u0259n ${W.origin} ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `Yanl\u0131\u015F m\u0259tn: "${X.prefix}" il\u0259 ba\u015Flamal\u0131d\u0131r`;
        if (X.format === "ends_with") return `Yanl\u0131\u015F m\u0259tn: "${X.suffix}" il\u0259 bitm\u0259lidir`;
        if (X.format === "includes") return `Yanl\u0131\u015F m\u0259tn: "${X.includes}" daxil olmal\u0131d\u0131r`;
        if (X.format === "regex")
          return `Yanl\u0131\u015F m\u0259tn: ${X.pattern} \u015Fablonuna uy\u011Fun olmal\u0131d\u0131r`;
        return `Yanl\u0131\u015F ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `Yanl\u0131\u015F \u0259d\u0259d: ${W.divisor} il\u0259 b\xF6l\xFCn\u0259 bil\u0259n olmal\u0131d\u0131r`;
      case "unrecognized_keys":
        return `Tan\u0131nmayan a\xE7ar${W.keys.length > 1 ? "lar" : ""}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `${W.origin} daxilind\u0259 yanl\u0131\u015F a\xE7ar`;
      case "invalid_union":
        return "Yanl\u0131\u015F d\u0259y\u0259r";
      case "invalid_element":
        return `${W.origin} daxilind\u0259 yanl\u0131\u015F d\u0259y\u0259r`;
      default:
        return "Yanl\u0131\u015F d\u0259y\u0259r";
    }
  };
};
function k4() {
  return { localeError: NC() };
}
function $w($, J, U, Q) {
  let W = Math.abs($),
    X = W % 10,
    Y = W % 100;
  if (Y >= 11 && Y <= 19) return Q;
  if (X === 1) return J;
  if (X >= 2 && X <= 4) return U;
  return Q;
}
var OC = () => {
  let $ = {
    string: {
      unit: {
        one: "\u0441\u0456\u043C\u0432\u0430\u043B",
        few: "\u0441\u0456\u043C\u0432\u0430\u043B\u044B",
        many: "\u0441\u0456\u043C\u0432\u0430\u043B\u0430\u045E",
      },
      verb: "\u043C\u0435\u0446\u044C",
    },
    array: {
      unit: {
        one: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442",
        few: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u044B",
        many: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430\u045E",
      },
      verb: "\u043C\u0435\u0446\u044C",
    },
    set: {
      unit: {
        one: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442",
        few: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u044B",
        many: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430\u045E",
      },
      verb: "\u043C\u0435\u0446\u044C",
    },
    file: {
      unit: {
        one: "\u0431\u0430\u0439\u0442",
        few: "\u0431\u0430\u0439\u0442\u044B",
        many: "\u0431\u0430\u0439\u0442\u0430\u045E",
      },
      verb: "\u043C\u0435\u0446\u044C",
    },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "\u0443\u0432\u043E\u0434",
      email: "email \u0430\u0434\u0440\u0430\u0441",
      url: "URL",
      emoji: "\u044D\u043C\u043E\u0434\u0437\u0456",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO \u0434\u0430\u0442\u0430 \u0456 \u0447\u0430\u0441",
      date: "ISO \u0434\u0430\u0442\u0430",
      time: "ISO \u0447\u0430\u0441",
      duration: "ISO \u043F\u0440\u0430\u0446\u044F\u0433\u043B\u0430\u0441\u0446\u044C",
      ipv4: "IPv4 \u0430\u0434\u0440\u0430\u0441",
      ipv6: "IPv6 \u0430\u0434\u0440\u0430\u0441",
      cidrv4: "IPv4 \u0434\u044B\u044F\u043F\u0430\u0437\u043E\u043D",
      cidrv6: "IPv6 \u0434\u044B\u044F\u043F\u0430\u0437\u043E\u043D",
      base64: "\u0440\u0430\u0434\u043E\u043A \u0443 \u0444\u0430\u0440\u043C\u0430\u0446\u0435 base64",
      base64url: "\u0440\u0430\u0434\u043E\u043A \u0443 \u0444\u0430\u0440\u043C\u0430\u0446\u0435 base64url",
      json_string: "JSON \u0440\u0430\u0434\u043E\u043A",
      e164: "\u043D\u0443\u043C\u0430\u0440 E.164",
      jwt: "JWT",
      template_literal: "\u0443\u0432\u043E\u0434",
    },
    Q = { nan: "NaN", number: "\u043B\u0456\u043A", array: "\u043C\u0430\u0441\u0456\u045E" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u045E\u0432\u043E\u0434: \u0447\u0430\u043A\u0430\u045E\u0441\u044F instanceof ${W.expected}, \u0430\u0442\u0440\u044B\u043C\u0430\u043D\u0430 ${D}`;
        return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u045E\u0432\u043E\u0434: \u0447\u0430\u043A\u0430\u045E\u0441\u044F ${X}, \u0430\u0442\u0440\u044B\u043C\u0430\u043D\u0430 ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1)
          return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u045E\u0432\u043E\u0434: \u0447\u0430\u043A\u0430\u043B\u0430\u0441\u044F ${$$(W.values[0])}`;
        return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u0432\u0430\u0440\u044B\u044F\u043D\u0442: \u0447\u0430\u043A\u0430\u045E\u0441\u044F \u0430\u0434\u0437\u0456\u043D \u0437 ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y) {
          let D = Number(W.maximum),
            H = $w(D, Y.unit.one, Y.unit.few, Y.unit.many);
          return `\u0417\u0430\u043D\u0430\u0434\u0442\u0430 \u0432\u044F\u043B\u0456\u043A\u0456: \u0447\u0430\u043A\u0430\u043B\u0430\u0441\u044F, \u0448\u0442\u043E ${W.origin ?? "\u0437\u043D\u0430\u0447\u044D\u043D\u043D\u0435"} \u043F\u0430\u0432\u0456\u043D\u043D\u0430 ${Y.verb} ${X}${W.maximum.toString()} ${H}`;
        }
        return `\u0417\u0430\u043D\u0430\u0434\u0442\u0430 \u0432\u044F\u043B\u0456\u043A\u0456: \u0447\u0430\u043A\u0430\u043B\u0430\u0441\u044F, \u0448\u0442\u043E ${W.origin ?? "\u0437\u043D\u0430\u0447\u044D\u043D\u043D\u0435"} \u043F\u0430\u0432\u0456\u043D\u043D\u0430 \u0431\u044B\u0446\u044C ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y) {
          let D = Number(W.minimum),
            H = $w(D, Y.unit.one, Y.unit.few, Y.unit.many);
          return `\u0417\u0430\u043D\u0430\u0434\u0442\u0430 \u043C\u0430\u043B\u044B: \u0447\u0430\u043A\u0430\u043B\u0430\u0441\u044F, \u0448\u0442\u043E ${W.origin} \u043F\u0430\u0432\u0456\u043D\u043D\u0430 ${Y.verb} ${X}${W.minimum.toString()} ${H}`;
        }
        return `\u0417\u0430\u043D\u0430\u0434\u0442\u0430 \u043C\u0430\u043B\u044B: \u0447\u0430\u043A\u0430\u043B\u0430\u0441\u044F, \u0448\u0442\u043E ${W.origin} \u043F\u0430\u0432\u0456\u043D\u043D\u0430 \u0431\u044B\u0446\u044C ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u0440\u0430\u0434\u043E\u043A: \u043F\u0430\u0432\u0456\u043D\u0435\u043D \u043F\u0430\u0447\u044B\u043D\u0430\u0446\u0446\u0430 \u0437 "${X.prefix}"`;
        if (X.format === "ends_with")
          return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u0440\u0430\u0434\u043E\u043A: \u043F\u0430\u0432\u0456\u043D\u0435\u043D \u0437\u0430\u043A\u0430\u043D\u0447\u0432\u0430\u0446\u0446\u0430 \u043D\u0430 "${X.suffix}"`;
        if (X.format === "includes")
          return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u0440\u0430\u0434\u043E\u043A: \u043F\u0430\u0432\u0456\u043D\u0435\u043D \u0437\u043C\u044F\u0448\u0447\u0430\u0446\u044C "${X.includes}"`;
        if (X.format === "regex")
          return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u0440\u0430\u0434\u043E\u043A: \u043F\u0430\u0432\u0456\u043D\u0435\u043D \u0430\u0434\u043F\u0430\u0432\u044F\u0434\u0430\u0446\u044C \u0448\u0430\u0431\u043B\u043E\u043D\u0443 ${X.pattern}`;
        return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u043B\u0456\u043A: \u043F\u0430\u0432\u0456\u043D\u0435\u043D \u0431\u044B\u0446\u044C \u043A\u0440\u0430\u0442\u043D\u044B\u043C ${W.divisor}`;
      case "unrecognized_keys":
        return `\u041D\u0435\u0440\u0430\u0441\u043F\u0430\u0437\u043D\u0430\u043D\u044B ${W.keys.length > 1 ? "\u043A\u043B\u044E\u0447\u044B" : "\u043A\u043B\u044E\u0447"}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u043A\u043B\u044E\u0447 \u0443 ${W.origin}`;
      case "invalid_union":
        return "\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u045E\u0432\u043E\u0434";
      case "invalid_element":
        return `\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u0430\u0435 \u0437\u043D\u0430\u0447\u044D\u043D\u043D\u0435 \u045E ${W.origin}`;
      default:
        return "\u041D\u044F\u043F\u0440\u0430\u0432\u0456\u043B\u044C\u043D\u044B \u045E\u0432\u043E\u0434";
    }
  };
};
function A4() {
  return { localeError: OC() };
}
var FC = () => {
  let $ = {
    string: {
      unit: "\u0441\u0438\u043C\u0432\u043E\u043B\u0430",
      verb: "\u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430",
    },
    file: { unit: "\u0431\u0430\u0439\u0442\u0430", verb: "\u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430" },
    array: {
      unit: "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0430",
      verb: "\u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430",
    },
    set: {
      unit: "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0430",
      verb: "\u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430",
    },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "\u0432\u0445\u043E\u0434",
      email: "\u0438\u043C\u0435\u0439\u043B \u0430\u0434\u0440\u0435\u0441",
      url: "URL",
      emoji: "\u0435\u043C\u043E\u0434\u0436\u0438",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO \u0432\u0440\u0435\u043C\u0435",
      date: "ISO \u0434\u0430\u0442\u0430",
      time: "ISO \u0432\u0440\u0435\u043C\u0435",
      duration: "ISO \u043F\u0440\u043E\u0434\u044A\u043B\u0436\u0438\u0442\u0435\u043B\u043D\u043E\u0441\u0442",
      ipv4: "IPv4 \u0430\u0434\u0440\u0435\u0441",
      ipv6: "IPv6 \u0430\u0434\u0440\u0435\u0441",
      cidrv4: "IPv4 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D",
      cidrv6: "IPv6 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D",
      base64: "base64-\u043A\u043E\u0434\u0438\u0440\u0430\u043D \u043D\u0438\u0437",
      base64url: "base64url-\u043A\u043E\u0434\u0438\u0440\u0430\u043D \u043D\u0438\u0437",
      json_string: "JSON \u043D\u0438\u0437",
      e164: "E.164 \u043D\u043E\u043C\u0435\u0440",
      jwt: "JWT",
      template_literal: "\u0432\u0445\u043E\u0434",
    },
    Q = { nan: "NaN", number: "\u0447\u0438\u0441\u043B\u043E", array: "\u043C\u0430\u0441\u0438\u0432" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0432\u0445\u043E\u0434: \u043E\u0447\u0430\u043A\u0432\u0430\u043D instanceof ${W.expected}, \u043F\u043E\u043B\u0443\u0447\u0435\u043D ${D}`;
        return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0432\u0445\u043E\u0434: \u043E\u0447\u0430\u043A\u0432\u0430\u043D ${X}, \u043F\u043E\u043B\u0443\u0447\u0435\u043D ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1)
          return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0432\u0445\u043E\u0434: \u043E\u0447\u0430\u043A\u0432\u0430\u043D ${$$(W.values[0])}`;
        return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u0430 \u043E\u043F\u0446\u0438\u044F: \u043E\u0447\u0430\u043A\u0432\u0430\u043D\u043E \u0435\u0434\u043D\u043E \u043E\u0442 ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `\u0422\u0432\u044A\u0440\u0434\u0435 \u0433\u043E\u043B\u044F\u043C\u043E: \u043E\u0447\u0430\u043A\u0432\u0430 \u0441\u0435 ${W.origin ?? "\u0441\u0442\u043E\u0439\u043D\u043E\u0441\u0442"} \u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430 ${X}${W.maximum.toString()} ${Y.unit ?? "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0430"}`;
        return `\u0422\u0432\u044A\u0440\u0434\u0435 \u0433\u043E\u043B\u044F\u043C\u043E: \u043E\u0447\u0430\u043A\u0432\u0430 \u0441\u0435 ${W.origin ?? "\u0441\u0442\u043E\u0439\u043D\u043E\u0441\u0442"} \u0434\u0430 \u0431\u044A\u0434\u0435 ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y)
          return `\u0422\u0432\u044A\u0440\u0434\u0435 \u043C\u0430\u043B\u043A\u043E: \u043E\u0447\u0430\u043A\u0432\u0430 \u0441\u0435 ${W.origin} \u0434\u0430 \u0441\u044A\u0434\u044A\u0440\u0436\u0430 ${X}${W.minimum.toString()} ${Y.unit}`;
        return `\u0422\u0432\u044A\u0440\u0434\u0435 \u043C\u0430\u043B\u043A\u043E: \u043E\u0447\u0430\u043A\u0432\u0430 \u0441\u0435 ${W.origin} \u0434\u0430 \u0431\u044A\u0434\u0435 ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043D\u0438\u0437: \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0437\u0430\u043F\u043E\u0447\u0432\u0430 \u0441 "${X.prefix}"`;
        if (X.format === "ends_with")
          return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043D\u0438\u0437: \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0437\u0430\u0432\u044A\u0440\u0448\u0432\u0430 \u0441 "${X.suffix}"`;
        if (X.format === "includes")
          return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043D\u0438\u0437: \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0432\u043A\u043B\u044E\u0447\u0432\u0430 "${X.includes}"`;
        if (X.format === "regex")
          return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043D\u0438\u0437: \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0441\u044A\u0432\u043F\u0430\u0434\u0430 \u0441 ${X.pattern}`;
        let Y = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D";
        if (X.format === "emoji") Y = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u043E";
        if (X.format === "datetime") Y = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u043E";
        if (X.format === "date") Y = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u0430";
        if (X.format === "time") Y = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u043E";
        if (X.format === "duration") Y = "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u0430";
        return `${Y} ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u043E \u0447\u0438\u0441\u043B\u043E: \u0442\u0440\u044F\u0431\u0432\u0430 \u0434\u0430 \u0431\u044A\u0434\u0435 \u043A\u0440\u0430\u0442\u043D\u043E \u043D\u0430 ${W.divisor}`;
      case "unrecognized_keys":
        return `\u041D\u0435\u0440\u0430\u0437\u043F\u043E\u0437\u043D\u0430\u0442${W.keys.length > 1 ? "\u0438" : ""} \u043A\u043B\u044E\u0447${W.keys.length > 1 ? "\u043E\u0432\u0435" : ""}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u043A\u043B\u044E\u0447 \u0432 ${W.origin}`;
      case "invalid_union":
        return "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0432\u0445\u043E\u0434";
      case "invalid_element":
        return `\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u043D\u0430 \u0441\u0442\u043E\u0439\u043D\u043E\u0441\u0442 \u0432 ${W.origin}`;
      default:
        return "\u041D\u0435\u0432\u0430\u043B\u0438\u0434\u0435\u043D \u0432\u0445\u043E\u0434";
    }
  };
};
function M4() {
  return { localeError: FC() };
}
var qC = () => {
  let $ = {
    string: { unit: "car\xE0cters", verb: "contenir" },
    file: { unit: "bytes", verb: "contenir" },
    array: { unit: "elements", verb: "contenir" },
    set: { unit: "elements", verb: "contenir" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "entrada",
      email: "adre\xE7a electr\xF2nica",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "data i hora ISO",
      date: "data ISO",
      time: "hora ISO",
      duration: "durada ISO",
      ipv4: "adre\xE7a IPv4",
      ipv6: "adre\xE7a IPv6",
      cidrv4: "rang IPv4",
      cidrv6: "rang IPv6",
      base64: "cadena codificada en base64",
      base64url: "cadena codificada en base64url",
      json_string: "cadena JSON",
      e164: "n\xFAmero E.164",
      jwt: "JWT",
      template_literal: "entrada",
    },
    Q = { nan: "NaN" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected)) return `Tipus inv\xE0lid: s'esperava instanceof ${W.expected}, s'ha rebut ${D}`;
        return `Tipus inv\xE0lid: s'esperava ${X}, s'ha rebut ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Valor inv\xE0lid: s'esperava ${$$(W.values[0])}`;
        return `Opci\xF3 inv\xE0lida: s'esperava una de ${p(W.values, " o ")}`;
      case "too_big": {
        let X = W.inclusive ? "com a m\xE0xim" : "menys de",
          Y = J(W.origin);
        if (Y)
          return `Massa gran: s'esperava que ${W.origin ?? "el valor"} contingu\xE9s ${X} ${W.maximum.toString()} ${Y.unit ?? "elements"}`;
        return `Massa gran: s'esperava que ${W.origin ?? "el valor"} fos ${X} ${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? "com a m\xEDnim" : "m\xE9s de",
          Y = J(W.origin);
        if (Y) return `Massa petit: s'esperava que ${W.origin} contingu\xE9s ${X} ${W.minimum.toString()} ${Y.unit}`;
        return `Massa petit: s'esperava que ${W.origin} fos ${X} ${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `Format inv\xE0lid: ha de comen\xE7ar amb "${X.prefix}"`;
        if (X.format === "ends_with") return `Format inv\xE0lid: ha d'acabar amb "${X.suffix}"`;
        if (X.format === "includes") return `Format inv\xE0lid: ha d'incloure "${X.includes}"`;
        if (X.format === "regex") return `Format inv\xE0lid: ha de coincidir amb el patr\xF3 ${X.pattern}`;
        return `Format inv\xE0lid per a ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `N\xFAmero inv\xE0lid: ha de ser m\xFAltiple de ${W.divisor}`;
      case "unrecognized_keys":
        return `Clau${W.keys.length > 1 ? "s" : ""} no reconeguda${W.keys.length > 1 ? "s" : ""}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `Clau inv\xE0lida a ${W.origin}`;
      case "invalid_union":
        return "Entrada inv\xE0lida";
      case "invalid_element":
        return `Element inv\xE0lid a ${W.origin}`;
      default:
        return "Entrada inv\xE0lida";
    }
  };
};
function R4() {
  return { localeError: qC() };
}
var zC = () => {
  let $ = {
    string: { unit: "znak\u016F", verb: "m\xEDt" },
    file: { unit: "bajt\u016F", verb: "m\xEDt" },
    array: { unit: "prvk\u016F", verb: "m\xEDt" },
    set: { unit: "prvk\u016F", verb: "m\xEDt" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "regul\xE1rn\xED v\xFDraz",
      email: "e-mailov\xE1 adresa",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "datum a \u010Das ve form\xE1tu ISO",
      date: "datum ve form\xE1tu ISO",
      time: "\u010Das ve form\xE1tu ISO",
      duration: "doba trv\xE1n\xED ISO",
      ipv4: "IPv4 adresa",
      ipv6: "IPv6 adresa",
      cidrv4: "rozsah IPv4",
      cidrv6: "rozsah IPv6",
      base64: "\u0159et\u011Bzec zak\xF3dovan\xFD ve form\xE1tu base64",
      base64url: "\u0159et\u011Bzec zak\xF3dovan\xFD ve form\xE1tu base64url",
      json_string: "\u0159et\u011Bzec ve form\xE1tu JSON",
      e164: "\u010D\xEDslo E.164",
      jwt: "JWT",
      template_literal: "vstup",
    },
    Q = { nan: "NaN", number: "\u010D\xEDslo", string: "\u0159et\u011Bzec", function: "funkce", array: "pole" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `Neplatn\xFD vstup: o\u010Dek\xE1v\xE1no instanceof ${W.expected}, obdr\u017Eeno ${D}`;
        return `Neplatn\xFD vstup: o\u010Dek\xE1v\xE1no ${X}, obdr\u017Eeno ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Neplatn\xFD vstup: o\u010Dek\xE1v\xE1no ${$$(W.values[0])}`;
        return `Neplatn\xE1 mo\u017Enost: o\u010Dek\xE1v\xE1na jedna z hodnot ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `Hodnota je p\u0159\xEDli\u0161 velk\xE1: ${W.origin ?? "hodnota"} mus\xED m\xEDt ${X}${W.maximum.toString()} ${Y.unit ?? "prvk\u016F"}`;
        return `Hodnota je p\u0159\xEDli\u0161 velk\xE1: ${W.origin ?? "hodnota"} mus\xED b\xFDt ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y)
          return `Hodnota je p\u0159\xEDli\u0161 mal\xE1: ${W.origin ?? "hodnota"} mus\xED m\xEDt ${X}${W.minimum.toString()} ${Y.unit ?? "prvk\u016F"}`;
        return `Hodnota je p\u0159\xEDli\u0161 mal\xE1: ${W.origin ?? "hodnota"} mus\xED b\xFDt ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `Neplatn\xFD \u0159et\u011Bzec: mus\xED za\u010D\xEDnat na "${X.prefix}"`;
        if (X.format === "ends_with") return `Neplatn\xFD \u0159et\u011Bzec: mus\xED kon\u010Dit na "${X.suffix}"`;
        if (X.format === "includes") return `Neplatn\xFD \u0159et\u011Bzec: mus\xED obsahovat "${X.includes}"`;
        if (X.format === "regex") return `Neplatn\xFD \u0159et\u011Bzec: mus\xED odpov\xEDdat vzoru ${X.pattern}`;
        return `Neplatn\xFD form\xE1t ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `Neplatn\xE9 \u010D\xEDslo: mus\xED b\xFDt n\xE1sobkem ${W.divisor}`;
      case "unrecognized_keys":
        return `Nezn\xE1m\xE9 kl\xED\u010De: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `Neplatn\xFD kl\xED\u010D v ${W.origin}`;
      case "invalid_union":
        return "Neplatn\xFD vstup";
      case "invalid_element":
        return `Neplatn\xE1 hodnota v ${W.origin}`;
      default:
        return "Neplatn\xFD vstup";
    }
  };
};
function Z4() {
  return { localeError: zC() };
}
var BC = () => {
  let $ = {
    string: { unit: "tegn", verb: "havde" },
    file: { unit: "bytes", verb: "havde" },
    array: { unit: "elementer", verb: "indeholdt" },
    set: { unit: "elementer", verb: "indeholdt" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "input",
      email: "e-mailadresse",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO dato- og klokkesl\xE6t",
      date: "ISO-dato",
      time: "ISO-klokkesl\xE6t",
      duration: "ISO-varighed",
      ipv4: "IPv4-omr\xE5de",
      ipv6: "IPv6-omr\xE5de",
      cidrv4: "IPv4-spektrum",
      cidrv6: "IPv6-spektrum",
      base64: "base64-kodet streng",
      base64url: "base64url-kodet streng",
      json_string: "JSON-streng",
      e164: "E.164-nummer",
      jwt: "JWT",
      template_literal: "input",
    },
    Q = {
      nan: "NaN",
      string: "streng",
      number: "tal",
      boolean: "boolean",
      array: "liste",
      object: "objekt",
      set: "s\xE6t",
      file: "fil",
    };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected)) return `Ugyldigt input: forventede instanceof ${W.expected}, fik ${D}`;
        return `Ugyldigt input: forventede ${X}, fik ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Ugyldig v\xE6rdi: forventede ${$$(W.values[0])}`;
        return `Ugyldigt valg: forventede en af f\xF8lgende ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin),
          D = Q[W.origin] ?? W.origin;
        if (Y)
          return `For stor: forventede ${D ?? "value"} ${Y.verb} ${X} ${W.maximum.toString()} ${Y.unit ?? "elementer"}`;
        return `For stor: forventede ${D ?? "value"} havde ${X} ${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin),
          D = Q[W.origin] ?? W.origin;
        if (Y) return `For lille: forventede ${D} ${Y.verb} ${X} ${W.minimum.toString()} ${Y.unit}`;
        return `For lille: forventede ${D} havde ${X} ${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `Ugyldig streng: skal starte med "${X.prefix}"`;
        if (X.format === "ends_with") return `Ugyldig streng: skal ende med "${X.suffix}"`;
        if (X.format === "includes") return `Ugyldig streng: skal indeholde "${X.includes}"`;
        if (X.format === "regex") return `Ugyldig streng: skal matche m\xF8nsteret ${X.pattern}`;
        return `Ugyldig ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `Ugyldigt tal: skal v\xE6re deleligt med ${W.divisor}`;
      case "unrecognized_keys":
        return `${W.keys.length > 1 ? "Ukendte n\xF8gler" : "Ukendt n\xF8gle"}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `Ugyldig n\xF8gle i ${W.origin}`;
      case "invalid_union":
        return "Ugyldigt input: matcher ingen af de tilladte typer";
      case "invalid_element":
        return `Ugyldig v\xE6rdi i ${W.origin}`;
      default:
        return "Ugyldigt input";
    }
  };
};
function P4() {
  return { localeError: BC() };
}
var EC = () => {
  let $ = {
    string: { unit: "Zeichen", verb: "zu haben" },
    file: { unit: "Bytes", verb: "zu haben" },
    array: { unit: "Elemente", verb: "zu haben" },
    set: { unit: "Elemente", verb: "zu haben" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "Eingabe",
      email: "E-Mail-Adresse",
      url: "URL",
      emoji: "Emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO-Datum und -Uhrzeit",
      date: "ISO-Datum",
      time: "ISO-Uhrzeit",
      duration: "ISO-Dauer",
      ipv4: "IPv4-Adresse",
      ipv6: "IPv6-Adresse",
      cidrv4: "IPv4-Bereich",
      cidrv6: "IPv6-Bereich",
      base64: "Base64-codierter String",
      base64url: "Base64-URL-codierter String",
      json_string: "JSON-String",
      e164: "E.164-Nummer",
      jwt: "JWT",
      template_literal: "Eingabe",
    },
    Q = { nan: "NaN", number: "Zahl", array: "Array" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected)) return `Ung\xFCltige Eingabe: erwartet instanceof ${W.expected}, erhalten ${D}`;
        return `Ung\xFCltige Eingabe: erwartet ${X}, erhalten ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Ung\xFCltige Eingabe: erwartet ${$$(W.values[0])}`;
        return `Ung\xFCltige Option: erwartet eine von ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `Zu gro\xDF: erwartet, dass ${W.origin ?? "Wert"} ${X}${W.maximum.toString()} ${Y.unit ?? "Elemente"} hat`;
        return `Zu gro\xDF: erwartet, dass ${W.origin ?? "Wert"} ${X}${W.maximum.toString()} ist`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y) return `Zu klein: erwartet, dass ${W.origin} ${X}${W.minimum.toString()} ${Y.unit} hat`;
        return `Zu klein: erwartet, dass ${W.origin} ${X}${W.minimum.toString()} ist`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `Ung\xFCltiger String: muss mit "${X.prefix}" beginnen`;
        if (X.format === "ends_with") return `Ung\xFCltiger String: muss mit "${X.suffix}" enden`;
        if (X.format === "includes") return `Ung\xFCltiger String: muss "${X.includes}" enthalten`;
        if (X.format === "regex") return `Ung\xFCltiger String: muss dem Muster ${X.pattern} entsprechen`;
        return `Ung\xFCltig: ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `Ung\xFCltige Zahl: muss ein Vielfaches von ${W.divisor} sein`;
      case "unrecognized_keys":
        return `${W.keys.length > 1 ? "Unbekannte Schl\xFCssel" : "Unbekannter Schl\xFCssel"}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `Ung\xFCltiger Schl\xFCssel in ${W.origin}`;
      case "invalid_union":
        return "Ung\xFCltige Eingabe";
      case "invalid_element":
        return `Ung\xFCltiger Wert in ${W.origin}`;
      default:
        return "Ung\xFCltige Eingabe";
    }
  };
};
function _4() {
  return { localeError: EC() };
}
var LC = () => {
  let $ = {
    string: {
      unit: "\u03C7\u03B1\u03C1\u03B1\u03BA\u03C4\u03AE\u03C1\u03B5\u03C2",
      verb: "\u03BD\u03B1 \u03AD\u03C7\u03B5\u03B9",
    },
    file: { unit: "bytes", verb: "\u03BD\u03B1 \u03AD\u03C7\u03B5\u03B9" },
    array: { unit: "\u03C3\u03C4\u03BF\u03B9\u03C7\u03B5\u03AF\u03B1", verb: "\u03BD\u03B1 \u03AD\u03C7\u03B5\u03B9" },
    set: { unit: "\u03C3\u03C4\u03BF\u03B9\u03C7\u03B5\u03AF\u03B1", verb: "\u03BD\u03B1 \u03AD\u03C7\u03B5\u03B9" },
    map: {
      unit: "\u03BA\u03B1\u03C4\u03B1\u03C7\u03C9\u03C1\u03AE\u03C3\u03B5\u03B9\u03C2",
      verb: "\u03BD\u03B1 \u03AD\u03C7\u03B5\u03B9",
    },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "\u03B5\u03AF\u03C3\u03BF\u03B4\u03BF\u03C2",
      email: "\u03B4\u03B9\u03B5\u03CD\u03B8\u03C5\u03BD\u03C3\u03B7 email",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime:
        "ISO \u03B7\u03BC\u03B5\u03C1\u03BF\u03BC\u03B7\u03BD\u03AF\u03B1 \u03BA\u03B1\u03B9 \u03CE\u03C1\u03B1",
      date: "ISO \u03B7\u03BC\u03B5\u03C1\u03BF\u03BC\u03B7\u03BD\u03AF\u03B1",
      time: "ISO \u03CE\u03C1\u03B1",
      duration: "ISO \u03B4\u03B9\u03AC\u03C1\u03BA\u03B5\u03B9\u03B1",
      ipv4: "\u03B4\u03B9\u03B5\u03CD\u03B8\u03C5\u03BD\u03C3\u03B7 IPv4",
      ipv6: "\u03B4\u03B9\u03B5\u03CD\u03B8\u03C5\u03BD\u03C3\u03B7 IPv6",
      mac: "\u03B4\u03B9\u03B5\u03CD\u03B8\u03C5\u03BD\u03C3\u03B7 MAC",
      cidrv4: "\u03B5\u03CD\u03C1\u03BF\u03C2 IPv4",
      cidrv6: "\u03B5\u03CD\u03C1\u03BF\u03C2 IPv6",
      base64:
        "\u03C3\u03C5\u03BC\u03B2\u03BF\u03BB\u03BF\u03C3\u03B5\u03B9\u03C1\u03AC \u03BA\u03C9\u03B4\u03B9\u03BA\u03BF\u03C0\u03BF\u03B9\u03B7\u03BC\u03AD\u03BD\u03B7 \u03C3\u03B5 base64",
      base64url:
        "\u03C3\u03C5\u03BC\u03B2\u03BF\u03BB\u03BF\u03C3\u03B5\u03B9\u03C1\u03AC \u03BA\u03C9\u03B4\u03B9\u03BA\u03BF\u03C0\u03BF\u03B9\u03B7\u03BC\u03AD\u03BD\u03B7 \u03C3\u03B5 base64url",
      json_string: "\u03C3\u03C5\u03BC\u03B2\u03BF\u03BB\u03BF\u03C3\u03B5\u03B9\u03C1\u03AC JSON",
      e164: "\u03B1\u03C1\u03B9\u03B8\u03BC\u03CC\u03C2 E.164",
      jwt: "JWT",
      template_literal: "\u03B5\u03AF\u03C3\u03BF\u03B4\u03BF\u03C2",
    },
    Q = { nan: "NaN" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (typeof W.expected === "string" && /^[A-Z]/.test(W.expected))
          return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03B5\u03AF\u03C3\u03BF\u03B4\u03BF\u03C2: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD instanceof ${W.expected}, \u03BB\u03AE\u03C6\u03B8\u03B7\u03BA\u03B5 ${D}`;
        return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03B5\u03AF\u03C3\u03BF\u03B4\u03BF\u03C2: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD ${X}, \u03BB\u03AE\u03C6\u03B8\u03B7\u03BA\u03B5 ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1)
          return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03B5\u03AF\u03C3\u03BF\u03B4\u03BF\u03C2: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD ${$$(W.values[0])}`;
        return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03B5\u03C0\u03B9\u03BB\u03BF\u03B3\u03AE: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD \u03AD\u03BD\u03B1 \u03B1\u03C0\u03CC ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `\u03A0\u03BF\u03BB\u03CD \u03BC\u03B5\u03B3\u03AC\u03BB\u03BF: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD ${W.origin ?? "\u03C4\u03B9\u03BC\u03AE"} \u03BD\u03B1 \u03AD\u03C7\u03B5\u03B9 ${X}${W.maximum.toString()} ${Y.unit ?? "\u03C3\u03C4\u03BF\u03B9\u03C7\u03B5\u03AF\u03B1"}`;
        return `\u03A0\u03BF\u03BB\u03CD \u03BC\u03B5\u03B3\u03AC\u03BB\u03BF: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD ${W.origin ?? "\u03C4\u03B9\u03BC\u03AE"} \u03BD\u03B1 \u03B5\u03AF\u03BD\u03B1\u03B9 ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y)
          return `\u03A0\u03BF\u03BB\u03CD \u03BC\u03B9\u03BA\u03C1\u03CC: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD ${W.origin} \u03BD\u03B1 \u03AD\u03C7\u03B5\u03B9 ${X}${W.minimum.toString()} ${Y.unit}`;
        return `\u03A0\u03BF\u03BB\u03CD \u03BC\u03B9\u03BA\u03C1\u03CC: \u03B1\u03BD\u03B1\u03BC\u03B5\u03BD\u03CC\u03C4\u03B1\u03BD ${W.origin} \u03BD\u03B1 \u03B5\u03AF\u03BD\u03B1\u03B9 ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03C3\u03C5\u03BC\u03B2\u03BF\u03BB\u03BF\u03C3\u03B5\u03B9\u03C1\u03AC: \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03BE\u03B5\u03BA\u03B9\u03BD\u03AC \u03BC\u03B5 "${X.prefix}"`;
        if (X.format === "ends_with")
          return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03C3\u03C5\u03BC\u03B2\u03BF\u03BB\u03BF\u03C3\u03B5\u03B9\u03C1\u03AC: \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03C4\u03B5\u03BB\u03B5\u03B9\u03CE\u03BD\u03B5\u03B9 \u03BC\u03B5 "${X.suffix}"`;
        if (X.format === "includes")
          return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03C3\u03C5\u03BC\u03B2\u03BF\u03BB\u03BF\u03C3\u03B5\u03B9\u03C1\u03AC: \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03C0\u03B5\u03C1\u03B9\u03AD\u03C7\u03B5\u03B9 "${X.includes}"`;
        if (X.format === "regex")
          return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03C3\u03C5\u03BC\u03B2\u03BF\u03BB\u03BF\u03C3\u03B5\u03B9\u03C1\u03AC: \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03C4\u03B1\u03B9\u03C1\u03B9\u03AC\u03B6\u03B5\u03B9 \u03BC\u03B5 \u03C4\u03BF \u03BC\u03BF\u03C4\u03AF\u03B2\u03BF ${X.pattern}`;
        return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03BF: ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03BF\u03C2 \u03B1\u03C1\u03B9\u03B8\u03BC\u03CC\u03C2: \u03C0\u03C1\u03AD\u03C0\u03B5\u03B9 \u03BD\u03B1 \u03B5\u03AF\u03BD\u03B1\u03B9 \u03C0\u03BF\u03BB\u03BB\u03B1\u03C0\u03BB\u03AC\u03C3\u03B9\u03BF \u03C4\u03BF\u03C5 ${W.divisor}`;
      case "unrecognized_keys":
        return `\u0386\u03B3\u03BD\u03C9\u03C3\u03C4${W.keys.length > 1 ? "\u03B1" : "\u03BF"} \u03BA\u03BB\u03B5\u03B9\u03B4${W.keys.length > 1 ? "\u03B9\u03AC" : "\u03AF"}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03BF \u03BA\u03BB\u03B5\u03B9\u03B4\u03AF \u03C3\u03C4\u03BF ${W.origin}`;
      case "invalid_union":
        return "\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03B5\u03AF\u03C3\u03BF\u03B4\u03BF\u03C2";
      case "invalid_element":
        return `\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03C4\u03B9\u03BC\u03AE \u03C3\u03C4\u03BF ${W.origin}`;
      default:
        return "\u039C\u03B7 \u03AD\u03B3\u03BA\u03C5\u03C1\u03B7 \u03B5\u03AF\u03C3\u03BF\u03B4\u03BF\u03C2";
    }
  };
};
function S4() {
  return { localeError: LC() };
}
var wC = () => {
  let $ = {
    string: { unit: "characters", verb: "to have" },
    file: { unit: "bytes", verb: "to have" },
    array: { unit: "items", verb: "to have" },
    set: { unit: "items", verb: "to have" },
    map: { unit: "entries", verb: "to have" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "input",
      email: "email address",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO datetime",
      date: "ISO date",
      time: "ISO time",
      duration: "ISO duration",
      ipv4: "IPv4 address",
      ipv6: "IPv6 address",
      mac: "MAC address",
      cidrv4: "IPv4 range",
      cidrv6: "IPv6 range",
      base64: "base64-encoded string",
      base64url: "base64url-encoded string",
      json_string: "JSON string",
      e164: "E.164 number",
      jwt: "JWT",
      template_literal: "input",
    },
    Q = { nan: "NaN" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        return `Invalid input: expected ${X}, received ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Invalid input: expected ${$$(W.values[0])}`;
        return `Invalid option: expected one of ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `Too big: expected ${W.origin ?? "value"} to have ${X}${W.maximum.toString()} ${Y.unit ?? "elements"}`;
        return `Too big: expected ${W.origin ?? "value"} to be ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y) return `Too small: expected ${W.origin} to have ${X}${W.minimum.toString()} ${Y.unit}`;
        return `Too small: expected ${W.origin} to be ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `Invalid string: must start with "${X.prefix}"`;
        if (X.format === "ends_with") return `Invalid string: must end with "${X.suffix}"`;
        if (X.format === "includes") return `Invalid string: must include "${X.includes}"`;
        if (X.format === "regex") return `Invalid string: must match pattern ${X.pattern}`;
        return `Invalid ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `Invalid number: must be a multiple of ${W.divisor}`;
      case "unrecognized_keys":
        return `Unrecognized key${W.keys.length > 1 ? "s" : ""}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `Invalid key in ${W.origin}`;
      case "invalid_union":
        if (W.options && Array.isArray(W.options) && W.options.length > 0)
          return `Invalid discriminator value. Expected ${W.options.map((Y) => `'${Y}'`).join(" | ")}`;
        return "Invalid input";
      case "invalid_element":
        return `Invalid value in ${W.origin}`;
      default:
        return "Invalid input";
    }
  };
};
function P7() {
  return { localeError: wC() };
}
var IC = () => {
  let $ = {
    string: { unit: "karaktrojn", verb: "havi" },
    file: { unit: "bajtojn", verb: "havi" },
    array: { unit: "elementojn", verb: "havi" },
    set: { unit: "elementojn", verb: "havi" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "enigo",
      email: "retadreso",
      url: "URL",
      emoji: "emo\u011Dio",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO-datotempo",
      date: "ISO-dato",
      time: "ISO-tempo",
      duration: "ISO-da\u016Dro",
      ipv4: "IPv4-adreso",
      ipv6: "IPv6-adreso",
      cidrv4: "IPv4-rango",
      cidrv6: "IPv6-rango",
      base64: "64-ume kodita karaktraro",
      base64url: "URL-64-ume kodita karaktraro",
      json_string: "JSON-karaktraro",
      e164: "E.164-nombro",
      jwt: "JWT",
      template_literal: "enigo",
    },
    Q = { nan: "NaN", number: "nombro", array: "tabelo", null: "senvalora" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `Nevalida enigo: atendi\u011Dis instanceof ${W.expected}, ricevi\u011Dis ${D}`;
        return `Nevalida enigo: atendi\u011Dis ${X}, ricevi\u011Dis ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Nevalida enigo: atendi\u011Dis ${$$(W.values[0])}`;
        return `Nevalida opcio: atendi\u011Dis unu el ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `Tro granda: atendi\u011Dis ke ${W.origin ?? "valoro"} havu ${X}${W.maximum.toString()} ${Y.unit ?? "elementojn"}`;
        return `Tro granda: atendi\u011Dis ke ${W.origin ?? "valoro"} havu ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y) return `Tro malgranda: atendi\u011Dis ke ${W.origin} havu ${X}${W.minimum.toString()} ${Y.unit}`;
        return `Tro malgranda: atendi\u011Dis ke ${W.origin} estu ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `Nevalida karaktraro: devas komenci\u011Di per "${X.prefix}"`;
        if (X.format === "ends_with") return `Nevalida karaktraro: devas fini\u011Di per "${X.suffix}"`;
        if (X.format === "includes") return `Nevalida karaktraro: devas inkluzivi "${X.includes}"`;
        if (X.format === "regex") return `Nevalida karaktraro: devas kongrui kun la modelo ${X.pattern}`;
        return `Nevalida ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `Nevalida nombro: devas esti oblo de ${W.divisor}`;
      case "unrecognized_keys":
        return `Nekonata${W.keys.length > 1 ? "j" : ""} \u015Dlosilo${W.keys.length > 1 ? "j" : ""}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `Nevalida \u015Dlosilo en ${W.origin}`;
      case "invalid_union":
        return "Nevalida enigo";
      case "invalid_element":
        return `Nevalida valoro en ${W.origin}`;
      default:
        return "Nevalida enigo";
    }
  };
};
function C4() {
  return { localeError: IC() };
}
var VC = () => {
  let $ = {
    string: { unit: "caracteres", verb: "tener" },
    file: { unit: "bytes", verb: "tener" },
    array: { unit: "elementos", verb: "tener" },
    set: { unit: "elementos", verb: "tener" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "entrada",
      email: "direcci\xF3n de correo electr\xF3nico",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "fecha y hora ISO",
      date: "fecha ISO",
      time: "hora ISO",
      duration: "duraci\xF3n ISO",
      ipv4: "direcci\xF3n IPv4",
      ipv6: "direcci\xF3n IPv6",
      cidrv4: "rango IPv4",
      cidrv6: "rango IPv6",
      base64: "cadena codificada en base64",
      base64url: "URL codificada en base64",
      json_string: "cadena JSON",
      e164: "n\xFAmero E.164",
      jwt: "JWT",
      template_literal: "entrada",
    },
    Q = {
      nan: "NaN",
      string: "texto",
      number: "n\xFAmero",
      boolean: "booleano",
      array: "arreglo",
      object: "objeto",
      set: "conjunto",
      file: "archivo",
      date: "fecha",
      bigint: "n\xFAmero grande",
      symbol: "s\xEDmbolo",
      undefined: "indefinido",
      null: "nulo",
      function: "funci\xF3n",
      map: "mapa",
      record: "registro",
      tuple: "tupla",
      enum: "enumeraci\xF3n",
      union: "uni\xF3n",
      literal: "literal",
      promise: "promesa",
      void: "vac\xEDo",
      never: "nunca",
      unknown: "desconocido",
      any: "cualquiera",
    };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `Entrada inv\xE1lida: se esperaba instanceof ${W.expected}, recibido ${D}`;
        return `Entrada inv\xE1lida: se esperaba ${X}, recibido ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Entrada inv\xE1lida: se esperaba ${$$(W.values[0])}`;
        return `Opci\xF3n inv\xE1lida: se esperaba una de ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin),
          D = Q[W.origin] ?? W.origin;
        if (Y)
          return `Demasiado grande: se esperaba que ${D ?? "valor"} tuviera ${X}${W.maximum.toString()} ${Y.unit ?? "elementos"}`;
        return `Demasiado grande: se esperaba que ${D ?? "valor"} fuera ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin),
          D = Q[W.origin] ?? W.origin;
        if (Y) return `Demasiado peque\xF1o: se esperaba que ${D} tuviera ${X}${W.minimum.toString()} ${Y.unit}`;
        return `Demasiado peque\xF1o: se esperaba que ${D} fuera ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `Cadena inv\xE1lida: debe comenzar con "${X.prefix}"`;
        if (X.format === "ends_with") return `Cadena inv\xE1lida: debe terminar en "${X.suffix}"`;
        if (X.format === "includes") return `Cadena inv\xE1lida: debe incluir "${X.includes}"`;
        if (X.format === "regex") return `Cadena inv\xE1lida: debe coincidir con el patr\xF3n ${X.pattern}`;
        return `Inv\xE1lido ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `N\xFAmero inv\xE1lido: debe ser m\xFAltiplo de ${W.divisor}`;
      case "unrecognized_keys":
        return `Llave${W.keys.length > 1 ? "s" : ""} desconocida${W.keys.length > 1 ? "s" : ""}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `Llave inv\xE1lida en ${Q[W.origin] ?? W.origin}`;
      case "invalid_union":
        return "Entrada inv\xE1lida";
      case "invalid_element":
        return `Valor inv\xE1lido en ${Q[W.origin] ?? W.origin}`;
      default:
        return "Entrada inv\xE1lida";
    }
  };
};
function T4() {
  return { localeError: VC() };
}
var kC = () => {
  let $ = {
    string: {
      unit: "\u06A9\u0627\u0631\u0627\u06A9\u062A\u0631",
      verb: "\u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F",
    },
    file: { unit: "\u0628\u0627\u06CC\u062A", verb: "\u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F" },
    array: { unit: "\u0622\u06CC\u062A\u0645", verb: "\u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F" },
    set: { unit: "\u0622\u06CC\u062A\u0645", verb: "\u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "\u0648\u0631\u0648\u062F\u06CC",
      email: "\u0622\u062F\u0631\u0633 \u0627\u06CC\u0645\u06CC\u0644",
      url: "URL",
      emoji: "\u0627\u06CC\u0645\u0648\u062C\u06CC",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "\u062A\u0627\u0631\u06CC\u062E \u0648 \u0632\u0645\u0627\u0646 \u0627\u06CC\u0632\u0648",
      date: "\u062A\u0627\u0631\u06CC\u062E \u0627\u06CC\u0632\u0648",
      time: "\u0632\u0645\u0627\u0646 \u0627\u06CC\u0632\u0648",
      duration: "\u0645\u062F\u062A \u0632\u0645\u0627\u0646 \u0627\u06CC\u0632\u0648",
      ipv4: "IPv4 \u0622\u062F\u0631\u0633",
      ipv6: "IPv6 \u0622\u062F\u0631\u0633",
      cidrv4: "IPv4 \u062F\u0627\u0645\u0646\u0647",
      cidrv6: "IPv6 \u062F\u0627\u0645\u0646\u0647",
      base64: "base64-encoded \u0631\u0634\u062A\u0647",
      base64url: "base64url-encoded \u0631\u0634\u062A\u0647",
      json_string: "JSON \u0631\u0634\u062A\u0647",
      e164: "E.164 \u0639\u062F\u062F",
      jwt: "JWT",
      template_literal: "\u0648\u0631\u0648\u062F\u06CC",
    },
    Q = { nan: "NaN", number: "\u0639\u062F\u062F", array: "\u0622\u0631\u0627\u06CC\u0647" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `\u0648\u0631\u0648\u062F\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0645\u06CC\u200C\u0628\u0627\u06CC\u0633\u062A instanceof ${W.expected} \u0645\u06CC\u200C\u0628\u0648\u062F\u060C ${D} \u062F\u0631\u06CC\u0627\u0641\u062A \u0634\u062F`;
        return `\u0648\u0631\u0648\u062F\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0645\u06CC\u200C\u0628\u0627\u06CC\u0633\u062A ${X} \u0645\u06CC\u200C\u0628\u0648\u062F\u060C ${D} \u062F\u0631\u06CC\u0627\u0641\u062A \u0634\u062F`;
      }
      case "invalid_value":
        if (W.values.length === 1)
          return `\u0648\u0631\u0648\u062F\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0645\u06CC\u200C\u0628\u0627\u06CC\u0633\u062A ${$$(W.values[0])} \u0645\u06CC\u200C\u0628\u0648\u062F`;
        return `\u06AF\u0632\u06CC\u0646\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0645\u06CC\u200C\u0628\u0627\u06CC\u0633\u062A \u06CC\u06A9\u06CC \u0627\u0632 ${p(W.values, "|")} \u0645\u06CC\u200C\u0628\u0648\u062F`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `\u062E\u06CC\u0644\u06CC \u0628\u0632\u0631\u06AF: ${W.origin ?? "\u0645\u0642\u062F\u0627\u0631"} \u0628\u0627\u06CC\u062F ${X}${W.maximum.toString()} ${Y.unit ?? "\u0639\u0646\u0635\u0631"} \u0628\u0627\u0634\u062F`;
        return `\u062E\u06CC\u0644\u06CC \u0628\u0632\u0631\u06AF: ${W.origin ?? "\u0645\u0642\u062F\u0627\u0631"} \u0628\u0627\u06CC\u062F ${X}${W.maximum.toString()} \u0628\u0627\u0634\u062F`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y)
          return `\u062E\u06CC\u0644\u06CC \u06A9\u0648\u0686\u06A9: ${W.origin} \u0628\u0627\u06CC\u062F ${X}${W.minimum.toString()} ${Y.unit} \u0628\u0627\u0634\u062F`;
        return `\u062E\u06CC\u0644\u06CC \u06A9\u0648\u0686\u06A9: ${W.origin} \u0628\u0627\u06CC\u062F ${X}${W.minimum.toString()} \u0628\u0627\u0634\u062F`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `\u0631\u0634\u062A\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0628\u0627\u06CC\u062F \u0628\u0627 "${X.prefix}" \u0634\u0631\u0648\u0639 \u0634\u0648\u062F`;
        if (X.format === "ends_with")
          return `\u0631\u0634\u062A\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0628\u0627\u06CC\u062F \u0628\u0627 "${X.suffix}" \u062A\u0645\u0627\u0645 \u0634\u0648\u062F`;
        if (X.format === "includes")
          return `\u0631\u0634\u062A\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0628\u0627\u06CC\u062F \u0634\u0627\u0645\u0644 "${X.includes}" \u0628\u0627\u0634\u062F`;
        if (X.format === "regex")
          return `\u0631\u0634\u062A\u0647 \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0628\u0627\u06CC\u062F \u0628\u0627 \u0627\u0644\u06AF\u0648\u06CC ${X.pattern} \u0645\u0637\u0627\u0628\u0642\u062A \u062F\u0627\u0634\u062A\u0647 \u0628\u0627\u0634\u062F`;
        return `${U[X.format] ?? W.format} \u0646\u0627\u0645\u0639\u062A\u0628\u0631`;
      }
      case "not_multiple_of":
        return `\u0639\u062F\u062F \u0646\u0627\u0645\u0639\u062A\u0628\u0631: \u0628\u0627\u06CC\u062F \u0645\u0636\u0631\u0628 ${W.divisor} \u0628\u0627\u0634\u062F`;
      case "unrecognized_keys":
        return `\u06A9\u0644\u06CC\u062F${W.keys.length > 1 ? "\u0647\u0627\u06CC" : ""} \u0646\u0627\u0634\u0646\u0627\u0633: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `\u06A9\u0644\u06CC\u062F \u0646\u0627\u0634\u0646\u0627\u0633 \u062F\u0631 ${W.origin}`;
      case "invalid_union":
        return "\u0648\u0631\u0648\u062F\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631";
      case "invalid_element":
        return `\u0645\u0642\u062F\u0627\u0631 \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u062F\u0631 ${W.origin}`;
      default:
        return "\u0648\u0631\u0648\u062F\u06CC \u0646\u0627\u0645\u0639\u062A\u0628\u0631";
    }
  };
};
function j4() {
  return { localeError: kC() };
}
var AC = () => {
  let $ = {
    string: { unit: "merkki\xE4", subject: "merkkijonon" },
    file: { unit: "tavua", subject: "tiedoston" },
    array: { unit: "alkiota", subject: "listan" },
    set: { unit: "alkiota", subject: "joukon" },
    number: { unit: "", subject: "luvun" },
    bigint: { unit: "", subject: "suuren kokonaisluvun" },
    int: { unit: "", subject: "kokonaisluvun" },
    date: { unit: "", subject: "p\xE4iv\xE4m\xE4\xE4r\xE4n" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "s\xE4\xE4nn\xF6llinen lauseke",
      email: "s\xE4hk\xF6postiosoite",
      url: "URL-osoite",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO-aikaleima",
      date: "ISO-p\xE4iv\xE4m\xE4\xE4r\xE4",
      time: "ISO-aika",
      duration: "ISO-kesto",
      ipv4: "IPv4-osoite",
      ipv6: "IPv6-osoite",
      cidrv4: "IPv4-alue",
      cidrv6: "IPv6-alue",
      base64: "base64-koodattu merkkijono",
      base64url: "base64url-koodattu merkkijono",
      json_string: "JSON-merkkijono",
      e164: "E.164-luku",
      jwt: "JWT",
      template_literal: "templaattimerkkijono",
    },
    Q = { nan: "NaN" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected)) return `Virheellinen tyyppi: odotettiin instanceof ${W.expected}, oli ${D}`;
        return `Virheellinen tyyppi: odotettiin ${X}, oli ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Virheellinen sy\xF6te: t\xE4ytyy olla ${$$(W.values[0])}`;
        return `Virheellinen valinta: t\xE4ytyy olla yksi seuraavista: ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y) return `Liian suuri: ${Y.subject} t\xE4ytyy olla ${X}${W.maximum.toString()} ${Y.unit}`.trim();
        return `Liian suuri: arvon t\xE4ytyy olla ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y) return `Liian pieni: ${Y.subject} t\xE4ytyy olla ${X}${W.minimum.toString()} ${Y.unit}`.trim();
        return `Liian pieni: arvon t\xE4ytyy olla ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `Virheellinen sy\xF6te: t\xE4ytyy alkaa "${X.prefix}"`;
        if (X.format === "ends_with") return `Virheellinen sy\xF6te: t\xE4ytyy loppua "${X.suffix}"`;
        if (X.format === "includes") return `Virheellinen sy\xF6te: t\xE4ytyy sis\xE4lt\xE4\xE4 "${X.includes}"`;
        if (X.format === "regex")
          return `Virheellinen sy\xF6te: t\xE4ytyy vastata s\xE4\xE4nn\xF6llist\xE4 lauseketta ${X.pattern}`;
        return `Virheellinen ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `Virheellinen luku: t\xE4ytyy olla luvun ${W.divisor} monikerta`;
      case "unrecognized_keys":
        return `${W.keys.length > 1 ? "Tuntemattomat avaimet" : "Tuntematon avain"}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return "Virheellinen avain tietueessa";
      case "invalid_union":
        return "Virheellinen unioni";
      case "invalid_element":
        return "Virheellinen arvo joukossa";
      default:
        return "Virheellinen sy\xF6te";
    }
  };
};
function v4() {
  return { localeError: AC() };
}
var MC = () => {
  let $ = {
    string: { unit: "caract\xE8res", verb: "avoir" },
    file: { unit: "octets", verb: "avoir" },
    array: { unit: "\xE9l\xE9ments", verb: "avoir" },
    set: { unit: "\xE9l\xE9ments", verb: "avoir" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "entr\xE9e",
      email: "adresse e-mail",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "date et heure ISO",
      date: "date ISO",
      time: "heure ISO",
      duration: "dur\xE9e ISO",
      ipv4: "adresse IPv4",
      ipv6: "adresse IPv6",
      cidrv4: "plage IPv4",
      cidrv6: "plage IPv6",
      base64: "cha\xEEne encod\xE9e en base64",
      base64url: "cha\xEEne encod\xE9e en base64url",
      json_string: "cha\xEEne JSON",
      e164: "num\xE9ro E.164",
      jwt: "JWT",
      template_literal: "entr\xE9e",
    },
    Q = {
      string: "cha\xEEne",
      number: "nombre",
      int: "entier",
      boolean: "bool\xE9en",
      bigint: "grand entier",
      symbol: "symbole",
      undefined: "ind\xE9fini",
      null: "null",
      never: "jamais",
      void: "vide",
      date: "date",
      array: "tableau",
      object: "objet",
      tuple: "tuple",
      record: "enregistrement",
      map: "carte",
      set: "ensemble",
      file: "fichier",
      nonoptional: "non-optionnel",
      nan: "NaN",
      function: "fonction",
    };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected)) return `Entr\xE9e invalide : instanceof ${W.expected} attendu, ${D} re\xE7u`;
        return `Entr\xE9e invalide : ${X} attendu, ${D} re\xE7u`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Entr\xE9e invalide : ${$$(W.values[0])} attendu`;
        return `Option invalide : une valeur parmi ${p(W.values, "|")} attendue`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `Trop grand : ${Q[W.origin] ?? "valeur"} doit ${Y.verb} ${X}${W.maximum.toString()} ${Y.unit ?? "\xE9l\xE9ment(s)"}`;
        return `Trop grand : ${Q[W.origin] ?? "valeur"} doit \xEAtre ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y) return `Trop petit : ${Q[W.origin] ?? "valeur"} doit ${Y.verb} ${X}${W.minimum.toString()} ${Y.unit}`;
        return `Trop petit : ${Q[W.origin] ?? "valeur"} doit \xEAtre ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `Cha\xEEne invalide : doit commencer par "${X.prefix}"`;
        if (X.format === "ends_with") return `Cha\xEEne invalide : doit se terminer par "${X.suffix}"`;
        if (X.format === "includes") return `Cha\xEEne invalide : doit inclure "${X.includes}"`;
        if (X.format === "regex") return `Cha\xEEne invalide : doit correspondre au mod\xE8le ${X.pattern}`;
        return `${U[X.format] ?? W.format} invalide`;
      }
      case "not_multiple_of":
        return `Nombre invalide : doit \xEAtre un multiple de ${W.divisor}`;
      case "unrecognized_keys":
        return `Cl\xE9${W.keys.length > 1 ? "s" : ""} non reconnue${W.keys.length > 1 ? "s" : ""} : ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `Cl\xE9 invalide dans ${W.origin}`;
      case "invalid_union":
        return "Entr\xE9e invalide";
      case "invalid_element":
        return `Valeur invalide dans ${W.origin}`;
      default:
        return "Entr\xE9e invalide";
    }
  };
};
function b4() {
  return { localeError: MC() };
}
var RC = () => {
  let $ = {
    string: { unit: "caract\xE8res", verb: "avoir" },
    file: { unit: "octets", verb: "avoir" },
    array: { unit: "\xE9l\xE9ments", verb: "avoir" },
    set: { unit: "\xE9l\xE9ments", verb: "avoir" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "entr\xE9e",
      email: "adresse courriel",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "date-heure ISO",
      date: "date ISO",
      time: "heure ISO",
      duration: "dur\xE9e ISO",
      ipv4: "adresse IPv4",
      ipv6: "adresse IPv6",
      cidrv4: "plage IPv4",
      cidrv6: "plage IPv6",
      base64: "cha\xEEne encod\xE9e en base64",
      base64url: "cha\xEEne encod\xE9e en base64url",
      json_string: "cha\xEEne JSON",
      e164: "num\xE9ro E.164",
      jwt: "JWT",
      template_literal: "entr\xE9e",
    },
    Q = { nan: "NaN" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected)) return `Entr\xE9e invalide : attendu instanceof ${W.expected}, re\xE7u ${D}`;
        return `Entr\xE9e invalide : attendu ${X}, re\xE7u ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Entr\xE9e invalide : attendu ${$$(W.values[0])}`;
        return `Option invalide : attendu l'une des valeurs suivantes ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "\u2264" : "<",
          Y = J(W.origin);
        if (Y) return `Trop grand : attendu que ${W.origin ?? "la valeur"} ait ${X}${W.maximum.toString()} ${Y.unit}`;
        return `Trop grand : attendu que ${W.origin ?? "la valeur"} soit ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? "\u2265" : ">",
          Y = J(W.origin);
        if (Y) return `Trop petit : attendu que ${W.origin} ait ${X}${W.minimum.toString()} ${Y.unit}`;
        return `Trop petit : attendu que ${W.origin} soit ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `Cha\xEEne invalide : doit commencer par "${X.prefix}"`;
        if (X.format === "ends_with") return `Cha\xEEne invalide : doit se terminer par "${X.suffix}"`;
        if (X.format === "includes") return `Cha\xEEne invalide : doit inclure "${X.includes}"`;
        if (X.format === "regex") return `Cha\xEEne invalide : doit correspondre au motif ${X.pattern}`;
        return `${U[X.format] ?? W.format} invalide`;
      }
      case "not_multiple_of":
        return `Nombre invalide : doit \xEAtre un multiple de ${W.divisor}`;
      case "unrecognized_keys":
        return `Cl\xE9${W.keys.length > 1 ? "s" : ""} non reconnue${W.keys.length > 1 ? "s" : ""} : ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `Cl\xE9 invalide dans ${W.origin}`;
      case "invalid_union":
        return "Entr\xE9e invalide";
      case "invalid_element":
        return `Valeur invalide dans ${W.origin}`;
      default:
        return "Entr\xE9e invalide";
    }
  };
};
function f4() {
  return { localeError: RC() };
}
var ZC = () => {
  let $ = {
      string: { label: "\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA", gender: "f" },
      number: { label: "\u05DE\u05E1\u05E4\u05E8", gender: "m" },
      boolean: { label: "\u05E2\u05E8\u05DA \u05D1\u05D5\u05DC\u05D9\u05D0\u05E0\u05D9", gender: "m" },
      bigint: { label: "BigInt", gender: "m" },
      date: { label: "\u05EA\u05D0\u05E8\u05D9\u05DA", gender: "m" },
      array: { label: "\u05DE\u05E2\u05E8\u05DA", gender: "m" },
      object: { label: "\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8", gender: "m" },
      null: { label: "\u05E2\u05E8\u05DA \u05E8\u05D9\u05E7 (null)", gender: "m" },
      undefined: { label: "\u05E2\u05E8\u05DA \u05DC\u05D0 \u05DE\u05D5\u05D2\u05D3\u05E8 (undefined)", gender: "m" },
      symbol: { label: "\u05E1\u05D9\u05DE\u05D1\u05D5\u05DC (Symbol)", gender: "m" },
      function: { label: "\u05E4\u05D5\u05E0\u05E7\u05E6\u05D9\u05D4", gender: "f" },
      map: { label: "\u05DE\u05E4\u05D4 (Map)", gender: "f" },
      set: { label: "\u05E7\u05D1\u05D5\u05E6\u05D4 (Set)", gender: "f" },
      file: { label: "\u05E7\u05D5\u05D1\u05E5", gender: "m" },
      promise: { label: "Promise", gender: "m" },
      NaN: { label: "NaN", gender: "m" },
      unknown: { label: "\u05E2\u05E8\u05DA \u05DC\u05D0 \u05D9\u05D3\u05D5\u05E2", gender: "m" },
      value: { label: "\u05E2\u05E8\u05DA", gender: "m" },
    },
    J = {
      string: {
        unit: "\u05EA\u05D5\u05D5\u05D9\u05DD",
        shortLabel: "\u05E7\u05E6\u05E8",
        longLabel: "\u05D0\u05E8\u05D5\u05DA",
      },
      file: {
        unit: "\u05D1\u05D9\u05D9\u05D8\u05D9\u05DD",
        shortLabel: "\u05E7\u05D8\u05DF",
        longLabel: "\u05D2\u05D3\u05D5\u05DC",
      },
      array: {
        unit: "\u05E4\u05E8\u05D9\u05D8\u05D9\u05DD",
        shortLabel: "\u05E7\u05D8\u05DF",
        longLabel: "\u05D2\u05D3\u05D5\u05DC",
      },
      set: {
        unit: "\u05E4\u05E8\u05D9\u05D8\u05D9\u05DD",
        shortLabel: "\u05E7\u05D8\u05DF",
        longLabel: "\u05D2\u05D3\u05D5\u05DC",
      },
      number: { unit: "", shortLabel: "\u05E7\u05D8\u05DF", longLabel: "\u05D2\u05D3\u05D5\u05DC" },
    },
    U = (G) => (G ? $[G] : void 0),
    Q = (G) => {
      let K = U(G);
      if (K) return K.label;
      return G ?? $.unknown.label;
    },
    W = (G) => `\u05D4${Q(G)}`,
    X = (G) => {
      return (U(G)?.gender ?? "m") === "f"
        ? "\u05E6\u05E8\u05D9\u05DB\u05D4 \u05DC\u05D4\u05D9\u05D5\u05EA"
        : "\u05E6\u05E8\u05D9\u05DA \u05DC\u05D4\u05D9\u05D5\u05EA";
    },
    Y = (G) => {
      if (!G) return null;
      return J[G] ?? null;
    },
    D = {
      regex: { label: "\u05E7\u05DC\u05D8", gender: "m" },
      email: { label: "\u05DB\u05EA\u05D5\u05D1\u05EA \u05D0\u05D9\u05DE\u05D9\u05D9\u05DC", gender: "f" },
      url: { label: "\u05DB\u05EA\u05D5\u05D1\u05EA \u05E8\u05E9\u05EA", gender: "f" },
      emoji: { label: "\u05D0\u05D9\u05DE\u05D5\u05D2'\u05D9", gender: "m" },
      uuid: { label: "UUID", gender: "m" },
      nanoid: { label: "nanoid", gender: "m" },
      guid: { label: "GUID", gender: "m" },
      cuid: { label: "cuid", gender: "m" },
      cuid2: { label: "cuid2", gender: "m" },
      ulid: { label: "ULID", gender: "m" },
      xid: { label: "XID", gender: "m" },
      ksuid: { label: "KSUID", gender: "m" },
      datetime: { label: "\u05EA\u05D0\u05E8\u05D9\u05DA \u05D5\u05D6\u05DE\u05DF ISO", gender: "m" },
      date: { label: "\u05EA\u05D0\u05E8\u05D9\u05DA ISO", gender: "m" },
      time: { label: "\u05D6\u05DE\u05DF ISO", gender: "m" },
      duration: { label: "\u05DE\u05E9\u05DA \u05D6\u05DE\u05DF ISO", gender: "m" },
      ipv4: { label: "\u05DB\u05EA\u05D5\u05D1\u05EA IPv4", gender: "f" },
      ipv6: { label: "\u05DB\u05EA\u05D5\u05D1\u05EA IPv6", gender: "f" },
      cidrv4: { label: "\u05D8\u05D5\u05D5\u05D7 IPv4", gender: "m" },
      cidrv6: { label: "\u05D8\u05D5\u05D5\u05D7 IPv6", gender: "m" },
      base64: { label: "\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D1\u05D1\u05E1\u05D9\u05E1 64", gender: "f" },
      base64url: {
        label:
          "\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D1\u05D1\u05E1\u05D9\u05E1 64 \u05DC\u05DB\u05EA\u05D5\u05D1\u05D5\u05EA \u05E8\u05E9\u05EA",
        gender: "f",
      },
      json_string: { label: "\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA JSON", gender: "f" },
      e164: { label: "\u05DE\u05E1\u05E4\u05E8 E.164", gender: "m" },
      jwt: { label: "JWT", gender: "m" },
      ends_with: { label: "\u05E7\u05DC\u05D8", gender: "m" },
      includes: { label: "\u05E7\u05DC\u05D8", gender: "m" },
      lowercase: { label: "\u05E7\u05DC\u05D8", gender: "m" },
      starts_with: { label: "\u05E7\u05DC\u05D8", gender: "m" },
      uppercase: { label: "\u05E7\u05DC\u05D8", gender: "m" },
    },
    H = { nan: "NaN" };
  return (G) => {
    switch (G.code) {
      case "invalid_type": {
        let K = G.expected,
          O = H[K ?? ""] ?? Q(K),
          N = U$(G.input),
          F = H[N] ?? $[N]?.label ?? N;
        if (/^[A-Z]/.test(G.expected))
          return `\u05E7\u05DC\u05D8 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05E6\u05E8\u05D9\u05DA \u05DC\u05D4\u05D9\u05D5\u05EA instanceof ${G.expected}, \u05D4\u05EA\u05E7\u05D1\u05DC ${F}`;
        return `\u05E7\u05DC\u05D8 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05E6\u05E8\u05D9\u05DA \u05DC\u05D4\u05D9\u05D5\u05EA ${O}, \u05D4\u05EA\u05E7\u05D1\u05DC ${F}`;
      }
      case "invalid_value": {
        if (G.values.length === 1)
          return `\u05E2\u05E8\u05DA \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05D4\u05E2\u05E8\u05DA \u05D7\u05D9\u05D9\u05D1 \u05DC\u05D4\u05D9\u05D5\u05EA ${$$(G.values[0])}`;
        let K = G.values.map((F) => $$(F));
        if (G.values.length === 2)
          return `\u05E2\u05E8\u05DA \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05D4\u05D0\u05E4\u05E9\u05E8\u05D5\u05D9\u05D5\u05EA \u05D4\u05DE\u05EA\u05D0\u05D9\u05DE\u05D5\u05EA \u05D4\u05DF ${K[0]} \u05D0\u05D5 ${K[1]}`;
        let O = K[K.length - 1];
        return `\u05E2\u05E8\u05DA \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05D4\u05D0\u05E4\u05E9\u05E8\u05D5\u05D9\u05D5\u05EA \u05D4\u05DE\u05EA\u05D0\u05D9\u05DE\u05D5\u05EA \u05D4\u05DF ${K.slice(0, -1).join(", ")} \u05D0\u05D5 ${O}`;
      }
      case "too_big": {
        let K = Y(G.origin),
          O = W(G.origin ?? "value");
        if (G.origin === "string")
          return `${K?.longLabel ?? "\u05D0\u05E8\u05D5\u05DA"} \u05DE\u05D3\u05D9: ${O} \u05E6\u05E8\u05D9\u05DB\u05D4 \u05DC\u05D4\u05DB\u05D9\u05DC ${G.maximum.toString()} ${K?.unit ?? ""} ${G.inclusive ? "\u05D0\u05D5 \u05E4\u05D7\u05D5\u05EA" : "\u05DC\u05DB\u05DC \u05D4\u05D9\u05D5\u05EA\u05E8"}`.trim();
        if (G.origin === "number") {
          let B = G.inclusive
            ? `\u05E7\u05D8\u05DF \u05D0\u05D5 \u05E9\u05D5\u05D5\u05D4 \u05DC-${G.maximum}`
            : `\u05E7\u05D8\u05DF \u05DE-${G.maximum}`;
          return `\u05D2\u05D3\u05D5\u05DC \u05DE\u05D3\u05D9: ${O} \u05E6\u05E8\u05D9\u05DA \u05DC\u05D4\u05D9\u05D5\u05EA ${B}`;
        }
        if (G.origin === "array" || G.origin === "set") {
          let B = G.origin === "set" ? "\u05E6\u05E8\u05D9\u05DB\u05D4" : "\u05E6\u05E8\u05D9\u05DA",
            E = G.inclusive
              ? `${G.maximum} ${K?.unit ?? ""} \u05D0\u05D5 \u05E4\u05D7\u05D5\u05EA`
              : `\u05E4\u05D7\u05D5\u05EA \u05DE-${G.maximum} ${K?.unit ?? ""}`;
          return `\u05D2\u05D3\u05D5\u05DC \u05DE\u05D3\u05D9: ${O} ${B} \u05DC\u05D4\u05DB\u05D9\u05DC ${E}`.trim();
        }
        let N = G.inclusive ? "<=" : "<",
          F = X(G.origin ?? "value");
        if (K?.unit) return `${K.longLabel} \u05DE\u05D3\u05D9: ${O} ${F} ${N}${G.maximum.toString()} ${K.unit}`;
        return `${K?.longLabel ?? "\u05D2\u05D3\u05D5\u05DC"} \u05DE\u05D3\u05D9: ${O} ${F} ${N}${G.maximum.toString()}`;
      }
      case "too_small": {
        let K = Y(G.origin),
          O = W(G.origin ?? "value");
        if (G.origin === "string")
          return `${K?.shortLabel ?? "\u05E7\u05E6\u05E8"} \u05DE\u05D3\u05D9: ${O} \u05E6\u05E8\u05D9\u05DB\u05D4 \u05DC\u05D4\u05DB\u05D9\u05DC ${G.minimum.toString()} ${K?.unit ?? ""} ${G.inclusive ? "\u05D0\u05D5 \u05D9\u05D5\u05EA\u05E8" : "\u05DC\u05E4\u05D7\u05D5\u05EA"}`.trim();
        if (G.origin === "number") {
          let B = G.inclusive
            ? `\u05D2\u05D3\u05D5\u05DC \u05D0\u05D5 \u05E9\u05D5\u05D5\u05D4 \u05DC-${G.minimum}`
            : `\u05D2\u05D3\u05D5\u05DC \u05DE-${G.minimum}`;
          return `\u05E7\u05D8\u05DF \u05DE\u05D3\u05D9: ${O} \u05E6\u05E8\u05D9\u05DA \u05DC\u05D4\u05D9\u05D5\u05EA ${B}`;
        }
        if (G.origin === "array" || G.origin === "set") {
          let B = G.origin === "set" ? "\u05E6\u05E8\u05D9\u05DB\u05D4" : "\u05E6\u05E8\u05D9\u05DA";
          if (G.minimum === 1 && G.inclusive) {
            let z =
              G.origin === "set"
                ? "\u05DC\u05E4\u05D7\u05D5\u05EA \u05E4\u05E8\u05D9\u05D8 \u05D0\u05D7\u05D3"
                : "\u05DC\u05E4\u05D7\u05D5\u05EA \u05E4\u05E8\u05D9\u05D8 \u05D0\u05D7\u05D3";
            return `\u05E7\u05D8\u05DF \u05DE\u05D3\u05D9: ${O} ${B} \u05DC\u05D4\u05DB\u05D9\u05DC ${z}`;
          }
          let E = G.inclusive
            ? `${G.minimum} ${K?.unit ?? ""} \u05D0\u05D5 \u05D9\u05D5\u05EA\u05E8`
            : `\u05D9\u05D5\u05EA\u05E8 \u05DE-${G.minimum} ${K?.unit ?? ""}`;
          return `\u05E7\u05D8\u05DF \u05DE\u05D3\u05D9: ${O} ${B} \u05DC\u05D4\u05DB\u05D9\u05DC ${E}`.trim();
        }
        let N = G.inclusive ? ">=" : ">",
          F = X(G.origin ?? "value");
        if (K?.unit) return `${K.shortLabel} \u05DE\u05D3\u05D9: ${O} ${F} ${N}${G.minimum.toString()} ${K.unit}`;
        return `${K?.shortLabel ?? "\u05E7\u05D8\u05DF"} \u05DE\u05D3\u05D9: ${O} ${F} ${N}${G.minimum.toString()}`;
      }
      case "invalid_format": {
        let K = G;
        if (K.format === "starts_with")
          return `\u05D4\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D7\u05D9\u05D9\u05D1\u05EA \u05DC\u05D4\u05EA\u05D7\u05D9\u05DC \u05D1 "${K.prefix}"`;
        if (K.format === "ends_with")
          return `\u05D4\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D7\u05D9\u05D9\u05D1\u05EA \u05DC\u05D4\u05E1\u05EA\u05D9\u05D9\u05DD \u05D1 "${K.suffix}"`;
        if (K.format === "includes")
          return `\u05D4\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D7\u05D9\u05D9\u05D1\u05EA \u05DC\u05DB\u05DC\u05D5\u05DC "${K.includes}"`;
        if (K.format === "regex")
          return `\u05D4\u05DE\u05D7\u05E8\u05D5\u05D6\u05EA \u05D7\u05D9\u05D9\u05D1\u05EA \u05DC\u05D4\u05EA\u05D0\u05D9\u05DD \u05DC\u05EA\u05D1\u05E0\u05D9\u05EA ${K.pattern}`;
        let O = D[K.format],
          N = O?.label ?? K.format,
          B = (O?.gender ?? "m") === "f" ? "\u05EA\u05E7\u05D9\u05E0\u05D4" : "\u05EA\u05E7\u05D9\u05DF";
        return `${N} \u05DC\u05D0 ${B}`;
      }
      case "not_multiple_of":
        return `\u05DE\u05E1\u05E4\u05E8 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF: \u05D7\u05D9\u05D9\u05D1 \u05DC\u05D4\u05D9\u05D5\u05EA \u05DE\u05DB\u05E4\u05DC\u05D4 \u05E9\u05DC ${G.divisor}`;
      case "unrecognized_keys":
        return `\u05DE\u05E4\u05EA\u05D7${G.keys.length > 1 ? "\u05D5\u05EA" : ""} \u05DC\u05D0 \u05DE\u05D6\u05D5\u05D4${G.keys.length > 1 ? "\u05D9\u05DD" : "\u05D4"}: ${p(G.keys, ", ")}`;
      case "invalid_key":
        return "\u05E9\u05D3\u05D4 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF \u05D1\u05D0\u05D5\u05D1\u05D9\u05D9\u05E7\u05D8";
      case "invalid_union":
        return "\u05E7\u05DC\u05D8 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF";
      case "invalid_element":
        return `\u05E2\u05E8\u05DA \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF \u05D1${W(G.origin ?? "array")}`;
      default:
        return "\u05E7\u05DC\u05D8 \u05DC\u05D0 \u05EA\u05E7\u05D9\u05DF";
    }
  };
};
function y4() {
  return { localeError: ZC() };
}
var PC = () => {
  let $ = {
    string: { unit: "znakova", verb: "imati" },
    file: { unit: "bajtova", verb: "imati" },
    array: { unit: "stavki", verb: "imati" },
    set: { unit: "stavki", verb: "imati" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "unos",
      email: "email adresa",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO datum i vrijeme",
      date: "ISO datum",
      time: "ISO vrijeme",
      duration: "ISO trajanje",
      ipv4: "IPv4 adresa",
      ipv6: "IPv6 adresa",
      cidrv4: "IPv4 raspon",
      cidrv6: "IPv6 raspon",
      base64: "base64 kodirani tekst",
      base64url: "base64url kodirani tekst",
      json_string: "JSON tekst",
      e164: "E.164 broj",
      jwt: "JWT",
      template_literal: "unos",
    },
    Q = {
      nan: "NaN",
      string: "tekst",
      number: "broj",
      boolean: "boolean",
      array: "niz",
      object: "objekt",
      set: "skup",
      file: "datoteka",
      date: "datum",
      bigint: "bigint",
      symbol: "simbol",
      undefined: "undefined",
      null: "null",
      function: "funkcija",
      map: "mapa",
    };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `Neispravan unos: o\u010Dekuje se instanceof ${W.expected}, a primljeno je ${D}`;
        return `Neispravan unos: o\u010Dekuje se ${X}, a primljeno je ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Neispravna vrijednost: o\u010Dekivano ${$$(W.values[0])}`;
        return `Neispravna opcija: o\u010Dekivano jedno od ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin),
          D = Q[W.origin] ?? W.origin;
        if (Y)
          return `Preveliko: o\u010Dekivano da ${D ?? "vrijednost"} ima ${X}${W.maximum.toString()} ${Y.unit ?? "elemenata"}`;
        return `Preveliko: o\u010Dekivano da ${D ?? "vrijednost"} bude ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin),
          D = Q[W.origin] ?? W.origin;
        if (Y) return `Premalo: o\u010Dekivano da ${D} ima ${X}${W.minimum.toString()} ${Y.unit}`;
        return `Premalo: o\u010Dekivano da ${D} bude ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `Neispravan tekst: mora zapo\u010Dinjati s "${X.prefix}"`;
        if (X.format === "ends_with") return `Neispravan tekst: mora zavr\u0161avati s "${X.suffix}"`;
        if (X.format === "includes") return `Neispravan tekst: mora sadr\u017Eavati "${X.includes}"`;
        if (X.format === "regex") return `Neispravan tekst: mora odgovarati uzorku ${X.pattern}`;
        return `Neispravna ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `Neispravan broj: mora biti vi\u0161ekratnik od ${W.divisor}`;
      case "unrecognized_keys":
        return `Neprepoznat${W.keys.length > 1 ? "i klju\u010Devi" : " klju\u010D"}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `Neispravan klju\u010D u ${Q[W.origin] ?? W.origin}`;
      case "invalid_union":
        return "Neispravan unos";
      case "invalid_element":
        return `Neispravna vrijednost u ${Q[W.origin] ?? W.origin}`;
      default:
        return "Neispravan unos";
    }
  };
};
function x4() {
  return { localeError: PC() };
}
var _C = () => {
  let $ = {
    string: { unit: "karakter", verb: "legyen" },
    file: { unit: "byte", verb: "legyen" },
    array: { unit: "elem", verb: "legyen" },
    set: { unit: "elem", verb: "legyen" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "bemenet",
      email: "email c\xEDm",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO id\u0151b\xE9lyeg",
      date: "ISO d\xE1tum",
      time: "ISO id\u0151",
      duration: "ISO id\u0151intervallum",
      ipv4: "IPv4 c\xEDm",
      ipv6: "IPv6 c\xEDm",
      cidrv4: "IPv4 tartom\xE1ny",
      cidrv6: "IPv6 tartom\xE1ny",
      base64: "base64-k\xF3dolt string",
      base64url: "base64url-k\xF3dolt string",
      json_string: "JSON string",
      e164: "E.164 sz\xE1m",
      jwt: "JWT",
      template_literal: "bemenet",
    },
    Q = { nan: "NaN", number: "sz\xE1m", array: "t\xF6mb" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `\xC9rv\xE9nytelen bemenet: a v\xE1rt \xE9rt\xE9k instanceof ${W.expected}, a kapott \xE9rt\xE9k ${D}`;
        return `\xC9rv\xE9nytelen bemenet: a v\xE1rt \xE9rt\xE9k ${X}, a kapott \xE9rt\xE9k ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `\xC9rv\xE9nytelen bemenet: a v\xE1rt \xE9rt\xE9k ${$$(W.values[0])}`;
        return `\xC9rv\xE9nytelen opci\xF3: valamelyik \xE9rt\xE9k v\xE1rt ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `T\xFAl nagy: ${W.origin ?? "\xE9rt\xE9k"} m\xE9rete t\xFAl nagy ${X}${W.maximum.toString()} ${Y.unit ?? "elem"}`;
        return `T\xFAl nagy: a bemeneti \xE9rt\xE9k ${W.origin ?? "\xE9rt\xE9k"} t\xFAl nagy: ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y)
          return `T\xFAl kicsi: a bemeneti \xE9rt\xE9k ${W.origin} m\xE9rete t\xFAl kicsi ${X}${W.minimum.toString()} ${Y.unit}`;
        return `T\xFAl kicsi: a bemeneti \xE9rt\xE9k ${W.origin} t\xFAl kicsi ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `\xC9rv\xE9nytelen string: "${X.prefix}" \xE9rt\xE9kkel kell kezd\u0151dnie`;
        if (X.format === "ends_with")
          return `\xC9rv\xE9nytelen string: "${X.suffix}" \xE9rt\xE9kkel kell v\xE9gz\u0151dnie`;
        if (X.format === "includes") return `\xC9rv\xE9nytelen string: "${X.includes}" \xE9rt\xE9ket kell tartalmaznia`;
        if (X.format === "regex") return `\xC9rv\xE9nytelen string: ${X.pattern} mint\xE1nak kell megfelelnie`;
        return `\xC9rv\xE9nytelen ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `\xC9rv\xE9nytelen sz\xE1m: ${W.divisor} t\xF6bbsz\xF6r\xF6s\xE9nek kell lennie`;
      case "unrecognized_keys":
        return `Ismeretlen kulcs${W.keys.length > 1 ? "s" : ""}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `\xC9rv\xE9nytelen kulcs ${W.origin}`;
      case "invalid_union":
        return "\xC9rv\xE9nytelen bemenet";
      case "invalid_element":
        return `\xC9rv\xE9nytelen \xE9rt\xE9k: ${W.origin}`;
      default:
        return "\xC9rv\xE9nytelen bemenet";
    }
  };
};
function g4() {
  return { localeError: _C() };
}
function Jw($, J, U) {
  return Math.abs($) === 1 ? J : U;
}
function wW($) {
  if (!$) return "";
  let J = ["\u0561", "\u0565", "\u0568", "\u056B", "\u0578", "\u0578\u0582", "\u0585"],
    U = $[$.length - 1];
  return $ + (J.includes(U) ? "\u0576" : "\u0568");
}
var SC = () => {
  let $ = {
    string: {
      unit: { one: "\u0576\u0577\u0561\u0576", many: "\u0576\u0577\u0561\u0576\u0576\u0565\u0580" },
      verb: "\u0578\u0582\u0576\u0565\u0576\u0561\u056C",
    },
    file: {
      unit: { one: "\u0562\u0561\u0575\u0569", many: "\u0562\u0561\u0575\u0569\u0565\u0580" },
      verb: "\u0578\u0582\u0576\u0565\u0576\u0561\u056C",
    },
    array: {
      unit: { one: "\u057F\u0561\u0580\u0580", many: "\u057F\u0561\u0580\u0580\u0565\u0580" },
      verb: "\u0578\u0582\u0576\u0565\u0576\u0561\u056C",
    },
    set: {
      unit: { one: "\u057F\u0561\u0580\u0580", many: "\u057F\u0561\u0580\u0580\u0565\u0580" },
      verb: "\u0578\u0582\u0576\u0565\u0576\u0561\u056C",
    },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "\u0574\u0578\u0582\u057F\u0584",
      email: "\u0567\u056C. \u0570\u0561\u057D\u0581\u0565",
      url: "URL",
      emoji: "\u0567\u0574\u0578\u057B\u056B",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO \u0561\u0574\u057D\u0561\u0569\u056B\u057E \u0587 \u056A\u0561\u0574",
      date: "ISO \u0561\u0574\u057D\u0561\u0569\u056B\u057E",
      time: "ISO \u056A\u0561\u0574",
      duration: "ISO \u057F\u0587\u0578\u0572\u0578\u0582\u0569\u0575\u0578\u0582\u0576",
      ipv4: "IPv4 \u0570\u0561\u057D\u0581\u0565",
      ipv6: "IPv6 \u0570\u0561\u057D\u0581\u0565",
      cidrv4: "IPv4 \u0574\u056B\u057B\u0561\u056F\u0561\u0575\u0584",
      cidrv6: "IPv6 \u0574\u056B\u057B\u0561\u056F\u0561\u0575\u0584",
      base64: "base64 \u0571\u0587\u0561\u0579\u0561\u0583\u0578\u057E \u057F\u0578\u0572",
      base64url: "base64url \u0571\u0587\u0561\u0579\u0561\u0583\u0578\u057E \u057F\u0578\u0572",
      json_string: "JSON \u057F\u0578\u0572",
      e164: "E.164 \u0570\u0561\u0574\u0561\u0580",
      jwt: "JWT",
      template_literal: "\u0574\u0578\u0582\u057F\u0584",
    },
    Q = { nan: "NaN", number: "\u0569\u056B\u057E", array: "\u0566\u0561\u0576\u0563\u057E\u0561\u056E" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `\u054D\u056D\u0561\u056C \u0574\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0578\u0582\u0574\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567\u0580 instanceof ${W.expected}, \u057D\u057F\u0561\u0581\u057E\u0565\u056C \u0567 ${D}`;
        return `\u054D\u056D\u0561\u056C \u0574\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0578\u0582\u0574\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567\u0580 ${X}, \u057D\u057F\u0561\u0581\u057E\u0565\u056C \u0567 ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1)
          return `\u054D\u056D\u0561\u056C \u0574\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0578\u0582\u0574\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567\u0580 ${$$(W.values[1])}`;
        return `\u054D\u056D\u0561\u056C \u057F\u0561\u0580\u0562\u0565\u0580\u0561\u056F\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567\u0580 \u0570\u0565\u057F\u0587\u0575\u0561\u056C\u0576\u0565\u0580\u056B\u0581 \u0574\u0565\u056F\u0568\u055D ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y) {
          let D = Number(W.maximum),
            H = Jw(D, Y.unit.one, Y.unit.many);
          return `\u0549\u0561\u0583\u0561\u0566\u0561\u0576\u0581 \u0574\u0565\u056E \u0561\u0580\u056A\u0565\u0584\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567, \u0578\u0580 ${wW(W.origin ?? "\u0561\u0580\u056A\u0565\u0584")} \u056F\u0578\u0582\u0576\u0565\u0576\u0561 ${X}${W.maximum.toString()} ${H}`;
        }
        return `\u0549\u0561\u0583\u0561\u0566\u0561\u0576\u0581 \u0574\u0565\u056E \u0561\u0580\u056A\u0565\u0584\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567, \u0578\u0580 ${wW(W.origin ?? "\u0561\u0580\u056A\u0565\u0584")} \u056C\u056B\u0576\u056B ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y) {
          let D = Number(W.minimum),
            H = Jw(D, Y.unit.one, Y.unit.many);
          return `\u0549\u0561\u0583\u0561\u0566\u0561\u0576\u0581 \u0583\u0578\u0584\u0580 \u0561\u0580\u056A\u0565\u0584\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567, \u0578\u0580 ${wW(W.origin)} \u056F\u0578\u0582\u0576\u0565\u0576\u0561 ${X}${W.minimum.toString()} ${H}`;
        }
        return `\u0549\u0561\u0583\u0561\u0566\u0561\u0576\u0581 \u0583\u0578\u0584\u0580 \u0561\u0580\u056A\u0565\u0584\u2024 \u057D\u057A\u0561\u057D\u057E\u0578\u0582\u0574 \u0567, \u0578\u0580 ${wW(W.origin)} \u056C\u056B\u0576\u056B ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `\u054D\u056D\u0561\u056C \u057F\u0578\u0572\u2024 \u057A\u0565\u057F\u0584 \u0567 \u057D\u056F\u057D\u057E\u056B "${X.prefix}"-\u0578\u057E`;
        if (X.format === "ends_with")
          return `\u054D\u056D\u0561\u056C \u057F\u0578\u0572\u2024 \u057A\u0565\u057F\u0584 \u0567 \u0561\u057E\u0561\u0580\u057F\u057E\u056B "${X.suffix}"-\u0578\u057E`;
        if (X.format === "includes")
          return `\u054D\u056D\u0561\u056C \u057F\u0578\u0572\u2024 \u057A\u0565\u057F\u0584 \u0567 \u057A\u0561\u0580\u0578\u0582\u0576\u0561\u056F\u056B "${X.includes}"`;
        if (X.format === "regex")
          return `\u054D\u056D\u0561\u056C \u057F\u0578\u0572\u2024 \u057A\u0565\u057F\u0584 \u0567 \u0570\u0561\u0574\u0561\u057A\u0561\u057F\u0561\u057D\u056D\u0561\u0576\u056B ${X.pattern} \u0571\u0587\u0561\u0579\u0561\u0583\u056B\u0576`;
        return `\u054D\u056D\u0561\u056C ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `\u054D\u056D\u0561\u056C \u0569\u056B\u057E\u2024 \u057A\u0565\u057F\u0584 \u0567 \u0562\u0561\u0566\u0574\u0561\u057A\u0561\u057F\u056B\u056F \u056C\u056B\u0576\u056B ${W.divisor}-\u056B`;
      case "unrecognized_keys":
        return `\u0549\u0573\u0561\u0576\u0561\u0579\u057E\u0561\u056E \u0562\u0561\u0576\u0561\u056C\u056B${W.keys.length > 1 ? "\u0576\u0565\u0580" : ""}. ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `\u054D\u056D\u0561\u056C \u0562\u0561\u0576\u0561\u056C\u056B ${wW(W.origin)}-\u0578\u0582\u0574`;
      case "invalid_union":
        return "\u054D\u056D\u0561\u056C \u0574\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0578\u0582\u0574";
      case "invalid_element":
        return `\u054D\u056D\u0561\u056C \u0561\u0580\u056A\u0565\u0584 ${wW(W.origin)}-\u0578\u0582\u0574`;
      default:
        return "\u054D\u056D\u0561\u056C \u0574\u0578\u0582\u057F\u0584\u0561\u0563\u0580\u0578\u0582\u0574";
    }
  };
};
function h4() {
  return { localeError: SC() };
}
var CC = () => {
  let $ = {
    string: { unit: "karakter", verb: "memiliki" },
    file: { unit: "byte", verb: "memiliki" },
    array: { unit: "item", verb: "memiliki" },
    set: { unit: "item", verb: "memiliki" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "input",
      email: "alamat email",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "tanggal dan waktu format ISO",
      date: "tanggal format ISO",
      time: "jam format ISO",
      duration: "durasi format ISO",
      ipv4: "alamat IPv4",
      ipv6: "alamat IPv6",
      cidrv4: "rentang alamat IPv4",
      cidrv6: "rentang alamat IPv6",
      base64: "string dengan enkode base64",
      base64url: "string dengan enkode base64url",
      json_string: "string JSON",
      e164: "angka E.164",
      jwt: "JWT",
      template_literal: "input",
    },
    Q = { nan: "NaN" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected)) return `Input tidak valid: diharapkan instanceof ${W.expected}, diterima ${D}`;
        return `Input tidak valid: diharapkan ${X}, diterima ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Input tidak valid: diharapkan ${$$(W.values[0])}`;
        return `Pilihan tidak valid: diharapkan salah satu dari ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `Terlalu besar: diharapkan ${W.origin ?? "value"} memiliki ${X}${W.maximum.toString()} ${Y.unit ?? "elemen"}`;
        return `Terlalu besar: diharapkan ${W.origin ?? "value"} menjadi ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y) return `Terlalu kecil: diharapkan ${W.origin} memiliki ${X}${W.minimum.toString()} ${Y.unit}`;
        return `Terlalu kecil: diharapkan ${W.origin} menjadi ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `String tidak valid: harus dimulai dengan "${X.prefix}"`;
        if (X.format === "ends_with") return `String tidak valid: harus berakhir dengan "${X.suffix}"`;
        if (X.format === "includes") return `String tidak valid: harus menyertakan "${X.includes}"`;
        if (X.format === "regex") return `String tidak valid: harus sesuai pola ${X.pattern}`;
        return `${U[X.format] ?? W.format} tidak valid`;
      }
      case "not_multiple_of":
        return `Angka tidak valid: harus kelipatan dari ${W.divisor}`;
      case "unrecognized_keys":
        return `Kunci tidak dikenali ${W.keys.length > 1 ? "s" : ""}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `Kunci tidak valid di ${W.origin}`;
      case "invalid_union":
        return "Input tidak valid";
      case "invalid_element":
        return `Nilai tidak valid di ${W.origin}`;
      default:
        return "Input tidak valid";
    }
  };
};
function u4() {
  return { localeError: CC() };
}
var TC = () => {
  let $ = {
    string: { unit: "stafi", verb: "a\xF0 hafa" },
    file: { unit: "b\xE6ti", verb: "a\xF0 hafa" },
    array: { unit: "hluti", verb: "a\xF0 hafa" },
    set: { unit: "hluti", verb: "a\xF0 hafa" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "gildi",
      email: "netfang",
      url: "vefsl\xF3\xF0",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO dagsetning og t\xEDmi",
      date: "ISO dagsetning",
      time: "ISO t\xEDmi",
      duration: "ISO t\xEDmalengd",
      ipv4: "IPv4 address",
      ipv6: "IPv6 address",
      cidrv4: "IPv4 range",
      cidrv6: "IPv6 range",
      base64: "base64-encoded strengur",
      base64url: "base64url-encoded strengur",
      json_string: "JSON strengur",
      e164: "E.164 t\xF6lugildi",
      jwt: "JWT",
      template_literal: "gildi",
    },
    Q = { nan: "NaN", number: "n\xFAmer", array: "fylki" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `Rangt gildi: \xDE\xFA sl\xF3st inn ${D} \xFEar sem \xE1 a\xF0 vera instanceof ${W.expected}`;
        return `Rangt gildi: \xDE\xFA sl\xF3st inn ${D} \xFEar sem \xE1 a\xF0 vera ${X}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Rangt gildi: gert r\xE1\xF0 fyrir ${$$(W.values[0])}`;
        return `\xD3gilt val: m\xE1 vera eitt af eftirfarandi ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `Of st\xF3rt: gert er r\xE1\xF0 fyrir a\xF0 ${W.origin ?? "gildi"} hafi ${X}${W.maximum.toString()} ${Y.unit ?? "hluti"}`;
        return `Of st\xF3rt: gert er r\xE1\xF0 fyrir a\xF0 ${W.origin ?? "gildi"} s\xE9 ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y)
          return `Of l\xEDti\xF0: gert er r\xE1\xF0 fyrir a\xF0 ${W.origin} hafi ${X}${W.minimum.toString()} ${Y.unit}`;
        return `Of l\xEDti\xF0: gert er r\xE1\xF0 fyrir a\xF0 ${W.origin} s\xE9 ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `\xD3gildur strengur: ver\xF0ur a\xF0 byrja \xE1 "${X.prefix}"`;
        if (X.format === "ends_with") return `\xD3gildur strengur: ver\xF0ur a\xF0 enda \xE1 "${X.suffix}"`;
        if (X.format === "includes") return `\xD3gildur strengur: ver\xF0ur a\xF0 innihalda "${X.includes}"`;
        if (X.format === "regex") return `\xD3gildur strengur: ver\xF0ur a\xF0 fylgja mynstri ${X.pattern}`;
        return `Rangt ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `R\xF6ng tala: ver\xF0ur a\xF0 vera margfeldi af ${W.divisor}`;
      case "unrecognized_keys":
        return `\xD3\xFEekkt ${W.keys.length > 1 ? "ir lyklar" : "ur lykill"}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `Rangur lykill \xED ${W.origin}`;
      case "invalid_union":
        return "Rangt gildi";
      case "invalid_element":
        return `Rangt gildi \xED ${W.origin}`;
      default:
        return "Rangt gildi";
    }
  };
};
function l4() {
  return { localeError: TC() };
}
var jC = () => {
  let $ = {
    string: { unit: "caratteri", verb: "avere" },
    file: { unit: "byte", verb: "avere" },
    array: { unit: "elementi", verb: "avere" },
    set: { unit: "elementi", verb: "avere" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "input",
      email: "indirizzo email",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "data e ora ISO",
      date: "data ISO",
      time: "ora ISO",
      duration: "durata ISO",
      ipv4: "indirizzo IPv4",
      ipv6: "indirizzo IPv6",
      cidrv4: "intervallo IPv4",
      cidrv6: "intervallo IPv6",
      base64: "stringa codificata in base64",
      base64url: "URL codificata in base64",
      json_string: "stringa JSON",
      e164: "numero E.164",
      jwt: "JWT",
      template_literal: "input",
    },
    Q = { nan: "NaN", number: "numero", array: "vettore" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected)) return `Input non valido: atteso instanceof ${W.expected}, ricevuto ${D}`;
        return `Input non valido: atteso ${X}, ricevuto ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Input non valido: atteso ${$$(W.values[0])}`;
        return `Opzione non valida: atteso uno tra ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `Troppo grande: ${W.origin ?? "valore"} deve avere ${X}${W.maximum.toString()} ${Y.unit ?? "elementi"}`;
        return `Troppo grande: ${W.origin ?? "valore"} deve essere ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y) return `Troppo piccolo: ${W.origin} deve avere ${X}${W.minimum.toString()} ${Y.unit}`;
        return `Troppo piccolo: ${W.origin} deve essere ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `Stringa non valida: deve iniziare con "${X.prefix}"`;
        if (X.format === "ends_with") return `Stringa non valida: deve terminare con "${X.suffix}"`;
        if (X.format === "includes") return `Stringa non valida: deve includere "${X.includes}"`;
        if (X.format === "regex") return `Stringa non valida: deve corrispondere al pattern ${X.pattern}`;
        return `Input non valido: ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `Numero non valido: deve essere un multiplo di ${W.divisor}`;
      case "unrecognized_keys":
        return `Chiav${W.keys.length > 1 ? "i" : "e"} non riconosciut${W.keys.length > 1 ? "e" : "a"}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `Chiave non valida in ${W.origin}`;
      case "invalid_union":
        return "Input non valido";
      case "invalid_element":
        return `Valore non valido in ${W.origin}`;
      default:
        return "Input non valido";
    }
  };
};
function m4() {
  return { localeError: jC() };
}
var vC = () => {
  let $ = {
    string: { unit: "\u6587\u5B57", verb: "\u3067\u3042\u308B" },
    file: { unit: "\u30D0\u30A4\u30C8", verb: "\u3067\u3042\u308B" },
    array: { unit: "\u8981\u7D20", verb: "\u3067\u3042\u308B" },
    set: { unit: "\u8981\u7D20", verb: "\u3067\u3042\u308B" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "\u5165\u529B\u5024",
      email: "\u30E1\u30FC\u30EB\u30A2\u30C9\u30EC\u30B9",
      url: "URL",
      emoji: "\u7D75\u6587\u5B57",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO\u65E5\u6642",
      date: "ISO\u65E5\u4ED8",
      time: "ISO\u6642\u523B",
      duration: "ISO\u671F\u9593",
      ipv4: "IPv4\u30A2\u30C9\u30EC\u30B9",
      ipv6: "IPv6\u30A2\u30C9\u30EC\u30B9",
      cidrv4: "IPv4\u7BC4\u56F2",
      cidrv6: "IPv6\u7BC4\u56F2",
      base64: "base64\u30A8\u30F3\u30B3\u30FC\u30C9\u6587\u5B57\u5217",
      base64url: "base64url\u30A8\u30F3\u30B3\u30FC\u30C9\u6587\u5B57\u5217",
      json_string: "JSON\u6587\u5B57\u5217",
      e164: "E.164\u756A\u53F7",
      jwt: "JWT",
      template_literal: "\u5165\u529B\u5024",
    },
    Q = { nan: "NaN", number: "\u6570\u5024", array: "\u914D\u5217" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `\u7121\u52B9\u306A\u5165\u529B: instanceof ${W.expected}\u304C\u671F\u5F85\u3055\u308C\u307E\u3057\u305F\u304C\u3001${D}\u304C\u5165\u529B\u3055\u308C\u307E\u3057\u305F`;
        return `\u7121\u52B9\u306A\u5165\u529B: ${X}\u304C\u671F\u5F85\u3055\u308C\u307E\u3057\u305F\u304C\u3001${D}\u304C\u5165\u529B\u3055\u308C\u307E\u3057\u305F`;
      }
      case "invalid_value":
        if (W.values.length === 1)
          return `\u7121\u52B9\u306A\u5165\u529B: ${$$(W.values[0])}\u304C\u671F\u5F85\u3055\u308C\u307E\u3057\u305F`;
        return `\u7121\u52B9\u306A\u9078\u629E: ${p(W.values, "\u3001")}\u306E\u3044\u305A\u308C\u304B\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
      case "too_big": {
        let X = W.inclusive ? "\u4EE5\u4E0B\u3067\u3042\u308B" : "\u3088\u308A\u5C0F\u3055\u3044",
          Y = J(W.origin);
        if (Y)
          return `\u5927\u304D\u3059\u304E\u308B\u5024: ${W.origin ?? "\u5024"}\u306F${W.maximum.toString()}${Y.unit ?? "\u8981\u7D20"}${X}\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
        return `\u5927\u304D\u3059\u304E\u308B\u5024: ${W.origin ?? "\u5024"}\u306F${W.maximum.toString()}${X}\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
      }
      case "too_small": {
        let X = W.inclusive ? "\u4EE5\u4E0A\u3067\u3042\u308B" : "\u3088\u308A\u5927\u304D\u3044",
          Y = J(W.origin);
        if (Y)
          return `\u5C0F\u3055\u3059\u304E\u308B\u5024: ${W.origin}\u306F${W.minimum.toString()}${Y.unit}${X}\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
        return `\u5C0F\u3055\u3059\u304E\u308B\u5024: ${W.origin}\u306F${W.minimum.toString()}${X}\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `\u7121\u52B9\u306A\u6587\u5B57\u5217: "${X.prefix}"\u3067\u59CB\u307E\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
        if (X.format === "ends_with")
          return `\u7121\u52B9\u306A\u6587\u5B57\u5217: "${X.suffix}"\u3067\u7D42\u308F\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
        if (X.format === "includes")
          return `\u7121\u52B9\u306A\u6587\u5B57\u5217: "${X.includes}"\u3092\u542B\u3080\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
        if (X.format === "regex")
          return `\u7121\u52B9\u306A\u6587\u5B57\u5217: \u30D1\u30BF\u30FC\u30F3${X.pattern}\u306B\u4E00\u81F4\u3059\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
        return `\u7121\u52B9\u306A${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `\u7121\u52B9\u306A\u6570\u5024: ${W.divisor}\u306E\u500D\u6570\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059`;
      case "unrecognized_keys":
        return `\u8A8D\u8B58\u3055\u308C\u3066\u3044\u306A\u3044\u30AD\u30FC${W.keys.length > 1 ? "\u7FA4" : ""}: ${p(W.keys, "\u3001")}`;
      case "invalid_key":
        return `${W.origin}\u5185\u306E\u7121\u52B9\u306A\u30AD\u30FC`;
      case "invalid_union":
        return "\u7121\u52B9\u306A\u5165\u529B";
      case "invalid_element":
        return `${W.origin}\u5185\u306E\u7121\u52B9\u306A\u5024`;
      default:
        return "\u7121\u52B9\u306A\u5165\u529B";
    }
  };
};
function p4() {
  return { localeError: vC() };
}
var bC = () => {
  let $ = {
    string: {
      unit: "\u10E1\u10D8\u10DB\u10D1\u10DD\u10DA\u10DD",
      verb: "\u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D8\u10EA\u10D0\u10D5\u10D3\u10D4\u10E1",
    },
    file: {
      unit: "\u10D1\u10D0\u10D8\u10E2\u10D8",
      verb: "\u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D8\u10EA\u10D0\u10D5\u10D3\u10D4\u10E1",
    },
    array: {
      unit: "\u10D4\u10DA\u10D4\u10DB\u10D4\u10DC\u10E2\u10D8",
      verb: "\u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D8\u10EA\u10D0\u10D5\u10D3\u10D4\u10E1",
    },
    set: {
      unit: "\u10D4\u10DA\u10D4\u10DB\u10D4\u10DC\u10E2\u10D8",
      verb: "\u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D8\u10EA\u10D0\u10D5\u10D3\u10D4\u10E1",
    },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "\u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0",
      email: "\u10D4\u10DA-\u10E4\u10DD\u10E1\u10E2\u10D8\u10E1 \u10DB\u10D8\u10E1\u10D0\u10DB\u10D0\u10E0\u10D7\u10D8",
      url: "URL",
      emoji: "\u10D4\u10DB\u10DD\u10EF\u10D8",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "\u10D7\u10D0\u10E0\u10D8\u10E6\u10D8-\u10D3\u10E0\u10DD",
      date: "\u10D7\u10D0\u10E0\u10D8\u10E6\u10D8",
      time: "\u10D3\u10E0\u10DD",
      duration: "\u10EE\u10D0\u10DC\u10D2\u10E0\u10EB\u10DA\u10D8\u10D5\u10DD\u10D1\u10D0",
      ipv4: "IPv4 \u10DB\u10D8\u10E1\u10D0\u10DB\u10D0\u10E0\u10D7\u10D8",
      ipv6: "IPv6 \u10DB\u10D8\u10E1\u10D0\u10DB\u10D0\u10E0\u10D7\u10D8",
      cidrv4: "IPv4 \u10D3\u10D8\u10D0\u10DE\u10D0\u10D6\u10DD\u10DC\u10D8",
      cidrv6: "IPv6 \u10D3\u10D8\u10D0\u10DE\u10D0\u10D6\u10DD\u10DC\u10D8",
      base64: "base64-\u10D9\u10DD\u10D3\u10D8\u10E0\u10D4\u10D1\u10E3\u10DA\u10D8 \u10D5\u10D4\u10DA\u10D8",
      base64url: "base64url-\u10D9\u10DD\u10D3\u10D8\u10E0\u10D4\u10D1\u10E3\u10DA\u10D8 \u10D5\u10D4\u10DA\u10D8",
      json_string: "JSON \u10D5\u10D4\u10DA\u10D8",
      e164: "E.164 \u10DC\u10DD\u10DB\u10D4\u10E0\u10D8",
      jwt: "JWT",
      template_literal: "\u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0",
    },
    Q = {
      nan: "NaN",
      number: "\u10E0\u10D8\u10EA\u10EE\u10D5\u10D8",
      string: "\u10D5\u10D4\u10DA\u10D8",
      boolean: "\u10D1\u10E3\u10DA\u10D4\u10D0\u10DC\u10D8",
      function: "\u10E4\u10E3\u10DC\u10E5\u10EA\u10D8\u10D0",
      array: "\u10DB\u10D0\u10E1\u10D8\u10D5\u10D8",
    };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 instanceof ${W.expected}, \u10DB\u10D8\u10E6\u10D4\u10D1\u10E3\u10DA\u10D8 ${D}`;
        return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${X}, \u10DB\u10D8\u10E6\u10D4\u10D1\u10E3\u10DA\u10D8 ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1)
          return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${$$(W.values[0])}`;
        return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10D5\u10D0\u10E0\u10D8\u10D0\u10DC\u10E2\u10D8: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8\u10D0 \u10D4\u10E0\u10D7-\u10D4\u10E0\u10D7\u10D8 ${p(W.values, "|")}-\u10D3\u10D0\u10DC`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `\u10D6\u10D4\u10D3\u10DB\u10D4\u10E2\u10D0\u10D3 \u10D3\u10D8\u10D3\u10D8: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${W.origin ?? "\u10DB\u10DC\u10D8\u10E8\u10D5\u10DC\u10D4\u10DA\u10DD\u10D1\u10D0"} ${Y.verb} ${X}${W.maximum.toString()} ${Y.unit}`;
        return `\u10D6\u10D4\u10D3\u10DB\u10D4\u10E2\u10D0\u10D3 \u10D3\u10D8\u10D3\u10D8: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${W.origin ?? "\u10DB\u10DC\u10D8\u10E8\u10D5\u10DC\u10D4\u10DA\u10DD\u10D1\u10D0"} \u10D8\u10E7\u10DD\u10E1 ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y)
          return `\u10D6\u10D4\u10D3\u10DB\u10D4\u10E2\u10D0\u10D3 \u10DE\u10D0\u10E2\u10D0\u10E0\u10D0: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${W.origin} ${Y.verb} ${X}${W.minimum.toString()} ${Y.unit}`;
        return `\u10D6\u10D4\u10D3\u10DB\u10D4\u10E2\u10D0\u10D3 \u10DE\u10D0\u10E2\u10D0\u10E0\u10D0: \u10DB\u10DD\u10E1\u10D0\u10DA\u10DD\u10D3\u10DC\u10D4\u10DA\u10D8 ${W.origin} \u10D8\u10E7\u10DD\u10E1 ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10D5\u10D4\u10DA\u10D8: \u10E3\u10DC\u10D3\u10D0 \u10D8\u10EC\u10E7\u10D4\u10D1\u10DD\u10D3\u10D4\u10E1 "${X.prefix}"-\u10D8\u10D7`;
        if (X.format === "ends_with")
          return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10D5\u10D4\u10DA\u10D8: \u10E3\u10DC\u10D3\u10D0 \u10DB\u10D7\u10D0\u10D5\u10E0\u10D3\u10D4\u10D1\u10DD\u10D3\u10D4\u10E1 "${X.suffix}"-\u10D8\u10D7`;
        if (X.format === "includes")
          return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10D5\u10D4\u10DA\u10D8: \u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D8\u10EA\u10D0\u10D5\u10D3\u10D4\u10E1 "${X.includes}"-\u10E1`;
        if (X.format === "regex")
          return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10D5\u10D4\u10DA\u10D8: \u10E3\u10DC\u10D3\u10D0 \u10E8\u10D4\u10D4\u10E1\u10D0\u10D1\u10D0\u10DB\u10D4\u10D1\u10DD\u10D3\u10D4\u10E1 \u10E8\u10D0\u10D1\u10DA\u10DD\u10DC\u10E1 ${X.pattern}`;
        return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E0\u10D8\u10EA\u10EE\u10D5\u10D8: \u10E3\u10DC\u10D3\u10D0 \u10D8\u10E7\u10DD\u10E1 ${W.divisor}-\u10D8\u10E1 \u10EF\u10D4\u10E0\u10D0\u10D3\u10D8`;
      case "unrecognized_keys":
        return `\u10E3\u10EA\u10DC\u10DD\u10D1\u10D8 \u10D2\u10D0\u10E1\u10D0\u10E6\u10D4\u10D1${W.keys.length > 1 ? "\u10D4\u10D1\u10D8" : "\u10D8"}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10D2\u10D0\u10E1\u10D0\u10E6\u10D4\u10D1\u10D8 ${W.origin}-\u10E8\u10D8`;
      case "invalid_union":
        return "\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0";
      case "invalid_element":
        return `\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10DB\u10DC\u10D8\u10E8\u10D5\u10DC\u10D4\u10DA\u10DD\u10D1\u10D0 ${W.origin}-\u10E8\u10D8`;
      default:
        return "\u10D0\u10E0\u10D0\u10E1\u10EC\u10DD\u10E0\u10D8 \u10E8\u10D4\u10E7\u10D5\u10D0\u10DC\u10D0";
    }
  };
};
function d4() {
  return { localeError: bC() };
}
var fC = () => {
  let $ = {
    string: { unit: "\u178F\u17BD\u17A2\u1780\u17D2\u179F\u179A", verb: "\u1782\u17BD\u179A\u1798\u17B6\u1793" },
    file: { unit: "\u1794\u17C3", verb: "\u1782\u17BD\u179A\u1798\u17B6\u1793" },
    array: { unit: "\u1792\u17B6\u178F\u17BB", verb: "\u1782\u17BD\u179A\u1798\u17B6\u1793" },
    set: { unit: "\u1792\u17B6\u178F\u17BB", verb: "\u1782\u17BD\u179A\u1798\u17B6\u1793" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1794\u1789\u17D2\u1785\u17BC\u179B",
      email: "\u17A2\u17B6\u179F\u1799\u178A\u17D2\u178B\u17B6\u1793\u17A2\u17CA\u17B8\u1798\u17C2\u179B",
      url: "URL",
      emoji: "\u179F\u1789\u17D2\u1789\u17B6\u17A2\u17B6\u179A\u1798\u17D2\u1798\u178E\u17CD",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime:
        "\u1780\u17B6\u179B\u1794\u179A\u17B7\u1785\u17D2\u1786\u17C1\u1791 \u1793\u17B7\u1784\u1798\u17C9\u17C4\u1784 ISO",
      date: "\u1780\u17B6\u179B\u1794\u179A\u17B7\u1785\u17D2\u1786\u17C1\u1791 ISO",
      time: "\u1798\u17C9\u17C4\u1784 ISO",
      duration: "\u179A\u1799\u17C8\u1796\u17C1\u179B ISO",
      ipv4: "\u17A2\u17B6\u179F\u1799\u178A\u17D2\u178B\u17B6\u1793 IPv4",
      ipv6: "\u17A2\u17B6\u179F\u1799\u178A\u17D2\u178B\u17B6\u1793 IPv6",
      cidrv4: "\u178A\u17C2\u1793\u17A2\u17B6\u179F\u1799\u178A\u17D2\u178B\u17B6\u1793 IPv4",
      cidrv6: "\u178A\u17C2\u1793\u17A2\u17B6\u179F\u1799\u178A\u17D2\u178B\u17B6\u1793 IPv6",
      base64: "\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u17A2\u17CA\u17B7\u1780\u17BC\u178A base64",
      base64url: "\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u17A2\u17CA\u17B7\u1780\u17BC\u178A base64url",
      json_string: "\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A JSON",
      e164: "\u179B\u17C1\u1781 E.164",
      jwt: "JWT",
      template_literal: "\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1794\u1789\u17D2\u1785\u17BC\u179B",
    },
    Q = {
      nan: "NaN",
      number: "\u179B\u17C1\u1781",
      array: "\u17A2\u17B6\u179A\u17C1 (Array)",
      null: "\u1782\u17D2\u1798\u17B6\u1793\u178F\u1798\u17D2\u179B\u17C3 (null)",
    };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1794\u1789\u17D2\u1785\u17BC\u179B\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A instanceof ${W.expected} \u1794\u17C9\u17BB\u1793\u17D2\u178F\u17C2\u1791\u1791\u17BD\u179B\u1794\u17B6\u1793 ${D}`;
        return `\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1794\u1789\u17D2\u1785\u17BC\u179B\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${X} \u1794\u17C9\u17BB\u1793\u17D2\u178F\u17C2\u1791\u1791\u17BD\u179B\u1794\u17B6\u1793 ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1)
          return `\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1794\u1789\u17D2\u1785\u17BC\u179B\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${$$(W.values[0])}`;
        return `\u1787\u1798\u17D2\u179A\u17BE\u179F\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1787\u17B6\u1798\u17BD\u1799\u1780\u17D2\u1793\u17BB\u1784\u1785\u17C6\u178E\u17C4\u1798 ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `\u1792\u17C6\u1796\u17C1\u1780\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${W.origin ?? "\u178F\u1798\u17D2\u179B\u17C3"} ${X} ${W.maximum.toString()} ${Y.unit ?? "\u1792\u17B6\u178F\u17BB"}`;
        return `\u1792\u17C6\u1796\u17C1\u1780\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${W.origin ?? "\u178F\u1798\u17D2\u179B\u17C3"} ${X} ${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y)
          return `\u178F\u17BC\u1785\u1796\u17C1\u1780\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${W.origin} ${X} ${W.minimum.toString()} ${Y.unit}`;
        return `\u178F\u17BC\u1785\u1796\u17C1\u1780\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1780\u17B6\u179A ${W.origin} ${X} ${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1785\u17B6\u1794\u17CB\u1795\u17D2\u178F\u17BE\u1798\u178A\u17C4\u1799 "${X.prefix}"`;
        if (X.format === "ends_with")
          return `\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1794\u1789\u17D2\u1785\u1794\u17CB\u178A\u17C4\u1799 "${X.suffix}"`;
        if (X.format === "includes")
          return `\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u1798\u17B6\u1793 "${X.includes}"`;
        if (X.format === "regex")
          return `\u1781\u17D2\u179F\u17C2\u17A2\u1780\u17D2\u179F\u179A\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u178F\u17C2\u1795\u17D2\u1782\u17BC\u1795\u17D2\u1782\u1784\u1793\u17B9\u1784\u1791\u1798\u17D2\u179A\u1784\u17CB\u178A\u17C2\u179B\u1794\u17B6\u1793\u1780\u17C6\u178E\u178F\u17CB ${X.pattern}`;
        return `\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `\u179B\u17C1\u1781\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u17D6 \u178F\u17D2\u179A\u17BC\u179C\u178F\u17C2\u1787\u17B6\u1796\u17A0\u17BB\u1782\u17BB\u178E\u1793\u17C3 ${W.divisor}`;
      case "unrecognized_keys":
        return `\u179A\u1780\u1783\u17BE\u1789\u179F\u17C4\u1798\u17B7\u1793\u179F\u17D2\u1782\u17B6\u179B\u17CB\u17D6 ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `\u179F\u17C4\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u1793\u17C5\u1780\u17D2\u1793\u17BB\u1784 ${W.origin}`;
      case "invalid_union":
        return "\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C";
      case "invalid_element":
        return `\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C\u1793\u17C5\u1780\u17D2\u1793\u17BB\u1784 ${W.origin}`;
      default:
        return "\u1791\u17B7\u1793\u17D2\u1793\u1793\u17D0\u1799\u1798\u17B7\u1793\u178F\u17D2\u179A\u17B9\u1798\u178F\u17D2\u179A\u17BC\u179C";
    }
  };
};
function _7() {
  return { localeError: fC() };
}
function c4() {
  return _7();
}
var yC = () => {
  let $ = {
    string: { unit: "\uBB38\uC790", verb: "to have" },
    file: { unit: "\uBC14\uC774\uD2B8", verb: "to have" },
    array: { unit: "\uAC1C", verb: "to have" },
    set: { unit: "\uAC1C", verb: "to have" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "\uC785\uB825",
      email: "\uC774\uBA54\uC77C \uC8FC\uC18C",
      url: "URL",
      emoji: "\uC774\uBAA8\uC9C0",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO \uB0A0\uC9DC\uC2DC\uAC04",
      date: "ISO \uB0A0\uC9DC",
      time: "ISO \uC2DC\uAC04",
      duration: "ISO \uAE30\uAC04",
      ipv4: "IPv4 \uC8FC\uC18C",
      ipv6: "IPv6 \uC8FC\uC18C",
      cidrv4: "IPv4 \uBC94\uC704",
      cidrv6: "IPv6 \uBC94\uC704",
      base64: "base64 \uC778\uCF54\uB529 \uBB38\uC790\uC5F4",
      base64url: "base64url \uC778\uCF54\uB529 \uBB38\uC790\uC5F4",
      json_string: "JSON \uBB38\uC790\uC5F4",
      e164: "E.164 \uBC88\uD638",
      jwt: "JWT",
      template_literal: "\uC785\uB825",
    },
    Q = { nan: "NaN" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `\uC798\uBABB\uB41C \uC785\uB825: \uC608\uC0C1 \uD0C0\uC785\uC740 instanceof ${W.expected}, \uBC1B\uC740 \uD0C0\uC785\uC740 ${D}\uC785\uB2C8\uB2E4`;
        return `\uC798\uBABB\uB41C \uC785\uB825: \uC608\uC0C1 \uD0C0\uC785\uC740 ${X}, \uBC1B\uC740 \uD0C0\uC785\uC740 ${D}\uC785\uB2C8\uB2E4`;
      }
      case "invalid_value":
        if (W.values.length === 1)
          return `\uC798\uBABB\uB41C \uC785\uB825: \uAC12\uC740 ${$$(W.values[0])} \uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4`;
        return `\uC798\uBABB\uB41C \uC635\uC158: ${p(W.values, "\uB610\uB294 ")} \uC911 \uD558\uB098\uC5EC\uC57C \uD569\uB2C8\uB2E4`;
      case "too_big": {
        let X = W.inclusive ? "\uC774\uD558" : "\uBBF8\uB9CC",
          Y = X === "\uBBF8\uB9CC" ? "\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" : "\uC5EC\uC57C \uD569\uB2C8\uB2E4",
          D = J(W.origin),
          H = D?.unit ?? "\uC694\uC18C";
        if (D)
          return `${W.origin ?? "\uAC12"}\uC774 \uB108\uBB34 \uD07D\uB2C8\uB2E4: ${W.maximum.toString()}${H} ${X}${Y}`;
        return `${W.origin ?? "\uAC12"}\uC774 \uB108\uBB34 \uD07D\uB2C8\uB2E4: ${W.maximum.toString()} ${X}${Y}`;
      }
      case "too_small": {
        let X = W.inclusive ? "\uC774\uC0C1" : "\uCD08\uACFC",
          Y = X === "\uC774\uC0C1" ? "\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" : "\uC5EC\uC57C \uD569\uB2C8\uB2E4",
          D = J(W.origin),
          H = D?.unit ?? "\uC694\uC18C";
        if (D)
          return `${W.origin ?? "\uAC12"}\uC774 \uB108\uBB34 \uC791\uC2B5\uB2C8\uB2E4: ${W.minimum.toString()}${H} ${X}${Y}`;
        return `${W.origin ?? "\uAC12"}\uC774 \uB108\uBB34 \uC791\uC2B5\uB2C8\uB2E4: ${W.minimum.toString()} ${X}${Y}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `\uC798\uBABB\uB41C \uBB38\uC790\uC5F4: "${X.prefix}"(\uC73C)\uB85C \uC2DC\uC791\uD574\uC57C \uD569\uB2C8\uB2E4`;
        if (X.format === "ends_with")
          return `\uC798\uBABB\uB41C \uBB38\uC790\uC5F4: "${X.suffix}"(\uC73C)\uB85C \uB05D\uB098\uC57C \uD569\uB2C8\uB2E4`;
        if (X.format === "includes")
          return `\uC798\uBABB\uB41C \uBB38\uC790\uC5F4: "${X.includes}"\uC744(\uB97C) \uD3EC\uD568\uD574\uC57C \uD569\uB2C8\uB2E4`;
        if (X.format === "regex")
          return `\uC798\uBABB\uB41C \uBB38\uC790\uC5F4: \uC815\uADDC\uC2DD ${X.pattern} \uD328\uD134\uACFC \uC77C\uCE58\uD574\uC57C \uD569\uB2C8\uB2E4`;
        return `\uC798\uBABB\uB41C ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `\uC798\uBABB\uB41C \uC22B\uC790: ${W.divisor}\uC758 \uBC30\uC218\uC5EC\uC57C \uD569\uB2C8\uB2E4`;
      case "unrecognized_keys":
        return `\uC778\uC2DD\uD560 \uC218 \uC5C6\uB294 \uD0A4: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `\uC798\uBABB\uB41C \uD0A4: ${W.origin}`;
      case "invalid_union":
        return "\uC798\uBABB\uB41C \uC785\uB825";
      case "invalid_element":
        return `\uC798\uBABB\uB41C \uAC12: ${W.origin}`;
      default:
        return "\uC798\uBABB\uB41C \uC785\uB825";
    }
  };
};
function n4() {
  return { localeError: yC() };
}
var S7 = ($) => {
  return $.charAt(0).toUpperCase() + $.slice(1);
};
function Uw($) {
  let J = Math.abs($),
    U = J % 10,
    Q = J % 100;
  if ((Q >= 11 && Q <= 19) || U === 0) return "many";
  if (U === 1) return "one";
  return "few";
}
var xC = () => {
  let $ = {
    string: {
      unit: { one: "simbolis", few: "simboliai", many: "simboli\u0173" },
      verb: {
        smaller: {
          inclusive: "turi b\u016Bti ne ilgesn\u0117 kaip",
          notInclusive: "turi b\u016Bti trumpesn\u0117 kaip",
        },
        bigger: {
          inclusive: "turi b\u016Bti ne trumpesn\u0117 kaip",
          notInclusive: "turi b\u016Bti ilgesn\u0117 kaip",
        },
      },
    },
    file: {
      unit: { one: "baitas", few: "baitai", many: "bait\u0173" },
      verb: {
        smaller: { inclusive: "turi b\u016Bti ne didesnis kaip", notInclusive: "turi b\u016Bti ma\u017Eesnis kaip" },
        bigger: { inclusive: "turi b\u016Bti ne ma\u017Eesnis kaip", notInclusive: "turi b\u016Bti didesnis kaip" },
      },
    },
    array: {
      unit: { one: "element\u0105", few: "elementus", many: "element\u0173" },
      verb: {
        smaller: { inclusive: "turi tur\u0117ti ne daugiau kaip", notInclusive: "turi tur\u0117ti ma\u017Eiau kaip" },
        bigger: { inclusive: "turi tur\u0117ti ne ma\u017Eiau kaip", notInclusive: "turi tur\u0117ti daugiau kaip" },
      },
    },
    set: {
      unit: { one: "element\u0105", few: "elementus", many: "element\u0173" },
      verb: {
        smaller: { inclusive: "turi tur\u0117ti ne daugiau kaip", notInclusive: "turi tur\u0117ti ma\u017Eiau kaip" },
        bigger: { inclusive: "turi tur\u0117ti ne ma\u017Eiau kaip", notInclusive: "turi tur\u0117ti daugiau kaip" },
      },
    },
  };
  function J(W, X, Y, D) {
    let H = $[W] ?? null;
    if (H === null) return H;
    return { unit: H.unit[X], verb: H.verb[D][Y ? "inclusive" : "notInclusive"] };
  }
  let U = {
      regex: "\u012Fvestis",
      email: "el. pa\u0161to adresas",
      url: "URL",
      emoji: "jaustukas",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO data ir laikas",
      date: "ISO data",
      time: "ISO laikas",
      duration: "ISO trukm\u0117",
      ipv4: "IPv4 adresas",
      ipv6: "IPv6 adresas",
      cidrv4: "IPv4 tinklo prefiksas (CIDR)",
      cidrv6: "IPv6 tinklo prefiksas (CIDR)",
      base64: "base64 u\u017Ekoduota eilut\u0117",
      base64url: "base64url u\u017Ekoduota eilut\u0117",
      json_string: "JSON eilut\u0117",
      e164: "E.164 numeris",
      jwt: "JWT",
      template_literal: "\u012Fvestis",
    },
    Q = {
      nan: "NaN",
      number: "skai\u010Dius",
      bigint: "sveikasis skai\u010Dius",
      string: "eilut\u0117",
      boolean: "login\u0117 reik\u0161m\u0117",
      undefined: "neapibr\u0117\u017Eta reik\u0161m\u0117",
      function: "funkcija",
      symbol: "simbolis",
      array: "masyvas",
      object: "objektas",
      null: "nulin\u0117 reik\u0161m\u0117",
    };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected)) return `Gautas tipas ${D}, o tik\u0117tasi - instanceof ${W.expected}`;
        return `Gautas tipas ${D}, o tik\u0117tasi - ${X}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Privalo b\u016Bti ${$$(W.values[0])}`;
        return `Privalo b\u016Bti vienas i\u0161 ${p(W.values, "|")} pasirinkim\u0173`;
      case "too_big": {
        let X = Q[W.origin] ?? W.origin,
          Y = J(W.origin, Uw(Number(W.maximum)), W.inclusive ?? !1, "smaller");
        if (Y?.verb)
          return `${S7(X ?? W.origin ?? "reik\u0161m\u0117")} ${Y.verb} ${W.maximum.toString()} ${Y.unit ?? "element\u0173"}`;
        let D = W.inclusive ? "ne didesnis kaip" : "ma\u017Eesnis kaip";
        return `${S7(X ?? W.origin ?? "reik\u0161m\u0117")} turi b\u016Bti ${D} ${W.maximum.toString()} ${Y?.unit}`;
      }
      case "too_small": {
        let X = Q[W.origin] ?? W.origin,
          Y = J(W.origin, Uw(Number(W.minimum)), W.inclusive ?? !1, "bigger");
        if (Y?.verb)
          return `${S7(X ?? W.origin ?? "reik\u0161m\u0117")} ${Y.verb} ${W.minimum.toString()} ${Y.unit ?? "element\u0173"}`;
        let D = W.inclusive ? "ne ma\u017Eesnis kaip" : "didesnis kaip";
        return `${S7(X ?? W.origin ?? "reik\u0161m\u0117")} turi b\u016Bti ${D} ${W.minimum.toString()} ${Y?.unit}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `Eilut\u0117 privalo prasid\u0117ti "${X.prefix}"`;
        if (X.format === "ends_with") return `Eilut\u0117 privalo pasibaigti "${X.suffix}"`;
        if (X.format === "includes") return `Eilut\u0117 privalo \u012Ftraukti "${X.includes}"`;
        if (X.format === "regex") return `Eilut\u0117 privalo atitikti ${X.pattern}`;
        return `Neteisingas ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `Skai\u010Dius privalo b\u016Bti ${W.divisor} kartotinis.`;
      case "unrecognized_keys":
        return `Neatpa\u017Eint${W.keys.length > 1 ? "i" : "as"} rakt${W.keys.length > 1 ? "ai" : "as"}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return "Rastas klaidingas raktas";
      case "invalid_union":
        return "Klaidinga \u012Fvestis";
      case "invalid_element": {
        let X = Q[W.origin] ?? W.origin;
        return `${S7(X ?? W.origin ?? "reik\u0161m\u0117")} turi klaiding\u0105 \u012Fvest\u012F`;
      }
      default:
        return "Klaidinga \u012Fvestis";
    }
  };
};
function i4() {
  return { localeError: xC() };
}
var gC = () => {
  let $ = {
    string: { unit: "\u0437\u043D\u0430\u0446\u0438", verb: "\u0434\u0430 \u0438\u043C\u0430\u0430\u0442" },
    file: { unit: "\u0431\u0430\u0458\u0442\u0438", verb: "\u0434\u0430 \u0438\u043C\u0430\u0430\u0442" },
    array: { unit: "\u0441\u0442\u0430\u0432\u043A\u0438", verb: "\u0434\u0430 \u0438\u043C\u0430\u0430\u0442" },
    set: { unit: "\u0441\u0442\u0430\u0432\u043A\u0438", verb: "\u0434\u0430 \u0438\u043C\u0430\u0430\u0442" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "\u0432\u043D\u0435\u0441",
      email: "\u0430\u0434\u0440\u0435\u0441\u0430 \u043D\u0430 \u0435-\u043F\u043E\u0448\u0442\u0430",
      url: "URL",
      emoji: "\u0435\u043C\u043E\u045F\u0438",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO \u0434\u0430\u0442\u0443\u043C \u0438 \u0432\u0440\u0435\u043C\u0435",
      date: "ISO \u0434\u0430\u0442\u0443\u043C",
      time: "ISO \u0432\u0440\u0435\u043C\u0435",
      duration: "ISO \u0432\u0440\u0435\u043C\u0435\u0442\u0440\u0430\u0435\u045A\u0435",
      ipv4: "IPv4 \u0430\u0434\u0440\u0435\u0441\u0430",
      ipv6: "IPv6 \u0430\u0434\u0440\u0435\u0441\u0430",
      cidrv4: "IPv4 \u043E\u043F\u0441\u0435\u0433",
      cidrv6: "IPv6 \u043E\u043F\u0441\u0435\u0433",
      base64: "base64-\u0435\u043D\u043A\u043E\u0434\u0438\u0440\u0430\u043D\u0430 \u043D\u0438\u0437\u0430",
      base64url: "base64url-\u0435\u043D\u043A\u043E\u0434\u0438\u0440\u0430\u043D\u0430 \u043D\u0438\u0437\u0430",
      json_string: "JSON \u043D\u0438\u0437\u0430",
      e164: "E.164 \u0431\u0440\u043E\u0458",
      jwt: "JWT",
      template_literal: "\u0432\u043D\u0435\u0441",
    },
    Q = { nan: "NaN", number: "\u0431\u0440\u043E\u0458", array: "\u043D\u0438\u0437\u0430" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `\u0413\u0440\u0435\u0448\u0435\u043D \u0432\u043D\u0435\u0441: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 instanceof ${W.expected}, \u043F\u0440\u0438\u043C\u0435\u043D\u043E ${D}`;
        return `\u0413\u0440\u0435\u0448\u0435\u043D \u0432\u043D\u0435\u0441: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 ${X}, \u043F\u0440\u0438\u043C\u0435\u043D\u043E ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Invalid input: expected ${$$(W.values[0])}`;
        return `\u0413\u0440\u0435\u0448\u0430\u043D\u0430 \u043E\u043F\u0446\u0438\u0458\u0430: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 \u0435\u0434\u043D\u0430 ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `\u041F\u0440\u0435\u043C\u043D\u043E\u0433\u0443 \u0433\u043E\u043B\u0435\u043C: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 ${W.origin ?? "\u0432\u0440\u0435\u0434\u043D\u043E\u0441\u0442\u0430"} \u0434\u0430 \u0438\u043C\u0430 ${X}${W.maximum.toString()} ${Y.unit ?? "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0438"}`;
        return `\u041F\u0440\u0435\u043C\u043D\u043E\u0433\u0443 \u0433\u043E\u043B\u0435\u043C: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 ${W.origin ?? "\u0432\u0440\u0435\u0434\u043D\u043E\u0441\u0442\u0430"} \u0434\u0430 \u0431\u0438\u0434\u0435 ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y)
          return `\u041F\u0440\u0435\u043C\u043D\u043E\u0433\u0443 \u043C\u0430\u043B: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 ${W.origin} \u0434\u0430 \u0438\u043C\u0430 ${X}${W.minimum.toString()} ${Y.unit}`;
        return `\u041F\u0440\u0435\u043C\u043D\u043E\u0433\u0443 \u043C\u0430\u043B: \u0441\u0435 \u043E\u0447\u0435\u043A\u0443\u0432\u0430 ${W.origin} \u0434\u0430 \u0431\u0438\u0434\u0435 ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `\u041D\u0435\u0432\u0430\u0436\u0435\u0447\u043A\u0430 \u043D\u0438\u0437\u0430: \u043C\u043E\u0440\u0430 \u0434\u0430 \u0437\u0430\u043F\u043E\u0447\u043D\u0443\u0432\u0430 \u0441\u043E "${X.prefix}"`;
        if (X.format === "ends_with")
          return `\u041D\u0435\u0432\u0430\u0436\u0435\u0447\u043A\u0430 \u043D\u0438\u0437\u0430: \u043C\u043E\u0440\u0430 \u0434\u0430 \u0437\u0430\u0432\u0440\u0448\u0443\u0432\u0430 \u0441\u043E "${X.suffix}"`;
        if (X.format === "includes")
          return `\u041D\u0435\u0432\u0430\u0436\u0435\u0447\u043A\u0430 \u043D\u0438\u0437\u0430: \u043C\u043E\u0440\u0430 \u0434\u0430 \u0432\u043A\u043B\u0443\u0447\u0443\u0432\u0430 "${X.includes}"`;
        if (X.format === "regex")
          return `\u041D\u0435\u0432\u0430\u0436\u0435\u0447\u043A\u0430 \u043D\u0438\u0437\u0430: \u043C\u043E\u0440\u0430 \u0434\u0430 \u043E\u0434\u0433\u043E\u0430\u0440\u0430 \u043D\u0430 \u043F\u0430\u0442\u0435\u0440\u043D\u043E\u0442 ${X.pattern}`;
        return `Invalid ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `\u0413\u0440\u0435\u0448\u0435\u043D \u0431\u0440\u043E\u0458: \u043C\u043E\u0440\u0430 \u0434\u0430 \u0431\u0438\u0434\u0435 \u0434\u0435\u043B\u0438\u0432 \u0441\u043E ${W.divisor}`;
      case "unrecognized_keys":
        return `${W.keys.length > 1 ? "\u041D\u0435\u043F\u0440\u0435\u043F\u043E\u0437\u043D\u0430\u0435\u043D\u0438 \u043A\u043B\u0443\u0447\u0435\u0432\u0438" : "\u041D\u0435\u043F\u0440\u0435\u043F\u043E\u0437\u043D\u0430\u0435\u043D \u043A\u043B\u0443\u0447"}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `\u0413\u0440\u0435\u0448\u0435\u043D \u043A\u043B\u0443\u0447 \u0432\u043E ${W.origin}`;
      case "invalid_union":
        return "\u0413\u0440\u0435\u0448\u0435\u043D \u0432\u043D\u0435\u0441";
      case "invalid_element":
        return `\u0413\u0440\u0435\u0448\u043D\u0430 \u0432\u0440\u0435\u0434\u043D\u043E\u0441\u0442 \u0432\u043E ${W.origin}`;
      default:
        return "\u0413\u0440\u0435\u0448\u0435\u043D \u0432\u043D\u0435\u0441";
    }
  };
};
function o4() {
  return { localeError: gC() };
}
var hC = () => {
  let $ = {
    string: { unit: "aksara", verb: "mempunyai" },
    file: { unit: "bait", verb: "mempunyai" },
    array: { unit: "elemen", verb: "mempunyai" },
    set: { unit: "elemen", verb: "mempunyai" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "input",
      email: "alamat e-mel",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "tarikh masa ISO",
      date: "tarikh ISO",
      time: "masa ISO",
      duration: "tempoh ISO",
      ipv4: "alamat IPv4",
      ipv6: "alamat IPv6",
      cidrv4: "julat IPv4",
      cidrv6: "julat IPv6",
      base64: "string dikodkan base64",
      base64url: "string dikodkan base64url",
      json_string: "string JSON",
      e164: "nombor E.164",
      jwt: "JWT",
      template_literal: "input",
    },
    Q = { nan: "NaN", number: "nombor" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected)) return `Input tidak sah: dijangka instanceof ${W.expected}, diterima ${D}`;
        return `Input tidak sah: dijangka ${X}, diterima ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Input tidak sah: dijangka ${$$(W.values[0])}`;
        return `Pilihan tidak sah: dijangka salah satu daripada ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `Terlalu besar: dijangka ${W.origin ?? "nilai"} ${Y.verb} ${X}${W.maximum.toString()} ${Y.unit ?? "elemen"}`;
        return `Terlalu besar: dijangka ${W.origin ?? "nilai"} adalah ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y) return `Terlalu kecil: dijangka ${W.origin} ${Y.verb} ${X}${W.minimum.toString()} ${Y.unit}`;
        return `Terlalu kecil: dijangka ${W.origin} adalah ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `String tidak sah: mesti bermula dengan "${X.prefix}"`;
        if (X.format === "ends_with") return `String tidak sah: mesti berakhir dengan "${X.suffix}"`;
        if (X.format === "includes") return `String tidak sah: mesti mengandungi "${X.includes}"`;
        if (X.format === "regex") return `String tidak sah: mesti sepadan dengan corak ${X.pattern}`;
        return `${U[X.format] ?? W.format} tidak sah`;
      }
      case "not_multiple_of":
        return `Nombor tidak sah: perlu gandaan ${W.divisor}`;
      case "unrecognized_keys":
        return `Kunci tidak dikenali: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `Kunci tidak sah dalam ${W.origin}`;
      case "invalid_union":
        return "Input tidak sah";
      case "invalid_element":
        return `Nilai tidak sah dalam ${W.origin}`;
      default:
        return "Input tidak sah";
    }
  };
};
function r4() {
  return { localeError: hC() };
}
var uC = () => {
  let $ = {
    string: { unit: "tekens", verb: "heeft" },
    file: { unit: "bytes", verb: "heeft" },
    array: { unit: "elementen", verb: "heeft" },
    set: { unit: "elementen", verb: "heeft" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "invoer",
      email: "emailadres",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO datum en tijd",
      date: "ISO datum",
      time: "ISO tijd",
      duration: "ISO duur",
      ipv4: "IPv4-adres",
      ipv6: "IPv6-adres",
      cidrv4: "IPv4-bereik",
      cidrv6: "IPv6-bereik",
      base64: "base64-gecodeerde tekst",
      base64url: "base64 URL-gecodeerde tekst",
      json_string: "JSON string",
      e164: "E.164-nummer",
      jwt: "JWT",
      template_literal: "invoer",
    },
    Q = { nan: "NaN", number: "getal" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected)) return `Ongeldige invoer: verwacht instanceof ${W.expected}, ontving ${D}`;
        return `Ongeldige invoer: verwacht ${X}, ontving ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Ongeldige invoer: verwacht ${$$(W.values[0])}`;
        return `Ongeldige optie: verwacht \xE9\xE9n van ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin),
          D = W.origin === "date" ? "laat" : W.origin === "string" ? "lang" : "groot";
        if (Y)
          return `Te ${D}: verwacht dat ${W.origin ?? "waarde"} ${X}${W.maximum.toString()} ${Y.unit ?? "elementen"} ${Y.verb}`;
        return `Te ${D}: verwacht dat ${W.origin ?? "waarde"} ${X}${W.maximum.toString()} is`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin),
          D = W.origin === "date" ? "vroeg" : W.origin === "string" ? "kort" : "klein";
        if (Y) return `Te ${D}: verwacht dat ${W.origin} ${X}${W.minimum.toString()} ${Y.unit} ${Y.verb}`;
        return `Te ${D}: verwacht dat ${W.origin} ${X}${W.minimum.toString()} is`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `Ongeldige tekst: moet met "${X.prefix}" beginnen`;
        if (X.format === "ends_with") return `Ongeldige tekst: moet op "${X.suffix}" eindigen`;
        if (X.format === "includes") return `Ongeldige tekst: moet "${X.includes}" bevatten`;
        if (X.format === "regex") return `Ongeldige tekst: moet overeenkomen met patroon ${X.pattern}`;
        return `Ongeldig: ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `Ongeldig getal: moet een veelvoud van ${W.divisor} zijn`;
      case "unrecognized_keys":
        return `Onbekende key${W.keys.length > 1 ? "s" : ""}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `Ongeldige key in ${W.origin}`;
      case "invalid_union":
        return "Ongeldige invoer";
      case "invalid_element":
        return `Ongeldige waarde in ${W.origin}`;
      default:
        return "Ongeldige invoer";
    }
  };
};
function s4() {
  return { localeError: uC() };
}
var lC = () => {
  let $ = {
    string: { unit: "tegn", verb: "\xE5 ha" },
    file: { unit: "bytes", verb: "\xE5 ha" },
    array: { unit: "elementer", verb: "\xE5 inneholde" },
    set: { unit: "elementer", verb: "\xE5 inneholde" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "input",
      email: "e-postadresse",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO dato- og klokkeslett",
      date: "ISO-dato",
      time: "ISO-klokkeslett",
      duration: "ISO-varighet",
      ipv4: "IPv4-omr\xE5de",
      ipv6: "IPv6-omr\xE5de",
      cidrv4: "IPv4-spekter",
      cidrv6: "IPv6-spekter",
      base64: "base64-enkodet streng",
      base64url: "base64url-enkodet streng",
      json_string: "JSON-streng",
      e164: "E.164-nummer",
      jwt: "JWT",
      template_literal: "input",
    },
    Q = { nan: "NaN", number: "tall", array: "liste" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected)) return `Ugyldig input: forventet instanceof ${W.expected}, fikk ${D}`;
        return `Ugyldig input: forventet ${X}, fikk ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Ugyldig verdi: forventet ${$$(W.values[0])}`;
        return `Ugyldig valg: forventet en av ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `For stor(t): forventet ${W.origin ?? "value"} til \xE5 ha ${X}${W.maximum.toString()} ${Y.unit ?? "elementer"}`;
        return `For stor(t): forventet ${W.origin ?? "value"} til \xE5 ha ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y) return `For lite(n): forventet ${W.origin} til \xE5 ha ${X}${W.minimum.toString()} ${Y.unit}`;
        return `For lite(n): forventet ${W.origin} til \xE5 ha ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `Ugyldig streng: m\xE5 starte med "${X.prefix}"`;
        if (X.format === "ends_with") return `Ugyldig streng: m\xE5 ende med "${X.suffix}"`;
        if (X.format === "includes") return `Ugyldig streng: m\xE5 inneholde "${X.includes}"`;
        if (X.format === "regex") return `Ugyldig streng: m\xE5 matche m\xF8nsteret ${X.pattern}`;
        return `Ugyldig ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `Ugyldig tall: m\xE5 v\xE6re et multiplum av ${W.divisor}`;
      case "unrecognized_keys":
        return `${W.keys.length > 1 ? "Ukjente n\xF8kler" : "Ukjent n\xF8kkel"}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `Ugyldig n\xF8kkel i ${W.origin}`;
      case "invalid_union":
        return "Ugyldig input";
      case "invalid_element":
        return `Ugyldig verdi i ${W.origin}`;
      default:
        return "Ugyldig input";
    }
  };
};
function a4() {
  return { localeError: lC() };
}
var mC = () => {
  let $ = {
    string: { unit: "harf", verb: "olmal\u0131d\u0131r" },
    file: { unit: "bayt", verb: "olmal\u0131d\u0131r" },
    array: { unit: "unsur", verb: "olmal\u0131d\u0131r" },
    set: { unit: "unsur", verb: "olmal\u0131d\u0131r" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "giren",
      email: "epostag\xE2h",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO heng\xE2m\u0131",
      date: "ISO tarihi",
      time: "ISO zaman\u0131",
      duration: "ISO m\xFCddeti",
      ipv4: "IPv4 ni\u015F\xE2n\u0131",
      ipv6: "IPv6 ni\u015F\xE2n\u0131",
      cidrv4: "IPv4 menzili",
      cidrv6: "IPv6 menzili",
      base64: "base64-\u015Fifreli metin",
      base64url: "base64url-\u015Fifreli metin",
      json_string: "JSON metin",
      e164: "E.164 say\u0131s\u0131",
      jwt: "JWT",
      template_literal: "giren",
    },
    Q = { nan: "NaN", number: "numara", array: "saf", null: "gayb" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected)) return `F\xE2sit giren: umulan instanceof ${W.expected}, al\u0131nan ${D}`;
        return `F\xE2sit giren: umulan ${X}, al\u0131nan ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `F\xE2sit giren: umulan ${$$(W.values[0])}`;
        return `F\xE2sit tercih: m\xFBteberler ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `Fazla b\xFCy\xFCk: ${W.origin ?? "value"}, ${X}${W.maximum.toString()} ${Y.unit ?? "elements"} sahip olmal\u0131yd\u0131.`;
        return `Fazla b\xFCy\xFCk: ${W.origin ?? "value"}, ${X}${W.maximum.toString()} olmal\u0131yd\u0131.`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y)
          return `Fazla k\xFC\xE7\xFCk: ${W.origin}, ${X}${W.minimum.toString()} ${Y.unit} sahip olmal\u0131yd\u0131.`;
        return `Fazla k\xFC\xE7\xFCk: ${W.origin}, ${X}${W.minimum.toString()} olmal\u0131yd\u0131.`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `F\xE2sit metin: "${X.prefix}" ile ba\u015Flamal\u0131.`;
        if (X.format === "ends_with") return `F\xE2sit metin: "${X.suffix}" ile bitmeli.`;
        if (X.format === "includes") return `F\xE2sit metin: "${X.includes}" ihtiv\xE2 etmeli.`;
        if (X.format === "regex") return `F\xE2sit metin: ${X.pattern} nak\u015F\u0131na uymal\u0131.`;
        return `F\xE2sit ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `F\xE2sit say\u0131: ${W.divisor} kat\u0131 olmal\u0131yd\u0131.`;
      case "unrecognized_keys":
        return `Tan\u0131nmayan anahtar ${W.keys.length > 1 ? "s" : ""}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `${W.origin} i\xE7in tan\u0131nmayan anahtar var.`;
      case "invalid_union":
        return "Giren tan\u0131namad\u0131.";
      case "invalid_element":
        return `${W.origin} i\xE7in tan\u0131nmayan k\u0131ymet var.`;
      default:
        return "K\u0131ymet tan\u0131namad\u0131.";
    }
  };
};
function t4() {
  return { localeError: mC() };
}
var pC = () => {
  let $ = {
    string: { unit: "\u062A\u0648\u06A9\u064A", verb: "\u0648\u0644\u0631\u064A" },
    file: { unit: "\u0628\u0627\u06CC\u067C\u0633", verb: "\u0648\u0644\u0631\u064A" },
    array: { unit: "\u062A\u0648\u06A9\u064A", verb: "\u0648\u0644\u0631\u064A" },
    set: { unit: "\u062A\u0648\u06A9\u064A", verb: "\u0648\u0644\u0631\u064A" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "\u0648\u0631\u0648\u062F\u064A",
      email: "\u0628\u0631\u06CC\u069A\u0646\u0627\u0644\u06CC\u06A9",
      url: "\u06CC\u0648 \u0622\u0631 \u0627\u0644",
      emoji: "\u0627\u06CC\u0645\u0648\u062C\u064A",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "\u0646\u06CC\u067C\u0647 \u0627\u0648 \u0648\u062E\u062A",
      date: "\u0646\u06D0\u067C\u0647",
      time: "\u0648\u062E\u062A",
      duration: "\u0645\u0648\u062F\u0647",
      ipv4: "\u062F IPv4 \u067E\u062A\u0647",
      ipv6: "\u062F IPv6 \u067E\u062A\u0647",
      cidrv4: "\u062F IPv4 \u0633\u0627\u062D\u0647",
      cidrv6: "\u062F IPv6 \u0633\u0627\u062D\u0647",
      base64: "base64-encoded \u0645\u062A\u0646",
      base64url: "base64url-encoded \u0645\u062A\u0646",
      json_string: "JSON \u0645\u062A\u0646",
      e164: "\u062F E.164 \u0634\u0645\u06D0\u0631\u0647",
      jwt: "JWT",
      template_literal: "\u0648\u0631\u0648\u062F\u064A",
    },
    Q = { nan: "NaN", number: "\u0639\u062F\u062F", array: "\u0627\u0631\u06D0" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `\u0646\u0627\u0633\u0645 \u0648\u0631\u0648\u062F\u064A: \u0628\u0627\u06CC\u062F instanceof ${W.expected} \u0648\u0627\u06CC, \u0645\u06AB\u0631 ${D} \u062A\u0631\u0644\u0627\u0633\u0647 \u0634\u0648`;
        return `\u0646\u0627\u0633\u0645 \u0648\u0631\u0648\u062F\u064A: \u0628\u0627\u06CC\u062F ${X} \u0648\u0627\u06CC, \u0645\u06AB\u0631 ${D} \u062A\u0631\u0644\u0627\u0633\u0647 \u0634\u0648`;
      }
      case "invalid_value":
        if (W.values.length === 1)
          return `\u0646\u0627\u0633\u0645 \u0648\u0631\u0648\u062F\u064A: \u0628\u0627\u06CC\u062F ${$$(W.values[0])} \u0648\u0627\u06CC`;
        return `\u0646\u0627\u0633\u0645 \u0627\u0646\u062A\u062E\u0627\u0628: \u0628\u0627\u06CC\u062F \u06CC\u0648 \u0644\u0647 ${p(W.values, "|")} \u0685\u062E\u0647 \u0648\u0627\u06CC`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `\u0689\u06CC\u0631 \u0644\u0648\u06CC: ${W.origin ?? "\u0627\u0631\u0632\u069A\u062A"} \u0628\u0627\u06CC\u062F ${X}${W.maximum.toString()} ${Y.unit ?? "\u0639\u0646\u0635\u0631\u0648\u0646\u0647"} \u0648\u0644\u0631\u064A`;
        return `\u0689\u06CC\u0631 \u0644\u0648\u06CC: ${W.origin ?? "\u0627\u0631\u0632\u069A\u062A"} \u0628\u0627\u06CC\u062F ${X}${W.maximum.toString()} \u0648\u064A`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y)
          return `\u0689\u06CC\u0631 \u06A9\u0648\u0686\u0646\u06CC: ${W.origin} \u0628\u0627\u06CC\u062F ${X}${W.minimum.toString()} ${Y.unit} \u0648\u0644\u0631\u064A`;
        return `\u0689\u06CC\u0631 \u06A9\u0648\u0686\u0646\u06CC: ${W.origin} \u0628\u0627\u06CC\u062F ${X}${W.minimum.toString()} \u0648\u064A`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `\u0646\u0627\u0633\u0645 \u0645\u062A\u0646: \u0628\u0627\u06CC\u062F \u062F "${X.prefix}" \u0633\u0631\u0647 \u067E\u06CC\u0644 \u0634\u064A`;
        if (X.format === "ends_with")
          return `\u0646\u0627\u0633\u0645 \u0645\u062A\u0646: \u0628\u0627\u06CC\u062F \u062F "${X.suffix}" \u0633\u0631\u0647 \u067E\u0627\u06CC \u062A\u0647 \u0648\u0631\u0633\u064A\u0696\u064A`;
        if (X.format === "includes")
          return `\u0646\u0627\u0633\u0645 \u0645\u062A\u0646: \u0628\u0627\u06CC\u062F "${X.includes}" \u0648\u0644\u0631\u064A`;
        if (X.format === "regex")
          return `\u0646\u0627\u0633\u0645 \u0645\u062A\u0646: \u0628\u0627\u06CC\u062F \u062F ${X.pattern} \u0633\u0631\u0647 \u0645\u0637\u0627\u0628\u0642\u062A \u0648\u0644\u0631\u064A`;
        return `${U[X.format] ?? W.format} \u0646\u0627\u0633\u0645 \u062F\u06CC`;
      }
      case "not_multiple_of":
        return `\u0646\u0627\u0633\u0645 \u0639\u062F\u062F: \u0628\u0627\u06CC\u062F \u062F ${W.divisor} \u0645\u0636\u0631\u0628 \u0648\u064A`;
      case "unrecognized_keys":
        return `\u0646\u0627\u0633\u0645 ${W.keys.length > 1 ? "\u06A9\u0644\u06CC\u0689\u0648\u0646\u0647" : "\u06A9\u0644\u06CC\u0689"}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `\u0646\u0627\u0633\u0645 \u06A9\u0644\u06CC\u0689 \u067E\u0647 ${W.origin} \u06A9\u06D0`;
      case "invalid_union":
        return "\u0646\u0627\u0633\u0645\u0647 \u0648\u0631\u0648\u062F\u064A";
      case "invalid_element":
        return `\u0646\u0627\u0633\u0645 \u0639\u0646\u0635\u0631 \u067E\u0647 ${W.origin} \u06A9\u06D0`;
      default:
        return "\u0646\u0627\u0633\u0645\u0647 \u0648\u0631\u0648\u062F\u064A";
    }
  };
};
function e4() {
  return { localeError: pC() };
}
var dC = () => {
  let $ = {
    string: { unit: "znak\xF3w", verb: "mie\u0107" },
    file: { unit: "bajt\xF3w", verb: "mie\u0107" },
    array: { unit: "element\xF3w", verb: "mie\u0107" },
    set: { unit: "element\xF3w", verb: "mie\u0107" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "wyra\u017Cenie",
      email: "adres email",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "data i godzina w formacie ISO",
      date: "data w formacie ISO",
      time: "godzina w formacie ISO",
      duration: "czas trwania ISO",
      ipv4: "adres IPv4",
      ipv6: "adres IPv6",
      cidrv4: "zakres IPv4",
      cidrv6: "zakres IPv6",
      base64: "ci\u0105g znak\xF3w zakodowany w formacie base64",
      base64url: "ci\u0105g znak\xF3w zakodowany w formacie base64url",
      json_string: "ci\u0105g znak\xF3w w formacie JSON",
      e164: "liczba E.164",
      jwt: "JWT",
      template_literal: "wej\u015Bcie",
    },
    Q = { nan: "NaN", number: "liczba", array: "tablica" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `Nieprawid\u0142owe dane wej\u015Bciowe: oczekiwano instanceof ${W.expected}, otrzymano ${D}`;
        return `Nieprawid\u0142owe dane wej\u015Bciowe: oczekiwano ${X}, otrzymano ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Nieprawid\u0142owe dane wej\u015Bciowe: oczekiwano ${$$(W.values[0])}`;
        return `Nieprawid\u0142owa opcja: oczekiwano jednej z warto\u015Bci ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `Za du\u017Ca warto\u015B\u0107: oczekiwano, \u017Ce ${W.origin ?? "warto\u015B\u0107"} b\u0119dzie mie\u0107 ${X}${W.maximum.toString()} ${Y.unit ?? "element\xF3w"}`;
        return `Zbyt du\u017C(y/a/e): oczekiwano, \u017Ce ${W.origin ?? "warto\u015B\u0107"} b\u0119dzie wynosi\u0107 ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y)
          return `Za ma\u0142a warto\u015B\u0107: oczekiwano, \u017Ce ${W.origin ?? "warto\u015B\u0107"} b\u0119dzie mie\u0107 ${X}${W.minimum.toString()} ${Y.unit ?? "element\xF3w"}`;
        return `Zbyt ma\u0142(y/a/e): oczekiwano, \u017Ce ${W.origin ?? "warto\u015B\u0107"} b\u0119dzie wynosi\u0107 ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `Nieprawid\u0142owy ci\u0105g znak\xF3w: musi zaczyna\u0107 si\u0119 od "${X.prefix}"`;
        if (X.format === "ends_with")
          return `Nieprawid\u0142owy ci\u0105g znak\xF3w: musi ko\u0144czy\u0107 si\u0119 na "${X.suffix}"`;
        if (X.format === "includes")
          return `Nieprawid\u0142owy ci\u0105g znak\xF3w: musi zawiera\u0107 "${X.includes}"`;
        if (X.format === "regex")
          return `Nieprawid\u0142owy ci\u0105g znak\xF3w: musi odpowiada\u0107 wzorcowi ${X.pattern}`;
        return `Nieprawid\u0142ow(y/a/e) ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `Nieprawid\u0142owa liczba: musi by\u0107 wielokrotno\u015Bci\u0105 ${W.divisor}`;
      case "unrecognized_keys":
        return `Nierozpoznane klucze${W.keys.length > 1 ? "s" : ""}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `Nieprawid\u0142owy klucz w ${W.origin}`;
      case "invalid_union":
        return "Nieprawid\u0142owe dane wej\u015Bciowe";
      case "invalid_element":
        return `Nieprawid\u0142owa warto\u015B\u0107 w ${W.origin}`;
      default:
        return "Nieprawid\u0142owe dane wej\u015Bciowe";
    }
  };
};
function $N() {
  return { localeError: dC() };
}
var cC = () => {
  let $ = {
    string: { unit: "caracteres", verb: "ter" },
    file: { unit: "bytes", verb: "ter" },
    array: { unit: "itens", verb: "ter" },
    set: { unit: "itens", verb: "ter" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "padr\xE3o",
      email: "endere\xE7o de e-mail",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "data e hora ISO",
      date: "data ISO",
      time: "hora ISO",
      duration: "dura\xE7\xE3o ISO",
      ipv4: "endere\xE7o IPv4",
      ipv6: "endere\xE7o IPv6",
      cidrv4: "faixa de IPv4",
      cidrv6: "faixa de IPv6",
      base64: "texto codificado em base64",
      base64url: "URL codificada em base64",
      json_string: "texto JSON",
      e164: "n\xFAmero E.164",
      jwt: "JWT",
      template_literal: "entrada",
    },
    Q = { nan: "NaN", number: "n\xFAmero", null: "nulo" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected)) return `Tipo inv\xE1lido: esperado instanceof ${W.expected}, recebido ${D}`;
        return `Tipo inv\xE1lido: esperado ${X}, recebido ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Entrada inv\xE1lida: esperado ${$$(W.values[0])}`;
        return `Op\xE7\xE3o inv\xE1lida: esperada uma das ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `Muito grande: esperado que ${W.origin ?? "valor"} tivesse ${X}${W.maximum.toString()} ${Y.unit ?? "elementos"}`;
        return `Muito grande: esperado que ${W.origin ?? "valor"} fosse ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y) return `Muito pequeno: esperado que ${W.origin} tivesse ${X}${W.minimum.toString()} ${Y.unit}`;
        return `Muito pequeno: esperado que ${W.origin} fosse ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `Texto inv\xE1lido: deve come\xE7ar com "${X.prefix}"`;
        if (X.format === "ends_with") return `Texto inv\xE1lido: deve terminar com "${X.suffix}"`;
        if (X.format === "includes") return `Texto inv\xE1lido: deve incluir "${X.includes}"`;
        if (X.format === "regex") return `Texto inv\xE1lido: deve corresponder ao padr\xE3o ${X.pattern}`;
        return `${U[X.format] ?? W.format} inv\xE1lido`;
      }
      case "not_multiple_of":
        return `N\xFAmero inv\xE1lido: deve ser m\xFAltiplo de ${W.divisor}`;
      case "unrecognized_keys":
        return `Chave${W.keys.length > 1 ? "s" : ""} desconhecida${W.keys.length > 1 ? "s" : ""}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `Chave inv\xE1lida em ${W.origin}`;
      case "invalid_union":
        return "Entrada inv\xE1lida";
      case "invalid_element":
        return `Valor inv\xE1lido em ${W.origin}`;
      default:
        return "Campo inv\xE1lido";
    }
  };
};
function JN() {
  return { localeError: cC() };
}
var nC = () => {
  let $ = {
    string: { unit: "caractere", verb: "s\u0103 aib\u0103" },
    file: { unit: "octe\u021Bi", verb: "s\u0103 aib\u0103" },
    array: { unit: "elemente", verb: "s\u0103 aib\u0103" },
    set: { unit: "elemente", verb: "s\u0103 aib\u0103" },
    map: { unit: "intr\u0103ri", verb: "s\u0103 aib\u0103" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "intrare",
      email: "adres\u0103 de email",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "dat\u0103 \u0219i or\u0103 ISO",
      date: "dat\u0103 ISO",
      time: "or\u0103 ISO",
      duration: "durat\u0103 ISO",
      ipv4: "adres\u0103 IPv4",
      ipv6: "adres\u0103 IPv6",
      mac: "adres\u0103 MAC",
      cidrv4: "interval IPv4",
      cidrv6: "interval IPv6",
      base64: "\u0219ir codat base64",
      base64url: "\u0219ir codat base64url",
      json_string: "\u0219ir JSON",
      e164: "num\u0103r E.164",
      jwt: "JWT",
      template_literal: "intrare",
    },
    Q = {
      nan: "NaN",
      string: "\u0219ir",
      number: "num\u0103r",
      boolean: "boolean",
      function: "func\u021Bie",
      array: "matrice",
      object: "obiect",
      undefined: "nedefinit",
      symbol: "simbol",
      bigint: "num\u0103r mare",
      void: "void",
      never: "never",
      map: "hart\u0103",
      set: "set",
    };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        return `Intrare invalid\u0103: a\u0219teptat ${X}, primit ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Intrare invalid\u0103: a\u0219teptat ${$$(W.values[0])}`;
        return `Op\u021Biune invalid\u0103: a\u0219teptat una dintre ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `Prea mare: a\u0219teptat ca ${W.origin ?? "valoarea"} ${Y.verb} ${X}${W.maximum.toString()} ${Y.unit ?? "elemente"}`;
        return `Prea mare: a\u0219teptat ca ${W.origin ?? "valoarea"} s\u0103 fie ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y) return `Prea mic: a\u0219teptat ca ${W.origin} ${Y.verb} ${X}${W.minimum.toString()} ${Y.unit}`;
        return `Prea mic: a\u0219teptat ca ${W.origin} s\u0103 fie ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `\u0218ir invalid: trebuie s\u0103 \xEEnceap\u0103 cu "${X.prefix}"`;
        if (X.format === "ends_with") return `\u0218ir invalid: trebuie s\u0103 se termine cu "${X.suffix}"`;
        if (X.format === "includes") return `\u0218ir invalid: trebuie s\u0103 includ\u0103 "${X.includes}"`;
        if (X.format === "regex")
          return `\u0218ir invalid: trebuie s\u0103 se potriveasc\u0103 cu modelul ${X.pattern}`;
        return `Format invalid: ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `Num\u0103r invalid: trebuie s\u0103 fie multiplu de ${W.divisor}`;
      case "unrecognized_keys":
        return `Chei nerecunoscute: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `Cheie invalid\u0103 \xEEn ${W.origin}`;
      case "invalid_union":
        return "Intrare invalid\u0103";
      case "invalid_element":
        return `Valoare invalid\u0103 \xEEn ${W.origin}`;
      default:
        return "Intrare invalid\u0103";
    }
  };
};
function UN() {
  return { localeError: nC() };
}
function Ww($, J, U, Q) {
  let W = Math.abs($),
    X = W % 10,
    Y = W % 100;
  if (Y >= 11 && Y <= 19) return Q;
  if (X === 1) return J;
  if (X >= 2 && X <= 4) return U;
  return Q;
}
var iC = () => {
  let $ = {
    string: {
      unit: {
        one: "\u0441\u0438\u043C\u0432\u043E\u043B",
        few: "\u0441\u0438\u043C\u0432\u043E\u043B\u0430",
        many: "\u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432",
      },
      verb: "\u0438\u043C\u0435\u0442\u044C",
    },
    file: {
      unit: {
        one: "\u0431\u0430\u0439\u0442",
        few: "\u0431\u0430\u0439\u0442\u0430",
        many: "\u0431\u0430\u0439\u0442",
      },
      verb: "\u0438\u043C\u0435\u0442\u044C",
    },
    array: {
      unit: {
        one: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442",
        few: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430",
        many: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432",
      },
      verb: "\u0438\u043C\u0435\u0442\u044C",
    },
    set: {
      unit: {
        one: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442",
        few: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430",
        many: "\u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432",
      },
      verb: "\u0438\u043C\u0435\u0442\u044C",
    },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "\u0432\u0432\u043E\u0434",
      email: "email \u0430\u0434\u0440\u0435\u0441",
      url: "URL",
      emoji: "\u044D\u043C\u043E\u0434\u0437\u0438",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO \u0434\u0430\u0442\u0430 \u0438 \u0432\u0440\u0435\u043C\u044F",
      date: "ISO \u0434\u0430\u0442\u0430",
      time: "ISO \u0432\u0440\u0435\u043C\u044F",
      duration: "ISO \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C",
      ipv4: "IPv4 \u0430\u0434\u0440\u0435\u0441",
      ipv6: "IPv6 \u0430\u0434\u0440\u0435\u0441",
      cidrv4: "IPv4 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D",
      cidrv6: "IPv6 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D",
      base64: "\u0441\u0442\u0440\u043E\u043A\u0430 \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 base64",
      base64url: "\u0441\u0442\u0440\u043E\u043A\u0430 \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 base64url",
      json_string: "JSON \u0441\u0442\u0440\u043E\u043A\u0430",
      e164: "\u043D\u043E\u043C\u0435\u0440 E.164",
      jwt: "JWT",
      template_literal: "\u0432\u0432\u043E\u0434",
    },
    Q = { nan: "NaN", number: "\u0447\u0438\u0441\u043B\u043E", array: "\u043C\u0430\u0441\u0441\u0438\u0432" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0432\u0432\u043E\u0434: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C instanceof ${W.expected}, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E ${D}`;
        return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0432\u0432\u043E\u0434: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C ${X}, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1)
          return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0432\u0432\u043E\u0434: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C ${$$(W.values[0])}`;
        return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0432\u0430\u0440\u0438\u0430\u043D\u0442: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0434\u043D\u043E \u0438\u0437 ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y) {
          let D = Number(W.maximum),
            H = Ww(D, Y.unit.one, Y.unit.few, Y.unit.many);
          return `\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C, \u0447\u0442\u043E ${W.origin ?? "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435"} \u0431\u0443\u0434\u0435\u0442 \u0438\u043C\u0435\u0442\u044C ${X}${W.maximum.toString()} ${H}`;
        }
        return `\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0431\u043E\u043B\u044C\u0448\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C, \u0447\u0442\u043E ${W.origin ?? "\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435"} \u0431\u0443\u0434\u0435\u0442 ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y) {
          let D = Number(W.minimum),
            H = Ww(D, Y.unit.one, Y.unit.few, Y.unit.many);
          return `\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u0430\u043B\u0435\u043D\u044C\u043A\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C, \u0447\u0442\u043E ${W.origin} \u0431\u0443\u0434\u0435\u0442 \u0438\u043C\u0435\u0442\u044C ${X}${W.minimum.toString()} ${H}`;
        }
        return `\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u0430\u043B\u0435\u043D\u044C\u043A\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435: \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C, \u0447\u0442\u043E ${W.origin} \u0431\u0443\u0434\u0435\u0442 ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430: \u0434\u043E\u043B\u0436\u043D\u0430 \u043D\u0430\u0447\u0438\u043D\u0430\u0442\u044C\u0441\u044F \u0441 "${X.prefix}"`;
        if (X.format === "ends_with")
          return `\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430: \u0434\u043E\u043B\u0436\u043D\u0430 \u0437\u0430\u043A\u0430\u043D\u0447\u0438\u0432\u0430\u0442\u044C\u0441\u044F \u043D\u0430 "${X.suffix}"`;
        if (X.format === "includes")
          return `\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430: \u0434\u043E\u043B\u0436\u043D\u0430 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C "${X.includes}"`;
        if (X.format === "regex")
          return `\u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430: \u0434\u043E\u043B\u0436\u043D\u0430 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u043E\u0432\u0430\u0442\u044C \u0448\u0430\u0431\u043B\u043E\u043D\u0443 ${X.pattern}`;
        return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `\u041D\u0435\u0432\u0435\u0440\u043D\u043E\u0435 \u0447\u0438\u0441\u043B\u043E: \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C \u043A\u0440\u0430\u0442\u043D\u044B\u043C ${W.divisor}`;
      case "unrecognized_keys":
        return `\u041D\u0435\u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u043D\u043D${W.keys.length > 1 ? "\u044B\u0435" : "\u044B\u0439"} \u043A\u043B\u044E\u0447${W.keys.length > 1 ? "\u0438" : ""}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043A\u043B\u044E\u0447 \u0432 ${W.origin}`;
      case "invalid_union":
        return "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0435 \u0432\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435";
      case "invalid_element":
        return `\u041D\u0435\u0432\u0435\u0440\u043D\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0432 ${W.origin}`;
      default:
        return "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0435 \u0432\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435";
    }
  };
};
function WN() {
  return { localeError: iC() };
}
var oC = () => {
  let $ = {
    string: { unit: "znakov", verb: "imeti" },
    file: { unit: "bajtov", verb: "imeti" },
    array: { unit: "elementov", verb: "imeti" },
    set: { unit: "elementov", verb: "imeti" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "vnos",
      email: "e-po\u0161tni naslov",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO datum in \u010Das",
      date: "ISO datum",
      time: "ISO \u010Das",
      duration: "ISO trajanje",
      ipv4: "IPv4 naslov",
      ipv6: "IPv6 naslov",
      cidrv4: "obseg IPv4",
      cidrv6: "obseg IPv6",
      base64: "base64 kodiran niz",
      base64url: "base64url kodiran niz",
      json_string: "JSON niz",
      e164: "E.164 \u0161tevilka",
      jwt: "JWT",
      template_literal: "vnos",
    },
    Q = { nan: "NaN", number: "\u0161tevilo", array: "tabela" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `Neveljaven vnos: pri\u010Dakovano instanceof ${W.expected}, prejeto ${D}`;
        return `Neveljaven vnos: pri\u010Dakovano ${X}, prejeto ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Neveljaven vnos: pri\u010Dakovano ${$$(W.values[0])}`;
        return `Neveljavna mo\u017Enost: pri\u010Dakovano eno izmed ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `Preveliko: pri\u010Dakovano, da bo ${W.origin ?? "vrednost"} imelo ${X}${W.maximum.toString()} ${Y.unit ?? "elementov"}`;
        return `Preveliko: pri\u010Dakovano, da bo ${W.origin ?? "vrednost"} ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y) return `Premajhno: pri\u010Dakovano, da bo ${W.origin} imelo ${X}${W.minimum.toString()} ${Y.unit}`;
        return `Premajhno: pri\u010Dakovano, da bo ${W.origin} ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `Neveljaven niz: mora se za\u010Deti z "${X.prefix}"`;
        if (X.format === "ends_with") return `Neveljaven niz: mora se kon\u010Dati z "${X.suffix}"`;
        if (X.format === "includes") return `Neveljaven niz: mora vsebovati "${X.includes}"`;
        if (X.format === "regex") return `Neveljaven niz: mora ustrezati vzorcu ${X.pattern}`;
        return `Neveljaven ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `Neveljavno \u0161tevilo: mora biti ve\u010Dkratnik ${W.divisor}`;
      case "unrecognized_keys":
        return `Neprepoznan${W.keys.length > 1 ? "i klju\u010Di" : " klju\u010D"}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `Neveljaven klju\u010D v ${W.origin}`;
      case "invalid_union":
        return "Neveljaven vnos";
      case "invalid_element":
        return `Neveljavna vrednost v ${W.origin}`;
      default:
        return "Neveljaven vnos";
    }
  };
};
function QN() {
  return { localeError: oC() };
}
var rC = () => {
  let $ = {
    string: { unit: "tecken", verb: "att ha" },
    file: { unit: "bytes", verb: "att ha" },
    array: { unit: "objekt", verb: "att inneh\xE5lla" },
    set: { unit: "objekt", verb: "att inneh\xE5lla" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "regulj\xE4rt uttryck",
      email: "e-postadress",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO-datum och tid",
      date: "ISO-datum",
      time: "ISO-tid",
      duration: "ISO-varaktighet",
      ipv4: "IPv4-intervall",
      ipv6: "IPv6-intervall",
      cidrv4: "IPv4-spektrum",
      cidrv6: "IPv6-spektrum",
      base64: "base64-kodad str\xE4ng",
      base64url: "base64url-kodad str\xE4ng",
      json_string: "JSON-str\xE4ng",
      e164: "E.164-nummer",
      jwt: "JWT",
      template_literal: "mall-literal",
    },
    Q = { nan: "NaN", number: "antal", array: "lista" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected)) return `Ogiltig inmatning: f\xF6rv\xE4ntat instanceof ${W.expected}, fick ${D}`;
        return `Ogiltig inmatning: f\xF6rv\xE4ntat ${X}, fick ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Ogiltig inmatning: f\xF6rv\xE4ntat ${$$(W.values[0])}`;
        return `Ogiltigt val: f\xF6rv\xE4ntade en av ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `F\xF6r stor(t): f\xF6rv\xE4ntade ${W.origin ?? "v\xE4rdet"} att ha ${X}${W.maximum.toString()} ${Y.unit ?? "element"}`;
        return `F\xF6r stor(t): f\xF6rv\xE4ntat ${W.origin ?? "v\xE4rdet"} att ha ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y)
          return `F\xF6r lite(t): f\xF6rv\xE4ntade ${W.origin ?? "v\xE4rdet"} att ha ${X}${W.minimum.toString()} ${Y.unit}`;
        return `F\xF6r lite(t): f\xF6rv\xE4ntade ${W.origin ?? "v\xE4rdet"} att ha ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `Ogiltig str\xE4ng: m\xE5ste b\xF6rja med "${X.prefix}"`;
        if (X.format === "ends_with") return `Ogiltig str\xE4ng: m\xE5ste sluta med "${X.suffix}"`;
        if (X.format === "includes") return `Ogiltig str\xE4ng: m\xE5ste inneh\xE5lla "${X.includes}"`;
        if (X.format === "regex") return `Ogiltig str\xE4ng: m\xE5ste matcha m\xF6nstret "${X.pattern}"`;
        return `Ogiltig(t) ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `Ogiltigt tal: m\xE5ste vara en multipel av ${W.divisor}`;
      case "unrecognized_keys":
        return `${W.keys.length > 1 ? "Ok\xE4nda nycklar" : "Ok\xE4nd nyckel"}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `Ogiltig nyckel i ${W.origin ?? "v\xE4rdet"}`;
      case "invalid_union":
        return "Ogiltig input";
      case "invalid_element":
        return `Ogiltigt v\xE4rde i ${W.origin ?? "v\xE4rdet"}`;
      default:
        return "Ogiltig input";
    }
  };
};
function XN() {
  return { localeError: rC() };
}
var sC = () => {
  let $ = {
    string: {
      unit: "\u0B8E\u0BB4\u0BC1\u0BA4\u0BCD\u0BA4\u0BC1\u0B95\u0BCD\u0B95\u0BB3\u0BCD",
      verb: "\u0B95\u0BCA\u0BA3\u0BCD\u0B9F\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD",
    },
    file: {
      unit: "\u0BAA\u0BC8\u0B9F\u0BCD\u0B9F\u0BC1\u0B95\u0BB3\u0BCD",
      verb: "\u0B95\u0BCA\u0BA3\u0BCD\u0B9F\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD",
    },
    array: {
      unit: "\u0B89\u0BB1\u0BC1\u0BAA\u0BCD\u0BAA\u0BC1\u0B95\u0BB3\u0BCD",
      verb: "\u0B95\u0BCA\u0BA3\u0BCD\u0B9F\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD",
    },
    set: {
      unit: "\u0B89\u0BB1\u0BC1\u0BAA\u0BCD\u0BAA\u0BC1\u0B95\u0BB3\u0BCD",
      verb: "\u0B95\u0BCA\u0BA3\u0BCD\u0B9F\u0BBF\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD",
    },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "\u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1",
      email: "\u0BAE\u0BBF\u0BA9\u0BCD\u0BA9\u0B9E\u0BCD\u0B9A\u0BB2\u0BCD \u0BAE\u0BC1\u0B95\u0BB5\u0BB0\u0BBF",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO \u0BA4\u0BC7\u0BA4\u0BBF \u0BA8\u0BC7\u0BB0\u0BAE\u0BCD",
      date: "ISO \u0BA4\u0BC7\u0BA4\u0BBF",
      time: "ISO \u0BA8\u0BC7\u0BB0\u0BAE\u0BCD",
      duration: "ISO \u0B95\u0BBE\u0BB2 \u0B85\u0BB3\u0BB5\u0BC1",
      ipv4: "IPv4 \u0BAE\u0BC1\u0B95\u0BB5\u0BB0\u0BBF",
      ipv6: "IPv6 \u0BAE\u0BC1\u0B95\u0BB5\u0BB0\u0BBF",
      cidrv4: "IPv4 \u0BB5\u0BB0\u0BAE\u0BCD\u0BAA\u0BC1",
      cidrv6: "IPv6 \u0BB5\u0BB0\u0BAE\u0BCD\u0BAA\u0BC1",
      base64: "base64-encoded \u0B9A\u0BB0\u0BAE\u0BCD",
      base64url: "base64url-encoded \u0B9A\u0BB0\u0BAE\u0BCD",
      json_string: "JSON \u0B9A\u0BB0\u0BAE\u0BCD",
      e164: "E.164 \u0B8E\u0BA3\u0BCD",
      jwt: "JWT",
      template_literal: "input",
    },
    Q = {
      nan: "NaN",
      number: "\u0B8E\u0BA3\u0BCD",
      array: "\u0B85\u0BA3\u0BBF",
      null: "\u0BB5\u0BC6\u0BB1\u0BC1\u0BAE\u0BC8",
    };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 instanceof ${W.expected}, \u0BAA\u0BC6\u0BB1\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${D}`;
        return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${X}, \u0BAA\u0BC6\u0BB1\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1)
          return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${$$(W.values[0])}`;
        return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0BB5\u0BBF\u0BB0\u0BC1\u0BAA\u0BCD\u0BAA\u0BAE\u0BCD: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${p(W.values, "|")} \u0B87\u0BB2\u0BCD \u0B92\u0BA9\u0BCD\u0BB1\u0BC1`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `\u0BAE\u0BBF\u0B95 \u0BAA\u0BC6\u0BB0\u0BBF\u0BAF\u0BA4\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${W.origin ?? "\u0BAE\u0BA4\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1"} ${X}${W.maximum.toString()} ${Y.unit ?? "\u0B89\u0BB1\u0BC1\u0BAA\u0BCD\u0BAA\u0BC1\u0B95\u0BB3\u0BCD"} \u0B86\u0B95 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
        return `\u0BAE\u0BBF\u0B95 \u0BAA\u0BC6\u0BB0\u0BBF\u0BAF\u0BA4\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${W.origin ?? "\u0BAE\u0BA4\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1"} ${X}${W.maximum.toString()} \u0B86\u0B95 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y)
          return `\u0BAE\u0BBF\u0B95\u0B9A\u0BCD \u0B9A\u0BBF\u0BB1\u0BBF\u0BAF\u0BA4\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${W.origin} ${X}${W.minimum.toString()} ${Y.unit} \u0B86\u0B95 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
        return `\u0BAE\u0BBF\u0B95\u0B9A\u0BCD \u0B9A\u0BBF\u0BB1\u0BBF\u0BAF\u0BA4\u0BC1: \u0B8E\u0BA4\u0BBF\u0BB0\u0BCD\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BAA\u0BCD\u0BAA\u0B9F\u0BCD\u0B9F\u0BA4\u0BC1 ${W.origin} ${X}${W.minimum.toString()} \u0B86\u0B95 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B9A\u0BB0\u0BAE\u0BCD: "${X.prefix}" \u0B87\u0BB2\u0BCD \u0BA4\u0BCA\u0B9F\u0B99\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
        if (X.format === "ends_with")
          return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B9A\u0BB0\u0BAE\u0BCD: "${X.suffix}" \u0B87\u0BB2\u0BCD \u0BAE\u0BC1\u0B9F\u0BBF\u0BB5\u0B9F\u0BC8\u0BAF \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
        if (X.format === "includes")
          return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B9A\u0BB0\u0BAE\u0BCD: "${X.includes}" \u0B90 \u0B89\u0BB3\u0BCD\u0BB3\u0B9F\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
        if (X.format === "regex")
          return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B9A\u0BB0\u0BAE\u0BCD: ${X.pattern} \u0BAE\u0BC1\u0BB1\u0BC8\u0BAA\u0BBE\u0B9F\u0BCD\u0B9F\u0BC1\u0B9F\u0BA9\u0BCD \u0BAA\u0BCA\u0BB0\u0BC1\u0BA8\u0BCD\u0BA4 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
        return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B8E\u0BA3\u0BCD: ${W.divisor} \u0B87\u0BA9\u0BCD \u0BAA\u0BB2\u0BAE\u0BBE\u0B95 \u0B87\u0BB0\u0BC1\u0B95\u0BCD\u0B95 \u0BB5\u0BC7\u0BA3\u0BCD\u0B9F\u0BC1\u0BAE\u0BCD`;
      case "unrecognized_keys":
        return `\u0B85\u0B9F\u0BC8\u0BAF\u0BBE\u0BB3\u0BAE\u0BCD \u0BA4\u0BC6\u0BB0\u0BBF\u0BAF\u0BBE\u0BA4 \u0BB5\u0BBF\u0B9A\u0BC8${W.keys.length > 1 ? "\u0B95\u0BB3\u0BCD" : ""}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `${W.origin} \u0B87\u0BB2\u0BCD \u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0BB5\u0BBF\u0B9A\u0BC8`;
      case "invalid_union":
        return "\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1";
      case "invalid_element":
        return `${W.origin} \u0B87\u0BB2\u0BCD \u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0BAE\u0BA4\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1`;
      default:
        return "\u0BA4\u0BB5\u0BB1\u0BBE\u0BA9 \u0B89\u0BB3\u0BCD\u0BB3\u0BC0\u0B9F\u0BC1";
    }
  };
};
function YN() {
  return { localeError: sC() };
}
var aC = () => {
  let $ = {
    string: { unit: "\u0E15\u0E31\u0E27\u0E2D\u0E31\u0E01\u0E29\u0E23", verb: "\u0E04\u0E27\u0E23\u0E21\u0E35" },
    file: { unit: "\u0E44\u0E1A\u0E15\u0E4C", verb: "\u0E04\u0E27\u0E23\u0E21\u0E35" },
    array: { unit: "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23", verb: "\u0E04\u0E27\u0E23\u0E21\u0E35" },
    set: { unit: "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23", verb: "\u0E04\u0E27\u0E23\u0E21\u0E35" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E1B\u0E49\u0E2D\u0E19",
      email: "\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48\u0E2D\u0E35\u0E40\u0E21\u0E25",
      url: "URL",
      emoji: "\u0E2D\u0E34\u0E42\u0E21\u0E08\u0E34",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E40\u0E27\u0E25\u0E32\u0E41\u0E1A\u0E1A ISO",
      date: "\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E41\u0E1A\u0E1A ISO",
      time: "\u0E40\u0E27\u0E25\u0E32\u0E41\u0E1A\u0E1A ISO",
      duration: "\u0E0A\u0E48\u0E27\u0E07\u0E40\u0E27\u0E25\u0E32\u0E41\u0E1A\u0E1A ISO",
      ipv4: "\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48 IPv4",
      ipv6: "\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48 IPv6",
      cidrv4: "\u0E0A\u0E48\u0E27\u0E07 IP \u0E41\u0E1A\u0E1A IPv4",
      cidrv6: "\u0E0A\u0E48\u0E27\u0E07 IP \u0E41\u0E1A\u0E1A IPv6",
      base64: "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E41\u0E1A\u0E1A Base64",
      base64url:
        "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E41\u0E1A\u0E1A Base64 \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A URL",
      json_string: "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E41\u0E1A\u0E1A JSON",
      e164: "\u0E40\u0E1A\u0E2D\u0E23\u0E4C\u0E42\u0E17\u0E23\u0E28\u0E31\u0E1E\u0E17\u0E4C\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E1B\u0E23\u0E30\u0E40\u0E17\u0E28 (E.164)",
      jwt: "\u0E42\u0E17\u0E40\u0E04\u0E19 JWT",
      template_literal: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E1B\u0E49\u0E2D\u0E19",
    },
    Q = {
      nan: "NaN",
      number: "\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02",
      array: "\u0E2D\u0E32\u0E23\u0E4C\u0E40\u0E23\u0E22\u0E4C (Array)",
      null: "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E04\u0E48\u0E32 (null)",
    };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E04\u0E27\u0E23\u0E40\u0E1B\u0E47\u0E19 instanceof ${W.expected} \u0E41\u0E15\u0E48\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A ${D}`;
        return `\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E04\u0E27\u0E23\u0E40\u0E1B\u0E47\u0E19 ${X} \u0E41\u0E15\u0E48\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1)
          return `\u0E04\u0E48\u0E32\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E04\u0E27\u0E23\u0E40\u0E1B\u0E47\u0E19 ${$$(W.values[0])}`;
        return `\u0E15\u0E31\u0E27\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E04\u0E27\u0E23\u0E40\u0E1B\u0E47\u0E19\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E43\u0E19 ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive
            ? "\u0E44\u0E21\u0E48\u0E40\u0E01\u0E34\u0E19"
            : "\u0E19\u0E49\u0E2D\u0E22\u0E01\u0E27\u0E48\u0E32",
          Y = J(W.origin);
        if (Y)
          return `\u0E40\u0E01\u0E34\u0E19\u0E01\u0E33\u0E2B\u0E19\u0E14: ${W.origin ?? "\u0E04\u0E48\u0E32"} \u0E04\u0E27\u0E23\u0E21\u0E35${X} ${W.maximum.toString()} ${Y.unit ?? "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23"}`;
        return `\u0E40\u0E01\u0E34\u0E19\u0E01\u0E33\u0E2B\u0E19\u0E14: ${W.origin ?? "\u0E04\u0E48\u0E32"} \u0E04\u0E27\u0E23\u0E21\u0E35${X} ${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive
            ? "\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E19\u0E49\u0E2D\u0E22"
            : "\u0E21\u0E32\u0E01\u0E01\u0E27\u0E48\u0E32",
          Y = J(W.origin);
        if (Y)
          return `\u0E19\u0E49\u0E2D\u0E22\u0E01\u0E27\u0E48\u0E32\u0E01\u0E33\u0E2B\u0E19\u0E14: ${W.origin} \u0E04\u0E27\u0E23\u0E21\u0E35${X} ${W.minimum.toString()} ${Y.unit}`;
        return `\u0E19\u0E49\u0E2D\u0E22\u0E01\u0E27\u0E48\u0E32\u0E01\u0E33\u0E2B\u0E19\u0E14: ${W.origin} \u0E04\u0E27\u0E23\u0E21\u0E35${X} ${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E15\u0E49\u0E2D\u0E07\u0E02\u0E36\u0E49\u0E19\u0E15\u0E49\u0E19\u0E14\u0E49\u0E27\u0E22 "${X.prefix}"`;
        if (X.format === "ends_with")
          return `\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E15\u0E49\u0E2D\u0E07\u0E25\u0E07\u0E17\u0E49\u0E32\u0E22\u0E14\u0E49\u0E27\u0E22 "${X.suffix}"`;
        if (X.format === "includes")
          return `\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35 "${X.includes}" \u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21`;
        if (X.format === "regex")
          return `\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E15\u0E49\u0E2D\u0E07\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E17\u0E35\u0E48\u0E01\u0E33\u0E2B\u0E19\u0E14 ${X.pattern}`;
        return `\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E08\u0E33\u0E19\u0E27\u0E19\u0E17\u0E35\u0E48\u0E2B\u0E32\u0E23\u0E14\u0E49\u0E27\u0E22 ${W.divisor} \u0E44\u0E14\u0E49\u0E25\u0E07\u0E15\u0E31\u0E27`;
      case "unrecognized_keys":
        return `\u0E1E\u0E1A\u0E04\u0E35\u0E22\u0E4C\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E23\u0E39\u0E49\u0E08\u0E31\u0E01: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `\u0E04\u0E35\u0E22\u0E4C\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E19 ${W.origin}`;
      case "invalid_union":
        return "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07: \u0E44\u0E21\u0E48\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A\u0E22\u0E39\u0E40\u0E19\u0E35\u0E22\u0E19\u0E17\u0E35\u0E48\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E44\u0E27\u0E49";
      case "invalid_element":
        return `\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E19 ${W.origin}`;
      default:
        return "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07";
    }
  };
};
function DN() {
  return { localeError: aC() };
}
var tC = () => {
  let $ = {
    string: { unit: "karakter", verb: "olmal\u0131" },
    file: { unit: "bayt", verb: "olmal\u0131" },
    array: { unit: "\xF6\u011Fe", verb: "olmal\u0131" },
    set: { unit: "\xF6\u011Fe", verb: "olmal\u0131" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "girdi",
      email: "e-posta adresi",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO tarih ve saat",
      date: "ISO tarih",
      time: "ISO saat",
      duration: "ISO s\xFCre",
      ipv4: "IPv4 adresi",
      ipv6: "IPv6 adresi",
      cidrv4: "IPv4 aral\u0131\u011F\u0131",
      cidrv6: "IPv6 aral\u0131\u011F\u0131",
      base64: "base64 ile \u015Fifrelenmi\u015F metin",
      base64url: "base64url ile \u015Fifrelenmi\u015F metin",
      json_string: "JSON dizesi",
      e164: "E.164 say\u0131s\u0131",
      jwt: "JWT",
      template_literal: "\u015Eablon dizesi",
    },
    Q = { nan: "NaN" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `Ge\xE7ersiz de\u011Fer: beklenen instanceof ${W.expected}, al\u0131nan ${D}`;
        return `Ge\xE7ersiz de\u011Fer: beklenen ${X}, al\u0131nan ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Ge\xE7ersiz de\u011Fer: beklenen ${$$(W.values[0])}`;
        return `Ge\xE7ersiz se\xE7enek: a\u015Fa\u011F\u0131dakilerden biri olmal\u0131: ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `\xC7ok b\xFCy\xFCk: beklenen ${W.origin ?? "de\u011Fer"} ${X}${W.maximum.toString()} ${Y.unit ?? "\xF6\u011Fe"}`;
        return `\xC7ok b\xFCy\xFCk: beklenen ${W.origin ?? "de\u011Fer"} ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y) return `\xC7ok k\xFC\xE7\xFCk: beklenen ${W.origin} ${X}${W.minimum.toString()} ${Y.unit}`;
        return `\xC7ok k\xFC\xE7\xFCk: beklenen ${W.origin} ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `Ge\xE7ersiz metin: "${X.prefix}" ile ba\u015Flamal\u0131`;
        if (X.format === "ends_with") return `Ge\xE7ersiz metin: "${X.suffix}" ile bitmeli`;
        if (X.format === "includes") return `Ge\xE7ersiz metin: "${X.includes}" i\xE7ermeli`;
        if (X.format === "regex") return `Ge\xE7ersiz metin: ${X.pattern} desenine uymal\u0131`;
        return `Ge\xE7ersiz ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `Ge\xE7ersiz say\u0131: ${W.divisor} ile tam b\xF6l\xFCnebilmeli`;
      case "unrecognized_keys":
        return `Tan\u0131nmayan anahtar${W.keys.length > 1 ? "lar" : ""}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `${W.origin} i\xE7inde ge\xE7ersiz anahtar`;
      case "invalid_union":
        return "Ge\xE7ersiz de\u011Fer";
      case "invalid_element":
        return `${W.origin} i\xE7inde ge\xE7ersiz de\u011Fer`;
      default:
        return "Ge\xE7ersiz de\u011Fer";
    }
  };
};
function HN() {
  return { localeError: tC() };
}
var eC = () => {
  let $ = {
    string: { unit: "\u0441\u0438\u043C\u0432\u043E\u043B\u0456\u0432", verb: "\u043C\u0430\u0442\u0438\u043C\u0435" },
    file: { unit: "\u0431\u0430\u0439\u0442\u0456\u0432", verb: "\u043C\u0430\u0442\u0438\u043C\u0435" },
    array: {
      unit: "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0456\u0432",
      verb: "\u043C\u0430\u0442\u0438\u043C\u0435",
    },
    set: {
      unit: "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0456\u0432",
      verb: "\u043C\u0430\u0442\u0438\u043C\u0435",
    },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "\u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456",
      email:
        "\u0430\u0434\u0440\u0435\u0441\u0430 \u0435\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u043E\u0457 \u043F\u043E\u0448\u0442\u0438",
      url: "URL",
      emoji: "\u0435\u043C\u043E\u0434\u0437\u0456",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "\u0434\u0430\u0442\u0430 \u0442\u0430 \u0447\u0430\u0441 ISO",
      date: "\u0434\u0430\u0442\u0430 ISO",
      time: "\u0447\u0430\u0441 ISO",
      duration: "\u0442\u0440\u0438\u0432\u0430\u043B\u0456\u0441\u0442\u044C ISO",
      ipv4: "\u0430\u0434\u0440\u0435\u0441\u0430 IPv4",
      ipv6: "\u0430\u0434\u0440\u0435\u0441\u0430 IPv6",
      cidrv4: "\u0434\u0456\u0430\u043F\u0430\u0437\u043E\u043D IPv4",
      cidrv6: "\u0434\u0456\u0430\u043F\u0430\u0437\u043E\u043D IPv6",
      base64: "\u0440\u044F\u0434\u043E\u043A \u0443 \u043A\u043E\u0434\u0443\u0432\u0430\u043D\u043D\u0456 base64",
      base64url:
        "\u0440\u044F\u0434\u043E\u043A \u0443 \u043A\u043E\u0434\u0443\u0432\u0430\u043D\u043D\u0456 base64url",
      json_string: "\u0440\u044F\u0434\u043E\u043A JSON",
      e164: "\u043D\u043E\u043C\u0435\u0440 E.164",
      jwt: "JWT",
      template_literal: "\u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456",
    },
    Q = { nan: "NaN", number: "\u0447\u0438\u0441\u043B\u043E", array: "\u043C\u0430\u0441\u0438\u0432" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0456 \u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F instanceof ${W.expected}, \u043E\u0442\u0440\u0438\u043C\u0430\u043D\u043E ${D}`;
        return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0456 \u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F ${X}, \u043E\u0442\u0440\u0438\u043C\u0430\u043D\u043E ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1)
          return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0456 \u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F ${$$(W.values[0])}`;
        return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0430 \u043E\u043F\u0446\u0456\u044F: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F \u043E\u0434\u043D\u0435 \u0437 ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `\u0417\u0430\u043D\u0430\u0434\u0442\u043E \u0432\u0435\u043B\u0438\u043A\u0435: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F, \u0449\u043E ${W.origin ?? "\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F"} ${Y.verb} ${X}${W.maximum.toString()} ${Y.unit ?? "\u0435\u043B\u0435\u043C\u0435\u043D\u0442\u0456\u0432"}`;
        return `\u0417\u0430\u043D\u0430\u0434\u0442\u043E \u0432\u0435\u043B\u0438\u043A\u0435: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F, \u0449\u043E ${W.origin ?? "\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F"} \u0431\u0443\u0434\u0435 ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y)
          return `\u0417\u0430\u043D\u0430\u0434\u0442\u043E \u043C\u0430\u043B\u0435: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F, \u0449\u043E ${W.origin} ${Y.verb} ${X}${W.minimum.toString()} ${Y.unit}`;
        return `\u0417\u0430\u043D\u0430\u0434\u0442\u043E \u043C\u0430\u043B\u0435: \u043E\u0447\u0456\u043A\u0443\u0454\u0442\u044C\u0441\u044F, \u0449\u043E ${W.origin} \u0431\u0443\u0434\u0435 ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 \u0440\u044F\u0434\u043E\u043A: \u043F\u043E\u0432\u0438\u043D\u0435\u043D \u043F\u043E\u0447\u0438\u043D\u0430\u0442\u0438\u0441\u044F \u0437 "${X.prefix}"`;
        if (X.format === "ends_with")
          return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 \u0440\u044F\u0434\u043E\u043A: \u043F\u043E\u0432\u0438\u043D\u0435\u043D \u0437\u0430\u043A\u0456\u043D\u0447\u0443\u0432\u0430\u0442\u0438\u0441\u044F \u043D\u0430 "${X.suffix}"`;
        if (X.format === "includes")
          return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 \u0440\u044F\u0434\u043E\u043A: \u043F\u043E\u0432\u0438\u043D\u0435\u043D \u043C\u0456\u0441\u0442\u0438\u0442\u0438 "${X.includes}"`;
        if (X.format === "regex")
          return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 \u0440\u044F\u0434\u043E\u043A: \u043F\u043E\u0432\u0438\u043D\u0435\u043D \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0442\u0438 \u0448\u0430\u0431\u043B\u043E\u043D\u0443 ${X.pattern}`;
        return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0435 \u0447\u0438\u0441\u043B\u043E: \u043F\u043E\u0432\u0438\u043D\u043D\u043E \u0431\u0443\u0442\u0438 \u043A\u0440\u0430\u0442\u043D\u0438\u043C ${W.divisor}`;
      case "unrecognized_keys":
        return `\u041D\u0435\u0440\u043E\u0437\u043F\u0456\u0437\u043D\u0430\u043D\u0438\u0439 \u043A\u043B\u044E\u0447${W.keys.length > 1 ? "\u0456" : ""}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0438\u0439 \u043A\u043B\u044E\u0447 \u0443 ${W.origin}`;
      case "invalid_union":
        return "\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0456 \u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456";
      case "invalid_element":
        return `\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044F \u0443 ${W.origin}`;
      default:
        return "\u041D\u0435\u043F\u0440\u0430\u0432\u0438\u043B\u044C\u043D\u0456 \u0432\u0445\u0456\u0434\u043D\u0456 \u0434\u0430\u043D\u0456";
    }
  };
};
function C7() {
  return { localeError: eC() };
}
function GN() {
  return C7();
}
var $2 = () => {
  let $ = {
    string: { unit: "\u062D\u0631\u0648\u0641", verb: "\u06C1\u0648\u0646\u0627" },
    file: { unit: "\u0628\u0627\u0626\u0679\u0633", verb: "\u06C1\u0648\u0646\u0627" },
    array: { unit: "\u0622\u0626\u0679\u0645\u0632", verb: "\u06C1\u0648\u0646\u0627" },
    set: { unit: "\u0622\u0626\u0679\u0645\u0632", verb: "\u06C1\u0648\u0646\u0627" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "\u0627\u0646 \u067E\u0679",
      email: "\u0627\u06CC \u0645\u06CC\u0644 \u0627\u06CC\u0688\u0631\u06CC\u0633",
      url: "\u06CC\u0648 \u0622\u0631 \u0627\u06CC\u0644",
      emoji: "\u0627\u06CC\u0645\u0648\u062C\u06CC",
      uuid: "\u06CC\u0648 \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC",
      uuidv4: "\u06CC\u0648 \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC \u0648\u06CC 4",
      uuidv6: "\u06CC\u0648 \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC \u0648\u06CC 6",
      nanoid: "\u0646\u06CC\u0646\u0648 \u0622\u0626\u06CC \u0688\u06CC",
      guid: "\u062C\u06CC \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC",
      cuid: "\u0633\u06CC \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC",
      cuid2: "\u0633\u06CC \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC 2",
      ulid: "\u06CC\u0648 \u0627\u06CC\u0644 \u0622\u0626\u06CC \u0688\u06CC",
      xid: "\u0627\u06CC\u06A9\u0633 \u0622\u0626\u06CC \u0688\u06CC",
      ksuid: "\u06A9\u06D2 \u0627\u06CC\u0633 \u06CC\u0648 \u0622\u0626\u06CC \u0688\u06CC",
      datetime: "\u0622\u0626\u06CC \u0627\u06CC\u0633 \u0627\u0648 \u0688\u06CC\u0679 \u0679\u0627\u0626\u0645",
      date: "\u0622\u0626\u06CC \u0627\u06CC\u0633 \u0627\u0648 \u062A\u0627\u0631\u06CC\u062E",
      time: "\u0622\u0626\u06CC \u0627\u06CC\u0633 \u0627\u0648 \u0648\u0642\u062A",
      duration: "\u0622\u0626\u06CC \u0627\u06CC\u0633 \u0627\u0648 \u0645\u062F\u062A",
      ipv4: "\u0622\u0626\u06CC \u067E\u06CC \u0648\u06CC 4 \u0627\u06CC\u0688\u0631\u06CC\u0633",
      ipv6: "\u0622\u0626\u06CC \u067E\u06CC \u0648\u06CC 6 \u0627\u06CC\u0688\u0631\u06CC\u0633",
      cidrv4: "\u0622\u0626\u06CC \u067E\u06CC \u0648\u06CC 4 \u0631\u06CC\u0646\u062C",
      cidrv6: "\u0622\u0626\u06CC \u067E\u06CC \u0648\u06CC 6 \u0631\u06CC\u0646\u062C",
      base64: "\u0628\u06CC\u0633 64 \u0627\u0646 \u06A9\u0648\u0688\u0688 \u0633\u0679\u0631\u0646\u06AF",
      base64url:
        "\u0628\u06CC\u0633 64 \u06CC\u0648 \u0622\u0631 \u0627\u06CC\u0644 \u0627\u0646 \u06A9\u0648\u0688\u0688 \u0633\u0679\u0631\u0646\u06AF",
      json_string: "\u062C\u06D2 \u0627\u06CC\u0633 \u0627\u0648 \u0627\u06CC\u0646 \u0633\u0679\u0631\u0646\u06AF",
      e164: "\u0627\u06CC 164 \u0646\u0645\u0628\u0631",
      jwt: "\u062C\u06D2 \u0688\u0628\u0644\u06CC\u0648 \u0679\u06CC",
      template_literal: "\u0627\u0646 \u067E\u0679",
    },
    Q = { nan: "NaN", number: "\u0646\u0645\u0628\u0631", array: "\u0622\u0631\u06D2", null: "\u0646\u0644" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `\u063A\u0644\u0637 \u0627\u0646 \u067E\u0679: instanceof ${W.expected} \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627\u060C ${D} \u0645\u0648\u0635\u0648\u0644 \u06C1\u0648\u0627`;
        return `\u063A\u0644\u0637 \u0627\u0646 \u067E\u0679: ${X} \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627\u060C ${D} \u0645\u0648\u0635\u0648\u0644 \u06C1\u0648\u0627`;
      }
      case "invalid_value":
        if (W.values.length === 1)
          return `\u063A\u0644\u0637 \u0627\u0646 \u067E\u0679: ${$$(W.values[0])} \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627`;
        return `\u063A\u0644\u0637 \u0622\u067E\u0634\u0646: ${p(W.values, "|")} \u0645\u06CC\u06BA \u0633\u06D2 \u0627\u06CC\u06A9 \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `\u0628\u06C1\u062A \u0628\u0691\u0627: ${W.origin ?? "\u0648\u06CC\u0644\u06CC\u0648"} \u06A9\u06D2 ${X}${W.maximum.toString()} ${Y.unit ?? "\u0639\u0646\u0627\u0635\u0631"} \u06C1\u0648\u0646\u06D2 \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u06D2`;
        return `\u0628\u06C1\u062A \u0628\u0691\u0627: ${W.origin ?? "\u0648\u06CC\u0644\u06CC\u0648"} \u06A9\u0627 ${X}${W.maximum.toString()} \u06C1\u0648\u0646\u0627 \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y)
          return `\u0628\u06C1\u062A \u0686\u06BE\u0648\u0679\u0627: ${W.origin} \u06A9\u06D2 ${X}${W.minimum.toString()} ${Y.unit} \u06C1\u0648\u0646\u06D2 \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u06D2`;
        return `\u0628\u06C1\u062A \u0686\u06BE\u0648\u0679\u0627: ${W.origin} \u06A9\u0627 ${X}${W.minimum.toString()} \u06C1\u0648\u0646\u0627 \u0645\u062A\u0648\u0642\u0639 \u062A\u06BE\u0627`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `\u063A\u0644\u0637 \u0633\u0679\u0631\u0646\u06AF: "${X.prefix}" \u0633\u06D2 \u0634\u0631\u0648\u0639 \u06C1\u0648\u0646\u0627 \u0686\u0627\u06C1\u06CC\u06D2`;
        if (X.format === "ends_with")
          return `\u063A\u0644\u0637 \u0633\u0679\u0631\u0646\u06AF: "${X.suffix}" \u067E\u0631 \u062E\u062A\u0645 \u06C1\u0648\u0646\u0627 \u0686\u0627\u06C1\u06CC\u06D2`;
        if (X.format === "includes")
          return `\u063A\u0644\u0637 \u0633\u0679\u0631\u0646\u06AF: "${X.includes}" \u0634\u0627\u0645\u0644 \u06C1\u0648\u0646\u0627 \u0686\u0627\u06C1\u06CC\u06D2`;
        if (X.format === "regex")
          return `\u063A\u0644\u0637 \u0633\u0679\u0631\u0646\u06AF: \u067E\u06CC\u0679\u0631\u0646 ${X.pattern} \u0633\u06D2 \u0645\u06CC\u0686 \u06C1\u0648\u0646\u0627 \u0686\u0627\u06C1\u06CC\u06D2`;
        return `\u063A\u0644\u0637 ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `\u063A\u0644\u0637 \u0646\u0645\u0628\u0631: ${W.divisor} \u06A9\u0627 \u0645\u0636\u0627\u0639\u0641 \u06C1\u0648\u0646\u0627 \u0686\u0627\u06C1\u06CC\u06D2`;
      case "unrecognized_keys":
        return `\u063A\u06CC\u0631 \u062A\u0633\u0644\u06CC\u0645 \u0634\u062F\u06C1 \u06A9\u06CC${W.keys.length > 1 ? "\u0632" : ""}: ${p(W.keys, "\u060C ")}`;
      case "invalid_key":
        return `${W.origin} \u0645\u06CC\u06BA \u063A\u0644\u0637 \u06A9\u06CC`;
      case "invalid_union":
        return "\u063A\u0644\u0637 \u0627\u0646 \u067E\u0679";
      case "invalid_element":
        return `${W.origin} \u0645\u06CC\u06BA \u063A\u0644\u0637 \u0648\u06CC\u0644\u06CC\u0648`;
      default:
        return "\u063A\u0644\u0637 \u0627\u0646 \u067E\u0679";
    }
  };
};
function KN() {
  return { localeError: $2() };
}
var J2 = () => {
  let $ = {
    string: { unit: "belgi", verb: "bo\u2018lishi kerak" },
    file: { unit: "bayt", verb: "bo\u2018lishi kerak" },
    array: { unit: "element", verb: "bo\u2018lishi kerak" },
    set: { unit: "element", verb: "bo\u2018lishi kerak" },
    map: { unit: "yozuv", verb: "bo\u2018lishi kerak" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "kirish",
      email: "elektron pochta manzili",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO sana va vaqti",
      date: "ISO sana",
      time: "ISO vaqt",
      duration: "ISO davomiylik",
      ipv4: "IPv4 manzil",
      ipv6: "IPv6 manzil",
      mac: "MAC manzil",
      cidrv4: "IPv4 diapazon",
      cidrv6: "IPv6 diapazon",
      base64: "base64 kodlangan satr",
      base64url: "base64url kodlangan satr",
      json_string: "JSON satr",
      e164: "E.164 raqam",
      jwt: "JWT",
      template_literal: "kirish",
    },
    Q = { nan: "NaN", number: "raqam", array: "massiv" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `Noto\u2018g\u2018ri kirish: kutilgan instanceof ${W.expected}, qabul qilingan ${D}`;
        return `Noto\u2018g\u2018ri kirish: kutilgan ${X}, qabul qilingan ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `Noto\u2018g\u2018ri kirish: kutilgan ${$$(W.values[0])}`;
        return `Noto\u2018g\u2018ri variant: quyidagilardan biri kutilgan ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y) return `Juda katta: kutilgan ${W.origin ?? "qiymat"} ${X}${W.maximum.toString()} ${Y.unit} ${Y.verb}`;
        return `Juda katta: kutilgan ${W.origin ?? "qiymat"} ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y) return `Juda kichik: kutilgan ${W.origin} ${X}${W.minimum.toString()} ${Y.unit} ${Y.verb}`;
        return `Juda kichik: kutilgan ${W.origin} ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with") return `Noto\u2018g\u2018ri satr: "${X.prefix}" bilan boshlanishi kerak`;
        if (X.format === "ends_with") return `Noto\u2018g\u2018ri satr: "${X.suffix}" bilan tugashi kerak`;
        if (X.format === "includes") return `Noto\u2018g\u2018ri satr: "${X.includes}" ni o\u2018z ichiga olishi kerak`;
        if (X.format === "regex") return `Noto\u2018g\u2018ri satr: ${X.pattern} shabloniga mos kelishi kerak`;
        return `Noto\u2018g\u2018ri ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `Noto\u2018g\u2018ri raqam: ${W.divisor} ning karralisi bo\u2018lishi kerak`;
      case "unrecognized_keys":
        return `Noma\u2019lum kalit${W.keys.length > 1 ? "lar" : ""}: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `${W.origin} dagi kalit noto\u2018g\u2018ri`;
      case "invalid_union":
        return "Noto\u2018g\u2018ri kirish";
      case "invalid_element":
        return `${W.origin} da noto\u2018g\u2018ri qiymat`;
      default:
        return "Noto\u2018g\u2018ri kirish";
    }
  };
};
function NN() {
  return { localeError: J2() };
}
var U2 = () => {
  let $ = {
    string: { unit: "k\xFD t\u1EF1", verb: "c\xF3" },
    file: { unit: "byte", verb: "c\xF3" },
    array: { unit: "ph\u1EA7n t\u1EED", verb: "c\xF3" },
    set: { unit: "ph\u1EA7n t\u1EED", verb: "c\xF3" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "\u0111\u1EA7u v\xE0o",
      email: "\u0111\u1ECBa ch\u1EC9 email",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ng\xE0y gi\u1EDD ISO",
      date: "ng\xE0y ISO",
      time: "gi\u1EDD ISO",
      duration: "kho\u1EA3ng th\u1EDDi gian ISO",
      ipv4: "\u0111\u1ECBa ch\u1EC9 IPv4",
      ipv6: "\u0111\u1ECBa ch\u1EC9 IPv6",
      cidrv4: "d\u1EA3i IPv4",
      cidrv6: "d\u1EA3i IPv6",
      base64: "chu\u1ED7i m\xE3 h\xF3a base64",
      base64url: "chu\u1ED7i m\xE3 h\xF3a base64url",
      json_string: "chu\u1ED7i JSON",
      e164: "s\u1ED1 E.164",
      jwt: "JWT",
      template_literal: "\u0111\u1EA7u v\xE0o",
    },
    Q = { nan: "NaN", number: "s\u1ED1", array: "m\u1EA3ng" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `\u0110\u1EA7u v\xE0o kh\xF4ng h\u1EE3p l\u1EC7: mong \u0111\u1EE3i instanceof ${W.expected}, nh\u1EADn \u0111\u01B0\u1EE3c ${D}`;
        return `\u0110\u1EA7u v\xE0o kh\xF4ng h\u1EE3p l\u1EC7: mong \u0111\u1EE3i ${X}, nh\u1EADn \u0111\u01B0\u1EE3c ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1)
          return `\u0110\u1EA7u v\xE0o kh\xF4ng h\u1EE3p l\u1EC7: mong \u0111\u1EE3i ${$$(W.values[0])}`;
        return `T\xF9y ch\u1ECDn kh\xF4ng h\u1EE3p l\u1EC7: mong \u0111\u1EE3i m\u1ED9t trong c\xE1c gi\xE1 tr\u1ECB ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `Qu\xE1 l\u1EDBn: mong \u0111\u1EE3i ${W.origin ?? "gi\xE1 tr\u1ECB"} ${Y.verb} ${X}${W.maximum.toString()} ${Y.unit ?? "ph\u1EA7n t\u1EED"}`;
        return `Qu\xE1 l\u1EDBn: mong \u0111\u1EE3i ${W.origin ?? "gi\xE1 tr\u1ECB"} ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y) return `Qu\xE1 nh\u1ECF: mong \u0111\u1EE3i ${W.origin} ${Y.verb} ${X}${W.minimum.toString()} ${Y.unit}`;
        return `Qu\xE1 nh\u1ECF: mong \u0111\u1EE3i ${W.origin} ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `Chu\u1ED7i kh\xF4ng h\u1EE3p l\u1EC7: ph\u1EA3i b\u1EAFt \u0111\u1EA7u b\u1EB1ng "${X.prefix}"`;
        if (X.format === "ends_with")
          return `Chu\u1ED7i kh\xF4ng h\u1EE3p l\u1EC7: ph\u1EA3i k\u1EBFt th\xFAc b\u1EB1ng "${X.suffix}"`;
        if (X.format === "includes")
          return `Chu\u1ED7i kh\xF4ng h\u1EE3p l\u1EC7: ph\u1EA3i bao g\u1ED3m "${X.includes}"`;
        if (X.format === "regex")
          return `Chu\u1ED7i kh\xF4ng h\u1EE3p l\u1EC7: ph\u1EA3i kh\u1EDBp v\u1EDBi m\u1EABu ${X.pattern}`;
        return `${U[X.format] ?? W.format} kh\xF4ng h\u1EE3p l\u1EC7`;
      }
      case "not_multiple_of":
        return `S\u1ED1 kh\xF4ng h\u1EE3p l\u1EC7: ph\u1EA3i l\xE0 b\u1ED9i s\u1ED1 c\u1EE7a ${W.divisor}`;
      case "unrecognized_keys":
        return `Kh\xF3a kh\xF4ng \u0111\u01B0\u1EE3c nh\u1EADn d\u1EA1ng: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `Kh\xF3a kh\xF4ng h\u1EE3p l\u1EC7 trong ${W.origin}`;
      case "invalid_union":
        return "\u0110\u1EA7u v\xE0o kh\xF4ng h\u1EE3p l\u1EC7";
      case "invalid_element":
        return `Gi\xE1 tr\u1ECB kh\xF4ng h\u1EE3p l\u1EC7 trong ${W.origin}`;
      default:
        return "\u0110\u1EA7u v\xE0o kh\xF4ng h\u1EE3p l\u1EC7";
    }
  };
};
function ON() {
  return { localeError: U2() };
}
var W2 = () => {
  let $ = {
    string: { unit: "\u5B57\u7B26", verb: "\u5305\u542B" },
    file: { unit: "\u5B57\u8282", verb: "\u5305\u542B" },
    array: { unit: "\u9879", verb: "\u5305\u542B" },
    set: { unit: "\u9879", verb: "\u5305\u542B" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "\u8F93\u5165",
      email: "\u7535\u5B50\u90AE\u4EF6",
      url: "URL",
      emoji: "\u8868\u60C5\u7B26\u53F7",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO\u65E5\u671F\u65F6\u95F4",
      date: "ISO\u65E5\u671F",
      time: "ISO\u65F6\u95F4",
      duration: "ISO\u65F6\u957F",
      ipv4: "IPv4\u5730\u5740",
      ipv6: "IPv6\u5730\u5740",
      cidrv4: "IPv4\u7F51\u6BB5",
      cidrv6: "IPv6\u7F51\u6BB5",
      base64: "base64\u7F16\u7801\u5B57\u7B26\u4E32",
      base64url: "base64url\u7F16\u7801\u5B57\u7B26\u4E32",
      json_string: "JSON\u5B57\u7B26\u4E32",
      e164: "E.164\u53F7\u7801",
      jwt: "JWT",
      template_literal: "\u8F93\u5165",
    },
    Q = { nan: "NaN", number: "\u6570\u5B57", array: "\u6570\u7EC4", null: "\u7A7A\u503C(null)" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `\u65E0\u6548\u8F93\u5165\uFF1A\u671F\u671B instanceof ${W.expected}\uFF0C\u5B9E\u9645\u63A5\u6536 ${D}`;
        return `\u65E0\u6548\u8F93\u5165\uFF1A\u671F\u671B ${X}\uFF0C\u5B9E\u9645\u63A5\u6536 ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1) return `\u65E0\u6548\u8F93\u5165\uFF1A\u671F\u671B ${$$(W.values[0])}`;
        return `\u65E0\u6548\u9009\u9879\uFF1A\u671F\u671B\u4EE5\u4E0B\u4E4B\u4E00 ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `\u6570\u503C\u8FC7\u5927\uFF1A\u671F\u671B ${W.origin ?? "\u503C"} ${X}${W.maximum.toString()} ${Y.unit ?? "\u4E2A\u5143\u7D20"}`;
        return `\u6570\u503C\u8FC7\u5927\uFF1A\u671F\u671B ${W.origin ?? "\u503C"} ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y) return `\u6570\u503C\u8FC7\u5C0F\uFF1A\u671F\u671B ${W.origin} ${X}${W.minimum.toString()} ${Y.unit}`;
        return `\u6570\u503C\u8FC7\u5C0F\uFF1A\u671F\u671B ${W.origin} ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `\u65E0\u6548\u5B57\u7B26\u4E32\uFF1A\u5FC5\u987B\u4EE5 "${X.prefix}" \u5F00\u5934`;
        if (X.format === "ends_with")
          return `\u65E0\u6548\u5B57\u7B26\u4E32\uFF1A\u5FC5\u987B\u4EE5 "${X.suffix}" \u7ED3\u5C3E`;
        if (X.format === "includes")
          return `\u65E0\u6548\u5B57\u7B26\u4E32\uFF1A\u5FC5\u987B\u5305\u542B "${X.includes}"`;
        if (X.format === "regex")
          return `\u65E0\u6548\u5B57\u7B26\u4E32\uFF1A\u5FC5\u987B\u6EE1\u8DB3\u6B63\u5219\u8868\u8FBE\u5F0F ${X.pattern}`;
        return `\u65E0\u6548${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `\u65E0\u6548\u6570\u5B57\uFF1A\u5FC5\u987B\u662F ${W.divisor} \u7684\u500D\u6570`;
      case "unrecognized_keys":
        return `\u51FA\u73B0\u672A\u77E5\u7684\u952E(key): ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `${W.origin} \u4E2D\u7684\u952E(key)\u65E0\u6548`;
      case "invalid_union":
        return "\u65E0\u6548\u8F93\u5165";
      case "invalid_element":
        return `${W.origin} \u4E2D\u5305\u542B\u65E0\u6548\u503C(value)`;
      default:
        return "\u65E0\u6548\u8F93\u5165";
    }
  };
};
function FN() {
  return { localeError: W2() };
}
var Q2 = () => {
  let $ = {
    string: { unit: "\u5B57\u5143", verb: "\u64C1\u6709" },
    file: { unit: "\u4F4D\u5143\u7D44", verb: "\u64C1\u6709" },
    array: { unit: "\u9805\u76EE", verb: "\u64C1\u6709" },
    set: { unit: "\u9805\u76EE", verb: "\u64C1\u6709" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "\u8F38\u5165",
      email: "\u90F5\u4EF6\u5730\u5740",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "ISO \u65E5\u671F\u6642\u9593",
      date: "ISO \u65E5\u671F",
      time: "ISO \u6642\u9593",
      duration: "ISO \u671F\u9593",
      ipv4: "IPv4 \u4F4D\u5740",
      ipv6: "IPv6 \u4F4D\u5740",
      cidrv4: "IPv4 \u7BC4\u570D",
      cidrv6: "IPv6 \u7BC4\u570D",
      base64: "base64 \u7DE8\u78BC\u5B57\u4E32",
      base64url: "base64url \u7DE8\u78BC\u5B57\u4E32",
      json_string: "JSON \u5B57\u4E32",
      e164: "E.164 \u6578\u503C",
      jwt: "JWT",
      template_literal: "\u8F38\u5165",
    },
    Q = { nan: "NaN" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `\u7121\u6548\u7684\u8F38\u5165\u503C\uFF1A\u9810\u671F\u70BA instanceof ${W.expected}\uFF0C\u4F46\u6536\u5230 ${D}`;
        return `\u7121\u6548\u7684\u8F38\u5165\u503C\uFF1A\u9810\u671F\u70BA ${X}\uFF0C\u4F46\u6536\u5230 ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1)
          return `\u7121\u6548\u7684\u8F38\u5165\u503C\uFF1A\u9810\u671F\u70BA ${$$(W.values[0])}`;
        return `\u7121\u6548\u7684\u9078\u9805\uFF1A\u9810\u671F\u70BA\u4EE5\u4E0B\u5176\u4E2D\u4E4B\u4E00 ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `\u6578\u503C\u904E\u5927\uFF1A\u9810\u671F ${W.origin ?? "\u503C"} \u61C9\u70BA ${X}${W.maximum.toString()} ${Y.unit ?? "\u500B\u5143\u7D20"}`;
        return `\u6578\u503C\u904E\u5927\uFF1A\u9810\u671F ${W.origin ?? "\u503C"} \u61C9\u70BA ${X}${W.maximum.toString()}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y)
          return `\u6578\u503C\u904E\u5C0F\uFF1A\u9810\u671F ${W.origin} \u61C9\u70BA ${X}${W.minimum.toString()} ${Y.unit}`;
        return `\u6578\u503C\u904E\u5C0F\uFF1A\u9810\u671F ${W.origin} \u61C9\u70BA ${X}${W.minimum.toString()}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `\u7121\u6548\u7684\u5B57\u4E32\uFF1A\u5FC5\u9808\u4EE5 "${X.prefix}" \u958B\u982D`;
        if (X.format === "ends_with")
          return `\u7121\u6548\u7684\u5B57\u4E32\uFF1A\u5FC5\u9808\u4EE5 "${X.suffix}" \u7D50\u5C3E`;
        if (X.format === "includes")
          return `\u7121\u6548\u7684\u5B57\u4E32\uFF1A\u5FC5\u9808\u5305\u542B "${X.includes}"`;
        if (X.format === "regex")
          return `\u7121\u6548\u7684\u5B57\u4E32\uFF1A\u5FC5\u9808\u7B26\u5408\u683C\u5F0F ${X.pattern}`;
        return `\u7121\u6548\u7684 ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `\u7121\u6548\u7684\u6578\u5B57\uFF1A\u5FC5\u9808\u70BA ${W.divisor} \u7684\u500D\u6578`;
      case "unrecognized_keys":
        return `\u7121\u6CD5\u8B58\u5225\u7684\u9375\u503C${W.keys.length > 1 ? "\u5011" : ""}\uFF1A${p(W.keys, "\u3001")}`;
      case "invalid_key":
        return `${W.origin} \u4E2D\u6709\u7121\u6548\u7684\u9375\u503C`;
      case "invalid_union":
        return "\u7121\u6548\u7684\u8F38\u5165\u503C";
      case "invalid_element":
        return `${W.origin} \u4E2D\u6709\u7121\u6548\u7684\u503C`;
      default:
        return "\u7121\u6548\u7684\u8F38\u5165\u503C";
    }
  };
};
function qN() {
  return { localeError: Q2() };
}
var X2 = () => {
  let $ = {
    string: { unit: "\xE0mi", verb: "n\xED" },
    file: { unit: "bytes", verb: "n\xED" },
    array: { unit: "nkan", verb: "n\xED" },
    set: { unit: "nkan", verb: "n\xED" },
  };
  function J(W) {
    return $[W] ?? null;
  }
  let U = {
      regex: "\u1EB9\u0300r\u1ECD \xECb\xE1w\u1ECDl\xE9",
      email: "\xE0d\xEDr\u1EB9\u0301s\xEC \xECm\u1EB9\u0301l\xEC",
      url: "URL",
      emoji: "emoji",
      uuid: "UUID",
      uuidv4: "UUIDv4",
      uuidv6: "UUIDv6",
      nanoid: "nanoid",
      guid: "GUID",
      cuid: "cuid",
      cuid2: "cuid2",
      ulid: "ULID",
      xid: "XID",
      ksuid: "KSUID",
      datetime: "\xE0k\xF3k\xF2 ISO",
      date: "\u1ECDj\u1ECD\u0301 ISO",
      time: "\xE0k\xF3k\xF2 ISO",
      duration: "\xE0k\xF3k\xF2 t\xF3 p\xE9 ISO",
      ipv4: "\xE0d\xEDr\u1EB9\u0301s\xEC IPv4",
      ipv6: "\xE0d\xEDr\u1EB9\u0301s\xEC IPv6",
      cidrv4: "\xE0gb\xE8gb\xE8 IPv4",
      cidrv6: "\xE0gb\xE8gb\xE8 IPv6",
      base64: "\u1ECD\u0300r\u1ECD\u0300 t\xED a k\u1ECD\u0301 n\xED base64",
      base64url: "\u1ECD\u0300r\u1ECD\u0300 base64url",
      json_string: "\u1ECD\u0300r\u1ECD\u0300 JSON",
      e164: "n\u1ECD\u0301mb\xE0 E.164",
      jwt: "JWT",
      template_literal: "\u1EB9\u0300r\u1ECD \xECb\xE1w\u1ECDl\xE9",
    },
    Q = { nan: "NaN", number: "n\u1ECD\u0301mb\xE0", array: "akop\u1ECD" };
  return (W) => {
    switch (W.code) {
      case "invalid_type": {
        let X = Q[W.expected] ?? W.expected,
          Y = U$(W.input),
          D = Q[Y] ?? Y;
        if (/^[A-Z]/.test(W.expected))
          return `\xCCb\xE1w\u1ECDl\xE9 a\u1E63\xEC\u1E63e: a n\xED l\xE1ti fi instanceof ${W.expected}, \xE0m\u1ECD\u0300 a r\xED ${D}`;
        return `\xCCb\xE1w\u1ECDl\xE9 a\u1E63\xEC\u1E63e: a n\xED l\xE1ti fi ${X}, \xE0m\u1ECD\u0300 a r\xED ${D}`;
      }
      case "invalid_value":
        if (W.values.length === 1)
          return `\xCCb\xE1w\u1ECDl\xE9 a\u1E63\xEC\u1E63e: a n\xED l\xE1ti fi ${$$(W.values[0])}`;
        return `\xC0\u1E63\xE0y\xE0n a\u1E63\xEC\u1E63e: yan \u1ECD\u0300kan l\xE1ra ${p(W.values, "|")}`;
      case "too_big": {
        let X = W.inclusive ? "<=" : "<",
          Y = J(W.origin);
        if (Y)
          return `T\xF3 p\u1ECD\u0300 j\xF9: a n\xED l\xE1ti j\u1EB9\u0301 p\xE9 ${W.origin ?? "iye"} ${Y.verb} ${X}${W.maximum} ${Y.unit}`;
        return `T\xF3 p\u1ECD\u0300 j\xF9: a n\xED l\xE1ti j\u1EB9\u0301 ${X}${W.maximum}`;
      }
      case "too_small": {
        let X = W.inclusive ? ">=" : ">",
          Y = J(W.origin);
        if (Y)
          return `K\xE9r\xE9 ju: a n\xED l\xE1ti j\u1EB9\u0301 p\xE9 ${W.origin} ${Y.verb} ${X}${W.minimum} ${Y.unit}`;
        return `K\xE9r\xE9 ju: a n\xED l\xE1ti j\u1EB9\u0301 ${X}${W.minimum}`;
      }
      case "invalid_format": {
        let X = W;
        if (X.format === "starts_with")
          return `\u1ECC\u0300r\u1ECD\u0300 a\u1E63\xEC\u1E63e: gb\u1ECD\u0301d\u1ECD\u0300 b\u1EB9\u0300r\u1EB9\u0300 p\u1EB9\u0300l\xFA "${X.prefix}"`;
        if (X.format === "ends_with")
          return `\u1ECC\u0300r\u1ECD\u0300 a\u1E63\xEC\u1E63e: gb\u1ECD\u0301d\u1ECD\u0300 par\xED p\u1EB9\u0300l\xFA "${X.suffix}"`;
        if (X.format === "includes")
          return `\u1ECC\u0300r\u1ECD\u0300 a\u1E63\xEC\u1E63e: gb\u1ECD\u0301d\u1ECD\u0300 n\xED "${X.includes}"`;
        if (X.format === "regex")
          return `\u1ECC\u0300r\u1ECD\u0300 a\u1E63\xEC\u1E63e: gb\u1ECD\u0301d\u1ECD\u0300 b\xE1 \xE0p\u1EB9\u1EB9r\u1EB9 mu ${X.pattern}`;
        return `A\u1E63\xEC\u1E63e: ${U[X.format] ?? W.format}`;
      }
      case "not_multiple_of":
        return `N\u1ECD\u0301mb\xE0 a\u1E63\xEC\u1E63e: gb\u1ECD\u0301d\u1ECD\u0300 j\u1EB9\u0301 \xE8y\xE0 p\xEDp\xEDn ti ${W.divisor}`;
      case "unrecognized_keys":
        return `B\u1ECDt\xECn\xEC \xE0\xECm\u1ECD\u0300: ${p(W.keys, ", ")}`;
      case "invalid_key":
        return `B\u1ECDt\xECn\xEC a\u1E63\xEC\u1E63e n\xEDn\xFA ${W.origin}`;
      case "invalid_union":
        return "\xCCb\xE1w\u1ECDl\xE9 a\u1E63\xEC\u1E63e";
      case "invalid_element":
        return `Iye a\u1E63\xEC\u1E63e n\xEDn\xFA ${W.origin}`;
      default:
        return "\xCCb\xE1w\u1ECDl\xE9 a\u1E63\xEC\u1E63e";
    }
  };
};
function zN() {
  return { localeError: X2() };
}
var Qw,
  BN = Symbol("ZodOutput"),
  EN = Symbol("ZodInput");
class LN {
  constructor() {
    ((this._map = new WeakMap()), (this._idmap = new Map()));
  }
  add($, ...J) {
    let U = J[0];
    if ((this._map.set($, U), U && typeof U === "object" && "id" in U)) this._idmap.set(U.id, $);
    return this;
  }
  clear() {
    return ((this._map = new WeakMap()), (this._idmap = new Map()), this);
  }
  remove($) {
    let J = this._map.get($);
    if (J && typeof J === "object" && "id" in J) this._idmap.delete(J.id);
    return (this._map.delete($), this);
  }
  get($) {
    let J = $._zod.parent;
    if (J) {
      let U = { ...(this.get(J) ?? {}) };
      delete U.id;
      let Q = { ...U, ...this._map.get($) };
      return Object.keys(Q).length ? Q : void 0;
    }
    return this._map.get($);
  }
  has($) {
    return this._map.has($);
  }
}
function KD() {
  return new LN();
}
(Qw = globalThis).__zod_globalRegistry ?? (Qw.__zod_globalRegistry = KD());
var f0 = globalThis.__zod_globalRegistry;
function ND($, J) {
  return new $({ type: "string", ...H$(J) });
}
function wN($, J) {
  return new $({ type: "string", coerce: !0, ...H$(J) });
}
function T7($, J) {
  return new $({ type: "string", format: "email", check: "string_format", abort: !1, ...H$(J) });
}
function VW($, J) {
  return new $({ type: "string", format: "guid", check: "string_format", abort: !1, ...H$(J) });
}
function j7($, J) {
  return new $({ type: "string", format: "uuid", check: "string_format", abort: !1, ...H$(J) });
}
function v7($, J) {
  return new $({ type: "string", format: "uuid", check: "string_format", abort: !1, version: "v4", ...H$(J) });
}
function b7($, J) {
  return new $({ type: "string", format: "uuid", check: "string_format", abort: !1, version: "v6", ...H$(J) });
}
function f7($, J) {
  return new $({ type: "string", format: "uuid", check: "string_format", abort: !1, version: "v7", ...H$(J) });
}
function kW($, J) {
  return new $({ type: "string", format: "url", check: "string_format", abort: !1, ...H$(J) });
}
function y7($, J) {
  return new $({ type: "string", format: "emoji", check: "string_format", abort: !1, ...H$(J) });
}
function x7($, J) {
  return new $({ type: "string", format: "nanoid", check: "string_format", abort: !1, ...H$(J) });
}
function g7($, J) {
  return new $({ type: "string", format: "cuid", check: "string_format", abort: !1, ...H$(J) });
}
function h7($, J) {
  return new $({ type: "string", format: "cuid2", check: "string_format", abort: !1, ...H$(J) });
}
function u7($, J) {
  return new $({ type: "string", format: "ulid", check: "string_format", abort: !1, ...H$(J) });
}
function l7($, J) {
  return new $({ type: "string", format: "xid", check: "string_format", abort: !1, ...H$(J) });
}
function m7($, J) {
  return new $({ type: "string", format: "ksuid", check: "string_format", abort: !1, ...H$(J) });
}
function p7($, J) {
  return new $({ type: "string", format: "ipv4", check: "string_format", abort: !1, ...H$(J) });
}
function d7($, J) {
  return new $({ type: "string", format: "ipv6", check: "string_format", abort: !1, ...H$(J) });
}
function OD($, J) {
  return new $({ type: "string", format: "mac", check: "string_format", abort: !1, ...H$(J) });
}
function c7($, J) {
  return new $({ type: "string", format: "cidrv4", check: "string_format", abort: !1, ...H$(J) });
}
function n7($, J) {
  return new $({ type: "string", format: "cidrv6", check: "string_format", abort: !1, ...H$(J) });
}
function i7($, J) {
  return new $({ type: "string", format: "base64", check: "string_format", abort: !1, ...H$(J) });
}
function o7($, J) {
  return new $({ type: "string", format: "base64url", check: "string_format", abort: !1, ...H$(J) });
}
function r7($, J) {
  return new $({ type: "string", format: "e164", check: "string_format", abort: !1, ...H$(J) });
}
function s7($, J) {
  return new $({ type: "string", format: "jwt", check: "string_format", abort: !1, ...H$(J) });
}
var IN = { Any: null, Minute: -1, Second: 0, Millisecond: 3, Microsecond: 6 };
function VN($, J) {
  return new $({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: !1,
    local: !1,
    precision: null,
    ...H$(J),
  });
}
function kN($, J) {
  return new $({ type: "string", format: "date", check: "string_format", ...H$(J) });
}
function AN($, J) {
  return new $({ type: "string", format: "time", check: "string_format", precision: null, ...H$(J) });
}
function MN($, J) {
  return new $({ type: "string", format: "duration", check: "string_format", ...H$(J) });
}
function FD($, J) {
  return new $({ type: "number", checks: [], ...H$(J) });
}
function RN($, J) {
  return new $({ type: "number", coerce: !0, checks: [], ...H$(J) });
}
function qD($, J) {
  return new $({ type: "number", check: "number_format", abort: !1, format: "safeint", ...H$(J) });
}
function zD($, J) {
  return new $({ type: "number", check: "number_format", abort: !1, format: "float32", ...H$(J) });
}
function BD($, J) {
  return new $({ type: "number", check: "number_format", abort: !1, format: "float64", ...H$(J) });
}
function ED($, J) {
  return new $({ type: "number", check: "number_format", abort: !1, format: "int32", ...H$(J) });
}
function LD($, J) {
  return new $({ type: "number", check: "number_format", abort: !1, format: "uint32", ...H$(J) });
}
function wD($, J) {
  return new $({ type: "boolean", ...H$(J) });
}
function ZN($, J) {
  return new $({ type: "boolean", coerce: !0, ...H$(J) });
}
function ID($, J) {
  return new $({ type: "bigint", ...H$(J) });
}
function PN($, J) {
  return new $({ type: "bigint", coerce: !0, ...H$(J) });
}
function VD($, J) {
  return new $({ type: "bigint", check: "bigint_format", abort: !1, format: "int64", ...H$(J) });
}
function kD($, J) {
  return new $({ type: "bigint", check: "bigint_format", abort: !1, format: "uint64", ...H$(J) });
}
function AD($, J) {
  return new $({ type: "symbol", ...H$(J) });
}
function MD($, J) {
  return new $({ type: "undefined", ...H$(J) });
}
function RD($, J) {
  return new $({ type: "null", ...H$(J) });
}
function ZD($) {
  return new $({ type: "any" });
}
function PD($) {
  return new $({ type: "unknown" });
}
function _D($, J) {
  return new $({ type: "never", ...H$(J) });
}
function SD($, J) {
  return new $({ type: "void", ...H$(J) });
}
function CD($, J) {
  return new $({ type: "date", ...H$(J) });
}
function _N($, J) {
  return new $({ type: "date", coerce: !0, ...H$(J) });
}
function TD($, J) {
  return new $({ type: "nan", ...H$(J) });
}
function AU($, J) {
  return new $Y({ check: "less_than", ...H$(J), value: $, inclusive: !1 });
}
function SJ($, J) {
  return new $Y({ check: "less_than", ...H$(J), value: $, inclusive: !0 });
}
function MU($, J) {
  return new JY({ check: "greater_than", ...H$(J), value: $, inclusive: !1 });
}
function UJ($, J) {
  return new JY({ check: "greater_than", ...H$(J), value: $, inclusive: !0 });
}
function jD($) {
  return MU(0, $);
}
function vD($) {
  return AU(0, $);
}
function bD($) {
  return SJ(0, $);
}
function fD($) {
  return UJ(0, $);
}
function k8($, J) {
  return new oK({ check: "multiple_of", ...H$(J), value: $ });
}
function A8($, J) {
  return new aK({ check: "max_size", ...H$(J), maximum: $ });
}
function RU($, J) {
  return new tK({ check: "min_size", ...H$(J), minimum: $ });
}
function E9($, J) {
  return new eK({ check: "size_equals", ...H$(J), size: $ });
}
function L9($, J) {
  return new $4({ check: "max_length", ...H$(J), maximum: $ });
}
function iU($, J) {
  return new J4({ check: "min_length", ...H$(J), minimum: $ });
}
function w9($, J) {
  return new U4({ check: "length_equals", ...H$(J), length: $ });
}
function AW($, J) {
  return new W4({ check: "string_format", format: "regex", ...H$(J), pattern: $ });
}
function MW($) {
  return new Q4({ check: "string_format", format: "lowercase", ...H$($) });
}
function RW($) {
  return new X4({ check: "string_format", format: "uppercase", ...H$($) });
}
function ZW($, J) {
  return new Y4({ check: "string_format", format: "includes", ...H$(J), includes: $ });
}
function PW($, J) {
  return new D4({ check: "string_format", format: "starts_with", ...H$(J), prefix: $ });
}
function _W($, J) {
  return new H4({ check: "string_format", format: "ends_with", ...H$(J), suffix: $ });
}
function yD($, J, U) {
  return new G4({ check: "property", property: $, schema: J, ...H$(U) });
}
function SW($, J) {
  return new K4({ check: "mime_type", mime: $, ...H$(J) });
}
function sJ($) {
  return new N4({ check: "overwrite", tx: $ });
}
function CW($) {
  return sJ((J) => J.normalize($));
}
function TW() {
  return sJ(($) => $.trim());
}
function jW() {
  return sJ(($) => $.toLowerCase());
}
function vW() {
  return sJ(($) => $.toUpperCase());
}
function bW() {
  return sJ(($) => KK($));
}
function SN($, J, U) {
  return new $({ type: "array", element: J, ...H$(U) });
}
function D2($, J, U) {
  return new $({ type: "union", options: J, ...H$(U) });
}
function H2($, J, U) {
  return new $({ type: "union", options: J, inclusive: !1, ...H$(U) });
}
function G2($, J, U, Q) {
  return new $({ type: "union", options: U, discriminator: J, ...H$(Q) });
}
function K2($, J, U) {
  return new $({ type: "intersection", left: J, right: U });
}
function N2($, J, U, Q) {
  let W = U instanceof $6;
  return new $({ type: "tuple", items: J, rest: W ? U : null, ...H$(W ? Q : U) });
}
function O2($, J, U, Q) {
  return new $({ type: "record", keyType: J, valueType: U, ...H$(Q) });
}
function F2($, J, U, Q) {
  return new $({ type: "map", keyType: J, valueType: U, ...H$(Q) });
}
function q2($, J, U) {
  return new $({ type: "set", valueType: J, ...H$(U) });
}
function z2($, J, U) {
  let Q = Array.isArray(J) ? Object.fromEntries(J.map((W) => [W, W])) : J;
  return new $({ type: "enum", entries: Q, ...H$(U) });
}
function B2($, J, U) {
  return new $({ type: "enum", entries: J, ...H$(U) });
}
function E2($, J, U) {
  return new $({ type: "literal", values: Array.isArray(J) ? J : [J], ...H$(U) });
}
function xD($, J) {
  return new $({ type: "file", ...H$(J) });
}
function L2($, J) {
  return new $({ type: "transform", transform: J });
}
function w2($, J) {
  return new $({ type: "optional", innerType: J });
}
function I2($, J) {
  return new $({ type: "nullable", innerType: J });
}
function V2($, J, U) {
  return new $({
    type: "default",
    innerType: J,
    get defaultValue() {
      return typeof U === "function" ? U() : dX(U);
    },
  });
}
function k2($, J, U) {
  return new $({ type: "nonoptional", innerType: J, ...H$(U) });
}
function A2($, J) {
  return new $({ type: "success", innerType: J });
}
function M2($, J, U) {
  return new $({ type: "catch", innerType: J, catchValue: typeof U === "function" ? U : () => U });
}
function R2($, J, U) {
  return new $({ type: "pipe", in: J, out: U });
}
function Z2($, J) {
  return new $({ type: "readonly", innerType: J });
}
function P2($, J, U) {
  return new $({ type: "template_literal", parts: J, ...H$(U) });
}
function _2($, J) {
  return new $({ type: "lazy", getter: J });
}
function S2($, J) {
  return new $({ type: "promise", innerType: J });
}
function gD($, J, U) {
  let Q = H$(U);
  return (Q.abort ?? (Q.abort = !0), new $({ type: "custom", check: "custom", fn: J, ...Q }));
}
function hD($, J, U) {
  return new $({ type: "custom", check: "custom", fn: J, ...H$(U) });
}
function uD($, J) {
  let U = Xw((Q) => {
    return (
      (Q.addIssue = (W) => {
        if (typeof W === "string") Q.issues.push(KW(W, Q.value, U._zod.def));
        else {
          let X = W;
          if (X.fatal) X.continue = !1;
          (X.code ?? (X.code = "custom"),
            X.input ?? (X.input = Q.value),
            X.inst ?? (X.inst = U),
            X.continue ?? (X.continue = !U._zod.def.abort),
            Q.issues.push(KW(X)));
        }
      }),
      $(Q.value, Q)
    );
  }, J);
  return U;
}
function Xw($, J) {
  let U = new n6({ check: "custom", ...H$(J) });
  return ((U._zod.check = $), U);
}
function lD($) {
  let J = new n6({ check: "describe" });
  return (
    (J._zod.onattach = [
      (U) => {
        let Q = f0.get(U) ?? {};
        f0.add(U, { ...Q, description: $ });
      },
    ]),
    (J._zod.check = () => {}),
    J
  );
}
function mD($) {
  let J = new n6({ check: "meta" });
  return (
    (J._zod.onattach = [
      (U) => {
        let Q = f0.get(U) ?? {};
        f0.add(U, { ...Q, ...$ });
      },
    ]),
    (J._zod.check = () => {}),
    J
  );
}
function pD($, J) {
  let U = H$(J),
    Q = U.truthy ?? ["true", "1", "yes", "on", "y", "enabled"],
    W = U.falsy ?? ["false", "0", "no", "off", "n", "disabled"];
  if (U.case !== "sensitive")
    ((Q = Q.map((F) => (typeof F === "string" ? F.toLowerCase() : F))),
      (W = W.map((F) => (typeof F === "string" ? F.toLowerCase() : F))));
  let X = new Set(Q),
    Y = new Set(W),
    D = $.Codec ?? LW,
    H = $.Boolean ?? BW,
    K = new ($.String ?? V8)({ type: "string", error: U.error }),
    O = new H({ type: "boolean", error: U.error }),
    N = new D({
      type: "pipe",
      in: K,
      out: O,
      transform: (F, B) => {
        let E = F;
        if (U.case !== "sensitive") E = E.toLowerCase();
        if (X.has(E)) return !0;
        else if (Y.has(E)) return !1;
        else
          return (
            B.issues.push({
              code: "invalid_value",
              expected: "stringbool",
              values: [...X, ...Y],
              input: B.value,
              inst: N,
              continue: !1,
            }),
            {}
          );
      },
      reverseTransform: (F, B) => {
        if (F === !0) return Q[0] || "true";
        else return W[0] || "false";
      },
      error: U.error,
    });
  return N;
}
function I9($, J, U, Q = {}) {
  let W = H$(Q),
    X = {
      ...H$(Q),
      check: "string_format",
      type: "string",
      format: J,
      fn: typeof U === "function" ? U : (D) => U.test(D),
      ...W,
    };
  if (U instanceof RegExp) X.pattern = U;
  return new $(X);
}
function M8($) {
  let J = $?.target ?? "draft-2020-12";
  if (J === "draft-4") J = "draft-04";
  if (J === "draft-7") J = "draft-07";
  return {
    processors: $.processors ?? {},
    metadataRegistry: $?.metadata ?? f0,
    target: J,
    unrepresentable: $?.unrepresentable ?? "throw",
    override: $?.override ?? (() => {}),
    io: $?.io ?? "output",
    counter: 0,
    seen: new Map(),
    cycles: $?.cycles ?? "ref",
    reused: $?.reused ?? "inline",
    external: $?.external ?? void 0,
  };
}
function g6($, J, U = { path: [], schemaPath: [] }) {
  var Q;
  let W = $._zod.def,
    X = J.seen.get($);
  if (X) {
    if ((X.count++, U.schemaPath.includes($))) X.cycle = U.path;
    return X.schema;
  }
  let Y = { schema: {}, count: 1, cycle: void 0, path: U.path };
  J.seen.set($, Y);
  let D = $._zod.toJSONSchema?.();
  if (D) Y.schema = D;
  else {
    let K = { ...U, schemaPath: [...U.schemaPath, $], path: U.path };
    if ($._zod.processJSONSchema) $._zod.processJSONSchema(J, Y.schema, K);
    else {
      let N = Y.schema,
        F = J.processors[W.type];
      if (!F) throw Error(`[toJSONSchema]: Non-representable type encountered: ${W.type}`);
      F($, J, N, K);
    }
    let O = $._zod.parent;
    if (O) {
      if (!Y.ref) Y.ref = O;
      (g6(O, J, K), (J.seen.get(O).isParent = !0));
    }
  }
  let H = J.metadataRegistry.get($);
  if (H) Object.assign(Y.schema, H);
  if (J.io === "input" && WJ($)) (delete Y.schema.examples, delete Y.schema.default);
  if (J.io === "input" && "_prefault" in Y.schema) (Q = Y.schema).default ?? (Q.default = Y.schema._prefault);
  return (delete Y.schema._prefault, J.seen.get($).schema);
}
function R8($, J) {
  let U = $.seen.get(J);
  if (!U) throw Error("Unprocessed schema. This is a bug in Zod.");
  let Q = new Map();
  for (let Y of $.seen.entries()) {
    let D = $.metadataRegistry.get(Y[0])?.id;
    if (D) {
      let H = Q.get(D);
      if (H && H !== Y[0])
        throw Error(
          `Duplicate schema id "${D}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`,
        );
      Q.set(D, Y[0]);
    }
  }
  let W = (Y) => {
      let D = $.target === "draft-2020-12" ? "$defs" : "definitions";
      if ($.external) {
        let O = $.external.registry.get(Y[0])?.id,
          N = $.external.uri ?? ((B) => B);
        if (O) return { ref: N(O) };
        let F = Y[1].defId ?? Y[1].schema.id ?? `schema${$.counter++}`;
        return ((Y[1].defId = F), { defId: F, ref: `${N("__shared")}#/${D}/${F}` });
      }
      if (Y[1] === U) return { ref: "#" };
      let G = `${"#"}/${D}/`,
        K = Y[1].schema.id ?? `__schema${$.counter++}`;
      return { defId: K, ref: G + K };
    },
    X = (Y) => {
      if (Y[1].schema.$ref) return;
      let D = Y[1],
        { ref: H, defId: G } = W(Y);
      if (((D.def = { ...D.schema }), G)) D.defId = G;
      let K = D.schema;
      for (let O in K) delete K[O];
      K.$ref = H;
    };
  if ($.cycles === "throw")
    for (let Y of $.seen.entries()) {
      let D = Y[1];
      if (D.cycle)
        throw Error(`Cycle detected: #/${D.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
    }
  for (let Y of $.seen.entries()) {
    let D = Y[1];
    if (J === Y[0]) {
      X(Y);
      continue;
    }
    if ($.external) {
      let G = $.external.registry.get(Y[0])?.id;
      if (J !== Y[0] && G) {
        X(Y);
        continue;
      }
    }
    if ($.metadataRegistry.get(Y[0])?.id) {
      X(Y);
      continue;
    }
    if (D.cycle) {
      X(Y);
      continue;
    }
    if (D.count > 1) {
      if ($.reused === "ref") {
        X(Y);
        continue;
      }
    }
  }
}
function Z8($, J) {
  let U = $.seen.get(J);
  if (!U) throw Error("Unprocessed schema. This is a bug in Zod.");
  let Q = (D) => {
    let H = $.seen.get(D);
    if (H.ref === null) return;
    let G = H.def ?? H.schema,
      K = { ...G },
      O = H.ref;
    if (((H.ref = null), O)) {
      Q(O);
      let F = $.seen.get(O),
        B = F.schema;
      if (B.$ref && ($.target === "draft-07" || $.target === "draft-04" || $.target === "openapi-3.0"))
        ((G.allOf = G.allOf ?? []), G.allOf.push(B));
      else Object.assign(G, B);
      if ((Object.assign(G, K), D._zod.parent === O))
        for (let z in G) {
          if (z === "$ref" || z === "allOf") continue;
          if (!(z in K)) delete G[z];
        }
      if (B.$ref && F.def)
        for (let z in G) {
          if (z === "$ref" || z === "allOf") continue;
          if (z in F.def && JSON.stringify(G[z]) === JSON.stringify(F.def[z])) delete G[z];
        }
    }
    let N = D._zod.parent;
    if (N && N !== O) {
      Q(N);
      let F = $.seen.get(N);
      if (F?.schema.$ref) {
        if (((G.$ref = F.schema.$ref), F.def))
          for (let B in G) {
            if (B === "$ref" || B === "allOf") continue;
            if (B in F.def && JSON.stringify(G[B]) === JSON.stringify(F.def[B])) delete G[B];
          }
      }
    }
    $.override({ zodSchema: D, jsonSchema: G, path: H.path ?? [] });
  };
  for (let D of [...$.seen.entries()].reverse()) Q(D[0]);
  let W = {};
  if ($.target === "draft-2020-12") W.$schema = "https://json-schema.org/draft/2020-12/schema";
  else if ($.target === "draft-07") W.$schema = "http://json-schema.org/draft-07/schema#";
  else if ($.target === "draft-04") W.$schema = "http://json-schema.org/draft-04/schema#";
  else if ($.target === "openapi-3.0");
  if ($.external?.uri) {
    let D = $.external.registry.get(J)?.id;
    if (!D) throw Error("Schema is missing an `id` property");
    W.$id = $.external.uri(D);
  }
  Object.assign(W, U.def ?? U.schema);
  let X = $.metadataRegistry.get(J)?.id;
  if (X !== void 0 && W.id === X) delete W.id;
  let Y = $.external?.defs ?? {};
  for (let D of $.seen.entries()) {
    let H = D[1];
    if (H.def && H.defId) {
      if (H.def.id === H.defId) delete H.def.id;
      Y[H.defId] = H.def;
    }
  }
  if ($.external);
  else if (Object.keys(Y).length > 0)
    if ($.target === "draft-2020-12") W.$defs = Y;
    else W.definitions = Y;
  try {
    let D = JSON.parse(JSON.stringify(W));
    return (
      Object.defineProperty(D, "~standard", {
        value: {
          ...J["~standard"],
          jsonSchema: { input: fW(J, "input", $.processors), output: fW(J, "output", $.processors) },
        },
        enumerable: !1,
        writable: !1,
      }),
      D
    );
  } catch (D) {
    throw Error("Error converting schema to JSON.");
  }
}
function WJ($, J) {
  let U = J ?? { seen: new Set() };
  if (U.seen.has($)) return !1;
  U.seen.add($);
  let Q = $._zod.def;
  if (Q.type === "transform") return !0;
  if (Q.type === "array") return WJ(Q.element, U);
  if (Q.type === "set") return WJ(Q.valueType, U);
  if (Q.type === "lazy") return WJ(Q.getter(), U);
  if (
    Q.type === "promise" ||
    Q.type === "optional" ||
    Q.type === "nonoptional" ||
    Q.type === "nullable" ||
    Q.type === "readonly" ||
    Q.type === "default" ||
    Q.type === "prefault"
  )
    return WJ(Q.innerType, U);
  if (Q.type === "intersection") return WJ(Q.left, U) || WJ(Q.right, U);
  if (Q.type === "record" || Q.type === "map") return WJ(Q.keyType, U) || WJ(Q.valueType, U);
  if (Q.type === "pipe") {
    if ($._zod.traits.has("$ZodCodec")) return !0;
    return WJ(Q.in, U) || WJ(Q.out, U);
  }
  if (Q.type === "object") {
    for (let W in Q.shape) if (WJ(Q.shape[W], U)) return !0;
    return !1;
  }
  if (Q.type === "union") {
    for (let W of Q.options) if (WJ(W, U)) return !0;
    return !1;
  }
  if (Q.type === "tuple") {
    for (let W of Q.items) if (WJ(W, U)) return !0;
    if (Q.rest && WJ(Q.rest, U)) return !0;
    return !1;
  }
  return !1;
}
var CN =
    ($, J = {}) =>
    (U) => {
      let Q = M8({ ...U, processors: J });
      return (g6($, Q), R8(Q, $), Z8(Q, $));
    },
  fW =
    ($, J, U = {}) =>
    (Q) => {
      let { libraryOptions: W, target: X } = Q ?? {},
        Y = M8({ ...(W ?? {}), target: X, io: J, processors: U });
      return (g6($, Y), R8(Y, $), Z8(Y, $));
    };
var C2 = { guid: "uuid", url: "uri", datetime: "date-time", json_string: "json-string", regex: "" },
  TN = ($, J, U, Q) => {
    let W = U;
    W.type = "string";
    let { minimum: X, maximum: Y, format: D, patterns: H, contentEncoding: G } = $._zod.bag;
    if (typeof X === "number") W.minLength = X;
    if (typeof Y === "number") W.maxLength = Y;
    if (D) {
      if (((W.format = C2[D] ?? D), W.format === "")) delete W.format;
      if (D === "time") delete W.format;
    }
    if (G) W.contentEncoding = G;
    if (H && H.size > 0) {
      let K = [...H];
      if (K.length === 1) W.pattern = K[0].source;
      else if (K.length > 1)
        W.allOf = [
          ...K.map((O) => ({
            ...(J.target === "draft-07" || J.target === "draft-04" || J.target === "openapi-3.0"
              ? { type: "string" }
              : {}),
            pattern: O.source,
          })),
        ];
    }
  },
  jN = ($, J, U, Q) => {
    let W = U,
      { minimum: X, maximum: Y, format: D, multipleOf: H, exclusiveMaximum: G, exclusiveMinimum: K } = $._zod.bag;
    if (typeof D === "string" && D.includes("int")) W.type = "integer";
    else W.type = "number";
    let O = typeof K === "number" && K >= (X ?? Number.NEGATIVE_INFINITY),
      N = typeof G === "number" && G <= (Y ?? Number.POSITIVE_INFINITY),
      F = J.target === "draft-04" || J.target === "openapi-3.0";
    if (O)
      if (F) ((W.minimum = K), (W.exclusiveMinimum = !0));
      else W.exclusiveMinimum = K;
    else if (typeof X === "number") W.minimum = X;
    if (N)
      if (F) ((W.maximum = G), (W.exclusiveMaximum = !0));
      else W.exclusiveMaximum = G;
    else if (typeof Y === "number") W.maximum = Y;
    if (typeof H === "number") W.multipleOf = H;
  },
  vN = ($, J, U, Q) => {
    U.type = "boolean";
  },
  bN = ($, J, U, Q) => {
    if (J.unrepresentable === "throw") throw Error("BigInt cannot be represented in JSON Schema");
  },
  fN = ($, J, U, Q) => {
    if (J.unrepresentable === "throw") throw Error("Symbols cannot be represented in JSON Schema");
  },
  yN = ($, J, U, Q) => {
    if (J.target === "openapi-3.0") ((U.type = "string"), (U.nullable = !0), (U.enum = [null]));
    else U.type = "null";
  },
  xN = ($, J, U, Q) => {
    if (J.unrepresentable === "throw") throw Error("Undefined cannot be represented in JSON Schema");
  },
  gN = ($, J, U, Q) => {
    if (J.unrepresentable === "throw") throw Error("Void cannot be represented in JSON Schema");
  },
  hN = ($, J, U, Q) => {
    U.not = {};
  },
  uN = ($, J, U, Q) => {},
  lN = ($, J, U, Q) => {},
  mN = ($, J, U, Q) => {
    if (J.unrepresentable === "throw") throw Error("Date cannot be represented in JSON Schema");
  },
  pN = ($, J, U, Q) => {
    let W = $._zod.def,
      X = N7(W.entries);
    if (X.every((Y) => typeof Y === "number")) U.type = "number";
    if (X.every((Y) => typeof Y === "string")) U.type = "string";
    U.enum = X;
  },
  dN = ($, J, U, Q) => {
    let W = $._zod.def,
      X = [];
    for (let Y of W.values)
      if (Y === void 0) {
        if (J.unrepresentable === "throw") throw Error("Literal `undefined` cannot be represented in JSON Schema");
      } else if (typeof Y === "bigint")
        if (J.unrepresentable === "throw") throw Error("BigInt literals cannot be represented in JSON Schema");
        else X.push(Number(Y));
      else X.push(Y);
    if (X.length === 0);
    else if (X.length === 1) {
      let Y = X[0];
      if (((U.type = Y === null ? "null" : typeof Y), J.target === "draft-04" || J.target === "openapi-3.0"))
        U.enum = [Y];
      else U.const = Y;
    } else {
      if (X.every((Y) => typeof Y === "number")) U.type = "number";
      if (X.every((Y) => typeof Y === "string")) U.type = "string";
      if (X.every((Y) => typeof Y === "boolean")) U.type = "boolean";
      if (X.every((Y) => Y === null)) U.type = "null";
      U.enum = X;
    }
  },
  cN = ($, J, U, Q) => {
    if (J.unrepresentable === "throw") throw Error("NaN cannot be represented in JSON Schema");
  },
  nN = ($, J, U, Q) => {
    let W = U,
      X = $._zod.pattern;
    if (!X) throw Error("Pattern not found in template literal");
    ((W.type = "string"), (W.pattern = X.source));
  },
  iN = ($, J, U, Q) => {
    let W = U,
      X = { type: "string", format: "binary", contentEncoding: "binary" },
      { minimum: Y, maximum: D, mime: H } = $._zod.bag;
    if (Y !== void 0) X.minLength = Y;
    if (D !== void 0) X.maxLength = D;
    if (H)
      if (H.length === 1) ((X.contentMediaType = H[0]), Object.assign(W, X));
      else (Object.assign(W, X), (W.anyOf = H.map((G) => ({ contentMediaType: G }))));
    else Object.assign(W, X);
  },
  oN = ($, J, U, Q) => {
    U.type = "boolean";
  },
  rN = ($, J, U, Q) => {
    if (J.unrepresentable === "throw") throw Error("Custom types cannot be represented in JSON Schema");
  },
  sN = ($, J, U, Q) => {
    if (J.unrepresentable === "throw") throw Error("Function types cannot be represented in JSON Schema");
  },
  aN = ($, J, U, Q) => {
    if (J.unrepresentable === "throw") throw Error("Transforms cannot be represented in JSON Schema");
  },
  tN = ($, J, U, Q) => {
    if (J.unrepresentable === "throw") throw Error("Map cannot be represented in JSON Schema");
  },
  eN = ($, J, U, Q) => {
    if (J.unrepresentable === "throw") throw Error("Set cannot be represented in JSON Schema");
  },
  $O = ($, J, U, Q) => {
    let W = U,
      X = $._zod.def,
      { minimum: Y, maximum: D } = $._zod.bag;
    if (typeof Y === "number") W.minItems = Y;
    if (typeof D === "number") W.maxItems = D;
    ((W.type = "array"), (W.items = g6(X.element, J, { ...Q, path: [...Q.path, "items"] })));
  },
  JO = ($, J, U, Q) => {
    let W = U,
      X = $._zod.def;
    ((W.type = "object"), (W.properties = {}));
    let Y = X.shape;
    for (let G in Y) W.properties[G] = g6(Y[G], J, { ...Q, path: [...Q.path, "properties", G] });
    let D = new Set(Object.keys(Y)),
      H = new Set(
        [...D].filter((G) => {
          let K = X.shape[G]._zod;
          if (J.io === "input") return K.optin === void 0;
          else return K.optout === void 0;
        }),
      );
    if (H.size > 0) W.required = Array.from(H);
    if (X.catchall?._zod.def.type === "never") W.additionalProperties = !1;
    else if (!X.catchall) {
      if (J.io === "output") W.additionalProperties = !1;
    } else if (X.catchall)
      W.additionalProperties = g6(X.catchall, J, { ...Q, path: [...Q.path, "additionalProperties"] });
  },
  cD = ($, J, U, Q) => {
    let W = $._zod.def,
      X = W.inclusive === !1,
      Y = W.options.map((D, H) => g6(D, J, { ...Q, path: [...Q.path, X ? "oneOf" : "anyOf", H] }));
    if (X) U.oneOf = Y;
    else U.anyOf = Y;
  },
  UO = ($, J, U, Q) => {
    let W = $._zod.def,
      X = g6(W.left, J, { ...Q, path: [...Q.path, "allOf", 0] }),
      Y = g6(W.right, J, { ...Q, path: [...Q.path, "allOf", 1] }),
      D = (G) => "allOf" in G && Object.keys(G).length === 1,
      H = [...(D(X) ? X.allOf : [X]), ...(D(Y) ? Y.allOf : [Y])];
    U.allOf = H;
  },
  WO = ($, J, U, Q) => {
    let W = U,
      X = $._zod.def;
    W.type = "array";
    let Y = J.target === "draft-2020-12" ? "prefixItems" : "items",
      D = J.target === "draft-2020-12" ? "items" : J.target === "openapi-3.0" ? "items" : "additionalItems",
      H = X.items.map((N, F) => g6(N, J, { ...Q, path: [...Q.path, Y, F] })),
      G = X.rest
        ? g6(X.rest, J, { ...Q, path: [...Q.path, D, ...(J.target === "openapi-3.0" ? [X.items.length] : [])] })
        : null;
    if (J.target === "draft-2020-12") {
      if (((W.prefixItems = H), G)) W.items = G;
    } else if (J.target === "openapi-3.0") {
      if (((W.items = { anyOf: H }), G)) W.items.anyOf.push(G);
      if (((W.minItems = H.length), !G)) W.maxItems = H.length;
    } else if (((W.items = H), G)) W.additionalItems = G;
    let { minimum: K, maximum: O } = $._zod.bag;
    if (typeof K === "number") W.minItems = K;
    if (typeof O === "number") W.maxItems = O;
  },
  QO = ($, J, U, Q) => {
    let W = U,
      X = $._zod.def;
    W.type = "object";
    let Y = X.keyType,
      H = Y._zod.bag?.patterns;
    if (X.mode === "loose" && H && H.size > 0) {
      let K = g6(X.valueType, J, { ...Q, path: [...Q.path, "patternProperties", "*"] });
      W.patternProperties = {};
      for (let O of H) W.patternProperties[O.source] = K;
    } else {
      if (J.target === "draft-07" || J.target === "draft-2020-12")
        W.propertyNames = g6(X.keyType, J, { ...Q, path: [...Q.path, "propertyNames"] });
      W.additionalProperties = g6(X.valueType, J, { ...Q, path: [...Q.path, "additionalProperties"] });
    }
    let G = Y._zod.values;
    if (G) {
      let K = [...G].filter((O) => typeof O === "string" || typeof O === "number");
      if (K.length > 0) W.required = K;
    }
  },
  XO = ($, J, U, Q) => {
    let W = $._zod.def,
      X = g6(W.innerType, J, Q),
      Y = J.seen.get($);
    if (J.target === "openapi-3.0") ((Y.ref = W.innerType), (U.nullable = !0));
    else U.anyOf = [X, { type: "null" }];
  },
  YO = ($, J, U, Q) => {
    let W = $._zod.def;
    g6(W.innerType, J, Q);
    let X = J.seen.get($);
    X.ref = W.innerType;
  },
  DO = ($, J, U, Q) => {
    let W = $._zod.def;
    g6(W.innerType, J, Q);
    let X = J.seen.get($);
    ((X.ref = W.innerType), (U.default = JSON.parse(JSON.stringify(W.defaultValue))));
  },
  HO = ($, J, U, Q) => {
    let W = $._zod.def;
    g6(W.innerType, J, Q);
    let X = J.seen.get($);
    if (((X.ref = W.innerType), J.io === "input")) U._prefault = JSON.parse(JSON.stringify(W.defaultValue));
  },
  GO = ($, J, U, Q) => {
    let W = $._zod.def;
    g6(W.innerType, J, Q);
    let X = J.seen.get($);
    X.ref = W.innerType;
    let Y;
    try {
      Y = W.catchValue(void 0);
    } catch {
      throw Error("Dynamic catch values are not supported in JSON Schema");
    }
    U.default = Y;
  },
  KO = ($, J, U, Q) => {
    let W = $._zod.def,
      X = W.in._zod.traits.has("$ZodTransform"),
      Y = J.io === "input" ? (X ? W.out : W.in) : W.out;
    g6(Y, J, Q);
    let D = J.seen.get($);
    D.ref = Y;
  },
  NO = ($, J, U, Q) => {
    let W = $._zod.def;
    g6(W.innerType, J, Q);
    let X = J.seen.get($);
    ((X.ref = W.innerType), (U.readOnly = !0));
  },
  OO = ($, J, U, Q) => {
    let W = $._zod.def;
    g6(W.innerType, J, Q);
    let X = J.seen.get($);
    X.ref = W.innerType;
  },
  nD = ($, J, U, Q) => {
    let W = $._zod.def;
    g6(W.innerType, J, Q);
    let X = J.seen.get($);
    X.ref = W.innerType;
  },
  FO = ($, J, U, Q) => {
    let W = $._zod.innerType;
    g6(W, J, Q);
    let X = J.seen.get($);
    X.ref = W;
  },
  dD = {
    string: TN,
    number: jN,
    boolean: vN,
    bigint: bN,
    symbol: fN,
    null: yN,
    undefined: xN,
    void: gN,
    never: hN,
    any: uN,
    unknown: lN,
    date: mN,
    enum: pN,
    literal: dN,
    nan: cN,
    template_literal: nN,
    file: iN,
    success: oN,
    custom: rN,
    function: sN,
    transform: aN,
    map: tN,
    set: eN,
    array: $O,
    object: JO,
    union: cD,
    intersection: UO,
    tuple: WO,
    record: QO,
    nullable: XO,
    nonoptional: YO,
    default: DO,
    prefault: HO,
    catch: GO,
    pipe: KO,
    readonly: NO,
    promise: OO,
    optional: nD,
    lazy: FO,
  };
function V9($, J) {
  if ("_idmap" in $) {
    let Q = $,
      W = M8({ ...J, processors: dD }),
      X = {};
    for (let H of Q._idmap.entries()) {
      let [G, K] = H;
      g6(K, W);
    }
    let Y = {},
      D = { registry: Q, uri: J?.uri, defs: X };
    W.external = D;
    for (let H of Q._idmap.entries()) {
      let [G, K] = H;
      (R8(W, K), (Y[G] = Z8(W, K)));
    }
    if (Object.keys(X).length > 0) {
      let H = W.target === "draft-2020-12" ? "$defs" : "definitions";
      Y.__shared = { [H]: X };
    }
    return { schemas: Y };
  }
  let U = M8({ ...J, processors: dD });
  return (g6($, U), R8(U, $), Z8(U, $));
}
class qO {
  get metadataRegistry() {
    return this.ctx.metadataRegistry;
  }
  get target() {
    return this.ctx.target;
  }
  get unrepresentable() {
    return this.ctx.unrepresentable;
  }
  get override() {
    return this.ctx.override;
  }
  get io() {
    return this.ctx.io;
  }
  get counter() {
    return this.ctx.counter;
  }
  set counter($) {
    this.ctx.counter = $;
  }
  get seen() {
    return this.ctx.seen;
  }
  constructor($) {
    let J = $?.target ?? "draft-2020-12";
    if (J === "draft-4") J = "draft-04";
    if (J === "draft-7") J = "draft-07";
    this.ctx = M8({
      processors: dD,
      target: J,
      ...($?.metadata && { metadata: $.metadata }),
      ...($?.unrepresentable && { unrepresentable: $.unrepresentable }),
      ...($?.override && { override: $.override }),
      ...($?.io && { io: $.io }),
    });
  }
  process($, J = { path: [], schemaPath: [] }) {
    return g6($, this.ctx, J);
  }
  emit($, J) {
    if (J) {
      if (J.cycles) this.ctx.cycles = J.cycles;
      if (J.reused) this.ctx.reused = J.reused;
      if (J.external) this.ctx.external = J.external;
    }
    R8(this.ctx, $);
    let U = Z8(this.ctx, $),
      { "~standard": Q, ...W } = U;
    return W;
  }
}
var Yw = {};
var v2 = v("ZodMiniType", ($, J) => {
  if (!$._zod) throw Error("Uninitialized schema in ZodMiniType.");
  ($6.init($, J),
    ($.def = J),
    ($.type = J.type),
    ($.parse = (U, Q) => q9($, U, Q, { callee: $.parse })),
    ($.safeParse = (U, Q) => w8($, U, Q)),
    ($.parseAsync = async (U, Q) => z9($, U, Q, { callee: $.parseAsync })),
    ($.safeParseAsync = async (U, Q) => I8($, U, Q)),
    ($.check = (...U) => {
      return $.clone(
        {
          ...J,
          checks: [
            ...(J.checks ?? []),
            ...U.map((Q) =>
              typeof Q === "function" ? { _zod: { check: Q, def: { check: "custom" }, onattach: [] } } : Q,
            ),
          ],
        },
        { parent: !0 },
      );
    }),
    ($.with = $.check),
    ($.clone = (U, Q) => b0($, U, Q)),
    ($.brand = () => $),
    ($.register = (U, Q) => {
      return (U.add($, Q), $);
    }),
    ($.apply = (U) => U($)));
});
var b2 = v("ZodMiniObject", ($, J) => {
  (hY.init($, J), v2.init($, J), N6($, "shape", () => J.shape));
});
function zO($, J) {
  let U = { type: "object", shape: $ ?? {}, ...H$(J) };
  return new b2(U);
}
function xJ($) {
  return !!$._zod;
}
function k9($) {
  let J = Object.values($);
  if (J.length === 0) return zO({});
  let U = J.every(xJ),
    Q = J.every((W) => !xJ(W));
  if (U) return zO($);
  if (Q) return HL($);
  throw Error("Mixed Zod versions detected in object shape.");
}
function P8($, J) {
  if (xJ($)) return w8($, J);
  return $.safeParse(J);
}
async function iD($, J) {
  if (xJ($)) return await I8($, J);
  return await $.safeParseAsync(J);
}
function _8($) {
  if (!$) return;
  let J;
  if (xJ($)) J = $._zod?.def?.shape;
  else J = $.shape;
  if (!J) return;
  if (typeof J === "function")
    try {
      return J();
    } catch {
      return;
    }
  return J;
}
function yW($) {
  if (!$) return;
  if (typeof $ === "object") {
    let J = $,
      U = $;
    if (!J._def && !U._zod) {
      let Q = Object.values($);
      if (
        Q.length > 0 &&
        Q.every(
          (W) =>
            typeof W === "object" &&
            W !== null &&
            (W._def !== void 0 || W._zod !== void 0 || typeof W.parse === "function"),
        )
      )
        return k9($);
    }
  }
  if (xJ($)) {
    let U = $._zod?.def;
    if (U && (U.type === "object" || U.shape !== void 0)) return $;
  } else if ($.shape !== void 0) return $;
  return;
}
function oD($) {
  if ($ && typeof $ === "object") {
    if ("message" in $ && typeof $.message === "string") return $.message;
    if ("issues" in $ && Array.isArray($.issues) && $.issues.length > 0) {
      let J = $.issues[0];
      if (J && typeof J === "object" && "message" in J) return String(J.message);
    }
    try {
      return JSON.stringify($);
    } catch {
      return String($);
    }
  }
  return String($);
}
function Dw($) {
  return $.description;
}
function Hw($) {
  if (xJ($)) return $._zod?.def?.type === "optional";
  let J = $;
  if (typeof $.isOptional === "function") return $.isOptional();
  return J._def?.typeName === "ZodOptional";
}
function rD($) {
  if (xJ($)) {
    let X = $._zod?.def;
    if (X) {
      if (X.value !== void 0) return X.value;
      if (Array.isArray(X.values) && X.values.length > 0) return X.values[0];
    }
  }
  let U = $._def;
  if (U) {
    if (U.value !== void 0) return U.value;
    if (Array.isArray(U.values) && U.values.length > 0) return U.values[0];
  }
  let Q = $.value;
  if (Q !== void 0) return Q;
  return;
}
var B$ = {};
uU(B$, {
  xor: () => ew,
  xid: () => Mw,
  void: () => rw,
  uuidv7: () => Bw,
  uuidv6: () => zw,
  uuidv4: () => qw,
  uuid: () => Fw,
  util: () => Q$,
  url: () => Ew,
  uppercase: () => RW,
  unknown: () => o6,
  union: () => r6,
  undefined: () => iw,
  ulid: () => Aw,
  uint64: () => cw,
  uint32: () => mw,
  tuple: () => cO,
  trim: () => TW,
  treeifyError: () => EK,
  transform: () => kH,
  toUpperCase: () => vW,
  toLowerCase: () => jW,
  toJSONSchema: () => V9,
  templateLiteral: () => NI,
  symbol: () => nw,
  superRefine: () => LF,
  success: () => DI,
  stringbool: () => LI,
  stringFormat: () => fw,
  string: () => c,
  strictObject: () => tw,
  startsWith: () => PW,
  slugify: () => bW,
  size: () => E9,
  setErrorMap: () => h2,
  set: () => WI,
  safeParseAsync: () => AO,
  safeParse: () => kO,
  safeEncodeAsync: () => CO,
  safeEncode: () => _O,
  safeDecodeAsync: () => TO,
  safeDecode: () => SO,
  registry: () => KD,
  regexes: () => BJ,
  regex: () => AW,
  refine: () => EF,
  record: () => u6,
  readonly: () => NF,
  property: () => yD,
  promise: () => OI,
  prettifyError: () => LK,
  preprocess: () => KQ,
  prefault: () => WF,
  positive: () => jD,
  pipe: () => UH,
  partialRecord: () => $I,
  parseAsync: () => VO,
  parse: () => IO,
  overwrite: () => sJ,
  optional: () => J0,
  object: () => _$,
  number: () => v6,
  nullish: () => YI,
  nullable: () => e7,
  null: () => UQ,
  normalize: () => CW,
  nonpositive: () => bD,
  nonoptional: () => QF,
  nonnegative: () => fD,
  never: () => VH,
  negative: () => vD,
  nativeEnum: () => QI,
  nanoid: () => Iw,
  nan: () => HI,
  multipleOf: () => k8,
  minSize: () => RU,
  minLength: () => iU,
  mime: () => SW,
  meta: () => BI,
  maxSize: () => A8,
  maxLength: () => L9,
  map: () => UI,
  mac: () => Pw,
  lte: () => SJ,
  lt: () => AU,
  lowercase: () => MW,
  looseRecord: () => JI,
  looseObject: () => y0,
  locales: () => IW,
  literal: () => x$,
  length: () => w9,
  lazy: () => qF,
  ksuid: () => Rw,
  keyof: () => aw,
  jwt: () => bw,
  json: () => wI,
  iso: () => S8,
  ipv6: () => _w,
  ipv4: () => Zw,
  invertCodec: () => KI,
  intersection: () => dW,
  int64: () => dw,
  int32: () => lw,
  int: () => JH,
  instanceof: () => EI,
  includes: () => ZW,
  httpUrl: () => Lw,
  hostname: () => yw,
  hex: () => xw,
  hash: () => gw,
  guid: () => Ow,
  gte: () => UJ,
  gt: () => MU,
  globalRegistry: () => f0,
  getErrorMap: () => u2,
  function: () => FI,
  fromJSONSchema: () => VI,
  formatError: () => L7,
  float64: () => uw,
  float32: () => hw,
  flattenError: () => E7,
  file: () => XI,
  exactOptional: () => tO,
  enum: () => x0,
  endsWith: () => _W,
  encodeAsync: () => ZO,
  encode: () => MO,
  emoji: () => ww,
  email: () => Nw,
  e164: () => vw,
  discriminatedUnion: () => YQ,
  describe: () => zI,
  decodeAsync: () => PO,
  decode: () => RO,
  date: () => sw,
  custom: () => MH,
  cuid2: () => kw,
  cuid: () => Vw,
  core: () => aJ,
  config: () => E0,
  coerce: () => IF,
  codec: () => GI,
  clone: () => b0,
  cidrv6: () => Cw,
  cidrv4: () => Sw,
  check: () => qI,
  catch: () => DF,
  boolean: () => V0,
  bigint: () => pw,
  base64url: () => jw,
  base64: () => Tw,
  array: () => w6,
  any: () => ow,
  _function: () => FI,
  _default: () => JF,
  _ZodString: () => WH,
  ZodXor: () => lO,
  ZodXID: () => KH,
  ZodVoid: () => hO,
  ZodUnknown: () => xO,
  ZodUnion: () => XQ,
  ZodUndefined: () => bO,
  ZodUUID: () => ZU,
  ZodURL: () => JQ,
  ZodULID: () => GH,
  ZodType: () => G6,
  ZodTuple: () => dO,
  ZodTransform: () => sO,
  ZodTemplateLiteral: () => OF,
  ZodSymbol: () => vO,
  ZodSuccess: () => XF,
  ZodStringFormat: () => i6,
  ZodString: () => hW,
  ZodSet: () => iO,
  ZodRecord: () => xW,
  ZodRealError: () => EJ,
  ZodReadonly: () => KF,
  ZodPromise: () => zF,
  ZodPreprocess: () => GF,
  ZodPrefault: () => UF,
  ZodPipe: () => DQ,
  ZodOptional: () => cW,
  ZodObject: () => QQ,
  ZodNumberFormat: () => A9,
  ZodNumber: () => lW,
  ZodNullable: () => eO,
  ZodNull: () => fO,
  ZodNonOptional: () => AH,
  ZodNever: () => gO,
  ZodNanoID: () => YH,
  ZodNaN: () => HF,
  ZodMap: () => nO,
  ZodMAC: () => jO,
  ZodLiteral: () => oO,
  ZodLazy: () => FF,
  ZodKSUID: () => NH,
  ZodJWT: () => wH,
  ZodIssueCode: () => g2,
  ZodIntersection: () => pO,
  ZodISOTime: () => eD,
  ZodISODuration: () => $H,
  ZodISODateTime: () => aD,
  ZodISODate: () => tD,
  ZodIPv6: () => FH,
  ZodIPv4: () => OH,
  ZodGUID: () => t7,
  ZodFunction: () => BF,
  ZodFirstPartyTypeKind: () => wF,
  ZodFile: () => rO,
  ZodExactOptional: () => aO,
  ZodError: () => y2,
  ZodEnum: () => gW,
  ZodEmoji: () => XH,
  ZodEmail: () => QH,
  ZodE164: () => LH,
  ZodDiscriminatedUnion: () => mO,
  ZodDefault: () => $F,
  ZodDate: () => WQ,
  ZodCustomStringFormat: () => uW,
  ZodCustom: () => GQ,
  ZodCodec: () => HQ,
  ZodCatch: () => YF,
  ZodCUID2: () => HH,
  ZodCUID: () => DH,
  ZodCIDRv6: () => zH,
  ZodCIDRv4: () => qH,
  ZodBoolean: () => mW,
  ZodBigIntFormat: () => IH,
  ZodBigInt: () => pW,
  ZodBase64URL: () => EH,
  ZodBase64: () => BH,
  ZodArray: () => uO,
  ZodAny: () => yO,
  TimePrecision: () => IN,
  NEVER: () => YK,
  $output: () => BN,
  $input: () => EN,
  $brand: () => DK,
});
var a7 = {};
uU(a7, {
  xor: () => ew,
  xid: () => Mw,
  void: () => rw,
  uuidv7: () => Bw,
  uuidv6: () => zw,
  uuidv4: () => qw,
  uuid: () => Fw,
  url: () => Ew,
  unknown: () => o6,
  union: () => r6,
  undefined: () => iw,
  ulid: () => Aw,
  uint64: () => cw,
  uint32: () => mw,
  tuple: () => cO,
  transform: () => kH,
  templateLiteral: () => NI,
  symbol: () => nw,
  superRefine: () => LF,
  success: () => DI,
  stringbool: () => LI,
  stringFormat: () => fw,
  string: () => c,
  strictObject: () => tw,
  set: () => WI,
  refine: () => EF,
  record: () => u6,
  readonly: () => NF,
  promise: () => OI,
  preprocess: () => KQ,
  prefault: () => WF,
  pipe: () => UH,
  partialRecord: () => $I,
  optional: () => J0,
  object: () => _$,
  number: () => v6,
  nullish: () => YI,
  nullable: () => e7,
  null: () => UQ,
  nonoptional: () => QF,
  never: () => VH,
  nativeEnum: () => QI,
  nanoid: () => Iw,
  nan: () => HI,
  meta: () => BI,
  map: () => UI,
  mac: () => Pw,
  looseRecord: () => JI,
  looseObject: () => y0,
  literal: () => x$,
  lazy: () => qF,
  ksuid: () => Rw,
  keyof: () => aw,
  jwt: () => bw,
  json: () => wI,
  ipv6: () => _w,
  ipv4: () => Zw,
  invertCodec: () => KI,
  intersection: () => dW,
  int64: () => dw,
  int32: () => lw,
  int: () => JH,
  instanceof: () => EI,
  httpUrl: () => Lw,
  hostname: () => yw,
  hex: () => xw,
  hash: () => gw,
  guid: () => Ow,
  function: () => FI,
  float64: () => uw,
  float32: () => hw,
  file: () => XI,
  exactOptional: () => tO,
  enum: () => x0,
  emoji: () => ww,
  email: () => Nw,
  e164: () => vw,
  discriminatedUnion: () => YQ,
  describe: () => zI,
  date: () => sw,
  custom: () => MH,
  cuid2: () => kw,
  cuid: () => Vw,
  codec: () => GI,
  cidrv6: () => Cw,
  cidrv4: () => Sw,
  check: () => qI,
  catch: () => DF,
  boolean: () => V0,
  bigint: () => pw,
  base64url: () => jw,
  base64: () => Tw,
  array: () => w6,
  any: () => ow,
  _function: () => FI,
  _default: () => JF,
  _ZodString: () => WH,
  ZodXor: () => lO,
  ZodXID: () => KH,
  ZodVoid: () => hO,
  ZodUnknown: () => xO,
  ZodUnion: () => XQ,
  ZodUndefined: () => bO,
  ZodUUID: () => ZU,
  ZodURL: () => JQ,
  ZodULID: () => GH,
  ZodType: () => G6,
  ZodTuple: () => dO,
  ZodTransform: () => sO,
  ZodTemplateLiteral: () => OF,
  ZodSymbol: () => vO,
  ZodSuccess: () => XF,
  ZodStringFormat: () => i6,
  ZodString: () => hW,
  ZodSet: () => iO,
  ZodRecord: () => xW,
  ZodReadonly: () => KF,
  ZodPromise: () => zF,
  ZodPreprocess: () => GF,
  ZodPrefault: () => UF,
  ZodPipe: () => DQ,
  ZodOptional: () => cW,
  ZodObject: () => QQ,
  ZodNumberFormat: () => A9,
  ZodNumber: () => lW,
  ZodNullable: () => eO,
  ZodNull: () => fO,
  ZodNonOptional: () => AH,
  ZodNever: () => gO,
  ZodNanoID: () => YH,
  ZodNaN: () => HF,
  ZodMap: () => nO,
  ZodMAC: () => jO,
  ZodLiteral: () => oO,
  ZodLazy: () => FF,
  ZodKSUID: () => NH,
  ZodJWT: () => wH,
  ZodIntersection: () => pO,
  ZodIPv6: () => FH,
  ZodIPv4: () => OH,
  ZodGUID: () => t7,
  ZodFunction: () => BF,
  ZodFile: () => rO,
  ZodExactOptional: () => aO,
  ZodEnum: () => gW,
  ZodEmoji: () => XH,
  ZodEmail: () => QH,
  ZodE164: () => LH,
  ZodDiscriminatedUnion: () => mO,
  ZodDefault: () => $F,
  ZodDate: () => WQ,
  ZodCustomStringFormat: () => uW,
  ZodCustom: () => GQ,
  ZodCodec: () => HQ,
  ZodCatch: () => YF,
  ZodCUID2: () => HH,
  ZodCUID: () => DH,
  ZodCIDRv6: () => zH,
  ZodCIDRv4: () => qH,
  ZodBoolean: () => mW,
  ZodBigIntFormat: () => IH,
  ZodBigInt: () => pW,
  ZodBase64URL: () => EH,
  ZodBase64: () => BH,
  ZodArray: () => uO,
  ZodAny: () => yO,
});
var sD = {};
uU(sD, {
  uppercase: () => RW,
  trim: () => TW,
  toUpperCase: () => vW,
  toLowerCase: () => jW,
  startsWith: () => PW,
  slugify: () => bW,
  size: () => E9,
  regex: () => AW,
  property: () => yD,
  positive: () => jD,
  overwrite: () => sJ,
  normalize: () => CW,
  nonpositive: () => bD,
  nonnegative: () => fD,
  negative: () => vD,
  multipleOf: () => k8,
  minSize: () => RU,
  minLength: () => iU,
  mime: () => SW,
  maxSize: () => A8,
  maxLength: () => L9,
  lte: () => SJ,
  lt: () => AU,
  lowercase: () => MW,
  length: () => w9,
  includes: () => ZW,
  gte: () => UJ,
  gt: () => MU,
  endsWith: () => _W,
});
var S8 = {};
uU(S8, {
  time: () => LO,
  duration: () => wO,
  datetime: () => BO,
  date: () => EO,
  ZodISOTime: () => eD,
  ZodISODuration: () => $H,
  ZodISODateTime: () => aD,
  ZodISODate: () => tD,
});
var aD = v("ZodISODateTime", ($, J) => {
  (q4.init($, J), i6.init($, J));
});
function BO($) {
  return VN(aD, $);
}
var tD = v("ZodISODate", ($, J) => {
  (z4.init($, J), i6.init($, J));
});
function EO($) {
  return kN(tD, $);
}
var eD = v("ZodISOTime", ($, J) => {
  (B4.init($, J), i6.init($, J));
});
function LO($) {
  return AN(eD, $);
}
var $H = v("ZodISODuration", ($, J) => {
  (E4.init($, J), i6.init($, J));
});
function wO($) {
  return MN($H, $);
}
var Gw = ($, J) => {
    (B7.init($, J),
      ($.name = "ZodError"),
      Object.defineProperties($, {
        format: { value: (U) => L7($, U) },
        flatten: { value: (U) => E7($, U) },
        addIssue: {
          value: (U) => {
            ($.issues.push(U), ($.message = JSON.stringify($.issues, HW, 2)));
          },
        },
        addIssues: {
          value: (U) => {
            ($.issues.push(...U), ($.message = JSON.stringify($.issues, HW, 2)));
          },
        },
        isEmpty: {
          get() {
            return $.issues.length === 0;
          },
        },
      }));
  },
  y2 = v("ZodError", Gw),
  EJ = v("ZodError", Gw, { Parent: Error });
var IO = NW(EJ),
  VO = OW(EJ),
  kO = FW(EJ),
  AO = qW(EJ),
  MO = cX(EJ),
  RO = nX(EJ),
  ZO = iX(EJ),
  PO = oX(EJ),
  _O = rX(EJ),
  SO = sX(EJ),
  CO = aX(EJ),
  TO = tX(EJ);
var Kw = new WeakMap();
function $Q($, J, U) {
  let Q = Object.getPrototypeOf($),
    W = Kw.get(Q);
  if (!W) ((W = new Set()), Kw.set(Q, W));
  if (W.has(J)) return;
  W.add(J);
  for (let X in U) {
    let Y = U[X];
    Object.defineProperty(Q, X, {
      configurable: !0,
      enumerable: !1,
      get() {
        let D = Y.bind(this);
        return (Object.defineProperty(this, X, { configurable: !0, writable: !0, enumerable: !0, value: D }), D);
      },
      set(D) {
        Object.defineProperty(this, X, { configurable: !0, writable: !0, enumerable: !0, value: D });
      },
    });
  }
}
var G6 = v("ZodType", ($, J) => {
    return (
      $6.init($, J),
      Object.assign($["~standard"], { jsonSchema: { input: fW($, "input"), output: fW($, "output") } }),
      ($.toJSONSchema = CN($, {})),
      ($.def = J),
      ($.type = J.type),
      Object.defineProperty($, "_def", { value: J }),
      ($.parse = (U, Q) => IO($, U, Q, { callee: $.parse })),
      ($.safeParse = (U, Q) => kO($, U, Q)),
      ($.parseAsync = async (U, Q) => VO($, U, Q, { callee: $.parseAsync })),
      ($.safeParseAsync = async (U, Q) => AO($, U, Q)),
      ($.spa = $.safeParseAsync),
      ($.encode = (U, Q) => MO($, U, Q)),
      ($.decode = (U, Q) => RO($, U, Q)),
      ($.encodeAsync = async (U, Q) => ZO($, U, Q)),
      ($.decodeAsync = async (U, Q) => PO($, U, Q)),
      ($.safeEncode = (U, Q) => _O($, U, Q)),
      ($.safeDecode = (U, Q) => SO($, U, Q)),
      ($.safeEncodeAsync = async (U, Q) => CO($, U, Q)),
      ($.safeDecodeAsync = async (U, Q) => TO($, U, Q)),
      $Q($, "ZodType", {
        check(...U) {
          let Q = this.def;
          return this.clone(
            Q$.mergeDefs(Q, {
              checks: [
                ...(Q.checks ?? []),
                ...U.map((W) =>
                  typeof W === "function" ? { _zod: { check: W, def: { check: "custom" }, onattach: [] } } : W,
                ),
              ],
            }),
            { parent: !0 },
          );
        },
        with(...U) {
          return this.check(...U);
        },
        clone(U, Q) {
          return b0(this, U, Q);
        },
        brand() {
          return this;
        },
        register(U, Q) {
          return (U.add(this, Q), this);
        },
        refine(U, Q) {
          return this.check(EF(U, Q));
        },
        superRefine(U, Q) {
          return this.check(LF(U, Q));
        },
        overwrite(U) {
          return this.check(sJ(U));
        },
        optional() {
          return J0(this);
        },
        exactOptional() {
          return tO(this);
        },
        nullable() {
          return e7(this);
        },
        nullish() {
          return J0(e7(this));
        },
        nonoptional(U) {
          return QF(this, U);
        },
        array() {
          return w6(this);
        },
        or(U) {
          return r6([this, U]);
        },
        and(U) {
          return dW(this, U);
        },
        transform(U) {
          return UH(this, kH(U));
        },
        default(U) {
          return JF(this, U);
        },
        prefault(U) {
          return WF(this, U);
        },
        catch(U) {
          return DF(this, U);
        },
        pipe(U) {
          return UH(this, U);
        },
        readonly() {
          return NF(this);
        },
        describe(U) {
          let Q = this.clone();
          return (f0.add(Q, { description: U }), Q);
        },
        meta(...U) {
          if (U.length === 0) return f0.get(this);
          let Q = this.clone();
          return (f0.add(Q, U[0]), Q);
        },
        isOptional() {
          return this.safeParse(void 0).success;
        },
        isNullable() {
          return this.safeParse(null).success;
        },
        apply(U) {
          return U(this);
        },
      }),
      Object.defineProperty($, "description", {
        get() {
          return f0.get($)?.description;
        },
        configurable: !0,
      }),
      $
    );
  }),
  WH = v("_ZodString", ($, J) => {
    (V8.init($, J), G6.init($, J), ($._zod.processJSONSchema = (Q, W, X) => TN($, Q, W, X)));
    let U = $._zod.bag;
    (($.format = U.format ?? null),
      ($.minLength = U.minimum ?? null),
      ($.maxLength = U.maximum ?? null),
      $Q($, "_ZodString", {
        regex(...Q) {
          return this.check(AW(...Q));
        },
        includes(...Q) {
          return this.check(ZW(...Q));
        },
        startsWith(...Q) {
          return this.check(PW(...Q));
        },
        endsWith(...Q) {
          return this.check(_W(...Q));
        },
        min(...Q) {
          return this.check(iU(...Q));
        },
        max(...Q) {
          return this.check(L9(...Q));
        },
        length(...Q) {
          return this.check(w9(...Q));
        },
        nonempty(...Q) {
          return this.check(iU(1, ...Q));
        },
        lowercase(Q) {
          return this.check(MW(Q));
        },
        uppercase(Q) {
          return this.check(RW(Q));
        },
        trim() {
          return this.check(TW());
        },
        normalize(...Q) {
          return this.check(CW(...Q));
        },
        toLowerCase() {
          return this.check(jW());
        },
        toUpperCase() {
          return this.check(vW());
        },
        slugify() {
          return this.check(bW());
        },
      }));
  }),
  hW = v("ZodString", ($, J) => {
    (V8.init($, J),
      WH.init($, J),
      ($.email = (U) => $.check(T7(QH, U))),
      ($.url = (U) => $.check(kW(JQ, U))),
      ($.jwt = (U) => $.check(s7(wH, U))),
      ($.emoji = (U) => $.check(y7(XH, U))),
      ($.guid = (U) => $.check(VW(t7, U))),
      ($.uuid = (U) => $.check(j7(ZU, U))),
      ($.uuidv4 = (U) => $.check(v7(ZU, U))),
      ($.uuidv6 = (U) => $.check(b7(ZU, U))),
      ($.uuidv7 = (U) => $.check(f7(ZU, U))),
      ($.nanoid = (U) => $.check(x7(YH, U))),
      ($.guid = (U) => $.check(VW(t7, U))),
      ($.cuid = (U) => $.check(g7(DH, U))),
      ($.cuid2 = (U) => $.check(h7(HH, U))),
      ($.ulid = (U) => $.check(u7(GH, U))),
      ($.base64 = (U) => $.check(i7(BH, U))),
      ($.base64url = (U) => $.check(o7(EH, U))),
      ($.xid = (U) => $.check(l7(KH, U))),
      ($.ksuid = (U) => $.check(m7(NH, U))),
      ($.ipv4 = (U) => $.check(p7(OH, U))),
      ($.ipv6 = (U) => $.check(d7(FH, U))),
      ($.cidrv4 = (U) => $.check(c7(qH, U))),
      ($.cidrv6 = (U) => $.check(n7(zH, U))),
      ($.e164 = (U) => $.check(r7(LH, U))),
      ($.datetime = (U) => $.check(BO(U))),
      ($.date = (U) => $.check(EO(U))),
      ($.time = (U) => $.check(LO(U))),
      ($.duration = (U) => $.check(wO(U))));
  });
function c($) {
  return ND(hW, $);
}
var i6 = v("ZodStringFormat", ($, J) => {
    (h6.init($, J), WH.init($, J));
  }),
  QH = v("ZodEmail", ($, J) => {
    (GY.init($, J), i6.init($, J));
  });
function Nw($) {
  return T7(QH, $);
}
var t7 = v("ZodGUID", ($, J) => {
  (DY.init($, J), i6.init($, J));
});
function Ow($) {
  return VW(t7, $);
}
var ZU = v("ZodUUID", ($, J) => {
  (HY.init($, J), i6.init($, J));
});
function Fw($) {
  return j7(ZU, $);
}
function qw($) {
  return v7(ZU, $);
}
function zw($) {
  return b7(ZU, $);
}
function Bw($) {
  return f7(ZU, $);
}
var JQ = v("ZodURL", ($, J) => {
  (KY.init($, J), i6.init($, J));
});
function Ew($) {
  return kW(JQ, $);
}
function Lw($) {
  return kW(JQ, { protocol: BJ.httpProtocol, hostname: BJ.domain, ...Q$.normalizeParams($) });
}
var XH = v("ZodEmoji", ($, J) => {
  (NY.init($, J), i6.init($, J));
});
function ww($) {
  return y7(XH, $);
}
var YH = v("ZodNanoID", ($, J) => {
  (OY.init($, J), i6.init($, J));
});
function Iw($) {
  return x7(YH, $);
}
var DH = v("ZodCUID", ($, J) => {
  (FY.init($, J), i6.init($, J));
});
function Vw($) {
  return g7(DH, $);
}
var HH = v("ZodCUID2", ($, J) => {
  (qY.init($, J), i6.init($, J));
});
function kw($) {
  return h7(HH, $);
}
var GH = v("ZodULID", ($, J) => {
  (zY.init($, J), i6.init($, J));
});
function Aw($) {
  return u7(GH, $);
}
var KH = v("ZodXID", ($, J) => {
  (BY.init($, J), i6.init($, J));
});
function Mw($) {
  return l7(KH, $);
}
var NH = v("ZodKSUID", ($, J) => {
  (EY.init($, J), i6.init($, J));
});
function Rw($) {
  return m7(NH, $);
}
var OH = v("ZodIPv4", ($, J) => {
  (LY.init($, J), i6.init($, J));
});
function Zw($) {
  return p7(OH, $);
}
var jO = v("ZodMAC", ($, J) => {
  (IY.init($, J), i6.init($, J));
});
function Pw($) {
  return OD(jO, $);
}
var FH = v("ZodIPv6", ($, J) => {
  (wY.init($, J), i6.init($, J));
});
function _w($) {
  return d7(FH, $);
}
var qH = v("ZodCIDRv4", ($, J) => {
  (VY.init($, J), i6.init($, J));
});
function Sw($) {
  return c7(qH, $);
}
var zH = v("ZodCIDRv6", ($, J) => {
  (kY.init($, J), i6.init($, J));
});
function Cw($) {
  return n7(zH, $);
}
var BH = v("ZodBase64", ($, J) => {
  (AY.init($, J), i6.init($, J));
});
function Tw($) {
  return i7(BH, $);
}
var EH = v("ZodBase64URL", ($, J) => {
  (MY.init($, J), i6.init($, J));
});
function jw($) {
  return o7(EH, $);
}
var LH = v("ZodE164", ($, J) => {
  (RY.init($, J), i6.init($, J));
});
function vw($) {
  return r7(LH, $);
}
var wH = v("ZodJWT", ($, J) => {
  (ZY.init($, J), i6.init($, J));
});
function bw($) {
  return s7(wH, $);
}
var uW = v("ZodCustomStringFormat", ($, J) => {
  (PY.init($, J), i6.init($, J));
});
function fw($, J, U = {}) {
  return I9(uW, $, J, U);
}
function yw($) {
  return I9(uW, "hostname", BJ.hostname, $);
}
function xw($) {
  return I9(uW, "hex", BJ.hex, $);
}
function gw($, J) {
  let U = J?.enc ?? "hex",
    Q = `${$}_${U}`,
    W = BJ[Q];
  if (!W) throw Error(`Unrecognized hash format: ${Q}`);
  return I9(uW, Q, W, J);
}
var lW = v("ZodNumber", ($, J) => {
  (k7.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (Q, W, X) => jN($, Q, W, X)),
    $Q($, "ZodNumber", {
      gt(Q, W) {
        return this.check(MU(Q, W));
      },
      gte(Q, W) {
        return this.check(UJ(Q, W));
      },
      min(Q, W) {
        return this.check(UJ(Q, W));
      },
      lt(Q, W) {
        return this.check(AU(Q, W));
      },
      lte(Q, W) {
        return this.check(SJ(Q, W));
      },
      max(Q, W) {
        return this.check(SJ(Q, W));
      },
      int(Q) {
        return this.check(JH(Q));
      },
      safe(Q) {
        return this.check(JH(Q));
      },
      positive(Q) {
        return this.check(MU(0, Q));
      },
      nonnegative(Q) {
        return this.check(UJ(0, Q));
      },
      negative(Q) {
        return this.check(AU(0, Q));
      },
      nonpositive(Q) {
        return this.check(SJ(0, Q));
      },
      multipleOf(Q, W) {
        return this.check(k8(Q, W));
      },
      step(Q, W) {
        return this.check(k8(Q, W));
      },
      finite() {
        return this;
      },
    }));
  let U = $._zod.bag;
  (($.minValue =
    Math.max(U.minimum ?? Number.NEGATIVE_INFINITY, U.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null),
    ($.maxValue =
      Math.min(U.maximum ?? Number.POSITIVE_INFINITY, U.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null),
    ($.isInt = (U.format ?? "").includes("int") || Number.isSafeInteger(U.multipleOf ?? 0.5)),
    ($.isFinite = !0),
    ($.format = U.format ?? null));
});
function v6($) {
  return FD(lW, $);
}
var A9 = v("ZodNumberFormat", ($, J) => {
  (_Y.init($, J), lW.init($, J));
});
function JH($) {
  return qD(A9, $);
}
function hw($) {
  return zD(A9, $);
}
function uw($) {
  return BD(A9, $);
}
function lw($) {
  return ED(A9, $);
}
function mw($) {
  return LD(A9, $);
}
var mW = v("ZodBoolean", ($, J) => {
  (BW.init($, J), G6.init($, J), ($._zod.processJSONSchema = (U, Q, W) => vN($, U, Q, W)));
});
function V0($) {
  return wD(mW, $);
}
var pW = v("ZodBigInt", ($, J) => {
  (A7.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (Q, W, X) => bN($, Q, W, X)),
    ($.gte = (Q, W) => $.check(UJ(Q, W))),
    ($.min = (Q, W) => $.check(UJ(Q, W))),
    ($.gt = (Q, W) => $.check(MU(Q, W))),
    ($.gte = (Q, W) => $.check(UJ(Q, W))),
    ($.min = (Q, W) => $.check(UJ(Q, W))),
    ($.lt = (Q, W) => $.check(AU(Q, W))),
    ($.lte = (Q, W) => $.check(SJ(Q, W))),
    ($.max = (Q, W) => $.check(SJ(Q, W))),
    ($.positive = (Q) => $.check(MU(BigInt(0), Q))),
    ($.negative = (Q) => $.check(AU(BigInt(0), Q))),
    ($.nonpositive = (Q) => $.check(SJ(BigInt(0), Q))),
    ($.nonnegative = (Q) => $.check(UJ(BigInt(0), Q))),
    ($.multipleOf = (Q, W) => $.check(k8(Q, W))));
  let U = $._zod.bag;
  (($.minValue = U.minimum ?? null), ($.maxValue = U.maximum ?? null), ($.format = U.format ?? null));
});
function pw($) {
  return ID(pW, $);
}
var IH = v("ZodBigIntFormat", ($, J) => {
  (SY.init($, J), pW.init($, J));
});
function dw($) {
  return VD(IH, $);
}
function cw($) {
  return kD(IH, $);
}
var vO = v("ZodSymbol", ($, J) => {
  (CY.init($, J), G6.init($, J), ($._zod.processJSONSchema = (U, Q, W) => fN($, U, Q, W)));
});
function nw($) {
  return AD(vO, $);
}
var bO = v("ZodUndefined", ($, J) => {
  (TY.init($, J), G6.init($, J), ($._zod.processJSONSchema = (U, Q, W) => xN($, U, Q, W)));
});
function iw($) {
  return MD(bO, $);
}
var fO = v("ZodNull", ($, J) => {
  (jY.init($, J), G6.init($, J), ($._zod.processJSONSchema = (U, Q, W) => yN($, U, Q, W)));
});
function UQ($) {
  return RD(fO, $);
}
var yO = v("ZodAny", ($, J) => {
  (vY.init($, J), G6.init($, J), ($._zod.processJSONSchema = (U, Q, W) => uN($, U, Q, W)));
});
function ow() {
  return ZD(yO);
}
var xO = v("ZodUnknown", ($, J) => {
  (bY.init($, J), G6.init($, J), ($._zod.processJSONSchema = (U, Q, W) => lN($, U, Q, W)));
});
function o6() {
  return PD(xO);
}
var gO = v("ZodNever", ($, J) => {
  (fY.init($, J), G6.init($, J), ($._zod.processJSONSchema = (U, Q, W) => hN($, U, Q, W)));
});
function VH($) {
  return _D(gO, $);
}
var hO = v("ZodVoid", ($, J) => {
  (yY.init($, J), G6.init($, J), ($._zod.processJSONSchema = (U, Q, W) => gN($, U, Q, W)));
});
function rw($) {
  return SD(hO, $);
}
var WQ = v("ZodDate", ($, J) => {
  (xY.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (Q, W, X) => mN($, Q, W, X)),
    ($.min = (Q, W) => $.check(UJ(Q, W))),
    ($.max = (Q, W) => $.check(SJ(Q, W))));
  let U = $._zod.bag;
  (($.minDate = U.minimum ? new Date(U.minimum) : null), ($.maxDate = U.maximum ? new Date(U.maximum) : null));
});
function sw($) {
  return CD(WQ, $);
}
var uO = v("ZodArray", ($, J) => {
  (gY.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (U, Q, W) => $O($, U, Q, W)),
    ($.element = J.element),
    $Q($, "ZodArray", {
      min(U, Q) {
        return this.check(iU(U, Q));
      },
      nonempty(U) {
        return this.check(iU(1, U));
      },
      max(U, Q) {
        return this.check(L9(U, Q));
      },
      length(U, Q) {
        return this.check(w9(U, Q));
      },
      unwrap() {
        return this.element;
      },
    }));
});
function w6($, J) {
  return SN(uO, $, J);
}
function aw($) {
  let J = $._zod.def.shape;
  return x0(Object.keys(J));
}
var QQ = v("ZodObject", ($, J) => {
  (w4.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (U, Q, W) => JO($, U, Q, W)),
    Q$.defineLazy($, "shape", () => {
      return J.shape;
    }),
    $Q($, "ZodObject", {
      keyof() {
        return x0(Object.keys(this._zod.def.shape));
      },
      catchall(U) {
        return this.clone({ ...this._zod.def, catchall: U });
      },
      passthrough() {
        return this.clone({ ...this._zod.def, catchall: o6() });
      },
      loose() {
        return this.clone({ ...this._zod.def, catchall: o6() });
      },
      strict() {
        return this.clone({ ...this._zod.def, catchall: VH() });
      },
      strip() {
        return this.clone({ ...this._zod.def, catchall: void 0 });
      },
      extend(U) {
        return Q$.extend(this, U);
      },
      safeExtend(U) {
        return Q$.safeExtend(this, U);
      },
      merge(U) {
        return Q$.merge(this, U);
      },
      pick(U) {
        return Q$.pick(this, U);
      },
      omit(U) {
        return Q$.omit(this, U);
      },
      partial(...U) {
        return Q$.partial(cW, this, U[0]);
      },
      required(...U) {
        return Q$.required(AH, this, U[0]);
      },
    }));
});
function _$($, J) {
  let U = { type: "object", shape: $ ?? {}, ...Q$.normalizeParams(J) };
  return new QQ(U);
}
function tw($, J) {
  return new QQ({ type: "object", shape: $, catchall: VH(), ...Q$.normalizeParams(J) });
}
function y0($, J) {
  return new QQ({ type: "object", shape: $, catchall: o6(), ...Q$.normalizeParams(J) });
}
var XQ = v("ZodUnion", ($, J) => {
  (EW.init($, J), G6.init($, J), ($._zod.processJSONSchema = (U, Q, W) => cD($, U, Q, W)), ($.options = J.options));
});
function r6($, J) {
  return new XQ({ type: "union", options: $, ...Q$.normalizeParams(J) });
}
var lO = v("ZodXor", ($, J) => {
  (XQ.init($, J), uY.init($, J), ($._zod.processJSONSchema = (U, Q, W) => cD($, U, Q, W)), ($.options = J.options));
});
function ew($, J) {
  return new lO({ type: "union", options: $, inclusive: !1, ...Q$.normalizeParams(J) });
}
var mO = v("ZodDiscriminatedUnion", ($, J) => {
  (XQ.init($, J), lY.init($, J));
});
function YQ($, J, U) {
  return new mO({ type: "union", options: J, discriminator: $, ...Q$.normalizeParams(U) });
}
var pO = v("ZodIntersection", ($, J) => {
  (mY.init($, J), G6.init($, J), ($._zod.processJSONSchema = (U, Q, W) => UO($, U, Q, W)));
});
function dW($, J) {
  return new pO({ type: "intersection", left: $, right: J });
}
var dO = v("ZodTuple", ($, J) => {
  (M7.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (U, Q, W) => WO($, U, Q, W)),
    ($.rest = (U) => $.clone({ ...$._zod.def, rest: U })));
});
function cO($, J, U) {
  let Q = J instanceof $6,
    W = Q ? U : J;
  return new dO({ type: "tuple", items: $, rest: Q ? J : null, ...Q$.normalizeParams(W) });
}
var xW = v("ZodRecord", ($, J) => {
  (pY.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (U, Q, W) => QO($, U, Q, W)),
    ($.keyType = J.keyType),
    ($.valueType = J.valueType));
});
function u6($, J, U) {
  if (!J || !J._zod) return new xW({ type: "record", keyType: c(), valueType: $, ...Q$.normalizeParams(J) });
  return new xW({ type: "record", keyType: $, valueType: J, ...Q$.normalizeParams(U) });
}
function $I($, J, U) {
  let Q = b0($);
  return ((Q._zod.values = void 0), new xW({ type: "record", keyType: Q, valueType: J, ...Q$.normalizeParams(U) }));
}
function JI($, J, U) {
  return new xW({ type: "record", keyType: $, valueType: J, mode: "loose", ...Q$.normalizeParams(U) });
}
var nO = v("ZodMap", ($, J) => {
  (dY.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (U, Q, W) => tN($, U, Q, W)),
    ($.keyType = J.keyType),
    ($.valueType = J.valueType),
    ($.min = (...U) => $.check(RU(...U))),
    ($.nonempty = (U) => $.check(RU(1, U))),
    ($.max = (...U) => $.check(A8(...U))),
    ($.size = (...U) => $.check(E9(...U))));
});
function UI($, J, U) {
  return new nO({ type: "map", keyType: $, valueType: J, ...Q$.normalizeParams(U) });
}
var iO = v("ZodSet", ($, J) => {
  (cY.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (U, Q, W) => eN($, U, Q, W)),
    ($.min = (...U) => $.check(RU(...U))),
    ($.nonempty = (U) => $.check(RU(1, U))),
    ($.max = (...U) => $.check(A8(...U))),
    ($.size = (...U) => $.check(E9(...U))));
});
function WI($, J) {
  return new iO({ type: "set", valueType: $, ...Q$.normalizeParams(J) });
}
var gW = v("ZodEnum", ($, J) => {
  (nY.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (Q, W, X) => pN($, Q, W, X)),
    ($.enum = J.entries),
    ($.options = Object.values(J.entries)));
  let U = new Set(Object.keys(J.entries));
  (($.extract = (Q, W) => {
    let X = {};
    for (let Y of Q)
      if (U.has(Y)) X[Y] = J.entries[Y];
      else throw Error(`Key ${Y} not found in enum`);
    return new gW({ ...J, checks: [], ...Q$.normalizeParams(W), entries: X });
  }),
    ($.exclude = (Q, W) => {
      let X = { ...J.entries };
      for (let Y of Q)
        if (U.has(Y)) delete X[Y];
        else throw Error(`Key ${Y} not found in enum`);
      return new gW({ ...J, checks: [], ...Q$.normalizeParams(W), entries: X });
    }));
});
function x0($, J) {
  let U = Array.isArray($) ? Object.fromEntries($.map((Q) => [Q, Q])) : $;
  return new gW({ type: "enum", entries: U, ...Q$.normalizeParams(J) });
}
function QI($, J) {
  return new gW({ type: "enum", entries: $, ...Q$.normalizeParams(J) });
}
var oO = v("ZodLiteral", ($, J) => {
  (iY.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (U, Q, W) => dN($, U, Q, W)),
    ($.values = new Set(J.values)),
    Object.defineProperty($, "value", {
      get() {
        if (J.values.length > 1)
          throw Error("This schema contains multiple valid literal values. Use `.values` instead.");
        return J.values[0];
      },
    }));
});
function x$($, J) {
  return new oO({ type: "literal", values: Array.isArray($) ? $ : [$], ...Q$.normalizeParams(J) });
}
var rO = v("ZodFile", ($, J) => {
  (oY.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (U, Q, W) => iN($, U, Q, W)),
    ($.min = (U, Q) => $.check(RU(U, Q))),
    ($.max = (U, Q) => $.check(A8(U, Q))),
    ($.mime = (U, Q) => $.check(SW(Array.isArray(U) ? U : [U], Q))));
});
function XI($) {
  return xD(rO, $);
}
var sO = v("ZodTransform", ($, J) => {
  (rY.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (U, Q, W) => aN($, U, Q, W)),
    ($._zod.parse = (U, Q) => {
      if (Q.direction === "backward") throw new O9($.constructor.name);
      U.addIssue = (X) => {
        if (typeof X === "string") U.issues.push(Q$.issue(X, U.value, J));
        else {
          let Y = X;
          if (Y.fatal) Y.continue = !1;
          (Y.code ?? (Y.code = "custom"),
            Y.input ?? (Y.input = U.value),
            Y.inst ?? (Y.inst = $),
            U.issues.push(Q$.issue(Y)));
        }
      };
      let W = J.transform(U.value, U);
      if (W instanceof Promise)
        return W.then((X) => {
          return ((U.value = X), (U.fallback = !0), U);
        });
      return ((U.value = W), (U.fallback = !0), U);
    }));
});
function kH($) {
  return new sO({ type: "transform", transform: $ });
}
var cW = v("ZodOptional", ($, J) => {
  (R7.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (U, Q, W) => nD($, U, Q, W)),
    ($.unwrap = () => $._zod.def.innerType));
});
function J0($) {
  return new cW({ type: "optional", innerType: $ });
}
var aO = v("ZodExactOptional", ($, J) => {
  (sY.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (U, Q, W) => nD($, U, Q, W)),
    ($.unwrap = () => $._zod.def.innerType));
});
function tO($) {
  return new aO({ type: "optional", innerType: $ });
}
var eO = v("ZodNullable", ($, J) => {
  (aY.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (U, Q, W) => XO($, U, Q, W)),
    ($.unwrap = () => $._zod.def.innerType));
});
function e7($) {
  return new eO({ type: "nullable", innerType: $ });
}
function YI($) {
  return J0(e7($));
}
var $F = v("ZodDefault", ($, J) => {
  (tY.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (U, Q, W) => DO($, U, Q, W)),
    ($.unwrap = () => $._zod.def.innerType),
    ($.removeDefault = $.unwrap));
});
function JF($, J) {
  return new $F({
    type: "default",
    innerType: $,
    get defaultValue() {
      return typeof J === "function" ? J() : Q$.shallowClone(J);
    },
  });
}
var UF = v("ZodPrefault", ($, J) => {
  (eY.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (U, Q, W) => HO($, U, Q, W)),
    ($.unwrap = () => $._zod.def.innerType));
});
function WF($, J) {
  return new UF({
    type: "prefault",
    innerType: $,
    get defaultValue() {
      return typeof J === "function" ? J() : Q$.shallowClone(J);
    },
  });
}
var AH = v("ZodNonOptional", ($, J) => {
  ($D.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (U, Q, W) => YO($, U, Q, W)),
    ($.unwrap = () => $._zod.def.innerType));
});
function QF($, J) {
  return new AH({ type: "nonoptional", innerType: $, ...Q$.normalizeParams(J) });
}
var XF = v("ZodSuccess", ($, J) => {
  (JD.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (U, Q, W) => oN($, U, Q, W)),
    ($.unwrap = () => $._zod.def.innerType));
});
function DI($) {
  return new XF({ type: "success", innerType: $ });
}
var YF = v("ZodCatch", ($, J) => {
  (UD.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (U, Q, W) => GO($, U, Q, W)),
    ($.unwrap = () => $._zod.def.innerType),
    ($.removeCatch = $.unwrap));
});
function DF($, J) {
  return new YF({ type: "catch", innerType: $, catchValue: typeof J === "function" ? J : () => J });
}
var HF = v("ZodNaN", ($, J) => {
  (WD.init($, J), G6.init($, J), ($._zod.processJSONSchema = (U, Q, W) => cN($, U, Q, W)));
});
function HI($) {
  return TD(HF, $);
}
var DQ = v("ZodPipe", ($, J) => {
  (Z7.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (U, Q, W) => KO($, U, Q, W)),
    ($.in = J.in),
    ($.out = J.out));
});
function UH($, J) {
  return new DQ({ type: "pipe", in: $, out: J });
}
var HQ = v("ZodCodec", ($, J) => {
  (DQ.init($, J), LW.init($, J));
});
function GI($, J, U) {
  return new HQ({ type: "pipe", in: $, out: J, transform: U.decode, reverseTransform: U.encode });
}
function KI($) {
  let J = $._zod.def;
  return new HQ({ type: "pipe", in: J.out, out: J.in, transform: J.reverseTransform, reverseTransform: J.transform });
}
var GF = v("ZodPreprocess", ($, J) => {
    (DQ.init($, J), I4.init($, J));
  }),
  KF = v("ZodReadonly", ($, J) => {
    (QD.init($, J),
      G6.init($, J),
      ($._zod.processJSONSchema = (U, Q, W) => NO($, U, Q, W)),
      ($.unwrap = () => $._zod.def.innerType));
  });
function NF($) {
  return new KF({ type: "readonly", innerType: $ });
}
var OF = v("ZodTemplateLiteral", ($, J) => {
  (XD.init($, J), G6.init($, J), ($._zod.processJSONSchema = (U, Q, W) => nN($, U, Q, W)));
});
function NI($, J) {
  return new OF({ type: "template_literal", parts: $, ...Q$.normalizeParams(J) });
}
var FF = v("ZodLazy", ($, J) => {
  (HD.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (U, Q, W) => FO($, U, Q, W)),
    ($.unwrap = () => $._zod.def.getter()));
});
function qF($) {
  return new FF({ type: "lazy", getter: $ });
}
var zF = v("ZodPromise", ($, J) => {
  (DD.init($, J),
    G6.init($, J),
    ($._zod.processJSONSchema = (U, Q, W) => OO($, U, Q, W)),
    ($.unwrap = () => $._zod.def.innerType));
});
function OI($) {
  return new zF({ type: "promise", innerType: $ });
}
var BF = v("ZodFunction", ($, J) => {
  (YD.init($, J), G6.init($, J), ($._zod.processJSONSchema = (U, Q, W) => sN($, U, Q, W)));
});
function FI($) {
  return new BF({
    type: "function",
    input: Array.isArray($?.input) ? cO($?.input) : ($?.input ?? w6(o6())),
    output: $?.output ?? o6(),
  });
}
var GQ = v("ZodCustom", ($, J) => {
  (GD.init($, J), G6.init($, J), ($._zod.processJSONSchema = (U, Q, W) => rN($, U, Q, W)));
});
function qI($) {
  let J = new n6({ check: "custom" });
  return ((J._zod.check = $), J);
}
function MH($, J) {
  return gD(GQ, $ ?? (() => !0), J);
}
function EF($, J = {}) {
  return hD(GQ, $, J);
}
function LF($, J) {
  return uD($, J);
}
var zI = lD,
  BI = mD;
function EI($, J = {}) {
  let U = new GQ({ type: "custom", check: "custom", fn: (Q) => Q instanceof $, abort: !0, ...Q$.normalizeParams(J) });
  return (
    (U._zod.bag.Class = $),
    (U._zod.check = (Q) => {
      if (!(Q.value instanceof $))
        Q.issues.push({
          code: "invalid_type",
          expected: $.name,
          input: Q.value,
          inst: U,
          path: [...(U._zod.def.path ?? [])],
        });
    }),
    U
  );
}
var LI = (...$) => pD({ Codec: HQ, Boolean: mW, String: hW }, ...$);
function wI($) {
  let J = qF(() => {
    return r6([c($), v6(), V0(), UQ(), w6(J), u6(c(), J)]);
  });
  return J;
}
function KQ($, J) {
  return new GF({ type: "pipe", in: kH($), out: J });
}
var g2 = {
  invalid_type: "invalid_type",
  too_big: "too_big",
  too_small: "too_small",
  invalid_format: "invalid_format",
  not_multiple_of: "not_multiple_of",
  unrecognized_keys: "unrecognized_keys",
  invalid_union: "invalid_union",
  invalid_key: "invalid_key",
  invalid_element: "invalid_element",
  invalid_value: "invalid_value",
  custom: "custom",
};
function h2($) {
  E0({ customError: $ });
}
function u2() {
  return E0().customError;
}
var wF;
(function ($) {})(wF || (wF = {}));
var I$ = { ...a7, ...sD, iso: S8 },
  l2 = new Set([
    "$schema",
    "$ref",
    "$defs",
    "definitions",
    "$id",
    "id",
    "$comment",
    "$anchor",
    "$vocabulary",
    "$dynamicRef",
    "$dynamicAnchor",
    "type",
    "enum",
    "const",
    "anyOf",
    "oneOf",
    "allOf",
    "not",
    "properties",
    "required",
    "additionalProperties",
    "patternProperties",
    "propertyNames",
    "minProperties",
    "maxProperties",
    "items",
    "prefixItems",
    "additionalItems",
    "minItems",
    "maxItems",
    "uniqueItems",
    "contains",
    "minContains",
    "maxContains",
    "minLength",
    "maxLength",
    "pattern",
    "format",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "multipleOf",
    "description",
    "default",
    "contentEncoding",
    "contentMediaType",
    "contentSchema",
    "unevaluatedItems",
    "unevaluatedProperties",
    "if",
    "then",
    "else",
    "dependentSchemas",
    "dependentRequired",
    "nullable",
    "readOnly",
  ]);
function m2($, J) {
  let U = $.$schema;
  if (U === "https://json-schema.org/draft/2020-12/schema") return "draft-2020-12";
  if (U === "http://json-schema.org/draft-07/schema#") return "draft-7";
  if (U === "http://json-schema.org/draft-04/schema#") return "draft-4";
  return J ?? "draft-2020-12";
}
function p2($, J) {
  if (!$.startsWith("#")) throw Error("External $ref is not supported, only local refs (#/...) are allowed");
  let U = $.slice(1).split("/").filter(Boolean);
  if (U.length === 0) return J.rootSchema;
  let Q = J.version === "draft-2020-12" ? "$defs" : "definitions";
  if (U[0] === Q) {
    let W = U[1];
    if (!W || !J.defs[W]) throw Error(`Reference not found: ${$}`);
    return J.defs[W];
  }
  throw Error(`Reference not found: ${$}`);
}
function II($, J) {
  if ($.not !== void 0) {
    if (typeof $.not === "object" && Object.keys($.not).length === 0) return I$.never();
    throw Error("not is not supported in Zod (except { not: {} } for never)");
  }
  if ($.unevaluatedItems !== void 0) throw Error("unevaluatedItems is not supported");
  if ($.unevaluatedProperties !== void 0) throw Error("unevaluatedProperties is not supported");
  if ($.if !== void 0 || $.then !== void 0 || $.else !== void 0)
    throw Error("Conditional schemas (if/then/else) are not supported");
  if ($.dependentSchemas !== void 0 || $.dependentRequired !== void 0)
    throw Error("dependentSchemas and dependentRequired are not supported");
  if ($.$ref) {
    let W = $.$ref;
    if (J.refs.has(W)) return J.refs.get(W);
    if (J.processing.has(W))
      return I$.lazy(() => {
        if (!J.refs.has(W)) throw Error(`Circular reference not resolved: ${W}`);
        return J.refs.get(W);
      });
    J.processing.add(W);
    let X = p2(W, J),
      Y = c0(X, J);
    return (J.refs.set(W, Y), J.processing.delete(W), Y);
  }
  if ($.enum !== void 0) {
    let W = $.enum;
    if (J.version === "openapi-3.0" && $.nullable === !0 && W.length === 1 && W[0] === null) return I$.null();
    if (W.length === 0) return I$.never();
    if (W.length === 1) return I$.literal(W[0]);
    if (W.every((Y) => typeof Y === "string")) return I$.enum(W);
    let X = W.map((Y) => I$.literal(Y));
    if (X.length < 2) return X[0];
    return I$.union([X[0], X[1], ...X.slice(2)]);
  }
  if ($.const !== void 0) return I$.literal($.const);
  let U = $.type;
  if (Array.isArray(U)) {
    let W = U.map((X) => {
      let Y = { ...$, type: X };
      return II(Y, J);
    });
    if (W.length === 0) return I$.never();
    if (W.length === 1) return W[0];
    return I$.union(W);
  }
  if (!U) return I$.any();
  let Q;
  switch (U) {
    case "string": {
      let W = I$.string();
      if ($.format) {
        let X = $.format;
        if (X === "email") W = W.check(I$.email());
        else if (X === "uri" || X === "uri-reference") W = W.check(I$.url());
        else if (X === "uuid" || X === "guid") W = W.check(I$.uuid());
        else if (X === "date-time") W = W.check(I$.iso.datetime());
        else if (X === "date") W = W.check(I$.iso.date());
        else if (X === "time") W = W.check(I$.iso.time());
        else if (X === "duration") W = W.check(I$.iso.duration());
        else if (X === "ipv4") W = W.check(I$.ipv4());
        else if (X === "ipv6") W = W.check(I$.ipv6());
        else if (X === "mac") W = W.check(I$.mac());
        else if (X === "cidr") W = W.check(I$.cidrv4());
        else if (X === "cidr-v6") W = W.check(I$.cidrv6());
        else if (X === "base64") W = W.check(I$.base64());
        else if (X === "base64url") W = W.check(I$.base64url());
        else if (X === "e164") W = W.check(I$.e164());
        else if (X === "jwt") W = W.check(I$.jwt());
        else if (X === "emoji") W = W.check(I$.emoji());
        else if (X === "nanoid") W = W.check(I$.nanoid());
        else if (X === "cuid") W = W.check(I$.cuid());
        else if (X === "cuid2") W = W.check(I$.cuid2());
        else if (X === "ulid") W = W.check(I$.ulid());
        else if (X === "xid") W = W.check(I$.xid());
        else if (X === "ksuid") W = W.check(I$.ksuid());
      }
      if (typeof $.minLength === "number") W = W.min($.minLength);
      if (typeof $.maxLength === "number") W = W.max($.maxLength);
      if ($.pattern) W = W.regex(new RegExp($.pattern));
      Q = W;
      break;
    }
    case "number":
    case "integer": {
      let W = U === "integer" ? I$.number().int() : I$.number();
      if (typeof $.minimum === "number") W = W.min($.minimum);
      if (typeof $.maximum === "number") W = W.max($.maximum);
      if (typeof $.exclusiveMinimum === "number") W = W.gt($.exclusiveMinimum);
      else if ($.exclusiveMinimum === !0 && typeof $.minimum === "number") W = W.gt($.minimum);
      if (typeof $.exclusiveMaximum === "number") W = W.lt($.exclusiveMaximum);
      else if ($.exclusiveMaximum === !0 && typeof $.maximum === "number") W = W.lt($.maximum);
      if (typeof $.multipleOf === "number") W = W.multipleOf($.multipleOf);
      Q = W;
      break;
    }
    case "boolean": {
      Q = I$.boolean();
      break;
    }
    case "null": {
      Q = I$.null();
      break;
    }
    case "object": {
      let W = {},
        X = $.properties || {},
        Y = new Set($.required || []);
      for (let [H, G] of Object.entries(X)) {
        let K = c0(G, J);
        W[H] = Y.has(H) ? K : K.optional();
      }
      if ($.propertyNames) {
        let H = c0($.propertyNames, J),
          G =
            $.additionalProperties && typeof $.additionalProperties === "object"
              ? c0($.additionalProperties, J)
              : I$.any();
        if (Object.keys(W).length === 0) {
          Q = I$.record(H, G);
          break;
        }
        let K = I$.object(W).passthrough(),
          O = I$.looseRecord(H, G);
        Q = I$.intersection(K, O);
        break;
      }
      if ($.patternProperties) {
        let H = $.patternProperties,
          G = Object.keys(H),
          K = [];
        for (let N of G) {
          let F = c0(H[N], J),
            B = I$.string().regex(new RegExp(N));
          K.push(I$.looseRecord(B, F));
        }
        let O = [];
        if (Object.keys(W).length > 0) O.push(I$.object(W).passthrough());
        if ((O.push(...K), O.length === 0)) Q = I$.object({}).passthrough();
        else if (O.length === 1) Q = O[0];
        else {
          let N = I$.intersection(O[0], O[1]);
          for (let F = 2; F < O.length; F++) N = I$.intersection(N, O[F]);
          Q = N;
        }
        break;
      }
      let D = I$.object(W);
      if ($.additionalProperties === !1) Q = D.strict();
      else if (typeof $.additionalProperties === "object") Q = D.catchall(c0($.additionalProperties, J));
      else Q = D.passthrough();
      break;
    }
    case "array": {
      let { prefixItems: W, items: X } = $;
      if (W && Array.isArray(W)) {
        let Y = W.map((H) => c0(H, J)),
          D = X && typeof X === "object" && !Array.isArray(X) ? c0(X, J) : void 0;
        if (D) Q = I$.tuple(Y).rest(D);
        else Q = I$.tuple(Y);
        if (typeof $.minItems === "number") Q = Q.check(I$.minLength($.minItems));
        if (typeof $.maxItems === "number") Q = Q.check(I$.maxLength($.maxItems));
      } else if (Array.isArray(X)) {
        let Y = X.map((H) => c0(H, J)),
          D = $.additionalItems && typeof $.additionalItems === "object" ? c0($.additionalItems, J) : void 0;
        if (D) Q = I$.tuple(Y).rest(D);
        else Q = I$.tuple(Y);
        if (typeof $.minItems === "number") Q = Q.check(I$.minLength($.minItems));
        if (typeof $.maxItems === "number") Q = Q.check(I$.maxLength($.maxItems));
      } else if (X !== void 0) {
        let Y = c0(X, J),
          D = I$.array(Y);
        if (typeof $.minItems === "number") D = D.min($.minItems);
        if (typeof $.maxItems === "number") D = D.max($.maxItems);
        Q = D;
      } else Q = I$.array(I$.any());
      break;
    }
    default:
      throw Error(`Unsupported type: ${U}`);
  }
  return Q;
}
function c0($, J) {
  if (typeof $ === "boolean") return $ ? I$.any() : I$.never();
  let U = II($, J),
    Q = $.type || $.enum !== void 0 || $.const !== void 0;
  if ($.anyOf && Array.isArray($.anyOf)) {
    let D = $.anyOf.map((G) => c0(G, J)),
      H = I$.union(D);
    U = Q ? I$.intersection(U, H) : H;
  }
  if ($.oneOf && Array.isArray($.oneOf)) {
    let D = $.oneOf.map((G) => c0(G, J)),
      H = I$.xor(D);
    U = Q ? I$.intersection(U, H) : H;
  }
  if ($.allOf && Array.isArray($.allOf))
    if ($.allOf.length === 0) U = Q ? U : I$.any();
    else {
      let D = Q ? U : c0($.allOf[0], J),
        H = Q ? 0 : 1;
      for (let G = H; G < $.allOf.length; G++) D = I$.intersection(D, c0($.allOf[G], J));
      U = D;
    }
  if ($.nullable === !0 && J.version === "openapi-3.0") U = I$.nullable(U);
  if ($.readOnly === !0) U = I$.readonly(U);
  if ($.default !== void 0) U = U.default($.default);
  let W = {},
    X = ["$id", "id", "$comment", "$anchor", "$vocabulary", "$dynamicRef", "$dynamicAnchor"];
  for (let D of X) if (D in $) W[D] = $[D];
  let Y = ["contentEncoding", "contentMediaType", "contentSchema"];
  for (let D of Y) if (D in $) W[D] = $[D];
  for (let D of Object.keys($)) if (!l2.has(D)) W[D] = $[D];
  if (Object.keys(W).length > 0) J.registry.add(U, W);
  if ($.description) U = U.describe($.description);
  return U;
}
function VI($, J) {
  if (typeof $ === "boolean") return $ ? I$.any() : I$.never();
  let U;
  try {
    U = JSON.parse(JSON.stringify($));
  } catch {
    throw Error("fromJSONSchema input is not valid JSON (possibly cyclic); use $defs/$ref for recursive schemas");
  }
  let Q = m2(U, J?.defaultTarget),
    W = U.$defs || U.definitions || {},
    X = { version: Q, defs: W, refs: new Map(), processing: new Set(), rootSchema: U, registry: J?.registry ?? f0 };
  return c0(U, X);
}
var IF = {};
uU(IF, { string: () => d2, number: () => c2, date: () => o2, boolean: () => n2, bigint: () => i2 });
function d2($) {
  return wN(hW, $);
}
function c2($) {
  return RN(lW, $);
}
function n2($) {
  return ZN(mW, $);
}
function i2($) {
  return PN(pW, $);
}
function o2($) {
  return _N(WQ, $);
}
E0(P7());
var VF = "2025-11-25";
var kI = [VF, "2025-06-18", "2025-03-26", "2024-11-05", "2024-10-07"],
  C8 = "io.modelcontextprotocol/related-task",
  ZH = "2.0",
  P0 = MH(($) => $ !== null && (typeof $ === "object" || typeof $ === "function")),
  AI = r6([c(), v6().int()]),
  MI = c(),
  Ot = y0({ ttl: v6().optional(), pollInterval: v6().optional() }),
  r2 = _$({ ttl: v6().optional() }),
  s2 = _$({ taskId: c() }),
  kF = y0({ progressToken: AI.optional(), [C8]: s2.optional() }),
  CJ = _$({ _meta: kF.optional() }),
  NQ = CJ.extend({ task: r2.optional() }),
  RI = ($) => NQ.safeParse($).success,
  g0 = _$({ method: c(), params: CJ.loose().optional() }),
  gJ = _$({ _meta: kF.optional() }),
  hJ = _$({ method: c(), params: gJ.loose().optional() }),
  h0 = y0({ _meta: kF.optional() }),
  PH = r6([c(), v6().int()]),
  ZI = _$({ jsonrpc: x$(ZH), id: PH, ...g0.shape }).strict(),
  AF = ($) => ZI.safeParse($).success,
  PI = _$({ jsonrpc: x$(ZH), ...hJ.shape }).strict(),
  _I = ($) => PI.safeParse($).success,
  MF = _$({ jsonrpc: x$(ZH), id: PH, result: h0 }).strict(),
  OQ = ($) => MF.safeParse($).success;
var n$;
(function ($) {
  (($[($.ConnectionClosed = -32000)] = "ConnectionClosed"),
    ($[($.RequestTimeout = -32001)] = "RequestTimeout"),
    ($[($.ParseError = -32700)] = "ParseError"),
    ($[($.InvalidRequest = -32600)] = "InvalidRequest"),
    ($[($.MethodNotFound = -32601)] = "MethodNotFound"),
    ($[($.InvalidParams = -32602)] = "InvalidParams"),
    ($[($.InternalError = -32603)] = "InternalError"),
    ($[($.UrlElicitationRequired = -32042)] = "UrlElicitationRequired"));
})(n$ || (n$ = {}));
var RF = _$({
  jsonrpc: x$(ZH),
  id: PH.optional(),
  error: _$({ code: v6().int(), message: c(), data: o6().optional() }),
}).strict();
var SI = ($) => RF.safeParse($).success;
var CI = r6([ZI, PI, MF, RF]),
  Ft = r6([MF, RF]),
  _H = h0.strict(),
  a2 = gJ.extend({ requestId: PH.optional(), reason: c().optional() }),
  SH = hJ.extend({ method: x$("notifications/cancelled"), params: a2 }),
  t2 = _$({ src: c(), mimeType: c().optional(), sizes: w6(c()).optional(), theme: x0(["light", "dark"]).optional() }),
  FQ = _$({ icons: w6(t2).optional() }),
  nW = _$({ name: c(), title: c().optional() }),
  TI = nW.extend({ ...nW.shape, ...FQ.shape, version: c(), websiteUrl: c().optional(), description: c().optional() }),
  e2 = dW(_$({ applyDefaults: V0().optional() }), u6(c(), o6())),
  $T = KQ(
    ($) => {
      if ($ && typeof $ === "object" && !Array.isArray($)) {
        if (Object.keys($).length === 0) return { form: {} };
      }
      return $;
    },
    dW(_$({ form: e2.optional(), url: P0.optional() }), u6(c(), o6()).optional()),
  ),
  JT = y0({
    list: P0.optional(),
    cancel: P0.optional(),
    requests: y0({
      sampling: y0({ createMessage: P0.optional() }).optional(),
      elicitation: y0({ create: P0.optional() }).optional(),
    }).optional(),
  }),
  UT = y0({
    list: P0.optional(),
    cancel: P0.optional(),
    requests: y0({ tools: y0({ call: P0.optional() }).optional() }).optional(),
  }),
  WT = _$({
    experimental: u6(c(), P0).optional(),
    sampling: _$({ context: P0.optional(), tools: P0.optional() }).optional(),
    elicitation: $T.optional(),
    roots: _$({ listChanged: V0().optional() }).optional(),
    tasks: JT.optional(),
    extensions: u6(c(), P0).optional(),
  }),
  QT = CJ.extend({ protocolVersion: c(), capabilities: WT, clientInfo: TI }),
  ZF = g0.extend({ method: x$("initialize"), params: QT });
var XT = _$({
    experimental: u6(c(), P0).optional(),
    logging: P0.optional(),
    completions: P0.optional(),
    prompts: _$({ listChanged: V0().optional() }).optional(),
    resources: _$({ subscribe: V0().optional(), listChanged: V0().optional() }).optional(),
    tools: _$({ listChanged: V0().optional() }).optional(),
    tasks: UT.optional(),
    extensions: u6(c(), P0).optional(),
  }),
  YT = h0.extend({ protocolVersion: c(), capabilities: XT, serverInfo: TI, instructions: c().optional() }),
  PF = hJ.extend({ method: x$("notifications/initialized"), params: gJ.optional() });
var CH = g0.extend({ method: x$("ping"), params: CJ.optional() }),
  DT = _$({ progress: v6(), total: J0(v6()), message: J0(c()) }),
  HT = _$({ ...gJ.shape, ...DT.shape, progressToken: AI }),
  TH = hJ.extend({ method: x$("notifications/progress"), params: HT }),
  GT = CJ.extend({ cursor: MI.optional() }),
  qQ = g0.extend({ params: GT.optional() }),
  zQ = h0.extend({ nextCursor: MI.optional() }),
  KT = x0(["working", "input_required", "completed", "failed", "cancelled"]),
  BQ = _$({
    taskId: c(),
    status: KT,
    ttl: r6([v6(), UQ()]),
    createdAt: c(),
    lastUpdatedAt: c(),
    pollInterval: J0(v6()),
    statusMessage: J0(c()),
  }),
  iW = h0.extend({ task: BQ }),
  NT = gJ.merge(BQ),
  EQ = hJ.extend({ method: x$("notifications/tasks/status"), params: NT }),
  jH = g0.extend({ method: x$("tasks/get"), params: CJ.extend({ taskId: c() }) }),
  vH = h0.merge(BQ),
  bH = g0.extend({ method: x$("tasks/result"), params: CJ.extend({ taskId: c() }) }),
  qt = h0.loose(),
  fH = qQ.extend({ method: x$("tasks/list") }),
  yH = zQ.extend({ tasks: w6(BQ) }),
  xH = g0.extend({ method: x$("tasks/cancel"), params: CJ.extend({ taskId: c() }) }),
  jI = h0.merge(BQ),
  vI = _$({ uri: c(), mimeType: J0(c()), _meta: u6(c(), o6()).optional() }),
  bI = vI.extend({ text: c() }),
  _F = c().refine(
    ($) => {
      try {
        return (atob($), !0);
      } catch {
        return !1;
      }
    },
    { message: "Invalid Base64 string" },
  ),
  fI = vI.extend({ blob: _F }),
  LQ = x0(["user", "assistant"]),
  oW = _$({
    audience: w6(LQ).optional(),
    priority: v6().min(0).max(1).optional(),
    lastModified: S8.datetime({ offset: !0 }).optional(),
  }),
  yI = _$({
    ...nW.shape,
    ...FQ.shape,
    uri: c(),
    description: J0(c()),
    mimeType: J0(c()),
    size: J0(v6()),
    annotations: oW.optional(),
    _meta: J0(y0({})),
  }),
  OT = _$({
    ...nW.shape,
    ...FQ.shape,
    uriTemplate: c(),
    description: J0(c()),
    mimeType: J0(c()),
    annotations: oW.optional(),
    _meta: J0(y0({})),
  }),
  gH = qQ.extend({ method: x$("resources/list") }),
  FT = zQ.extend({ resources: w6(yI) }),
  hH = qQ.extend({ method: x$("resources/templates/list") }),
  qT = zQ.extend({ resourceTemplates: w6(OT) }),
  SF = CJ.extend({ uri: c() }),
  zT = SF,
  uH = g0.extend({ method: x$("resources/read"), params: zT }),
  BT = h0.extend({ contents: w6(r6([bI, fI])) }),
  ET = hJ.extend({ method: x$("notifications/resources/list_changed"), params: gJ.optional() }),
  LT = SF,
  wT = g0.extend({ method: x$("resources/subscribe"), params: LT }),
  IT = SF,
  VT = g0.extend({ method: x$("resources/unsubscribe"), params: IT }),
  kT = gJ.extend({ uri: c() }),
  AT = hJ.extend({ method: x$("notifications/resources/updated"), params: kT }),
  MT = _$({ name: c(), description: J0(c()), required: J0(V0()) }),
  RT = _$({ ...nW.shape, ...FQ.shape, description: J0(c()), arguments: J0(w6(MT)), _meta: J0(y0({})) }),
  lH = qQ.extend({ method: x$("prompts/list") }),
  ZT = zQ.extend({ prompts: w6(RT) }),
  PT = CJ.extend({ name: c(), arguments: u6(c(), c()).optional() }),
  mH = g0.extend({ method: x$("prompts/get"), params: PT }),
  CF = _$({ type: x$("text"), text: c(), annotations: oW.optional(), _meta: u6(c(), o6()).optional() }),
  TF = _$({ type: x$("image"), data: _F, mimeType: c(), annotations: oW.optional(), _meta: u6(c(), o6()).optional() }),
  jF = _$({ type: x$("audio"), data: _F, mimeType: c(), annotations: oW.optional(), _meta: u6(c(), o6()).optional() }),
  _T = _$({ type: x$("tool_use"), name: c(), id: c(), input: u6(c(), o6()), _meta: u6(c(), o6()).optional() }),
  ST = _$({
    type: x$("resource"),
    resource: r6([bI, fI]),
    annotations: oW.optional(),
    _meta: u6(c(), o6()).optional(),
  }),
  CT = yI.extend({ type: x$("resource_link") }),
  vF = r6([CF, TF, jF, CT, ST]),
  TT = _$({ role: LQ, content: vF }),
  jT = h0.extend({ description: c().optional(), messages: w6(TT) }),
  vT = hJ.extend({ method: x$("notifications/prompts/list_changed"), params: gJ.optional() }),
  bT = _$({
    title: c().optional(),
    readOnlyHint: V0().optional(),
    destructiveHint: V0().optional(),
    idempotentHint: V0().optional(),
    openWorldHint: V0().optional(),
  }),
  fT = _$({ taskSupport: x0(["required", "optional", "forbidden"]).optional() }),
  xI = _$({
    ...nW.shape,
    ...FQ.shape,
    description: c().optional(),
    inputSchema: _$({ type: x$("object"), properties: u6(c(), P0).optional(), required: w6(c()).optional() }).catchall(
      o6(),
    ),
    outputSchema: _$({ type: x$("object"), properties: u6(c(), P0).optional(), required: w6(c()).optional() })
      .catchall(o6())
      .optional(),
    annotations: bT.optional(),
    execution: fT.optional(),
    _meta: u6(c(), o6()).optional(),
  }),
  pH = qQ.extend({ method: x$("tools/list") }),
  yT = zQ.extend({ tools: w6(xI) }),
  dH = h0.extend({
    content: w6(vF).default([]),
    structuredContent: u6(c(), o6()).optional(),
    isError: V0().optional(),
  }),
  zt = dH.or(h0.extend({ toolResult: o6() })),
  xT = NQ.extend({ name: c(), arguments: u6(c(), o6()).optional() }),
  rW = g0.extend({ method: x$("tools/call"), params: xT }),
  gT = hJ.extend({ method: x$("notifications/tools/list_changed"), params: gJ.optional() }),
  Bt = _$({ autoRefresh: V0().default(!0), debounceMs: v6().int().nonnegative().default(300) }),
  wQ = x0(["debug", "info", "notice", "warning", "error", "critical", "alert", "emergency"]),
  hT = CJ.extend({ level: wQ }),
  bF = g0.extend({ method: x$("logging/setLevel"), params: hT }),
  uT = gJ.extend({ level: wQ, logger: c().optional(), data: o6() }),
  lT = hJ.extend({ method: x$("notifications/message"), params: uT }),
  mT = _$({ name: c().optional() }),
  pT = _$({
    hints: w6(mT).optional(),
    costPriority: v6().min(0).max(1).optional(),
    speedPriority: v6().min(0).max(1).optional(),
    intelligencePriority: v6().min(0).max(1).optional(),
  }),
  dT = _$({ mode: x0(["auto", "required", "none"]).optional() }),
  cT = _$({
    type: x$("tool_result"),
    toolUseId: c().describe("The unique identifier for the corresponding tool call."),
    content: w6(vF).default([]),
    structuredContent: _$({}).loose().optional(),
    isError: V0().optional(),
    _meta: u6(c(), o6()).optional(),
  }),
  nT = YQ("type", [CF, TF, jF]),
  RH = YQ("type", [CF, TF, jF, _T, cT]),
  iT = _$({ role: LQ, content: r6([RH, w6(RH)]), _meta: u6(c(), o6()).optional() }),
  oT = NQ.extend({
    messages: w6(iT),
    modelPreferences: pT.optional(),
    systemPrompt: c().optional(),
    includeContext: x0(["none", "thisServer", "allServers"]).optional(),
    temperature: v6().optional(),
    maxTokens: v6().int(),
    stopSequences: w6(c()).optional(),
    metadata: P0.optional(),
    tools: w6(xI).optional(),
    toolChoice: dT.optional(),
  }),
  rT = g0.extend({ method: x$("sampling/createMessage"), params: oT }),
  IQ = h0.extend({
    model: c(),
    stopReason: J0(x0(["endTurn", "stopSequence", "maxTokens"]).or(c())),
    role: LQ,
    content: nT,
  }),
  fF = h0.extend({
    model: c(),
    stopReason: J0(x0(["endTurn", "stopSequence", "maxTokens", "toolUse"]).or(c())),
    role: LQ,
    content: r6([RH, w6(RH)]),
  }),
  sT = _$({ type: x$("boolean"), title: c().optional(), description: c().optional(), default: V0().optional() }),
  aT = _$({
    type: x$("string"),
    title: c().optional(),
    description: c().optional(),
    minLength: v6().optional(),
    maxLength: v6().optional(),
    format: x0(["email", "uri", "date", "date-time"]).optional(),
    default: c().optional(),
  }),
  tT = _$({
    type: x0(["number", "integer"]),
    title: c().optional(),
    description: c().optional(),
    minimum: v6().optional(),
    maximum: v6().optional(),
    default: v6().optional(),
  }),
  eT = _$({
    type: x$("string"),
    title: c().optional(),
    description: c().optional(),
    enum: w6(c()),
    default: c().optional(),
  }),
  $j = _$({
    type: x$("string"),
    title: c().optional(),
    description: c().optional(),
    oneOf: w6(_$({ const: c(), title: c() })),
    default: c().optional(),
  }),
  Jj = _$({
    type: x$("string"),
    title: c().optional(),
    description: c().optional(),
    enum: w6(c()),
    enumNames: w6(c()).optional(),
    default: c().optional(),
  }),
  Uj = r6([eT, $j]),
  Wj = _$({
    type: x$("array"),
    title: c().optional(),
    description: c().optional(),
    minItems: v6().optional(),
    maxItems: v6().optional(),
    items: _$({ type: x$("string"), enum: w6(c()) }),
    default: w6(c()).optional(),
  }),
  Qj = _$({
    type: x$("array"),
    title: c().optional(),
    description: c().optional(),
    minItems: v6().optional(),
    maxItems: v6().optional(),
    items: _$({ anyOf: w6(_$({ const: c(), title: c() })) }),
    default: w6(c()).optional(),
  }),
  Xj = r6([Wj, Qj]),
  Yj = r6([Jj, Uj, Xj]),
  Dj = r6([Yj, sT, aT, tT]),
  Hj = NQ.extend({
    mode: x$("form").optional(),
    message: c(),
    requestedSchema: _$({ type: x$("object"), properties: u6(c(), Dj), required: w6(c()).optional() }),
  }),
  Gj = NQ.extend({ mode: x$("url"), message: c(), elicitationId: c(), url: c().url() }),
  Kj = r6([Hj, Gj]),
  Nj = g0.extend({ method: x$("elicitation/create"), params: Kj }),
  Oj = gJ.extend({ elicitationId: c() }),
  Fj = hJ.extend({ method: x$("notifications/elicitation/complete"), params: Oj }),
  sW = h0.extend({
    action: x0(["accept", "decline", "cancel"]),
    content: KQ(($) => ($ === null ? void 0 : $), u6(c(), r6([c(), v6(), V0(), w6(c())])).optional()),
  }),
  qj = _$({ type: x$("ref/resource"), uri: c() });
var zj = _$({ type: x$("ref/prompt"), name: c() }),
  Bj = CJ.extend({
    ref: r6([zj, qj]),
    argument: _$({ name: c(), value: c() }),
    context: _$({ arguments: u6(c(), c()).optional() }).optional(),
  }),
  cH = g0.extend({ method: x$("completion/complete"), params: Bj });
function gI($) {
  if ($.params.ref.type !== "ref/prompt")
    throw TypeError(`Expected CompleteRequestPrompt, but got ${$.params.ref.type}`);
}
function hI($) {
  if ($.params.ref.type !== "ref/resource")
    throw TypeError(`Expected CompleteRequestResourceTemplate, but got ${$.params.ref.type}`);
}
var Ej = h0.extend({ completion: y0({ values: w6(c()).max(100), total: J0(v6().int()), hasMore: J0(V0()) }) }),
  Lj = _$({ uri: c().startsWith("file://"), name: c().optional(), _meta: u6(c(), o6()).optional() }),
  wj = g0.extend({ method: x$("roots/list"), params: CJ.optional() }),
  yF = h0.extend({ roots: w6(Lj) }),
  Ij = hJ.extend({ method: x$("notifications/roots/list_changed"), params: gJ.optional() }),
  Et = r6([CH, ZF, cH, bF, mH, lH, gH, hH, uH, wT, VT, rW, pH, jH, bH, fH, xH]),
  Lt = r6([SH, TH, PF, Ij, EQ]),
  wt = r6([_H, IQ, fF, sW, yF, vH, yH, iW]),
  It = r6([CH, rT, Nj, wj, jH, bH, fH, xH]),
  Vt = r6([SH, TH, lT, AT, ET, gT, vT, EQ, Fj]),
  kt = r6([_H, YT, Ej, jT, ZT, FT, qT, BT, dH, yT, vH, yH, iW]);
class g$ extends Error {
  constructor($, J, U) {
    super(`MCP error ${$}: ${J}`);
    ((this.code = $), (this.data = U), (this.name = "McpError"));
  }
  static fromError($, J, U) {
    if ($ === n$.UrlElicitationRequired && U) {
      let Q = U;
      if (Q.elicitations) return new uI(Q.elicitations, J);
    }
    return new g$($, J, U);
  }
}
class uI extends g$ {
  constructor($, J = `URL elicitation${$.length > 1 ? "s" : ""} required`) {
    super(n$.UrlElicitationRequired, J, { elicitations: $ });
  }
  get elicitations() {
    return this.data?.elicitations ?? [];
  }
}
function T8($) {
  return $ === "completed" || $ === "failed" || $ === "cancelled";
}
var mI = Symbol("Let zodToJsonSchema decide on which parser to use");
var lI = {
    name: void 0,
    $refStrategy: "root",
    basePath: ["#"],
    effectStrategy: "input",
    pipeStrategy: "all",
    dateStrategy: "format:date-time",
    mapStrategy: "entries",
    removeAdditionalStrategy: "passthrough",
    allowedAdditionalProperties: !0,
    rejectedAdditionalProperties: !1,
    definitionPath: "definitions",
    target: "jsonSchema7",
    strictUnions: !1,
    definitions: {},
    errorMessages: !1,
    markdownDescription: !1,
    patternStrategy: "escape",
    applyRegexFlags: !1,
    emailStrategy: "format:email",
    base64Strategy: "contentEncoding:base64",
    nameStrategy: "ref",
    openAiAnyTypeName: "OpenAiAnyType",
  },
  pI = ($) => (typeof $ === "string" ? { ...lI, name: $ } : { ...lI, ...$ });
var dI = ($) => {
  let J = pI($),
    U = J.name !== void 0 ? [...J.basePath, J.definitionPath, J.name] : J.basePath;
  return {
    ...J,
    flags: { hasReferencedOpenAiAnyType: !1 },
    currentPath: U,
    propertyPath: void 0,
    seen: new Map(
      Object.entries(J.definitions).map(([Q, W]) => [
        W._def,
        { def: W._def, path: [...J.basePath, J.definitionPath, Q], jsonSchema: void 0 },
      ]),
    ),
  };
};
function xF($, J, U, Q) {
  if (!Q?.errorMessages) return;
  if (U) $.errorMessage = { ...$.errorMessage, [J]: U };
}
function P6($, J, U, Q, W) {
  (($[J] = U), xF($, J, Q, W));
}
var nH = ($, J) => {
  let U = 0;
  for (; U < $.length && U < J.length; U++) if ($[U] !== J[U]) break;
  return [($.length - U).toString(), ...J.slice(U)].join("/");
};
function G0($) {
  if ($.target !== "openAi") return {};
  let J = [...$.basePath, $.definitionPath, $.openAiAnyTypeName];
  return (
    ($.flags.hasReferencedOpenAiAnyType = !0),
    { $ref: $.$refStrategy === "relative" ? nH(J, $.currentPath) : J.join("/") }
  );
}
function cI($, J) {
  let U = { type: "array" };
  if ($.type?._def && $.type?._def?.typeName !== D$.ZodAny)
    U.items = t$($.type._def, { ...J, currentPath: [...J.currentPath, "items"] });
  if ($.minLength) P6(U, "minItems", $.minLength.value, $.minLength.message, J);
  if ($.maxLength) P6(U, "maxItems", $.maxLength.value, $.maxLength.message, J);
  if ($.exactLength)
    (P6(U, "minItems", $.exactLength.value, $.exactLength.message, J),
      P6(U, "maxItems", $.exactLength.value, $.exactLength.message, J));
  return U;
}
function nI($, J) {
  let U = { type: "integer", format: "int64" };
  if (!$.checks) return U;
  for (let Q of $.checks)
    switch (Q.kind) {
      case "min":
        if (J.target === "jsonSchema7")
          if (Q.inclusive) P6(U, "minimum", Q.value, Q.message, J);
          else P6(U, "exclusiveMinimum", Q.value, Q.message, J);
        else {
          if (!Q.inclusive) U.exclusiveMinimum = !0;
          P6(U, "minimum", Q.value, Q.message, J);
        }
        break;
      case "max":
        if (J.target === "jsonSchema7")
          if (Q.inclusive) P6(U, "maximum", Q.value, Q.message, J);
          else P6(U, "exclusiveMaximum", Q.value, Q.message, J);
        else {
          if (!Q.inclusive) U.exclusiveMaximum = !0;
          P6(U, "maximum", Q.value, Q.message, J);
        }
        break;
      case "multipleOf":
        P6(U, "multipleOf", Q.value, Q.message, J);
        break;
    }
  return U;
}
function iI() {
  return { type: "boolean" };
}
function iH($, J) {
  return t$($.type._def, J);
}
var oI = ($, J) => {
  return t$($.innerType._def, J);
};
function gF($, J, U) {
  let Q = U ?? J.dateStrategy;
  if (Array.isArray(Q)) return { anyOf: Q.map((W, X) => gF($, J, W)) };
  switch (Q) {
    case "string":
    case "format:date-time":
      return { type: "string", format: "date-time" };
    case "format:date":
      return { type: "string", format: "date" };
    case "integer":
      return Vj($, J);
  }
}
var Vj = ($, J) => {
  let U = { type: "integer", format: "unix-time" };
  if (J.target === "openApi3") return U;
  for (let Q of $.checks)
    switch (Q.kind) {
      case "min":
        P6(U, "minimum", Q.value, Q.message, J);
        break;
      case "max":
        P6(U, "maximum", Q.value, Q.message, J);
        break;
    }
  return U;
};
function rI($, J) {
  return { ...t$($.innerType._def, J), default: $.defaultValue() };
}
function sI($, J) {
  return J.effectStrategy === "input" ? t$($.schema._def, J) : G0(J);
}
function aI($) {
  return { type: "string", enum: Array.from($.values) };
}
var kj = ($) => {
  if ("type" in $ && $.type === "string") return !1;
  return "allOf" in $;
};
function tI($, J) {
  let U = [
      t$($.left._def, { ...J, currentPath: [...J.currentPath, "allOf", "0"] }),
      t$($.right._def, { ...J, currentPath: [...J.currentPath, "allOf", "1"] }),
    ].filter((X) => !!X),
    Q = J.target === "jsonSchema2019-09" ? { unevaluatedProperties: !1 } : void 0,
    W = [];
  return (
    U.forEach((X) => {
      if (kj(X)) {
        if ((W.push(...X.allOf), X.unevaluatedProperties === void 0)) Q = void 0;
      } else {
        let Y = X;
        if ("additionalProperties" in X && X.additionalProperties === !1) {
          let { additionalProperties: D, ...H } = X;
          Y = H;
        } else Q = void 0;
        W.push(Y);
      }
    }),
    W.length ? { allOf: W, ...Q } : void 0
  );
}
function eI($, J) {
  let U = typeof $.value;
  if (U !== "bigint" && U !== "number" && U !== "boolean" && U !== "string")
    return { type: Array.isArray($.value) ? "array" : "object" };
  if (J.target === "openApi3") return { type: U === "bigint" ? "integer" : U, enum: [$.value] };
  return { type: U === "bigint" ? "integer" : U, const: $.value };
}
var hF = void 0,
  tJ = {
    cuid: /^[cC][^\s-]{8,}$/,
    cuid2: /^[0-9a-z]+$/,
    ulid: /^[0-9A-HJKMNP-TV-Z]{26}$/,
    email: /^(?!\.)(?!.*\.\.)([a-zA-Z0-9_'+\-\.]*)[a-zA-Z0-9_+-]@([a-zA-Z0-9][a-zA-Z0-9\-]*\.)+[a-zA-Z]{2,}$/,
    emoji: () => {
      if (hF === void 0) hF = RegExp("^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$", "u");
      return hF;
    },
    uuid: /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/,
    ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,
    ipv4Cidr:
      /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/,
    ipv6: /^(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))$/,
    ipv6Cidr:
      /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,
    base64: /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/,
    base64url: /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/,
    nanoid: /^[a-zA-Z0-9_-]{21}$/,
    jwt: /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,
  };
function oH($, J) {
  let U = { type: "string" };
  if ($.checks)
    for (let Q of $.checks)
      switch (Q.kind) {
        case "min":
          P6(U, "minLength", typeof U.minLength === "number" ? Math.max(U.minLength, Q.value) : Q.value, Q.message, J);
          break;
        case "max":
          P6(U, "maxLength", typeof U.maxLength === "number" ? Math.min(U.maxLength, Q.value) : Q.value, Q.message, J);
          break;
        case "email":
          switch (J.emailStrategy) {
            case "format:email":
              eJ(U, "email", Q.message, J);
              break;
            case "format:idn-email":
              eJ(U, "idn-email", Q.message, J);
              break;
            case "pattern:zod":
              QJ(U, tJ.email, Q.message, J);
              break;
          }
          break;
        case "url":
          eJ(U, "uri", Q.message, J);
          break;
        case "uuid":
          eJ(U, "uuid", Q.message, J);
          break;
        case "regex":
          QJ(U, Q.regex, Q.message, J);
          break;
        case "cuid":
          QJ(U, tJ.cuid, Q.message, J);
          break;
        case "cuid2":
          QJ(U, tJ.cuid2, Q.message, J);
          break;
        case "startsWith":
          QJ(U, RegExp(`^${uF(Q.value, J)}`), Q.message, J);
          break;
        case "endsWith":
          QJ(U, RegExp(`${uF(Q.value, J)}$`), Q.message, J);
          break;
        case "datetime":
          eJ(U, "date-time", Q.message, J);
          break;
        case "date":
          eJ(U, "date", Q.message, J);
          break;
        case "time":
          eJ(U, "time", Q.message, J);
          break;
        case "duration":
          eJ(U, "duration", Q.message, J);
          break;
        case "length":
          (P6(U, "minLength", typeof U.minLength === "number" ? Math.max(U.minLength, Q.value) : Q.value, Q.message, J),
            P6(
              U,
              "maxLength",
              typeof U.maxLength === "number" ? Math.min(U.maxLength, Q.value) : Q.value,
              Q.message,
              J,
            ));
          break;
        case "includes": {
          QJ(U, RegExp(uF(Q.value, J)), Q.message, J);
          break;
        }
        case "ip": {
          if (Q.version !== "v6") eJ(U, "ipv4", Q.message, J);
          if (Q.version !== "v4") eJ(U, "ipv6", Q.message, J);
          break;
        }
        case "base64url":
          QJ(U, tJ.base64url, Q.message, J);
          break;
        case "jwt":
          QJ(U, tJ.jwt, Q.message, J);
          break;
        case "cidr": {
          if (Q.version !== "v6") QJ(U, tJ.ipv4Cidr, Q.message, J);
          if (Q.version !== "v4") QJ(U, tJ.ipv6Cidr, Q.message, J);
          break;
        }
        case "emoji":
          QJ(U, tJ.emoji(), Q.message, J);
          break;
        case "ulid": {
          QJ(U, tJ.ulid, Q.message, J);
          break;
        }
        case "base64": {
          switch (J.base64Strategy) {
            case "format:binary": {
              eJ(U, "binary", Q.message, J);
              break;
            }
            case "contentEncoding:base64": {
              P6(U, "contentEncoding", "base64", Q.message, J);
              break;
            }
            case "pattern:zod": {
              QJ(U, tJ.base64, Q.message, J);
              break;
            }
          }
          break;
        }
        case "nanoid":
          QJ(U, tJ.nanoid, Q.message, J);
        case "toLowerCase":
        case "toUpperCase":
        case "trim":
          break;
        default:
          ((W) => {})(Q);
      }
  return U;
}
function uF($, J) {
  return J.patternStrategy === "escape" ? Mj($) : $;
}
var Aj = new Set("ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvxyz0123456789");
function Mj($) {
  let J = "";
  for (let U = 0; U < $.length; U++) {
    if (!Aj.has($[U])) J += "\\";
    J += $[U];
  }
  return J;
}
function eJ($, J, U, Q) {
  if ($.format || $.anyOf?.some((W) => W.format)) {
    if (!$.anyOf) $.anyOf = [];
    if ($.format) {
      if (
        ($.anyOf.push({
          format: $.format,
          ...($.errorMessage && Q.errorMessages && { errorMessage: { format: $.errorMessage.format } }),
        }),
        delete $.format,
        $.errorMessage)
      ) {
        if ((delete $.errorMessage.format, Object.keys($.errorMessage).length === 0)) delete $.errorMessage;
      }
    }
    $.anyOf.push({ format: J, ...(U && Q.errorMessages && { errorMessage: { format: U } }) });
  } else P6($, "format", J, U, Q);
}
function QJ($, J, U, Q) {
  if ($.pattern || $.allOf?.some((W) => W.pattern)) {
    if (!$.allOf) $.allOf = [];
    if ($.pattern) {
      if (
        ($.allOf.push({
          pattern: $.pattern,
          ...($.errorMessage && Q.errorMessages && { errorMessage: { pattern: $.errorMessage.pattern } }),
        }),
        delete $.pattern,
        $.errorMessage)
      ) {
        if ((delete $.errorMessage.pattern, Object.keys($.errorMessage).length === 0)) delete $.errorMessage;
      }
    }
    $.allOf.push({ pattern: $V(J, Q), ...(U && Q.errorMessages && { errorMessage: { pattern: U } }) });
  } else P6($, "pattern", $V(J, Q), U, Q);
}
function $V($, J) {
  if (!J.applyRegexFlags || !$.flags) return $.source;
  let U = { i: $.flags.includes("i"), m: $.flags.includes("m"), s: $.flags.includes("s") },
    Q = U.i ? $.source.toLowerCase() : $.source,
    W = "",
    X = !1,
    Y = !1,
    D = !1;
  for (let H = 0; H < Q.length; H++) {
    if (X) {
      ((W += Q[H]), (X = !1));
      continue;
    }
    if (U.i) {
      if (Y) {
        if (Q[H].match(/[a-z]/)) {
          if (D) ((W += Q[H]), (W += `${Q[H - 2]}-${Q[H]}`.toUpperCase()), (D = !1));
          else if (Q[H + 1] === "-" && Q[H + 2]?.match(/[a-z]/)) ((W += Q[H]), (D = !0));
          else W += `${Q[H]}${Q[H].toUpperCase()}`;
          continue;
        }
      } else if (Q[H].match(/[a-z]/)) {
        W += `[${Q[H]}${Q[H].toUpperCase()}]`;
        continue;
      }
    }
    if (U.m) {
      if (Q[H] === "^") {
        W += `(^|(?<=[\r
]))`;
        continue;
      } else if (Q[H] === "$") {
        W += `($|(?=[\r
]))`;
        continue;
      }
    }
    if (U.s && Q[H] === ".") {
      W += Y
        ? `${Q[H]}\r
`
        : `[${Q[H]}\r
]`;
      continue;
    }
    if (((W += Q[H]), Q[H] === "\\")) X = !0;
    else if (Y && Q[H] === "]") Y = !1;
    else if (!Y && Q[H] === "[") Y = !0;
  }
  try {
    new RegExp(W);
  } catch {
    return (
      console.warn(
        `Could not convert regex pattern at ${J.currentPath.join("/")} to a flag-independent form! Falling back to the flag-ignorant source`,
      ),
      $.source
    );
  }
  return W;
}
function rH($, J) {
  if (J.target === "openAi")
    console.warn("Warning: OpenAI may not support records in schemas! Try an array of key-value pairs instead.");
  if (J.target === "openApi3" && $.keyType?._def.typeName === D$.ZodEnum)
    return {
      type: "object",
      required: $.keyType._def.values,
      properties: $.keyType._def.values.reduce(
        (Q, W) => ({
          ...Q,
          [W]: t$($.valueType._def, { ...J, currentPath: [...J.currentPath, "properties", W] }) ?? G0(J),
        }),
        {},
      ),
      additionalProperties: J.rejectedAdditionalProperties,
    };
  let U = {
    type: "object",
    additionalProperties:
      t$($.valueType._def, { ...J, currentPath: [...J.currentPath, "additionalProperties"] }) ??
      J.allowedAdditionalProperties,
  };
  if (J.target === "openApi3") return U;
  if ($.keyType?._def.typeName === D$.ZodString && $.keyType._def.checks?.length) {
    let { type: Q, ...W } = oH($.keyType._def, J);
    return { ...U, propertyNames: W };
  } else if ($.keyType?._def.typeName === D$.ZodEnum) return { ...U, propertyNames: { enum: $.keyType._def.values } };
  else if (
    $.keyType?._def.typeName === D$.ZodBranded &&
    $.keyType._def.type._def.typeName === D$.ZodString &&
    $.keyType._def.type._def.checks?.length
  ) {
    let { type: Q, ...W } = iH($.keyType._def, J);
    return { ...U, propertyNames: W };
  }
  return U;
}
function JV($, J) {
  if (J.mapStrategy === "record") return rH($, J);
  let U = t$($.keyType._def, { ...J, currentPath: [...J.currentPath, "items", "items", "0"] }) || G0(J),
    Q = t$($.valueType._def, { ...J, currentPath: [...J.currentPath, "items", "items", "1"] }) || G0(J);
  return { type: "array", maxItems: 125, items: { type: "array", items: [U, Q], minItems: 2, maxItems: 2 } };
}
function UV($) {
  let J = $.values,
    Q = Object.keys($.values)
      .filter((X) => {
        return typeof J[J[X]] !== "number";
      })
      .map((X) => J[X]),
    W = Array.from(new Set(Q.map((X) => typeof X)));
  return { type: W.length === 1 ? (W[0] === "string" ? "string" : "number") : ["string", "number"], enum: Q };
}
function WV($) {
  return $.target === "openAi" ? void 0 : { not: G0({ ...$, currentPath: [...$.currentPath, "not"] }) };
}
function QV($) {
  return $.target === "openApi3" ? { enum: ["null"], nullable: !0 } : { type: "null" };
}
var VQ = { ZodString: "string", ZodNumber: "number", ZodBigInt: "integer", ZodBoolean: "boolean", ZodNull: "null" };
function YV($, J) {
  if (J.target === "openApi3") return XV($, J);
  let U = $.options instanceof Map ? Array.from($.options.values()) : $.options;
  if (U.every((Q) => Q._def.typeName in VQ && (!Q._def.checks || !Q._def.checks.length))) {
    let Q = U.reduce((W, X) => {
      let Y = VQ[X._def.typeName];
      return Y && !W.includes(Y) ? [...W, Y] : W;
    }, []);
    return { type: Q.length > 1 ? Q : Q[0] };
  } else if (U.every((Q) => Q._def.typeName === "ZodLiteral" && !Q.description)) {
    let Q = U.reduce((W, X) => {
      let Y = typeof X._def.value;
      switch (Y) {
        case "string":
        case "number":
        case "boolean":
          return [...W, Y];
        case "bigint":
          return [...W, "integer"];
        case "object":
          if (X._def.value === null) return [...W, "null"];
        case "symbol":
        case "undefined":
        case "function":
        default:
          return W;
      }
    }, []);
    if (Q.length === U.length) {
      let W = Q.filter((X, Y, D) => D.indexOf(X) === Y);
      return {
        type: W.length > 1 ? W : W[0],
        enum: U.reduce((X, Y) => {
          return X.includes(Y._def.value) ? X : [...X, Y._def.value];
        }, []),
      };
    }
  } else if (U.every((Q) => Q._def.typeName === "ZodEnum"))
    return { type: "string", enum: U.reduce((Q, W) => [...Q, ...W._def.values.filter((X) => !Q.includes(X))], []) };
  return XV($, J);
}
var XV = ($, J) => {
  let U = ($.options instanceof Map ? Array.from($.options.values()) : $.options)
    .map((Q, W) => t$(Q._def, { ...J, currentPath: [...J.currentPath, "anyOf", `${W}`] }))
    .filter((Q) => !!Q && (!J.strictUnions || (typeof Q === "object" && Object.keys(Q).length > 0)));
  return U.length ? { anyOf: U } : void 0;
};
function DV($, J) {
  if (
    ["ZodString", "ZodNumber", "ZodBigInt", "ZodBoolean", "ZodNull"].includes($.innerType._def.typeName) &&
    (!$.innerType._def.checks || !$.innerType._def.checks.length)
  ) {
    if (J.target === "openApi3") return { type: VQ[$.innerType._def.typeName], nullable: !0 };
    return { type: [VQ[$.innerType._def.typeName], "null"] };
  }
  if (J.target === "openApi3") {
    let Q = t$($.innerType._def, { ...J, currentPath: [...J.currentPath] });
    if (Q && "$ref" in Q) return { allOf: [Q], nullable: !0 };
    return Q && { ...Q, nullable: !0 };
  }
  let U = t$($.innerType._def, { ...J, currentPath: [...J.currentPath, "anyOf", "0"] });
  return U && { anyOf: [U, { type: "null" }] };
}
function HV($, J) {
  let U = { type: "number" };
  if (!$.checks) return U;
  for (let Q of $.checks)
    switch (Q.kind) {
      case "int":
        ((U.type = "integer"), xF(U, "type", Q.message, J));
        break;
      case "min":
        if (J.target === "jsonSchema7")
          if (Q.inclusive) P6(U, "minimum", Q.value, Q.message, J);
          else P6(U, "exclusiveMinimum", Q.value, Q.message, J);
        else {
          if (!Q.inclusive) U.exclusiveMinimum = !0;
          P6(U, "minimum", Q.value, Q.message, J);
        }
        break;
      case "max":
        if (J.target === "jsonSchema7")
          if (Q.inclusive) P6(U, "maximum", Q.value, Q.message, J);
          else P6(U, "exclusiveMaximum", Q.value, Q.message, J);
        else {
          if (!Q.inclusive) U.exclusiveMaximum = !0;
          P6(U, "maximum", Q.value, Q.message, J);
        }
        break;
      case "multipleOf":
        P6(U, "multipleOf", Q.value, Q.message, J);
        break;
    }
  return U;
}
function GV($, J) {
  let U = J.target === "openAi",
    Q = { type: "object", properties: {} },
    W = [],
    X = $.shape();
  for (let D in X) {
    let H = X[D];
    if (H === void 0 || H._def === void 0) continue;
    let G = Zj(H);
    if (G && U) {
      if (H._def.typeName === "ZodOptional") H = H._def.innerType;
      if (!H.isNullable()) H = H.nullable();
      G = !1;
    }
    let K = t$(H._def, {
      ...J,
      currentPath: [...J.currentPath, "properties", D],
      propertyPath: [...J.currentPath, "properties", D],
    });
    if (K === void 0) continue;
    if (((Q.properties[D] = K), !G)) W.push(D);
  }
  if (W.length) Q.required = W;
  let Y = Rj($, J);
  if (Y !== void 0) Q.additionalProperties = Y;
  return Q;
}
function Rj($, J) {
  if ($.catchall._def.typeName !== "ZodNever")
    return t$($.catchall._def, { ...J, currentPath: [...J.currentPath, "additionalProperties"] });
  switch ($.unknownKeys) {
    case "passthrough":
      return J.allowedAdditionalProperties;
    case "strict":
      return J.rejectedAdditionalProperties;
    case "strip":
      return J.removeAdditionalStrategy === "strict" ? J.allowedAdditionalProperties : J.rejectedAdditionalProperties;
  }
}
function Zj($) {
  try {
    return $.isOptional();
  } catch {
    return !0;
  }
}
var KV = ($, J) => {
  if (J.currentPath.toString() === J.propertyPath?.toString()) return t$($.innerType._def, J);
  let U = t$($.innerType._def, { ...J, currentPath: [...J.currentPath, "anyOf", "1"] });
  return U ? { anyOf: [{ not: G0(J) }, U] } : G0(J);
};
var NV = ($, J) => {
  if (J.pipeStrategy === "input") return t$($.in._def, J);
  else if (J.pipeStrategy === "output") return t$($.out._def, J);
  let U = t$($.in._def, { ...J, currentPath: [...J.currentPath, "allOf", "0"] }),
    Q = t$($.out._def, { ...J, currentPath: [...J.currentPath, "allOf", U ? "1" : "0"] });
  return { allOf: [U, Q].filter((W) => W !== void 0) };
};
function OV($, J) {
  return t$($.type._def, J);
}
function FV($, J) {
  let Q = {
    type: "array",
    uniqueItems: !0,
    items: t$($.valueType._def, { ...J, currentPath: [...J.currentPath, "items"] }),
  };
  if ($.minSize) P6(Q, "minItems", $.minSize.value, $.minSize.message, J);
  if ($.maxSize) P6(Q, "maxItems", $.maxSize.value, $.maxSize.message, J);
  return Q;
}
function qV($, J) {
  if ($.rest)
    return {
      type: "array",
      minItems: $.items.length,
      items: $.items
        .map((U, Q) => t$(U._def, { ...J, currentPath: [...J.currentPath, "items", `${Q}`] }))
        .reduce((U, Q) => (Q === void 0 ? U : [...U, Q]), []),
      additionalItems: t$($.rest._def, { ...J, currentPath: [...J.currentPath, "additionalItems"] }),
    };
  else
    return {
      type: "array",
      minItems: $.items.length,
      maxItems: $.items.length,
      items: $.items
        .map((U, Q) => t$(U._def, { ...J, currentPath: [...J.currentPath, "items", `${Q}`] }))
        .reduce((U, Q) => (Q === void 0 ? U : [...U, Q]), []),
    };
}
function zV($) {
  return { not: G0($) };
}
function BV($) {
  return G0($);
}
var EV = ($, J) => {
  return t$($.innerType._def, J);
};
var LV = ($, J, U) => {
  switch (J) {
    case D$.ZodString:
      return oH($, U);
    case D$.ZodNumber:
      return HV($, U);
    case D$.ZodObject:
      return GV($, U);
    case D$.ZodBigInt:
      return nI($, U);
    case D$.ZodBoolean:
      return iI();
    case D$.ZodDate:
      return gF($, U);
    case D$.ZodUndefined:
      return zV(U);
    case D$.ZodNull:
      return QV(U);
    case D$.ZodArray:
      return cI($, U);
    case D$.ZodUnion:
    case D$.ZodDiscriminatedUnion:
      return YV($, U);
    case D$.ZodIntersection:
      return tI($, U);
    case D$.ZodTuple:
      return qV($, U);
    case D$.ZodRecord:
      return rH($, U);
    case D$.ZodLiteral:
      return eI($, U);
    case D$.ZodEnum:
      return aI($);
    case D$.ZodNativeEnum:
      return UV($);
    case D$.ZodNullable:
      return DV($, U);
    case D$.ZodOptional:
      return KV($, U);
    case D$.ZodMap:
      return JV($, U);
    case D$.ZodSet:
      return FV($, U);
    case D$.ZodLazy:
      return () => $.getter()._def;
    case D$.ZodPromise:
      return OV($, U);
    case D$.ZodNaN:
    case D$.ZodNever:
      return WV(U);
    case D$.ZodEffects:
      return sI($, U);
    case D$.ZodAny:
      return G0(U);
    case D$.ZodUnknown:
      return BV(U);
    case D$.ZodDefault:
      return rI($, U);
    case D$.ZodBranded:
      return iH($, U);
    case D$.ZodReadonly:
      return EV($, U);
    case D$.ZodCatch:
      return oI($, U);
    case D$.ZodPipeline:
      return NV($, U);
    case D$.ZodFunction:
    case D$.ZodVoid:
    case D$.ZodSymbol:
      return;
    default:
      return ((Q) => {
        return;
      })(J);
  }
};
function t$($, J, U = !1) {
  let Q = J.seen.get($);
  if (J.override) {
    let D = J.override?.($, J, Q, U);
    if (D !== mI) return D;
  }
  if (Q && !U) {
    let D = Pj(Q, J);
    if (D !== void 0) return D;
  }
  let W = { def: $, path: J.currentPath, jsonSchema: void 0 };
  J.seen.set($, W);
  let X = LV($, $.typeName, J),
    Y = typeof X === "function" ? t$(X(), J) : X;
  if (Y) _j($, J, Y);
  if (J.postProcess) {
    let D = J.postProcess(Y, $, J);
    return ((W.jsonSchema = Y), D);
  }
  return ((W.jsonSchema = Y), Y);
}
var Pj = ($, J) => {
    switch (J.$refStrategy) {
      case "root":
        return { $ref: $.path.join("/") };
      case "relative":
        return { $ref: nH(J.currentPath, $.path) };
      case "none":
      case "seen": {
        if ($.path.length < J.currentPath.length && $.path.every((U, Q) => J.currentPath[Q] === U))
          return (console.warn(`Recursive reference detected at ${J.currentPath.join("/")}! Defaulting to any`), G0(J));
        return J.$refStrategy === "seen" ? G0(J) : void 0;
      }
    }
  },
  _j = ($, J, U) => {
    if ($.description) {
      if (((U.description = $.description), J.markdownDescription)) U.markdownDescription = $.description;
    }
    return U;
  };
var lF = ($, J) => {
  let U = dI(J),
    Q =
      typeof J === "object" && J.definitions
        ? Object.entries(J.definitions).reduce(
            (H, [G, K]) => ({
              ...H,
              [G]: t$(K._def, { ...U, currentPath: [...U.basePath, U.definitionPath, G] }, !0) ?? G0(U),
            }),
            {},
          )
        : void 0,
    W = typeof J === "string" ? J : J?.nameStrategy === "title" ? void 0 : J?.name,
    X = t$($._def, W === void 0 ? U : { ...U, currentPath: [...U.basePath, U.definitionPath, W] }, !1) ?? G0(U),
    Y = typeof J === "object" && J.name !== void 0 && J.nameStrategy === "title" ? J.name : void 0;
  if (Y !== void 0) X.title = Y;
  if (U.flags.hasReferencedOpenAiAnyType) {
    if (!Q) Q = {};
    if (!Q[U.openAiAnyTypeName])
      Q[U.openAiAnyTypeName] = {
        type: ["string", "number", "integer", "boolean", "array", "null"],
        items: {
          $ref: U.$refStrategy === "relative" ? "1" : [...U.basePath, U.definitionPath, U.openAiAnyTypeName].join("/"),
        },
      };
  }
  let D =
    W === void 0
      ? Q
        ? { ...X, [U.definitionPath]: Q }
        : X
      : {
          $ref: [...(U.$refStrategy === "relative" ? [] : U.basePath), U.definitionPath, W].join("/"),
          [U.definitionPath]: { ...Q, [W]: X },
        };
  if (U.target === "jsonSchema7") D.$schema = "http://json-schema.org/draft-07/schema#";
  else if (U.target === "jsonSchema2019-09" || U.target === "openAi")
    D.$schema = "https://json-schema.org/draft/2019-09/schema#";
  if (U.target === "openAi" && ("anyOf" in D || "oneOf" in D || "allOf" in D || ("type" in D && Array.isArray(D.type))))
    console.warn(
      "Warning: OpenAI may not support schemas with unions as roots! Try wrapping it in an object property.",
    );
  return D;
};
function Sj($) {
  if (!$) return "draft-7";
  if ($ === "jsonSchema7" || $ === "draft-7") return "draft-7";
  if ($ === "jsonSchema2019-09" || $ === "draft-2020-12") return "draft-2020-12";
  return "draft-7";
}
function mF($, J) {
  if (xJ($)) return V9($, { target: Sj(J?.target), io: J?.pipeStrategy ?? "input" });
  return lF($, { strictUnions: J?.strictUnions ?? !0, pipeStrategy: J?.pipeStrategy ?? "input" });
}
function pF($) {
  let U = _8($)?.method;
  if (!U) throw Error("Schema is missing a method literal");
  let Q = rD(U);
  if (typeof Q !== "string") throw Error("Schema method literal must be a string");
  return Q;
}
function dF($, J) {
  let U = P8($, J);
  if (!U.success) throw U.error;
  return U.data;
}
var Cj = 60000;
class cF {
  constructor($) {
    if (
      ((this._options = $),
      (this._requestMessageId = 0),
      (this._requestHandlers = new Map()),
      (this._requestHandlerAbortControllers = new Map()),
      (this._notificationHandlers = new Map()),
      (this._responseHandlers = new Map()),
      (this._progressHandlers = new Map()),
      (this._timeoutInfo = new Map()),
      (this._pendingDebouncedNotifications = new Set()),
      (this._taskProgressTokens = new Map()),
      (this._requestResolvers = new Map()),
      this.setNotificationHandler(SH, (J) => {
        this._oncancel(J);
      }),
      this.setNotificationHandler(TH, (J) => {
        this._onprogress(J);
      }),
      this.setRequestHandler(CH, (J) => ({})),
      (this._taskStore = $?.taskStore),
      (this._taskMessageQueue = $?.taskMessageQueue),
      this._taskStore)
    )
      (this.setRequestHandler(jH, async (J, U) => {
        let Q = await this._taskStore.getTask(J.params.taskId, U.sessionId);
        if (!Q) throw new g$(n$.InvalidParams, "Failed to retrieve task: Task not found");
        return { ...Q };
      }),
        this.setRequestHandler(bH, async (J, U) => {
          let Q = async () => {
            let W = J.params.taskId;
            if (this._taskMessageQueue) {
              let Y;
              while ((Y = await this._taskMessageQueue.dequeue(W, U.sessionId))) {
                if (Y.type === "response" || Y.type === "error") {
                  let D = Y.message,
                    H = D.id,
                    G = this._requestResolvers.get(H);
                  if (G)
                    if ((this._requestResolvers.delete(H), Y.type === "response")) G(D);
                    else {
                      let K = D,
                        O = new g$(K.error.code, K.error.message, K.error.data);
                      G(O);
                    }
                  else {
                    let K = Y.type === "response" ? "Response" : "Error";
                    this._onerror(Error(`${K} handler missing for request ${H}`));
                  }
                  continue;
                }
                await this._transport?.send(Y.message, { relatedRequestId: U.requestId });
              }
            }
            let X = await this._taskStore.getTask(W, U.sessionId);
            if (!X) throw new g$(n$.InvalidParams, `Task not found: ${W}`);
            if (!T8(X.status)) return (await this._waitForTaskUpdate(W, U.signal), await Q());
            if (T8(X.status)) {
              let Y = await this._taskStore.getTaskResult(W, U.sessionId);
              return (this._clearTaskQueue(W), { ...Y, _meta: { ...Y._meta, [C8]: { taskId: W } } });
            }
            return await Q();
          };
          return await Q();
        }),
        this.setRequestHandler(fH, async (J, U) => {
          try {
            let { tasks: Q, nextCursor: W } = await this._taskStore.listTasks(J.params?.cursor, U.sessionId);
            return { tasks: Q, nextCursor: W, _meta: {} };
          } catch (Q) {
            throw new g$(n$.InvalidParams, `Failed to list tasks: ${Q instanceof Error ? Q.message : String(Q)}`);
          }
        }),
        this.setRequestHandler(xH, async (J, U) => {
          try {
            let Q = await this._taskStore.getTask(J.params.taskId, U.sessionId);
            if (!Q) throw new g$(n$.InvalidParams, `Task not found: ${J.params.taskId}`);
            if (T8(Q.status)) throw new g$(n$.InvalidParams, `Cannot cancel task in terminal status: ${Q.status}`);
            (await this._taskStore.updateTaskStatus(
              J.params.taskId,
              "cancelled",
              "Client cancelled task execution.",
              U.sessionId,
            ),
              this._clearTaskQueue(J.params.taskId));
            let W = await this._taskStore.getTask(J.params.taskId, U.sessionId);
            if (!W) throw new g$(n$.InvalidParams, `Task not found after cancellation: ${J.params.taskId}`);
            return { _meta: {}, ...W };
          } catch (Q) {
            if (Q instanceof g$) throw Q;
            throw new g$(n$.InvalidRequest, `Failed to cancel task: ${Q instanceof Error ? Q.message : String(Q)}`);
          }
        }));
  }
  async _oncancel($) {
    if (!$.params.requestId) return;
    this._requestHandlerAbortControllers.get($.params.requestId)?.abort($.params.reason);
  }
  _setupTimeout($, J, U, Q, W = !1) {
    this._timeoutInfo.set($, {
      timeoutId: setTimeout(Q, J),
      startTime: Date.now(),
      timeout: J,
      maxTotalTimeout: U,
      resetTimeoutOnProgress: W,
      onTimeout: Q,
    });
  }
  _resetTimeout($) {
    let J = this._timeoutInfo.get($);
    if (!J) return !1;
    let U = Date.now() - J.startTime;
    if (J.maxTotalTimeout && U >= J.maxTotalTimeout)
      throw (
        this._timeoutInfo.delete($),
        g$.fromError(n$.RequestTimeout, "Maximum total timeout exceeded", {
          maxTotalTimeout: J.maxTotalTimeout,
          totalElapsed: U,
        })
      );
    return (clearTimeout(J.timeoutId), (J.timeoutId = setTimeout(J.onTimeout, J.timeout)), !0);
  }
  _cleanupTimeout($) {
    let J = this._timeoutInfo.get($);
    if (J) (clearTimeout(J.timeoutId), this._timeoutInfo.delete($));
  }
  async connect($) {
    if (this._transport)
      throw Error(
        "Already connected to a transport. Call close() before connecting to a new transport, or use a separate Protocol instance per connection.",
      );
    this._transport = $;
    let J = this.transport?.onclose;
    this._transport.onclose = () => {
      (J?.(), this._onclose());
    };
    let U = this.transport?.onerror;
    this._transport.onerror = (W) => {
      (U?.(W), this._onerror(W));
    };
    let Q = this._transport?.onmessage;
    ((this._transport.onmessage = (W, X) => {
      if ((Q?.(W, X), OQ(W) || SI(W))) this._onresponse(W);
      else if (AF(W)) this._onrequest(W, X);
      else if (_I(W)) this._onnotification(W);
      else this._onerror(Error(`Unknown message type: ${JSON.stringify(W)}`));
    }),
      await this._transport.start());
  }
  _onclose() {
    let $ = this._responseHandlers;
    ((this._responseHandlers = new Map()),
      this._progressHandlers.clear(),
      this._taskProgressTokens.clear(),
      this._pendingDebouncedNotifications.clear());
    for (let U of this._timeoutInfo.values()) clearTimeout(U.timeoutId);
    this._timeoutInfo.clear();
    for (let U of this._requestHandlerAbortControllers.values()) U.abort();
    this._requestHandlerAbortControllers.clear();
    let J = g$.fromError(n$.ConnectionClosed, "Connection closed");
    ((this._transport = void 0), this.onclose?.());
    for (let U of $.values()) U(J);
  }
  _onerror($) {
    this.onerror?.($);
  }
  _onnotification($) {
    let J = this._notificationHandlers.get($.method) ?? this.fallbackNotificationHandler;
    if (J === void 0) return;
    Promise.resolve()
      .then(() => J($))
      .catch((U) => this._onerror(Error(`Uncaught error in notification handler: ${U}`)));
  }
  _onrequest($, J) {
    let U = this._requestHandlers.get($.method) ?? this.fallbackRequestHandler,
      Q = this._transport,
      W = $.params?._meta?.[C8]?.taskId;
    if (U === void 0) {
      let G = { jsonrpc: "2.0", id: $.id, error: { code: n$.MethodNotFound, message: "Method not found" } };
      if (W && this._taskMessageQueue)
        this._enqueueTaskMessage(W, { type: "error", message: G, timestamp: Date.now() }, Q?.sessionId).catch((K) =>
          this._onerror(Error(`Failed to enqueue error response: ${K}`)),
        );
      else Q?.send(G).catch((K) => this._onerror(Error(`Failed to send an error response: ${K}`)));
      return;
    }
    let X = new AbortController();
    this._requestHandlerAbortControllers.set($.id, X);
    let Y = RI($.params) ? $.params.task : void 0,
      D = this._taskStore ? this.requestTaskStore($, Q?.sessionId) : void 0,
      H = {
        signal: X.signal,
        sessionId: Q?.sessionId,
        _meta: $.params?._meta,
        sendNotification: async (G) => {
          if (X.signal.aborted) return;
          let K = { relatedRequestId: $.id };
          if (W) K.relatedTask = { taskId: W };
          await this.notification(G, K);
        },
        sendRequest: async (G, K, O) => {
          if (X.signal.aborted) throw new g$(n$.ConnectionClosed, "Request was cancelled");
          let N = { ...O, relatedRequestId: $.id };
          if (W && !N.relatedTask) N.relatedTask = { taskId: W };
          let F = N.relatedTask?.taskId ?? W;
          if (F && D) await D.updateTaskStatus(F, "input_required");
          return await this.request(G, K, N);
        },
        authInfo: J?.authInfo,
        requestId: $.id,
        requestInfo: J?.requestInfo,
        taskId: W,
        taskStore: D,
        taskRequestedTtl: Y?.ttl,
        closeSSEStream: J?.closeSSEStream,
        closeStandaloneSSEStream: J?.closeStandaloneSSEStream,
      };
    Promise.resolve()
      .then(() => {
        if (Y) this.assertTaskHandlerCapability($.method);
      })
      .then(() => U($, H))
      .then(
        async (G) => {
          if (X.signal.aborted) return;
          let K = { result: G, jsonrpc: "2.0", id: $.id };
          if (W && this._taskMessageQueue)
            await this._enqueueTaskMessage(W, { type: "response", message: K, timestamp: Date.now() }, Q?.sessionId);
          else await Q?.send(K);
        },
        async (G) => {
          if (X.signal.aborted) return;
          let K = {
            jsonrpc: "2.0",
            id: $.id,
            error: {
              code: Number.isSafeInteger(G.code) ? G.code : n$.InternalError,
              message: G.message ?? "Internal error",
              ...(G.data !== void 0 && { data: G.data }),
            },
          };
          if (W && this._taskMessageQueue)
            await this._enqueueTaskMessage(W, { type: "error", message: K, timestamp: Date.now() }, Q?.sessionId);
          else await Q?.send(K);
        },
      )
      .catch((G) => this._onerror(Error(`Failed to send response: ${G}`)))
      .finally(() => {
        if (this._requestHandlerAbortControllers.get($.id) === X) this._requestHandlerAbortControllers.delete($.id);
      });
  }
  _onprogress($) {
    let { progressToken: J, ...U } = $.params,
      Q = Number(J),
      W = this._progressHandlers.get(Q);
    if (!W) {
      this._onerror(Error(`Received a progress notification for an unknown token: ${JSON.stringify($)}`));
      return;
    }
    let X = this._responseHandlers.get(Q),
      Y = this._timeoutInfo.get(Q);
    if (Y && X && Y.resetTimeoutOnProgress)
      try {
        this._resetTimeout(Q);
      } catch (D) {
        (this._responseHandlers.delete(Q), this._progressHandlers.delete(Q), this._cleanupTimeout(Q), X(D));
        return;
      }
    W(U);
  }
  _onresponse($) {
    let J = Number($.id),
      U = this._requestResolvers.get(J);
    if (U) {
      if ((this._requestResolvers.delete(J), OQ($))) U($);
      else {
        let X = new g$($.error.code, $.error.message, $.error.data);
        U(X);
      }
      return;
    }
    let Q = this._responseHandlers.get(J);
    if (Q === void 0) {
      this._onerror(Error(`Received a response for an unknown message ID: ${JSON.stringify($)}`));
      return;
    }
    (this._responseHandlers.delete(J), this._cleanupTimeout(J));
    let W = !1;
    if (OQ($) && $.result && typeof $.result === "object") {
      let X = $.result;
      if (X.task && typeof X.task === "object") {
        let Y = X.task;
        if (typeof Y.taskId === "string") ((W = !0), this._taskProgressTokens.set(Y.taskId, J));
      }
    }
    if (!W) this._progressHandlers.delete(J);
    if (OQ($)) Q($);
    else {
      let X = g$.fromError($.error.code, $.error.message, $.error.data);
      Q(X);
    }
  }
  get transport() {
    return this._transport;
  }
  async close() {
    await this._transport?.close();
  }
  async *requestStream($, J, U) {
    let { task: Q } = U ?? {};
    if (!Q) {
      try {
        yield { type: "result", result: await this.request($, J, U) };
      } catch (X) {
        yield { type: "error", error: X instanceof g$ ? X : new g$(n$.InternalError, String(X)) };
      }
      return;
    }
    let W;
    try {
      let X = await this.request($, iW, U);
      if (X.task) ((W = X.task.taskId), yield { type: "taskCreated", task: X.task });
      else throw new g$(n$.InternalError, "Task creation did not return a task");
      while (!0) {
        let Y = await this.getTask({ taskId: W }, U);
        if ((yield { type: "taskStatus", task: Y }, T8(Y.status))) {
          if (Y.status === "completed") yield { type: "result", result: await this.getTaskResult({ taskId: W }, J, U) };
          else if (Y.status === "failed") yield { type: "error", error: new g$(n$.InternalError, `Task ${W} failed`) };
          else if (Y.status === "cancelled")
            yield { type: "error", error: new g$(n$.InternalError, `Task ${W} was cancelled`) };
          return;
        }
        if (Y.status === "input_required") {
          yield { type: "result", result: await this.getTaskResult({ taskId: W }, J, U) };
          return;
        }
        let D = Y.pollInterval ?? this._options?.defaultTaskPollInterval ?? 1000;
        (await new Promise((H) => setTimeout(H, D)), U?.signal?.throwIfAborted());
      }
    } catch (X) {
      yield { type: "error", error: X instanceof g$ ? X : new g$(n$.InternalError, String(X)) };
    }
  }
  request($, J, U) {
    let { relatedRequestId: Q, resumptionToken: W, onresumptiontoken: X, task: Y, relatedTask: D } = U ?? {};
    return new Promise((H, G) => {
      let K = (q) => {
        G(q);
      };
      if (!this._transport) {
        K(Error("Not connected"));
        return;
      }
      if (this._options?.enforceStrictCapabilities === !0)
        try {
          if ((this.assertCapabilityForMethod($.method), Y)) this.assertTaskCapability($.method);
        } catch (q) {
          K(q);
          return;
        }
      U?.signal?.throwIfAborted();
      let O = this._requestMessageId++,
        N = { ...$, jsonrpc: "2.0", id: O };
      if (U?.onprogress)
        (this._progressHandlers.set(O, U.onprogress),
          (N.params = { ...$.params, _meta: { ...($.params?._meta || {}), progressToken: O } }));
      if (Y) N.params = { ...N.params, task: Y };
      if (D) N.params = { ...N.params, _meta: { ...(N.params?._meta || {}), [C8]: D } };
      let F = (q) => {
        (this._responseHandlers.delete(O),
          this._progressHandlers.delete(O),
          this._cleanupTimeout(O),
          this._transport
            ?.send(
              { jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: O, reason: String(q) } },
              { relatedRequestId: Q, resumptionToken: W, onresumptiontoken: X },
            )
            .catch((V) => this._onerror(Error(`Failed to send cancellation: ${V}`))));
        let L = q instanceof g$ ? q : new g$(n$.RequestTimeout, String(q));
        G(L);
      };
      (this._responseHandlers.set(O, (q) => {
        if (U?.signal?.aborted) return;
        if (q instanceof Error) return G(q);
        try {
          let L = P8(J, q.result);
          if (!L.success) G(L.error);
          else H(L.data);
        } catch (L) {
          G(L);
        }
      }),
        U?.signal?.addEventListener("abort", () => {
          F(U?.signal?.reason);
        }));
      let B = U?.timeout ?? Cj,
        E = () => F(g$.fromError(n$.RequestTimeout, "Request timed out", { timeout: B }));
      this._setupTimeout(O, B, U?.maxTotalTimeout, E, U?.resetTimeoutOnProgress ?? !1);
      let z = D?.taskId;
      if (z) {
        let q = (L) => {
          let V = this._responseHandlers.get(O);
          if (V) V(L);
          else this._onerror(Error(`Response handler missing for side-channeled request ${O}`));
        };
        (this._requestResolvers.set(O, q),
          this._enqueueTaskMessage(z, { type: "request", message: N, timestamp: Date.now() }).catch((L) => {
            (this._cleanupTimeout(O), G(L));
          }));
      } else
        this._transport.send(N, { relatedRequestId: Q, resumptionToken: W, onresumptiontoken: X }).catch((q) => {
          (this._cleanupTimeout(O), G(q));
        });
    });
  }
  async getTask($, J) {
    return this.request({ method: "tasks/get", params: $ }, vH, J);
  }
  async getTaskResult($, J, U) {
    return this.request({ method: "tasks/result", params: $ }, J, U);
  }
  async listTasks($, J) {
    return this.request({ method: "tasks/list", params: $ }, yH, J);
  }
  async cancelTask($, J) {
    return this.request({ method: "tasks/cancel", params: $ }, jI, J);
  }
  async notification($, J) {
    if (!this._transport) throw Error("Not connected");
    this.assertNotificationCapability($.method);
    let U = J?.relatedTask?.taskId;
    if (U) {
      let Y = {
        ...$,
        jsonrpc: "2.0",
        params: { ...$.params, _meta: { ...($.params?._meta || {}), [C8]: J.relatedTask } },
      };
      await this._enqueueTaskMessage(U, { type: "notification", message: Y, timestamp: Date.now() });
      return;
    }
    if (
      (this._options?.debouncedNotificationMethods ?? []).includes($.method) &&
      !$.params &&
      !J?.relatedRequestId &&
      !J?.relatedTask
    ) {
      if (this._pendingDebouncedNotifications.has($.method)) return;
      (this._pendingDebouncedNotifications.add($.method),
        Promise.resolve().then(() => {
          if ((this._pendingDebouncedNotifications.delete($.method), !this._transport)) return;
          let Y = { ...$, jsonrpc: "2.0" };
          if (J?.relatedTask)
            Y = { ...Y, params: { ...Y.params, _meta: { ...(Y.params?._meta || {}), [C8]: J.relatedTask } } };
          this._transport?.send(Y, J).catch((D) => this._onerror(D));
        }));
      return;
    }
    let X = { ...$, jsonrpc: "2.0" };
    if (J?.relatedTask)
      X = { ...X, params: { ...X.params, _meta: { ...(X.params?._meta || {}), [C8]: J.relatedTask } } };
    await this._transport.send(X, J);
  }
  setRequestHandler($, J) {
    let U = pF($);
    (this.assertRequestHandlerCapability(U),
      this._requestHandlers.set(U, (Q, W) => {
        let X = dF($, Q);
        return Promise.resolve(J(X, W));
      }));
  }
  removeRequestHandler($) {
    this._requestHandlers.delete($);
  }
  assertCanSetRequestHandler($) {
    if (this._requestHandlers.has($))
      throw Error(`A request handler for ${$} already exists, which would be overridden`);
  }
  setNotificationHandler($, J) {
    let U = pF($);
    this._notificationHandlers.set(U, (Q) => {
      let W = dF($, Q);
      return Promise.resolve(J(W));
    });
  }
  removeNotificationHandler($) {
    this._notificationHandlers.delete($);
  }
  _cleanupTaskProgressHandler($) {
    let J = this._taskProgressTokens.get($);
    if (J !== void 0) (this._progressHandlers.delete(J), this._taskProgressTokens.delete($));
  }
  async _enqueueTaskMessage($, J, U) {
    if (!this._taskStore || !this._taskMessageQueue)
      throw Error("Cannot enqueue task message: taskStore and taskMessageQueue are not configured");
    let Q = this._options?.maxTaskQueueSize;
    await this._taskMessageQueue.enqueue($, J, U, Q);
  }
  async _clearTaskQueue($, J) {
    if (this._taskMessageQueue) {
      let U = await this._taskMessageQueue.dequeueAll($, J);
      for (let Q of U)
        if (Q.type === "request" && AF(Q.message)) {
          let W = Q.message.id,
            X = this._requestResolvers.get(W);
          if (X) (X(new g$(n$.InternalError, "Task cancelled or completed")), this._requestResolvers.delete(W));
          else this._onerror(Error(`Resolver missing for request ${W} during task ${$} cleanup`));
        }
    }
  }
  async _waitForTaskUpdate($, J) {
    let U = this._options?.defaultTaskPollInterval ?? 1000;
    try {
      let Q = await this._taskStore?.getTask($);
      if (Q?.pollInterval) U = Q.pollInterval;
    } catch {}
    return new Promise((Q, W) => {
      if (J.aborted) {
        W(new g$(n$.InvalidRequest, "Request cancelled"));
        return;
      }
      let X = setTimeout(Q, U);
      J.addEventListener(
        "abort",
        () => {
          (clearTimeout(X), W(new g$(n$.InvalidRequest, "Request cancelled")));
        },
        { once: !0 },
      );
    });
  }
  requestTaskStore($, J) {
    let U = this._taskStore;
    if (!U) throw Error("No task store configured");
    return {
      createTask: async (Q) => {
        if (!$) throw Error("No request provided");
        return await U.createTask(Q, $.id, { method: $.method, params: $.params }, J);
      },
      getTask: async (Q) => {
        let W = await U.getTask(Q, J);
        if (!W) throw new g$(n$.InvalidParams, "Failed to retrieve task: Task not found");
        return W;
      },
      storeTaskResult: async (Q, W, X) => {
        await U.storeTaskResult(Q, W, X, J);
        let Y = await U.getTask(Q, J);
        if (Y) {
          let D = EQ.parse({ method: "notifications/tasks/status", params: Y });
          if ((await this.notification(D), T8(Y.status))) this._cleanupTaskProgressHandler(Q);
        }
      },
      getTaskResult: (Q) => {
        return U.getTaskResult(Q, J);
      },
      updateTaskStatus: async (Q, W, X) => {
        let Y = await U.getTask(Q, J);
        if (!Y) throw new g$(n$.InvalidParams, `Task "${Q}" not found - it may have been cleaned up`);
        if (T8(Y.status))
          throw new g$(
            n$.InvalidParams,
            `Cannot update task "${Q}" from terminal status "${Y.status}" to "${W}". Terminal states (completed, failed, cancelled) cannot transition to other states.`,
          );
        await U.updateTaskStatus(Q, W, X, J);
        let D = await U.getTask(Q, J);
        if (D) {
          let H = EQ.parse({ method: "notifications/tasks/status", params: D });
          if ((await this.notification(H), T8(D.status))) this._cleanupTaskProgressHandler(Q);
        }
      },
      listTasks: (Q) => {
        return U.listTasks(Q, J);
      },
    };
  }
}
function wV($) {
  return $ !== null && typeof $ === "object" && !Array.isArray($);
}
function IV($, J) {
  let U = { ...$ };
  for (let Q in J) {
    let W = Q,
      X = J[W];
    if (X === void 0) continue;
    let Y = U[W];
    if (wV(Y) && wV(X)) U[W] = { ...Y, ...X };
    else U[W] = X;
  }
  return U;
}
var UR = UL(uq(), 1),
  WR = UL(JR(), 1);
function eu() {
  let $ = new UR.default({ strict: !1, validateFormats: !0, validateSchema: !1, allErrors: !0 });
  return (WR.default($), $);
}
class sq {
  constructor($) {
    this._ajv = $ ?? eu();
  }
  getValidator($) {
    let J =
      "$id" in $ && typeof $.$id === "string"
        ? (this._ajv.getSchema($.$id) ?? this._ajv.compile($))
        : this._ajv.compile($);
    return (U) => {
      if (J(U)) return { valid: !0, data: U, errorMessage: void 0 };
      else return { valid: !1, data: void 0, errorMessage: this._ajv.errorsText(J.errors) };
    };
  }
}
class aq {
  constructor($) {
    this._server = $;
  }
  requestStream($, J, U) {
    return this._server.requestStream($, J, U);
  }
  createMessageStream($, J) {
    let U = this._server.getClientCapabilities();
    if (($.tools || $.toolChoice) && !U?.sampling?.tools)
      throw Error("Client does not support sampling tools capability.");
    if ($.messages.length > 0) {
      let Q = $.messages[$.messages.length - 1],
        W = Array.isArray(Q.content) ? Q.content : [Q.content],
        X = W.some((G) => G.type === "tool_result"),
        Y = $.messages.length > 1 ? $.messages[$.messages.length - 2] : void 0,
        D = Y ? (Array.isArray(Y.content) ? Y.content : [Y.content]) : [],
        H = D.some((G) => G.type === "tool_use");
      if (X) {
        if (W.some((G) => G.type !== "tool_result"))
          throw Error("The last message must contain only tool_result content if any is present");
        if (!H) throw Error("tool_result blocks are not matching any tool_use from the previous message");
      }
      if (H) {
        let G = new Set(D.filter((O) => O.type === "tool_use").map((O) => O.id)),
          K = new Set(W.filter((O) => O.type === "tool_result").map((O) => O.toolUseId));
        if (G.size !== K.size || ![...G].every((O) => K.has(O)))
          throw Error("ids of tool_result blocks and tool_use blocks from previous message do not match");
      }
    }
    return this.requestStream({ method: "sampling/createMessage", params: $ }, IQ, J);
  }
  elicitInputStream($, J) {
    let U = this._server.getClientCapabilities(),
      Q = $.mode ?? "form";
    switch (Q) {
      case "url": {
        if (!U?.elicitation?.url) throw Error("Client does not support url elicitation.");
        break;
      }
      case "form": {
        if (!U?.elicitation?.form) throw Error("Client does not support form elicitation.");
        break;
      }
    }
    let W = Q === "form" && $.mode === void 0 ? { ...$, mode: "form" } : $;
    return this.requestStream({ method: "elicitation/create", params: W }, sW, J);
  }
  async getTask($, J) {
    return this._server.getTask({ taskId: $ }, J);
  }
  async getTaskResult($, J, U) {
    return this._server.getTaskResult({ taskId: $ }, J, U);
  }
  async listTasks($, J) {
    return this._server.listTasks($ ? { cursor: $ } : void 0, J);
  }
  async cancelTask($, J) {
    return this._server.cancelTask({ taskId: $ }, J);
  }
}
function QR($, J, U) {
  if (!$) throw Error(`${U} does not support task creation (required for ${J})`);
  switch (J) {
    case "tools/call":
      if (!$.tools?.call) throw Error(`${U} does not support task creation for tools/call (required for ${J})`);
      break;
    default:
      break;
  }
}
function XR($, J, U) {
  if (!$) throw Error(`${U} does not support task creation (required for ${J})`);
  switch (J) {
    case "sampling/createMessage":
      if (!$.sampling?.createMessage)
        throw Error(`${U} does not support task creation for sampling/createMessage (required for ${J})`);
      break;
    case "elicitation/create":
      if (!$.elicitation?.create)
        throw Error(`${U} does not support task creation for elicitation/create (required for ${J})`);
      break;
    default:
      break;
  }
}
class tq extends cF {
  constructor($, J) {
    super(J);
    if (
      ((this._serverInfo = $),
      (this._loggingLevels = new Map()),
      (this.LOG_LEVEL_SEVERITY = new Map(wQ.options.map((U, Q) => [U, Q]))),
      (this.isMessageIgnored = (U, Q) => {
        let W = this._loggingLevels.get(Q);
        return W ? this.LOG_LEVEL_SEVERITY.get(U) < this.LOG_LEVEL_SEVERITY.get(W) : !1;
      }),
      (this._capabilities = J?.capabilities ?? {}),
      (this._instructions = J?.instructions),
      (this._jsonSchemaValidator = J?.jsonSchemaValidator ?? new sq()),
      this.setRequestHandler(ZF, (U) => this._oninitialize(U)),
      this.setNotificationHandler(PF, () => this.oninitialized?.()),
      this._capabilities.logging)
    )
      this.setRequestHandler(bF, async (U, Q) => {
        let W = Q.sessionId || Q.requestInfo?.headers["mcp-session-id"] || void 0,
          { level: X } = U.params,
          Y = wQ.safeParse(X);
        if (Y.success) this._loggingLevels.set(W, Y.data);
        return {};
      });
  }
  get experimental() {
    if (!this._experimental) this._experimental = { tasks: new aq(this) };
    return this._experimental;
  }
  registerCapabilities($) {
    if (this.transport) throw Error("Cannot register capabilities after connecting to transport");
    this._capabilities = IV(this._capabilities, $);
  }
  setRequestHandler($, J) {
    let Q = _8($)?.method;
    if (!Q) throw Error("Schema is missing a method literal");
    let W;
    if (xJ(Q)) {
      let Y = Q;
      W = Y._zod?.def?.value ?? Y.value;
    } else {
      let Y = Q;
      W = Y._def?.value ?? Y.value;
    }
    if (typeof W !== "string") throw Error("Schema method literal must be a string");
    if (W === "tools/call") {
      let Y = async (D, H) => {
        let G = P8(rW, D);
        if (!G.success) {
          let F = G.error instanceof Error ? G.error.message : String(G.error);
          throw new g$(n$.InvalidParams, `Invalid tools/call request: ${F}`);
        }
        let { params: K } = G.data,
          O = await Promise.resolve(J(D, H));
        if (K.task) {
          let F = P8(iW, O);
          if (!F.success) {
            let B = F.error instanceof Error ? F.error.message : String(F.error);
            throw new g$(n$.InvalidParams, `Invalid task creation result: ${B}`);
          }
          return F.data;
        }
        let N = P8(dH, O);
        if (!N.success) {
          let F = N.error instanceof Error ? N.error.message : String(N.error);
          throw new g$(n$.InvalidParams, `Invalid tools/call result: ${F}`);
        }
        return N.data;
      };
      return super.setRequestHandler($, Y);
    }
    return super.setRequestHandler($, J);
  }
  assertCapabilityForMethod($) {
    switch ($) {
      case "sampling/createMessage":
        if (!this._clientCapabilities?.sampling) throw Error(`Client does not support sampling (required for ${$})`);
        break;
      case "elicitation/create":
        if (!this._clientCapabilities?.elicitation)
          throw Error(`Client does not support elicitation (required for ${$})`);
        break;
      case "roots/list":
        if (!this._clientCapabilities?.roots) throw Error(`Client does not support listing roots (required for ${$})`);
        break;
      case "ping":
        break;
    }
  }
  assertNotificationCapability($) {
    switch ($) {
      case "notifications/message":
        if (!this._capabilities.logging) throw Error(`Server does not support logging (required for ${$})`);
        break;
      case "notifications/resources/updated":
      case "notifications/resources/list_changed":
        if (!this._capabilities.resources)
          throw Error(`Server does not support notifying about resources (required for ${$})`);
        break;
      case "notifications/tools/list_changed":
        if (!this._capabilities.tools)
          throw Error(`Server does not support notifying of tool list changes (required for ${$})`);
        break;
      case "notifications/prompts/list_changed":
        if (!this._capabilities.prompts)
          throw Error(`Server does not support notifying of prompt list changes (required for ${$})`);
        break;
      case "notifications/elicitation/complete":
        if (!this._clientCapabilities?.elicitation?.url)
          throw Error(`Client does not support URL elicitation (required for ${$})`);
        break;
      case "notifications/cancelled":
        break;
      case "notifications/progress":
        break;
    }
  }
  assertRequestHandlerCapability($) {
    if (!this._capabilities) return;
    switch ($) {
      case "completion/complete":
        if (!this._capabilities.completions) throw Error(`Server does not support completions (required for ${$})`);
        break;
      case "logging/setLevel":
        if (!this._capabilities.logging) throw Error(`Server does not support logging (required for ${$})`);
        break;
      case "prompts/get":
      case "prompts/list":
        if (!this._capabilities.prompts) throw Error(`Server does not support prompts (required for ${$})`);
        break;
      case "resources/list":
      case "resources/templates/list":
      case "resources/read":
        if (!this._capabilities.resources) throw Error(`Server does not support resources (required for ${$})`);
        break;
      case "tools/call":
      case "tools/list":
        if (!this._capabilities.tools) throw Error(`Server does not support tools (required for ${$})`);
        break;
      case "tasks/get":
      case "tasks/list":
      case "tasks/result":
      case "tasks/cancel":
        if (!this._capabilities.tasks) throw Error(`Server does not support tasks capability (required for ${$})`);
        break;
      case "ping":
      case "initialize":
        break;
    }
  }
  assertTaskCapability($) {
    XR(this._clientCapabilities?.tasks?.requests, $, "Client");
  }
  assertTaskHandlerCapability($) {
    if (!this._capabilities) return;
    QR(this._capabilities.tasks?.requests, $, "Server");
  }
  async _oninitialize($) {
    let J = $.params.protocolVersion;
    return (
      (this._clientCapabilities = $.params.capabilities),
      (this._clientVersion = $.params.clientInfo),
      {
        protocolVersion: kI.includes(J) ? J : VF,
        capabilities: this.getCapabilities(),
        serverInfo: this._serverInfo,
        ...(this._instructions && { instructions: this._instructions }),
      }
    );
  }
  getClientCapabilities() {
    return this._clientCapabilities;
  }
  getClientVersion() {
    return this._clientVersion;
  }
  getCapabilities() {
    return this._capabilities;
  }
  async ping() {
    return this.request({ method: "ping" }, _H);
  }
  async createMessage($, J) {
    if ($.tools || $.toolChoice) {
      if (!this._clientCapabilities?.sampling?.tools) throw Error("Client does not support sampling tools capability.");
    }
    if ($.messages.length > 0) {
      let U = $.messages[$.messages.length - 1],
        Q = Array.isArray(U.content) ? U.content : [U.content],
        W = Q.some((H) => H.type === "tool_result"),
        X = $.messages.length > 1 ? $.messages[$.messages.length - 2] : void 0,
        Y = X ? (Array.isArray(X.content) ? X.content : [X.content]) : [],
        D = Y.some((H) => H.type === "tool_use");
      if (W) {
        if (Q.some((H) => H.type !== "tool_result"))
          throw Error("The last message must contain only tool_result content if any is present");
        if (!D) throw Error("tool_result blocks are not matching any tool_use from the previous message");
      }
      if (D) {
        let H = new Set(Y.filter((K) => K.type === "tool_use").map((K) => K.id)),
          G = new Set(Q.filter((K) => K.type === "tool_result").map((K) => K.toolUseId));
        if (H.size !== G.size || ![...H].every((K) => G.has(K)))
          throw Error("ids of tool_result blocks and tool_use blocks from previous message do not match");
      }
    }
    if ($.tools) return this.request({ method: "sampling/createMessage", params: $ }, fF, J);
    return this.request({ method: "sampling/createMessage", params: $ }, IQ, J);
  }
  async elicitInput($, J) {
    switch ($.mode ?? "form") {
      case "url": {
        if (!this._clientCapabilities?.elicitation?.url) throw Error("Client does not support url elicitation.");
        let Q = $;
        return this.request({ method: "elicitation/create", params: Q }, sW, J);
      }
      case "form": {
        if (!this._clientCapabilities?.elicitation?.form) throw Error("Client does not support form elicitation.");
        let Q = $.mode === "form" ? $ : { ...$, mode: "form" },
          W = await this.request({ method: "elicitation/create", params: Q }, sW, J);
        if (W.action === "accept" && W.content && Q.requestedSchema)
          try {
            let Y = this._jsonSchemaValidator.getValidator(Q.requestedSchema)(W.content);
            if (!Y.valid)
              throw new g$(
                n$.InvalidParams,
                `Elicitation response content does not match requested schema: ${Y.errorMessage}`,
              );
          } catch (X) {
            if (X instanceof g$) throw X;
            throw new g$(
              n$.InternalError,
              `Error validating elicitation response: ${X instanceof Error ? X.message : String(X)}`,
            );
          }
        return W;
      }
    }
  }
  createElicitationCompletionNotifier($, J) {
    if (!this._clientCapabilities?.elicitation?.url)
      throw Error("Client does not support URL elicitation (required for notifications/elicitation/complete)");
    return () => this.notification({ method: "notifications/elicitation/complete", params: { elicitationId: $ } }, J);
  }
  async listRoots($, J) {
    return this.request({ method: "roots/list", params: $ }, yF, J);
  }
  async sendLoggingMessage($, J) {
    if (this._capabilities.logging) {
      if (!this.isMessageIgnored($.level, J)) return this.notification({ method: "notifications/message", params: $ });
    }
  }
  async sendResourceUpdated($) {
    return this.notification({ method: "notifications/resources/updated", params: $ });
  }
  async sendResourceListChanged() {
    return this.notification({ method: "notifications/resources/list_changed" });
  }
  async sendToolListChanged() {
    return this.notification({ method: "notifications/tools/list_changed" });
  }
  async sendPromptListChanged() {
    return this.notification({ method: "notifications/prompts/list_changed" });
  }
}
var DR = Symbol.for("mcp.completable");
function eq($) {
  return !!$ && typeof $ === "object" && DR in $;
}
function HR($) {
  return $[DR]?.complete;
}
var YR;
(function ($) {
  $.Completable = "McpCompletable";
})(YR || (YR = {}));
var $l = /^[A-Za-z0-9._-]{1,128}$/;
function Jl($) {
  let J = [];
  if ($.length === 0) return { isValid: !1, warnings: ["Tool name cannot be empty"] };
  if ($.length > 128)
    return { isValid: !1, warnings: [`Tool name exceeds maximum length of 128 characters (current: ${$.length})`] };
  if ($.includes(" ")) J.push("Tool name contains spaces, which may cause parsing issues");
  if ($.includes(",")) J.push("Tool name contains commas, which may cause parsing issues");
  if ($.startsWith("-") || $.endsWith("-"))
    J.push("Tool name starts or ends with a dash, which may cause parsing issues in some contexts");
  if ($.startsWith(".") || $.endsWith("."))
    J.push("Tool name starts or ends with a dot, which may cause parsing issues in some contexts");
  if (!$l.test($)) {
    let U = $.split("")
      .filter((Q) => !/[A-Za-z0-9._-]/.test(Q))
      .filter((Q, W, X) => X.indexOf(Q) === W);
    return (
      J.push(
        `Tool name contains invalid characters: ${U.map((Q) => `"${Q}"`).join(", ")}`,
        "Allowed characters are: A-Z, a-z, 0-9, underscore (_), dash (-), and dot (.)",
      ),
      { isValid: !1, warnings: J }
    );
  }
  return { isValid: !0, warnings: J };
}
function Ul($, J) {
  if (J.length > 0) {
    console.warn(`Tool name validation warning for "${$}":`);
    for (let U of J) console.warn(`  - ${U}`);
    (console.warn("Tool registration will proceed, but this may cause compatibility issues."),
      console.warn("Consider updating the tool name to conform to the MCP tool naming standard."),
      console.warn(
        "See SEP: Specify Format for Tool Names (https://github.com/modelcontextprotocol/modelcontextprotocol/issues/986) for more details.",
      ));
  }
}
function $z($) {
  let J = Jl($);
  return (Ul($, J.warnings), J.isValid);
}
class Jz {
  constructor($) {
    this._mcpServer = $;
  }
  registerToolTask($, J, U) {
    let Q = { taskSupport: "required", ...J.execution };
    if (Q.taskSupport === "forbidden")
      throw Error(`Cannot register task-based tool '${$}' with taskSupport 'forbidden'. Use registerTool() instead.`);
    return this._mcpServer._createRegisteredTool(
      $,
      J.title,
      J.description,
      J.inputSchema,
      J.outputSchema,
      J.annotations,
      Q,
      J._meta,
      U,
    );
  }
}
class Wz {
  constructor($, J) {
    ((this._registeredResources = {}),
      (this._registeredResourceTemplates = {}),
      (this._registeredTools = {}),
      (this._registeredPrompts = {}),
      (this._toolHandlersInitialized = !1),
      (this._completionHandlerInitialized = !1),
      (this._resourceHandlersInitialized = !1),
      (this._promptHandlersInitialized = !1),
      (this.server = new tq($, J)));
  }
  get experimental() {
    if (!this._experimental) this._experimental = { tasks: new Jz(this) };
    return this._experimental;
  }
  async connect($) {
    return await this.server.connect($);
  }
  async close() {
    await this.server.close();
  }
  setToolRequestHandlers() {
    if (this._toolHandlersInitialized) return;
    (this.server.assertCanSetRequestHandler(h8(pH)),
      this.server.assertCanSetRequestHandler(h8(rW)),
      this.server.registerCapabilities({ tools: { listChanged: !0 } }),
      this.server.setRequestHandler(pH, () => ({
        tools: Object.entries(this._registeredTools)
          .filter(([, $]) => $.enabled)
          .map(([$, J]) => {
            let U = {
              name: $,
              title: J.title,
              description: J.description,
              inputSchema: (() => {
                let Q = yW(J.inputSchema);
                return Q ? mF(Q, { strictUnions: !0, pipeStrategy: "input" }) : Wl;
              })(),
              annotations: J.annotations,
              execution: J.execution,
              _meta: J._meta,
            };
            if (J.outputSchema) {
              let Q = yW(J.outputSchema);
              if (Q) U.outputSchema = mF(Q, { strictUnions: !0, pipeStrategy: "output" });
            }
            return U;
          }),
      })),
      this.server.setRequestHandler(rW, async ($, J) => {
        try {
          let U = this._registeredTools[$.params.name];
          if (!U) throw new g$(n$.InvalidParams, `Tool ${$.params.name} not found`);
          if (!U.enabled) throw new g$(n$.InvalidParams, `Tool ${$.params.name} disabled`);
          let Q = !!$.params.task,
            W = U.execution?.taskSupport,
            X = "createTask" in U.handler;
          if ((W === "required" || W === "optional") && !X)
            throw new g$(
              n$.InternalError,
              `Tool ${$.params.name} has taskSupport '${W}' but was not registered with registerToolTask`,
            );
          if (W === "required" && !Q)
            throw new g$(
              n$.MethodNotFound,
              `Tool ${$.params.name} requires task augmentation (taskSupport: 'required')`,
            );
          if (W === "optional" && !Q && X) return await this.handleAutomaticTaskPolling(U, $, J);
          let Y = await this.validateToolInput(U, $.params.arguments, $.params.name),
            D = await this.executeToolHandler(U, Y, J);
          if (Q) return D;
          return (await this.validateToolOutput(U, D, $.params.name), D);
        } catch (U) {
          if (U instanceof g$) {
            if (U.code === n$.UrlElicitationRequired) throw U;
          }
          return this.createToolError(U instanceof Error ? U.message : String(U));
        }
      }),
      (this._toolHandlersInitialized = !0));
  }
  createToolError($) {
    return { content: [{ type: "text", text: $ }], isError: !0 };
  }
  async validateToolInput($, J, U) {
    if (!$.inputSchema) return;
    let W = yW($.inputSchema) ?? $.inputSchema,
      X = await iD(W, J);
    if (!X.success) {
      let Y = "error" in X ? X.error : "Unknown error",
        D = oD(Y);
      throw new g$(n$.InvalidParams, `Input validation error: Invalid arguments for tool ${U}: ${D}`);
    }
    return X.data;
  }
  async validateToolOutput($, J, U) {
    if (!$.outputSchema) return;
    if (!("content" in J)) return;
    if (J.isError) return;
    if (!J.structuredContent)
      throw new g$(
        n$.InvalidParams,
        `Output validation error: Tool ${U} has an output schema but no structured content was provided`,
      );
    let Q = yW($.outputSchema),
      W = await iD(Q, J.structuredContent);
    if (!W.success) {
      let X = "error" in W ? W.error : "Unknown error",
        Y = oD(X);
      throw new g$(n$.InvalidParams, `Output validation error: Invalid structured content for tool ${U}: ${Y}`);
    }
  }
  async executeToolHandler($, J, U) {
    let Q = $.handler;
    if ("createTask" in Q) {
      if (!U.taskStore) throw Error("No task store provided.");
      let X = { ...U, taskStore: U.taskStore };
      if ($.inputSchema) return await Promise.resolve(Q.createTask(J, X));
      else return await Promise.resolve(Q.createTask(X));
    }
    if ($.inputSchema) return await Promise.resolve(Q(J, U));
    else return await Promise.resolve(Q(U));
  }
  async handleAutomaticTaskPolling($, J, U) {
    if (!U.taskStore) throw Error("No task store provided for task-capable tool.");
    let Q = await this.validateToolInput($, J.params.arguments, J.params.name),
      W = $.handler,
      X = { ...U, taskStore: U.taskStore },
      Y = Q ? await Promise.resolve(W.createTask(Q, X)) : await Promise.resolve(W.createTask(X)),
      D = Y.task.taskId,
      H = Y.task,
      G = H.pollInterval ?? 5000;
    while (H.status !== "completed" && H.status !== "failed" && H.status !== "cancelled") {
      await new Promise((O) => setTimeout(O, G));
      let K = await U.taskStore.getTask(D);
      if (!K) throw new g$(n$.InternalError, `Task ${D} not found during polling`);
      H = K;
    }
    return await U.taskStore.getTaskResult(D);
  }
  setCompletionRequestHandler() {
    if (this._completionHandlerInitialized) return;
    (this.server.assertCanSetRequestHandler(h8(cH)),
      this.server.registerCapabilities({ completions: {} }),
      this.server.setRequestHandler(cH, async ($) => {
        switch ($.params.ref.type) {
          case "ref/prompt":
            return (gI($), this.handlePromptCompletion($, $.params.ref));
          case "ref/resource":
            return (hI($), this.handleResourceCompletion($, $.params.ref));
          default:
            throw new g$(n$.InvalidParams, `Invalid completion reference: ${$.params.ref}`);
        }
      }),
      (this._completionHandlerInitialized = !0));
  }
  async handlePromptCompletion($, J) {
    let U = this._registeredPrompts[J.name];
    if (!U) throw new g$(n$.InvalidParams, `Prompt ${J.name} not found`);
    if (!U.enabled) throw new g$(n$.InvalidParams, `Prompt ${J.name} disabled`);
    if (!U.argsSchema) return cQ;
    let W = _8(U.argsSchema)?.[$.params.argument.name];
    if (!eq(W)) return cQ;
    let X = HR(W);
    if (!X) return cQ;
    let Y = await X($.params.argument.value, $.params.context);
    return KR(Y);
  }
  async handleResourceCompletion($, J) {
    let U = Object.values(this._registeredResourceTemplates).find(
      (X) => X.resourceTemplate.uriTemplate.toString() === J.uri,
    );
    if (!U) {
      if (this._registeredResources[J.uri]) return cQ;
      throw new g$(n$.InvalidParams, `Resource template ${$.params.ref.uri} not found`);
    }
    let Q = U.resourceTemplate.completeCallback($.params.argument.name);
    if (!Q) return cQ;
    let W = await Q($.params.argument.value, $.params.context);
    return KR(W);
  }
  setResourceRequestHandlers() {
    if (this._resourceHandlersInitialized) return;
    (this.server.assertCanSetRequestHandler(h8(gH)),
      this.server.assertCanSetRequestHandler(h8(hH)),
      this.server.assertCanSetRequestHandler(h8(uH)),
      this.server.registerCapabilities({ resources: { listChanged: !0 } }),
      this.server.setRequestHandler(gH, async ($, J) => {
        let U = Object.entries(this._registeredResources)
            .filter(([W, X]) => X.enabled)
            .map(([W, X]) => ({ uri: W, name: X.name, ...X.metadata })),
          Q = [];
        for (let W of Object.values(this._registeredResourceTemplates)) {
          if (!W.resourceTemplate.listCallback) continue;
          let X = await W.resourceTemplate.listCallback(J);
          for (let Y of X.resources) Q.push({ ...W.metadata, ...Y });
        }
        return { resources: [...U, ...Q] };
      }),
      this.server.setRequestHandler(hH, async () => {
        return {
          resourceTemplates: Object.entries(this._registeredResourceTemplates).map(([J, U]) => ({
            name: J,
            uriTemplate: U.resourceTemplate.uriTemplate.toString(),
            ...U.metadata,
          })),
        };
      }),
      this.server.setRequestHandler(uH, async ($, J) => {
        let U = new URL($.params.uri),
          Q = this._registeredResources[U.toString()];
        if (Q) {
          if (!Q.enabled) throw new g$(n$.InvalidParams, `Resource ${U} disabled`);
          return Q.readCallback(U, J);
        }
        for (let W of Object.values(this._registeredResourceTemplates)) {
          let X = W.resourceTemplate.uriTemplate.match(U.toString());
          if (X) return W.readCallback(U, X, J);
        }
        throw new g$(n$.InvalidParams, `Resource ${U} not found`);
      }),
      (this._resourceHandlersInitialized = !0));
  }
  setPromptRequestHandlers() {
    if (this._promptHandlersInitialized) return;
    (this.server.assertCanSetRequestHandler(h8(lH)),
      this.server.assertCanSetRequestHandler(h8(mH)),
      this.server.registerCapabilities({ prompts: { listChanged: !0 } }),
      this.server.setRequestHandler(lH, () => ({
        prompts: Object.entries(this._registeredPrompts)
          .filter(([, $]) => $.enabled)
          .map(([$, J]) => {
            return {
              name: $,
              title: J.title,
              description: J.description,
              arguments: J.argsSchema ? Ql(J.argsSchema) : void 0,
            };
          }),
      })),
      this.server.setRequestHandler(mH, async ($, J) => {
        let U = this._registeredPrompts[$.params.name];
        if (!U) throw new g$(n$.InvalidParams, `Prompt ${$.params.name} not found`);
        if (!U.enabled) throw new g$(n$.InvalidParams, `Prompt ${$.params.name} disabled`);
        if (U.argsSchema) {
          let Q = yW(U.argsSchema),
            W = await iD(Q, $.params.arguments);
          if (!W.success) {
            let D = "error" in W ? W.error : "Unknown error",
              H = oD(D);
            throw new g$(n$.InvalidParams, `Invalid arguments for prompt ${$.params.name}: ${H}`);
          }
          let X = W.data,
            Y = U.callback;
          return await Promise.resolve(Y(X, J));
        } else {
          let Q = U.callback;
          return await Promise.resolve(Q(J));
        }
      }),
      (this._promptHandlersInitialized = !0));
  }
  resource($, J, ...U) {
    let Q;
    if (typeof U[0] === "object") Q = U.shift();
    let W = U[0];
    if (typeof J === "string") {
      if (this._registeredResources[J]) throw Error(`Resource ${J} is already registered`);
      let X = this._createRegisteredResource($, void 0, J, Q, W);
      return (this.setResourceRequestHandlers(), this.sendResourceListChanged(), X);
    } else {
      if (this._registeredResourceTemplates[$]) throw Error(`Resource template ${$} is already registered`);
      let X = this._createRegisteredResourceTemplate($, void 0, J, Q, W);
      return (this.setResourceRequestHandlers(), this.sendResourceListChanged(), X);
    }
  }
  registerResource($, J, U, Q) {
    if (typeof J === "string") {
      if (this._registeredResources[J]) throw Error(`Resource ${J} is already registered`);
      let W = this._createRegisteredResource($, U.title, J, U, Q);
      return (this.setResourceRequestHandlers(), this.sendResourceListChanged(), W);
    } else {
      if (this._registeredResourceTemplates[$]) throw Error(`Resource template ${$} is already registered`);
      let W = this._createRegisteredResourceTemplate($, U.title, J, U, Q);
      return (this.setResourceRequestHandlers(), this.sendResourceListChanged(), W);
    }
  }
  _createRegisteredResource($, J, U, Q, W) {
    let X = {
      name: $,
      title: J,
      metadata: Q,
      readCallback: W,
      enabled: !0,
      disable: () => X.update({ enabled: !1 }),
      enable: () => X.update({ enabled: !0 }),
      remove: () => X.update({ uri: null }),
      update: (Y) => {
        if (typeof Y.uri < "u" && Y.uri !== U) {
          if ((delete this._registeredResources[U], Y.uri)) this._registeredResources[Y.uri] = X;
        }
        if (typeof Y.name < "u") X.name = Y.name;
        if (typeof Y.title < "u") X.title = Y.title;
        if (typeof Y.metadata < "u") X.metadata = Y.metadata;
        if (typeof Y.callback < "u") X.readCallback = Y.callback;
        if (typeof Y.enabled < "u") X.enabled = Y.enabled;
        this.sendResourceListChanged();
      },
    };
    return ((this._registeredResources[U] = X), X);
  }
  _createRegisteredResourceTemplate($, J, U, Q, W) {
    let X = {
      resourceTemplate: U,
      title: J,
      metadata: Q,
      readCallback: W,
      enabled: !0,
      disable: () => X.update({ enabled: !1 }),
      enable: () => X.update({ enabled: !0 }),
      remove: () => X.update({ name: null }),
      update: (H) => {
        if (typeof H.name < "u" && H.name !== $) {
          if ((delete this._registeredResourceTemplates[$], H.name)) this._registeredResourceTemplates[H.name] = X;
        }
        if (typeof H.title < "u") X.title = H.title;
        if (typeof H.template < "u") X.resourceTemplate = H.template;
        if (typeof H.metadata < "u") X.metadata = H.metadata;
        if (typeof H.callback < "u") X.readCallback = H.callback;
        if (typeof H.enabled < "u") X.enabled = H.enabled;
        this.sendResourceListChanged();
      },
    };
    this._registeredResourceTemplates[$] = X;
    let Y = U.uriTemplate.variableNames;
    if (Array.isArray(Y) && Y.some((H) => !!U.completeCallback(H))) this.setCompletionRequestHandler();
    return X;
  }
  _createRegisteredPrompt($, J, U, Q, W) {
    let X = {
      title: J,
      description: U,
      argsSchema: Q === void 0 ? void 0 : k9(Q),
      callback: W,
      enabled: !0,
      disable: () => X.update({ enabled: !1 }),
      enable: () => X.update({ enabled: !0 }),
      remove: () => X.update({ name: null }),
      update: (Y) => {
        if (typeof Y.name < "u" && Y.name !== $) {
          if ((delete this._registeredPrompts[$], Y.name)) this._registeredPrompts[Y.name] = X;
        }
        if (typeof Y.title < "u") X.title = Y.title;
        if (typeof Y.description < "u") X.description = Y.description;
        if (typeof Y.argsSchema < "u") X.argsSchema = k9(Y.argsSchema);
        if (typeof Y.callback < "u") X.callback = Y.callback;
        if (typeof Y.enabled < "u") X.enabled = Y.enabled;
        this.sendPromptListChanged();
      },
    };
    if (((this._registeredPrompts[$] = X), Q)) {
      if (
        Object.values(Q).some((D) => {
          let H = D instanceof cW ? D._def?.innerType : D;
          return eq(H);
        })
      )
        this.setCompletionRequestHandler();
    }
    return X;
  }
  _createRegisteredTool($, J, U, Q, W, X, Y, D, H) {
    $z($);
    let G = {
      title: J,
      description: U,
      inputSchema: GR(Q),
      outputSchema: GR(W),
      annotations: X,
      execution: Y,
      _meta: D,
      handler: H,
      enabled: !0,
      disable: () => G.update({ enabled: !1 }),
      enable: () => G.update({ enabled: !0 }),
      remove: () => G.update({ name: null }),
      update: (K) => {
        if (typeof K.name < "u" && K.name !== $) {
          if (typeof K.name === "string") $z(K.name);
          if ((delete this._registeredTools[$], K.name)) this._registeredTools[K.name] = G;
        }
        if (typeof K.title < "u") G.title = K.title;
        if (typeof K.description < "u") G.description = K.description;
        if (typeof K.paramsSchema < "u") G.inputSchema = k9(K.paramsSchema);
        if (typeof K.outputSchema < "u") G.outputSchema = k9(K.outputSchema);
        if (typeof K.callback < "u") G.handler = K.callback;
        if (typeof K.annotations < "u") G.annotations = K.annotations;
        if (typeof K._meta < "u") G._meta = K._meta;
        if (typeof K.enabled < "u") G.enabled = K.enabled;
        this.sendToolListChanged();
      },
    };
    return ((this._registeredTools[$] = G), this.setToolRequestHandlers(), this.sendToolListChanged(), G);
  }
  tool($, ...J) {
    if (this._registeredTools[$]) throw Error(`Tool ${$} is already registered`);
    let U, Q, W, X;
    if (typeof J[0] === "string") U = J.shift();
    if (J.length > 1) {
      let D = J[0];
      if (Uz(D)) {
        if (((Q = J.shift()), J.length > 1 && typeof J[0] === "object" && J[0] !== null && !Uz(J[0]))) X = J.shift();
      } else if (typeof D === "object" && D !== null) {
        if (Object.values(D).some((H) => typeof H === "object" && H !== null))
          throw Error(`Tool ${$} expected a Zod schema or ToolAnnotations, but received an unrecognized object`);
        X = J.shift();
      }
    }
    let Y = J[0];
    return this._createRegisteredTool($, void 0, U, Q, W, X, { taskSupport: "forbidden" }, void 0, Y);
  }
  registerTool($, J, U) {
    if (this._registeredTools[$]) throw Error(`Tool ${$} is already registered`);
    let { title: Q, description: W, inputSchema: X, outputSchema: Y, annotations: D, _meta: H } = J;
    return this._createRegisteredTool($, Q, W, X, Y, D, { taskSupport: "forbidden" }, H, U);
  }
  prompt($, ...J) {
    if (this._registeredPrompts[$]) throw Error(`Prompt ${$} is already registered`);
    let U;
    if (typeof J[0] === "string") U = J.shift();
    let Q;
    if (J.length > 1) Q = J.shift();
    let W = J[0],
      X = this._createRegisteredPrompt($, void 0, U, Q, W);
    return (this.setPromptRequestHandlers(), this.sendPromptListChanged(), X);
  }
  registerPrompt($, J, U) {
    if (this._registeredPrompts[$]) throw Error(`Prompt ${$} is already registered`);
    let { title: Q, description: W, argsSchema: X } = J,
      Y = this._createRegisteredPrompt($, Q, W, X, U);
    return (this.setPromptRequestHandlers(), this.sendPromptListChanged(), Y);
  }
  isConnected() {
    return this.server.transport !== void 0;
  }
  async sendLoggingMessage($, J) {
    return this.server.sendLoggingMessage($, J);
  }
  sendResourceListChanged() {
    if (this.isConnected()) this.server.sendResourceListChanged();
  }
  sendToolListChanged() {
    if (this.isConnected()) this.server.sendToolListChanged();
  }
  sendPromptListChanged() {
    if (this.isConnected()) this.server.sendPromptListChanged();
  }
}
var Wl = { type: "object", properties: {} };
function NR($) {
  return (
    $ !== null &&
    typeof $ === "object" &&
    "parse" in $ &&
    typeof $.parse === "function" &&
    "safeParse" in $ &&
    typeof $.safeParse === "function"
  );
}
function OR($) {
  return "_def" in $ || "_zod" in $ || NR($);
}
function Uz($) {
  if (typeof $ !== "object" || $ === null) return !1;
  if (OR($)) return !1;
  if (Object.keys($).length === 0) return !0;
  return Object.values($).some(NR);
}
function GR($) {
  if (!$) return;
  if (Uz($)) return k9($);
  if (!OR($)) throw Error("inputSchema must be a Zod schema or raw shape, received an unrecognized object");
  return $;
}
function Ql($) {
  let J = _8($);
  if (!J) return [];
  return Object.entries(J).map(([U, Q]) => {
    let W = Dw(Q),
      X = Hw(Q);
    return { name: U, description: W, required: !X };
  });
}
function h8($) {
  let U = _8($)?.method;
  if (!U) throw Error("Schema is missing a method literal");
  let Q = rD(U);
  if (typeof Q === "string") return Q;
  throw Error("Schema method literal must be a string");
}
function KR($) {
  return { completion: { values: $.slice(0, 100), total: $.length, hasMore: $.length > 100 } };
}
var cQ = { completion: { values: [], hasMore: !1 } };
import qR from "process";
class Qz {
  append($) {
    this._buffer = this._buffer ? Buffer.concat([this._buffer, $]) : $;
  }
  readMessage() {
    if (!this._buffer) return null;
    let $ = this._buffer.indexOf(`
`);
    if ($ === -1) return null;
    let J = this._buffer.toString("utf8", 0, $).replace(/\r$/, "");
    return ((this._buffer = this._buffer.subarray($ + 1)), Xl(J));
  }
  clear() {
    this._buffer = void 0;
  }
}
function Xl($) {
  return CI.parse(JSON.parse($));
}
function FR($) {
  return (
    JSON.stringify($) +
    `
`
  );
}
class Xz {
  constructor($ = qR.stdin, J = qR.stdout) {
    ((this._stdin = $),
      (this._stdout = J),
      (this._readBuffer = new Qz()),
      (this._started = !1),
      (this._ondata = (U) => {
        (this._readBuffer.append(U), this.processReadBuffer());
      }),
      (this._onerror = (U) => {
        this.onerror?.(U);
      }));
  }
  async start() {
    if (this._started)
      throw Error(
        "StdioServerTransport already started! If using Server class, note that connect() calls start() automatically.",
      );
    ((this._started = !0), this._stdin.on("data", this._ondata), this._stdin.on("error", this._onerror));