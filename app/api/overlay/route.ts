// app/api/overlay/route.ts
import { NextResponse } from 'next/server';
import Sharp from 'sharp';
import heicConvert from 'heic-convert';

async function processImage(base64Str: string): Promise<Buffer> {
    try {
        const base64Data = base64Str.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const isHeic = buffer.toString('hex', 0, 12).includes('66747970686569');

        if (isHeic) {
            return await heicConvert({
                buffer: buffer,
                format: 'JPEG',
                quality: 1
            });
        }

        return buffer;
    } catch (error) {
        console.error('Error processing image:', error);
        throw new Error(`Error processing image: ${error.message}`);
    }
}

export async function POST(request: Request) {
    try {
        const { stravaImage, baseImage } = await request.json();

        // Process both images
        const stravaBuffer = await processImage(stravaImage);
        const baseBuffer = await processImage(baseImage);

        // Get dimensions
        const baseMetadata = await Sharp(baseBuffer).metadata();
        const baseWidth = baseMetadata.width || 1080;
        const baseHeight = baseMetadata.height || 1080;

        // Process base image
        const processedBase = await Sharp(baseBuffer)
            .rotate()
            .resize(baseWidth, baseHeight, {
                fit: 'fill'
            })
            .toBuffer();

        // Extract just the orange route
        const routeOnly = await Sharp(stravaBuffer)
            .removeAlpha()
            // Extract and enhance red/orange components
            .recomb([
                [1.5, -0.5, -0.5],  // Boost red, reduce others
                [-0.5, -0.5, -0.5],
                [-0.5, -0.5, -0.5]
            ])
            .modulate({
                brightness: 2,
                saturation: 2,
                hue: 15        // Shift slightly towards orange
            })
            .threshold(200)  // High threshold for clean lines
            .resize(baseWidth, baseHeight, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .toBuffer();

        // Process just the stats - bottom text only
        const processedStats = await Sharp(stravaBuffer)
            .rotate()
            .grayscale()
            .modulate({
                brightness: 1.4,
                contrast: 4
            })
            .threshold(245)  // Very high threshold for clean text
            .resize({
                width: baseWidth,
                height: Math.floor(baseHeight * 0.1),  // Just enough for stats
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
                    opacity: 0.25  // Subtle route overlay
                },
                {
                    input: processedStats,
                    blend: 'screen',
                    opacity: 0.15,  // Slightly stronger stats
                    gravity: 'south'
                }
            ])
            .png()
            .toBuffer();

        const resultBase64 = `data:image/png;base64,${result.toString('base64')}`;
        return NextResponse.json({ resultImage: resultBase64 });

    } catch (error) {
        console.error('Image processing error:', error);
        return NextResponse.json(
            { error: 'Error processing images', details: error.message },
            { status: 500 }
        );
    }
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '16mb',
        },
    },
};