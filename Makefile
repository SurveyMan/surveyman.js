.PHONY: deps test pub

deps:
	npm link

test:
	npm test

pub: deps
	npm publish .
