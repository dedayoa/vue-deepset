'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.vueSet = vueSet;
exports.vuexSet = vuexSet;
exports.VUEX_DEEP_SET = VUEX_DEEP_SET;
exports.extendMutation = extendMutation;
exports.vueModel = vueModel;
exports.vuexModel = vuexModel;
exports.deepModel = deepModel;
exports.install = install;

var _vue = require('vue');

var _vue2 = _interopRequireDefault(_vue);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var invalidKey = /^\d|[^a-zA-Z0-9_]/gm;
var intKey = /^\d+$/;
var charCodeOfDot = '.'.charCodeAt(0);
var reEscapeChar = /\\(\\)?/g;
var rePropName = RegExp(
// Match anything that isn't a dot or bracket.
'[^.[\\]]+' + '|' +
// Or match property names within brackets.
'\\[(?:' +
// Match a non-string expression.
'([^"\'].*)' + '|' +
// Or match strings (supports escaping characters).
'(["\'])((?:(?!\\2)[^\\\\]|\\\\.)*?)\\2' + ')\\]' + '|' +
// Or match "" as the space between consecutive dots or empty brackets.
'(?=(?:\\.|\\[\\])(?:\\.|\\[\\]|$))', 'g');

// modified from lodash
function toPath(string) {
  var result = [];
  if (string.charCodeAt(0) === charCodeOfDot) {
    result.push('');
  }
  string.replace(rePropName, function (match, expression, quote, subString) {
    var key = match;
    if (quote) {
      key = subString.replace(reEscapeChar, '$1');
    } else if (expression) {
      key = expression.trim();
    }
    result.push(key);
  });
  return result;
}

function noop() {}

function isObjectLike(object) {
  return (typeof object === 'undefined' ? 'undefined' : _typeof(object)) === 'object' && object !== null;
}

function pathJoin(base, path) {
  try {
    var connector = path.match(/^\[/) ? '' : '.';
    return '' + (base || '') + (base ? connector : '') + path;
  } catch (error) {
    return '';
  }
}

function pushPaths(object, current, paths) {
  paths.push(current);
  if (isObjectLike(object)) {
    getPaths(object, current, paths);
  }
}

function forEach(object, iteratee) {
  var isArray = Array.isArray(object);
  var keys = isArray ? object : Object.keys(object);
  keys.forEach(function (value, index) {
    return isArray ? iteratee(value, index) : iteratee(object[value], value);
  });
}

function has(object, path) {
  var obj = object;
  var parts = toPath(path);
  while (parts.length) {
    var key = parts.shift();
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      if (!parts.length) {
        return true;
      }
      obj = obj[key];
    }
  }
  return false;
}

function getPaths(object) {
  var current = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  var paths = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];

  if (Array.isArray(object)) {
    forEach(object, function (val, idx) {
      pushPaths(val, (current + '.' + idx).replace(/^\./, ''), paths);
      pushPaths(val, (current + '[' + idx + ']').replace(/^\./, ''), paths);
      pushPaths(val, (current + '["' + idx + '"]').replace(/^\./, ''), paths);
    });
  } else if (isObjectLike(object)) {
    forEach(object, function (val, key) {
      if (key.match(intKey) !== null) {
        // is index
        pushPaths(val, (current + '.' + key).replace(/^\./, ''), paths);
        pushPaths(val, (current + '[' + key + ']').replace(/^\./, ''), paths);
        pushPaths(val, (current + '["' + key + '"]').replace(/^\./, ''), paths);
      } else if (key.match(invalidKey) !== null) {
        // must quote
        pushPaths(val, (current + '["' + key + '"]').replace(/^\./, ''), paths);
      } else {
        pushPaths(val, (current + '.' + key).replace(/^\./, ''), paths);
      }
    });
  }
  return [].concat(new Set(paths));
}

function _get(obj, path, defaultValue) {
  try {
    var o = obj;
    var fields = Array.isArray(path) ? path : toPath(path);
    while (fields.length) {
      var prop = fields.shift();
      o = o[prop];
      if (!fields.length) {
        return o;
      }
    }
  } catch (err) {
    return defaultValue;
  }
  return defaultValue;
}

function hasOwnProperty(object, property) {
  return Object.prototype.hasOwnProperty.call(object, property);
}

