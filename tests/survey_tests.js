console.log("surveyman tests");

var vows = require("vows"),
    assert = require("assert"),
    globals = require("./globals.js"),
    survey = require("../survey.js");


var network_test = function () {
    var s = require("string"),
        _ = require("underscore"),
        $ = require("jquery"),
        http = require("http"),
        JaySchema = require('jayschema'),
        js = new JaySchema(JaySchema.loaders.http);

    var statusCode;

    js.maxRecursion = 3;

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
                statusCode = response.statusCode;
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

    fns.push(function (s) { return test(s, { filename : "foo", breakoff : false, survey : true }, false); });
    fns.push(function (s) { return test(s, {filename: "foo", breakoff: false, survey : [{id : "1"}]}, false)});

    var successes = getSchema(function(fns) {
        return function (s) {
            var success = true;
            for (var i = 0; i < fns.length ; i++){
               success = success && fns[i](s);
            }
            return success;
        }
    }(fns));

    return statusCode === 200 && successes;
};

vows.describe("Check validation").addBatch({
    "Validation doesn't cause errors" : {
        topic : function () { return network_test(); },
        "Srsly doesn't fail." : function (topic) { assert.ok(topic); }
    }
});