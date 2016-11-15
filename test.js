const A = require('./lib/eq3device')

A.discover((device) => {
  device.on('disconnect', function() {
    console.log('got disconnected!');
  })


  device.connectAndSetUp()
  .then(() => {
    console.log('connected')
    return device.getInfo()
  })
  .then((a) => {
    console.log(a)
  })
  .catch((e) => {
    console.log(e)
  })
})
