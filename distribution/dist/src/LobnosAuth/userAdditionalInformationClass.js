"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class userAdditionalInformationClass {
    constructor(tenantid) {
        this.tableName = "userAdditionalInformation";
        this.tenantId = tenantid;
    }
    initializeTable() {
        const table = `CREATE TABLE IF NOT EXISTS userAdditionalInformation (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            branch_id INT,
            certificate_url VARCHAR(255),
            license_url VARCHAR(255),
            primary_education VARCHAR(255),
            secondary_education VARCHAR(255),
            tertiary_education VARCHAR(255),
            other_education VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          );
          `;
        return;
    }
    async getUserAdditionalInformation(tenantId, userId) {
    }
}
