TRUNCATE TABLE mainstoresupply;
TRUNCATE TABLE generalstorecredithx;
TRUNCATE TABLE departmentsmainsupply;
TRUNCATE TABLE orders;
TRUNCATE TABLE generalstoredebithx;

TRUNCATE TABLE stocksesrow;
TRUNCATE TABLE departmentrequisitionhx;
TRUNCATE TABLE departmentrequisition;

UPDATE generalstocks SET quantity = 0;
UPDATE departmentstocks SET quantityAvailable = 0;
