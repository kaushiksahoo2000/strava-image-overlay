// app/api/overlay/route.ts
import { NextResponse } from 'next/server';
import Sharp from 'sharp';

export async function POST(request: Request) {
    try {
        const { stravaImage, baseImage } = await request.json();

        // Instagram Story dimensions
        const STORY_WIDTH = 1080;
        const STORY_HEIGHT = 1920;

        // Process images
        const stravaBuffer = Buffer.from(stravaImage.split(',')[1], 'base64');
        const baseBuffer = Buffer.from(baseImage.split(',')[1], 'base64');

        // Process base image with optimization
        const processedBase = await Sharp(baseBuffer)
            .resize(STORY_WIDTH, STORY_HEIGHT, {
                fit: 'cover',
                position: 'center',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .jpeg({ quality: 80 })  // Optimize quality
            .toBuffer();

        // Extract route - making it clean white
        const routeOnly = await Sharp(stravaBuffer)
            .recomb([
                [1.5, -0.5, -0.5],
                [-0.5, 0.5, -0.5],
                [-0.5, -0.5, 0.5]
            ])
            .modulate({
                brightness: 1.8,
                saturation: 1.5
            })
            .threshold(200)
            .negate()
            .linear(2, -(2 * 128))
            .resize(STORY_WIDTH, STORY_HEIGHT, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .toBuffer();

        // Extract stats - making them clean white
        const statsOnly = await Sharp(stravaBuffer)
            .grayscale()
            .modulate({
                brightness: 2.5,
                contrast: 5
            })
            .threshold(225)
            .negate()
            .linear(2, -(2 * 128))
            .resize({
                width: Math.floor(STORY_WIDTH * 0.8),
                height: Math.floor(STORY_HEIGHT * 0.1),
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .toBuffer();

        // Create final composite with proper positioning
        const result = await Sharp(processedBase)
            .composite([
                {
                    input: routeOnly,
                    blend: 'screen',
                    opacity: 0.9
                },
                {
                    input: statsOnly,
                    blend: 'screen',
                    opacity: 0.95,
                    left: Math.floor(STORY_WIDTH * 0.1),  // 10% from left edge
                    top: Math.floor(STORY_HEIGHT * 0.85)  // 85% from top (15% from bottom)
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