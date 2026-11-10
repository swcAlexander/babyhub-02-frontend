import { uploadImage } from '../../../lib/cloudinary.ts';

// Preserve the only legacy call site without exposing the raw, globally configured SDK.
const cloudinary = { uploader: { upload: uploadImage } };
export default cloudinary;
