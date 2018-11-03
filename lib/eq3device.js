'use strict'

const eq3interface = require('./eq3interface');
const NobleDevice = require('noble-device');

let EQ3BLE = function(device) {
  NobleDevice.call(this, device)
  this.notificationCallbacks = []
}

EQ3BLE.is = function(peripheral) {
  var res = (peripheral.advertisement.localName === 'CC-RT-BLE')||(peripheral.advertisement.localName === 'CC-RT-M-BLE'); 
  return res;
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

EQ3BLE.prototype.connectAndSetup = function() {
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


// ALL sends now result in a parsed response.
// al pafrsed responses include 'raw' for diagnostic purposes
// possible responses:
// 00 => { unknown:true,  raw: }
// 01 => { sysinfo:{ ver:,type: },raw: }
// 02 01 => { raw:, status: { manual:,holiday:,boost:,lock:,dst:,openWindow:,lowBattery:,valvePosition,targetTemperature,ecotime: <Date if in holiday mode>,},
//   valvePosition,targetTemperature } (last two for legacy use)
// 02 02 => { raw:, dayresponse:{ day:<day 0=sat>} }
// 02 80 => { raw:, ok:true }
// 04 => { raw:, timerequest:true }
// 21 => { raw:, dayschedule: { day:<day 0=sat>, segments:[7 x {temp:<temp>, endtime:{ hour:<hour>, min:<min>}}, ...]}}
// A0 -> { firwareupdate:true, raw:info }
// A1 -> { firwareupdate:true, raw:info }

// this sets the date; else the date can get set to old data in the buffer!!!
EQ3BLE.prototype.getInfo = function() {
  return this.writeAndGetNotification(eq3interface.payload.setDatetime(new Date()))
  .then(info => eq3interface.parseInfo(info), err => {return { error: err }});
}
// gets version, returns 01 resp
EQ3BLE.prototype.getSysInfo = function() {
  return this.writeAndGetNotification(eq3interface.payload.getSysInfo())
  .then(info => eq3interface.parseInfo(info), err => {return { error: err }});
}
EQ3BLE.prototype.setBoost = function(enable) {
  if (enable) {
    return this.writeAndGetNotification(eq3interface.payload.activateBoostmode())
    .then(info => eq3interface.parseInfo(info), err => {return { error: err }});
  }
  return this.writeAndGetNotification(eq3interface.payload.deactivateBoostmode())
  .then(info => eq3interface.parseInfo(info), err => {return { error: err }});
}
EQ3BLE.prototype.automaticMode = function() {
  return this.writeAndGetNotification(eq3interface.payload.setAutomaticMode())
  .then(info => eq3interface.parseInfo(info), err => {return { error: err }});
}
EQ3BLE.prototype.manualMode = function() {
  return this.writeAndGetNotification(eq3interface.payload.setManualMode())
  .then(info => eq3interface.parseInfo(info), err => {return { error: err }});
}

// sending ecoMode() empty just turns on holiday mode (holiday+manual).
// sending with just temp ecoMode(12) turns on holiday mode, returns a time? (now+1day?)
// - bad news, old data!
// sending with empty temp and date ecoMode(0, date) turns on holiday mode (holiday+manual), 
//  but does not return a date (same as ecoMode()?)
// I think if the command is 'short', it can use bytes from the last command instead!!!
// so, always do ecoMode() or ecoMode(temp, date)
EQ3BLE.prototype.ecoMode = function(temp, date) {
  return this.writeAndGetNotification(eq3interface.payload.setEcoMode(temp, date))
  .then(info => eq3interface.parseInfo(info), err => {return { error: err }});
}
EQ3BLE.prototype.setLock = function(enable) {
  if (enable) {
    return this.writeAndGetNotification(eq3interface.payload.lockThermostat())
    .then(info => eq3interface.parseInfo(info), err => {return { error: err }});
  }
  return this.writeAndGetNotification(eq3interface.payload.unlockThermostat())
  .then(info => eq3interface.parseInfo(info), err => {return { error: err }});
}
EQ3BLE.prototype.turnOff = function() {
  return this.setTemperature(4.5)
  .then(info => eq3interface.parseInfo(info), err => {return { error: err }});
}
EQ3BLE.prototype.turnOn = function() {
  return this.setTemperature(30)
  .then(info => eq3interface.parseInfo(info), err => {return { error: err }});
}
EQ3BLE.prototype.setTemperature = function(temperature) {
  return this.writeAndGetNotification(eq3interface.payload.setTemperature(temperature))
  .then(info => eq3interface.parseInfo(info), err => {return { error: err }});
}

// +-7 degrees
EQ3BLE.prototype.setTemperatureOffset = function(offset) {
  return this.writeAndGetNotification(eq3interface.payload.setTemperatureOffset(offset))
  .then(info => eq3interface.parseInfo(info), err => {return { error: err }});
}

// duration in minutes
EQ3BLE.prototype.updateOpenWindowConfiguration = function(temperature, duration) {
  return this.writeAndGetNotification(eq3interface.payload.setWindowOpen(temperature, duration))
  .then(info => eq3interface.parseInfo(info), err => {return { error: err }});
}

// set date and return status
EQ3BLE.prototype.setDateTime = function(date) {
  return this.writeAndGetNotification(eq3interface.payload.setDatetime(date))
  .then(info => eq3interface.parseInfo(info), err => {return { error: err }});
}

// schedule functions
// retrieve schedule for a day, where day=0 = saturday
// responds with 21 (see above) day like below (setDay)
EQ3BLE.prototype.getDay = function(day) {
  return this.writeAndGetNotification(eq3interface.payload.getDay(day))
  .then(info => eq3interface.parseInfo(info), err => {return { error: err }});
}

// set schedule for a day
// day is { day: <daynum, 0=sat>, segments:[7 x {temp:<temp>, endtime:{ hour:<hour>, min:<min>}}, ...]}
// responds 02 02 (see top)
EQ3BLE.prototype.setDay = function(day) {
  return this.writeAndGetNotification(eq3interface.payload.setDay(day))
  .then(info => eq3interface.parseInfo(info), err => {return { error: err }});
}

module.exports = EQ3BLE
