//  surveyman.js 1.5.1
//  http://surveyman.github.io/surveyman.js
//  (c) 2014 University of Massachusetts Amherst
//  surveyman.js is released under the CRAPL.

// Major refactor 9/2015:
// Remove underscore
// Swap in some ES6 features
// API returns Immutable objects to be used in React interface
// Incremental adds

var Immutable = require('immutable');
var log = require('loglevel');
var config = (function () {
    try {
        return require('./config');
    } catch (e) {
        console.log(e);
        return { verbose : false };
    }
})();

SurveyMan = (function () {
    try {
        return _.isUndefined(SurveyMan) ? {} : SurveyMan;
    } catch (err) {
        log.warn(err);
        return {};
    }
})();


// Internal maps from string ids to objects
// ----------------------------------------
var blockMAP = new Map(),
    optionMAP = new Map(),
    questionMAP = new Map();


// Exceptions
// ----------
var SMSurveyException = function (msg, override = false) {
  if (override) return msg;
  return `SMSurveyException: ${msg}`;
};

var UnknownTypeException = function (thing) {
  return new SMSurveyException(`Unknown type for ${thing}: (${typeof thing})`);
};

var ObjectNotFoundException = function (type, id, objName) {
  return new SMSurveyException(`${type} id ${id} not found in ${objName}`);
};

var MalformedSurveyException = function (msg) {
  return new SMSurveyException(`Malformed Survey: ${msg}`, true);
};

// Utility functions
// -----------------
var assertJSONHasProperties = function (jsonObj, ...plist) {
  plist.forEach((prop) => console.assert(jsonObj.hasOwnProperty(prop)));
};

var FYshuffle = function(arr) {
  // Implementing this here so I don't have to import underscore or lodash.
  var counter = arr.length;
  while (counter > 0) {
    var swapIndex = Math.floor(Math.random() * counter);
    var swapObj = arr[swapIndex];
    arr[swapIndex] = arr[counter - 1];
    arr[counter - 1] = swapObj;
  }
}

/**
 * Gets the Option object from the internal mapping of ids to Options.
 * Throws an exception if the id is not found.
 * @param {string} oid The option id.
 * @returns {Option}
 */
var getOptionById = function (oid) {
  if (optionMAP.has(oid)) {
    return optionMAP.get(oid);
  } else throw new ObjectNotFoundException('Option', oid, 'optionMAP');
};

/**
 * Gets the Question object from the internal mapping of ids to Questions.
 * Throws an exception if the id is not found.
 * @param {string} quid The question id.
 * @returns {Question}
 */
var getQuestionById = function (quid) {
  if (questionMAP.has(quid)) {
    return questionMAP.get(quid);
  } else throw new ObjectNotFoundException('Question', quid, 'questionMAP');
};

/**
 * Gets the Block object from the internal mapping of ids to Blocks.
 * Throws an exception if the id is not found.
 * @param {string} bid The block id. May be null.
 * @returns {Block}
 */
var getBlockById = function (bid) {
  if (bid === null)
    return null;
  if (blockMAP.has(bid)) {
    return blockMAP.get(bid);
  } else throw new ObjectNotFoundException('Object', bid, 'blockMAP');
};

/**
 * This function parses some object to a boolean, returning the default value
 * if the first argument is undefined. It is exported as a 'private' variable
 * in the SurveyMan.survey object.
 *
 * The parsed object may return:
 * - boolean, for most question fields (e.g., randomize, exclusive, etc.)
 * - string or regexp, for the freetext field
 * - boolean or an array for option ids, for the ordered field
 *
 * @param {*} thing Any object, possibly undefined.
 * @param {*} defaultVal The default value for this object; may not be undefined.
 * @param {Question} question This is provided for backwards compatibility on the
 * json schema and may be undefined. The 'ordered' field for questions may be a
 * boolean (old version) or an array of option ids (new version).
 * @returns {*} the parsed object
 */
