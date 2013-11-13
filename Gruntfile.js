module.exports = function (grunt) {

    grunt.initConfig({

        pkg: grunt.file.readJSON("package.json"),                   // read package file

        // Watch Files and trigger tasks ===============================================================================
        watch: {
            scripts: {
                files                   : "public/javascripts/*.src.js",
                tasks                   : ["jshint", "min", "usebanner:js"],
                options: {
                    spawn               : true
                }
            },
            css: {
                files                   : "**/*.scss",
                tasks                   : ["compass:dev", "usebanner:css"],
                options: {
                    spawn               : true
                }
            }
        },

        // YUI Compressor ==============================================================================================
        min: {
            "build": {
                // Grunt will search for "*.src.js" under "public/javascript/" when the "min" task
                // runs and build the appropriate src-dest file mappings then, so you
                // don't need to update the Gruntfile when files are added or removed.
                files: [
                    {
                        expand          : true,                     // Enable dynamic expansion.
                        cwd             : "public/javascripts/",    // Src matches are relative to this path.
                        dest            : "public/javascripts/",    // Destination path prefix.
                        src             : ["**/*.src.js"],          // Actual pattern(s) to match.
                        ext             : ".min.js"                 // Dest filepaths will have this extension.
                    }
                ]
            }
        },

        // Compass =====================================================================================================
        compass: {
            options: {
                httpPath                : "/",
                cssDir                  : "public/css",
                sassDir                 : "public/scss",
                imagesDir               : "public/images",
                javascriptsDir          : "public/javascripts",
                fontsDir                : "public/fonts",
                relativeAssets          : true,
                trace                   : true,
                force                   : true
            },
            dev: {
                options: {
                    environment         : "development",
                    outputStyle         : "expanded",
                    noLineComments      : false
                }
            },
            prod: {
                options: {
                    environment         : "production",
                    outputStyle         : "compressed",
                    noLineComments      : true
                }
            }
        },

        // JSHint Javascript testing ===================================================================================
        jshint: {
            files: [
                "Gruntfile.js",
                "public/javascripts/*.src.js"
            ],
            options: {
                latedef                 : true, // This option prohibits the use of a variable before it was defined.
                eqeqeq                  : true, // This options prohibits the use of == and != in favor of === and !==.
                unused                  : true, // This option warns when you define and never use your variables.
                trailing                : true // This option makes it an error to leave a trailing whitespace in your code.
            }
        },

        // Insert Banner into CSS file with last changed date, author and package info =================================
        usebanner: {
            css: {
                options: {
                    position            : "top",
                    banner              :
                        "/*!***************************************************************************************\n" +
                        "** Project: <%= pkg.name %> v<%= pkg.version %> - <%= pkg.description %> \n" +
                        "** Author: <%= pkg.author.name %> (<%= pkg.author.email %>) \n" +
                        "** Last Changes: <%= grunt.template.today('dd.mm.yyyy HH:MM') %> \n" +
                        "** Homepage: <%= pkg.homepage %> \n" +
                        "** License: <%= pkg.license %> \n" +
                        "*****************************************************************************************/\n"
                },
                files: {
                    src                 : ["public/css/*.css"]
                }
            },
            js: {
                options: {
                    position            : "top",
                    banner              :
                        "/*!***************************************************************************************\n" +
                        "** Project: <%= pkg.name %> v<%= pkg.version %> - <%= pkg.description %> \n" +
                        "** Author: <%= pkg.author.name %> (<%= pkg.author.email %>) \n" +
                        "** Last Changes: <%= grunt.template.today('dd.mm.yyyy HH:MM') %> \n" +
                        "** Homepage: <%= pkg.homepage %> \n" +
                        "** License: <%= pkg.license %> \n" +
                        "*****************************************************************************************/\n"
                },
                files: {
                    src                 : ["public/javascripts/*.min.js"]
                }
            }
        }

    });

    // Load Grunt tasks ================================================================================================
    grunt.loadNpmTasks("grunt-yui-compressor");
    grunt.loadNpmTasks("grunt-contrib-compass");
    grunt.loadNpmTasks("grunt-contrib-watch");
    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-banner");

    // Register Tasks ==================================================================================================
    grunt.registerTask("default", [
        "jshint",
        "min",
        "compass:dev",
        "usebanner:css",
        "usebanner:js"
    ]);
    grunt.registerTask("dev", [
        "jshint",
        "min",
        "compass:dev",
        "usebanner:css",
        "usebanner:js"
    ]);
    grunt.registerTask("prod", [
        "min",
        "compass:prod",
        "usebanner:css",
        "usebanner:js"
    ]);
    grunt.registerTask("test", [
        "jshint"
    ]);

};