function getProp(object, property) {
  return Object.keys(object).indexOf(property) === -1 ? _get(object, property) : object[property];
}

function getProxy(vm, base, options) {
  noop(options); // for future potential options
  var isVuex = typeof base === 'string';
  var object = isVuex ? _get(vm.$store.state, base) : base;

  return new Proxy(object, {
    get: function get(target, property) {
      return getProp(target, property);
    },
    set: function set(target, property, value) {
      isVuex ? vuexSet.call(vm, pathJoin(base, property), value) : vueSet(target, property, value);
      return true;
    },
    deleteProperty: function deleteProperty() {
      return true;
    },
    enumerate: function enumerate(target) {
      return Object.keys(target);
    },
    ownKeys: function ownKeys(target) {
      return Object.keys(target);
    },
    has: function has(target, property) {
      return true;
    },
    defineProperty: function defineProperty(target) {
      return target;
    },
    getOwnPropertyDescriptor: function getOwnPropertyDescriptor(target, property) {
      return {
        value: getProp(target, property),
        writable: false,
        enumerable: true,
        configurable: true
      };
    }
  });
}

function buildVueModel(vm, object, options) {
  var model = {};
  forEach(getPaths(object), function (path) {
    Object.defineProperty(model, path, {
      configurable: true,
      enumerable: true,
      get: function get() {
        return _get(object, path);
      },
      set: function set(value) {
        return vueSet(object, path, value);
      }
    });
  });
  return model;
}

function buildVuexModel(vm, vuexPath, options) {
  var model = Object.create(null);
  var object = _get(vm.$store.state, vuexPath);
  var paths = getPaths(object);
  forEach(paths, function (path) {
    var propPath = pathJoin(vuexPath, path);
    Object.defineProperty(model, path, {
      configurable: true,
      enumerable: true,
      get: function get() {
        return _get(vm.$store.state, propPath);
      },
      set: function set(value) {
        return vuexSet.call(vm, propPath, value);
      }
    });
  });
  return model;
}

function vueSet(object, path, value) {
  var parts = toPath(path);
  var obj = object;
  while (parts.length) {
    var key = parts.shift();
    if (!parts.length) {
      _vue2.default.set(obj, key, value);
    } else if (!hasOwnProperty(obj, key) || obj[key] === null) {
      _vue2.default.set(obj, key, typeof key === 'number' ? [] : {});
    }
    obj = obj[key];
  }
}

function vuexSet(path, value) {
  if (!this.$store) throw new Error('[vue-deepset]: could not find vuex store object on instance');
  this.$store[this.$store.commit ? 'commit' : 'dispatch']('VUEX_DEEP_SET', { path: path, value: value });
}

function VUEX_DEEP_SET(state, _ref) {
  var path = _ref.path,
      value = _ref.value;

  vueSet(state, path, value);
}

function extendMutation() {
  var mutations = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  return Object.assign(mutations, { VUEX_DEEP_SET: VUEX_DEEP_SET });
}

function vueModel(object, options) {
  var opts = Object.assign({}, options);
  if (!isObjectLike(object)) {
    throw new Error('[vue-deepset]: invalid object specified for vue model');
  } else if (opts.useProxy === false || typeof Proxy === 'undefined') {
    return buildVueModel(this, object, opts);
  }
  return getProxy(this, object, opts);
}

function vuexModel(vuexPath, options) {
  var opts = Object.assign({}, options);
  if (typeof vuexPath !== 'string' || vuexPath === '') {
    throw new Error('[vue-deepset]: invalid vuex path string');
  } else if (!has(this.$store.state, vuexPath)) {
    throw new Error('[vue-deepset]: Cannot find path "' + vuexPath + '" in Vuex store');
  } else if (opts.useProxy === false || typeof Proxy === 'undefined') {
    return buildVuexModel(this, vuexPath, opts);
  }
  return getProxy(this, vuexPath, opts);
}

function deepModel(base, options) {
  return typeof base === 'string' ? vuexModel.call(this, base, options) : vueModel.call(this, base, options);
}

function install(VueInstance) {
  VueInstance.prototype.$vueModel = vueModel;
  VueInstance.prototype.$vuexModel = vuexModel;
  VueInstance.prototype.$deepModel = deepModel;
  VueInstance.prototype.$vueSet = vueSet;
}
