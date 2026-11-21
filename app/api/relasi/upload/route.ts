import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { getStaffByDeviceId } from '@/src/lib/staff';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        let payload: { deviceId?: string; kind?: string };
        try {
          payload = JSON.parse(clientPayload || '{}');
        } catch {
          throw new Error('Data upload tidak valid.');
        }
        if (!(await getStaffByDeviceId(payload.deviceId || ''))) throw new Error('Hanya staf yang dapat mengunggah media.');
        const contentTypes = payload.kind === 'id-card' ? IMAGE_TYPES : payload.kind === 'oath-video' ? VIDEO_TYPES : [];
        if (contentTypes.length === 0) throw new Error('Jenis media tidak valid.');
        return {
          access: 'private',
          allowedContentTypes: contentTypes,
          maximumSizeInBytes: MAX_FILE_SIZE,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload gagal.' }, { status: 400 });
  }
}