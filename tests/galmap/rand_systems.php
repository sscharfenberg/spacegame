<?php
/**
 * Created by PhpStorm.
 * User: Ash
 * Date: 13.12.13
 * Time: 10:23
 * Description: fill DB with random systems and assign home systems to each empire
 * This is test data only, (very) quick&dirty
 */
static $numSystems = 2000;
static $numEmpires = 1000;
static $mapWidth = 100;
static $mapHeight = 100;
static $cSqlHost = "localhost";
static $cSqlDataBase = "spacegame";
static $cSqlUser = "root";
static $cSqlPassWord = "";
$db = new PDO("mysql:host=" . $cSqlHost . ";dbname=" . $cSqlDataBase . ";charset=utf8", $cSqlUser, $cSqlPassWord);
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION); // fail with exception
$db->setAttribute(PDO::ATTR_EMULATE_PREPARES, FALSE); // real prepared statements
$db->exec("SET NAMES 'utf8';"); // set utf-8

function areCoordsAvailable ($coordx, $coordy) {
    global $db;
    $oSqlQuery = $db->prepare("SELECT * FROM systems WHERE coordx = ? AND coordy = ?");
    $oSqlQuery->execute(array($coordx, $coordy));
    if ($oSqlQuery->rowCount() == 0) { return true; }
    else { return false; }
}
function isSystemAvailable ($id) {
    global $db;
    $oSqlQuery = $db->prepare("SELECT * FROM systems WHERE owner = ?");
    $oSqlQuery->execute(array($id));
    if ($oSqlQuery->rowCount() == 0) {
        return TRUE;
    } else {
        return FALSE;
    }
}

for ($i = 0; $i < $numSystems; $i++) {
    $type = mt_rand(0,9);
    $bFinished = FALSE;
    $counter = 0;
    while (!$bFinished) {
        $coordx = mt_rand(0, $mapWidth-1);
        $coordy = mt_rand(0, $mapHeight-1);
        if (areCoordsAvailable($coordx, $coordy)) {
            $bFinished = TRUE;
        } else {
            $counter++;
        }
    }
    $oNewInsertSqlQuery = $db->prepare("INSERT INTO systems (type, coordx, coordy) VALUES (?,?,?)");
    $oNewInsertSqlQuery->execute(array($type, $coordx, $coordy));
    $iSystemDBId = $db->lastInsertId();
    echo "<strong>".$iSystemDBId."</strong> -";
    echo " Type: ".$type;
    echo ", Coords: ".$coordx."/".$coordy;
    echo ", Fails while trying to find a unused coordinate: <strong>".$counter."</strong>";
    echo "<br />\n";
}
echo "<hr />";

// loop all empires and select a random homesystem
$oSqlQuery = $db->prepare("SELECT * FROM empires ORDER BY pkey ASC");
$oSqlQuery->execute();
foreach ($oSqlQuery->fetchAll(PDO::FETCH_ASSOC) as $aRows) {
    $iEmpireId = $aRows["pkey"];
    $bFinished = FALSE;
    $counter = 0;
    while (!$bFinished) {
        $iEmpireHomePlanet = mt_rand(1,$numSystems);
        if (isSystemAvailable($iEmpireHomePlanet)) {
            $bFinished = TRUE;
        } else {
            $counter++;
        }
    }
    $oNewInsertSqlQuery = $db->prepare("UPDATE systems SET owner = ? WHERE pkey = ?");
    $oNewInsertSqlQuery->execute(array($iEmpireId, $iEmpireHomePlanet));
    echo "Assigning Home System to Empire ".$iEmpireId." => System #".$iEmpireHomePlanet
            .". Fails while trying to find an unused system: <strong>".$counter."</strong><br />\n";

}
?>
