import { _appendUrl, isDebug, equalsIgnoreCase } from './string'

function _getUrl(_url, params) {
    const url = _url
    return url
}

function getAllResponseHeaders(payload) {
    const { xhr } = payload
    const headerString = xhr.getAllResponseHeaders()
    const headers = {}
    headerString.split('\r\n').map((header) => {
        const [key, value] = header.split(': ')
        headers[key] = value
    })
    return headers
}

const AjaxUtil = {
    _xhrs: [],
    _jsonps: { index: 0 },
    // eslint-disable-next-line object-shorthand
    doRequest: function (options) {
        const method = options.method || 'GET'
        let url = _getUrl(options.url, options)

        let headers
        try {
            if (options?.requestHeaders) {
                headers = options.requestHeaders
                options.requestHeaders = undefined
                delete options.requestHeaders
            }
        } catch (e) {
            isDebug() && console.log('[devfab][ajax]: [doRequest]: options["requestHeaders"] ERR : ', e)
        }
        try {
            if (options.params && options.params.requestHeaders) {
                headers = options.params.requestHeaders
                options.params.requestHeaders = undefined
                delete options.params.requestHeaders
            }
        } catch (e) {
            isDebug() && console.log('[devfab][ajax]: [doRequest]: options.params["requestHeaders"] ERR : ', e)
        }

        let queryJson = null
        if (equalsIgnoreCase(method, 'get') || equalsIgnoreCase(method, 'delete')) {
            url = _appendUrl(url, options.params)
        } else if (equalsIgnoreCase(method, 'post') || equalsIgnoreCase(method, 'put')) {
            queryJson = JSON.stringify(options.params)
        }
        if (options.jsonp) {
            return this.getJsonp(url, options.callback)
        }
        const xhr = this.getXMLHttpRequest()
        if (!xhr) {
            return
        }
        xhr.open(method, url, options.async !== false)
        if (options.timeout) {
            xhr.timeout = options.timeout
            xhr.setRequestHeader('timeout', options.timeout)
            xhr.ontimeout = function () {
                AjaxUtil.onerror(this, options, 'timeout')
            }
        }
        if (options.contentType) {
            xhr.setRequestHeader('Content-Type', options.contentType)
            if (options.contentType.indexOf('x-www-form-urlencoded') >= 0) {
                queryJson = new URLSearchParams(options.params)?.toString()
            }
        } else if (options.dateType) {
            queryJson = options.params
        } else {
            xhr.setRequestHeader('Content-Type', 'application/json;charset=utf-8')
        }

        try {
            if (headers && Object.prototype.toString.call(headers) === '[object Object]') {
                for (const key in headers) {
                    xhr.setRequestHeader(key, headers[key])
                }
            }
        } catch (e) {
            isDebug() && console.log('[devfab][ajax]: [doRequest]: options.params["requestHeaders"] ERR : ', e)
        }
        // eslint-disable-next-line no-prototype-builtins
        xhr.withCredentials = options?.hasOwnProperty('withCredentials') ? options.withCredentials : true

        if (options.onBeforeRequest) {
            options.onBeforeRequest(xhr, queryJson)
        }
        try {
            xhr.send(queryJson)
        } catch (e) {
            return { error: 'NetWorkError', options }
        }
        if (options.async === false) {
            return this.onreadystatechange(xhr, options)
            // eslint-disable-next-line no-else-return
        } else {
            xhr.onreadystatechange = function () {
                AjaxUtil.onreadystatechange(this, options)
            }
        }
    },
    // eslint-disable-next-line object-shorthand
    onreadystatechange: function (xhr, options) {
        if (xhr.readyState !== 4) {
            return
        }
        if (xhr.status === 200) {
            let ajaxResult
            try {
                if (options.responseType === 'blob') {
                    const headers = getAllResponseHeaders({ xhr })
                    ajaxResult = { code: xhr.status, data: { data: xhr.response, headers } }
                } else {
                    ajaxResult = JSON.parse(xhr.responseText)
                }
            } catch {
                AjaxUtil.onerror(xhr, options, xhr.responseText)
            }
            if (options.async === false) {
                xhr.isBusy = false
                if (options.onAfterRequest) {
                    options.onAfterRequest(ajaxResult)
                }
                return AjaxUtil.parseAjaxResult(ajaxResult, false, null, null, options, xhr)
            }
            AjaxUtil.parseAjaxResult(ajaxResult, options.async, options.callback, options.context, options, xhr)
            if (options.onAfterRequest) {
                options.onAfterRequest(ajaxResult)
            }
        } else if (xhr.status === 0) {
            AjaxUtil.onerror(xhr, options, 'The network connection has been disconnected. Please check the network status of the device and try.')
        } else if (xhr.status === 502 || xhr.status === 504) {
            AjaxUtil.onerror(xhr, options, 'An error has occurred with the service. Please try again later.')
        } else if (xhr.status === 401) {
            AjaxUtil.onerror(xhr, options, 'Login information has expired. Please log in again or contact technical staff.')
        } else {
            let messageObj = {}
            try {
                const message = JSON.parse(xhr.responseText)
                messageObj = message
            } catch {
                messageObj = {
                    code: xhr.status,
                    message: xhr.responseText,
                }
            }
            return AjaxUtil.onerror(xhr, options, messageObj)
        }
        xhr.isBusy = false
    },
    // eslint-disable-next-line object-shorthand
    onerror: function (xhr, options, message) {
        const errorMessage = `[devfab][ajax]: [onerror]: api error \n    [code]: ${xhr.status} \n    [error]: ${(typeof message === 'object' ? JSON.stringify(message) : message) || '空'} \n    [url]: ${options.url} \n    [token]: ${document.cookie}`
        isDebug() && console.log(errorMessage)
        const ajaxResult = typeof message === 'object' ? message : { code: 500, message }
        if (options.onAfterRequest) {
            options.onAfterRequest(ajaxResult)
        }
    },
    // eslint-disable-next-line object-shorthand
    getXMLHttpRequest: function () {
        return this.createXMLHttpRequest()
    },

    // eslint-disable-next-line object-shorthand
    createXMLHttpRequest: function () {
        const xhr = window.XMLHttpRequest ? new XMLHttpRequest() : window.ActiveXObject ? new window.ActiveXObject('Microsoft.XMLHTTP') : null
        return xhr
    },
    // eslint-disable-next-line object-shorthand
    getJsonp: function (_url, callback) {
        let url = _url
        // eslint-disable-next-line prefer-template
        const responseCallback = 'callback' + this._jsonps.index++
        const scriptDom = document.createElement('script')
        this._jsonps[responseCallback] = function (data) {
            try {
                callback(data)
            } finally {
                document.body.removeChild(scriptDom)
            }
        }
        // eslint-disable-next-line prefer-template
        url += url.indexOf('?') === -1 ? '?' : '&callback=cb.rest.AjaxUtil._jsonps.' + responseCallback
        scriptDom.src = url
        document.body.appendChild(scriptDom)
    },
    // eslint-disable-next-line object-shorthand
    parseAjaxResult: function (ajaxResult, async, callback, context, options, xhr) {
        if (!ajaxResult) {
            return
        }
        if (!ajaxResult.code) {
            if (async === false) {
                return ajaxResult
            }
            if (callback) {
                callback.call(context, null, ajaxResult)
            }
            return
        }

        if (ajaxResult.code == 200) {
            if (async === false) {
                return { result: ajaxResult.data }
            }
            if (callback) {
                callback.call(context, null, ajaxResult.data, ajaxResult.message, ajaxResult.errorDetail, ajaxResult.code, ajaxResult.displayCode && ajaxResult)
            }
        } else {
            if (async === false) {
                return { error: ajaxResult }
            }
            if (callback) {
                callback.call(context, ajaxResult)
            }
        }
    },
}

