/* *********************************************************************************************************************
* GAME.JS
* contains generic Functions needed for the game
* (c) 2013 Sven Scharfenberg | sven.scharfenberg@projektvier.de
***********************************************************************************************************************/
//
// setup namespace =====================================================================================================
window.utils = window.utils || {

    DEBUG: true,

    init: function () {

    },

    // Default Log Message used for debugging ==========================================================================
    // msg = the message that is printed in the console
    log: function(msg, object) {
        // if object exists, log object on seperate line
        if ( (utils.DEBUG) && (window.console.log) && (object) ) {
            console.warn("DEBUG: " +msg);
            console.log(object);
        }
        // if object does not exist, everything on one line
        if ( (utils.DEBUG) && (window.console.log) && (!object) ) {
            console.log("DEBUG: " + msg);
        }
    }

};

utils.init();
