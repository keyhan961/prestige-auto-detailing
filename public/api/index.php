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

function read_appointments(): array {
    global $appointmentsFile;
    if (!file_exists($appointmentsFile)) {
        return [];
    }
    $items = json_decode((string)file_get_contents($appointmentsFile), true);
    return is_array($items) ? $items : [];
}

function write_appointments(array $appointments): void {
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
        'language' => $body['language'] ?? 'not specified',
        'name' => trim((string)$body['name']),
        'email' => trim((string)$body['email']),
        'phone' => trim((string)$body['phone']),
        'vehicleMake' => trim((string)($body['vehicleMake'] ?? '')),
        'vehicleModel' => trim((string)($body['vehicleModel'] ?? '')),
        'service' => trim((string)$body['service']),
        'durationMinutes' => $duration,
        'preferredDate' => trim((string)$body['preferredDate']),
        'preferredTime' => trim((string)$body['preferredTime']),
        'message' => trim((string)($body['message'] ?? '')),
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
    $appointments[$index] = $appointment;
    write_appointments($appointments);
    send_site_mail($appointment['email'], 'Your Prestige Auto Detailing appointment is confirmed', customer_decision_text('confirmed', $appointment), $GLOBALS['config']['company_email']);
    send_site_mail($GLOBALS['config']['company_email'], 'Appointment confirmed: ' . $appointment['name'], "The appointment was confirmed.\n\nCustomer: {$appointment['name']}\nPhone: {$appointment['phone']}\nService: {$appointment['service']}\nDate: {$appointment['preferredDate']}\nTime: {$appointment['preferredTime']}");
    echo '<html><body style="background:#050505;color:#f5f5f3;font-family:Arial;padding:40px;"><main style="max-width:640px;margin:auto;border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:28px;background:#111;"><h1 style="color:#e21b23;margin-top:0;">Appointment confirmed</h1><p>The customer has been emailed.</p></main></body></html>'; exit;
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
    $appointment['customerToken'] = $appointment['customerToken'] ?? bin2hex(random_bytes(24));
    $appointment['status'] = $hasAlternative ? 'alternative_sent' : 'denied';
    $appointment['suggestedDate'] = $hasAlternative ? (string)($body['suggestedDate'] ?? '') : '';
    $appointment['suggestedTime'] = $hasAlternative ? (string)($body['suggestedTime'] ?? '') : '';
    $appointment['ownerMessage'] = (string)($body['ownerMessage'] ?? '');
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
    $appointments[$index] = $appointment;
    write_appointments($appointments);
    send_site_mail($appointment['email'], 'Your Prestige Auto Detailing appointment is confirmed', customer_decision_text('confirmed', $appointment), $GLOBALS['config']['company_email']);
    send_site_mail($GLOBALS['config']['company_email'], 'Customer accepted alternative time: ' . $appointment['name'], "The customer accepted the alternative appointment time.\n\nCustomer: {$appointment['name']}\nPhone: {$appointment['phone']}\nService: {$appointment['service']}\nDate: {$appointment['preferredDate']}\nTime: {$appointment['preferredTime']}");
    echo '<html><body style="background:#050505;color:#f5f5f3;font-family:Arial;padding:40px;"><main style="max-width:640px;margin:auto;border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:28px;background:#111;"><h1 style="color:#e21b23;margin-top:0;">Appointment confirmed</h1><p>Your appointment has been confirmed.</p></main></body></html>'; exit;
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
    $appointment = $appointments[$index];
    if (!slot_available($body['preferredDate'], $body['preferredTime'], normalize_duration($appointment['durationMinutes']), $appointment['id'])) {
        http_response_code(409); echo 'That time is already booked. Please go back and choose another time.'; exit;
    }
    $appointment['preferredDate'] = (string)$body['preferredDate'];
    $appointment['preferredTime'] = (string)$body['preferredTime'];
    $appointment['customerMessage'] = (string)($body['customerMessage'] ?? '');
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
