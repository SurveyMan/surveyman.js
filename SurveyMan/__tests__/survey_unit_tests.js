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