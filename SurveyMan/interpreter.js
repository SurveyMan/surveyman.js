var SurveyMan = SurveyMan || {};

SurveyMan.interpreter = (function () {

    var questionSTACK       =   [],
        blockSTACK          =   [],
        branchDest          =   null;


    var getAllBlockQuestions = function (_block) {
            // Either one question is a branch or all are "branch", and they're always out of the top level block.
            // Put the current block's questions in a global stack that we can empty
            if (_block.isBranchAll())
                return _.shuffle(_block.topLevelQuestions)[0];

            var i = 0, j = 0, k = 0,
                retval = [],
                indices = _.range(_block.topLevelQuestions.length + _block.subblocks.length),
                qindices = _.sample(indices, _block.topLevelQuestions.length),
                bindices = _.difference(indices, qindices);

            for ( ; i < indices.length ; i++ ) {
                // it happens that i == indices[i]
                if (_.contains(qindices, i)) {
                    retval.push(_block.topLevelQuestions[j]);
                    j++;
                } else if (_.contains(bindices, i)) {
                    retval.push(getAllBlockQuestions(_block.subblocks[k]));
                    k++;
                } else throw "Neither qindices nor bindices contain index " + i;
            }

            return _.flatten(retval);
        },
        initializeStacks = function(_blist) {

            var topBlock;
            blockSTACK = _blist;
            topBlock = blockSTACK.shift();

            questionSTACK = getAllBlockQuestions(topBlock);


        },
        loadQuestions = function(_qList) {

            questionSTACK = _qList;

        },
        isQuestionStackEmpty = function () {

            return questionSTACK.length === 0;

        },
        isBlockStackEmpty = function() {

            return blockSTACK.length === 0;

        },
        nextQuestion = function() {

            return questionSTACK.shift();

        },
        nextBlock =  function() {

                    var head, b;

                    if (branchDest) {
                        while (!isBlockStackEmpty()) {
                            head = blockSTACK.shift();
                            if ( head === branchDest ) {
                                blockSTACK.unshift(head);
                                branchDest = null;
                                break;
                            } else if ( head.randomizable ) {
                                blockSTACK.unshift(head);
                                break;
                            }
                        }
                    }

                    console.assert( isQuestionStackEmpty() );

                    b = blockSTACK.shift();

                    loadQuestions(getAllBlockQuestions(b));

                    return head;

        };

    return {
        init                    :   function (jsonSurvey) {

                                        var survey = SurveyMan.survey.init(jsonSurvey);
                                        initializeStacks(survey.topLevelBlocks);
                                        return survey;

                                    },
        isQuestionStackEmpty    :   isQuestionStackEmpty,
        isBlockStackEmpty       :   isBlockStackEmpty,
        nextBlock               :   nextBlock,
        nextQuestion            :   nextQuestion,
        handleBranching         :   function (q, o){

                                        if (q.branchMap[o.id])
                                            branchDest = q.branchMap[o.id];
                                        if ( isQuestionStackEmpty() )
                                            nextBlock();
                                        return nextQuestion();

                                    },
        nextSequential          :   function () {

                                        if ( isQuestionStackEmpty() )
                                            nextBlock();
                                        return nextQuestion();

                                    }
    };

})();
