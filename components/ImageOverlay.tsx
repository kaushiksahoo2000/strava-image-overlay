// components/ImageOverlay.tsx
'use client';

import React, { useState, useRef } from 'react';
import heic2any from 'heic2any';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, ImageIcon, Loader2 } from 'lucide-react';

const ImageOverlay = () => {
  const [stravaImage, setStravaImage] = useState<string | null>(null);
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [error, setError] = useState('');

  const stravaInputRef = useRef<HTMLInputElement>(null);
  const baseInputRef = useRef<HTMLInputElement>(null);

  const processImage = async (file: File): Promise<string> => {
    try {
      // If it's a HEIC file, convert it
      if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
        const blob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.8
        });
        return blobToBase64(Array.isArray(blob) ? blob[0] : blob);
      }

      // For other image types, optimize before converting to base64
      const optimizedImage = await resizeAndOptimizeImage(file);
      return blobToBase64(optimizedImage);
    } catch (error) {
      console.error('Error processing image:', error);
      throw error;
    }
  };

  const resizeAndOptimizeImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Set maximum dimensions while maintaining aspect ratio
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1920;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Could not create blob'));
            }
          },
          'image/jpeg',
          0.8
        );
      };
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'strava' | 'base') => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      setProcessingImage(true);
      setError('');

      const optimizedImage = await processImage(file);
      
      if (type === 'strava') {
        setStravaImage(optimizedImage);
      } else {
        setBaseImage(optimizedImage);
      }
    } catch (error) {
      console.error('Error processing image:', error);
      setError('Error processing image. Please try again.');
    } finally {
      setProcessingImage(false);
    }
  };

  const handleOverlay = async () => {
    if (!stravaImage || !baseImage) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/overlay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stravaImage,
          baseImage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to process images');
      }

      const data = await response.json();
      setResultImage(data.resultImage);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error creating overlay. Please try again.');
      console.error('Error overlaying images:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    
    // For iOS devices, open in new tab
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      window.open(resultImage, '_blank');
      return;
    }
    
    // For other devices, trigger download
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = 'strava-overlay.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const UploadBox = ({ type, image, inputRef }: {
    type: 'strava' | 'base';
    image: string | null;
    inputRef: React.RefObject<HTMLInputElement>;
  }) => (
    <div className="space-y-2 w-full">
      <label className="block text-sm font-medium">
        {type === 'strava' ? 'Strava Screenshot' : 'Base Image'}
      </label>
      <div 
        className="border-2 border-dashed rounded-lg p-4 text-center touch-manipulation cursor-pointer hover:border-primary transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        <input
          type="file"
          accept="image/heic,image/heif,image/jpeg,image/jpg,image/png,image/webp,.heic,.heif,.jpg,.jpeg,.png,.webp"
          onChange={(e) => handleImageUpload(e, type)}
          className="hidden"
          ref={inputRef}
          capture="environment"
        />
        <div>
          {processingImage ? (
            <div className="flex flex-col items-center justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">Processing image...</p>
            </div>
          ) : image ? (
            <img 
              src={image} 
              alt={`${type} preview`} 
              className="mt-2 max-h-40 mx-auto object-contain rounded-lg"
            />
          ) : (
            <>
              <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">
                Tap to {type === 'strava' ? 'upload Strava screenshot' : 'upload background image'}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Supports HEIC, JPEG, PNG, WebP
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto p-4 max-w-2xl min-h-screen">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-center">Strava Image Overlay</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4">
            <UploadBox type="strava" image={stravaImage} inputRef={stravaInputRef} />
            <UploadBox type="base" image={baseImage} inputRef={baseInputRef} />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center p-2 bg-red-50 rounded-md">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-center gap-2">
            <Button
              onClick={handleOverlay}
              disabled={!stravaImage || !baseImage || loading}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Generate Overlay'
              )}
            </Button>
            {resultImage && (
              <Button
                onClick={handleDownload}
                variant="outline"
                className="w-full sm:w-auto"
              >
                {/iPad|iPhone|iPod/.test(navigator.userAgent) ? 'View Result' : 'Download Result'}
              </Button>
            )}
          </div>

          {resultImage && (
            <div className="mt-4">
              <h3 className="text-lg font-medium mb-2">Result</h3>
              <img 
                src={resultImage} 
                alt="Result" 
                className="w-full rounded-lg"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ImageOverlay;