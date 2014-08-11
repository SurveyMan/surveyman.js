var SurveyMan = SurveyMan || {};

SurveyMan.interpreter = (function () {

    var questionSTACK       =   [],
        blockSTACK          =   [],
        branchDest          =   null;

    var initializeStacks = function(_blist) {

            var topBlock;
            blockSTACK = _blist;
            topBlock = blockSTACK.shift();
            questionSTACK = topBlock.getAllBlockQuestions();

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
                    loadQuestions(b.getAllBlockQuestions());
                    return head;

        };

    return {
        init                    :   function () {
                                        return function (jsonSurvey) {

                                            var survey = SurveyMan.survey.init(jsonSurvey);
                                            initializeStacks(survey.topLevelBlocks);

                                        };
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