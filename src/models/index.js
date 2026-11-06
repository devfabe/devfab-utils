import * as models from './reference'
import { initExtendScripts, initExtScripts, loadScripts } from './_extend'
import { isDebug } from '../string'

const BaseModel = models.BaseModel
const SimpleModel = models.SimpleModel
const ViewModel = models.ViewModel
const GridModel = models.GridModel

function createModelFactory(props, params) {
    const SimpleModel = params?.SimpleModel || models.SimpleModel
    let cControlType = props.cControlType || props.component || props.controlType || props.ctrlType || ''
    cControlType = cControlType?.toLowerCase()
    let model
    switch (cControlType) {
        case 'input':
            model = new SimpleModel(props)
            break
        default:
            model = new SimpleModel(props)
            break
    }
    return model
}

function _createViewModel(meta, params = {}) {
    const {
        modelNameField = 'cName', // 用于生成模型的字段
    } = params

    const ViewModel = params?.models?.ViewModel || models.ViewModel

    class VM extends ViewModel {
        init(_models, meta) {
            const fields = this.createModels(_models, meta)
            this.setData(fields)
            this.setDirty(false)
        }

        createModels(_models, meta) {
            const fields = {}
            const models = Array.isArray(_models) ? _models : []
            models.forEach((field) => {
                const modelName = field[modelNameField]
                const param = { model: null, meta: field, childModel: true, modelName }
                params?.onBeforeInitModel?.(param)
                if (!param.model) {
                    param.model = createModelFactory(field, params)
                }
                fields[param.modelName] = param.model
                params?.onAfterInitModel?.(param)
            })
            return fields
        }

        initData() {
            initExtendScripts.call(this, params)
        }
    }

    VM.prototype.modelType = 'ViewModel'
    return VM
}

// function _initViewModel(meta, params) {
//     const VM = _createViewModel(meta, params)
//     const vm = new VM()
//     const param = { model: vm, meta }
//     params?.onBeforeInitModel?.(param)
//     param.model = vm
//     vm?.init?.(meta.models, meta)
//     params?.onAfterInitModel?.(param)
//     return vm
// }

// function initViewModel(meta, params = {}, callback) {
//     let vm = _initViewModel(meta, params)
//     vm.on('destroyVM', () => {
//         vm?.destroyVM?.()
//         vm = null
//         isDebug() && console.info(`[devfab][models][initVM]: destory vm ${new Date().toString()}`)
//     })
//     vm.on('extendReady', async () => {
//         const promises = []
//         // 加载客开脚本
//         promises.push(initExtScripts(meta, vm, params))
//         await Promise.all(promises)
//         isDebug() && console.info(`[devfab][models][initVM]: after vm init ${new Date().toString()}`)
//         callback?.(vm, meta)
//     })
//     vm.initData()
//     return vm
// }

function initViewModel(meta, _params = {}, _callback) {
    const params = { initData: initExtendScripts, createModelFactory, ..._params }

    const callback = async (vm, meta) => {
        const promises = []
        // 加载客开脚本
        promises.push(initExtScripts(meta, vm, params))
        await Promise.all(promises)
        isDebug() && console.info(`[devfab][models][initVM]: after vm init ${new Date().toString()}`)
        _callback?.(vm, meta)
    }
    const vm = ViewModel._init(meta, params, callback)
    return vm
}

ViewModel.init = function (meta, params, callback) {
    return initViewModel(meta, params, callback)
}

export { BaseModel, SimpleModel, GridModel, ViewModel, initViewModel, loadScripts }
