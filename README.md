spacegame
=========

Learning project for a HTML5 turn-based strategic space game

This is a learning project for a turn-based strategic space game. While the game will probably never be realized, it serves as a useful reason to get better at Javascript.

Galactic Map
============

This is the module that I have started working on - no idea why, I guess learning canvas is a good enough reason as any.

The first version was pretty simple and contained no performance optimizations whatsoever (lets paint the whole map in one giant canvas with all information on it - yeah, right). Turns out that the performance got sluggish with ~20 stars.

The current version is actually the second version. It contains performance optimizations and works somewhat ok with 100 stars and a 50x50 map.

A working demo can be found here:
http://www.projektvier.de/~svens/projects/game/tests/galmap/


However, I am not happy with the performance of this version, and I want much much more stars (and players in one game). The map should be able to display gamemaps with several thousand stars and player empires; including wormholes, fleets, battles, cosmic events etc pp.

So, how am I going to improve on this?
======================================

I need to do the same that Google does - divide the map into lots of tiles and only draw the tiles when they start to get visible. This means I need to start working on the backend, since JS needs to get dynamic information from the server.

I have started by preparing the creation of random stars and empires. This is incredibly rough.
