/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 580:
/***/ ((module) => {

module.exports = eval("require")("@actions/core");


/***/ }),

/***/ 896:
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),

/***/ 965:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

/* module decorator */ module = __nccwpck_require__.nmd(module);
const core = __nccwpck_require__(580);
const fs = __nccwpck_require__(896);

async function revokeToken() {
  try {
    // Read token from GitHub State
    githubEphemeralToken = process.env.STATE_EPHEMERAL_TOKEN;

    if (!githubEphemeralToken) {
      core.info('No GitHub ephemeral token found in inputs, skipping revoke.');
      return;
    }

    const githubRevokeUrl = `https://api.github.com/installation/token`;
    const response = await fetch(githubRevokeUrl, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${githubEphemeralToken}`,
            Accept: 'application/vnd.github+json'
        }
    });
    if (!response.ok) {
        const errorData = await response.json();
        core.warning(`Failed to revoke GitHub token: ${JSON.stringify(errorData)}`);
        return;
    }
    core.info('Successfully revoked GitHub ephemeral token.');
  } catch (err) {
    core.warning(`Post action error: ${err.message}`);
  }
}

module.exports = { revokeToken };

if (__nccwpck_require__.c[__nccwpck_require__.s] === module) {
  revokeToken();
}


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
/******/ 			id: moduleId,
/******/ 			loaded: false,
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
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the module cache
/******/ 	__nccwpck_require__.c = __webpack_module_cache__;
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/node module decorator */
/******/ 	(() => {
/******/ 		__nccwpck_require__.nmd = (module) => {
/******/ 			module.paths = [];
/******/ 			if (!module.children) module.children = [];
/******/ 			return module;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// module cache are used so entry inlining is disabled
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	var __webpack_exports__ = __nccwpck_require__(__nccwpck_require__.s = 965);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
