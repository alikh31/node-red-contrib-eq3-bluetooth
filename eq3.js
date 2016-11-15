'use strict'

const eq3device = require('./lib/eq3device')
const devices = {}


module.exports = function(RED) {
  RED.httpNode.get('/eq3', function(req,res) {
    res.send(Object.keys(devices))
  });

  eq3device.discover((device) => {
    device.connectAndSetUp()
    .then(() => {
      devices[device.id] = device
    })
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
    }, 10000)


    node.on('input', function(msg) {
      if(msg.payload.targetTemperature) {
        this.eq3BleDevice.setTemperature(msg.payload.targetTemperature)
      }
      if(msg.payload.targetHeatingCoolingState) {
        if (msg.payload.targetHeatingCoolingState === 0)
          this.eq3BleDevice.turnOn()
        if (msg.payload.targetHeatingCoolingState === 1)
          this.eq3BleDevice.turnOff()
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
      node.eq3BleDevice.getInfo((data) => {
        msg.payload = data
        node.send(msg)
      })
    });
  }
  RED.nodes.registerType("eq3-bluetooth out", eq3out);
}
