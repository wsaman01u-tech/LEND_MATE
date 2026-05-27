import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, isFirebaseConfigured } from './firebase';

const MAX_SIZE = 800; // max dimension
const QUALITY = 0.7;

/** Compress image to a smaller blob */
const compressImage = (file) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    let { width, height } = img;
    if (width > MAX_SIZE || height > MAX_SIZE) {
      const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', QUALITY);
  };
  img.src = URL.createObjectURL(file);
});

/** Upload borrower photo to Firebase Storage */
export const uploadBorrowerPhoto = async (borrowerId, file) => {
  if (!isFirebaseConfigured || !storage) {
    console.warn('Firebase not configured, using base64 fallback');
    // Fallback: convert to base64 data URL for local storage
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  try {
    console.log('Starting photo upload for borrower:', borrowerId);
    const compressed = await compressImage(file);
    console.log('Image compressed successfully');
    
    const path = `borrowers/${borrowerId}/photo.jpg`;
    const storageRef = ref(storage, path);
    console.log('Storage path:', path);
    
    // Upload with metadata
    await uploadBytes(storageRef, compressed, { 
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000'
    });
    console.log('Upload complete, getting download URL...');
    
    // Get download URL with retry logic
    let downloadURL;
    let retries = 3;
    while (retries > 0) {
      try {
        downloadURL = await getDownloadURL(storageRef);
        console.log('Download URL obtained:', downloadURL);
        break;
      } catch (err) {
        retries--;
        console.warn(`Failed to get download URL, retries left: ${retries}`, err);
        if (retries === 0) throw err;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return downloadURL;
  } catch (error) {
    console.error('Photo upload error:', error);
    throw new Error('Failed to upload photo. Please try again.');
  }
};

/** Default avatar SVG as data URL */
export const defaultAvatar = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#e2e8f0"/><circle cx="50" cy="38" r="18" fill="#94a3b8"/><ellipse cx="50" cy="85" rx="30" ry="22" fill="#94a3b8"/></svg>')}`;
