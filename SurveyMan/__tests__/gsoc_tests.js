//__tests__/gsoc_test.js
jest.dontMock('../survey.js')
    .dontMock('./globals.js')
    .dontMock('underscore');



describe("Blocks are loaded correctly", function() {
    var _  = require('underscore');
    var globals = require('./globals');
    var {survey} = require('../survey');
    var jsonSurvey = globals.wage_survey;
    var parsedSurvey = new survey.Survey(jsonSurvey);

    it('checks that the number of toplevel blocks match', function() {
        expect(parsedSurvey.topLevelBlocks.length).toBe(jsonSurvey.survey.length);
    });

    it('number of questions in each block are correct', function() {
        _.each(jsonSurvey.survey, function(blk) {
            var block = _.find(parsedSurvey.topLevelBlocks, function(block) {return block.id == blk.id; });
            expect(block.topLevelQuestions.length).toBe(blk.questions.length);
        });
    });
    it('matches the number of sub blocks', function() {
        survey._sortById(parsedSurvey.topLevelBlocks);
        var [b1, b2, b3, b4] = parsedSurvey.topLevelBlocks;
        expect(b1.id).toBe("1");
        expect(b2.id).toBe("2");
        expect(b3.id).toBe("3");
        expect(b4.id).toBe("4");
        expect(b2.subblocks.length).toBe(39);
        jsonSurvey.survey.forEach(function(top_level_block) {
            var block = _.find(
                parsedSurvey.topLevelBlocks,
                function(block) { return block.id === top_level_block.id });

            if (top_level_block.subblocks === undefined) {
                expect(block.subblocks.length).toBe(0);
            } else {
                expect(block.subblocks.length).toBe(top_level_block.subblocks.length);
            }
        });
    });
});

describe("Questions are loaded correctly", function() {
    var _  = require('underscore');
    var globals = require('./globals');
    var survey = require('../survey').survey;

    it('tests that the total number of options match with json', function() {
        survey._global_reset();
        var jsonSurvey = globals.wage_survey;
        var parsedSurvey = survey.init(jsonSurvey);

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
            return acc + (ques.options ? ques.options.length : 0);
        }, 0);

        expect(parsedCounts).toBe(subBlockLevelOptionCounts + topLevelOptionsCounts);
    });
});

describe('Randomize works correctly', function() {
    var _  = require('underscore');
    var globals = require('./globals');
    var {survey} = require('../survey');


    it('when randomize on a block is called, top level questions remains the same', function() {
        survey._global_reset();
        var jsonSurvey = globals.wage_survey;
        var parsedSurvey = survey.init(jsonSurvey);

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
        survey._global_reset();
        var protoSurvey = globals.randomizable_survey;
        var parsedRandomSurvey = survey.init(protoSurvey);

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
