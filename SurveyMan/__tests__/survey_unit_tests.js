/**
 * Created by etosch on 8/15/15.
 */
jest.dontMock("./globals.js")
    .dontMock("../survey.js")
    .dontMock("underscore");

describe("New ordering mechanism is implemented correctly.", function() {
   it("parses ordered questions correctly in Ipierotis.csv", function() {
       var globals = require("./globals");
       var survey = require("../survey").survey;
       var parsedSurvey = survey.init(globals.ipierotis);
       expect(parsedSurvey.topLevelBlocks[1].topLevelQuestions[0].ordered).toBeTruthy();
   });
});

describe('Top-level auxiliary function tests.', function () {
  it('parses boolean values, taking into account our freetext rules', function() {
    var survey = require('../survey').survey;
    var asdf;
    expect(survey._parseBools(asdf, true, null)).toBe(true);
    expect(survey._parseBools(asdf, 'fdsa', null)).toBe('fdsa');
  })
});