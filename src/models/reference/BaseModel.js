import Cache from '../../cache'
import Event from '../../event'
import Ajax from '../../ajax'
import { isDebug } from '../../string'

export default class BaseModel {
    constructor(args) {
        this._init(args)
    }

    /* 数据容器                                                                   */

    _init(args) {
        this._data = {}
        const propertyNames = []
        if (args) {
            for (const propertyName in args) {
                propertyNames.push(propertyName)
            }
        }
        Object.assign(
            this._data,
            {
                components: [],
                propertyNames,
            },
            args
        )
        this._data.cache = new Cache()
        this._data.events = new Event()
    }

    _del_data(key) {
        if (!key) {
            return
        }
        delete this._data[key]
    }

    _cls_data() {
        this._data.cache.clear()
        this._data.events.clear()
        this._data = {
            components: [],
            propertyNames: [],
            cache: new Cache(),
            events: new Event(),
        }
    }

    _set_data(name, val, update) {
        if (!name) {
            return
        }
        if (update) {
            const propertyNames = this._data.propertyNames || []
            if (propertyNames.indexOf(name) < 0) {
                propertyNames.push(name)
            }
        }
        this._data[name] = val
    }

    _get_data(name) {
        if (!name) {
            return
        }
        return this._data[name]
    }

    getData() {
        return this._get_data('value')
    }

    /* 组件联动                                                                   */

    getState(name, ctrlName) {
        if (!ctrlName) {
            return this._get_data(name)
        }
        const components = this._get_data('components') || []
        const component = components.find((item) => item.ctrlName === ctrlName)
        if (!component) {
            return this._get_data(name)
        }
        return component.getState?.(name)
    }

    setState(name, value, ctrlName) {
        if (!ctrlName) {
            this._set_data(name, value, true)
        }
        const state = {}
        state[name] = value
        this.doPropertyChange('setState', state, ctrlName)
    }

    doPropertyChange(name, value, ctrlName) {
        const components = this._get_data('components') || []
        if (!components.length) {
            return components
        }
        const notNotifiedComponents = []
        if (!ctrlName) {
            components.forEach((item) => {
                if (!this.notifyComponent(item, name, value)) {
                    notNotifiedComponents.push(item)
                }
            })
        } else {
            const component = components.find((item) => item.ctrlName === ctrlName)
            if (component && !this.notifyComponent(component, name, value)) {
                notNotifiedComponents.push(component)
            }
        }
        if (notNotifiedComponents.length) {
            return notNotifiedComponents
        }
    }

    notifyComponent(component, name, value) {
        if (typeof component[name] !== 'function') {
            return false
        }
        this.viewUpdater(component, name, value)
        return true
    }

    viewUpdater(component, name, value) {
        if (name === 'setState') {
            component[name](value)
        } else {
            const propertyName = this.getCache('name')
            component[name](value, propertyName)
        }
    }

    get(name) {
        return this._get_data(name)
    }

    addComponent(component, ctrlName) {
        if (!component) {
            return
        }
        if (ctrlName && !component.ctrlName) {
            component.ctrlName = ctrlName
        }
        const components = this._get_data('components') || []
        if (components.indexOf(component) >= 0) {
            return
        }
        components.push(component)
    }

    removeComponent(component) {
        const components = this._get_data('components') || []
        const index = components.indexOf(component)
        if (index < 0) {
            return
        }
        components.splice(index, 1)
    }

    _applyState(name, value, ctrlName) {
        if (!ctrlName) {
            this._set_data(name, value, true)
        }
        const setterName = `set${name.charAt(0).toUpperCase()}${name.slice(1)}`
        const notNotifiedComponents = this.doPropertyChange(setterName, value, ctrlName)
        if (!notNotifiedComponents) {
            return
        }
        const state = {}
        state[name] = value
        notNotifiedComponents.forEach((component) => {
            this.notifyComponent(component, 'setState', state)
        })
    }

    getVisible(ctrlName) {
        return this.getState('visible', ctrlName)
    }

