# Changelog Keputusan Implementasi

Dokumen ini mencatat setiap keputusan yang menyimpang atau menambah detail
di luar yang eksplisit tertulis di 01-PRD-FlowForge.md, beserta alasannya.

| Tanggal | Task Terkait | Keputusan | Alasan |
|---|---|---|---|
| 2026-07-15 | Setup Awal | Mengembangkan proyek secara natif di Windows Host dengan Node v22.14.0 | WSL2 di laptop pengguna memiliki versi Node.js yang sudah usang (v12.22.9) dan tidak memiliki Docker terpasang, sedangkan Windows Host memiliki Node v22.14.0 dan database PostgreSQL & MongoDB yang sudah aktif berjalan secara natif. |
