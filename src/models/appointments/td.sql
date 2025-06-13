-- Create employees table
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    position VARCHAR(255),
    max_shifts_per_week INTEGER NOT NULL
);

-- Create shifts table
CREATE TABLE shifts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    time VARCHAR(50),
    color VARCHAR(7)
);

-- Create attendance table
CREATE TABLE attendance (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    day VARCHAR(20),
    month VARCHAR(20),
    cycle_start DATE,
    cycle_end DATE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'scheduled', 'completed', 'absent'))
);

-- Create table for employee preferred shifts (many-to-many relationship)
CREATE TABLE employee_preferred_shifts (
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    PRIMARY KEY (employee_id, shift_id)
);

-- Create table for employee unavailable days
CREATE TABLE employee_unavailable_days (
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    day_of_week VARCHAR(20) NOT NULL,
    PRIMARY KEY (employee_id, day_of_week)
);