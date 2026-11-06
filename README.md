# @devfab/utils

面向前端（浏览器）的通用工具集：**AJAX 请求代理**、**事件总线**、**缓存容器**、**DSL 渲染构建器**、**领域模型体系**（Model / ViewModel / GridModel）。

- **零第三方运行时依赖**：只用 `XMLHttpRequest`、`Map`、`Promise`、`crypto.subtle` 等原生能力。
- **浏览器环境专用**：内部直接使用 `window` / `document` / `location`，不适合 Node 或 SSR 场景。
- **开箱即用**：每个模块都提供 `.create()` 工厂，不强制 `new`。

---

## 安装

```bash
pnpm add @devfab/utils
# 或 npm i @devfab/utils
```

## 引入

包只提供**默认导出**（没有命名导出），按需解构：

```js
import utils from '@devfab/utils'

const { Ajax, Event, Cache, Builder, models } = utils
```

| 导出项     | 类型     | 说明                                       |
| ---------- | -------- | ------------------------------------------ |
| `Ajax`     | `class`  | 请求代理工厂（内部封装 XMLHttpRequest）    |
| `Event`    | `class`  | 事件总线，支持异步串行与中断                |
| `Cache`    | `class`  | 键值缓存容器                                |
| `Builder`  | `class`  | 配置 → 渲染节点（VNode）的构建器            |
| `models`   | `object` | 领域模型集合，见「models」一节              |

---

## Ajax

`utils.Ajax` 其实是 `DynamicProxy`：把一份「接口配置表」变成一个对象，配置里的每个 key 自动变成方法。

```js
const ajax = Ajax.create(
    {
        queryList: {
            url: '/api/list',
            method: 'GET',
            options: { contentType: 'application/json' },
        },
        saveBill: {
            url: '/api/save',
            method: 'POST',
        },
    },
    { serviceCode: 'hr' } // 公共查询参数，会被拼到 url 上
)

ajax.queryList({ page: 1 }, (err, data) => {
    if (err) return
    console.log(data)
})

// 同步请求（仅配置了 async:false 语义时可用）
const res = ajax.saveBillSync({ name: 'a' }) // → { result } | { error }
```

> 同步 XHR 在主线程已不被浏览器推荐（控制台会给出警告），除兼容老代码外请优先用异步回调。

### API

| 方法                                | 说明                                                       |
| ----------------------------------- | ---------------------------------------------------------- |
| `Ajax.create(config, queryParams?)` | 创建代理实例                                                |
| `instance[接口名](data, callback, context?)`     | 异步调用，`data` 为入参                         |
| `instance[接口名 + 'Sync'](data)`   | 同步调用，返回 `{ result }` 或 `{ error }`                  |
| `instance.Do(op, data, callback, async, context?)` | 底层分发，一般不用直接调         |

**接口配置项**：`url`（必填）、`method`（默认 `GET`）、`options`（透传给请求层）。

`options` 常用字段：

| 字段              | 说明                                                             |
| ----------------- | ---------------------------------------------------------------- |
| `params`          | 请求参数；`GET`/`DELETE` 拼到 url，`POST`/`PUT` 转 JSON body       |
| `requestHeaders`  | 请求头对象，逐项 `setRequestHeader`                               |
| `contentType`     | 设 `Content-Type`；含 `x-www-form-urlencoded` 时自动 `URLSearchParams` 序列化 |
| `timeout`         | 超时毫秒数，超时走 `onAfterRequest` 的错误分支                     |
| `async`           | 默认 `true`，`false` 时走同步请求                                  |
| `withCredentials` | 默认 `true`                                                        |
| `jsonp`           | 走 JSONP（会创建 `<script>` 并回调 `callback`）                    |
| `responseType`    | 设 `blob` 时返回 `{ code, data: { data, headers } }`               |
| `onBeforeRequest` | `(xhr, body) => void`，`send` 前调用                               |
| `onAfterRequest`  | `(ajaxResult) => void`，成功/失败都会调用                          |
| `callback`        | 回调函数，签名见下                                                 |
| `context`         | 回调 `this`                                                        |

**回调约定**（与后端 `{ code, data, message, errorDetail }` 结构对应）：

```js
function callback(err, data, message, errorDetail, code, ajaxResult) {}
```

- 成功：`callback.call(context, null, ajaxResult.data, message, errorDetail, 200, ...)`
- 失败：`callback.call(context, ajaxResult)`，第一个参数即错误对象
- 断网、超时、`401`、`502`、`504` 这类没有业务响应体的错误，会上报固定英文提示并包装成 `{ code: 500, message }`；其它状态码优先取响应体里的 `code` / `message`，解析失败时退化为 `{ code: xhr.status, message: responseText }`

