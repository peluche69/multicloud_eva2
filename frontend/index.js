require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const SECRET = process.env.JWT_SECRET || 'simi_secret_key_2026';
const ENC_KEY = process.env.TOTP_ENCRYPTION_KEY;
const SECRETS_FILE = path.join(__dirname, 'totp_secrets.json');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME || 'simi_erp',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS,
  ssl: { rejectUnauthorized: false }
});

const usuarios = [
  { id: 1, username: 'admin', password: 'admin123', role: 'admin' },
  { id: 2, username: 'farmacia', password: 'farm123', role: 'user' }
];

function cargarSecretos() {
  if (!fs.existsSync(SECRETS_FILE)) return {};
  return JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8'));
}

function guardarSecretos(data) {
  fs.writeFileSync(SECRETS_FILE, JSON.stringify(data, null, 2));
}

function encriptar(texto) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENC_KEY), iv);
  const enc = Buffer.concat([cipher.update(texto), cipher.final()]);
  return iv.toString('hex') + ':' + enc.toString('hex');
}

function desencriptar(texto) {
  const [ivHex, encHex] = texto.split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENC_KEY), Buffer.from(ivHex, 'hex'));
  const dec = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]);
  return dec.toString();
}

function verificarToken(req, res, next) {
  const auth = req.headers['authorization'];
  const token = auth && auth.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(403).json({ error: 'Token invalido o expirado' });
  }
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = usuarios.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });

  const secretos = cargarSecretos();
  if (!secretos[username] || !secretos[username].activo) {
    return res.json({ step: 'setup_totp', username });
  }

  res.json({ step: 'verify_totp', username });
});

app.post('/api/totp/setup', (req, res) => {
  const { username } = req.body;
  const user = usuarios.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'Usuario no válido' });

  const secretObj = speakeasy.generateSecret({
    name: `Farmacias SIMI (${username})`
  });

  const secretos = cargarSecretos();
  secretos[username] = { secret: encriptar(secretObj.base32), activo: false };
  guardarSecretos(secretos);

  qrcode.toDataURL(secretObj.otpauth_url, (err, qr) => {
    res.json({ qr, secret: secretObj.base32 });
  });
});

app.post('/api/totp/verify', (req, res) => {
  const { username, token } = req.body;
  const secretos = cargarSecretos();
  const entrada = secretos[username];

  if (!entrada) return res.status(400).json({ error: 'TOTP no configurado' });

  const valido = speakeasy.totp.verify({
    secret: desencriptar(entrada.secret),
    encoding: 'base32',
    token,
    window: 1
  });

  if (!valido) return res.status(401).json({ error: 'Código incorrecto' });

  if (!entrada.activo) {
    secretos[username].activo = true;
    guardarSecretos(secretos);
  }

  const user = usuarios.find(u => u.username === username);
  const jwtToken = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET,
    { expiresIn: '2h' }
  );

  res.json({ token: jwtToken, username: user.username, role: user.role });
});

app.post('/api/totp/reset', verificarToken, (req, res) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Sin permisos' });

  const { username } = req.body;
  const secretos = cargarSecretos();
  delete secretos[username];
  guardarSecretos(secretos);

  res.json({ mensaje: `TOTP reseteado para ${username}` });
});

app.get('/api/productos', verificarToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM productos ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

app.post('/api/productos', verificarToken, async (req, res) => {
  const { nombre, descripcion, precio, stock, categoria } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO productos (nombre, descripcion, precio, stock, categoria)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre, descripcion, precio, stock, categoria]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar producto' });
  }
});

app.delete('/api/productos/:id', verificarToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM productos WHERE id = $1', [req.params.id]);
    res.json({ mensaje: 'Producto eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

const PORT = process.env.PORT || 80;
app.listen(PORT, () => console.log(`Servidor ERP SIMI corriendo en puerto ${PORT}`));