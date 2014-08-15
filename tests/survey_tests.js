console.log("surveyman tests");

var s = require("string");
var _ = require("underscore");
var $ = require("jquery");
var http = require("http");
var tv4 = require("tv4");
var assert = require("assert");
require("./globals.js");
require("../survey.js");

function test(jsonSurvey) {
    var schema,
        options = {
            hostname :  "surveyman.github.io",
            port : 80,
            path : "/Schemata/survey_output.json",
            method : "GET"
        };
    http.get(options, function(response) {
        console.log("statusCode: ", response.statusCode);
        response.on('data', function(d) {
            schema= d.toString("UTF-8");
            var valid = tv4.validate(jsonSurvey, schema);
            console.log("valid?", valid);
            console.log("jsonizedSurvey:", jsonSurvey);
            var survey = SurveyMan.survey.init(jsonSurvey);
            console.log(survey.filename);
            if (s(survey.filename).endsWith("prototypicality.csv")){
                console.assert(_.all(_.pick(survey.topLevelBlocks, "randomizable")));
                for (var j = 0 ; j < survey.topLevelBlocks.length ; j++ ){
                    if (survey.topLevelBlocks[j].length===4)
                        console.assert(survey.topLevelBlocks[j].isBranchAll());
                    else console.assert(survey.topLevelBlocks.length===2);
                }
            }
        });
    }).on('error', function(e) {
            console.log("***",e,"***");
    });
}

for (var i = 0 ; i < jsonizedSurveys.length ; i++) {
    //validate the jsonizedSurvey against the json schema
    assert(!_.isUndefined(jsonizedSurveys) && !_.isUndefined(jsonizedSurveys[i]));
    test(jsonizedSurveys[i]);
}