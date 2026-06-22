<?php

declare(strict_types=1);

$configFile = __DIR__ . '/config.php';
$config = file_exists($configFile)
    ? require $configFile
    : require __DIR__ . '/config.example.php';
$dataDir = __DIR__ . '/data';
$appointmentsFile = $dataDir . '/appointments.json';

function required_value($value): bool {
    return is_string($value) && trim($value) !== '';
}

function clean_text($value, int $maxLength = 500): string {
    $text = trim((string)($value ?? ''));
    $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $text) ?? '';
    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $maxLength);
    }
    return substr($text, 0, $maxLength);
}

function valid_date_value($value): bool {
    if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        return false;
    }
    [$year, $month, $day] = array_map('intval', explode('-', $value));
    return checkdate($month, $day, $year);
}

function valid_time_value($value): bool {
    return is_string($value) && preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $value) === 1;
}

function h($value): string {
    return htmlspecialchars((string)($value ?? ''), ENT_QUOTES, 'UTF-8');
}

function json_response(array $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

function read_body(): array {
    $raw = file_get_contents('php://input') ?: '';
    $json = json_decode($raw, true);
    if (is_array($json)) {
        return $json;
    }
    return $_POST;
}

function db_configured(): bool {
    global $config;
    $db = $config['database'] ?? [];
    $placeholders = ['your_database_user', 'your_database_password', ''];
    return required_value($db['host'] ?? '')
        && required_value($db['name'] ?? '')
        && required_value($db['user'] ?? '')
        && array_key_exists('password', $db)
        && !in_array((string)$db['user'], $placeholders, true)
        && !in_array((string)$db['password'], $placeholders, true);
}

function db_table(): string {
    global $config;
    $table = (string)(($config['database'] ?? [])['table'] ?? 'appointments');
    if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]{0,63}$/', $table)) {
        throw new RuntimeException('Invalid database table name.');
    }
    return $table;
}

