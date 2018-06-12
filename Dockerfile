FROM node:8.11.2
LABEL "maintainer"="Circles Team <buildmaster@joincircles.net> "

RUN useradd hubot -m
USER hubot
COPY ./bin /home/hubot/bin/

COPY ./scripts /home/hubot/scripts/
COPY package.json /home/hubot/package.json

USER root

RUN chown hubot:hubot -R /home/hubot/bin 
RUN chmod +x /home/hubot/bin/hubot

WORKDIR /home/hubot
USER hubot

RUN npm install

RUN cd /home/hubot/node_modules/hubot-rocketchat && \
	npm install && \
	#coffee -c /home/hubot/node_modules/hubot-rocketchat/src/*.coffee && \
  cd /home/hubot

ENV BOT_NAME "ubibot" 
ENV BOT_OWNER "ed@joincircles.net" 	
ENV BOT_DESC "CirclesUBI bot" 

ENV EXTERNAL_SCRIPTS=hubot-diagnostics,hubot-help,hubot-rules

CMD bin/hubot -n $BOT_NAME -a rocketchat