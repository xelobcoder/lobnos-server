
-- CREATE OR REPLACE VIEW daily_analytics_snapshot AS
-- SELECT
--     b.billedon_date AS analytics_date,

--     -- Total billing amount per day
--     COALESCE(SUM(b.totalcost), 0) AS total_billing_amount,
    
--     -- Total Payable amount per day
    
--       COALESCE(SUM(b.payable), 0) AS total_payable_amount,
      
--       COALESCE(SUM(b.paid), 0) AS total_paid_amount,

--     -- Total services rendered per day
--     COALESCE(COUNT(s.serviceid), 0) AS total_services_rendered,

--     -- Total refunds processed per day (refunds completed)
--     COALESCE(SUM(r.amountRefunded), 0) AS total_refunds_processed,

--     -- Total refund payments made per day
--     COALESCE(SUM(rph.amountRefunded), 0) AS total_refund_payments_made,

--     -- Total outstanding amount per day
--     COALESCE(SUM(b.outstanding), 0) AS total_outstanding_amount,

--     -- Total discounts given per day
--     COALESCE(SUM(b.discount), 0) AS total_discounts_given,

--     -- Total tax amounted incurred per day
--     COALESCE(SUM(b.amountIncurredDueTax), 0) AS total_tax_incurred,

--     -- Unique patients billed per day
--     COALESCE(COUNT(DISTINCT b.patientid), 0) AS unique_patients_billed,

--     -- Refund completion rate per day: percentage of refunds completed over total refunds by that date
--     CASE 
--         WHEN COUNT(rf.refundid) = 0 THEN 0
--         ELSE (COUNT(CASE WHEN rf.isRefundCompleted = 1 THEN 1 END) / COUNT(rf.refundid)) * 100
--     END AS refund_completion_rate_percentage

-- FROM
--     -- daily billing summary
--     (
--         SELECT 
--             DATE(billedon) AS billedon_date,
--             billingid,
--             totalcost,
--             outstanding,
--             discount,
--         payable,
--         paid,
--             amountIncurredDueTax,
--             patientid
--         FROM billing
--     ) b

--     LEFT JOIN dboservices s ON s.billingid = b.billingid AND DATE(s.serviceAddedOn) =DATE( b.billedon_date)

--     LEFT JOIN dbobillingrefundtable r ON r.serviceid = s.serviceid AND DATE(r.approvalDate) = b.billedon_date AND r.isRefundCompleted = 1

--     LEFT JOIN refundpaymenthx rph ON rph.refundableid = r.refundid AND DATE(rph.refundedon) = b.billedon_date

--     LEFT JOIN dbobillingrefundtable rf ON DATE(rf.approvalDate) = b.billedon_date

-- GROUP BY b.billedon_date
-- ORDER BY b.billedon_date DESC;

--------------------------------------------------------------------------

-- CREATE VIEW daily_test_transaction_snap_shot AS
-- SELECT 
--     s.serviceAddedOn,
--     DATE(s.serviceAddedOn) AS test_date,
--     s.trackId,
--     s.serviceCategory,
--     CASE 
--         WHEN s.serviceCategory = 'SERVICES' THEN ads.serviceName 
--         ELSE tp.name 
--     END AS test_panel_name,
--     COUNT(s.serviceid) AS test_count,
--     SUM(s.cost) AS total_amount
-- FROM 
--     dboservices s
-- LEFT JOIN 
--     test_panels tp ON (s.serviceCategory != 'SERVICES' AND tp.id = s.trackId)
-- LEFT JOIN 
--     additionalservices ads ON (s.serviceCategory = 'SERVICES' AND s.trackId = ads.keyid)
-- GROUP BY 
--     s.trackId, 
--     s.serviceAddedOn, 
--     s.serviceCategory, 
--     tp.name, 
--     ads.serviceName
-- ORDER BY 
--     s.serviceAddedOn, 
--     s.trackId DESC;




    ------------------------------------------------------------------------


CREATE OR REPLACE VIEW daily_case_source_summary AS
SELECT
  CURDATE() AS report_date,
  COUNT(*) AS total_cases,
  COUNT(CASE WHEN s.registrationType = 'clinician' THEN 1 END) AS clinician_cases,
  COUNT(CASE WHEN s.registrationType = 'organization' THEN 1 END) AS organization_cases,
  COUNT(CASE WHEN s.registrationType = 'self' THEN 1 END) AS self_cases,
  COUNT(CASE WHEN s.registrationType IN ('nhis', 'phis') THEN 1 END) AS insurance_cases
