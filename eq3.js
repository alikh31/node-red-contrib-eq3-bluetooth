'use strict'

const eq3device = require('./lib/eq3device')

module.exports = function(RED) {
  function eq3(config) {
    var node = this;
    RED.nodes.createNode(this, config);
    this.serverConfig = RED.nodes.getNode(config.server);
    node.device = global[config.eq3device]

    if (!node.device) {
      eq3device.discoverByAddress(config.eq3device ,function(device) {
        node.device = device
        global[config.eq3device] = device
      })
    }

    node.intervalId = setInterval(() => {
      if(node.device) {
        node.status({fill:"green",shape:"ring",text:"connected"});
      } else {
        node.status({fill:"red",shape:"ring",text:"disconnected"});
      }
    }, 10000)

    node.on('close', function(done) {
      clearInterval(node.intervalId)
      done()
    })

    node.on('input', function(msg) {
      node.setCommand = function() {
        setTimeout(() => {
          node.device.getInfo()
          .then(a => {
            msg.payload = a
            node.send(msg)
          })
        }, 2000)

        if (typeof msg.payload !== 'object') return

        switch (msg.payload.setState) {
          case 'on':
            node.device.turnOn()
            break;
          case 'off':
            node.device.turnOff()
            break;

          case 'manual':
            node.device.manualMode()
            break;

          case 'auto':
            node.device.automaticMode()
            break;
          default:
            break;
        }

        switch (msg.payload.boost) {
          case '0':
            node.device.setBoost(false)
            break;
          case '1':
            node.device.setBoost(true)
            break;

          default:
            break;
        }

        if (msg.payload.setTemperature)
          node.device.setTemperature(msg.payload.setTemperature)
      }

      if(!node.device.connectedAndSetUp)
        node.device.connectAndSetup()
        .then(() => node.setCommand())
      else
        node.setCommand()
    });
  }
  RED.nodes.registerType("eq3-bluetooth", eq3);
}
