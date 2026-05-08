const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: 5432,
  database: process.env.DB_NAME || 'simi_erp',
  user: process.env.DB_USER || 'simi_user',
  password: process.env.DB_PASS || 'simi_pass123',
});

// GET - listar productos
app.get('/api/productos', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM productos ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// POST - agregar producto
app.post('/api/productos', async (req, res) => {
  const { nombre, descripcion, precio, stock, categoria } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO productos (nombre, descripcion, precio, stock, categoria)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre, descripcion, precio, stock, categoria]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar producto' });
  }
});

// DELETE - eliminar producto
app.delete('/api/productos/:id', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM productos WHERE id = $1',
      [req.params.id]
    );
    res.json({ mensaje: 'Producto eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

const PORT = process.env.PORT || 80;
app.listen(PORT, () => {
  console.log(`Servidor ERP SIMI corriendo en puerto ${PORT}`);
});