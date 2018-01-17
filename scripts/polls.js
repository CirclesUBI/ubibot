var Conversation = require('hubot-conversation');
module.exports = function (robot) {
 
    var switchBoard = new Conversation(robot);

    var title;
    var type;
    var message;
    var options;
 
    robot.respond(/start a poll/, function (msg) {
        var dialog = switchBoard.startDialog(msg);
 
        msg.reply('Sure, what would you like to name the poll?');
        dialog.addChoice(/(^[A-Z0-9 _]*[A-Z0-9][A-Z0-9 _][',-]*$)/i, function (msg2) {
            title = msg2.match[0];
            msg2.reply('Title: '+title);
            msg2.reply('Is this correct (y/n/q)?');
            dialog.addChoice(/y/, function (msg3) {            
                msg3.reply('Ok, What kind of poll is it (full/partial)?');
                dialog.addChoice(/full/, function (msg4) {    
                    type = 'full';
                    msg4.reply('Type: '+type);
                    msg4.reply('Please enter a description for your poll');
                });
                dialog.addChoice(/partial/, function (msg4) {
                    type = 'partial';
                    msg4.reply('Type: '+type);
                    msg4.reply('Please enter a description for your poll');
                });                               
            });
            dialog.addChoice(/n/, function (msg3) {            
                msg3.reply('What would you like to name the poll?');             
            });
            dialog.addChoice(/q/, function (msg3) {            
                msg3.reply('quit');                
            });
        });
    });
 
    robot.respond(/jump/, function (msg) {
        var dialog = switchBoard.startDialog(msg);
        msg.reply('Sure, How many times?');
        
        dialog.addChoice(/([0-9]+)/i, function (msg2) {
            var times = parseInt(msg2.match[1], 10);
            for (var i = 0; i < times; i++) {
                msg.emote("Jumps"); //We can use the original message too. 
            }
        });
    });
    
    
  robot.respond(/.*the mission/, function (msg) {
        msg.reply('Your have 5 seconds to accept your mission, or this message will self-destruct');
        var dialog = switchBoard.startDialog(msg, 5000); //5 Second timeout 
        dialog.timeout = function (msg2) {
            msg2.emote('Boom');
        }
        dialog.addChoice(/yes/i, function (msg2) {
            msg2.reply('Great! Here are the details...');
        });
    });
};