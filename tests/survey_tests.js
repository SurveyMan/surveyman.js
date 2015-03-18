console.log("surveyman tests");

var vows = require("vows"),
    assert = require("assert"),
    globals = require("./globals.js");

require("../SurveyMan/survey.js");


var network_test = function (callback) {
    var s = require("string"),
        _ = require("underscore"),
        request = require("request"),
        jjv = require("jjv"),
        env = jjv(),
        statusCode = null,
        schemata = {
            'survey_output' : null,
            'survey_block' : null,
            'survey_question' : null,
            'survey_branchMap' : null,
            'survey_option' : null
        },
        make_request = function (schema_name, cbk) {
            var schema = "";
            request("http://surveyman.github.io/Schemata/" + schema_name + ".json",
                function (error, response, body) {
                    console.log("schema_name", schema_name);
                    if (!error && response.statusCode === 200) {
                        schemata[schema_name]  = JSON.parse(body);
                    } else {
                        console.log("*****" + error + "*****");
                    }
                    cbk();
                });
        };

    var stem = "http://surveyman.github.io/Schemata/",
        survey_output = stem+"survey_output.json";

    env.defaultOptions.checkRequired = true;

    _.foldl(_.keys(schemata),
        function(memo, num) { return function () { make_request(num, memo);  }},
        function() {
            _.map(_.keys(schemata), function (schema_name) {
                var keyname = stem+schema_name+".json";
               console.log(keyname);
               env.addSchema(keyname, schemata[schema_name]);
            });
            var result1 = env.validate(survey_output, globals['wage_survey']),
                result2 = env.validate(survey_output, globals['prototypicality_survey']),
                result3 = env.validate(survey_output, globals['pick_randomly_survey']),
                result4 = env.validate(survey_output, {
                    filename : "foo",
                    breakoff : false,
                    survey : true }),
                result5 = env.validate(survey_output, {
                    filename: "foo",
                    breakoff: false,
                    survey : [{asdf : 1}]});
            console.log("result1: " + JSON.stringify(result1));
            console.log("result2: " + JSON.stringify(result2));
            console.log("result3: " + JSON.stringify(result3));
            console.log("result4: " + JSON.stringify(result4));
            console.log("result5: " + JSON.stringify(result5));
            assert(!(result1 || result2 || result3) && result4 && result5);
            if (callback)
                callback();
        })();
};

vows.describe("Check validation").addBatch({
    "Validation doesn't cause errors" : {
        topic : 'Network Test',
        "Srsly doesn't fail." : function (_) {
            return network_test();
        }
    }
}).run();
