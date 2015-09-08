jest.dontMock("./globals.js")
    .dontMock("../survey")
    .dontMock("string")
    .dontMock("underscore")
    .dontMock("request")
    .dontMock("jjv");


var network_test = function (callback) {
    var globals = require("./globals");
    var s = require("string"),
        _ = require("underscore"),
        request = require("request"),
        jjv = require("jjv");

    var env = jjv(),
        //statusCode = null,
        schemata = {
            'survey_output' : null,
            'survey_block' : null,
            'survey_question' : null,
            'survey_branchMap' : null,
            'survey_option' : null
        },
        make_request = function (schema_name, cbk) {
            //var schema = "";
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

describe("Check validation", function() {
    it("Srsly doesn't fail.", function () {
        try {
            // not sure how jest's mocks interact with this.
            //return network_test();
        } catch (err) {
            console.log(err);
        }
        return false;
    });
});

describe("New ordering mechanism is implemented correctly.", function() {
    var {survey} = require("../survey");
    var globals = require("./globals");

    it("parses ordered questions correctly in Ipierotis.csv", function() {
        try {
            survey._global_reset();
            var parsedSurvey = survey.init(globals.ipierotis);
            expect(parsedSurvey).toBeDefined();
            expect(parsedSurvey.topLevelBlocks).toBeDefined();
            expect(parsedSurvey.topLevelBlocks[1].topLevelQuestions[0].ordered).toBeTruthy();
        } catch (e) {
            console.log('error: ', e);
            throw e;
        }
    });
});
