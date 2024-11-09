// app/api/overlay/route.ts
import { NextResponse } from 'next/server';
import Sharp from 'sharp';

export async function POST(request: Request) {
    try {
        const { stravaImage, baseImage } = await request.json();

        // Process images (now we know they're JPEG/PNG)
        const stravaBuffer = Buffer.from(stravaImage.split(',')[1], 'base64');
        const baseBuffer = Buffer.from(baseImage.split(',')[1], 'base64');

        // Get dimensions
        const baseMetadata = await Sharp(baseBuffer).metadata();
        const baseWidth = baseMetadata.width || 1080;
        const baseHeight = baseMetadata.height || 1080;

        // Process base image
        const processedBase = await Sharp(baseBuffer)
            .resize(baseWidth, baseHeight, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .toBuffer();

        // Extract route
        const routeOnly = await Sharp(stravaBuffer)
            .recomb([
                [2.0, -0.5, -0.5],  // Target orange/red
                [-0.5, 0.5, -0.5],
                [-0.5, -0.5, -0.5]
            ])
            .modulate({
                brightness: 1.6,
                saturation: 2.5
            })
            .threshold(220)
            .negate()
            .resize(baseWidth, baseHeight, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .toBuffer();

        // Extract stats
        const statsOnly = await Sharp(stravaBuffer)
            .grayscale()
            .modulate({
                brightness: 2.2,
                contrast: 6
            })
            .threshold(240)
            .negate()
            .resize({
                width: baseWidth,
                height: Math.floor(baseHeight * 0.08),
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .toBuffer();

        // Create final composite
        const result = await Sharp(processedBase)
            .composite([
                {
                    input: routeOnly,
                    blend: 'screen',
                    opacity: 0.35  // More transparent
                },
                {
                    input: statsOnly,
                    blend: 'screen',
                    opacity: 0.4,
                    gravity: 'south'
                }
            ])
            .png()
            .toBuffer();

        const resultBase64 = `data:image/png;base64,${result.toString('base64')}`;
        return NextResponse.json({ resultImage: resultBase64 });

    } catch (error) {
        console.error('Processing error:', error);
        return NextResponse.json(
            { error: 'Error processing images', details: error.message },
            { status: 500 }
        );
    }
}