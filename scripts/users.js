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
  robot.respond(/add all users to brain/i, function(msg) {
    
    if (!userHasRole(robot,msg,'admin'))
      return;

    var promise;
    promise = robot.adapter.callMethod('botRequest', 'allUsers');
    return promise.then(function(result) {
      console.log('allusers');
      var users = [];
      var user;      
      if (result.length > 0) {        
        for (var i=0; i<result.length; i++) {
          user = robot.brain.userForId(result[i]._id, {
            name: result[i].username,
            alias: result[i].alias
          });
          user.room = 'ubibot';
          user.roomID = 'K7JD72yvpgRBLfWri';
          users.push(user);
        }
        msg.send(users.length+" Users add to brain");
      } else {
        msg.send("No users... \*cricket sound\*");
      }
    }, function(error) {
        msg.send("Uh, sorry I don't know, something's not working");
    });
  });

  // warning!! this does not work properly
  robot.respond(/remove all users from brain/i, function(msg) {
    
    if (!userHasRole(robot,msg,'admin'))
      return;

    robot.brain.data.users = [];
    return msg.reply("Users wiped");
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
          output += result[i].name + ':' + result[i]._id + '\n';
        }                
        msg.send(output);
      } else {
        msg.send("No users... \*cricket sound\*");
      }
    }, function(error) {
        msg.send("Uh, sorry I don't know, something's not working");
    });
  });

  // list all users by id
  robot.respond(/list all user ids/i, function(msg) {

    if (!userHasRole(robot,msg,'admin'))
      return;

    var promise;
    promise = robot.adapter.callMethod('botRequest', 'allIDs');
    return promise.then(function(result) {
      var names;
      if (result.length > 0) {
        names = result.join(', ').replace(/,(?=[^,]*$)/, ' and ');
        msg.send(names + " " + (result.length === 1 ? 'is' : 'are') + " currently online");
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