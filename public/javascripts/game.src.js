/* *********************************************************************************************************************
* GAME.JS
* contains generic Functions needed for the game
* (c) 2013 Sven Scharfenberg | sven.scharfenberg@projektvier.de
***********************************************************************************************************************/
//
// setup namespace =====================================================================================================
window.game = window.game || {

    DEBUG: true,

    init: function () {

    },

    // Default Log Message used for debugging ==========================================================================
    // msg = the message that is printed in the console
    // object = 0 by default if no variable or object needs to be printed to console
    // otherwise, object is printed to console
    log: function(msg,object) {
        if ( (game.DEBUG) && (window.console.log) && (window.console.warn) && (window.console.error) ) {
            console.warn("DEBUG: " +msg);
            if ( (object) && (object !== 0) ) {
                console.log(object);
            } else if (object !== 0) {
                console.error(object);
            }
        }
    }

};

game.init();
