exports.seed = async function (knex) {
    await knex('departments').del();
    return knex('departments').insert([
        {
            department: 'Clinical Chemistry',
            departmentManager: 'Tiifu Hamza Kojo Boronson',
            employeeid: 1,
        },
        {
            department: 'Hematology',
            departmentManager: 'Tiifu Hamza Kojo Boronson',
            employeeid: 1,
        },
        {
            department: 'Microbiology',
            departmentManager: 'Tiifu Hamza Kojo Boronson',
            employeeid: 1,
        },
        {
            department: 'Immunology and Serology',
            departmentManager: 'Tiifu Hamza Kojo Boronson',
            employeeid: 1,
        },
        {
            department: 'Molecular Diagnostics',
            departmentManager: 'Tiifu Hamza Kojo Boronson',
            employeeid: 1,
        },
        {
            department: 'Toxicology',
            departmentManager: 'Tiifu Hamza Kojo Boronson',
            employeeid: 1,
        },
        {
            department: 'Endocrinology',
            departmentManager: 'Tiifu Hamza Kojo Boronson',
            employeeid: 1,
        },
        {
            department: 'Urinalysis',
            departmentManager: 'Tiifu Hamza Kojo Boronson',
            employeeid: 1,
        },
        {
            department: 'Blood Bank and Transfusion Medicine',
            departmentManager: 'Tiifu Hamza Kojo Boronson',
            employeeid: 1,
        },
        {
            department: 'Histopathology and Cytology',
            departmentManager: 'Tiifu Hamza Kojo Boronson',
            employeeid: 1,
        },
        {
            department: 'Genetic Testing',
            departmentManager: 'Tiifu Hamza Kojo Boronson',
            employeeid: 1,
        },
        {
            department: 'Point-of-Care Testing (POCT)',
            departmentManager: 'Tiifu Hamza Kojo Boronson',
            employeeid: 1,
        },
        {
            department: 'Specialized Testing',
            departmentManager: 'Tiifu Hamza Kojo Boronson',
            employeeid: 1,
        },
        {
            department: 'Functional and Wellness Testing',
            departmentManager: 'Tiifu Hamza Kojo Boronson',
            employeeid: 1,
        },
        {
            department: 'Imaging and Radiology (Lab-Related)',
            departmentManager: 'Tiifu Hamza Kojo Boronson',
            employeeid: 1,
        },
    ]);
};
