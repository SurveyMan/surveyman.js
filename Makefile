.PHONY: deps test pub

deps:
	npm install
	npm link

test:
	npm test

pub: deps
	npm publish SurveyMan
