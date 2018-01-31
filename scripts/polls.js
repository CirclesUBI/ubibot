"use strict";

const DynamicConversation = require('hubot-dynamic-conversation');

const Schedule = require('node-schedule');

const Moment = require('moment');

const UuidV1 = require('uuid/v1');

const pollTitlePosition = 0;
const pollTypePosition = 1;
const pollAudiencePosition = 2;
const pollDescriptionPosition = 3;
const pollOptionsPosition = 4;
const pollChoicesPosition = 5;
const pollProposalPosition = 4;


const testUserID = 'a3kgfm9g7l';

function userHasRole(robot,msg,role) {
  
  return true;

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

function endPoll(robot,pollID) {

  let poll = robot.brain.get(pollID);   
  if (poll == undefined) {
    console.log('Error: poll not found in brain: '+pollID);
  }
  poll.votes = [];
  poll.votes['a3kgfm9g7l'] = 1;
  poll.votes['sdsd34fds1'] = 1;
  poll.votes['kjdl73fds2'] = 1;
  poll.votes['fgdg5446sd'] = 0;
  console.log(poll.votes);

  if (poll.votes == undefined) {
    announcePollEnd(robot,poll,false,'no votes cast');
    return;
  }
  var pollCounts = {};
  Object.keys(poll.votes).forEach(function(userID, key, _array) {      
    let num = poll.votes[userID];
    if (num !== undefined)     
      pollCounts[num] = pollCounts[num] ? pollCounts[num] + 1 : 1;
  });
  //console.log(pollCounts);
  let resultText = 'Poll #'+poll.pollNum+' complete!\n';
  resultText += 'Vote Count:\n';

  let pollType = poll.answers[pollTypePosition].response.value;
  if (pollType === 'choice') {

    let baseCode = 'A'.charCodeAt(0);
    let highestVotes = {choice:null,count:0,draw:false,letter:null};
    Object.keys(pollCounts).forEach(function(element, key, _array) {
      let letter = String.fromCharCode(baseCode+Number(element));   
      let answernum = pollChoicesPosition+Number(element);
      let voteCount = pollCounts[element];
      if (voteCount >= highestVotes.count) {
        highestVotes.choice = Number(element);
        highestVotes.letter = letter;      
        highestVotes.draw = false;
        if (voteCount == highestVotes.count)
          highestVotes.draw = true;
        highestVotes.count = voteCount;
        //console.log(highestVotes);
      }
      resultText += voteCount+' votes for '+letter+':'+poll.answers[answernum].response.value + '\n';    
    });

    if (highestVotes.draw === true)
      resultText += 'Result: draw - no clear winner';
    else 
      resultText += 'Result: win - option '+highestVotes.letter+' with '+highestVotes.count+' votes';
  }
  else if (pollType === 'proposal' || pollType === 'prop') {
    let letters = ['N','Y','A'];
    Object.keys(pollCounts).forEach(function(element, key, _array) {        
      let answernum = pollChoicesPosition+Number(element);
      let voteCount = pollCounts[element];
      resultText += voteCount+' votes for '+letters[key]+':'+poll.answers[answernum].response.value + '\n';    
    });

    let yesVotes = pollCounts[letters.indexOf('Y')];
    let noVotes = pollCounts[letters.indexOf('N')];
    if (yesVotes /2 >= noVotes)
      resultText += 'Result: success - quorum reached for Y with '+yesVotes+' votes';  
    else 
      resultText += 'Result: failed - no quorum';      
  }

  robot.send({room:'Shell'}, resultText);
}

function announcePollEnd(robot, poll, success, reason) {
  if (!success) {
    robot.send({room:'Shell'}, 'Poll failed, '+reason);
  }
}

function announcePollStart(robot, poll, msg) {
  if (poll.answers[pollAudiencePosition].response.value == 'full') {

    let pollMessage = 'Poll #'+(poll.pollNum+1)+' started!\n';
    
    pollMessage += 'Title: '+poll.answers[pollTitlePosition].response.value + ' ('+poll.answers[pollTypePosition].response.value.toUpperCase()+')\n';
    pollMessage += 'Description: '+poll.answers[pollDescriptionPosition].response.value +'\n';
    let amtOptions = poll.answers[pollOptionsPosition].response.value;
    
    for (let i=0, letter = 'A'.charCodeAt(0); i<amtOptions; i++, letter++) {    
      pollMessage += String.fromCharCode(letter)+'. '+poll.answers[pollChoicesPosition+i].response.value +'\n';
    }

    let pollAudience = [testUserID];//robot.auth.usersWithRole('poll');
    for (let i=0; i<pollAudience.length; i++) {      
      let targetUserID = pollAudience[i];
      if (poll.votes && poll.votes[targetUserID] != undefined) {
        pollMessage += 'You have previously voted on this poll.' +'\n';
        let charCode = 'A'.charCodeAt(0) + poll.votes[targetUserID];
        pollMessage += 'You voted '+String.fromCharCode(charCode) +'\n';        
      }   
      else {
        pollMessage += 'You have not yet voted on this poll.' +'\n';
      }    

      let end = Moment(poll.endTime);
      pollMessage += 'Poll ends '+end.format('LL');      
    
      robot.send({user: targetUserID}, pollMessage);
    }
  }
}

module.exports = function(robot) {
  
  var conversation = new DynamicConversation(robot);
  
  robot.respond(/start a poll/i, function(msg) {

    if (!userHasRole(robot,msg,'core'))
      return;

    robot.brain.data.users[testUserID] = robot.brain.data.users[msg.message.user.id];
    robot.brain.data.users[testUserID].id = testUserID;
    robot.brain.save();
    console.log(robot.brain.data.users);

    var conversationModel, dialog;
    msg.reply("Sure, just answer the following questions.");
    conversationModel = {
      abortKeyword: "quit",
      onAbortMessage: "You have cancelled the poll.",
      onCompleteMessage: "Poll started, good luck!",
      conversation: [
        {
          question: "What would you like to name the poll?",
          answer: {
            type: "text"
          },
          required: true,
          error: "Sorry your response didn't contain any text, please name the poll."
        }, 
        {
          question: "What kind of poll is it (choice/proposal)?",
          answer: {
            type: "choice",
            options: [
              {
                match: "choice",
                valid: true,
                response: "OK, its a multiple choice poll.",
                value: "choice"
              }, {
                match: "proposal",
                valid: true,
                response: "OK, its a proposal poll.",
                value: "proposal"
              }, {
                match: "prop",
                valid: true,
                response: "OK, its a proposal poll.",
                value: "proposal"
              }
            ]
          },
          required: true,
          error: "Sorry, I didn't understand your response. Please say 'choice', 'proposal' or 'prop' to proceed."
        }, 
        {
          question: "Who will take part in the poll (full/partial)?",
          answer: {
            type: "choice",
            options: [
              {
                match: "full",
                valid: true,
                response: "OK, its a full poll.",
                value: "full"
              }, {
                match: "partial",
                valid: true,
                response: "OK, its a partial poll.",
                value: "partial"
              }, {
                match: "part",
                valid: true,
                response: "OK, its a partial poll.",
                value: "partial"
              }
            ]
          },
          required: true,
          error: "Sorry, I didn't understand your response. Please say 'full', 'partial' or 'part' to proceed."
        }, 
        {
          question: "Please describe the poll you are running:",
          answer: {
            type: "text"
          },
          required: true,
          error: "Sorry your response didn't contain any text, please describe the poll."
        },        
        {
          dynamic: true,
          fromQuestionIndex:1,
          choice: [
            {
              question: "How many choices should the poll include?",
              answer: {
                type: "series"
              },
              required: true,
              error: "Sorry you need to input a number from 2 to 9."
            }
          ],
          proposal: [
            {
              question: "Please enter the Yes/For option first:",
              answer: {
                type: "text"
              },
              required: true,
              error: "Sorry your response didn't contain any text, please enter the Yes/For option."
            },
            {
              question: "Now enter the No/Against option:",
              answer: {
                type: "text"
              },
              required: true,
              error: "Sorry your response didn't contain any text, please enter the No/Against option."
            }
          ],
          prop: [ //todo: this is caused by the choice system not setting 'response' as 'value' and instead taking the user input
            {
              question: "Please enter the Yes/For option first:",
              answer: {
                type: "text"
              },
              required: true,
              error: "Sorry your response didn't contain any text, please enter the Yes/For option."
            },
            {
              question: "Now enter the No/Against option:",
              answer: {
                type: "text"
              },
              required: true,
              error: "Sorry your response didn't contain any text, please enter the No/Against option."
            }
          ]                  
        }                
      ]
    };
    dialog = conversation.start(msg, conversationModel, function(err, msg, dialog) {
      var dialogData, guid, pollList;
      if (err != null) {
        return console.log("error occured in the dialog " + err);
      }
      msg.reply("Thanks for using ubibot! I'm always here to help.");
      dialogData = dialog.fetch();
      dialogData.endTime = Moment().add(20,'seconds');
      let uuid = UuidV1();
      let key = 'poll:'+uuid;     
      dialogData.pollID = key;
      var user = robot.brain.data.users[msg.message.user.id];
      if (!user.polls) {
        user.polls = [];        
      }
      user.polls[key] = {vote:null};

      pollList = robot.brain.get('polls');
      if (!pollList) {
        pollList = [key]; 
        dialogData.pollNum = 0;       
      }
      else {
        pollList.push(key);
        dialogData.pollNum = pollList.length-1;
      }
      robot.brain.set('polls', pollList);

      var sched = Schedule.scheduleJob(dialogData.endTime.toDate(), function(robot,pollID){
        endPoll(robot,pollID);
      }.bind(null,robot,key));

      dialogData.schedule = sched;
      robot.brain.set(key, dialogData);

      announcePollStart(robot, dialogData);
    });
  });

  robot.respond(/vote ([a-zA-Z]) on poll ([1-9]{1,2})/i, function(msg) {

    if (!userHasRole(robot,msg,'core'))
      return;

    let pollList = robot.brain.get('polls');
    if (pollList == undefined) {
      msg.reply('No polls underway.');
      return;
    }
    let vote = msg.match[1].toUpperCase();
    let pollIndex = msg.match[2] - 1;
    let poll = robot.brain.get(pollList[pollIndex]);    
    let callerUserID = msg.message.user.id;

    if (!poll) {
      msg.reply('No poll number '+msg.match[2]);
      return;
    }
    else if (poll.votes && poll.votes[callerUserID] != undefined) {
      //already voted
      msg.reply('You have already voted on this poll');
      msg.reply("Use command 'change vote on poll 1 to a' to change your vote");
      return;
    }

    let pollType = poll.answers[pollTypePosition].response.value;
    let voteIndex, amtOptions, voteText;
    let propLetters = ['Y','N','A'];
    if (pollType === 'choice') {
      voteIndex = vote.charCodeAt(0) - 'A'.charCodeAt(0);
      voteText = poll.answers[voteIndex+pollChoicesPosition].response.value;
      amtOptions = Number(poll.answers[pollOptionsPosition].response.value);
    }
    else {
      voteIndex = propLetters.indexOf(vote);
      if (voteIndex === 2) //abstain
        voteText = 'Abstain';
      else 
        voteText = poll.answers[voteIndex+pollProposalPosition].response.value;
      amtOptions = 3;
    }
    console.log(voteIndex);
    if (voteIndex == -1 || voteIndex >= amtOptions ) {
      msg.reply('No poll option '+vote);
      return;
    }
    if (!poll.votes) 
        poll.votes = [];
    poll.votes[callerUserID] = vote; 
    msg.reply('You have voted '+vote+':'+voteText+ ' on poll '+msg.match[2]+':'+poll.answers[pollTitlePosition].response.value);
    if (!poll.votes)
        poll.votes = [];
    poll.votes[String(callerUserID)] = voteIndex;    
    robot.brain.data.users[callerUserID].polls[poll.pollID] = {'vote':voteIndex};

    let pollAudience = poll.answers[pollAudiencePosition].response.value;
    if (pollAudience === 'partial' || pollAudience === 'part') {
      let newEndDate = Moment().add(10,'minutes').toDate();
      let success = poll.schedule.reschedule(newEndDate);
      if (success)
        msg.reply('Poll #'+poll.pollNum+' is extended by 20 seconds');
      else 
        msg.reply('Problem extending Poll #'+poll.pollNum);
    }
    robot.brain.save();
  });

  robot.respond(/change vote on poll ([1-9]{1,2}) to ([a-zA-Z])/i, function(msg) {

    if (!userHasRole(robot,msg,'core'))
      return;

    let pollList = robot.brain.get('polls');
    if (pollList == undefined) {
      msg.reply('No polls underway.');
      return;
    }
    let vote = msg.match[2].toUpperCase();
    let pollIndex = msg.match[1] - 1;
    let voteIndex = vote.charCodeAt(0) - 'A'.charCodeAt(0);
    let callerUserID = msg.message.user.id;
    let poll = robot.brain.get(pollList[pollIndex]);

    if (!poll) {
      msg.reply('No poll number '+msg.match[1]);
      return;
    }
    else if (!poll.votes[callerUserID]) {
      //not already voted
      msg.reply('No vote to change. You have never voted on this poll');      
      return;
    }
    let amtOptions = Number(poll.answers[pollOptionsPosition].response.value);
    if (voteIndex >= amtOptions ) {
      msg.reply('No poll option '+vote);
      return;
    }
    poll.votes[String(callerUserID)] = voteIndex; 

    robot.brain.data.users[callerUserID].polls[poll.pollID].vote = voteIndex;
    robot.brain.save();

    msg.reply('Changed vote to '+vote+':'+poll.answers[pollChoicesPosition+voteIndex].response.value+ ' on poll '+pollIndex+':'+poll.answers[pollTitlePosition].response.value);

  });

  robot.respond(/list polls/i, function(msg) {

    if (!userHasRole(robot,msg,'core'))
      return;

    let pollList, poll;
    pollList = robot.brain.get('polls');          
    if (!pollList) {
      msg.reply('No polls underway.');
      return;
    }
    let replyString = ''; 
    for (let i=0; i<pollList.length; i++) {
      poll = robot.brain.get(pollList[i]);
      replyString += (i+1) + '. ' + poll.answers[pollTitlePosition].response.value + '\n';        
    }    
    replyString = replyString.slice(0, -1); //cut of last '\n';
    msg.reply(replyString);
  });

  robot.respond(/list open polls/i, function(msg) {

    if (!userHasRole(robot,msg,'core'))
      return;

    let callerUserID = msg.message.user.id;
    let timeNow = Moment();
    var pollList = robot.brain.get('polls');          
    if (!pollList) {
        msg.reply('No polls underway.');
        return;
    }
    let replyString = 'Polls you have not voted on:\n';     
    for (let i=0; i<pollList.length; i++) {
      var poll = robot.brain.get(pollList[i]);
      let end = Moment(poll.endTime);
      if (end.isAfter(timeNow) && (!poll.votes || poll.votes[callerUserID] == undefined)) {          
        replyString += (i+1) + '. ' + poll.answers[pollTitlePosition].response.value + '\n';
      }        
    } 
    replyString = replyString.slice(0, -1); //cut of last '\n';
    msg.reply(replyString);
  });

  robot.respond(/show poll ([1-9])/i, function(msg) {

    if (!userHasRole(robot,msg,'core'))
      return;

      
    let pollList = robot.brain.get('polls');
    if (pollList == undefined) {
      msg.reply('No polls underway.');
      return;
    }
    let pollIndex = msg.match[1] - 1;
    if (pollList[pollIndex] == undefined) {
      msg.reply('No poll number '+msg.match[1]);
      return;
    }
    let poll = robot.brain.get(pollList[pollIndex]);        
    if (!poll) {
      msg.reply('No poll number '+msg.match[1]);
      return;
    }

    let replyString = 'Title: '+poll.answers[pollTitlePosition].response.value + ' ('+poll.answers[1].response.value.toUpperCase()+')\n';
    replyString += 'Description: '+poll.answers[pollDescriptionPosition].response.value +'\n';
    
    
    let pollType = poll.answers[pollTypePosition].response.value;    
    if (pollType === 'choice') {
      let amtOptions = poll.answers[pollOptionsPosition].response.value;
      
      for (let i=0, letter = 'A'.charCodeAt(0); i<amtOptions; i++, letter++) {    
        replyString += String.fromCharCode(letter)+'. '+poll.answers[pollChoicesPosition+i].response.value +'\n';
      }
    }
    else {
      console.log(poll.answers);
      let letters = ['Y','N'];
      for (let i=0; i<letters.length; i++) {    
        let letter = letters[i];
        replyString += letter+'. '+poll.answers[pollProposalPosition+i].response.value +'\n';
      }
      replyString += 'A. Abstain\n';
    }
    let callerUserID = msg.message.user.id;
    if (poll.votes && poll.votes[callerUserID] != undefined) {
        replyString += 'You have previously voted on this poll.' +'\n';
        let propLetters = ['Y','N','A'];
        let char;
        if (pollType == 'choice') {
          let charCode = 'A'.charCodeAt(0) + poll.votes[callerUserID];
          char = String.fromCharCode(charCode);
        }
        else {
          char = propLetters[poll.votes[callerUserID]];
        }
        replyString += 'You voted '+char+'\n';        
    }   
    else {
      replyString += 'You have not yet voted on this poll.' +'\n';
    }    
    let now = Moment();
    let end = Moment(poll.endTime);
    if (now.isAfter(end)) {
      replyString += 'Poll has already ended'; 
    }        
    else {
      replyString += 'Poll ends '+end.format('LL');
    }
    msg.reply(replyString);
  });

  
};