function db(): ?PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    if (!db_configured()) {
        return null;
    }
    global $config;
    $db = $config['database'];
    $dsn = 'mysql:host=' . $db['host'] . ';dbname=' . $db['name'] . ';charset=utf8mb4';
    $pdo = new PDO($dsn, (string)$db['user'], (string)$db['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    ensure_database_table($pdo);
    return $pdo;
}

function ensure_database_table(PDO $pdo): void {
    $table = db_table();
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS `$table` (
            id VARCHAR(64) NOT NULL PRIMARY KEY,
            status VARCHAR(40) NOT NULL DEFAULT 'pending',
            preferred_date DATE NULL,
            preferred_time TIME NULL,
            duration_minutes INT NOT NULL DEFAULT 120,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NULL,
            data LONGTEXT NOT NULL,
            INDEX idx_slot (status, preferred_date, preferred_time),
            INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function read_appointments(): array {
    $pdo = db();
    if ($pdo instanceof PDO) {
        $table = db_table();
        $rows = $pdo->query("SELECT data FROM `$table` ORDER BY created_at ASC")->fetchAll();
        $appointments = [];
        foreach ($rows as $row) {
            $appointment = json_decode((string)$row['data'], true);
            if (is_array($appointment)) {
                $appointments[] = $appointment;
            }
        }
        return $appointments;
    }

    global $appointmentsFile;
    if (!file_exists($appointmentsFile)) {
        return [];
    }
    $items = json_decode((string)file_get_contents($appointmentsFile), true);
    return is_array($items) ? $items : [];
}

function write_appointments(array $appointments): void {
    $pdo = db();
    if ($pdo instanceof PDO) {
        $table = db_table();
        $pdo->beginTransaction();
        try {
            $pdo->exec("DELETE FROM `$table`");
            $statement = $pdo->prepare(
                "INSERT INTO `$table` (id, status, preferred_date, preferred_time, duration_minutes, created_at, updated_at, data)
                 VALUES (:id, :status, :preferred_date, :preferred_time, :duration_minutes, :created_at, :updated_at, :data)"
            );
            foreach ($appointments as $appointment) {
                $statement->execute([
                    ':id' => (string)($appointment['id'] ?? bin2hex(random_bytes(16))),
                    ':status' => (string)($appointment['status'] ?? 'pending'),
                    ':preferred_date' => required_value($appointment['preferredDate'] ?? '') ? $appointment['preferredDate'] : null,
                    ':preferred_time' => required_value($appointment['preferredTime'] ?? '') ? $appointment['preferredTime'] : null,
                    ':duration_minutes' => normalize_duration($appointment['durationMinutes'] ?? 120),
                    ':created_at' => gmdate('Y-m-d H:i:s', strtotime((string)($appointment['createdAt'] ?? 'now'))),
                    ':updated_at' => !empty($appointment['updatedAt']) ? gmdate('Y-m-d H:i:s', strtotime((string)$appointment['updatedAt'])) : null,
                    ':data' => json_encode($appointment, JSON_UNESCAPED_UNICODE),
                ]);
            }
            $pdo->commit();
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }
        return;
    }

    global $dataDir, $appointmentsFile;
    if (!is_dir($dataDir)) {
        mkdir($dataDir, 0755, true);
    }
    file_put_contents($appointmentsFile, json_encode($appointments, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function base_url(): string {
    global $config;
    if (!empty($config['public_base_url']) && $config['public_base_url'] !== 'https://yourdomain.fi') {
        return rtrim($config['public_base_url'], '/');
    }
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    return $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
}

function mail_shell(string $title, string $intro, string $detailsHtml, array $buttons = []): string {
    $buttonHtml = '';
    foreach ($buttons as $button) {
        $buttonHtml .= '<a href="' . h($button['url']) . '" style="display:inline-block;margin:8px 8px 8px 0;padding:13px 18px;border-radius:999px;background:' . h($button['color'] ?? '#e21b23') . ';color:#fff;text-decoration:none;font-weight:700;">' . h($button['label']) . '</a>';
    }
    return '<!doctype html><html><body style="margin:0;background:#050505;color:#f5f5f3;font-family:Arial,sans-serif;">'
        . '<div style="max-width:680px;margin:0 auto;padding:28px 16px;">'
        . '<div style="border:1px solid rgba(255,255,255,.16);border-radius:16px;background:#111;padding:28px;">'
        . '<p style="margin:0 0 10px;color:#e21b23;font-weight:700;letter-spacing:.16em;text-transform:uppercase;">Prestige Auto Detailing</p>'
        . '<h1 style="margin:0 0 18px;color:#fff;font-size:26px;">' . h($title) . '</h1>'
        . '<p style="color:#d7d7d7;line-height:1.6;">' . nl2br(h($intro)) . '</p>'
        . '<div style="margin:22px 0;padding:18px;border-radius:12px;background:#050505;border:1px solid rgba(255,255,255,.12);color:#e8e8e8;line-height:1.7;">' . $detailsHtml . '</div>'
        . ($buttonHtml !== '' ? '<div style="margin-top:22px;">' . $buttonHtml . '</div>' : '')
        . '</div></div></body></html>';
}

function appointment_details_html(array $appointment): string {
    return '<strong>Customer:</strong> ' . h($appointment['name'] ?? '-') . '<br>'
        . '<strong>Email:</strong> ' . h($appointment['email'] ?? '-') . '<br>'
        . '<strong>Phone:</strong> ' . h($appointment['phone'] ?? '-') . '<br>'
        . '<strong>Vehicle:</strong> ' . h(trim(($appointment['vehicleMake'] ?? '') . ' ' . ($appointment['vehicleModel'] ?? '')) ?: '-') . '<br>'
        . '<strong>Service:</strong> ' . h($appointment['service'] ?? '-') . '<br>'
        . '<strong>Duration:</strong> ' . h($appointment['durationMinutes'] ?? '-') . ' minutes<br>'
        . '<strong>Date:</strong> ' . h($appointment['preferredDate'] ?? '-') . '<br>'
        . '<strong>Time:</strong> ' . h($appointment['preferredTime'] ?? '-') . '<br>'
        . '<strong>Message:</strong><br>' . nl2br(h($appointment['message'] ?? '-'));
}

function send_site_mail(string $to, string $subject, string $body, string $replyTo = '', bool $isHtml = false): bool {
    global $config;
    $from = $config['mail_from'] ?? $config['company_email'];
    $headers = [
        'From: ' . $from,
        'MIME-Version: 1.0',
        'Content-Type: ' . ($isHtml ? 'text/html' : 'text/plain') . '; charset=UTF-8',
    ];
    if ($replyTo !== '') {
        $headers[] = 'Reply-To: ' . $replyTo;
    }
    return @mail($to, $subject, $body, implode("\r\n", $headers));
}

function base64url_encode(string $value): string {
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function http_json(string $url, array $payload, array $headers = []): array {
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE);
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json'], $headers),
            CURLOPT_TIMEOUT => 20,
        ]);
        $response = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        if ($response === false) {
            throw new RuntimeException('Calendar HTTP request failed: ' . $error);
        }
    } else {
        $response = file_get_contents($url, false, stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => implode("\r\n", array_merge(['Content-Type: application/json'], $headers)),
                'content' => $body,
                'timeout' => 20,
                'ignore_errors' => true,
            ],
        ]));
        $status = 200;
        if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $match)) {
            $status = (int)$match[1];
        }
    }
    $decoded = json_decode((string)$response, true);
    if ($status < 200 || $status >= 300) {
        throw new RuntimeException('Calendar HTTP request failed with status ' . $status . ': ' . substr((string)$response, 0, 500));
    }
    return is_array($decoded) ? $decoded : [];
}

