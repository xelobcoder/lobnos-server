-- =============================================
-- ✅ LIMS SMS MODULE - FULL MYSQL SCHEMA (FINAL, PREFIXED WITH 'prime', NO UNDERSCORES)
-- =============================================

-- 1. SMS Template Table
CREATE TABLE primesmstemplates (
  templateid     BIGINT PRIMARY KEY AUTO_INCREMENT,
  name           VARCHAR(100) NOT NULL,
  body           TEXT NOT NULL,
  category       ENUM('patient', 'clinician', 'organization') NOT NULL,
  createdby      BIGINT NOT NULL,
  createdat      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. SMS Jobs Table
CREATE TABLE primesmsjobs (
  jobid           BIGINT PRIMARY KEY AUTO_INCREMENT,
  templateid      BIGINT,
  category        ENUM('patient', 'clinician', 'organization') NOT NULL,
  recipientscope  ENUM('single', 'multiple', 'all') NOT NULL,
  targetids       JSON NULL,
  sendtype        ENUM('immediate', 'scheduled') NOT NULL,
  scheduledat     DATETIME NULL,
  status          ENUM('pending', 'processing', 'sent', 'partialfailed', 'failed') DEFAULT 'pending',
  createdby       BIGINT NOT NULL,
  createdat       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. SMS Recipients
CREATE TABLE primesmsjobrecipients (
  recid            BIGINT PRIMARY KEY AUTO_INCREMENT,
  jobid            BIGINT NOT NULL,
  phonee164        VARCHAR(20) NOT NULL,
  personalizedbody TEXT NOT NULL,
  deliverystatus   ENUM('queued','sent','failed','retrying') DEFAULT 'queued',
  sentat           DATETIME NULL,
  errorcode        VARCHAR(100) NULL,
  FOREIGN KEY (jobid) REFERENCES primesmsjobs(jobid) ON DELETE CASCADE
);

-- 4. Category Mapping
CREATE TABLE primesmscategorymappings (
  id               BIGINT PRIMARY KEY AUTO_INCREMENT,
  category         ENUM('patient', 'clinician', 'organization') NOT NULL,
  tablename        VARCHAR(100) NOT NULL,
  idcolumn         VARCHAR(100) NOT NULL,
  phonecolumn      VARCHAR(100), -- NULLABLE for accession category
  namecolumn       VARCHAR(100),
  additionalfields JSON NULL
);

-- 5. Placeholder Rules
CREATE TABLE primesmsplaceholderrules (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  category     ENUM('patient', 'clinician', 'organization') NOT NULL,
  placeholder  VARCHAR(100) NOT NULL,
  columnname   VARCHAR(100) NOT NULL,
  tablename    VARCHAR(100) NOT NULL,
  description  TEXT
);

-- 6. Event Definitions
CREATE TABLE primesmsevents (
  eventid     BIGINT PRIMARY KEY AUTO_INCREMENT,
  code        VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  category    ENUM('patient', 'clinician', 'organization') NOT NULL,
  createdat   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Event Template Linking
CREATE TABLE primesmseventtemplates (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  eventid     BIGINT NOT NULL,
  templateid  BIGINT NOT NULL,
  isactive    BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (eventid) REFERENCES primesmsevents(eventid),
  FOREIGN KEY (templateid) REFERENCES primesmstemplates(templateid)
);

-- ✅ End of SMS Schema
