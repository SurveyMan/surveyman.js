.PHONY: deps test pub

surveyTarget=surveyman/survey.js
interpTarget=surveyman/interpreter.js
displayTarget=surveyman/display.js
cache=.module-cache

deps:
	npm install
	npm link

test: clean deps
	npm run-script check
	npm run-script convert
	npm test

pub: deps
	npm publish .

clean:
	if [ -d $(cache) ]; then rm -rf $(cache); fi
	if [ -f $(surveyTarget) ]; then rm $(surveyTarget); fi
	if [ -f $(interpTarget) ]; then rm $(interpTarget); fi
	if [ -f $(displayTarget) ]; then rm $(displayTarget); fi