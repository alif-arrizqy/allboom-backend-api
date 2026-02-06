# Allboom Backend API

Backend API untuk aplikasi Allboom (E-Portfolio Seni Digital).

## 🚀 Tech Stack

- **Framework**: Fastify
- **Language**: TypeScript
- **Database**: PostgreSQL/Supabase
- **ORM**: Prisma
- **Authentication**: JWT (JSON Web Token)
- **Logging**: Pino
- **File Storage**: Supabase Storage
- **Image Processing**: Sharp

## 📦 Installation

1. **Clone repository**

   ```bash
   git clone <repository-url>
   cd allboom-backend-api
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Setup environment variables**
   - Copy `env.example.txt` ke `.env`
   - Isi semua variabel yang diperlukan (database, JWT secret, Supabase Storage, dll)

4. **Setup database**
   Generate Schema

   ```bash
   npm run prisma:generate
   ```

   Migrate database

   ```bash
   npm run prisma:migrate:deploy
   ```

5. **Seed database (optional)**

   ```bash
   npm run seed
   ```

6. **Run development server**
   ```bash
   npm run dev
   ```

### 🗄️ Supabase Setup

Aplikasi ini mendukung PostgreSQL lokal maupun Supabase. Untuk menggunakan Supabase:

1. **Buat project di Supabase**
   - Kunjungi [supabase.com](https://supabase.com)
   - Buat project baru
   - Catat `PROJECT-REF` dan password database

2. **Ambil Connection String**
   - Buka Settings > Database di Supabase dashboard
   - Copy connection string dari bagian "Connection string"
   - Pilih "URI" atau "Connection pooling" sesuai kebutuhan

3. **Update Environment Variables**
   - Update `DATABASE_URL` di `.env` dengan connection string Supabase
   - **Untuk Connection Pooler** (direkomendasikan untuk production):
     ```env
     DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public"
     DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?schema=public"
     ```
   - **Untuk Direct Connection** (untuk development):
     ```env
     DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?schema=public"
     ```
   - **Untuk Supabase Storage**
     ```env
     # Supabase Storage Configuration
     SUPABASE_URL=https://[PROJECT-REF].supabase.co
     # Get this from Supabase Dashboard > Settings > API > Service Role Key (secret)
     SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
     SUPABASE_STORAGE_BUCKET_AVATARS=avatars
     SUPABASE_STORAGE_BUCKET_SUBMISSIONS=submissions
     SUPABASE_STORAGE_BUCKET_TEMP=temp
     # Note: Buckets must be created manually in Supabase Dashboard > Storage
     ```

4. **Run Migrations**

   ```bash
   npx prisma migrate deploy
   # atau untuk development
   npx prisma migrate dev
   ```

5. **Generate Prisma Client**
   ```bash
   npx prisma generate
   ```

### 📦 Supabase Storage Setup

Aplikasi menggunakan Supabase Storage untuk menyimpan file (avatars, submissions, dll):

1. **Setup Storage Buckets**
   - Buka Supabase Dashboard > Storage
   - Buat 3 buckets:
     - `avatars` - Untuk user avatars (set to public)
     - `submissions` - Untuk submission artwork (set to public)
     - `temp` - Untuk temporary uploads (set to private)

2. **Get Service Role Key**
   - Buka Settings > API di Supabase dashboard
   - Copy **Service Role Key** (secret key, jangan share ke frontend!)

3. **Update Environment Variables**

   ```env
   SUPABASE_URL=https://[PROJECT-REF].supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   SUPABASE_STORAGE_BUCKET_AVATARS=avatars
   SUPABASE_STORAGE_BUCKET_SUBMISSIONS=submissions
   SUPABASE_STORAGE_BUCKET_TEMP=temp
   ```

4. **Set Bucket Policies** (via Dashboard)
   - Untuk `avatars` dan `submissions`: Set to **Public** (Allow public read access)
   - Untuk `temp`: Keep **Private** (Only authenticated users)

---

**Last Updated**: 2025-12-23
**Version**: 3.0.0
