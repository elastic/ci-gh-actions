/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 317:
/***/ ((module) => {

"use strict";
module.exports = require("child_process");

/***/ }),

/***/ 896:
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),

/***/ 857:
/***/ ((module) => {

"use strict";
module.exports = require("os");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/
/************************************************************************/
var __webpack_exports__ = {};
// Ref: https://github.com/pyTooling/Actions/blob/main/with-post-step/main.js
const { spawn } = __nccwpck_require__(317);
const { appendFileSync } = __nccwpck_require__(896);
const { EOL } = __nccwpck_require__(857);

function run(cmd) {
  const subprocess = spawn(cmd, {
    stdio: "inherit",
    shell: true,
    env: {
        ...process.env
    }
    });
  subprocess.on("exit", (exitCode) => {
    process.exitCode = exitCode;
  });
}

const key = process.env.INPUT_KEY.toUpperCase();

if ( process.env[`STATE_${key}`] !== undefined ) { // Are we in the 'post' step?
  run(process.env.INPUT_POST);
} else { // Otherwise, this is the main step
  appendFileSync(process.env.GITHUB_STATE, `${key}=true${EOL}`);
  run(process.env.INPUT_MAIN);
}

module.exports = __webpack_exports__;
/******/ })()
;
