/**
 * Created by etosch on 8/15/15.
 */
jest.dontMock("./globals.js")
    .dontMock("../survey.js");

var { survey } = require("../survey");

describe("New ordering mechanism is implemented correctly.", function() {
   it("parses ordered questions correctly in Ipierotis.csv", function() {
       var globals = require("./globals");
       var parsedSurvey = survey.init(globals.ipierotis);
       //expect(parsedSurvey.topLevelBlocks[1].topLevelQuestions[0].ordered).toBeTruthy();
   });
});

//describe('Top-level auxiliary function tests.', function () {
//  it('parses boolean values, taking into account our freetext rules', function() {
//    var survey = require('../survey').survey;
//    var asdf;
//    expect(survey._parseBools(asdf, true, null)).toBe(true);
//    expect(survey._parseBools(asdf, 'fdsa', null)).toBe('fdsa');
//  });
//});
//
//describe('Option constructor test', function () {
//  it('ensures that an error occurs if the provided json is malformed.', function () {
//    var {Option} = require('../survey').survey;
//    expect(new Option({'id', 'asdf', 'otext', 'fdsa'})).toBeDefined();
//    expect(function () { new Option({'id', 'fads'}) }).toThrow();
//  });
//});

