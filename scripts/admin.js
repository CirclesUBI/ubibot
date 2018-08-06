// Description:
//    An example script, tells you the time. See below on how documentation works.
//    https://github.com/hubotio/hubot/blob/master/docs/scripting.md#documenting-scripts
//
// Commands:
//    bot what time is it? - Tells you the time
//    bot what's the time? - Tells you the time
//
module.exports = (robot) => {
  // get configs from brain
  var config = robot.brain.get('botConfig')
  if (!config) {
    config = {
      mode: 'prod' // can also be 'test'
    }
  }

  robot.respond(/set mode (prod|test)/i, (res) => {
    let mode = res.match[1].toLowerCase()
    if (config.mode === mode) res.reply('already in ' + mode + ' mode')
    else {
      config.mode = mode
      robot.brain.set('botConfig', config)
      res.reply('set mode to' + mode)
    }
  })
}
