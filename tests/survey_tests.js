console.log("surveyman tests");

var s = require("string");
var _ = require("underscore");
var $ = require("jquery");
var http = require("http");
var JaySchema = require('jayschema');
var js = new JaySchema(JaySchema.loaders.http);
js.maxRecursion = 3;
var assert = require("assert");
require("./globals.js");
require("../survey.js");

function getSchema(callback) {
    var options = {
            hostname : "surveyman.github.io",
            port : 80,
            path : "/Schemata/survey_output.json",
            method : "GET"
        },
        schema = "",
        cbk = function(response) {

            console.log("status code:", response.statusCode);
            response.setEncoding("UTF-8");

            response.on("data", function (d){
                schema += d.toString();
            });

            response.on("end", function () {
                callback(JSON.parse(schema));
            });

        };

    var req = http.request(options, cbk);
    req.on("error", function (e){
        console.log("***",e,"***");
    });

    req.end();

};

function test(schema, jsonSurvey, expectedOutcome) {

    var ok = true;

    //var report = env.validate(jsonSurvey, JSON.parse(env.getSchema));
    ok = js.validate(jsonSurvey, schema).length === 1;

    return ok===expectedOutcome;
};

// script part

var fns = [];

try {
    for (var i = 0 ; i < jsonizedSurveys.length ; i++) {
        //validate the jsonizedSurvey against the json schema
        assert(!_.isUndefined(jsonizedSurveys) && !_.isUndefined(jsonizedSurveys[i]));
        fns.push(function (s) { test(s, jsonizedSurveys[i], true); });
    }
} catch (err) {
    console.log("err", err);
}

fns.push(function (s) { assert(test(s, { filename : "foo", breakoff : false, survey : true }, false)); });
fns.push(function (s) { assert(test(s, {filename: "foo", breakoff: false, survey : [{id : "1"}]}, false))});

getSchema(function(fns) {
    return function (s) {
        for (var i = 0; i < fns.length ; i++){
            fns[i](s);
        }
    }
}(fns));

