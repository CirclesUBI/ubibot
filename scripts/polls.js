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

const confirmConversationModel = {
  abortKeyword: "quit",
  onAbortMessage: "You have cancelled this conversation.",  
  conversation: [
    {
      question: "Are you sure?",
      answer: {
        type: "choice",
        options: [
          {
            match: "Y",
            valid: true,
            response: "OK, confirmed.",
            value: "Y"
          }, {
            match: "y",
            valid: true,
            response: "OK, confirmed.",
            value: "Y"
          },{
            match: "N",
            valid: true,
            response: "Abort.",
            value: "N"
          }, {
            match: "n",
            valid: true,
            response: "Abort.",
            value: "N"
          }
        ]
      },
      required: true,
      error: "Sorry, I didn't understand your response. Please say [Y] or [N]"      
    }
  ]
};

//const testUserId = 'a3kgfm9g7l';

// let coreusers = [
//   'ZsuLNtEip9g98EYER',
//   'Xwgmz977BntmXXP3e',
//   'iKjDSNBqdFMvxCT48',
//   'zgfuB2P5P2ErF6Nyr',
//   'GhfX7a7CukJbw2Z72',
//   'fuqTJHzTda7yGwZS4',
//   'neAerNQBFenMNibqa',
//   '6z8y4HR4oKMXLt3Yz',
//   '4yaDDNKCtSCGwGysW',
//   'YgdcjWc2MWkwfFoDs',
//   'bTtftsEqgtKLWLeGQ',
//   'eAocL4XvXSvGqSA5q',
//   'sZdrn4uSiL6yCW3e2'
// ];

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
  
  function startPoll(pollId) {
    announcePoll(pollId);
  }
  
  function announcePoll(pollId) {
  
    let poll = robot.brain.get(pollId);
    if (poll === undefined) {
      console.log('Error: poll not found in brain: '+pollId);
    }
  
    let pollMessage = '*Poll #'+(poll.pollNum)+' started!*\n';
    pollMessage += 'Title: '+poll.title + ' ('+poll.type.toUpperCase()+')\n';
    pollMessage += 'Description: '+poll.description +'\n';
    
    for (let i=0; i<poll.numOptions; i++) {    
      pollMessage += poll.letters[i]+'. '+poll.choices[i] +'\n';
    }
    let end = Moment(poll.endTime);
    pollMessage += 'Poll ends '+end.format('LL');  

    let pollParticipants = poll.participants; //[testUserId];
    console.log('sending poll '+poll.pollNum+' announce to:'+pollParticipants);
    for (let i=0; i<pollParticipants.length; i++) {      
      let targetUser = robot.brain.userForName(pollParticipants[i]);                    
      robot.adapter.sendDirect({user:targetUser}, pollMessage);
    }

    robot.send({room:pollingRoomName},pollMessage);
  }
  
  function endPoll(pollId) {
    
    let poll = robot.brain.get(pollId);

    if (poll === undefined) {
      console.log('Error: poll not found in brain: '+pollId);
    }

        
    // poll.votes = [];
    // poll.votes['sZdrn4uSiL6yCW3e2'] = 1;
    // poll.votes['ZsuLNtEip9g98EYER'] = 1;
    // poll.votes['Xwgmz977BntmXXP3e'] = 'neAerNQBFenMNibqa';
    // poll.votes['iKjDSNBqdFMvxCT48'] = 1;
    // poll.votes['zgfuB2P5P2ErF6Nyr'] = '6z8y4HR4oKMXLt3Yz';
    // poll.votes['GhfX7a7CukJbw2Z72'] = 2;
    // poll.votes['fuqTJHzTda7yGwZS4'] = '6z8y4HR4oKMXLt3Yz';
    // poll.votes['neAerNQBFenMNibqa'] = 1;
    // poll.votes['6z8y4HR4oKMXLt3Yz'] = 'fuqTJ6hTda7yGwZS4';
    // poll.votes['YgdcjWc2MWkwfFoDs'] = 'iKjDSNBqdFMvxCT48';
  

    poll.results = {};
    poll.results.votes = {};
    poll.results.votes['A'] =  {choice:'Absent',count:0,letter:'A'};
    poll.results.winner = {choice:null,count:0,letter:null};
    poll.results.draw = {};

    if (poll.votes !== undefined) {            
  

      Object.keys(poll.votes).forEach(function(userId) {      
        let vote = poll.votes[userId];          
        if (isNaN(vote)) {
          let dUserId = vote;          
          if (isCircularDelegation(dUserId,undefined,poll.votes)) {
            if (!poll.circDelegates)
              poll.circDelegates = [userId];
            else 
              poll.circDelegates.push(userId);            
          }
          else {
            let nextPassRequired;
            do {         
              nextPassRequired = false;        
              // if the delegatee hasn't voted then it's counted absent      
              if (!poll.votes[dUserId])  {
                if (!poll.absentDelegates)
                  poll.absentDelegates = [userId];
                else 
                  poll.absentDelegates.push(userId);                 
              }
              else {
                let dUserVote = poll.votes[dUserId];
                if (isNaN(dUserVote)) {
                  dUserId = dUserVote;
                  nextPassRequired = true;
                  return;
                }
                poll.votes[userId] = dUserVote;
                let user = robot.brain.userForId(userId);
                let p = user.polls[poll.pollId];
                p.origVote = p.vote;
                p.vote = dUserVote;
                p.status = 'Delegated';                
              }
            }
            while (nextPassRequired === true);  
          }
        }
      });

      for (let i in poll.circDelegates) {
        let userId = poll.circDelegates[i];
        let user = robot.brain.userForId(userId);
        let p = user.polls[poll.pollId];
        p.origVote = p.vote;
        p.vote = 'A';
        p.status = 'Circular Delegation';
        poll.results.votes['A'].count++;
        //delete poll.votes[userId];              
      }
      for (let i in poll.absentDelegates) {
        let userId = poll.absentDelegates[i];
        let user = robot.brain.userForId(userId);
        let p = user.polls[poll.pollId];
        p.origVote = p.vote;
        p.vote = 'A';
        p.status = 'Delegate Absent';
        poll.results.votes['A'].count++;
        //delete poll.votes[userId];              
      }        

      let pollCounts = {};
      Object.keys(poll.votes).forEach(function(userId, key, _array) {      
        let num = poll.votes[userId];
        if (num !== undefined)
          pollCounts[num] = pollCounts[num] ? pollCounts[num] + 1 : 1;
      });

      let nonVoters = poll.participants.slice();
          
      for (const userName of Object.keys(poll.votes)) {
        let i = nonVoters.indexOf(userName);        
        nonVoters.splice(i,1);
      }

      for (let i=0;i<nonVoters.length;i++) {
        let username = nonVoters[i];
        let user = robot.brain.userForName(username);
        if (!user.polls)
          user.polls = {};
        user.polls[poll.pollId] = {          
          vote: 'A',
          status:'Absence'          
        };        
      }               
      poll.results.votes['A'].count += nonVoters.length;
      
      if (poll.type === 'choice') {        
        
        for (let i=0;i<poll.numOptions;i++) {          
          let letter = poll.letters[i];
          let pollChoice = poll.choices[i];
          let voteCount = pollCounts[i] || 0;
          poll.results.votes[letter] = {choice:pollChoice,count:voteCount,letter:letter};
        
          if (voteCount > poll.results.winner.count) {
            poll.results.winner = Object.assign({},poll.results.votes[letter]);
            poll.results.draw = {};
          }
          else if (voteCount === poll.results.winner.count) {
            poll.results.draw[letter] = poll.results.votes[letter];
            if (poll.results.winner.choice !== null)
              poll.results.draw[poll.results.winner.letter] = poll.results.winner;
            poll.results.winner = {choice:null,count:0,letter:null};
          }
        }
        
        if (poll.scope === 'full' || poll.results.winner.count > 0) {
          poll.closed = true;
          poll.status = 'complete';
        }
        else {
          let now = Moment();
          if (poll.endTime.isAfter(now)) {
            poll.closed = true;
            poll.status = 'ended without clear choice';
          }
          else {
            //set to endPoll() at the original endtime. this will be interrupted by any votes cast
            var sched = Schedule.scheduleJob(pollData.endTime.toDate(), function(pollId){
              endPoll(pollId);
            }.bind(null,pollData.pollId));
            poll.closed = false;
            poll.status = 'ongoing';
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

        let yesVotes = poll.results.votes['Y'].count;
        let noVotes = (poll.scope === 'full')  ? poll.results.votes['N'].count + poll.results.votes['A'].count : poll.results.votes['N'].count;
        if (yesVotes >= 2 && yesVotes /2 >= noVotes) {
          poll.results.winner = poll.results.votes['Y'];
          poll.closed = true;
          poll.status = (poll.scope === 'full') ? 'complete': 'quorum reached early';
        }
        else {
          if (poll.scope === 'full') {
            poll.results.winner = {choice:'No or Absent',count:noVotes,letter:'NA'};
            poll.closed = true;
            poll.status = 'complete';
          }
          else {  
            poll.results.winner = poll.results.votes['N'];
            let now = Moment();
            if (poll.endTime.isAfter(now)) {
              poll.closed = true;
              poll.status = 'ended without quorum';
            }
            else {
              //set to endPoll() at the original endtime. this will be interrupted by any votes cast
              var sched = Schedule.scheduleJob(pollData.endTime.toDate(), function(pollId){
                endPoll(pollId);
              }.bind(null,pollData.pollId));
              poll.closed = false;
              poll.status = 'ongoing';
            }
          }
        }
      }
    }
    else {
      poll.results.winner = {choice:'No Votes Cast',count:0,letter:'NV'};
      poll.closed = true;
      poll.status = 'not enough voters';
    }
    
    robot.brain.save();
    announcePollEnd(pollId);
  }
  
  function announcePollEnd(pollId) {
    
    let poll = robot.brain.get(pollId);
    if (poll === undefined) {
      console.log('Error: poll not found in brain: '+pollId);
      return;
    }
  
    let resultText = '*Poll #'+(poll.pollNum)+' complete!*\n';

    if (poll.votes === undefined) {
      resultText += 'Poll FAILED, no votes cast';      
    } 
    else {   
    
      resultText += 'Vote Tally:\n';
  
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
    }
  
    let pollParticipants = poll.participants;
    console.log('sending poll '+poll.pollNum+' end to:'+pollParticipants);
    for (let i=0; i<pollParticipants.length; i++) {      
      let targetUser = robot.brain.userForName(pollParticipants[i]);                    
      robot.adapter.sendDirect({user:targetUser}, resultText);
    }
    
    robot.send({room:pollingRoomName}, resultText);
  }

  function capitalizeFirstLetter(string) {
    return string[0].toUpperCase() + string.slice(1);
  }

  function isCircularDelegation(userId,parents,votes) {    
    parents = parents || [];
    let vote = votes[userId];
    //delegatee is missing or has a vote thats not a delegation. fine.  
    if (!vote || !isNaN(vote))
      return false;

    if (parents.indexOf(userId) >= 0) {      
      return true;
    }      

    parents.push(vote);
    return isCircularDelegation(vote,parents,votes);
  }

  var conversation = new DynamicConversation(robot);


  robot.respond(/start a poll/i, function(msg) {

    if (!userHasRole(msg,'core'))
      return;

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
          question: "What kind of poll is it [choice]/[proposal]?",
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
          error: "Sorry, I didn't understand your response. Please say [choice], [proposal] or [prop] to proceed."
        }, 
        {
          question: "Who will take part in the poll [full]/[partial]?",
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
          error: "Sorry, I didn't understand your response. Please say [full], [partial] or [part] to proceed."
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
              error: "Sorry you need to input a number from [2] to [9]."
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
      var pollList = robot.brain.get('polls');      
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
        choices: [],
        participants: robot.auth.usersWithRole('core'),
        votes: {},
        proposer:msg.message.user.id,
        ended: false,
        status: 'active'
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

      pollData.endTime = Moment().add(1,'minute');
      pollData.pollId = 'poll:'+Guid.create();     

      let draftPollNum = (pollList) ? pollList.length : 0;
      let pollMessage = 'Poll #'+draftPollNum+' - draft:\n';
      pollMessage += 'Title: '+pollData.title + ' ('+pollData.type.toUpperCase()+')\n';
      pollMessage += 'Description: '+pollData.description +'\n';
      
      for (let i=0; i<pollData.numOptions; i++) {    
        pollMessage += pollData.letters[i]+'. '+pollData.choices[i] +'\n';
      }
         
      let end = Moment(pollData.endTime);
      pollMessage += 'Poll ends '+end.fromNow();
      
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
            error: "Sorry, I didn't understand your response. Please say [Y] or [N]"
          }              
        ]
      };

      conversation.start(msg, pollConfirmConversationModel, function(err, msg, confirmDialog) {

        let dialogData = confirmDialog.fetch();
        let answer = dialogData.answers[0].response.value.toUpperCase();
        if (answer === 'Y') {
          var user = robot.brain.userForId(msg.message.user.id);
          if (!user.polls) {
            user.polls = {};        
          }
          user.polls[pollData.pollId] = null;
          
          if (!pollList) {
            pollList = [pollData.pollId]; 
            pollData.pollNum = 0;       
          }
          else {
            pollList.push(pollData.pollId);
            pollData.pollNum = pollList.length-1;
          }
          robot.brain.set('polls', pollList);

          var sched = Schedule.scheduleJob(pollData.endTime.toDate(), function(pollId){
            endPoll(pollId);
          }.bind(null,pollData.pollId));

          pollData.startTime = Moment();
          pollData.schedule = sched;
          robot.brain.set(pollData.pollId, pollData);
          console.log(pollData);
          startPoll(pollData.pollId);
        }
        else {
          msg.reply('Poll deleted.');
          return;
        }
      });
    });    
  });

  robot.respond(/cancel poll ([0-9]{1,2})/i, function(msg) {

    if (!userHasRole(msg,'core'))
      return;
    
    
    let pollList = robot.brain.get('polls');
    if (pollList === undefined) {
      msg.reply('No polls underway.');
      return;
    }     

    let pollIndex = msg.match[1];
    let poll = robot.brain.get(pollList[pollIndex]);    
    let callerUser = robot.brain.userForId(msg.message.user.id);

    if (!poll) {
      msg.reply('No poll number '+msg.match[2]);
      return;
    }
    else if (poll.closed) {
      msg.reply('Poll '+poll.pollNum+' closed. Status: '+poll.status);
      return;
    }

    if (poll.proposer === callerUser.id) {
      conversation.start(msg, confirmConversationModel, function(err, msg, confirmDialog) {
        let dialogData = confirmDialog.fetch();
        let answer = dialogData.answers[0].response.value.toUpperCase();
        if (answer === 'Y') {          
          poll.closed = true;
          poll.status = 'cancelled';
          poll.schedule.cancel();    
          msg.reply('Poll '+poll.pollNum+' closed. Status: '+poll.status);      
        }
      });
    }
    else 
      msg.reply('Poll '+poll.pollNum+' is not yours to cancel');

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
    let callerUser = robot.brain.userForId(msg.message.user.id);

    if (!poll) {
      msg.reply('No poll number '+msg.match[2]);
      return;
    }
    else if (poll.closed) {
      msg.reply('Poll '+poll.pollNum+' closed. Status: '+poll.status);
      return;
    }
    if (!poll.votes) 
      poll.votes = {};
    else if (poll.votes[callerUser.id]) {
      //already voted
      msg.reply('You have already voted on this poll\n'+"Use command 'change vote on poll [1] to [A]' to change your vote");
      return;
    }

    let voteIndex = poll.letters.indexOf(vote);
    let voteText = poll.choices[voteIndex];

    if (voteIndex < 0 || voteIndex >= poll.numOptions ) {
      msg.reply('No poll option '+vote);
      return;
    }

    msg.reply('You have voted '+vote+':'+voteText+ ' on poll '+msg.match[2]+':'+poll.title);
    poll.votes[callerUser.id] = voteIndex;

    if (!callerUser.polls)
      callerUser.polls = {};
    
    callerUser.polls[poll.pollId] = {vote:voteIndex};
    if (poll.scope === 'partial' || poll.scope === 'part') {
      
      let newEndDate = Moment().add(30,'seconds').toDate();
      let success = poll.schedule.reschedule(newEndDate);
      if (success)
        msg.reply('Poll #'+poll.pollNum+' is extended by 30 seconds');
      else 
        msg.reply('Problem extending Poll #'+poll.pollNum);
    }
    robot.brain.set(poll.pollId, poll);
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
    let callerUser = robot.brain.userForId(msg.message.user.id);
    let poll = robot.brain.get(pollList[pollIndex]);

    if (!poll) {
      msg.reply('No poll number '+msg.match[1]);
      return;
    }    
    else if (poll.closed) {
      msg.reply('Poll '+poll.pollNum+' closed. Status: '+poll.status);
      return;
    }
    if (!poll.votes || !poll.votes[callerUser.id]) {
      //not already voted
      msg.reply('No vote to change. You have never voted on this poll');      
      return;
    }
    
    if (voteIndex < 0 || voteIndex >= poll.numOptions ) {
      msg.reply('No poll option '+vote);
      return;
    }
    poll.votes[callerUser.id] = voteIndex; 
    callerUser.polls[poll.pollId].vote = {vote:voteIndex};
    robot.brain.set(poll.pollId, poll);
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
    let dUser  = robot.brain.userForName(delegateUsername);

    if (dUser === undefined) {
      msg.reply('No username: '+delegateUsername+'. Have you spelled it correctly?');
      return;
    }

    let pollIndex = msg.match[1];
    let callerUser = robot.brain.userForId(msg.message.user.id);
    let poll = robot.brain.get(pollList[pollIndex]);

    if (!poll) {
      msg.reply('No poll number '+msg.match[1]);
      return;
    }
    else if (poll.closed) {
      msg.reply('Poll '+poll.pollNum+' closed. Status: '+poll.status);
      return;
    }
    if (!poll.votes) 
      poll.votes = [];
    else if (poll.votes[callerUser.id]) {
      //already voted
      msg.reply('You have already voted on this poll\n'+"Use command 'change delegate vote on poll [1] to [username]' to change your vote"); 
      return;
    }

    poll.votes[callerUser.id] = dUser.id;

    if (!callerUser.polls)
      callerUser.polls = {};
    
    callerUser.polls[poll.pollId] = {vote:dUser.id};
    robot.brain.set(poll.pollId, poll);
    robot.brain.save();

    msg.reply('Delegated vote to '+delegateUsername+' on poll '+pollIndex+':'+poll.title);
  });

  robot.respond(/change delegate vote on poll ([0-9]{1,2}) to ([A-Za-z][A-Za-z0-9._]{2,25})/i, function(msg) {

    if (!userHasRole(msg,'core'))
    return;

    let pollList = robot.brain.get('polls');
    if (pollList === undefined) {
      msg.reply('No polls underway.');
      return;
    }
    let delegateUsername = msg.match[2];
    let dUser  = robot.brain.userForName(delegateUsername);
    
    if (dUser === undefined) {
      msg.reply('No username: '+delegateUsername+'. Have you spelled it correctly?');
      return;
    }

    let pollIndex = msg.match[1];
    let callerUser = robot.brain.userForId(msg.message.user.id);
    let poll = robot.brain.get(pollList[pollIndex]);

    if (!poll) {
      msg.reply('No poll number '+msg.match[1]);
      return;
    }
    else if (poll.closed) {
      msg.reply('Poll '+poll.pollNum+' closed. Status: '+poll.status);
      return;
    }
    if (!poll.votes || !poll.votes[callerUser.id]) {
      //not already voted
      msg.reply('No vote to change. You have never voted on this poll');      
      return;
    }
    
    poll.votes[callerUser.id] = dUser.id;

    if (!callerUser.polls)
      callerUser.polls = {};
    callerUser.polls[poll.pollId] = {vote:dUser.id};
    robot.brain.set(poll.pollId, poll);
    robot.brain.save();

    msg.reply('Changed vote to delegate to '+delegateUsername+' on poll '+pollIndex+':'+poll.title);
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
    let callerUserId = msg.message.user.id;
    var pollList = robot.brain.get('polls');          
    if (!pollList) {
        msg.reply('No polls underway.');
        return;
    }
    let openPollList = '';
    for (let i=0; i<pollList.length; i++) {
      var poll = robot.brain.get(pollList[i]);      
      if (!poll.closed && poll.votes[callerUserId] === undefined) {          
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

  robot.respond(/show poll ([0-9]{1,2})/i, function(msg) {
    
    let callerUserId = msg.message.user.id;
    let callerUser = robot.brain.userForId(callerUserId);

    if (!userHasRole(msg,'core'))
      return;
      
    let pollList = robot.brain.get('polls');

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
    
    if (poll.closed) {
      replyString += 'Poll has already closed\n'; 
      if (poll.status === 'complete') {
        replyString += 'Result: '+poll.results.winner.letter+' with '+poll.results.winner.count+' votes\n';   
      
        if (callerUser.polls && callerUser.polls[poll.pollId]) {
          let p = callerUser.polls[poll.pollId];
          if (p.vote === 'A')
            replyString += 'Your vote was counted as No due to '+p.status+'\n';
          else {
            if (!isNaN(p.vote))
              replyString += 'You voted '+poll.letters[p.vote];
            else {          
              let dUser = robot.brain.userForId(p.vote);
              let dUserVote = poll.votes[dUser];
              replyString += 'You delegated your vote to '+dUser.name+' who voted '+poll.letters[dUserVote]+': '+poll.choices[dUserVote];
            }
          }
        }
      }
      else if (poll.status === 'cancelled') {
        replyString += 'Poll was cancelled. No Results.';   
      }
    }
    else {
      if (poll.votes[callerUserId] !== undefined) {
        replyString += 'You have previously voted on this poll.' +'\n';
        replyString += 'You voted '+poll.choices[poll.votes[callerUserId]]+'\n';        
      }   
      else {
        replyString += 'You have not yet voted on this poll.' +'\n';
      }    

      let end = Moment(pollData.endTime);
      replyString += 'Poll ends '+end.fromNow();
    }
    
    msg.reply(replyString);
  });

  robot.respond(/audit poll ([0-9]{1,2})/i, function(msg) {
    let callerUserId = msg.message.user.id;
    let callerUser = robot.brain.userForId(callerUserId);

    if (!userHasRole(msg,'core'))
      return;
      
    let pollList = robot.brain.get('polls');

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
    if (!poll.closed) {
      msg.reply('Poll not complete. Status: '+poll.status);
      return;
    }

    
    
    let replyString = '*Audit of Poll #'+poll.pollNum+':*\n';    
    replyString += 'Participants: '+poll.participants+'\n';
    for (let i in poll.participants) {
      let userName = poll.participants[i];
      let u = robot.brain.userForName(userName);
      let p = u.polls[poll.pollId];
      if (p.status === 'Delegated') {
        let d = robot.brain.userForId(p.origVote);
        replyString += u.name + ' delegated their vote to ' +d.name+ ' who voted '+poll.letters[p.vote]+'\n';
      }
      else if (p.vote === 'A' && p.status !== 'Absence') {
        let d = robot.brain.userForId(p.origVote);
        replyString += u.name + ' delegated their vote to ' +d.name+ ' but was counted as Absent due to '+p.status+'\n';        
      }
      else if (p.vote === 'A') {
        replyString += u.name + ' did not vote and was counted Absent\n';
      }
      else if (p.vote) {
        replyString += u.name + ' voted '+p.vote+'\n';
      }
      else {
        replyString += u.name + ' did not vote\n';
        console.log('missing vote record ',u);
      }      
    }
    let absentUsers = poll.participants.slice();
    replyString += '\nVotes as Counted:\n';
    Object.keys(poll.votes).forEach(function(userId) {   
      let u = robot.brain.userForId(userId);
      let vote = poll.votes[userId];
      if (isNaN(vote)) {
        let d = robot.brain.userForId(vote);
        replyString += u.name+' delegated: '+vote+' ('+d.name+')\n';
      }
      else 
        replyString += u.name+' voted: '+vote+'\n';

      let i = absentUsers.indexOf(u.name);        
      absentUsers.splice(i,1);
    });
    if (poll.scope === 'full') {
      for (let i in absentUsers) {
        let userId = absentUsers[i];
        let u = robot.brain.userForId(userId);
        replyString += u.name+' was marked absent\n';
      }
    }
    replyString += '\nVote Tally:\n';
    for (let i=0;i<poll.numOptions;i++) {    
      let letter = poll.letters[i];      
      replyString += poll.results.votes[letter].count+' votes for '+letter+': '+poll.results.votes[letter].choice+'\n';
    }
    if (poll.results.votes['A'])
      replyString += poll.results.votes['A'].count+' votes marked A: Absent\n';

    if (poll.type === 'choice') {       
      if (poll.results.draw.length > 0)
        replyString += 'Result: DRAW - no clear winner';
      else 
        replyString += 'Result: WIN - option '+poll.results.winner.letter+' with '+poll.results.winner.count+' votes';
    }
    else if (poll.type === 'proposal' || poll.type === 'prop') {
      if (poll.results.winner.letter === 'Y') {
        replyString += 'Result: PASSED - quorum reached for Y with '+poll.results.winner.count+' votes';  
      }
      else {
        replyString += 'Result: FAILED - no quorum with '+poll.results.winner.count+' votes for:'+poll.results.winner.choice;
      }
    }
    msg.reply(replyString);
  });
};
