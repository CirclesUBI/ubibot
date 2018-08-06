// Description:
//    An example script, tells you the time. See below on how documentation works.
//    https://github.com/hubotio/hubot/blob/master/docs/scripting.md#documenting-scripts
//
// Commands:
//    ubibot set mode [test|prod]
//    bot what's the time? - Tells you the time
//
module.exports = (robot) => {
  function _initBotConfig () {
  // get configs from brain
    var config = robot.brain.get('botConfig')
    console.log('config loaded: ' + config)
    if (!config) {
      config = {
        mode: 'prod' // can also be 'test'
      }
    }
  }

  robot.respond(/set mode (prod|test)/i, (res) => {
    _initBotConfig()

    let mode = res.match[1].toLowerCase()
    console.log('mode: ' + mode)
    if (config.mode === mode) res.reply('already in ' + mode + ' mode')
    else {
      config.mode = mode
      robot.brain.set('botConfig', config)
      res.reply('mode set to ' + mode)
    }
  })
}
