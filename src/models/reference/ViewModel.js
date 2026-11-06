import BaseModel from './BaseModel'
import GridModel from './GridModel'

class ViewModel extends BaseModel {
    modelType = 'ViewModel'
    getParams() {
        return this._get_data('params')
    }

    setParams(params) {
        this._set_data('params', params, true)
    }

    set(propertyName, value) {
        if (value instanceof BaseModel) {
            value.setParent(this)
            value.setName(propertyName)
        }
        this._set_data(propertyName, value, true)
    }

    setData(data) {
        for (const propertyName in data) {
            this.addProperty(propertyName, data[propertyName])
        }
    }

    addProperty(propertyName, value) {
        const property = this.get(propertyName)
        if (property?.setData) {
            property.setData(value)
        } else {
            this.set(propertyName, value)
        }
    }

    getData() {
        const propertyNames = this._get_data('propertyNames') || []
        const data = {}
        propertyNames.forEach((propertyName) => {
            const property = this.get(propertyName)
            if (property instanceof BaseModel && property._get_data('needCollect') !== false) {
                data[propertyName] = property.getData?.()
            }
        })
        return data
    }

    getAllData(withOutGrid) {
        const propertyNames = this._get_data('propertyNames') || []
        const rawData = {}
        propertyNames.forEach((propertyName) => {
            const property = this.get(propertyName)
            if (!(property instanceof BaseModel) || property._get_data('needCollect') === false) {
                return
            }
            if (withOutGrid && property._get_data('isGrid')) {
                return
            }
            const value = property.getData?.()
            if (value !== undefined) {
                rawData[propertyName] = value
            }
        })
        return rawData
    }

    removeProperty(propertyName) {
        const propertyNames = this._get_data('propertyNames') || []
        const index = propertyNames.indexOf(propertyName)
        if (index !== -1) {
            propertyNames.splice(index, 1)
        }
        this._del_data(propertyName)
    }

    loadData(data) {
        this.setCache('isLoadData', true)
        this.clear()
        this.setData(data)
        this.setDirty(false)
        this.setCache('isLoadData', false)
    }

    clear(useDefault) {
        const propertyNames = this._get_data('propertyNames') || []
        propertyNames.forEach((propertyName) => {
            const property = this.get(propertyName)
            if (property instanceof BaseModel && property._get_data('needClear') !== false) {
                property.clear?.(useDefault)
            }
        })
    }

    destroyVM() {
        this._data.events?.clear()
        this._data.cache?.clear()
        this.clear()
    }

    setDirty(dirty) {
        if (dirty) {
            this._set_data('isDirty', true)
            return
        }
        this._del_data('isDirty')
        this._set_data('originalData', this.getData())
    }

    getGridModel(propertyName) {
        if (propertyName) {
            return this.get(propertyName)
        }
        let gridModel = this._get_data('gridModel')
        if (gridModel) {
            return gridModel
        }
        const masterGridModelName = this.getParams()?.masterGridModelName
        if (masterGridModelName) {
            return this.get(masterGridModelName)
        }
        const propertyNames = this._get_data('propertyNames')
        for (let i = 0, len = propertyNames.length; i < len; i++) {
            gridModel = this.get(propertyNames[i])
            const isGridModel = gridModel instanceof GridModel || gridModel.modelType == 'GridModel'
            if (isGridModel) {
                this._set_data('gridModel', gridModel)
                return gridModel
            }
        }
    }

    getGridModels() {
        const propertyNames = this._get_data('propertyNames')
        const gridModels = []
        for (let i = 0, len = propertyNames.length; i < len; i++) {
            const gridModel = this.get(propertyNames[i])
            const isGridModel = gridModel instanceof GridModel || gridModel.modelType == 'GridModel'
            if (isGridModel) {
                gridModels.push(gridModel)
            }
        }
        return gridModels
    }

    getGridFilterModel(propertyName) {
        const gridModel = this.getGridModel(propertyName)
        return gridModel.getCache('FilterViewModel')
    }
}
const MyViewModel = ViewModel
ViewModel._create = function (meta, params = {}) {
    const {
        modelNameField = 'cName', // 用于生成模型的字段
    } = params
    const ViewModel = params?.models?.ViewModel || MyViewModel
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
                    param.model = params?.createModelFactory(field, params)
                }
                fields[param.modelName] = param.model
                params?.onAfterInitModel?.(param)
            })
            return fields
        }

        initData() {
            if (params?.initData) {
                params?.initData.call(this, this)
            } else {
                Promise.resolve(true).then(() => {
                    this.execute('afterVMInit', this)
                })
            }
        }
    }

    VM.prototype.modelType = 'ViewModel'
    return VM
}

ViewModel._init = function (meta, params = {}, callback) {
    const VM = ViewModel._create(meta, params)
    let vm = new VM()
    const param = { model: vm, meta }
    params?.onBeforeInitModel?.(param)
    param.model = vm
    vm?.init?.(meta.models, meta)
    params?.onAfterInitModel?.(param)

    vm.on('destroyVM', () => {
        vm?.destroyVM?.()
        vm = null
    })
    vm.on('afterVMInit', async () => {
        callback?.(vm, meta)
    })
    const readyEventName = params?.readyEventName || 'extendReady'
    vm.on(readyEventName, async () => {
        vm.execute('afterVMInit', vm)
    })
    vm.initData()

    return vm
}

export default ViewModel
