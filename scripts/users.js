// Description:
//    Ubibot User Scripts
//
// Commands:
//    sync users with brain - add new users to hubot-brain
//    list all users - list all users by name:username
//    list online users - list all users currently online by name

function _userHasRole (robot, msg, role) {
  robot.logger.info('Checking if user: ' + msg.message.user.name + ' has role ' + role)
  let user = robot.brain.userForName(msg.message.user.name)
  if (!user) {
    msg.reply(user.name + ' does not exist')
    return false
  } else if (!robot.auth.hasRole(user, role)) {
    robot.logger.info('Permission Denied')
    msg.reply('Access Denied. You need ' + role + ' role to perform this action.')
    return false
  }
  robot.logger.info('Permission Granted')
  return true
}

module.exports = (robot) => {
  robot.hear(/!userid/i, (msg) => {
    msg.reply('Your User ID is: ' + msg.message.user.id)
  })

  // add new users to hubot-brain
  robot.respond(/sync users with brain/i, (msg) => {
    if (!_userHasRole(robot, msg, 'admin')) return
    var promise = robot.adapter.callMethod('botRequest', 'allUsers')
    return promise.then(rocketChatUsers => {
      if (!rocketChatUsers) return console.error('no rocketchat users!')
      let prevUsers = robot.brain.users()
      let addedUsers = []
      let user
      for (var i = 0; i < rocketChatUsers.length; i++) {
        if (prevUsers[rocketChatUsers[i]._id]) continue
        user = robot.brain.userForId(rocketChatUsers[i]._id, {
          name: rocketChatUsers[i].username,
          alias: rocketChatUsers[i].alias,
          fullName: rocketChatUsers[i].name
        })
        user.room = 'ubibot'
        user.roomID = 'dX9MFm7DBvfJHJggq' // this is the id of the ubibot room
        addedUsers.push(user)
        msg.send(addedUsers.length + ' Users added to brain')
      }
    }).catch(err => console.error(err))
  })

  // list all users by name:username
  robot.respond(/list all users/i, (msg) => {
    if (!_userHasRole(robot, msg, 'admin')) return
    var promise = robot.adapter.callMethod('botRequest', 'allUsers')
    return promise.then(result => {
      let output = ''
      if (result.length > 0) {
        for (var i = 0; i < result.length; i++) {
          output += result[i].name + ':' + result[i].username + '\n'
        }
        msg.send(output)
      } else {
        msg.send('No users... *cricket sound*')
      }
    }).catch(err => console.error(err))
  })

  // list all users currently online by name
  robot.respond(/list online users/i, (msg) => {
    var promise = robot.adapter.callMethod('botRequest', 'onlineNames')
    return promise.then(function (result) {
      var names
      if (result.length > 0) {
        names = result.join(', ').replace(/,(?=[^,]*$)/, ' and ')
        msg.send(names + ' ' + (result.length === 1 ? 'is' : 'are') + ' currently online')
      } else {
        msg.send('Nobody is currently online... *cricket sound*')
      }
    }).catch(err => console.error(err))
  })

  robot.respond(/(what time is it|what's the time)/gi, (res) => {
    const d = new Date()
    const t = `${d.getHours()}:${d.getMinutes()} and ${d.getSeconds()} seconds`
    res.reply(`It's ${t}`)
  })
}
