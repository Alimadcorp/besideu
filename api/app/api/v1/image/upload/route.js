import { NextResponse } from 'next/server';

export const runtime = 'edge'; // faster uploads if supported

export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const expire = searchParams.get('expire') || undefined;

    const formData = await req.formData();
    const file = formData.get('image');
    if (!file) {
      return NextResponse.json({ error: 'image file is required', code: 'bad_request' }, { status: 400 });
    }

    // Validation: Type and Size
    // 10MB = 10 * 1024 * 1024 bytes
    const MAX_SIZE = 10 * 1024 * 1024;
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)', code: 'file_too_large' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPEG, PNG, WebP allowed', code: 'invalid_file_type' }, { status: 400 });
    }

    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'IMGBB_API_KEY not configured', code: 'server_misconfigured' }, { status: 500 });
    }

    const uploadForm = new FormData();
    uploadForm.append('key', apiKey);
    uploadForm.append('image', file);
    if (expire) uploadForm.append('expiration', expire);

    const resp = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: uploadForm,
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('[image/upload] imgbb error', resp.status, text);
      return NextResponse.json({ error: 'Upload failed', code: 'upload_failed' }, { status: 502 });
    }

    const json = await resp.json();
    return NextResponse.json({
      url: json?.data?.url,
      expires_at: json?.data?.expiration ? new Date(json.data.expiration * 1000).toISOString() : null,
    });
  } catch (err) {
    console.error('[image/upload] unexpected', err);
    return NextResponse.json({ error: 'Unexpected error', code: 'internal_error' }, { status: 500 });
  }
}


