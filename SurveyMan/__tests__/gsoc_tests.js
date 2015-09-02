//__tests__/gsoc_test.js
jest.dontMock('../survey.js')
    .dontMock('./globals.js')
    .dontMock('underscore');



describe("Blocks are loaded correctly", function() {
    var _  = require('underscore');
    var globals = require('./globals');
    var survey = require('../survey').survey;
    var jsonSurvey = globals.wage_survey;
    var parsedSurvey = survey.init(jsonSurvey);

    it('checks that the number of toplevel blocks match', function() {
        expect(parsedSurvey.topLevelBlocks.length).toBe(jsonSurvey.survey.length);
    });
    it('number of questions in each block are correct', function() {
        _.each(jsonSurvey.survey, function(blk) {
            var block = _.find(parsedSurvey.topLevelBlocks, function(block) {return block.id == blk.id; });
            expect(block.topLevelQuestions.length).toBe(blk.questions.length);
        });
    });
    it('number of sub blocks in each block match', function() {
        _.each(jsonSurvey.survey, function(blk){
            var block = _.find(parsedSurvey.topLevelBlocks, function(block) { return block.id == blk.id });
            if (blk.subblocks === undefined) {
                expect(block.subblocks.length).toBe(0);
            } else {
                expect(block.subblocks.length).toBe(blk.subblocks.length);
            }
        });
    });
});

describe("Questions are loaded correctly", function() {
    var _  = require('underscore');
    var globals = require('./globals');
    var survey = require('../survey').survey;
    var jsonSurvey = globals.wage_survey;
    var parsedSurvey = survey.init(jsonSurvey);

    it('tests that the total number of options match with json', function() {

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
            var parsedCounts = _.reduce(parsedSurvey.questions, function(acc, ques) {
                return acc + ques.options.length;
            }, 0);

            expect(parsedCounts).toBe(subBlockLevelOptionCounts + topLevelOptionsCounts);
        });
});

describe('Randomize works correctly', function() {
    var _  = require('underscore');
    var globals = require('./globals');
    var survey = require('../survey').survey;
    var jsonSurvey = globals.wage_survey;
    var parsedSurvey = survey.init(jsonSurvey);
    var protoSurvey = globals.randomizable_survey;
    var parsedRandomSurvey = survey.init(protoSurvey);


    it('when randomize on a block is called, top level questions remains the same', function() {
            _.each(parsedSurvey.topLevelBlocks, function(block) {

                if (block.topLevelQuestions.length > 0) {
                    // clone the block before mutation
                    var savedBlock = _.clone(block);
                    block.randomize();

                    // validate count
                    expect(block.topLevelQuestions.length).toBe(savedBlock.topLevelQuestions.length);

                    // validating whether the set is same (sort and compare)
                    var sortedQuestions = _.sortBy(savedBlock.topLevelQuestions, function(q) { return q.id; });
                    var sortedBlockQuestions = _.sortBy(block.topLevelQuestions, function(q) { return q.id; });

                    _.each(sortedQuestions, function(q1, i) {
                        var q2 = sortedBlockQuestions[i];
                        expect(q2.qtext).toBe(q1.qtext);
                    });
                }
            });
        });

    it('when randomize on parent block is called, non-randomizable subblocks should maintain partial order', function() {
        var topic = _.find(parsedRandomSurvey.topLevelBlocks, function (block) { return block.randomizable });
        var fixedBlockIds = _.chain(topic.subblocks)
                .filter(function(block) { return !block.randomizable })
                .map(function(block) { return block.id })
                .value();

        topic.randomize();

        // get indices of fixed block ids in new randomized order
        var newIds = _.map(topic.subblocks, function(b) { return b.id });
        var locations = _.map(fixedBlockIds, function(id) { return newIds.indexOf(id); });

        // if locations is ordered, it is equal to its sorted version
        expect(locations).toBe(locations.sort());
    });
});
