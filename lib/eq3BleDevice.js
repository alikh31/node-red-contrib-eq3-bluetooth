function eq3BleDevice(device) {
  this.device = device
  this.name = device.address
  this.temperature = -1
  this.targetTemperature = 19
  this.heatingCoolingState = 'HEAT'
  this.targetHeatingCoolingState = 'AUTO'
  this.temperatureDisplayUnits = 'CELSIUS'
  this.command = new Buffer('03', 'hex')
  this.refreshing = 0
  this.initDevice()
}

eq3BleDevice.prototype = {
  initDevice: function() {
    var that = this
    this.device.on('connect', () => {
      that.device.writeHandle(0x0411, that.command, false)
    })

    this.device.on('handleNotify', that.readValues.bind(this))
    this.device.connect()
  },
  readValues: function(handle,value) {
    var that = this
    if(value[2] == 8 && value[5] != 9)
    {
      that.targetTemperature = value[5]/2
      that.temperature = value[5]/2
      that.targetHeatingCoolingState = 'AUTO'
      that.heatingCoolingState = 'HEAT'
    }
    if(value[2] == 9) // manual
    {
      that.targetTemperature = value[5]/2
      that.temperature = value[5]/2
      that.targetHeatingCoolingState = 'HEAT'
      that.heatingCoolingState = 'HEAT'
    }
    if(value[5] == 9) // off
    {
      that.targetHeatingCoolingState = 'OFF'
      that.heatingCoolingState = 'OFF'
    }
    //console.log(value) -- debug
    that.device.disconnect()
    that.refreshing=0
  },
  refreshDevice: function() {
    if(this.refreshing==0)
    {
      this.refreshing=1
      this.command = new Buffer('03', 'hex')
      this.device.connect()
    }
  },
  setTargetHeatingCoolingState: function(value,callback) {
    var that = this
    if(value == 0)
    {
      this.command = new Buffer('4109', 'hex')
      this.device.connect()
      this.targetHeatingCoolingState = 'OFF'
      this.heatingCoolingState = 'OFF'
    }
    else if(value == 1)
    {
      this.command = new Buffer('43', 'hex') // day mode
      this.device.connect()
      setTimeout(() => {
          that.command = new Buffer('4040', 'hex') // manual mode
          that.device.connect()
      }, 5000)
      this.targetHeatingCoolingState = 1
    }
    else if(value == 2)
    {
      this.command = new Buffer('44', 'hex') // night mode
      this.device.connect()
      setTimeout(function() {
          that.command = new Buffer('4040', 'hex') // manual mode
          that.device.connect()
      }, 5000)
      this.device.connect()

      this.targetHeatingCoolingState = 2
    }
    else if(value == 3)
    {
      this.command = new Buffer('4000', 'hex') // auto mode
      this.device.connect()
      this.targetHeatingCoolingState = 'AUTO'
      this.heatingCoolingState = 'HEAT'
    }
    callback(value)
  },
  getCurrentTemperature: function(callback) {
    this.refreshDevice()
    callback(this.temperature)
  },
  getTargetTemperature: function(callback) {
    this.refreshDevice()
    callback(this.targetTemperature)
  },
  getTemperatureDisplayUnits: function(callback) {
    var error = null
    callback(error, this.temperatureDisplayUnits)
  },
  getCurrentHeatingCoolingState: function(callback) {
    this.refreshDevice()
    callback(this.heatingCoolingState)
  },
  getTargetHeatingCoolingState: function(callback) {
    this.refreshDevice()
    callback(this.targetHeatingCoolingState)
  },
  getData: function(callback) {
    this.refreshDevice()
    callback({
      temperature: this.temperature,
      targetTemperature: this.targetTemperature,
      temperatureDisplayUnits: this.temperatureDisplayUnits,
      heatingCoolingState: this.heatingCoolingState,
      targetHeatingCoolingState: this.targetHeatingCoolingState
    })
  },
  setTargetTemperature: function(value, callback) {
    var that = this
    this.targetTemperature = value
    setTimeout(() => {
      if(that.targetTemperature != that.temperature)
      {
        that.temperature=that.targetTemperature
        that.command = new Buffer([0x41,that.targetTemperature*2])
        that.device.connect()
      }
    }, 3000)
    callback(this.temperature)
  }
}

module.exports = eq3BleDevice
