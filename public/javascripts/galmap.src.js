/* *********************************************************************************************************************
* GALMAP.JS
* contains Functions to draw the galactic map
* (c) 2013 Sven Scharfenberg | sven.scharfenberg@projektvier.de
***********************************************************************************************************************/
//
// setup namespace =====================================================================================================
window.galmap = window.galmap || {

    // important global vars ===========================================================================================
    prefs: {
        tilesize: 50 // this does not get overwritten
    },
    tilesize: 50, // size in pixels of a maptile. needed for pretty much everything.
    mapdata: null, // the object that will later contain the JSON data; needed to redraw the map.
    zoom: 1.0, // starting zoom level

    // Initialize ======================================================================================================
    init: function () {

        // required feature testing ------------------------------------------------------------------------------------
        // later, we can add polyfills here
        if ( (!Modernizr.canvas) || (!Modernizr.canvastext) ) {
            alert("Sorry, your browser does not support canvas or canvastext. Please update your browser");
            location.href = "http://www.google.de/intl/de/chrome/browser/";
        }

        // define local and global jquery objects ----------------------------------------------------------------------
        var $mapviewport = $("#mapViewPort");
        var $rulervertviewport = $("#viewPortRulerVert");

        // adjust height of map and vertical ruler to the same value as map width --------------------------------------
        // width has correct value from css, we can't do that with height
        // we need to assign the height twice because of a jQuery glitch (.width() outputs wrong value)
        $mapviewport.height($mapviewport.width()).height($mapviewport.width());
        $rulervertviewport.height($mapviewport.width());

        // load data from JSON -----------------------------------------------------------------------------------------
        // TODO: temporary value, needs to by dynamic for non-tests
        var mapdata = galmap.loadData("./mapdata.json");

        // and start drawing the map -----------------------------------------------------------------------------------
        mapdata.done(function (data) { // once the JSON promise is fulfilled, this function gets executed --------------
            game.log("Data recieved from JSON", data);
            galmap.mapdata = data; // save JSON data in global object
            galmap.drawMap(data);
            // now that the map is drawn, assign drag, focus and zoom events ---------------------------------------
            galmap.bindMapDragging();
            galmap.bindRulerDragging();
            galmap.bindFocusButton(".mapbutton.focushome", data.systems[data.home].x, data.systems[data.home].y);
            galmap.bindZoom();
            // everything done -------------------------------------------------------------------------------------
            $(".overlay.loading").hide();
            game.log("finished drawing map", 0);
        }).fail(function (error) {
            game.log("faled to recieve data from JSON",error);
            $(".overlay.jsonfail").show(); // show loading overlay
            galmap.bindRefreshButton();
        });

    }, // ==============================================================================================================

    // load JSON map data ==============================================================================================
    loadData: function (jsonURL) {

        $(".overlay.loading").show();
        return $.getJSON(jsonURL); // async JSON call; returning the promise \O/

    }, // ==============================================================================================================

    // Draw Map Main Function ==========================================================================================
    drawMap: function (map) {

        var $mapcanvas = $("#mapCanvas");
        // prepare canvas with correct width and height (html has 2000x2000) -------------------------------------------
        var mapSquarePixels = galmap.tilesize * map.settings.size;
        $mapcanvas.attr({ width: mapSquarePixels, height: mapSquarePixels });

        // clear stage (we need this for redrawing) --------------------------------------------------------------------
        $mapcanvas.clearCanvas({
            x: 0, y: 0,
            width: mapSquarePixels,
            height: mapSquarePixels
        }).removeLayers();

        // draw grid ---------------------------------------------------------------------------------------------------
        galmap.drawGrid(map.settings.size);

        // draw rulers with coordinates --------------------------------------------------------------------------------
        galmap.drawRulers(map.settings.size);

        // draw all wormholes from JSON --------------------------------------------------------------------------------
        game.log("Number of Wormholes", map.wormholes.length);
        map.wormholes.forEach(function (wormhole) {
            galmap.drawWormHole(
                wormhole.from, wormhole.to
            );
        });

        // draw all planets from JSON ----------------------------------------------------------------------------------
        game.log("Number of Systems", map.systems.length);
        map.systems.forEach(function(system){
            galmap.drawSystem(
                system.id
            );
        });

    }, // ==============================================================================================================


    // Draw a background grid to make coordinates more accessible ======================================================
    // we get the mapsize on function call and return it back after the grid has been drawn.
    drawGrid: function () {

        var $mapcanvas = $("#mapCanvas");
        var gridColor = "#1a1a1a";
        var posX1, posX2, posY1, posY2 = 0;

        for (var i = 0; i < (galmap.mapdata.settings.size-1); i++) {
            // draw a vertical line ------------------------------------------------------------------------------------
            posX1 = (galmap.tilesize * i) + galmap.tilesize;
            posX2 = (galmap.tilesize * i) + galmap.tilesize;
            posY1 = 0;
            posY2 = $mapcanvas.height();
            $mapcanvas.drawLine({
                layer: true, strokeStyle: gridColor, strokeWidth: 2, x1: posX1, y1: posY1, x2: posX2, y2: posY2
            });
            // draw a horizontal line ----------------------------------------------------------------------------------
            posX1 = 0;
            posX2 = $mapcanvas.width();
            posY1 = (galmap.tilesize * i) + galmap.tilesize;
            posY2 = (galmap.tilesize * i) + galmap.tilesize;
            $mapcanvas.drawLine({
                layer: true, strokeStyle: gridColor, strokeWidth: 2, x1: posX1, y1: posY1, x2: posX2, y2: posY2
            });
        }

        // draw a box around the stage ---------------------------------------------------------------------------------
        $mapcanvas.drawLine({
            layer: true,
            strokeStyle: gridColor,
            strokeWidth: 2,
            x1: 1, y1: 1, x2: $mapcanvas.width() - 1, y2: 1, x3: $mapcanvas.width() - 1, y3: $mapcanvas.height() - 1,
            x4: 1, y4: $mapcanvas.height() - 1, x5: 1, y5: 1
        });

        game.log("finished drawing grid", 0);

    }, // ==============================================================================================================

    // drawRulers: draw the horizontal and vertical rulers =============================================================
    drawRulers: function () {

        var $horzcanvas = $("#rulerHorzCanvas");
        var $vertcanvas = $("#rulerVertCanvas");
        var textColor = "#fff";
        var gridColor = "#1a1a1a";
        var posX, posY, posX1, posX2, posY1, posY2 = 0;
        var coordText = null;

        // prepare canvas with correct width and height (html has 2000) ------------------------------------------------
        var mapSquarePixels = galmap.tilesize * galmap.mapdata.settings.size;
        $horzcanvas.attr({ width: mapSquarePixels }); // attr instead of width() so we don't scale but enlarge
        $vertcanvas.attr({ height: mapSquarePixels });

        for (var i = 0; i < galmap.mapdata.settings.size; i++) {
            coordText = i.toString();
            // first, draw the horizontal ruler part -------------------------------------------------------------------
            posX = Math.round((galmap.tilesize * i) + (galmap.tilesize / 2)); // /2 because we want the text in the middle of the tile
            posY = 12; // height of ruler is 25, again try to get into the middle
            posX1 = (galmap.tilesize * i) + galmap.tilesize; // "border" to the right of the section
            posY1 = 0;
            posX2 = (galmap.tilesize * i) + galmap.tilesize;
            posY2 = $horzcanvas.height();
            $horzcanvas.drawText({
                fontSize: 12, fontFamily: "Arial",
                fillStyle: textColor, x: posX, y: posY, text: coordText
            }).drawLine({
                    strokeStyle: gridColor, strokeWidth: 2, x1: posX1, y1: posY1, x2: posX2, y2: posY2
                });
            // after that is done, draw the vertical ruler part --------------------------------------------------------
            posX = 12;
            posY = Math.round((galmap.tilesize * i) + (galmap.tilesize / 2)); // again, /2 because we want the middle
            posX1 = 0;
            posY1 = (galmap.tilesize* i) + galmap.tilesize; // border to the bottom of the section
            posX2 = $vertcanvas.width();
            posY2 = (galmap.tilesize * i) + galmap.tilesize;
            $vertcanvas.drawText({
                fontSize: 12, fontFamily: "Arial",
                fillStyle: textColor, x: posX, y: posY, text: coordText
            }).drawLine({
                    strokeStyle: gridColor, strokeWidth: 2, x1: posX1, y1: posY1, x2: posX2, y2: posY2
                });
        }

        // and the static lines that work as border for the rulers -----------------------------------------------------
        // 0 is needed because we want a centered 2px stroke => 1px visible in canvas
        // horizontal: we start at bottom right because the rightmost seperator was already drawn
        $horzcanvas.drawLine({
            strokeStyle: gridColor, strokeWidth: 2,
            x1: $horzcanvas.width(), y1: $horzcanvas.height(),
            x2: 0, y2: $horzcanvas.height(),
            x3: 0, y3: 0,
            x4: $horzcanvas.width(), y4: 0
        });
        // vertical: we start at bottom left because the bottommost seperator was already drawn
        $vertcanvas.drawLine({
            strokeStyle: gridColor, strokeWidth: 2,
            x1: 0, y1: $vertcanvas.height(),
            x2: 0, y2: 0,
            x3: $vertcanvas.width(), y3: 0,
            x4: $vertcanvas.width(), y4: $vertcanvas.height()
        });

        game.log("finished drawing rulers", 0);

    }, // ==============================================================================================================

    // bind the refresh button that is shown when JSON fails ===========================================================
    bindRefreshButton: function () {

        var $erroroverlay = $(".overlay.jsonfail");
        var $refreshbutton = $erroroverlay.find("a.refresh");
        game.log("refreshbutton",$refreshbutton);
        $(document).on("click",$refreshbutton,function(event){ // click on refresh button initializes the map again
            event.preventDefault();
            $erroroverlay.hide();
            game.log("refresh initiated by user",$erroroverlay);
            galmap.init();
        });

    }, // ==============================================================================================================

    // Make the map draggable ==========================================================================================
    // when the map is dragged, the rulers need the be moved accordingly
    // check for out of bounds and snap back map and ruler
    bindMapDragging: function () {

        var $mapcanvas = $("#mapCanvas");
        var $viewport = $("#mapViewPort");
        var $horzcanvas = $("#rulerHorzCanvas");
        var $vertcanvas = $("#rulerVertCanvas");

        $mapcanvas.draggable({
            // for each pixel dragged ----------------------------------------------------------------------------------
            drag: function (event, ui) {
                // move horizontal ruler along when map changes position.left
                $horzcanvas.animate({"left": ui.position.left}, 0);
                $vertcanvas.animate({"top": ui.position.top}, 0);
            },
            // once the dragging has stopped - check if we are out of bounds and bounce back. --------------------------
            stop: function (event, ui) {
                game.log("drag end","position - top: " + ui.position.top + ", left: " + ui.position.left +
                    " // originalPosition - top: " + ui.originalPosition.top + ", left: " + ui.originalPosition.left);

                var stageWidth = $viewport.width();
                var stageOffsetRight = $mapcanvas.attr("width") - stageWidth;
                var stageHeight = $viewport.height();
                var stageOffsetBottom = $mapcanvas.attr("height") - stageHeight;

                if (stageWidth > $mapcanvas.width()) {
                    // if viewport is bigger than canvas, snap back everything to (0,0)
                    // the area is a square, it doesn't matter whether we use width or height
                    $mapcanvas.animate({ "left": "0px", "top" : "0px" }, 100);
                    $horzcanvas.animate({ "left": "0px", "top": "0px" }, 100);
                    $vertcanvas.animate({ "left": "0px", "top": "0px" }, 100);
                }
                if (ui.position.left > 0) { // out of bounds - left
                    $mapcanvas.animate({"left": "0px"}, 100);
                    $horzcanvas.animate({"left": "0px"}, 100);
                }
                if (ui.position.left < -stageOffsetRight) { // out of bounds - right
                    $mapcanvas.animate({"left": "-" + stageOffsetRight + "px"}, 100);
                    $horzcanvas.animate({"left": "-" + stageOffsetRight + "px"}, 100);
                }
                if (ui.position.top > 0)  { // out of bounds - top
                    $mapcanvas.animate({"top": "0px"}, 100);
                    $vertcanvas.animate({"top": "0px"}, 100);
                }
                if (ui.position.top < -stageOffsetBottom) { // out of bounds - bottom
                    $mapcanvas.animate({"top": "-" + stageOffsetBottom + "px"}, 100);
                    $vertcanvas.animate({"top": "-" + stageOffsetBottom + "px"}, 100);
                }

            }
        });

    }, // ==============================================================================================================

    // Make rulers draggable ===========================================================================================
    // when a ruler is dragged, the map needs to be moved accordingly
    // check for out of bounds and snap back ruler and map
    bindRulerDragging: function () {

        var $mapcanvas = $("#mapCanvas");
        var $viewport = $("#mapViewPort");
        var $horzcanvas = $("#rulerHorzCanvas");
        var $vertcanvas = $("#rulerVertCanvas");


        // horizontal ruler --------------------------------------------------------------------------------------------
        $horzcanvas.draggable({
            axis: "x",
            // for every pixel dragged, we need to move the map --------------------------------------------------------
            drag: function (event, ui) {
                // move map when ruler is dragged horizontally
                $mapcanvas.animate({"left": ui.position.left}, 0);
            },
            // once the dragging has stopped - check if we are out of bounds and bounce back. --------------------------
            stop: function (event, ui) {

                var stageWidth = $viewport.width();
                var stageOffsetRight = $mapcanvas.attr("width") - stageWidth;
                if (ui.position.left > 0) { // out of bounds - left
                    $mapcanvas.animate({"left": "0px"}, 100);
                    $horzcanvas.animate({"left": "0px"}, 100);
                }
                if (ui.position.left < -stageOffsetRight) { // out of bounds - right
                    $mapcanvas.animate({"left": "-" + stageOffsetRight + "px"}, 100);
                    $horzcanvas.animate({"left": "-" + stageOffsetRight + "px"}, 100);
                }
            }
        });

        // vertical ruler ----------------------------------------------------------------------------------------------
        $vertcanvas.draggable({
            axis: "y",
            // for every pixel dragged, we need to move the map --------------------------------------------------------
            drag: function (event, ui) {
                // move map when ruler is dragged horizontally
                $mapcanvas.animate({"top": ui.position.top}, 0);
            },
            // once the dragging has stopped - check if we are out of bounds and bounce back. --------------------------
            stop: function (event, ui) {

                var stageHeight = $viewport.height();
                var stageOffsetBottom = $mapcanvas.attr("height") - stageHeight;
                if (ui.position.top > 0) { // out of bounds - top
                    $mapcanvas.animate({"top": "0px"}, 100);
                    $vertcanvas.animate({"top": "0px"}, 100);
                }
                if (ui.position.top < -stageOffsetBottom) { // out of bounds - bottom
                    $mapcanvas.animate({"top": "-" + stageOffsetBottom + "px"}, 100);
                    $vertcanvas.animate({"top": "-" + stageOffsetBottom + "px"}, 100);
                }
            }
        });

    }, // ==============================================================================================================

    // bind button that focusses the map ===============================================================================
    // used for "focushome" button and others
    bindFocusButton: function (selector,coordX,coordY) {

        $(document).on("click", selector, function (event) {
            event.preventDefault();
            galmap.focusMap(coordX,coordY);
        });

    }, // ==============================================================================================================

    // fokusmap: move the canvas so the coordinate is in the middle of the viewport ====================================
    // if snappy has no value, we animate (100ms); if snappy has no value we simply change attributes
    focusMap: function (coordX,coordY) {

        var offset = galmap.getOffSetFromCoords(coordX,coordY);
        var animateToX = offset.x;
        var animateToY = offset.y;
        if ( (coordX === 0) && (coordY === 0) ) {
            animateToX = 0; animateToY = 0; // if we are supposed to focus (0,0), instead move map to top left
        }
        $("#mapCanvas").animate({ "left": animateToX, "top": animateToY }, 500);
        $("#rulerHorzCanvas").animate({ "left": animateToX}, 500); // move rulers along with map
        $("#rulerVertCanvas").animate({ "top": animateToY}, 500);
        game.log("moving map to", "x: " + animateToX + ", y:" + animateToY + " (" + coordX + "," + coordY + ")");

    }, // ==============================================================================================================

    // bind zoom buttons ===============================================================================================
    bindZoom: function () {

        // zoomfactor is a temporary value. might need to be changed for design, might need to be made dynamically.
        var zoomFactor = 0.43;

        $(".zoom a.icon").click( function (event) {
            event.preventDefault();
            if (!$(this).hasClass("disabled")) {
                game.log("zoom requested",0);

                // find coordinates ------------------------------------------------------------------------------------
                var position = $("#mapCanvas").position();
                var coords = galmap.getCoordsFromOffset(position.left, position.top);
                var currentCoordX = coords.x;
                var currentCoordY = coords.y;
                game.log("Coordinates before zoom", "(" + currentCoordX + "," + currentCoordY + ")");

                // Zoom In ---------------------------------------------------------------------------------------------
                if ($(this).hasClass("in")) {
                    galmap.zoom = galmap.zoom + zoomFactor;
                    galmap.tilesize = galmap.prefs.tilesize * galmap.zoom;
                    galmap.drawMap(galmap.mapdata); // and redraw the map.
                    if (galmap.zoom === 1) {
                        $(".icon").removeClass("disabled");
                    }
                    if (galmap.zoom > 1) {
                        $(".icon.in").addClass("disabled");
                        galmap.focusMap(currentCoordX, currentCoordY); // and move the map
                    }
                }

                // Zoom Out --------------------------------------------------------------------------------------------
                else {
                    galmap.zoom = galmap.zoom - zoomFactor;
                    galmap.tilesize = galmap.prefs.tilesize * galmap.zoom;
                    galmap.drawMap(galmap.mapdata); // and redraw the map.
                    if (galmap.zoom === 1) {
                        $(".icon").removeClass("disabled");
                    }
                    if (galmap.zoom < 1) {
                        $(".icon.out").addClass("disabled");
                        galmap.focusMap(0, 0); // and move the map
                    } else {
                        galmap.focusMap(currentCoordX, currentCoordY); // and move the map
                    }
                }

            }
        });


    }, // ==============================================================================================================

    // Get Coordinates from canvas position.left and position.top ======================================================
    // leftOffSet = [canvas].position().left; topOffSet = [canvas].position().top
    getCoordsFromOffset: function (leftOffSet, topOffSet) {

        var $mapcanvas = $("#mapCanvas");
        var $viewport = $("#mapViewPort");

        // number of squares from viewport left to center --------------------------------------------------------------
        var coordsToViewPortCenter = Math.abs(
            ( ($viewport.width() / $mapcanvas.width()) * galmap.mapdata.settings.size) / 2
        );
        // number of squares of canvas scrolled to right ---------------------------------------------------------------
        var coordX = parseInt(
            (Math.ceil(
                Math.abs(
                    (leftOffSet / $mapcanvas.width()) * galmap.mapdata.settings.size
                ) + coordsToViewPortCenter) - 1
            ), 10 // decimals for parsefloat
        );
        // number of squares of canvas scrolled to bottom --------------------------------------------------------------
        var coordY = parseInt(
            (Math.ceil(
                Math.abs(
                    (topOffSet / $mapcanvas.height()) * galmap.mapdata.settings.size
                ) + coordsToViewPortCenter) - 1
            ), 10 // decimals for parsefloat
        );

        return { x: coordX, y: coordY };

    }, // ==============================================================================================================

    // Get Canvas Offset from Coordinates ==============================================================================
    // centers on tile
    getOffSetFromCoords: function (coordX, coordY) {
        var $viewport = $("#mapViewPort");
        var fokusToX = Math.round($viewport.width() / 2); // half of stage
        var fokusToY = Math.round($viewport.height() / 2);
        var canvasX = Math.round(( (coordX + 1) * galmap.tilesize) - (galmap.tilesize / 2)); // +1 because coords start at 0
        var canvasY = Math.round(( (coordY + 1) * galmap.tilesize) - (galmap.tilesize / 2));
        var animateToX = fokusToX - canvasX;
        var animateToY = fokusToY - canvasY;
        return {
            x: animateToX,
            y: animateToY
        };
    }, // ==============================================================================================================

    // Draw a single system ============================================================================================
    drawSystem: function (id) {

        var coordX = galmap.mapdata.systems[id].x;
        var coordY = galmap.mapdata.systems[id].y;
        var canvasX = (coordX * galmap.tilesize) + Math.round(galmap.tilesize / 2);
        var canvasY = (coordY * galmap.tilesize) + Math.round(galmap.tilesize / 2);
        var starImage = "../../public/images/stars/" + galmap.mapdata.systems[id].spectral + ".png";
        // default for pixelsize of images is 40; tilesize is 50. Make sure this scales correctly:
        var imageSquarePixel = Math.round((galmap.tilesize * 4) / 5);

        game.log(
            "drawing system",
            " id: " + id + ", owner: " + galmap.mapdata.systems[id].owner + ", spectral: " +
            galmap.mapdata.systems[id].spectral + ", x: " + coordX + "(" + canvasX + "), y: " +
            coordY + "(" + canvasY + ")"
        );

        $("#mapCanvas").drawImage({
            source: starImage,
            layer: true,
            clickable: true,
            name: "system-"+id,
            group: ["systems"],
            x: canvasX, y: canvasY,
            width: imageSquarePixel,
            height: imageSquarePixel,
            fromCenter: true,
            click: function () {
                game.log( // this is temporary of course, pending further game specification
                    "clicked on star","id: " + id + ", owner: " + galmap.mapdata.systems[id].owner +
                    ", spectral: " + galmap.mapdata.systems[id].spectral
                );
            },
            // scale up star when mouse gets closer to center, scale down when getting closer to edge ------------------
            mousemove: function (layer) {
                $(this).css("cursor","pointer");
                var dx, dy, dist;
                dx = layer.eventX - layer.x;
                dy = layer.eventY - layer.y;
                dist = imageSquarePixel - Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
                layer.width = Math.round((dist / imageSquarePixel) * imageSquarePixel) + imageSquarePixel;
                layer.height = Math.round((dist / imageSquarePixel) * imageSquarePixel) + imageSquarePixel;
            },
            // restore defaults on mouse out ---------------------------------------------------------------------------
            mouseout: function (layer) {
                $(this).css("cursor", "move");
                layer.width = imageSquarePixel;
                layer.height = imageSquarePixel;
                game.log("restored star defaults on mouse out", imageSquarePixel);
            }
        });

    }, // ==============================================================================================================

    // Draw a wormhole (connection between two systems) ================================================================
    // from and to are the IDs of the systems that are linked
    drawWormHole: function (from,to) {

        var wormHoleColor = "#9cf";
        var fromX = (galmap.mapdata.systems[from].x * galmap.tilesize) + (galmap.tilesize / 2);
        var fromY = (galmap.mapdata.systems[from].y * galmap.tilesize) + (galmap.tilesize / 2);
        var toX = (galmap.mapdata.systems[to].x * galmap.tilesize) + (galmap.tilesize / 2);
        var toY = (galmap.mapdata.systems[to].y * galmap.tilesize) + (galmap.tilesize / 2);
        var strokeWidth = 1;
        if (galmap.zoom > 1) { strokeWidth = 2; }

        game.log(
            "drawing wormhole",
            "from #" + from + " (" + fromX + "," + fromY + ") to #" + to + " (" + toX + "," + toY + ")"
        );

        $("#mapCanvas").drawLine({
            layer: true,
            group: ["wormholes"],
            strokeStyle: wormHoleColor,
            strokeWidth: strokeWidth,
            x1: fromX,
            y1: fromY,
            x2: toX,
            y2: toY
        });

    } // ===============================================================================================================

};

galmap.init();

//