var parseBools = function (thing, defaultVal, question = null) {
  console.assert(defaultVal !== undefined, 'Default value cannot be undefined.');
  if (thing === undefined) {
    return defaultVal;
  } else if (typeof thing == 'string') {
    try {
      return JSON.parse(thing);
    } catch (err) {
      return thing;
    }
  } else if (typeof thing == 'boolean') {
    return thing;
  } else if (Array.isArray(thing)) {
    // New schemata spec for ordered -- provides a list of the ids that are
    // ordered for this question.
    // Set the initial ids of the question's options
    question.options = thing.map((oid) => getOptionById(oid));
    return true;
  }
  throw UnknownTypeException(thing);
};

/**
 * The Option object holds answer options. It has three fields:
 * - id: string representing the internal id of this option.
 * - otext: string representation of the option (may include HTML)
 * - question: the question to which this option belongs
 *
 * Note that there is the opportunity for optimization here; many questions
 * have similar answer options.
 *
 * Note that we do not enforce _question to be defined. This allows us to
 * build options incrementally.
 *
 * @param {JSON} _jsonOption
 * @param {Question} _question
 * @constructor
 */
var Option = function (_jsonOption, _question) {
  assertJSONHasProperties(_jsonOption, 'id', 'otext');
  optionMAP.set(_jsonOption.id, this);
  this.id = _jsonOption.id;
  this.otext = _jsonOption.otext;
  this.question = _question;
};

/**
 * Option.makeOptions creates option objects for the supplied question and ensures the
 * ordering of the options, if necessary.
 * @param {JSON} jsonOptions
 * @param {Question} enclosingQuestion
 * @param {boolean|Array} ordered
 * @returns {Array<Option>}
 */
Option.makeOptions = function (jsonOptions, enclosingQuestion, ordered) {
  if (jsonOptions === undefined) {
    log.info(`No options defined for Question ${enclosingQuestion.id} ( ${enclosingQuestion.qtext} )`);
    return;
  }
  let oList = jsonOptions.map((o) => new Option(o, enclosingQuestion));
  if (Array.isArray(ordered)) {
    console.assert(ordered.length === oList.length,
        'Ordered ids have a different length from the number of options.');
    let newList = [];
    ordered.forEach((oid) => newList.push(oList.filter((o) => o.id === ordered[i])[0]));
    return newList;
  }
  return oList;
};

/**
 * The Block object holds other blocks or questions. It has 12 fields:
 * - id: string representation of the internal id of this block. This has
 * an associated semantics.
 * - idArray: convenience field -- an array representation of the id.
 * - topLevelQuestions: the list of questions that are immediately contained in this block
 * - subblocks: potentially empty block list
 * - randomizable: boolean indicating whether this block is randomizable or 'floating'
 * - isBranchAll: function returning a boolean indicating whether this is a BRANCH-ALL block
 * - getQuestion: returns the question in this block associated with the provided id
 * - idComp: compares two subblocks to determine their precedence
 * - randomize: function to randomizes this block's questions and subblocks
 * - populate: initializes the blocks.
 * - getFirstQuestion: pops off the top question in the block; used by interpreter.js and display.js
 * @param {JSON} _jsonBlock
 * @constructor
 */
