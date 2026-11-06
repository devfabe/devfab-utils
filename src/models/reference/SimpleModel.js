import BaseModel from './BaseModel'

export default class SimpleModel extends BaseModel {
    modelType = 'SimpleModel'
    getDisabled() {
        return this.getState('disabled')
    }

    setDisabled(value, ctrlName) {
        this._applyState('disabled', value, ctrlName)
    }

    getReadonly() {
        return this.getState('readonly')
    }

    setReadonly(value, ctrlName) {
        this._applyState('readonly', value, ctrlName)
    }
}
