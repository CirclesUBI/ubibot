FROM node:8-slim
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

ENV EXTERNAL_SCRIPTS=hubot-diagnostics,hubot-help,hubot-rules

# RUN git clone https://github.com/vishnubob/wait-for-it.git
# RUN git clone https://github.com/eficode/wait-for.git

# CMD	/home/hubot/bin/hubot -n $BOT_NAME -a rocketchat
CMD npm run local