<?php
/**
 * Created by PhpStorm.
 * User: Ash
 * Date: 13.12.13
 * Time: 09:04
 * Description: fill DB with random empires for use in tests.
 */
    static $numEmpires = 1000;
    static $cSqlHost = "localhost";
    static $cSqlDataBase = "spacegame";
    static $cSqlUser = "root";
    static $cSqlPassWord = "";
    $db = new PDO("mysql:host=" . $cSqlHost . ";dbname=" . $cSqlDataBase . ";charset=utf8", $cSqlUser, $cSqlPassWord);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION); // fail with exception
    $db->setAttribute(PDO::ATTR_EMULATE_PREPARES, FALSE); // real prepared statements
    $db->exec("SET NAMES 'utf8';"); // set utf-8


    function randomAlphaNum ($length) {
        $chars    = "abcdefghijklmnopqrstuvwxyz0123456789";
        $numchars = strlen($chars) - 1;
        $hash = NULL;
        for ($x = 1; $x <= $length; $x++) {
            $position = mt_rand(0, $numchars);
            $hash .= substr($chars, $position, 1);
        }
        return $hash;
    }


    for ($i = 0; $i < $numEmpires; $i++) {
        $ticker = randomAlphaNum(5);
        $name = randomAlphaNum(32);
        $oNewInsertSqlQuery = $db->prepare("INSERT INTO empires (ticker, name) VALUES (?,?)");
        $oNewInsertSqlQuery->execute(array($ticker, $name));
        $iEmpireDBId = $db->lastInsertId();
        echo "Empire ".$i." (".$iEmpireDBId."): [".$ticker."] ".$name."<br />";
    }

?>
