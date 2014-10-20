//  surveyman.js 1.5.1
//  http://surveyman.github.io/surveyman.js
//  (c) 2014 University of Massachusetts Amherst
//  surveyman.js is released under the CRAPL.

SurveyMan = (function () {
        try {
            return _.isUndefined(SurveyMan) ? {} : SurveyMan;
        } catch (err) {
            return {};
        }
    })();

SurveyMan.survey = (function () {

    var _ = require("underscore");

    // Internal maps from string ids to objects
    // --------------
    var         blockMAP            =   {},
                optionMAP           =   {},
                questionMAP         =   {};

    // Top-level auxiliary functions
    // --------------
    var parseBools = function (thing, defaultVal) {

            if (_.isUndefined(thing)) {
                return defaultVal;
            } else if (typeof thing === "string") {
                try {
                    return JSON.parse(thing);
                } catch (err) {
                    return thing;
                }
            } else if (typeof thing === "boolean") {
                return thing;
            } else throw "Unknown type for " + thing + " (" + typeof thing + ")";

        },
        getOptionById = function (oid) {

            if (_.has(optionMAP, oid))
                return optionMAP[oid];
            else throw "Option id " + oid + " not found in optionMAP";

        },
        getQuestionById = function (quid) {

            if (_.has(questionMAP, quid))
                return questionMAP[quid];
            else throw "Question id " + quid + " not found in questionMAP";

        },
        getBlockById = function (bid) {

            if (bid===null)
                return null;
            if (_.has(blockMAP, bid))
                return blockMAP[bid];
            else throw "Block id " + bid + " not found in blockMAP";

        };

    // Survey Objects
    // --------------

    var Option = function(_jsonOption, _question) {

            optionMAP[_jsonOption.id] = this;

            this.id = _jsonOption.id;
            this.otext = _jsonOption.otext;
            this.question = _question;

        },
        Block = function(_jsonBlock) {
                    //  get the total number of "slots" and assign indices

            blockMAP[_jsonBlock.id] = this;

            var idStringToArray = function (_idString) {
                return _.map(_idString.split("."), function(s) { parseInt(s); });
            };

            this.id = _jsonBlock.id;
            this.idArray = idStringToArray(_jsonBlock.id);
            this.topLevelQuestions = Question.makeQuestions(_jsonBlock.questions, this);
            this.subblocks = [];
            // may need to call a to boolean on jsonBlock.randomize
            this.randomizable = parseBools(_jsonBlock.randomize);

            this.isBranchAll = function () {

                var i, q, dests;

                if ( this.topLevelQuestions.length === 0 )
                    return false;

                for ( i = 0 ; i < this.topLevelQuestions.length ; i++ ) {

                    q = this.topLevelQuestions[i];
                    if (q.branchMap) {
                        dests = _.values(q.branchMap);
                        if (! ( _.compact(dests).length === 0 ) ) {
                            return false;
                        }
                    } else return false;
                }

                return true;
            };

            this.getAllBlockQuestions = function () {
                // Either one question is a branch or all are "branch", and they're always out of the top level block.
                // Put the current block's questions in a global stack that we can empty
                if (this.isBranchAll())
                    return _.shuffle(this.topLevelQuestions)[0];

                var i = 0, j = 0, k = 0,
                    retval = [],
                    indices = _.range(this.topLevelQuestions.length + this.subblocks.length),
                    qindices = _.sample(indices, this.topLevelQuestions.length),
                    bindices = _.difference(indices, qindices);

                for ( ; i < indices.length ; i++ ) {
                    // it happens that i == indices[i]
                    if (_.contains(qindices, i)) {
                        retval.push(this.topLevelQuestions[j]);
                        j++;
                    } else if (_.contains(bindices, i)) {
                        retval.push(this.subblocks[k].getAllBlockQuestions());
                        k++;
                    } else throw "Neither qindices nor bindices contain index " + i;
                }

                return _.flatten(retval);
            };

            this.getQuestion = function(quid) {

                var i;
                for ( i = 0 ; i < this.topLevelQuestions.length ; i++ ) {
                    if ( this.topLevelQuestions[i].id == quid ) {
                        return this.topLevelQuestions[i];
                    }
                }
                throw "Question with id " + quid + " not found in block " + this.id;
            };

            this.idComp = function(that) {
                // Returns whether that follows (+1), precedes (-1), or is a sub-block (0) of this
                for ( var i = 0 ; i < this.idArray.length ; i++ ) {
                    if ( i < that.idArray.length ) {
                        if ( this.idArray[i] < that.idArray[i] ) {
                            return -1;
                        } else if ( this.idArray[i] > that.idArray[i] ) {
                            return 1;
                        } else continue;
                    } else return 0;
                }
            };

            this.randomize = function () {

                var i, j, newSBlocks = _.map(_.range(this.subblocks.length), function (foo) { return -1; });

                // Randomize questions
                this.topLevelQuestions = _.shuffle(this.topLevelQuestions);

                // Randomize options
                for (i = 0 ; i < this.topLevelQuestions.length ; i++ ) {
                    this.topLevelQuestions[i].randomize();
                }

                if ( newSBlocks.length === 0 )
                    return;

                // Randomize blocks
                var stationaryBlocks = _.filter(this.subblocks, function (b) { return ! b.randomizable; }),
                    nonStationaryBlocks = _.filter(this.subblocks, function (b) { return b.randomizable; }),
                    samp = _.sample(_.range(this.subblocks.length), nonStationaryBlocks.length);

                nonStationaryBlocks = _.shuffle(nonStationaryBlocks);

                for ( i = 0 ; i < samp.length ; i++ ) {
                    // Pick the locations for where to put the non-stationary blocks
                    newSBlocks[samp[i]] = nonStationaryBlocks[i];
                }

                for ( i = 0, j = 0; i < newSBlocks.length ; i++ ) {
                    if ( newSBlocks[i] == -1 ) {
                        newSBlocks[i] = stationaryBlocks[j];
                        j++;
                    }
                }

                console.assert(j == stationaryBlocks.length);

                this.subblocks = newSBlocks;

                for ( i = 0 ; i < this.subblocks.length ; i++) {
                    this.subblocks[i].randomize();
                }

            };

            this.populate = function () {

                var i;

                if (_.isUndefined(_jsonBlock.subblocks)){
                    console.log("No subblocks in Block " + this.id);
                    return;
                }

                for ( i = 0 ; i < _jsonBlock.subblocks.length ; i++ ) {
                    var b = new Block(_jsonBlock.subblocks[i]);
                    b.parent = this;
                    this.subblocks.push(b);
                    b.populate();
                }

            };

            this.getFirstQuestion = function () {
                if (this.topLevelQuestions.length!=0)
                    return this.topLevelQuestions[0];
                if (this.subblocks.length === 0 )
                    throw "Malformed survey; empty block stack ending in " + this.id;
                return this.subblocks[0].getFirstQuestion();
            };

            // Assert that the sub-blocks have the appropriate ids
            console.assert(_.every(this.subblocks, function(b) { return this.idComp(b) === 0 }));

        },
        Question = function(_jsonQuestion, _block) {

            questionMAP[_jsonQuestion.id] = this;

            this.branchMap = {};

            this.makeBranchMap = function() {

                this.branchMap = function (_jsonBranchMap, _question) {

                    var i, bm = {};
                    // branchMap -> map from oid to bid
                    if (!_.isUndefined(_jsonBranchMap)) {
                        var keys = _.keys(_jsonBranchMap);
                        for ( i = 0 ; i < keys.length ; i++ ) {
                            //console.log(_question, keys[i]);
                            var o = _question.getOption(keys[i]),
                                b = getBlockById(_jsonBranchMap[keys[i]]);
                            bm[o.id] = b;
                        }
                        return bm;
                    }

                }(_jsonQuestion.branchMap, this);

            };

            this.setFreetext = function (_jsonQuestion) {

                var reRe    =   new RegExp("#\{.*\}"),
                    ft      =   _jsonQuestion.freetext;

                if ( ft == true ) {
                    return true;
                } else if ( reRe.exec(ft) ) {
                    return new RegExp(ft.substring(2, ft.length - 1));
                } else return new String(ft);

            };

            this.block = _block;
            this.id = _jsonQuestion.id;
            this.qtext = _jsonQuestion.qtext;
            this.freetext = parseBools(_jsonQuestion.freetext) ? this.setFreetext(_jsonQuestion) : Survey.freetextDefault;
            this.options = Option.makeOptions(_jsonQuestion.options, this);
            this.correlation = _jsonQuestion.correlation;

            this.getOption = function (oid) {

                var i;
                for ( i = 0 ; i < this.options.length ; i++ ) {
                    if ( this.options[i].id === oid ) {
                        return this.options[i];
                    }
                }
                throw "Option id " + oid + " not found in question " + this.id;

            };

            // FIELDS MUST BE SENT OVER AS STRINGS
            this.randomizable   =   parseBools(_jsonQuestion.randomize, Survey.randomizeDefault);
            this.ordered        =   parseBools(_jsonQuestion.ordered, Survey.orderedDefault);
            this.exclusive      =   parseBools(_jsonQuestion.exclusive, Survey.exclusiveDefault);
            this.breakoff       =   parseBools(_jsonQuestion.breakoff, Survey.breakoffDefault);

            this.randomize      =   function () {

                if (!this.randomizable)
                    return;

                if (this.ordered) {
                    if (Math.random() < 0.5) {
                        this.options = this.options.reverse();
                    }
                } else {
                    this.options = _.shuffle(this.options);
                }

            };

        },
        Survey = function (_jsonSurvey) {

            var i, q;

            var makeSurvey = function(_jsonSurvey) {

                var i, blockList = [];
                for ( i = 0 ; i < _jsonSurvey.length ; i++ ) {
                    blockList[i] = new Block(_jsonSurvey[i]);
                    blockList[i].populate();
                }
                return blockList;

            };

            this.filename = _jsonSurvey.filename;
            this.topLevelBlocks = makeSurvey(_jsonSurvey.survey);
            for (i = 0 ; i < _.keys(questionMAP).length ; i++){
                q = _.values(questionMAP)[i];
                q.makeBranchMap();
            }
            this.breakoff = parseBools(_jsonSurvey.breakoff);
            this.questions = _.values(questionMAP);

        };

    // "static" methods
    Survey.randomize        =   function (_survey) {

        var randomizableBlocks  =   _.shuffle(_.shuffle(_.filter(_survey.topLevelBlocks, function(_block) { return _block.randomizable; }))),
            normalBlocks        =   _.sortBy(_.filter(_survey.topLevelBlocks, function(_block) { return ! _block.randomizable }), function(_block) { return _block.id }),
            newTLBs             =   _.map(_.range(_survey.topLevelBlocks.length), function () { null }),
            indices             =   _.sortBy(_.sample(_.range(newTLBs.length), normalBlocks.length), function(n) { return n; }),
            i, j, k = 0;

        // Randomize new top level blocks as appropriate
        for ( j = 0 ; j < indices.length ; j++ ) {
            newTLBs[indices[j]] = normalBlocks[j];
        }

        for ( i = 0 ; i < newTLBs.length ; i++ ) {
            if (_.isUndefined(newTLBs[i])) {
                newTLBs[i] = randomizableBlocks[k];
                k++;
            }
        }

        // Reset top level blocks
        _survey.topLevelBlocks = newTLBs;

        for ( i = 0 ; i < _survey.topLevelBlocks.length ; i++ ) {
            // contents of the survey
            _survey.topLevelBlocks[i].randomize();
        }

    };

    Question.makeQuestions  =   function (jsonQuestions, enclosingBlock) {

        var i, qList = [];
        for ( i = 0 ; i < jsonQuestions.length ; i++ ) {
            var q = new Question(jsonQuestions[i], enclosingBlock);
            qList.push(q);
            questionMAP[q.id] = q;
        }
        return qList;

    };

    Option.makeOptions      =   function (jsonOptions, enclosingQuestion) {

        var i, oList = [];

        if (_.isUndefined(jsonOptions)) {
            var obj = _.keys(enclosingQuestion), str = "";
            for (i = 0 ; i < obj.length ; i++) {
                str += "\t" + obj[i] + ":" + enclosingQuestion[obj[i]] ;
            }
            console.log("No options defined for " + enclosingQuestion.id + " (" + str + ")");
            return;
        }

        for ( i = 0 ; i < jsonOptions.length ; i++ ){
            oList.push(new Option(jsonOptions[i], enclosingQuestion));
        }

        return oList;

    };

    // "static" fields
    Survey.exclusiveDefault =   true;
    Survey.orderedDefault   =   false;
    Survey.randomizeDefault =   true;
    Survey.freetextDefault  =   false;
    Survey.breakoffDefault  =   true;
    Block.randomizeDefault  =   false;

    return {
        init            :   function(jsonSurvey) {
                                var survey = new Survey(jsonSurvey);
                                Survey.randomize(survey);
                                return survey;
                            },
        getOptionById   :   getOptionById,
        getQuestionById :   getQuestionById,
        getBlockById    :   getBlockById,
        Survey          :   Survey,
        Block           :   Block,
        Question        :   Question,
        Option          :   Option
    };

})();