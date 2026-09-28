CREATE TABLE IF NOT EXISTS applications (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  type ENUM('question', 'callback', 'test_drive', 'service', 'commercial_offer') NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  `phoneNormalized` VARCHAR(30) NOT NULL,
  model VARCHAR(100),
  vehicle VARCHAR(100),
  message VARCHAR(2000),
  `branchId` INT NOT NULL DEFAULT 0 CHECK (`branchId` BETWEEN 0 AND 2),
  status ENUM('new', 'processing', 'completed', 'rejected') NOT NULL DEFAULT 'new',
  `managerId` CHAR(36) CHARACTER SET ascii COLLATE ascii_bin,
  consent BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ipHash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  INDEX applications_created_at_idx (`createdAt`),
  INDEX applications_status_idx (status),
  INDEX applications_phone_normalized_idx (`phoneNormalized`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS news (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  `rssKey` TEXT NOT NULL,
  `rssKeyHash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  title TEXT NOT NULL,
  link TEXT NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  `publishedAt` DATETIME(3) NOT NULL,
  `fetchedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  source VARCHAR(150) NOT NULL,
  INDEX news_published_at_idx (`publishedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_rate_limits (
  `key` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  hits BIGINT NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  INDEX api_rate_limits_expires_idx (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
