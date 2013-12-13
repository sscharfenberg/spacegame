/* *********************************************************************************************************************
* GALMAP.JS
* contains Functions to draw the galactic map
* (c) 2013 Sven Scharfenberg | sven.scharfenberg@projektvier.de
*
* the canvas is always 3x width/height of viewport. this is needed for dragging:
* when dragging, we have one viewport to the left/right/top/bottom available so something is shown while dragging.
* on dragstop the canvas is redrawn at the correct position.
* this keeps the canvas small and the performance decent while dragging.
***********************************************************************************************************************/
//
// setup namespace =====================================================================================================
window.galmap = window.galmap || {

    // important namespaced vars =======================================================================================
    tileSize: 0,
    // size in pixels of a maptile. needed for pretty much everything.
    mapData: null,
    // the object that will later contain the JSON data; needed to redraw the map.
    cameraX: 0,
    cameraY: 0,
    // position of camera, offset to 0/0
    mapWidth: 0,
    mapHeight: 0,
    canvasWidth: 0,
    canvasHeight: 0,
    // map and canvas width. not really needed, but easier to track than having jquery calculate it all the time.

    // Initialize ======================================================================================================
    init: function () {

        // required feature testing ------------------------------------------------------------------------------------
        // later, we can add polyfills here
        if ((!Modernizr.canvas) || (!Modernizr.canvastext)) {
            alert("Sorry, your browser does not support canvas or canvastext. Please update your browser");
            window.location.href = "http://www.google.de/intl/de/chrome/browser/";
        }

        var $mapviewport = $("#mapViewPort"),
            $rulervertviewport = $("#viewPortRulerVert");

        // adjust height of map and vertical ruler to the same value as map width --------------------------------------
        // width has correct value from css, we can't do that with height (flexbox to the rescue! in 2015 maybe.)
        // we need to assign the height twice because of a jQuery glitch (first .width() gives wrong value)
        $mapviewport.height($mapviewport.width()).height($mapviewport.width());
        $rulervertviewport.height($mapviewport.height());

        // load data from JSON -----------------------------------------------------------------------------------------
        // TODO: temporary value, needs to by dynamic for non-tests
        var mapdata = galmap.loadData("./mapdata.json");

        // and start drawing the map -----------------------------------------------------------------------------------
        mapdata.done(function (data) { // once the JSON promise is fulfilled, this function gets executed --------------
            utils.log("Data recieved from JSON", data);
            galmap.mapData = data; // save JSON data in namespaced global object
            galmap.setInitialZoom(); // get initial zoom from localstorage and prepare DOM properties
            galmap.drawMap(data); // draw map
            galmap.bindMapDragging(); // bind map dragging
            galmap.bindZoom(); // bind zoom buttons +/-
            $(".overlay.loading").hide(); // hide overlay
            $(document).on("click",".mapbutton.focushome", function (event) {
                event.preventDefault();
                galmap.focusMap(
                    galmap.mapData.systems[galmap.mapData.player.home].x,
                    galmap.mapData.systems[galmap.mapData.player.home].y
                );
            });
        }).fail(function (error) {
            utils.log("faled to recieve data from JSON", error);
            $(".overlay.jsonfail").show(); // show loading overlay
        });

    }, // ==============================================================================================================

    // load JSON map data ==============================================================================================
    loadData: function (jsonURL) {

        $(".overlay.loading").show();
        return $.getJSON(jsonURL); // async JSON call; returning the promise \O/

    }, // ==============================================================================================================

    // Get zoom level from localStorage and prepare tilesize accordingly ===============================================
    setInitialZoom: function () {

        var $currentZoom = $("#currentZoomMarker"),
            currentIndex;
        // get zoom level from localStorage ----------------------------------------------------------------------------
        if (Modernizr.localstorage) {
            if (localStorage["galmap.zoomlevel"]) {
                currentIndex = parseInt($currentZoom.find("span").length, 10) -
                    parseInt(localStorage["galmap.zoomlevel"], 10) - 1;
            } else {
                // localstorage supported, but galmap.zoomlevel not set. use middle assign localstorage
                currentIndex = Math.ceil(parseInt($currentZoom.find("span").length - 1, 10) / 2);
                localStorage["galmap.zoomlevel"] = currentIndex;
            }
        } else { // if no localStorage, simply use the middle (sorry dude)
            currentIndex = Math.ceil(parseInt($currentZoom.find("span").length - 1, 10) / 2);
        }

        // get tilesize from the <span class="active"> -----------------------------------------------------------------
        galmap.tileSize = parseInt($currentZoom.find("span").eq(currentIndex).addClass("active").text(), 10);
        // disable buttons if we are at max or min zoom ----------------------------------------------------------------
        if ($currentZoom.find("span:first").hasClass("active")) { $(".icon.in").addClass("disabled"); }
        if ($currentZoom.find("span:last").hasClass("active")) { $(".icon.out").addClass("disabled"); }

    }, // ==============================================================================================================

    // Draw Map Main Function ==========================================================================================
    // map is the JSON object, to ensure closure of function
    drawMap: function (map) {

        var numSystemsDrawn = 0;
        utils.log("============ START DRAWING MAP ============");
        galmap.prepareStages(map);

        // draw grid ---------------------------------------------------------------------------------------------------
        galmap.drawGrid(map, galmap.cameraX, galmap.cameraY);

        // draw rulers with coordinates --------------------------------------------------------------------------------
        galmap.drawRulers(map, galmap.cameraX, galmap.cameraY);

        // draw all wormholes from JSON --------------------------------------------------------------------------------
        for (var j = 0; j < map.wormholes.length; j++) {
            galmap.drawWormHole(map.wormholes[j].id);
        }
        utils.log("number of wormholes: " + map.wormholes.length);

        // draw all planets from JSON (only visible ones) --------------------------------------------------------------
        for (var i = 0; i < map.systems.length; i++) {
            if (galmap.drawSystem(map.systems[i].id)) { numSystemsDrawn++; }
        }
        utils.log("number of systems: " + map.systems.length + ". Drawn on canvas: " + numSystemsDrawn);

        utils.log("========== FINISHED DRAWING MAP ===========");

    }, // ==============================================================================================================

    // Set up map - correct width/height, offset =======================================================================
    // assign namespaced variables, width/height, clear canvas, move canvas position (for dragging)
    prepareStages: function (map) {

        var $galMapCanvas = $("#mapCanvas"),
            $viewPort = $("#mapViewPort");

        galmap.mapWidth = parseInt(galmap.tileSize * map.settings.size.width, 10);
        galmap.mapHeight = parseInt(galmap.tileSize * map.settings.size.height, 10);
        galmap.canvasWidth = parseInt($viewPort.width() * 3, 10);
        galmap.canvasHeight = parseInt($viewPort.height() * 3, 10);
        // canvas is always three times the size of viewport. this is so we have enough space to drag
        // one viewport width in all directions
        utils.log("Size of map - width:" + galmap.mapWidth + " - height:" + galmap.mapHeight);
        utils.log("Size of canvas - width:" + galmap.canvasWidth + " - height:" + galmap.canvasHeight);

        // if this is the initial draw, try and get camera position from localstorage ----------------------------------
        if ((Modernizr.localstorage) && (localStorage["galmap.camera.x"]) && (localStorage["galmap.camera.y"]) &&
            (galmap.cameraX === 0) && (galmap.cameraY === 0)) {
            galmap.cameraX = Math.abs(parseInt(localStorage["galmap.camera.x"], 10));
            galmap.cameraY = Math.abs(parseInt(localStorage["galmap.camera.y"], 10));
        }
        utils.log("Current camera position - x:" + galmap.cameraX + ", y:" + galmap.cameraY);

        // prepare canvas with correct width and height (html has default) ---------------------------------------------
        $galMapCanvas.prop({ width: galmap.canvasWidth, height: galmap.canvasHeight });

        // clear stage (we need this for redrawing) --------------------------------------------------------------------
        $galMapCanvas.clearCanvas({
            x: 0, y: 0, width: galmap.canvasWidth, height: galmap.canvasHeight
        }).removeLayers();

        // now move the canvas to the correct viewport -----------------------------------------------------------------
        // the correct viewport has the canvas centered in the middle.
        $galMapCanvas.css({
            left: -parseInt($viewPort.width(), 10),
            top: -parseInt($viewPort.height(), 10)
        });

        // same for horizontal and vertical ruler ----------------------------------------------------------------------
        // prop instead of width() so we don't scale but enlarge
        $("#rulerHorzCanvas").prop({ width: galmap.canvasWidth }).css("left", -parseInt($viewPort.width(), 10));
        $("#rulerVertCanvas").prop({ height: galmap.canvasHeight }).css("top", -parseInt($viewPort.width(), 10));

    }, // ==============================================================================================================

    // Draw a background grid to make coordinates more accessible ======================================================
    drawGrid: function (map, cameraX, cameraY) {

        var i, numVertLines = 0, numHorzLines = 0,
            $galMapCanvas = $("#mapCanvas"),
            $viewPort = $("#mapViewPort"),
            gridColor = "#000", strokeWidth = 2;
        if (galmap.tileSize < 50) { strokeWidth = 1; } // smaller grid for small tilesizes
        for (i = 0; i < map.settings.size.width + 1; i++) {
            // draw a vertical line ------------------------------------------------------------------------------------
            var x = galmap.tileSize * i + parseInt($viewPort.width() - cameraX, 10),
                y1 = parseInt($viewPort.height() - cameraY, 10),
                y2 = parseInt($viewPort.height() - cameraY + (galmap.mapHeight), 10);
            if (y1 < 0) { y1 = 0; }
            if (y2 > galmap.canvasHeight) { y2 = galmap.canvasHeight; }
            if ( (x < galmap.canvasWidth) && (x >= 0) ) { // only draw line if within canvas.
                numVertLines++;
                $galMapCanvas.drawLine({
                    layer: true, groups: ["grid"], name: "gridlinevert-" + i, strokeStyle: gridColor,
                    strokeWidth: strokeWidth, x1: x, y1: y1, x2: x, y2: y2, fromCenter: false
                });
            }
        }

        for (i = 0; i < map.settings.size.height + 1; i++) {
            // draw a horizontal line ----------------------------------------------------------------------------------
            var y = galmap.tileSize * i + parseInt($viewPort.width() - cameraY, 10),
                x1 = parseInt($viewPort.width() - cameraX, 10),
                x2 = parseInt($viewPort.width() - cameraX + (map.settings.size.width * galmap.tileSize), 10);
            if (x1 < 0) { x1 = 0; }
            if (x2 > galmap.canvasWidth) { x2 = galmap.canvasWidth; }
            if ((y < galmap.canvasHeight) && (y >= 0)) { // only draw line if within canvas.
                numHorzLines++;
                $galMapCanvas.drawLine({
                    layer: true, groups: ["grid"], name: "gridlinehorz-" + i, strokeStyle: gridColor,
                    strokeWidth: strokeWidth, x1: x1, y1: y, x2: x2, y2: y, fromCenter: false
                });
            }
        }

        utils.log("finished drawing grid with " + numVertLines + " vertical and " +
            numHorzLines + " horizontal lines");

    }, // ==============================================================================================================

    // drawRulers: draw the horizontal and vertical rulers =============================================================
    drawRulers: function (map, cameraX, cameraY) {

        var $horzCanvas = $("#rulerHorzCanvas"),
            $vertCanvas = $("#rulerVertCanvas"),
            $mapViewPort = $("#mapViewPort"),
            textColor = "#fff",
            gridColor = "#000",
            fontSize = 12,
            fontFamily = "Arial",
            strokeWidth = 2,
            numCoordsHorz = 0, // counting
            numCoordsVert = 0,
            coordText, i, x, y;
        if (galmap.tileSize < 50) { strokeWidth = 1; fontSize = 11; }
        if (galmap.tileSize < 35) { fontSize = 10; }

            // horizontal ruler (with vertical lines) ----------------------------------------------------------------------
        for (i = 0; i < map.settings.size.width; i++) {
            coordText = i.toString();
            // draw a vertical line ------------------------------------------------------------------------------------
            if  ((galmap.tileSize * i) - cameraX < $horzCanvas.width()) {
                numCoordsHorz++;
                x = (galmap.tileSize * i) + parseInt($mapViewPort.width(),10) - cameraX;
                $horzCanvas.drawText({
                    fontSize    : fontSize,
                    fontFamily  : fontFamily,
                    fillStyle   : textColor,
                    x           : x + Math.round(galmap.tileSize / 2),
                    y           : 12,
                    text        : coordText
                }).drawLine({
                    strokeStyle : gridColor,
                    strokeWidth : strokeWidth,
                    x1          : x + galmap.tileSize,
                    y1          : 0,
                    x2          : x + galmap.tileSize,
                    y2          : $horzCanvas.height()
                });
            }
        }
        utils.log("finished drawing horizontal ruler with " + numCoordsHorz + " coordinates.");

        // vertical ruler (with horizontal lines) ----------------------------------------------------------------------
        for (i = 0; i < map.settings.size.height; i++) {
            coordText = i.toString();
            // draw a horizontal line ----------------------------------------------------------------------------------
            if ((galmap.tileSize * i) - cameraY < $vertCanvas.height()) {
                numCoordsVert++;
                y = (galmap.tileSize * i) + parseInt($mapViewPort.height(), 10) - cameraY;
                $vertCanvas.drawText({
                    fontSize    : fontSize,
                    fontFamily  : fontFamily,
                    fillStyle   : textColor,
                    x           : 12,
                    y           : y + Math.round(galmap.tileSize / 2),
                    text        : coordText
                }).drawLine({
                    strokeStyle : gridColor,
                    strokeWidth : strokeWidth,
                    x1          : 0,
                    y1          : y + galmap.tileSize,
                    x2          : $vertCanvas.height(),
                    y2          : y + galmap.tileSize
                });
            }
        }
        utils.log("finished drawing vertical ruler with " + numCoordsVert + " coordinates.");

    }, // ==============================================================================================================

    // Make the map draggable ==========================================================================================
    // when the map is dragged, the rulers need the be moved accordingly
    // check for collision with edges
    // TODO: make garbage collection trigger while dragging, not at drag stop. (yeah, right - how?)
    bindMapDragging: function () { // not 100% for small zoom levels

        var $galMapCanvas = $("#mapCanvas"),
            $viewPort = $("#mapViewPort");

        $galMapCanvas.drag(function (event, dd) {

            var maxDragLeft, maxDragRight, maxDragTop, maxDragBottom;
            // Find out the maximum amount that we can drag
            maxDragLeft = -(parseInt($viewPort.width(), 10) - galmap.cameraX);
            maxDragTop = -(parseInt($viewPort.height(), 10) - galmap.cameraY);
            maxDragRight = -(galmap.mapWidth - galmap.cameraX);
            maxDragBottom = -(galmap.mapHeight - galmap.cameraY);



            if (galmap.mapHeight < $viewPort.height()) {
                maxDragBottom = -(parseInt($viewPort.height(), 10) - galmap.cameraY);
            }
            if (galmap.mapWidth < $viewPort.width()) {
                maxDragRight= -(parseInt($viewPort.width(), 10) - galmap.cameraX);
            }

            if (dd.offsetX > maxDragLeft) { // check left edge
                dd.offsetX = maxDragLeft;
                $viewPort.addClass("tiltLeft");
            } else { $viewPort.removeClass("tiltLeft"); }

            if (dd.offsetY > maxDragTop) { // check top edge
                dd.offsetY = maxDragTop;
                $viewPort.addClass("tiltTop");
            } else { $viewPort.removeClass("tiltTop"); }

            if (dd.offsetX < maxDragRight) { // check right edge
                dd.offsetX = maxDragRight;
                $viewPort.addClass("tiltRight");
            } else { $viewPort.removeClass("tiltRight"); }

            if (dd.offsetY < maxDragBottom) { // check bottom edge
                dd.offsetY = maxDragBottom;
                $viewPort.addClass("tiltBottom");
            } else { $viewPort.removeClass("tiltBottom"); }

            $(this).css({ top: dd.offsetY, left: dd.offsetX }); // set new canvas position
            $("#rulerHorzCanvas").css("left", dd.offsetX);
            $("#rulerVertCanvas").css("top", dd.offsetY);

        }).drag("end", function () {

            $viewPort.removeClass("tiltBottom tiltLeft tiltRight tiltTop");

            var draggedX = Math.abs(parseInt($galMapCanvas.css("left"), 10)) - parseInt($viewPort.width(), 10);
            var draggedY = Math.abs(parseInt($galMapCanvas.css("top"), 10)) - parseInt($viewPort.width(), 10);
            utils.log("dragged map by .. x:" + draggedX + ", y:" + draggedY);

            // add the dragged amount to cameraX and cameraY
            galmap.setCamera(galmap.cameraX + draggedX, galmap.cameraY + draggedY);

            // redraw map. this is important so we keep the canvas small-ish and performance decent
            galmap.drawMap(galmap.mapData);

        }, { relative: true });

    }, // ==============================================================================================================

    // bind zoom buttons ===============================================================================================
    bindZoom: function () {

        $(document).on("click", ".zoom a.icon", function (event) {

            event.preventDefault();
            var $zoom = $("#currentZoomMarker");

            // Zoom In -------------------------------------------------------------------------------------------------
            if ( ($(this).hasClass("in")) && (!$(this).hasClass("disabled")) ) {
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
                if ($zoom.find("span.active").prev("span").length === 0) {
                    $(this).addClass("disabled");
                }
                galmap.doZoom(galmap.tileSize, parseInt($zoom.find("span.active").text(), 10));
            }

            // Zoom Out ------------------------------------------------------------------------------------------------
            if (($(this).hasClass("out")) && (!$(this).hasClass("disabled"))) {
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
                galmap.doZoom(galmap.tileSize, parseInt($zoom.find("span.active").text(), 10));
            }

        });

    }, // ==============================================================================================================

    // Zoom: prepare new zoomlevel and camera, then redraw =============================================================
    doZoom: function (oldTileSize, newTileSize) {

        var $zoom = $("#currentZoomMarker"),
            coords, coordX, coordY;

        // find out on which coords we are currently focussed.
        coords = galmap.convertCameraToCenteredCoords(galmap.cameraX, galmap.cameraY, oldTileSize);
        coordX = coords.x;
        coordY = coords.y;
        utils.log("center coordinates before zoom .. x:" + coordX + ", y:" + coordY);

        // get new camera
        var newCamera = galmap.convertCenteredCoordsToCamera(coordX,coordY,newTileSize),
            newCameraX = newCamera.x,
            newCameraY = newCamera.y;

        utils.log("changing camera for zoom to x:"+ newCameraX + ", y:"+newCameraY);

        // change namespaced vars --------------------------------------------------------------------------------------
        galmap.cameraX = newCameraX;
        galmap.cameraY = newCameraY;
        galmap.tileSize = newTileSize;

        // save zoom level and coords to localstorage ------------------------------------------------------------------
        if (Modernizr.localstorage) {
            var zoomLevel = parseInt($zoom.find("span").length, 10) -
                parseInt($zoom.find("span.active").index(), 10) - 1;
            utils.log("saving to localStorage .. zoom:" + zoomLevel + ", x:" + newCameraX + ", y:" + newCameraY);
            localStorage["galmap.zoomlevel"] = zoomLevel;
            localStorage["galmap.camera.x"] = newCameraX;
            localStorage["galmap.camera.y"] = newCameraY;
        } else {
            utils.log("localStorage not supported, saving to namespaced vars only. change will not persist on refresh.");
        }

        galmap.drawMap(galmap.mapData);

    }, // ==============================================================================================================

    // Draw a single system ============================================================================================
    drawSystem: function (id) {

        var $galMapCanvas = $("#mapCanvas"),
            tickerTextSize = "10pt",
            tickerTextColor = "#fff",
            standingsRadius = 6;
        if (galmap.tileSize >= 80) { standingsRadius = 10; }
        if ((galmap.tileSize >= 65) && (galmap.tileSize < 80)) { standingsRadius = 8; }
        if ((galmap.tileSize >= 50) && (galmap.tileSize < 65)) { tickerTextSize = "9pt"; }
        if ((galmap.tileSize >= 35) && (galmap.tileSize < 50)) { tickerTextSize = "7pt"; standingsRadius = 5; }
        if ((galmap.tileSize >= 20) && (galmap.tileSize < 35)) { tickerTextSize = "6pt"; standingsRadius = 3; }

        var currentSystem = new galmap.System (id);

        if (currentSystem.draw) { // if not ouside map/canvas, draw system image ---------------------------------------

            var gradient, gradientColor;

            $galMapCanvas.drawImage({
                source          : $("#spriteStars").prop("src"),
                sWidth          : currentSystem.spritepixels, // width of cropped sprite
                sHeight         : currentSystem.spritepixels, // height of cropped sprite
                sx              : 0,
                sy              : (galmap.mapData.systems[id].spectral * currentSystem.spritepixels),
                cropFromCenter  : false,
                layer           : true,
                clickable       : true,
                name            : "system-" + id + "-star",
                groups          : ["systems", "system-" + id],
                x               : currentSystem.x,
                y               : currentSystem.y,
                width           : currentSystem.imagepixels,
                height          : currentSystem.imagepixels,
                fromCenter      : true,
                mouseover       : function () { $galMapCanvas.css("cursor", "pointer"); },
                mouseout        : function () { $(this).css("cursor", "move"); },
                mousedown       : function () {
                    event.stopImmediatePropagation(); // don't propagate drag event immediately
                    utils.log( // this is temporary of course, pending further game specification
                        "clicked on star - id: " + id + ", owner: [" + currentSystem.ownerticker + "]" +
                        ", spectral: " + galmap.mapData.systems[id].spectral
                    );
                }
            });

            gradientColor = utils.getStandingsColor(currentSystem.standing);

            // Standings indicator: circle with color (radial gradient) ------------------------------------------------
            gradient = $galMapCanvas.createGradient({
                x1              : currentSystem.x + Math.round(galmap.tileSize / 2.7),
                y1              : currentSystem.y + Math.round(galmap.tileSize / 2.7),
                x2              : currentSystem.x + Math.round(galmap.tileSize / 2.7),
                y2              : currentSystem.y + Math.round(galmap.tileSize / 2.7),
                r1              : standingsRadius / 5,
                r2              : standingsRadius,
                c1              : gradientColor,
                c2              : "#000"
            });
            $galMapCanvas.drawArc({
                layer           : true,
                name            : "system-" + id + "-standing",
                groups          : ["systems", "system-" + id],
                fillStyle       : gradient,
                x               : currentSystem.x + Math.round(galmap.tileSize / 2.7),
                y               : currentSystem.y + Math.round(galmap.tileSize / 2.7),
                radius          : standingsRadius,
                shadowColor     : "#000",
                shadowBlur      : standingsRadius / 2
            });

            if (currentSystem.ownerid !== 0) { // draw owner text if not unclaimed -------------------------------------
                $galMapCanvas.drawText({
                    layer       : true,
                    name        : "system-" + id + "-owner",
                    groups      : ["systems", "system-" + id],
                    fontSize    : tickerTextSize,
                    fontFamily  : "Arial",
                    fillStyle   : tickerTextColor,
                    x           : currentSystem.x,
                    y           : currentSystem.y - Math.round(galmap.tileSize / 2) + parseInt(tickerTextSize, 10) / 2,
                    text        : currentSystem.ownerticker,
                    shadowColor : "#fff",
                    shadowBlur  : (parseInt(tickerTextSize, 10) / 3),
                    mouseover   : function () { $galMapCanvas.css("cursor", "pointer"); },
                    mouseout    : function () { $(this).css("cursor", "move"); },
                    mousedown   : function () {
                        event.stopImmediatePropagation(); // don't propagate drag event immediately
                        utils.log( // this is temporary of course, pending further game specification
                            "clicked on star owner - id: " + currentSystem.ownerid + ", owner: [" +
                            currentSystem.ownerticker + "] " + currentSystem.ownername
                        );
                    }
                });
            }

            if (utils.VERBOSE) {
                utils.log(
                    "drawing system - id: " + id + ", owner: " + currentSystem.ownerticker + ", spectral: " +
                        galmap.mapData.systems[id].spectral + ", x: " + currentSystem.coordy + "(" + currentSystem.x +
                        "), y: " + currentSystem.coordx + "(" + currentSystem.y + ")"
                );
            }

        }

        return currentSystem.draw;

    }, // ==============================================================================================================

    // Constructor function for System object ==========================================================================
    // here we find the correct coordinates, if the system is within the visible scope and other details
    System: function (id) {

        var $viewPort = $("#mapViewPort"),
            worldX = (galmap.mapData.systems[id].x * galmap.tileSize) + Math.round(galmap.tileSize / 2),
            worldY = (galmap.mapData.systems[id].y * galmap.tileSize) + Math.round(galmap.tileSize / 2),
            screen = galmap.convertWorldToScreen(worldX, worldY);
        this.coordx = galmap.mapData.systems[id].x; // coords of system
        this.coordy = galmap.mapData.systems[id].y;
        this.x = screen.x; // screen pixels
        this.y = screen.y;
        this.draw = true;

        // visibility check; if x/y are outside of map or canvas, don't draw -------------------------------------------
        if ((this.x < 0) || (this.y < 0) || (this.y > galmap.canvasHeight) || (this.x > galmap.canvasWidth)) {
            this.draw = false;
        }
        if ((this.x > (galmap.mapWidth + $viewPort.width())) || (this.y > (galmap.mapHeight + $viewPort.height()))) {
            this.draw = false;
        }

        this.spritepixels = 64; // width of sprite-image
        // ratio for pixelsize of images is 4/5 of tilesize. Make sure this scales correctly
        this.imagepixels = Math.round((galmap.tileSize * 4) / 5); // scaled size that is rendered

        // get owner details -------------------------------------------------------------------------------------------
        for (var i = 0; i < galmap.mapData.empires.length; i++) {
            if (galmap.mapData.empires[i].id === galmap.mapData.systems[id].owner) {
                this.ownerid = galmap.mapData.empires[i].id;
                this.ownerticker = galmap.mapData.empires[i].ticker;
                this.ownername = galmap.mapData.empires[i].name;
                this.standing = galmap.mapData.empires[i].standing;
            }
        }

    }, // ==============================================================================================================

    // Draw a single wormhole ==========================================================================================
    drawWormHole: function (id) {

        var strokeWidth = 2, wormHoleColor = "#6e93b8", pointRadius;
        // adjust size of arrows and lines for different zoom levels. this is only an approximation, not really exact.
        if (galmap.tileSize >= 20) { strokeWidth = 1; pointRadius = 2; }
        if (galmap.tileSize >= 35) { strokeWidth = 1; pointRadius = 2.5; }
        if (galmap.tileSize >= 50) { strokeWidth = 3; pointRadius = 4; }
        if (galmap.tileSize >= 65) { strokeWidth = 4; pointRadius = 5; }
        if (galmap.tileSize >= 80) { strokeWidth = 5; pointRadius = 6; }

        var currentWormHole = new galmap.WormHole(id);

        $("#mapCanvas").drawLine({ // start with the line connecting the two systems
            layer       : true,
            rounded     : true,
            name        : "wormhole-" + id,
            groups      : ["wormholes", "wormhole-" + id],
            strokeStyle : wormHoleColor,
            strokeWidth : strokeWidth,
            x1          : currentWormHole.startx,
            y1          : currentWormHole.starty,
            x2          : currentWormHole.endx,
            y2          : currentWormHole.endy
        }).drawArc({ // draw circle at the beginning of the wormhole
            layer       : true,
            rounded     : true,
            name        : "wormhole-" + id + "-startarc",
            groups      : ["wormholes", "wormhole-" + id],
            fillStyle   : wormHoleColor,
            x           : currentWormHole.startx,
            y           : currentWormHole.starty,
            radius      : pointRadius
        }).drawArc({ // draw circle at the end of the wormhole
            layer       : true,
            rounded     : true,
            name        : "wormhole-" + id + "-endarc",
            groups      : ["wormholes", "wormhole-" + id],
            fillStyle   : wormHoleColor,
            x           : currentWormHole.endx,
            y           : currentWormHole.endy,
            radius      : pointRadius
        });

        if (utils.VERBOSE) {
            utils.log(
                "drawing wormhole #" + id + " from #" + currentWormHole.from + " (" +
                    currentWormHole.startcoordx + "," + currentWormHole.startcoordy + ") to #" + currentWormHole.to +
                    " (" + currentWormHole.endcoordx + "," + currentWormHole.endcoordy + ")"
            );
        }

    }, // ==============================================================================================================

    // Constructor function for wormhole object ========================================================================
    // lots of maths for the start/end point at a distance from the star in the correct direction.
    WormHole: function(id) {

        this.from = galmap.mapData.wormholes[id].from;
        this.to = galmap.mapData.wormholes[id].to;

        // get the point in the middle of the tile (origin of planet circle) -------------------------------------------
        fromCenterX = (galmap.mapData.systems[this.from].x * galmap.tileSize) + Math.round(galmap.tileSize / 2);
        fromCenterY = (galmap.mapData.systems[this.from].y * galmap.tileSize) + Math.round(galmap.tileSize / 2);
        toCenterX = (galmap.mapData.systems[this.to].x * galmap.tileSize) + Math.round(galmap.tileSize / 2);
        toCenterY = (galmap.mapData.systems[this.to].y * galmap.tileSize) + Math.round(galmap.tileSize / 2);

        // get the angle of the line between the two systems -----------------------------------------------------------
        deltaY = toCenterY - fromCenterY;
        deltaX = toCenterX - fromCenterX;
        theta = Math.atan2(deltaY, deltaX) * 180 / Math.PI; // angle in degrees

        // get the radius of the planets circle. -----------------------------------------------------------------------
        distanceFromCenter = Math.round(galmap.tileSize / 2); // = radius.

        // now find the coordinates of the point on the circle. --------------------------------------------------------
        // these coordinates are relative to the circles
        // center, so we need to add (start) and substract (end) the position of the circle center
        worldStartX = parseInt(Math.cos(theta * Math.PI / 180) * distanceFromCenter, 10) + fromCenterX;
        worldStartY = parseInt(Math.sin(theta * Math.PI / 180) * distanceFromCenter, 10) + fromCenterY;
        worldEndX = toCenterX - parseInt(Math.cos(theta * Math.PI / 180) * distanceFromCenter, 10);
        worldEndY = toCenterY - parseInt(Math.sin(theta * Math.PI / 180) * distanceFromCenter, 10);

        this.startcoordx = galmap.mapData.systems[this.from].x; // coords of start system
        this.startcoordy = galmap.mapData.systems[this.from].y;
        screenStart = galmap.convertWorldToScreen(worldStartX, worldStartY);
        this.startx = screenStart.x; // screen pixels of start system
        this.starty = screenStart.y;
        this.endcoordx = galmap.mapData.systems[this.to].x; // coords of end system
        this.endcoordy = galmap.mapData.systems[this.to].y;
        screenEnd = galmap.convertWorldToScreen(worldEndX, worldEndY);
        this.endx = screenEnd.x; // screen pixels of start system
        this.endy = screenEnd.y;

    }, // ==============================================================================================================

    // focus the map on a specific tile and flash this tile ============================================================
    focusMap: function (coordX, coordY) {

        // find the new camera position for redrawing the map ----------------------------------------------------------
        var $galMapCanvas = $("#mapCanvas"),
            $viewPort = $("#mapViewPort"),
            fillStyle = "#153b61",
            centerCoord = $viewPort.width() / galmap.tileSize / 2,
            coordsOffScreenX = coordX - centerCoord,
            coordsOffScreenY = coordY - centerCoord,
            cameraX = parseInt(coordsOffScreenX * galmap.tileSize, 10) + Math.round(galmap.tileSize / 2),
            cameraY = parseInt(coordsOffScreenY * galmap.tileSize, 10) + Math.round(galmap.tileSize / 2);
        if (cameraX > (galmap.mapWidth - $viewPort.width())) { cameraX = galmap.mapWidth - $viewPort.width(); }
        if (cameraY > (galmap.mapHeight - $viewPort.height())) { cameraY = galmap.mapHeight - $viewPort.height(); }

        galmap.setCamera(cameraX, cameraY);
        utils.log("center map on " + coordX + "(" + cameraX + "), " + coordY + "(" + cameraY + ")");
        galmap.drawMap(galmap.mapData);


        $galMapCanvas.stopLayerGroup("flashbg").removeLayerGroup("flashbg")
        .drawRect({ // top
            fillStyle: fillStyle, layer: true, groups: ["flashbg"], fromCenter: false,
            x: (coordX * galmap.tileSize) - galmap.cameraX + $viewPort.width() + 1, y: 0,
            width: galmap.tileSize - 2,
            height: (coordY * galmap.tileSize) - galmap.cameraY + $viewPort.height() - 1
        }).drawRect({ // right
            fillStyle: fillStyle, layer: true, groups: ["flashbg"], fromCenter: false,
            x: ((coordX + 1) * galmap.tileSize) - galmap.cameraX + $viewPort.width() + 1,
            y: (coordY * galmap.tileSize) - galmap.cameraY + $viewPort.height() + 1,
            width: ($viewPort.width() * 2),
            height: galmap.tileSize - 2
        }).drawRect({ // bottom
            fillStyle: fillStyle, layer: true, groups: ["flashbg"], fromCenter: false,
            x: (coordX * galmap.tileSize) - galmap.cameraX + $viewPort.width() + 1,
            y: ((coordY + 1) * galmap.tileSize) - galmap.cameraY + $viewPort.height() + 1,
            width: galmap.tileSize - 2,
            height: ($viewPort.width() * 2)
        }).drawRect({ // left
            fillStyle: fillStyle, layer: true, groups: ["flashbg"], fromCenter: false,
            x: 0, y: (coordY * galmap.tileSize) - galmap.cameraY + $viewPort.height() + 1,
            width: (coordX * galmap.tileSize) - galmap.cameraX + $viewPort.width() - 1,
            height: galmap.tileSize - 2
        });
        // animate the layergroup --------------------------------------------------------------------------------------
        $galMapCanvas.animateLayerGroup("flashbg", { // flashbg animates background to transparent
                fillStyle: "transparent"
            }, 2000, "swing",
            function () {
                $galMapCanvas.removeLayerGroup("flashbg"); // remove layer again when done
            }
        ).drawLayers();



    }, // ==============================================================================================================

    // Save current offset to namespaced vars and localstorage =========================================================
    // cameraX, cameraY are the new offset of the map to the last position.
    setCamera: function (cameraX, cameraY) {

        // add the new offset to current camera position, this becomes the new camera position.
        galmap.cameraX = cameraX;
        galmap.cameraY = cameraY;

        // reset to zero if negative. camera coords are by definition positive
        if (galmap.cameraX < 0) { galmap.cameraX = 0; }
        if (galmap.cameraY < 0) { galmap.cameraY = 0; }

        if (Modernizr.localstorage) {
            localStorage["galmap.camera.x"] = galmap.cameraX;
            localStorage["galmap.camera.y"] = galmap.cameraY;
            utils.log("saved new map offset to localstorage - x:" + galmap.cameraX + ", y:" + galmap.cameraY);
        } else {
            utils.log("localStorage not supported, saving to namespaced vars only. change will not persist on refresh.");
        }

    }, // ==============================================================================================================

    // convert center coordinates to camera offset =====================================================================
    convertCenteredCoordsToCamera: function (coordX, coordY, tileSize) {

        var $viewPort = $("#mapViewPort"),
            centerCoord = $viewPort.width() / tileSize / 2,
            coordsOffScreenX = coordX - centerCoord,
            coordsOffScreenY = coordY - centerCoord,
            cameraX = parseInt(coordsOffScreenX * tileSize, 10),
            cameraY = parseInt(coordsOffScreenY * tileSize, 10);

        // check if we would have empty space below or to right of map -------------------------------------------------
        if (tileSize * galmap.mapData.settings.size.width < (cameraX + $viewPort.width()) ) {
            cameraX = parseInt(tileSize * galmap.mapData.settings.size.width - $viewPort.width(), 10);
        }
        if (tileSize * galmap.mapData.settings.size.height < (cameraY + $viewPort.height())) {
            cameraY = parseInt(tileSize * galmap.mapData.settings.size.height - $viewPort.height(), 10);
        }

        // make sure we don't get negative numbers (negative camera => outside of map)
        if (cameraX < 0) { cameraX = 0; }
        if (cameraY < 0) { cameraY = 0; }

        return {
            x: cameraX,
            y: cameraY
        };

    }, // ==============================================================================================================

    // convert camera offset to centerted coordinates ==================================================================
    convertCameraToCenteredCoords: function (cameraX, cameraY, tileSize) {

        var $viewPort = $("#mapViewPort");
        return {
            x: (cameraX / tileSize) + $viewPort.width() / (tileSize * 2),
            y: (cameraY / tileSize) + $viewPort.width() / (tileSize * 2)
        };

    }, // ==============================================================================================================

    // convert World Pixel Coordinates to correct screen pixels ========================================================
    // returns x,y,
    convertWorldToScreen: function (worldX, worldY) {

        var $viewPort = $("#mapViewPort");
        return {
            x: worldX + $viewPort.width() - galmap.cameraX,
            y: worldY + $viewPort.height() - galmap.cameraY
        };

    } // ===============================================================================================================

};
//
galmap.init();
//
