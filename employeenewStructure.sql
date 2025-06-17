-- Drop tables if they exist (for clean re-import)
DROP TABLE IF EXISTS paymenthistory;
DROP TABLE IF EXISTS allowancesdeductions;
DROP TABLE IF EXISTS salarystructure;
DROP TABLE IF EXISTS performancereviews;
DROP TABLE IF EXISTS securityclearance;
DROP TABLE IF EXISTS securityclearancelevels;
DROP TABLE IF EXISTS employmentdocuments;
DROP TABLE IF EXISTS performancemetrics;
DROP TABLE IF EXISTS workflowassignments;
DROP TABLE IF EXISTS auditlogs;
DROP TABLE IF EXISTS sopsignoffs;
DROP TABLE IF EXISTS trainingrecords;
DROP TABLE IF EXISTS rolespermissions;
DROP TABLE IF EXISTS logincredentials;
DROP TABLE IF EXISTS roles;

-- 1. roles – Core Employee Profile
CREATE TABLE roles (
  employeeid INT NOT NULL AUTO_INCREMENT,
  designation enum('Mr','Mrs','Ms','Dr','Prof') DEFAULT 'Mr',
  username VARCHAR(255) NOT NULL UNIQUE,
  firstname VARCHAR(100) NOT NULL,
  middlename VARCHAR(100) DEFAULT NULL,
  lastname VARCHAR(100) NOT NULL,
  fullname VARCHAR(255) GENERATED ALWAYS AS (
    CONCAT_WS(' ', firstname,middlename, lastname)
  ) STORED,
  gender enum('Male','Female','Other') DEFAULT 'Male',
  address VARCHAR(255),
  jobtitle VARCHAR(255),
  department VARCHAR(100),
  email VARCHAR(200) NOT NULL,
  mobile VARCHAR(15),
  alternativemobile VARCHAR(15),
  dob DATE,
  worklocation VARCHAR(255),
  employmenttype ENUM('Full-time', 'Part-time', 'Contractor', 'Intern') DEFAULT 'Full-time',
  startdate DATE,
  enddate DATE,
  branchid INT,
  imageurl VARCHAR(255),
  ssnitnumber VARCHAR(50) DEFAULT NULL,
  taxid VARCHAR(50) DEFAULT NULL,
  nationalid VARCHAR(50) DEFAULT NULL,
  passportnumber VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (employeeid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE hr_employeemergencycontacts (
  contactid INT NOT NULL AUTO_INCREMENT,
  employeeid INT NOT NULL,
  contactname VARCHAR(255) NOT NULL,
  relationship VARCHAR(100),
  contactphone VARCHAR(15),
  contactemail VARCHAR(200),
  PRIMARY KEY (contactid),
  FOREIGN KEY (employeeid) REFERENCES roles(employeeid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. logincredentials – LIMS Login & Access Control
CREATE TABLE hr_employeelogincredentials (
  credentialid INT NOT NULL AUTO_INCREMENT,
  employeeid INT NOT NULL,
  password VARCHAR(255) NOT NULL,
  pin INT(4) DEFAULT 0,
  authenticationmethod enum ('password','sms','email') DEFAULT 'password',
  accountstatus ENUM('Active', 'Inactive', 'Locked') DEFAULT 'Active',
  activation TINYINT(1) NOT NULL DEFAULT 0,
  refreshtoken VARCHAR(255),
  lastlogin DATETIME,
  emailauthenticated BOOLEAN DEFAULT FALSE,
  datecreated DATE DEFAULT CURRENT_DATE,
  timecreated TIME(6) DEFAULT CURRENT_TIME(6),
  updatedon DATETIME(6),
  PRIMARY KEY (credentialid),
  FOREIGN KEY (employeeid) REFERENCES roles(employeeid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. rolespermissions – Role and System Permissions
CREATE TABLE hr_rolespermissions (
  roleid INT NOT NULL AUTO_INCREMENT,
  employeeid INT NOT NULL,
  rolename VARCHAR(255) NOT NULL,
  permissions JSON DEFAULT '{}',
  accessrights TEXT,
  PRIMARY KEY (roleid),
  FOREIGN KEY (employeeid) REFERENCES roles(employeeid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. trainingrecords – Training & Certification
CREATE TABLE hr_trainingrecords (
  trainingid INT NOT NULL AUTO_INCREMENT,
  employeeid INT NOT NULL,
  trainingname VARCHAR(255),
  completiondate DATE,
  refresherduedate DATE,
  competencyscore DECIMAL(5,2),
  certificationfileurl VARCHAR(255),
  PRIMARY KEY (trainingid),
  FOREIGN KEY (employeeid) REFERENCES roles(employeeid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. sopsignoffs – SOP Acknowledgements
CREATE TABLE sopsignoffs (
  signoffid INT NOT NULL AUTO_INCREMENT,
  employeeid INT NOT NULL,
  sopid VARCHAR(50),
  signedon DATE,
  PRIMARY KEY (signoffid),
  FOREIGN KEY (employeeid) REFERENCES roles(employeeid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. auditlogs – Digital Signatures & Action Tracking
CREATE TABLE hr_auditlogs (
  auditid INT NOT NULL AUTO_INCREMENT,
  employeeid INT NOT NULL,
  action VARCHAR(255),
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  digitalsignature VARCHAR(255),
  PRIMARY KEY (auditid),
  FOREIGN KEY (employeeid) REFERENCES roles(employeeid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. workflowassignments – Assigned Tasks and Instruments
CREATE TABLE hr_workflowassignments (
  assignmentid INT NOT NULL AUTO_INCREMENT,
  employeeid INT NOT NULL,
  workflowname VARCHAR(255),
  instrumentname VARCHAR(255),
  projectname VARCHAR(255),
  PRIMARY KEY (assignmentid),
  FOREIGN KEY (employeeid) REFERENCES roles(employeeid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. performancemetrics – Work Metrics & QA Outcomes
CREATE TABLE hr_performancemetrics (
  metricid INT NOT NULL AUTO_INCREMENT,
  employeeid INT NOT NULL,
  samplesprocessed INT DEFAULT 0,
  errorsreported INT DEFAULT 0,
  qaoutcomes TEXT,
  reportdate DATE DEFAULT CURRENT_DATE,
  PRIMARY KEY (metricid),
  FOREIGN KEY (employeeid) REFERENCES roles(employeeid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. employmentdocuments – HR Document Storage
CREATE TABLE employmentdocuments (
  documentid INT NOT NULL AUTO_INCREMENT,
  employeeid INT NOT NULL,
  documenttype VARCHAR(100),
  documenturl VARCHAR(255),
  uploadedon DATE DEFAULT CURRENT_DATE,
  PRIMARY KEY (documentid),
  FOREIGN KEY (employeeid) REFERENCES roles(employeeid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. securityclearancelevels – Lookup Table for Clearance Levels
CREATE TABLE securityclearancelevels (
  levelid INT NOT NULL AUTO_INCREMENT,
  clearancelevel VARCHAR(50) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  PRIMARY KEY (levelid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Populate clearance levels
INSERT INTO securityclearancelevels (clearancelevel, description) VALUES
('Visitor', 'No access to secure areas. Temporary and accompanied only.'),
('Basic', 'Entry-level clearance. Access to general office areas and non-sensitive data.'),
('Standard', 'Regular employee access to departmental tools, systems, and workspaces.'),
('Confidential', 'Access to internal documents, research, and proprietary SOPs.'),
('Restricted', 'Mid-level access to project-specific data and instruments.'),
('Secret', 'Access to HR, payroll, compliance, and sensitive project data.'),
('Top Secret', 'Full system access, including surveillance, override, and strategic controls.');

-- 11. securityclearance – Link to employee and level
CREATE TABLE securityclearance (
  clearanceid INT NOT NULL AUTO_INCREMENT,
  employeeid INT NOT NULL,
  levelid INT,
  badgeid VARCHAR(50),
  accessexpiry DATE,
  PRIMARY KEY (clearanceid),
  FOREIGN KEY (employeeid) REFERENCES roles(employeeid) ON DELETE CASCADE,
  FOREIGN KEY (levelid) REFERENCES securityclearancelevels(levelid) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. performancereviews – Periodic Reviews & Scores
CREATE TABLE performancereviews (
  reviewid INT NOT NULL AUTO_INCREMENT,
  employeeid INT NOT NULL,
  reviewperiodstart DATE,
  reviewperiodend DATE,
  reviewername VARCHAR(255),
  score DECIMAL(4,2),
  comments TEXT,
  PRIMARY KEY (reviewid),
  FOREIGN KEY (employeeid) REFERENCES roles(employeeid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. salarystructure – Base Salary & Compensation
CREATE TABLE salarystructure (
  salaryid INT NOT NULL AUTO_INCREMENT,
  employeeid INT NOT NULL,
  paygrade VARCHAR(50),
  basesalary DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  paymentfrequency ENUM('Monthly', 'Biweekly', 'Weekly') DEFAULT 'Monthly',
  taxdeductionrate DECIMAL(5,2),
  effectivefrom DATE,
  effectiveto DATE,
  PRIMARY KEY (salaryid),
  FOREIGN KEY (employeeid) REFERENCES roles(employeeid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14. allowancesdeductions – Bonuses, Allowances & Deductions
CREATE TABLE allowancesdeductions (
  adid INT NOT NULL AUTO_INCREMENT,
  employeeid INT NOT NULL,
  type ENUM('Allowance', 'Deduction') NOT NULL,
  category VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL,
  applicablemonth DATE,
  notes TEXT,
  PRIMARY KEY (adid),
  FOREIGN KEY (employeeid) REFERENCES roles(employeeid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 15. paymenthistory – Salary Payment Records
CREATE TABLE paymenthistory (
  paymentid INT NOT NULL AUTO_INCREMENT,
  employeeid INT NOT NULL,
  payperiodstart DATE NOT NULL,
  payperiodend DATE NOT NULL,
  grossamount DECIMAL(10,2),
  netamount DECIMAL(10,2),
  paymentdate DATE,
  paymentmethod VARCHAR(50),
  transactionreference VARCHAR(100),
  PRIMARY KEY (paymentid),
  FOREIGN KEY (employeeid) REFERENCES roles(employeeid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Add indexes for performance optimization
CREATE INDEX idx_employee_username ON roles (username);
CREATE INDEX idx_employee_email ON roles (email);
CREATE INDEX idx_employee_department ON roles (department);
CREATE INDEX idx_login_employee ON logincredentials (employeeid);
CREATE INDEX idx_role_employee ON rolespermissions (employeeid);
CREATE INDEX idx_training_employee ON trainingrecords (employeeid);
CREATE INDEX idx_signoff_employee ON sopsignoffs (employeeid);