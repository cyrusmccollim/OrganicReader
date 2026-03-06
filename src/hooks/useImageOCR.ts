import { useState } from 'react';
import { useImagePicker } from './useImagePicker';
import MlKitTextRecognition from '@react-native-ml-kit/text-recognition';

export interface OCRResult {
  text: string;
}

export function useImageOCR() {
  const { pickImage, picking: pickingImage } = useImagePicker();
  const [processing, setProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const performOCR = async (imageUri: string): Promise<OCRResult> => {
    const result = await MlKitTextRecognition.recognize(imageUri);
    const text = result.blocks.map(b => b.text).join('\n').trim();
    return { text };
  };

  const pickAndRecognize = async (): Promise<OCRResult | null> => {
    setError(null);
    setOcrResult(null);

    const imageResult = await pickImage();
    if (!imageResult || imageResult.cancelled) {
      return null;
    }

    setProcessing(true);
    try {
      const result = await performOCR(imageResult.uri);
      setOcrResult(result);
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'OCR failed';
      setError(message);
      return null;
    } finally {
      setProcessing(false);
    }
  };

  const recognizeFromUri = async (uri: string): Promise<OCRResult | null> => {
    setError(null);
    setProcessing(true);

    try {
      const result = await performOCR(uri);
      setOcrResult(result);
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'OCR failed';
      setError(message);
      return null;
    } finally {
      setProcessing(false);
    }
  };

  return {
    pickAndRecognize,
    recognizeFromUri,
    picking: pickingImage || processing,
    ocrResult,
    error,
    clearError: () => setError(null),
  };
}