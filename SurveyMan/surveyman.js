/**
 * @fileoverview
 * <h2>Overview</h2>
 * The surveyman.js repository contains three modules. Together these three modules form the SurveyMan runtime system, contained in the SurveyMan namespace. This runtime system receives a JSON representation of a survey and executes that survey (with the help of a human!) in a browser. These three modules are meant to be used with the SurveyMan server and static analyzer.
 *
 * Currently this code expects to be executed inside https://github.com/SurveyMan/Runner/blob/master/src/main/resources/HTMLSkeleton.html.
 *
 * <h2>Install</h2>
 *
 * <tt>npm install surveyman</tt>
 *
 * <h2>Usage</h2>
 * <p><i>Warning: These instructions are deprecated</i></p>
 * <p>If you use these modules with the SurveyMan Java backend, everything is good to go! If you're using your own backend or otherwise modifying some part of the pipeline, you will need to ensure the following are present in your HTML for everything to work:
 *
 * <p>First, make sure you have the following in the head:</p>
 *
 * <p><tt>&lt;script type="text/javascript" src="http://surveyman.github.io/surveyman.js/survey.js"&gt;&lt;/script&gt;<br/>
      &lt;script type="text/javascript" src="http://surveyman.github.io/surveyman.js/interpreter.js"&gt;&lt;/script&gt;<br/>
      &lt;script type="text/javascript" src="http://surveyman.github.io/surveyman.js/display.js"&gt;&lt;/script&gt;</tt>
  </p>
 *
 * <p>If you are using AMT as your backend, you will also need a link to the submission script in the head, per the AMT documentations. If you are using a local backend, you will need some way to capture the assignment id, since it's used to seed the random number generator. The SurveyMan backend generates the following when it is being run locally:</p>
 *
 * <p><tt>&lt;script type="text/javascript"&gt;
   $.ajaxSetup({async:false});<br/>
   var turkSetAssignmentID = function () { <br/>
   &nbsp;&nbsp;$.get("assignmentId", function(_aid) { <br/>
   &nbsp;&nbsp;&nbsp;&nbsp;console.log("Just pulled assignment Id : " + _aid); <br/>
   &nbsp;&nbsp;&nbsp;&nbsp;document.getElementById("assignmentId").value = _aid.trim(); <br/>
   &nbsp;&nbsp;&nbsp;&nbsp;aid = _aid; <br/>
   &nbsp;&nbsp;}); <br/>
             }; <br/>
   &lt;/script&gt;</tt></p>
 *
 * <p><tt>turkSetAssignmentId</tt> is an AMT-defined function. Since <tt>SurveyMan.display.ready</tt> expects it, we define a local version here. AMT also injects an `assignmentId` element, so when we run locally, we add an element with this id to our form.</p>
 *
 * <p>SurveyMan generates a form to be sent with a POST; although a user-defined version could simply collect data in a Javascript object and POST this back to a local server, we wanted to be able to write one version to work with both AMT and a local server.</p>
 *
 * <p>At the end of the body, SurveyMan adds the following snippet:</p>
 *
 * <tt>
 &lt;script type='text/javascript'&gt;</br/>
 &nbsp;&nbsp;turkSetAssignmentID();</br/>
 &nbsp;&nbsp;var loadPreview=function(){<PROBABLY_A_CONSENT_FORM>},</br/>
 &nbsp;&nbsp;jsonizedSurvey=<JSONIZED_SURVEY>;</br/>
 &nbsp;&nbsp;Surveyman.display.ready(jsonizedSurvey, loadPreview);</br/>
     &lt;/script&gt;
   </tt>
 *
 */
//  surveyman.js 0.2.0
//  http://surveyman.github.io/surveyman.js
//  (c) 2015 University of Massachusetts Amherst
//  surveyman.js is released under the CRAPL.

// Major refactor 9/2015:
// Bug fixes.
// Remove underscore.
// Swap in some ES6 features.
// Merged interpreter and survey object.

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

/*****************************************************************************
 * Survey submodule
 *****************************************************************************/

// Internal maps from string ids to objects
// ----------------------------------------
var blockMAP = new Map(),
    optionMAP = new Map(),
    questionMAP = new Map();

/**
 * Resets the lookup maps for blocks, options, and questions.
 */
