/* *********************************************************************************************************************
* GALMAP.JS
* contains Functions to draw the galactic map
* (c) 2013 Sven Scharfenberg | sven.scharfenberg@projektvier.de
***********************************************************************************************************************/
//
// setup namespace =====================================================================================================
window.galmap = window.galmap || {

    // important global vars ===========================================================================================
    tilesize: 0,
    // size in pixels of a maptile. needed for pretty much everything.
    mapdata: null,
    // the object that will later contain the JSON data; needed to redraw the map.

    // Initialize ======================================================================================================
    init: function () {

        // required feature testing ------------------------------------------------------------------------------------
        // later, we can add polyfills here
        if ( (!Modernizr.canvas) || (!Modernizr.canvastext) ) {
            alert("Sorry, your browser does not support canvas or canvastext. Please update your browser");
            location.href = "http://www.google.de/intl/de/chrome/browser/";
        }

        // define local and global jquery objects ----------------------------------------------------------------------
        var $mapviewport = $("#mapViewPort"),
            $rulervertviewport = $("#viewPortRulerVert");

        // adjust height of map and vertical ruler to the same value as map width --------------------------------------
        // width has correct value from css, we can't do that with height
        // we need to assign the height twice because of a jQuery glitch (.width() outputs wrong value)
        $mapviewport.height($mapviewport.width()).height($mapviewport.width());
        $rulervertviewport.height($mapviewport.height());

        // load data from JSON -----------------------------------------------------------------------------------------
        // TODO: temporary value, needs to by dynamic for non-tests
        var mapdata = galmap.loadData("./mapdata.json");

        // and start drawing the map -----------------------------------------------------------------------------------
        mapdata.done(function (data) { // once the JSON promise is fulfilled, this function gets executed --------------
            game.log("Data recieved from JSON", data);
            galmap.mapdata = data; // save JSON data in global object
            var $currentZoom = $("#currentZoomMarker"), currentIndex;
            if ( (Modernizr.localstorage) && (localStorage["galmap.zoomlevel"]) ) { // get zoom level from localStorage
                currentIndex = parseInt($currentZoom.find("span").length, 10) -
                    parseInt(localStorage["galmap.zoomlevel"], 10) - 1;
            } else { // if no localStorage, use the middle (sorry dude)
                currentIndex = Math.ceil(parseInt($currentZoom.find("span").length-1, 10) / 2);
            }
            galmap.tilesize = parseInt( // get tilesize from the <span class="active">
                $currentZoom.find("span").eq(currentIndex).addClass("active").text(), 10
            );
            if ($currentZoom.find("span:first").hasClass("active")) { $(".icon.in").addClass("disabled"); }
            if ($currentZoom.find("span:last").hasClass("active")) { $(".icon.out").addClass("disabled"); }
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


        var mapSquarePixels = galmap.tilesize * map.settings.size;
        // prepare canvas with correct width and height (html has default) ---------------------------------------------
        $galMapCanvas.prop({ width: mapSquarePixels, height: mapSquarePixels });

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

        var $galMapCanvas = $("#mapCanvas"),
            gridColor = "#1a1a1a",
            strokeWidth = 2,
            posX1, posX2, posY1, posY2;

        if (galmap.tilesize < 50) {
            strokeWidth = 1;
        }


        for (var i = 0; i < (galmap.mapdata.settings.size-1); i++) {
            // draw a vertical line ------------------------------------------------------------------------------------
            posX1 = (galmap.tilesize * i) + galmap.tilesize;
            posX2 = (galmap.tilesize * i) + galmap.tilesize;
            posY1 = 0;
            posY2 = $galMapCanvas.height();
            $galMapCanvas.drawLine({
                layer: true, groups: ["grid"], strokeStyle: gridColor, strokeWidth: strokeWidth,
                x1: posX1, y1: posY1, x2: posX2, y2: posY2
            });
            // draw a horizontal line ----------------------------------------------------------------------------------
            posX1 = 0;
            posX2 = $galMapCanvas.width();
            posY1 = (galmap.tilesize * i) + galmap.tilesize;
            posY2 = (galmap.tilesize * i) + galmap.tilesize;
            $galMapCanvas.drawLine({
                layer: true, groups: ["grid"], strokeStyle: gridColor, strokeWidth: strokeWidth,
                x1: posX1, y1: posY1, x2: posX2, y2: posY2
            });
        }

        // draw a box around the stage ---------------------------------------------------------------------------------
        $galMapCanvas.drawLine({
            layer: true,
            groups: ["grid"],
            strokeStyle: gridColor,
            strokeWidth: strokeWidth,
            x1: 1, y1: 1,
            x2: $galMapCanvas.width() - 1, y2: 1,
            x3: $galMapCanvas.width() - 1, y3: $galMapCanvas.height() - 1,
            x4: 1, y4: $galMapCanvas.height() - 1,
            x5: 1, y5: 1
        });

        game.log("finished drawing grid", 0);

    }, // ==============================================================================================================

    // drawRulers: draw the horizontal and vertical rulers =============================================================
    drawRulers: function () {

        var $horzcanvas = $("#rulerHorzCanvas"),
            $vertcanvas = $("#rulerVertCanvas"),
            textColor = "#fff",
            gridColor = "#1a1a1a",
            mapSquarePixels = galmap.tilesize * galmap.mapdata.settings.size,
            posX, posY, posX1, posX2, posY1, posY2, coordText;

        // prepare canvas with correct width and height (html has 2000) ------------------------------------------------
        $horzcanvas.prop({ width: mapSquarePixels }); // prop instead of width() so we don't scale but enlarge
        $vertcanvas.prop({ height: mapSquarePixels });

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

        var $erroroverlay = $(".overlay.jsonfail"),
            $refreshbutton = $erroroverlay.find("a.refresh");
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

        var $galMapCanvas = $("#mapCanvas"),
            $viewport = $("#mapViewPort");

        $galMapCanvas.drag(function (event, dd) {
            // for each pixel dragged ----------------------------------------------------------------------------------
            var maxOffSetLeft = parseInt($galMapCanvas.prop("width") - $viewport.width(), 10),
                maxOffSetTop = parseInt($galMapCanvas.prop("height") - $viewport.height(), 10);
            if (dd.offsetY > 0) { // reached top edge
                dd.offsetY = 0;
            }
            if (dd.offsetY < -maxOffSetTop) { // reached bottom edge
                dd.offsetY = -maxOffSetTop;
            }
            if (dd.offsetX > 0) { // reached left edge
                dd.offsetX = 0;
            }
            if (dd.offsetX < -maxOffSetLeft) { // reached right edge
                dd.offsetX = -maxOffSetLeft;
            }
            $(this).css({ top: dd.offsetY, left: dd.offsetX });
            $("#rulerHorzCanvas").css("left", dd.offsetX);
            $("#rulerVertCanvas").css("top", dd.offsetY);

        }, { relative: true })
        .drag("end", function () {
            game.log("dragged map", "endposition - top: " + $(this).css("top") + ", left: " + $(this).css("left"));
        });

    }, // ==============================================================================================================

    // Make rulers draggable ===========================================================================================
    // when a ruler is dragged, the map needs to be moved accordingly
    // check for collision with edges
    bindRulerDragging: function () {

        var $galMapCanvas = $("#mapCanvas"),
            $viewport = $("#mapViewPort"),
            $horzcanvas = $("#rulerHorzCanvas"),
            $vertcanvas = $("#rulerVertCanvas"),
            maxOffSetLeft, maxOffSetTop;

        // horizontal ruler --------------------------------------------------------------------------------------------
        $horzcanvas.drag(function (event, dd) {
            maxOffSetLeft = parseInt($galMapCanvas.prop("width") - $viewport.width(), 10);
            // for every pixel dragged, check if we have reached one of the edges --------------------------------------
            if (dd.offsetX > 0) { // reached left edge
                dd.offsetX = 0;
            }
            if (dd.offsetX < -maxOffSetLeft) { // reached right edge
                dd.offsetX = -maxOffSetLeft;
            }
            $(this).css({ left: dd.offsetX });
            $galMapCanvas.css("left", dd.offsetX);
        }, { relative: true })
        .drag("end", function () {
            game.log(
                "dragged horizontal ruler", "endposition - left: " + $horzcanvas.css("left")
            );
        });

        // vertical ruler ----------------------------------------------------------------------------------------------
        $vertcanvas.drag(function (event, dd) {
            maxOffSetTop = parseInt($galMapCanvas.prop("height") - $viewport.height(), 10);
            if (dd.offsetY > 0) { // reached top edge
                dd.offsetY = 0;
            }
            if (dd.offsetY < -maxOffSetTop) { // reached bottom edge
                dd.offsetY = -maxOffSetTop;
            }
            $(this).css({ top: dd.offsetY });
            $galMapCanvas.css("top", dd.offsetY);
        }, { relative: true })
        .drag("end", function () {
            game.log(
                "dragged vertical ruler", "endposition -  top: " + $vertcanvas.css("top")
            );
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

        var $viewPort = $("#mapViewPort"),
            $galMapCanvas = $("#mapCanvas"),
            offset = galmap.getOffSetFromCoords(coordX,coordY),
            animateToX = offset.x,
            animateToY = offset.y,
            maxOffSetLeft = parseInt($galMapCanvas.prop("width") - $viewPort.width(), 10),
            maxOffSetTop = parseInt($galMapCanvas.prop("height") - $viewPort.height(), 10);

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
            $("#rulerHorzCanvas").animate({ "left": animateToX}, 200); // move rulers along with map
            $("#rulerVertCanvas").animate({ "top": animateToY}, 20);
            $galMapCanvas.animate({ "left": animateToX, "top": animateToY }, 200, function () {
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

        $(document).on("click",".zoom a.icon:not(.disabled)", function (event) {
            event.preventDefault();

            game.log("Zoom requested",0);
            var $zoom = $("#currentZoomMarker"),
                $galMapCanvas = $("#mapCanvas"),
                position = $galMapCanvas.position(),
                // find coordinates
                coords = galmap.getCoordsFromOffset(position.left, position.top),
                currentCoordX = coords.x,
                currentCoordY = coords.y;
            game.log("Coordinates before bindZoom", "(" + currentCoordX + "," + currentCoordY + ")");

            // Zoom In -------------------------------------------------------------------------------------------------
            if ($(this).hasClass("in")) {
                // check if we are zooming in from min zoom and enable zoom out button accordingly
                if ($zoom.find("span.active").next("span").length === 0) {
                    $(".icon.out").removeClass("disabled");
                }
                // check if there is a next zoomlevel and move class="active" one span forward
                if ($zoom.find("span.active").prev("span").length > 0) {
                    $zoom.find("span.active").removeClass("active")
                        .prev("span").addClass("active");
                }
                // check if we have arrived at max zoom and need to disable zoom in button
                if ($zoom.find("span.active").prev("span").length === 0 ) {
                    $(this).addClass("disabled");
                }
                galmap.tilesize = parseInt($zoom.find("span.active").text(),10);
                game.log("new tilesize", galmap.tilesize);
                galmap.drawMap(galmap.mapdata);
                galmap.focusMap(currentCoordX, currentCoordY);
                localStorage["galmap.zoomlevel"] = parseInt($zoom.find("span").length, 10) -
                    $zoom.find("span.active").index() - 1;
            }

            // Zoom Out ------------------------------------------------------------------------------------------------
            else if ($(this).hasClass("out")) {
                // check if we are zooming out from max zoom and enable zoom in button accordingly
                if ($zoom.find("span.active").prev("span").length === 0) {
                    $(".icon.in").removeClass("disabled");
                }
                // check if there is a prev zoomlevel and move class="active" one span backward
                if ($zoom.find("span.active").next("span").length > 0) {
                    $zoom.find("span.active").removeClass("active")
                        .next("span").addClass("active");
                }
                // check if we have arrived at max zoom and need to disable zoom in button
                if ($zoom.find("span.active").next("span").length === 0) {
                    $(this).addClass("disabled");
                }
                galmap.tilesize = parseInt($zoom.find("span.active").text(), 10);
                game.log("new tilesize", galmap.tilesize);
                galmap.drawMap(galmap.mapdata);
                galmap.focusMap(currentCoordX, currentCoordY);
                localStorage["galmap.zoomlevel"] = parseInt($zoom.find("span").length, 10) -
                    $zoom.find("span.active").index() - 1;
            }

        });

    }, // ==============================================================================================================

    // Get Coordinates from canvas position.left and position.top ======================================================
    // leftOffSet = [canvas].position().left; topOffSet = [canvas].position().top
    getCoordsFromOffset: function (leftOffSet, topOffSet) {

        var $galMapCanvas = $("#mapCanvas"),
            $viewport = $("#mapViewPort"),

            // number of squares from viewport left to center ----------------------------------------------------------
            coordsToViewPortCenter = Math.abs(
                ( ($viewport.width() / $galMapCanvas.width()) * galmap.mapdata.settings.size) / 2
            ),
            // number of squares of canvas scrolled to right -----------------------------------------------------------
            coordX = parseInt(
                (Math.ceil(
                    Math.abs(
                        (leftOffSet / $galMapCanvas.width()) * galmap.mapdata.settings.size
                    ) + coordsToViewPortCenter) - 1
                ), 10 // decimals for parsefloat
            ),
            // number of squares of canvas scrolled to bottom ----------------------------------------------------------
            coordY = parseInt(
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

        var $viewport = $("#mapViewPort"),
            fokusToX = Math.round($viewport.width() / 2), // half of stage
            fokusToY = Math.round($viewport.height() / 2),
            canvasX = Math.round(( (coordX + 1) * galmap.tilesize) - (galmap.tilesize / 2)),
            canvasY = Math.round(( (coordY + 1) * galmap.tilesize) - (galmap.tilesize / 2)),
            animateToX = fokusToX - canvasX,
            animateToY = fokusToY - canvasY;
        return {
            x: animateToX,
            y: animateToY
        };

    }, // ==============================================================================================================

    // Draw a single system ============================================================================================
    drawSystem: function (id) {

        var coordX = galmap.mapdata.systems[id].x,
            coordY = galmap.mapdata.systems[id].y,
            $galMapCanvas = $("#mapCanvas"),
            spriteSquarePixels = 64,
            // width of star sprite in stars.png. Compass assigns background-size via image-width, so we can use it here
            canvasX = (coordX * galmap.tilesize) + Math.round(galmap.tilesize / 2),
            canvasY = (coordY * galmap.tilesize) + Math.round(galmap.tilesize / 2),
            imageSquarePixel = Math.round((galmap.tilesize * 4) / 5);
            // ratio for pixelsize of images is 4/5 of tilesize. Make sure this scales correctly:

        game.log(
            "drawing system",
            " id: " + id + ", owner: " + galmap.mapdata.systems[id].owner + ", spectral: " +
            galmap.mapdata.systems[id].spectral + ", x: " + coordX + "(" + canvasX + "), y: " +
            coordY + "(" + canvasY + ")"
        );

        $galMapCanvas.drawImage({
            source          : $("#spriteStars").prop("src"),
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
            mouseover: function () { $galMapCanvas.css("cursor", "pointer"); },
            mouseout: function () { $(this).css("cursor", "move"); },
            click: function () {
                game.log( // this is temporary of course, pending further game specification
                    "clicked on star", "id: " + id + ", owner: " + galmap.mapdata.systems[id].owner +
                        ", spectral: " + galmap.mapdata.systems[id].spectral
                );
            }
        });

    }, // ==============================================================================================================

    // Draw a wormhole (connection between two systems) ================================================================
    // from and to are the IDs of the systems that are linked
    drawWormHole: function (from,to) {

        var wormHoleColor = "#9cf",
            fromX = (galmap.mapdata.systems[from].x * galmap.tilesize) + (galmap.tilesize / 2),
            fromY = (galmap.mapdata.systems[from].y * galmap.tilesize) + (galmap.tilesize / 2),
            toX = (galmap.mapdata.systems[to].x * galmap.tilesize) + (galmap.tilesize / 2),
            toY = (galmap.mapdata.systems[to].y * galmap.tilesize) + (galmap.tilesize / 2);
            strokeWidth = 1;
        if (galmap.tilesize > 50) { strokeWidth = 2; }

        game.log(
            "drawing wormhole",
            "from #" + from + " (" + fromX + "," + fromY + ") to #" + to + " (" + toX + "," + toY + ")"
        );

        $("#mapCanvas").drawLine({
            layer       : true,
            groups      : ["wormholes"],
            strokeStyle : wormHoleColor,
            strokeWidth : strokeWidth,
            x1          : fromX,
            y1          : fromY,
            x2          : toX,
            y2          : toY
        });

    } // ===============================================================================================================

};
//
galmap.init();
//
