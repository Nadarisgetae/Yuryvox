import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'not_implemented',
    stage: 'jobs',
    message: 'Job orchestration starts in Phase 8. This route is a Phase 1 stub.',
  });
}

export async function POST() {
  return NextResponse.json(
    {
      status: 'not_implemented',
      stage: 'jobs',
      message: 'POST /api/jobs is not available until orchestration (Phase 8).',
    },
    { status: 501 },
  );
}