function http_form(string $url, array $payload): array {
    $body = http_build_query($payload);
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
            CURLOPT_TIMEOUT => 20,
        ]);
        $response = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        if ($response === false) {
            throw new RuntimeException('Google token request failed: ' . $error);
        }
    } else {
        $response = file_get_contents($url, false, stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => 'Content-Type: application/x-www-form-urlencoded',
                'content' => $body,
                'timeout' => 20,
                'ignore_errors' => true,
            ],
        ]));
        $status = 200;
        if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $match)) {
            $status = (int)$match[1];
        }
    }
    $decoded = json_decode((string)$response, true);
    if ($status < 200 || $status >= 300) {
        throw new RuntimeException('Google token request failed with status ' . $status . ': ' . substr((string)$response, 0, 500));
    }
    return is_array($decoded) ? $decoded : [];
}

function google_calendar_configured(): bool {
    global $config;
    $calendar = $config['google_calendar'] ?? [];
    return !empty($calendar['enabled'])
        && required_value($calendar['calendar_id'] ?? '')
        && required_value($calendar['service_account_file'] ?? '')
        && file_exists((string)$calendar['service_account_file']);
}

function google_access_token(): string {
    global $config;
    $calendar = $config['google_calendar'];
    $credentials = json_decode((string)file_get_contents((string)$calendar['service_account_file']), true);
    if (!is_array($credentials) || empty($credentials['client_email']) || empty($credentials['private_key'])) {
        throw new RuntimeException('Google service account JSON is invalid.');
    }
    $now = time();
    $header = ['alg' => 'RS256', 'typ' => 'JWT'];
    $claims = [
        'iss' => $credentials['client_email'],
        'scope' => 'https://www.googleapis.com/auth/calendar.events',
        'aud' => 'https://oauth2.googleapis.com/token',
        'iat' => $now,
        'exp' => $now + 3600,
    ];
    $unsigned = base64url_encode(json_encode($header)) . '.' . base64url_encode(json_encode($claims));
    $signature = '';
    if (!openssl_sign($unsigned, $signature, $credentials['private_key'], OPENSSL_ALGO_SHA256)) {
        throw new RuntimeException('Could not sign Google service account JWT.');
    }
    $jwt = $unsigned . '.' . base64url_encode($signature);
    $response = http_form('https://oauth2.googleapis.com/token', [
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $jwt,
    ]);
    if (empty($response['access_token'])) {
        throw new RuntimeException('Google access token response did not include an access token.');
    }
    return (string)$response['access_token'];
}

function appointment_datetime(array $appointment, int $minutesToAdd = 0): string {
    global $config;
    $timezone = ($config['google_calendar'] ?? [])['timezone'] ?? 'Europe/Helsinki';
    $date = new DateTimeImmutable(($appointment['preferredDate'] ?? '') . ' ' . ($appointment['preferredTime'] ?? '09:00'), new DateTimeZone($timezone));
    if ($minutesToAdd > 0) {
        $date = $date->modify('+' . $minutesToAdd . ' minutes');
    }
    return $date->format(DateTimeInterface::ATOM);
}

