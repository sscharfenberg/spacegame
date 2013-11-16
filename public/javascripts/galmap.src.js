/* *********************************************************************************************************************
* GALMAP.JS
* contains Functions to draw the galactic map
* (c) 2013 Sven Scharfenberg | sven.scharfenberg@projektvier.de
***********************************************************************************************************************/
//
// setup namespace =====================================================================================================
window.galmap = window.galmap || {

    // important global vars ===========================================================================================
    tilesize: 50, // size in pixels of a maptile. needed for pretty much everything.
    mapdata: null, // the object that will later contain the JSON data; needed to redraw the map.

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
            // now that the map is drawn, assign drag, focus and bindZoom events ---------------------------------------
            galmap.bindMapDragging();
            galmap.bindRulerDragging();
            galmap.bindFocusButton(".mapbutton.focushome", data.systems[data.home].x, data.systems[data.home].y);
            galmap.bindZoom();
            // everything done -----------------------------------------------------------------------------------------
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

        var $galMapCanvas = $("#mapCanvas");
        // prepare canvas with correct width and height (html has default) ---------------------------------------------
        var mapSquarePixels = galmap.tilesize * map.settings.size;
        $galMapCanvas.attr({ width: mapSquarePixels, height: mapSquarePixels });

        // clear stage (we need this for redrawing) --------------------------------------------------------------------
        $galMapCanvas.clearCanvas({
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

        var $galMapCanvas = $("#mapCanvas");
        var gridColor = "#1a1a1a";
        var posX1, posX2, posY1, posY2 = 0;

        for (var i = 0; i < (galmap.mapdata.settings.size-1); i++) {
            // draw a vertical line ------------------------------------------------------------------------------------
            posX1 = (galmap.tilesize * i) + galmap.tilesize;
            posX2 = (galmap.tilesize * i) + galmap.tilesize;
            posY1 = 0;
            posY2 = $galMapCanvas.height();
            $galMapCanvas.drawLine({
                layer: true, groups: ["grid"], strokeStyle: gridColor, strokeWidth: 2, x1: posX1, y1: posY1, x2: posX2, y2: posY2
            });
            // draw a horizontal line ----------------------------------------------------------------------------------
            posX1 = 0;
            posX2 = $galMapCanvas.width();
            posY1 = (galmap.tilesize * i) + galmap.tilesize;
            posY2 = (galmap.tilesize * i) + galmap.tilesize;
            $galMapCanvas.drawLine({
                layer: true, groups: ["grid"], strokeStyle: gridColor, strokeWidth: 2, x1: posX1, y1: posY1, x2: posX2, y2: posY2
            });
        }

        // draw a box around the stage ---------------------------------------------------------------------------------
        $galMapCanvas.drawLine({
            layer: true,
            groups: ["grid"],
            strokeStyle: gridColor,
            strokeWidth: 2,
            x1: 1, y1: 1, x2: $galMapCanvas.width() - 1, y2: 1, x3: $galMapCanvas.width() - 1, y3: $galMapCanvas.height() - 1,
            x4: 1, y4: $galMapCanvas.height() - 1, x5: 1, y5: 1
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
    // check for collision with edges
    bindMapDragging: function () {

        var $galMapCanvas = $("#mapCanvas");
        var $viewport = $("#mapViewPort");

        $galMapCanvas.draggable({
            // for each pixel dragged ----------------------------------------------------------------------------------
            drag: function (event, ui) {
                var maxOffSetLeft = parseInt($galMapCanvas.attr("width") - $viewport.width(),10);
                var maxOffSetTop = parseInt($galMapCanvas.attr("height") - $viewport.height(), 10);
                if (ui.position.top > 0) { // reached top edge
                    ui.position.top = 0;
                }
                if (ui.position.top < -maxOffSetTop) { // reached bottom edge
                    ui.position.top = -maxOffSetTop;
                }
                if (ui.position.left > 0) { // reached left edge
                    ui.position.left = 0;
                }
                if (ui.position.left < -maxOffSetLeft) { // reached right edge
                    ui.position.left = -maxOffSetLeft;
                }
                if ( (ui.position.top <= 0) && (ui.position.left <= 0) && (ui.position.left >= -maxOffSetLeft) && (ui.position.top >= -maxOffSetTop) ) {
                    // if we have not reached any of the edges, update ruler position accordingly
                    $("#rulerHorzCanvas").css("left", ui.position.left);
                    $("#rulerVertCanvas").css("top", ui.position.top);
                }
            },
            stop: function (event, ui) {
                game.log("dragged map", "position - top: " + ui.position.top + ", left: " + ui.position.left +
                    " // originalPosition - top: " + ui.originalPosition.top + ", left: " + ui.originalPosition.left);
            }

        });

    }, // ==============================================================================================================

    // Make rulers draggable ===========================================================================================
    // when a ruler is dragged, the map needs to be moved accordingly
    // check for collision with edges
    bindRulerDragging: function () {

        var $galMapCanvas = $("#mapCanvas");
        var $viewport = $("#mapViewPort");
        var $horzcanvas = $("#rulerHorzCanvas");
        var $vertcanvas = $("#rulerVertCanvas");
        var maxOffSetLeft = parseInt($galMapCanvas.attr("width") - $viewport.width(), 10);
        var maxOffSetTop = parseInt($galMapCanvas.attr("height") - $viewport.height(), 10);

        // horizontal ruler --------------------------------------------------------------------------------------------
        $horzcanvas.draggable({
            axis: "x",
            // for every pixel dragged, check if we have reached one of the edges --------------------------------------
            drag: function (event, ui) {
                if (ui.position.left > 0) { // reached left edge
                    ui.position.left = 0;
                }
                if (ui.position.left < -maxOffSetLeft) { // reached right edge
                    ui.position.left = -maxOffSetLeft;
                }
                if ( (ui.position.left <= 0) && (ui.position.left >= -maxOffSetLeft) ) {
                    // no collision with edges, move map accordingly
                    $galMapCanvas.css("left", ui.position.left);
                }
            },
            stop: function (event, ui) {
                game.log("dragged horizontal ruler", "position - top: " + ui.position.top +
                ", left: " + ui.position.left + " // originalPosition - top: " + ui.originalPosition.top +
                ", left: " + ui.originalPosition.left);
            }
        });

        // vertical ruler ----------------------------------------------------------------------------------------------
        $vertcanvas.draggable({
            axis: "y",
            // for every pixel dragged, check if we have reached one of the edges --------------------------------------
            drag: function (event, ui) {
                if (ui.position.top > 0) { // reached top edge
                    ui.position.top = 0;
                }
                if (ui.position.top < -maxOffSetTop) { // reached bottom edge
                    ui.position.top = -maxOffSetTop;
                }
                if ( (ui.position.top <= 0) && (ui.position.top >= -maxOffSetTop) ) {
                    // no collision with edges, move map accordingly
                    $galMapCanvas.css("top", ui.position.top);
                }
            },
            stop: function (event,ui) {
                game.log("dragged vertical ruler", "position - top: " + ui.position.top +
                    ", left: " + ui.position.left + " // originalPosition - top: " + ui.originalPosition.top +
                    ", left: " + ui.originalPosition.left);
            }
        });

    }, // ==============================================================================================================

    // bind button that focusses the map ===============================================================================
    // used for "focushome" button and others
    bindFocusButton: function (selector,coordX,coordY) {

        $(document).on("click", selector, function (event) {
            event.preventDefault();
            galmap.focusMap(coordX,coordY,"flash");
        });

    }, // ==============================================================================================================

    // fokusmap: move the canvas so the coordinate is in the middle of the viewport ====================================
    // if flash has a value, the focussed tile is marked by flashing borders and changing opacity
    focusMap: function (coordX,coordY,type) {

        var $viewPort = $("#mapViewPort");
        var $galMapCanvas = $("#mapCanvas");
        var offset = galmap.getOffSetFromCoords(coordX,coordY);
        var animateToX = offset.x;
        var animateToY = offset.y;
        var maxOffSetLeft = parseInt($galMapCanvas.attr("width") - $viewPort.width(), 10);
        var maxOffSetTop = parseInt($galMapCanvas.attr("height") - $viewPort.height(), 10);

        // make sure that we do not move over the edges ----------------------------------------------------------------
        if (animateToX < -maxOffSetLeft) { animateToX = -maxOffSetTop; } // reached right edge
        if (animateToY < -maxOffSetTop) { animateToY = -maxOffSetTop; } // reached bottom edge
        if (animateToX > 0) { animateToX = 0; } // over left edge
        if (animateToY > 0) { animateToY = 0; } // over top edge

        // Flash: animate the moving of map, and highlight the coordinates ---------------------------------------------
        if (type === "flash") {
            game.log(
                "moving map and rulers to",
                "x: " + animateToX + ", y:" + animateToY + " (" + coordX + "," + coordY + ")"
            );
            $("#rulerHorzCanvas").animate({ "left": animateToX}, 100); // move rulers along with map
            $("#rulerVertCanvas").animate({ "top": animateToY}, 100);
            $galMapCanvas.animate({ "left": animateToX, "top": animateToY }, 100, function () {
                $galMapCanvas.removeLayerGroup("flashbg").removeLayerGroup("flashtile");
                // draw the tile that we are focussing -----------------------------------------------------------------
                var fillStyle = "#153b61",
                    strokeStyle = "#9cf";
                $galMapCanvas.drawRect({ // stripe top
                    fillStyle: fillStyle, layer: true, groups: ["flashbg"], fromCenter: false,
                    x: (galmap.tilesize * coordX) - 1, y: 0, width: galmap.tilesize + 2,
                    height: (galmap.tilesize * coordY)
                }).drawRect({ // stripe bottom
                    fillStyle: fillStyle, layer: true, groups: ["flashbg"], fromCenter: false,
                    x: (galmap.tilesize * coordX) - 1, y: (galmap.tilesize * (coordY + 1)), width: galmap.tilesize + 2,
                    height: $galMapCanvas.height() - (galmap.tilesize * coordY)
                }).drawRect({ // stripe left
                    fillStyle: fillStyle, layer: true, groups: ["flashbg"], fromCenter: false,
                    x: 0, y: (galmap.tilesize * coordY) - 1,
                    width: (galmap.tilesize * coordX), height: galmap.tilesize + 2
                }).drawRect({ // stripe right
                    fillStyle: fillStyle, layer: true, groups: ["flashbg"], fromCenter: false,
                    x: (galmap.tilesize * (coordX + 1)), y: (galmap.tilesize * coordY) - 1,
                    width: $galMapCanvas.width() - (galmap.tilesize * coordX), height: galmap.tilesize + 2
                }).drawRect({ // the focussed tile itself
                    fillStyle: "transparent", strokeStyle: strokeStyle, strokeWidth: 2, layer: true, fromCenter: false,
                    groups: ["flashtile"], x: (galmap.tilesize * coordX), y: (galmap.tilesize * coordY),
                    width: galmap.tilesize, height: galmap.tilesize
                });
                // animate the layergroup ------------------------------------------------------------------------------
                $galMapCanvas.animateLayerGroup("flashbg", { // flashbg animates background to transparent
                        fillStyle: "transparent"
                    }, 1500, "swing",
                    function (layer) {
                        $galMapCanvas.removeLayerGroup(layer); // remove layer again when done
                    }
                );
                $galMapCanvas.animateLayerGroup("flashtile", { // flashtile animates stroke to transparent
                        strokeStyle: "transparent"
                    }, 1500, "swing",
                    function (layer) {
                        $galMapCanvas.removeLayerGroup(layer); // remove layer again when done
                    }
                );
                $galMapCanvas.drawLayers();
            });
        }
        // Snap: Just change position of map and rulers ----------------------------------------------------------------
        else {
            game.log(
                "snapping map and rulers to",
                "x: " + animateToX + ", y:" + animateToY + " (" + coordX + "," + coordY + ")"
            );
            $("#rulerHorzCanvas").css("left", animateToX);
            $("#rulerVertCanvas").css("top", animateToY);
            $galMapCanvas.css({"left": animateToX, "top": animateToY});
        }

    }, // ==============================================================================================================

    // bind zoom buttons ===============================================================================================
    bindZoom: function () {

        $(".zoom a.icon").click( function (event) {
            event.preventDefault();
            if (!$(this).hasClass("disabled")) {

                game.log("Zoom requested",0);
                var $zoom = $("#currentZoomMarker");
                // find coordinates ------------------------------------------------------------------------------------
                var $galMapCanvas = $("#mapCanvas");
                var position = $galMapCanvas.position();
                var coords = galmap.getCoordsFromOffset(position.left, position.top);
                var currentCoordX = coords.x;
                var currentCoordY = coords.y;
                game.log("Coordinates before bindZoom", "(" + currentCoordX + "," + currentCoordY + ")");

                // TODO: get coords before zooming, change position after zooming: bla, function () { ... });

                // Zoom In ---------------------------------------------------------------------------------------------
                if ($(this).hasClass("in")) {

                    // check if we are zooming in from min zoom and enable zoom out button accordingly
                    if ($zoom.find("span.active").prev("span").length === 0) {
                        $(".icon.out").removeClass("disabled");
                    }
                    // check if there is a next zoomlevel and move class="active" one span forward
                    if ($zoom.find("span.active").next("span").length > 0) {
                        $zoom.find("span.active").removeClass("active")
                            .next("span").addClass("active");
                    }
                    // check if we have arrived at max zoom and need to disable zoom in button
                    if ($zoom.find("span.active").next("span").length === 0 ) {
                        $(this).addClass("disabled");
                    }

                    galmap.tilesize = parseInt($zoom.find("span.active").text(),10);
                    game.log("new tilesize", galmap.tilesize);
                    galmap.drawMap(galmap.mapdata);
                    galmap.focusMap(currentCoordX, currentCoordY);

                }

                // Zoom Out --------------------------------------------------------------------------------------------
                else if ($(this).hasClass("out")) {

                    // check if we are zooming out from max zoom and enable zoom in button accordingly
                    if ($zoom.find("span.active").next("span").length === 0) {
                        $(".icon.in").removeClass("disabled");
                    }
                    // check if there is a prev zoomlevel and move class="active" one span backward
                    if ($zoom.find("span.active").prev("span").length > 0) {
                        $zoom.find("span.active").removeClass("active")
                            .prev("span").addClass("active");
                    }
                    // check if we have arrived at max zoom and need to disable zoom in button
                    if ($zoom.find("span.active").prev("span").length === 0) {
                        $(this).addClass("disabled");
                    }

                    galmap.tilesize = parseInt($zoom.find("span.active").text(), 10);
                    game.log("new tilesize", galmap.tilesize);
                    galmap.drawMap(galmap.mapdata);
                    galmap.focusMap(currentCoordX, currentCoordY);

                }

            }
        });


    }, // ==============================================================================================================

    // Get Coordinates from canvas position.left and position.top ======================================================
    // leftOffSet = [canvas].position().left; topOffSet = [canvas].position().top
    getCoordsFromOffset: function (leftOffSet, topOffSet) {

        var $galMapCanvas = $("#mapCanvas");
        var $viewport = $("#mapViewPort");

        // number of squares from viewport left to center --------------------------------------------------------------
        var coordsToViewPortCenter = Math.abs(
            ( ($viewport.width() / $galMapCanvas.width()) * galmap.mapdata.settings.size) / 2
        );
        // number of squares of canvas scrolled to right ---------------------------------------------------------------
        var coordX = parseInt(
            (Math.ceil(
                Math.abs(
                    (leftOffSet / $galMapCanvas.width()) * galmap.mapdata.settings.size
                ) + coordsToViewPortCenter) - 1
            ), 10 // decimals for parsefloat
        );
        // number of squares of canvas scrolled to bottom --------------------------------------------------------------
        var coordY = parseInt(
            (Math.ceil(
                Math.abs(
                    (topOffSet / $galMapCanvas.height()) * galmap.mapdata.settings.size
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
        var spriteSquarePixels = 120; // width of star sprite in stars.png
        var canvasX = (coordX * galmap.tilesize) + Math.round(galmap.tilesize / 2);
        var canvasY = (coordY * galmap.tilesize) + Math.round(galmap.tilesize / 2);
        // default for pixelsize of images is 40; tilesize is 50. Make sure this scales correctly:
        var imageSquarePixel = Math.round((galmap.tilesize * 4) / 5);

        game.log(
            "drawing system",
            " id: " + id + ", owner: " + galmap.mapdata.systems[id].owner + ", spectral: " +
            galmap.mapdata.systems[id].spectral + ", x: " + coordX + "(" + canvasX + "), y: " +
            coordY + "(" + canvasY + ")"
        );

        $("#mapCanvas").drawImage({
            source          : $("#spriteStars").attr("src"),
            sWidth          : spriteSquarePixels, // width of cropped sprite
            sHeight         : spriteSquarePixels, // height of cropped sprite
            sx              : 0,
            sy              : (galmap.mapdata.systems[id].spectral * spriteSquarePixels),
            cropFromCenter  : false,
            layer           : true,
            clickable       : true,
            name            : "system-"+id,
            groups          : ["systems"],
            x               : canvasX,
            y               : canvasY,
            width           : imageSquarePixel,
            height          : imageSquarePixel,
            fromCenter      : true,
            click: function () {
                game.log( // this is temporary of course, pending further game specification
                    "clicked on star","id: " + id + ", owner: " + galmap.mapdata.systems[id].owner +
                    ", spectral: " + galmap.mapdata.systems[id].spectral
                );
            },
            mouseover: function () {
                $(this).css("cursor", "pointer");
            },
            // restore defaults on mouse out ---------------------------------------------------------------------------
            mouseout: function () {
                $(this).css("cursor", "move");
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
        if (galmap.bindZoom > 1) { strokeWidth = 2; }

        game.log(
            "drawing wormhole",
            "from #" + from + " (" + fromX + "," + fromY + ") to #" + to + " (" + toX + "," + toY + ")"
        );

        $("#mapCanvas").drawLine({
            layer: true,
            groups: ["wormholes"],
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
