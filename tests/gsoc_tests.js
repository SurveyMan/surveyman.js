var vows = require('vows'),
    _    = require('underscore'),
    assert = require('assert'),
    globals = require('./globals'),
    survey = require('../SurveyMan/survey.js').survey;

var jsonSurvey = globals.wage_survey;
var parsedSurvey = survey.init(jsonSurvey);

var protoSurvey = globals.randomizable_survey;
var parsedRandomSurvey = survey.init(protoSurvey);

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

vows.describe('Randomize works correctly').addBatch({
    'when randomize on a block is called': {

        topic: parsedSurvey.topLevelBlocks,

        'top level questions remains the same': function(topic) {
            _.each(topic, function(block) {

                if (block.topLevelQuestions.length > 0) {
                    // clone the block before mutation
                    var savedBlock = _.clone(block);
                    block.randomize();

                    // validate count
                    assert.equal(block.topLevelQuestions.length, savedBlock.topLevelQuestions.length);

                    // validating whether the set is same (sort and compare)
                    var sortedQuestions = _.sortBy(savedBlock.topLevelQuestions, function(q) { return q.id; });
                    var sortedBlockQuestions = _.sortBy(block.topLevelQuestions, function(q) { return q.id; });

                    _.each(sortedQuestions, function(q1, i) {
                        var q2 = sortedBlockQuestions[i];
                        assert.equal(q2.qtext, q1.qtext);
                    });
                }
            });
        }
    },
    'when randomize on parent block is called': {

        topic: function() {
            return _.find(parsedRandomSurvey.topLevelBlocks, function(block) {
                return block.randomizable
            });
        },

        'non-randomizable subblocks should maintain partial order': function(topic) {
            var fixedBlockIds = _.chain(topic.subblocks)
                .filter(function(block) { return !block.randomizable })
                .map(function(block) { return block.id })
                .value();

            topic.randomize();

            // get indices of fixed block ids in new randomized order
            var newIds = _.map(topic.subblocks, function(b) { return b.id });
            var locations = _.map(fixedBlockIds, function(id) {
                return newIds.indexOf(id);
            });

            // if locations is ordered, it is equal to its sorted version
            assert.equal(locations, locations.sort());
        }
    }
}).run();
