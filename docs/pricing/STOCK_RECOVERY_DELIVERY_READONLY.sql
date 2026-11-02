-- Core hxhusfkrlafxdnyasmsu only. Read-only ClickHouse query_logs, not Postgres.
-- Additional exact log-access approval required. Window: last 60 minutes at
-- execution, passed explicitly through iso_timestamp_start/end. No polling.
-- Return only recovery HTTP status counts and predefined Auth error buckets.
-- No raw messages, addresses, headers, IPs, IDs, tokens or customer data output.
SELECT toInt32OrZero(log_attributes['response.status_code']) AS status,
 count() AS events
FROM logs
WHERE source = 'edge_logs'
 AND log_attributes['request.path'] = '/auth/v1/recover'
GROUP BY status ORDER BY status LIMIT 20;

-- Run separately with the same explicit time window.
SELECT multiIf(
 match(event_message, '(?i)rate.?limit|too many|over_email_send_rate_limit'), 'rate_limit',
 match(event_message, '(?i)smtp|error sending|email.*send.*fail|mail.*reject'), 'mail_delivery_error',
 match(event_message, '(?i)captcha'), 'captcha',
 match(event_message, '(?i)redirect.*(invalid|not allowed)'), 'redirect_rejected',
 match(event_message, '(?i)error|fail'), 'other_error',
 'other_recovery_event') AS category,
 count() AS events
FROM logs
WHERE source = 'auth_logs'
 AND (log_attributes['path'] IN ('/recover','/auth/v1/recover')
   OR match(event_message, '(?i)/recover|recovery_requested'))
GROUP BY category ORDER BY category LIMIT 10;
