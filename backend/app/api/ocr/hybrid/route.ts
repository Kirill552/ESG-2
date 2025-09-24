import { NextRequest, NextResponse } from 'next/server';
import { processImageMultiLevel } from '../../../../lib/multi-level-ocr-service';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const forceProvider = formData.get('forceProvider') as 'tesseract' | 'yandex' | undefined;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Обрабатываем файл через многоуровневую OCR систему
    const result = await processImageMultiLevel(buffer, {
      preferredSource: forceProvider === 'tesseract' ? 'tesseract' : 
                     forceProvider === 'yandex' ? 'yandex' : 'auto',
      enableFallback: true,
      minConfidence: 0.5
    });

    return NextResponse.json({
      success: true,
      result: {
        text: result.text,
        confidence: result.confidence,
        provider: result.source,
        processingTime: result.processingTime,
        costEstimate: 0, // Убираем costEstimate из OcrResult
        wordCount: result.text.split(' ').length,
        preview: result.text.slice(0, 200) + (result.text.length > 200 ? '...' : '')
      },
      metadata: {
        filename: file.name,
        fileSize: file.size,
        forcedProvider: forceProvider,
        estimatedCost: 0 // Убираем costEstimate из OcrResult
      }
    });

  } catch (error) {
    console.error('Hybrid OCR API error:', error);
    return NextResponse.json(
      { 
        error: 'OCR processing failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      stats: {
        yandex: { processed: 0, errors: 0, avgConfidence: 0.95 },
        tesseract: { processed: 0, errors: 0, avgConfidence: 0.75 },
        intelligent: { processed: 0, errors: 0, avgConfidence: 0.85 }
      },
      info: {
        supportedFormats: ['jpg', 'jpeg', 'png', 'pdf', 'xlsx', 'xls', 'docx', 'txt', 'csv'],
        maxFileSize: '10MB (for Yandex Vision)',
        providers: {
          tesseract: {
            cost: 'Free',
            accuracy: '70-85%',
            speed: 'Medium',
            languages: ['Russian', 'English']
          },
          yandex: {
            cost: '~0.5₽ per page',
            accuracy: '95-99%',
            speed: 'Fast',
            languages: ['Russian', 'English', 'Many others']
          },
          intelligent: {
            cost: 'Mixed (auto-selects best option)',
            accuracy: '90-98%',
            speed: 'Optimized',
            languages: ['Russian', 'English']
          }
        }
      }
    });

  } catch (error) {
    console.error('Hybrid OCR status error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get OCR status',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
