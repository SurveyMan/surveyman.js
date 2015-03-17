[![Build Status](https://travis-ci.org/SurveyMan/surveyman.js.png?branch=master)](https://travis-ci.org/SurveyMan/surveyman.js)

Overview
========
surveyman.js is the browser runtime for the SurveyMan project. It is currently still tightly coupled with the jsonzied Survey from
[SurveyMan](https://github.com/SurveyMan/SurveyMan) and the HTML produced by the [Runner](https://github.com/SurveyMan/Runner).
See [the docs](http://surveyman.github.io/surveyman.js) for how these modules are used.

Usage
=====
surveyman.js is not a SurveyMan UI. It implements a Javascript version of a subset of SurveyMan functionality. To see
how this respository is used, clone the [Runner](https://github.com/SurveyMan/Runner) repository and try running an
example survey locally. This will produce some HTML in `logs/<surveyid>_<your_survey_file_name>_<timestamp>.html`. This
HTML includes the jsonized survey and references to the contents of this repository. Click through the survey to see
how it is executed.

To investigate this code locally, try running the following in node:

```
var globals = require("tests/globals.js");
var survey  = SurveyMan.survey.init(globals['wage_survey']);
```


Contributing
============
surveyman.js used to live with all the other SurveyMan code in the SurveyMan main repository. It has since been split
out into its own repository. Testing was previously done in Clojure using Selenium.