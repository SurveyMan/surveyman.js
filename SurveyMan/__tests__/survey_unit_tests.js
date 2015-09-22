jest.dontMock("./globals.js")
    .dontMock("../surveyman.js");

describe('Top-level auxiliary function tests.', function() {
  it('parses boolean values, taking into account our freetext rules', function() {
    var survey = require('../surveyman').survey;
    var asdf;
    expect(survey._parseBools(asdf, true, null)).toBe(true);
    expect(survey._parseBools(asdf, 'fdsa', null)).toBe('fdsa');
    expect(survey._parseBools('asdf', false)).toBe('asdf');
  });
});

describe('Option tests', function() {

  var {Option} = require("../surveyman").survey;

  it('ensures that an error occurs if the provided json is malformed.', function() {
    expect(new Option({'id': 'asdf', 'otext': 'fdsa'})).toBeDefined();
    expect(function () { new Option({'id': 'fads'}) }).toThrow();
  });

  it('tests whether option data is parsed correctly.', function() {
    var optionJSON_1 = {'id' : 'asdf', 'otext': 'fdsa'};
    var optionJSON_2 = {'id' : 1, 'otext': 'qqq'};
    var optionJSON_3 = {'id' : 2, 'otext': 'aaa'};
    var jsonOptions = [optionJSON_1, optionJSON_2, optionJSON_3];
    var oList = jsonOptions.map((o) => new Option(o));
    var parsed_oList = Option.makeOptions(jsonOptions);
    expect(parsed_oList[0].equals(oList[0])).toBeTruthy();
    expect(parsed_oList[1].equals(oList[1])).toBeTruthy();
    expect(parsed_oList[2].equals(oList[2])).toBeTruthy();
    parsed_oList = Option.makeOptions(jsonOptions, null, [1, 2, 'asdf']);
    expect(parsed_oList[0].equals(oList[0])).toBeFalsy();
    expect(parsed_oList[0].equals(oList[1])).toBeTruthy();
    expect(parsed_oList[1].equals(oList[2])).toBeTruthy();
    expect(parsed_oList[2].equals(oList[0])).toBeTruthy();
  });
});

describe('Question tests', function() {

  var {Question} = require('../surveyman').survey;

  it('tests freetext parsing', function() {
    var q = new Question({
      'id': 'asdf',
      'qtext': 'fpp'
    });
    expect(q.freetext).toBeFalsy();
    q = new Question({
      'id': 'asdf',
      'qtext': 'fpp',
      'freetext': true
    });
    expect(q.freetext).toBeTruthy();
    q = new Question({
      'id': 'asdf',
      'qtext': 'fpp',
      'freetext': 'default Foo'
    });
    expect(q.freetext).toBe('default Foo');
    q = new Question({
      'id': 'asdf',
      'qtext': 'fpp',
      'freetext': '#{[a-z]+}'
    });
    expect(q.freetext).toEqual(new RegExp('[a-z]+'));
  });

  it('ensures that question data is parsed correctly.', function() {
    expect(new Question({
      'id': 'asdf',
      'qtext': 'foooooo'
    }, null).qtext).toBe('foooooo');
    expect(function () {
      new Question({'id': 'asdf'});
    }).toThrow();
  });

  it('tests question randomization', function() {
    var q = new Question({ "id" : "q_2_4",
      "qtext" : "Please choose one." ,
      "options" : [
        { "id" : "comp_3_5", "otext" : "Choose me" },
        { "id" : "comp_2_5", "otext" : "Choose me" } ],
      "branchMap" : {"comp_3_5" : "3", "comp_2_5" : "2"}
    });
    expect(q.freetext).toBeFalsy();
    expect(q.branchMap).toBeUndefined();
    expect(q.getOption("comp_3_5").id).toEqual("comp_3_5");
    expect(q.randomizable).toBeTruthy();
    expect(q.ordered).toBeFalsy();
    expect(q.options.length).toBe(2);
    expect(q.exclusive).toBeTruthy();
    expect(q.breakoff).toBeTruthy();
    var num_times_first_is_second = 0;
    for(let i = 0; i < 10; i++) {
      q.randomize();
      if (q.options[1].id === "comp_3_5") {
        num_times_first_is_second++;
      }
    }
    expect(num_times_first_is_second).toBeGreaterThan(0);
  });
});

