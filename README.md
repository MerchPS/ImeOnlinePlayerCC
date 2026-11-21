# Crimson Creed · IME Roleplay

Dashboard anggota Crimson Creed dengan halaman pemantauan semua faction terpisah di `/factions`, pemantauan relasi, dan panel staff.

## Deploy ke Vercel

1. Hubungkan repository ke Vercel dan siapkan PostgreSQL yang dapat diakses dari deployment.
2. Buat Vercel Blob store dengan akses **Private**, hubungkan ke project, dan aktifkan `BLOB_READ_WRITE_TOKEN` untuk client uploads.
3. Isi environment variables untuk semua environment yang digunakan:
   - `DATABASE_URL`: connection string PostgreSQL.
   - `BLOB_READ_WRITE_TOKEN`: token read/write dari Blob store private.
   - `SUPER_ADMIN_DEVICE_IDS`: daftar Device ID pemilik, dipisahkan koma.
   - `JWT_SECRET`: secret acak minimal 32 karakter bila endpoint login dipakai.
4. Terapkan perubahan skema database satu kali dari environment yang memiliki `DATABASE_URL`:

   ```bash
   npx prisma db push
   ```

5. Deploy. Build Vercel menjalankan `prisma generate` sebelum `next build`.

Foto KTP dan video sumpah darah diunggah langsung ke private Vercel Blob. Prisma hanya menyimpan pathname; pembacaan media memerlukan autentikasi staff. Batas upload per file adalah 10 MB. File di atas batas harus dikompres di perangkat sebelum diunggah.

Untuk development lokal, hubungkan Blob store ke environment Development dan siapkan variabel Blob yang sama; database lokal juga harus memiliki skema terbaru (`npx prisma db push`).
