
CREATE TABLE documents(
 id UUID PRIMARY KEY,
 user_id UUID NOT NULL,
 title TEXT,
 storage_path TEXT,
 status TEXT DEFAULT 'uploaded',
 created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chunks(
 id UUID PRIMARY KEY,
 document_id UUID REFERENCES documents(id),
 content TEXT,
 metadata JSONB
);
