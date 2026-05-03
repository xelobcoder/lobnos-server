exports.seed = async function (knex) {
    return knex('departments').insert([
        {
            department: 'BioChemistry',
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
            department: 'Ultrasound',
            departmentManager: 'Tiifu Hamza Kojo Boronson',
            employeeid: 1,
        },
    ]);
};
