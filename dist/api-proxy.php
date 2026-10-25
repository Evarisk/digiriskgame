<?php
/**
 * Relais PHP (CORS & Protection Clé API) pour hébergement mutualisé type o2switch.
 * Transmet les requêtes GET vers l'API REST Dolibarr / DigiRisk (JSON et Photos de risques).
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: DOLAPIKEY, Accept, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Lecture optionnelle du fichier .env sur le serveur (racine ou dossier parent)
$envVars = [];
foreach ([__DIR__ . '/.env', dirname(__DIR__) . '/.env'] as $envFile) {
    if (is_readable($envFile)) {
        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || strpos($line, '#') === 0 || strpos($line, '=') === false) {
                continue;
            }
            [$k, $v] = explode('=', $line, 2);
            $envVars[trim($k)] = trim($v, " \t\n\r\0\x0B\"'");
        }
        break;
    }
}

$baseUrl = !empty($envVars['VITE_DIGIRISK_BASE_URL'])
    ? rtrim($envVars['VITE_DIGIRISK_BASE_URL'], '/')
    : 'https://demodoli.digirisk.com/htdocs/api/index.php';

$apiKey = '';
if (!empty($_SERVER['HTTP_DOLAPIKEY'])) {
    $apiKey = trim($_SERVER['HTTP_DOLAPIKEY']);
} elseif (!empty($envVars['VITE_DOLAPIKEY'])) {
    $apiKey = $envVars['VITE_DOLAPIKEY'];
}

if ($apiKey === '') {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(401);
    echo json_encode(['error' => 'Clé DOLAPIKEY manquante (renseignez .env sur le serveur ou dans l’interface)']);
    exit;
}

// Mode 1 : Téléchargement direct d'une photo de risque (?photo=riskassessment/RA105/...)
if (!empty($_GET['photo'])) {
    $photoPath = trim($_GET['photo']);
    if (!preg_match('#^riskassessment/RA[0-9]+/[a-zA-Z0-9_\-\.\s,/]+$#u', $photoPath) || strpos($photoPath, '..') !== false) {
        http_response_code(400);
        exit('Chemin photo invalide');
    }

    $docUrl = $baseUrl . '/documents/download?modulepart=digiriskdolibarr&original_file=' . rawurlencode($photoPath);
    $ch = curl_init($docUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => [
            'DOLAPIKEY: ' . $apiKey,
            'Accept: application/json',
        ],
    ]);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($res && $code === 200) {
        $json = json_decode($res, true);
        if (!empty($json['content'])) {
            $mime = !empty($json['content-type']) ? $json['content-type'] : 'image/jpeg';
            header('Content-Type: ' . $mime);
            header('Cache-Control: public, max-age=86400');
            echo base64_decode($json['content']);
            exit;
        }
    }
    http_response_code(404);
    exit;
}

// Mode 2 : Proxy JSON standard (?endpoint=/digiriskdolibarr/...)
header('Content-Type: application/json; charset=utf-8');

$endpoint = isset($_GET['endpoint']) ? trim($_GET['endpoint']) : '';
if (
    $endpoint === '' ||
    strpos($endpoint, '/') !== 0 ||
    !preg_match('#^/(digiriskdolibarr/|tasks|status|documents)#', $endpoint)
) {
    http_response_code(400);
    echo json_encode(['error' => 'Endpoint non autorisé']);
    exit;
}

$targetUrl = $baseUrl . $endpoint;

$ch = curl_init($targetUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_HTTPHEADER => [
        'DOLAPIKEY: ' . $apiKey,
        'Accept: application/json',
    ],
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

if ($response === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Erreur cURL : ' . $curlErr]);
    exit;
}

http_response_code($httpCode ?: 200);
echo $response;
