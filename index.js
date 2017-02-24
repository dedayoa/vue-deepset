'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var _ = _interopDefault(require('lodash/lodash.min'));
var Vue = _interopDefault(require('vue'));

/*
 * @author Branden Horiuchi <bhoriuchi@gmail.com>
 * @description Deep set Vue.js objects
 */
var INVALID_KEY_RX = /^\d|[^a-zA-Z0-9_]/gm;

/**
 * returns true if object is non empty object
 * @param obj
 * @returns {boolean|*}
 */
function isHash(obj) {
  return _.isObject(obj) && !_.isArray(obj) && !_.isDate(obj) && !_.isEmpty(obj);
}

/**
 * generates an array of paths to use when creating an abstracted object
 * @param obj
 * @param current
 * @param paths
 * @returns {Array|*}
 */
function getPaths(obj) {
  var current = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  var paths = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];

  if (isHash(obj)) {
    _.forEach(obj, function (val, key) {
      var k = key.match(INVALID_KEY_RX) ? '["' + key + '"]' : '.' + key;
      var cur = ('' + current + k).replace(/^\./, '');
      paths.push(cur);
      if (isHash(val)) getPaths(val, cur, paths);
    });
  }
  return _.uniq(paths);
}

/**
 * converts a path string to one usable by deepModel
 * @param path
 * @returns {*}
 */
function sanitizePath(path) {
  if (!_.isString(path)) throw new Error('VueDeepSet: invalid path, must be string');

  return _.reduce(_.toPath(path), function (pathString, part) {
    var partStr = part.match(INVALID_KEY_RX) ? '["' + part + '"]' : '' + (pathString === '' ? '' : '.') + part;
    return pathString + partStr;
  }, '');
}

/**
 * deep sets a Vue.js object creating reactive properties if they do not exist
 * @param obj
 * @param path
 * @param value
 */
function vueSet(obj, path, value) {
  var fields = _.isArray(path) ? path : _.toPath(path);

  for (var i = 0; i < fields.length; i++) {
    var prop = fields[i];
    if (i === fields.length - 1) Vue.set(obj, prop, value);else if (!_.has(obj, prop)) Vue.set(obj, prop, _.isNumber(prop) ? [] : {});
    obj = obj[prop];
  }
}

/**
 * deep sets a vuex object creating reactive properties if they do not exist
 * @param path
 * @param value
 */
function vuexSet(path, value) {
  var store = _.get(this, '$store');
  if (!store) throw new Error('VueDeepSet: could not find vuex store object on instance');
  store[store.commit ? 'commit' : 'dispatch']('VUEX_DEEP_SET', { path: path, value: value });
}

/**
 * vuex mutation to set an objects value at a specific path
 * @param state
 * @param args
 */
function VUEX_DEEP_SET(state, args) {
  vueSet(state, args.path, args.value);
}

/**
 * helper function to extend a mutation object
 * @param mutations
 * @returns {*}
 */
function extendMutation() {
  var mutations = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

  return Object.assign(mutations, { VUEX_DEEP_SET: VUEX_DEEP_SET });
}

/**
 * returns an object that can deep set fields in a vuex store
 * @param vuexPath
 * @returns {{}}
 */
function vuexModel(vuexPath) {
  var _this = this;

  if (!_.isString(vuexPath)) throw new Error('VueDeepSet: invalid vuex path string');
  var model = {};
  var obj = _.get(this.$store.state, vuexPath);
  _.forEach(getPaths(obj), function (path) {
    var connector = path.match(/^\[/) ? '' : '.';
    var propPath = '' + vuexPath + connector + path;
    Object.defineProperty(model, path, {
      configurable: true,
      enumerable: true,
      get: function get() {
        return _.get(_this.$store.state, propPath);
      },
      set: function set(value) {
        vuexSet.call(_this, propPath, value);
      }
    });
  });
  return model;
}

/**
 * returns an object that can deep set fields in a vue.js object
 * @param obj
 * @returns {Array}
 */
function vueModel(obj) {
  var _this2 = this;

  if (!_.isObject(obj)) throw new Error('VueDeepSet: invalid object');
  var model = {};
  _.forEach(getPaths(obj), function (path) {
    Object.defineProperty(model, path, {
      configurable: true,
      enumerable: true,
      get: function get() {
        return _.get(obj, path);
      },
      set: function set(value) {
        vueSet.call(_this2, obj, path, value);
      }
    });
  });
  return model;
}

/**
 * creates a vuex model if the arg is a string, vue model otherwise
 * @param arg
 * @returns {{}}
 */
function deepModel(arg) {
  return _.isString(arg) ? vuexModel.call(this, arg) : vueModel.call(this, arg);
}

/**
 * plugin
 * @param Vue
 */
function install(Vue$$1) {
  Vue$$1.prototype.$deepModel = deepModel;
  Vue$$1.prototype.$vueSet = vueSet;
  Vue$$1.prototype.$vuexSet = vuexSet;
}

exports.sanitizePath = sanitizePath;
exports.vueSet = vueSet;
exports.vuexSet = vuexSet;
exports.VUEX_DEEP_SET = VUEX_DEEP_SET;
exports.extendMutation = extendMutation;
exports.vuexModel = vuexModel;
exports.vueModel = vueModel;
exports.deepModel = deepModel;
exports.install = install;