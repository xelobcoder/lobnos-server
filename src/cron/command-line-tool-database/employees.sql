CREATE TABLE employees_designations (
    designationId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    departmentId INT UNSIGNED DEFAULT NULL,
    designationName VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (departmentId)
        REFERENCES employees_departments(departmentId)
        ON DELETE SET NULL
);




CREATE TABLE employees_credentials (
    credentialId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    employeeId INT UNSIGNED NOT NULL,

    username VARCHAR(255) NOT NULL UNIQUE,

    passwordHash VARCHAR(255) NOT NULL,

    pin INT UNSIGNED DEFAULT 0,

    refreshToken VARCHAR(255) DEFAULT NULL,

    emailVerified TINYINT(1) DEFAULT 0,

    accountActivated TINYINT(1) DEFAULT 0,

    lastLogin DATETIME DEFAULT NULL,

    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (employeeId)
        REFERENCES roles(employeeId)
        ON DELETE CASCADE
);

CREATE TABLE employees_contacts (
    contactId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    employeeId INT UNSIGNED NOT NULL,

    email VARCHAR(200) DEFAULT NULL,

    mobile VARCHAR(20) DEFAULT NULL,

    alternativeMobile VARCHAR(20) DEFAULT NULL,

    address TEXT,

    city VARCHAR(100),

    state VARCHAR(100),

    country VARCHAR(100),

    postalCode VARCHAR(20),

    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (email),

    UNIQUE (mobile),

    FOREIGN KEY (employeeId)
        REFERENCES roles(employeeId)
        ON DELETE CASCADE
);

CREATE TABLE employees_role_assignments (
    employeeId INT UNSIGNED NOT NULL,

    roleId INT UNSIGNED NOT NULL,

    assignedAt DATETIME DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (employeeId, roleId),

    FOREIGN KEY (employeeId)
        REFERENCES roles(employeeId)
        ON DELETE CASCADE,

    FOREIGN KEY (roleId)
        REFERENCES employees_roles(roleId)
        ON DELETE CASCADE
);

CREATE TABLE employees_role_permissions (
    roleId INT UNSIGNED NOT NULL,

    permissionId INT UNSIGNED NOT NULL,

    PRIMARY KEY (roleId, permissionId),

    FOREIGN KEY (roleId)
        REFERENCES employees_roles(roleId)
        ON DELETE CASCADE,

    FOREIGN KEY (permissionId)
        REFERENCES employees_permissions(permissionId)
        ON DELETE CASCADE
);

CREATE TABLE employees_education (
    educationId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    employeeId INT UNSIGNED NOT NULL,

    institution VARCHAR(255) NOT NULL,

    degree VARCHAR(255),

    fieldOfStudy VARCHAR(255),

    startDate DATE,

    endDate DATE,

    grade VARCHAR(100),

    certificateNumber VARCHAR(100),

    FOREIGN KEY (employeeId)
        REFERENCES roles(employeeId)
        ON DELETE CASCADE
);

CREATE TABLE employees_licenses (
    licenseId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    employeeId INT UNSIGNED NOT NULL,

    licenseName VARCHAR(255),

    licenseNumber VARCHAR(100),

    issuingAuthority VARCHAR(255),

    issueDate DATE,

    expiryDate DATE,

    FOREIGN KEY (employeeId)
        REFERENCES roles(employeeId)
        ON DELETE CASCADE
);

CREATE TABLE employees_certifications (
    certificationId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    employeeId INT UNSIGNED NOT NULL,

    certificationName VARCHAR(255),

    organization VARCHAR(255),

    issueDate DATE,

    expiryDate DATE,

    FOREIGN KEY (employeeId)
        REFERENCES roles(employeeId)
        ON DELETE CASCADE
);

CREATE TABLE employees_employment_history (
    historyId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    employeeId INT UNSIGNED NOT NULL,

    organization VARCHAR(255),

    position VARCHAR(255),

    startDate DATE,

    endDate DATE,

    responsibilities TEXT,

    FOREIGN KEY (employeeId)
        REFERENCES roles(employeeId)
        ON DELETE CASCADE
);

CREATE TABLE employees_emergency_contacts (
    emergencyContactId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    employeeId INT UNSIGNED NOT NULL,

    fullName VARCHAR(255) NOT NULL,

    relationship VARCHAR(100),

    mobile VARCHAR(20),

    address TEXT,

    FOREIGN KEY (employeeId)
        REFERENCES roles(employeeId)
        ON DELETE CASCADE
);

CREATE TABLE employees_documents (
    documentId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    employeeId INT UNSIGNED NOT NULL,

    documentType ENUM(
        'cv',
        'certificate',
        'license',
        'passport',
        'national_id',
        'appointment_letter',
        'other'
    ),

    fileName VARCHAR(255),

    filePath VARCHAR(500),

    uploadedAt DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (employeeId)
        REFERENCES roles(employeeId)
        ON DELETE CASCADE
);

CREATE TABLE employees_bank_accounts (
    bankAccountId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    employeeId INT UNSIGNED NOT NULL,

    bankName VARCHAR(255),

    accountName VARCHAR(255),

    accountNumber VARCHAR(100),

    branchName VARCHAR(255),

    mobileMoneyNumber VARCHAR(20),

    FOREIGN KEY (employeeId)
        REFERENCES roles(employeeId)
        ON DELETE CASCADE
);

CREATE TABLE employees_attendance (
    attendanceId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    employeeId INT UNSIGNED NOT NULL,

    attendanceDate DATE NOT NULL,

    checkIn DATETIME,

    checkOut DATETIME,

    FOREIGN KEY (employeeId)
        REFERENCES roles(employeeId)
        ON DELETE CASCADE
);



CREATE TABLE employees_performance_reviews (
    reviewId INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    employeeId INT UNSIGNED NOT NULL,

    reviewerId INT UNSIGNED DEFAULT NULL,

    reviewPeriodStart DATE,

    reviewPeriodEnd DATE,

    punctualityScore DECIMAL(5,2) DEFAULT NULL,

    teamworkScore DECIMAL(5,2) DEFAULT NULL,

    productivityScore DECIMAL(5,2) DEFAULT NULL,

    communicationScore DECIMAL(5,2) DEFAULT NULL,

    professionalismScore DECIMAL(5,2) DEFAULT NULL,

    overallScore DECIMAL(5,2) DEFAULT NULL,

    strengths TEXT,

    weaknesses TEXT,

    recommendations TEXT,

    reviewComments TEXT,

    reviewDate DATE,

    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (employeeId)
        REFERENCES roles(employeeId)
        ON DELETE CASCADE,

    FOREIGN KEY (reviewerId)
        REFERENCES roles(employeeId)
        ON DELETE SET NULL
);