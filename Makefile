.PHONY: deps test pub

deps:
	npm install
	npm link

test:
	npm run-script check
	npm run-script convert
	npm test

pub: deps
	npm publish .