function create_google_calendar_event(array $appointment): array {
    if (!google_calendar_configured()) {
        return ['created' => false, 'message' => 'Google Calendar is not configured.'];
    }
    global $config;
    if (!empty($appointment['calendarEventId'])) {
        return ['created' => true, 'message' => 'Calendar event already exists.', 'eventId' => $appointment['calendarEventId'], 'eventLink' => $appointment['calendarEventLink'] ?? ''];
    }
    $token = google_access_token();
    $calendar = $config['google_calendar'];
    $vehicle = trim(($appointment['vehicleMake'] ?? '') . ' ' . ($appointment['vehicleModel'] ?? ''));
    $duration = normalize_duration($appointment['durationMinutes'] ?? 120);
    $payload = [
        'summary' => 'Prestige Auto Detailing - ' . ($appointment['service'] ?? 'Appointment'),
        'location' => $config['business_address'] ?? '',
        'description' => "Customer: " . ($appointment['name'] ?? '-') . "\n"
            . "Phone: " . ($appointment['phone'] ?? '-') . "\n"
            . "Email: " . ($appointment['email'] ?? '-') . "\n"
            . "Vehicle: " . ($vehicle !== '' ? $vehicle : '-') . "\n"
            . "Service: " . ($appointment['service'] ?? '-') . "\n"
            . "Message: " . ($appointment['message'] ?? '-'),
        'start' => [
            'dateTime' => appointment_datetime($appointment),
            'timeZone' => $calendar['timezone'] ?? 'Europe/Helsinki',
        ],
        'end' => [
            'dateTime' => appointment_datetime($appointment, $duration),
            'timeZone' => $calendar['timezone'] ?? 'Europe/Helsinki',
        ],
    ];
    $calendarId = rawurlencode((string)$calendar['calendar_id']);
    $response = http_json('https://www.googleapis.com/calendar/v3/calendars/' . $calendarId . '/events', $payload, [
        'Authorization: Bearer ' . $token,
    ]);
    return [
        'created' => true,
        'eventId' => $response['id'] ?? '',
        'eventLink' => $response['htmlLink'] ?? '',
        'message' => 'Google Calendar event created.',
    ];
}

function confirm_appointment_calendar(array &$appointment): string {
    try {
        $result = create_google_calendar_event($appointment);
        if (!empty($result['eventId'])) {
            $appointment['calendarEventId'] = $result['eventId'];
            $appointment['calendarEventLink'] = $result['eventLink'] ?? '';
        }
        return $result['message'] ?? '';
    } catch (Throwable $error) {
        $appointment['calendarError'] = $error->getMessage();
        return 'Google Calendar event was not created: ' . $error->getMessage();
    }
}

function normalize_duration($value): int {
    $duration = (int)$value;
    if ($duration <= 0) {
        return 120;
    }
    return min($duration, 1440);
}

function overlaps(string $date, string $time, int $duration, array $appointment): bool {
    if (($appointment['status'] ?? '') !== 'confirmed') {
        return false;
    }
    if (($appointment['preferredDate'] ?? '') !== $date || empty($appointment['preferredTime'])) {
        return false;
    }
    $start = strtotime($date . ' ' . $time);
    $end = $start + ($duration * 60);
    $otherStart = strtotime($appointment['preferredDate'] . ' ' . $appointment['preferredTime']);
    $otherEnd = $otherStart + (normalize_duration($appointment['durationMinutes'] ?? 120) * 60);
    return $start < $otherEnd && $end > $otherStart;
}

function slot_available(string $date, string $time, int $duration, string $ignoreId = ''): bool {
    foreach (read_appointments() as $appointment) {
        if (($appointment['id'] ?? '') === $ignoreId) {
            continue;
        }
        if (overlaps($date, $time, $duration, $appointment)) {
            return false;
        }
    }
    return true;
}

function customer_decision_text(string $status, array $appointment): string {
    $service = $appointment['service'] ?? 'your selected service';
    $date = $appointment['preferredDate'] ?? 'your requested date';
    $time = !empty($appointment['preferredTime']) ? ' at ' . $appointment['preferredTime'] : '';
    if ($status === 'confirmed') {
        return "Hello {$appointment['name']},\n\nYour appointment request for {$service} on {$date}{$time} has been confirmed.\n\nPrestige Auto Detailing";
    }
    return "Hello {$appointment['name']},\n\nYour appointment request for {$service} on {$date}{$time} could not be confirmed for that time.\nPlease contact us to choose another available time.\n\nPrestige Auto Detailing";
}

