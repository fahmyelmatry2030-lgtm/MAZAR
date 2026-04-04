"use server";

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function uploadImage(formData: FormData) {
  const file = formData.get('file') as File;
  if (!file) {
    throw new Error('No file uploaded');
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Define the relative and absolute paths
  const uploadDir = join(process.cwd(), 'public', 'uploads');
  const filename = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
  const path = join(uploadDir, filename);

  try {
    // Create the directory if it doesn't exist
    await mkdir(uploadDir, { recursive: true });
    
    // Write the file
    await writeFile(path, buffer);
    
    // Return the public URL
    return `/uploads/${filename}`;
  } catch (error: any) {
    console.error('Upload Error:', error);
    throw new Error('Failed to save file: ' + error.message);
  }
}
