'use strict'

const eq3interface = require('./eq3interface');
const NobleDevice = require('noble-device');

let EQ3BLE = function(device) {
  NobleDevice.call(this, device)
  this.notificationCallbacks = []
}

EQ3BLE.is = function(peripheral) {
  return peripheral.advertisement.localName === 'CC-RT-BLE'
}

NobleDevice.Util.inherits(EQ3BLE, NobleDevice)

NobleDevice.Util.mixin(EQ3BLE, NobleDevice.BatteryService);
NobleDevice.Util.mixin(EQ3BLE, NobleDevice.DeviceInformationService);


EQ3BLE.prototype.onNotify = function() {
  const callback = this.notificationCallbacks.shift()
  if (!callback) {
    this.emit('unhandledNotification', arguments)
    return
  }
  callback.apply(this, arguments)
}

EQ3BLE.prototype.getNextNotification = function() {
  return new Promise((resolve, reject) => {
    let timeoutId
    let removeCallback
    const callback = (arg) => {
      console.log('-->>>', arguments)
      clearTimeout(timeoutId)
      removeCallback()
      resolve(arg)
    }
    removeCallback = () => {
      this.notificationCallbacks = this.notificationCallbacks.filter(cb => cb !== callback)
    }
    this.notificationCallbacks.push(callback)
    setTimeout(() => {
      removeCallback()
      reject()
    }, 1000)
  })
}
EQ3BLE.prototype.writeAndGetNotification = function(data) {
  return new Promise((resolve, reject) => {
    this.getNextNotification().then(resolve, reject)
    this.writeDataCharacteristic(eq3interface.serviceUuid, eq3interface.writeCharacteristic, data, (err) => {
      if (err) reject(err)
    })
  })
}

EQ3BLE.prototype.connectAndSetUp = function() {
  return new Promise((accept, reject) => {
    NobleDevice.prototype.connectAndSetup.call(this, (error) => {
      if (error) {
        reject(error)
        return
      }
      this.notifyCharacteristic(eq3interface.serviceUuid,
        eq3interface.notificationCharacteristic,
        true,
        this.onNotify.bind(this),
        (err) => {
          if (err) return reject(err)
          accept()
        })
    })
  })
}
EQ3BLE.prototype.getInfo = function() {
  return this.writeAndGetNotification(eq3interface.payload.getInfo())
  .then(info => eq3interface.parseInfo(info))
}
EQ3BLE.prototype.setBoost = function(enable) {
  if (enable) {
    return this.writeAndGetNotification(eq3interface.payload.activateBoostmode())
  }
  return this.writeAndGetNotification(eq3interface.payload.deactivateBoostmode())
}
EQ3BLE.prototype.automaticMode = function() {
  return this.writeAndGetNotification(eq3interface.payload.setAutomaticMode())
}
EQ3BLE.prototype.manualMode = function() {
  return this.writeAndGetNotification(eq3interface.payload.setManualMode())
}
EQ3BLE.prototype.ecoMode = function() {
  return this.writeAndGetNotification(eq3interface.payload.setEcoMode())
}
EQ3BLE.prototype.setLock = function(enable) {
  if (enable) {
    return this.writeAndGetNotification(eq3interface.payload.lockThermostat())
  }
  return this.writeAndGetNotification(eq3interface.payload.unlockThermostat())
}
EQ3BLE.prototype.turnOff = function() {
  return this.setTemperature(4.5)
}
EQ3BLE.prototype.turnOn = function() {
  return this.setTemperature(30)
}
EQ3BLE.prototype.setTemperature = function(temperature) {
  return this.writeAndGetNotification(eq3interface.payload.setTemperature(temperature))
}
EQ3BLE.prototype.setTemperatureOffset = function(offset) {
  return this.writeAndGetNotification(eq3interface.payload.setTemperatureOffset(offset))
}
EQ3BLE.prototype.updateOpenWindowConfiguration = function(temperature, duration) {
  return this.writeAndGetNotification(eq3interface.payload.setWindowOpen(temperature, duration))
}
EQ3BLE.prototype.setDateTime = function(date) {
  return this.writeAndGetNotification(eq3interface.payload.setDatetime(date))
}

module.exports = EQ3BLE
