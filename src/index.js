import Vue from 'vue'

const invalidKey = /^\d|[^a-zA-Z0-9_]/gm
const intKey = /^\d+$/
const charCodeOfDot = '.'.charCodeAt(0)
const reEscapeChar = /\\(\\)?/g
const rePropName = RegExp(
  // Match anything that isn't a dot or bracket.
  '[^.[\\]]+' + '|' +
  // Or match property names within brackets.
  '\\[(?:' +
  // Match a non-string expression.
  '([^"\'].*)' + '|' +
  // Or match strings (supports escaping characters).
  '(["\'])((?:(?!\\2)[^\\\\]|\\\\.)*?)\\2' +
  ')\\]' + '|' +
  // Or match "" as the space between consecutive dots or empty brackets.
  '(?=(?:\\.|\\[\\])(?:\\.|\\[\\]|$))'
  , 'g')

// modified from lodash - https://github.com/lodash/lodash
function toPath (string) {
  if (Array.isArray(string)) {
    return string
  }
  const result = []
  if (string.charCodeAt(0) === charCodeOfDot) {
    result.push('')
  }
  string.replace(rePropName, (match, expression, quote, subString) => {
    let key = match
    if (quote) {
      key = subString.replace(reEscapeChar, '$1')
    } else if (expression) {
      key = expression.trim()
    }
    result.push(key)
  })
  return result
}

function noop () {}

function hasOwnProperty (object, property) {
  return Object.prototype.hasOwnProperty.call(object, property)
}

function deepsetError (message) {
  return new Error(`[vue-deepset]: ${message}`);
}

function isObjectLike (object) {
  return typeof object === 'object' && object !== null
}

