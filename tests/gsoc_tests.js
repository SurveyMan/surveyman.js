var vows = require('vows'),
    _    = require('underscore'),
    assert = require('assert'),
    globals = require('./globals'),
    survey = require('../SurveyMan/survey.js');

var jsonSurvey = globals.wage_survey;
var parsedSurvey = survey.init(jsonSurvey);

vows.describe("Blocks are loaded correctly").addBatch({
    'when setting up top level blocks':{

        topic: parsedSurvey.topLevelBlocks,

        'total number of toplevel blocks match': function(topic) {
            assert.equal(topic.length, jsonSurvey.survey.length);
        },

        'number of questions in each block are correct': function(topic) {
            _.each(jsonSurvey.survey, function(blk) {
                var block = _.find(topic, function(block) {return block.id == blk.id; });
                assert.equal(block.topLevelQuestions.length, blk.questions.length);
            });
        },

        'number of sub blocks in each block match': function(topic) {
            _.each(jsonSurvey.survey, function(blk){
                var block = _.find(topic, function(block) { return block.id == blk.id });
                if (blk.subblocks === undefined) {
                    assert.equal(block.subblocks.length, 0);
                } else {
                    assert.equal(block.subblocks.length, blk.subblocks.length);
                }
            });
        }
    }
}).run();

vows.describe("Questions are loaded correctly").addBatch({
    'when setting up top level questions': {
        topic: parsedSurvey.questions,

        'total number of options match with json': function(topic) {

            /* returns total options from a list of valid (which have questions) blocks */
            var getTotalOptionsInBlocks = function(blocks) {
                return _.chain(blocks)
                    .map(function(block) { return block.questions })
                    .flatten()
                    .filter(function(q) { return !!q.options })
                    .reduce(function(accum, q) {
                        return accum + q.options.length;
                    }, 0)
                    .value();
            };

            /* calculate total option in top level and sub block level options from input json */
            var listOfBlocksWithQuestions = _.filter(jsonSurvey.survey, function(block) {
                return block.questions.length > 0;
            });

            var topLevelOptionsCounts = getTotalOptionsInBlocks(listOfBlocksWithQuestions);

            listOfBlocksWithQuestions = _.chain(jsonSurvey.survey)
                    .filter(function(block) { return !!block.subblocks })
                    .map(function(block) { return block.subblocks })
                    .flatten()
                    .value();

            var subBlockLevelOptionCounts = getTotalOptionsInBlocks(listOfBlocksWithQuestions);

            // count total options in parsed object
            var parsedCounts = _.reduce(topic, function(acc, ques) {
                return acc + ques.options.length;
            }, 0);

            assert.equal(parsedCounts, subBlockLevelOptionCounts + topLevelOptionsCounts);
        }
    }
}).run();