var global_reset = function() {
  blockMAP.clear();
  optionMAP.clear();
  questionMAP.clear();
};

// Exceptions
// ----------
var SMSurveyException = function (msg, override = false) {
  this.msg = (override) ? msg : `SMSurveyException: ${msg}`;
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
    counter--;
  }
};

var sortById = function (lst) {
  // Bubble sort, yo!
  // We generally expect these to already be sorted.
  while(true) {
    let swapped = false;
    for (let j = 0; j < lst.length - 1; j++) {
      let b1 = lst[j];
      let b2 = lst[j+1];
      // getting some weirdness earlier; not sure why
      if (b1.idComp(b2) === 1) {
        log.info(`swapping blocks ${b1.id} and ${b2.id}`);
        swapped = true;
        lst[j] = b2;
        lst[j+1] = b1;
      }
    }
    // if there were no swaps, then we are already sorted.
    if (!swapped) return;
  }
};


/**
 * Gets the Option object from the internal mapping of ids to Options.
 * Throws an exception if the id is not found.
 * @param {string} oid The option id.
 * @returns {Option}
 */
var getOptionById = function (oid) {
  if (optionMAP.has(oid)) {
    return optionMAP.get(oid);
  }
  console.log(optionMAP);
  throw new ObjectNotFoundException('Option', oid, 'optionMAP');
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
 * <ul>
 * <li>boolean, for most question fields (e.g., randomize, exclusive, etc.)</li>
 * <li>string or regexp, for the freetext field</li>
 * <li>boolean or an array for option ids, for the ordered field</li>
 * </ul>
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
 * <ul>
 *     <li><b>id</b> string representing the internal id of this option</li>
 *     <li><b>otext</b> string representation of the option (may include HTML)</li>
 *     <li><b>question</b> the question to which this option belongs</li>
 * </ul>
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
var Option = function (_jsonOption, _question = null) {
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
Option.makeOptions = function (jsonOptions, enclosingQuestion = null, ordered = null) {
  if (jsonOptions === undefined) {
    log.info(`No options defined for Question ${enclosingQuestion.id} ( ${enclosingQuestion.qtext} )`);
    return;
  }
  let oList = jsonOptions.map((o) => new Option(o, enclosingQuestion));
  if (Array.isArray(ordered)) {
    console.assert(ordered.length === oList.length,
        'Ordered ids have a different length from the number of options.');
    let newList = [];
    ordered.forEach((oid) =>
        newList.push(oList.filter((o) => o.id === oid)[0]));
    return newList;
  }
  return oList;
};

/**
 * The Question object holds a single question. It has 12 fields:
 * <ul>
 * <li><b>id</b> string representation of the internal id of this question</li>
 * <li><b>makeBranchMap</b> creates the branch map from options to blocks</li>
 * <li><b>block</b> the block containing this question</li>
 * <li><b>qtext</b> the text to display with this question (may contain HTML)</li.
 * <li><b>freetext</b> flag/string/regexp providing freetext data about this question</li>
 * <li><b>options</b> the list of options associated with this question (may be empty)</li>
 * <li><b>correlation</b> either a string or a list of strings corresponding to questions
 *  we expect to be correlated with this question</li>
 * <li><b>randomizable</b> boolean indicating whether the options in this question can be shuffled</li>
 * <li><b>ordered</b> boolean or ordered list of option ids</li>
 * <li><b>exclusive</b> determines whether we should display options as radio or checkbox</li>
 * <li><b>breakoff</b> boolean indicating whether we should allow people to submit the survey at this
 *   question</li>
 * <li><b>randomize</b> function to randomize the contents of this question</li>
 * </ul>
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
  this.getOption = function (oid) {
    for (let i = 0; i < this.options.length; i++) {
      if (this.options[i].id === oid) {
        return this.options[i];
      }
    }
    throw new ObjectNotFoundException('Option', oid, `question ${this.id}`);
  };
  this.makeBranchMap = function (question) {
    return function () {
      var bm = new Map();
      // json branchMap is a map from oid to bid
      // internal branchMap is a map from Option to Block
      for (var k in branchMap) {
        var o = question.getOption(k);
        var b;
        if (branchMap[k] === null) {
          b = Block.NEXT_BLOCK;
        } else {
          b = getBlockById(branchMap[k]);
        }
        bm.set(o, b);
      }
      question.branchMap = bm;
    };
  }(this);
  this.setFreetext = function (freetext) {
    var reRe = new RegExp('#\{.*\}'),
        ft = freetext;
    if (ft === true) {
      return true;
    } else if (reRe.exec(ft)) {
      return new RegExp(ft.substring(2, ft.length - 1));
    } else return ft;
  };

  this.block = _block;
  this.id = id;
  this.qtext = qtext;
  this.freetext = parseBools(freetext, false) ?
      this.setFreetext(freetext) : Survey.freetextDefault;
  this.correlation = correlation;
  // FIELDS MUST BE SENT OVER AS STRINGS
  this.randomizable = parseBools(randomize, Survey.randomizeDefault);
  this.options = Option.makeOptions(options, this, this.ordered);
  this.ordered = parseBools(ordered, Survey.orderedDefault, this);
  this.exclusive = parseBools(exclusive, Survey.exclusiveDefault);
  this.breakoff = parseBools(breakoff, Survey.breakoffDefault);
  this.randomize = function () {
    if (!(this.randomizable && Boolean(this.options))) return;
    if (this.ordered) {
      if (Math.random() < 0.5) {
        this.options = this.options.reverse();
      }
    } else {
      FYshuffle(this.options);
    }
  };
};

/**
 * Creates question list from the json encoding of question options.
 * @param {JSON} _jsonQuestions
 * @param {Block} enclosingBlock
 * @returns {Array}
 */
Question.makeQuestions = function (_jsonQuestions, enclosingBlock) {
  var i, qList = [];

  for (i = 0; i < _jsonQuestions.length; i++) {
    var q = new Question(_jsonQuestions[i], enclosingBlock);
    qList.push(q);
  }
  return qList;
};

/**
 * The Block object holds other blocks or questions. It has 12 fields:
 * <ul>
 * <li><b>id</b> string representation of the internal id of this block. This has
 * an associated semantics.</li>
 * <li><b>idArray</b> convenience field -- an array representation of the id.</li>
 * <li><b>topLevelQuestions</b> the list of questions that are immediately contained in this block</li>
 * <li><b>subblocks</b> potentially empty block list</li>
 * <li><b>randomizable</b> boolean indicating whether this block is randomizable or 'floating'</li>
 * <li><b>isBranchAll</b> function returning a boolean indicating whether this is a BRANCH-ALL block</li>
 * <li><b>getQuestion</b> returns the question in this block associated with the provided id</li>
 * <li><b>idComp</b> compares two subblocks to determine their precedence</li>
 * <li><b>randomize</b> function to randomizes this block's questions and subblocks</li>
 * <li><b>populate</b> initializes the blocks</li>
 * <li><b>getFirstQuestion</b> pops off the top question in the block; used by interpreter.js and display.js</li>
 * </ul>
 * @param {JSON} _jsonBlock
 * @constructor
 */
var Block = function(_jsonBlock) {
  assertJSONHasProperties(_jsonBlock, 'id');
  var id = _jsonBlock.id,
      questions = _jsonBlock.questions || [],
      randomize = _jsonBlock.randomize,
      subblocks = _jsonBlock.subblocks || [];
  blockMAP.set(id, this);

  var numbersRegexp = new RegExp('[0-9]+');
  var idStringToArray = (_idString) =>
    _idString.split('.').map((s) =>
      parseInt(numbersRegexp.exec(s)[0]));
  var floatingBlockRegexp = new RegExp('(_|[a-z][a-z]*)[1-9][0-9]*');
  var randomizableId = (_idString) => floatingBlockRegexp.exec(_idString.split('.').slice(-1)[0]);
  // get the total number of 'slots' and assign indices
  this.id = id;
  this.idArray = idStringToArray(id);
  this.topLevelQuestions = Question.makeQuestions(questions, this);
  this.subblocks = [];
  // may need to call a to boolean on jsonBlock.randomize
  this.randomizable = Boolean(randomizableId(this.id)) || parseBools(randomize, Block.randomizeDefault);
  this.isBranchAll = function() {
    var i, q, dests;
    if (this.topLevelQuestions.length < 2) return false;
    // We currently cannot randomly select a subblock.
    if (this.subblocks.length > 0) return false;
    // This previously checked whether the questions in the block all had NEXT pointers
    // We have relaxed this requirement.
    // The block is branch-all if all of the questions
    // Since we rely on the static analyzer to do a more thorough check, for now just see
    // if all of the branch maps are not empty.
    return this.topLevelQuestions.map((q) => q.branchMap.size).reduce((a, b) => a + b, 0) === 0;
  };
  this.getQuestion = function(quid) {
    for (var i = 0; i < this.topLevelQuestions.length; i++) {
      if (this.topLevelQuestions[i].id == quid) {
        return this.topLevelQuestions[i];
      }
    }
    throw new ObjectNotFoundException('Question', quid, `block ${this.id}`);
  };
  this.idComp = function(that) {
    // Returns whether that follows (+1), precedes (-1), or is a sub-block (0) of this
    // If the ids are exactly the same, return 0; this relationship will be symmetric
    if (this.id === that.id) return 0;
    for (let i = 0; i < this.idArray.length + 1; i++) {
      // If we have reached the end of the comparison and that block has a longer id, then
      // that block is a subblock.
      if (i >= that.idArray.length || i === this.idArray.length) return 0;
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
  this.randomize = function() {
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
    var indices = this.subblocks
        .reduce((lst, _) => lst.concat(lst.slice(-1)[0] + 1), [-1])
        .slice(1);
    FYshuffle(indices);
    var sample = indices.slice(0, nonStationaryBlocks.length);
    FYshuffle(nonStationaryBlocks);

    for (i = 0; i < sample.length; i++) {
      // Pick the locations for where to put the non-stationary blocks
      console.assert(nonStationaryBlocks[i] !== undefined,
        'nonStationaryBlocks should never be undefined.');
      newSBlocks[sample[i]] = nonStationaryBlocks[i];
    }
    for (i = 0, j = 0; i < newSBlocks.length; i++) {
      if (newSBlocks[i] === -1) {
        newSBlocks[i] = stationaryBlocks[j];
        j++;
      }
    }
    console.assert(j == stationaryBlocks.length,
      `j should equal the number of stationary blocks: ${j} vs. ${stationaryBlocks.length}`);
    this.subblocks = newSBlocks;
    this.subblocks.forEach((b) => b.randomize());
  };
  // Added a closure to make this-semantics clear.
  this.subblocks = function(containingBlock, subblocks) {
    function populate(json_block, parent) {
      var b = new Block(json_block);
      b.parent = parent;
      return b;
    }
    if (subblocks.length === 0) {
      log.info(`No subblocks in Block ${containingBlock.id}`);
      return [];
    }
    return subblocks.map((subb) => populate(subb, containingBlock));
  }(this, subblocks);
  console.assert(
      subblocks.length === this.subblocks.length,
      `json subblocks must match Block object subblocks: ` +
      `${subblocks.length} vs. ${this.subblocks.length}`);
  this.getFirstQuestion = function () {
    if (this.topLevelQuestions.length !== 0)
      return this.topLevelQuestions[0];
    if (this.subblocks.length === 0)
      throw new MalformedSurveyException(`empty block stack ending in ${this.id}`);
    return this.subblocks[0].getFirstQuestion();
  };
  // Assert that the sub-blocks have the appropriate ids
  console.assert(this.subblocks.reduce(
    (tv, b) => tv && this.idComp(b) === 0, true),
    'subblocks should all return 0 on idComp'
  );
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
Block.new_block = function(parent) {
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
 * Produces the next block pointer.
 * @returns {{id: string, randomize: Function}}
 * @constructor
 */
Block.NEXT_BLOCK = function() {
  return {
    id: "NEXT",
    randomize: function() {}
  };
};

/**
 * Survey constructor. Takes a json survey and returns an internal survey
 * object. It contains the fields:
 * <ul>
 *   <li><b>filename</b> The path of the source file used to generate this survey; may be empty.</li>
 *   <li><b>topLevelBlocks</b> The list of top level blocks in this survey. </li>
 *   <li><b>breakoff</b> Boolean indicating whether breakoff is permitted for this survey.</li>
 *   <li><b>questions</b> list of all questions. This gets wrapped in an Immutable.List.</li>
 * </ul>
 * @param {json} _jsonSurvey - the input survey, typically generated by another program.
 * @constructor
 */
var Survey = function(_jsonSurvey) {
  assertJSONHasProperties(_jsonSurvey, 'filename', 'survey');
  var {filename, survey, breakoff} = _jsonSurvey;
  var makeSurvey = (_jsonSurvey) => _jsonSurvey.map((jsonBlock) => new Block(jsonBlock));
  this.filename = filename;
  this.topLevelBlocks = makeSurvey(survey);
  questionMAP.forEach((q) =>  q.makeBranchMap());
  this.breakoff = parseBools(breakoff, Survey.breakoffDefault);
  // Not sure why this isn't working; I think it might be a problem with babel:
  // this.questions = Array.from(questionMAP.values());
  this.questions = [];
  let qiter = questionMAP.values();
  while (true) {
    let {done, value} = qiter.next();
    if (done) return;
    this.questions.push(value);
  }
};

Survey.randomize = function(_survey) {
  // Select out and randomize the top level floating blocks.
  var randomizableBlocks = _survey.topLevelBlocks.filter((_block) => _block.randomizable);
  // Select out and ensure that the stationary blocks are sorted.
  var normalBlocks = _survey.topLevelBlocks.filter((_block) => !_block.randomizable);
  sortById(normalBlocks);
  // Create a new array for the top level blocks.
  var newTLBs = _survey.topLevelBlocks.map((b) => null);
  // Sample indices for the floating blocks.
  var indices = newTLBs.reduce((lst, _) => [lst[0] + 1].concat(lst), [0]);
  FYshuffle(indices);
  indices = indices.slice(0, randomizableBlocks.length);

  // Put the floating blocks where they belong
  for (let j = 0; j < indices.length; j++) {
      newTLBs[indices[j]] = randomizableBlocks[j];
  }

  // Now put the stationary blocks in order
  var k = 0;
  for (let i = 0; i < newTLBs.length; i++) {
    if (!newTLBs[i]) {
      newTLBs[i] = normalBlocks[k];
      k++;
    }
  }

  // Reset top level blocks
  console.assert(newTLBs.length > 0, 'Need at least one top level block.');
  _survey.topLevelBlocks = newTLBs;
  _survey.topLevelBlocks.forEach((tlb) => tlb.randomize());
};

// 'static' fields
Survey.exclusiveDefault = true;
Survey.orderedDefault = false;
Survey.randomizeDefault = true;
Survey.freetextDefault = false;
Survey.breakoffDefault = true;
Block.randomizeDefault = false;

// Wrapper for creating a new survey
var new_survey = function () {
  return init([]);
};

/**
 * @namespace
 * @type {{_parseBools: Function, _sortById: Function, _global_reset: Function, init: Function, getOptionById: Function, getQuestionById: Function, getBlockById: Function, Survey: Function, Block: Function, Question: Function, Option: Function}}
 */
var survey = {
  _parseBools : parseBools,
  _sortById: sortById,
  _global_reset: global_reset,
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

/*****************************************************************************
 * Interpreter submodule
 *****************************************************************************/

var questionSTACK       =   [],
    blockSTACK          =   [],
    branchDest          =   null;

var flatten = function(lst) {
  if (lst.length === 0) {
    return [];
  } else {
    let [hd, ...tl] = lst;
    if (Array.isArray(hd)) {
      return hd.map(flatten).concat(flatten(tl));
    } else {
      return [hd].concat(flatten(tl));
    }
  }
};

/**
 *   Gets all questions for a particular block.
 *
 *   Either one question is a branch or all are "branch", and they're always
 *   out of the top level block. Put the current block's questions in a global
 *   stack that we can empty.
 * @param _block {survey.Block} The block whose questions we want.
 * @returns {Array} A stack of questions.
 */
var getAllBlockQuestions = function (_block) {
  if (_block.isBranchAll()) {
    FYshuffle(_block.topLevelQuestions);
    return _block.topLevelQuestions[0];
  }

  var retval = [];
  var indices = Array.from(_block.topLevelQuestions.concat(_block.subblocks).keys());
  FYshuffle(indices);
  var qindices = indices.slice(0, _block.topLevelQuestions.length);
  var bindices = indices.filter((i) => !qindices.find((j) => j === i));

  let j = 0, k = 0;
  for (let i; i < indices.length; i++) {
    // it happens that i == indices[i]
    if (qindices.find((l) => l === i).length === 1) {
      retval.push(_block.topLevelQuestions[j]);
      j++;
    } else if (bindices.find((l) => l === i).length === 1) {
      retval.push(getAllBlockQuestions(_block.subblocks[k]));
      k++;
    } else {
      throw "Neither qindices nor bindices contain index " + i;
    }
    return flatten(retval);
  }
};

/**
 * Intitalizes the block and question stacks for the interpreter.
 * @param {Array<survey.Block>} _blist The list of all top-level blocks.
 */
var initializeStacks = function(_blist) {
  blockSTACK = _blist;
  questionSTACK = getAllBlockQuestions(blockSTACK.shift());
};

/**
 * Loads the provided question list onto the question stack; used between
 * blocks.
 * @param {Array<survey.Question>} _qList The next set of questions to ask.
 */
var loadQuestions = function(_qList) {
  questionSTACK = _qList;
};

/**
 * Tests whether we have exhausted the questions for this block.
 * @returns {boolean}
 */
var isQuestionStackEmpty = function () {
  return questionSTACK.length === 0;
};

/**
 * Tests whether we have exhaused the blocks in this survey.
 * @returns {boolean}
 */
var isBlockStackEmpty = function() {
  return blockSTACK.length === 0;
};

/**
 * Returns the next question in the survey. If the question stack is empty,
 * this returns undefined.
 * @returns {survey.Question}
 */
var nextQuestion = function() {
  return questionSTACK.shift();
};

/**
 * Returns the next block in the survey. If the previous block was a branch-one
 * block, pops off stationary blocks until it either reaches a floating block or
 * the branch destination. If it finds the branch destination first, it resets
 * the branchDest pointer.
 * @returns {survey.Block}
 */
var nextBlock =  function() {
  var head;
  if (branchDest) {
    while (!isBlockStackEmpty()) {
      head = blockSTACK.shift();
      if (head === branchDest) {
        blockSTACK.unshift(head);
        branchDest = null;
        break;
      } else if ( head.randomizable ) {
        blockSTACK.unshift(head);
        break;
      }
    }
  }
  console.assert(isQuestionStackEmpty());
  loadQuestions(getAllBlockQuestions(blockSTACK.shift()));
  return head;
};

/**
 * Checks whether the provided question has a "true" branch target for the
 * provided option. Returns the apporpriate question.
 * @param {survey.Question} q
 * @param {survey.Option} o
 * @returns {survey.Question}
 */
var handleBranching = function (q, o){
  if (q.branchMap.has(o.id))
    branchDest = q.branchMap.get(o.id);
  if ( isQuestionStackEmpty() )
    nextBlock();
  return nextQuestion();
};

/**
 * Returns the next question. If the block stack is empty, refreshes it.
 * @returns {survey.Question}
 */
var nextSequential = function () {
  if ( isQuestionStackEmpty() )
    nextBlock();
  return nextQuestion();
};

/**
 * @namespace interpreter
 * @type {{init: Function, isQuestionStackEmpty: Function, isBlockStackEmpty: Function, nextBlock: Function, nextQuestion: Function, handleBranching: Function, nextSequential: Function}}
 */
var interpreter = {
  init:   function (jsonSurvey) {
    var survey = SurveyMan.survey.init(jsonSurvey);
    initializeStacks(survey.topLevelBlocks);
    return survey;
  },
  isQuestionStackEmpty: isQuestionStackEmpty,
  isBlockStackEmpty: isBlockStackEmpty,
  nextBlock: nextBlock,
  nextQuestion: nextQuestion,
  handleBranching: handleBranching,
  nextSequential: nextSequential
};

/*****************************************************************************
 * exported module
 *****************************************************************************/

try {
  var sm = {
      survey: survey,
      interpreter: interpreter
    };
  if (module) {
    module.exports = sm;
  } else {
    // we are in the browser; make this global
    surveyman = sm;
  }
} catch (e) {
  console.log(e);
}