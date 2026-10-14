/**
 * Firestore to Postgres Import Script
 *
 * Usage:
 *   pnpm exec tsx scripts/import-firestore.ts
 *
 * Reads Firestore documents (using Firebase Admin SDK or REST with service account)
 * and upserts into Postgres via Prisma, preserving document IDs.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { prisma } from '../lib/db';
import { toPrismaLayout } from '../lib/frame-converters';
import type { BackgroundType, EventMode, PublishRequestType, PublishStatus } from '../lib/generated/prisma/enums';

// Optional: check for service account path in env
const SA_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;

function loadServiceAccount(): any | null {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch {
      console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT env');
    }
  }

  if (SA_PATH && existsSync(resolve(SA_PATH))) {
    try {
      return JSON.parse(readFileSync(resolve(SA_PATH), 'utf-8'));
    } catch {
      console.warn('Failed to read service account from', SA_PATH);
    }
  }

  return null;
}

function parseDate(val: any, fallback = new Date()): Date {
  if (!val) return fallback;
  if (val instanceof Date) return val;
  if (typeof val === 'number') return new Date(val);
  if (typeof val === 'string') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof val?.toMillis === 'function') {
    return new Date(val.toMillis());
  }
  if (typeof val?._seconds === 'number') {
    return new Date(val._seconds * 1000);
  }
  return fallback;
}

export async function runImport() {
  const sa = loadServiceAccount();
  if (!sa) {
    console.log('No Firebase service account found. Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS to run live Firestore import.');
    console.log('Collections to import when credentials provided:');
    console.log('1. public_settings/studio -> StudioSettings');
    console.log('2. api_keys & user_api_keys -> ApiKey');
    console.log('3. user_frames -> UserFrame');
    console.log('4. public_frames -> PublicFrame');
    console.log('5. user_filters -> UserFilter');
    console.log('6. public_filters -> PublicFilter');
    console.log('7. user_backgrounds -> UserBackground');
    console.log('8. public_backgrounds -> PublicBackground');
    console.log('9. publish_requests -> PublishRequest');
    console.log('10. events -> Event');
    console.log('11. events/{id}/captures -> EventCapture');
    console.log('12. ai_daily_usage -> AiDailyUsage');
    return;
  }

  console.log('Service account loaded for project:', sa.project_id);

  // Initialize Firebase Admin dynamically
  const adminPkg = 'firebase-admin';
  const admin = await (Function('moduleName', 'return import(moduleName)')(adminPkg)).catch(() => null) as any;
  if (!admin) {
    console.warn('firebase-admin is not installed. To run import, install it with `pnpm add -D firebase-admin`.');
    return;
  }
  if (!admin.apps?.length) {
    admin.initializeApp({
      credential: admin.credential.cert(sa),
    });
  }
  const db = admin.firestore();

  // 1. Studio Settings
  console.log('Importing public_settings/studio...');
  try {
    const studioDoc = await db.doc('public_settings/studio').get();
    if (studioDoc.exists) {
      const data = studioDoc.data() || {};
      await prisma.studioSettings.upsert({
        where: { id: 'studio' },
        create: {
          id: 'studio',
          studioName: data.studioName || 'Pika',
          studioLogo: data.studioLogo || '📷',
          tagline: data.tagline || 'Capture the moment',
        },
        update: {
          studioName: data.studioName || undefined,
          studioLogo: data.studioLogo || undefined,
          tagline: data.tagline || undefined,
        },
      });
      console.log('✓ Studio settings imported');
    }
  } catch (err) {
    console.warn('Skipping studio settings:', err);
  }

  // 2. API Keys
  console.log('Importing api_keys & user_api_keys...');
  const keyMap = new Set<string>();
  for (const col of ['api_keys', 'user_api_keys']) {
    try {
      const snap = await db.collection(col).get();
      for (const doc of snap.docs) {
        const d = doc.data();
        if (!d.key || keyMap.has(d.key)) continue;
        keyMap.add(d.key);

        await prisma.apiKey.upsert({
          where: { key: d.key },
          create: {
            id: doc.id,
            uid: d.uid || 'imported-user',
            name: d.name || 'API Key',
            key: d.key,
            active: d.active !== false,
            createdAt: parseDate(d.createdAt),
            lastUsedAt: d.lastUsedAt ? parseDate(d.lastUsedAt) : null,
          },
          update: {
            name: d.name || undefined,
            active: d.active !== false,
            lastUsedAt: d.lastUsedAt ? parseDate(d.lastUsedAt) : undefined,
          },
        });
      }
      console.log(`✓ Imported ${snap.size} from ${col}`);
    } catch (err) {
      console.warn(`Skipping ${col}:`, err);
    }
  }

  // 3. User Frames
  console.log('Importing user_frames...');
  try {
    const snap = await db.collection('user_frames').get();
    for (const doc of snap.docs) {
      const d = doc.data();
      await prisma.userFrame.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          uid: d.uid || '',
          name: d.name || 'Custom Frame',
          emoji: d.emoji || null,
          categoryId: d.categoryId || '',
          config: d.config || {},
          createdAt: parseDate(d.createdAt),
          updatedAt: parseDate(d.updatedAt),
        },
        update: {
          name: d.name || undefined,
          emoji: d.emoji || null,
          categoryId: d.categoryId || undefined,
          config: d.config || undefined,
          updatedAt: parseDate(d.updatedAt),
        },
      });
    }
    console.log(`✓ Imported ${snap.size} user frames`);
  } catch (err) {
    console.warn('Skipping user_frames:', err);
  }

  // 4. Public Frames
  console.log('Importing public_frames...');
  try {
    const snap = await db.collection('public_frames').get();
    for (const doc of snap.docs) {
      const d = doc.data();
      await prisma.publicFrame.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          name: d.name || 'Frame',
          description: d.description || '',
          photoCount: Number(d.photoCount) || 4,
          layout: toPrismaLayout(d.layout),
          aspectRatio: Number(d.aspectRatio) || 1.333333,
          color: d.color || '#f5f0e8',
          borderColor: d.borderColor || '#1a1410',
          accentColor: d.accentColor || '#c9a84c',
          emoji: d.emoji || '🎨',
          config: d.config || null,
          width: d.width ? Number(d.width) : null,
          height: d.height ? Number(d.height) : null,
          ownerUid: d.ownerUid || null,
          ownerName: d.ownerName || null,
          sortOrder: Number(d.sortOrder) || 0,
          active: d.active !== false,
          createdAt: parseDate(d.createdAt),
          updatedAt: parseDate(d.updatedAt),
        },
        update: {
          name: d.name || undefined,
          description: d.description ?? undefined,
          config: d.config ?? undefined,
          sortOrder: Number(d.sortOrder) || undefined,
          active: d.active !== false,
          updatedAt: parseDate(d.updatedAt),
        },
      });
    }
    console.log(`✓ Imported ${snap.size} public frames`);
  } catch (err) {
    console.warn('Skipping public_frames:', err);
  }

  // 5. User Filters
  console.log('Importing user_filters...');
  try {
    const snap = await db.collection('user_filters').get();
    for (const doc of snap.docs) {
      const d = doc.data();
      await prisma.userFilter.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          uid: d.uid || '',
          name: d.name || 'Filter',
          emoji: d.emoji || '📷',
          adjustments: d.adjustments || {},
          css: d.css || null,
          createdAt: parseDate(d.createdAt),
          updatedAt: parseDate(d.updatedAt),
        },
        update: {
          name: d.name || undefined,
          emoji: d.emoji || undefined,
          adjustments: d.adjustments || undefined,
          css: d.css ?? undefined,
          updatedAt: parseDate(d.updatedAt),
        },
      });
    }
    console.log(`✓ Imported ${snap.size} user filters`);
  } catch (err) {
    console.warn('Skipping user_filters:', err);
  }

  // 6. Public Filters
  console.log('Importing public_filters...');
  try {
    const snap = await db.collection('public_filters').get();
    for (const doc of snap.docs) {
      const d = doc.data();
      await prisma.publicFilter.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          name: d.name || 'Filter',
          emoji: d.emoji || '📷',
          adjustments: d.adjustments || {},
          css: d.css || null,
          description: d.description || '',
          ownerUid: d.ownerUid || null,
          ownerName: d.ownerName || null,
          sortOrder: Number(d.sortOrder) || 0,
          active: d.active !== false,
          createdAt: parseDate(d.createdAt),
          updatedAt: parseDate(d.updatedAt),
        },
        update: {
          name: d.name || undefined,
          emoji: d.emoji || undefined,
          adjustments: d.adjustments || undefined,
          css: d.css ?? undefined,
          description: d.description ?? undefined,
          sortOrder: Number(d.sortOrder) || undefined,
          active: d.active !== false,
          updatedAt: parseDate(d.updatedAt),
        },
      });
    }
    console.log(`✓ Imported ${snap.size} public filters`);
  } catch (err) {
    console.warn('Skipping public_filters:', err);
  }

  // 7. User Backgrounds
  console.log('Importing user_backgrounds...');
  try {
    const snap = await db.collection('user_backgrounds').get();
    for (const doc of snap.docs) {
      const d = doc.data();
      await prisma.userBackground.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          ownerUid: d.ownerUid || '',
          ownerName: d.ownerName || null,
          type: (d.type as BackgroundType) || 'upload',
          name: d.name || 'Background',
          src: d.src || null,
          createdAt: parseDate(d.createdAt),
        },
        update: {
          name: d.name || undefined,
          src: d.src ?? undefined,
        },
      });
    }
    console.log(`✓ Imported ${snap.size} user backgrounds`);
  } catch (err) {
    console.warn('Skipping user_backgrounds:', err);
  }

  // 8. Public Backgrounds
  console.log('Importing public_backgrounds...');
  try {
    const snap = await db.collection('public_backgrounds').get();
    for (const doc of snap.docs) {
      const d = doc.data();
      await prisma.publicBackground.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          ownerUid: d.ownerUid || null,
          ownerName: d.ownerName || null,
          type: (d.type as BackgroundType) || 'upload',
          name: d.name || 'Background',
          src: d.src || null,
          createdAt: parseDate(d.createdAt),
        },
        update: {
          name: d.name || undefined,
          src: d.src ?? undefined,
        },
      });
    }
    console.log(`✓ Imported ${snap.size} public backgrounds`);
  } catch (err) {
    console.warn('Skipping public_backgrounds:', err);
  }

  // 9. Publish Requests
  console.log('Importing publish_requests...');
  try {
    const snap = await db.collection('publish_requests').get();
    for (const doc of snap.docs) {
      const d = doc.data();
      await prisma.publishRequest.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          type: (d.type as PublishRequestType) || 'frame',
          status: (d.status as PublishStatus) || 'pending',
          frameId: d.frameId || null,
          filterId: d.filterId || null,
          backgroundId: d.backgroundId || null,
          userUid: d.user?.uid || d.userUid || '',
          userDisplayName: d.user?.displayName || d.userDisplayName || null,
          frame: d.frame || null,
          filter: d.filter || null,
          background: d.background || null,
          createdAt: parseDate(d.createdAt),
          updatedAt: parseDate(d.updatedAt),
        },
        update: {
          status: (d.status as PublishStatus) || undefined,
          updatedAt: parseDate(d.updatedAt),
        },
      });
    }
    console.log(`✓ Imported ${snap.size} publish requests`);
  } catch (err) {
    console.warn('Skipping publish_requests:', err);
  }

  // 10. Events and 11. Captures
  console.log('Importing events and captures...');
  try {
    const snap = await db.collection('events').get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const eventRow = await prisma.event.upsert({
        where: { id: doc.id },
        create: {
          id: doc.id,
          slug: (d.slug || doc.id).toLowerCase().trim(),
          name: d.name || 'Event',
          tagline: d.tagline || null,
          brideName: d.brideName || null,
          groomName: d.groomName || null,
          hostUid: d.hostUid || '',
          hostEmail: d.hostEmail || null,
          eventDate: d.eventDate || new Date().toISOString().split('T')[0],
          venue: d.venue || null,
          primaryFrameId: d.primaryFrameId || '',
          frameIds: Array.isArray(d.frameIds) ? d.frameIds : [],
          allowFrameSelection: d.allowFrameSelection !== false,
          mode: (d.mode as EventMode) || 'hybrid',
          enableLiveGallery: d.enableLiveGallery !== false,
          requirePasscode: d.requirePasscode || null,
          customLogoUrl: d.customLogoUrl || null,
          themeColor: d.themeColor || '#e11d48',
          customMessage: d.customMessage || null,
          hashtag: d.hashtag || null,
          wifiSsid: d.wifiSsid || null,
          wifiPassword: d.wifiPassword || null,
          active: d.active !== false,
          createdAt: parseDate(d.createdAt),
          updatedAt: parseDate(d.updatedAt),
        },
        update: {
          name: d.name || undefined,
          active: d.active !== false,
          updatedAt: parseDate(d.updatedAt),
        },
      });

      // Captures subcollection
      try {
        const capturesSnap = await db.collection(`events/${doc.id}/captures`).get();
        for (const capDoc of capturesSnap.docs) {
          const cap = capDoc.data();
          await prisma.eventCapture.upsert({
            where: { id: capDoc.id },
            create: {
              id: capDoc.id,
              eventId: eventRow.id,
              eventSlug: eventRow.slug,
              sessionId: cap.sessionId || 'session',
              stripUrl: cap.stripUrl || '',
              gifUrl: cap.gifUrl || null,
              photoUrls: Array.isArray(cap.photoUrls) ? cap.photoUrls : [],
              liveClipUrls: Array.isArray(cap.liveClipUrls) ? cap.liveClipUrls : [],
              createdAt: parseDate(cap.createdAt),
            },
            update: {
              stripUrl: cap.stripUrl || undefined,
              gifUrl: cap.gifUrl ?? undefined,
            },
          });
        }
      } catch (capErr) {
        console.warn(`Skipping captures for event ${doc.id}:`, capErr);
      }
    }
    console.log(`✓ Imported ${snap.size} events`);
  } catch (err) {
    console.warn('Skipping events:', err);
  }

  // 12. AI Daily Usage
  console.log('Importing ai_daily_usage...');
  try {
    const snap = await db.collection('ai_daily_usage').get();
    for (const doc of snap.docs) {
      const d = doc.data();
      // ID is {uid}_{YYYY-MM-DD}
      const parts = doc.id.split('_');
      const uid = d.uid || parts.slice(0, -1).join('_') || parts[0];
      const usageDate = d.date || parts[parts.length - 1] || new Date().toISOString().slice(0, 10);

      await prisma.aiDailyUsage.upsert({
        where: { uid_usageDate: { uid, usageDate } },
        create: {
          id: doc.id,
          uid,
          email: d.email || '',
          usageDate,
          count: Number(d.count) || 0,
          lastPrompt: d.lastPrompt || '',
          createdAt: parseDate(d.createdAt),
          updatedAt: parseDate(d.updatedAt),
        },
        update: {
          count: Number(d.count) || undefined,
          lastPrompt: d.lastPrompt || undefined,
          updatedAt: parseDate(d.updatedAt),
        },
      });
    }
    console.log(`✓ Imported ${snap.size} ai_daily_usage rows`);
  } catch (err) {
    console.warn('Skipping ai_daily_usage:', err);
  }

  // 13. Firebase Auth Users
  console.log('Importing Firebase Auth users into Postgres User table...');
  try {
    let nextPageToken: string | undefined = undefined;
    let userCount = 0;
    do {
      const listUsersResult: any = await admin.auth().listUsers(1000, nextPageToken);
      for (const u of listUsersResult.users) {
        if (!u.email) continue;
        const googleProvider = u.providerData?.find((p: any) => p.providerId === 'google.com');
        await prisma.user.upsert({
          where: { id: u.uid },
          create: {
            id: u.uid,
            email: u.email.toLowerCase().trim(),
            name: u.displayName || u.email.split('@')[0],
            googleSub: googleProvider?.uid || null,
            createdAt: parseDate(u.metadata?.creationTime),
          },
          update: {
            email: u.email.toLowerCase().trim(),
            name: u.displayName || undefined,
            googleSub: googleProvider?.uid || undefined,
          },
        });
        userCount++;
      }
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);
    console.log(`✓ Imported ${userCount} users from Firebase Auth`);
  } catch (err) {
    console.warn('Skipping Auth users import (check permissions):', err);
  }

  console.log('=== Firestore import complete ===');
}

if (require.main === module) {
  runImport()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Import failed:', err);
      process.exit(1);
    });
}
