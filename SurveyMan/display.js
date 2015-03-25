var SurveyMan = SurveyMan || {};

if (!_) {
    _ = require("underscore");
}
if (!$) {
    $ = require("jquery");
}

SurveyMan.display = (function () {

    document.cookies = "test=EMMA_COOKIE_TEST";

    var questionsChosen     =   [],
        dropdownThreshold   =   7,
        id                  =   0,
        DUMMY_ID            =   "dummy",
        SUBMIT_FINAL        =   "submit_final",
        SUBMIT_PREFIX       =   "submit_",
        NEXT_PREFIX         =   "next_",
        MTURK_FORM          =   "mturk_form";


    var hideNextButton = function (q) {

            $("#" + NEXT_PREFIX + q.id).remove();
            $("#" + SUBMIT_PREFIX + q.id).remove();
            $("#" + SUBMIT_FINAL).remove();

        },
        showNextButton = function (pid, q, o) {
            var id, nextHTML;
            id = NEXT_PREFIX + q.id;
            if ($("#" + id).length > 0)
                document.getElementById(id).onclick = function () { registerAnswerAndShowNextQuestion(pid, q, o); };
            else if ( ! finalSubmit() ) {
                nextHTML = document.createElement("input");
                nextHTML.id = id;
                nextHTML.type = "button";
                nextHTML.onclick = function () {
                    $("#"+q.id).hide();
                    registerAnswerAndShowNextQuestion(pid, q, o);
                };
                nextHTML.value = "Next";
                $("div[name=question]").append(nextHTML);
            }
            showSubmit(q,o);
        },
        getNextQuestion = function (q, o) {

            var nextQ;
            if (o && !_.isUndefined(q.branchMap)) {
                // returns a block
                nextQ = SurveyMan.interpreter.handleBranching(q, o);
            } else {
                // get the next sequential question
                //console.log("get next sequential question after " + q.id + "(" + q.qtext + ")" );
                nextQ = SurveyMan.interpreter.nextSequential();
            }
            return nextQ;

        },
        showQuestion =  function(q) {

            $(".question").empty();
            $(".question").append(q.qtext);
            $(".question").attr({ name : q.id });

        },
        getNextID = function() {

            id += 1;
            return "ans"+id;

        },
        testFreetext = function (freetext, text) {
            var matches = freetext.exec(text);
            return _.contains(matches, text);
        },
        setReturnValueForFreetext = function (q,o,qpos) {

            var retval = {"quid" : q.id, "oid" : "comp_-1_-1", "qpos" : qpos, "opos" : -1, "text" : o.value};
            o.value = JSON.stringify(retval);

        },
        getOptionHTML = function (q) {

            // would like to replace text area, select, etc. with JS objects
            var opt, i, elt, dummy,
                qpos    =   questionsChosen.length,
                pid     =   getNextID(),
                par     =   document.createElement("p");

            par.id = pid;
            $(par).attr({ name : q.id});

            if ( q.freetext ) {

                elt = document.createElement("textarea");
                elt.id = q.id;
                elt.type = "text";
                elt.oninput = function () {
                    var response = document.getElementById(elt.id);
                    if ( q.freetext instanceof RegExp ) {
                        var inputText = response.value;
                        if ( testFreetext(q.freetext, inputText) )
                            showNextButton(pid, q, response, qpos);
                    } else showNextButton(pid, q, response, qpos);
                };
                elt.name  = q.id;
                if (q.freetext instanceof String)
                    elt.placeholder = q.freetext;
                elt.form = MTURK_FORM;
                $(par).append(elt);

            } else if ( _.isUndefined(q.options) || q.options.length == 0 ) {

                dummy = getDummyOpt(q);

                if ( ! finalSubmit() )
                    showNextButton(pid, q, dummy);
                showSubmit(q, dummy);

            } else if ( q.options.length > dropdownThreshold && q.exclusive ) {

                elt = document.createElement("select");
                elt.id = "select_" + q.id;
                elt.onchange = function () {
                    var thing = getDropdownOpt(q);
                    if (_.isUndefined(thing))
                        hideNextButton(q);
                    else showNextButton(pid, q, thing);
                };
                $(elt).attr({ name : q.id, form : MTURK_FORM});
                if (!q.exclusive) {
                    $(elt).prop("multiple", true);
                }

                dummy = document.createElement('option');
                dummy.id = DUMMY_ID;
                dummy.text = "CHOOSE ONE";
                $(dummy).attr({disable : true, selected : true});
                $(dummy).attr({onselect : function () { hideNextButton(q); }});
                elt.options[elt.options.length] = dummy;

                for ( i = 0 ; i < q.options.length ; i++ ) {
                    opt = q.options[i];
                    elt.add(makeDropDown(pid, q, opt, qpos, i));
                }

                $(par).append(elt);

            } else {

                for ( i = 0 ; i < q.options.length ; i++) {

                    if (q.options.length === 1 && q.options[0].otext === "null") {
                        // no options; just display next
                        showNextButton(null, q, null);
                        return "";
                    }

                    opt = q.options[i];
                    elt = document.createElement("label");
                    $(elt).attr("for", opt.oid);
                    $(elt).append(makeRadioOrCheck(pid, q, opt, qpos, i));
                    $(elt).append(opt.otext);
                    $(par).append(elt);

                }
            }
            return par;
        },
        showOptions = function(q) {
            $(".answer").empty();
            var opts = getOptionHTML(q);
            $(".answer").append(opts);
            if (finalSubmit() && submitNotYetShown() && q.options.length===0)
                showSubmit(q,true);
        },
        registerAnswerAndShowNextQuestion = function (pid, q, o) {
            // if we're coming from an instructional question, just skip registering
            if (o) {
                $("form").append($("#"+pid));
                $("#"+pid).hide();
            }

            if (q.freetext) {
                setReturnValueForFreetext(q, o);
            }

            questionsChosen.push(q);
            $("#" + NEXT_PREFIX + q.id).remove();
            $("#" + SUBMIT_PREFIX + q.id).remove();
            q = getNextQuestion(q, o);
            showQuestion(q);
            showOptions(q);
        },
        makeDropDown = function (pid, q, opt, qpos, opos) {

            var ojson  =   {"quid" : q.id, "oid" : opt.id, "qpos" : qpos, "opos" : opos},
                o       =   document.createElement("option");

            o.text = opt.otext;
            o.value = JSON.stringify(ojson);
            o.id = opt.id;

            return o;

        },
        makeRadioOrCheck = function (pid, q, opt, qpos, opos) {

            var ojson  =   {"quid" : q.id, "oid" : opt.id, "qpos" : qpos, "opos" : opos},
                o      =   document.createElement("input");

            o.type = q.exclusive ? "radio" : "checkbox";
            o.id = opt.id;
            o.onchange = function () {
                if (o.type==="checkbox") {
                    var toSelect = "[name=" + q.id + "] :checked";
                    if ($(toSelect).length === 0) {
                        hideNextButton(q);
                        return;
                    }
                }
                showNextButton(pid, q, opt);
            };
            o.name = q.id;
            o.value = JSON.stringify(ojson);
            o.form = MTURK_FORM;

            return o;

        },
        getDummyOpt = function(q) {

            return new Option({"id" : "comp_-1_-1", "otext" : ""}, q)

        },
        finalSubmit = function () {

            return SurveyMan.interpreter.isQuestionStackEmpty() && SurveyMan.interpreter.isBlockStackEmpty();

        },
        showEarlySubmit = function (q) {

            return q.breakoff && q.options.length!=0;

        },
        showBreakoffNotice  = function() {

            $(".question").append("<p>This survey will allow you to submit partial responses. The minimum payment is the quantity listed. However, you will be compensated more for completing more of the survey in the form of bonuses, at the completion of this study. The quantity paid depends on the results returned so far. Note that submitting partial results does not guarantee payment.</p>");
            $("div[name=question]").show();
            $(".question").append("<input type=\"button\" id=\"continue\" value=\"Continue\" " +
                "onclick=\"SurveyMan.display.showFirstQuestion();\" />");
        },
        showFirstQuestion = function() {

            var firstQ = SurveyMan.interpreter.nextQuestion();
            showQuestion(firstQ);
            showOptions(firstQ);

        },
        freetextValid = function(q,o) {

            if (_.isUndefined(q.freetext) || !q.freetext) {
                return true;
            } else if (q.freetext instanceof String) {
                return true;
            } else if ((q.freetext instanceof Boolean || typeof(q.freetext)==="boolean") && q.freetext){
                return o.value!="";
            } else if (q.freetext instanceof RegExp) {
                return testFreetext(q.freetext,o.value);
            } else throw "Unknown type of freetext: " + typeof(q.freetext);

        },
        showSubmit = function(q,o) {

            var submitHTML;
            if (submitNotYetShown()) {
                submitHTML = document.createElement("input");
                submitHTML.type = "submit";
                submitHTML.onclick = function () {
                    if (q.freetext) {
                        $("#"+q.id).hide();
                        setReturnValueForFreetext(q, o);
                    }
                };
                if ( finalSubmit() && freetextValid(q,o) ) {
                    submitHTML.defaultValue = "Submit";
                    submitHTML.id = SUBMIT_FINAL;
                } else if ( (showEarlySubmit(q) && o) || freetextValid(q,o) ) {
                    submitHTML.defaultValue = "Submit Early";
                    submitHTML.classList.add("breakoff");
                    submitHTML.id = SUBMIT_PREFIX + q.id;
                } else return;
                $("div[name=question]").append(submitHTML);

            }
        },
        submitNotYetShown = function () {

            var submits = $(":submit");
            return submits.length === 0;

        },
        getDropdownOpt = function(q) {

            var dropdownOpt =   $("#select_" + q.id + " option:selected"),
                oid         =   dropdownOpt.attr("id");
            if (oid===DUMMY_ID) return;
            return SurveyMan.survey.getOptionById(oid);

        };

    return {
        hideNextButton : hideNextButton,
        showNextButton : showNextButton,
        getNextQuestion : getNextQuestion,
        showQuestion : showQuestion,
        getOptionHTML : getOptionHTML,
        showOptions : showOptions,
        registerAnswerAndShowNextQuestion : registerAnswerAndShowNextQuestion,
        showBreakoffNotice : showBreakoffNotice,
        showFirstQuestion : showFirstQuestion,
        showSubmit : showSubmit,
        ready : function (mturk, jsonizedSurvey, loadPreview, customInit) {
            //  Previewing for now is unique to mturk.
            $(document).ready(function() {

                assignmentId = mturk ? "ASSIGNMENT_ID_NOT_AVAILABLE" : document.getElementById('assignmentId').value;

                $('form').submit(function() {
                    window.onbeforeunload = null;
                });

                var preview = $("#preview");
                if (assignmentId=="ASSIGNMENT_ID_NOT_AVAILABLE" && typeof(loadPreview) === "function") {
                    preview.onload = loadPreview;
                    preview.show();
                } else {
                    preview.hide();
                    Math.seedrandom(assignmentId);
                    var sm = SurveyMan.interpreter.init(jsonizedSurvey);
                    if (sm.breakoff)
                        showBreakoffNotice();
                    else showFirstQuestion();
                }
                if (typeof(customInit) === "function") {
                    customInit();
                }
            });
        }
    };

})();