describe('Block tests', function() {

  var {Block} = require('../surveyman').survey;
  var {wage_survey} = require('./globals');

  it('ensures that an error occurs if the provided json is malformed.', function() {
    expect(function() { new Block({}); }).toThrow();
    expect(new Block({'id': '1'})).toBeDefined();
  });

  it('tests that block fields are properly formed', function() {
    var b = new Block({'id' : '_2.1'});
    expect(b.idArray).toEqual([2, 1]);
    expect(b.topLevelQuestions.length).toBe(0);
    expect(b.subblocks.length).toBe(0);
    expect(b.randomizable).toBeFalsy();
    expect(b.isBranchAll()).toBeTruthy();
    expect(b.idComp(new Block({'id': '2.1'}))).toBe(0);
    expect(b.idComp(new Block({'id': '2'}))).toBe(0);
    expect(b.idComp(new Block({'id': '2.1.1'}))).toBe(0);
    expect(b.idComp(new Block({'id': '1'}))).toBe(1);
    expect(b.idComp(new Block({'id': '3'}))).toBe(-1);
  });

  it('tests that blocks are randomized properly', function() {
    var b = new Block({
      "id": "1",
      "subblocks": [
        { "id": "1._1",
          "questions": [
            {"id": "a", "qtext": "a"},
            {"id": "b", "qtext": "b"}]},
        { "id": "1._2",
          "questions": [
            {"id": "c", "qtext": "c"},
            {"id": "d", "qtext": "d"}]}]
    });
    expect(b.subblocks.length).toBe(2);
    var num_times_first_block_second = 0;
    var num_times_qa_second = 0;
    for(let i = 0; i < 20; i++) {
      b.randomize();
      var b1;
      if (b.subblocks[1].id === "1._1") {
        num_times_first_block_second++;
        b1 = b.subblocks[1];
      } else {
        b1 = b.subblocks[0];
      }
      if (b1.topLevelQuestions[1].id === "a") {
        num_times_qa_second++;
      }
    }
    expect(num_times_qa_second).toBeGreaterThan(0);
    expect(num_times_first_block_second).toBeGreaterThan(0);
  });

  it('tests that subblocks are properly formed', function() {
    var json_block_with_subblocks = wage_survey.survey[3];
    expect(json_block_with_subblocks.subblocks.length).toBe(39);
    var parsed_block_with_subblocks = new Block(json_block_with_subblocks);
    expect(parsed_block_with_subblocks.subblocks.length).toBe(39);
  });
});

describe('Block-Question tests', function() {

  var {Block} = require('../surveyman').survey;

  it('tests the interaction between questions and blocks', function() {
    var b = new Block({ "id" : "1",
        "questions" : [
      { "id" : "q_2_4",
        "qtext" : "Please choose one." ,
        "options" : [
          { "id" : "comp_3_5", "otext" : "Choose me" },
          { "id" : "comp_2_5", "otext" : "Choose me" } ],
        "branchMap" : {"comp_3_5" : "3", "comp_2_5" : "2"}
      } ]
    });
    expect(b.topLevelQuestions.length).toBe(1);
  });
});

describe('Survey tests', function() {

  var {Survey, _global_reset} = require('../surveyman').survey;
  var ex = {
    "filename": "",
    "breakoff": false,
    "survey": [
      {
        "id": "1",
        "questions": [
          {
            "id": "q_2_4",
            "qtext": "Please choose one.",
            "options": [
              {"id": "comp_3_5", "otext": "Choose me"},
              {"id": "comp_2_5", "otext": "Choose me"}],
            "branchMap": {"comp_3_5": "3", "comp_2_5": "2"}
          }]
      },
      {"id": "2"},
      {"id": "3"},
      {"id": "_4"}]
  };

  it('tests that surveys are parsed correctly.', function() {
    try {
      expect(function () {
        new Survey({});
      }).toThrow();
      _global_reset();
      var s = new Survey(ex);
      expect(s).toBeDefined();
      expect(s.topLevelBlocks.length).toBe(4);
      var [b1, b2, b3, b4] = s.topLevelBlocks;
      expect(b1.id).toBe("1");
      expect(b1.isBranchAll()).toBe(false);
      expect(b1.topLevelQuestions.length).toBe(1);
      var [o1, o2] = b1.topLevelQuestions[0].options;
      var bm = b1.topLevelQuestions[0].branchMap;
      expect(bm).toBeDefined();
      expect(bm.size).toEqual(2);
      expect(bm.get(o1)).toEqual(b3);
      expect(bm.get(o2)).toEqual(b2);
    } catch (e) {
      console.log(e);
      throw e;
    }
  });

  it('tests that surveys randomize properly', function() {
    //var s = new Survey(ex);
    //Survey.randomize(s);
  });
});