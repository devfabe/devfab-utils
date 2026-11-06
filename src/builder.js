import { pick } from './string'

class BaseBuilder {
    __data = {
        componentField: ['component'],
        childrenField: ['children'],
        components: {},
        renderFactory: null,
        componentFactory: null,
    }
    constructor() {
        //
    }
    init(config, _components, _renderFactory, _componentFactory) {
        const { components, renderFactory, componentFactory, ...builderConfig } = config || {}
        this._initConfig(builderConfig)
        this._initComponent(_components || components)
        this._initRenderFactory(_renderFactory || renderFactory)
        this._initComponentFactory(_componentFactory || componentFactory)
    }
    _initConfig(_data) {
        Object.assign(this.__data, _data)
    }
    _initComponent(name, comp) {
        const components = this.__data.components
        if (!name) {
            return
        } else if (typeof name === 'string') {
            if (components[name]) {
                console.log(`[warning] Component ${name} is exist!`)
                return
            }
            components[name] = comp
        } else if (typeof name === 'function') {
            Object.assign(components, name?.())
        } else if (typeof name === 'object') {
            Object.assign(components, name)
        }
    }

    _getComponent(name) {
        return this.__data.components?.[name]
    }

    _clearComponents() {
        this.__data.components = {}
    }

    _initRenderFactory(fn) {
        this.__data.renderFactory = fn
    }

    _initComponentFactory(fn) {
        this.__data.componentFactory = fn
    }

    _childrenFields() {
        const field = this.__data.childrenField
        if (!field) {
            return ['children']
        }
        return Array.isArray(field) ? field : [field]
    }

    _renderComponent(_config, extraConfig) {
        if (!_config) {
            return
        }
        const config = Array.isArray(_config) ? _config : [_config]
        const { componentField, renderFactory, componentFactory } = this.__data
        const childrenFields = this._childrenFields()
        const _component = []
        config.forEach((_item, i) => {
            const item = { ..._item }
            const _com = pick(item, 'component', componentField)
            const _render = item.render
            const _props = { ...item }
            const _children = []
            childrenFields.forEach((field) => {
                const value = _props[field]
                if (Array.isArray(value)) {
                    _children.push(...value)
                }
            })
            const component = componentFactory?.(item) || this._getComponent(_com)
            if (!component && typeof _render !== 'function') {
                console.log(`[devfab][utils][builder][warning] Component ${_com} is not registered!`)
            }
            const children = this._renderComponent(_children, extraConfig)
            const node = {
                component,
                children,
            }
            _props.index = i
            const props = Object.assign({}, extraConfig?.props, { meta: _props })
            if (typeof _render === 'function') {
                _component.push(_render({ node, props }))
            } else if (typeof renderFactory === 'function') {
                _component.push(renderFactory({ node, props }))
            } else {
                Object.assign(node, props)
                _component.push(node)
            }
        })
        return _component
    }
    clear() {
        this._clearComponents()
        this.__data.renderFactory = null
        this.__data.componentFactory = null
    }
}

class Builder extends BaseBuilder {
    initComponent(name, comp) {
        this._initComponent(name, comp)
    }
    getComponents() {
        return { ...this.__data.components }
    }
    getComponent(name) {
        return this._getComponent(name)
    }
    hasComponent(name) {
        return !!this._getComponent(name)
    }
    initRenderFactory(fn) {
        this._initRenderFactory(fn)
    }

    initComponentFactory(fn) {
        this._initComponentFactory(fn)
    }

    render(config, extraConfig) {
        return this._renderComponent(config, extraConfig)
    }
}
Builder.create = function (args) {
    return new Builder(args)
}
export default Builder
