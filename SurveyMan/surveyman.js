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
 * <p><tt>&lt;script type="text/javascript" src="http://surveyman.github.io/surveyman.js/deprecated/survey.js"&gt;&lt;/script&gt;<br/>
      &lt;script type="text/javascript" src="http://surveyman.github.io/surveyman.js/deprecated/interpreter.js"&gt;&lt;/script&gt;<br/>
      &lt;script type="text/javascript" src="http://surveyman.github.io/surveyman.js/deprecated/display.js"&gt;&lt;/script&gt;</tt>
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
  this.toJSON = function() {
    return {
      id: this.id,
      otext: this.otext
    };
  };
  /**
   * Two options are equal if their ids and text match. Note that this is not
   * the same definition of equality as what is used in the final SurveyMan analysis.
   * @param {*} that The object we are comparing this object to.
   * @returns {boolean}
   */
  this.equals = function(that) {
    return that instanceof Option &&
        this.id === that.id &&
        this.otext === that.otext;
  }
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
    return [];
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
 * The Question object holds a single question.
 * @param {JSON} _jsonQuestion
 * @param {Question} _block
 * @constructor
 */
var Question = function(_jsonQuestion, _block) {
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
  this.branchMap = new Map();
  /**
   * Returns the Option object associated with the provided option id.
   * @param oid
   * @returns {Option}
   * @throws ObjectNotFoundException if this question does not contain an
   * option with the provided id.
   */
  this.getOption = function (oid) {
    for (let i = 0; i < this.options.length; i++) {
      if (this.options[i].id === oid) {
        return this.options[i];
      }
    }
    throw new ObjectNotFoundException('Option', oid, `question ${this.id}`);
  };
  /**
   * Function used to parse the provided freetext.
   * @param freetext
   * @returns {RegExp|boolean|string}
   */
  this.setFreetext = function (freetext) {
    var reRe = new RegExp('#\{.*\}'),
        ft = freetext;
    if (ft === true) {
      return true;
    } else if (reRe.exec(ft)) {
      return new RegExp(ft.substring(2, ft.length - 1));
    } else return ft;
  };
  /**
   * The block containing this question
   * @type {Block}
   */
  this.block = _block;
  /**
   * String representation of the internal id of this question
   * @type {string}
   */
  this.id = id;
  /**
   * The text to display with this question (may contain HTML).
   * @type {string}
   */
  this.qtext = qtext;
  /**
   * Provides freetext data about this question.
   * @type {boolean|string|RegExp}
   */
  this.freetext = parseBools(freetext, false) ?
      this.setFreetext(freetext) : Survey.freetextDefault;
  /**
   * Either a string or a list of strings corresponding to questions we expect
   * to be correlated with this question.
   * @type {string|Array<string>}
   */
  this.correlation = correlation;
  // FIELDS MUST BE SENT OVER AS STRINGS
  /**
   * Boolean indicating whether the options in this question can be shuffled.
   * @type {boolean}
   */
  this.randomizable = parseBools(randomize, Survey.randomizeDefault);
  /**
   * The list of options associated with this question (may be empty).
   * @type {Array.<Option>}
   */
  this.options = Option.makeOptions(options, this, this.ordered);
  /**
   * Creates the branch map from options to blocks
   * @type {Function}
   */
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
  /**
   *  Boolean or ordered list of option ids.
   * @type {boolean|Array.<string>}
   */
  this.ordered = parseBools(ordered, Survey.orderedDefault, this);
  /**
   * Determines whether we should display options as radio or checkbox.
   * @type {boolean}
   */
  this.exclusive = parseBools(exclusive, Survey.exclusiveDefault);
  /**
   * Boolean indicating whether we should allow people to submit the survey at
   * this question.
   * @type {boolean}
   */
  this.breakoff = parseBools(breakoff, Survey.breakoffDefault);
  /**
   * Function to randomize the contents of this question.
   * @type {Function}
   */
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
  /**
   * Returns the json representation of this question.
   * @returns {{id: *, qtext: *, branchMap: {}, freetext: *, correlation: *, randomize: (boolean|*), options: *, ordered: *, exclusive: *, breakoff: *}}
   */
  this.toJSON = function() {
    let branchMap = {};
    for (let [v, k] in this.branchMap.entries()) {
      branchMap[k] = v;
    }
    return {
      id: this.id,
      qtext: this.qtext,
      branchMap: branchMap,
      freetext: this.freetext instanceof RegExp ? this.freetext.source : this.freetext,
      correlation: this.correlation,
      randomize: this.randomizable,
      options: this.options.map((o) => o.toJSON()),
      ordered: this.ordered,
      exclusive: this.exclusive,
      breakoff: this.breakoff
    }
  };
  /**
   * Two questions are equal if their fields are equal; note that this is not
   * the same definition of equality as in the SurveyMan analyses.
   * @param {*} that The object to compare
   * @returns {boolean}
   */
  this.equals = function(that) {
    if (!(that instanceof Question)) return false;
    var branchMapEqual = true;
    for (var [k, v] of that.branchMap) {
      branchMapEqual = branchMapEqual &&
          that.branchMap.has(k) &&
          that.branchMap.get(k).equals(v);
      if (!branchMapEqual) break;
    }
    return that instanceof Question &&
        this.id === that.id &&
        this.qtext === that.qtext &&
        branchMapEqual &&
        this.freetext === that.freetext &&
        this.randomizable === that.randomizable &&
        this.options.reduce((tv, o1) => tv && that.options.find(o2 => o2.equals(o1)), true) &&
        this.ordered === that.ordered &&
        this.exclusive === that.exclusive &&
        this.breakoff === that.breakoff;
  };
  /**
   * Adds the provided option to this question. If the question and if option ids are not
   * semantic, the ordered field will be a list. Adds the new oid to the end of the list.
   * That is, this function assumes that for ordered options, options will be added in order.
   * @param {Option} option The option to add to this question.
   */
  this.add_option = function(option) {
    // TODO(etosch): write unit test.
    if (this.freetext) {
      throw new MalformedSurveyException('Cannot add an option to a freetext question.');
    } else {
      this.options.push(option);
      if (this.ordered && Array.isArray(this.ordered)) {
        this.ordered.push(option.oid);
      }
    }
  };
  this.remove_option = function(option) {
    let index = this.options.findIndex(o => o.equals(option));
    this.options.splice(index, 1);
  };
  this.clear_options = function() {
    // TODO(etosch): write unit test.
    this.options = [];
    this.branchMap = new Map();
    if (Array.isArray(this.ordered)) {
      this.ordered = [];
    }
  }
};

