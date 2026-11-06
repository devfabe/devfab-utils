import BaseModel from './BaseModel'
import { isDebug } from '../../string'

export const DataStates = {
    Unchanged: '',
    Insert: 'Insert',
    Update: 'Update',
    Delete: 'Delete',
}

const DEFAULT_PAGE_SIZE = 20

const isArray = Array.isArray

function cloneDeep(value) {
    if (isArray(value)) {
        return value.map(cloneDeep)
    }
    if (value instanceof Date) {
        return new Date(value.getTime())
    }
    if (value && typeof value === 'object') {
        const result = {}
        for (const key in value) {
            result[key] = cloneDeep(value[key])
        }
        return result
    }
    return value
}

function normalizeColumns(columns) {
    const map = {}
    const list = isArray(columns) ? columns : Object.keys(columns || {}).map((key) => ({ ...(columns[key] || {}), field: columns[key]?.field || key }))
    list.forEach((column, index) => {
        if (!column) {
            return
        }
        const field = column.field || column.cFieldName || column.cName || `col_${index}`
        map[field] = {
            ...column,
            field,
            label: column.label || column.title || column.cCaption || field,
            index: column.index === undefined ? index : column.index,
        }
    })
    return map
}

function resolveRowsData(res) {
    if (!res) {
        return []
    }
    if (isArray(res)) {
        return res
    }
    if (isArray(res.data)) {
        return res.data
    }
    if (isArray(res.records)) {
        return res.records
    }
    if (isArray(res.list)) {
        return res.list
    }
    if (isArray(res.rows)) {
        return res.rows
    }
    const nested = res.data && typeof res.data === 'object' ? res.data : res.result
    if (isArray(nested)) {
        return nested
    }
    if (nested && typeof nested === 'object') {
        return nested.records || nested.list || nested.rows || nested.data || []
    }
    return []
}

// ---------------- 初始状态 ----------------

function createDefaultProps() {
    const innerUsedAttrs = {
        id: '_id',
        selected: '_selected',
        status: '_status',
        pageIndex: 'pageNo',
        pageSize: 'pageSize',
        pageCount: 'total',
    }
    return {
        columns: {},
        dataSource: [],
        rows: [],
        readOnly: true,
        dataSourceMode: 'local',
        columnMode: 'local',
        editMode: 'cell',
        rowKeyField: 'id',
        cellState: {},
        rowState: {},
        showCheckBox: false,
        multiple: true,
        showRowNo: true, // 默认显示序号
        pagination: true,
        pageInfo: {
            [innerUsedAttrs.pageIndex]: 1,
            [innerUsedAttrs.pageSize]: DEFAULT_PAGE_SIZE,
            [innerUsedAttrs.pageCount]: 0,
        },
        innerUsedAttrs,
        multiRowModel: false, // 表格多行模型
        editRowModels: {},
        // ---- 取数与加载态 ----
        loading: false,
        params: {},
        // ---- 脏数据 ----
        originalKeyMap: {},
        defaultRowDatas: new Map(),
    }
}

function resolveProxyConfig(props = {}) {
    const proxy = { ...(props.proxyConfig || {}) }
    return proxy
}

function _getData(proxyConfig, queryParams, callback) {
    this.promiseExecute('beforeQuery', { proxyConfig, queryParams }, () => {
        const self = this
        const proxy = this.setProxy({ queryData: proxyConfig })
        const pageIndexField = this._get_data('innerUsedAttrs').pageIndex
        const pageSizeField = this._get_data('innerUsedAttrs').pageSize
        const currentPageInfo = { page: { [pageSizeField]: this.getPageSize(), [pageIndexField]: this.getPageIndex() } }
        const params = Object.assign(queryParams, currentPageInfo)
        this.setCache('proxyCache', { proxyConfig, params, callback })
        const queryDataCallback = function (err, _result, callBackMsg, errorDetail, ...args) {
            if (err) {
                return
            }
            let result = _result
            this._set_data('dataSourceMode', 'remote') // 处理请求过程中被修改
            result = Object.assign({}, result)
            const data = resolveRowsData(result)
            this.execute('afterQueryData', result)
            callback?.call(this, data)
        }

        if (this.execute('beforeQueryData', params) === false) {
            return
        }
        const queryDataParams = cloneDeep(params)
        proxy.queryData(queryDataParams, queryDataCallback, self)
    })
}

function _setData(data) {
    if (!this.execute('beforeSetDataSource', data)) {
        return
    }
    const rowKeyField = this.getRowKeyField()
    const keyMap = {}
    data.forEach((item) => {
        keyMap[item[rowKeyField]] = item
    })
    this._set_data('keyMap', keyMap)
    this._set_data('dataSource', data, true)
    this.doPropertyChange('setDataSource')
    this.execute('afterSetDataSource', data)
}

