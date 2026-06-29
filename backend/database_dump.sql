PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE users (
	id VARCHAR NOT NULL, 
	email VARCHAR NOT NULL, 
	full_name VARCHAR, 
	profile_image VARCHAR, 
	hashed_password VARCHAR NOT NULL, 
	biometric_secret VARCHAR, 
	created_at DATETIME, 
	updated_at DATETIME, is_admin BOOLEAN DEFAULT 0, is_verified BOOLEAN DEFAULT 0 NOT NULL, verification_token TEXT, 
	PRIMARY KEY (id), 
	UNIQUE (biometric_secret)
);
INSERT INTO users VALUES('a656c033-5197-440c-9b60-076fc34a3dd1','samiraja9090@gmail.com','Abdul Sami Raja ','/uploads/a656c033-5197-440c-9b60-076fc34a3dd1_3d28f9c2-60fa-4092-a949-bc50111188e6.jpg','$pbkdf2-sha256$29000$WSuF8D6nNAZASGlNSUnpvQ$bdmCl1WG0SjzjLY5QHG9mFzleGWxXNNrtYFwFIN6Jio','$pbkdf2-sha256$29000$KQVgTOn9/9.713qvlTJGqA$vMYY3HsZMb5uEGyLg2T1mmpzv545sHOoh1OT9D67hR4','2026-05-04 14:02:14.950293','2026-06-29 10:18:43.084652',0,0,NULL);
INSERT INTO users VALUES('7a707160-ec18-400d-80ea-633e970e963f','arsalan123@gmail.com','Arsalan khan','/uploads/7a707160-ec18-400d-80ea-633e970e963f_1ff0167a-c672-436b-b579-0df6298bedbb.jpg','$pbkdf2-sha256$29000$SmktJYRQqpXy3htDiNFaCw$KTjnFcUasD5R4.k0fV9oYnQ3WbAD9OFgDthndoxk7Bo','$pbkdf2-sha256$29000$Wqt1jpFyTundmzPGuDcGoA$R3enUdHULR3dmn5RUpfmhcvzSC9j2t8ZzZf/wGeJcX0','2026-05-11 16:58:20.850597','2026-06-08 12:53:06.764519',0,0,NULL);
INSERT INTO users VALUES('5107a716-f7e8-4623-8980-089b45e60993','kalim123@gmail.com','Babu kalim Ullah',NULL,'$pbkdf2-sha256$29000$t/Ze6x3jfM.Zcw4BQMg5Rw$SvC0F9ctOrNLvqpj78lj0qoQKoXpJH9vi6pk4V73LGQ',NULL,'2026-05-13 15:45:13.243633','2026-05-13 16:26:50.066495',0,0,NULL);
CREATE TABLE audit_logs (
	id VARCHAR NOT NULL, 
	action VARCHAR NOT NULL, 
	performed_by VARCHAR NOT NULL, 
	target_id VARCHAR, 
	details VARCHAR, 
	timestamp DATETIME, 
	PRIMARY KEY (id)
);
INSERT INTO audit_logs VALUES('f0241a8c-7cfd-41f2-a280-a7cf6edc36e8','DELETE_USER','ADMIN_DASHBOARD','6ad9d27e-5344-4988-807f-2b9f8c475b47','Deleted user: rajasami6060@gmail.com','2026-05-04 13:36:10.157323');
INSERT INTO audit_logs VALUES('d29790cf-4fb7-4a7a-9a37-a18d5e34a6e6','DELETE_USER','ADMIN_DASHBOARD','816ed4de-d7f4-4ba1-bb53-5fdd489c0043','Deleted user: samiraja9090@gmail.com','2026-05-04 13:36:10.157323');
INSERT INTO audit_logs VALUES('9d01212a-45fc-4ea0-87b2-05f20627232f','DELETE_USER','ADMIN_DASHBOARD','6ea3dbdf-10e0-4806-81b5-cb6e5e2bcbdc','Deleted user: samiraja9090@gmail.com','2026-05-04 13:36:10.157323');
INSERT INTO audit_logs VALUES('b173cf94-6999-4b75-b26d-47dfe19cca1a','DELETE_USER','ADMIN_DASHBOARD','a79d73c8-5f11-4bf6-b568-36f6cb350c10','Deleted user: samiraja9090@gmail.com','2026-05-04 13:49:57.700856');
INSERT INTO audit_logs VALUES('89062443-d86b-430d-9d39-bd60cae47a5a','DELETE_USER','ADMIN_DASHBOARD','81c2f17e-82d8-4baf-a0c4-2adc1762775d','Deleted user: samiraja9090@gmail.com','2026-05-04 13:52:29.609808');
INSERT INTO audit_logs VALUES('07a43b10-abe0-4b9f-b393-b6d1b212dc2d','DELETE_USER','ADMIN_DASHBOARD','e29a0534-83a4-48e5-8dc4-39a4f0e06b8c','Deleted user: samiraja9090@gmail.com','2026-05-04 13:59:53.091048');
INSERT INTO audit_logs VALUES('88518704-2f02-4e3a-897e-d749b529b0c3','DELETE_USER','ADMIN_DASHBOARD','8b38cd86-9d0d-4f63-998f-73463be78773','Deleted user: kalim123@gmail.com','2026-05-06 15:16:06.133906');
INSERT INTO audit_logs VALUES('6638ad0f-6e5b-4c75-822d-7d59ef56c6f8','DELETE_USER','SYSTEM_ADMIN','ed614863-f03f-45e6-9d1c-bf418444df05','User account deleted via Admin Dashboard.','2026-05-11 16:56:12.863345');
INSERT INTO audit_logs VALUES('4b90df0a-b6f4-4ee0-8d27-a5d8f697ae43','DELETE_USER','SYSTEM_ADMIN','09bbc1c5-9fb2-4cf3-be34-c71218e34285','User account deleted via Admin Dashboard.','2026-05-13 15:33:25.048420');
INSERT INTO audit_logs VALUES('6726b1c5-ba98-4205-b587-6b61fc1cee01','EMAIL_VERIFIED','b16afef9-1543-4882-b7c3-fe69858c78e8','b16afef9-1543-4882-b7c3-fe69858c78e8','Email verified for samiraja6060@gmail.com','2026-05-16 10:38:19.852168');
INSERT INTO audit_logs VALUES('2cf3bb23-d9f6-451e-ba2f-96f77cb34c91','DELETE_USER','ADMIN_SYSTEM','b16afef9-1543-4882-b7c3-fe69858c78e8','User samiraja6060@gmail.com deleted via dashboard.','2026-05-16 10:43:42.358285');
CREATE INDEX ix_users_full_name ON users (full_name);
CREATE UNIQUE INDEX ix_users_email ON users (email);
CREATE INDEX ix_users_id ON users (id);
CREATE INDEX ix_audit_logs_id ON audit_logs (id);
COMMIT;