---

## Event

事件总线，支持**顺序阻断**（回调返回 `false` 即中断后续回调）和**异步串行执行**。

```js
const bus = Event.create() // 默认 __ASYNC_EXECUTE__: true

bus.on('beforeSave', (data) => {
    if (!data.name) return false // 阻断
})

bus.onFirst('beforeSave', () => {
    // onFirst 注册的回调排在最前面
})

bus.execute('beforeSave', { name: 'a' }) // → true | false
```

### API

| 方法                                    | 说明                                                       |
| --------------------------------------- | ---------------------------------------------------------- |
| `new Event({ __ASYNC_EXECUTE__ })` / `Event.create(args?)` | 创建；`__ASYNC_EXECUTE__` 默认 `true`      |
| `on(name, callback, context?)`          | 追加监听                                                    |
| `onFirst(name, callback, context?)`     | 插到队首（先于所有 `on` 注册的回调执行）                    |
| `execute(name, ...args)`                | 依次执行，任一返回 `false` 即中断，返回整体结果              |
| `fireEvent(name, args)`                 | 依次触发 `before{name}` → `name` → `after{name}`，`before` 返回假值则整体跳过 |
| `promiseExecute(...)`                   | 链式/异步执行，见下                                         |
| `un(name, callback?)`                   | 移除指定回调；不传 `callback` 则清空该事件                  |
| `hasEvent(name)`                        | 返回该事件下注册的回调数量                                  |
| `clear()`                               | 清空全部事件                                                |

`promiseExecute` 支持三种形态：

```js
bus.promiseExecute('eventName', arg1, arg2, callback)              // 事件名 + 业务参数 + 回调
bus.promiseExecute('eventName', arg1, [onOk, onFail])              // 成功/失败双回调
bus.promiseExecute(true, 'eventName', arg1, callback)              // check 为布尔：前置开关语义
```

回调返回 `Promise` 时会挂上 `callbacks`，串行执行完再 resolve/reject；`__ASYNC_EXECUTE__: false` 时退化为同步执行 + `then` 桥接。

---

## Cache

最简键值容器，`Model` 内部也用它存 `name` / `parent` 等元信息。

```js
const cache = new Cache({ a: 1 })
cache.set('b', 2)
cache.get('a') // 1
cache.delete('b')
cache.clear()
```

| 方法           | 说明             |
| -------------- | ---------------- |
| `set(key, val)` | 写入             |
| `get(key)`      | 读取             |
| `delete(key)`   | 删除             |
| `clear()`       | 清空             |

> `Cache.create(args)` 只做 `new Cache()`，**不会带入初始值**；需要初始值请用 `new Cache(initial)`。

---

## Builder

把「组件配置树」递归转换成一棵可渲染的节点树，组件从注册表里按名字取，找不到时可以兜底走 `renderFactory`。

```js
const builder = Builder.create()
builder.init({ components: { Input, Button } })

const nodes = builder.render([
    { component: 'Input', value: 'a' },
    { component: 'Button', children: [{ component: 'Input' }] },
])
```

### API

| 方法                                          | 说明                                                   |
| --------------------------------------------- | ------------------------------------------------------ |
| `Builder.create()`                            | 创建空实例（构造函数不处理入参，配置请走 `init`）       |
| `init({ components, renderFactory, componentFactory, ... })` | 一次性初始化（也可分别调下面三个 init） |
| `initComponent(name, comp?)`                  | 注册组件：支持 `name` 字符串 + 组件、组件对象、返回对象的函数 |
| `getComponent(name)` / `hasComponent(name)`   | 取/判断组件                                             |
| `getComponents()`                             | 取全部组件的浅拷贝                                      |
| `initRenderFactory(fn)`                       | 默认渲染工厂 `({ node, props }) => VNode`               |
| `initComponentFactory(fn)`                    | 按配置动态决定组件 `(item) => Component`                |
| `render(config, extraConfig?)`                | 渲染，`config` 可为单个对象或数组，返回节点数组          |
| `clear()`                                     | 清空组件与工厂                                          |

关键可配置字段：

| 字段             | 默认值       | 说明                                        |
| ---------------- | ------------ | ------------------------------------------- |
| `componentField` | `['component']` | 从配置里取组件名的字段名（可配别名列表）    |
| `childrenField`  | `['children']`  | 子节点字段名，允许多个，按顺序拼进 `children` |

渲染优先级：配置自带 `render` → `renderFactory` → 直接输出 `{ component, children, ...props }` 结构。`extraConfig.props` 会与节点 `meta` 合并后一起传给渲染函数。

---

## models

领域模型体系，核心是「模型持有数据 + 数据变化通知绑定的组件」。