function owner_deny_page(array $appointment, string $token): string {
    return '<html><body style="background:#050505;color:#f5f5f3;font-family:Arial,sans-serif;padding:24px;"><main style="max-width:680px;margin:auto;border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:28px;background:#111;">'
        . '<h1 style="color:#e21b23;margin-top:0;">Deny or suggest another time</h1>'
        . '<p><strong>Customer:</strong> ' . h($appointment['name']) . '<br><strong>Email:</strong> ' . h($appointment['email']) . '<br><strong>Phone:</strong> ' . h($appointment['phone']) . '</p>'
        . '<p><strong>Requested service:</strong> ' . h($appointment['service']) . '<br><strong>Requested date:</strong> ' . h($appointment['preferredDate'] ?? '-') . '</p>'
        . '<form method="POST" action="/api/appointments/' . h($appointment['id']) . '/deny" style="display:grid;gap:16px;margin-top:24px;">'
        . '<input type="hidden" name="token" value="' . h($token) . '" />'
        . '<label style="display:grid;gap:8px;">Suggested new date<input name="suggestedDate" type="date" style="padding:12px;border-radius:8px;border:1px solid #444;background:#050505;color:#fff;" /></label>'
        . '<label style="display:grid;gap:8px;">Suggested new time<input name="suggestedTime" type="time" style="padding:12px;border-radius:8px;border:1px solid #444;background:#050505;color:#fff;" /></label>'
        . '<label style="display:grid;gap:8px;">Message to customer<textarea name="ownerMessage" rows="5" style="padding:12px;border-radius:8px;border:1px solid #444;background:#050505;color:#fff;">The requested time is not available. We can offer this alternative appointment time.</textarea></label>'
        . '<div style="display:flex;flex-wrap:wrap;gap:12px;"><button name="action" value="suggest" style="border:0;border-radius:999px;background:#e21b23;color:#fff;padding:12px 18px;font-weight:700;cursor:pointer;">Send alternative time</button>'
        . '<button name="action" value="deny" style="border:1px solid #555;border-radius:999px;background:transparent;color:#fff;padding:12px 18px;font-weight:700;cursor:pointer;">Deny without alternative</button></div>'
        . '</form></main></body></html>';
}

function customer_reschedule_page(array $appointment, string $token): string {
    return '<html><body style="background:#050505;color:#f5f5f3;font-family:Arial,sans-serif;padding:24px;"><main style="max-width:680px;margin:auto;border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:28px;background:#111;">'
        . '<h1 style="color:#e21b23;margin-top:0;">Request another appointment time</h1>'
        . '<p>If the suggested time does not work for you, send another date and time. The owner will confirm it or suggest another option.</p>'
        . '<p><strong>Service:</strong> ' . h($appointment['service']) . '<br><strong>Current suggested date:</strong> ' . h($appointment['suggestedDate'] ?? '-') . '<br><strong>Current suggested time:</strong> ' . h($appointment['suggestedTime'] ?? '-') . '</p>'
        . '<form method="POST" action="/api/appointments/' . h($appointment['id']) . '/reschedule" style="display:grid;gap:16px;margin-top:24px;">'
        . '<input type="hidden" name="token" value="' . h($token) . '" />'
        . '<label style="display:grid;gap:8px;">Your preferred date<input name="preferredDate" type="date" required style="padding:12px;border-radius:8px;border:1px solid #444;background:#050505;color:#fff;" /></label>'
        . '<label style="display:grid;gap:8px;">Your preferred time<input name="preferredTime" type="time" required style="padding:12px;border-radius:8px;border:1px solid #444;background:#050505;color:#fff;" /></label>'
        . '<label style="display:grid;gap:8px;">Message<textarea name="customerMessage" rows="5" style="padding:12px;border-radius:8px;border:1px solid #444;background:#050505;color:#fff;">This time does not work for me. Can we try this date and time instead?</textarea></label>'
        . '<button style="border:0;border-radius:999px;background:#e21b23;color:#fff;padding:12px 18px;font-weight:700;cursor:pointer;">Send new requested time</button>'
        . '</form></main></body></html>';
}

function find_appointment_index(array $appointments, string $id): int {
    foreach ($appointments as $index => $appointment) {
        if (($appointment['id'] ?? '') === $id) {
            return $index;
        }
    }
    return -1;
}

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = preg_replace('#^/api#', '', $path);
$path = $path === '' ? '/' : $path;

if ($method === 'POST' && $path === '/availability') {
    $body = read_body();
    if (!required_value($body['preferredDate'] ?? '') || !required_value($body['preferredTime'] ?? '')) {
        json_response(['message' => 'Preferred date and time are required.'], 400);
    }
    if (!valid_date_value($body['preferredDate']) || !valid_time_value($body['preferredTime'])) {
        json_response(['message' => 'Preferred date or time is invalid.'], 400);
    }
    $available = slot_available($body['preferredDate'], $body['preferredTime'], normalize_duration($body['durationMinutes'] ?? 120));
    json_response(['available' => $available, 'configured' => true, 'message' => $available ? 'Time is available.' : 'That date and time is already booked.']);
}

