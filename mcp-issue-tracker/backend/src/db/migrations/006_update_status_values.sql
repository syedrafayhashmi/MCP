-- Create a backup table with normalized data (align existing values with allowed statuses)
DROP TABLE IF EXISTS issues_backup;
CREATE TABLE issues_backup AS
SELECT 
    id,
    title,
    description,
    CASE
        WHEN status IN ('not_started', 'open', 'backlog', 'todo') THEN 'not_started'
        WHEN status IN ('done', 'resolved', 'closed', 'complete') THEN 'done'
        WHEN status IN ('in_progress', 'active', 'in-progress') THEN 'in_progress'
        ELSE 'not_started'
    END AS status,
    assigned_user_id,
    created_by_user_id,
    created_at,
    updated_at,
    priority
FROM issues;

DROP TABLE issues;

CREATE TABLE issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'done')),
    assigned_user_id TEXT,
    created_by_user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    FOREIGN KEY (assigned_user_id) REFERENCES user(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES user(id) ON DELETE CASCADE
);

INSERT INTO issues (
    id,
    title,
    description,
    status,
    assigned_user_id,
    created_by_user_id,
    created_at,
    updated_at,
    priority
)
SELECT
    id,
    title,
    description,
    status,
    assigned_user_id,
    created_by_user_id,
    created_at,
    updated_at,
    priority
FROM issues_backup;

DROP TABLE issues_backup;

CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_user_id ON issues(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_issues_created_by_user_id ON issues(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);

CREATE TRIGGER IF NOT EXISTS update_issues_updated_at 
    AFTER UPDATE ON issues
    FOR EACH ROW
    BEGIN
        UPDATE issues SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