```js
import utils from '@devfab/utils'
const { models } = utils

const field = new models.SimpleModel({ cName: 'title', value: 'hi' })
field.on('afterValueChange', ({ value, oldValue }) => {
    console.log(oldValue, '→', value)
})
field.setValue('hello', true) // 第二个参数 fireEvent 决定是否触发 before/afterValueChange
```

### 导出项

| 成员             | 说明                                                     |
| ---------------- | -------------------------------------------------------- |
| `BaseModel`      | 基础模型：数据容器 + 状态联动 + 事件 + 缓存 + 请求代理    |
| `SimpleModel`    | 单值模型，补充 `readonly` 状态                            |
| `ViewModel`      | 模型容器，管理一组子模型（通常对应一张单据/一个页面）     |
| `GridModel`      | 表格模型：列、数据源、分页、脏数据                        |
| `initViewModel`  | 由 meta 配置化创建 ViewModel 的工厂（含扩展脚本加载）     |
| `loadScripts`    | 扩展脚本加载器（依赖外部传入的 `fileRequire.inject`）     |

### BaseModel

**数据容器**（`_` 前缀为内部方法，一般用公开 API）

| 成员                        | 说明                                             |
| --------------------------- | ------------------------------------------------ |
| `get(name)`                 | 读取任意字段                                      |
| `getData()` / `getValue()`  | 取 `value`                                        |
| `setValue(value, fireEvent?, ctrlName?)` | 写值；`fireEvent` 为真时走 `beforeValueChange` / `afterValueChange`，可被事件阻断回滚 |

**状态联动**

| 成员                              | 说明                                                        |
| --------------------------------- | ----------------------------------------------------------- |
| `getState(name, ctrlName?)`       | 取状态；给 `ctrlName` 时优先问对应组件要                     |
| `setState(name, value, ctrlName?)`| 写状态并广播：组件有 `setState` 就调它，否则整条链路跳过      |
| `getVisible/setVisible`           | `visible` 状态                                              |
| `getDisabled/setDisabled`         | `disabled` 状态                                             |
| `addComponent(component, ctrlName?)` / `removeComponent(component)` | 绑定/解绑组件             |

`setVisible` / `setDisabled` 走 `_applyState`：先写值，再按 `setXxx` 名字找组件的同名方法；没命中的组件统一兜底收到 `setState({ xxx: value })`。

**脏数据**：`setDirty(bool)` 打脏标记或重置基线；`getDirtyData(necessary?)` 取有变化的数据（`necessary !== false` 且已打脏时直接返回当前值）。

**其他**：`on/onFirst/un/execute/fireEvent/hasEvent`（内部事件总线）、`setCache/getCache/clearCache`、`setName/getName`、`setParent/getParent/getRootParent`、`clear(useDefault?)`。

**请求代理**：`setProxy(config)` 传配置对象时，会为每个接口补上 `__requestHeaders__` 并返回一个 `Ajax` 实例（可用 `getProxy()` 取回）；直接传 `Ajax` 实例则原样挂载。

### ViewModel

| 成员                            | 说明                                                     |
| ------------------------------- | -------------------------------------------------------- |
| `set(name, value)`              | 挂子模型；若 `value` 是 `BaseModel`，自动 `setParent` + `setName` |
| `setData(data)` / `addProperty(name, value)` | 批量/单个挂载，已有子模型时递归 `setData`    |
| `getData()`                     | 只收集 `needCollect !== false` 的子模型数据（递归）       |
| `getAllData(withOutGrid?)`      | 同上，额外可跳过表格模型                                 |
| `removeProperty(name)`          | 移除属性                                                 |
| `loadData(data)`                | 清空后整体灌入（内部会临时打开 `isLoadData` 标记）         |
| `setParams/getParams`           | 页面参数                                                 |
| `getGridModel(name?)` / `getGridModels()` / `getGridFilterModel(name?)` | 取表格模型及其过滤模型 |
| `destroyVM()`                   | 清空事件、缓存、子模型                                   |
| `ViewModel.init(meta, params, callback)` | 配置化创建，等价于 `initViewModel`                |

**`initViewModel(meta, params, callback)` 的流程**：`onBeforeInitModel` → 按 `meta.models[].cName`（字段名可用 `params.modelNameField` 改）逐个 `createModelFactory` → `setData` → `setDirty(false)` → `initData()` 调 `initExtendScripts` 加载扩展脚本 → 加载完触发 `extendReady` → `afterVMInit` → 在回调里再执行 `initExtScripts` → 最终 `callback(vm, meta)`。整个过程同时监听 `destroyVM` 事件做销毁。

