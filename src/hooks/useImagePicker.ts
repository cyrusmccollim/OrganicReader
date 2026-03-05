import { useState } from 'react';
import { launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';

export interface ImagePickerResult {
  uri: string;
  cancelled: boolean;
}

export function useImagePicker() {
  const [picking, setPicking] = useState(false);

  const pickImage = async (): Promise<ImagePickerResult | null> => {
    setPicking(true);

    try {
      const result: ImagePickerResponse = await launchImageLibrary({
        mediaType: 'photo',
        quality: 1,
        selectionLimit: 1,
      });

      if (result.didCancel || result.errorCode || !result.assets?.length) {
        return null;
      }

      const asset = result.assets[0];
      if (!asset.uri) {
        return null;
      }

      return {
        uri: asset.uri,
        cancelled: false,
      };
    } finally {
      setPicking(false);
    }
  };

  return { pickImage, picking };
}