if ($method === 'POST' && $path === '/appointments') {
    global $config;
    $body = read_body();
    foreach (['name', 'email', 'phone', 'service', 'preferredDate', 'preferredTime'] as $field) {
        if (!required_value($body[$field] ?? '')) {
            json_response(['message' => 'Name, email, phone, service, preferred date, and preferred time are required.'], 400);
        }
    }
    if (!filter_var((string)$body['email'], FILTER_VALIDATE_EMAIL)) {
        json_response(['message' => 'Email address is invalid.'], 400);
    }
    if (!valid_date_value($body['preferredDate']) || !valid_time_value($body['preferredTime'])) {
        json_response(['message' => 'Preferred date or time is invalid.'], 400);
    }
    $duration = normalize_duration($body['durationMinutes'] ?? 120);
    if (!slot_available($body['preferredDate'], $body['preferredTime'], $duration)) {
        json_response(['message' => 'That date and time is already booked.'], 409);
    }
    $appointment = [
        'id' => bin2hex(random_bytes(16)),
        'token' => bin2hex(random_bytes(24)),
        'customerToken' => bin2hex(random_bytes(24)),
        'status' => 'pending',
        'createdAt' => gmdate('c'),
        'language' => clean_text($body['language'] ?? 'not specified', 20),
        'name' => clean_text($body['name'], 120),
        'email' => clean_text($body['email'], 190),
        'phone' => clean_text($body['phone'], 60),
        'vehicleMake' => clean_text($body['vehicleMake'] ?? '', 80),
        'vehicleModel' => clean_text($body['vehicleModel'] ?? '', 80),
        'service' => clean_text($body['service'], 120),
        'durationMinutes' => $duration,
        'preferredDate' => clean_text($body['preferredDate'], 10),
        'preferredTime' => clean_text($body['preferredTime'], 5),
        'message' => clean_text($body['message'] ?? '', 2000),
    ];
    $appointments = read_appointments();
    $appointments[] = $appointment;
    write_appointments($appointments);
    $confirmUrl = base_url() . '/api/appointments/' . $appointment['id'] . '/confirm?token=' . $appointment['token'];
    $denyUrl = base_url() . '/api/appointments/' . $appointment['id'] . '/deny?token=' . $appointment['token'];
    $buttons = [
        ['label' => 'Confirm appointment', 'url' => $confirmUrl, 'color' => '#16a34a'],
        ['label' => 'Deny or suggest new time', 'url' => $denyUrl, 'color' => '#e21b23'],
    ];
    $html = mail_shell(
        'New Appointment Request',
        'A customer requested an appointment. Choose one of the actions below.',
        appointment_details_html($appointment),
        $buttons
    );
    if (!send_site_mail($config['company_email'], 'Prestige Auto Detailing - Appointment Request', $html, $appointment['email'], true)) {
        json_response(['message' => 'Appointment saved, but email could not be sent. Check hosting mail settings.'], 500);
    }
    json_response(['message' => 'Appointment request sent.']);
}

if ($method === 'GET' && preg_match('#^/appointments/([^/]+)/(confirm|deny|reschedule)$#', $path, $m)) {
    $appointments = read_appointments();
    $index = find_appointment_index($appointments, $m[1]);
    if ($index < 0) {
        http_response_code(404); echo 'Appointment link is invalid.'; exit;
    }
    $appointment = $appointments[$index];
    $token = (string)($_GET['token'] ?? '');
    if ($m[2] === 'reschedule') {
        if (($appointment['customerToken'] ?? '') !== $token) {
            http_response_code(404); echo 'Appointment link is invalid.'; exit;
        }
        echo customer_reschedule_page($appointment, $token); exit;
    }
    if (($appointment['token'] ?? '') !== $token) {
        http_response_code(404); echo 'Appointment action link is invalid.'; exit;
    }
    if ($m[2] === 'deny') {
        echo owner_deny_page($appointment, $token); exit;
    }
    if (!in_array($appointment['status'], ['pending', 'customer_reschedule_requested'], true)) {
        echo '<html><body style="font-family:Arial;padding:40px;"><h1>Already handled</h1><p>This appointment is already marked as <strong>' . h($appointment['status']) . '</strong>.</p></body></html>'; exit;
    }
    $appointment['status'] = 'confirmed';
    $appointment['updatedAt'] = gmdate('c');
    $calendarMessage = confirm_appointment_calendar($appointment);
    $appointments[$index] = $appointment;
    write_appointments($appointments);
    send_site_mail($appointment['email'], 'Your Prestige Auto Detailing appointment is confirmed', customer_decision_text('confirmed', $appointment), $GLOBALS['config']['company_email']);
    send_site_mail($GLOBALS['config']['company_email'], 'Appointment confirmed: ' . $appointment['name'], "The appointment was confirmed.\n\nCustomer: {$appointment['name']}\nPhone: {$appointment['phone']}\nService: {$appointment['service']}\nDate: {$appointment['preferredDate']}\nTime: {$appointment['preferredTime']}\n\nCalendar: {$calendarMessage}");
    echo '<html><body style="background:#050505;color:#f5f5f3;font-family:Arial;padding:40px;"><main style="max-width:640px;margin:auto;border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:28px;background:#111;"><h1 style="color:#e21b23;margin-top:0;">Appointment confirmed</h1><p>The customer has been emailed.</p><p>' . h($calendarMessage) . '</p></main></body></html>'; exit;
}

