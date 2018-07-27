// Description:
//    An example script, tells you the time. See below on how documentation works.
//    https://github.com/hubotio/hubot/blob/master/docs/scripting.md#documenting-scripts
//
// Commands:
//    bot what time is it? - Tells you the time
//    bot what's the time? - Tells you the time
//
module.exports = (robot) => {
  robot.respond(/(what do you think?|what do ya say?)/gi, (res) => {
    if (res.message.user.id === 'zgfuB2P5P2ErF6Nyr') res.reply(`I agree with Ed.`)
  })
}
