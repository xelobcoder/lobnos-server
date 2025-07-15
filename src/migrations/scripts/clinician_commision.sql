
DROP PROCEDURE IF EXISTS cl_get_clinician_commission;
DELIMITER //
CREATE PROCEDURE cl_get_clinician_commission(
    IN start_date DATE,
    IN end_date DATE
)
BEGIN
    SELECT
        DATE(s.serviceAddedOn) AS service_date,
        c.id AS clinician_id,
        c.name AS clinician_name,
        c.phone AS clinician_phone,
        c.occupation,
        c.organization,
        COUNT(*) AS total_services,
        SUM(s.totalpayable) AS total_value,
        COALESCE(cp.commission, 0) AS commission_percent,
        ROUND(SUM(s.totalpayable) * (COALESCE(cp.commission, 0) / 100), 2) AS commission_earned
    FROM dboservices s
    INNER JOIN clinicianbasicinfo c
        ON s.clinicianId = c.id
    LEFT JOIN clinicianpaymentinfo cp 
        ON cp.clinicianid = c.id
    WHERE
        s.serviceCategory = 'CLINICIAN_SPECIAL_BILLING'
        AND s.status = 'active'
        AND s.isAdjustment = 0
        AND s.serviceAddedOn >= start_date
        AND s.serviceAddedOn < end_date
        AND s.clinicianId IS NOT NULL
    GROUP BY 
        service_date,
        c.id, 
        c.name,
        c.phone,
        c.occupation,
        c.organization,
        cp.commission
    ORDER BY 
        service_date DESC, 
        commission_earned DESC,
        c.id DESC;
END //
DELIMITER ;

DROP PROCEDURE IF EXISTS cl_get_single_clinician_commission;
DELIMITER //
CREATE PROCEDURE cl_get_single_clinician_commission(
    IN clinician_id INT,
    IN start_date DATE,
    IN end_date DATE
)
BEGIN
    SELECT
        DATE(s.serviceAddedOn) AS service_date,
        c.id AS clinician_id,
        c.name AS clinician_name,
        c.phone AS clinician_phone,
        c.occupation,
        c.organization,
        COUNT(*) AS total_services,
        SUM(s.totalpayable) AS total_value,
        COALESCE(cp.commission, 0) AS commission_percent,
        ROUND(SUM(s.totalpayable) * (COALESCE(cp.commission, 0) / 100), 2) AS commission_earned
    FROM dboservices s
    INNER JOIN clinicianbasicinfo c
        ON s.clinicianId = c.id
    LEFT JOIN clinicianpaymentinfo cp 
        ON cp.clinicianid = c.id
    WHERE
        s.clinicianId = clinician_id
        AND s.serviceCategory = 'CLINICIAN_SPECIAL_BILLING'
        AND s.status = 'active'
        AND s.isAdjustment = 0
        AND s.serviceAddedOn >= start_date
        AND s.serviceAddedOn < end_date
    GROUP BY 
        service_date,
        c.id, 
        c.name,
        c.phone,
        c.occupation,
        c.organization,
        cp.commission
    ORDER BY 
        service_date DESC, 
        commission_earned DESC;
END //
DELIMITER ;
