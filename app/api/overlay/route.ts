// app/api/overlay/route.ts
import { NextResponse } from 'next/server';
import Sharp from 'sharp';

export async function POST(request: Request) {
    try {
        const { stravaImage, baseImage } = await request.json();

        const STORY_WIDTH = 1080;
        const STORY_HEIGHT = 1920;

        const stravaBuffer = Buffer.from(stravaImage.split(',')[1], 'base64');
        const baseBuffer = Buffer.from(baseImage.split(',')[1], 'base64');

        // Get image metadata
        const metadata = await Sharp(stravaBuffer).metadata();
        const imageHeight = metadata.height || STORY_HEIGHT;

        // Process base image
        const processedBase = await Sharp(baseBuffer)
            .resize(STORY_WIDTH, STORY_HEIGHT, {
                fit: 'cover',
                position: 'center',
            })
            .jpeg({ quality: 90 })
            .toBuffer();

        // Extract route - focusing only on the path, removing colored overlays
        const routeOnly = await Sharp(stravaBuffer)
            .recomb([
                [0.5, 0.5, 1.5],  // Emphasize blue line
                [-0.2, -0.2, 0.5],
                [-0.2, -0.2, 0.5]
            ])
            .modulate({
                brightness: 2.2,
                saturation: 1.8
            })
            .threshold(190)
            .negate()
            .linear(2.5, -(2.5 * 128))  // Increase contrast
            .resize(STORY_WIDTH, STORY_HEIGHT, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .toBuffer();

        // Extract stats - clean white text only
        const statsOnly = await Sharp(stravaBuffer)
            .extract({
                left: 0,
                top: Math.max(0, imageHeight - Math.floor(imageHeight * 0.15)),  // Safe calculation
                width: metadata.width || STORY_WIDTH,
                height: Math.floor(imageHeight * 0.15)
            })
            .grayscale()
            .modulate({
                brightness: 3,
                contrast: 7
            })
            .threshold(200)
            .negate()
            .linear(2.8, -(2.8 * 128))
            .resize({
                width: Math.floor(STORY_WIDTH * 0.85),
                height: Math.floor(STORY_HEIGHT * 0.1),
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
                    opacity: 0.8
                },
                {
                    input: statsOnly,
                    blend: 'screen',
                    opacity: 0.95,
                    left: Math.floor(STORY_WIDTH * 0.075),
                    top: Math.floor(STORY_HEIGHT * 0.82)
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