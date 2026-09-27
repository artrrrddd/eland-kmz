CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY,
  type VARCHAR(30) NOT NULL
    CHECK (
      type IN (
        'question',
        'callback',
        'test_drive',
        'service',
        'commercial_offer'
      )
    ),
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  "phoneNormalized" VARCHAR(30) NOT NULL,
  model VARCHAR(100),
  vehicle VARCHAR(100),
  message VARCHAR(2000),
  "branchId" INTEGER NOT NULL DEFAULT 0
    CHECK ("branchId" BETWEEN 0 AND 2),
  status VARCHAR(30) NOT NULL DEFAULT 'new'
    CHECK (
      status IN (
        'new',
        'processing',
        'completed',
        'rejected'
      )
    ),
  "managerId" UUID,
  consent BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "ipHash" VARCHAR(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS applications_created_at_idx
  ON applications ("createdAt" DESC);

CREATE INDEX IF NOT EXISTS applications_status_idx
  ON applications (status);

CREATE INDEX IF NOT EXISTS applications_phone_normalized_idx
  ON applications ("phoneNormalized");

CREATE TABLE IF NOT EXISTS news (
  id UUID PRIMARY KEY,
  "rssKey" TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  link TEXT NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  "publishedAt" TIMESTAMPTZ NOT NULL,
  "fetchedAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source VARCHAR(150) NOT NULL
);

CREATE INDEX IF NOT EXISTS news_published_at_idx
  ON news ("publishedAt" DESC);