var Block = function (_jsonBlock) {
  assertJSONHasProperties(_jsonBlock, 'id');
  var id = _jsonBlock.id,
      questions = _jsonBlock.questions || [],
      randomize = _jsonBlock.randomize,
      subblocks = _jsonBlock.subblocks;

  var idStringToArray = (_idString) => _idString.split('.').map((s) => parseInt(s));

  // get the total number of 'slots' and assign indices
  blockMAP.set(id, this);
  this.id = id;
  this.idArray = idStringToArray(id);
  this.topLevelQuestions = Question.makeQuestions(questions, this);
  this.subblocks = [];
  // may need to call a to boolean on jsonBlock.randomize
  this.randomizable = parseBools(randomize, Survey.randomizeDefault);
  this.isBranchAll = function () {
    var i, q, dests;
    // Not a branch all if there are no top level questions
    if (this.topLevelQuestions.length === 0) return false;
    // We currently cannot randomly select a subblock.
    if (this.subblocks.length > 0) return false;
    // This previously checked whether the questions in the block all had NEXT pointers
    // We have relaxed this requirement.
    // The block is branch-all if all of the questions
    // Since we rely on the static analyzer to do a more thorough check, for now just see
    // if all of the branch maps are not empty.
    return this.topLevelQuestions.map((q) => q.branchMap.size).reduce((a, b) => a + b, 0) === 0;
  };
  this.getQuestion = function (quid) {
    for (var i = 0; i < this.topLevelQuestions.length; i++) {
      if (this.topLevelQuestions[i].id == quid) {
        return this.topLevelQuestions[i];
      }
    }
    throw new ObjectNotFoundException('Question', quid, `block ${this.id}`);
  };
  this.idComp = function (that) {
    // Returns whether that follows (+1), precedes (-1), or is a sub-block (0) of this
    for (var i = 0; i < this.idArray.length; i++) {
      // If we have reached the end of the comparison and that block has a longer id, then
      // that block is a subblock.
      if (i >= that.idArray.length) return 0;
      // If the block id at this's ith-level has a lower number than that's block id at
      // the ith-level, then that precedes this. If it's greater, that follows. Otherwise,
      // keep comparing.
      if (this.idArray[i] < that.idArray[i]) {
        return -1;
      } else if (this.idArray[i] > that.idArray[i]) {
        return 1;
      }
    }
  };
  this.randomize = function () {

    var i, j;
    var newSBlocks = this.subblocks.map((_) => -1);
    // Randomize questions
    FYshuffle(this.topLevelQuestions);
    // Randomize options
    this.topLevelQuestions.forEach((q) => q.randomize());
    // If we have no subblocks, then we're done.
    if (newSBlocks.length === 0) return;
    // Randomize blocks
    var stationaryBlocks = this.subblocks.filter((b) => !b.randomizable);
    var nonStationaryBlocks = this.subblocks.filter((b) => b.randomizable);
    var sample = this.subblocks.reduce((lst, _) => [lst[0] + 1].concat(lst), [0]).slice(0,
        nonStationaryBlocks.length);
    FYshuffle(nonStationaryBlocks);

    for (i = 0; i < sample.length; i++) {
      // Pick the locations for where to put the non-stationary blocks
      newSBlocks[sample[i]] = nonStationaryBlocks[i];
    }

    for (i = 0, j = 0; i < newSBlocks.length; i++) {
      if (newSBlocks[i] == -1) {
        newSBlocks[i] = stationaryBlocks[j];
        j++;
      }
    }
    console.assert(j == stationaryBlocks.length);
    this.subblocks = newSBlocks;
    this.subblocks.forEach((b) => b.randomize());
  };
  // Added a closure to make this-semantics clear.
  this.populate = function (containingBlock) {
    return function () {
      if (subblocks === undefined) {
        log.info(`No subblocks in Block ${containingBlock.id}`);
        return;
      }
      subblocks.forEach(function (subb) {
        var b = new Block(subb);
        b.parent = containingBlock;
        containingBlock.subblocks.push(b);
        b.populate();
      });
    };
  }(this);
  this.getFirstQuestion = function () {
    if (this.topLevelQuestions.length !== 0)
      return this.topLevelQuestions[0];
    if (this.subblocks.length === 0)
      throw new MalformedSurveyException(`empty block stack ending in ${this.id}`);
    return this.subblocks[0].getFirstQuestion();
  };
  // Assert that the sub-blocks have the appropriate ids
  console.assert(this.subblocks.reduce((tv, b) => tv && this.idComp(b) === 0, true));
};

/**
 * Internal tracking for generated block ids.
 * @type {number[]}
 * @private
 */
Block._blocks_ids = [1];

/**
 * Add a new block programmatically.
 * @param {Block|undefined|null} parent If we are creating a subblock, we must supply the parent.
 * @returns {Block}
 */
Block.new_block = function (parent) {
  var idArray = [], i = 0;
  if (parent === undefined) {
    idArray = parent.idArray;
    i = parent.idArray.length;
    if (Block._blocks_ids[i] === undefined) {
      Block._blocks_ids[i] = 1;
    }
  }
  idArray[i] = Block._blocks_ids[i];
  Block._blocks_ids[i] += 1;
  var id = idArray.reduce(function (a, b) { return a + '.' + b; });
  return new Block({'id': id, 'questions': []});
};

