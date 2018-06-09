FROM node:4.8.3 
LABEL "maintainer"="Circles Team <buildmaster@joincircles.net> "

RUN useradd hubot -m
USER hubot
COPY ./bin /home/hubot/bin/

COPY ./scripts /home/hubot/scripts/
COPY package.json /home/hubot/package.json
COPY /ssh/circles-rocketchat /home/hubot/.ssh/id_rsa

USER root

RUN chmod 700 /home/hubot/.ssh/id_rsa
RUN chown hubot:hubot -R /home/hubot/.ssh 
RUN chown hubot:hubot -R /home/hubot/bin 
RUN chmod +x /home/hubot/bin/hubot

WORKDIR /home/hubot
USER hubot

RUN npm install

ENV BOT_NAME "ubibot" 
ENV BOT_OWNER "ed@joincircles.net" 	
ENV BOT_DESC "CirclesUBI bot" 
ENV ROCKETCHAT_URL "localhost"
ENV ROCKETCHAT_USER "ubibot"
ENV ROCKETCHAT_PASS "bot"

ENV EXTERNAL_SCRIPTS=hubot-diagnostics,hubot-help,hubot-rules
RUN ls -l /home/hubot/bin/hubot

CMD	/home/hubot/bin/hubot -n $BOT_NAME -a rocketchat