function pathJoin (base, path) {
  try {
    const connector = path.match(/^\[/) ? '' : '.'
    return `${base || ''}${base ? connector : ''}${path}`
  } catch (error) {
    return ''
  }
}

function pushPaths (object, current, paths) {
  paths.push(current)
  if (isObjectLike(object)) {
    getPaths(object, current, paths)
  }
}

function forEach (object, iteratee) {
  const isArray = Array.isArray(object)
  const keys = isArray ? object : Object.keys(object)
  keys.forEach((value, index) => {
    return isArray
      ? iteratee(value, index)
      : iteratee(object[value], value)
  })
}

function has (object, path) {
  let obj = object
  const parts = toPath(path)
  while (parts.length) {
    const key = parts.shift()
    if (!hasOwnProperty(obj, key)) {
      return false
    } else if (!parts.length) {
      return true
    }
    obj = obj[key]
  }
  return false
}

function getPaths (object, current = '', paths = []) {
  if (Array.isArray(object)) {
    forEach(object, (val, idx) => {
      pushPaths(val, `${current}.${idx}`.replace(/^\./, ''), paths)
      pushPaths(val, `${current}[${idx}]`.replace(/^\./, ''), paths)
      pushPaths(val, `${current}["${idx}"]`.replace(/^\./, ''), paths)
    })
  } else if (isObjectLike(object)) {
    forEach(object, (val, key) => {
      if (key.match(intKey) !== null) { // is index
        pushPaths(val, `${current}.${key}`.replace(/^\./, ''), paths)
        pushPaths(val, `${current}[${key}]`.replace(/^\./, ''), paths)
        pushPaths(val, `${current}["${key}"]`.replace(/^\./, ''), paths)
      } else if (!key.match(invalidKey)) {
        pushPaths(val, `${current}.${key}`.replace(/^\./, ''), paths)
      }
      // always add the absolute array notation path
      pushPaths(val, `${current}["${key}"]`.replace(/^\./, ''), paths)
    })
  }
  return [ ...new Set(paths) ]
}

function get (obj, path, defaultValue) {
  try {
    let o = obj
    const fields = Array.isArray(path) ? path : toPath(path)
    while (fields.length) {
      const prop = fields.shift()
      o = o[prop]
      if (!fields.length) {
        return o
      }
    }
  } catch (err) {
    return defaultValue
  }
  return defaultValue
}

function getProxy (vm, base, options) {
  noop(options) // for future potential options
  const isVuex = typeof base === 'string'
  const object = isVuex ? get(vm.$store.state, base) : base

  return new Proxy(object, {
    get: (target, property) => {
      return get(target, property)
    },
    set: (target, property, value) => {
      isVuex
        ? vuexSet.call(vm, pathJoin(base, property), value)
        : vueSet(target, property, value)
      return true
    },
    deleteProperty: () => {
      return true
    },
    enumerate: target => {
      return Object.keys(target)
    },
    ownKeys: target => {
      return Object.keys(target)
    },
    has: (target, property) => {
      return true
    },
    defineProperty: target => {
      return target
    },
    getOwnPropertyDescriptor: (target, property) => {
      return {
        value: get(target, property),
        writable: false,
        enumerable: true,
        configurable: true
      }
    }
  })
}

function buildVueModel (vm, object, options) {
  const model = {}
  forEach(getPaths(object), path => {
    Object.defineProperty(model, path, {
      configurable: true,
      enumerable: true,
      get: () => get(object, path),
      set: value => vueSet(object, path, value)
    })
  })
  return model
}

function buildVuexModel (vm, vuexPath, options) {
  const model = Object.create(null)
  const object = get(vm.$store.state, vuexPath)
  const paths = getPaths(object)
  forEach(paths, path => {
    const propPath = pathJoin(vuexPath, path)
    Object.defineProperty(model, path, {
      configurable: true,
      enumerable: true,
      get: () => get(vm.$store.state, propPath),
      set: (value) => vuexSet.call(vm, propPath, value)
    })
  })
  return model
}

export function vueSet (object, path, value) {
  try {
    const parts = toPath(path)
    let obj = object
    while (parts.length) {
      const key = parts.shift()
      if (!parts.length) {
        Vue.set(obj, key, value)
      } else if (!hasOwnProperty(obj, key) || obj[key] === null) {
        Vue.set(obj, key, typeof key === 'number' ? [] : {})
      }
      obj = obj[key]
    }
    return object
  } catch (err) {
    throw deepsetError(`vueSet unable to set object (${err.message})`)
  }
}

export function vuexSet (path, value) {
  if (!isObjectLike(this.$store)) {
    throw deepsetError('could not find vuex store object on instance')
  }
  const method = this.$store.commit ? 'commit' : 'dispatch'
  this.$store[method]('VUEX_DEEP_SET', { path, value })
}

export function VUEX_DEEP_SET (state, { path, value }) {
  vueSet(state, path, value)
}

export function extendMutation (mutations = {}) {
  return Object.assign(mutations, { VUEX_DEEP_SET })
}

export function vueModel (object, options) {
  const opts = Object.assign({}, options)
  if (!isObjectLike(object)) {
    throw deepsetError('invalid object specified for vue model')
  } else if (opts.useProxy === false || typeof Proxy === 'undefined') {
    return buildVueModel(this, object, opts)
  }
  return getProxy(this, object, opts)
}

export function vuexModel (vuexPath, options) {
  const opts = Object.assign({}, options)
  if (typeof vuexPath !== 'string' || vuexPath === '') {
    throw deepsetError('invalid vuex path string')
  } else if (!isObjectLike(this.$store) || !isObjectLike(this.$store.state)) {
    throw deepsetError('no vuex state found')
  } else if (!has(this.$store.state, vuexPath)) {
    throw deepsetError(`cannot find path "${vuexPath}" in Vuex store`)
  } else if (opts.useProxy === false || typeof Proxy === 'undefined') {
    return buildVuexModel(this, vuexPath, opts)
  }
  return getProxy(this, vuexPath, opts)
}

export function deepModel (base, options) {
  return typeof base === 'string'
    ? vuexModel.call(this, base, options)
    : vueModel.call(this, base, options)
}

export function install (VueInstance) {
  VueInstance.prototype.$deepModel = deepModel
  VueInstance.prototype.$vueSet = vueSet
  VueInstance.prototype.$vuexSet = vuexSet
}
