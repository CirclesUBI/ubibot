// Description:
//    Ubibot Wiki Scripts
//
// Commands:
//    ???

async function status (workingDir) {
  const git = require('simple-git/promise')

  let statusSummary = null
  try {
    statusSummary = await git(workingDir).status()
  } catch (e) {
    // handle the error
  }

  return statusSummary
}

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
  robot.respond(/wiki test/i, (msg) => {
    if (!_userHasRole(robot, msg, 'admin')) return

    msg.reply('statusSummary: ' + status('../'))
  })
}
