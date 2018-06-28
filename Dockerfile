FROM node:8.11.2
LABEL "maintainer"="Circles Team <buildmaster@joincircles.net> "

RUN useradd hubot -m
USER hubot
COPY ./bin /home/hubot/bin/

COPY ./scripts /home/hubot/scripts/
COPY package.json /home/hubot/package.json
COPY external-scripts.json /home/hubot/external-scripts.json

USER root

RUN chown hubot:hubot -R /home/hubot/bin 
RUN chmod +x /home/hubot/bin/hubot

WORKDIR /home/hubot
RUN npm install
USER hubot

ENV BOT_NAME "ubibot" 
ENV BOT_OWNER "ed@joincircles.net" 	
ENV BOT_DESC "CirclesUBI bot" 

RUN npm list

# CMD npm install $(node -e "console.log('$EXTERNAL_SCRIPTS'.split(',').join(' '))") && \
CMD ./bin/hubot -a rocketchat