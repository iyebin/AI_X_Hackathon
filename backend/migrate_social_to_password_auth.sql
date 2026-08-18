-- Supabase SQL Editor에서 한 번만 실행하세요.
-- 기존 소셜 관리자 행과 담당자 연결은 삭제하지 않습니다.

BEGIN;

ALTER TABLE institution_managers
    ADD COLUMN IF NOT EXISTS login_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS ix_institution_managers_login_id
    ON institution_managers (login_id)
    WHERE login_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ix_institution_managers_email
    ON institution_managers (email)
    WHERE email IS NOT NULL;

ALTER TABLE institution_managers
    DROP CONSTRAINT IF EXISTS uq_institution_manager_social;

ALTER TABLE institution_managers
    DROP COLUMN IF EXISTS provider,
    DROP COLUMN IF EXISTS provider_user_id;

COMMIT;

-- 참고: 기존 소셜 관리자 행은 login_id/password_hash가 NULL이므로
-- 일반 로그인을 할 수 없습니다. 새 회원가입 API로 만든 계정부터 로그인됩니다.
