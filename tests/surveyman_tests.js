console.log("surveyman tests");

var s = require("string");
var _ = require("underscore");
require("./globals.js");

require("../surveyman.js");

for (var i = 0 ; i < jsonizedSurveys.length ; i++) {
    var survey = SurveyMan.survey.init(jsonizedSurveys[1]);
    if (s(survey.filename).endsWith("prototypicality.csv")){
        console.assert(_.all(_.pick(survey.topLevelBlocks, "randomizable")));
    }
}