// Description:
//    Ubibot Admin Scripts
//
// Commands:
//    ubibot set mode [test|prod]
//
module.exports = (robot) => {
  function _initBotConfig () {
    // get configs from brain
    var config = robot.brain.get('botConfig')

    if (!config) {
      config = {
        mode: 'prod' // can also be 'test'
      }
    } else console.log('config loaded from brain')
    return config
  }

  robot.respond(/set mode (prod|test)/i, (res) => {
    var config = _initBotConfig()

    let mode = res.match[1].toLowerCase()
    if (config.mode === mode) res.reply('already in ' + mode + ' mode')
    else {
      config.mode = mode
      robot.brain.set('botConfig', config)
      res.reply('botConfig.mode set to `' + mode + '`')
    }
  })
}
