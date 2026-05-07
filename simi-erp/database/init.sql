CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL,
    stock INTEGER DEFAULT 0,
    categoria VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO productos (nombre, descripcion, precio, stock, categoria) VALUES
('Paracetamol 500mg', 'Analgesico y antipiretico', 990, 150, 'Analgesicos'),
('Ibuprofeno 400mg', 'Antiinflamatorio', 1290, 80, 'Analgesicos'),
('Amoxicilina 500mg', 'Antibiotico amplio espectro', 3500, 40, 'Antibioticos');