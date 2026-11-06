export function isDebug(debug) {
    return debug || !!(typeof window !== 'undefined' && window.__devfab && window.__devfab.debug)
}

export const isEmpty = (value) => value === undefined || value === null || value === ''
export const isEmptyObject = (value) => !value || Object.keys(value).length === 0

function QueryString(_url) {
    this.pathname = ''
    this.query = {}
    let url = _url

    this.init = function () {
        if (!url) {
            url = location.search
        }
        const index1 = url.indexOf('?')
        const index2 = url.indexOf('#')
        if (index1 >= 0) {
            this.pathname = url.substr(0, index1)
            url = index2 < 0 ? url.substr(index1 + 1) : url.substring(index1 + 1, index2)
            if (url.length > 0) {
                url = url.replace(/\+/g, ' ')
                const params = url.split('&')
                for (let i = 0, len = params.length; i < len; i++) {
                    const param = params[i] || ''
                    if (param) {
                        const index = param.indexOf('=')
                        let key = ''
                        let value = ''
                        if (index < 0) {
                            key = window.decode(param)
                            value = key
                        } else {
                            key = window.decode(param.substr(0, index))
                            value = window.decode(param.substr(index + 1))
                        }
                        this.query[key] = value
                    }
                }
            }
        } else {
            this.pathname = url
        }
    }

    this.set = function (key, value) {
        this.query[key] = value
    }

    this.get = function (key) {
        return this.query[key]
    }

    this.del = function (key) {
        delete this.query[key]
    }

    this.has = function (key) {
        return this.query[key] != null
    }

    this.toStr = function () {
        const items = ['?']
        for (const key in this.query) {
            items.push(encodeURIComponent(key))
            items.push('=')
            items.push(encodeURIComponent(this.query[key]))
            items.push('&')
        }
        if (items.length === 1) {
            return ''
        }
        items.splice(items.length - 1, 1)
        return items.join('')
    }

    this.init()
}
export function equalsIgnoreCase(str1, str2) {
    if (!str1 || !str2) {
        return false
    }
    return str1.toLowerCase() === str2.toLowerCase()
}
export function _appendUrl(restUrl, params) {
    if (!params) {
        return restUrl
    }
    const queryStr = []
    const queryUrl = new QueryString(restUrl)
    for (const attr in params) {
        if (queryUrl.get(attr)) {
            continue
        }
        queryStr.push(`${attr}=${params[attr]}`)
    }
    if (!queryStr.length) {
        return restUrl
    }
    const queryString = queryStr.join('&')
    return restUrl.indexOf('?') >= 0 ? `${restUrl}&${queryString}` : `${restUrl}?${queryString}`
}

/**
 * 依据编码和名称生成uid
 * @param {*} code
 * @param {*} name
 * @returns
 */
export async function generateUID(code, name) {
    const data = { code, name }
    const stringData = JSON.stringify(data)
    const uint8 = new TextEncoder().encode(stringData)
    const hashBuffer = await crypto.subtle.digest('SHA-256', uint8)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    return hashHex
}

export const base64 = {
    // 加密
    encode: (str) => {
        return window.btoa(str)
    },
    // 解密
    decode: (str) => {
        return window.atob(str)
    },
}

const hasValue = (value) => value !== undefined && value !== null && value !== ''

/**
 * 按「规范名 → 别名列表」取一个字段。
 *
 *   const TABLE_FIELDS = { height: ['height', 'cHeight'] }
 *   pick(props, 'height', TABLE_FIELDS)   // → props.height ?? props.cHeight
 *
 * `spec` 里没写这个规范名时，直接按规范名取（`pick(col, 'field')`）。
 * 规范名自己也要列在别名数组里 —— 这样「已写规范名的对象」优先命中，别名兜底。
 */
export function pick(source, name, _spec) {
    if (!source) {
        return undefined
    }
    let spec = _spec
    if (typeof name === 'string' && Array.isArray(spec)) {
        spec = { [name]: _spec }
    }
    const keys = spec && spec[name]
    if (!keys) {
        return hasValue(source[name]) ? source[name] : undefined
    }
    for (let i = 0; i < keys.length; i++) {
        const value = source[keys[i]]
        if (hasValue(value)) {
            return value
        }
    }
    return undefined
}

export function formatDate(_date, _pattern) {
    let date = _date
    if (!date) {
        return ''
    }
    if (!(date instanceof Date)) {
        date = new Date(date)
    }
    if (isNaN(date.getTime())) {
        return ''
    }

    const pattern = _pattern || 'YYYY-MM-DD HH:mm:ss.SSS'

    var map = {
        YYYY: date.getFullYear(),
        MM: `0${date.getMonth() + 1}`.slice(-2),
        DD: `0${date.getDate()}`.slice(-2),
        HH: `0${date.getHours()}`.slice(-2),
        mm: `0${date.getMinutes()}`.slice(-2),
        ss: `0${date.getSeconds()}`.slice(-2),
        SSS: `00${date.getMilliseconds()}`.slice(-3),
    }

    return pattern.replace(/YYYY|MM|DD|HH|mm|ss|SSS/g, (key) => {
        return map[key]
    })
}
