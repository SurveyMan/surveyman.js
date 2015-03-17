console.log("surveyman tests");

var vows = require("vows"),
    assert = require("assert"),
    globals = require("./globals.js");

require("SurveyMan/survey.js");


var network_test = function () {
    var s = require("string"),
        _ = require("underscore"),
        $ = require("jquery"),
        http = require("http"),
        jjv = require("jjv"),
        env = jjv(),
        statusCode = null,
        options = {
                hostname : "surveyman.github.io",
                port : 80,
                path : "/Schemata/survey_output.json",
                method : "GET"
        },
        schema = "",
        retval = null,
        cbk = function(response) {
                statusCode = response.statusCode;
                response.setEncoding("UTF-8");

                response.on("data", function (d){
                    schema += d.toString();
                });

                response.on("end", function () {
                    env.addSchema('output_survey', JSON.parse(schema));
                    var result1 = env.validate('output_survey', globals['wage_survey']),
                        result2 = env.validate('output_survey', globals['prototypicality_survey']),
                        result3 = env.validate('output_survey', globals['pick_randomly_survey']),
                        result4 = env.validate('output_survey', {
                            filename : "foo",
                            breakoff : false,
                            survey : true }),
                        result5 = env.validate('output_survey', {
                            filename: "foo",
                            breakoff: false,
                            survey : [{id : 1}]});
                    console.log("result1: " + JSON.stringify(result1));
                    console.log("result2: " + JSON.stringify(result2));
                    console.log("result3: " + JSON.stringify(result3));
                    console.log("result4: " + JSON.stringify(result4));
                    console.log("result5: " + JSON.stringify(result5));
                });
        },
        req = http.request(options, cbk);

    env.defaultOptions.checkRequired = true;

    req.on("error", function (e){
        console.log("***",e,"***");
    });

    req.end();

    console.log("status code: " + statusCode  + "\nretval: " + retval);

    return statusCode === 200;
};

vows.describe("Check validation").addBatch({
    "Validation doesn't cause errors" : {
        topic : 'Network Test',
        "Srsly doesn't fail." : function (_) {
            var outcome = network_test();
            console.log(outcome);
            assert.ok(outcome);
        }
    }
}).run();