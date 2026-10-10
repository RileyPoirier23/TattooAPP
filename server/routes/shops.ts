// Shop owners: create/edit their shop and manage booths.
import { Router, type Request } from 'express';
import { z } from 'zod';
import { requireRole, requireUser } from '../auth';
import { getDb, newId, nowIso } from '../db';
import { conflict, forbidden, notFound, parse } from '../http';
import { toShop } from '../mappers';
import { deleteUpload, saveImage, upload } from '../uploads';
import { notifyAdmins } from '../notify';

export const shopsRouter = Router();

const shopSchema = z.object({
  name: z.string().trim().min(1, 'Shop name is required').max(120),
  city: z.string().trim().min(1, 'City is required').max(100),
  address: z.string().trim().min(1, 'Address is required').max(300),
  lat: z.coerce.number().min(-90).max(90).nullable().optional(),
  lng: z.coerce.number().min(-180).max(180).nullable().optional(),
  description: z.string().trim().max(3000).default(''),
  amenities: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
});

const boothSchema = z.object({
  name: z.string().trim().min(1, 'Booth name is required').max(100),
  dailyRate: z.coerce.number().min(0).max(100000),
  description: z.string().trim().max(1000).default(''),
  active: z.boolean().optional(),
});

function loadOwnShop(req: Request, shopId: string) {
  const user = requireUser(req);
  const shop = getDb().prepare('select * from shops where id = ?').get(shopId) as any;
  if (!shop) throw notFound('Shop not found.');
  if (shop.owner_id !== user.id && user.role !== 'admin') throw forbidden();
  return shop;
}

function loadOwnBooth(req: Request, boothId: string) {
  const booth = getDb().prepare('select * from booths where id = ?').get(boothId) as any;
  if (!booth) throw notFound('Booth not found.');
  loadOwnShop(req, booth.shop_id);
  return booth;
}

const fullShop = (id: string) => toShop(getDb().prepare('select * from shops where id = ?').get(id), true);

shopsRouter.post('/shops', (req, res) => {
  const user = requireRole(req, 'shop-owner');
  const body = parse(shopSchema, req.body);
  const db = getDb();
  if (db.prepare('select 1 from shops where owner_id = ?').get(user.id)) throw conflict('You already have a shop.');
  const id = newId();
  const now = nowIso();
  db.prepare(
    `insert into shops (id, owner_id, name, city, address, lat, lng, description, amenities, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, user.id, body.name, body.city, body.address, body.lat ?? null, body.lng ?? null, body.description, JSON.stringify(body.amenities), now, now);
  notifyAdmins(`New shop listed: ${body.name} (${body.city}).`, '/admin/shops');
  res.status(201).json(fullShop(id));
});

shopsRouter.get('/my-shop', (req, res) => {
  const user = requireRole(req, 'shop-owner');
  const shop = getDb().prepare('select id from shops where owner_id = ?').get(user.id) as { id: string } | undefined;
  res.json(shop ? fullShop(shop.id) : null);
});

shopsRouter.patch('/shops/:id', (req, res) => {
  const shop = loadOwnShop(req, req.params.id);
  const body = parse(shopSchema.partial(), req.body);
  const columns: Record<string, unknown> = {
    name: body.name,
    city: body.city,
    address: body.address,
    lat: body.lat,
    lng: body.lng,
    description: body.description,
    amenities: body.amenities && JSON.stringify(body.amenities),
  };
  const entries = Object.entries(columns).filter(([, v]) => v !== undefined);
  if (entries.length) {
    getDb()
      .prepare(`update shops set ${entries.map(([k]) => `${k} = ?`).join(', ')}, updated_at = ? where id = ?`)
      .run(...entries.map(([, v]) => v), nowIso(), shop.id);
  }
  res.json(fullShop(shop.id));
});

shopsRouter.post('/shops/:id/image', upload.single('image'), (req, res) => {
  const shop = loadOwnShop(req, String(req.params.id));
  const url = saveImage(req.file);
  getDb().prepare('update shops set image_url = ?, updated_at = ? where id = ?').run(url, nowIso(), shop.id);
  deleteUpload(shop.image_url);
  res.json(fullShop(shop.id));
});

shopsRouter.post('/shops/:id/booths', (req, res) => {
  const shop = loadOwnShop(req, req.params.id);
  const body = parse(boothSchema, req.body);
  getDb()
    .prepare('insert into booths (id, shop_id, name, daily_rate, description, active, created_at) values (?, ?, ?, ?, ?, ?, ?)')
    .run(newId(), shop.id, body.name, body.dailyRate, body.description, body.active === false ? 0 : 1, nowIso());
  res.status(201).json(fullShop(shop.id));
});

shopsRouter.patch('/booths/:id', (req, res) => {
  const booth = loadOwnBooth(req, req.params.id);
  const body = parse(boothSchema.partial(), req.body);
  const columns: Record<string, unknown> = {
    name: body.name,
    daily_rate: body.dailyRate,
    description: body.description,
    active: body.active === undefined ? undefined : body.active ? 1 : 0,
  };
  const entries = Object.entries(columns).filter(([, v]) => v !== undefined);
  if (entries.length) {
    getDb().prepare(`update booths set ${entries.map(([k]) => `${k} = ?`).join(', ')} where id = ?`).run(...entries.map(([, v]) => v), booth.id);
  }
  res.json(fullShop(booth.shop_id));
});

shopsRouter.delete('/booths/:id', (req, res) => {
  const booth = loadOwnBooth(req, req.params.id);
  const db = getDb();
  const hasBookings = db.prepare('select 1 from booth_bookings where booth_id = ? limit 1').get(booth.id);
  if (hasBookings) {
    // Keep history for bookings and payments; just hide it from artists.
    db.prepare('update booths set active = 0 where id = ?').run(booth.id);
  } else {
    db.prepare('delete from booths where id = ?').run(booth.id);
  }
  res.json(fullShop(booth.shop_id));
});
