exports.up = async function (knex) {
    await knex.raw(`
        CREATE TRIGGER after_service_insert 
        AFTER INSERT ON dboservices
        FOR EACH ROW
        BEGIN
            IF (NEW.isoutsourced = 1 AND NEW.outsourceid > 0) THEN
                INSERT INTO outsourcedtesttracking (serviceid, testid, outsourceid, employeeid)
                VALUES (NEW.serviceid, NEW.trackId, NEW.outsourceid, NEW.employeeid);
            END IF;

            IF (NEW.serviceCategory = 'SERVICES' AND NEW.categoryTrackId = 5) THEN
                INSERT INTO servicestracking (serviceid)
                VALUES (NEW.serviceid);
            END IF;

            INSERT INTO dbobillingrefundtable(serviceid)
            VALUES (NEW.serviceid);
        END
    `);
};
exports.down = async function (knex) {
    await knex.raw(`DROP TRIGGER IF EXISTS after_service_insert`);
};
