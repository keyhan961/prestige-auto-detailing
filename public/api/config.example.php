<?php

return [
    'company_email' => 'detailinga028@gmail.com',
    'mail_from' => 'no-reply@prestigeautodetailing.fi',
    'business_name' => 'Prestige Auto Detailing',
    'business_address' => 'Läntinen teollisuuskatu 23, 02920 Espoo',
    'public_base_url' => 'https://yourdomain.fi',
    'database' => [
        'host' => 'localhost',
        'name' => 'prestige_bookings',
        'user' => 'your_database_user',
        'password' => 'your_database_password',
        'table' => 'appointments',
    ],
    'google_calendar' => [
        'enabled' => false,
        'calendar_id' => 'detailinga028@gmail.com',
        'service_account_file' => __DIR__ . '/private/google-service-account.json',
        'timezone' => 'Europe/Helsinki',
    ],
];
