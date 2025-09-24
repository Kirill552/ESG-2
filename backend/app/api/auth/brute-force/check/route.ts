/**
 * API для проверки статуса anti-brute force
 * POST /api/auth/brute-force/check
 */

import { NextRequest, NextResponse } from 'next/server';
import AntiBruteForceService from '@/lib/anti-brute-force-service';
import { getClientIP } from '@/lib/ip-utils';

interface CheckRequest {
  identifier?: string;
  endpoint?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { identifier, endpoint = 'auth' }: CheckRequest = await request.json();
    const ip = getClientIP(request);
    
    const status = await AntiBruteForceService.checkBruteForce(ip, identifier, endpoint);
    
    return NextResponse.json(status);
    
  } catch (error) {
    console.error('Brute force check error:', error);
    
    // При ошибке возвращаем безопасное состояние
    return NextResponse.json({
      blocked: false,
      remainingAttempts: 5,
      requiresCaptcha: false
    });
  }
}
