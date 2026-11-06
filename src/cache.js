class Cache {
    constructor(args) {
        this._init(args)
    }
    _init(args) {
        this._data = Object.assign({}, args)
    }
    set(key, value) {
        this._data[key] = value
    }

    get(key) {
        return this._data?.[key]
    }

    delete(key) {
        delete this._data[key]
    }

    clear() {
        this._data = {}
    }
}

Cache.create = function (args) {
    return new Cache()
}
export default Cache
