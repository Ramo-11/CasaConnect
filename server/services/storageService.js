const { createClient } = require('@supabase/supabase-js');
const { logger } = require('../logger');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Don't call getPublicUrl here
exports.uploadFile = async (file, folder = 'documents') => {
  try {
    const fileName = `${folder}/${Date.now()}-${file.originalname}`;
    const { error } = await supabase.storage
      .from('casaconnect')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600'
      });

    if (error) throw error;

    logger.debug(`Uploaded file name: ${fileName}`);
    
    return {
      fileName,
      size: file.size,
      mimeType: file.mimetype
    };
  } catch (error) {
    logger.error(`File upload error: ${error}`);
    throw error;
  }
};


// exports.uploadFile = async (file, folder = 'documents') => {
//   try {
//     const fileName = `${folder}/${Date.now()}-${file.originalname}`;
//     const { data, error } = await supabase.storage
//       .from('casaconnect')
//       .upload(fileName, file.buffer, {
//         contentType: file.mimetype,
//         cacheControl: '3600'
//       });

//     if (error) throw error;

//     const { data: signedUrl } = await supabase.storage
//       .from('casaconnect')
//       .createSignedUrl(fileName, 60 * 60); // 1 hour

//     return {
//       fileName,
//       url: signedUrl,
//       size: file.size,
//       mimeType: file.mimetype
//     };
//   } catch (error) {
//     logger.error(`File upload error: ${error}`);
//     throw error;
//   }
// };

exports.deleteFile = async (fileName) => {
  try {
    const { error } = await supabase.storage
      .from('casaconnect')
      .remove([fileName]);
    
    if (error) throw error;
    return true;
  } catch (error) {
    logger.error(`File delete error: ${error}`);
    throw error;
  }
};

exports.getSignedUrl = async (fileName, expiresIn = 3600) => {
  try {
    logger.debug(`Generating signed URL for file: ${fileName}`);
    const { data, error } = await supabase.storage
      .from('casaconnect')
      .createSignedUrl(fileName, expiresIn);
    
    if (error) throw error;
    return data.signedUrl;
  } catch (error) {
    logger.error(`Get signed URL error: ${error}`);
    throw error;
  }
};