/**
 * The Question object holds a single question. It has 12 fields:
 * - id: string representation of the internal id of this question.
 * - makeBranchMap: creates the branch map from options to blocks.
 * - block: the block containing this question
 * - qtext: the text to display with this question (may contain HTML)
 * - freetext: flag/string/regexp providing freetext data about this question
 * - options: the list of options associated with this question (may be empty).
 * - correlation: either a string or a list of strings corresponding to questions
 *  we expect to be correlated with this question
 * - randomizable: boolean indicating whether the options in this question can be shuffled
 * - ordered: boolean or ordered list of option ids
 * - exclusive: determines whether we should display options as radio or checkbox
 * - breakoff: boolean indicating whether we should allow people to submit the survey at this
 *   question
 * - randomize: function to randomize the contents of this question.
 * @param {JSON} _jsonQuestion
 * @param {Question} _block
 * @constructor
 */
var Question = function (_jsonQuestion, _block) {
  assertJSONHasProperties(_jsonQuestion, 'id', 'qtext');
  var id = _jsonQuestion.id,
      branchMap = _jsonQuestion.branchMap || {},
      freetext = _jsonQuestion.freetext,
      qtext = _jsonQuestion.qtext,
      options = _jsonQuestion.options,
      correlation = _jsonQuestion.correlation,
      randomize = _jsonQuestion.randomize,
      ordered = _jsonQuestion.ordered,
      exclusive = _jsonQuestion.exclusive,
      breakoff = _jsonQuestion.breakoff;

  questionMAP.set(id, this);
  this.makeBranchMap = function (question) {
    return function () {
      question.branchMap = function (_jsonBranchMap, _question) {
        var bm = new Map();
        // branchMap -> map from oid to bid
        for (let [k, v] of _jsonBranchMap) {
          var o = _question.getOption(k),
              b = getBlockById(_jsonBranchMap[k]);
          bm[o.id] = b;
        }
        return bm;
      }(branchMap, question);
    };
  }(this);
  this.setFreetext = function (freetext) {
    var reRe = new RegExp('#\{.*\}'),
        ft = freetext;
    if (ft === true) {
      return true;
    } else if (reRe.exec(ft)) {
      return new RegExp(ft.substring(2, ft.length - 1));
    } else return `${ft}`;
  };

  this.block = _block;
  this.id = id;
  this.qtext = qtext;
  this.freetext = parseBools(freetext, false) ? this.setFreetext(_jsonQuestion) : Survey.freetextDefault;
  this.correlation = correlation;
  this.getOption = function (oid) {
    for (let i = 0; i < this.options.length; i++) {
      if (this.options[i].id === oid) {
        return this.options[i];
      }
    }
    throw new ObjectNotFoundException('Option', oid, `question ${this.id}`);
  };
  // FIELDS MUST BE SENT OVER AS STRINGS
  this.randomizable = parseBools(randomize, Survey.randomizeDefault);
  this.ordered = parseBools(ordered, Survey.orderedDefault, this);
  this.options = Option.makeOptions(options, this, this.ordered);
  this.exclusive = parseBools(exclusive, Survey.exclusiveDefault);
  this.breakoff = parseBools(breakoff, Survey.breakoffDefault);
  this.randomize = function () {
    if (!this.randomizable) return;
    if (this.ordered) {
      if (Math.random() < 0.5) {
        this.options = this.options.reverse();
      }
    } else {
      this.options = _.shuffle(this.options);
    }
  };
};

/**
 * Survey constructor. Takes a json survey and returns an internal survey
 * object. It contains the fields:
 * <ul>
 *   <li><b>filename</b> The path of the source file used to generate this survey; may be empty.</li>
 *   <li><b>topLevelBlocks</b> The list of top level blocks in this survey. This gets wrapped in
 *   an Immutable.List.</li>
 *   <li><b>breakoff</b> Boolean indicating whether breakoff is permitted for this survey.</li>
 *   <li><b>questions</b> list of all questions. This gets wrapped in an Immutable.List.</li>
 * </ul>
 * @param {json} _jsonSurvey - the input survey, typically generated by another program.
 * @constructor
 */
