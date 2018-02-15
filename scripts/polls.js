// Description:
//   Polling system for proposal and mutliple-choice votes.
//
// Dependencies:
//   "hubot-dynamic-conversation":"1.0.1", 
//   "node-schedule":"1.3.0", 
//   "moment":"2.20.1", 
//   "guid":"0.0.12"
//
// Configuration:
//
// Commands:
//    hubot start a poll - Starts a new poll
//    hubot cancel poll - Cancel a poll
//    hubot vote <letter> on poll <number>  - Vote
//    hubot change vote on poll <number> to <letter> - Change vote
//    hubot delegate vote on poll <number> to <username> - Delegate vote
//    hubot change delegate vote on poll <number to <username> - Change vote to delegate
//    hubot list polls - List all polls
//    hubot list open polls - List open polls you have not voted on
//    hubot show poll <number> - Show poll details
//    hubot audit poll <number> - Audit poll results
//    hubot veto poll - Vetoes a passed poll
//
// Author:
//   edzillion@joincircles.net

"use strict";

const DynamicConversation = require('hubot-dynamic-conversation');

const Schedule = require('node-schedule');

const Moment = require('moment');

const Guid = require('guid');

const pollTitlePosition = 0;
const pollTypePosition = 1;
const pollScopePosition = 2;
const pollDescriptionPosition = 3;
const pollLinkPosition = 4;
const pollNumOptionsPosition = 5;
const pollChoicesPosition = 6;
const pollProposalPosition = 5;

const pollingRoomName = 'polling-internal';

const pollingTerm = {amount:'1',type:'day'};
const pollingInterval = {amount:'2',type:'hours'};
const vetoTerm = {amount:'1',type:'day'};

const confirmConversationModel = {
  abortKeyword: "quit",
  onAbortMessage: "You have cancelled this conversation.",  
  conversation: [
    {
      question: "Are you sure? [Y/y/N/n]",
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
      error: "Sorry, I didn't understand your response. Please say [Y/y] or [N/n]"      
    }
  ]
};

