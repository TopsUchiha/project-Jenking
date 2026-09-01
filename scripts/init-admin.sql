INSERT OR IGNORE INTO admin_users (email, password_hash, role, is_active) 
VALUES ('smokersandgrillsb@gmail.com', '$2b$12$abcdefghijklmnopqrstuvwxyzabcdef', 'admin', 1);

INSERT OR IGNORE INTO shipping_settings (base_fee, tax_rate) 
VALUES (149.00, 0.0825);