var Survey = function (_jsonSurvey) {
  assertJSONHasProperties(_jsonSurvey, 'filename', 'survey');
  var {filename, survey, breakoff} = _jsonSurvey;
  var makeSurvey = function (_jsonSurvey) {
    var blockList = _jsonSurvey.map(function (jsonBlock) {
      let b = new Block(jsonBlock);
      b.populate();
      return b;
    });
    return blockList;
  }
  this.filename = filename;
  this.topLevelBlocks = Immutable.List(makeSurvey(survey));
  questionMAP.forEach(function (q) {
    q.makeBranchMap();
  });
  this.breakoff = parseBools(breakoff, Survey.breakoffDefault);
  this.questions = Immutable.List(questionMAP.values());
}

Survey.randomize = function (_survey) {
  var sortById = function (lst) {
    // Bubble sort, yo!
    // We generally expect these to already be sorted.
    for (let i = 0; i < lst.length; i++) {
      var swapped = false;
      for (let j = 0; j < lst.length - 1; j++) {
        if (lst[j].idComp(lst[j+1]) == -1) {
          swapped = true;
          let tmp = lst[j];
          lst[j] = lst[j+1];
          lst[j+1] = tmp;
        }
      }
      if (!swapped) return;
    }
  };
  var randomizableBlocks = _survey.topLevelBlocks.filter((_block) => _block.randomizable);
  FYshuffle(randomizableBlocks);
  var normalBlocks = _survey.topLevelBlocks.filter((_block) => !_block.randomizable);
  sortById(normalBlocks);
  var newTLBs = _survey.topLevelBlocks.map((b) => null);
  var indices = normalBlocks.reduce((lst, _) => [lst[0] + 1].concat(lst), [0]);
  FYshuffle(indices);
  indices = indices.slice(0, newTLBs.length);
  sortById(indices);

  // Randomize new top level blocks as appropriate
  for (let j = 0; j < indices.length; j++) {
      newTLBs[indices[j]] = normalBlocks[j];
  }

  var k = 0;
  for (let i = 0; i < newTLBs.length; i++) {
    if (newTLBs[i] === undefined) {
      newTLBs[i] = randomizableBlocks[k];
      k++;
    }
  }

  // Reset top level blocks
  _survey.topLevelBlocks = newTLBs;
  for (let i = 0; i < _survey.topLevelBlocks.length; i++) {
    // contents of the survey
    _survey.topLevelBlocks[i].randomize();
  }
};

/**
 * Creates question list from the json encoding of question options.
 * @param {JSON} _jsonQuestions
 * @param {Block} enclosingBlock
 * @returns {List}
 */
Question.makeQuestions = function (_jsonQuestions, enclosingBlock) {
  var i, qList = [];

  for (i = 0; i < _jsonQuestions.length; i++) {
    var q = new Question(_jsonQuestions[i], enclosingBlock);
    qList.push(q);
    questionMAP[q.id] = q;
  }
  return List(qList);
};

// 'static' fields
Survey.exclusiveDefault = true;
Survey.orderedDefault = false;
Survey.randomizeDefault = true;
Survey.freetextDefault = false;
Survey.breakoffDefault = true;
Block.randomizeDefault = false;

// Wrapper for creating a new survey
SurveyMan.new_survey = function () {
  return init([]);
};

var survey = {
  _parseBools : parseBools,
  init: function (jsonSurvey) {
    var survey = new Survey(jsonSurvey);
    Survey.randomize(survey);
    return survey;
  },
  getOptionById: getOptionById,
  getQuestionById: getQuestionById,
  getBlockById: getBlockById,
  Survey: Survey,
  Block: Block,
  Question: Question,
  Option: Option
};

try {
  SurveyMan.survey = survey;
  if (module !== undefined) {
    module.exports = SurveyMan;
  }
} catch (e) {
  console.log(e);
}