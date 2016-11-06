'use strict'

const noble = require('noble')
const eq3BleDevice = require('./lib/eq3BleDevice')
const devices = {}


module.exports = function(RED) {
  RED.httpNode.get('/eq3', function(req,res) {
    res.send(Object.keys(devices))
  });

  noble.on('stateChange', (state) => {
    if (state === 'poweredOn') {
      noble.startScanning()

      setTimeout(() => {
        noble.stopScanning()
      },60000)
    }
  })

  noble.on('discover', (peripheral) => {
    if(peripheral.advertisement.localName=="CC-RT-BLE")
    {
      devices[peripheral.id] = new eq3BleDevice(peripheral)
    }
  })

  function eq3in(config) {
    var node = this;
    RED.nodes.createNode(this, config);
    this.serverConfig = RED.nodes.getNode(config.server);

    setInterval(() => {
      node.eq3BleDevice = devices[config.eq3devicein]
      if(this.eq3BleDevice) {
        node.status({fill:"green",shape:"ring",text:"connected"});
      } else {
        node.status({fill:"red",shape:"ring",text:"disconnected"});
      }
    }, 2000)


    node.on('input', function(msg) {
      if(msg.payload.targetTemperature) {
        this.eq3BleDevice.setTargetTemperature(msg.payload.targetTemperature)
      }
      if(msg.payload.targetHeatingCoolingState) {
        this.eq3BleDevice.setTargetHeatingCoolingState(msg.payload.targetHeatingCoolingState)
      }
      if(msg.payload.refreshDevice) {
        this.eq3BleDevice.refreshDevice()
      }
    })
  }
  RED.nodes.registerType("eq3-bluetooth in", eq3in);

  function eq3out(config) {
    var node = this;
    RED.nodes.createNode(this, config);
    this.serverConfig = RED.nodes.getNode(config.server);
    this.eq3BleDeviceId = config.eq3deviceout

    setInterval(() => {
      node.eq3BleDevice = devices[node.eq3BleDeviceId]

      if(this.eq3BleDevice) {
        node.status({fill:"green",shape:"ring",text:"found"});
      } else {
        node.status({fill:"red",shape:"ring",text:"not found"});
      }
    }, 2000)

    node.on('input', function(msg) {
      node.eq3BleDevice.getData((data) => {
        msg.payload = data
        node.send(msg)
      })
    });
  }
  RED.nodes.registerType("eq3-bluetooth out", eq3out);
}