FROM dboservices s
WHERE DATE(s.serviceAddedOn) = CURDATE();


CREATE OR REPLACE VIEW daily_test_summary AS
SELECT
  CURDATE() AS report_date,
  COUNT(DISTINCT s.trackId) AS unique_tests_count,
  COUNT(*) AS total_service_lines,
  SUM(s.totalcost) AS total_test_revenue
FROM dboservices s
WHERE DATE(s.serviceAddedOn) = CURDATE();








    CREATE OR REPLACE VIEW daily_ceo_snapshot_view AS
SELECT
    -- 1. Date Info
    CURDATE() AS report_date,
    DAYNAME(CURDATE()) AS day_of_week,

    -- 2. Service Metrics
    COUNT(s.serviceid) AS total_services_rendered,
    COUNT(DISTINCT s.employeeid) AS total_employees_involved,
    COUNT(DISTINCT b.patientid) AS unique_patients_billed,

    -- 3. Revenue & Cost Metrics
    SUM(s.cost) AS total_service_cost,
    SUM(s.totalcost) AS total_cost_charged,
    SUM(s.totalpayable) AS total_expected_payment,

    -- 4. Tax Metrics
    SUM(s.taxValue) AS total_tax_value,
    SUM(s.amountIncurredDueTax) AS total_tax_applied,

    -- 5. Discounts
    SUM(s.discount) AS total_discount_given,
    COUNT(CASE WHEN s.discount > 0 THEN 1 END) AS discounted_service_count,

    -- 6. Night Adjustments
    SUM(s.hasNightAdjustment) AS services_with_night_adjustment,
    SUM(s.nightAdjustmentValue) AS total_night_adjustment_value,

    -- 7. Payment Metrics
    (
      SELECT IFNULL(SUM(h.Amount), 0)
      FROM billinghx h
      WHERE DATE(h.Date) = CURDATE()
    ) AS total_payments_received,

    (
      SELECT COUNT(*) FROM billinghx
      WHERE DATE(Date) = CURDATE()
    ) AS number_of_payment_transactions,

    -- 8. Refunds
    (
      SELECT IFNULL(SUM(p.amountRefunded), 0)
      FROM refundpaymenthx p
      WHERE DATE(p.refundedon) = CURDATE()
    ) AS total_amount_refunded,

    (
      SELECT COUNT(*) FROM dbobillingrefundtable
      WHERE DATE(firstWitnessDate) = CURDATE()
         OR DATE(secondWitnessDate) = CURDATE()
         OR DATE(thirdWitnessDate) = CURDATE()
    ) AS total_refund_requests_today,

    -- 9. Insurance Usage
    SUM(s.isNHIS) AS nhis_services_count,
    SUM(s.isPHIS) AS phis_services_count,

    -- 10. Packages & Outsourcing
    SUM(s.isPackageUsed) AS packages_used_today,
    SUM(s.isoutsourced) AS outsourced_services_today,

    -- 11. Service Type Distribution
    SUM(CASE WHEN s.registrationType = 'self' THEN 1 ELSE 0 END) AS self_services,
    SUM(CASE WHEN s.registrationType = 'organization' THEN 1 ELSE 0 END) AS organization_services,
    SUM(CASE WHEN s.registrationType = 'clinician' THEN 1 ELSE 0 END) AS clinician_services,

    -- 12. Peak Hour Estimation (simple)
    (
      SELECT HOUR(serviceAddedOn)
      FROM dboservices
      WHERE DATE(serviceAddedOn) = CURDATE()
      GROUP BY HOUR(serviceAddedOn)
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS peak_hour_today

FROM dboservices s
JOIN billing b ON b.billingid = s.billingid
WHERE DATE(s.serviceAddedOn) = CURDATE();




-- SELECT
--   CURDATE() AS report_date,

--   -- Total billed without night adjustment (services with no night adjustment)
--   (SELECT COALESCE(SUM(totalcost), 0)
--    FROM dboservices
--    WHERE hasNightAdjustment = 0 AND DATE(serviceAddedOn) = CURDATE()) AS total_billed_without_night_adjustment,

--   -- Amount gained from night adjustment only (computed)
--   (SELECT COALESCE(SUM(
--     CASE 
--       WHEN nightAdjustmentMode = 'absolute' THEN nightAdjustmentValue
--       WHEN nightAdjustmentMode = 'percentage' THEN cost * nightAdjustmentValue / 100
--       ELSE 0
--     END
--   ), 0)
--    FROM dboservices
--    WHERE hasNightAdjustment = 1 AND DATE(serviceAddedOn) = CURDATE()) AS amount_gained_from_night_adjustment,

--   -- Total billed from night adjusted services
--   (SELECT COALESCE(SUM(totalcost), 0)
--    FROM dboservices
--    WHERE hasNightAdjustment = 1 AND DATE(serviceAddedOn) = CURDATE()) AS total_billed_with_night_adjustment,

--   -- Total billed without night adjustment but including tax (cost + tax) for night-adjusted services
--   (SELECT COALESCE(SUM(cost + amountIncurredDueTax), 0)
--    FROM dboservices
--    WHERE hasNightAdjustment = 1 AND DATE(serviceAddedOn) = CURDATE()) AS billed_without_night_adjustment_part_for_night_adjusted_services,

--   -- Night adjustment uplift (how much night adjustment increased total billed)
--   (SELECT COALESCE(SUM(totalcost - (cost + amountIncurredDueTax)), 0)
--    FROM dboservices
--    WHERE hasNightAdjustment = 1 AND DATE(serviceAddedOn) = CURDATE()) AS night_adjustment_uplift,

--   -- Other stats: package usage, referrals, total cases
--   (SELECT COUNT(*) FROM dboservices WHERE isPackageUsed = 1 AND DATE(serviceAddedOn) = CURDATE()) AS package_cases,
--   (SELECT COALESCE(SUM(totalcost), 0) FROM dboservices WHERE isPackageUsed = 1 AND DATE(serviceAddedOn) = CURDATE()) AS package_total_value,

--   (SELECT COUNT(*) FROM dboservices WHERE DATE(serviceAddedOn) = CURDATE()) AS total_cases,
--   (SELECT COUNT(*) FROM dboservices WHERE registrationType = 'clinician' AND DATE(serviceAddedOn) = CURDATE()) AS clinician_referrals,
--   (SELECT COUNT(*) FROM dboservices WHERE registrationType = 'organization' AND DATE(serviceAddedOn) = CURDATE()) AS organization_referrals,
--   (SELECT COUNT(*) FROM dboservices WHERE registrationType = 'self' AND DATE(serviceAddedOn) = CURDATE()) AS self_cases
-- ;


-- CREATE OR REPLACE VIEW clinician_daily_sales_summary AS
-- SELECT 
--     DATE(s.serviceAddedOn) AS sale_date,
--     c.id AS clinician_id,
--     c.name AS clinician_name,
--     c.phone AS clinician_phone,
--     c.occupation,
--     c.organization,
--     COUNT(*) AS total_services,
--     SUM(s.totalcost) AS total_value,
--     SUM(CASE WHEN s.categoryTrackId = 6 THEN 1 ELSE 0 END) AS additional_services_count,
--     SUM(CASE WHEN s.categoryTrackId != 6 THEN 1 ELSE 0 END) AS test_panels_count
-- FROM 
--     dboservices s
-- JOIN 
--     clinicianbasicinfo c ON s.clinicianId = c.id
-- WHERE 
--     s.clinicianId != 0
--     AND s.serviceAddedOn IS NOT NULL
--     AND s.totalcost > 0
-- GROUP BY 
--     DATE(s.serviceAddedOn),
--     c.id,
--     c.name,
--     c.phone,
--     c.occupation,
--     c.organization
-- ORDER BY 
--     sale_date DESC,
--     total_value DESC;
 

ORDER BY c.name, total_value DESC;



SELECT
  DATE(s.serviceAddedOn) AS service_date,
  c.id AS clinician_id,
  c.name AS clinician_name,
  
  CASE 
    WHEN s.categoryTrackId = 6 THEN a.serviceName
    ELSE t.name
  END AS service_name,
  
  CASE 
    WHEN s.categoryTrackId = 6 THEN 'Non-Test Service'
    ELSE 'Test Panel'
  END AS service_type,

  COUNT(*) AS times_performed,
  SUM(s.totalcost) AS total_amount
FROM dboservices s
LEFT JOIN additionalservices a 
  ON s.categoryTrackId = 6 AND s.trackid = a.keyid
LEFT JOIN test_panels t 
  ON s.categoryTrackId != 6 AND s.trackid = t.id
LEFT JOIN clinicianbasicinfo c 
  ON s.clinicianId = c.id
WHERE s.registrationType = 'clinician' 
  AND s.clinicianId !=0
GROUP BY service_name, clinician_id, service_type, service_date
ORDER BY total_amount DESC;


