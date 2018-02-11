"use strict";

const DynamicConversation = require('hubot-dynamic-conversation');

const Schedule = require('node-schedule');

const Moment = require('moment');

const Guid = require('guid');

const pollTitlePosition = 0;
const pollTypePosition = 1;
const pollScopePosition = 2;
const pollDescriptionPosition = 3;
const pollNumOptionsPosition = 4;
const pollChoicesPosition = 5;
const pollProposalPosition = 4;

const pollingRoomName = 'polling-internal';

//const testUserID = 'a3kgfm9g7l';

module.exports = function(robot) {
  
  
  function userHasRole(msg,role) {  
  
    return true;

    robot.logger.info("Checking if user: "+msg.message.user.name+" has role "+role);
    let user = robot.brain.userForName(msg.message.user.name);
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
  
  function startPoll(pollID) {
    announcePoll(pollID);
  }
  
  function announcePoll(pollID) {
  
    let poll = robot.brain.get(pollID);
    if (poll === undefined) {
      console.log('Error: poll not found in brain: '+pollID);
    }
  
    let pollMessage = '*Poll #'+(poll.pollNum)+' started!*\n';
    pollMessage += 'Title: '+poll.title + ' ('+poll.type.toUpperCase()+')\n';
    pollMessage += 'Description: '+poll.description +'\n';
    
    for (let i=0; i<poll.numOptions; i++) {    
      pollMessage += poll.letters[i]+'. '+poll.choices[i] +'\n';
    }
    let end = Moment(poll.endTime);
    pollMessage += 'Poll ends '+end.format('LL');  

    robot.send({room:pollingRoomName},pollMessage);

    let pollParticipants = robot.auth.usersWithRole('core'); //[testUserID];
    console.log('sending poll announce to:'+pollParticipants);
    for (let i=0; i<pollParticipants.length; i++) {      
      let targetUserName = pollParticipants[i];
      let targetUser = robot.brain.userForName(targetUserName);      
              
      robot.adapter.sendDirect({user:targetUser}, pollMessage);
    }
  }
  
  function endPoll(pollID) {
    
    let poll = robot.brain.get(pollID);

    if (poll === undefined) {
      console.log('Error: poll not found in brain: '+pollID);
    }
    
    poll.ended = true;
        
    poll.votes = [];
    poll.votes['sZdrn4uSiL6yCW3e2'] = 1;
    poll.votes['ZsuLNtEip9g98EYER'] = 1;
    poll.votes['Xwgmz977BntmXXP3e'] = 0;
    poll.votes['iKjDSNBqdFMvxCT48'] = 0;
    poll.votes['zgfuB2P5P2ErF6Nyr'] = 2;
    poll.votes['GhfX7a7CukJbw2Z72'] = 2;
    poll.votes['fuqTJHzTda7yGwZS4'] = 1;
    poll.votes['neAerNQBFenMNibqa'] = 1;
    poll.votes['6z8y4HR4oKMXLt3Yz'] = 1;
    poll.votes['YgdcjWc2MWkwfFoDs'] = 2;
  
  
  let coreusers = [
    'ZsuLNtEip9g98EYER',
    'Xwgmz977BntmXXP3e',
    'iKjDSNBqdFMvxCT48',
    'zgfuB2P5P2ErF6Nyr',
    'GhfX7a7CukJbw2Z72',
    'fuqTJHzTda7yGwZS4',
    'neAerNQBFenMNibqa',
    '6z8y4HR4oKMXLt3Yz',
    '4yaDDNKCtSCGwGysW',
    'YgdcjWc2MWkwfFoDs',
    'bTtftsEqgtKLWLeGQ',
    'eAocL4XvXSvGqSA5q',
    'sZdrn4uSiL6yCW3e2'
  ];



    poll.results = {};
    poll.results.votes = {};
    poll.results.winner = {choice:null,count:0,letter:null};
    poll.results.draw = [];

    if (poll.votes !== undefined) {            
  
      let pollCounts = {};
      Object.keys(poll.votes).forEach(function(userID, key, _array) {      
        let num = poll.votes[userID];
        if (num !== undefined)
          pollCounts[num] = pollCounts[num] ? pollCounts[num] + 1 : 1;
      });

      if (poll.type === 'choice') {
    
        let highestVotes = {choice:null,count:0,draw:false,letter:null};
        
        for (let i=0;i<poll.numOptions;i++) {          
          let letter = poll.letters[i];
          let pollChoice = poll.choices[i];
          let voteCount = pollCounts[i] || 0;
          poll.results.votes[letter] = {choice:pollChoice,count:voteCount,letter:letter};
        
          if (voteCount > poll.results.winner.count) {
            poll.results.winner = Object.assign({},poll.results.votes[letter]);
            poll.results.draw = [];
          }
          else if (voteCount === poll.results.winner.count) {
            poll.results.draw.push(poll.results.votes[letter]);          
            poll.results.draw.push(poll.results.votes[poll.results.winner.letter]);
            poll.results.winner = {choice:null,count:0,letter:null};
          }
        }        
      }
      else if (poll.type === 'proposal' || poll.type === 'prop') {            
        
        for (let i=0;i<poll.numOptions;i++) {          
          let letter = poll.letters[i];
          let pollChoice = poll.choices[i];
          let voteCount = pollCounts[i] || 0;
          poll.results.votes[letter] = {choice:pollChoice,count:voteCount,letter:letter};
        }        

        if(poll.scope === 'full') {
          let nonVoters = coreusers;
          
          for (const userID of Object.keys(poll.votes)) {
            let i = nonVoters.indexOf(userID);
            nonVoters.splice(i,1);
          }
          for (let i=0;i<nonVoters.length;i++) {
            let u = nonVoters[i];
            poll.votes[u] = 3;
          }
          if (nonVoters.length > 0) 
            poll.results.votes['A'] =  {choice:'Absent',count:nonVoters.length,letter:'A'};

        }

        let yesVotes = poll.results.votes['Y'].count;
        let noVotes = poll.results.votes['N'].count + poll.results.votes['A'].count;
        if (yesVotes /2 >= noVotes) {
          poll.results.winner = poll.results.votes['Y'];
        }
        else {                    
          poll.results.winner = {choice:'No or Absent',count:noVotes,letter:'NA'};
        }
      }
    }
  
    announcePollEnd(pollID);
  }
  
  function announcePollEnd(pollID) {
    
    let poll = robot.brain.get(pollID);
    if (poll === undefined) {
      console.log('Error: poll not found in brain: '+pollID);
      return;
    }

    console.log(poll.results); 
  
    let resultText = '*Poll #'+(poll.pollNum)+' complete!*\n';

    if (poll.votes === undefined) {
      resultText += 'Poll failed, no votes cast';
      robot.send({room:pollingRoomName},resultText);
      return;
    }    
    
    resultText += 'Vote Count:\n';
 
    for (let i=0;i<poll.numOptions;i++) {    
      let letter = poll.letters[i];      
      resultText += poll.results.votes[letter].count+' votes for '+letter+': '+poll.results.votes[letter].choice+'\n';
    }
    if (poll.results.votes['A'])
      resultText += poll.results.votes['A'].count+' votes marked A: Absent\n';

    if (poll.type === 'choice') {       
      if (poll.results.draw.length > 0)
        resultText += 'Result: DRAW - no clear winner';
      else 
        resultText += 'Result: WIN - option '+poll.results.winner.letter+' with '+poll.results.winner.count+' votes';
    }
    else if (poll.type === 'proposal' || poll.type === 'prop') {
      if (poll.results.winner.letter === 'Y') {
        resultText += 'Result: PASSED - quorum reached for Y with '+poll.results.winner.count+' votes';  
      }
      else {
        resultText += 'Result: FAILED - no quorum with '+poll.results.winner.count+' votes for:'+poll.results.winner.choice;
      }
    }
  
    let pollParticipants = robot.auth.usersWithRole('core'); 
    console.log('sending poll end announce to:'+pollParticipants);
    for (let i=0; i<pollParticipants.length; i++) {      
      let targetUserName = pollParticipants[i];
      let targetUser = robot.brain.userForName(targetUserName);      
      let end = Moment(poll.endTime);        
      robot.adapter.sendDirect({user:targetUser}, resultText);
    }
    
    robot.send({room:pollingRoomName}, resultText);
  }

  function capitalizeFirstLetter(string) {
    return string[0].toUpperCase() + string.slice(1);
  }

  var conversation = new DynamicConversation(robot);
  

  // robot.respond(/msg test/i, function(msg) {
    
  //   //todo: figure out what the difference is between this 'user' and the one at poll announce
  //   let targetUser = robot.brain.userForName('edzillion');
  //   console.log(targetUser);
  //   //robot.adapter.sendDirect(targetUser, 'hey senddirect');
  //   robot.adapter.sendDirect({user:targetUser}, 'hey send direct to user');
  // });

  robot.respond(/start a poll/i, function(msg) {

    if (!userHasRole(msg,'core'))
      return;

    // robot.brain.data.users[testUserID] = robot.brain.data.users[msg.message.user.id];
    // robot.brain.data.users[testUserID].id = testUserID;
    // robot.brain.save();

    var pollConversationModel, pollConfirmConversationModel, dialog;
    msg.reply("Sure, just answer the following questions.");
    pollConversationModel = {
      abortKeyword: "quit",
      onAbortMessage: "You have cancelled the poll.",
      onCompleteMessage: "Poll input complete.",
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
    conversation.start(msg, pollConversationModel, function(err, msg, pollDialog) {
      var pollList;
      if (err != null) {
        return console.log("Error occured while creating poll: " + err);
      }

      //msg.reply("Thanks for using ubibot! I'm always here to help.");
      let dialogData = pollDialog.fetch();
      let pollData = {
        title: capitalizeFirstLetter(dialogData.answers[pollTitlePosition].response.value),
        description: capitalizeFirstLetter(dialogData.answers[pollDescriptionPosition].response.value),
        type: dialogData.answers[pollTypePosition].response.value,
        scope: dialogData.answers[pollScopePosition].response.value,
        letters: null,
        numOptions: null,
        choices: [] 
      };
      if (pollData.type === 'choice') {
        pollData.numOptions = Number(dialogData.answers[pollNumOptionsPosition].response.value);
        for (let i=0; i<pollData.numOptions; i++) {
          let str = capitalizeFirstLetter(dialogData.answers[pollChoicesPosition+i].response.value);
          pollData.choices.push(str);
        }
        pollData.letters = ['A','B','C','D','E','F','G','H','I','J'];
      }
      else {
        pollData.choices[0] = capitalizeFirstLetter(dialogData.answers[pollProposalPosition+1].response.value);
        pollData.choices[1] = capitalizeFirstLetter(dialogData.answers[pollProposalPosition].response.value);
        pollData.choices[2] = 'Indifferent';
        pollData.letters = ['N','Y','I'];
        pollData.numOptions = 3;
      }

      pollData.endTime = Moment().add(25,'seconds');
      pollData.pollID = 'poll:'+Guid.create();     


      let pollMessage = 'Poll Draft:\n';
      pollMessage += 'Title: '+pollData.title + ' ('+pollData.type.toUpperCase()+')\n';
      pollMessage += 'Description: '+pollData.description +'\n';
      
      for (let i=0; i<pollData.numOptions; i++) {    
        pollMessage += pollData.letters[i]+'. '+pollData.choices[i] +'\n';
      }
         
      let end = Moment(pollData.endTime);
      pollMessage += 'Poll ends '+end.format('LL');      
      
      msg.reply(pollMessage);

      pollConfirmConversationModel = {
        abortKeyword: "quit",
        onAbortMessage: "You have cancelled the poll.",
        conversation: [
          {
            question: "Does this look right? [Y] to confirm [N] to cancel",          
            answer: {
              type: "choice",
              options: [
                {
                  match: "Y",
                  valid: true,
                  response: "OK, you have confirmed the poll.",
                  value: "choice"
                },
                {
                  match: "y",
                  valid: true,
                  response: "OK, you have confirmed the poll.",
                  value: "choice"
                },
                {
                  match: "N",
                  valid: true,
                  response: "You have deleted this poll draft.",
                  value: "choice"
                },
                {
                  match: "n",
                  valid: true,
                  response: "You have deleted this poll draft.",
                  value: "choice"
                }
              ]
            },
            required: true,
            error: "Sorry, I didn't understand your response. Please say 'Y' or 'N'"
          }              
        ]
      };

      conversation.start(msg, pollConfirmConversationModel, function(err, msg, confirmDialog) {

        let dialogData = confirmDialog.fetch();
        let answer = dialogData.answers[0].response.value.toUpperCase();
        if (answer === 'Y') {
          var user = robot.brain.data.users[msg.message.user.id];
          if (!user.polls) {
            user.polls = [];        
          }
          user.polls[pollData.pollID] = {vote:null};

          pollList = robot.brain.get('polls');
          if (!pollList) {
            pollList = [pollData.pollID]; 
            pollData.pollNum = 0;       
          }
          else {
            pollList.push(pollData.pollID);
            pollData.pollNum = pollList.length-1;
          }
          robot.brain.set('polls', pollList);

          var sched = Schedule.scheduleJob(pollData.endTime.toDate(), function(pollID){
            endPoll(pollID);
          }.bind(null,pollData.pollID));

          pollData.schedule = sched;
          robot.brain.set(pollData.pollID, pollData);

          startPoll(pollData.pollID);
        }
        else {
          msg.reply('Poll deleted.');
          return;
        }
      });
    });    
  });

  robot.respond(/cancel poll ([0-9]{1,2})/i, function(msg) {
  });

  robot.respond(/vote ([a-zA-Z]) on poll ([0-9]{1,2})/i, function(msg) {

    if (!userHasRole(msg,'core'))
      return;

    let pollList = robot.brain.get('polls');
    if (pollList === undefined) {
      msg.reply('No polls underway.');
      return;
    }
    let vote = msg.match[1].toUpperCase();
    let pollIndex = msg.match[2];
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

    let voteIndex = poll.letters.indexOf(vote);
    let voteText = poll.choices[voteIndex];


    if (voteIndex < 0 || voteIndex >= poll.numOptions ) {
      msg.reply('No poll option '+vote);
      return;
    }
    if (!poll.votes) 
        poll.votes = [];

    console.log()
    poll.votes[callerUserID] = vote; 
    msg.reply('You have voted '+vote+':'+voteText+ ' on poll '+msg.match[2]+':'+poll.title);
    if (!poll.votes)
        poll.votes = [];
    poll.votes[String(callerUserID)] = voteIndex;
    if (!robot.brain.data.users[callerUserID].polls)
      robot.brain.data.users[callerUserID].polls = [];
    robot.brain.data.users[callerUserID].polls[poll.pollID] = {'vote':voteIndex};

    let pollParticipants = poll.scope;
    if (pollParticipants === 'partial' || pollParticipants === 'part') {
      let newEndDate = Moment().add(10,'minutes').toDate();
      let success = poll.schedule.reschedule(newEndDate);
      if (success)
        msg.reply('Poll #'+poll.pollNum+' is extended by 20 seconds');
      else 
        msg.reply('Problem extending Poll #'+poll.pollNum);
    }
    robot.brain.save();
  });

  robot.respond(/change vote on poll ([0-9]{1,2}) to ([a-zA-Z])/i, function(msg) {

    if (!userHasRole(msg,'core'))
      return;

    let pollList = robot.brain.get('polls');
    if (pollList === undefined) {
      msg.reply('No polls underway.');
      return;
    }
    let vote = msg.match[2].toUpperCase();
    let pollIndex = msg.match[1];
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
    
    if (voteIndex < 0 || voteIndex >= poll.numOptions ) {
      msg.reply('No poll option '+vote);
      return;
    }
    poll.votes[callerUserID] = voteIndex; 

    robot.brain.data.users[callerUserID].polls[poll.pollID].vote = voteIndex;
    robot.brain.save();

    msg.reply('Changed vote to '+vote+': '+poll.choices[voteIndex]+ ' on poll '+pollIndex+':'+poll.title);

  });

  robot.respond(/delegate vote on poll ([0-9]{1,2}) to ([A-Za-z][A-Za-z0-9._]{2,25})/i, function(msg) {

    if (!userHasRole(msg,'core'))
      return;

    let pollList = robot.brain.get('polls');
    if (pollList === undefined) {
      msg.reply('No polls underway.');
      return;
    }
    let delegateUsername = msg.match[2];
    let user  = robot.brain.usersForFuzzyName(delegateUsername);

    if (user === undefined) {
      msg.reply('No username: '+delegateUsername+'. Have you spelled it correctly?');
      return;
    }

    let pollIndex = msg.match[1];
    let callerUserID = msg.message.user.id;
    let poll = robot.brain.get(pollList[pollIndex]);

    if (!poll) {
      msg.reply('No poll number '+msg.match[1]);
      return;
    }
    else if (poll.votes[callerUserID]) {
      //already voted
      msg.reply('You have already voted on this poll');      
      return;
    }
    
    poll.votes[callerUserID] = 'delegate:'+userToDelegateTo;
    if (!robot.brain.data.users[callerUserID].polls)
      robot.brain.data.users[callerUserID].polls = [];
    robot.brain.data.users[callerUserID].polls[poll.pollID] = {'vote':'delegate:'+userToDelegateTo};
    robot.brain.save();

    msg.reply('Delegated vote to '+userToDelegateTo+' on poll '+pollIndex+':'+poll.title);
  });

  robot.respond(/list polls/i, function(msg) {

    if (!userHasRole(msg,'core'))
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
      replyString += i + '. ' + poll.title + '\n';        
    }    
    replyString = replyString.slice(0, -1); //cut of last '\n';
    msg.reply(replyString);
  });

  robot.respond(/list open polls/i, function(msg) {

    if (!userHasRole(msg,'core'))
      return;

    let replyString = '';
    let callerUserID = msg.message.user.id;
    let timeNow = Moment();
    var pollList = robot.brain.get('polls');          
    if (!pollList) {
        msg.reply('No polls underway.');
        return;
    }
    let openPollList = '';
    for (let i=0; i<pollList.length; i++) {
      var poll = robot.brain.get(pollList[i]);
      let end = Moment(poll.endTime);
      if (end.isAfter(timeNow) && (!poll.votes || poll.votes[callerUserID] === undefined)) {          
        openPollList += i + '. ' + poll.title + '\n';
      }        
    } 
    if (openPollList) {
      replyString = 'Polls you have not voted on:\n' + openPollList;
    }
    else {
      replyString = 'There are no current polls you have not voted on.';
    }
    msg.reply(replyString);
  });

  robot.respond(/show poll ([0-9])/i, function(msg) {

    let callerUserID = msg.message.user.id;

    if (!userHasRole(msg,'core'))
      return;
      
    let pollList = robot.brain.get('polls');
    console.log(pollList);
    if (!pollList) {
      msg.reply('No polls underway.');
      return;
    }
    let pollIndex = msg.match[1];
    if (pollList[pollIndex] === undefined) {
      msg.reply('No poll number '+msg.match[1]);
      return;
    }
    let poll = robot.brain.get(pollList[pollIndex]);        
    if (!poll) {
      msg.reply('No poll number '+msg.match[1]);
      return;
    }

    let replyString = 'Title: '+poll.title + ' ('+poll.type.toUpperCase()+')\n';
    replyString += 'Description: '+poll.description +'\n';

    for (let i=0; i<poll.numOptions; i++) {    
      replyString  += poll.letters[i]+'. '+poll.choices[i] +'\n';
    }
    
    let now = Moment();
    let end = Moment(poll.endTime);
    if (now.isAfter(end)) {
      replyString += 'Poll has already ended'; 

    }        
    else {
      if (poll.votes && poll.votes[callerUserID] != undefined) {
        replyString += 'You have previously voted on this poll.' +'\n';
        replyString += 'You voted '+poll.choices[poll.votes[callerUserID]]+'\n';        
      }   
      else {
        replyString += 'You have not yet voted on this poll.' +'\n';
      }    

      replyString += 'Poll ends '+end.format('LL');
    }
    
    msg.reply(replyString);
  });
};