if ($method === 'POST' && preg_match('#^/appointments/([^/]+)/deny$#', $path, $m)) {
    global $config;
    $body = read_body();
    $appointments = read_appointments();
    $index = find_appointment_index($appointments, $m[1]);
    if ($index < 0 || ($appointments[$index]['token'] ?? '') !== ($body['token'] ?? '')) {
        http_response_code(404); echo 'Appointment action link is invalid.'; exit;
    }
    $appointment = $appointments[$index];
    $hasAlternative = ($body['action'] ?? '') === 'suggest';
    if ($hasAlternative && (!valid_date_value($body['suggestedDate'] ?? '') || !valid_time_value($body['suggestedTime'] ?? ''))) {
        http_response_code(400); echo 'Suggested date and time are required.'; exit;
    }
    $appointment['customerToken'] = $appointment['customerToken'] ?? bin2hex(random_bytes(24));
    $appointment['status'] = $hasAlternative ? 'alternative_sent' : 'denied';
    $appointment['suggestedDate'] = $hasAlternative ? clean_text($body['suggestedDate'] ?? '', 10) : '';
    $appointment['suggestedTime'] = $hasAlternative ? clean_text($body['suggestedTime'] ?? '', 5) : '';
    $appointment['ownerMessage'] = clean_text($body['ownerMessage'] ?? '', 2000);
    $appointment['updatedAt'] = gmdate('c');
    $appointments[$index] = $appointment;
    write_appointments($appointments);
    if ($hasAlternative) {
        $acceptUrl = base_url() . '/api/appointments/' . $appointment['id'] . '/alternative/accept?token=' . $appointment['customerToken'];
        $rescheduleUrl = base_url() . '/api/appointments/' . $appointment['id'] . '/reschedule?token=' . $appointment['customerToken'];
        $buttons = [
            ['label' => 'Accept suggested time', 'url' => $acceptUrl, 'color' => '#16a34a'],
            ['label' => 'Request another time', 'url' => $rescheduleUrl, 'color' => '#e21b23'],
        ];
        $text = mail_shell(
            'Alternative Appointment Time',
            "Hello {$appointment['name']},\n\nYour requested appointment time for {$appointment['service']} could not be confirmed. We can offer this alternative time instead.",
            '<strong>Suggested date:</strong> ' . h($appointment['suggestedDate']) . '<br>'
                . '<strong>Suggested time:</strong> ' . h($appointment['suggestedTime']) . '<br>'
                . '<strong>Message:</strong><br>' . nl2br(h($appointment['ownerMessage'])),
            $buttons
        );
    } else {
        $text = customer_decision_text('denied', $appointment);
    }
    send_site_mail($appointment['email'], $hasAlternative ? 'Prestige Auto Detailing - alternative appointment time' : 'Prestige Auto Detailing appointment time update', $text, $config['company_email'], $hasAlternative);
    echo '<html><body style="background:#050505;color:#f5f5f3;font-family:Arial;padding:40px;"><main style="max-width:640px;margin:auto;border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:28px;background:#111;"><h1 style="color:#e21b23;margin-top:0;">' . ($hasAlternative ? 'Alternative time sent' : 'Appointment denied') . '</h1><p>The customer has been emailed.</p></main></body></html>'; exit;
}

