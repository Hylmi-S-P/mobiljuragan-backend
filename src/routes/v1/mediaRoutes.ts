import { Router } from 'express';
import { mediaController } from '../../controller/mediaController.js';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';
import { unggahSatuGambar } from '../../lib/imagePipeline.js';

/**
 * Rute media: /api/v1/media/*
 *
 * Unggah wajib punya sesi karena setiap berkas dicatat pemiliknya. Penyajian
 * memakai pemeriksaan per kategori di controller: foto armada publik, dokumen
 * pribadi hanya lewat tautan bertanda tangan atau sesi staf.
 */
export const mediaRouter: Router = Router();

mediaRouter.post('/', requireAuth, unggahSatuGambar('file'), mediaController.unggah);

/*
 * Penyajian memakai `optionalAuth`, bukan `requireAuth`, supaya tautan bertanda
 * tangan bisa dibuka langsung oleh tag <img> yang tidak bisa mengirim header.
 * Kalau ada sesi, identitasnya tetap dibaca agar pemilik dan staf tidak perlu
 * tanda tangan. Controller yang memutuskan boleh atau tidak.
 */
mediaRouter.get('/:id', optionalAuth, mediaController.sajikan);