可传入的 `params` 钩子：`onBeforeInitModel({ model, meta, childModel, modelName })`、`onAfterInitModel(param)`、`createModelFactory(field, params)`、`initData`、`models`（替换默认模型类）、`fileRequire`、`extendScriptParams`。

### GridModel

```js
const grid = new models.GridModel({
    columns: [{ field: 'name', label: '姓名' }],
    dataSourceMode: 'local', // local | remote
    pagination: true,
    page: { pageSize: 20 },
})

grid.setDataSource([{ id: 1, name: 'a' }]) // local 模式直接灌数据
grid.setDataSource({ url: '/api/list' }, { keyword: 'a' }) // remote 模式走代理
```

**列**：`columns` 支持数组或对象，自动归一为 `{ field, label, index, ... }`；`field` 缺省依次取 `cFieldName` / `cName` / `col_下标`，`label` 缺省依次取 `title` / `cCaption` / `field`。

**数据源**：`dataSourceMode` 为 `remote` 时，`setDataSource(proxyConfig, queryParams?, callback?)` 会经 `setProxy({ queryData: proxyConfig })` 发请求，`resolveRowsData` 兼容 `data / records / list / rows / result.data` 等多种返回结构；查询过程可被 `beforeQuery` / `beforeQueryData` / `afterQueryData` 拦截。

**分页**：`pageInfo` 的字段名可配（`innerUsedAttrs`：`pageNo` / `pageSize` / `total`）；`setPageIndex`、`setPageSize`、`setPageInfo`、`setTotalCount`、`getPageIndex`、`getPageSize`、`getTotalCount`；`pagination: false` 时页码置 `-1`。

**其他**：`getData(view?)`（`view` 取 `rows`）、`getAllData()`、`getRowKeyField()`、`isRemote()`、`getReadOnly/setReadOnly`、`setShowCheckbox`、`setShowRowNo`、`reloadData()`、`clear()`。

**行状态常量**：`GridModel` 源文件里导出了 `DataStates = { Unchanged: '', Insert: 'Insert', Update: 'Update', Delete: 'Delete' }`，但没有经 `models` 聚合导出；需要时按字符串常量使用，或在 `src/index.js` 补一行导出。

---

## 内部工具（未从入口导出）

`src/string.js` 里的工具函数目前只在本包内部使用，**没有出现在包入口的导出里**。若要对外提供，需要在 `src/index.js` 补一行具名导出：

| 函数 | 说明 |
| ---- | ---- |
| `isDebug(debug?)` | 判断调试开关：入参为真或 `window.__devfab.debug` 为真 |
| `isEmpty(v)` / `isEmptyObject(v)` | `undefined` / `null` / `''` 判空；对象空判 |
| `QueryString(url)` | url 解析器：`get` / `set` / `del` / `has` / `toStr`，`pathname` + `query` |
| `equalsIgnoreCase(a, b)` | 忽略大小写比较（`Ajax` 判断 method 用它） |
| `_appendUrl(url, params)` | 把对象拼成 query string（已存在的 key 不覆盖） |
| `generateUID(code, name)` | 用 `SHA-256(code + name)` 生成十六进制串（依赖 `crypto.subtle`） |
| `base64` | `encode` / `decode`（基于 `btoa` / `atob`） |
| `pick(source, name, spec?)` | 按「规范名 → 别名列表」取值，空值自动跳到下一个别名 |
| `formatDate(date, pattern?)` | 支持 `YYYY` `MM` `DD` `HH` `mm` `ss` `SSS`，默认 `YYYY-MM-DD HH:mm:ss.SSS` |

另外 `src/scripts.js` 目前**没有任何文件引用**，且它 `import FileRequire from '../FileRequire/file'` 指向一个不存在的模块——一旦把它加进入口链，构建会直接报 `Could not resolve`。需要脚本加载能力时，请用 `models.loadScripts`（`src/models/_extend.js` 内已自带实现，只依赖外部传入的 `fileRequire.inject`）。

---

## 构建

```bash
# 在仓库根目录（rollup.config.js 所在层级）执行，会同时构建 vue-adapter 与 utils
npm run build    # 生产构建，terser 压缩
npm run dev      # 开发构建，不压缩
```

产物：

| 文件                | 格式 | 用途                        |
| ------------------- | ---- | --------------------------- |
| `dist/index.js`     | CJS  | Node / 旧构建工具           |
| `dist/index.esm.js` | ESM  | Webpack、Vite 等现代构建    |
| `dist/index.umd.js` | UMD  | `<script>` 直接引入，全局名 `devfab-utils` |

> `rollup.config.js` 只在仓库根目录有一份，子包内的 `npm run build` 会因找不到配置文件而失败；统一在根目录构建即可。

---

## License

ISC