module.exports = function(robot) {
  
  
  function userHasRole(msg,role) {  

    robot.logger.info("Checking if user: "+msg.message.user.name+" has role "+role);
    console.log('userForName',msg.message.user.name);
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
    console.log(poll.pollLink);
    if (poll.pollLink)
      pollMessage += 'Link: '+poll.pollLink +'\n';
    
    for (let i=0; i<poll.numOptions; i++) {    
      pollMessage += poll.letters[i]+'. '+poll.choices[i] +'\n';
    }
    let end = Moment(poll.endTime);
    pollMessage += 'Poll ends '+end.fromNow();

    //all polls announced to everyone
    let recipients = robot.auth.usersWithRole('core');
    console.log('sending poll '+poll.pollNum+' announce to:'+recipients);
    for (let i=0; i<recipients.length; i++) {
      console.log('userForName',recipients[i]);
      let targetUser = robot.brain.userForName(recipients[i]);                    
      robot.adapter.sendDirect({user:targetUser}, pollMessage);
    }

    robot.send({room:pollingRoomName},pollMessage);
  }
  
  function endPoll(pollId) {
    
    let poll = robot.brain.get(pollId);

    if (poll === undefined) {
      console.log('Error: poll not found in brain: '+pollId);
    }

    poll.results = {};
    poll.results.votes = {};
    poll.results.votes['A'] =  {choice:'Absent',count:0,letter:'A'};
    poll.results.draw = [];

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
                console.log('userForId',userId);
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
        console.log('userForId',userId);
        let user = robot.brain.userForId(userId);
        let p = user.polls[poll.pollId];
        p.origVote = p.vote;
        p.vote = 'A';
        p.status = 'Circular Delegation';
        poll.results.votes['A'].count++;       
      }
      for (let i in poll.absentDelegates) {
        let userId = poll.absentDelegates[i];
        console.log('userForId',userId);
        let user = robot.brain.userForId(userId);
        let p = user.polls[poll.pollId];
        p.origVote = p.vote;
        p.vote = 'A';
        p.status = 'Delegate Absent';
        poll.results.votes['A'].count++;           
      }        

      let pollCounts = {};
      Object.keys(poll.votes).forEach(function(userId, key, _array) {      
        let num = poll.votes[userId];
        if (num !== undefined)
          pollCounts[num] = pollCounts[num] ? pollCounts[num] + 1 : 1;
      });

      let nonVoters = poll.participants.slice();
      console.log('all voters:',nonVoters);
          
      for (const userId of Object.keys(poll.votes)) {
        let i = nonVoters.indexOf(userId);        
        nonVoters.splice(i,1);
        console.log(userId+' voted');
      }

      for (let i=0;i<nonVoters.length;i++) {
        let userId = nonVoters[i];
        console.log('userForId',userId);
        let user = robot.brain.userForId(userId);
        if (!user.polls)
          user.polls = {};
        user.polls[poll.pollId] = {          
          vote: 'A',
          status:'Absence'          
        }; 
        console.log(user.name+' set absent '+userId);
      }               
      poll.results.votes['A'].count += nonVoters.length;
      
      if (poll.type === 'choice') {        
        
        for (let i=0;i<poll.numOptions;i++) {          
          let letter = poll.letters[i];
          let pollChoice = poll.choices[i];
          let voteCount = pollCounts[i] || 0;
          poll.results.votes[i] = {choice:pollChoice,count:voteCount,letter:letter};
        
          if (!poll.results.winner) {
            poll.results.winner = Object.assign({},poll.results.votes[i]);
            //console.log('winner',poll.results.winner);            
          }
          else if (voteCount > poll.results.winner.count) {
            poll.results.winner = Object.assign({},poll.results.votes[i]);
            //console.log('winner',poll.results.winner);
            poll.results.draw = [];
          }
          else if (voteCount === poll.results.winner.count) {
            poll.results.draw.push(i);
            //console.log('draw',poll.results.draw);
            let num = poll.letters.indexOf(poll.results.winner.letter);
            if (poll.results.winner.choice !== null && poll.results.draw.indexOf(num) === -1)
              poll.results.draw.push(num);            
          }
        }
        if (poll.results.draw.length > 0)
          poll.results.winner = null;
        
        if (poll.scope === 'full' || poll.results.winner) {
          poll.closed = true;
          poll.passed = true;
          poll.status = (poll.scope === 'full') ? 'Complete': 'Choice reached early';
        }
        else {
          let now = Moment();
          poll.endTime = Moment(poll.endTime);
          if (poll.endTime.isBefore(now)) {
            poll.closed = true;
            poll.passed = false;
            poll.status = 'Ended without clear choice';
          }
          else {
            //set to endPoll() at the original endtime. this will be interrupted by any votes cast
            console.log('no quorum reached, extending to endTime');
            poll.schedule = Schedule.scheduleJob(poll.endTime.toDate(), function(pollId){
              endPoll(pollId);
            }.bind(null,poll.pollId));            
            poll.closed = false;
            poll.status = 'Ongoing';
          }
        }
      }
      else if (poll.type === 'proposal' || poll.type === 'prop') {            
        
        for (let i=0;i<poll.numOptions;i++) {          
          let letter = poll.letters[i];
          let pollChoice = poll.choices[i];
          let voteCount = pollCounts[i] || 0;
          poll.results.votes[i] = {choice:pollChoice,count:voteCount,letter:letter};
        }

        let yesVotes = poll.results.votes['1'].count;
        let noVotes = (poll.scope === 'full')  ? poll.results.votes['0'].count + poll.results.votes['A'].count : poll.results.votes['0'].count;
        if (yesVotes >= 2 && yesVotes /2 >= noVotes) {
          poll.results.winner = poll.results.votes['1'];
          poll.closed = true;
          poll.passed = true;
          poll.status = (poll.scope === 'full') ? 'Complete': 'Quorum reached early';
        }
        else {
          if (poll.scope === 'full') {
            poll.results.winner = {choice:'No or Absent',count:noVotes,letter:'NA'};            
            poll.closed = true;
            poll.passed = false;
            poll.status = 'Complete';
          }
          else {  
            poll.results.winner = poll.results.votes['0'];
            let now = Moment();
            poll.endTime = Moment(poll.endTime);
            if (poll.endTime.isBefore(now)) {              
              poll.closed = true;
              poll.passsed = false;
              poll.status = 'Ended without quorum';
            }
            else {
              //set to endPoll() at the original endtime. this will be interrupted by any votes cast
              console.log('no quorum reached, extending to endTime');
              poll.schedule = Schedule.scheduleJob(poll.endTime.toDate(), function(pollId){
                endPoll(pollId);
              }.bind(null,poll.pollId));
              poll.closed = false;
              poll.status = 'Ongoing';
            }
          }
        }
      }
    }
    else {
      poll.results.winner = {choice:'No Votes Cast',count:0,letter:'NV'};
      poll.closed = true;
      poll.passed = false;
      poll.status = 'Not enough voters';
    }
    
    if (poll.closed)
      announcePollEnd(pollId);
  }
  
  function announcePollEnd(pollId) {
    
    let poll = robot.brain.get(pollId);
    if (poll === undefined)
      return console.log('Error: poll not found in brain: '+pollId);
      
    let resultText = '*Poll #'+(poll.pollNum)+' complete!*\n';

    if (poll.votes === undefined) {
      resultText += 'Poll FAILED, no votes cast';      
    } 
    else {   
    
      resultText += 'Vote Tally:\n';
  
      for (let i=0;i<poll.numOptions;i++) {    
        let letter = poll.letters[i];      
        resultText += poll.results.votes[i].count+' votes for '+letter+': '+poll.results.votes[i].choice+'\n';
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
          resultText += 'Result: FAILED - no quorum with '+poll.results.winner.count+' votes for:'+poll.results.winner.letter;
        }
      }
    }
  
    let pollParticipants = poll.participants;
    console.log('sending poll '+poll.pollNum+' end to:'+pollParticipants);
    for (let i=0; i<pollParticipants.length; i++) { 
      console.log('userForId',pollParticipants[i]);     
      let targetUser = robot.brain.userForId(pollParticipants[i]);                    
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
          question: "Optionally add a link to further information (not required):",
          answer: {
            type: "text"
          },
          required: false,
          error: "Sorry your response didn't contain any text, please add your link or say [skip]."
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
              question: "Now enter the No/Against option (not required):",
              answer: {
                type: "text"
              },
              required: false,
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
              question: "Now enter the No/Against option (not required):",
              answer: {
                type: "text"
              },
              required: false,
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
      if (pollDialog.data.aborted)
        return console.log('poll aborted');

      //msg.reply("Thanks for using ubibot! I'm always here to help.");
      let dialogData = pollDialog.fetch();
      console.log(dialogData);
      let pollData = {
        title: capitalizeFirstLetter(dialogData.answers[pollTitlePosition].response.value),
        description: capitalizeFirstLetter(dialogData.answers[pollDescriptionPosition].response.value),
        type: dialogData.answers[pollTypePosition].response.value,
        scope: dialogData.answers[pollScopePosition].response.value,
        letters: null,
        numOptions: null,
        choices: [],        
        votes: {},
        proposer:msg.message.user.id,
        closed: false,
        status: 'Active'
      };
      
      if (pollData.scope === 'full') {
        let users = robot.auth.usersWithRole('core');
        for (let i=0; i<users.length; i++) {
          let user = robot.brain.userForName(users[i]);
          pollData.participants.push(user.id);
        }
      }
      else 
        pollData.participants = [];

      pollData.pollLink = (dialogData.answers[pollLinkPosition].response.value === 'skip') ? null : dialogData.answers[pollLinkPosition].response.value;

      if (pollData.type === 'choice') {
        pollData.numOptions = Number(dialogData.answers[pollNumOptionsPosition].response.value);
        for (let i=0; i<pollData.numOptions; i++) {
          let str = capitalizeFirstLetter(dialogData.answers[pollChoicesPosition+i].response.value);
          pollData.choices.push(str);
        }
        pollData.letters = ['A','B','C','D','E','F','G','H','I','J'];
      }
      else {
        let noChoice = (dialogData.answers[pollProposalPosition+1].response.value === 'skip') ? 'Against' : dialogData.answers[pollProposalPosition+1].response.value;
        pollData.choices[0] = capitalizeFirstLetter(noChoice);
        pollData.choices[1] = capitalizeFirstLetter(dialogData.answers[pollProposalPosition].response.value);
        pollData.choices[2] = 'Indifferent';
        pollData.letters = ['N','Y','I'];
        pollData.numOptions = 3;
      }

      pollData.endTime = Moment().add(pollingTerm.amount,pollingTerm.type);
      pollData.pollId = 'poll:'+Guid.create();     

      let draftPollNum = (pollList) ? pollList.length : 0;
      let pollMessage = 'Poll #'+draftPollNum+' - draft:\n';
      pollMessage += 'Title: '+pollData.title + ' ('+pollData.type.toUpperCase()+')\n';
      pollMessage += 'Description: '+pollData.description +'\n';
      if (pollData.pollLink)
        pollMessage += 'Link: '+pollData.pollLink +'\n';
      
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
            question: "Does this look right? [Y/y] to confirm [N/n] to cancel",          
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
            error: "Sorry, I didn't understand your response. Please say [Y/y] or [N/n]"
          }              
        ]
      };

      conversation.start(msg, pollConfirmConversationModel, function(err, msg, confirmDialog) {

        let dialogData = confirmDialog.fetch();
        let answer = dialogData.answers[0].response.value.toUpperCase();
        if (answer === 'Y') {
          console.log('userForId',msg.message.user.id);
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

          pollData.schedule = Schedule.scheduleJob(pollData.endTime.toDate(), function(pollId){
            endPoll(pollId);
          }.bind(null,pollData.pollId));

          pollData.startTime = Moment();

          robot.brain.set(pollData.pollId, pollData);
          return startPoll(pollData.pollId);
        }
        else {
          return msg.reply('Poll deleted.');          
        }
      });
    });    
  });

  robot.respond(/cancel poll ([0-9]{1,2})/i, function(msg) {

    if (!userHasRole(msg,'core'))
      return;
        
    let pollList = robot.brain.get('polls');
    if (pollList === undefined)
      return msg.reply('No polls underway.');     

    let pollIndex = msg.match[1];
    let poll = robot.brain.get(pollList[pollIndex]);    
    console.log('userForId',msg.message.user.id);
    let callerUser = robot.brain.userForId(msg.message.user.id);

    if (!poll)
      return msg.reply('No poll number '+msg.match[2]);      
    else if (poll.closed)
      return msg.reply('Poll '+poll.pollNum+' closed. Status: '+poll.status);      
    
    if (poll.proposer === callerUser.id) {
      conversation.start(msg, confirmConversationModel, function(err, msg, confirmDialog) {
        let dialogData = confirmDialog.fetch();
        let answer = dialogData.answers[0].response.value.toUpperCase();
        if (answer === 'Y') {          
          poll.closed = true;
          poll.status = 'cancelled';
          poll.passed = false;
          poll.schedule.cancel();    
          return msg.reply('Poll '+poll.pollNum+' closed. Status: '+poll.status);      
        }
      });
    }
    else 
      return msg.reply('Poll '+poll.pollNum+' is not yours to cancel');

  });

  robot.respond(/vote ([a-zA-Z]) on poll ([0-9]{1,2})/i, function(msg) {

    if (!userHasRole(msg,'core'))
      return;

    let pollList = robot.brain.get('polls');
    if (pollList === undefined)
      return msg.reply('No polls underway.');
      
    let vote = msg.match[1].toUpperCase();
    let pollIndex = msg.match[2];
    let poll = robot.brain.get(pollList[pollIndex]);    
    console.log('userForId',msg.message.user.id);
    let callerUser = robot.brain.userForId(msg.message.user.id);

    if (!poll)
      return msg.reply('No poll number '+msg.match[2]);     
    else if (poll.closed)
      return msg.reply('Poll '+poll.pollNum+' closed. Status: '+poll.status);      
    
    if (!poll.votes) 
      poll.votes = {}; 
    else if (poll.votes[callerUser.id] !== undefined)      
      return msg.reply('You have already voted on this poll\n'+"Use command 'change vote on poll [1] to [A]' to change your vote");

    let voteIndex = poll.letters.indexOf(vote);
    let voteText = poll.choices[voteIndex];

    if (voteIndex < 0 || voteIndex >= poll.numOptions )
      return msg.reply('No poll option '+vote);          

    msg.reply('You have voted '+vote+' on poll '+msg.match[2]+':'+poll.title);
    poll.votes[callerUser.id] = voteIndex;

    if (!callerUser.polls)
      callerUser.polls = {};
    
    callerUser.polls[poll.pollId] = {vote:voteIndex};
    if (poll.scope === 'partial' || poll.scope === 'part') {      
      poll.participants.push(callerUser.id);
      if (Object.keys(poll.votes).length > 1) {
        let newEndDate = Moment().add(pollingInterval.amount,pollingInterval.type).toDate();
        let success = poll.schedule.reschedule(newEndDate);
        if (success)
          return msg.reply('Poll #'+poll.pollNum+' will be closed if quorum is reached in '+pollingInterval.amount+' '+pollingInterval.type);
        else 
          return msg.reply('Problem extending Poll #'+poll.pollNum);
      }
    }
  });

  robot.respond(/change vote on poll ([0-9]{1,2}) to ([a-zA-Z])/i, function(msg) {

    if (!userHasRole(msg,'core'))
      return;

    let pollList = robot.brain.get('polls');
    if (pollList === undefined)
      return msg.reply('No polls underway.');      
    
    let vote = msg.match[2].toUpperCase();
    let pollIndex = msg.match[1];    
    console.log('userForId',msg.message.user.id);
    let callerUser = robot.brain.userForId(msg.message.user.id);
    let poll = robot.brain.get(pollList[pollIndex]);

    if (!poll)
      return msg.reply('No poll number '+msg.match[1]);      
    else if (poll.closed)
      return msg.reply('Poll '+poll.pollNum+' closed. Status: '+poll.status);
          
    if (!poll.votes || poll.votes[callerUser.id] === undefined)      
      return msg.reply('No vote to change. You have never voted on this poll');      
    
    let voteIndex = poll.letters.indexOf(vote);
    if (voteIndex < 0 || voteIndex >= poll.numOptions )
      return msg.reply('No poll option '+vote);
      
    poll.votes[callerUser.id] = voteIndex; 
    callerUser.polls[poll.pollId] = {vote:voteIndex};        

    let replyString = 'Changed vote to '+vote+': '+poll.choices[voteIndex]+ ' on poll '+pollIndex+':'+poll.title;    
    if (poll.scope === 'partial' || poll.scope === 'part')
      replyString += '\nChanging vote does not extend poll deadline';
    
    return msg.reply(replyString);
  });

  robot.respond(/delegate vote on poll ([0-9]{1,2}) to ([A-Za-z][A-Za-z0-9._]{2,25})/i, function(msg) {

    if (!userHasRole(msg,'core'))
      return;

    let pollList = robot.brain.get('polls');
    if (pollList === undefined)
      return msg.reply('No polls underway.');
      
    let delegateUsername = msg.match[2];
    console.log('userForName',delegateUsername);
    let dUser  = robot.brain.userForName(delegateUsername);

    if (dUser === undefined)
      return msg.reply('No username: '+delegateUsername+'. Have you spelled it correctly?');      

    let pollIndex = msg.match[1];
    console.log('userForId',msg.message.user.id);
    let callerUser = robot.brain.userForId(msg.message.user.id);
    let poll = robot.brain.get(pollList[pollIndex]);

    if (!poll)
      return msg.reply('No poll number '+msg.match[1]);            
    else if (poll.closed)
      return msg.reply('Poll '+poll.pollNum+' closed. Status: '+poll.status);

    if (!poll.votes) 
      poll.votes = [];
    else if (poll.votes[callerUser.id] !== undefined)
      return msg.reply('You have already voted on this poll\n'+"Use command 'change delegate vote on poll [1] to [username]' to change your vote");       

    poll.votes[callerUser.id] = dUser.id;

    if (!callerUser.polls)
      callerUser.polls = {};
    
    callerUser.polls[poll.pollId] = {vote:dUser.id};

    if (poll.scope === 'partial' || poll.scope === 'part') {      
      poll.participants.push(callerUser.id);
      if (Object.keys(poll.votes).length > 1) {     
        let newEndDate = Moment().add(pollingInterval.amount,pollingInterval.type).toDate();
        let success = poll.schedule.reschedule(newEndDate);
        if (success)
          return msg.reply('Poll #'+poll.pollNum+' will be closed if quorum is reached in '+pollingInterval.amount+' '+pollingInterval.type);
        else 
          return msg.reply('Problem extending Poll #'+poll.pollNum);
      }
    }

    return msg.reply('Delegated vote to '+delegateUsername+' on poll '+pollIndex+':'+poll.title);
  });

  robot.respond(/change delegate vote on poll ([0-9]{1,2}) to ([A-Za-z][A-Za-z0-9._]{2,25})/i, function(msg) {

    if (!userHasRole(msg,'core'))
      return;

    let pollList = robot.brain.get('polls');
    if (pollList === undefined)
      return msg.reply('No polls underway.');
      
    let delegateUsername = msg.match[2];
    console.log('userForName',delegateUsername);
    let dUser  = robot.brain.userForName(delegateUsername);
    
    if (dUser === undefined)
      return msg.reply('No username: '+delegateUsername+'. Have you spelled it correctly?');

    let pollIndex = msg.match[1];
    console.log('userForId',msg.message.user.id);
    let callerUser = robot.brain.userForId(msg.message.user.id);
    let poll = robot.brain.get(pollList[pollIndex]);

    if (!poll)
      return msg.reply('No poll number '+msg.match[1]);    
    else if (poll.closed)
      return msg.reply('Poll '+poll.pollNum+' closed. Status: '+poll.status);
      
    if (!poll.votes || poll.votes[callerUser.id] === undefined)
      return msg.reply('No vote to change. You have never voted on this poll');      
          
    poll.votes[callerUser.id] = dUser.id;

    if (!callerUser.polls)
      callerUser.polls = {};
    callerUser.polls[poll.pollId] = {vote:dUser.id};

    let replyString = 'Changed vote to delegate to '+delegateUsername+' on poll '+pollIndex+':'+poll.title;
    if (poll.scope === 'partial' || poll.scope === 'part')
      replyString += '\nChanging vote does not extend poll deadline';
    
    return msg.reply(replyString);
  });

  robot.respond(/veto poll ([0-9]{1,2})/i, function(msg) {

    if (!userHasRole(msg,'core'))
      return;

    let pollList = robot.brain.get('polls');
    if (pollList === undefined)
      return msg.reply('No polls underway.');
      
    let pollIndex = msg.match[1];
    console.log('userForId',msg.message.user.id);
    let callerUser = robot.brain.userForId(msg.message.user.id);
    let poll = robot.brain.get(pollList[pollIndex]);

    let now = Moment();
    if (!poll)
      return msg.reply('No poll number '+msg.match[1]);    
    else {
      poll.endTime = Moment(poll.endTime);
      if (!poll.closed)
        return msg.reply('Poll #'+poll.pollNum+' is still open.');
      else if (poll.scope === 'full' && poll.participants.indexOf(callerUser.id) === -1)
        return msg.reply('Poll #'+poll.pollNum+' is not a poll you participated in.');
      else if (poll.endTime.add(vetoTerm.amount,vetoTerm.type).isAfter(now))
        return msg.reply('Poll #'+poll.pollNum+' closed over '+vetoTerm.amount+' '+vetoTerm.type+' ago.');
      else if (poll.status === 'Vetoed')
        return msg.reply('Poll #'+poll.pollNum+' already vetoed by '+robot.brain.userForId(poll.vetoedBy).fullName);
      else if (poll.passed === false)
        return msg.reply('Poll #'+poll.pollNum+' was not passed so cannot be vetoed.');
    }
     
    conversation.start(msg, confirmConversationModel, function(err, msg, confirmDialog) {
      let dialogData = confirmDialog.fetch();
      let answer = dialogData.answers[0].response.value.toUpperCase();
      if (answer === 'Y') {                  
        poll.status = 'Vetoed';
        poll.passed = false;
        poll.vetoedBy = callerUser.id;
        return msg.reply('Poll '+poll.pollNum+' vetoed. Status: '+poll.status);      
      }
      else {
        return msg.reply('Cancelled veto. Poll still valid');
      }
    });
  });

  robot.respond(/list polls/i, function(msg) {

    if (!userHasRole(msg,'core'))
      return;

    let pollList, poll;
    pollList = robot.brain.get('polls');          
    if (!pollList)
      return msg.reply('No polls underway.');
      
    let replyString = ''; 
    for (let i=0; i<pollList.length; i++) {
      poll = robot.brain.get(pollList[i]);
      replyString += i + '. ' + poll.title + ' ('+poll.status+')\n' ;        
    }    
    replyString = replyString.slice(0, -1); //cut of last '\n';
    return msg.reply(replyString);
  });

  robot.respond(/list open polls/i, function(msg) {

    if (!userHasRole(msg,'core'))
      return;

    let replyString = '';
    let callerUserId = msg.message.user.id;
    var pollList = robot.brain.get('polls');          
    if (!pollList)
      return msg.reply('No polls underway.');
      
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
    return msg.reply(replyString);
  });

  robot.respond(/list passed polls/i, function(msg) {

    if (!userHasRole(msg,'core'))
      return;

    let replyString = '';
    let callerUserId = msg.message.user.id;
    var pollList = robot.brain.get('polls');          
    if (!pollList)
      return msg.reply('No polls underway.');
      
    let passedPollList = '';
    for (let i=0; i<pollList.length; i++) {
      var poll = robot.brain.get(pollList[i]);      
      if (poll.closed && poll.passed) {          
        passedPollList += i + '. ' + poll.title + ' ('+poll.status+')\n' ;     
      }        
    } 
    if (passedPollList) {
      replyString = 'Polls that have been passed:\n' + passedPollList;
    }
    else {
      replyString = 'There are no current polls that have been passed.';
    }
    return msg.reply(replyString);
  });

  robot.respond(/list failed polls/i, function(msg) {

    if (!userHasRole(msg,'core'))
      return;

    let replyString = '';
    let callerUserId = msg.message.user.id;
    var pollList = robot.brain.get('polls');          
    if (!pollList)
      return msg.reply('No polls underway.');
      
    let passedPollList = '';
    for (let i=0; i<pollList.length; i++) {
      var poll = robot.brain.get(pollList[i]);      
      if (poll.closed && !poll.passed) {          
        passedPollList += i + '. ' + poll.title + ' ('+poll.status+')\n' ;     
      }        
    } 
    if (passedPollList) {
      replyString = 'Polls that have failed:\n' + passedPollList;
    }
    else {
      replyString = 'There are no current polls that have failed.';
    }
    return msg.reply(replyString);
  });

  robot.respond(/show poll ([0-9]{1,2})/i, function(msg) {
    
    let callerUserId = msg.message.user.id;
    console.log('userForId',callerUserId);
    let callerUser = robot.brain.userForId(callerUserId);

    if (!userHasRole(msg,'core'))
      return;
      
    let pollList = robot.brain.get('polls');

    if (!pollList)
      return msg.reply('No polls underway.');
      
    let pollIndex = msg.match[1];
    if (pollList[pollIndex] === undefined)
      return msg.reply('No poll number '+msg.match[1]);
      
    let poll = robot.brain.get(pollList[pollIndex]);        
    if (!poll)
      return msg.reply('No poll number '+msg.match[1]);
      

    let replyString = 'Title: '+poll.title + ' ('+poll.type.toUpperCase()+')\n';
    replyString += 'Description: '+poll.description +'\n';
    if (poll.pollLink)
      replyString += 'Link: '+poll.pollLink +'\n';

    for (let i=0; i<poll.numOptions; i++) {    
      replyString  += poll.letters[i]+'. '+poll.choices[i] +'\n';
    }
    
    if (poll.closed) {
      replyString += 'Poll has already closed\n'; 

      if (callerUser.polls && callerUser.polls[poll.pollId]) {
        let p = callerUser.polls[poll.pollId];
        if (p.vote === 'A')
          replyString += 'Your vote was counted as No due to '+p.status+'\n';
        else {
          if (!isNaN(p.vote))
            replyString += 'You voted '+poll.letters[p.vote]+'\n';
          else {          
            console.log('userForId',p.vote);
            let dUser = robot.brain.userForId(p.vote);
            let dUserVote = poll.votes[dUser];
            replyString += 'You delegated your vote to '+dUser.name+' who voted '+poll.letters[dUserVote]+': '+poll.choices[dUserVote]+'\n';
          }
        }
      }

      if (poll.status === 'cancelled') {
        replyString += 'Poll was cancelled. No Results.';   
      }
      else if (poll.results.draw.length > 0) {
        replyString += 'Result: '+poll.results.draw.length+'-way draw between '+poll.letters[poll.results.draw[0]]+' with '+poll.results.votes[poll.results.draw[0]].count+' votes\n';
        for (let i=1;i<poll.results.draw.length;i++)
          replyString += 'and '+poll.letters[poll.results.draw[i]]+' with '+poll.results.votes[poll.results.draw[i]].count+' votes\n';
      }
      else if (poll.results.winner) 
        replyString += 'Result: '+poll.results.winner.letter+' with '+poll.results.winner.count+' votes\n';   
    
      replyString += 'Status: '+poll.status+'\n';
      if (poll.status === 'Vetoed')
        replyString += '*This poll was vetoed by '+robot.brain.userForId(poll.vetoedBy).fullName+'*\n'
      replyString += (poll.passed) ? '*This poll PASSED and is in effect*' : '*This poll FAILED and has been discarded*';      

    }
    else {
      if (poll.votes[callerUserId] !== undefined) {
        let vote = poll.votes[callerUserId];
        replyString += 'You have previously voted on this poll.' +'\n';
        if (!isNaN(vote))
            replyString += 'You voted '+poll.letters[vote]+'\n';
          else {          
            let dUser = robot.brain.userForId(vote);
            replyString += 'You delegated your vote to '+dUser.name;
            replyString += (poll.votes[vote] !== undefined) ? ' who has voted.\n' : ' who has not voted yet.\n';
          } 
      }   
      else {
        replyString += 'You have not yet voted on this poll.' +'\n';
      }    

      let end = Moment(poll.endTime);
      replyString += 'Poll ends '+end.fromNow();
    }
    
    return msg.reply(replyString);
  });

  robot.respond(/audit poll ([0-9]{1,2})/i, function(msg) {
    let callerUserId = msg.message.user.id;
    console.log('userForId',callerUserId);
    let callerUser = robot.brain.userForId(callerUserId);

    if (!userHasRole(msg,'core'))
      return;
      
    let pollList = robot.brain.get('polls');

    if (!pollList)
      return msg.reply('No polls underway.');
      
    let pollIndex = msg.match[1];
    if (pollList[pollIndex] === undefined)
      return msg.reply('No poll number '+msg.match[1]);
      
    let poll = robot.brain.get(pollList[pollIndex]);        
    if (!poll)
      return msg.reply('No poll number '+msg.match[1]);
      
    if (!poll.closed) 
      return msg.reply('Poll not complete. Status: '+poll.status);
      
    
    let replyString = '*Audit of Poll #'+poll.pollNum+':*\n';    
    replyString += 'Participants:\n';
    for (let i in poll.participants) {
      let userId = poll.participants[i];
      console.log('userForId',userId);
      let u = robot.brain.userForId(userId);
      if (u.polls) {
        let p = u.polls[poll.pollId];      
        if (p.status === 'Delegated') {
          console.log('userForId',p.origVote);
          let d = robot.brain.userForId(p.origVote);
          replyString += u.fullName + ' delegated their vote to ' +d.name+ ' who voted '+poll.letters[p.vote]+'\n';
        }
        else if (p.vote === 'A' && p.status !== 'Absence') {
          console.log('userForId',p.origVote);
          let d = robot.brain.userForId(p.origVote);
          replyString += u.fullName + ' delegated their vote to ' +d.name+ ' but was counted as Absent due to '+p.status+'\n';        
        }
        else if (p.vote === 'A') {
          replyString += u.fullName + ' did not vote and was counted Absent\n';
        }
        else if (p.vote >= 0) {
          replyString += u.fullName + ' voted '+poll.letters[p.vote]+'\n';
        }
        else {
          replyString += u.fullName + ' did not vote\n';
          console.log('missing vote record ',u);
        }      
      }
      else {
        replyString += u.fullName + ' did not vote\n';
        console.log('missing vote record ',u);
      }      
    }
    let absentUsers = poll.participants.slice();
    replyString += '\nVotes as Counted:\n';
    Object.keys(poll.votes).forEach(function(userId) {   
      let vote = poll.votes[userId];
      console.log('userForId',userId);
      let user= robot.brain.userForId(userId);      
      if (isNaN(vote)) {
        console.log('userForId',vote);
        let delegateUser = robot.brain.userForId(vote);
        replyString += user.name+' delegated: '+vote+' ('+delegateUser.name+')\n';
      }
      else 
        replyString += user.name+' voted: '+poll.letters[vote]+'\n';

      let i = absentUsers.indexOf(user.id);        
      absentUsers.splice(i,1);
    });
    if (poll.scope === 'full') {
      for (let i in absentUsers) {
        let userId = absentUsers[i];
        console.log('userForId',userId);
        let user = robot.brain.userForId(userId);
        replyString += user.name+' was marked absent\n';
      }
    }
    replyString += '\nVote Tally:\n';
    for (let i=0;i<poll.numOptions;i++) {    
      let letter = poll.letters[i];      
      replyString += poll.results.votes[i].count+' votes for '+letter+': '+poll.results.votes[i].choice+'\n';
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
    return msg.reply(replyString);
  });

  // ADMIN ONLY COMMANDS
  robot.respond(/reset poll schedules/i, function(msg) {
    
    if (!userHasRole(msg,'admin'))
      return;
      
    let pollList = robot.brain.get('polls');
    if (!pollList)
      return msg.reply('No polls underway.');
    
    let replyString = '';
    let now = Moment();
    for (let i=0;i<pollList.length;i++) {
      let poll = robot.brain.get(pollList[i]);        
      if (!poll)
        console.log('No poll number '+msg.match[1]+' while updating schedules');
      
      poll.endTime = Moment(poll.endTime);
      if (!poll.closed && poll.endTime.isAfter(now)) {
        replyString += 'Setting schedule on poll number '+poll.pollNum+' status: '+poll.status+'\n';
        poll.schedule = Schedule.scheduleJob(poll.endTime.toDate(), function(pollId){
          endPoll(pollId);
        }.bind(null,poll.pollId));
      }
      else 
        replyString += 'Skipping poll number '+poll.pollNum+' status: '+poll.status+'\n';
    }
    return msg.reply(replyString);
  });
};
