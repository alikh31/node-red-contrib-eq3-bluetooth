# node-red-contrib-eq3-bluetooth

node-red binding to bluetooth eq3 radiator valves without Max! Cube

## How it works

Every eq3-bluetooth has an bluetooth address which can be extracted by searching bluetooth devices when the device is on and basic set up is passed. After installation the valve you need to do the basic configuration on the device itself (colibration set time and date, ...) then the bluetooth should be visible.

Alternatively on your node-red installed device first make sure you your bluetooth is up and running then create an node-red-contrib-eq3-bluetooth node in your flow and connect it to an inject node after deploying the flow you can send any message to node-red-contrib-eq3-bluetooth and in responce you receive the device is not found in your debugger window and after a while you see the list of available eq3-bluetooth addresses you can pick one and put it in the configuration of your node-red-contrib-eq3-bluetooth node.

after this you can start with basic operations:

  - send {payload: {setState: 'on'}} : turns the valve full open
  - send {payload: {setState: 'off'}} : turns the valve full closed
  - send {payload: {setState: 'manual'}} : set manual mode
  - send {payload: {setState: 'auto'}} : set automatic mode

  
  - send {payload: {boost: '0'}} : keep the valve open for 30 minutes
  - send {payload: {boost: '0'}} : cancel boost mode

  - send {payload: {setTemperature: '10'}} : set the manual temperature to 10 degrees, 

In case of sending any payload (including above commands) to the node after 2 second node will send current status of the eq3-bluetooth to output.
