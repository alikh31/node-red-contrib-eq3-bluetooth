const A = require('./lib/eq3device')

A.discover((device) => {
  device.on('disconnect', function() {
    console.log('got disconnected!');
  })

  console.log('discovered')
  device.connectAndSetup()
  .then(() => {
    console.log('connected')
    setInterval(() => {
      device.getInfo()
      .then(a => {
        console.log(a)
      })
    }, 2000)
  })
})