    setVisible(value, ctrlName) {
        this._applyState('visible', value, ctrlName)
    }

    getValue() {
        return this.getData()
    }

    setValue(value, fireEvent, ctrlName) {
        const self = this
        const oldValue = this.getValue()
        if (value === oldValue) {
            return
        }
        const data = { value, oldValue }
        const forceFireEvent = this._get_data('forceFireEvent')

        if (fireEvent || forceFireEvent) {
            this.promiseExecute('beforeValueChange', data, [
                function () {
                    self._set_data('value', value, true)
                    self._applyState('value', value, ctrlName)
                    self.execute('afterValueChange', data)
                },
                function () {
                    self._set_data('value', oldValue, true)
                    self._applyState('value', oldValue, ctrlName)
                },
            ])
            return
        }
        this._set_data('value', value, true)
        this._applyState('value', value, ctrlName)
    }

    getDisabled(ctrlName) {
        return this.getState('disabled', ctrlName)
    }

    setDisabled(value, ctrlName) {
        this._applyState('disabled', value, ctrlName)
    }

    setParent(parent) {
        this.setCache('parent', parent)
    }

    getParent() {
        return this.getCache('parent')
    }

    getRootParent() {
        let viewModel = this.getParent()
        while (viewModel?.getParent()) {
            viewModel = viewModel.getParent()
        }
        return viewModel
    }

    setName(name) {
        this.setCache('name', name)
    }

    getName() {
        return this.getCache('name')
    }

    setDirty(dirty) {
        if (dirty) {
            this._set_data('isDirty', true)
            return
        }
        this._del_data('isDirty')
        this._set_data('originalData', this.getData())
    }

    getDirtyData(necessary) {
        const value = this.getData()
        if (necessary !== false && this._get_data('isDirty')) {
            return value
        }
        if (value === this._get_data('originalData')) {
            return
        }
        return value
    }

    clear(useDefault) {
        if (useDefault === undefined) {
            this._set_data('value', this._get_data('cDefaultValue'))
        } else if (!useDefault) {
            this._set_data('value', undefined)
        }
        this._del_data('isDirty')
        this._del_data('checking')
        this._del_data('checkMsg')
    }

    on(name, callback, context) {
        this._get_data('events').on(name, callback, context)
    }

    onFirst(name, callback, context) {
        this._get_data('events').onFirst(name, callback, context)
    }

    execute(name, ...args) {
        return this._get_data('events').execute(name, ...args)
    }

    un(name, callback) {
        this._get_data('events').un(name, callback)
    }

    hasEvent(name) {
        return this._get_data('events').hasEvent(name)
    }

    fireEvent(eventName, args) {
        this._get_data('events').fireEvent(eventName, args)
    }

    promiseExecute(check, eventName, ...restArgs) {
        this._get_data('events').promiseExecute(check, eventName, ...restArgs)
    }

    setCache(key, value) {
        this._get_data('cache').set(key, value)
    }

    getCache(key) {
        return this._get_data('cache').get(key)
    }

    clearCache(key) {
        this._get_data('cache').delete(key)
    }

    setProxy(config) {
        if (config instanceof Ajax) {
            this._set_data('proxy', config)
        } else {
            const requestHeaders = this._get_data('__requestHeaders__')
            for (const attr in config) {
                if (requestHeaders && !config[attr]?.options?.requestHeaders) {
                    if (!config[attr]?.options) {
                        config[attr].options = {}
                    }
                    config[attr].options.requestHeaders = requestHeaders
                }
                if (this.getProxy()?.[attr]) {
                    isDebug() && console.warn(`[devfab][baseModel.prototype.setProxy]: Proxy ${attr} already exists on the model. Please change the name of ${attr} and try again`)
                }
            }
            this._set_data('proxy', Ajax.create({ ...(this.getProxy()?.config || {}), ...config }))
            const proxyAll = this.getProxy()
            return proxyAll
        }
    }

    getProxy() {
        return this._get_data('proxy')
    }
}