if ($method === 'GET' && preg_match('#^/appointments/([^/]+)/alternative/accept$#', $path, $m)) {
    $appointments = read_appointments();
    $index = find_appointment_index($appointments, $m[1]);
    $token = (string)($_GET['token'] ?? '');
    if ($index < 0 || ($appointments[$index]['customerToken'] ?? '') !== $token) {
        http_response_code(404); echo 'Appointment link is invalid.'; exit;
    }
    $appointment = $appointments[$index];
    if (($appointment['status'] ?? '') !== 'alternative_sent') {
        echo 'Cannot accept this time.'; exit;
    }
    if (!slot_available($appointment['suggestedDate'], $appointment['suggestedTime'], normalize_duration($appointment['durationMinutes']), $appointment['id'])) {
        http_response_code(409); echo 'That time is no longer available. Please request another time.'; exit;
    }
    $appointment['preferredDate'] = $appointment['suggestedDate'];
    $appointment['preferredTime'] = $appointment['suggestedTime'];
    $appointment['status'] = 'confirmed';
    $appointment['updatedAt'] = gmdate('c');
    $calendarMessage = confirm_appointment_calendar($appointment);
    $appointments[$index] = $appointment;
    write_appointments($appointments);
    send_site_mail($appointment['email'], 'Your Prestige Auto Detailing appointment is confirmed', customer_decision_text('confirmed', $appointment), $GLOBALS['config']['company_email']);
    send_site_mail($GLOBALS['config']['company_email'], 'Customer accepted alternative time: ' . $appointment['name'], "The customer accepted the alternative appointment time.\n\nCustomer: {$appointment['name']}\nPhone: {$appointment['phone']}\nService: {$appointment['service']}\nDate: {$appointment['preferredDate']}\nTime: {$appointment['preferredTime']}\n\nCalendar: {$calendarMessage}");
    echo '<html><body style="background:#050505;color:#f5f5f3;font-family:Arial;padding:40px;"><main style="max-width:640px;margin:auto;border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:28px;background:#111;"><h1 style="color:#e21b23;margin-top:0;">Appointment confirmed</h1><p>Your appointment has been confirmed.</p><p>' . h($calendarMessage) . '</p></main></body></html>'; exit;
}

if ($method === 'POST' && preg_match('#^/appointments/([^/]+)/reschedule$#', $path, $m)) {
    global $config;
    $body = read_body();
    $appointments = read_appointments();
    $index = find_appointment_index($appointments, $m[1]);
    if ($index < 0 || ($appointments[$index]['customerToken'] ?? '') !== ($body['token'] ?? '')) {
        http_response_code(404); echo 'Appointment link is invalid.'; exit;
    }
    if (!required_value($body['preferredDate'] ?? '') || !required_value($body['preferredTime'] ?? '')) {
        http_response_code(400); echo 'Preferred date and time are required.'; exit;
    }
    if (!valid_date_value($body['preferredDate']) || !valid_time_value($body['preferredTime'])) {
        http_response_code(400); echo 'Preferred date or time is invalid.'; exit;
    }
    $appointment = $appointments[$index];
    if (!slot_available($body['preferredDate'], $body['preferredTime'], normalize_duration($appointment['durationMinutes']), $appointment['id'])) {
        http_response_code(409); echo 'That time is already booked. Please go back and choose another time.'; exit;
    }
    $appointment['preferredDate'] = clean_text($body['preferredDate'], 10);
    $appointment['preferredTime'] = clean_text($body['preferredTime'], 5);
    $appointment['customerMessage'] = clean_text($body['customerMessage'] ?? '', 2000);
    $appointment['status'] = 'customer_reschedule_requested';
    $appointment['updatedAt'] = gmdate('c');
    $appointments[$index] = $appointment;
    write_appointments($appointments);
    $confirmUrl = base_url() . '/api/appointments/' . $appointment['id'] . '/confirm?token=' . $appointment['token'];
    $denyUrl = base_url() . '/api/appointments/' . $appointment['id'] . '/deny?token=' . $appointment['token'];
    $buttons = [
        ['label' => 'Confirm requested time', 'url' => $confirmUrl, 'color' => '#16a34a'],
        ['label' => 'Deny or suggest new time', 'url' => $denyUrl, 'color' => '#e21b23'],
    ];
    $text = mail_shell(
        'Customer Requested Another Time',
        'The customer cannot use the suggested time and sent a new preferred date and time.',
        '<strong>Customer:</strong> ' . h($appointment['name']) . '<br>'
            . '<strong>Email:</strong> ' . h($appointment['email']) . '<br>'
            . '<strong>Phone:</strong> ' . h($appointment['phone']) . '<br>'
            . '<strong>Service:</strong> ' . h($appointment['service']) . '<br>'
            . '<strong>Requested date:</strong> ' . h($appointment['preferredDate']) . '<br>'
            . '<strong>Requested time:</strong> ' . h($appointment['preferredTime']) . '<br>'
            . '<strong>Customer message:</strong><br>' . nl2br(h($appointment['customerMessage'] ?: '-')),
        $buttons
    );
    send_site_mail($config['company_email'], 'Prestige Auto Detailing - customer requested another time', $text, $appointment['email'], true);
    echo '<html><body style="background:#050505;color:#f5f5f3;font-family:Arial;padding:40px;"><main style="max-width:640px;margin:auto;border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:28px;background:#111;"><h1 style="color:#e21b23;margin-top:0;">New time sent</h1><p>Your new requested time was sent to Prestige Auto Detailing.</p></main></body></html>'; exit;
}

http_response_code(404);
json_response(['message' => 'API route not found.'], 404);
