// Description
//    User management script for rocketchat.
//
// Dependencies:
//
// Configuration:
//
// Commands:
//
// Author:
//   edzillion@joincircles.net

"use strict";

function userHasRole(robot,msg,role) {
  
  robot.logger.info("Checking if user: "+msg.message.user.name+" has role "+role);
  var user;  
  user = robot.brain.userForName(msg.message.user.name);
  if (!user) {
    msg.reply(user.name + " does not exist");
    return false;
  }  
  else if (!robot.auth.hasRole(user, role)) {
    robot.logger.info("Permission Denied");
    msg.reply("Access Denied. You need "+role+" role to perform this action.");
    return false;
  }
  robot.logger.info("Permission Granted");
  return true;
}

module.exports = function(robot) {

  // adds all users to robot brain, should only need to be done once in a bot's life
  robot.respond(/sync users with brain/i, function(msg) {
    
    if (!userHasRole(robot,msg,'admin'))
      return;

    var promise;
    promise = robot.adapter.callMethod('botRequest', 'allUsers');
    return promise.then(function(rocketChatUsers) {
      if (!rocketChatUsers)
        return console.error('no rocketchat users!');      
      var prevUsers = robot.brain.users();
      var addedUsers = [];
      var user;
      for (var i=0; i<rocketChatUsers.length; i++) {
        if (prevUsers[rocketChatUsers[i]._id]) {        
          continue;
        }
        user = robot.brain.userForId(rocketChatUsers[i]._id, {
          name: rocketChatUsers[i].username,
          alias: rocketChatUsers[i].alias,
          fullName: rocketChatUsers[i].name
        });
        user.room = 'ubibot';
        user.roomID = 'dX9MFm7DBvfJHJggq'; //this is the id of the ubibot room
        addedUsers.push(user);
      }
      msg.send(addedUsers.length+" Users added to brain");      
    }, function(error) {
        msg.send("Uh, sorry I don't know, something's not working");
    });
  });

  // list all users by name
  robot.respond(/list all users/i, function(msg) {
    
    if (!userHasRole(robot,msg,'admin'))
      return;

    var promise;
    promise = robot.adapter.callMethod('botRequest', 'allUsers');
    return promise.then(function(result) {
      var users;      
      var output = '';
      if (result.length > 0) {
        for (var i=0; i<result.length; i++) {
          output += result[i].name + ':' + result[i].username + '\n';
        }                
        msg.send(output);
      } else {
        msg.send("No users... \*cricket sound\*");
      }
    }, function(error) {
        msg.send("Uh, sorry I don't know, something's not working");
    });
  });

  // list all users currently online by name
  robot.respond(/list online users/i, function(msg) {  
    
    var promise;
    promise = robot.adapter.callMethod('botRequest', 'onlineNames');
    return promise.then(function(result) {
      var names;
      if (result.length > 0) {
        names = result.join(', ').replace(/,(?=[^,]*$)/, ' and ');
        msg.send(names + " " + (result.length === 1 ? 'is' : 'are') + " currently online");
      } else {
        msg.send("Nobody is currently online... \*cricket sound\*");
      }
    }, function(error) {
      msg.send("Uh, sorry I don't know, something's not working");
    });
  });

};