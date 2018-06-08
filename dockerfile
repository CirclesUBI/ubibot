FROM node:4.8.3 
LABEL "maintainer"="Circles Team <buildmaster@joincircles.net> "

ADD /bin/ /bin
ADD /scripts/ /scripts
ADD package.json .

RUN npm install &&  \
	useradd hubot -m
USER hubot 
WORKDIR /home/hubot
RUN mkdir -p /home/hubot/.ssh
# RUN mkdir -p /tmp/ssh_auth.sock
COPY /ssh/circles-rocketchat /home/hubot/.ssh/id_rsa
# RUN ssh-agent bash -c "ssh-add ~/id_rsa"

RUN echo "Host github.com\n\tStrictHostKeyChecking no\n" >> /home/hubot/.ssh/config

ENV BOT_NAME "ubibot" 
ENV BOT_OWNER "ed@joincircles.net" 	
ENV BOT_DESC "CirclesUBI bot" 
ENV ROCKETCHAT_URL "localhost"
ENV ROCKETCHAT_USER "ubibot"
ENV ROCKETCHAT_PASS "bot"

ENV EXTERNAL_SCRIPTS=hubot-diagnostics,hubot-help,hubot-rules

# && \
# 	sed -i /heroku/d ./external-scripts.json && \
# 	sed -i /redis-brain/d ./external-scripts.json && \
# 	npm install git+ssh://git@github.com:edzillion/hubot-dynamic-conversation.git && \
# 	npm install hubot-scripts

# COPY /hubot-rocketchat /home/hubot/node_modules/hubot-rocketchat
# COPY /node-schedule /home/hubot/node_modules/node-schedule

# hack added to get around owner issue: https://github.com/docker/docker/issues/6119 
USER root 
# RUN chown hubot:hubot -R /home/hubot/node_modules/hubot-rocketchat
# RUN chown hubot:hubot -R /home/hubot/node_modules/node-schedule
RUN chown hubot:hubot -R /home/hubot/.ssh
# RUN ssh-agent /home/hubot/.ssh
RUN chmod 700 /home/hubot/.ssh/id_rsa
RUN chmod 700 /home/hubot/.ssh/config
# RUN echo "\n# Default Github" >> /etc/ssh/ssh_config 
# RUN echo "Host *" >> /etc/ssh/ssh_config 
# RUN echo "    User hubot" >> /etc/ssh/ssh_config
# RUN echo "    IdentityFile ~/.ssh/id_rsa" >> /etc/ssh/ssh_config
USER hubot 

# RUN cd /home/hubot/node_modules/node-schedule && \
# 	npm install && \
RUN cd /home/hubot
CMD node -e "console.log(JSON.stringify('$EXTERNAL_SCRIPTS'.split(',')))" > external-scripts.json && \
	npm install $(node -e "console.log('$EXTERNAL_SCRIPTS'.split(',').join(' '))") && \
	bin/hubot -n $BOT_NAME -a rocketchat