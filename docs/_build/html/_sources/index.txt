.. surveyman.js documentation master file, created by
   sphinx-quickstart on Mon Aug 11 12:16:06 2014.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

.. toctree::
   :maxdepth: 2


Overview
========================================

The surveyman.js repository contains three modules. Together these three modules form the SurveyMan runtime system, contained in the SurveyMan namespace. This runtime system receives a JSON representation of a survey and executes that survey (with the help of a human!) in a browser. These three modules are meant to be used with the SurveyMan server and static analyzer. 

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

   :param jsonSurvey: A JSON representation of the survey, as defined by the JSON schema 

interpreter.js
========================================

display.js
========================================


Indices and tables
==================

* :ref:`genindex`
* :ref:`modindex`
* :ref:`search`

