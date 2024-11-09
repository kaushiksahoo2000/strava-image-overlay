// components/ImageOverlay.tsx
'use client';

import React, { useState, useRef } from 'react';
import heic2any from 'heic2any';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, ImageIcon } from 'lucide-react';

const ImageOverlay = () => {
  const [stravaImage, setStravaImage] = useState<string | null>(null);
  const [baseImage, setBaseImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const convertHEICtoJPEG = async (file: File): Promise<string> => {
    try {
      // If it's a HEIC file
      if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
        const blob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.9
        });
        
        // Convert blob to base64
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(Array.isArray(blob) ? blob[0] : blob);
        });
      }
      
      // If it's not HEIC, just return the base64
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error('Error converting HEIC:', error);
      throw error;
    }
  };

  const stravaInputRef = useRef<HTMLInputElement>(null);
  const baseInputRef = useRef<HTMLInputElement>(null);

  const supportedFormats = [
    'image/heic',
    'image/heif',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'strava' | 'base') => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;

      // Convert to JPEG if needed
      const base64Image = await convertHEICtoJPEG(file);
      
      if (type === 'strava') {
        setStravaImage(base64Image);
      } else {
        setBaseImage(base64Image);
      }
    } catch (error) {
      console.error('Error processing image:', error);
      // Handle error appropriately
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
      setError(error.message || 'Error creating overlay. Please try again.');
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
        className="border-2 border-dashed rounded-lg p-4 text-center touch-manipulation"
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
        <div className="cursor-pointer">
          {image ? (
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
            <div className="text-red-500 text-sm text-center p-2">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-center gap-2">
            <Button
              onClick={handleOverlay}
              disabled={!stravaImage || !baseImage || loading}
              className="w-full sm:w-auto"
            >
              {loading ? 'Processing...' : 'Generate Overlay'}
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