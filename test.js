const A = require('./lib/eq3device')

A.discover((device) => {
  device.on('disconnect', function() {
    console.log('got disconnected!');
  })

  // console.log('d',device)

  // device.connectAndSetUp()
  // .then(() => {
  //   console.log('acc')
  // })
  // .catch((e) => {
  //   console.log(e)
  // })
})
