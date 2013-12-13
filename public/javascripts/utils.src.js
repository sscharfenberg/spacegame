/* *********************************************************************************************************************
* GAME.JS
* contains generic Functions needed for the game
* (c) 2013 Sven Scharfenberg | sven.scharfenberg@projektvier.de
***********************************************************************************************************************/
//
// setup namespace =====================================================================================================
window.utils = window.utils || {

    DEBUG: true,
    VERBOSE: false,

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
    }, // ==============================================================================================================


    // get the correct standings color =================================================================================
    getStandingsColor: function (standings) {
        switch (standings) {
            case 99     : return "#90c"; // player (standings to self = 99)
            case 10     : return "#09f"; // military alliance (blue)
            case 5      : return "#090"; // economic partner (green)
            case -5     : return "#cc3"; // unfriendly (yellow)
            case -10    : return "#f00"; // hostile (red)
            default     : return "#ccc"; // neutral (0 / grey)
        }
    } // ===============================================================================================================

};

utils.init();
