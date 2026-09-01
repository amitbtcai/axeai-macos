CREATE TRIGGER `app_access_invitation_sent_audit`
AFTER INSERT ON `app_access_invitation`
BEGIN
	INSERT INTO `audit_log` (`id`, `user_id`, `action`, `detail`)
	VALUES (lower(hex(randomblob(16))), NEW.`owner_user_id`, 'cloud_app_invitation_sent', NULL);
END;--> statement-breakpoint
CREATE TRIGGER `app_access_invitation_accepted_audit`
AFTER UPDATE OF `accepted_at` ON `app_access_invitation`
WHEN OLD.`accepted_at` IS NULL AND NEW.`accepted_at` IS NOT NULL
BEGIN
	INSERT INTO `audit_log` (`id`, `user_id`, `action`, `detail`)
	VALUES (lower(hex(randomblob(16))), NEW.`invitee_user_id`, 'cloud_app_invitation_accepted', NULL);
END;--> statement-breakpoint
CREATE TRIGGER `app_access_invitation_revoked_audit`
AFTER UPDATE OF `revoked_at` ON `app_access_invitation`
WHEN OLD.`revoked_at` IS NULL AND NEW.`revoked_at` IS NOT NULL
BEGIN
	INSERT INTO `audit_log` (`id`, `user_id`, `action`, `detail`)
	VALUES (lower(hex(randomblob(16))), NEW.`owner_user_id`, 'cloud_app_invitation_revoked', NULL);
END;
