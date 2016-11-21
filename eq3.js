'use strict'

const eq3device = require('./lib/eq3device')

module.exports = function(RED) {
  function eq3(config) {
    var node = this;
    RED.nodes.createNode(this, config);
    this.serverConfig = RED.nodes.getNode(config.server);
    eq3device.discoverByAddress(config.eq3device ,function(device) {
      node.device = device
    })

    setInterval(() => {
      if(node.device) {
        node.status({fill:"green",shape:"ring",text:"connected"});
      } else {
        node.status({fill:"red",shape:"ring",text:"disconnected"});
      }
    }, 10000)

    node.on('input', function(msg) {
      var device = node.device
      var setCommand = function() {
        setTimeout(() => {
          device.getInfo()
          .then(a => {
            msg.payload = a
            node.send(msg)
          })
        }, 2000)

        if (typeof msg.payload !== 'object') return

        switch (msg.payload.setState) {
          case 'on':
            device.turnOn()
            break;
          case 'off':
            device.turnOff()
            break;

          case 'manual':
            device.manualMode()
            break;

          case 'auto':
            device.automaticMode()
            break;
          default:
            break;
        }

        switch (msg.payload.boost) {
          case '0':
            device.setBoost(false)
            break;
          case '1':
            device.setBoost(true)
            break;

          default:
            break;
        }

        console.log(msg.payload.setTemperature)
        if (msg.payload.setTemperature)
          device.setTemperature(msg.payload.setTemperature)
      }

      if(!node.device.connectedAndSetUp)
        node.device.connectAndSetup()
        .then(() => setCommand())
      else
        setCommand()
    });
  }
  RED.nodes.registerType("eq3-bluetooth", eq3);
}
