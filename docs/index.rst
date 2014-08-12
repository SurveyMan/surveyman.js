.. surveyman.js documentation master file, created by
   sphinx-quickstart on Mon Aug 11 12:16:06 2014.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

Overview
========================================
The surveyman.js repository contains three modules. Together these three modules form the SurveyMan runtime system, contained in the SurveyMan namespace. This runtime system receives a JSON representation of a survey and executes that survey (with the help of a human!) in a browser. These three modules are meant to be used with the SurveyMan server and static analyzer. 

Currently this code expects to be executed inside http://github.com/SurveyMan/SurveyMan/src/main/resources/HTMLSkeleton.html. 

Install 
========================================
* TODO: npm 
* TODO: cdn hosted

**Dependencies**

* underscore

* jQuery

* seedrandom


surveyman.js
========================================

surveyman.js contains the internal Javascript representation of a survey. It is simlar to the Java representation contained in http://github.com/SurveyMan/SurveyMan. The internal representation is not visible to the user.

.. js:function:: SurveyMan.survey.init(jsonSurvey)

   :param jsonSurvey: A JSON representation of the survey, as defined by the JSON schema http://github.com/SurveyMan/SurveyMan/src/main/resources/schemata
   :returns: A Javascript Survey object

.. js:function:: SurveyMan.survey.getOptionById(oid)

   :param string oid: String representation of an option id
   :returns: A Javascript Survey Option object

.. js:function:: SurveyMan.survey.getQuestionById(quid)

   :param string quid: String representation of a question id
   :returns: A Javascript Question object

.. js:function:: SurveyMan.survey.getBlockById(bid)

   :param string bid: String representation of a Block id
   :returns: A Javascript Block object



interpreter.js
========================================

interpreter.js executes the survey. It is initialized with a Survey object and updates the state of the interpreter in response to requests for more questions. 

Under the current implmentation, the interpreter does not contain the answer set; this is held in the HTML.

.. js:function:: SurveyMan.interpreter.init(jsonSurvey)
 
   Initilizes survey and the interpreter's stacks.

   :param jsonSurvey: A JSON representation of the survey, as defined by the JSON schema http://github.com/SurveyMan/SurveyMan/src/main/resources/schemata

.. js:function:: SurveyMan.interpreter.isQuestionStackEmpty()

   :returns boolean:

.. js:function:: SurveyMan.interpreter.isBlockStackEmpty()

   :returns boolean:

.. js:function:: SurveyMan.interpreter.nextBlock()

   :returns: A Block object

.. js:function:: SurveyMan.interpreter.nextQuestion()

   :returns: A Question object

.. js:function:: SurveyMan.interpreter.handleBranching(q, o)

   :param q: A Question object 
   :param o: An Option object
   :returns: The next Question object

.. js:function:: SurveyMan.interpreter.nextSequential()

   :returns: The next Question object



display.js
========================================

This is the module that controls all of the display logic. The visible methods can be overridden in `~/surveyman/custom.js` to do things like inject timing information.


** Button Functionality**

"Next" buttons will start out hidden. When the respondent selects an answer, they appear. For a single question, its "Next" button can only be hidden again if the question is a checkbox question and the respondent unchecks all boxes.

"Submit Early" will appear alongside "Next" if the survey permits breakoff. When the respondent answers the final question, only a button reading "Submit" will appear.

`showNextButton` and `getOptionHTML` call `showSubmit`. We include `showSubmit` here in case the survey author wishes to override some behavior.

.. js:function:: SurveyMan.display.hideNextButton(q)
   
   :param q: A Question object
   
.. js:function:: SurveyMan.display.showNextButton(pid, q, o)

   :param string pid: The id of the div containing this question. Answered questions are pushed onto a hidden HTML "stack". 
   :param q: The Question object that's just been answered.
   :param o: The Option object that is the answer to that question.

.. js:function:: SurveyMan.display.showSubmit(q, o)
   
   :param q: The current Question object.
   :param o: The answered Option object.

.. js:function:: SurveyMan.display.getNextQuestion(q, o)

   :param q: The Question just answered
   :param o: The Option that is the answer
   :returns: The next Question object


.. js:function:: SurveyMan.display.showQuestion(q)

   :param q: The Question object being shown.

.. js:function:: SurveyMan.display.getOptionHTML(q)

   :param q: The Question object being shown.
   :returns: Javascript representation of HTML elements containing Option data. If the Option data is a display, then the "Next" button is shown.

.. js:function:: SurveyMan.display.showOptions(q)

  :param q: The Question object whose options are being shown.

.. js:function:: SurveyMan.display.registerAnswerAndShowNextQuestion(pid, q, o)

   :param string pid: The id of the div containing this question. Answered questions are pushed onto a hidden HTML "stack". 
   :param q: The Question object that's just been answered.
   :param o: The Option object that is the answer to that question.

.. js:function:: SurveyMan.display.showBreakoffNotice()

   Displays a predefined breakoffo notice. This can be changed in `~/surveyman/custom.js`.

.. js:function:: SurveyMan.display.showFirstQuestion

   Displays the first question. Is called first if there is not breakoff.

.. js:function:: SurveyMan.display.ready(jsonizedSurvey, customInit)

   :param jsonSurvey: A JSON representation of the survey, as defined by the JSON schema http://github.com/SurveyMan/SurveyMan/src/main/resources/schemata
   :param customInit: The custom Javascript contained in `~/surveyman/custom.js`. This will be included in the HTML if the SurveyMan Java backend is used.




.. toctree::
   :maxdepth: 2


Indices and tables
==================

* :ref:`genindex`
* :ref:`search`

