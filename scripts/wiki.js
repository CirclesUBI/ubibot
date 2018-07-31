// Description:
//    Ubibot Wiki Scripts
//
// Commands:
//    ???

const fs = require('fs')
const path = require('path')
const rootFolder = path.resolve(__dirname, '..', '..')


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
    const gitP = require('simple-git/promise')

    gitP().env({ ...process.env })
      .status(status => console.log(status)
        .then(status => console.log(status))
        .catch(err => console.err(err))
      )
  })

  robot.respond(/wiki repo/i, (msg) => {
    if (!_userHasRole(robot, msg, 'admin')) return

    const git = require('simple-git/promise')

    const repo = 'https://github.com/CirclesUBI/ubibot'
    const remote = `https://${process.env.GITHUB_USER}:${process.env.GITHUB_PASS}@${repo}`

    git().silent(true)
      .clone(remote)
      .then(() => console.log('finished'))
      .catch((err) => console.error('failed: ', err))
  })
}