/**
 * Creates question list from the json encoding of question options.
 * @param {JSON} _jsonQuestions
 * @param {Block} enclosingBlock
 * @returns {Array}
 */
Question.makeQuestions = function(_jsonQuestions, enclosingBlock) {
  var i, qList = [];

  for (i = 0; i < _jsonQuestions.length; i++) {
    var q = new Question(_jsonQuestions[i], enclosingBlock);
    qList.push(q);
  }
  return qList;
};

/**
 * The Block object holds other blocks or questions.
 * @param {JSON} _jsonBlock The json version of the block, passed as the initial input.
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
  this._idStringToArray = (_idString) =>
    _idString.split('.').map((s) =>
      parseInt(numbersRegexp.exec(s)[0]));
  var floatingBlockRegexp = new RegExp('(_|[a-z][a-z]*)[1-9][0-9]*');
  var randomizableId = (_idString) => floatingBlockRegexp.exec(_idString.split('.').slice(-1)[0]);
  // get the total number of 'slots' and assign indices
  /**
   * The user-supplied id. This will have the heirarchical/randomization semantics embedded in it.
   * e.g.: 1._2
   * @type string
   */
  this.id = id;
  /**
   * The idArray allows for quick lookup when comparing different blocks. For example, the block
   * with id 1._2 has an idArray of [1, 2].
   * @type {Array<number>}
   */
  this.idArray = this._idStringToArray(id);
  /**
   * The questions contained directly in this block, i.e., not in subblocks.
   * @type {Array<Question>}
   */
  this.topLevelQuestions = Question.makeQuestions(questions, this);
  /**
   * The subblocks of this block.
   * @type {Array<Block>}
   */
  this.subblocks = [];
  /**
   * Boolean indicating whether this is a floating block.
   * @type {boolean}
   */
  this.randomizable = Boolean(randomizableId(this.id)) || parseBools(randomize, Block.randomizeDefault);
  /**
   * Returns boolean indicating whether this is a branch-all block.
   * @returns {boolean}
   */
  this.isBranchAll = function() {
    var i, q, dests;
    // We currently cannot randomly select a subblock.
    if (this.subblocks.length > 0) return false;
    // This previously checked whether the questions in the block all had NEXT pointers
    // We have relaxed this requirement.
    // The block is branch-all if all of the questions
    // Since we rely on the static analyzer to do a more thorough check, for now just see
    // if all of the branch maps are not empty.
    return this.topLevelQuestions.map((q) => q.branchMap.size).reduce((a, b) => a + b, 0) === 0;
  };
  /**
   * Returns boolean indicating whether this is a branch-one block.
   * @returns {boolean}
   */
  this.isBranchOne = function() {
    // Assume that we are properly formed.
    if (this.isBranchAll()) return false;
    if (this.topLevelQuestions.filter((q) => q.branchMap.size > 0).length === 1) return true;
    for (let i = 0; i < this.subblocks.length; i++) {
      if (this.subblocks[i].isBranchOne()) {
        return true;
      }
    }
    return false;
  };
  /**
   * Returns the question object associated with the input id.
   * @param {string} quid The question's id.
   * @param {boolean} deep Flag indicating whether we should search through subblocks.
   * @returns {Question}
   * @throws ObjectNotFoundException if this block does not contain a question with
   * the input id at the top level.
   */
  this.getQuestion = function(quid, deep = false) {
    for (let i = 0; i < this.topLevelQuestions.length; i++) {
      if (this.topLevelQuestions[i].id == quid) {
        return this.topLevelQuestions[i];
      }
    }
    // TODO(etosch): write unit test
    if (deep) {
      for (let b in this.subblocks) {
        try {
          return b.getQuestion(quid, true);
        } catch (e) {}
      }
    }
    throw new ObjectNotFoundException('Question', quid, `block ${this.id}`);
  };
  /**
   * Returns whether that follows (+1), precedes (-1), or is a sub-block (0) of this.
   * If the ids are exactly the same, return 0; this relationship will be symmetric.
   * @param {Block} that The block to compare.
   * @returns {number}
   */
  this.idComp = function(that) {
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
  /**
   * Randomizes this block. Shuffles this block's questions and its subblocks appropriately.
   */
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
  /**
   * Returns the first question to be seen from this block.
   * @returns {Question}
   * @throws MalformedSurveyException if there are no questions or subblocks.
   */
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
  /**
   * Returns the JSON representation of this block.
   * @returns {{id: *, questions: *, randomize: (boolean|*), subblocks: *}}
   */
  this.toJSON = function() {
    return {
      id: this.id,
      questions: this.topLevelQuestions.map((q) => q.toJSON()),
      randomize: this.randomizable,
      subblocks: this.subblocks.map((b) => b.toJSON())
    };
  };
  /**
   * Tests whether the supplied item is equivalent, in terms of Block's fields.
   * Note that this is not the same definition of equality that SurveyMan uses
   * for its analyses.
   * @param {*} that The thing to compare.
   * @returns {boolean}
   */
  this.equals = function(that) {
    // TODO(etosch) write unit test)
    return that instanceof Block &&
            this.id === that.id &&
            this.subblocks.reduce((tv, b1) =>
              tv && that.subblocks.find(b2 => b1.equals(b2)), true) &&
            this.topLevelQuestions.reduce((tv , q1) =>
              tv && that.topLevelQuestions.find(q2 => q1.equals(q2)), true);
  };
  /**
   * Returns all questions belonging to this block and its subblocks.
   * @returns {Array<Question>}
   */
  this.getAllQuestions = function() {
    let retval = [...this.topLevelQuestions];
    this.subblocks.forEach((b) => b.getAllQuestions().forEach((q) => retval.push(q)));
    return retval;
  };
  /**
   * Gets the id of the parent block, to use for parent block lookup.
   * @returns {string}
   */
  // TODO(etosch): write unit test
  this.get_parent_id = function() {
    return this.id.split('.').slice(0, -1).reduce((a, b) => `${a}.${b}`);
  };
  /**
   * Adds the block provided block to this block.
   * @param {Block} containingBlock The block to add.
   * @param {?number} index The index at which to add this block.
   */
    // TODO(etosch): write unit test
  this.add_block = function(containingBlock, index = -1) {
    index = index === -1 ? containingBlock.subblocks.length : index;
    var update_ids = function(parent, child) {
      // update block's id
      child.id = `${parent.id}.${child.randomizable ? '_' : ""}${parent.subblocks.length}`;
      child.idArray = child._idStringToArray(child.id);
      child.subblocks.forEach((b) => update_ids(child, b));
    };
    return function(block) {
      // Check whether it is valid to add this block.
      if (containingBlock.isBranchAll()) {
        throw new MalformedSurveyException('Cannot add subblocks to branch-all blocks.');
      }
      if (containingBlock.isBranchOne() && block.isBranchOne()) {
        throw new MalformedSurveyException('Cannot add branch-one blocks as subblocks to a branch-all block');
      }
      if (block.get_parent_id() !== containingBlock.id) {
        update_ids(containingBlock, block);
      }
      containingBlock.subblocks.splice(index, 0, block);
      block.parent = containingBlock;
    }
  }(this);
  /**
   * Adds the provided question to this block.
   * @param {survey.Question} question Question to add to this block.
   * @throws MalformedSurveyException if the question cannot be added.
   */
  // TODO(etosch): write unit test
  this.add_question = function(question) {
    let isBranchAll = this.isBranchAll();
    let isBranchOne = this.isBranchOne();
    let isBranchNone = !isBranchAll && !isBranchOne;
    let addingNonBranchingQuestionToNonBranchAllBlock =
        question.branchMap.size === 0 &&
        !isBranchAll;
    let addingBranchingQuestionToNonBranchingBlock =
        question.branchMap.size > 0 &&
        isBranchNone;
    let addingBranchingQuestionToSingleQuestionBranchOne =
        question.branchMap.size > 0 &&
        isBranchOne &&
        this.subblocks.length === 0 &&
        this.topLevelQuestions.length === 1 &&
        this.topLevelQuestions[0].branchMap.size === question.branchMap.size;
    let addingBranchingQuestionToBranchAllBlock =
        question.branchMap.size > 0 &&
        isBranchAll &&
        this.topLevelQuestions.reduce((tv, q) =>
            tv && q.branchMap.size === question.branchMap.size,
            true
        );

    if (addingNonBranchingQuestionToNonBranchAllBlock ||
        addingBranchingQuestionToNonBranchingBlock ||
        addingBranchingQuestionToSingleQuestionBranchOne ||
        addingBranchingQuestionToBranchAllBlock
    ) {
      this.topLevelQuestions.push(question);
      return;
    }
    throw new MalformedSurveyException(
        `Cannot add question with branch map size ${question.branchMap.size} to block of type `+
        `${isBranchAll ? 'BRANCH_ALL' : (isBranchNone ? 'BRANCH_NONE' : 'BRANCH_ONE')}`);
  };
  this.remove_question = function(question) {
    // TODO(etosch): write unit test
    let idx = this.topLevelQuestions.indexOf(question)
    if (idx !== -1) {
      this.topLevelQuestions.splice(idx, 1);
      return true;
    } else {
      for (let b in this.subblocks) {
        if (b.remove_question(question)) {
          return true;
        }
      }
    }
    return false;
  }
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
  return new Block({
    id: id,
    questions: [],
    subblocks: []
  });
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
 * object.
 * @param {json} _jsonSurvey The input survey, typically generated by another program.
 * @constructor
 */
var Survey = function(_jsonSurvey) {
  questionMAP.clear();
  blockMAP.clear();
  assertJSONHasProperties(_jsonSurvey, 'filename', 'survey');
  var {filename, survey, breakoff} = _jsonSurvey;
  var makeSurvey = _jsonSurvey => _jsonSurvey.map((jsonBlock) => new Block(jsonBlock));
  /**
   * The path of the source file used to generate this survey; may be empty.
   * @type {string}
   */
  this.filename = filename;
  /**
   * The list of top level blocks in this survey.
   * @type {Array<survey.Block>}
   */
  this.topLevelBlocks = makeSurvey(survey);
  questionMAP.forEach((q) =>  q.makeBranchMap());
  /**
   * Boolean indicating whether breakoff is permitted for this survey.
   * @type {boolean}
   */
  this.breakoff = parseBools(breakoff, Survey.breakoffDefault);
  // Not sure why this isn't working; I think it might be a problem with babel:
  // this.questions = Array.from(questionMAP.values());
  /**
   * The list of all questions.
   * @type {Array<survey.Question>}
   */
  this.questions = [];
  let qiter = questionMAP.values();
  while (true) {
    let {done, value} = qiter.next();
    if (done) break;
    this.questions.push(value);
  }
  /**
   * Returns the JSON representation of this survey.
   *
   * Note: we cannot just return the input json because the survey may have been mutated.
   * @returns {{filename: *, breakoff: *, survey: *}}
   */
  this.toJSON = function() {
    return {
      filename: this.filename,
      breakoff: this.breakoff,
      survey: this.topLevelBlocks.map((b) => b.toJSON())
    };
  };
  this.equals = function(that) {
    return that instanceof Survey &&
            this.topLevelBlocks.length === that.topLevelBlocks.length &&
            this.topLevelBlocks.reduce((tv, b1) =>
              tv && that.topLevelBlocks.find(b2 => b1.equals(b2)), true);
  };
  this._find_containing_question = function(qid, survey) {
    //  Find the block that holds the question
    return survey.topLevelBlocks.map(function (b) {
      try {
        return b.getQuestion(qid, true);
      } catch (e) {
        return false;
      }
    }).filter((item) => item !== false)[0];
  };
  /**
   * Adds the block to the survey. Mutates the survey object.
   * @param {Block} block The top-level block to add.
   * @param {?Block} parent This block's parent. If null, it will attempt to find
   * the parent.
   */
  this.add_block = function(block, parent = null) {
    // TODO(etosch): write unit test
    // We are not adding a top-level block
    if (block.idArray.length > 1) {
      if (!parent) {
        let parentid = block.get_parent_id();
        parent = getBlockById(parentid);
      }
      parent.add_block(block);
    } else {
      this.topLevelBlocks.push(block);
    }
    // add this block's questions to the top level survey questions
    block.getAllQuestions().forEach((q) => this.questions.push(q));
  };
  /**
   * Removes the block from the survey. Mutates the survey object.
   * @param {Block} block The block to delete.
   * @param {?Block} parent This block's parent. If null, it will attempt to find
   * the parent.
   */
  this.remove_block = function(block, parent = null) {
    // TODO(etosch): write unit test
    if (block.idArray.length > 1) {
      if (!parent) {
        let parentid = block.get_parent_id();
        parent = getBlockById(parentid);
      }
      parent.remove_block(block);
    } else {
      let i = this.topLevelBlocks.index(block);
      this.topLevelBlocks.splice(i, 1);
    }
    // remove this block's questions from the top level survey questions.
    block.getAllQuestions().forEach(q => {
      let i = this.questions.index(q);
      this.questions.splice(i, 1);
    })
  };
  /**
   * Adds the provided question to the provided block in this survey.
   * @param {Question} question The question to add.
   * @param {Block} block The block to add to.
   */
  this.add_question = function(question, block) {
    block.add_question(question);
  };
  /**
   * Removes the provided question from the survey. If the containing block is not
   * provided, the method will search for it.
   * @param {Question} question The question to remove.
   * @param {?Block} block Optional block to remove the survey from.
   */
  this.remove_question = function(survey) {
    return function (question, block = null) {
      if (!block) {
        block = survey._find_containing_question(question, survey);
      }
      block.remove_question(question);
    };
  }(this);
  /**
   * Swaps out the provided question for one having the same id.
   * @param {survey.Question} new_question The replacement question.
   */
  this.replace_question = function(new_question) {
    // TODO(etosch): write unit test.
    let old_question = this.questions.filter((q) => q.id === new_question.id)[0];
    let index_to_remove = this.questions.indexOf(old_question);
    let containing_block = this._find_containing_block(new_question.id);
    this.questions.splice(index_to_remove, 1, new_question);
    // swap the questions
    if (!b.remove_question(old_question)) {
      throw new SMSurveyException(
          `Attempting to remove question that has already been removed: ${old_question}`,
          true);
    }
    b.add_question(new_question);
  };
  /**
   * Returns the Question object in this survey that has the provided id.
   * @param {string} question_id The identifier of the question of interest.
   * @returns {Question}
   */
  this.get_question_by_id = function(question_id) {
    // TODO(etosch): write unit test.
    return this.questions.find(q => q.id === question_id);
  };
  /**
   * Returns the Block object in this survey that has the provided id.
   * @param {string} block_id Block identifier.
   * @returns {Block}
   * @throws ObjectNotFoundException
   */
  // TODO(etosch): write unit test
  this.get_block_by_id = function(block_id) {
    for (let [,b] of this.topLevelBlocks.entries()) {
      if (b.id === block_id) {
        return b;
      }
    }
    throw new ObjectNotFoundException('Block', block_id, 'current survey');
  };
  this.remove_option = function(survey) {
    return function(option, question = null) {
      if (!question) {
        question = survey.questions.find(q =>
            q.options.find(o => o.equals(option))
        );
      }
      question.remove_option(option);
    }
  }(this);
};

/**
 * Randomizes the survey blocks and questions, as appropriate.
 * @param {Survey} _survey
 */
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
var getAllBlockQuestions = function(_block) {
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
  }
  return flatten(retval);
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

/*****************************************************************************
 * top-level surveyman module
 *****************************************************************************/

var _gensym = (function(counter) {
  return function (prefix = "") {
    return `${prefix}${counter++}`;
  };
})(0);

/**
 * Contains top-level calls for use by external programs, e.g. the survey construction GUI.
 * @namespace surveyman
 * @type {{survey: {_parseBools: Function, _sortById: Function, _global_reset: Function, init: Function, getOptionById: Function, getQuestionById: Function, getBlockById: Function, Survey: Function, Block: Function, Question: Function, Option: Function}, interpreter: {init: Function, isQuestionStackEmpty: Function, isBlockStackEmpty: Function, nextBlock: Function, nextQuestion: Function, handleBranching: Function, nextSequential: Function}}}
 */
module.exports = {
  /**
   * @namespace survey
   * @type {{_parseBools: Function, _sortById: Function, _global_reset: Function, init: Function, getOptionById: Function, getQuestionById: Function, getBlockById: Function, Survey: Function, Block: Function, Question: Function, Option: Function}}
   */
  survey: {
    _gensym: _gensym,
    _parseBools: parseBools,
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
  },
  /**
   * @namespace interpreter
   * @type {{init: Function, isQuestionStackEmpty: Function, isBlockStackEmpty: Function, nextBlock: Function, nextQuestion: Function, handleBranching: Function, nextSequential: Function}}
   */
  interpreter: {
    init: function (jsonSurvey) {
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
  },
  /**
   * Top-level call to create a new survey.
   * @returns {survey.Survey}
   */
  new_survey: function() {
    return new Survey({
      filename: "temp_file_name.json",
      breakoff: Survey.breakoffDefault,
      survey: []
    });
  },
  /**
   * Top-level call to copy the input survey to a new survey.
   * Quick and dirty approach -- converts to JSON and re-parses.
   * @param survey
   * @returns {survey.Survey}
   */
  copy_survey: function (survey) {
    return new Survey(survey.toJSON());
  },
  /**
   * Top-level call to create a new empty block.
   * @param {string} bid The block id.
   * @returns {survey.Block}
   */
  new_block: function (bid = _gensym("block")) {
    return new Block({
      id: bid,
      questions: [],
      subblocks: []
    });
  },
  /**
   * Top-level call to copy a block. Done by converting to JSON and copying.
   * This is the quick and dirty approach to copying.
   * @param {Block} block
   * @returns {Block}
   */
  copy_block: function (block) {
    return new Block(block.toJSON());
  },
  /**
   * Adds a block to the top level of the survey.
   * @param {survey.Block} block The block to add.
   * @param survey
   * @param mutate
   * @returns {?survey.Survey}
   */
  add_block: function (block, survey, mutate = true) {
    if (mutate) {
      survey.add_block(block);
      return null;
    } else {
      let s = copy_survey(survey);
      s.add_block(block);
      return s;
    }
  },
  /**
   * Top-level call to remove a block from the Survey.
   * @param {Block} block The block to remove.
   * @param {Survey} survey The survey to remove the block from.
   * @param {boolean} mutate Flag indicating whether we should mutate the survey,
   * or return a new survey with this block removed.
   * @returns {?Survey}
   */
  remove_block: function (block, survey, mutate = true) {
    if (mutate) {
      survey.remove_block(block);
      return null;
    } else {
      let s = this.copy_survey(survey);
      s.remove_block(block);
      return s;
    }
  },
  /**
   * Top-level call to create a new Question.
   * @param {string} surface_text The text to be displayed for this question. May include HTML.
   * @param {string} qid The question id.
   * @returns {survey.Question}
   */
  new_question: function (surface_text, qid = _gensym("question")) {
    return new survey.Question({
      id: qid,
      qtext: surface_text
    }, null);
  },
  /**
   * Top-level call to copy a question.
   * Done by converting to JSON and re-parsing.
   * @param {Question} question
   * @returns {Question}
   */
  copy_question: function (question) {
    return new Question(question.toJSON());
  },
  /**
   * Top-level call to add a question to a block.
   * @param {Question} question The question we want to add.
   * @param {Block} block The block we want to add the question to.
   * @param {?Survey} survey The survey that contains the question and the block
   * @param {boolean } mutate Boolean indicating whether we should mutate the survey or return
   * a new survey.
   * @returns {?Survey}
   */
  add_question: function (question, block, survey = null, mutate = true) {
    if (mutate) {
      block.add_question(question);
      return null;
    } else {
      let s = this.copy_survey(survey);
      // Get the block in our new survey that matches the input block's id.
      let block_id_array = block.idArray;
      let current_block_list = s.topLevelBlocks;
      // Iterate through the block id array to find the match at the appropriate depth.
      for (let i = 0; i < block_id_array.length; i++) {
        // Iterate through the blocks at the current depth to find the match at this level.
        for (var [,b] of current_block_list) {
          if (b.idArray[i] === block_id_array[i]) {
            // When we find the match, update the current block list to point to the new block's
            // subblocks.
            current_block_list = b.subblocks;
            // Break out of the inner loop, since we will have updated the current block list.
            break;
          }
        }
      }
      console.assert(b.id === block.id, 'If we have found the correct block, their ids will be equal.');
      b.add_question(question);
      return s;
    }
  },
  /**
   * Removes the question from the provided survey.
   * @param {Question} question The question to remove.
   * @param {Survey} survey The survey to remove the question from.
   * @param {?Block} block The block the question belongs to.
   * @param {boolean} mutate Flag inidicating whether we should mutate the
   * survey or return a new one.
   * @returns {?Survey}
   */
  remove_question: function(question, survey, block = null, mutate = true) {
    if (mutate) {
      survey.remove_question(question, block, survey);
      return null;
    } else {
      let s = this.copy_survey(survey);
      s.remove_question(question);
      return s;
    }
  },
  /**
   * Top-level call to create a new Option.
   * @param {string} surface_text The text to be displayed to the user.
   * @param {string} oid The option id.
   * @returns {Option}
   */
  new_option: function (surface_text, oid = _gensym("option")) {
    return new Option({
      id: oid,
      otext: surface_text
    });
  },
  /**
   * Top-level call to add an option to a question.
   * @param {Question} question The question to add the option to.
   * @param {Option} option The option to add to the input question.
   * @param {Survey} survey The survey that this question belongs to.
   * @param {boolean} mutate Flag indicating whether we should mutate the survey
   * provided, or return a new survey.
   * @returns {?Survey}
   */
  add_option: function (question, option, survey, mutate = true) {
    if (mutate) {
      question.add_option(option);
      return null;
    } else {
      let s = this.copy_survey(survey);
      let q = s.questions.find(q => q.id === question.id);
      q.add_option(option);
      return s;
    }
  },
  /**
   * Removes the option from the provided survey
   * @param {Option} option The option to remove.
   * @param {Survey} survey The survey to remove the option from.
   * @param {?Question} question The question to remove the option from.
   * @param {boolean} mutate Flag indicating whether the survey should be
   * mutated or if a new survey should be returned.
   * @returns {?Survey}
   */
  remove_option: function(option, survey, question = null, mutate = true) {
    if (mutate) {
      survey.remove_option(option, question, survey);
      return null;
    } else {
      let s = this.copy_survey(survey);
      s.remove_option(option);
      return s;
    }
  }
};
