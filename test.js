const A = require('./lib/eq3device')

A.discover((device) => {
  device.on('disconnect', function() {
    console.log('got disconnected!');
  })

  console.log('discovered', device)
  device.connectAndSetup()
  .then(() => {
    console.log('connected', device)
    setInterval(() => {
      device.getInfo()
      .then(a => {
        console.log(a)
      })
    }, 2000)
  })
})
