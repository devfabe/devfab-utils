import { isDebug } from '../string'

function missingLoaderResult(filesStr) {
    return {
        code: 404,
        message: `params.fileRequire is required, the files: ${filesStr}`,
        data: [],
        warnings: [],
    }
}

export function loadScripts(_fileRequire, _path, _files, _callback, _params) {
    let path = _path
    let files = _files
    let callback = _callback
    let params = _params
    if (Array.isArray(_path) && typeof _files === 'function') {
        path = undefined
        files = _path
        callback = _files
        params = _callback
    }
    const viewModel = params?.viewModel || this
    files = Array.isArray(files) ? files : []
    const filesStr = files.join(',')

    if (!_fileRequire || typeof _fileRequire.inject !== 'function') {
        const result = missingLoaderResult(filesStr)
        if (isDebug()) {
            console.error(`[devfab][models][extend][loadScripts] ${result.message}`)
        }
        callback?.(result)
        return result
    }

    return _fileRequire.inject(path, files, (result) => {
        if (result.code == 0 && Array.isArray(result.data)) {
            for (let i = 0, len = result.data.length; i < len; i++) {
                const content = result.data[i]
                if (content && content.doAction) {
                    try {
                        content.doAction('init', viewModel)
                    } catch (err) {
                        result.code = 500
                        result.message = `${filesStr} script execute error`
                        result.error = err
                        break
                    }
                } else {
                    try {
                        if (typeof params?.onFileBack === 'function') {
                            params.onFileBack(content, i)
                        }
                    } catch (err) {
                        result.code = 500
                        result.message = `${filesStr} script customize execute error`
                        break
                    }
                }
            }
        }
        if (result.code != 0 && isDebug()) {
            console.info(`[devfab][models][extend][loadScripts] ${filesStr} \n    [message]: ${result.message} \n${result.error ? ' \n    [error]: ' : ''}`, result.error)
        }
        callback?.(result)
    })
}
export function initExtendScripts(params) {
    const self = this
    if (window.__devfab && window.__devfab.__debugger_initExtendJs) {
        // eslint-disable-next-line no-debugger
        debugger
    }
    const { fileRequire, extendScriptParams, readyEventName = 'extendReady' } = params
    const { enableJs = false, filepath, scriptUrl } = extendScriptParams || {}
    if (!enableJs) {
        isDebug() && console.info(`[devfab][extend][js] not enable extend script`)
        self.execute(readyEventName, self)
        return
    }
    if (!scriptUrl) {
        isDebug() && console.info(`[devfab][extend][js] extend script is not defined`)
        self.execute(readyEventName, self)
        return
    }
    const extendFilePath = filepath
    const extendFile = scriptUrl
    const extendFiles = [extendFile]
    if (self.getEnv && self.getEnv('everyCommonExtend')) {
        extendFiles.push(self.getEnv('everyCommonExtend'))
    }

    loadScripts.call(self, fileRequire, extendFilePath, extendFiles, (result) => {
        self.execute(readyEventName, self, result)
    })
}

export const initExtScripts = async (data, viewModel, params) => {
    if (window.__devfab && window.__devfab.__debugger_initExtJs) {
        // eslint-disable-next-line no-debugger
        debugger
    }
    const { fileRequire, extendScriptParams } = params
    const { enableExtJs = false, exturlsField = 'extscripturls' } = extendScriptParams || {}
    if (!enableExtJs) {
        isDebug() && console.info(`[devfab][extend][exturls] ext script is not enable`)
        return Promise.resolve(true)
    }
    if (!data) {
        isDebug() && console.info(`[devfab][extend][exturls] script data is null`)
        return Promise.resolve(true)
    }
    const extscripturls = data?.[exturlsField]
    let exturls = Array.isArray(extscripturls) ? extscripturls : []
    // local script
    exturls = (viewModel.getCache('localScripts') || []).concat(exturls)

    // global script
    exturls = exturls.concat(window.__devfab__GLOBAL_EXT_SCRIPTS__ || [])

    // params script
    if (viewModel.getParams()?.selfExtUrls) {
        exturls = exturls.concat([viewModel.getParams().selfExtUrls])
    }

    // 预加载
    if (exturls?.length) {
        exturls = [...new Set(exturls)]
        exturls = await Promise.all(
            exturls.map(async (url) => {
                return url
            })
        )
    }

    data[exturlsField] = exturls
    return new Promise((resolve, reject) => {
        loadScripts.call(viewModel, fileRequire, exturls, (result) => {
            resolve(result)
        })
    })
}