function ajax(url, options) {
    options.url = url
    return AjaxUtil.doRequest(options)
}

function DynamicProxy(config, query) {
    if (this.init) {
        this.init(config)
    }
    this.queryParams = query
}

DynamicProxy.create = function (config, query) {
    return new DynamicProxy(config, query)
}

DynamicProxy.prototype.init = function (config) {
    if (!config) {
        return
    }
    this.config = config
    for (const attr in this.config) {
        // eslint-disable-next-line wrap-iife
        this[attr] = (function (attr) {
            return function (data, callback, context) {
                return this.Do(attr, data, callback, null, context)
            }
        })(attr)
        // eslint-disable-next-line wrap-iife
        this[`${attr}Sync`] = (function (attr) {
            return function (data) {
                return this.Do(attr, data, null, false)
            }
        })(attr)
    }
}

DynamicProxy.prototype.Do = function (op, data, callback, async, context) {
    if (!this.config || !this.config[op] || !this.config[op].url) {
        return
    }
    const config = this.config[op]
    let url = config.url
    if (!this.queryParams) {
        this.queryParams = {}
    }
    if (config.options?.proxyServiceCode) {
        this.queryParams.serviceCode = config.options.proxyServiceCode
    }
    if (config.options?.billnum) {
        this.queryParams.billnum = config.options.billnum
    }
    if (this.queryParams?.serviceCode) {
        url = _appendUrl(url, this.queryParams)
    }
    const restUrl = url
    const options = Object.assign({}, config.options)
    options.method = config.method || 'GET'
    if (typeof data === 'function') {
        options.callback = data
        options.context = context || options.context || this
    } else {
        options.params = data
    }
    if (callback) {
        options.callback = callback
        options.context = context || options.context || this
    }
    if (async === false) {
        options.async = false
    }
    return this.ajax(restUrl, options)
}

DynamicProxy.prototype.ajax = function (url, options) {
    return ajax(url, options)
}

export default DynamicProxy
