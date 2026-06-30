require('dotenv').config();
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  },
});

async function realizarBackup() {
  const fecha = new Date().toISOString().slice(0, 10);
  const nombreArchivo = `backup_${fecha}.sql`;
  const rutaLocal = path.join("/tmp", nombreArchivo);

  const connString =
    `host=${process.env.DB_HOST} ` +
    `port=5432 ` +
    `dbname=${process.env.DB_NAME} ` +
    `user=${process.env.DB_USER} ` +
    `sslmode=require`;

  console.log(`Iniciando backup: ${nombreArchivo}`);

  await new Promise((resolve, reject) => {
    const cmd = `PGPASSWORD=${process.env.DB_PASS} pg_dump "${connString}" -f ${rutaLocal}`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) { console.error("Error pg_dump:", stderr); reject(error); }
      else { console.log("Dump generado OK"); resolve(); }
    });
  });

  const fileContent = fs.readFileSync(rutaLocal);
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: `backups/${nombreArchivo}`,
    Body: fileContent,
    ContentType: "application/sql",
  }));

  console.log(`Subido a s3://${process.env.S3_BUCKET}/backups/${nombreArchivo}`);
  fs.unlinkSync(rutaLocal);
  console.log("Listo.");
}

realizarBackup().catch(err => { console.error("Fallo:", err); process.exit(1); });