export class GridModel extends BaseModel {
    modelType = 'GridModel'
    constructor(props = {}) {
        const data = { ...createDefaultProps(), ...props }
        if (!isArray(data.dataSource)) {
            data.dataSource = []
        }
        if (!isArray(data.rows)) {
            data.rows = []
        }
        const proxyConfig = resolveProxyConfig(props)
        data.proxyConfig = proxyConfig
        data.dataSourceMode = props.dataSourceMode || data.dataSourceMode

        super(data)

        this.initColumns(data.columns)
        this.initPageInfo(props.cPage || props.page)
        this.afterInit()
    }

    afterInit() {
        this.execute('afterInit')
    }

    initColumns(columns) {
        const map = normalizeColumns(columns)
        this._set_data('columns', map, true)
        return map
    }

    initPageInfo(page = {}) {
        const pageInfo = { ...this.getPageInfo() }
        const pageIndexField = this._get_data('innerUsedAttrs').pageIndex
        const pageSizeField = this._get_data('innerUsedAttrs').pageSize
        pageInfo[pageIndexField] = page.pageNo || page.pageIndex || pageInfo.pageIndex || 1
        pageInfo[pageSizeField] = page.pageSize || pageInfo.pageSize || DEFAULT_PAGE_SIZE
        if (this.get('pagination') === false) {
            pageInfo[pageIndexField] = -1
        }
        this._set_data('pageInfo', pageInfo)
    }

    getRowKeyField() {
        return this._get_data('rowKeyField')
    }

    isRemote() {
        return this._get_data('dataSourceMode') === 'remote'
    }

    getReadOnly() {
        return !!this._get_data('readOnly')
    }

    setReadOnly(readOnly) {
        this._applyState('readOnly', !!readOnly)
    }

    setShowCheckbox(value) {
        this._applyState('showCheckBox', !!value)
    }

    setShowRowNo(value) {
        this._applyState('showRowNo', !!value)
    }
    getParams() {
        return { ...(this.get('cParams') || {}), ...(this._get_data('params') || {}) }
    }

    setParams(params) {
        this._set_data('params', params || {})
    }

    getInnerUsedAttrs(name) {
        const o = this._get_data('innerUsedAttrs')
        if (!name) {
            return o
        }
        return o[name]
    }

    getId() {
        return this.getInnerUsedAttrs('id')
    }

    setDataSource(proxyConfig, queryParams = {}, callback) {
        if (this._get_data('dataSourceMode') === 'local') {
            const data = isArray(proxyConfig) ? proxyConfig : []
            _setData.call(this, data)
        } else {
            if (!this.execute('beforeProxyLoad', queryParams)) {
                return
            }
            this.setPageIndex(1)
            _getData.call(this, proxyConfig, queryParams, (data) => {
                _setData.call(this, data)
                callback?.call(this)
            })
        }
    }

    reloadData() {
        const proxyCache = this.getCache('proxyCache')
        if (!proxyCache) {
            isDebug() && console.log('[devfab][GridModel] proxyConfig is null')
            return
        }
        const { proxyConfig, params: queryParams, callback } = proxyCache
        _getData.call(this, proxyConfig, queryParams, (data) => {
            callback?.call(this, data)
        })
    }

    getDataSource() {
        const source = this._get_data('dataSource') || []
        return source
    }

    getData(view) {
        const rows = view ? this._get_data('rows') : this._get_data('dataSource')
        return rows
    }

    getAllData() {
        return this.getData(true)
    }

    clear() {
        this._set_data('dataSource', [], true)
        this._set_data('rows', [], true)
    }

    getPageInfo() {
        return this._get_data('pageInfo')
    }

    getPageIndex() {
        const pageIndexField = this._get_data('innerUsedAttrs').pageIndex
        return this.getPageInfo()[pageIndexField]
    }

    getPageSize() {
        const pageSizeField = this._get_data('innerUsedAttrs').pageSize
        return this.getPageInfo()[pageSizeField]
    }

    getTotalCount() {
        const totalField = this._get_data('innerUsedAttrs').pageCount
        return this.getPageInfo()[totalField]
    }

    setPageInfo(pageInfo) {
        const _pageInfo = this.getPageInfo()
        this._set_data('pageInfo', { ..._pageInfo, ...pageInfo })
        this.reloadData()
    }

    setPageIndex(pageIndex) {
        if (typeof pageIndex !== 'number') {
            return
        }
        const pageIndexField = this._get_data('innerUsedAttrs').pageIndex
        this._set_data('pageInfo', { ...this.getPageInfo(), [pageIndexField]: Math.max(1, pageIndex) })
    }

    setPageSize(pageSize) {
        if (typeof pageSize !== 'number') {
            return
        }
        const pageIndexField = this._get_data('innerUsedAttrs').pageIndex
        const pageSizeField = this._get_data('innerUsedAttrs').pageSize
        this._set_data('pageInfo', {
            ...this.getPageInfo(),
            [pageSizeField]: Math.max(-1, pageSize),
            [pageIndexField]: 1,
        })
    }

    setTotalCount(total) {
        const totalField = this._get_data('innerUsedAttrs').pageCount
        this.getPageInfo()[totalField] = total
    }
}

export default GridModel
