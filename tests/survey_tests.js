console.log("surveyman tests");

var s = require("string");
var _ = require("underscore");
require("./globals.js");

require("../survey.js");

for (var i = 0 ; i < jsonizedSurveys.length ; i++) {
    var survey = SurveyMan.survey.init(jsonizedSurveys[1]);
    if (s(survey.filename).endsWith("prototypicality.csv")){
        console.assert(_.all(_.pick(survey.topLevelBlocks, "randomizable")));
        for (var j = 0 ; j < survey.topLevelBlocks.length ; j++ ){
            if (survey.topLevelBlocks[j].length===4)
                console.assert(survey.topLevelBlocks[j].isBranchAll());
            else console.assert(survey.topLevelBlocks.length===2);
        }
    }
}